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
// Lighting height in blocks, as the generator takes it: the exact terrain surface where the ground is bare terrain, else
// the block ground. "Flat" below means level on this height, so gentle slopes inside one block are not counted as flat.
function lightGround(L,cx,cz){
  const s=2**L,b=groundBlock(L,cx,cz),g=w.geography((cx*s+(s>>1)+.5)*M.CELL,(cz*s+(s>>1)+.5)*M.CELL);
  return g.surface!=null&&b===Math.floor((g.height-1)/s)+1?(g.surface/M.CELL+s/2-1)/s:b;
}

// Flat ground stays flat-lit next to sky isles (5:-1:-6), trees (1:-4:-4, 1:-1:-4) and crystal spires (1:-7:-43, 2:-4:-22).
// The specific nodes move with terrain revisions, so search near each original for one with enough flat ground.
const flatCount=(L,nx,nz)=>{const x0=nx*N,z0=nz*N;let f=0;for(let j=2;j<N-2;j+=5)for(let i=2;i<N-2;i+=5){const h=groundBlock(L,x0+i,z0+j);let ok=true;for(let b=-2;b<=2&&ok;b+=2)for(let a=-2;a<=2&&ok;a+=2)ok=groundBlock(L,x0+i+a,z0+j+b)===h;if(ok)f++;}return f;};
// Level columns as the check below counts them (level blocks and level lighting height over +-2 columns).
const levelCount=(L,nx,nz)=>{const x0=nx*N,z0=nz*N;let flat=0;for(let j=2;j<N-2;j++)for(let i=2;i<N-2;i++){const h=groundBlock(L,x0+i,z0+j);let level=true;
  for(let b=-2;b<=2&&level;b++)for(let a=-2;a<=2&&level;a++)level=groundBlock(L,x0+i+a,z0+j+b)===h;if(!level)continue;const e=lightGround(L,x0+i,z0+j);
  for(let b=-2;b<=2&&level;b++)for(let a=-2;a<=2&&level;a++)level=Math.abs(lightGround(L,x0+i+a,z0+j+b)-e)<=.15;if(level)flat++;}return flat;};
const near=(L,nx,nz)=>{for(let r=0;r<=32;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;if(flatCount(L,nx+dx,nz+dz)>8&&levelCount(L,nx+dx,nz+dz)>20)return [L,nx+dx,nz+dz];}return [L,nx,nz];};
for(const [L,nx,nz] of [[5,-1,-6],[1,-4,-4],[1,-1,-4],[1,-7,-43],[2,-4,-22]].map(([L,x,z])=>near(L,x,z))){
  const n=w.node(L,nx,nz),x0=nx*N,z0=nz*N;let flat=0,wrong=0;
  for(let j=2;j<N-2;j++)for(let i=2;i<N-2;i++){
    const h=groundBlock(L,x0+i,z0+j);let level=true;
    for(let b=-2;b<=2&&level;b++)for(let a=-2;a<=2&&level;a++)level=groundBlock(L,x0+i+a,z0+j+b)===h;
    if(!level)continue;const e=lightGround(L,x0+i,z0+j);
    for(let b=-2;b<=2&&level;b++)for(let a=-2;a<=2&&level;a++)level=Math.abs(lightGround(L,x0+i+a,z0+j+b)-e)<=.15;
    if(!level)continue;flat++;const v=decode(n,i,j);
    if(v.y<Math.cos(10*Math.PI/180)||Math.abs(v.cavity)>6)wrong++;
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
// Rock detail (close nodes on bare rock): (2N)² RGBA8, empty at L>=3, and seamless across node borders:
// the normal step across a seam is no harsher than between neighbouring texels inside a node.
{
  const D=2*N,dec=(r,a,b)=>{const o=(b*D+a)*4,x=r[o]/127.5-1,z=r[o+1]/127.5-1;return {x,z,y:Math.sqrt(Math.max(0,1-x*x-z*z))};};
  // A bare-rock mountain spot: layouts move with terrain revisions, so scan for four L1 nodes in a row that all carry detail.
  const L=1,s=2**L,span=N*M.CELL*s;let RX=null,RZ=null;
  for(let k=0;k<4000&&RX===null;k++){const x=((k*7919)%140-70)*200,z=((k*104729)%70-40)*200,g=w.geography(x,z);if(g.sea||!(g.relief>150)||g.cone>5||!g.exposed)continue;
    const nx=Math.floor(x/span),nz=Math.floor(z/span);let ok=true;for(let q=0;q<4&&ok;q++)ok=w.node(L,nx+q,nz).rockDetail.length===4*N*N*4;if(ok){RX=x;RZ=z;}}
  assert.ok(RX!==null,'found a bare-rock mountain spot');
  const nz=Math.floor(RZ/span),nx0=Math.floor(RX/span);
  assert.equal(w.node(3,Math.floor(RX/(N*M.CELL*8)),Math.floor(RZ/(N*M.CELL*8))).rockDetail.length,0,'no rock detail at L3+');
  let seam=0,seams=0,inside=0,insides=0,rock=0;
  for(let nx=nx0;nx<nx0+3;nx++){
    const a=w.node(L,nx,nz).rockDetail,b=w.node(L,nx+1,nz).rockDetail;assert.equal(a.length,D*D*4,'mountain nodes carry rock detail');
    for(let j=0;j<D;j++){
      if(a[(j*D+D-1)*4+3]<200||b[(j*D)*4+3]<200)continue;rock++;
      seam+=Math.abs(key(dec(a,D-1,j))-key(dec(b,0,j)));seams++;
      for(let i=0;i<D-1;i++){inside+=Math.abs(key(dec(a,i,j))-key(dec(a,i+1,j)));insides++;}
    }
  }
  assert.ok(rock>20,`rock seams to check (${rock})`);
  assert.ok(seam/seams<=1.5*inside/insides,`rock detail seam step ${(seam/seams).toFixed(3)} vs inside ${(inside/insides).toFixed(3)}`);
}
console.log('microvoxel hillshade: PASS');
