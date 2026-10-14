'use strict';
// Pipes (rotating pipe puzzle) model: determinism, 200 seeds per difficulty planted, valid and counted unique by the
// solver (cross-checked against brute force on small boards), rules (leaks, contamination, bridges, slots), atomic
// invalid moves, locks, the Relaxed cascade, hints that are always right, tiers, the auto fallback and near-miss lines.
const assert=require('node:assert/strict'),M=require('../../prototypes/pipes-model.js');
const t0=Date.now(),budget=ms=>Date.now()-t0<ms;
const N=P=>P.n*P.n;

// Determinism.
for(const d of M.DIFFICULTIES){
  assert.deepEqual(M.generate(42,d.id),M.generate(42,d.id));
  assert.notDeepEqual(M.generate(42,d.id).start,M.generate(43,d.id).start);
}
assert.deepEqual(M.DIFFICULTIES.map(d=>d.target),[30,45,75,120]);

// 200 seeds per difficulty: planted answer solves, the solver agrees and counts the answers, structure is sound.
const rates={};
for(const d of M.DIFFICULTIES){
  let unique=0,bridges=0,slots=0,par=0,relaxFrac=0;
  for(let seed=1;seed<=200;seed++){
    const P=M.generate(seed,d.id),tag=`${d.id} seed ${seed}`;
    assert.equal(P.n,d.size);assert.equal(P.cells.length,N(P));
    assert.equal(P.nets.length,d.nets.length);
    P.nets.forEach((net,k)=>{assert.equal(net.type,d.nets[k][0]);assert.equal(net.sources.length,d.nets[k][1]);
      assert.equal(P.cells[net.sink].kind,'sink');net.sources.forEach(s=>assert.equal(P.cells[s].kind,'source'));});
    // endpoints have one fixed outlet; bridges only where wanted; slots and tray agree
    P.cells.forEach(c=>{if(c.kind==='source'||c.kind==='sink')assert.equal([1,2,4,8].includes(c.mask),true,tag);});
    const nb=P.cells.filter(c=>c.kind==='bridge').length;assert.ok(nb>=d.bridges[0]&&nb<=d.bridges[1],`${tag}: ${nb} bridges`);
    assert.equal(P.slots.length,d.slots,tag);assert.equal(Object.values(P.tray).reduce((a,b)=>a+b,0),d.slots);
    const solved=M.solvedState(P),a=M.analyze(P,solved);assert.ok(a.solved,`${tag}: planted answer solves`);
    assert.equal(a.fed,P.nets.length);assert.equal(a.dry,0);
    assert.ok(!M.analyze(P,M.initial(P)).solved,`${tag}: start is not solved`);
    const r=M.solve(P,{limit:2});assert.ok(r.count>=1&&r.complete,tag);
    assert.equal(P.unique,r.count===1,tag);
    if(d.unique)assert.equal(r.count,1,`${tag}: unique at ${d.id}`);
    // every solution the solver finds follows the rules
    for(const sol of r.solutions)assert.ok(M.analyzeMasks(P,sol.map(c=>c&15),true).solved);
    assert.ok(P.par>P.minTaps&&P.minTaps>0,tag);if(d.budget)assert.equal(P.budget,Math.ceil(P.par*1.3));else assert.equal(P.budget,null);
    unique+=P.unique?1:0;bridges+=nb;par+=P.par;
    const s=M.settle(P,M.initial(P));relaxFrac+=s.steps.length/P.cells.filter(c=>c.kind==='pipe').length;
    // whole-board settling is sound: every tile it locks matches the (unique) answer
    if(P.unique)for(const st of s.steps)assert.equal(M.maskAt(P,s.state,st.cell),P.solution.mask[st.cell],`${tag}: settle at ${M.label(P,st.cell)}`);
  }
  rates[d.id]={unique:`${unique}/200`,bridges:(bridges/200).toFixed(2),par:Math.round(par/200),localChain:(relaxFrac/200).toFixed(2)};
}

