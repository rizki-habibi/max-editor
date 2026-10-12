import {useEffect,useMemo,useRef,useState} from "react";
import Editor from "@monaco-editor/react";
import {FileCode2,FileText,FileJson,FileImage,FileSpreadsheet,FileType,File as FileIcon,Code2,Database,Folder,FolderOpen,GitBranch,Play,Plus,Search,Settings,Terminal,ChevronDown,MessageSquare,Cloud,Save,LogIn,LogOut,Github,FolderInput,PlugZap,X,RefreshCw,GitCommit,Download,AlertTriangle,CheckCircle2,CircleDot,Send,Paperclip,Trash2,Sparkles,PanelLeftClose,PanelRightClose,Hash,SlidersHorizontal,AtSign,SquarePen} from "lucide-react";
import {loadWorkspace,saveFiles} from "./lib/editorDb";
import {chatWithRouter,getRouterConfig,listRouterCombos,listRouterModels,saveRouterConfig} from "./lib/maxRouter";
import GitWorkspace from "./components/GitWorkspace";
import DocumentsPanel from "./components/DocumentsPanel";

const initialFiles={
  "src/App.js": `export default function hello() {
  console.log('Hello from MAX Editor');
}
`,
  "src/index.js": `import hello from './App.js';

hello();
`
};

function getFileIcon(name) {
  const ext = String(name).split(".").pop().toLowerCase();
  if (["js","jsx","ts","tsx","mjs","cjs"].includes(ext)) return {Icon:Code2,kind:"javascript"};
  if (["html","htm","xml","svg"].includes(ext)) return {Icon:FileCode2,kind:"html"};
  if (["css","scss","sass","less"].includes(ext)) return {Icon:FileType,kind:"style"};
  if (["json","jsonc"].includes(ext)) return {Icon:FileJson,kind:"json"};
  if (["md","mdx","txt","rst"].includes(ext)) return {Icon:FileText,kind:"text"};
  if (["png","jpg","jpeg","gif","webp","ico","bmp"].includes(ext)) return {Icon:FileImage,kind:"image"};
  if (["csv","xls","xlsx"].includes(ext)) return {Icon:FileSpreadsheet,kind:"data"};
  if (["sql","db"].includes(ext)) return {Icon:Database,kind:"database"};
  if (["py","java","c","cpp","h","go","rs","php","rb"].includes(ext)) return {Icon:FileCode2,kind:"code"};
  if (["yml","yaml","toml","ini","env"].includes(ext)) return {Icon:Settings,kind:"config"};
  if (["sh","bash","ps1","bat","cmd"].includes(ext)) return {Icon:Terminal,kind:"terminal"};
  return {Icon:FileIcon,kind:"default"};
}

function FileIconForTab({name}) {
  const {Icon,kind}=getFileIcon(name);
  return <Icon className={`file-icon icon-${kind}`} size={14} strokeWidth={2}/>;
}

function FileItem({name,active,onClick,folder=false}) {
  const file = folder ? {Icon:Folder,kind:"folder"} : getFileIcon(name);
  const Icon = file.Icon;
  return <button className={`file-item ${active?"active":""}`} onClick={onClick} title={name}>
    <Icon className={`file-icon icon-${file.kind}`} size={16} strokeWidth={2}/>
    <span>{name.split("/").pop()}</span>
  </button>
}

function CloudAuth({onSession}){
 const [password,setPassword]=useState("");
 const [msg,setMsg]=useState("");
 const [loading,setLoading]=useState(false);
 async function go(e){
  e.preventDefault();setMsg("");setLoading(true);
  try{
   const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({password})});
   const data=await r.json();
   if(!r.ok)throw new Error(data.error||"Kata sandi tidak valid.");
   onSession({user:{id:data.user.id},access_token:"cookie-session"});
  }catch(error){setMsg(error.message||"Gagal masuk.");}
  finally{setLoading(false);}
 }
 return <div className="auth-screen">
  <div className="comic-orbit orbit-a"></div><div className="comic-orbit orbit-b"></div><div className="auth-spark spark-a">✦</div><div className="auth-spark spark-b">★</div>
  <div className="auth-wrap">
   <section className="auth-hero"><div className="hero-kicker">DUNIA MAX <span>01</span></div><div className="hero-logo"><img src="/max-editor-logo.svg" alt="Logo MAX Editor"/></div><div className="hero-bubble"><strong>HAI, PEMBUAT KODE!</strong><span>Masuk sekali. Workspace tetap tersimpan di cloud.</span></div><div className="hero-title">KODE.<br/><em>BUAT.</em><br/>MAX.</div><div className="hero-caption">Monaco Editor · PostgreSQL Cloud · MAX AI</div><div className="hero-lines"></div></section>
   <form className="auth-card" onSubmit={go}>
    <input type="text" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" hidden />
    <div className="auth-card-top"><span className="panel-tag">AKSES PANEL</span><span className="panel-dots">● ● ●</span></div>
    <div className="auth-card-icon"><LogIn size={20}/></div>
    <h1>Masuk ke MAX Editor</h1><p>Masukkan kata sandi panel untuk membuka workspace.</p>
    <label>Kata sandi<input type="password" placeholder="Masukkan kata sandi" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required autoFocus/></label>
    {msg&&<div className="auth-message">{msg}</div>}
    <button className="auth-submit" type="submit" disabled={loading}><LogIn size={17}/>{loading?"Memeriksa...":"Masuk"}<span>→</span></button>
    <div className="auth-foot"><span>● Ruang kerja cloud</span><span>● Sesi aman</span></div>
   </form>
  </div>
  <div className="comic-note">BANGUN<br/><strong>DUNIAMU</strong></div>
 </div>
}
function ComboVisual({routerConfig,routerCombos,routerModels,setModelDetail,setRouterConfig,saveRouterConfig,setRouterStatus}) {
 const selectedCombo=routerCombos.find(item=>item.name===routerConfig.model);
 const comboModels=selectedCombo?.models||[];
 return <section className="combo-visual" aria-label="Susunan model combo">
  <div className="combo-visual-head"><span><GitBranch size={13}/> Alur model combo</span><strong>{comboModels.length} model</strong></div>
  {comboModels.length>0 ? <ol className="combo-model-list">{comboModels.map((model,index)=>{
   const modelName=typeof model==="string"?model:(model?.id||model?.name||String(model));
   return <li key={modelName+"-"+index} className={routerConfig.selectionType==="individual"&&routerConfig.model===modelName?"is-primary":""}>
    <button type="button" className="combo-model-pick" onClick={()=>{const detail=routerModels.find(item=>item.id===modelName)||{id:modelName};setModelDetail(detail);}} title={"Lihat detail "+modelName}>
     <span className="combo-model-index">{String(index+1).padStart(2,"0")}</span><span className="combo-model-name" title={modelName}>{modelName}</span><span className="combo-model-open"><Sparkles size={12}/></span>
    </button>
    <button type="button" className="combo-model-primary" onClick={()=>{const next={...routerConfig,selectionType:"individual",model:modelName};setRouterConfig(next);saveRouterConfig(next);setRouterStatus("Model utama diubah ke "+modelName);}} title="Jadikan model utama" aria-label={"Jadikan "+modelName+" model utama"}><CheckCircle2 size={13}/></button>
   </li>;
  })}</ol> : <div className="combo-empty-state"><Sparkles size={16}/><span>Belum ada susunan model untuk combo ini. Sinkronkan ulang dari MAX Router.</span></div>}
 </section>;
}

