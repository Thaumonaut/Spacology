'use strict';
// Sensor placement (Catdoku / Queens) model: determinism, proven-unique and logic-solvable maps, rules, atomic invalid
// moves, the auto-× assist, hints that are always correct, tiers, the auto fallback and near-miss lines.
const assert=require('node:assert/strict'),S=require('../../prototypes/sensor-grid-model.js');
const {EMPTY,SENSOR,X,AUTO}=S;
const t0=Date.now();
// Big maps (9×9 to 15×15) take fewer seeds in the heavy loops: small maps keep their counts, 9–12 take a few dozen, 15 a few.
const BIG=new Set(['sector','region','theatre','front','continent']);
const seedsFor=(d,small)=>d.size<=8?small:d.size<15?Math.max(4,Math.ceil(small/8)):Math.max(3,Math.ceil(small/20));

// Determinism: same seed and difficulty give the same puzzle; different seeds differ.
for(const d of S.DIFFICULTIES){
  assert.deepEqual(S.generate(42,d.id),S.generate(42,d.id),'same seed must give the same puzzle');
  assert.notDeepEqual(S.generate(42,d.id).region,S.generate(43,d.id).region);
  assert.ok(d.target>=30&&d.target<=(d.size<=8?90:300)&&d.label);
  assert.match(d.label,new RegExp(`${d.size}×${d.size}$`),'the label names the size');
}

// Every generated map, 200 seeds per difficulty: n connected zones, zone r holds solution[r], the stored answer obeys
// every rule, the exhaustive counter finds exactly one solution, and the logic solver reaches it at the promised level.
const sizes={easy:5,normal:6,hard:7,expert:8,sector:9,region:10,theatre:11,front:12,continent:15},levels={},mapCount={};
assert.deepEqual(Object.keys(sizes),S.DIFFICULTIES.map(d=>d.id));
// Bigger target times for bigger maps.
for(let k=1;k<S.DIFFICULTIES.length;k++)assert.ok(S.DIFFICULTIES[k].target>S.DIFFICULTIES[k-1].target);
const connected=(P,cells)=>{const set=new Set(cells),seen=new Set([cells[0]]),q=[cells[0]];
  while(q.length){const i=q.pop(),x=i%P.n;for(const j of [x>0?i-1:-1,x<P.n-1?i+1:-1,i-P.n,i+P.n])if(set.has(j)&&!seen.has(j)){seen.add(j);q.push(j);}}
  return seen.size===cells.length;};
for(const d of S.DIFFICULTIES){
  levels[d.id]=[0,0,0];mapCount[d.id]=d.size<=8?200:d.size<15?30:12;
  for(let seed=1;seed<=mapCount[d.id];seed++){
    const P=S.generate(seed,d.id),G=S.geo(P),tag=`${d.id} seed ${seed}`;
    assert.equal(P.n,sizes[d.id]);assert.equal(P.region.length,P.n*P.n);assert.equal(P.zones.length,P.n);
    assert.equal(new Set(P.zones.map(z=>z.terrain)).size,P.n,'distinct terrains');
    assert.ok(P.zones.every(z=>S.ARCHETYPES[z.contact]&&S.TERRAINS.some(t=>t.id===z.terrain)));
    G.zones.forEach((cells,r)=>{assert.ok(cells.length>=d.minZone,`${tag}: zone ${r} too small`);assert.ok(connected(P,cells),`${tag}: zone ${r} connected`);
      assert.equal(P.solution.filter(c=>P.region[c]===r).length,1,`${tag}: zone ${r} holds one answer cell`);});
    // Zone numbers follow reading order of each zone's first cell, so the swatch list leaks nothing about the answer.
    assert.deepEqual(G.zones.map(z=>z[0]),G.zones.map(z=>z[0]).slice().sort((a,b)=>a-b));
    const m=S.empty(P);P.solution.forEach(c=>m[c]=SENSOR);assert.ok(S.analyze(P,m).solved,`${tag}: stored answer is valid`);
    // Exhaustive proof. On big maps the search only walks the cells the logic leaves open: every solution lies inside
    // that set (the deductions are sound), so this is still a full count, just pruned.
    const c=S.countSolutions(P,2,d.size>8?S.logicSolve(P,d.level).cand:null);assert.equal(c.count,1,`${tag}: exactly one solution`);assert.deepEqual(c.solution,P.solution);
    const L=S.logicSolve(P,d.level);assert.ok(L.solved,`${tag}: logic-solvable at level ${d.level}`);assert.deepEqual(L.sensors,P.solution);
    levels[d.id][L.level]++;
  }
}
// Difficulty is more than size: Easy needs only single-step rules; Hard and Expert mostly need multi-zone reasoning.
assert.deepEqual(levels.easy,[200,0,0]);assert.equal(levels.normal[2],0);assert.equal(levels.hard[2],0);
assert.ok(levels.hard[1]>=100,'hard should mostly need level 1: '+levels.hard);assert.ok(levels.expert[1]+levels.expert[2]>=100,'expert: '+levels.expert);
// Big maps never need a "what if" check, and a good share of them need multi-zone reasoning.
// Big maps are forced by construction: they never need a "what if", and mostly open with the simple deductions.
for(const id of BIG){assert.equal(levels[id][2],0,id);assert.ok(levels[id][0]>=mapCount[id]/2,`${id} level-0 share: ${levels[id]}`);}
// The pruned count agrees with the plain one (checked where the plain one is cheap).
for(const id of ['sector','region'])for(let seed=1;seed<=6;seed++){const P=S.generate(seed,id);
  assert.deepEqual(S.countSolutions(P,2),S.countSolutions(P,2,S.logicSolve(P,1).cand));}
