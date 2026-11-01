/* Arena Club v2 — separate salon/user platform. Existing game clients remain untouched. */
const $=(s,root=document)=>root.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const apiRoot='/api/club';
const state={me:null,csrf:null,rooms:[],room:null,tables:[],users:[],announcements:[],vipChat:[],table:null,returnTable:null,dm:[],dmTo:null,roomGame:null,ws:null,page:'home',adminTab:'rooms',admin:null,games:{},notice:'',roomId:null,tournaments:[],leaders:[]};
const icons={ludo:'🎲',tavla:'♟',batak:'♠','101':'🀄',okey:'🀄','esli-okey':'🀄',mulk:'🏛',tombala:'🎱'};
const styleOf=u=>['vip','elite'].includes(u?.tier)?`premium-name ${esc(u.style||'gold')}`:'';
const userName=u=>`<span class="${styleOf(u)}">${esc(u?.name||'Oyuncu')}</span>`;
const tagTier=u=>`<span class="pill">${esc((u?.tier||'standard').toUpperCase())}</span>`;
function avatar(u,large=false){return u?.avatarId?`<img class="avatar${large?' large':''}" alt="${esc(u.name)}" src="${apiRoot}/media/${encodeURIComponent(u.avatarId)}">`:`<span class="avatar${large?' large':''}">${esc((u?.name||'?').slice(0,1).toUpperCase())}</span>`;}
const isStaff=()=>state.me&&['admin','moderator'].includes(state.me.role);
const isPremium=()=>state.me&&(['admin','moderator'].includes(state.me.role)||['vip','elite'].includes(state.me.tier)&&(!state.me.tierExpires||state.me.tierExpires>Date.now()));
function notice(message,error=false){const t=$('#toast');t.textContent=message;t.classList.toggle('error',error);t.classList.add('show');clearTimeout(notice.timer);notice.timer=setTimeout(()=>t.classList.remove('show'),4000);}
async function api(route,method='GET',data){const headers={};if(method!=='GET'){headers['Content-Type']='application/json';if(state.csrf)headers['X-Club-CSRF']=state.csrf;}
 const res=await fetch(apiRoot+route,{method,headers,body:data===undefined?undefined:JSON.stringify(data),credentials:'same-origin'});let obj={};try{obj=await res.json();}catch{}if(!res.ok)throw Error(obj.error||'Sunucu hatası');return obj;
}
function h(k){const g=state.games[k];return g?.label||k;}
function selected(v,c){return v===c?' selected':'';}
const fdate=value=>value?new Date(value).toLocaleDateString('tr-TR'):'Süresiz';
function switchPage(page){state.page=page;if(page==='admin'&&!isStaff()){notice('Yönetim izniniz yok.',true);state.page='home';}render();if(page==='admin')loadAdmin();}
function overlay(body,wide=false){$('#overlayRoot').innerHTML=`<div class="overlay" data-act="backdrop"><section class="modal${wide?' wide':''}" role="dialog" aria-modal="true">${body}</section></div>`;document.body.classList.add('modal-open');}
function closeOverlay(){const box=$('#overlayRoot');box.textContent='';document.body.classList.remove('modal-open');state.table=null;ludoFrame=null;ludoRollingUntil=0;if(ludoRollTimer)clearTimeout(ludoRollTimer);ludoRollTimer=null;ludoClearDrag();}
const closeButton='<button type="button" class="close" data-act="close" title="Kapat">×</button>';
function requireAuth(){if(state.me)return true;authModal();notice('Önce Arena Club hesabınla giriş yap.',true);return false;}
function authModal(mode='login'){
 const register=mode==='register';overlay(`<div class="modal-title"><div><div class="kicker">ARENA CLUB</div><h2>${register?'Hesap oluştur':'Tekrar hoş geldin'}</h2><p class="subtle">${register?'Salona katılmak için ücretsiz hesap aç.':'Arena Club hesabınla salonlara bağlan.'}</p></div>${closeButton}</div>
 <form id="authForm" class="form-stack"><input type="hidden" name="mode" value="${mode}">${register?`<label class="field-label">Kullanıcı adı<input name="username" required maxlength="25" minlength="3" autocomplete="username" placeholder="ornekoyuncu"></label><label class="field-label">Görünen isim<input name="name" required maxlength="32" placeholder="Oyuncu ismin"></label>`:''}<label class="field-label">${register?'E-posta':'Kullanıcı adı veya e-posta'}<input name="${register?'email':'login'}" ${register?'type="email"':''} required autocomplete="${register?'email':'username'}"></label><label class="field-label">Şifre<input type="password" name="password" autocomplete="${register?'new-password':'current-password'}" required minlength="${register?10:1}" placeholder="${register?'En az 10 karakter':'Şifren'}"></label><button class="btn" type="submit">${register?'Ücretsiz üye ol':'Giriş yap'} →</button></form>
 <div class="switcher"><button class="btn secondary" data-act="authLogin">Giriş Yap</button><button class="btn secondary" data-act="authRegister">Üye Ol</button></div><div class="help">Bu üyelik, yeni Arena Club scriptine aittir. Eski WordPress hesabı henüz otomatik aktarılmıyor.</div>`);
}
function gameCards(){return Object.entries(state.games).map(([g,c])=>{
 const rooms=state.rooms.filter(r=>r.game===g),n=rooms.length;
 return `<article class="panel game-card"><div class="game-top"><div class="kicker">ARENA CLUB OYUNLARI</div><span class="tag muted-tag">${n} SALON</span></div><div class="game-mark">${icons[g]||'♟'}</div><h3>${esc(c.label)}</h3><p>${n?`${n} salon ve ${rooms.reduce((sum,r)=>sum+r.tableCount,0)} masa alanı hazır.`:'Henüz salon açılmadı. Yönetici bu oyun için yeni salon açabilir.'}</p><button class="btn secondary" data-act="viewGameRooms" data-game="${esc(g)}">${n?'Salonları göster':'Salonları görüntüle'} →</button></article>`;}).join('');}
function upcomingTournaments(){const list=state.tournaments.filter(t=>t.status==='open').sort((a,b)=>a.startAt-b.startAt).slice(0,4);
 return `<div class="heading-row"><div><div class="kicker">YAKLAŞAN ETKİNLİKLER</div><h2>Turnuvalar</h2></div><button class="btn secondary" data-go="tournaments">Tüm turnuvalar →</button></div><div class="room-grid">${list.map(t=>`<article class="panel room-entry"><div class="room-icon">${icons[t.game]||'🏆'}</div><h3>${esc(t.name)}</h3><p>${esc(h(t.game))} · ${new Date(t.startAt).toLocaleString('tr-TR')}</p><div class="room-meta"><span>${t.participants}/${t.maxPlayers} kayıt</span><span>${t.startAt>Date.now()?'Yakında başlıyor':'Kayıt açık'}</span></div><button class="btn secondary" data-go="tournaments">Detaylar →</button></article>`).join('')||'<div class="empty">Henüz açık turnuva bulunmuyor.</div>'}</div>`;}
function homePage(){const online=state.rooms.reduce((n,r)=>n+r.online,0);return `<section class="hero"><div><div class="kicker">✦ TÜRKİYE'NİN YENİ SOSYAL OYUN DÜNYASI</div><h1>Oyuna gel.<br><span style="color:var(--gold)">Salonda kal.</span></h1><p>Önce oyununu seç. Yalnızca o oyuna ait salonlara gir, arkadaşlarınla masaya otur ve sohbet et.</p><div class="hero-action"><button class="btn" data-go="rooms">Oyunları keşfet ↗</button>${state.me?'<button class="btn secondary" data-go="profile">Profilimi düzenle</button>':'<button class="btn secondary" data-act="authRegister">Ücretsiz üye ol</button>'}</div></div><div class="hero-graphic"><div class="hero-card"></div><div class="hero-orb">🎲</div></div></section>
  <div class="stats"><div class="panel stat"><b>${state.rooms.length}</b><span>Oyun salonu</span></div><div class="panel stat"><b>${state.rooms.reduce((n,r)=>n+r.tableCount,0)}</b><span>Hazır masa alanı</span></div><div class="panel stat"><b>${online}</b><span>Salondaki oyuncu</span></div><div class="panel stat"><b>VIP</b><span>Özel salon & topluluk</span></div></div>
  <div class="heading-row"><div><div class="kicker">OYUNUNU SEÇ</div><h2>Oyun kategorileri</h2><p class="subtle">Her oyun yalnızca kendisine ait salonları gösterir.</p></div><button class="btn secondary" data-go="rooms">Tüm oyunlar →</button></div><div class="cards">${gameCards()}</div>
  ${upcomingTournaments()}
  <div class="heading-row"><div><div class="kicker">HAFTALIK SIRALAMA</div><h2>Haftanın oyuncuları</h2></div><button class="btn secondary" data-go="tournaments">Turnuvalar →</button></div><div class="panel profile-content">${state.leaders.slice(0,8).map((u,i)=>`<div class="admin-item"><span class="pill">${i+1}</span>${avatar(u)}<div><b>${userName(u)}</b><small>${u.weeklyPoints} haftalık puan · ${u.wins} galibiyet</small></div></div>`).join('')||'<div class="help">Liderlik verisi henüz yok.</div>'}</div>`;}
function roomsPage(){if(!state.roomGame)return `<div class="heading-row"><div><div class="kicker">OYUN KATEGORİLERİ</div><h2>Hangi oyunu oynamak istersin?</h2><p>Önce oyunu seç; yalnızca ona ait salonlar gösterilecek.</p></div></div><div class="cards">${gameCards()}</div>`;
 const filtered=state.rooms.filter(r=>r.game===state.roomGame);return `<div class="heading-row"><div><div class="kicker">${esc(h(state.roomGame).toUpperCase())} / SALONLAR</div><h2>${esc(h(state.roomGame))} salonları</h2><p>Bu ekranda yalnızca ${esc(h(state.roomGame))} salonları bulunur.</p></div><button class="btn secondary" data-act="gameDirectory">← Diğer oyunlar</button></div><div class="room-grid">${filtered.map(r=>`<article class="panel room-entry"><div class="room-icon">${icons[r.game]||'♟'}</div><h3>${esc(r.name)}</h3><p>${esc(h(r.game))} · ${r.ownerId?'Özel yönetilen salon':'Arena Club salonu'}</p><div class="room-meta"><span>▦ ${r.tableCount} masa</span><span>◉ ${r.online} oyuncu</span></div><button class="btn" data-act="enterRoom" data-id="${r.id}">Salona gir →</button></article>`).join('')||'<div class="empty">Bu oyun için henüz salon oluşturulmamış. Yönetici yeni salon ekleyebilir.</div>'}</div>`;}
function tournamentsPage(){return `<div class="heading-row"><div><div class="kicker">ARENA CLUB ETKİNLİKLERİ</div><h2>Turnuvalar</h2><p>Katılım ve sonuç onayı sistemi. Oyun motorları bağlanana kadar otomatik maç doğrulaması yoktur.</p></div></div><div class="room-grid">${state.tournaments.map(t=>`<article class="panel room-entry"><div class="room-icon">${icons[t.game]||'🏆'}</div><h3>${esc(t.name)}</h3><p>${esc(h(t.game))} · ${new Date(t.startAt).toLocaleString('tr-TR')}</p><div class="room-meta"><span>${t.participants}/${t.maxPlayers} katılımcı</span><span>${t.status==='finished'?'Tamamlandı':t.startAt>Date.now()?'Yakında başlıyor':'Kayıt açık'}</span></div>${t.status==='finished'?`<div class="alert">Kazanan: ${esc(t.winnerName||'')}</div>`:t.joined.includes(state.me?.id)?'<span class="pill">Turnuvaya kayıtlısın</span>':`<button class="btn" data-act="joinTournament" data-id="${t.id}">Turnuvaya katıl →</button>`}${t.rewardTier&&t.rewardTier!=='none'?`<p class="help" style="margin-top:10px">Ödül: ${esc(t.rewardTier.toUpperCase())} üyelik (yönetici doğrulamasıyla)</p>`:''}</article>`).join('')||'<div class="empty">Henüz turnuva düzenlenmedi.</div>'}</div>`;}
function listTables(){return (state.tables||[]).map(t=>`<button type="button" class="table-tile${t.players?' occupied':''}" data-act="chooseTable" data-no="${t.no}"><span class="table-no">MASA ${String(t.no).padStart(2,'0')}</span><span class="table-glyph">${icons[t.game]||'♟'}</span><strong>${t.ownerId?'Masaya katıl':'Masa kur'}</strong><small>${t.players}/${t.max} oyuncu ${t.locked?'· İzleyici kapalı':''}</small></button>`).join('');}
function announcements(){return (state.announcements||[]).slice(-12).reverse().map(a=>`<div class="announcement"><small>${new Date(a.time).toLocaleString('tr-TR')} • ${esc(a.name)}</small>${esc(a.message)}</div>`).join('')||'<div class="empty">Henüz duyuru yok.</div>';}
function vipMessages(){return (state.vipChat||[]).slice(-35).map(m=>`<div class="line"><b>${userName(m.user)}:</b> ${esc(m.message)}</div>`).join('')||'<div class="help">İlk mesajı sen gönder.</div>';}
function players(){return (state.users||[]).map(u=>`<button class="user-chip" data-act="player" data-id="${u.id}">${avatar(u)}<span class="nick">${userName(u)}<small style="display:block">${esc(u.tier.toUpperCase())}</small></span><span title="Oyuncu bilgileri">↗</span></button>`).join('')||'<div class="empty">Salonda başka kimse yok.</div>';}
function roomPage(){const r=state.room;if(!r)return roomsPage();return `<div class="heading-row"><div><div class="kicker">SALON / ${esc(h(r.game).toUpperCase())}</div><h2 class="room-title">${esc(r.name)}<small>Bir masaya tıkla, bu oyun için masa kurallarını belirle. Sohbet ve oyuncular hep yanında.</small></h2></div><div class="hero-action">${r.ownerId===state.me?.id&&r.rentalUntil>Date.now()?'<button class="btn secondary" data-act="rentalSettings">Salonumu yönet</button>':''}<button class="btn secondary" data-go="rooms">← Salonlardan çık</button></div></div>
 <div class="room-layout"><section class="panel"><div class="table-toolbar"><div><div class="kicker">CANLI MASALAR</div><h2>${r.tableCount} masa</h2></div><span class="tag">${r.online} kişi salonda</span></div><div class="table-grid" id="tableGrid">${listTables()}</div></section>
 <aside class="room-aside"><section class="panel"><div class="box-title">📢 Duyurular <small>Admin & Moderatör</small></div><div class="announcement-list" id="announceLines">${announcements()}</div></section>
 <section class="panel"><div class="box-title">👥 Salondaki oyuncular <small>${state.users.length} kişi</small></div><div class="member-list" id="memberLines">${players()}</div></section>
 <section class="panel"><div class="box-title">✦ VIP / ELITE Salon Sohbeti <small>Özel</small></div>${isPremium()?`<div class="vip-log" id="vipLines">${vipMessages()}</div><form id="vipChatForm" class="chat-compose"><input maxlength="240" name="message" placeholder="VIP mesajı yaz..." required><button class="btn small" type="submit">Gönder</button></form>`:'<div class="empty">Bu sohbet yalnız VIP ve ELITE üyelerine açıktır. Duyurular tüm oyuncular tarafından görülebilir.</div>'}</section></aside></div>`;}
