#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto'),M=require('../prototypes/labs/microvoxel-world/voxel-world-model.js');
const extent=Number(process.argv[2]??256),cell=Number(process.argv[3]??M.CELL),seeds=process.argv.length>4?process.argv.slice(4).map(Number):[0,1,2,3,39,2718,4294967295];
const stride=4,digest=data=>createHash('sha256').update(data).digest('hex').slice(0,16),rows=[];
for(const seed of seeds){
  assert.ok(Number.isInteger(seed)&&seed>=0&&seed<=4294967295,'seed must be an unsigned 32-bit integer');
  const w=M.createWorld(seed,cell,extent),again=M.createWorld(seed,cell,extent),heights=[],corridor=[],water=[],rock=[];
  for(let z=stride/2;z<extent;z+=stride)for(let x=stride/2;x<extent;x+=stride){
    const h=w.ground(x,z),g=w.geography((Math.floor(x/cell)+.5)*cell,(Math.floor(z/cell)+.5)*cell);
    assert.equal(h,again.ground(x,z),'sampled ground is repeatable');assert.ok(h>0&&h<w.heightMetres);
    heights.push(h/cell);corridor.push(Number(g.riverDistance<7));water.push(Number(g.riverDistance<7&&h<6));rock.push(Number(g.exposed));
  }
  const d=w.deposit,g=w.geography(d.x,d.z),column=w.column(Math.floor(d.x/cell),Math.floor(d.z/cell));
  assert.ok(g.exposed&&g.fault<1&&g.riverDistance>9&&column.includes(M.MAT.ore),'root is dry, fault-exposed ore');
  assert.deepEqual(d,again.deposit);assert.deepEqual(w.generateChunk(20,20),again.generateChunk(20,20),'regional chunk regeneration is repeatable');
  let trees=0;for(let z=0;z<Math.ceil(extent/5);z++)for(let x=0;x<Math.ceil(extent/5);x++)if(w.tree(x,z))trees++;
  rows.push({seed,root:{x:d.x,y:d.y,z:d.z,id:d.id},groundMetres:{min:Math.min(...heights)*cell,max:Math.max(...heights)*cell,mean:heights.reduce((a,b)=>a+b,0)/heights.length*cell},riverCorridorSamples:corridor.reduce((a,b)=>a+b,0),surfaceWaterSamples:water.reduce((a,b)=>a+b,0),exposedRockSamples:rock.reduce((a,b)=>a+b,0),treeSites:trees,heightFingerprint:digest(Buffer.from(Uint16Array.from(heights).buffer)),riverCorridorFingerprint:digest(Buffer.from(corridor)),surfaceWaterFingerprint:digest(Buffer.from(water)),rockFingerprint:digest(Buffer.from(rock))});
}
const distinct=fn=>new Set(rows.map(fn)).size;
console.log(JSON.stringify({revision:M.REVISION,extent,cellMetres:cell,sampleStrideMetres:stride,samplesPerSeed:(extent/stride)**2,checks:'PASS: repeated ground/chunks, root provenance and occupied ore',distinct:{heightFields:distinct(r=>r.heightFingerprint),riverCorridors:distinct(r=>r.riverCorridorFingerprint),surfaceWaterPatterns:distinct(r=>r.surfaceWaterFingerprint),rockFields:distinct(r=>r.rockFingerprint),rootSites:distinct(r=>`${r.root.x}:${r.root.z}`)},rows,limits:['Sparse samples are a regression survey, not exhaustive terrain or visual approval.','The current generator deliberately shares one river/ridge/clearing template and root site across seeds. Height noise and vegetation vary; macro geography is NOT yet varied.','Region size extends coordinate generation, not voxel size. These checks make no browser/device FPS claim.']},null,2));
