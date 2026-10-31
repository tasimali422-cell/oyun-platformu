import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import os from 'node:os';import fs from 'node:fs';import path from 'node:path';
import {createClub} from './platform.js';

async function fixture(n){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arena-ludo-api-'));
 const club=createClub({dataFile:path.join(dir,'club.json')});
 async function req(route,method='GET',body=null,account=null){
  const req={method,headers:{host:'test.local',...(account?{cookie:account.cookie,'x-club-csrf':account.csrf}:{})},socket:{remoteAddress:'127.0.0.1',encrypted:false},async *[Symbol.asyncIterator](){if(body!==null)yield Buffer.from(JSON.stringify(body));}};
  let text='',status=null,headers={};const res={writeHead(code,h){status=code;headers=h;},end(data){text+=data||'';}};
  await club.handle(req,res,new URL('http://test.local/api/club'+route));
  const json=JSON.parse(text);return {status,headers,data:json,req};
 }
 const accounts=[];
 for(let i=0;i<n;i++){
  const user=await req('/register','POST',{username:`testuser${i}`,name:`Oyuncu ${i}`,email:`ludo${i}@testing.invalid`,password:'secure-password-for-tests'});
  assert.equal(user.status,201,JSON.stringify(user.data));
  const a={cookie:user.headers['Set-Cookie'].split(';')[0],csrf:user.data.csrf,id:user.data.user.id};
  const ws=new EventEmitter();ws.readyState=1;ws.send=()=>{};ws.close=()=>{};a.ws=ws;
  club.wss.emit('connection',ws,{headers:{cookie:a.cookie}});
  accounts.push(a);
 }
 const roomId=club.db.rooms[0].id;
 for(const a of accounts){const out=await req('/room/enter','POST',{roomId},a);assert.equal(out.status,200,JSON.stringify(out.data));}
 for(let i=0;i<n;i++){
  const a=accounts[i],out=await req('/table/join','POST',{roomId,no:1,as:'player',...(i===0?{settings:{maxPlayers:n,turnSeconds:30}}:{})},a);
  assert.equal(out.status,200,JSON.stringify(out.data));
 }
 const started=await req('/table/ludo/start','POST',{roomId,no:1},accounts[0]);
 assert.equal(started.status,201,JSON.stringify(started.data));
 return {club,req,accounts,roomId,dir,close(){club.close();fs.rmSync(dir,{recursive:true,force:true});}};
}
for(const count of [2,4])test(`Ludo API: ${count} player result settled once, unauthorized move rejected`,async()=>{
 const f=await fixture(count);
 try{
  const {club,req,accounts,roomId}=f;
  const before=await req('/table/ludo/roll','POST',{roomId,no:1},accounts[1]);
  assert.equal(before.status,409); // cannot roll someone else's turn
  const entry=club.db.ludoGames[`${roomId}:1`];
  assert.ok(entry);const g=entry.game;
  g.turn=0;g.phase='move';g.dice=1;g.deadline=Date.now()+30000;
  g.players[0].pawns=[56,56,56,55];
  const attempt=await req('/table/ludo/move','POST',{roomId,no:1,pawn:3},accounts[1]);
  assert.equal(attempt.status,409);
  const result=await req('/table/ludo/move','POST',{roomId,no:1,pawn:3},accounts[0]);
  assert.equal(result.status,200,JSON.stringify(result.data));
  assert.equal(result.data.table.ludo.result.winnerId,accounts[0].id);
  assert.deepEqual(club.db.users.slice(-count).map(u=>u.points),count===2?[6,-6]:[6,-2,-2,-2]);
  assert.deepEqual(club.db.users.slice(-count).map(u=>u.weeklyPoints),count===2?[6,-6]:[6,-2,-2,-2]);
  assert.equal(club.db.users.at(-count).wins,1);
  const again=await req('/table/ludo/move','POST',{roomId,no:1,pawn:3},accounts[0]);
  assert.notEqual(again.status,200);
  assert.equal(club.db.matchHistory.length,1);
  assert.equal(club.db.users.at(-count).points,6);
  const history=await req('/matches/mine','GET',null,accounts[1]);
  assert.equal(history.status,200);assert.equal(history.data.matches.length,1);
 }finally{f.close();}
});