function profilePage(){if(!state.me)return `<div class="panel" style="padding:30px"><h2>Oyuncu profilin</h2><p class="subtle">Profilini görüntülemek için giriş yap.</p><button data-act="auth" class="btn">Giriş yap</button></div>`;
 const u=state.me,photos=u.photos||[],photoLimit=['vip','elite'].includes(u.tier)&&(!u.tierExpires||u.tierExpires>Date.now())?4:1;
 return `<div class="heading-row"><div><div class="kicker">ARENA CLUB HESAP</div><h2>Oyuncu panelim</h2><p>İsim ve fotoğraf değişiklikleri yönetici onayından sonra yayınlanır.</p></div><button class="btn secondary" data-act="logout">Çıkış yap</button></div>
 <div class="profile-grid"><section class="panel profile-card">${avatar(u,true)}<h3>${userName(u)}</h3>${tagTier(u)}<p>@${esc(u.username)}</p><div class="info-list"><div><b>${u.points}</b> toplam puan</div><div><b>${u.wins}</b> galibiyet</div><div><b>${u.weeklyPoints}</b> haftalık puan</div><div>Üyelik bitişi: <b>${fdate(u.tierExpires)}</b></div></div><div class="gallery" style="margin-top:20px">${photos.map(p=>`<img src="${apiRoot}/media/${p.id}" alt="Profil fotoğrafı">`).join('')}</div><small>${photos.length}/${photoLimit} fotoğraf kullanıldı</small></section>
 <div class="stack"><section class="panel profile-content"><h3>Profil bilgilerini düzenle</h3><form id="profileForm" class="form-stack"><div class="form-grid"><label class="field-label">Görünen isim<input name="name" maxlength="32" required value="${esc(u.name)}"></label><label class="field-label">E-posta<input name="email" type="email" required value="${esc(u.email)}"></label></div><label class="field-label">Hakkımda<textarea name="bio" maxlength="300">${esc(u.bio)}</textarea></label><label class="field-label">Özel isim rengi<select name="style" ${isPremium()?'':'disabled'}>${[['gold','Altın'],['violet','Mor'],['blue','Mavi'],['rose','Pembe'],['green','Yeşil']].map(([v,l])=>`<option value="${v}"${selected(v,u.style)}>${l}</option>`).join('')}</select></label><small>Renkli ve kalın isim VIP/ELITE üyelere özeldir.</small><button class="btn" type="submit">Yönetici onayına gönder →</button></form></section>
 <section class="panel profile-content"><h3>Fotoğraf yükle</h3><p class="subtle">Normal üyede tek avatar, VIP/ELITE'de avatar dahil dört fotoğraf. PNG, JPG, WebP; en fazla 1 MB (otomatik küçültülür). Fotoğraflar onaylanmadan gösterilmez.</p><form id="photoForm" class="form-stack"><label class="field-label">Fotoğraf seç<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required></label><label class="field-label">Var olan resmi değiştir (isteğe bağlı)<select name="replaceId"><option value="">Yeni fotoğraf olarak ekle</option>${photos.map((p,i)=>`<option value="${p.id}">${i+1}. fotoğrafı değiştir</option>`).join('')}</select></label><label class="check-line"><input type="checkbox" name="avatar" checked> Avatarım olarak kullan</label><button class="btn secondary" type="submit">Fotoğrafı onaya gönder</button></form></section>
 <section class="panel profile-content"><h3>Özel mesaj gizliliği</h3><p class="subtle">Kapattığında diğer üyeler sana özel mesaj gönderemez. Eşli Okey'de bile kişisel gizlilik tercihin korunur.</p><form id="privacyForm" class="form-stack"><label class="check-line"><input type="checkbox" name="privateMessages" ${u.privateMessages?'checked':''}> Özel mesajları kabul ediyorum</label><button class="btn secondary" type="submit">Gizlilik ayarını kaydet</button></form></section>
 <section class="panel profile-content"><h3>Şifre değiştir</h3><form id="passwordForm" class="form-stack"><label class="field-label">Mevcut şifre<input type="password" name="old" required></label><label class="field-label">Yeni şifre (en az 10 karakter)<input type="password" name="password" minlength="10" required></label><button class="btn secondary" type="submit">Şifremi değiştir</button></form></section>
 <section class="panel profile-content"><h3>Son Kızma Birader maçlarım</h3><div id="recentMatches" class="help">Yükleniyor...</div></section><section class="panel profile-content"><h3>Onay taleplerim</h3><div id="myApprovals" class="help">Yükleniyor...</div></section></div></div>`;}
