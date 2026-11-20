#!/usr/bin/env python3
"""Rebrand an existing IPA: replace Info.plist and icons, keep everything else.

Usage:
    python rebrand.py <input.ipa> <output.ipa>

What it does:
  - Info.plist  <- Resources/Info.plist   (app display name, version, etc.)
  - Icon-*.png  <- Resources/Icon-*.png   (app icon)
  - removes Payload/*.app/_CodeSignature  (TrollStore re-signs on install)
  - keeps the Mach-O binary, bridge.js, www/, PkgInfo untouched

Why no rebuild is needed: the display name and icon are plain bundle resources,
not compiled into the executable. Changing them only invalidates the old
signature, which TrollStore replaces anyway.

CFBundleIdentifier is never touched, so installing over the old app keeps
its Documents data.
"""
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(ROOT, "Resources")


def find_app_prefix(names):
    for n in names:
        parts = n.split("/")
        if len(parts) >= 2 and parts[0] == "Payload" and parts[1].endswith(".app"):
            return "Payload/" + parts[1] + "/"
    return None


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 1

    src, dst = sys.argv[1], sys.argv[2]
    if not os.path.isfile(src):
        print("input not found:", src)
        return 1

    zin = zipfile.ZipFile(src, "r")
    names = zin.namelist()
    prefix = find_app_prefix(names)
    if not prefix:
        print("not a valid IPA: Payload/*.app/ not found")
        return 1

    plist_src = os.path.join(RES, "Info.plist")
    icon_names = [n for n in os.listdir(RES) if n.startswith("Icon") and n.endswith(".png")]
    if not os.path.isfile(plist_src):
        print("missing:", plist_src)
        return 1

    replaced = []
    dropped = []

    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            name = item.filename

            if name.startswith(prefix + "_CodeSignature/"):
                dropped.append(name)
                continue

            base = name[len(prefix):] if name.startswith(prefix) else None

            if base == "Info.plist":
                with open(plist_src, "rb") as f:
                    data = f.read()
                zi = zipfile.ZipInfo(name, date_time=item.date_time)
                zi.compress_type = zipfile.ZIP_DEFLATED
                zi.external_attr = item.external_attr
                zout.writestr(zi, data)
                replaced.append(name)
                continue

            if base in icon_names:
                with open(os.path.join(RES, base), "rb") as f:
                    data = f.read()
                zi = zipfile.ZipInfo(name, date_time=item.date_time)
                zi.compress_type = zipfile.ZIP_DEFLATED
                zi.external_attr = item.external_attr
                zout.writestr(zi, data)
                replaced.append(name)
                continue

            if name.endswith("/"):
                zi = zipfile.ZipInfo(name, date_time=item.date_time)
                zi.external_attr = item.external_attr
                zout.writestr(zi, b"")
                continue

            zi = zipfile.ZipInfo(name, date_time=item.date_time)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = item.external_attr
            zi.create_system = item.create_system
            zout.writestr(zi, zin.read(name))

    zin.close()

    print("output :", dst)
    print("app    :", prefix)
    print("replaced:", ", ".join(os.path.basename(p) for p in replaced) or "(none)")
    print("dropped :", len(dropped), "signature file(s)")
    print("size   :", os.path.getsize(dst), "bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
