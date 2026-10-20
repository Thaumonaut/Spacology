// Sensor placement mini-game (Catdoku / Queens rules): solves real maps by tapping, at desktop, iPad landscape and
// phone widths, headlessly. Serve the repository root (npm run serve), then: node tests/browser/sensor-grid.cjs
// (or: node tests/run.cjs sensor-grid). SPACOLOGY_HEADED=1 opens a visible browser for debugging only.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const S=require('../../prototypes/minigames/sensor-grid/sensor-grid-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
async function noOverflow(p,where){await p.waitForTimeout(400);const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  // The largest map on a phone still has ≥44px cells and no overflow.
  {const p=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844},hasTouch:true});
    await p.goto(`${BASE}/prototypes/sensor-grid.html?seed=12&difficulty=expert`);await p.locator('#sgBoard').waitFor();
    const box=await p.locator('#mgStage [data-cell="0"]').boundingBox();assert.ok(box.width>=44,`8×8 cells at 390 are ${box.width}px`);
    for(const id of ['sgProbe','sgCommit','sgClear','sgCheck','sgRedo']){const b=await p.locator('#'+id).boundingBox();assert.ok(b.height>=44&&b.width>=44,id+' is a 44px target');}
    await noOverflow(p,'expert 390');await p.close();}

  for(const [viewport,difficulty,seed] of [[{width:1280,height:900},'expert',12],[{width:1024,height:768},'hard',5],[{width:390,height:844},'easy',7]]){
    const tag=viewport.width,touch=tag!==1280,p=await browser.newPage({serviceWorkers:'block',viewport,hasTouch:touch});const errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await p.addInitScript(()=>{window.inputLog=[];for(const type of ['touchstart','touchend','pointerup','pointercancel','click'])document.addEventListener(type,e=>{inputLog.push([type,e.target.closest('button')?.id,e.target.closest('[data-cell]')?.dataset.cell,e.clientX,e.clientY,scrollY]);if(inputLog.length>16)inputLog.shift();},true);});
    const shot=async name=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/sensor-grid-${name}-${tag}.png`,fullPage:true});};
    const P=S.generate(seed,difficulty),G=S.geo(P),sol=new Set(P.solution),N=P.n*P.n,url=`${BASE}/prototypes/sensor-grid.html?seed=${seed}&difficulty=${difficulty}`;
    const cell=i=>p.locator(`#mgStage [data-cell="${i}"]`),cls=async i=>(await cell(i).getAttribute('class'))||'';
    const count=sel=>p.locator('#mgStage '+sel).count();
    const tier=async()=>{await p.locator('#mgResult:not([hidden])').waitFor();return p.locator('#mgTier').innerText();};
    const cdp=touch?await p.context().newCDPSession(p):null;
    const tap=i=>press(`#mgStage [data-cell="${i}"]`);
    // Keep taps and drags on one touch input channel: switching channels can swallow the next tap's click.
    const press=async sel=>{
      const target=p.locator(sel);if(!touch)return target.click();
      await target.click({trial:true});const b=await target.boundingBox();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    };
    const open=async()=>{await p.goto(url);await p.locator('#sgBoard').waitFor();};
    const mode=async m=>press(m==='x'?'#sgModeX':'#sgModeSensor');
    const undoStroke=async row=>{
      await press('#mgUndo');
      try{await p.waitForFunction(row=>row.every(i=>!document.querySelector(`#mgStage [data-cell="${i}"]`).classList.contains('sg-x')),row);}
      catch(e){console.error('Undo input at '+tag,await p.evaluate(()=>JSON.stringify({events:inputLog,status:document.getElementById('mgStatus').textContent})));throw e;}
      for(const i of row)assert.doesNotMatch(await cls(i),/sg-x/,'undo stroke at '+tag);
    };
    const sensorUntil=async i=>{if(!/sg-sensor/.test(await cls(i)))await tap(i);};
    // Each answer cell: one tap in Sensor mode (the default) places a sensor, from empty, × or auto-×.
    const solveRest=async()=>{for(const i of P.solution)await sensorUntil(i);};
    const center=async i=>{await cell(i).scrollIntoViewIfNeeded();const b=await cell(i).boundingBox();return [b.x+b.width/2,b.y+b.height/2];};
    const meter=async()=>p.locator('#mgMeters').innerText();

    // The page draws exactly the model's map for this seed, with row/column edges and auto-× on by default.
    await open();
    assert.equal(await count('[data-cell]'),N);
    for(let i=0;i<N;i++)if(i%7===0)assert.equal(await cell(i).getAttribute('data-zone'),String(P.region[i]));
    assert.equal(await count('.sg-zone'),P.n);assert.equal(await count('[data-row]'),P.n);assert.equal(await count('[data-col]'),P.n);
    assert.match(await cell(0).getAttribute('aria-label'),/^A1, [A-Z]/);
    assert.equal(await p.locator('#sgAssist').isChecked(),true,'auto-× is on by default');
    // Fiction: the map scouts the elective fight; the side panel says what the scout does to it.
    assert.match(await p.locator('.mg-output').innerText(),/Scouts the elective fight and lowers its difficulty/);
    {const rules=await p.locator('.mg-rules').innerText();assert.match(rules,/battlefield of the upcoming elective fight/);assert.match(rules,/full scout also strips one of its affixes/i);}
    assert.match(await p.locator('#mgStatus').innerText(),/^Elective fight battlefield: /);
    {const box=await cell(0).boundingBox();assert.ok(box.width>=44&&box.height>=44,`cells must be at least 44px at ${tag}, got ${box.width}`);}
    await noOverflow(p,'start '+tag);await shot('start');

    // The Sensor | ✕ switch: a tap places the selected mark and a second tap clears it; in ✕ mode a tap on a sensor
    // clears it. The choice is remembered. A sensor auto-×s exactly the cells it rules out (drawn as .sg-ax, not
    // .sg-x); removing it clears them. Undo and Redo step through moves; keys place and clear.
    const wrong=[...Array(N).keys()].find(i=>!sol.has(i));
    assert.equal(await p.locator('#sgModeSensor').getAttribute('aria-checked'),'true','Sensor is the default tap');
    await mode('x');assert.equal(await p.locator('#sgModeX').getAttribute('aria-checked'),'true');
    await tap(wrong);assert.match(await cls(wrong),/sg-x/);
    await tap(wrong);assert.doesNotMatch(await cls(wrong),/sg-x|sg-sensor/,'a second ✕ tap clears it');
    await tap(wrong);assert.match(await cls(wrong),/sg-x/);
    assert.equal(await p.evaluate(()=>localStorage.getItem('spacologySensorTapModeV1')),'x','the switch is remembered');
    await mode('sensor');
    await tap(wrong);assert.match(await cls(wrong),/sg-sensor/);assert.doesNotMatch(await cls(wrong),/sg-x/);
    assert.equal(await count('.sg-ax'),G.attacks[wrong].length,'auto-× marks row, column, zone and neighbours');
    assert.equal(await count('.sg-x'),0,'auto-× is drawn apart from manual ×');
    await press('#mgUndo');assert.match(await cls(wrong),/sg-x/);assert.equal(await count('.sg-ax'),0,'auto-× goes with the sensor');
    await press('#sgRedo');assert.match(await cls(wrong),/sg-sensor/);assert.equal(await count('.sg-ax'),G.attacks[wrong].length);
    for(let k=0;k<4;k++)await press('#mgUndo');assert.doesNotMatch(await cls(wrong),/sg-sensor|sg-x/);
    assert.equal(await p.locator('#mgUndo').isDisabled(),true);assert.equal(await p.locator('#sgRedo').isDisabled(),false);
    await cell(wrong).focus();await p.keyboard.press('s');assert.match(await cls(wrong),/sg-sensor/);
    await p.keyboard.press('Delete');assert.doesNotMatch(await cls(wrong),/sg-sensor/);assert.equal(await count('.sg-ax'),0);
    assert.equal(await p.locator('#sgRedo').isDisabled(),true,'a new move clears redo');

    // Highlight: hovering (mouse) or tapping (touch) a cell lights its row, column and zone softly.
    {const i=P.n+1,want=new Set([...G.rows[G.row[i]],...G.cols[G.col[i]],...G.zones[G.reg[i]]]);
      if(touch){await tap(i);await tap(i);}else await cell(i).hover();
      assert.equal(await count('.sg-cell.sg-hl'),want.size);assert.equal(await count('[data-row].sg-hl'),1);assert.equal(await count('[data-col].sg-hl'),1);
      if(!touch)await p.mouse.move(1,1);}

    // Drag across three empty cells of the bottom row: all three get ×, and one Undo clears the whole stroke.
    {const row=[N-3,N-2,N-1],[x0,y0]=await center(row[0]);await p.mouse.move(x0,y0);await p.mouse.down();
      for(const i of row.slice(1)){const [x,y]=await center(i);await p.mouse.move(x,y,{steps:4});}
      await p.mouse.up();
      for(const i of row)assert.match(await cls(i),/sg-x/,'dragged cell '+S.label(P,i)+' is × at '+tag+': '+(await p.locator('#mgStatus').innerText()));
      await undoStroke(row);}
    // On the touch viewport, a real finger drag (CDP touch events) paints too, and does not also cycle the first cell.
    if(touch){
      const row=[N-5,N-4,N-3],pts=[];for(const i of row){const [x,y]=await center(i);pts.push({x,y});}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pts[0]]});
      for(const pt of pts.slice(1))for(let k=1;k<=4;k++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pts[0].x+(pt.x-pts[0].x)*k/4,y:pt.y}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      for(const i of row){assert.match(await cls(i),/sg-x/,'touch-dragged cell '+S.label(P,i)+' is ×');assert.doesNotMatch(await cls(i),/sg-sensor/);}
      await undoStroke(row);
    }

    // Two touching sensors clash (the second sits on an auto-×, one tap): both glow red, meter and status name it.
    {const a=P.solution[0],b=G.attacks[a].find(c=>Math.abs(G.row[c]-G.row[a])===1&&Math.abs(G.col[c]-G.col[a])===1);
      await sensorUntil(a);assert.match(await cls(b),/sg-ax/);await tap(b);
      assert.match(await cls(a),/sg-bad/);assert.match(await cls(b),/sg-bad/);
      assert.match(await meter(),/Clashes\s*1/i);assert.match(await p.locator('#mgStatus').innerText(),/touch/);
      await shot('clash');}

    // Probes: never touch the committed board; shading, red edges and the reason match the model; clear removes them.
    await open();
    {const placed=P.solution[1];await sensorUntil(placed);
      const before=JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#mgStage [data-cell]')].map(c=>c.className.split(/\s+/).filter(k=>k&&!/^sg-(hl|probe|pshade|pdead|pclash|forced)$/.test(k)).join(' '))));
      const marks=S.withAuto(P,(()=>{const m=S.empty(P);m[placed]=S.SENSOR;return m;})(),true);
      const trial=[...Array(N).keys()].filter(i=>marks[i]===S.EMPTY&&!sol.has(i)).slice(0,2);
      await press('#sgProbe');assert.equal(await p.locator('#sgProbe').getAttribute('aria-pressed'),'true');
      for(const i of trial)await tap(i);
      const r=S.probe(P,marks,trial);
      assert.equal(await count('.sg-probe'),2);assert.equal(await count('.sg-sensor'),1,'probes are not sensors');
      assert.match(await meter(),new RegExp(`Sensors\\s*1/${P.n}`,"i"));
      assert.equal(await count('.sg-pshade'),r.shaded.length,'shaded = cells the probes would rule out');
      const noteText=await p.locator('#sgNote').innerText();
      for(const x of [...r.clashes,...r.dead].slice(0,3))assert.ok(noteText.includes(x.reason),'note gives the reason: '+x.reason);
      if(r.ok)assert.match(noteText,/No contradiction yet/);
      assert.equal(await count('.sg-head.sg-pdead')+await count('.sg-zone.sg-pdead'),r.dead.length,'each emptied line or zone is flagged red');
      await shot('probe');
      await press('#sgClear');assert.equal(await count('.sg-probe'),0);assert.equal(await count('.sg-pshade'),0);
      const after=JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#mgStage [data-cell]')].map(c=>c.className.split(/\s+/).filter(k=>k&&!/^sg-(hl|probe|pshade|pdead|pclash|forced)$/.test(k)).join(' '))));
      assert.equal(after,before,'probing and clearing left the committed board exactly as it was');
      assert.equal(await p.locator('#mgUndo').isDisabled(),false);
      // Right-click toggles a probe in any mode (mouse viewports).
      await press('#sgProbe');assert.equal(await p.locator('#sgProbe').getAttribute('aria-pressed'),'false');
      if(!touch){await cell(trial[0]).click({button:'right'});assert.match(await cls(trial[0]),/sg-probe/);await cell(trial[0]).click({button:'right'});assert.doesNotMatch(await cls(trial[0]),/sg-probe/);}}

    // Solve to Perfect using probes (free), auto-× on: probe two answer cells, commit them, finish by tapping. The
    // cascade reveals every zone; every row, column and zone shows ✓.
    await open();
    {const two=P.solution.slice(-2);await press('#sgProbe');for(const i of two)await tap(i);
      assert.match(await p.locator('#sgNote').innerText(),/No contradiction yet/);
      await press('#sgCommit');for(const i of two)assert.match(await cls(i),/sg-sensor/);assert.equal(await count('.sg-probe'),0);
      const m=S.commitProbes(P,S.empty(P),two,true).marks;assert.equal(await count('.sg-ax'),m.filter(v=>v===S.AUTO).length,'committed probes auto-× like sensors');
      await solveRest();assert.equal(await tier(),'Perfect');
      assert.equal(await p.locator('#mgProduces').innerText(),`Delivered: ${S.scout(P,P.zones.map((z,k)=>k),'perfect').output}`);assert.equal(await p.locator('#mgNear').isHidden(),true);
      assert.match(await p.locator('#mgHeadline').innerText(),/the elective fight is scouted/);assert.match(await p.locator('#mgStats').innerText(),/Affix stripped\s*yes/i);
      const stats=await p.locator('#mgStats').innerText();assert.match(stats,/Hints\s*0/i);assert.match(stats,/Probes\s*2/i);assert.match(stats,/Auto-×\s*on/i);
      await noOverflow(p,'result '+tag);await shot('perfect');
      await p.locator('#mgReview').click();assert.equal(await count('.sg-zone.sg-known'),P.n);assert.equal(await count('.sg-zone.sg-done'),P.n);
      assert.equal(await count('.sg-head.sg-ok'),2*P.n,'every row and column shows ✓');}

    // Auto-× can be turned off (and back on) without touching manual marks; stats record it.
    if(tag===1024){
      await open();const s=P.solution[2];await sensorUntil(s);assert.equal(await count('.sg-ax'),G.attacks[s].length);
      await p.locator('#sgAssist').uncheck();assert.equal(await count('.sg-ax'),0);
      await p.locator('#sgAssist').check();assert.equal(await count('.sg-ax'),G.attacks[s].length);
      await p.locator('#sgAssist').uncheck();await solveRest();assert.equal(await tier(),'Perfect','auto-× never costs Perfect');
      assert.match(await p.locator('#mgStats').innerText(),/Auto-×\s*on part-time/i);
      await p.locator('#mgReview').click();await p.locator('#sgAssist').check();
    }

    // Hint: applies one model step (one sensor or ≤3 ×s), lights its area, quotes the reason; solving after is Good.
    await open();
    {const h=S.hint(P,S.empty(P));await press('#mgHint');
      const status=await p.locator('#mgStatus').innerText();assert.match(status,/^Hint 1: /);assert.ok(status.includes(h.reason));
      assert.ok(h.cells.length<=(h.mark===S.SENSOR?1:S.HINT_CAP));
      for(const c of h.cells){assert.match(await cls(c),h.mark===S.SENSOR?/sg-sensor/:/sg-x/);assert.match(await cls(c),/sg-hinted/);}
      assert.equal(await count('.sg-x'),h.mark===S.X?h.cells.length:0,'only the hint’s own cells are marked');
      assert.equal(await count('.sg-harea'),h.focus.length,'the hint lights up the zone/lines it reasons about');
      await shot('hint');await solveRest();assert.equal(await tier(),'Good');
      assert.ok((await p.locator('#mgNear').innerText()).includes('Spotting this yourself would have made it Perfect: '+h.reason));}

    // Check: marks only the sensors that are not in the answer, and costs Perfect.
    await open();
    {const bad=[...Array(N).keys()].find(i=>!sol.has(i)&&!G.hit[i*N+P.solution[0]]);
      await sensorUntil(P.solution[0]);await sensorUntil(bad);
      assert.match(await p.locator('#sgCheck').innerText(),/costs Perfect/);
      await press('#sgCheck');assert.equal(await count('.sg-wrong'),1);assert.match(await cls(bad),/sg-wrong/);assert.doesNotMatch(await cls(P.solution[0]),/sg-wrong/);
      assert.match(await p.locator('#mgStatus').innerText(),new RegExp(`${S.label(P,bad)} is not part of the answer.*Good`));await shot('check');
      await tap(bad);assert.equal(await count('.sg-wrong'),0);
      await solveRest();assert.equal(await tier(),'Good');assert.match(await p.locator('#mgNear').innerText(),/without the mistake check/);
      assert.match(await p.locator('#mgStats').innerText(),/Checks\s*1/i);}

    // A clash, even when taken back, costs Perfect; the near-miss names it and the step available before it.
    await open();
    {const a=P.solution[1],b=G.attacks[a].find(c=>G.row[c]===G.row[a]&&Math.abs(G.col[c]-G.col[a])>=2);
      await sensorUntil(a);await tap(b);assert.match(await cls(b),/sg-bad/);await tap(b);await solveRest();assert.equal(await tier(),'Good');
      assert.match(await p.locator('#mgNear').innerText(),new RegExp(`^The one slip: ${S.label(P,Math.min(a,b))} and ${S.label(P,Math.max(a,b))} share row`));}

    // Skip: the automatic sweep covers half the zones and reveals only those.
    await open();await tap(wrong);
    await p.locator('#mgAuto').click();assert.equal(await tier(),'Automatic');
    const half=Math.floor(P.n/2);assert.match(await p.locator('#mgStats').innerText(),new RegExp(`Zones\\s*${half}/${P.n}`,'i'));
    assert.match(await p.locator('#mgNear').innerText(),/^Solving would have scouted .* one of its affixes stripped\./);await shot('auto');
    {const A=S.autoFallback(P,S.empty(P));assert.match(await p.locator('#mgProduces').innerText(),new RegExp(`^Delivered: Elective fight scouted: ${half} of ${P.n} zones · partial lineup .* difficulty −${S.scout(P,A.zones,'auto').reduction}\\.$`));}
    await p.locator('#mgReview').click();assert.equal(await count('.sg-auto'),half);
    assert.equal(await count('.sg-zone.sg-known'),half);await noOverflow(p,'auto '+tag);

    assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS sensor-grid browser: model-matched maps, ≥44px cells and tools (8×8 at 390 too), auto-× on by default (marks/unmarks with the sensor, drawn apart), undo/redo, keys, row/column/zone highlight, mouse and touch drag-to-×, clash glow, probes (board unchanged, shading/red flags/reasons match the model, clear, right-click), probe → commit → Perfect with zone reveal and ✓ on every line, auto-× off/on still Perfect, one-step hint with lit area → Good, Check marks only the wrong sensor → Good, clash → Good, skip = half the zones with a partial scout report; elective-fight scout output and rules text; no errors or overflow at 1280, 1024 and 390');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
