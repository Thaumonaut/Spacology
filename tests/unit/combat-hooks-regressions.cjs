'use strict';
// Regressions for the combat core's host surface, one case per bug found by review. Each case reports on its own.
const assert=require('node:assert/strict'),H=require('../../prototypes/shared/combat/combat-headless.js');
const sessions=require('./combat-voyage-sessions.json');
const RELAY={team:'relay',planet:'spread',seed:7};
const failures=[];
function check(name,fn){try{fn();console.log('ok    '+name);}catch(e){failures.push(name);console.log('FAIL  '+name+'\n      '+e.message.split('\n').join('\n      '));}}
const firstCrewHit=spec=>H.runFight(spec).events.flatMap(e=>e.hits||[]).find(h=>h.src&&h.src.startsWith('a')&&h.dmg>0).dmg;

// Status damage on a crewmate names the live enemy that applied it, not a stand-in, even after that enemy fell.
const poisoned=sourceDead=>ctx=>{
  const foe=ctx.G.units.find(u=>u.side==='foe'&&!u.treasure);
  ctx.G.units.filter(u=>u.side==='ally'&&u.row==='front').forEach(u=>ctx.SpacologyEnemyTraits.applyStatus(u,'poison',foe.id,false));
  if(sourceDead){foe.hp=0;foe.alive=false;}
};
check('a status tick reports the live enemy that applied it',()=>{
  let ticks=0;
  H.runFight({...sessions['voyage/bridged'],setup:poisoned(false),on:{afterIncoming(p,api){
    if(p.kind!=='poison')return;ticks++;
    assert.equal(p.src,api.U(p.src.id),'the tick named a copy of its source');
  }}});
  assert.ok(ticks>0,'no poison ticked');
});
check('a fallen enemy cannot strike back through its status tick',()=>{
  let extra=0;
  H.runFight({...sessions['voyage/bridged'],setup:poisoned(true),on:{afterIncoming(p,api){
    if(p.kind!=='poison'||!p.src)return;
    if(api.enemyAttack(p.src))extra++;
  }}});
  assert.equal(extra,0,`${extra} attacks by a defeated enemy`);
});

// Returned factors from several outgoing listeners all apply.
// A listener returning a factor must land exactly as the same listener changing p.amount by it.
const returning=f=>p=>p.src.side==='ally'?f:undefined,changing=f=>p=>{if(p.src.side==='ally')p.amount*=f;};
check('every outgoing listener\'s returned factor applies',()=>{
  for(const factors of [[2,2],[1.5,1],[1.5,.5,3]]){
    const byReturn=firstCrewHit({...RELAY,on:{outgoing:factors.map(returning)}});
    const byChange=firstCrewHit({...RELAY,on:{outgoing:factors.map(changing)}});
    assert.equal(byReturn,byChange,`factors ${factors.join(', ')}: returned ${byReturn}, changed ${byChange}`);
  }
});

// Combat time never runs backwards, whatever reformDelay a host asks for.
check('a negative reformDelay never turns the clock back',()=>{
  let threw=false,back=0;
  try{
    let last=-Infinity;
    H.runFight({team:'bloom',planet:'spread',seed:7,rules:{reformDelay:-100},on:{afterHit(p,api){if(api.G.av<last)back++;last=api.G.av;}}});
  }catch(e){threw=true;}
  assert.ok(threw||back===0,`time ran backwards ${back} times`);
});

// Every refused Aether credit is reported on the action it happened in.
check('refused Aether on events matches the refused total',()=>{
  for(const key of ['voyage/weavers','voyage/silen']){
    const r=H.runFight({...sessions[key],on:{gain(p){p.amount=0;}}});
    // Wherever the event carries it: every numeric field named refused, at any depth.
    const refusedIn=v=>!v||typeof v!=='object'?0:Object.entries(v).reduce((n,[k,x])=>n+(k==='refused'&&typeof x==='number'?x:refusedIn(x)),0);
    const onEvents=r.events.reduce((n,e)=>n+refusedIn(e),0);
    assert.equal(onEvents,r.metrics.aether.refused,key+': refused Aether missing from the events');
  }
});

