#!/usr/bin/env node
'use strict';
// Walk-height views of each range style (headless Chromium; set SPACOLOGY_HEADED=1 only for a visible debugging session).
// For each style window (styles.cjs list), finds the highest summit off the volcano cones, stands on low dry ground
// 1.6-2.6 km away facing it and screenshots the Walk view, so silhouettes (pyramids, arêtes, crests) can be judged.
// Writes artifacts/range-styles/walk-<style>.jpg. Usage: node tools/terrain-study/walk-shots.cjs [style ...]
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'../..'),OUT=path.join(ROOT,'artifacts/range-styles'),{DATA}=require('./areas.cjs');
const M=require(path.join(ROOT,'prototypes/labs/microvoxel-world/voxel-world-model.js'));
const W=JSON.parse(fs.readFileSync(path.join(DATA,'style-windows.json'),'utf8')),want=process.argv.slice(2);
const w=M.createWorld(2718,.25,'infinite');
function viewpoint(A){
  // Highest summit on a 150 m grid (not on a cone), then the lowest dry point on rings 1.6-2.6 km out.
  let best=null;for(let j=-30;j<=30;j++)for(let i=-30;i<=30;i++){const x=A.x+i*150,z=A.z+j*150,g=w.geography(x,z);if(g.sea||g.cone>g.relief&&g.cone>5)continue;const h=g.height*w.cell;if(!best||h>best.h)best={x,z,h};}
  let eye=null;for(const R of [1600,2100,2600])for(let a=0;a<24;a++){const x=best.x+Math.cos(a/24*Math.PI*2)*R,z=best.z+Math.sin(a/24*Math.PI*2)*R,g=w.geography(x,z);
    if(g.sea||g.water||g.slope>.35||g.cone>5)continue;const h=g.height*w.cell;const sc=h+R*.02;if(!eye||sc<eye.sc)eye={x,z,h,sc};}
  return {peak:best,eye};
}
(async()=>{
  const port=4300+Math.floor(Math.random()*500),srv=spawn(process.execPath,[path.join(ROOT,'tests/serve.cjs'),'--port',String(port)],{stdio:'ignore'});
  await new Promise(r=>setTimeout(r,800));
  const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'}),page=await browser.newPage({viewport:{width:1280,height:720}});
  try{
    for(const [st,A] of Object.entries(W)){if(st==='plain'||want.length&&!want.includes(st))continue;const {peak,eye}=viewpoint(A);if(!eye){console.log(st,'no viewpoint');continue;}
      const pos=M.positionAt(eye.x,eye.z),yaw=Math.atan2(-(peak.x-eye.x),-(peak.z-eye.z));
      await page.goto(`http://localhost:${port}/prototypes/microvoxel-world.html?seed=2718&cx=${pos.cx}&cz=${pos.cz}&lx=${pos.x}&lz=${pos.z}&walk=1&yaw=${yaw}`);
      try{await page.waitForFunction(()=>{const s=window.MicroWorldLab&&window.MicroWorldLab.snapshot();return s&&!s.failed&&s.ready>0&&s.ready===s.visible&&!s.pending;},null,{timeout:240000});}catch{console.log(st,'ready timeout');}
      await page.waitForTimeout(3000);
      const file=path.join(OUT,`walk-${st}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:80,timeout:120000});
      console.log(st,'eye',Math.round(eye.x),Math.round(eye.z),Math.round(eye.h)+' m','peak',Math.round(peak.x),Math.round(peak.z),Math.round(peak.h)+' m',path.relative(ROOT,file));}
  }finally{await browser.close();srv.kill();}
})().catch(e=>{console.error(e);process.exit(1);});
