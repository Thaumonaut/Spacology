'use strict';
// Rocket loading model (file keeps the pallet-stacking name): determinism; for 200 seeds per difficulty the planted full
// load is legal, fills every tapered fairing with no empty cells, clears the dock and is centred, the solver clears it
// too, greedy loaders get stuck and random play rarely clears it; the fairing taper (blocked shoulders, ceilings, the
// solver honouring them); drop/support/centre-of-mass rules; atomic invalid moves; tiers; the auto fallback; hints that
// always lead to a clear dock; the near-miss line. Voyage: rockets, refits, destinations, sample crates, lab orders.
const assert=require('node:assert/strict'),P=require('../../prototypes/minigames/pallet-stacking/pallet-stacking-model.js'),Kit=require('../../prototypes/shared/minigames/minigame-kit.js');
const SEEDS=200,ids=P.PUZZLES.map(d=>d.id);
const run=(pz,moves)=>{const st=P.create();for(const m of moves)assert.equal(P.apply(pz,st,m),null,P.describe(pz,m));return st;};
const cleared=(pz,st)=>{const ev=P.evaluate(pz,st);return ev.cleared&&ev.allLevel;};

// Determinism: same (seed, difficulty) → same puzzle; different seeds differ.
for(const d of ids){assert.deepEqual(P.generate(7,d),P.generate(7,d));assert.notDeepEqual(P.generate(7,d).crates,P.generate(8,d).crates);}

let slowest=0;const rates={};let emptyTotal=0,palletTotal=0,taperedTotal=0;
for(const d of ids){
  const diff=P.PUZZLES.find(x=>x.id===d);let rand=0,greedyLeft=0,kinds=0;
  for(let seed=1;seed<=SEEDS;seed++){
    const t=Date.now(),pz=P.generate(seed,d);slowest=Math.max(slowest,Date.now()-t);
    assert.equal(pz.pallets.length,diff.pallets);assert.ok(pz.pallets.every(pal=>!('maxWeight' in pal)),'no per-fairing weight limit');
    for(const pal of pz.pallets){assert.equal(pal.taper,1,'every practice fairing tapers');assert.deepEqual(pal.cap,P.fairing(pal.width,pal.height,1));
      assert.ok(pal.cap[0]<pal.height&&pal.cap.at(-1)<pal.height&&pal.cap.some(h=>h===pal.height),'shoulders blocked, the middle reaches the top');taperedTotal++;}
    pz.pallets.forEach((_,p)=>{const k=pz.planted.filter(m=>m.pallet===p).length;assert.ok(k>=diff.crates[0]&&k<=diff.crates[1]);});
    // Space is the limit: the planted crates fill every pallet's width × height exactly.
    const empty=P.emptyCells(pz);assert.ok(empty.every(e=>e<=diff.maxDead),`${d}/${seed} planted pallets are full`);emptyTotal+=empty.reduce((a,b)=>a+b,0);palletTotal+=empty.length;
    // The planted load is a complete legal clearing.
    const planted=run(pz,pz.planted);assert.ok(cleared(pz,planted),`${d}/${seed} planted load clears the dock level`);
    for(const q of planted.placed){const m=pz.planted.find(x=>x.crate===q.crate);assert.equal(q.y,m.y,'planted rest heights match');}
    // The solver clears it independently.
    assert.ok(P.evaluate(pz,planted).pallets.every(x=>x.full&&x.filled===x.area),'every planted pallet is FULL');
    assert.ok(cleared(pz,run(pz,pz.plan)),`${d}/${seed} solver plan clears the dock`);
    assert.ok(P.evaluate(pz,run(pz,pz.plan)).pallets.every(x=>x.full),'any clearing fills every pallet');
    assert.deepEqual(P.solve(pz,run(pz,pz.plan)),[],'nothing left to do after the plan');
    // Careless loading fails: every greedy order leaves a crate behind or tips a pallet; so does the auto fallback.
    assert.equal(P.greedyClears(pz),false,`${d}/${seed} greedy must not clear`);
    const a=P.auto(pz);assert.ok(a.shipped<pz.crates.length);greedyLeft+=pz.crates.length-a.shipped;
    assert.equal(P.tier(pz,a.evaluation)==='perfect',false);
    // Interlocks and the random-play rate recorded by the generator.
    assert.ok(pz.stats.interlocks.kinds>=2,`${d}/${seed} planted load interlocks`);assert.ok(pz.stats.randomClears<=diff.maxRandom);
    kinds+=pz.stats.interlocks.kinds;rand+=P.randomRate(pz,Kit.rng(seed*977+1),20);
  }
  rates[d]={random:(rand/(SEEDS*20)*100).toFixed(1)+'%',greedy:'0%',autoLeaves:(greedyLeft/SEEDS).toFixed(1),interlockKinds:(kinds/SEEDS).toFixed(1)};
  assert.ok(rand/(SEEDS*20)<0.15,`${d}: random legal play clears too often (${rates[d].random})`);
}
assert.ok(slowest<500,`generation took ${slowest}ms on the slowest seed`);

// Hand-built rules fixture: one 6-wide pallet, height 4, weight 20.
const C=P.CATALOG,mk=(type,over={})=>{const t=C[type];return {type,name:t.name,icon:t.icon,color:t.color,w:t.w,h:t.h,topKind:t.top,
  top:Array.from({length:t.w},(_,i)=>t.top==='flat'?1:t.top==='narrow'?(i>0&&i<t.w-1?1:0):t.top==='lid'?(i<Math.ceil(t.w/2)?1:0):0),fragile:!!t.fragile,heavy:!!t.heavy,weight:3,...over};};
