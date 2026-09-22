(function(root){
  'use strict';
  const roles={Coda:'gatherer',Aurel:'reservoir',Nour:'conduit',Hanae:'gatherer',Ivara:'reservoir',Arunima:'conduit',Roonie:'tuner',Veska:'cantor',Daven:'anchor'};
  const area=['Ash','Stella','Morrow','Idris','Sevim','Vitre','Yusuf'];
  const support=['Ilka','Spore','Abike','Coda','Aurel','Ekene','Nahana','Navigator'];
  function profile(name){
    const role=roles[name]||null;
    return {cost:({Hanae:1,Ivara:1,Arunima:3,Roonie:1,Veska:2,Daven:2})[name]||(area.includes(name)?3:support.includes(name)?1:2),gain:role==='gatherer'?2:1,skillGain:name==='Hanae'?5:0,spendAll:name==='Arunima',capacityBonus:role==='reservoir'?2:0,role};
  }
  function capacityBreakdown(crew){
    const names=[...new Set(crew.filter(u=>u&&u.alive!==false&&!u.summon).map(u=>u.n||u))];
    const weavers=names.filter(n=>profile(n).role).length;
    const bonus=names.reduce((sum,n)=>sum+profile(n).capacityBonus,0);
    return {base:6,weavers,bonus,total:6+weavers+bonus};
  }
  function capacity(crew){return capacityBreakdown(crew).total}
  function create(crew){return {current:3,max:capacity(crew),generated:0,wasted:0,spent:0,basics:0,skills:0,reserveAfter:0}}
  function sync(pool,crew){pool.max=capacity(crew);pool.current=Math.min(pool.current,pool.max)}
  function overchargeEnabled(session,name){
    const saved=(session.aetherOvercharge||{})[name];
    return saved===undefined?!!profile(name).spendAll:!!saved;
  }
  function skillCost(actor){return Math.max(1,profile(actor.n).cost-(actor.weaverDiscount?1:0))}
  function budget(pool,actor,session){
    const p=profile(actor.n),cost=skillCost(actor);
    return Math.min(pool.max,overchargeEnabled(session,actor.n)?(p.spendAll?pool.max-(actor.weaverDiscount?1:0):p.role==='conduit'?cost+1:cost):cost);
  }
  function priority(crew,session,useful=()=>true){
    const eligible=crew.filter(u=>u.alive!==false&&!u.summon&&(session.aetherModes||{})[u.n]!=='build'&&useful(u));
    return eligible.find(u=>u.n===session.aetherPriority)||eligible.filter(u=>profile(u.n).role==='conduit'&&overchargeEnabled(session,u.n))
      .sort((a,b)=>(profile(b.n).spendAll?100:3)-(profile(a.n).spendAll?100:3)||(a.av||0)-(b.av||0))[0]||null;
  }
  function decide(pool,actor,options={}){
    const p=profile(actor.n),reserve=options.reserve||0;
    const discount=actor.weaverDiscount?Math.min(1,p.cost-1):0;
    p.cost-=discount;p.gain+=actor.weaverTune?1:0;
    if(!options.useful)return {kind:'basic',gain:p.gain,reason:'skill has no useful target'};
    if(options.mode==='build'&&!options.emergency)return {kind:'basic',gain:p.gain,reason:'building Aether'};
    if(options.basicEnough&&!options.emergency&&!options.setup)return {kind:'basic',gain:p.gain,reason:'a basic can finish the target'};
    if(pool.current<p.cost)return {kind:'basic',gain:p.gain,reason:'need '+p.cost+' Aether'};
    const projected=Math.min(pool.max,pool.current-p.cost+(options.skillGain===undefined?p.skillGain:options.skillGain));
    const refill=projected>pool.current;
    if(!options.emergency&&!options.setup&&!options.opportunity&&!refill&&projected<reserve)return {kind:'basic',gain:p.gain,reason:'saving for '+options.priority};
    if(options.waitForBurst&&!options.emergency)return {kind:'basic',gain:p.gain,waiting:true,reason:'building full burst for '+actor.n};
    const limit=Number.isFinite(options.spendLimit)?Math.max(p.cost,options.spendLimit):pool.max;
    const extra=p.role==='conduit'&&options.overcharge?Math.max(0,Math.min(p.spendAll?pool.max-discount-p.cost:1,pool.current-p.cost-reserve,limit-p.cost)):0;
    return {kind:'skill',cost:p.cost+extra,extra,discount,reason:options.emergency?'urgent recovery':refill?'refilling Aether':options.setup||options.opportunity||(extra?(p.spendAll?'burst: '+(p.cost+extra)+' Aether':'overcharged'):'skill ready')};
  }
  function teamPlan(pool,actor,options){
    const {crew,session}=options,useful=options.useful||(()=>true),owner=priority(crew,session,useful);
    const active=owner&&(options.turn||0)>=(pool.reserveAfter||0);
    const isOwner=owner&&owner.n===actor.n;
    const reserve=active&&!isOwner?Math.min(budget(pool,owner,session),options.ownerBudget===undefined?pool.max:options.ownerBudget):0;
    const waitForBurst=active&&isOwner&&profile(actor.n).spendAll&&overchargeEnabled(session,actor.n)&&
      pool.current<Math.min(budget(pool,actor,session),options.spendLimit===undefined?pool.max:options.spendLimit)&&options.canWait&&!options.opportunity&&(actor.aetherWaits||0)<1;
    const plan=decide(pool,actor,{...options,useful:useful(actor),mode:(session.aetherModes||{})[actor.n],reserve,
      priority:owner&&owner.n,overcharge:overchargeEnabled(session,actor.n),waitForBurst});
    plan.priority=owner&&owner.n;
    plan.releasesReservation=!!(isOwner&&plan.kind==='skill');
    return plan;
  }
  function recordAction(pool,actor,plan,turn,crewCount){
    if(plan.kind==='skill'){
      actor.aetherWaits=0;
      if(plan.releasesReservation)pool.reserveAfter=turn+crewCount;
    }else if(plan.waiting)actor.aetherWaits=(actor.aetherWaits||0)+1;
  }
  function spend(pool,decision){
    if(decision.kind!=='skill'||pool.current<decision.cost)return false;
    pool.current-=decision.cost;pool.spent+=decision.cost;pool.skills++;return true;
  }
  function credit(pool,amount){
    const actual=Math.min(amount,pool.max-pool.current);
    pool.current+=actual;pool.generated+=actual;pool.wasted+=amount-actual;return actual;
  }
  function generate(pool,amount){pool.basics++;return credit(pool,amount)}
  function skillLabel(name){const p=profile(name);return p.skillGain?'−'+p.cost+' / +'+p.skillGain:p.spendAll?'−'+p.cost+'–all':'−'+p.cost}
  const api={skillLabel,profile,capacity,capacityBreakdown,create,sync,decide,spend,generate,credit,overchargeEnabled,skillCost,budget,priority,teamPlan,recordAction};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SpacologyAether=api;
})(typeof window!=='undefined'?window:globalThis);