// Ludo board is a presentation of authoritative state from /api/club, not a local game engine.
// The classic game engine keeps the authoritative 52-square circuit. This display
// projects those same indices onto a 14x14 perimeter inspired by a physical board.
const ludoColors=['red','blue','yellow','green'];
const ludoStarts=[0,13,26,39],ludoSafe=[0,8,13,21,26,34,39,47];
const ludoTrack=[
 ...Array.from({length:14},(_,x)=>[x,0]),
 ...Array.from({length:13},(_,y)=>[13,y+1]),
 ...Array.from({length:13},(_,x)=>[12-x,13]),
 ...Array.from({length:12},(_,y)=>[0,12-y])
];
const ludoHome=[
 [[1,1],[2,2],[3,3],[4,4],[5,5]],
 [[12,1],[11,2],[10,3],[9,4],[8,5]],
 [[12,12],[11,11],[10,10],[9,9],[8,8]],
 [[1,12],[2,11],[3,10],[4,9],[5,8]]
];
const ludoBase=[
 [[3,1],[4,1],[3,2],[4,2]],
 [[9,1],[10,1],[9,2],[10,2]],
 [[9,11],[10,11],[9,12],[10,12]],
 [[3,11],[4,11],[3,12],[4,12]]
];
function ludoPos(color,steps,index=0){
 if(steps<0)return ludoBase[color][index];
 if(steps<=50)return ludoTrack[(ludoStarts[color]+steps)%52];
 if(steps<56)return ludoHome[color][steps-51];
 return [[6,6],[7,6],[7,7],[6,7]][color];
}
function ludoDice(value,rolling=false){
 const face=Number(value)>=1&&Number(value)<=6?Number(value):1;
 // Pip arrangements: rows and columns 1..3.
 const pips={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
 return `<div class="ludo-die-scene" aria-label="Zar: ${value||'atılmadı'}"><div class="ludo-die-flat">${pips[face].map(dot=>`<i class="pip pip-${dot}"></i>`).join('')}</div><div class="ludo-die-cube face-${face}${rolling?' is-rolling':''}">${[1,2,3,4,5,6].map(n=>`<div class="ludo-die-face side-${n}">${pips[n].map(dot=>`<i class="pip pip-${dot}"></i>`).join('')}</div>`).join('')}</div></div>`;
}
function ludoBoard(g){
 const pawnMap=new Map(), legal=new Set(g.legalMoves||[]), targets=new Map();
 for(let seat=0;seat<g.players.length;seat++){
  const p=g.players[seat],color=p.color;
  p.pawns.forEach((steps,index)=>{
   const coords=ludoPos(color,steps,index),key=coords.join(':');
   if(!pawnMap.has(key))pawnMap.set(key,[]);
   const legalMove=g.mySeat===seat&&legal.has(index);
   pawnMap.get(key).push({seat,index,color,legal:legalMove,finished:steps===56});
   if(legalMove){
    const target=ludoPos(color,steps===-1?0:steps+g.dice,index),tk=target.join(':');
    if(!targets.has(tk))targets.set(tk,[]);
    targets.get(tk).push(index);
   }
  });
 }
 const trackCells=new Map(ludoTrack.map(([x,y],i)=>[`${x}:${y}`,i]));
 const homeCells=new Map(ludoHome.flatMap((line,color)=>line.map(([x,y])=>[`${x}:${y}`,color])));
 let html='';
 for(let y=0;y<14;y++)for(let x=0;x<14;x++){
  const key=`${x}:${y}`,track=trackCells.get(key),home=homeCells.get(key);
  let type='inner',star=false;
  if(x<=6&&y<=6)type='base-red';else if(x>=7&&y<=6)type='base-blue';else if(x>=7&&y>=7)type='base-yellow';else type='base-green';
  if(x>=6&&x<=7&&y>=6&&y<=7)type='finish';
  if(track!==undefined){type='track';star=ludoSafe.includes(track);if(ludoStarts.includes(track))type=`entry-${ludoColors[ludoStarts.indexOf(track)]}`;}
  if(home!==undefined)type=`home-${ludoColors[home]}`;
  const landing=targets.get(key)||[];
  const items=(pawnMap.get(key)||[]).map(p=>`<button type="button" class="ludo-piece ${ludoColors[p.color]}${p.legal?' can-move':''}${p.finished?' is-finished':''}" data-seat="${p.seat}" data-pawn="${p.index}" ${p.legal?`data-act="ludoPawn" title="${p.index+1}. piyonu seç veya hedefe sürükle" draggable="false"`:'disabled'} aria-label="${ludoColors[p.color]} ${p.index+1}. piyon${p.legal?', oynanabilir':''}"><span class="pawn-no">${p.index+1}</span></button>`).join('');
  html+=`<div class="ludo-cell ${type}${landing.length?' ludo-drop-zone':''}" data-x="${x}" data-y="${y}" ${landing.length?`data-drop-pawns="${landing.join(',')}"`:''} ${star?'title="Güvenli kare"':''}>${star?'<span class="ludo-star">★</span>':''}${items?`<div class="ludo-pieces">${items}</div>`:''}</div>`;
 }
 return `<div class="ludo-wood-frame"><div class="ludo-board" role="group" aria-label="Kızma Birader 52 karelik dış hat ve 4 renkli bitiş yolları">${html}<div class="ludo-center-brand" aria-hidden="true">ARENA<br>CLUB</div></div></div>`;
}
function renderLudo(t){
 const lg=t.ludo,g=lg?.state;
 if(!g){const seated=t.members.filter(m=>m.as==='player'),ready=seated.filter(m=>m.connected);return `<div class="ludo-intro"><div class="ludo-dice-icon">🎲</div><h3>Şampiyonluk masası hazır</h3><p>Bu masada ${t.maxPlayers} oyuncu bulunmalı. Masa sahibi oyunu başlattığında zar ve hamleleri sunucu yönetecek.</p><p class="help">Masada ${seated.length}/${t.maxPlayers} oyuncu · Bağlantısı doğrulanan: ${ready.length}/${t.maxPlayers}${ready.length<seated.length?' · Bekleyen oyuncu sekmesini açık tutmalı.':''}</p>${t.ownerId===state.me?.id||state.me?.role==='admin'?`<button class="btn" data-act="ludoStart" ${ready.length===t.maxPlayers?'':'disabled'}>${seated.length}/${t.maxPlayers} oyuncu · Maçı başlat</button>`:'<span class="pill">Masa sahibinin başlatması bekleniyor</span>'}<div class="alert">Puanlar: ${t.maxPlayers===4?'Kazanan +6 · diğer üç oyuncu −2':'Kazanan +6 · kaybeden −6'}. Süre ve kurallar masaya özeldir.</div></div>`;}
 const active=g.players[g.turn],me=g.mySeat>=0?g.players[g.mySeat]:null,canRoll=!g.finished&&g.mySeat===g.turn&&g.phase==='roll'&&!me?.bot,canMove=!g.finished&&g.mySeat===g.turn&&g.phase==='move'&&!me?.bot;
 const results=lg.result;
 const score=results?`<section class="ludo-result"><h3>🏆 ${esc(g.players[g.winner]?.name||'Oyuncu')} kazandı!</h3>${results.points.map(p=>`<div><span>${esc(p.name)}</span><strong class="${p.delta>=0?'gain':'loss'}">${p.delta>=0?'+':''}${p.delta} puan</strong></div>`).join('')}<small>Sonuç sunucu tarafından işlendi. Aynı maça ikinci kez puan verilmez.</small></section>`:'';
 return `<div class="ludo-wrap"><div class="ludo-board-side">${ludoBoard(g)}<div class="ludo-help">★ Güvenli alan · 6 ile başlangıç · 4 piyonu eve götür · Piyonu tıkla veya hedefe sürükle</div></div><div class="ludo-control"><div class="ludo-status"><div class="kicker">CANLI MAÇ · ${esc(lg.matchId.slice(0,8))}</div><h3>${g.finished?'Maç tamamlandı':`Sıra: ${esc(active?.name||'')}`}</h3></div><div class="ludo-player-list">${g.players.map((p,i)=>`<div class="ludo-player ${i===g.turn&&!g.finished?'active':''}"><span class="ludo-dot ${ludoColors[p.color]}"></span><div><b>${esc(p.name)}</b><small>${p.bot?'🤖 Bot oynuyor':i===g.mySeat?'Senin koltuğun':'Oyuncu'} · ${p.pawns.filter(n=>n===56).length}/4 biten</small></div></div>`).join('')}</div><div class="ludo-dice"><span>ZAR</span>${ludoDice(g.lastRoll?.value)}<small>${g.phase==='move'?'Piyonunu seç':g.phase==='roll'?'Sıra zar atışında':'Maç bitti'}</small></div>${!g.finished?`<div class="ludo-clock">Kalan süre: <strong class="ludo-time" data-deadline="${g.deadline||0}">${Math.max(0,Math.ceil(((g.deadline||0)-Date.now())/1000))} sn</strong></div>`:''}${canRoll?'<button class="btn ludo-action" data-act="ludoRoll">🎲 Zarı at</button>':''}${canMove?`<p class="ludo-prompt">${g.legalMoves.length} geçerli piyon var. Seçip dokunabilir veya hedefe sürükleyebilirsin.</p>`:''}${me?.bot&&!g.finished?'<button class="btn secondary ludo-action" data-act="ludoTakeover">Botun yerine geç</button>':''}${g.mySeat===-1&&!g.finished?'<p class="help">İzleyicisin, masayı ve sohbeti takip edebilirsin.</p>':''}${score}${g.finished&&(t.ownerId===state.me?.id||state.me?.role==='admin')?'<button class="btn ludo-action" data-act="ludoStart">Yeni maç başlat</button>':''}<p class="ludo-notice">${esc(g.notice||'')}</p><details class="ludo-events"><summary>Hamle geçmişi</summary><div class="ludo-eventlog">${(g.events||[]).slice(-8).reverse().map(x=>`<p>${esc(x)}</p>`).join('')}</div></details></div></div>`;
}
function fullTable(t){const players=t.members.filter(m=>m.as==='player'),spectators=t.members.filter(m=>m.as==='spectator');
 const title=`<div class="modal-title"><div><div class="kicker">${esc(h(t.game).toUpperCase())} / MASA ${t.no}</div><h2>Masa ${String(t.no).padStart(2,'0')}</h2><div class="help">Masa sahibi: ${userName(state.users.find(u=>u.id===t.ownerId)||t.members.find(m=>m.user.id===t.ownerId)?.user)} · <span id="tableConnectivity">${players.length}/${t.maxPlayers} oyuncu · ${players.filter(m=>m.connected).length} bağlantı doğrulandı</span></div></div>${closeButton}</div>`;
 const chat=`<div class="table-bottom-chat"><div class="chat-caption">${t.game==='101'?'<button type="button" class="ok101-chat-button" data-act="ok101ChatToggle" aria-expanded="false">💬 Masa sohbeti <span class="ok101-chat-chevron">▴</span></button>':'<span>💬 Masa sohbeti</span>'}<small>Geçmişi kaydır</small></div><div class="two-line-log" id="tableChatLines">${tableMessages(t)}</div><form id="tableChatForm" class="inline-compose"><input name="message" maxlength="240" placeholder="Masadakilere mesaj yaz..." required><button class="btn small">Gönder</button></form></div>`;
 if(t.game==='101')return `${title}<div class="table-stage table-stage-101"><div class="stage okey101-stage" id="okey101Area">${render101(t)}</div></div>${chat}`;
 return `${title}
 <div class="table-stage">${t.game==='ludo'?`<div class="stage ludo-stage" id="ludoArea">${renderLudo(t)}</div>`:`<div class="stage"><span class="stage-symbol">${icons[t.game]||'🎲'}</span><h3>Oyun masası hazırlanıyor</h3><p>Bu bölüm şimdilik salon ve masa altyapısıdır. Oyun motorları bağlandığında burada gerçek, geniş oyun tahtası açılacak.</p><div class="seat-row" id="seatRow">${playerSeats(t)}</div><span class="pill">${t.rounds?`${t.rounds} el`:`${t.points} başlangıç puanı`} · ${t.turnSeconds} sn</span></div>`}
 <aside class="stage-aside"><h3>Masa ayarları</h3><div class="info-list"><div>Oyun: <b>${esc(h(t.game))}</b></div><div>İzleyici: <b>${t.spectators?'Açık':'Kapalı'}</b></div><div>Özel mesaj: <b>${t.privateChat?'Açık':'Kapalı'}</b></div><div>Oyuncu: <b>${players.length}/${t.maxPlayers}</b></div><div>İzleyici: <b>${spectators.length}</b></div></div><div class="member-list" style="margin-top:10px;padding:0">${spectators.map(m=>`<button class="user-chip" type="button" data-act="player" data-id="${m.user.id}">${avatar(m.user)}${userName(m.user)}</button>`).join('')}</div><div class="form-stack" style="margin-top:16px">${state.me&&(state.me.id===t.ownerId||state.me.role==='admin')?'<button data-act="tableSettings" class="btn secondary small">Masa kurallarını düzenle</button>':''}<button data-act="leaveTable" class="btn danger small">Masadan ayrıl</button></div><p class="help" style="margin-top:14px">Masa sohbetini hemen aşağıdan kullanabilirsin. İzleyiciler de masa sahibinin izniyle yazabilir.</p></aside></div>${chat}`;}
// Browser-only motion. The API still validates the dice and every pawn move.
let ludoFrame=null,ludoMoveBusy=false,ludoDrag=null,suppressPawnClickUntil=0,ludoRollingUntil=0,ludoRollTimer=null;
const ludoSnapshot=t=>t?.ludo?.state?{
 id:t.ludo.matchId,
 pawns:t.ludo.state.players.map(p=>[...p.pawns]),
 colors:t.ludo.state.players.map(p=>p.color)
}:null;
function ludoRenderKey(t){
 const g=t?.ludo?.state;
 if(!g)return `waiting:${(t.members||[]).map(m=>[m.user?.id,m.connected,m.as].join(':')).join('|')}:${t.maxPlayers}`;
 return `${t.ludo.matchId}|${g.revision}|${g.turn}|${g.phase}|${g.dice}|${g.lastRoll?.value}|${g.finished}|${g.players.map(p=>p.pawns.join(',')+p.bot).join('|')}|${Boolean(t.ludo.result)}`;
}
function ludoAnimateMoves(before,after,root){
 if(!before||!after||before.id!==after.id||!root||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const board=root.querySelector('.ludo-board');if(!board)return;
 const stepSize=board.getBoundingClientRect().width/14;
 for(let seat=0;seat<after.pawns.length;seat++)for(let index=0;index<4;index++){
  const from=before.pawns[seat]?.[index],to=after.pawns[seat]?.[index];
  if(!Number.isInteger(from)||!Number.isInteger(to)||to<=from||to-from>6)continue;
  const node=root.querySelector(`.ludo-piece[data-seat="${seat}"][data-pawn="${index}"]`);
  if(!node?.animate)continue;
  const color=after.colors[seat],end=ludoPos(color,to,index),coords=[];
  if(from===-1)coords.push(ludoPos(color,-1,index));
  for(let step=Math.max(0,from);step<=to;step++)coords.push(ludoPos(color,step,index));
  if(coords.length<2)continue;
  node.animate(coords.map(([x,y],j)=>({offset:j/(coords.length-1),transform:`translate(${(x-end[0])*stepSize}px,${(y-end[1])*stepSize}px) scale(${j===coords.length-1?1:1.09})`})),{duration:Math.min(1350,Math.max(330,(coords.length-1)*145)),easing:'ease-in-out'});
 }
}
function ludoStartDiceAnimation(){
 ludoRollingUntil=Date.now()+800;
 const node=document.querySelector('#ludoArea .ludo-die-cube');if(node)node.classList.add('is-rolling');
 const button=document.querySelector('#ludoArea [data-act="ludoRoll"]');if(button)button.disabled=true;
}
async function ludoSendPawn(index){
 if(ludoMoveBusy||!Number.isInteger(index)||!state.table)return;
 ludoMoveBusy=true;
 try{const t=state.table;const r=await api('/table/ludo/move','POST',{roomId:t.roomId,no:t.no,pawn:index});
  if(state.table?.roomId===t.roomId&&state.table?.no===t.no)updateTable(r.table);
 }catch(e){notice(e.message,true);}finally{ludoMoveBusy=false;}
}
function ludoClearDrag(){
 if(ludoDrag?.ghost)ludoDrag.ghost.remove();
 document.documentElement.classList.remove('ludo-dragging');ludoDrag=null;
}
document.addEventListener('pointerdown',e=>{
 const piece=e.target.closest?.('#ludoArea .ludo-piece.can-move');
 if(!piece||e.button!==0||ludoMoveBusy)return;
 ludoDrag={pointer:e.pointerId,x:e.clientX,y:e.clientY,pawn:Number(piece.dataset.pawn),color:ludoColors.find(color=>piece.classList.contains(color)),moving:false,ghost:null};
});
document.addEventListener('pointermove',e=>{
 if(!ludoDrag||ludoDrag.pointer!==e.pointerId)return;
 const drag=ludoDrag;
 if(!drag.moving&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>9){
  drag.moving=true;document.documentElement.classList.add('ludo-dragging');
  const ghost=document.createElement('div');ghost.className='ludo-drag-ghost';ghost.textContent=String(drag.pawn+1);
  ghost.style.setProperty('--ghost-color',({red:'#e95e69',blue:'#56a8ee',yellow:'#efcc58',green:'#50c6a0'})[drag.color]||'#ead08c');
  document.body.append(ghost);drag.ghost=ghost;
 }
 if(drag.moving){drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';e.preventDefault();}
},{passive:false});
document.addEventListener('pointerup',e=>{
 if(!ludoDrag||ludoDrag.pointer!==e.pointerId)return;
 const drag=ludoDrag;
 if(drag.moving){
  suppressPawnClickUntil=Date.now()+250;
  const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('#ludoArea .ludo-cell');
  const valid=cell?.dataset.dropPawns?.split(',').includes(String(drag.pawn));
  if(valid)void ludoSendPawn(drag.pawn);
  else notice('Piyonu parlayan hedef karesine bırak. İstersen doğrudan piyona da tıklayabilirsin.');
 }
 ludoClearDrag();
});
document.addEventListener('pointercancel',ludoClearDrag);


function playerSeats(t){return t.members.filter(m=>m.as==='player').map(m=>`<button type="button" class="seat" data-act="player" data-id="${m.user.id}">${avatar(m.user)} ${userName(m.user)} ✉</button>`).join('')||'<div class="seat">Oyuncular bekleniyor...</div>';}
function tableMessages(t){return t.chat.map(m=>`<p><b>${userName(m.user)}:</b> ${esc(m.message)}</p>`).join('')||'<p class="subtle">Henüz mesaj yok.</p>';}
function updateTable(t){if(state.table?.roomId===t.roomId&&state.table?.no===t.no&&t.game==='101'&&t.okey101&&state.table.okey101?.id===t.okey101.id&&t.okey101.revision<state.table.okey101.revision)return;state.table=t;const root=$('#overlayRoot');if(!root.querySelector('.table-bottom-chat'))return;const connectivity=$('#tableConnectivity');if(connectivity){const players=t.members.filter(m=>m.as==='player');connectivity.textContent=`${players.length}/${t.maxPlayers} oyuncu · ${players.filter(m=>m.connected).length} bağlantı doğrulandı`;}const area=$('#tableChatLines');if(area){const nearBottom=area.scrollHeight-area.scrollTop-area.clientHeight<28;area.innerHTML=tableMessages(t);if(nearBottom)area.scrollTop=area.scrollHeight;}
 const seats=$('#seatRow');if(seats)seats.innerHTML=playerSeats(t);
 const okey=$('#okey101Area');if(okey){const k=okey101Key(t);if(okey.dataset.key!==k){okey.innerHTML=render101(t);okey.dataset.key=k;}}
 const ludo=$('#ludoArea');
 if(ludo){const key=ludoRenderKey(t);
  if(!ludoFrame||ludoFrame.key!==key){
   if(Date.now()<ludoRollingUntil){
    if(!ludoRollTimer)ludoRollTimer=setTimeout(()=>{ludoRollTimer=null;if(state.table&&document.querySelector('#ludoArea'))updateTable(state.table);},Math.max(40,ludoRollingUntil-Date.now()+10));
   }else{const before=ludoFrame?.snapshot;ludo.innerHTML=renderLudo(t);ludoAnimateMoves(before,ludoSnapshot(t),ludo);ludoFrame={key,snapshot:ludoSnapshot(t)};}
  }
 }
}
function tableModal(t){state.returnTable=null;state.table=t;okey101ResetIfNew(t); ludoFrame=t.game==='ludo'?{key:ludoRenderKey(t),snapshot:ludoSnapshot(t)}:null;overlay(fullTable(t),true);if(t.game==='ludo')$('#overlayRoot .modal')?.classList.add('ludo-table-modal');if(t.game==='101')$('#overlayRoot .modal')?.classList.add('ok101-table-modal');const el=$('#tableChatLines');if(el)el.scrollTop=el.scrollHeight;const area=$('#okey101Area');if(area)area.dataset.key=okey101Key(t);}
function tablePick(no){if(!requireAuth())return;const table=state.tables.find(t=>t.no===no);if(!table?.ownerId){tableConfigModal(no);return;}
 overlay(`<div class="modal-title"><div><div class="kicker">SALON MASASI</div><h2>Masa ${no} — ${esc(h(table.game))}</h2></div>${closeButton}</div><p class="subtle">Masa ${table.players}/${table.max} oyuncu. İster oyuncu olarak katıl, ister izleyici olarak sohbeti takip et.</p><div class="form-stack"><button data-act="joinSeat" data-no="${no}" class="btn" ${table.players>=table.max&&!table.playing?'disabled':''}>Oyuncu olarak masaya otur</button><button data-act="joinSpectator" data-no="${no}" class="btn secondary" ${table.locked?'disabled':''}>İzleyici olarak katıl</button></div>`);
}
function gameSettings(game,chosen){const def=state.games[game]||state.games.ludo;const arr=def.mode==='rounds'?def.rounds:def.points;const key=def.mode==='rounds'?'rounds':'points';return `<label class="field-label">${key==='rounds'?'Kaç el oynanacak?':'Başlangıç oyun puanı'}<select name="${key}">${arr.map(v=>`<option value="${v}" ${Number(chosen?.[key])===v?'selected':''}>${v} ${key==='rounds'?'el':'puan'}</option>`).join('')}</select></label><label class="field-label">Oyuncu sayısı<select name="maxPlayers">${def.max.map(v=>`<option value="${v}" ${Number(chosen?.maxPlayers)===v?'selected':''}>${v} oyuncu</option>`).join('')}</select></label>${def.penalties?'<div class="alert">Okey puanları: Gösterge -1 · Normal bitiş -2 · Çift/Okey -4 · Çift Okey -8. Oyun motoruna daha sonra uygulanacak.</div>':''}`;}
function tableConfigModal(no,t=null){const game=t?.game||state.room?.game||'ludo';const opts=`<option value="${esc(game)}" selected>${esc(h(game))}</option>`;
 overlay(`<div class="modal-title"><div><div class="kicker">MASA ${no} / KURAL AYARLARI</div><h2>${t?'Masa kurallarını düzenle':'Masayı kur'}</h2></div>${closeButton}</div><form id="tableSetupForm" class="form-stack"><input name="no" type="hidden" value="${no}"><label class="field-label">Oyun türü (salona bağlı)<select name="game" id="tableGameSelect" disabled>${opts}</select></label><div id="gameDynamicSettings" class="form-grid">${gameSettings(game,t)}</div><label class="field-label">Hamle süresi<select name="turnSeconds">${[15,20,30,45,60].map(n=>`<option value="${n}" ${n===(t?.turnSeconds||30)?'selected':''}>${n} saniye</option>`).join('')}</select></label><label class="check-line"><input name="spectators" type="checkbox" ${t?.spectators===false?'':'checked'}> İzleyiciler masaya gelebilir ve masa sohbetine katılabilir</label><label class="check-line"><input name="privateChat" type="checkbox" ${t?.privateChat===false?'':'checked'}> Masada oyuncular arası özel mesajlaşmaya izin ver</label><div class="alert">Eşli Okey'de eşlerin iletişimi masa genelinde özel mesaj kapalı olsa bile açık kalır. Kendi profilinde özel mesajı kapatan üyeye mesaj gönderilemez.</div><button class="btn" type="submit">${t?'Ayarları kaydet':'Masayı aç ve otur'} →</button></form>`);
}
function playerModal(id){state.returnTable=state.table;const u=state.users.find(p=>p.id===id)||state.admin?.users?.find(p=>p.id===id);if(!u)return;const sameTable=state.table?.members.some(m=>m.user.id===u.id),allowed=state.me?.privateMessages!==false&&u.privateMessages!==false;
 overlay(`<div class="modal-title"><div><div class="kicker">OYUNCU PROFİLİ</div><h2>${userName(u)}</h2></div>${closeButton}</div><div style="display:flex;align-items:center;gap:17px;margin-bottom:20px">${avatar(u,true)}<div>${tagTier(u)}<div class="help">${u.wins||0} galibiyet · ${u.points||0} puan</div></div></div><p class="subtle">${esc(u.bio||'Henüz profil açıklaması eklenmedi.')}</p><div class="form-stack">${state.me&&state.me.id!==u.id?`<button class="btn" data-act="startDm" data-id="${u.id}" ${!state.table?'disabled':''}>Özel mesaj gönder</button><button class="btn secondary" data-act="reportUser" data-id="${u.id}">Üyeyi şikâyet et</button>`:''}</div><p class="help">Özel mesajlaşma için aynı oyun masasında bulunmanız ve ilgili izinlerin açık olması gerekir.</p>`);
}
function dmPanel(){const u=state.users.find(x=>x.id===state.dmTo)||state.table?.members.find(m=>m.user.id===state.dmTo)?.user;if(!u)return'';const list=state.dm.filter(m=>m.from===u.id||m.to===u.id);return `<div class="dm-box" id="dmBox"><div class="dm-head"><b>✉ ${userName(u)}</b><button class="close" data-act="closeDm">×</button></div><div class="dm-lines" id="dmLines">${list.map(m=>`<p><b>${esc(m.from===state.me?.id?'Sen':m.fromName)}:</b> ${esc(m.message)}</p>`).join('')||'<p class="help">Henüz mesaj yok.</p>'}</div><form class="chat-compose" id="dmForm"><input name="message" placeholder="Özel mesaj..." maxlength="240" required><button class="btn small">Gönder</button></form></div>`;}
function reportModal(id){overlay(`<div class="modal-title"><div><div class="kicker">MODERASYON</div><h2>Şikâyet bildir</h2></div>${closeButton}</div><form id="reportForm" class="form-stack"><input type="hidden" name="against" value="${esc(id)}"><label class="field-label">Şikâyet türü<select name="type"><option value="player">Üye davranışı</option><option value="chat">Sohbet</option><option value="table">Masa</option></select></label><label class="field-label">Açıklama<textarea name="reason" required minlength="10" maxlength="500" placeholder="Ne oldu? Kısaca açıkla."></textarea></label><button class="btn" type="submit">Moderatörlere gönder</button></form>`);}
function adminPage(){if(!isStaff())return '<div class="empty">Yönetim yetkin yok.</div>';return `<div class="heading-row"><div><div class="kicker">ARENA CLUB / YÖNETİM</div><h2>Kontrol merkezi</h2><p>Salonlar, üyeler, profil onayları, şikâyetler ve duyurular.</p></div></div><div class="admin-tabs">${[['rooms','Salonlar'],['tournaments','Turnuvalar'],['users','Üyeler'],['approvals','Profil onayları'],['reports','Şikâyetler'],['announcements','Duyurular']].map(([k,n])=>`<button data-act="adminTab" data-id="${k}" class="${state.adminTab===k?'chosen':''}">${n}</button>`).join('')}</div><section class="panel admin-section" id="adminSection">${adminContent()}</section>`;}
function adminContent(){const a=state.admin;if(!a)return '<div class="empty">Yönetim bilgileri yükleniyor...</div>';
 switch(state.adminTab){
  case 'rooms':return `<h3>Salon yönetimi</h3><p class="help">Salon aç, masa kapasitesini değiştir, VIP/ELITE üyeye süreli kirala.</p>${state.me.role==='admin'?`<form id="adminRoomCreate" class="mini-form"><input name="name" placeholder="Yeni salon adı" required minlength="3" maxlength="48"><select name="game">${Object.entries(state.games).map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join('')}</select><input name="tableCount" type="number" min="1" max="200" value="40" required><button class="btn" type="submit">+ Salon aç</button></form>`:''}<div class="admin-list" style="margin-top:16px">${a.rooms.map(r=>`<div class="admin-item"><div><b>${esc(r.name)}</b><small>${esc(h(r.game))} · ${r.tableCount} masa · ${r.ownerId?'Kiralık':'Genel'} · ${r.ownerId?fdate(r.rentalUntil):''}</small></div><button class="btn secondary small" data-act="adminEditRoom" data-id="${r.id}">Düzenle</button></div>`).join('')}</div>`;
  case 'tournaments':return `<h3>Turnuva yönetimi</h3><p class="help">Kazanan ancak yönetici sonucu elle doğrulayınca işlenir. Otomatik maç doğrulaması henüz aktif değil.</p>${state.me.role==='admin'?`<form id="createTournamentForm" class="form-stack"><div class="form-grid"><label class="field-label">Turnuva adı<input name="name" maxlength="64" required></label><label class="field-label">Oyun<select name="game">${Object.entries(state.games).map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join('')}</select></label><label class="field-label">Başlama tarihi<input type="datetime-local" name="startAt" required></label><label class="field-label">Katılımcı sınırı<input type="number" min="2" max="256" value="32" name="maxPlayers" required></label><label class="field-label">Kazanan ödülü<select name="rewardTier"><option value="none">Ödül yok</option><option value="vip">VIP</option><option value="elite">ELITE</option></select></label><label class="field-label">Ödül süresi<select name="rewardDays"><option value="30">30 gün</option><option value="7">7 gün</option><option value="14">14 gün</option><option value="60">60 gün</option><option value="90">90 gün</option></select></label></div><button class="btn" type="submit">Turnuva oluştur</button></form>`:''}<div class="admin-list" style="margin-top:18px">${a.tournaments.map(t=>`<div class="admin-item"><div><b>${esc(t.name)}</b><small>${t.participants}/${t.maxPlayers} kişi · ${t.status} · ${esc(h(t.game))} · ${new Date(t.startAt).toLocaleString('tr-TR')}${t.winnerName?' · Kazanan: '+esc(t.winnerName):''}</small></div>${t.status==='open'&&state.me.role==='admin'?`<button class="btn secondary small" data-act="manageParticipants" data-id="${t.id}">Katılımcılar (${t.participants})</button><button class="btn secondary small" data-act="setWinner" data-id="${t.id}">Sonucu doğrula</button>`:''}</div>`).join('')}</div>`;
  case 'users':return `<h3>Üye yönetimi</h3><p class="help">Oyuncuyu yönetici/moderatör yapmak için Rol / Yetki ver; VIP/ELITE vermek için VIP / ELITE / Puan düğmesini kullan.</p><div class="admin-list">${a.users.map(u=>`<div class="admin-item"><div><b>${userName(u)}</b><small>${esc(u.email)} · ${esc(u.role)} · ${esc(u.tier)} ${u.bannedUntil>Date.now()?'· YASAKLI':''}</small></div>${state.me.role==='admin'?`<button class="btn secondary small" data-act="adminRoleUser" data-id="${u.id}">Rol / Yetki ver</button><button class="btn secondary small" data-act="adminEditUser" data-id="${u.id}">VIP / ELITE / Puan</button>`:''}${u.role!=='admin'&&(u.role!=='moderator'||state.me.role==='admin')?`<button class="btn danger small" data-act="adminBanUser" data-id="${u.id}">Yasaklama</button>`:''}</div>`).join('')}</div>`;
  case 'approvals':return `<h3>Profil ve fotoğraf onayları</h3><div class="admin-list">${a.approvals.length?a.approvals.map(x=>`<div class="admin-item"><div><b>${esc(x.username||'Üye')} · ${x.type==='photo'?'Fotoğraf':'Profil değişikliği'}</b><small>${new Date(x.created).toLocaleString('tr-TR')}</small>${x.type==='photo'?`<img src="${apiRoot}/media/${x.payload.photoId}" class="avatar large" alt="Fotoğraf onayı">`:`<small>Ad: ${esc(x.payload.name)} · E-posta: ${esc(x.payload.email)} · Renk: ${esc(x.payload.style)}</small>`}</div>${state.me.role==='admin'?`<button class="btn small" data-act="approval" data-id="${x.id}" data-decision="true">Onayla</button><button class="btn danger small" data-act="approval" data-id="${x.id}" data-decision="false">Reddet</button>`:'<span class="help">Yönetici onayı bekleniyor.</span>'}</div>`).join(''):'<div class="empty">Bekleyen talep yok.</div>'}</div>`;
  case 'reports':return `<h3>Şikâyetler</h3><div class="admin-list">${a.reports.length?a.reports.map(r=>`<div class="admin-item"><div><b>${esc(r.reporter||'Oyuncu')} → ${esc(r.againstName||'Masa')}</b><small>${esc(r.reason)}</small></div><button class="btn small" data-act="reviewReport" data-id="${r.id}" data-decision="resolved">Çözüldü</button><button class="btn secondary small" data-act="reviewReport" data-id="${r.id}" data-decision="rejected">Reddet</button></div>`).join(''):'<div class="empty">Açık şikâyet yok.</div>'}</div>`;
  case 'announcements':return `<h3>Salon duyurusu yayınla</h3><p class="help">Duyurular tüm üyeler tarafından görülebilir. VIP salon sohbeti ise herkese açık değildir.</p><form id="announceForm" class="form-stack"><label class="field-label">Duyuru metni<textarea name="message" maxlength="450" required placeholder="Örneğin: Cumartesi turnuvası saat 20:00..."></textarea></label><button class="btn" type="submit">Duyuruyu yayınla</button></form><div class="admin-list" style="margin-top:18px">${a.announcements.slice().reverse().map(m=>`<div class="announcement"><small>${esc(m.name)} · ${new Date(m.time).toLocaleString('tr-TR')}</small>${esc(m.message)}</div>`).join('')}</div>`;
 }
}
function adminRoomModal(id){const r=state.admin.rooms.find(x=>x.id===id);if(!r)return;const vip=state.admin.users.filter(x=>['vip','elite'].includes(x.tier));overlay(`<div class="modal-title"><div><div class="kicker">SALON YÖNETİMİ</div><h2>${esc(r.name)}</h2></div>${closeButton}</div><form id="editRoomForm" class="form-stack"><input name="id" type="hidden" value="${r.id}"><label class="field-label">Salon adı<input name="name" value="${esc(r.name)}" minlength="3" maxlength="48" required></label><label class="field-label">Masa sayısı<input name="tableCount" type="number" min="1" max="${state.me.role==='admin'?200:40}" value="${r.tableCount}" required></label>${state.me.role==='admin'?`<label class="field-label">Kiralayan VIP/ELITE üye<select name="ownerId"><option value="">Genel salon — kiralık değil</option>${vip.map(u=>`<option value="${u.id}" ${u.id===r.ownerId?'selected':''}>${esc(u.name)} · ${esc(u.tier)}</option>`).join('')}</select></label><label class="field-label">Kiralama bitiş tarihi<input name="rentalUntil" type="datetime-local" value="${r.rentalUntil?new Date(r.rentalUntil-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):''}"></label>`:''}<button class="btn" type="submit">Salonu güncelle</button></form>${state.me.role==='admin'?`<button class="btn danger small" style="margin-top:12px" data-act="deleteRoom" data-id="${r.id}">Salonu sil</button>`:''}`);}
function rentalSettingsModal(){const r=state.room;if(!r||r.ownerId!==state.me?.id)return;overlay(`<div class="modal-title"><div><div class="kicker">KİRALIK SALONUM</div><h2>${esc(r.name)}</h2></div>${closeButton}</div><p class="subtle">Kiralama bitişi: ${fdate(r.rentalUntil)}. En fazla 40 masa ayarlayabilirsin.</p><form id="rentalForm" class="form-stack"><input type="hidden" name="id" value="${r.id}"><label class="field-label">Salon adı<input name="name" value="${esc(r.name)}" minlength="3" maxlength="48" required></label><label class="field-label">Masa sayısı<input type="number" name="tableCount" min="1" max="40" value="${r.tableCount}" required></label><button class="btn" type="submit">Salonumu güncelle</button></form>`);}
function tournamentWinnerModal(id){const t=state.admin.tournaments.find(x=>x.id===id);if(!t)return;const attendees=state.admin.users.filter(u=>t.joined.includes(u.id));overlay(`<div class="modal-title"><div><div class="kicker">TURNAVA SONUCU</div><h2>${esc(t.name)}</h2></div>${closeButton}</div><p class="alert">Maç sonuçları oyun sunucusundan doğrulanmıyor. Aşağıdaki seçimi sadece sonucu bizzat kontrol ettiysen yap.</p><form id="winnerForm" class="form-stack"><input type="hidden" name="id" value="${t.id}">${attendees.length?`<label class="field-label">Kazanan (turnuvaya kayıtlı) <select name="winnerId" required>${attendees.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></label>`:`<div class="alert">Turnuvaya kayıtlı oyuncu bulunamadı. Önce Turnuva Yönetimi bölümünden katılımcı ekle ya da oyuncunun Turnuvalar sayfasından kayıt olmasını sağla.</div>`}<label class="check-line"><input type="checkbox" name="verified" required> Maç sonucunu yönetici olarak doğruladım</label><button class="btn" type="submit" ${attendees.length?'':'disabled'}>Sonucu onayla ve ödül ata</button></form>`);}
function adminParticipantModal(id){const t=state.admin?.tournaments.find(x=>x.id===id);if(!t||state.me?.role!=='admin')return;
 const available=state.admin.users.filter(u=>!t.joined.includes(u.id)&&!(u.bannedUntil>Date.now()));
 overlay(`<div class="modal-title"><div><div class="kicker">TURNUVA KATILIMCILARI</div><h2>${esc(t.name)}</h2></div>${closeButton}</div><p class="help">Kayıtlı: ${t.participants}/${t.maxPlayers}. Katılımcı eklemek ödül vermek değildir; maç sonucu daha sonra ayrıca doğrulanır.</p><div class="admin-list">${state.admin.users.filter(u=>t.joined.includes(u.id)).map(u=>`<div class="admin-item">${avatar(u)} <b>${userName(u)}</b></div>`).join('')||'<div class="empty">Henüz kayıtlı oyuncu yok.</div>'}</div>${t.participants<t.maxPlayers&&available.length?`<form id="enrollTournamentForm" class="form-stack" style="margin-top:16px"><input name="id" type="hidden" value="${t.id}"><label class="field-label">Turnuvaya eklenecek oyuncu<select name="userId" required>${available.map(u=>`<option value="${u.id}">${esc(u.name)} (${esc(u.username)})</option>`).join('')}</select></label><button type="submit" class="btn">Katılımcıyı kaydet</button></form>`:'<p class="help">Eklenebilecek oyuncu yok veya turnuva dolu.</p>'}`);}
function adminUserModal(id){const u=state.admin.users.find(x=>x.id===id);if(!u)return;overlay(`<div class="modal-title"><div><div class="kicker">ÜYE YÖNETİMİ</div><h2>${userName(u)}</h2></div>${closeButton}</div><form class="form-stack" id="editUserForm"><input name="id" type="hidden" value="${u.id}"><div class="form-grid"><label class="field-label">Üyelik seviyesi<select name="tier">${['standard','bronze','vip','elite','owner'].map(x=>`<option value="${x}" ${x===u.tier?'selected':''}>${x.toUpperCase()}</option>`).join('')}</select></label><label class="field-label">Rol<select name="role">${['member','moderator','admin'].map(x=>`<option value="${x}" ${x===u.role?'selected':''}>${x}</option>`).join('')}</select></label><label class="field-label">Üyelik bitişi<input name="tierExpires" type="datetime-local" value="${u.tierExpires?new Date(u.tierExpires-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):''}"></label><label class="field-label">Toplam puan<input name="points" type="number" min="0" value="${u.points}" required></label><label class="field-label">Galibiyet<input name="wins" type="number" min="0" value="${u.wins}" required></label><label class="field-label">Haftalık puan<input name="weeklyPoints" type="number" min="0" value="${u.weeklyPoints}" required></label></div><button class="btn" type="submit">Üye bilgilerini kaydet</button></form>`);}
function adminRoleModal(id){const u=state.admin?.users.find(x=>x.id===id);if(!u||state.me?.role!=='admin')return;
 overlay(`<div class="modal-title"><div><div class="kicker">YÖNETİCİ / YETKİ ATAMA</div><h2>${esc(u.name)} — Rol değişikliği</h2></div>${closeButton}</div><p class="help">Rol, VIP/ELITE üyelik seviyesinden farklıdır. Moderatör şikâyetleri inceleyebilir ve süreli yasaklama yapabilir; yönetici tüm yetkileri alır.</p><form class="form-stack" id="adminRoleForm"><input name="id" type="hidden" value="${u.id}"><label class="field-label">Yetki<select name="role"><option value="member" ${u.role==='member'?'selected':''}>Normal oyuncu (yönetim yetkisi yok)</option><option value="moderator" ${u.role==='moderator'?'selected':''}>Moderatör (şikâyet ve yasaklama)</option><option value="admin" ${u.role==='admin'?'selected':''}>Yönetici (tam yetki)</option></select></label><div class="alert">Yönetici yetkisini yalnızca güvendiğin kişilere ver.</div><button class="btn" type="submit">Yetkiyi kaydet</button></form>`);}
function adminBanModal(id){const u=state.admin.users.find(x=>x.id===id);if(!u)return;overlay(`<div class="modal-title"><div><div class="kicker">MODERASYON</div><h2>${userName(u)} · Yasaklama</h2></div>${closeButton}</div><form id="banForm" class="form-stack"><input name="id" type="hidden" value="${u.id}"><label class="field-label">Yasak süresi<select name="hours">${[[1,'1 saat'],[3,'3 saat'],[6,'6 saat'],[12,'12 saat'],[24,'1 gün'],[48,'2 gün'],[72,'3 gün'],[168,'7 gün'],[720,'30 gün'],[0,'Yasağı kaldır']].map(([v,s])=>`<option value="${v}">${s}</option>`).join('')}</select></label><button class="btn danger" type="submit">İşlemi uygula</button></form>`);}
async function loadMe(){const data=await api('/me');const [t,l]=await Promise.all([api('/tournaments'),api('/leaderboard')]);state.tournaments=t.tournaments;state.leaders=l.players;state.me=data.user;state.csrf=data.csrf;state.rooms=data.rooms;state.dm=data.unread||[];$('#adminNav').hidden=!isStaff();$('#accountLabel').textContent=state.me?.name||'Giriş Yap';if(state.me)connectWs();else{state.ws?.close();state.ws=null;}render();}
function connectWs(){if(!state.me||state.ws&&[WebSocket.OPEN,WebSocket.CONNECTING].includes(state.ws.readyState))return;const w=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/club/ws`);state.ws=w;w.addEventListener('open',()=>{$('#connectionIndicator').classList.remove('off');$('#connectionIndicator').innerHTML='<i></i> Canlı bağlantı';w.send(JSON.stringify({type:'ping'}));});w.addEventListener('close',()=>{$('#connectionIndicator').classList.add('off');$('#connectionIndicator').innerHTML='<i></i> Bağlantı koptu';if(state.me)setTimeout(connectWs,3000);});w.addEventListener('message',e=>{let msg;try{msg=JSON.parse(e.data)}catch{return;}if(msg.type==='room_state'&&msg.room.id===state.roomId){state.room=msg.room;state.tables=msg.tables;state.users=msg.users;state.announcements=msg.announcements;state.vipChat=msg.vipChat;if(state.page==='room')updateRoomDOM();}
  else if(msg.type==='table_state'&&state.table&&msg.table.roomId===state.table.roomId&&msg.table.no===state.table.no){
   const oldMatch=state.table.ludo?.result?.winnerId;updateTable(msg.table);
   if(msg.table.ludo?.result&&!oldMatch){api('/me').then(x=>{state.me=x.user;state.csrf=x.csrf;}).catch(()=>{});notice('Maç bitti. Puanlar hesaplara işlendi.');}
  }
  else if(msg.type==='announcement'){state.announcements.push(msg.announcement);notice('Yeni salon duyurusu yayınlandı.');if(state.page==='room')updateRoomDOM();}
  else if(msg.type==='dm'){state.dm.push(msg.message);if(state.dmTo===msg.message.from||state.dmTo===msg.message.to){const el=$('#dmBox');if(el){el.outerHTML=dmPanel();const lines=$('#dmLines');if(lines)lines.scrollTop=lines.scrollHeight;}}else notice('Yeni özel mesajın var.');}
  else if(msg.type==='table_closed'&&state.table?.roomId===msg.roomId&&state.table?.no===msg.no){closeOverlay();notice('Masa sahibi ayrıldığı için masa kapandı.');}
  else if(msg.type==='banned'){state.me=null;state.csrf=null;state.roomId=null;state.room=null;closeOverlay();notice('Hesabına süreli uzaklaştırma uygulanmış.',true);switchPage('home');}
 });}
setInterval(()=>{for(const el of document.querySelectorAll('.ludo-time')){const ms=Number(el.dataset.deadline)-Date.now();el.textContent=`${Math.max(0,Math.ceil(ms/1000))} sn`;}},400);
setInterval(()=>{if(state.ws?.readyState===WebSocket.OPEN)state.ws.send(JSON.stringify({type:'ping'}));},15000);
let tablePulseBusy=false;
setInterval(async()=>{
 const t=state.table;if(!state.me||!t||tablePulseBusy)return;
 tablePulseBusy=true;
 try{
  const data=await api('/table/pulse','POST',{roomId:t.roomId,no:t.no});
  if(state.table?.roomId===t.roomId&&state.table?.no===t.no)updateTable(data.table);
 }catch(e){if(state.table?.roomId===t.roomId&&state.table?.no===t.no&&e.message==='Önce masaya katılın.')notice(e.message,true);}
 finally{tablePulseBusy=false;}
},7000);
let tablePollBusy=false;
setInterval(async()=>{
 const t=state.table;
 if(!state.me||!t||(state.ws?.readyState===WebSocket.OPEN&&t.game!=='101')||tablePollBusy)return;
 tablePollBusy=true;
 try{
  const data=await api(`/table/state?roomId=${encodeURIComponent(t.roomId)}&no=${t.no}`);
  if(state.table?.roomId===t.roomId&&state.table?.no===t.no)updateTable(data.table);
 }catch{}finally{tablePollBusy=false;}
},2500);

function updateRoomDOM(){const grid=$('#tableGrid');if(grid)grid.innerHTML=listTables();const a=$('#announceLines');if(a)a.innerHTML=announcements();const m=$('#memberLines');if(m)m.innerHTML=players();const v=$('#vipLines');if(v){const bottom=v.scrollHeight-v.clientHeight-v.scrollTop<40;v.innerHTML=vipMessages();if(bottom)v.scrollTop=v.scrollHeight;}}
function render(){const links=document.querySelectorAll('.nav-link');for(const b of links)b.classList.toggle('active',b.dataset.go===state.page);$('#adminNav').hidden=!isStaff();$('#accountLabel').textContent=state.me?.name||'Giriş Yap';let html='';switch(state.page){case'home':html=homePage();break;case'rooms':html=roomsPage();break;case'room':html=roomPage();break;case'tournaments':html=tournamentsPage();break;case'profile':html=profilePage();break;case'admin':html=adminPage();break;}$('#app').innerHTML=html;if(state.page==='profile'&&state.me){loadApprovals();loadMatchHistory();}}
async function loadApprovals(){try{const d=await api('/approvals/mine'),el=$('#myApprovals');if(el)el.innerHTML=d.approvals.length?d.approvals.slice().reverse().map(a=>`<div class="announcement" style="margin:5px 0">${a.type==='photo'?'Fotoğraf':'Profil'} · <b>${a.status==='pending'?'Onay bekliyor':a.status==='approved'?'Onaylandı':'Reddedildi'}</b> · ${new Date(a.created).toLocaleDateString('tr-TR')}</div>`).join(''):'Henüz talep bulunmuyor.';}catch{}}
async function loadMatchHistory(){try{const x=await api('/matches/mine'),el=$('#recentMatches');if(el)el.innerHTML=x.matches.length?x.matches.slice().reverse().map(m=>{const mine=m.points.find(p=>p.userId===state.me?.id);return `<div class="announcement"><small>${new Date(m.finishedAt).toLocaleString('tr-TR')} · Masa ${m.tableNo}</small> ${m.winnerId===state.me?.id?'🏆 Kazandın':'Maç tamamlandı'} · <b>${mine?.delta>0?'+':''}${mine?.delta||0} puan</b></div>`;}).join(''):'Henüz tamamlanan maçın yok.';}catch{}}
async function loadAdmin(){try{state.admin=await api('/admin/summary');if(state.page==='admin')render();}catch(e){notice(e.message,true);}}
async function enterRoom(id){if(!requireAuth())return;const d=await api('/room/enter','POST',{roomId:id});state.room=d.room;state.roomGame=d.room.game;state.roomId=id;state.tables=d.tables;state.users=d.users;state.announcements=d.announcements;state.vipChat=d.vipChat;switchPage('room');}
const formData=f=>Object.fromEntries(new FormData(f));
function okey101DiscardGroups(t){
 const g=t?.okey101?.game;if(!g?.discardTop)return null;const picked=g.discardTop.id;
 const auto=okey101AutoOpenGroups(t,g);
 const all=okey101Draft.length?okey101Draft.map(ids=>[...ids]):auto.map(ids=>[...ids]);
 if(okey101Selected.size>=2)all.push([...okey101Selected]);
 // The claimed discarded tile must be part of the initial 101 opening.
 if(!all.length)return null;
 const match=all.find(gr=>gr.length>=2&&!gr.includes(picked));
 if(!match)return null;match.push(picked);
 return all;
}
function okey101WarnDiscard(t,tileId){const hint=t?.okey101?.game?.hints?.[tileId];if(!hint)return true;return confirm(hint.replace?'Bu taş yerdeki okeyin yerini dolduruyor. Atarsan 101 ceza puanı alırsın. Yine de atılsın mı?':'Bu taş yerdeki açık pere işlenebiliyor. Atarsan 101 ceza puanı alırsın. Yine de atılsın mı?');}
async function okey101AttemptDiscardDraw(t){const groups=okey101DiscardGroups(t);if(!groups)throw Error('Yerden taş alıp 101 açmak için perlerini ıstakada diz veya uygun taşlarını seç.');if(!confirm('Yerden aldığın taşı kullanarak 101 açmayı deneyeceksin. Açamazsan taş yerde kalır, desteden çekilir ve +101 ceza yazılır. Devam edilsin mi?'))return;
 const response=await api('/table/101/action','POST',{roomId:t.roomId,no:t.no,action:'draw',source:'discard',groups});okey101Selected.clear();okey101Draft=[];updateTable(response.table);if(response.table?.okey101?.game?.lastMove?.type==='failed_discard_draw')notice('101 açılamadı: +101 ceza, desteden taş çekildi.',true);
}
async function act(el){const name=el.dataset.act,id=el.dataset.id,no=Number(el.dataset.no);switch(name){
 case 'close':{const previous=state.returnTable;state.returnTable=null;closeOverlay();if(previous)tableModal(previous);break;}
 case 'backdrop':closeOverlay();break;
 case 'auth':authModal();break;case 'authRegister':authModal('register');break;case 'authLogin':authModal('login');break;
 case 'logout':await api('/logout','POST',{});state.me=null;state.csrf=null;state.room=null;state.roomId=null;state.table=null;state.ws?.close();closeOverlay();await loadMe();switchPage('home');notice('Çıkış yapıldı.');break;
 case 'viewGameRooms':state.roomGame=el.dataset.game;switchPage('rooms');break;
 case 'gameDirectory':state.roomGame=null;switchPage('rooms');break;
 case 'enterRoom':await enterRoom(id);break;
 case 'joinTournament':{if(!requireAuth())break;await api('/tournament/join','POST',{id});state.tournaments=(await api('/tournaments')).tournaments;render();notice('Turnuvaya kaydoldun.');break;}
  case 'chooseTable':tablePick(no);break;
  case 'ok101Start':{const t=state.table;if(!t)break;const r=await api('/table/101/start','POST',{roomId:t.roomId,no:t.no});okey101Selected.clear();okey101Draft=[];okey101ShowSettings=false;updateTable(r.table);notice('101 Okey eli başladı.');break;}
 case 'ok101Panel':okey101ShowSettings=!okey101ShowSettings;okey101Refresh();break;
 case 'ok101ChatToggle':{const box=el.closest('.table-bottom-chat');if(box){const expanded=box.classList.toggle('ok101-chat-expanded');el.setAttribute('aria-expanded',String(expanded));}break;}
 case 'ok101Arrange':{const t=state.table;const g=t?.okey101?.game;if(!g)break;const arrange=globalThis.Arena101Rack;if(!arrange)throw Error('Taş dizme modülü yüklenmedi. Sayfayı yenile.');okey101RackOrders.set(okey101TableKey(t),arrange.arrange(g.hand,g,el.dataset.mode==='pairs'?'pairs':'run'));okey101Selected.clear();okey101Draft=[];okey101Refresh();break;}
 case 'ok101DiscardAttempt':{if(state.table)await okey101AttemptDiscardDraw(state.table);break;}
 case 'ok101Toggle':{const tile=id;if(okey101Selected.has(tile))okey101Selected.delete(tile);else okey101Selected.add(tile);okey101Refresh();break;}
 case 'ok101Draft':{if(okey101Selected.size<3){notice('Per için en az 3 taş seç.');break;}const ids=[...okey101Selected];if(okey101Draft.some(group=>group.some(x=>ids.includes(x)))){notice('Taş zaten başka bir pere ayrılmış.',true);break;}okey101Draft.push(ids);okey101Selected.clear();okey101Refresh();break;}
 case 'ok101Undo':okey101Draft.splice(no,1);okey101Refresh();break;
 case 'ok101Clear':okey101Selected.clear();okey101Draft=[];okey101Refresh();break;
 case 'ok101Action':{
   const t=state.table;if(!t)break;
   const action=el.dataset.move,packet={roomId:t.roomId,no:t.no,action};
   if(action==='draw')packet.source=el.dataset.source;
   if(action==='discard'){if(okey101Selected.size!==1)throw Error('Atmak için yalnızca bir taş seç.');packet.tileId=[...okey101Selected][0];if(!okey101WarnDiscard(t,packet.tileId))break;}
   if(action==='open'||action==='lay_melds'){
     const auto=(state.table&&state.table.okey101)?okey101AutoOpenGroups(state.table,state.table.okey101.game):[];
     if(okey101Draft.length)packet.groups=okey101Draft.map(g=>[...g]);
     else if(okey101Selected.size>=3)packet.groups=[[...okey101Selected]];
     else if(auto.length)packet.groups=auto;
     else throw Error('Açmak için perlerini ıstakada yan yana diz veya taş seç.');
   }
   if(action==='open_pairs'){packet.action='open';packet.pairOpening=true;packet.tileIds=[...okey101Selected];}
   if(action==='add_to_meld'){packet.tileIds=[...okey101Selected];packet.meldId=$('#ok101MeldTarget')?.value;if(!packet.meldId)throw Error('Hedef per seç.');}
   if(action==='replace_joker'){if(okey101Selected.size!==1)throw Error('Okeyin yerini dolduracak tek taş seç.');packet.tileId=[...okey101Selected][0];packet.meldId=$('#ok101MeldTarget')?.value;if(!packet.meldId)throw Error('Okeyi içeren hedef per seç.');}
   if(action==='next_round'&&!confirm('Sonraki ele geçilsin mi?'))break;
   if(el.dataset.busy==='1')break;el.dataset.busy='1';
   try{const r=await api('/table/101/action','POST',packet);okey101Selected.clear();okey101Draft=[];updateTable(r.table);if(r.table?.okey101?.game?.lastMove?.penalty)notice('İşlek taş atıldı: +101 ceza puanı!',true);}
   finally{el.dataset.busy='0';}break;
 }
 case 'ludoStart':{const t=state.table;if(!t)break;const r=await api('/table/ludo/start','POST',{roomId:t.roomId,no:t.no});updateTable(r.table);notice('Kızma Birader maçı başladı.');break;}
  case 'ludoPawn':if(Date.now()>suppressPawnClickUntil)await ludoSendPawn(Number(el.dataset.pawn));break;
  case 'ludoRoll':{const t=state.table;if(!t)break;
   ludoStartDiceAnimation();
   try{const [r]=await Promise.all([api('/table/ludo/roll','POST',{roomId:t.roomId,no:t.no}),new Promise(resolve=>setTimeout(resolve,850))]);
    if(state.table?.roomId===t.roomId&&state.table?.no===t.no)updateTable(r.table);
   }catch(err){ludoRollingUntil=0;const button=document.querySelector('#ludoArea [data-act="ludoRoll"]');if(button)button.disabled=false;
    document.querySelector('#ludoArea .ludo-die-cube')?.classList.remove('is-rolling');throw err;}
   break;}
  case 'ludoTakeover':{const t=state.table;if(!t)break;const r=await api('/table/ludo/takeover','POST',{roomId:t.roomId,no:t.no});updateTable(r.table);break;}

 case 'joinSeat':case 'joinSpectator':{const d=await api('/table/join','POST',{roomId:state.roomId,no,as:name==='joinSeat'?'player':'spectator'});tableModal(d.table);break;}
 case 'leaveTable':await api('/table/leave','POST',{});closeOverlay();notice('Masadan ayrıldın.');break;
 case 'tableSettings':tableConfigModal(state.table.no,state.table);break;
 case 'player':playerModal(id);break;
 case 'startDm':{const previous=state.returnTable;state.returnTable=null;state.dmTo=id;closeOverlay();if(previous)tableModal(previous);renderDm();break;}
 case 'closeDm':state.dmTo=null;$('#dmBox')?.remove();break;
 case 'reportUser':reportModal(id);break;
 case 'adminRoleUser':adminRoleModal(id);break;
 case 'adminTab':state.adminTab=id;$('#adminSection').innerHTML=adminContent();document.querySelectorAll('.admin-tabs button').forEach(b=>b.classList.toggle('chosen',b.dataset.id===id));break;
 case 'rentalSettings':rentalSettingsModal();break;
 case 'setWinner':tournamentWinnerModal(id);break;
 case 'manageParticipants':adminParticipantModal(id);break;
 case 'adminEditRoom':adminRoomModal(id);break;case 'adminEditUser':adminUserModal(id);break;case 'adminBanUser':adminBanModal(id);break;
 case 'approval':await api('/admin/approvals','POST',{id,approve:el.dataset.decision==='true'});notice('Talep işlendi.');await loadAdmin();break;
 case 'reviewReport':await api('/admin/report','POST',{id,status:el.dataset.decision});notice('Şikâyet kaydedildi.');await loadAdmin();break;
 case 'deleteRoom':if(confirm('Salonu silmek istediğine emin misin?')){await api('/admin/room','DELETE',{id});closeOverlay();await loadAdmin();await loadMe();}break;
 }}
function renderDm(){if(!state.dmTo)return;$('#dmBox')?.remove();document.body.insertAdjacentHTML('beforeend',dmPanel());const lines=$('#dmLines');if(lines)lines.scrollTop=lines.scrollHeight;}
async function compressImage(file){if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('PNG, JPEG veya WebP seç.');if(file.size>10*1024*1024)throw Error('Orijinal resim 10 MB üstünde olamaz.');const img=await createImageBitmap(file);const canvas=document.createElement('canvas'),ratio=Math.min(1,950/Math.max(img.width,img.height));canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const out=canvas.toDataURL('image/jpeg',.79);img.close();if(out.length>1300000)throw Error('Resim çok büyük, daha küçük bir görsel seç.');return out;}
async function submit(form){const id=form.getAttribute('id'),d=formData(form);switch(id){
 case 'authForm':{const p=await api(d.mode==='register'?'/register':'/login','POST',{...d});state.me=p.user;state.csrf=p.csrf;closeOverlay();await loadMe();notice('Arena Club hesabına hoş geldin!');break;}
 case 'profileForm':await api('/profile','POST',d);notice('Değişiklik yönetici onayına gönderildi.');loadApprovals();break;
 case 'photoForm':{const f=form.elements.image.files[0];if(!f)throw Error('Fotoğraf seç.');const image=await compressImage(f);await api('/photo','POST',{image,replaceId:d.replaceId,avatar:form.elements.avatar.checked});form.reset();notice('Fotoğrafın onaya gönderildi.');loadApprovals();break;}
 case 'privacyForm':{await api('/privacy','PATCH',{privateMessages:form.elements.privateMessages.checked});state.me.privateMessages=form.elements.privateMessages.checked;notice('Gizlilik ayarı kaydedildi.');break;}
 case 'passwordForm':await api('/password','POST',d);form.reset();notice('Şifren değiştirildi.');break;
 case 'tableSetupForm':{const no=Number(d.no),game=state.room?.game||state.table?.game,s={game,maxPlayers:Number(d.maxPlayers),turnSeconds:Number(d.turnSeconds),spectators:form.elements.spectators.checked,privateChat:form.elements.privateChat.checked,...(d.rounds?{rounds:Number(d.rounds)}:{points:Number(d.points)})};
  if(state.table){const r=await api('/table/settings','PATCH',{roomId:state.roomId,no,settings:s});tableModal(r.table);notice('Masa ayarları güncellendi.');}
  else{const r=await api('/table/join','POST',{roomId:state.roomId,no,as:'player',settings:s});tableModal(r.table);notice('Masa kuruldu.');}break;}
 case 'tableChatForm':if(!state.table)throw Error('Masa bulunamadı.');await api('/chat/table','POST',{roomId:state.table.roomId,no:state.table.no,message:d.message});form.reset();break;
 case 'vipChatForm':await api('/chat/vip','POST',{roomId:state.roomId,message:d.message});form.reset();break;
 case 'dmForm':await api('/chat/dm','POST',{to:state.dmTo,message:d.message});form.reset();break;
 case 'reportForm':await api('/report','POST',{type:d.type,reason:d.reason,against:d.against,roomId:state.roomId,tableNo:state.table?.no});closeOverlay();notice('Şikâyet moderatörlere iletildi.');break;
 case 'createTournamentForm':await api('/admin/tournament','POST',{name:d.name,game:d.game,startAt:new Date(d.startAt).toISOString(),maxPlayers:Number(d.maxPlayers),rewardTier:d.rewardTier,rewardDays:Number(d.rewardDays)});state.tournaments=(await api('/tournaments')).tournaments;await loadAdmin();notice('Turnuva oluşturuldu.');break;
 case 'winnerForm':await api('/admin/tournament/result','POST',{id:d.id,winnerId:d.winnerId,verified:form.elements.verified.checked});closeOverlay();await loadAdmin();state.tournaments=(await api('/tournaments')).tournaments;notice('Sonuç doğrulandı, ödül işlendi.');break;
 case 'enrollTournamentForm':await api('/admin/tournament/enroll','POST',{id:d.id,userId:d.userId});closeOverlay();await loadAdmin();state.tournaments=(await api('/tournaments')).tournaments;notice('Oyuncu turnuvaya eklendi.');break;
  case 'adminRoomCreate':await api('/admin/room','POST',{name:d.name,game:d.game,tableCount:Number(d.tableCount)});form.reset();await loadAdmin();await loadRooms();notice('Salon oluşturuldu.');break;
 case 'rentalForm':{const updated=await api('/admin/room','PATCH',{id:d.id,name:d.name,tableCount:Number(d.tableCount)});state.room=updated.room;await loadRooms();closeOverlay();render();notice('Salon ayarları kaydedildi.');break;}
 case 'editRoomForm':await api('/admin/room','PATCH',{id:d.id,name:d.name,tableCount:Number(d.tableCount),...(state.me.role==='admin'?{ownerId:d.ownerId,rentalUntil:d.rentalUntil}: {})});closeOverlay();await loadAdmin();await loadRooms();notice('Salon güncellendi.');break;
 case 'adminRoleForm':{if(d.role==='admin'&&!confirm('Bu üyeye tüm yönetici yetkileri verilecek. Onaylıyor musun?'))break;await api('/admin/user','PATCH',{id:d.id,role:d.role});closeOverlay();await loadAdmin();notice('Üyenin yönetim yetkisi kaydedildi.');break;}
  case 'editUserForm':await api('/admin/user','PATCH',{...d,points:Number(d.points),wins:Number(d.wins),weeklyPoints:Number(d.weeklyPoints)});closeOverlay();await loadAdmin();notice('Üye güncellendi.');break;
 case 'banForm':await api('/admin/ban','POST',{id:d.id,hours:Number(d.hours)});closeOverlay();await loadAdmin();notice('Uzaklaştırma kaydedildi.');break;
 case 'announceForm':await api('/admin/announcement','POST',{message:d.message});form.reset();await loadAdmin();notice('Duyuru yayınlandı.');break;
 }}
async function loadRooms(){const d=await api('/rooms');state.rooms=d.rooms;}
document.addEventListener('click',e=>{const go=e.target.closest('[data-go]');if(go){const p=go.dataset.go;if(p==='rooms'){const fromRoom=state.roomId&&state.page==='room';state.roomGame=fromRoom?state.room?.game:null;if(fromRoom){api('/room/leave','POST',{}).catch(()=>{});state.roomId=null;state.room=null;}}switchPage(p);return;}
 const a=e.target.closest('[data-act]');if(!a)return; if(a.dataset.act==='backdrop'&&e.target!==a)return;
 Promise.resolve(act(a)).catch(err=>notice(err.message,true));});
document.addEventListener('dragstart',e=>{const tile=e.target.closest('[data-ok101-drag]');if(!tile)return;okey101DragTile=tile.dataset.id;try{e.dataTransfer.setData('text/plain',okey101DragTile);e.dataTransfer.effectAllowed='move';}catch{}});
document.addEventListener('dragover',e=>{const slot=e.target.closest('[data-ok101-slot]');if(!slot)return;e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';});
document.addEventListener('drop',e=>{const slot=e.target.closest('[data-ok101-slot]');if(!slot||!okey101DragTile)return;e.preventDefault();okey101MoveRackTile(okey101DragTile,Number(slot.dataset.ok101Slot));okey101DragTile=null;});
document.addEventListener('dragend',()=>{okey101DragTile=null;});
document.addEventListener('change',e=>{if(e.target?.id==='tableGameSelect'){$('#gameDynamicSettings').innerHTML=gameSettings(e.target.value);}});
document.addEventListener('submit',e=>{const f=e.target;if(!(f instanceof HTMLFormElement)||!f.getAttribute('id'))return;e.preventDefault();const btn=f.querySelector('button[type="submit"],button:not([type])');if(btn)btn.disabled=true;submit(f).catch(err=>notice(err.message,true)).finally(()=>{if(btn?.isConnected)btn.disabled=false;});});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#overlayRoot').childElementCount)closeOverlay();});
(async()=>{try{const config=await api('/config');state.games=config.games;await loadMe();if(!config.configured)notice('Yönetici hesabı henüz kurulmadı. Coolify ortam değişkenlerini ayarla.',true);}catch(e){$('#app').innerHTML=`<div class="alert">Arena Club sunucusu cevap vermedi: ${esc(e.message)}</div>`;}})();

// Adapted from the supplied 101okey-coolify client, using Arena Club API/session.
let okey101Selected=new Set(),okey101Draft=[],okey101ActiveId=null,okey101ShowSettings=false,okey101DragTile=null;
const okey101RackOrders=new Map();
const okey101Colors={red:'Kırmızı',blue:'Mavi',black:'Siyah',yellow:'Sarı'};
const okey101SortTiles=(a,b,g)=>{const color={red:1,blue:2,black:3,yellow:4};const x=a.kind==='fake-joker'?g.okey:a,y=b.kind==='fake-joker'?g.okey:b;return (color[x.color]||9)-(color[y.color]||9)||x.num-y.num||a.id.localeCompare(b.id);};
function okey101ResetIfNew(t){const id=t.okey101?.id||`waiting:${t.roomId}:${t.no}`;if(okey101ActiveId!==id){okey101ActiveId=id;okey101Selected.clear();okey101Draft=[];okey101ShowSettings=false;}okey101EnsureRackOrder(t);}
function okey101Key(t){const m=t.okey101;return m?`${m.id}:${m.revision}:${m.phase}`:`waiting:${t.members.map(x=>x.user.id+':'+x.connected).join('|')}`;}
function okey101TableKey(t){return `${t.roomId}:${t.no}`;}
function okey101Face(tile,g){return tile.kind==='fake-joker'?g.okey:{color:tile.color,num:tile.num};}
function okey101IsWild(tile,g){return tile.kind==='normal'&&tile.color===g.okey.color&&tile.num===g.okey.num;}
function okey101TilePoints(tile,g){return okey101IsWild(tile,g)?25:okey101Face(tile,g).num;}
function okey101ValidateMeld(tiles,g){
 if(!Array.isArray(tiles)||tiles.length<3||tiles.length>13)return {valid:false,score:0,reason:'Bir per en az 3 taş olmalı.'};
 const wilds=tiles.filter(tile=>okey101IsWild(tile,g));
 const naturals=tiles.filter(tile=>!okey101IsWild(tile,g));
 const possibilities=[];
 for(const color of ['red','blue','black','yellow']){
  const maxStart=13-tiles.length+1;
  for(let start=1;start<=maxStart;start++){
   const expected=Array.from({length:tiles.length},(_,i)=>({color,num:start+i}));
   const available=[...naturals];
   for(const face of expected){
    const index=available.findIndex(tile=>{const f=okey101Face(tile,g);return f.color===face.color&&f.num===face.num;});
    if(index>=0)available.splice(index,1);
   }
   if(available.length===0&&expected.length-naturals.length===wilds.length)possibilities.push({valid:true,score:expected.reduce((sum,face)=>sum+face.num,0),type:'seri'});
  }
 }
 for(let num=1;num<=13;num++){
  const colors=new Set(); let matches=true;
  for(const tile of naturals){const face=okey101Face(tile,g);if(face.num!==num||colors.has(face.color)){matches=false;break;}colors.add(face.color);} 
  const missing=4-colors.size; if(matches&&wilds.length<=missing)possibilities.push({valid:true,score:num*tiles.length,type:'set'});
 }
 possibilities.sort((a,b)=>b.score-a.score);
 return possibilities[0]||{valid:false,score:0,reason:'Geçersiz per.'};
}
function okey101PreviewInfo(t,g){
 const handMap=new Map(g.hand.map(tile=>[tile.id,tile]));
 const groups=okey101Draft.map(ids=>ids.map(id=>handMap.get(id)).filter(Boolean)).filter(arr=>arr.length>=3);
 let total=0,valid=true,parts=[];
 for(const tiles of groups){const info=okey101ValidateMeld(tiles,g);total+=info.score||0;parts.push(info);if(!info.valid)valid=false;}
 if(!groups.length&&okey101Selected.size>=3){const info=okey101ValidateMeld([...okey101Selected].map(id=>handMap.get(id)).filter(Boolean),g);total=info.score||0;valid=info.valid;parts=[info];}
 return {total,valid,parts};
}
function okey101SeatPosition(player,selfSeat){if(selfSeat<0)return ['top','right','bottom','left'][player.seat%4];const rel=(player.seat-selfSeat+4)%4;return ['bottom','right','top','left'][rel];}
function okey101EnsureRackOrder(t){const g=t.okey101?.game;if(!g)return [];const key=okey101TableKey(t);const hand=[...g.hand].sort((a,b)=>okey101SortTiles(a,b,g));const ids=hand.map(tile=>tile.id);let slots=okey101RackOrders.get(key);const size=Math.max(28,ids.length+6);
 if(!slots){slots=[...ids,...Array(Math.max(0,size-ids.length)).fill(null)];okey101RackOrders.set(key,slots);return slots;}
 slots=slots.filter(id=>id===null||ids.includes(id));
 const seen=new Set(slots.filter(Boolean));
 for(const id of ids)if(!seen.has(id)){const empty=slots.indexOf(null);if(empty>=0)slots[empty]=id;else slots.push(id);seen.add(id);}
 while(slots.length<size)slots.push(null);
 okey101RackOrders.set(key,slots);
 return slots;
}
function okey101MoveRackTile(tileId,targetIndex){const t=state.table,g=t?.okey101?.game;if(!t||!g)return;const key=okey101TableKey(t);const slots=[...okey101EnsureRackOrder(t)];const from=slots.indexOf(tileId);if(from<0||targetIndex<0||targetIndex>=slots.length)return;[slots[from],slots[targetIndex]]=[slots[targetIndex],slots[from]];okey101RackOrders.set(key,slots);okey101Refresh();}
function okey101Tile(t,g,select=false){if(!t)return `<span class="ok101-no-tile">—</span>`;
 const f=okey101Face(t,g),kind=t.kind==='fake-joker'?'sahte':okey101IsWild(t,g)?'wild':'';
 const dragAttrs=select?`draggable="false" data-ok101-drag="1"`:'';
 const hint=select?g.hints?.[t.id]:null;const warning=hint?.replace?'danger-joker':hint?.append?'danger-work':'';const label=kind==='sahte'?'SAHTE':kind==='wild'?'OKEY':esc(okey101Colors[f.color]||'');
 return `<${select?'button':'span'} ${select?'type="button" data-act="ok101Toggle"':''} ${dragAttrs} data-id="${esc(t.id)}" title="${hint?.replace?'KIRMIZI: Yerdeki okeyin yerine işlenebilir':hint?.append?'YEŞİL: Açık bir pere işlenebilir; atarsan 101 ceza':'Taş'}" class="ok101-tile ${esc(f.color||'black')} ${kind} ${warning} ${select&&okey101Selected.has(t.id)?'picked':''}"><strong>${esc(f.num)}</strong><small>${label}</small>${kind==='sahte'?'<em class="ok101-fake-mark" title="Sahte okey: joker değildir">S</em>':''}${warning?`<i class="ok101-hint-dot" aria-hidden="true">${hint?.replace?'!':'+'}</i>`:''}</${select?'button':'span'}>`;
}
function okey101PlayerCard(t,m,p,g){const member=t.members.find(x=>x.user.id===p.id)?.user||state.users.find(x=>x.id===p.id)||{name:p.name};const pos=okey101SeatPosition(p,m.selfSeat);return `<div class="ok101-player-card ${pos} ${p.seat===g.currentSeat&&m.phase==='playing'?'active':''}">${avatar(member)}<div class="ok101-player-meta"><b class="ok101-player-name">${esc(p.name)}</b><small class="ok101-player-sub">${p.handCount} taş · ${p.opened?'açtı':'bekliyor'}</small><span class="ok101-player-score">${p.score} puan</span></div></div>`;}
function okey101RackSlots(t,g,reserved){const slots=okey101EnsureRackOrder(t),tileMap=new Map(g.hand.map(tile=>[tile.id,tile]));return slots.map((id,index)=>{const tile=id?tileMap.get(id):null;return `<div class="ok101-slot ${tile?'filled':'empty'} ${tile&&reserved.has(tile.id)?'reserved':''}" data-ok101-slot="${index}">${tile?okey101Tile(tile,g,true):'<span class="ok101-slot-mark"></span>'}</div>`;}).join('');}
function okey101GroupsBar(g){if(!okey101Draft.length)return '<span class="help">Hazırladığın perler burada küçük kartlar olarak görünecek.</span>';const handMap=new Map(g.hand.map(tile=>[tile.id,tile]));return okey101Draft.map((group,i)=>{const tiles=group.map(id=>handMap.get(id)).filter(Boolean);const info=okey101ValidateMeld(tiles,g);return `<button class="btn secondary small" data-act="ok101Undo" data-no="${i}">Per ${i+1} · ${tiles.length} taş · ${info.score||0} puan ×</button>`;}).join('');}
function okey101RackSegments(t,g){const slots=okey101EnsureRackOrder(t),tileMap=new Map(g.hand.map(tile=>[tile.id,tile])),rows=[];for(let row=0;row<2;row++){const chunk=slots.slice(row*14,row*14+14);let group=[];for(const id of chunk){if(id&&tileMap.has(id))group.push(id);else{if(group.length)rows.push([...group]);group=[];}}if(group.length)rows.push([...group]);}return rows;}
function okey101RackAnalysis(t,g){
 const helper=globalThis.Arena101Rack;
 if(helper){const result=helper.readGroups(okey101EnsureRackOrder(t),g.hand,g);return {runScore:result.groups.filter(x=>x.type==='run').reduce((s,x)=>s+x.score,0),setScore:result.groups.filter(x=>x.type==='set').reduce((s,x)=>s+x.score,0),total:result.score,validGroups:result.groups.map(x=>({ids:x.ids,info:{valid:true,score:x.score,type:x.type==='run'?'seri':'set'}}))};}
 const handMap=new Map(g.hand.map(tile=>[tile.id,tile]));const groups=okey101RackSegments(t,g);let runScore=0,setScore=0,total=0,validGroups=[];for(const ids of groups){if(ids.length<3)continue;const tiles=ids.map(id=>handMap.get(id)).filter(Boolean);const info=okey101ValidateMeld(tiles,g);if(info.valid){total+=info.score||0;if(info.type==='seri')runScore+=info.score||0;else setScore+=info.score||0;validGroups.push({ids,info});}}return {runScore,setScore,total,validGroups};}
function okey101AutoOpenGroups(t,g){return okey101RackAnalysis(t,g).validGroups.map(x=>x.ids);}
function okey101TurnText(m,g,mine){const name=esc(m.players[g.currentSeat].name);if(m.phase!=='playing')return 'El tamamlandı';if(mine)return g.turnPhase==='draw'?'Sıra sende · taş çek':'Sıra sende · taş at veya aç';return g.turnPhase==='draw'?`${name} taş çekecek`:`${name} taş atacak`;}
function render101(t){okey101ResetIfNew(t);const m=t.okey101,players=t.members.filter(p=>p.as==='player'),spectators=t.members.filter(p=>p.as==='spectator');
 if(!m)return `<div class="ok101-wait"><div class="ok101-hero">🀄</div><h3>101 Okey · Arena Club</h3><p>Oyunu başlatmak için dört oyuncu masaya oturmalı.</p><div class="ok101-seats">${playerSeats(t)}</div>${(state.me?.id===t.ownerId||state.me?.role==='admin')?`<button class="btn" data-act="ok101Start" ${players.length===4&&players.every(p=>p.connected)?'':'disabled'}>4/4 oyuncu · 101 Okey'i başlat</button>`:''}<p class="help">Bu oyun kendi 101 Okey puan tablosunu tutar; Arena Club genel puanı henüz değişmez.</p></div>`;
 const g=m.game,mine=m.selfSeat>=0&&m.phase==='playing'&&g.currentSeat===m.selfSeat,phase=g.turnPhase,discard=mine&&phase==='discard',draw=mine&&phase==='draw';
 const playable=new Set(g.hand.map(x=>x.id));okey101Selected=new Set([...okey101Selected].filter(id=>playable.has(id)));
 okey101Draft=okey101Draft.map(group=>group.filter(id=>playable.has(id))).filter(group=>group.length>=3);
 const reserved=new Set(okey101Draft.flat());
 const opened=m.players.find(p=>p.seat===m.selfSeat)?.opened;const result=g.result;const preview=okey101PreviewInfo(t,g);const rackInfo=okey101RackAnalysis(t,g);const turnText=okey101TurnText(m,g,mine);
 return `<section class="ok101-shell arcade"><header class="ok101-topbar"><div><div class="ok101-kicker">101 OKEY · ${m.roundNo}/${m.rounds}. EL</div><b>${turnText}</b></div><div class="ok101-top-actions"><button class="btn secondary small" data-act="ok101Panel">Masa özellikleri</button>${state.me&&(state.me.id===t.ownerId||state.me.role==='admin')?'<button data-act="tableSettings" class="btn secondary small">Masa kuralları</button>':''}<button data-act="leaveTable" class="btn danger small">Ayrıl</button></div></header>
 ${okey101ShowSettings?`<div class="ok101-settings-pop"><div class="ok101-settings-grid"><div>Oyun: <b>101 Okey</b></div><div>İzleyici: <b>${t.spectators?'Açık':'Kapalı'}</b></div><div>Özel mesaj: <b>${t.privateChat?'Açık':'Kapalı'}</b></div><div>Oyuncu: <b>${players.length}/${t.maxPlayers}</b></div><div>İzleyici: <b>${spectators.length}</b></div><div>El sayısı: <b>${t.rounds||1}</b></div></div><div class="ok101-spectators">${spectators.length?spectators.map(m=>`<button class="user-chip" type="button" data-act="player" data-id="${m.user.id}">${avatar(m.user)}<span class="nick">${userName(m.user)}</span></button>`).join(''):'<span class="help">İzleyici yok.</span>'}</div></div>`:''}
 <div class="ok101-arcade-table"><div class="ok101-player-ring">${m.players.filter(p=>p.seat!==m.selfSeat).map(p=>okey101PlayerCard(t,m,p,g)).join('')}</div>
 <div class="ok101-playfield"><div class="ok101-board-grid"></div>
 <div class="ok101-status-pill" role="status">${turnText}${m.phase==='playing'?` · ${g.currentSeat+1}/4`: ''}</div>
 <div class="ok101-left-badges"><button type="button" class="ok101-badge" data-act="ok101Arrange" data-mode="pairs" title="Çiftleri ıstakada düzenle"><span>ÇİFT DİZ</span><strong>${rackInfo.setScore||0}</strong></button><button type="button" class="ok101-badge" data-act="ok101Arrange" data-mode="run" title="Serileri ıstakada düzenle"><span>SERİ DİZ</span><strong>${rackInfo.total||0}</strong></button></div>
 <div class="ok101-center-layout"><section class="ok101-zone"><div class="ok101-zone-head"><h4>Seri / per alanı</h4><span>${g.melds.length} açık per</span></div><div class="ok101-zone-body">${g.melds.length?g.melds.map((per,i)=>`<div class="ok101-meld" data-ok101-meld-id="${esc(per.id)}" title="Açılmış oyuncular buraya taş sürükleyip işleyebilir"><small>Per ${i+1} · ${esc(m.players.find(x=>x.id===per.ownerId)?.name||'Oyuncu')}</small><div class="ok101-meld-tiles">${per.tiles.map(x=>okey101Tile(x,g)).join('')}</div></div>`).join(''):'<p class="help">Açılan seriler burada görünecek.</p>'}</div></section><section class="ok101-zone pairs"><div class="ok101-zone-head"><h4>Aynı sayı / çift alanı</h4><span>${g.pairs.length} açılış</span></div><div class="ok101-zone-body">${g.pairs.length?g.pairs.map((pair,i)=>`<div class="ok101-meld"><small>Çift ${i+1}</small><div class="ok101-meld-tiles">${pair.tiles.map(x=>okey101Tile(x,g)).join('')}</div></div>`).join(''):'<p class="help">Aynı sayılı farklı renk taşlar ve çift açılışlar burada görünür.</p>'}</div></section></div>
 <div class="ok101-draw-area"><div class="ok101-stackbox ${draw?'my-turn':''}"><span>Deste</span><div class="ok101-stock-drag" ${draw?'data-ok101-draw-source="wall"':''} title="Taşı tutup ıstakana sürükle" role="img" aria-label="Kapalı taş destesi">✦<small>${g.drawCount}</small></div><button class="btn small" data-act="ok101Action" data-move="draw" data-source="wall" ${draw?'':'disabled'}>Çek</button></div><div role="button" tabindex="0" class="ok101-stackbox discard ${discard&&okey101Selected.size===1?'ready':''}" data-act="ok101Action" data-move="discard" title="Seçtiğin taşı ortaya at"><span>${g.lastMove?.type==='discard'?esc(m.players.find(p=>p.id===g.lastMove.playerId)?.name||'Oyuncu')+' attı':'Son atılan'}</span><div class="ok101-discard-tile" ${draw&&g.discardTop?'data-ok101-draw-source="discard"':''}>${okey101Tile(g.discardTop,g)}</div><small>${discard?'1 taşı seç ve buraya tıkla':'Bunu herkes görebilir'}</small></div><div class="ok101-stackbox" data-ok101-finish-target="1" title="Son taşını göstergeye sürükleyerek bitir"><span>Gösterge</span>${okey101Tile(g.indicator,g)}<small>Okey: ${esc(okey101Colors[g.okey.color])} ${g.okey.num}</small><button class="btn secondary small" data-act="${m.players.find(x=>x.seat===m.selfSeat)?.opened?'ok101Action':'ok101DiscardAttempt'}" data-move="draw" data-source="discard" ${draw&&g.discardTop?'':'disabled'}>${m.players.find(x=>x.seat===m.selfSeat)?.opened?'Yerden al':'Yerden 101 dene'}</button></div></div></div></div>
 ${m.phase==='playing'?`<div class="ok101-rack arcade"><div class="ok101-rack-head compact"><div class="ok101-rack-meta-line"><div class="ok101-rack-title">${m.selfSeat>=0?`<span class="ok101-self-label">${esc(m.players[m.selfSeat]?.name||'Oyuncu')} <small>· Benim ıstakam</small></span>`:'Istaka'}</div><div class="help ok101-hint-legend"><span>🟢 İşlek (+101 atma cezası)</span><span>🔴 Okeyi alabileceğin taş</span></div></div><div class="ok101-rack-stats minimalist"><span>${g.hand.length} taş</span><span>${preview.valid?'Açılış hazır':'Açılış'}: ${Math.max(preview.total||0,rackInfo.total||0)}</span></div></div><div class="ok101-mini-actions compact"><button class="btn secondary small" data-act="ok101Draft" ${discard&&okey101Selected.size>=3?'':'disabled'}>Seçileni per yap</button><button class="btn small" data-act="ok101Action" data-move="${opened?'lay_melds':'open'}" ${discard&&(okey101Draft.length||okey101Selected.size>=3||rackInfo.validGroups.length)?'':'disabled'}>${opened?'Yeni per aç':'101 ile aç'}</button><button class="btn secondary small" data-act="ok101Action" data-move="open_pairs" ${discard&&!opened&&okey101Selected.size===10?'':'disabled'}>5 çift aç</button><select id="ok101MeldTarget" aria-label="Per seç"><option value="">Per seç…</option>${g.melds.map((per,i)=>`<option value="${esc(per.id)}">Per ${i+1}</option>`).join('')}</select><button class="btn secondary small" data-act="ok101Action" data-move="add_to_meld" ${discard&&opened&&okey101Selected.size?'':'disabled'}>Pere işle</button><button class="btn secondary small" data-act="ok101Action" data-move="replace_joker" ${discard&&opened&&okey101Selected.size===1?'':'disabled'}>Okeyi al</button><button class="btn secondary small" data-act="ok101Clear">Seçimi temizle</button></div><div class="ok101-drafts">${okey101GroupsBar(g)}</div><div class="ok101-rack-grid wood" data-ok101-rack="true">${g.hand.length?okey101RackSlots(t,g,reserved):'<span class="help">İzleyici olarak taşları göremezsin.</span>'}</div></div>`:`<div class="ok101-end"><h3>${m.phase==='finished'?'Maç bitti':'El tamamlandı'}</h3><p>${esc(result?.winnerName||'Kazanan yok')} · ${esc(result?.reason||'')}</p><div class="ok101-result">${(result?.scores||[]).map(x=>`<div>${esc(x.name)}: ${x.delta>0?'+':''}${x.delta} ceza · toplam ${x.total}</div>`).join('')}</div>${m.phase==='roundOver'&&m.isHost?'<button class="btn" data-act="ok101Action" data-move="next_round">Sonraki eli başlat</button>':''}${m.phase==='finished'?'<p class="help">Yeni maç için masadan ayrılıp tekrar masa oluşturabilirsiniz.</p>':''}</div>`}
 </section>`;}
function okey101Refresh(){const area=$('#okey101Area');if(area&&state.table){area.innerHTML=render101(state.table);area.dataset.key=okey101Key(state.table);}}