// The treasure carrier never attacks, so enemyAttack refuses it. A Broken enemy can still strike back: the lab's
// "Breaks provoke a counterattack" card depends on it.
check('the treasure carrier cannot be made to attack; a Broken enemy can',()=>{
  const session=JSON.parse(JSON.stringify(sessions['voyage/bridged'].session));session.round=3;
  let carrierChecked=false;
  H.runFight({session,seed:1,maxSteps:0,setup(ctx){
    const carrier=ctx.G.units.find(u=>u.treasure);
    if(carrier){carrierChecked=true;assert.equal(ctx.enemyAttack(carrier),null,'the treasure carrier attacked');}
    const foe=ctx.G.units.find(u=>u.side==='foe'&&!u.treasure);
    ctx.breakEnemy(foe);
    const h=ctx.enemyAttack(foe);
    assert.ok(h&&!h.skipped&&h.dmg>0,'a Broken enemy could not strike back');
  }});
  assert.ok(carrierChecked,'the fixture needs a treasure carrier');
});

// A hook that delays the acting unit delays its next turn, as the payload docs promise (u.av+=60).
check('a hook delaying the acting unit delays its next turn',()=>{
  const nextTurn=push=>{
    let who=null,first=null,next=null;
    H.runFight({...sessions['voyage/weavers'],maxSteps:80,
      setup(ctx){const core=ctx.resolveActionCore;ctx.resolveActionCore=function(){const e=core();
        if(e&&e.actor&&who&&e.actor.id===who&&!e.interrupt&&!e.bonusTurn){if(first===null)first=ctx.G.av;else if(next===null)next=ctx.G.av;}return e;};},
      on:{spend(p){if(!who){who=p.actor.id;if(push)p.actor.av+=push;}}}});
    return next===null?Infinity:next; // pushed past the end of the fight: later than any turn it had
  };
  const plain=nextTurn(0);
  assert.ok(Number.isFinite(plain),'the fixture needs the spender to act again');
  for(const push of [60,600]){
    const pushed=nextTurn(push);
    assert.ok(pushed-plain>=push-1,`pushed ${push} AV, the next turn moved ${pushed-plain}`);
  }
});

// Brace softens a hit; it never turns a hit of 0 into 1, nor spends its charge on one.
check('Brace leaves a hit of 0 at 0',()=>{
  const session=JSON.parse(JSON.stringify(sessions['voyage/bridged'].session));session.shipEquipped=['Brace Matrix II'];
  assert.equal(H.runFight({session,seed:sessions['voyage/bridged'].seed,rules:{enemyAtkMul:0}}).metrics.taken,0);
});

// lowestHp is the lowest health a crewmate actually reached; a crewmate who went down reached 0, revived or not.
check('lowestHp is a health a crewmate reached',()=>{
  for(const key of ['voyage/weavers','voyage/silen','voyage/bridged']){
    let low=Infinity;
    const r=H.runFight({...sessions[key],setup(ctx){ctx.G.units.filter(u=>u.side==='ally'&&!u.summon).forEach(u=>{low=Math.min(low,u.hp);});},
      on:{afterIncoming(p){low=Math.min(low,p.hit.revival?0:p.tgt.hp);}}});
    assert.equal(r.metrics.lowestHp,low,key);
  }
});

