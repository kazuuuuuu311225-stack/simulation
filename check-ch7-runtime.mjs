import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";

const files = [
  "billiard_momentum.html",
  "momentum_bat_ball.html",
  "momentum_2balls_xy.html",
  "momentum_split_merge.html",
  "restitution_ground.html",
  "restitution_1D_collision.html",
];

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));

for (const file of files) {
  const html = fs.readFileSync(path.join(dir, file), "utf8");
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.requestAnimationFrame = (cb) => {
    setTimeout(() => cb(performance.now()), 0);
    return 1;
  };
  Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { configurable: true, get() { return 800; } });
  Object.defineProperty(window.HTMLElement.prototype, "clientHeight", { configurable: true, get() { return 400; } });
  window.ResizeObserver = class { observe() {} disconnect() {} };
  window.devicePixelRatio = 1;

  let err = null;
  window.addEventListener("error", (e) => { err = e.error || e.message; });
  await new Promise((r) => setTimeout(r, 50));
  if (err) {
    console.log(`${file}: ERROR ${err}`);
    continue;
  }
  const canvas = window.document.getElementById("canvas");
  const ok = canvas && canvas.width > 0 && canvas.height > 0;
  console.log(`${file}: ${ok ? "OK" : "FAIL"} ${canvas?.width}x${canvas?.height}`);
}
