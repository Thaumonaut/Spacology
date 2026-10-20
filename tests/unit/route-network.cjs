'use strict';
const assert=require('node:assert/strict');
const P=require('../../prototypes/minigames/route-planning/route-planning-model.js');
function fixture(stations=[]){
  const W=10,H=5,bAt=new Array(W*H).fill(-1);
  stations=stations.map((s,id)=>({id,x:s.tile%W,y:Math.floor(s.tile/W),type:0,needs:[0],day:1,short:'S'+id,name:'Station '+id,...s}));
  for(const s of stations)bAt[s.tile]=s.id;
  return {W,H,bAt,stations,terrain:new Array(W*H).fill(0),days:3,dayTicks:P.DAY_TICKS,types:1,
    prodTicks:1e6,dem:1e6,growth:0,patience:30,credits0:500,par:1};
}
function edit(pz,sim,a){const r=P.edit(pz,sim,a);assert.equal(r.why,undefined,JSON.stringify(a));return r.cost;}
function capacity(pz,sim){
  const g=P.graph(pz,sim),actual=new Array(g.N*4).fill(0);
  for(const v of sim.veh)if(v.slot>=0)actual[v.slot]++;
  assert.deepEqual(sim.occ,actual,'occupancy matches the vehicles');
  for(let i=0;i<g.N;i++){
    const slots=sim.occ.slice(i*4,i*4+4);
    assert.ok(slots.every(n=>n>=0),'no negative occupancy');
    if(g.shared[i])assert.ok(slots.reduce((a,b)=>a+b,0)<=g.cap[i],`junction ${i} never overfills`);
    else assert.ok(slots.every(n=>n<=g.cap[i]),`lanes on ${i} never overfill`);
  }
}
function vehicle(pz,sim,path,id,t=0){
  const dir=P.dirTo(pz,path[0],path[1]),slot=path[1]*4+dir;
  const v={id,kind:'home',home:path.at(-1),dst:path.at(-1),type:0,path,i:1,t,wait:0,slot,req:-1};
  sim.veh.push(v);sim.occ[slot]++;return v;
}
{
  const pz=fixture(),sim=P.create(pz),before=sim.credits;
  pz.terrain[12]=1;pz.terrain[13]=2;
  assert.equal(edit(pz,sim,{type:'road',tier:'local',tiles:[11,12,13]}),7);
  P.runDay(pz,sim);
  const c=sim.credits;
  assert.equal(edit(pz,sim,{type:'road',tier:'arterial',tiles:[11,12,13]}),28);
  assert.equal(edit(pz,sim,{type:'road',tier:'collector',tiles:[11,12,13]}),-21);
  assert.equal(sim.credits,c-7,'downgrade returns terrain-adjusted difference');
  assert.equal(edit(pz,sim,{type:'road',tier:'local',tiles:[11,12,13]}),-7);
  assert.equal(edit(pz,sim,{type:'road',tier:'arterial',tiles:[11,12,13]}),28,'no free re-upgrade from historical paid value');
  assert.equal(edit(pz,sim,{type:'erase',tiles:[11,12,13]}),-35);
  assert.equal(sim.credits,before+P.STIPEND,'complete round trip has no tax or profit');
  assert.ok(P.undo(pz,sim));assert.equal(sim.net.tier[12],3);assert.equal(sim.net.paid[12],20);
  const saved=P.clone(sim);sim.credits=0;
  const r=P.edit(pz,sim,{type:'road',tier:'arterial',tiles:[10,11]});
  assert.match(r.why,/needs/);assert.deepEqual(sim.net,saved.net,'rejection is atomic');
}
{
  const pz=fixture(),sim=P.create(pz);
  assert.equal(edit(pz,sim,{type:'road',tier:'local',tiles:[11,12,11,12,13]}),3,'repeated tiles are charged only once');
  assert.equal(P.costOf(pz,sim,{type:'road',tier:'arterial',tiles:[11,12,13]}).cost,12);
  const saved=P.clone(sim);P.costOf(pz,sim,{type:'erase',tiles:[11,12,13]});assert.deepEqual(sim,saved,'previews never mutate');
}
{
  const pz=fixture([{kind:'producer',tile:20},{kind:'consumer',tile:25},{kind:'consumer',tile:29}]),sim=P.create(pz);
  edit(pz,sim,{type:'road',tiles:[20,21,22,23,24,25]});
  edit(pz,sim,{type:'road',tiles:[25,26,27,28,29]});
  assert.equal(P.freeRoutes(pz,sim,20).dist[29],Infinity,'access-only building is not a through road');
  assert.equal(edit(pz,sim,{type:'road',tiles:[24,25,26]}),2,'pay only for the through road, not the building');
  assert.ok(P.freeRoutes(pz,sim,20).dist[29]<Infinity,'can drive through a consumer');
  assert.equal(P.graph(pz,sim).cap[25],2,'through roads obey normal capacity');
  assert.ok(P.buildPath(pz,sim,20,29).includes(25),'planner can reuse a through road');
  P.runDay(pz,sim);assert.ok(P.freeRoutes(pz,sim,20).dist[29]<Infinity,'through road survives the next night');
}
{
  const pz=fixture([{kind:'consumer',tile:22,day:2}]),sim=P.create(pz);
  assert.match(P.edit(pz,sim,{type:'warehouse',tile:22}).why,/planned/,'future parcels cannot be occupied by warehouses');
  edit(pz,sim,{type:'road',tier:'arterial',tiles:[21,22,23]});
  edit(pz,sim,{type:'road',tier:'arterial',tiles:[12,22,32]});
  edit(pz,sim,{type:'oneway',tiles:[21,22,23]});edit(pz,sim,{type:'roundabout',tile:22});
  const net=P.clone(sim.net);P.runDay(pz,sim);
  assert.deepEqual(sim.net,net,'opening preserves tiers, joins, directions, roundabout and ledger');
  assert.equal(P.stationAt(pz,sim,22),0);assert.ok(P.freeRoutes(pz,sim,21).dist[23]<Infinity);
  assert.equal(sim.report.summary.grant,P.GROWTH_CREDIT);
}
{
  const pz=fixture(),sim=P.create(pz),ring=[11,12,22,21];
  edit(pz,sim,{type:'road',tier:'local',tiles:[...ring,11]});edit(pz,sim,{type:'oneway',tiles:[...ring,11]});
  P.startDay(pz,sim);
  for(let k=0;k<4;k++)for(let lane=0;lane<2;lane++){
    const path=[ring[(k+3)%4],...Array.from({length:40},(_,i)=>ring[(k+i)%4])];
    vehicle(pz,sim,path,k*2+lane+1);
  }
  capacity(pz,sim);P.step(pz,sim);
  assert.ok(sim.veh.every(v=>v.i===2),'a completely full one-way loop moves together immediately');
  for(let tick=0;tick<30;tick++){P.step(pz,sim);capacity(pz,sim);}
  assert.ok(sim.veh.every(v=>v.i>=7),'full loop keeps advancing without a timeout');
}
for(const roundabout of [false,true]){
  const pz=fixture(),sim=P.create(pz);
  edit(pz,sim,{type:'road',tier:'local',tiles:[20,21,22,23,24,25]});
  edit(pz,sim,{type:'road',tier:'local',tiles:[12,22,32]});
  if(roundabout)edit(pz,sim,{type:'roundabout',tile:22});
  P.startDay(pz,sim);
  const front=vehicle(pz,sim,[21,22,23,24,25],1);
  vehicle(pz,sim,[22,23,24,25],2,140);
  const back=vehicle(pz,sim,[20,21,22,23,24,25],3);
  for(let tick=0;tick<80;tick++){P.step(pz,sim);capacity(pz,sim);}
  assert.equal(front.i,1,'a full downstream lane is never entered, even after 32 ticks');
  assert.equal(back.i,1,'no overfilling of a junction or roundabout lane');
  assert.equal(front.wait,80);assert.equal(back.wait,80);
}
{
  const pz=fixture(),sim=P.create(pz);
  edit(pz,sim,{type:'road',tier:'local',tiles:[20,21,22,23,24]});
  edit(pz,sim,{type:'road',tier:'local',tiles:[2,12,22,32,42]});P.startDay(pz,sim);
  const first=vehicle(pz,sim,[20,21,22,23,24],1);
  const waiting=vehicle(pz,sim,[2,12,22,32,42],2);
  P.step(pz,sim);assert.equal(first.i,2);assert.equal(waiting.i,1);
  for(let tick=0;tick<8;tick++){P.step(pz,sim);capacity(pz,sim);}
  assert.equal(waiting.i,2,'queued approach gets its turn as the junction clears');
}
{
  const pz=fixture(),sim=P.create(pz);
  edit(pz,sim,{type:'road',tier:'local',tiles:[21,22,23]});edit(pz,sim,{type:'road',tier:'local',tiles:[12,22,32]});
  for(const [tier,cap] of [['local',1],['collector',2],['arterial',3]]){
    if(tier!=='local')edit(pz,sim,{type:'road',tier,tiles:[21,22,23]});
    assert.equal(P.graph(pz,sim).cap[22],cap,'upgrading improves shared junction capacity');
  }
}
console.log('PASS network fairness: reversible terrain costs, atomic edits, through buildings, protected growth, capacity-safe full loops, long queues and fair junctions');
