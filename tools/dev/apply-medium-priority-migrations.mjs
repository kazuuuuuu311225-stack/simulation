#!/usr/bin/env node
/**
 * physLabo 中優先度メンテ
 *
 * スマホ対応方針: viewport + 共通 CSS のみ（apply-high-priority を使用）。
 * a11y.js は sim への自動追加対象外。
 */
"use strict";

console.log(
  "Skipped: sim スマホ対応は viewport + physlabo-mobile.css のみ。\n" +
    "  node tools/dev/apply-high-priority-migrations.mjs を実行してください。"
);