// A delay a status tick's hook puts on the ticked crewmate (whose turn it is) delays its next turn too.
check('a status tick\'s hook delaying the crewmate delays its next turn',()=>{
  const nextTurn=push=>{
    let who=null,tickAt=null,next=null;
    H.runFight({...sessions['voyage/bridged'],
      setup(ctx){poisoned(false)(ctx);const core=ctx.resolveActionCore;ctx.resolveActionCore=function(){const e=core();
        if(e&&e.actor&&who&&e.actor.id===who&&!e.interrupt&&!e.bonusTurn&&next===null&&ctx.G.av>tickAt)next=ctx.G.av;return e;};},
      on:{afterIncoming(p,api){if(who||p.kind!=='poison')return;who=p.tgt.id;tickAt=api.G.av;if(push)p.tgt.av+=push;}}});
    assert.ok(who,'no poison ticked');
    return next===null?Infinity:next;
  };
  const plain=nextTurn(0),pushed=nextTurn(60);
  assert.ok(Number.isFinite(plain),'the fixture needs the ticked crewmate to act again');
  assert.ok(pushed-plain>=59,`pushed 60 AV, the next turn moved ${pushed-plain}`);
});

// An enemy a hook fells partway through an area attack is not Broken by the rest of that attack.
check('an area attack never Breaks an enemy felled partway through it',()=>{
  let dead=0,executes=0;
  for(const team of ['bloom','plate','ledger','relay','found','flat'])for(const planet of ['spread','order']){
    H.runFight({team,planet,seed:7,on:{
      afterHit(p,api){
        if(p.src.side!=='ally'||p.kind!=='skill'||p.single)return;
        const others=api.liveFoes().filter(f=>f.id!==p.tgt.id),v=others[others.length-1];
        if(v&&v.shL>0&&!v.broken){v.hp=0;v.alive=false;executes++;}
      },
      break(p){if(!p.tgt.alive)dead++;}}});
  }
  assert.ok(executes>0,'no hook felled an enemy mid-attack');
  assert.equal(dead,0,`${dead} Breaks on enemies already felled`);
});

// A fallen enemy cannot be Broken: no break hook, no Break counted.
check('a fallen enemy is never Broken',()=>{
  const s=JSON.parse(JSON.stringify(sessions['voyage/weavers'].session));
  s.round=4;s.field=['Arunima','Wren',null,null,null];s.support=['Hanae','Ivara','Roonie','Veska',null,null,null];
  let fallen=0,live=0;
  const r=H.runFight({session:s,seed:3,on:{break(p){if(p.tgt.alive)live++;else fallen++;}}});
  assert.equal(fallen,0,`${fallen} Breaks on fallen enemies`);
  assert.equal(r.metrics.breaks,live,'metrics.breaks counted Breaks on fallen enemies');
});

// A crewmate felled partway through its own action (the lab's "Breaks provoke a counterattack" aimed at the breaker)
// damages no more shields and Breaks no more enemies. (A basic still gathers its Aether: the pool's design generates once
// per basic taken, whether or not it lands.)
const provoke={break(p,api){if(p.src&&p.src.alive&&p.tgt.alive)api.enemyAttack(p.tgt,p.src);}};
check('a crewmate felled mid-action Breaks nothing more',()=>{
  let byFallen=0,provoked=0;
  H.runFight({team:'ledger',planet:'order',seed:12,on:{break(p,api){
    if(!p.src.alive)byFallen++;
    else if(p.tgt.alive){provoked++;provoke.break(p,api);}
  }}});
  assert.ok(provoked>0);
  assert.equal(byFallen,0,`${byFallen} Breaks by a crewmate who had already fallen`);
});

