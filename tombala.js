import { randomInt, randomUUID } from 'node:crypto';
export const TOMBALA_MAX_PLAYERS=24;
export function shuffle(list){const a=[...list];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function makeTicket(){
 // Turkish 90-ball tickets: 3 rows x 9 columns, 5 numbers per row, 1-3 per column.
 const candidates=Array.from({length:9},(_,i)=>i);
 let matrix;
 for(let attempt=0;attempt<1000;attempt++){
  matrix=Array.from({length:3},()=>Array(9).fill(null));const occupied=Array(9).fill(0);let ok=true;
  for(let row=0;row<3;row++){
   const choices=shuffle(candidates).sort((a,b)=>(occupied[a]===0? -2:occupied[a])-(occupied[b]===0?-2:occupied[b]));
   const available=choices.filter(c=>occupied[c]<3).slice(0,5);
   if(available.length!==5){ok=false;break;}
   for(const col of available){matrix[row][col]=0;occupied[col]++;}
  }
  if(ok&&occupied.every(x=>x>=1))break;
  matrix=null;
 }
 if(!matrix)throw Error('Ticket allocation failed');
 for(let col=0;col<9;col++){
   const low=col===0?1:col*10;const high=col===8?90:col*10+9;
   const pool=shuffle(Array.from({length:high-low+1},(_,i)=>i+low));
   const rows=[0,1,2].filter(r=>matrix[r][col]!==null);
   const values=pool.slice(0,rows.length).sort((a,b)=>a-b);
   rows.forEach((row,i)=>matrix[row][col]=values[i]);
 }
 return {id:randomUUID().slice(0,12),grid:matrix};
}
export function analyzeTicket(ticket,drawn){let completed=0;for(const row of ticket.grid){const values=row.filter(Number.isInteger);if(values.length===5&&values.every(n=>drawn.has(n)))completed++;}return completed;}
export function setupTombala(room){room.tombala={phase:'waiting',drawn:[],latest:null,tickets:new Map(),manualMarks:new Map(),auto:new Map(),claims:{c1:[],c2:[],tombala:[]},intervalMs:Math.max(2000,Math.min(10000,Number(room.settings?.drawInterval)||5000)),nextAt:null,deck:shuffle(Array.from({length:90},(_,i)=>i+1)),winnerKeys:new Set(),announcements:[],drawTimes:new Map(),markWindowMs:30000};}
export function distribute(room){const g=room.tombala;if(!g)return;g.tickets.clear();g.manualMarks.clear();g.auto.clear();for(const ws of room.players){const count=Math.max(1,Math.min(12,room.ticketChoices?.get(ws)||1));g.tickets.set(ws,Array.from({length:count},makeTicket));g.manualMarks.set(ws,new Set());g.auto.set(ws,false);}}
export function userView(room,ws){const g=room.tombala;if(!g)return null;return {phase:g.phase,latest:g.latest,drawn:g.drawn,remaining:g.deck.length,nextAt:g.nextAt,intervalMs:g.intervalMs,claims:g.claims,announcements:g.announcements.slice(-12),tickets:g.tickets.get(ws)||[],manualMarks:[...(g.manualMarks.get(ws)||new Set())],auto:false,markWindowMs:g.markWindowMs,drawTimes:Object.fromEntries(g.drawTimes),serverNow:Date.now(),ticketCount:room.ticketChoices?.get(ws)||1};}
export function markNumber(room,ws,ticketId,n,now=Date.now()){
 const g=room.tombala;if(!g||g.phase!=='running'||!Number.isInteger(n))return false;
 const ticket=(g.tickets.get(ws)||[]).find(t=>t.id===ticketId);
 const calledAt=g.drawTimes.get(n);
 if(!ticket||!ticket.grid.some(row=>row.includes(n))||!calledAt||now-calledAt>g.markWindowMs)return false;
 const key=ticketId+':'+n;const marks=g.manualMarks.get(ws)||new Set();
 if(marks.has(key))return false; // once marked, remains marked
 marks.add(key);g.manualMarks.set(ws,marks);return true;
}
export function drawNumber(room,username){const g=room.tombala;if(!g||g.phase!=='running')return false;if(!g.deck.length){g.phase='ended';g.nextAt=null;return true;}
 const n=g.deck.pop();g.drawn.push(n);g.latest=n;g.drawTimes.set(n,Date.now());const drawn=new Set(g.drawn);const hit={c1:[],c2:[],tombala:[]};
 for(const [ws,tickets] of g.tickets){for(const ticket of tickets){const rows=analyzeTicket(ticket,drawn);for(const [threshold,stage] of [[1,'c1'],[2,'c2'],[3,'tombala']]){const key=ws.__seatId+':'+ticket.id+':'+stage;if(rows>=threshold&&!g.winnerKeys.has(key)){g.winnerKeys.add(key);hit[stage].push({name:username(ws),ticketId:ticket.id});}}}}
 for(const stage of ['c1','c2','tombala'])if(hit[stage].length){g.claims[stage].push({number:n,winners:hit[stage]});g.announcements.push(`${stage==='c1'?'1. Çinko':stage==='c2'?'2. Çinko':'TOMBALA'}! ${hit[stage].map(x=>x.name).join(', ')}`);}
 // All tickets completing with the same number share victory.
 if(hit.tombala.length){g.phase='ended';g.nextAt=null;}else{g.nextAt=Date.now()+g.intervalMs;}
 return true;
}
