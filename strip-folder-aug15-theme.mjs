#!/usr/bin/env node
"use strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SIM = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = fs
  .readdirSync(SIM)
  .filter((n) => n.startsWith("00_folder_") && n.endsWith(".html"));

for (const name of files) {
  const p = path.join(SIM, name);
  let html = fs.readFileSync(p, "utf8");

  html = html.replace(
    /\n  <script>\(function\(\)\{var k='physlabo-landing-theme'[\s\S]*?data-folder-hp-theme',t\);\}\)\(\);<\/script>\n/,
    "\n"
  );
  html = html.replace(
    /\n  <link rel="stylesheet" href="assets\/css\/physlabo-folder-hp-theme\.css[^"]*">\n/,
    "\n"
  );
  html = html.replace(
    /\n        <button type="button" class="folder-theme-btn"[\s\S]*?<\/button>\n/,
    "\n"
  );
  html = html.replace(
    /\n    <script src="assets\/js\/physlabo-folder-hp-theme\.js[^"]*" defer><\/script>/,
    ""
  );
  html = html.replace(
    /\n  <script src="assets\/js\/physlabo-folder-hp-theme\.js[^"]*" defer><\/script>/,
    ""
  );

  fs.writeFileSync(p, html, "utf8");
  console.log("Stripped Aug15 theme from", name);
}