const fx=(crates,pallets=[{id:0,name:'Pallet 1',width:6,height:4}])=>({pallets,crates:crates.map((c,i)=>({...c,id:i})),planted:[],plan:null});
{
  const pz=fx([mk('rations'),mk('cells'),mk('core'),mk('medkit'),mk('coil'),mk('salvage'),mk('mast'),mk('aether'),mk('spares')]);
  const st=P.create(),keep=()=>JSON.stringify(st),bad=(m,re)=>{const before=keep(),why=P.apply(pz,st,m);assert.match(String(why),re);assert.equal(keep(),before,'invalid move must not change state');};
  bad({type:'place',crate:0,pallet:0,x:4},/does not fit/);bad({type:'place',crate:0,pallet:0,x:-1},/does not fit/);bad({type:'place',crate:0,pallet:3,x:0},/No such/);
  bad({type:'lift',crate:0},/on the dock/);bad({type:'jump'},/Unknown/);bad(null,/No move/);
  assert.equal(P.apply(pz,st,{type:'place',crate:0,pallet:0,x:0}),null);                    // rations 3×1 flat at x0..2
  bad({type:'place',crate:0,pallet:0,x:3},/already loaded/);
  bad({type:'place',crate:1,pallet:0,x:2},/Overhang/);                                       // straddles the rations edge
  assert.equal(P.apply(pz,st,{type:'place',crate:1,pallet:0,x:1}),null);assert.equal(st.placed[1].y,1,'drops onto the rations');
  bad({type:'lift',crate:0},/resting on/);
  bad({type:'place',crate:5,pallet:0,x:1},/heavy/);                                          // heavy drum on light cells
  assert.equal(P.apply(pz,st,{type:'place',crate:2,pallet:0,x:1}),null);                     // burst core (peaked, fragile)
  bad({type:'place',crate:3,pallet:0,x:1},/fragile/);bad({type:'place',crate:7,pallet:0,x:2},/fragile|peaked/);
  assert.equal(P.apply(pz,st,{type:'place',crate:4,pallet:0,x:3}),null);                     // reactor coil (narrow top)
  bad({type:'place',crate:7,pallet:0,x:3},/top cannot hold/);
  assert.equal(P.apply(pz,st,{type:'place',crate:7,pallet:0,x:4}),null);assert.equal(st.placed.at(-1).y,2,'narrow top holds its middle');
  bad({type:'place',crate:6,pallet:0,x:4},/Too tall/);bad({type:'place',crate:8,pallet:0,x:4},/Overhang/);
  assert.equal(P.liftable(pz,st,2),true);assert.equal(P.liftable(pz,st,1),false);
  assert.equal(P.apply(pz,st,{type:'lift',crate:2}),null);assert.ok(!st.placed.some(q=>q.crate===2));
  // No weight limit: any number of heavy crates may load; weight only moves the balance.
  const heavy=fx([mk('salvage',{weight:40}),mk('salvage',{weight:40})]),hs=P.create();
  assert.equal(P.apply(heavy,hs,{type:'place',crate:0,pallet:0,x:0}),null);assert.equal(P.apply(heavy,hs,{type:'place',crate:1,pallet:0,x:4}),null);
  // Fill and FULL: a 2×1 pallet with two 1×1 crates; full only when both columns reach the top (or are sealed).
  const tiny=fx([mk('fuel'),mk('medkit')],[{id:0,name:'Pallet 1',width:2,height:1}]),ts=P.create();P.apply(tiny,ts,{type:'place',crate:0,pallet:0,x:0});
  let ps=P.palletStats(tiny,ts,0);assert.equal(ps.filled,1);assert.equal(ps.area,2);assert.equal(ps.full,false);
  P.apply(tiny,ts,{type:'place',crate:1,pallet:0,x:1});ps=P.palletStats(tiny,ts,0);assert.equal(ps.full,true);assert.deepEqual(P.solve(tiny,ts),[]);
  const sealed=fx([mk('core'),mk('fuel')],[{id:0,name:'Pallet 1',width:2,height:3}]),ss=P.create();P.apply(sealed,ss,{type:'place',crate:0,pallet:0,x:0});
  assert.equal(P.palletStats(sealed,ss,0).full,true,'a peaked top seals the cells above it');
  const lid=fx([mk('spares'),mk('medkit'),mk('medkit')]),ls=P.create();P.apply(lid,ls,{type:'place',crate:0,pallet:0,x:2});
  assert.match(P.apply(lid,ls,{type:'place',crate:1,pallet:0,x:3}),/cannot hold/);assert.equal(P.apply(lid,ls,{type:'place',crate:1,pallet:0,x:2}),null);
}
// Balance: centre of mass in [W/4, 3W/4] inclusive (W=6 → 1.5..4.5); an empty pallet is level; a tipped pallet ships nothing.
{
  const pz=fx([mk('medkit',{weight:2}),mk('medkit',{weight:2}),mk('aether',{weight:2})]),st=P.create();
  assert.equal(P.palletStats(pz,st,0).balanced,true);
  P.apply(pz,st,{type:'place',crate:0,pallet:0,x:0});let s=P.palletStats(pz,st,0);assert.equal(s.com,0.5);assert.equal(s.balanced,false);
  assert.deepEqual(P.evaluate(pz,st).shipped,[]);assert.equal(P.tier(pz,P.evaluate(pz,st)),'failed','only a tipped pallet → nothing shipped');
  P.apply(pz,st,{type:'place',crate:1,pallet:0,x:2});s=P.palletStats(pz,st,0);assert.equal(s.com,1.5);assert.equal(s.balanced,true,'boundary is inclusive');
  assert.equal(P.tier(pz,P.evaluate(pz,st)),'partial','one crate still on the dock');
  P.apply(pz,st,{type:'place',crate:2,pallet:0,x:3});assert.equal(P.tier(pz,P.evaluate(pz,st)),'perfect');assert.equal(P.tier(pz,P.evaluate(pz,st),2),'good','hints cap at Good');
  assert.equal(P.anchorFor(pz,2,0,5),5);assert.equal(P.columnFor(pz,2,5),5);
}
// The fairing taper: ceilings per column, blocked shoulders refuse tall crates, the solver puts tall crates in the middle.
{
  assert.deepEqual(P.fairing(3,3,1),[2,3,2]);assert.deepEqual(P.fairing(4,3,1),[2,3,3,2]);assert.deepEqual(P.fairing(6,4,2),[2,3,4,4,3,2]);
  assert.deepEqual(P.fairing(2,3,1),[3,3],'a 2-wide fairing cannot taper');assert.deepEqual(P.fairing(3,3,5),[2,3,2],'the top row never closes');
  assert.equal(P.fitsShape(1,3,[2,3,2]),true);assert.equal(P.fitsShape(2,3,[2,3,3,2]),true);assert.equal(P.fitsShape(2,3,[2,3,2]),false);
  const tp=[{id:0,name:'Rocket 1',width:4,height:3,taper:1}],pz=fx([mk('mast'),mk('mast'),mk('rations')],tp),st=P.create();
  assert.match(P.apply(pz,st,{type:'place',crate:0,pallet:0,x:0}),/fairing narrows: column 1 is only 2 high/);assert.equal(st.placed.length,0);
  assert.match(P.apply(pz,st,{type:'place',crate:0,pallet:0,x:3}),/column 4 is only 2 high/);
  assert.equal(P.apply(pz,st,{type:'place',crate:0,pallet:0,x:1}),null);assert.equal(P.palletStats(pz,st,0).area,10,'blocked cells are not counted');
  // A wide flat crate fits across the base but not up in the shoulders.
  const wide=fx([mk('aether'),mk('aether'),mk('rations'),mk('fuel')],[{id:0,name:'Rocket 1',width:3,height:3,taper:1}]),ws=P.create();
  assert.equal(P.apply(wide,ws,{type:'place',crate:2,pallet:0,x:0}),null);assert.match(P.apply(wide,ws,{type:'place',crate:0,pallet:0,x:0}),/narrows/);
  // 3-wide, 3-high, taper 1 (ceilings 2,3,2 = 7 cells): a 1×3 mast and two 1×2 canisters only fit with the mast central.
  const one=fx([mk('aether'),mk('mast'),mk('aether')],[{id:0,name:'Rocket 1',width:3,height:3,taper:1}]),plan=P.solve(one);
  assert.ok(plan,'solvable');assert.equal(plan.find(m=>m.crate===1).x,1,'the solver puts the tall crate in the middle');
  const full=run(one,plan),fs=P.palletStats(one,full,0);assert.equal(fs.full,true);assert.equal(fs.filled,7);assert.equal(fs.area,7);
  const blocked=P.create();P.apply(one,blocked,{type:'place',crate:0,pallet:0,x:1});assert.equal(P.solve(one,blocked),null,'a canister in the middle strands the mast');
  const h=P.hint(one,blocked);assert.equal(h.type,'lift');assert.equal(h.crate,0,'the hint lifts the blocker');
  // Full: a column counts as full at its own ceiling.
  const sh=fx([mk('fuel'),mk('fuel'),mk('aether')],[{id:0,name:'Rocket 1',width:3,height:2,taper:1}]),ss=P.create();
  for(const m of P.solve(sh))P.apply(sh,ss,m);assert.equal(P.palletStats(sh,ss,0).full,true);assert.equal(P.palletStats(sh,ss,0).area,4);
}
for(let seed=1;seed<=20;seed++){const pz=P.generate(seed,'expert');for(const c of pz.crates)pz.pallets.forEach((pal,p)=>{for(let x=0;x+c.w<=pal.width;x++)assert.equal(P.anchorFor(pz,c.id,p,P.columnFor(pz,c.id,x)),x);});}
{
  const pz=P.generate(3,'normal');assert.equal(P.tier(pz,P.evaluate(pz,P.create())),'failed','nothing dispatched');
  const short=run(pz,pz.plan.slice(0,-1));assert.equal(P.tier(pz,P.evaluate(pz,short)),'partial');
}

