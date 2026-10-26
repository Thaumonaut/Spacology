#!/usr/bin/env node
'use strict';
// Timing probe: cost of ground() vs geography() pieces over a coherent grid.
const path=require('node:path');
const M=require(path.join(__dirname,'../../prototypes/labs/microvoxel-world/voxel-world-model.js'));
const w=M.createWorld(2718,.25,'infinite');
const x0=Number(process.argv[2]||9000),z0=Number(process.argv[3]||-3500),n=Number(process.argv[4]||20),step=Number(process.argv[5]||30);
let t=Date.now();for(let j=0;j<n;j++)for(let i=0;i<n;i++)w.erosionAt(x0+i*step,z0+j*step);console.log(n*n,'erosionAt ms',Date.now()-t);
t=Date.now();for(let j=0;j<n;j++)for(let i=0;i<n;i++)w.ground(x0+i*step,z0+j*step);console.log(n*n,'ground ms (first)',Date.now()-t);
t=Date.now();for(let j=0;j<n;j++)for(let i=0;i<n;i++)w.ground(x0+i*step+7,z0+j*step+7);console.log(n*n,'ground ms (warm)',Date.now()-t);
// Volcano flanks: erosionAt (tectonics -> cones, crag, lattice gradient) over each volcano's flank, fresh points every
// pass so the 16 m gradient lattice keeps missing; reported as microseconds per sample (best of 3 passes).
{const V=w.macro.volcanoes||[],N=60;let best=Infinity;
  for(let pass=0;pass<3;pass++){const t0=process.hrtime.bigint();let n=0;
    for(const v of V)for(let j=0;j<N;j++)for(let i=0;i<N;i++){w.erosionAt(v.x-3000+i*100+pass*13.7,v.z-3000+j*100+pass*9.1);n++;}
    best=Math.min(best,Number(process.hrtime.bigint()-t0)/1e3/n);}
  console.log(V.length,'volcanoes',N*N,'flank samples each: erosionAt us/sample',best.toFixed(2));}
