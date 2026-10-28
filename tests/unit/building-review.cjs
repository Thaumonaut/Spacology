'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const P=require('../../prototypes/labs/building-lab/plan.js'),V=require('../../prototypes/labs/building-lab/voxels.js'),R=require('../../prototypes/labs/building-lab/review.js');
const opts={type:'shophouse',style:'fairytale',context:'terrace',lot:'wedge'},p=P.generate(550298,opts),before=JSON.stringify(p);
const b=V.build(p),original=Buffer.from(b.vol),r=R.review(p,b);
assert.equal(JSON.stringify(p),before,'review does not mutate the plan');assert.ok(original.equals(Buffer.from(b.vol)),'review does not repair/mutate voxels');
assert.equal(r.checks.physics,'intentionally-not-enforced');assert.equal(r.checks.visual,'pending');
const deepFootprint=structuredClone(p);let rear=-1;
deepFootprint.floors[0].grid.forEach((k,i)=>{if(k>=0)rear=Math.max(rear,Math.floor(i/deepFootprint.plot.w));});
deepFootprint.plot.compactDepth=rear-deepFootprint.plot.front;
assert.ok(R.review(deepFootprint).findings.some(f=>f.code==='building-depth'&&f.severity==='error'),'occupied depth is checked independently of lot length and upper-floor projections');
assert.ok(!r.findings.some(f=>f.code==='building-depth'),'the retained compact building fits its occupied-depth allowance');
assert.notEqual(r.status,'approved','a generated plan is not automatic architectural approval');
const oversized=structuredClone(p);oversized.floors[1].rooms.find(r=>r.type==='living').area*=10;
assert.ok(R.review(oversized).findings.some(f=>f.code==='room-balance'),'an oversized living room still raises a programme warning');
const oversizedBath=structuredClone(p);oversizedBath.floors[1].rooms.find(r=>r.type==='bath').area=P.ARCHITECTURE.bath.preferred[1]+1;
assert.ok(R.review(oversizedBath).findings.some(f=>f.code==='bath-budget'&&f.severity==='error'),'an oversized bathroom is a hard budget failure, not a proportion warning');
const tinyKitchen=structuredClone(p);tinyKitchen.floors[0].rooms.find(r=>r.type==='kitchen').area=5;
assert.ok(R.review(tinyKitchen).findings.some(f=>f.code==='bath-budget'),'the bathroom must also be smaller than the household kitchen');
assert.match(r.checks.doors,/opened virtually/,'checks recorded back-door leaves in an explicit open state');
assert.deepEqual(r.findings.filter(f=>f.severity==='error'&&f.code!=='hallway-width'),[],'existing fixtures, entrances and role-separated routes remain usable');
assert.ok(!r.findings.some(f=>f.code==='hallway-width'),'widened reference halls maintain the default clear width');
assert.ok(R.review(p,b,{hallwayWidth:3}).findings.some(f=>f.code==='hallway-width'),'body-fit connectivity cannot certify an excessive clear-width requirement');
assert.equal(r.hallwayWidth,1.2);assert.equal(r.checks.hallwayWidth,'sampled');
const earlyDoor=structuredClone(p),ground=earlyDoor.floors[0],shopId=ground.rooms.find(r=>r.type==='shop').id,
  shopDoor=ground.doors.find(d=>d.kind==='door'&&[d.a,d.b].includes(shopId)&&[d.a,d.b].includes(1)),
  shopRun=P.sharedRuns(earlyDoor.plot,ground.grid).find(s=>s.a===shopDoor.a&&s.b===shopDoor.b&&s.dir===shopDoor.dir);
