const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const files = [
  "momentum_bat_ball.html",
  "billiard_momentum.html",
  "momentum_2balls_xy.html",
  "momentum_split_merge.html",
  "restitution_ground.html",
  "restitution_1D_collision.html",
];

const dir = __dirname;
let pending = files.length;
let failed = false;

function mockLayout(window) {
  const wrap = window.document.getElementById("canvasWrap");
  if (!wrap) return;
  wrap.getBoundingClientRect = () => ({
    width: 800,
    height: 400,
    top: 0,
    left: 0,
    right: 800,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON() {
      return {};
    },
  });
}

for (const file of files) {
  const html = fs.readFileSync(path.join(dir, file), "utf8");
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  const errors = [];

  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.requestAnimationFrame = (cb) => {
        setTimeout(() => {
          try {
            cb(performance.now() + 16);
          } catch (e) {
            errors.push(String(e.message || e));
          }
        }, 0);
        return 1;
      };
      window.cancelAnimationFrame = () => {};
      window.ResizeObserver = class {
        observe() {}
        disconnect() {}
      };
      window.devicePixelRatio = 1;
      window.visualViewport = { addEventListener() {} };
      window.onerror = (_m, _s, _l, _c, e) => {
        errors.push(String(e?.message || _m));
      };
    },
  });

  const { window } = dom;
  mockLayout(window);

  try {
    window.eval(scriptMatch[1]);
  } catch (e) {
    console.log(`${file}: INIT ERROR ${e.message}`);
    failed = true;
    pending -= 1;
    continue;
  }

  setTimeout(() => {
    try {
      const start =
        window.document.getElementById("startBtn") ||
        window.document.getElementById("shotBtn");
      if (start) start.click();
    } catch (e) {
      errors.push(`click: ${e.message}`);
    }

    setTimeout(() => {
      const canvas = window.document.getElementById("canvas");
      if (errors.length) {
        console.log(`${file}: FAIL ${errors[0]}`);
        failed = true;
      } else if (!canvas || canvas.width < 100 || canvas.height < 100) {
        console.log(`${file}: FAIL canvas ${canvas?.width}x${canvas?.height}`);
        failed = true;
      } else {
        console.log(`${file}: OK canvas ${canvas.width}x${canvas.height}`);
      }
      pending -= 1;
      if (pending === 0) process.exit(failed ? 1 : 0);
    }, 80);
  }, 20);
}

setTimeout(() => {
  if (pending > 0) {
    console.log("timeout waiting for tests");
    process.exit(1);
  }
}, 3000);
