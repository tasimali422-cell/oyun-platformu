/** Authoritative, zero-sum Arena Club Ludo points. Negative balances are allowed. */
export function ludoPointDeltas(playerCount,winnerSeat){
  if(![2,4].includes(playerCount)||!Number.isInteger(winnerSeat)||winnerSeat<0||winnerSeat>=playerCount)throw Error('Geçersiz Kızma Birader sonucu.');
  return Array.from({length:playerCount},(_,seat)=>seat===winnerSeat?6:playerCount===2?-6:-2);
}
