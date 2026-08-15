#!/usr/bin/env node
"use strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SIM_ROOT = path.dirname(fileURLToPath(import.meta.url));
const FILES = fs
  .readdirSync(SIM_ROOT)
  .filter((f) => f.startsWith("00_folder_") && f.endsWith(".html"));

const THEME_SCRIPT = `<script>(function(){var k='physlabo-landing-theme',v={light:1,sim:1},q,p,t;try{p=new URLSearchParams(location.search);q=p.get('theme');}catch(e){}try{t=(q&&v[q])?q:localStorage.getItem(k);}catch(e){}if(!t||!v[t])t='sim';if(q&&v[q]){try{localStorage.setItem(k,q);}catch(e){}}document.documentElement.setAttribute('data-folder-hp-theme',t);})();</script>
  `;

const LAYOUT_SCRIPT = `<script>(function(){var h=document.documentElement;h.classList.add('physlabo-unified-layout','chapters-mode');h.setAttribute('data-vp','device');if('scrollRestoration' in history)history.scrollRestoration='manual';})();</script>
  `;

const OLD_LAYOUT =
  /<script>\(function\(\)\{var h=document\.documentElement;h\.classList\.add\('physlabo-unified-layout'\);[\s\S]*?<\/script>\s*/;

const FONT_OLD =
  "family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&family=Noto+Sans+JP:wght@400;500;600;700";
const FONT_NEW =
  "family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Noto+Sans+JP:wght@300;400;500;700";

const LABELS = {
  classical: "01 · 力学",
  thermo: "02 · 熱力学",
  waves: "03 · 波動",
  electromagnetism: "04 · 電磁気",
  atom: "05 · 原子",
  ex: "06 · EX章",
};

function heroBar(label) {
  return `      <div class="folder-hero-bar">
        <a class="back-link" href="00_physLabo_top.html">← physLabo トップ</a>
        <button type="button" class="folder-theme-btn" id="folderThemeToggle" aria-label="表示テーマを切り替え">
          <span aria-hidden="true">◐</span> <span data-theme-label>ライト</span>
        </button>
      </div>
      <span class="folder-hero-label">${label}</span>
`;
}

function folderKey(file) {
  return file.replace(/^00_folder_/, "").replace(/\.html$/, "");
}

for (const file of FILES) {
  const filePath = path.join(SIM_ROOT, file);
  let c = fs.readFileSync(filePath, "utf8");
  const key = folderKey(file);
  const label = LABELS[key] || "physLabo";

  if (!c.includes("data-folder-hp-theme")) {
    if (/<script>\(function\(\)\{var h=document\.documentElement;[\s\S]*?<\/script>/.test(c)) {
      c = c.replace(
        /(<script>\(function\(\)\{var h=document\.documentElement;[\s\S]*?<\/script>)/,
        `$1\n  ${THEME_SCRIPT}`
      );
    } else {
      c = c.replace(
        /(<meta name="viewport"[^>]*>\n)/,
        `$1  ${THEME_SCRIPT}`
      );
    }
  }

  c = c.replace(FONT_OLD, FONT_NEW);

  if (!c.includes("physlabo-folder-hp-theme.css")) {
    if (c.includes('href="assets/css/physlabo-folder.css"')) {
      c = c.replace(
        /(<link rel="stylesheet" href="assets\/css\/physlabo-folder\.css">)/,
        '$1\n  <link rel="stylesheet" href="assets/css/physlabo-folder-hp-theme.css?v=20260815">'
      );
    } else {
      c = c.replace(
        /(<\/style>\n<\/head>)/,
        `</style>\n  <link rel="stylesheet" href="assets/css/physlabo-folder-hp-theme.css?v=20260815">\n</head>`
      );
    }
  }

  if (!c.includes("folderThemeToggle")) {
    if (c.includes("folder-hero-bar")) {
      c = c.replace(
        /(<div class="folder-hero-bar">\n        <a class="back-link" href="00_physLabo_top\.html">[^<]*<\/a>\n      <\/div>)/,
        `<div class="folder-hero-bar">
        <a class="back-link" href="00_physLabo_top.html">← physLabo トップ</a>
        <button type="button" class="folder-theme-btn" id="folderThemeToggle" aria-label="表示テーマを切り替え">
          <span aria-hidden="true">◐</span> <span data-theme-label>ライト</span>
        </button>
      </div>`
      );
    } else {
      c = c.replace(
        /(<header class="folder-hero[^"]*">\n)(      <a class="back-link" href="00_physLabo_top\.html">[^<]*<\/a>\n)/,
        `$1${heroBar(label)}`
      );
    }
  }

  if (!c.includes("physlabo-folder-hp-theme.js")) {
    if (/<script src="assets\/js\/physlabo-folder\.js"(?: defer)?><\/script>/.test(c)) {
      c = c.replace(
        /(<script src="assets\/js\/physlabo-folder\.js"(?: defer)?><\/script>)/,
        `  <script src="assets/js/physlabo-folder-hp-theme.js?v=20260815" defer></script>\n  $1`
      );
    } else {
      c = c.replace(
        /(<\/body>)/,
        `  <script src="assets/js/physlabo-folder-hp-theme.js?v=20260815" defer></script>\n$1`
      );
    }
  }

  if (!c.includes('src="assets/js/auth-gate.js')) {
    c = c.replace(
      /(<script src="assets\/js\/physlabo-bg\.js"><\/script>\n)/,
      `$1  <script src="assets/js/auth-gate.js?v=20260626d"></script>\n`
    );
  }

  c = c.replace(/<html lang="ja">/, '<html lang="ja" data-vp="device">');

  if (OLD_LAYOUT.test(c)) {
    c = c.replace(OLD_LAYOUT, LAYOUT_SCRIPT);
  } else if (!c.includes("physlabo-unified-layout")) {
    c = c.replace(/(<meta name="viewport"[^>]*>\n)/, `$1  ${LAYOUT_SCRIPT}`);
  }

  if (!c.includes("physlabo-mobile.css")) {
    if (c.includes("physlabo-folder-hp-theme.css")) {
      c = c.replace(
        /(<link rel="stylesheet" href="assets\/css\/physlabo-folder-hp-theme\.css[^"]*">)/,
        `$1\n  <link rel="stylesheet" href="assets/css/physlabo-mobile.css?v=20260815">`
      );
    } else {
      c = c.replace(
        /(<link rel="stylesheet" href="assets\/css\/physlabo-folder-hp-theme\.css[^"]*">\n<\/head>)/,
        `$1\n  <link rel="stylesheet" href="assets/css/physlabo-mobile.css?v=20260815">`
      );
      if (!c.includes("physlabo-mobile.css")) {
        c = c.replace(
          /(<\/style>\n  <link rel="stylesheet" href="assets\/css\/physlabo-folder-hp-theme\.css[^"]*">\n<\/head>)/,
          `$1\n  <link rel="stylesheet" href="assets/css/physlabo-mobile.css?v=20260815">`
        );
      }
      if (!c.includes("physlabo-mobile.css")) {
        c = c.replace(/(<\/head>)/, `  <link rel="stylesheet" href="assets/css/physlabo-mobile.css?v=20260815">\n$1`);
      }
    }
  }

  if (!c.includes("physlabo-mobile.js")) {
    c = c.replace(/(<\/head>)/, `  <script src="assets/js/physlabo-mobile.js?v=20260815" defer></script>\n$1`);
  }

  c = c.replace(/physlabo-mobile\.css\?v=[^"]+/g, "physlabo-mobile.css?v=20260815");
  c = c.replace(/physlabo-mobile\.js\?v=[^"]+/g, "physlabo-mobile.js?v=20260815");
  c = c.replace(/physlabo-folder-hp-theme\.css\?v=[^"]+/g, "physlabo-folder-hp-theme.css?v=20260815");
  c = c.replace(/auth-gate\.js\?v=[^"]+/g, "auth-gate.js?v=20260815");

  if (!c.includes("data-auth-entry")) {
    c = c.replace(/<body>/, '<body data-auth-entry>');
  }

  if (!c.includes("auth-gate.js")) {
    c = c.replace(
      /(<script src="assets\/js\/physlabo-folder-hp-theme\.js[^"]*" defer><\/script>\n)/,
      `$1  <script src="assets/js/auth-gate.js?v=20260815"></script>\n`
    );
    if (!c.includes("auth-gate.js")) {
      c = c.replace(
        /(<script src="assets\/js\/physlabo-folder\.js"[^>]*><\/script>)/,
        `  <script src="assets/js/auth-gate.js?v=20260815"></script>\n  $1`
      );
    }
    if (!c.includes("auth-gate.js")) {
      c = c.replace(
        /(<script src="assets\/js\/physlabo-folder-hp-theme\.js[^"]*" defer><\/script>\n  <\/body>)/,
        `  <script src="assets/js/auth-gate.js?v=20260815"></script>\n$1`
      );
    }
    if (!c.includes("auth-gate.js")) {
      c = c.replace(/(<\/body>)/, `  <script src="assets/js/auth-gate.js?v=20260815"></script>\n$1`);
    }
  }

  fs.writeFileSync(filePath, c, "utf8");
  console.log("Applied HP theme:", file);
}
