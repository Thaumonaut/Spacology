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
// Gameplay limits (what the walk loop passes): 0.55 m steps, 60° slopes, free drops, deep water.
const game={step:.55,slope:1.7,water:Infinity,drop:Infinity};
assert.ok(canStep(world(x=>x<.1?5:5.5),0,0,.2,0,game),'0.5 m ledges are steppable');
assert.ok(canStep(world(x=>5+x*1.5),0,0,.2,0,game),'60-degree slopes are traversable');
assert.ok(!canStep(world(x=>x<.1?5:8),0,0,.2,0,game),'cliffs still block under game limits');
assert.ok(canStep(world(x=>x<.1?8:5),0,0,.2,0,game),'drops fall instead of blocking');
assert.ok(canStep(world(()=>5,()=>20),0,0,.2,0,game),'deep water is swimmable');
assert.ok(canStep(world(x=>x<.1?5:8),0,0,.2,0,{...game,lift:2.5}),'a mid-air step reaches high ledges');
// Body collision: worlds expose blockingAt for the column's solid voxels.
const wall=Object.assign(world(()=>5),{blockingAt:()=>true});
assert.ok(!canStep(wall,0,0,.2,0,{...game,feet:5}),'solid objects block the body');
const lowWall=Object.assign(world(()=>5),{blockingAt:(x,z,low,high)=>low<5.9&&high>5.9});
assert.ok(!canStep(lowWall,0,0,.2,0,{...game,feet:5}),'a wall at body height blocks');
assert.ok(canStep(lowWall,0,0,.2,0,{...game,feet:6.5}),'airborne feet clear low walls');
const paving=Object.assign(world(()=>5),{blockingAt:(x,z,low)=>low<5.55});
assert.ok(canStep(paving,0,0,.2,0,{...game,feet:5}),'low paving does not read as a wall');
console.log('Walk slope, cliff, step/drop, body collision, shallow/deep water and edge constraints pass');

globalThis.MicroWorld=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');require('../../prototypes/labs/microvoxel-world/voxel-renderer.js');
// A packed, indexed smooth quad (two triangles sharing a diagonal): 10-byte vertices, int16 positions in 1/SMOOTH_Q block.
const R=globalThis.MicroRenderer,Q=MicroWorld.SMOOTH_Q,S=MicroWorld.SMOOTH_STRIDE,buf=new ArrayBuffer(4*S),dv=new DataView(buf);
[[0,4,0],[0,4,32],[32,4,32],[32,4,0]].forEach((p,i)=>{p.forEach((c,k)=>dv.setInt16(i*S+k*2,c*Q,true));dv.setInt8(i*S+7,127);dv.setUint8(i*S+9,2);});
const skirts=R.seamSkirts({buffer:buf,indices:Uint16Array.from([0,1,2,0,2,3]),count:6});assert.equal(skirts.count,24,'skirts cover four perimeter edges, not the shared diagonal');
const sdv=new DataView(skirts.buffer);assert.equal(Math.min(...Array.from({length:skirts.count},(_,i)=>sdv.getInt16(i*S+2,true)/Q)),-4,'skirts extend eight local cells below the seam');
const camera={mode:'walk',x:10,z:-20,eyeY:7,span:32,yaw:.6,lookPitch:-.3,fov:70,viewDistance:600},v=R.cameraView(camera,1.6,1280),p=v.eye.map((x,i)=>x+v.forward[i]*10),q=[...p,1];
const clip=[0,1,2,3].map(k=>q.reduce((sum,x,i)=>sum+x*v.viewProj[i*4+k],0));assert.ok(Math.abs(clip[0])<1e-5&&Math.abs(clip[1])<1e-5);assert.ok(clip[3]>0);assert.ok(Math.abs(v.pixelWorldAt(20)-v.pixelWorldAt(10)*2)<1e-10);
