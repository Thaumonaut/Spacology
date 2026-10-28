'use strict';
// Building planner: for every type, plot context, house typology and many seeds, the rules every real plan keeps hold.
// Rooms are rectangles (circulation may bend), every room is reachable from where you arrive on the floor through
// sensible doors, leaf rooms are never walked through, rooms that need light get a window, mixed-use buildings give
// the home its own street door, the stair opens onto circulation on every floor, and the same seed gives the same
// building. Also checks that every typology actually turns up, so the layouts vary. Prints one plan per typology.
const assert=require('node:assert/strict');
const P=require('../../prototypes/labs/building-lab/plan.js');
assert.equal(P.ARCHITECTURE.door.cells,3,'doorways reserve 1.5 m independently of circulation');
assert.equal(P.ARCHITECTURE.hallway.cells,4,'hallways retain their approved 2 m planned width');
assert.equal(P.STAIRS.straight.U,4,'straight stair flights retain their approved 2 m width');
for(const orient of ['zp','zm','xp','xm']){
  const stair=P.stairBay('spiral',orient,8,12,3);
  for(const spiral of stair.spirals){
    assert.equal(spiral.sweep,2*Math.PI,'a spiral returns to its doorway side after one full turn');
    const entry=stair.floors[spiral.from].open[0],arrival=stair.floors[spiral.from+1].open.find(o=>o.dir===entry.dir);
    assert.deepEqual(arrival.cells,entry.cells,`${orient}: lower and upper doorway approaches align`);
    const lower=stair.landings.find(l=>l.from===spiral.from&&l.rise===0),upper=stair.landings.find(l=>l.from===spiral.from&&l.rise===16);
    assert.deepEqual(upper.rect,lower.rect,`${orient}: the doorway has a real landing on both floors`);
    assert.ok((upper.rect[2]-upper.rect[0])*(upper.rect[3]-upper.rect[1])>=P.ARCHITECTURE.hallway.cells**2,'a landing has useful standing space');
  }
}
const SEEDS=12;let floors=0,rooms=0,buildings=0;const seen={};
function check(plan,tag){
  const {w,d}=plan.plot;buildings++;seen[plan.typology]=(seen[plan.typology]||0)+1;
  let rear=-1;
  plan.floors[0].grid.forEach((k,i)=>{if(k>=0)rear=Math.max(rear,Math.floor(i/w));});
  assert.ok(Number.isFinite(plan.plot.compactDepth),`${tag}: occupied depth has an explicit frontage-based budget`);
  assert.ok(rear-plan.plot.front+1<=plan.plot.compactDepth,`${tag}: wings and lot extensions stay within the ground-floor depth budget`);
  const kitchenArea=Math.min(...plan.floors.flatMap(F=>F.rooms.filter(r=>r.type==='kitchen'&&r.cells).map(r=>r.area)));
  assert.equal(plan.floors.length,plan.plot.masks.length);
  plan.floors.forEach((F,f)=>{floors++;const mask=plan.plot.masks[f],show=()=>`\n[${plan.typology}]\n`+P.ascii(plan,f);
    for(let i=0;i<w*d;i++)if((F.grid[i]>=0)!==(mask[i]===1))assert.fail(`${tag} floor ${f}: cell ${i} coverage`+show());
    assert.equal(F.rooms[0].type,'stair');
    for(const r of F.rooms.filter(r=>r.type==='bath'&&r.cells)){
      assert.ok(r.area<=P.ARCHITECTURE.bath.preferred[1],`${tag}: bathrooms stay within their fixture-sized budget`);
      assert.ok(r.area<kitchenArea,`${tag}: a bathroom must be smaller than the kitchen`);
    }
    for(const r of F.rooms.filter(r=>r.cells&&P.roomBudget(plan.type,f,r).maxA))assert.ok(r.area<=P.roomBudget(plan.type,f,r).maxA,`${tag}: ${r.label} stays within its programme area budget`);
    F.rooms.forEach((r,k)=>{if(k<2||!r.cells||P.ROOMS[r.type].circ||r.annex)return;const [x0,z0,x1,z1]=r.box;assert.equal(r.cells,(x1-x0+1)*(z1-z0+1),`${tag} floor ${f}: ${r.label} is a rectangle`+show());});
    const adj=new Map();for(const dr of F.doors){for(const [a,b] of [[dr.a,dr.b],[dr.b,dr.a]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}
      if(dr.kind==='open'){const [dx,dz]={xm:[-1,0],xp:[1,0],zm:[0,-1],zp:[0,1]}[dr.dir];
        for(const [x,z] of dr.cells)assert.ok(mask[(x-dx)+w*(z-dz)],`${tag} floor ${f}: the stair landing at ${x},${z} has floor beyond it, not an outside wall`+show());
        assert.equal(F.rooms[dr.b].type,'stair');assert.ok(P.ROOMS[F.rooms[dr.a].type].circ,`${tag}: the stair opens onto circulation (${F.rooms[dr.a].type})`+show());}
      else assert.ok(P.canLink(F.rooms[dr.a].type,F.rooms[dr.b].type),`${tag}: no door between ${F.rooms[dr.a].type} and ${F.rooms[dr.b].type}`);
      if(dr.kind==='open')assert.ok(dr.cells.length>=4,'stair openings retain at least 2 m');
      else assert.equal(dr.cells.length,3,'room doorways are three-quarters of the previous 2 m width');
      if(dr.kind==='door')for(const k of [dr.a,dr.b])if(F.rooms[k].type==='shop')assert.ok(P.shopDoorAtRear(F.rooms[k],dr),`${tag}: shop connection belongs toward the rear`);}
    for(const o of F.openings)if(o.kind==='front'||o.kind==='back')assert.equal(o.cells.length,3,'street and service doorways also reserve 1.5 m');
    for(const o of F.openings.filter(o=>o.kind==='back'&&F.rooms[o.room].type==='shop'))assert.ok(P.shopDoorAtRear(F.rooms[o.room],o),`${tag}: shop staff exit belongs toward the rear`);
    const exterior=F.openings.filter(o=>o.kind==='front'||o.kind==='back');
    assert.deepEqual(P.redundantExteriorDoors(plan.plot,F,F.doors,F.openings),[],`${tag}: every exterior entrance has a distinct purpose`);
    for(let i=0;i<exterior.length;i++)for(let j=0;j<i;j++)assert.ok(!P.exteriorDoorsConflict(exterior[i],exterior[j]),`${tag}: exterior doors never overlap or meet at a corner`);
    // Where you arrive: the front door's room on the ground floor, the stair head upstairs.
    const opens=F.doors.filter(dr=>dr.kind==='open');
    assert.ok(opens.length>=1,`${tag} floor ${f}: the stair opens onto this floor`+show());
    const start=f===0?(F.openings.filter(o=>o.kind==='front').map(o=>o.room).find(k=>P.ROOMS[F.rooms[k].type].circ)??1):opens.at(-1).a;
    // a room may also be reached from outside, by its own door onto the yard or street
    const reach=new Set([start,...F.openings.filter(o=>o.kind==='back'||o.kind==='front').map(o=>o.room)]),q=[...reach];
    while(q.length){const k=q.shift();if(k!==start&&P.ROOMS[F.rooms[k].type].leaf)continue;for(const n of adj.get(k)||[])if(!reach.has(n)){reach.add(n);q.push(n);}}
    F.rooms.forEach((r,k)=>{if(!r.cells)return;rooms++;assert.ok(reach.has(k),`${tag} floor ${f}: ${r.label} is unreachable`+show());
      if(P.ROOMS[r.type].light)assert.ok(F.openings.some(o=>o.room===k&&o.kind!=='front'&&o.kind!=='back'),`${tag} floor ${f}: ${r.label} has no window`+show());});
    for(const o of F.openings)for(const [x,z] of o.cells)assert.ok(!P.isPartyEdge(plan.plot,x,z,o.side),`${tag} floor ${f}: no ${o.kind} in a party wall at ${x},${z} ${o.side}`+show());
    if(f===0){const fronts=F.openings.filter(o=>o.kind==='front');assert.ok(fronts.length>=1,`${tag}: a front door`);
      const biz=F.rooms.findIndex(r=>['shop','workshop'].includes(r.type)&&!r.extension); // the business, not a workroom built out behind
      // A shop or workshop takes most of the ground floor, opens onto the living quarters behind it, and the home
      // has a yard door of its own.
      if(biz>0){const ground=F.rooms.reduce((a,r)=>a+(r.extension?0:r.cells),0); // of the main house, not its extensions
        assert.ok(fronts.some(o=>o.room===biz&&o.side==='zm'),`${tag}: the business has a street door`+show());
        assert.ok(F.rooms[biz].cells>=ground*P.ARCHITECTURE.shop.minFloorShare,`${tag}: the ${F.rooms[biz].type} has its programme share of the ground floor (${F.rooms[biz].cells}/${ground})`+show());
        assert.ok(F.doors.some(dr=>(dr.a===biz||dr.b===biz)&&P.ROOMS[F.rooms[dr.a===biz?dr.b:dr.a].type].circ),`${tag}: a door from the ${F.rooms[biz].type} to the living area`+show());
      }}
    for(const i of [...F.steps,...F.voids])assert.equal(F.rooms[F.grid[i]].type,'stair');
    assert.deepEqual(F.notes,[],`${tag} floor ${f}: no hard failures`);});
}
// A long property may retain a deep yard, but must not turn it into a long occupied building.
for(const type of Object.keys(P.TYPES)){
  const plan=P.generate(1,{type,context:'detached',lot:'deep',projection:3}),{w,front,compactDepth,lot}=plan.plot;
  const frontage=lot?.main.w??plan.plot.overhang?.core.w??w;
  assert.equal(compactDepth,Math.max(26,Math.floor(frontage*P.ARCHITECTURE.depthRatio[type])),`${type}: default generation cannot silently enlarge its depth allowance`);
  check(plan,`${type}/compact deep lot`);
  assert.ok(plan.plot.overhang?.metres===3,`${type}: shortening the core preserves the requested usable upper-floor overhang`);
}
for(const context of Object.keys(P.CONTEXTS))for(const projection of [2,2.5,3]){
  const plan=P.generate(3,{type:'home',context,projection}),{core}=plan.plot.overhang,depth=projection/P.CELL;
  assert.equal(core.x,plan.plot.party[0]?0:depth,`${context}: left projection respects party walls`);
  assert.equal(plan.plot.w-core.x-core.w,plan.plot.party[1]?0:depth,`${context}: right projection respects party walls`);
  check(plan,`${context}/${projection} m upper projection`);
}
// Shaped lots: ground stays on the lot; upper floors may use their explicit exposed-side projection envelope. Extensions are
// rectangles that each have a door, and most shaped lots are built out with at least one extension.
{let shaped=0,withExt=0;
  for(const lot of Object.keys(P.LOTS).filter(k=>k!=='rect'))for(const type of Object.keys(P.TYPES))for(let seed=1;seed<=6;seed++){const plan=P.generate(seed,{type,lot}),tag=`${type}/${lot} seed ${seed}`;check(plan,tag);
    if(plan.lotKind==='rect')continue;shaped++;const {w,d,front}=plan.plot,L=plan.plot.lot.mask;
    plan.floors.forEach((F,f)=>{for(let i=0;i<w*d;i++)if(F.grid[i]>=0)assert.ok(L[i]||Math.floor(i/w)<front||f>0&&plan.plot.overhang?.masks[f][i],`${tag} floor ${f}: cell ${i%w},${Math.floor(i/w)} is inside the lot or its upper projection envelope`);});
    const F=plan.floors[0],ext=F.rooms.filter(r=>r.extension);if(ext.length)withExt++;
    for(const r of ext){const [x0,z0,x1,z1]=r.box;if(!P.ROOMS[r.type].circ)assert.equal(r.cells,(x1-x0+1)*(z1-z0+1),`${tag}: the ${r.label} extension is a rectangle`);
      assert.ok(F.doors.some(dr=>dr.a===r.id||dr.b===r.id)||F.openings.some(o=>o.room===r.id&&(o.kind==='back'||o.kind==='front')),`${tag}: the ${r.label} extension has a door`);}}
  assert.ok(withExt>=shaped*.6,`most shaped lots get extensions (${withExt}/${shaped})`);console.log(`shaped lots: ${shaped} built, ${withExt} with extensions`);}
for(const type of Object.keys(P.TYPES))for(const context of Object.keys(P.CONTEXTS))for(let seed=1;seed<=SEEDS;seed++)check(P.generate(seed,{type,context}),`${type}/${context} seed ${seed}`);
// Every typology on every type that lists it, forced, across plots.
for(const [type,T] of Object.entries(P.TYPES))for(const typology of Object.keys(T.typologies))for(const context of Object.keys(P.CONTEXTS))for(let seed=1;seed<=4;seed++){
  const Y=P.TYPOLOGIES[typology];let plan=null;
  for(let s=seed;s<seed+40&&!plan;s++){const p=P.makePlot(s,{type,context});if(p.w>=Y.minW&&!(Y.straight&&p.storeys>2))plan=P.generate(s,{type,context,typology});}
  if(plan)check(plan,`${type}/${typology}/${context}`);}
// Include enough freely chosen buildings to sample the rarer front-tower and undercroft forms.
const VARIATION_SEEDS=240,free={},kinds=new Set();for(let s=1;s<=VARIATION_SEEDS;s++){const p=P.generate(s);free[p.typology]=(free[p.typology]||0)+1;kinds.add(p.stair.kind);}
for(const t of Object.keys(P.TYPOLOGIES).filter(t=>!P.TYPOLOGIES[t].parcelOnly))assert.ok(free[t]>=1,`typology ${t} turns up when chosen freely (${JSON.stringify(free)})`);
assert.ok(Math.max(...Object.values(free))<=VARIATION_SEEDS*.35,`no typology dominates (${JSON.stringify(free)})`);
// Stairs vary: every kind turns up when chosen freely, some in exterior towers, and the L-shaped one (which arrives on
// its side) only ever stands in a tower.
{const seen={},towers={};for(let s=1;s<=300;s++){const p=P.generate(s);seen[p.stair.kind]=(seen[p.stair.kind]||0)+1;if(p.stair.tower)towers[p.stair.kind]=(towers[p.stair.kind]||0)+1;
    if(p.stair.kind==='L')assert.ok(p.stair.tower,'an L-shaped stair stands in a tower');}
  for(const k of Object.keys(P.STAIRS))assert.ok(seen[k]>=2,`stair kind ${k} turns up (${JSON.stringify(seen)})`);assert.ok(Object.values(towers).reduce((a,b)=>a+b,0)>=5,`exterior stair towers turn up (${JSON.stringify(towers)})`);
  console.log('stairs over 300 seeds:',JSON.stringify(seen),'in towers:',JSON.stringify(towers));}
assert.deepEqual(P.generate(12345),P.generate(12345),'same seed, same building');
// Massing variety: across free seeds the silhouettes differ: several roof forms, cross gables, dormers, turrets
// and oriels all turn up (on rectangular lots: a shaped lot never gets a turret).
{const forms=new Set(),n={cross:0,dormers:0,turret:0,oriels:0};for(let s=1;s<=200;s++){const p=P.generate(s,{lot:'rect'});forms.add(p.roof.form);n.cross+=!!p.roof.cross;n.dormers+=!!p.roof.dormers;n.turret+=!!p.roof.turret;n.oriels+=!!p.facade.oriels;
    if(p.roof.turret)assert.ok(!p.plot.party[p.roof.turret.side==='xm'?0:1],'a turret never stands against a party wall');}
  assert.ok(forms.size>=4,`roof forms vary (${[...forms]})`);for(const [k,v] of Object.entries(n))assert.ok(v>=4,`${k} turn up across 200 seeds (${v})`);console.log('massing over 200 seeds:',JSON.stringify(n),[...forms].join('/'));}
// Facade variety: each style keeps its identity but its buildings differ in wall colour, windows, frame and roof.
for(const style of Object.keys(P.STYLES)){const seen={wall:new Set(),window:new Set(),frame:new Set(),roof:new Set()};
  for(let s=1;s<=30;s++){const p=P.generate(s,{style});seen.wall.add(p.facade.wall);seen.window.add(p.facade.window);seen.frame.add(p.facade.frame);seen.roof.add(p.roof.mat+p.roof.form+p.roof.ridge);
    assert.ok(!(p.facade.wall==='plaster_white'&&p.facade.trim==='paint_white'),'trim contrasts with the wall');assert.equal(p.facade.lattice,P.STYLES[style].lattice,'lattice stays with the style');}
  assert.ok(seen.wall.size>=3,`${style}: at least 3 wall colours`);assert.ok(seen.window.size>=2,`${style}: at least 2 window kinds`);
  assert.ok(seen.frame.size>=Math.min(2,Object.keys(P.STYLES[style].frames).length),`${style}: frame patterns vary`);assert.ok(seen.roof.size>=3,`${style}: roofs vary`);}
for(const [typology,type] of [['side','shophouse'],['cross','home'],['courtyard','inn']]){const p=P.generate(3,{type,typology,context:'corner'});console.log(`${type} / ${P.TYPOLOGIES[typology].label}, ground floor:`);console.log(P.ascii(p,0));}
console.log(`PASS building plan: ${buildings} buildings, ${floors} floors, ${rooms} rooms; typologies ${JSON.stringify(free)} over ${VARIATION_SEEDS} free seeds`);
