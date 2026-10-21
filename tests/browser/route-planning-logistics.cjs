'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),P=require('../../prototypes/minigames/route-planning/route-planning-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
  try{for(const width of [1280,390]){
    const p=await browser.newPage({viewport:{width,height:width===390?844:900},hasTouch:width===390,isMobile:width===390,serviceWorkers:'block'}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const puzzle=P.generate(1,'easy');let model=P.create(puzzle);
    async function reset(){await p.goto(`${BASE}/prototypes/route-planning.html?seed=1&difficulty=easy`);await p.locator('[data-station]').first().waitFor();model=P.create(puzzle);}
    async function point(i){return p.evaluate(([i,W])=>new DOMPoint((i%W)*100+50,Math.floor(i/W)*100+50).matrixTransform(document.getElementById('rpMap').getScreenCTM()).toJSON(),[i,puzzle.W]);}
    async function tap(i){const q=await point(i);if(width===390)await p.touchscreen.tap(q.x,q.y);else await p.mouse.click(q.x,q.y);}
    async function inspect(i){if(await p.locator('#rpPan').getAttribute('aria-pressed')!=='true')await p.locator('#rpPan').click();await tap(i);await p.locator('#rpCard').waitFor();}
    async function tool(id){if(await p.locator(`[data-tool="${id}"]`).isHidden())await p.locator('#rpMore').click();await p.locator(`[data-tool="${id}"]`).click();}
    async function sync(a){const r=P.edit(puzzle,model,a);assert.equal(r.why,undefined,JSON.stringify(a));await p.waitForFunction(credits=>window.RoutePlanningUI.sim.credits===credits,model.credits);assert.deepEqual(await p.evaluate(()=>window.RoutePlanningUI.sim.net),JSON.parse(JSON.stringify(model.net)),'UI applies exact model topology');}
    async function draw(tier,tiles){await tool(tier);const q=await point(tiles[0]);await p.mouse.move(q.x,q.y);await p.mouse.down();for(const t of tiles.slice(1)){const c=await point(t);await p.mouse.move(c.x,c.y,{steps:2});}await p.mouse.up();await sync({type:'road',tier,tiles});}
    const row=(t,n)=>Array.from({length:n*2+1},(_,k)=>t+k-n),col=(t,n)=>Array.from({length:n*2+1},(_,k)=>t+(k-n)*puzzle.W);
    await reset();
    assert.equal(await p.locator('.rp-coord').nth(puzzle.W-1).textContent(),'AB','dense grids use readable column names beyond Z');
    const consumer=puzzle.stations.find(s=>s.kind==='consumer'),factory=puzzle.stations.find(s=>s.recipe);
    await inspect(consumer.footprint[0]);assert.match(await p.locator('#rpCard').innerText(),/Routine order[\s\S]*Dispatch peak[\s\S]*due/);
    await p.locator('[data-chain]').click();assert.ok(await p.locator('.rp-chain-path').count()>=5,'entire upstream chain is highlighted');await p.locator('.rp-card-x').click();
    await inspect(factory.footprint[0]);assert.match(await p.locator('#rpCard').innerText(),/Inputs:[\s\S]*stored[\s\S]*in transit/);await p.locator('.rp-card-x').click();
    let center=-1,side=2;
    for(let y=2;y<puzzle.H-4&&center<0;y++)for(let x=4;x<puzzle.W-4;x++){
      const t=y*puzzle.W+x,copy=P.clone(model);if(P.edit(puzzle,copy,{type:'road',tier:'highway',tiles:row(t,4)}).why)continue;
      if(!P.costOf(puzzle,copy,{type:'interchange',tile:t,side}).why&&!P.costOf(puzzle,copy,{type:'overpass',tile:t}).why){center=t;break;}
    }
    assert.ok(center>=0,'seed has room for template and bridge');await draw('highway',row(center,4));await inspect(center);
    await p.locator('#rpRampSide').selectOption(String(side));await p.locator('[data-interchange]').click();assert.ok(await p.locator('.rp-ghost-tile').count()>0,'preview shows full ramp footprint');
    await p.keyboard.press('Escape');assert.equal(await p.locator('.rp-ghost-tile').count(),0,'cancel clears preview without spending');assert.equal(await p.evaluate(()=>window.RoutePlanningUI.sim.credits),model.credits);
    await inspect(center);await p.locator('#rpRampSide').selectOption(String(side));await p.locator('[data-interchange]').click();await p.locator('[data-ramp-confirm]').click();await sync({type:'interchange',tile:center,side});assert.equal(await p.locator('.rp-tier-ramp').count(),4);
    await p.locator('[data-overpass]').click();await sync({type:'overpass',tile:center});assert.ok(await p.locator('.rp-over-top').count()>0);
    assert.equal(P.freeRoutes(puzzle,model,center-2*puzzle.W).dist[center+4],Infinity,'UI-built crossing cannot turn');
    await p.locator('.rp-card-x').click();
    await reset();center=-1;
    for(let y=3;y<puzzle.H-3&&center<0;y++)for(let x=3;x<puzzle.W-3;x++){
      const t=y*puzzle.W+x,copy=P.clone(model);if(P.edit(puzzle,copy,{type:'road',tier:'road',tiles:row(t,3)}).why||P.edit(puzzle,copy,{type:'road',tier:'road',tiles:col(t,3)}).why)continue;
      if(!P.costOf(puzzle,copy,{type:'control',tile:t,control:'roundabout'}).why&&puzzle.bAt[t-2]<0){center=t;break;}
    }
    assert.ok(center>=0);await draw('road',row(center,3));await draw('road',col(center,3));await inspect(center);
    for(const control of ['signal','roundabout','stop']){await p.locator('#rpControl').selectOption(control);await sync({type:'control',tile:center,control});if(control==='roundabout')assert.equal(model.net.reserved.filter(t=>t===center).length,4);}
    await p.locator('.rp-card-x').click();const parallel=row(center-puzzle.W,3);await draw('local',parallel);
    const street=center-2;assert.equal(model.net.e[street]&1,0,'parallel street remains disconnected');await inspect(street);await p.locator('[data-connection="0"]').click();await sync({type:'connection',tile:street,dir:0});assert.equal(model.net.e[street-1]&1,0,'only selected link is added');await p.locator('[data-connection="0"]').click();await sync({type:'connection',tile:street,dir:0});await p.locator('.rp-card-x').click();
    const warehouse=model.net.tier.flatMap((tier,i)=>tier?P.DIRS.map((_,d)=>P.neighbour(puzzle,i,d)):[]).find(tile=>tile>=0&&!P.costOf(puzzle,model,{type:'warehouse',tile}).why);assert.notEqual(warehouse,undefined);
    await tool('warehouse');await tap(warehouse);await sync({type:'warehouse',tile:warehouse});await inspect(warehouse);
    await p.locator('#rpStockTarget').selectOption(`${consumer.id}:4`);await p.locator('#rpStockQty').fill('3');await p.locator('#rpStockForm [type="submit"]').click();await sync({type:'prepare',tile:warehouse,target:consumer.id,item:4,qty:3});assert.match(await p.locator('#rpCard').innerText(),/Reserved for/);
    await p.locator('[data-unprepare]').click();await sync({type:'unprepare',tile:warehouse});assert.equal(await p.locator('[data-unprepare]').count(),0);
    await p.locator('.rp-card-x').click();await p.locator('#mgUndo').click();assert.ok(P.undo(puzzle,model));assert.deepEqual(await p.evaluate(()=>window.RoutePlanningUI.sim.wh[0].plan),model.wh[0].plan,'reservation edits support undo');
    for(let k=0;k<10;k++)await p.locator('#rpZoomIn').click();assert.equal(await p.locator('#rpZoomIn').isDisabled(),true);assert.equal(await p.locator('#rpFit').innerText(),'600%');await p.locator('#rpFit').click();
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1),'no page scroll with contextual controls');
    if(process.env.SHOTS)await p.screenshot({path:`${process.env.SHOTS}/route-logistics-${width}.png`});assert.deepEqual(errors,[]);await p.close();
  }}finally{await browser.close();}
  console.log('PASS contextual logistics at desktop and touch phone sizes: plot/peak/recipe cards and chains, complete ramp preview/cancel/build, grade separation, signals/roundabout/stops, explicit parallel links, warehouse reservation/release/undo, 600% precision zoom; no page scroll or browser errors');
})().catch(e=>{console.error(e);process.exitCode=1;});
