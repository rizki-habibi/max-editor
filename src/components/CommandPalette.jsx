import {useEffect,useMemo,useRef,useState} from "react";
import {filterCommands} from "../lib/commands";

function Highlighted({text,indexes}) {
  if(!indexes.length)return text;
  const marked=new Set(indexes);
  return [...text].map((ch,i)=>marked.has(i)?<mark key={i}>{ch}</mark>:ch);
}

export default function CommandPalette({open,commands,onClose}) {
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState(0);
  const inputRef=useRef(null),listRef=useRef(null);
  const results=useMemo(()=>filterCommands(commands,query),[commands,query]);

  useEffect(()=>{if(open){setQuery("");setSelected(0);requestAnimationFrame(()=>inputRef.current?.focus())}},[open]);
  useEffect(()=>{setSelected(0)},[query]);
  useEffect(()=>{listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:"nearest"})},[selected,results]);

  if(!open)return null;
  const run=(item)=>{if(!item)return;onClose();setTimeout(()=>item.command.run(),0)}; // close first so prompts/dialogs open on a clean screen
  function onKeyDown(e) {
    if(e.key==="Escape"){e.preventDefault();onClose()}
    else if(e.key==="ArrowDown"){e.preventDefault();setSelected(i=>Math.min(i+1,results.length-1))}
    else if(e.key==="ArrowUp"){e.preventDefault();setSelected(i=>Math.max(i-1,0))}
    else if(e.key==="Enter"){e.preventDefault();run(results[selected])}
  }
  let lastGroup=null;
  return <div className="palette-backdrop" onMouseDown={onClose}>
    <div className="palette" role="dialog" aria-modal="true" aria-label="Palet perintah" onMouseDown={e=>e.stopPropagation()} onKeyDown={onKeyDown}>
      <input ref={inputRef} className="palette-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari file atau perintah…" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={results[selected]?"palette-opt-"+selected:undefined} spellCheck={false} autoComplete="off"/>
      <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
        {results.length===0&&<div className="palette-empty">Tidak ada hasil untuk “{query}”.</div>}
        {results.map((item,i)=>{
          const {command}=item;
          const header=!query.trim()&&command.group!==lastGroup?<div className="palette-group" key={"g-"+command.group+i}>{command.group}</div>:null;
          lastGroup=command.group;
          return [header,
            <div key={command.id} id={"palette-opt-"+i} role="option" aria-selected={i===selected} className={"palette-item"+(i===selected?" selected":"")} onMouseMove={()=>setSelected(i)} onClick={()=>run(item)}>
              <span className="palette-title"><Highlighted text={command.title} indexes={item.indexes}/></span>
              {command.subtitle&&<small className="palette-sub">{command.subtitle}</small>}
              {query.trim()&&<small className="palette-group-tag">{command.group}</small>}
              {command.hint&&<kbd>{command.hint}</kbd>}
            </div>];
        })}
      </div>
      <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> pilih</span><span><kbd>Enter</kbd> jalankan</span><span><kbd>Esc</kbd> tutup</span></div>
    </div>
  </div>;
}
