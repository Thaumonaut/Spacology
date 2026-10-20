// Depot sorting mini-game (water-sort with crates): plays real depots by tapping at desktop, iPad landscape and phone
// widths, headlessly. Serve the repository root (npm run serve), then: node tests/browser/depot-sorting.cjs
// (or: node tests/run.cjs depot-sorting). SPACOLOGY_HEADED=1 opens a visible browser for debugging only.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const D=require('../../prototypes/minigames/depot-sorting/depot-sorting-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
const TYPE_INDEX=Object.fromEntries(D.TYPES.map((t,i)=>[t.id,i]));
async function noOverflow(p,where){await p.waitForTimeout(150);const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  // The widest depot (Expert: 7 bays + hold) fits 1024×768 in one row and a phone in two, all bays ≥44px.
  for(const viewport of [{width:1024,height:768},{width:390,height:844}]){
    const p=await browser.newPage({serviceWorkers:'block',viewport,hasTouch:viewport.width<500});
    await p.goto(`${BASE}/prototypes/depot-sorting.html?seed=3&difficulty=expert`);await p.locator('#dpBoard').waitFor();
    const boxes=await p.locator('#dpBoard [data-bay]').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height,r.top,r.bottom];}));
    for(const [w,h] of boxes)assert.ok(w>=44&&h>=44,`bay ${w}×${h} at ${viewport.width}`);
    if(viewport.width===1024){assert.equal(new Set(boxes.map(b=>Math.round(b[3]))).size,1,'one row at 1024');
      assert.ok(Math.max(...boxes.map(b=>b[3]))<=768,'the whole depot is visible at 1024×768 without scrolling');}
    await noOverflow(p,'expert '+viewport.width);await p.close();
  }

  for(const [viewport,difficulty,seed] of [[{width:1280,height:900},'expert',12],[{width:1024,height:768},'hard',5],[{width:390,height:844},'normal',7]]){
    const tag=viewport.width,touch=tag!==1280,p=await browser.newPage({serviceWorkers:'block',viewport,hasTouch:touch});const errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async name=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/depot-sorting-${name}-${tag}.png`,fullPage:true});};
    const P=D.generate(seed,difficulty),url=`${BASE}/prototypes/depot-sorting.html?seed=${seed}&difficulty=${difficulty}`;
    const bay=i=>p.locator(`#dpBoard [data-bay="${i}"]`);
    const cls=async i=>(await bay(i).getAttribute('class'))||'';
    const idle=()=>p.locator('#dpBoard[data-busy="0"]').waitFor();
    const tap=async i=>{if(touch)await bay(i).tap();else await bay(i).click();};
    const press=async sel=>{if(touch)await p.locator(sel).tap();else await p.locator(sel).click();};
    const board=()=>p.locator('#dpBoard [data-bay]').evaluateAll(els=>els.map(e=>[...e.querySelectorAll('.dp-stack .dp-crate')].map(c=>c.dataset.type)));
    const state=async()=>(await board()).map(b=>b.map(t=>TYPE_INDEX[t]));
    const undo=async expected=>{
      await press('#mgUndo');
      await p.waitForFunction(want=>JSON.stringify([...document.querySelectorAll('#dpBoard [data-bay]')].map(e=>[...e.querySelectorAll('.dp-stack .dp-crate')].map(c=>c.dataset.type)))===JSON.stringify(want),expected.map(b=>b.map(t=>D.TYPES[t].id)));
      assert.deepEqual(await state(),expected,'undo at '+tag);
    };
    const move=async m=>{await tap(m.from);await tap(m.to);await idle();};
    const meter=()=>p.locator('#mgMeters').innerText();
    const tier=async()=>{await p.locator('#mgResult:not([hidden])').waitFor();return p.locator('#mgTier').innerText();};
    const open=async()=>{await p.goto(url);await p.locator('#dpBoard').waitFor();};
    const setLevel=async id=>{await p.locator(`.dp-level:has(input[value="${id}"])`).click();await idle();};
    // Plays a best route from whatever is on the board until the result card shows (re-planned each move, so it also
    // works after Relaxed cascades and hints).
    const finishRoute=async()=>{for(let k=0;k<80;k++){if(await p.locator('#mgResult:not([hidden])').count())return;const s=await state();if(D.solved(P,s))break;await move(D.route(P,s).moves[0]);}};

    // The page draws exactly the model's depot: bays, loading tags, hold and crates; ≥44px targets, no overflow.
    await open();
    assert.equal(await p.locator('#dpBoard [data-bay]').count(),P.bays.length);
    assert.deepEqual(await state(),P.start);
    assert.equal(await p.locator('#dpBoard .dp-load').count(),P.loads.length);
    assert.equal(await p.locator('#dpBoard .dp-hold').count(),P.bays.some(b=>b.kind==='hold')?1:0);
    assert.match(await meter(),new RegExp(`Par\\s*${P.par}`,'i'));
    if(P.budget)assert.match(await meter(),new RegExp(`Budget left\\s*${P.budget}`,'i'));
    for(let i=0;i<P.bays.length;i++){const b=await bay(i).boundingBox();assert.ok(b.width>=44&&b.height>=44,`bay ${i} is ${b.width}×${b.height} at ${tag}`);}
    for(const id of ['mgHint','mgUndo','mgAuto','mgNew']){const b=await p.locator('#'+id).boundingBox();assert.ok(b.height>=44&&b.width>=44,id+' is a 44px target');}
    assert.match(await bay(P.bays.length-1).getAttribute('aria-label'),/^(Bay|The hold)/);
    await noOverflow(p,'start '+tag);await shot('start');

    // Lift and put down: the top run rises; tapping the same bay lowers it.
    const src=P.solution[0].from;
    await tap(src);assert.match(await cls(src),/dp-up/);
    assert.equal(await bay(src).locator('.dp-lifted').count(),D.runLength(P.start[src]));
    await tap(src);assert.doesNotMatch(await cls(src),/dp-up/);

    // An illegal drop shakes the target, explains why, keeps the stack lifted and changes nothing.
    {const bad=D.legalMoves(P,P.start).length,ill=[];for(let f=0;f<P.bays.length;f++)for(let t=0;t<P.bays.length;t++)if(f!==t&&P.start[f].length&&D.illegal(P,P.start,{from:f,to:t}))ill.push({from:f,to:t});
      assert.ok(bad>0&&ill.length>0);const m=ill[0];
      await tap(m.from);await tap(m.to);
      assert.match(await cls(m.to),/mg-shake/);assert.equal(await p.locator('#mgStatus').innerText(),D.illegal(P,P.start,m));
      assert.match(await cls(m.from),/dp-up/,'still lifted');assert.deepEqual(await state(),P.start);assert.match(await meter(),/Moves\s*0/i);
      await tap(m.from);}

    // A legal move, then undo: the board and the move count go back.
    {const m=P.solution[0],want=D.apply(P,P.start,m).state;await move(m);
      assert.deepEqual(await state(),want);assert.match(await meter(),/Moves\s*1/i);
      await undo(P.start);assert.match(await meter(),/Moves\s*0/i);
      assert.equal(await p.locator('#mgUndo').isDisabled(),true);}

    // Drag: mouse on desktop, a real finger (CDP touch events) on touch viewports. The run drops where it is released.
    {const m=P.solution[0],center=async i=>{const b=await bay(i).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height*0.6};};
      const a=await center(m.from),b=await center(m.to);
      if(!touch){await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move((a.x+b.x)/2,a.y-60,{steps:5});
        assert.equal(await p.locator('.dp-ghost-run').count(),1,'a ghost run follows the pointer');await p.mouse.move(b.x,b.y,{steps:5});await p.mouse.up();}
      else{const cdp=await p.context().newCDPSession(p);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
        // Sideways first (vertical swipes scroll the page), then on to the target bay.
        const side=b.x>=a.x?1:-1;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+side*16,y:a.y}]});
        for(let k=1;k<=6;k++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+side*16+(b.x-a.x-side*16)*k/6,y:a.y+(b.y-a.y)*k/6}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
      await idle();assert.deepEqual(await state(),D.apply(P,P.start,m).state,'drag moved the run at '+tag);
      assert.equal(await p.locator('.dp-ghost-run').count(),0);assert.match(await meter(),/Moves\s*1/i);
      await undo(P.start);}

    // Guided: a lifted stack lights exactly its legal drops and dims the rest.
    {await setLevel('guided');const f=P.solution[0].from;await tap(f);
      assert.equal(await p.locator('#dpBoard .dp-ok').count(),D.targets(P,P.start,f).length);
      for(const t of D.targets(P,P.start,f))assert.match(await cls(t),/dp-ok/);
      assert.equal(await p.locator('#dpBoard .dp-no').count(),P.bays.length-1-D.targets(P,P.start,f).length);
      await tap(f);assert.equal(await p.locator('#dpBoard .dp-ok').count(),0);
      await setLevel('puzzle');await tap(f);assert.equal(await p.locator('#dpBoard .dp-ok').count(),0,'Puzzle shows no targets');await tap(f);}

    // Solve to Perfect by tapping the model's optimal route: seals stamp in, the result names the production.
    await open();
    {let sealedSeen=0;for(const m of P.solution){await move(m);sealedSeen=Math.max(sealedSeen,await p.locator('#dpBoard .dp-sealed').count());}
      assert.ok(sealedSeen>=P.types-1);
      assert.equal(await tier(),'Perfect');
      assert.match(await p.locator('#mgProduces').innerText(),new RegExp(`Depot sorted: ${P.types} bays ready for tonight’s`));
      assert.equal(await p.locator('#mgNear').isHidden(),true);
      const stats=await p.locator('#mgStats').innerText();assert.match(stats,new RegExp(`Moves\\s*${P.par} / par ${P.par}`,'i'));assert.match(stats,/Hints\s*0/i);
      await noOverflow(p,'result '+tag);await shot('perfect');
      await p.locator('#mgReview').click();assert.equal(await p.locator('#dpBoard .dp-sealed').count(),P.types);}

    // Hint: lights the next move on a best route and names it; following hints solves but scores Good.
    await open();
    {const h=D.hint(P,P.start,[],P.budget);await press('#mgHint');
      assert.equal(await p.locator('#mgStatus').innerText(),'Hint 1: '+h.text);
      assert.match(await cls(h.move.from),/dp-hint-from/);assert.match(await cls(h.move.to),/dp-hint-to/);await shot('hint');
      await move(h.move);assert.equal(await p.locator('#dpBoard .dp-hint-from').count(),0,'the hint clears after a move');
      await finishRoute();assert.equal(await tier(),'Good');
      assert.match(await p.locator('#mgNear').innerText(),/without the 1 hint this was Perfect/);}

    // Undo to here: wander into a dead end (if this depot has one within reach) and the hint offers the rewind.
    if(tag===1024){
      await open();const K=require('../../prototypes/shared/minigames/minigame-kit.js'),rng=K.rng(99);let s=P.start,path=[],dead=null;
      for(let tries=0;tries<200&&!dead;tries++){s=P.start;path=[];for(let k=0;k<30;k++){const ms=D.legalMoves(P,s);if(!ms.length)break;const m=rng.pick(ms);path.push(m);s=D.apply(P,s,m).state;if(D.solve(P,s,{budget:15000}).exhausted){dead=path.slice();break;}}}
      assert.ok(dead,'a dead end within reach');{for(const m of dead)await move(m);
        assert.match(await p.locator('#mgStatus').innerText(),/No (route|moves)/);
        await press('#mgHint');assert.match(await p.locator('#mgStatus').innerText(),/^Hint 1: Undo \d+ step/);
        assert.equal(await p.locator('#dpRewind').isVisible(),true);await press('#dpRewind');
        const back=await state();assert.ok(D.route(P,back).moves,'the rewind lands on a board that can finish');}
    }

    // Relaxed: obvious finishing moves cascade in by themselves; the solve is labelled and scored below Perfect.
    await open();
    {await setLevel('relaxed');await finishRoute();assert.equal(await tier(),'Good');
      assert.match(await p.locator('#mgHeadline').innerText(),/^Solved · Relaxed/);
      const auto=Number((await p.locator('#mgStats').innerText()).match(/Auto-moves\s*(\d+)/i)[1]);assert.ok(auto>0,'the cascade made moves');
      await p.locator('#mgReview').click();await setLevel('puzzle');}

    // Expert budget: shuttle one crate between the spare bay and the hold until the budget runs out → Failed.
    if(P.budget){
      await open();const spare=P.bays.findIndex((b,i)=>b.kind==='plain'&&!P.start[i].length),hold=P.bays.findIndex(b=>b.kind==='hold');
      const from=P.start.findIndex((b,i)=>b.length&&P.bays[i].kind!=='hold');
      await move({from,to:spare});
      for(let k=1;k<P.budget;k++)await move(k%2?{from:spare,to:hold}:{from:hold,to:spare});
      assert.equal(await tier(),'Failed');assert.match(await p.locator('#mgHeadline').innerText(),/budget ran out/);
      assert.ok((await p.locator('#mgNear').innerText()).length>0);await p.locator('#mgReview').click();
    }

    // Skip: the yard crew seals half the types and stops; the result is Automatic.
    await open();await move(P.solution[0]);
    await p.locator('#mgAuto').click();assert.equal(await tier(),'Automatic');
    assert.match(await p.locator('#mgStats').innerText(),new RegExp(`Sealed\\s*${Math.ceil(P.types/2)}/${P.types}`,'i'));
    assert.match(await p.locator('#mgNear').innerText(),/^Sorting it yourself/);await shot('auto');
    await p.locator('#mgReview').click();await p.waitForTimeout(50);assert.equal(await p.locator('#dpBoard .dp-sealed').count(),Math.ceil(P.types/2));
    await noOverflow(p,'auto '+tag);

    assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS depot-sorting browser: model-matched depots (bays, loading bays, hold, crates), Expert fits 1024×768 in one row and phones in two, ≥44px bays and tools, lift/put down, illegal drop shakes with the reason and changes nothing, move + undo, mouse and finger drag, Guided lights exactly the legal drops, optimal taps → Perfect with seals and output, hint → Good with near-miss, undo-to-here rewind, Relaxed cascade → "Solved · Relaxed" Good, Expert budget → Failed, skip = half sealed Automatic; no errors or overflow at 1280, 1024 and 390');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
