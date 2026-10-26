#!/usr/bin/env node
'use strict';
// Per-sample cost of world.geography() with every cache warm (drainage tiles, climate cells, gradient lattice), by what
// the ground is, so two generator versions with different layouts compare like for like: `mountain` (range relief
// > 150 m), `foothill` (15-150 m) and `lowland` (< 10 m, land), 4 spots each (12 drainage tiles: under the 16-tile cache) from a seeded scan. Each spot gets one
// untimed pass over an N x N grid; then R rounds time every class (process CPU time, so other load on the machine
// matters less) and the best round counts. With BASE_DIR (a directory holding another voxel-world-model.js and
// macro-map.js, e.g. from `git show`), both versions run in this process, interleaved round by round.
// drainNode: world.erosionAt on a 64 m grid around the mountain spots (what a drainage-tile bake does per node).
// Usage: [BASE_DIR=dir] node tools/terrain-study/bench-ours.cjs [N=40] [R=7] [step=4]
const path=require('node:path');
const N=Number(process.argv[2]||40),R=Number(process.argv[3]||7),step=Number(process.argv[4]||4),seed=Number(process.env.SEED||2718);
const dirs=[['new',path.join(__dirname,'../../prototypes/labs/microvoxel-world')]];if(process.env.BASE_DIR)dirs.unshift(['base',process.env.BASE_DIR]);
const runs=dirs.map(([name,dir])=>{const w=require(path.join(dir,'voxel-world-model.js')).createWorld(seed,.25,'infinite');
  let s=12345;const rnd=()=>(s=Math.imul(s,1103515245)+12345>>>0)/4294967296,classes={mountain:[],foothill:[],lowland:[]};
  for(let k=0;k<4000&&Object.values(classes).some(a=>a.length<4);k++){const x=(rnd()-.5)*30000,z=(rnd()-.5)*20000,g=w.geography(x,z);if(g.sea||g.cone>5)continue;
    const c=g.relief>150?'mountain':g.relief>15?'foothill':g.relief<10&&g.riverDistance>30?'lowland':null;if(c&&classes[c].length<4)classes[c].push([x,z]);}
  for(const spots of Object.values(classes))for(const [x0,z0] of spots)for(let j=0;j<N;j++)for(let i=0;i<N;i++)w.geography(x0+i*step+.125,z0+j*step+.125);
  return {name,w,classes,best:{}};});
let sink=0;
for(let r=0;r<R;r++)for(const run of runs){for(const [c,spots] of Object.entries(run.classes)){const t0=process.cpuUsage();
    for(const [x0,z0] of spots)for(let j=0;j<N;j++)for(let i=0;i<N;i++)sink+=run.w.geography(x0+i*step+.125,z0+j*step+.125).height;
    const us=(process.cpuUsage(t0).user)/(N*N*spots.length);run.best[c]=Math.min(run.best[c]??Infinity,us);}
  {const t0=process.cpuUsage();let n=0;for(const [x0,z0] of run.classes.mountain)for(let j=-6;j<6;j++)for(let i=-6;i<6;i++){run.w.erosionAt(x0+i*64+7+r*3,z0+j*64+7+r*3);n++;}
    run.best.drainNode=Math.min(run.best.drainNode??Infinity,process.cpuUsage(t0).user/n);}}
for(const run of runs)console.log(run.name.padEnd(5),Object.entries(run.best).map(([k,v])=>`${k} ${v.toFixed(2)}`).join('  '),'us',sink%2);
if(runs.length===2)console.log('ratio',Object.keys(runs[0].best).map(k=>`${k} ${(runs[1].best[k]/runs[0].best[k]).toFixed(2)}`).join('  '));
