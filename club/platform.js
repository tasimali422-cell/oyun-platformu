import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { startLudo, rollLudo, moveLudo, tickLudo, playBotLudo, viewLudo } from '../ludo.js';
import { ludoPointDeltas } from './ludo-scoring.js';

const now = () => Date.now();
const ident = () => crypto.randomUUID();
const digest = v => crypto.createHash('sha256').update(v).digest('hex');
const clean = (v,n=80) => String(v??'').replace(/[\u0000-\u001f\u007f<>]/g,' ').trim().slice(0,n);
const email = v => String(v??'').trim().toLowerCase();
const tierNames = new Set(['standard','bronze','vip','elite','owner']);
const roleNames = new Set(['member','moderator','admin']);
const allowedStyles = new Set(['gold','violet','blue','rose','green']);
const games = {
  ludo:{label:'Kızma Birader',rounds:[1],max:[2,4],mode:'rounds'},
  tavla:{label:'Tavla',rounds:[3,5],max:[2],mode:'rounds'},
  batak:{label:'İhaleli Batak',rounds:[1,3,5,7,9,11],max:[4],mode:'rounds'},
  '101':{label:'101 Okey',rounds:[1,3,5,7,9,11],max:[4],mode:'rounds'},
  okey:{label:'Klasik Okey',points:[10,20,30],max:[4],mode:'points',penalties:{gosterge:1,normal:2,ciftVeyaOkey:4,ciftOkey:8}},
  'esli-okey':{label:'Eşli Okey',points:[10,20,30],max:[4],mode:'points',penalties:{gosterge:1,normal:2,ciftVeyaOkey:4,ciftOkey:8}},
  tombala:{label:'Tombala',rounds:[1],max:[2,4,8,12,24],mode:'rounds'},
  mulk:{label:'Mülk Turu',rounds:[1],max:[2,3,4,5,6],mode:'rounds'}
};
function passwordHash(password,salt=crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`;
}
function passwordMatch(p,encoded){
  try {const [s,h]=encoded.split(':');return crypto.timingSafeEqual(Buffer.from(h,'hex'),crypto.scryptSync(p,s,64));}catch{return false;}
}
const publicUser=u=>({id:u.id,username:u.username,name:u.name,role:u.role,tier:u.tier,tierExpires:u.tierExpires||null,style:u.style||'gold',bio:u.bio||'',avatarId:u.avatarId||null,photos:(u.photos||[]).map(p=>({id:p.id,avatar:p.id===u.avatarId})),points:u.points||0,wins:u.wins||0,weeklyPoints:u.weeklyPoints||0,privateMessages:u.privateMessages!==false});
const isStaff=u=>u&&['admin','moderator'].includes(u.role);
const isPremium=u=>u&&(u.role==='admin'||u.role==='moderator'||(u.tier==='vip'||u.tier==='elite')&&(!u.tierExpires||u.tierExpires>now()));
const photoLimit=u=>(['vip','elite'].includes(u.tier)&&(!u.tierExpires||u.tierExpires>now()))?4:1;
const send=(ws,o)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(o));};
function HttpError(message,status=400){const e=new Error(message);e.status=status;return e;}
function strictLimit(v,min,max,field){if(!Number.isInteger(v)||v<min||v>max)throw HttpError(`${field}: geçersiz değer`);return v;}
function cookie(req,name){const c=String(req.headers.cookie||'').split(';').map(s=>s.trim());const pair=c.find(s=>s.startsWith(name+'='));return pair?decodeURIComponent(pair.split('=').slice(1).join('=')):'';}
function imageType(buf){if(buf.length>=8&&buf.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return 'image/png';if(buf.length>4&&buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff)return 'image/jpeg';if(buf.length>12&&buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP')return 'image/webp';return null;}
function originSafe(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host;}catch{return false;}}

export function createClub({dataFile=process.env.ARENA_CLUB_DATA_PATH||path.resolve('data/club.json')}={}){
  fs.mkdirSync(path.dirname(dataFile),{recursive:true});
  const mediaDir=path.join(path.dirname(dataFile),'club-media');fs.mkdirSync(mediaDir,{recursive:true});
  const fresh=()=>({schema:1,users:[],sessions:[],tournaments:[],rooms:[{id:ident(),name:'Kızma Birader Salonu',game:'ludo',tableCount:40,ownerId:null,rentalUntil:null}],tables:[],approvals:[],reports:[],announcements:[],vipChat:[],tableChats:{},dm:[],audit:[],ludoGames:{},matchHistory:[]});
  let db=fs.existsSync(dataFile)?JSON.parse(fs.readFileSync(dataFile,'utf8')):fresh();
  for(const [k,v] of Object.entries(fresh()))if(db[k]===undefined)db[k]=v;
  function save(){const tmp=`${dataFile}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(db),{mode:0o600});fs.renameSync(tmp,dataFile);}
  if(!fs.existsSync(dataFile))save();
  // Açık masa/mesajlar canlı oturumlara bağlıdır; yeniden dağıtımda hayalet masalar kalmasın.
  if(db.tables.length||Object.keys(db.tableChats).length){
    // Only running Ludo tables survive deploy. Do not wipe the rest of Club data.
    db.tables=db.tables.filter(t=>t.game==='ludo'&&db.ludoGames?.[`${t.roomId}:${t.no}`]&&!db.ludoGames[`${t.roomId}:${t.no}`].game.finished);
    db.tableChats=Object.fromEntries(Object.entries(db.tableChats).filter(([key])=>db.tables.some(t=>`${t.roomId}:${t.no}`===key)));save();
  }
  const adminEmail=email(process.env.ARENA_CLUB_ADMIN_EMAIL);
  const adminPassword=process.env.ARENA_CLUB_ADMIN_PASSWORD||'';
  if(!db.users.some(u=>u.role==='admin')&&adminEmail&&adminPassword.length>=12&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)){
    db.users.push({id:ident(),username:'yonetici',name:'Arena Yönetici',email:adminEmail,pass:passwordHash(adminPassword),role:'admin',tier:'elite',created:now(),privateMessages:false,photos:[],style:'gold'});save();
    console.log('Arena Club ilk yönetici hesabı oluşturuldu. İlk kurulumdan sonra ADMIN_PASSWORD değişkenini kaldırabilirsiniz.');
  }
  const connections=new Map(); // ws -> userId
  const presence=new Map(); // userId -> {roomId,tableNo,as,expires,ws}
  const rate=new Map();
  const wss=new WebSocketServer({noServer:true,maxPayload:8192});
  const userById=id=>db.users.find(u=>u.id===id);
  const roomById=id=>db.rooms.find(r=>r.id===id);
  const tableKey=(roomId,no)=>`${roomId}:${no}`;
  const currentTable=(roomId,no)=>db.tables.find(t=>t.roomId===roomId&&t.no===no);
  // Masa doluluğu ile gerçekten bağlı oyuncuları birbirinden ayır.
  // WebSocket kısa süreli kesilirse, oturumla doğrulanmış HTTP yoklaması da kullanılabilir.
  const isConnectedPlayer=p=>Boolean(p&&p.expires>now()&&(p.ws?.readyState===WebSocket.OPEN||(p.lastPulse||0)>now()-20000));
  const isBanned=u=>Boolean(u?.bannedUntil&&u.bannedUntil>now());
  const publicTournament=t=>({id:t.id,name:t.name,game:t.game,startAt:t.startAt,status:t.status,maxPlayers:t.maxPlayers,participants:t.participants.length,winnerName:t.winnerId?userById(t.winnerId)?.name:null,rewardTier:t.rewardTier||null,joined:t.participants});
  const publicRoom=r=>({id:r.id,name:r.name,game:r.game,tableCount:r.tableCount,rentalUntil:r.rentalUntil||null,ownerId:r.ownerId||null,online:[...presence.values()].filter(p=>p.roomId===r.id&&p.expires>now()).length});
  function serializeTable(t,viewerId=null){const active=db.ludoGames[tableKey(t.roomId,t.no)];const members=[...presence.entries()].filter(([id,p])=>p.roomId===t.roomId&&p.tableNo===t.no&&p.expires>now()).map(([id,p])=>({user:publicUser(userById(id)),as:p.as,connected:isConnectedPlayer(p)}));return {...t,members,chat:(db.tableChats[tableKey(t.roomId,t.no)]||[]).slice(-50),gameReady:t.game==='ludo',ludo:active?{matchId:active.id,state:viewLudo(active.game,viewerId),result:active.result||null}:null};}
  const tableSummary=(r)=>Array.from({length:r.tableCount},(_,i)=>{const no=i+1,t=currentTable(r.id,no);const members=t?[...presence.values()].filter(p=>p.roomId===r.id&&p.tableNo===no&&p.as==='player'&&p.expires>now()).length:0;return {no,ownerId:t?.ownerId||null,game:t?.game||r.game,players:members,max:t?.maxPlayers||4,locked:t?.spectators===false,playing:!!(t&&db.ludoGames[tableKey(r.id,no)]&&!db.ludoGames[tableKey(r.id,no)].game.finished)};});
  function self(u){return {...publicUser(u),email:u.email,banUntil:u.bannedUntil||null,csrf:''};}
  function getSession(req){const token=cookie(req,'arena_club_session');if(!token)return null;const s=db.sessions.find(x=>x.hash===digest(token)&&x.expires>now());if(!s)return null;const u=userById(s.userId);return u&&!isBanned(u)?{u,s}:null;}
  function auth(req){const found=getSession(req);if(!found)throw HttpError('Oturum açmanız gerekiyor.',401);return found;}
  function requireStaff(u){if(!isStaff(u))throw HttpError('Bu işlem için moderatör yetkisi gerekli.',403);}
  function requireAdmin(u){if(u.role!=='admin')throw HttpError('Bu işlem için yönetici yetkisi gerekli.',403);}
  function respond(res,status,data,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(JSON.stringify(data));}
  function sessionCreate(res,u,req){const token=crypto.randomBytes(32).toString('base64url');const csrf=crypto.randomBytes(24).toString('base64url');db.sessions.push({hash:digest(token),userId:u.id,csrf,expires:now()+14*86400000});save();const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https';return {'Set-Cookie':`arena_club_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600${secure?'; Secure':''}`};}
  function tableAccess(u,r){if(!r)throw HttpError('Salon bulunamadı.',404);}
  function canManageRoom(u,r){return u.role==='admin'||Boolean(r.ownerId===u.id&&r.rentalUntil>now()&&isPremium(u));}
  function audit(actor,action,detail=''){db.audit.unshift({id:ident(),actor:actor?.id||null,action,detail:clean(detail,160),time:now()});db.audit=db.audit.slice(0,500);}
  function liveUsers(roomId){return [...presence.entries()].filter(([id,p])=>p.roomId===roomId&&p.expires>now()).map(([id])=>publicUser(userById(id)));}
  function syncRoom(roomId){const r=roomById(roomId);if(!r)return;const packet={type:'room_state',room:publicRoom(r),tables:tableSummary(r),users:liveUsers(roomId),announcements:db.announcements.slice(-15),vipChat:db.vipChat.filter(m=>m.roomId===roomId).slice(-35)};for(const [ws,id] of connections){const u=userById(id);if(presence.get(id)?.roomId===roomId){send(ws,{...packet,vipChat:isPremium(u)?packet.vipChat:[]});}}}
  function syncTable(roomId,no){const t=currentTable(roomId,no);if(!t)return;for(const [ws,id] of connections)if(presence.get(id)?.roomId===roomId&&presence.get(id)?.tableNo===no)send(ws,{type:'table_state',table:serializeTable(t,id)});}
  function emitRoom(roomId,packet,test=()=>true){for(const [ws,id] of connections)if(presence.get(id)?.roomId===roomId&&test(userById(id)))send(ws,packet);}
  function prune(){for(const [id,p] of presence){if(p.expires<=now()){presence.delete(id);if(p.tableNo)syncTable(p.roomId,p.tableNo);syncRoom(p.roomId);}}}
  function ludoEntry(roomId,no){return db.ludoGames[tableKey(roomId,no)];}
  function liveLudoUsers(entry){return entry.game.players.filter(p=>{
    const q=presence.get(p.token);return q?.roomId===entry.roomId&&q.tableNo===entry.no&&q.as==='player'&&isConnectedPlayer(q);
  });}
  function recordLudoWin(entry){
    if(!entry.game.finished||entry.settled)return;
    const winner=entry.game.winner,players=entry.game.players;
    if(winner===null||!Number.isInteger(winner)||![2,4].includes(players.length))return;
    const deltas=ludoPointDeltas(players.length,winner);
    entry.result={winnerId:players[winner].token,points:players.map((p,i)=>({userId:p.token,name:p.name,delta:deltas[i]})),finishedAt:now()};
    for(let i=0;i<players.length;i++){
      const member=userById(players[i].token);if(!member)continue;
      member.points=(member.points||0)+deltas[i];member.weeklyPoints=(member.weeklyPoints||0)+deltas[i];
      if(i===winner)member.wins=(member.wins||0)+1;
    }
    entry.settled=true;
    db.matchHistory.push({id:entry.id,roomId:entry.roomId,tableNo:entry.no,game:'ludo',...entry.result});
    db.matchHistory=db.matchHistory.slice(-2000);audit(null,'ludo_result',`${entry.id}: ${players[winner].name} +6`);save();
  }
  function updateLudoPresence(entry){
    const online=liveLudoUsers(entry);
    if(!online.length){if(!entry.sleeping){entry.sleeping=true;save();}return false;} // No unattended point farming.
    const time=now();let dirty=false;
    if(entry.sleeping){entry.sleeping=false;entry.game.deadline=time+entry.game.turnSeconds*1000;dirty=true;}
    for(const p of entry.game.players){
      const here=online.some(q=>q.token===p.token);
      if(here){if(p.disconnectedAt){if(p.botReason==='disconnect')p.bot=false;p.disconnectedAt=null;p.botReason=null;dirty=true;}}
      else if(!p.disconnectedAt){p.disconnectedAt=time;dirty=true;}
      else if(!p.bot&&time-p.disconnectedAt>=25000){p.bot=true;p.botReason='disconnect';dirty=true;}
    }
    if(dirty)save();return true;
  }
  function ludoTick(){
    for(const entry of Object.values(db.ludoGames)){
      const g=entry.game;if(g.finished)continue;
      if(!updateLudoPresence(entry))continue;
      const time=now();let changed=false;
      if(g.players[g.turn].bot){
        if(!entry.botActionAt||time-entry.botActionAt>=1200){changed=playBotLudo(g,time);entry.botActionAt=time;}
      }else changed=tickLudo(g,time);
      if(changed){recordLudoWin(entry);save();syncTable(entry.roomId,entry.no);syncRoom(entry.roomId);}
    }
  }
  const timer=setInterval(()=>{prune();ludoTick();},1000);timer.unref();
  function messageBucket(key){const stamp=`${key}`;const old=rate.get(stamp)||0;if(now()-old<900)throw HttpError('Mesaj göndermeden önce biraz bekleyin.',429);rate.set(stamp,now());}
  function validateSettings(game,settings={}){
    if(!games[game])throw HttpError('Oyun türü bulunamadı.');
    const def=games[game];const maxPlayers=Number(settings.maxPlayers||def.max[def.max.length-1]);
    if(!def.max.includes(maxPlayers))throw HttpError('Oyuncu sayısı bu oyun için uygun değil.');
    const s={maxPlayers,spectators:settings.spectators!==false,privateChat:settings.privateChat!==false,turnSeconds:[15,20,30,45,60].includes(Number(settings.turnSeconds))?Number(settings.turnSeconds):30};
    if(def.mode==='rounds'){const rounds=Number(settings.rounds||def.rounds[0]);if(!def.rounds.includes(rounds))throw HttpError('Geçersiz el sayısı.');s.rounds=rounds;}
    else{const points=Number(settings.points||20);if(!def.points.includes(points))throw HttpError('Geçersiz Okey puanı.');s.points=points;}
    return s;
  }
  function tableInit(u,roomId,no,settings={}){
    const r=roomById(roomId);tableAccess(u,r);strictLimit(no,1,r.tableCount,'Masa numarası');let t=currentTable(roomId,no);
    if(!t){const game=r.game;if(settings.game&&settings.game!==r.game)throw HttpError('Bu salonun masalarında yalnızca salonun oyunu oynanabilir.',409);const config=validateSettings(game,settings);t={roomId,no,ownerId:u.id,game,...config,created:now()};db.tables.push(t);audit(u,'table_create',`${r.name} #${no} ${game}`);save();}
    return t;
  }
  function canMessage(a,b,roomId,no){const p=presence.get(a.id),q=presence.get(b.id);const t=currentTable(roomId,no);if(!t||!p||!q||p.tableNo!==no||q.tableNo!==no||p.roomId!==roomId||q.roomId!==roomId)return false;
    if(a.privateMessages===false||b.privateMessages===false)return false;
    if(t.privateChat!==false)return true;
    if(t.game!=='esli-okey')return false;
    const playerIds=[...presence.entries()].filter(([id,x])=>x.roomId===roomId&&x.tableNo===no&&x.as==='player').map(([id])=>id);
    const aI=playerIds.indexOf(a.id),bI=playerIds.indexOf(b.id);return aI>=0&&bI>=0&&aI!==bI&&aI%2===bI%2;
  }
  function requireInTable(u,roomId,no){const p=presence.get(u.id);if(!p||p.roomId!==roomId||p.tableNo!==no||p.expires<=now())throw HttpError('Önce masaya katılın.',403);return p;}
  function fileResponse(req,res,id){const request= db.approvals.find(a=>a.type==='photo'&&a.payload?.photoId===id);const owner=db.users.find(u=>(u.photos||[]).some(p=>p.id===id));const session=getSession(req);if(!owner&&!request)throw HttpError('Görsel bulunamadı.',404);
    if(!owner&&(!session||(session.u.id!==request.userId&&!isStaff(session.u))))throw HttpError('Görsel onay bekliyor.',403);
    const file=path.join(mediaDir,id);if(!/^[0-9a-f-]{36}$/.test(id)||!fs.existsSync(file))throw HttpError('Görsel dosyası bulunamadı.',404);
    const bytes=fs.readFileSync(file),mime=imageType(bytes);if(!mime)throw HttpError('Geçersiz görsel.',400);
    res.writeHead(200,{'Content-Type':mime,'Cache-Control':owner?'public, max-age=3600':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"});res.end(bytes);
  }
  async function readJson(req){let size=0,chunks=[];for await(const part of req){size+=part.length;if(size>1650000)throw HttpError('İstek çok büyük.',413);chunks.push(part);}try{const result=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');if(!result||Array.isArray(result)||typeof result!=='object')throw Error();return result;}catch{throw HttpError('Geçersiz JSON.');}}
  async function handle(req,res,url){
    if(!url.pathname.startsWith('/api/club/'))return false;
    try{
      const route=url.pathname.slice('/api/club'.length);const method=req.method;
      if(method!=='GET'&&method!=='POST'&&method!=='PATCH'&&method!=='DELETE')throw HttpError('İzin verilmeyen yöntem.',405);
      if(method!=='GET'&&!originSafe(req))throw HttpError('İstek kaynağı doğrulanamadı.',403);
      if(route.startsWith('/media/')&&method==='GET'){fileResponse(req,res,route.split('/').pop());return true;}
      if(route==='/tournaments'&&method==='GET'){respond(res,200,{tournaments:db.tournaments.map(publicTournament)});return true;}
      if(route==='/leaderboard'&&method==='GET'){respond(res,200,{players:db.users.slice().sort((a,b)=>(b.weeklyPoints||0)-(a.weeklyPoints||0)).slice(0,25).map(publicUser)});return true;}
      if(route==='/config'&&method==='GET'){return respond(res,200,{games,configured:db.users.some(u=>u.role==='admin'),version:'2.2.0'}),true;}
      if(route==='/register'&&method==='POST'){
        const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].slice(0,64);
        const key=`reg:${ip}`;const row=rate.get(key)||{count:0,start:now()};if(now()-row.start>3600000){row.count=0;row.start=now();}if(++row.count>12)throw HttpError('Çok sayıda kayıt denemesi. Daha sonra yeniden deneyin.',429);rate.set(key,row);
        const d=await readJson(req);const username=clean(d.username,25),name=clean(d.name,32),mail=email(d.email),password=String(d.password||'');
        if(!/^[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ]{3,25}$/.test(username)||name.length<2||! /^[^@\s]{1,64}@[^@\s]+\.[^@\s]+$/.test(mail)||password.length<10||password.length>128)throw HttpError('Kullanıcı adı, görünen ad, e-posta veya şifre geçersiz. Şifre en az 10 karakter olmalı.');
        if(db.users.some(u=>u.username.toLowerCase()===username.toLowerCase()||u.email===mail))throw HttpError('Bu kullanıcı adı veya e-posta kullanımda.',409);
        const u={id:ident(),username,name,email:mail,pass:passwordHash(password),role:'member',tier:'standard',tierExpires:null,privateMessages:true,photos:[],style:'gold',created:now(),points:0,wins:0,weeklyPoints:0};db.users.push(u);save();const headers=sessionCreate(res,u,req);respond(res,201,{user:self(u),csrf:db.sessions.at(-1).csrf},headers);return true;
      }
      if(route==='/login'&&method==='POST'){
        const d=await readJson(req),id=email(d.login),pw=String(d.password||'');
        if(pw.length>128)throw HttpError('Giriş bilgileri hatalı.',401);
        const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].slice(0,64);
        const limiter=`login:${ip}`;const entry=rate.get(limiter)||{count:0,start:now()};if(now()-entry.start>900000){entry.count=0;entry.start=now();}if(++entry.count>40)throw HttpError('Çok fazla giriş denemesi. Daha sonra yeniden deneyin.',429);rate.set(limiter,entry);const u=db.users.find(u=>u.email===id||u.username.toLowerCase()===id);
        if(!u||!passwordMatch(pw,u.pass))throw HttpError('Kullanıcı adı veya şifre hatalı.',401);
        if(isBanned(u))throw HttpError(`Hesap ${new Date(u.bannedUntil).toLocaleString('tr-TR')} tarihine kadar yasaklı.`,403);
        const headers=sessionCreate(res,u,req);respond(res,200,{user:self(u),csrf:db.sessions.at(-1).csrf},headers);return true;
      }
      if(route==='/me'&&method==='GET'){
        const s=getSession(req);respond(res,200,{user:s?self(s.u):null,csrf:s?.s.csrf||null,rooms:db.rooms.map(publicRoom),unread:s?db.dm.filter(m=>m.to===s.u.id).slice(-30):[]});return true;
      }
      const {u,s}=auth(req);
      if(method!=='GET'&&req.headers['x-club-csrf']!==s.csrf)throw HttpError('Güvenlik doğrulaması başarısız. Sayfayı yenileyin.',403);
      const d=method==='GET'?{}:await readJson(req);
      if(route==='/logout'&&method==='POST'){db.sessions=db.sessions.filter(x=>x!==s);save();respond(res,200,{ok:true},{'Set-Cookie':'arena_club_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'});return true;}
      if(route==='/password'&&method==='POST'){
        if(!passwordMatch(String(d.old||''),u.pass)||String(d.password||'').length<10||String(d.password||'').length>128)throw HttpError('Eski şifre hatalı veya yeni şifre çok kısa.');u.pass=passwordHash(String(d.password));db.sessions=db.sessions.filter(x=>x.userId!==u.id||x===s);save();respond(res,200,{ok:true});return true;
      }
      if(route==='/privacy'&&method==='PATCH'){u.privateMessages=d.privateMessages===true;save();respond(res,200,{user:self(u)});return true;}
      if(route==='/profile'&&method==='POST'){
        if(db.approvals.some(a=>a.userId===u.id&&a.status==='pending'&&a.type==='profile'))throw HttpError('Önceki profil değişikliğiniz hâlâ inceleniyor.');
        const payload={name:clean(d.name,32),bio:clean(d.bio,300),email:email(d.email||u.email),style:clean(d.style,20)};
        if(payload.name.length<2||! /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email))throw HttpError('Profil bilgilerini kontrol edin.');
        if(payload.email!==u.email&&db.users.some(x=>x.id!==u.id&&x.email===payload.email))throw HttpError('E-posta kullanımda.');
        if(payload.style!==u.style&&!isPremium(u))throw HttpError('Özel isim rengi VIP/ELITE üyelere açıktır.',403);
        if(!allowedStyles.has(payload.style))payload.style='gold';
        const a={id:ident(),type:'profile',userId:u.id,payload,status:'pending',created:now()};db.approvals.push(a);save();respond(res,201,{ok:true,approval:a.id});return true;
      }
      if(route==='/photo'&&method==='POST'){
        const raw=String(d.image||'');const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(raw);if(!match)throw HttpError('Yalnızca PNG, JPEG ve WebP yüklenebilir.');
        const bytes=Buffer.from(match[2],'base64');const mime=imageType(bytes);if(!mime||bytes.length>1000000||bytes.length<20||mime!==`image/${match[1]}`)throw HttpError('Görsel türü veya boyutu uygun değil (en fazla 1 MB).');
        const limit=photoLimit(u),replace=clean(d.replaceId,45);const pending=db.approvals.filter(a=>a.userId===u.id&&a.type==='photo'&&a.status==='pending');
        if(replace&&!(u.photos||[]).some(p=>p.id===replace))throw HttpError('Değiştirilecek fotoğraf bulunamadı.');
        const count=(u.photos||[]).length+pending.filter(a=>!a.payload.replaceId).length;if(count>=limit&&!replace)throw HttpError(`Fotoğraf sınırınız ${limit}. Mevcut fotoğrafı değiştirebilirsiniz.`);
        const id=ident();fs.writeFileSync(path.join(mediaDir,id),bytes,{flag:'wx',mode:0o600});const a={id:ident(),type:'photo',userId:u.id,payload:{photoId:id,replaceId:replace||null,avatar:d.avatar===true||!u.avatarId},status:'pending',created:now()};db.approvals.push(a);save();respond(res,201,{ok:true,approval:a.id});return true;
      }
      if(route==='/approvals/mine'&&method==='GET'){respond(res,200,{approvals:db.approvals.filter(a=>a.userId===u.id).slice(-30)});return true;}
      if(route==='/rooms'&&method==='GET'){const game=url.searchParams.get('game');if(game&&!games[game])throw HttpError('Oyun türü bulunamadı.',400);respond(res,200,{rooms:db.rooms.filter(r=>!game||r.game===game).map(publicRoom)});return true;}
      if(route==='/tournament/join'&&method==='POST'){
        const t=db.tournaments.find(x=>x.id===d.id);if(!t||t.status!=='open')throw HttpError('Bu turnuvaya artık katılamazsın.',409);
        if(t.participants.includes(u.id))throw HttpError('Turnuvaya zaten kayıtlısın.',409);
        if(t.participants.length>=t.maxPlayers)throw HttpError('Turnuva kontenjanı dolmuş.',409);
        t.participants.push(u.id);save();respond(res,200,{tournament:publicTournament(t)});return true;
      }
      if(route==='/room/enter'&&method==='POST'){
        const r=roomById(d.roomId);if(!r)throw HttpError('Salon bulunamadı.',404);
        const p=presence.get(u.id);if(p?.tableNo){const oldNo=p.tableNo;p.tableNo=null;p.as=null;syncTable(p.roomId,oldNo);}
        presence.set(u.id,{roomId:r.id,tableNo:null,as:null,expires:now()+45000,lastPulse:now(),ws:[...connections].find(([,id])=>id===u.id)?.[0]||null});syncRoom(r.id);respond(res,200,{room:publicRoom(r),tables:tableSummary(r),announcements:db.announcements.slice(-15),vipChat:isPremium(u)?db.vipChat.filter(m=>m.roomId===r.id).slice(-35):[],users:liveUsers(r.id)});return true;
      }
      if(route==='/room/leave'&&method==='POST'){
        const p=presence.get(u.id);if(p){presence.delete(u.id);syncRoom(p.roomId);if(p.tableNo)syncTable(p.roomId,p.tableNo);};respond(res,200,{ok:true});return true;
      }
      if(route==='/table/join'&&method==='POST'){
        const r=roomById(d.roomId),no=Number(d.no);tableAccess(u,r);strictLimit(no,1,r.tableCount,'Masa');const current=presence.get(u.id);
        if(current?.tableNo){const oldNo=current.tableNo,oldRoom=current.roomId;presence.set(u.id,{roomId:oldRoom,expires:now()+45000,lastPulse:now(),ws:current.ws||null});syncTable(oldRoom,oldNo);syncRoom(oldRoom);}
        let t=currentTable(r.id,no);if(!t){if(d.as==='spectator')throw HttpError('Henüz kurulmamış masayı izleyemezsiniz.');t=tableInit(u,r.id,no,d.settings||{});}
        const as=d.as==='spectator'?'spectator':'player';if(as==='spectator'&&!t.spectators)throw HttpError('Masa sahibi izleyici girişini kapatmış.');
        const inProgress=ludoEntry(r.id,no);
        if(t.game==='ludo'&&inProgress&&!inProgress.game.finished&&as==='player'&&!inProgress.game.players.some(p=>p.token===u.id))throw HttpError('Maç başladı. Yeni oyuncu alınamıyor; izleyici olarak katılabilirsiniz.',409);

        if(as==='player'){
          const count=[...presence.entries()].filter(([id,p])=>id!==u.id&&p.roomId===r.id&&p.tableNo===no&&p.as==='player'&&p.expires>now()).length;
          if(count>=t.maxPlayers)throw HttpError('Masa dolu.');
        }
        presence.set(u.id,{roomId:r.id,tableNo:no,as,expires:now()+45000,lastPulse:now(),ws:[...connections].find(([,id])=>id===u.id)?.[0]||null});
        // A reconnecting player takes back their seat from the bot.
        if(inProgress&&!inProgress.game.finished&&as==='player'){const p=inProgress.game.players.find(p=>p.token===u.id);if(p){p.bot=false;p.botReason=null;p.disconnectedAt=null;save();}}
        syncTable(r.id,no);syncRoom(r.id);respond(res,200,{table:serializeTable(t,u.id)});return true;
      }
      if(route==='/table/state'&&method==='GET'){
        const roomId=url.searchParams.get('roomId'),no=Number(url.searchParams.get('no'));
        const t=currentTable(roomId,no);if(!t)throw HttpError('Masa bulunamadı.',404);
        requireInTable(u,roomId,no);respond(res,200,{table:serializeTable(t,u.id)});return true;
      }
      if(route==='/table/pulse'&&method==='POST'){
        const no=Number(d.no),t=currentTable(d.roomId,no);
        if(!t)throw HttpError('Masa bulunamadı.',404);
        const p=requireInTable(u,t.roomId,no),wasOnline=isConnectedPlayer(p);
        p.expires=now()+45000;p.lastPulse=now();
        if(!wasOnline){syncTable(t.roomId,no);syncRoom(t.roomId);}
        respond(res,200,{table:serializeTable(t,u.id)});return true;
      }
      if(route==='/table/leave'&&method==='POST'){
        const p=presence.get(u.id);if(!p?.tableNo)throw HttpError('Masada değilsiniz.');const roomId=p.roomId,no=p.tableNo;presence.set(u.id,{...p,tableNo:null,as:null,expires:now()+45000,lastPulse:now()});
        const t=currentTable(roomId,no);const seatIds=[...presence.entries()].filter(([id,q])=>q.roomId===roomId&&q.tableNo===no&&q.as==='player'&&q.expires>now()).map(([id])=>id);const others=[...presence.values()].some(q=>q.roomId===roomId&&q.tableNo===no&&q.expires>now());if(t&&t.ownerId===u.id&&seatIds.length){t.ownerId=seatIds[0];save();}if(t&&!seatIds.length&&!ludoEntry(roomId,no)){ for(const [id,q] of presence)if(q.roomId===roomId&&q.tableNo===no){presence.set(id,{roomId,tableNo:null,as:null,expires:now()+45000});for(const [ws,connectedId] of connections)if(connectedId===id)send(ws,{type:'table_closed',roomId,no});}db.tables=db.tables.filter(x=>x!==t);delete db.tableChats[tableKey(roomId,no)];save();}
        syncTable(roomId,no);syncRoom(roomId);respond(res,200,{ok:true});return true;
      }
      if(route==='/table/settings'&&method==='PATCH'){
        const t=currentTable(d.roomId,Number(d.no));if(!t)throw HttpError('Masa bulunamadı.',404);
        if(t.ownerId!==u.id&&u.role!=='admin')throw HttpError('Yalnız masa sahibi kuralları düzenleyebilir.',403);
        if(d.settings?.game&&d.settings.game!==t.game)throw HttpError('Bu masanın oyun türü salonla aynıdır; değiştirilemez.',409);if(t.game==='ludo'&&ludoEntry(t.roomId,t.no)&&!ludoEntry(t.roomId,t.no).game.finished)throw HttpError('Maç sürerken oyun kuralları değiştirilemez.',409);const updated=validateSettings(t.game,{...t,...d.settings});const playerCount=[...presence.values()].filter(p=>p.roomId===t.roomId&&p.tableNo===t.no&&p.as==='player'&&p.expires>now()).length;
        if(playerCount>updated.maxPlayers)throw HttpError('Oyuncu sayısının altında kapasite seçilemez.');Object.assign(t,updated);
        if(!t.spectators){for(const [id,p] of presence)if(p.roomId===t.roomId&&p.tableNo===t.no&&p.as==='spectator')presence.set(id,{roomId:t.roomId,expires:now()+45000});}
        save();syncRoom(t.roomId);syncTable(t.roomId,t.no);respond(res,200,{table:serializeTable(t)});return true;
      }
      if(route==='/table/ludo/start'&&method==='POST'){
        const no=Number(d.no),t=currentTable(d.roomId,no),r=roomById(d.roomId);
        if(!t||t.game!=='ludo'||!r)throw HttpError('Kızma Birader masası bulunamadı.',404);
        requireInTable(u,r.id,no);
        if(t.ownerId!==u.id&&u.role!=='admin')throw HttpError('Maçı yalnız masa sahibi başlatabilir.',403);
        const previous=ludoEntry(r.id,no);
        if(previous&&!previous.game.finished)throw HttpError('Bu masada zaten aktif maç var.',409);
        const seated=[...presence.entries()].filter(([id,p])=>p.roomId===r.id&&p.tableNo===no&&p.as==='player'&&p.expires>now());
        const ready=seated.filter(([,p])=>isConnectedPlayer(p));
        if(seated.length!==t.maxPlayers||![2,4].includes(t.maxPlayers))throw HttpError(`Maçı başlatmak için ${t.maxPlayers} ayrı oyuncunun masaya oturması gerekiyor (şu an ${seated.length}).`,409);
        if(ready.length!==seated.length)throw HttpError(`Masada ${seated.length} oyuncu var ancak ${ready.length} oyuncunun bağlantısı doğrulandı. Diğer oyuncu oyun sekmesini açıp birkaç saniye beklesin.`,409);
        const ids=ready.map(([id])=>id);
        const seats=ids.map(id=>{const member=userById(id);return {token:id,name:member.name,avatar:member.avatarId?`/api/club/media/${member.avatarId}`:''};});
        const g=startLudo(seats,{turnSeconds:t.turnSeconds});
        db.ludoGames[tableKey(r.id,no)]={id:ident(),roomId:r.id,no,game:g,createdAt:now(),settled:false};
        audit(u,'ludo_start',`${r.name} Masa ${no}`);save();syncTable(r.id,no);syncRoom(r.id);
        respond(res,201,{table:serializeTable(t,u.id)});return true;
      }
      if(route==='/table/ludo/takeover'&&method==='POST'){
        const no=Number(d.no),t=currentTable(d.roomId,no),entry=ludoEntry(d.roomId,no);
        if(!t||!entry||entry.game.finished)throw HttpError('Devralınacak aktif maç yok.',404);
        const p=requireInTable(u,t.roomId,t.no);
        if(p.as!=='player')throw HttpError('Oyuncu koltuğu gerekli.',403);
        const seat=entry.game.players.find(x=>x.token===u.id);
        if(!seat)throw HttpError('Bu maçın oyuncusu değilsin.',403);
        seat.bot=false;seat.botReason=null;seat.disconnectedAt=null;seat.timeouts=0;
        if(entry.game.players[entry.game.turn]===seat)entry.game.deadline=now()+entry.game.turnSeconds*1000;
        save();syncTable(t.roomId,t.no);respond(res,200,{table:serializeTable(t,u.id)});return true;
      }
      if(['/table/ludo/roll','/table/ludo/move'].includes(route)&&method==='POST'){
        const no=Number(d.no),t=currentTable(d.roomId,no),entry=ludoEntry(d.roomId,no);
        if(!t||t.game!=='ludo'||!entry)throw HttpError('Aktif Kızma Birader maçı yok.',404);
        const inSeat=requireInTable(u,t.roomId,t.no);
        if(inSeat.as!=='player')throw HttpError('İzleyiciler hamle yapamaz.',403);
        const seat=entry.game.players.findIndex(p=>p.token===u.id);
        if(seat<0)throw HttpError('Bu maçın oyuncusu değilsin.',403);
        if(entry.game.players[seat].bot)throw HttpError('Bot koltuğunu devralmak için masaya yeniden katıl.',409);
        try{if(route.endsWith('/roll'))rollLudo(entry.game,seat);
        else moveLudo(entry.game,seat,d.pawn);}
        catch(error){throw HttpError(error.message,409);}
        entry.game.players[seat].timeouts=0;recordLudoWin(entry);save();syncTable(t.roomId,t.no);syncRoom(t.roomId);
        respond(res,200,{table:serializeTable(t,u.id)});return true;
      }
      if(route==='/matches/mine'&&method==='GET'){
        respond(res,200,{matches:db.matchHistory.filter(m=>m.points.some(p=>p.userId===u.id)).slice(-30)});return true;
      }
      if(route==='/chat/table'&&method==='POST'){
        const no=Number(d.no),p=requireInTable(u,d.roomId,no),t=currentTable(d.roomId,no);
        messageBucket(`chat:${u.id}`);const message=clean(d.message,240);if(!message)throw HttpError('Boş mesaj gönderilemez.');const key=tableKey(t.roomId,t.no);
        const msg={id:ident(),user:publicUser(u),message,time:now()};db.tableChats[key] ||= [];db.tableChats[key].push(msg);db.tableChats[key]=db.tableChats[key].slice(-70);save();
        syncTable(t.roomId,t.no);respond(res,201,{ok:true});return true;
      }
      if(route==='/chat/vip'&&method==='POST'){
        if(!isPremium(u))throw HttpError('Salon sohbeti yalnız VIP/ELITE üyelere açık.',403);
        const p=presence.get(u.id);if(!p||p.roomId!==d.roomId)throw HttpError('Salona giriş yapın.',403);
        messageBucket(`vip:${u.id}`);const message=clean(d.message,240);if(!message)throw HttpError('Boş mesaj.');
        db.vipChat.push({id:ident(),roomId:p.roomId,user:publicUser(u),message,time:now()});db.vipChat=db.vipChat.slice(-200);save();syncRoom(p.roomId);respond(res,201,{ok:true});return true;
      }
      if(route==='/chat/dm'&&method==='POST'){
        const to=userById(d.to),p=presence.get(u.id);if(!to||to.id===u.id||!p?.tableNo||!canMessage(u,to,p.roomId,p.tableNo))throw HttpError('Bu masada özel mesajlaşmaya izin verilmiyor.',403);
        messageBucket(`dm:${u.id}`);const message=clean(d.message,240);if(!message)throw HttpError('Boş mesaj.');const msg={id:ident(),from:u.id,to:to.id,fromName:u.name,message,time:now()};db.dm.push(msg);db.dm=db.dm.slice(-1000);save();for(const [ws,id] of connections)if(id===u.id||id===to.id)send(ws,{type:'dm',message:msg});respond(res,201,{ok:true});return true;
      }
      if(route==='/report'&&method==='POST'){
        const type=clean(d.type,30),reason=clean(d.reason,500),against=userById(d.against);
        if(!['chat','player','table'].includes(type)||reason.length<10)throw HttpError('Şikâyet için en az 10 karakterlik açıklama yazın.');
        const item={id:ident(),by:u.id,against:against?.id||null,roomId:clean(d.roomId,50),tableNo:Number(d.tableNo)||null,type,reason,status:'pending',created:now()};db.reports.push(item);save();respond(res,201,{ok:true});return true;
      }
      if(route==='/admin/summary'&&method==='GET'){
        requireStaff(u);respond(res,200,{users:db.users.map(x=>({...publicUser(x),email:x.email,bannedUntil:x.bannedUntil||null})),rooms:db.rooms.map(publicRoom),approvals:db.approvals.filter(a=>a.status==='pending').map(a=>({...a,username:userById(a.userId)?.name})),reports:db.reports.filter(r=>r.status==='pending').map(r=>({...r,reporter:userById(r.by)?.name,againstName:userById(r.against)?.name})),announcements:db.announcements.slice(-20),tournaments:db.tournaments.map(publicTournament),audit:u.role==='admin'?db.audit.slice(0,30):[]});return true;
      }
      if(route==='/admin/approvals'&&method==='POST'){
        requireAdmin(u);const a=db.approvals.find(x=>x.id===d.id&&x.status==='pending');if(!a)throw HttpError('Onay talebi bulunamadı.',404);
        const owner=userById(a.userId);if(!owner)throw HttpError('Hesap bulunamadı.',404);
        if(d.approve===true){if(a.type==='profile'){
          const p=a.payload;if(p.email!==owner.email&&db.users.some(x=>x.email===p.email&&x.id!==owner.id))throw HttpError('E-posta kullanımda.');
          Object.assign(owner,{name:p.name,bio:p.bio,email:p.email,style:isPremium(owner)?p.style:'gold'});
        }else if(a.type==='photo'){
          owner.photos ||= [];const p=a.payload;if(p.replaceId){owner.photos=owner.photos.filter(x=>x.id!==p.replaceId);if(owner.avatarId===p.replaceId)owner.avatarId=null;}
          if(owner.photos.length>=photoLimit(owner))throw HttpError('Fotoğraf sınırı dolu.');owner.photos.push({id:p.photoId,created:now()});if(p.avatar||!owner.avatarId)owner.avatarId=p.photoId;
        }
        }else if(a.type==='photo'){try{fs.unlinkSync(path.join(mediaDir,a.payload.photoId));}catch{}}
        a.status=d.approve===true?'approved':'rejected';a.reviewedBy=u.id;a.reviewedAt=now();audit(u,'approval',`${a.id} ${a.status}`);save();respond(res,200,{ok:true});return true;
      }
      if(route==='/admin/user'&&method==='PATCH'){
        requireAdmin(u);const target=userById(d.id);if(!target)throw HttpError('Üye bulunamadı.',404);
        if(target.id===u.id&&d.role&&d.role!=='admin')throw HttpError('Kendi yönetici rolünüzü kaldıramazsınız.');
        if(d.role!==undefined){if(!roleNames.has(d.role))throw HttpError('Geçersiz rol.');target.role=d.role;}
        if(d.tier!==undefined){if(!tierNames.has(d.tier))throw HttpError('Geçersiz üyelik.');const exp=d.tierExpires?new Date(d.tierExpires).getTime():null;if(exp!==null&&!Number.isFinite(exp))throw HttpError('Üyelik bitiş tarihi geçersiz.');target.tier=d.tier;target.tierExpires=exp;}
        if(d.points!==undefined)target.points=strictLimit(Number(d.points),-100000000,100000000,'Puan');
        if(d.wins!==undefined)target.wins=strictLimit(Number(d.wins),0,100000000,'Galibiyet');
        if(d.weeklyPoints!==undefined)target.weeklyPoints=strictLimit(Number(d.weeklyPoints),-100000000,100000000,'Haftalık puan');
        audit(u,'user_edit',target.username);save();respond(res,200,{user:publicUser(target)});return true;
      }
      if(route==='/admin/ban'&&method==='POST'){
        requireStaff(u);const target=userById(d.id);if(!target||target.id===u.id||target.role==='admin'||(u.role==='moderator'&&target.role==='moderator'))throw HttpError('Bu kullanıcıyı yasaklayamazsınız.',403);
        const hours=Number(d.hours);if(![0,1,3,6,12,24,48,72,168,720].includes(hours))throw HttpError('Yasak süresi geçersiz.');
        target.bannedUntil=hours?now()+hours*3600000:null;db.sessions=db.sessions.filter(x=>x.userId!==target.id);presence.delete(target.id);for(const [ws,id] of connections)if(id===target.id){send(ws,{type:'banned'});ws.close(1008,'Account suspended');}
        audit(u,'ban',`${target.username} ${hours} saat`);save();respond(res,200,{ok:true});return true;
      }
      if(route==='/admin/report'&&method==='POST'){
        requireStaff(u);const r=db.reports.find(x=>x.id===d.id&&x.status==='pending');if(!r)throw HttpError('Şikâyet bulunamadı.',404);if(!['resolved','rejected'].includes(d.status))throw HttpError('Geçersiz durum.');r.status=d.status;r.reviewedBy=u.id;r.reviewedAt=now();audit(u,'report',`${r.id} ${r.status}`);save();respond(res,200,{ok:true});return true;
      }
      if(route==='/admin/announcement'&&method==='POST'){
        requireStaff(u);const content=clean(d.message,450);if(content.length<3)throw HttpError('Duyuru kısa.');const a={id:ident(),by:u.id,name:u.name,message:content,time:now()};db.announcements.push(a);db.announcements=db.announcements.slice(-80);save();for(const ws of connections.keys())send(ws,{type:'announcement',announcement:a});respond(res,201,{ok:true});return true;
      }
      if(route==='/admin/tournament'&&method==='POST'){
        requireAdmin(u);const name=clean(d.name,64),game=String(d.game||'ludo'),startAt=new Date(d.startAt).getTime();
        const maxPlayers=strictLimit(Number(d.maxPlayers),2,256,'Katılımcı sınırı');
        if(name.length<4||!games[game]||!Number.isFinite(startAt)||startAt<now()-86400000)throw HttpError('Turnuva bilgileri geçersiz.');
        const rewardTier=d.rewardTier||'none';if(!['none','vip','elite'].includes(rewardTier))throw HttpError('Ödül tipi geçersiz.');
        const rewardDays=Number(d.rewardDays||30);if(![7,14,30,60,90].includes(rewardDays))throw HttpError('Ödül süresi geçersiz.');
        const t={id:ident(),name,game,startAt,status:'open',maxPlayers,participants:[],winnerId:null,rewardTier,rewardDays,created:now()};
        db.tournaments.push(t);audit(u,'tournament_create',name);save();respond(res,201,{tournament:publicTournament(t)});return true;
      }
      if(route==='/admin/tournament/enroll'&&method==='POST'){
        requireAdmin(u);const t=db.tournaments.find(t=>t.id===d.id);
        if(!t||t.status!=='open')throw HttpError('Kayıt yapılamayan turnuva.',409);
        const member=userById(d.userId);if(!member||isBanned(member))throw HttpError('Katılımcı bulunamadı veya yasaklı.',404);
        if(t.participants.includes(member.id))throw HttpError('Üye zaten turnuvaya kayıtlı.',409);
        if(t.participants.length>=t.maxPlayers)throw HttpError('Turnuva kontenjanı dolu.',409);
        t.participants.push(member.id);audit(u,'tournament_enroll',`${t.name} → ${member.username} yönetici kaydı`);save();
        respond(res,200,{tournament:publicTournament(t)});return true;
      }
      if(route==='/admin/tournament/result'&&method==='POST'){
        requireAdmin(u);const t=db.tournaments.find(t=>t.id===d.id);if(!t||t.status==='finished')throw HttpError('Turnuva bulunamadı veya zaten sonuçlandı.',404);
        if(d.verified!==true)throw HttpError('Maç sonucu yönetici tarafından doğrulanmalıdır.',403);
        if(!t.participants.includes(d.winnerId))throw HttpError('Kazanan kayıtlı katılımcı değil.',400);
        const winner=userById(d.winnerId);t.status='finished';t.winnerId=winner.id;t.verifiedBy=u.id;t.completedAt=now();
        if(t.rewardTier!=='none'){winner.tier=t.rewardTier;winner.tierExpires=Math.max(now(),winner.tierExpires||0)+t.rewardDays*86400000;}
        audit(u,'tournament_result',`${t.name} → ${winner.username} manuel onay`);save();respond(res,200,{tournament:publicTournament(t)});return true;
      }
      if(route==='/admin/room'&&method==='POST'){
        requireAdmin(u);const name=clean(d.name,48),game=String(d.game||'ludo'),tableCount=Number(d.tableCount);
        if(name.length<3||!games[game])throw HttpError('Salon adı veya oyun türü geçersiz.');strictLimit(tableCount,1,200,'Masa sayısı');
        const r={id:ident(),name,game,tableCount,ownerId:null,rentalUntil:null};db.rooms.push(r);audit(u,'room_create',name);save();respond(res,201,{room:publicRoom(r)});return true;
      }
      if(route==='/admin/room'&&method==='PATCH'){
        const r=roomById(d.id);if(!r)throw HttpError('Salon bulunamadı.',404);if(!canManageRoom(u,r))throw HttpError('Salon yönetim yetkiniz yok.',403);
        if(d.name!==undefined){const name=clean(d.name,48);if(name.length<3)throw HttpError('Salon adı kısa.');r.name=name;}
        if(d.tableCount!==undefined){const cnt=strictLimit(Number(d.tableCount),1,200,'Masa sayısı');if(u.role!=='admin'&&cnt>40)throw HttpError('Kiralık salon en fazla 40 masa olabilir.',403);if(db.tables.some(t=>t.roomId===r.id&&t.no>cnt))throw HttpError('Önce kaldırılacak masaları boşaltın.',409);r.tableCount=cnt;}
        if(u.role==='admin'&&d.ownerId!==undefined){
          if(d.ownerId){const owner=userById(d.ownerId);if(!owner||!['vip','elite'].includes(owner.tier)||owner.tierExpires&&owner.tierExpires<=now())throw HttpError('Salon yalnız aktif VIP/ELITE üyeye kiralanabilir.');const end=new Date(d.rentalUntil).getTime();if(!Number.isFinite(end)||end<=now())throw HttpError('Gelecekte bir bitiş tarihi seçin.');r.ownerId=owner.id;r.rentalUntil=end;}
          else{r.ownerId=null;r.rentalUntil=null;}
        }
        audit(u,'room_update',r.name);save();syncRoom(r.id);respond(res,200,{room:publicRoom(r)});return true;
      }
      if(route==='/admin/room'&&method==='DELETE'){
        requireAdmin(u);const r=roomById(d.id);if(!r)throw HttpError('Salon bulunamadı.',404);if([...presence.values()].some(p=>p.roomId===r.id&&p.expires>now()))throw HttpError('Salonda oyuncu bulunuyor.',409);
        db.rooms=db.rooms.filter(x=>x.id!==r.id);db.tables=db.tables.filter(t=>t.roomId!==r.id);audit(u,'room_delete',r.name);save();respond(res,200,{ok:true});return true;
      }
      throw HttpError('API adresi bulunamadı.',404);
    }catch(e){respond(res,e.status||500,{error:e.status?e.message:'Sunucu hatası.'});if(!e.status)console.error('Club API',e);return true;}
  }
  wss.on('connection',(ws,req)=>{
    const s=getSession(req);if(!s){ws.close(1008,'Login required');return;}
    const id=s.u.id;connections.set(ws,id);const p=presence.get(id);if(p){p.expires=now()+45000;p.lastPulse=now();p.ws=ws;syncRoom(p.roomId);if(p.tableNo)syncTable(p.roomId,p.tableNo);}
    send(ws,{type:'ready',user:publicUser(s.u)});
    ws.on('message',data=>{let packet;try{packet=JSON.parse(data.toString());}catch{return;}if(packet.type==='ping'){
      const p=presence.get(id);if(p){p.expires=now()+45000;p.lastPulse=now();p.ws=ws;}
      send(ws,{type:'pong'});
    }});
    ws.on('close',()=>{connections.delete(ws);const p=presence.get(id);if(p&&p.ws===ws){p.ws=null;p.expires=Math.max(p.expires||0,now()+30000);if(p.tableNo)syncTable(p.roomId,p.tableNo);syncRoom(p.roomId);}});
  });
  return {handle,wss,db,getSession,close(){clearInterval(timer);wss.close();},games};
}
