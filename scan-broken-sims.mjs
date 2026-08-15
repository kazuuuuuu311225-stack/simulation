#!/usr/bin/env node
"use strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SIM_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === "tools") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".html")) out.push(p);
  }
  return out;
}

function dupDecls(code) {
  const seen = new Map();
  for (const m of code.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
    const n = m[1];
    seen.set(n, (seen.get(n) || 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, c]) => c > 1)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function checkFile(fp) {
  const rel = path.relative(SIM_ROOT, fp).replace(/\\/g, "/");
  const html = fs.readFileSync(fp, "utf8");
  const issues = [];
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((m, i) => {
    const code = m[1].trim();
    if (!code) return;
    try {
      new Function(code);
    } catch (e) {
      issues.push({ type: "syntax", detail: e.message, script: i + 1 });
    }
  });
  const srcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const s of srcs) {
    if (/^https?:/i.test(s)) continue;
    const local = path.join(path.dirname(fp), s.replace(/\?.*$/, ""));
    if (!fs.existsSync(local)) {
      issues.push({ type: "missing-src", detail: s, script: 0 });
    }
  }
  return issues.length ? { rel, issues } : null;
}

const files = walk(SIM_ROOT);
const bad = files.map(checkFile).filter(Boolean);
bad.sort((a, b) => a.rel.localeCompare(b.rel));

console.log(`TOTAL html: ${files.length}`);
console.log(`BROKEN: ${bad.length}`);
const syntaxOnly = bad.filter((b) => b.issues.some((i) => i.type === "syntax"));
const missingOnly = bad.filter((b) => b.issues.some((i) => i.type === "missing-src"));
console.log(`SYNTAX ERRORS: ${syntaxOnly.length}`);
console.log(`MISSING SRC: ${missingOnly.length}`);

console.log("\n=== SYNTAX ERRORS (sim will not run) ===");
for (const b of syntaxOnly) {
  console.log(`\n## ${b.rel}`);
  for (const i of b.issues.filter((x) => x.type === "syntax")) {
    console.log(` - ${i.detail} (script#${i.script})`);
  }
}

console.log("\n=== MISSING LOCAL SCRIPTS ===");
for (const b of missingOnly) {
  const miss = b.issues.filter((x) => x.type === "missing-src");
  if (!b.issues.some((x) => x.type === "syntax")) {
    console.log(`\n## ${b.rel}`);
    for (const i of miss) console.log(` - ${i.detail}`);
  }
}
