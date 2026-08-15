# -*- coding: utf-8 -*-
import pathlib

base = pathlib.Path(__file__).resolve().parent
lines = (base / "index.html").read_text(encoding="utf-8").splitlines()

def chapter_block(start, end):
    block = "\n".join(lines[start - 1 : end])
    import re
    block = re.sub(r"\s*</ul>\s*</li>\s*$", "", block, flags=re.S)
    return block.strip()

folders = [
    {
        "file": "00_folder_classical.html",
        "title": "力学",
        "sub": "古典力学 · 1〜11章 · 物体の運動から万有引力まで",
        "stat": "11章",
        "accent": "#60a5fa",
        "cls": "classical",
        "start": 552,
        "end": 951,
    },
    {
        "file": "00_folder_thermo.html",
        "title": "熱力学",
        "sub": "12〜15章 · 熱 · 気体 · 分子運動論 · 黒体放射",
        "stat": "4章",
        "accent": "#fb923c",
        "cls": "thermo",
        "start": 969,
        "end": 1112,
    },
    {
        "file": "00_folder_waves.html",
        "title": "波動",
        "sub": "16章〜20章 · 波から音・光・レンズ・干渉まで",
        "stat": "5章",
        "accent": "#38bdf8",
        "cls": "waves",
        "start": 1184,
        "end": 1421,
    },
    {
        "file": "00_folder_ex.html",
        "title": "EX章",
        "sub": "物性 · 生物 · 分析装置 · 蛍光 · 燐光",
        "stat": "16 シミュレーション",
        "accent": "#06b6d4",
        "cls": "ex",
        "start": 1249,
        "end": 1430,
    },
]

template = (base / "_folder_template.html").read_text(encoding="utf-8")

for f in folders:
    html = (
        template.replace("{{TITLE}}", f["title"])
        .replace("{{SUB}}", f["sub"])
        .replace("{{STAT}}", f["stat"])
        .replace("{{ACCENT}}", f["accent"])
        .replace("{{CLASS}}", f["cls"])
        .replace("{{CHAPTERS}}", chapter_block(f["start"], f["end"]))
    )
    (base / f["file"]).write_text(html, encoding="utf-8")
    print("Wrote", f["file"])

print("Done.")
