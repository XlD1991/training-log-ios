#!/usr/bin/env python3
"""在「网页版/小程序导出的 JSON 备份」与「App 的 storage.json」之间转换。

App 把所有 localStorage 键值存成 Documents/storage.json，格式是:
    {"workout_log_v1": "<原本该存进 localStorage 的字符串>", ...}
而网页版/小程序的导出备份是 state 对象本身。

用法:
    python backup_tool.py import  <备份.json> <storage.json>   # 旧数据 -> 装进 App
    python backup_tool.py export  <storage.json> <备份.json>   # App 数据 -> 导出备份
    python backup_tool.py show    <storage.json>               # 查看里面的键
"""
import json
import os
import sys

KEY = "workout_log_v1"


def read_json(path):
    with open(path, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def write_json(path, obj, pretty=True):
    with open(path, "w", encoding="utf-8") as f:
        if pretty:
            json.dump(obj, f, ensure_ascii=False, indent=2)
        else:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")


def unwrap(obj):
    """兼容几种常见的备份包装格式，取出真正的 state。"""
    if not isinstance(obj, dict):
        return obj
    for k in ("state", "data", "backup"):
        if k in obj and isinstance(obj[k], dict):
            return obj[k]
    if "records" in obj or "mode" in obj or "plans" in obj:
        return obj
    return obj


def cmd_import(backup, storage):
    state = unwrap(read_json(backup))
    payload = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    data = {}
    if os.path.isfile(storage):
        old = read_json(storage)
        if isinstance(old, dict):
            data.update(old)
    data[KEY] = payload
    write_json(storage, data, pretty=False)
    n = len(state.get("records", [])) if isinstance(state, dict) else 0
    print("已写入 %s：%d 条记录，键 %s" % (storage, n, list(data.keys())))


def cmd_export(storage, backup):
    data = read_json(storage)
    if not isinstance(data, dict) or KEY not in data:
        sys.exit("storage.json 里找不到 %s，确认文件来自 App 的 Documents 目录" % KEY)
    raw = data[KEY]
    state = json.loads(raw) if isinstance(raw, str) else raw
    write_json(backup, state)
    n = len(state.get("records", [])) if isinstance(state, dict) else 0
    print("已导出 %s：%d 条记录" % (backup, n))


def cmd_show(storage):
    data = read_json(storage)
    if not isinstance(data, dict):
        sys.exit("storage.json 格式不对")
    for k, v in data.items():
        print("%-40s %8d 字符" % (k, len(v) if isinstance(v, str) else len(json.dumps(v))))


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    op, a = sys.argv[1], sys.argv[2]
    b = sys.argv[3] if len(sys.argv) > 3 else None
    if op == "import" and b:
        cmd_import(a, b)
    elif op == "export" and b:
        cmd_export(a, b)
    elif op == "show":
        cmd_show(a)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
