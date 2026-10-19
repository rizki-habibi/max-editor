import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import crypto from "node:crypto";

const { Pool } = pg;
const app = express();
app.set("etag", false);
app.set("trust proxy", 1); // Railway sits behind a proxy: needed for correct client IPs.
const PORT = Number(process.env.PORT) || 8080;
const PRODUCTION = process.env.NODE_ENV === "production";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});
// An idle client error must not crash the process.
pool.on("error", (e) => console.error("[MAX Editor] idle PostgreSQL client error:", e.message));
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "10mb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ---------------------------------------------------------------- auth
const EDITOR_PASSWORD = process.env.EDITOR_PASSWORD || "";
const EXPLICIT_SECRET = process.env.EDITOR_SESSION_SECRET || process.env.JWT_SECRET || "";
if (!EXPLICIT_SECRET) {
  console.warn("[MAX Editor] EDITOR_SESSION_SECRET belum diatur; memakai rahasia turunan. Atur variabel ini di Railway untuk keamanan lebih baik.");
}
const SESSION_SECRET =
  EXPLICIT_SECRET ||
  crypto.createHash("sha256")
    .update("MAX_EDITOR_SESSION_V1:" + (EDITOR_PASSWORD || process.env.DATABASE_URL || "MAX_EDITOR_LOCAL_SESSION_SECRET"))
    .digest("hex");
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const ADMIN_UID = "max-editor-admin";

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest();
const sign = (body) => crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return body + "." + sign(body);
}
function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* malformed cookie value */ }
  }
  return out;
}
function readSession(req) {
  const token = parseCookies(req.headers.cookie).max_editor_session || "";
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now() || payload.uid !== ADMIN_UID) return null;
    return payload;
  } catch { return null; }
}
const userId = (req) => readSession(req)?.uid || null;
function requireAuth(req, res, next) {
  if (!userId(req)) return res.status(401).json({ error: "Sesi berakhir. Masuk kembali ke MAX Editor." });
  next();
}
const cookieFlags = () => "; HttpOnly; Path=/; SameSite=Lax" + (PRODUCTION ? "; Secure" : "");

// Brute-force protection: 10 failed attempts per IP per 15 minutes.
const LOGIN_WINDOW_MS = 15 * 60 * 1000, LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map();
function loginBlocked(ip) {
  const rec = loginFailures.get(ip);
  if (!rec) return false;
  if (rec.reset < Date.now()) { loginFailures.delete(ip); return false; }
  return rec.count >= LOGIN_MAX_FAILURES;
}
function recordLoginFailure(ip) {
  const now = Date.now();
  const rec = loginFailures.get(ip);
  if (!rec || rec.reset < now) loginFailures.set(ip, { count: 1, reset: now + LOGIN_WINDOW_MS });
  else rec.count++;
  if (loginFailures.size > 5000) for (const [k, v] of loginFailures) if (v.reset < now) loginFailures.delete(k);
}

app.post("/api/auth/login", (req, res) => {
  if (!EDITOR_PASSWORD) return res.status(503).json({ error: "Kata sandi panel belum dikonfigurasi di Railway." });
  const ip = req.ip || "unknown";
  if (loginBlocked(ip)) return res.status(429).json({ error: "Terlalu banyak percobaan masuk. Coba lagi dalam beberapa menit." });
  // Compare digests so neither timing nor length reveals anything about the password.
  if (!crypto.timingSafeEqual(sha256(req.body?.password ?? ""), sha256(EDITOR_PASSWORD))) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: "Kata sandi tidak valid." });
  }
  loginFailures.delete(ip);
  const token = signSession({ uid: ADMIN_UID, exp: Date.now() + SESSION_TTL_MS });
  res.setHeader("Set-Cookie", "max_editor_session=" + encodeURIComponent(token) + cookieFlags() + "; Max-Age=" + SESSION_TTL_MS / 1000);
  res.json({ ok: true, user: { id: ADMIN_UID } });
});
app.get("/api/auth/session", (req, res) => {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: "Belum masuk." });
  res.json({ user: { id: session.uid } });
});
app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "max_editor_session=" + cookieFlags() + "; Max-Age=0");
  res.json({ ok: true });
});