// Solver against brute force on small boards (3×3 and 4×4, with slots and bridges), including multi-answer boards.
{let checked=0,multi=0;
  const cfgs=[{id:'easy',size:3,nets:[['ore',1]],bridges:[0,0],slots:0},{id:'normal',size:3,nets:[['ore',1],['water',1]],bridges:[0,0],slots:0},
    {id:'hard',size:3,nets:[['ore',1]],bridges:[0,0],slots:2},{id:'hard',size:4,nets:[['ore',1],['water',1]],bridges:[0,1],slots:0},
    {id:'hard',size:4,nets:[['ore',1]],bridges:[0,0],slots:3},{id:'hard',size:4,nets:[['ore',1],['crystal',1]],bridges:[0,1],slots:3}];
  const brute=P=>{const cells=P.cells.map((c,i)=>i).filter(i=>P.cells[i].kind==='pipe'||P.cells[i].kind==='slot'),st=M.initial(P);let count=0;
    const pieces=Object.keys(P.tray).filter(p=>P.tray[p]>0);
    const ok=i=>{for(let j=0;j<=i;j++){const m=M.maskAt(P,st,j);for(let d=0;d<4;d++){const q=M.nbr(P.n,j,d);
      if(q<0){if(m&M.BIT[d])return false;continue;}if(q>i)continue;if(!!(m&M.BIT[d])!==!!(M.maskAt(P,st,q)&M.BIT[(d+2)%4]))return false;}}return true;};
    (function rec(k){if(k===cells.length){if(M.analyze(P,st).solved)count++;return;}const i=cells[k],c=P.cells[i];
      if(c.kind==='pipe'){for(let r=0;r<M.PIECES[c.piece].period;r++){st.rot[i]=r;if(ok(i))rec(k+1);}return;}
      for(const p of pieces){if(!(M.trayLeft(P,st)[p]>0))continue;st.placed[i]=p;for(let r=0;r<M.PIECES[p].period;r++){st.rot[i]=r;if(ok(i))rec(k+1);}st.placed[i]=null;}})(0);
    return count;};
  for(let seed=1;seed<=300;seed++){let P;try{P=M._build(seed,cfgs[seed%cfgs.length]);}catch{continue;}
    const b=brute(P);assert.ok(b>=1);assert.equal(M.solve(P,{limit:1000}).count,b,`small board ${seed}`);checked++;if(b>1)multi++;}
  assert.ok(checked>=200&&multi>=5,`brute force cross-check ${checked}/${multi}`);rates.brute={checked,multi};}

