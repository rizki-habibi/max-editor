import {useEffect,useRef,useState} from "react";
import {AlertTriangle,CheckCircle2,Download,GitBranch,GitCommit,Github,RefreshCw,X} from "lucide-react";

export default function GitWorkspace(){
  const [open,setOpen]=useState(false);
  const [repoPath,setRepoPath]=useState("");
  const [status,setStatus]=useState("Belum diperiksa");
  const [branch,setBranch]=useState("");
  const [remote,setRemote]=useState("");
  const [changes,setChanges]=useState([]);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [repoName,setRepoName]=useState("");
  const [visibility,setVisibility]=useState("private");
  const [busy,setBusy]=useState(false);
  const socket=useRef(null);
  function connect(){return new Promise((resolve,reject)=>{if(socket.current?.readyState===WebSocket.OPEN)return resolve();const ws=new WebSocket("ws://127.0.0.1:8765");socket.current=ws;ws.onopen=()=>resolve();ws.onerror=()=>reject(new Error("Local Agent belum terhubung. Jalankan local-agent di Windows."));ws.onclose=()=>{socket.current=null};});}
  function execLocal(command){return new Promise((resolve,reject)=>{const ws=socket.current;if(!ws||ws.readyState!==WebSocket.OPEN)return reject(new Error("Local Agent belum terhubung."));const timer=setTimeout(()=>reject(new Error("Perintah timeout.")),30000);const handler=e=>{try{const data=JSON.parse(e.data);if(data.type==="result"){clearTimeout(timer);ws.removeEventListener("message",handler);resolve(data)}}catch{}};ws.addEventListener("message",handler);ws.send(JSON.stringify({type:"exec",command,cwd:repoPath||undefined}));});}
  async function refresh(){if(!repoPath.trim())return setError("Isi folder proyek lokal.");setBusy(true);setError("");try{await connect();const r=await execLocal("git status --short --branch");const lines=(r.stdout||"").split(/\r?\n/).filter(Boolean);const branchLine=lines.find(x=>x.startsWith("##"));setStatus(branchLine?.replace(/^##\s*/,"")||"Working tree");setChanges(lines.filter(x=>/^\s*(M|A|D|R|\?\?)/.test(x)));const b=await execLocal("git branch --show-current");setBranch((b.stdout||"").trim());const rem=await execLocal("git remote get-url origin");setRemote((rem.stdout||"").trim());if(r.code!==0)setError(r.stderr||"Folder ini belum menjadi Git repository.")}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function pull(){setBusy(true);setError("");try{await connect();const r=await execLocal("git pull --ff-only");if(r.code!==0)setError(r.stderr||r.stdout||"Pull gagal");else await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function check(){setBusy(true);setError("");try{await connect();const r=await execLocal("npm run check");if(r.code===0)setStatus("✓ Pemeriksaan berhasil");else setError((r.stderr||r.stdout||"Pemeriksaan gagal").slice(-6000))}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function commitPush(){if(!message.trim())return setError("Tulis pesan commit.");setBusy(true);setError("");try{await connect();const safe=message.trim().replaceAll('"','\\\"');const r=await execLocal('git add -A && git commit -m "'+safe+'" && git push');if(r.code!==0)setError(r.stderr||r.stdout||"Commit & Push gagal");else{setMessage("");setStatus("✓ Commit & Push berhasil");await refresh()}}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function createRepo(){if(!/^[A-Za-z0-9._-]+$/.test(repoName.trim()))return setError("Nama repository tidak valid.");if(!repoPath.trim())return setError("Isi folder proyek lokal.");setBusy(true);setError("");try{await connect();const init=await execLocal("git rev-parse --is-inside-work-tree");if(init.code!==0){const r=await execLocal("git init -b main");if(r.code!==0)throw new Error(r.stderr||"Git init gagal")}const r=await execLocal("gh repo create "+repoName.trim()+" --"+visibility+" --source=. --remote=origin --push");if(r.code!==0)throw new Error(r.stderr||r.stdout||"GitHub CLI gagal membuat repository");setRepoName("");await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}}
  useEffect(()=>()=>socket.current?.close(),[]);
  return <div className="git-workspace"><button className="git-toolbar-button" title="Git Workspace" onClick={()=>setOpen(true)}><GitBranch size={16}/></button>{open&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><div className="router-modal git-modal">
    <div className="router-modal-head"><strong>Git Workspace</strong><button onClick={()=>setOpen(false)}><X size={18}/></button></div>
    <p>Satu tempat untuk melihat perubahan, error, Pull, Commit, Push, dan membuat repository GitHub baru.</p>
    <label>Folder proyek lokal<input value={repoPath} onChange={e=>setRepoPath(e.target.value)} placeholder="C:\\Projects\\nama-proyek"/></label>
    <div className="git-summary"><div><span>Status</span><strong>{status}</strong></div><div><span>Branch</span><strong>{branch||"—"}</strong></div></div>
    <div className="git-remote">{remote||"Remote origin belum terdeteksi"}</div>
    <div className="git-actions"><button onClick={refresh} disabled={busy}><RefreshCw size={13}/> Refresh</button><button onClick={pull} disabled={busy}><Download size={13}/> Pull</button><button onClick={check} disabled={busy}><CheckCircle2 size={13}/> Periksa</button></div>
    <div className="git-changes"><strong>Perubahan {changes.length ? "("+changes.length+")" : ""}</strong>{changes.length?changes.map((x,i)=><div className="git-change" key={i}><GitBranch size={12}/><span>{x}</span></div>):<small>Tidak ada perubahan terdeteksi.</small>}</div>
    <label>Pesan commit<input value={message} onChange={e=>setMessage(e.target.value)} placeholder="contoh: perbaiki koneksi Max Router"/></label>
    <button className="primary wide" onClick={commitPush} disabled={busy}><GitCommit size={14}/> Commit & Push</button>
    <div className="git-create"><strong>Buat repository baru</strong><input value={repoName} onChange={e=>setRepoName(e.target.value)} placeholder="nama-repository"/><select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="private">Private</option><option value="public">Public</option></select><button className="wide" onClick={createRepo} disabled={busy}><Github size={14}/> Buat & Push ke GitHub</button></div>
    {error&&<div className="git-error"><AlertTriangle size={14}/><pre>{error}</pre></div>}
  </div></div>}</div>;
}