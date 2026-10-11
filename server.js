import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import crypto from "node:crypto";
const { Pool } = pg;
const app=express();
const PORT=Number(process.env.PORT)||8080;
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const __dirname=path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({limit:"10mb"}));

const EDITOR_PASSWORD=process.env.EDITOR_PASSWORD||"";
const SESSION_SECRET=process.env.EDITOR_SESSION_SECRET||process.env.JWT_SECRET||crypto.randomBytes(32).toString("hex");
function signSession(payload){const body=Buffer.from(JSON.stringify(payload)).toString("base64url");const sig=crypto.createHmac("sha256",SESSION_SECRET).update(body).digest("base64url");return body+"."+sig;}
function readSession(req){
 const cookies=Object.fromEntries((req.headers.cookie||"").split(";").map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf("=");return [v.slice(0,i),decodeURIComponent(v.slice(i+1))]}));
 const token=cookies.max_editor_session||"";const [body,sig]=token.split(".");
 if(!body||!sig)return null;
 const expected=crypto.createHmac("sha256",SESSION_SECRET).update(body).digest("base64url");
 const a=Buffer.from(sig),b=Buffer.from(expected);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
 try{const payload=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));if(!payload.exp||payload.exp<Date.now()||payload.uid!=="max-editor-admin")return null;return payload;}catch{return null;}
}
function userId(req){return readSession(req)?.uid||null;}
function requireAuth(req,res,next){if(!userId(req))return res.status(401).json({error:"Sesi berakhir. Masuk kembali ke MAX Editor."});next();}
app.post("/api/auth/login",(req,res)=>{
 if(!EDITOR_PASSWORD)return res.status(503).json({error:"Kata sandi panel belum dikonfigurasi di Railway."});
 const submitted=String(req.body?.password||"");
 const a=Buffer.from(submitted),b=Buffer.from(EDITOR_PASSWORD);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:"Kata sandi tidak valid."});
 const token=signSession({uid:"max-editor-admin",exp:Date.now()+12*60*60*1000});
 res.setHeader("Set-Cookie","max_editor_session="+encodeURIComponent(token)+"; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200"+(process.env.NODE_ENV==="production"?"; Secure":""));
 res.json({ok:true,user:{id:"max-editor-admin"}});
});
app.get("/api/auth/session",(req,res)=>{const session=readSession(req);if(!session)return res.status(401).json({error:"Belum masuk."});res.json({user:{id:session.uid}});});
app.post("/api/auth/logout",(req,res)=>{res.setHeader("Set-Cookie","max_editor_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"+(process.env.NODE_ENV==="production"?"; Secure":""));res.json({ok:true});});

async function init(){
 await pool.query("CREATE TABLE IF NOT EXISTS editor_workspaces (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'MAX Workspace', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
 await pool.query("CREATE TABLE IF NOT EXISTS editor_files (id BIGSERIAL PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES editor_workspaces(id) ON DELETE CASCADE, path TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', language TEXT NOT NULL DEFAULT 'javascript', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(workspace_id,path))");
 await pool.query("CREATE INDEX IF NOT EXISTS editor_workspaces_owner_idx ON editor_workspaces(owner_id)");
}
app.get("/api/health",async(_req,res)=>{try{await pool.query("SELECT 1");res.json({ok:true,service:"MAX Editor",database:"postgres"});}catch(e){res.status(503).json({ok:false,database:"error",detail:e.message});}});

const ROUTER_BASE=(process.env.MAX_ROUTER_BASE_URL||"https://max-router-production.up.railway.app/v1").replace(/\/+$/,"");
function routerHeaders(json=true){const h={};if(json)h["Content-Type"]="application/json";if(process.env.MAX_ROUTER_API_KEY)h.Authorization="Bearer "+process.env.MAX_ROUTER_API_KEY;return h;}
app.get("/api/router/models",requireAuth,async(_req,res)=>{try{const up=await fetch(ROUTER_BASE+"/models",{headers:routerHeaders(false),signal:AbortSignal.timeout(25000)});const body=await up.text();res.status(up.status).type(up.headers.get("content-type")||"application/json").send(body);}catch(e){res.status(502).json({error:"Tidak dapat mengambil model dari MAX Router.",detail:e.message});}});
app.post("/api/router/chat/completions",requireAuth,async(req,res)=>{try{const {model,messages}=req.body||{};if(!model||!Array.isArray(messages))return res.status(400).json({error:"Pilih model dan isi percakapan terlebih dahulu."});const up=await fetch(ROUTER_BASE+"/chat/completions",{method:"POST",headers:routerHeaders(),body:JSON.stringify({model,messages,stream:false}),signal:AbortSignal.timeout(120000)});const body=await up.text();res.status(up.status).type(up.headers.get("content-type")||"application/json").send(body);}catch(e){res.status(502).json({error:"Koneksi MAX Router gagal.",detail:e.message});}});

app.get("/api/editor/workspace",requireAuth,async(req,res)=>{try{const uid=userId(req);let w=(await pool.query("SELECT * FROM editor_workspaces WHERE owner_id=$1 ORDER BY created_at LIMIT 1",[uid])).rows[0];if(!w) w=(await pool.query("INSERT INTO editor_workspaces(owner_id,name) VALUES($1,$2) RETURNING *",[uid,"MAX Workspace"])).rows[0];const files=(await pool.query("SELECT path,content,language,updated_at FROM editor_files WHERE workspace_id=$1 ORDER BY path",[w.id])).rows;if(!files.length){const initial=[["README.md","# MAX Editor\n\nEditor coding online berbasis browser.\n"],["src/App.js","export default function hello() {\n  console.log('Hello from MAX Editor');\n}\n"],["src/index.js","import hello from './App.js';\n\nhello();\n"]];for(const [p,c] of initial) await pool.query("INSERT INTO editor_files(workspace_id,path,content,language) VALUES($1,$2,$3,$4)",[w.id,p,c,p.endsWith(".md")?"markdown":"javascript"]);return res.json({workspace:w,files:initial.map(([path,content])=>({path,content,language:path.endsWith(".md")?"markdown":"javascript"}))});}res.json({workspace:w,files});}catch(e){res.status(500).json({error:"Gagal memuat workspace PostgreSQL.",detail:e.message});}});
app.put("/api/editor/files",requireAuth,async(req,res)=>{try{const uid=userId(req),{workspaceId,files}=req.body||{};if(!workspaceId||!Array.isArray(files))return res.status(400).json({error:"workspaceId dan files wajib diisi."});const owner=await pool.query("SELECT id FROM editor_workspaces WHERE id=$1 AND owner_id=$2",[workspaceId,uid]);if(!owner.rowCount)return res.status(403).json({error:"Workspace tidak valid."});await pool.query("BEGIN");for(const f of files){await pool.query("INSERT INTO editor_files(workspace_id,path,content,language) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,path) DO UPDATE SET content=EXCLUDED.content,language=EXCLUDED.language,updated_at=NOW()",[workspaceId,String(f.path),String(f.content??""),String(f.language||"javascript")]);}await pool.query("COMMIT");res.json({ok:true,count:files.length,database:"postgres"});}catch(e){try{await pool.query("ROLLBACK")}catch{}res.status(500).json({error:"Gagal menyimpan file PostgreSQL.",detail:e.message});}});
app.use(express.static(path.join(__dirname,"dist")));
app.get("/{*splat}",(req,res)=>res.sendFile(path.join(__dirname,"dist","index.html")));
init().then(()=>app.listen(PORT,"0.0.0.0",()=>console.log("[MAX Editor] PostgreSQL + web listening on "+PORT))).catch(e=>{console.error(e);process.exit(1);});