// Rules on a real board.
const P=M.generate(7,'expert'),S0=M.initial(P),sol=M.solvedState(P);
{
  const pipe=P.cells.findIndex(c=>c.kind==='pipe'&&c.piece==='elbow');
  // rotation turns the mask clockwise; four taps come back round; counter-clockwise undoes one
  const r1=M.rotate(P,S0,pipe,1);assert.ok(r1.ok);assert.equal(M.maskAt(P,r1.state,pipe),M.rotM(M.maskAt(P,S0,pipe),1));assert.equal(r1.state.taps,1);
  assert.equal(M.maskAt(P,M.rotate(P,r1.state,pipe,-1).state,pipe),M.maskAt(P,S0,pipe));
  let s=S0;for(let k=0;k<4;k++)s=M.rotate(P,s,pipe,1).state;assert.equal(M.maskAt(P,s,pipe),M.maskAt(P,S0,pipe));assert.equal(s.taps,4);
  assert.equal(S0.taps,0,'moves never mutate the state they are given');
  // invalid moves return the very same state object
  const src=P.nets[0].sources[0],sink=P.nets[0].sink,br=P.cells.findIndex(c=>c.kind==='bridge'),slot=P.slots[0];
  for(const [i,why] of [[src,/fixed/],[sink,/fixed/],[br,/same every way/],[slot,/empty slot/],[-1,/No such/],[999,/No such/]]){
    const r=M.rotate(P,S0,i,1);assert.equal(r.ok,false);assert.equal(r.state,S0);assert.match(r.reason,why);}
  const locked=M.toggleLock(P,S0,pipe).state;assert.ok(locked.locked[pipe]);
  {const r=M.rotate(P,locked,pipe,1);assert.equal(r.ok,false);assert.equal(r.state,locked);assert.match(r.reason,/locked/);}
  assert.equal(M.toggleLock(P,locked,pipe).state.locked[pipe],false);
  {const r=M.toggleLock(P,S0,src);assert.equal(r.ok,false);assert.equal(r.state,S0);}
  {const r=M.toggleLock(P,S0,slot);assert.equal(r.ok,false,'an empty slot cannot be locked');}
  // budget: at the budget no further rotation is possible
  {const full={...S0,taps:P.budget},r=M.rotate(P,full,pipe,1);assert.equal(r.ok,false);assert.equal(r.state,full);assert.match(r.reason,/Out of rotations/);}
  // slots: place from the tray, not twice, not without stock, not on pipes; lift returns it
  const piece=P.solution.piece[slot];
  {const r=M.place(P,S0,slot,piece);assert.ok(r.ok);assert.equal(r.state.placed[slot],piece);assert.equal(M.trayLeft(P,r.state)[piece],P.tray[piece]-1);
    const again=M.place(P,r.state,slot,piece);assert.equal(again.ok,false);assert.equal(again.state,r.state);
    const l=M.lift(P,r.state,slot);assert.ok(l.ok);assert.equal(l.state.placed[slot],null);
    const lockedSlot=M.toggleLock(P,r.state,slot).state,ll=M.lift(P,lockedSlot,slot);assert.equal(ll.ok,false);assert.equal(ll.state,lockedSlot);}
  {const r=M.place(P,S0,pipe,piece);assert.equal(r.ok,false);assert.equal(r.state,S0);}
  {const missing=M.TRAY_ORDER.find(p=>!P.tray[p]),r=M.place(P,S0,slot,missing);assert.equal(r.ok,false);assert.equal(r.state,S0);}
  {let s=S0;for(const sl of P.slots){const p=P.solution.piece[sl];if(M.trayLeft(P,s)[p]>0)s=M.place(P,s,sl,p).state;}
    const used=M.TRAY_ORDER.find(p=>P.tray[p]>0);const empty=P.slots.find(sl=>!s.placed[sl]);
    if(empty!==undefined){const r=M.place(P,s,empty,used);if(!(M.trayLeft(P,s)[used]>0)){assert.equal(r.ok,false);assert.equal(r.state,s);}}}
  {const r=M.lift(P,S0,slot);assert.equal(r.ok,false);assert.equal(r.state,S0);}
  // the best orientation on placement: in the solved neighbourhood, it seals the slot exactly as the answer does
  {const s=M.lift(P,sol,slot).state,r=M.place(P,s,slot,piece);assert.equal(M.maskAt(P,r.state,slot),P.solution.mask[slot]);assert.ok(M.analyze(P,r.state).solved);}
  // a missing slot piece leaves the board unsolved even though nothing else changes
  assert.equal(M.analyze(P,M.lift(P,sol,slot).state).solved,false);
}
// Leaks, dry pipes, contamination, bridges.
{
  // turning one wet pipe in the solved board opens leaks and unseals its line
  const i=P.cells.findIndex((c,k)=>c.kind==='pipe'&&c.piece!=='straight'&&c.net===P.nets[0].type);
  const s=M.rotate(P,sol,i,1).state,a=M.analyze(P,s);assert.ok(!a.solved);assert.ok(a.leaks.length>0);
  assert.ok(a.leaks.some(l=>l.cell===i||M.nbr(P.n,l.cell,l.dir)===i),'the leak is at the turned tile or its neighbour');
  assert.equal(a.nets.find(x=>x.type===P.nets[0].type).sealed,false);
  // contamination: a two-product board where a source of one product is wired into the other network
  let found=false;
  for(let seed=1;seed<=60&&!found;seed++){const Q=M.generate(seed,'normal'),q=M.solvedState(Q);
    // a pipe of one product beside a pipe of the other: turn both until they face each other, and the joint mixes
    for(let k=0;k<N(Q)&&!found;k++){const c=Q.cells[k];if(c.kind!=='pipe')continue;
      for(let d=1;d<3&&!found;d++){const j=M.nbr(Q.n,k,d);if(j<0||Q.cells[j].kind!=='pipe'||Q.cells[j].net===c.net)continue;
        for(let r=0;r<16&&!found;r++){let s=q;for(let t=0;t<r%4;t++)s=M.rotate(Q,s,k,1).state;for(let t=0;t<(r>>2);t++)s=M.rotate(Q,s,j,1).state;
          const a=M.analyze(Q,s);
          if((M.maskAt(Q,s,k)&M.BIT[d])&&(M.maskAt(Q,s,j)&M.BIT[(d+2)%4])&&a.claimed[k*2]&&a.claimed[j*2]&&a.claimed[k*2]!==a.claimed[j*2]){
            found=true;assert.ok(a.contam.length>=1,'the joint is contaminated');assert.ok(!a.solved);assert.ok(a.nets.some(x=>x.mixed));
            assert.ok(a.contam.some(ct=>(ct.a===k&&ct.b===j)||(ct.a===j&&ct.b===k)),'the marker sits on the joint between the two tiles');
            assert.ok(a.nets.every(x=>!x.mixed||!x.fed),'a mixed network feeds nothing');}}}}}
  assert.ok(found,'two facing tiles of different products contaminate');
  // bridges carry two products without mixing
  const b=P.cells.findIndex(c=>c.kind==="bridge"),ab=M.analyze(P,sol);
  assert.notEqual(ab.claimed[b*2],ab.claimed[b*2+1],'the two channels of a bridge carry different products');
  assert.deepEqual([...new Set(P.cells[b].nets)].length,2);
  // dry: an all-dry pipe section is counted and blocks the solve
  assert.ok(M.analyze(P,S0).dry>0);
}
// Hints: always right. Follow hints from the start (and from a board with a wrong lock) until solved.
{let boards=0,steps=0;
  for(const d of M.DIFFICULTIES)for(let seed=1;seed<=12&&budget(17000);seed++){
    const Q=M.generate(seed,d.id);let s=M.initial(Q);
    if(seed%3===0){const k=Q.cells.findIndex((c,i)=>c.kind==='pipe'&&c.piece!=='straight'&&M.maskAt(Q,s,i)!==Q.solution.mask[i]);s=M.toggleLock(Q,s,k).state;
      const h=M.hint(Q,s);if(Q.unique){assert.equal(h.kind,'unlock');assert.equal(h.cell,k);assert.match(h.reason,/cannot be part of any working layout/);}}
    for(let k=0;k<200;k++){const h=M.hint(Q,s);if(!h)break;steps++;
      assert.ok(typeof h.reason==='string'&&h.reason.length>20);
      if(Q.unique&&h.kind!=='lift')assert.equal(h.mask,Q.solution.mask[h.cell],`${d.id} ${seed}: hint at ${M.label(Q,h.cell)} matches the answer`);
      const before=s;s=M.applyHint(Q,s,h);assert.equal(s.taps,before.taps,'hints never spend rotations');
      if(h.kind!=='lift')assert.ok(s.locked[h.cell],'a hinted tile is locked');}
    assert.ok(M.analyze(Q,s).solved,`${d.id} ${seed}: hints alone solve the board`);boards++;}
  assert.ok(boards>=24,'hint boards '+boards);rates.hints={boards,steps};}
