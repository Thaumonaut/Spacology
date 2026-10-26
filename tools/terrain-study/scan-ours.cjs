#!/usr/bin/env node
'use strict';
// List the macro map's ranges and volcanoes for a seed (world metres), to pick generator study areas.
// Usage: node tools/terrain-study/scan-ours.cjs [seed]
const path=require('node:path');
const M=require(path.join(__dirname,'../../prototypes/labs/microvoxel-world/voxel-world-model.js'));
const seed=Number(process.argv[2]||2718),w=M.createWorld(seed,.25,'infinite'),MM=w.macro;
console.log('macro keys',Object.keys(MM).join(' '),'ox',MM.ox,'oy',MM.oy);
for(const r of MM.ranges){const n=r.x.length,m=n>>1;
  console.log(r.kind.padEnd(9),'len',Math.round(r.length),'H',Math.round(r.height),'from',Math.round(r.x[0]),Math.round(r.z[0]),'mid',Math.round(r.x[m]),Math.round(r.z[m]),'to',Math.round(r.x[n-1]),Math.round(r.z[n-1]),'w',Math.round(r.w[m]));}
console.log('volcanoes',JSON.stringify(MM.volcanoes));
