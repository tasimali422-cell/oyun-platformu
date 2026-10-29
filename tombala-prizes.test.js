import test from 'node:test';import assert from 'node:assert/strict';
import {setupTombala,markNumber,finalizeClaims,drawNumber} from './tombala.js';
function roomFixture(){const a={__seatId:'a'},b={__seatId:'b'};const room={settings:{drawInterval:5000},players:new Set([a,b]),ticketChoices:new Map([[a,1],[b,1]])};setupTombala(room);const ticket={id:'ticket1',grid:[[1,2,3,4,5,null,null,null,null],[10,11,12,13,14,null,null,null,null],[20,21,22,23,24,null,null,null,null]]};for(const ws of [a,b]){room.tombala.tickets.set(ws,[ticket]);room.tombala.manualMarks.set(ws,new Set());}room.tombala.phase='running';return {room,a,b,ticket};}
test('first-stage claim shared only for same completing draw, subsequent claims get no award',()=>{
 const {room,a,b,ticket}=roomFixture(),g=room.tombala;
 for(let n=1;n<=5;n++){g.drawn.push(n);g.drawTimes.set(n,Date.now()-1000);}
 for(let n=1;n<=5;n++)assert.equal(markNumber(room,a,ticket.id,n),true);
 assert.equal(finalizeClaims(room,()=> 'A',Date.now()+31000),true);
 assert.equal(g.stageWinners.c1.winners.length,1);
 for(let n=1;n<=5;n++)markNumber(room,b,ticket.id,n);
 assert.equal(g.claims.c1.length,1);
});
test('two marks completing on same number share first-stage award',()=>{const {room,a,b,ticket}=roomFixture(),g=room.tombala;for(let n=1;n<=5;n++){g.drawn.push(n);g.drawTimes.set(n,Date.now()-1000);}for(let n=1;n<=5;n++){markNumber(room,a,ticket.id,n);markNumber(room,b,ticket.id,n);}finalizeClaims(room,()=> 'Oyuncu',Date.now()+31000);assert.equal(g.claims.c1[0].winners.length,2);});
