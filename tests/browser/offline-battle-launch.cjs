const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';

(async()=>{
  const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
  try{
    const context=await browser.newContext({serviceWorkers:'allow'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/prototypes/spacology-v0.1.0.html');
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await page.locator('#titleNewVoyage').click();
    await page.locator('[data-difficulty="standard"]').click();
    await page.locator('[data-menu="depart"]').click();
    await page.locator('[data-node-reward="0"]').click();
    await page.evaluate(()=>{
      const state=JSON.parse(localStorage.spacologyRunV010);
      state.field=['Tarn','Bosk'];state.support=['Coda'];state.reserve=[];
      localStorage.spacologyRunV010=JSON.stringify(state);
    });
    await page.reload();
    await page.locator('#enterOps').click();
    await context.setOffline(true);
    await page.locator('#continueButton').click();
    await page.waitForURL('**/watchable-fight.html?**');
    await page.locator('body.session-mode').waitFor();
    assert.equal(await page.locator('#sessionRound').innerText(),'NODE 2 / 21');
    await page.evaluate(()=>cancelSessionAutostart());
    if(!await page.evaluate(()=>playing))await page.locator('#bPlay').click();
    await page.waitForFunction(()=>G.actions>0,null,{timeout:10000});
    assert.deepEqual(errors,[]);
    console.log('PASS offline Ops launch opens battle from cache and combat starts');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
