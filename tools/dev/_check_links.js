/**
 * 00_folder_*.html 内の sim リンクが実在するか確認（サブフォルダ対応）
 * 用法: node tools/dev/_check_links.js
 */
const fs = require("fs");
const path = require("path");

const SIM_ROOT = path.resolve(__dirname, "..", "..");

const FOLDERS = [
  "00_folder_thermo.html",
  "00_folder_classical.html",
  "00_folder_waves.html",
  "00_folder_electromagnetism.html",
  "00_folder_atom.html",
  "00_folder_ex.html",
];

for (const folder of FOLDERS) {
  const fp = path.join(SIM_ROOT, folder);
  if (!fs.existsSync(fp)) continue;
  const html = fs.readFileSync(fp, "utf8");
  const links = [...html.matchAll(/href="([^"#?]+\.html)"/g)]
    .map((m) => m[1])
    .filter((f) => !f.startsWith("00_") && !f.startsWith("http"));
  const missing = links.filter((f) => !fs.existsSync(path.join(SIM_ROOT, f)));
  const ok = links.filter((f) => fs.existsSync(path.join(SIM_ROOT, f)));
  console.log("\n=== " + folder + " ===");
  console.log("OK: " + ok.length + " / " + links.length);
  if (missing.length) console.log("MISSING:\n  " + missing.join("\n  "));
}

console.log("\nSIM_ROOT:", SIM_ROOT);
