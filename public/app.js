const catalog=[['ludo','Kızma Birader','2 veya 4 kişi · Canlı zar ve piyonlar','🎲','#41213d','#111f43'],['tombala','Tombala','Şans & eğlence','✺','#54372d','#1c3030'],['kelime','Kelime Oyunu','Harflerin gücü','A','#284b4d','#17252b'],['101','101 Okey','Strateji & rekabet','➊','#4c392d','#182a29'],['mulk','Mülk Turu','Strateji, zar ve pazarlık','🏠','#51402b','#142f34'],['bilardo','Bilardo','8 top • klasik','⑧','#375b48','#172d2d'],['okey','Klasik Okey','Dostluk masası','▤','#494733','#1d302a']];
const byId=id=>document.getElementById(id);const games=byId('games');
for(const [id,name,detail,symbol,a,b] of catalog){const div=document.createElement('article');div.className='game';div.style.setProperty('--bg1',a);div.style.setProperty('--bg2',b);div.innerHTML='<div class="label">OYUN SALONU</div><div class="symbol"></div><div><h3></h3><p></p></div><span class="open">↗</span>';div.querySelector('.symbol').textContent=symbol;div.querySelector('h3').textContent=name;div.querySelector('p').textContent=detail;div.addEventListener('click',()=>{byId('gameSelect').value=id;syncRoomSettingFields();byId('createDialog').showModal();});games.append(div);}
let socket,rooms=[],joined=null,roomDetail=null,connected=false,timer,retry;
const identityKey='oyun_platformu_session';let reconnecting=false;
const arenaHash=new URLSearchParams(location.hash.slice(1));const arenaTicket=arenaHash.get('arena_ticket')||'';const arenaEmbed=new URLSearchParams(location.search).get('game')==='ludo';
if(arenaTicket)history.replaceState(null,'',location.pathname+location.search);
if(arenaEmbed)document.body.classList.add('arena-ludo-embed');
const savedName=sessionStorage.getItem('demoName')||`Oyuncu${Math.floor(Math.random()*9000+1000)}`;byId('nickname').value=savedName;
function toast(msg){const t=byId('toast');t.textContent=msg;t.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>t.classList.remove('show'),3200);}
function send(value){if(!connected)return toast('Bağlantı kesildi; yeniden bağlanıyor...');socket.send(JSON.stringify(value));}
function render(){byId('roomcount').textContent=rooms.length;const holder=byId('rooms');holder.replaceChildren();if(!rooms.length){const p=document.createElement('div');p.className='empty';p.textContent='Henüz açık masa yok. İlk deneme masasını sen oluştur.';holder.append(p);return;}
for(const r of rooms){const row=document.createElement('article');row.className='room';const icon=document.createElement('span');icon.className='room-icon';icon.textContent=catalog.find(g=>g[0]===r.game)?.[3]||'✦';const info=document.createElement('div');info.className='info';const title=document.createElement('b');title.textContent=r.name;const sub=document.createElement('small');sub.textContent=`${catalog.find(g=>g[0]===r.game)?.[1]||'Oyun'} • ${r.players}/${r.max} kişi${r.game==='tombala'?' • '+Math.round((r.settings?.drawInterval||30000)/1000)+' sn • Kart '+(r.settings?.ticketCost??100)+' puan':''}${r.game==='ludo'?' • '+(r.settings?.turnSeconds||30)+' sn hamle':r.game==='mulk'?' • '+(r.settings?.startCash||1500)+' M başlangıç • '+(r.settings?.auctionSeconds||30)+' sn açık artırma':r.game==='okey'?' • -'+(r.settings?.lossLimit||20)+' sınır • '+(r.settings?.turnSeconds||30)+' sn':''}${r.started?' • Başladı':''}`;info.append(title,sub);const btn=document.createElement('button');btn.className='outline';btn.textContent=joined===r.id?'Masaya gir':r.started?'Başladı':r.players>=r.max?'Masa dolu':'Masaya katıl';btn.disabled=!connected||(r.started&&joined!==r.id)||(r.players>=r.max&&joined!==r.id);btn.addEventListener('click',()=>{if(joined===r.id){showRoom();}else send({type:'join',id:r.id});});row.append(icon,info,btn);holder.append(row);}}
function showRoom(){if(!joined||!roomDetail)return;byId('mobileChatToggle').hidden=roomDetail.game!=='tombala';byId('lobbyPage').hidden=true;byId('roomPage').hidden=false;byId('roomTitle').textContent=roomDetail.name;byId('roomGame').textContent=catalog.find(g=>g[0]===roomDetail.game)?.[1]||'Oyun';byId('seatCount').textContent=`${roomDetail.players}/${roomDetail.max} kişi`;byId('roomPage').classList.toggle('tombala-room',roomDetail.game==='tombala');byId('roomPage').classList.toggle('okey-room',roomDetail.game==='okey');document.body.classList.add('inside-game-room');byId('roomPage').classList.toggle('mulk-room',roomDetail.game==='mulk');byId('roomPage').classList.toggle('ludo-room',roomDetail.game==='ludo');if(roomDetail.game==='okey'){byId('roomPage').querySelector('.table-inner').append(byId('okeyArea'));}
 const seats=byId('seats');seats.replaceChildren();for(let i=0;i<(roomDetail.game==='tombala'?roomDetail.seats.length:roomDetail.max);i++){const player=roomDetail.seats[i];const card=document.createElement('div');card.className='seat'+(player?' occupied':'');if(roomDetail.game==='okey'){const me=roomDetail.gameState?.mySeat||1;const relative=(i-(me-1)+4)%4;card.classList.add(['seat-bottom','seat-right','seat-top','seat-left'][relative]);}const avatar=document.createElement('span');avatar.className='seat-avatar';if(player?.avatar&&player.avatar.startsWith('https://')){const img=document.createElement('img');img.src=player.avatar;img.alt='';img.className='arena-player-avatar';avatar.append(img);}else avatar.textContent=player?(player.name[0]||'O').toUpperCase():'+';const desc=document.createElement('div');const b=document.createElement('b');b.textContent=player?player.name+(player.online===false?' (bağlantı kesildi)':''):'Boş koltuk';const sm=document.createElement('small');sm.textContent=player?.host?'Masa sahibi':player?'Oyuncu':'Oyuncu bekleniyor';desc.append(b,sm);card.append(avatar,desc);if(player&&player.playerId&&player.playerId!==sessionStorage.getItem(identityKey)){card.classList.add('messageable');card.title='Özel mesaj gönder';card.tabIndex=0;card.setAttribute('role','button');card.addEventListener('click',()=>openPrivateChat(player));card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPrivateChat(player);}});}seats.append(card);}
 byId('startGame').hidden=!roomDetail.host||roomDetail.started;byId('startGame').disabled=(roomDetail.game==='okey'&&roomDetail.players!==4)||(roomDetail.game==='ludo'&&roomDetail.players!==roomDetail.max);byId('startGame').title=roomDetail.game==='okey'&&roomDetail.players!==4?'Klasik Okey için 4 oyuncu gerekli':roomDetail.game==='ludo'&&roomDetail.players!==roomDetail.max?`Kızma Birader için ${roomDetail.max} oyuncu gerekli`:'';byId('roomMessage').textContent=roomDetail.game==='tombala'?'Sayıları kartlarında 30 saniye içinde işaretle. Çekiliş sonucu sunucuda doğrulanır.':roomDetail.finalResult?'Maç sona erdi. Final puanları uygulandı.':roomDetail.game==='okey'?(roomDetail.started?'Okey deneme eli aktif. Taşlarını ıstakanda sırala; sıra sendeyken taş çek veya taş at.':`Klasik Okey deneme elini başlatmak için 4 oyuncu gerekli (${roomDetail.players}/4).`):roomDetail.game==='mulk'?(roomDetail.mulk?.finished?'Mülk Turu tamamlandı. Kazanan ilan edildi.':roomDetail.mulk?'Oyun başladı. Zar, mülk ve takas işlemleri sunucu tarafından yönetiliyor.':'Oyuncular katılınca masa sahibi Mülk Turu oyununu başlatabilir.'):(roomDetail.started?'Deneme oturumu başladı; bu oyun için kurallar henüz eklenmedi.':'Masa hazır. Oyuncular katılabilir ve sohbet edebilir.');
 byId('ludoArea').hidden=roomDetail.game!=='ludo';if(roomDetail.game==='ludo')renderLudo();byId('mulkArea').hidden=roomDetail.game!=='mulk';if(roomDetail.game==='mulk')renderMulk();byId('tombalaArea').hidden=roomDetail.game!=='tombala';if(roomDetail.game==='tombala')renderTombala();byId('tombalaRules').textContent=roomDetail.game==='tombala'?`Çekiliş: ${Math.round((roomDetail.settings?.drawInterval||30000)/1000)} saniye • Oyuncu: ${roomDetail.max} • Kart: ${roomDetail.settings?.ticketCost??100} puan • 1. Çinko: ${roomDetail.settings?.prize1??500} • 2. Çinko: ${roomDetail.settings?.prize2??1000} • Tombala: ${roomDetail.settings?.prize3??2500} (tanıtım puanları; bakiye işlemi henüz aktif değil)`:'';byId('tableSettings').textContent=roomDetail.game==='okey'?`Başlangıç: 0 • Eksi limit: -${roomDetail.settings?.lossLimit||20} • Gösterge cezası: ${roomDetail.settings?.showIndicator?'açık':'kapalı'} • Puanlar: ${(roomDetail.scores||[0,0,0,0]).join(' / ')}`:'';renderOkey();renderScoreboard();const feed=byId('chatMessages');feed.replaceChildren();for(const m of roomDetail.chat||[]){const line=document.createElement('div');line.className='chatline';const name=document.createElement('b');name.textContent=m.name+': ';const msg=document.createElement('span');msg.textContent=m.message;line.append(name,msg);feed.append(line);}feed.scrollTop=feed.scrollHeight;
}
function connect(){const protocol=location.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(`${protocol}//${location.host}`);socket.onopen=()=>{connected=true;byId('dot').classList.add('good');byId('connection').textContent='Canlı bağlantı';const token=sessionStorage.getItem(identityKey);if(arenaTicket){if(token)send({type:'resume',token});else send({type:'auth',ticket:arenaTicket});}else{const guestToken=token||crypto.randomUUID();sessionStorage.setItem(identityKey,guestToken);send({type:'resume',token:guestToken});send({type:'profile',name:byId('nickname').value});}};socket.onclose=()=>{connected=false;reconnecting=true;byId('dot').classList.remove('good');byId('connection').textContent='Bağlanıyor...';render();clearTimeout(retry);retry=setTimeout(connect,2500);};socket.onmessage=e=>{let d;try{d=JSON.parse(e.data);}catch{return;}if(d.type==='state'){rooms=d.rooms;byId('online').textContent=d.online;render();}else if(d.type==='session'){sessionStorage.setItem(identityKey,d.token);}else if(d.type==='auth_required'){if(arenaTicket&&!socket.__triedAuth){socket.__triedAuth=true;send({type:'auth',ticket:arenaTicket});}else toast(d.message||'WordPress oyun sayfasını yenile.');}else if(d.type==='authenticated'){byId('nickname').value=d.name;byId('nickname').disabled=true;byId('nickname').title='WordPress hesabı';send({type:'resume',token:sessionStorage.getItem(identityKey)||''});}else if(d.type==='resumed'){if(d.name&&arenaTicket){byId('nickname').value=d.name;byId('nickname').disabled=true;}reconnecting=false;if(d.room){joined=d.room;}else{joined=null;roomDetail=null;byId('roomPage').hidden=true;byId('lobbyPage').hidden=false;document.body.classList.remove('inside-game-room');}}else if(d.type==='joined'){joined=d.room;toast('Masaya katıldın.');render();}else if(d.type==='room'){roomDetail=d;joined=d.id;showRoom();}else if(d.type==='left'){joined=null;roomDetail=null;byId('roomPage').hidden=true;byId('lobbyPage').hidden=false;toast('Masadan ayrıldın.');document.body.classList.remove('inside-game-room');closePrivateChat();render();}else if(d.type==='private_message'){receivePrivateChat(d);}else if(d.type==='error')toast(d.message);};}
byId('openCreate').addEventListener('click',()=>{syncRoomSettingFields();byId('createDialog').showModal();});byId('closeDialog').addEventListener('click',()=>byId('createDialog').close());byId('createForm').addEventListener('submit',e=>{e.preventDefault();send({type:'create',game:byId('gameSelect').value,name:byId('roomName').value,startPoints:Number(byId('startingScore').value),showIndicator:byId('indicatorEnabled').checked,turnSeconds:Number(byId('gameSelect').value==='ludo'?byId('ludoTurnSeconds').value:byId('turnSeconds').value),drawInterval:Number(byId('drawInterval').value),maxPlayers:Number(byId('maxPlayers').value),ticketCost:Number(byId('ticketCost').value),prize1:Number(byId('prize1').value),prize2:Number(byId('prize2').value),prize3:Number(byId('prize3').value),ticketCount:1,auto:true,mulkPlayers:Number(byId('mulkPlayers').value),mulkCash:Number(byId('mulkCash').value),auctionSeconds:Number(byId('auctionSeconds').value),ludoPlayers:Number(byId('ludoPlayersSelect').value),ludoTurnSeconds:Number(byId('ludoTurnSeconds').value)});byId('createDialog').close();byId('roomName').value='';});
byId('leaveRoom').addEventListener('click',()=>send({type:'leave'}));byId('startGame').addEventListener('click',()=>send({type:'start'}));byId('chatForm').addEventListener('submit',e=>{e.preventDefault();const input=byId('chatInput');if(!input.value.trim())return;send({type:'chat',message:input.value});input.value='';});byId('nickname').addEventListener('change',()=>{if(arenaTicket)return;const name=byId('nickname').value.trim().slice(0,20)||'Misafir';byId('nickname').value=name;sessionStorage.setItem('demoName',name);send({type:'profile',name});});connect();