// Hints: from random legal positions (often dead ends), following hints always clears the dock level, and each hinted
// move is legal when given; a placement hint keeps the dock clearable.
for(const d of ids)for(let seed=1;seed<=25;seed++){
  const pz=P.generate(seed,d),r=Kit.rng(seed*31+7),st=P.randomPlay(pz,r);st.placed.length=r.int(st.placed.length+1);
  for(let step=0;;step++){
    assert.ok(step<60,`${d}/${seed} hints must converge`);
    const h=P.hint(pz,st);if(h.type==='dispatch')break;
    assert.equal(P.validate(pz,st,h),null,`${d}/${seed} hint must be legal: ${h.text}`);assert.ok(h.text.length>0);
    P.apply(pz,st,h);if(h.type==='place')assert.ok(P.solve(pz,st),'a placement hint keeps the dock clearable');
  }
  assert.ok(cleared(pz,st),`${d}/${seed} hints clear the dock`);
}

// Near-miss: empty for a clean clear; names the first placement that made clearing impossible; or says what's next.
let named=0;
for(let seed=1;seed<=40;seed++){
  const pz=P.generate(seed,'hard'),full=run(pz,pz.plan);assert.equal(P.nearMiss(pz,full),'');
  assert.match(P.nearMiss(pz,run(pz,pz.plan.slice(0,-1))),/still on the dock and the load could still be finished/);
  const g=P.greedy(pz,'big'),line=P.nearMiss(pz,g);
  let k=1;while(P.solve(pz,{placed:g.placed.slice(0,k)}))k++;
  const q=g.placed[k-1];assert.ok(line.includes(`Loading the ${pz.crates[q.crate].name.charAt(0).toLowerCase()+pz.crates[q.crate].name.slice(1)} on ${pz.pallets[q.pallet].name}`),line);
  assert.match(line,new RegExp(`\\(move ${k}\\) made clearing the dock impossible`));if(/instead would have kept it clearable/.test(line))named++;
}
assert.ok(named>30,'the near-miss usually names an alternative move');

