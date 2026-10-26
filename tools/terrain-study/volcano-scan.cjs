#!/usr/bin/env node
'use strict';
// Volcano types over many seeds: counts per type, volcanoes per map, and the first example of each type (seed, world
// x/z, size class H, base radius R), to pick generator study areas for artifacts/volcano-types.
// Usage: node tools/terrain-study/volcano-scan.cjs [seeds=200] [first=1]
const path=require('node:path');
const MacroLib=require(path.join(__dirname,'../../prototypes/labs/microvoxel-world/macro-map.js'));
const n=Number(process.argv[2]||200),first=Number(process.argv[3]||1),count={},examples={},perMap=[];let total=0;const t0=Date.now();
for(let seed=first;seed<first+n;seed++){const M=MacroLib.get(seed),V=M.volcanoes||[];perMap.push(V.length);
  for(const v of V){count[v.type]=(count[v.type]||0)+1;total++;const S=MacroLib.volcanoSpec(v);
    // Clearance: mean range core (m) and sea share on rings at 0.3/0.6/0.9 R, so study examples stand clear of ranges.
    let rc=0,sea=0,k=0;const o={};for(const f of [.3,.6,.9])for(let a=0;a<16;a++){M.at(v.x+Math.cos(a/16*6.283)*f*S.R,v.z+Math.sin(a/16*6.283)*f*S.R,o);rc+=o.rc;sea+=o.land?0:1;k++;}
    (examples[v.type]=examples[v.type]||[]).push({seed,template:M.template,x:Math.round(v.x),z:Math.round(v.z),H:Math.round(S.H),R:Math.round(S.R),rc:Math.round(rc/k),sea:+(sea/k).toFixed(2)});}}
console.log(`${n} seeds (${first}..${first+n-1}), ${total} volcanoes, ${(total/n).toFixed(2)} per map, maps with none: ${perMap.filter(k=>!k).length}, ${((Date.now()-t0)/1000).toFixed(0)} s`);
for(const k of MacroLib.VOLCANO_TYPES)console.log(k.padEnd(8),String(count[k]||0).padStart(4),((count[k]||0)/total*100).toFixed(1).padStart(5)+' %','clearest',JSON.stringify((examples[k]||[]).sort((a,b)=>a.rc+400*a.sea-b.rc-400*b.sea).slice(0,3)));
