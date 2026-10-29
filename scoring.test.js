import test from 'node:test';import assert from 'node:assert/strict';import {settleMatch,applyHandScore,validWinningHand} from './scoring.js';
test('one loser',()=>assert.deepEqual(settleMatch([10,1,3,-20],[3]).delta,[4,2,2,-8]));
test('two losers',()=>assert.deepEqual(settleMatch([-21,2,-20,4],[0,2]).delta,[-4,4,-4,4]));
test('three losers ranked',()=>assert.deepEqual(settleMatch([-20,-27,-22,10],[0,1,2]).delta,[-4,-2,-2,8]));
test('score starts at zero',()=>assert.deepEqual(applyHandScore([0,0,0,0],2,2),[-2,-2,6,-2]));
test('valid runs',()=>{const hand=[1,2,3,4,5,6,7].flatMap(n=>[{color:0,n},{color:1,n}]);assert.equal(validWinningHand(hand,{color:2,n:12}),true)});
