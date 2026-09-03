#!/usr/bin/env node
/**
 * 重複・未使用フォルダを削除する（sim 本体は触らない）。
 * 正本: thermo/ · waves/ · assets/
 *
 * 用法: node tools/cleanup-legacy-folders.mjs
 *       node tools/cleanup-legacy-folders.mjs --dry-run
 */
"use strict";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

/** @type {{ rel: string, reason: string }[]} */
const TARGETS = [
  { rel: "thermodynamics", reason: "thermo/ と重複（古いコピー）" },
  { rel: "波動", reason: "waves/ に統合済み（未リンク）" },
  { rel: "js", reason: "assets/js/ と重複" },
  { rel: "css", reason: "assets/css/ と重複" },
];

function removeDir(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.log("skip (missing):", rel);
    return;
  }
  if (DRY) {
    console.log("[dry] remove:", rel);
    return;
  }
  fs.rmSync(abs, { recursive: true, force: true });
  console.log("removed:", rel);
}

console.log(DRY ? "Dry run — legacy folder cleanup" : "Legacy folder cleanup");
for (const t of TARGETS) {
  console.log(" ", t.rel, "—", t.reason);
  removeDir(t.rel);
}
console.log(DRY ? "Done (dry)." : "Done.");
