'use strict';
// Synergy links model: determinism; for 200 seeds per difficulty the planted links cover the board exactly, are legal
// non-self-touching paths of 3+ cells, and an independent exhaustive solve finds exactly that one solution; stroke rules
// (retract, cut, restart, endpoints block, complete links stop); invalid moves leave the state untouched; tiers with
// hints and assists; auto below Perfect; dead ends and forced-link cascades; hints that cut wrong lines and always
// converge; the near-miss line. Prints generation timings.
const assert=require('node:assert/strict'),S=require('../../prototypes/minigames/synergy-links/synergy-links-model.js'),Kit=require('../../prototypes/shared/minigames/minigame-kit.js');
const SEEDS=200,ids=S.DIFFICULTIES.map(d=>d.id);
const solvedState=pz=>{const st=S.create(pz);pz.solution.forEach((p,k)=>assert.equal(S.apply(pz,st,{type:'stroke',pair:k,cells:p}),null));return st;};

// Determinism: same (seed, difficulty) → same puzzle; different seeds differ.
for(const d of ids){assert.deepEqual(S.generate(7,d),S.generate(7,d));assert.notDeepEqual(S.generate(7,d).solution,S.generate(8,d).solution);}

const timing={};
for(const d of ids){
  const diff=S.DIFFICULTIES.find(x=>x.id===d),n=diff.size,N=n*n,nb=S.neighbours(n);
  let total=0,slowest=0,attempts=0,turns=0,longest=0,straight=0,solveNodes=0;
  for(let seed=1;seed<=SEEDS;seed++){
    const t=Date.now(),pz=S.generate(seed,d),ms=Date.now()-t;total+=ms;slowest=Math.max(slowest,ms);attempts+=pz.stats.attempts;
    const K=pz.pairs.length;assert.ok(K>=diff.pairs[0]&&K<=diff.pairs[1],`${d}/${seed} pair count ${K}`);
    assert.equal(new Set(pz.pairs.map(p=>p.color)).size,K,'one colour per pair');assert.equal(new Set(pz.pairs.map(p=>p.synergy.id)).size,K,'distinct synergies');
    // The planted links cover every cell exactly once; each runs endpoint to endpoint, orthogonally, 3+ cells, never touching itself.
    const seen=new Uint8Array(N);
    pz.solution.forEach((p,k)=>{
      assert.ok(p.length>=3,`${d}/${seed} link ${k} has ${p.length} cells`);assert.equal(p[0],pz.pairs[k].a);assert.equal(p[p.length-1],pz.pairs[k].b);
      for(let i=0;i<p.length;i++){assert.equal(seen[p[i]],0,'cells used once');seen[p[i]]=1;if(i)assert.ok(S.adjacent(n,p[i-1],p[i]),'orthogonal steps');}
      const pos=new Map(p.map((c,i)=>[c,i]));for(let i=0;i<p.length;i++)for(const x of nb[p[i]])if(pos.has(x))assert.equal(Math.abs(pos.get(x)-i),1,`${d}/${seed} link ${k} touches itself`);
    });
    assert.ok(seen.every(Boolean),'every cell covered');
    const st3=pz.solution.filter(p=>S.straight3(n,p)).length;assert.ok(st3<=diff.maxStraight,`${d}/${seed} ${st3} straight 3-cell links`);straight+=st3;
    turns+=pz.stats.turns;longest+=pz.stats.longest;
    // Independent exhaustive solve with a generous budget: exactly one solution, and it is the planted one.
    const res=S.solveGrid(n,pz.pairs.map(p=>[p.a,p.b]),{limit:2,budget:2e6});solveNodes+=res.nodes;
    assert.ok(res.exhausted,`${d}/${seed} uniqueness search finished`);assert.equal(res.count,1,`${d}/${seed} unique`);
    res.solution.forEach((p,k)=>assert.ok(S.samePath(p,pz.solution[k]),`${d}/${seed} solver finds the planted link ${k}`));
    // Drawing the planted links is Perfect; aids cap at Good; Skip stays below Perfect.
    const st=solvedState(pz),ev=S.evaluate(pz,st);assert.ok(ev.solved);assert.equal(S.tier(pz,ev),'perfect');assert.equal(S.score(pz,ev),100);
    assert.equal(S.tier(pz,ev,{hints:1}),'good');assert.equal(S.tier(pz,ev,{assist:'dead'}),'good');assert.equal(S.tier(pz,ev,{assist:'auto'}),'good');
    assert.equal(S.nearMiss(pz,st),'');assert.equal(S.deadCells(pz,st).length,0);
    const a=S.auto(pz);assert.notEqual(S.tier(pz,a.evaluation),'perfect');assert.ok(a.evaluation.connectedCount>=1&&a.evaluation.connectedCount<K);
    assert.ok(S.score(pz,a.evaluation)<100);assert.match(a.nearMiss,/Skip linked only the \d+ easy pair/);
  }
  timing[d]={avg:(total/SEEDS).toFixed(1),slowest,attempts:(attempts/SEEDS).toFixed(1),turns:(turns/SEEDS).toFixed(1),longest:(longest/SEEDS).toFixed(1),straight3:(straight/SEEDS).toFixed(2),nodes:Math.round(solveNodes/SEEDS)};
  assert.ok(slowest<(d==='large'?1500:400),`${d}: slowest generation ${slowest}ms`);
}