shopDoor.cells=shopRun.cells.slice(0,3);
assert.ok(R.review(earlyDoor).findings.some(f=>f.code==='shop-door-position'),'an otherwise usable doorway near the shop entrance fails architectural review');
assert.ok(!r.findings.some(f=>f.code==='shop-door-position'),'rear connections pass without rejecting the public front entrance');
const doubleDoor=structuredClone(p);doubleDoor.floors[0].openings.push(structuredClone(doubleDoor.floors[0].openings.find(o=>o.kind==='front')));
assert.ok(R.review(doubleDoor).findings.some(f=>f.code==='exterior-door-conflict'),'duplicate door cuts fail architectural review');
const cornerFront={side:'zm',cells:[[24,1],[25,1],[26,1]]},cornerSide={side:'xp',cells:[[26,1],[26,2],[26,3]]};
assert.ok(P.exteriorDoorsConflict(cornerFront,cornerSide),'perpendicular doors must not meet at an unframed corner');
assert.ok(P.exteriorDoorsConflict(cornerFront,{side:'zm',cells:[[27,1],[28,1],[29,1]]}),'adjacent openings must retain a wall pier');
assert.ok(!P.exteriorDoorsConflict(cornerFront,{side:'zm',cells:[[28,1],[29,1],[30,1]]}),'separate doors with a 0.5 m wall pier are allowed');
assert.ok(!P.exteriorDoorsConflict(cornerFront,{side:'xp',cells:[[26,5],[26,6],[26,7]]}),'a distinct service doorway farther along the side is allowed');
const cornerPlan=P.generate(85,{style:'fairytale'}),cornerDoors=cornerPlan.floors[0].openings.filter(o=>o.kind==='front'||o.kind==='back');
for(let i=0;i<cornerDoors.length;i++)for(let j=0;j<i;j++)assert.ok(!P.exteriorDoorsConflict(cornerDoors[i],cornerDoors[j]),'automatic seed 85 never puts its service and street openings around the same unframed corner');
assert.equal(cornerDoors.filter(o=>o.kind==='front').length,2,'corner repair preserves the separate resident and business street entrances');
const businessId=cornerPlan.floors[0].rooms.find(r=>r.type==='workshop'&&!r.extension).id;
assert.equal(cornerDoors.filter(o=>o.room===businessId).length,1,'remove the redundant workshop side entrance instead of moving it along the wall');
const redundantSide=structuredClone(cornerPlan),front=redundantSide.floors[0].openings.find(o=>o.kind==='front'&&o.room===businessId);
redundantSide.floors[0].openings.push({room:businessId,kind:'back',side:'xp',cells:[[26,7],[26,8],[26,9]]});
assert.ok(!P.exteriorDoorsConflict(front,redundantSide.floors[0].openings.at(-1)),'the redundant entrance has already cleared the old spacing rule');
assert.ok(R.review(redundantSide).findings.some(f=>f.code==='redundant-exterior-door'),'moving an unnecessary front/side entrance farther away is still invalid');
const redundantHall=structuredClone(p);redundantHall.floors[0].openings.push({room:1,kind:'back',side:'xm',cells:[[0,14],[0,15],[0,16]]});
assert.ok(R.review(redundantHall).findings.some(f=>f.code==='redundant-exterior-door'&&f.room===1),'a private hall does not need a second side entrance either');
for(const F of p.floors)for(const door of F.doors.filter(d=>d.kind==='door'&&[d.a,d.b].some(k=>F.rooms[k].type==='hall')&&[d.a,d.b].every(k=>F.rooms[k].type!=='shop'))){
  const run=P.sharedRuns(p.plot,F.grid).find(s=>s.a===door.a&&s.b===door.b&&s.dir===door.dir&&door.cells.every(c=>s.cells.some(a=>a[0]===c[0]&&a[1]===c[1])));
  assert.ok(run,'hall doorway belongs to its shared wall');const axis=door.dir[0]==='x'?1:0,mid=cells=>(cells[0][axis]+cells.at(-1)[axis]+1)/2;
  assert.ok(Math.abs(mid(door.cells)-mid(run.cells))<=.5,'hall doors are centred to the nearest planning cell, not biased to a wall end');
}
assert.ok(b.info.furniture.some(it=>it.piece==='hall_planter'),'large reference halls receive planting');
const sales=b.info.furniture.find(it=>it.piece.startsWith('sales_counter'));assert.ok(sales,'shop receives its dedicated sales counter');
const genericOnly={...b,info:{...b.info,furniture:b.info.furniture.map(it=>it===sales?{...it,piece:'kitchencounter_straight_A'}:it)}};
assert.ok(R.review(p,genericOnly).findings.some(f=>f.code==='missing-essential'&&f.room===sales.room),'a kitchen counter cannot pass the sales-counter requirement');
const staffBlocked={...b,vol:b.vol.slice()},[sx,sz]={xm:[1,0],xp:[-1,0],zm:[0,1],zp:[0,-1]}[sales.face],
  cx=sales.x+sales.w/2+sx*(sales.w/2+10),cz=sales.z+sales.d/2+sz*(sales.d/2+10);
