import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const base = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number(process.env.PORT || 3000);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
const rooms = new Map();
const clients = new Map();
const GAMES = new Set(['tombala','okey','101','kelime','bilardo','langirt']);
function roomsView(){ return [...rooms.values()].map(({id,game,name,players,created})=>({id,game,name,players:players.size,max: game==='tombala'?24:game==='kelime'?2:game==='bilardo'?2:game==='langirt'?2:4,created})); }
function send(ws, obj){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function broadcast(){const packet=JSON.stringify({type:'state',online:clients.size,rooms:roomsView()});for(const ws of clients.keys())if(ws.readyState===WebSocket.OPEN)ws.send(packet);}
function leave(ws){const state=clients.get(ws);if(!state?.room)return;const room=rooms.get(state.room);if(room){room.players.delete(ws);if(!room.players.size)rooms.delete(room.id);}state.room=null;}
const server = http.createServer((req,res)=>{
  const url = new URL(req.url||'/', 'http://localhost');
  if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));return;}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  let filename;
  try {filename=decodeURIComponent(url.pathname);} catch{res.writeHead(400);res.end();return;}
  if(filename==='/'||filename==='/index.html')filename='/index.html';
  const full=path.resolve(base,'.'+filename);
  if(!full.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  fs.stat(full,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    if(req.method==='HEAD'){res.end();return;}fs.createReadStream(full).pipe(res);
  });
});
const wss = new WebSocketServer({server,maxPayload:2048});
wss.on('connection',(ws)=>{
  clients.set(ws,{room:null,lastAction:0});send(ws,{type:'hello',message:'Demo ortamına bağlandınız.'});broadcast();
  ws.on('message',(buf)=>{
    let data;try{data=JSON.parse(buf.toString())}catch{return;}
    const user=clients.get(ws);if(!user||Date.now()-user.lastAction<350)return;user.lastAction=Date.now();
    if(data.type==='create'){
      if(!GAMES.has(data.game)||rooms.size>=100)return send(ws,{type:'error',message:'Masa oluşturulamadı.'});
      leave(ws);const game=data.game;const name=String(data.name||'Yeni masa').trim().slice(0,36)||'Yeni masa';
      const id=crypto.randomUUID().slice(0,8);const room={id,game,name,players:new Set([ws]),created:Date.now()};rooms.set(id,room);user.room=id;
      send(ws,{type:'joined',room:id});broadcast();
    } else if(data.type==='join'){
      const room=rooms.get(String(data.id||''));if(!room)return send(ws,{type:'error',message:'Masa bulunamadı.'});
      const max=room.game==='tombala'?24:['kelime','bilardo','langirt'].includes(room.game)?2:4;
      if(room.players.size>=max)return send(ws,{type:'error',message:'Masa dolu.'});
      leave(ws);room.players.add(ws);user.room=room.id;send(ws,{type:'joined',room:room.id});broadcast();
    } else if(data.type==='leave'){leave(ws);send(ws,{type:'left'});broadcast();}
  });
  ws.on('close',()=>{leave(ws);clients.delete(ws);broadcast();});ws.on('error',()=>{});
});
server.listen(port,'0.0.0.0',()=>console.log(`Game lobby demo listening on ${port}`));
