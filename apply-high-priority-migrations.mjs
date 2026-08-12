#!/usr/bin/env node
/**
 * physLabo high-priority migrations:
 * 1. viewport inline -> external JS
 * 2. back link text + chapter hash
 * 3. physlabo-sim-base.css link + strip duplicate shell CSS
 */
"use strict";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIM_ROOT = __dirname;

const VIEWPORT_BODY =
  "(function(){var D=1180,m=document.querySelector('meta[name=viewport]');if(!m)return;document.documentElement.classList.add('physlabo-unified-layout');if('scrollRestoration' in history)history.scrollRestoration='manual';if(document.documentElement.classList.contains('hero-landing'))return;var vw=window.innerWidth||document.documentElement.clientWidth||D;if(vw<D){var s=Math.min(1,vw/D);m.setAttribute('content','width='+D+',initial-scale='+s.toFixed(4)+',minimum-scale='+Math.max(0.2,s*0.45).toFixed(4)+',maximum-scale=5,user-scalable=yes,viewport-fit=cover');}})();";

const VIEWPORT_TAG =
  '<script src="assets/js/physlabo-viewport-inline.js?v=20260810"></script>';
const BASE_CSS =
  '<link rel="stylesheet" href="assets/css/physlabo-sim-base.css?v=20260826">';

const FOLDER_LABELS = {
  classical: "\u529b\u5b66",
  thermo: "\u71b1\u529b\u5b66",
  waves: "\u6ce2\u52d5",
  electromagnetism: "\u96fb\u78c1\u6c17",
  atom: "\u539f\u5b50",
  ex: "EX",
};

const SHELL_CSS_PATTERNS = [
  /\* \{ box-sizing: border-box; \}\s*/g,
  /\.page-shell \{[^}]+\}\s*/g,
  /\.page-header \{[^}]+\}\s*/g,
  /\.hero-icon \{[^}]+\}\s*/g,
  /h2 \{[^}]+\}\s*/g,
  /\.chapter-label \{[^}]+\}\s*/g,
  /#back \{[^}]+\}\s*/g,
  /section\.panel \{[^}]+\}\s*/g,
  /section\.panel h3 \{[^}]+\}\s*/g,
  /section\.panel p \{[^}]+\}\s*/g,
  /\.formula-box \{[^}]+\}\s*/g,
  /\.formula-live \{[^}]+\}\s*/g,
  /\.canvas-wrap \{[^}]+\}\s*/g,
  /\.canvas-wrap canvas \{[^}]+\}\s*/g,
  /\.param-grid \{[^}]+\}\s*/g,
  /@media \(min-width: 640px\) \{ \.param-grid \{[^}]+\} \}\s*/g,
  /label \{[^}]+\}\s*/g,
  /input\[type="range"\] \{[^}]+\}\s*/g,
  /\.slider-val \{[^}]+\}\s*/g,
  /\.toggle-row \{[^}]+\}\s*/g,
  /\.toggle-btn \{[^}]+\}\s*/g,
  /\.toggle-btn\.is-active \{[^}]+\}\s*/g,
  /\.toggle-btn\.is-charge\.is-active \{[^}]+\}\s*/g,
  /\.toggle-btn\.is-discharge\.is-active \{[^}]+\}\s*/g,
  /\.cap-row\.is-hidden \{[^}]+\}\s*/g,
  /\.readout-grid \{[^}]+\}\s*/g,
  /@media \(min-width: 640px\) \{ \.readout-grid \{[^}]+\} \}\s*/g,
  /\.readout \{[^}]+\}\s*/g,
  /\.readout dt \{[^}]+\}\s*/g,
  /\.readout dd \{[^}]+\}\s*/g,
  /\.legend-row \{[^}]+\}\s*/g,
  /\.hint \{[^}]+\}\s*/g,
];

