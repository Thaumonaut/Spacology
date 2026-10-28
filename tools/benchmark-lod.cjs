#!/usr/bin/env node
'use strict';
// Streamed LOD node benchmark: builds a fixed mix of nodes (levels 0-5, home lowland and a mountain range) and reports
// ms per node by level plus the worker stage breakdown. With --against <file|git-ref>, builds the same nodes with that
// version of voxel-world-model.js and reports the speed ratio and whether terrain output is unchanged.
//   node tools/benchmark-lod.cjs [--seed 2718] [--cell 0.25] [--against HEAD|path/to/voxel-world-model.js]
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),current=path.join(root,'prototypes/labs/microvoxel-world/voxel-world-model.js');
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:fallback;};
const seed=Number(arg('seed',2718)),cell=Number(arg('cell',.25)),against=arg('against',null);
const MIX=[[0,4,0,0],[1,4,0,0],[2,4,0,0],[3,3,0,0],[4,2,0,0],[5,1,0,0],[1,3,-64,8],[2,3,-32,4]];
function load(spec){
  if(fs.existsSync(spec))return {label:spec,M:require(path.resolve(spec))};
  const tmp=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'lod-bench-')),'voxel-world-model.js');
  fs.writeFileSync(tmp,execFileSync('git',['show',`${spec}:prototypes/labs/microvoxel-world/voxel-world-model.js`],{cwd:root}));
  // Revisions from micro-wilds-14 on load the macro map beside the model.
  try{fs.writeFileSync(path.join(path.dirname(tmp),'macro-map.js'),execFileSync('git',['show',`${spec}:prototypes/labs/microvoxel-world/macro-map.js`],{cwd:root,stdio:['ignore','pipe','ignore']}));}catch{}
  return {label:spec,M:require(tmp)};
}
function run({M}){
  const w=M.createWorld(seed,cell,'infinite'),byLevel={},stages={},nodes=[];if(!w.node)throw new Error('This version has no LOD nodes');
  for(let pass=0;pass<2;pass++)for(const [L,R,ox,oz] of MIX){if(L>w.maxLevel)continue;
    for(let j=-R;j<R;j++)for(let i=-R;i<R;i++){
      const t=performance.now(),n=w.node(L,ox+i,oz+j),ms=performance.now()-t;
      if(pass===0){nodes.push(n);continue;}// first pass warms caches (rivers, climate, plates) like a running worker
      (byLevel[L]=byLevel[L]||[]).push(ms);for(const [k,v] of Object.entries(n.timing||{}))(stages[k]=stages[k]||[]).push(v);
    }}
  return {w,byLevel,stages,nodes};
}
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length,p50=a=>[...a].sort((x,y)=>x-y)[a.length>>1];
// Visible output of a node: its quads, ignoring the single hidden bottom face older builds emitted at y=0.
// Vertical-slice nodes (micro-wilds-16 on) carry their quads per slice with y local to the slice origin; earlier builds
// carry one buffer in absolute blocks. Both are compared in absolute blocks.
function surface(n){const out=[];for(const sl of n.slices||[{y:0,buffer:n.buffer,count:n.count}]){const v=new DataView(sl.buffer);for(let q=0;q<sl.count;q+=6){const o=q*8,pts=[];for(let k=0;k<6;k++)pts.push([0,1,2].map(a=>v.getUint16(o+k*8+a*2,true)+(a===1?sl.y:0)).join(','));
  const normal=v.getUint8(o+6);if(normal===2&&pts.every(p=>p.split(',')[1]==='0'))continue;out.push(pts.join(';')+'|'+normal+'|'+v.getUint8(o+7));}}return out.sort().join('\n');}
function worldHash(M){const h=crypto.createHash('sha256'),w=M.createWorld(seed,cell,'infinite');h.update(JSON.stringify(w.deposit));
  for(let i=0;i<600;i++){const x=(i*37.7)%600-300,z=(i*91.3)%600-300,g=w.geography(x,z);h.update(JSON.stringify([g.height,g.exposed,g.biome,g.water,g.riverDistance]));}
  for(const [cx,cz] of [[0,0],[-3,2],[-128,16],[1000000,-1000000]]){const c=w.generateChunk(cx,cz);for(const a of [c.offsets,c.ends,c.materials])h.update(Buffer.from(a.buffer));}
  return h.digest('hex').slice(0,16);}
function report(label,r){
  const all=Object.values(r.byLevel).flat();
  console.log(`${label}  (${r.w.revision}, seed ${seed}, ${cell} m cells): ${mean(all).toFixed(2)} ms/node over ${all.length} nodes`);
  for(const [L,a] of Object.entries(r.byLevel))console.log(`  L${L} ${(r.w.nodeMetres(+L)/r.w.nodeSize*100).toFixed(0).padStart(4)} cm columns  ${mean(a).toFixed(2).padStart(6)} ms/node`);
  if(Object.keys(r.stages).length)console.log('  stages p50: '+Object.entries(r.stages).map(([k,v])=>`${k} ${p50(v).toFixed(2)}`).join(' · ')+' ms');
}
const now=run({M:require(current)});report('current',now);
if(against){
  const old=load(against),then=run(old);report(against,then);
  const a=Object.values(then.byLevel).flat(),b=Object.values(now.byLevel).flat();
  console.log(`\nspeed: ${(mean(a)/mean(b)).toFixed(2)}x (${against} ${mean(a).toFixed(2)} → current ${mean(b).toFixed(2)} ms/node)`);
  if(then.w.revision!==now.w.revision)console.log(`terrain: revisions differ (${then.w.revision} vs ${now.w.revision}); output is expected to change`);
  else{const same=worldHash(old.M)===worldHash(require(current)),nodes=now.nodes.every((n,i)=>surface(n)===surface(then.nodes[i]));
    console.log(`terrain: world data ${same?'identical':'CHANGED'}; node surfaces ${nodes?'identical':'CHANGED'} (${now.nodes.length} nodes)`);if(!same||!nodes)process.exitCode=1;}
}
