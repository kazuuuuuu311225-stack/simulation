#!/usr/bin/env node
/**
 * 戻るリンク（#back）だけを CONVENTIONS どおりに統一する。
 * シミュレーション本体には触れない。
 *
 * 用法: node tools/fix-back-links.mjs
 *       node tools/fix-back-links.mjs --dry-run
 */
"use strict";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

const SIM_DIRS = ["classical", "thermo", "waves", "electromagnetism", "atom", "ex"];

const DIR_TO_FOLDER = {
  classical: "00_folder_classical.html",
  thermo: "00_folder_thermo.html",
  waves: "00_folder_waves.html",
  electromagnetism: "00_folder_electromagnetism.html",
  atom: "00_folder_atom.html",
  ex: "00_folder_ex.html",
};

const FOLDER_LABELS = {
  classical: "力学",
  thermo: "熱力学",
  waves: "波動",
  electromagnetism: "電磁気",
  atom: "原子",
  ex: "EX",
};

function buildChapterMap() {
  const map = {};
  for (const file of fs.readdirSync(ROOT)) {
    if (!file.startsWith("00_folder_") || !file.endsWith(".html")) continue;
    const content = fs.readFileSync(path.join(ROOT, file), "utf8");
    let currentChapter = null;
    for (const line of content.split("\n")) {
      if (line.includes("sim-list") && /\bid="(chapter-[^"]+)"/.test(line)) {
        const m = line.match(/\bid="(chapter-[^"]+)"/);
        if (m) currentChapter = m[1];
      }
      if (line.includes("menu-link")) {
        const hm = line.match(/href="([^"#?]+\.html)"/);
        if (hm && currentChapter) {
          map[hm[1].replace(/\\/g, "/")] = {
            folderFile: file,
            chapterId: currentChapter,
          };
        }
      }
    }
  }
  return map;
}

function backText(folderFile, chapterId) {
  const fm = folderFile.match(/00_folder_(\w+)\.html/);
  if (!fm) return "← メニューに戻る";
  const label = FOLDER_LABELS[fm[1]];
  if (!label) return "← メニューに戻る";
  if (chapterId && String(chapterId).indexOf("chapter-ex") === 0) return "← EX · 探究";
  const cm = chapterId && String(chapterId).match(/^chapter-(\d+)$/);
  if (cm) return "← " + label + " · 第" + cm[1] + "章";
  return "← " + label;
}

const MANUAL = {
  "classical/newtons_laws.html": { folderFile: "00_folder_classical.html", chapterId: "chapter-4" },
  "classical/archimedes.html": { folderFile: "00_folder_classical.html", chapterId: "chapter-4" },
  "classical/inertia_train.html": { folderFile: "00_folder_classical.html", chapterId: "chapter-4" },
};

function resolveTarget(relPath, content, dirName) {
  const key = relPath.replace(/\\/g, "/");
  if (MANUAL[key]) return MANUAL[key];
  if (chapterMap[key]) return chapterMap[key];

  const folderFile = DIR_TO_FOLDER[dirName];
  if (!folderFile) return null;

  const hashM = content.match(/<a id="back"\s+href="[^"]*#([^"]+)"/);
  if (hashM) {
    return { folderFile, chapterId: hashM[1] };
  }

  const base = path.basename(relPath);
  const numM = base.match(/^(\d+)_/);
  if (numM && dirName !== "ex") {
    return { folderFile, chapterId: "chapter-" + numM[1] };
  }

  if (dirName === "ex") {
    return { folderFile, chapterId: "chapter-ex-props" };
  }

  return { folderFile, chapterId: null };
}

function buildHref(info) {
  var href = "../" + info.folderFile;
  if (info.chapterId) href += "#" + info.chapterId;
  return href;
}

const BACK_RE = /<a id="back"\s+href="[^"]*"([^>]*)>[^<]*<\/a>/;

const chapterMap = buildChapterMap();
let updated = 0;
let skipped = 0;

function processFile(absPath, relPath, dirName) {
  let content = fs.readFileSync(absPath, "utf8");
  if (!content.includes('id="back"')) return;

  const info = resolveTarget(relPath, content, dirName);
  if (!info) {
    skipped++;
    return;
  }

  const newHref = buildHref(info);
  const newText = backText(info.folderFile, info.chapterId);
  const next = content.replace(
    BACK_RE,
    '<a id="back" href="' + newHref + '"$1>' + newText + "</a>"
  );

  if (next === content) return;

  if (DRY) {
    console.log("[dry]", relPath, "→", newHref, newText);
  } else {
    fs.writeFileSync(absPath, next, "utf8");
  }
  updated++;
}

for (const dir of SIM_DIRS) {
  const dirPath = path.join(ROOT, dir);
  if (!fs.existsSync(dirPath)) continue;
  for (const name of fs.readdirSync(dirPath)) {
    if (!name.endsWith(".html")) continue;
    processFile(path.join(dirPath, name), dir + "/" + name, dir);
  }
}

for (const tpl of ["tools/templates/TEMPLATE_2d_panel.html", "tools/templates/TEMPLATE_3d_simgrid.html"]) {
  const abs = path.join(ROOT, tpl);
  if (!fs.existsSync(abs)) continue;
  let content = fs.readFileSync(abs, "utf8");
  if (!content.includes('id="back"')) continue;
  const next = content.replace(
    BACK_RE,
    '<a id="back" href="../00_folder_classical.html#chapter-1">← 力学 · 第1章</a>'
  );
  if (next !== content) {
    if (!DRY) fs.writeFileSync(abs, next, "utf8");
    updated++;
  }
}

console.log(DRY ? "Dry run." : "Done.");
console.log("  updated:", updated);
console.log("  skipped:", skipped);
console.log("  chapter map entries:", Object.keys(chapterMap).length);
