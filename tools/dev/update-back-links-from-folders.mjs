#!/usr/bin/env node
"use strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SIM_ROOT = path.dirname(fileURLToPath(import.meta.url));

function buildChapterMap() {
  const map = {};
  for (const folderFile of fs.readdirSync(SIM_ROOT)) {
    if (!folderFile.startsWith("00_folder_") || !folderFile.endsWith(".html")) continue;
    const content = fs.readFileSync(path.join(SIM_ROOT, folderFile), "utf8");
    let currentChapter = null;
    for (const line of content.split("\n")) {
      const toggleM = line.match(/aria-controls="(chapter-[^"]+)"/);
      if (toggleM) currentChapter = toggleM[1].replace(/^chapter-/, "");
      const idm = line.match(/\bid="(chapter-[^"]+)"/);
      if (idm && line.includes("sim-list")) {
        currentChapter = idm[1].replace(/^chapter-/, "");
      }
      if (line.includes("menu-link")) {
        const hm = line.match(/href="([^"]+\.html)"/);
        if (hm && currentChapter) {
          map[hm[1]] = { folder: folderFile, chapter: currentChapter };
        }
      }
    }
  }
  return map;
}

const FOLDER_LABELS = {
  classical: "力学",
  thermo: "熱力学",
  waves: "波動",
  electromagnetism: "電磁気",
  atom: "原子",
  ex: "EX",
};

function backText(href) {
  const fm = href.match(/00_folder_(\w+)\.html/);
  if (!fm) return "← メニューに戻る";
  const label = FOLDER_LABELS[fm[1]];
  if (!label) return "← メニューに戻る";
  if (href.includes("#chapter-ex")) return "← EX · 探究";
  const cm = href.match(/#chapter-(\d+)/);
  if (cm) return `← ${label} · 第${cm[1]}章`;
  return `← ${label}`;
}

const chapterMap = buildChapterMap();
let updated = 0;

for (const name of fs.readdirSync(SIM_ROOT)) {
  if (!name.endsWith(".html") || name.startsWith("00_") || name === "index.html") continue;
  const filePath = path.join(SIM_ROOT, name);
  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes('id="back"')) continue;
  const info = chapterMap[name];
  if (!info) continue;
  const newHref = `${info.folder}#chapter-${info.chapter}`;
  const text = backText(newHref);
  const next = content.replace(
    /<a id="back"\s+href="[^"]*"([^>]*)>[^<]*<\/a>/,
    `<a id="back" href="${newHref}"$1>${text}</a>`
  );
  if (next !== content) {
    fs.writeFileSync(filePath, next, "utf8");
    updated++;
  }
}

console.log("Back links updated:", updated);
