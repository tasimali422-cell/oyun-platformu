import test from 'node:test';
import assert from 'node:assert/strict';
import {MULK_BOARD,startMulk,actMulk,tickMulk,rent,viewMulk,bankruptMulk} from './mulk.js';
const create=()=>startMulk([{name:'Ayşe',token:'a'},{name:'Utku',token:'b'},{name:'Derya',token:'c'}],{cash:1500,auctionSeconds:20});
test('40 square original board, 1500 M each, no initial ownership',()=>{
 const g=create();assert.equal(MULK_BOARD.length,40);assert.equal(g.players.length,3);assert.ok(g.players.every(p=>p.cash===1500));assert.equal(g.assets[1].owner,null);assert.equal(viewMulk(g,0).mySeat,0);
});
test('purchase requires current player and charges correct price',()=>{
 const g=create();g.pending={type:'purchase',seat:0,square:1};
 assert.throws(()=>actMulk(g,1,{action:'buy'}));actMulk(g,0,{action:'buy'});
 assert.equal(g.assets[1].owner,0);assert.equal(g.players[0].cash,1440);assert.equal(g.phase,'end');
});
test('declined purchase auctions and pays winning bidder, auction timeout',()=>{
 const g=create();g.pending={type:'purchase',seat:0,square:1};actMulk(g,0,{action:'auction'},1000);
 actMulk(g,1,{action:'bid',amount:55},2000);assert.throws(()=>actMulk(g,2,{action:'bid',amount:54},2001));
 assert.equal(tickMulk(g,20000),false);assert.equal(tickMulk(g,22000),true);
 assert.equal(g.assets[1].owner,1);assert.equal(g.players[1].cash,1445);
});
test('rent, monopoly and house construction change rent on owner tiles',()=>{
 const g=create();g.assets[1].owner=0;assert.equal(rent(g,1),2);
 g.assets[3].owner=0;assert.equal(rent(g,1),4);
 actMulk(g,0,{action:'build',square:1});assert.equal(g.assets[1].houses,1);assert.equal(rent(g,1),10);
 assert.equal(g.players[0].cash,1450);
 actMulk(g,0,{action:'build',square:3});assert.equal(g.assets[3].houses,1);
 actMulk(g,0,{action:'build',square:1});assert.throws(()=>actMulk(g,0,{action:'build',square:1}));
});
test('mortgage/unmortgage and trade require ownership, correct balances',()=>{
 const g=create();g.assets[1].owner=0;
 actMulk(g,0,{action:'mortgage',square:1});assert.equal(g.players[0].cash,1530);assert.equal(rent(g,1),0);
 actMulk(g,0,{action:'unmortgage',square:1});assert.equal(g.players[0].cash,1497);
 actMulk(g,0,{action:'tradeOffer',to:1,giveSquare:1,wantSquare:-1,giveCash:0,wantCash:100});
 actMulk(g,1,{action:'tradeAccept'});assert.equal(g.assets[1].owner,1);assert.equal(g.players[0].cash,1597);assert.equal(g.players[1].cash,1400);
});
test('jail payment or card and bankruptcy are checked by server',()=>{
 const g=create();g.turn=0;g.players[0].jailed=1;g.players[0].position=10;
 actMulk(g,0,{action:'jailPay'});assert.equal(g.players[0].cash,1450);assert.equal(g.players[0].jailed,0);
 g.debt={seat:1,creditor:0,amount:900};g.players[1].cash=-900;
 actMulk(g,1,{action:'bankrupt'});assert.equal(g.players[1].bankrupt,true);
 assert.equal(g.finished,false);bankruptMulk(g,2,null);assert.equal(g.finished,true);assert.equal(g.winner,0);
});