// ---- hand-built fixtures --------------------------------------------------------------------------------------------
const syn=S.SYNERGIES,nm=k=>`${syn[k].from} → ${syn[k].to}`;
const fixture=(size,sol)=>({size,difficulty:'fixture',solution:sol,pairs:sol.map((p,k)=>({id:k,a:p[0],b:p[p.length-1],color:S.COLORS[k],synergy:syn[k]}))});
// 4×4, unique:   A A A A     A: 0-1-2-3-7-11
//                B B B A     B: 6-5-4-8-12-13
//                B C C A     C: 9-10-14-15
//                B B C C
const F=fixture(4,[[0,1,2,3,7,11],[6,5,4,8,12,13],[9,10,14,15]]);
{
  const r=S.solveGrid(4,F.pairs.map(p=>[p.a,p.b]),{limit:5});assert.equal(r.count,1,'4×4 fixture is unique');
  const st=S.create(F),keep=()=>JSON.stringify(st),bad=(m,re)=>{const before=keep(),why=S.apply(F,st,m);assert.match(String(why),re);assert.equal(keep(),before,'invalid move leaves the state untouched');assert.equal(S.validate(F,st,m),why);};
  bad(null,/No move/);bad({type:'jump'},/Unknown/);bad({type:'stroke',pair:5,cells:[0]},/No such/);bad({type:'stroke',pair:0,cells:[]},/Empty/);
  bad({type:'stroke',pair:0,cells:[0,16]},/Off the grid/);bad({type:'stroke',pair:0,cells:[1,2]},/Start on one/);bad({type:'stroke',pair:0,cells:[0,2]},/one square at a time/);
  bad({type:'stroke',pair:0,cells:[0,1,5,6]},/cannot pass through/);bad({type:'stroke',pair:0,cells:[0,4,8,12,13]},/cannot pass through/);bad({type:'extend',pair:0,cell:1},/Start this link/);
  assert.equal(S.apply(F,st,{type:'stroke',pair:0,cells:[0,1,2,3]}),null);
  bad({type:'stroke',pair:0,cells:[3,4]},/one square at a time/); // 3 and 4 are consecutive numbers on different rows
  bad({type:'stroke',pair:0,cells:[1,2,3,7,8]},/one square at a time/);
  assert.equal(S.apply(F,st,{type:'extend',pair:0,cell:7}),null);assert.equal(S.apply(F,st,{type:'extend',pair:0,cell:11}),null);
  assert.deepEqual(st.paths[0],[0,1,2,3,7,11]);assert.ok(S.isConnected(F,st,0));
  bad({type:'stroke',pair:0,cells:[7,11,10]},/already complete/);bad({type:'extend',pair:0,cell:10},/already complete/);
  // Retract onto your own line; continue from a mid-line cell; restart from the other endpoint; tap an endpoint to clear.
  assert.equal(S.apply(F,st,{type:'stroke',pair:0,cells:[1,5,1]}),null);assert.deepEqual(st.paths[0],[0,1],'moving back onto the line retracts it');
  assert.equal(S.apply(F,st,{type:'stroke',pair:0,cells:[1,5,4]}),null);assert.deepEqual(st.paths[0],[0,1,5,4],'a stroke from mid-line keeps the line up to there');
  assert.equal(S.apply(F,st,{type:'stroke',pair:0,cells:[11,7]}),null);assert.deepEqual(st.paths[0],[11,7],'starting at an endpoint restarts the line');
  assert.equal(S.apply(F,st,{type:'stroke',pair:0,cells:[11]}),null);assert.deepEqual(st.paths[0],[],'a tap on an endpoint clears its line');
  // Cutting: B drawn 6-5-1-2; A drawing along the top cuts B where it crossed, keeping 6-5. A cut at the second cell leaves nothing.
  assert.equal(S.apply(F,st,{type:'stroke',pair:1,cells:[6,5,1,2]}),null);
  assert.deepEqual(S.cutsBy(F,st,{type:'stroke',pair:0,cells:F.solution[0]}),[1]);
  assert.equal(S.apply(F,st,{type:'stroke',pair:0,cells:F.solution[0]}),null);assert.deepEqual(st.paths[1],[6,5],'the crossed line is cut where it was crossed');
  assert.equal(S.apply(F,st,{type:'stroke',pair:2,cells:[9,5]}),null);assert.deepEqual(st.paths[1],[],'cut at its second cell, a line disappears');
  // Tiers and scores.
  const e=S.create(F);assert.equal(S.tier(F,S.evaluate(F,e)),'failed');assert.match(S.nearMiss(F,e),/3 links left open/);
  S.apply(F,e,{type:'stroke',pair:0,cells:F.solution[0]});assert.equal(S.tier(F,S.evaluate(F,e)),'partial');
  S.apply(F,e,{type:'stroke',pair:2,cells:F.solution[2]});S.apply(F,e,{type:'stroke',pair:1,cells:F.solution[1]});
  const ev=S.evaluate(F,e);assert.equal(S.tier(F,ev),'perfect');assert.equal(S.tier(F,ev,{hints:2}),'good');assert.ok(S.score(F,ev,{hints:2})<100);
  assert.equal(S.output(F,e),F.pairs.map(q=>`${nm(q.id)}: ${syn[q.id].name}`).join('; '));
  // Long way round: A takes 0-4-5-1-2-3-7-11 through B's route.
  const l=S.create(F);S.apply(F,l,{type:'stroke',pair:0,cells:[0,4,5,1,2,3,7,11]});
  assert.equal(S.nearMiss(F,l),`Your ${nm(0)} link took the long way round and sealed off ${syn[1].from}’s route to ${syn[1].to}.`);
  // Dead ends: B drawn the short way 6-10-14-13 seals C off; the region C would need is dimmed.
  const d=S.create(F);S.apply(F,d,{type:'stroke',pair:0,cells:F.solution[0]});S.apply(F,d,{type:'stroke',pair:1,cells:[6,10,14,13]});
  assert.deepEqual(S.deadCells(F,d),[4,5,8,12]);assert.match(S.nearMiss(F,d),new RegExp(`Your ${nm(1)} link cut across ${syn[2].from}’s route`));
  // A dead cell by count: one open neighbour.
  const d1=S.create(F);S.apply(F,d1,{type:'stroke',pair:0,cells:[0,1,2,3,7,11]});S.apply(F,d1,{type:'stroke',pair:2,cells:[9,10,14,15]});S.apply(F,d1,{type:'stroke',pair:1,cells:[6,5,4,8,12]});
  assert.deepEqual(S.deadCells(F,d1),[],'12 sits beside its partner 13: nothing dead');
  // Forced links: with A drawn correctly, B has one viable route, and then C does: the assist cascades to the full board.
  const f=S.create(F);S.apply(F,f,{type:'stroke',pair:0,cells:F.solution[0]});
  const drawn=S.autoFinish(F,f);assert.deepEqual(drawn.map(x=>x.pair).sort(),[1,2]);assert.ok(S.evaluate(F,f).solved);
  // Hint: B blocks A's only route, so A is hinted first and cuts B; following hints solves the board.
  const h=S.create(F);S.apply(F,h,{type:'stroke',pair:1,cells:[6,5,1,2]});
  const h1=S.hint(F,h);assert.equal(h1.pair,0);assert.deepEqual(h1.cuts,[1]);assert.match(h1.text,/cuts .* out of the way/);
  S.apply(F,h,h1.move);assert.deepEqual(h.paths[1],[6,5]);
  for(let i=0;i<3;i++){const x=S.hint(F,h);if(!x)break;S.apply(F,h,x.move);}
  assert.ok(S.evaluate(F,h).solved);assert.equal(S.hint(F,h),null,'nothing to hint on a solved board');
}
// Gaps: 4×4 with two pairs along the edges; both connected the short way leaves the middle empty (Good, not Perfect).
const G=fixture(4,[[0,1,2,3],[12,8,4,5,6,7,11,10,9,13,14,15]]);
{
  const st=S.create(G);S.apply(G,st,{type:'stroke',pair:0,cells:[0,1,2,3]});S.apply(G,st,{type:'stroke',pair:1,cells:[12,13,14,15]});
  const ev=S.evaluate(G,st);assert.ok(ev.allConnected&&!ev.full);assert.equal(ev.empty,8);assert.equal(S.tier(G,ev),'good');
  assert.deepEqual(S.deadCells(G,st),[4,5,6,7,8,9,10,11],'cells no open pair can reach are dead');
  assert.equal(S.nearMiss(G,st),`All 2 links connected, but 8 cells stayed empty: ${nm(1)} should have run through them.`);
}

