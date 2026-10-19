// Gear assembly: reaches Perfect by taps at three viewports (replaying the solver's kits), headlessly, and checks the
// READY stamp, stat-bar sources, Undo, Hint, Skip, drag (tray to frame, frame back to tray, with the ghost and live
// preview), the Guided and Relaxed assists, and that the frames fit 1024×768 with no overflow or console errors.
// Serve the repository root (npm run serve), then: node tests/browser/gear-pack.cjs. SHOTS=<dir> saves screenshots.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const G=require('../../prototypes/minigames/gear-pack/gear-pack-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS,SEED=12;
async function noOverflow(p,where){const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  for(const [viewport,difficulty] of [[{width:1280,height:900},'normal'],[{width:1024,height:768},'expert'],[{width:390,height:844},'easy']]){
    const tag=viewport.width,ctx=await browser.newContext({viewport,serviceWorkers:'block',hasTouch:tag===390}),p=await ctx.newPage(),errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async n=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/gear-pack-${n}-${tag}.png`,fullPage:true});};
    const open=async(d=difficulty,seed=SEED)=>{await p.goto(`${BASE}/prototypes/gear-pack.html?seed=${seed}&difficulty=${d}`);await p.locator('.gp-cell').first().waitFor();};
    const P=G.generate(SEED,difficulty);
    await open();await noOverflow(p,'start');await shot('start');
    assert.equal(await p.evaluate(([s,d])=>GearPack.generate(s,d).par,[SEED,difficulty]),P.par,'browser and Node agree on par');
    assert.equal(await p.locator('.mg-head h1').innerText(),'Gear assembly');
    assert.equal(await p.locator('.gp-order').count(),P.orders.length);assert.equal(await p.locator('#gpTray [data-part]').count(),P.parts.length);
    for(const [o,O] of P.orders.entries()){assert.equal(await p.locator(`#gpFrame${o} .gp-cell`).count(),O.w*O.h);
      assert.match(await p.locator(`.gp-order[data-order="${o}"]`).innerText(),new RegExp(`${O.crew}[\\s\\S]*${O.role}[\\s\\S]*fits ${O.w}×${O.h}`,'i'));}
    assert.match(await p.locator('#gpTray').innerText(),/(Guard|Pace|Burst|Mend) \+\d/,'part cards show their stats before placement');
    if(tag>=1024){
      for(const c of await p.locator('.gp-cell').all()){const b=await c.boundingBox();assert.ok(b.width>=44&&b.height>=44,`cell ${b.width}x${b.height} at ${tag}`);}
      for(const c of await p.locator('.gp-crate').all()){const b=await c.boundingBox();assert.ok(b.y+b.height<=viewport.height,`every frame visible without scrolling at ${tag} (bottom ${b.y+b.height})`);}
    }
    const cell=(o,x,y)=>p.locator(`#gpFrame${o} [data-cell="${y*P.orders[o].w+x}"]`);
    const isUsed=async i=>/\bused\b/.test(await p.locator(`#gpTray [data-part="${i}"]`).getAttribute('class'));
    const placeByTaps=async m=>{
      if(await p.locator('#gpRoot').getAttribute('data-sel')!==String(m.part))await p.locator(`#gpTray [data-part="${m.part}"]`).click();
      while(await p.locator('#gpRoot').getAttribute('data-rot')!==String(m.rot))await p.locator('#gpRotate').click();
      const pv=G.pivot(G.oriented(P,m.part,m.rot));await cell(m.order,m.x+pv[0],m.y+pv[1]).click();
      assert.ok(await isUsed(m.part),`placed ${JSON.stringify(m)}`);};

    // Undo: fit a part, then take it back.
    const first=P.solution[0];await placeByTaps(first);assert.equal(await p.locator('#mgUndo').isDisabled(),false);
    await p.locator('#mgUndo').click();assert.equal(await isUsed(first.part),false,'undo returns the part');assert.equal(await p.locator('#mgUndo').isDisabled(),true);

    // Solve by taps with the solver's kits; each order stamps READY when its last target is met.
    for(const [o] of P.orders.entries()){
      for(const m of P.solution.filter(m=>m.order===o))await placeByTaps(m);
      assert.match(await p.locator(`.gp-order[data-order="${o}"]`).getAttribute('class'),/\bready\b/,`order ${o} READY`);}
    await noOverflow(p,'solved');await shot('solved');
    assert.match(await p.locator('#mgMeters').innerText(),new RegExp(`${P.orders.length}\\s*/\\s*${P.orders.length}[\\s\\S]*${P.par} · par ${P.par}`),'meters: every order ready at par');
    assert.ok(await p.locator('.gp-mk.lit').count()>=1,'a synergy marker lights up');
    assert.equal(await p.locator('.gp-bar.met').count(),P.orders.reduce((n,O)=>n+Object.keys(O.targets).length,0),'every stat bar met');
    // Tapping a stat bar highlights the parts that feed it.
    await p.locator('.gp-bar').first().click();assert.ok(await p.locator('.gp-cell.src').count()>=1,'stat sources highlighted');
    await p.locator('#gpShip').click();await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Perfect');
    assert.match(await p.locator('#mgProduces').innerText(),new RegExp(`Shipped at dawn: ${P.orders[0].crew}'s kit \\(\\w+ \\d+( · \\w+ \\d+)+\\)`));
    await noOverflow(p,'result');await shot('result');

    // Hint: highlights a concrete step with its reason and selects its part.
    await open();await p.locator('#mgHint').click();assert.match(await p.locator('#mgStatus').innerText(),/^Hint: Put the .+ in \w+'s frame .+: .+/);
    assert.ok(await p.locator('.gp-cell.hint').count()>=1,'hint cells highlighted');assert.notEqual(await p.locator('#gpRoot').getAttribute('data-sel'),'','hint selects its part');
    // Following the hint (tap a glowing cell) fits the part; shipping unfinished needs a second press and is not Perfect.
    const hp=+await p.locator('#gpRoot').getAttribute('data-sel');
    const h=G.hint(P,G.initial(P));const pv=G.pivot(G.oriented(P,h.move.part,h.move.rot));await cell(h.move.order,h.move.x+pv[0],h.move.y+pv[1]).click();
    assert.ok(await isUsed(hp),'hinted part fitted');
    await p.locator('#gpShip').click();assert.match(await p.locator('#gpShip').innerText(),/Ship anyway/);await p.locator('#gpShip').click();
    await p.locator('#mgResult').waitFor({state:'visible'});assert.match(await p.locator('#mgTier').innerText(),/^(Failed|Partial|Good)$/);
    assert.ok((await p.locator('#mgNear').innerText()).length>0,'near-miss line on a miss');assert.match(await p.locator('#mgProduces').innerText(),/Held back: \w+'s kit \(\w+ \d+ of \d+/);

    // Skip: the automatic assembly is labelled Automatic, below Perfect.
    await open();await p.locator('#mgAuto').click();await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Automatic');assert.match(await p.locator('#mgHeadline').innerText(),/night shift/);
    assert.ok((await p.locator('#mgNear').innerText()).length>0,'near-miss line shown');

    if(tag===1280){
      // Drag (mouse pointer events): a tray part into its frame with ghost and live preview, then off the frame to the tray.
      await open();const m=P.solution.find(x=>G.TYPES[P.parts[x.part].type].stat)||P.solution[0];
      const centre=async loc=>{const b=await loc.boundingBox();return [b.x+b.width/2,b.y+b.height/2];};
      const dragTo=async(from,to,during)=>{const [ax,ay]=await centre(from),[bx,by]=await centre(to);await p.mouse.move(ax,ay);await p.mouse.down();await p.mouse.move(bx,by,{steps:8});if(during)await during();await p.mouse.up();};
      const dpv=G.pivot(G.oriented(P,m.part,m.rot));
      await p.locator(`#gpTray [data-part="${m.part}"]`).click();while(await p.locator('#gpRoot').getAttribute('data-rot')!==String(m.rot))await p.locator('#gpRotate').click();
      await dragTo(p.locator(`#gpTray [data-part="${m.part}"]`),cell(m.order,m.x+dpv[0],m.y+dpv[1]),async()=>{
        assert.ok(await p.locator(`#gpGhost${m.order} .g-ok`).count()>=1,'ghost footprint while dragging');
        assert.match(await p.locator('#mgStatus').innerText(),/here: .*(gets|brings)/,'live preview names the stat it moves');});
      assert.ok(await isUsed(m.part),'drag fits the part');
      await dragTo(cell(m.order,m.x+dpv[0],m.y+dpv[1]),p.locator('.mg-head h1'));
      assert.equal(await isUsed(m.part),false,'dragging off the frame returns it to the tray');
      // Guided: parts that can still help glow. Relaxed: a tap drops the part into its best spot; never Perfect.
      await p.locator('input[name="gpLevel"][value="guided"]').check();assert.ok(await p.locator('#gpTray .gp-card.helps').count()>=1,'guided highlights helpful parts');
      await p.locator('input[name="gpLevel"][value="relaxed"]').check();
      for(const s of P.solution)await p.locator(`#gpTray [data-part="${s.part}"]`).click();
      assert.equal(await p.locator('.gp-order.ready').count(),P.orders.length,'Relaxed taps meet every order');
      await p.locator('#gpShip').click();await p.locator('#mgResult').waitFor({state:'visible'});
      assert.equal(await p.locator('#mgTier').innerText(),'Good');assert.match(await p.locator('#mgHeadline').innerText(),/Solved · Relaxed/);
      await open();assert.equal(await p.locator('#gpRoot').getAttribute('data-level'),'relaxed','assist level remembered');
      await p.locator('input[name="gpLevel"][value="puzzle"]').check();
    }
    assert.deepEqual(errors,[],'no console or page errors');
    await ctx.close();
  }
  console.log('PASS gear-pack browser: Perfect by taps at 1280 (normal), 1024 (expert) and 390 (easy) with READY stamps and stat sources; undo, hint, ship-anyway, skip, drag (tray to frame and back, ghost and preview), Guided and Relaxed work; frames fit 1024×768; no overflow or errors.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
