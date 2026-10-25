#!/usr/bin/env node
'use strict';
// Byte budget of streamed LOD node output, per field and per level, over a Walk-like mix of nodes (home lowland and a
// mountain), with object trees on. Shows where packing the data would pay most.
//   node tools/packing-survey.cjs [path/to/voxel-world-model.js]
const path=require('node:path');
const M=require(path.resolve(process.argv[2]||path.join(__dirname,'../prototypes/labs/microvoxel-world/voxel-world-model.js')));
const w=M.createWorld(2718,.25,'infinite'),opts={smooth:true,props:true,treeObjects:true};
const MIX=[[0,4,0,0],[1,3,0,0],[2,2,0,0],[3,2,0,0],[4,1,0,0],[5,1,0,0],[6,1,0,0],[7,1,0,0],[0,3,-52,-57],[2,2,-13,-14],[4,1,-4,-4]];
const tot={},perL={},count={};
const add=(k,b,L)=>{tot[k]=(tot[k]||0)+b;(perL[L]=perL[L]||{})[k]=(perL[L][k]||0)+b;};
for(const [L,R,ox,oz] of MIX)for(let j=-R;j<R;j++)for(let i=-R;i<R;i++){
  const n=w.node(L,ox+i,oz+j,opts);count[L]=(count[L]||0)+1;
  for(const s of n.slices){add('blockMesh',s.buffer.byteLength,L);if(s.smooth){add('smoothMesh',s.smooth.buffer.byteLength,L);if(s.smooth.indices)add('smoothIndex',s.smooth.indices.byteLength,L);}}
  for(const [k,v] of Object.entries(n))if(v&&ArrayBuffer.isView(v))add(k,v.byteLength,L);
}
const all=Object.values(tot).reduce((a,b)=>a+b,0),nodes=Object.values(count).reduce((a,b)=>a+b,0);
console.log(`${nodes} nodes, ${(all/1048576).toFixed(1)} MiB`);
for(const [k,b] of Object.entries(tot).sort((a,b)=>b[1]-a[1]))console.log(`  ${k.padEnd(14)} ${(b/1048576).toFixed(2).padStart(7)} MiB ${(100*b/all).toFixed(1).padStart(5)}%`);
console.log('KiB per node by level (top fields):');
for(const [L,o] of Object.entries(perL))console.log(`  L${L} `+Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,b])=>`${k} ${(b/count[L]/1024).toFixed(1)}`).join(' · '));