// v0.3.1: Local rack ordering, independent from the authoritative discard action.
let rackOrder=[], selectedTile=null, lastRoomKey=null;
const actionBar=byId('okeyArea').querySelector('.okey-actions');
const discardButton=document.createElement('button');discardButton.id='discardSelected';discardButton.className='primary';discardButton.type='button';discardButton.textContent='Seçili taşı at';actionBar.append(discardButton);
const sortingTip=document.createElement('small');sortingTip.className='tile-help';sortingTip.textContent='Taşları sürükleyerek diz veya önce bir taşa, sonra yerleştireceğin taşa dokun. Taş atmak için ayrıca “Seçili taşı at” düğmesini kullan.';byId('myTiles').after(sortingTip);
function saveRack(){if(lastRoomKey)try{localStorage.setItem('rack_'+lastRoomKey,JSON.stringify(rackOrder));}catch{}}
function reorderLocal(id,beforeId){
 if(id===beforeId)return;
 const updated=rackOrder.filter(v=>v!==id);const to=updated.indexOf(beforeId);
 if(to<0)updated.push(id);else updated.splice(to,0,id);
 rackOrder=updated;saveRack();renderOkey();
}
function renderOkey(){
 const el=byId('okeyArea');const state=roomDetail?.gameState;
 el.hidden=roomDetail?.game!=='okey'||!state;
 if(el.hidden){selectedTile=null;lastRoomKey=null;return;}
 const key=roomDetail.id;if(lastRoomKey!==key){rackOrder=[];selectedTile=null;lastRoomKey=key;try{rackOrder=JSON.parse(localStorage.getItem('rack_'+key)||'[]');}catch{rackOrder=[];}}
 const ids=new Set(state.hand.map(t=>t.id));rackOrder=rackOrder.slice(0,30).map(id=>ids.has(id)?id:null);for(const t of state.hand)if(!rackOrder.includes(t.id)){let empty=rackOrder.indexOf(null);if(empty<0){empty=rackOrder.length;rackOrder.push(null);}rackOrder[empty]=t.id;}while(rackOrder.length<30)rackOrder.push(null);
 if(selectedTile&&!ids.has(selectedTile))selectedTile=null;
 const mine=state.turn===state.mySeat;const canDraw=mine&&state.phase==='draw'&&state.roundStatus==='playing';const canDiscard=mine&&state.phase==='discard'&&state.roundStatus==='playing';
 renderTableTiles(state);byId('okeyStatus').textContent=`${state.notice} • ${mine?'SIRA SENDE':'Rakibin sırası'} • Ortada ${state.wall} taş`;
 byId('drawWall').disabled=!canDraw||state.wall===0;
 byId('drawDiscard').disabled=!canDraw||state.discard.length===0;
 discardButton.disabled=!canDiscard||!selectedTile;
 const holder=byId('myTiles');holder.replaceChildren();const tiles=new Map(state.hand.map(t=>[t.id,t]));
 for(let slot=0;slot<30;slot++){
  const id=rackOrder[slot],tile=tiles.get(id);
  const b=document.createElement('button');b.type='button';b.className=tile?'okey-tile color'+tile.color+(id===selectedTile?' selected':''):'rack-empty';
  b.textContent=tile?(tile.color===4?'★':String(tile.n)):'';
  b.setAttribute('aria-label',tile?`Taş ${tile.n||'sahte okey'}, yuva ${slot+1}`:`Boş yuva ${slot+1}`);
  b.draggable=!!tile;
  b.addEventListener('click',()=>{
   if(selectedTile && selectedTile!==id){const from=rackOrder.indexOf(selectedTile);if(from>=0){rackOrder[from]=id||null;rackOrder[slot]=selectedTile;saveRack();}selectedTile=null;}
   else if(tile){selectedTile=selectedTile===id?null:id;}
   renderOkey();
  });
  if(tile)b.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';});
  b.addEventListener('dragover',e=>e.preventDefault());
  b.addEventListener('drop',e=>{e.preventDefault();const dragged=e.dataTransfer.getData('text/plain');const from=rackOrder.indexOf(dragged);if(from<0)return;rackOrder[from]=rackOrder[slot]||null;rackOrder[slot]=dragged;selectedTile=null;saveRack();renderOkey();});
  holder.append(b);
 }
}
discardButton.addEventListener('click',()=>{if(!selectedTile)return;send({type:'discard',id:selectedTile});selectedTile=null;});
byId('drawWall').addEventListener('click',()=>send({type:'draw',source:'wall'}));
byId('drawDiscard').addEventListener('click',()=>send({type:'draw',source:'discard'}));

