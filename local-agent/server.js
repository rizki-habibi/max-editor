import http from "node:http";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {WebSocketServer} from "ws";

const PORT=8765;
const ALLOWED_ORIGINS=new Set([
  "https://max-editor-production.up.railway.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);
const execFileAsync=promisify(execFile);
const server=http.createServer((req,res)=>{
  const origin=req.headers.origin||"";
  if(req.url==="/health"){
    if(origin && !ALLOWED_ORIGINS.has(origin)){res.writeHead(403);return res.end("Forbidden");}
    res.writeHead(200,{"Content-Type":"application/json","Access-Control-Allow-Origin":origin||"null","Vary":"Origin"});
    return res.end(JSON.stringify({ok:true,service:"MAX Editor Local Agent"}));
  }
  res.writeHead(404);res.end("Not found");
});
const wss=new WebSocketServer({server,maxPayload:8192});

function parseAllowedCommand(command){
  const fixed={
    "git status --short --branch":["git",["status","--short","--branch"]],
    "git branch --show-current":["git",["branch","--show-current"]],
    "git remote get-url origin":["git",["remote","get-url","origin"]],
    "git pull --ff-only":["git",["pull","--ff-only"]],
    "npm run check":["npm",["run","check"]],
    "git rev-parse --is-inside-work-tree":["git",["rev-parse","--is-inside-work-tree"]],
    "git init -b main":["git",["init","-b","main"]]
  };
  if(fixed[command])return [{file:fixed[command][0],args:fixed[command][1]}];
  const commit=command.match(/^git add -A && git commit -m "((?:[^"\\]|\\.)*)" && git push$/);
  if(commit){
    const message=commit[1].replace(/\\(["\\])/g,"$1");
    if(!message.trim())return null;
    return [
      {file:"git",args:["add","-A"]},
      {file:"git",args:["commit","-m",message]},
      {file:"git",args:["push"]}
    ];
  }
  const create=command.match(/^gh repo create ([A-Za-z0-9._-]+) --(private|public) --source=\. --remote=origin --push$/);
  if(create)return [{file:"gh",args:["repo","create",create[1],"--"+create[2],"--source=.","--remote=origin","--push"]}];
  return null;
}
async function runAllowed(actions,cwd){
  let stdout="",stderr="";
  for(const action of actions){
    try{
      const result=await execFileAsync(action.file,action.args,{cwd,windowsHide:true,maxBuffer:4*1024*1024,timeout:120000});
      stdout+=result.stdout||"";stderr+=result.stderr||"";
    }catch(error){
      stdout+=error.stdout||"";stderr+=error.stderr||"";
      return {code:typeof error.code==="number"?error.code:1,stdout,stderr:stderr||error.message};
    }
  }
  return {code:0,stdout,stderr};
}
wss.on("connection",(socket,request)=>{
  const origin=request.headers.origin||"";
  if(!ALLOWED_ORIGINS.has(origin)){socket.close(1008,"Origin not allowed");return;}
  socket.send(JSON.stringify({type:"ready",message:"MAX Local Agent terhubung"}));
  socket.on("message",async raw=>{
    let msg;try{msg=JSON.parse(raw.toString())}catch{return}
    if(msg.type!=="exec"||typeof msg.command!=="string"||msg.command.length>4000)return;
    const actions=parseAllowedCommand(msg.command);
    if(!actions){socket.send(JSON.stringify({type:"result",code:126,stdout:"",stderr:"Perintah tidak diizinkan oleh MAX Local Agent."}));return;}
    const cwd=typeof msg.cwd==="string"&&msg.cwd.trim()?path.resolve(msg.cwd):process.cwd();
    const result=await runAllowed(actions,cwd);
    if(socket.readyState===1)socket.send(JSON.stringify({type:"result",...result}));
  });
});
server.listen(PORT,"127.0.0.1",()=>console.log("MAX Editor Local Agent: http://127.0.0.1:"+PORT));