function backLinkText(href) {
  const fm = href.match(/00_folder_(\w+)\.html/);
  if (!fm) return null;
  const label = FOLDER_LABELS[fm[1]];
  if (!label) return null;
  if (href.includes("#chapter-ex")) return "\u2190 EX \u00b7 \u63a2\u7a76";
  const cm = href.match(/#chapter-(\d+)/);
  if (cm) return `\u2190 ${label} \u00b7 \u7b2c${cm[1]}\u7ae0`;
  return `\u2190 ${label}`;
}

function buildChapterMap() {
  const map = {};
  for (const folderFile of fs.readdirSync(SIM_ROOT)) {
    if (!folderFile.startsWith("00_folder_") || !folderFile.endsWith(".html"))
      continue;
    const content = fs.readFileSync(path.join(SIM_ROOT, folderFile), "utf8");
    let currentChapter = null;
    for (const line of content.split("\n")) {
      const idm =
        line.match(/class="chapter[^"]*"[^>]*id="chapter-(\d+)"/) ||
        line.match(/\bid="chapter-(\d+)"/);
      if (idm && !line.includes("-list")) currentChapter = idm[1];
      if (line.match(/\bid="chapter-ex"/) && !line.includes("-list"))
        currentChapter = "ex";
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

function stripShellCss(styleInner) {
  let s = styleInner;
  for (const pat of SHELL_CSS_PATTERNS) {
    s = s.replace(pat, "");
  }
  return s.replace(/\n{3,}/g, "\n\n").replace(/@media \(min-width: 640px\) \{ \}\s*/g, "").trim();
}

function replaceViewport(content) {
  const esc = VIEWPORT_BODY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return content.replace(
    new RegExp("<script>" + esc + "<\\/script>"),
    VIEWPORT_TAG
  );
}

const chapterMap = buildChapterMap();
const stats = { viewport: 0, back: 0, baseCss: 0 };

for (const name of fs.readdirSync(SIM_ROOT)) {
  if (!name.endsWith(".html")) continue;
  const filePath = path.join(SIM_ROOT, name);
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  if (content.includes(VIEWPORT_BODY)) {
    content = replaceViewport(content);
    stats.viewport++;
  }

  if (content.includes('id="back"')) {
    content = content.replace(
      /<a id="back"\s+href="([^"]+)"([^>]*)>[^<]+<\/a>/,
      (full, href, rest) => {
        let newHref = href;
        if (chapterMap[name] && !href.includes("#chapter-")) {
          const info = chapterMap[name];
          newHref = `${info.folder}#chapter-${info.chapter}`;
        }
        const text = backLinkText(newHref);
        if (!text) return full;
        stats.back++;
        return `<a id="back" href="${newHref}"${rest}>${text}</a>`;
      }
    );
  }

  const isPanelSim =
    content.includes('id="back"') &&
    (content.includes("section.panel") || content.includes('class="panel"')) &&
    content.includes("<style>");
  const isNav = /^(00_|index)/.test(name);

  if (isPanelSim && !isNav && !content.includes("physlabo-sim-base.css")) {
    if (content.match(/<link href="https:\/\/fonts\.googleapis\.com\/css[^>]+>/)) {
      content = content.replace(
        /(<link href="https:\/\/fonts\.googleapis\.com\/css[^>]+>)/,
        `$1\n  ${BASE_CSS}`
      );
    } else {
      content = content.replace(/<\/head>/, `  ${BASE_CSS}\n</head>`);
    }

    content = content.replace(
      /(<style>)([\s\S]*?)(<\/style>)/,
      (full, open, inner, close) => {
        const stripped = stripShellCss(inner);
        if (stripped.length < inner.length) {
          return open + stripped + close;
        }
        return full;
      }
    );
    stats.baseCss++;
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log("Updated:", name);
  }
}

const srcAssets = path.join(path.dirname(SIM_ROOT), "assets");
const dstAssets = path.join(SIM_ROOT, "assets");
for (const rel of ["css/physlabo-sim-base.css", "js/physlabo-viewport-inline.js"]) {
  const src = path.join(srcAssets, rel);
  const dst = path.join(dstAssets, rel);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

console.log("");
console.log("Done.");
console.log("  viewport:", stats.viewport);
console.log("  back links:", stats.back);
console.log("  base CSS:", stats.baseCss);
