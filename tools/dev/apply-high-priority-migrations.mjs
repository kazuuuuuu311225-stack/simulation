#!/usr/bin/env node
/**
 * physLabo 高優先度メンテ — スマホ対応（安全版）
 * 追加するのは viewport スクリプト + 共通 CSS のみ。
 * mobile.js / a11y.js は追加しない（sim への影響を最小化）。
 *
 * 用法: node tools/dev/apply-high-priority-migrations.mjs
 */
"use strict";

import fs from "fs";
import {
  SIM_ROOT,
  listSimHtmlFiles,
  syncAssetsFromRepo,
  applyMobileViewportOnly,
} from "../migration-sim-files.mjs";

const stats = { viewport: 0, css: 0, stripped: 0, files: 0 };

syncAssetsFromRepo();

for (const { rel, abs } of listSimHtmlFiles()) {
  let content = fs.readFileSync(abs, "utf8");
  const original = content;

  const hadViewport = content.includes("physlabo-viewport-inline.js");
  const hadCss = content.includes("physlabo-mobile.css");
  const hadExtra =
    content.includes("physlabo-mobile.js") ||
    content.includes("physlabo-a11y.js");

  content = applyMobileViewportOnly(content);

  if (!hadViewport && content.includes("physlabo-viewport-inline.js")) {
    stats.viewport++;
  }
  if (!hadCss && content.includes("physlabo-mobile.css")) {
    stats.css++;
  }
  if (hadExtra && !content.includes("physlabo-mobile.js") && !content.includes("physlabo-a11y.js")) {
    stats.stripped++;
  }

  if (content !== original) {
    fs.writeFileSync(abs, content, "utf8");
    stats.files++;
    console.log("Updated:", rel);
  }
}

console.log("");
console.log("Done. SIM_ROOT:", SIM_ROOT);
console.log("  files changed:", stats.files);
console.log("  viewport added:", stats.viewport);
console.log("  mobile CSS added:", stats.css);
console.log("  extra JS removed:", stats.stripped);
