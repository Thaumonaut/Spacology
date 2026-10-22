'use strict';
importScripts('voxel-world-model.js');
let world,cache;
self.onmessage=({data})=>{
  const {seed,cell=MicroWorld.CELL,extent=MicroWorld.EXTENT,cx,cz,step,token,dataId}=data;
  try{
    if(!world||world.seed!==seed||world.cell!==cell||world.extent!==extent){world=MicroWorld.createWorld(seed,cell,extent);cache=new MicroWorld.BudgetCache(128,4*1024*1024);}
    if(data.far){const start=performance.now(),mesh=world.farMesh(data.tx,data.tz,data.far);self.postMessage({token,dataId:world.dataId,far:data.far,tx:data.tx,tz:data.tz,...mesh,generateMs:performance.now()-start},[mesh.buffer]);return;}
    const start=performance.now(),key=`${cx}:${cz}`,cached=cache.get(key),chunk=cached||world.generateChunk(cx,cz),generated=performance.now();
    if(!cached)cache.set(key,chunk);
    const mesh=MicroWorld.meshChunk(world,chunk,step),meshed=performance.now();
    self.postMessage({token,dataId:world.dataId,cx,cz,cell,extent,step,...mesh,dataBytes:chunk.bytes,cacheHit:!!cached,voxelCacheBytes:cache.bytes,voxelCacheEntries:cache.items.size,vegetationEntries:world.vegetationEntries(),generateMs:generated-start,meshMs:meshed-generated},[mesh.buffer]);
  }catch(error){self.postMessage({token,dataId,error:error.message});}
};
