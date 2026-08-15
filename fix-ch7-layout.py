#!/usr/bin/env python3
"""Fix chapter 7 simulation HTML: JS syntax, layout structure, missing controls."""
from pathlib import Path
import re

DIR = Path(__file__).parent

FILES_CANVAS_LAYOUT = [
    "momentum_bat_ball.html",
    "billiard_momentum.html",
    "momentum_2balls_xy.html",
    "momentum_split_merge.html",
    "restitution_ground.html",
    "restitution_1D_collision.html",
]

FILES_PLOT_LAYOUT = [
    "momentum_2balls_xy.html",
    "momentum_split_merge.html",
    "restitution_ground.html",
    "restitution_1D_collision.html",
]


def fix_js(content: str, plot_layout: bool) -> str:
    if plot_layout:
        content = content.replace(
            "const layout = { w: 0, h: 0, dpr: 1 };",
            "const canvasLayout = { w: 0, h: 0, dpr: 1 };",
            1,
        )
        content = re.sub(
            r"function resizeCanvas\(\) \{\s*"
            r"resizeOneHiDPI\(canvas, canvasWrap, layout, 220\);\s*"
            r"\}\s*"
            r"(?:updateLayout\(w, ht\);\s*)?\}",
            "function resizeCanvas() {\n"
            "      const { w, h: ht } = resizeOneHiDPI(canvas, canvasWrap, canvasLayout, 220);\n"
            "      updateLayout(w, ht);\n"
            "    }",
            content,
            count=1,
        )
    else:
        content = re.sub(
            r"function resizeCanvas\(\) \{\s*"
            r"resizeOneHiDPI\(canvas, canvasWrap, layout, 220\);\s*"
            r"\}\s*\}",
            "function resizeCanvas() {\n"
            "      resizeOneHiDPI(canvas, canvasWrap, layout, 220);\n"
            "    }",
            content,
            count=1,
        )
    return content


def close_ui_before_aside(content: str) -> str:
    return re.sub(
        r'(<div id="statusPanel">[^<]*</div>)\s*(</aside>)',
        r"\1\n          </div>\n        \2",
        content,
        count=1,
    )


def restructure_area_viz(content: str, canvas_label: str, caption: bool = False) -> str:
    pattern = (
        r'<div class="area-viz">\s*'
        r'(?:<div class="view-tabs">.*?</div>\s*)?'
        r'<div class="sim-layout">\s*'
        r'(<section id="calcPanel"[\s\S]*?</section>)\s*'
        r'<div class="canvas-section">\s*'
        r'<div class="canvas-wrap" id="canvasWrap">\s*'
        r'<canvas id="canvas"></canvas>\s*'
        r'</div>\s*</div>\s*'
        r'</div>\s*'
        r'(<div class="legend"[\s\S]*?</div>)'
    )
    m = re.search(pattern, content)
    if not m:
        print("  WARN: area-viz pattern not matched")
        return content

    calc_panel = m.group(1)
    legend = m.group(2)
    caption_html = (
        '\n            <p id="canvasCaption" class="canvas-caption"></p>'
        if caption
        else ""
    )

    tabs_m = re.search(
        r'(<div class="area-viz">\s*<div class="view-tabs">.*?</div>)',
        content,
    )
    if tabs_m:
        replacement = (
            f'{tabs_m.group(1)}\n'
            f'          <div id="simView">\n'
            f'          <div class="viz-block">\n'
            f'            <p class="canvas-label">{canvas_label}</p>\n'
            f'            <div class="canvas-wrap motion" id="canvasWrap">\n'
            f'              <canvas id="canvas"></canvas>\n'
            f'            </div>{caption_html}\n'
            f'            {legend}\n'
            f'          </div>\n'
            f'          {calc_panel}\n'
            f'          </div>'
        )
    else:
        replacement = (
            f'<div class="area-viz">\n'
            f'          <div class="viz-block">\n'
            f'            <p class="canvas-label">{canvas_label}</p>\n'
            f'            <div class="canvas-wrap motion" id="canvasWrap">\n'
            f'              <canvas id="canvas"></canvas>\n'
            f'            </div>{caption_html}\n'
            f'            {legend}\n'
            f'          </div>\n'
            f'          {calc_panel}'
        )

    content = content.replace(m.group(0), replacement, 1)

    record_m = re.search(r'(<section id="recordPanel"[\s\S]*?</section>)', content)
    if record_m and 'class="is-hidden"' not in record_m.group(1):
        content = content.replace(
            record_m.group(1),
            record_m.group(1).replace(
                '<section id="recordPanel"',
                '<section id="recordPanel" class="is-hidden"',
                1,
            ),
            1,
        )
    return content