// Generation speed. Big maps now spend extra draws keeping zones as single masses (no zone weaving between the others),
// so 15×15 takes a few seconds and 12×12 up to about two.
const genTimes={};
for(const id of ['front','continent']){const ts=[];
  for(let seed=101;seed<=110;seed++){const t=process.hrtime.bigint();S.generate(seed,id);ts.push(Number(process.hrtime.bigint()-t)/1e6);}
  ts.sort((a,b)=>a-b);genTimes[id]={median:Math.round(ts[5]),max:Math.round(ts[9])};
  const lim=id==='continent'?{max:9000,median:4500}:{max:3000,median:1000};
  assert.ok(ts[9]<lim.max,`${id} generation must stay under ${lim.max} ms, worst was ${ts[9].toFixed(0)} ms`);assert.ok(ts[5]<lim.median,`${id} median ${ts[5]}`);}
// Zone shapes on big maps: simple pieces plus compact blocks, and no zone weaves through the map. Sprawl = border
// length against a square of the same area (1 = square).
for(const id of ['sector','front','continent'])for(let seed=201;seed<=206;seed++){const Q=S.generate(seed,id),n=Q.n;
  for(let z=0;z<n;z++){let A=0,Pm=0;for(let i=0;i<n*n;i++)if(Q.region[i]===z){A++;const x=i%n,y=(i-x)/n;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=n||Y>=n||Q.region[Y*n+X]!==z)Pm++;}}
    assert.ok(Pm/(4*Math.sqrt(A))<=(id==='continent'?3.6:3.2),`${id} seed ${seed} zone ${z} sprawls (${(Pm/(4*Math.sqrt(A))).toFixed(2)})`);
  }
  const sizes_=new Array(n).fill(0);Q.region.forEach(z=>sizes_[z]++);
  assert.ok(sizes_.filter(a=>a>=2&&a<=6).length>=(id==='continent'?2:3),`${id} seed ${seed} has small pieces to start from (${sizes_.join(',')})`);}
// The assist's deductions animate smoothly on 15×15: settling a half-solved board, and the Relaxed probe chain, are fast.
{const Q=S.generate(3,'continent');let mk=S.empty(Q);Q.solution.slice(0,7).forEach(c=>{mk[c]=SENSOR;});
  let t=process.hrtime.bigint();for(let k=0;k<10;k++)S.settle(Q,S.empty(Q),{drop:true});const settleEmpty=Number(process.hrtime.bigint()-t)/1e7;
  t=process.hrtime.bigint();for(let k=0;k<10;k++)S.settle(Q,mk,{drop:true});const settleHalf=Number(process.hrtime.bigint()-t)/1e7;
  t=process.hrtime.bigint();for(let k=0;k<10;k++)S.probeChain(Q,S.empty(Q),[Q.solution[4]]);const chain=Number(process.hrtime.bigint()-t)/1e7;
  genTimes.settle15={empty:+settleEmpty.toFixed(1),half:+settleHalf.toFixed(1),probeChain:+chain.toFixed(1)};
  assert.ok(settleEmpty<50&&settleHalf<50&&chain<50,'15×15 assist deductions are fast: '+JSON.stringify(genTimes.settle15));}

// Rules on a hand-built 4×4 map (zones a b c d):   a a b b
//                                                  a c c b
//                                                  d c c b
//                                                  d d d d
const T={seed:0,difficulty:'easy',n:4,region:[0,0,1,1, 0,2,2,1, 3,2,2,1, 3,3,3,3],zones:['marsh','ridge','ice','reef'].map(t=>({terrain:t,contact:'chaff'})),solution:[]};
const at=(...cells)=>{const m=S.empty(T);cells.forEach(c=>m[c]=SENSOR);return m;};
let A=S.analyze(T,at(0,5));assert.equal(A.pairs.length,1);assert.equal(A.pairs[0].why,'touch','diagonal neighbours touch');
A=S.analyze(T,at(0,2));assert.equal(A.pairs[0].why,'row');
A=S.analyze(T,at(0,8));assert.equal(A.pairs[0].why,'column');
A=S.analyze(T,at(2,7));assert.equal(A.pairs[0].why,'touch');
A=S.analyze(T,at(5,10));assert.equal(A.pairs[0].why,'touch');
A=S.analyze(T,at(1,15));assert.equal(A.pairs.length,0);assert.deepEqual(A.zoneOk,[true,false,false,true]);
A=S.analyze(T,at(1,7,15));assert.equal(A.pairs.find(p=>p.cells.includes(7)).why,'column');assert.equal(A.zoneOk[3],false,'a clashing sensor does not cover its zone');
assert.ok(A.bad.has(7)&&A.bad.has(15)&&!A.bad.has(1));
assert.equal(S.analyze(T,S.empty(T)).solved,false);
assert.match(S.clashText(T,{cells:[0,2],why:'row'}),/A1 and C1 share row 1/);
assert.match(S.clashText(T,{cells:[5,10],why:'zone'}),/both in the ice shelf zone/);
// The hand-built map's own logic: the ridge zone (c) fills the middle; check a reason sentence reads right.
{const P={seed:0,difficulty:'easy',n:5,region:[0,0,0,0,2, 1,1,2,2,2, 1,3,3,3,2, 1,4,4,3,2, 1,1,4,4,4],zones:['marsh','ridge','ice','reef','ash'].map(t=>({terrain:t,contact:'chaff'})),solution:[]};
  const s=S.logicSolve(P,0).steps[0];assert.equal(s.kind,'zonesInLines');
  assert.equal(S.stepReason(P,s),'The marsh zone sits entirely in row 1, so nothing else in row 1 can hold a sensor.');}

