#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""饮食模块无头测试：复制 www 到临时目录，注入 e2e_diet.js，用 Edge dump-dom 取结果。
   不改动 ios/www，也不会把脚本打进 IPA。"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
WWW = os.path.join(ROOT, "www")
TEST_JS = os.path.join(ROOT, "e2e_diet.js")
EDGE_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
]


def find_edge():
    for p in EDGE_CANDIDATES:
        if os.path.isfile(p):
            return p
    raise SystemExit("找不到 msedge.exe")


def main():
    edge = find_edge()
    width = 390
    height = 844
    for a in sys.argv[1:]:
        m = re.match(r'^--width=(\d+)$', a)
        if m:
            width = int(m.group(1))
            height = int(round(width * 2.16))
    tmp = tempfile.mkdtemp(prefix="tl_diet_")
    try:
        work = os.path.join(tmp, "www")
        shutil.copytree(WWW, work)
        with open(os.path.join(work, "index.html"), encoding="utf-8") as f:
            html = f.read()
        with open(TEST_JS, encoding="utf-8") as f:
            js = f.read()
        html = html.replace("</body>", "<script>\n" + js + "\n</script>\n</body>")
        with open(os.path.join(work, "index.html"), "w", encoding="utf-8") as f:
            f.write(html)

        profile = os.path.join(tmp, "profile")
        url = "file:///" + os.path.join(work, "index.html").replace("\\", "/")
        cmd = [
            edge, "--headless=new", "--disable-gpu", "--no-sandbox",
            "--allow-file-access-from-files", "--window-size=%d,%d" % (width, height),
            "--force-device-scale-factor=1", "--virtual-time-budget=12000",
            "--user-data-dir=" + profile, "--dump-dom", url,
        ]
        out = subprocess.run(cmd, capture_output=True, timeout=180)
        dom = out.stdout.decode("utf-8", "replace")
        m = re.search(r"RESULT:(\{.*?\})</title>", dom, re.S)
        if not m:
            title = re.search(r"<title>(.*?)</title>", dom, re.S)
            print("未拿到测试结果。title =", (title.group(1) if title else "")[:300])
            print("DOM 字节:", len(dom))
            return 2
        data = json.loads(m.group(1))
        print("饮食模块 E2E（%dpt）：%d 通过，%d 失败" % (width, data["pass"], data["fail"]))
        for e in data.get("errors", []):
            print("  x " + e)
        return 0 if data["fail"] == 0 else 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
