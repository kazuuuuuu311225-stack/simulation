(function () {
  "use strict";

  const canvas = document.getElementById("simCanvas");
  const ctx = canvas.getContext("2d");
  const tempSlider = document.getElementById("tempSlider");
  const tempValue = document.getElementById("tempValue");
  const resetBtn = document.getElementById("resetBtn");

  const SMALL_COUNT = 100;
  const T_REF = 300;
  const SPEED_FACTOR = 0.045;
  const LARGE_RADIUS = 18;
  const SMALL_RADIUS = 3;
  const KICK_SCALE = 0.018;
  const LARGE_DAMPING = 0.992;

  let width = 0;
  let height = 0;
  let temperature = Number(tempSlider.value);
  let smallParticles = [];
  let largeParticle = null;
  let animationId = null;

  function speedAtTemperature(T) {
    return SPEED_FACTOR * T;
  }

  function randomAngle() {
    return Math.random() * Math.PI * 2;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  class SmallParticle {
    constructor(x, y, T) {
      this.x = x;
      this.y = y;
      this.radius = SMALL_RADIUS;
      const angle = randomAngle();
      const speed = speedAtTemperature(T);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }

    setTemperature(T) {
      const speed = speedAtTemperature(T);
      const angle = Math.atan2(this.vy, this.vx);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.bounceWalls();
    }

    bounceWalls() {
      if (this.x - this.radius < 0) {
        this.x = this.radius;
        this.vx = Math.abs(this.vx);
      } else if (this.x + this.radius > width) {
        this.x = width - this.radius;
        this.vx = -Math.abs(this.vx);
      }

      if (this.y - this.radius < 0) {
        this.y = this.radius;
        this.vy = Math.abs(this.vy);
      } else if (this.y + this.radius > height) {
        this.y = height - this.radius;
        this.vy = -Math.abs(this.vy);
      }
    }

    draw(context) {
      context.beginPath();
      context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      context.fillStyle = "rgba(56, 189, 248, 0.85)";
      context.fill();
      context.strokeStyle = "rgba(255, 255, 255, 0.7)";
      context.lineWidth = 1;
      context.stroke();
    }
  }

  class LargeParticle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = LARGE_RADIUS;
      this.vx = 0;
      this.vy = 0;
    }

    applyKick(magnitude) {
      const angle = randomAngle();
      this.vx += Math.cos(angle) * magnitude;
      this.vy += Math.sin(angle) * magnitude;
    }

    interactWith(small, T) {
      const dx = small.x - this.x;
      const dy = small.y - this.y;
      const dist = Math.hypot(dx, dy);
      const touchDist = this.radius + small.radius;

      if (dist >= touchDist || dist === 0) {
        return;
      }

      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = touchDist - dist;

      small.x += nx * overlap * 0.6;
      small.y += ny * overlap * 0.6;
      this.x -= nx * overlap * 0.4;
      this.y -= ny * overlap * 0.4;

      const relVn = (small.vx - this.vx) * nx + (small.vy - this.vy) * ny;
      if (relVn < 0) {
        const impulse = -2 * relVn / (1 / small.radius + 1 / this.radius);
        const ix = impulse * nx;
        const iy = impulse * ny;

        small.vx += ix / small.radius;
        small.vy += iy / small.radius;
        this.vx -= ix / this.radius;
        this.vy -= iy / this.radius;
      }

      const kick = KICK_SCALE * T * (0.6 + Math.random() * 0.8);
      this.applyKick(kick);
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= LARGE_DAMPING;
      this.vy *= LARGE_DAMPING;
      this.bounceWalls();
    }

    bounceWalls() {
      if (this.x - this.radius < 0) {
        this.x = this.radius;
        this.vx = Math.abs(this.vx) * 0.85;
      } else if (this.x + this.radius > width) {
        this.x = width - this.radius;
        this.vx = -Math.abs(this.vx) * 0.85;
      }

      if (this.y - this.radius < 0) {
        this.y = this.radius;
        this.vy = Math.abs(this.vy) * 0.85;
      } else if (this.y + this.radius > height) {
        this.y = height - this.radius;
        this.vy = -Math.abs(this.vy) * 0.85;
      }
    }

    draw(context) {
      const gradient = context.createRadialGradient(
        this.x - this.radius * 0.3,
        this.y - this.radius * 0.3,
        this.radius * 0.1,
        this.x,
        this.y,
        this.radius
      );
      gradient.addColorStop(0, "rgba(186, 230, 253, 0.95)");
      gradient.addColorStop(0.55, "rgba(14, 165, 233, 0.92)");
      gradient.addColorStop(1, "rgba(2, 132, 199, 0.95)");

      context.beginPath();
      context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.fill();
      context.strokeStyle = "rgba(255, 255, 255, 0.85)";
      context.lineWidth = 2;
      context.stroke();

      context.beginPath();
      context.arc(
        this.x - this.radius * 0.28,
        this.y - this.radius * 0.28,
        this.radius * 0.22,
        0,
        Math.PI * 2
      );
      context.fillStyle = "rgba(255, 255, 255, 0.45)";
      context.fill();
    }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    width = Math.max(200, Math.floor(rect.width));
    height = Math.max(200, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createSmallParticle() {
    const margin = SMALL_RADIUS + 2;
    const x = margin + Math.random() * (width - margin * 2);
    const y = margin + Math.random() * (height - margin * 2);
    return new SmallParticle(x, y, temperature);
  }

  function initSimulation() {
    smallParticles = [];
    for (let i = 0; i < SMALL_COUNT; i += 1) {
      smallParticles.push(createSmallParticle());
    }

    largeParticle = new LargeParticle(width * 0.5, height * 0.5);
  }

  function drawBackground() {
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(186, 230, 253, 0.35)";
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = gridStep; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = gridStep; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function updateSimulation() {
    for (let i = 0; i < smallParticles.length; i += 1) {
      const particle = smallParticles[i];
      particle.update();
      largeParticle.interactWith(particle, temperature);
    }
    largeParticle.update();
  }

  function drawSimulation() {
    drawBackground();

    for (let i = 0; i < smallParticles.length; i += 1) {
      smallParticles[i].draw(ctx);
    }
    largeParticle.draw(ctx);
  }

  function tick() {
    updateSimulation();
    drawSimulation();
    animationId = requestAnimationFrame(tick);
  }

  function setTemperature(T) {
    temperature = clamp(T, Number(tempSlider.min), Number(tempSlider.max));
    tempSlider.value = String(temperature);
    tempValue.textContent = String(temperature);

    for (let i = 0; i < smallParticles.length; i += 1) {
      smallParticles[i].setTemperature(temperature);
    }
  }

  function resetSimulation() {
    initSimulation();
    drawSimulation();
  }

  tempSlider.addEventListener("input", function () {
    setTemperature(Number(tempSlider.value));
  });

  resetBtn.addEventListener("click", resetSimulation);

  window.addEventListener("resize", function () {
    resizeCanvas();
    resetSimulation();
  });

  resizeCanvas();
  setTemperature(temperature);
  initSimulation();
  drawSimulation();
  animationId = requestAnimationFrame(tick);
})();
