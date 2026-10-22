'use strict';
// The version query bypasses stale browser/service-worker copies; bump it with generator revisions.
importScripts('voxel-world-model.js?v=wilds-13-render');
let world,cache;
self.onmessage=({data})=>{
  const {seed,cell=MicroWorld.CELL,extent=MicroWorld.EXTENT,cx,cz,step,token,dataId}=data;
  try{
    if(!world||world.seed!==seed||world.cell!==cell||world.extent!==extent){world=MicroWorld.createWorld(seed,cell,extent);cache=new MicroWorld.BudgetCache(128,4*1024*1024);}
    if(data.node){const start=performance.now(),{L,nx,nz}=data.node,mesh=world.node(L,nx,nz);self.postMessage({key:data.key,dataId:world.dataId,...mesh,generateMs:performance.now()-start,vegetationEntries:world.vegetationEntries()},[mesh.buffer,mesh.normals.buffer,mesh.canopy.buffer,mesh.biome.buffer,mesh.grass.buffer,mesh.leaves.buffer]);return;}
    const start=performance.now(),key=`${cx}:${cz}`,cached=cache.get(key),chunk=cached||world.generateChunk(cx,cz),generated=performance.now();
    if(!cached)cache.set(key,chunk);
    const mesh=MicroWorld.meshChunk(world,chunk,step),meshed=performance.now();
    self.postMessage({token,dataId:world.dataId,cx,cz,cell,extent,step,...mesh,dataBytes:chunk.bytes,cacheHit:!!cached,voxelCacheBytes:cache.bytes,voxelCacheEntries:cache.items.size,vegetationEntries:world.vegetationEntries(),generateMs:generated-start,meshMs:meshed-generated},[mesh.buffer]);
  }catch(error){self.postMessage({token,dataId,error:error.message});}
};