// Moves: tap cycle empty → × → sensor → empty; an auto-× cycles like a ×.
assert.equal(S.cycle(EMPTY),X);assert.equal(S.cycle(X),SENSOR);assert.equal(S.cycle(SENSOR),EMPTY);assert.equal(S.cycle(AUTO),SENSOR);
const P=S.generate(9,'normal'),base=S.empty(P),snap=JSON.stringify(base);
for(const bad of [{cell:-1,mark:SENSOR},{cell:P.n*P.n,mark:SENSOR},{cell:1.5,mark:X},{cell:3,mark:AUTO},{cell:3,mark:7},{cell:'3',mark:X},
  {cells:[],mark:X},{cells:[1,99],mark:X},{cells:[1,2],cycle:true},{cell:3},null,'x'])
  assert.ok(S.apply(P,base,bad).error,'invalid move must be rejected: '+JSON.stringify(bad));
assert.equal(JSON.stringify(base),snap,'rejected moves must not mutate marks');
{let r=S.apply(P,base,{cell:4,cycle:true});assert.equal(r.marks[4],X);assert.equal(base[4],EMPTY,'apply returns a copy');
  r=S.apply(P,r.marks,{cell:4,cycle:true});assert.equal(r.marks[4],SENSOR);r=S.apply(P,r.marks,{cell:4,cycle:true});assert.equal(r.marks[4],EMPTY);
  r=S.apply(P,base,{cells:[0,1,2],mark:X});assert.deepEqual(r.marks.slice(0,3),[X,X,X]);}

// Assist: a sensor auto-×s exactly the empty cells it rules out; manual ×s stay manual; removing the sensor or turning
// the assist off clears the auto-×s.
{const G=S.geo(P),s=P.solution[2];let m=S.empty(P);m[G.attacks[s][0]]=X;
  m=S.apply(P,m,{cell:s,mark:SENSOR,assist:true}).marks;
  assert.equal(m[G.attacks[s][0]],X,'manual × untouched');
  assert.equal(m.filter(v=>v===AUTO).length,G.attacks[s].length-1);assert.ok(G.attacks[s].slice(1).every(a=>m[a]===AUTO));
  assert.deepEqual(S.withAuto(P,m,false).filter(v=>v===AUTO),[]);
  m=S.apply(P,m,{cell:s,mark:EMPTY,assist:true}).marks;assert.deepEqual(m.filter(v=>v===AUTO),[]);assert.equal(m.filter(v=>v===X).length,1);
  // The assist never auto-×s a cell holding a sensor (a clash still shows as two sensors).
  const t=G.attacks[s].find(a=>a!==G.attacks[s][0]);m=S.empty(P);m[s]=SENSOR;m[t]=SENSOR;assert.equal(S.withAuto(P,m,true)[t],SENSOR);}

