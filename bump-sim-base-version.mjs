import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

const root = join(import.meta.dirname, "..");
const from = "physlabo-sim-base.css?v=20260810";
const to = "physlabo-sim-base.css?v=20260826";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  let n = 0;
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      n += await walk(p);
    } else if (extname(e.name) === ".html" || e.name.endsWith(".md") || e.name.endsWith(".mjs")) {
      const text = await readFile(p, "utf8");
      if (!text.includes(from)) continue;
      await writeFile(p, text.replaceAll(from, to), "utf8");
      n++;
    }
  }
  return n;
}

const updated = await walk(root);
console.log(`Updated ${updated} files.`);
