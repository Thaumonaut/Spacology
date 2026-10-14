'use strict';
// Core assay (spectrum decomposition) model: determinism, proven-unique and logic-solvable samples, the deduction chain
// and stray-peak guarantees, rules, atomic invalid moves, hints that are always right, Relaxed fills, tiers, the auto
// fallback, nodes and near-miss lines. Run: node tests/unit/core-assay.cjs
const assert=require('node:assert/strict'),A=require('../../prototypes/core-assay-model.js');
const t0=Date.now();
const SEEDS=200;

// Determinism.
for(const d of A.DIFFICULTIES){
  assert.deepEqual(A.generate(42,d.id),A.generate(42,d.id),'same seed, same core');
  assert.notDeepEqual(A.generate(42,d.id).samples.map(s=>s.obs),A.generate(43,d.id).samples.map(s=>s.obs));
  assert.ok(d.label&&d.target>=45&&d.target<=120);
}
assert.deepEqual(A.DIFFICULTIES.map(d=>d.target),[45,60,90,120]);
assert.deepEqual(A.DIFFICULTIES.map(d=>d.minerals),[4,5,6,8]);

// 200 seeds per difficulty: structure, the exhaustive uniqueness proof, the solver, the way in, and depth.
const depthCount={};
for(const d of A.DIFFICULTIES){
  depthCount[d.id]=[0,0,0];
  for(let seed=1;seed<=SEEDS;seed++){
    const P=A.generate(seed,d.id),tag=`${d.id} seed ${seed}`;
    assert.equal(P.channels,d.channels);assert.ok(P.channels>=24&&P.channels<=40);
    assert.equal(P.library.length,d.minerals);assert.equal(P.samples.length,d.samples);assert.equal(P.tol,d.noise);
    assert.equal(new Set(P.library.map(M=>M.id)).size,P.library.length,'distinct minerals');
    assert.equal(new Set(P.library.map(M=>M.peaks.map(p=>p.ch).join())).size,P.library.length,`${tag}: distinct signatures`);
    for(const M of P.library){
      assert.ok(M.peaks.length>=2&&M.peaks.length<=4,`${tag}: ${M.name} has ${M.peaks.length} peaks`);
      assert.equal(new Set(M.peaks.map(p=>p.ch)).size,M.peaks.length);
      for(const p of M.peaks){assert.ok(p.ch>=0&&p.ch<P.channels);assert.ok(p.h>=d.heights[0]&&p.h<=d.heights[1]);}
    }
    if(d.id==='easy')assert.ok(P.library.every(M=>!M.rare),'easy cores are commons only');
    // There is always a peak only one mineral makes.
    assert.ok(P.library.some((_,m)=>A.uniquePeaks(P,m).length>0),`${tag}: a unique peak exists`);
    assert.equal(new Set(P.samples.map(s=>s.amounts.join())).size,P.samples.length,'samples differ');
    P.samples.forEach((s,si)=>{
      const n=s.amounts.filter(a=>a>0).length;
      assert.ok(n>=d.present[0]&&n<=d.present[1],`${tag}: ${n} minerals present`);
      assert.ok(s.amounts.every(a=>Number.isInteger(a)&&a>=0&&a<=3));
      const truth=A.mix(P,s.amounts);
      s.obs.forEach((o,c)=>{assert.ok(o>=0);if(c!==s.stray)assert.ok(Math.abs(o-truth[c])<=P.tol,`${tag}: noise within the band`);});
      if(d.stray){
        assert.ok(Number.isInteger(s.stray),`${tag}: one stray per Expert sample`);
        assert.ok(P.byChannel[s.stray].every(x=>s.amounts[x.m]===0),'the stray sits where no present mineral peaks');
        assert.ok(s.obs[s.stray]-truth[s.stray]>=2,'the stray clears the band');
      }else assert.equal(s.stray,null);
      // Exhaustive count: exactly one answer, and it is the planted one.
      const c=A.countSolutions(P,si);
      assert.equal(c.count,1,`${tag} sample ${si}: exactly one answer`);
      assert.deepEqual(c.solutions[0].amounts,s.amounts);assert.equal(c.solutions[0].stray,s.stray);
      assert.ok(A.flatline(P,si,s.amounts,s.stray),'the answer flatlines');
      // The deduction solver reaches it from one channel at a time, starting from a single-mineral peak.
      const S=A.solve(P,si);
      assert.ok(S.solved,`${tag} sample ${si}: logic-solvable`);assert.deepEqual(S.amounts,s.amounts);assert.equal(S.stray,s.stray);
      // The way in: a single-mineral channel, or (Expert, before the stray is found) a flat channel ruling minerals out.
      const first=S.steps[0];
      if(!d.stray)assert.equal(first.level,0,`${tag}: the way in is a single-mineral channel`);
      // Expert: only upper bounds count until the stray is proven (a stray only adds), then every other channel is trusted.
      else{const k=S.steps.findIndex(x=>x.kind==='stray');assert.ok(k>=0);assert.ok(S.steps.slice(0,k).every(x=>x.upper&&x.value===0&&s.obs[x.channel]<=P.tol),`${tag}: the stray is proven by flat channels alone`);assert.ok(S.steps.slice(k+1).every(x=>!x.upper));}
      assert.ok(S.steps.every(x=>typeof x.reason==='string'&&/Channel \d+/.test(x.reason)));
      const depth=Math.max(0,...S.steps.filter(x=>x.kind==='fix'&&s.amounts[x.mineral]>0).map(x=>x.level));
      depthCount[d.id][depth]++;
      if(d.id==='hard'||d.id==='expert'){
        assert.ok(depth>=1,`${tag} sample ${si}: the solver uses a shared-channel step`);
        // ...and one is unavoidable: some present mineral has no peak of its own.
        assert.ok(s.amounts.some((a,m)=>a>0&&A.uniquePeaks(P,m).length===0),`${tag} sample ${si}: a present mineral with only shared peaks`);
      }
    });
  }
}
// Easy mostly reads straight off unique peaks; Hard and Expert always need shared-channel reasoning.
assert.ok(depthCount.easy[0]>=60,'easy depth '+depthCount.easy);

