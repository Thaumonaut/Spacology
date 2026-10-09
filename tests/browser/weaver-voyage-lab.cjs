// Weaver voyage lab: plays the first seven nodes through the screen flow, headlessly.
// Serve the repository root (python3 -m http.server 4173 --bind 127.0.0.1), then: node tests/browser/weaver-voyage-lab.cjs
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
async function noOverflow(p,where){const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`)}
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    const tag=viewport.width,p=await browser.newPage({serviceWorkers:'block',viewport});const errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    const primary=p.locator('#primary'),shot=async n=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/weaver-${n}-${tag}.png`,fullPage:true})};
    await p.goto(BASE+'/prototypes/weaver-voyage-lab.html');await p.evaluate(()=>localStorage.removeItem('spacologyWeaverVoyageLabV1'));await p.reload();

    // Departure: the Brief, two starters, one primary action.
    // The Brief: two affixes by default, each with its tax and gift; the player picks the count.
    assert.equal(await p.locator('.affix').count(),2);assert.match(await p.locator('.affix').first().innerText(),/Tax/);
    await p.locator('[data-count="0"]').click();assert.match(await p.locator('.brief').innerText(),/No affixes/);
    await p.locator('[data-count="4"]').click();assert.equal(await p.locator('.affix').count(),4);
    await p.locator('[data-count="2"]').click();assert.equal(await p.locator('.affix').count(),2);assert.equal(await p.locator('.bosses > div').count(),3);
    assert.equal(await primary.isDisabled(),true);
    await p.locator('[data-pick="Hanae"]').click();await p.locator('[data-pick="Arunima"]').click();
    assert.match(await primary.innerText(),/Depart with Hanae and Arunima/);
    await p.locator('[data-count="1"]').click();assert.match(await primary.innerText(),/Depart with Hanae and Arunima/,'changing the count keeps your picks');await p.locator('[data-count="2"]').click();await noOverflow(p,'departure');await shot('departure');
    await primary.click();

    // Prepare → fight → result.
    assert.match(await p.locator('#screen').innerText(),/node 2/i);assert.match(await primary.innerText(),/Launch supply run battle/);assert.match(await p.locator('#screen').innerText(),/No deadline/,'a Supply run says it has no deadline');
    await noOverflow(p,'prepare');await shot('prepare');
    assert.match(await p.locator('#screen').innerText(),/◆/,'shield layers shown before the fight');
    const battle=async(name)=>{await primary.click();await p.locator('#vPool .pip').first().waitFor();
      if(name)await shot(name);await p.locator('#vSkip').click();assert.match(await primary.innerText(),/See the result/);await primary.click();
      await p.locator('.band').waitFor();assert.match(await p.locator('#screen').innerText(),/Affixes[\s\S]*:/,'per-affix report');assert.ok(await p.locator('.why li').count()>=1,'result explains the fight');
      assert.equal(await p.locator('[data-take]').count(),3,'three pieces to choose from');assert.equal(await primary.isDisabled(),true,'must choose a drop first');
      await p.locator('[data-take]').first().click();assert.match(await p.locator('#screen').innerText(),/Took /);};
    await battle('fight');await noOverflow(p,'result');await shot('result');
    await primary.click();

    // Equipment: tap a piece, tap a highlighted slot; set progress appears.
    assert.equal(await p.locator('[data-tab="equipment"]').getAttribute('aria-selected'),'true','after a drop, Prepare opens on Equipment');
    assert.equal(await p.locator('.setcard').count(),11,'all eleven set perks are shown');assert.ok(await p.locator('.setcard .faces img').count()>=9,'each set shows who it suits');
    assert.ok(await p.locator('.piece .faces img').count()>=2,'pieces show who their set suits');
    assert.match(await p.locator('.piece .verdict').first().innerText(),/Upgrade for|No upgrade/);
    await p.locator('.piece').first().click();assert.equal(await p.locator('.compare .cmprow').count(),2,'compares against every crewmate');
    assert.match(await p.locator('.compare').innerText(),/Now[\s\S]*(Empty slot|%)/);assert.ok(await p.locator('[data-put]').count()>=2);
    await shot('equip');await p.locator('[data-put]').first().click();
    assert.equal(await p.locator('.piece').count(),0);assert.match(await p.locator('#tabBody').innerText(),/1\/5 — needs/);assert.ok(await p.locator('.gearrow .q').count()>=1,'equipped piece shows quality');
    assert.match(await p.locator('#tabBody').innerText(),/Wants:/);assert.ok(await p.locator('.gearrow .gstats').count()>=1,'equipped stats are listed');
    await noOverflow(p,'equipment');

    // Caches from the Supply run wait in a tray: tap opens one, a press-and-drag opens every cache it crosses, Open all the rest.
    assert.equal(await p.locator('[data-cache]').count(),4,'the Supply run dropped four caches');await shot('caches');
    await p.locator('[data-cache]').first().click();await p.locator('.reveal li').first().waitFor();
    assert.equal(await p.locator('[data-cache]').count(),3,'a tap opens one cache');assert.equal(await p.locator('.reveal li').count(),1);
    const box=async i=>{const b=await p.locator('[data-cache]').nth(i).boundingBox();return [b.x+b.width/2,b.y+b.height/2]};
    const [x0,y0]=await box(0),[x1,y1]=await box(1);await p.mouse.move(x0,y0);await p.mouse.down();await p.mouse.move((x0+x1)/2,(y0+y1)/2,{steps:4});await p.mouse.move(x1,y1,{steps:4});
    assert.equal(await p.locator('.cache.armed').count(),2,'dragging arms each cache it crosses');await p.mouse.up();
    await p.waitForFunction(()=>document.querySelectorAll('[data-cache]').length===1);assert.equal(await p.locator('.reveal li').count(),2,'a drag opens them together');
    await p.locator('#cacheTray [data-cache]').first().focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>!document.querySelector('[data-cache]'));
    assert.match(await p.locator('.caches').innerText(),/\+\d+ Gold|Writ|voucher|★/,'the reveal says what came out');await noOverflow(p,'caches');

    // Quick equip puts every upgrade on; afterwards the button has nothing left to do.
    await p.locator('[data-tab="equipment"]').click();
    if(await p.locator('#quickEquip').isEnabled()){await p.locator('#quickEquip').click();assert.match(await p.locator('#message').innerText(),/Quick equip: \d+ piece/)}
    assert.equal(await p.locator('#quickEquip').isDisabled(),true,'no upgrades left after quick equip');assert.equal(await p.locator('.verdict.up').count(),0);

    // Second Supply run, swarm, elite.
    assert.match(await primary.innerText(),/Launch supply run battle/);
    await battle();await primary.click();await battle();await primary.click();await battle();await primary.click();

    // Reward: choose the free voucher, then recruit Ivara with it.
    await p.locator('[data-choose="voucher"]').click();assert.match(await primary.innerText(),/free voucher/i);await primary.click();
    assert.equal(await p.locator('[data-tab="recruit"]').getAttribute('aria-selected'),'true');
    await p.locator('[data-buy="Ivara"]').click();
    await p.locator('[data-tab="crew"]').click();assert.match(await p.locator('#tabBody').innerText(),/Ivara/);
    // Stars: the HUD shows Insight; each crewmate shows stars and a promote button, enabled once Insight covers it.
    assert.match(await p.locator('#hud').innerText(),/Insight/);assert.ok(await p.locator('.starrank').count()>=3,'every crewmate shows stars');
    await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('spacologyWeaverVoyageLabV1'));v.insight=2;localStorage.setItem('spacologyWeaverVoyageLabV1',JSON.stringify(v))});
    await p.reload();await p.locator('[data-tab="crew"]').click();await p.locator('[data-promote]').first().click();
    assert.match(await p.locator('#message').innerText(),/is now ★2/);assert.match(await p.locator('#tabBody').innerText(),/★★☆☆/);
    const hud=await p.locator('#hud').innerText();assert.match(hud,/3\s*crew/);const cap=await p.evaluate(()=>WeaverVoyage.capacityPreview(JSON.parse(localStorage.getItem('spacologyWeaverVoyageLabV1'))).total);assert.match(hud,new RegExp(cap+'\\s*Aether cap'));

    // Release refunds Writs: a swap costs one.
    const writsBefore=+(await p.locator('#hud .chip',{hasText:'Writs'}).innerText()).match(/\d+/)[0];
    // Give Ivara first claim on the pool; after releasing her the select must not go blank (priority falls back to auto).
    await p.locator('#priority').selectOption('Ivara');
    const rel=p.locator('[data-release="Ivara"]');assert.match(await rel.innerText(),/\+1 Writ\b/);await rel.click();await p.locator('[data-release="Ivara"]').click();
    assert.match(await p.locator('#message').innerText(),/released for 1 Writ\b/);
    assert.equal(await p.locator('#priority').inputValue(),'auto','releasing the priority crewmate resets the pool claim to auto');
    assert.equal(+(await p.locator('#hud .chip',{hasText:'Writs'}).innerText()).match(/\d+/)[0],writsBefore+1);
    await p.locator('[data-tab="recruit"]').click();await p.locator('[data-buy="Ivara"]').click();
    assert.equal(+(await p.locator('#hud .chip',{hasText:'Writs'}).innerText()).match(/\d+/)[0],writsBefore-1,'the swap cost one Writ');
    // Packs: open one, see NEW pieces, scrap the weak ones in bulk.
    await p.locator('[data-tab="equipment"]').click();const holdBefore=await p.locator('#tabBody .hold .piece').count();
    assert.equal(await p.locator('[data-pack]').count(),13,'thirteen two-set pack types');
    const pk=p.locator('[data-pack="deephold+overdraw"]');assert.equal(await pk.isDisabled(),false,'enough Gold for a pack by node 7');await pk.click();
    const opened=await p.locator('#tabBody .hold .piece').count()-holdBefore;assert.equal(opened,5,'a pack holds five pieces');
    const newSets=await p.locator('.piece:has(.new) .ptop b').allInnerTexts();assert.ok(newSets.every(t=>/Deep Hold|Overdraw/.test(t)),'pieces come from the label\'s sets');
    assert.equal(await p.locator('.piece .new').count(),opened);await shot('pack');
    // Quick scrap: one tap per piece, and auto-scrap on pack open.
    const n0=await p.locator('#tabBody .hold .piece').count(),g0=+(await p.locator('#hud .chip',{hasText:'Gold'}).innerText()).match(/\d+/)[0];
    await p.locator('[data-qscrap]').first().click();assert.equal(await p.locator('#tabBody .hold .piece').count(),n0-1);
    assert.equal(+(await p.locator('#hud .chip',{hasText:'Gold'}).innerText()).match(/\d+/)[0],g0+1);
    await p.locator('#autoScrap').check();const pk2=p.locator('[data-pack="wellspring+deephold"]');
    if(!(await pk2.isDisabled())){await pk2.click();assert.match(await p.locator('#message').innerText(),/kept \d+, scrapped \d+/);
      assert.equal(await p.locator('.piece:has(.new) .verdict.scrap').count(),0,'auto-scrap leaves no non-upgrades from the pack')}
    await p.locator('#cut').selectOption('0.7');if(!(await p.locator('#scrapBelow').isDisabled())){await p.locator('#scrapBelow').click();assert.match(await p.locator('#message').innerText(),/Scrapped \d+ pieces/)}
    await noOverflow(p,'packs');
    // Writ fund: pay in a little at a time.
    await p.locator('[data-tab="recruit"]').click();const fund0=+(await p.locator('.fund .small').last().innerText()).match(/^(\d+)/)[1];
    await p.locator('[data-invest="1"]').click();assert.match(await p.locator('.fund').innerText(),new RegExp('^[\\s\\S]*'+(fund0+1)+' / 18'));
    assert.match(await p.locator('#hud').innerText(),new RegExp('fund '+(fund0+1)+'/18'));await noOverflow(p,'fund');
    // Reload keeps the voyage; export carries the purchase log.
    await p.reload();assert.match(await p.locator('#screen').innerText(),/node 7/i);assert.match(await primary.innerText(),/Launch boss fight/);
    await p.locator('#openExport').click();const json=JSON.parse(await p.locator('#drawer textarea').inputValue());
    assert.equal(json.lab,'weaver-voyage');assert.ok(json.voyage.purchases.some(x=>x.id==='Ivara'&&x.source==='free voucher'));
    await noOverflow(p,'export');
    // Restart mid-voyage: two taps, back to departure with the same Brief and seed.
    await p.locator('#openRestart').click();await p.locator('#restartSame').click();assert.match(await p.locator('#restartSame').innerText(),/Tap again/);
    await p.locator('#restartSame').click();assert.match(await p.locator('#screen').innerText(),/pick two crew/i);assert.match(await p.locator('#hud').innerText(),/0\s*crew/);
    await p.locator('[data-pick="Hanae"]').click();await p.locator('[data-pick="Arunima"]').click();await primary.click();
    await primary.click();await p.locator('#vSkip').click();await primary.click();await p.locator('[data-take]').nth(1).click();
    await p.reload();assert.match(await p.locator('#screen').innerText(),/node 3[\s\S]*Supply run/i,'reload after taking a drop resumes at the next node');
    // The final fight's caches: the result says they stay unopened instead of promising a Prepare screen.
    await p.evaluate(()=>{const M=WeaverVoyage,v=M.create({seed:7,affixes:[]});M.act(v,{type:'starters',ids:['Hanae','Arunima']});v.node=21;M.act(v,{type:'launch'});delete v.lastFight;
      if(!v.fights.at(-1).caches.length)v.fights.at(-1).caches=[3];v.meta={startedAt:Date.now()};v.feedback={};localStorage.setItem('spacologyWeaverVoyageLabV1',JSON.stringify(v))});
    await p.reload();await p.locator('.band').waitFor();const endText=await p.locator('#screen').innerText();
    assert.match(endText,/unopened — the voyage has ended/);assert.doesNotMatch(endText,/open them in Prepare/);
    assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS weaver voyage lab flow: departure, prepare, fight, result with reasons, tap-to-equip with set progress, two Supply runs, reward voucher, recruit, HUD capacity, reload, export; no overflow at 1280 and 390');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
