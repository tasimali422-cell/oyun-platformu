/** Verify short-lived HMAC tickets created by Arena Club Ludo WordPress Bridge. */
import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifyArenaTicket(ticket,secret,origin,now=Math.floor(Date.now()/1000)){
 if(typeof ticket!=='string'||ticket.length>2300||!secret||secret.length<32)return null;
 const parts=ticket.split('.');if(parts.length!==2||!parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)))return null;
 const [body,mac]=parts;
 const expected=createHmac('sha256',secret).update(body).digest();
 const received=Buffer.from(mac,'base64url');
 if(received.length!==expected.length||!timingSafeEqual(expected,received))return null;
 try{
  const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
  if(p.aud!=='arena-club-ludo'||!Number.isSafeInteger(p.uid)||p.uid<=0||
   !Number.isInteger(p.exp)||!Number.isInteger(p.iat)||p.iat>now+30||p.exp<=now||p.exp>p.iat+180||
   p.iss!==origin||typeof p.name!=='string'||p.name.length>60)return null;
  return {wpId:p.uid,name:p.name.trim().slice(0,20)||'Oyuncu',avatar:typeof p.avatar==='string'&&p.avatar.startsWith('https://')?p.avatar.slice(0,512):''};
 }catch{return null;}
}
