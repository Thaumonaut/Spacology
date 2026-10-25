#!/usr/bin/env node
'use strict';
// Try a proposed generator change without editing the generator: load voxel-world-model.js and macro-map.js from
// source with string patches applied in memory, sample a study area (same sampler as sample-ours.cjs) and print the
// metrics next to the unpatched baseline grid (run sample-ours.cjs first).
// Usage: [SS=3] node tools/terrain-study/experiment.cjs <patch> <area> [<area> ...]
//        node tools/terrain-study/experiment.cjs list
const fs=require('node:fs'),path=require('node:path'),{OURS}=require('./areas.cjs'),G=require('./grid.cjs'),X=require('./metrics.cjs');
const DIR=path.join(__dirname,'../../prototypes/labs/microvoxel-world');
// Each patch: {about, macro: [[from, to], ...], world: [[from, to], ...]}. Every `from` must match exactly once.
const PATCHES={
  cone:{about:'volcanoCone: base radius 3H -> 4H, flank exponent 2 -> 2.2 (long concave apron, as Fuji/Rainier)',
    macro:[['const R=Hv*3,d=Math.hypot(dx,dz)','const R=Hv*4,d=Math.hypot(dx,dz)'],
      ['const q=d/R,rc=.075,qc=q/rc,top=(1-rc)**2;','const q=d/R,rc=.075*3/4,qc=q/rc,top=(1-rc)**2.2;'],
      ['else{c=Hv*(1-q)**2;out.frac=Math.min(1,(1-q)**2/top);}','else{c=Hv*(1-q)**2.2;out.frac=Math.min(1,(1-q)**2.2/top);}']],
    world:[['const V={x:v.x,z:v.z,H:v.H,R:v.H*3};','const V={x:v.x,z:v.z,H:v.H,R:v.H*4};'],
      ['clamp((Math.hypot(x-t.vx,z-t.vz)/(t.vr*.075)-1.4)/1.6,0,1)','clamp((Math.hypot(x-t.vx,z-t.vz)/(t.vr*.075*3/4)-1.4)/1.6,0,1)'],
      ['Math.hypot(x-t.vx,z-t.vz)<t.vr*.075+1.5','Math.hypot(x-t.vx,z-t.vz)<t.vr*.075*3/4+1.5']]},
  bigridge:{about:'cragAt broad ridges: wavelength ~345 m -> ~625 m (fewer, larger sub-peaks)',
    world:[['let bx=x*.0029,bz=z*.0029,bs=0,bgx=0,bgz=0,ba=1,bn=0,bdx=0,bdz=0,J=.0029,K=0,L=0,N=.0029;','let bx=x*.0016,bz=z*.0016,bs=0,bgx=0,bgz=0,ba=1,bn=0,bdx=0,bdz=0,J=.0016,K=0,L=0,N=.0016;']]},
  rangepw:{about:'RANGE_KINDS: core profile exponent pw 1.9/1.5/1.4 -> 1.25/1.1/1.1 (fuller, higher massifs: hypsometric integral up)',
    macro:[['const RANGE_KINDS={spine:{pw:1.9,apron:.16,K:2.4},coastal:{pw:1.9,apron:.15,K:2.2},interior:{pw:1.9,apron:.15,K:2.3},massif:{pw:1.5,apron:.2,K:2.4},',
      'const RANGE_KINDS={spine:{pw:1.25,apron:.16,K:2.4},coastal:{pw:1.25,apron:.15,K:2.2},interior:{pw:1.25,apron:.15,K:2.3},massif:{pw:1.1,apron:.2,K:2.4},'],
      ['secondary:{pw:1.5,apron:.14,K:2.2},branch:{pw:1.5,apron:.12,K:2},minor:{pw:1.4,apron:.12,K:2},home:{pw:1.55,apron:.14,K:2.6}};',
       'secondary:{pw:1.1,apron:.14,K:2.2},branch:{pw:1.1,apron:.12,K:2},minor:{pw:1.1,apron:.12,K:2},home:{pw:1.55,apron:.14,K:2.6}};']]},
  apronhills:{about:'hillsAt: range-apron hill amplitude floor 6+40*ra/30 m -> 2+12*ra/30 m (flat basins can exist beside ranges)',
    world:[['amp=Math.max(amp,(6+40*clamp(mac.ra/30,0,1))*clamp(mac.ra/6,0,1),','amp=Math.max(amp,(2+12*clamp(mac.ra/30,0,1))*clamp(mac.ra/6,0,1),']]},
  crestnoise:{about:'finish(): crest height wobble H0*.16 at ~700 m -> H0*.06 at ~1.6 km (fewer 100 m-prominence bumps along a crest)',
    macro:[['+H0*.16*(noise(sv/700,k,seed+963)-.5)*env;','+H0*.06*(noise(sv/1600,k,seed+963)-.5)*env;']]},
  bigamp:{about:'cragAt broad ridges: amplitude cap min(relief*.32,120) -> min(relief*.16,60) (lower sub-peaks)',
    world:[['const Ab=Math.min(relief*.32,120)*Bm*massif;','const Ab=Math.min(relief*.16,60)*Bm*massif;']]},
};
function patch(src,list,what){for(const [a,b] of list||[]){const n=src.split(a).length-1;if(n!==1)throw new Error(`${what}: patch matched ${n} times: ${a.slice(0,80)}`);src=src.replace(a,b);}return src;}
function load(P){
  const macroSrc=patch(fs.readFileSync(path.join(DIR,'macro-map.js'),'utf8'),P.macro,'macro-map'),worldSrc=patch(fs.readFileSync(path.join(DIR,'voxel-world-model.js'),'utf8'),P.world,'world');
  const mm={exports:{}};new Function('module','require',macroSrc)(mm,require);
  // The world model prefers root.MacroMap; hand it the patched macro map for the duration of the load and creation.
  const prev=globalThis.MacroMap;globalThis.MacroMap=mm.exports;const wm={exports:{}};new Function('module','require',worldSrc)(wm,require);
  return {M:wm.exports,restore:()=>{if(prev===undefined)delete globalThis.MacroMap;else globalThis.MacroMap=prev;}};
}
const [name,...areas]=process.argv.slice(2);
if(!name||name==='list'||!PATCHES[name]){for(const [k,p] of Object.entries(PATCHES))console.log(k.padEnd(11),p.about);process.exit(name&&name!=='list'?1:0);}
const P=PATCHES[name],{M,restore}=load(P),w=M.createWorld(2718,.25,'infinite');restore();
const SS=Number(process.env.SS||3);console.log(`patch ${name}: ${P.about}`);
for(const an of areas){const A=OURS.find(a=>a.name===an);if(!A)throw new Error('unknown area '+an);
  const step=30,n=Math.round(A.km*1000/step),half=(n-1)/2*step,h=new Float32Array(n*n),cone=new Float32Array(n*n),relief=new Float32Array(n*n);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){let sum=0,q=null;for(let b=0;b<SS;b++)for(let a=0;a<SS;a++){const x=A.x-half+i*step+((a+.5)/SS-.5)*step,z=A.z-half+j*step+((b+.5)/SS-.5)*step;
      const r=w.geography((Math.floor(x/w.cell)+.5)*w.cell,(Math.floor(z/w.cell)+.5)*w.cell);sum+=Math.max(r.height,r.water||0)*w.cell;if(a===SS>>1&&b===SS>>1)q=r;}
    h[j*n+i]=sum/(SS*SS);cone[j*n+i]=q.cone||0;relief[j*n+i]=q.relief||0;}
  const tag=`${an}@${name}`;fs.writeFileSync(path.join(G.GRIDS,tag+'.f32'),Buffer.from(h.buffer));fs.writeFileSync(path.join(G.GRIDS,tag+'.cone.f32'),Buffer.from(cone.buffer));fs.writeFileSync(path.join(G.GRIDS,tag+'.relief.f32'),Buffer.from(relief.buffer));
  fs.writeFileSync(path.join(G.GRIDS,tag+'.json'),JSON.stringify({...A,name:tag,n,step,sea:14.5,source:`patched generator (${name})`}));
  const row=g=>{const {n}=g,cm=new Uint8Array(n*n);if(['alpine','young','old'].includes(A.kind))for(let k=0;k<n*n;k++)if(g.cone[k]>5&&g.cone[k]>g.relief[k])cm[k]=1;
    const mask=k=>g.h[k]>14.5&&!cm[k],S=X.slopes(g),D=X.drainage(g,mask),LR=X.localRelief(g),mtn=k=>mask(k)&&LR[k]>=300;
    const o={slopeMean:X.slopeStats(g,S,mask).mean,lt10:X.slopeStats(g,S,mask).lt10,gt40:X.slopeStats(g,S,mask).gt40,mtnHI:X.hypsometry(g,mtn).HI,pk100:X.peaks(g,mask).per100km2_p100,ridgeGap:X.spacing(g,mask).ridgeGap,pits:D.closedDepressionShare,curvRatio:X.curvature(g,mask,S,D).ratio};
    if(A.kind==='volcano'){const v=X.volcano(g,(n-1)/2,(n-1)/2);Object.assign(o,{R_over_H:v.radiusOverHeight,p:v.concavityP,at20:v.flankSlope.at20,at40:v.flankSlope.at40,at60:v.flankSlope.at60,at80:v.flankSlope.at80});}
    return o;};
  const base=row(G.load(an)),now=row(G.load(tag));console.log(an);for(const k of Object.keys(now))console.log('  '+k.padEnd(11),(+base[k]).toFixed(2).padStart(8),'->',(+now[k]).toFixed(2));}
