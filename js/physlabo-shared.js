/**
 * physLabo 共通ユーティリティ + ノード Canvas ミニアニメーション
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

  function drawClassical(ctx, w, h, inten, t) {
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

  function drawThermo(ctx, w, h, inten, t, seed) {
    const n = 14;
    const speed = 1 + inten * 3.5;
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

  function drawWaves(ctx, w, h, inten, t) {
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

  function drawEM(ctx, w, h, inten, t) {
    const cx = w * 0.5;
    const cy = h * 0.45;
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

  function drawAtom(ctx, w, h, inten, t) {
    const cx = w * 0.5;
    const cy = h * 0.48;
    const orbits = [
      { rx: 34, ry: 12, tilt: 0.35, speed: 1.1, color: "244, 114, 182" },
      { rx: 28, ry: 10, tilt: -0.55, speed: 1.6, color: "232, 121, 249" },
      { rx: 20, ry: 7, tilt: 1.1, speed: 2.2, color: "192, 132, 252" },
    ];
    orbits.forEach((orb, i) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(orb.tilt);
      ctx.beginPath();
      ctx.ellipse(0, 0, orb.rx * inten + 6, orb.ry * inten + 4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${orb.color}, ${0.12 + inten * 0.28})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const ang = t * orb.speed + i * 1.4;
      const ex = Math.cos(ang) * (orb.rx * inten + 6);
      const ey = Math.sin(ang) * (orb.ry * inten + 4);
      ctx.fillStyle = `rgba(${orb.color}, ${0.45 + inten * 0.45})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 2.5 + inten, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    const pulse = 0.7 + 0.3 * Math.sin(t * 2.2);
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10 + inten * 8);
    grd.addColorStop(0, `rgba(253, 164, 175, ${0.75 * inten * pulse})`);
    grd.addColorStop(0.5, `rgba(244, 114, 182, ${0.45 * inten})`);
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, 10 + inten * 8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEX(ctx, w, h, inten, t) {
    const spots = [
      [0.28, 0.42],
      [0.52, 0.35],
      [0.72, 0.48],
      [0.38, 0.62],
      [0.62, 0.68],
    ];
    spots.forEach(([nx, ny], i) => {
      const px = nx * w;
      const py = ny * h;
      const pulse = 0.45 + 0.55 * Math.sin(t * 1.4 + i * 1.1);
      const r = (10 + pulse * 18) * inten;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, r);
      grd.addColorStop(0, `rgba(190, 242, 100, ${0.55 * inten * pulse})`);
      grd.addColorStop(0.35, `rgba(6, 182, 212, ${0.3 * inten})`);
      grd.addColorStop(0.7, `rgba(217, 70, 239, ${0.12 * inten})`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function initNodeFx(root, selector) {
    root.querySelectorAll(selector).forEach((el) => {
      let fx = el.querySelector(".node-fx");
      if (!fx) {
        fx = document.createElement("canvas");
        fx.className = "node-fx";
        fx.setAttribute("aria-hidden", "true");
        el.insertBefore(fx, el.firstChild);
      }

      const type = el.dataset.physics;
      const seed = (type || "").length;
      let hover = false;
      let t = 0;
      let raf = 0;
      let running = false;

      function start() {
        if (running || REDUCED) return;
        running = true;
        function frame() {
          if (!hover && t < 0.01) {
            running = false;
            raf = 0;
            draw(0);
            return;
          }
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
        if (type === "classical") drawClassical(ctx, w, h, intensity, t);
        else if (type === "thermo") drawThermo(ctx, w, h, intensity, t, seed);
        else if (type === "waves") drawWaves(ctx, w, h, intensity, t);
        else if (type === "em") drawEM(ctx, w, h, intensity, t);
        else if (type === "atom") drawAtom(ctx, w, h, intensity, t);
        else drawEX(ctx, w, h, intensity, t);
      }

      el.addEventListener("mouseenter", () => { hover = true; start(); });
      el.addEventListener("mouseleave", () => { hover = false; });
      el.addEventListener("focus", () => { hover = true; start(); }, true);
      el.addEventListener("blur", () => { hover = false; }, true);
    });
  }

  window.PhysLaboShared = {
    REDUCED,
    fitCanvas,
    drawArrow,
    initNodeFx,
  };
})();
