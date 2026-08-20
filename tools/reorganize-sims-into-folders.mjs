#!/usr/bin/env node
/**
 * ルート直下の sim HTML を分野サブフォルダへ移動（各フォルダ最大100ファイル目安）。
 * シミュレーションの数値・ロジックは変更せず、相対パスとリンクのみ更新する。
 *
 * 用法: node tools/reorganize-sims-into-folders.mjs
 *       node tools/reorganize-sims-into-folders.mjs --dry-run
 */
"use strict";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

const KEEP_AT_ROOT = new Set([
  "00_physLabo_top.html",
  "index.html",
  "index-full.html",
  "news-article.html",
]);

const FOLDER_KEYS = [
  "classical",
  "thermo",
  "waves",
  "electromagnetism",
  "atom",
  "ex",
];

const MANUAL = {
  "archimedes.html": "classical",
  "inertia_train.html": "classical",
  "newtons_laws.html": "classical",
  "blackbody_full_explanation_and_simulation.html": "thermo",
  "compressibility_factor_Z_simulation.html": "thermo",
  "ideal_vs_real_gas_simulation.html": "thermo",
  "mossbauer_mapping_simulation.html": "ex",
  "umi_hotaru_bioluminescence_simulation.html": "ex",
  "32_parallel_resistor_electron_sim.html": "electromagnetism",
  "35_kirchhoff_I_II_stepmode_sim.html": "electromagnetism",
  "51_uniform_B_perpendicular_incident_particle_3D_sim.html": "electromagnetism",
  "58_induced_emf_energy_3D_sim.html": "electromagnetism",
};

