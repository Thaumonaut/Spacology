#!/usr/bin/env node
'use strict';
// Range styles vs real ranges (artifacts/range-styles). For each generator style, picks a window on the tallest range of
// that style (seed 2718, centred on its highest crest stretch), samples it like sample-ours.cjs, runs the study metrics
// on it and on the real references of that style, writes metrics.json and a markdown table, and renders hillshade pairs
// (real left, ours right, same metres per pixel).
// Usage: [SS=3] node tools/terrain-study/styles.cjs [sample|analyze|render|all|closeup] [style ...]
//   closeup: 3 km of ours at 7.5 m/px around the window's highest non-volcano summit, next to 3 km of the first real
//   reference around its highest point (30 m data, resampled), <style>-closeup.png.
//        node tools/terrain-study/styles.cjs list           (the windows it would use)
const fs=require('node:fs'),path=require('node:path');
const {DATA,STEP}=require('./areas.cjs'),G=require('./grid.cjs'),X=require('./metrics.cjs');
const OUT=path.join(__dirname,'../../artifacts/range-styles'),GRIDS=G.GRIDS;
const KM=12;
// Real references per style (fetched by fetch-real.cjs). The first is the headline comparison.
const REFS={alps:['bernese','matterhorn'],cascades:['north-cascades'],rockies:['tetons','front-range'],himalaya:['khumbu'],andes:['cordillera-real'],old:['smokies'],plain:['gallatin']};
const STYLES=['alps','cascades','rockies','himalaya','andes','old'];
function world(){const M=require(path.join(__dirname,'../../prototypes/labs/microvoxel-world/voxel-world-model.js'));return M.createWorld(Number(process.env.SEED||2718),.25,'infinite');}
// Window per style: the range of that style with the most crest above 60% of its peak, centred on the highest 3 km run
// of its crest, nudged up to 3 km toward the side with more land.
function windows(w){
  // Window tests use the macro map (fast; no drainage bakes). A window scores mountain samples whose baked style is that
  // style's (within 0.15 on age, glac, dis, basin), a little for dry lowland; candidates are crest points of the ranges of
  // that style, nudged up to 1.5 km across.
  const out={},MM=w.macro,q={},S=require(path.join(__dirname,'../../prototypes/labs/microvoxel-world/macro-map.js')).RANGE_STYLES;
  const dry=(x,z)=>{MM.at(x,z,q);return q.land&&q.lake<0&&q.m>15&&MM.volcanoes.every(v=>Math.hypot(x-v.x,z-v.z)>v.H*2.2);};
  for(const st of STYLES){const P=S[st];let best=null,bs=-1;
    const pure=()=>Math.abs(q.age-P.age)<.15&&Math.abs(q.glac-P.glac)<.15&&Math.abs(q.dis-P.dis)<.15&&Math.abs(q.basin-P.basin)<.15;
    for(const r of MM.ranges){if(r.style!==st||r.kind==='home')continue;
      for(let v=0;v<r.x.length;v+=4)for(const off of [-1500,0,1500]){const j=Math.min(r.x.length-1,v+1),i0=Math.max(0,v-1),ex=r.x[j]-r.x[i0],ez=r.z[j]-r.z[i0],L=Math.hypot(ex,ez)||1,cx=r.x[v]-ez/L*off,cz=r.z[v]+ex/L*off;
        let sc=0;for(let b=-6;b<=6;b++)for(let a=-6;a<=6;a++){const x=cx+a*KM*1000/13,z=cz+b*KM*1000/13;if(!dry(x,z))continue;sc+=q.rc>40&&pure()?1+q.rc/400:.15;}
        if(sc>bs){bs=sc;best={x:cx,z:cz,r};}}}
    if(best)out[st]={name:'style-'+st,label:`Ours: ${st} (${best.r.kind}, H ${Math.round(best.r.height)} m)`,kind:st,x:Math.round(best.x),z:Math.round(best.z),km:KM};}
  // Open basin: the 4 km window with the most land whose macro relief within +-1 km is under 50 m.
  const G=250,X0=-16000,Z0=-11000,NX=129,NZ=89,m=new Float32Array(NX*NZ),ld=new Uint8Array(NX*NZ),flat=new Uint8Array(NX*NZ);
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){ld[j*NX+i]=dry(X0+i*G,Z0+j*G)?1:0;m[j*NX+i]=q.m;}
  for(let j=4;j<NZ-4;j++)for(let i=4;i<NX-4;i++){if(!ld[j*NX+i])continue;let lo=1e9,hi=-1e9;for(let b=-4;b<=4;b++)for(let a=-4;a<=4;a++){const o=(j+b)*NX+i+a;if(ld[o]){lo=Math.min(lo,m[o]);hi=Math.max(hi,m[o]);}}if(hi-lo<50)flat[j*NX+i]=1;}
  let bp=null,bn=-1;for(let j=8;j<NZ-8;j+=2)for(let i=8;i<NX-8;i+=2){let c=0;for(let b=-8;b<=8;b++)for(let a=-8;a<=8;a++)c+=flat[(j+b)*NX+i+a];if(c>bn){bn=c;bp=[X0+i*G,Z0+j*G];}}
  if(bp)out.plain={name:'style-plain',label:`Ours: open basin (${Math.round(bn/289*100)}% of it under 50 m macro relief)`,kind:'plain',x:bp[0],z:bp[1],km:4};
  return out;
}
function styleMask(w,A,n,step){const half=(n-1)/2*step;
  // other: 1 on mountain ground (range core > 20 m) whose dominant range (largest H (1 - d / 2w) of its nearest crest vertex,
  // on a 120 m grid) has another style (left out of the metrics and summit picks), -1 on this style's own mountain ground
  // (the metrics' range mask), 0 elsewhere.
  const other=new Float32Array(n*n),q={},C=4,dom=(x,z)=>{let best=0,st=null;for(const r of w.macro.ranges)for(let v=0;v<r.x.length;v++){const d=Math.hypot(x-r.x[v],z-r.z[v]),e=r.H[v]*(1-d/(2*r.w[v]));if(e>best){best=e;st=r.style;}}return st;};
  if(A.kind!=='plain')for(let j=0;j<n;j+=C)for(let i=0;i<n;i+=C){const x=A.x-half+(i+C/2)*step,z=A.z-half+(j+C/2)*step;w.macro.at(x,z,q);if(q.rc<=20)continue;const st=dom(x,z);
    for(let b=j;b<Math.min(n,j+C);b++)for(let a=i;a<Math.min(n,i+C);a++)other[b*n+a]=st&&st!==A.kind?1:-1;}
  fs.writeFileSync(path.join(GRIDS,A.name+'.other.f32'),Buffer.from(other.buffer));
}
function sample(w,A){
  const SS=Number(process.env.SS||3),step=STEP,n=Math.round(A.km*1000/step),half=(n-1)/2*step,g=new Float32Array(n*n),cone=new Float32Array(n*n),relief=new Float32Array(n*n),open=new Float32Array(n*n),t0=Date.now();
  const B=Math.max(1,Math.round(2000/step));
  for(let bj=0;bj<n;bj+=B)for(let bi=0;bi<n;bi+=B)for(let j=bj;j<Math.min(n,bj+B);j++)for(let i=bi;i<Math.min(n,bi+B);i++){let sum=0,q=null;
    for(let b=0;b<SS;b++)for(let a=0;a<SS;a++){const x=A.x-half+i*step+((a+.5)/SS-.5)*step,z=A.z-half+j*step+((b+.5)/SS-.5)*step;
      const r=w.geography((Math.floor(x/w.cell)+.5)*w.cell,(Math.floor(z/w.cell)+.5)*w.cell);sum+=Math.max(r.height,r.water||0)*w.cell;if(a===SS>>1&&b===SS>>1)q=r;}
    g[j*n+i]=sum/(SS*SS);cone[j*n+i]=q.cone||0;relief[j*n+i]=q.relief||0;open[j*n+i]=q.open??-1;}
  styleMask(w,A,n,step);
  for(const [k,v] of [['',g],['.cone',cone],['.relief',relief],['.open',open]])fs.writeFileSync(path.join(GRIDS,A.name+k+'.f32'),Buffer.from(v.buffer));
  fs.writeFileSync(path.join(GRIDS,A.name+'.json'),JSON.stringify({...A,n,step,source:`generator ${w.revision} seed 2718, ${SS}x${SS} sub-samples per pixel`,sea:14.5}));
  console.log(A.name,n+'x'+n,((Date.now()-t0)/1000).toFixed(1)+'s');
}
// Crest sharpness: on divide cells (single-cell catchment, slope > 15 degrees), the curvature across the crest at the
// finest stencil (30 m): the larger of the two 1D second differences (E-W, N-S), as -d2h/dx2 in 1/km; median and p75.
// Rounded crests read low, knife-edge arêtes high (30 m data smooths both sides alike).
function crest(g,mask,S,D){const {n,step,h}=g,cellA=step*step/1e6,v=[];
  for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const k=j*n+i;if(!mask(k)||D.A[k]>cellA*1.01||!(S[k]>15))continue;
    const cx=-(h[k+1]+h[k-1]-2*h[k])/(step*step)*1000,cz=-(h[k+n]+h[k-n]-2*h[k])/(step*step)*1000;v.push(Math.max(cx,cz));}
  v.sort((a,b)=>a-b);return {p50:v[v.length>>1],p75:v[Math.floor(v.length*.75)],n:v.length};}
