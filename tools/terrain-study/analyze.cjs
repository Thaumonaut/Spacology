#!/usr/bin/env node
'use strict';
// Run every metric on every grid (real and generated) with the same code; write artifacts/real-terrain/metrics.json and
// print a compact table. Generated grids leave out the sea (h <= 14.5 m) and, in range areas, ground where a volcano
// cone outweighs the range relief (so range statistics describe ranges).
// Usage: node tools/terrain-study/analyze.cjs [name ...]
const fs=require('node:fs'),path=require('node:path'),{REAL,OURS}=require('./areas.cjs'),{load}=require('./grid.cjs'),X=require('./metrics.cjs');
const OUT=path.join(__dirname,'../../artifacts/real-terrain');fs.mkdirSync(OUT,{recursive:true});
const want=process.argv.slice(2),all=[...REAL,...OURS].filter(A=>!want.length||want.includes(A.name)),res={};
const prev=fs.existsSync(path.join(OUT,'metrics.json'))?JSON.parse(fs.readFileSync(path.join(OUT,'metrics.json'),'utf8')):{};
for(const A of all){const G=load(A.name),{n,step,h}=G,t0=Date.now();
  const half=(n-1)/2*step;
  // Range areas leave out ground the volcano dominates (cone height above the range relief, the generator's own onCone test).
  const cone=new Uint8Array(n*n);if(G.cone&&['alpine','young','old'].includes(A.kind))for(let k=0;k<n*n;k++)if(G.cone[k]>5&&G.cone[k]>G.relief[k])cone[k]=1;
  const mask=G.sea!=null?k=>h[k]>G.sea&&!cone[k]:()=>true;
  let landShare=0;for(let k=0;k<n*n;k++)if(mask(k))landShare++;landShare/=n*n;
  const S=X.slopes(G),D=X.drainage(G,mask),LR=X.localRelief(G),mtn=k=>mask(k)&&LR[k]>=300;let mtnShare=0;for(let k=0;k<n*n;k++)if(mtn(k))mtnShare++;mtnShare/=n*n;
  const r={label:A.label,kind:A.kind,windowKm:G.km,step,landShare,mountainShare:mtnShare,
    // Slopes on mountain cells only (>= 300 m relief within 1 km), so lowland around a small range does not dilute them.
    slopeMountain:mtnShare>.02?X.slopeStats(G,S,mtn):null,
    hyps:X.hypsometry(G,mask),hypsMountain:mtnShare>.02?X.hypsometry(G,mtn):null,slope:X.slopeStats(G,S,mask),relief:X.reliefPerKm(G,mask),spacing:X.spacing(G,mask),spectrum:X.spectrum(G,mask),
    drainage:(({A,ch,rec,...o})=>o)(D),peaks:X.peaks(G,mask),curvature:X.curvature(G,mask,S,D)};
  if(A.kind==='volcano'){let vi,vj;
    if(G.vent){vi=Math.round((G.vent[0]-G.x+half)/step);vj=Math.round((G.vent[1]-G.z+half)/step);}
    else{let best=-1e9;const c=(n-1)/2,R=1500/step;for(let j=Math.floor(c-R);j<=c+R;j++)for(let i=Math.floor(c-R);i<=c+R;i++)if(h[j*n+i]>best){best=h[j*n+i];vi=i;vj=j;}}
    // The crater rim, not the crater floor: re-centre on the highest point within 600 m of the vent (real data already is).
    r.volcano=X.volcano(G,vi,vj);}
  res[A.name]=r;console.error(A.name,((Date.now()-t0)/1000).toFixed(1)+'s');}
const merged={...prev,...res};
fs.writeFileSync(path.join(OUT,'metrics.json'),JSON.stringify(merged,(k,v)=>typeof v==='number'?Math.round(v*1000)/1000:v,1));
const f=(v,d=0)=>v==null||Number.isNaN(v)?'-':Number(v).toFixed(d);
console.log(['area','land','mtn','relief p50/km','slope mean','<10','10-25','25-40','>40','mtn slope','m<10','m>40','HI','mtnHI','skew','ridgeGap km','acW km','beta','DD km/km2','Rb','ord@10km2','hackH','maxA','pits%','pk100/100km2','pkSp km','ridgeSharp','valleySharp','ratio'].join(' | '));
for(const [k,r] of Object.entries(merged))console.log([k,f(r.landShare,2),f(r.mountainShare,2),f(r.relief.p50),f(r.slope.mean,1),f(r.slope.lt10),f(r.slope.s10_25),f(r.slope.s25_40),f(r.slope.gt40),f(r.slopeMountain?.mean,1),f(r.slopeMountain?.lt10),f(r.slopeMountain?.gt40),f(r.hyps.HI,2),f(r.hypsMountain?.HI,2),f(r.hyps.skew,2),
  f(r.spacing.ridgeGap/1000,2),f(r.spacing.autocorrWavelength/1000,2),f(r.spectrum.beta,2),f(r.drainage.drainageDensity,2),f(r.drainage.bifurcation,2),r.drainage.orderAt10km2,f(r.drainage.hackH,2),f(r.drainage.maxAreaKm2,0),f(r.drainage.closedDepressionShare,1),
  f(r.peaks.per100km2_p100,1),f(r.peaks.peakSpacingKm,2),f(r.curvature.ridgeSharp,2),f(r.curvature.valleySharp,2),f(r.curvature.ratio,2)].join(' | '));
for(const [k,r] of Object.entries(merged))if(r.volcano){const v=r.volcano;console.log(k,'H',f(v.heightAboveBase),'R',f(v.baseRadius),'R/H',f(v.radiusOverHeight,2),'p',f(v.concavityP,2),'slopes',JSON.stringify(v.flankSlope,(a,b)=>typeof b==='number'?+b.toFixed(1):b),'ribs',v.ribs.map(q=>`${q.rFrac}:${q.ribs}/h${q.dominantHarmonic}/${f(q.depth)}m`).join(' '));}
