const fs = require("fs");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(__dirname + "/restitution_1D_collision.html", "utf8");
const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(win) {
    win.ResizeObserver = undefined;
  },
});
const win = dom.window;
win.addEventListener("error", (e) => errors.push(e.error?.message || e.message));
Object.defineProperty(win.Element.prototype, "getBoundingClientRect", {
  configurable: true,
  value() { return { width: 600, height: 320, top: 0, left: 0, right: 600, bottom: 320, height: 320, width: 600 }; },
});
win.requestAnimationFrame = () => 0;
setTimeout(() => {
  if (errors.length) { console.log("ERRORS", errors); process.exit(1); }
  const canvas = win.document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  console.log("canvas", canvas.width, canvas.height);
  win.document.getElementById("startBtn").click();
  const status = win.document.getElementById("statusPanel").textContent;
  console.log("status after start:", status);
  // invoke loop once via inline eval - can't access closure. Check status only.
  process.exit(status.includes("運動中") ? 0 : 1);
}, 50);
