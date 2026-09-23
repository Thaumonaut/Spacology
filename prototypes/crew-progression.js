(function(root){
  'use strict';
  const RESERVE_LIMIT=6,MAX_RANK=2,FINAL_LEVEL=5,COPY_CRYSTALS=2;
  const names=s=>[...(s.field||[]),...(s.support||[]),...(s.reserve||[])].filter(Boolean);
  const owned=(s,n)=>names(s).includes(n);
  const slots=s=>(s.reserve||[]).length+(s.crewCopies||[]).length;
  const rank=(s,n)=>Math.max(0,Math.min(MAX_RANK,Number(s.crewUpgrades?.[n])||0));
  const saleValue=r=>3*3**Math.max(0,Math.min(MAX_RANK,Number(r)||0));
  const stars=r=>'★'.repeat(r+1);
  const bonuses=r=>({hp:[1,1.35,1.8][Math.max(0,Math.min(2,r))],attack:[1,1.25,1.6][Math.max(0,Math.min(2,r))]});
  const total=(s,n)=>(owned(s,n)?3**rank(s,n):0)+(s.crewCopies||[]).filter(c=>c.name===n).reduce((sum,c)=>sum+3**c.rank,0);
  // Names remain the battle/save compatibility key; reserve IDs identify additional
  // instances. Promotion exchanges rank and gear, never merges the two instances.
  const character=(s,ref)=>{const copy=(s.crewCopies||[]).find(c=>c.id===ref);return copy?{ref,name:copy.name,rank:copy.rank}:owned(s,ref)?{ref,name:ref,rank:rank(s,ref)}:null};
  const characters=s=>[...names(s).map(name=>character(s,name)),...(s.crewCopies||[]).map(c=>character(s,c.id))];
  function releaseGear(s,ref){
    s.gear||=[];s.equipped||={};s.gear.push(...(s.equipped[ref]||[]).filter(Boolean));delete s.equipped[ref];
  }
  function promote(s,id){
    const copy=s.crewCopies.find(c=>c.id===id);if(!copy)return null;
    const name=copy.name,previous=rank(s,name),items=s.equipped?.[name]||[];
    s.equipped||={};s.crewUpgrades[name]=copy.rank;s.equipped[name]=s.equipped[id]||[];
    copy.rank=previous;s.equipped[id]=items;
    return name;
  }
  function place(state,ref,row,index,options){
    const selected=character(state,ref);
    if(!selected||!['field','support'].includes(row))return {error:'Character unavailable'};
    const name=selected.name;
    if(!options.canPlace(name,row))return {error:'This character cannot use that row'};
    const existing=state[row].indexOf(name);
    if(index===undefined||Number.isNaN(index))index=existing>=0?existing:state[row].findIndex(n=>!n);
    if(!Number.isInteger(index)||index<0||index>=options.rowSlots[row])return {error:'No open slot · drop onto a character to swap'};
    const next=JSON.parse(JSON.stringify(state));
    if(ref!==name)promote(next,ref);
    const displaced=next[row][index],already=[...next.field,...next.support].includes(name);
    if(!already&&!displaced&&[...next.field,...next.support].filter(Boolean).length>=next.capacity)return {error:'Team capacity reached · drop onto a character to swap'};
    const remove=n=>{next.field=next.field.map(x=>x===n?null:x);next.support=next.support.map(x=>x===n?null:x);next.reserve=next.reserve.filter(x=>x!==n)};
    remove(name);
    if(displaced&&displaced!==name){remove(displaced);next.reserve.push(displaced)}
    next[row][index]=name;
    if(slots(next)>RESERVE_LIMIT&&slots(next)>=slots(state))return {error:'Reserve full · swap with the deployed character of this name or make room'};
    return {state:next,name,displaced};
  }
  function merge(s,n,ref){
    let again=true;
    while(again){
      again=false;
      for(let r=0;r<MAX_RANK;r++){
        if(r===1&&s.level<FINAL_LEVEL)continue;
        const copies=s.crewCopies.filter(c=>c.name===n&&c.rank===r);
        const main=owned(s,n)&&rank(s,n)===r;
        const need=main?2:3;
        if(copies.length<need)continue;
        const used=new Set(copies.slice(0,need).map(c=>c.id));
        const survivor=main?n:copies[0].id;
        if(used.has(ref)||ref===survivor)ref=survivor;
        used.forEach(id=>{if(id!==survivor)releaseGear(s,id)});
        s.crewCopies=s.crewCopies.filter(c=>!used.has(c.id));
        if(main)s.crewUpgrades[n]=r+1;
        else s.crewCopies.push({id:copies[0].id,name:n,rank:r+1});
        again=true;break;
      }
    }
    return ref;
  }
  function normalize(s){
    s.crewCopies=Array.isArray(s.crewCopies)?s.crewCopies:[];s.crewUpgrades=s.crewUpgrades||{};s.nextCopyId=Number(s.nextCopyId)||1;
    if(!s.copyProgression){
      Object.keys(s.crewUpgrades).forEach(n=>s.crewUpgrades[n]=rank(s,n));
      const tokens=Object.values(s.attunements||{}).reduce((a,n)=>a+(Number(n)||0),0);
      s.crystals=(s.crystals||0)+tokens;s.scrap=(s.scrap||0)+tokens*12;s.attunements={};
      s.duplicatePolicy='maxed';s.copyProgression=1;
    }
    [...new Set(names(s))].forEach(n=>merge(s,n));
  }
  function receive(state,name,incomingRank=0,allowOverflow=false){
    if(!Number.isInteger(incomingRank)||incomingRank<0||incomingRank>MAX_RANK)return {error:'Invalid character rank'};
    const next=JSON.parse(JSON.stringify(state));normalize(next);
    let ref=name;
    if(owned(next,name)){ref='copy-'+next.nextCopyId++;next.crewCopies.push({id:ref,name,rank:incomingRank})}
    else {next.reserve.push(name);next.crewUpgrades[name]=incomingRank;}
    ref=merge(next,name,ref);
    if(!allowOverflow&&slots(next)>RESERVE_LIMIT&&slots(next)>=slots(state))return {error:'Reserve full · deploy or sell a character first'};
    return {state:next,ref};
  }
  function receiveAndPlace(state,name,incomingRank,row,index,options){
    const received=receive(state,name,incomingRank,true);if(received.error)return received;
    const placed=place(received.state,received.ref,row,index,options);if(placed.error)return placed;
    if(slots(placed.state)>RESERVE_LIMIT&&slots(placed.state)>=slots(state))return {error:"Reserve full · make room for the displaced character"};
    return placed;
  }
  function apply(target,source){['field','support','reserve','crewCopies','crewUpgrades','nextCopyId','copyProgression','equipped','gear'].forEach(k=>target[k]=source[k]);}
  function disposeMain(s,name){
    s.field=s.field.map(n=>n===name?null:n);s.support=s.support.map(n=>n===name?null:n);
    s.reserve=s.reserve.filter(n=>n!==name);delete s.crewUpgrades[name];
    const best=s.crewCopies.filter(c=>c.name===name).sort((a,b)=>b.rank-a.rank)[0];
    releaseGear(s,name);
    if(best){s.equipped[name]=s.equipped[best.id]||[];delete s.equipped[best.id];s.crewCopies=s.crewCopies.filter(c=>c.id!==best.id);s.reserve.push(name);s.crewUpgrades[name]=best.rank;merge(s,name);}
  }
  function dispose(s,ref){const c=character(s,ref);if(!c)return false;if(ref===c.name)disposeMain(s,ref);else{releaseGear(s,ref);s.crewCopies=s.crewCopies.filter(x=>x.id!==ref)}return true;}
  const REWARD_RANK_CHANCE=.15;
  const rollRewardRank=(random=Math.random)=>random()<REWARD_RANK_CHANCE?1:0;
  const api={receiveAndPlace,character,characters,place,dispose,REWARD_RANK_CHANCE,rollRewardRank,RESERVE_LIMIT,MAX_RANK,FINAL_LEVEL,COPY_CRYSTALS,names,owned,slots,rank,saleValue,stars,bonuses,total,merge,normalize,receive,apply,disposeMain};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SpacologyCrew=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
