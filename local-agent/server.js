import http from "node:http";
import {exec} from "node:child_process";
import {WebSocketServer} from "ws";
const PORT=8765;
const ALLOWED_ORIGINS=new Set(["https://max-editor-production.up.railway.app","http://localhost:5173","http://127.0.0.1:5173"]);
const server=http.createServer((req,res)=>{const origin=req.headers.origin||"";if(req.url==="/health"){res.writeHead(200,{"Content-Type":"application/json","Access-Control-Allow-Origin":origin});return res.end(JSON.stringify({ok:true,service:"MAX Editor Local Agent"}));}res.writeHead(404);res.end("Not found");});
const wss=new WebSocketServer({server});
wss.on("connection",(socket,request)=>{const origin=request.headers.origin||"";if(!ALLOWED_ORIGINS.has(origin)){socket.close(1008,"Origin not allowed");return;}socket.send(JSON.stringify({type:"ready",message:"MAX Local Agent terhubung"}));socket.on("message",raw=>{let msg;try{msg=JSON.parse(raw.toString())}catch{return}if(msg.type!=="exec"||typeof msg.command!=="string"||msg.command.length>4000)return;exec(msg.command,{cwd:msg.cwd||process.cwd(),windowsHide:true,maxBuffer:4*1024*1024},(error,stdout,stderr)=>{socket.send(JSON.stringify({type:"result",code:error?.code??0,stdout:stdout||"",stderr:stderr||""}));});});});
server.listen(PORT,"127.0.0.1",()=>console.log("MAX Editor Local Agent: http://127.0.0.1:"+PORT));