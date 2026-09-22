const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const p=await browser.newPage({serviceWorkers:'block',viewport:{width:1024,height:900},hasTouch:true});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    const state=()=>p.evaluate(()=>JSON.parse(localStorage.spacologyRunV010));
    async function seed(extra={}){
      await p.goto(base+'/prototypes/spacology-v0.1.0.html');
      await p.evaluate(extra=>{
        const s=JSON.parse(localStorage.spacologyRunV010);
        Object.assign(s,{field:['Tarn'],support:['Maul','Coda'],reserve:['Bosk'],crewCopies:[],crewUpgrades:{},copyProgression:1,gear:['Recoil Spring','Loaded Die'],equipped:{},scrap:24,crystals:0,gold:100,pack:null,packOffers:['rot','tempo','bulwark'],packRefreshes:0,duplicatePolicy:'ask'},extra);
        localStorage.spacologyRunV010=JSON.stringify(s);
      },extra);await p.reload();await p.locator('#enterOps').click();
    }
    async function inspect(name){await p.locator('[data-tab="gear"]').click();await p.locator(`.item[data-item="${name}"]`).click()}
    await seed();await inspect('Recoil Spring');
    assert.match(await p.locator('.gear-fit-list').first().innerText(),/Maul.*follow-up/s);
    assert.doesNotMatch(await p.locator('.gear-fit-list').first().innerText(),/Coda/);
    await p.locator('[data-equip-detail="Recoil Spring"][data-crew="Maul"]').click();
    assert.deepEqual((await state()).equipped.Maul,['Recoil Spring']);assert.deepEqual((await state()).gear,['Loaded Die']);
    await p.locator('#closeModal').click();await p.locator('[data-gear-owner="Maul"][data-gear-index="0"]').click();
    assert.equal(await p.locator('.gear-detail h2').innerText(),'Recoil Spring');
    await p.locator('[data-remove-detail]').click();assert.deepEqual((await state()).equipped.Maul,[null]);
    assert.equal((await state()).gear.filter(n=>n==='Recoil Spring').length,1);
    console.log('PASS useful crew fit, direct equip, equipped-slot inspection and safe removal');

    await seed({gear:['Recoil Spring'],equipped:{Maul:['Bore Bit','Loaded Die']}});await inspect('Recoil Spring');
    assert(await p.locator('[data-crew="Maul"]').isDisabled());
    await p.locator('.gear-combination summary').click();assert.match(await p.locator('.gear-recipe').innerText(),/Maul, slot 2/);
    const before=await state();await p.locator('#closeModal').click();assert.deepEqual(await state(),before);
    await inspect('Recoil Spring');await p.locator('.gear-combination summary').click();await p.locator('[data-craft="Counterweight"]').click();
    let s=await state();assert.equal(s.scrap,16);assert.deepEqual(s.equipped.Maul,['Bore Bit','Counterweight']);assert.deepEqual(s.gear,[]);
    await p.locator('.gear-dismantle summary').click();await p.locator('#closeModal').click();assert.equal((await state()).scrap,16);
    await p.locator('[data-gear-owner="Maul"][data-gear-index="1"]').click();await p.locator('.gear-dismantle summary').click();await p.locator('[data-dismantle-item]').click();
    s=await state();assert.equal(s.scrap,20);assert.deepEqual(s.equipped.Maul,['Bore Bit',null]);
    console.log('PASS full slots cannot overwrite gear; combination and dismantle previews do not spend resources');

    await seed({gear:['Bore Bit'],scrap:13});await inspect('Bore Bit');
    assert.equal(await p.locator('.gear-combination').count(),2);
    await p.locator('.gear-combination summary').first().click();assert(await p.locator('[data-craft="Survey Lance"]').isDisabled());assert.deepEqual((await state()).gear,['Bore Bit']);
    await seed({gear:['Bore Bit'],scrap:14});await inspect('Bore Bit');await p.locator('.gear-combination summary').first().click();await p.locator('[data-craft="Survey Lance"]').click();
    s=await state();assert.equal(s.scrap,0);assert.deepEqual(s.gear,['Survey Lance']);assert.equal(s.crystals,0);
    await p.reload();await p.locator('#enterOps').click();assert.deepEqual((await state()).gear,['Survey Lance']);
    await seed({gear:[],equipped:{Tarn:['Bore Bit','Quick Latch'],Maul:['Ranging Sight']},scrap:8});
    await p.locator('[data-gear-owner="Tarn"][data-gear-index="0"]').click();await p.locator('.gear-combination summary').first().click();
    assert.match(await p.locator('.gear-recipe').first().innerText(),/Maul, slot 1 becomes empty/);
    await p.locator('[data-craft="Survey Lance"]').click();s=await state();assert.deepEqual(s.equipped.Tarn,['Survey Lance','Quick Latch']);assert.deepEqual(s.equipped.Maul,[null]);
    console.log('PASS make-and-combine exact costs, insufficient funds, save restoration and inspected wearer destination');

    await seed();await p.locator('[data-open="rot"]').click();s=await state();assert.deepEqual(s.packOffers,[null,'tempo','bulwark']);
    const paid=s.gold,contents=s.pack;
    await p.reload();await p.locator('#enterOps').click();assert.equal((await state()).gold,paid);assert.deepEqual((await state()).pack,contents);
    await p.locator('#disposeRemaining').click();assert.equal(await p.locator('[data-open="rot"]').count(),0);assert.equal(await p.locator('.sold-offer').count(),1);
    const sold=await state();await p.evaluate(()=>openPack('rot'));assert.deepEqual(await state(),sold);
    await p.reload();await p.locator('#enterOps').click();assert.equal(await p.locator('.sold-offer').count(),1);
    await p.locator('#refreshPacks').click();s=await state();assert.equal(s.gold,sold.gold-2);assert.equal(s.packOffers.filter(Boolean).length,3);assert.equal(new Set(s.packOffers).size,3);assert.equal(await p.locator('.sold-offer').count(),0);
    await seed({gold:0});const broke=await state();await p.locator('[data-open="rot"]').click();assert.deepEqual(await state(),broke);await p.locator('#refreshPacks').click();assert.deepEqual(await state(),broke);
    console.log('PASS single-use offers, paid-pack reload, stale purchase rejection, refresh and insufficient-gold preservation');

    await seed();await inspect('Recoil Spring');
    for(const size of [{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]){
      await p.setViewportSize(size);assert(await p.locator('#modalBody').evaluate(el=>el.scrollWidth<=el.clientWidth));
    }
    await p.setViewportSize({width:1024,height:900});await p.locator('.modal').screenshot({path:'/tmp/spacology-gear-details.png'});
    await p.locator('.gear-combination summary').click();await p.locator('.modal').screenshot({path:'/tmp/spacology-gear-combination.png'});
    assert.deepEqual(errors,[]);console.log('PASS gear detail fits tablet and phone widths without runtime errors');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
