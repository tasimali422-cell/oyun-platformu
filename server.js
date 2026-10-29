import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const base = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number(process.env.PORT || 3000);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
const rooms = new Map();
const clients = new Map();
const GAMES = new Set(['tombala','okey','101','kelime','bilardo','langirt']);
const maxFor = game => game==='tombala'?24:['kelime','bilardo','langirt'].includes(game)?2:4;
const clean = (value, max=36) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const send = (ws, data) => {if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(data));};
function view(room){return {id:room.id,game:room.game,name:room.name,players:room.players.size,max:maxFor(room.game),created:room.created,started:room.started};}
function list(){return [...rooms.values()].map(view);}
function broadcast(){const packet=JSON.stringify({type:'state',online:clients.size,rooms:list()});for(const ws of clients.keys())if(ws.readyState===WebSocket.OPEN)ws.send(packet);}
function tiles(){
 const a=[];for(let copy=0;copy<2;copy++)for(let color=0;color<4;color++)for(let n=1;n<=13;n++)a.push({id:randomUUID(),color,n});
 for(let j=0;j<2;j++)a.push({id:randomUUID(),color:4,n:0});
 for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
function gameState(room,ws){if(!room.round)return null;const g=room.round;const idx=g.order.indexOf(ws);if(idx<0)return null;return {mySeat:idx+1,hand:g.hands[idx],turn:g.turn+1,phase:g.phase,wall:g.wall.length,discard:g.discard.slice(-8).map(t=>({...t})),roundStatus:g.status,notice:g.notice};}
function beginOkey(room){const deck=tiles();const order=[...room.players];const hands=order.map((_,i)=>deck.splice(0,i===0?15:14));room.round={order,hands,wall:deck,discard:[],turn:0,phase:'discard',status:'playing',notice:'İlk oyuncu taş atacak.'};}
function notifyRoom(room){const seats=[...room.players].map((ws,i)=>({seat:i+1,name:clients.get(ws)?.name||'Misafir',host:ws===room.host}));for(const ws of room.players)send(ws,{type:'room',...view(room),seats,host:ws===room.host,chat:room.chat,gameState:gameState(room,ws)});}
function leave(ws){const state=clients.get(ws);if(!state?.room)return;const room=rooms.get(state.room);state.room=null;if(!room)return;room.players.delete(ws);if(!room.players.size){rooms.delete(room.id);}else{if(room.host===ws)room.host=room.players.values().next().value;if(room.round){room.round.status='stopped';room.round.notice='Bir oyuncu ayrıldı. Yeni el için masa yeniden kurulmalı.';room.started=false;room.round=null;}notifyRoom(room);}}
const server = http.createServer((req,res)=>{
  const url=new URL(req.url||'/','http://localhost');
  if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true}));return;}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  let filename;try{filename=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
  if(filename==='/'||filename==='/index.html')filename='/index.html';
  const full=path.resolve(base,'.'+filename);
  if(!full.startsWith(base+path.sep)){res.writeHead(403).end();return;}
  fs.stat(full,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});if(req.method==='HEAD'){res.end();return;}fs.createReadStream(full).pipe(res);});
});
const wss=new WebSocketServer({server,maxPayload:4096});
wss.on('connection',ws=>{
  clients.set(ws,{room:null,name:'Misafir',lastAction:0,lastChat:0});send(ws,{type:'hello',message:'Lobi demosuna bağlandın.'});broadcast();
  ws.on('message',buf=>{
    let data;try{data=JSON.parse(buf.toString());}catch{return;}
    if(!data||typeof data!=='object')return;
    const user=clients.get(ws);if(!user)return;
    if(Date.now()-user.lastAction<180)return;user.lastAction=Date.now();
    if(data.type==='profile'){
      user.name=clean(data.name,20)||'Misafir';const room=rooms.get(user.room);if(room)notifyRoom(room);
    } else if(data.type==='create'){
      if(!GAMES.has(data.game)||rooms.size>=100)return send(ws,{type:'error',message:'Masa oluşturulamadı.'});
      leave(ws);const room={id:randomUUID().slice(0,8),game:data.game,name:clean(data.name)||'Yeni masa',players:new Set([ws]),host:ws,created:Date.now(),started:false,chat:[]};rooms.set(room.id,room);user.room=room.id;send(ws,{type:'joined',room:room.id});notifyRoom(room);broadcast();
    } else if(data.type==='join'){
      const room=rooms.get(clean(data.id,16));if(!room)return send(ws,{type:'error',message:'Masa bulunamadı.'});
      if(user.room===room.id){send(ws,{type:'joined',room:room.id});notifyRoom(room);return;}
      if(room.started)return send(ws,{type:'error',message:'Bu masa başlamış.'});
      if(room.players.size>=maxFor(room.game))return send(ws,{type:'error',message:'Masa dolu.'});
      leave(ws);room.players.add(ws);user.room=room.id;send(ws,{type:'joined',room:room.id});notifyRoom(room);broadcast();
    } else if(data.type==='leave'){
      leave(ws);send(ws,{type:'left'});broadcast();
    } else if(data.type==='chat'){
      const room=rooms.get(user.room);if(!room)return;
      if(Date.now()-user.lastChat<850)return send(ws,{type:'error',message:'Biraz yavaş yaz.'});
      user.lastChat=Date.now();const message=clean(data.message,240);if(!message)return;
      room.chat.push({name:user.name,message,time:Date.now()});room.chat=room.chat.slice(-40);notifyRoom(room);
    } else if(data.type==='start'){
      const room=rooms.get(user.room);if(!room||room.host!==ws)return send(ws,{type:'error',message:'Yalnızca masa sahibi başlatabilir.'});
      if(room.players.size<2)return send(ws,{type:'error',message:'Başlamak için en az iki oyuncu gerekli.'});
      if(room.game==='okey'){
        if(room.players.size!==4)return send(ws,{type:'error',message:'Okey deneme eli için 4 oyuncu gerekli.'});
        room.started=true;beginOkey(room);
      }else room.started=true;
      notifyRoom(room);broadcast();
    } else if(data.type==='draw'||data.type==='discard'){
      const room=rooms.get(user.room);const g=room?.round;if(!room||room.game!=='okey'||!g||g.status!=='playing')return send(ws,{type:'error',message:'Aktif Okey eli yok.'});
      const seat=g.order.indexOf(ws);if(seat!==g.turn)return send(ws,{type:'error',message:'Sıra sende değil.'});
      if(data.type==='draw'){
        if(g.phase!=='draw')return send(ws,{type:'error',message:'Önce taş atmalısın.'});
        const source=data.source==='discard'?'discard':'wall';
        const t=source==='discard'?g.discard.pop():g.wall.pop();if(!t)return send(ws,{type:'error',message:'Bu kaynaktan taş çekilemiyor.'});
        g.hands[seat].push(t);g.phase='discard';g.notice=`${seat+1}. oyuncu taş çekti.`;
      }else{
        if(g.phase!=='discard')return send(ws,{type:'error',message:'Önce taş çekmelisin.'});
        const id=clean(data.id,64);const index=g.hands[seat].findIndex(t=>t.id===id);if(index<0)return send(ws,{type:'error',message:'Bu taş elinde yok.'});
        g.discard.push(g.hands[seat].splice(index,1)[0]);g.turn=(g.turn+1)%g.order.length;g.phase='draw';g.notice=`${seat+1}. oyuncu taş attı. Sıra ${g.turn+1}. oyuncuda.`;
        if(!g.wall.length){g.status='ended';g.notice='Ortadaki taşlar bitti. Deneme eli sona erdi.';room.started=false;}
      }
      notifyRoom(room);broadcast();
    }
  });
  ws.on('close',()=>{leave(ws);clients.delete(ws);broadcast();});ws.on('error',()=>{});
});
server.listen(port,'0.0.0.0',()=>console.log(`Game room demo v0.3.1 listening on ${port}`));
