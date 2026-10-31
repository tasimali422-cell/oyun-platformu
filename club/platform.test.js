import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createClub} from './platform.js';

let tmp,club,server,base,admin,member,vip,moderator,guest,roomId,table;
const call=async (route,method='GET',data,authUser)=>{
  const headers={};if(authUser?.cookie)headers.cookie=authUser.cookie;
  if(authUser?.csrf)headers['X-Club-CSRF']=authUser.csrf;
  if(method!=='GET')headers['Content-Type']='application/json';
  const res=await fetch(`${base}/api/club${route}`,{method,headers,body:method==='GET'||data===undefined?undefined:JSON.stringify(data)});
  const payload=await res.json();return {status:res.status,body:payload,cookie:res.headers.get('set-cookie')?.split(';')[0]};
};
const logged=async(login,password)=>{
  const out=await call('/login','POST',{login,password});assert.equal(out.status,200,JSON.stringify(out.body));return {id:out.body.user.id,cookie:out.cookie,csrf:out.body.csrf};
};
const registered=async(username)=>{
  const out=await call('/register','POST',{username,name:username,email:`${username}@example.com`,password:'longPassword!234'});
  assert.equal(out.status,201,JSON.stringify(out.body));return {id:out.body.user.id,cookie:out.cookie,csrf:out.body.csrf};
};

