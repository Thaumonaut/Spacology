'use strict';
const assert=require('node:assert/strict'),C=require('../../prototypes/labs/city-lab/city-model.js'),G=require('../../prototypes/labs/city-lab/city-green.js'),V=require('../../prototypes/labs/building-lab/voxels.js');
for(const count of [24,100,1000]){
  const c=C.generate(1,{count});c.green=G.generate(c);const green=c.green,nominal=c.parcels.reduce((n,p)=>n+C.area(p.polygon),0);
  assert.ok(green.parkArea<=c.buildableArea-nominal,'parks use residual land, not occupied building plots');
  for(const p of green.plants){assert.ok(G.safe(c,c.blocks[p.block],p.x,p.z,p.radius));for(const q of c.parcels)assert.equal(C.contains(q.polygon,[p.x,p.z],-p.radius-.5),false,'no canopy over a building');}
  assert.ok(green.plants.length>0);if(count>24)assert.ok(green.plants.some(p=>p.kind==='tree'));
  const m=G.mesh(c,V.M);assert.ok(m.idx.length>0);assert.equal(m.normals.length,m.verts.length/4*3);assert.ok([...m.normals].every(Number.isFinite));for(const i of m.idx)assert.ok(i<m.verts.length/4);
  const u=C.generate(1,{count,terrain:'uneven'});u.green=G.generate(u);assert.deepEqual(green.cells,u.green.cells,'terrain never changes pocket identity');assert.deepEqual(green.plants.map(({y,...p})=>p),u.green.plants.map(({y,...p})=>p));
}
console.log('safe deterministic residual parks, trees/bushes and soft occupancy surface nets');
