'use strict';
const assert=require('node:assert/strict'),C=require('../../prototypes/labs/city-lab/city-model.js'),P=require('../../prototypes/labs/building-lab/plan.js'),V=require('../../prototypes/labs/building-lab/voxels.js'),G=require('../../prototypes/labs/city-lab/city-geometry.js'),W=require('../../prototypes/labs/city-lab/city-walk.js');
for(const terrain of ['flat','uneven']){
  const city=C.generate(1,{terrain});
  for(const id of [0,12]){
    const parcel=city.parcels[id],plan=P.generate(parcel.seed,parcel.options),building=V.build(plan);G.cityVolume(plan,building,false);
    const walk=W.create(parcel,{plan,building}),start=walk.enter();assert.ok(start,`${terrain} ${id}: safe resident entry`);
    const s=walk.snapshot(),model=G.model(parcel,{...building,cityFront:plan.plot.front*plan.cell});assert.ok(s.active);assert.equal(s.floor,0);assert.ok(Math.abs(s.eye[1]-s.position[1]-1.6)<1e-6);
    const local=W.local(parcel,parcel.right[0],parcel.right[1]);assert.ok(Math.abs(local[0]-1)<1e-8&&Math.abs(local[1])<1e-8,'world strafe converts to parcel-local movement');
    assert.deepEqual(W.world(model,[0,0,0]),[model[12],model[13],model[14]]);
    walk.move(100*parcel.right[0],100*parcel.right[1]);assert.ok(Math.hypot(walk.snapshot().position[0]-s.position[0],walk.snapshot().position[2]-s.position[2])<parcel.width+1,'cannot tunnel through the exterior wall');walk.leave();assert.equal(walk.snapshot().active,false);
  }
}
console.log('flat/uneven in-city resident entry, transformed human eye and swept BuildingWalk collision');
