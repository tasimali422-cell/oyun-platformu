import test from 'node:test';import assert from 'node:assert/strict';
import http from 'node:http';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {WebSocket} from 'ws';import {createClub} from './platform.js';

test('Ludo game start broadcasts authenticated table state over WebSocket to both players',{skip:typeof WebSocket!=='function'?'Gerçek ws paketi bu test ortamında mevcut değil':false},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arena-ludo-ws-'));
 const club=createClub({dataFile:path.join(dir,'club.json')});
 const server=http.createServer((req,res)=>club.handle(req,res,new URL(req.url,'http://test.local')));
 server.on('upgrade',(req,socket,head)=>club.wss.handleUpgrade(req,socket,head,ws=>club.wss.emit('connection',ws,req)));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const base=`http://127.0.0.1:${port}`;
 const sockets=[];
 async function call(route,method='GET',payload=null,account=null){
  const r=await fetch(`${base}/api/club${route}`,{method,headers:{'content-type':'application/json',...(account?{'cookie':account.cookie,'x-club-csrf':account.csrf}:{})},body:payload?JSON.stringify(payload):undefined});return {code:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};
 }
 try{
  const accounts=[];
  for(let i=0;i<2;i++){
   const res=await call('/register','POST',{username:`wsplayer${i}`,name:`WS Oyuncu ${i}`,email:`wsplayer${i}@testing.invalid`,password:'safe-password-for-tests'});assert.equal(res.code,201);
   const user={id:res.body.user.id,csrf:res.body.csrf,cookie:res.cookie.split(';')[0]};accounts.push(user);
   const ws=new WebSocket(`ws://127.0.0.1:${port}/club/ws`,{headers:{cookie:user.cookie}});sockets.push(ws);
   await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  }
  const roomId=club.db.rooms[0].id;
  for(let i=0;i<2;i++){
   await call('/room/enter','POST',{roomId},accounts[i]);
   const joined=await call('/table/join','POST',{roomId,no:1,as:'player',...(i===0?{settings:{maxPlayers:2}}:{})},accounts[i]);assert.equal(joined.code,200);
  }
  const received=sockets.map(ws=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('No table_state broadcast')),1000);
   const listener=raw=>{const m=JSON.parse(raw);if(m.type==='table_state'&&m.table.ludo?.state){clearTimeout(timer);ws.off('message',listener);resolve(m.table);}};ws.on('message',listener);
  }));
  const started=await call('/table/ludo/start','POST',{roomId,no:1},accounts[0]);assert.equal(started.code,201);
  const views=await Promise.all(received);assert.equal(views[0].ludo.state.players.length,2);assert.equal(views[1].ludo.state.players.length,2);
  assert.deepEqual(views.map(v=>v.ludo.state.mySeat),[0,1]);
 }finally{
  for(const s of sockets)s.terminate();
  await new Promise(resolve=>server.close(resolve));club.close();fs.rmSync(dir,{recursive:true,force:true});
 }
});
