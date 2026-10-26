'use strict';
// Painted ground (?ground=paint): a node's groundMat is a (NODE+4)² grid of ground-top materials, index i holding local
// column i-2, so the shader can look two columns past the node edge. A halo column must hold the same material as the
// neighbouring node's interior column for that world column, at every level, or the two sides paint different
// materials at the same point along the seam.
const assert=require('node:assert/strict');
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const spots=[[203749,1079,1017],[2718,500,500]];
for(const [seed,x,z] of spots){
  const w=M.createWorld(seed,M.CELL,'infinite'),N=w.nodeSize,G=N+4;
  for(const L of [0,1,2,3]){
    const m=w.nodeMetres(L),nx=Math.floor(x/m),nz=Math.floor(z/m);
    const A=w.node(L,nx,nz,{smooth:true,props:false}).groundMat,B=w.node(L,nx+1,nz,{smooth:true,props:false}).groundMat;
    assert.equal(A.length,G*G);
    let bad=0,first='';
    // A's +x halo columns (local N, N+1) are B's interior columns 0, 1; B's -x halo columns (-2, -1) are A's N-2, N-1.
    for(let j=1;j<G-1;j++)for(const [a,b] of [[A[j*G+G-2],B[j*G+2]],[A[j*G+G-1],B[j*G+3]],[B[j*G],A[j*G+G-4]],[B[j*G+1],A[j*G+G-3]]])
      if(a!==b){bad++;if(!first)first=`row ${j}: halo ${a} vs interior ${b}`;}
    assert.equal(bad,0,`seed ${seed} L${L} node ${nx},${nz}: ${bad} halo columns disagree with the neighbour's interior (${first})`);
  }
}
