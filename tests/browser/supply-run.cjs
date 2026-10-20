// Supply run: loads fixed seeds headlessly at 1280, 1024 and 390 wide. Walks with the keyboard (starts the shift) and
// with a joystick drag on the canvas, and taps to walk; checks the advanceTo hook; opens Recipes and lights up where an
// item comes from and where it goes, and a request card's whole chain; replays the model's par plan through the same
// input path for Perfect, seeing pads unlock, a NEW RECIPE, and a tier-2 delivery banner on the way. Checks no
// horizontal overflow and no console errors throughout; at 1280 also Pause / 2×, Skip (auto) and relaxed timers.
// Run with `node tests/run.cjs supply-run`. Headless unless SPACOLOGY_HEADED=1. SHOTS=dir saves screenshots.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const P=require('../../prototypes/minigames/supply-run/supply-run-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
const RUNS=[{viewport:{width:1280,height:900},difficulty:'normal',seed:11},{viewport:{width:1024,height:768},difficulty:'normal',seed:23},{viewport:{width:390,height:844},difficulty:'easy',seed:5}];
async function noOverflow(p,where){const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
const S=p=>p.evaluate(()=>JSON.parse(JSON.stringify(window.SupplyRunUI.state)));
const UI=(p,k)=>p.evaluate(k=>JSON.parse(JSON.stringify(window.SupplyRunUI[k])),k);
const advanceTo=(p,t)=>p.evaluate(t=>window.SupplyRunUI.advanceTo(t),t);
// Feed the plan through the UI's own input path: step the paused shift to each command's tick, then steer.
const replay=(p,plan,upTo)=>p.evaluate(({plan,upTo})=>{const S=window.SupplyRunUI;for(const c of plan){if(c.tick>upTo)break;S.advanceTo(c.tick);S.input(c.cmd);}S.advanceTo(upTo);},{plan,upTo});
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  for(const {viewport,difficulty,seed} of RUNS){
    const tag=viewport.width,p=await browser.newPage({serviceWorkers:'block',viewport}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async n=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/supply-${n}-${tag}.png`});};
    const url=`${BASE}/prototypes/supply-run.html?seed=${seed}&difficulty=${difficulty}`,pz=P.generate(seed,difficulty);
    const open=async()=>{await p.goto(url);await p.locator('#srCanvas').waitFor();await p.waitForFunction(()=>window.SupplyRunUI&&window.SupplyRunUI.state);};
    await open();
    assert.equal(await p.locator('.sr-req').count(),pz.lts.length);
    assert.equal(await p.evaluate(()=>window.SupplyRunUI.puzzle.par),pz.par,'page and Node agree on par');
    assert.match(await p.locator('#mgMeters').innerText(),new RegExp('PAR\\s+'+pz.par,'i'));
    assert.match(await p.locator('#mgMeters').innerText(),new RegExp('PERFECT\\s+'+pz.perfectAt,'i'));
    assert.match(await p.locator('#srPlay').innerText(),/Start shift/);
    const box=await p.locator('#srCanvas').boundingBox();assert.ok(box.width>=300&&box.height>=300,`canvas is a usable size (${JSON.stringify(box)})`);
    await noOverflow(p,'start '+tag);await shot('start');

    // Keyboard: holding → walks right and starts the shift; letting go stops.
    let s0=await S(p);
    await p.keyboard.down('ArrowRight');await p.waitForTimeout(450);await p.keyboard.up('ArrowRight');
    let s=await S(p);assert.ok(s.player.x>s0.player.x,'arrow key walks right');assert.ok(s.tick>0,'moving starts the shift');
    assert.match(await p.locator('#srPlay').innerText(),/Pause/);
    let cmds=await UI(p,'commands');assert.deepEqual(cmds[0].cmd,{type:'move',x:100,y:0});assert.deepEqual(cmds[cmds.length-1].cmd,{type:'move',x:0,y:0});
    await p.keyboard.down('KeyW');await p.keyboard.down('KeyA');await p.waitForTimeout(250);await p.keyboard.up('KeyW');await p.keyboard.up('KeyA');
    cmds=await UI(p,'commands');assert.ok(cmds.some(c=>c.cmd.x===-100&&c.cmd.y===-100),'W+A walks diagonally');
    await p.locator('#srPlay').click();assert.match(await p.locator('#srPlay').innerText(),/Resume/);

    // Joystick: drag anywhere on the canvas; the heading follows the drag and stops on release. A quick tap walks there.
    await open();s0=await S(p);
    await p.locator('#srCanvas').scrollIntoViewIfNeeded();const jb=await p.locator('#srCanvas').boundingBox();
    const cx=jb.x+jb.width/2,cy=jb.y+Math.min(jb.height/2,(viewport.height-jb.y)/2);
    await p.mouse.move(cx,cy);await p.mouse.down();for(let i=1;i<=6;i++)await p.mouse.move(cx-i*14,cy+2);
    await p.waitForTimeout(400);
    s=await S(p);assert.ok(s.player.x<s0.player.x,'dragging left walks left');assert.ok(s.player.vx<0);
    await p.mouse.up();cmds=await UI(p,'commands');
    assert.ok(cmds.some(c=>c.cmd.type==='move'&&c.cmd.x<-90),'the drag became a heading');assert.deepEqual(cmds[cmds.length-1].cmd,{type:'move',x:0,y:0});
    await p.locator('#srPlay').click();
    await p.mouse.click(cx+jb.width*0.2,cy);cmds=await UI(p,'commands');
    assert.equal(cmds[cmds.length-1].cmd.type,'goto','a tap walks to that spot');
    await shot('moved');

    // advanceTo: the paused shift steps exactly to a tick.
    await open();await advanceTo(p,pz.lts[0].first+30);s=await S(p);
    assert.equal(s.tick,pz.lts[0].first+30);assert.equal(await p.evaluate(()=>window.SupplyRunUI.running),false);
    assert.match(await p.locator('.sr-req').first().innerText(),/Plate/,'the first request card shows its item');

    // Recipes: tap an item to light up where it comes from and where it goes; tap a request card for its chain.
    await p.locator('#srRecipesBtn').click();assert.equal(await p.locator('#srRecipes').isVisible(),true);
    assert.equal(await p.locator('#srRecipes li').count(),P.NODE_IDS.length+P.STATION_IDS.length);
    assert.match(await p.locator('#srRecipes li[data-station="loom"]').innerText(),/Weaver relay/);
    assert.equal(await p.locator('#srRecipes li[data-station="synth"].sr-locked').count(),1,'locked recipes are marked');
    await p.locator('#srRecipes li[data-station="synth"] .sr-ibtn[data-item="cell"]').click();
    let hl=await UI(p,'highlight');assert.equal(hl.item,'cell');
    assert.deepEqual(hl.zones.filter(z=>z.role==='from').map(z=>z.zone),P.sources('cell'));
    assert.deepEqual(hl.zones.filter(z=>z.role==='use').map(z=>z.zone).sort(),P.uses('cell').sort());
    assert.match(await p.locator('#mgStatus').innerText(),/synthesiser's output pad/);
    await noOverflow(p,'recipes '+tag);await shot('recipes');
    await p.locator('#srRecipesClose').click();assert.equal(await p.locator('#srRecipes').isHidden(),true);
    await p.locator('.sr-req').first().click();hl=await UI(p,'highlight');
    assert.equal(hl.mode,'chain');assert.deepEqual(hl.zones.map(z=>z.zone),P.chain('plate').zones);
    assert.equal(await p.locator('.sr-req.sr-on').count(),1);
    await p.locator('.sr-req').first().click();assert.equal(await UI(p,'highlight'),null,'tapping again clears it');
    // Hint: the model's text, an arrow target.
    await p.locator('#mgHint').click();const h=P.hint(pz,P.run(pz,[],{until:pz.lts[0].first+30}).state);
    assert.equal(await p.locator('#mgStatus').innerText(),'Hint: '+h.text);assert.equal((await UI(p,'hint')).zone,h.zone);

    // Perfect: replay the planner's headings through the UI. On the way: unlocks, a NEW RECIPE, a tier-2 delivery.
    await open();
    const fx=P.run(pz,pz.plan,{fx:true}).state.fx,firstUnlock=fx.find(e=>e.type==='unlock'),tier2=fx.find(e=>e.type==='fill'&&e.tier>=2);
    assert.ok(firstUnlock&&tier2,'the plan unlocks something and delivers a tier-2 item');
    await replay(p,pz.plan,firstUnlock.tick+1);
    s=await S(p);assert.equal(s.unlocked[firstUnlock.id],true,'standing on the pad unlocked it');
    assert.ok((await UI(p,'celebrations')).some(c=>c.type==='unlock'&&c.id===firstUnlock.id));
    await p.locator('#srBanner').filter({hasText:'UNLOCKED'}).waitFor({timeout:4000});
    await p.locator('#srRecipesBtn').click();
    if(firstUnlock.id==='crystal')assert.equal(await p.locator('#srRecipes li[data-node="crystal"].sr-locked').count(),0,'the panel shows it open');
    await p.locator('#srRecipesBtn').click();
    await replay(p,pz.plan,tier2.tick+1);
    const cel=await UI(p,'celebrations');
    assert.ok(cel.some(c=>c.type==='recipe'),'a NEW RECIPE moment');assert.ok(cel.some(c=>c.type==='fill'&&c.tier>=2&&c.item===tier2.item),'a tier-2 delivery');
    await p.locator('#srBanner').filter({hasText:'DELIVERED'}).waitFor({timeout:8000});
    assert.match(await p.locator('#srBanner').innerText(),new RegExp(P.ITEMS[tier2.item].plural.split(' ')[0]+'|'+P.ITEMS[tier2.item].name.split(' ')[0],'i'));
    await noOverflow(p,'mid '+tag);await shot('mid');
    await replay(p,pz.plan,pz.shiftTicks);
    await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Perfect');assert.equal(await p.locator('#mgNear').isHidden(),true);
    assert.match(await p.locator('#mgStats').innerText(),new RegExp(`${pz.par} / par ${pz.par}`));
    assert.match(await p.locator('#mgProduces').innerText(),/to the lieutenants' fronts/);
    const mine=await UI(p,'commands');assert.equal(P.evaluate(pz,P.run(pz,mine).state).score,pz.par,'the recorded commands replay to par in Node');
    await noOverflow(p,'result '+tag);await shot('result');

    if(tag===1280){
      // Pause, 2×, Skip.
      await p.locator('#mgAgain').click();await p.locator('#mgResult').waitFor({state:'hidden'});
      await p.locator('[data-speed="2"]').click();assert.equal(await p.locator('[data-speed="2"]').getAttribute('aria-pressed'),'true');
      await p.locator('#srPlay').click();await p.waitForTimeout(500);assert.match(await p.locator('#srPlay').innerText(),/Pause/);
      await p.locator('#srPlay').click();const t1=(await S(p)).tick;assert.ok(t1>=6,`2× ran the shift (${t1})`);await p.waitForTimeout(250);assert.equal((await S(p)).tick,t1,'paused');
      const pz2=P.generate(seed+1,difficulty),mid=await S(p),auto=P.auto(pz2,mid).evaluation;
      await p.locator('#mgAuto').click();await p.locator('#mgResult').waitFor({state:'visible'});
      assert.equal(await p.locator('#mgTier').innerText(),'Automatic');
      assert.equal(await p.locator('#mgHeadline').innerText(),`The slow courier finished the shift: ${auto.filled} request${auto.filled===1?'':'s'} filled for ${auto.score} credits (par ${pz2.par}).`);
      // Relaxed timers regenerate the shift with its own par; an idle shift ends Failed with the near-miss line.
      await p.locator('#mgAgain').click();await p.locator('#mgResult').waitFor({state:'hidden'});
      await p.locator('.sr-relax').click();
      const rz=P.generate(seed+2,difficulty,{relaxed:true});
      assert.equal(await p.evaluate(()=>window.SupplyRunUI.puzzle.relaxed),true);assert.match(p.url(),/relaxed=1/);
      assert.equal(await p.evaluate(()=>window.SupplyRunUI.puzzle.par),rz.par);
      await advanceTo(p,rz.shiftTicks);await p.locator('#mgResult').waitFor({state:'visible'});
      assert.equal(await p.locator('#mgTier').innerText(),'Failed');assert.equal(await p.locator('#mgNear').innerText(),P.nearMiss(rz,[]));
    }
    assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS supply run: keyboard and joystick walking, tap-to-walk, advanceTo; Recipes panel item highlight and request-card chain; hint; par plan replayed through the input path for Perfect with an unlock, a NEW RECIPE and a tier-2 delivery banner; Pause/2×, Skip, relaxed + Failed near-miss; no overflow or console errors at 1280, 1024 and 390');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