// The first hint at Easy is a forced edge tile, with the edge reason.
{const Q=M.generate(1,'easy'),h=M.hint(Q,M.initial(Q)),f=M.forced(Q,M.initial(Q));
  assert.ok(f.some(x=>x.cell===h.cell),'the first hint is a forced tile');assert.ok(f.find(x=>x.cell===h.cell).wave===1);
  const edgeReasons=/corner, so it can only turn inward|on the edge, so it must run along it|stem must point inward|board edge/;
  let edgy=0;for(let seed=1;seed<=30;seed++){const R=M.generate(seed,'easy'),hh=M.hint(R,M.initial(R));if(edgeReasons.test(hh.reason))edgy++;}
  assert.ok(edgy>=20,'most first hints cite the board edge: '+edgy);}
// Forced tiles: wave-1 forced from the start match the answer; the Relaxed cascade is local to the tile touched.
{const Q=M.generate(3,'normal'),s=M.initial(Q);
  for(const f of M.forced(Q,s))assert.equal(f.mask,Q.solution.mask[f.cell]);
  const corner=M.forced(Q,s)[0].cell,r=M.settle(Q,s,{from:corner});
  assert.ok(r.steps.length>=1);assert.ok(r.steps.some(x=>x.cell===corner));
  const dist=i=>Math.abs(i%Q.n-corner%Q.n)+Math.abs(Math.floor(i/Q.n)-Math.floor(corner/Q.n));
  for(const x of r.steps){assert.ok(dist(x.cell)<=M.RELAX_DEPTH,'cascade stays near the tile touched');assert.ok(r.state.locked[x.cell]);
    assert.equal(M.maskAt(Q,r.state,x.cell),Q.solution.mask[x.cell]);}
  assert.equal(r.state.taps,s.taps,'snaps never spend rotations');
  const all=M.settle(Q,s);assert.ok(all.steps.length>r.steps.length,'the whole-board chain reaches further than the local cascade');}
