import { startMulk, actMulk, tickMulk, viewMulk, bankruptMulk } from './mulk.js';
import { TOMBALA_MAX_PLAYERS, setupTombala, distribute, userView, markNumber, drawNumber, finalizeClaims } from './tombala.js';
import { settleMatch, applyHandScore, validWinningHand, isRealJoker } from './scoring.js';
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
const reconnectTokens = new Map();
const REJOIN_MS=5*60*1000;
const MAX_ROOM_IDLE_MS=60*60*1000;
const TURN_CHOICES=[15,20,30,45,60,90];
const GAMES = new Set(['tombala','okey','101','kelime','bilardo','mulk']);
const maxFor = (game, room) => game==='tombala' ? (room?.settings?.maxPlayers || 12) : game==='mulk'?(room?.settings?.maxPlayers||4):['kelime','bilardo'].includes(game)?2:4;
const clean = (value, max=36) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const send = (ws, data) => {if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(data));};
function view(room){return {id:room.id,game:room.game,name:room.name,players:room.players.size,max:maxFor(room.game,room),created:room.created,started:room.started,settings:room.settings||null,remainingMs:room.round?.deadline?Math.max(0,room.round.deadline-Date.now()):null,scores:room.scores||null,finalResult:room.finalResult||null,tombalaPhase:room.tombala?.phase||null,propertyPhase:room.mulk?.phase||null};}
function list(){return [...rooms.values()].map(view);}
function broadcast(){const packet=JSON.stringify({type:'state',online:clients.size,rooms:list()});for(const ws of clients.keys())if(ws.readyState===WebSocket.OPEN)ws.send(packet);}
function tiles(){
 const a=[];for(let copy=0;copy<2;copy++)for(let color=0;color<4;color++)for(let n=1;n<=13;n++)a.push({id:randomUUID(),color,n});
 for(let j=0;j<2;j++)a.push({id:randomUUID(),color:4,n:0});
 for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
function gameState(room,ws){if(!room.round)return null;const g=room.round;const idx=g.order.indexOf(ws);if(idx<0)return null;return {mySeat:idx+1,hand:g.hands[idx],turn:g.turn+1,phase:g.phase,wall:g.wall.length,discard:g.discard.slice(-24).map(t=>({...t})),indicator:g.indicator,discardBySeat:g.discardBySeat.map(a=>a.slice(-6)),roundStatus:g.status,notice:g.notice,joker:{color:g.indicator.color,n:g.indicator.n%13+1},score:room.scores||null};}
function beginOkey(room){const deck=tiles();const order=[...room.players];const indicatorIndex=deck.findIndex(t=>t.color<4);const indicator=deck.splice(indicatorIndex,1)[0];const hands=order.map((_,i)=>deck.splice(0,i===0?15:14));room.round={order,hands,indicator,wall:deck,discard:[],discardBySeat:[[],[],[],[]],turn:0,phase:'discard',status:'playing',notice:'İlk oyuncu taş atacak.',deadline:Date.now()+room.settings.turnSeconds*1000,shownBy:[]};}
function notifyRoom(room){const seats=[...room.players].map((ws,i)=>({seat:i+1,name:clients.get(ws)?.name||'Misafir',host:ws===room.host,online:clients.get(ws)?.active!==false,score:room.scores?.[i]??0,playerId:clients.get(ws)?.token||null}));for(const ws of room.players)send(ws,{type:'room',...view(room),seats,host:ws===room.host,chat:room.chat,gameState:gameState(room,ws),tombala:userView(room,ws),mulk:viewMulk(room.mulk,room.mulk?.players.findIndex(p=>p.token===clients.get(ws)?.token)??-1)});}
function leave(ws){const state=clients.get(ws);if(!state?.room)return;const room=rooms.get(state.room);state.room=null;if(!room)return;if(room.mulk){const idx=room.mulk.players.findIndex(p=>p.token===state.token);if(idx>=0&&!room.mulk.players[idx].bankrupt)bankruptMulk(room.mulk,idx,null);room.started=!room.mulk.finished;}room.players.delete(ws);room.ticketChoices?.delete(ws);room.autoChoices?.delete(ws);if(room.tombala){room.tombala.tickets.delete(ws);room.tombala.auto.delete(ws);room.tombala.manualMarks.delete(ws);}if(!room.players.size){rooms.delete(room.id);}else{if(room.host===ws)room.host=room.players.values().next().value;if(room.round){room.round.status='stopped';room.round.notice='Oyuncu masadan ayrıldı. Yeni el için masa yeniden kurulmalı.';room.started=false;room.round=null;}notifyRoom(room);}}
function dropDisconnected(ws){const u=clients.get(ws);if(!u||u.active)return;const token=u.token;if(token)reconnectTokens.delete(token);leave(ws);clients.delete(ws);broadcast();}
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
  clients.set(ws,{room:null,name:'Misafir',lastAction:0,lastChat:0,active:true,token:null});send(ws,{type:'hello',message:'Oyun sunucusuna bağlandın.'});broadcast();
  ws.on('message',buf=>{
    let data;try{data=JSON.parse(buf.toString());}catch{return;}
    if(!data||typeof data!=='object')return;
    const user=clients.get(ws);if(!user)return;
    if(!['resume','profile'].includes(data.type)){if(Date.now()-user.lastAction<75)return;user.lastAction=Date.now();}
    if(data.type==='resume'){
      const token=clean(data.token,100);const old=reconnectTokens.get(token);const prior=old&&clients.get(old);
      if(prior&&!prior.active){const room=rooms.get(prior.room);if(room){room.players=new Set([...room.players].map(p=>p===old?ws:p));if(room.host===old)room.host=ws;if(room.round)room.round.order=room.round.order.map(p=>p===old?ws:p);if(room.tombala){for(const field of ['tickets','auto','manualMarks']){const map=room.tombala[field];if(map?.has(old)){map.set(ws,map.get(old));map.delete(old);}}}for(const field of ['ticketChoices','autoChoices']){const map=room[field];if(map?.has(old)){map.set(ws,map.get(old));map.delete(old);}}}
        ws.__seatId=prior.token;clients.set(ws,{...prior,active:true,lastAction:0});clients.delete(old);reconnectTokens.delete(token);send(ws,{type:'resumed',room:room?.id||null});if(room)notifyRoom(room);broadcast();return;}
      user.token=token||randomUUID();ws.__seatId=user.token;send(ws,{type:'session',token:user.token});return;
    } else if(data.type==='profile'){
      const current=clients.get(ws);current.name=clean(data.name,20)||'Misafir';const room=rooms.get(current.room);if(room)notifyRoom(room);
    } else if(data.type==='create'){
      if(!GAMES.has(data.game)||rooms.size>=100)return send(ws,{type:'error',message:'Masa oluşturulamadı.'});
      leave(ws);const settings={lossLimit:Math.max(1,Math.min(30,Number(data.startPoints)||20)),showIndicator:data.showIndicator!==false,turnSeconds:TURN_CHOICES.includes(Number(data.turnSeconds))?Number(data.turnSeconds):30};const room={id:randomUUID().slice(0,8),game:data.game,name:clean(data.name)||'Yeni masa',players:new Set([ws]),host:ws,created:Date.now(),started:false,chat:[],settings,scores:null,finalResult:null,scoreByToken:{},roundResults:[],ticketChoices:new Map(),autoChoices:new Map()};if(room.game==='mulk'){room.settings.maxPlayers=[2,3,4,5,6].includes(Number(data.mulkPlayers))?Number(data.mulkPlayers):4;room.settings.startCash=[1000,1500,2000].includes(Number(data.mulkCash))?Number(data.mulkCash):1500;room.settings.auctionSeconds=[20,30,45].includes(Number(data.auctionSeconds))?Number(data.auctionSeconds):30;}if(room.game==='tombala'){room.settings.drawInterval=Math.max(5000,Math.min(120000,Math.round(Number(data.drawInterval)||30000)));room.settings.maxPlayers=Math.max(2,Math.min(24,Math.round(Number(data.maxPlayers)||12)));room.settings.ticketCost=Math.max(0,Math.min(10000,Math.round(Number(data.ticketCost ?? 100))));room.settings.prize1=Math.max(0,Math.min(1000000,Math.round(Number(data.prize1 ?? 500))));room.settings.prize2=Math.max(0,Math.min(1000000,Math.round(Number(data.prize2 ?? 1000))));room.settings.prize3=Math.max(0,Math.min(1000000,Math.round(Number(data.prize3 ?? 2500))));setupTombala(room);room.ticketChoices.set(ws,Math.max(1,Math.min(12,Number(data.ticketCount)||1)));room.autoChoices.set(ws,false);}rooms.set(room.id,room);user.room=room.id;send(ws,{type:'joined',room:room.id});notifyRoom(room);broadcast();
    } else if(data.type==='join'){
      const room=rooms.get(clean(data.id,16));if(!room)return send(ws,{type:'error',message:'Masa bulunamadı.'});
      if(user.room===room.id){send(ws,{type:'joined',room:room.id});notifyRoom(room);return;}
      if(room.started)return send(ws,{type:'error',message:'Bu masa başlamış.'});
      if(room.players.size>=maxFor(room.game,room))return send(ws,{type:'error',message:'Masa dolu.'});
      leave(ws);room.players.add(ws);if(room.game==='tombala'){room.ticketChoices.set(ws,1);room.autoChoices.set(ws,false);}user.room=room.id;send(ws,{type:'joined',room:room.id});notifyRoom(room);broadcast();
    } else if(data.type==='leave'){
      leave(ws);send(ws,{type:'left'});broadcast();
    } else if(data.type==='private_chat'){
      const room=rooms.get(user.room);
      if(!room || !room.players.has(ws))return send(ws,{type:'error',message:'Özel mesaj için aynı masada olmalısınız.'});
      const targetToken=clean(data.target,100);
      const recipient=[...room.players].find(peer=>peer!==ws && clients.get(peer)?.token===targetToken && clients.get(peer)?.active!==false);
      if(!recipient)return send(ws,{type:'error',message:'Oyuncu çevrimdışı veya bu masada değil.'});
      if(Date.now()-user.lastChat<1200)return send(ws,{type:'error',message:'Mesaj göndermeden önce biraz bekle.'});
      const message=clean(data.message,240);if(!message)return;
      user.lastChat=Date.now();
      const recipientName=clients.get(recipient)?.name||'Oyuncu';
      const packet={type:'private_message',from:user.token,fromName:user.name,to:targetToken,toName:recipientName,message,time:Date.now()};
      send(ws,packet);send(recipient,packet);
    } else if(data.type==='chat'){
      const room=rooms.get(user.room);if(!room)return;
      if(Date.now()-user.lastChat<850)return send(ws,{type:'error',message:'Biraz yavaş yaz.'});
      user.lastChat=Date.now();const message=clean(data.message,240);if(!message)return;
      room.chat.push({name:user.name,message,time:Date.now()});room.chat=room.chat.slice(-40);notifyRoom(room);
    } else if(data.type==='start'){
      const room=rooms.get(user.room);if(!room||room.host!==ws)return send(ws,{type:'error',message:'Yalnızca masa sahibi başlatabilir.'});
      if(room.players.size<2)return send(ws,{type:'error',message:'Başlamak için en az iki oyuncu gerekli.'});
      if(room.game==='tombala'){if(room.tombala?.phase==='running')return send(ws,{type:'error',message:'Oyun zaten başladı.'});setupTombala(room);distribute(room);room.started=true;room.tombala.phase='running';room.tombala.nextAt=Date.now()+1000;notifyRoom(room);broadcast();return;}
      if(room.game==='mulk'){
        const seats=[...room.players].map((peer)=>({name:clients.get(peer)?.name||'Oyuncu',token:clients.get(peer)?.token}));room.mulk=startMulk(seats,{cash:room.settings.startCash,auctionSeconds:room.settings.auctionSeconds});room.started=true;
      }else if(room.game==='okey'){
        if(room.players.size!==4)return send(ws,{type:'error',message:'Okey deneme eli için 4 oyuncu gerekli.'});
        room.started=true;room.scores ||= [room.settings.lossLimit,room.settings.lossLimit,room.settings.lossLimit,room.settings.lossLimit];room.finalResult=null;beginOkey(room);
      }else room.started=true;
      notifyRoom(room);broadcast();

    } else if(data.type==='mulkAction'){
      const room=rooms.get(user.room);if(!room||room.game!=='mulk'||!room.mulk)return send(ws,{type:'error',message:'Aktif mülk oyunu bulunamadı.'});
      const seat=room.mulk.players.findIndex(p=>p.token===user.token);if(seat<0)return send(ws,{type:'error',message:'Bu oyunda oyuncu değilsin.'});
      try{actMulk(room.mulk,seat,data);room.started=!room.mulk.finished;notifyRoom(room);broadcast();}catch(e){send(ws,{type:'error',message:e.message});}
    } else if(data.type==='tombalaSettings'){
      const room=rooms.get(user.room);if(!room||room.game!=='tombala'||room.started)return send(ws,{type:'error',message:'Kart ayarları yalnız oyun başlamadan değişir.'});
      room.ticketChoices.set(ws,Math.max(1,Math.min(12,Number(data.count)||1)));room.autoChoices.set(ws,false);notifyRoom(room);
    } else if(data.type==='tombalaMark'){
      const room=rooms.get(user.room);if(!room||room.game!=='tombala')return; if(markNumber(room,ws,clean(data.ticketId,24),Number(data.number)))notifyRoom(room);
    } else if(data.type==='showIndicator'){
      const room=rooms.get(user.room),g=room?.round;
      if(!room||room.game!=='okey'||!g||g.status!=='playing'||!room.settings.showIndicator)return send(ws,{type:'error',message:'Bu masada gösterge gösterilemez.'});
      const seat=g.order.indexOf(ws);
      if(seat<0||g.shownBy.includes(seat))return send(ws,{type:'error',message:'Gösterge zaten gösterildi.'});
      if(!g.hands[seat].some(t=>t.color===g.indicator.color&&t.n===g.indicator.n))return send(ws,{type:'error',message:'Elinde gösterge taşı bulunmuyor.'});
      g.shownBy.push(seat);room.scores[seat]-=1;g.notice=`${seat+1}. oyuncu göstergeyi gösterdi, masa puanından 1 düşüldü.`;
      notifyRoom(room);broadcast();
    } else if(data.type==='finish'){
      const room=rooms.get(user.room),g=room?.round;
      if(!room||room.game!=='okey'||!g||g.status!=='playing')return send(ws,{type:'error',message:'Aktif Okey eli yok.'});
      const seat=g.order.indexOf(ws);
      if(seat!==g.turn||g.phase!=='discard'||g.hands[seat].length!==15)return send(ws,{type:'error',message:'El bitirme sırası sende değil.'});
      const tileId=clean(data.id,64),ix=g.hands[seat].findIndex(t=>t.id===tileId);
      if(ix<0)return send(ws,{type:'error',message:'Bitiş için atılacak taşı seç.'});
      const remaining=g.hands[seat].filter(t=>t.id!==tileId);
      if(!validWinningHand(remaining,g.indicator))return send(ws,{type:'error',message:'Bu elde geçerli Okey bitişi bulunamadı.'});
      // Okey bitişi yalnızca atılan taş gerçekten okey ise iki kat ceza uygular.
      const last=g.hands[seat][ix];const multiplier=isRealJoker(last,g.indicator)?2:1;
      room.scores=applyHandScore(room.scores||[0,0,0,0],seat,multiplier*2);
      g.status='ended';room.started=false;
      g.notice=`${seat+1}. oyuncu eli bitirdi. Diğer oyunculardan ${multiplier*2} puan düşüldü.`;
      const losing=room.scores.map((v,i)=>v<=0?i:-1).filter(i=>i>=0);
      if(losing.length){room.finalResult=settleMatch(room.scores,losing);room.scores=room.finalResult.scores;g.notice+=' Maç sona erdi. 8 puanlık final dağıtımı uygulandı.';}
      notifyRoom(room);broadcast();
    } else if(data.type==='draw'||data.type==='discard'){
      const room=rooms.get(user.room);const g=room?.round;if(!room||room.game!=='okey'||!g||g.status!=='playing')return send(ws,{type:'error',message:'Aktif Okey eli yok.'});
      const seat=g.order.indexOf(ws);if(seat!==g.turn)return send(ws,{type:'error',message:'Sıra sende değil.'});
      if(data.type==='draw'){
        if(g.phase!=='draw')return send(ws,{type:'error',message:'Önce taş atmalısın.'});
        const source=data.source==='discard'?'discard':'wall';
        const t=source==='discard'?g.discard.pop():g.wall.pop();if(!t)return send(ws,{type:'error',message:'Bu kaynaktan taş çekilemiyor.'});
        g.hands[seat].push(t);g.phase='discard';g.deadline=Date.now()+room.settings.turnSeconds*1000;g.notice=`${seat+1}. oyuncu taş çekti.`;
      }else{
        if(g.phase!=='discard')return send(ws,{type:'error',message:'Önce taş çekmelisin.'});
        const id=clean(data.id,64);const index=g.hands[seat].findIndex(t=>t.id===id);if(index<0)return send(ws,{type:'error',message:'Bu taş elinde yok.'});
        g.discard.push(g.hands[seat].splice(index,1)[0]);g.discardBySeat[seat].push(g.discard[g.discard.length-1]);g.turn=(g.turn+1)%g.order.length;g.phase='draw';g.deadline=Date.now()+room.settings.turnSeconds*1000;g.notice=`${seat+1}. oyuncu taş attı. Sıra ${g.turn+1}. oyuncuda.`;
        if(!g.wall.length){g.status='ended';g.notice='Taşlar bitti. El berabere sona erdi, puan değişmedi.';room.started=false;}
      }
      notifyRoom(room);broadcast();
    }
  });
  ws.on('close',()=>{const u=clients.get(ws);if(!u)return;u.active=false;if(!u.room){clients.delete(ws);broadcast();return;}if(u.token){reconnectTokens.set(u.token,ws);setTimeout(()=>dropDisconnected(ws),REJOIN_MS);const r=rooms.get(u.room);if(r)notifyRoom(r);broadcast();}else{leave(ws);clients.delete(ws);broadcast();}});ws.on('error',()=>{});
});
// Sunucu kontrolünde süre aşımı: sıra sahibinin hamlesini güvenli biçimde tamamla.
setInterval(()=>{
  for(const room of rooms.values()){
    if(room.game==='mulk'&&room.mulk&&tickMulk(room.mulk)){notifyRoom(room);broadcast();}
    if(room.game==='tombala'&&room.tombala?.phase==='running'&&Date.now()>=room.tombala.nextAt){drawNumber(room,ws=>clients.get(ws)?.name||'Oyuncu');if(room.tombala.phase==='ended')room.started=false;notifyRoom(room);broadcast();}
    if(room.game==='tombala'&&room.tombala&&finalizeClaims(room,ws=>clients.get(ws)?.name||'Oyuncu')){if(room.tombala.phase==='ended')room.started=false;notifyRoom(room);broadcast();}
    const g=room.round;if(!g||g.status!=='playing'||!g.deadline||Date.now()<g.deadline)continue;
    const seat=g.turn;
    if(g.phase==='draw'){
      const tile=g.wall.pop()||g.discard.pop();
      if(!tile){g.status='ended';room.started=false;g.notice='Deste tükendi; el sona erdi.';notifyRoom(room);broadcast();continue;}
      g.hands[seat].push(tile);g.phase='discard';g.notice=`${seat+1}. oyuncu süre dolduğu için otomatik taş çekti.`;
    }else{
      const tile=g.hands[seat].pop();
      if(tile){g.discard.push(tile);g.discardBySeat[seat].push(tile);}
      g.turn=(g.turn+1)%4;g.phase='draw';g.notice=`${seat+1}. oyuncunun süresi doldu; otomatik taş attı.`;
    }
    g.deadline=Date.now()+room.settings.turnSeconds*1000;
    notifyRoom(room);broadcast();
  }
},1000).unref();
server.listen(port,'0.0.0.0',()=>console.log(`Game room tombala v0.9 listening on ${port}`));
