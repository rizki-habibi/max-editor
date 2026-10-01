import {useEffect,useMemo,useRef,useState} from "react";
import Editor from "@monaco-editor/react";
import {FileCode2,Folder,FolderOpen,GitBranch,Play,Plus,Search,Settings,Terminal,ChevronDown,MessageSquare,Cloud,Save,LogIn,LogOut,Github,FolderInput,PlugZap,X,RefreshCw,GitCommit,Download,AlertTriangle,CheckCircle2,CircleDot} from "lucide-react";
import {supabase} from "./lib/supabase";
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
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[signup,setSignup]=useState(false),[msg,setMsg]=useState(""),[loading,setLoading]=useState("");
 useEffect(()=>{
  const query=new URLSearchParams(window.location.search);
  const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
  const authError=query.get("error_description")||query.get("error")||hash.get("error_description")||hash.get("error");
  if(authError){setMsg(decodeURIComponent(authError.replace(/\+/g," ")));window.history.replaceState({},document.title,window.location.pathname);}
 },[]);
 async function go(e){e.preventDefault();setMsg("");setLoading("email");const r=signup?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});setLoading("");if(r.error)setMsg(r.error.message);else if(r.data.session)onSession(r.data.session);else setMsg("Akun dibuat. Cek email untuk konfirmasi jika diminta.");}
 async function oauth(provider){
  setMsg("");setLoading(provider);
  const redirectTo=window.location.origin;
  const {data,error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo}});
  if(error){setLoading("");setMsg(error.message);return;}
  if(!data?.url){setLoading("");setMsg("Supabase tidak memberikan URL login OAuth.");}
 }
 return <div className="auth-screen">
  <div className="comic-orbit orbit-a"></div><div className="comic-orbit orbit-b"></div><div className="auth-spark spark-a">✦</div><div className="auth-spark spark-b">★</div>
  <div className="auth-wrap">
   <section className="auth-hero"><div className="hero-kicker">MAX UNIVERSE <span>01</span></div><div className="hero-logo">M</div><div className="hero-bubble"><strong>HEY, CODER!</strong><span>Masuk sekali. Workspace tetap tersimpan di cloud.</span></div><div className="hero-title">CODE.<br/><em>CREATE.</em><br/>MAX.</div><div className="hero-caption">Monaco Editor · Supabase Cloud · MAX AI</div><div className="hero-lines"></div></section>
   <form className="auth-card" onSubmit={go}>
    <div className="auth-card-top"><span className="panel-tag">CLOUD ACCESS</span><span className="panel-dots">● ● ●</span></div>
    <div className="auth-card-icon"><LogIn size={20}/></div>
    <h1>{signup?"Buat akun":"Masuk ke MAX Editor"}</h1><p>{signup?"Gunakan akun Google atau GitHub agar akses workspace mudah dipulihkan.":"Pilih akun yang biasa kamu gunakan untuk coding."}</p>
    <div className="oauth-grid">
      <button type="button" className="oauth-button github" onClick={()=>oauth("github")} disabled={!!loading}><Github size={18}/><span>{loading==="github"?"Menghubungkan...":"GitHub"}</span></button>
      <button type="button" className="oauth-button google" onClick={()=>oauth("google")} disabled={!!loading}><span className="google-g">G</span><span>{loading==="google"?"Menghubungkan...":"Google"}</span></button>
    </div>
    <div className="auth-divider"><span>atau email</span></div>
    <label>Email<input type="email" placeholder="nama@email.com" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label>
    <label>Password<input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} minLength="6" autoComplete={signup?"new-password":"current-password"} required/></label>
    {msg&&<div className="auth-message">{msg}</div>}
    <button className="auth-submit" type="submit" disabled={!!loading}><LogIn size={17}/>{loading==="email"?"Memproses...":signup?"Buat akun":"Masuk"}<span>→</span></button>
    <button type="button" className="switch-auth" onClick={()=>{setSignup(!signup);setMsg("")}}>{signup?"Sudah punya akun? Masuk":"Belum punya akun? Buat akun dengan email"}</button>
    <div className="auth-foot"><span>● Cloud workspace</span><span>● Akun tersimpan</span></div>
   </form>
  </div>
  <div className="comic-note">BUILD YOUR<br/><strong>OWN WORLD</strong></div>
 </div>
}

