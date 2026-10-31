import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createClub} from '../platform.js';
test('101 Okey Arena Club salonundan dört hesapla başlar ve el gizliliği korunur',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'club101-'));const club=createClub({dataFile:path.join(dir,'club.json')});
 const server=http.createServer((req,res)=>club.handle(req,res,new URL(req.url,'http://localhost')));
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,method='GET',data,session)=>{
  const headers={};if(session){headers.cookie=session.cookie;headers['X-Club-CSRF']=session.csrf;}
  if(method!=='GET')headers['Content-Type']='application/json';
  const r=await fetch(base+'/api/club'+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});return {code:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
 };
 try{
  const regs=[];
  for(let i=0;i<4;i++){
   const r=await call('/register','POST',{username:'player'+i,name:'Oyuncu '+i,email:`player${i}@example.com`,password:'testPassword1234!'});
   assert.equal(r.code,201,JSON.stringify(r.data));regs.push({id:r.data.user.id,cookie:r.cookie,csrf:r.data.csrf});
  }
  const room={id:'room101',name:'101 Okey Test Salonu',game:'101',tableCount:40,ownerId:null,rentalUntil:null};club.db.rooms.push(room);
  for(let i=0;i<4;i++){
   assert.equal((await call('/room/enter','POST',{roomId:room.id},regs[i])).code,200);
   let joined=await call('/table/join','POST',{roomId:room.id,no:3,as:'player',...(i===0?{settings:{game:'101',maxPlayers:4,rounds:3}}:{})},regs[i]);
   assert.equal(joined.code,200,JSON.stringify(joined.data));
  }
  assert.equal((await call('/table/101/start','POST',{roomId:room.id,no:3},regs[1])).code,403);
  const started=await call('/table/101/start','POST',{roomId:room.id,no:3},regs[0]);assert.equal(started.code,201,JSON.stringify(started.data));
  assert.equal(started.data.table.okey101.game.hand.length,22);
  const other=await call('/table/state?roomId=room101&no=3','GET',undefined,regs[1]);assert.equal(other.data.table.okey101.game.hand.length,21);
  const firstTile=started.data.table.okey101.game.hand[0].id;
  assert.equal((await call('/table/101/action','POST',{roomId:room.id,no:3,action:'discard',tileId:firstTile},regs[1])).code,400);
  const good=await call('/table/101/action','POST',{roomId:room.id,no:3,action:'discard',tileId:firstTile},regs[0]);
  assert.equal(good.code,200,JSON.stringify(good.data));assert.equal(good.data.table.okey101.game.currentSeat,1);
  assert.equal((await call('/table/101/action','POST',{roomId:room.id,no:3,action:'draw',source:'wall'},regs[1])).code,200);
  const observe=await call('/table/join','POST',{roomId:room.id,no:3,as:'spectator'},regs[0]);
  assert.equal(observe.code,200);assert.equal(observe.data.table.okey101.game.hand.length,0);
 }finally{await new Promise(ok=>server.close(ok));club.close();fs.rmSync(dir,{recursive:true,force:true});}
});
