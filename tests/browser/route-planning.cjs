// Route planning (roads): loads fixed seeds headlessly at 1280, 1024 and 390 wide. Checks the "Makes" and "Needs"
// labels and the legend, building cards, a drag-laid road with its cost preview, undo, the night hint and Apply, a
// one-way drag (arrows), a warehouse, roads locked by day, 4× and Skip to dusk, the heat overlay, the dusk report with
// Locate, NEW TONIGHT stations the next night, Skip (auto); and at 1280 replays the planner's every night through the
// UI (drags and taps) to reach Perfect at par. No errors, no horizontal overflow, and the map fits 1024×768.
// Run with `node tests/run.cjs route-planning`, or serve the repo root on 4173 and run this file. SHOTS=dir saves screenshots.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const P=require('../../prototypes/minigames/route-planning/route-planning-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
async function noOverflow(p,where){const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
const RUNS=[{viewport:{width:1280,height:900},difficulty:'normal',seed:39,full:true},{viewport:{width:1024,height:768},difficulty:'easy',seed:3},{viewport:{width:390,height:844},difficulty:'easy',seed:5}];
const TOOL={road:'road',dirt:'dirt',highway:'highway'};
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  for(const {viewport,difficulty,seed,full} of RUNS){
    const tag=viewport.width,p=await browser.newPage({serviceWorkers:'block',viewport}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async n=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/route-${n}-${tag}.png`});};
    const pz=P.generate(seed,difficulty),model=P.create(pz);
    await p.goto(`${BASE}/prototypes/route-planning.html?seed=${seed}&difficulty=${difficulty}`);
    await p.locator('[data-station]').first().waitFor();
    const center=i=>p.evaluate(([i,W])=>{const svg=document.getElementById('rpMap'),m=svg.getScreenCTM(),pt=new DOMPoint((i%W)*100+50,Math.floor(i/W)*100+50).matrixTransform(m);return {x:pt.x,y:pt.y};},[i,pz.W]);
    const tool=id=>p.locator(`[data-tool="${id}"]`).click();
    async function dragTiles(tiles){
      await p.locator('#rpMap').scrollIntoViewIfNeeded();
      const c=await center(tiles[0]);await p.mouse.move(c.x,c.y);await p.mouse.down();
      for(const t of tiles.slice(1)){const q=await center(t);await p.mouse.move(q.x,q.y,{steps:2});}
      await p.mouse.up();
    }
    async function tapTile(t){await p.locator('#rpMap').scrollIntoViewIfNeeded();const c=await center(t);await p.mouse.click(c.x,c.y);}
    // Replays one model edit through the UI, and on the model alongside.
    async function play(a){
      if(a.type==='road'){await tool(TOOL[a.tier||'road']);await dragTiles(a.tiles);}
      else if(a.type==='oneway'){await tool('oneway');await dragTiles(a.tiles);}
      else if(a.type==='erase'){await tool('erase');await dragTiles(a.tiles);}
      else{await tool(a.type);await tapTile(a.tile);}
      const r=P.edit(pz,model,a);assert.equal(r.why,undefined,'model accepts '+JSON.stringify(a));
      await p.waitForFunction(want=>Number(document.getElementById('mgMeters').innerText.match(/CREDITS\s*(\d+)/i)[1])===want,model.credits);
    }
    const credits=async()=>Number((await p.locator('#mgMeters').innerText()).match(/CREDITS\s*(\d+)/i)[1]);
    const active=pz.stations.filter(s=>s.day===1);

    // Readability: every station is labelled "Makes ▲" or "Needs ▲ ■", the legend explains them, par is shown.
    assert.equal(await p.locator('[data-station]').count(),active.length);
    const labels=await p.locator('.rp-label text').allTextContents();
    for(const s of active)assert.ok(labels.includes(s.kind==='producer'?`Makes ${P.TYPES[s.type].sym}`:`Needs ${s.needs.map(t=>P.TYPES[t].sym).join(' ')}`),`label for ${s.name}`);
    const legend=await p.locator('.rp-legend').innerText();assert.match(legend,/Producer/);assert.match(legend,/Consumer/);assert.match(legend,/Warehouse/);assert.match(legend,/One-way/);
    assert.match(await p.locator('#mgMeters').innerText(),new RegExp(`SCORE / PAR\\s*0 / ${pz.par}`,'i'));
    assert.equal(await credits(),pz.credits0);assert.match(await p.locator('#rpPhase').innerText(),/NIGHT 1/);
    // Touch targets.
    for(const sel of ['#rpStart','#rpDusk','#rpRelaxed','[data-speed]','[data-tool]','#mgHint','#mgUndo','#mgAuto']){const b=await p.locator(sel).first().boundingBox();assert.ok(b.height>=44&&b.width>=40,`${sel} ${b.width}x${b.height} at ${tag}`);}
    await noOverflow(p,'start '+tag);
    // The whole map fits on screen at once (1024×768 included).
    {await p.locator('#rpMap').scrollIntoViewIfNeeded();const b=await p.locator('#rpMap').boundingBox();assert.ok(b.height<=viewport.height&&b.y>=-1&&b.y+b.height<=viewport.height+1,`map fits at ${tag}: ${JSON.stringify(b)}`);}
    // Tapping a building opens its card.
    const prod=active.find(s=>s.kind==='producer');
    await tapTile(prod.tile);assert.match(await p.locator('#rpCard').innerText(),new RegExp(`${prod.name}[\\s\\S]*Makes ${P.TYPES[prod.type].sym}`));
    await p.locator('.rp-card-x').click();assert.equal(await p.locator('#rpCard').isHidden(),true);
    await shot('night1');

    // A drag lays road, with a cost preview while dragging; undo takes it back.
    {const t=pz.plan[0][0].tiles.slice(0,4);const c=await center(t[0]);await p.mouse.move(c.x,c.y);await p.mouse.down();
      for(const x of t.slice(1)){const q=await center(x);await p.mouse.move(q.x,q.y,{steps:2});}
      assert.match(await p.locator('#rpPreview').innerText(),/costs \d+ credits/);assert.ok(await p.locator('.rp-ghost').count()>0,'ghost while dragging');
      await p.mouse.up();
      assert.ok(await p.locator('.rp-road').count()>=3,'road drawn');assert.ok(await credits()<pz.credits0);
      await p.locator('#mgUndo').click();assert.equal(await p.locator('.rp-road').count(),0);assert.equal(await credits(),pz.credits0);}
    // The hint is the planner's first step, shown as a ghost with its reason.
    {const h=P.hint(pz,P.create(pz));await p.locator('#mgHint').click();
      assert.equal(await p.locator('#rpHintText').innerText(),h.text);assert.match(h.text,/needs .* Link it to/);assert.ok(await p.locator('.rp-ghost.hint').count()>0);
      await shot('hint');await p.locator('#rpHintDismiss').click();assert.equal(await p.locator('#rpHintBar').isHidden(),true);}

    if(full){
      // The planner's whole run, night by night, through drags and taps; each dusk is checked against the model.
      for(let night=1;night<=pz.days;night++){
        if(night>1){
          const fresh=pz.stations.filter(s=>s.day===night);
          assert.equal(await p.locator('.rp-newtag').count(),fresh.length,`NEW TONIGHT on night ${night}`);
          assert.match(await p.locator('#rpNews').innerText(),/NEW TONIGHT/);
        }
        for(const a of pz.plan[night-1])await play(a);
        assert.equal(await credits(),model.credits,`credits after night ${night}`);
        if(pz.plan[night-1].some(a=>a.type==='oneway'))assert.ok(await p.locator('.rp-arrow').count()>0,'one-way arrows drawn');
        await p.locator('#rpStart').click();P.startDay(pz,model);
        // Roads are locked by day.
        assert.equal(await p.locator('[data-tool="road"]').isDisabled(),true);
        if(night===1){
          await p.locator('[data-speed="4"]').click();
          await p.waitForFunction(()=>/^[1-9]\d* s/.test(document.getElementById('rpClock').textContent),null,{timeout:8000});
          await p.locator('.rp-veh').first().waitFor({timeout:10000});await shot('day1');
        }
        await p.locator('#rpDusk').click();P.skipToDusk(pz,model);
        assert.equal(model.days.length,night);
        assert.match(await p.locator('#mgMeters').innerText(),new RegExp(`SCORE / PAR\\s*${model.score} / ${pz.par}`,'i'));
        if(night===1){
          // Dusk report: the recap and up to three problems, each with Locate; the heat overlay shows the jams.
          assert.equal(await p.locator('#rpReport').isVisible(),true);
          assert.match(await p.locator('#rpReport h3').innerText(),/Dusk report · day 1/);
          assert.equal(await p.locator('.rp-problems li').count(),model.report.problems.length);
          assert.ok(model.report.problems.length>=2);
          assert.equal(await p.locator('.rp-problems li span').first().innerText(),model.report.problems[0].text);
          assert.ok(await p.locator('.rp-heat').count()>0,'heat overlay on congested tiles');
          await p.locator('[data-locate="0"]').click();assert.ok(await p.locator('.rp-locate').count()>0,'located');
          assert.match(await p.locator('#mgStatus').innerText(),/^Located: /);
          await noOverflow(p,'report '+tag);await shot('dusk1');
        }
        if(night<pz.days)assert.match(await p.locator('#rpPhase').innerText(),new RegExp(`NIGHT ${night+1}`));
      }
      await p.locator('#mgResult').waitFor({state:'visible'});
      assert.equal(await p.locator('#mgTier').innerText(),'Perfect');assert.equal(await p.locator('#mgNear').isHidden(),true);
      assert.match(await p.locator('#mgHeadline').innerText(),new RegExp(`Score ${pz.par} against par ${pz.par}`));
      await noOverflow(p,'result '+tag);await shot('result');
    }else{
      // Relaxed toggles before the first day.
      await p.locator('#rpRelaxed').click();assert.equal(await p.locator('#rpRelaxed').getAttribute('aria-pressed'),'true');
      await p.locator('#rpRelaxed').click();assert.equal(await p.locator('#rpRelaxed').getAttribute('aria-pressed'),'false');
      // Apply the hint (a link), then a one-way stretch along it, then a warehouse beside it.
      const h=P.hint(pz,model);await p.locator('#mgHint').click();await p.locator('#rpHintApply').click();
      for(const a of h.acts)P.edit(pz,model,a);
      assert.equal(await credits(),model.credits);
      const road=h.act.tiles.filter(t=>!P.isBuilding(pz,model,t)),run=road.slice(1,4);
      await play({type:'oneway',tiles:run});assert.ok(await p.locator('.rp-arrow').count()>=2,'one-way arrows');
      // The same drag again turns it back to two-way.
      await play({type:'oneway',tiles:run});assert.equal(await p.locator('.rp-arrow').count(),0);
      await play({type:'oneway',tiles:run});
      let spot=-1;for(const t of road){for(let d=0;d<4&&spot<0;d++){const n=P.neighbour(pz,t,d);if(n>=0&&!model.net.tier[n]&&!P.isBuilding(pz,model,n)&&pz.bAt[n]<0&&(pz.terrain[n]===0||pz.terrain[n]===2))spot=n;}if(spot>=0)break;}
      assert.ok(spot>=0);await play({type:'warehouse',tile:spot});
      assert.equal(await p.locator('.rp-wh').count(),1,'warehouse drawn');assert.equal(await credits(),model.credits);
      await tapTile(spot);assert.match(await p.locator('#rpCard').innerText(),/Warehouse[\s\S]*Holds 0\//);await p.locator('.rp-card-x').click();
      await shot('built');
      // Day 1, skipped to dusk: the report appears and matches the model; night 2 brings a NEW TONIGHT station.
      await p.locator('#rpStart').click();P.runDay(pz,model);
      await p.locator('#rpDusk').click();
      assert.equal(await p.locator('#rpReport').isVisible(),true);
      assert.equal(await p.locator('.rp-problems li').count(),model.report.problems.length);
      assert.match(await p.locator('#rpPhase').innerText(),/NIGHT 2/);
      const fresh=pz.stations.filter(s=>s.day===2);assert.equal(await p.locator('.rp-newtag').count(),fresh.length);
      assert.equal(await p.locator('[data-station]').count(),pz.stations.filter(s=>s.day<=2).length);
      assert.match(await p.locator('#mgMeters').innerText(),new RegExp(`SCORE / PAR\\s*${model.score} / ${pz.par}`,'i'));
      await noOverflow(p,'night2 '+tag);await shot('night2');
      // Skip (auto) builds the rest and ends at a reduced result.
      const skip=P.clone(model),ar=P.auto(pz,skip);
      await p.locator('#mgAuto').click();await p.locator('#mgResult').waitFor({state:'visible'});
      assert.equal(await p.locator('#mgTier').innerText(),'Automatic');
      assert.match(await p.locator('#mgHeadline').innerText(),new RegExp(`Score ${ar.score} against par ${pz.par}`));
      await noOverflow(p,'result '+tag);
    }
    assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS route planning: Makes/Needs labels and legend, building cards, drag-laid road with cost preview, undo, night hint ghost and Apply, one-way drag on and off, warehouse, roads locked by day, 4× and Skip to dusk, heat overlay, dusk report with Locate, NEW TONIGHT stations, Skip (auto), the planner\'s nights replayed through the UI to Perfect; map fits and no overflow at 1280, 1024 and 390');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
