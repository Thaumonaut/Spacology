#!/usr/bin/env node
'use strict';
// River connection check for the streamed microvoxel world. Water counts as connected only along continuous wet columns
// (1 m grid, 4-neighbour flood fill), so a rounded channel end short of the sea, or a stream stopping on a river bank,
// fails even when the two are a few metres apart.
//   node tools/check-river-connections.cjs [--model path] [--seed 2718] [--region 2500] [--verbose]
// Reports, per seed:
//   gaps          macro rivers with a dry run over 8 m along their course (the drawn meander may sit +-10 m off it)
//   oceanMouths   'ocean' rivers whose water doesn't reach open sea (sea columns well clear of any channel) within 700 m
//   lakeInlets    'lake' rivers whose water doesn't reach that lake's open water; lakeOutlets likewise from the source
//   joins         macro tributaries whose water doesn't reach the parent's water, or that step up (> 0.3 m) or flow
//                 uphill over their last 250 m
//   streams       local creeks and streams (drainage network) within --region m of home whose water doesn't reach the
//                 water of the macro river, lake or sea they end in
const path=require('node:path');
const arg=(n,f)=>{const i=process.argv.indexOf('--'+n);return i>0?process.argv[i+1]:f;};
const model=path.resolve(arg('model',path.join(__dirname,'../prototypes/labs/microvoxel-world/voxel-world-model.js')));
const M=require(model),seed=Number(arg('seed',2718)),region=Number(arg('region',2500)),verbose=process.argv.includes('--verbose');
const w=M.createWorld(seed,.25,'infinite'),mm=w.macro,c=w.cell;
const G=new Map();
const geo=(x,z)=>{const k=x*100003+z;let g=G.get(k);if(!g){g=w.geography(x,z);if(G.size>400000)G.clear();G.set(k,g);}return g;};
const wet=g=>g.water>g.height;
const edgeOut=g=>g.riverDistance>=999?1e9:(g.riverDistance-2.3)*Math.max(g.riverSize||.3,.3);
const openSea=g=>g.sea&&(g.coast<-40||edgeOut(g)>15);
const lakeWater=(g,L)=>wet(g)&&!g.sea&&g.lake>0&&Math.abs(g.water*c-g.lake)<.3&&edgeOut(g)>8&&(L===undefined||Math.abs(g.lake-L)<.05);
// Flood fill over wet columns from wet seeds within `seedR` of (x,z); true once `goal` holds, within `R` of (x,z).
function reaches(x,z,goal,{R=700,seedR=10,max=250000,seedOk=()=>true}={}){
  x=Math.round(x);z=Math.round(z);const seen=new Set(),q=[];
  for(let dz=-seedR;dz<=seedR;dz++)for(let dx=-seedR;dx<=seedR;dx++){if(dx*dx+dz*dz>seedR*seedR)continue;const g=geo(x+dx,z+dz);if(wet(g)&&seedOk(g)){const k=(x+dx)*100003+z+dz;seen.add(k);q.push(x+dx,z+dz);}}
  if(!q.length)return {ok:false,why:'dry'};
  for(let h=0;h<q.length;h+=2){const qx=q[h],qz=q[h+1],g=geo(qx,qz);if(goal(g,qx,qz))return {ok:true};if(seen.size>max)return {ok:false,why:'max'};
    for(const [u,v] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=qx+u,nz=qz+v,k=nx*100003+nz;if(seen.has(k)||Math.hypot(nx-x,nz-z)>R)continue;seen.add(k);if(wet(geo(nx,nz)))q.push(nx,nz);}}
  return {ok:false,why:'closed'};
}
const out={seed,rivers:mm.rivers.length,gaps:0,oceanMouths:0,ocean:0,lakeInlets:0,inlets:0,lakeOutlets:0,outlets:0,joins:0,joinCount:0,streams:0,streamCount:0},bad=[];
for(const r of mm.rivers){const n=r.x.length;let run=0,maxRun=0;
  for(let i=0;i<n-1;i++){const L=Math.hypot(r.x[i+1]-r.x[i],r.z[i+1]-r.z[i]),s=Math.max(1,Math.ceil(L/2)),px=-(r.z[i+1]-r.z[i])/(L||1),pz=(r.x[i+1]-r.x[i])/(L||1);
    for(let k=0;k<s;k++){const t=k/s,x=r.x[i]+(r.x[i+1]-r.x[i])*t,z=r.z[i]+(r.z[i+1]-r.z[i])*t;let ok=false;for(let d=0;d<=10&&!ok;d++)ok=wet(w.geography(x+px*d,z+pz*d))||wet(w.geography(x-px*d,z-pz*d));if(!ok){run+=L/s;maxRun=Math.max(maxRun,run);}else run=0;}}
  if(maxRun>8){out.gaps++;bad.push(['gap',r.id,maxRun.toFixed(0)]);}
  const ex=r.x[n-1],ez=r.z[n-1];
  if(r.end==='ocean'){out.ocean++;const q=reaches(ex,ez,openSea);if(!q.ok){out.oceanMouths++;bad.push(['ocean',r.id,Math.round(ex),Math.round(ez),q.why]);}}
  if(r.end==='lake'&&r.lake>=0){out.inlets++;const q=reaches(ex,ez,g=>lakeWater(g));if(!q.ok){out.lakeInlets++;bad.push(['inlet',r.id,'lake',r.lake,Math.round(ex),Math.round(ez),q.why]);}}
  if(mm.lakes.some(L=>L.outletRiver===r.id)){out.outlets++;const q=reaches(r.x[0],r.z[0],g=>lakeWater(g));if(!q.ok){out.lakeOutlets++;bad.push(['outlet',r.id,Math.round(r.x[0]),Math.round(r.z[0]),q.why]);}}
  if(r.end==='river'&&r.parent>=0){out.joinCount++;
    // Parent water at the join: any wet column of the parent's channel near the end vertex.
    const q=reaches(ex,ez,(g,x,z)=>{if(!g.macroRiver)return false;const hit={};return mm.riverNear(x,z,hit)&&hit.river===r.parent;},{R:120});
    // Water surface along the last 250 m: highest wet column on the cross-line, upstream to downstream.
    let prev=Infinity,step=0;
    const lv=[];for(let i=0;i<n-1;i++){if(r.length-r.along[i+1]>250)continue;const L=Math.hypot(r.x[i+1]-r.x[i],r.z[i+1]-r.z[i]),s=Math.max(1,Math.ceil(L/3)),px=-(r.z[i+1]-r.z[i])/(L||1),pz=(r.x[i+1]-r.x[i])/(L||1);
      for(let k=0;k<s;k++){const t=k/s,x=r.x[i]+(r.x[i+1]-r.x[i])*t,z=r.z[i]+(r.z[i+1]-r.z[i])*t;let best=null;for(let d=-10;d<=10;d++){const g=w.geography(x+px*d,z+pz*d);if(wet(g)&&!g.sea){const hit={};if(mm.riverNear(x+px*d,z+pz*d,hit)&&hit.river===r.id&&(best===null||g.water>best))best=g.water;}}if(best!==null)lv.push(best*c);}}
    for(const v of lv){if(v>prev+.3)step=Math.max(step,v-prev);prev=Math.min(prev,v);}
    if(!q.ok||step>0){out.joins++;bad.push(['join',r.id,'into',r.parent,Math.round(ex),Math.round(ez),q.ok?'':q.why,step?'step '+step.toFixed(2):'']);}
  }
}
// Local streams within the region around home.
for(const s of w.streamMouths(-region,-region,region,region)){out.streamCount++;
  // Start on the stream itself, a quarter of the way back from its end toward its own node.
  const sx=s.x+(s.ax-s.x)*.25,sz=s.z+(s.az-s.z)*.25;let goal;
  if(s.kind==='river')goal=g=>g.macroRiver&&wet(g);else if(s.kind==='lake')goal=g=>lakeWater(g);else goal=openSea;
  const q=reaches(sx,sz,goal,{R:120,seedR:7,max:60000});
  if(!q.ok){out.streams++;if(bad.filter(b=>b[0]==='stream').length<25)bad.push(['stream',s.kind,Math.round(s.x),Math.round(s.z),'hw',s.hw.toFixed(1),q.why]);}
}
console.log(JSON.stringify(out));
if(verbose||bad.length)console.log(bad.map(b=>b.join(' ')).join('\n'));
