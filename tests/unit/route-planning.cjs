'use strict';
// Route planning (road network) model: determinism of puzzles and of replayed nights; the station schedule (something
// new every night); par replays to exactly par and beats Skip; day/night (no edits by day); pathing, tile capacity,
// queues and junction time; no gridlock; one-way joins and their capacity; warehouses; costs and refunds; undo; the
// dusk report; tiers, hints and the near-miss line.
const assert=require('node:assert/strict'),P=require('../../prototypes/minigames/route-planning/route-planning-model.js');
const started=Date.now(),SEEDS=Number(process.env.RP_SEEDS)||3;

// ---- generated puzzles ----------------------------------------------------------------------------------------------
const use={warehouse:0,oneway:0,roundabout:0,bypass:0},summary={};
for(const diff of P.DIFFICULTIES){
  const d=diff.id;let parSum=0,autoSum=0,slow=0;
  assert.deepEqual(P.generate(7,d,{noPlan:true}),P.generate(7,d,{noPlan:true}),`${d} generation is deterministic`);
  for(let seed=1;seed<=SEEDS;seed++){
    const t0=Date.now(),pz=P.generate(seed,d);slow=Math.max(slow,Date.now()-t0);
    assert.equal(pz.W,diff.W);assert.equal(pz.H,diff.H);assert.equal(pz.days,diff.days);
    const S=pz.stations;
    // Stations on dry ground, two tiles apart; each type someone needs has a maker on or before that day.
    for(const s of S){
      assert.ok(pz.terrain[s.tile]===0||pz.terrain[s.tile]===2,`${d}/${seed} station ${s.id} on dry ground`);
      for(const o of S)if(o.id<s.id)assert.ok(Math.max(Math.abs(o.x-s.x),Math.abs(o.y-s.y))>=2,`${d}/${seed} stations ${o.id},${s.id} apart`);
      if(s.kind==='consumer')for(const t of s.needs)assert.ok(S.some(p=>p.kind==='producer'&&p.type===t&&p.day<=s.day),`${d}/${seed} ${s.name} has a maker of ${t}`);
    }
    // The schedule: stations on day 1, and at least one new one every later night.
    assert.ok(S.filter(s=>s.day===1).length>=3);
    for(let day=2;day<=pz.days;day++)assert.ok(S.some(s=>s.day===day),`${d}/${seed} a new station on night ${day}`);
    // The river runs the full height.
    for(let y=0;y<pz.H;y++)assert.ok(pz.terrain.slice(y*pz.W,(y+1)*pz.W).includes(1),'river row '+y);
    // Par: the planner's nights replay without errors to exactly par, deterministically; Skip scores below it.
    const a=P.replay(pz,pz.plan),b=P.replay(pz,pz.plan);
    assert.deepEqual(a.errors,[],`${d}/${seed} plan replays cleanly`);
    assert.equal(a.score,pz.par,`${d}/${seed} replay = par`);assert.deepEqual(P.result(pz,a),P.result(pz,b));
    assert.equal(P.tier(pz,P.result(pz,a)),'perfect');assert.equal(P.nearMiss(pz,a),'');
    assert.ok(pz.autoScore<=pz.par,`${d}/${seed} auto ${pz.autoScore} <= par ${pz.par}`);
    const sk=P.create(pz),ar=P.auto(pz,sk);assert.equal(ar.score,pz.autoScore);
    for(const k in use)use[k]+=pz.planUse[k]>0?1:0;
    parSum+=pz.par;autoSum+=pz.autoScore;
  }
  assert.ok(slow<2500,`${d} slowest generation ${slow}ms`);
  summary[d]={par:Math.round(parSum/SEEDS),auto:Math.round(autoSum/parSum*100)+'%',slowMs:slow};
}

