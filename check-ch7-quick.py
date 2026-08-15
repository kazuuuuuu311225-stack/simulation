import re
import subprocess
import tempfile
import os
import pathlib

base = pathlib.Path(__file__).parent
files = [
    "momentum_bat_ball.html",
    "billiard_momentum.html",
    "momentum_2balls_xy.html",
    "momentum_split_merge.html",
    "restitution_ground.html",
    "restitution_1D_collision.html",
]

for f in files:
    text = base.joinpath(f).read_text(encoding="utf-8")
    script = re.search(r"<script>([\s\S]*?)</script>", text).group(1)
    fd, path = tempfile.mkstemp(suffix=".js")
    os.close(fd)
    pathlib.Path(path).write_text(script, encoding="utf-8")
    r = subprocess.run(["node", "--check", path], capture_output=True, text=True)
    os.remove(path)
    if r.returncode != 0:
        print(f"{f}: SYNTAX {r.stderr.strip()}")
        continue

    # quick undefined identifier scan for common bug patterns
    bugs = []
    if "getPreviewData()" in script and "function getPreviewData" not in script:
        bugs.append("getPreviewData() undefined")
    if "PLOT_H" in script and "const PLOT_H" not in script and "let PLOT_H" not in script:
        bugs.append("PLOT_H undefined")
    print(f"{f}: {'OK' if not bugs else ', '.join(bugs)}")
