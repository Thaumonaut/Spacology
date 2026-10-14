// Synergy links: loads fixed seeds headlessly at desktop, iPad landscape and phone widths; checks touch targets and
// overflow; draws a link by dragging (caption shows the real synergy), undoes it; plays to Perfect by tapping the
// model's solution cell by cell; then a hint, a wrong long-way link with the dead-end assist and its near-miss, and Skip.
// Run with `node tests/run.cjs synergy-links`, or serve the repo root on 4173 and run this file. SHOTS=dir saves screenshots.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const M=require('../../prototypes/synergy-links-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
async function noOverflow(p,where){const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
const RUNS=[{viewport:{width:1280,height:900},difficulty:'expert',seed:11},{viewport:{width:1024,height:768},difficulty:'hard',seed:23},{viewport:{width:390,height:844},difficulty:'easy',seed:5}];
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  for(const {viewport,difficulty,seed} of RUNS){
    const tag=viewport.width,p=await browser.newPage({serviceWorkers:'block',viewport}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async n=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/synergy-${n}-${tag}.png`,fullPage:true});};
    const ui=()=>p.evaluate(()=>({state:window.SynergyLinksUI.state,busy:window.SynergyLinksUI.busy}));
    const idle=async()=>{await p.waitForFunction(()=>!window.SynergyLinksUI.busy);};
    // Bring the board fully into view below the sticky header, then map cells to screen points.
    let box=null,size=0;
    const frame=async pz=>{
      size=pz.size;
      await p.evaluate(()=>{const b=document.getElementById('slBoard').getBoundingClientRect(),h=document.querySelector('.mg-head').getBoundingClientRect().height;window.scrollTo(0,b.top+window.scrollY-h-8);});
      box=await p.locator('#slBoard').boundingBox();
      assert.ok(box.y>=0&&box.y+box.height<=viewport.height+1,`board fits the viewport at ${tag} (${Math.round(box.y)}+${Math.round(box.height)})`);
    };
    const at=c=>{const span=size+0.12;return {x:box.x+(c%size+0.56)/span*box.width,y:box.y+(Math.floor(c/size)+0.56)/span*box.height};};
    const tap=async c=>{const q=at(c);await p.mouse.click(q.x,q.y);};
    const tapLink=async path=>{await frame({size});for(const c of path)await tap(c);await idle();};
    const dragLink=async path=>{await frame({size});let q=at(path[0]);await p.mouse.move(q.x,q.y);await p.mouse.down();
      for(const c of path.slice(1)){q=at(c);await p.mouse.move(q.x,q.y,{steps:3});}await p.mouse.up();await idle();};

    const pz=M.generate(seed,difficulty);
    await p.goto(`${BASE}/prototypes/synergy-links.html?seed=${seed}&difficulty=${difficulty}`);
    await p.locator('.sl-end').first().waitFor();await frame(pz);
    assert.equal(await p.locator('.sl-end').count(),pz.pairs.length*2);assert.equal(await p.locator('.sl-cell').count(),pz.size*pz.size);
    assert.match(await p.locator('#mgMeters').innerText(),new RegExp(`LINKS\\s*0/${pz.pairs.length}`,'i'));
    // Touch targets: every cell, the assist buttons, Deploy and the shell buttons are at least 44px.
    const cell=await p.locator('.sl-cell').first().boundingBox();assert.ok(cell.width>=44&&cell.height>=44,`cell ${cell.width}x${cell.height} at ${tag}`);
    for(const sel of ['[data-assist="off"]','[data-assist="dead"]','[data-assist="auto"]','#slDeploy','#mgHint','#mgUndo','#mgAuto','#mgNew']){
      const b=await p.locator(sel).boundingBox();assert.ok(b.height>=44,`${sel} is ${b.height}px tall at ${tag}`);}
    await noOverflow(p,'start '+tag);await shot('start');

    // Drag the longest link from end to end: it connects, its caption names the synergy; undo removes it.
    await dragLink(pz.solution[0]);
    let s=(await ui()).state;assert.ok(M.samePath(s.paths[0],pz.solution[0]),'dragging draws the link');
    assert.equal(await p.locator('#slCaption').innerText(),M.caption(pz,0));assert.equal(await p.locator('#slCaption.show').count(),1);
    assert.equal(await p.locator(`.sl-pipe.done[data-pair="0"]`).count(),1);assert.match(await p.locator('#mgStatus').innerText(),/Linked:/);
    await shot('drag');
    await p.locator('#mgUndo').click();s=(await ui()).state;assert.deepEqual(s.paths[0],[],'undo removes the stroke');
    assert.equal(await p.locator('#mgUndo').isDisabled(),true);
    // A blocked drag says why and changes nothing: from one endpoint straight onto another pair's endpoint.
    {const q=pz.pairs[1],nb=M.neighbours(pz.size),ep=M.endpointMap(pz),blocker=nb[q.a].find(c=>ep[c]>=0&&ep[c]!==q.id);
      if(blocker!==undefined){await dragLink([q.a,blocker]);assert.match(await p.locator('#mgStatus').innerText(),/✕ Links cannot pass through/);assert.deepEqual((await ui()).state.paths[q.id],[]);}}

    // Tap play to Perfect: tap each link's first endpoint, then each next square.
    for(const path of pz.solution)await tapLink(path);
    await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Perfect');assert.equal(await p.locator('#mgNear').isHidden(),true);
    const produces=await p.locator('#mgProduces').innerText();for(const q of pz.pairs)assert.ok(produces.includes(M.caption(pz,q.id)),'output lists '+M.caption(pz,q.id));
    await noOverflow(p,'result '+tag);await shot('perfect');

    // Next puzzle: one hint draws a full correct link; the solve is then capped at Good. Skip ends it as Automatic.
    await p.locator('#mgAgain').click();await p.locator('#mgResult').waitFor({state:'hidden'});
    const pz2=M.generate(seed+1,difficulty);await p.locator('.sl-end').first().waitFor();await frame(pz2);
    await p.locator('#mgHint').click();await idle();
    const h=M.hint(pz2,M.create(pz2));s=(await ui()).state;assert.ok(M.samePath(s.paths[h.pair],pz2.solution[h.pair]),'the hint drew its link');
    assert.match(await p.locator('#mgStatus').innerText(),/^Hint: /);assert.match(await p.locator('#mgMeters').innerText(),/HINTS\s*1/i);
    await p.locator('#mgUndo').click();assert.deepEqual((await ui()).state.paths[h.pair],[],'a hint is undoable');
    for(let i=0;i<pz2.pairs.length+1;i++){if(await p.locator('#mgResult').isVisible()||await p.locator('#mgHint').isDisabled())break;await p.locator('#mgHint').click();await idle();}
    await p.locator('#mgResult').waitFor({state:'visible'});assert.equal(await p.locator('#mgTier').innerText(),'Good','a hinted full board is Good');
    assert.match(await p.locator('#mgHeadline').innerText(),/with \d+ hints?/);

    // Next puzzle: the dead-end assist dims the cells a wrong link seals off; deploying names the culprit.
    await p.locator('#mgAgain').click();await p.locator('#mgResult').waitFor({state:'hidden'});
    const pz3=M.generate(seed+2,difficulty);await p.locator('.sl-end').first().waitFor();await frame(pz3);
    await p.locator('[data-assist="dead"]').click();assert.equal(await p.locator('[data-assist="dead"]').getAttribute('aria-pressed'),'true');
    // A wrong route: the longest raw route for some pair that differs from its solution link.
    let wrong=null;
    for(const q of pz3.pairs){const r=M.routes(pz3,M.create(pz3),q.id,40,20000,'raw').routes.filter(x=>!M.samePath(x,pz3.solution[q.id])).sort((a,b)=>b.length-a.length);if(r.length){wrong={pair:q.id,path:r[0]};break;}}
    assert.ok(wrong,'found a wrong route');
    await dragLink(wrong.path);s=(await ui()).state;assert.ok(M.samePath(s.paths[wrong.pair],wrong.path));
    assert.equal(await p.locator('.sl-cell.dead').count(),M.deadCells(pz3,s).length,'dead cells dimmed match the model');
    await shot('dead');
    await p.locator('#slDeploy').click();await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Partial');
    assert.equal(await p.locator('#mgNear').innerText(),M.nearMiss(pz3,s));assert.match(await p.locator('#mgNear').innerText(),/^Your .* link /);
    assert.match(await p.locator('#mgStats').innerText(),/Show dead ends/);
    await shot('near');

    // Skip: the automatic fallback links only the easy pairs.
    await p.locator('#mgAgain').click();await p.locator('#mgResult').waitFor({state:'hidden'});
    const pz4=M.generate(seed+3,difficulty),a=M.auto(pz4);await p.locator('.sl-end').first().waitFor();
    await p.locator('#mgAuto').click();await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Automatic');
    assert.match(await p.locator('#mgHeadline').innerText(),new RegExp(`linked only the ${a.easy.length} easy pair`));
    assert.equal(await p.locator('#mgNear').innerText(),a.nearMiss);
    await noOverflow(p,'auto '+tag);

    // Relaxed mode on the small board: with auto-finish on, one correct link lets the forced links draw themselves.
    if(difficulty==='easy'){
      await p.locator('#mgAgain').click();await p.locator('#mgResult').waitFor({state:'hidden'});
      const pz5=M.generate(seed+4,difficulty);await p.locator('.sl-end').first().waitFor();await frame(pz5);
      await p.locator('[data-assist="auto"]').click();
      const expect=M.create(pz5);M.apply(pz5,expect,{type:'stroke',pair:0,cells:pz5.solution[0]});const forced=M.autoFinish(pz5,expect);assert.ok(forced.length>=1);
      await dragLink(pz5.solution[0]);
      if(M.evaluate(pz5,expect).solved){
        await p.locator('#mgResult').waitFor({state:'visible'});assert.equal(await p.locator('#mgTier').innerText(),'Good','an assisted solve is Good');
        assert.match(await p.locator('#mgStats').innerText(),/Auto-finish forced links/);assert.match(await p.locator('#mgHeadline').innerText(),/assist: Auto-finish forced links/);
      }else assert.deepEqual((await ui()).state.paths,expect.paths,'the forced links drew themselves');
    }

    assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS synergy links: 44px cells and buttons, drag draws a link with its synergy caption, undo, blocked drag explained, tap play to Perfect with every synergy delivered, hints to Good, dead-end assist matches the model, near-miss names the wrong link, Skip (auto), auto-finish cascade to an assisted Good; no overflow at 1280, 1024 and 390');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