let hintCapped=0;
// Hints from an empty board: following hints alone solves every map, every hint agrees with the answer, and every hint
// is a real deduction (never the 'solution' safety net). Easy hints never need "what if".
for(const d of S.DIFFICULTIES)for(let seed=1;seed<=seedsFor(d,200);seed++){
  const Q=S.generate(seed,d.id),sol=new Set(Q.solution);let mk=S.empty(Q),steps=0;
  while(!S.analyze(Q,mk).solved){
    const h=S.hint(Q,mk);assert.ok(h,'a hint exists while unsolved');
    assert.equal(h.kind,'step',`${d.id} ${seed}: hint must be a deduction`);if(d.id==='easy')assert.notEqual(h.rule,'lookahead');
    assert.ok(h.cells.length>0&&h.reason.length>20);
    // One step at a time: one sensor, or at most HINT_CAP ×s taken from a single deduction, with its area to light up.
    if(h.mark===SENSOR)assert.equal(h.cells.length,1);else{assert.ok(h.cells.length<=S.HINT_CAP,`${d.id} ${seed}: hint marks ${h.cells.length} cells`);hintCapped+=h.all.length>h.cells.length;}
    assert.ok(h.cells.every(c=>h.all.includes(c)&&h.focus.includes(c)));
    for(const c of h.cells)assert.ok(h.reason.includes(S.label(Q,c)),'the hint names the cells it marks');
    for(const c of h.cells)assert.equal(h.mark===SENSOR,sol.has(c),`${d.id} ${seed}: hint on ${S.label(Q,c)} must agree with the answer`);
    for(const c of h.cells)assert.equal(mk[c],EMPTY,'a hint always changes something visible');
    mk=S.apply(Q,mk,{cells:h.cells,mark:h.mark}).marks;assert.ok(++steps<=Q.n*Q.n);
  }
  assert.equal(S.hint(Q,mk),null);
}
assert.ok(hintCapped>100,'big × deductions are split over several hints: '+hintCapped);
// The same with the auto-× assist on (the UI default): hints still solve every map, one step at a time.
for(const d of S.DIFFICULTIES)for(let seed=1;seed<=seedsFor(d,60);seed++){
  const Q=S.generate(seed,d.id),sol=new Set(Q.solution);let mk=S.empty(Q),steps=0;
  while(!S.analyze(Q,mk).solved){
    const h=S.hint(Q,mk);assert.equal(h.kind,'step');assert.ok(h.cells.length<=(h.mark===SENSOR?1:S.HINT_CAP));
    for(const c of h.cells){assert.equal(h.mark===SENSOR,sol.has(c));assert.equal(mk[c],EMPTY);}
    mk=S.apply(Q,mk,{cells:h.cells,mark:h.mark,assist:true}).marks;assert.ok(++steps<=Q.n*Q.n);
  }
}
// Mid-solve: from correct partial boards (half the sensors, a third of the correct ×s, with or without the assist), the
// hint is still a correct deduction.
for(const d of S.DIFFICULTIES)for(let seed=1;seed<=seedsFor(d,60);seed++)for(const assist of [false,true]){
  const Q=S.generate(seed,d.id),sol=new Set(Q.solution);let mk=S.empty(Q);
  Q.solution.forEach((c,k)=>{if((k+seed)%2)mk[c]=SENSOR;});
  for(let i=0,k=0;i<mk.length;i++)if(!sol.has(i)&&(k++%3===seed%3))mk[i]=X;
  mk=S.withAuto(Q,mk,assist);
  const h=S.hint(Q,mk);if(!h){assert.ok(S.analyze(Q,mk).solved);continue;}
  assert.equal(h.kind,'step');for(const c of h.cells){assert.equal(h.mark===SENSOR,sol.has(c));assert.equal(mk[c],EMPTY);}
}
// Hints repair mistakes first: a wrong sensor (preferring one in a clash) becomes ×, then a × on an answer cell clears.
{const Q=S.generate(5,'hard'),sol=new Set(Q.solution),G=S.geo(Q),wrong=G.attacks[Q.solution[0]].find(c=>!sol.has(c));
  let mk=S.empty(Q);mk[Q.solution[0]]=SENSOR;mk[wrong]=SENSOR;
  let h=S.hint(Q,mk);assert.equal(h.kind,'fix');assert.deepEqual(h.cells,[wrong]);assert.equal(h.mark,X);assert.match(h.reason,new RegExp(S.label(Q,wrong)));
  const lone=[...Array(Q.n*Q.n).keys()].find(c=>!sol.has(c));mk=S.empty(Q);mk[lone]=SENSOR;h=S.hint(Q,mk);assert.equal(h.kind,'fix');assert.deepEqual(h.cells,[lone]);
  mk=S.empty(Q);mk[Q.solution[3]]=X;h=S.hint(Q,mk);assert.equal(h.kind,'fix');assert.deepEqual(h.cells,[Q.solution[3]]);assert.equal(h.mark,EMPTY);}

// Line status: rows and columns get ✓ like zones; open counts are the cells still showing nothing.
{const m=at(1,15);const B=S.analyze(T,m);
  assert.deepEqual(B.rowOk,[true,false,false,true]);assert.deepEqual(B.colOk,[false,true,false,true]);
  assert.deepEqual(B.open.row,[3,4,4,3]);m[2]=X;m[3]=AUTO;assert.equal(S.analyze(T,m).open.row[0],1);assert.equal(S.analyze(T,m).open.zone[1],2);
  const C=S.analyze(T,at(1,3));assert.deepEqual(C.rowOk,[false,false,false,false],'two sensors in a row: no ✓');}

// Auto-× follows the sensors exactly: placing marks row, column, zone and the 8 neighbours; removing unmarks them;
// with two sensors, removing one keeps the other's auto-×s.
for(const seed of [3,8,21]){
  const Q=S.generate(seed,'hard'),G=S.geo(Q),[a,b]=Q.solution;let m=S.empty(Q);
  m=S.apply(Q,m,{cell:a,mark:SENSOR,assist:true}).marks;
  const want=new Set(G.attacks[a]);for(let i=0;i<m.length;i++)assert.equal(m[i]===AUTO,want.has(i),'auto-× on exactly the cells a rules out');
  m=S.apply(Q,m,{cell:b,mark:SENSOR,assist:true}).marks;m=S.apply(Q,m,{cell:a,mark:EMPTY,assist:true}).marks;
  const wantB=new Set(G.attacks[b]);for(let i=0;i<m.length;i++)assert.equal(m[i]===AUTO,wantB.has(i),'only b keeps its auto-×s');
}