function metrics(name,ours){
  const g=G.load(name),{n,h}=g,cm=new Uint8Array(n*n);
  const oth=ours?G.extra(name,'other'):null;
  // Ours: only this style's own range ground (oth -1) off the cones; real windows are all range.
  if(ours&&g.cone)for(let k=0;k<n*n;k++)if(g.cone[k]>5&&g.cone[k]>g.relief[k]||oth&&oth[k]>=0&&g.kind!=='plain')cm[k]=1;
  const mask=ours?k=>h[k]>14.5&&!cm[k]:()=>true,S=X.slopes(g),D=X.drainage(g,mask),LR=X.localRelief(g),mtn=k=>mask(k)&&LR[k]>=300;
  let ms=0,land=0;for(let k=0;k<n*n;k++){if(mtn(k))ms++;if(mask(k))land++;}
  const sm=ms>.02*n*n?X.slopeStats(g,S,mtn):null,hm=ms>.02*n*n?X.hypsometry(g,mtn):null,c=X.curvature(g,mask,S,D),pk=X.peaks(g,mask),hy=X.hypsometry(g,mask);
  let openShare=null;if(ours){const f=path.join(GRIDS,name+'.open.f32');if(fs.existsSync(f)){const b=fs.readFileSync(f),o=new Float32Array(b.buffer,b.byteOffset,b.length/4);let k1=0;for(let k=0;k<n*n;k++)if(mask(k)&&o[k]>0)k1++;openShare=k1/land;}}
  return {label:g.label,km:g.km,land:land/(n*n),mountainShare:ms/(n*n),HI:hy.HI,HImtn:hm?.HI??null,skew:hy.skew,slope:X.slopeStats(g,S,mask),slopeMtn:sm,relief:X.reliefPerKm(g,mask),
    range:hy.max-hy.min,drainageDensity:D.drainageDensity,pits:D.closedDepressionShare,peaks:pk.per100km2_p100,peakSpacing:pk.peakSpacingKm,ridgeSharp:c.ridgeSharp,valleySharp:c.valleySharp,ratio:c.ratio,
    ridgeGap:X.spacing(g,mask).ridgeGap,beta:X.spectrum(g,mask).beta,openShare,crest:crest(g,mask,S,D)};
}
const [cmd='all',...want]=process.argv.slice(2),sel=s=>!want.length||want.includes(s);
fs.mkdirSync(OUT,{recursive:true});
const winFile=path.join(DATA,'style-windows.json');
let W=null;
if(cmd==='mask'){const w=world();W=JSON.parse(fs.readFileSync(winFile,'utf8'));for(const [st,A] of Object.entries(W))if(sel(st)){const g=G.load(A.name);styleMask(w,A,g.n,g.step);}}
if(cmd==='list'||cmd==='sample'||cmd==='all'){const w=world();W=windows(w);fs.writeFileSync(winFile,JSON.stringify(W,null,1));console.log(JSON.stringify(W,null,1));
  if(cmd!=='list')for(const [st,A] of Object.entries(W))if(sel(st))sample(w,A);}
