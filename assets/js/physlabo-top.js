/**
 * physLabo トップページ — 背景物理エフェクト + CHAPTER カード + 補助 Canvas
 */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fitCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width || canvas.clientWidth || 800);
    const h = Math.max(1, rect.height || canvas.clientHeight || 200);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  }

  function waveGradient(ctx, w, a1, a2) {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, `rgba(37, 99, 235, ${a1})`);
    g.addColorStop(0.55, `rgba(124, 58, 237, ${(a1 + a2) / 2})`);
    g.addColorStop(1, `rgba(217, 70, 239, ${a2})`);
    return g;
  }

  function drawArrow(ctx, x, y, angle, len, stroke, fill, lw) {
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw || 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const head = Math.min(5, len * 0.35);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - head * Math.cos(angle + 2.4), ey - head * Math.sin(angle + 2.4));
    ctx.lineTo(ex - head * Math.cos(angle - 2.4), ey - head * Math.sin(angle - 2.4));
    ctx.closePath();
    ctx.fill();
  }

  // ── 背景：電場ベクトル + 干渉縞 + 分子粒子 ──
  function initBackground() {
    const canvas = document.getElementById("bgCanvas");
    if (!canvas) return;

    let scrollY = 0;
    let t = 0;
    const molecules = [];
    for (let i = 0; i < 48; i++) {
      molecules.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0004,
        vy: (Math.random() - 0.5) * 0.0004,
        r: 1.2 + Math.random() * 2.2,
        hue: Math.random() < 0.5 ? "167,139,250" : "56,189,248",
      });
    }

    const sparks = [];
    for (let s = 0; s < 20; s++) {
      sparks.push({
        x: Math.random(), y: Math.random(),
        r: 3 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 0.7,
      });
    }

    function fieldAt(nx, ny, time) {
      let ex = 0, ey = 0;
      const cx1 = 0.25 + Math.sin(time * 0.08) * 0.06;
      const cy1 = 0.4;
      const cx2 = 0.75 + Math.cos(time * 0.07) * 0.06;
      const cy2 = 0.6;
      [[cx1, cy1, 1], [cx2, cy2, -1]].forEach(([cx, cy, q]) => {
        const dx = nx - cx, dy = ny - cy;
        const r2 = dx * dx + dy * dy + 0.02;
        const r = Math.sqrt(r2);
        const f = q / r2;
        ex += (f * dx) / r;
        ey += (f * dy) / r;
      });
      ex += Math.sin(ny * 6 + time * 0.3) * 0.05;
      ey += Math.cos(nx * 6 - time * 0.25) * 0.05;
      const mag = Math.hypot(ex, ey) || 1;
      return { ex: ex / mag, ey: ey / mag };
    }

    function draw() {
      const { ctx, w, h } = fitCanvas(canvas);
      ctx.clearRect(0, 0, w, h);
      const parallax = scrollY * 0.15;
      if (!REDUCED) t += 0.016;

      // 干渉パターン（2つの波の重ね合わせ）
      const gridStep = 8;
      for (let x = 0; x < w; x += gridStep) {
        for (let y = 0; y < h; y += gridStep) {
          const nx = x / w, ny = y / h;
          const w1 = Math.sin(nx * 28 + t * 0.4 + ny * 4);
          const w2 = Math.sin(nx * 22 - t * 0.35 + ny * 6);
          const sum = (w1 + w2) * 0.5;
          const alpha = 0.02 + Math.abs(sum) * 0.06;
          if (alpha > 0.03) {
            ctx.fillStyle = `rgba(129, 140, 248, ${alpha})`;
            ctx.fillRect(x, y, gridStep - 1, gridStep - 1);
          }
        }
      }

      // ゆっくり流れる電場ベクトル（疎なグリッド）
      const spacing = 72;
      for (let row = 0; row < Math.ceil(h / spacing) + 1; row++) {
        for (let col = 0; col < Math.ceil(w / spacing) + 1; col++) {
          const px = col * spacing + (row % 2) * spacing * 0.5;
          const py = row * spacing + parallax * 0.03;
          const { ex, ey } = fieldAt(px / w, py / h, t);
          const angle = Math.atan2(ey, ex);
          const edge = Math.min(px / w, 1 - px / w, py / h, 1 - py / h);
          const alpha = 0.06 + edge * 0.1;
          drawArrow(ctx, px, py, angle, 14, `rgba(96, 165, 250, ${alpha})`, `rgba(167, 139, 250, ${alpha * 0.7})`, 0.9);
        }
      }

      // 分子運動粒子
      molecules.forEach((m) => {
        if (!REDUCED) {
          m.x += m.vx;
          m.y += m.vy;
          if (m.x < 0 || m.x > 1) m.vx *= -1;
          if (m.y < 0 || m.y > 1) m.vy *= -1;
          m.x = Math.max(0, Math.min(1, m.x));
          m.y = Math.max(0, Math.min(1, m.y));
        }
        const mx = m.x * w;
        const my = m.y * h + parallax * 0.04;
        ctx.fillStyle = `rgba(${m.hue}, 0.35)`;
        ctx.beginPath();
        ctx.arc(mx, my, m.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // 光点
      const sec = performance.now() / 1000;
      sparks.forEach((sp) => {
        const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(sec * sp.speed + sp.phase));
        const sx = sp.x * w;
        const sy = sp.y * h + parallax * 0.05;
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, sp.r * 2.8);
        grd.addColorStop(0, `rgba(255,255,255,${pulse * 0.9})`);
        grd.addColorStop(0.35, `rgba(167,139,250,${pulse * 0.45})`);
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(sx, sy, sp.r * 2.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function loop() {
      draw();
      requestAnimationFrame(loop);
    }

    window.addEventListener("scroll", () => { scrollY = window.scrollY || 0; }, { passive: true });
    window.addEventListener("resize", draw);
    if (REDUCED) draw();
    else requestAnimationFrame(loop);
  }

  // ── CHAPTER カード物理ホバー ──
  function initCardEffects() {
    document.querySelectorAll(".chapter-card[data-physics]").forEach((card) => {
      const fx = document.createElement("canvas");
      fx.className = "card-fx";
      fx.setAttribute("aria-hidden", "true");
      card.insertBefore(fx, card.firstChild);

      const type = card.dataset.physics;
      let hover = false;
      let t = 0;
      let raf = 0;
      let running = false;

      card.addEventListener("mouseenter", () => { hover = true; start(); });
      card.addEventListener("mouseleave", () => { hover = false; });
      card.addEventListener("focus", () => { hover = true; start(); }, true);
      card.addEventListener("blur", () => { hover = false; }, true);

      function start() {
        if (running || REDUCED) return;
        running = true;
        function frame() {
          if (!hover && t < 0.01) { running = false; raf = 0; draw(0); return; }
          t += hover ? 0.04 : -0.02;
          if (t < 0) t = 0;
          draw(Math.min(1, t));
          raf = requestAnimationFrame(frame);
        }
        if (!raf) frame();
      }

      function draw(intensity) {
        const { ctx, w, h } = fitCanvas(fx);
        ctx.clearRect(0, 0, w, h);
        if (intensity <= 0) return;

        if (type === "classical") drawClassical(ctx, w, h, intensity);
        else if (type === "thermo") drawThermo(ctx, w, h, intensity);
        else if (type === "waves") drawWaves(ctx, w, h, intensity);
        else if (type === "em") drawEM(ctx, w, h, intensity);
        else if (type === "atom") drawAtom(ctx, w, h, intensity);
        else drawEX(ctx, w, h, intensity);
      }

      function drawClassical(ctx, w, h, inten) {
        const y = h * 0.72;
        const accel = inten * inten;
        const x = w * 0.12 + w * 0.55 * accel;
        for (let i = 0; i < 5; i++) {
          const tx = x - i * (18 + accel * 12);
          if (tx < 0) continue;
          ctx.fillStyle = `rgba(37, 99, 235, ${0.15 + inten * 0.25 - i * 0.04})`;
          ctx.beginPath();
          ctx.arc(tx, y, 4 - i * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(37, 99, 235, ${0.5 + inten * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(217, 70, 239, ${0.3 * inten})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(w * 0.1, y);
        ctx.lineTo(x - 6, y);
        ctx.stroke();
      }

      function drawThermo(ctx, w, h, inten) {
        const n = 14;
        const speed = 1 + inten * 3.5;
        const seed = card.dataset.physics.length;
        for (let i = 0; i < n; i++) {
          const phase = t * speed + i * 1.7 + seed;
          const px = (0.15 + (i % 5) * 0.17 + Math.sin(phase) * 0.06 * inten) * w;
          const py = (0.25 + Math.floor(i / 5) * 0.22 + Math.cos(phase * 1.3) * 0.05 * inten) * h;
          ctx.fillStyle = `rgba(251, 191, 36, ${0.25 + inten * 0.45})`;
          ctx.beginPath();
          ctx.arc(px, py, 2 + inten, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function drawWaves(ctx, w, h, inten) {
        const midY = h * 0.5;
        for (let layer = 0; layer < 3; layer++) {
          ctx.beginPath();
          const amp = (8 + layer * 4) * inten;
          const freq = 0.035 + layer * 0.008;
          for (let x = 0; x <= w; x += 3) {
            const y = midY + layer * 12 + amp * Math.sin(x * freq + t * 2 + layer);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.15 + inten * 0.35})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      function drawEM(ctx, w, h, inten) {
        const cx = w * 0.5, cy = h * 0.45;
        const lines = 6;
        for (let i = 0; i < lines; i++) {
          const base = (i / lines) * Math.PI * 2 + t * 0.3;
          ctx.beginPath();
          for (let s = 0; s <= 1; s += 0.04) {
            const r = 8 + s * (40 + inten * 30);
            const ang = base + s * 1.8;
            const px = cx + Math.cos(ang) * r;
            const py = cy + Math.sin(ang) * r * 0.55;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = `rgba(129, 140, 248, ${0.08 + inten * 0.28})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(248, 113, 113, ${0.3 * inten})`;
        ctx.beginPath();
        ctx.arc(cx - 16, cy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(56, 189, 248, ${0.3 * inten})`;
        ctx.beginPath();
        ctx.arc(cx + 16, cy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      function drawAtom(ctx, w, h, inten) {
        const cx = w * 0.5, cy = h * 0.48;
        const orbits = [
          { rx: 34, ry: 12, tilt: 0.35, speed: 1.1 },
          { rx: 24, ry: 8, tilt: -0.6, speed: 1.8 },
        ];
        orbits.forEach((orb, i) => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(orb.tilt);
          ctx.beginPath();
          ctx.ellipse(0, 0, orb.rx * inten + 6, orb.ry * inten + 4, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(244, 114, 182, ${0.12 + inten * 0.3})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          const ang = t * orb.speed + i * 1.4;
          ctx.fillStyle = `rgba(232, 121, 249, ${0.4 + inten * 0.45})`;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * (orb.rx * inten + 6), Math.sin(ang) * (orb.ry * inten + 4), 2.5 + inten, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
        ctx.fillStyle = `rgba(244, 114, 182, ${0.55 * inten})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 5 + inten * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      function drawEX(ctx, w, h, inten) {
        for (let i = 0; i < 8; i++) {
          const px = w * (0.2 + (i % 4) * 0.18);
          const py = h * (0.3 + Math.floor(i / 4) * 0.35);
          const pulse = 0.5 + 0.5 * Math.sin(t * 2 + i);
          ctx.fillStyle = `rgba(6, 182, 212, ${(0.2 + pulse * 0.3) * inten})`;
          ctx.fillRect(px - 2, py - 2, 4, 4);
          ctx.strokeStyle = `rgba(217, 70, 239, ${0.25 * inten})`;
          ctx.strokeRect(px - 6, py - 6, 12, 12);
        }
      }
    });
  }

  // ── キャッチ下波形・区切り・フッター ──
  function initAuxCanvas() {
    const catchCanvas = document.getElementById("catchWaveCanvas");
    if (catchCanvas) {
      function drawCatch() {
        const { ctx, w, h } = fitCanvas(catchCanvas);
        ctx.clearRect(0, 0, w, h);
        const midY = h / 2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const y = midY + 10 * Math.sin(x * 0.04 + 0.5) * Math.sin(x * 0.015);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = waveGradient(ctx, w, 0.85, 0.75);
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.shadowColor = "#d946ef";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(w * 0.88, midY - 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      drawCatch();
      window.addEventListener("resize", drawCatch);
    }

    function drawDivider(canvas) {
      const { ctx, w, h } = fitCanvas(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = h / 2 + (h * 0.35) * Math.sin(x * 0.025) * Math.cos(x * 0.008);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = waveGradient(ctx, w, 0.4, 0.35);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    document.querySelectorAll(".divider-canvas").forEach((c) => {
      drawDivider(c);
    });

    const footerCanvas = document.getElementById("footerCanvas");
    let footerPhase = 0;
    if (footerCanvas) {
      function drawFooter() {
        const { ctx, w, h } = fitCanvas(footerCanvas);
        ctx.clearRect(0, 0, w, h);
        footerPhase += 0.25;
        for (let layer = 0; layer < 2; layer++) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 3) {
            const y = h * (0.45 + layer * 0.15) + 12 * Math.sin(x * 0.03 + footerPhase * 0.03 + layer * 2);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = waveGradient(ctx, w, 0.22 - layer * 0.04, 0.18);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      function footerLoop() {
        drawFooter();
        requestAnimationFrame(footerLoop);
      }
      requestAnimationFrame(footerLoop);
    }

    window.addEventListener("resize", () => {
      document.querySelectorAll(".divider-canvas").forEach(drawDivider);
    });
  }

  function initSimTotalCount() {
    const el = document.getElementById("simTotalNum");
    if (!el) return;
    const fallback = 200;
    fetch("index-full.html", { cache: "no-store" })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("fetch failed"))))
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const count = doc.querySelectorAll('a.menu-link[href]').length;
        el.textContent = count > 0 ? String(count) : String(fallback);
      })
      .catch(() => {
        el.textContent = String(fallback);
      });
  }

  function boot() {
    initBackground();
    initCardEffects();
    initAuxCanvas();
    initSimTotalCount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
