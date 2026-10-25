'use strict';
// Building planner: for every type, plot context and many seeds, each floor is a spine of stair and hall with
// rectangular rooms off it. Every room is reachable from the hall through sensible doors, leaf rooms are never walked
// through, rooms that need light get a window, mixed-use buildings give the home its own street door, the stair stacks
// through every floor, and the same seed gives the same building. Prints one plan so the PASS line can be eyeballed.
const assert=require('node:assert/strict');
const P=require('../../prototypes/labs/building-lab/plan.js');
const SEEDS=15;let floors=0,rooms=0,buildings=0;
for(const type of Object.keys(P.TYPES))for(const context of Object.keys(P.CONTEXTS))for(let seed=1;seed<=SEEDS;seed++){
  const plan=P.generate(seed,{type,context}),{w,d}=plan.plot,tag=`${type}/${context} seed ${seed}`;buildings++;
  assert.equal(plan.floors.length,P.TYPES[type].storeys);
  plan.floors.forEach((F,f)=>{floors++;const mask=plan.plot.masks[f],show=()=>'\n'+P.ascii(plan,f);
    for(let i=0;i<w*d;i++)assert.equal(F.grid[i]>=0,mask[i]===1,`${tag} floor ${f}: cell ${i} coverage`);
    assert.equal(F.rooms[0].type,'stair');assert.equal(F.rooms[1].type,'hall');
    // Rooms are rectangles (the hall and stair may be any shape).
    F.rooms.forEach((r,k)=>{if(k<2)return;const [x0,z0,x1,z1]=r.box;assert.equal(r.cells,(x1-x0+1)*(z1-z0+1),`${tag} floor ${f}: ${r.label} is a rectangle`+show());});
    // Doors: legal pairs, at least 1 m, stair openings only between hall and stair.
    const adj=new Map();for(const dr of F.doors){for(const [a,b] of [[dr.a,dr.b],[dr.b,dr.a]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}
      if(dr.kind==='open')assert.deepEqual([F.rooms[dr.a].type,F.rooms[dr.b].type].sort(),['hall','stair']);
      else assert.ok(P.canLink(F.rooms[dr.a].type,F.rooms[dr.b].type),`${tag}: no door between ${F.rooms[dr.a].type} and ${F.rooms[dr.b].type}`);
      assert.ok(dr.cells.length>=2,'doors are at least 1 m wide');}
    // From the hall, every room is reachable without walking through a leaf room.
    const seen=new Set([1]),q=[1];
    while(q.length){const k=q.shift();if(k!==1&&P.ROOMS[F.rooms[k].type].leaf)continue;for(const n of adj.get(k)||[])if(!seen.has(n)){seen.add(n);q.push(n);}}
    F.rooms.forEach((r,k)=>{rooms++;assert.ok(seen.has(k),`${tag} floor ${f}: ${r.label} is unreachable`+show());
      if(P.ROOMS[r.type].light)assert.ok(F.openings.some(o=>o.room===k&&o.kind!=='front'&&o.kind!=='back'),`${tag} floor ${f}: ${r.label} has no window`+show());
      // Leaf rooms open onto the hall itself or their work partner (a store off the shop or kitchen).
      if(P.ROOMS[r.type].leaf&&k>1)assert.ok((adj.get(k)||[]).some(n=>n===1||P.canLink(r.type,F.rooms[n].type)),`${tag}: ${r.label} opens onto the hall`);});
    for(const o of F.openings)for(const [x] of o.cells){if(o.side==='xm'&&x===0)assert.ok(!plan.plot.party[0],'no openings in the left party wall');if(o.side==='xp'&&x===w-1)assert.ok(!plan.plot.party[1],'no openings in the right party wall');}
    if(f===0){assert.ok(F.openings.some(o=>o.kind==='front'&&o.side==='zm'),`${tag}: a front door on the street`);
      const biz=F.rooms.findIndex(r=>['shop','workshop'].includes(r.type));
      if(biz>0){assert.ok(F.openings.some(o=>o.kind==='front'&&o.room===1),`${tag}: the home has its own street door`+show());assert.ok(F.openings.some(o=>o.kind==='front'&&o.room===biz),`${tag}: the business has a street door`);}}
    // The stair stacks: floor f holds run f's steps and run f-1's void, and opens onto the hall at both.
    const run=plan.stair.runs[f],below=plan.stair.runs[f-1];
    if(run)assert.equal(F.steps.length,12);if(below)assert.equal(F.voids.length,12);
    for(const i of [...F.steps,...F.voids])assert.equal(F.rooms[F.grid[i]].type,'stair');
    assert.equal(F.doors.filter(dr=>dr.kind==='open').length,(run?1:0)+(below?1:0),`${tag} floor ${f}: the stair opens onto the hall`+show());});
}
// Determinism and variety.
assert.deepEqual(P.generate(12345),P.generate(12345),'same seed, same building');
const kinds=new Set();for(let s=1;s<=30;s++){const p=P.generate(s);kinds.add(p.type+'/'+p.style+'/'+p.context);}
assert.ok(kinds.size>=12,`30 seeds give varied buildings (${kinds.size} type/style/plot combinations)`);
const sample=P.generate(1,{type:'shophouse',context:'terrace'});
console.log('Shop-house, ground floor ($ shop, h hall, ^ stair, s store, b bath, K kitchen-diner; D outside door, / door, = window):');
console.log(P.ascii(sample,0));
console.log(`PASS building plan: ${buildings} buildings (${Object.keys(P.TYPES).length} types x ${Object.keys(P.CONTEXTS).length} plots x ${SEEDS} seeds), ${floors} floors, ${rooms} rooms reachable off the hall, lit, on a stacked stair`);
