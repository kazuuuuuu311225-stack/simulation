#!/usr/bin/env node
/** physLabo 中優先度メンテ: a11y JS 追加 · 公式CSS同期 */
"use strict";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SIM_ROOT = path.dirname(fileURLToPath(import.meta.url));
const A11Y_TAG = '<script src="assets/js/physlabo-a11y.js?v=20260810" defer></script>';
const stats = { a11y: 0 };

function isSimPage(name, content) {
  if (/^(00_|index|TEMPLATE_)/.test(name)) return false;
  if (!name.endsWith(".html")) return false;
  return content.includes("<canvas") || content.includes('id="back"');
}

for (const name of fs.readdirSync(SIM_ROOT)) {
  if (!name.endsWith(".html")) continue;
  const fp = path.join(SIM_ROOT, name);
  let content = fs.readFileSync(fp, "utf8");
  const orig = content;

  if (!isSimPage(name, content)) continue;

  if (!content.includes("physlabo-a11y.js")) {
    if (content.includes("physlabo-mobile.js")) {
      content = content.replace(
        /(<script src="assets\/js\/physlabo-mobile\.js[^"]*" defer><\/script>)/,
        `$1\n  ${A11Y_TAG}`
      );
    } else if (content.includes("</head>")) {
      content = content.replace("</head>", `  ${A11Y_TAG}\n</head>`);
    }
    stats.a11y++;
  }

  if (content !== orig) {
    fs.writeFileSync(fp, content, "utf8");
    console.log("Updated:", name);
  }
}

const srcAssets = path.join(path.dirname(SIM_ROOT), "assets");
const dstAssets = path.join(SIM_ROOT, "assets");
for (const rel of ["css/physlabo-sim-base.css", "js/physlabo-a11y.js"]) {
  const src = path.join(srcAssets, rel);
  const dst = path.join(dstAssets, rel);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

console.log("\nDone. a11y script added:", stats.a11y);
