// Rocket loading (file keeps the pallet-stacking name), headless at desktop, iPad landscape and phone widths.
// Voyage: legs and arrivals, the tapered fairings drawn with blocked shoulders, undo, hint, the #psPreview line, then a
// full voyage played by taps from the model's par plan (placements, launches, builds, refits, upgrades, end of leg) to
// Perfect, checking liftoff, rockets in orbit and back, bay destination tags and the per-destination output; then Skip
// (auto). On desktop: destinations and sample crates, the taper refusing a tall crate, the End-leg guard and settings.
// Single launch (practice): clear the dock by taps to Perfect with every fairing FULL; on desktop also a greedy dead end
// with its near-miss line.
// Run with `node tests/run.cjs pallet-stacking`, or serve the repo root on 4173 and run this file. SHOTS=dir saves screenshots.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const P=require('../../prototypes/minigames/pallet-stacking/pallet-stacking-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
async function noOverflow(p,where){const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
const RUNS=[{viewport:{width:1280,height:900},difficulty:'normal',seed:3},{viewport:{width:1024,height:768},difficulty:'hard',seed:4},{viewport:{width:390,height:844},difficulty:'easy',seed:7}];
const STORE='spacologyPalletVoyageSettingsV1';
// A normal seed whose leg-1 dock has a 1-wide good (alone at the edge of a 3-wide hopper it is off-centre).
const TIP=(()=>{for(let seed=1;seed<99;seed++){const V=P.createVoyage(seed,'normal',{par:false});const id=V.dock.find(i=>V.items[i].w===1&&!P.checkAct(V,{type:'place',item:i,vehicle:0,x:0}));if(id!=null)return {seed,item:id};}})();
// A normal seed whose leg-1 dock has both a gear crate and a sample crate that each fit the first hopper.
const MIX=(()=>{for(let seed=1;seed<199;seed++){const V=P.createVoyage(seed,'normal',{par:false});const fit=d=>V.dock.find(i=>V.items[i].dest===d&&[0,1,2].some(x=>!P.checkAct(V,{type:'place',item:i,vehicle:0,x})));
  const f=fit('front'),l=fit('lab');if(f!=null&&l!=null)return {seed,front:f,lab:l};}})();
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  for(const {viewport,difficulty,seed} of RUNS){
    const tag=viewport.width,p=await browser.newPage({serviceWorkers:'block',viewport}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async n=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/pallet-${n}-${tag}.png`,fullPage:true});};
    const open=async(sd,d)=>{await p.goto(`${BASE}/prototypes/pallet-stacking.html?seed=${sd}&difficulty=${d}`);await p.locator('#psDock .ps-card').first().waitFor();};
    await p.goto(`${BASE}/prototypes/pallet-stacking.html`);await p.evaluate(()=>localStorage.clear());
    await open(seed,difficulty);
    const V=P.createVoyage(seed,difficulty),R=P.createVoyage(seed,difficulty,{par:false});
    const meters=()=>p.locator('#mgMeters').innerText(),legIs=async n=>assert.match(await meters(),new RegExp(`LEG\\s*${n}/`,'i'));
    assert.match(await meters(),new RegExp(`LEG\\s*1/${V.legs}`,'i'));assert.match(await meters(),new RegExp(`PAR\\s*${V.par}`,'i'));assert.match(await meters(),/ROCKETS\s*2\/5/i);
    assert.equal(await p.locator('#psDock .ps-card').count(),V.arrivals[0].length,'leg 1 goods on the dock');
    assert.equal(await p.locator('[data-pallet-box]').count(),2,'the default pad starts with two rockets');
    assert.equal(await p.locator('[data-pallet-box] .ps-ptitle b',{hasText:'Hopper'}).count(),2,'every rocket starts as a hopper');
    // The taper: each 3-wide hopper fairing has its two shoulder cells blocked and drawn.
    assert.equal(await p.locator('[data-pallet-box="0"] .ps-block').count(),2,'hatched shoulders');
    {const b=await p.locator('[data-pallet-box="0"] .ps-block').first().boundingBox(),bay=await p.locator('[data-pallet-box="0"] .ps-bay').boundingBox();assert.ok(Math.abs(b.y-bay.y)<3&&b.x-bay.x<3,'the shoulder sits in the top corner');}
    assert.match(await p.locator('[data-pallet-box="0"] .ps-dest').innerText(),/Open bay/i);
    // The grouped hangar: one group per rocket with its route, its refit and at most three upgrades on show.
    assert.equal(await p.locator('.ps-group').count(),2);assert.equal(await p.locator('.ps-group').first().locator('.ps-node').count(),3);
    assert.match(await p.locator('#psDepotTitle').innerText(),/HANGAR/);
    assert.match(await p.locator('[data-upgrade="0:stage"]').innerText(),/Refit → Lifter[\s\S]*40 cr[\s\S]*fairing 3×3→4×3 \(7→10 cells\), payload 8→16/);
    assert.ok(await p.locator('.ps-group').first().locator(':scope > .ps-shop .ps-shopitem').count()<=4);
    assert.equal(await p.locator('#psSettings').getAttribute('open'),'','settings open before the first voyage');
    const cw=await p.locator('.ps-col').first().boundingBox();assert.ok(cw.width>=40&&cw.height>=120,`column target ${cw.width}x${cw.height}`);
    await noOverflow(p,'voyage start '+tag);await shot('voyage-start');
    const col=(a,items=R.items)=>p.locator(`.ps-col[data-pallet="${a.vehicle}"][data-col="${P.columnFor({crates:items},a.item,a.x)}"]`);
    const tap=async a=>{
      if(a.type==='place'){await p.locator(`.ps-card[data-crate="${a.item}"]`).click();await col(a).click();}
      else if(a.type==='depart')await p.locator(`[data-depart="${a.vehicle}"]`).click();
      else if(a.type==='buy')await p.locator('[data-buy]').click();
      else if(a.type==='upgrade'){const b=p.locator(`[data-upgrade="${a.vehicle}:${a.kind}"]`);if(!(await b.isVisible()))await p.locator(`[data-group="${a.vehicle}"] .ps-more summary`).click();await b.click();}
      else if(a.type==='scrap')await p.locator(`[data-scrap="${a.item}"]`).click();
      else if(a.type==='end'){await p.locator('#psEndLeg').click();if(await p.locator('#psGuard').isVisible())await p.locator('#psGuardKeep').click();}
    };

    // Undo, lift and the hover preview line (it must not overwrite the "lifted" status).
    const first=V.parActions.find(a=>a.type==='place');
    await tap(first);assert.equal(await p.locator('[data-placed]').count(),1);
    await p.locator(`[data-placed="${first.item}"]`).click();assert.match(await p.locator('#mgStatus').innerText(),/lifted/);
    await col(first).hover();assert.match(await p.locator('#psPreview').innerText(),/would rest at height|✕/);assert.match(await p.locator('#mgStatus').innerText(),/lifted/,'hover preview keeps the status line');
    await p.locator('#mgUndo').click();await p.locator('#mgUndo').click();assert.equal(await p.locator('[data-placed]').count(),0);assert.equal(await p.locator('#mgUndo').isDisabled(),true);
    // Hint: the planner's first action, highlighted.
    await p.locator('#mgHint').click();assert.match(await p.locator('#mgStatus').innerText(),/^Hint: /);
    const h0=V.parActions[0];if(h0.type==='place'){assert.equal(await p.locator(`.ps-card[data-crate="${h0.item}"]`).getAttribute('aria-pressed'),'true');await p.locator(`.ps-card[data-crate="${h0.item}"]`).click();}
    else assert.ok(await p.locator('.ps-hint').count()>=1);

    // Play the par plan by taps, keeping a model copy in step.
    let sawAway=false,sawBuy=false,sawBonus=false,sawTransform=false,sawLab=false,sawLift=false;
    for(const a of V.parActions){
      const dest=a.type==='depart'?P.destOf(R,R.vehicles[a.vehicle]):null;
      await tap(a);assert.equal(P.act(R,a),null);
      if(a.type==='place'){const d=R.items[a.item].dest;assert.equal(await p.locator(`[data-pallet-box="${a.vehicle}"] .ps-dest`).getAttribute('data-dest'),d,'the first crate tags the bay');}
      if(a.type==='end'&&!R.over){
        await legIs(R.leg);
        assert.equal(await p.locator('#psDock .ps-card').count(),R.dock.length,`dock at leg ${R.leg}`);
        const away=R.vehicles.filter(v=>v.away).length;assert.equal(await p.locator('.ps-awaycover').count(),away,`vehicles away at leg ${R.leg}`);
        assert.match(await meters(),new RegExp(`DELIVERED\\s*${R.delivered} cr`,'i'));if(R.bonuses)sawBonus=true;
        if(R.leg===3)await shot('voyage-leg3');
      }
      if(a.type==='depart'){assert.equal(await p.locator(`[data-pallet-box="${a.vehicle}"] .ps-awaycover`).count(),1,'a launched rocket shows its return countdown');sawAway=true;if(dest==='lab')sawLab=true;
        if(!sawLift){sawLift=true;assert.equal(await p.locator(`[data-pallet-box="${a.vehicle}"].leaving`).count(),1,'liftoff animation');assert.match(await p.locator('#mgStatus').innerText(),/Liftoff!/);
          assert.match(await p.locator(`[data-pallet-box="${a.vehicle}"] .ps-away`).innerText(),/back from orbit at leg \d+/);}}
      if(a.type==='buy'){sawBuy=true;assert.equal(await p.locator('[data-pallet-box]').count(),R.vehicles.length);assert.match(await p.locator(`[data-pallet-box="${R.vehicles.length-1}"] .ps-ptitle b`).innerText(),/Hopper/,'a new rocket is a hopper');}
      if(a.type==='upgrade'){const v=R.vehicles[a.vehicle];assert.match(await p.locator(`[data-pallet-box="${a.vehicle}"]`).getAttribute('aria-label'),new RegExp(`${v.width} columns, ${v.height} high`));
        assert.equal(await p.locator(`[data-pallet-box="${a.vehicle}"] .ps-block`).count(),v.cap.filter(h=>h<v.height).length,'the redrawn fairing keeps its taper');
        if(a.kind==='stage'){sawTransform=true;assert.match(await p.locator(`[data-pallet-box="${a.vehicle}"] .ps-transformed`).innerText(),new RegExp(`REFITTED[\\s\\S]*${v.name}`));
          assert.match(await p.locator(`[data-group="${a.vehicle}"] .ps-node.now`).innerText(),new RegExp(v.name));if(!SHOTS)continue;await shot('voyage-transform');}}
    }
    assert.ok(sawAway,'rockets went to orbit and came back');assert.ok(sawBuy||sawTransform,'the par plan grows the pad');assert.ok(sawTransform,'the par plan refits a rocket');assert.ok(sawBonus,'an order paid its bonus');
    assert.ok(sawLab,'samples were launched to the lab');assert.match(await p.locator('#mgSideExtra').innerText(),/FRONT ORDERS[\s\S]*LAB REQUESTS[\s\S]*LAUNCH PAD/i);
    await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Perfect');assert.equal(R.delivered,V.par);
    {const front=R.items.filter(it=>it.status==='shipped'&&it.dest==='front').length,lab=R.items.filter(it=>it.status==='shipped'&&it.dest==='lab').length;
      assert.match(await p.locator('#mgProduces').innerText(),new RegExp(`Launched: ${R.launches} rockets · ${front} crates? to the front · ${lab} samples? to the lab · ${V.par} cr over ${V.legs} legs`));}
    assert.match(await p.locator('#mgStats').innerText(),/Two pads: 2 rockets to start, max 5, price ×1, income ×1/,'settings on the result card');
    const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('spacologyMinigamesV1')).sessions.at(-1));
    assert.match(saved.stats.Settings,/Two pads/);assert.ok(saved.events.some(e=>e.type==='settings'&&e.preset==='fleet'),'settings recorded in the playtest export');
    await noOverflow(p,'voyage result '+tag);await shot('voyage-result');

    // Skip runs the rest of the voyage greedily without buying, below par.
    await p.locator('#mgAgain').click();await p.locator('#mgResult').waitFor({state:'hidden'});
    const V2=P.createVoyage(seed+1,difficulty),auto=P.autoVoyage(P.createVoyage(seed+1,difficulty,{par:false}));
    await p.locator('#mgAuto').click();await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Automatic');assert.match(await p.locator('#mgHeadline').innerText(),new RegExp(`${auto.delivered} cr delivered \\(par ${V2.par}\\)`));
    assert.ok(auto.delivered<V2.par);assert.match(await p.locator('#mgNear').innerText(),/Par was/);

    if(tag===1280){
      // Destinations: a gear crate tags hopper 1 for the front, a sample is then refused; sample cards carry the LAB tag.
      {await open(MIX.seed,'normal');const W0=P.createVoyage(MIX.seed,'normal',{par:false});
        assert.match(await p.locator(`.ps-card[data-crate="${MIX.lab}"] .ps-tag.dest`).innerText(),/Lab/i);assert.match(await p.locator(`.ps-card[data-crate="${MIX.front}"] .ps-tag.dest`).innerText(),/Front/i);
        const fx=[0,1,2].find(x=>!P.checkAct(W0,{type:'place',item:MIX.front,vehicle:0,x}));const fa={type:'place',item:MIX.front,vehicle:0,x:fx};
        await p.locator(`.ps-card[data-crate="${MIX.front}"]`).click();await p.locator(`.ps-col[data-pallet="0"][data-col="${P.columnFor({crates:W0.items},MIX.front,fx)}"]`).click();P.act(W0,fa);
        assert.match(await p.locator('[data-pallet-box="0"] .ps-dest').innerText(),/front/i);
        await p.locator(`.ps-card[data-crate="${MIX.lab}"]`).click();assert.equal(await p.locator('[data-pallet-box="0"] .ps-marks .ok').count(),0,'no ▼ in a fairing bound elsewhere');
        await p.locator('.ps-col[data-pallet="0"][data-col="1"]').click();assert.match(await p.locator('#mgStatus').innerText(),/bound for the front: samples go up to the lab/);
        assert.equal(await p.locator('[data-pallet-box="0"] [data-placed]').count(),1,'a refused sample changes nothing');
        await p.locator(`.ps-card[data-crate="${MIX.lab}"]`).click();}
      // The End-leg guard: every button, Enter and Esc, "don't ask again", the side-panel setting and the can't-launch case.
      await open(21,'normal');const ui=()=>p.evaluate(()=>JSON.parse(JSON.stringify(window.PalletStackingUI.voyage)));
      const spot=async vi=>{const W=await ui();for(const id of W.dock)for(let x=0;x<W.vehicles[vi].width;x++)if(!P.checkAct(W,{type:'place',item:id,vehicle:vi,x})){const T=P.cloneVoyage(W);P.act(T,{type:'place',item:id,vehicle:vi,x});if(!P.departCheck(T,vi))return {type:'place',item:id,vehicle:vi,x};}};
      const put=async vi=>{const a=await spot(vi);const W=await ui();await tap(a);return a;};
      const tapNow=async a=>{const W=await ui();await p.locator(`.ps-card[data-crate="${a.item}"]`).click();await col(a,W.items).click();};
      let a=await spot(0);await tapNow(a);
      await p.locator('#psEndLeg').click();await p.locator('#psGuard').waitFor();assert.match(await p.locator('#psGuardText').innerText(),/The hopper 1 is loaded for the (front|lab) \(\d+ cr\)\. Launch it before ending the leg\?/);
      assert.equal(await p.locator('#psGuardSend').evaluate(el=>el===document.activeElement),true,'Send is focused');await shot('guard');
      await p.keyboard.press('Escape');assert.equal(await p.locator('#psGuard').isHidden(),true);await legIs(1);
      await p.locator('#psEndLeg').click();await p.locator('#psGuardCancel').click();await legIs(1);
      await p.locator('#psEndLeg').click();await p.keyboard.press('Enter');await legIs(2);{const W=await ui();assert.ok(W.lastReport.paid>0&&!W.vehicles[0].load.length,'Enter launched the hopper and its load was delivered');}
      a=await spot(1);await tapNow(a);await p.locator('#psEndLeg').click();await p.locator('#psGuardKeep').click();await legIs(3);
      assert.equal((await ui()).vehicles[1].load.length,1,'Keep leaves the vehicle loaded');
      await p.locator('#psEndLeg').click();await p.locator('#psGuardMute').check();await p.locator('#psGuardKeep').click();await legIs(4);
      await p.locator('#psEndLeg').click();assert.equal(await p.locator('#psGuard').isHidden(),true,"don't ask again");await legIs(5);
      assert.equal(await p.locator('#psGuardPref').isChecked(),false);await p.locator('#psGuardPref').check();
      await p.locator('#psEndLeg').click();await p.locator('#psGuard').waitFor();await p.locator('#psGuardSend').click();await legIs(6);
      // A loaded fairing that is off-centre: the dialog says why and offers only End leg anyway or Cancel.
      {await open(TIP.seed,'normal');await tapNow({type:'place',item:TIP.item,vehicle:0,x:0});
        assert.match(await p.locator('[data-pallet-box="0"] .ps-btext').innerText(),/Off-centre!/);
        await p.locator('#psEndLeg').click();await p.locator('#psGuard').waitFor();
        assert.match(await p.locator('#psGuardText').innerText(),/hopper 1 is loaded but can't launch: it is off-centre: centre of mass 0\.50/);assert.equal(await p.locator('#psGuardSend').isHidden(),true);
        assert.equal(await p.locator('#psGuardKeep').innerText(),'End leg anyway');await p.locator('#psGuardCancel').click();await legIs(1);
        await p.locator('#psEndLeg').click();await p.locator('#psGuardKeep').click();await legIs(2);}
      await open(21,'normal');
      // Settings: presets and custom values change par deterministically and persist.
      const openSettings=async()=>{if(await p.locator('#psSettings').getAttribute('open')===null)await p.locator('#psSettings summary').click();};
      await openSettings();await p.locator('[data-preset="lean"]').click();
      const lean=P.createVoyage(21,'normal',{settings:{preset:'lean'}});await legIs(1);
      assert.match(await meters(),new RegExp(`PAR\\s*${lean.par}`,'i'));assert.match(await meters(),/ROCKETS\s*1\/3/i);assert.equal(await p.locator('[data-pallet-box]').count(),1);
      await p.reload();await p.locator('#psDock .ps-card').first().waitFor();assert.match(await meters(),new RegExp(`PAR\\s*${lean.par}`,'i'),'settings persist');
      assert.equal(await p.locator('#psSettings').getAttribute('open'),null,'settings stay closed once seen');
      await openSettings();await p.locator('#psSetStart').selectOption('3');await p.locator('#psSetMax').selectOption('6');await p.locator('#psSetPrice').selectOption('0.5');await p.locator('#psSetLegs').selectOption('10');
      await p.locator('#psApplySettings').click();const custom=P.createVoyage(21,'normal',{settings:{preset:'custom',start:3,maxFleet:6,priceScale:0.5,incomeScale:1,legs:10}});
      assert.match(await meters(),new RegExp(`LEG\\s*1/10`,'i'));assert.match(await meters(),new RegExp(`PAR\\s*${custom.par}`,'i'));assert.equal(await p.locator('[data-pallet-box]').count(),3);
      assert.match(await p.locator('[data-upgrade="0:stage"]').innerText(),/20 cr/,'price scale ×0.5 halves the transformation');
      await noOverflow(p,'settings '+tag);await shot('settings');
      await p.evaluate(k=>localStorage.removeItem(k),STORE);
    }

    // Single launch practice: clear the dock by taps to Perfect, every fairing FULL.
    await p.goto(`${BASE}/prototypes/pallet-stacking.html?seed=${seed}&difficulty=single`);await p.locator('#psDock .ps-card').first().waitFor();
    const pz=P.generate(seed,'single');assert.equal(await p.locator('#psDispatch').isVisible(),true);assert.match(await p.locator('#psDispatch').innerText(),/Launch all/);
    assert.equal(await p.locator('.ps-block').count(),pz.pallets.reduce((a,pal)=>a+pal.cap.filter(h=>h<pal.height).length,0),'practice fairings show their taper');
    assert.match(await p.locator('#mgDifficulty option[value="single"]').innerText(),/Single launch/);assert.equal(await p.locator('#psEndLeg').isVisible(),false);
    assert.match(await meters(),new RegExp('DOCK\\s*'+pz.crates.length+' left','i'));
    for(const m of pz.plan){await p.locator(`.ps-card[data-crate="${m.crate}"]`).click();await p.locator(`.ps-col[data-pallet="${m.pallet}"][data-col="${P.columnFor(pz,m.crate,m.x)}"]`).click();}
    assert.equal(await p.locator('.ps-full').count(),pz.pallets.length,'every fairing shows FULL');await noOverflow(p,'single '+tag);await shot('single-solved');
    await p.locator('#psDispatch').click();await p.waitForFunction(n=>document.querySelectorAll('.ps-departing .ps-pallet.level').length===n,pz.pallets.length);// every rocket lifts off
    await p.locator('#mgResult').waitFor({state:'visible'});assert.equal(await p.locator('#mgTier').innerText(),'Perfect');
    assert.match(await p.locator('#mgProduces').innerText(),new RegExp(`Launched: ${pz.pallets.length} rockets · ${pz.crates.length} of ${pz.crates.length} crates to the front`));
    if(tag===1280){
      await p.locator('#mgAgain').click();await p.locator('#mgResult').waitFor({state:'hidden'});
      const pz2=P.generate(seed+1,'single'),stuck=P.greedy(pz2,'big');
      for(const m of stuck.placed){await p.locator(`.ps-card[data-crate="${m.crate}"]`).click();await p.locator(`.ps-col[data-pallet="${m.pallet}"][data-col="${P.columnFor(pz2,m.crate,m.x)}"]`).click();}
      // An illegal drop shakes, shows a red ghost and changes nothing.
      const left=P.dock(pz2,stuck)[0];
      if(left!==undefined){await p.locator(`.ps-card[data-crate="${left}"]`).click();const before=await p.locator('[data-placed]').count();
        const bad=[...Array(pz2.pallets[0].width).keys()].find(c=>P.landing(pz2,stuck,left,0,P.anchorFor(pz2,left,0,c)).reason);
        if(bad!==undefined){await p.locator(`.ps-col[data-pallet="0"][data-col="${bad}"]`).click();assert.match(await p.locator('#mgStatus').innerText(),/✕/);
          assert.equal(await p.locator('[data-placed]').count(),before);assert.equal(await p.locator('.ps-ghost.bad:not([hidden])').count(),1);}
        await p.locator(`.ps-card[data-crate="${left}"]`).click();}
      await p.locator('#psDispatch').click();await p.locator('#mgResult').waitFor({state:'visible'});
      assert.equal(await p.locator('#mgNear').innerText(),P.nearMiss(pz2,stuck));assert.match(await p.locator('#mgNear').innerText(),/made clearing the dock impossible/);
    }
    assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS rocket loading: voyage starts with hoppers whose tapered fairings show hatched shoulders, grouped hangar with routes, undo/lift, #psPreview keeps the status line, hint, full voyages played by taps to Perfect (normal 1280, hard 1024, easy 390) with refits, upgrades, new hoppers, liftoff, rockets in orbit and back, bay destination tags, samples launched to the lab, per-destination result output, settings on the result card and in the export, Skip below par; destinations (LAB/FRONT card tags, a sample refused by a front-bound fairing); End-leg guard (Launch/Keep/Cancel, Enter/Esc, don\'t ask again, side-panel toggle, off-centre can\'t-launch case); presets and custom settings change par and persist; single-launch practice tap-cleared to Perfect with every fairing FULL and every rocket lifting off, illegal drop and dead-end near-miss; no overflow at 1280/1024/390, no console errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
