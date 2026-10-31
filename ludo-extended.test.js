import test from 'node:test';import assert from 'node:assert/strict';
import {startLudo,rollLudo,moveLudo,tickLudo,playBotLudo} from './ludo.js';
const seats=[{token:'a',name:'A'},{token:'b',name:'B'}];
test('third consecutive six rolls back prior moves, including captured pawns',()=>{
 const g=startLudo(seats,{},1000000);
 g.players[1].pawns=[29,-1,-1,-1];
 const snap=g.players.map(p=>p.pawns.slice());
 rollLudo(g,0,1000100,()=>6);moveLudo(g,0,0,1000150);
 rollLudo(g,0,1000200,()=>6);moveLudo(g,0,0,1000250);
 assert.notDeepEqual(g.players.map(p=>p.pawns),snap);
 rollLudo(g,0,1000300,()=>6);
 assert.deepEqual(g.players.map(p=>p.pawns),snap);
 assert.equal(g.turn,1);
});
test('one legal move auto-applies; first and second timeouts switch to bot',()=>{
 const g=startLudo(seats,{},1000000);
 g.players[0].pawns=[0,56,56,56];
 rollLudo(g,0,1000100,()=>1);
 assert.equal(g.players[0].pawns[0],1);
 assert.equal(g.turn,1);
 g.turn=0;g.phase='roll';g.deadline=1001000;
 tickLudo(g,1001000);assert.equal(g.players[0].timeouts,1);assert.equal(g.players[0].bot,false);
 g.turn=0;g.phase='roll';g.deadline=1002000;
 tickLudo(g,1002000);assert.equal(g.players[0].bot,true);
 g.turn=0;g.phase='roll';g.deadline=1004000;
 assert.equal(playBotLudo(g,1003000,()=>4),true);assert.equal(g.players[0].pawns[0],5);
});