const finishButton=document.createElement('button');finishButton.id='finishHand';finishButton.type='button';finishButton.className='outline';finishButton.textContent='Seçili taşı at ve eli bitir';actionBar.append(finishButton);
finishButton.addEventListener('click',()=>{if(selectedTile)send({type:'finish',id:selectedTile});else toast('Önce bitişte atacağın taşı seç.');});
const previousRender=renderOkey;
renderOkey=function(){previousRender();const g=roomDetail?.gameState;finishButton.disabled=!(g&&g.turn===g.mySeat&&g.phase==='discard'&&g.hand.length===15&&selectedTile);};

// v0.6: indicator, four discard piles and the remaining wall are visible to every player.
const tableTiles=byId('tableTiles');
function renderTableTiles(g){
 tableTiles.replaceChildren();
 const section=(label,tiles,cls)=>{
  const div=document.createElement('div');div.className='table-pile '+cls;
  const title=document.createElement('strong');title.textContent=label;div.append(title);
  for(const t of tiles){const span=document.createElement('span');span.className='mini-tile color'+t.color;span.textContent=t.color===4?'★':t.n;div.append(span);}
  tableTiles.append(div);return div;
 };
 const wall=section('ÇEKİLECEK TAŞLAR · '+g.wall,[],'wall-pile');
 const deck=document.createElement('div');deck.className='tile-wall';
 for(let j=0;j<Math.min(12,g.wall);j++){const tile=document.createElement('span');tile.className='tile-back';deck.append(tile);}
 wall.append(deck);
 section('GÖSTERGE',g.indicator?[g.indicator]:[],'indicator-pile');
 const positions=['bottom','right','top','left'];
 const myIndex=(g.mySeat||1)-1;
 for(let rel=0;rel<4;rel++){
  const absolute=(myIndex+rel)%4;
  const arr=g.discardBySeat?.[absolute]||[];
  // Yalnız son atılan taş masada görünür; geçmişi sunucu takip eder.
  section(['Senin attığın','Sağ oyuncunun attığı','Üst oyuncunun attığı','Sol oyuncunun attığı'][rel],arr.length?[arr[arr.length-1]]:[],'discard-pile discard-'+positions[rel]);
 }
}