// Probes: never change the committed marks; shading, clashes, dead units and forced cells follow from geometry.
for(const d of S.DIFFICULTIES)for(let seed=1;seed<=seedsFor(d,40);seed++){
  const Q=S.generate(seed,d.id),G=S.geo(Q),sol=new Set(Q.solution),N=Q.n*Q.n;
  // A correct partial board (some right sensors with auto-×s, a few right ×s), so the answer is still reachable.
  let mk=S.empty(Q);Q.solution.forEach((c,k)=>{if((k+seed)%3===0)mk[c]=SENSOR;});
  for(let i=0,k=0;i<N;i++)if(!sol.has(i)&&mk[i]===EMPTY&&(k++%4===seed%4))mk[i]=X;
  mk=S.withAuto(Q,mk,true);const snap=JSON.stringify(mk);
  for(let c=0;c<N;c++){
    if(mk[c]===SENSOR)continue;
    const r=S.probe(Q,mk,[c]);assert.equal(JSON.stringify(mk),snap,'probing never changes the marks');
    assert.deepEqual(r.probes,[c]);
    // Shaded = the open cells this probe rules out.
    assert.deepEqual(r.shaded,G.attacks[c].filter(a=>mk[a]===EMPTY).sort((x,y)=>x-y));
    // Dead units: no sensor, and every cell is ×/auto-× or ruled out by the probe; checked from the definition.
    const deadByDef=G.units.filter(u=>!u.cells.includes(c)&&!u.cells.some(x=>mk[x]===SENSOR)&&u.cells.every(x=>mk[x]===X||mk[x]===AUTO||G.hit[c*N+x]))
      .map(u=>u.kind+u.k).sort();
    assert.deepEqual(r.dead.map(x=>x.unit.kind+x.unit.k).sort(),deadByDef,`${d.id} ${seed}: dead units for a probe on ${S.label(Q,c)}`);
    for(const x of r.dead)assert.match(x.reason,new RegExp(`^Probe at ${S.label(Q,c)} leaves .* with nowhere to go\\.$`));
    // Compared with the solver: the answer is unique, so a probe on an answer cell never contradicts a correct board,
    // and any contradiction means the probe is off the answer.
    if(sol.has(c))assert.ok(r.ok,`${d.id} ${seed}: probe on answer cell ${S.label(Q,c)} flagged: ${[...r.dead,...r.clashes].map(x=>x.reason)}`);
    if(!r.ok)assert.ok(!sol.has(c));
    if(mk[c]===AUTO)assert.ok(r.clashes.length>0,'a probe on an auto-× clashes with the sensor that ruled it out');
    // Forced: a unit the probe squeezes from several open cells to exactly one.
    for(const f of r.forced){const u=G.units.find(v=>v.kind===f.unit.kind&&v.k===f.unit.k),left=u.cells.filter(x=>mk[x]===EMPTY&&!G.hit[c*N+x]);
      assert.deepEqual(left,[f.cell]);assert.ok(u.cells.filter(x=>mk[x]===EMPTY).length>1);}
  }
  // Every answer cell probed at once: no contradiction, and committing them solves the map.
  const rest=Q.solution.filter(c=>mk[c]!==SENSOR),all=S.probe(Q,mk,rest);
  assert.ok(all.ok);assert.equal(JSON.stringify(mk),snap);
  const done=S.commitProbes(Q,mk,rest,true).marks;assert.ok(S.analyze(Q,done).solved);assert.equal(JSON.stringify(mk),snap,'commit returns a copy');
  // Any two answer cells probed together never contradict each other.
  for(let a=0;a<rest.length;a++)for(let b=a+1;b<rest.length;b++)assert.ok(S.probe(Q,mk,[rest[a],rest[b]]).ok);
}
// Two probes: clashes are named; a unit emptied by two probes together names both; the forced cell is reported.
{const P5={seed:0,difficulty:'easy',n:4,region:[0,0,1,1, 0,2,2,1, 3,2,2,1, 3,3,3,3],zones:['marsh','ridge','ice','reef'].map(t=>({terrain:t,contact:'chaff'})),solution:[]};
  let r=S.probe(P5,S.empty(P5),[0,5]);assert.ok(r.clashes.some(x=>x.reason==='Probes at A1 and B2 touch.'));
  r=S.probe(P5,S.empty(P5),[0,2]);assert.ok(r.clashes.some(x=>x.reason==='Probes at A1 and C1 share row 1.'));
  const m=S.empty(P5);m[1]=SENSOR;r=S.probe(P5,m,[9]);assert.ok(r.clashes.some(x=>x.reason==='Probe at B3 shares column B with the sensor on B1.'));
  // Ice zone (B2 C2 B3 C3): a probe on A2 touches B2 and B3, a probe on D3 touches C2 and C3.
  r=S.probe(P5,S.empty(P5),[4,11]);assert.ok(r.dead.some(x=>x.unit.kind==='zone'&&x.unit.k===2&&x.reason==='Probes at A2 and D3 leave the ice shelf zone with nowhere to go.'),JSON.stringify(r.dead));
  // A single probe on A2 contradicts nothing.
  r=S.probe(P5,S.empty(P5),[4]);assert.ok(r.ok);
  // Marks that already empty a unit are reported as the player's own, not the probe's.
  const mx=S.empty(P5);for(const c of [8,12,13,14,15])mx[c]=X;r=S.probe(P5,mx,[1]);
  assert.ok(r.dead.some(x=>x.reason==='Your marks already leave the reef zone with nowhere to go.'&&!x.by.length),JSON.stringify(r.dead));
  assert.deepEqual(S.probe(P5,m,[1]).probes,[],'a probe on a sensor is ignored');}

