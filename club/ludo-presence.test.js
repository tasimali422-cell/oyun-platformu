import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClub } from './platform.js';

async function makeFixture(n=2){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arena-ludo-presence-'));
 const club=createClub({dataFile:path.join(dir,'club.json')});
 const req=async (route,method='GET',body=null,account=null)=>{
  const request={method,headers:{host:'local.test',...(account?{cookie:account.cookie,'x-club-csrf':account.csrf}:{})},socket:{remoteAddress:'127.0.0.1',encrypted:false},async *[Symbol.asyncIterator](){if(body!==null)yield Buffer.from(JSON.stringify(body));}};
  let status=0,output='',headers={};const res={writeHead(s,h){status=s;headers=h;},end(x){output+=x||'';}};
  await club.handle(request,res,new URL('http://local.test/api/club'+route));
  return {status,data:JSON.parse(output),headers};
 };
 const accounts=[];
 for(let i=0;i<n;i++){
  const x=await req('/register','POST',{username:`presenceuser${i}`,name:`Presence ${i}`,email:`presence${i}@testing.invalid`,password:'a-long-pass-for-tests'});
  assert.equal(x.status,201);
  accounts.push({cookie:x.headers['Set-Cookie'].split(';')[0],csrf:x.data.csrf,id:x.data.user.id});
 }
 const roomId=club.db.rooms[0].id;
 const enter=async a=>{
  assert.equal((await req('/room/enter','POST',{roomId},a)).status,200);
  const joined=await req('/table/join','POST',{roomId,no:1,as:'player',settings:{maxPlayers:n,turnSeconds:30}},a);
  assert.equal(joined.status,200,JSON.stringify(joined.data));return joined;
 };
 const close=()=>{club.close();fs.rmSync(dir,{recursive:true,force:true});};
 return {club,req,accounts,roomId,enter,close};
}
for (const n of [2,4]) test(`${n} oyuncu HTTP oturumuyla çevrimiçi doğrulandı: WS gecikse de maç başlar`,async()=>{
 const f=await makeFixture(n);
 try{
  for(const a of f.accounts)await f.enter(a);
  const all=await f.req(`/table/state?roomId=${encodeURIComponent(f.roomId)}&no=1`,'GET',null,f.accounts[0]);
  assert.equal(all.status,200);
  assert.equal(all.data.table.members.length,n);
  assert.equal(all.data.table.members.filter(m=>m.connected).length,n);
  const started=await f.req('/table/ludo/start','POST',{roomId:f.roomId,no:1},f.accounts[0]);
  assert.equal(started.status,201,JSON.stringify(started.data));
  assert.equal(started.data.table.ludo.state.players.length,n);
  assert.equal(f.club.db.matchHistory.length,0,'Maç başlaması puan üretmez');
 }finally{f.close();}
});
test('Eksik oyuncu varken başlatma reddedilir; pulse yetkisi tabloyla sınırlı',async()=>{
 const f=await makeFixture(2);
 try{
  await f.enter(f.accounts[0]);
  const before=await f.req('/table/ludo/start','POST',{roomId:f.roomId,no:1},f.accounts[0]);
  assert.equal(before.status,409);
  assert.match(before.data.error,/2 ayrı oyuncunun/);
  const denied=await f.req('/table/pulse','POST',{roomId:f.roomId,no:1},f.accounts[1]);
  assert.equal(denied.status,403);
  assert.equal((await f.req(`/table/state?roomId=${f.roomId}&no=1`,'GET',null,f.accounts[1])).status,403);
  await f.enter(f.accounts[1]);
  const pulse=await f.req('/table/pulse','POST',{roomId:f.roomId,no:1},f.accounts[1]);
  assert.equal(pulse.status,200);
  assert.equal(pulse.data.table.members.filter(m=>m.connected).length,2);
  assert.equal((await f.req('/table/ludo/start','POST',{roomId:f.roomId,no:1},f.accounts[0])).status,201);
 }finally{f.close();}
});
