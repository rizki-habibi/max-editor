import {useMemo,useState} from "react";
import Editor from "@monaco-editor/react";
import {FileCode2,Folder,FolderOpen,GitBranch,Play,Plus,Search,Settings,Terminal,ChevronDown,MessageSquare,Cloud,Save} from "lucide-react";

const initialFiles={
  "README.md":"# MAX Editor\n\nEditor coding online berbasis browser.\n\n- Monaco Editor\n- Workspace cloud siap Supabase\n- AI panel siap Max Router\n- GitHub integration siap dikembangkan\n",
  "src/App.js":"export default function hello() {\n  console.log('Hello from MAX Editor');\n}\n",
  "src/index.js":"import hello from './App.js';\n\nhello();\n"
};

function FileItem({name,active,onClick,folder=false}) {
  return <button className={`file-item ${active?'active':''}`} onClick={onClick}>{folder?<Folder size={15}/>:<FileCode2 size={15}/>}<span>{name}</span></button>
}

export default function App(){
 const [files,setFiles]=useState(initialFiles);
 const [active,setActive]=useState("README.md");
 const [ai,setAi]=useState("");
 const [terminal,setTerminal]=useState(false);
 const [saved,setSaved]=useState(true);
 const code=files[active]??"";
 const language=useMemo(()=>active.endsWith(".md")?"markdown":active.endsWith(".json")?"json":active.endsWith(".css")?"css":active.endsWith(".html")?"html":"javascript",[active]);

 function updateCode(value){setFiles(f=>({...f,[active]:value??""}));setSaved(false)}
 function save(){setSaved(true)}
 function createFile(){const n=prompt("Nama file baru");if(!n)return;setFiles(f=>({...f,[n]:""}));setActive(n);setSaved(false)}
 return <div className="app">
   <header className="topbar">
    <div className="brand"><span className="brand-mark">M</span><strong>MAX Editor</strong><span className="badge">ONLINE</span></div>
    <div className="top-actions"><span className="cloud"><Cloud size={14}/> Cloud workspace</span><button title="Simpan" onClick={save}><Save size={16}/></button><button><GitBranch size={16}/> main</button><button><Settings size={16}/></button></div>
   </header>
   <div className="workspace">
    <aside className="sidebar">
      <div className="side-head"><span>EXPLORER</span><button onClick={createFile}><Plus size={15}/></button></div>
      <div className="project"><FolderOpen size={15}/><strong>max-editor</strong><ChevronDown size={14}/></div>
      <FileItem name="README.md" active={active==="README.md"} onClick={()=>setActive("README.md")}/>
      <div className="folder"><Folder size={15}/><span>src</span></div>
      <FileItem name="App.js" active={active==="src/App.js"} onClick={()=>setActive("src/App.js")}/>
      <FileItem name="index.js" active={active==="src/index.js"} onClick={()=>setActive("src/index.js")}/>
      <div className="side-bottom"><div><Cloud size={15}/> Autosave cloud</div><small>{saved?"Tersimpan":"Perubahan belum disimpan"}</small></div>
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