$ErrorActionPreference = "Stop"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$indexPath = Join-Path $base "index.html"
$lines = [System.IO.File]::ReadAllLines($indexPath, [System.Text.Encoding]::UTF8)

function Get-ChapterBlock([int]$start, [int]$end) {
  $block = ($lines[($start - 1)..($end - 1)] -join "`n")
  $block = $block -replace '(?s)\s*</ul>\s*</li>\s*$', ''
  return $block.Trim()
}

$folders = @(
  @{
    File = "00_folder_classical.html"
    Title = "力学"
    Sub = "古典力学 · 1〜11章 · 物体の運動から万有引力まで"
    Stat = "11章"
    Accent = "#60a5fa"
    Class = "classical"
    Start = 552; End = 951
  },
  @{
    File = "00_folder_thermo.html"
    Title = "熱力学"
    Sub = "12〜15章 · 熱 · 気体 · 分子運動論 · 黒体放射"
    Stat = "4章"
    Accent = "#fb923c"
    Class = "thermo"
    Start = 969; End = 1112
  },
  @{
    File = "00_folder_waves.html"
    Title = "波動"
    Sub = "16章〜20章 · 波から音・光・レンズ・干渉まで"
    Stat = "5章"
    Accent = "#38bdf8"
    Class = "waves"
    Start = 1184; End = 1421
  },
  @{
    File = "00_folder_ex.html"
    Title = "EX章"
    Sub = "物性 · 生物 · 分析装置 · 蛍光 · 燐光"
    Stat = "16 シミュレーション"
    Accent = "#06b6d4"
    Class = "ex"
    Start = 1249; End = 1430
  }
)

