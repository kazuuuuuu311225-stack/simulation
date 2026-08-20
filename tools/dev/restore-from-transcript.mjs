#!/usr/bin/env node
/**
 * Restore projectile-sim HTML from agent transcript Write events (last version per file).
 */
"use strict";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIM_ROOT = __dirname;
const TRANSCRIPT =
  "C:/Users/PC_User/.cursor/projects/c-Users-PC-User-hyakumasu-calc/agent-transcripts/1b949153-93f5-4e20-b596-be04b84d6fb5/1b949153-93f5-4e20-b596-be04b84d6fb5.jsonl";

const writes = new Map();

for (const line of fs.readFileSync(TRANSCRIPT, "utf8").split("\n")) {
  if (!line.includes('"Write"') || !line.includes(".html")) continue;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  for (const part of obj.message?.content || []) {
    if (part.name !== "Write") continue;
    const fp = part.input?.path || "";
    if (!/projectile-sim[/\\].+\.html$/i.test(fp)) continue;
    const base = path.basename(fp.replace(/\\/g, "/"));
    const contents = part.input?.contents;
    if (!contents || contents.length < 200) continue;
    writes.set(base, contents);
  }
}

console.log("Transcript writes found:", writes.size);

let restored = 0;
let skipped = 0;

for (const [name, contents] of writes.entries()) {
  const target = path.join(SIM_ROOT, name);
  if (!fs.existsSync(target) && !name.startsWith("00_")) {
    skipped++;
    continue;
  }
  fs.writeFileSync(target, contents, "utf8");
  restored++;
  console.log("Restored:", name, `(${contents.length} bytes)`);
}

console.log("\nDone. Restored:", restored, "Skipped:", skipped);