// ---------------------------------------------------------------- database
async function init() {
  await pool.query("CREATE TABLE IF NOT EXISTS editor_workspaces (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'MAX Workspace', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("CREATE TABLE IF NOT EXISTS editor_files (id BIGSERIAL PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES editor_workspaces(id) ON DELETE CASCADE, path TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', language TEXT NOT NULL DEFAULT 'javascript', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(workspace_id,path))");
  await pool.query("CREATE INDEX IF NOT EXISTS editor_workspaces_owner_idx ON editor_workspaces(owner_id)");
  await pool.query("CREATE TABLE IF NOT EXISTS claude_conversations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT 'Percakapan baru', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("CREATE TABLE IF NOT EXISTS claude_messages (id BIGSERIAL PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES claude_conversations(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('user','assistant')), content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("CREATE INDEX IF NOT EXISTS claude_conversations_owner_updated_idx ON claude_conversations(owner_id, updated_at DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS claude_messages_conversation_idx ON claude_messages(conversation_id, id)");
}
// Run fn inside a transaction on ONE dedicated connection. (Issuing BEGIN/COMMIT
// through pool.query() may hit different connections and silently not be a transaction.)
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* connection already gone */ }
    throw e;
  } finally { client.release(); }
}
app.get("/api/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true, service: "MAX Editor", database: "postgres" }); }
  catch (e) { res.status(503).json({ ok: false, database: "error", detail: e.message }); }
});

// ---------------------------------------------------------------- Claude API (official Anthropic Messages API; API key stays server-side)
app.get("/api/claude/conversations", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, created_at, updated_at FROM claude_conversations WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 50",
      [userId(req)],
    );
    res.json({ conversations: result.rows });
  } catch (e) { res.status(500).json({ error: "Gagal memuat riwayat Claude." }); }
});
app.get("/api/claude/conversations/:id", requireAuth, async (req, res) => {
  try {
    const owner = userId(req);
    const conversation = await pool.query("SELECT id FROM claude_conversations WHERE id=$1 AND owner_id=$2", [req.params.id, owner]);
    if (!conversation.rowCount) return res.status(404).json({ error: "Percakapan tidak ditemukan." });
    const result = await pool.query("SELECT role, content, created_at FROM claude_messages WHERE conversation_id=$1 ORDER BY id", [req.params.id]);
    res.json({ messages: result.rows });
  } catch (e) { res.status(400).json({ error: "ID percakapan tidak valid atau riwayat gagal dimuat." }); }
});
app.post("/api/claude/chat", requireAuth, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) return res.status(503).json({ error: "Claude belum dikonfigurasi. Tambahkan ANTHROPIC_API_KEY pada environment server MAX Editor." });
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > 25000) return res.status(400).json({ error: "Pesan wajib diisi dan maksimal 25.000 karakter." });
  const owner = userId(req);
  try {
    let conversationId = req.body?.conversationId || null;
    let conversation;
    if (conversationId) {
      conversation = await pool.query("SELECT id, title FROM claude_conversations WHERE id=$1 AND owner_id=$2", [conversationId, owner]);
      if (!conversation.rowCount) return res.status(404).json({ error: "Percakapan tidak ditemukan." });
    } else {
      conversation = await pool.query(
        "INSERT INTO claude_conversations(owner_id,title) VALUES($1,$2) RETURNING id,title",
        [owner, message.replace(/\s+/g, " ").slice(0, 72) || "Percakapan baru"],
      );
      conversationId = conversation.rows[0].id;
    }
    await pool.query("INSERT INTO claude_messages(conversation_id,role,content) VALUES($1,'user',$2)", [conversationId, message]);
    const history = await pool.query(
      "SELECT role,content FROM (SELECT id,role,content FROM claude_messages WHERE conversation_id=$1 ORDER BY id DESC LIMIT 40) recent ORDER BY id",
      [conversationId],
    );
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514", max_tokens: 4096, messages: history.rows.map(row => ({ role: row.role, content: row.content })) }),
      signal: AbortSignal.timeout(90000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return res.status(status).json({ error: data?.error?.message || "Layanan Claude gagal merespons. Periksa API key, model, dan kuota." });
    }
    const reply = Array.isArray(data.content) ? data.content.filter(item => item.type === "text").map(item => item.text || "").join("\n") : "";
    if (!reply) return res.status(502).json({ error: "Claude tidak mengembalikan teks jawaban." });
    await pool.query("INSERT INTO claude_messages(conversation_id,role,content) VALUES($1,'assistant',$2)", [conversationId, reply]);
    await pool.query("UPDATE claude_conversations SET updated_at=NOW() WHERE id=$1", [conversationId]);
    res.json({ conversationId, reply });
  } catch (e) {
    const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
    res.status(timedOut ? 504 : 502).json({ error: timedOut ? "Permintaan Claude melewati batas waktu 90 detik." : "Gagal memproses percakapan Claude." });
  }
});

