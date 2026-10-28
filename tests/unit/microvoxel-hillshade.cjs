'use strict';
// Streamed LOD nodes carry hillshade normals (RGBA8: x, z, cavity) so distant terraces light as one slope.
const assert=require('node:assert/strict');
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const w=M.createWorld(2718,M.CELL,'infinite'),N=w.nodeSize,SUN=[-.5,1,.4].map(v=>v/Math.hypot(.5,1,.4));
const ABOVE_GROUND=M.ABOVE_GROUND;
const decode=(n,i,j)=>{const o=(j*N+i)*4,x=n.normals[o]/127.5-1,z=n.normals[o+1]/127.5-1;return {x,z,y:Math.sqrt(Math.max(0,1-x*x-z*z)),cavity:n.normals[o+2]-128};};
const key=v=>Math.max(0,v.x*SUN[0]+v.y*SUN[1]+v.z*SUN[2]);
// Ground surface in blocks for a node column: solid from the bottom up, stopping at the first air gap and ignoring
// trees, spires, stones and arches, so none of them count as ground.
function groundBlock(L,cx,cz){
  const s=2**L,c=w.column(cx*s+(s>>1),cz*s+(s>>1)),solid=m=>m&&!ABOVE_GROUND.has(m&127);let y=0;
  while(y<c.length&&solid(c[y]))y++;
  return Math.floor((y-1)/s)+1;
}

// Flat ground stays flat-lit next to sky isles (5:-1:-6), trees (1:-4:-4, 1:-1:-4) and crystal spires (1:-7:-43, 2:-4:-22).
// The specific nodes move with terrain revisions, so search near each original for one with enough flat ground.
const flatCount=(L,nx,nz)=>{const x0=nx*N,z0=nz*N;let f=0;for(let j=2;j<N-2;j+=5)for(let i=2;i<N-2;i+=5){const h=groundBlock(L,x0+i,z0+j);let ok=true;for(let b=-2;b<=2&&ok;b+=2)for(let a=-2;a<=2&&ok;a+=2)ok=groundBlock(L,x0+i+a,z0+j+b)===h;if(ok)f++;}return f;};
const near=(L,nx,nz)=>{for(let r=0;r<=18;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;if(flatCount(L,nx+dx,nz+dz)>5)return [L,nx+dx,nz+dz];}return [L,nx,nz];};
for(const [L,nx,nz] of [[5,-1,-6],[1,-4,-4],[1,-1,-4],[1,-7,-43],[2,-4,-22]].map(([L,x,z])=>near(L,x,z))){
  const n=w.node(L,nx,nz),x0=nx*N,z0=nz*N;let flat=0,wrong=0;
  for(let j=2;j<N-2;j++)for(let i=2;i<N-2;i++){
    const h=groundBlock(L,x0+i,z0+j);let level=true;
    for(let b=-2;b<=2&&level;b++)for(let a=-2;a<=2&&level;a++)level=groundBlock(L,x0+i+a,z0+j+b)===h;
    if(!level)continue;flat++;const v=decode(n,i,j);
    if(v.y<Math.cos(10*Math.PI/180)||Math.abs(v.cavity)>2)wrong++;
  }
  assert.ok(flat>20,`node ${L}:${nx}:${nz} has flat ground to check (${flat})`);
  assert.equal(wrong,0,`node ${L}:${nx}:${nz}: ${wrong}/${flat} flat columns lit as slopes by isles, trees or spires above them`);
}

// Neighbouring nodes meet without a lighting step: the seam is no harsher than the steps between columns inside a node.
for(const L of [3,5]){
  let seam=0,seams=0,inside=0,insides=0;
  for(let nx=-4;nx<4;nx++){
    const a=w.node(L,nx,-3),b=w.node(L,nx+1,-3);
    for(let j=0;j<N;j++){
      seam+=Math.abs(key(decode(a,N-1,j))-key(decode(b,0,j)));seams++;
      for(let i=0;i<N-1;i++){inside+=Math.abs(key(decode(a,i,j))-key(decode(a,i+1,j)));insides++;}
    }
  }
  assert.ok(seam/seams<=1.5*inside/insides,`L${L} seam step ${(seam/seams).toFixed(3)} vs inside ${(inside/insides).toFixed(3)}`);
}
console.log('microvoxel hillshade: PASS');
