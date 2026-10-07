// Affix lab smoke test: Brief, requisition, supply, a full voyage, reload persistence, the session log and layout.
// Headless by default; SPACOLOGY_HEADED=1 opts into a visible window. SHOTS=<dir> saves screenshots.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('path');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';
const SHOTS=process.env.SHOTS||null;

async function noOverflow(page,label){
  const over=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(over<=1,`${label}: page scrolls sideways by ${over}px`);
}
async function shot(page,name){if(SHOTS)await page.screenshot({path:path.join(SHOTS,name),fullPage:true});}

(async()=>{
  const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
  const errors=[];
  try{
    const context=await browser.newContext({viewport:{width:1280,height:900}});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('dialog',d=>d.accept());
    await page.goto(BASE+'/prototypes/affix-lab.html');

    // A seeded Brief: two conditions, three bosses, shown before any crew is chosen.
    await page.selectOption('#affixCount','2');
    await page.fill('#seed','41');
    await page.click('#setup button[type=submit]');
    assert.equal(await page.locator('#affixes .affix').count(),2);
    assert.equal(await page.locator('#bosses .boss').count(),3);
    assert.ok(await page.locator('button[data-action=launch]').isDisabled(),'cannot launch before choosing crew');
    await page.fill('#plan','Break shields early, keep a barrier tank.');
    await shot(page,'affix-lab-brief.png');

    // Requisition: anyone can join; two berths are free, and with both full the roster offers to open the next berth.
    const gold=async()=>Number((await page.locator('#status .stat b').first().textContent()).replace('g',''));
    await page.click('button[data-action=hire][data-id=Reva]');
    await page.click('button[data-action=hire][data-id=Sevim]');
    assert.equal(await page.locator('#berths .member:not(.empty)').count(),2);
    const wren=page.locator('button[data-action=hire][data-id=Wren]');
    assert.match(await wren.textContent(),/Open berth 3 and recruit · 12g/);
    await wren.click();
    assert.equal(await page.locator('#berths .member:not(.empty)').count(),3);
    assert.equal(await gold(),0);
    assert.match(await page.locator('button[data-action=hire][data-id=Daven]').textContent(),/Berth 4 costs 20g/);
    assert.ok(await page.locator('button[data-action=hire][data-id=Daven]').isDisabled(),'cannot afford berth 4 yet');

    // The first battle produces a report, including what each condition did and, on a loss, why.
    await page.click('button[data-action=launch]');
    await page.waitForSelector('#reportPanel:not([hidden]) .report');
    assert.equal(await page.locator('#reportPanel .effect').count(),2);
    assert.equal(await page.locator('#reportPanel .effect .impact').count(),2,'each condition says what it did to the score');
    const outcome=await page.locator('#reportPanel .report p.small').first().textContent();
    if(!outcome.startsWith('Cleared'))assert.equal(await page.locator('#reportPanel .why').count(),1,'a loss explains itself');
    await shot(page,'affix-lab-report.png');

    // Supply: buy, fit and reroll.
    const before=await gold();
    await page.locator('#offers button[data-action=buy]').first().click();
    assert.equal(await gold(),before-5);
    assert.equal(await page.locator('#hold .piece').count(),1);
    await page.locator('#hold button[data-action=equip]').first().click();
    assert.equal(await page.locator('#berths .slot.filled').count(),1);
    if(!(await page.locator('#reroll').isDisabled()))await page.click('#reroll');

    // Reload keeps the voyage.
    const battle=await page.locator('#status .stat b').nth(3).textContent();
    await page.reload();
    assert.equal(await page.locator('#status .stat b').nth(3).textContent(),battle);
    assert.equal(await page.inputValue('#plan'),'Break shields early, keep a barrier tank.');

    // Play out the voyage, then save it to the cross-session log.
    for(let i=0;i<12&&await page.locator('button[data-action=launch]').count();i++){
      const launch=page.locator('button[data-action=launch]');
      if(await launch.isDisabled())break;
      await launch.click();
    }
    await page.waitForSelector('#summary:not([hidden])');
    await page.selectOption('#agency','4');
    await page.selectOption('#excitement','3');
    await page.fill('#outcome','Sevim carried the Carapace fight.');
    await page.click('button[data-action=logSession]');
    assert.equal(await page.locator('#sessions tbody tr').count(),1);
    await shot(page,'affix-lab-summary.png');
    await noOverflow(page,'desktop');

    // A second voyage shows how much of the crew carried over.
    await page.fill('#seed','42');
    await page.click('#setup button[type=submit]');
    await page.click('button[data-action=hire][data-id=Reva]');
    await page.click('button[data-action=hire][data-id=Daven]');
    for(let i=0;i<12;i++){const l=page.locator('button[data-action=launch]');if(!(await l.count())||await l.isDisabled())break;await l.click();}
    await page.click('button[data-action=logSession]');
    assert.equal(await page.locator('#sessions tbody tr').count(),2);
    assert.match(await page.locator('#sessions tbody tr').nth(1).textContent(),/1 of 2/);

    // A saved voyage whose conditions contradict each other is rerolled on load from the same seed, with an explanation.
    await page.evaluate(()=>{
      const s=JSON.parse(localStorage.spacologyAffixLabV1);
      s.brief={affixes:['bare','brutal','hardened','wither'],bosses:['carapace','brood','mirror']};s.affixCount=4;s.seed=777;
      localStorage.spacologyAffixLabV1=JSON.stringify(s);
    });
    await page.reload();
    assert.match(await page.textContent('#message'),/contradicted each other/);
    assert.equal(await page.inputValue('#seed'),'777');
    assert.equal(await page.locator('#affixes .affix').count(),4);
    assert.ok(await page.evaluate(()=>AffixLab.legalBrief(JSON.parse(localStorage.spacologyAffixLabV1).brief)));

    // Phone and tablet widths do not scroll sideways.
    for(const [w,h] of [[390,844],[820,1180]]){
      await page.setViewportSize({width:w,height:h});
      await noOverflow(page,`${w}px`);
    }
    await shot(page,'affix-lab-phone.png');
    assert.deepEqual(errors,[]);
    console.log('PASS affix-lab browser');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
