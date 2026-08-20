const fs = require("fs");
const path = require("path");
const dir = __dirname;

for (const folder of ["00_folder_thermo.html", "00_folder_classical.html", "00_folder_waves.html", "00_folder_electromagnetism.html", "00_folder_atom.html", "00_folder_ex.html"]) {
  const fp = path.join(dir, folder);
  if (!fs.existsSync(fp)) continue;
  const html = fs.readFileSync(fp, "utf8");
  const links = [...html.matchAll(/href="([^"]+\.html)"/g)]
    .map((m) => m[1])
    .filter((f) => !f.startsWith("00_"));
  const missing = links.filter((f) => !fs.existsSync(path.join(dir, f)));
  const ok = links.filter((f) => fs.existsSync(path.join(dir, f)));
  console.log("\n=== " + folder + " ===");
  console.log("OK: " + ok.length + " / " + links.length);
  if (missing.length) console.log("MISSING:\n  " + missing.join("\n  "));
}
