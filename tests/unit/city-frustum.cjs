'use strict';
// CPU math + WebGL-call doubles only. Does not certify real GL images or FPS.
const assert=require('node:assert/strict'),R=require('../../prototypes/labs/building-lab/renderer.js'),Q=require('../../prototypes/labs/city-lab/city-ray.js'),S=require('../../prototypes/labs/city-lab/city-sparse.js');
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],planes=R.frustumPlanes(identity),box=(lo,hi)=>({lo,hi}),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
assert.equal(planes.length,6);assert.ok(R.intersectsFrustum(box([-.5,-.5,-.5],[.5,.5,.5]),planes));
for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const lo=[-.1,-.1,-.1],hi=[.1,.1,.1];lo[axis]=sign===1?1:-2;hi[axis]=sign===1?2:-1;
  assert.ok(R.intersectsFrustum(box(lo,hi),planes),'edge touch on every clip plane is retained');lo[axis]+=sign*.01;hi[axis]+=sign*.01;assert.equal(R.intersectsFrustum(box(lo,hi),planes),false,'strictly outside every clip plane is rejected');
}
assert.ok(R.intersectsFrustum(box([1.00001,0,0],[2,1,1]),planes),'float32 transform roundoff retained');
for(const matrix of [null,[],new Array(16).fill(0),identity.map((v,i)=>i===0?NaN:v),identity.map((v,i)=>i===3?Infinity:v)])assert.equal(R.frustumPlanes(matrix),null);
for(const bounds of [null,{},box([NaN,0,0],[1,1,1]),box([2,0,0],[1,1,1])])assert.ok(R.intersectsFrustum(bounds,planes));
for(const invalid of [null,[],[[0,0,0,-10],...planes.slice(1)],[[NaN,0,0,0],...planes.slice(1)]])assert.ok(R.intersectsFrustum(box([10,10,10],[20,20,20]),invalid),'invalid frusta fail open');
const near=1,far=20,perspective=[1,0,0,0,0,1,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0],pPlanes=R.frustumPlanes(perspective);
assert.ok(R.intersectsFrustum(box([-1,-1,-10],[1,1,-2]),pPlanes));assert.equal(R.intersectsFrustum(box([-1,-1,2],[1,1,3]),pPlanes),false);assert.equal(R.intersectsFrustum(box([12,0,-5],[14,1,-4]),pPlanes),false);
assert.ok(R.intersectsFrustum(box([-1,-1,-1],[1,1,-.5]),pPlanes),'near-plane edge remains visible');assert.ok(R.intersectsFrustum(box([-1,-1,-21],[1,1,-20]),pPlanes),'far-plane edge remains visible');
// Actual sparse crop contract: o already includes vertical model translation.
const dims=[24,24,24],vol=new Uint8Array(24**3);for(let y=8;y<16;y++)for(let z=8;z<16;z++)for(let x=8;x<16;x++)vol[x+24*(z+24*y)]=1;
const model=[0,0,1,0,0,1,0,0,-1,0,0,0,12,3,-8,1],cropped=S.fromVolume({dims,vol,cell:.0625,palette:new Uint8Array(1024),M:{}},model),bounds=Q.worldBounds(cropped);
for(const [got,want] of [[bounds.lo,[11,3.5,-7.5]],[bounds.hi,[11.5,4,-7]]])got.forEach((v,i)=>close(v,want[i]));
for(const rot of [0,Math.PI/2,-Math.PI/2,.73,Math.PI]){
  const v={...cropped,frame:{x:12,z:-8,rot}},b=Q.worldBounds(v);
  for(const x of [v.o[0],v.o[0]+v.n[0]*v.cvs])for(const y of [v.o[1],v.o[1]+v.n[1]*v.cvs])for(const z of [v.o[2],v.o[2]+v.n[2]*v.cvs]){
    const point=[12+x*Math.cos(rot)-z*Math.sin(rot),y,-8+x*Math.sin(rot)+z*Math.cos(rot)];assert.ok(point.every((a,i)=>a>=b.lo[i]-1e-10&&a<=b.hi[i]+1e-10),'rotated padded corners include every possible eave/window voxel');
  }
}
assert.equal(Q.worldBounds({...cropped,frame:{x:NaN,z:0,rot:0}}),null);
for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2,.45])for(const walking of [false,true]){
  const s={yaw,pitch:.4,dist:50,target:[20,10,30],walkEye:walking?[1,2,3]:null},f=R.cameraForward(s);close(Math.hypot(...f),1);close(f[0],Math.sin(yaw)*(walking?1:-1));close(f[1],Math.cos(yaw));
}
assert.equal(R.cameraForward({yaw:NaN,pitch:0,dist:1,target:[0,0,0]}),undefined);
function mockGL({timer=false}={}){
  const calls=[],opts={available:false,disjoint:false,ns:3000000},counts={queries:0,resultReads:0},methods={
    getParameter:n=>n==='GPU_DISJOINT_EXT'?opts.disjoint:4096,getExtension:()=>timer?{TIME_ELAPSED_EXT:'TIME_ELAPSED_EXT',GPU_DISJOINT_EXT:'GPU_DISJOINT_EXT'}:null,
    getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(p,n)=>{calls.push(['getUniformLocation',n]);return {p,n};},
    getQueryParameter(q,p){if(p==='QUERY_RESULT_AVAILABLE')return opts.available;assert.ok(opts.available,'GPU result read must never block');counts.resultReads++;return opts.ns;},
    createQuery(){counts.queries++;return {};}
  };
  const gl=new Proxy(methods,{get(target,key){if(key in target)return target[key];if(/^[A-Z0-9_]+$/.test(key))return key;return (...args)=>{calls.push([key,...args]);return key.startsWith('create')?{}:undefined;};}});return {gl,calls,opts,counts};
}
const volume=(x=0,z=0)=>({n:[1,1,1],o:[0,0,0],cvs:.25,frame:{x,z,rot:0},coarse:new Uint16Array(1),bricks:new Uint8Array(4096),pal:new Uint8Array(1024),brickRows:4,bytes:5122});
{
  const {gl,calls}=mockGL(),ray=Q.create(gl,()=>({}),R);const visible=volume(),offscreen=volume(10);ray.put('visible',visible);ray.put('caster',offscreen);const bytes=ray.bytes(),uniformLookups=calls.filter(c=>c[0]==='getUniformLocation').length;
  assert.equal(ray.draw(identity,[0,1,0],[0,0,0],identity,{},1/2048),1,'view culls offscreen volume');
  const light=identity.slice();light[0]=.05;assert.equal(ray.draw(light,[0,1,0],null),2,'light frustum retains offscreen shadow caster');
  assert.equal(ray.bytes(),bytes);assert.equal(ray.count(),2,'culling does not evict resident volume');assert.equal(calls.filter(c=>c[0]==='deleteTexture').length,0);
  const turned=identity.slice();turned[12]=-10;assert.equal(ray.draw(turned,[0,1,0],[0,0,0],identity,{},1),1,'turn can draw the resident side volume without upload');
  // Mutating the transferred metadata cannot invalidate cached bounds/transforms.
  visible.frame.x=100;visible.o[0]=100;visible.n[0]=100;assert.equal(ray.draw(identity,[0,1,0],[0,0,0],identity,{},1),1);
  assert.equal(calls.filter(c=>c[0]==='getUniformLocation').length,uniformLookups,'uniform locations cached, not queried per draw');
  assert.equal(ray.draw(new Array(16).fill(0),[0,1,0],null),2,'invalid frustum draws all enabled volumes');
  ray.setVisible('visible',false);assert.equal(ray.enabledCount(),1);assert.equal(ray.draw(identity,[0,1,0],[0,0,0],identity,{},1),0);ray.drop('caster');assert.equal(ray.count(),1);ray.clear();assert.equal(ray.bytes(),0);assert.equal(calls.filter(c=>c[0]==='deleteTexture').length,6);
}
// Exercise the actual shared renderer counters/shadow cache and asynchronous
// timer contract with call doubles, including hard vs soft mesh attributes.
const oldWindow=global.window,oldRay=global.CityRay;global.window={devicePixelRatio:1};global.CityRay=Q;
try{
  for(const timer of [false,true]){
    const h=mockGL({timer}),renderer=R.createRenderer({clientWidth:600,clientHeight:400,getContext:()=>h.gl}),mesh={id:'hard',verts:new Uint16Array(12),idx:new Uint32Array([0,1,2]),quads:1},soft={...mesh,id:'soft',normals:new Float32Array(9)};
    renderer.setScene([mesh,soft],100,new Uint8Array(1024));renderer.putRay('visible',volume(0,3));renderer.putRay('behind',volume(0,-3));Object.assign(renderer.state,{walkEye:[0,0,0],yaw:0,pitch:0,dist:10});
    renderer.draw();const s=renderer.state;assert.equal(s.rayResidents,2);assert.equal(s.rayDraws,1);assert.equal(s.shadowRayDraws,2);assert.equal(s.mainDrawCalls,3);assert.equal(s.shadowDrawCalls,4);assert.equal(s.totalDrawCalls,8);assert.equal(s.triangles,2);assert.equal(s.mainTriangles,14);assert.equal(s.shadowTriangles,26);assert.equal(s.totalTriangles,41);assert.equal(s.uploads.meshCalls,2);assert.equal(s.uploads.rayCalls,2);assert.ok(s.uploads.meshCpuMs>=0&&s.uploads.rayCpuMs>=0);assert.equal(s.segments[0].soft,false);assert.equal(s.segments[1].soft,true);
    renderer.draw();assert.ok(s.shadowCached);assert.equal(s.shadowDrawCalls,0);assert.equal(s.shadowRayDraws,0);assert.equal(s.totalDrawCalls,4);assert.equal(s.gpuTimingSupported,timer);
    if(timer){
      for(let i=0;i<6;i++)renderer.draw();assert.equal(h.counts.queries,4,'outstanding GPU timer queries bounded');assert.equal(h.counts.resultReads,0);assert.equal(s.gpuFrameMs,null);
      h.opts.available=true;renderer.draw();assert.equal(s.gpuFrameMs,3);assert.equal(h.counts.resultReads,4);const reads=h.counts.resultReads;h.opts.disjoint=true;renderer.draw();assert.equal(s.gpuFrameMs,null);assert.equal(h.counts.resultReads,reads,'disjoint results discarded without read');
    }else assert.equal(h.counts.queries,0);
    const originalError=h.gl.getError;h.gl.getError=()=>1285;
    const deleted=h.calls.filter(c=>c[0]==='deleteTexture').length;
    assert.throws(()=>renderer.putRay('visible',volume()),/GL error/);assert.equal(renderer.rayBytes(),10244,'failed replacement retains both old ray models');assert.equal(h.calls.filter(c=>c[0]==='deleteTexture').length,deleted+3,'failed replacement frees partial textures');
    assert.throws(()=>renderer.putRay('hard',volume()),/GL error/);assert.ok(s.segments.some(m=>m.id==='hard'),'failed sparse upload retains old mesh');
    const oldMesh=s.segments.find(m=>m.id==='hard'),oldBuffers=h.calls.filter(c=>c[0]==='deleteBuffer').length;assert.throws(()=>renderer.putMesh(mesh),/GL error/);assert.equal(s.segments.find(m=>m.id==='hard'),oldMesh,'failed mesh replacement retains old resident');assert.equal(h.calls.filter(c=>c[0]==='deleteBuffer').length,oldBuffers+2,'partial mesh buffers released');
    assert.throws(()=>renderer.putMesh({...mesh,id:'visible'}),/GL error/);assert.equal(renderer.rayBytes(),10244,'failed mesh replacement retains old sparse textures');h.gl.getError=originalError;
    renderer.setVisible('visible',false);renderer.draw();assert.equal(s.rayResidents,2);assert.equal(s.rayEnabled,1);assert.equal(s.rayDraws,0);renderer.dropMesh('behind');assert.equal(renderer.rayBytes(),5122);renderer.setScene([],10,new Uint8Array(1024));assert.equal(renderer.rayBytes(),0);assert.equal(s.uploads.rayCalls,0,'scene timing counters reset at rebuild');
    const building={dims:[8,8,8],vol:new Uint8Array(8**3).fill(1),levels:[0,5],plate:6,cell:.0625,palette:new Uint8Array(1024),M:{lantern_glow:1,shoji:2},info:{brackets:[]}},summary=renderer.setBuilding(building);assert.equal(summary.segments.length,2);assert.deepEqual(summary.segments.map(s=>s.label),['floor 0','roof']);assert.equal(s.uploads.meshCalls,2);s.walkEye=null;s.visible=1;renderer.draw();assert.equal(s.mainDrawCalls,1,'Building Lab cutaway visible-floor contract retained');assert.equal(s.shadowDrawCalls,1);assert.equal(renderer.rayBytes(),0);
    assert.equal(h.calls.filter(c=>c[0]==='finish').length,0,'timing never blocks on gl.finish');
  }
}finally{if(oldWindow===undefined)delete global.window;else global.window=oldWindow;if(oldRay===undefined)delete global.CityRay;else global.CityRay=oldRay;}
console.log('conservative view/light sparse culling, cropped/rotated bounds, edge touches/fail-open, camera yaw, resident/call/triangle/upload counters and bounded nonblocking GPU timer contracts (CPU doubles only)');