for(let z=Math.floor(cz-14);z<cz+15;z++)for(let x=Math.floor(cx-14);x<cx+15;x++)for(let y=sales.y;y<sales.y+34;y++)
  staffBlocked.vol[x+b.dims[0]*(z+b.dims[2]*y)]=b.M.stone_grey;
assert.ok(R.review(p,staffBlocked).findings.some(f=>f.code==='sales-counter-staff'),'counter must retain its separate staff approach');
assert.ok(r.journeys.some(j=>j.points.length>1&&j.voxel==='connected'),'records concrete voxel-route witnesses');
assert.ok(r.journeys.some(j=>j.label.startsWith('Bedroom → bath')),'checks private everyday journeys');
assert.ok(r.journeys.filter(j=>j.plan==='connected').every(j=>j.voxel==='connected'),'spiral landings and furnished approaches remain physically connected across floors');
function checkRecess(plan,building){
  const F=plan.floors[0],home=F.openings.filter(o=>o.kind==='front'&&F.rooms[o.room].zone==='resident'),business=F.openings.find(o=>o.kind==='front'&&['public','service'].includes(F.rooms[o.room].zone));
  assert.equal(home.length,1,'one clearly identified private street entrance, not an obsolete side door as well');
  const entry=home[0],{depth,width,mouth}=entry.recess||{};
  assert.ok(depth>=1&&depth<=2&&width===4,'resident entry has a 0.5–1 m deep, 2 m wide planned recess');
  assert.equal(entry.cells.length,3,'the resident door narrows to 1.5 m without shrinking its entry alcove');
  assert.equal(business.cells.length,3,'the business doorway also narrows to 1.5 m');
  assert.equal(entry.cells[0][1],mouth[0][1]+depth,'the actual doorway is behind its street mouth');
  assert.ok(business.cells.every(c=>c[1]===mouth[0][1])&&!business.recess,'business entrance remains on the public shopfront');
  const row=business.cells[0][1],frontCells=F.grid.slice(row*plan.plot.w,(row+1)*plan.plot.w).flatMap((k,x)=>k===business.room?[x]:[]),
    homeX=(entry.cells[0][0]+entry.cells.at(-1)[0])/2,businessX=(business.cells[0][0]+business.cells.at(-1)[0])/2,
    farthest=Math.max(Math.abs(frontCells[0]+1-homeX),Math.abs(frontCells.at(-1)-1-homeX));
  assert.equal(Math.abs(businessX-homeX),farthest,'business entrance uses the frontage end farthest from the actual resident entrance');
  const removed=new Set();for(const [x,z] of mouth)for(let v=0;v<depth;v++){
    const i=x+plan.plot.w*(z+v);removed.add(i);
    assert.equal(F.grid[i],-1,'the recess is really outside, not an interior vestibule labelled as recessed');
    assert.equal(plan.plot.masks[0][i],0);assert.equal(plan.plot.masks[1][i],1,'upper storey remains over the covered entry');
  }
  for(const o of F.openings.filter(o=>['window','small','shopfront'].includes(o.kind))){const [dx,dz]={xm:[-1,0],xp:[1,0],zm:[0,-1],zp:[0,1]}[o.side];
    assert.ok(o.cells.every(([x,z])=>!removed.has(x+dx+plan.plot.w*(z+dz))),'no shutters or display windows crowd the private alcove return');}
  const x=building.origin[0]+(mouth[0][0]+1)*V.CV,z=building.origin[2]+mouth[0][1]*V.CV+4,[X,,Z]=building.dims;
  for(let dx=-3;dx<=3;dx++)for(let y=building.levels[0]+4;y<building.levels[0]+24;y++)assert.equal(building.vol[x+dx+X*(z+Z*y)],0,'lot fences cannot close the recessed resident approach');
}
checkRecess(p,b);
const blockedStairs={...b,vol:b.vol.slice()};
for(let z=0;z<p.plot.d;z++)for(let x=0;x<p.plot.w;x++)if(p.floors[1].grid[x+p.plot.w*z]===0)
  for(let zz=b.origin[2]+z*V.CV;zz<b.origin[2]+(z+1)*V.CV;zz++)for(let xx=b.origin[0]+x*V.CV;xx<b.origin[0]+(x+1)*V.CV;xx++)
    blockedStairs.vol[xx+b.dims[0]*(zz+b.dims[2]*(b.levels[1]+10))]=b.M.stone_grey;
