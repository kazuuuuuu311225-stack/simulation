const fs = require("fs");
const { JSDOM } = require("jsdom");
const file = process.argv[2] || "restitution_1D_collision.html";
const html = fs.readFileSync(__dirname + "/" + file, "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });
const win = dom.window;
win.requestAnimationFrame = () => 1;
win.ResizeObserver = class { observe() {} disconnect() {} };
win.addEventListener("error", (e) => {
  console.error("ERROR:", e.error?.stack || e.message);
  process.exitCode = 1;
});
setTimeout(() => {
  const c = win.document.getElementById("canvas");
  console.log(file, "canvas:", c?.width, c?.height, "status:", win.document.getElementById("statusPanel")?.textContent?.slice(0, 40));
}, 50);
