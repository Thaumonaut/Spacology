#!/usr/bin/env node
'use strict';
const os=require('node:os'),M=require('../prototypes/labs/microvoxel-world/voxel-world-model.js');
const seed=Number(process.argv[2]??2718)>>>0,w=M.createWorld(seed),times=[],meshTimes=[],warmTimes=[];
let encoded=0,dense=0,vertexBytes=0,faces=0,quads=0,maxScratch=0;
const cache=new M.BudgetCache(128,4*1024*1024);
for(let z=4;z<12;z++)for(let x=3;x<11;x++){
  let start=performance.now();const c=w.generateChunk(x,z);times.push(performance.now()-start);cache.set(`${x}:${z}`,c);
  start=performance.now();const mesh=M.meshChunk(w,c,1);meshTimes.push(performance.now()-start);
  encoded+=c.bytes;dense+=M.CHUNK*M.CHUNK*M.HEIGHT;vertexBytes+=mesh.buffer.byteLength;faces+=mesh.exposedFaces;quads+=mesh.quads;maxScratch=Math.max(maxScratch,mesh.scratchBytes);
}
for(const key of [...cache.items.keys()]){const start=performance.now();cache.get(key);warmTimes.push(performance.now()-start);}
const p=(a,n)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*n)];
console.log(JSON.stringify({seed,revision:M.REVISION,node:process.version,platform:os.platform(),cpu:os.cpus()[0].model,chunks:times.length,cellMetres:M.CELL,chunkCells:[M.CHUNK,M.HEIGHT,M.CHUNK],denseBytes:dense,encodedBytes:encoded,compressionRatio:dense/encoded,vertexBytes,exposedFaces:faces,greedyQuads:quads,faceReduction:1-quads/faces,peakMeshTypedArrayEstimate:maxScratch,generateMs:{p50:p(times,.5),p95:p(times,.95)},meshMs:{p50:p(meshTimes,.5),p95:p(meshTimes,.95)},warmDataLookupMs:{p50:p(warmTimes,.5),p95:p(warmTimes,.95)},notes:'Node CPU benchmark, 64 root-catchment chunks at full resolution. Bytes are material-run and vertex buffers, not process memory. Cache lookup excludes remeshing. No browser/device FPS claim.'},null,2));
