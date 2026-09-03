import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = process.argv.slice(2);
for (const f of files) {
  const fp = path.join(root, f);
  const html = fs.readFileSync(fp, "utf8");
  const m = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) { console.log(f, "no script"); continue; }
  try { new Function(m[1]); console.log(f, "OK"); }
  catch (e) { console.log(f, e.message); }
}
