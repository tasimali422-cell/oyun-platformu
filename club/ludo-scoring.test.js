import test from 'node:test';import assert from 'node:assert/strict';import {ludoPointDeltas} from './ludo-scoring.js';
test('2 players: +6/-6',()=>{assert.deepEqual(ludoPointDeltas(2,0),[6,-6]);assert.deepEqual(ludoPointDeltas(2,1),[-6,6]);});
test('4 players: +6/-2/-2/-2',()=>{for(let i=0;i<4;i++){const arr=ludoPointDeltas(4,i);assert.equal(arr.reduce((a,b)=>a+b,0),0);assert.equal(arr[i],6);assert.equal(arr.filter(n=>n===-2).length,3);}});
test('reject invalid settlement',()=>{assert.throws(()=>ludoPointDeltas(3,0));assert.throws(()=>ludoPointDeltas(4,5));});
