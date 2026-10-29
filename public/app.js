const catalog=[['tombala','Tombala','Şans & eğlence','✺','#54372d','#1c3030'],['kelime','Kelime Oyunu','Harflerin gücü','A','#284b4d','#17252b'],['101','101 Okey','Strateji & rekabet','➊','#4c392d','#182a29'],['langirt','Langırt','Hızlı maçlar','⚽','#2b4651','#18292e'],['bilardo','Bilardo','8 top • klasik','⑧','#375b48','#172d2d'],['okey','Klasik Okey','Dostluk masası','▤','#494733','#1d302a']];
const byId=id=>document.getElementById(id);const games=byId('games');
for(const [id,name,detail,symbol,a,b] of catalog){const div=document.createElement('article');div.className='game';div.style.setProperty('--bg1',a);div.style.setProperty('--bg2',b);div.innerHTML='<div class="label">OYUN SALONU</div><div class="symbol"></div><div><h3></h3><p></p></div><span class="open">↗</span>';div.querySelector('.symbol').textContent=symbol;div.querySelector('h3').textContent=name;div.querySelector('p').textContent=detail;div.addEventListener('click',()=>{byId('gameSelect').value=id;byId('createDialog').showModal();});games.append(div);}
let socket,rooms=[],joined=null,roomDetail=null,connected=false,timer,retry;
const identityKey='oyun_platformu_session';let reconnecting=false;
const savedName=sessionStorage.getItem('demoName')||`Oyuncu${Math.floor(Math.random()*9000+1000)}`;byId('nickname').value=savedName;
function toast(msg){const t=byId('toast');t.textContent=msg;t.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>t.classList.remove('show'),3200);}
function send(value){if(!connected)return toast('Bağlantı kesildi; yeniden bağlanıyor...');socket.send(JSON.stringify(value));}
function render(){byId('roomcount').textContent=rooms.length;const holder=byId('rooms');holder.replaceChildren();if(!rooms.length){const p=document.createElement('div');p.className='empty';p.textContent='Henüz açık masa yok. İlk deneme masasını sen oluştur.';holder.append(p);return;}
for(const r of rooms){const row=document.createElement('article');row.className='room';const icon=document.createElement('span');icon.className='room-icon';icon.textContent=catalog.find(g=>g[0]===r.game)?.[3]||'✦';const info=document.createElement('div');info.className='info';const title=document.createElement('b');title.textContent=r.name;const sub=document.createElement('small');sub.textContent=`${catalog.find(g=>g[0]===r.game)?.[1]||'Oyun'} • ${r.players}/${r.max} kişi${r.game==='tombala'?' • '+Math.round((r.settings?.drawInterval||30000)/1000)+' sn • Kart '+(r.settings?.ticketCost??100)+' puan':''}${r.started?' • Başladı':''}`;info.append(title,sub);const btn=document.createElement('button');btn.className='outline';btn.textContent=joined===r.id?'Masaya gir':r.started?'Başladı':r.players>=r.max?'Masa dolu':'Masaya katıl';btn.disabled=!connected||(r.started&&joined!==r.id)||(r.players>=r.max&&joined!==r.id);btn.addEventListener('click',()=>{if(joined===r.id){showRoom();}else send({type:'join',id:r.id});});row.append(icon,info,btn);holder.append(row);}}
function showRoom(){if(!joined||!roomDetail)return;byId('mobileChatToggle').hidden=roomDetail.game!=='tombala';byId('lobbyPage').hidden=true;byId('roomPage').hidden=false;byId('roomTitle').textContent=roomDetail.name;byId('roomGame').textContent=catalog.find(g=>g[0]===roomDetail.game)?.[1]||'Oyun';byId('seatCount').textContent=`${roomDetail.players}/${roomDetail.max} kişi`;byId('roomPage').classList.toggle('tombala-room',roomDetail.game==='tombala');byId('roomPage').classList.toggle('okey-room',roomDetail.game==='okey');
 const seats=byId('seats');seats.replaceChildren();for(let i=0;i<(roomDetail.game==='tombala'?roomDetail.seats.length:roomDetail.max);i++){const player=roomDetail.seats[i];const card=document.createElement('div');card.className='seat'+(player?' occupied':'');const avatar=document.createElement('span');avatar.className='seat-avatar';avatar.textContent=player?(player.name[0]||'O').toUpperCase():'+';const desc=document.createElement('div');const b=document.createElement('b');b.textContent=player?player.name+(player.online===false?' (bağlantı kesildi)':''):'Boş koltuk';const sm=document.createElement('small');sm.textContent=player?.host?'Masa sahibi':player?'Oyuncu':'Oyuncu bekleniyor';desc.append(b,sm);card.append(avatar,desc);seats.append(card);}
 byId('startGame').hidden=!roomDetail.host||roomDetail.started;byId('startGame').disabled=roomDetail.game==='okey'&&roomDetail.players!==4;byId('startGame').title=roomDetail.game==='okey'&&roomDetail.players!==4?'Klasik Okey için 4 oyuncu gerekli':'';byId('roomMessage').textContent=roomDetail.game==='tombala'?'Sayıları kartlarında 30 saniye içinde işaretle. Çekiliş sonucu sunucuda doğrulanır.':roomDetail.finalResult?'Maç sona erdi. Final puanları uygulandı.':roomDetail.game==='okey'?(roomDetail.started?'Okey deneme eli aktif. Taşlarını ıstakanda sırala; sıra sendeyken taş çek veya taş at.':`Klasik Okey deneme elini başlatmak için 4 oyuncu gerekli (${roomDetail.players}/4).`):(roomDetail.started?'Deneme oturumu başladı; bu oyun için kurallar henüz eklenmedi.':'Masa hazır. Oyuncular katılabilir ve sohbet edebilir.');
 byId('tombalaArea').hidden=roomDetail.game!=='tombala';if(roomDetail.game==='tombala')renderTombala();byId('tombalaRules').textContent=roomDetail.game==='tombala'?`Çekiliş: ${Math.round((roomDetail.settings?.drawInterval||30000)/1000)} saniye • Oyuncu: ${roomDetail.max} • Kart: ${roomDetail.settings?.ticketCost??100} puan • 1. Çinko: ${roomDetail.settings?.prize1??500} • 2. Çinko: ${roomDetail.settings?.prize2??1000} • Tombala: ${roomDetail.settings?.prize3??2500} (tanıtım puanları; bakiye işlemi henüz aktif değil)`:'';byId('tableSettings').textContent=roomDetail.game==='okey'?`Başlangıç: 0 • Eksi limit: -${roomDetail.settings?.lossLimit||20} • Gösterge cezası: ${roomDetail.settings?.showIndicator?'açık':'kapalı'} • Puanlar: ${(roomDetail.scores||[0,0,0,0]).join(' / ')}`:'';renderOkey();const feed=byId('chatMessages');feed.replaceChildren();for(const m of roomDetail.chat||[]){const line=document.createElement('div');line.className='chatline';const name=document.createElement('b');name.textContent=m.name+': ';const msg=document.createElement('span');msg.textContent=m.message;line.append(name,msg);feed.append(line);}feed.scrollTop=feed.scrollHeight;
}
function connect(){const protocol=location.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(`${protocol}//${location.host}`);socket.onopen=()=>{connected=true;byId('dot').classList.add('good');byId('connection').textContent='Canlı bağlantı';const token=sessionStorage.getItem(identityKey)||crypto.randomUUID();sessionStorage.setItem(identityKey,token);send({type:'resume',token});send({type:'profile',name:byId('nickname').value});};socket.onclose=()=>{connected=false;reconnecting=true;byId('dot').classList.remove('good');byId('connection').textContent='Bağlanıyor...';render();clearTimeout(retry);retry=setTimeout(connect,2500);};socket.onmessage=e=>{let d;try{d=JSON.parse(e.data);}catch{return;}if(d.type==='state'){rooms=d.rooms;byId('online').textContent=d.online;render();}else if(d.type==='session'){sessionStorage.setItem(identityKey,d.token);}else if(d.type==='resumed'){reconnecting=false;if(d.room){joined=d.room;}else{joined=null;roomDetail=null;byId('roomPage').hidden=true;byId('lobbyPage').hidden=false;}}else if(d.type==='joined'){joined=d.room;toast('Masaya katıldın.');render();}else if(d.type==='room'){roomDetail=d;joined=d.id;showRoom();}else if(d.type==='left'){joined=null;roomDetail=null;byId('roomPage').hidden=true;byId('lobbyPage').hidden=false;toast('Masadan ayrıldın.');render();}else if(d.type==='error')toast(d.message);};}
byId('openCreate').addEventListener('click',()=>byId('createDialog').showModal());byId('closeDialog').addEventListener('click',()=>byId('createDialog').close());byId('createForm').addEventListener('submit',e=>{e.preventDefault();send({type:'create',game:byId('gameSelect').value,name:byId('roomName').value,startPoints:Number(byId('startingScore').value),showIndicator:byId('indicatorEnabled').checked,turnSeconds:Number(byId('turnSeconds').value),drawInterval:Number(byId('drawInterval').value),maxPlayers:Number(byId('maxPlayers').value),ticketCost:Number(byId('ticketCost').value),prize1:Number(byId('prize1').value),prize2:Number(byId('prize2').value),prize3:Number(byId('prize3').value),ticketCount:1,auto:true});byId('createDialog').close();byId('roomName').value='';});
byId('leaveRoom').addEventListener('click',()=>send({type:'leave'}));byId('startGame').addEventListener('click',()=>send({type:'start'}));byId('chatForm').addEventListener('submit',e=>{e.preventDefault();const input=byId('chatInput');if(!input.value.trim())return;send({type:'chat',message:input.value});input.value='';});byId('nickname').addEventListener('change',()=>{const name=byId('nickname').value.trim().slice(0,20)||'Misafir';byId('nickname').value=name;sessionStorage.setItem('demoName',name);send({type:'profile',name});});connect();

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
 const section=(label,tiles)=>{const div=document.createElement('div');div.className='table-pile';const title=document.createElement('strong');title.textContent=label;div.append(title);for(const t of tiles){const span=document.createElement('span');span.className='mini-tile color'+t.color;span.textContent=t.color===4?'★':t.n;div.append(span);}tableTiles.append(div);};
 section(`ÇEKİLECEK TAŞLAR • ${g.wall}`,[]);section('GÖSTERGE',g.indicator?[g.indicator]:[]);
 for(let i=0;i<4;i++)section(`${i+1}. oyuncunun attıkları`,g.discardBySeat?.[i]||[]);
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
function syncRoomSettingFields(){const isTombala=byId('gameSelect').value==='tombala';byId('tombalaRoomSettings').hidden=!isTombala;byId('tombalaIntervalRow').hidden=!isTombala;}
byId('gameSelect').addEventListener('change',syncRoomSettingFields);syncRoomSettingFields();

// Responsive Tombala chat drawer: cards remain visible when chat is closed.
const chatToggle=byId('mobileChatToggle'),chatClose=byId('mobileChatClose'),chatPane=document.querySelector('.table-chat');
chatToggle.addEventListener('click',()=>{chatPane.classList.toggle('chat-open');byId('chatInput').focus();});
chatClose.addEventListener('click',()=>chatPane.classList.remove('chat-open'));
