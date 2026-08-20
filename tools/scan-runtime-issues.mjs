#!/usr/bin/env node
"use strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === "tools") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const SIM_API = {
  "heat-equilibrium-inquiry": "HeatEquilibriumSim",
  "specific-heat-inquiry": "SpecificHeatSim",
  "brownian-inquiry": "BrownianSim",
};

function dupDecls(code) {
  const seen = new Map();
  for (const m of code.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
    const n = m[1];
    seen.set(n, (seen.get(n) || 0) + 1);
  }
  return [...seen.entries()].filter(([, c]) => c > 1).map(([name, count]) => ({ name, count }));
}

function checkFile(fp) {
  const rel = path.relative(ROOT, fp).replace(/\\/g, "/");
  const html = fs.readFileSync(fp, "utf8");
  const issues = [];

  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((m, i) => {
    const code = m[1];
    try {
      new Function(code);
    } catch (e) {
      issues.push({ kind: "syntax", detail: e.message, where: `inline script #${i + 1}` });
    }
    for (const { name, count } of dupDecls(code)) {
      issues.push({ kind: "dup-decl", detail: `'${name}' declared ${count} times`, where: `inline script #${i + 1}` });
    }
    if (/\bstateListeners\b/.test(code) && !/\b(?:const|let|var)\s+stateListeners\b/.test(code)) {
      issues.push({ kind: "missing-var", detail: "stateListeners used but never declared", where: `inline script #${i + 1}` });
    }
    if (/\bequilibriumListeners\b/.test(code) && !/\b(?:const|let|var)\s+equilibriumListeners\b/.test(code)) {
      issues.push({ kind: "missing-var", detail: "equilibriumListeners used but never declared", where: `inline script #${i + 1}` });
    }
  });

  for (const m of html.matchAll(/<(?:link|script)[^>]+(?:href|src)=["']([^"']+)["']/gi)) {
    const s = m[1];
    if (/^https?:/i.test(s)) continue;
    const local = path.join(path.dirname(fp), s.replace(/\?.*$/, ""));
    if (!fs.existsSync(local)) {
      const altAssets = path.join(ROOT, "assets", s.replace(/^assets\/?/, "").replace(/^(css|js)\//, "css/".includes(s) ? "css/" : "js/"));
      const altFromCss = s.startsWith("css/") ? path.join(ROOT, "assets/css", s.slice(4)) : null;
      const altFromJs = s.startsWith("js/") ? path.join(ROOT, "assets/js", s.slice(3)) : null;
      let hint = "";
      if (altFromCss && fs.existsSync(altFromCss)) hint = " (exists at assets/css/...)";
      else if (altFromJs && fs.existsSync(altFromJs)) hint = " (exists at assets/js/...)";
      issues.push({ kind: "missing-src", detail: s + hint, where: "head/body" });
    }
  }

  const hasInquiry = /-inquiry\//.test(html) || /InquiryMode\.js/.test(html);
  if (hasInquiry) {
    for (const [folder, api] of Object.entries(SIM_API)) {
      if (!html.includes(folder)) continue;
      if (!html.includes(`window.${api}`) && !html.includes(`${api} =`)) {
        issues.push({ kind: "missing-api", detail: `loads ${folder} but no window.${api}`, where: "inline JS" });
      }
    }
    if (html.includes("tabInquiry") && !html.includes('id="tabSimulation"')) {
      issues.push({ kind: "broken-tabs", detail: "tabInquiry without tabSimulation wrapper", where: "HTML" });
    }
    if (html.includes("/tabSimulation") && !html.includes('id="tabSimulation"')) {
      issues.push({ kind: "broken-tabs", detail: "closing tabSimulation comment without opening div", where: "HTML" });
    }
    if (html.includes("tabInquiry") && !html.includes("tab-bar")) {
      issues.push({ kind: "broken-tabs", detail: "inquiry tab without tab-bar nav", where: "HTML" });
    }
  }

  return issues.length ? { rel, issues } : null;
}

const bad = walk(ROOT).map(checkFile).filter(Boolean);
bad.sort((a, b) => a.rel.localeCompare(b.rel));

console.log(`Scanned HTML: ${walk(ROOT).length}`);
console.log(`Files with runtime-risk issues: ${bad.length}\n`);

const byKind = {};
for (const b of bad) {
  for (const i of b.issues) {
    byKind[i.kind] = (byKind[i.kind] || 0) + 1;
  }
}
console.log("By kind:", byKind, "\n");

for (const b of bad) {
  console.log(`## ${b.rel}`);
  for (const i of b.issues) {
    console.log(`  [${i.kind}] ${i.detail} @ ${i.where}`);
  }
  console.log("");
}
