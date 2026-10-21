'use strict';
// Retained automated checks; headless unless a visible debugging session is explicitly requested.
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
const M=require('../../prototypes/minigames/element-pairs/element-pairs-model.js');
const K=require('../../prototypes/shared/minigames/minigame-kit.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
const fs=require('node:fs');
const count=async p=>Number(await p.locator('#mgMeters b').first().innerText());
const rendered=async p=>p.locator('[data-cell]').evaluateAll(bs=>bs.map(b=>[Number(b.dataset.cell),b.getAttribute('aria-label').split(',')[0].toLowerCase()]));
const occupied=s=>s.cells.flatMap((id,i)=>id===null?[]:[[i,id]]);
async function tap(p,selector){const b=p.locator(selector);if(await p.evaluate(()=>navigator.maxTouchPoints>0))await b.tap();else await b.click();}
async function pair(p,a,b){await tap(p,`[data-cell="${a}"]`);await tap(p,`[data-cell="${b}"]`);}
async function overflow(p){assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1,'no document horizontal overflow');}
(async()=>{
  const engine=process.env.ELEMENT_PAIRS_BROWSER||'chromium';
  assert.ok(['chromium','webkit'].includes(engine),'supported browser engine');
  const browser=await ({chromium,webkit})[engine].launch({headless:process.env.SPACOLOGY_HEADED!=='1'}),runtimeErrors=[];
  const watchErrors=page=>page.on('pageerror',error=>runtimeErrors.push(error.message));
  try{
    for(const viewport of [{width:320,height:740},{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:844,height:390}]){
      const p=await browser.newPage({viewport,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];
      watchErrors(p);
      p.on('pageerror',e=>errors.push(e.message));
      await p.goto(`${BASE}/prototypes/element-pairs.html?seed=42`);await p.locator('#epGrid button').first().waitFor();
      assert.equal(await p.locator('[data-cell]').count(),36);assert.equal(await count(p),36);
      assert.equal(await p.locator('#epGrid > *').count(),192);assert.equal(await p.locator('[data-next]').count(),36);
      const openingVisible=await p.evaluate(()=>{const frame=document.querySelector('#epScroll').getBoundingClientRect(),last=document.querySelector('[data-next="63"]').getBoundingClientRect(),ninth=document.querySelector('[data-next="64"]').getBoundingClientRect();return last.bottom<=frame.bottom+1&&ninth.top>=frame.bottom-1;});
      assert.ok(openingVisible,`exactly eight of 24 rows visible at ${viewport.width}×${viewport.height}`);
      assert.match(await p.locator('#epWindow').innerText(),/Rows 1–8 of 24/);
      assert.equal(await p.locator('#mgTime').count(),0);assert.equal(await p.locator('#mgAuto').count(),0);
      for(const selector of ['[data-cell="0"]','#epDeal','#mgHint','#mgUndo','#epRetry']){
        const box=await p.locator(selector).boundingBox();assert.ok(box.width>=44&&box.height>=44,`${selector}: 44px touch target at ${viewport.width} (${JSON.stringify(box)})`);
      }
      await overflow(p);
      // Selection, deselection and rejected pair are non-destructive.
      const generated=M.generate(42),start=M.start(generated),first=M.pairs(start)[0];
      await tap(p,'[data-cell="0"]');assert.equal(await p.locator('[data-cell="0"]').getAttribute('aria-pressed'),'true');
      await tap(p,'[data-cell="0"]');assert.equal(await p.locator('[aria-pressed="true"]').count(),0);
      await p.locator('[data-cell="0"]').focus();await p.locator('[data-cell="0"]').press('ArrowRight');
      assert.equal(await p.evaluate(()=>document.activeElement.dataset.cell),'1');
      await p.locator('[data-cell="1"]').press('Enter');assert.equal(await p.locator('[data-cell="1"]').getAttribute('aria-pressed'),'true');
      await p.locator('[data-cell="1"]').press('Escape');
      let bad;
      for(let a=0;a<36&&!bad;a++)for(let b=a+1;b<36;b++)if(!M.inspect(start,a,b).ok){bad=[a,b];break;}
      await pair(p,...bad);assert.equal(await count(p),36);assert.match(await p.locator('#mgStatus').innerText(),/blocks|same element|opposite/i);
      await p.locator(`[data-cell="${bad[1]}"]`).press('Escape');
      // Sightlines are on by default and agree with the model, without clearing anything.
      assert.equal(await p.locator('#epAssist').isChecked(),true);await tap(p,`[data-cell="${first[0]}"]`);
      const highlighted=await p.locator('.ep-partner').evaluateAll(bs=>bs.map(b=>Number(b.dataset.cell)).sort((a,b)=>a-b));
      assert.deepEqual(highlighted,M.sightlines(start,first[0]).filter(line=>line.ok).map(line=>line.target).sort((a,b)=>a-b));
      assert.ok(highlighted.length>0);assert.equal(await count(p),36);
      await p.locator('#epAssist').uncheck();assert.equal(await p.locator('.ep-partner').count(),0);
      await p.locator('#epAssist').check();await tap(p,`[data-cell="${first[0]}"]`);
      await tap(p,'#mgHint');assert.equal(await p.locator('.ep-hinted').count(),2);assert.match(await p.locator('#mgStatus').innerText(),/not necessarily a winning move/);
      await pair(p,...first);assert.equal(await count(p),34);
      await tap(p,'#mgUndo');assert.equal(await count(p),36);
      // Deal, undo deal, retry and new puzzle keep the moved shell controls alive.
      await tap(p,'#epDeal');assert.equal(await count(p),72);assert.match(await p.locator('#epDeal').innerText(),/3 left/);
      await tap(p,'#mgUndo');assert.equal(await count(p),36);assert.equal(await p.locator('#epGrid > *').count(),192);assert.match(await p.locator('#epDeal').innerText(),/4 left/);
      await pair(p,...first);assert.equal(await count(p),34);
      p.once('dialog',dialog=>dialog.dismiss());await tap(p,'#epRetry');assert.equal(await count(p),34);
      p.once('dialog',dialog=>dialog.accept());await tap(p,'#epRetry');assert.deepEqual(await rendered(p),occupied(start));
      assert.equal(await p.locator('#mgUndo').isDisabled(),true);
      await tap(p,'#mgHint');assert.equal(await p.locator('.ep-hinted').count(),2);
      await tap(p,'#mgNew');assert.equal(await p.locator('#mgSeed').inputValue(),'43');await tap(p,'#mgHint');assert.equal(await p.locator('.ep-hinted').count(),2);
      for(let k=0;k<4;k++)await tap(p,'#epDeal');
      assert.equal(await count(p),180);assert.equal(await p.locator('[data-next]').count(),0);assert.equal(await p.locator('#epDeal').isDisabled(),true);await overflow(p);
      await tap(p,'#mgUndo');assert.equal(await count(p),144);assert.equal(await p.locator('#epDeal').isDisabled(),false);
      await p.locator('#epScroll').evaluate(el=>{el.scrollTop=el.scrollHeight;el.scrollLeft=el.scrollWidth;});
      await p.waitForFunction(()=>document.querySelector('#epWindow').textContent==='Rows 17–24 of 24');
      assert.equal(await p.locator('#epGrid > *').count(),192);await overflow(p);
      if(SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await p.goto(`${BASE}/prototypes/element-pairs.html?seed=42`);await p.screenshot({path:`${SHOTS}/element-pairs-${viewport.width}.png`,fullPage:true});}
      assert.deepEqual(errors,[]);await p.close();
    }
    // Full solution crosses reserve boundaries, including wrapped moves.
    const p=await browser.newPage({viewport:{width:1024,height:768},serviceWorkers:'block',reducedMotion:'reduce'});
    watchErrors(p);
    const generated=M.generate(42);let state=M.start(generated),wrapSeen=false,collapseChecked=false;
    await p.goto(`${BASE}/prototypes/element-pairs.html?seed=42`);
    for(let k=0;k<4;k++){await p.locator('#epDeal').click();state=M.deal(generated,state).state;}
    for(const [a,b] of generated.witness){
      const before=state,move=M.match(state,a,b);assert.equal(move.ok,true);await pair(p,a,b);state=move.state;
      if(!collapseChecked&&move.clearedRows.length&&move.shifts.length&&M.remaining(state)){
        assert.deepEqual(await rendered(p),occupied(state));assert.match(await p.locator('#mgStatus').innerText(),/rows? cleared/);
        assert.equal(await p.locator('.ep-rise').count(),move.shifts.length);
        await p.locator('#mgUndo').click();assert.deepEqual(await rendered(p),occupied(before));
        await pair(p,a,b);assert.deepEqual(await rendered(p),occupied(state));collapseChecked=true;
      }
      if(move.line==='wrap'){wrapSeen=true;if(M.remaining(state))assert.match(await p.locator('#mgStatus').innerText(),/Wrapped pair cleared/);}
    }
    assert.ok(wrapSeen,'full solution includes wrapped-line interaction');
    assert.ok(collapseChecked,'a cleared row moves real rendered tiles and undo restores the exact pre-collapse board');
    await p.locator('#mgResult:not([hidden])').waitFor();assert.match(await p.locator('#mgTier').innerText(),/Board clear/);
    assert.equal(await p.locator('#mgStats').innerText().then(t=>/time|target/i.test(t)),false);
    const session=await p.evaluate(()=>MiniGameKit.load().sessions.at(-1));assert.equal(session.tier,'good');assert.equal(session.targetMs,null);assert.equal(session.stats['Batches used'],'4 / 4');
    assert.equal(session.stats['Rows cleared'],state.lines);
    await p.locator('[data-rate="fun"][data-v="4"]').click();
    await p.locator('#mgReview').click();assert.equal(await p.locator('#epDeal').isDisabled(),true);
    const download=p.waitForEvent('download');await p.locator('#mgExport').click();assert.match((await download).suggestedFilename(),/playtests\.json/);
    await p.locator('#mgNew').click();assert.equal(await count(p),36);assert.equal(await p.locator('#mgUndo').isDisabled(),true);
    await p.locator('#mgHint').click();assert.equal(await p.locator('.ep-hinted').count(),2);
    // A partially cleared tail must not force the next deal to start on a new row.
    let tail;
    for(let seed=1;seed<=100&&!tail;seed++){
      const game=M.generate(seed),steps=[];let s=M.start(game);
      for(const move of M.pairs(s)){const next=M.match(s,...move).state;const last=next.cells.findLastIndex(v=>v!==null);
        if(last>=0&&last%8!==7){steps.push(move);tail={seed,steps,s:next,game};break;}}
    }
    assert.ok(tail);await p.goto(`${BASE}/prototypes/element-pairs.html?seed=${tail.seed}`);
    for(const move of tail.steps)await pair(p,...move);
    const appended=M.deal(tail.game,tail.s);await p.locator('#epDeal').click();
    assert.deepEqual(await rendered(p),occupied(appended.state));
    await p.locator('#mgUndo').click();assert.equal(await count(p),M.remaining(tail.s));
    // A stuck opening still has room for the next batch and dealing recovers play.
    await p.goto(`${BASE}/prototypes/element-pairs.html?seed=42`);let stuck=M.start(M.generate(42));
    while(M.pairs(stuck).length){const move=M.pairs(stuck)[0];await pair(p,...move);stuck=M.match(stuck,...move).state;}
    assert.equal(M.status(stuck),'stuck');assert.equal(await p.locator('[data-next]').count(),36);
    assert.match(await p.locator('#mgStatus').innerText(),/No legal pairs remain/);assert.equal(await p.locator('#epDeal').isEnabled(),true);
    await p.locator('#epDeal').click();assert.equal(await count(p),M.remaining(stuck)+36);
    // Long wrapped and geometric sightlines, offscreen guidance and blocker accuracy.
    for(const kind of ['wrap','column','diagonal']){
      let example;
      for(let seed=1;seed<=100&&!example;seed++){
        const game=M.generate(seed),steps=[];let s=M.start(game);for(let k=0;k<4;k++)s=M.deal(game,s).state;
        for(const move of game.witness){const check=M.inspect(s,...move);
          if(check.line===kind&&check.path.length>=3&&(kind!=='wrap'||(move[0]%8<=1&&move[1]%8>=6))&&(kind!=='column'||Math.floor(move[1]/8)-Math.floor(move[0]/8)>=8)){example={seed,steps,move,s};break;}
          steps.push(move);s=M.match(s,...move).state;
        }
      }
      assert.ok(example,`distant ${kind} exists`);await p.setViewportSize(kind==='wrap'?{width:320,height:740}:{width:1024,height:768});await p.goto(`${BASE}/prototypes/element-pairs.html?seed=${example.seed}`);
      for(let k=0;k<4;k++)await p.locator('#epDeal').click();for(const move of example.steps)await pair(p,...move);
      const [a,b]=example.move;await p.locator(`[data-cell="${a}"]`).click();
      assert.match(await p.locator(`[data-cell="${b}"]`).getAttribute('class'),/ep-partner/);assert.ok(await p.locator('.ep-ray').count()>0);
      const lit=await p.locator('.ep-partner').evaluateAll(bs=>bs.map(b=>Number(b.dataset.cell)).sort((a,b)=>a-b));
      assert.deepEqual(lit,M.sightlines(example.s,a).filter(line=>line.ok).map(line=>line.target).sort((a,b)=>a-b));
      if(kind==='wrap'){
        await p.locator('#epScroll').evaluate(el=>el.scrollLeft=0);await p.locator('#epRight:not([hidden])').waitFor();
        await p.locator('#epRight').click();assert.equal(await count(p),M.remaining(example.s));
        await p.locator('#epScroll').evaluate(el=>el.scrollTop=0);await p.locator('#epBelow:not([hidden])').waitFor();
        await p.locator('#epBelow').click();assert.equal(await p.locator(`[data-cell="${a}"]`).getAttribute('aria-pressed'),'true');
        assert.match(await p.locator('#epSight').innerText(),/reading-order wrap/);
        await p.locator(`[data-cell="${a}"]`).click();await p.locator(`[data-cell="${b}"]`).click();
        await p.locator('#epScroll').evaluate(el=>el.scrollLeft=el.scrollWidth);await p.locator('#epLeft:not([hidden])').waitFor();await p.locator('#epLeft').click();
        await p.locator('#epScroll').evaluate(el=>el.scrollTop=el.scrollHeight);await p.locator('#epAbove:not([hidden])').waitFor();
        await p.locator('#epAbove').click();assert.equal(await count(p),M.remaining(example.s));
        await p.locator(`[data-cell="${b}"]`).click();await p.locator(`[data-cell="${a}"]`).click();
      }
      await p.locator(`[data-cell="${b}"]`).click();assert.equal(await count(p),M.remaining(example.s)-2);
    }
    // Full finite play can also exhaust the board. Find a deterministic losing sequence without injecting UI state.
    let loss;
    for(let seed=1;seed<=100&&!loss;seed++){
      const game=M.generate(seed),random=K.rng(seed);let s=M.start(game);for(let k=0;k<4;k++)s=M.deal(game,s).state;
      const steps=[];while(M.pairs(s).length){const pair=random.pick(M.pairs(s));steps.push(pair);s=M.match(s,...pair).state;}
      if(M.status(s)==='lost')loss={seed,steps,left:M.remaining(s)};
    }
    assert.ok(loss,'a reproducible dead end exists');
    await p.goto(`${BASE}/prototypes/element-pairs.html?seed=${loss.seed}`);
    for(let k=0;k<4;k++)await p.locator('#epDeal').click();
    for(const [a,b] of loss.steps)await pair(p,a,b);
    assert.equal(await count(p),loss.left);assert.equal(await p.locator('#epEnd').isVisible(),true);assert.equal(await p.locator('#mgUndo').isEnabled(),true);
    await p.locator('#mgUndo').click();assert.equal(await p.locator('#epEnd').isVisible(),false);
    await pair(p,...loss.steps.at(-1));await p.locator('#epFinish').click();
    await p.locator('#mgResult:not([hidden])').waitFor();assert.equal(await p.locator('#mgTier').innerText(),'Failed');
    assert.equal(await p.evaluate(()=>localStorage.getItem('spacologyRunV1')),null,'does not create a voyage');
    await p.close();
    // A packaged copy can also be verified without HTTP or network access.
    if(process.env.ELEMENT_PAIRS_OFFLINE){
      const context=await browser.newContext({serviceWorkers:'block'}),offline=await context.newPage(),errors=[];
      watchErrors(offline);
      await context.route(/^https?:\/\//,route=>route.abort());
      offline.on('pageerror',e=>errors.push(e.message));await offline.goto(require('node:url').pathToFileURL(process.env.ELEMENT_PAIRS_OFFLINE).href+'?seed=42');
      await context.setOffline(true);
      await offline.locator('#epGrid button').first().waitFor();assert.equal(await count(offline),36);
      await offline.locator('#mgHint').click();assert.equal(await offline.locator('.ep-hinted').count(),2);
      await pair(offline,...M.pairs(M.start(M.generate(42)))[0]);assert.equal(await count(offline),34);
      await offline.locator('#mgUndo').click();assert.equal(await count(offline),36);
      await offline.locator('#epDeal').click();assert.equal(await count(offline),72);
      assert.deepEqual(errors,[]);await context.close();
      const sandbox=await browser.newPage({serviceWorkers:'block'});
      watchErrors(sandbox);
      await sandbox.setContent('<iframe sandbox="allow-scripts" title="Packaged game"></iframe>');
      await sandbox.locator('iframe').evaluate((frame,html)=>{frame.srcdoc=html;},fs.readFileSync(process.env.ELEMENT_PAIRS_OFFLINE,'utf8'));
      const frame=sandbox.frameLocator('iframe');await frame.locator('[data-cell="0"]').waitFor();
      assert.equal(await frame.locator('[data-cell]').count(),36);
      await frame.locator('#mgHint').click();assert.equal(await frame.locator('.ep-hinted').count(),2);
      await frame.locator('#epDeal').click();assert.equal(await frame.locator('[data-cell]').count(),72);
      await frame.locator('#mgUndo').click();assert.equal(await frame.locator('[data-cell]').count(),36);
      await sandbox.close();
    }
    assert.deepEqual(runtimeErrors,[],'no runtime errors in any viewport, full game, recovery, offline or sandbox path');
    console.log('PASS element pairs: headless touch at 320/390/768/1024 and landscape, selection/rejection/assists/undo, finite deals, wrapped clear, exhaustion recovery, restart, ratings and export.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
