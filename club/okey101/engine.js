import crypto from 'node:crypto';
import {createTileSet,jokerFace,isWild,tilePoints,resolveMeld,evaluateOpening,canOpenWithPairs,tileHints,replacementFor} from './rules.js';
const newId=()=>crypto.randomUUID();const fail=s=>{throw Error(s);};
const player=(match,id)=>match.players.find(p=>p.id===id);
const hand=(match,id)=>match.game.hands[id]||fail('Bu oyunda koltuğun yok.');
const choose=(tiles,ids)=>{if(!Array.isArray(ids)||!ids.length||ids.length>tiles.length||new Set(ids).size!==ids.length)fail('Taş seçimi geçersiz.');return ids.map(id=>tiles.find(t=>t.id===id)||fail('Bu taş elinde yok.'));};
const take=(tiles,ids)=>tiles.filter(t=>!new Set(ids).has(t.id));
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
function startRound(match){const tiles=shuffle(createTileSet()),index=tiles.findIndex(t=>t.kind==='normal'),[indicator]=tiles.splice(index,1);const hands=Object.fromEntries(match.players.map(p=>[p.id,[]]));
 for(let n=0;n<22;n++)hands[match.players[match.dealerSeat].id].push(tiles.pop());for(let offset=1;offset<4;offset++)for(let n=0;n<21;n++)hands[match.players[(match.dealerSeat+offset)%4].id].push(tiles.pop());
 for(const p of match.players)p.opened=false;match.phase='playing';match.game={roundPhase:'playing',currentSeat:match.dealerSeat,turnPhase:'discard',indicator,okey:jokerFace(indicator),drawPile:tiles,discardPile:[],hands,melds:[],pairs:[],result:null,nextDealerSeat:null,turnNumber:1,lastMove:{type:'start',playerId:match.players[match.dealerSeat].id},lastDiscardBySeat:{},pendingPenalty:[],turnDrawnDiscardId:null};
}
export function newMatch(seats,{rounds=1}={}){if(!Array.isArray(seats)||seats.length!==4||new Set(seats.map(s=>s.id)).size!==4)fail('101 Okey için dört ayrı oyuncu gerekli.');if(![1,3,5,7,9,11].includes(rounds))fail('El sayısı geçersiz.');const match={id:newId(),phase:'waiting',rounds,roundNo:1,dealerSeat:0,hostId:seats[0].id,players:seats.map(s=>({id:s.id,name:s.name,score:0,opened:false})),game:null,createdAt:Date.now(),revision:0};startRound(match);return match;}
function endRound(match,winnerId=null,finishTile=null,reason='El tamamlandı'){const g=match.game;if(g.roundPhase!=='playing')return;
 const jokerFinish=Boolean(finishTile&&isWild(finishTile,g.indicator));
 const nobodyElseOpened=Boolean(winnerId)&&match.players.filter(p=>p.id!==winnerId).every(p=>!p.opened);
 const scores=match.players.map((p,seat)=>{let delta;if(p.id===winnerId)delta=jokerFinish?-202:-101;else if(!p.opened)delta=winnerId?(jokerFinish&&nobodyElseOpened?404:202):101;else delta=hand(match,p.id).reduce((n,t)=>n+tilePoints(t,g.indicator),0)*(jokerFinish?2:1);p.score+=delta;return {seat,userId:p.id,name:p.name,delta,total:p.score};});
 g.result={winnerId,winnerName:match.players.find(p=>p.id===winnerId)?.name||null,reason,scores,jokerFinish};g.nextDealerSeat=(match.dealerSeat+1)%4;g.roundPhase='roundOver';g.turnPhase='over';match.phase=match.roundNo>=match.rounds?'finished':'roundOver';
}
function openGroups(match,userId,groups,require101){const g=match.game,h=hand(match,userId);
 if(!Array.isArray(groups)||!groups.length||groups.length>12||groups.some(x=>!Array.isArray(x)))fail('Per listesi geçersiz.');const all=groups.flat();if(new Set(all).size!==all.length)fail('Bir taş birden fazla gruba girmez.');const tiles=groups.map(ids=>choose(h,ids));const check=require101?evaluateOpening(tiles,g.indicator):{valid:true};if(!check.valid)fail(check.reason);
 const normalized=tiles.map(group=>({tiles:group,info:resolveMeld(group,g.indicator)}));for(const x of normalized)if(!x.info.valid)fail(x.info.reason);
 if(h.length-all.length<1)fail('Bitirmek için elinde son atılacak bir taş kalmalı.');
 for(const x of normalized)g.melds.push({id:newId(),ownerId:userId,tiles:x.tiles,represented:x.info.represented,type:x.info.type});g.hands[userId]=take(h,all);return {ids:all,score:check.score||0};
}
export function action(match,userId,d){if(!match||!player(match,userId))fail('Bu maçın oyuncusu değilsin.');if(d.action==='next_round'){if(match.phase!=='roundOver')fail('Sonraki ele henüz geçilemez.');if(match.hostId!==userId)fail('Yeni eli yalnız masa sahibi başlatabilir.');match.dealerSeat=match.game.nextDealerSeat;match.roundNo++;startRound(match);match.revision++;return match;}
 const g=match.game;if(!g||match.phase!=='playing'||g.roundPhase!=='playing')fail('Oyun şu an aktif değil.');if(match.players[g.currentSeat].id!==userId)fail('Şu anda sıra sende değil.');const h=hand(match,userId),me=player(match,userId);g.lastDiscardBySeat ||= {};g.pendingPenalty ||= [];const indicator=g.indicator;
 if(d.action==='draw'){
  if(g.turnPhase!=='draw')fail('Şimdi taş çekemezsin.');
  if(d.source==='wall'){if(!g.drawPile.length)endRound(match,null,null,'Deste tükendi');else{h.push(g.drawPile.pop());g.lastMove={type:'draw_wall',playerId:userId};} }
  else if(d.source==='discard'){
   if(!g.discardPile.length)fail('Yerde taş yok.');const picked=g.discardPile.at(-1);
   if(!me.opened){
    if(!Array.isArray(d.groups)||!d.groups.length)fail('Yerden taş almak için 101 açacağın perleri hazırla. Taş çekmek için desteyi kullanabilirsin.');
    const proposed=[...h,picked],ids=d.groups.flat(),tiles=d.groups.map(group=>choose(proposed,group));
    const valid=ids.includes(picked.id)&&new Set(ids).size===ids.length&&evaluateOpening(tiles,indicator).valid&&proposed.length-ids.length>=1;
    if(!valid){me.score+=101;g.pendingPenalty.push({id:newId(),userId,points:101,reason:'Yerden taş alıp 101 açamama'});if(g.drawPile.length)h.push(g.drawPile.pop());else endRound(match,null,null,'Deste tükendi');g.lastMove={type:'failed_discard_draw',playerId:userId,penalty:101};}
    else{g.discardPile.pop();h.push(picked);openGroups(match,userId,d.groups,true);me.opened=true;g.lastMove={type:'draw_open',playerId:userId};}
   }else{g.discardPile.pop();h.push(picked);g.lastMove={type:'draw_discard',playerId:userId};}
  }else fail('Taş çekme kaynağı geçersiz.');
  if(match.phase==='playing')g.turnPhase='discard';
 }else if(d.action==='discard'){
  if(g.turnPhase!=='discard')fail('Önce taş çekmelisin.');const tile=h.find(t=>t.id===d.tileId);if(!tile)fail('Atacağın taş elinde yok.');
  const hints=tileHints([tile],g.melds,indicator);const punish=Boolean(hints[tile.id]);if(punish){me.score+=101;g.pendingPenalty.push({id:newId(),userId,points:101,reason:'İşlek taş atma'});}
  g.hands[userId]=h.filter(t=>t.id!==tile.id);g.discardPile.push(tile);g.lastDiscardBySeat[g.currentSeat]=tile;g.lastMove={type:'discard',playerId:userId,seat:g.currentSeat,face:tile,penalty:punish?101:0};
  if(!g.hands[userId].length)endRound(match,userId,tile,'Oyuncu son taşı atarak bitirdi');else{g.currentSeat=(g.currentSeat+1)%4;g.turnPhase='draw';g.turnNumber=(g.turnNumber||1)+1;}
 }else if(d.action==='open'){
  if(g.turnPhase!=='discard'||me.opened)fail('Şu anda 101 ile açamazsın.');
  if(d.pairOpening===true){const tiles=choose(h,d.tileIds);if(!canOpenWithPairs(tiles,indicator))fail('Beş çift için 10 uygun taş seçmelisin.');if(h.length-tiles.length<1)fail('Son atılacak taş kalmalı.');g.pairs.push({id:newId(),ownerId:userId,tiles});g.hands[userId]=take(h,d.tileIds);}
  else openGroups(match,userId,d.groups,true);
  me.opened=true;g.lastMove={type:'open',playerId:userId};
 }else if(d.action==='lay_melds'){
  if(g.turnPhase!=='discard'||!me.opened)fail('Yeni per açmak için önce 101 veya çift açmış olmalısın.');openGroups(match,userId,d.groups,false);g.lastMove={type:'lay_melds',playerId:userId};
 }else if(d.action==='add_to_meld'){
  if(g.turnPhase!=='discard'||!me.opened)fail('Önce el açmalısın.');const meld=g.melds.find(x=>x.id===d.meldId);if(!meld)fail('Per bulunamadı.');const tiles=choose(h,d.tileIds);const next=[...meld.tiles,...tiles],test=resolveMeld(next,indicator);if(!test.valid)fail('Bu taşlar bu pere eklenemez.');if(h.length-tiles.length<1)fail('Son atılacak bir taşın kalmalı.');meld.tiles=next;meld.represented=test.represented;meld.type=test.type;g.hands[userId]=take(h,d.tileIds);g.lastMove={type:'add',playerId:userId};
 }else if(d.action==='replace_joker'){
  if(g.turnPhase!=='discard'||!me.opened)fail('Okeyi almak için önce el açmış olmalısın.');const meld=g.melds.find(x=>x.id===d.meldId);if(!meld)fail('Per bulunamadı.');const tile=h.find(t=>t.id===d.tileId);if(!tile)fail('Bu taş sende yok.');const replace=replacementFor(meld,tile,indicator);if(!replace)fail('Bu taş yerdeki okeyin yerini doldurmuyor.');
  meld.tiles=meld.tiles.map(t=>t.id===replace.joker.id?tile:t);meld.represented=replace.represented;g.hands[userId]=h.filter(t=>t.id!==tile.id);g.hands[userId].push(replace.joker);g.lastMove={type:'replace_joker',playerId:userId};
 }else fail('Bu 101 Okey hamlesi tanınmıyor.');match.revision++;return match;
}
export function view(match,viewerId){const seat=match.players.findIndex(x=>x.id===viewerId),g=match.game;const exposedMelds=g.melds.map(m=>({id:m.id,ownerId:m.ownerId,tiles:m.tiles,type:m.type}));return {id:match.id,phase:match.phase,roundNo:match.roundNo,rounds:match.rounds,revision:match.revision,selfSeat:seat,isHost:match.hostId===viewerId,players:match.players.map((p,i)=>({id:p.id,seat:i,name:p.name,score:p.score,opened:p.opened,handCount:g.hands[p.id].length})),game:{roundPhase:g.roundPhase,currentSeat:g.currentSeat,turnPhase:g.turnPhase,indicator:g.indicator,okey:g.okey,drawCount:g.drawPile.length,discardTop:g.discardPile.at(-1)||null,turnNumber:g.turnNumber||1,lastMove:g.lastMove||null,lastDiscardBySeat:g.lastDiscardBySeat||{},melds:exposedMelds,pairs:g.pairs,hand:seat>=0?g.hands[viewerId]:[],hints:seat>=0?tileHints(g.hands[viewerId],g.melds,g.indicator):{},result:g.result}};}
