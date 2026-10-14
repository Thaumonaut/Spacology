// Mini-game hub: every registered game is linked, opens without errors, and a finished puzzle shows on the hub.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const K=require('../../prototypes/minigame-kit.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  const p=await browser.newPage({serviceWorkers:'block',viewport:{width:1024,height:768}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await p.goto(BASE+'/prototypes/minigames.html');await p.evaluate(()=>localStorage.removeItem('spacologyMinigamesV1'));await p.reload();
  assert.equal(await p.locator('.hub-card').count(),K.GAMES.length,'every game is on the hub');
  for(const g of K.GAMES){
    await p.locator(`[data-game="${g.id}"]`).click();await p.waitForURL(new RegExp(g.file));await p.locator('#mgStage').waitFor();
    assert.ok(await p.locator('#mgStage *').count()>0,g.id+' renders a puzzle');
    assert.match(await p.locator('.mg-head h1').innerText(),new RegExp(g.title));
    await p.locator('.mg-head .brand').click();await p.waitForURL(/minigames\.html/);
  }
  // Skipping a puzzle records a session; the hub reports it.
  await p.goto(BASE+'/prototypes/sensor-grid.html?seed=7&difficulty=easy');await p.locator('#mgAuto').click();await p.locator('#mgResult:not([hidden])').waitFor();
  await p.locator('[data-rate="fun"][data-v="4"]').click();
  await p.goto(BASE+'/prototypes/minigames.html');
  assert.match(await p.locator('[data-game="sensor-grid"] .hub-stat').innerText(),/1 played · best Automatic · fun 4\.0/);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)<=1,true,'no horizontal overflow');
  assert.deepEqual(errors,[]);
  console.log('PASS minigames hub: all '+K.GAMES.length+' games linked and open; a finished puzzle and its rating show on the hub.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
