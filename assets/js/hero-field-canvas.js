/**

 * Hero 背景 — 電場ベクトル Canvas + キャッチコピーのスクロール演出

 */

(function () {

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;



  function splitTagline(tagline) {

    if (tagline.dataset.split === "true") return;

    const text = tagline.textContent.trim();

    tagline.textContent = "";

    tagline.setAttribute("aria-label", text);

    [...text].forEach((ch, i) => {

      const span = document.createElement("span");

      span.className = "hero-char";

      span.setAttribute("aria-hidden", "true");

      span.style.setProperty("--i", String(i));

      span.textContent = ch;

      tagline.appendChild(span);

    });

    tagline.dataset.split = "true";

  }



  function fieldAt(nx, ny, t) {

    const cx1 = 0.32 + Math.sin(t * 0.14) * 0.07;

    const cy1 = 0.48 + Math.cos(t * 0.11) * 0.09;

    const cx2 = 0.68 + Math.cos(t * 0.12) * 0.07;

    const cy2 = 0.52 + Math.sin(t * 0.1) * 0.09;

    let ex = 0;

    let ey = 0;

    [[cx1, cy1, 1], [cx2, cy2, -1]].forEach(([cx, cy, q]) => {

      const dx = nx - cx;

      const dy = ny - cy;

      const r2 = dx * dx + dy * dy + 0.018;

      const r = Math.sqrt(r2);

      const f = q / r2;

      ex += (f * dx) / r;

      ey += (f * dy) / r;

    });

    ex += Math.sin(ny * 9 + t * 0.45) * 0.06;

    ey += Math.cos(nx * 9 - t * 0.38) * 0.06;

    const mag = Math.hypot(ex, ey) || 1;

    return { ex: ex / mag, ey: ey / mag, mag: Math.min(mag, 2.2) };

  }



  function drawArrow(ctx, x, y, angle, len, alpha) {

    const ex = x + Math.cos(angle) * len;

    const ey = y + Math.sin(angle) * len;

    ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;

    ctx.lineWidth = 1.1;

    ctx.beginPath();

    ctx.moveTo(x, y);

    ctx.lineTo(ex, ey);

    ctx.stroke();

    const head = Math.min(4.5, len * 0.35);

    const a1 = angle + 2.5;

    const a2 = angle - 2.5;

    ctx.fillStyle = `rgba(167, 139, 250, ${alpha * 0.85})`;

    ctx.beginPath();

    ctx.moveTo(ex, ey);

    ctx.lineTo(ex - head * Math.cos(a1), ey - head * Math.sin(a1));

    ctx.lineTo(ex - head * Math.cos(a2), ey - head * Math.sin(a2));

    ctx.closePath();

    ctx.fill();

  }



  function initFieldCanvas(canvas) {

    const ctx = canvas.getContext("2d");

    if (!ctx) return;



    let w = 0;

    let h = 0;

    let dpr = 1;

    let t = 0;

    let raf = 0;



    function resize() {

      const rect = canvas.getBoundingClientRect();

      dpr = Math.min(window.devicePixelRatio || 1, 2);

      w = Math.max(1, Math.round(rect.width));

      h = Math.max(1, Math.round(rect.height));

      canvas.width = Math.round(w * dpr);

      canvas.height = Math.round(h * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    }



    function draw() {

      ctx.clearRect(0, 0, w, h);



      const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.65);

      grad.addColorStop(0, "rgba(56, 189, 248, 0.07)");

      grad.addColorStop(0.55, "rgba(12, 16, 24, 0)");

      grad.addColorStop(1, "rgba(167, 139, 250, 0.04)");

      ctx.fillStyle = grad;

      ctx.fillRect(0, 0, w, h);



      const spacing = Math.max(28, Math.min(42, w / 14));

      const cols = Math.ceil(w / spacing) + 1;

      const rows = Math.ceil(h / spacing) + 1;



      for (let row = 0; row < rows; row++) {

        for (let col = 0; col < cols; col++) {

          const px = col * spacing + (row % 2) * spacing * 0.5;

          const py = row * spacing;

          const nx = px / w;

          const ny = py / h;

          const { ex, ey, mag } = fieldAt(nx, ny, t);

          const angle = Math.atan2(ey, ex);

          const edge = Math.min(nx, 1 - nx, ny, 1 - ny);

          const centerBoost = 1 - Math.hypot(nx - 0.5, ny - 0.48) * 1.35;

          const alpha = Math.max(0.04, Math.min(0.38, mag * 0.14 * edge * (0.55 + centerBoost * 0.45)));

          const len = spacing * 0.34 * (0.7 + mag * 0.2);

          drawArrow(ctx, px, py, angle, len, alpha);

        }

      }



      if (!REDUCED) {

        ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";

        ctx.lineWidth = 1;

        for (let i = 0; i < 5; i++) {

          const phase = t * 0.25 + i * 0.9;

          ctx.beginPath();

          for (let x = 0; x <= w; x += 6) {

            const nx = x / w;

            const y = h * 0.5 + Math.sin(nx * 7 + phase) * h * 0.12 + Math.sin(nx * 13 - phase * 0.7) * h * 0.04;

            if (x === 0) ctx.moveTo(x, y);

            else ctx.lineTo(x, y);

          }

          ctx.stroke();

        }

      }

    }



    function loop(now) {

      if (!REDUCED) t = now * 0.001;

      draw();

      raf = requestAnimationFrame(loop);

    }



    resize();

    const ro = typeof ResizeObserver !== "undefined"

      ? new ResizeObserver(resize)

      : null;

    if (ro) ro.observe(canvas);

    else window.addEventListener("resize", resize);



    if (REDUCED) draw();

    else raf = requestAnimationFrame(loop);



    return () => {

      cancelAnimationFrame(raf);

      if (ro) ro.disconnect();

      else window.removeEventListener("resize", resize);

    };

  }



  function initScrollEffect(hero, tagline) {

    let ticking = false;



    function update() {

      ticking = false;

      const rect = hero.getBoundingClientRect();

      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));

      const opacity = 1 - progress * 0.42;

      const glow = 1 - progress * 0.75;

      const blur = progress * 2.2;

      tagline.style.setProperty("--scroll-opacity", opacity.toFixed(3));

      tagline.style.setProperty("--scroll-glow", glow.toFixed(3));

      tagline.style.setProperty("--scroll-blur", blur.toFixed(2) + "px");

      hero.style.setProperty("--hero-fade", (1 - progress * 0.35).toFixed(3));

    }



    function onScroll() {

      if (!ticking) {

        ticking = true;

        requestAnimationFrame(update);

      }

    }



    update();

    window.addEventListener("scroll", onScroll, { passive: true });

    window.addEventListener("resize", onScroll, { passive: true });

  }



  function boot() {

    const canvas = document.getElementById("heroCanvas");

    const hero = document.getElementById("hero");

    const tagline = document.getElementById("heroTagline");

    if (!canvas || !hero || !tagline) return;

    splitTagline(tagline);

    initFieldCanvas(canvas);

    initScrollEffect(hero, tagline);

  }



  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", boot);

  } else {

    boot();

  }

})();


