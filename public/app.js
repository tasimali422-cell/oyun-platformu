const catalog=[['tombala','Tombala','Şans & eğlence','✺','#54372d','#1c3030'],['kelime','Kelime Oyunu','Harflerin gücü','A','#284b4d','#17252b'],['101','101 Okey','Strateji & rekabet','➊','#4c392d','#182a29'],['langirt','Langırt','Hızlı maçlar','⚽','#2b4651','#18292e'],['bilardo','Bilardo','8 top • klasik','⑧','#375b48','#172d2d'],['okey','Klasik Okey','Dostluk masası','▤','#494733','#1d302a']];
const byId=id=>document.getElementById(id);const games=byId('games');
for(const [id,name,detail,symbol,a,b] of catalog){const div=document.createElement('article');div.className='game';div.style.setProperty('--bg1',a);div.style.setProperty('--bg2',b);div.innerHTML='<div class="label">OYUN SALONU</div><div class="symbol"></div><div><h3></h3><p></p></div><span class="open">↗</span>';div.querySelector('.symbol').textContent=symbol;div.querySelector('h3').textContent=name;div.querySelector('p').textContent=detail;div.addEventListener('click',()=>{byId('gameSelect').value=id;byId('createDialog').showModal();});games.append(div);}
let socket,rooms=[],joined=null,roomDetail=null,connected=false,timer,retry;
const savedName=sessionStorage.getItem('demoName')||`Oyuncu${Math.floor(Math.random()*9000+1000)}`;byId('nickname').value=savedName;
function toast(msg){const t=byId('toast');t.textContent=msg;t.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>t.classList.remove('show'),3200);}
function send(value){if(!connected)return toast('Sunucu bağlantısı yok.');socket.send(JSON.stringify(value));}
function render(){byId('roomcount').textContent=rooms.length;const holder=byId('rooms');holder.replaceChildren();if(!rooms.length){const p=document.createElement('div');p.className='empty';p.textContent='Henüz açık masa yok. İlk deneme masasını sen oluştur.';holder.append(p);return;}
for(const r of rooms){const row=document.createElement('article');row.className='room';const icon=document.createElement('span');icon.className='room-icon';icon.textContent=catalog.find(g=>g[0]===r.game)?.[3]||'✦';const info=document.createElement('div');info.className='info';const title=document.createElement('b');title.textContent=r.name;const sub=document.createElement('small');sub.textContent=`${catalog.find(g=>g[0]===r.game)?.[1]||'Oyun'} • ${r.players}/${r.max} kişi${r.started?' • Başladı':''}`;info.append(title,sub);const btn=document.createElement('button');btn.className='outline';btn.textContent=joined===r.id?'Masaya gir':r.started?'Başladı':r.players>=r.max?'Masa dolu':'Masaya katıl';btn.disabled=!connected||(r.started&&joined!==r.id)||(r.players>=r.max&&joined!==r.id);btn.addEventListener('click',()=>{if(joined===r.id){showRoom();}else send({type:'join',id:r.id});});row.append(icon,info,btn);holder.append(row);}}
function showRoom(){if(!joined||!roomDetail)return;byId('lobbyPage').hidden=true;byId('roomPage').hidden=false;byId('roomTitle').textContent=roomDetail.name;byId('roomGame').textContent=catalog.find(g=>g[0]===roomDetail.game)?.[1]||'Oyun';byId('seatCount').textContent=`${roomDetail.players}/${roomDetail.max} kişi`;
 const seats=byId('seats');seats.replaceChildren();for(let i=0;i<roomDetail.max;i++){const player=roomDetail.seats[i];const card=document.createElement('div');card.className='seat'+(player?' occupied':'');const avatar=document.createElement('span');avatar.className='seat-avatar';avatar.textContent=player?(player.name[0]||'O').toUpperCase():'+';const desc=document.createElement('div');const b=document.createElement('b');b.textContent=player?player.name:'Boş koltuk';const sm=document.createElement('small');sm.textContent=player?.host?'Masa sahibi':player?'Oyuncu':'Oyuncu bekleniyor';desc.append(b,sm);card.append(avatar,desc);seats.append(card);}
 byId('startGame').hidden=!roomDetail.host||roomDetail.started;byId('startGame').disabled=roomDetail.game==='okey'&&roomDetail.players!==4;byId('startGame').title=roomDetail.game==='okey'&&roomDetail.players!==4?'Klasik Okey için 4 oyuncu gerekli':'';byId('roomMessage').textContent=roomDetail.game==='okey'?(roomDetail.started?'Okey deneme eli aktif. Taşlarını ıstakanda sırala; sıra sendeyken taş çek veya taş at.':`Klasik Okey deneme elini başlatmak için 4 oyuncu gerekli (${roomDetail.players}/4).`):(roomDetail.started?'Deneme oturumu başladı; bu oyun için kurallar henüz eklenmedi.':'Masa hazır. Oyuncular katılabilir ve sohbet edebilir.');
 renderOkey();const feed=byId('chatMessages');feed.replaceChildren();for(const m of roomDetail.chat||[]){const line=document.createElement('div');line.className='chatline';const name=document.createElement('b');name.textContent=m.name+': ';const msg=document.createElement('span');msg.textContent=m.message;line.append(name,msg);feed.append(line);}feed.scrollTop=feed.scrollHeight;
}
function connect(){const protocol=location.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(`${protocol}//${location.host}`);socket.onopen=()=>{connected=true;byId('dot').classList.add('good');byId('connection').textContent='Canlı bağlantı';send({type:'profile',name:byId('nickname').value});};socket.onclose=()=>{connected=false;joined=null;roomDetail=null;byId('roomPage').hidden=true;byId('lobbyPage').hidden=false;byId('dot').classList.remove('good');byId('connection').textContent='Bağlanıyor...';render();clearTimeout(retry);retry=setTimeout(connect,2500);};socket.onmessage=e=>{let d;try{d=JSON.parse(e.data);}catch{return;}if(d.type==='state'){rooms=d.rooms;byId('online').textContent=d.online;render();}else if(d.type==='joined'){joined=d.room;toast('Masaya katıldın.');render();}else if(d.type==='room'){roomDetail=d;joined=d.id;showRoom();}else if(d.type==='left'){joined=null;roomDetail=null;byId('roomPage').hidden=true;byId('lobbyPage').hidden=false;toast('Masadan ayrıldın.');render();}else if(d.type==='error')toast(d.message);};}
byId('openCreate').addEventListener('click',()=>byId('createDialog').showModal());byId('closeDialog').addEventListener('click',()=>byId('createDialog').close());byId('createForm').addEventListener('submit',e=>{e.preventDefault();send({type:'create',game:byId('gameSelect').value,name:byId('roomName').value});byId('createDialog').close();byId('roomName').value='';});
byId('leaveRoom').addEventListener('click',()=>send({type:'leave'}));byId('startGame').addEventListener('click',()=>send({type:'start'}));byId('chatForm').addEventListener('submit',e=>{e.preventDefault();const input=byId('chatInput');if(!input.value.trim())return;send({type:'chat',message:input.value});input.value='';});byId('nickname').addEventListener('change',()=>{const name=byId('nickname').value.trim().slice(0,20)||'Misafir';byId('nickname').value=name;sessionStorage.setItem('demoName',name);send({type:'profile',name});});connect();

