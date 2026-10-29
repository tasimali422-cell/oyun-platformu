// Sunucu tarafında deterministik Okey puan ve el doğrulama motoru.
// Başlangıç 0; negatif limit 20/30. 8 final puanı sıralama ile aktarılır.
export function settleMatch(scores, losing){
  if(!Array.isArray(scores)||scores.length!==4||![1,2,3].includes(losing.length))throw new Error('Invalid match');
  const losers=[...new Set(losing)];if(losers.length!==losing.length||losers.some(i=>i<0||i>=4))throw new Error('Invalid losing seats');
  const winners=[0,1,2,3].filter(i=>!losers.includes(i));
  const delta=[0,0,0,0];
  if(losers.length===1){delta[losers[0]]=-8;winners.sort((a,b)=>scores[b]-scores[a]||a-b).forEach((i,p)=>delta[i]=p===0?4:2);}
  if(losers.length===2){losers.forEach(i=>delta[i]=-4);winners.forEach(i=>delta[i]=4);}
  if(losers.length===3){losers.sort((a,b)=>scores[b]-scores[a]||a-b).forEach((i,p)=>delta[i]=p===0?-4:-2);delta[winners[0]]=8;}
  if(delta.reduce((a,b)=>a+b,0)!==0)throw new Error('Unbalanced scoring');
  return {scores:scores.map((v,i)=>v+delta[i]),delta,losers,winners};
}
export function applyHandScore(scores,winner,penalty=2){
  if(!Array.isArray(scores)||scores.length!==4||winner<0||winner>3||![2,4].includes(penalty))throw new Error('Invalid hand');
  return scores.map((v,i)=>i===winner?v+3*penalty:v-penalty);
}
export function isRealJoker(tile,indicator){
  return Boolean(tile && indicator && indicator.color<4 && tile.color===indicator.color && tile.n===(indicator.n%13+1));
}
// Partition of 14 tiles into valid 3+ sets of colors/runs or 7 pairs.
// Fake okey is treated as the displayed indicator successor; true okey wildcard.
export function validWinningHand(hand,indicator){
  if(!Array.isArray(hand)||hand.length!==14||!indicator||indicator.color===4)return false;
  const jokerNumber=indicator.n%13+1;
  const normalized=hand.map(t=>t.color===4?{color:indicator.color,n:jokerNumber}:t);
  const wild=normalized.filter(t=>isRealJoker(t,indicator)).length;
  const plain=normalized.filter(t=>!isRealJoker(t,indicator));
  const pairCounts=new Map();plain.forEach(t=>{const k=`${t.color}:${t.n}`;pairCounts.set(k,(pairCounts.get(k)||0)+1);});
  const pairs=[...pairCounts.values()].reduce((sum,n)=>sum+Math.floor(n/2),0);
  const singles=[...pairCounts.values()].reduce((sum,n)=>sum+n%2,0);
  if(pairs+Math.floor(wild/2)+Math.min(wild%2,singles)>=7)return true;
  const encode=arr=>arr.map(t=>`${t.color}-${t.n}`).sort().join(',');
  const visited=new Set();
  function solve(arr,w){
    if(!arr.length)return w===0||w>=3; // remaining wildcards form a valid group
    const key=encode(arr)+'|'+w;if(visited.has(key))return false;visited.add(key);
    const first=arr[0];
    // Same number, different colors; includes first, 3 or 4 total.
    for(let size=3;size<=4;size++){
      const options=arr.map((t,i)=>({t,i})).filter(x=>x.t.n===first.n&&x.t.color!==first.color);
      for(const picks of subsets(options,size-1)){
        if(new Set(picks.map(x=>x.t.color)).size!==picks.length)continue;
        const need=size-1-picks.length;if(need>w)continue;
        const banned=new Set([0,...picks.map(x=>x.i)]);
        if(solve(arr.filter((_,i)=>!banned.has(i)),w-need))return true;
      }
      // fill wildcard missing colors; choose 0..size-1 real tiles
      for(let k=0;k<Math.min(size-1,options.length);k++)for(const picks of subsets(options,k)){
        if(new Set(picks.map(x=>x.t.color)).size!==picks.length)continue;
        const need=size-1-picks.length;if(need>w)continue;
        const banned=new Set([0,...picks.map(x=>x.i)]);
        if(solve(arr.filter((_,i)=>!banned.has(i)),w-need))return true;
      }
    }
    // Runs 3..13, same color, consecutive, include first; no wraparound.
    for(let size=3;size<=13;size++)for(let start=Math.max(1,first.n-size+1);start<=Math.min(first.n,14-size);start++){
      const used=new Set([0]);let need=0;
      for(let n=start;n<start+size;n++){if(n===first.n)continue;const i=arr.findIndex((t,i)=>!used.has(i)&&t.color===first.color&&t.n===n);if(i>=0)used.add(i);else need++;}
      if(need<=w&&solve(arr.filter((_,i)=>!used.has(i)),w-need))return true;
    }
    return false;
  }
  return solve(plain,wild);
}
function subsets(arr,k){if(k===0)return [[]];if(k>arr.length)return [];const out=[];function visit(start,t){if(t.length===k){out.push(t);return;}for(let i=start;i<arr.length;i++)visit(i+1,[...t,arr[i]]);}visit(0,[]);return out;}
