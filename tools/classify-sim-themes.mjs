#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = ["classical", "thermo", "waves", "electromagnetism", "atom", "ex"];

const DARK =
  /#030712|#050810|#0c1428|#0c1524|#0f172a|#020617|#101828|#0a1628|#0f1030/;
const LIGHT_BODY =
  /body\s*\{[^}]{0,1200}background:\s*(?:linear-gradient\([^)]*(?:#e[0-9a-f]{3,6}|#f[0-9a-f]{3,6}|white|#fff)|#e[0-9a-f]{3,6}|#f[0-9a-f]{3,6}|white)/is;
const LIGHT_TEXT = /color:\s*#00[34][0-9a-f]{3}/;
const OLD_UI = /id="ui"/;
const PAGE_SHELL = /class="page-shell"/;

/** @type {Record<string, string[]>} */
const groups = {
  "A 白背景・青文字（最古型 #ui）": [],
  "B 白〜薄色背景（page-shell なし or 独自）": [],
  "C 薄色背景（page-shell あり・中間型）": [],
  "D ダークだが #ui レイアウト": [],
};

for (const dir of DIRS) {
  const base = path.join(ROOT, dir);
  for (const name of fs.readdirSync(base)) {
    if (!name.endsWith(".html")) continue;
    const rel = `${dir}/${name}`;
    const html = fs.readFileSync(path.join(base, name), "utf8");
    const style = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const css = (style ? style[1] : "") + html.slice(0, 4000);
    const isDark = DARK.test(css);
    const isLightBody = LIGHT_BODY.test(css);
    const isLightText = LIGHT_TEXT.test(css);
    const ui = OLD_UI.test(html);
    const shell = PAGE_SHELL.test(html);

    if ((isLightBody || isLightText) && ui) {
      groups["A 白背景・青文字（最古型 #ui）"].push(rel);
    } else if (isLightBody || isLightText) {
      if (shell) groups["C 薄色背景（page-shell あり・中間型）"].push(rel);
      else groups["B 白〜薄色背景（page-shell なし or 独自）"].push(rel);
    } else if (ui && !shell) {
      groups["D ダークだが #ui レイアウト"].push(rel);
    }
  }
}

for (const [label, files] of Object.entries(groups)) {
  console.log(`\n=== ${label} (${files.length}) ===`);
  for (const f of files.sort()) console.log("  " + f);
}
