import { randomInt, randomUUID } from 'node:crypto';

// Mülk Turu: original board, rules independently implemented for the live game server.
const colors={brown:['#845c48',50],sky:['#7dd9ed',50],pink:['#d67cb5',100],orange:['#ed9651',100],red:['#dd5a5a',150],yellow:['#efce60',150],green:['#76bd83',200],blue:['#5382dc',200]};
const boardEntries=[
 ['start','BAŞLANGIÇ'],['property','Ihlamur Sokağı','brown',60,2],['chest','Topluluk'],['property','Günışığı Sokağı','brown',60,4],['tax','Şehir Vergisi',200],['rail','Kuzey Garı',200],['property','Zambak Yolu','sky',100,6],['chance','Sürpriz'],['property','Ufuk Yolu','sky',100,6],['property','Gökkuşağı Yolu','sky',120,8],
 ['jail','Hapis / Ziyaret'],['property','Yonca Sokağı','pink',140,10],['utility','Elektrik Merkezi',150],['property','Yasemin Sokağı','pink',140,10],['property','Çınar Parkı','pink',160,12],['rail','Batı Garı',200],['property','Lal Sokağı','orange',180,14],['chest','Topluluk'],['property','Nar Sokağı','orange',180,14],['property','Portakal Caddesi','orange',200,16],
 ['parking','Serbest Otopark'],['property','Kızıl Sokak','red',220,18],['chance','Sürpriz'],['property','Akşam Caddesi','red',220,18],['property','Şafak Caddesi','red',240,20],['rail','Güney Garı',200],['property','Lale Meydanı','yellow',260,22],['property','Güneş Meydanı','yellow',260,22],['utility','Su Merkezi',150],['property','Pınar Bulvarı','yellow',280,24],
 ['gotojail','Hapse Git'],['property','Servi Bulvarı','green',300,26],['property','Orman Bulvarı','green',300,26],['chest','Topluluk'],['property','Çınar Meydanı','green',320,28],['rail','Doğu Garı',200],['chance','Sürpriz'],['property','Safir Bulvarı','blue',350,35],['tax','Lüks Vergisi',100],['property','Deniz Yolu','blue',400,50]
];
export const MULK_BOARD=boardEntries.map((v,i)=>({index:i,type:v[0],name:v[1],group:v[0]==='property'?v[2]:v[0]==='rail'?'rail':v[0]==='utility'?'utility':null,price:['property','rail','utility'].includes(v[0])?(v[0]==='property'?v[3]:v[2]):0,base:v[0]==='property'?v[4]:0,houseCost:v[0]==='property'?colors[v[2]][1]:0,color:v[0]==='property'?colors[v[2]][0]:null,tax:v[0]==='tax'?v[2]:0}));
const ownable=i=>MULK_BOARD[i]?.price>0;
function assert(x,message){if(!x)throw Error(message);}
function event(game,message){game.events.push({id:randomUUID(),text:message,time:Date.now()});if(game.events.length>25)game.events.shift();}
function groupIds(group){return MULK_BOARD.filter(c=>c.group===group).map(c=>c.index);}
const live=game=>game.players.filter(p=>!p.bankrupt);
const idxPlayer=(game,i)=>{assert(Number.isInteger(i)&&i>=0&&i<game.players.length,'Oyuncu bulunamadı.');return game.players[i];};
const active=(game,i)=>{const p=idxPlayer(game,i);assert(!p.bankrupt,'Oyuncu iflas etti.');return p;};
function groupComplete(game,seat,group){return groupIds(group).every(i=>game.assets[i].owner===seat&&!game.assets[i].mortgaged);}
function ownedCount(game,seat,group){return groupIds(group).filter(i=>game.assets[i].owner===seat&&!game.assets[i].mortgaged).length;}
export function rent(game,index,dice=7){const sq=MULK_BOARD[index],a=game.assets[index];if(!a||a.owner===null||a.mortgaged)return 0;if(sq.type==='rail')return 25*(2**(ownedCount(game,a.owner,'rail')-1));if(sq.type==='utility')return dice*(ownedCount(game,a.owner,'utility')===2?10:4);if(a.houses){return Math.round(sq.base*[1,5,15,45,80,125][a.houses]);}return sq.base*(groupComplete(game,a.owner,sq.group)?2:1);}
function debit(game,i,amount,recipient=null,description='Ödeme'){amount=Math.max(0,Math.floor(amount));const p=game.players[i];p.cash-=amount;if(recipient!==null&&!game.players[recipient].bankrupt)game.players[recipient].cash+=amount;event(game,`${p.name}: ${description} · −${amount}M${recipient!==null?` → ${game.players[recipient].name}`:''}`);if(p.cash<0){game.debt={seat:i,creditor:recipient,amount:-p.cash};event(game,`${p.name} borçta; ipotek, takas veya iflas seçeneğini kullanmalı.`);} }
function credit(game,i,amount,message){const p=game.players[i];p.cash+=amount;event(game,`${p.name}: ${message} · +${amount}M`);if(game.debt?.seat===i&&p.cash>=0)game.debt=null;}
function sendJail(game,i){const p=game.players[i];p.position=10;p.jailed=1;p.jailAttempts=0;game.pending=null;event(game,`${p.name} hapse gönderildi.`);game.extraTurn=false;}
function passGo(game,p,oldPos,next){if(next>=40){p.cash+=game.settings.salary;event(game,`${p.name} başlangıçtan geçti: +${game.settings.salary}M`);}p.position=next%40;}
function landed(game,i,dice){const p=game.players[i],sq=MULK_BOARD[p.position];event(game,`${p.name} → ${sq.name}`);if(ownable(sq.index)){
 const a=game.assets[sq.index];if(a.owner===null){game.pending={type:'purchase',seat:i,square:sq.index};return;}
 if(a.owner!==i&&!a.mortgaged){debit(game,i,rent(game,sq.index,dice),a.owner,`${sq.name} kirası`);}return;
}if(sq.type==='tax'){debit(game,i,sq.tax,null,sq.name);return;}
if(sq.type==='gotojail'){sendJail(game,i);return;}
if(sq.type==='chance'||sq.type==='chest'){
 const cards=[['credit',50,'Yarışma ödülü'],['debit',50,'Bakım masrafı'],['credit',100,'Yatırım getirisi'],['debit',100,'Şehir katkısı'],['start',0,'Başlangıca ilerle'],['jail',0,'Hapse git'],['card',0,'Hapisten çıkış kartı']];
 const [kind,n,label]=cards[randomInt(cards.length)];if(kind==='credit')credit(game,i,n,label);else if(kind==='debit')debit(game,i,n,null,label);else if(kind==='start'){p.position=0;credit(game,i,game.settings.salary,label);}else if(kind==='jail')sendJail(game,i);else if(kind==='card'){p.jailCards++;event(game,`${p.name}: ${label} kazandı.`);}return;
}}
function advance(game){if(game.finished)return;game.pending=null;game.debt=null;const n=game.players.length;for(let k=1;k<=n;k++){const next=(game.turn+k)%n;if(!game.players[next].bankrupt){game.turn=next;game.phase='roll';game.doubles=0;game.extraTurn=false;game.dice=null;event(game,`Sıra: ${game.players[next].name}`);return;}}}
function concludeMove(game){if(game.pending||game.debt||game.finished)return;game.phase='end';}
function finishAuction(game){const a=game.pending;if(a?.type!=='auction')return;const bid=a.high;if(bid&&game.players[bid.seat]?.cash>=bid.amount&&!game.players[bid.seat].bankrupt){game.assets[a.square].owner=bid.seat;debit(game,bid.seat,bid.amount,null,'Açık artırma');event(game,`${game.players[bid.seat].name} ${MULK_BOARD[a.square].name} mülkünü kazandı.`);}else event(game,'Açık artırma teklif gelmeden tamamlandı.');game.pending=null;concludeMove(game);}
export function startMulk(seats,settings={}){assert(seats.length>=2&&seats.length<=6,'Mülk Turu 2–6 kişiyle oynanır.');const game={version:1,settings:{cash:[1000,1500,2000].includes(Number(settings.cash))?Number(settings.cash):1500,salary:200,auctionSeconds:[20,30,45].includes(Number(settings.auctionSeconds))?Number(settings.auctionSeconds):30},players:seats.map((s,i)=>({name:String(s.name||`Oyuncu ${i+1}`).slice(0,20),token:s.token,cash:1500,position:0,jailed:0,jailAttempts:0,jailCards:0,bankrupt:false})),assets:Object.fromEntries(MULK_BOARD.filter(s=>ownable(s.index)).map(s=>[s.index,{owner:null,houses:0,mortgaged:false}])),turn:0,phase:'roll',pending:null,dice:null,doubles:0,extraTurn:false,debt:null,finished:false,winner:null,events:[],lastDice:7};for(const p of game.players)p.cash=game.settings.cash;event(game,'Mülk Turu başladı. Herkese eşit oyun parası dağıtıldı.');return game;}
function validateDebt(game,i,action){if(game.debt&&['roll','end','buy','auction','build'].includes(action))throw Error('Önce borcu kapat, ipotek yap veya iflas et.');}
export function actMulk(game,seat,data,now=Date.now()){
 assert(game&&!game.finished,'Aktif oyun bulunamadı.');const p=active(game,seat);const type=String(data.action||'');validateDebt(game,seat,type);
 if(type==='roll'){
  assert(game.turn===seat&&game.phase==='roll'&&!game.pending,'Şu anda zar atamazsın.');let dice=[randomInt(1,7),randomInt(1,7)];if(p.jailed){if(dice[0]===dice[1]){p.jailed=0;p.jailAttempts=0;game.doubles=0;game.extraTurn=false;event(game,`${p.name} çift zarla hapisten çıktı.`);}else{p.jailAttempts++;if(p.jailAttempts>=3){debit(game,seat,50,null,'Hapisten zorunlu çıkış');p.jailed=0;p.jailAttempts=0;}else{game.dice=dice;game.phase='end';event(game,`${p.name} hapisten çıkamadı (${p.jailAttempts}/3).`);return;}}}
  else if(dice[0]===dice[1]){game.doubles++;if(game.doubles>=3){sendJail(game,seat);game.dice=dice;game.phase='end';return;}}
  else game.doubles=0;
  game.dice=dice;game.lastDice=dice[0]+dice[1];game.extraTurn=dice[0]===dice[1]&&!p.jailed&&game.doubles>0;
  passGo(game,p,p.position,p.position+game.lastDice);landed(game,seat,game.lastDice);concludeMove(game);return;
 }
 if(type==='jailPay'||type==='jailCard'){
  assert(game.turn===seat&&game.phase==='roll'&&p.jailed,'Hapishane işlemi şu anda yapılamaz.');if(type==='jailCard'){assert(p.jailCards>0,'Hapisten çıkış kartın yok.');p.jailCards--;}else{assert(p.cash>=50,'50M paran olmalı.');debit(game,seat,50,null,'Hapisten çıkış');}p.jailed=0;p.jailAttempts=0;event(game,`${p.name} hapisten çıktı.`);return;
 }
 if(type==='buy'||type==='auction'){
  const a=game.pending;assert(a?.type==='purchase'&&a.seat===seat&&game.turn===seat,'Bu mülk için satın alma kararı beklenmiyor.');const sq=MULK_BOARD[a.square];if(type==='buy'){assert(p.cash>=sq.price,'Mülk için yeterli paran yok.');game.assets[sq.index].owner=seat;debit(game,seat,sq.price,null,`${sq.name} satın alındı`);game.pending=null;concludeMove(game);}else{game.pending={type:'auction',square:sq.index,high:null,endsAt:now+game.settings.auctionSeconds*1000};event(game,`${sq.name} açık artırmada!`);}return;
 }
 if(type==='bid'){
  const a=game.pending;assert(a?.type==='auction'&&now<a.endsAt,'Açık artırma kapandı.');const amount=Math.floor(Number(data.amount));assert(Number.isSafeInteger(amount)&&amount>=10&&amount<=p.cash&&amount>(a.high?.amount||0),'Geçersiz teklif veya yetersiz bakiye.');a.high={seat,amount};event(game,`${p.name} ${amount}M teklif verdi.`);return;
 }
 if(type==='end'){
  assert(game.turn===seat&&game.phase==='end'&&!game.pending&&!game.debt,'Tur henüz sona ermedi.');if(game.extraTurn&&!p.jailed){game.phase='roll';game.extraTurn=false;game.dice=null;event(game,`${p.name} çift zar attığı için yeniden oynuyor.`);}else advance(game);return;
 }
 if(type==='mortgage'||type==='unmortgage'){
  const index=Number(data.square),a=game.assets[index],sq=MULK_BOARD[index];assert(a?.owner===seat&&ownable(index),'Bu mülk senin değil.');if(type==='mortgage'){assert(!a.mortgaged&&!a.houses,'İpotek için mülkün üzerinde ev/otel bulunmamalı.');assert(!sq.group||sq.group==='rail'||sq.group==='utility'||groupIds(sq.group).every(x=>game.assets[x].houses===0),'Renk grubunda ev bulunuyor.');a.mortgaged=true;credit(game,seat,Math.floor(sq.price/2),`${sq.name} ipotek edildi`);}else{const cost=Math.ceil(sq.price*0.55);assert(a.mortgaged&&p.cash>=cost,'İpotek çözme için yeterli paran yok.');a.mortgaged=false;debit(game,seat,cost,null,`${sq.name} ipoteği çözüldü`);}return;
 }
 if(type==='build'||type==='sellHouse'){
  const index=Number(data.square),a=game.assets[index],sq=MULK_BOARD[index];assert(sq?.type==='property'&&a.owner===seat,'Bu arsa senin değil.');const group=groupIds(sq.group),heights=group.map(i=>game.assets[i].houses);
  if(type==='build'){assert(groupComplete(game,seat,sq.group),'Ev yapmak için renk grubunun tamamı sende ve ipoteksiz olmalı.');assert(a.houses<5,'Daha fazla inşaat yapılamaz.');assert(a.houses===Math.min(...heights),'Evler renk grubunda dengeli kurulmalı.');assert(p.cash>=sq.houseCost,'İnşaat için para yetersiz.');a.houses++;debit(game,seat,sq.houseCost,null,a.houses===5?'Otel yapımı':'Ev yapımı');}
  else{assert(a.houses>0&&a.houses===Math.max(...heights),'Evleri dengeli satmalısın.');a.houses--;credit(game,seat,Math.floor(sq.houseCost/2),'Bina satıldı');}return;
 }
 if(type==='tradeOffer'){
  const to=Number(data.to),index=Number(data.giveSquare),want=Number(data.wantSquare),cashGive=Math.floor(Number(data.giveCash||0)),cashWant=Math.floor(Number(data.wantCash||0));const receiver=active(game,to);assert(to!==seat,'Kendinle takas yapamazsın.');assert(!game.trade,'Önce mevcut takas teklifinin sonuçlanmasını bekle.');assert(Number.isSafeInteger(cashGive)&&Number.isSafeInteger(cashWant)&&cashGive>=0&&cashWant>=0&&cashGive<=p.cash&&cashWant<=receiver.cash,'Geçersiz para teklifi.');assert(index===-1||game.assets[index]?.owner===seat,'Teklifte verdiğin mülk sana ait değil.');assert(want===-1||game.assets[want]?.owner===to,'İstediğin mülk diğer oyuncuda yok.');assert(index!==-1||want!==-1||cashGive!==cashWant,'Boş takas yapılamaz.');assert([index,want].every(x=>x===-1||game.assets[x].houses===0),'Binalı mülk takas edilemez.');game.trade={from:seat,to,giveSquare:index,wantSquare:want,giveCash:cashGive,wantCash:cashWant};event(game,`${p.name}, ${receiver.name} oyuncusuna takas teklif etti.`);return;
 }
 if(type==='tradeAccept'||type==='tradeReject'){
  const t=game.trade;assert(t&&[t.from,t.to].includes(seat),'Sana ait bekleyen teklif yok.');if(type==='tradeReject'){event(game,'Takas reddedildi.');game.trade=null;return;}assert(seat===t.to,'Yalnızca alıcı takası kabul edebilir.');const from=game.players[t.from],to=game.players[t.to];assert(!from.bankrupt&&!to.bankrupt&&from.cash>=t.giveCash&&to.cash>=t.wantCash,'Takastaki bakiyeler değişti.');assert((t.giveSquare===-1||game.assets[t.giveSquare]?.owner===t.from)&&(t.wantSquare===-1||game.assets[t.wantSquare]?.owner===t.to),'Teklifteki mülk sahipleri değişti.');from.cash+=t.wantCash-t.giveCash;to.cash+=t.giveCash-t.wantCash;if(t.giveSquare>=0)game.assets[t.giveSquare].owner=t.to;if(t.wantSquare>=0)game.assets[t.wantSquare].owner=t.from;event(game,`${from.name} ve ${to.name} takas yaptı.`);game.trade=null;return;
 }
 if(type==='bankrupt'){
  assert(game.debt?.seat===seat||p.cash<0,'Yalnızca borç nedeniyle iflas edebilirsin.');bankruptMulk(game,seat,game.debt?.creditor??null);return;
 }
 throw Error('Bilinmeyen işlem.');
}
export function bankruptMulk(game,seat,creditor=null){const p=game.players[seat];if(!p||p.bankrupt)return;p.bankrupt=true;for(const [id,a] of Object.entries(game.assets)){if(a.owner===seat){a.owner=creditor!==null&&!game.players[creditor].bankrupt?creditor:null;a.houses=0;a.mortgaged=false;}}if(game.trade)game.trade=null;if(game.pending?.type==='auction'){if(game.pending.high?.seat===seat)game.pending.high=null;}else if(game.pending)game.pending=null;game.debt=null;event(game,`${p.name} iflas etti.`);if(live(game).length===1){game.finished=true;game.winner=game.players.indexOf(live(game)[0]);game.phase='finished';event(game,`Kazanan: ${game.players[game.winner].name}!`);}else if(game.turn===seat)advance(game);}
export function tickMulk(game,now=Date.now()){if(!game||game.finished)return false;if(game.pending?.type==='auction'&&now>=game.pending.endsAt){finishAuction(game);return true;}return false;}
export function viewMulk(game,seat){if(!game)return null;return {board:MULK_BOARD,settings:game.settings,players:game.players.map(({name,cash,position,jailed,jailAttempts,jailCards,bankrupt},i)=>({seat:i,name,cash,position,jailed,jailAttempts,jailCards,bankrupt})),assets:game.assets,turn:game.turn,phase:game.phase,pending:game.pending,dice:game.dice,debt:game.debt,trade:game.trade,finished:game.finished,winner:game.winner,events:game.events.slice(-15),mySeat:seat,extraTurn:game.extraTurn};}