// ---------------------------------------------------------------- MAX Router proxy
const ROUTER_BASE = (process.env.MAX_ROUTER_BASE_URL || "https://max-router-production.up.railway.app/v1").replace(/\/+$/, "");
function routerHeaders(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  if (process.env.MAX_ROUTER_API_KEY) h.Authorization = "Bearer " + process.env.MAX_ROUTER_API_KEY;
  return h;
}
const ROUTER_AUTH_ERROR = "Autentikasi MAX Router ditolak. Periksa konfigurasi kunci di Railway; sesi MAX Editor tetap aktif.";
// Forward an upstream response; an upstream 401 becomes 502 so the browser does not think the *editor* session expired.
async function relay(up, res, authMessage = ROUTER_AUTH_ERROR) {
  const body = await up.text();
  const unauthorized = up.status === 401;
  res.status(unauthorized ? 502 : up.status)
    .type(up.headers.get("content-type") || "application/json")
    .send(unauthorized ? JSON.stringify({ error: authMessage }) : body);
}
app.get("/api/router/models", requireAuth, async (_req, res) => {
  try { await relay(await fetch(ROUTER_BASE + "/models", { headers: routerHeaders(false), signal: AbortSignal.timeout(25000) }), res); }
  catch (e) { res.status(502).json({ error: "Tidak dapat mengambil model dari MAX Router.", detail: e.message }); }
});
app.get("/api/router/combos", requireAuth, async (_req, res) => {
  try {
    const origin = new URL(ROUTER_BASE).origin;
    const up = await fetch(origin + "/api/combos", { headers: { ...routerHeaders(false), Accept: "application/json" }, signal: AbortSignal.timeout(25000) });
    await relay(up, res, "MAX Router menolak akses daftar combo. Periksa pengaturan akses API pada Router.");
  } catch (e) { res.status(502).json({ error: "Tidak dapat mengambil combo dari MAX Router.", detail: e.message }); }
});
app.post("/api/router/chat/completions", requireAuth, async (req, res) => {
  try {
    const { model, messages, stream } = req.body || {};
    if (!model || !Array.isArray(messages)) return res.status(400).json({ error: "Pilih model dan isi percakapan terlebih dahulu." });
    const up = await fetch(ROUTER_BASE + "/chat/completions", { method: "POST", headers: routerHeaders(), body: JSON.stringify({ model, messages, stream: stream === true }), signal: AbortSignal.timeout(120000) });
    if (stream === true && up.ok && up.body) {
      res.status(up.status);
      res.setHeader("Content-Type", up.headers.get("content-type") || "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Connection", "keep-alive");
      res.on("close", () => { try { up.body.cancel(); } catch { /* already closed */ } }); // stop pulling upstream when the browser leaves
      for await (const chunk of up.body) { if (res.destroyed) break; res.write(chunk); }
      if (!res.destroyed) res.end();
      return;
    }
    await relay(up, res);
  } catch (e) {
    if (res.headersSent) { res.end(); return; }
    res.status(502).json({
      error: "MAX Router tidak menyelesaikan permintaan sebelum batas waktu atau koneksi upstream terputus.",
      detail: e.name === "TimeoutError" ? "Permintaan MAX Router melewati batas waktu 120 detik. Periksa status penyedia/model di MAX Router." : e.message,
    });
  }
});

// ---------------------------------------------------------------- workspace + files
const MAX_FILES_PER_REQUEST = 2000;
function validFilePath(p) {
  if (typeof p !== "string" || !p || p.length > 300 || p.includes("\0") || p.includes("\\") || p.startsWith("/")) return false;
  return !p.split("/").some((seg) => seg === ".." || seg === "." || seg === "");
}
const languageFor = (p) => (p.endsWith(".md") ? "markdown" : "javascript");
const INITIAL_FILES = [
  ["src/App.js", "export default function hello() {\n  console.log('Hello from MAX Editor');\n}\n"],
  ["src/index.js", "import hello from './App.js';\n\nhello();\n"],
];
async function ownsWorkspace(uid, workspaceId) {
  const r = await pool.query("SELECT 1 FROM editor_workspaces WHERE id=$1 AND owner_id=$2", [workspaceId, uid]);
  return r.rowCount > 0;
}

