import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyArenaTicket} from './arena-auth.js';
const secret='0123456789abcdef0123456789abcdef0123456789';
const origin='https://kayseritb.org';
const now=1_800_000_000;
const sign=(p)=>{const payload=Buffer.from(JSON.stringify(p)).toString('base64url');return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');};
const valid=()=>({aud:'arena-club-ludo',iss:origin,uid:42,name:'Kırmızı Oyuncu',iat:now,exp:now+120});
test('geçerli WordPress bileti güvenle açılır',()=>{
 assert.deepEqual(verifyArenaTicket(sign(valid()),secret,origin,now),{wpId:42,name:'Kırmızı Oyuncu',avatar:''});
});
test('farklı site, geçersiz imza, süre aşımı, kötü veriler reddedilir',()=>{
 assert.equal(verifyArenaTicket(sign({...valid(),iss:'https://evil.example'}),secret,origin,now),null);
 assert.equal(verifyArenaTicket(sign(valid()).replace(/.$/,'A'),secret,origin,now),null);
 assert.equal(verifyArenaTicket(sign(valid()),secret,origin,now+121),null);
 assert.equal(verifyArenaTicket(sign({...valid(),uid:-2}),secret,origin,now),null);
 assert.equal(verifyArenaTicket(sign({...valid(),exp:now+500}),secret,origin,now),null);
});
