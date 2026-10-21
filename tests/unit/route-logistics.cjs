'use strict';
const assert=require('node:assert/strict'),P=require('../../prototypes/minigames/route-planning/route-planning-model.js');
function fixture(stations=[],W=18,H=12){
  const p={id:'route-planning',logistics:true,seed:1,difficulty:'normal',W,H,terrain:Array(W*H).fill(0),bAt:Array(W*H).fill(-1),stations,days:3,dayTicks:300,types:5,prodTicks:8,dem:7,growth:0,patience:26,credits0:10000};
  for(const s of stations)for(const i of [s.tile,...s.footprint||[]])p.bAt[i]=s.id;
  return p;
}
function station(id,kind,tile,extra={}){return {id,kind,tile,day:1,type:kind==='producer'?0:null,needs:kind==='consumer'?[4]:[],large:false,short:'Test',name:'Test '+id,initialStock:0,...extra};}
const row=(p,y,x1,x2)=>Array.from({length:x2-x1+1},(_,k)=>y*p.W+x1+k);
const col=(p,x,y1,y2)=>Array.from({length:y2-y1+1},(_,k)=>(y1+k)*p.W+x);
function edit(p,s,a){const result=P.edit(p,s,a);assert.equal(result.why,undefined,JSON.stringify(a)+' '+result.why);return result;}
function reject(p,s,a,why){const before=JSON.stringify(s);assert.match(P.edit(p,s,a).why,why);assert.equal(JSON.stringify(s),before,'rejected edits are atomic');}
function capacity(p,s){const g=P.graph(p,s);for(let i=0;i<g.N;i++){
  if(g.shared[i])assert.ok(s.occ.slice(i*4,i*4+4).reduce((a,b)=>a+b,0)<=g.cap[i],`shared capacity ${i}`);
  else for(let d=0;d<4;d++)assert.ok(s.occ[i*4+d]<=g.laneCap[i*4+d],`lane capacity ${i}/${d}`);
}}
function cargo(p,s,type){return p.stations.reduce((n,b)=>n+(b.kind==='producer'&&b.type===type?s.st[b.id].stock:0)+(s.st[b.id].input[type]||0),0)+s.wh.reduce((n,w)=>n+w.stock[type],0)+s.veh.filter(v=>v.kind!=='home'&&v.type===type).length;}
{
  const p=fixture();p.credits0=1;const s=P.create(p),stamp={type:'interchange',tile:5*p.W+8,side:2},layout=P.interchangeLayout(p,s,stamp);
  reject(p,s,stamp,/credits/);edit(p,s,{type:'budget',unlimited:true});edit(p,s,stamp);
  assert.ok(s.credits<0);assert.ok(Number.isFinite(s.credits),'unlimited accounting remains finite for JSON export');
  reject(p,s,{type:'budget',unlimited:false},/Refund roads/);
  reject(p,s,{type:'road',tier:'highway',tiles:[layout.street[0]]},/ramp|freeway/);
  const saved=JSON.parse(JSON.stringify(s.log)),replayed=P.replay(p,saved);assert.deepEqual(replayed.errors,[]);assert.equal(replayed.unlimited,true);
  edit(p,s,{type:'erase',tiles:layout.tiles});assert.equal(s.credits,p.credits0,'full refunds retain the standard-budget ledger');
  edit(p,s,{type:'budget',unlimited:false});assert.equal(s.unlimited,false);assert.ok(P.undo(p,s));assert.equal(s.unlimited,true);
  for(let i=0;i<3;i++)assert.ok(P.undo(p,s));assert.equal(s.unlimited,false);assert.equal(s.credits,p.credits0);assert.ok(s.net.tier.every(t=>t===0),'undo restores the entire sandbox trial');
  const unlimited=P.create(p,{unlimited:true});P.startDay(p,unlimited);reject(p,unlimited,{type:'budget',unlimited:false},/night/);P.skipToDusk(p,unlimited);assert.equal(unlimited.unlimited,true,'budget mode survives dusk');
}
{
  for(const diff of P.DIFFICULTIES)for(let seed=1;seed<=12;seed++){
    const p=P.generate(seed,diff.id,{noPlan:true});assert.deepEqual(p,P.generate(seed,diff.id,{noPlan:true}));assert.ok(p.W>=28&&p.H>=20);
    assert.equal(p.stations.filter(s=>s.day===1).length,6);const footprint=new Set();
    for(const s of p.stations){assert.ok(s.footprint.length>=4);assert.equal(p.bAt[s.tile],s.id);assert.ok(!s.footprint.includes(s.tile));
      for(const i of [s.tile,...s.footprint]){assert.equal(p.bAt[i],s.id);assert.ok(!footprint.has(i));footprint.add(i);}
      if(s.recipe)assert.equal(s.kind,'producer');if(s.kind==='consumer')assert.ok(P.schedule(p,s.day,s.id).some(e=>e.label==='Dispatch peak'));
    }
    const ore=p.stations.find(s=>s.type===0),refinery=p.stations.find(s=>s.type===2),workshop=p.stations.find(s=>s.type===4);
    assert.equal(ore.district,refinery.district);assert.notEqual(ore.district,workshop.district);
    const sim=P.create(p);reject(p,sim,{type:'road',tier:'local',tiles:[p.stations[0].footprint[0]]},/footprint/);
  }
  assert.deepEqual(P.RECIPES[2].input,{0:2});assert.deepEqual(P.RECIPES[3].input,{1:2});assert.deepEqual(P.RECIPES[4].input,{2:1,3:1});
}
{
  const p=P.generate(39,'normal'),s=P.replay(p,p.plan);assert.deepEqual(s.errors,[]);assert.equal(s.score,p.par);assert.ok(s.score>=p.days,'baseline network meets dispatch deadlines, not only late deliveries');
}
{
  const p=fixture(),s=P.create(p);p.terrain[0]=3;p.terrain[1]=2;p.terrain[2]=1;
  reject(p,s,{type:'road',tier:'highway',tiles:[0]},/Mountains/);edit(p,s,{type:'road',tier:'dirt',tiles:[0]});
  reject(p,s,{type:'road',tier:'local',tiles:[0]},/Mountains/);reject(p,s,{type:'road',tier:'highway',tiles:[1]},/open ground|bridges/);
  edit(p,s,{type:'road',tier:'road',tiles:[1]});edit(p,s,{type:'road',tier:'local',tiles:[2]});assert.equal(s.net.paid[2],P.ROADS[4].cost*4);
  const remaining=s.credits;edit(p,s,{type:'erase',tiles:[0,1,2]});assert.equal(s.credits,p.credits0);assert.ok(s.credits>remaining);
}
{
  const p=fixture(),s=P.create(p),path=row(p,3,2,12),bridge=3*p.W+7;p.terrain[bridge]=1;
  assert.equal(edit(p,s,{type:'road',tier:'highway',tiles:path}).cost,(path.length+3)*5);
  assert.equal(s.net.paid[bridge],20);assert.ok(P.freeRoutes(p,s,path[0]).dist[path.at(-1)]<Infinity,'freeways cross river bridges');
  edit(p,s,{type:'erase',tiles:path});assert.equal(s.credits,p.credits0,'the whole bridge is refundable');
}
{
  const p=fixture(),s=P.create(p),collector=row(p,4,2,12),t=4*p.W+7;
  edit(p,s,{type:'road',tier:'road',tiles:collector});
  const before=P.clone(s),a={type:'road',tier:'local',tiles:col(p,7,2,6),preserve:true};
  assert.equal(P.costOf(p,s,a).cost,8);assert.deepEqual(s,before,'connection preview preserves ledger and topology');
  edit(p,s,a);assert.equal(s.net.tier[t],2);assert.equal(s.net.paid[t],before.net.paid[t]);assert.equal(s.net.built[t],before.net.built[t]);
  assert.equal(s.net.e[t],15,'local crossing joins the collector without resurfacing it');
  assert.ok(s.net.e[t-1]&2);assert.ok(s.net.e[t+1]&8);assert.equal(s.net.e[t-1]&1,0,'no unintended parallel connection');
  assert.ok(P.undo(p,s));assert.deepEqual(s.net,before.net);assert.equal(s.credits,before.credits);
  p.terrain[t]=1;edit(p,s,{type:'erase',tiles:[t]});edit(p,s,{type:'road',tier:'highway',tiles:[t]});
  reject(p,s,{type:'road',tier:'local',tiles:[t-p.W,t],preserve:true},/ramps/);
  assert.equal(s.net.tier[t],3,'connecting cannot turn a freeway into a local street');
  edit(p,s,{type:'erase',tiles:[t]});edit(p,s,{type:'road',tier:'road',tiles:[t]});
  assert.equal(edit(p,s,{type:'road',tier:'dirt',tiles:[t]}).cost,-4,'explicit resurfacing still refunds the terrain-adjusted difference');
}
{
  const p=fixture([station(0,'producer',19),station(1,'consumer',25,{large:true})]),s=P.create(p);
  reject(p,s,{type:'road',tier:'dirt',tiles:[18,19]},/local entrance/);
  reject(p,s,{type:'road',tier:'road',tiles:[18,19]},/local entrance/);
  edit(p,s,{type:'road',tier:'local',tiles:[18,19]});edit(p,s,{type:'road',tier:'road',tiles:[24,25]});
  reject(p,s,{type:'road',tier:'highway',tiles:[24,25]},/ramps|entrance/);
  assert.ok(P.graph(p,s).out[19].includes(18));assert.ok(P.graph(p,s).out[25].includes(24));
}
{
  const p=fixture(),s=P.create(p),a=row(p,3,2,9),b=row(p,4,2,9);edit(p,s,{type:'road',tier:'local',tiles:a});edit(p,s,{type:'road',tier:'road',tiles:b});
  for(const t of a)assert.equal(s.net.e[t]&4,0,'parallel roads do not connect');
  reject(p,s,{type:'road',tier:'local',tiles:[a[3]]},/already there/);
  edit(p,s,{type:'connection',tile:a[3],dir:2});assert.ok(s.net.e[b[3]]&1);
  const edges=[...s.net.e];edit(p,s,{type:'road',tier:'road',tiles:a});assert.deepEqual(s.net.e,edges,'upgrades preserve exact edges');
  edit(p,s,{type:'connection',tile:a[3],dir:2});assert.equal(s.net.e[a[3]]&4,0);P.undo(p,s);assert.deepEqual(s.net.e,edges);
}
{
  const p=fixture(),s=P.create(p),freeway=row(p,3,1,16),t=3*p.W+8;
  edit(p,s,{type:'road',tier:'highway',tiles:freeway});
  reject(p,s,{type:'road',tier:'road',tiles:[t+p.W,t]},/ramps/);
  edit(p,s,{type:'road',tier:'highway',tiles:[t+p.W]});reject(p,s,{type:'connection',tile:t,dir:2},/branches/);edit(p,s,{type:'erase',tiles:[t+p.W]});
  const before=P.clone(s),a={type:'interchange',tile:t,side:2},quote=P.costOf(p,s,a);assert.equal(quote.why,undefined);assert.deepEqual(s,before,'preview is pure');
  edit(p,s,a);assert.equal(s.credits,before.credits-quote.cost);assert.equal(s.net.tier.filter(v=>v===5).length,2);
  const street=5*p.W+7,main=3*p.W+7,offMain=3*p.W+9,offStreet=5*p.W+9;
  assert.ok(P.freeRoutes(p,s,street).dist[main]<Infinity);assert.ok(P.freeRoutes(p,s,offMain).dist[offStreet]<Infinity);
  assert.ok(!P.graph(p,s).out[offStreet].includes(offStreet-p.W),'off ramp cannot be entered backwards');
  assert.ok(P.pathTo(P.freeRoutes(p,s,offStreet),offMain).length>4,'reaching that mainline requires a detour via the on-ramp');
  const on=[street,street-p.W,main],off=[offMain,offMain+p.W,offStreet];
  const branch=off[1]+1;
  for(const tiles of [[branch,off[1]],[off[1],branch]])reject(p,s,{type:'road',tier:'local',tiles,preserve:true},/ramp tool/);
  edit(p,s,{type:'road',tier:'local',tiles:[branch]});reject(p,s,{type:'connection',tile:branch,dir:3},/ramp tool/);
  assert.ok(P.undo(p,s));
  for(const ramp of [on,off])for(const path of [ramp,[...ramp].reverse(),ramp.slice(0,2),ramp.slice(-2)]){
    reject(p,s,{type:'oneway',tiles:path},/Ramp direction is fixed/);
    for(let k=1;k<ramp.length;k++){assert.ok(P.graph(p,s).out[ramp[k-1]].includes(ramp[k]));assert.ok(!P.graph(p,s).out[ramp[k]].includes(ramp[k-1]),'rejected edits preserve all reverse restrictions');}
  }
  reject(p,s,{type:'road',tier:'highway',tiles:freeway},/already there/);
  assert.ok(P.undo(p,s));assert.deepEqual(s.net,before.net);assert.equal(s.credits,before.credits);
  const edge=3*p.W+1;reject(p,s,{type:'interchange',tile:edge,side:2},/fit|ramp|freeway/);
}
for(let side=0;side<4;side++){
  const p=fixture(),s=P.create(p),a={type:'interchange',tile:5*p.W+8,side},layout=P.interchangeLayout(p,s,a),before=P.clone(s);
  assert.equal(layout.tiles.length,12,'compact stamp uses five freeway, five street and two ramp tiles');
  assert.equal(P.costOf(p,s,a).cost,41);assert.deepEqual(s,before);
  edit(p,s,a);assert.equal(s.net.tier.filter(t=>t===5).length,2);
  for(const path of [layout.on,layout.off])for(let k=1;k<path.length;k++){
    assert.ok(P.graph(p,s).out[path[k-1]].includes(path[k]));assert.ok(!P.graph(p,s).out[path[k]].includes(path[k-1]));
  }
  assert.ok(P.freeRoutes(p,s,layout.street[0]).dist[layout.freeway.at(-1)]<Infinity);
  assert.ok(P.freeRoutes(p,s,layout.freeway[0]).dist[layout.street.at(-1)]<Infinity);
  edit(p,s,{type:'erase',tiles:layout.tiles});assert.equal(s.credits,p.credits0,'stamp can be fully refunded');
  assert.ok(P.undo(p,s));assert.ok(P.undo(p,s));assert.deepEqual(s.net,before.net);
  p.terrain[layout.off[1]]=3;reject(p,s,a,/non-mountain/);assert.deepEqual(s.net,before.net,'a blocked off-ramp rolls back the freeway, street and on-ramp');
  p.terrain[layout.off[1]]=2;p.terrain[layout.on[1]]=1;p.terrain[layout.freeway[0]]=1;
  assert.equal(P.costOf(p,s,a).cost,68,'ramps and freeway pay their terrain bridge multipliers');edit(p,s,a);
  assert.ok(P.undo(p,s));s.credits=40;reject(p,s,a,/credits/);
}
{
  const p=fixture(),s=P.create(p),a={type:'interchange',tile:5*p.W+8,side:2},layout=P.interchangeLayout(p,s,a);
  edit(p,s,{type:'road',tier:'local',tiles:layout.street});const paid=layout.street.map(i=>s.net.paid[i]);
  assert.equal(P.costOf(p,s,a).cost,31);edit(p,s,a);
  assert.ok(layout.street.every(i=>s.net.tier[i]===4));assert.deepEqual(layout.street.map(i=>s.net.paid[i]),paid,'interchange preserves existing access streets');
}
{
  const p=fixture(),s=P.create(p),f=3*p.W+8,street=f+2*p.W;
  edit(p,s,{type:'road',tier:'highway',tiles:[f,f+1]});edit(p,s,{type:'road',tier:'local',tiles:[street,street+1]});
  reject(p,s,{type:'ramp',tiles:[street,f]},/neighbour|adjacent|continuous/);
  edit(p,s,{type:'ramp',tiles:[street,street-p.W,f]});
  assert.ok(P.freeRoutes(p,s,street).dist[f+1]<Infinity,'one approach tile and a freeway endpoint are enough');
}
{
  const tile=6*18+6,p=fixture([station(0,'producer',tile,{large:true})]),s=P.create(p);
  edit(p,s,{type:'road',tier:'local',tiles:row(p,6,5,7)});edit(p,s,{type:'road',tier:'highway',tiles:row(p,3,1,16)});
  reject(p,s,{type:'ramp',tiles:[tile,tile-p.W,tile-2*p.W,tile-3*p.W]},/building/);
}
{
  const p=fixture(),s=P.create(p),t=5*p.W+8;
  edit(p,s,{type:'road',tier:'highway',tiles:row(p,5,2,14)});const value=s.credits;
  edit(p,s,{type:'overpass',tile:t});assert.equal(s.net.over[t].axis,1);
  assert.ok(P.freeRoutes(p,s,t-6).dist[t+6]<Infinity);assert.ok(P.freeRoutes(p,s,t-2*p.W).dist[t+2*p.W]<Infinity);
  assert.equal(P.freeRoutes(p,s,t-2*p.W).dist[t+6],Infinity,'cannot turn between crossing levels');
  const g=P.graph(p,s);assert.equal(g.shared[t],0);assert.equal(g.laneCap[t*4],P.ROADS[2].cap);assert.equal(g.laneCap[t*4+1],P.ROADS[3].cap);
  edit(p,s,{type:'overpass',tile:t});assert.equal(s.net.e[t]&5,0,'removing freeway bridge disconnects the lower crossing');assert.ok(s.credits<value,'lower approach roads retain their value');
  edit(p,s,{type:'erase',tiles:s.net.tier.flatMap((v,i)=>v?[i]:[])});assert.equal(s.credits,p.credits0,'all approaches and structures refund fully');
}
{
  const p=fixture(),s=P.create(p),t=5*p.W+8;
  edit(p,s,{type:'road',tier:'road',tiles:row(p,5,2,14)});edit(p,s,{type:'road',tier:'road',tiles:col(p,8,2,9)});
  const v={path:[t+p.W,t,t-p.W],i:0,wait:0};assert.equal(P.admission(p,s,v,t+p.W,t).allowed,false);v.wait=2;assert.equal(P.admission(p,s,v,t+p.W,t).allowed,true);
  const base=s.credits;edit(p,s,{type:'control',tile:t,control:'signal'});assert.equal(base-s.credits,P.SIGNAL_COST);
  s.tick=0;assert.equal(P.admission(p,s,v,t+p.W,t).allowed,true);s.tick=10;assert.equal(P.admission(p,s,v,t+p.W,t).allowed,false);
  s.tick=12;assert.equal(P.admission(p,s,v,t+p.W,t).allowed,false);const east={path:[t-1,t,t+1],i:0,wait:0};assert.equal(P.admission(p,s,east,t-1,t).allowed,true);
  edit(p,s,{type:'control',tile:t,control:'roundabout'});assert.equal(base-s.credits,P.ROUND_COST);assert.equal(s.net.reserved.filter(i=>i===t).length,4);
  reject(p,s,{type:'road',tier:'local',tiles:[t-p.W-1]},/roundabout/);s.occ[t*4+3]=1;assert.equal(P.admission(p,s,v,t+p.W,t).allowed,false,'yield to circulating traffic');
  edit(p,s,{type:'control',tile:t,control:'stop'});assert.equal(s.credits,base);assert.equal(s.net.reserved.filter(i=>i>=0).length,0);
  edit(p,s,{type:'control',tile:t,control:'signal'});edit(p,s,{type:'connection',tile:t,dir:0});edit(p,s,{type:'connection',tile:t,dir:1});edit(p,s,{type:'control',tile:t,control:'stop'});assert.equal(s.credits,base,'installed control remains refundable after removing junction arms');
  assert.equal(P.movementMask(0,0)&P.movementMask(2,2),0,'opposing straight flows do not conflict');assert.ok(P.movementMask(0,3)&P.movementMask(2,2),'left turn conflicts with oncoming traffic');
}
{
  function travel(tier,path){const p=fixture(),s=P.create(p);edit(p,s,{type:'road',tier,tiles:path});return P.freeRoutes(p,s,path[0]).dist[path.at(-1)];}
  const p=fixture(),short=row(p,2,1,3),long=row(p,2,0,17),winding=[19,20,38,39,57,58,76,77];
  assert.ok(travel('road',short)<travel('highway',short),'collectors beat short cold-start freeway trips');
  assert.ok(travel('highway',long)<travel('road',long),'freeways win uninterrupted distance');
  assert.ok(travel('local',winding)<travel('highway',winding),'locals beat twisting freeway routes');
  const s=P.create(p);edit(p,s,{type:'road',tier:'highway',tiles:long});assert.ok(P.travelStep(p,s,long[8],long[9],1,4,true).ticks>P.travelStep(p,s,long[8],long[9],1,4,false).ticks,'queues erase momentum');
}
{
  const recipe=P.RECIPES[2],p=fixture([station(0,'producer',19,{type:2,recipe,needs:[0],large:true})]),s=P.create(p);
  P.startDay(p,s);for(let i=0;i<20;i++)P.step(p,s);assert.equal(s.st[0].stock,0,'no magic factory output');
  s.st[0].input[0]=2;for(let i=0;i<recipe.ticks;i++)P.step(p,s);assert.equal(s.st[0].stock,1);assert.equal(s.st[0].input[0],0);assert.equal(s.score,0,'intermediate production does not score');
  const before=s.st[0].stock;P.skipToDusk(p,s);assert.equal(s.st[0].stock,before,'factory output persists overnight');
}
{
  const p=fixture([station(0,'producer',36,{type:0,initialStock:4}),station(1,'producer',43,{type:2,recipe:P.RECIPES[2],needs:[0],large:true})]),s=P.create(p);
  edit(p,s,{type:'road',tier:'local',tiles:row(p,2,0,7)});P.startDay(p,s);for(let i=0;i<80;i++){P.step(p,s);capacity(p,s);}
  assert.ok(s.st[1].stock>0,'delivered ore becomes actual plate output');assert.equal(s.score,0);assert.ok(s.st[1].reqs.length>0,'factory keeps replenishing its input buffer');
}
{
  const p=fixture([station(0,'producer',36,{type:4,initialStock:8}),station(1,'consumer',45),station(2,'consumer',47)]),s=P.create(p);p.prodTicks=1e6;
  edit(p,s,{type:'road',tier:'local',tiles:row(p,2,0,11)});const tile=3*p.W+8;edit(p,s,{type:'warehouse',tile});
  edit(p,s,{type:'prepare',tile,target:1,item:4,qty:4});assert.equal(s.wh[0].plan.target,1);
  reject(p,s,{type:'prepare',tile,target:1,item:0,qty:3},/required goods/);reject(p,s,{type:'prepare',tile,target:1,item:4,qty:99},/fit/);
  P.startDay(p,s);const total=cargo(p,s,4);let stocked=false;
  for(let tick=0;tick<80;tick++){P.step(p,s);capacity(p,s);const w=s.wh[0];assert.ok(w.stock.reduce((a,b)=>a+b,0)+w.inc.reduce((a,b)=>a+b,0)<=w.cap);assert.equal(cargo(p,s,4)+s.deliveries,total,'goods conserved in storage, transit and dispatch');if(w.stock[4]>0)stocked=true;}
  assert.ok(stocked,'warehouse requests stock without waiting for producer overflow');
  s.st[0].stock=0;s.wh[0].stock[4]=4;s.st[2].reqs.push({type:4,age:0,v:0,peak:true});s.st[1].reqs=[];
  P.step(p,s);assert.equal(s.st[2].reqs.at(-1).v,0,'other destinations cannot steal the reserve');
  s.st[1].reqs.push({type:4,age:0,v:0,peak:true});P.step(p,s);assert.ok(s.st[1].reqs[0].v,'assigned peak can use reserved goods');
  P.skipToDusk(p,s);assert.ok(s.wh[0].stock[4]>0,'unused inventory persists');assert.ok(s.wh[0].inc.every(n=>n===0),'in-flight reservations unwind at dusk');
}
{
  function peak(staging){
    const W=34,p=fixture([station(0,'producer',W*2,{type:4,initialStock:10}),station(1,'consumer',W*2+30)],W,7),s=P.create(p);p.dayTicks=160;p.prodTicks=1e6;
    edit(p,s,{type:'road',tier:'local',tiles:row(p,2,0,30)});
    if(staging){const tile=W*3+28;edit(p,s,{type:'warehouse',tile});edit(p,s,{type:'prepare',tile,target:1,item:4,qty:4});}
    P.runDay(p,s);return s;
  }
  const direct=peak(false),staged=peak(true);assert.ok(staged.score>direct.score,`prepared near-dispatch stock ${staged.score} beats direct long haul ${direct.score} during the same peak`);assert.ok(staged.days[0].fromWh>0);
  for(const s of [direct,staged])assert.ok(s.st[0].stock<=P.OUTPUT_CAP,'recalls cannot overflow source storage');
  const p=fixture([station(0,'consumer',19)]);assert.ok(P.schedule(p,1,0,true)[1].deadline>P.schedule(p,1,0)[1].deadline,'Relaxed visibly extends peak deadlines');
}
{
  function traffic(control){const p=fixture(),s=P.create(p),t=5*p.W+8,paths=[col(p,8,1,9),col(p,8,1,9).reverse(),row(p,5,3,13),row(p,5,3,13).reverse()];
    edit(p,s,{type:'road',tier:'road',tiles:paths[0]});edit(p,s,{type:'road',tier:'road',tiles:paths[2]});if(control!=='stop')edit(p,s,{type:'control',tile:t,control});P.startDay(p,s);
    s.veh=Array.from({length:80},(_,i)=>({id:i+1,kind:'home',home:paths[i%4][0],dst:paths[i%4].at(-1),path:paths[i%4],i:0,t:0,wait:0,slot:-1,heading:-1,run:0,type:0,req:-1}));
    let finished=0;for(let i=0;i<150;i++){P.step(p,s);capacity(p,s);finished=80-s.veh.length;}return finished;
  }
  const stop=traffic('stop'),signal=traffic('signal'),round=traffic('roundabout');assert.ok(signal>stop,`signals ${signal} outperform stops ${stop} under heavy flow`);assert.ok(round>stop,`roundabouts ${round} help moderate flow`);assert.ok(signal>round,`saturated signals ${signal} outperform yielding roundabout ${round}`);
}
console.log('PASS logistics: dense seeded plots/districts, Supply Run recipes, terrain/access, explicit connections, ramps/templates, non-turning overpasses, reversible controls, shape-aware routes, manufacturing, reserved peak inventory/conservation and capacity-safe contrasting junctions');
