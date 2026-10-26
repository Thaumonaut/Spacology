#!/usr/bin/env node
'use strict';
// Volcano types: our five volcano types (fuji, rainier, helens, caldera, shield) against a real example of each, with
// the same metrics on both, and hillshade comparisons (real left, ours right) in artifacts/volcano-types.
// Usage: node tools/terrain-study/fetch-real.cjs fuji rainier st-helens crater-lake mauna-loa kilauea
//        [SS=3] node tools/terrain-study/volcano-types.cjs sample [type ...]   (generator grids, one process per type)
//        node tools/terrain-study/volcano-types.cjs ideal [type ...]          (the cone alone, H 1500 m, on flat ground)
//        node tools/terrain-study/volcano-types.cjs analyze                  (metrics table, metrics.json)
//        node tools/terrain-study/volcano-types.cjs render                   (PNG comparisons)
// Ours examples come from volcano-scan.cjs (first seeds with each type, picked where the cone stands clear of ranges).
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {load,crop,shade,sideBySide,writePNG}=require('./grid.cjs'),X=require('./metrics.cjs');
const OUT=path.join(__dirname,'../../artifacts/volcano-types');
// type -> real grid(s) and our example (seed, vent x/z, window km, step m).
const TYPES={
  fuji:{real:'fuji',realKm:30,ours:{seed:181,x:4853,z:-2819,km:13}},
  rainier:{real:'rainier',realKm:30,ours:{seed:107,x:4726,z:486,km:13}},
  helens:{real:'st-helens',realKm:24,ours:{seed:26,x:-12186,z:4082,km:12}},
  caldera:{real:'crater-lake',realKm:30,ours:{seed:71,x:8738,z:-643,km:17}},
  shield:{real:'mauna-loa',realKm:90,ours:{seed:30,x:4799,z:-7049,km:15},extra:'kilauea'},
};
const oursName=t=>'vt-'+t,idealName=t=>'vt-'+t+'-ideal';
const f=(v,d=0)=>v==null||Number.isNaN(v)?'-':Number(v).toFixed(d);

// Rays from the vent: height along 360 azimuths (bilinear, every step/2), up to rMax metres.
function rays(G,vi,vj,rMax,n=360){const {n:N,step,h}=G,out=[],ds=step/2;
  const at=(x,y)=>{if(x<0||y<0||x>N-2||y>N-2)return NaN;const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,w=y-iy;return (h[iy*N+ix]*(1-u)+h[iy*N+ix+1]*u)*(1-w)+(h[(iy+1)*N+ix]*(1-u)+h[(iy+1)*N+ix+1]*u)*w;};
  for(let a=0;a<n;a++){const A=a/n*2*Math.PI,ca=Math.cos(A),sa=Math.sin(A),r=[];for(let d=0;d<=rMax;d+=ds)r.push(at(vi+ca*d/step,vj+sa*d/step));out.push(r);}return {rays:out,ds};}
const median=a=>{const s=a.filter(v=>v===v).sort((x,y)=>x-y);return s.length?s[s.length>>1]:NaN;};
const pctl=(a,p)=>{const s=a.filter(v=>v===v).sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.floor(p*s.length))]:NaN;};
// Mean slope (deg) of cells within r of the vent, above a base height.
function coneSlope(G,vi,vj,r,base){const {n,step,h}=G,S=X.slopes(G),a=[];for(let j=0;j<n;j++)for(let i=0;i<n;i++){if(Math.hypot(i-vi,j-vj)*step>r||h[j*n+i]<=base)continue;a.push(S[j*n+i]);}return median(a);}

// Caldera: rim = highest point along each ray within rMax; floor = median height inside 0.7 x the median rim radius
// (a lake reads as its surface); wall = rim - floor; outer slope = mean gradient from the rim out to 2x its radius.
function caldera(G,vi,vj,rMax){const {rays:R,ds}=rays(G,vi,vj,rMax*2.2);const rimR=[],rimH=[],outer=[];
  for(const r of R){let b=-1,bh=-Infinity;for(let k=0;k*ds<=rMax;k++)if(r[k]>bh){bh=r[k];b=k;}rimR.push(b*ds);rimH.push(bh);const k2=Math.min(r.length-1,b*2);if(r[k2]===r[k2])outer.push(Math.atan((bh-r[k2])/((k2-b)*ds||1))*180/Math.PI);}
  const rr=median(rimR),inner=[];const {n,step,h}=G;for(let j=0;j<n;j++)for(let i=0;i<n;i++)if(Math.hypot(i-vi,j-vj)*step<rr*.7)inner.push(h[j*n+i]);
  const floor=median(inner),flat=pctl(inner,.9)-pctl(inner,.1);
  return {rimRadius:rr,diameterKm:2*rr/1000,rimMedian:median(rimH),rimMin:Math.min(...rimH),rimMax:Math.max(...rimH),floor,wallMedian:median(rimH)-floor,wallMin:Math.min(...rimH)-floor,wallMax:Math.max(...rimH)-floor,floorFlatness:flat,outerSlope:median(outer)};}
