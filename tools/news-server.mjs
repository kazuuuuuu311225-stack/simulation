/**
 * physLabo NEWS — ローカル管理サーバー
 * 用法: node tools/news-server.mjs
 * ブラウザ: http://localhost:8790/00_physLabo_top.html
 * 管理:     http://localhost:8790/admin/news.html
 */
import http from "http";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEWS_PATH = path.join(ROOT, "data", "news.json");
const NEWS_DATA_JS = path.join(ROOT, "assets", "js", "news-data.js");
const NEWS_IMAGES_DIR = path.join(ROOT, "data", "news-images");
const ADMIN_PATH = path.join(ROOT, "data", "news-admin.json");
const ADMIN_EXAMPLE = path.join(ROOT, "data", "news-admin.example.json");
const PORT = Number(process.env.NEWS_PORT || 8790);
const HOST = process.env.NEWS_HOST || "127.0.0.1";
const API_VERSION = 2;

const MIRROR_ROOTS = resolveMirrorRoots();

const sessions = new Map();
const SESSION_MS = 12 * 60 * 60 * 1000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body ?? "", "utf8");
  res.writeHead(status, {
    "Content-Length": buf.length,
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(buf);
}

function json(res, status, obj, headers = {}) {
  send(res, status, JSON.stringify(obj), {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

function resolveMirrorRoots() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    process.env.NEWS_MIRROR,
    home ? path.join(home, "Desktop", "hyakumasu-calc", "projectile-sim") : "",
    home ? path.join(home, "hyakumasu-calc", "projectile-sim") : "",
  ]
    .filter(Boolean)
    .map((p) => path.resolve(String(p)));
  const seen = new Set([ROOT]);
  return candidates.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

async function writeNewsToRoot(root, payload) {
  const newsPath = path.join(root, "data", "news.json");
  const dataJs = path.join(root, "assets", "js", "news-data.js");
  await fs.mkdir(path.dirname(newsPath), { recursive: true });
  await fs.writeFile(newsPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  const js = "window.__PHYSLABO_NEWS__=" + JSON.stringify(payload) + ";\n";
  await fs.mkdir(path.dirname(dataJs), { recursive: true });
  await fs.writeFile(dataJs, js, "utf8");
}

async function writeNewsPayload(payload) {
  await writeNewsToRoot(ROOT, payload);
  for (const mirror of MIRROR_ROOTS) {
    try {
      await fs.access(mirror);
      await writeNewsToRoot(mirror, payload);
      console.log("[news-server] mirrored:", mirror);
    } catch {
      /* mirror path not present */
    }
  }
}

async function writeNewsDataJs(payload) {
  await writeNewsPayload(payload);
}

async function writeImageToRoot(root, stored, bin) {
  const dir = path.join(root, "data", "news-images");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, stored), bin);
}

async function writeImageFile(stored, bin) {
  await writeImageToRoot(ROOT, stored, bin);
  for (const mirror of MIRROR_ROOTS) {
    try {
      await fs.access(mirror);
      await writeImageToRoot(mirror, stored, bin);
    } catch {
      /* skip */
    }
  }
}

async function syncNewsEmbed() {
  const news = await readJson(NEWS_PATH, { updatedAt: null, items: [] });
  await writeNewsDataJs(news);
}

function sanitizeNewsImagePath(value) {
  const src = String(value || "").trim().replace(/\\/g, "/");
  if (!src) return "";
  if (/^data\/news-images\/[a-zA-Z0-9._-]+$/.test(src)) return src;
  return "";
}

function safeUploadName(name) {
  const base = path.basename(String(name || "image.jpg"));
  const extMatch = base.match(/\.(jpe?g|png|webp|gif)$/i);
  if (!extMatch) return null;
  let ext = extMatch[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  return "image." + ext;
}

async function loadAdminConfig() {
  let cfg = await readJson(ADMIN_PATH, null);
  if (cfg && cfg.id && cfg.password) return cfg;
  const ex = await readJson(ADMIN_EXAMPLE, null);
  if (ex && ex.id && ex.password && !/ここに/.test(ex.password)) {
    await fs.writeFile(ADMIN_PATH, JSON.stringify(ex, null, 2) + "\n", "utf8");
    return ex;
  }
  const bootstrap = { id: "admin", password: "admin123" };
  await fs.writeFile(ADMIN_PATH, JSON.stringify(bootstrap, null, 2) + "\n", "utf8");
  console.warn("[news-server] data/news-admin.json を新規作成しました (id: admin / password: admin123)");
  console.warn("[news-server] 必ずパスワードを変更してください。");
  return bootstrap;
}

function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

function getBearer(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}

function isSessionValid(token) {
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp || exp < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  return JSON.parse(raw);
}

function safePath(urlPath) {
  const dec = decodeURIComponent(urlPath.split("?")[0]);
  const rel = dec.replace(/^\/+/, "");
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(ROOT)) return null;
  return abs;
}

async function serveStatic(req, res, urlPath) {
  let filePath = safePath(urlPath);
  if (!filePath) return send(res, 403, "Forbidden");

  try {
    let st = await fs.stat(filePath);
    if (st.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      st = await fs.stat(filePath);
    }
    const ext = path.extname(filePath).toLowerCase();
    const data = await fs.readFile(filePath);
    send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream" });
  } catch {
    send(res, 404, "Not Found");
  }
}

async function handleApi(req, res, url) {
  const origin = req.headers.origin || "*";

  if (req.method === "OPTIONS") {
    send(res, 204, "", cors(origin));
    return;
  }

  if (url.pathname === "/api/news/login" && req.method === "POST") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { error: "invalid_json" }, cors(origin));
    }
    const cfg = await loadAdminConfig();
    if (!body || body.id !== cfg.id || body.password !== cfg.password) {
      return json(res, 401, { error: "invalid_credentials" }, cors(origin));
    }
    const token = newToken();
    sessions.set(token, Date.now() + SESSION_MS);
    return json(res, 200, { token, expiresIn: SESSION_MS }, cors(origin));
  }

  if (url.pathname === "/api/news" && req.method === "GET") {
    const news = await readJson(NEWS_PATH, { updatedAt: null, items: [] });
    return json(res, 200, news, cors(origin));
  }

  if (url.pathname === "/api/news" && req.method === "PUT") {
    const token = getBearer(req);
    if (!isSessionValid(token)) {
      return json(res, 401, { error: "unauthorized" }, cors(origin));
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { error: "invalid_json" }, cors(origin));
    }
    if (!body || !Array.isArray(body.items)) {
      return json(res, 400, { error: "items_required" }, cors(origin));
    }
    const payload = {
      updatedAt: new Date().toISOString(),
      items: body.items.map((it) => ({
        id: String(it.id || ""),
        date: String(it.date || "").slice(0, 10),
        title: String(it.title || "").trim(),
        body: String(it.body || ""),
        image: sanitizeNewsImagePath(it.image),
        published: it.published !== false,
      })).filter((it) => it.id && it.title),
    };
    await writeNewsPayload(payload);
    return json(res, 200, { ok: true, updatedAt: payload.updatedAt, count: payload.items.length }, cors(origin));
  }

  if (url.pathname === "/api/news/upload" && req.method === "POST") {
    const token = getBearer(req);
    if (!isSessionValid(token)) {
      return json(res, 401, { error: "unauthorized" }, cors(origin));
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { error: "invalid_json" }, cors(origin));
    }
    const safeName = safeUploadName(body && body.filename);
    const raw = body && body.data ? String(body.data) : "";
    if (!safeName || !raw) {
      return json(res, 400, { error: "invalid_upload" }, cors(origin));
    }
    let bin;
    try {
      bin = Buffer.from(raw, "base64");
    } catch {
      return json(res, 400, { error: "invalid_base64" }, cors(origin));
    }
    if (!bin.length || bin.length > 5 * 1024 * 1024) {
      return json(res, 400, { error: "file_too_large" }, cors(origin));
    }
    const stored = Date.now().toString(36) + "-" + safeName;
    await writeImageFile(stored, bin);
    const rel = "data/news-images/" + stored;
    return json(res, 200, { ok: true, path: rel }, cors(origin));
  }

  if (url.pathname === "/api/news/session" && req.method === "GET") {
    const token = getBearer(req);
    return json(res, 200, { ok: isSessionValid(token) }, cors(origin));
  }

  if (url.pathname === "/api/news/status" && req.method === "GET") {
    return json(res, 200, { version: API_VERSION, upload: true }, cors(origin));
  }

  json(res, 404, { error: "not_found" }, cors(origin));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    return handleApi(req, res, url);
  }

  if (url.pathname === "/" || url.pathname === "") {
    res.writeHead(302, { Location: "/00_physLabo_top.html" });
    return res.end();
  }

  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, async () => {
  try {
    await syncNewsEmbed();
  } catch (err) {
    console.warn("[news-server] news-data.js の同期に失敗:", err.message);
  }
  console.log(`physLabo NEWS server v${API_VERSION}: http://${HOST}:${PORT}/00_physLabo_top.html`);
  console.log(`管理画面: http://${HOST}:${PORT}/admin/news.html`);
  console.log(`データ保存先: ${ROOT}`);
  if (MIRROR_ROOTS.length) {
    console.log(`ミラー先: ${MIRROR_ROOTS.join(", ")}`);
  }
});
