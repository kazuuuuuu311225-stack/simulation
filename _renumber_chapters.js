const fs = require("fs");
const path = require("path");

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html") && f !== "index.html");

const shifts = [
  ["12章", "11章"],
  ["11章", "10章"],
  ["10章", "9章"],
  ["9章", "8章"],
  ["8章", "7章"],
  ["7章", "6章"],
  ["6章", "5章"],
  ["5章", "4章"],
];

const specific = {
  "inertia.html": "4章　運動の法則 — 第1法則",
  "newton_motion.html": "4章　運動の法則 — F = ma",
  "action_reaction.html": "4章　運動の法則 — 第3法則",
  "pressure_buoyancy.html": "4章　運動の法則 — 大気圧・水圧・浮力",
};

for (const file of files) {
  const fp = path.join(dir, file);
  let s = fs.readFileSync(fp, "utf8");
  if (!s.includes("chapter-label")) continue;

  if (specific[file]) {
    s = s.replace(/<p class="chapter-label">[^<]*<\/p>/, `<p class="chapter-label">${specific[file]}</p>`);
  } else {
    s = s.replace(/(<p class="chapter-label">)([\s\S]*?)(<\/p>)/g, (full, open, text, close) => {
      let t = text;
      for (const [from, to] of shifts) t = t.split(from).join(to);
      return open + t + close;
    });
  }

  fs.writeFileSync(fp, s);
  console.log("updated", file);
}

try { fs.unlinkSync(path.join(dir, "_renumber_chapters.js")); } catch (_) {}
