// Route planning UI: a road-network builder in the style of Mini Motorways. At night, drag across tiles to lay, erase
// or re-tier road, set one-way stretches, and place roundabouts and warehouses; by day, watch the traffic (1×, 2×, 4×
// or skip to dusk), see where it jams, and read the dusk report. Rules, the simulation, the planner (par), hints and
// scoring live in route-planning-model.js; this file draws and forwards edits, and only ever advances the simulation
// in whole ticks, so every speed gives the same result.
(function(){
  'use strict';
  const K=window.MiniGameKit,P=window.RoutePlanning,esc=K.esc;
  const U=100,SVGNS='http://www.w3.org/2000/svg';
  const TOOLS=[
    {id:'local',label:'Local',cost:`${P.ROADS[4].cost}/tile · access`,tip:'Paved building access. Drags preserve existing road types; tap a road tile to deliberately change its type. Adjacent roads stay separate.'},
    {id:'road',label:'Collector',cost:`${P.ROADS[2].cost}/tile · 2/lane`,tip:'Faster district distributors. Large factories and warehouses can connect; small buildings need local streets.'},
    {id:'highway',label:'Freeway',cost:`${P.ROADS[3].cost}/tile · 3/lane`,tip:'Open ground and river bridges (×4 cost); no building access or at-grade intersections. Use an Interchange for built-in on/off ramps.'},
    {id:'erase',label:'Erase',cost:'full refund',tip:'Drag to remove road or a warehouse. Recover its full current construction value, on any night.'},
    {id:'dirt',label:'Dirt track',cost:`${P.ROADS[1].cost}/tile`,tip:'Slow, low-capacity remote roads. Can cross mountains; connect to a paved street before a building entrance.'},
    {id:'interchange',label:'Interchange',cost:'on + off ramps',tip:'Tap clear ground or a freeway. Preview and rotate a compact 5×3 stamp with freeway, collector and both ramp directions, then Build.'},
    {id:'ramp',label:'Ramp',cost:'3/tile · one-way',tip:'Custom ramp: drag street → freeway to enter, or freeway → street to exit. One clear approach tile is enough; rough ground and river bridges are allowed. Use Interchange for both ramps together.'},
    {id:'overpass',label:'Overpass',cost:`${P.OVERPASS_COST} + approaches`,tip:'Tap a straight road with two approach tiles on each side. Builds a collector underneath; crossing traffic cannot turn. Tap again to remove the structure.'},
    {id:'oneway',label:'One-way',cost:`${P.ONEWAY_COST}/join`,tip:'Drag along a road to make it one-way in that direction: it carries twice as much. The same drag again makes it two-way.'},
    {id:'roundabout',label:'Roundabout',cost:String(P.ROUND_COST),tip:'A slow yielding junction with a 3×3 footprint. Circulating traffic has priority. Inspect junctions to choose Stop or Signals instead.'},
    {id:'warehouse',label:'Warehouse',cost:String(P.WH_COST),tip:`Place beside a local or collector, leaving room east and south. Inspect it to reserve up to ${P.WH_CAP} goods for a named factory or dispatch peak.`},
    {id:'whcap',label:'+Storage',cost:String(P.WH_UP_COST),tip:`Tap a warehouse to add ${P.WH_UP} spaces.`}
  ];
  const toolCost=t=>{const [price,capacity]=t.cost.split(' · ');return esc(price)+(capacity?`<span class="rp-tool-cap"> · ${esc(capacity)}</span>`:'');};
  let pz=null,sim=null,tool='local',drag=null,hint=null,running=false,paused=false,speed=1,relaxed=false,launched=false,acc=0,last=0,raf=0,
    ended=false,locate=null,locateTimer=0,card=null,interchangeDraft=null,resurface=false,count={edits:0,undos:0,hints:0,rejected:0,locates:0};
  const shell=K.shell({id:'route-planning',defaultDifficulty:'normal',
    difficulties:P.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),
    rules:['<b>Night</b>: the clock stops. Each plot names what it <b>Takes</b> and <b>Returns</b>. Connect matching outputs to inputs by dragging roads between marked entrances. Vehicles carry goods automatically. Roads join along the way you drag, so parallel roads stay separate.',
      'Supply chain: <b>2 ore → plate</b>, <b>2 crystal → cell</b>, then <b>plate + cell → gear kit</b>. Factories need delivered inputs and processing time. Only <b>on-time final dispatch deliveries</b> score; late goods still clear their order and earn construction credit.',
      'Press <b>Start day</b> to watch the traffic. You cannot build by day; use 1×, 2×, 4× or <b>Skip to dusk</b>.',
      '<b>Locals</b> serve every entrance; <b>collectors</b> only large buildings. <b>Freeways</b> use open ground or river bridges, directional ramps and uninterrupted distance to accelerate. Corners and queues erase speed. <b>Dirt tracks</b> can cross mountains.',
      'River crossings are <b>bridges</b> (×4 cost); rough ground costs ×2. Drags preserve existing road types and connect only drawn edges. Tap an existing tile with a road tool to resurface it for the price difference, or choose <b>More → Resurface</b> for a whole stretch. Selecting another tool returns to safe drawing. Inspect roads to toggle connections or change type. <b>Interchange</b> previews a complete 5×3 freeway, collector and on/off ramp pair before building.',
      '<b>Stops</b> halt vehicles and share one crossing slot. <b>Signals</b> release alternating north/south and east/west batches, with clearance intervals. <b>Roundabouts</b> slow and yield to circulating traffic; they require room. <b>Overpasses</b> carry independent straight flows, without turns.',
      '<b>Schedules</b>: raw output peaks in the first 10 seconds. Inspect a dispatch site for its exact order quantities and times. Inspect a <b>warehouse</b> to intentionally stock a selected good for that destination. Reserved goods cannot be taken by other customers. Inventory persists overnight.',
      `Rebuild freely: <b>full refunds</b> on every night; re-tiering pays or returns only the difference. Each dusk pays <b>${P.STIPEND} construction credits</b> plus <b>${P.GROWTH_CREDIT} per new building</b>, even if deliveries failed.`,
      'Dashed <b>planned plots</b> show future footprints and opening nights. Solid building footprints stay clear; marked entrance tiles can carry a compatible through street. New buildings never erase roads. Use <b>Zoom here</b> for finger-sized construction, Fit for overview.',
      `Score: 1 per on-time dispatch delivery, <b>+${P.CLEAN_BONUS}</b> for each day nobody missed a deadline. Late orders remain deliverable but do not score. Reach the planner’s <b>par</b> for Perfect.`],
    onNew,onAuto,onUndo,onHint});
  const stage=shell.stage;
  document.body.classList.add('rp-screen');
  stage.innerHTML=`<div class="rp" id="rpRoot">
    <header class="rp-header">
      <div class="rp-identity"><a class="rp-back" href="minigames.html" aria-label="Back to mini-games">← <span>MINI-GAMES</span></a><div><span class="rp-title">ROUTE / LOGISTICS</span><span id="rpPhase" class="rp-phase">NIGHT</span></div></div>
      <div class="rp-hud" id="rpHud"></div>
      <div class="rp-header-actions"><button id="rpHelp" aria-controls="rpDrawer" aria-expanded="false" aria-label="How to play">?</button><button id="rpSettings" aria-controls="rpDrawer" aria-expanded="false" aria-label="Game settings">⚙</button></div>
    </header>
    <div class="rp-field"><div class="rp-mapmeta"><p class="rp-news" id="rpNews"></p><div id="rpFeedback"></div></div>
    <div class="rp-mapwrap" id="rpWrap"><svg id="rpMap" role="application" aria-label="Road map" tabindex="0" aria-describedby="rpMapHelp">
      <g id="rpTerrain"></g><g id="rpSites"></g><g id="rpHeat"></g><g id="rpRoads"></g><g id="rpArrows"></g><g id="rpGhost"></g><g id="rpBuildings"></g><g id="rpVehicles"></g><g id="rpFx"></g><g id="rpLocate"></g><g id="rpFocus"></g></svg>
      <div class="rp-camera" role="group" aria-label="Map view"><button id="rpZoomOut" aria-label="Zoom out">−</button><button id="rpFit" title="Fit the whole map" aria-label="Fit the whole map">Fit</button><button id="rpZoomIn" aria-label="Zoom in">+</button><button id="rpPan" aria-pressed="false" title="Inspect mode: drag to pan, tap for road or building details">Inspect</button><button id="rpReportOpen" aria-controls="rpReport" aria-expanded="false" hidden>Last dusk</button></div>
      <div class="rp-card" id="rpCard" hidden></div>
      <p class="rp-preview" id="rpPreview" aria-live="polite"></p>
      <div class="rp-hintbar" id="rpHintBar" hidden><span id="rpHintText"></span><button id="rpHintApply" class="primary">Apply hint</button><button id="rpHintDismiss">Dismiss</button></div>
      <section class="rp-report" id="rpReport" hidden aria-label="Dusk report" aria-live="polite"></section>
    </div></div>
    <footer class="rp-command">
      <div class="rp-nightbar" id="rpNightBar"><div class="rp-tools" id="rpTools" role="toolbar" aria-label="Night construction tools">
        ${TOOLS.slice(0,4).map(t=>`<button data-tool="${t.id}" aria-pressed="${t.id==='road'}" title="${esc(t.tip)}"><b>${esc(t.label)}</b><small>${toolCost(t)}</small></button>`).join('')}
        <div class="rp-more-wrap"><button id="rpMore" aria-controls="rpExtras" aria-expanded="false"><b>More</b><small id="rpMoreLabel">${TOOLS.length-4} tools</small></button>
          <div id="rpExtras" role="group" aria-label="Specialist tools" hidden>${TOOLS.slice(4).map(t=>`<button data-tool="${t.id}" aria-pressed="false" title="${esc(t.tip)}"><b>${esc(t.label)}</b><small>${toolCost(t)}</small></button>`).join('')}<button id="rpResurface" aria-pressed="false" title="Replace existing road types with the selected road tool; charge/refund only the difference"><b>Resurface</b><small>replace road types</small></button></div></div>
      </div><div class="rp-actions" id="rpNightActions"><button id="rpStart" class="primary rp-start">☀ Start day</button></div></div>
      <div class="rp-daybar" id="rpDayBar" hidden><div class="rp-clock"><span id="rpClock"></span><i><b id="rpClockBar"></b></i></div><button id="rpPause" aria-pressed="false">Pause</button><div class="rp-speed" role="group" aria-label="Playback speed">${[1,2,4].map(s=>`<button data-speed="${s}" aria-pressed="${s===1}">${s}×</button>`).join('')}</div><button id="rpDusk" title="Run the rest of the day at once">⏭ Skip to dusk</button></div>
    </footer>
    <section class="rp-drawer" id="rpDrawer" role="dialog" aria-modal="false" aria-labelledby="rpDrawerTitle" hidden><div class="rp-drawer-head"><h2 id="rpDrawerTitle"></h2><button id="rpDrawerClose" aria-label="Close panel">✕</button></div><div id="rpGuideBody" hidden><p id="rpMapHelp">Zoom for precise building. In Inspect mode, drag to pan or tap a road/building for details. Select a construction tool to draw again. Keyboard: focus the map, arrows select tiles, Space begins/ends a road, Enter taps or inspects, Escape cancels.</p></div><div id="rpSettingsBody" hidden><button id="rpRelaxed" aria-pressed="false" title="Consumers wait longer before they starve. Set before the first day.">Relaxed: off</button></div></section>
  </div>`;
  const $=id=>document.getElementById(id),svg=$('rpMap');
  $('rpHud').append($('mgMeters'));
  $('rpFeedback').append($('mgStatus'));
  $('rpNightActions').prepend($('mgUndo'),$('mgHint'));
  $('rpSettingsBody').append(document.querySelector('.mg-controls'),$('mgExport'));
  $('rpGuideBody').append(document.querySelector('.mg-side'));
  let drawer=null;
  function closeDrawer(){
    drawer=null;$('rpDrawer').hidden=true;
    for(const id of ['rpHelp','rpSettings'])$(id).setAttribute('aria-expanded','false');
  }
  function showDrawer(which){
    if(drawer===which){closeDrawer();return;}
    closeCard();hideHint();closeReport();showMore(false);
    drawer=which;$('rpDrawer').hidden=false;
    $('rpDrawerTitle').textContent=which==='rpHelp'?'Field guide':'Game settings';
    $('rpGuideBody').hidden=which!=='rpHelp';$('rpSettingsBody').hidden=which!=='rpSettings';
    for(const id of ['rpHelp','rpSettings'])$(id).setAttribute('aria-expanded',String(id===which));
    $('rpDrawerClose').focus();
  }
  $('rpHelp').onclick=()=>showDrawer('rpHelp');
  $('rpSettings').onclick=()=>showDrawer('rpSettings');
  $('rpDrawerClose').onclick=()=>{const trigger=$(drawer);closeDrawer();trigger?.focus();};
  function showMore(open){$('rpExtras').hidden=!open;$('rpMore').setAttribute('aria-expanded',String(open));}
  $('rpMore').onclick=()=>showMore($('rpExtras').hidden);
  $('rpResurface').onclick=()=>{
    if(!['local','road','dirt','highway'].includes(tool)){shell.status('Select a road type first, then choose Resurface.','warn');return;}
    resurface=!resurface;$('rpResurface').setAttribute('aria-pressed',String(resurface));$('rpMoreLabel').textContent=resurface?'Resurface':`${TOOLS.length-4} tools`;
    $('rpMore').classList.toggle('selected',resurface);showMore(false);
    shell.status(resurface?`Resurface mode: drag to replace existing roads with ${TOOLS.find(t=>t.id===tool).label}. Only the price difference is charged/refunded. Select any tool to return to safe drawing.`:'Safe drawing: existing road types are preserved.');
  };
  function closeReport(){$('rpReport').hidden=true;$('rpReportOpen').setAttribute('aria-expanded','false');}
  $('rpReportOpen').onclick=()=>{
    const report=$('rpReport');
    if(report.hidden){closeCard();hideHint();closeDrawer();showMore(false);}
    report.hidden=!report.hidden;
    $('rpReportOpen').setAttribute('aria-expanded',String(!report.hidden));
  };
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(drawer){const trigger=$(drawer);closeDrawer();trigger?.focus();}
    else if(!$('rpExtras').hidden){showMore(false);$('rpMore').focus();}
    else if(!$('rpReport').hidden){$('rpReport').hidden=true;$('rpReportOpen').setAttribute('aria-expanded','false');$('rpReportOpen').focus();}
    else if(card!==null)closeCard();
    else if(hint)hideHint();
  });
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const sym=t=>P.TYPES[t].sym,tcol=t=>P.TYPES[t].color;
  const inputs=s=>s.recipe?Object.entries(s.recipe.input).map(([type,qty])=>({type:Number(type),qty})):s.needs.map(type=>({type,qty:null}));
  const itemText=({type,qty})=>(qty===null?'':qty+' ')+P.TYPES[type].name;
  const takes=s=>inputs(s).map(itemText);
  const returns=s=>s.kind==='producer'?`1 ${P.TYPES[s.type].name}`:'Nothing · final dispatch';
  function recipeCard(s){
    return `<dl class="rp-recipe"><div><dt>Takes</dt><dd>${esc(takes(s).join(' + ')||'Nothing · raw extraction')}</dd></div><div><dt>Returns</dt><dd>${esc(returns(s))}</dd></div></dl>`;
  }
  const cx=i=>(i%pz.W)*U+U/2,cy=i=>Math.floor(i/pz.W)*U+U/2;
  const tileXY=i=>({x:i%pz.W,y:Math.floor(i/pz.W)});
  const column=x=>{let label='';for(let n=x+1;n>0;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;return label;};
  const coord=i=>{const {x,y}=tileXY(i);return column(x)+(y+1);};
  let zoom=1,viewX=0,viewY=0,pan=false,panDrag=null,keyboardTile=0;
  function camera(){
    const w=(pz.W*U+40)/zoom,h=(pz.H*U+60)/zoom;
    svg.setAttribute('viewBox',`${viewX-w/2} ${viewY-h/2} ${w} ${h}`);
    $('rpZoomOut').disabled=zoom<=1;$('rpZoomIn').disabled=zoom>=6;
    $('rpFit').textContent=zoom===1?'Fit':`${Math.round(zoom*100)}%`;
    $('rpPan').setAttribute('aria-pressed',String(pan));$('rpMap').classList.toggle('panning',pan);
  }
  function fitMap(){zoom=1;viewX=pz.W*U/2;viewY=pz.H*U/2-10;pan=false;panDrag=null;camera();}
  function zoomMap(delta){zoom=Math.max(1,Math.min(6,zoom+delta));if(zoom===1)fitMap();else camera();}
  $('rpZoomIn').onclick=()=>zoomMap(0.5);$('rpZoomOut').onclick=()=>zoomMap(-0.5);$('rpFit').onclick=fitMap;
  $('rpPan').onclick=()=>{pan=!pan;camera();};

  // ---- lifecycle ------------------------------------------------------------------------------------------------------
  function onNew({seed,difficulty}){
    stop();pz=P.generate(seed,difficulty);relaxed=false;sim=P.create(pz,{relaxed});
    hint=null;launched=false;ended=false;paused=false;acc=0;drag=null;card=null;interchangeDraft=null;resurface=false;locate=null;count={edits:0,undos:0,hints:0,rejected:0,locates:0};
    tool='local';stage.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
    $('rpMoreLabel').textContent=`${TOOLS.length-4} tools`;$('rpMore').classList.remove('selected');
    $('rpResurface').setAttribute('aria-pressed','false');
    $('rpRelaxed').disabled=false;$('rpRelaxed').setAttribute('aria-pressed','false');$('rpRelaxed').textContent='Relaxed: off';
    closeDrawer();showMore(false);
    $('rpReport').hidden=true;$('rpReportOpen').hidden=true;$('rpReportOpen').setAttribute('aria-expanded','false');
    $('rpHintBar').hidden=true;$('rpCard').hidden=true;
    clearTimeout(locateTimer);$('rpLocate').innerHTML='';
    keyboardTile=0;$('rpFocus').innerHTML='';fitMap();
    side();terrain();render();
    shell.status('Connect mines → refineries → workshop → dispatch. Inspect sites for recipes and peaks.');
  }
  function stop(){running=false;cancelAnimationFrame(raf);raf=0;}
  function startDay(){
    if(ended||sim.phase!=='night')return;
    if(!launched){launched=true;shell.begin();$('rpRelaxed').disabled=true;}
    hideHint();closeCard();closeDrawer();showMore(false);drag=null;$('rpGhost').innerHTML='';$('rpReport').hidden=true;
    $('rpReportOpen').setAttribute('aria-expanded','false');
    P.startDay(pz,sim);shell.log('day',{day:sim.day});
    running=true;paused=false;last=performance.now();acc=0;render();raf=requestAnimationFrame(frame);
    shell.status('Red tiles are queues. Tap a building to inspect.');
  }
  function frame(now){
    if(!running)return;
    if(paused){last=now;raf=requestAnimationFrame(frame);return;}
    acc+=Math.min(250,now-last)*speed;last=now;
    const tickMs=P.TICK*1000;let steps=0;const day=sim.day;
    while(acc>=tickMs&&sim.phase==='day'&&steps<64){P.step(pz,sim);acc-=tickMs;steps++;effects();}
    if(sim.phase!=='day'||sim.day!==day){stop();atDusk();return;}
    if(steps)renderTick();
    renderVehicles(Math.min(1,acc/tickMs));
    raf=requestAnimationFrame(frame);
  }
  function skipDusk(){
    if(ended||sim.phase!=='day')return;stop();
    P.skipToDusk(pz,sim);shell.log('dusk-skip');atDusk();
  }
  function atDusk(){
    $('rpFx').innerHTML='';render();report();
    if(sim.phase==='done'){finishRun();return;}
    const fresh=pz.stations.filter(s=>s.day===sim.day);
    shell.status(`Day ${sim.day-1}: +${sim.days[sim.days.length-1].score} score. ${fresh.length} new site${fresh.length===1?'':'s'}. Build for day ${sim.day}.`,'good');
  }
  function finishRun(){
    ended=true;stop();render();
    const res=P.result(pz,sim),t=P.tier(pz,res,relaxed),par=P.parFor(pz,relaxed);
    shell.finish({tier:t,score:res.score,
      headline:`${res.deliveries} deliveries over ${pz.days} days, ${res.cleanDays} clean day${res.cleanDays===1?'':'s'}. Score ${res.score} against par ${par}.`,
      nearMiss:P.nearMiss(pz,sim,relaxed),
      stats:{Score:`${res.score} / ${par}`,Deliveries:res.deliveries,'Clean days':`${res.cleanDays}/${pz.days}`,Edits:count.edits,Hints:count.hints,Relaxed:relaxed?'on':'off'},
      output:`a road network that made ${res.deliveries} deliveries`});
  }
  function onAuto(){
    stop();hideHint();closeCard();closeDrawer();showMore(false);
    const before=sim.days.length,res=P.auto(pz,sim);ended=true;render();report();
    const par=P.parFor(pz,relaxed);
    return {score:res.score,headline:`Auto-build linked every need with plain roads for the remaining ${pz.days-before} day${pz.days-before===1?'':'s'}. Score ${res.score} against par ${par}.`,
      stats:{Score:`${res.score} / ${par}`,Deliveries:res.deliveries,'Clean days':`${res.cleanDays}/${pz.days}`},output:`an auto-built network: ${res.deliveries} deliveries`};
  }
  function onUndo(){
    if(sim.phase!=='night'){shell.status('Undo works at night, on tonight’s edits.','warn');return;}
    if(P.undo(pz,sim)){count.undos++;hideHint();render();shell.status('Undone.');}
  }
  function onHint(){
    if(sim.phase!=='night'){shell.status('Hints are for the night. Watch the day, then ask at dusk.','warn');return;}
    closeCard();closeReport();closeDrawer();showMore(false);
    count.hints++;hint=P.hint(pz,sim);
    $('rpHintText').textContent=hint.text;$('rpHintApply').hidden=!hint.act;$('rpHintBar').hidden=false;
    shell.status('Hint: '+hint.text);drawHint();
  }
  function hideHint(){hint=null;$('rpHintBar').hidden=true;$('rpGhost').innerHTML='';}
  $('rpHintApply').onclick=()=>{if(!hint||!hint.act)return;const acts=hint.acts;hideHint();for(const a of acts)if(!doEdit(a,true))break;render();};
  $('rpHintDismiss').onclick=()=>{hideHint();shell.status('');};

  function doEdit(a,quiet){
    const r=P.edit(pz,sim,a);
    if(r.why){count.rejected++;shell.status('✕ '+r.why,'warn');shell.flash($('rpWrap'),'mg-shake');return false;}
    count.edits++;shell.log('edit',{day:sim.day,edit:a});
    if(!quiet)shell.status(r.cost>0?`Built for ${r.cost} credits.`:r.cost<0?`Refunded ${-r.cost} credits.`:'Done.');
    hideHint();render();return true;
  }

  // ---- input ------------------------------------------------------------------------------------------------------------
  function tileAt(e){
    const m=svg.getScreenCTM();if(!m)return -1;
    const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());
    const x=Math.floor(pt.x/U),y=Math.floor(pt.y/U);
    return x>=0&&y>=0&&x<pz.W&&y<pz.H?y*pz.W+x:-1;
  }
  const isB=i=>P.isBuilding(pz,sim,i);
  const DRAGGERS=new Set(['local','road','dirt','highway','ramp','erase','oneway']);
  svg.addEventListener('pointerdown',e=>{
    if(!pz)return;
    e.preventDefault();svg.setPointerCapture?.(e.pointerId);
    closeDrawer();showMore(false);
    if(pan){const m=svg.getScreenCTM();panDrag={id:e.pointerId,x:e.clientX,y:e.clientY,scale:m.a,moved:0};return;}
    const t=tileAt(e);if(t<0)return;
    drag={tiles:[t],id:e.pointerId};drawDrag();
  });
  svg.addEventListener('pointermove',e=>{
    if(panDrag&&panDrag.id===e.pointerId){
      panDrag.moved+=Math.abs(e.clientX-panDrag.x)+Math.abs(e.clientY-panDrag.y);
      viewX=Math.max(0,Math.min(pz.W*U,viewX-(e.clientX-panDrag.x)/panDrag.scale));
      viewY=Math.max(0,Math.min(pz.H*U,viewY-(e.clientY-panDrag.y)/panDrag.scale));
      panDrag.x=e.clientX;panDrag.y=e.clientY;camera();return;
    }
    if(!drag||drag.id!==e.pointerId)return;const t=tileAt(e);if(t<0)return;
    const p=drag.tiles,lastT=p[p.length-1];if(t===lastT)return;
    if(sim.phase!=='night'||!DRAGGERS.has(tool))return;
    // Walk one tile at a time toward the pointer, so the path stays connected; stepping back undoes a step.
    let cur=lastT,guard=0;
    while(cur!==t&&guard++<40){
      const a=tileXY(cur),b=tileXY(t),dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
      const next=Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)?cur+dx:cur+dy*pz.W;
      if(p.length>1&&p[p.length-2]===next)p.pop();else p.push(next);
      cur=next;
    }
    drawDrag();
  });
  const endDrag=e=>{
    if(panDrag&&panDrag.id===e.pointerId){const tap=panDrag.moved<6;panDrag=null;if(tap){const t=tileAt(e);if(t>=0)openCard(t);}return;}
    if(!drag||drag.id!==e.pointerId)return;const tiles=drag.tiles;drag=null;$('rpGhost').innerHTML='';$('rpPreview').textContent='';
    if(hint)drawHint();
    const t=tiles[0];
    if(tiles.length===1&&((isB(t)||pz.bAt[t]>=0)&&tool!=='erase'&&tool!=='whcap'&&tool!=='roundabout'||sim.phase!=='night')){
      if(isB(t)||pz.bAt[t]>=0||sim.net.tier[t])openCard(t);else{closeCard();if(sim.phase==='day')shell.status('Building waits for the night. Tap a building to inspect it.');}
      return;
    }
    closeCard();
    if(sim.phase!=='night')return;
    if(tool==='interchange'){previewInterchange(t);return;}
    const a=action(tiles);if(a)doEdit(a);
  };
  svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',()=>{panDrag=null;drag=null;$('rpGhost').innerHTML='';$('rpPreview').textContent='';});
  function focusTile(){
    $('rpFocus').innerHTML=`<rect x="${cx(keyboardTile)-U/2+3}" y="${cy(keyboardTile)-U/2+3}" width="${U-6}" height="${U-6}" rx="10"/>`;
    svg.setAttribute('aria-label',`Road map, tile ${coord(keyboardTile)}`);
  }
  svg.addEventListener('focus',focusTile);
  svg.addEventListener('blur',()=>{if(drag?.id==='keyboard'){drag=null;$('rpGhost').innerHTML='';$('rpPreview').textContent='';}});
  svg.addEventListener('keydown',e=>{
    const dir=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].indexOf(e.key);
    if(dir<0&&![' ','Enter','Escape','Home'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();
    if(e.repeat&&[' ','Enter'].includes(e.key))return;
    if(e.key==='Home'){drag=null;$('rpGhost').innerHTML='';$('rpPreview').textContent='';keyboardTile=0;if(zoom>1)fitMap();focusTile();return;}
    if(dir>=0){const t=P.neighbour(pz,keyboardTile,dir);if(t<0)return;keyboardTile=t;focusTile();
      if(zoom>1){viewX=cx(t);viewY=cy(t);camera();}
      if(drag?.id==='keyboard'){const tiles=drag.tiles;if(tiles[tiles.length-2]===t)tiles.pop();else tiles.push(t);drawDrag();}
    }else if(e.key==='Escape'){drag=null;$('rpGhost').innerHTML='';$('rpPreview').textContent='';closeCard();closeReport();}
    else if(pan)openCard(keyboardTile);
    else if(drag?.id==='keyboard')endDrag({pointerId:'keyboard'});
    else if(e.key===' '&&sim.phase==='night'){drag={tiles:[keyboardTile],id:'keyboard'};drawDrag();}
    else{drag={tiles:[keyboardTile],id:'keyboard'};endDrag({pointerId:'keyboard'});}
  });
  function action(tiles){
    if(['local','road','dirt','highway'].includes(tool))return {type:'road',tier:tool,tiles:tiles.slice(),preserve:tiles.length>1&&!resurface};
    if(tool==='ramp')return {type:'ramp',tiles:tiles.slice()};
    if(tool==='erase')return {type:'erase',tiles:tiles.slice()};
    if(tool==='oneway'){if(tiles.length<2){shell.status('Drag along a road (at least two tiles) to make it one-way in that direction.','warn');return null;}return {type:'oneway',tiles:tiles.slice()};}
    const t=tiles[tiles.length-1];
    if(tool==='roundabout')return {type:'roundabout',tile:t};
    if(tool==='overpass')return {type:'overpass',tile:t};
    if(tool==='warehouse')return {type:'warehouse',tile:t};
    if(tool==='whcap')return {type:'whcap',tile:t};
    return null;
  }
  function drawDrag(){
    const g=$('rpGhost');if(!drag){g.innerHTML='';return;}
    const p=drag.tiles;if(sim.phase!=='night'||!DRAGGERS.has(tool)){g.innerHTML='';return;}
    const d=p.map((t,i)=>`${i?'L':'M'}${cx(t)} ${cy(t)}`).join(' ');
    const a=action(p.length>1||tool!=='oneway'?p:[p[0],p[0]]);
    let why=null,cost=0;
    if(a&&!(tool==='oneway'&&p.length<2)){const r=P.costOf(pz,sim,a);why=r.why||null;cost=r.cost||0;}
    g.innerHTML=`<path class="rp-ghost ${tool} ${why?'bad':''}" d="${d}"/>`+p.map(t=>`<rect class="rp-ghost-tile ${why?'bad':''}" x="${cx(t)-U/2+6}" y="${cy(t)-U/2+6}" width="${U-12}" height="${U-12}" rx="14"/>`).join('');
    $('rpPreview').textContent=(resurface?'Resurface · ':'')+(p.length<2&&tool==='oneway'?'Drag along the road.':why?'✕ '+why:cost>0?`${p.length} tile${p.length===1?'':'s'}: costs ${cost} credits (you have ${sim.credits}).`:cost<0?`Refunds ${-cost} credits.`:'Free.');
  }
  stage.querySelector('#rpTools').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(!b)return;tool=b.dataset.tool;
    closeCard();resurface=false;$('rpResurface').setAttribute('aria-pressed','false');
    pan=false;camera();
    stage.querySelectorAll('[data-tool]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    $('rpMoreLabel').textContent=$('rpExtras').contains(b)?TOOLS.find(t=>t.id===tool).label:`${TOOLS.length-4} tools`;
    $('rpMore').classList.toggle('selected',$('rpExtras').contains(b));
    showMore(false);
    shell.status(TOOLS.find(t=>t.id===tool).tip);});
  $('rpStart').onclick=startDay;$('rpDusk').onclick=skipDusk;
  $('rpPause').onclick=()=>{if(sim.phase!=='day')return;paused=!paused;last=performance.now();renderTop();};
  stage.querySelector('.rp-speed').addEventListener('click',e=>{const b=e.target.closest('[data-speed]');if(!b)return;speed=Number(b.dataset.speed);
    stage.querySelectorAll('[data-speed]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
  $('rpRelaxed').onclick=()=>{if(launched||ended)return;relaxed=!relaxed;const edits=sim.tonight.slice();sim=P.create(pz,{relaxed});for(const a of edits)P.edit(pz,sim,a);
    $('rpRelaxed').setAttribute('aria-pressed',String(relaxed));$('rpRelaxed').textContent='Relaxed: '+(relaxed?'on':'off');render();
    shell.status(relaxed?`Relaxed: consumers wait ${P.RELAXED}× as long before they starve. Par is recomputed for it.`:'Standard patience.');};

  // ---- building card ----------------------------------------------------------------------------------------------------
  function openCard(t){interchangeDraft=null;closeReport();hideHint();clearTimeout(locateTimer);$('rpLocate').innerHTML='';if(pz.bAt[t]>=0)t=pz.stations[pz.bAt[t]].tile;else if(sim.net.reserved[t]>=0)t=sim.net.reserved[t];card=t;$('rpCard').scrollTop=0;renderCard();if(pz.logistics){renderBuildings();if(pz.bAt[t]>=0)showChain(pz.bAt[t],false);}}
  function closeCard(){const el=$('rpCard'),focused=el.contains(document.activeElement);interchangeDraft=null;card=null;el.hidden=true;$('rpGhost').innerHTML='';$('rpPreview').textContent='';clearTimeout(locateTimer);$('rpLocate').innerHTML='';if(pz?.logistics)renderBuildings();if(focused)svg.focus({preventScroll:true});}
  function previewInterchange(tile,side){
    closeCard();hideHint();closeReport();
    if(side===undefined){const sides=[2,3,0,1];side=sides.find(d=>!P.costOf(pz,sim,{type:'interchange',tile,side:d}).why)??2;}
    interchangeDraft={type:'interchange',tile,side};card=tile;renderCard();$('rpCard').scrollTop=0;
  }
  function renderInterchange(){
    const a=interchangeDraft,layout=P.interchangeLayout(pz,sim,a),quote=P.costOf(pz,sim,a),bad=quote.why;
    const el=$('rpCard');el.hidden=false;el.classList.add('rp-interchange');
    el.innerHTML=`<button class="rp-card-x" aria-label="Cancel interchange">✕</button><h3 id="rpCardTitle" tabindex="-1">Interchange · ${coord(a.tile)}</h3><span class="rp-card-kind">5×3 · freeway + collector + on/off ramps</span><div class="rp-stamp-controls"><label>Street side<select id="rpRampSide">${P.DIR_NAMES.map((name,d)=>`<option value="${d}" ${d===a.side?'selected':''}>${name}</option>`).join('')}</select></label><div class="rp-stamp-actions"><button data-ramp-confirm class="primary" ${bad?'disabled':''}>Build${bad?'':` · ${quote.cost} credits`}</button><button data-ramp-cancel>Cancel</button></div></div><p>${bad?esc(bad):'Arrows show ramp direction. Fully refundable.'}</p>`;
    el.querySelector('.rp-card-x').onclick=closeCard;
    $('rpRampSide').onchange=()=>{interchangeDraft={...a,side:Number($('rpRampSide').value)};renderInterchange();$('rpRampSide').focus({preventScroll:true});};
    const rect=(i,tier)=>`<rect class="rp-ghost-tile rp-stamp-${tier}${bad?' bad':''}" x="${cx(i)-43}" y="${cy(i)-43}" width="86" height="86" rx="10"/>`;
    $('rpGhost').innerHTML=layout.why?'':layout.freeway.map(i=>rect(i,'freeway')).join('')+layout.street.map(i=>rect(i,'street')).join('')+[layout.on,layout.off].map(path=>`${path.slice(1,-1).map(i=>rect(i,'ramp')).join('')}<path class="rp-stamp-arrow${bad?' bad':''}" d="${path.map((t,k)=>`${k?'L':'M'}${cx(t)} ${cy(t)}`).join(' ')}"/><path class="rp-stamp-arrow${bad?' bad':''}" d="M-14 -14 L0 0 L-14 14" transform="translate(${cx(path.at(-1))} ${cy(path.at(-1))}) rotate(${P.dirTo(pz,path.at(-2),path.at(-1))*90-90})"/>`).join('');
    el.scrollTop=0;
  }
  function partners(s){
    const incoming=pz.stations.filter(src=>src.kind==='producer'&&s.needs.includes(src.type));
    const outgoing=s.kind==='producer'?pz.stations.filter(dst=>dst.needs.includes(s.type)):[];
    const buttons=(sites,inbound)=>sites.map(site=>`<button type="button" data-site="${site.id}"><span>${inbound?'From':'To'} ${esc(site.name)} · ${coord(site.tile)}</span><small>${esc(P.TYPES[inbound?site.type:s.type].name)}${site.day>sim.day?` · opens night ${site.day}`:''}</small></button>`).join('');
    return `<section class="rp-partners" aria-label="Compatible supply partners"><p>Connect entrances; goods move automatically.</p>${buttons(incoming,true)}${buttons(outgoing,false)}${!incoming.length&&!outgoing.length?'<p>No matching sites yet.</p>':''}</section>`;
  }
  function renderCard(){
    const el=$('rpCard');if(card===null){el.hidden=true;return;}
    if(interchangeDraft){renderInterchange();return;}
    el.classList.remove('rp-interchange');
    const active=el.contains(document.activeElement)?document.activeElement:null,scrollTop=el.scrollTop;
    const focused=active?.hasAttribute('data-site')?`[data-site="${Number(active.dataset.site)}"]`:active?.id==='rpCardTitle'?'#rpCardTitle':['rp-card-x','rp-card-focus'].includes(active?.className)?'.'+active.className:null;
    const id=P.stationAt(pz,sim,card),k=P.whAt(sim,card);let html='';
    if(id<0&&pz.bAt[card]>=0){const s=pz.stations[pz.bAt[card]];
      html=`<b>${esc(s.name)}</b><span class="rp-card-kind">Planned · night ${s.day}</span>${recipeCard(s)}${partners(s)}<p>Reserved ${s.plot.w}×${s.plot.h} footprint. Use the marked ${s.large?'local/collector':'local'} entrance; its through street will stay intact when this site opens.</p>`;
    }
    else if(id>=0){const s=pz.stations[id],x=sim.st[id];
      if(s.kind==='producer'){
        html=`<b>${esc(s.name)}</b><span class="rp-card-kind">${s.recipe?'Factory':'Producer'}</span>${recipeCard(s)}${partners(s)}<p>Output ${x.stock}/${P.OUTPUT_CAP}${x.stock>=P.OUTPUT_CAP?' · full: production paused':''}${s.recipe?'':' · early output peak 0–10 s (×2), then slower output'}.</p>`;
        if(s.recipe)html+=`<p>Per batch · ${s.recipe.ticks*P.TICK} s processing time.</p><p>Inputs: ${s.needs.map(t=>`${esc(P.TYPES[t].name)}: ${x.input[t]} stored · ${x.reqs.filter(r=>r.type===t&&r.v).length} in transit`).join('; ')}.</p><p>${s.needs.some(t=>x.input[t]<s.recipe.input[t])?'Waiting for '+s.needs.filter(t=>x.input[t]<s.recipe.input[t]).map(t=>esc(P.TYPES[t].name)).join(' + '):'Processing when output has room'}.</p>`;
      }
      else{const open=x.reqs.length,oldest=open?Math.max(...x.reqs.map(r=>r.age)):0;
        html=`<b>${esc(s.name)}</b><span class="rp-card-kind">Dispatch</span>${recipeCard(s)}${partners(s)}<p>Final orders score when delivered on time.</p><ul class="rp-schedule">${P.schedule(pz,Math.min(sim.day,pz.days),id,sim.relaxed).map(e=>`<li><b>${e.tick*P.TICK} s</b> · ${e.label}: ${e.qty} ${esc(P.TYPES[e.type].name)} · due ${e.deadline*P.TICK} s</li>`).join('')}</ul>
          <p>${open?`Waiting for ${x.reqs.map(r=>esc(P.TYPES[r.type].name)).join(', ')} · oldest ${Math.round(oldest*P.TICK)} s of ${Math.round(P.patienceTicks(pz,sim)*P.TICK)} s`:'Nothing waiting'}${x.starved?' · <em>starved today</em>':''}</p>`;}
    }else if(k>=0){const w=sim.wh[k],used=w.stock.reduce((a,b)=>a+b,0),incoming=sim.veh.filter(v=>v.kind==='stock'&&v.dst===w.tile);
      const eta=incoming.length?Math.min(...incoming.map(v=>v.t+P.freeRoutes(pz,sim,v.path[v.i]).dist[w.tile]))*P.TICK:null;
      const options=pz.stations.filter(s=>s.day<=sim.day&&s.needs.length).flatMap(s=>s.needs.map(t=>({value:`${s.id}:${t}`,text:`${s.name} · ${P.supply(t)}`})));
      html=`<b>Warehouse ${coord(card)}</b><span class="rp-card-kind">Staging</span><dl class="rp-recipe"><div><dt>Takes</dt><dd>${w.plan?esc(P.TYPES[w.plan.type].name):'Nothing until assigned'}</dd></div><div><dt>Returns</dt><dd>Same goods · no processing</dd></div></dl><p>Holds ${used}/${w.cap}: ${w.stock.map((n,t)=>n?`${n} ${esc(P.TYPES[t].name)}`:'').filter(Boolean).join(', ')||'empty'} · ${w.inc.reduce((a,b)=>a+b,0)} inbound.${eta===null?'':` Nearest inbound: ~${eta.toFixed(1)} s free-flow, plus queues.`}</p><p>${w.plan?`Reserved for ${esc(pz.stations[w.plan.target].name)}: target ${w.plan.qty} ${esc(P.TYPES[w.plan.type].name)}.`:'Assign a destination to request stock deliberately; unassigned warehouses do not pull goods.'} Inventory survives dusk; storage also reserves room for cargo recalled in transit.</p>
        ${sim.phase==='night'?`<form id="rpStockForm"><label>Prepare for<select id="rpStockTarget">${options.map(o=>`<option value="${o.value}" ${w.plan&&o.value===`${w.plan.target}:${w.plan.type}`?'selected':''}>${esc(o.text)}</option>`).join('')}</select></label><label>Stock target<input id="rpStockQty" type="number" min="1" max="${w.cap}" value="${w.plan?.qty||Math.min(4,w.cap)}"></label><button class="primary" type="submit">Reserve stock</button>${w.plan?'<button type="button" data-unprepare>Release reserve</button>':''}</form>`:''}`;}
    else if(sim.net.tier[card]){const road=P.ROADS[sim.net.tier[card]],g=P.graph(pz,sim);
      html=`<b>Road ${coord(card)}</b><span class="rp-card-kind">${esc(road.label)}</span><p>${esc(road.role)} · capacity ${g.cap[card]}${g.shared[card]?' shared at junction':' per direction'} · cruising ${g.ticks[card]*P.TICK} s/tile (turns, acceleration and controls add time).</p><p>Refund value: ${sim.net.paid[card]+sim.net.rbPaid[card]} credits, fully refundable.${sim.net.over[card]?' Grade-separated: no turns.':P.isJunction(sim,card)?` Control: ${sim.net.control[card]}.`:''}</p>${sim.phase==='day'?`<p>${sim.q[card]||0} vehicles queued here.</p>`:''}`;
      if(sim.phase==='night'){
        if(!sim.net.over[card]&&sim.net.tier[card]!==5)html+=`<label>Resurface this tile<select id="rpRoadType">${P.ROADS.slice(1,5).map((r,k)=>`<option value="${r.id}" ${sim.net.tier[card]===k+1?'selected':''}>${esc(r.label)}</option>`).join('')}</select></label>`;
        html+=`<fieldset class="rp-connections"><legend>Connections · tap to toggle</legend>${P.DIR_NAMES.map((name,d)=>`<button data-connection="${d}" aria-pressed="${!!(sim.net.e[card]&(1<<d))}">${name} ${sim.net.e[card]&(1<<d)?'●':'○'}</button>`).join('')}</fieldset>`;
        if((P.isJunction(sim,card)||sim.net.rbPaid[card])&&![3,5].includes(sim.net.tier[card])&&!sim.net.over[card])html+=`<label>Junction control<select id="rpControl">${['stop','signal','roundabout'].map(c=>`<option ${sim.net.control[card]===c?'selected':''} value="${c}">${c==='stop'?'Stop · free':c==='signal'?`Signals · ${P.SIGNAL_COST}`:`Roundabout · ${P.ROUND_COST} · 3×3`}</option>`).join('')}</select></label>`;
        if([5,10,15].includes(sim.net.e[card])&&sim.net.tier[card]!==5)html+='<button data-overpass>'+ (sim.net.over[card]?'Remove overpass':'Build overpass')+'</button>';
        if(sim.net.tier[card]===3&&[5,10].includes(sim.net.e[card]))html+='<button data-interchange>Preview interchange · on + off</button>';
      }
    }else{closeCard();return;}
    if(id>=0){const s=pz.stations[id];html+=`<p>Entrance: ${s.large?'local or collector':'paved local only'}. ${sim.net.tier[card]?'Compatible through street preserved.':'End a street at the entrance, or run a compatible street through its access tile.'}</p><button data-chain>Show supply chain</button>`;}
    el.innerHTML=html+'<button class="rp-card-focus">Zoom here</button><button class="rp-card-x" aria-label="Close">✕</button>';el.hidden=false;
    el.querySelector('b').id='rpCardTitle';el.querySelector('b').tabIndex=-1;
    el.querySelector('.rp-card-x').onclick=closeCard;
    el.querySelector('.rp-card-focus').onclick=()=>{keyboardTile=card;viewX=cx(card);viewY=cy(card);zoom=Math.max(zoom,Math.min(6,Math.ceil(48/(svg.getScreenCTM().a*U)*zoom)));pan=false;closeCard();camera();svg.focus({preventScroll:true});};
    if(el.querySelector('#rpStockForm'))el.querySelector('#rpStockForm').onsubmit=e=>{e.preventDefault();const [target,item]=$('rpStockTarget').value.split(':').map(Number);doEdit({type:'prepare',tile:card,target,item,qty:Number($('rpStockQty').value)});};
    if(el.querySelector('#rpControl'))$('rpControl').onchange=()=>doEdit({type:'control',tile:card,control:$('rpControl').value});
    if(el.querySelector('#rpRoadType'))$('rpRoadType').onchange=()=>doEdit({type:'road',tier:$('rpRoadType').value,tiles:[card]});
    if(focused)el.querySelector(focused)?.focus({preventScroll:true});
    el.scrollTop=scrollTop;
  }
  $('rpCard').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||card===null)return;
    if(b.hasAttribute('data-site')){const s=pz.stations[Number(b.dataset.site)];openCard(s.tile);$('rpCardTitle').focus({preventScroll:true});if(zoom>1){viewX=(s.plot.x+s.plot.w/2)*U;viewY=(s.plot.y+s.plot.h/2)*U;camera();}return;}
    if(b.hasAttribute('data-connection'))doEdit({type:'connection',tile:card,dir:Number(b.dataset.connection)});
    if(b.hasAttribute('data-unprepare'))doEdit({type:'unprepare',tile:card});
    if(b.hasAttribute('data-overpass'))doEdit({type:'overpass',tile:card});
    if(b.hasAttribute('data-interchange'))previewInterchange(card);
    else if(b.hasAttribute('data-ramp-confirm')&&interchangeDraft){const a=interchangeDraft;closeCard();doEdit(a);}
    else if(b.hasAttribute('data-ramp-cancel'))closeCard();
    if(b.hasAttribute('data-chain'))showChain(pz.bAt[card]);
  });
  function showChain(id,whole=true){
    const seen=new Set([id]),edges=new Map();
    function visit(site){for(const src of pz.stations)if(src.kind==='producer')for(const dst of pz.stations)if(dst.needs.includes(src.type)&&(src.id===site.id||dst.id===site.id)){
      if(src.day>sim.day||dst.day>sim.day)continue;
      edges.set(`${src.id}:${dst.id}`,{src,dst,type:src.type});
      for(const next of [src,dst])if(!seen.has(next.id)){seen.add(next.id);if(whole)visit(next);}
    }}
    visit(pz.stations[id]);$('rpLocate').innerHTML=`<defs>${P.TYPES.map((t,i)=>`<marker id="rpFlow${i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${t.color}"/></marker>`).join('')}</defs>`+[...edges.values()].map(({src,dst,type})=>{const route=P.pathTo(P.freeRoutes(pz,sim,src.tile),dst.tile),path=route||[src.tile,dst.tile];return `<path class="rp-chain-path${route?'':' missing'}" data-from="${src.id}" data-to="${dst.id}" marker-end="url(#rpFlow${type})" style="stroke:${tcol(type)}" d="${path.map((t,k)=>`${k?'L':'M'}${cx(t)} ${cy(t)}`).join(' ')}"/>`;}).join('')+[...seen].map(i=>`<circle class="rp-locate" cx="${cx(pz.stations[i].tile)}" cy="${cy(pz.stations[i].tile)}" r="50"/>`).join('');
    clearTimeout(locateTimer);if(whole){locateTimer=setTimeout(()=>{$('rpLocate').innerHTML='';},10000);shell.status('Arrows show goods moving from supplier to destination. Dashed links need a road route.');}
  }

  // ---- drawing ------------------------------------------------------------------------------------------------------------
  function side(){
    const types=P.TYPES.slice(0,pz.types);
    shell.side(`<p class="eyebrow">LEGEND</p><ul class="rp-legend">
      ${types.map((t,i)=>`<li><i class="rp-sw" style="color:${t.color}">${t.sym}</i>${esc(t.name)}</li>`).join('')}
      <li><i class="rp-sw rp-sw-prod">▲↗</i><span><b>Producer / factory</b>: sends its “Returns” goods to sites that “Take” them</span></li>
      <li><i class="rp-sw rp-sw-cons">↘▲</i><span><b>Dispatch</b>: takes finished gear kits; returns no goods. On-time final orders score.</span></li>
      <li><i class="rp-sw rp-sw-wh">▦</i><span><b>Warehouse</b>: holds a mix of goods</span></li>
      ${P.ROADS.slice(1).map(r=>`<li><i class="rp-sw rp-sw-${r.id}">━</i><span><b>${r.label}</b>: ${r.role}, ${r.cap}/direction</span></li>`).join('')}
      <li><i class="rp-sw rp-sw-site">▧</i><span><b>Planned site</b>: fixed arrival day; roads survive</span></li>
      <li><i class="rp-sw rp-sw-river"></i>River: roads here are bridges (×4)</li>
      <li><i class="rp-sw rp-sw-rough"></i>Rough ground (×2)</li>
      <li><i class="rp-sw rp-sw-mount"></i>Mountain (dirt tracks only)</li>
      <li><i class="rp-sw rp-sw-heat"></i>Jam: vehicles queued here</li>
      <li><i class="rp-sw rp-sw-ow">➜</i>One-way (double capacity)</li></ul>`);
  }
  function terrain(){
    let h='';
    for(let i=0;i<pz.W*pz.H;i++){const t=pz.terrain[i],x=(i%pz.W)*U,y=Math.floor(i/pz.W)*U;
      h+=`<rect class="rp-t rp-t-${P.TERRAIN[t].id}" x="${x}" y="${y}" width="${U}" height="${U}"/>`;
      if(t===3)h+=`<path class="rp-mount" d="M${x+14} ${y+82} L${x+44} ${y+26} L${x+60} ${y+52} L${x+70} ${y+40} L${x+88} ${y+82}Z"/>`;
      if(t===2)h+=`<g class="rp-rough"><circle cx="${x+28}" cy="${y+30}" r="5"/><circle cx="${x+68}" cy="${y+48}" r="6"/><circle cx="${x+38}" cy="${y+74}" r="4"/></g>`;
    }
    for(let x=0;x<pz.W;x++)h+=`<text class="rp-coord" x="${x*U+U/2}" y="-12" text-anchor="middle">${column(x)}</text>`;
    $('rpTerrain').innerHTML=h;
  }
  function render(){renderTop();renderRoads();renderTick();renderVehicles(0);drawHint();renderCard();renderNews();}
  function renderTop(){
    const night=sim.phase==='night',day=sim.phase==='day',done=sim.phase==='done';
    const d=Math.min(sim.day,pz.days);
    $('rpPhase').textContent=done?`DONE · ${pz.days} DAYS`:night?`NIGHT ${d} / ${pz.days}`:`DAY ${d} / ${pz.days}`;
    $('rpPhase').className='rp-phase '+(night?'night':day?'day':'done');
    $('rpRoot').classList.toggle('is-night',night);$('rpRoot').classList.toggle('is-day',day);
    $('rpNightBar').hidden=!night||ended;$('rpDayBar').hidden=!day||ended;
    $('rpPause').textContent=paused?'Resume':'Pause';$('rpPause').setAttribute('aria-pressed',String(paused));$('rpPause').disabled=!day||ended;
    $('rpStart').disabled=!night||ended;$('rpStart').textContent=`☀ Start day ${d}`;
    $('rpDusk').disabled=!day||ended;
    stage.querySelectorAll('[data-speed]').forEach(b=>b.disabled=!day||ended);
    stage.querySelectorAll('[data-tool]').forEach(b=>b.disabled=!night||ended);
    shell.undoEnabled(night&&sim.tonight.length>0&&!ended);
    shell.controls({hint:night&&!ended});
    const res=P.result(pz,sim),par=P.parFor(pz,relaxed);
    shell.meters([{label:'Credits',value:String(sim.credits),tone:sim.credits<5?'warn':''},
      {label:'Deliveries',value:String(res.deliveries)},
      {label:'Score / par',value:`${res.score} / ${par}`,tone:res.score>=par?'good':''}]);
  }
  function renderClock(){
    const s=sim.phase==='day'?sim.tick*P.TICK:0;
    $('rpClock').textContent=sim.phase==='day'?`${Math.floor(s)} s / ${P.DAY_SECONDS} s`:sim.phase==='night'?'Clock stopped':'Run over';
    $('rpClockBar').style.width=`${sim.phase==='day'?s/P.DAY_SECONDS*100:0}%`;
  }
  // Roads: each tile draws a half-segment toward every neighbour it is joined to, so joins read clearly.
  function renderRoads(){
    const n=sim.net;let base='',top='',arrows='';
    for(let i=0;i<pz.W*pz.H;i++){
      const isWh=P.whAt(sim,i)>=0;
      if(!n.tier[i])continue;
      const x=cx(i),y=cy(i),tier=P.ROADS[n.tier[i]].id,bridge=pz.terrain[i]===1;
      if(bridge)base+=`<rect class="rp-bridge" x="${x-U/2+4}" y="${y-U/2+14}" width="${U-8}" height="${U-28}" rx="8"/>`;
      let segs='';
      for(let d=0;d<4;d++)if(n.e[i]&(1<<d))segs+=`M${x} ${y} L${x+P.DIRS[d][0]*U/2} ${y+P.DIRS[d][1]*U/2} `;
      const jn=P.isJunction(sim,i);
      top+=`<g class="rp-road rp-tier-${tier}${jn?' junction':''}" data-tile="${i}">${segs?`<path d="${segs}"/>`:''}<circle cx="${x}" cy="${y}" r="${tier==='highway'?20:tier==='road'?15:11}"/></g>`;
      if(n.rb[i])top+=`<circle class="rp-roundabout" cx="${x}" cy="${y}" r="22"/>`;
      if(n.control[i]==='signal')top+=`<rect class="rp-signal" x="${x-14}" y="${y-22}" width="28" height="44" rx="8"/><circle class="rp-signal-light" cx="${x}" cy="${y-7}" r="7"/>`;
      if(n.over[i]){const vertical=n.over[i].axis===0;top+=`<path class="rp-over-deck" d="M${x-(vertical?0:50)} ${y-(vertical?50:0)} L${x+(vertical?0:50)} ${y+(vertical?50:0)}"/><path class="rp-over-top rp-tier-${tier}" d="M${x-(vertical?0:50)} ${y-(vertical?50:0)} L${x+(vertical?0:50)} ${y+(vertical?50:0)}"/>`;}
      else if(jn)top+=`<circle class="rp-junction" cx="${x}" cy="${y}" r="7"/>`;
      void isWh;
      // One-way joins: arrows marching along the allowed direction.
      for(let d=0;d<2;d++){const j=P.neighbour(pz,i,d+1);if(j<0||!(n.e[i]&(1<<(d+1))))continue;
        const dd=d+1,fw=!(n.blk[i]&(1<<dd)),bw=!(n.blk[j]&(1<<((dd+2)&3)));if(fw===bw)continue;
        const dir=fw?dd:(dd+2)&3,mx=(x+cx(j))/2,my=(y+cy(j))/2,ang=[-90,0,90,180][dir];
        arrows+=`<g transform="translate(${mx} ${my}) rotate(${ang})"><path class="rp-arrow" d="M-12 -11 L4 0 L-12 11"/></g>`;}
    }
    $('rpRoads').innerHTML=base+top;$('rpArrows').innerHTML=arrows;
  }
  function renderTick(){
    renderTop();renderClock();renderHeat();renderBuildings();if(card!==null)renderCard();
  }
  function renderHeat(){
    const ds=sim.phase==='day'?sim.ds:sim.report&&sim.report.ds;let h='';
    if(ds){const ticks=Math.max(1,sim.phase==='day'?sim.tick:pz.dayTicks);
      for(let i=0;i<ds.jam.length;i++){const f=ds.jam[i]/ticks,live=sim.phase==='day'&&sim.q[i]>0;if(f<0.04&&!live)continue;
        h+=`<rect class="rp-heat${live?' live':''}${sim.phase!=='day'?' past':''}" data-tile="${i}" x="${cx(i)-U/2}" y="${cy(i)-U/2}" width="${U}" height="${U}" style="opacity:${Math.min(0.8,0.2+f*2).toFixed(2)}"/>`;}}
    $('rpHeat').innerHTML=h;
  }
  function renderBuildings(){
    if(pz.logistics){renderLogisticsBuildings();return;}
    let h='',sites='';const pt=P.patienceTicks(pz,sim);
    for(const s of pz.stations){
      if(s.day>sim.day&&sim.phase!=='done'){
        const x=cx(s.tile),y=cy(s.tile),goods=s.kind==='producer'?sym(s.type):s.needs.map(sym).join(' ');
        sites+=`<g class="rp-site" data-planned="${s.id}"><title>${esc(s.name)} · night ${s.day} · ${s.kind==='producer'?'Makes':'Needs'} ${goods}</title><rect x="${x-39}" y="${y-39}" width="78" height="78" rx="12"/><text x="${x}" y="${y-10}" text-anchor="middle">N${s.day}</text><text x="${x}" y="${y+23}" text-anchor="middle">${s.kind==='producer'?'↑':'↓'} ${goods}</text></g>`;
        continue;
      }
      const x=cx(s.tile),y=cy(s.tile),st=sim.st[s.id],isNew=s.day===sim.day&&sim.phase==='night'&&s.day>1;
      if(s.kind==='producer'){
        const c=tcol(s.type),dots=Array.from({length:P.PROD_CAP},(_,k)=>`<circle class="rp-stock${k<st.stock?' on':''}" cx="${x-30+k*20}" cy="${y+34}" r="6"/>`).join('');
        h+=`<g class="rp-building rp-producer${isNew?' new':''}" data-station="${s.id}"><rect class="rp-b-body" x="${x-42}" y="${y-42}" width="84" height="84" rx="16" style="stroke:${c}"/>
          <text class="rp-b-icon" x="${x}" y="${y+12}" text-anchor="middle" style="fill:${c}">${sym(s.type)}</text>
          <path class="rp-b-out" d="M${x+20} ${y-20} L${x+40} ${y-40} M${x+26} ${y-40} L${x+40} ${y-40} L${x+40} ${y-26}"/>${dots}
          <g class="rp-label"><rect x="${x-62}" y="${y-84}" width="124" height="36" rx="10"/><text x="${x}" y="${y-58}" text-anchor="middle">Makes ${sym(s.type)}</text></g>
          ${isNew?`<text class="rp-newtag" x="${x}" y="${y+76}" text-anchor="middle">NEW TONIGHT</text>`:''}</g>`;
      }else{
        const oldest=st.reqs.length?Math.max(...st.reqs.map(r=>r.age)):0,f=Math.min(1,oldest/pt),R=46,C=2*Math.PI*R;
        const icons=s.needs.map((t,k)=>`<text class="rp-b-icon need" x="${x+(k-(s.needs.length-1)/2)*34}" y="${y+12}" text-anchor="middle" style="fill:${tcol(t)}">${sym(t)}</text>`).join('');
        const waiting=st.reqs.slice(0,4).map((r,k)=>`<text class="rp-req" x="${x-27+k*18}" y="${y+40}" text-anchor="middle" style="fill:${tcol(r.type)}">${sym(r.type)}</text>`).join('');
        const lw=Math.max(124,70+s.needs.length*34);
        h+=`<g class="rp-building rp-consumer${st.starved?' starved':''}${isNew?' new':''}" data-station="${s.id}"><circle class="rp-b-body" cx="${x}" cy="${y}" r="40"/>
          <circle class="rp-ring-bg" cx="${x}" cy="${y}" r="${R}"/><circle class="rp-ring${f>=1?' full':f>0.6?' warn':''}" cx="${x}" cy="${y}" r="${R}" style="stroke-dasharray:${(C*f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${x} ${y})"/>
          ${icons}${waiting}
          <path class="rp-b-in" d="M${x-46} ${y-46} L${x-28} ${y-28} M${x-28} ${y-42} L${x-28} ${y-28} L${x-42} ${y-28}"/>
          <g class="rp-label"><rect x="${x-lw/2}" y="${y-88}" width="${lw}" height="36" rx="10"/><text x="${x}" y="${y-62}" text-anchor="middle">Needs ${s.needs.map(sym).join(' ')}</text></g>
          ${isNew?`<text class="rp-newtag" x="${x}" y="${y+78}" text-anchor="middle">NEW TONIGHT</text>`:''}</g>`;
      }
      if(sim.net.tier[s.tile])h+=`<text class="rp-through" data-through="${s.id}" x="${x}" y="${y+59}" text-anchor="middle">↔ THROUGH</text>`;
    }
    for(const w of sim.wh){
      const x=cx(w.tile),y=cy(w.tile),items=[];w.stock.forEach((n,t)=>{for(let k=0;k<n;k++)items.push(t);});
      const cell=Math.min(14,64/w.cap);
      const bar=Array.from({length:w.cap},(_,k)=>k<items.length?`<rect x="${x-32+k*cell}" y="${y+18}" width="${cell-1}" height="18" style="fill:${tcol(items[k])}"/>`:`<rect class="empty" x="${x-32+k*cell}" y="${y+18}" width="${cell-1}" height="18"/>`).join('');
      h+=`<g class="rp-building rp-wh" data-wh="${w.tile}"><rect class="rp-b-body" x="${x-40}" y="${y-40}" width="80" height="80" rx="8"/><path class="rp-wh-roof" d="M${x-30} ${y-6} L${x} ${y-30} L${x+30} ${y-6}"/><g class="rp-wh-bar">${bar}</g></g>`;
    }
    $('rpSites').innerHTML=sites;$('rpBuildings').innerHTML=h;
  }
  function renderLogisticsBuildings(){
    let buildings='',sites='';
    for(const s of pz.stations){
      const p=s.plot,x=p.x*U+8,y=p.y*U+8,w=p.w*U-16,h=p.h*U-16,mx=x+w/2,my=y+h/2,active=s.day<=sim.day,st=sim.st[s.id],color=s.kind==='producer'?tcol(s.type):'#dae8ef';
      const inGoods=takes(s),outGoods=s.kind==='producer'?returns(s):'Nothing',name=s.recipe?s.recipe.name:s.kind==='producer'?P.TYPES[s.type].name+' mine':'Dispatch';
      const blocked=s.recipe&&s.needs.some(t=>st.input[t]<s.recipe.input[t]),oldest=st.reqs.length?Math.max(...st.reqs.map(r=>r.age)):0;
      const status=!active?`OPENS NIGHT ${s.day}`:s.recipe?blocked?'WAITING FOR INPUTS':'ASSEMBLING':s.kind==='producer'?`${st.stock}/${P.OUTPUT_CAP} OUTPUT`:st.reqs.length?`${st.reqs.length} WAITING · ${Math.round(oldest*P.TICK)}s`:'SCHEDULED DISPATCH';
      const content=`<g class="rp-building rp-plot ${active?'':'rp-site'} ${s.recipe?'rp-factory':''}${card===s.tile?' selected':''}" ${active?`data-station="${s.id}"`:`data-planned="${s.id}"`}><title>${esc(s.name)} · Takes: ${esc(inGoods.join(' + ')||'nothing')} · Returns: ${esc(outGoods)} · ${s.large?'local or collector':'local'} entrance</title><rect class="rp-b-body" x="${x}" y="${y}" width="${w}" height="${h}" rx="18" style="stroke:${color}"/><text class="rp-plot-name" x="${mx}" y="${y+28}" text-anchor="middle">${esc(name)}</text><g class="rp-plot-recipe" text-anchor="middle"><text class="rp-recipe-label" x="${mx}" y="${y+51}">TAKES</text>${(inGoods.length?inGoods:['Nothing · mine']).map((line,i)=>`<text class="rp-recipe-item" x="${mx}" y="${y+73+i*22}">${esc(line)}</text>`).join('')}<text class="rp-recipe-label" x="${mx}" y="${y+117}">RETURNS</text><text class="rp-recipe-item" x="${mx}" y="${y+139}" style="fill:${color}">${esc(outGoods)}</text></g><text class="rp-plot-status" x="${mx}" y="${y+166}" text-anchor="middle">${status}</text><path class="rp-entrance" d="M${cx(s.tile)} ${cy(s.tile)} L${x} ${cy(s.tile)}"/><circle class="rp-port" cx="${cx(s.tile)}" cy="${cy(s.tile)}" r="17"/><text class="rp-port-label" x="${cx(s.tile)}" y="${cy(s.tile)+40}" text-anchor="middle">${s.large?'L/C':'L'}</text></g>`;
      if(active)buildings+=content;else sites+=content;
      if(active&&sim.day>1&&s.day===sim.day)buildings+=`<text class="rp-newtag" x="${mx}" y="${y-8}" text-anchor="middle">NEW TONIGHT</text>`;
      if(active&&sim.net.tier[s.tile])buildings+=`<circle data-through="${s.id}" class="rp-port" cx="${cx(s.tile)}" cy="${cy(s.tile)}" r="12"/>`;
      if(sim.net.e[s.tile]&&!sim.net.tier[s.tile])for(let d=0;d<4;d++)if(sim.net.e[s.tile]&(1<<d))buildings+=`<path class="rp-access" d="M${cx(s.tile)} ${cy(s.tile)} L${cx(s.tile)+P.DIRS[d][0]*U/2} ${cy(s.tile)+P.DIRS[d][1]*U/2}"/>`;
    }
    for(const wh of sim.wh){const x=cx(wh.tile),y=cy(wh.tile);buildings+=`<g class="rp-building rp-wh" data-wh="${wh.tile}"><rect class="rp-b-body" x="${x-40}" y="${y-40}" width="170" height="170" rx="16"/><text class="rp-plot-name rp-wh-name" x="${x+45}" y="${y-12}" text-anchor="middle">Warehouse</text><g class="rp-plot-recipe" text-anchor="middle"><text class="rp-recipe-label" x="${x+45}" y="${y+10}">TAKES</text><text class="rp-recipe-item" x="${x+45}" y="${y+30}">${wh.plan?esc(P.TYPES[wh.plan.type].name):'Assign stock'}</text><text class="rp-recipe-label" x="${x+45}" y="${y+54}">RETURNS</text><text class="rp-recipe-item" x="${x+45}" y="${y+74}">Same goods</text></g><text class="rp-plot-status rp-wh-status" x="${x+45}" y="${y+106}" text-anchor="middle">${wh.stock.reduce((a,b)=>a+b,0)}/${wh.cap} · ${wh.plan?'RESERVED':'UNASSIGNED'}</text><circle class="rp-port" cx="${x}" cy="${y}" r="17"/></g>`;}
    $('rpSites').innerHTML=sites;$('rpBuildings').innerHTML=buildings;
  }
  function renderVehicles(frac){
    if(sim.phase!=='day'){$('rpVehicles').innerHTML='';return;}
    const g=P.graph(pz,sim);let h='';
    for(const v of sim.veh){
      const cur=v.path[v.i],prev=v.i>0?v.path[v.i-1]:cur,total=v.total||g.ticks[cur]||1;
      let f=v.i>0?1-(Math.max(0,v.t-frac))/total:0;if(v.wait>0)f=1;f=Math.max(0,Math.min(1,f));
      // Keep to the right-hand side of the road so the two directions read apart.
      const d=P.dirTo(pz,prev,cur),off=d<0?0:12,ox=d<0?0:-P.DIRS[d][1]*off,oy=d<0?0:P.DIRS[d][0]*off;
      const x=cx(prev)+(cx(cur)-cx(prev))*f+ox,y=cy(prev)+(cy(cur)-cy(prev))*f+oy,loaded=v.kind!=='home';
      h+=`<g class="rp-veh${loaded?'':' empty'}${v.wait>0?' queued':''}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-15" y="-11" width="30" height="22" rx="7" style="fill:${loaded?tcol(v.type):'#5d6c78'}"/>${loaded?`<text y="7" text-anchor="middle">${sym(v.type)}</text>`:''}</g>`;
    }
    $('rpVehicles').innerHTML=h;
  }
  function effects(){
    if(reduced())return;
    for(const f of sim.fx){
      if(f.kind!=='deliver'&&f.kind!=='stock')continue;
      const x=cx(f.tile),y=cy(f.tile),c=tcol(f.type);
      const el=document.createElementNS(SVGNS,'g');el.setAttribute('class','rp-pop');
      el.innerHTML=`<circle cx="${x}" cy="${y}" r="44" style="stroke:${c}"/><text x="${x}" y="${y-56}" text-anchor="middle" style="fill:${c}">${f.kind==='deliver'?'+1 ':''}${sym(f.type)}</text>`;
      $('rpFx').appendChild(el);setTimeout(()=>el.remove(),900);
    }
  }
  function drawHint(){
    if(!hint||!hint.tiles||!hint.act||drag)return;
    const t=hint.tiles,d=t.map((i,k)=>`${k?'L':'M'}${cx(i)} ${cy(i)}`).join(' ');
    $('rpGhost').innerHTML=(t.length>1?`<path class="rp-ghost hint" d="${d}"/>`:'')+t.map(i=>`<rect class="rp-ghost-tile hint" x="${cx(i)-U/2+6}" y="${cy(i)-U/2+6}" width="${U-12}" height="${U-12}" rx="14"/>`).join('');
  }
  function renderNews(){
    const el=$('rpNews');
    if(sim.phase!=='night'||ended){el.textContent=sim.phase==='day'?'Early output 0–10s · dispatch peaks 24–26s. Inspect a site for its chain and exact schedule.':'';return;}
    const fresh=pz.stations.filter(s=>s.day===sim.day);
    const next=pz.stations.filter(s=>s.day===sim.day+1);
    el.innerHTML=`<b class="rp-newtag-inline">NEW TONIGHT</b> ${fresh.map(s=>`${esc(s.name)} (${s.kind==='producer'?'Returns '+esc(P.TYPES[s.type].name):'Takes '+s.needs.map(t=>esc(P.TYPES[t].name)).join(' + ')})`).join(', ')}. ${next.length?`Next night: ${next.length} planned site${next.length===1?'':'s'} open; +${P.STIPEND+P.growthCredit(pz,sim.day+1)} construction credits at dusk.`:`+${P.STIPEND} construction credits at dusk.`}`;
  }
  // The on-demand dusk recap and the day's three worst problems, each with Locate.
  function report(){
    const r=sim.report,el=$('rpReport');if(!r){el.hidden=true;$('rpReportOpen').hidden=true;return;}
    const d=r.summary;
    el.innerHTML=`<div class="rp-report-head"><h3>Dusk report · day ${r.day}</h3><button id="rpReportClose" aria-label="Close dusk report">✕</button></div>
      <div class="rp-tally"><span>Deliveries <b data-count="${d.deliveries}">${d.deliveries}</b></span><span>Credits earned <b data-count="${d.deliveries*P.DELIVERY_CREDIT+P.STIPEND+d.grant}">+${d.deliveries*P.DELIVERY_CREDIT+P.STIPEND+d.grant}</b> (${P.STIPEND} construction + ${d.grant} growth + deliveries)</span>
      <span>${d.clean?`Clean day <b>+${P.CLEAN_BONUS}</b>`:`<em>${d.starved.length} starved</em>: no bonus`}</span><span>Day score <b data-count="${d.score}">${d.score}</b></span></div>
      ${r.problems.length?`<ol class="rp-problems">${r.problems.map((p,i)=>`<li><span>${esc(p.text)}</span><button data-locate="${i}">Locate</button></li>`).join('')}</ol>`:'<p class="rp-allgood">No slowdowns today: the traffic flowed freely.</p>'}`;
    el.hidden=true;
    $('rpReportOpen').hidden=false;$('rpReportOpen').setAttribute('aria-expanded','false');
    $('rpReportClose').onclick=()=>{el.hidden=true;$('rpReportOpen').setAttribute('aria-expanded','false');$('rpReportOpen').focus();};
  }
  $('rpReport').addEventListener('click',e=>{const b=e.target.closest('[data-locate]');if(!b||!sim.report)return;
    const p=sim.report.problems[Number(b.dataset.locate)];if(!p)return;count.locates++;
    clearTimeout(locateTimer);
    $('rpLocate').innerHTML=p.tiles.map(i=>`<circle class="rp-locate" cx="${cx(i)}" cy="${cy(i)}" r="${p.tiles.length>1?30:60}"/>`).join('');
    $('rpWrap').scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});
    shell.status('Located: '+p.text);
    locateTimer=setTimeout(()=>{$('rpLocate').innerHTML='';},4000);});
  document.addEventListener('keydown',e=>{if(e.key===' '&&e.target===document.body&&!ended){e.preventDefault();if(sim.phase==='night')startDay();}});
  window.RoutePlanningUI={get pz(){return pz;},get sim(){return sim;}};
  shell.start();
})();
