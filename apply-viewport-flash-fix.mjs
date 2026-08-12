/**
 * Bump physlabo-mobile.js cache + sync assets after viewport string fix.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;

const INLINE_VP = `<script>(function(){var D=1180,m=document.querySelector('meta[name=viewport]');if(!m)return;var h=document.documentElement;h.classList.add('physlabo-unified-layout');if('scrollRestoration' in history)history.scrollRestoration='manual';if(h.classList.contains('hero-landing')||h.classList.contains('hero-transition-active')||h.getAttribute('data-vp')==='device')return;var vw=window.innerWidth||document.documentElement.clientWidth||D;if(vw>=D)return;var s=Math.min(1,vw/D);m.setAttribute('content','width='+D+',initial-scale='+s.toFixed(4)+',minimum-scale='+Math.max(0.2,s*0.45).toFixed(4)+',maximum-scale=5,user-scalable=yes,viewport-fit=cover');})();</script>`;

const OLD_INLINE =
  /<script>\(function\(\)\{var D=1180,m=document\.querySelector\('meta\[name=viewport\]'\);[\s\S]*?\}\)\(\);<\/script>/;

const files = fs
  .readdirSync(root)
  .filter((f) => f.endsWith(".html"))
  .map((f) => path.join(root, f));

let n = 0;
for (const file of files) {
  let html = fs.readFileSync(file, "utf8");
  let changed = false;

  if (OLD_INLINE.test(html)) {
    html = html.replace(OLD_INLINE, INLINE_VP);
    changed = true;
  }

  if (html.includes("physlabo-mobile.js?v=20260811")) {
    html = html.replaceAll(
      "physlabo-mobile.js?v=20260811",
      "physlabo-mobile.js?v=20260812"
    );
    changed = true;
  } else if (html.includes("physlabo-mobile.js?v=20260626c")) {
    html = html.replaceAll(
      "physlabo-mobile.js?v=20260626c",
      "physlabo-mobile.js?v=20260812"
    );
    changed = true;
  }

  if (html.includes("physlabo-mobile.css?v=20260811")) {
    html = html.replaceAll(
      "physlabo-mobile.css?v=20260811",
      "physlabo-mobile.css?v=20260812"
    );
    changed = true;
  } else if (html.includes("physlabo-mobile.css?v=20260626c")) {
    html = html.replaceAll(
      "physlabo-mobile.css?v=20260626c",
      "physlabo-mobile.css?v=20260812"
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, html, "utf8");
    n++;
  }
}

for (const rel of [
  "assets/js/physlabo-mobile.js",
  "assets/js/physlabo-viewport-inline.js",
]) {
  fs.copyFileSync(
    path.join(path.dirname(root), rel),
    path.join(root, rel)
  );
}

console.log("updated", n, "html files");
