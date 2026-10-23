'use strict';
// 3D chunks: the streamed world is 10 km tall and stored as vertical bands and slices. Columns write only their band,
// nodes return only the slices that hold faces, and slice seams neither drop nor duplicate a face.
const assert=require('node:assert/strict');
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const w=M.createWorld(2718,M.CELL,'infinite');
assert.ok(w.heightMetres>=10000,'the streamed world is 10 km tall');
assert.ok(w.contentTop()<w.heightMetres&&w.contentTop()>100,'content ceiling sits under the world ceiling');

// Column bands: identical to the full column inside the band, bedrock below it, air above it. Sampled over lowland,
// mountain rock, ruins, boulders, standing stones and the home ground.
const spots=[[0,0],[37,-12]];
for(let k=0;k<60;k++)spots.push([Math.cos(k*2.4)*k*90,Math.sin(k*2.4)*k*90]);
for(const r of w.macro.ranges.slice(0,4))spots.push([r.x[r.x.length>>1],r.z[r.z.length>>1]]);
for(const [ox,oz] of spots){
  for(let k=0;k<6;k++){
    const vx=Math.floor(ox/w.cell)+k*7,vz=Math.floor(oz/w.cell)-k*5,band=w.columnBand(vx,vz),full=w.column(vx,vz);
    assert.equal(band.floor%8,0);assert.ok(band.top>band.floor&&band.top<=w.heightCells);
    for(let y=0;y<band.floor;y++)if(full[y]!==M.MAT.basalt)assert.fail(`cell ${y} below the band floor ${band.floor} at ${vx},${vz} is ${full[y]}, not bedrock`);
    for(let y=band.floor;y<band.top;y++)assert.equal(band.values[y-band.floor],full[y]);
    for(let y=band.top;y<Math.min(w.heightCells,band.top+64);y++)assert.equal(full[y],0,'air above the band');
  }
}

// Nodes: slices sit on the fixed per-level grid, and splitting a footprint into slices changes no face. A slice height
// of 2 blocks forces many seams through ground, trees and rock; its union must match the unsliced footprint exactly.
function faces(n){
  const out=new Map();
  for(const s of n.slices){const v=new DataView(s.buffer);
    for(let q=0;q<s.count;q+=6){const o=q*8,P=[];for(let k=0;k<6;k++)P.push([0,1,2].map(a=>v.getUint16(o+k*8+a*2,true)+(a===1?s.y:0)));
      const normal=v.getUint8(o+6),mat=v.getUint8(o+7),ax=normal>>1,u=(ax+1)%3,t=(ax+2)%3,lo=[0,1,2].map(a=>Math.min(...P.map(p=>p[a]))),hi=[0,1,2].map(a=>Math.max(...P.map(p=>p[a])));
      for(let a=lo[u];a<hi[u];a++)for(let b=lo[t];b<hi[t];b++){const c=[0,0,0];c[ax]=lo[ax];c[u]=a;c[t]=b;const key=c.join(',')+'|'+normal;assert.ok(!out.has(key),'a face is emitted once');out.set(key,mat);}}}
  return out;
}
function smoothTris(n){const out=[];for(const s of n.slices){if(!s.smooth)continue;const f=new Float32Array(s.smooth.buffer),u=new Uint8Array(s.smooth.buffer);
  for(let i=0;i<s.smooth.count;i+=3){const t=[];for(let k=0;k<3;k++){const o=(i+k)*4;t.push([f[o],f[o+1]+s.y,f[o+2]].map(x=>Math.round(x*64)).join(',')+':'+u[(i+k)*16+15]);}out.push(t.sort().join(';'));}}return out.sort();}
let seams=0;
for(const smooth of [true,false])for(const [L,nx,nz] of [[0,0,0],[0,4,-3],[1,-2,2],[2,1,1],[3,0,0],[3,-8,2],[4,-4,1],[5,0,0]]){
  const n=w.node(L,nx,nz,{smooth,props:false}),one=w.node(L,nx,nz,{smooth,props:false,sliceBlocks:1<<20}),thin=w.node(L,nx,nz,{smooth,props:false,sliceBlocks:2});
  assert.equal(n.slice,128);for(const s of n.slices){assert.equal(s.y%128,0);assert.ok(s.count>0||s.smooth?.count>0,'only slices with content');}
  assert.equal(one.slices.length,1);seams+=thin.slices.length-1;
  const a=faces(one),b=faces(thin),c=faces(n);
  assert.equal(b.size,a.size,`L${L} ${nx},${nz}: slicing keeps every face`);for(const [k,m] of a){assert.equal(b.get(k),m);assert.equal(c.get(k),m);}
  const sa=smoothTris(one),sb=smoothTris(thin);assert.equal(sb.length,sa.length);assert.deepEqual(sb,sa,`L${L} ${nx},${nz}: smooth slices close their seams`);
  assert.ok(n.top*n.column<=w.nodeBound(L,nx,nz)+n.column,'content stays under the node bound');
}
assert.ok(seams>=16,'the thin-slice check crossed many seams');
console.log(`PASS microvoxel slices: column bands, slice grid, ${seams} forced slice seams with no lost or doubled faces`);