before(async()=>{
  tmp=fs.mkdtempSync(path.join(os.tmpdir(),'arena-club-test-'));
  process.env.ARENA_CLUB_ADMIN_EMAIL='admin@example.com';
  process.env.ARENA_CLUB_ADMIN_PASSWORD='strongAdminPassword!234';
  club=createClub({dataFile:path.join(tmp,'club.json')});
  server=http.createServer((req,res)=>club.handle(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
  admin=await logged('admin@example.com','strongAdminPassword!234');
});
after(async()=>{await new Promise(resolve=>server.close(resolve));club.close();fs.rmSync(tmp,{recursive:true,force:true});delete process.env.ARENA_CLUB_ADMIN_EMAIL;delete process.env.ARENA_CLUB_ADMIN_PASSWORD;});

test('initial admin bootstrap and default 40-table room',async()=>{
  const out=await call('/me','GET',null,admin);assert.equal(out.body.user.role,'admin');assert.equal(out.body.rooms[0].tableCount,40);roomId=out.body.rooms[0].id;
});
test('registration, login and sensitive session cookie',async()=>{
  member=await registered('hello_player');vip=await registered('vip_player');moderator=await registered('mod_player');guest=await registered('guest_player');
  const me=await call('/me','GET',null,member);assert.equal(me.body.user.tier,'standard');
  const no=await call('/me');assert.equal(no.body.user,null);
});
test('CSRF header is required for authenticated writes',async()=>{
  const out=await call('/privacy','PATCH',{privateMessages:false},{cookie:member.cookie});assert.equal(out.status,403);
  const yes=await call('/privacy','PATCH',{privateMessages:false},member);assert.equal(yes.status,200);assert.equal(yes.body.user.privateMessages,false);
});
test('profile changes must receive admin approval',async()=>{
  let x=await call('/profile','POST',{name:'Yeni Ad',email:'hello_player@example.com',bio:'Açıklama',style:'gold'},member);assert.equal(x.status,201);
  let me=await call('/me','GET',null,member);assert.equal(me.body.user.name,'hello_player');
  let approvals=await call('/admin/summary','GET',null,admin);let a=approvals.body.approvals.find(a=>a.userId===member.id);assert.ok(a);
  let approve=await call('/admin/approvals','POST',{id:a.id,approve:true},admin);assert.equal(approve.status,200);
  me=await call('/me','GET',null,member);assert.equal(me.body.user.name,'Yeni Ad');
});
test('image moderation and standard one-avatar limit',async()=>{
  const tinyPng='data:image/png;base64,'+Buffer.from('89504e470d0a1a0a'+('00'.repeat(50)),'hex').toString('base64');
  let x=await call('/photo','POST',{image:tinyPng,avatar:true},member);assert.equal(x.status,201,JSON.stringify(x.body));
  const pending=await call('/admin/summary','GET',null,admin);const a=pending.body.approvals.find(a=>a.type==='photo'&&a.userId===member.id);
  assert.equal((await call('/admin/approvals','POST',{id:a.id,approve:true},admin)).status,200);
  let me=await call('/me','GET',null,member);assert.equal(me.body.user.photos.length,1);
  assert.equal((await call('/photo','POST',{image:tinyPng,avatar:true},member)).status,400);
  assert.equal((await call('/photo','POST',{image:tinyPng,avatar:true,replaceId:me.body.user.photos[0].id},member)).status,201);
});
test('admin grants premium membership and moderator role',async()=>{
  assert.equal((await call('/admin/user','PATCH',{id:vip.id,tier:'elite'},admin)).status,200);
  assert.equal((await call('/admin/user','PATCH',{id:moderator.id,role:'moderator'},admin)).status,200);
  assert.equal((await call('/admin/user','PATCH',{id:guest.id,tier:'vip'},moderator)).status,403);
});
test('admin rooms create/update and user room join',async()=>{
  const created=await call('/admin/room','POST',{name:'Özel Salon 2',game:'okey',tableCount:24},admin);assert.equal(created.status,201);assert.equal(created.body.room.tableCount,24);
  const rooms=await call('/rooms','GET',null,member);assert.equal(rooms.body.rooms.length,2);
  const out=await call('/room/enter','POST',{roomId},member);assert.equal(out.status,200);assert.equal(out.body.tables.length,40);
});
test('table rules prevent mixing different games in one salon',async()=>{
  let x=await call('/table/join','POST',{roomId,no:1,as:'player',settings:{game:'tavla',rounds:3,maxPlayers:2}},member);assert.equal(x.status,409);
  x=await call('/table/join','POST',{roomId,no:1,as:'player',settings:{game:'ludo',rounds:7,maxPlayers:4}},member);assert.equal(x.status,400);
  x=await call('/table/join','POST',{roomId,no:1,as:'player',settings:{game:'ludo',rounds:1,maxPlayers:4}},member);assert.equal(x.status,200,JSON.stringify(x.body));table=x.body.table;assert.equal(table.game,'ludo');
  assert.equal((await call('/table/settings','PATCH',{roomId,no:1,settings:{game:'tavla'}},member)).status,409);
  assert.equal((await call('/table/settings','PATCH',{roomId,no:1,settings:{turnSeconds:15}},vip)).status,403);
});

test('game-filtered room endpoint separates Ludo and Okey salons',async()=>{
  const all=await call('/rooms','GET',null,member);
  const ludo=await call('/rooms?game=ludo','GET',null,member);
  const okey=await call('/rooms?game=okey','GET',null,member);
  assert.ok(all.body.rooms.length>=2);
  assert.ok(ludo.body.rooms.length>=1 && ludo.body.rooms.every(r=>r.game==='ludo'));
  assert.ok(okey.body.rooms.length>=1 && okey.body.rooms.every(r=>r.game==='okey'));
  assert.equal((await call('/rooms?game=invalid','GET',null,member)).status,400);
});

test('administrator can promote another member to admin and demote back',async()=>{
  const promoted=await call('/admin/user','PATCH',{id:guest.id,role:'admin'},admin);
  assert.equal(promoted.status,200);assert.equal(promoted.body.user.role,'admin');
  assert.equal((await call('/admin/summary','GET',null,guest)).status,200);
  const demote=await call('/admin/user','PATCH',{id:guest.id,role:'member'},admin);
  assert.equal(demote.status,200);assert.equal(demote.body.user.role,'member');
  assert.equal((await call('/admin/summary','GET',null,guest)).status,403);
});

test('admin can enroll an existing user in a future tournament without granting an unverified prize',async()=>{
  const created=await call('/admin/tournament','POST',{name:'Gelecek Cumartesi Ludo',game:'ludo',startAt:new Date(Date.now()+7*86400000).toISOString(),maxPlayers:4,rewardTier:'vip',rewardDays:7},admin);
  assert.equal(created.status,201);
  const t=created.body.tournament;
  assert.ok((await call('/tournaments')).body.tournaments.some(x=>x.id===t.id));
  assert.equal((await call('/admin/tournament/enroll','POST',{id:t.id,userId:vip.id},member)).status,403);
  assert.equal((await call('/admin/tournament/enroll','POST',{id:t.id,userId:vip.id},admin)).status,200);
  assert.equal((await call('/admin/tournament/enroll','POST',{id:t.id,userId:vip.id},admin)).status,409);
  const summary=await call('/admin/summary','GET',null,admin);
  const entry=summary.body.tournaments.find(x=>x.id===t.id);
  assert.equal(entry.participants,1);assert.ok(entry.joined.includes(vip.id));
  assert.equal(entry.status,'open'); // no fake result / reward
});

test('VIP-only salon chat and moderator public announcement',async()=>{
  await call('/room/enter','POST',{roomId},vip);
  await call('/room/enter','POST',{roomId},moderator);
  assert.equal((await call('/chat/vip','POST',{roomId,message:'Sohbete merhaba'},member)).status,403);
  assert.equal((await call('/chat/vip','POST',{roomId,message:'VIP selam'},vip)).status,201);
  assert.equal((await call('/admin/announcement','POST',{message:'Turnuva cumartesi 20:00'},moderator)).status,201);
  const room=await call('/room/enter','POST',{roomId},member);assert.equal(room.body.announcements.length,1);assert.equal(room.body.vipChat.length,0);
});
test('table chat, spectators and private message policy',async()=>{
  await call('/table/join','POST',{roomId,no:1,as:'player'},member);
  await call('/table/join','POST',{roomId,no:1,as:'spectator'},vip);
  let c=await call('/chat/table','POST',{roomId,no:1,message:'Merhaba masa'},vip);assert.equal(c.status,201);
  c=await call('/chat/dm','POST',{to:member.id,message:'Özel mesaj'},vip);assert.equal(c.status,403); // member disabled PM
  c=await call('/privacy','PATCH',{privateMessages:true},member);assert.equal(c.status,200);
  c=await call('/chat/dm','POST',{to:member.id,message:'Özel mesaj'},vip);assert.equal(c.status,201);
  await call('/table/settings','PATCH',{roomId,no:1,settings:{privateChat:false,spectators:false}},member);
  c=await call('/chat/dm','POST',{to:member.id,message:'Engelli mesaj'},vip);assert.equal(c.status,403);
  c=await call('/chat/table','POST',{roomId,no:1,message:'Ziyaretçi'},vip);assert.equal(c.status,403);
});
test('moderator cannot ban admin or fellow moderator, can ban player',async()=>{
  assert.equal((await call('/admin/ban','POST',{id:admin.id,hours:1},moderator)).status,403);
  assert.equal((await call('/admin/ban','POST',{id:moderator.id,hours:1},moderator)).status,403);
  assert.equal((await call('/admin/ban','POST',{id:guest.id,hours:1},moderator)).status,200);
  assert.equal((await call('/me','GET',null,guest)).body.user,null);
  assert.equal((await call('/admin/ban','POST',{id:guest.id,hours:0},moderator)).status,200);
});
test('reports and moderator resolution',async()=>{
  const created=await call('/report','POST',{type:'chat',reason:'Kurallara aykırı mesajlar var',against:vip.id,roomId},member);assert.equal(created.status,201);
  const list=await call('/admin/summary','GET',null,moderator);const rep=list.body.reports.find(r=>r.by===member.id);assert.ok(rep);
  assert.equal((await call('/admin/report','POST',{id:rep.id,status:'resolved'},moderator)).status,200);
});
test('VIP rental and VIP-managed salon limits',async()=>{
  const expire=new Date(Date.now()+7*86400000).toISOString();
  assert.equal((await call('/admin/room','PATCH',{id:roomId,ownerId:vip.id,rentalUntil:expire},admin)).status,200);
  assert.equal((await call('/admin/room','PATCH',{id:roomId,name:'VIP Salonu',tableCount:30},vip)).status,200);
  assert.equal((await call('/admin/room','PATCH',{id:roomId,tableCount:80},vip)).status,403);
});
test('persistence to data file after writes',async()=>{
  const file=JSON.parse(fs.readFileSync(path.join(tmp,'club.json'),'utf8'));
  assert.equal(file.rooms.find(r=>r.id===roomId).name,'VIP Salonu');assert.ok(file.announcements.length);
});
test('tournament join and verified winner grants timed VIP/ELITE membership',async()=>{
 const created=await call('/admin/tournament','POST',{name:'Haftalık Arena Turnuvası',game:'ludo',startAt:new Date(Date.now()+86400000).toISOString(),maxPlayers:32,rewardTier:'elite',rewardDays:30},admin);
 assert.equal(created.status,201);
 const id=created.body.tournament.id;
 assert.equal((await call('/tournament/join','POST',{id},member)).status,200);
 assert.equal((await call('/tournament/join','POST',{id},member)).status,409);
 assert.equal((await call('/admin/tournament/result','POST',{id,winnerId:member.id,verified:false},admin)).status,403);
 assert.equal((await call('/admin/tournament/result','POST',{id,winnerId:vip.id,verified:true},admin)).status,400);
 assert.equal((await call('/admin/tournament/result','POST',{id,winnerId:member.id,verified:true},admin)).status,200);
 const me=await call('/me','GET',null,member);assert.equal(me.body.user.tier,'elite');assert.ok(me.body.user.tierExpires>Date.now());
 const tournaments=await call('/tournaments');assert.equal(tournaments.body.tournaments.find(t=>t.id===id).status,'finished');
});
test('public leaderboard is sorted by weekly scores',async()=>{
 assert.equal((await call('/admin/user','PATCH',{id:vip.id,tier:'vip',weeklyPoints:100,points:400,wins:4},admin)).status,200);
 assert.equal((await call('/admin/user','PATCH',{id:member.id,weeklyPoints:20,points:50,wins:1},admin)).status,200);
 const leaders=await call('/leaderboard');assert.equal(leaders.body.players[0].id,vip.id);
});
