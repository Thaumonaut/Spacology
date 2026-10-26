'use strict';
// Headless A/B of ?cliffs=fine against the default terrain, same camera. Serve the repo first (python3 -m http.server $PORT).
// Usage: [BACK=m] [ZOOM=clicks] [ONLY=walk|map TAG=name] node tools/__cliffs-shot.cjs <name> <cliffX> <cliffZ> <valleyX> <valleyZ>
// Headless, with the GPU (ANGLE Metal): software GL never finishes streaming the walk view.
const { chromium } = require('playwright');
const M = require('../prototypes/labs/microvoxel-world/voxel-world-model.js');
const OUT=require('path').join(__dirname,'../artifacts/anime-cliffs'),PORT=process.env.PORT||8791;
const [name,cx,cz,vx,vz]=[process.argv[2],...process.argv.slice(3).map(Number)];
const dx=cx-vx,dz=cz-vz,l=Math.hypot(dx,dz),back=Number(process.env.BACK||35);
const eye={x:vx-dx/l*back,z:vz-dz/l*back},yaw=Math.atan2(-dx,-dz);
const views0=[['walk',M.positionAt(eye.x,eye.z),`&walk=1&yaw=${yaw}`,0],['map',M.positionAt((cx+vx)/2,(cz+vz)/2),`&yaw=${yaw}`,Number(process.env.ZOOM||0)]];
const views=process.env.ONLY?views0.filter(v=>v[0]===process.env.ONLY).map(v=>[process.env.TAG||v[0],...v.slice(1)]):views0;
(async()=>{
  const browser=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
  for(const [view,p,extra,zoomOut] of views)for(const [v,flag] of [['a',''],['b','&cliffs=fine']]){
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    page.on('pageerror',e=>console.log('PAGEERR',e.message));
    await page.goto(`http://127.0.0.1:${PORT}/prototypes/microvoxel-world.html?seed=2718&cx=${p.cx}&cz=${p.cz}&lx=${p.x}&lz=${p.z}${extra}${flag}`);
    const ready=()=>page.waitForFunction(()=>{const s=window.MicroWorldLab&&window.MicroWorldLab.snapshot();return s&&!s.failed&&s.ready>0&&s.ready>=s.visible*.98&&!s.pending;},null,{timeout:45000}).catch(()=>console.log('ready-timeout',view,v));
    await ready();
    for(let k=0;k<zoomOut;k++){await page.click('#zoomOut');}
    if(zoomOut){await page.waitForTimeout(500);await ready();}
    await page.waitForTimeout(2500);
    await page.locator('#world').screenshot({path:`${OUT}/${name}-${view}-${v}.png`,timeout:120000});
    console.log('shot',name,view,v);await page.close();
  }
  await browser.close();
})().catch(e=>{console.log('ERR',e);process.exit(1);});