// Mistake check: exactly the sensors off the answer, never ×s.
{const Q=S.generate(5,'hard'),sol=new Set(Q.solution),N=Q.n*Q.n,off=[...Array(N).keys()].filter(c=>!sol.has(c));
  const m=S.empty(Q);m[Q.solution[0]]=SENSOR;m[Q.solution[3]]=SENSOR;m[off[4]]=SENSOR;m[off[9]]=X;m[Q.solution[5]]=X;
  assert.deepEqual(S.check(Q,m),{wrong:[off[4]],right:[Q.solution[0],Q.solution[3]].sort((a,b)=>a-b)});
  assert.deepEqual(S.check(Q,S.empty(Q)).wrong,[]);}

// Assist levels (Guided / Relaxed): settle re-derives the simple deductions. Checked against the unique answer: deduced
// ×s only ever land on non-answer cells, auto-dropped sensors only on answer cells, and every cascade terminates.
let drops=0,deduced=0;
const verify2=(r,Q,sol)=>{assert.equal(r.paused,false);r.marks.forEach((m,i)=>{if(m===SENSOR)assert.ok(sol.has(i));if((m===S.DEDUCED||m===AUTO)&&sol.has(i))assert.fail('answer cell crossed out');});};
const shuffled=(list,seed)=>{const r=require('../../prototypes/minigame-kit.js').rng(seed);return r.shuffle(list);};
for(const d of S.DIFFICULTIES)for(let seed=1;seed<=seedsFor(d,100);seed++){
  const Q=S.generate(seed,d.id),sol=new Set(Q.solution),N=Q.n*Q.n;
  const verify=(r,tag)=>{
    assert.equal(r.paused,false,tag);assert.ok(r.steps.length<=2*N,tag+': cascade terminates');
    r.marks.forEach((m,i)=>{if(m===SENSOR)assert.ok(sol.has(i),`${tag}: wrong sensor on ${S.label(Q,i)}`);
      if(m===S.DEDUCED||m===AUTO||m===X)assert.ok(!sol.has(i),`${tag}: answer cell ${S.label(Q,i)} crossed out`);});
    for(const st of r.steps){assert.ok(st.cells.length>0&&st.reason.length>20);if(st.type==='drop'){assert.ok(sol.has(st.cell));drops++;}else deduced+=st.cells.length;}
  };
  for(const drop of [false,true])for(const assist of [true,false]){
    verify(S.settle(Q,S.empty(Q),{drop,assist}),`${d.id} ${seed} empty drop=${drop}`);
    // Relaxed / Guided play: the player places answer sensors in a random order, the board settles after each move;
    // nothing wrong ever appears and the map ends solved.
    let mk=S.empty(Q),moves=0;
    for(const c of shuffled(Q.solution,seed)){
      if(mk[c]===SENSOR)continue;
      const r=S.settle(Q,S.apply(Q,mk,{cell:c,mark:SENSOR}).marks,{drop,assist});verify(r,`${d.id} ${seed} move ${moves} drop=${drop}`);mk=r.marks;moves++;
    }
    assert.ok(S.analyze(Q,mk).solved);if(drop&&d.id==='easy')assert.ok(moves<Q.n,'relaxed drops some sensors in by itself');
    // Settling is idempotent, and removing a sensor takes away exactly what depended on it (deduced ×s are derived).
    const again=S.settle(Q,mk,{drop,assist});assert.deepEqual(again.marks,mk);assert.equal(again.steps.length,0);
  }
  // A wrong × (often just a passing tap) is ignored by the logic, so the assist stays sound and does not pause.
  {const xm=S.empty(Q);xm[Q.solution[0]]=X;verify2(S.settle(Q,xm,{drop:true}),Q,sol);}
  // A wrong sensor pauses the assist: no deduced ×s, no drops.
  const wrong=[...Array(N).keys()].find(c=>!sol.has(c));const bad=S.empty(Q);bad[wrong]=SENSOR;
  const r=S.settle(Q,bad,{drop:true});assert.equal(r.paused,true);assert.ok(!r.marks.some((m,i)=>m===S.DEDUCED||(m===SENSOR&&i!==wrong)));
  // Relaxed probe chain: answer probes never dead-end and their ghosts are answer cells.
  const pc=S.probeChain(Q,S.empty(Q),Q.solution.slice(0,1));assert.equal(pc.dead,null);assert.ok(pc.ghosts.every(c=>sol.has(c)));
  // The Relaxed glow: open cells that are still possible, never one the logic has ruled out.
  const cand=S.candidates(Q,S.settle(Q,S.empty(Q),{drop:false}).marks);assert.ok(Q.solution.every(c=>cand.includes(c)));
}
assert.ok(drops>500&&deduced>2000,`cascades did real work: ${drops} drops, ${deduced} deduced cells`);
{const Q=S.generate(3,'normal'),G=S.geo(Q),s0=Q.solution[0];let m=S.empty(Q);m[s0]=SENSOR;m=S.settle(Q,m,{drop:false}).marks;
  m[s0]=EMPTY;assert.deepEqual(S.settle(Q,m,{drop:false}).marks,S.settle(Q,S.empty(Q),{drop:false}).marks,'removing a sensor removes its deductions');
  // A probe chain that dead-ends says so.
  const off=G.attacks[s0].find(c=>!Q.solution.includes(c));const ch=S.probeChain(Q,S.empty(Q),[off]);
  if(ch.dead)assert.match(ch.dead.reason,/^Following the chain, .* with nowhere to go\.$/);}