assert.ok(R.review(p,blockedStairs).findings.some(f=>f.code==='voxel-route'&&f.floor>0),'stair step allowances cannot hide a real headroom obstruction');
for(const [seed,options] of [[898408,{type:'shophouse',style:'fairytale'}],[550300,{type:'workshop',style:'fairytale',context:'terrace',lot:'rect',typology:'side'}]]){
  const plan=P.generate(seed,options),building=V.build(plan),result=R.review(plan,building);
  checkRecess(plan,building);
  assert.deepEqual(result.findings.filter(f=>f.severity==='error'),[],`${seed}: essentials, service routes, hall widths and furnished journeys stay usable`);
  assert.ok(R.review(plan,building,{hallwayWidth:3}).findings.some(f=>f.code==='hallway-width'),`${seed}: the width reviewer still catches insufficient clearance`);
}
for(const seed of [13,551498]){
  const plan=P.generate(seed,{style:'fairytale'}),result=R.review(plan,V.build(plan));
  assert.deepEqual(result.findings.filter(f=>f.severity==='error'),[],`${seed}: domestic rooms do not depend on business circulation, and optional stockrooms retain employee access`);
}
for(const typology of ['tower','undercroft'])for(const projection of [2,2.5,3]){
  const plan=P.generate(1,{type:'home',typology,context:'detached',lot:'rect',style:'fairytale',projection}),result=R.review(plan,V.build(plan));
  assert.equal(plan.plot.overhang.metres,projection,'compact massing retains its requested usable upper-floor projection');
  assert.ok(plan.plot.features.some(f=>f.kind===typology),'the requested footprint-changing feature survives allocation');
  assert.deepEqual(result.findings.filter(f=>f.severity==='error'),[],`${typology}/${projection} m: rooms, landings, entry leaves and halls retain finished clear routes`);
}
const doorPlan=P.generate(550300,{type:'workshop',style:'fairytale',context:'terrace',lot:'rect',typology:'side'}),doorBuilding=V.build(doorPlan),
  leaf=doorBuilding.info.doorLeaves[0],doorBlocked={...doorBuilding,vol:doorBuilding.vol.slice()};
