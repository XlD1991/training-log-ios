#!/usr/bin/env python3
"""键盘避让验证：无头 Edge 加载测试页，读 document.title 里的结果。"""
import json, os, re, subprocess, tempfile
from e2e_full import find_edge

ROOT = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(ROOT, "e2e_keyboard_page.html")


def main():
    js = open(os.path.join(ROOT, "e2e_keyboard.js"), encoding="utf-8").read()
    html = "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body><script>" + js + "</script></body></html>"
    with open(PAGE, "w", encoding="utf-8") as f:
        f.write(html)
    edge = find_edge()
    profile = tempfile.mkdtemp(prefix="kbtest_")
    cmd = [edge, "--headless=new", "--disable-gpu", "--no-sandbox",
           "--window-size=390,844", "--force-device-scale-factor=1",
           "--user-data-dir=" + profile, "--dump-dom", "file:///" + PAGE.replace("\\", "/")]
    out = subprocess.run(cmd, capture_output=True, timeout=60)
    dom = out.stdout.decode("utf-8", "replace")
    m = re.search(r"RESULT:(\{.*?\})</title>", dom, re.S)
    if not m:
        print("未拿到结果，DOM 长度", len(dom))
        return 2
    data = json.loads(m.group(1))
    print("键盘避让验证：%d 通过，%d 失败" % (data["pass"], data["fail"]))
    for f in data.get("fails", []):
        print("  ✗ " + f)
    try:
        os.remove(PAGE)
    except OSError:
        pass
    return 0 if data["fail"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
