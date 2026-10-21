'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const M=require('../../prototypes/minigames/element-pairs/element-pairs-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';
(async()=>{
  const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
  try{
    const context=await browser.newContext({serviceWorkers:'allow',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
    await page.goto(BASE+'/prototypes/spacology-v0.1.0.html?menu=1');
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:90000});
    await context.setOffline(true);
    await page.locator('#titlePlaytests').click();
    await page.locator('[data-game="element-pairs"]').click();
    await page.locator('[data-cell="0"]').waitFor();
    await page.locator('#mgSeed').fill('42');await page.locator('#mgSeed').press('Tab');
    const count=()=>page.locator('[data-cell]').count();
    assert.equal(await count(),36);
    await page.locator('#epDeal').click();assert.equal(await count(),72);
    await page.locator('#mgUndo').click();assert.equal(await count(),36);
    await page.locator('#mgHint').click();assert.equal(await page.locator('.ep-hinted').count(),2);
    for(const cell of M.pairs(M.start(M.generate(42)))[0])await page.locator(`[data-cell="${cell}"]`).click();
    assert.equal(await count(),34);
    await page.locator('#mgUndo').click();assert.equal(await count(),36);
    await page.reload();assert.equal(await count(),36);
    assert.deepEqual(errors,[],'cached Element Pairs loads and plays without runtime or HTTP errors');
    await context.close();
    console.log('PASS Element Pairs: first visit through the library, deal, hint, match, undo and reload while offline');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
