'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),base='../../prototypes/labs/',C=require(base+'city-lab/city-model.js'),S=require(base+'city-lab/city-stream.js'),V=require(base+'building-lab/voxels.js');
for(const terrain of ['flat','uneven']){
  const city=C.generate(1,{terrain}),parcel=city.parcels[0],calls=[];let reply;
  const sandbox={performance,Uint16Array,Uint32Array,importScripts(){},self:{postMessage(d){reply=d;}},BuildingPlan:require(base+'building-lab/plan.js'),BuildingVoxels:{...V,build(plan,options){const b=V.build(plan,options);calls.push({options,furniture:b.info.furniture.length,stairs:b.vol.includes(V.M.stair_wood)});return b;}},BuildingRenderer:require(base+'building-lab/renderer.js'),BuildingReview:require(base+'building-lab/review.js'),CityModel:C,CityGeometry:require(base+'city-lab/city-geometry.js'),CitySparse:require(base+'city-lab/city-sparse.js')};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,base+'city-lab/city-worker.js'),'utf8'),sandbox);
  function job(mode){sandbox.self.onmessage({data:{epoch:1,parcel,mode,extent:city.extent,sparse:mode!=='low',includeNavigation:mode==='full'}});assert.equal(reply.error,undefined);return reply;}
  const low=job('low');assert.equal(calls.length,0,'coarse spawn never builds a furnished volume');assert.ok(low.summary.entry);
  const exterior=job('exterior');assert.equal(calls[0].options.exterior,true);assert.equal(calls[0].furniture,0);assert.equal(calls[0].stairs,false,'shell construction skips internal stairs');assert.equal(exterior.walkData,null);assert.ok(exterior.ray.bytes>0,'near exterior can use sparse bricks without interiors');assert.deepEqual(exterior.summary.entry,low.summary.entry);
  const point=[parcel.origin[0],2,parcel.origin[1]];assert.ok([...S.targets(city,point).values()].every(t=>t.mode!=='full'));
  const open=S.targets(city,point,new Map(),'stream',parcel.id);assert.equal(open.get(parcel.id).mode,'exterior');
  const full=job('full');assert.equal(calls[1].options.exterior,false);assert.ok(calls[1].furniture>0);assert.ok(calls[1].stairs);assert.ok(full.walkData.building.vol.byteLength>0);assert.deepEqual(full.summary.entry,exterior.summary.entry);assert.equal(full.summary.footprint,exterior.summary.footprint);
  const closed=S.targets(city,point,open);assert.ok([...closed.values()].every(t=>t.mode!=='full'),'closing evicts the full target');
  assert.ok(full.doorMesh.quads>0);assert.ok(full.walkData.doors.indices.length>0);parcel.entry=full.summary.entry;
  const G=sandbox.CityGeometry,walk=require(base+'city-lab/city-walk.js').create(parcel,full.walkData,city),outside=parcel.entry.map((v,i)=>v-parcel.inward[i]*1.5);
  const eye=[outside[0],G.walkHeight(city,...outside)+1.6,outside[1]];assert.ok(walk.place(eye));assert.deepEqual(walk.snapshot().eye,eye,'activation preserves all three world coordinates');walk.move(0,0);assert.deepEqual(walk.snapshot().eye,eye,'idle frames cannot snap feet after activation');const start=walk.snapshot().position;
  function move(n,sign=1){for(let i=0;i<n;i++){const before=walk.snapshot().position;walk.move(...parcel.inward.map(v=>v*.05*sign));const after=walk.snapshot().position;assert.ok(Math.hypot(after[0]-before[0],after[2]-before[2])<.051,'no horizontal threshold teleport');}}
  move(60);assert.equal(walk.snapshot().room,'Outside','closed door blocks entry');walk.setDoorOpen(true);move(50);assert.notEqual(walk.snapshot().room,'Outside','walking crosses open threshold');
  assert.ok(walk.canCloseDoor());walk.setDoorOpen(false);move(70,-1);assert.notEqual(walk.snapshot().room,'Outside','closed door also blocks exit from inside');walk.setDoorOpen(true);move(70,-1);assert.equal(walk.snapshot().room,'Outside','walk back out without a return action');
  assert.ok(Math.hypot(walk.snapshot().position[0]-start[0],walk.snapshot().position[2]-start[2])<4);
}
console.log('flat/uneven bounded approach prefetch, closed-door collision and seamless bidirectional walking with no threshold teleport');
