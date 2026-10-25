'use strict';
// Building planner: for every type, plot context, house typology and many seeds, the rules every real plan keeps hold.
// Rooms are rectangles (circulation may bend), every room is reachable from where you arrive on the floor through
// sensible doors, leaf rooms are never walked through, rooms that need light get a window, mixed-use buildings give
// the home its own street door, the stair opens onto circulation on every floor, and the same seed gives the same
// building. Also checks that every typology actually turns up, so the layouts vary. Prints one plan per typology.
const assert=require('node:assert/strict');
const P=require('../../prototypes/labs/building-lab/plan.js');
const SEEDS=12;let floors=0,rooms=0,buildings=0;const seen={};
function check(plan,tag){
  const {w,d}=plan.plot;buildings++;seen[plan.typology]=(seen[plan.typology]||0)+1;
  assert.equal(plan.floors.length,plan.plot.masks.length);
  plan.floors.forEach((F,f)=>{floors++;const mask=plan.plot.masks[f],show=()=>`\n[${plan.typology}]\n`+P.ascii(plan,f);
    for(let i=0;i<w*d;i++)assert.equal(F.grid[i]>=0,mask[i]===1,`${tag} floor ${f}: cell ${i} coverage`+show());
    assert.equal(F.rooms[0].type,'stair');
    F.rooms.forEach((r,k)=>{if(k<2||!r.cells||P.ROOMS[r.type].circ)return;const [x0,z0,x1,z1]=r.box;assert.equal(r.cells,(x1-x0+1)*(z1-z0+1),`${tag} floor ${f}: ${r.label} is a rectangle`+show());});
    const adj=new Map();for(const dr of F.doors){for(const [a,b] of [[dr.a,dr.b],[dr.b,dr.a]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}
      if(dr.kind==='open'){assert.equal(F.rooms[dr.b].type,'stair');assert.ok(P.ROOMS[F.rooms[dr.a].type].circ,`${tag}: the stair opens onto circulation (${F.rooms[dr.a].type})`+show());}
      else assert.ok(P.canLink(F.rooms[dr.a].type,F.rooms[dr.b].type),`${tag}: no door between ${F.rooms[dr.a].type} and ${F.rooms[dr.b].type}`);
      assert.ok(dr.cells.length>=2,'doors are at least 1 m wide');}
    // Where you arrive: the front door's room on the ground floor, the stair head upstairs.
    const opens=F.doors.filter(dr=>dr.kind==='open');
    assert.ok(opens.length>=1,`${tag} floor ${f}: the stair opens onto this floor`+show());
    const start=f===0?(F.openings.filter(o=>o.kind==='front').map(o=>o.room).find(k=>P.ROOMS[F.rooms[k].type].circ)??1):opens.at(-1).a;
    const reach=new Set([start]),q=[start];
    while(q.length){const k=q.shift();if(k!==start&&P.ROOMS[F.rooms[k].type].leaf)continue;for(const n of adj.get(k)||[])if(!reach.has(n)){reach.add(n);q.push(n);}}
    F.rooms.forEach((r,k)=>{if(!r.cells)return;rooms++;assert.ok(reach.has(k),`${tag} floor ${f}: ${r.label} is unreachable`+show());
      if(P.ROOMS[r.type].light)assert.ok(F.openings.some(o=>o.room===k&&o.kind!=='front'&&o.kind!=='back'),`${tag} floor ${f}: ${r.label} has no window`+show());});
    for(const o of F.openings)for(const [x] of o.cells){if(o.side==='xm'&&x===0)assert.ok(!plan.plot.party[0],'no openings in the left party wall');if(o.side==='xp'&&x===w-1)assert.ok(!plan.plot.party[1],'no openings in the right party wall');}
    if(f===0){const fronts=F.openings.filter(o=>o.kind==='front');assert.ok(fronts.length>=1,`${tag}: a front door`);
      const biz=F.rooms.findIndex(r=>['shop','workshop'].includes(r.type));
      if(biz>0){assert.ok(fronts.some(o=>o.room===biz&&o.side==='zm'),`${tag}: the business has a street door`+show());assert.ok(fronts.some(o=>o.room!==biz&&P.ROOMS[F.rooms[o.room].type].circ),`${tag}: the home has its own door`+show());}}
    for(const i of [...F.steps,...F.voids])assert.equal(F.rooms[F.grid[i]].type,'stair');
    assert.deepEqual(F.notes,[],`${tag} floor ${f}: no hard failures`);});
}
for(const type of Object.keys(P.TYPES))for(const context of Object.keys(P.CONTEXTS))for(let seed=1;seed<=SEEDS;seed++)check(P.generate(seed,{type,context}),`${type}/${context} seed ${seed}`);
// Every typology on every type that lists it, forced, across plots.
for(const [type,T] of Object.entries(P.TYPES))for(const typology of Object.keys(T.typologies))for(const context of Object.keys(P.CONTEXTS))for(let seed=1;seed<=4;seed++){
  const Y=P.TYPOLOGIES[typology];let plan=null;
  for(let s=seed;s<seed+40&&!plan;s++){const p=P.makePlot(s,{type,context});if(p.w>=Y.minW&&!(Y.straight&&p.storeys>2))plan=P.generate(s,{type,context,typology});}
  if(plan)check(plan,`${type}/${typology}/${context}`);}
// Variety: chosen freely, the plans spread across typologies and stair kinds.
const free={},kinds=new Set();for(let s=1;s<=120;s++){const p=P.generate(s);free[p.typology]=(free[p.typology]||0)+1;kinds.add(p.stair.kind);}
for(const t of Object.keys(P.TYPOLOGIES))assert.ok(free[t]>=1,`typology ${t} turns up when chosen freely (${JSON.stringify(free)})`);
assert.ok(Math.max(...Object.values(free))<=120*.35,`no typology dominates (${JSON.stringify(free)})`);
assert.deepEqual([...kinds].sort(),['dogleg','straight']);
assert.deepEqual(P.generate(12345),P.generate(12345),'same seed, same building');
// Facade variety: each style keeps its identity but its buildings differ in wall colour, windows, frame and roof.
for(const style of Object.keys(P.STYLES)){const seen={wall:new Set(),window:new Set(),frame:new Set(),roof:new Set()};
  for(let s=1;s<=30;s++){const p=P.generate(s,{style});seen.wall.add(p.facade.wall);seen.window.add(p.facade.window);seen.frame.add(p.facade.frame);seen.roof.add(p.roof.mat+p.roof.form+p.roof.ridge);
    assert.ok(!(p.facade.wall==='plaster_white'&&p.facade.trim==='paint_white'),'trim contrasts with the wall');assert.equal(p.facade.lattice,P.STYLES[style].lattice,'lattice stays with the style');}
  assert.ok(seen.wall.size>=3,`${style}: at least 3 wall colours`);assert.ok(seen.window.size>=2,`${style}: at least 2 window kinds`);
  assert.ok(seen.frame.size>=Math.min(2,Object.keys(P.STYLES[style].frames).length),`${style}: frame patterns vary`);assert.ok(seen.roof.size>=3,`${style}: roofs vary`);}
for(const [typology,type] of [['side','shophouse'],['cross','home'],['courtyard','inn']]){const p=P.generate(3,{type,typology,context:'corner'});console.log(`${type} / ${P.TYPOLOGIES[typology].label}, ground floor:`);console.log(P.ascii(p,0));}
console.log(`PASS building plan: ${buildings} buildings, ${floors} floors, ${rooms} rooms; typologies ${JSON.stringify(free)} over 120 free seeds`);
