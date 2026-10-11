import {useEffect,useMemo,useRef,useState} from "react";
import Editor from "@monaco-editor/react";
import {FileCode2,Folder,FolderOpen,GitBranch,Play,Plus,Search,Settings,Terminal,ChevronDown,MessageSquare,Cloud,Save,LogIn,LogOut,Github,FolderInput,PlugZap,X,RefreshCw,GitCommit,Download,AlertTriangle,CheckCircle2,CircleDot} from "lucide-react";
import {loadWorkspace,saveFiles} from "./lib/editorDb";
import {chatWithRouter,getRouterConfig,listRouterModels,saveRouterConfig} from "./lib/maxRouter";
import GitWorkspace from "./components/GitWorkspace";

const initialFiles={
  "README.md": `# MAX Editor

Editor coding online berbasis browser.

- Monaco Editor
- Workspace cloud siap Supabase
- AI panel siap Max Router
- GitHub integration siap dikembangkan
`,
  "src/App.js": `export default function hello() {
  console.log('Hello from MAX Editor');
}
`,
  "src/index.js": `import hello from './App.js';

hello();
`
};

function FileItem({name,active,onClick,folder=false}) {
  return <button className={`file-item ${active?'active':''}`} onClick={onClick}>{folder?<Folder size={15}/>:<FileCode2 size={15}/>}<span>{name}</span></button>
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
   <section className="auth-hero"><div className="hero-kicker">DUNIA MAX <span>01</span></div><div className="hero-logo">M</div><div className="hero-bubble"><strong>HAI, PEMBUAT KODE!</strong><span>Masuk sekali. Workspace tetap tersimpan di cloud.</span></div><div className="hero-title">KODE.<br/><em>BUAT.</em><br/>MAX.</div><div className="hero-caption">Monaco Editor · PostgreSQL Cloud · MAX AI</div><div className="hero-lines"></div></section>
   <form className="auth-card" onSubmit={go}>
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
export default function App(){
 const [files,setFiles]=useState({}); const [originalFiles,setOriginalFiles]=useState({}); const editorRef=useRef(null); const decorationsRef=useRef([]);
 const [session,setSession]=useState(null);
 const [workspace,setWorkspace]=useState(null);
 const [active,setActive]=useState("README.md");
 const [ai,setAi]=useState("");
 const [terminal,setTerminal]=useState(false); const [bottomTab,setBottomTab]=useState("Terminal"); const [buildStatus,setBuildStatus]=useState("Belum dijalankan"); const [problems,setProblems]=useState([]);
 const [saved,setSaved]=useState(true);
 const [aiMessages,setAiMessages]=useState([]),[aiBusy,setAiBusy]=useState(false),[routerConfig,setRouterConfig]=useState(()=>getRouterConfig()),[routerOpen,setRouterOpen]=useState(false),[routerStatus,setRouterStatus]=useState("");
 const [localStatus,setLocalStatus]=useState("Local Agent belum terhubung"),[integrationsOpen,setIntegrationsOpen]=useState(false),[terminalInput,setTerminalInput]=useState(""),[terminalLines,setTerminalLines]=useState([]);
 const [routerStats,setRouterStats]=useState({total:0,free:0,paid:0,unknown:0,syncedAt:null,loading:false,error:""});
 const [routerModels,setRouterModels]=useState([]); const [aiStartedAt,setAiStartedAt]=useState(null); const [aiElapsed,setAiElapsed]=useState(0); const [typingCode,setTypingCode]=useState(false); const [codeApplyStatus,setCodeApplyStatus]=useState(""); const typingTimer=useRef(null);
 const [syncState,setSyncState]=useState({status:"Menunggu",lastSync:null,error:"",count:0});
 const filesHydrated=useRef(false),saveTimer=useRef(null);
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
   if(models.length && !models.some(m=>m.id===routerConfig.model)){
    const preferred=models.find(m=>classifyModelPricing(m)==="free")||models[0];
    setRouterConfig(x=>({...x,model:preferred.id}));
   }
   return models;
  }catch(e){setRouterStats(x=>({...x,loading:false,error:e.message||"Gagal sinkron model."}));return []}
 }
 useEffect(()=>{let active=true;fetch("/api/auth/session",{credentials:"same-origin"}).then(async r=>{if(!r.ok)return null;return r.json()}).then(data=>{if(active&&data?.user)setSession({user:data.user,access_token:"cookie-session"});}).catch(()=>{});return()=>{active=false}},[]);
 useEffect(()=>{if(!session)return;(async()=>{filesHydrated.current=false;try{const data=await loadWorkspace(session);setWorkspace(data.workspace);const cloud=Object.fromEntries((data.files||[]).map(x=>[x.path,x.content]));setFiles(Object.keys(cloud).length?cloud:initialFiles);setOriginalFiles(Object.keys(cloud).length?cloud:initialFiles);const savedActive=localStorage.getItem("max-editor.active."+session.user.id);if(savedActive)setActive(savedActive);setSyncState({status:"Tersimpan di PostgreSQL",lastSync:new Date().toLocaleTimeString("id-ID"),error:"",count:Object.keys(cloud).length});}catch(error){setFiles(initialFiles);setSyncState({status:"Gagal memuat PostgreSQL",lastSync:null,error:error.message,count:0});}finally{filesHydrated.current=true;}})()},[session]);
 const code=files[active]??"";
 const changeStats=useMemo(()=>{const before=String(originalFiles[active]??"").split("\n"),after=String(code).split("\n");let added=0,removed=0;const max=Math.max(before.length,after.length);for(let i=0;i<max;i++){if(before[i]===undefined&&after[i]!==undefined)added++;else if(after[i]===undefined&&before[i]!==undefined)removed++;else if(before[i]!==after[i]){added++;removed++;}}return {added,removed};},[originalFiles,active,code]);
 useEffect(()=>{const editor=editorRef.current;if(!editor)return;const before=String(originalFiles[active]??"").split("\n"),after=String(code).split("\n");const max=Math.max(before.length,after.length),next=[];for(let i=0;i<max;i++){if(before[i]===after[i])continue;const line=Math.min(i+1,Math.max(1,after.length));next.push({range:new (window.monaco?.Range||Object)(line,1,line,1),options:{isWholeLine:true,linesDecorationsClassName:before[i]===undefined?"max-gutter-added":after[i]===undefined?"max-gutter-removed":"max-gutter-modified",className:before[i]===undefined?"max-line-added":after[i]===undefined?"max-line-removed":"max-line-modified"}})}try{decorationsRef.current=editor.deltaDecorations(decorationsRef.current,next)}catch{}},[active,code,originalFiles]);
 const language=useMemo(()=>active.endsWith(".md")?"markdown":active.endsWith(".json")?"json":active.endsWith(".css")?"css":active.endsWith(".html")?"html":"javascript",[active]);

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
 function extractCodeBlock(message){
  const match=String(message||"").match(/```(?:[a-zA-Z0-9_+#.-]+)?\s*\n([\s\S]*?)\n```/);
  return match?match[1]:null;
 }
 function requestCodingMode(prompt){
  setAi(prompt+"\n\nMode kerja: CODING LANGSUNG. Buat solusi untuk file aktif `"+active+"`. Jika file ini yang harus diubah, balas dengan satu blok kode lengkap berformat ```"+(language==="markdown"?"markdown":language==="javascript"?"javascript":language)+"\n...kode lengkap...\n```. Jangan hanya memberi potongan kode. Sebelum blok, jelaskan singkat apa yang akan diterapkan.");
 }
 function applyCodeProposal(message){
  const proposal=extractCodeBlock(message);
  if(proposal===null){setCodeApplyStatus("Respons ini tidak memiliki blok kode lengkap untuk diterapkan.");return;}
  if(typingTimer.current)clearInterval(typingTimer.current);
  setTypingCode(true);setCodeApplyStatus("AI sedang mengetik kode ke "+active+"…");
  const target=proposal;let index=0;const chunk=18;
  setFiles(current=>({...current,[active]:""}));setSaved(false);
  typingTimer.current=setInterval(()=>{
   index=Math.min(index+chunk,target.length);
   const partial=target.slice(0,index);
   setFiles(current=>({...current,[active]:partial}));
   if(index>=target.length){
    clearInterval(typingTimer.current);typingTimer.current=null;setTypingCode(false);
    setSaved(false);setCodeApplyStatus("Kode diterapkan ke "+active+". Menyimpan otomatis…");
    setTimeout(()=>setCodeApplyStatus(""),4500);
   }
  },12);
 }
 async function sendAi(){
  const prompt=ai.trim();if(!prompt||aiBusy)return;
  setAi("");setAiBusy(true);setAiStartedAt(Date.now());setAiElapsed(0);
  const msgs=[...aiMessages,{role:"user",content:prompt+"\n\nFile aktif: "+active+"\nIsi file:\n"+code.slice(0,18000)}];
  setAiMessages(msgs);
  try{
   let result,activeModel=routerConfig.model,lastError;
   try{result=await chatWithRouter(routerConfig,msgs);}catch(e){lastError=e;}
   if(result===undefined){
    const errorText=String(lastError?.message||lastError||"");
    const shouldFailover=/403|401|429|500|502|503|504|account_suspended|suspended|rate.?limit|quota|overload|temporar|unavailable|no credentials/i.test(errorText);
    if(!shouldFailover)throw lastError;
    setAiMessages(m=>[...m,{role:"assistant",content:"Model "+(routerConfig.model||"(belum dipilih)")+" gagal. Mendeteksi model alternatif dan mencoba otomatis…"}]);
    const models=await listRouterModels(routerConfig);
    const candidates=models.filter(m=>m?.id&&m.id!==routerConfig.model);
    if(!candidates.length)throw new Error(errorText+"\\nTidak ada model alternatif yang terdaftar di MAX Router.");
    let switched=false;
    for(const candidate of candidates){
     try{
      result=await chatWithRouter({...routerConfig,model:candidate.id},msgs);
      activeModel=candidate.id;switched=true;break;
     }catch(e){lastError=e;}
    }
    if(!switched)throw new Error("Semua model alternatif gagal. Error terakhir: "+String(lastError?.message||lastError||errorText));
    const next={...routerConfig,model:activeModel};
    setRouterConfig(next);saveRouterConfig(next);
    setRouterStatus("Otomatis beralih ke model aktif: "+activeModel);
    setAiMessages(m=>[...m,{role:"assistant",content:"Berhasil beralih otomatis ke model "+activeModel+" karena model sebelumnya gagal.\\n\\n"+result}]);
    return;
   }
   setAiMessages(m=>[...m,{role:"assistant",content:result}]);
  }catch(e){setAiMessages(m=>[...m,{role:"assistant",content:"Error: "+e.message}]);}
  finally{setAiBusy(false);setAiStartedAt(null)}
}
 async function testRouter(){setRouterStatus("Memeriksa...");const models=await syncRouterModels();if(models.length)setRouterStatus("Terhubung · "+models.length+" model");else setRouterStatus(routerStats.error||"Tidak ada model aktif.")}
 function saveRouterLocal(){saveRouterConfig(routerConfig);setRouterOpen(false);setRouterStatus("Konfigurasi tersimpan")}
 useEffect(()=>{if(!session)return;syncRouterModels();const timer=setInterval(syncRouterModels,60000);return()=>clearInterval(timer)},[session]); useEffect(()=>{if(!aiBusy||!aiStartedAt)return;const timer=setInterval(()=>setAiElapsed(Math.floor((Date.now()-aiStartedAt)/1000)),250);return()=>clearInterval(timer)},[aiBusy,aiStartedAt]);
 function connectLocal(){
  if(localSocket.current?.readyState===WebSocket.OPEN){setLocalStatus("Local Agent terhubung");return}
  try{
    const ws=new WebSocket("ws://127.0.0.1:8765");
    localSocket.current=ws;
    ws.onopen=()=>setLocalStatus("Local Agent terhubung");
    ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==="ready")setLocalStatus(m.message);if(m.type==="result"){setTerminalLines(x=>[...x,...(m.stdout?[m.stdout]:[]),...(m.stderr?["ERROR: "+m.stderr]:[]),"Exit code: "+m.code])}}catch{}};
    ws.onerror=()=>setLocalStatus("Local Agent tidak ditemukan");
    ws.onclose=()=>{localSocket.current=null;setLocalStatus("Local Agent terputus")};
  }catch(e){setLocalStatus(e.message)}
 }
 async function runBuild(){setTerminal(true);setBottomTab("Build");setBuildStatus("Menjalankan npm run build…");setTerminalLines(x=>[...x,"PS MAX> npm run build"]);if(!localSocket.current||localSocket.current.readyState!==WebSocket.OPEN){setBuildStatus("Local Agent belum terhubung");setTerminalLines(x=>[...x,"Build tidak dijalankan: hubungkan Local Agent agar perintah dijalankan di komputer proyek."]);return;}localSocket.current.send(JSON.stringify({type:"exec",command:"npm run build"}));setBuildStatus("Perintah build dikirim ke Local Agent.");}
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
    <div className="brand"><span className="brand-mark">M</span><strong>MAX Editor</strong><span className="badge">AKTIF</span></div>
    <div className="top-actions"><span className="cloud"><Cloud size={14}/> {workspace?"PostgreSQL Cloud":"Cloud"}</span><button title="Ambil folder Windows" onClick={importFolder}><FolderInput size={16}/></button><button title="Penghubung MAX Router" onClick={()=>setRouterOpen(true)}><PlugZap size={16}/></button><GitWorkspace/><button title="Integrasi Pengembang" onClick={()=>setIntegrationsOpen(true)}><PlugZap size={16}/></button><button title="Simpan" onClick={save}><Save size={16}/></button><button onClick={async()=>{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});setSession(null)}} title="Keluar"><LogOut size={16}/></button></div>
   </header>
   <div className="workspace">
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
      <div className="tabs"><div className="tab active"><FileCode2 size={14}/>{active}<span className={saved?"":"dirty"}>{saved?"":"●"}</span></div><div className="tab-spacer"/><button><Search size={15}/></button></div>
      <div className="monaco"><Editor theme="vs-dark" language={language} value={code} onChange={updateCode} onMount={(editor)=>{editorRef.current=editor;editor.focus();}} options={{fontSize:14,minimap:{enabled:false},automaticLayout:true,padding:{top:14},smoothScrolling:true,scrollBeyondLastLine:false,renderWhitespace:"selection",wordWrap:"on",scrollbar:{vertical:"auto",horizontal:"auto",verticalScrollbarSize:10,horizontalScrollbarSize:10}}}/></div>
      {terminal&&<section className="bottom-panel"><div className="bottom-tabs"><button className={bottomTab==="Terminal"?"selected":""} onClick={()=>setBottomTab("Terminal")}><Terminal size={13}/> Terminal</button><button className={bottomTab==="Output"?"selected":""} onClick={()=>setBottomTab("Output")}>Output</button><button className={bottomTab==="Problems"?"selected":""} onClick={()=>setBottomTab("Problems")}><AlertTriangle size={13}/> Masalah {problems.length?`(${problems.length})`:""}</button><button className={bottomTab==="Build"?"selected":""} onClick={()=>setBottomTab("Build")}><Play size={13}/> Build</button><span className="bottom-spacer"/><button onClick={()=>setTerminal(false)} title="Tutup panel">×</button></div><div className="bottom-content">{bottomTab==="Build"?<><strong>{buildStatus}</strong><p>Build dijalankan melalui Local Agent pada folder proyek lokal.</p><button className="build-button" onClick={runBuild}><Play size={13}/> Jalankan Build</button></>:bottomTab==="Problems"?<div>{problems.length?problems.map((p,i)=><div key={i}>{p}</div>):"Belum ada hasil pemeriksaan kode. Jalankan Build untuk memeriksa proyek."}</div>:bottomTab==="Output"?terminalLines.map((line,i)=><div key={i}>{line}</div>):<><div className="terminal-head"><span><Terminal size={14}/> TERMINAL · {localStatus}</span><button onClick={()=>setTerminal(false)}>×</button></div><div className="terminal-lines">{terminalLines.map((line,i)=><div key={i}>{line}</div>)}</div><div className="terminal-command"><span className="prompt">PS MAX&gt;</span> <input value={terminalInput} onChange={e=>setTerminalInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")runTerminal()}} placeholder="Masukkan perintah..." /></div></>}</div></section>}
      <div className="statusbar"><span className="diff-summary"><i className="diff-added">+{changeStats.added}</i> <i className="diff-removed">−{changeStats.removed}</i></span><span>{saved?"Tersimpan":"Belum disimpan"}</span><span>{language}</span><span>UTF-8</span><button onClick={()=>{setTerminal(true);setBottomTab("Terminal")}}><Terminal size={13}/> Terminal</button><button onClick={runBuild}><Play size={13}/> Build</button></div>
    </main>
    <aside className="ai-panel">
      <div className="ai-head"><div><MessageSquare size={16}/><strong>MAX AI</strong></div><button onClick={()=>setRouterOpen(true)} title="Pilih model AI">{routerConfig.model?routerConfig.model.split("/").slice(-1)[0]:"Pilih model"} <ChevronDown size={12}/></button></div>
      <div className="ai-body">{aiBusy&&<div className="ai-working"><span className="ai-spinner"></span><div><strong>MAX AI sedang berpikir…</strong><small>{aiElapsed<10?"Mengirim permintaan dan menunggu model":aiElapsed<35?"Menganalisis konteks kode":aiElapsed<90?"Menyusun respons atau perubahan kode":"Respons lebih lama dari biasanya"} · {Math.floor(aiElapsed/60)}:{String(aiElapsed%60).padStart(2,"0")}</small><div className="ai-progress"><i style={{width:Math.min(96,12+aiElapsed*1.2)+"%"}}/></div></div></div>}{aiMessages.length===0?<div className="ai-empty"><div className="ai-icon">M</div><h3>Asisten Kode AI</h3><p>Analisis file, cari kesalahan, atau minta perubahan melalui Max Router.</p><div className="suggestions"><button onClick={()=>setAi("Jelaskan file ini")}>Jelaskan file ini</button><button onClick={()=>setAi("Cari bug di file ini")}>Cari bug</button><button onClick={()=>requestCodingMode("Perbaiki dan optimalkan file aktif ini")}>Ngoding langsung</button></div></div>:<div className="ai-messages">{aiMessages.map((m,i)=><div key={i} className={"ai-message "+m.role}><span>{m.role==="user"?"Kamu":"MAX AI"}</span><div>{m.content}</div>{m.role==="assistant"&&extractCodeBlock(m.content)!==null&&<button className="apply-code-button" disabled={typingCode} onClick={()=>applyCodeProposal(m.content)}>{typingCode?"AI sedang mengetik…":"Terapkan kode ke editor"}</button>}</div>)}</div>}</div>
      {codeApplyStatus&&<div className="code-apply-status"><span className={typingCode?"typing-cursor":""}></span>{codeApplyStatus}</div>}<div className="ai-input"><textarea value={ai} onChange={e=>setAi(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAi()}}} placeholder="Tanyakan sesuatu kepada MAX AI..."/><button onClick={sendAi} disabled={aiBusy}><Play size={15}/></button></div>
      <div className="provider">MAX Router · {routerConfig.model||"Pilih model"} · {routerModels.length} model</div>
    </aside>
   </div>
   {routerOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setRouterOpen(false)}}><div className="router-modal">
     <div className="router-modal-head"><strong>MAX Router</strong><button onClick={()=>setRouterOpen(false)}><X size={18}/></button></div>
     <p>Hubungkan editor ke API yang kompatibel dengan OpenAI melalui Max Router.</p>
     <label>Pilih model AI<select value={routerConfig.model} onChange={e=>setRouterConfig(x=>({...x,model:e.target.value}))}><option value="">Pilih model dari MAX Router</option>{routerModels.map(m=><option key={m.id} value={m.id}>{m.id}</option>)}</select></label>
     <p>Daftar model diambil langsung dari MAX Router. API key dikelola di server Railway.</p>
     <div className="router-model-stats">
       <div><span>Jumlah model</span><strong>{routerStats.loading?"…":routerStats.total}</strong></div>
       <div><span>Gratis</span><strong className="free">{routerStats.loading?"…":routerStats.free}</strong></div>
       <div><span>Berbayar</span><strong className="paid">{routerStats.loading?"…":routerStats.paid}</strong></div>
       <div><span>Harga tidak diketahui</span><strong>{routerStats.loading?"…":routerStats.unknown}</strong></div>
     </div>
     <div className="router-sync-line">{routerStats.syncedAt?"Sinkron terakhir "+routerStats.syncedAt:"Belum disinkronkan"}{routerStats.error?" · "+routerStats.error:""}</div>
     <div className="router-status-box">{routerStatus||"Daftar model akan disinkronkan otomatis dari Max Router."}</div>
     <div><button onClick={syncRouterModels} disabled={routerStats.loading}><RefreshCw size={13}/> Sinkronkan model</button><button className="primary" onClick={saveRouterLocal}>Simpan</button></div>
   </div></div>}
   {integrationsOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setIntegrationsOpen(false)}}><div className="router-modal">
     <div className="router-modal-head"><strong>Integrasi Pengembang</strong><button onClick={()=>setIntegrationsOpen(false)}><X size={18}/></button></div>
     <div className="integration-row"><Github size={18}/><div><strong>GitHub</strong><small>Gunakan terminal lokal untuk mengambil, menarik, melakukan commit, dan mengirim perubahan tanpa menyimpan token di browser.</small></div></div>
     <div className="integration-row"><GitBranch size={18}/><div><strong>GitLab</strong><small>Perintah GitLab juga dapat dijalankan melalui Local Agent.</small></div></div>
     <div className="integration-row"><Terminal size={18}/><div><strong>Local Agent</strong><small>{localStatus}</small><button className="wide" onClick={connectLocal}>Hubungkan Agen Lokal</button></div></div>
     <button className="wide" onClick={()=>{setIntegrationsOpen(false);setTerminal(true);connectLocal()}}>Buka Terminal</button>
   </div></div>}
 </div>
}