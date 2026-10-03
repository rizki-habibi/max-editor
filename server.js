import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
const { Pool } = pg;
const app=express();
const PORT=Number(process.env.PORT)||8080;
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const __dirname=path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({limit:"10mb"}));
function userId(req){return req.headers["x-user-id"]||"anonymous";}
async function init(){
 await pool.query("CREATE TABLE IF NOT EXISTS editor_workspaces (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'MAX Workspace', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
 await pool.query("CREATE TABLE IF NOT EXISTS editor_files (id BIGSERIAL PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES editor_workspaces(id) ON DELETE CASCADE, path TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', language TEXT NOT NULL DEFAULT 'javascript', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(workspace_id,path))");
 await pool.query("CREATE INDEX IF NOT EXISTS editor_workspaces_owner_idx ON editor_workspaces(owner_id)");
}
app.get("/api/health",async(_req,res)=>{try{await pool.query("SELECT 1");res.json({ok:true,service:"MAX Editor",database:"postgres"});}catch(e){res.status(503).json({ok:false,database:"error",detail:e.message});}});
app.get("/api/editor/workspace",async(req,res)=>{try{const uid=userId(req);let w=(await pool.query("SELECT * FROM editor_workspaces WHERE owner_id=$1 ORDER BY created_at LIMIT 1",[uid])).rows[0];if(!w) w=(await pool.query("INSERT INTO editor_workspaces(owner_id,name) VALUES($1,$2) RETURNING *",[uid,"MAX Workspace"])).rows[0];const files=(await pool.query("SELECT path,content,language,updated_at FROM editor_files WHERE workspace_id=$1 ORDER BY path",[w.id])).rows;if(!files.length){const initial=[["README.md","# MAX Editor\n\nEditor coding online berbasis browser.\n"],["src/App.js","export default function hello() {\n  console.log('Hello from MAX Editor');\n}\n"],["src/index.js","import hello from './App.js';\n\nhello();\n"]];for(const [p,c] of initial) await pool.query("INSERT INTO editor_files(workspace_id,path,content,language) VALUES($1,$2,$3,$4)",[w.id,p,c,p.endsWith(".md")?"markdown":"javascript"]);return res.json({workspace:w,files:initial.map(([path,content])=>({path,content,language:path.endsWith(".md")?"markdown":"javascript"}))});}res.json({workspace:w,files});}catch(e){res.status(500).json({error:"Gagal memuat workspace PostgreSQL.",detail:e.message});}});
app.put("/api/editor/files",async(req,res)=>{try{const uid=userId(req),{workspaceId,files}=req.body||{};if(!workspaceId||!Array.isArray(files))return res.status(400).json({error:"workspaceId dan files wajib diisi."});const owner=await pool.query("SELECT id FROM editor_workspaces WHERE id=$1 AND owner_id=$2",[workspaceId,uid]);if(!owner.rowCount)return res.status(403).json({error:"Workspace tidak valid."});await pool.query("BEGIN");for(const f of files){await pool.query("INSERT INTO editor_files(workspace_id,path,content,language) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,path) DO UPDATE SET content=EXCLUDED.content,language=EXCLUDED.language,updated_at=NOW()",[workspaceId,String(f.path),String(f.content??""),String(f.language||"javascript")]);}await pool.query("COMMIT");res.json({ok:true,count:files.length,database:"postgres"});}catch(e){try{await pool.query("ROLLBACK")}catch{}res.status(500).json({error:"Gagal menyimpan file PostgreSQL.",detail:e.message});}});
app.use(express.static(path.join(__dirname,"dist")));
app.get("/{*splat}",(req,res)=>res.sendFile(path.join(__dirname,"dist","index.html")));
init().then(()=>app.listen(PORT,"0.0.0.0",()=>console.log("[MAX Editor] PostgreSQL + web listening on "+PORT))).catch(e=>{console.error(e);process.exit(1);});
