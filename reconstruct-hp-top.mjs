#!/usr/bin/env node
"use strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TRANSCRIPT =
  "C:/Users/PC_User/.cursor/projects/c-Users-PC-User-hyakumasu-calc/agent-transcripts/1b949153-93f5-4e20-b596-be04b84d6fb5/1b949153-93f5-4e20-b596-be04b84d6fb5.jsonl";
const TARGET = "00_physLabo_top.html";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "00_physLabo_top.reconstructed.html");

let content = null;
for (const line of fs.readFileSync(TRANSCRIPT, "utf8").split("\n")) {
  if (!line.includes(TARGET)) continue;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  for (const p of obj.message?.content || []) {
    if (p.name === "Write" && p.input?.path?.replace(/\\/g, "/").endsWith(TARGET)) {
      content = p.input.contents;
    }
    if (p.name === "StrReplace" && p.input?.path?.replace(/\\/g, "/").endsWith(TARGET)) {
      const { old_string, new_string } = p.input;
      if (content && content.includes(old_string)) {
        content = content.replace(old_string, new_string);
      }
    }
  }
}

if (!content) {
  console.error("Could not reconstruct");
  process.exit(1);
}

fs.writeFileSync(OUT, content, "utf8");
console.log("Wrote", OUT, content.length, "bytes");
const works = content.match(/<ul class="works__list">[\s\S]*?<\/ul>/);
console.log("\n--- WORKS (first 3000 chars) ---\n");
console.log(works ? works[0].slice(0, 3000) : "missing");
