/**
 * physLabo 共通背景 — グラデーション上の粒子・電場・干渉パターン
 */
(function () {
  "use strict";

  const { REDUCED, fitCanvas, drawArrow } = window.PhysLaboShared || {};

  function initBackground(canvasId) {
    const canvas = document.getElementById(canvasId || "bgCanvas");
    if (!canvas || !fitCanvas) return;

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
        x: Math.random(),
        y: Math.random(),
        r: 3 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 0.7,
      });
    }

    function fieldAt(nx, ny, time) {
      let ex = 0;
      let ey = 0;
      const cx1 = 0.25 + Math.sin(time * 0.08) * 0.06;
      const cy1 = 0.4;
      const cx2 = 0.75 + Math.cos(time * 0.07) * 0.06;
      const cy2 = 0.6;
      [[cx1, cy1, 1], [cx2, cy2, -1]].forEach(([cx, cy, q]) => {
        const dx = nx - cx;
        const dy = ny - cy;
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

      const gridStep = 8;
      for (let x = 0; x < w; x += gridStep) {
        for (let y = 0; y < h; y += gridStep) {
          const nx = x / w;
          const ny = y / h;
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

  window.PhysLaboBg = { init: initBackground };
})();
