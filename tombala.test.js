import test from 'node:test';import assert from 'node:assert/strict';import {makeTicket,analyzeTicket,shuffle,setupTombala,distribute,drawNumber} from './tombala.js';
test('1000 cards: 3x9, 15 unique numbers, 5 numbers per row, sorted columns',()=>{for(let i=0;i<1000;i++){const t=makeTicket();assert.equal(t.grid.length,3);const all=t.grid.flat().filter(Number.isInteger);assert.equal(all.length,15);assert.equal(new Set(all).size,15);assert.ok(all.every(n=>n>=1&&n<=90));for(const row of t.grid)assert.equal(row.filter(Number.isInteger).length,5);for(let c=0;c<9;c++){const v=t.grid.map(r=>r[c]).filter(Number.isInteger);assert.ok(v.length>=1&&v.length<=3);assert.deepEqual(v,[...v].sort((a,b)=>a-b));assert.ok(v.every(n=>c===0?n<=9:c===8?n>=80:n>=c*10&&n<=c*10+9));}}});
test('draw order unique cryptographic shuffle',()=>{const seq=shuffle(Array.from({length:90},(_,i)=>i+1));assert.equal(new Set(seq).size,90)});
test('one/two/all row detection',()=>{const t=makeTicket();const d=new Set(t.grid[0].filter(Number.isInteger));assert.equal(analyzeTicket(t,d),1);t.grid[1].filter(Number.isInteger).forEach(n=>d.add(n));assert.equal(analyzeTicket(t,d),2);t.grid[2].filter(Number.isInteger).forEach(n=>d.add(n));assert.equal(analyzeTicket(t,d),3)});
test('same draw can produce shared tombala winners',()=>{const a={__seatId:'A'},b={__seatId:'B'};const room={settings:{drawInterval:3000},players:new Set([a,b]),ticketChoices:new Map([[a,1],[b,1]]),autoChoices:new Map()};setupTombala(room);distribute(room);const g=room.tombala;const ticket=g.tickets.get(a)[0];g.tickets.set(b,[{id:'another',grid:ticket.grid.map(r=>[...r])}]);const numbers=ticket.grid.flat().filter(Number.isInteger);g.deck=[...numbers].reverse();g.phase='running';let i=0;while(g.phase==='running'&&i++<90)drawNumber(room,()=> 'Player');assert.equal(g.phase,'ended');assert.equal(g.claims.tombala.at(-1).winners.length,2);});

import { markNumber, TOMBALA_MAX_PLAYERS } from './tombala.js';
test('v0.8: maximum room size is 24',()=>{assert.equal(TOMBALA_MAX_PLAYERS,24)});
test('v0.8: manual marks accepted only within 30 seconds',()=>{
 const player={}; const card={id:'testcard',grid:[[7,null,null,null,null,null,null,null,null]]};
 const room={tombala:{phase:'running',auto:new Map([[player,false]]),tickets:new Map([[player,[card]]]),drawTimes:new Map([[7,1000]]),manualMarks:new Map([[player,new Set()]]),markWindowMs:30000}};
 assert.equal(markNumber(room,player,'testcard',7,30000),true);
 assert.equal(markNumber(room,player,'testcard',7,30001),false);
 const p2={};room.tombala.tickets.set(p2,[card]);room.tombala.manualMarks.set(p2,new Set());
 assert.equal(markNumber(room,p2,'testcard',7,31001),false);
});
