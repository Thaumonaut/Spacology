// Pipes mini-game (rotating pipe puzzle): solves real boards by tapping, at desktop, iPad landscape and phone widths,
// headlessly. Serve the repository root (npm run serve), then: node tests/browser/pipes.cjs
// (or: node tests/run.cjs pipes). SPACOLOGY_HEADED=1 opens a visible browser for debugging only.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const M=require('../../prototypes/minigames/pipes/pipes-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
async function noOverflow(p,where){await p.waitForTimeout(300);const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  // The largest board on a phone still has ≥44px tiles, tools and tray pieces, and no overflow.
  {const p=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844},hasTouch:true});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await p.goto(`${BASE}/prototypes/pipes.html?seed=3&difficulty=expert`);await p.locator('#ppBoard').waitFor();
    const box=await p.locator('#mgStage [data-cell="0"]').boundingBox();assert.ok(box.width>=44&&box.height>=44,`8×8 tiles at 390 are ${box.width}px`);
    for(const sel of ['#ppRotate','#ppLock','#ppLift','.pp-piece >> nth=0','#ppRun','#mgHint','#mgUndo','#mgAuto']){const b=await p.locator(sel).boundingBox();assert.ok(b.height>=44&&b.width>=44,sel+' is a 44px target');}
    await noOverflow(p,'expert 390');assert.deepEqual(errors,[]);await p.close();}

  for(const [viewport,difficulty,seed] of [[{width:1280,height:900},'expert',3],[{width:1024,height:768},'hard',2],[{width:390,height:844},'easy',1]]){
    const tag=viewport.width,touch=tag!==1280,p=await browser.newPage({serviceWorkers:'block',viewport,hasTouch:touch});const errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async name=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/pipes-${name}-${tag}.png`});};
    const P=M.generate(seed,difficulty),url=`${BASE}/prototypes/pipes.html?seed=${seed}&difficulty=${difficulty}`;
    const cell=i=>p.locator(`#mgStage [data-cell="${i}"]`),cls=async i=>(await cell(i).getAttribute('class'))||'';
    const count=sel=>p.locator('#mgStage '+sel).count();
    const tap=async loc=>{if(touch)await loc.tap();else await loc.click();};
    const tapCell=i=>tap(cell(i));
    const tier=async()=>{await p.locator('#mgResult:not([hidden])').waitFor();return p.locator('#mgTier').innerText();};
    const open=async()=>{await p.goto(url);await p.locator('#ppBoard').waitFor();};
    const page=()=>p.evaluate(()=>JSON.parse(JSON.stringify(window.__pipes.st)));
    const meter=()=>p.locator('#mgMeters').innerText();
    // Solve what is left by tapping, working out each tile's taps from the model: pipes first, then the slots
    // (tray piece, tap the slot, then turn it to the answer). Returns the taps it spent.
    const solveRest=async()=>{let st=await page(),spent=0;
      for(let i=0;i<P.cells.length;i++){const c=P.cells[i];if(c.kind!=='pipe'||st.locked[i])continue;
        const k=M.tapsTo(c.piece,st.rot[i],P.solution.mask[i]);for(let t=0;t<k;t++)await tapCell(i);spent+=k;}
      for(const s of P.slots){st=await page();const want=P.solution.piece[s];if(st.locked[s]&&st.placed[s]===want)continue;
        if(!st.placed[s]){await tap(p.locator(`.pp-piece[data-piece="${want}"]`));await tapCell(s);st=await page();}
        assert.equal(st.placed[s],want);const k=M.tapsTo(want,st.rot[s],P.solution.mask[s]);for(let t=0;t<k;t++)await tapCell(s);spent+=k;}
      return spent;};

    // The page draws exactly the model's board: endpoints, bridges, slots, the tray and one line per product.
    await open();
    assert.equal(await count('[data-cell]'),P.n*P.n);
    assert.equal(await count('.pp-source'),P.nets.reduce((a,x)=>a+x.sources.length,0));assert.equal(await count('.pp-sink'),P.nets.length);
    assert.equal(await count('.pp-bridge'),P.cells.filter(c=>c.kind==='bridge').length);assert.equal(await count('.pp-slot'),P.slots.length);
    assert.equal(await count('.pp-line'),P.nets.length);
    if(P.slots.length)assert.equal(await count('.pp-piece'),Object.values(P.tray).filter(Boolean).length);
    {const box=await cell(0).boundingBox();assert.ok(box.width>=44&&box.height>=44,`tiles must be at least 44px at ${tag}, got ${box.width}`);}
    // At 1024×768 the board and its tools sit side by side and the whole board is on screen.
    if(tag===1024){const b=await p.locator('#ppBoard').boundingBox(),t=await p.locator('#ppRotate').boundingBox();
      assert.ok(t.x>=b.x+b.width,'tools beside the board at 1024');assert.ok(b.y+b.height<=768,`board fits 768px high (bottom ${b.y+b.height})`);}
    const pipe=P.cells.findIndex((c,i)=>c.kind==='pipe'&&c.piece==='elbow');
    const label0=await cell(pipe).getAttribute('aria-label');assert.match(label0,new RegExp(`^${M.label(P,pipe)}, elbow, open `));
    await noOverflow(p,'start '+tag);await shot('start');

    // Tap turns a pipe; fixed endpoints and bridges refuse with a reason; undo puts the tile back and keeps the count.
    await tapCell(pipe);
    {const want=M.rotate(P,M.initial(P),pipe,1).state,dirs=[0,1,2,3].filter(d=>M.maskAt(P,want,pipe)&M.BIT[d]).map(d=>M.DIR_NAME[d]).join(' and ');
      assert.equal(await cell(pipe).getAttribute('aria-label'),`${M.label(P,pipe)}, elbow, open ${dirs}`);}
    assert.match(await meter(),/Rotations\s*1\b/i);
    await tapCell(P.nets[0].sink);assert.match(await p.locator('#mgStatus').innerText(),/is fixed/);
    await tap(p.locator('#mgUndo'));assert.equal(await cell(pipe).getAttribute('aria-label'),label0);
    assert.match(await meter(),/Rotations\s*1\b/i,'undo does not refund rotations');
    assert.equal(await p.locator('#mgUndo').isDisabled(),true);

    // Lock: long-press with the mouse (1280) or the Lock tool (touch); a locked tile ignores taps; unlock again.
    if(!touch){const b=await cell(pipe).boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.waitForTimeout(650);await p.mouse.up();}
    else{await tap(p.locator('#ppLock'));await tapCell(pipe);}
    assert.match(await cls(pipe),/pp-locked/);assert.match(await cell(pipe).getAttribute('aria-label'),/locked$/);
    if(touch)await tap(p.locator('#ppRotate'));
    await tapCell(pipe);assert.match(await p.locator('#mgStatus').innerText(),/is locked/);assert.equal(await cell(pipe).getAttribute('aria-label'),label0+', locked');
    if(!touch){await cell(pipe).focus();await p.keyboard.press('l');}else{await tap(p.locator('#ppLock'));await tapCell(pipe);await tap(p.locator('#ppRotate'));}
    assert.doesNotMatch(await cls(pipe),/pp-locked/);
    // Keyboard and right-click (desktop): Q turns back, Enter turns forward.
    if(!touch){await cell(pipe).focus();await p.keyboard.press('Enter');await p.keyboard.press('q');assert.equal(await cell(pipe).getAttribute('aria-label'),label0);
      await cell(pipe).click({button:'right'});await cell(pipe).click();assert.equal(await cell(pipe).getAttribute('aria-label'),label0);}

    // Solve to Perfect by tapping (Puzzle level, no hints, within par): every plant lights up and every line seals.
    await open();
    {const spent=await solveRest();assert.ok(spent<=P.par,`model taps ${spent} within par ${P.par}`);
      assert.equal(await tier(),'Perfect');
      assert.match(await p.locator('#mgProduces').innerText(),/^Delivered: Base online: /);
      assert.equal(await p.locator('#mgNear').isHidden(),true);
      const st=await page(),want=M.solvedState(P,st);assert.ok(M.analyze(P,st).solved);assert.deepEqual(st.placed,want.placed);
      assert.match(await p.locator('#mgStats').innerText(),/Hints\s*0/i);
      await p.locator('#mgReview').click();
      assert.equal(await count('.pp-sink.pp-fed'),P.nets.length);assert.equal(await count('.pp-sink.pp-sealed'),P.nets.length);
      assert.equal(await count('.pp-drip'),0);assert.equal(await count('.pp-contam'),0);
      assert.ok(await count('.pp-flow.pp-wet')>=P.cells.length-P.slots.length,'flow runs through every pipe');
      assert.match(await meter(),new RegExp(`Lines\\s*${P.nets.length}/${P.nets.length}`,"i"));await noOverflow(p,'solved '+tag);await shot('perfect');}

    // Hint: sets one tile right and locks it, says why; finishing after a hint is Good, and the near-miss quotes it.
    await open();
    {const h=M.hint(P,M.initial(P));await tap(p.locator('#mgHint'));
      const status=await p.locator('#mgStatus').innerText();assert.ok(status.startsWith('Hint 1: '+h.reason),status);
      assert.match(await cls(h.cell),/pp-hinted/);assert.match(await cls(h.cell),/pp-locked/);
      const st=await page();assert.equal(M.maskAt(P,st,h.cell),P.solution.mask[h.cell]);assert.equal(st.taps,0,'hints are free');
      await shot('hint');await solveRest();assert.equal(await tier(),'Good');
      assert.equal(await p.locator('#mgNear').innerText(),'Spotting this yourself would have made it Perfect: '+h.reason);}

    // Guided marks exactly the tiles the model says are forced; Relaxed snaps a local cascade, finishing is Solved · Relaxed.
    if(tag===1024){
      await open();await p.locator('input[name="ppLevel"][value="guided"]').check({force:true});
      const f=M.forced(P,M.initial(P));assert.equal(await count('.pp-forced'),f.length);assert.ok(f.length>0);
      await p.locator('input[name="ppLevel"][value="relaxed"]').check({force:true});
      const first=f[0].cell,r=M.settle(P,M.rotate(P,M.initial(P),first,1).state,{from:first});
      await tapCell(first);await p.waitForTimeout(110*r.steps.length+400);
      assert.equal(await count('.pp-locked'),r.steps.length,'the cascade locked the model’s steps');assert.ok(r.steps.length>=2);
      assert.match(await p.locator('#mgStatus').innerText(),/^Relaxed: \d+ tiles? snapped into place/);
      assert.match(await meter(),/Rotations\s*1\b/i,'snapped tiles cost nothing');await shot('relaxed');
      await solveRest();assert.equal(await tier(),'Good');assert.equal(await p.locator('#mgHeadline').innerText(),'Solved · Relaxed');
      assert.match(await p.locator('#mgNear').innerText(),/Relaxed assist/);
      await p.locator('#mgReview').click();await p.locator('input[name="ppLevel"][value="puzzle"]').check({force:true});
      // the level is remembered
      await open();assert.equal(await p.locator('input[name="ppLevel"][value="puzzle"]').isChecked(),true);
    }

    // Run production early: two taps (the first asks), then a Partial or Failed result naming the tile that broke it.
    await open();
    {await tap(p.locator('#ppRun'));assert.match(await p.locator('#ppRun').innerText(),/Tap again/);await tap(p.locator('#ppRun'));
      const t=await tier(),a=M.analyze(P,M.initial(P));assert.equal(t,a.fed?'Partial':'Failed');
      assert.match(await p.locator('#mgProduces').innerText(),a.fed?/Base partly online/:/Base offline/);
      assert.ok((await p.locator('#mgNear').innerText()).length>10);}

    // Skip: the automatic layout is shown, at a reduced result.
    await open();await tapCell(pipe);
    await p.locator('#mgAuto').click();assert.equal(await tier(),'Automatic');
    assert.match(await p.locator('#mgNear').innerText(),/^Solving it yourself runs every line at full output/);
    assert.match(await p.locator('#mgProduces').innerText(),/reduced output/);
    await p.locator('#mgReview').click();assert.equal(await count('.pp-sink.pp-sealed'),P.nets.length);await noOverflow(p,'auto '+tag);await shot('auto');

    // Expert: the rotation budget can run out, which ends the night with what is connected.
    if(P.budget){await open();await cell(pipe).focus();for(let k=0;k<P.budget;k++)await p.keyboard.press('Enter');
      const t=await tier();assert.ok(t==='Partial'||t==='Failed',t);assert.match(await p.locator('#mgHeadline').innerText(),/out of rotations/);}

    assert.deepEqual(errors,[]);await p.close();
  }

  // Contamination: two facing tiles of different products show the red marker and the Mixed meter (desktop, Normal).
  {const p=await browser.newPage({serviceWorkers:'block',viewport:{width:1280,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
    let pick=null;
    for(let seed=1;seed<=40&&!pick;seed++){const Q=M.generate(seed,'normal'),q=M.solvedState(Q);
      for(let k=0;k<Q.cells.length&&!pick;k++){if(Q.cells[k].kind!=='pipe')continue;
        for(const d of [1,2]){const j=M.nbr(Q.n,k,d);if(j<0||Q.cells[j].kind!=='pipe'||Q.cells[j].net===Q.cells[k].net)continue;
          for(let r=0;r<16&&!pick;r++){let s=q;for(let t=0;t<r%4;t++)s=M.rotate(Q,s,k,1).state;for(let t=0;t<(r>>2);t++)s=M.rotate(Q,s,j,1).state;
            if(M.analyze(Q,s).contam.length)pick={seed,Q,k,j,s};}}}}
    assert.ok(pick);const {Q,k,j,s}=pick;
    await p.goto(`${BASE}/prototypes/pipes.html?seed=${pick.seed}&difficulty=normal`);await p.locator('#ppBoard').waitFor();
    for(let i=0;i<Q.cells.length;i++){if(Q.cells[i].kind!=='pipe')continue;const n=M.tapsTo(Q.cells[i].piece,Q.start[i],M.maskAt(Q,s,i));for(let t=0;t<n;t++)await p.locator(`[data-cell="${i}"]`).click();}
    assert.ok(await p.locator('#mgStage .pp-contam').count()>=2,'red marker on both sides of the joint');
    assert.match(await p.locator(`[data-cell="${k}"]`).getAttribute('class'),/pp-bad/);assert.match(await p.locator(`[data-cell="${j}"]`).getAttribute('class'),/pp-bad/);
    assert.match(await p.locator('#mgMeters').innerText(),/Mixed\s*[1-9]/i);assert.match(await p.locator('.pp-line.bad').first().innerText(),/mixed/i);
    if(SHOTS)await p.screenshot({path:`${SHOTS}/pipes-contam-1280.png`});
    assert.deepEqual(errors,[]);await p.close();}

  console.log('PASS pipes browser: model-matched boards (endpoints, bridges, slots, tray, lines), ≥44px tiles and tools (8×8 at 390 too), tools beside the board at 1024×768, tap/Enter/Q/right-click turns, fixed tiles refuse, undo keeps the count, long-press / L / Lock tool locks, solved to Perfect by taps within par (plants fed and sealed, flow everywhere), hint → locked right tile → Good with its reason, Guided marks = model forced tiles, Relaxed local cascade → Solved · Relaxed, level remembered, Run production → Partial/Failed, skip = Automatic, Expert budget runs out, contamination marker and Mixed meter; no errors or overflow at 1280, 1024 and 390');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
