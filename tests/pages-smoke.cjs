// @manual: npm run build:pages && npm run test:pages (requires the generated artifact)
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{start}=require('./serve.cjs');
const entries=require('../prototypes/library/catalogue.js');
(async()=>{
  const root=path.resolve(__dirname,'../dist');assert.ok(fs.existsSync(path.join(root,'expedition/index.html')),'build Pages first');
  for(const excluded of ['node_modules','.git','tests','artifacts','game','runner-next'])assert.ok(!fs.existsSync(path.join(root,excluded)),'not published: '+excluded);
  const site=await start({port:0,root,prefix:'/Spacology/'});
  const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
  try{
    const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    for(const e of entries){const r=await context.request.get(new URL(e.file,site.url+'/prototypes/').href);assert.equal(r.status(),200,e.file);}
    for(const e of entries.filter(e=>e.category!=='Reference')){
      await page.goto(new URL(e.file,site.url+'/prototypes/').href,{waitUntil:'networkidle'});
      if(e.station)await page.locator('#mgStage').waitFor();
      if(e.id==='expedition'){
        await page.getByRole('button',{name:/^Research/}).click();
        await page.locator('#open-study').click();
        await page.frameLocator('iframe[title="Aether attunement boss study"]').locator('#mgStage').waitFor();
      }
      if(e.id==='runner-next')await page.locator('canvas').waitFor();
    }
    assert.deepEqual(errors,[],'all current entries load under the Pages project prefix');await context.close();
    const offline=await browser.newContext({serviceWorkers:'allow'}),p=await offline.newPage();
    p.on('pageerror',e=>errors.push(e.message));
    await p.goto(site.url+'/prototypes/spacology-v0.1.0.html?menu=1');
    await p.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:90000});
    await offline.setOffline(true);
    await p.locator('#titlePlaytests').click();await p.locator('[data-game="sensor-grid"]').click();
    await p.locator('#mgStage').waitFor();await p.locator('#mgAuto').click();await p.locator('#mgResult:not([hidden])').waitFor();
    await p.goto(site.url+'/prototypes/watchable-fight.html');await p.locator('#fab').click();
    await p.waitForFunction(()=>G.actions>0);assert.deepEqual(errors,[],'offline station game and animated battle');
    await p.goto(site.url+'/prototypes/microvoxel-world.html');
    await p.waitForFunction(()=>{const s=window.MicroWorldLab?.snapshot();return s&&!s.failed&&s.ready===s.visible&&s.ready>0;},null,{timeout:60000});
    assert.deepEqual(errors,[],'offline microvoxel page and worker load under project prefix');
    await offline.close();
    console.log(`PASS Pages: ${entries.length} destinations; current pages, embedded puzzle, runner and offline library/battle under /Spacology/`);
  }finally{await browser.close();await site.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
