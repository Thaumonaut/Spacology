'use strict';
// The combat core's host surface (hooks, per-fight rules, metrics, state), driven through prototypes/combat-headless.js.
const assert=require('node:assert/strict'),crypto=require('crypto'),H=require('../../prototypes/combat-headless.js');
const prints=require('./combat-fingerprints.json').fights,sessions=require('./combat-voyage-sessions.json');
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const view=r=>({end:r.end,steps:r.steps,events:r.events,units:r.units,aether:r.aether});
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
const FIGHTS={};
for(const team of ['bloom','plate','ledger','relay','found','flat'])for(const planet of ['spread','order'])FIGHTS[team+'/'+planet]={team,planet,seed:7};
for(const [key,{session,seed}] of Object.entries(sessions))FIGHTS[key]={session,seed};
const HOOKS=['spend','gain','outgoing','afterHit','break','afterIncoming'];
const KINDS=['basic','skill','ult','follow','chain','reflect','transfer','attack','poison','burn','bleed','bomb'];

// Listening changes nothing: every hook attached, every fight is the recorded one, and the counts agree with the fight.
for(const [key,spec] of Object.entries(FIGHTS)){
  const seen={},kinds=new Set();let spent=0;
  const on={};
  for(const name of HOOKS)on[name]=p=>{
    seen[name]=(seen[name]||0)+1;
    if(['outgoing','afterHit','afterIncoming'].includes(name))kinds.add(p.kind);
    if(name==='spend')spent+=p.amount;
  };
  const r=H.runFight({...spec,on});
  assert.equal(sha(view(r)),prints[key].sha256,key+': listening changed the fight');
  for(const k of kinds)assert.ok(KINDS.includes(k),`${key}: unknown hit kind ${k}`);
  const landed=r.events.reduce((n,e)=>n+(e.timeline||[]).length,0);
  assert.equal(seen.afterHit||0,landed,key+': afterHit does not match the hits that landed');
  assert.equal(seen.break||0,r.metrics.breaks,key+': break does not match the Breaks');
  if(r.metrics.aether)assert.equal(spent,r.metrics.aether.spent,key+': spend does not match the Aether spent');
  // Damage by kind is the crew's damage, plus the two kinds that bypass hits: the Bloom's burn and barrier ammo.
  assert.equal(sum(r.metrics.byKind),sum(r.metrics.dealt)+(r.metrics.byKind.bloom||0)+(r.state.ammoDmg||0),key+': byKind does not add up');
  // The state is plain JSON: units in full in G.units, and as '#id' anywhere else.
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(r.state))),JSON.stringify(r.state));
  assert.equal(r.state.units.length,r.units.length);
  assert.ok(r.state.units.every(u=>typeof u==='object'&&u.id),key+': a unit in G.units was not written in full');
}

// outgoing: the amount is the hit before mitigation. Setting it to 0 silences the crew; returning a number multiplies.
{
  const r=H.runFight({...FIGHTS['relay/spread'],on:{outgoing(p){if(p.src.side==='ally')p.amount=0;}}});
  assert.equal(sum(r.metrics.byKind),0,'the crew dealt damage through an outgoing of 0');
  assert.notEqual(r.end,'Crew wins');
  const first=r=>r.events.flatMap(e=>e.hits||[]).find(h=>h.src&&h.src.startsWith('a')&&h.dmg>0);
  const base=first(H.runFight(FIGHTS['relay/spread'])),doubled=first(H.runFight({...FIGHTS['relay/spread'],on:{outgoing:p=>p.src.side==='ally'?2:undefined}}));
  assert.ok(Math.abs(doubled.dmg-2*base.dmg)<=1,`a returned 2 should double the first hit: ${base.dmg} then ${doubled.dmg}`);
}

// gain: setting the amount to 0 refuses the Aether, and the refusal is counted and reported on the action.
{
  const r=H.runFight({...FIGHTS['voyage/weavers'],on:{gain(p){p.amount=0;}}});
  assert.equal(r.metrics.aether.generated,0,'Aether was generated through a gain of 0');
  assert.ok(r.metrics.aether.refused>0,'no refused Aether was counted');
  assert.ok(r.events.some(e=>e.aether&&e.aether.refused>0),'no action reported its refused Aether');
}

// break and afterHit: the breaker is the crewmate, and the breaker's next hit on that enemy reports broke. That hit
// never comes if follow-ups finish the enemy first, as they always do in voyage/bridged.
for(const [key,spec] of Object.entries(FIGHTS)){
  let breaks=0,broke=0;
  H.runFight({...spec,on:{
    break(p){breaks++;assert.equal(p.src.side,'ally');assert.equal(p.tgt.broken,true);},
    afterHit(p){if(p.broke){broke++;assert.equal(p.src.side,'ally');assert.notEqual(p.kind,'follow');}}
  }});
  assert.ok(broke<=breaks,`${key}: ${broke} hits reported broke after ${breaks} Breaks`);
  if(key==='voyage/weavers')assert.ok(broke>0,'no hit reported broke');
}

