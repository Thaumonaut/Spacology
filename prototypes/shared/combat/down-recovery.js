(function(root){
  'use strict';
  const costAV=50,healthFraction=.5;
  function mode(state){return ['revive','lastStand','none'].includes(state.downRecovery)?state.downRecovery:state.lastStand===false?'none':'revive'}
  function recover(state,unit,battle){
    if(mode(state)!=='revive'||unit.summon||unit.hp>0)return null;
    const cost=Math.min(costAV,Math.max(0,battle.limit*100-battle.av));
    if(!cost)return null;
    battle.limit=(battle.limit*100-cost)/100;
    battle.recoveryAV=(battle.recoveryAV||0)+cost;
    battle.revives=(battle.revives||0)+1;
    unit.hp=Math.max(1,Math.ceil(unit.max*healthFraction));unit.alive=true;
    unit.av=Math.max(unit.av,10000/unit.sp);
    unit.recoveryGuard=true; // One down per action, even on a multi-hit attack.
    return {hp:unit.hp,costAV:cost};
  }
  const api={mode,recover,costAV,healthFraction};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SpacologyDownRecovery=api;
})(typeof globalThis==='object'?globalThis:this);