const showButton=document.createElement('button');showButton.className='outline';showButton.textContent='Göstergeyi göster (−1)';actionBar.append(showButton);
showButton.addEventListener('click',()=>send({type:'showIndicator'}));
const sortRun=document.createElement('button'),sortPer=document.createElement('button');
sortRun.textContent='Seri diz';sortPer.textContent='Per diz';sortRun.className=sortPer.className='outline';actionBar.append(sortRun,sortPer);
function autoSort(kind){const g=roomDetail?.gameState;if(!g)return;const idx=new Map(rackOrder.map((id,i)=>[id,i]));const sorted=[...g.hand].sort((a,b)=>kind==='run'?(a.color-b.color||a.n-b.n):(a.n-b.n||a.color-b.color));rackOrder=sorted.map(t=>t.id);while(rackOrder.length<30)rackOrder.push(null);selectedTile=null;saveRack();renderOkey();}
sortRun.addEventListener('click',()=>autoSort('run'));sortPer.addEventListener('click',()=>autoSort('per'));
const oldRender=renderOkey;
renderOkey=function(){oldRender();const g=roomDetail?.gameState;showButton.disabled=!(g&&roomDetail?.settings?.showIndicator&&g.roundStatus==='playing'&&g.hand.some(t=>t.color===g.indicator?.color&&t.n===g.indicator?.n));};


// v0.7 Tombala: independent game UI, without modifying Okey behavior.
const ticketCountControl=byId('ticketCount'),autoControl=byId('tombalaAuto');
byId('saveTombala').addEventListener('click',()=>send({type:'tombalaSettings',count:Number(ticketCountControl.value),auto:autoControl.checked}));
function renderTombala(){
 const g=roomDetail?.tombala;if(!g)return;
 byId('tombalaPreferences').hidden=g.phase==='running'||g.phase==='ended';
 byId('tombalaLatest').textContent=g.latest??'—';
 byId('tombalaPhase').textContent=g.phase==='running'?'Canlı çekiliş sürüyor':g.phase==='ended'?'Tombala! Oyun tamamlandı':'Oyuncular bekleniyor';
 byId('tombalaRemaining').textContent=`${g.drawn.length} / 90 sayı çekildi • Torbada ${g.remaining} taş`;
 byId('tombalaNext').textContent=g.phase==='running'&&g.nextAt?`Yeni sayı: ${Math.max(0,Math.ceil((g.nextAt-Date.now())/1000))} sn`:' ';byId('tombalaMarkCountdown').textContent='Her sayı çekildikten sonra 30 saniye işaretlenebilir.';
 const notice=byId('tombalaNotice');notice.replaceChildren();for(const announcement of (g.announcements||[]).slice(-4)){const p=document.createElement('div');p.textContent='🏆 '+announcement;notice.append(p);}
 for(const [stage,title] of [['c1','1. Çinko'],['c2','2. Çinko'],['tombala','Tombala']]){const winner=g.stageWinners?.[stage];if(winner){const p=document.createElement('div');p.textContent=`🏅 ${title}: ${winner.winners.map(w=>w.name).join(', ')} (ödül kapanmıştır)`;notice.append(p);}}const history=byId('tombalaHistory');history.replaceChildren();for(const n of [...g.drawn].reverse().slice(0,30)){const chip=document.createElement('span');chip.textContent=n;chip.className='drawn-chip';history.append(chip);}
 const tickets=byId('tombalaTickets');tickets.replaceChildren();for(const ticket of g.tickets||[]){
  const card=document.createElement('article');card.className='tombala-ticket';const title=document.createElement('h3');title.textContent='Tombala Kartı • '+ticket.id.slice(0,5);card.append(title);
  const grid=document.createElement('div');grid.className='ticket-grid';for(const row of ticket.grid){for(const n of row){const btn=document.createElement('button');btn.type='button';btn.className='ticket-cell';if(n===null){btn.classList.add('ticket-blank');btn.disabled=true;btn.textContent='';}else{btn.textContent=n;btn.dataset.number=n;const called=g.drawn.includes(n);const checked=g.manualMarks.includes(`${ticket.id}:${n}`);if(checked)btn.classList.add('ticket-marked');if(called)btn.classList.add('ticket-called');btn.disabled=!called||checked||g.phase!=='running'||Date.now()>(Number(g.drawTimes?.[n]||0)+30000);btn.addEventListener('click',()=>send({type:'tombalaMark',ticketId:ticket.id,number:n}));}grid.append(btn);}}
  card.append(grid);tickets.append(card);
 }
}
setInterval(()=>{const g=roomDetail?.tombala;if(g&&g.phase==='running'&&!byId('tombalaArea').hidden){if(g.nextAt)byId('tombalaNext').textContent=`Yeni sayı: ${Math.max(0,Math.ceil((g.nextAt-Date.now())/1000))} sn`;document.querySelectorAll('.ticket-cell[data-number]').forEach(b=>{if(Date.now()>Number(g.drawTimes?.[b.dataset.number]||0)+30000)b.disabled=true;});}},450);

