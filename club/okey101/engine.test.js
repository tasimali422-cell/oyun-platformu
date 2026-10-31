import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newMatch, action, view} from './engine.js';
const seats=Array.from({length:4},(_,i)=>({id:`player-${i+1}`,name:`Oyuncu ${i+1}`}));
test('101 Okey: 4 oyuncuya 22+21+21+21 taş dağıtılır; kalan 20 taş destededir',()=>{
 const m=newMatch(seats,{rounds:3});assert.equal(m.phase,'playing');assert.deepEqual(seats.map(p=>m.game.hands[p.id].length),[22,21,21,21]);assert.equal(m.game.drawPile.length,20);assert.equal(m.rounds,3);
});
test('101 Okey: her oyuncu sadece kendi elini görür; izleyici hiçbir eli göremez',()=>{
 const m=newMatch(seats);const a=view(m,seats[0].id),b=view(m,seats[1].id),viewer=view(m,'spectator');
 assert.equal(a.game.hand.length,22);assert.equal(b.game.hand.length,21);assert.equal(viewer.game.hand.length,0);
 for(const p of a.players)assert.equal(p.hand,undefined);assert.ok(!JSON.stringify(a).includes(m.game.hands[seats[1].id][0].id)||m.game.hands[seats[0].id].some(t=>t.id===m.game.hands[seats[1].id][0].id));
});
test('101 Okey: sırası olmayan oyuncu ve elinde olmayan taş reddedilir',()=>{
 const m=newMatch(seats);assert.throws(()=>action(m,seats[1].id,{action:'discard',tileId:m.game.hands[seats[1].id][0].id}),/sıra/i);
 assert.throws(()=>action(m,seats[0].id,{action:'discard',tileId:'fake-does-not-exist'}),/elinde yok/i);
});
test('101 Okey: ilk oyuncu taş atar, ikinci oyuncu çeker ve atar',()=>{
 const m=newMatch(seats);const first=m.game.hands[seats[0].id][0].id;
 action(m,seats[0].id,{action:'discard',tileId:first});assert.equal(m.game.currentSeat,1);assert.equal(m.game.turnPhase,'draw');
 assert.throws(()=>action(m,seats[1].id,{action:'discard',tileId:m.game.hands[seats[1].id][0].id}),/çekmelisin/i);
 action(m,seats[1].id,{action:'draw',source:'discard'});assert.equal(m.game.hands[seats[1].id].length,22);
 assert.equal(m.game.discardPile.length,0);
 action(m,seats[1].id,{action:'discard',tileId:first});assert.equal(m.game.currentSeat,2);assert.equal(m.game.discardPile.length,1);
});
test('101 Okey: taş tekrar kullanımı ve sahte açma reddedilir',()=>{
 const m=newMatch(seats);const hand=m.game.hands[seats[0].id];
 assert.throws(()=>action(m,seats[0].id,{action:'open',groups:[[hand[0].id,hand[0].id,hand[2].id]]}),/birden fazla/i);
 assert.throws(()=>action(m,seats[0].id,{action:'open',groups:[[hand[0].id,hand[1].id,hand[2].id]]}),/geçerli|101/i);
});
