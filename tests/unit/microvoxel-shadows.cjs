'use strict';
// The sun's shadow box covers every visible ground point, including slopes rising far above the view centre.
const assert=require('node:assert/strict');
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
globalThis.MicroWorld=M;require('../../prototypes/labs/microvoxel-world/voxel-renderer.js');
const R=globalThis.MicroRenderer.prototype,w=M.createWorld(2718,M.CELL,'infinite');
// Sun-view axes (right, up, away from the sun) for the renderer's sun direction (-.5, 1, .4).
const sun=[-.5,1,.4].map(v=>v/Math.hypot(.5,1,.4)),f=sun.map(v=>-v),r=[f[2],0,-f[0]].map(v=>v/Math.hypot(f[2],f[0]));
const axes=[...r,r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0],...f];
const width=1280,height=676,view={aspect:width/height,bounds:R.bounds,canvas:{getBoundingClientRect:()=>({left:0,top:0,width,height})}};
// A steep site (chunk 834, 396) where the ground climbs ~100 m above the view centre within a close view.
const x0=834*8+5.1,z0=396*8+2.35;
for(const span of [16,32,64]){
  const camera={x:x0,z:z0,y:w.ground(x0,z0),span},world={heightMetres:w.heightMetres,ground:(x,z)=>w.ground(x,z)};
  const points=[];
  for(let j=0;j<=12;j++)for(let i=0;i<=12;i++){const hit=R.pick.call(view,camera,width*i/12,height*j/12,world);if(hit.y>0)points.push(hit);}
  const top=Math.max(...points.map(p=>p.y)),box=R.lightBox.call(view,camera,2048,top);
  const outside=points.filter(p=>[0,1,2].some(k=>Math.abs((p.x-box.at[0])*axes[k*3]+(p.y-box.at[1])*axes[k*3+1]+(p.z-box.at[2])*axes[k*3+2])>box.half[k]));
  assert.ok(points.length>100,`span ${span}: sampled visible ground`);
  assert.equal(outside.length,0,`span ${span}: ${outside.length}/${points.length} visible ground points lie outside the shadow box (top ${top.toFixed(1)} m)`);
}
console.log('microvoxel shadows: PASS');
