#!/usr/bin/env node
'use strict';
// Sample the generator's surface height (world.ground, metres) on a regular grid for each OURS study area (seed 2718),
// in 2 km blocks so the drainage bake (per 2 km tile) stays cached. Also records geography fields useful for masks.
// Usage: [SS=3] node tools/terrain-study/sample-ours.cjs [name ...]
//        node tools/terrain-study/sample-ours.cjs --custom name x z km step   (ad-hoc area, e.g. a coarse overview)
const fs=require('node:fs'),path=require('node:path');
const M=require(path.join(__dirname,'../../prototypes/labs/microvoxel-world/voxel-world-model.js'));
const {DATA,STEP,OURS}=require('./areas.cjs');
const GRIDS=path.join(DATA,'grids');fs.mkdirSync(GRIDS,{recursive:true});
const SS=Number(process.env.SS||3),seed=Number(process.env.SEED||2718),w=M.createWorld(seed,.25,'infinite');
function sample(A,step){
  const n=Math.round(A.km*1000/step),half=(n-1)/2*step,g=new Float32Array(n*n),cone=new Float32Array(n*n),relief=new Float32Array(n*n),B=Math.max(1,Math.round(2000/step)),t0=Date.now();
  for(let bj=0;bj<n;bj+=B)for(let bi=0;bi<n;bi+=B)for(let j=bj;j<Math.min(n,bj+B);j++)for(let i=bi;i<Math.min(n,bi+B);i++){
    // Same cell-centre snap as world.ground(), keeping the cone and relief fields too. Height is the mean of SSxSS
    // sub-samples across the pixel, like a DEM pixel (point samples would alias sub-pixel gullies and cliff bands).
    // Like a DEM, water (sea, lakes, rivers) reads as its surface, not its bed.
    let sum=0,q=null;for(let b=0;b<SS;b++)for(let a=0;a<SS;a++){const x=A.x-half+i*step+((a+.5)/SS-.5)*step,z=A.z-half+j*step+((b+.5)/SS-.5)*step;
      const r=w.geography((Math.floor(x/w.cell)+.5)*w.cell,(Math.floor(z/w.cell)+.5)*w.cell);sum+=Math.max(r.height,r.water||0)*w.cell;if(a===SS>>1&&b===SS>>1)q=r;}
    g[j*n+i]=sum/(SS*SS);cone[j*n+i]=q.cone||0;relief[j*n+i]=q.relief||0;}
  fs.writeFileSync(path.join(GRIDS,A.name+'.f32'),Buffer.from(g.buffer));
  fs.writeFileSync(path.join(GRIDS,A.name+'.cone.f32'),Buffer.from(cone.buffer));fs.writeFileSync(path.join(GRIDS,A.name+'.relief.f32'),Buffer.from(relief.buffer));
  fs.writeFileSync(path.join(GRIDS,A.name+'.json'),JSON.stringify({...A,n,step,source:`generator ${w.revision} seed ${seed}, ${SS}x${SS} sub-samples per pixel`,sea:14.5,
    volcanoes:(w.macro.volcanoes||[]).map(v=>({x:v.x,z:v.z,H:v.H,R:v.H*3}))}));
  let lo=Infinity,hi=-Infinity;for(const v of g)if(v===v){lo=Math.min(lo,v);hi=Math.max(hi,v);}
  console.log(A.name,n+'x'+n,'step',step,'min',lo.toFixed(0),'max',hi.toFixed(0),((Date.now()-t0)/1000).toFixed(1)+'s');
}
const a=process.argv.slice(2);
if(a[0]==='--custom')sample({name:a[1],label:a[1],kind:'custom',x:+a[2],z:+a[3],km:+a[4]},+a[5]||STEP);
else for(const A of OURS)if(!a.length||a.includes(A.name))sample(A,A.step||STEP);