assert.equal(S.cycle(S.DEDUCED),SENSOR,'a deduced × taps straight to a sensor, like an auto-×');
// Undo: the UI keeps the settled board before each move. Restoring it (and re-settling, as the UI does) takes back the
// move and its whole cascade at once, at every size.
for(const id of ['normal','front','continent']){const Q=S.generate(2,id);
  let mk=S.settle(Q,S.empty(Q),{drop:true}).marks;const history=[];
  for(const c of Q.solution){if(mk[c]===SENSOR)continue;
    history.push(mk);const r=S.settle(Q,S.apply(Q,mk,{cell:c,mark:SENSOR}).marks,{drop:true});
    const undone=S.settle(Q,history.at(-1),{drop:true}).marks;assert.deepEqual(undone,history.at(-1),`${id}: undo restores the board before the move`);
    assert.ok(r.marks.filter((v,i)=>v!==mk[i]).length>=1);mk=r.marks;}
  assert.ok(S.analyze(Q,mk).solved);}

// Scoring tiers.
const TT=45000;
assert.equal(S.score({solved:true,hints:0,errors:0,ms:20000,targetMs:TT}).tier,'perfect');
assert.equal(S.score({solved:true,hints:0,errors:0,ms:20000,targetMs:TT}).score,100);
assert.equal(S.score({solved:true,hints:1,errors:0,ms:20000,targetMs:TT}).tier,'good');
assert.equal(S.score({solved:true,hints:0,errors:1,ms:20000,targetMs:TT}).tier,'good');
assert.equal(S.score({solved:true,hints:2,errors:0,ms:20000,targetMs:TT}).tier,'partial');
assert.equal(S.score({solved:true,hints:0,errors:0,ms:2*TT+1,targetMs:TT}).tier,'partial');
assert.equal(S.score({solved:true,hints:0,errors:0,ms:2*TT-1,targetMs:TT}).tier,'perfect','slow but inside twice the target is still Perfect');
assert.equal(S.score({solved:false,ms:1000,targetMs:TT}).tier,'failed');
assert.equal(S.score({solved:true,hints:0,errors:0,checks:1,ms:20000,targetMs:TT}).tier,'good','a mistake check costs Perfect');
assert.equal(S.score({solved:true,hints:0,errors:0,checks:1,ms:20000,targetMs:TT}).score,94);
assert.equal(S.score({solved:true,hints:1,errors:0,checks:3,ms:20000,targetMs:TT}).tier,'good','checks never push to Partial');
for(const assist of ['guided','relaxed']){
  assert.equal(S.score({solved:true,hints:0,errors:0,ms:1000,targetMs:TT,assist}).tier,'good','assisted solves are Good, never Perfect');
  assert.equal(S.score({solved:true,hints:5,errors:3,ms:10*TT,targetMs:TT,assist}).tier,'good','…and never punished down to Partial');}
assert.ok(S.score({solved:true,ms:1000,targetMs:TT,assist:'guided'}).score>S.score({solved:true,ms:1000,targetMs:TT,assist:'relaxed'}).score);
assert.equal(S.score({solved:true,ms:1000,targetMs:TT,assist:'puzzle'}).tier,'perfect');

// Auto fallback: half the zones (rounded down), all with their true sensors, deterministic, the player's correct
// sensors kept first, and a score below every solve.
for(const d of S.DIFFICULTIES)for(let seed=1;seed<=seedsFor(d,50);seed++){
  const Q=S.generate(seed,d.id),a=S.autoFallback(Q,S.empty(Q));
  assert.equal(a.zones.length,Math.floor(Q.n/2));assert.deepEqual(S.autoFallback(Q,S.empty(Q)),a,'auto is deterministic');
  const an=S.analyze(Q,a.marks);assert.equal(an.pairs.length,0);assert.equal(an.sensors.length,a.zones.length);assert.ok(an.sensors.every(s=>Q.solution.includes(s)));
  const autoScore=S.score({auto:true,revealed:a.zones.length,total:Q.n});
  assert.equal(autoScore.tier,'auto');assert.ok(autoScore.score<S.score({solved:true,hints:5,errors:5,ms:1e9,targetMs:1000}).score,'auto scores below even a slow solve');
}
{const Q=S.generate(4,'expert'),mk=S.empty(Q);mk[Q.solution[7]]=SENSOR;mk[Q.solution[6]]=SENSOR;
  const a=S.autoFallback(Q,mk);assert.ok(a.zones.includes(Q.region[Q.solution[7]])&&a.zones.includes(Q.region[Q.solution[6]]),'zones the player already covered are kept');}
// A one-cell zone reads as such.
{const Q=S.generate(7,'easy'),h=S.hint(Q,S.empty(Q));assert.match(h.reason,/is a single cell, so its sensor goes on E5\./);}

