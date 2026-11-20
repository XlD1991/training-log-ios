#!/usr/bin/env python3
"""在 Windows / 任意平台替换 IPA 里的网页资源，不需要 Mac。

用法:
    python repack.py <原IPA> [输出IPA] [--www 目录]

只替换 Payload/TrainingLog.app/www/ 下的文件；
二进制、Info.plist、图标、PkgInfo 全部原样保留。
TrollStore 安装时会重新签名，所以重打包后无需任何签名步骤。
"""
import argparse
import os
import sys
import zipfile

APP_PREFIX = "Payload/TrainingLog.app/"
WWW_PREFIX = APP_PREFIX + "www/"


def collect(root):
    out = {}
    for base, _dirs, files in os.walk(root):
        for name in files:
            full = os.path.join(base, name)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            out[rel] = full
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ipa")
    ap.add_argument("output", nargs="?", default=None)
    ap.add_argument("--www", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "www"))
    args = ap.parse_args()

    if not os.path.isfile(args.ipa):
        sys.exit("找不到 IPA: " + args.ipa)
    if not os.path.isdir(args.www):
        sys.exit("找不到 www 目录: " + args.www)

    output = args.output or os.path.splitext(args.ipa)[0] + "-updated.ipa"
    new_files = collect(args.www)
    replaced = kept = 0

    with zipfile.ZipFile(args.ipa, "r") as zin, \
         zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            name = info.filename
            if name.startswith(WWW_PREFIX):
                replaced += 1
                continue
            zout.writestr(info, zin.read(name))
            kept += 1
        for rel, full in sorted(new_files.items()):
            zout.write(full, WWW_PREFIX + rel)

    print("保留条目 %d 个，移除旧 www 条目 %d 个，写入新 www 文件 %d 个"
          % (kept, replaced, len(new_files)))
    print("输出: " + output)
    with zipfile.ZipFile(output) as z:
        bad = z.testzip()
        if bad:
            sys.exit("打包校验失败: " + bad)
    print("ZIP 校验通过")


if __name__ == "__main__":
    main()
