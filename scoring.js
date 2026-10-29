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
export function isRealJoker(tile, indicator) {
  return Boolean(tile && indicator && tile.color !== 4 &&
    tile.color === indicator.color && tile.n === indicator.n % 13 + 1);
}

// True joker: any needed tile. Fake joker: exactly the physical okey's color and number.
// Indicator is never represented by a fake joker.
export function validWinningHand(hand, indicator) {
  if (!Array.isArray(hand) || hand.length !== 14 || !indicator ||
      !Number.isInteger(indicator.n) || indicator.n < 1 || indicator.n > 13 ||
      !Number.isInteger(indicator.color) || indicator.color < 0 || indicator.color > 3) return false;

  const jokerNo = indicator.n % 13 + 1;
  let wild = 0;
  const tiles = [];
  for (const tile of hand) {
    if (!tile || !Number.isInteger(tile.color) || !Number.isInteger(tile.n)) return false;
    if (tile.color === 4) { tiles.push({ color: indicator.color, n: jokerNo }); continue; }
    if (tile.color < 0 || tile.color > 3 || tile.n < 1 || tile.n > 13) return false;
    if (isRealJoker(tile, indicator)) wild++;
    else tiles.push({color:tile.color,n:tile.n});
  }
  if (wild > 2) return false;

  // Seven pairs, including pairs completed by a real joker.
  const counts = new Map();
  for (const t of tiles) { const k = `${t.color}:${t.n}`; counts.set(k, (counts.get(k) || 0) + 1); }
  if ([...counts.values()].reduce((n, v) => n + (v % 2), 0) <= wild) return true;

  // Standard runs never continue 13-1-2; only the final 1 after 13 is allowed.
  const runs = [];
  for (let start=1;start<=13;start++) {
    for (let size=3;size<=13;size++) {
      const seq = Array.from({length:size},(_,i)=>start+i);
      if (seq.at(-1)<=13) runs.push(seq);
      else if (seq.at(-1)===14) runs.push(seq.map(n=>n===14?1:n));
    }
  }
  const seen=new Set();
  function solve(remaining, jokers) {
    if (!remaining.length) return jokers===0; // at most two real jokers in a set
    const key=remaining.map(t=>`${t.color}:${t.n}`).sort().join(',')+'|'+jokers;
    if (seen.has(key)) return false;
    seen.add(key);
    const anchor=remaining[0];
    const candidates=[];
    // A group uses 3-4 different colors with the same number.
    for(let size=3;size<=4;size++){
      for(let mask=1;mask<16;mask++){
        if(!(mask & (1<<anchor.color)))continue;
        const colors=[0,1,2,3].filter(c=>mask&(1<<c));
        if(colors.length!==size)continue;
        candidates.push(colors.map(color=>({color,n:anchor.n})));
      }
    }
    for(const run of runs)if(run.includes(anchor.n))candidates.push(run.map(n=>({color:anchor.color,n})));
    for(const candidate of candidates){
      const rest=[...remaining],anchorIndex=rest.findIndex(t=>t.color===anchor.color&&t.n===anchor.n);
      rest.splice(anchorIndex,1);
      let missing=0;
      for(const target of candidate){
        if(target.color===anchor.color&&target.n===anchor.n)continue;
        const ix=rest.findIndex(t=>t.color===target.color&&t.n===target.n);
        if(ix>=0)rest.splice(ix,1);else missing++;
      }
      if(missing<=jokers&&solve(rest,jokers-missing))return true;
    }
    return false;
  }
  return solve(tiles,wild);
}
