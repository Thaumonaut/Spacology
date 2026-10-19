/* Serializable enemy behaviors shared by combat and focused rule tests. */
(function(root){
  'use strict';
  const definitions={
    mender:{name:'Medic',sector:1,art:'mender',hp:72,dmg:9,sp:96,layers:1,guard:16,description:'Every third active turn heals the most injured living ally for 25% of its maximum health. Two heals per battle; never revives. Break the medic or finish its patient first.'},
    sapper:{name:'Disruptor',sector:1,art:'sapper',hp:62,dmg:10,sp:104,layers:1,guard:16,description:'Spends a turn marking a front-row target, then strikes for 70% damage and delays it 30 AV. Breaking cancels the charge. Never delays the same target consecutively; a crew member can only be delayed once per 100 AV. Barriers prevent the delay.'},
    venom:{name:'Venom carrier',sector:1,art:'cleanser',hp:62,dmg:9,sp:100,layers:1,guard:16,description:'Every second attack applies Poison (damage over time, or DoT): up to 3 stacks, 3% maximum health per stack for 3 scheduled turns. Reapplication refreshes duration. Any barrier at impact prevents application.'},
    bulwark:{name:'Bodyguard',sector:1,art:'bulwark',hp:100,dmg:11,sp:84,layers:2,guard:20,description:'Links to one ally, preferring a medic, and intercepts 35% of single-target health damage. Area damage bypasses the link. Breaking removes protection until the guard recovers. Links cannot chain.'},
    leech:{name:'Aether leech',sector:1,art:'reflector',hp:65,dmg:10,sp:102,layers:1,guard:16,description:'Every second turn steals 1 shared Aether instead of attacking, storing at most 2. Breaking or defeating it returns the stored charges, up to your pool capacity. This affects the shared pool, never targets the back row.'},
    hexer:{name:'Hexer',sector:2,art:'reflector',hp:60,dmg:10,sp:100,layers:1,guard:16,description:'Every second attack hexes a front-row target. Its next skill costs +1 Aether; any next action clears the hex, including a basic or ultimate. Barriers block application; cleansing removes it.'},
    anchor:{name:'Standard bearer',sector:2,art:'anchor',hp:88,dmg:10,sp:92,layers:2,guard:18,description:'While any shield remains, other enemies deal 20% more damage. Multiple banners do not stack. Breaking the bearer switches the aura off immediately.'},
    saboteur:{name:'Saboteur',sector:2,art:'sapper',hp:64,dmg:9,sp:102,layers:1,guard:16,description:'Every third attack plants a bomb. It detonates after the target’s next 2 scheduled turns for 18% maximum health. It cannot stack or refresh. Barriers prevent planting and absorb the explosion; cleansing removes it.'},
    duelist:{name:'Duelist',sector:2,art:'quickstep',hp:74,dmg:11,sp:108,layers:1,guard:18,description:'First spends a turn marking one front-row crew member. Repeated attacks gain 20% damage, capped at +60%. Breaking resets the mark and buildup. A new target always gets a warning turn.'},
    brood:{name:'Brood host',sector:3,art:'anchor',hp:86,dmg:10,sp:94,layers:1,guard:18,description:'Releases up to 2 weak chaff on defeat unless defeated while broken. The normal reinforcement cap applies. Offspring cannot reproduce and award no additional recovery points.'},
    bruiser:{name:'Berserker',sector:2,art:'bruiser',hp:92,dmg:14,sp:90,layers:1,guard:20,description:'At half health, permanently loses its shield and gains 40% attack damage. Rage does not cancel an existing break. Finish it rather than leaving it wounded.'},
    channeler:{name:'Channeler',sector:3,art:'warden',hp:78,dmg:14,sp:88,layers:2,guard:18,description:'Spends a full turn charging a marked front-row target, then deals 220% attack damage. Break or defeat it to cancel. If the target falls, the stored attack is lost.'},
    scorcher:{name:'Scorcher',sector:2,art:'sapper',hp:62,dmg:9,sp:100,layers:1,guard:16,description:'Every second attack applies Burn (DoT): 6% maximum health for 2 scheduled turns. Reapplication refreshes rather than stacks. Barriers block application and absorb ticks; cleansing removes it.'},
    bloodletter:{name:'Bloodletter',sector:3,art:'quickstep',hp:66,dmg:10,sp:106,layers:1,guard:16,description:'Every second attack applies Bleed (DoT) for 3 scheduled turns: 4% maximum health after an attacking turn. Once per turn, never per hit. Extra turns, ultimates and follow-ups do not trigger it. Barriers block application.'}
  };
  const valid=u=>u?.side==='foe'&&!u.boss&&!u.treasure&&!u.enemyMinion;
  const type=u=>valid(u)?definitions[u.archetype]:null;
  const front=units=>units.filter(u=>u.side==='ally'&&u.alive&&u.row==='front'&&!u.summon);
  const fronts=(u,units)=>front(units).filter(t=>t.id!==u.lastDelayTarget);
  const choose=units=>units.slice().sort((a,b)=>(b.taunt||1)-(a.taunt||1)||(a.hp/a.max)-(b.hp/b.max)||a.id.localeCompare(b.id))[0];
  function kit(role){const d=definitions[role];return d?{...d,n:d.name,trait:d.name,haste:0,cap:0}:null}
  function roster({sector=1,format='survey',index=2,wave=1,size=3,seed=0}){
    if(format==='swarm')return Array(size).fill('chaff');
    if(format==='ambush')return Array(size).fill('quickstep');
    if(format==='boss')return ['warden'];
    const roles=Object.keys(definitions).filter(k=>definitions[k].sector<=sector);
    const result=Array.from({length:size},(_,i)=>i%2?'cleanser':'chaff');
    let h=0;for(const c of String(seed))h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;
    const offset=(h+index+wave*3)%roles.length;
    const specialists=Math.min(size,sector===1?1:2);
    for(let i=0;i<specialists;i++)result[i]=roles[(offset+i)%roles.length];
    if(sector===1&&index===2)result[0]=wave===1?'mender':'summoner';
    else if((h+index+wave)%4===0)result[0]='summoner';
    if(format==='elite')result[size-1]=sector===1?'bulwark':sector===2?'anchor':'bruiser';
    return result;
  }
  function linkGuards(units){
    for(const u of units){
      if(!type(u)||u.archetype!=='bulwark')continue;
      if(!u.alive||u.broken){delete u.guardTarget;continue;}
      const eligible=units.filter(t=>t.alive&&valid(t)&&t.id!==u.id&&t.archetype!=='bulwark');
      if(!eligible.some(t=>t.id===u.guardTarget))u.guardTarget=eligible.sort((a,b)=>(b.archetype==='mender')-(a.archetype==='mender')||a.max-b.max)[0]?.id;
    }
  }
  function protector(target,units){return units.find(u=>u.alive&&!u.broken&&type(u)&&u.archetype==='bulwark'&&u.guardTarget===target.id)}
  function damageMultiplier(u,units){
    if(u.side!=='foe'||u.treasure)return 1;
    const banner=units.some(x=>x!==u&&x.alive&&!x.broken&&x.shL>0&&type(x)&&x.archetype==='anchor');
    return (u.enraged?1.4:1)*(banner?1.2:1);
  }
  function refund(u,pool){
    const stored=u.stolenAether||0;u.stolenAether=0;
    if(!pool)return {stored,returned:0};
    const returned=Math.min(stored,Math.max(0,pool.max-pool.current));pool.current+=returned;
    pool.returned=(pool.returned||0)+returned;
    return {stored,returned};
  }
  function interrupt(u,pool){
    delete u.chargeTarget;delete u.guardTarget;delete u.duelTarget;u.duelStacks=0;
    return refund(u,pool);
  }
  function enrage(u){
    if(!type(u)||u.archetype!=='bruiser'||!u.alive||u.enraged||u.hp>u.max/2)return false;
    u.enraged=true;u.shL=0;u.shC=0;u.shMax=0;return true;
  }
  function plan(u,units,pool,av=0){
    if(!type(u)||!u.alive||u.broken)return null;
    u.traitTurns=(u.traitTurns||0)+1;
    const turn=u.traitTurns,kind=u.archetype;
    if(kind==='mender'&&turn%3===0&&(u.healUses||0)<2){
      const patient=units.filter(t=>t.alive&&t.side==='foe'&&!t.treasure&&t.id!==u.id&&t.hp<t.max).sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];
      if(patient){u.healUses=(u.healUses||0)+1;return {kind:'heal',target:patient.id,amount:Math.min(patient.max-patient.hp,Math.ceil(patient.max*.25))};}
    }
    if(kind==='leech'&&turn%2===0&&pool?.current>0&&(u.stolenAether||0)<2){pool.current--;u.stolenAether=(u.stolenAether||0)+1;return {kind:'steal'};}
    if(kind==='sapper'||kind==='channeler'){
      if(u.chargeTarget){const id=u.chargeTarget;delete u.chargeTarget;const target=front(units).find(t=>t.id===id);
        if(!target)return {kind:'fizzle'};
        if(kind==='sapper')u.lastDelayTarget=id;
        return {kind:'strike',target:id,scale:kind==='sapper'?.7:2.2,delay:kind==='sapper'?30:0};
      }
      const target=choose(kind==='sapper'?fronts(u,units).filter(t=>(t.delayImmuneUntil||0)<=av):front(units));
      if(target){u.chargeTarget=target.id;return {kind:'charge',target:target.id};}
    }
    if(kind==='duelist'){
      let target=front(units).find(t=>t.id===u.duelTarget);
      if(!target){target=choose(front(units));if(!target)return null;u.duelTarget=target.id;u.duelStacks=0;return {kind:'mark',target:target.id};}
      const scale=1+Math.min(3,u.duelStacks||0)*.2;u.duelStacks=Math.min(3,(u.duelStacks||0)+1);return {kind:'strike',target:target.id,scale};
    }
    const ailment={venom:'poison',scorcher:'burn',bloodletter:'bleed',hexer:'hex',saboteur:'bomb'}[kind];
    if(ailment&&turn%(kind==='saboteur'?3:2)===0)return {kind:'strike',status:ailment,scale:.8};
    return null;
  }
  const durations={poison:3,burn:2,bleed:3,bomb:2,hex:1};
  function applyStatus(target,kind,source,blocked){
    if(!durations[kind]||!target?.alive||target.row!=='front'||target.summon||blocked)return false;
    const states=target.ailments||(target.ailments={}),old=states[kind];
    if(kind==='bomb'&&old)return false;
    states[kind]={turns:durations[kind],stacks:kind==='poison'?Math.min(3,(old?.stacks||0)+1):1,source};
    return true;
  }
  function cleanse(target){const count=Object.keys(target.ailments||{}).length;target.ailments={};return count;}
  function statusDamage(target,attacked){
    const hits=[],states=target.ailments||{};
    for(const [kind,status] of Object.entries(states)){
      if(kind==='hex')continue;
      let fraction=kind==='poison'?.03*status.stacks:kind==='burn'?.06:kind==='bleed'&&attacked?.04:0;
      status.turns--;
      if(kind==='bomb'&&status.turns<=0)fraction=.18;
      if(fraction)hits.push({kind,source:status.source,amount:Math.max(1,Math.round(target.max*fraction))});
      if(status.turns<=0)delete states[kind];
    }
    return hits;
  }
  function labels(u,units=[]){
    if(!u.alive)return '';
    if(u.side==='ally')return Object.entries(u.ailments||{}).map(([k,s])=>k==='hex'?'HEX +1':k==='bomb'?'BOMB '+s.turns:k.toUpperCase()+' '+(k==='poison'?s.stacks+'× ':'')+s.turns).join(' · ');
    if(!type(u))return '';
    if(u.broken)return 'BREAK';
    const name=id=>units.find(t=>t.id===id)?.n||'TARGET';
    if(u.chargeTarget)return (u.archetype==='sapper'?'DELAY ':'CHARGED → ')+name(u.chargeTarget);
    if(u.archetype==='mender')return (u.healUses||0)>=2?'HEALS SPENT':(u.traitTurns||0)%3===2?'HEAL NEXT':'HEAL IN '+(3-(u.traitTurns||0)%3);
    if(u.archetype==='leech')return (u.stolenAether||0)+' AETHER STORED';
    if(u.archetype==='bulwark')return u.guardTarget?'GUARD → '+name(u.guardTarget):'BODYGUARD';
    if(u.archetype==='anchor')return u.shL>0?'BANNER +20%':'BANNER OFF';
    if(u.archetype==='bruiser')return u.enraged?'RAGE +40%':'RAGE AT 50%';
    if(u.archetype==='duelist')return u.duelTarget?'DUEL → '+name(u.duelTarget)+' +'+Math.min(60,(u.duelStacks||0)*20)+'%':'MARK NEXT';
    if(u.archetype==='brood')return 'BROOD ON DEFEAT';
    const next={venom:'POISON',scorcher:'BURN',bloodletter:'BLEED',hexer:'HEX',saboteur:'BOMB'}[u.archetype];
    return next?next+' IN '+((u.archetype==='saboteur'?3:2)-(u.traitTurns||0)%(u.archetype==='saboteur'?3:2)):'CHARGE NEXT';
  }
  function threat(u){
    if(!type(u)||u.broken)return 0;
    if(u.chargeTarget)return 2.5;
    if(u.stolenAether)return 1.5;
    if(u.guardTarget||(u.archetype==='anchor'&&u.shL>0))return 1.2;
    if(u.archetype==='mender'&&(u.healUses||0)<2)return (u.traitTurns||0)%3===2?2:0.6;
    return 0;
  }
  const api={definitions,type,kit,roster,front,linkGuards,protector,damageMultiplier,refund,interrupt,enrage,plan,applyStatus,cleanse,statusDamage,labels,threat};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SpacologyEnemyTraits=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
