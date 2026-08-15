# -*- coding: utf-8 -*-
import json
import pathlib
import re

base = pathlib.Path(__file__).resolve().parent
transcript = pathlib.Path(r"C:\Users\PC_User\.cursor\projects\c-Users-PC-User-hyakumasu-calc\agent-transcripts\1b949153-93f5-4e20-b596-be04b84d6fb5\1b949153-93f5-4e20-b596-be04b84d6fb5.jsonl")

missing = []
for folder in ["00_folder_thermo.html", "00_folder_classical.html", "00_folder_waves.html", "00_folder_electromagnetism.html", "00_folder_ex.html"]:
    fp = base / folder
    if not fp.exists():
        continue
    html = fp.read_text(encoding="utf-8")
    links = re.findall(r'href="([^"]+\.html)"', html)
    for link in links:
        if link.startswith("00_"):
            continue
        if not (base / link).exists():
            missing.append(link)

missing = sorted(set(missing))
print(f"Missing files: {len(missing)}")

recovered = {}
if transcript.exists():
    with transcript.open(encoding="utf-8") as f:
        for line in f:
            if '"Write"' not in line and '"StrReplace"' not in line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            content = obj.get("message", {}).get("content", [])
            if not isinstance(content, list):
                continue
            for item in content:
                if item.get("type") != "tool_use":
                    continue
                name = item.get("name")
                inp = item.get("input") or {}
                path = inp.get("path") or ""
                if not path:
                    continue
                basename = pathlib.Path(path.replace("\\", "/")).name
                if basename not in missing:
                    continue
                if name == "Write" and inp.get("contents"):
                    recovered[basename] = inp["contents"]
                elif name == "StrReplace" and basename in recovered:
                    old = inp.get("old_string")
                    new = inp.get("new_string")
                    if old is None or new is None:
                        continue
                    if old in recovered[basename]:
                        recovered[basename] = recovered[basename].replace(old, new, 1)

restored = []
for name in missing:
    if name not in recovered:
        continue
    out = base / name
    out.write_text(recovered[name], encoding="utf-8", newline="\n")
    restored.append(name)

print(f"Restored from transcript: {len(restored)}")
for name in restored:
    print(f"  + {name}")

still_missing = [n for n in missing if n not in restored]
print(f"Still missing: {len(still_missing)}")
for name in still_missing[:30]:
    print(f"  - {name}")
if len(still_missing) > 30:
    print(f"  ... and {len(still_missing) - 30} more")