def patch_billiard_controls(content: str) -> str:
    if 'id="shotBtn"' in content:
        return content
    insert = """
    <p class="formula-box">p = m v　　弾性衝突で法線 n 方向の運動量保存</p>
    <p class="hint">白球 A の角度・速度を設定して「ショット」。静止球 B との弾性衝突を表示します。</p>
    <div class="btn-row">
      <button id="shotBtn" type="button">ショット</button>
      <button id="resetBtn" type="button">リセット</button>
    </div>
"""
    return content.replace(
        '<div id="statusPanel">角度と速度を設定して「ショット」</div>',
        insert + '\n<div id="statusPanel">角度と速度を設定して「ショット」</div>',
        1,
    )


def patch_2balls_controls(content: str) -> str:
    if 'id="startBtn"' in content:
        return content
    block = """
    <div class="param-group b">
      <p class="param-title">球B の初速度</p>
      <label>
        速さ |v<sub>B</sub>| (m/s):
        <input id="vBSpeedSlider" type="range" min="0" max="15" step="0.5" value="0">
        <span id="vBSpeedValue">0.0</span>
      </label>
      <label>
        向き θ<sub>B</sub> (°):
        <input id="thetaBSlider" type="range" min="0" max="360" step="1" value="0">
        <span id="thetaBValue">0</span>
      </label>
      <p class="vel-readout">→ v<sub>Bx</sub> = <span id="vBxValue">0.0</span>、v<sub>By</sub> = <span id="vByValue">0.0</span> m/s</p>
    </div>

    <p class="formula-box">p = m v　　x,y 各方向で運動量保存</p>
    <p class="hint">2球をドラッグで配置し、初速度を設定して「スタート」。</p>
    <div class="btn-row">
      <button id="startBtn" type="button">スタート</button>
      <button id="resetBtn" type="button">リセット</button>
    </div>
"""
    return content.replace(
        '<p class="vel-readout">→ v<sub>Ax</sub> = <span id="vAxValue">5.0</span>、v<sub>Ay</sub> = <span id="vAyValue">2.0</span> m/s</p>\n</div>',
        '<p class="vel-readout">→ v<sub>Ax</sub> = <span id="vAxValue">5.0</span>、v<sub>Ay</sub> = <span id="vAyValue">2.0</span> m/s</p>\n    </div>' + block,
        1,
    )


def patch_split_merge_controls(content: str) -> str:
    if 'id="startBtn"' in content:
        return content
    block = """
    </div>

    <div class="param-group b" id="mergeVelB">
      <p class="param-title">衝突前 — 球B の初速度 (m/s)</p>
      <div class="param-grid">
        <label>v<sub>Bx</sub>: <input id="vBxSlider" type="range" min="-15" max="15" step="0.5" value="-3"><span id="vBxValue">-3.0</span></label>
        <label>v<sub>By</sub>: <input id="vBySlider" type="range" min="-15" max="15" step="0.5" value="0"><span id="vByValue">0.0</span></label>
      </div>
    </div>

    <div class="param-group split" id="splitControls" style="display:none">
      <p class="param-title">分裂 — A の向き θ′<sub>A</sub>、B の向き θ′<sub>B</sub></p>
      <label>
        θ′<sub>A</sub> (°):
        <input id="thetaApSlider" type="range" min="0" max="360" step="1" value="30">
        <span id="thetaApValue">30</span>
      </label>
      <label>
        θ′<sub>B</sub> (°):
        <input id="thetaBpSlider" type="range" min="0" max="360" step="1" value="150">
        <span id="thetaBpValue">150</span>
      </label>
      <p class="hint">|v′<sub>A</sub>| = <span id="vApSpeedValue">—</span> m/s　|v′<sub>B</sub>| = <span id="vBpSpeedValue">—</span> m/s</p>
      <p class="hint"><span id="splitDelayLabel">2.5</span> 秒後に自動分裂</p>
    </div>

    <div class="mode-row">
      <label><input type="radio" name="outcomeMode" id="modeMerge" value="merge" checked> 合体（完全非弾性）</label>
      <label><input type="radio" name="outcomeMode" id="modeSplit" value="split"> 分裂（爆発的分離）</label>
    </div>

    <p class="formula-box">p = m v　　合体: |B−A| ≤ r<sub>A</sub>+r<sub>B</sub></p>
    <p class="hint" id="modeHint">合体モード: 2球を配置して衝突させます。分裂モード: 最初から A+B 合体状態で、スタート後に時間経過で分裂します。</p>
    <div class="btn-row">
      <button id="startBtn" type="button">スタート</button>
      <button id="resetBtn" type="button">リセット</button>
    </div>
"""
    return content.replace(
        '<label>v<sub>Ay</sub>: <input id="vAySlider" type="range" min="-15" max="15" step="0.5" value="1"><span id="vAyValue">1.0</span></label>\n</div>',
        '<label>v<sub>Ay</sub>: <input id="vAySlider" type="range" min="-15" max="15" step="0.5" value="1"><span id="vAyValue">1.0</span></label>\n      </div>' + block,
        1,
    )


