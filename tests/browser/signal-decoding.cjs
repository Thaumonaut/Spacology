// Signal breach: loads fixed seeds at three viewports, checks touch-size cells and no overflow (6x6 and 7x7), the
// top-row rule, tap-to-preview, Upload, Undo, Hint, Skip and Disconnect, the overlap tip, and solves to Perfect by tapping
// the model's par route (every daemon uploaded, shared codes marked as chained, an improved blueprint delivered).
// Headless unless SPACOLOGY_HEADED=1. Serve the repository root, then: node tests/run.cjs signal-decoding
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const M=require('../../prototypes/minigames/signal-decoding/signal-decoding-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
const url=(seed,diff)=>`${BASE}/prototypes/signal-decoding.html?seed=${seed}&difficulty=${diff}`;
async function noOverflow(p,where){const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
const cell=c=>`[data-cell="${c}"]`;
const bufferText=async p=>(await p.locator('.sb-slot.full').allInnerTexts()).join(' ');

(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  const SEED=11,DIFF='normal',pz=M.generate(SEED,DIFF);
  for(const viewport of [{width:1280,height:900},{width:1024,height:768},{width:390,height:844}]){
    const tag=viewport.width,p=await browser.newPage({serviceWorkers:'block',viewport,reducedMotion:'reduce'}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async n=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/signal-decoding-${n}-${tag}.png`,fullPage:true});};

    // The largest matrix fits with full-size touch targets.
    const big=M.generate(3,'expert');await p.goto(url(3,'expert'));await p.locator('.sb-cell').first().waitFor();
    assert.equal(await p.locator('.sb-cell').count(),49);
    for(const c of [0,48]){const b=await p.locator(cell(c)).boundingBox();assert.ok(b.width>=44&&b.height>=44,`expert cell ${b.width}x${b.height} at ${tag}`);}
    assert.equal(await p.locator(cell(48)).innerText(),big.grid[48]);
    const rowTop=async c=>(await p.locator(cell(c)).boundingBox()).y;assert.equal(await rowTop(6),await rowTop(0),'the matrix lays out 7 columns');assert.ok(await rowTop(7)>await rowTop(0));
    await noOverflow(p,'expert '+tag);await shot('expert');

    await p.goto(url(SEED,DIFF));await p.locator('.sb-cell').first().waitFor();
    assert.equal(await p.locator('.mg-head h1').innerText(),'Signal breach');
    const shown=await p.locator('.sb-cell b').allInnerTexts();assert.deepEqual(shown,pz.grid,'the page shows the model’s matrix');
    assert.equal(await p.locator('.sb-daemon').count(),pz.daemons.length);assert.equal(await p.locator('.sb-slot').count(),pz.buffer);
    assert.equal(await p.locator('.sb-cell.live').count(),pz.size,'only the top row is live');
    assert.match(await p.locator('.sb-blueprint').innerText(),new RegExp(`${pz.blueprint.name} blueprint · ${pz.daemons.length} fragments`,'i'));
    assert.match(await p.locator('.mg-output').innerText(),/blueprints for logistics/);
    assert.match(await p.locator('.mg-rules').innerText(),/fragment of a blueprint/);
    assert.match(await p.locator('.sb-tip').innerText(),/Daemons share codes — overlap them to fit the buffer/);
    assert.match(await p.locator('#mgStatus').innerText(),new RegExp(`need ${pz.naive} codes back to back; the buffer holds ${pz.buffer}`));
    assert.equal(await p.locator('.sb-chip.link').count(),0,'shared codes stay hidden before any pick');
    const box=await p.locator(cell(0)).boundingBox();assert.ok(box.height>=44&&box.width>=44,`cell ${box.width}x${box.height}`);
    for(const id of ['#sbUpload','#sbDisconnect']){const b=await p.locator(id).boundingBox();assert.ok(b.height>=44);}
    await noOverflow(p,'start '+tag);await shot('start');

    // Off the active line: refused, nothing enters the buffer.
    await p.locator(cell(pz.size)).click();
    assert.match(await p.locator('#mgStatus').innerText(),/top row/);assert.equal(await p.locator('.sb-slot.full').count(),0);

    // Tap previews (gold ghost slot, the next line marked), a second tap uploads, Undo withdraws it.
    const first=pz.parPath[0];
    await p.locator(cell(first)).click();
    assert.equal(await p.locator('.sb-slot.ghost').innerText(),pz.grid[first]);assert.equal(await p.locator('.sb-slot.full').count(),0);
    assert.match(await p.locator('#mgStatus').innerText(),/^Preview/);assert.equal(await p.locator('.sb-cell.next').count(),pz.size-1,'the column the preview opens');
    await p.locator(cell(first)).click();
    assert.equal(await bufferText(p),pz.grid[first]);
    assert.match(await p.locator('#sbLine').innerText(),new RegExp(`COLUMN ${first%pz.size+1}`));
    assert.equal(await p.locator('.sb-cell.live').count(),pz.size-1,'the live line is the column, minus the used cell');
    await p.locator('#mgUndo').click();
    assert.equal(await p.locator('.sb-slot.full').count(),0);assert.equal(await p.locator('#mgUndo').isDisabled(),true);

    // Hint highlights an optimal pick and pre-selects it; Upload commits it.
    const h=M.hint(pz,M.create());await p.locator('#mgHint').click();
    assert.equal(await p.locator('.sb-cell.hint').getAttribute('data-cell'),String(h.cell));
    await p.locator('#sbUpload').click();assert.equal(await bufferText(p),pz.grid[h.cell]);

    // Skip runs the automatic fallback: the cheapest daemon only.
    await p.locator('#mgAuto').click();await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Automatic');
    assert.equal(await p.locator('#mgProduces').innerText(),`Delivered: ${M.auto(pz).output}`);
    assert.match(await p.locator('#mgProduces').innerText(),new RegExp(`1 of ${pz.daemons.length} fragments toward the ${pz.blueprint.name} blueprint.*carry over`));
    assert.match(await p.locator('#mgNear').innerText(),/Planning the route yourself/);
    await noOverflow(p,'auto '+tag);await shot('auto');

    // A fresh load solved by tapping the par route is Perfect and delivers every daemon on it.
    await p.goto(url(SEED,DIFF));await p.locator('.sb-cell').first().waitFor();
    let st=M.create();
    for(const c of pz.parPath){await p.locator(cell(c)).click();await p.locator(cell(c)).click();st=M.act(pz,st,{type:'pick',cell:c}).state;}
    assert.equal(M.status(pz,st),'complete','the par route uploads every daemon');
    const chains=M.evaluate(pz,st.picks).chains;assert.ok(chains.length>=1);
    assert.match(await p.locator('#mgStatus').innerText(),new RegExp(`^Every daemon uploaded\\. Full breach: the ${pz.blueprint.name} blueprint is whole\\.`));
    assert.equal(await p.locator('.sb-slot.shared').count(),new Set(chains.flatMap(c=>Array.from({length:c.end-c.start},(_,i)=>c.start+i))).size,'shared slots marked');
    assert.ok(await p.locator('.sb-chip.link').count()>=2,'shared codes revealed once the daemons are under way');
    await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Perfect');
    assert.equal(await p.locator('.sb-daemon.up').count(),pz.daemons.length);
    assert.match(await p.locator('#mgProduces').innerText(),new RegExp(`Blueprint complete and improved: ${pz.blueprint.name}`));
    assert.equal(await p.locator('#mgNear').isHidden(),true,'no near-miss on a perfect breach');
    await noOverflow(p,'result '+tag);await shot('result');
    assert.deepEqual(errors,[],'no console or page errors');
    await p.close();
  }
  // Disconnecting at once: Failed, and the near-miss names a real first pick.
  const p=await browser.newPage({serviceWorkers:'block',viewport:{width:1024,height:768},reducedMotion:'reduce'});
  await p.goto(url(SEED,DIFF));await p.locator('.sb-cell').first().waitFor();
  await p.locator('#sbDisconnect').click();await p.locator('#mgResult').waitFor({state:'visible'});
  assert.equal(await p.locator('#mgTier').innerText(),'Failed');
  assert.equal(await p.locator('#mgNear').innerText(),M.grade(pz,{picks:[],disconnected:true}).nearMiss);
  assert.match(await p.locator('#mgNear').innerText(),/recovered the whole .* blueprint/);assert.equal(await p.locator('#mgProduces').innerText(),'','a failed breach delivers nothing');
  await p.close();
  console.log('PASS signal-decoding browser: 3 viewports (6x6 and 7x7), no overflow, 44px cells, overlap tip, top-row rule, preview, upload, undo, hint, skip, blueprint banner, Perfect by taps with every daemon chained in and an improved blueprint, skip delivers one fragment that carries over, disconnect near-miss and nothing delivered.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
