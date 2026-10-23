#!/usr/bin/env node
'use strict';
const os=require('node:os'),M=require('../prototypes/labs/microvoxel-world/voxel-world-model.js');
const seed=Number(process.argv[2]??2718)>>>0,w=M.createWorld(seed,Number(process.argv[3]??M.CELL),process.argv[4]==='infinite'?'infinite':Number(process.argv[4]??M.EXTENT)),times=[],meshTimes=[],warmTimes=[];
let encoded=0,dense=0,vertexBytes=0,faces=0,quads=0,maxScratch=0;
const cache=new M.BudgetCache(128,4*1024*1024);
const start=Number(process.argv[5]??(w.infinite?1000000:w.extent===256?16:3)),startZ=Number(process.argv[6]??(w.infinite?-1000000:w.extent===256?16:4));
for(let z=startZ;z<startZ+8;z++)for(let x=start;x<start+8;x++){
  let start=performance.now();const c=w.generateChunk(x,z);times.push(performance.now()-start);cache.set(`${x}:${z}`,c);
  start=performance.now();const mesh=M.meshChunk(w,c,1);meshTimes.push(performance.now()-start);
  encoded+=c.bytes;dense+=w.chunkCells*w.chunkCells*w.heightCells;vertexBytes+=mesh.buffer.byteLength;faces+=mesh.exposedFaces;quads+=mesh.quads;maxScratch=Math.max(maxScratch,mesh.scratchBytes);
}
for(const key of [...cache.items.keys()]){const start=performance.now();cache.get(key);warmTimes.push(performance.now()-start);}
const p=(a,n)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*n)];
console.log(JSON.stringify({seed,revision:w.revision,extent:w.extent,node:process.version,platform:os.platform(),cpu:os.cpus()[0].model,chunks:times.length,cellMetres:w.cell,chunkCells:[w.chunkCells,w.heightCells,w.chunkCells],chunkMetres:w.chunkMetres,sampleChunkOrigin:[start,startZ],denseBytes:dense,encodedBytes:encoded,compressionRatio:dense/encoded,vertexBytes,exposedFaces:faces,greedyQuads:quads,faceReduction:1-quads/faces,peakMeshTypedArrayEstimate:maxScratch,generateMs:{p50:p(times,.5),p95:p(times,.95)},meshMs:{p50:p(meshTimes,.5),p95:p(meshTimes,.95)},warmDataLookupMs:{p50:p(warmTimes,.5),p95:p(warmTimes,.95)},notes:'Node CPU benchmark, 64 chunks from sampleChunkOrigin covering equal physical area at full resolution. Defaults: 128 m root neighbourhood, 256 m regional extension, or distant signed streamed coordinates. Bytes are material-run and vertex buffers, not process memory. Cache lookup excludes remeshing. No browser/device FPS claim.'},null,2));
