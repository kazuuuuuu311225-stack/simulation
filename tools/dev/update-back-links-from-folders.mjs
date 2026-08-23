#!/usr/bin/env node
/**
 * 戻るリンク（#back）を 00_folder_*.html の章一覧から更新する。
 * 用法: node tools/dev/update-back-links-from-folders.mjs
 * （tools/fix-back-links.mjs を推奨）
 */
"use strict";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fix-back-links.mjs");
const r = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
