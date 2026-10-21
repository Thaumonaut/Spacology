// Route planning (roads): loads fixed seeds headlessly at 1280, 1024 and 390 wide. Checks the Takes/Returns recipes,
// labels and the field guide, building cards, a drag-laid road with its cost preview, undo, the night hint and Apply, a
// one-way drag (arrows), a warehouse, phase-specific controls, 4× and Skip to dusk, the heat overlay, the dusk report
// with Locate, NEW TONIGHT stations the next night, Skip (auto); and at 1280 replays every night through the UI.
// No errors, no page scroll; the full play surface and map stay put at desktop, tablet and phone sizes.
// Run with `node tests/run.cjs route-planning`, or serve the repo root on 4173 and run this file. SHOTS=dir saves screenshots.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const P=require('../../prototypes/minigames/route-planning/route-planning-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
async function noOverflow(p,where){const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
const RUNS=[{viewport:{width:1280,height:900},difficulty:'normal',seed:39,full:true},{viewport:{width:1024,height:768},difficulty:'easy',seed:3},{viewport:{width:390,height:844},difficulty:'easy',seed:5}];
const TOOL={road:'road',local:'local',dirt:'dirt',highway:'highway'};
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  for(const {viewport,difficulty,seed,full} of RUNS){
    const tag=viewport.width,p=await browser.newPage({serviceWorkers:'block',viewport,isMobile:viewport.width===390,hasTouch:viewport.width===390}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async n=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/route-${n}-${tag}.png`});};
    const pz=P.generate(seed,difficulty),model=P.create(pz);
    await p.goto(`${BASE}/prototypes/route-planning.html?seed=${seed}&difficulty=${difficulty}`);
    await p.locator('[data-station]').first().waitFor();
    const center=i=>p.evaluate(([i,W])=>{const svg=document.getElementById('rpMap'),m=svg.getScreenCTM(),pt=new DOMPoint((i%W)*100+50,Math.floor(i/W)*100+50).matrixTransform(m);return {x:pt.x,y:pt.y};},[i,pz.W]);
    const tool=async id=>{
      if(await p.locator(`[data-tool="${id}"]`).isHidden())await p.locator('#rpMore').click();
      await p.locator(`[data-tool="${id}"]`).click();
    };
    const mapRect=()=>p.locator('#rpMap').boundingBox();
    async function stable(before,where){const after=await mapRect();for(const key of ['x','y','width','height'])assert.ok(Math.abs(after[key]-before[key])<1,`${where}: map ${key} shifted ${before[key]} → ${after[key]}`);}
    async function screen(where){
      const result=await p.evaluate(()=>{
        const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
        return {scrollY:document.documentElement.scrollHeight-innerHeight,scrollX:document.documentElement.scrollWidth-innerWidth,header:rect('rpRoot'),map:rect('rpMap'),footer:document.querySelector('.rp-command').getBoundingClientRect().toJSON()};
      });
      assert.ok(result.scrollY<=1&&result.scrollX<=1,`page scroll at ${where}: ${JSON.stringify(result)}`);
      assert.ok(result.map.y>=0&&result.map.bottom<=viewport.height+1,`map visible at ${where}: ${JSON.stringify(result.map)}`);
      assert.ok(result.footer.bottom<=viewport.height+1&&result.footer.y>=result.map.bottom-1,`playback/build controls on screen at ${where}: ${JSON.stringify(result.footer)}`);
    }
    async function dragTiles(tiles){
      await p.locator('#rpMap').scrollIntoViewIfNeeded();
      const c=await center(tiles[0]);await p.mouse.move(c.x,c.y);await p.mouse.down();
      for(const t of tiles.slice(1)){const q=await center(t);await p.mouse.move(q.x,q.y,{steps:2});}
      await p.mouse.up();
    }
    async function tapTile(t){await p.locator('#rpMap').scrollIntoViewIfNeeded();const c=await center(t);if(tag===390)await p.touchscreen.tap(c.x,c.y);else await p.mouse.click(c.x,c.y);}
    // Replays one model edit through the UI, and on the model alongside.
    async function play(a){
      if(a.type==='road')a={...a,preserve:a.preserve??a.tiles.length>1};
      if(a.type==='road'){await tool(TOOL[a.tier||'road']);if(a.preserve===false&&a.tiles.length>1){await p.locator('#rpMore').click();await p.locator('#rpResurface').click();}await dragTiles(a.tiles);}
      else if(a.type==='oneway'){await tool('oneway');await dragTiles(a.tiles);}
      else if(a.type==='erase'){await tool('erase');await dragTiles(a.tiles);}
      else{await tool(a.type);await tapTile(a.tile);}
      const r=P.edit(pz,model,a);assert.equal(r.why,undefined,'model accepts '+JSON.stringify(a));
      await p.waitForFunction(want=>Number(document.getElementById('mgMeters').innerText.match(/CREDITS\s*(\d+)/i)[1])===want,model.credits,{timeout:8000}).catch(async()=>{
        throw new Error(`credits did not update for ${JSON.stringify(a)}: model ${model.credits}, UI ${await credits()}, status ${await p.locator('#mgStatus').innerText()}`);
      });
      assert.equal(await credits(),model.credits,'credits after '+JSON.stringify(a)+'; '+await p.locator('#mgStatus').innerText());
    }
    const credits=async()=>Number((await p.locator('#mgMeters').innerText()).match(/CREDITS\s*(\d+)/i)[1]);
    const active=pz.stations.filter(s=>s.day===1);

    // Named recipes stay on every plot; secondary rules remain in the field guide.
    assert.equal(await p.locator('[data-station]').count(),active.length);
    assert.equal(await p.locator('[data-planned]').count(),pz.stations.length-active.length,'every future site is visible from night one');
    assert.match(await p.locator('[data-tool="dirt"]').innerText(),/Dirt track/);
    assert.match(await p.locator('[data-tool="local"]').innerText(),/Local/);
    assert.match(await p.locator('[data-tool="road"]').innerText(),/Collector/);
    assert.match(await p.locator('[data-tool="highway"]').innerText(),/Freeway/);
    assert.match(await p.locator('[data-tool="erase"]').innerText(),/full refund/);
    for(const s of active){const label=await p.locator(`[data-station="${s.id}"] .rp-plot-recipe`).textContent();assert.match(label,/TAKES[\s\S]*RETURNS/);assert.ok(label.includes(P.TYPES[s.kind==='producer'?s.type:s.needs[0]].name),`named goods for ${s.name}`);}
    assert.equal(await p.locator('#rpDrawer').isHidden(),true);
    const firstMap=await mapRect();
    await p.locator('#rpHelp').click();
    const legend=await p.locator('.rp-legend').innerText();assert.match(legend,/Producer/);assert.match(legend,/Dispatch/);assert.match(legend,/Warehouse/);assert.match(legend,/One-way/);
    assert.equal(await p.locator('#rpHelp').getAttribute('aria-expanded'),'true');await stable(firstMap,'field guide');
    await p.keyboard.press('Escape');assert.equal(await p.locator('#rpDrawer').isHidden(),true);
    await p.locator('#rpSettings').click();
    for(const id of ['mgDifficulty','mgSeed','mgNew','mgAuto','mgExport','rpRelaxed'])assert.equal(await p.locator('#'+id).isVisible(),true,id+' in settings');
    await stable(firstMap,'settings');await p.locator('#rpDrawerClose').click();
    assert.match(await p.locator('#mgMeters').innerText(),new RegExp(`SCORE / PAR\\s*0 / ${pz.par}`,'i'));
    assert.equal(await credits(),pz.credits0);assert.match(await p.locator('#rpPhase').innerText(),/NIGHT 1/);
    // Night construction and day playback never compete for room; every currently visible target is touchable.
    assert.equal(await p.locator('#rpNightBar').isVisible(),true);
    assert.equal(await p.locator('#rpDayBar').isHidden(),true);
    assert.equal(await p.locator('#rpExtras').isHidden(),true);
    for(const sel of ['#rpStart','#rpHelp','#rpSettings','#rpMore','[data-tool="road"]','#mgHint','#mgUndo','#rpZoomIn','#rpZoomOut','#rpFit','#rpPan']){
      const b=await p.locator(sel).first().boundingBox();assert.ok(b.height>=44&&b.width>=40,`${sel} ${b.width}x${b.height} at ${tag}`);
    }
    assert.deepEqual(await p.locator('[data-tool]').evaluateAll(buttons=>buttons.filter(b=>b.getBoundingClientRect().width&&b.scrollWidth>b.clientWidth+1).map(b=>b.dataset.tool)),[],`tool labels fit at ${tag}`);
    await screen('start '+tag);
    // Tapping a building opens its card.
    const prod=active.find(s=>s.kind==='producer');
    await tapTile(prod.tile);assert.match(await p.locator('#rpCard').innerText(),new RegExp(`${prod.name}[\\s\\S]*Takes[\\s\\S]*Returns[\\s\\S]*1 ${P.TYPES[prod.type].name}`,'i'));await stable(firstMap,'building card');
    await p.locator('.rp-card-x').click();assert.equal(await p.locator('#rpCard').isHidden(),true);
    await shot('night1');
    const planned=pz.stations.find(s=>s.day===2);
    await tapTile(planned.tile);assert.match(await p.locator('#rpCard').innerText(),/Planned · night 2[\s\S]*stay intact/i);
    await p.locator('.rp-card-x').click();

    // A phone can zoom to finger-sized tiles, pan without buying roads, then recover the whole network with Fit.
    await tapTile(prod.tile);await p.locator('.rp-card-focus').click();
    assert.notEqual(await p.locator('#rpFit').innerText(),'Fit');
    const zoomed=await p.locator('#rpMap').getAttribute('viewBox');
    if(tag===390)assert.ok(await p.locator('#rpMap').evaluate(s=>s.getScreenCTM().a*100)>=44,'zoomed phone tile is a touch target');
    const beforePan=await credits();await p.locator('#rpPan').click();
    const box=await mapRect(),px=box.x+box.width/2,py=box.y+box.height/2;
    await p.mouse.move(px,py);await p.mouse.down();await p.mouse.move(px+45,py+35,{steps:4});await p.mouse.up();
    assert.notEqual(await p.locator('#rpMap').getAttribute('viewBox'),zoomed,'pan moves the camera');
    assert.equal(await credits(),beforePan,'pan does not build');
    await shot('zoomed');await p.locator('#rpFit').click();
    assert.equal(await p.locator('#rpFit').innerText(),'Fit');assert.equal(await p.locator('#rpPan').getAttribute('aria-pressed'),'false');
    await stable(firstMap,'zoom and fit');await screen('zoom and fit '+tag);

    // The board is playable without a pointer: arrows select, Space draws, Escape cancels, Undo restores.
    const kt=pz.terrain.findIndex((t,i)=>t===0&&i%pz.W<pz.W-1&&pz.terrain[i+1]===0&&pz.bAt[i]<0&&pz.bAt[i+1]<0);
    assert.ok(kt>=0);await tool('road');await p.locator('#rpMap').focus();await p.keyboard.press('Home');
    for(let i=0;i<kt%pz.W;i++)await p.keyboard.press('ArrowRight');
    for(let i=0;i<Math.floor(kt/pz.W);i++)await p.keyboard.press('ArrowDown');
    await p.keyboard.press('Space');await p.keyboard.press('ArrowRight');
    assert.ok(await p.locator('.rp-ghost').count()>0,'keyboard road preview');
    await p.keyboard.press('Escape');assert.equal(await p.locator('.rp-ghost').count(),0);assert.equal(await credits(),beforePan);
    await p.keyboard.press('ArrowLeft');await p.keyboard.press('Space');await p.keyboard.press('ArrowRight');await p.keyboard.press('Space');
    const kr=P.edit(pz,model,{type:'road',tier:'road',tiles:[kt,kt+1]});assert.equal(kr.why,undefined);
    assert.equal(await credits(),model.credits);assert.match(await p.locator('#rpPhase').innerText(),/NIGHT 1/);
    await p.locator('#mgUndo').click();assert.ok(P.undo(pz,model));assert.equal(await credits(),pz.credits0);
    if(tag===390){
      const cdp=await p.context().newCDPSession(p),a=await center(kt),b=await center(kt+1);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await cdp.detach();const r=P.edit(pz,model,{type:'road',tier:'road',tiles:[kt,kt+1]});assert.equal(r.why,undefined);
      assert.equal(await credits(),model.credits,'native touch drag uses the same road accounting');
      await p.locator('#mgUndo').click();assert.ok(P.undo(pz,model));assert.equal(await credits(),pz.credits0);
    }

    // A drag lays road, with a cost preview while dragging; undo takes it back.
    {await tool('local');const t=pz.plan[0][0].tiles.slice(0,4);const c=await center(t[0]);await p.mouse.move(c.x,c.y);await p.mouse.down();
      for(const x of t.slice(1)){const q=await center(x);await p.mouse.move(q.x,q.y,{steps:2});}
      assert.match(await p.locator('#rpPreview').innerText(),/costs \d+ credits/);assert.ok(await p.locator('.rp-ghost').count()>0,'ghost while dragging');
      await p.mouse.up();
      const expected=P.clone(model);assert.equal(P.edit(pz,expected,{type:'road',tier:'local',tiles:t}).why,undefined);
      assert.equal(await p.locator('.rp-road').count(),expected.net.tier.filter(Boolean).length,'road tiles match preview/model');assert.equal(await credits(),expected.credits);
      await p.locator('#rpPan').click();await tapTile(t.find(i=>!P.isBuilding(pz,model,i)));
      assert.match(await p.locator('#rpCard').innerText(),/Road [A-Z]\d+[\s\S]*Local[\s\S]*fully refundable/i);
      await p.locator('.rp-card-x').click();await tool('road');
      await p.locator('#mgUndo').click();assert.equal(await p.locator('.rp-road').count(),0);assert.equal(await credits(),pz.credits0);}
    // The hint is the planner's first step, shown as a ghost with its reason.
    {const h=P.hint(pz,P.create(pz));await p.locator('#mgHint').click();
      assert.equal(await p.locator('#rpHintText').innerText(),h.text);assert.match(h.text,/needs .* Link it to/);assert.ok(await p.locator('.rp-ghost.hint').count()>0);
      await stable(firstMap,'hint');await screen('hint '+tag);
      await shot('hint');await p.locator('#rpHintDismiss').click();assert.equal(await p.locator('#rpHintBar').isHidden(),true);}

    // Re-tiering an existing stretch pays / refunds the difference, including terrain; Undo restores the empty map.
    {
      const start=pz.terrain.findIndex((_,i)=>i%pz.W<pz.W-4&&[i,i+1,i+2,i+3].every(t=>pz.terrain[t]===0&&pz.bAt[t]<0));
      assert.ok(start>=0);const tiles=[start,start+1,start+2,start+3];
      for(const tier of ['road','highway','dirt'])await play({type:'road',tier,tiles,preserve:false});
      assert.equal(await p.locator('#rpResurface').getAttribute('aria-pressed'),'true','replacement requires explicit resurface mode');
      await play({type:'erase',tiles});assert.equal(await credits(),pz.credits0,'complete rebuild round trip costs nothing');
      assert.equal(await p.locator('#rpResurface').getAttribute('aria-pressed'),'false','selecting a tool restores safe drawing');
      for(let i=0;i<4;i++){await p.locator('#mgUndo').click();assert.ok(P.undo(pz,model));}
      assert.equal(await credits(),pz.credits0);
    }

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
        assert.equal(await p.locator('#rpNightBar').isHidden(),true);
        assert.equal(await p.locator('#rpDayBar').isVisible(),true);
        await screen('day '+tag);
        if(night===1){
          await p.locator('#rpPause').click();const pausedTick=await p.evaluate(()=>RoutePlanningUI.sim.tick);
          await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>RoutePlanningUI.sim.tick),pausedTick,'pause freezes traffic');
          assert.equal(await p.locator('#rpPause').innerText(),'Resume');await p.locator('#rpPause').click();
          await p.locator('[data-speed="4"]').click();
          await p.waitForFunction(()=>/^[1-9]\d* s/.test(document.getElementById('rpClock').textContent),null,{timeout:8000});
          await p.locator('.rp-veh').first().waitFor({timeout:10000});await shot('day1');
        }
        await p.locator('#rpDusk').click();P.skipToDusk(pz,model);
        assert.equal(model.days.length,night);
        assert.match(await p.locator('#mgMeters').innerText(),new RegExp(`SCORE / PAR\\s*${model.score} / ${pz.par}`,'i'));
        if(night===1){
          // Dusk report: the recap and up to three problems, each with Locate; the heat overlay shows the jams.
          assert.equal(await p.locator('#rpReport').isHidden(),true,'dusk leaves the map clear until the report is requested');
          await p.locator('#rpReportOpen').click();
          assert.equal(await p.locator('#rpReport').isVisible(),true);
          assert.match(await p.locator('#rpReport h3').innerText(),/Dusk report · day 1/);
          assert.equal(await p.locator('.rp-problems li').count(),model.report.problems.length);
          assert.ok(model.report.problems.length<=3);
          if(model.report.problems.length){
            assert.equal(await p.locator('.rp-problems li span').first().innerText(),model.report.problems[0].text);
            await p.locator('[data-locate="0"]').click();assert.ok(await p.locator('.rp-locate').count()>0,'located');
            assert.match(await p.locator('#mgStatus').innerText(),/^Located: /);
          }else assert.match(await p.locator('.rp-allgood').innerText(),/traffic flowed freely/);
          if(model.report.ds.jam.some(n=>n/pz.dayTicks>=0.04))assert.ok(await p.locator('.rp-heat').count()>0,'heat overlay on congested tiles');
          await stable(firstMap,'dusk report');await screen('report '+tag);await shot('dusk1');
          await p.locator('#rpReportClose').click();assert.equal(await p.locator('#rpReport').isHidden(),true);
          await p.locator('#rpReportOpen').click();assert.equal(await p.locator('#rpReport').isVisible(),true);
          await p.locator('#rpReportClose').click();
        }
        if(night<pz.days)assert.match(await p.locator('#rpPhase').innerText(),new RegExp(`NIGHT ${night+1}`));
      }
      await p.locator('#mgResult').waitFor({state:'visible'});
      assert.equal(await p.locator('#mgTier').innerText(),'Perfect');assert.equal(await p.locator('#mgNear').isHidden(),true);
      assert.match(await p.locator('#mgHeadline').innerText(),new RegExp(`Score ${pz.par} against par ${pz.par}`));
      await noOverflow(p,'result '+tag);await shot('result');
    }else{
      // Relaxed toggles before the first day.
      await p.locator('#rpSettings').click();
      await p.locator('#rpRelaxed').click();assert.equal(await p.locator('#rpRelaxed').getAttribute('aria-pressed'),'true');
      await p.locator('#rpRelaxed').click();assert.equal(await p.locator('#rpRelaxed').getAttribute('aria-pressed'),'false');
      await p.locator('#rpDrawerClose').click();
      // Apply the hint (a link), then a one-way stretch along it, then a warehouse beside it.
      const h=P.hint(pz,model);await p.locator('#mgHint').click();await p.locator('#rpHintApply').click();
      for(const a of h.acts)P.edit(pz,model,a);
      assert.equal(await credits(),model.credits);
      const road=h.act.tiles.filter(t=>!P.isBuilding(pz,model,t)),run=road.slice(0,3);
      await play({type:'oneway',tiles:run});assert.equal(await p.locator('.rp-arrow').count(),run.length-1,'one-way arrows');
      // The same drag again turns it back to two-way.
      await play({type:'oneway',tiles:run});assert.equal(await p.locator('.rp-arrow').count(),0);
      await play({type:'oneway',tiles:run});
      for(const a of pz.plan[0])if(!P.costOf(pz,model,a).why)await play(a);
      let spot=-1;for(const t of model.net.tier.flatMap((tier,i)=>tier?[i]:[])){for(let d=0;d<4&&spot<0;d++){const n=P.neighbour(pz,t,d);if(n>=0&&!P.costOf(pz,model,{type:'warehouse',tile:n}).why)spot=n;}if(spot>=0)break;}
      assert.ok(spot>=0);await play({type:'warehouse',tile:spot});
      assert.equal(await p.locator('.rp-wh').count(),1,'warehouse drawn');assert.equal(await credits(),model.credits);
      await tapTile(spot);assert.match(await p.locator('#rpCard').innerText(),/Warehouse[\s\S]*Holds 0\//);await p.locator('.rp-card-x').click();
      // Build across tomorrow's parcel; its roads and joins must survive the opening, and remain refundable afterward.
      const approaches=P.DIRS.map((_,d)=>P.neighbour(pz,planned.tile,d)).filter(t=>t>=0&&pz.terrain[t]!==3&&pz.bAt[t]<0&&model.net.reserved[t]<0);
      assert.ok(approaches.length>=2);
      const through=[approaches[0],planned.tile,approaches[1]];
      if(P.costOf(pz,model,{type:'road',tier:'local',tiles:through}).why==='That road is already there.')await play({type:'erase',tiles:[planned.tile]});
      await play({type:'road',tier:'local',tiles:through});
      const savedJoins=model.net.e[planned.tile];
      await shot('built');
      // Day 1, skipped to dusk: the report appears and matches the model; night 2 brings a NEW TONIGHT station.
      await p.locator('#rpStart').click();P.runDay(pz,model);
      assert.equal(await p.locator('#rpNightBar').isHidden(),true);await stable(firstMap,'day controls');await screen('day '+tag);
      for(const selector of ['#rpPause','[data-speed="4"]','#rpDusk']){const b=await p.locator(selector).boundingBox();assert.ok(b.height>=44&&b.width>=40,'playback touch target '+selector);}
      await shot('day1');
      await p.locator('#rpDusk').click();
      assert.equal(await p.locator('#rpReport').isHidden(),true);
      await p.locator('#rpReportOpen').click();
      assert.equal(await p.locator('#rpReport').isVisible(),true);
      assert.equal(await p.locator('.rp-problems li').count(),model.report.problems.length);
      await stable(firstMap,'dusk report');await screen('dusk '+tag);
      await p.locator('#rpReportClose').click();
      assert.match(await p.locator('#rpPhase').innerText(),/NIGHT 2/);
      const fresh=pz.stations.filter(s=>s.day===2);assert.equal(await p.locator('.rp-newtag').count(),fresh.length);
      assert.equal(await p.locator('[data-station]').count(),pz.stations.filter(s=>s.day<=2).length);
      assert.equal(await p.locator(`[data-through="${planned.id}"]`).count(),1,'new building keeps its through road');
      assert.equal(await p.locator('[data-planned]').count(),pz.stations.filter(s=>s.day>2).length);
      const opened=await p.evaluate(t=>({tier:RoutePlanningUI.sim.net.tier[t],joins:RoutePlanningUI.sim.net.e[t]}),planned.tile);
      assert.deepEqual(opened,{tier:4,joins:savedJoins});
      await tapTile(planned.tile);assert.match(await p.locator('#rpCard').innerText(),/Compatible through street preserved/);await p.locator('.rp-card-x').click();
      await play({type:'erase',tiles:[planned.tile]});assert.equal(await credits(),model.credits,'old road refunds in full');
      assert.match(await p.locator('#mgMeters').innerText(),new RegExp(`SCORE / PAR\\s*${model.score} / ${pz.par}`,'i'));
      await noOverflow(p,'night2 '+tag);await shot('night2');
      // Skip (auto) builds the rest and ends at a reduced result.
      const skip=P.clone(model),ar=P.auto(pz,skip);
      await p.locator('#rpSettings').click();await p.locator('#mgAuto').click();await p.locator('#mgResult').waitFor({state:'visible'});
      assert.equal(await p.locator('#mgTier').innerText(),'Automatic');
      assert.match(await p.locator('#mgHeadline').innerText(),new RegExp(`Score ${ar.score} against par ${pz.par}`));
      await noOverflow(p,'result '+tag);
    }
    assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS route planning: viewport-bound HUD/map/phase controls, drawers, on-demand reports, zoom/pan and road inspection, keyboard editing, pointer cost/credit parity, undo, hints, one-way, warehouses, pause/4×/dusk, growth/through roads, auto and Perfect planner replay; no page scroll at desktop, tablet and phone sizes');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