assert.ok(leaf,'closed back doors record their actual leaf bounds');
for(let y=leaf.box[1];y<leaf.box[4];y++)for(let z=leaf.box[2];z<leaf.box[5];z++)for(let x=leaf.box[0];x<leaf.box[3];x++)doorBlocked.vol[x+doorBuilding.dims[0]*(z+doorBuilding.dims[2]*y)]=doorBuilding.M.stone_grey;
assert.ok(R.review(doorPlan,doorBlocked).findings.some(f=>f.code==='entrance-blocked'&&f.room===leaf.room),'opening a door cannot erase an unrelated stone obstruction');
const yardPlan=P.generate(898408,{type:'shophouse',style:'fairytale'}),yard=R.review(yardPlan);
assert.ok(yard.journeys.some(j=>j.label.startsWith('Service: Workshop')&&j.plan==='connected'),'a real yard route may connect a backyard workshop to the shop');
const yardPlot={w:8,d:12,front:1,party:[true,true],lot:{mask:new Uint8Array(96).fill(1)},masks:[new Uint8Array(96)]};
for(let z=1;z<10;z++)if(z<4||z>6)for(let x=0;x<8;x++)yardPlot.masks[0][x+8*z]=1;
const yardDoors=[{room:2,side:'zp',kind:'back',cells:[[2,3],[3,3],[4,3],[5,3]]},{room:5,side:'zm',kind:'back',cells:[[2,7],[3,7],[4,7],[5,7]]}];
assert.ok(P.serviceYardRoutes(yardPlot,yardDoors).some(e=>e.a===2&&e.b===5),'separate service rooms can connect across a real yard');
yardPlot.lot.mask.fill(0);
assert.deepEqual(P.serviceYardRoutes(yardPlot,yardDoors),[],'service access cannot silently cross neighbouring property');
assert.deepEqual(R.review(p,b),r,'deterministic review');
assert.throws(()=>R.review(p,b,{body:{radius:-1}}),/Invalid review body/);
const planOnly=R.review(p);assert.equal(planOnly.checks.furnishedRoutes,'not-run');assert.equal(planOnly.checks.visual,'pending');
const missing=structuredClone(p);for(const F of missing.floors)for(const room of F.rooms)if(room.type==='bed')room.type='living';
assert.ok(R.review(missing).findings.some(f=>f.code==='missing-room'),'missing programme rooms are diagnosed');
const privateDoor=structuredClone(p);const F=privateDoor.floors[1],bed=F.rooms.find(r=>r.type==='bed'),bath=F.rooms.find(r=>r.type==='bath');
F.doors=F.doors.filter(d=>d.a!==bath.id&&d.b!==bath.id);F.doors.push({a:bed.id,b:bath.id});
assert.ok(R.review(privateDoor).findings.some(f=>f.code==='programme-route'&&f.room===bath.id),'a reachable bath behind someone else’s bedroom is not valid circulation');
const noFurniture={...b,info:{...b.info,furniture:b.info.furniture.filter(it=>!it.piece.startsWith('bed_'))}};
assert.ok(R.review(p,noFurniture).findings.some(f=>f.code==='missing-essential'),'decorations do not substitute for beds');
const broken={...b,vol:b.vol.slice()};const room=p.floors[0].rooms.find(r=>r.type==='shop'),x=b.origin[0]+(room.box[0]+1)*V.CV+4,z=b.origin[2]+(room.box[1]+1)*V.CV+4;
broken.vol[x+b.dims[0]*(z+b.dims[2]*(b.levels[0]-1))]=0;
assert.ok(R.review(p,broken).findings.some(f=>f.code==='floor-hole'),'post-build floor holes are diagnosed');
const blocked={...b,vol:b.vol.slice()};for(let y=b.levels[0];y<b.plate;y++)for(let zz=b.origin[2];zz<b.origin[2]+p.plot.d*V.CV;zz++)for(let xx=b.origin[0];xx<b.origin[0]+p.plot.w*V.CV;xx++)blocked.vol[xx+b.dims[0]*(zz+b.dims[2]*y)]=b.M.stone_grey;
const blockedReview=R.review(p,blocked);assert.ok(blockedReview.findings.some(f=>f.code==='voxel-route'),'graph connectivity cannot hide blocked finished voxels');
assert.ok(blockedReview.findings.some(f=>f.code==='entrance-blocked'),'outside/inside entrance connections are checked');
const cosmetic=structuredClone(p);cosmetic.seed++;cosmetic.facade.wall='plaster_rose';cosmetic.roof.mat='tile_blue';
const copies=R.diversity([p,cosmetic]);assert.equal(copies.distinctLayouts,1);assert.equal(copies.distinctSilhouettes,1);assert.equal(copies.repeatedLayouts[0].length,2,'different seed and colours do not create unique architecture');
const varied=R.diversity(Array.from({length:24},(_,i)=>P.generate(i+1,{style:'fairytale'})));
assert.equal(varied.languages.length,1,'shared architectural language');assert.ok(varied.families.length>3,'measures structural families');
assert.equal(R.diversity([]).total,0);
const out=fs.mkdtempSync(path.join(os.tmpdir(),'spacology-review-'));
try{
  const cases=path.join(out,'cases.json');fs.writeFileSync(cases,JSON.stringify([{seed:551498,type:'invalid-test-type'}]));
  const cli=spawnSync(process.execPath,[path.resolve(__dirname,'../../tools/review-buildings.cjs'),'--cases',cases,'--detail','1','--strict','--out',out],{encoding:'utf8'});
  assert.equal(cli.status,2,cli.stderr);const report=JSON.parse(fs.readFileSync(path.join(out,'review.json'),'utf8'));
  assert.equal(report.generationFailures[0].seed,551498,'retain failed generation and its original inputs');assert.equal(report.buildings.length,0);
}finally{fs.rmSync(out,{recursive:true});}
console.log('PASS architect review: programme/privacy, furnished routes, essential fixtures, voxel mutations, non-mutation and palette-independent diversity');