// Near-miss lines are concrete.
{const Q=S.generate(11,'normal'),f=S.hint(Q,S.empty(Q));
  assert.equal(S.nearMiss(Q,{tier:'perfect'}),'');
  assert.match(S.nearMiss(Q,{tier:'good',hintLog:[f]}),/^Spotting this yourself would have made it Perfect: /);
  assert.ok(S.nearMiss(Q,{tier:'good',hintLog:[f]}).includes(f.reason));
  const pair={cells:[Q.solution[0],Q.solution[0]+1],why:'touch'};
  const nm=S.nearMiss(Q,{tier:'good',hintLog:[],firstError:{pair,step:f}});
  assert.match(nm,new RegExp(`The one slip: ${S.label(Q,pair.cells[0])} and ${S.label(Q,pair.cells[1])} touch\\. The step available then: `));
  assert.match(S.nearMiss(Q,{tier:'partial',hintLog:[f,f]}),/^One fewer hint would have made this Good/);
  assert.equal(S.nearMiss(Q,{tier:'good',hintLog:[],checks:1}),'Solving without the mistake check would have made this Perfect.');
  assert.match(S.nearMiss(Q,{tier:'partial',hintLog:[],ms:100000,targetMs:45000}),/sooner .* Perfect/);
  const a=S.autoFallback(Q,S.empty(Q));
  assert.match(S.nearMiss(Q,{tier:'auto',revealed:a.zones,nextStep:f}),new RegExp(`^Solving would have scouted ${Q.n-a.zones.length} more zones of the elective fight \\(.+\\), for difficulty −${S.scout(Q,Q.zones.map((z,k)=>k),'perfect').reduction} and one of its affixes stripped\\. The next step was there: `));
  assert.match(S.roster({zones:[{contact:'chaff'},{contact:'chaff'},{contact:'warden'}]},[0,1,2]),/^2× chaff, warden$/);}

// The scout report: the elective fight's difficulty drop grows with zones revealed, the solve's tier and the map size;
// a full player scout strips an affix, an automatic sweep never does.
{const tiers=['perfect','good','partial','auto'];
  for(const d of S.DIFFICULTIES){const Q=S.generate(1,d.id),all=Q.zones.map((z,k)=>k);
    for(const t of tiers){let prev=0;for(let k=0;k<=Q.n;k++){const r=S.scout(Q,all.slice(0,k),t);
      assert.ok(r.reduction>=prev,`${d.id} ${t}: more zones never lowers the drop`);prev=r.reduction;
      assert.equal(r.reduction>0,k>0,`${d.id} ${t}: any revealed zone is worth at least 1`);assert.ok(r.reduction<=S.scoutMax(Q.n));
      assert.equal(r.affixStripped,k===Q.n&&t!=='auto');}}
    for(let k=1;k<=Q.n;k++)for(let i=1;i<tiers.length;i++)assert.ok(S.scout(Q,all.slice(0,k),tiers[i-1]).reduction>=S.scout(Q,all.slice(0,k),tiers[i]).reduction,`${d.id}: a cleaner solve never drops less`);
    const full=S.scout(Q,all,'perfect');assert.equal(full.reduction,S.scoutMax(Q.n));
    assert.equal(full.output,`Elective fight scouted: ${Q.n} of ${Q.n} zones · enemy lineup revealed (${S.roster(Q,all)}) · difficulty −${full.reduction} · full scout: one of its affixes stripped.`);
    const a=S.autoFallback(Q,S.empty(Q)),as=S.scout(Q,a.zones,'auto');
    assert.equal(as.output,`Elective fight scouted: ${a.zones.length} of ${Q.n} zones · partial lineup (${S.roster(Q,a.zones)}) · difficulty −${as.reduction}.`);
    assert.ok(as.reduction<full.reduction,`${d.id}: the sweep takes off less than a full scout`);}
  assert.ok(S.scoutMax(15)>S.scoutMax(5),'bigger battlefields can lose more');
  const Q=S.generate(2,'expert');assert.equal(S.scout(Q,[],'perfect').output,'Elective fight not scouted.');
  assert.match(S.scout(Q,[0,1,2,3,4,5],'perfect').output,/^Elective fight scouted: 6 of 8 zones · partial lineup \(.+\) · difficulty −2\.$/);}

const secs=(Date.now()-t0)/1000;
const total=Object.values(mapCount).reduce((a,b)=>a+b,0);
console.log(`PASS sensor-grid model: determinism, ${total} maps 5×5–15×15 proven unique (exhaustive count) and logic-solvable (levels ${JSON.stringify(levels)}), generation ms ${JSON.stringify(genTimes)}, Queens rules, atomic invalid moves, auto-× marks and unmarks, line ✓ and open counts, probes (pure, dead units by definition, never flag an answer cell, commit solves), mistake check, assist levels (Guided/Relaxed cascades over every size × 4 settings: deduced ×s never on the answer, drops always on it, terminating, idempotent, paused on mistakes; probe chains; gentle Good scoring), hint-only solves at every size (assist off and on) with every hint correct, mid-solve and repair hints, tiers, auto fallback = half the zones, near-miss lines, elective-fight scout report (difficulty drop by zones, tier and size; full scout strips an affix) (${secs.toFixed(1)}s)`);