// v0.3.1: Local rack ordering, independent from the authoritative discard action.
let rackOrder=[], selectedTile=null, lastRoomKey=null;
const actionBar=byId('okeyArea').querySelector('.okey-actions');
const discardButton=document.createElement('button');discardButton.id='discardSelected';discardButton.className='primary';discardButton.type='button';discardButton.textContent='Seçili taşı at';actionBar.append(discardButton);
const sortingTip=document.createElement('small');sortingTip.className='tile-help';sortingTip.textContent='Taşları sürükleyerek diz veya önce bir taşa, sonra yerleştireceğin taşa dokun. Taş atmak için ayrıca “Seçili taşı at” düğmesini kullan.';byId('myTiles').after(sortingTip);
function reorderLocal(id,beforeId){
 if(id===beforeId)return;
 const updated=rackOrder.filter(v=>v!==id);const to=updated.indexOf(beforeId);
 if(to<0)updated.push(id);else updated.splice(to,0,id);
 rackOrder=updated;renderOkey();
}
function renderOkey(){
 const el=byId('okeyArea');const state=roomDetail?.gameState;
 el.hidden=roomDetail?.game!=='okey'||!state;
 if(el.hidden){selectedTile=null;lastRoomKey=null;return;}
 const key=roomDetail.id;if(lastRoomKey!==key){rackOrder=[];selectedTile=null;lastRoomKey=key;}
 const ids=new Set(state.hand.map(t=>t.id));rackOrder=rackOrder.filter(id=>ids.has(id));for(const t of state.hand)if(!rackOrder.includes(t.id))rackOrder.push(t.id);
 if(selectedTile&&!ids.has(selectedTile))selectedTile=null;
 const mine=state.turn===state.mySeat;const canDraw=mine&&state.phase==='draw'&&state.roundStatus==='playing';const canDiscard=mine&&state.phase==='discard'&&state.roundStatus==='playing';
 byId('okeyStatus').textContent=`${state.notice} • ${mine?'SIRA SENDE':'Rakibin sırası'} • Ortada ${state.wall} taş`;
 byId('drawWall').disabled=!canDraw||state.wall===0;
 byId('drawDiscard').disabled=!canDraw||state.discard.length===0;
 discardButton.disabled=!canDiscard||!selectedTile;
 const holder=byId('myTiles');holder.replaceChildren();const tiles=new Map(state.hand.map(t=>[t.id,t]));
 for(const id of rackOrder){const tile=tiles.get(id);if(!tile)continue;
  const b=document.createElement('button');b.type='button';b.className='okey-tile color'+tile.color+(id===selectedTile?' selected':'');b.textContent=tile.color===4?'★':String(tile.n);b.title='Taşı seç veya yerini değiştir';b.draggable=true;
  b.addEventListener('click',()=>{if(selectedTile&&selectedTile!==id){reorderLocal(selectedTile,id);selectedTile=null;}else{selectedTile=selectedTile===id?null:id;}renderOkey();});
  b.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';});
  b.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';});
  b.addEventListener('drop',e=>{e.preventDefault();const dragged=e.dataTransfer.getData('text/plain');if(ids.has(dragged)){reorderLocal(dragged,id);selectedTile=null;renderOkey();}});
  holder.append(b);
 }
}
discardButton.addEventListener('click',()=>{if(!selectedTile)return;send({type:'discard',id:selectedTile});selectedTile=null;});
byId('drawWall').addEventListener('click',()=>send({type:'draw',source:'wall'}));
byId('drawDiscard').addEventListener('click',()=>send({type:'draw',source:'discard'}));