// v0.9: Show Tombala-specific room settings only for Tombala rooms.
function syncRoomSettingFields(){const game=byId('gameSelect').value;const isTombala=game==='tombala';byId('tombalaSettingsGroup').hidden=!isTombala;byId('okeyRoomSettings').hidden=game!=='okey';byId('mulkRoomSettings').hidden=game!=='mulk';byId('ludoRoomSettings').hidden=game!=='ludo';}
byId('gameSelect').addEventListener('change',syncRoomSettingFields);syncRoomSettingFields();
byId('joinCodeForm').addEventListener('submit',e=>{e.preventDefault();const id=byId('joinCode').value.trim();if(!id)return toast('Önce oda kodunu yaz.');send({type:'join',id});});

// Responsive Tombala chat drawer: cards remain visible when chat is closed.
const chatToggle=byId('mobileChatToggle'),chatClose=byId('mobileChatClose'),chatPane=document.querySelector('.table-chat');
chatToggle.addEventListener('click',()=>{chatPane.classList.toggle('chat-open');byId('chatInput').focus();});
chatClose.addEventListener('click',()=>chatPane.classList.remove('chat-open'));

// v1.3 — Yazboz tablosu ve masa içi özel mesajlar
let privatePeer=null;
const privateHistory=new Map();
function renderScoreboard(){
 const panel=byId('scoreboardPanel');if(!panel)return;
 const isOkey=roomDetail?.game==='okey';byId('scoreboardToggle').hidden=!isOkey;
 if(!isOkey){panel.hidden=true;return;}
 const body=byId('scoreboardBody');body.replaceChildren();
 (roomDetail.seats||[]).forEach((player,i)=>{
  const line=document.createElement('div');line.className='score-row';
  const name=document.createElement('span');name.textContent=player?.name||'Boş koltuk';
  const val=document.createElement('strong');const points=roomDetail.scores?.[i]??player?.score??0;
  val.textContent=String(points);val.className=points<0?'negative':points>0?'positive':'';
  line.append(name,val);body.append(line);
 });
 byId('scoreboardMode').textContent=`Maç puanı • Eksi limit: -${roomDetail.settings?.lossLimit||20}`;
}
byId('scoreboardToggle').addEventListener('click',()=>{const p=byId('scoreboardPanel');p.hidden=!p.hidden;});
byId('scoreboardClose').addEventListener('click',()=>byId('scoreboardPanel').hidden=true);
function openPrivateChat(player){
 if(!player?.playerId)return;
 privatePeer={id:player.playerId,name:player.name};byId('privateTitle').textContent=`${player.name} • Özel mesaj`;
 byId('privatePanel').hidden=false;drawPrivateMessages();byId('privateInput').focus();
}
function closePrivateChat(){byId('privatePanel').hidden=true;privatePeer=null;}
function drawPrivateMessages(){
 const list=byId('privateMessages');list.replaceChildren();if(!privatePeer)return;
 for(const m of privateHistory.get(privatePeer.id)||[]){const row=document.createElement('div');row.className='private-line'+(m.mine?' mine':'');const b=document.createElement('b');b.textContent=m.mine?'Sen: ':m.fromName+': ';const text=document.createElement('span');text.textContent=m.message;row.append(b,text);list.append(row);}list.scrollTop=list.scrollHeight;
}
function receivePrivateChat(m){
 const mine=m.from===sessionStorage.getItem(identityKey);const other=mine?m.to:m.from;
 if(!privateHistory.has(other))privateHistory.set(other,[]);
 const history=privateHistory.get(other);history.push({...m,mine});if(history.length>50)history.shift();
 if(privatePeer?.id===other){drawPrivateMessages();}else{toast(`${mine?m.toName:m.fromName}: Yeni özel mesaj`);if(!mine)openPrivateChat({playerId:other,name:m.fromName});}
}
byId('privateClose').addEventListener('click',closePrivateChat);
byId('privateForm').addEventListener('submit',e=>{e.preventDefault();if(!privatePeer)return;const input=byId('privateInput');const value=input.value.trim();if(!value)return;send({type:'private_chat',target:privatePeer.id,message:value});input.value='';});