$template = @'
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>physLabo — {{TITLE}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    :root {
      --folder-accent: {{ACCENT}};
      --blue-deep: #0a1628;
    }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100dvh;
      font-family: "Inter", "Poppins", "Noto Sans JP", sans-serif;
      color: #f1f5f9;
      overflow-x: hidden;
      background: var(--blue-deep);
      touch-action: manipulation;
      -webkit-text-size-adjust: 100%;
    }
    .bg-gradient {
      position: fixed;
      inset: 0;
      z-index: 0;
      background: linear-gradient(145deg, #070d1a 0%, #0f1f4d 30%, #312e81 55%, #581c87 78%, #701a75 100%);
      animation: bgShift 16s ease-in-out infinite alternate;
    }
    @keyframes bgShift {
      0% { background: linear-gradient(145deg, #070d1a 0%, #0f1f4d 28%, #312e81 52%, #581c87 75%, #6b21a8 100%); }
      100% { background: linear-gradient(155deg, #0a1628 0%, #1e40af 35%, #5b21b6 58%, #86198f 82%, #701a75 100%); }
    }
    #bgCanvas {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
      pointer-events: none;
    }
    .page-wrap {
      position: relative;
      z-index: 2;
      width: min(720px, 94vw);
      margin: 0 auto;
      padding: max(16px, env(safe-area-inset-top)) 0 max(32px, env(safe-area-inset-bottom));
    }
    .folder-hero {
      text-align: center;
      padding: 1.5rem 1.25rem 1.35rem;
      margin-bottom: 1rem;
      border-radius: 22px;
      background: rgba(10, 18, 40, 0.52);
      border: 1px solid color-mix(in srgb, var(--folder-accent) 28%, transparent);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      margin-bottom: 1rem;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #cbd5e1;
      text-decoration: none;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(148, 163, 184, 0.18);
      transition: background 0.15s, border-color 0.15s;
    }
    .back-link:hover {
      background: rgba(167, 139, 250, 0.14);
      border-color: rgba(167, 139, 250, 0.35);
      color: #f8fafc;
    }
    .folder-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      margin-bottom: 0.75rem;
      border-radius: 16px;
      font-size: 1.6rem;
      background: color-mix(in srgb, var(--folder-accent) 18%, transparent);
      border: 1px solid color-mix(in srgb, var(--folder-accent) 35%, transparent);
      box-shadow: 0 0 28px color-mix(in srgb, var(--folder-accent) 25%, transparent);
    }
    .folder-hero h1 {
      margin: 0 0 0.4rem;
      font-size: clamp(1.45rem, 4.5vw, 1.85rem);
      font-weight: 700;
      letter-spacing: 0.03em;
      color: #fff;
      text-shadow: 0 0 32px color-mix(in srgb, var(--folder-accent) 40%, transparent);
    }
    .folder-sub {
      margin: 0 auto;
      max-width: 30em;
      color: #94a3b8;
      font-size: 0.88rem;
      line-height: 1.65;
    }
    .folder-stats {
      display: flex;
      justify-content: center;
      gap: 0.6rem;
      flex-wrap: wrap;
      margin-top: 0.9rem;
    }
    .stat {
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--folder-accent);
      background: color-mix(in srgb, var(--folder-accent) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--folder-accent) 28%, transparent);
    }
    .menu-hint {
      margin: 0 0 1rem;
      padding: 10px 14px;
      border-radius: 12px;
      background: rgba(129, 140, 248, 0.1);
      border: 1px solid rgba(129, 140, 248, 0.18);
      color: #94a3b8;
      font-size: 0.82rem;
      text-align: center;
      line-height: 1.55;
    }
    .chapter-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .chapter {
      --chapter-accent: #38bdf8;
      padding: 0.75rem 0.9rem;
      border-radius: 16px;
      background: rgba(10, 18, 40, 0.48);
      border: 1px solid rgba(148, 163, 184, 0.14);
      box-shadow: 0 2px 14px rgba(0, 0, 0, 0.28);
      transition: background 0.22s, border-color 0.22s, box-shadow 0.22s;
    }
    .chapter.is-open {
      background: rgba(16, 22, 40, 0.82);
      border-color: color-mix(in srgb, var(--chapter-accent) 38%, transparent);
      box-shadow: 0 4px 28px rgba(0, 0, 0, 0.38), 0 0 0 1px color-mix(in srgb, var(--chapter-accent) 14%, transparent);
    }
    .chapter--1 { --chapter-accent: #38bdf8; }
    .chapter--2 { --chapter-accent: #0ea5e9; }
    .chapter--3 { --chapter-accent: #3b82f6; }
    .chapter--4 { --chapter-accent: #6366f1; }
    .chapter--5 { --chapter-accent: #34d399; }
    .chapter--6 { --chapter-accent: #fbbf24; }
    .chapter--7 { --chapter-accent: #fb7185; }
    .chapter--8 { --chapter-accent: #a78bfa; }
    .chapter--9 { --chapter-accent: #2dd4bf; }
    .chapter--10 { --chapter-accent: #60a5fa; }
    .chapter--11 { --chapter-accent: #c084fc; }
    .chapter--12 { --chapter-accent: #22d3ee; }
    .chapter--14 { --chapter-accent: #f472b6; }
    .chapter--15 { --chapter-accent: #fb923c; }
    .chapter--16 { --chapter-accent: #38bdf8; }
    .chapter--17 { --chapter-accent: #fbbf24; }
    .chapter--ex { --chapter-accent: #06b6d4; }
    .chapter-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      margin: 0;
      padding: 6px 4px;
      border: none;
      background: none;
      font: inherit;
      color: inherit;
      cursor: pointer;
      text-align: left;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .chapter-toggle:focus-visible {
      outline: 2px solid var(--chapter-accent);
      outline-offset: 3px;
      border-radius: 10px;
    }
    .chapter-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      min-width: 2.6rem;
      padding: 3px 8px;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--chapter-accent);
      letter-spacing: 0.03em;
      background: color-mix(in srgb, var(--chapter-accent) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--chapter-accent) 28%, transparent);
      border-radius: 8px;
    }
    .chapter-name {
      flex: 1;
      min-width: 0;
      font-size: 0.98rem;
      font-weight: 600;
      color: #f1f5f9;
      line-height: 1.45;
    }
    .chapter-meta {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-shrink: 0;
    }
    .chapter-count {
      font-size: 0.7rem;
      font-weight: 600;
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.05);
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.12);
    }
    .chapter-chevron {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      font-size: 0.75rem;
      color: var(--chapter-accent);
      background: color-mix(in srgb, var(--chapter-accent) 10%, transparent);
      border-radius: 6px;
      transition: transform 0.22s ease, background 0.22s;
      line-height: 1;
    }
    .chapter.is-open .chapter-chevron {
      transform: rotate(180deg);
      background: color-mix(in srgb, var(--chapter-accent) 18%, transparent);
    }
    .sim-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: none;
      flex-direction: column;
      gap: 0.55rem;
      margin-top: 0.65rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(148, 163, 184, 0.1);
    }
    .chapter.is-open .sim-list {
      display: flex;
      animation: simReveal 0.28s ease;
    }
    @keyframes simReveal {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .menu-link {
      display: block;
      padding: 13px 14px;
      min-height: 48px;
      background: rgba(255, 255, 255, 0.03);
      color: #e2e8f0;
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-left: 3px solid var(--chapter-accent);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.92rem;
      transition: background 0.15s, border-color 0.15s, transform 0.12s, box-shadow 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .menu-link:hover {
      background: rgba(255, 255, 255, 0.07);
      border-color: color-mix(in srgb, var(--chapter-accent) 35%, rgba(148, 163, 184, 0.2));
      box-shadow: 0 0 20px color-mix(in srgb, var(--chapter-accent) 12%, transparent);
    }
    .menu-link:active { transform: scale(0.985); }
    .menu-desc {
      display: block;
      margin-top: 5px;
      font-size: 0.78rem;
      font-weight: 400;
      color: #94a3b8;
      line-height: 1.5;
    }
    .ex-section { list-style: none; margin: 0; padding: 0; }
    .ex-section + .ex-section {
      margin-top: 0.25rem;
      padding-top: 0.65rem;
      border-top: 1px dashed rgba(148, 163, 184, 0.16);
    }
    .ex-section-head {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
      padding: 2px 2px 0.55rem;
    }
    .ex-section-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 9px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--ex-accent);
      background: color-mix(in srgb, var(--ex-accent) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--ex-accent) 28%, transparent);
      border-radius: 999px;
    }
    .ex-section-desc { font-size: 0.72rem; color: #64748b; line-height: 1.4; }
    .ex-section--props { --ex-accent: #a78bfa; }
    .ex-section--bio { --ex-accent: #4ade80; }
    .ex-section--inst { --ex-accent: #38bdf8; }
    .ex-section--fluor { --ex-accent: #a3e635; }
    .ex-section-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .ex-section-list .menu-link { border-left-color: var(--ex-accent); }
    footer {
      position: relative;
      z-index: 2;
      text-align: center;
      padding: 1.5rem 1rem 2rem;
    }
    .footer-text {
      margin: 0 0 0.5rem;
      font-size: 0.78rem;
      color: #64748b;
      letter-spacing: 0.04em;
    }
    .footer-link {
      font-size: 0.8rem;
      color: #a78bfa;
      text-decoration: none;
    }
    .footer-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="bg-gradient" aria-hidden="true"></div>
  <canvas id="bgCanvas" aria-hidden="true"></canvas>

  <div class="page-wrap">
    <header class="folder-hero folder-hero--{{CLASS}}">
      <a class="back-link" href="00_physLabo_top.html">← physLabo トップ</a>
      <div class="folder-icon" aria-hidden="true">📁</div>
      <h1>{{TITLE}}</h1>
      <p class="folder-sub">{{SUB}}</p>
      <div class="folder-stats"><span class="stat">{{STAT}}</span></div>
    </header>

    <p class="menu-hint">章名をタップするとシミュレーション一覧が開きます。</p>

    <ul class="chapter-list">
{{CHAPTERS}}
    </ul>
  </div>

  <footer>
    <p class="footer-text">physLabo © 2026 Ichishi</p>
    <a class="footer-link" href="00_physLabo_top.html">トップへ戻る</a>
  </footer>

  <script>
    (function () {
      "use strict";

      document.querySelectorAll(".chapter-toggle").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var chapter = btn.closest(".chapter");
          var open = chapter.classList.toggle("is-open");
          btn.setAttribute("aria-expanded", open ? "true" : "false");
        });
      });

      function openFromHash() {
        var hash = location.hash.slice(1);
        if (!hash) return;
        var target = document.getElementById(hash);
        if (!target) return;
        var chapter = target.closest(".chapter") || (target.classList.contains("chapter") ? target : null);
        if (chapter) {
          chapter.classList.add("is-open");
          var ct = chapter.querySelector(".chapter-toggle");
          if (ct) ct.setAttribute("aria-expanded", "true");
        }
        requestAnimationFrame(function () {
          (chapter || target).scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }

      openFromHash();
      window.addEventListener("hashchange", openFromHash);

      function makeWaveGradient(ctx, w, a1, a2) {
        var g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, "rgba(37, 99, 235, " + a1 + ")");
        g.addColorStop(0.55, "rgba(124, 58, 237, " + ((a1 + a2) / 2) + ")");
        g.addColorStop(1, "rgba(217, 70, 239, " + a2 + ")");
        return g;
      }

      function fitCanvas(canvas) {
        var dpr = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        var w = rect.width || canvas.clientWidth || 800;
        var h = rect.height || canvas.clientHeight || 600;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        var ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx: ctx, w: w, h: h };
      }

      var bgCanvas = document.getElementById("bgCanvas");
      var scrollY = 0;
      var bgPhase = 0;
      var sparks = [];
      for (var s = 0; s < 14; s++) {
        sparks.push({
          x: Math.random(),
          y: Math.random(),
          r: 4 + Math.random() * 6,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.8
        });
      }
      var bgWaves = [
        { amp: 40, freq: 0.006, speed: 0.2, y: 0.3, alpha: 0.1 },
        { amp: 50, freq: 0.004, speed: 0.15, y: 0.6, alpha: 0.08 }
      ];

      function drawBackground() {
        var view = fitCanvas(bgCanvas);
        var ctx = view.ctx, w = view.w, h = view.h;
        ctx.clearRect(0, 0, w, h);
        bgPhase += 0.3;
        var parallax = scrollY * 0.15;
        for (var i = 0; i < bgWaves.length; i++) {
          var bw = bgWaves[i];
          var midY = h * bw.y + parallax * (0.06 + i * 0.04);
          ctx.beginPath();
          for (var x = 0; x <= w; x += 4) {
            var y = midY + bw.amp * Math.sin(x * bw.freq + bgPhase * bw.speed * 0.04 + i);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = makeWaveGradient(ctx, w, bw.alpha, bw.alpha * 0.6);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        var t = performance.now() / 1000;
        for (var j = 0; j < sparks.length; j++) {
          var sp = sparks[j];
          var pulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * sp.speed + sp.phase));
          var sx = sp.x * w;
          var sy = sp.y * h + parallax * 0.04;
          var grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, sp.r * 2.5);
          grd.addColorStop(0, "rgba(255,255,255," + pulse + ")");
          grd.addColorStop(0.4, "rgba(167,139,250," + (pulse * 0.5) + ")");
          grd.addColorStop(1, "transparent");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(sx, sy, sp.r * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function frame() {
        drawBackground();
        requestAnimationFrame(frame);
      }

      window.addEventListener("scroll", function () {
        scrollY = window.scrollY || 0;
      }, { passive: true });

      requestAnimationFrame(frame);
    })();
  </script>
</body>
</html>
'@

foreach ($f in $folders) {
  $chapters = Get-ChapterBlock $f.Start $f.End
  $html = $template
  $html = $html.Replace('{{TITLE}}', $f.Title)
  $html = $html.Replace('{{SUB}}', $f.Sub)
  $html = $html.Replace('{{STAT}}', $f.Stat)
  $html = $html.Replace('{{ACCENT}}', $f.Accent)
  $html = $html.Replace('{{CLASS}}', $f.Class)
  $html = $html.Replace('{{CHAPTERS}}', $chapters)
  $outPath = Join-Path $base $f.File
  [System.IO.File]::WriteAllText($outPath, $html, [System.Text.UTF8Encoding]::new($false))
  Write-Output "Wrote $($f.File)"
}

Write-Output "Done."
