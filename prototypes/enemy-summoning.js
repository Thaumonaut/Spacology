(function(root){
  'use strict';
  const MAX_CALLS=2,MAX_ACTIVE=7;
  const limit=field=>Math.min(MAX_ACTIVE,Math.max(1,field)+2);
  const isSummoner=unit=>unit?.side==='foe'&&unit.archetype==='summoner'&&!unit.treasure&&!unit.enemyMinion;
  function ready(actor,units,field){
    return isSummoner(actor)&&actor.alive&&!actor.broken&&(actor.summonCalls||0)<MAX_CALLS&&
      !(actor.summonCooldown>0)&&units.filter(u=>u.side==='foe'&&u.alive).length<limit(field);
  }
  function act(actor,units,field,model){
    if(!isSummoner(actor)||!actor.alive||actor.broken)return null;
    if(actor.summonCooldown>0){actor.summonCooldown--;return null;}
    if(!ready(actor,units,field))return null;
    const call=(actor.summonCalls||0)+1;
    const hp=Math.max(1,Math.round(actor.max*.35)),sp=actor.baseSp||actor.sp;
    const guard=Math.max(1,Math.round(actor.shieldPer*.6));
    const child={...model,id:actor.id+'-spawn-'+call,side:'foe',archetype:'chaff',archetypeName:'Summoned chaff',
      enemyMinion:true,summonerId:actor.id,elite:false,eliteTier:0,treasure:false,
      hp,max:hp,dmg:Math.max(1,Math.round(actor.dmg*.7)),sp,baseSp:sp,av:10000/sp,
      weak:actor.weak.slice(),e:actor.e,alive:true,bar:0,frac:0,struck:false,survey:0,
      shMax:1,shL:1,shC:guard,shieldPer:guard,broken:false,regen:0,vuln:0,
      haste:0,hasteCap:0,hasteStacks:0,cleanse:0,trait:'Summoned'};
    actor.summonCalls=call;actor.summonCooldown=1;
    return child;
  }
  const label=(actor,units,field)=>actor.enemyMinion?'SUMMONED':isSummoner(actor)?
    (actor.summonCalls||0)>=MAX_CALLS?'CALLS SPENT':actor.summonCooldown>0||
      (units&&units.filter(u=>u.side==='foe'&&u.alive).length>=limit(field))?'ATTACK NEXT':'SUMMON NEXT':null;
  const api={MAX_CALLS,MAX_ACTIVE,limit,isSummoner,ready,act,label};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SpacologyEnemySummoning=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
