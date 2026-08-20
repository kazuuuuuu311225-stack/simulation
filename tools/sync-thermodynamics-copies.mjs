#!/usr/bin/env node
"use strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DST = path.join(ROOT, "thermodynamics");

const FILES = [
  "brownian_motion_simulation.html",
  "specific_heat_capacity_simulation.html",
  "heat_conservation_equilibrium_simulation.html",
  "temperature_simulation_celsius_kelvin.html",
];

function relPaths(html) {
  return html
    .replace(/href="assets\//g, 'href="../assets/')
    .replace(/src="assets\//g, 'src="../assets/')
    .replace(/href="00_folder/g, 'href="../00_folder')
    .replace(/href="00_physLabo/g, 'href="../00_physLabo');
}

if (!fs.existsSync(DST)) fs.mkdirSync(DST, { recursive: true });

for (const name of FILES) {
  const src = path.join(ROOT, name);
  if (!fs.existsSync(src)) {
    console.warn("skip missing", name);
    continue;
  }
  const out = relPaths(fs.readFileSync(src, "utf8"));
  fs.writeFileSync(path.join(DST, name), out, "utf8");
  console.log("synced thermodynamics/" + name);
}
