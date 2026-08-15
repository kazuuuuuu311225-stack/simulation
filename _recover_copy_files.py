# -*- coding: utf-8 -*-
import json
import pathlib
import shutil

base = pathlib.Path(__file__).resolve().parent
transcript = pathlib.Path(r"C:\Users\PC_User\.cursor\projects\c-Users-PC-User-hyakumasu-calc\agent-transcripts\1b949153-93f5-4e20-b596-be04b84d6fb5\1b949153-93f5-4e20-b596-be04b84d6fb5.jsonl")
src = base / "21_conductor_E_V_graph.html"
targets = ["21_grounding_E_V_graph.html", "21_electrostatic_shielding.html"]

for name in targets:
    shutil.copy2(src, base / name)

contents = {name: (base / name).read_text(encoding="utf-8") for name in targets}

with transcript.open(encoding="utf-8") as f:
    for line in f:
        if '"StrReplace"' not in line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        for item in obj.get("message", {}).get("content", []):
            if item.get("type") != "tool_use" or item.get("name") != "StrReplace":
                continue
            inp = item.get("input") or {}
            path = (inp.get("path") or "").replace("\\", "/")
            basename = pathlib.Path(path).name
            if basename not in contents:
                continue
            old = inp.get("old_string")
            new = inp.get("new_string")
            if old is None or new is None:
                continue
            if old in contents[basename]:
                contents[basename] = contents[basename].replace(old, new, 1)

for name, text in contents.items():
    (base / name).write_text(text, encoding="utf-8", newline="\n")
    print(f"restored {name}")
