import test from 'node:test';
import assert from 'node:assert/strict';
import {LUDO_TRACK,LUDO_STARTS,LUDO_SAFE,LUDO_HOME,startLudo,rollLudo,moveLudo,movablePawns,globalSquare,tickLudo,forfeitLudo,viewLudo} from './ludo.js';
const seats=(n=2)=>Array.from({length:n},(_,i)=>({name:`Oyuncu${i}`,token:`token-${i}`}));
const started=(n=2)=>startLudo(seats(n),{turnSeconds:30},1_000_000);
const prepare=(g,seat,roll)=>{g.turn=seat;g.dice=roll;g.phase='move';g.deadline=1_030_000;};
test('52 benzersiz çevre karesi, dört ayrı başlangıç ve beşli bitiş şeridi',()=>{
 assert.equal(LUDO_TRACK.length,52);assert.equal(new Set(LUDO_TRACK.map(p=>p.join(','))).size,52);
 assert.equal(LUDO_STARTS.length,4);assert.equal(LUDO_SAFE.length,8);
 assert.deepEqual(LUDO_HOME.map(h=>h.length),[5,5,5,5]);
});
test('iki ve dört oyuncu renkleri doğru',()=>{
 assert.deepEqual(started().players.map(p=>p.color),[0,2]);
 assert.deepEqual(started(4).players.map(p=>p.color),[0,1,2,3]);
 assert.throws(()=>startLudo(seats(3)),/2 veya 4/);
});
test('altı gelmeden piyon çıkamaz, altıda çıkabilir ve yeniden atar',()=>{
 const g=started();rollLudo(g,0,1_000_100,()=>5);assert.equal(g.turn,1);
 g.turn=0;g.phase='roll';g.deadline=1_040_000;rollLudo(g,0,1_000_200,()=>6);
 assert.deepEqual(movablePawns(g,0),[0,1,2,3]);moveLudo(g,0,0,1_000_300);
 assert.equal(g.players[0].pawns[0],0);assert.equal(g.turn,0);assert.equal(g.phase,'roll');
});
test('geçersiz hamle ve sıra dışı zar hileleri reddedilir',()=>{
 const g=started();assert.throws(()=>rollLudo(g,1,1_000_100,()=>6),/sıra/);
 assert.throws(()=>moveLudo(g,0,0,1_000_100),/Önce zar/);
 assert.throws(()=>rollLudo(g,0,1_000_100,()=>8),/zar kaynağı/);
 rollLudo(g,0,1_000_100,()=>6);
 assert.throws(()=>moveLudo(g,0,-1,1_000_200),/hareket/);
 assert.throws(()=>moveLudo(g,0,'0',1_000_200),/hareket/);
});
test('güvenli karedeki rakip piyonlar yenilmez',()=>{
 const g=started();g.players[0].pawns[0]=8;g.players[1].pawns[0]=47; // red global 8, yellow global (26+47)%52=21; adjust below
 g.players[1].pawns[0]=34; // yellow global 8 (safe)
 prepare(g,0,6);g.players[0].pawns[0]=2;moveLudo(g,0,0,1_000_100);
 assert.equal(g.players[1].pawns[0],34);
});
test('güvenli olmayan karede rakip sıfıra döner',()=>{
 const g=started();g.players[0].pawns[0]=2;g.players[1].pawns[0]=29; // yellow global (26+29)%52=3
 prepare(g,0,1);moveLudo(g,0,0,1_000_100);
 assert.equal(g.players[0].pawns[0],3);assert.equal(g.players[1].pawns[0],-1);
});
test('bitişe tam sayı, taşma geçersiz, dört piyonla zafer',()=>{
 const g=started();g.players[0].pawns=[56,56,56,55];prepare(g,0,2);
 assert.deepEqual(movablePawns(g,0),[]);
 prepare(g,0,1);moveLudo(g,0,3,1_000_100);
 assert.equal(g.finished,true);assert.equal(g.winner,0);
 assert.equal(viewLudo(g,'token-0').finished,true);
});
test('altı iki kez ek hak verir, üçüncü altıda sıra yanar',()=>{
 const g=started();for(let i=0;i<2;i++){
  rollLudo(g,0,1_000_100+i*300,()=>6);moveLudo(g,0,i,1_000_200+i*300);assert.equal(g.turn,0);
 }
 rollLudo(g,0,1_000_700,()=>6);assert.equal(g.turn,1);assert.equal(g.phase,'roll');
});
test('süre dolarsa sıra geçer, erken dolmaz',()=>{
 const g=started();assert.equal(tickLudo(g,1_020_000),false);assert.equal(tickLudo(g,1_030_000),true);
 assert.equal(g.turn,1);
});
test('masadan ayrılan oyuncu çekilir, son kalan kazanır',()=>{
 const g=started(4);assert.equal(forfeitLudo(g,'token-0',1_000_100),true);assert.equal(g.turn,1);
 forfeitLudo(g,'token-1',1_000_200);forfeitLudo(g,'token-2',1_000_300);
 assert.equal(g.finished,true);assert.equal(g.winner,3);
});
test('sadece kendi hamleleri açılır, yeniden bağlanan token koltuğu korur',()=>{
 const g=started();rollLudo(g,0,1_000_100,()=>6);
 assert.deepEqual(viewLudo(g,'token-1').legalMoves,[]);
 assert.deepEqual(viewLudo(g,'token-0').legalMoves,[0,1,2,3]);
});
