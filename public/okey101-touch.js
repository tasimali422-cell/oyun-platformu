/* Arena Club 101 Okey v2.7: unified mouse/touch/pen tile gestures.
 * All actual draws and discards are authorized by the existing Club API.
 * No local manipulation of another player's hand or server dice/tiles. */
(() => {
  let gesture = null, ghost = null, suppressClickUntil = 0, busy = false;
  const dragThreshold = 8;
  function table(){return typeof state!=='undefined'?state.table:null;}
  function game(){return table()?.okey101?.game;}
  function activePhase(){
    const m=table()?.okey101,g=m?.game;
    return m?.phase==='playing' && m.selfSeat>=0 && g.currentSeat===m.selfSeat ? g.turnPhase : null;
  }
  function resolveSource(target){
    const piece=target.closest('[data-ok101-drag]');
    if(piece)return {kind:'rack',id:piece.dataset.id,element:piece};
    const draw=target.closest('[data-ok101-draw-source]');
    if(draw)return {kind:draw.dataset.ok101DrawSource,element:draw};
    return null;
  }
  function destroy(){if(ghost){ghost.remove();ghost=null;}document.querySelectorAll('.ok101-drop-focus').forEach(x=>x.classList.remove('ok101-drop-focus'));}
  function cancel(){gesture=null;destroy();}
  function startGhost(source,x,y){
    ghost=source.element.cloneNode(true);
    ghost.removeAttribute('id');ghost.removeAttribute('data-act');ghost.removeAttribute('data-ok101-drag');ghost.removeAttribute('data-ok101-draw-source');
    ghost.classList.add('ok101-touch-ghost');
    Object.assign(ghost.style,{position:'fixed',left:'0',top:'0',zIndex:'10000',pointerEvents:'none',margin:'0',width:'42px',height:'56px'});
    document.body.append(ghost);moveGhost(x,y);
  }
  function moveGhost(x,y){if(ghost)ghost.style.transform=`translate3d(${Math.round(x-21)}px,${Math.round(y-28)}px,0)`;}
  function targetAt(x,y){return document.elementFromPoint(x,y);}
  function markTarget(x,y){
    document.querySelectorAll('.ok101-drop-focus').forEach(n=>n.classList.remove('ok101-drop-focus'));
    const el=targetAt(x,y);
    const place=el?.closest('[data-ok101-slot],.ok101-stackbox.discard,[data-ok101-rack],[data-ok101-meld-id],[data-ok101-finish-target]');
    if(place)place.classList.add('ok101-drop-focus');
  }
  document.addEventListener('pointerdown',e=>{
    if(busy || e.button!==0 || !e.target.closest('#okey101Area'))return;
    const source=resolveSource(e.target);if(!source)return;
    const phase=activePhase();
    if(source.kind==='rack' && !game()?.hand.some(t=>t.id===source.id))return;
    if(source.kind!=='rack' && phase!=='draw')return;
    gesture={pointerId:e.pointerId,source,x:e.clientX,y:e.clientY,moved:false};
  },true);
  document.addEventListener('pointermove',e=>{
    const a=gesture;if(!a||a.pointerId!==e.pointerId)return;
    if(!a.moved && Math.hypot(e.clientX-a.x,e.clientY-a.y)>=dragThreshold){
      a.moved=true;startGhost(a.source,e.clientX,e.clientY);
    }
    if(a.moved){e.preventDefault();moveGhost(e.clientX,e.clientY);markTarget(e.clientX,e.clientY);}
  },{capture:true,passive:false});
  document.addEventListener('pointercancel',e=>{if(gesture?.pointerId===e.pointerId)cancel();},true);
  document.addEventListener('pointerup',async e=>{
    const a=gesture;if(!a||a.pointerId!==e.pointerId)return;
    gesture=null;
    if(!a.moved){destroy();return;}
    suppressClickUntil=Date.now()+450;
    const el=targetAt(e.clientX,e.clientY);
    const slot=el?.closest('[data-ok101-slot]');
    const toDiscard=el?.closest('.ok101-stackbox.discard');
    const onRack=el?.closest('[data-ok101-rack]');
    const onMeld=el?.closest('[data-ok101-meld-id]');
    const onFinish=el?.closest('[data-ok101-finish-target]');
    destroy();
    if(a.source.kind==='rack'&&slot){
      okey101MoveRackTile(a.source.id,Number(slot.dataset.ok101Slot));return;
    }
    const t=table(),phase=activePhase();if(!t||!t.okey101)return;
    let packet;
    if(a.source.kind==='rack'&&toDiscard&&phase==='discard'){if(!okey101WarnDiscard(t,a.source.id))return;packet={roomId:t.roomId,no:t.no,action:'discard',tileId:a.source.id};}
    if(a.source.kind==='rack'&&onFinish&&phase==='discard'&&game()?.hand?.length===1){if(!okey101WarnDiscard(t,a.source.id))return;packet={roomId:t.roomId,no:t.no,action:'discard',tileId:a.source.id};}
    if(a.source.kind==='rack'&&onMeld&&phase==='discard'){
      const match=t.okey101;const opened=match.players.find(p=>p.seat===match.selfSeat)?.opened;
      if(!opened){notice('Önce 101 veya beş çift açmalısın.',true);return;}
      const meldId=onMeld.dataset.ok101MeldId,hint=game()?.hints?.[a.source.id];
      if(hint?.replaceMeldIds?.includes(meldId))packet={roomId:t.roomId,no:t.no,action:'replace_joker',meldId,tileId:a.source.id};
      else if(hint?.appendMeldIds?.includes(meldId))packet={roomId:t.roomId,no:t.no,action:'add_to_meld',meldId,tileIds:[a.source.id]};
      else{notice('Bu taşı hedef pere işleyemezsin.',true);return;}
    }
    if(a.source.kind!=='rack'&&onRack&&phase==='draw'){if(a.source.kind==='discard'&&!t.okey101.players.find(p=>p.seat===t.okey101.selfSeat)?.opened){try{await okey101AttemptDiscardDraw(t);}catch(err){notice(err.message,true);}return;}packet={roomId:t.roomId,no:t.no,action:'draw',source:a.source.kind==='wall'?'wall':'discard'};}
    if(!packet)return;
    if(busy)return;busy=true;
    try{
      const result=await api('/table/101/action','POST',packet);
      okey101Selected.clear();okey101Draft=[];
      if(state.table?.roomId===t.roomId&&state.table?.no===t.no)updateTable(result.table);
    }catch(err){notice(err.message||'Hamle yapılamadı.',true)}
    finally{busy=false;}
  },true);
  // Gesture must not also trigger the legacy click-based selection / discard command.
  document.addEventListener('click',e=>{
    if(Date.now()>suppressClickUntil)return;
    if(e.target.closest('#okey101Area')){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  window.addEventListener('blur',cancel);
})();
