#!/usr/bin/env node
'use strict';
// Smooth-terrain mesh packing study over the same node mix as packing-survey.cjs: how many vertices are repeats
// (triangle soup), the per-slice position range, and the error and size of quantized/indexed encodings.
//   node tools/packing-smooth.cjs [model.js]
const path=require('node:path');
const M=require(path.resolve(process.argv[2]||path.join(__dirname,'../prototypes/labs/microvoxel-world/voxel-world-model.js')));
const w=M.createWorld(2718,.25,'infinite'),opts={smooth:true,props:true,treeObjects:true};
const MIX=[[0,4,0,0],[1,3,0,0],[2,2,0,0],[3,2,0,0],[4,1,0,0],[5,1,0,0],[6,1,0,0],[7,1,0,0],[0,3,-52,-57],[2,2,-13,-14],[4,1,-4,-4]];
let verts=0,unique=0,bytes=0,maxSpan=[0,0,0],posErr=0,nrmErr=0,slices=0;
const oct=(x,y,z)=>{const l=Math.abs(x)+Math.abs(y)+Math.abs(z);let u=x/l,v=z/l;if(y<0){const a=(1-Math.abs(v))*Math.sign(u||1),b=(1-Math.abs(u))*Math.sign(v||1);u=a;v=b;}return [u,v];};
const unoct=(u,v)=>{let y=1-Math.abs(u)-Math.abs(v),x=u,z=v;if(y<0){x=(1-Math.abs(v))*Math.sign(u||1);z=(1-Math.abs(u))*Math.sign(v||1);}const l=Math.hypot(x,y,z);return [x/l,y/l,z/l];};
for(const [L,R,ox,oz] of MIX)for(let j=-R;j<R;j++)for(let i=-R;i<R;i++)for(const s of w.node(L,ox+i,oz+j,opts).slices){
  if(!s.smooth?.count)continue;slices++;const f=new Float32Array(s.smooth.buffer),b=new Int8Array(s.smooth.buffer),n=s.smooth.count,seen=new Map();bytes+=s.smooth.buffer.byteLength;
  for(let v=0;v<n;v++){const o=v*4,x=f[o],y=f[o+1],z=f[o+2],nx=b[o*4+12]/127,ny=b[o*4+13]/127,nz=b[o*4+14]/127,m=b[o*4+15]&255;verts++;
    for(const [a,c] of [[0,x],[1,y],[2,z]])maxSpan[a]=Math.max(maxSpan[a],Math.abs(c));
    const k=`${x},${y},${z},${nx},${ny},${nz},${m}`;if(!seen.has(k)){seen.set(k,1);unique++;}
    // int16 positions at 1/1024 block, octahedral normal in 2 bytes.
    for(const c of [x,y,z])posErr=Math.max(posErr,Math.abs(Math.round(c*1024)/1024-c));
    const l=Math.hypot(nx,ny,nz)||1,[u,vv]=oct(nx/l,ny/l,nz/l),[qx,qy,qz]=unoct(Math.round(u*127)/127,Math.round(vv*127)/127);nrmErr=Math.max(nrmErr,Math.acos(Math.min(1,(qx*nx+qy*ny+qz*nz)/l))*180/Math.PI);
  }}
const packedV=8,idx=4;
console.log(`slices ${slices}, vertices ${verts}, unique ${unique} (${(verts/unique).toFixed(2)}x repeats), now ${(bytes/1048576).toFixed(2)} MiB at 16 B/vertex`);
console.log(`position range per slice (blocks): x ${maxSpan[0].toFixed(1)} y ${maxSpan[1].toFixed(1)} z ${maxSpan[2].toFixed(1)}`);
console.log(`int16 positions at 1/1024 block: max error ${posErr.toExponential(2)} blocks; octahedral 2-byte normal: max ${nrmErr.toFixed(2)} deg`);
console.log(`packed soup (8 B/vertex): ${(verts*packedV/1048576).toFixed(2)} MiB; indexed packed (8 B/unique + ${idx} B/index): ${((unique*packedV+verts*idx)/1048576).toFixed(2)} MiB; indexed with 2 B indices where < 65536: ${((unique*packedV+verts*2)/1048576).toFixed(2)} MiB`);
