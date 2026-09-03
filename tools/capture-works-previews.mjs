import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, statSync, mkdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(ROOT, "assets", "img", "works");
const PORT = 9876;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".wasm": "application/wasm",
};

function startServer(root, port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let rel = decodeURIComponent((req.url || "/").split("?")[0]);
      if (rel === "/") rel = "/00_physLabo_top.html";
      const filePath = join(root, rel.replace(/^\//, "").replace(/\.\./g, ""));
      if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(readFileSync(filePath));
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const TARGETS = [
  {
    out: "01_projectile.png",
    path: "/simulation.html",
    selector: "#motionWrap",
    prepare: async (page) => {
      await page.waitForTimeout(2000);
      await page.click("#btnStart", { timeout: 8000 });
      // 放物線の軌道が十分描画されるよう、最高点付近まで待つ
      await page.waitForTimeout(9000);
    },
  },
  {
    out: "02_brownian.png",
    path: "/brownian_motion_simulation.html",
    selector: "#simCanvasWrap",
    prepare: async (page) => {
      await page.waitForTimeout(2500);
    },
  },
  {
    out: "03_interference.png",
    path: "/16_wave_interference.html",
    selector: "#waveCanvas",
    prepare: async (page) => {
      await page.waitForTimeout(2500);
    },
  },
  {
    out: "04_em_induction.png",
    path: "/54_electromagnetic_induction_3D_sim.html",
    selector: "#field3dWrap",
    prepare: async (page) => {
      await page.waitForTimeout(4000);
    },
  },
  {
    out: "05_atomic_models.png",
    path: "/83_atomic_models_thomson_nagaoka_rutherford_3D.html",
    selector: "#field3dWrap canvas",
    clipRatio: 0.62,
    prepare: async (page) => {
      await page.waitForTimeout(4000);
      await page.locator('.mode-btn[data-model="bohr"]').click({ timeout: 10000 });
      await page.waitForTimeout(2000);
      if (await page.locator("#btnSpin.active").count()) {
        await page.click("#btnSpin");
      }
      await page.evaluate(() => {
        document.querySelectorAll(".mode-badge, .status-badge").forEach((el) => {
          el.style.display = "none";
        });
        const wrap = document.getElementById("field3dWrap");
        if (!wrap) return;
        for (let i = 0; i < 80; i++) {
          wrap.dispatchEvent(
            new WheelEvent("wheel", { deltaY: -200, bubbles: true, cancelable: true })
          );
        }
      });
      await page.waitForTimeout(1500);
    },
  },
  {
    out: "06_fluorescence.png",
    path: "/fluorescence_phosphorescence_simulation.html",
    selector: "#jabWrap",
    prepare: async (page) => {
      await page.waitForTimeout(3500);
      await page.locator("#exciteBtn").click({ timeout: 10000 });
      await page.waitForTimeout(2500);
    },
  },
];

mkdirSync(OUT, { recursive: true });

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.split("=")[1] : "";
const selectedTargets = only
  ? TARGETS.filter((t) => t.out.includes(only))
  : TARGETS;

if (selectedTargets.length === 0) {
  console.error("No targets matched:", only || "(none)");
  process.exit(1);
}
const server = await startServer(ROOT, PORT);
const base = `http://127.0.0.1:${PORT}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

for (const target of selectedTargets) {
  console.log(`Capturing ${target.out} ...`);
  await page.goto(`${base}${target.path}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(target.selector, { timeout: 30000 });
  await target.prepare(page);
  const el = page.locator(target.selector).first();
  if (target.clipRatio) {
    const box = await el.boundingBox();
    if (box) {
      const ratio = target.clipRatio;
      const insetX = (box.width * (1 - ratio)) / 2;
      const insetY = (box.height * (1 - ratio)) / 2;
      await page.screenshot({
        path: join(OUT, target.out),
        type: "png",
        clip: {
          x: box.x + insetX,
          y: box.y + insetY,
          width: box.width * ratio,
          height: box.height * ratio,
        },
      });
      console.log(`  saved ${target.out}`);
      continue;
    }
  }
  await el.screenshot({
    path: join(OUT, target.out),
    type: "png",
    animations: "disabled",
  });
  console.log(`  saved ${target.out}`);
}

await browser.close();
server.close();
console.log("Done.");
