'use strict';
const assert=require('node:assert/strict');
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const {createAtlas}=require('../../prototypes/labs/microvoxel-world/hex-atlas.js');
const {createSession,target}=require('../../prototypes/labs/microvoxel-world/coop-session.js');
function play(extent,days=6){
  const w=M.createWorld(2718,.25,extent),s=createSession(w,createAtlas(w)),log=[];s.join('a');s.join('b');
  assert.equal(s.claim('a','explore'),null);assert.equal(s.claim('b','explore'),'That role is taken.');assert.equal(s.claim('b','research'),null);
  for(let i=0;i<days*3;i++){
    const v=s.viewFor('a'),r=s.viewFor('b');
    assert.ok(!r.hexes.some(h=>h.state==='planned'),'research never sees the explorer plan');
    if(v.phase==='night'){for(const h of v.hexes.filter(h=>h.state==='frontier'||h.state==='hinted').sort((x,y)=>x.cost-y.cost||x.key.localeCompare(y.key)).slice(0,3))assert.equal(s.intent('a',{kind:'toggle',key:h.key}),null);
      for(const h of r.hexes.filter(h=>h.state==='signs').slice(0,2))s.intent('b',{kind:'toggle',key:h.key});
      assert.equal(s.intent('a',{kind:'pack',supplies:4}),'Logistics packs at night.');}
    if(v.phase==='day'){assert.match(s.intent('a',{kind:'toggle',key:'0,0'}),/plans at night/);for(const k of r.samples.slice(0,2))assert.equal(s.intent('b',{kind:'toggle',key:k}),null);}
    const phase=v.phase;s.ready('a');assert.equal(s.snapshot().phase,phase,'phase waits for every human seat');assert.deepEqual(s.viewFor('a').waiting,['research']);
    s.ready('b');if(s.snapshot().phase==='dusk')log.push(s.snapshot().report);
  }
  return log;
}
for(const extent of [128,'infinite']){
  const log=play(extent);assert.deepEqual(log.map(r=>r.target),[1,2,3,4,5,6].map(target));
  assert.equal(log[0].delivered,8,'day one: only the root delivers');assert.ok(log.some(r=>!r.met),'the root alone falls short of the rising target');
  assert.ok(log.some(r=>r.lines.length>=2&&r.met),'a connected second line meets a target the root cannot');
  assert.deepEqual(play(extent),log,'sessions are deterministic from seed and plans');
}
{const w=M.createWorld(2718,.25,128),s=createSession(w,createAtlas(w));s.join('solo');s.claim('solo','logistics');
  for(let i=0;i<9;i++)s.ready('solo');assert.equal(s.snapshot().day,4,'autopilots never block a solo player');s.leave('solo');assert.equal(s.snapshot().seats.logistics,null);}
console.log('coop-session: phase gating, privacy, autopilots, economy and determinism');
