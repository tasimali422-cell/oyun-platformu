import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {startLudo,viewLudo} from './ludo.js';
test('Arena Club Ludo board draws 225 squares, 16 pawns, game controls and preserves chat',()=>{
 const src=fs.readFileSync(new URL('./public/club.js',import.meta.url),'utf8');
 const start=src.indexOf('const ludoColors='),end=src.indexOf('function fullTable(t){');
 assert.ok(start>0&&end>start);
 const state={me:{id:'a',role:'member'}};
 const esc=s=>String(s??'').replaceAll('<','&lt;');
 const {ludoBoard,renderLudo}=new Function('state','esc',src.slice(start,end)+';return {ludoBoard,renderLudo};')(state,esc);
 const g=startLudo([{name:'Ali',token:'a'},{name:'Ayşe',token:'b'},{name:'Ece',token:'c'},{name:'Mert',token:'d'}]);
 const board=ludoBoard(viewLudo(g,'a'));
 assert.equal((board.match(/class="ludo-cell /g)||[]).length,225);
 assert.equal((board.match(/class="ludo-piece /g)||[]).length,16);
 const t={game:'ludo',no:1,roomId:'room1',maxPlayers:4,ownerId:'a',members:[{as:'player'},{as:'player'}],ludo:{matchId:'123456789',state:viewLudo(g,'a')}};
 assert.match(renderLudo(t),/Zarı at/);
 const html=fs.readFileSync(new URL('./public/club.js',import.meta.url),'utf8');
 assert.match(html,/two-line-log/);
});
