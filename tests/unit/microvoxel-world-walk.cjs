'use strict';
const assert=require('node:assert/strict'),{canStep,surface}=require('../../prototypes/labs/microvoxel-world/walk-camera.js');
const world=(height,water=()=>0)=>({cell:.25,ground:height,geography:(x,z)=>({height:height(x,z)*4,water:water(x,z)*4})});
assert.ok(canStep(world(()=>5),0,0,.2,0),'flat dry terrain is walkable');
assert.ok(canStep(world(x=>5+x*.8),0,0,.2,0),'slopes below 45 degrees remain walkable');
assert.ok(!canStep(world(x=>5+x*1.2),0,0,.2,0),'slopes over 45 degrees block');
assert.ok(!canStep(world(x=>x<.1?5:8),0,0,.2,0),'cliffs cannot be stepped up or down');
assert.ok(!canStep(world(x=>x<.1?8:5),0,0,.2,0));
assert.ok(!canStep(world(()=>5,()=>6.1),0,0,.2,0),'water deeper than 1 m blocks');
assert.ok(canStep(world(()=>5,()=>6),0,0,.2,0),'water exactly 1 m deep remains walkable');
assert.equal(surface(world(()=>5,()=>6.5),0,0).water,1.5);
assert.ok(!canStep(world(x=>x>.1?null:5),0,0,.2,0),'finite-world boundaries block');
console.log('Walk slope, cliff, shallow/deep water and edge constraints pass');

globalThis.MicroWorld=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');require('../../prototypes/labs/microvoxel-world/voxel-renderer.js');
const R=globalThis.MicroRenderer,buf=new ArrayBuffer(6*16),f=new Float32Array(buf),bytes=new Uint8Array(buf);
for(const [i,p] of [[0,[0,4,0]],[1,[0,4,32]],[2,[32,4,32]],[3,[0,4,0]],[4,[32,4,32]],[5,[32,4,0]]]){f.set(p,i*4);bytes[i*16+13]=127;bytes[i*16+15]=2;}
const skirts=R.seamSkirts({buffer:buf,count:6});assert.equal(skirts.count,24,'skirts cover four perimeter edges, not the shared diagonal');
const sf=new Float32Array(skirts.buffer);assert.equal(Math.min(...Array.from({length:skirts.count},(_,i)=>sf[i*4+1])),-4,'skirts extend eight local cells below the seam');
const camera={mode:'walk',x:10,z:-20,eyeY:7,span:32,yaw:.6,lookPitch:-.3,fov:70,viewDistance:600},v=R.cameraView(camera,1.6,1280),p=v.eye.map((x,i)=>x+v.forward[i]*10),q=[...p,1];
const clip=[0,1,2,3].map(k=>q.reduce((sum,x,i)=>sum+x*v.viewProj[i*4+k],0));assert.ok(Math.abs(clip[0])<1e-5&&Math.abs(clip[1])<1e-5);assert.ok(clip[3]>0);assert.ok(Math.abs(v.pixelWorldAt(20)-v.pixelWorldAt(10)*2)<1e-10);
