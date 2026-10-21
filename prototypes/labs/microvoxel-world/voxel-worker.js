'use strict';
importScripts('voxel-world-model.js');
let world,cache;
self.onmessage=({data})=>{
  const {seed,cx,cz,step,token}=data;
  try{
    if(!world||world.seed!==seed){world=MicroWorld.createWorld(seed);cache=new MicroWorld.BudgetCache(128,4*1024*1024);}
    const start=performance.now(),key=`${cx}:${cz}`,cached=cache.get(key),chunk=cached||world.generateChunk(cx,cz),generated=performance.now();
    if(!cached)cache.set(key,chunk);
    const mesh=MicroWorld.meshChunk(world,chunk,step),meshed=performance.now();
    self.postMessage({token,cx,cz,step,...mesh,dataBytes:chunk.bytes,cacheHit:!!cached,voxelCacheBytes:cache.bytes,voxelCacheEntries:cache.items.size,generateMs:generated-start,meshMs:meshed-generated},[mesh.buffer]);
  }catch(error){self.postMessage({token,error:error.message});}
};
