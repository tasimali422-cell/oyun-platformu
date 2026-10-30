/** Arena Club Ludo rules. All state mutations happen on the game server. */
import { randomInt } from 'node:crypto';

export const LUDO_COLORS = ['red','blue','yellow','green'];
export const LUDO_STARTS = [0,13,26,39];
export const LUDO_SAFE = Object.freeze([0,8,13,21,26,34,39,47]);
export const LUDO_FINISH = 56;
export const LUDO_TRACK = Object.freeze([
  ...Array.from({length:5},(_,i)=>[6,i+1]),
  ...Array.from({length:6},(_,i)=>[5-i,6]),
  [0,7],
  ...Array.from({length:6},(_,i)=>[i,8]),
  ...Array.from({length:6},(_,i)=>[6,i+9]),
  [7,14],
  ...Array.from({length:6},(_,i)=>[8,14-i]),
  ...Array.from({length:6},(_,i)=>[9+i,8]),
  [14,7],
  ...Array.from({length:6},(_,i)=>[14-i,6]),
  ...Array.from({length:6},(_,i)=>[8,5-i]),
  [7,0], [6,0]
]);
export const LUDO_HOME = Object.freeze([
 Array.from({length:5},(_,i)=>[7,i+1]),
 Array.from({length:5},(_,i)=>[i+1,7]),
 Array.from({length:5},(_,i)=>[7,13-i]),
 Array.from({length:5},(_,i)=>[13-i,7])
]);
export const LUDO_TURN_CHOICES = [15,20,30,45,60,90];

