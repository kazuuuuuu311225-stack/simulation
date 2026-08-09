/**
 * Hero 背景 — 粒子ネットワーク + 光の波 + 波紋（Canvas 2D / 軽量）
 */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const COLORS = [
    { r: 255, g: 255, b: 255 },
    { r: 96, g: 165, b: 250 },
    { r: 34, g: 211, b: 238 },
  ];

  function initHeroCanvas(canvas, hero) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let t = 0;
    let mouseX = -9999;
    let mouseY = -9999;
    let mouseActive = false;
    let lightWaveProgress = -1;
    let waveStartTime = 0;
    let nextWaveAt = 3.5;

    const ripples = [
      { x: 0.3, y: 0.4, r: 0, speed: 0.00035, max: 0.55 },
      { x: 0.7, y: 0.6, r: 0, speed: 0.00028, max: 0.5 },
      { x: 0.5, y: 0.75, r: 0, speed: 0.00022, max: 0.45 },
    ];

    let particles = [];
    let connectDist = 120;
    let particleCount = 70;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const area = w * h;
      particleCount = Math.min(90, Math.max(40, Math.round(area / 14000)));
      connectDist = Math.max(90, Math.min(140, w * 0.12));

      if (particles.length !== particleCount) {
        particles = [];
        for (let i = 0; i < particleCount; i++) {
          particles.push(createParticle(true));
        }
      }
    }

    function createParticle(randomPos) {
      const c = COLORS[Math.floor(Math.random() * COLORS.length)];
      return {
        x: randomPos ? Math.random() * w : w * 0.5,
        y: randomPos ? Math.random() * h : h * 0.5,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.2 + Math.random() * 1.8,
        cr: c.r,
        cg: c.g,
        cb: c.b,
        glow: 0.35 + Math.random() * 0.35,
      };
    }

    function drawBackgroundGradient() {
      const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
      g.addColorStop(0, "#050a14");
      g.addColorStop(0.45, "#0a1628");
      g.addColorStop(0.75, "#0c1220");
      g.addColorStop(1, "#020408");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const rg = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.55);
      rg.addColorStop(0, "rgba(30, 58, 138, 0.12)");
      rg.addColorStop(0.5, "rgba(12, 18, 32, 0.04)");
      rg.addColorStop(1, "transparent");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }

    function drawRipples(time) {
      ripples.forEach((rip, i) => {
        if (!REDUCED) {
          rip.r += rip.speed * w;
          if (rip.r > rip.max * Math.max(w, h)) rip.r = 0;
        }
        const cx = rip.x * w;
        const cy = rip.y * h;
        const radius = rip.r + Math.sin(time * 0.4 + i) * 8;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.025 + 0.015 * Math.sin(time * 0.3 + i * 1.2)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    function drawLightWave(progress) {
      const bandW = w * 0.35;
      const x = -bandW + progress * (w + bandW * 2);
      const g = ctx.createLinearGradient(x, 0, x + bandW, 0);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.35, "rgba(255, 255, 255, 0.015)");
      g.addColorStop(0.5, "rgba(56, 189, 248, 0.06)");
      g.addColorStop(0.65, "rgba(34, 211, 238, 0.04)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, bandW, h);
    }

    function drawParticle(p) {
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      grd.addColorStop(0, `rgba(${p.cr}, ${p.cg}, ${p.cb}, ${p.glow})`);
      grd.addColorStop(0.4, `rgba(${p.cr}, ${p.cg}, ${p.cb}, ${p.glow * 0.35})`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${p.cr}, ${p.cg}, ${p.cb}, ${Math.min(1, p.glow + 0.2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    function updateParticles(dt) {
      const mx = mouseActive ? mouseX : -9999;
      const my = mouseActive ? mouseY : -9999;
      const connectDistSq = connectDist * connectDist;
      const mouseRadius = 140;
      const mouseRadiusSq = mouseRadius * mouseRadius;

      particles.forEach((p) => {
        if (!REDUCED) {
          p.x += p.vx * dt * 60;
          p.y += p.vy * dt * 60;

          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          p.x = Math.max(0, Math.min(w, p.x));
          p.y = Math.max(0, Math.min(h, p.y));

          const dx = mx - p.x;
          const dy = my - p.y;
          const distSq = dx * dx + dy * dy;
          if (mouseActive && distSq < mouseRadiusSq && distSq > 1) {
            const dist = Math.sqrt(distSq);
            const force = (1 - dist / mouseRadius) * 0.018;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }

          p.vx *= 0.992;
          p.vy *= 0.992;
        }
      });

      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > connectDistSq) continue;
          const alpha = (1 - Math.sqrt(distSq) / connectDist) * 0.24;
          ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      particles.forEach(drawParticle);
    }

    function draw(now) {
      const dt = REDUCED ? 0 : Math.min(0.05, (now - (draw.last || now)) / 1000);
      draw.last = now;
      if (!REDUCED) t = now * 0.001;

      ctx.clearRect(0, 0, w, h);
      drawBackgroundGradient();
      drawRipples(t);

      if (!REDUCED) {
        if (t >= nextWaveAt && lightWaveProgress < 0) {
          waveStartTime = t;
          lightWaveProgress = 0;
        }
        if (lightWaveProgress >= 0) {
          lightWaveProgress = (t - waveStartTime) / 2.4;
          if (lightWaveProgress <= 1) {
            drawLightWave(lightWaveProgress);
          } else {
            lightWaveProgress = -1;
            nextWaveAt = t + 4 + Math.random() * 2;
          }
        }
      }

      updateParticles(dt);
    }

    function loop(now) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    function onMouseMove(e) {
      const rect = hero.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      mouseActive = true;
    }

    function onMouseLeave() {
      mouseActive = false;
    }

    function onTouchMove(e) {
      if (!e.touches.length) return;
      const rect = hero.getBoundingClientRect();
      mouseX = e.touches[0].clientX - rect.left;
      mouseY = e.touches[0].clientY - rect.top;
      mouseActive = true;
    }

    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas);
    else window.addEventListener("resize", resize);

    hero.addEventListener("mousemove", onMouseMove, { passive: true });
    hero.addEventListener("mouseleave", onMouseLeave);
    hero.addEventListener("touchmove", onTouchMove, { passive: true });
    hero.addEventListener("touchend", onMouseLeave, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!REDUCED && !raf) {
        raf = requestAnimationFrame(loop);
      }
    });

    if (REDUCED) draw(0);
    else raf = requestAnimationFrame(loop);

    function triggerWave() {
      if (REDUCED) return;
      waveStartTime = performance.now() * 0.001;
      lightWaveProgress = 0;
    }

    window.HeroCanvas = { triggerWave };

    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", resize);
      hero.removeEventListener("mousemove", onMouseMove);
      hero.removeEventListener("mouseleave", onMouseLeave);
      hero.removeEventListener("touchmove", onTouchMove);
      hero.removeEventListener("touchend", onMouseLeave);
    };
  }

  function boot() {
    const canvas = document.getElementById("heroCanvas");
    const hero = document.getElementById("hero");
    if (!canvas || !hero) return;
    initHeroCanvas(canvas, hero);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