// Hints from random messy positions always converge to the unique solution, one correct link at a time.
const scribble=(pz,r,strokes)=>{const st=S.create(pz),nb=S.neighbours(pz.size);
  for(let i=0;i<strokes;i++){const q=r.pick(pz.pairs),cells=[r.chance(0.5)?q.a:q.b];for(let j=0;j<r.range(1,pz.size*2);j++)cells.push(r.pick(nb[cells[cells.length-1]]));
    for(let j=cells.length;j>0;j--)if(!S.validate(pz,st,{type:'stroke',pair:q.id,cells:cells.slice(0,j)})){S.apply(pz,st,{type:'stroke',pair:q.id,cells:cells.slice(0,j)});break;}}
  return st;};
let messy=0,named=0;
for(const d of ids)for(let seed=1;seed<=(d==='large'?10:25);seed++){
  const pz=S.generate(seed,d),r=Kit.rng(seed*31+7),st=scribble(pz,r,pz.pairs.length*2);
  const line=S.nearMiss(pz,st);if(!S.evaluate(pz,st).solved){assert.ok(line.length>10,'a near-miss line for an unsolved board');messy++;if(/^Your /.test(line))named++;}
  for(let step=0;;step++){
    assert.ok(step<=pz.pairs.length,`${d}/${seed} hints converge within one per link`);
    const h=S.hint(pz,st);if(!h)break;
    assert.ok(S.samePath(h.path,pz.solution[h.pair]),'a hint draws the solution link');assert.equal(S.validate(pz,st,h.move),null,'a hint is a legal stroke');
    S.apply(pz,st,h.move);assert.ok(S.correct(pz,st,h.pair));
  }
  assert.ok(S.evaluate(pz,st).solved,`${d}/${seed} hints solve the board`);
}
assert.ok(named>messy*0.5,`the near-miss usually names the blocking link (${named}/${messy})`);

// Auto-finish cascades on small boards: from one correct stroke the forced links can fill the rest.
let cascades=0;
for(let seed=1;seed<=30;seed++){
  const pz=S.generate(seed,'easy'),st=S.create(pz);S.apply(pz,st,{type:'stroke',pair:0,cells:pz.solution[0]});
  const drawn=S.autoFinish(pz,st);for(const f of drawn)assert.equal(S.validate(pz,S.create(pz),{type:'stroke',pair:f.pair,cells:f.path}),null);
  if(drawn.length>=2)cascades++;
}
assert.ok(cascades>=10,`forced links cascade on small boards (${cascades}/30)`);

console.log(`PASS synergy-links model: determinism; ${SEEDS}×${ids.length} seeds verified unique by exhaustive solve, full cover, no self-touching links; stroke, cut, retract and invalid-move rules; tiers, assists and auto below Perfect; hints converge from messy boards; near-miss names the blocking link ${named}/${messy}; cascades ${cascades}/30. Generation ms avg/slowest: ${ids.map(d=>`${d} ${timing[d].avg}/${timing[d].slowest} (${timing[d].attempts} tries, longest ${timing[d].longest}, turns ${timing[d].turns}, straight3 ${timing[d].straight3})`).join('; ')}`);
