// Arena Club 101 Okey engine: original supplied 101okey-coolify rules,
// adapted to Arena Club authenticated seats (no separate rooms/accounts).
import crypto from 'node:crypto';
import {createTileSet, jokerFace, isWild, tilePoints, validateMeld, evaluateOpening, canOpenWithPairs} from './rules.js';
const newId=()=>crypto.randomUUID();
const fail=s=>{throw new Error(s);};
const player=(match,id)=>match.players.find(x=>x.id===id);
const hand=(match,id)=>match.game.hands[id]||fail('Bu oyunda koltuğun yok.');
const choose=(tiles,ids)=>{
  if(!Array.isArray(ids)||ids.length===0||ids.length>tiles.length||new Set(ids).size!==ids.length)fail('Taş seçimi geçersiz.');
  return ids.map(id=>tiles.find(t=>t.id===id)||fail('Bu taş elinde yok.'));
};
const take=(tiles,ids)=>tiles.filter(t=>!new Set(ids).has(t.id));
const randomShuffle=arr=>{for(let i=arr.length-1;i>0;i--){const j=crypto.randomInt(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;};
function startRound(match){
  let tiles=randomShuffle(createTileSet());
  const idx=tiles.findIndex(t=>t.kind==='normal');
  const [indicator]=tiles.splice(idx,1);
  const hands=Object.fromEntries(match.players.map(p=>[p.id,[]]));
  for(let n=0;n<22;n++)hands[match.players[match.dealerSeat].id].push(tiles.pop());
  for(let offset=1;offset<4;offset++)for(let n=0;n<21;n++)hands[match.players[(match.dealerSeat+offset)%4].id].push(tiles.pop());
  for(const p of match.players)p.opened=false;
  match.phase='playing';
  match.game={roundPhase:'playing',currentSeat:match.dealerSeat,turnPhase:'discard',indicator,okey:jokerFace(indicator),drawPile:tiles,discardPile:[],hands,melds:[],pairs:[],result:null,nextDealerSeat:null,turnNumber:1,lastMove:{type:"start",playerId:match.players[match.dealerSeat].id},lastDiscardBySeat:{}};
}
export function newMatch(seats,{rounds=1}={}){
 if(!Array.isArray(seats)||seats.length!==4||new Set(seats.map(s=>s.id)).size!==4)fail('101 Okey için dört ayrı oyuncu gerekli.');
 if(![1,3,5,7,9,11].includes(rounds))fail('El sayısı geçersiz.');
 const match={id:newId(),phase:'waiting',rounds,roundNo:1,dealerSeat:0,hostId:seats[0].id,players:seats.map(s=>({id:s.id,name:s.name,score:0,opened:false})),game:null,createdAt:Date.now(),revision:0};
 startRound(match);return match;
}
function settle(match,winnerId=null,finishTile=null,reason='El tamamlandı'){
 const g=match.game;if(g.roundPhase!=='playing')return;
 const scores=match.players.map((p,seat)=>{
  const delta=p.id===winnerId?(finishTile&&isWild(finishTile,g.indicator)?-202:-101):!p.opened?202:hand(match,p.id).reduce((n,t)=>n+tilePoints(t,g.indicator),0);
  p.score+=delta;return {seat,userId:p.id,name:p.name,delta,total:p.score};
 });
 g.result={winnerId,winnerName:match.players.find(p=>p.id===winnerId)?.name||null,reason,scores};
 g.nextDealerSeat=(match.dealerSeat+1)%4;
 g.roundPhase='roundOver';g.turnPhase='over';
 match.phase=match.roundNo>=match.rounds?'finished':'roundOver';
}
export function action(match,userId,d){
 if(!match||!player(match,userId))fail('Bu maçın oyuncusu değilsin.');
 if(d.action==='next_round'){
  if(match.phase!=='roundOver')fail('Sonraki ele henüz geçilemez.');
  if(match.hostId!==userId)fail('Yeni eli yalnız masa sahibi başlatabilir.');
  match.dealerSeat=match.game.nextDealerSeat;match.roundNo++;startRound(match);match.revision++;return match;
 }
 const g=match.game;
 if(!g||match.phase!=='playing'||g.roundPhase!=='playing')fail('Oyun şu an aktif değil.');
 if(match.players[g.currentSeat].id!==userId)fail('Şu anda sıra sende değil.');
 const h=hand(match,userId),me=player(match,userId);
 if(d.action==='draw'){
  if(g.turnPhase!=='draw')fail('Önce taş atmalısın.');
  if(d.source==='discard'){
   if(!g.discardPile.length)fail('Yerde taş yok.');h.push(g.discardPile.pop());g.lastMove={type:'draw_discard',playerId:userId};
  }else if(d.source==='wall'){
   if(!g.drawPile.length){settle(match,null,null,'Deste tükendi');}
   else{h.push(g.drawPile.pop());g.lastMove={type:'draw_wall',playerId:userId};}
  }else fail('Taş çekme kaynağı geçersiz.');
  if(match.phase==='playing')g.turnPhase='discard';
 }else if(d.action==='discard'){
  if(g.turnPhase!=='discard')fail('Önce taş çekmelisin.');
  const tile=h.find(t=>t.id===d.tileId);if(!tile)fail('Atacağın taş elinde yok.');
  g.hands[userId]=h.filter(t=>t.id!==tile.id);g.discardPile.push(tile);g.lastDiscardBySeat[g.currentSeat]=tile;g.lastMove={type:'discard',playerId:userId,seat:g.currentSeat,face:tile};
  if(!g.hands[userId].length)settle(match,userId,tile,'Oyuncu elini bitirdi');
  else{g.currentSeat=(g.currentSeat+1)%4;g.turnPhase='draw';g.turnNumber=(g.turnNumber||1)+1;}
 }else if(d.action==='open'){
  if(g.turnPhase!=='discard'||me.opened)fail('Şu anda el açamazsın.');
  if(d.pairOpening===true){const tiles=choose(h,d.tileIds);if(!canOpenWithPairs(tiles,g.indicator))fail('Beş çift için 10 uygun taş seçmelisin.');g.pairs.push({id:newId(),ownerId:userId,tiles});g.hands[userId]=take(h,d.tileIds);
  }else{
   if(!Array.isArray(d.groups)||!d.groups.length||d.groups.length>12||d.groups.some(a=>!Array.isArray(a)))fail('Per listesi geçersiz.');
   const all=d.groups.flat();if(new Set(all).size!==all.length)fail('Bir taş birden fazla gruba girmez.');
   const groups=d.groups.map(ids=>choose(h,ids));const test=evaluateOpening(groups,g.indicator);if(!test.valid)fail(test.reason);
   for(const tiles of groups)g.melds.push({id:newId(),ownerId:userId,tiles});g.hands[userId]=take(h,all);
  }
  me.opened=true;g.lastMove={type:'open',playerId:userId};if(!g.hands[userId].length)settle(match,userId,null,'Oyuncu açarak bitirdi');
 }else if(d.action==='add_to_meld'){
  if(g.turnPhase!=='discard'||!me.opened)fail('Önce el açmalısın.');
  const meld=g.melds.find(x=>x.id===d.meldId);if(!meld)fail('Per bulunamadı.');
  const tiles=choose(h,d.tileIds);if(!validateMeld([...meld.tiles,...tiles],g.indicator).valid)fail('Bu taşlar bu pere eklenemez.');
  meld.tiles.push(...tiles);g.hands[userId]=take(h,d.tileIds);g.lastMove={type:'add',playerId:userId};
  if(!g.hands[userId].length)settle(match,userId,null,'Oyuncu per ekleyerek bitirdi');
 }else fail('Bu 101 Okey hamlesi tanınmıyor.');
 match.revision++;return match;
}
export function view(match,viewerId){
 const seat=match.players.findIndex(x=>x.id===viewerId),g=match.game;
 return {id:match.id,phase:match.phase,roundNo:match.roundNo,rounds:match.rounds,revision:match.revision,selfSeat:seat,isHost:match.hostId===viewerId,
  players:match.players.map((p,i)=>({id:p.id,seat:i,name:p.name,score:p.score,opened:p.opened,handCount:g.hands[p.id].length})),
  game:{roundPhase:g.roundPhase,currentSeat:g.currentSeat,turnPhase:g.turnPhase,indicator:g.indicator,okey:g.okey,drawCount:g.drawPile.length,discardTop:g.discardPile.at(-1)||null,turnNumber:g.turnNumber||1,lastMove:g.lastMove||null,lastDiscardBySeat:g.lastDiscardBySeat||{},melds:g.melds,pairs:g.pairs,hand:seat>=0?g.hands[viewerId]:[],result:g.result}};
}
