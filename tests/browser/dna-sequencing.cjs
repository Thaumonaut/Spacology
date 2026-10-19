// DNA sequencing mini-game (shotgun assembly): plays real puzzles by dragging and tapping, at desktop, iPad landscape
// and phone widths, headlessly. Serve the repository root (npm run serve), then:
// node tests/browser/dna-sequencing.cjs (or: node tests/run.cjs dna-sequencing). SPACOLOGY_HEADED=1 opens a visible
// browser for debugging only.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const M=require('../../prototypes/minigames/dna-sequencing/dna-sequencing-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
async function noOverflow(p,where){await p.waitForTimeout(250);const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
// Reduced motion: no transitions, shakes or staggered reveals, so no step waits on an animation to settle and the
// cascade, the celebration and the sample hand-over run at once. Keep it short: a long test is likelier to straddle an
// OS sleep (macOS dark wake), which freezes the browser and the test alike.
(async()=>{const T0=Date.now();const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  for(const [viewport,difficulty,seed] of [[{width:1280,height:900},'easy',4],[{width:1024,height:768},'expert',9],[{width:390,height:844},'normal',6]]){
    const tag=viewport.width,touch=tag!==1280,p=await browser.newPage({serviceWorkers:'block',viewport,hasTouch:touch,reducedMotion:'reduce'});const errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async name=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/dna-sequencing-${name}-${tag}.png`,fullPage:true});};
    const G=M.generate(seed,difficulty),url=`${BASE}/prototypes/dna-sequencing.html?seed=${seed}&difficulty=${difficulty}`;
    const strip=i=>p.locator(`#mgStage .dna-frag[data-frag="${i}"]`),tile=(i,k)=>strip(i).locator(`.dna-tile[data-k="${k}"]`);
    const open=async()=>{await p.goto(url);await p.locator('#dnaBoard').waitFor();await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(150);};
    const press=async sel=>{const l=p.locator(sel);await l.scrollIntoViewIfNeeded();if(touch)await l.tap();else await l.click();};
    const tapEl=async l=>{await l.scrollIntoViewIfNeeded();if(touch)await l.tap();else await l.click();};
    // The board as drawn: fragment offsets, flags, and the consensus cells.
    const board=async()=>p.evaluate(()=>({off:[...document.querySelectorAll('#mgStage .dna-frag')].map(s=>+s.dataset.off),
      flag:[...document.querySelectorAll('#mgStage .dna-frag')].map(s=>[...s.querySelectorAll('.dna-tile')].map(t=>t.classList.contains('dna-cut')?1:0)),
      cells:[...document.querySelectorAll('.dna-cell')].map(c=>c.dataset.status),known:+document.getElementById('dnaBoard').dataset.known}));
    const same=async(P,s,what)=>{const b=await board(),c=M.consensus(P,s);
      assert.deepEqual(b.off,s.off,what+': offsets');assert.deepEqual(b.flag,s.flag,what+': flags');
      assert.deepEqual(b.cells,c.cols.map(x=>x.status),what+': consensus cells');assert.equal(b.known,c.known,what+': consensus count');};
    const meter=async()=>p.locator('#mgMeters').innerText();
    const tier=async()=>{await p.locator('#mgResult:not([hidden])').waitFor({timeout:10000});return p.locator('#mgTier').innerText();};
    const sampleShown=async i=>p.waitForFunction(i=>/Sample\s*\n?\s*(\d+)/i.test(document.getElementById('mgMeters').innerText)&&document.getElementById('mgMeters').innerText.match(/Sample\s*\n?\s*(\d+)/i)[1]===String(i+1),i,{timeout:8000});
    const colW=async()=>{const a=await tile(0,0).boundingBox(),b=await tile(0,1).boundingBox();return b.x-a.x;};
    // Drag fragment i by d columns with the mouse (pointer events, every viewport).
    const dragBy=async(i,d)=>{
      const cw=await colW(),t=tile(i,Math.floor(P0(i).len/2));await t.scrollIntoViewIfNeeded();const b=await t.boundingBox(),x0=b.x+b.width/2,y0=b.y+b.height/2;
      await p.mouse.move(x0,y0);await p.mouse.down();await p.mouse.move(x0+d*cw*0.5,y0+2,{steps:4});await p.mouse.move(x0+d*cw,y0,{steps:4});await p.mouse.up();
    };
    let P=G.samples[0];const P0=i=>P.frags[i];
    // Taps only: select each fragment, press ◀ ▶ until it sits at its offset, flag each stretch first-and-last, run.
    const solveByTaps=async(P,s)=>{
      for(let i=0;i<P.frags.length;i++){
        const d=P.answer[i]-s.off[i];if(!d)continue;
        await tapEl(tile(i,0));
        for(let n=0;n<Math.abs(d);n++)await press(d>0?'#dnaRight':'#dnaLeft');
        s=M.apply(P,s,{type:'move',frag:i,to:P.answer[i]});
      }
      for(const st of P.stretches){
        await press('#dnaFlag');await tapEl(tile(st.frag,st.from));await tapEl(tile(st.frag,st.to));
        s=M.apply(P,s,{type:'flag',frag:st.frag,from:st.from,to:st.to});
      }
      await same(P,s,'solved by taps');
      return s;
    };

    // The page draws exactly the model's sample: scrambled offsets, nothing flagged, the model's consensus.
    await open();
    assert.equal(await p.locator('#mgStage .dna-frag').count(),P.frags.length);
    assert.equal(await p.locator('#mgStage .dna-tile.dna-miss').count(),P.frags.reduce((k,f)=>k+f.bases.filter(b=>b<0).length,0),'missing data drawn as ?');
    assert.equal(await p.locator('.dna-cell').count(),P.len,'one consensus cell per column');
    await same(P,M.startState(P),'start');
    assert.match(await meter(),new RegExp(`Consensus\\s*${M.consensus(P,M.startState(P)).known} / ${P.len}`,'i'));
    assert.match(await meter(),/Runs left\s*3/i);
    for(const t of ['A','C','G','T'])assert.ok(await p.locator(`.dna-foot .dna-key:has-text("${t}")`).count(),'glyph legend '+t);
    // Targets: tiles are ≥44px tall everywhere (≥20px wide even at Expert on a 1024 screen); every button ≥44px.
    {const b=await tile(0,0).boundingBox();assert.ok(b.height>=44,`tile height ${b.height} at ${tag}`);assert.ok(b.width>=20,`tile width ${b.width} at ${tag}`);
      for(const sel of ['#dnaLeft','#dnaRight','#dnaFlag','#dnaRun','#mgHint','#mgUndo','#mgAuto','#mgNew','.dna-level']){const x=await p.locator(sel).first().boundingBox();assert.ok(x.height>=44&&x.width>=44,`${sel} is a 44px target at ${tag}`);}}
    // The board fits without scrolling at 1280 and 1024; on the phone only the frame scrolls.
    {const f=await p.evaluate(()=>{const f=document.getElementById('dnaFrame');return f.scrollWidth-f.clientWidth;});
      if(tag===390)assert.ok(f>0,'the phone frame scrolls inside itself');else assert.ok(f<=1,`board scrolls at ${tag}: ${f}px`);}
    await noOverflow(p,'start '+tag);await shot('start');

    // A drag slides the whole fragment; columns and consensus follow the model. Undo (free) restores it.
    {const s0=M.startState(P),i=0,d=P.answer[0]>s0.off[0]?Math.min(2,P.answer[0]-s0.off[0]):-Math.min(2,s0.off[0]-P.answer[0]);
      await dragBy(i,d);const s1=M.apply(P,s0,{type:'move',frag:i,to:s0.off[i]+d});await same(P,s1,'drag');
      await press('#mgUndo');await same(P,s0,'undo');assert.equal(await p.locator('#mgUndo').isDisabled(),true);
      // Tap to select, then ▶ / ◀ nudge; arrow keys nudge the focused fragment.
      const j=1,dir=s0.off[j]+1+P.frags[j].len<=P.len?1:-1;
      await tapEl(tile(j,0));assert.match(await strip(j).getAttribute('class'),/dna-sel/);
      await press(dir>0?'#dnaRight':'#dnaLeft');const s2=M.apply(P,s0,{type:'move',frag:j,to:s0.off[j]+dir});await same(P,s2,'nudge');
      await strip(j).focus();await p.keyboard.press(dir>0?'ArrowLeft':'ArrowRight');await same(P,s0,'arrow key');
      // Pushing past the edge is refused and leaves the board alone.
      const e=P.frags.findIndex((f,k)=>s0.off[k]===0);
      if(e>=0){await tapEl(tile(e,0));await press('#dnaLeft');await same(P,s0,'edge refused');assert.match(await p.locator('#mgStatus').innerText(),/edge/);}}
    // A real finger drag (CDP touch events) slides a fragment too, on the iPad viewport.
    if(tag===1024){
      await open();const t=tile(1,2);await t.scrollIntoViewIfNeeded();const cdp=await p.context().newCDPSession(p),cw=await colW(),b=await t.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
      const s0=M.startState(P),d=s0.off[1]+2+P.frags[1].len<=P.len?2:-2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let n=1;n<=6;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+d*cw*n/6,y}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await same(P,M.apply(P,s0,{type:'move',frag:1,to:s0.off[1]+d}),'finger drag');
    }

    // A wrong run reports counts only, and spends a run.
    await open();
    {await press('#dnaRun');const r=M.runCheck(P,M.startState(P));
      assert.match(await p.locator('#mgStatus').innerText(),new RegExp(`^Run 1 failed: ${r.misplaced} fragments misplaced · contamination flag missing\\. 2 runs left\\.`));
      assert.match(await meter(),/Runs left\s*2/i);}

    // Hint: places the model's fragment and quotes its reason; undo takes it back for free.
    await open();
    {const s0=M.startState(P),h=M.hint(P,s0);await press('#mgHint');
      const status=await p.locator('#mgStatus').innerText();assert.match(status,/^Hint 1: /);assert.ok(status.includes(h.reason),status+' / '+h.reason);
      await same(P,M.apply(P,s0,h.move),'hint');await press('#mgUndo');await same(P,s0,'undo hint');}

    // Solve every sample by taps on the first run: the consensus fills to L/L, and the result is Perfect.
    await open();
    for(let n=0;n<G.samples.length;n++){
      P=G.samples[n];if(n)await sampleShown(n);
      const s=await solveByTaps(P,M.startState(P));
      assert.ok((await board()).cells.every(c=>c==='agree'||c==='single'),'the consensus is full');
      assert.match(await meter(),new RegExp(`Consensus\\s*${P.len} / ${P.len}`,'i'));
      if(n===0)await shot('aligned');
      void s;await press('#dnaRun');
    }
    {assert.equal(await tier(),'Perfect');const gain=M.difficulty(difficulty).gain;
      assert.match(await p.locator('#mgProduces').innerText(),new RegExp(`Flaw cleared: .+ on the .+ \\(card prototype\\) · \\+${gain}% completion`));
      assert.equal(await p.locator('#mgNear').isHidden(),true);
      await noOverflow(p,'result '+tag);await shot('perfect');
      await p.locator('#mgReview').click();assert.ok(await p.locator('.dna-tile.dna-agree').count()>0,'agreeing reads glow');
      assert.equal(await p.locator('.dna-tile.dna-cut').count(),P.stretches.reduce((k,s)=>k+s.to-s.from+1,0));}
    P=G.samples[0];

    // Skip: the automatic pass is Automatic, with less completion than a Perfect.
    await open();
    {await p.locator('#mgAuto').click();assert.equal(await tier(),'Automatic');
      const r=M.score(G,{auto:true});assert.ok(r.completion<M.difficulty(difficulty).gain);
      assert.match(await p.locator('#mgStats').innerText(),new RegExp(`Completion\\s*\\+${r.completion}%`,'i'));
      await p.locator('#mgReview').click();await same(P,M.solvedState(P),'auto board');await noOverflow(p,'auto '+tag);await shot('auto');}

    if(tag===1024){
      // Three failed runs lose the sample (the true alignment is shown); solving the second sample gives Partial, and the
      // near-miss names what went wrong.
      await open();for(let n=0;n<3;n++)await press('#dnaRun');
      assert.match(await p.locator('#mgStatus').innerText(),/Sample lost/);
      await same(P,M.solvedState(P),'reveal after the third failure');
      await sampleShown(1);P=G.samples[1];await solveByTaps(P,M.startState(P));await press('#dnaRun');
      assert.equal(await tier(),'Partial');assert.match(await p.locator('#mgNear').innerText(),/^Fragment \d+ sat \d+ columns? too far/);
      P=G.samples[0];
    }
    if(tag===1280){
      // Guided outlines exactly the model's guided fragments and shows where they go.
      await open();await p.locator('input[name="dnaLevel"][value="guided"]').check();
      const g=M.guided(P,M.startState(P)).filter(x=>!x.here);
      assert.ok(g.length>0,'Guided has something to show at the start');
      assert.deepEqual(await p.$$eval('.dna-frag.dna-guide',e=>e.map(x=>+x.dataset.frag).sort()),g.map(x=>x.frag).sort());
      assert.equal(await p.locator('.dna-ghost:not([hidden])').count(),g.length);
      // Relaxed: placing one fragment cascades the ones it pins down, never wrongly; it is remembered, and the result
      // is "Solved · Relaxed", Good.
      await p.locator('input[name="dnaLevel"][value="relaxed"]').check();
      await open();assert.equal(await p.locator('input[name="dnaLevel"][value="relaxed"]').isChecked(),true,'the assist level is remembered');
      const u=P.wayIn[0],s0=M.startState(P),d=P.answer[u.i]-s0.off[u.i];
      await tapEl(tile(u.i,0));for(let n=0;n<Math.abs(d);n++)await press(d>0?'#dnaRight':'#dnaLeft');
      const placed=M.apply(P,s0,{type:'move',frag:u.i,to:P.answer[u.i]}),c=M.cascade(P,placed);
      assert.ok(c.moves.length>0,'the placement cascades');
      await p.waitForFunction(n=>!document.getElementById('dnaRun').disabled,null,{timeout:8000});await p.waitForTimeout(100);
      await same(P,c.state,'relaxed cascade');
      const done=await solveByTaps(P,c.state);void done;await press('#dnaRun');
      assert.equal(await tier(),'Good');assert.match(await p.locator('#mgHeadline').innerText(),/^Solved · Relaxed\./);
      assert.match(await p.locator('#mgStats').innerText(),/Assist level\s*Relaxed/i);
      await p.locator('#mgReview').click();await p.locator('input[name="dnaLevel"][value="puzzle"]').check();
    }

    assert.deepEqual(errors,[]);await p.close();
  }
  console.log(`(dna-sequencing browser: ${((Date.now()-T0)/1000).toFixed(1)} s)`);
  console.log('PASS dna-sequencing browser: model-matched fragments, ? tiles and consensus, ≥44px-tall tiles and 44px buttons, board fits 1280/1024 and scrolls only in its frame at 390; whole-fragment drag, free undo, tap + ◀ ▶ nudge, arrow keys, edge refused, CDP finger drag; a wrong run reports counts; hint plays the model hint; every sample solved by taps fills the consensus → Perfect with flaw cleared; skip → Automatic below Perfect; three failed runs → sample lost → Partial with a near-miss; Guided outlines the model\'s forced fragments; Relaxed cascades, remembered, "Solved · Relaxed" → Good; no errors or overflow at 1280, 1024 and 390');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
