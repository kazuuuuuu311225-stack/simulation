#!/usr/bin/env python3
"""Fix simulation back links: index.html -> correct folder menu."""
import re
from pathlib import Path

ROOTS = [
    Path(r"C:\Users\PC_User\hyakumasu-calc\projectile-sim"),
    Path(r"C:\Users\PC_User\Desktop\hyakumasu-calc\projectile-sim"),
]

FOLDER_GLOB = "00_folder_*.html"
SKIP = {"index.html", "index-full.html"}


def build_sim_map(root: Path) -> dict[str, str]:
    sim_to_back: dict[str, str] = {}
    for folder_file in sorted(root.glob(FOLDER_GLOB)):
        text = folder_file.read_text(encoding="utf-8")
        current_chapter = None
        for line in text.splitlines():
            if 'class="sim-list"' in line:
                m = re.search(r'id="([^"]+)"', line)
                if m:
                    current_chapter = m.group(1)
            if 'class="chapter chapter--' in line:
                m = re.search(r'id="([^"]+)"', line)
                if m:
                    current_chapter = m.group(1)
            if 'class="chapter-toggle"' in line:
                m = re.search(r'aria-controls="([^"]+)"', line)
                if m:
                    current_chapter = m.group(1)
            if 'menu-link' in line and 'href="' in line:
                m = re.search(r'href="([^"]+\.html)"', line)
                if m and current_chapter:
                    sim = Path(m.group(1)).name
                    sim_to_back[sim] = f"{folder_file.name}#{current_chapter}"
    return sim_to_back


def fix_root(root: Path) -> list[str]:
    if not root.is_dir():
        return [f"SKIP missing: {root}"]
    sim_map = build_sim_map(root)
    logs: list[str] = []
    for html in sorted(root.glob("*.html")):
        if html.name in SKIP or html.name.startswith("00_"):
            continue
        content = html.read_text(encoding="utf-8")
        if "index.html" not in content:
            continue
        new_href = sim_map.get(html.name, "00_physLabo_top.html")
        new_content = content.replace('href="index.html"', f'href="{new_href}"')
        new_content = new_content.replace("href='index.html'", f"href='{new_href}'")
        if new_content == content:
            continue
        html.write_text(new_content, encoding="utf-8")
        logs.append(f"{root.name}/{html.name} -> {new_href}")
    return logs


def main() -> None:
    all_logs: list[str] = []
    for root in ROOTS:
        all_logs.extend(fix_root(root))
    print(f"Fixed {len(all_logs)} files")
    for line in all_logs[:5]:
        print(line)
    if len(all_logs) > 5:
        print(f"... and {len(all_logs) - 5} more")


if __name__ == "__main__":
    main()