// Tiers and scoring.
{
  const Q=M.generate(5,'hard'),solvedQ=M.solvedState(Q);
  const within={...solvedQ,taps:Q.par},over={...solvedQ,taps:Q.par+1};
  assert.equal(M.score(Q,within,{}).tier,'perfect');assert.equal(M.score(Q,within,{}).score,100);
  assert.equal(M.score(Q,over,{}).tier,'good');
  assert.equal(M.score(Q,within,{hints:1}).tier,'good');
  assert.equal(M.score(Q,within,{assist:'relaxed'}).tier,'good');assert.equal(M.score(Q,within,{assist:'guided'}).tier,'good');
  assert.ok(M.score(Q,within,{assist:'relaxed'}).score<M.score(Q,within,{}).score);
  assert.equal(M.score(Q,M.initial(Q),{}).tier,M.analyze(Q,M.initial(Q)).fed?'partial':'failed');
  // one line fed, one dry: partial
  // turn the pipe in front of one plant's inlet: that plant goes dry, the other line still runs
  let partial=null;
  for(const net of Q.nets){const d=[0,1,2,3].find(k=>Q.cells[net.sink].mask&M.BIT[k]),j=M.nbr(Q.n,net.sink,d);
    if(Q.cells[j].kind!=='pipe')continue;const s=M.rotate(Q,solvedQ,j,1).state;if(M.analyze(Q,s).fed===Q.nets.length-1){partial=s;break;}}
  assert.ok(partial,'found a one-line board');assert.equal(M.score(Q,partial,{}).tier,'partial');
  assert.match(M.output(Q,M.analyze(Q,partial)),/^Base partly online: .*Offline: /);
  // nothing fed: failed
  const dead=M.lift(Q,{...M.initial(Q)},Q.slots[0]).state;const deadA=M.analyze(Q,dead);if(!deadA.fed)assert.equal(M.score(Q,dead,{}).tier,'failed');
  // auto fallback: solved board, reduced score, reduced output
  const auto=M.autoFallback(Q);assert.ok(M.analyze(Q,auto.state).solved);assert.ok(auto.score<M.score(Q,within,{}).score);assert.equal(auto.score,35);
  assert.match(auto.output,/^Base online at reduced output \(automatic layout\): /);
  assert.equal(M.score(Q,auto.state,{auto:true}).tier,'auto');
  // output names the production lines
  const out=M.output(Q,M.analyze(Q,solvedQ));assert.match(out,/^Base online: ore \(2 ore extractors\) → refinery, crystal → synthesiser\.$/);
  const E=M.generate(1,'expert');assert.match(M.output(E,M.analyze(E,M.solvedState(E))),/ore \(2 ore extractors\) → refinery, crystal → synthesiser, water → power hub/);
}
// Near-miss lines.
{
  const Q=M.generate(9,'normal'),solvedQ=M.solvedState(Q);
  // the one tile whose turn broke the flow: turn a pipe next to a plant away and the near-miss names it
  const net=Q.nets.find(x=>{const j=M.nbr(Q.n,x.sink,[0,1,2,3].find(k=>Q.cells[x.sink].mask&M.BIT[k]));return Q.cells[j].kind==='pipe';}),nb=M.nbr(Q.n,net.sink,[0,1,2,3].find(k=>Q.cells[net.sink].mask&M.BIT[k]));
  if(nb!==undefined){const s=M.rotate(Q,solvedQ,nb,1).state;const nm=M.nearMiss(Q,s,{tier:'partial'});
    assert.match(nm,new RegExp(`^Turning the \\w[\\w ]* at ${M.label(Q,nb)} to open .* would have fed the ${M.TYPES[net.type].sink}`));}
  {const H=M.generate(2,'hard'),s=M.rotate(H,M.solvedState(H),H.cells.findIndex(c=>c.kind==='pipe'&&c.piece==='end'),1).state;
    if(M.analyze(H,s).fed===H.nets.length)assert.match(M.nearMiss(H,s,{tier:'partial'}),/^Every plant was fed, but/);}
  assert.equal(M.nearMiss(Q,solvedQ,{tier:'perfect'}),'');
  assert.match(M.nearMiss(Q,solvedQ,{tier:'good',hints:1,firstHint:'X'}),/^Spotting this yourself would have made it Perfect: X/);
  assert.match(M.nearMiss(Q,{...solvedQ,taps:Q.par+3},{tier:'good',mostTurned:4,mostTurnedCount:5}),/^3 rotations over par .*most-turned tile was .* \(5 turns\)/);
  assert.match(M.nearMiss(Q,solvedQ,{tier:'good',assist:'relaxed'}),/Relaxed assist/);
  assert.match(M.nearMiss(Q,M.initial(Q),{tier:'auto'}),/^Solving it yourself runs every line at full output\. The first step was there: /);
}
const ms=Date.now()-t0;assert.ok(ms<20000,'unit test took '+ms+' ms');
console.log(`PASS pipes model: determinism; 200 seeds × 4 difficulties planted, solved, counted (unique ${Object.entries(rates).filter(([k])=>M.DIFFICULTIES.some(d=>d.id===k)).map(([k,v])=>k+' '+v.unique).join(', ')}; avg bridges hard ${rates.hard.bridges}, expert ${rates.expert.bridges}; avg par ${M.DIFFICULTIES.map(d=>rates[d.id].par).join('/')}; local chain settles ${M.DIFFICULTIES.map(d=>rates[d.id].localChain).join('/')} of tiles); solver = brute force on ${rates.brute.checked} small boards (${rates.brute.multi} with several answers); moves, locks, slots, budget, invalid moves untouched; leaks, dry, contamination, bridges; ${rates.hints.boards} boards solved by hints alone (${rates.hints.steps} hints, all matching the answer, wrong lock caught); local Relaxed cascade; tiers, auto ${'<'} Perfect, output lines, near-miss; ${ms} ms`);