app.get("/api/editor/workspace", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const data = await withTransaction(async (db) => {
      // The advisory lock stops two simultaneous first loads from creating two workspaces.
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["editor-workspace:" + uid]);
      let w = (await db.query("SELECT * FROM editor_workspaces WHERE owner_id=$1 ORDER BY created_at LIMIT 1", [uid])).rows[0];
      if (!w) w = (await db.query("INSERT INTO editor_workspaces(owner_id,name) VALUES($1,$2) RETURNING *", [uid, "MAX Workspace"])).rows[0];
      let files = (await db.query("SELECT path,content,language,updated_at FROM editor_files WHERE workspace_id=$1 ORDER BY path", [w.id])).rows;
      const defaultReadme = files.find((f) => f.path === "README.md" && /^# MAX Editor\s+Editor coding online berbasis browser\.?\s*$/m.test(f.content));
      if (defaultReadme) {
        await db.query("DELETE FROM editor_files WHERE workspace_id=$1 AND path=$2", [w.id, "README.md"]);
        files = files.filter((f) => f.path !== "README.md");
      }
      if (!files.length) {
        for (const [p, c] of INITIAL_FILES) await db.query("INSERT INTO editor_files(workspace_id,path,content,language) VALUES($1,$2,$3,$4)", [w.id, p, c, languageFor(p)]);
        files = INITIAL_FILES.map(([p, c]) => ({ path: p, content: c, language: languageFor(p) }));
      }
      return { workspace: w, files };
    });
    res.json(data);
  } catch (e) { res.status(500).json({ error: "Gagal memuat workspace PostgreSQL.", detail: e.message }); }
});

app.put("/api/editor/files", requireAuth, async (req, res) => {
  try {
    const { workspaceId, files } = req.body || {};
    if (!workspaceId || !Array.isArray(files)) return res.status(400).json({ error: "workspaceId dan files wajib diisi." });
    if (files.length > MAX_FILES_PER_REQUEST) return res.status(413).json({ error: "Terlalu banyak file dalam satu permintaan (maks " + MAX_FILES_PER_REQUEST + ")." });
    const bad = files.find((f) => !validFilePath(f?.path));
    if (bad) return res.status(400).json({ error: "Path file tidak valid: " + String(bad?.path).slice(0, 80) });
    if (!(await ownsWorkspace(userId(req), workspaceId))) return res.status(403).json({ error: "Workspace tidak valid." });
    await withTransaction(async (db) => {
      for (const f of files) {
        await db.query(
          "INSERT INTO editor_files(workspace_id,path,content,language) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,path) DO UPDATE SET content=EXCLUDED.content,language=EXCLUDED.language,updated_at=NOW()",
          [workspaceId, f.path, String(f.content ?? ""), String(f.language || "javascript")],
        );
      }
    });
    res.json({ ok: true, count: files.length, database: "postgres" });
  } catch (e) { res.status(500).json({ error: "Gagal menyimpan file PostgreSQL.", detail: e.message }); }
});

app.delete("/api/editor/files", requireAuth, async (req, res) => {
  try {
    const { workspaceId, paths } = req.body || {};
    if (!workspaceId || !Array.isArray(paths) || !paths.every(validFilePath)) return res.status(400).json({ error: "workspaceId dan paths yang valid wajib diisi." });
    if (!(await ownsWorkspace(userId(req), workspaceId))) return res.status(403).json({ error: "Workspace tidak valid." });
    const r = await pool.query("DELETE FROM editor_files WHERE workspace_id=$1 AND path = ANY($2::text[])", [workspaceId, paths]);
    res.json({ ok: true, deleted: r.rowCount });
  } catch (e) { res.status(500).json({ error: "Gagal menghapus file PostgreSQL.", detail: e.message }); }
});

// ---------------------------------------------------------------- static app
const DIST = path.join(__dirname, "dist");
app.use(express.static(DIST, {
  setHeaders(res, filePath) {
    // version.json drives the auto-update check and index.html points at the current bundle: never cache them.
    if (/(version\.json|index\.html)$/.test(filePath)) res.setHeader("Cache-Control", "no-store");
    else if (filePath.includes(path.sep + "assets" + path.sep)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  },
}));
// Unknown /api routes must answer JSON, not the SPA shell (clients call response.json()).
app.all("/api/{*splat}", (_req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan." }));
app.get("/{*splat}", (_req, res) => res.sendFile(path.join(DIST, "index.html")));

init()
  .then(() => app.listen(PORT, "0.0.0.0", () => console.log("[MAX Editor] PostgreSQL + web listening on " + PORT)))
  .catch((e) => { console.error(e); process.exit(1); });
