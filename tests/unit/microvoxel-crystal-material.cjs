'use strict';
const assert=require('node:assert/strict');
globalThis.MicroWorld=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
require('../../prototypes/labs/microvoxel-world/voxel-renderer.js');

const calls=[],gl=new Proxy({
  FRONT:1,BACK:2,CULL_FACE:3,BLEND:4,SRC_ALPHA:5,ONE_MINUS_SRC_ALPHA:6,ONE:7,
  TRIANGLES:8,
}, {get(target,key){
  if(key in target)return target[key];
  return (...args)=>calls.push([key,...args]);
}});
const renderer=Object.create(globalThis.MicroRenderer.prototype);
renderer.gl=gl;renderer.yBase=0;renderer.time=0;renderer.onScreen=()=>true;
renderer.camera={mode:'walk'};renderer.crystalGeom={verts:3};
renderer.crystalProgram=1;renderer.crystalCaster=2;
renderer.cy={};renderer.cyc={};
renderer.queue=[{origin:[0,0,0],dither:[0,0],mesh:{
  crystals:{vao:1,count:1},propMetres:0,
}}];
renderer.draws=0;renderer.triangles=0;
renderer.drawTrees(false,{x:0,z:0,span:32},{cy:0,shadows:false});
const draws=calls.reduce((out,call,i)=>call[0]==='drawArraysInstanced'?[...out,i]:out,[]);
assert.equal(draws.length,1,'crystal body is drawn once, not as translucent front/back passes');
assert.ok(calls.slice(0,draws[0]).some(c=>c[0]==='enable'&&c[1]===gl.CULL_FACE));
assert.equal(calls.slice(0,draws[0]).filter(c=>c[0]==='cullFace').at(-1)[1],gl.BACK);
assert.equal(calls.filter(c=>c[0]==='blendFuncSeparate').length,0,'opaque facets do not blend with the background');
assert.equal(calls.filter(c=>c[0]==='depthMask'&&c[1]===false).length,0,'opaque facets write depth');
console.log('microvoxel crystal material: PASS');
