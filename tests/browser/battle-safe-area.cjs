const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';

(async()=>{
  const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
  try{
    const page=await browser.newPage({viewport:{width:1024,height:768},serviceWorkers:'block'});
    await page.goto(base+'/prototypes/spacology-v0.1.0.html');
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
    await page.locator('#continueButton').click();
    await page.waitForURL('**/watchable-fight.html?**');
    await page.locator('body.session-mode').waitFor();
    const position=await page.evaluate(()=>{
      document.documentElement.style.setProperty('--game-safe-top','24px');
      document.documentElement.style.setProperty('--game-safe-left','16px');
      return {
        top:document.querySelector('.sessionbar').getBoundingClientRect().top,
        left:document.querySelector('.sessionbar').getBoundingClientRect().left,
        playTop:document.querySelector('#bPlay').getBoundingClientRect().top
      };
    });
    assert.ok(position.top>=24,`Battle header ignores top safe area: ${position.top}px`);
    assert.ok(position.left>=16,`Battle header ignores left safe area: ${position.left}px`);
    assert.ok(position.playTop>=24,`Play control lies within top safe area: ${position.playTop}px`);
    console.log('PASS voyage battle header and controls respect tablet safe areas');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