// ==== Voyage mode ====================================================================================================
const LEAN={preset:'lean'};
const V0=(seed=1,d='normal',settings=LEAN)=>P.createVoyage(seed,d,{par:false,settings});
const A=(V,a)=>{const before=JSON.stringify(V),why=P.act(V,a);if(why)assert.equal(JSON.stringify(V),before,'a refused action leaves the voyage untouched');return why;};
const ok=(V,a)=>assert.equal(P.act(V,a),null,JSON.stringify(a));
const add=(V,k,extra={})=>{const g=P.GOODS[k];V.items.push({...g,id:V.items.length,kind:k,topKind:g.top,top:Array.from({length:g.w},(_,i)=>g.top==='flat'?1:g.top==='narrow'?(i>0&&i<g.w-1?1:0):g.top==='lid'?(i<Math.ceil(g.w/2)?1:0):0),fragile:!!g.fragile,heavy:!!g.heavy,status:'dock',order:null,arrived:V.leg,...extra});V.dock.push(V.items.length-1);return V.items.length-1;};
// Determinism and arrivals.
for(const d of ['easy','normal','hard'])assert.deepEqual(P.createVoyage(5,d),P.createVoyage(5,d));
{
  let early=0,late=0,ne=0,nl=0;
  for(const cfg of P.VOYAGES)for(let seed=1;seed<=100;seed++){
    const sch=P.schedule(seed,cfg);assert.equal(sch.length,cfg.legs);
    sch.forEach((l,i)=>{assert.ok(l.length>=cfg.arrivals[0]&&l.length<=cfg.arrivals[1]);for(const g of l){if(g.order)assert.ok(g.order.due>=i+2&&g.order.due<=cfg.legs&&g.order.bonus>0);
      if(i<cfg.legs/3){early+=P.GOODS[g.kind].tier;ne++;}else if(i>=cfg.legs*2/3){late+=P.GOODS[g.kind].tier;nl++;}}});
  }
  assert.ok(late/nl-early/ne>1.5,`goods climb the ladder (early tier ${(early/ne).toFixed(2)}, late ${(late/nl).toFixed(2)})`);
  const V=V0(4);assert.equal(V.leg,1);assert.equal(V.dock.length,V.arrivals[0].length);assert.equal(V.vehicles.length,1);
  assert.deepEqual([V.vehicles[0].type,V.vehicles[0].width,V.vehicles[0].height,V.vehicles[0].maxWeight,V.vehicles[0].trip],['hopper',3,3,8,1],'every rocket starts as a hopper');
  assert.deepEqual(V.vehicles[0].cap,[2,3,2],'a hopper fairing narrows to one column at the top');
}
// Settings: presets, clamping, starting fleet, and their effect on par (deterministic per settings).
{
  assert.equal(P.normSettings({preset:'fleet'}).start,2);assert.equal(P.normSettings({}).preset,P.DEFAULT_PRESET);
  const c=P.normSettings({preset:'lean',start:9,maxFleet:1,priceScale:7,incomeScale:0.1,legs:5});
  assert.deepEqual([c.start,c.maxFleet,c.priceScale,c.incomeScale,c.legs,c.preset],[3,3,2,0.5,0,'custom'],'out-of-range settings clamp; edited presets become custom');
  const F=P.createVoyage(4,'normal',{settings:{preset:'fleet'}});assert.equal(F.vehicles.length,2);assert.ok(F.vehicles.every(v=>v.type==='hopper'));
  const L=P.createVoyage(4,'normal',{settings:{preset:'longhaul'}});assert.equal(L.legs,14);assert.equal(L.arrivals.length,14);
  // Seed 3: on many seeds One pad builds its second hopper on leg 1 (30 cr) and then plays like Two pads, with equal par.
  const pars=P.PRESETS.map(p=>P.createVoyage(3,'normal',{settings:{preset:p.id}}).par);assert.equal(new Set(pars).size,pars.length,'each preset has its own par');
  assert.deepEqual(P.createVoyage(4,'normal',{settings:{preset:'generous'}}),P.createVoyage(4,'normal',{settings:{preset:'generous'}}));
  const cheap=P.createVoyage(4,'normal',{par:false,settings:{preset:'lean',priceScale:0.5}}),dear=P.createVoyage(4,'normal',{par:false,settings:{preset:'lean',priceScale:2}});
  assert.equal(P.upgradePrice(cheap,cheap.vehicles[0],'stage')*4,P.upgradePrice(dear,dear.vehicles[0],'stage'),'price scale applies to every price');
  const rich=P.createVoyage(4,'normal',{par:false,settings:{preset:'lean',incomeScale:2}});assert.equal(rich.items[0].value,2*V0(4).items[0].value,'income scale applies to goods');
  assert.match(P.settingsText(P.normSettings({preset:'lean'})),/One pad: 1 rocket to start, max 3, price ×1, income ×1/);
  assert.deepEqual(P.PRESETS.map(p=>p.name),['One pad','Two pads','Research grant','Long campaign']);
}
// Loading, launching, in orbit and returning, payment at the end of the leg.
{
  const V=V0(4),veh=V.vehicles[0];V.dock.length=0;const id=add(V,'cell'),other=add(V,'crystal'),it=V.items[id];
  assert.match(A(V,{type:'depart',vehicle:0}),/empty/);assert.match(A(V,{type:'place',item:id,vehicle:0,x:9}),/does not fit/);
  ok(V,{type:'place',item:id,vehicle:0,x:0});ok(V,{type:'lift',item:id});assert.ok(V.dock.includes(id));
  // A 3-wide hopper: a crate alone at the edge is off-centre and cannot launch.
  ok(V,{type:'place',item:id,vehicle:0,x:0});assert.match(A(V,{type:'depart',vehicle:0}),/off-centre: centre of mass 0\.50, keep it within 0\.75–2\.25 to launch/,'centre of mass gates launch');
  ok(V,{type:'lift',item:id});ok(V,{type:'place',item:id,vehicle:0,x:1});ok(V,{type:'place',item:other,vehicle:0,x:0});
  const credits=V.credits;ok(V,{type:'depart',vehicle:0});assert.equal(veh.away,1);assert.equal(V.credits,credits,'paid at the end of the leg');assert.equal(V.launches,1);
  assert.match(A(V,{type:'upgrade',vehicle:0,kind:'load'}),/in orbit/);assert.match(A(V,{type:'place',item:V.dock[0]??0,vehicle:0,x:0}),/in orbit|not on the dock/);
  ok(V,{type:'end'});assert.equal(V.leg,2);assert.equal(V.credits,credits+it.value+V.items[other].value);assert.equal(veh.away,0,'a 1-leg trip is back from orbit next leg');
  assert.equal(V.lastReport.front,2);assert.equal(V.lastReport.lab,0);
  V.credits+=40;ok(V,{type:'upgrade',vehicle:0,kind:'stage'});assert.equal(veh.trip,2);
  V.dock.length=0;const z=add(V,'plate');ok(V,{type:'place',item:z,vehicle:0,x:1});
  ok(V,{type:'depart',vehicle:0});assert.equal(veh.away,2);ok(V,{type:'end'});assert.equal(veh.away,1);ok(V,{type:'end'});assert.equal(veh.away,0);
}
// The upgrade route: stat upgrades within a stage, refits raise the caps, levels carry over, the fairing taper follows
// the stage (the nose upgrade takes a step off it), extra rockets are hoppers.
{
  const V=V0(4);V.credits=10;const s=V.vehicles[0];
  assert.match(A(V,{type:'upgrade',vehicle:0,kind:'stage'}),/Needs 40 cr/);assert.match(A(V,{type:'upgrade',vehicle:0,kind:'fast'}),/No more faster turnaround at the hopper stage/);
  assert.match(A(V,{type:'upgrade',vehicle:0,kind:'nose'}),/No more wider nose at the hopper stage/);
  V.credits=1000;ok(V,{type:'upgrade',vehicle:0,kind:'wide'});assert.equal(s.width,4);assert.deepEqual(s.cap,[2,3,3,2],'widening widens the top row too');
  assert.match(A(V,{type:'upgrade',vehicle:0,kind:'wide'}),/No more fairing \+1 wide at the hopper stage/);
  ok(V,{type:'upgrade',vehicle:0,kind:'load'});assert.equal(s.maxWeight,14);
  ok(V,{type:'upgrade',vehicle:0,kind:'stage'});assert.deepEqual([s.type,s.width,s.height,s.maxWeight,s.trip],['lifter',5,3,22,2],'a refit keeps earlier upgrades on top of the lifter base');
  assert.deepEqual(s.cap,[2,3,3,3,2]);
  ok(V,{type:'upgrade',vehicle:0,kind:'wide'});assert.equal(s.width,6,'the lifter stage allows a second widening');
  ok(V,{type:'upgrade',vehicle:0,kind:'nose'});assert.equal(s.taper,0);assert.deepEqual(s.cap,[3,3,3,3,3,3],'the wider nose straightens a lifter');
  assert.match(A(V,{type:'upgrade',vehicle:0,kind:'nose'}),/already straight/);
  ok(V,{type:'upgrade',vehicle:0,kind:'fast'});assert.equal(s.trip,1);assert.match(A(V,{type:'upgrade',vehicle:0,kind:'fast'}),/No more/);
  ok(V,{type:'upgrade',vehicle:0,kind:'stage'});assert.deepEqual([s.type,s.width,s.height,s.maxWeight,s.trip,s.reinforced,s.taper],['heavy',8,4,40,2,true,1],'heavy lifter: bigger, reinforced, slower, stepped');
  assert.deepEqual(s.cap,[3,4,4,4,4,4,4,3]);assert.match(A(V,{type:'upgrade',vehicle:0,kind:'stage'}),/Already a heavy lifter/);
  const H=V0(4);H.credits=1000;const h=H.vehicles[0];ok(H,{type:'upgrade',vehicle:0,kind:'stage'});ok(H,{type:'upgrade',vehicle:0,kind:'stage'});
  assert.deepEqual(h.cap,[2,3,4,4,3,2],'a plain heavy lifter narrows two cells on each side');
  const c=V.credits;ok(V,{type:'buy'});assert.equal(V.vehicles.length,2);assert.equal(V.vehicles[1].type,'hopper');assert.equal(V.credits,c-30,'the first extra rocket costs 30');const c2=V.credits;
  ok(V,{type:'buy'});assert.equal(V.credits,c2-45,'each extra rocket costs more');assert.equal(V.vehicles.length,3);assert.match(A(V,{type:'buy'}),/maximum of 3 rockets/,'the pad cap holds');
  // A reinforced deck lets a heavy crate rest on a light one.
  const R=V0(4);R.dock.length=0;const pl=add(R,'plate'),ore=add(R,'ore');ok(R,{type:'place',item:pl,vehicle:0,x:0});
  assert.match(A(R,{type:'place',item:ore,vehicle:0,x:0}),/heavy/);R.credits=99;ok(R,{type:'upgrade',vehicle:0,kind:'floor'});ok(R,{type:'place',item:ore,vehicle:0,x:0});
  // The taper limits voyage fairings too: a relay (1×3) only fits a hopper's middle column.
  const T=V0(4);T.dock.length=0;T.credits=99;ok(T,{type:'upgrade',vehicle:0,kind:'load'});const rl=add(T,'relay');
  assert.match(A(T,{type:'place',item:rl,vehicle:0,x:0}),/fairing narrows: column 1 is only 2 high/);ok(T,{type:'place',item:rl,vehicle:0,x:1});
}
// The grouped hangar: one group per rocket with its route, next transformation and at most three upgrades shown.
{
  const V=P.createVoyage(1,'normal',{par:false,settings:{preset:'fleet'}}),d=P.shop(V);
  assert.equal(d.groups.length,2);for(const g of d.groups){assert.deepEqual(g.route.map(r=>r.state),['now','next','next']);assert.ok(g.transform&&g.transform.price===40);
    assert.ok(g.upgrades.length<=3&&g.upgrades.every((u,i,a)=>!i||a[i-1].price<=u.price));assert.ok(g.upgrades.concat(g.more).every(o=>o.price>0&&o.detail));}
  assert.match(d.groups[0].transform.detail,/fairing 3×3→4×3 \(7→10 cells\), payload 8→16, 2-leg trip/);assert.equal(d.groups[0].transform.label,'Refit → Lifter');
  assert.equal(d.add.price,45);assert.equal(d.add.label,'Build a hopper');assert.match(d.add.detail,/2\/5 rockets/);
  assert.match(d.groups[0].upgrades.find(u=>u.kind==='wide').detail,/3→4 wide, top row 1→2/);
}
// Payload is a real limit on rockets, and the fairing says what it blocks.
{
  const V=V0(4);V.dock.length=0;V.credits=200;ok(V,{type:'upgrade',vehicle:0,kind:'stage'});const sh=add(V,'shield'),g=add(V,'gear');
  ok(V,{type:'place',item:g,vehicle:0,x:0});assert.match(A(V,{type:'place',item:sh,vehicle:0,x:0}),/Over payload|Overhang|cannot|narrows/);
  const W=V0(4);W.dock.length=0;W.credits=200;ok(W,{type:'upgrade',vehicle:0,kind:'stage'});const g1=add(W,'gear'),g2=add(W,'gear'),p2=add(W,'plate');
  ok(W,{type:'place',item:g1,vehicle:0,x:0});ok(W,{type:'place',item:g2,vehicle:0,x:2});
  assert.match(A(W,{type:'place',item:p2,vehicle:0,x:1}),/Over payload: 17\/16 on Lifter 1/);assert.match(P.weightNote(W,0),/raise the lifter 1's payload to launch the plates/);
  ok(W,{type:'upgrade',vehicle:0,kind:'load'});ok(W,{type:'place',item:p2,vehicle:0,x:1});assert.equal(P.palletStats(P.view(W).pz,P.view(W).st,0).full,true,'gear kits in the shoulders, plates on top: full');
}
// Destinations: the first crate tags an empty fairing; the other destination is refused until it launches or empties.
{
  const V=V0(4);V.dock.length=0;const pl=add(V,'plate'),ts=add(V,'tissue',{name:'Warden tissue sample'}),dc=add(V,'datacore');
  assert.equal(P.view(V).pz.pallets[0].dest,null,'an empty fairing is open');
  ok(V,{type:'place',item:pl,vehicle:0,x:0});assert.equal(P.view(V).pz.pallets[0].dest,'front');
  assert.match(A(V,{type:'place',item:ts,vehicle:0,x:2}),/Hopper 1 is bound for the front: samples go up to the lab/);
  ok(V,{type:'lift',item:pl});ok(V,{type:'place',item:ts,vehicle:0,x:0});ok(V,{type:'place',item:dc,vehicle:0,x:2});assert.equal(P.destOf(V,V.vehicles[0]),'lab');
  assert.match(A(V,{type:'place',item:pl,vehicle:0,x:0}),/bound for the lab: gear goes to the front/);
  V.credits=0;assert.match(P.voyageHint(V).text,/Launch the hopper 1 to the lab now/);
  ok(V,{type:'depart',vehicle:0});assert.equal(V.pending[0].dest,'lab');ok(V,{type:'end'});
  assert.deepEqual([V.lastReport.front,V.lastReport.lab],[0,2]);assert.match(P.voyageOutput(V),/^Launched: 1 rocket · 0 crates to the front · 2 samples to the lab/);
  assert.equal(P.view(V).pz.pallets[0].dest,null,'back from orbit with an open bay');ok(V,{type:'place',item:pl,vehicle:0,x:0});
}
// Sample crates and lab orders: samples come from exploration's fights (enemy archetypes and terrain), are small and
// mostly fragile, and are bound for the lab; orders alternate between the lieutenants and the lab, sometimes for two.
{
  const samples=Object.entries(P.GOODS).filter(([,g])=>g.sample);assert.deepEqual(samples.map(([k])=>k).sort(),['datacore','groundcore','tissue']);
  assert.ok(samples.every(([,g])=>g.dest==='lab'&&g.w*g.h<=2));assert.ok(Object.values(P.GOODS).filter(g=>!g.sample).every(g=>g.dest==='front'));
  let lab=0,front=0,twos=0,sampleN=0,total=0;const names=new Set();
  for(const cfg of P.VOYAGES)for(let seed=1;seed<=60;seed++){
    const sch=P.schedule(seed,cfg),byId=new Map();
    sch.forEach((l,i)=>{for(const g of l){total++;const t=P.GOODS[g.kind];if(t.sample){sampleN++;assert.ok(P.SOURCES[t.src].includes(g.src),'a sample names its source');}
      if(g.order){const o=g.order;(byId.get(o.id)||byId.set(o.id,[]).get(o.id)).push({g,leg:i+1});
        if(o.team==='lab'){assert.equal(o.by,'Lab');assert.ok(t.sample,'the lab asks for samples');}else{assert.ok(P.LTS.includes(o.by));assert.ok(!t.sample);}}}});
    for(const [,list] of byId){const o=list[0].g.order;assert.equal(list.length,o.qty,'an order covers exactly its items');assert.ok(list.every(x=>x.g.kind===list[0].g.kind&&x.leg===list[0].leg));
      if(o.team==='lab')lab++;else front++;if(o.qty>1)twos++;}
    if(seed<=5){const V=P.createVoyage(seed,cfg.id,{par:false});while(!V.over)P.act(V,{type:'end'});for(const it of V.items)if(it.sample)names.add(it.name);}
  }
  assert.ok(lab>100&&front>100,`orders from both teams (front ${front}, lab ${lab})`);assert.ok(twos>20,'some orders ask for two');
  assert.ok(sampleN/total>0.15&&sampleN/total<0.45,`samples are a real share of arrivals (${(sampleN/total*100).toFixed(0)}%)`);
  assert.ok([...names].every(n=>/^(Chaff|Bruiser|Warden|Cleanser|Reflector|Anchor|Bulwark|Quickstep) (tissue sample|data core)$|^(Basalt|Moss bed|Ember flat|Salt pan|Kelp shallows) ground core$/.test(n)),'samples are named after their source');
  assert.ok([...names].some(n=>/tissue sample$/.test(n))&&[...names].some(n=>/ground core$/.test(n)),[...names].join());
  const W=P.createVoyage(1,'normal',{par:false}),os=P.orders(W);
  const fake={id:7,by:'Lab',team:'lab',due:4,bonus:13,qty:1,kind:'tissue',name:'Warden tissue sample'};assert.equal(P.orderText(fake),'Lab needs a warden tissue sample by leg 4');
  assert.equal(P.orderText({id:8,by:'Lt Vega',team:'front',due:5,bonus:40,qty:2,kind:'shield',name:'Field shield'}),'Lt Vega needs 2 field shields by leg 5');
  assert.ok(Array.isArray(os));
}
// Dock overflow: at the end of a leg the dock keeps its slots; the lowest-value goods are scrapped, orders last.
{
  const V=V0(4);for(let i=0;i<V.slots+3;i++)add(V,i%2?'ore':'gear',{order:i===0?{lt:1,due:9,bonus:5}:null});
  const before=V.dock.map(i=>V.items[i]);ok(V,{type:'end'});
  const scrapped=V.items.filter(it=>it.status==='scrapped');assert.equal(scrapped.length,before.length-V.slots);
  const kept=before.filter(it=>it.status==='dock');assert.ok(Math.min(...kept.filter(i=>!i.order).map(i=>i.value))>=Math.max(...scrapped.map(i=>i.value)));
  assert.ok(before.filter(i=>i.order).every(i=>i.status==='dock'),'orders are scrapped last');
  const S=V0(4),id=S.dock[0];ok(S,{type:'scrap',item:id});assert.equal(S.items[id].status,'scrapped');assert.match(A(S,{type:'scrap',item:id}),/not on the dock/);
}
// Order deadlines: on time pays the bonus, late pays only the value.
for(const late of [false,true]){
  const V=V0(4);V.dock.length=0;const c=add(V,'cell',{order:{id:1,by:'Lt Okafor',team:'front',due:2,bonus:10,qty:1}}),c2=add(V,'cell');
  if(late){ok(V,{type:'end'});ok(V,{type:'end'});ok(V,{type:'end'});}
  const d0=V.delivered;ok(V,{type:'place',item:c,vehicle:0,x:0});ok(V,{type:'place',item:c2,vehicle:0,x:1});ok(V,{type:'depart',vehicle:0});ok(V,{type:'end'});
  assert.equal(V.delivered-d0,late?16:26,late?'late: value only':'on time: value + bonus');
}
// Par: the planner's actions replay legally to exactly par under every preset; Skip never buys and lands below par.
const prog={},presets={};
for(const d of ['easy','normal','hard']){
  let below=0,buys=0,firstBuy=0,fb=0,perLeg=null,valLeg=null;
  for(let seed=1;seed<=60;seed++){
    const V=P.createVoyage(seed,d),R=P.createVoyage(seed,d,{par:false});
    for(const a of V.parActions){ok(R,a);if(a.type==='place'){const v=R.vehicles[a.vehicle];assert.equal(new Set(v.load.map(q=>R.items[q.item].dest)).size,1,'one destination per fairing');}}assert.ok(R.over);assert.equal(R.delivered,V.par);assert.equal(P.voyageTier({...R,par:V.par}),'perfect');
    const auto=P.autoVoyage(P.createVoyage(seed,d,{par:false}));assert.ok(auto.over);assert.ok(!auto.log.some(a=>a.type==='buy'||a.type==='upgrade'));assert.ok(auto.delivered<=V.par);if(auto.delivered<V.par)below++;
    buys+=V.parBuys.length;if(V.parBuys.length){firstBuy+=V.parBuys[0].leg;fb++;}
    perLeg=perLeg||Array(V.legs).fill(0);valLeg=valLeg||Array(V.legs).fill(0);V.arrivals.forEach((l,i)=>{perLeg[i]+=l.length;valLeg[i]+=l.reduce((a,g)=>a+P.GOODS[g.kind].value,0);});
  }
  assert.ok(below>=57,`${d}: skip lands below par in ${below}/60`);
  prog[d]={buys:(buys/60).toFixed(1),firstBuy:(firstBuy/fb).toFixed(1),items:perLeg.map(x=>(x/60).toFixed(1)).join(' '),value:valLeg.map(x=>Math.round(x/60)).join(' ')};
}
for(const pre of P.PRESETS){let par=0,ups=0,legs=0;for(let seed=1;seed<=20;seed++){const V=P.createVoyage(seed,'normal',{settings:{preset:pre.id}}),R=P.createVoyage(seed,'normal',{par:false,settings:{preset:pre.id}});
  for(const a of V.parActions)ok(R,a);assert.equal(R.delivered,V.par);par+=V.par;ups+=V.parBuys.length;legs+=V.legs;}
  presets[pre.id]={par:Math.round(par/20),perLeg:(ups/legs).toFixed(2)};}
{
  const V={delivered:0,par:100};assert.equal(P.voyageTier(V),'failed');V.delivered=100;assert.equal(P.voyageTier(V),'perfect');
  V.delivered=80;assert.equal(P.voyageTier(V),'good');V.delivered=79;assert.equal(P.voyageTier(V),'partial');
}
// Hints: from the start they are the par plan; from random positions they are always legal and finish the voyage.
{
  const V=P.createVoyage(9,'normal'),R=P.createVoyage(9,'normal',{par:false});
  for(let i=0;i<25;i++){const h=P.voyageHint(R);const {text,...a}=h;assert.deepEqual(a,V.parActions[i]);assert.ok(text.length>0);ok(R,a);}
  for(let seed=1;seed<=15;seed++){
    const W=P.createVoyage(seed,'hard',{par:false}),r=Kit.rng(seed);
    for(let i=0;i<30;i++){const moves=[];
      for(const id of W.dock)W.vehicles.forEach((v,vi)=>{for(let x=0;x<v.width;x++)if(!P.checkAct(W,{type:'place',item:id,vehicle:vi,x}))moves.push({type:'place',item:id,vehicle:vi,x});});
      W.vehicles.forEach((v,vi)=>{if(!P.departCheck(W,vi))moves.push({type:'depart',vehicle:vi});});if(r.chance(.15))moves.push({type:'end'});
      if(moves.length)ok(W,r.pick(moves));}
    let steps=0;while(!W.over){const h=P.voyageHint(W);assert.equal(P.checkAct(W,h),null,h.text);ok(W,(({text,...a})=>a)(h));assert.ok(++steps<4000);}
  }
}
// Near-miss names the biggest missed value and the gap to par.
{
  for(let seed=1;seed<=20;seed++){const V=P.createVoyage(seed,'normal'),auto=P.autoVoyage(P.createVoyage(seed,'normal',{par:false}));auto.par=V.par;
    const line=P.voyageNearMiss(auto);if(auto.delivered<V.par)assert.match(line,/Par was \d+ cr; you delivered \d+/);assert.match(line,/cr|deadline/);}
  const V=P.createVoyage(2,'easy'),R=P.createVoyage(2,'easy',{par:false});for(const a of V.parActions)ok(R,a);R.par=V.par;assert.match(P.voyageOutput(R),/^Launched: \d+ rockets · \d+ crates? to the front · \d+ samples? to the lab · \d+ cr over 6 legs/);
}
console.log(`PASS rocket loading single launch: determinism; ${SEEDS}×${ids.length} seeds with planted full load verified in ${taperedTotal} tapered fairings (${(emptyTotal/palletTotal).toFixed(2)} empty cells per fairing, no weight limits), solver clears, greedy never clears (slowest ${slowest}ms); random legal play clears ${ids.map(d=>d+' '+rates[d].random).join(', ')}; auto leaves ${ids.map(d=>rates[d].autoLeaves).join('/')} crates on average; taper ceilings, blocked shoulders and the solver/hint honouring them; rules, atomic invalid moves, inclusive centre of mass, tiers, converging legal hints, near-miss names the dead-end move`);
console.log(`PASS rocket loading voyage: arrivals climb the ladder; rockets start as hoppers and grow along hopper → lifter → heavy lifter (caps, carried-over levels, tapered fairings that widen, the wider nose, pad cap, new rockets are hoppers); grouped hangar; settings and presets (clamping, price and income scale, deterministic par per preset); load/lift/launch, in orbit and back, pay at leg end, centre-of-mass gate, reinforced deck, payload notes; destinations (bay tags, refusals, per-destination delivery and output); sample crates and lab orders (sources, both teams, two-item orders); dock overflow, order deadlines; par replay on 180 voyages + 80 preset voyages with one destination per fairing; skip below par; tiers; legal converging hints; near-miss. Default preset (${P.DEFAULT_PRESET}) progression ${['easy','normal','hard'].map(d=>`${d}: value/leg ${prog[d].value}; par purchases ${prog[d].buys} (first at leg ${prog[d].firstBuy})`).join(' | ')}. Presets on normal: ${P.PRESETS.map(p=>`${p.name} par ${presets[p.id].par}, ${presets[p.id].perLeg} purchases/leg`).join('; ')}`);