else if(!W)W=JSON.parse(fs.readFileSync(winFile,'utf8'));
if(cmd==='analyze'||cmd==='all'){
  const file=path.join(OUT,'metrics.json'),res=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
  for(const st of [...STYLES,'plain']){if(!sel(st)||!W[st])continue;res[W[st].name]={style:st,window:W[st],...metrics(W[st].name,true)};for(const r of REFS[st])if(!res[r])res[r]={style:st,real:true,...metrics(r,false)};console.error('analyzed',st);}
  fs.writeFileSync(file,JSON.stringify(res,(k,v)=>typeof v==='number'?Math.round(v*1000)/1000:v,1));
  const f=(v,d=0)=>v==null||Number.isNaN(v)?'–':Number(v).toFixed(d);
  const rows=['| style | area | HI (land) | HI (mtn) | slope mean ° | <10° % | 10–25 % | 25–40 % | >40 % | relief p50 m/km | range m | drainage km/km² | pits % | peaks /100 km² | crest sharpness p50/p75 1/km | ridge/valley curv. | open plain % |','|'+'---|'.repeat(17)];
  for(const st of [...STYLES,'plain'])for(const k of [W[st]?.name,...REFS[st]]){const r=res[k];if(!r)continue;const s=r.slopeMtn||r.slope;
    rows.push(`| ${st} | ${r.real?k:'**ours**'} | ${f(r.HI,2)} | ${f(r.HImtn,2)} | ${f(s.mean,1)} | ${f(s.lt10)} | ${f(s.s10_25)} | ${f(s.s25_40)} | ${f(s.gt40)} | ${f(r.relief.p50)} | ${f(r.range)} | ${f(r.drainageDensity,2)} | ${f(r.pits,1)} | ${f(r.peaks,1)} | ${f(r.crest?.p50,1)} / ${f(r.crest?.p75,1)} | ${f(r.ratio,2)} | ${r.openShare==null?'–':f(r.openShare*100)} |`);}
  fs.writeFileSync(path.join(OUT,'table.md'),rows.join('\n')+'\n');console.log(rows.join('\n'));
}
if(cmd==='render'||cmd==='all'){
  for(const st of [...STYLES,'plain']){if(!sel(st)||!W[st])continue;const km=st==='plain'?4:KM,mpp=st==='plain'?15:30,list=[...REFS[st].map(r=>[r,km]),[W[st].name,km]];
    const panel=(name)=>{const g=G.load(name),c=G.crop(g,km,mpp),img=G.grey(G.shade(c,{z:1})),bar=Math.round(1000/mpp),y0=img.h-10;
      for(let y=y0;y<y0+4;y++)for(let x=8;x<8+bar;x++){img.grey[y*img.w+x]=255;if(y===y0||y===y0+3)img.grey[y*img.w+x]=0;}
      const rgb=new Uint8Array(img.w*img.h*3);for(let k=0;k<img.grey.length;k++)rgb[k*3]=rgb[k*3+1]=rgb[k*3+2]=img.grey[k];return {w:img.w,h:img.h,rgb};};
    const img=G.grey(G.sideBySide(list.map(([n])=>panel(n))));const bytes=G.writePNG(path.join(OUT,st+'.png'),img);console.log(st+'.png',img.w+'x'+img.h,(bytes/1024).toFixed(0)+' KB');}
}