// v1.4 — Mülk Turu: live board & turn-based actions. All money / property changes
// are authorized by the game server; client buttons never calculate game balances.
let mulkSquareSelected=1;
const mulkColors=['#fa9a5b','#57cddd','#e96b99','#8bc96d','#d6b8f8','#e8cc66'];
function mulkPosition(index){
 if(index<=10)return {row:11,col:11-index};
 if(index<=20)return {row:11-(index-10),col:1};
 if(index<=30)return {row:1,col:index-19};
 return {row:index-29,col:11};
}
function mulkSend(action,other={}){send({type:'mulkAction',action,...other});}
function mulkButton(label,onClick,container,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.addEventListener('click',onClick);container.append(b);return b;}
function mulkChoices(select,options){const previous=select.value;select.replaceChildren();for(const [value,label] of options){const op=document.createElement('option');op.value=String(value);op.textContent=label;select.add(op);}if(options.some(o=>String(o[0])===previous))select.value=previous;}
function renderMulk(){
 const area=byId('mulkArea');if(!roomDetail||roomDetail.game!=='mulk')return;
 const g=roomDetail.mulk,turn=!!g&&g.turn===g.mySeat,p=g?.players[g.mySeat];
 const message=byId('mulkPhase');
 message.textContent=!g?`Masa hazır • ${roomDetail.players}/${roomDetail.max} oyuncu • ${roomDetail.settings?.startCash||1500}M başlangıç`:g.finished?`🏆 Kazanan: ${g.players[g.winner]?.name||'—'}`:g.debt?`${g.players[g.debt.seat]?.name||'Oyuncu'} borcunu kapatmalı`:g.pending?.type==='auction'?'Açık artırma devam ediyor':turn?'Sıra sende!':'Sıra: '+g.players[g.turn].name;
 byId('mulkDice').textContent=g?.dice?`🎲 ${g.dice[0]} + ${g.dice[1]}`:'🎲 — —';
 const board=byId('mulkBoard');board.querySelectorAll('.mulk-square').forEach(c=>c.remove());
 byId('mulkEvents').replaceChildren();
 if(!g){const note=document.createElement('p');note.textContent='Masa sahibi oyunu başlatınca şehir tahtası ve oyuncu kontrolleri açılacak.';byId('mulkEvents').append(note);}
 else{
  for(const evt of [...g.events].reverse().slice(0,9)){const d=document.createElement('div');d.className='mulk-event';d.textContent=evt.text;byId('mulkEvents').append(d);}
  for(const sq of g.board){
   const pos=mulkPosition(sq.index),cell=document.createElement('button');cell.type='button';cell.className='mulk-square'+(sq.index===mulkSquareSelected?' selected':'');cell.style.gridColumn=String(pos.col);cell.style.gridRow=String(pos.row);
   cell.style.setProperty('--square-color',sq.color||({'rail':'#60717b','utility':'#bcb4d9','chance':'#e7af71','chest':'#b4d68f','tax':'#e5a3a3','gotojail':'#ef8e86','jail':'#a4cde1','start':'#eacc85'}[sq.type]||'#bacdc6'));
   const band=document.createElement('span');band.className='colorband';
   const label=document.createElement('span');label.className='sq-label';label.textContent=sq.name;
   const price=document.createElement('span');price.className='sq-price';price.textContent=sq.price?`${sq.price}M`:(sq.type==='tax'?`${sq.tax}M`:'');
   const tokens=document.createElement('span');tokens.className='tokens';for(let i=0;i<g.players.length;i++){const player=g.players[i];if(!player.bankrupt&&player.position===sq.index){const t=document.createElement('span');t.className='token';t.style.setProperty('--token-color',mulkColors[i%mulkColors.length]);t.title=player.name;tokens.append(t);}}
   cell.append(band,label,price,tokens);
   const owner=g.assets[sq.index]?.owner;if(owner!==undefined&&owner!==null){const chip=document.createElement('span');chip.className='owner-dot';chip.textContent=String(owner+1);chip.title=g.players[owner]?.name;cell.append(chip);}
   cell.addEventListener('click',()=>{mulkSquareSelected=sq.index;renderMulkProperty();board.querySelectorAll('.mulk-square').forEach(c=>c.classList.remove('selected'));cell.classList.add('selected');});
   board.append(cell);
  }
 }
 const people=byId('mulkPlayerList');people.replaceChildren();
 for(const [i,person] of (g?.players||roomDetail.seats||[]).entries()){
  const div=document.createElement('div');div.className='mulk-player'+(g?.turn===i?' turn':'');
  const name=document.createElement('b');name.textContent=`● ${person.name}`;name.style.color=mulkColors[i%mulkColors.length];
  const value=document.createElement('small');value.textContent=g?`${person.cash}M • ${person.bankrupt?'İFLAS':person.jailed?'HAPİSTE':'Aktif'} • ${g.board[person.position]?.name||''}`:(person.host?'Masa sahibi':'Oyuncu bekliyor');div.append(name,value);people.append(div);
 }
 const actions=byId('mulkActions');actions.replaceChildren();
 if(g&&!g.finished){
  if(g.debt?.seat===g.mySeat){const text=document.createElement('p');text.textContent=`Borcun: ${g.debt.amount}M. İpotek ederek veya takasla nakit kazan; ödeyemiyorsan iflas seç.`;actions.append(text);mulkButton('İflas Et',()=>{if(confirm('İflas edip oyundan elenmek istiyor musun?'))mulkSend('bankrupt');},actions);}
  if(turn&&!g.debt){
   if(g.phase==='roll'&&!g.pending){
    if(p.jailed){mulkButton('50M Öde, Hapisten Çık',()=>mulkSend('jailPay'),actions,p.cash<50);mulkButton('Çıkış Kartı Kullan',()=>mulkSend('jailCard'),actions,!p.jailCards);}
    mulkButton('🎲 Zar At',()=>mulkSend('roll'),actions);
   }
   if(g.pending?.type==='purchase'&&g.pending.seat===g.mySeat){
    const sq=g.board[g.pending.square],value=document.createElement('strong');value.textContent=`${sq.name} • ${sq.price}M`;actions.append(value);
    mulkButton(`Satın Al (${sq.price}M)`,()=>mulkSend('buy'),actions,p.cash<sq.price);
    mulkButton('Açık Artırmaya Çıkar',()=>mulkSend('auction'),actions);
   }
   if(g.phase==='end'&&!g.pending){mulkButton(g.extraTurn?'Çift zar: Yeniden Oyna':'Sırayı Devret',()=>mulkSend('end'),actions);}
  }
  if(g.pending?.type==='auction'){
   const a=g.pending,deadline=Math.max(0,Math.ceil((a.endsAt-Date.now())/1000));
   const caption=document.createElement('strong');caption.textContent=`🔨 ${g.board[a.square].name} • ${deadline} sn • En yüksek: ${a.high?.amount||0}M`;actions.append(caption);
   const bid=document.createElement('input');bid.className='mulk-bid-input';bid.type='number';bid.min=String(Math.max(10,(a.high?.amount||0)+1));bid.max=String(p.cash);bid.value=String(Math.max(10,(a.high?.amount||0)+10));bid.style.maxWidth='145px';bid.setAttribute('aria-label','Teklif tutarı');actions.append(bid);
   mulkButton('Teklif Ver',()=>mulkSend('bid',{amount:Number(bid.value)}),actions,p.bankrupt);
  }
 }
 renderMulkProperty();renderMulkTrade();
}
function renderMulkProperty(){
 const g=roomDetail?.mulk,details=byId('mulkSelectedDetails'),title=byId('mulkSelectedTitle'),actions=byId('mulkPropertyButtons');actions.replaceChildren();
 if(!g){title.textContent='Bir mülk seç';details.textContent='Oyun başlayınca mülklerin fiyat ve sahiplik bilgileri burada görünecek.';return;}
 const sq=g.board[mulkSquareSelected],asset=g.assets[mulkSquareSelected];if(!sq){return;}
 title.textContent=`${sq.name} • #${sq.index}`;
 details.textContent=sq.price?`Satın alma: ${sq.price}M • Sahibi: ${asset?.owner==null?'Sahipsiz':g.players[asset.owner]?.name} • Bina: ${asset?.houses===5?'Otel':asset?.houses||0} • İpotek: ${asset?.mortgaged?'Evet':'Hayır'}`:`${sq.name} • ${sq.type==='tax'?sq.tax+'M vergi':'Özel kare'}`;
 if(!asset||asset.owner!==g.mySeat||g.finished)return;
 if(asset.mortgaged){mulkButton('İpoteği Çöz',()=>mulkSend('unmortgage',{square:sq.index}),actions);return;}
 if(!asset.houses)mulkButton('İpotek Et',()=>mulkSend('mortgage',{square:sq.index}),actions);
 if(sq.type==='property'){
  if(asset.houses<5)mulkButton('Ev / Otel İnşa Et',()=>mulkSend('build',{square:sq.index}),actions);
  if(asset.houses)mulkButton('Bina Sat',()=>mulkSend('sellHouse',{square:sq.index}),actions);
 }
}
function renderMulkTrade(){
 const g=roomDetail?.mulk;if(!g)return;const mySeat=g.mySeat,me=g.players[mySeat];
 const other=g.players.map((p,i)=>[i,p.name+(p.bankrupt?' (iflas)':'')]).filter(([i])=>i!==mySeat&&!g.players[i].bankrupt);
 mulkChoices(byId('mulkTradeTo'),other);
 const to=Number(byId('mulkTradeTo').value);
 const properties=Object.keys(g.assets).map(Number);
 mulkChoices(byId('mulkTradeGive'),[[-1,'Mülk yok'],...properties.filter(x=>g.assets[x].owner===mySeat&&!g.assets[x].houses).map(x=>[x,g.board[x].name])]);
 mulkChoices(byId('mulkTradeWant'),[[-1,'Mülk yok'],...properties.filter(x=>g.assets[x].owner===to&&!g.assets[x].houses).map(x=>[x,g.board[x].name])]);
 const panel=byId('mulkTradePending');panel.replaceChildren();if(g.trade){const info=document.createElement('p');info.textContent=`${g.players[g.trade.from].name} → ${g.players[g.trade.to].name}: ${g.trade.giveCash}M + mülk / ${g.trade.wantCash}M + mülk`;panel.append(info);
  if(g.trade.to===mySeat){mulkButton('Kabul Et',()=>mulkSend('tradeAccept'),panel);mulkButton('Reddet',()=>mulkSend('tradeReject'),panel);}
  else if(g.trade.from===mySeat)mulkButton('Teklifi İptal Et',()=>mulkSend('tradeReject'),panel);
 }
 byId('mulkOffer').disabled=!!g.trade||!!me?.bankrupt;
}
byId('mulkTradeTo').addEventListener('change',()=>{if(roomDetail?.game==='mulk')renderMulkTrade();});
byId('mulkOffer').addEventListener('click',()=>mulkSend('tradeOffer',{
 to:Number(byId('mulkTradeTo').value),giveSquare:Number(byId('mulkTradeGive').value),wantSquare:Number(byId('mulkTradeWant').value),giveCash:Number(byId('mulkTradeGiveCash').value),wantCash:Number(byId('mulkTradeWantCash').value)
}));
setInterval(()=>{const g=roomDetail?.mulk;if(g?.pending?.type==='auction'&&!byId('mulkArea').hidden){const elem=byId('mulkActions')?.querySelector('strong');if(elem)elem.textContent=`🔨 ${g.board[g.pending.square].name} • ${Math.max(0,Math.ceil((g.pending.endsAt-Date.now())/1000))} sn • En yüksek: ${g.pending.high?.amount||0}M`;}},750);

