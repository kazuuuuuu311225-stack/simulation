import re
from pathlib import Path

ROOT = Path(__file__).parent
TOOLBAR = """    <div class="chapter-toolbar">
      <h2 class="section-title">CHAPTERS</h2>
      <div class="toolbar-actions">
        <button type="button" class="toolbar-btn" id="expandAll">すべて開く</button>
        <button type="button" class="toolbar-btn" id="collapseAll">すべて閉じる</button>
      </div>
    </div>
    <p class="menu-hint">章名をタップするとシミュレーション一覧が開きます。</p>"""
SCRIPTS = """  <script src="js/physlabo-shared.js"></script>
  <script src="js/physlabo-bg.js"></script>
  <script src="js/physlabo-folder.js"></script>
</body>"""
ACCENTS = {
    "00_folder_classical.html": "#60a5fa",
    "00_folder_thermo.html": "#fb923c",
    "00_folder_waves.html": "#38bdf8",
    "00_folder_electromagnetism.html": "#818cf8",
    "00_folder_atom.html": "#f472b6",
    "00_folder_ex.html": "#06b6d4",
}

for fname, accent in ACCENTS.items():
    p = ROOT / fname
    text = p.read_text(encoding="utf-8")
    new_style = (
        f'  <style>:root {{ --folder-accent: {accent}; }}</style>\n'
        f'  <link rel="stylesheet" href="css/physlabo-folder.css">'
    )
    text = re.sub(r"  <style>.*?</style>", new_style, text, count=1, flags=re.S)
    if "data-sim-count" not in text:
        text = re.sub(
            r'(<div class="folder-stats">.*?)(</div>)',
            r'\1\n        <span class="stat stat--sims" data-sim-count></span>\n      \2',
            text,
            count=1,
            flags=re.S,
        )
        text = re.sub(
            r'<span class="stat">6章</span>\s*</header>',
            '<div class="folder-stats">\n        <span class="stat">6章</span>\n        <span class="stat stat--sims" data-sim-count></span>\n      </div>\n    </header>',
            text,
        )
    text = text.replace(
        '<p class="menu-hint">章名をタップするとシミュレーション一覧が開きます。</p>',
        TOOLBAR,
    )
    text = re.sub(r"  <script>.*?</script>\s*</body>", SCRIPTS, text, count=1, flags=re.S)
    if fname == "00_folder_electromagnetism.html":
        if "bg-gradient" not in text:
            text = text.replace(
                "<body>\n  <div class=\"page-wrap\">",
                '<body>\n  <div class="bg-gradient" aria-hidden="true"></div>\n'
                '  <canvas id="bgCanvas" aria-hidden="true"></canvas>\n\n'
                '  <div class="page-wrap">',
            )
        text = text.replace(
            '<ul style="list-style:none;margin:0;padding:0">',
            '<ul class="chapter-list">',
        )
        text = text.replace(
            '<div style="font-size:1.6rem;margin-bottom:0.5rem">⚡</div>',
            '<div class="folder-icon" aria-hidden="true">⚡</div>',
        )
        text = re.sub(
            r"<footer>\s*<p>physLabo © 2026 Ichishi</p>\s*<a href=\"index.html\">メニューへ</a>\s*</footer>",
            '<footer>\n    <p class="footer-text">physLabo © 2026 Ichishi</p>\n'
            '    <a class="footer-link" href="00_physLabo_top.html">トップへ戻る</a>\n  </footer>',
            text,
        )
        for ch in range(21, 27):
            pat = (
                rf'(<li class="chapter" id="chapter-{ch}">)\s*'
                rf'<button type="button" class="chapter-toggle" aria-expanded="false">\s*'
                rf'<span class="chapter-badge">{ch}章</span>\s*'
                rf'<span class="chapter-name">([^<]+)</span>\s*'
                rf'<span class="chapter-count">(\d+)</span>'
            )
            rep = (
                rf'<li class="chapter chapter--{ch}" id="chapter-{ch}">\n'
                rf'        <button type="button" class="chapter-toggle" aria-expanded="false" aria-controls="chapter-{ch}">\n'
                rf'          <span class="chapter-badge">{ch}章</span>\n'
                rf'          <span class="chapter-name">\2</span>\n'
                rf'          <span class="chapter-meta">\n'
                rf'            <span class="chapter-count">\3</span>\n'
                rf'            <span class="chapter-chevron" aria-hidden="true">▾</span>\n'
                rf'          </span>'
            )
            text = re.sub(pat, rep, text)
    p.write_text(text, encoding="utf-8", newline="\n")
    print("OK", fname)
