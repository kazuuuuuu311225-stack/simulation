const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(__dirname + "/momentum_split_merge.html", "utf8");
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
});
const win = dom.window;

win.requestAnimationFrame = (cb) => {
  try { cb(16); } catch (e) { console.error("RAF ERROR:", e.stack || e.message); }
  return 1;
};
win.ResizeObserver = class { observe() {} disconnect() {} };

setTimeout(() => {
  const err = win.__pageError;
  if (err) console.error("PAGE ERROR:", err);
  const canvas = win.document.getElementById("canvas");
  console.log("canvas size:", canvas?.width, canvas?.height);
  console.log("status:", win.document.getElementById("statusPanel")?.textContent);
  process.exit(err ? 1 : 0);
}, 100);

win.addEventListener("error", (e) => {
  win.__pageError = e.error?.stack || e.message;
  console.error("ERROR:", win.__pageError);
});
