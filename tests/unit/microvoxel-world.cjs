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
for(const [x,z] of [[-1,64],[128,64],[64,-1],[64,128]])assert.equal(w.ground(x,z),null,'off-map ground cannot block a pick ray');
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
const fine=M.createWorld(2718,.125),fineChunk=fine.generateChunk(4,7);
assert.equal(fine.chunkMetres,w.chunkMetres);assert.equal(fine.heightMetres,w.heightMetres);
assert.equal(fine.chunkCells,w.chunkCells*2);assert.equal(fine.heightCells,w.heightCells*2);
assert.equal(fine.id,w.id);assert.equal(fine.deposit.id,w.deposit.id);assert.notEqual(fine.dataId,w.dataId);
for(const field of ['x','z','rule','geology'])assert.equal(fine.deposit[field],w.deposit[field],'resource meaning and map position do not move');
assert.equal(fine.ground(49,58),8);assert.equal(fine.column(0,0).length,192);
const region=M.createWorld(2718,.25,256),regionFine=M.createWorld(2718,.125,256);
assert.equal(region.extent,256);assert.equal(region.chunkMetres,w.chunkMetres);assert.equal(region.deposit.id,w.deposit.id);assert.deepEqual(region.deposit,w.deposit);
assert.notEqual(region.dataId,w.dataId,'chunk identity includes footprint: old edge halos differ');
assert.equal(regionFine.extent,256);assert.equal(regionFine.deposit.id,fine.deposit.id);assert.notEqual(regionFine.dataId,region.dataId);
for(const [cx,cz] of [[4,7],[15,15],[0,0]])assert.deepEqual(region.generateChunk(cx,cz),w.generateChunk(cx,cz),'expanding the world does not change existing voxel ground or vegetation');
for(const [gx,gz] of [[0,0],[8,6],[25,25]])assert.deepEqual(region.tree(gx,gz),w.tree(gx,gz));
for(const [x,z] of [[128,64],[128.125,128.125],[225,195],[255.875,255.875]])assert.notEqual(region.ground(x,z),null,'expanded bounds contain geography');
for(const [x,z] of [[256,100],[64,256],[-1,20]])assert.equal(region.ground(x,z),null);
assert.ok(region.generateChunk(24,24).materials.some(m=>m!==M.MAT.air),'newly explored ground is inhabited');
assert.deepEqual(region.generateChunk(20,20),M.createWorld(2718,.25,256).generateChunk(20,20),'regional chunk order and reload are deterministic');
const border=region.generateChunk(15,16);coverage(M.meshChunk(region,border,4));coverage(M.meshChunk(region,region.generateChunk(16,16),4));
const variantSeeds=[0,1,39,2718,4294967295];
assert.ok(new Set(variantSeeds.map(seed=>M.createWorld(seed,.25,256).ground(195,195))).size>1,'seed changes generated terrain in the extended region');
for(const seed of variantSeeds){const current=M.createWorld(seed,.25,256),again=M.createWorld(seed,.25,256);assert.deepEqual(current.deposit,again.deposit);assert.ok(current.geography(current.deposit.x,current.deposit.z).exposed);assert.deepEqual(current.generateChunk(19,22),again.generateChunk(19,22));}
assert.throws(()=>M.createWorld(2718,.25,512));
assert.throws(()=>M.createWorld(2718,.1));assert.throws(()=>M.meshChunk(fine,forward[0]));
const transitions=new M.BudgetCache(3,30),transitionDisposals=[];
transitions.dispose=value=>transitionDisposals.push(value.name);
for(const name of ['old:a','old:b','old:c'])transitions.set(name,{name,bytes:10});
for(const name of ['a','b','c']){
  const retain=['a','b','c'].filter(n=>n!==name).map(n=>transitions.items.has('new:'+n)?'new:'+n:'old:'+n);
  transitions.set('new:'+name,{name:'new:'+name,bytes:10},retain);
  assert.ok(['a','b','c'].every(n=>transitions.items.has('old:'+n)||transitions.items.has('new:'+n)),'every old chunk remains covered as its replacement arrives');
}
assert.deepEqual([...transitions.items.keys()].sort(),['new:a','new:b','new:c']);assert.deepEqual(transitionDisposals,['old:a','old:b','old:c']);
assert.ok(fineChunk.bytes<fine.chunkCells*fine.chunkCells*fine.heightCells*.2);
for(let z=0;z<fineChunk.size;z++)for(let x=0;x<fineChunk.size;x++){
  const col=fine.column(fineChunk.cx*fineChunk.size+x,fineChunk.cz*fineChunk.size+z);
  for(let y=0;y<fineChunk.height;y++)assert.equal(M.voxel(fineChunk,x,y,z),col[y],'fine runs remain lossless through 192 vertical cells');
}
for(const step of [1,2,4,8])coverage(M.meshChunk(fine,fineChunk,step));
assert.deepEqual(fineChunk,M.createWorld(2718,.125).generateChunk(4,7),'fine chunks regenerate byte-identically');
for(let z=0;z<26;z++)for(let x=0;x<26;x++){
  const a=w.tree(x,z),b=fine.tree(x,z);assert.equal(!!a,!!b);
  if(a){assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert.equal(a.height*w.cell,b.height*fine.cell);assert.equal(a.radius*w.cell,b.radius*fine.cell);}
}
const riverZ=58,riverFine=fine.column(Math.floor(M.riverX(riverZ)/fine.cell),Math.floor(riverZ/fine.cell));
assert.equal(riverFine[6/fine.cell-1],M.MAT.water);assert.equal(riverFine[6/fine.cell],M.MAT.air,'water level stays at six metres');
let disposed=[];const cache=new M.BudgetCache(2,10,v=>disposed.push(v.id));
cache.set('a',{bytes:4,id:'a'});cache.set('b',{bytes:4,id:'b'});cache.get('a');cache.set('c',{bytes:4,id:'c'});assert.deepEqual(disposed,['b']);assert.equal(cache.bytes,8);
cache.set('a',{bytes:7,id:'a2'});assert.deepEqual(disposed,['b','a','c']);assert.equal(cache.bytes,7);
assert.equal(cache.set('huge',{bytes:11,id:'huge'}),false);assert.ok(!cache.items.has('huge'));cache.clear();assert.equal(cache.bytes,0);
for(let i=0;i<1000;i++){cache.set(String(i),{id:i,bytes:i%4+1});assert.ok(cache.bytes<=10&&cache.items.size<=2);}
assert.deepEqual(M.movePosition({cx:0,cz:0,x:.125,z:7.875},-.25,.25),{cx:-1,cz:1,x:7.875,z:.125});
assert.deepEqual(M.movePosition({cx:-1,cz:1,x:7.875,z:.125},.25,-.25),{cx:0,cz:0,x:.125,z:7.875});
assert.deepEqual(M.positionAt(-8.125,8.125),{cx:-2,cz:1,x:7.875,z:.125});
for(const c of [-M.MAX_CHUNK,-1000000,-1,0,1,1000000,M.MAX_CHUNK]){
  const p={cx:c,cz:-c||0,x:4,z:4};assert.deepEqual(M.movePosition(M.movePosition(p,.125,-.125),-.125,.125),p,'sub-voxel movement survives at distant chunks');
}
assert.equal(M.movePosition({cx:M.MAX_CHUNK,cz:0,x:7,z:0},10,0).cx,M.MAX_CHUNK);
assert.ok(M.movePosition({cx:M.MAX_CHUNK,cz:-M.MAX_CHUNK,x:7,z:0},10,-10).x<8);
assert.equal(M.movePosition({cx:-M.MAX_CHUNK,cz:0,x:0,z:0},-10,0).x,0);
assert.throws(()=>M.movePosition({cx:.5,cz:0,x:0,z:0}));assert.throws(()=>M.movePosition({cx:0,cz:0,x:NaN,z:0}));
const wild=M.createWorld(2718,.25,'infinite'),wildFine=M.createWorld(2718,.125,'infinite');
assert.notEqual(wild.id,w.id);assert.equal(wild.deposit.id,wildFine.deposit.id);assert.equal(wild.deposit.x,wildFine.deposit.x);assert.equal(wild.deposit.z,wildFine.deposit.z);
const origins=[[-1,-1],[0,0],[1,-1],[1000000,-1000000],[-M.MAX_CHUNK,M.MAX_CHUNK]];
const chunks=origins.map(([x,z])=>wild.generateChunk(x,z));
for(const [index,[cx,cz]] of [...origins.entries()].reverse()){
  const chunk=wild.generateChunk(cx,cz);assert.deepEqual(chunk,chunks[index]);assert.deepEqual(chunk,M.createWorld(2718,.25,'infinite').generateChunk(cx,cz));
  const col=wild.column(cx*wild.chunkCells,cz*wild.chunkCells);assert.ok(col.some(v=>v!==0));assert.equal(wild.ground(cx*8+.125,cz*8+.125),wild.geography(cx*8+.125,cz*8+.125).height*.25);
  for(let y=0;y<chunk.height;y++)assert.equal(M.voxel(chunk,0,y,0),col[y]);
  coverage(M.meshChunk(wild,chunk,4));
}
for(const step of [1,2,4,8])coverage(M.meshChunk(wildFine,wildFine.generateChunk(-1,0),step));
const signedChunk=wild.generateChunk(-1,0),signedMesh=M.meshChunk(wild,signedChunk,1),signedData=new DataView(signedMesh.buffer),neighbour=wild.generateChunk(0,0);
for(let byte=0;byte<signedMesh.buffer.byteLength;byte+=48){
  if(signedData.getUint8(byte+6)!==1||signedData.getUint16(byte,true)!==wild.chunkCells)continue;
  const ys=[],zs=[];for(let v=0;v<6;v++){ys.push(signedData.getUint16(byte+v*8+2,true));zs.push(signedData.getUint16(byte+v*8+4,true));}
  for(let z=Math.min(...zs);z<Math.max(...zs);z++)for(let y=Math.min(...ys);y<Math.max(...ys);y++)assert.equal(M.voxel(neighbour,0,y,z),M.MAT.air,'signed zero boundary has no internal border faces');
}
assert.throws(()=>wild.generateChunk(M.MAX_CHUNK+1,0));
for(let i=0;i<10000;i++)wild.tree(i,-i);
assert.equal(wild.vegetationEntries(),2048,'vegetation memoization cannot accumulate with travel');
assert.deepEqual(wild.generateChunk(-1,-1),chunks[0],'vegetation cache eviction cannot change regenerated material');
const wildFingerprints=[];
for(const seed of [0,1,2,3,7,15,39,2718,4294967295]){
  for(const cell of [.25,.125]){const current=M.createWorld(seed,cell,'infinite'),d=current.deposit;assert.ok(current.column(Math.floor(d.x/cell),Math.floor(d.z/cell)).includes(M.MAT.ore));assert.equal(current.deposit.id,M.createWorld(seed,.25,'infinite').deposit.id);}
  const current=M.createWorld(seed,.25,'infinite');wildFingerprints.push([-200,0,200].flatMap(z=>[-200,0,200].map(x=>current.geography(x,z).riverDistance.toFixed(3))).join(','));
}
assert.equal(new Set(wildFingerprints).size,wildFingerprints.length,'streamed wet corridors vary across seeds');
console.log('PASS microvoxel world: finite fixtures, signed/distant coordinates, regenerated runs and mesh coverage, streamed seed/root identity, bounded vegetation and disposal');