const DEV_EXT = new Set([".ps1", ".mjs", ".js", ".json", ".bat"]);
const DEV_KEEP_NAME = new Set([
  "README.md",
  "CONVENTIONS.md",
  ".gitignore",
  "physLabo_logo.png",
  "physLabo_logo.png.bak",
  "physLabo_logo_backup.png",
]);

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  if (DRY) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function moveFile(src, dst) {
  if (DRY) {
    console.log("[dry] move", path.relative(ROOT, src), "->", path.relative(ROOT, dst));
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
  console.log("move", path.relative(ROOT, src), "->", path.relative(ROOT, dst));
}

function buildSimMap() {
  const map = {};
  for (const key of FOLDER_KEYS) {
    const folderFile = path.join(ROOT, `00_folder_${key}.html`);
    if (!fs.existsSync(folderFile)) continue;
    const content = read(folderFile);
    for (const m of content.matchAll(/href="([^"#?]+\.html)"/g)) {
      const href = m[1];
      if (href.startsWith("00_") || href === "index.html") continue;
      map[path.basename(href)] = key;
    }
  }
  for (const [name, key] of Object.entries(MANUAL)) map[name] = key;
  return map;
}

function guessFolderByChapter(name) {
  const m = name.match(/^(\d+)_/);
  if (!m) return null;
  const ch = Number(m[1]);
  if (ch >= 1 && ch <= 11) return "classical";
  if (ch >= 12 && ch <= 15) return "thermo";
  if (ch >= 16 && ch <= 19) return "waves";
  if (ch >= 20 && ch <= 29) return "waves";
  if (ch >= 30 && ch <= 59) return "electromagnetism";
  if (ch >= 60 && ch <= 89) return "atom";
  if (ch >= 90) return "ex";
  return null;
}

function prefixRelativePaths(content) {
  let out = content;
  const rules = [
    [/(\s(?:href|src)=["'])(?!https?:|\/\/|#|\.\.\/)(assets\/)/g, "$1../$2"],
    [/(\s(?:href|src)=["'])(?!https?:|\/\/|#|\.\.\/)(js\/)/g, "$1../$2"],
    [/(\s(?:href|src)=["'])(?!https?:|\/\/|#|\.\.\/)(css\/)/g, "$1../$2"],
    [/(\s(?:href|src)=["'])(?!https?:|\/\/|#|\.\.\/)(vendor\/)/g, "$1../$2"],
    [/(\s(?:href|src)=["'])(?!https?:|\/\/|#|\.\.\/)(data\/)/g, "$1../$2"],
    [/(\s(?:href|src)=["'])(?!https?:|\/\/|#|\.\.\/)(thermodynamics\/)/g, "$1../$2"],
    [/(\s(?:href|src)=["'])(?!https?:|\/\/|#|\.\.\/)(00_folder_[^"']+)/g, "$1../$2"],
    [/(\s(?:href|src)=["'])(?!https?:|\/\/|#|\.\.\/)(00_physLabo_top\.html[^"']*)/g, "$1../$2"],
    [/(\s(?:href|src)=["'])(?!https?:|\/\/|#|\.\.\/)(index\.html[^"']*)/g, "$1../$2"],
    [/(\s(?:href|src)=["'])(?!https?:|\/\/|#|\.\.\/)(news-article\.html[^"']*)/g, "$1../$2"],
    [/url\((?!https?:|\/\/|#|\.\.\/)(assets\/)/g, "url(../$1"],
    [/url\((?!https?:|\/\/|#|\.\.\/)(js\/)/g, "url(../$1"],
    [/url\((?!https?:|\/\/|#|\.\.\/)(css\/)/g, "url(../$1"],
  ];
  for (const [re, rep] of rules) out = out.replace(re, rep);
  return out;
}

function updateFolderPage(content, key) {
  return content.replace(/href="([^"#?]+\.html)"/g, (full, href) => {
    if (
      href.startsWith("../") ||
      href.startsWith("http") ||
      href.startsWith("00_") ||
      href === "index.html" ||
      href.includes("/")
    ) {
      return full;
    }
    return `href="${key}/${href}"`;
  });
}

function updateTopPage(content, simMap) {
  return content.replace(/href="([^"#?]+\.html)"/g, (full, href) => {
    if (
      href.startsWith("../") ||
      href.startsWith("http") ||
      href.startsWith("00_") ||
      href === "index.html" ||
      href === "news-article.html" ||
      href.includes("/")
    ) {
      return full;
    }
    const key = simMap[href];
    if (!key) return full;
    return `href="${key}/${href}"`;
  });
}

function countRootFiles() {
  return fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isFile()).length;
}

function countDirFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isFile()).length;
}

const simMap = buildSimMap();
const moved = [];
const skipped = [];

for (const name of fs.readdirSync(ROOT)) {
  if (!name.endsWith(".html")) continue;
  if (name.startsWith("00_folder_")) continue;
  if (KEEP_AT_ROOT.has(name)) continue;
  if (name.startsWith("TEMPLATE_")) {
    const src = path.join(ROOT, name);
    const dst = path.join(ROOT, "tools", "templates", name);
    moveFile(src, dst);
    continue;
  }

  let key = simMap[name] || guessFolderByChapter(name);
  if (!key) {
    skipped.push(name);
    continue;
  }

  const src = path.join(ROOT, name);
  const dst = path.join(ROOT, key, name);
  let content = read(src);
  content = prefixRelativePaths(content);
  if (!DRY) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, content, "utf8");
    fs.unlinkSync(src);
  } else {
    console.log("[dry] sim", name, "->", key + "/");
  }
  moved.push({ name, key });
  simMap[name] = key;
}

for (const key of FOLDER_KEYS) {
  const folderFile = path.join(ROOT, `00_folder_${key}.html`);
  if (!fs.existsSync(folderFile)) continue;
  const updated = updateFolderPage(read(folderFile), key);
  write(folderFile, updated);
  console.log("update links in", `00_folder_${key}.html`);
}

const topFile = path.join(ROOT, "00_physLabo_top.html");
if (fs.existsSync(topFile)) {
  write(topFile, updateTopPage(read(topFile), simMap));
  console.log("update links in 00_physLabo_top.html");
}

const devDir = path.join(ROOT, "tools", "dev");
for (const name of fs.readdirSync(ROOT)) {
  const full = path.join(ROOT, name);
  if (!fs.statSync(full).isFile()) continue;
  if (DEV_KEEP_NAME.has(name)) continue;
  const ext = path.extname(name).toLowerCase();
  if (!DEV_EXT.has(ext)) continue;
  if (name === "開く.bat") {
    moveFile(full, path.join(ROOT, "tools", "開く.bat"));
    continue;
  }
  moveFile(full, path.join(devDir, name));
}

console.log("");
console.log(DRY ? "Dry run complete." : "Done.");
console.log("  sim moved:", moved.length);
console.log("  skipped (manual assign needed):", skipped.length);
if (skipped.length) console.log("   ", skipped.join(", "));
console.log("  root files now:", countRootFiles());
for (const key of FOLDER_KEYS) {
  const n = countDirFiles(path.join(ROOT, key));
  if (n) console.log(`  ${key}/: ${n} files`);
}
if (countDirFiles(path.join(ROOT, "tools", "dev"))) {
  console.log(`  tools/dev/: ${countDirFiles(path.join(ROOT, "tools", "dev"))} files`);
}