// A frozen crewmate's turns pass, one per point of freeze, and it fires no ultimate while frozen.
{
  const r=H.runFight({...FIGHTS['relay/spread'],setup(ctx){ctx.G.units.find(u=>u.id==='a0').frozen=2;}});
  const own=r.events.map((e,i)=>({e,i})).filter(({e})=>e.actor==='#a0'&&!e.interrupt);
  assert.deepEqual(own.slice(0,3).map(({e})=>!!e.frozen),[true,true,false],'a0 should lose exactly its first two turns');
  assert.ok(own[0].e.hits.every(h=>h.src!=='a0'),'a frozen turn dealt damage');
  const thawed=own[1].i;
  assert.ok(!r.events.slice(0,thawed+1).some(e=>e.actor==='#a0'&&e.interrupt),'a0 fired an ultimate while frozen');
}

// enemyAttack: an extra enemy attack from a hook. In a voyage fight it never lands on the back row, chosen or given.
{
  const got={};
  const r=H.runFight({...FIGHTS['voyage/bridged'],on:{afterHit(p,api){
    if(got.done||p.kind!=='basic')return;
    got.done=true;
    const foe=api.liveFoes()[0],back=api.livingCrew().find(u=>u.row==='back');
    got.back=back&&api.enemyAttack(foe,back);
    got.free=api.enemyAttack(foe);got.freeTarget=got.free&&api.U(got.free.tgt);
  }}});
  assert.ok(got.back,'the fixture needs a back-row crewmate');
  assert.equal(got.back.skipped,true,'an enemyAttack on the back row landed');
  assert.equal(got.freeTarget.row,'front','enemyAttack chose a back-row target');
  assert.ok(r.events.some(e=>(e.hits||[]).includes&&e.hits.some(h=>h.src===got.free.src&&h.tgt===got.free.tgt&&h.dmg===got.free.dmg)),'the extra attack is missing from the event');
}

// Rules: each one does what it says, in its own fight only.
{
  const healed=H.runFight({...FIGHTS['bloom/spread'],rules:{healMul:0}}).metrics;
  assert.equal(healed.healed,0,'healMul 0 still healed');
  assert.equal(H.runFight({...FIGHTS['plate/spread'],rules:{barrierMul:0}}).metrics.barrier,0,'barrierMul 0 still shielded');
  const calm=H.runFight({...FIGHTS['plate/spread'],rules:{enemyAtkMul:0}});
  assert.equal(calm.metrics.taken,0,'enemyAtkMul 0 still hurt the crew');
  // The rules stayed in their fight: the next fight is the recorded one.
  assert.equal(sha(view(H.runFight(FIGHTS['plate/spread']))),prints['plate/spread'].sha256,'a rule leaked into the next fight');

  const idle=rules=>H.runFight({...FIGHTS['bloom/spread'],maxSteps:0,keepContext:true,rules}).context;
  const delay=rules=>{const ctx=idle(rules),foe=ctx.G.units.find(u=>u.side==='foe'),before=foe.av;ctx.breakEnemy(foe);return foe.av-before;};
  assert.ok(Math.abs(delay({reformDelay:50})-delay({})-50)<1e-9,'reformDelay did not add 50 AV');
  const layers=rules=>Array.from(idle(rules).G.units.filter(u=>u.side==='foe'),u=>u.shMax); // copied out of the fight's realm
  const base=layers({});
  assert.ok(base.every(n=>n>0),'the fixture needs shielded enemies');
  assert.deepEqual(layers({layerDelta:1}),base.map(n=>n+1));
  assert.deepEqual(layers({layerDelta:-9}),base.map(()=>1),'layerDelta took a shielded enemy below one layer');

  const tuned=idle({SOAK:.9,BRK:{vuln:.5}});
  assert.equal(tuned.SOAK,.9);assert.equal(tuned.BRK.vuln,.5);assert.equal(tuned.BRK.delay,.35,'a partial BRK lost its other keys');
  for(const bad of [{nope:1},{healMul:-1},{healMul:'2'},{layerDelta:.5},{BRK:{nope:1}},{BRK:2},{SOAK:NaN}])
    assert.throws(()=>H.runFight({...FIGHTS['bloom/spread'],maxSteps:0,rules:bad}),undefined,`accepted ${JSON.stringify(bad)}`);
}

console.log(`PASS combat hooks: ${Object.keys(FIGHTS).length} fights unchanged under every hook; hooks, freeze, enemyAttack, rules, metrics and state`);
