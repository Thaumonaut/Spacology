'use strict';
const assert=require('node:assert/strict'),M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const a=M.createWorld(2718,.25,'infinite'),b=M.createWorld(2718,.125,'infinite');
// Find one coral and one blossom world tree (locations move with terrain revisions).
const sites=[];for(const want of ['coral','blossom']){let hit=null;
  for(let r=0;r<9000&&!hit;r+=110)for(let k=0;k<Math.max(1,Math.floor(r/110))*6&&!hit;k++){const t=k/Math.max(1,Math.floor(r/110)*6)*Math.PI*2,x=Math.round(Math.cos(t)*r),z=Math.round(Math.sin(t)*r),A=a.landmarksAt(x,z).ancient;if(A&&A.variant===want)hit=[Math.round(A.x),Math.round(A.z),want];}
  assert.ok(hit,`a ${want} world tree exists`);sites.push(hit);}
for(const [x,z,variant] of sites){
  const A=a.landmarksAt(x,z).ancient,B=b.landmarksAt(x,z).ancient;
  assert.equal(A.variant,variant);assert.equal(B.variant,variant);assert.ok(Math.abs(A.H-B.H)<.5&&A.x===B.x&&A.z===B.z,'landmark structure is density-independent up to ground-cell rounding');
  assert.equal(JSON.stringify(A),JSON.stringify(M.createWorld(2718,.25,'infinite').landmarksAt(x,z).ancient),'landmark regeneration is deterministic');
  assert.ok(A.R>=4,'ancient trunks are massive, not just tall');
  assert.ok(A.reach*2>(A.top-A.g0)*1.6,'crown spread exceeds tree height');
  const crowns=variant==='coral'?A.pads:A.lumps;
  assert.ok(crowns.some(p=>p.y<A.base+A.H*.75),'a distinct lower canopy storey');
  assert.ok(crowns.some(p=>p.y>A.cy+3),'an upper crown above the middle storey');
  assert.ok(A.limbs.filter(l=>l.y0<A.base+A.H*.4).length>=4,'low spreading boughs support the lower storey');
  if(variant==='coral')assert.ok(A.pads.every(p=>p.th>=2.8),'canopy pads have substantial undersides');
  for(const l of A.limbs){
    assert.ok(l.r0>2&&l.r1>=.8,'boughs remain substantial at the tips');
    const t=.5,px=l.x0+(l.x1-l.x0)*t,pz=l.z0+(l.z1-l.z0)*t,py=l.y0+(l.y1-l.y0)*Math.sqrt(t);
    assert.equal(a.column(Math.floor(px/a.cell),Math.floor(pz/a.cell))[Math.floor(py/a.cell)],M.MAT.bark,'real bark supports each canopy layer');
  }
  for(const r of A.roots)assert.ok(r.pts.length>10&&r.pts[0].r>1,'spreading structural roots');
  const n=a.node(2,Math.floor(A.x/32),Math.floor(A.z/32),{props:false});
  assert.ok(n.top*n.column<=a.nodeBound(2,n.nx,n.nz)+n.column,'taller vegetation stays inside culling bounds');
}
let mature=0,total=0;
for(let j=-20;j<=20;j++)for(let i=-20;i<=20;i++){
  const t=a.tree(i,j);if(t?.kind!=='tree'||t.cls!==1||!['oak','birch','spruce','larch','jungle'].includes(t.species))continue;
  mature++;total+=t.height*a.cell;assert.ok(t.radius*a.cell<=6.5,'ordinary crowns retain the bounded sampling radius');
}
assert.ok(mature>10);assert.ok(total/mature>5.5,'mature trees read taller than saplings at eye height');
console.log('PASS grand-tree layers, bough occupancy, roots, regeneration, density parity, bounds and mature-tree scale');