export default function App(){
 const [files,setFiles]=useState({}); const [originalFiles,setOriginalFiles]=useState({}); const editorRef=useRef(null); const decorationsRef=useRef([]); const aiBodyRef=useRef(null);
 const [documentsOpen,setDocumentsOpen]=useState(false); const [leftPanelOpen,setLeftPanelOpen]=useState(true); const [rightPanelOpen,setRightPanelOpen]=useState(true); const [aiMode,setAiMode]=useState("Auto"); const [aiProfile,setAiProfile]=useState("Default"); const [autopilot,setAutopilot]=useState(true); const [composerMenu,setComposerMenu]=useState(false);
 const [session,setSession]=useState(null);
 const [workspace,setWorkspace]=useState(null);
 const [active,setActive]=useState("src/App.js"); const [splitView,setSplitView]=useState(false); const [paneFiles,setPaneFiles]=useState(["src/App.js","src/index.js","",""]);
 const [ai,setAi]=useState("");
 const [terminal,setTerminal]=useState(false); const [bottomTab,setBottomTab]=useState("Terminal"); const [buildStatus,setBuildStatus]=useState("Belum dijalankan"); const [problems,setProblems]=useState([]);
 const [saved,setSaved]=useState(true);
 const [aiMessages,setAiMessages]=useState([]),[aiBusy,setAiBusy]=useState(false),[routerConfig,setRouterConfig]=useState(()=>getRouterConfig()),[routerOpen,setRouterOpen]=useState(false),[routerStatus,setRouterStatus]=useState("");
 const [localStatus,setLocalStatus]=useState("Local Agent belum terhubung"),[integrationsOpen,setIntegrationsOpen]=useState(false),[terminalInput,setTerminalInput]=useState(""),[terminalLines,setTerminalLines]=useState([]);
 const [routerStats,setRouterStats]=useState({total:0,free:0,paid:0,unknown:0,syncedAt:null,loading:false,error:""});
 const [routerModels,setRouterModels]=useState([]); const [routerCombos,setRouterCombos]=useState([]); const [comboError,setComboError]=useState(""); const [modelDetail,setModelDetail]=useState(null); const [aiStartedAt,setAiStartedAt]=useState(null); const [aiElapsed,setAiElapsed]=useState(0); const [typingCode,setTypingCode]=useState(false); const [codeApplyStatus,setCodeApplyStatus]=useState(""); const typingTimer=useRef(null);
 const [syncState,setSyncState]=useState({status:"Menunggu",lastSync:null,error:"",count:0});
 const filesHydrated=useRef(false),saveTimer=useRef(null);
 const deployedVersion=useRef(null);
 const latestWorkflowRun=useRef(null);
 const [updateNotice,setUpdateNotice]=useState(null);
 const notifyUpdate=(kind,title,message)=>{
  setUpdateNotice({kind,title,message,id:Date.now()});
  window.clearTimeout(window.__maxEditorNoticeTimer);
  window.__maxEditorNoticeTimer=window.setTimeout(()=>setUpdateNotice(null),9000);
 };
 useEffect(()=>{
  const onError=(event)=>notifyUpdate("error","Kesalahan aplikasi",event?.message||"Terjadi kesalahan JavaScript.");
  const onRejection=(event)=>notifyUpdate("error","Proses gagal",String(event?.reason?.message||event?.reason||"Permintaan asynchronous gagal."));
  window.addEventListener("error",onError);
  window.addEventListener("unhandledrejection",onRejection);
  return()=>{window.removeEventListener("error",onError);window.removeEventListener("unhandledrejection",onRejection)};
 },[]);
 useEffect(()=>{
  let stopped=false;
  const checkWorkflow=async()=>{
   try{
    const response=await fetch("https://api.github.com/repos/rizki-habibi/max-editor/actions/runs?per_page=1",{cache:"no-store"});
    if(!response.ok)return;
    const data=await response.json();
    const run=data.workflow_runs?.[0];
    if(!run||stopped)return;
    if(latestWorkflowRun.current===null){latestWorkflowRun.current=run.id;return;}
    if(run.id!==latestWorkflowRun.current){
     latestWorkflowRun.current=run.id;
     const branch=run.head_branch||"main";
     if(run.status!=="completed")notifyUpdate("pending","Pembaruan sedang diperiksa",`Commit ${run.head_sha?.slice(0,7)||""} sedang diuji oleh GitHub Actions (${branch}).`);
     else if(run.conclusion==="success")notifyUpdate("success","Pembaruan berhasil diuji",`Pemeriksaan build berhasil untuk ${branch}. Menunggu deployment aplikasi selesai.`);
     else notifyUpdate("error","Pembaruan terdeteksi bermasalah",`Pemeriksaan build berstatus ${run.conclusion||run.status}. Buka GitHub Actions untuk melihat log error.`);
    }else if(run.status==="completed"&&run.conclusion!=="success"&&latestWorkflowRun.current===run.id){
     // A failed latest run is surfaced when a new run first appears, avoiding repeated alerts.
    }
   }catch{}
  };
  checkWorkflow();
  const timer=setInterval(checkWorkflow,60000);
  return()=>{stopped=true;clearInterval(timer)};
 },[]);

 useEffect(()=>{
  let stopped=false;
  const checkForDeployment=async()=>{
   try{
    const response=await fetch("/version.json?check="+Date.now(),{cache:"no-store",headers:{"Cache-Control":"no-cache"}});
    if(!response.ok)return;
    const data=await response.json();
    if(stopped||!data?.version)return;
    if(deployedVersion.current===null){deployedVersion.current=data.version;return;}
    if(data.version!==deployedVersion.current&&saved){notifyUpdate("success","Versi baru tersedia","MAX Editor akan dimuat ulang otomatis.");window.setTimeout(()=>window.location.reload(),1800);}
   }catch{}
  };
  checkForDeployment();
  const timer=setInterval(checkForDeployment,30000);
  window.addEventListener("focus",checkForDeployment);
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener("focus",checkForDeployment)};
 },[saved]);
 const [folderInfo,setFolderInfo]=useState(()=>{try{return JSON.parse(localStorage.getItem("max-editor.folder")||"null")}catch{return null}});
 const dirInput=useRef(null),localSocket=useRef(null);
 function classifyModelPricing(model){
  const p=model?.pricing;
  if(!p || typeof p!=="object") return "unknown";
  const values=Object.values(p).filter(v=>typeof v==="number" || (typeof v==="string" && v.trim()!=="")).map(Number).filter(Number.isFinite);
  if(!values.length) return "unknown";
  return values.some(v=>v>0) ? "paid" : "free";
 }
 async function syncRouterModels(){
  setRouterStats(x=>({...x,loading:true,error:""}));
  try{
   const models=await listRouterModels(routerConfig);
   setRouterModels(models);
   const counts=models.reduce((a,m)=>{a[classifyModelPricing(m)]++;return a},{free:0,paid:0,unknown:0});
   setRouterStats({total:models.length,...counts,syncedAt:new Date().toLocaleTimeString("id-ID"),loading:false,error:""});
   if(routerConfig.selectionType!=="combo" && models.length && !models.some(m=>m.id===routerConfig.model)){
    const preferred=models.find(m=>classifyModelPricing(m)==="free")||models[0];
    setRouterConfig(x=>({...x,model:preferred.id}));
   }
   return models;
  }catch(e){setRouterStats(x=>({...x,loading:false,error:e.message||"Gagal sinkron model."}));return []}
 }
 useEffect(()=>{let active=true;fetch("/api/auth/session",{credentials:"same-origin"}).then(async r=>{if(!r.ok)return null;return r.json()}).then(data=>{if(active&&data?.user)setSession({user:data.user,access_token:"cookie-session"});}).catch(()=>{});return()=>{active=false}},[]);
 useEffect(()=>{const onExpired=()=>setSession(null);window.addEventListener("max-editor-auth-expired",onExpired);return()=>window.removeEventListener("max-editor-auth-expired",onExpired)},[]);
 useEffect(()=>{if(!session)return;(async()=>{filesHydrated.current=false;try{const data=await loadWorkspace(session);setWorkspace(data.workspace);const cloud=Object.fromEntries((data.files||[]).map(x=>[x.path,x.content]));setFiles(Object.keys(cloud).length?cloud:initialFiles);setOriginalFiles(Object.keys(cloud).length?cloud:initialFiles);const savedActive=localStorage.getItem("max-editor.active."+session.user.id);if(savedActive)setActive(savedActive);setSyncState({status:"Tersimpan di PostgreSQL",lastSync:new Date().toLocaleTimeString("id-ID"),error:"",count:Object.keys(cloud).length});}catch(error){setFiles(initialFiles);setSyncState({status:"Gagal memuat PostgreSQL",lastSync:null,error:error.message,count:0});}finally{filesHydrated.current=true;}})()},[session]);
 const code=files[active]??"";
 const changeStats=useMemo(()=>{const before=String(originalFiles[active]??"").split("\n"),after=String(code).split("\n");let added=0,removed=0;const max=Math.max(before.length,after.length);for(let i=0;i<max;i++){if(before[i]===undefined&&after[i]!==undefined)added++;else if(after[i]===undefined&&before[i]!==undefined)removed++;else if(before[i]!==after[i]){added++;removed++;}}return {added,removed};},[originalFiles,active,code]);
 useEffect(()=>{const editor=editorRef.current;if(!editor)return;const before=String(originalFiles[active]??"").split("\n"),after=String(code).split("\n");const max=Math.max(before.length,after.length),next=[];for(let i=0;i<max;i++){if(before[i]===after[i])continue;const line=Math.min(i+1,Math.max(1,after.length));next.push({range:new editor.monaco.Range(line,1,line,1),options:{isWholeLine:true,linesDecorationsClassName:before[i]===undefined?"max-gutter-added":after[i]===undefined?"max-gutter-removed":"max-gutter-modified",className:before[i]===undefined?"max-line-added":after[i]===undefined?"max-line-removed":"max-line-modified"}})}try{decorationsRef.current=editor.deltaDecorations(decorationsRef.current,next)}catch{}},[active,code,originalFiles]);
 const language=useMemo(()=>{const ext=active.split(".").pop().toLowerCase();const map={md:"markdown",markdown:"markdown",json:"json",css:"css",scss:"scss",less:"less",html:"html",htm:"html",xml:"xml",svg:"xml",yaml:"yaml",yml:"yaml",py:"python",pyw:"python",java:"java",kt:"kotlin",kts:"kotlin",cs:"csharp",cpp:"cpp",cc:"cpp",c:"c",h:"c",go:"go",rs:"rust",php:"php",rb:"ruby",sql:"sql",sh:"shell",bash:"shell",ps1:"powershell",bat:"bat",cmd:"bat",vue:"html",svelte:"html",ts:"typescript",tsx:"typescript",jsx:"javascript",js:"javascript",mjs:"javascript",cjs:"javascript"};return map[ext]||"plaintext"},[active]);

 function updateCode(value){setFiles(f=>({...f,[active]:value??""}));setSaved(false);setSyncState(x=>({...x,status:"Perubahan lokal belum diunggah"}))}
 async function saveAll(reason="manual"){if(!workspace||!filesHydrated.current)return;const entries=Object.entries(files);if(!entries.length)return;setSyncState(x=>({...x,status:reason==="timer"?"Sinkronisasi otomatis...":"Menyimpan ke PostgreSQL...",error:""}));try{await saveFiles(session,workspace.id,entries.map(([path,content])=>({path,content,language:path.endsWith(".md")?"markdown":path.endsWith(".json")?"json":path.endsWith(".css")?"css":path.endsWith(".html")?"html":"javascript"})));setSaved(true);setSyncState({status:"Tersimpan di PostgreSQL",lastSync:new Date().toLocaleTimeString("id-ID"),error:"",count:entries.length});}catch(error){setSaved(false);setSyncState(x=>({...x,status:"Gagal menyimpan",error:error.message}));}}
 async function save(){await saveAll("manual")}
 useEffect(()=>{if(!session||!filesHydrated.current)return;localStorage.setItem("max-editor.active."+session.user.id,active);},[active,files,session]);
 useEffect(()=>{if(!session||!filesHydrated.current)return;clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>saveAll("debounce"),2000);return()=>clearTimeout(saveTimer.current)},[files,session,workspace]);
 useEffect(()=>{if(!session||!workspace||!filesHydrated.current)return;const timer=setInterval(()=>saveAll("timer"),30000);return()=>clearInterval(timer)},[session,workspace,files]);
 useEffect(()=>{if(!session||!workspace||!filesHydrated.current)return;const onHide=()=>{if(document.visibilityState==="hidden")saveAll("timer")};document.addEventListener("visibilitychange",onHide);return()=>document.removeEventListener("visibilitychange",onHide)},[session,workspace,files]);
 function createFile(){const n=prompt("Nama file baru");if(!n)return;setFiles(f=>({...f,[n]:""}));setActive(n);setSaved(false)}
 async function importFolder(){if(!window.showDirectoryPicker){dirInput.current?.click();return}try{const root=await window.showDirectoryPicker();const next={};async function walk(handle,path=""){for await(const [name,entry] of handle.entries()){if(name==="node_modules"||name===".git"||name==="dist"||name==="build")continue;const p=path?path+"/"+name:name;if(entry.kind==="file"){try{const file=await entry.getFile();if(file.size<2000000)next[p]=await file.text()}catch{}}else await walk(entry,p)}}await walk(root);setFiles(f=>({...f,...next}));if(Object.keys(next)[0])setActive(Object.keys(next)[0]);setSaved(false);setLocalStatus("Folder dimuat: "+Object.keys(next).length+" file")}catch(e){if(e.name!=="AbortError")setLocalStatus("Gagal: "+e.message)}}
 async function importSelectedFiles(e){const next={};for(const file of [...e.target.files])if(file.size<2000000)next[file.webkitRelativePath||file.name]=await file.text();setFiles(f=>({...f,...next}));if(Object.keys(next)[0])setActive(Object.keys(next)[0]);setSaved(false);setLocalStatus("Folder dimuat: "+Object.keys(next).length+" file")}
 function extractFileProposals(message){
  const found=[];const re=/```file:([^\n`]+)\n([\s\S]*?)\n```/g;let match;
  while((match=re.exec(String(message||"")))!==null){const path=match[1].trim().replace(/^['"]|['"]$/g,"");if(path&&!path.includes("..")&&!path.startsWith("/")&&!path.includes("\\"))found.push({path,content:match[2]});}
  return found;
 }
 function extractCodeBlock(message){
  const match=String(message||"").match(/```(?:[a-zA-Z0-9_+#.-]+)?\s*\n([\s\S]*?)\n```/);
  return match?match[1]:null;
 }
 function requestCodingMode(prompt){
  setAi(prompt+"\n\nMode kerja: CODING LANGSUNG. Buat solusi untuk file aktif `"+active+"`. Jika file ini yang harus diubah, balas dengan satu blok kode lengkap berformat ```"+(language==="markdown"?"markdown":language==="javascript"?"javascript":language)+"\n...kode lengkap...\n```. Jangan hanya memberi potongan kode. Sebelum blok, jelaskan singkat apa yang akan diterapkan.");
 }
 function applyCodeProposal(message,targetPath=active){
  const proposals=extractFileProposals(message);
  if(proposals.length){
   setFiles(current=>({...current,...Object.fromEntries(proposals.map(p=>[p.path,p.content]))}));
   setActive(proposals[0].path);setSaved(false);setTypingCode(false);
   setCodeApplyStatus("AI menerapkan "+proposals.length+" file: "+proposals.map(p=>p.path).join(", "));
   setTimeout(()=>setCodeApplyStatus(""),7000);return;
  }
  const proposal=extractCodeBlock(message);
  if(proposal===null){setCodeApplyStatus("Respons ini tidak memiliki blok kode lengkap untuk diterapkan.");return;}
  if(typingTimer.current)clearInterval(typingTimer.current);
  setTypingCode(true);setActive(targetPath);setCodeApplyStatus("AI sedang mengetik kode ke "+targetPath+"…");
  const target=proposal;let index=0;const chunk=18;
  setFiles(current=>({...current,[targetPath]:""}));setSaved(false);
  typingTimer.current=setInterval(()=>{
   index=Math.min(index+chunk,target.length);const partial=target.slice(0,index);
   setFiles(current=>({...current,[targetPath]:partial}));
   if(index>=target.length){clearInterval(typingTimer.current);typingTimer.current=null;setTypingCode(false);setSaved(false);setCodeApplyStatus("Kode diterapkan ke "+targetPath+". Menyimpan otomatis…");setTimeout(()=>setCodeApplyStatus(""),4500);}
  },12);
 }
 async function sendAi(){
  const prompt=ai.trim();if(!prompt||aiBusy)return;
  const requestPath=active; const requestCode=files[active]??""; const wantsReport=/\b(laporan|report|laporkan|buatkan laporan|ringkasan laporan)\b/i.test(prompt); const wantsMultiFile=/\b(semua file|seluruh file|banyak file|multi.?file|semua berkas|seluruh proyek|seluruh project|perbaiki semuanya|perbaiki semua|ubah semua file|edit semua file|beberapa file|4 file|empat file)\b/i.test(prompt); const wantsCoding=!wantsReport&&(wantsMultiFile||aiMode==="Edit"||/\b(buat|bikin|tambah|tambahkan|perbaiki|ubah|edit|implement|implementasikan|coding|ngoding|refactor|fix|write|create|build|generate|buatkan|perbarui|optimalkan)\b/i.test(prompt)); const wantsAnalysis=!wantsReport&&!wantsCoding&&(aiMode==="Analisis"||/\b(jelaskan|analisis|cek|review|cari|bug|periksa|apa fungsi)\b/i.test(prompt));
  setAi("");setAiBusy(true);setAiStartedAt(Date.now());setAiElapsed(0);
  // Hindari menyisipkan README dan seluruh isi workspace ke setiap pesan.
  const isReadmePath=p=>/^README(?:\.[^/]+)?$/i.test(String(p).split("/").pop()||"");
  const workspaceIndex=Object.keys(files).filter(p=>!isReadmePath(p)).sort().map(p=>(p===requestPath?"▶ ":"  ")+p).join("\n");
  const includeWorkspaceContext=(wantsCoding||wantsAnalysis)&&!isReadmePath(requestPath);
  const relevantFiles=Object.entries(files).filter(([p])=>!isReadmePath(p)).slice(0,wantsMultiFile?40:wantsCoding?24:5);
  const fileContext=includeWorkspaceContext
   ? "\n\nKonteks file proyek (README dikecualikan):\nFile aktif: "+requestPath+"\nDaftar file:\n"+workspaceIndex+"\n"+relevantFiles.map(([p,c])=>"\n--- FILE: "+p+" ---\n"+String(c).slice(0,wantsCoding?6500:1800)).join("")+
     (wantsCoding?"\n\nTUGAS MULTI-FILE: periksa file relevan dan terapkan perubahan pada SEMUA file yang diperlukan. Kembalikan setiap file yang diubah sebagai blok terpisah berformat file:path/relatif.ext, diikuti isi LENGKAP file. Jangan keluarkan blok untuk file yang tidak diubah. Gunakan path relatif workspace dan jangan sertakan README kecuali diminta.":"")
   : "";
  const modeInstructions="\n\nPreferensi MAX AI: mode "+aiMode+"; profil "+aiProfile+"; autopilot "+(autopilot?"aktif":"nonaktif")+". "+(aiMode==="Tanya"?"Utamakan jawaban dan penjelasan; jangan mengubah file kecuali diminta jelas.":aiMode==="Analisis"?"Analisis dahulu, jelaskan temuan dan jangan mengubah file kecuali pengguna meminta perbaikan.":aiMode==="Edit"?"Utamakan implementasi perubahan pada file yang relevan dan keluarkan blok file lengkap.":"Pilih cara kerja sesuai permintaan pengguna.")+" "+(aiProfile==="Cepat"?"Jawab ringkas dan fokus pada solusi langsung.":aiProfile==="Teliti"?"Periksa dampak, edge case, dan konsistensi antarfIle dengan cermat.":aiProfile==="Kreatif"?"Tawarkan implementasi yang kreatif tetapi tetap konsisten dengan proyek.":"Gunakan keseimbangan antara kecepatan, ketelitian, dan kejelasan."); const codingInstructions=wantsReport?"\n\nMODE PEMBUAT LAPORAN: Susun laporan lengkap dalam Markdown dengan judul, ringkasan eksekutif, tujuan, metode/analisis, temuan, rekomendasi, kesimpulan, dan referensi bila tersedia. Jangan membuat klaim/fakta atau referensi palsu.":wantsCoding?"\n\nMODE AGEN CODING MAX EDITOR:\n- Gunakan hanya konteks file yang disertakan; jangan meminta atau mengulang README.md kecuali pengguna secara eksplisit memintanya.\n- Pertahankan dependensi, API, dan pola proyek yang ada.\n- Untuk satu file, keluarkan satu blok kode lengkap. Untuk banyak file, gunakan format blok file yang didukung MAX Editor dengan path relatif.\n- Jangan mengklaim build/test berhasil tanpa hasil tes nyata. Jangan meminta atau menampilkan API key.\n- Beri ringkasan singkat dan langkah verifikasi.":"";
  const displayMsgs=[...aiMessages,{role:"user",content:prompt}];
  const multiFileInstructions=wantsMultiFile?"\n\nPERMINTAAN WAJIB MULTI-FILE: keluarkan satu blok ```file:path/relatif.ext lalu isi lengkap lalu ``` untuk setiap file yang benar-benar perlu diubah. Jangan hanya mengubah file aktif. Gunakan path yang ada dalam daftar workspace.":""; const requestMsgs=[...aiMessages,{role:"user",content:prompt+fileContext+multiFileInstructions+modeInstructions+codingInstructions}];
  setAiMessages(displayMsgs);
  try{
   let result,activeModel=routerConfig.model,lastError,streamedText="";
   setAiMessages([...displayMsgs,{role:"assistant",content:""}]);
   try{
    result=await chatWithRouter(routerConfig,requestMsgs,piece=>{
     streamedText+=piece;
     setAiMessages(current=>{const next=[...current];const last=next.length-1;if(last>=0&&next[last].role==="assistant")next[last]={...next[last],content:streamedText};return next;});
    });
   }catch(e){lastError=e;}
   if(result===undefined){
    setAiMessages(current=>current.length&&current[current.length-1].role==="assistant"?current.slice(0,-1):current);
    const errorText=String(lastError?.message||lastError||"");
    const shouldFailover=/403|401|429|500|502|503|504|account_suspended|suspended|rate.?limit|quota|overload|temporar|unavailable|no credentials/i.test(errorText);
    if(!shouldFailover||routerConfig.selectionType==="combo")throw lastError;
    setAiMessages(m=>[...m,{role:"assistant",content:"Model "+(routerConfig.model||"(belum dipilih)")+" gagal. Mendeteksi model alternatif dan mencoba otomatis…"}]);
    const models=await listRouterModels(routerConfig);
    const candidates=models.filter(m=>m?.id&&m.id!==routerConfig.model);
    if(!candidates.length)throw new Error(errorText+"\\nTidak ada model alternatif yang terdaftar di MAX Router.");
    let switched=false;
    for(const candidate of candidates){
     try{
      result=await chatWithRouter({...routerConfig,model:candidate.id},requestMsgs);
      activeModel=candidate.id;switched=true;break;
     }catch(e){lastError=e;}
    }
    if(!switched)throw new Error("Semua model alternatif gagal. Error terakhir: "+String(lastError?.message||lastError||errorText));
    const next={...routerConfig,model:activeModel};
    setRouterConfig(next);saveRouterConfig(next);
    setRouterStatus("Otomatis beralih ke model aktif: "+activeModel);
    setAiMessages(m=>[...m,{role:"assistant",content:"Berhasil beralih otomatis ke model "+activeModel+" karena model sebelumnya gagal.\\n\\n"+result}]);
    if(wantsCoding&&autopilot&&(extractCodeBlock(result)!==null||extractFileProposals(result).length)&&!wantsMultiFile)applyCodeProposal(result,requestPath)
    return;
   }
   if(streamedText){
    setAiMessages(current=>{const next=[...current];const last=next.length-1;if(last>=0&&next[last].role==="assistant")next[last]={...next[last],content:result};return next;});
   }else{
    setAiMessages(m=>[...m,{role:"assistant",content:result}]);
   }
   if(wantsReport){const stamp=new Date().toISOString().slice(0,16).replace("T","-").replaceAll(":","");const reportPath="laporan/Laporan-"+stamp+".md";setFiles(current=>({...current,[reportPath]:"# Laporan MAX AI\n\n"+result}));setOriginalFiles(current=>({...current,[reportPath]:""}));setActive(reportPath);setSaved(false);setCodeApplyStatus("Laporan dibuat sebagai "+reportPath+". Gunakan Dokumen & Ekspor untuk Word atau PDF.");}
   if(wantsCoding&&autopilot){
    let multi=extractFileProposals(result),proposal=extractCodeBlock(result);
    if(wantsMultiFile&&multi.length===0){
     setCodeApplyStatus("Meminta ulang respons dalam format multi-file…");
     try{result=await chatWithRouter(routerConfig,[...requestMsgs,{role:"assistant",content:String(result||"")},{role:"user",content:"Ulangi jawaban dengan format yang dapat diterapkan oleh MAX Editor. WAJIB satu blok untuk setiap file: ```file:src/path.ext pada baris pertama, isi lengkap file, lalu ``` pada baris terakhir. Jangan gunakan blok kode biasa. Jangan hanya mengembalikan file aktif; gunakan path yang ada pada daftar workspace dan keluarkan semua file yang memang perlu diubah."}]);multi=extractFileProposals(result);proposal=extractCodeBlock(result);setAiMessages(current=>{const next=[...current];const idx=next.map(m=>m.role).lastIndexOf("assistant");if(idx>=0)next[idx]={...next[idx],content:String(result||"")};return next;});}catch(retryError){setCodeApplyStatus("Permintaan ulang multi-file gagal: "+retryError.message);}
    }
    if(multi.length)applyCodeProposal(result,requestPath);
    else if(wantsMultiFile){setCodeApplyStatus("Belum diterapkan: model tidak mengembalikan blok file:path yang valid. Tidak ada file yang diubah agar kode tidak salah ditempatkan.");}
    else if(proposal!==null){const ext=requestPath.split(".").pop().toLowerCase();const looksWrong=(ext==="js"||ext==="jsx"||ext==="ts"||ext==="tsx")&&(/^\\s*<!doctype html>|^\\s*<html[\\s>]|^\\s*#\\s/m.test(proposal));if(!looksWrong)applyCodeProposal(result,requestPath);else setCodeApplyStatus("Kode tidak diterapkan otomatis karena formatnya tidak cocok dengan "+requestPath+".");}
   }
  }catch(e){setAiMessages(m=>[...m,{role:"assistant",content:"Error: "+e.message}]);}
  finally{setAiBusy(false);setAiStartedAt(null)}
}
 async function syncRouterCombos(){setComboError("");try{const combos=await listRouterCombos();setRouterCombos(combos);return combos}catch(e){setComboError(e.message||"Gagal menyinkronkan combo.");return []}}
 async function testRouter(){setRouterStatus("Memeriksa...");const [models,combos]=await Promise.all([syncRouterModels(),syncRouterCombos()]);if(models.length||combos.length)setRouterStatus("Terhubung · "+models.length+" model · "+combos.length+" combo");else setRouterStatus(routerStats.error||comboError||"Tidak ada model atau combo aktif.")}
 function saveRouterLocal(){if(!routerConfig.model){setRouterStatus("Pilih model atau combo terlebih dahulu.");return;}saveRouterConfig(routerConfig);setRouterOpen(false);setRouterStatus((routerConfig.selectionType==="combo"?"Combo ":"Model ")+routerConfig.model+" siap digunakan.")}
 function chooseRouterMode(mode){setRouterConfig(current=>{if(mode==="combo"){const combo=routerCombos.find(x=>x.name===current.model)||routerCombos[0];return {...current,selectionType:"combo",model:combo?.name||""};}const model=routerModels.find(x=>x.id===current.model)||routerModels[0];return {...current,selectionType:"individual",model:model?.id||""};});}
 useEffect(()=>{if(!session)return;syncRouterModels();syncRouterCombos();const timer=setInterval(()=>{syncRouterModels();syncRouterCombos()},60000);return()=>clearInterval(timer)},[session,routerConfig.selectionType,routerConfig.model]); useEffect(()=>{if(!aiBusy||!aiStartedAt)return;const timer=setInterval(()=>setAiElapsed(Math.floor((Date.now()-aiStartedAt)/1000)),250);return()=>clearInterval(timer)},[aiBusy,aiStartedAt]); useEffect(()=>{if(aiBodyRef.current)aiBodyRef.current.scrollTop=aiBodyRef.current.scrollHeight},[aiMessages,aiBusy]);
 function connectLocal(){
  if(localSocket.current?.readyState===WebSocket.OPEN){setLocalStatus("Local Agent terhubung");return}
  try{
    const ws=new WebSocket("ws://127.0.0.1:8765");
    localSocket.current=ws;
    ws.onopen=()=>setLocalStatus("Local Agent terhubung");
    let pendingTerminalLines=[];let terminalFrame=0;
    const flushTerminal=()=>{terminalFrame=0;if(!pendingTerminalLines.length)return;const batch=pendingTerminalLines;pendingTerminalLines=[];setTerminalLines(x=>[...x,...batch])};
    ws.onmessage=e=>{const raw=typeof e.data==="string"?e.data:"";if(!raw)return;window.setTimeout(()=>{let m;try{m=JSON.parse(raw)}catch{return}if(m?.type==="ready"){setLocalStatus(m.message);return}if(m?.type==="result"){if(m.stdout)pendingTerminalLines.push(m.stdout);if(m.stderr)pendingTerminalLines.push("ERROR: "+m.stderr);pendingTerminalLines.push("Exit code: "+m.code);if(!terminalFrame)terminalFrame=requestAnimationFrame(flushTerminal)}},0)};
    ws.onerror=()=>setLocalStatus("Local Agent tidak ditemukan");
    ws.onclose=()=>{localSocket.current=null;setLocalStatus("Local Agent terputus")};
  }catch(e){setLocalStatus(e.message)}
 }
 async function runBuild(){setTerminal(true);setBottomTab("Build");setBuildStatus("Menjalankan npm run build…");setTerminalLines(x=>[...x,"PS MAX> npm run build"]);if(!localSocket.current||localSocket.current.readyState!==WebSocket.OPEN){setBuildStatus("Local Agent belum terhubung");setTerminalLines(x=>[...x,"Build tidak dijalankan: hubungkan Local Agent agar perintah dijalankan di komputer proyek."]);return;}localSocket.current.send(JSON.stringify({type:"exec",command:"npm run build"}));setBuildStatus("Perintah build dikirim ke Local Agent.");}
 function autoInstallDependencies(){
  setTerminal(true);setBottomTab("Terminal");
  const commands=[];
  const names=Object.keys(files);
  if(names.includes("composer.json"))commands.push("composer install");
  if(names.includes("package.json"))commands.push("npm install");
  if(names.includes("requirements.txt"))commands.push("python -m pip install -r requirements.txt");
  if(names.includes("pyproject.toml")&&!names.includes("requirements.txt"))commands.push("python -m pip install .");
  if(names.includes("go.mod"))commands.push("go mod download");
  if(names.includes("Cargo.toml"))commands.push("cargo fetch");
  if(names.includes("Gemfile"))commands.push("bundle install");
  if(names.includes("pom.xml"))commands.push("mvn dependency:resolve");
  if(names.includes("build.gradle")||names.includes("build.gradle.kts"))commands.push(names.includes("gradlew")?"./gradlew build":"gradle build");
  if(!commands.length){setTerminalLines(x=>[...x,"MAX AI: Tidak menemukan manifest dependensi (composer.json, package.json, requirements.txt, go.mod, Cargo.toml, Gemfile, pom.xml, atau build.gradle). Impor folder proyek lengkap dahulu."]);return;}
  if(!localSocket.current||localSocket.current.readyState!==WebSocket.OPEN){setTerminalLines(x=>[...x,"MAX AI: Perlu menghubungkan Local Agent di komputer proyek sebelum instalasi.","Perintah yang terdeteksi: "+commands.join(" && "),"Buka Integrasi → Local Agent → Hubungkan, lalu klik Instal Dependensi lagi."]);return;}
  setTerminalLines(x=>[...x,"MAX AI: Mendeteksi paket dari file proyek…","MAX AI: Menjalankan instalasi dependensi: "+commands.join(" && ")]);
  const runNext=(index)=>{
   if(index>=commands.length){setTerminalLines(x=>[...x,"MAX AI: Semua perintah instalasi selesai. Periksa kode keluar di atas."]);return;}
   const command=commands[index];
   setTerminalLines(x=>[...x,"PS MAX> "+command]);
   localSocket.current.send(JSON.stringify({type:"exec",command}));
  };
  // Send a single platform-compatible shell command chain so output remains ordered.
  const command=commands.join(" && ");
  localSocket.current.send(JSON.stringify({type:"exec",command}));
 }
 function runTerminal(){
  const command=terminalInput.trim();if(!command)return;
  const blocked=/\b(format|del\s+\/s|rd\s+\/s|rmdir\s+\/s|remove-item\s+-recurse|git\s+reset\s+--hard|git\s+clean\s+-fd|rm\s+-rf)\b/i;
  setTerminalLines(x=>[...x,"PS MAX> "+command]);
  setTerminalInput("");
  if(blocked.test(command)){setTerminalLines(x=>[...x,"Command diblokir karena berpotensi menghapus data."]);return}
  if(!localSocket.current||localSocket.current.readyState!==WebSocket.OPEN){setTerminalLines(x=>[...x,"Local Agent belum terhubung. Klik Integrasi → Local Agent → Hubungkan."]);return}
  localSocket.current.send(JSON.stringify({type:"exec",command}));
 }
 if(!session)return <CloudAuth onSession={setSession}/>;
 return <div className="app">
   <input ref={dirInput} type="file" webkitdirectory="" directory="" multiple hidden onChange={importSelectedFiles}/>
   <header className="topbar">
    <div className="brand"><button className="panel-control" title={leftPanelOpen?"Tutup penjelajah file":"Buka penjelajah file"} aria-label={leftPanelOpen?"Tutup panel kiri":"Buka panel kiri"} onClick={()=>setLeftPanelOpen(v=>!v)}>{leftPanelOpen?<PanelLeftClose size={16}/>:<FolderOpen size={16}/>}</button><span className="brand-mark"><img src="/max-editor-logo.svg" alt=""/></span><strong>MAX Editor</strong><span className="badge">AKTIF</span></div>
    <div className="top-actions"><button className="panel-control" title={rightPanelOpen?"Tutup MAX AI":"Buka MAX AI"} aria-label={rightPanelOpen?"Tutup panel kanan":"Buka panel kanan"} onClick={()=>setRightPanelOpen(v=>!v)}>{rightPanelOpen?<PanelRightClose size={16}/>:<Sparkles size={16}/>}</button><span className="cloud"><Cloud size={14}/> {workspace?"PostgreSQL Cloud":"Cloud"}</span><button title="Ambil folder Windows" onClick={importFolder}><FolderInput size={16}/></button><button title="Buat dan ekspor dokumen" onClick={()=>setDocumentsOpen(true)}><FileText size={16}/></button><button title="Penghubung MAX Router" onClick={()=>setRouterOpen(true)}><PlugZap size={16}/></button><GitWorkspace/><button title="Integrasi Pengembang" onClick={()=>setIntegrationsOpen(true)}><PlugZap size={16}/></button><button title="Simpan" onClick={save}><Save size={16}/></button><button onClick={async()=>{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});setSession(null)}} title="Keluar"><LogOut size={16}/></button></div>
   </header>
   <div className={`workspace ${leftPanelOpen?"left-panel-open":"left-panel-closed"} ${rightPanelOpen?"right-panel-open":"right-panel-closed"}`}>
    <aside className="sidebar">
      <div className="side-head"><span>PENJELAJAH</span><div><button onClick={importFolder}><FolderInput size={14}/></button><button onClick={createFile}><Plus size={15}/></button></div></div>
      <div className="project"><FolderOpen size={15}/><strong>{workspace?.name||"MAX Workspace"}</strong><ChevronDown size={14}/></div>
      {Object.keys(files).sort().map(name=><FileItem key={name} name={name} active={active===name} onClick={()=>setActive(name)}/>)}
      <div className="folder"><Folder size={15}/><span>src</span></div>
      <FileItem name="App.js" active={active==="src/App.js"} onClick={()=>setActive("src/App.js")}/>
      <FileItem name="index.js" active={active==="src/index.js"} onClick={()=>setActive("src/index.js")}/>
      <div className="side-bottom"><div><Cloud size={15}/> Simpan otomatis ke PostgreSQL</div><small>{syncState.status}{syncState.lastSync?" · "+syncState.lastSync:""}</small>{folderInfo?.name&&<small>Folder: {folderInfo.name}</small>}{syncState.error&&<small className="sync-error">{syncState.error}</small>}</div>
    </aside>
    <main className="editor-area">
      <div className="tabs"><button className="pane-toggle" title={splitView?"Kembali ke satu editor":"Buka empat editor bersamaan"} onClick={()=>{setSplitView(v=>!v);if(!splitView){const list=Object.keys(files).filter(p=>!/^README(?:\.[^/]+)?$/i.test(p.split("/").pop()||"")).sort().slice(0,4);setPaneFiles([list[0]||active,list[1]||"",list[2]||"",list[3]||""]);}}}><Code2 size={14}/>{splitView?"Satu editor":"4 editor"}</button><div className="tab active"><span className="tab-file-icon"><FileIconForTab name={active}/></span>{active.split("/").pop()}<span className={saved?"":"dirty"}>{saved?"":"●"}</span></div><div className="tab-spacer"/><button onClick={()=>setSplitView(v=>!v)} title="Tata letak editor"><Search size={15}/></button></div>
      {splitView?<div className="multi-editor-grid">{[0,1,2,3].map(slot=>{const path=paneFiles[slot]||"";const ext=(path.split(".").pop()||"").toLowerCase();const langs={js:"javascript",jsx:"javascript",ts:"typescript",tsx:"typescript",html:"html",htm:"html",php:"php",blade:"html",css:"css",scss:"scss",json:"json",md:"markdown",py:"python",sql:"sql",yml:"yaml",yaml:"yaml",xml:"xml",sh:"shell"};return <section className="multi-editor-pane" key={slot}><div className="multi-pane-head"><select aria-label={"Pilih file panel "+(slot+1)} value={path} onChange={e=>setPaneFiles(prev=>prev.map((v,i)=>i===slot?e.target.value:v))}><option value="">Pilih file…</option>{Object.keys(files).filter(p=>!/^README(?:\.[^/]+)?$/i.test(p.split("/").pop()||"")).sort().map(p=><option key={p} value={p}>{p}</option>)}</select><button title="Jadikan file aktif" onClick={()=>{if(path)setActive(path)}}>↗</button></div>{path?<Editor theme="vs-dark" language={langs[ext]||"plaintext"} value={files[path]??""} onChange={value=>{setFiles(prev=>({...prev,[path]:value??""}));setSaved(false);setSyncState(x=>({...x,status:"Perubahan lokal belum diunggah"}));}} options={{fontSize:12,minimap:{enabled:false},automaticLayout:true,padding:{top:8},smoothScrolling:true,scrollBeyondLastLine:false,wordWrap:"on",scrollbar:{vertical:"auto",horizontal:"auto",verticalScrollbarSize:8,horizontalScrollbarSize:8}}}/>:<div className="multi-pane-empty">Pilih file untuk panel ini</div>}</section>})}</div>:<div className="monaco"><Editor theme="vs-dark" language={language} value={code} onChange={updateCode} onMount={(editor,monaco)=>{editorRef.current=editor;editorRef.current.monaco=monaco;editor.focus();}} options={{fontSize:14,minimap:{enabled:false},automaticLayout:true,padding:{top:14},smoothScrolling:true,scrollBeyondLastLine:false,renderWhitespace:"selection",wordWrap:"on",scrollbar:{vertical:"auto",horizontal:"auto",verticalScrollbarSize:10,horizontalScrollbarSize:10}}}/></div>}
      {terminal&&<section className="bottom-panel"><div className="bottom-tabs"><button className={bottomTab==="Terminal"?"selected":""} onClick={()=>setBottomTab("Terminal")}><Terminal size={13}/> Terminal</button><button className={bottomTab==="Output"?"selected":""} onClick={()=>setBottomTab("Output")}>Output</button><button className={bottomTab==="Problems"?"selected":""} onClick={()=>setBottomTab("Problems")}><AlertTriangle size={13}/> Masalah {problems.length?`(${problems.length})`:""}</button><button className={bottomTab==="Build"?"selected":""} onClick={()=>setBottomTab("Build")}><Play size={13}/> Build</button><span className="bottom-spacer"/><button onClick={()=>setTerminal(false)} title="Tutup panel">×</button></div><div className="bottom-content">{bottomTab==="Build"?<><strong>{buildStatus}</strong><p>Build dijalankan melalui Local Agent pada folder proyek lokal.</p><button className="build-button" onClick={runBuild}><Play size={13}/> Jalankan Build</button><button className="build-button" onClick={autoInstallDependencies}><PlugZap size={13}/> Instal dependensi otomatis</button><p>MAX AI mendeteksi Composer, npm, Python, Go, Rust, Ruby, dan Java dari manifest proyek. Local Agent menjalankan perintah pada folder proyek yang sedang terhubung.</p></>:bottomTab==="Problems"?<div>{problems.length?problems.map((p,i)=><div key={i}>{p}</div>):"Belum ada hasil pemeriksaan kode. Jalankan Build untuk memeriksa proyek."}</div>:bottomTab==="Output"?terminalLines.map((line,i)=><div key={i}>{line}</div>):<><div className="terminal-head"><span><Terminal size={14}/> TERMINAL · {localStatus}</span><button onClick={()=>setTerminal(false)}>×</button></div><div className="terminal-lines">{terminalLines.map((line,i)=><div key={i}>{line}</div>)}</div><div className="terminal-command"><span className="prompt">PS MAX&gt;</span> <input value={terminalInput} onChange={e=>setTerminalInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")runTerminal()}} placeholder="Masukkan perintah..." /></div></>}</div></section>}
      <div className="statusbar"><span className="diff-summary"><i className="diff-added">+{changeStats.added}</i> <i className="diff-removed">−{changeStats.removed}</i></span><span>{saved?"Tersimpan":"Belum disimpan"}</span><span>{language}</span><span>UTF-8</span><button onClick={()=>{setTerminal(true);setBottomTab("Terminal")}}><Terminal size={13}/> Terminal</button><button onClick={runBuild}><Play size={13}/> Build</button></div>
    </main>
    <aside className="ai-panel">
      <div className="ai-head"><div><span className="ai-brand-icon"><Sparkles size={15}/></span><strong>MAX AI</strong></div><div className="ai-head-actions"><button onClick={()=>setRightPanelOpen(false)} title="Tutup panel MAX AI" aria-label="Tutup panel MAX AI"><X size={14}/></button><button onClick={()=>setAiMessages([])} title="Percakapan baru" aria-label="Percakapan baru"><Trash2 size={14}/></button><button onClick={()=>setRouterOpen(true)} title="Pilih model AI">{routerConfig.model?((routerConfig.selectionType==="combo"?"Combo · ":"")+routerConfig.model.split("/").slice(-1)[0]):"Pilih model"} <ChevronDown size={12}/></button></div></div>
      <div className="ai-body" ref={aiBodyRef}>{aiBusy&&<div className="ai-working"><span className="ai-spinner"></span><div><strong>MAX AI sedang berpikir…</strong><small>{aiElapsed<10?"Mengirim permintaan dan menunggu model":aiElapsed<35?"Menganalisis konteks kode":aiElapsed<90?"Menyusun respons atau perubahan kode":"Respons lebih lama dari biasanya"} · {Math.floor(aiElapsed/60)}:{String(aiElapsed%60).padStart(2,"0")}</small><div className="ai-progress"><i style={{width:Math.min(96,12+aiElapsed*1.2)+"%"}}/></div></div></div>}{aiMessages.length===0&&!ai.trim()?<div className="ai-empty"><div className="ai-icon"><Sparkles size={23}/></div><h3>Apa yang ingin kamu buat?</h3><p>Tanyakan sesuatu, minta analisis file, atau biarkan MAX AI membantu menulis kode.</p><div className="suggestions"><button onClick={()=>setAi("Jelaskan file ini")}>Jelaskan file ini</button><button onClick={()=>setAi("Cari bug di file ini")}>Cari bug</button><button onClick={()=>requestCodingMode("Perbaiki dan optimalkan file aktif ini")}>Ngoding langsung</button></div></div>:<div className="ai-messages">{aiMessages.map((m,i)=><div key={i} className={"ai-message "+m.role}><span>{m.role==="user"?"Kamu":"MAX AI"}</span><div>{m.content}{aiBusy&&i===aiMessages.length-1&&m.role==="assistant"&&<span className="live-cursor"/>}</div>{m.role==="assistant"&&(extractCodeBlock(m.content)!==null||extractFileProposals(m.content).length>0)&&<button className="apply-code-button" disabled={typingCode} onClick={()=>applyCodeProposal(m.content)}>{typingCode?"AI sedang mengetik…":"Terapkan kode ke editor"}</button>}</div>)}</div>}</div>
      {codeApplyStatus&&<div className="code-apply-status"><span className={typingCode?"typing-cursor":""}></span>{codeApplyStatus}</div>}<div className="ai-composer"><div className="ai-input"><textarea value={ai} onChange={e=>setAi(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAi()}}} placeholder="Tanyakan atau jelaskan apa yang ingin dibuat…"/><div className="ai-composer-actions"><button className="ai-send" onClick={sendAi} disabled={aiBusy||!ai.trim()} title="Kirim pesan" aria-label="Kirim pesan"><Send size={15}/></button></div><div className="ai-composer-toolbar"><button type="button" title="Tambahkan instruksi atau konteks" onClick={()=>setComposerMenu(v=>!v)}><Hash size={15}/></button><button type="button" title="Sertakan file aktif sebagai konteks" onClick={()=>setAi(value=>(value?value+"\n\n":"")+"Gunakan file aktif `"+active+"` sebagai konteks utama.")}><Paperclip size={15}/></button><span className="toolbar-separator"/><label className="mini-select"><CircleDot size={13}/><select aria-label="Mode AI" value={aiMode} onChange={e=>setAiMode(e.target.value)}><option>Auto</option><option>Tanya</option><option>Edit</option><option>Analisis</option></select><ChevronDown size={11}/></label><span className="toolbar-spacer"/><label className="mini-select"><SlidersHorizontal size={13}/><select aria-label="Profil respons" value={aiProfile} onChange={e=>setAiProfile(e.target.value)}><option>Default</option><option>Cepat</option><option>Teliti</option><option>Kreatif</option></select><ChevronDown size={11}/></label><button type="button" className={"autopilot-toggle "+(autopilot?"enabled":"")} role="switch" aria-checked={autopilot} onClick={()=>setAutopilot(v=>!v)} title="Aktifkan atau matikan autopilot"><span>Autopilot</span><i/></button></div></div>{composerMenu&&<div className="composer-menu"><button onClick={()=>{setAi(value=>(value?value+"\n":"")+"Periksa file aktif "+active+" dan jelaskan bagian yang penting.");setComposerMenu(false)}}><AtSign size={13}/> Konteks file aktif</button><button onClick={()=>{setAiMode("Edit");setAi(value=>(value?value+"\n":"")+"Terapkan perubahan langsung pada semua file yang relevan.");setComposerMenu(false)}}><SquarePen size={13}/> Mode edit multi-file</button><button onClick={()=>{setAiMode("Analisis");setAi(value=>(value?value+"\n":"")+"Analisis struktur proyek dan cari masalah tanpa mengubah kode dulu.");setComposerMenu(false)}}><Search size={13}/> Analisis proyek</button></div>}<div className="ai-composer-hint">Enter untuk mengirim · Shift + Enter untuk baris baru</div></div>
      <div className="provider">MAX Router · {routerConfig.selectionType==="combo"?"Combo":"Individu"} · {routerConfig.model||"Pilih model"}</div>
    </aside>
   </div>
   {updateNotice&&<div className={"update-notice "+updateNotice.kind} role="status" aria-live="polite"><div className="update-notice-icon">{updateNotice.kind==="error"?<AlertTriangle size={18}/>:updateNotice.kind==="pending"?<RefreshCw size={18}/>:<CheckCircle2 size={18}/>}</div><div className="update-notice-copy"><strong>{updateNotice.title}</strong><span>{updateNotice.message}</span>{updateNotice.kind==="error"&&<a href="https://github.com/rizki-habibi/max-editor/actions" target="_blank" rel="noreferrer">Lihat log pemeriksaan <GitBranch size={12}/></a>}</div><button type="button" aria-label="Tutup notifikasi" onClick={()=>setUpdateNotice(null)}><X size={15}/></button></div>}
   {modelDetail&&<div className="modal-backdrop model-detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModelDetail(null)}}><section className="model-detail-modal" role="dialog" aria-modal="true" aria-label="Detail model"><header className="model-detail-head"><div className="model-detail-symbol"><Sparkles size={20}/></div><div className="model-detail-title"><strong>Detail kemampuan model</strong><span title={modelDetail.id}>{modelDetail.id}</span></div><button type="button" onClick={()=>setModelDetail(null)} aria-label="Tutup detail"><X size={18}/></button></header><p className="model-detail-note">Indikator berikut adalah perkiraan berdasarkan metadata model yang tersedia. Dukungan sebenarnya mengikuti kemampuan penyedia dan endpoint MAX Router.</p><div className="model-capability-grid">{(()=>{const id=String(modelDetail.id||"").toLowerCase();const vision=!!(modelDetail.vision||modelDetail.capabilities?.vision||/vision|image|gemini|gpt-4o|claude-3|pixtral|llava/.test(id));const video=!!(modelDetail.video||modelDetail.capabilities?.video||/veo|sora|video/.test(id));const audio=!!(modelDetail.audio||modelDetail.capabilities?.audio||/audio|speech|tts|whisper|realtime/.test(id));const code=!!(modelDetail.code||modelDetail.capabilities?.code||/coder|code|devstral|qwen.*3|deepseek|claude|gpt|gemini/.test(id));const capabilities=[{name:"Teks & obrolan",ok:true,Icon:MessageSquare},{name:"Pemrograman",ok:code,Icon:Code2},{name:"Gambar / visi",ok:vision,Icon:FileImage},{name:"Video",ok:video,Icon:Play},{name:"Audio / suara",ok:audio,Icon:PlugZap}];return capabilities.map(cap=><div key={cap.name} className={"model-capability "+(cap.ok?"supported":"unknown")}><cap.Icon size={17}/><span>{cap.name}</span><strong>{cap.ok?"Terindikasi":"Belum terverifikasi"}</strong></div>)})()}</div><div className="model-detail-actions"><button type="button" onClick={()=>{const next={...routerConfig,selectionType:"individual",model:modelDetail.id};setRouterConfig(next);saveRouterConfig(next);setRouterStatus("Model utama diubah ke "+modelDetail.id);setModelDetail(null);setRouterOpen(false)}}><CheckCircle2 size={15}/> Jadikan model utama</button><button type="button" className="model-detail-secondary" onClick={()=>{setRouterConfig(x=>({...x,selectionType:"individual",model:modelDetail.id}));setModelDetail(null)}}>Pilih untuk digunakan</button></div></section></div>}\n   {routerOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setRouterOpen(false)}}><div className="router-modal">
     <div className="router-modal-head"><strong>MAX Router</strong><button onClick={()=>setRouterOpen(false)}><X size={18}/></button></div>
     <p>Model dan combo disinkronkan langsung dari MAX Router.</p>
     <div className="router-mode-toggle" role="group" aria-label="Mode pemilihan model">
       <button className={routerConfig.selectionType!=="combo"?"selected":""} onClick={()=>chooseRouterMode("individual")}>Individu</button>
       <button className={routerConfig.selectionType==="combo"?"selected":""} onClick={()=>chooseRouterMode("combo")}>Combo</button>
     </div>
     {routerConfig.selectionType==="combo" ? <label>Pilih combo dari MAX Router<select value={routerConfig.model} onChange={e=>setRouterConfig(x=>({...x,model:e.target.value,selectionType:"combo"}))}><option value="">Pilih combo</option>{routerCombos.map(combo=><option key={combo.id||combo.name} value={combo.name}>{combo.name} · {(combo.models||[]).length} model</option>)}</select></label> : <label>Pilih model AI<select value={routerConfig.model} onChange={e=>setRouterConfig(x=>({...x,model:e.target.value,selectionType:"individual"}))}><option value="">Pilih model dari MAX Router</option>{routerModels.map(m=><option key={m.id} value={m.id}>{m.id}</option>)}</select></label>}
     {routerConfig.selectionType==="combo"&&<ComboVisual routerConfig={routerConfig} routerCombos={routerCombos} routerModels={routerModels} setModelDetail={setModelDetail} setRouterConfig={setRouterConfig} saveRouterConfig={saveRouterConfig} setRouterStatus={setRouterStatus}/> }
     <p>Individu memakai model terpilih. Combo menjalankan strategi yang sudah diatur di MAX Router.</p>
     <div className="router-model-stats">
       <div><span>Model</span><strong>{routerStats.loading?"…":routerStats.total}</strong></div>
       <div><span>Gratis</span><strong className="free">{routerStats.loading?"…":routerStats.free}</strong></div>
       <div><span>Berbayar</span><strong className="paid">{routerStats.loading?"…":routerStats.paid}</strong></div>
       <div><span>Combo</span><strong>{routerCombos.length}</strong></div>
     </div>
     <div className="router-sync-line">{routerStats.syncedAt?"Sinkron model "+routerStats.syncedAt:"Model belum disinkronkan"}{comboError?" · "+comboError:routerStats.error?" · "+routerStats.error:""}</div>
     <div className="router-status-box">{routerStatus||"Pilihan disimpan dan digunakan untuk permintaan MAX AI berikutnya."}</div>
     <div><button onClick={testRouter} disabled={routerStats.loading}><RefreshCw size={13}/> Sinkronkan model & combo</button><button className="primary" onClick={saveRouterLocal}>Simpan pilihan</button></div>
   </div></div>}
   {documentsOpen&&<DocumentsPanel files={files} active={active} code={code} onClose={()=>setDocumentsOpen(false)} onCreate={(path,content)=>{setFiles(f=>({...f,[path]:content}));setOriginalFiles(f=>({...f,[path]:content}));setActive(path);setSaved(false);setSyncState(x=>({...x,status:"File dokumen baru dibuat"}));}}/>}
   {integrationsOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setIntegrationsOpen(false)}}><div className="router-modal">
     <div className="router-modal-head"><strong>Integrasi Pengembang</strong><button onClick={()=>setIntegrationsOpen(false)}><X size={18}/></button></div>
     <div className="integration-row"><Github size={18}/><div><strong>GitHub</strong><small>Gunakan terminal lokal untuk mengambil, menarik, melakukan commit, dan mengirim perubahan tanpa menyimpan token di browser.</small></div></div>
     <div className="integration-row"><GitBranch size={18}/><div><strong>GitLab</strong><small>Perintah GitLab juga dapat dijalankan melalui Local Agent.</small></div></div>
     <div className="integration-row"><Terminal size={18}/><div><strong>Local Agent</strong><small>{localStatus}</small><button className="wide" onClick={connectLocal}>Hubungkan Agen Lokal</button></div></div>
     <button className="wide" onClick={()=>{setIntegrationsOpen(false);setTerminal(true);connectLocal()}}>Buka Terminal</button>
   </div></div>}
 </div>
}