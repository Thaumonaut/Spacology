'use strict';
// Gear assembly model: determinism; 100 seeds per difficulty satisfiable (the solver's kits replay through the player's
// own moves, at par); par is minimal (an independent brute force on Easy); synergy matters; the Power and Focus rules;
// atomic invalid moves; tiers; the automatic fallback below Perfect; hints legal and leading to par; Relaxed best spots;
// the near-miss and output lines.
const assert=require('node:assert/strict'),G=require('../../prototypes/gear-pack-model.js'),K=require('../../prototypes/minigame-kit.js');
const play=(P,st,m)=>{const r=G.apply(P,st,m);assert.ok(!r.error,`${JSON.stringify(m)}: ${r.error}`);return r.state;};
const started=Date.now();

assert.equal(G.DIFFICULTIES.length,4);
const game=K.GAMES.find(g=>g.id==='gear-pack');assert.ok(game);assert.equal(game.title,'Gear assembly');assert.equal(game.role,'Logistics');assert.equal(game.phase,'Night');
for(const [k,t] of Object.entries(G.TYPES)){assert.ok(t.shape.length>=1&&t.shape.length<=4,`${k}: 1-4 cells`);assert.ok(t.stat?G.STATS.includes(t.stat)&&t.value>0:t.rule==='power',k);assert.match(t.text,/\.$/,k);}
assert.deepEqual(G.ASSIST_LEVELS.map(l=>l.id),['puzzle','guided','relaxed']);

// Independent check of par on small trays: no set of fewer parts meets every order (plain search, no pruning).
function bruteFewer(P){
  const n=P.parts.length;
  const fits=(o,list)=>{const O=P.orders[o];const rec=(k,occ,items)=>{
      if(k===list.length){const fs=G.frameStats(items).tot;return Object.entries(O.targets).every(([s,v])=>fs[s]>=v);}
      for(const pl of G.placements(P.parts[list[k]].type,O.w,O.h)){if(pl.mask&occ)continue;if(rec(k+1,occ|pl.mask,items.concat({i:list[k],type:P.parts[list[k]].type,mask:pl.mask,nbr:pl.nbr})))return true;}
      return false;};return rec(0,0,[]);};
  // Assign every part to an order or the tray (base n.orders+1) with fewer than par parts used.
  const B=P.orders.length+1;
  for(let code=0;code<B**n;code++){let c=code,used=0;const groups=P.orders.map(()=>[]);
    for(let i=0;i<n;i++){const d=c%B;c=(c-d)/B;if(d<P.orders.length){groups[d].push(i);used++;}}
    if(used>=P.par)continue;if(groups.every((gr,o)=>fits(o,gr)))return true;}
  return false;
}
// ---- hand-built puzzle for the rules: one 4×3 frame and a second 2×2 frame ----
const R={game:'gear-pack',seed:0,difficulty:'test',
  orders:[{crew:'Daven',role:'Sustain',w:4,h:3,targets:{Guard:5,Burst:5}},{crew:'Hanae',role:'Support',w:2,h:2,targets:{Guard:1,Mend:2}}],
  parts:[{type:'plate'},{type:'cell'},{type:'lens'},{type:'sequencer'},{type:'cell'},{type:'pin'},{type:'bell'},{type:'lens'}]};