function announce(g,text){g.notice=text;g.events.push(text);if(g.events.length>12)g.events.shift();}
function current(g){return g.players[g.turn];}
function assertPlaying(g,seat,phase,now){
 if(!g || g.finished)throw Error('Aktif Kızma Birader maçı yok.');
 if(g.turn!==seat||g.players[seat]?.forfeited)throw Error('Şu anda sıra sende değil.');
 if(g.phase!==phase)throw Error(phase==='roll'?'Önce piyonunu hareket ettir.':'Önce zar at.');
 if(now>=g.deadline)throw Error('Hamle süresi doldu.');
}
export function globalSquare(color,steps){return steps>=0&&steps<=50?(LUDO_STARTS[color]+steps)%52:null;}
export function movablePawns(g,seat){
 if(!g || g.finished||g.turn!==seat||g.phase!=='move'||!Number.isInteger(g.dice))return [];
 return g.players[seat].pawns.flatMap((p,i)=>(p===-1&&g.dice===6)||(p>=0&&p<LUDO_FINISH&&p+g.dice<=LUDO_FINISH)?[i]:[]);
}
export function startLudo(seats,settings={},now=Date.now()){
 if(![2,4].includes(seats.length))throw Error('Kızma Birader yalnızca 2 veya 4 oyuncuyla oynanır.');
 const colors=seats.length===2?[0,2]:[0,1,2,3];
 const players=seats.map((s,i)=>({name:String(s.name||'Oyuncu').slice(0,20),avatar:String(s.avatar||'').slice(0,512),token:s.token,color:colors[i],pawns:[-1,-1,-1,-1],forfeited:false}));
 if(new Set(players.map(p=>p.token)).size!==players.length||players.some(p=>!p.token))throw Error('Her oyuncu için ayrı oturum gereklidir.');
 const turnSeconds=LUDO_TURN_CHOICES.includes(Number(settings.turnSeconds))?Number(settings.turnSeconds):30;
 return {players,turn:0,dice:null,phase:'roll',sixStreak:0,turnSeconds,deadline:now+turnSeconds*1000,finished:false,winner:null,notice:'Maç başladı. Kırmızı oyuncu zar atacak.',events:['Maç başladı. Kırmızı oyuncu zar atacak.'],lastRoll:null,revision:0};
}
function nextTurn(g,now){
 g.dice=null;g.sixStreak=0;g.phase='roll';
 for(let k=0;k<g.players.length;k++){
  g.turn=(g.turn+1)%g.players.length;
  if(!current(g).forfeited)break;
 }
 g.deadline=now+g.turnSeconds*1000;g.revision++;
}
function extraTurn(g,now){g.phase='roll';g.dice=null;g.deadline=now+g.turnSeconds*1000;g.revision++;}
export function rollLudo(g,seat,now=Date.now(),randomFn=randomInt){
 assertPlaying(g,seat,'roll',now);
 const value=randomFn(1,7);
 if(!Number.isInteger(value)||value<1||value>6)throw Error('Geçersiz zar kaynağı.');
 g.lastRoll={seat,value};
 if(value===6){g.sixStreak++;if(g.sixStreak===3){announce(g,`${current(g).name} üst üste üç kez 6 attı; sıra geçti.`);nextTurn(g,now);return;}}
 g.dice=value;g.phase='move';g.deadline=now+g.turnSeconds*1000;g.revision++;
 if(!movablePawns(g,seat).length){
  const player=current(g);announce(g,`${player.name} ${value} attı ama oynayabileceği piyon yok.`);
  if(value===6){extraTurn(g,now);}else nextTurn(g,now);
 }else announce(g,`${current(g).name} ${value} attı. Bir piyon seçmeli.`);
}
export function moveLudo(g,seat,pawnIndex,now=Date.now()){
 assertPlaying(g,seat,'move',now);
 if(!Number.isInteger(pawnIndex)||!movablePawns(g,seat).includes(pawnIndex))throw Error('Bu piyon zar sonucuyla hareket edemez.');
 const player=current(g),before=player.pawns[pawnIndex];
 const to=before===-1?0:before+g.dice;
 player.pawns[pawnIndex]=to;
 let captured=0;
 if(to<=50){
  const square=globalSquare(player.color,to);
  if(!LUDO_SAFE.includes(square))for(const rival of g.players){
   if(rival===player||rival.forfeited)continue;
   for(let i=0;i<4;i++)if(globalSquare(rival.color,rival.pawns[i])===square){rival.pawns[i]=-1;captured++;}
  }
 }
 const value=g.dice;
 let description=`${player.name} ${pawnIndex+1}. piyonu ${before===-1?'oyuna çıkardı':'ilerletti'}.`;
 if(captured)description+=` ${captured} rakip piyonu başlangıca gönderdi!`;
 if(to===LUDO_FINISH)description+=' Bir piyon bitişe ulaştı!';
 if(player.pawns.every(p=>p===LUDO_FINISH)){
  g.finished=true;g.winner=seat;g.phase='finished';g.dice=null;g.deadline=null;g.revision++;
  announce(g,`🏆 ${player.name} dört piyonunu bitirdi ve maçı kazandı!`);return;
 }
 announce(g,description);
 if(value===6)extraTurn(g,now);else nextTurn(g,now);
}
export function forfeitLudo(g,token,now=Date.now()){
 if(!g || g.finished)return false;
 const idx=g.players.findIndex(p=>p.token===token);if(idx<0||g.players[idx].forfeited)return false;
 g.players[idx].forfeited=true;announce(g,`${g.players[idx].name} masadan ayrıldı, oyundan çıkarıldı.`);
 const alive=g.players.map((p,i)=>!p.forfeited?i:-1).filter(i=>i>=0);
 if(alive.length===1){g.winner=alive[0];g.finished=true;g.phase='finished';g.deadline=null;g.dice=null;announce(g,`🏆 ${g.players[alive[0]].name} son kalan oyuncu olarak kazandı!`);}
 else if(g.turn===idx)nextTurn(g,now);
 else g.revision++;
 return true;
}
export function tickLudo(g,now=Date.now()){
 if(!g||g.finished||now<g.deadline)return false;
 const name=current(g).name;
 nextTurn(g,now);
 announce(g,`${name} süre içinde hamle yapmadı; sırası geçti.`);
 return true;
}
export function viewLudo(g,token){
 if(!g)return null;
 const mine=g.players.findIndex(p=>p.token===token);
 return {players:g.players.map(({name,avatar,color,pawns,forfeited})=>({name,avatar,color,pawns:[...pawns],forfeited})),mySeat:mine,turn:g.turn,phase:g.phase,dice:g.dice,lastRoll:g.lastRoll,deadline:g.deadline,turnSeconds:g.turnSeconds,finished:g.finished,winner:g.winner,notice:g.notice,events:[...g.events],legalMoves:mine>=0?movablePawns(g,mine):[],revision:g.revision};
}
