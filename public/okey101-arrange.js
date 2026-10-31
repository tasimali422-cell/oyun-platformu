/* Arena Club 101 Okey: local, visual-only rack arranger.
 * Server remains authoritative for opening, tile ownership and all turn actions.
 * 101 runs never wrap from 13 to 1. */
(function(root){
  const colors=['red','blue','black','yellow'];
  const same=(a,b)=>a.color===b.color&&a.num===b.num;
  const face=(tile,game)=>tile.kind==='fake-joker'?game.okey:{color:tile.color,num:tile.num};
  const wild=(t,game)=>t.kind==='normal'&&same(t,game.okey);
  function validate(group,game){
    if(group.length<3||group.length>13)return null;
    const regular=group.filter(t=>!wild(t,game)),wildCount=group.length-regular.length;
    let best=null;
    for(const color of colors)for(let start=1;start+group.length-1<=13;start++){
      const left=[...regular];
      for(let number=start;number<start+group.length;number++){
        const i=left.findIndex(t=>{const f=face(t,game);return f.color===color&&f.num===number;});
        if(i>=0)left.splice(i,1);
      }
      if(!left.length&&regular.length+wildCount===group.length){
        const score=group.length*(2*start+group.length-1)/2;
        if(!best||score>best.score)best={type:'run',score};
      }
    }
    if(group.length<=4)for(let num=1;num<=13;num++){
      const values=regular.map(t=>face(t,game));
      if(values.every(t=>t.num===num)&&new Set(values.map(t=>t.color)).size===values.length&&values.length+wildCount<=4){
        const score=num*group.length;
        if(!best||score>best.score)best={type:'set',score};
      }
    }
    return best;
  }
  function pair(a,b,game){return (wild(a,game)&&wild(b,game))||wild(a,game)||wild(b,game)||same(face(a,game),face(b,game));}
  function sequences(hand,game){
    const out=[];
    // Enumerate natural runs, including both tile copies; long sets are preferred.
    for(const color of colors){
      const list=hand.filter(t=>!wild(t,game)&&face(t,game).color===color);
      for(let start=1;start<=11;start++)for(let end=start+2;end<=13;end++){
        const group=[];
        for(let n=start;n<=end;n++){
          const tile=list.find(t=>face(t,game).num===n);
          if(!tile){group.length=0;break;}
          group.push(tile);
        }
        if(group.length>=3)out.push({tiles:group,type:'run',score:group.reduce((s,t)=>s+face(t,game).num,0)});
      }
    }
    // Equal value, different colors, max four pieces.
    for(let n=1;n<=13;n++){
      const all=colors.map(c=>hand.find(t=>!wild(t,game)&&face(t,game).color===c&&face(t,game).num===n)).filter(Boolean);
      if(all.length>=3)out.push({tiles:all,type:'set',score:n*all.length});
      if(all.length===4)for(let i=0;i<4;i++)out.push({tiles:all.filter((_,j)=>j!==i),type:'set',score:n*3});
    }
    return out;
  }
  function arrange(hand,game,mode='run'){
    const remaining=[...hand];
    const groups=[];
    const used=new Set();
    if(mode==='pairs'){
      for(let i=0;i<remaining.length;i++){
        const a=remaining[i];if(used.has(a.id))continue;
        const j=remaining.findIndex((b,k)=>k>i&&!used.has(b.id)&&pair(a,b,game));
        if(j>=0){groups.push([a,remaining[j]]);used.add(a.id);used.add(remaining[j].id);}
      }
    }else{
      const options=sequences(hand,game).sort((a,b)=>b.tiles.length-a.tiles.length||b.score-a.score);
      for(const candidate of options){if(candidate.tiles.some(t=>used.has(t.id)))continue;groups.push(candidate.tiles);for(const t of candidate.tiles)used.add(t.id);}
    }
    const remainingTiles=remaining.filter(t=>!used.has(t.id));
    const order={red:0,blue:1,black:2,yellow:3};
    remainingTiles.sort((a,b)=>{const af=face(a,game),bf=face(b,game);return (order[af.color]??5)-(order[bf.color]??5)||af.num-bf.num||a.id.localeCompare(b.id);});
    // Preserve two rows with blank gaps between groups. Rack has 14 columns per row.
    const slots=Array(28).fill(null);let cursor=0;
    const insert=(tiles,spacer)=>{
      let pos=cursor;
      if(pos%14+tiles.length>14)pos=Math.ceil(pos/14)*14;
      if(pos+tiles.length>slots.length)return false;
      tiles.forEach((t,j)=>slots[pos+j]=t.id);
      cursor=pos+tiles.length+(spacer?1:0);return true;
    };
    const placed=new Set();
    for(const group of groups)if(insert(group,true))group.forEach(t=>placed.add(t.id));
    for(const tile of [...remainingTiles,...hand.filter(t=>used.has(t.id)&&!placed.has(t.id))]){
      let empty=slots.findIndex((v,i)=>i>=Math.min(cursor,slots.length)&&v===null);if(empty<0)empty=slots.indexOf(null);if(empty<0)break;slots[empty]=tile.id;
    }
    return slots;
  }
  function readGroups(slots,hand,game){
    const map=new Map(hand.map(t=>[t.id,t]));const groups=[];let score=0;
    for(let row=0;row<2;row++){
      let current=[];
      for(let i=row*14;i<=row*14+14;i++){
        const t=i===row*14+14?null:map.get(slots[i]);
        if(t)current.push(t);
        else if(current.length){const result=validate(current,game);if(result){score+=result.score;groups.push({ids:current.map(t=>t.id),...result});}current=[];}
      }
    }
    return {groups,score};
  }
  const api={validate,arrange,readGroups,pair};
  root.Arena101Rack=api;
})(globalThis);