export default function App(){
 const [files,setFiles]=useState({});
 const [session,setSession]=useState(null);
 const [workspace,setWorkspace]=useState(null);
 const [active,setActive]=useState("README.md");
 const [ai,setAi]=useState("");
 const [terminal,setTerminal]=useState(false);
 const [saved,setSaved]=useState(true);
 const [aiMessages,setAiMessages]=useState([]),[aiBusy,setAiBusy]=useState(false),[routerConfig,setRouterConfig]=useState(()=>getRouterConfig()),[routerOpen,setRouterOpen]=useState(false),[routerStatus,setRouterStatus]=useState("");
 const [localStatus,setLocalStatus]=useState("Local Agent belum terhubung"),[integrationsOpen,setIntegrationsOpen]=useState(false),[terminalInput,setTerminalInput]=useState(""),[terminalLines,setTerminalLines]=useState([]);
 const [routerStats,setRouterStats]=useState({total:0,free:0,paid:0,unknown:0,syncedAt:null,loading:false,error:""});
 const dirInput=useRef(null),localSocket=useRef(null);
 function classifyModelPricing(model){
  const p=model?.pricing;
  if(!p || typeof p!=="object") return "unknown";
  const values=Object.values(p).filter(v=>typeof v==="number" || (typeof v==="string" && v.trim()!=="")).map(Number).filter(Number.isFinite);
  if(!values.length) return "unknown";
  return values.some(v=>v>0) ? "paid" : "free";
 }
 async function syncRouterModels(){
  if(!routerConfig.apiKey){setRouterStats(x=>({...x,error:"API key Max Router belum diisi.",loading:false}));return []}
  setRouterStats(x=>({...x,loading:true,error:""}));
  try{
   const models=await listRouterModels(routerConfig);
   const counts=models.reduce((a,m)=>{a[classifyModelPricing(m)]++;return a},{free:0,paid:0,unknown:0});
   setRouterStats({total:models.length,...counts,syncedAt:new Date().toLocaleTimeString("id-ID"),loading:false,error:""});
   if(models.length && !models.some(m=>m.id===routerConfig.model)){
    const preferred=models.find(m=>classifyModelPricing(m)==="free")||models[0];
    setRouterConfig(x=>({...x,model:preferred.id}));
   }
   return models;
  }catch(e){setRouterStats(x=>({...x,loading:false,error:e.message||"Gagal sinkron model."}));return []}
 }
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(!session)return;(async()=>{let {data:w}=await supabase.from("editor_workspaces").select("*").eq("owner_id",session.user.id).order("created_at").limit(1).maybeSingle();if(!w){const r=await supabase.from("editor_workspaces").insert({owner_id:session.user.id,name:"MAX Workspace"}).select().single();w=r.data;if(w)await supabase.from("editor_files").insert(Object.entries(initialFiles).map(([path,content])=>({workspace_id:w.id,path,content,language:path.endsWith(".md")?"markdown":"javascript"})))}setWorkspace(w);if(w){const {data}=await supabase.from("editor_files").select("*").eq("workspace_id",w.id).order("path");setFiles(Object.fromEntries((data||[]).map(x=>[x.path,x.content])));}})()},[session]);
 const code=files[active]??"";
 const language=useMemo(()=>active.endsWith(".md")?"markdown":active.endsWith(".json")?"json":active.endsWith(".css")?"css":active.endsWith(".html")?"html":"javascript",[active]);

 function updateCode(value){setFiles(f=>({...f,[active]:value??""}));setSaved(false)}
 async function save(){if(!workspace)return setSaved(true);const r=await supabase.from("editor_files").upsert({workspace_id:workspace.id,path:active,content:files[active]??"",language},{onConflict:"workspace_id,path"});if(r.error)alert(r.error.message);else setSaved(true)}
 function createFile(){const n=prompt("Nama file baru");if(!n)return;setFiles(f=>({...f,[n]:""}));setActive(n);setSaved(false)}
 async function importFolder(){if(!window.showDirectoryPicker){dirInput.current?.click();return}try{const root=await window.showDirectoryPicker();const next={};async function walk(handle,path=""){for await(const [name,entry] of handle.entries()){if(name==="node_modules"||name===".git"||name==="dist"||name==="build")continue;const p=path?path+"/"+name:name;if(entry.kind==="file"){try{const file=await entry.getFile();if(file.size<2000000)next[p]=await file.text()}catch{}}else await walk(entry,p)}}await walk(root);setFiles(f=>({...f,...next}));if(Object.keys(next)[0])setActive(Object.keys(next)[0]);setSaved(false);setLocalStatus("Folder dimuat: "+Object.keys(next).length+" file")}catch(e){if(e.name!=="AbortError")setLocalStatus("Gagal: "+e.message)}}
 async function importSelectedFiles(e){const next={};for(const file of [...e.target.files])if(file.size<2000000)next[file.webkitRelativePath||file.name]=await file.text();setFiles(f=>({...f,...next}));if(Object.keys(next)[0])setActive(Object.keys(next)[0]);setSaved(false);setLocalStatus("Folder dimuat: "+Object.keys(next).length+" file")}
 async function sendAi(){const prompt=ai.trim();if(!prompt||aiBusy)return;setAi("");setAiBusy(true);const msgs=[...aiMessages,{role:"user",content:prompt+"\n\nFile aktif: "+active+"\nIsi file:\n"+code.slice(0,18000)}];setAiMessages(msgs);try{const result=await chatWithRouter(routerConfig,msgs);setAiMessages(m=>[...m,{role:"assistant",content:result}])}catch(e){setAiMessages(m=>[...m,{role:"assistant",content:"Error: "+e.message}])}finally{setAiBusy(false)}}
 async function testRouter(){setRouterStatus("Memeriksa...");const models=await syncRouterModels();if(models.length)setRouterStatus("Terhubung · "+models.length+" model");else setRouterStatus(routerStats.error||"Tidak ada model aktif.")}
 function saveRouterLocal(){saveRouterConfig(routerConfig);setRouterOpen(false);setRouterStatus("Konfigurasi tersimpan")}
 useEffect(()=>{if(!routerConfig.apiKey)return;syncRouterModels();const timer=setInterval(syncRouterModels,60000);return()=>clearInterval(timer)},[routerConfig.apiKey,routerConfig.baseUrl]);
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
 function runTerminal(){
  const command=terminalInput.trim();if(!command)return;
  const blocked=/\b(format|del\s+\/s|rd\s+\/s|rmdir\s+\/s|remove-item\s+-recurse|git\s+reset\s+--hard|git\s+clean\s+-fd|rm\s+-rf)\b/i;
  setTerminalLines(x=>[...x,"PS MAX> "+command]);
  setTerminalInput("");
  if(blocked.test(command)){setTerminalLines(x=>[...x,"Command diblokir karena berpotensi menghapus data."]);return}
  if(!localSocket.current||localSocket.current.readyState!==WebSocket.OPEN){setTerminalLines(x=>[...x,"Local Agent belum terhubung. Klik Integrasi → Local Agent → Hubungkan."]);return}
  localSocket.current.send(JSON.stringify({type:"exec",command}));
 }
 if(!supabase)return <div className="auth-screen"><div className="auth-card"><h1>MAX Editor</h1><p>Supabase belum dikonfigurasi.</p></div></div>;
 if(!session)return <CloudAuth onSession={setSession}/>;
 return <div className="app">
   <input ref={dirInput} type="file" webkitdirectory="" directory="" multiple hidden onChange={importSelectedFiles}/>
   <header className="topbar">
    <div className="brand"><span className="brand-mark">M</span><strong>MAX Editor</strong><span className="badge">ONLINE</span></div>
    <div className="top-actions"><span className="cloud"><Cloud size={14}/> {workspace?"Supabase Cloud":"Cloud"}</span><button title="Ambil folder Windows" onClick={importFolder}><FolderInput size={16}/></button><button title="MAX Router" onClick={()=>setRouterOpen(true)}><PlugZap size={16}/></button><GitWorkspace/><button title="Integrasi Developer" onClick={()=>setIntegrationsOpen(true)}><PlugZap size={16}/></button><button title="Simpan" onClick={save}><Save size={16}/></button><button onClick={()=>supabase.auth.signOut()} title="Keluar"><LogOut size={16}/></button></div>
   </header>
   <div className="workspace">
    <aside className="sidebar">
      <div className="side-head"><span>EXPLORER</span><div><button onClick={importFolder}><FolderInput size={14}/></button><button onClick={createFile}><Plus size={15}/></button></div></div>
      <div className="project"><FolderOpen size={15}/><strong>{workspace?.name||"MAX Workspace"}</strong><ChevronDown size={14}/></div>
      {Object.keys(files).sort().map(name=><FileItem key={name} name={name} active={active===name} onClick={()=>setActive(name)}/>)}
      <div className="folder"><Folder size={15}/><span>src</span></div>
      <FileItem name="App.js" active={active==="src/App.js"} onClick={()=>setActive("src/App.js")}/>
      <FileItem name="index.js" active={active==="src/index.js"} onClick={()=>setActive("src/index.js")}/>
      <div className="side-bottom"><div><Cloud size={15}/> Autosave cloud</div><small>{saved?"Tersimpan di Supabase":"Perubahan belum disimpan"}</small></div>
    </aside>
    <main className="editor-area">
      <div className="tabs"><div className="tab active"><FileCode2 size={14}/>{active}<span className={saved?"":"dirty"}>{saved?"":"●"}</span></div><div className="tab-spacer"/><button><Search size={15}/></button></div>
      <div className="monaco"><Editor theme="vs-dark" language={language} value={code} onChange={updateCode} onMount={(editor)=>editor.focus()} options={{fontSize:14,minimap:{enabled:false},automaticLayout:true,padding:{top:14},smoothScrolling:true,scrollBeyondLastLine:false,renderWhitespace:"selection"}}/></div>
      {terminal&&<div className="terminal"><div className="terminal-head"><span><Terminal size={14}/> TERMINAL · {localStatus}</span><button onClick={()=>setTerminal(false)}>×</button></div><div className="terminal-body">{terminalLines.map((line,i)=><div key={i}>{line}</div>)}<div><span className="prompt">PS MAX&gt;</span> <input value={terminalInput} onChange={e=>setTerminalInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")runTerminal()}} placeholder="ketik command Windows..." autoFocus/></div></div></div>}
      <div className="statusbar"><span>Ln 1, Col 1</span><span>{language}</span><span>UTF-8</span><button onClick={()=>setTerminal(!terminal)}><Terminal size={13}/> Terminal</button></div>
    </main>
    <aside className="ai-panel">
      <div className="ai-head"><div><MessageSquare size={16}/><strong>MAX AI</strong></div><span>Router</span></div>
      <div className="ai-body">{aiMessages.length===0?<div className="ai-empty"><div className="ai-icon">M</div><h3>AI Coding Assistant</h3><p>Analisis file, cari bug, atau minta perubahan melalui Max Router.</p><div className="suggestions"><button onClick={()=>setAi("Jelaskan file ini")}>Jelaskan file ini</button><button onClick={()=>setAi("Cari bug di file ini")}>Cari bug</button><button onClick={()=>setAi("Optimalkan kode ini")}>Optimalkan</button></div></div>:<div className="ai-messages">{aiMessages.map((m,i)=><div key={i} className={"ai-message "+m.role}><span>{m.role==="user"?"Kamu":"MAX AI"}</span><div>{m.content}</div></div>)}</div>}</div>
      <div className="ai-input"><textarea value={ai} onChange={e=>setAi(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAi()}}} placeholder="Tanya MAX AI..."/><button onClick={sendAi} disabled={aiBusy}><Play size={15}/></button></div>
      <div className="provider">MAX Router · {routerConfig.model}</div>
    </aside>
   </div>
   {routerOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setRouterOpen(false)}}><div className="router-modal">
     <div className="router-modal-head"><strong>MAX Router</strong><button onClick={()=>setRouterOpen(false)}><X size={18}/></button></div>
     <p>Hubungkan editor ke API OpenAI-compatible Max Router.</p>
     <label>Base URL<input value={routerConfig.baseUrl} onChange={e=>setRouterConfig(x=>({...x,baseUrl:e.target.value}))}/></label>
     <label>API Key<input type="password" value={routerConfig.apiKey} onChange={e=>setRouterConfig(x=>({...x,apiKey:e.target.value}))} placeholder="Bearer key dari Max Router"/></label>
     <div className="router-model-stats">
       <div><span>Total model</span><strong>{routerStats.loading?"…":routerStats.total}</strong></div>
       <div><span>Gratis</span><strong className="free">{routerStats.loading?"…":routerStats.free}</strong></div>
       <div><span>Berbayar</span><strong className="paid">{routerStats.loading?"…":routerStats.paid}</strong></div>
       <div><span>Harga tidak diketahui</span><strong>{routerStats.loading?"…":routerStats.unknown}</strong></div>
     </div>
     <div className="router-sync-line">{routerStats.syncedAt?"Sinkron terakhir "+routerStats.syncedAt:"Belum disinkron"}{routerStats.error?" · "+routerStats.error:""}</div>
     <div className="router-status-box">{routerStatus||"Daftar model akan disinkron otomatis dari Max Router."}</div>
     <div><button onClick={syncRouterModels} disabled={routerStats.loading}><RefreshCw size={13}/> Sinkron model</button><button className="primary" onClick={saveRouterLocal}>Simpan</button></div>
   </div></div>}
   {integrationsOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setIntegrationsOpen(false)}}><div className="router-modal">
     <div className="router-modal-head"><strong>Integrasi Developer</strong><button onClick={()=>setIntegrationsOpen(false)}><X size={18}/></button></div>
     <div className="integration-row"><Github size={18}/><div><strong>GitHub</strong><small>Gunakan terminal lokal untuk clone, pull, commit, dan push tanpa menyimpan token di browser.</small></div></div>
     <div className="integration-row"><GitBranch size={18}/><div><strong>GitLab</strong><small>Command GitLab juga dapat dijalankan melalui Local Agent.</small></div></div>
     <div className="integration-row"><Terminal size={18}/><div><strong>Local Agent</strong><small>{localStatus}</small><button className="wide" onClick={connectLocal}>Hubungkan Local Agent</button></div></div>
     <button className="wide" onClick={()=>{setIntegrationsOpen(false);setTerminal(true);connectLocal()}}>Buka Terminal</button>
   </div></div>}
 </div>
}