if(cmd==='closeup'){const w=world();
  for(const st of STYLES){if(!sel(st)||!W[st])continue;const g=G.load(W[st].name),{n,step,h}=g,half=(n-1)/2*step,oth=G.extra(W[st].name,'other');let bk=-1,bh=-1e9;
    for(let k=0;k<n*n;k++){const i=k%n,j=(k/n)|0;if(i<50||j<50||i>n-50||j>n-50)continue;if(g.cone&&g.cone[k]>5&&g.cone[k]>g.relief[k]||oth&&oth[k]>0)continue;if(h[k]>bh){bh=h[k];bk=k;}}
    const cx=W[st].x-half+(bk%n)*step,cz=W[st].z-half+((bk/n)|0)*step,KMc=3,st2=7.5,m=Math.round(KMc*1000/st2),hh=new Float32Array(m*m),hm=(m-1)/2*st2;
    for(let j=0;j<m;j++)for(let i=0;i<m;i++){const r=w.geography((Math.floor((cx-hm+i*st2)/w.cell)+.5)*w.cell,(Math.floor((cz-hm+j*st2)/w.cell)+.5)*w.cell);hh[j*m+i]=Math.max(r.height,r.water||0)*w.cell;}
    const ours=G.grey(G.shade({n:m,step:st2,h:hh},{z:1}));
    const R=G.load(REFS[st][0]);let rk=0,rh=-1e9;for(let k=0;k<R.n*R.n;k++)if(R.h[k]>rh){rh=R.h[k];rk=k;}
    const rc=G.crop(R,KMc,st2,(rk%R.n-(R.n-1)/2)*R.step,(((rk/R.n)|0)-(R.n-1)/2)*R.step),real=G.grey(G.shade(rc,{z:1}));
    const toRgb=img=>{const bar=Math.round(1000/st2),y0=img.h-10;for(let y=y0;y<y0+4;y++)for(let x=8;x<8+bar;x++)img.grey[y*img.w+x]=y===y0||y===y0+3?0:255;const rgb=new Uint8Array(img.w*img.h*3);for(let k=0;k<img.grey.length;k++)rgb[k*3]=rgb[k*3+1]=rgb[k*3+2]=img.grey[k];return {w:img.w,h:img.h,rgb};};
    const img=G.grey(G.sideBySide([toRgb(real),toRgb(ours)]));G.writePNG(path.join(OUT,st+'-closeup.png'),img);console.log(st+'-closeup.png',Math.round(cx),Math.round(cz),Math.round(bh)+' m');}
}
// view: standing-eye silhouettes (view.cjs), real reference on top, ours below, <style>-view.png. Summit: the highest
// point of the style's own range ground in the window. Eye: 1.7 m above dry ground on a circle around it (ours 2-3.2 km,
// real 2.5x that: real ranges are ~2.5x bigger), in the direction where nothing between eye and summit blocks the
// view (the least obstruction above the sight line), lower ground preferred.
if(cmd==='view'){const w=world(),V=require('./view.cjs');
  const topOf=(g,ok)=>{const {n,step,h}=g,half=(n-1)/2*step;let bk=-1,bh=-1e9;for(let k=0;k<n*n;k++){const i=k%n,j=(k/n)|0;if(i<n/8||j<n/8||i>n*7/8||j>n*7/8||!ok(k))continue;if(h[k]>bh){bh=h[k];bk=k;}}return {x:(bk%n)*step-half,z:((bk/n)|0)*step-half,h:bh};};
  const eyeFor=(H,dry,pk,Ds)=>{let best=null;for(const D of Ds)for(let a=0;a<48;a++){const dx=Math.cos(a/48*Math.PI*2),dz=Math.sin(a/48*Math.PI*2),ex=pk.x+dx*D,ez=pk.z+dz*D,eh=H(ex,ez);if(!(eh===eh)||!dry(ex,ez))continue;
      let ob=0;for(let t=.04;t<.96;t+=.02){const hh=H(ex-dx*D*t,ez-dz*D*t),line=eh+1.7+(pk.h-eh-1.7)*t;if(hh===hh)ob=Math.max(ob,(hh-line)/(D*t));}
      const sc=ob*20+(eh-pk.h*.0)/(pk.h+1)*.3;if(!best||sc<best.sc)best={x:ex,z:ez,h:eh,sc};}return best;};
  const frame=(G,P)=>{const dx=P.peak.x-P.eye.x,dz=P.peak.z-P.eye.z,D=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),pitch=Math.atan((P.peak.h-P.eye.h)/D)*.7;
    return V.render(G,{x:P.eye.x,z:P.eye.z,y:P.eye.h+1.7},yaw,{pitch,far:Math.max(7000,D*2.6),sea:G.sea});};
  for(const st of STYLES){if(!sel(st)||!W[st])continue;
    const g=G.load(W[st].name),oth=G.extra(W[st].name,'other'),own=k=>g.h[k]>15&&!(g.cone&&g.cone[k]>5&&g.cone[k]>g.relief[k])&&oth&&oth[k]<0;
    const pk=topOf(g,own),geo=(x,z)=>w.geography(W[st].x+x,W[st].z+z),Hs=(x,z)=>{const r=geo(x,z);return Math.max(r.height,r.water||0)*w.cell;};
    const eye=eyeFor(Hs,(x,z)=>{const r=geo(x,z);return !r.sea&&!r.water&&r.cone<5;},pk,[2000,2600,3200]);if(!eye){console.log(st,'no eye');continue;}
    const P={peak:pk,eye};
    // Ours at 10 m around the eye and peak (from the generator, not the 30 m grid).
    const S=10,ext=Math.max(Math.abs(pk.x-eye.x),Math.abs(pk.z-eye.z))/2+4000,cx=W[st].x+(eye.x+pk.x)/2,cz=W[st].z+(eye.z+pk.z)/2,n=Math.round(2*ext/S),h=new Float32Array(n*n),x0=cx-ext,z0=cz-ext;
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){const r=w.geography((Math.floor((x0+i*S)/w.cell)+.5)*w.cell,(Math.floor((z0+j*S)/w.cell)+.5)*w.cell);h[j*n+i]=Math.max(r.height,r.water||0)*w.cell;}
    const ours=frame({n,step:S,h,x0:x0-W[st].x,z0:z0-W[st].z,sea:14.6},P);
    const R=G.load(REFS[st][0]),Rh=(R.n-1)/2*R.step,RG={n:R.n,step:R.step,h:R.h,x0:-Rh,z0:-Rh},pr=topOf(R,()=>true),er=eyeFor((x,z)=>V.bil(RG,x,z),()=>true,pr,[5000,6500,8000]);
    const real=frame(RG,{peak:pr,eye:er});
    const img={w:ours.w,h:ours.h*2+8,rgb:new Uint8Array(ours.w*(ours.h*2+8)*3).fill(255)};img.rgb.set(real.rgb,0);img.rgb.set(ours.rgb,ours.w*(ours.h+8)*3);
    G.writePNG(path.join(OUT,st+'-view.png'),img);console.log(st+'-view.png','ours eye',Math.round(W[st].x+eye.x),Math.round(W[st].z+eye.z),Math.round(eye.h),'peak',Math.round(pk.h),'m; real peak',Math.round(pr.h));}
}
