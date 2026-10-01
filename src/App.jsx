import {useEffect,useMemo,useState} from "react";
import Editor from "@monaco-editor/react";
import {FileCode2,Folder,FolderOpen,GitBranch,Play,Plus,Search,Settings,Terminal,ChevronDown,MessageSquare,Cloud,Save,LogIn,LogOut} from "lucide-react";
import {supabase} from "./lib/supabase";

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


function CloudAuth({onSession}){const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[signup,setSignup]=useState(false),[msg,setMsg]=useState("");async function go(e){e.preventDefault();setMsg("");const r=signup?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});if(r.error)setMsg(r.error.message);else if(r.data.session)onSession(r.data.session);else setMsg("Akun dibuat. Konfirmasi email jika diminta.");}return <div className="auth-screen"><form className="auth-card" onSubmit={go}><div className="brand-mark">M</div><h1>MAX Editor</h1><p>Masuk untuk workspace coding cloud.</p><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} minLength="6" required/>{msg&&<small>{msg}</small>}<button className="auth-submit"><LogIn size={15}/>{signup?"Buat akun":"Masuk"}</button><button type="button" className="switch-auth" onClick={()=>setSignup(!signup)}>{signup?"Sudah punya akun? Masuk":"Belum punya akun? Buat akun"}</button></form></div>}

export default function App(){
 const [files,setFiles]=useState({});
 const [session,setSession]=useState(null);
 const [workspace,setWorkspace]=useState(null);
 const [active,setActive]=useState("README.md");
 const [ai,setAi]=useState("");
 const [terminal,setTerminal]=useState(false);
 const [saved,setSaved]=useState(true);
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(!session)return;(async()=>{let {data:w}=await supabase.from("editor_workspaces").select("*").eq("owner_id",session.user.id).order("created_at").limit(1).maybeSingle();if(!w){const r=await supabase.from("editor_workspaces").insert({owner_id:session.user.id,name:"MAX Workspace"}).select().single();w=r.data;if(w)await supabase.from("editor_files").insert(Object.entries(initialFiles).map(([path,content])=>({workspace_id:w.id,path,content,language:path.endsWith(".md")?"markdown":"javascript"})))}setWorkspace(w);if(w){const {data}=await supabase.from("editor_files").select("*").eq("workspace_id",w.id).order("path");setFiles(Object.fromEntries((data||[]).map(x=>[x.path,x.content])));}})()},[session]);
 const code=files[active]??"";
 const language=useMemo(()=>active.endsWith(".md")?"markdown":active.endsWith(".json")?"json":active.endsWith(".css")?"css":active.endsWith(".html")?"html":"javascript",[active]);

 function updateCode(value){setFiles(f=>({...f,[active]:value??""}));setSaved(false)}
 async function save(){if(!workspace)return setSaved(true);const r=await supabase.from("editor_files").upsert({workspace_id:workspace.id,path:active,content:files[active]??"",language},{onConflict:"workspace_id,path"});if(r.error)alert(r.error.message);else setSaved(true)}
 function createFile(){const n=prompt("Nama file baru");if(!n)return;setFiles(f=>({...f,[n]:""}));setActive(n);setSaved(false)}
 if(!supabase)return <div className="auth-screen"><div className="auth-card"><h1>MAX Editor</h1><p>Supabase belum dikonfigurasi.</p></div></div>;
 if(!session)return <CloudAuth onSession={setSession}/>;
 return <div className="app">
   <header className="topbar">
    <div className="brand"><span className="brand-mark">M</span><strong>MAX Editor</strong><span className="badge">ONLINE</span></div>
    <div className="top-actions"><span className="cloud"><Cloud size={14}/> {workspace?"Supabase Cloud":"Cloud"}</span><button title="Simpan" onClick={save}><Save size={16}/></button><button title="Runway" onClick={()=>runway().catch(e=>alert(e.message))}>Runway</button><button><GitBranch size={16}/> main</button><button onClick={()=>supabase.auth.signOut()} title="Keluar"><LogOut size={16}/></button><button><Settings size={16}/></button></div>
   </header>
   <div className="workspace">
    <aside className="sidebar">
      <div className="side-head"><span>EXPLORER</span><button onClick={createFile}><Plus size={15}/></button></div>
      <div className="project"><FolderOpen size={15}/><strong>{workspace?.name||"MAX Workspace"}</strong><ChevronDown size={14}/></div>
      <FileItem name="README.md" active={active==="README.md"} onClick={()=>setActive("README.md")}/>
      <div className="folder"><Folder size={15}/><span>src</span></div>
      <FileItem name="App.js" active={active==="src/App.js"} onClick={()=>setActive("src/App.js")}/>
      <FileItem name="index.js" active={active==="src/index.js"} onClick={()=>setActive("src/index.js")}/>
      <div className="side-bottom"><div><Cloud size={15}/> Autosave cloud</div><small>{saved?"Tersimpan di Supabase":"Perubahan belum disimpan"}</small></div>
    </aside>
    <main className="editor-area">
      <div className="tabs"><div className="tab active"><FileCode2 size={14}/>{active}<span className={saved?"":"dirty"}>{saved?"":"●"}</span></div><div className="tab-spacer"/><button><Search size={15}/></button></div>
      <div className="monaco"><Editor theme="vs-dark" language={language} value={code} onChange={updateCode} onMount={(editor)=>editor.focus()} options={{fontSize:14,minimap:{enabled:false},automaticLayout:true,padding:{top:14},smoothScrolling:true,scrollBeyondLastLine:false,renderWhitespace:"selection"}}/></div>
      {terminal&&<div className="terminal"><div className="terminal-head"><span><Terminal size={14}/> TERMINAL</span><button onClick={()=>setTerminal(false)}>×</button></div><div className="terminal-body"><span className="prompt">max-editor</span> $ echo "Workspace online"</div></div>}
      <div className="statusbar"><span>Ln 1, Col 1</span><span>{language}</span><span>UTF-8</span><button onClick={()=>setTerminal(!terminal)}><Terminal size={13}/> Terminal</button></div>
    </main>
    <aside className="ai-panel">
      <div className="ai-head"><div><MessageSquare size={16}/><strong>MAX AI</strong></div><span>Router</span></div>
      <div className="ai-body"><div className="ai-empty"><div className="ai-icon">M</div><h3>AI Coding Assistant</h3><p>Tanyakan kode, minta perbaikan, atau minta AI membuat perubahan pada workspace.</p><div className="suggestions"><button onClick={()=>setAi("Jelaskan file ini")}>Jelaskan file ini</button><button onClick={()=>setAi("Cari bug di file ini")}>Cari bug</button><button onClick={()=>setAi("Optimalkan kode ini")}>Optimalkan</button></div></div></div>
      <div className="ai-input"><textarea value={ai} onChange={e=>setAi(e.target.value)} placeholder="Tanya MAX AI..."/><button><Play size={15}/></button></div>
      <div className="provider">MAX Router · AI gateway</div>
    </aside>
   </div>
 </div>
}