// Breached cone: rim height per azimuth (max along the ray within rMax); crater floor = 10th percentile inside 0.5 x
// the median rim radius; breach = azimuth sector whose rim stands less than a quarter of the crater depth above the floor.
function breach(G,vi,vj,rMax){const {rays:R,ds}=rays(G,vi,vj,rMax);const rim=k0=>{const H=[],D=[];for(const r of R){let b=-1,bh=-Infinity;for(let k=k0;k<r.length;k++)if(r[k]>bh){bh=r[k];b=k;}H.push(bh);D.push(b*ds);}return [H,D];};
  // First pass: rim radius; second: rims beyond half of it, so a dome in the crater does not read as rim.
  const r0=median(rim(0)[1]),[rimH,rimR]=rim(Math.round(r0*.5/ds));
  const rr=median(rimR),inner=[];const {n,step,h}=G;for(let j=0;j<n;j++)for(let i=0;i<n;i++)if(Math.hypot(i-vi,j-vj)*step<rr*.5)inner.push(h[j*n+i]);
  const floor=pctl(inner,.1),top=Math.max(...rimH),depth=top-floor;let open=0;for(const v of rimH)if(v<floor+depth*.25)open++;
  return {rimRadius:rr,rimMax:top,rimMin:Math.min(...rimH),craterFloor:floor,craterDepth:depth,breachDeg:open,rimRange:top-Math.min(...rimH)};}

// The vent: real windows are centred on it; ours on the macro map's vent. Breached and caldera vents are the window centre.
function analyzeOne(name,type,isReal){
  const G=load(name),{n,step}=G;if(isReal&&(type==='shield'||name==='kilauea'))for(let k=0;k<G.h.length;k++)G.h[k]=Math.max(G.h[k],0);
  let vi=(n-1)/2,vj=(n-1)/2;
  if(type==='fuji'||type==='rainier'||type==='shield'){let best=-1e9;const R=(type==='shield'?3000:1200)/step;for(let j=Math.floor(vj-R);j<=vj+R;j++)for(let i=Math.floor(vi-R);i<=vi+R;i++)if(G.h[j*n+i]>best){best=G.h[j*n+i];var bi=i,bj=j;}vi=bi;vj=bj;}
  const V=X.volcano(G,vi,vj),o={name,label:G.label||name,H:V.heightAboveBase,R:V.baseRadius,RH:V.radiusOverHeight,p:V.concavityP,slopes:V.flankSlope,ribs:V.ribs.map(r=>({rFrac:r.rFrac,ribs:r.ribs,depth:r.depth}))};
  o.meanSlope=coneSlope(G,vi,vj,V.baseRadius*.6,V.base+.05*V.heightAboveBase);
  if(type==='caldera')o.caldera=caldera(G,vi,vj,Math.min(V.baseRadius*.6,(n/2-2)*step/2.2));
  if(type==='helens')o.breach=breach(G,vi,vj,Math.min(2500,V.baseRadius*.45));
  return o;}

