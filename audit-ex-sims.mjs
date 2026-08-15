#!/usr/bin/env node
"use strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SIM_ROOT = path.dirname(fileURLToPath(import.meta.url));
const EX_LIST = fs
  .readFileSync(path.join(SIM_ROOT, "00_folder_ex.html"), "utf8")
  .match(/href="([^"]+\.html)"/g)
  .map((s) => s.slice(6, -1))
  .filter((h) => !h.startsWith("00_"));
const EX = [...new Set(EX_LIST)];

let ok = 0;
let bad = 0;
for (const name of EX) {
  const p = path.join(SIM_ROOT, name);
  if (!fs.existsSync(p)) {
    console.log("MISSING", name);
    bad++;
    continue;
  }
  const c = fs.readFileSync(p, "utf8");
  const broken = /E\/(div|span|strong|em|button|script|title)>/.test(c);
  const title = (c.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const okJp = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(title);
  if (broken || !okJp) {
    console.log("BAD", name, "|", title.slice(0, 50), "| broken:", broken);
    bad++;
  } else ok++;
}
console.log("\nOK:", ok, "BAD:", bad, "TOTAL:", EX.length);