R.par=G.solve(R,G.initial(R)).total;
{
  let st=G.initial(R);
  // Catch plate alone: Guard 3, all base.
  st=play(R,st,{type:'place',part:0,order:0,rot:0,x:0,y:0}); // cells (0,0),(1,0),(0,1)
  let e=G.evaluate(R,st).orders[0];assert.equal(e.stats.Guard.value,3);assert.deepEqual(e.stats.Guard.from.map(f=>f.kind),['base']);
  // Power cell touching it: +1 Guard, credited to the cell; the cell itself has no stat.
  st=play(R,st,{type:'place',part:1,order:0,rot:0,x:2,y:0}); // (2,0),(3,0): touches (1,0)
  e=G.evaluate(R,st).orders[0];assert.equal(e.stats.Guard.value,4);
  assert.deepEqual(e.stats.Guard.from.find(f=>f.kind==='power'),{part:0,amount:1,kind:'power',via:1});assert.equal(e.stats.Burst.value,0);
  // Markers on the Power cell: edges toward the plate lit, edges toward empty cells dark.
  let marks=G.evaluate(R,st).marks.filter(m=>m.part===1);
  assert.ok(marks.some(m=>m.lit&&m.by===0&&m.x===2&&m.y===0&&m.side==='l'),'bolt toward the plate lit');assert.ok(marks.some(m=>!m.lit),'bolts toward empty cells dark');
  assert.ok(marks.every(m=>m.kind==='power'));
  // A second Power cell touching the plate: +1 more (one per cell).
  st=play(R,st,{type:'place',part:4,order:0,rot:0,x:1,y:1}); // (1,1),(2,1): touches (0,1),(1,0) of plate
  e=G.evaluate(R,st).orders[0];assert.equal(e.stats.Guard.value,5,'two Power cells, +1 each');assert.ok(e.stats.Guard.met);
  // Power cells do not power each other (no stat), and touching cells light no bolt between them.
  assert.ok(!G.evaluate(R,st).marks.some(m=>m.part===1&&m.by===4));
  // Focus: lens touching a Sequencer adds +2 Burst to it; the lens keeps its own Burst +1.
  let f=G.initial(R);f=play(R,f,{type:'place',part:3,order:0,rot:0,x:0,y:0});f=play(R,f,{type:'place',part:2,order:0,rot:0,x:0,y:1});
  e=G.evaluate(R,f).orders[0];assert.equal(e.stats.Burst.value,2+1+2);assert.ok(e.stats.Burst.from.some(x=>x.kind==='focus'&&x.part===3&&x.via===2&&x.amount===2));
  assert.ok(G.evaluate(R,f).marks.some(m=>m.part===2&&m.kind==='focus'&&m.lit&&m.by===3),'lens ring lit toward the Sequencer');
  // A lens not touching the Sequencer: no focus. A lens touching a Power cell gets +1 like any part.
  let g=G.initial(R);g=play(R,g,{type:'place',part:3,order:0,rot:0,x:0,y:0});g=play(R,g,{type:'place',part:2,order:0,rot:0,x:3,y:1});
  assert.equal(G.evaluate(R,g).orders[0].stats.Burst.value,3);
  g=play(R,g,{type:'place',part:1,order:0,rot:0,x:1,y:1});
  assert.equal(G.evaluate(R,g).orders[0].stats.Burst.value,2+1+1+1,'cell touches both Sequencer and lens');
  assert.ok(!G.evaluate(R,g).marks.some(m=>m.part===2&&m.lit),'lens ring toward a Power cell stays dark');
  // Parts in different frames never touch: a Power cell in Hanae's frame gives Daven nothing.
  let h=G.initial(R);h=play(R,h,{type:'place',part:0,order:0,rot:0,x:0,y:0});h=play(R,h,{type:'place',part:1,order:1,rot:1,x:0,y:0});
  assert.equal(G.evaluate(R,h).orders[0].stats.Guard.value,3);assert.equal(G.evaluate(R,h).orders[1].stats.Guard.value,0);
  // Moving a placed part into another frame is a plain place move.
  h=play(R,G.initial(R),{type:'place',part:0,order:0,rot:0,x:0,y:0});h=play(R,h,{type:'place',part:0,order:1,rot:0,x:0,y:0});assert.equal(h.placed[0].order,1);assert.equal(G.evaluate(R,h).orders[0].parts.length,0);

  // Invalid moves are atomic: an error, and the state is untouched.
  const before=JSON.stringify(st);
  for(const m of [{type:'place',part:5,order:0,rot:0,x:4,y:0},{type:'place',part:5,order:0,rot:0,x:-1,y:0},{type:'place',part:5,order:0,rot:0,x:0,y:0},
    {type:'place',part:9,order:0,rot:0,x:3,y:1},{type:'place',part:5,order:2,rot:0,x:0,y:0},{type:'place',part:5,order:0,rot:4,x:3,y:1},{type:'place',part:5,order:0,rot:0,x:0.5,y:0},
    {type:'remove',part:5},{type:'spin',part:0},null,{type:'place',part:3,order:1,rot:0,x:0,y:0}]){
    const r=G.apply(R,st,m);assert.ok(r.error,`rejects ${JSON.stringify(m)}`);assert.equal(r.state,undefined);assert.equal(JSON.stringify(st),before,'state untouched');}
  assert.match(G.apply(R,st,{type:'place',part:5,order:0,rot:0,x:0,y:0}).error,/overlaps the Catch plate/);
  assert.match(G.apply(R,st,{type:'place',part:5,order:0,rot:0,x:4,y:0}).error,/outside Daven's 4×3 frame/);
  // A part may be re-placed on its own cells (turning in place, nudging).
  assert.ok(!G.apply(R,st,{type:'place',part:0,order:0,rot:0,x:0,y:0}).error);

  // Tiers.
  const parSt=G.stateFrom(R,G.solve(R,G.initial(R)).moves),ev=G.evaluate(R,parSt);
  assert.equal(ev.used,R.par);assert.ok(ev.allMet);assert.equal(bruteFewer(R),false,'hand puzzle par is minimal');
  assert.equal(G.tier(R,ev,{hints:0,level:'puzzle'}),'perfect');
  assert.equal(G.tier(R,ev,{hints:0,level:'guided'}),'perfect','Guided only highlights; Perfect stays open');
  assert.equal(G.tier(R,ev,{hints:1,level:'puzzle'}),'good','a hint caps at Good');
  assert.equal(G.tier(R,ev,{hints:0,level:'relaxed'}),'good','Relaxed is never Perfect');
  const extra=parSt.placed.findIndex(p=>!p);
  if(extra>=0){const spot=[0,1].flatMap(o=>G.placements(R.parts[extra].type,R.orders[o].w,R.orders[o].h).map(p=>({order:o,...p}))).find(p=>!G.validate(R,parSt,{type:'place',part:extra,...p}));
    if(spot){const s2=play(R,parSt,{type:'place',part:extra,order:spot.order,rot:spot.rot,x:spot.x,y:spot.y});assert.equal(G.tier(R,G.evaluate(R,s2),{}),'good','a spare part caps at Good');}}
  let half=G.initial(R);for(const m of G.solve(R,G.initial(R)).moves.filter(m=>m.order===1))half=play(R,half,m);
  assert.equal(G.tier(R,G.evaluate(R,half),{}),'partial');assert.equal(G.tier(R,G.evaluate(R,G.initial(R)),{}),'failed');
  assert.match(G.output(R,half),/^Shipped at dawn: Hanae's kit \(Guard \d+ · Mend \d+\)\. Held back: Daven's kit \(Guard 0 of 5, Burst 0 of 5\)\.$/);
  assert.match(G.nearMiss(R,half),/^Daven's kit missed Guard 0 of 5\./);
  assert.equal(G.nearMiss(R,parSt),'');assert.equal(G.hint(R,parSt),null);
}

// ---- generated puzzles ----
const SEEDS=100,summary={};
for(const d of G.DIFFICULTIES){
  let autoShort=0,brute=0;
  for(let seed=1;seed<=SEEDS;seed++){
    const P=G.generate(seed,d.id),tag=`${d.id} ${seed}`;
    if(seed<=5)assert.equal(JSON.stringify(G.generate(seed,d.id)),JSON.stringify(P),'same seed, same puzzle');
    assert.ok(P.orders.length>=d.orders[0]&&P.orders.length<=d.orders[1],tag);
    assert.equal(new Set(P.orders.map(O=>O.crew)).size,P.orders.length,'one order per crewmate');
    for(const O of P.orders){assert.ok(d.frames.some(([w,h])=>w===O.w&&h===O.h),tag);const k=Object.keys(O.targets).length;assert.ok(k>=d.targets[0]&&k<=d.targets[1],tag);
      assert.ok(G.ROLES[O.role]&&O.role&&Object.keys(O.targets).includes(G.ROLES[O.role].main),`${tag}: the role's main stat is ordered`);
      assert.ok(Object.values(O.targets).every(v=>Number.isInteger(v)&&v>=2),tag);}
    // Satisfiable: the planted kits and the solver's kits both replay through apply() and meet every order.
    const plant=G.evaluate(P,G.stateFrom(P,P.plant));assert.ok(plant.allMet,`${tag}: plant`);
    const sol=G.stateFrom(P,P.solution),ev=G.evaluate(P,sol);
    assert.ok(ev.allMet,`${tag}: solution meets every order`);assert.equal(ev.used,P.par,`${tag}: solution uses par parts`);
    assert.ok(P.par<=P.plant.length,tag);assert.equal(G.tier(P,ev,{hints:0,level:'puzzle'}),'perfect',tag);
    // Synergy matters: with Power and Focus switched off the tray needs more parts, or cannot do it at all.
    const flat=G.solve(P,G.initial(P),{syn:false});assert.ok(!flat||flat.total>P.par,`${tag}: synergy matters`);
    // The automatic fallback: reduced (the shell labels it Automatic), never better than par.
    const a=G.autoAssembly(P);assert.ok(!a.allMet||a.used>=P.par,tag);if(!a.allMet||a.used>P.par)autoShort++;
    if(d.id==='easy'&&seed<=25){assert.equal(bruteFewer(P),false,`${tag}: no kit with fewer than par parts`);brute++;}
    // Hints: legal moves that reach par, from scratch and from the fallback's assembly.
    if(seed<=30)for(const start of [G.initial(P),a.state]){let st=start,n=0;
      for(;n<4*P.parts.length;n++){const h=G.hint(P,st);if(!h)break;assert.equal(G.validate(P,st,h.move),null,`${tag}: hint legal`);assert.match(h.text,/^(Put|Lift)/);
        if(h.move.type==='place'&&!st.placed[h.move.part])assert.match(h.text,/((gets|brings) \w+('s)? (to )?|Power cell will give \+1)/);st=play(P,st,h.move);}
      const e2=G.evaluate(P,st);assert.ok(e2.allMet&&e2.used===P.par,`${tag}: hints reach par`);assert.equal(G.nearMiss(P,st),'');}
    // Relaxed: tapping the solution's parts drops each one somewhere legal and ends with every order met.
    if(seed<=15){let st=G.initial(P);for(const m of P.solution){const s=G.bestSpot(P,st,m.part);assert.ok(s,`${tag}: best spot`);st=play(P,st,{type:'place',part:m.part,...s});}
      assert.ok(G.evaluate(P,st).allMet,`${tag}: Relaxed taps meet every order`);assert.ok(P.parts.every((_,i)=>!G.helps(P,st,i)),'nothing helps once all are met');}
    // Near-miss and output text.
    if(!a.allMet||a.used>P.par)assert.ok(G.nearMiss(P,a.state).length>10,tag);
    assert.match(G.output(P,sol),/^Shipped at dawn: \w+'s kit \((\w+ \d+)( · \w+ \d+)+\)/);
  }
  summary[d.id]={autoShort,brute};
  if(d.id!=='easy')assert.ok(autoShort>=SEEDS*0.6,`${d.id}: the fallback usually falls short (${autoShort}/${SEEDS})`);
}
console.log(`PASS gear-pack unit: ${SEEDS} seeds per difficulty satisfiable at par (Easy par brute-forced on 25), synergy matters, power/focus rules, atomic moves, tiers, fallback below par (${Object.entries(summary).map(([k,v])=>`${k} ${v.autoShort}/${SEEDS}`).join(', ')}), hints legal to par, Relaxed spots, in ${((Date.now()-started)/1000).toFixed(1)}s.`);