const cmd=process.argv[2]||'help',want=process.argv.slice(3);
if(cmd==='sample'){
  // One child per type (macro maps are per seed; separate processes keep the cache and memory small).
  const kids=Object.entries(TYPES).filter(([t])=>!want.length||want.includes(t)).map(([t,T])=>{const O=T.ours;
    return new Promise((res,rej)=>{const {spawn}=require('node:child_process'),p=spawn(process.execPath,[path.join(__dirname,'sample-ours.cjs'),'--custom',oursName(t),O.x,O.z,O.km,O.step||Number(process.env.VT_STEP||30)].map(String),{env:{...process.env,SEED:String(O.seed)},stdio:'inherit'});p.on('exit',c=>c?rej(new Error(t+' '+c)):res());});});
  Promise.all(kids).catch(e=>{console.error(e);process.exit(1);});
}else if(cmd==='ideal'){
  // The cone function alone (MacroLib.volcanoCone with crater, ribs, cinder cones), size class H 1500 m, on flat ground
  // at sea level + 20 m, 3x3 sub-samples per 30 m pixel: the shape each type is built to, free of ranges, hills and erosion.
  const ML=require('../../prototypes/labs/microvoxel-world/macro-map.js'),{GRIDS}=require('./grid.cjs'),SS=3;
  for(const t of Object.keys(TYPES)){if(want.length&&!want.includes(t))continue;const S=ML.volcanoSpec({x:0,z:0,H:1500,type:t}),o={},step=30,km=Math.ceil(S.R*2.3/1000),n=Math.round(km*1000/step),half=(n-1)/2*step,g=new Float32Array(n*n);
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){let s=0;for(let b=0;b<SS;b++)for(let a=0;a<SS;a++){ML.volcanoCone(S,-half+i*step+((a+.5)/SS-.5)*step,-half+j*step+((b+.5)/SS-.5)*step,o);s+=34+o.cone+(o.basin&&o.cone<S.lake?S.lake-o.cone:0);}g[j*n+i]=s/(SS*SS);}
    fs.writeFileSync(path.join(GRIDS,idealName(t)+'.f32'),Buffer.from(g.buffer));
    fs.writeFileSync(path.join(GRIDS,idealName(t)+'.json'),JSON.stringify({name:idealName(t),label:'Ours: '+t+' cone alone',km,n,step,sea:14.5,source:'MacroLib.volcanoCone, H 1500'}));
    console.log(idealName(t),n+'x'+n,'R',Math.round(S.R),'H',Math.round(S.H));}
}else if(cmd==='analyze'){
  const res={};
  for(const [t,T] of Object.entries(TYPES)){res[t]={real:analyzeOne(T.real,t,true),ideal:analyzeOne(idealName(t),t,false),ours:analyzeOne(oursName(t),t,false)};if(T.extra)res[t].extra=analyzeOne(T.extra,t,true);}
  fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'metrics.json'),JSON.stringify(res,(k,v)=>typeof v==='number'?Math.round(v*100)/100:v,1));
  console.log('| type | example | H m | base R m | R/H | p | slope 20/40/60/80 % R (deg) | median slope < 0.6 R | ribs 0.5 R (n, depth m) |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for(const [t,r] of Object.entries(res))for(const [k,o] of Object.entries(r))console.log(`| ${k==='real'||k==='extra'?t:'**'+t+'**'} | ${k==='ours'?'ours in the world':k==='ideal'?'ours, cone alone':o.name} | ${f(o.H)} | ${f(o.R)} | ${f(o.RH,2)} | ${f(o.p,2)} | ${['at20','at40','at60','at80'].map(q=>f(o.slopes[q],1)).join(' / ')} | ${f(o.meanSlope,1)} | ${o.ribs[1].ribs}, ${f(o.ribs[1].depth)} |`);
  for(const [t,r] of Object.entries(res))for(const [k,o] of Object.entries(r)){if(o.caldera){const c=o.caldera;console.log(`${t} ${k}: caldera ${f(c.diameterKm,1)} km across, rim ${f(c.rimMin)}-${f(c.rimMax)} (median ${f(c.rimMedian)}), floor/lake ${f(c.floor)}, wall ${f(c.wallMin)}-${f(c.wallMax)} (median ${f(c.wallMedian)}), floor flatness p90-p10 ${f(c.floorFlatness,1)} m, outer slope ${f(c.outerSlope,1)} deg, caldera/base diameter ${f(c.rimRadius/o.R,2)}`);}
    if(o.breach){const b=o.breach;console.log(`${t} ${k}: crater rim ${f(b.rimMin)}-${f(b.rimMax)}, floor ${f(b.craterFloor)}, depth ${f(b.craterDepth)} (${f(b.craterDepth/o.H,2)} H), breach ${b.breachDeg} deg open, rim radius ${f(b.rimRadius)} m (${f(b.rimRadius/o.R,2)} R)`);}}
}else if(cmd==='render'){
  // Real | ours in the world | ours, cone alone (H 1500). Each panel at its own scale (ours is a ~1/2-scale world), 320 px
  // wide, windows ~2.3 base radii; 1 km bar lower left.
  fs.mkdirSync(OUT,{recursive:true});
  const panel=(name,km,shield)=>{const G=load(name);if(shield)for(let k=0;k<G.h.length;k++)G.h[k]=Math.max(G.h[k],G.sea!=null?G.sea:0);const mpp=km*1000/320,c=crop(G,km,mpp),img=shade(c,{z:1.5,lo:G.sea!=null?G.sea:0}),bar=Math.round(1000/mpp),y0=img.h-10;
    for(let y=y0;y<y0+4;y++)for(let x=8;x<8+bar;x++){const p=(y*img.w+x)*3,v=y===y0||y===y0+3?0:255;img.rgb[p]=img.rgb[p+1]=img.rgb[p+2]=v;}return img;};
  for(const [t,T] of Object.entries(TYPES)){const imgs=[panel(T.real,T.realKm,t==='shield'),panel(oursName(t),T.ours.km,t==='shield'),panel(idealName(t),load(idealName(t)).km,false)];if(T.extra)imgs.splice(1,0,panel(T.extra,16,true));
    const img=sideBySide(imgs),file=path.join(OUT,t+'.png'),b=writePNG(file,img);console.log(path.relative(process.cwd(),file),img.w+'x'+img.h,(b/1024).toFixed(0)+' KB');}
}else console.log('usage: volcano-types.cjs sample|analyze|render [type ...]');
