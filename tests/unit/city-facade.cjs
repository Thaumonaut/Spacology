'use strict';
const assert=require('node:assert/strict'),C=require('../../prototypes/labs/city-lab/city-model.js'),P=require('../../prototypes/labs/building-lab/plan.js'),V=require('../../prototypes/labs/building-lab/voxels.js'),G=require('../../prototypes/labs/city-lab/city-geometry.js');
const city=C.generate(1);
for(const id of [0,12]){
  const p=city.parcels[id],plan=P.generate(p.seed,p.options),mesh=G.planMesh(plan,p,city.extent,V.M),faces=[];
  assert.ok(Math.abs(G.planBounds(mesh,p,city.extent).lo[1])<1e-10,'non-grid-aligned pads retain exact ground contact after packing');
  for(let i=0;i<mesh.verts.length;i+=16){const points=[0,4,8,12].map(k=>Array.from(mesh.verts.subarray(i+k,i+k+3)));faces.push({n:mesh.verts[i+3]&255,m:mesh.verts[i+3]>>>8,lo:[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))),hi:[0,1,2].map(a=>Math.max(...points.map(p=>p[a])))});}
  const windows=faces.filter(f=>f.m===V.M.glass),doors=faces.filter(f=>f.m===V.M.door_wood),walls=faces.filter(f=>[V.M[plan.facade.wall],V.M[plan.facade.base]].includes(f.m));assert.ok(windows.length>0);assert.ok(doors.length>0,'front openings render as doors, not blank walls');
  for(const f of windows)for(const w of walls){if(f.n!==w.n)continue;const a=Math.floor(f.n/2);if(f.lo[a]!==w.lo[a])continue;assert.ok([0,1,2].filter(k=>k!==a).some(k=>Math.min(f.hi[k],w.hi[k])<=Math.max(f.lo[k],w.lo[k])),'quantized glass may not overlap a coplanar opaque wall');}
  assert.ok(mesh.quads<1500,'architectural startup facade stays bounded without a dense volume');
}
console.log('fast facade has visible closed front doors, multi-side glass and non-coplanar quantized detail');
for(const terrain of ['flat','uneven'])for(const p of C.generate(1,{terrain,layout:'woven',width:1,count:24}).parcels){const plan=P.generate(p.seed,p.options),{lo,hi}=G.planBounds(G.planMesh(plan,p,city.extent,V.M),p,city.extent);assert.ok(lo[0]>=-(p.options.party[0]?.075:.26)&&hi[0]<=p.width+(p.options.party[1]?.075:.26)&&lo[2]>=-p.envelope.front-.01&&hi[2]<=p.depth+.26,`parcel ${p.id} ${terrain} facade respects exact runtime exterior envelope`);}
