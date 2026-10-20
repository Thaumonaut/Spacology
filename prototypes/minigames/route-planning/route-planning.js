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
    {id:'dirt',label:'Local',cost:`${P.ROADS[1].cost}/tile · 1/lane`,tip:'Cheap, slow access streets: one vehicle per direction. Downgrading returns the full price difference.'},
    {id:'road',label:'Collector',cost:`${P.ROADS[2].cost}/tile · 2/lane`,tip:'Neighbourhood links: two vehicles per direction. Drag through a building to add a through road; start or end there for free access. A single tile tap joins its neighbours.'},
    {id:'highway',label:'Arterial',cost:`${P.ROADS[3].cost}/tile · 3/lane`,tip:'Fast cross-map trunks: three vehicles per direction, including more junction capacity. Upgrades cost only the price difference. Joins appear only where you draw them.'},
    {id:'erase',label:'Erase',cost:'full refund',tip:'Drag to remove road or a warehouse. Recover its full current construction value, on any night.'},
    {id:'oneway',label:'One-way',cost:`${P.ONEWAY_COST}/join`,tip:'Drag along a road to make it one-way in that direction: it carries twice as much. The same drag again makes it two-way.'},
    {id:'roundabout',label:'Roundabout',cost:String(P.ROUND_COST),tip:'Tap a junction (three or more joins). Separate entry lanes replace its shared capacity, and remove the junction delay. Downstream roads can still congest. Tap again for a full refund.'},
    {id:'warehouse',label:'Warehouse',cost:String(P.WH_COST),tip:`Tap empty ground beside a road. Full producers send surplus here (up to ${P.WH_CAP}), and it serves nearby requests.`},
    {id:'whcap',label:'+Storage',cost:String(P.WH_UP_COST),tip:`Tap a warehouse to add ${P.WH_UP} spaces.`}
  ];
  let pz=null,sim=null,tool='road',drag=null,hint=null,running=false,speed=1,relaxed=false,launched=false,acc=0,last=0,raf=0,
    ended=false,locate=null,locateTimer=0,card=null,count={edits:0,undos:0,hints:0,rejected:0,locates:0};
  const shell=K.shell({id:'route-planning',defaultDifficulty:'normal',
    difficulties:P.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),
    rules:['<b>Night</b>: the clock stops. <b>Drag</b> across tiles to lay road from the <b>producers</b> (“Makes ▲”) to the <b>consumers</b> (“Needs ▲ ■”). Roads join along the way you drag, so parallel roads stay separate.',
      'Press <b>Start day</b> to watch the traffic. You cannot build by day; use 1×, 2×, 4× or <b>Skip to dusk</b>.',
      '<b>Local</b> streets are cheap access roads (1 vehicle/direction). <b>Collectors</b> gather traffic (2); fast <b>arterials</b> carry it across the map (3). Junction capacity scales with the road. Red tiles show queues.',
      'A river road is a <b>bridge</b> (×4 cost); rough ground costs ×2; mountains block. <b>One-way</b> stretches carry double. <b>Roundabouts</b> separate entry lanes, but cannot fix a full downstream road. <b>Warehouses</b> store surplus nearby.',
      `Rebuild freely: <b>full refunds</b> on every night; re-tiering pays or returns only the difference. Each dusk pays <b>${P.STIPEND} construction credits</b> plus <b>${P.GROWTH_CREDIT} per new building</b>, even if deliveries failed.`,
      'Dashed <b>planned sites</b> show every future building and its arrival day. New buildings <b>never erase roads</b>. Drag a road through a building to keep through traffic flowing; ending there gives free access. Demand still rises each night.',
      `Score: 1 per delivery, <b>+${P.CLEAN_BONUS}</b> for each day nobody starved (a ring that fills past its limit). Starving never ends the run. Reach the planner’s <b>par</b> for Perfect.`],
    onNew,onAuto,onUndo,onHint});
  const stage=shell.stage;
  stage.innerHTML=`<div class="rp" id="rpRoot">
    <div class="rp-top">
      <span id="rpPhase" class="rp-phase">NIGHT</span>
      <button id="rpStart" class="primary rp-start">☀ Start day</button>
      <div class="rp-speed" role="group" aria-label="Speed">${[1,2,4].map(s=>`<button data-speed="${s}" aria-pressed="${s===1}">${s}×</button>`).join('')}</div>
      <button id="rpDusk" title="Run the rest of the day at once">⏭ Skip to dusk</button>
      <button id="rpRelaxed" aria-pressed="false" title="Consumers wait longer before they starve. Set before the first day.">Relaxed: off</button>
      <div class="rp-clock"><span id="rpClock"></span><i><b id="rpClockBar"></b></i></div>
    </div>
    <div class="rp-tools" id="rpTools" role="toolbar" aria-label="Night tools">${TOOLS.map(t=>`<button data-tool="${t.id}" aria-pressed="${t.id==='road'}" title="${esc(t.tip)}"><b>${esc(t.label)}</b><small>${esc(t.cost)}</small></button>`).join('')}</div>
    <p class="rp-news" id="rpNews"></p>
    <div class="rp-mapwrap" id="rpWrap"><svg id="rpMap" role="application" aria-label="Road map">
      <g id="rpTerrain"></g><g id="rpSites"></g><g id="rpHeat"></g><g id="rpRoads"></g><g id="rpArrows"></g><g id="rpGhost"></g><g id="rpBuildings"></g><g id="rpVehicles"></g><g id="rpFx"></g><g id="rpLocate"></g></svg>
      <div class="rp-card" id="rpCard" hidden></div></div>
    <p class="rp-preview" id="rpPreview" aria-live="polite"></p>
    <div class="rp-hintbar" id="rpHintBar" hidden><span id="rpHintText"></span><button id="rpHintApply" class="primary">Apply hint</button><button id="rpHintDismiss">Dismiss</button></div>
    <section class="rp-report" id="rpReport" hidden aria-live="polite"></section>
  </div>`;
  const $=id=>document.getElementById(id),svg=$('rpMap');
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const sym=t=>P.TYPES[t].sym,tcol=t=>P.TYPES[t].color;
  const cx=i=>(i%pz.W)*U+U/2,cy=i=>Math.floor(i/pz.W)*U+U/2;
  const tileXY=i=>({x:i%pz.W,y:Math.floor(i/pz.W)});
  const coord=i=>{const {x,y}=tileXY(i);return String.fromCharCode(65+x)+(y+1);};

  // ---- lifecycle ------------------------------------------------------------------------------------------------------
  function onNew({seed,difficulty}){
    stop();pz=P.generate(seed,difficulty);relaxed=false;sim=P.create(pz,{relaxed});
    hint=null;launched=false;ended=false;acc=0;drag=null;card=null;locate=null;count={edits:0,undos:0,hints:0,rejected:0,locates:0};
    $('rpRelaxed').disabled=false;$('rpRelaxed').setAttribute('aria-pressed','false');$('rpRelaxed').textContent='Relaxed: off';
    $('rpReport').hidden=true;$('rpHintBar').hidden=true;$('rpCard').hidden=true;
    svg.setAttribute('viewBox',`-20 -40 ${pz.W*U+40} ${pz.H*U+60}`);
    side();terrain();render();
    shell.status(`Night 1. Drag roads from each producer (“Makes”) to the consumers that need it, then press Start day. ${pz.credits0} credits to spend.`);
  }
  function stop(){running=false;cancelAnimationFrame(raf);raf=0;}
  function startDay(){
    if(ended||sim.phase!=='night')return;
    if(!launched){launched=true;shell.begin();$('rpRelaxed').disabled=true;}
    hideHint();closeCard();drag=null;$('rpGhost').innerHTML='';$('rpReport').hidden=true;
    P.startDay(pz,sim);shell.log('day',{day:sim.day});
    running=true;last=performance.now();acc=0;render();raf=requestAnimationFrame(frame);
    shell.status(`Day ${sim.day}: watch where the traffic slows. Red tiles are jams; a consumer’s ring fills while it waits.`);
  }
  function frame(now){
    if(!running)return;
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
    shell.status(`Dusk. Day ${sim.day-1} scored ${sim.days[sim.days.length-1].score}. Night ${sim.day}: ${fresh.length} new station${fresh.length===1?'':'s'} tonight. Build, then start the day.`,'good');
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
    stop();hideHint();closeCard();
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
  const DRAGGERS=new Set(['road','dirt','highway','erase','oneway']);
  svg.addEventListener('pointerdown',e=>{
    if(ended||!pz)return;const t=tileAt(e);if(t<0)return;
    e.preventDefault();svg.setPointerCapture?.(e.pointerId);
    drag={tiles:[t],id:e.pointerId};drawDrag();
  });
  svg.addEventListener('pointermove',e=>{
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
    if(!drag||drag.id!==e.pointerId)return;const tiles=drag.tiles;drag=null;$('rpGhost').innerHTML='';$('rpPreview').textContent='';
    if(hint)drawHint();
    const t=tiles[0];
    if(tiles.length===1&&((isB(t)||pz.bAt[t]>=0)&&tool!=='erase'&&tool!=='whcap'&&tool!=='roundabout'||sim.phase!=='night')){
      if(isB(t)||pz.bAt[t]>=0)openCard(t);else{closeCard();if(sim.phase==='day')shell.status('Building waits for the night. Tap a building to inspect it.');}
      return;
    }
    closeCard();
    if(sim.phase!=='night')return;
    const a=action(tiles);if(a)doEdit(a);
  };
  svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',e=>{if(drag&&drag.id===e.pointerId){drag=null;$('rpGhost').innerHTML='';}});
  function action(tiles){
    if(tool==='road'||tool==='dirt'||tool==='highway')return {type:'road',tier:tool,tiles:tiles.slice()};
    if(tool==='erase')return {type:'erase',tiles:tiles.slice()};
    if(tool==='oneway'){if(tiles.length<2){shell.status('Drag along a road (at least two tiles) to make it one-way in that direction.','warn');return null;}return {type:'oneway',tiles:tiles.slice()};}
    const t=tiles[tiles.length-1];
    if(tool==='roundabout')return {type:'roundabout',tile:t};
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
    $('rpPreview').textContent=p.length<2&&tool==='oneway'?'Drag along the road.':why?'✕ '+why:cost>0?`${p.length} tile${p.length===1?'':'s'}: costs ${cost} credits (you have ${sim.credits}).`:cost<0?`Refunds ${-cost} credits.`:'Free.';
  }
  stage.querySelector('#rpTools').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(!b)return;tool=b.dataset.tool;
    stage.querySelectorAll('[data-tool]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    shell.status(TOOLS.find(t=>t.id===tool).tip);});
  $('rpStart').onclick=startDay;$('rpDusk').onclick=skipDusk;
  stage.querySelector('.rp-speed').addEventListener('click',e=>{const b=e.target.closest('[data-speed]');if(!b)return;speed=Number(b.dataset.speed);
    stage.querySelectorAll('[data-speed]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
  $('rpRelaxed').onclick=()=>{if(launched||ended)return;relaxed=!relaxed;const edits=sim.tonight.slice();sim=P.create(pz,{relaxed});for(const a of edits)P.edit(pz,sim,a);
    $('rpRelaxed').setAttribute('aria-pressed',String(relaxed));$('rpRelaxed').textContent='Relaxed: '+(relaxed?'on':'off');render();
    shell.status(relaxed?`Relaxed: consumers wait ${P.RELAXED}× as long before they starve. Par is recomputed for it.`:'Standard patience.');};

  // ---- building card ----------------------------------------------------------------------------------------------------
  function openCard(t){card=t;renderCard();}
  function closeCard(){card=null;$('rpCard').hidden=true;}
  function renderCard(){
    const el=$('rpCard');if(card===null){el.hidden=true;return;}
    const id=P.stationAt(pz,sim,card),k=P.whAt(sim,card);let html='';
    if(id<0&&pz.bAt[card]>=0){const s=pz.stations[pz.bAt[card]];
      html=`<b>${esc(s.name)}</b><span class="rp-card-kind">Planned · night ${s.day}</span><p>${s.kind==='producer'?'Makes '+esc(P.supply(s.type)):'Needs '+s.needs.map(t=>esc(P.supply(t))).join(' and ')}.</p><p>This site is fixed for this seed. Roads through it will stay intact when the building opens. Keep warehouses outside planned sites.</p>`;
    }
    else if(id>=0){const s=pz.stations[id],x=sim.st[id];
      if(s.kind==='producer')html=`<b>${esc(s.name)}</b><span class="rp-card-kind">Producer</span><p>Makes <i style="color:${tcol(s.type)}">${esc(P.supply(s.type))}</i>, one every ${(pz.prodTicks*P.TICK).toFixed(1)} s.</p><p>Stock ${x.stock}/${P.PROD_CAP}${x.stock>=P.PROD_CAP?' · full: production paused':''}</p>`;
      else{const open=x.reqs.length,oldest=open?Math.max(...x.reqs.map(r=>r.age)):0;
        html=`<b>${esc(s.name)}</b><span class="rp-card-kind">Consumer</span><p>Needs ${s.needs.map(t=>`<i style="color:${tcol(t)}">${esc(P.supply(t))}</i>`).join(' and ')}, one request every ${(P.demTicks(pz,Math.min(sim.day,pz.days))*P.TICK).toFixed(1)} s.</p>
          <p>${open?`Waiting for ${x.reqs.map(r=>sym(r.type)).join(' ')} · oldest ${Math.round(oldest*P.TICK)} s of ${Math.round(P.patienceTicks(pz,sim)*P.TICK)} s`:'Nothing waiting'}${x.starved?' · <em>starved today</em>':''}</p>`;}
    }else if(k>=0){const w=sim.wh[k],used=w.stock.reduce((a,b)=>a+b,0);
      html=`<b>Warehouse ${coord(card)}</b><span class="rp-card-kind">Storage</span><p>Holds ${used}/${w.cap}: ${w.stock.map((n,t)=>n?`${n} ${sym(t)}`:'').filter(Boolean).join(', ')||'empty'}.</p><p>Full producers send surplus here; it serves requests when it is the nearest source.</p>`;}
    else{closeCard();return;}
    if(id>=0)html+=`<p>${sim.net.tier[card]?'Through road: '+P.ROADS[sim.net.tier[card]].label+'.':'Access only. Drag a road through this tile to allow passing traffic.'}</p>`;
    el.innerHTML=html+'<button class="rp-card-x" aria-label="Close">✕</button>';el.hidden=false;
    el.querySelector('.rp-card-x').onclick=closeCard;
  }

  // ---- drawing ------------------------------------------------------------------------------------------------------------
  function side(){
    const types=P.TYPES.slice(0,pz.types);
    shell.side(`<p class="eyebrow">LEGEND</p><ul class="rp-legend">
      ${types.map((t,i)=>`<li><i class="rp-sw" style="color:${t.color}">${t.sym}</i>${esc(t.name)}</li>`).join('')}
      <li><i class="rp-sw rp-sw-prod">▲↗</i><span><b>Producer</b>: “Makes ▲”, sends goods out</span></li>
      <li><i class="rp-sw rp-sw-cons">↘▲</i><span><b>Consumer</b>: “Needs ▲ ■”; its ring fills while it waits</span></li>
      <li><i class="rp-sw rp-sw-wh">▦</i><span><b>Warehouse</b>: holds a mix of goods</span></li>
      ${P.ROADS.slice(1).map(r=>`<li><i class="rp-sw rp-sw-${r.id}">━</i><span><b>${r.label}</b>: ${r.role}, ${r.cap}/direction</span></li>`).join('')}
      <li><i class="rp-sw rp-sw-site">▧</i><span><b>Planned site</b>: fixed arrival day; roads survive</span></li>
      <li><i class="rp-sw rp-sw-river"></i>River: roads here are bridges (×4)</li>
      <li><i class="rp-sw rp-sw-rough"></i>Rough ground (×2)</li>
      <li><i class="rp-sw rp-sw-mount"></i>Mountain (no roads)</li>
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
    for(let x=0;x<pz.W;x++)h+=`<text class="rp-coord" x="${x*U+U/2}" y="-12" text-anchor="middle">${String.fromCharCode(65+x)}</text>`;
    $('rpTerrain').innerHTML=h;
  }
  function render(){renderTop();renderRoads();renderTick();renderVehicles(0);drawHint();renderCard();renderNews();}
  function renderTop(){
    const night=sim.phase==='night',day=sim.phase==='day',done=sim.phase==='done';
    const d=Math.min(sim.day,pz.days);
    $('rpPhase').textContent=done?`DONE · ${pz.days} DAYS`:night?`NIGHT ${d} / ${pz.days}`:`DAY ${d} / ${pz.days}`;
    $('rpPhase').className='rp-phase '+(night?'night':day?'day':'done');
    $('rpRoot').classList.toggle('is-night',night);$('rpRoot').classList.toggle('is-day',day);
    $('rpStart').disabled=!night||ended;$('rpStart').textContent=`☀ Start day ${d}`;
    $('rpDusk').disabled=!day||ended;
    stage.querySelectorAll('[data-speed]').forEach(b=>b.disabled=!day||ended);
    stage.querySelectorAll('[data-tool]').forEach(b=>b.disabled=!night||ended);
    shell.undoEnabled(night&&sim.tonight.length>0&&!ended);
    shell.controls({hint:night&&!ended});
    const res=P.result(pz,sim),par=P.parFor(pz,relaxed);
    shell.meters([{label:night?'Night':'Day',value:`${d}/${pz.days}`},{label:'Score / par',value:`${res.score} / ${par}`,tone:res.score>=par?'good':''},
      {label:'Deliveries',value:String(res.deliveries)},{label:'Credits',value:String(sim.credits),tone:sim.credits<5?'warn':''}]);
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
  function renderVehicles(frac){
    if(sim.phase!=='day'){$('rpVehicles').innerHTML='';return;}
    const g=P.graph(pz,sim);let h='';
    for(const v of sim.veh){
      const cur=v.path[v.i],prev=v.i>0?v.path[v.i-1]:cur,total=g.ticks[cur]||1;
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
    if(sim.phase!=='night'||ended){el.textContent=sim.phase==='day'?`Requests every ${(P.demTicks(pz,sim.day)*P.TICK).toFixed(1)} s per consumer. Tap a building to inspect it.`:'';return;}
    const fresh=pz.stations.filter(s=>s.day===sim.day);
    const next=pz.stations.filter(s=>s.day===sim.day+1);
    el.innerHTML=`<b class="rp-newtag-inline">NEW TONIGHT</b> ${fresh.map(s=>`${esc(s.name)} (${s.kind==='producer'?'Makes '+sym(s.type):'Needs '+s.needs.map(sym).join(' ')})`).join(', ')}. ${next.length?`Next night: ${next.length} planned site${next.length===1?'':'s'} open; +${P.STIPEND+P.growthCredit(pz,sim.day+1)} construction credits at dusk.`:`+${P.STIPEND} construction credits at dusk.`}`;
  }
  // The dusk report: a recap that tallies into credits, then the day's three worst problems, each with Locate.
  function report(){
    const r=sim.report,el=$('rpReport');if(!r){el.hidden=true;return;}
    const d=r.summary;
    el.innerHTML=`<h3>Dusk report · day ${r.day}</h3>
      <div class="rp-tally"><span>Deliveries <b data-count="${d.deliveries}">${d.deliveries}</b></span><span>Credits earned <b data-count="${d.deliveries*P.DELIVERY_CREDIT+P.STIPEND+d.grant}">+${d.deliveries*P.DELIVERY_CREDIT+P.STIPEND+d.grant}</b> (${P.STIPEND} construction + ${d.grant} growth + deliveries)</span>
      <span>${d.clean?`Clean day <b>+${P.CLEAN_BONUS}</b>`:`<em>${d.starved.length} starved</em>: no bonus`}</span><span>Day score <b data-count="${d.score}">${d.score}</b></span></div>
      ${r.problems.length?`<ol class="rp-problems">${r.problems.map((p,i)=>`<li><span>${esc(p.text)}</span><button data-locate="${i}">Locate</button></li>`).join('')}</ol>`:'<p class="rp-allgood">No slowdowns today: the traffic flowed freely.</p>'}`;
    el.hidden=false;
    if(!reduced())el.querySelectorAll('[data-count]').forEach(b=>{const end=Number(b.dataset.count),pre=b.textContent.startsWith('+')?'+':'',t0=performance.now();
      const tickN=now=>{const k=Math.min(1,(now-t0)/700);b.textContent=pre+Math.round(end*k);if(k<1)requestAnimationFrame(tickN);};requestAnimationFrame(tickN);});
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