// Arena Club Kızma Birader: board rendering only; rules, turn, and dice are on the server.
const ludoColors=['red','blue','yellow','green'];
const ludoLabels=['Kırmızı','Mavi','Sarı','Yeşil'];
const ludoStarts=[0,13,26,39];
const ludoFullTrack=[
  ...Array.from({length:5},(_,i)=>[6,i+1]),...Array.from({length:6},(_,i)=>[5-i,6]),[0,7],
  ...Array.from({length:6},(_,i)=>[i,8]),...Array.from({length:6},(_,i)=>[6,i+9]),[7,14],
  ...Array.from({length:6},(_,i)=>[8,14-i]),...Array.from({length:6},(_,i)=>[9+i,8]),[14,7],
  ...Array.from({length:6},(_,i)=>[14-i,6]),...Array.from({length:6},(_,i)=>[8,5-i]),[7,0],[6,0]
];
const ludoHome=[
 Array.from({length:5},(_,i)=>[7,i+1]),Array.from({length:5},(_,i)=>[i+1,7]),
 Array.from({length:5},(_,i)=>[7,13-i]),Array.from({length:5},(_,i)=>[13-i,7])
];
const ludoBase=[[[1,1],[1,4],[4,1],[4,4]],[[1,10],[1,13],[4,10],[4,13]],[[10,10],[10,13],[13,10],[13,13]],[[10,1],[10,4],[13,1],[13,4]]];
const ludoSafe=[0,8,13,21,26,34,39,47];
const ludoKey=(r,c)=>`${r},${c}`;
const ludoTrackIndex=new Map(ludoFullTrack.map(([r,c],i)=>[ludoKey(r,c),i]));
const ludoHomeIndex=new Map(ludoHome.flatMap((steps,color)=>steps.map(([r,c])=>[ludoKey(r,c),color])));
const ludoBaseIndex=new Map(ludoBase.flatMap((cells,color)=>cells.map(([r,c])=>[ludoKey(r,c),color])));
const ludoDieFaces=['⚀','⚁','⚂','⚃','⚄','⚅'];
let ludoPreviousRevision=-1;
function ludoPosition(color,pawn,number){
 if(pawn<0)return ludoBase[color][number];
 if(pawn<=50)return ludoFullTrack[(ludoStarts[color]+pawn)%52];
 if(pawn<=55)return ludoHome[color][pawn-51];
 return [7,7];
}
function renderLudo(){
 const g=roomDetail?.ludo;
 const inGame=!!g&&roomDetail.game==='ludo';
 byId('ludoRoomCode').textContent=roomDetail?.id||'—';
 const txt=byId('ludoNotice');txt.textContent=inGame?g.notice:`${roomDetail?.max||4} kişilik masa hazır. Oyuncular katılınca masa sahibi oyunu başlatabilir.`;
 byId('ludoDice').textContent=inGame&&g.lastRoll?ludoDieFaces[g.lastRoll.value-1]:'⚄';
 byId('ludoTurn').textContent=inGame?(g.finished?`🏆 ${g.players[g.winner]?.name||'Oyuncu'} kazandı!`:`SIRA • ${g.players[g.turn]?.name||'Oyuncu'}`):'Oyun başlamadı';
 byId('ludoRoll').disabled=!inGame||g.finished||g.mySeat!==g.turn||g.phase!=='roll';
 byId('ludoRoll').hidden=!inGame||g.finished;
 byId('ludoCountdown').textContent=inGame&&!g.finished?`Hamle süresi: ${Math.max(0,Math.ceil((g.deadline-Date.now())/1000))} sn`:'Oyun bekleniyor';
 const players=byId('ludoPlayers');players.replaceChildren();
 for(const [idx,p] of (g?.players||[]).entries()){
  const card=document.createElement('div');card.className=`ludo-player ludo-${ludoColors[p.color]}${idx===g.turn&&!g.finished?' is-turn':''}${idx===g.mySeat?' is-you':''}${p.forfeited?' is-out':''}`;
  const dot=document.createElement('span');dot.className='ludo-color-dot';if(p.avatar&&p.avatar.startsWith('https://')){const img=document.createElement('img');img.src=p.avatar;img.alt='';img.className='ludo-avatar';dot.append(img);}else dot.textContent='●';
  const info=document.createElement('div');const title=document.createElement('b');title.textContent=p.name+(idx===g.mySeat?' (Sen)':'');const description=document.createElement('small');description.textContent=p.forfeited?'Masadan ayrıldı':`${p.pawns.filter(x=>x===56).length}/4 bitiş • ${ludoLabels[p.color]}`;info.append(title,description);card.append(dot,info);players.append(card);
 }
 if(!g){const p=document.createElement('div');p.className='ludo-waiting';p.textContent='Oyuncular bekleniyor. Oda kodunu arkadaşlarınla paylaş.';players.append(p);}
 const pieces=new Map();
 if(g)for(const [seat,p] of g.players.entries())for(let pawn=0;pawn<4;pawn++){
  const [r,c]=ludoPosition(p.color,p.pawns[pawn],pawn),key=ludoKey(r,c);
  if(!pieces.has(key))pieces.set(key,[]);pieces.get(key).push({seat,color:p.color,pawn,canMove:seat===g.mySeat&&g.legalMoves.includes(pawn)&&!g.finished});
 }
 const board=byId('ludoBoard');board.replaceChildren();
 for(let r=0;r<15;r++)for(let c=0;c<15;c++){
  const key=ludoKey(r,c),track=ludoTrackIndex.get(key),home=ludoHomeIndex.get(key),base=ludoBaseIndex.get(key);
  const tile=document.createElement('div');tile.className='ludo-cell';
  if(track!==undefined){tile.classList.add('ludo-cell--track');if(ludoSafe.includes(track)){tile.classList.add('is-safe');tile.textContent='★';}const startColor=ludoStarts.indexOf(track);if(startColor!==-1)tile.classList.add(`start-${ludoColors[startColor]}`);}
  else if(home!==undefined)tile.classList.add('ludo-cell--lane',`lane-${ludoColors[home]}`);
  else if(base!==undefined)tile.classList.add('ludo-cell--base',`base-${ludoColors[base]}`);
  else if(r>=6&&r<=8&&c>=6&&c<=8)tile.classList.add('ludo-cell--center');
  else{const quadrant=r<=5?(c<=5?0:1):(c<=5?3:2);tile.classList.add('ludo-cell--homeground',`homeground-${ludoColors[quadrant]}`);}
  if(r===7&&c===7){tile.classList.add('ludo-cell--goal');tile.textContent='★';}
  const onCell=pieces.get(key)||[];
  if(onCell.length){const holder=document.createElement('div');holder.className='ludo-pawn-stack';for(const piece of onCell){const btn=document.createElement('button');btn.type='button';btn.className=`ludo-pawn ludo-${ludoColors[piece.color]}${piece.canMove?' playable':''}`;btn.textContent=piece.pawn+1;btn.title=`${ludoLabels[piece.color]} ${piece.pawn+1}. piyon${piece.canMove?' • Hareket ettir':''}`;btn.setAttribute('aria-label',btn.title);btn.disabled=!piece.canMove;if(piece.canMove)btn.addEventListener('click',()=>send({type:'ludoMove',pawn:piece.pawn}));holder.append(btn);}tile.append(holder);}
  board.append(tile);
 }
 const log=byId('ludoEvents');log.replaceChildren();for(const entry of [...(g?.events||[])].reverse().slice(0,8)){const e=document.createElement('p');e.textContent=entry;log.append(e);}
 if(g&&ludoPreviousRevision!==g.revision){board.classList.remove('ludo-board-update');void board.offsetWidth;board.classList.add('ludo-board-update');ludoPreviousRevision=g.revision;}
}
byId('ludoRoll').addEventListener('click',()=>send({type:'ludoRoll'}));
byId('ludoCopy').addEventListener('click',async()=>{
 const code=roomDetail?.id;if(!code)return;
 try{await navigator.clipboard.writeText(code);toast('Oda kodu kopyalandı: '+code);}
 catch{toast('Oda kodun: '+code);}
});
setInterval(()=>{if(roomDetail?.game!=='ludo'||!roomDetail.ludo||roomDetail.ludo.finished)return;
 const g=roomDetail.ludo;byId('ludoCountdown').textContent=`Hamle süresi: ${Math.max(0,Math.ceil((g.deadline-Date.now())/1000))} sn`;
 if(Date.now()>=g.deadline)byId('ludoRoll').disabled=true;
},350);