def patch_restitution_1d_controls(content: str) -> str:
    if 'id="startBtn"' in content:
        return content
    block = """
    </div>

    <div class="param-group b">
      <p class="param-title">物体 B</p>
      <label>位置 x<sub>B</sub> (m): <input id="xBSlider" type="range" min="-4" max="4" step="0.1" value="2.5"><span id="xBValue">2.5</span></label>
      <label>質量 m<sub>B</sub> (kg): <input id="mBSlider" type="range" min="0.1" max="5" step="0.1" value="1"><span id="mBValue">1.0</span></label>
      <label>初速度 v<sub>B</sub> (m/s): <input id="vBSlider" type="range" min="-15" max="15" step="0.5" value="-2"><span id="vBValue">-2.0</span></label>
    </div>

    <p class="formula-box">v′<sub>rel</sub> = −e v<sub>rel</sub>　　p 保存</p>
    <p class="hint">2物体を一直線上に配置し、「スタート」で衝突させます。</p>
    <div class="btn-row">
      <button id="startBtn" type="button">スタート</button>
      <button id="resetBtn" type="button">リセット</button>
    </div>
"""
    return content.replace(
        '<label>初速度 v<sub>A</sub> (m/s): <input id="vASlider" type="range" min="-15" max="15" step="0.5" value="4"><span id="vAValue">4.0</span></label>\n</div>',
        '<label>初速度 v<sub>A</sub> (m/s): <input id="vASlider" type="range" min="-15" max="15" step="0.5" value="4"><span id="vAValue">4.0</span></label>\n    </div>' + block,
        1,
    )


def add_css_extras(content: str) -> str:
    extra = """
    .vel-readout { margin: 6px 0 0; font-size: 0.78rem; color: #94a3b8; }
    .mode-row { display: flex; flex-direction: column; gap: 8px; font-size: 0.84rem; color: #cbd5e1; }
    .mode-row label { display: flex; align-items: center; gap: 8px; margin: 0; }
    .canvas-caption { margin: 0; padding: 8px 14px; font-size: 0.78rem; color: #94a3b8;
      border-top: 1px solid rgba(148,163,184,0.12);
      background: linear-gradient(180deg, rgba(15,23,42,0.95), rgba(10,14,20,0.98)); }
"""
    if ".mode-row" in content:
        return content
    return content.replace("  </style>", extra + "  </style>", 1)


LABELS = {
    "momentum_bat_ball.html": ("バットとボール", True),
    "billiard_momentum.html": ("ビリヤード台", False),
    "momentum_2balls_xy.html": ("2球衝突（x–y 平面）", False),
    "momentum_split_merge.html": ("合体と分裂", False),
    "restitution_ground.html": ("跳ね返りシミュレーション", False),
    "restitution_1D_collision.html": ("1次元衝突", False),
}

PATCHERS = {
    "billiard_momentum.html": patch_billiard_controls,
    "momentum_2balls_xy.html": patch_2balls_controls,
    "momentum_split_merge.html": patch_split_merge_controls,
    "restitution_1D_collision.html": patch_restitution_1d_controls,
}


def main():
    for name in FILES_CANVAS_LAYOUT:
        path = DIR / name
        text = path.read_text(encoding="utf-8")
        text = add_css_extras(text)
        if name in PATCHERS:
            text = PATCHERS[name](text)
        text = close_ui_before_aside(text)
        label, caption = LABELS[name]
        text = restructure_area_viz(text, label, caption)
        text = fix_js(text, name in FILES_PLOT_LAYOUT)
        path.write_text(text, encoding="utf-8")
        print(f"fixed {name}")


if __name__ == "__main__":
    main()
