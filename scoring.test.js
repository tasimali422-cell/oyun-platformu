import test from 'node:test';import assert from 'node:assert/strict';import {settleMatch,applyHandScore,validWinningHand} from './scoring.js';
test('one loser',()=>assert.deepEqual(settleMatch([10,1,3,-20],[3]).delta,[4,2,2,-8]));
test('two losers',()=>assert.deepEqual(settleMatch([-21,2,-20,4],[0,2]).delta,[-4,4,-4,4]));
test('three losers ranked',()=>assert.deepEqual(settleMatch([-20,-27,-22,10],[0,1,2]).delta,[-4,-2,-2,8]));
test('score starts at zero',()=>assert.deepEqual(applyHandScore([0,0,0,0],2,2),[-2,-2,6,-2]));
test('valid runs',()=>{const hand=[1,2,3,4,5,6,7].flatMap(n=>[{color:0,n},{color:1,n}]);assert.equal(validWinningHand(hand,{color:2,n:12}),true)});

test('real joker fills missing red nine in 7 8 10 run',()=>{
 const indicator={color:0,n:4}; // red five is the real joker
 const hand=[{color:0,n:7},{color:0,n:8},{color:0,n:5},{color:0,n:10},
 ...[1,2,3,4,5].map(n=>({color:1,n})), ...[6,7,8,9,10].map(n=>({color:2,n}))];
 assert.equal(validWinningHand(hand,indicator),true);
});
test('fake joker is normal okey value not the indicator',()=>{
 const ind={color:0,n:4}; // fake represents red five
 const prefix=[{color:0,n:3},{color:0,n:4},{color:4,n:0}];
 const extra=[1,2,3,4,5,6,7,8,9,10,11].map(n=>({color:1,n}));
 assert.equal(validWinningHand([...prefix,...extra],ind),true);
});
test('fake joker cannot impersonate indicator or any arbitrary tile',()=>{
 const ind={color:0,n:4}; // fake is red 5, NOT red 9
 const hand=[{color:0,n:7},{color:0,n:8},{color:4,n:0},{color:0,n:10},
 ...[1,2,3,4,5].map(n=>({color:1,n})), ...[6,7,8,9,10].map(n=>({color:2,n}))];
 assert.equal(validWinningHand(hand,ind),false);
});
test('12 13 1 is a valid series',()=>{
 const ind={color:3,n:5};
 const hand=[{color:0,n:12},{color:0,n:13},{color:0,n:1},
 ...[1,2,3,4,5].map(n=>({color:1,n})), ...[1,2,3,4,5,6].map(n=>({color:2,n}))];
 assert.equal(validWinningHand(hand,ind),true);
});
