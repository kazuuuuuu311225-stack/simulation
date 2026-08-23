/**
 * physLabo — sim HTML 列挙（サブフォルダ対応）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SIM_ROOT = path.resolve(TOOLS_DIR, "..");
export const ASSET = "../assets/";
export const MOBILE_CSS_V = "20260821";

export const SIM_DIRS = [
  "classical",
  "thermo",
  "waves",
  "electromagnetism",
  "atom",
  "ex",
];

/** @returns {{ rel: string, abs: string }[]} */
export function listSimHtmlFiles() {
  /** @type {{ rel: string, abs: string }[]} */
  const out = [];
  for (const dir of SIM_DIRS) {
    const base = path.join(SIM_ROOT, dir);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      if (!name.endsWith(".html")) continue;
      out.push({
        rel: dir + "/" + name,
        abs: path.join(base, name),
      });
    }
  }
  return out;
}

export function syncAssetsFromRepo() {
  const repoAssets = path.join(path.dirname(SIM_ROOT), "assets");
  const dstAssets = path.join(SIM_ROOT, "assets");
  const files = [
    "css/physlabo-mobile.css",
    "js/physlabo-viewport-inline.js",
  ];
  for (const rel of files) {
    const src = path.join(repoAssets, rel);
    const dst = path.join(dstAssets, rel);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

export function ensureViewportMeta(content) {
  if (/name=["']viewport["']/i.test(content)) return content;
  return content.replace(
    /(<meta charset="UTF-8">\s*)/i,
    '$1  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n'
  );
}

export function addViewportScript(content) {
  if (content.includes("physlabo-viewport-inline.js")) return content;
  content = ensureViewportMeta(content);
  const tag =
    '<script src="' +
    ASSET +
    'js/physlabo-viewport-inline.js?v=20260810"></script>';
  if (/<meta name="viewport"[^>]*>/i.test(content)) {
    return content.replace(
      /(<meta name="viewport"[^>]*>\s*)/i,
      "$1  " + tag + "\n"
    );
  }
  return content.replace("</head>", "  " + tag + "\n</head>");
}

/** 共通 CSS のみ（mobile.js / a11y.js は追加しない） */
export function addMobileCss(content) {
  if (content.includes("physlabo-mobile.css")) {
    return content.replace(
      /href="[^"]*physlabo-mobile\.css[^"]*"/,
      'href="' + ASSET + "css/physlabo-mobile.css?v=" + MOBILE_CSS_V + '"'
    );
  }
  const css =
    '<link rel="stylesheet" href="' +
    ASSET +
    "css/physlabo-mobile.css?v=" +
    MOBILE_CSS_V +
    '">';
  if (/<link href="https:\/\/fonts\.googleapis\.com\/css[^>]+>/i.test(content)) {
    return content.replace(
      /(<link href="https:\/\/fonts\.googleapis\.com\/css[^>]+>\s*)/i,
      "$1  " + css + "\n"
    );
  }
  return content.replace("</head>", "  " + css + "\n</head>");
}

/** sim から mobile.js / a11y.js タグを除去 */
export function stripExtraMobileScripts(content) {
  return content
    .replace(
      /\s*<script src="[^"]*physlabo-mobile\.js[^"]*" defer><\/script>\s*/gi,
      "\n"
    )
    .replace(
      /\s*<script src="[^"]*physlabo-a11y\.js[^"]*" defer><\/script>\s*/gi,
      "\n"
    );
}

export function applyMobileViewportOnly(content) {
  let next = stripExtraMobileScripts(content);
  next = addViewportScript(next);
  next = addMobileCss(next);
  return next;
}