// ---- Rules on a fixed core ----
const P=A.generate(7,'normal'),s0=P.samples[0],L=P.library.length;
{
  const right={amounts:s0.amounts.slice(),flag:null};
  assert.ok(A.channelStates(P,0,right.amounts,null).every(x=>x==='match'));
  // One unit too many on a mineral: every one of its peak channels reads "over" by its height; one too few: "under".
  const m=s0.amounts.findIndex(a=>a>0&&a<3),up=right.amounts.slice();up[m]++;
  const res=A.residual(P,0,up),stt=A.channelStates(P,0,up,null);
  for(const p of P.library[m].peaks){assert.equal(res[p.ch],-p.h);assert.equal(stt[p.ch],'over');}
  const down=right.amounts.slice();down[m]--;
  for(const p of P.library[m].peaks)assert.equal(A.channelStates(P,0,down,null)[p.ch],'under');
  assert.ok(!A.flatline(P,0,up,null));
  // Unset counts as 0 in the mix.
  assert.deepEqual(A.mix(P,new Array(L).fill(null)),new Array(P.channels).fill(0));
}
// Invalid moves leave the state untouched (same object, same contents); valid ones never mutate their input.
{
  const st=A.empty(P),snap=JSON.stringify(st);
  for(const mv of [null,{type:'amount',mineral:-1,value:1},{type:'amount',mineral:L,value:1},{type:'amount',mineral:0,value:4},
    {type:'amount',mineral:0,value:1.5},{type:'amount',mineral:0,value:-1},{type:'flag',channel:3},{type:'jump'}]){
    const r=A.apply(P,st,mv);assert.equal(r.ok,false,JSON.stringify(mv));assert.equal(r.state,st);assert.equal(JSON.stringify(st),snap);assert.ok(r.reason);
  }
  const r=A.apply(P,st,{type:'amount',mineral:1,value:2});assert.ok(r.ok);assert.equal(r.state.amounts[1],2);assert.equal(JSON.stringify(st),snap);
  assert.equal(A.apply(P,r.state,{type:'amount',mineral:1,value:null}).state.amounts[1],null,'an amount can be cleared');
  const E=A.generate(3,'expert'),es=A.empty(E);
  for(const mv of [{type:'flag',channel:-1},{type:'flag',channel:E.channels},{type:'flag',channel:2.5}])assert.equal(A.apply(E,es,mv).ok,false);
  assert.equal(A.apply(E,es,{type:'flag',channel:4}).state.flag,4);assert.equal(es.flag,null);
}
// Tests: exact only on the planted answer; wrong names exactly the wrong minerals; Expert checks the flag too.
{
  assert.deepEqual(A.test(P,0,{amounts:s0.amounts.slice(),flag:null}),{exact:true,wrong:[],flagWrong:false});
  const g=s0.amounts.slice();g[0]=(g[0]+1)%4;g[2]=(g[2]+2)%4;
  assert.deepEqual(A.test(P,0,{amounts:g,flag:null}),{exact:false,wrong:[0,2],flagWrong:false});
  const unset=s0.amounts.map(a=>a===0?null:a);assert.ok(A.test(P,0,{amounts:unset,flag:null}).exact,'unset counts as 0');
  const E=A.generate(9,'expert'),es=E.samples[1];
  assert.ok(A.test(E,1,{amounts:es.amounts.slice(),flag:es.stray}).exact);
  assert.deepEqual(A.test(E,1,{amounts:es.amounts.slice(),flag:null}),{exact:false,wrong:[],flagWrong:true});
  assert.ok(!A.flatline(E,1,es.amounts,null),'Expert never flatlines without the flag');
  const wrongFlag=(es.stray+3)%E.channels;assert.ok(!A.flatline(E,1,es.amounts,wrongFlag));
  assert.equal(A.channelStates(E,1,es.amounts,es.stray)[es.stray],'stray');
}
// Hints: always the planted value, never a mineral the player already has right, chain to the answer, null when done.
for(const d of A.DIFFICULTIES)for(let seed=1;seed<=40;seed++){
  const Q=A.generate(seed,d.id);
  Q.samples.forEach((s,si)=>{
    let st=A.empty(Q),n=0;
    for(;;){
      const h=A.hint(Q,si,st);if(!h)break;n++;assert.ok(n<=Q.library.length+1,'hints terminate');
      assert.ok(/Channel \d+/.test(h.reason));
      if(h.kind==='flag'){assert.equal(h.channel,s.stray);st=A.apply(Q,st,{type:'flag',channel:h.channel}).state;}
      else{assert.equal(h.value,s.amounts[h.mineral],'hint value is right');assert.notEqual(st.amounts[h.mineral],h.value);
        assert.ok(Q.library[h.mineral].peaks.some(p=>p.ch===h.channel),'the hint points at one of the mineral’s peaks');
        st=A.apply(Q,st,{type:'amount',mineral:h.mineral,value:h.value}).state;}
    }
    assert.ok(A.test(Q,si,st).exact,`${d.id} ${seed}: following hints solves the sample`);
    // From a partly right state (half the minerals set right, one set wrong), the hint skips the right ones.
    const part=A.empty(Q);s.amounts.forEach((a,m)=>{if(m%2===0)part.amounts[m]=a;});
    const bad=1%Q.library.length;part.amounts[bad]=(s.amounts[bad]+1)%4;
    const h=A.hint(Q,si,part);
    if(h&&h.kind==='amount'){assert.notEqual(part.amounts[h.mineral],s.amounts[h.mineral]);assert.equal(h.value,s.amounts[h.mineral]);}
  });
}
// Relaxed: from a blank sample every fill is right (they chain from unique peaks); a wrong value can force a wrong
// fill (honest consequences), and Expert waits for the flag unless the stray sits on an empty channel.
for(const d of A.DIFFICULTIES)for(let seed=1;seed<=40;seed++){
  const Q=A.generate(seed,d.id);
  Q.samples.forEach((s,si)=>{
    const r=A.relaxedFills(Q,si,A.empty(Q));
    for(const f of r.fills)assert.equal(f.value,s.amounts[f.mineral],`${d.id} ${seed}: relaxed fill is right`);
    if(d.stray){const empty=Q.byChannel[s.stray].length===0;if(r.flag!==null)assert.equal(r.flag,s.stray);if(!empty)assert.equal(r.flag,null);}
    else assert.ok(r.fills.length>=1,'something is forced at the start');
  });
}
// Relaxed after a move reads only channels where the moved mineral peaks, and never cascades.
{
  const Q=A.generate(11,'hard'),s=Q.samples[0],st=A.empty(Q);
  for(let m=0;m<Q.library.length;m++){
    const one=A.apply(Q,st,{type:'amount',mineral:m,value:s.amounts[m]}).state,r=A.relaxedFills(Q,0,one,m);
    for(const f of r.fills){assert.ok(Q.library[m].peaks.some(p=>p.ch===f.channel));assert.equal(f.value,s.amounts[f.mineral]);}
    assert.equal(new Set(r.fills.map(f=>f.mineral)).size,r.fills.length);
  }
}
// Tiers and scores.
{
  const n=P.samples.length,ok=Array.from({length:n},()=>({exact:true,testsUsed:1,hints:0}));
  assert.deepEqual(A.grade(P,ok),{tier:'perfect',score:100,exact:n});
  assert.equal(A.grade(P,ok,{relaxed:true}).tier,'good','Relaxed is never Perfect');assert.ok(A.grade(P,ok,{relaxed:true}).score<100);
  assert.equal(A.grade(P,[{exact:true,testsUsed:2,hints:0},...ok.slice(1)]).tier,'good');
  assert.equal(A.grade(P,[{exact:true,testsUsed:1,hints:1},...ok.slice(1)]).tier,'good','a hint costs Perfect');
  assert.equal(A.grade(P,[{exact:false,testsUsed:3,failed:true},...ok.slice(1)]).tier,'partial');
  assert.equal(A.grade(P,ok.map(()=>({exact:false,testsUsed:3,failed:true}))).tier,'failed');
  assert.equal(A.grade(P,ok.map(()=>({exact:false,testsUsed:3,failed:true}))).score,0);
  assert.deepEqual([1,2,3].map(t=>A.sampleScore({exact:true,testsUsed:t,hints:0})),[100,70,45]);
  assert.equal(A.sampleScore({exact:true,testsUsed:1,hints:9}),10);
  // Auto: below Perfect, keeps solved samples, rough nodes for the rest.
  const au=A.auto(P,[{exact:true,testsUsed:1,hints:0}]);assert.ok(au.score<100&&au.score>0);
  assert.equal(au.results.filter(r=>r.auto).length,n-1);assert.ok(au.nodes.slice(1).every(x=>/rough survey/.test(x.text)));
  assert.ok(A.auto(P,[]).score<A.grade(P,ok).score);
}
// Nodes: richness from the dominant amount; rare minerals make rare nodes.
{
  const Q=JSON.parse(JSON.stringify(P));
  const crystal=Q.library.findIndex(M=>M.id==='crystal'),brine=Q.library.findIndex(M=>M.id==='brine');
  Q.library.forEach(M=>{M.rare=false;});
  if(crystal>=0&&brine>=0){const a=new Array(L).fill(0);a[crystal]=2;a[brine]=1;Q.samples[0].site='Ash ridge';
    assert.equal(A.node(Q,0,a).text,'Resource node found: rich crystal bloom (2) + salt brine (1) at Ash ridge');}
  const a=new Array(L).fill(0);a[0]=3;assert.match(A.node(Q,0,a).text,/^Resource node found: deep /);
  Q.library[0].rare=true;assert.match(A.node(Q,0,a).text,/^Rare resource node found/);
  assert.match(A.node(Q,0,a,'auto').text,/: rich .*\(rough survey\)$/);
}
// Near miss: empty when clean; otherwise the channel that would have told you about the first wrong mineral.
{
  const n=P.samples.length,ok=Array.from({length:n},()=>({exact:true,testsUsed:1,hints:0}));
  assert.equal(A.nearMiss(P,ok),'');
  const S=A.solve(P,1),wrongM=S.steps.filter(x=>x.kind==='fix').at(-1).mineral,step=S.steps.find(x=>x.kind==='fix'&&x.mineral===wrongM);
  const r=ok.slice();r[1]={exact:true,testsUsed:2,hints:0,firstWrong:[wrongM]};
  assert.equal(A.nearMiss(P,r),`Sample 2: channel ${step.channel+1} would have told you. ${step.reason}`);
  const E=A.generate(9,'expert'),ES=A.solve(E,0),er=E.samples.map(()=>({exact:true,testsUsed:1,hints:0}));
  er[0]={exact:false,testsUsed:3,failed:true,firstWrong:['flag']};
  assert.match(A.nearMiss(E,er),new RegExp(`^Sample 1: channel ${E.samples[0].stray+1} would have told you\\. .*stray peak`));
  assert.ok(ES.steps.some(x=>x.kind==='stray'));
}
const secs=(Date.now()-t0)/1000;assert.ok(secs<20,`took ${secs}s`);
console.log(`PASS core-assay model: deterministic; ${SEEDS} seeds × 4 difficulties, every sample proven unique by exhaustive count and solved one channel at a time (from a single-mineral peak; Expert: flat channels prove the stray first); Hard/Expert always hold a present mineral with only shared peaks (depth ${JSON.stringify(depthCount)}); strays provable; atomic invalid moves; right hints; honest Relaxed fills; tiers, auto, nodes and near-miss (${secs.toFixed(1)}s)`);
