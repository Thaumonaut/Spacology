(function(root){
  'use strict';
  const purchaseCost=4,purchaseXP=4,winXP=12,maxCapacity=12;
  function normalize(state){
    state.fieldXP=Number.isFinite(state.fieldXP)?Math.max(0,Math.floor(state.fieldXP)):0;
    if(state.capacity>=maxCapacity)state.fieldXP=0;
    return state;
  }
  function required(state){return 12+8*(Math.max(1,state.level)-1)}
  function maxed(state){return state.capacity>=maxCapacity}
  function battleXP(state,won){return won&&!maxed(state)?winXP:0}
  function gain(state,amount){
    normalize(state);
    const levels=[];
    if(maxed(state)||!Number.isFinite(amount)||amount<=0)return {xp:0,levels};
    const xp=Math.floor(amount);
    state.fieldXP+=xp;
    while(!maxed(state)&&state.fieldXP>=required(state)){
      state.fieldXP-=required(state);
      state.level++;
      if(state.level%2===0){state.capacity++;levels.push(`${state.capacity} crew capacity`)}
      else{state.shipSlots++;levels.push(`${state.shipSlots} ship slots`)}
    }
    if(maxed(state))state.fieldXP=0;
    return {xp,levels};
  }
  function buy(state){
    if(maxed(state))return {error:'Field fully upgraded'};
    if(state.end||state.round>state.maxRounds)return {error:'This voyage has ended'};
    if(state.gold<purchaseCost)return {error:'You need 4 gold to buy field XP'};
    state.gold-=purchaseCost;
    return gain(state,purchaseXP);
  }
  const api={purchaseCost,purchaseXP,winXP,maxCapacity,normalize,required,maxed,battleXP,gain,buy};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SpacologyField=api;
})(typeof globalThis==='object'?globalThis:this);
