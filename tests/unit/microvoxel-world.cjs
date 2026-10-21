'use strict';
const assert=require('node:assert/strict');
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const w=M.createWorld(2718),denseBytes=M.CHUNK*M.CHUNK*M.HEIGHT;
for(const seed of [0,1,2,3,39,2718,4294967295]){
  const a=M.createWorld(seed),b=M.createWorld(seed),d=a.deposit;
  assert.deepEqual(d,b.deposit);assert.ok(Object.isFrozen(a));assert.ok(Object.isFrozen(d));
  assert.equal(d.id,`${a.id}:ore:root`);assert.equal(d.y,a.ground(d.x,d.z));
  const g=a.geography(d.x,d.z);assert.ok(g.exposed&&g.fault<1);assert.ok(g.riverDistance>9);
  assert.equal(a.ground(49,58),8);assert.equal(a.ground(49.01,58.02),8);
  assert.ok(a.ground(25,58)>a.ground(49,58));assert.ok(a.ground(M.riverX(58),58)<6);
  assert.notEqual(a.id,M.createWorld(seed+1).id);
}
const positions=[[4,7],[5,7],[9,7],[6,5],[12,12]],forward=positions.map(([x,z])=>w.generateChunk(x,z));
const other=M.createWorld(2718);
const reverse=[...positions].reverse().map(([x,z])=>other.generateChunk(x,z)).reverse();
for(let i=0;i<forward.length;i++){
  const c=forward[i];assert.deepEqual(c,reverse[i],'request order independent');
  assert.ok(c.bytes<denseBytes*.2,'RLE is substantially smaller than a dense material volume');
  for(let z=0;z<M.CHUNK;z++)for(let x=0;x<M.CHUNK;x++){
    const col=w.column(c.cx*M.CHUNK+x,c.cz*M.CHUNK+z);
    for(let y=0;y<M.HEIGHT;y++)assert.equal(M.voxel(c,x,y,z),col[y],'lossless runs including vegetation/air');
    const h=w.ground((c.cx*M.CHUNK+x+.1)*M.CELL,(c.cz*M.CHUNK+z+.1)*M.CELL)/M.CELL;
    assert.ok(col[h-1]!==0&&col[h-1]!==M.MAT.water,'ground and occupancy agree');
  }
}
assert.deepEqual(w.generateChunk(5,7),forward[1],'regeneration is byte-identical');
assert.ok(w.generateChunk(-1,-1).materials.every(m=>m===0),'out of bounds is empty');
assert.throws(()=>w.generateChunk(.5,0));assert.throws(()=>M.meshChunk(w,forward[0],3));
function coverage(mesh){
  const data=new DataView(mesh.buffer);let area=0;
  for(let byte=0;byte<mesh.buffer.byteLength;byte+=48){
    const normal=data.getUint8(byte+6),axis=Math.floor(normal/2),material=data.getUint8(byte+7),coordinates=[[],[],[]];
    assert.ok(material>0&&material<M.COLORS.length);assert.ok(normal<6);
    for(let v=0;v<6;v++)for(let a=0;a<3;a++)coordinates[a].push(data.getUint16(byte+v*8+a*2,true));
    assert.equal(new Set(coordinates[axis]).size,1,'merged quad stays planar');
    const lengths=coordinates.map(a=>Math.max(...a)-Math.min(...a)).filter(n=>n>0);assert.equal(lengths.length,2);area+=lengths[0]*lengths[1];
  }
  assert.equal(area,mesh.exposedFaces,'greedy rectangles cover every face exactly');
  assert.equal(mesh.buffer.byteLength,mesh.quads*48,'8 byte vertices, no per-voxel meshes');
  assert.equal(mesh.count,mesh.quads*6);assert.ok(mesh.quads<=mesh.exposedFaces);
}
for(const c of forward)for(const step of [1,2,4]){
  const mesh=M.meshChunk(w,c,step);coverage(mesh);
  assert.deepEqual(new Uint8Array(mesh.buffer),new Uint8Array(M.meshChunk(w,w.generateChunk(c.cx,c.cz),step).buffer),'mesh stable after regeneration');
}
for(const c of forward.slice(0,2)){
  const neighbours=new Map(),sample=(x,y,z)=>{
    if(y<0||y>=M.HEIGHT)return 0;
    if(x>=0&&x<M.CHUNK&&z>=0&&z<M.CHUNK)return M.voxel(c,x,y,z);
    const key=`${x}:${z}`;if(!neighbours.has(key))neighbours.set(key,w.column(c.cx*M.CHUNK+x,c.cz*M.CHUNK+z));return neighbours.get(key)[y];
  };
  let faces=0;for(let z=0;z<M.CHUNK;z++)for(let x=0;x<M.CHUNK;x++)for(let y=0;y<M.HEIGHT;y++)if(sample(x,y,z))for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])if(!sample(x+dx,y+dy,z+dz))faces++;
  assert.equal(M.meshChunk(w,c).exposedFaces,faces,'independent brute-force surface count');
}
// Adjacent chunks sample actual neighbour occupancy, not an empty halo at every edge.
for(const [c,side] of [[forward[0],1],[forward[1],0]]){
  const mesh=M.meshChunk(w,c,1),data=new DataView(mesh.buffer);
  for(let byte=0;byte<mesh.buffer.byteLength;byte+=48){
    const face=data.getUint8(byte+6);if(face!==side)continue;
    const x=data.getUint16(byte,true);if(x!==(side?M.CHUNK:0))continue;
    const ys=[],zs=[];for(let v=0;v<6;v++){ys.push(data.getUint16(byte+v*8+2,true));zs.push(data.getUint16(byte+v*8+4,true));}
    for(let z=Math.min(...zs);z<Math.max(...zs);z++)for(let y=Math.min(...ys);y<Math.max(...ys);y++){
      const inside=side?M.CHUNK-1:0,outside=side?M.CHUNK:-1;
      assert.ok(M.voxel(c,inside,y,z)>0);assert.equal(w.column(c.cx*M.CHUNK+outside,c.cz*M.CHUNK+z)[y],0,'no internal border faces');
    }
  }
}
const clearing=w.generateChunk(6,7),coarse=M.meshChunk(w,clearing,4),dv=new DataView(coarse.buffer);
assert.ok(Array.from({length:coarse.count},(_,i)=>dv.getUint8(i*8+7)).includes(M.MAT.grass),'coarse render preserves grass, not buried soil');
let disposed=[];const cache=new M.BudgetCache(2,10,v=>disposed.push(v.id));
cache.set('a',{bytes:4,id:'a'});cache.set('b',{bytes:4,id:'b'});cache.get('a');cache.set('c',{bytes:4,id:'c'});assert.deepEqual(disposed,['b']);assert.equal(cache.bytes,8);
cache.set('a',{bytes:7,id:'a2'});assert.deepEqual(disposed,['b','a','c']);assert.equal(cache.bytes,7);
assert.equal(cache.set('huge',{bytes:11,id:'huge'}),false);assert.ok(!cache.items.has('huge'));cache.clear();assert.equal(cache.bytes,0);
for(let i=0;i<1000;i++){cache.set(String(i),{id:i,bytes:i%4+1});assert.ok(cache.bytes<=10&&cache.items.size<=2);}
console.log('PASS microvoxel world: stable seeds/provenance, lossless runs, ground agreement, greedy face coverage, seam ownership, LOD material and bounded disposal');
