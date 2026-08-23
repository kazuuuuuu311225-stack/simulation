#!/usr/bin/env node
/**
 * Restore projectile-sim to pre-Aug-15 state by replaying transcript edits
 * (Write + StrReplace) up to the first Aug 15 user message.
 */
"use strict";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const SIM_ROOT = path.join(TOOLS, "..");
const TRANSCRIPT =
  "C:/Users/PC_User/.cursor/projects/c-Users-PC-User-hyakumasu-calc/agent-transcripts/1b949153-93f5-4e20-b596-be04b84d6fb5/1b949153-93f5-4e20-b596-be04b84d6fb5.jsonl";

const AUG15_MARK = "Saturday, Aug 15, 2026";

const lines = fs.readFileSync(TRANSCRIPT, "utf8").split("\n");
const files = new Map();

function simPath(raw) {
  const norm = raw.replace(/\\/g, "/");
  let m = norm.match(/projectile-sim[/\\](.+)$/i);
  if (m) return path.join(SIM_ROOT, m[1]);
  m = norm.match(/hyakumasu-calc[/\\]assets[/\\](.+)$/i);
  if (m) return path.join(SIM_ROOT, "assets", m[1]);
  return null;
}

function loadBase(name) {
  const p = path.join(SIM_ROOT, name);
  if (fs.existsSync(p)) files.set(name, fs.readFileSync(p, "utf8"));
}

let lineNo = 0;
let applied = 0;
let skipped = 0;
let stoppedAt = null;

for (const line of lines) {
  lineNo += 1;
  if (!line.trim()) continue;

  if (line.includes(AUG15_MARK) && line.includes('"role":"user"')) {
    stoppedAt = lineNo;
    break;
  }

  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }

  for (const part of obj.message?.content || []) {
    if (part.name !== "Write" && part.name !== "StrReplace") continue;
    const fp = part.input?.path || "";
    const target = simPath(fp);
    if (!target) continue;
    const rel = path.relative(SIM_ROOT, target).replace(/\\/g, "/");

    if (part.name === "Write") {
      const contents = part.input?.contents;
      if (!contents || contents.length < 50) continue;
      files.set(rel, contents);
      applied += 1;
      continue;
    }

    const oldStr = part.input?.old_string;
    const newStr = part.input?.new_string;
    if (!oldStr || newStr === undefined) continue;

    let cur = files.get(rel);
    if (cur === undefined && fs.existsSync(target)) {
      cur = fs.readFileSync(target, "utf8");
    }
    if (cur === undefined) {
      skipped += 1;
      continue;
    }
    if (!cur.includes(oldStr)) {
      skipped += 1;
      continue;
    }
    files.set(rel, cur.replace(oldStr, newStr));
    applied += 1;
  }
}

let written = 0;
for (const [rel, contents] of files.entries()) {
  const target = path.join(SIM_ROOT, rel);
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(target, contents, "utf8");
  written += 1;
}

console.log("Stopped before transcript line:", stoppedAt ?? "EOF");
console.log("Operations applied:", applied, "Skipped:", skipped, "Files written:", written);
