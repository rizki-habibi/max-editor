import {useRef,useState} from "react";
import {Download,FileText,FileSpreadsheet,FileType,Plus,Upload,X} from "lucide-react";
import * as XLSX from "xlsx";
import {Document,Packer,Paragraph,TextRun} from "docx";
import {jsPDF} from "jspdf";

const FORMATS=[
 {id:"txt",label:"Teks",ext:"txt"},{id:"md",label:"Markdown",ext:"md"},
 {id:"csv",label:"CSV",ext:"csv"},{id:"xlsx",label:"Excel",ext:"xlsx"},
 {id:"docx",label:"Word",ext:"docx"},{id:"pdf",label:"PDF",ext:"pdf"},
 {id:"html",label:"HTML",ext:"html"},{id:"json",label:"JSON",ext:"json"}
];
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function safeName(name){return (name||"dokumen").replace(/\.[^.]+$/,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"")||"dokumen"}
function textRows(content){return String(content||"").split(/\r?\n/).map(line=>[line])}
function csvEscape(value){const s=String(value??"");return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s}
export default function DocumentsPanel({files,active,code,onClose,onCreate}){
 const [name,setName]=useState("Dokumen baru");
 const [format,setFormat]=useState("docx");
 const [status,setStatus]=useState("");
 const [error,setError]=useState("");
 const inputRef=useRef(null);
 const content=String(code??"");
 async function exportDocument(selected=format){
  setError("");setStatus("");
  const base=safeName(name||active||"dokumen");
  try{
   if(selected==="xlsx"){
    const rows=textRows(content);const ws=XLSX.utils.aoa_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Dokumen");XLSX.writeFile(wb,base+".xlsx");
   }else if(selected==="csv"){
    const csv=textRows(content).map(row=>row.map(csvEscape).join(",")).join("\r\n");
    downloadBlob(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}),base+".csv");
   }else if(selected==="docx"){
    const paragraphs=content.split(/\r?\n/).map(line=>new Paragraph({children:[new TextRun(line||" ")]}));
    const doc=new Document({sections:[{children:paragraphs.length?paragraphs:[new Paragraph("")]}]});
    downloadBlob(await Packer.toBlob(doc),base+".docx");
   }else if(selected==="pdf"){
    const pdf=new jsPDF({unit:"pt",format:"a4"});const margin=48;const width=pdf.internal.pageSize.getWidth()-margin*2;
    const lines=pdf.splitTextToSize(content||" ",width);let y=margin;const lineHeight=15;
    for(const line of lines){if(y>pdf.internal.pageSize.getHeight()-margin){pdf.addPage();y=margin}pdf.text(line,margin,y);y+=lineHeight}
    pdf.save(base+".pdf");
   }else if(selected==="json"){
    let parsed;try{parsed=JSON.parse(content)}catch{parsed={nama:active||name,isi:content}}
    downloadBlob(new Blob([JSON.stringify(parsed,null,2)],{type:"application/json;charset=utf-8"}),base+".json");
   }else if(selected==="html"){
    const html="<!doctype html><html lang=\"id\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>"+base+"</title></head><body><pre style=\"white-space:pre-wrap;font:14px/1.6 system-ui\">"+content.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")+"</pre></body></html>";
    downloadBlob(new Blob([html],{type:"text/html;charset=utf-8"}),base+".html");
   }else{
    downloadBlob(new Blob([content],{type:selected==="md"?"text/markdown;charset=utf-8":"text/plain;charset=utf-8"}),base+"."+selected);
   }
   setStatus("Dokumen berhasil dibuat: "+base+"."+selected);
  }catch(e){setError("Gagal membuat dokumen: "+(e?.message||String(e)))}
 }
 function createBlank(){
  const ext=({txt:"txt",md:"md",csv:"csv",xlsx:"xlsx",docx:"txt",pdf:"txt",html:"html",json:"json"})[format]||"txt";
  const initial=({csv:"Kolom 1,Kolom 2\nData 1,Data 2",json:"{\n  \"judul\": \"Dokumen baru\"\n}",html:"<!doctype html>\n<html lang=\"id\">\n<head><meta charset=\"utf-8\"><title>Dokumen baru</title></head>\n<body>\n</body>\n</html>"})[format]||"";
  onCreate?.((name.trim()||"Dokumen baru")+"."+ext,initial);
  setStatus("File kerja baru dibuat. Untuk membuat "+format.toUpperCase()+", gunakan tombol Unduh.");
 }
 async function importText(e){
  const file=e.target.files?.[0];if(!file)return;
  try{const text=await file.text();onCreate?.(file.name,text);setName(file.name.replace(/\.[^.]+$/,""));setStatus("File teks diimpor ke workspace: "+file.name)}
  catch(err){setError("Gagal membaca file: "+err.message)}
  e.target.value="";
 }
 return <div className="modal-backdrop documents-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}>
  <section className="router-modal documents-modal">
   <div className="router-modal-head"><strong><FileText size={17}/> Dokumen & Ekspor</strong><button onClick={onClose} aria-label="Tutup"><X size={18}/></button></div>
   <p>Buat file kerja atau ekspor isi editor menjadi format dokumen umum.</p>
   <label>Nama dokumen<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama dokumen"/></label>
   <label>Format keluaran<select value={format} onChange={e=>setFormat(e.target.value)}>{FORMATS.map(f=><option key={f.id} value={f.id}>{f.label} (.{f.ext})</option>)}</select></label>
   <div className="document-format-grid">
    <button onClick={()=>exportDocument("xlsx")}><FileSpreadsheet size={18}/><span>Excel</span><small>.xlsx</small></button>
    <button onClick={()=>exportDocument("docx")}><FileText size={18}/><span>Word</span><small>.docx</small></button>
    <button onClick={()=>exportDocument("pdf")}><FileType size={18}/><span>PDF</span><small>.pdf</small></button>
    <button onClick={()=>exportDocument("csv")}><FileSpreadsheet size={18}/><span>CSV</span><small>.csv</small></button>
   </div>
   <div className="document-actions">
    <button onClick={createBlank}><Plus size={14}/> Buat file kerja</button>
    <button className="primary" onClick={()=>exportDocument()}><Download size={14}/> Unduh {format.toUpperCase()}</button>
    <button onClick={()=>inputRef.current?.click()}><Upload size={14}/> Impor teks</button>
    <input ref={inputRef} type="file" accept=".txt,.md,.csv,.json,.html,.js,.jsx,.ts,.tsx,.css,.xml,.yml,.yaml,.log" hidden onChange={importText}/>
   </div>
   <small className="document-note">Ekspor menggunakan isi file aktif: <strong>{active}</strong>. XLSX membuat lembar kerja dari baris teks; Word/PDF membuat dokumen yang bisa dibuka atau dicetak.</small>
   {status&&<div className="document-success">{status}</div>}{error&&<div className="git-error">{error}</div>}
  </section>
 </div>;
}
