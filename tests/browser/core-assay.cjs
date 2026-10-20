// Core assay mini-game (spectrum peak matching): plays real cores by tapping, at desktop, iPad landscape and phone
// widths, headlessly. Serve the repository root (npm run serve), then: node tests/browser/core-assay.cjs
// (or: node tests/run.cjs core-assay). SPACOLOGY_HEADED=1 opens a visible browser for debugging only.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const A=require('../../prototypes/minigames/core-assay/core-assay-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
async function noOverflow(p,where){await p.waitForTimeout(300);const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  for(const [viewport,difficulty,seed] of [[{width:1280,height:900},'expert',5],[{width:1024,height:768},'expert',12],[{width:390,height:844},'hard',7]]){
    const tag=viewport.width,touch=tag!==1280,p=await browser.newPage({serviceWorkers:'block',viewport,hasTouch:touch});const errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async name=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/core-assay-${name}-${tag}.png`});};
    const P=A.generate(seed,difficulty),L=P.library.length,url=`${BASE}/prototypes/core-assay.html?seed=${seed}&difficulty=${difficulty}`;
    const press=async sel=>{const l=p.locator(sel).first();if(touch)await l.tap();else await l.click();};
    const amt=(m,v)=>`#caLib [data-mineral="${m}"][data-amount="${v}"]`;
    const pressed=async m=>{for(const v of A.AMOUNTS)if(await p.locator(amt(m,v)).getAttribute('aria-pressed')==='true')return v;return null;};
    const tier=async()=>{await p.locator('#mgResult:not([hidden])').waitFor();return p.locator('#mgTier').innerText();};
    const open=async()=>{await p.goto(url);await p.locator('#caLib').waitFor();};
    const status=()=>p.locator('#mgStatus').innerText();
    // Select a channel by tapping the scope over its column, as a player would.
    const pickChannel=async c=>{const b=await p.locator(`#caPlot [data-channel="${c}"]`).boundingBox();
      if(touch)await p.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);else{await p.mouse.click(b.x+b.width/2,b.y+b.height/2);await p.mouse.move(1,1);}
      assert.match(await p.locator('#caReadout').innerText(),new RegExp(`^Ch ${c+1} reads `));};
    // Set each amount the model planted (unchanged buttons stay put), flag the stray, test, move on.
    const setSample=async(si,amounts)=>{for(let m=0;m<L;m++)if(await pressed(m)!==amounts[m])await press(amt(m,amounts[m]));
      if(P.stray){await pickChannel(P.samples[si].stray);if(await p.locator('#caFlag').getAttribute('aria-pressed')!=='true')await press('#caFlag');
        assert.equal(await p.locator('#caFlag').getAttribute('aria-pressed'),'true');}};
    const nextSample=async si=>{if(si+1<P.samples.length){await press('#caNextSample');await p.locator(`#caSamples .ca-pill-on`).filter({hasText:P.samples[si+1].site}).waitFor();}};
    const solveFrom=async from=>{for(let si=from;si<P.samples.length;si++){await setSample(si,P.samples[si].amounts);await press('#caTest');await nextSample(si);}};

    // The page draws the model's core: C channel columns, the library, ≥44px targets, no overflow.
    await open();
    assert.equal(await p.locator('#caPlot [data-channel]').count(),P.channels);
    assert.equal(await p.locator('#caRes [data-rchannel]').count(),P.channels);
    assert.equal(await p.locator('#caLib [data-row]').count(),L);
    for(let m=0;m<L;m++)assert.ok((await p.locator(`#caLib [data-row="${m}"]`).innerText()).includes(P.library[m].name));
    for(const sel of ['#caPrev','#caNext','#caTest',...(P.stray?['#caFlag']:[]),'[data-assist="relaxed"]',amt(0,0),amt(L-1,3)]){
      const b=await p.locator(sel).first().boundingBox();assert.ok(b.width>=44&&b.height>=44,`${sel} is a 44px target at ${tag}: ${b.width}×${b.height}`);}
    if(tag===1024){const b=await p.locator('#caTest').boundingBox();assert.ok(b.y+b.height<=viewport.height,`Test button fits 1024×768 on load (${b.y+b.height})`);}
    await noOverflow(p,'start '+tag);await shot('start');

    // Consequence, not oracle: setting one mineral too high turns its peaks red ("over") in the residual; ◀ ▶ step.
    {const m=P.library.findIndex(M=>M.peaks.length>=2),c=P.library[m].peaks[0].ch;
      await press(amt(m,3));const s=A.channelStates(P,0,Array.from({length:L},(_,k)=>k===m?3:null),null);
      for(const pk of P.library[m].peaks)assert.match(await p.locator(`#caRes [data-rchannel="${pk.ch}"]`).getAttribute('class'),new RegExp('ca-r-'+s[pk.ch]));
      await pickChannel(c);await press('#caNext');assert.match(await p.locator('#caReadout').innerText(),new RegExp(`^Ch ${c+2} `));
      // Undo puts the amount back to unset; the button is free.
      await press('#mgUndo');assert.equal(await pressed(m),null);assert.equal(await p.locator('#mgUndo').isDisabled(),true);}

    // Solve to Perfect by taps: every sample exact on the first test, the residual flatlining before each test.
    await open();
    for(let si=0;si<P.samples.length;si++){
      await setSample(si,P.samples[si].amounts);
      assert.match(await p.locator('#caScope').getAttribute('class'),/ca-flat/,'the residual flatlines on the answer');
      assert.match(await p.locator('#caTest').getAttribute('class'),/ca-ready/);
      if(si===0)await shot('flat');
      await press('#caTest');
      assert.match(await status(),new RegExp(`Exact on test 1\\. ${A.node(P,si,P.samples[si].amounts).text.replace(/[()+]/g,'\\$&')}`));
      await nextSample(si);
    }
    assert.equal(await tier(),'Perfect');
    assert.ok((await p.locator('#mgProduces').innerText()).includes(A.node(P,0,P.samples[0].amounts).text));
    assert.equal(await p.locator('#mgNear').isHidden(),true);assert.match(await p.locator('#mgStats').innerText(),/Hints\s*0/i);
    await noOverflow(p,'result '+tag);await shot('perfect');

    // A wrong test names exactly the wrong minerals (not by how much) and costs Perfect; fixed, it is Good, and the
    // near-miss names the channel that would have told you.
    await open();
    {const s=P.samples[0],g=s.amounts.slice(),w=[0,L-1];for(const m of w)g[m]=(g[m]+1)%4;
      await setSample(0,g);await press('#caTest');
      for(let m=0;m<L;m++)assert.equal(/ca-wrong/.test(await p.locator(`#caLib [data-row="${m}"]`).getAttribute('class')),w.includes(m));
      assert.match(await status(),/is wrong|are wrong/);assert.match(await p.locator('#mgMeters').innerText(),/Tests left\s*2/i);
      await shot('wrong');
      await solveFrom(0);assert.equal(await tier(),'Good');
      const r=[{exact:true,testsUsed:2,hints:0,firstWrong:w}];
      assert.equal(await p.locator('#mgNear').innerText(),A.nearMiss(P,r));}

    // Three wrong tests fail the sample (answer shown, no node); the rest solved makes it Partial.
    if(tag===390){await open();const g=P.samples[0].amounts.map(a=>(a+1)%4);await setSample(0,g);
      for(let k=0;k<3;k++)await press('#caTest');
      assert.match(await status(),/Out of tests/);for(let m=0;m<L;m++)assert.equal(await pressed(m),P.samples[0].amounts[m]);
      await nextSample(0);await solveFrom(1);assert.equal(await tier(),'Partial');}

    // Hint: applies the model's next step and quotes its reason; solving after is Good.
    await open();
    {const h=A.hint(P,0,A.empty(P));await press('#mgHint');
      const st=await status();assert.match(st,/^Hint 1: /);assert.ok(st.includes(h.reason));
      if(h.kind==='amount'){assert.equal(await pressed(h.mineral),h.value);assert.match(await p.locator(`#caLib [data-row="${h.mineral}"]`).getAttribute('class'),/ca-hinted/);}
      assert.match(await p.locator('#caReadout').innerText(),new RegExp(`^Ch ${h.channel+1} `),'the hint selects its channel');
      await shot('hint');await solveFrom(0);assert.equal(await tier(),'Good');assert.match(await p.locator('#mgStats').innerText(),/Hints\s*1/i);}

    // Guided stars exactly the unique peaks; Relaxed fills forced amounts (one undo step with the move), never Perfect.
    if(tag===1024){
      await open();await press('[data-assist="guided"]');
      const uniq=P.library.reduce((t,_,m)=>t+A.uniquePeaks(P,m).length,0);
      assert.equal(await p.locator('#caLib .ca-chip.ca-unique').count(),uniq);assert.equal(await p.locator('#caPlot .ca-col.ca-unique').count(),uniq);
      await press('[data-assist="relaxed"]');await open();
      const want=A.relaxedFills(P,0,A.empty(P));await p.waitForTimeout(250*(want.fills.length+2));
      for(const f of want.fills)assert.equal(await pressed(f.mineral),f.value,'relaxed fill');
      assert.equal(await p.evaluate(()=>localStorage.getItem('spacologyCoreAssayAssistV1')),'relaxed');
      await shot('relaxed');await solveFrom(0);assert.equal(await tier(),'Good');
      assert.match(await p.locator('#mgHeadline').innerText(),/^Solved · Relaxed\. /);
      await p.locator('#mgReview').click();await press('[data-assist="puzzle"]');
    }

    // Skip: the automatic assay gives rough nodes and the Automatic tier.
    await open();await press(amt(0,1));
    await p.locator('#mgAuto').click();assert.equal(await tier(),'Automatic');
    assert.match(await p.locator('#mgProduces').innerText(),/rough survey/);assert.match(await p.locator('#mgNear').innerText(),/^Solving would have found/);
    await shot('auto');await noOverflow(p,'auto '+tag);

    assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS core-assay browser: model-matched scopes and libraries, ≥44px targets, Test fits 1024×768 on load, over/under residual states, channel picking by tap and ◀ ▶, free undo, tap-solve to Perfect with flatline and Expert stray flags, wrong test names the wrong minerals → Good with the model near-miss, 3 wrong tests → Partial, hint → Good, Guided stars unique peaks, Relaxed fills match the model and are never Perfect, skip → Automatic; no errors or overflow at 1280, 1024 and 390');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
