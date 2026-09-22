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
  function merge(s,n){
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
        s.crewCopies=s.crewCopies.filter(c=>!used.has(c.id));
        if(main)s.crewUpgrades[n]=r+1;
        else s.crewCopies.push({id:copies[0].id,name:n,rank:r+1});
        again=true;break;
      }
    }
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
  function receive(state,name){
    if(total(state,name)>=9)return {error:rank(state,name)===2?'Already at maximum rank':'All 9 copies collected; unlock field level 5'};
    const next=JSON.parse(JSON.stringify(state));normalize(next);
    if(owned(next,name))next.crewCopies.push({id:'copy-'+next.nextCopyId++,name,rank:0});
    else {next.reserve.push(name);next.crewUpgrades[name]=0;}
    merge(next,name);
    if(slots(next)>RESERVE_LIMIT&&slots(next)>=slots(state))return {error:'Reserve full · deploy or sell a character first'};
    return {state:next};
  }
  function apply(target,source){['field','support','reserve','crewCopies','crewUpgrades','nextCopyId','copyProgression'].forEach(k=>target[k]=source[k]);}
  function disposeMain(s,name){
    s.field=s.field.map(n=>n===name?null:n);s.support=s.support.map(n=>n===name?null:n);
    s.reserve=s.reserve.filter(n=>n!==name);delete s.crewUpgrades[name];
    const best=s.crewCopies.filter(c=>c.name===name).sort((a,b)=>b.rank-a.rank)[0];
    if(best){s.crewCopies=s.crewCopies.filter(c=>c.id!==best.id);s.reserve.push(name);s.crewUpgrades[name]=best.rank;merge(s,name);}
  }
  const api={RESERVE_LIMIT,MAX_RANK,FINAL_LEVEL,COPY_CRYSTALS,names,owned,slots,rank,saleValue,stars,bonuses,total,merge,normalize,receive,apply,disposeMain};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SpacologyCrew=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
