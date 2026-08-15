#!/usr/bin/env node
"use strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SIM_ROOT = path.dirname(fileURLToPath(import.meta.url));
const FILES = fs.readdirSync(SIM_ROOT).filter((f) => f.startsWith("00_folder_") && f.endsWith(".html"));

const THEME_SCRIPT =
  '<script>(function(){var k=\'physlabo-landing-theme\',v={light:1,sim:1},q,p,t;try{p=new URLSearchParams(location.search);q=p.get(\'theme\');}catch(e){}try{t=(q&&v[q])?q:localStorage.getItem(k);}catch(e){}if(!t||!v[t])t=\'sim\';if(q&&v[q]){try{localStorage.setItem(k,q);}catch(e){}}document.documentElement.setAttribute(\'data-folder-hp-theme\',t);})();</script>\n  ';

const FONT_OLD =
  "family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&family=Noto+Sans+JP:wght@400;500;600;700";
const FONT_NEW =
  "family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Noto+Sans+JP:wght@300;400;500;700";

for (const file of FILES) {
  let c = fs.readFileSync(path.join(SIM_ROOT, file), "utf8");
  c = c.replace(THEME_SCRIPT, "");
  c = c.replace(FONT_NEW, FONT_OLD);
  c = c.replace(/\n  <link rel="stylesheet" href="assets\/css\/physlabo-folder-hp-theme\.css[^"]*">\n?/g, "\n");
  c = c.replace(
    /      <div class="folder-hero-bar">[\s\S]*?      <\/div>\n      <span class="folder-hero-label">[^<]*<\/span>\n/,
    '      <a class="back-link" href="00_physLabo_top.html">← physLabo トップ</a>\n'
  );
  if (!c.includes('href="00_physLabo_top.html">← physLabo トップ</a>')) {
    c = c.replace(
      /(<header class="folder-hero[^"]*">)\s*/,
      '$1\n      <a class="back-link" href="00_physLabo_top.html">← physLabo トップ</a>\n'
    );
  }
  if (!c.includes("auth-gate.js")) {
    c = c.replace(
      /(<link rel="stylesheet" href="assets\/css\/physlabo-folder\.css">)/,
      '$1\n  <script src="assets/js/auth-gate.js?v=20260626d" defer></script>'
    );
  }
  c = c.replace(/\n  <script src="assets\/js\/auth-gate\.js[^"]*"><\/script>\n  <script src="assets\/js\/physlabo-folder-hp-theme\.js[^"]*" defer><\/script>\n  <script src="assets\/js\/physlabo-folder\.js" defer><\/script>/, `
  <script src="assets/js/physlabo-shared.js"></script>
  <script src="assets/js/physlabo-bg.js"></script>
  <script src="assets/js/physlabo-folder.js"></script>`);
  c = c.replace(/<script src="assets\/js\/auth-gate\.js[^"]*"><\/script>\s*(?=<link rel="stylesheet" href="assets\/css\/physlabo-mobile)/, "");
  fs.writeFileSync(path.join(SIM_ROOT, file), c, "utf8");
  console.log("Reverted folder UI:", file);
}
