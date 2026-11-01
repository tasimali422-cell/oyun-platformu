export const COLORS=['red','blue','black','yellow'];
export const COLOR_NAMES={red:'Kırmızı',blue:'Mavi',black:'Siyah',yellow:'Sarı'};
export const nextFace=face=>({color:face.color,num:face.num===13?1:face.num+1});
export const sameFace=(a,b)=>a?.color===b?.color&&a?.num===b?.num;
export function createTileSet(){const tiles=[];for(const color of COLORS)for(let num=1;num<=13;num++)for(let copy=0;copy<2;copy++)tiles.push({id:`${color}-${num}-${copy}`,kind:'normal',color,num});for(let i=0;i<2;i++)tiles.push({id:`fake-joker-${i}`,kind:'fake-joker'});return tiles;}
export function shuffle(items,random=Math.random){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export const jokerFace=nextFace;
export const isWild=(tile,indicator)=>tile?.kind==='normal'&&sameFace(tile,jokerFace(indicator));
// Sahte okey gerçek okeyin SAYI/RENK yüzünü taşır fakat joker değildir.
export const faceOf=(tile,indicator)=>tile?.kind==='fake-joker'?jokerFace(indicator):{color:tile?.color,num:tile?.num};
export const tilePoints=(tile,indicator)=>isWild(tile,indicator)?25:faceOf(tile,indicator).num;
const fail=reason=>({valid:false,reason});
// Permits natural tiles in any hand order. 'represented' stores which specific face each
// real wild tile stands for; this stays fixed on exposed melds for safe joker replacement.
export function resolveMeld(tiles,indicator){
 if(!Array.isArray(tiles)||tiles.length<3||tiles.length>13)return fail('Bir per en az 3 taş içermelidir.');
 if(tiles.some(t=>!t||typeof t.id!=='string'))return fail('Taş bilgisi geçersiz.');
 const wild=tiles.filter(t=>isWild(t,indicator)),regular=tiles.filter(t=>!isWild(t,indicator));
 const options=[];
 for(const color of COLORS){
  for(let start=1;start+tiles.length-1<=13;start++){
   const faces=Array.from({length:tiles.length},(_,i)=>({color,num:start+i}));const leftovers=[...faces];
   let good=true;for(const t of regular){const face=faceOf(t,indicator);const at=leftovers.findIndex(x=>sameFace(x,face));if(at<0){good=false;break;}leftovers.splice(at,1);}
   if(good&&leftovers.length===wild.length)options.push({valid:true,type:'run',score:faces.reduce((s,f)=>s+f.num,0),represented:Object.fromEntries(wild.map((t,i)=>[t.id,leftovers[i]]))});
  }
 }
 if(tiles.length<=4)for(let num=1;num<=13;num++){
  const colors=new Set(),missing=[];let good=true;
  for(const t of regular){const f=faceOf(t,indicator);if(f.num!==num||colors.has(f.color)){good=false;break;}colors.add(f.color);}
  if(good){for(const color of COLORS)if(!colors.has(color))missing.push({color,num});if(missing.length>=wild.length)options.push({valid:true,type:'set',score:num*tiles.length,represented:Object.fromEntries(wild.map((t,i)=>[t.id,missing[i]]))});}
 }
 options.sort((a,b)=>b.score-a.score||a.type.localeCompare(b.type));
 return options[0]||fail('Taşlar geçerli seri veya farklı renkli aynı sayı per oluşturmuyor.');
}
export const validateMeld=(tiles,indicator)=>resolveMeld(tiles,indicator);
export function replacementFor(meld,tile,indicator){
 if(!meld||isWild(tile,indicator))return null;
 const original=meld.tiles;const assigned=meld.represented||resolveMeld(original,indicator).represented||{};
 for(const j of original){if(!isWild(j,indicator)||!sameFace(assigned[j.id],faceOf(tile,indicator)))continue;
  const test=resolveMeld(original.map(t=>t.id===j.id?tile:t),indicator);
  if(test.valid)return {joker:j,tile,represented:test.represented};
 }
 return null;
}
export function tileHints(tiles,melds,indicator){
 const result={};for(const tile of tiles){
  let append=false,replace=false,appendMeldIds=[],replaceMeldIds=[];
  for(const meld of melds){if(resolveMeld([...meld.tiles,tile],indicator).valid){append=true;appendMeldIds.push(meld.id);}if(replacementFor(meld,tile,indicator)){replace=true;replaceMeldIds.push(meld.id);}}
  if(append||replace)result[tile.id]={append,replace,appendMeldIds,replaceMeldIds};
 }
 return result;
}
export function canOpenWithPairs(tiles,indicator){if(!Array.isArray(tiles)||tiles.length!==10)return false;const wild=tiles.filter(t=>isWild(t,indicator)).length;const counts=new Map();for(const t of tiles){if(isWild(t,indicator))continue;const f=faceOf(t,indicator),k=`${f.color}:${f.num}`;counts.set(k,(counts.get(k)||0)+1);}let pairs=0,singles=0;for(const n of counts.values()){pairs+=Math.floor(n/2);singles+=n%2;}const consumed=Math.min(singles,wild);pairs+=consumed+Math.floor((wild-consumed)/2);return pairs>=5;}
export function evaluateOpening(groups,indicator){if(!Array.isArray(groups)||!groups.length)return fail('Açmak için en az bir per seçmelisiniz.');const checked=groups.map(g=>resolveMeld(g,indicator));const invalid=checked.find(x=>!x.valid);if(invalid)return invalid;const score=checked.reduce((s,x)=>s+x.score,0);return score>=101?{valid:true,score,meldTypes:checked.map(x=>x.type)}:{valid:false,score,reason:`Açmak için en az 101 puan gerekir. Seçilen perlerin toplamı ${score}.`};}
