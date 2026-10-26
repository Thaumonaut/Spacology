#!/usr/bin/env node
'use strict';
// A/B timing of two generator versions in one process (alternating passes, best of each, so machine load hits both):
// erosionAt (tectonics -> cones, crag, lattice gradient, erosion) over each world's volcano flanks, and over a common
// grid across the map. Usage: node tools/terrain-study/time-ab.cjs <dir A> <dir B> [seed=2718]
// Each dir holds voxel-world-model.js and macro-map.js (e.g. a `git show` of the old pair, and the working tree).
const path=require('node:path');
const [A,B]=process.argv.slice(2,4).map(d=>path.resolve(d)),seed=Number(process.argv[4]||2718);
const W=[A,B].map(d=>require(path.join(d,'voxel-world-model.js')).createWorld(seed,.25,'infinite'));
const flank=w=>{const p=[];for(const v of w.macro.volcanoes||[])for(let j=0;j<60;j++)for(let i=0;i<60;i++)p.push(v.x-3000+i*100,v.z-3000+j*100);return p;};
const grid=[];for(let j=0;j<80;j++)for(let i=0;i<80;i++)grid.push(-12000+i*300,-9000+j*230);
function pass(w,p,off){const t=process.hrtime.bigint();for(let k=0;k<p.length;k+=2)w.erosionAt(p[k]+off,p[k+1]+off*.7);return Number(process.hrtime.bigint()-t)/1e3/(p.length/2);}
const best={};
for(let r=0;r<4;r++)for(const [i,w] of W.entries()){const off=r*13.7+i*.01;
  for(const [name,p] of [['flanks',flank(w)],['map grid',grid]]){const k=name+(i?' B':' A'),us=pass(w,p,off);best[k]=Math.min(best[k]??Infinity,us);}}
console.log(`seed ${seed}: A=${path.relative(process.cwd(),A)||'.'} (${W[0].revision}, ${W[0].macro.volcanoes.length} volcanoes) B=${path.relative(process.cwd(),B)||'.'} (${W[1].revision}, ${W[1].macro.volcanoes.length} volcanoes; ${W[1].macro.volcanoes.map(v=>v.type).join(', ')})`);
for(const name of ['flanks','map grid'])console.log(`${name.padEnd(9)} erosionAt us/sample  A ${best[name+' A'].toFixed(2)}  B ${best[name+' B'].toFixed(2)}  (${((best[name+' B']/best[name+' A']-1)*100).toFixed(0)} %)`);