// A crewmate felled partway through its own action changes nothing more after the fall: it delays no enemy (Arunima's
// +15 AV), applies no Fracture, and gains no barrier (Daven's Check the Brace), and the metrics don't count it.
check('a crewmate felled mid-action delays, fractures and shields nothing after it falls',()=>{
  const sessions=require('./combat-voyage-sessions.json');
  const sess=k=>{const s=JSON.parse(JSON.stringify(sessions[k].session));s.downRecovery='none';return s};
  const specs=[{session:sess('voyage/weavers')},{session:sess('voyage/bridged')},{team:'bloom',planet:'spread'},{team:'relay',planet:'spread'}];
  let falls=0;const wrong=[];
  for(const spec of specs)for(let seed=1;seed<=30;seed++){
    let fell=null;
    H.runFight({...spec,seed,rules:{enemyAtkMul:8},
      setup(ctx){const core=ctx.resolveActionCore;ctx.resolveActionCore=function(){fell=null;const e=core();
        if(fell){falls++;const G=ctx.G;
          for(const u of G.units.filter(u=>u.side==='foe')){const was=fell.foes[u.id];if(!was)continue;
            if(u.av>was.av+1e-9)wrong.push(`seed ${seed}: ${u.n} delayed ${was.av}->${u.av} after ${fell.n} fell`);
            if((u.frac||0)>was.frac)wrong.push(`seed ${seed}: ${u.n} fractured ${was.frac}->${u.frac} after ${fell.n} fell`)}
          if((fell.u.bar||0)>fell.bar)wrong.push(`seed ${seed}: ${fell.n} gained barrier ${fell.bar}->${fell.u.bar} while down`);
          if(G.metrics&&G.metrics.barrier>fell.metric)wrong.push(`seed ${seed}: barrier metric ${fell.metric}->${G.metrics.barrier} after ${fell.n} fell`)}
        return e}},
      on:{break(p,api){if(p.src&&p.src.side==='ally'&&p.src.alive&&p.tgt.alive){api.enemyAttack(p.tgt,p.src);
        if(!p.src.alive&&!fell)fell={u:p.src,n:p.src.n,bar:p.src.bar||0,metric:api.G.metrics?api.G.metrics.barrier:0,
          foes:Object.fromEntries(api.G.units.filter(u=>u.side==='foe').map(u=>[u.id,{av:u.av,frac:u.frac||0}]))}}}}});
  }
  assert.ok(falls>20,'enough mid-action falls to check ('+falls+')');
  assert.deepEqual(wrong.slice(0,5),[],wrong.length+' effects after the actor fell');
});

// The safe back row (a game rule, in every fight): no enemy damages a back-row crewmate by any route — turns, status
// ticks, reflections, or an enemyAttack aimed straight at them from a hook.
check('the back row is never damaged, in standalone and voyage fights',()=>{
  const sessions=require('./combat-voyage-sessions.json');let backHits=0,aimed=0,checked=0;
  const specs=[...['bloom','plate','ledger','relay','found','flat'].map(team=>({team,planet:'spread'})),...Object.values(sessions).map(x=>({session:x.session}))];
  for(const spec of specs)for(let seed=1;seed<=8;seed++){
    let back=[];
    H.runFight({...spec,seed,
      setup(ctx){back=ctx.G.units.filter(u=>u.side==='ally'&&u.row==='back');back.forEach(u=>u._hp=u.hp);
        const core=ctx.resolveActionCore;ctx.resolveActionCore=function(){const e=core();checked++;
          for(const u of back){if(u.hp<u._hp-1e-9)backHits++;u._hp=u.hp}return e}},
      on:{afterHit(p,api){const foe=api.G.units.find(u=>u.side==='foe'&&u.alive&&!u.treasure),b=back.find(u=>u.alive);
        if(foe&&b&&p.src&&p.src.side==='ally'&&!api.__aimed){api.__aimed=1;aimed++;api.enemyAttack(foe,b);api.__aimed=0}}}});
  }
  assert.ok(aimed>50&&checked>500,'enough attacks aimed at the back row ('+aimed+')');
  assert.equal(backHits,0,backHits+' times a back-row crewmate lost health');
});

// A hit whose damage-based scale is 0 (a Reflect off a hit the barrier fully absorbed; a Lash with nothing stored) lands
// at 0, not at full strength: with enemy attack at 0, nothing is reflected.
check('a zero-scale hit deals nothing',()=>{
  const r=H.runFight({team:'plate',planet:'spread',seed:7,rules:{enemyAtkMul:0}});
  assert.equal(r.metrics.byKind.reflect||0,0,'reflected '+(r.metrics.byKind.reflect||0)+' off hits that dealt nothing');
});

if(failures.length){console.error(`\n${failures.length} failed`);process.exit(1);}
console.log('PASS combat hooks regressions');
