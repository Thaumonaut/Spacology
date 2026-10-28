'use strict';
// Headless A/B of the ground look: the same camera with the default ground and with ?ground=<variant>. Serve the repo
// first (python3 -m http.server $PORT). Headless with the GPU (ANGLE Metal); software GL never finishes streaming walk views.
// B adds FLAG (default ground=paint) to the URL; OUT names the artifacts folder (default anime-ground).
// VIEWS: comma list of walk,map,wide (default all). WAIT: seconds to let streaming finish (default 45).
// Usage: [PORT=8791] [WAIT=45] [FLAG=ground=paint] [OUT=anime-ground] [ONLY=a|b] node tools/__ground-shot.cjs <name> <seed> <x> <z> <lookX> <lookZ>
// Shots: walk (standing at x,z facing the look point), map (close site view) and wide (map zoomed out 4 clicks).
const { chromium } = require('playwright');
const M = require('../prototypes/labs/microvoxel-world/voxel-world-model.js');
const OUT=require('path').join(__dirname,'../artifacts',process.env.OUT||'anime-ground'),PORT=process.env.PORT||8791,FLAG=process.env.FLAG||'ground=paint';
const [name,seed,x,z,lx,lz]=[process.argv[2],...process.argv.slice(3).map(Number)];
const yaw=Math.atan2(-(lx-x),-(lz-z)),p=M.positionAt(x,z);
const views=[['walk','&walk=1',0],['map','',0],['wide','',4]].filter(v=>!process.env.VIEWS||process.env.VIEWS.split(',').includes(v[0]));
(async()=>{
  require('fs').mkdirSync(OUT,{recursive:true});
  const browser=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
  for(const [view,extra,zoomOut] of views)for(const [v,flag] of [['a',''],['b',`&${FLAG}`]]){
    if(process.env.ONLY&&process.env.ONLY!==v)continue;
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    page.on('pageerror',e=>console.log('PAGEERR',e.message));
    await page.goto(`http://127.0.0.1:${PORT}/prototypes/microvoxel-world.html?seed=${seed}&cx=${p.cx}&cz=${p.cz}&lx=${p.x}&lz=${p.z}&yaw=${yaw}${extra}${flag}`);
    const ready=()=>page.waitForFunction(()=>{const s=window.MicroWorldLab&&window.MicroWorldLab.snapshot();return s&&!s.failed&&s.ready>0&&s.ready>=s.visible*.98&&!s.pending;},null,{timeout:Number(process.env.WAIT||45)*1000}).catch(()=>console.log('ready-timeout',view,v));
    await ready();
    for(let k=0;k<zoomOut;k++)await page.click('#zoomOut');
    if(zoomOut){await page.waitForTimeout(500);await ready();}
    await page.waitForTimeout(2500);
    await page.locator('#world').screenshot({path:`${OUT}/${name}-${view}-${v}.png`,timeout:120000});
    console.log('shot',name,view,v);await page.close();
  }
  await browser.close();
})().catch(e=>{console.log('ERR',e);process.exit(1);});
