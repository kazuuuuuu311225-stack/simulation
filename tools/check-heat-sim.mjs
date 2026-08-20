import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "heat_conservation_equilibrium_simulation.html");
const html = fs.readFileSync(htmlPath, "utf8");

const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
scripts.forEach((m, i) => {
  try {
    new Function(m[1]);
    console.log(`inline script ${i + 1}: OK`);
  } catch (e) {
    console.error(`inline script ${i + 1}: ${e.message}`);
    process.exitCode = 1;
  }
});

for (const s of [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1])) {
  if (/^https?:/i.test(s)) continue;
  const local = path.join(root, s.replace(/\?.*$/, ""));
  if (!fs.existsSync(local)) {
    console.error("MISSING:", s);
    process.exitCode = 1;
  }
}

if (!html.includes("const stateListeners = []")) {
  console.error("stateListeners not declared");
  process.exitCode = 1;
}
if (!html.includes("window.HeatEquilibriumSim")) {
  console.error("HeatEquilibriumSim API missing");
  process.exitCode = 1;
}
if (!html.includes("function drawMaterialBody")) {
  console.error("drawMaterialBody missing");
  process.exitCode = 1;
}
if (!html.includes("function phaseLabel")) {
  console.error("phaseLabel missing");
  process.exitCode = 1;
}

console.log("heat_conservation checks passed");
