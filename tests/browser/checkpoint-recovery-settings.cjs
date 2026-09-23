const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';
(async()=>{
  const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
  const failures=[];
  try{
    for(const action of ['select','defaults']){
      const context=await browser.newContext({serviceWorkers:'block'});
      try{
        const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
        await p.goto(base+'/prototypes/spacology-v0.1.0.html');
        await p.locator('#titleNewVoyage').click();await p.locator('[data-menu="depart"]').click();await p.locator('[data-node-reward="0"]').click();
        const original=action==='select'?'revive':'none';
        await p.evaluate(mode=>{
          const s=JSON.parse(localStorage.spacologyRunV010);s.field=['Tarn'];s.support=[];s.reserve=[];s.downRecovery=mode;s.lastStand=false;
          localStorage.spacologyRunV010=JSON.stringify(s);SpacologyPreferences.save({...SpacologyPreferences.load(),autoBattle:false,recovery:mode});
        },original);
        await p.reload();await p.locator('#enterOps').click();await p.locator('#continueButton').click();await p.waitForURL('**/watchable-fight.html?**');
        await p.locator('#sessionMenu').click();await p.getByRole('heading',{name:'Battle paused',exact:true}).waitFor();await p.locator('[data-menu="home"]').click();await p.waitForURL('**/spacology-v0.1.0.html?menu=1');
        await p.locator('#titleSettings').click();
        if(action==='select'){
          const selector=p.locator('[data-preference="recovery"]');if(await selector.isEnabled())await selector.selectOption('none');
        }else{await p.locator('[data-menu="reset-settings"]').click();await p.locator('[data-menu="confirm"]').click();}
        await p.keyboard.press('Escape');await p.locator('#enterOps').click();await p.waitForURL('**/watchable-fight.html?**');
        assert.equal(await p.locator('#hState').textContent(),'saved battle');
        assert.equal(await p.evaluate(()=>SpacologyDownRecovery.mode(SPACOLOGY_SESSION)),original,action+' must preserve the suspended battle recovery mode');
        assert.deepEqual(errors,[]);console.log('PASS suspended recovery remains locked after '+action);
      }catch(error){failures.push(error);console.error(error.message);}finally{await context.close();}
    }
    if(failures.length)throw new AggregateError(failures,'Suspended battle settings changed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