// ---- a hand-built fixture --------------------------------------------------------------------------------------------
// A 10×3 open strip: a ● producer at (0,1) and a consumer of ● at (9,1). Optional extra stations.
function fixture(over){
  const W=10,H=3,st=(id,kind,x,y,extra)=>({id,kind,x,y,tile:y*W+x,type:null,needs:[],day:1,short:'S'+id,name:`S${id} ${kind}`,...extra});
  const stations=over&&over.stations||[st(0,'producer',0,1,{type:0}),st(1,'consumer',9,1,{needs:[0]})];
  const bAt=new Array(W*H).fill(-1);for(const s of stations)bAt[s.tile]=s.id;
  return {id:'route-planning',seed:1,difficulty:'easy',W,H,terrain:new Array(W*H).fill(0),stations,bAt,days:3,dayTicks:P.DAY_TICKS,types:1,
    prodTicks:4,dem:3,growth:0,patience:30,credits0:200,plan:[],par:50,...(over||{}),...(over&&over.terrainAt?{}:{})};
}
const row=(pz,y,x0,x1)=>{const out=[];for(let x=x0;x0<=x1?x<=x1:x>=x1;x+=x0<=x1?1:-1)out.push(y*pz.W+x);return out;};
{
  const pz=fixture(),sim=P.create(pz);
  // Night: build; costs; a road that already exists is refused; mountains are refused.
  assert.equal(sim.phase,'night');assert.equal(sim.credits,200);
  let r=P.edit(pz,sim,{type:'road',tiles:row(pz,1,0,9)});
  assert.equal(r.why,undefined);assert.equal(r.cost,8*2,'eight road tiles at 2 (buildings are free)');assert.equal(sim.credits,184);
  assert.match(P.edit(pz,sim,{type:'road',tiles:row(pz,1,2,4)}).why,/already there/);
  assert.match(P.edit(pz,sim,{type:'road',tiles:[0,2]}).why,/neighbouring/);
  // Undo restores credits and the network; redo it.
  assert.ok(P.undo(pz,sim));assert.equal(sim.credits,200);assert.equal(sim.net.tier[15],0);
  P.edit(pz,sim,{type:'road',tiles:row(pz,1,0,9)});
  // The route: straight along row 1, 3 ticks a tile.
  const g=P.graph(pz,sim);assert.equal(g.ticks[13],3);assert.equal(g.cap[13],2);
  assert.deepEqual(P.freeRoutes(pz,sim,10).dist[19]<Infinity,true);
  // Day: no edits, and the day runs a fixed number of ticks to dusk.
  assert.ok(P.startDay(pz,sim));assert.match(P.edit(pz,sim,{type:'road',tiles:[0]}).why,/only be changed at night/);assert.equal(P.undo(pz,sim),false);
  let ticks=0;while(sim.phase==='day'){P.step(pz,sim);ticks++;}
  assert.equal(ticks,P.DAY_TICKS);assert.equal(sim.phase,'night');assert.equal(sim.day,2);
  assert.ok(sim.deliveries>=8,`deliveries ${sim.deliveries}`);assert.equal(sim.report.day,1);
  assert.equal(sim.days[0].clean,true);assert.equal(sim.score,sim.deliveries+P.CLEAN_BONUS);
  assert.equal(sim.credits,184+sim.deliveries*P.DELIVERY_CREDIT+P.STIPEND);
  // Refunds: full construction value on any night.
  const before=sim.credits;P.edit(pz,sim,{type:'erase',tiles:[15]});assert.equal(sim.credits,before+2);
  P.edit(pz,sim,{type:'road',tiles:[14,15,16]});const mid=sim.credits;P.edit(pz,sim,{type:'erase',tiles:[15]});assert.equal(sim.credits,mid+2);
  assert.match(P.edit(pz,sim,{type:'erase',tiles:[5]}).why,/Nothing to erase/);
}
{
  // Bridges cost four times; mountains cannot be built on.
  const pz=fixture();pz.terrain[13]=1;pz.terrain[3]=3;const sim=P.create(pz);
  assert.equal(P.edit(pz,sim,{type:'road',tiles:[12,13,14]}).cost,2+8+2);
  assert.match(P.edit(pz,sim,{type:'road',tiles:[2,3]}).why,/Mountains/);
  // Dirt and highway tiers; re-tiering pays the difference.
  assert.equal(P.edit(pz,sim,{type:'road',tier:'dirt',tiles:[21,22]}).cost,2);
  assert.equal(P.edit(pz,sim,{type:'road',tier:'highway',tiles:[21,22]}).cost,8);
  const g=P.graph(pz,sim);assert.equal(g.ticks[21],P.ROADS[3].ticks);assert.equal(g.cap[21],3);
  // Not enough credits: refused, nothing changes.
  sim.credits=3;assert.match(P.edit(pz,sim,{type:'road',tiles:[1,2]}).why,/needs 4 credits; you have 3/);assert.equal(sim.net.tier[1],0);
}
{
  // Parallel roads side by side stay separate; a single tapped tile joins all its neighbours.
  const pz=fixture(),sim=P.create(pz);
  P.edit(pz,sim,{type:'road',tiles:row(pz,0,1,5)});P.edit(pz,sim,{type:'road',tiles:row(pz,1,1,5)});
  assert.equal(sim.net.e[2]&4,0,'no join between rows');assert.equal(P.isJunction(sim,12),false);
  P.edit(pz,sim,{type:'road',tiles:[23]});P.edit(pz,sim,{type:'road',tiles:[13,23]});
  assert.ok(P.isJunction(sim,13),'three joins make a junction');
  const g=P.graph(pz,sim);assert.equal(g.ticks[13],3+P.JUNCTION_TICKS);assert.equal(g.shared[13],1);assert.equal(g.cap[13],2);
  // A roundabout removes the junction's extra time and separates its entry lanes.
  assert.equal(P.edit(pz,sim,{type:'roundabout',tile:13}).cost,P.ROUND_COST);
  const g2=P.graph(pz,sim);assert.equal(g2.ticks[13],3);assert.equal(g2.cap[13],2);assert.equal(g2.shared[13],0);
  assert.match(P.edit(pz,sim,{type:'roundabout',tile:2}).why,/three or more/);
}
{
  // Capacity and queues: a single-lane trunk with heavy demand jams; vehicles queue but the day still flows (no gridlock).
  const W=10,st=(id,kind,x,y,extra)=>({id,kind,x,y,tile:y*W+x,type:null,needs:[],day:1,short:'S'+id,name:`S${id} ${kind}`,...extra});
  const stations=[st(0,'producer',0,0,{type:0}),st(1,'producer',0,2,{type:0}),st(2,'consumer',9,0,{needs:[0]}),st(3,'consumer',9,2,{needs:[0]})];
  const pz=fixture({stations,prodTicks:2,dem:1.5,patience:12});
  const trunk=P.create(pz);
  // One shared trunk along row 1 with branches.
  P.edit(pz,trunk,{type:'road',tiles:[0,10,11,12,13,14,15,16,17,18,19,9]});P.edit(pz,trunk,{type:'road',tiles:[20,10]});P.edit(pz,trunk,{type:'road',tiles:[19,29]});
  P.runDay(pz,trunk);const jam=trunk.report.ds.jam.reduce((a,b)=>a+b,0);
  assert.ok(jam>0,'the trunk jams');assert.ok(trunk.report.problems.some(p=>p.kind==='jam'),'the report names the jam');
  assert.ok(trunk.days[0].deliveries>5,'traffic still moves through a jam');
  // Two separate roads flow better than the shared trunk.
  const two=P.create(pz);P.edit(pz,two,{type:'road',tiles:row(pz,0,0,9)});P.edit(pz,two,{type:'road',tiles:row(pz,2,0,9)});
  P.runDay(pz,two);assert.ok(two.days[0].deliveries>trunk.days[0].deliveries,`parallel ${two.days[0].deliveries} > trunk ${trunk.days[0].deliveries}`);
  // The report's problems each point at tiles to locate, and name what happened.
  for(const p of trunk.report.problems){assert.ok(p.tiles.length>0);assert.equal(typeof p.text,'string');}
  assert.ok(trunk.report.problems.length<=3);
  // A ring of one-ways still makes progress without a stuck timer forcing vehicles through capacity.
  const ring=P.create(pz);
  P.edit(pz,ring,{type:'road',tiles:[0,10,11,12,13,14,15,16,17,18,19,9]});P.edit(pz,ring,{type:'road',tiles:[19,29,28,27,26,25,24,23,22,21,20,10]});
  P.edit(pz,ring,{type:'oneway',tiles:[10,11,12,13,14,15,16,17,18,19]});P.edit(pz,ring,{type:'oneway',tiles:[19,29,28,27,26,25,24,23,22,21,20,10]});
  P.runDay(pz,ring);assert.ok(ring.days[0].deliveries>5,'the one-way ring keeps moving');
}
{
  // One-way joins: driving against them is impossible, the same drag again restores two-way, and a fully one-way tile
  // holds two vehicles.
  const pz=fixture(),sim=P.create(pz);P.edit(pz,sim,{type:'road',tiles:row(pz,1,0,9)});
  assert.match(P.edit(pz,sim,{type:'oneway',tiles:[1,2]}).why,/existing road/);
  assert.equal(P.edit(pz,sim,{type:'oneway',tiles:row(pz,1,9,0)}).cost,9*P.ONEWAY_COST);
  assert.equal(P.freeRoutes(pz,sim,10).dist[19],Infinity,'west-to-east is now blocked');
  assert.ok(P.freeRoutes(pz,sim,19).dist[10]<Infinity,'east-to-west still drives');
  assert.ok(P.isOneWay(pz,sim,14));assert.equal(P.graph(pz,sim).cap[14],4);
  P.edit(pz,sim,{type:'oneway',tiles:row(pz,1,9,0)});assert.ok(P.freeRoutes(pz,sim,10).dist[19]<Infinity,'the same drag again makes it two-way');
  assert.equal(P.isOneWay(pz,sim,14),false);
}
{
  // Warehouses: a full producer sends surplus to the warehouse, which then serves requests nearer the consumer.
  const pz=fixture({dem:12,prodTicks:2}),sim=P.create(pz);P.edit(pz,sim,{type:'road',tiles:row(pz,1,0,9)});
  const r=P.edit(pz,sim,{type:'warehouse',tile:28});assert.equal(r.cost,P.WH_COST);assert.equal(sim.wh.length,1);
  assert.ok(sim.net.e[28]&1,'joined to the road beside it');
  assert.match(P.edit(pz,sim,{type:'warehouse',tile:15}).why,/empty ground/);
  assert.equal(P.edit(pz,sim,{type:'whcap',tile:28}).cost,P.WH_UP_COST);assert.equal(sim.wh[0].cap,P.WH_CAP+P.WH_UP);
  P.runDay(pz,sim);
  const stocked=sim.wh[0].stock[0];assert.ok(stocked>0,'surplus reached the warehouse');
  P.runDay(pz,sim);assert.ok(sim.days[1].fromWh>0,'the warehouse served requests');
  // Erasing it refunds full construction value even on an earlier night.
  const c=sim.credits;P.edit(pz,sim,{type:'erase',tiles:[28]});assert.equal(sim.credits,c+P.WH_COST+P.WH_UP_COST);
}
{
  // Starving is gentle: an unlinked consumer starves, the run goes on, and only the bonus is lost.
  const pz=fixture(),sim=P.replay(pz,[]);
  assert.equal(sim.phase,'done');assert.equal(sim.days.length,3);assert.equal(sim.score,0);
  assert.ok(sim.days.every(d=>!d.clean));assert.equal(P.tier(pz,P.result(pz,sim)),'failed');
  assert.ok(sim.report.problems.some(p=>p.kind==='unlinked'&&/has no road from a ● maker/.test(p.text)));
  // Deterministic replay of night edits.
  const nights=[[{type:'road',tiles:row(pz,1,0,9)}],[{type:'road',tiles:[11,21,22,23,13]}],[]];
  assert.deepEqual(P.result(pz,P.replay(pz,nights)),P.result(pz,P.replay(pz,nights)));
  // Tiers relative to par.
  const res=s=>({score:s,deliveries:1});
  assert.equal(P.tier(pz,res(50)),'perfect');assert.equal(P.tier(pz,res(43)),'good');assert.equal(P.tier(pz,res(42)),'partial');
  // Near-miss names the gap and the closest starved day.
  const half=P.replay(pz,[[{type:'road',tiles:row(pz,1,0,9)}]]);
  const nm=P.nearMiss({...pz,par:1000},half);assert.match(nm,/more points? would have/);assert.match(P.nearMiss({...pz,par:1000},sim),/Day \d lost its \+8 clean-day bonus: S1 consumer waited \d+ s for ● \(limit 30 s\)/);
}
{
  // Hints: on an empty map the hint links an unserved need, and applying it helps.
  const pz=fixture(),sim=P.create(pz),h=P.hint(pz,sim);
  assert.equal(h.kind,'link');assert.match(h.text,/S1 consumer needs ● and no road brings it\. Link it to S0 producer/);
  assert.ok(h.tiles.length>=10);
  const off=P.clone(sim);P.runDay(pz,off);
  for(const a of h.acts)assert.equal(P.edit(pz,sim,a).why,undefined);
  P.runDay(pz,sim);assert.ok(sim.days[0].deliveries>off.days[0].deliveries);
  // By day there is no hint.
  P.startDay(pz,sim);assert.equal(P.hint(pz,sim),null);
}
{
  // New stations retain roads, joins and through-routing at their planned sites.
  const W=10,st=(id,kind,x,y,extra)=>({id,kind,x,y,tile:y*W+x,type:null,needs:[],day:1,short:'S'+id,name:`S${id} ${kind}`,...extra});
  const stations=[st(0,'producer',0,1,{type:0}),st(1,'consumer',9,1,{needs:[0]}),st(2,'consumer',5,0,{needs:[0],day:2})];
  const pz=fixture({stations}),sim=P.create(pz);
  P.edit(pz,sim,{type:'road',tiles:[4,5,6]});assert.equal(P.stationAt(pz,sim,5),-1,'not there on night 1');
  const c=sim.credits;P.runDay(pz,sim);
  assert.equal(sim.net.tier[5],2,'the new station preserved its road');assert.equal(P.stationAt(pz,sim,5),2);
  assert.equal(sim.net.e[5],10,'the road still connects east and west');
  assert.equal(P.graph(pz,sim).bld[5],0,'a road through a building is traversable');
  assert.equal(sim.credits,c+P.STIPEND+P.GROWTH_CREDIT,'growth is funded independently of deliveries');
}

const reportOut=Object.entries(use).map(([k,v])=>`${k} ${v}/${SEEDS*4}`).join(', ');
console.log(`PASS route planning model: ${SEEDS} seeds × 4 difficulties replay to par, beat Skip, a station every night; costs, refunds, undo, day lock, capacity, junctions, roundabouts, queues without gridlock, one-ways, warehouses, report, tiers, hints, near-miss (${((Date.now()-started)/1000).toFixed(1)}s). Par seeds using: ${reportOut}. ${JSON.stringify(summary)}`);
