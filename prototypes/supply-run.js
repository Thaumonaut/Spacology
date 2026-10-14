// Supply run UI: a walk-and-carry base drawn on one 2D canvas, with the HUD (requests, wallet, Recipes panel, clock)
// in the DOM. Rules, the planner, hints and scoring live in supply-run-model.js. This file turns the keyboard, a
// drag-anywhere joystick and taps into tick-stamped movement commands, steps the model's fixed ticks in real time
// (paused, 1× or 2×), and plays the juice: items arcing onto a wobbling back stack, coins streaming into pads,
// bouncy pop-ins, dust puffs, NEW RECIPE banners and big deliveries.
(function(){
  'use strict';
  const K=window.MiniGameKit,M=window.SupplyRun,esc=K.esc,U=M.U,I=M.ITEMS;
  const params=new URLSearchParams(location.search);
  let relaxed=params.get('relaxed')==='1';
  let pz=null,st=null,commands=[],running=false,started=false,speed=1,acc=0,lastTs=0,ending=false;
  let prev=null,highlight=null,hintInfo=null,celebrations=[],seen=new Set(),popAt={},fly=[],parts=[],floats=[],banners=[],bannerT=0;
  let keys=new Set(),keyDir=null,joy=null,lastMove=null,meterKey='',count={hints:0};
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const now=()=>performance.now();

  const shell=K.shell({id:'supply-run',difficulties:M.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),defaultDifficulty:'normal',
    rules:['<b>Walk</b>: drag anywhere on the map for a joystick, or use WASD / the arrow keys. A quick tap walks to that spot.',
      '<b>Stand on things</b>: a resource node piles items on your back; a station’s <b>IN</b> pad unloads what it needs; its <b>OUT</b> pad hands you what it made; the <b>dispatch pad</b> fills requests.',
      'Filled requests drop <b>coin piles</b> by the dispatch pad. Walk over them, then stand on a <b>price pad</b> to stream coins in and unlock a node, a station and its recipe, a bigger pack or a worker.',
      'The ladder: ore → plate, crystal → Aether cell; plate + cell → gear kit, cell + crystal → burst core; gear kit + salvage → field shield, gear kit + burst core → Weaver relay. Requests climb with it.',
      'Open <b>Recipes</b> and tap an item to see where it comes from and where it goes; tap a request card to light up its whole chain.',
      'Score is the credits you earn. <b>Perfect</b> at 85 % of the planner’s par. Pause any time; 2× speeds the shift up.'],
    onNew,onAuto,onHint});
  const stage=shell.stage;
  stage.innerHTML=`<div class="sr" id="srRoot">
    <div class="sr-top">
      <div class="sr-clock"><span>SHIFT LEFT</span><b id="srClock">0:00</b><i><u id="srClockBar"></u></i></div>
      <button id="srPlay" class="primary">Start shift</button>
      <div class="sr-speed" role="group" aria-label="Speed"><button data-speed="1" aria-pressed="true">1×</button><button data-speed="2" aria-pressed="false">2×</button></div>
      <label class="sr-relax"><input type="checkbox" id="srRelax"> Relaxed timers</label>
      <button id="srRecipesBtn" aria-expanded="false" aria-controls="srRecipes">📖 Recipes</button>
    </div>
    <section class="sr-reqs" id="srReqs" aria-label="Lieutenant requests"></section>
    <section class="sr-world" id="srWorld" aria-label="Base">
      <canvas id="srCanvas" role="img" aria-label="Base map. Drag to walk, or use WASD or the arrow keys. A quick tap walks to that spot."></canvas>
      <div class="sr-hud"><div class="sr-chip sr-coins" title="Coins in your wallet">🪙 <b id="srWallet">0</b></div><div class="sr-chip" title="Items on your back">🎒 <b id="srPack">0/8</b></div></div>
      <div class="sr-banner" id="srBanner" aria-live="polite" hidden></div>
      <aside class="sr-recipes" id="srRecipes" hidden aria-label="Recipes"></aside>
      <p class="sr-help" id="srHelp">Drag anywhere to walk · WASD / arrows · tap a spot to walk there</p>
    </section></div>`;
  const $=id=>document.getElementById(id);
  const canvas=$('srCanvas'),ctx=canvas.getContext('2d'),world=$('srWorld');
  const setText=(el,v)=>{if(el&&el.textContent!==String(v))el.textContent=v;};
  const chip=(item,extra='')=>`<span class="sr-ico ${extra}" style="--c:${I[item].color}" title="${esc(I[item].name)}">${I[item].icon}</span>`;

  // ---- lifecycle ---------------------------------------------------------------------------------------------------
  function onNew({seed,difficulty}){
    pz=M.generate(seed,difficulty,{relaxed});st=M.create(pz,{fx:true});
    commands=[];running=false;started=false;acc=0;ending=false;highlight=null;hintInfo=null;celebrations=[];seen=new Set();popAt={};
    fly=[];parts=[];floats=[];banners=[];keys.clear();keyDir=null;joy=null;lastMove=null;meterKey='';count={hints:0};
    prev=snap();cam.x=st.player.x;cam.y=st.player.y;cam.snap=true;
    $('srRelax').checked=relaxed;
    const url=new URL(location.href);if(relaxed)url.searchParams.set('relaxed','1');else url.searchParams.delete('relaxed');history.replaceState(null,'',url);
    $('srReqs').style.setProperty('--n',pz.lts.length);
    $('srReqs').innerHTML=pz.lts.map((l,i)=>`<button class="sr-req" data-lt="${i}"><header><b>${esc(l.name)}</b><small>${esc(l.front)}</small><span class="sr-pay" data-pay></span></header>
      <div class="sr-want"><span class="sr-big" data-icon></span><span class="sr-what" data-what></span></div><div class="sr-timer" data-timer><i></i></div></button>`).join('');
    buildRecipes();closeRecipes();
    shell.side(`<p class="eyebrow">PAR</p><p class="sr-side">The planner earns <b>${pz.par}</b> credits on this shift; <b>Perfect</b> from ${pz.perfectAt} (85 %), Good from ${pz.goodAt} (60 %).</p>`);
    shell.status(`Requests open in a moment. Ore vein → refinery → dispatch pad: start with plates.`);
    shell.controls({auto:true,hint:true});
    updateHud(true);
  }
  function snap(){return {p:{x:st.player.x,y:st.player.y},w:st.workers.map(w=>({x:w.x,y:w.y}))};}
  function tickOnce(){
    prev=snap();M.step(pz,st);drainFx();
    if(st.done&&!ending)end();
  }
  function advance(n){for(let i=0;i<n&&!st.done;i++)tickOnce();acc=0;updateHud();}
  function startShift(){if(!started){started=true;shell.begin();shell.log('start');}running=true;lastTs=0;updateHud();}
  function setRunning(on){if(on)startShift();else{running=false;updateHud();}}
  function end(){
    ending=true;running=false;updateHud(true);shell.controls({auto:false,hint:false});
    const ev=M.evaluate(pz,st),tier=M.tier(pz,ev);
    setTimeout(()=>shell.finish({tier,score:ev.score,headline:`${ev.filled} request${ev.filled===1?'':'s'} filled for ${ev.score} credits (Perfect from ${pz.perfectAt}, par ${pz.par}).`,
      nearMiss:M.nearMiss(pz,commands,st),stats:stats(ev),output:M.output(pz,ev)}),reduced()?0:350);
  }
  function stats(ev){
    const top=M.CRAFTED.filter(i=>ev.delivered[i]).sort((a,b)=>I[b].tier-I[a].tier)[0];
    return {Credits:`${ev.score} / par ${pz.par}`,Filled:String(ev.filled),Missed:String(ev.missed),Unlocks:`${ev.unlocks} / ${M.UNLOCK_IDS.length}`,'Best item':top?I[top].name:'none',Hints:String(count.hints)};
  }
  function onAuto(){
    const r=M.auto(pz,st);st=r.state;st.fx=[];prev=snap();running=false;ending=true;updateHud(true);
    const ev=r.evaluation;
    return {score:ev.score,headline:`The slow courier finished the shift: ${ev.filled} request${ev.filled===1?'':'s'} filled for ${ev.score} credits (par ${pz.par}).`,stats:stats(ev),output:M.output(pz,ev)};
  }
  function onHint(){
    const h=M.hint(pz,st);count.hints++;hintInfo=h.target?{...h.target,zone:h.zone,until:st.tick+120,text:h.text}:null;
    shell.status('Hint: '+h.text);
  }

  // ---- input -------------------------------------------------------------------------------------------------------
  function input(cmd){
    if(!st||st.done||ending)return 'The shift is over.';
    if(cmd.type==='move'&&lastMove&&lastMove.x===cmd.x&&lastMove.y===cmd.y&&!st.player.goto)return null;
    const err=M.apply(pz,st,cmd);
    if(err)return err;
    commands.push({tick:st.tick,cmd:{...cmd}});lastMove=cmd.type==='move'?{x:cmd.x,y:cmd.y}:null;
    return null;
  }
  const userInput=cmd=>{if(!st||st.done||ending)return;if(!running)startShift();input(cmd);$('srHelp').classList.add('sr-gone');};
  const KEYMAP={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
  function keyHeading(){
    let x=0,y=0;for(const k of keys){x+=KEYMAP[k][0];y+=KEYMAP[k][1];}
    return {x:Math.sign(x)*100,y:Math.sign(y)*100};
  }
  const typing=e=>/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||!$('mgResult').hidden;
  document.addEventListener('keydown',e=>{
    if(!(e.code in KEYMAP)||typing(e)||e.metaKey||e.ctrlKey||e.altKey)return;
    e.preventDefault();if(keys.has(e.code))return;keys.add(e.code);
    const h=keyHeading();userInput({type:'move',...h});
  });
  document.addEventListener('keyup',e=>{
    if(!(e.code in KEYMAP)||!keys.has(e.code))return;
    keys.delete(e.code);const h=keyHeading();if(st&&!st.done&&!ending)input({type:'move',...h});
  });
  window.addEventListener('blur',()=>{if(keys.size){keys.clear();if(st&&!st.done&&!ending)input({type:'move',x:0,y:0});}});
  // Drag anywhere: a virtual joystick anchored where the finger went down. 32 headings, recorded only when they change.
  canvas.addEventListener('pointerdown',e=>{
    if(joy||e.button>0)return;
    canvas.setPointerCapture?.(e.pointerId);
    const r=canvas.getBoundingClientRect();
    joy={id:e.pointerId,ox:e.clientX-r.left,oy:e.clientY-r.top,x:e.clientX-r.left,y:e.clientY-r.top,t:now(),active:false,dir:null};
  });
  canvas.addEventListener('pointermove',e=>{
    if(!joy||e.pointerId!==joy.id)return;
    const r=canvas.getBoundingClientRect();joy.x=e.clientX-r.left;joy.y=e.clientY-r.top;
    const dx=joy.x-joy.ox,dy=joy.y-joy.oy,d=Math.hypot(dx,dy);
    if(!joy.active&&d>12)joy.active=true;
    if(!joy.active)return;
    if(d<10){if(joy.dir){joy.dir=null;userInput({type:'move',x:0,y:0});}return;}
    const a=Math.round(Math.atan2(dy,dx)/(Math.PI/16))*(Math.PI/16),h={x:Math.round(Math.cos(a)*100),y:Math.round(Math.sin(a)*100)};
    if(!joy.dir||joy.dir.x!==h.x||joy.dir.y!==h.y){joy.dir=h;userInput({type:'move',...h});}
  });
  const joyEnd=e=>{
    if(!joy||e.pointerId!==joy.id)return;
    const j=joy;joy=null;
    if(j.active){if(st&&!st.done&&!ending)input({type:'move',x:0,y:0});return;}
    if(e.type==='pointercancel'||now()-j.t>450)return;
    const w=toWorld(j.ox,j.oy);userInput({type:'goto',x:Math.round(w.x),y:Math.round(w.y)});
    floats.push({x:w.x,y:w.y,text:'•',color:'#a5e0c9',t:now(),ring:true});
  };
  canvas.addEventListener('pointerup',joyEnd);canvas.addEventListener('pointercancel',joyEnd);

  // ---- toolbar, requests, recipes ----------------------------------------------------------------------------------
  $('srPlay').onclick=()=>{if(ending||!st||st.done)return;setRunning(!running);};
  stage.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{speed=Number(b.dataset.speed);stage.querySelectorAll('[data-speed]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
  $('srRelax').onchange=e=>{relaxed=e.target.checked;shell.start();};
  $('srRecipesBtn').onclick=()=>{$('srRecipes').hidden?openRecipes():closeRecipes();};
  $('srReqs').addEventListener('click',e=>{
    const b=e.target.closest('[data-lt]');if(!b)return;const r=st.lts[Number(b.dataset.lt)].req;if(!r)return;
    showChain(r.item);
  });
  function showChain(item){
    if(highlight&&highlight.mode==='chain'&&highlight.item===item){clearHighlight();return;}
    const c=M.chain(item);
    highlight={mode:'chain',item,zones:c.zones.map(z=>({zone:z,role:z==='dispatch'?'use':'chain'}))};
    const steps=c.steps.map(s=>`${Object.keys(s.in).map(k=>I[k].icon).join(' + ')} → ${I[s.out].icon} at the ${M.STATIONS[s.station].name}${st.unlocked[s.station]?'':' (locked)'}`);
    shell.status(`${I[item].icon} ${I[item].name} chain: ${c.nodes.map(n=>M.NODES[n].name+(st.unlocked[n]?'':' (locked)')).join(', ')}; ${steps.join('; ')}; then the dispatch pad.`);
    markHighlight();
  }
  function showItem(item){
    if(highlight&&highlight.mode==='item'&&highlight.item===item){clearHighlight();return;}
    const from=M.sources(item),to=M.uses(item);
    highlight={mode:'item',item,zones:from.map(z=>({zone:z,role:'from'})).concat(to.map(z=>({zone:z,role:'use'})))};
    const name=z=>M.zoneName(z).replace(/^the /,'');
    shell.status(`${I[item].icon} ${I[item].name}: comes from ${from.map(name).join(', ')}; used at ${to.map(name).join(', ')}.`);
    markHighlight();
  }
  function clearHighlight(){highlight=null;markHighlight();shell.status('');}
  function markHighlight(){
    stage.querySelectorAll('[data-item]').forEach(b=>b.classList.toggle('sr-on',!!highlight&&b.dataset.item===highlight.item));
    stage.querySelectorAll('[data-lt]').forEach(b=>{const r=st.lts[Number(b.dataset.lt)].req;b.classList.toggle('sr-on',!!highlight&&highlight.mode==='chain'&&!!r&&r.item===highlight.item);});
  }
  function buildRecipes(){
    const row=s=>{const R=M.STATIONS[s];return `<li data-station="${s}"><span class="sr-rin">${Object.entries(R.in).map(([k,n])=>`<button class="sr-ibtn" data-item="${k}">${chip(k)}${n>1?`<small>×${n}</small>`:''}</button>`).join('<i>+</i>')}</span><i>→</i>
      <button class="sr-ibtn" data-item="${R.out}">${chip(R.out)}</button><span class="sr-rname"><b>${esc(I[R.out].name)}</b><small data-lock>${esc(R.name)}</small></span></li>`;};
    const tiers=[1,2,3].map(t=>`<p class="eyebrow">TIER ${t}</p><ul>${M.STATION_IDS.filter(s=>I[M.STATIONS[s].out].tier===t).map(row).join('')}</ul>`).join('');
    $('srRecipes').innerHTML=`<header><b>Recipes</b><button id="srRecipesClose" aria-label="Close recipes">✕</button></header>
      <p class="eyebrow">RESOURCE NODES</p><ul>${M.NODE_IDS.map(n=>`<li data-node="${n}"><button class="sr-ibtn" data-item="${M.NODES[n].item}">${chip(M.NODES[n].item)}</button><span class="sr-rname"><b>${esc(I[M.NODES[n].item].name)}</b><small data-lock>${esc(M.NODES[n].name)}</small></span></li>`).join('')}</ul>${tiers}
      <p class="sr-rtip">Tap an item to light up where it comes from (gold) and where it goes (green).</p>`;
    $('srRecipesClose').onclick=closeRecipes;
    $('srRecipes').querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>showItem(b.dataset.item));
    refreshRecipes();
  }
  function refreshRecipes(){
    $('srRecipes').querySelectorAll('li').forEach(li=>{
      const key=li.dataset.station||li.dataset.node,open=!!st.unlocked[key],u=M.UNLOCK_IDS.find(x=>M.UNLOCKS[x].target===key);
      li.classList.toggle('sr-locked',!open);
      const name=li.dataset.station?M.STATIONS[key].name:M.NODES[key].name;
      setText(li.querySelector('[data-lock]'),open?name:`🔒 ${name}${u?` · ${M.UNLOCKS[u].price-st.paid[u]} 🪙`:''}`);
    });
  }
  function openRecipes(){$('srRecipes').hidden=false;$('srRecipesBtn').setAttribute('aria-expanded','true');refreshRecipes();}
  function closeRecipes(){$('srRecipes').hidden=true;$('srRecipesBtn').setAttribute('aria-expanded','false');}

  // ---- HUD ---------------------------------------------------------------------------------------------------------
  function updateHud(force){
    const ev=M.evaluate(pz,st);
    const key=[ev.score,ev.filled,pz.par].join('|');
    if(force||key!==meterKey){meterKey=key;shell.meters([{label:'Credits',value:ev.score,tone:ev.score>=pz.perfectAt?'good':''},{label:'Perfect',value:pz.perfectAt},{label:'Par',value:pz.par},{label:'Filled',value:ev.filled}]);}
    const leftT=pz.shiftTicks-st.tick;
    setText($('srClock'),M.clock(leftT));$('srClockBar').style.width=(leftT/pz.shiftTicks*100).toFixed(2)+'%';
    setText($('srPlay'),st.done||ending?'Shift over':!started?'Start shift':running?'Pause':'Resume');
    $('srPlay').disabled=st.done||ending;
    setText($('srWallet'),st.wallet);setText($('srPack'),`${st.player.stack.length}/${st.cap}`);
    $('srPack').parentElement.classList.toggle('sr-full',st.player.stack.length>=st.cap);
    st.lts.forEach((L,i)=>{
      const card=$('srReqs').children[i],r=L.req;if(!card)return;
      card.classList.toggle('sr-open',!!r);
      const icon=card.querySelector('[data-icon]'),what=card.querySelector('[data-what]'),pay=card.querySelector('[data-pay]'),bar=card.querySelector('[data-timer] i'),tm=card.querySelector('[data-timer]');
      if(r){
        const k=r.item+r.qty;if(icon.dataset.k!==k){icon.dataset.k=k;icon.innerHTML=chip(r.item,'sr-ico-lg');card.style.setProperty('--c',I[r.item].color);card.dataset.tier=I[r.item].tier;}
        setText(what,`${r.got}/${r.qty} ${r.qty===1?I[r.item].name:I[r.item].plural.replace(/^./,c=>c.toUpperCase())}`);
        setText(pay,`+${r.reward} 🪙`);
        const f=Math.max(0,(r.deadline-st.tick)/r.duration);bar.style.width=(f*100).toFixed(1)+'%';bar.dataset.tone=f<0.25?'bad':f<0.5?'warn':'';
        tm.dataset.left=M.sec(r.deadline-st.tick)+' s';
      }else{
        if(icon.dataset.k!==''){icon.dataset.k='';icon.innerHTML='<span class="sr-ico sr-ico-lg sr-wait">⏳</span>';card.dataset.tier='0';}
        setText(what,st.done?'Shift over':`Next order in ${Math.max(0,M.sec(L.readyAt-st.tick))} s`);setText(pay,'');bar.style.width='0%';tm.dataset.left='';
      }
    });
    if(!$('srRecipes').hidden)refreshRecipes();
  }

  // ---- events → juice ----------------------------------------------------------------------------------------------
  const zpos=z=>{const Z=M.ZONE[z];return Z?{x:Z.x,y:Z.y}:{x:st.player.x,y:st.player.y};};
  function who(id){if(id==='player'||!id)return st.player;return st.workers.find(w=>w.id===id)||st.player;}
  function drainFx(){
    if(!st.fx||!st.fx.length)return;
    const list=st.fx.splice(0);const t=now();
    for(const e of list){
      const fast=reduced();
      switch(e.type){
        case 'gather':case 'pickup':{
          const a=who(e.who);
          if(!fast)fly.push({item:e.item,from:zpos(e.zone),to:a,t,dur:260,land:a===st.player});
          if(e.who==='player'&&e.type==='gather'){const k=e.zone.split(':')[1];if(!seen.has(k))seen.add(k);}
          break;}
        case 'load':{const a=who(e.who);if(!fast)fly.push({item:e.item,from:{x:a.x,y:a.y-900},to:zpos(e.zone),t,dur:240});break;}
        case 'deliver':if(!fast)fly.push({item:e.item,from:{x:st.player.x,y:st.player.y-900},to:zpos('dispatch'),t,dur:260});break;
        case 'scrap':if(!fast)fly.push({item:e.item,from:{x:st.player.x,y:st.player.y-900},to:zpos('bin'),t,dur:240});break;
        case 'coins':floats.push({x:e.x,y:e.y,text:`+${e.n} 🪙`,color:'#f2d36b',t});burst(e.x,e.y,'#f2d36b',10);break;
        case 'pay':if(!fast)fly.push({coin:true,from:{x:st.player.x,y:st.player.y-600},to:zpos('unlock:'+e.id),t,dur:220});break;
        case 'unlock':{
          const Ul=M.UNLOCKS[e.id];popAt[e.id]=t;if(Ul.target)popAt[Ul.target]=t;
          burst(Ul.x,Ul.y,'#a5e0c9',22);puff(Ul.x,Ul.y,10);
          if(Ul.kind!=='station')banner(`<small>UNLOCKED</small><b>${esc(Ul.name)}</b>${Ul.kind==='worker'?`<span>${esc(M.JOBS[Ul.job].name)}: ${esc(jobText(Ul.job))}</span>`:Ul.kind==='pack'?`<span>Carry ${Ul.cap} items</span>`:`<span>Gives ${chip(M.NODES[Ul.target].item)} ${esc(I[M.NODES[Ul.target].item].plural)}</span>`}`,'');
          celebrations.push({type:'unlock',id:e.id,tick:e.tick});refreshRecipes();
          shell.status(`Unlocked: ${Ul.name}.`,'good');break;}
        case 'recipe':{
          const R=M.STATIONS[e.station];
          banner(`<small>NEW RECIPE</small><div class="sr-bline">${Object.entries(R.in).map(([k,n])=>chip(k)+(n>1?`<small>×${n}</small>`:'')).join('<i>+</i>')}<i>→</i>${chip(R.out,'sr-ico-lg')}</div><b>${esc(I[R.out].name)}</b><span>at the ${esc(R.name)}</span>`,'sr-banner-recipe');
          celebrations.push({type:'recipe',item:e.item,station:e.station,tick:e.tick});break;}
        case 'fill':{
          const d=zpos('dispatch');floats.push({x:d.x,y:d.y-1600,text:`+${e.reward}`,color:'#f2d36b',t,big:e.tier>=2});
          burst(d.x,d.y,I[e.item].color,e.tier>=3?60:e.tier>=2?34:12);
          if(e.tier>=2)banner(`<small>${e.tier>=3?'TOP-TIER DELIVERY':'DELIVERED'}</small><div class="sr-bline">${chip(e.item,'sr-ico-lg')}</div><b>${e.qty} ${esc(e.qty===1?I[e.item].name:I[e.item].plural)} for ${esc(pz.lts[e.lt].name)}</b><span>+${e.reward} credits</span>`,e.tier>=3?'sr-banner-gold':'sr-banner-big');
          celebrations.push({type:'fill',item:e.item,tier:e.tier,reward:e.reward,tick:e.tick});
          const card=$('srReqs').children[e.lt];if(card){stamp(card,'FILLED','filled');}
          break;}
        case 'miss':{const card=$('srReqs').children[e.lt];if(card)stamp(card,'MISSED','missed');break;}
        case 'open':{const card=$('srReqs').children[e.lt];if(card)shell.flash(card);break;}
        case 'made':break;
      }
    }
  }
  function jobText(job){return M.JOBS[job].stops.map(s=>M.zoneName(s.z).replace(/^the /,'')).join(' → ');}
  function stamp(card,text,kind){
    card.querySelector('.sr-stamp')?.remove();
    const s=document.createElement('span');s.className='sr-stamp sr-stamp-'+kind;s.textContent=text;card.appendChild(s);setTimeout(()=>s.remove(),1100);
  }
  function banner(html,cls){banners.push({html,cls});if(banners.length>3)banners.splice(1,banners.length-3);if(banners.length===1)showBanner();}
  function showBanner(){
    const b=banners[0],el=$('srBanner');if(!b){el.hidden=true;return;}
    el.className='sr-banner '+(b.cls||'');el.innerHTML=b.html;el.hidden=false;shell.flash(el,'sr-bannerpop');
    clearTimeout(bannerT);bannerT=setTimeout(()=>{banners.shift();showBanner();},banners.length>2?900:1900);
  }
  // Particles move in world units per second; z is height above the ground with gravity for confetti.
  function burst(x,y,color,n){if(reduced())return;for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=0.8+Math.random()*2.2;parts.push({x,y,z:0.6,vx:Math.cos(a)*v,vy:Math.sin(a)*v*0.6,vz:3+Math.random()*4,g:9,color,t:now(),life:800+Math.random()*500,kind:'confetti'});}}
  function puff(x,y,n){if(reduced())return;for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2;parts.push({x:x+Math.cos(a)*600,y:y+Math.sin(a)*300,z:0,vx:Math.cos(a)*0.9,vy:Math.sin(a)*0.45,vz:0.5,g:0,color:'#c9d6c7',t:now(),life:500+Math.random()*300,kind:'dust'});}}

  // ---- camera and drawing ------------------------------------------------------------------------------------------
  const cam={x:0,y:0,s:40,W:0,H:0,dpr:1};
  function resize(){
    const r=world.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
    const W=Math.max(200,Math.round(r.width)),H=Math.max(200,Math.round(r.height));
    if(W!==cam.W||H!==cam.H||dpr!==cam.dpr){cam.W=W;cam.H=H;cam.dpr=dpr;canvas.width=W*dpr;canvas.height=H*dpr;}
    cam.s=Math.max(28,Math.min(56,Math.min(W/19,H/11.5)));
  }
  const sx=x=>(x-cam.x)/U*cam.s+cam.W/2,sy=y=>(y-cam.y)/U*cam.s+cam.H/2,px=u=>u*cam.s;
  function toWorld(x,y){return {x:Math.min(M.MAP.w,Math.max(0,(x-cam.W/2)/cam.s*U+cam.x)),y:Math.min(M.MAP.h,Math.max(0,(y-cam.H/2)/cam.s*U+cam.y))};}
  const iconCache=new Map();
  function icon(emoji,size){
    const k=emoji+'|'+Math.round(size*cam.dpr);let c=iconCache.get(k);
    if(!c){const s=Math.max(8,Math.round(size*cam.dpr*1.25));c=document.createElement('canvas');c.width=c.height=s;const g=c.getContext('2d');
      g.font=`${Math.round(s*0.8)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(emoji,s/2,s/2+s*0.04);iconCache.set(k,c);}
    return c;
  }
  function drawIcon(emoji,x,y,size){const c=icon(emoji,size);ctx.drawImage(c,x-size*0.625,y-size*0.625,size*1.25,size*1.25);}
  // One consistent token per item: a disc in the item's colour with its icon, used on the map, the stack and the HUD.
  function token(item,x,y,size,alpha){
    const it=I[item];ctx.globalAlpha=alpha??1;
    ctx.fillStyle=it.color;ctx.beginPath();roundRect(x-size/2,y-size/2,size,size,size*0.28);ctx.fill();
    ctx.fillStyle='#0b151c55';ctx.fillRect(x-size/2+size*0.12,y+size*0.26,size*0.76,size*0.12);
    drawIcon(it.icon,x,y-size*0.03,size*0.74);ctx.globalAlpha=1;
  }
  function roundRect(x,y,w,h,r){ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function shadow(x,y,rx,ry,a){ctx.fillStyle=`rgba(0,0,0,${a??0.32})`;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  const easeBack=t=>{const c=1.7;t=Math.min(1,Math.max(0,t));return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
  const pop=(key,t)=>popAt[key]?easeBack((t-popAt[key])/480):1;
  function label(text,x,y,size,color,bg){
    ctx.font=`700 ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    if(bg){const w=ctx.measureText(text).width+size*0.9;ctx.fillStyle=bg;ctx.beginPath();roundRect(x-w/2,y-size*0.8,w,size*1.6,size*0.8);ctx.fill();}
    ctx.fillStyle=color||'#edf1ef';ctx.fillText(text,x,y+size*0.04);
  }

  function render(t){
    resize();
    const alpha=running?Math.min(1,acc/M.TICK_MS):1,P_=st.player;
    const lerp=(a,b)=>a+(b-a)*alpha;
    const pl={x:lerp(prev.p.x,P_.x),y:lerp(prev.p.y,P_.y)};
    // Camera follows the player, clamped to the map (centred when the view is bigger than the map).
    const vw=cam.W/cam.s*U,vh=cam.H/cam.s*U,clamp=(v,size,view)=>view>=size?size/2:Math.min(size-view/2,Math.max(view/2,v));
    const tx=clamp(pl.x,M.MAP.w,vw),ty=clamp(pl.y,M.MAP.h,vh);
    const k=cam.snap?1:0.25;cam.snap=false;cam.x+=(tx-cam.x)*k;cam.y+=(ty-cam.y)*k;if(Math.abs(tx-cam.x)<2)cam.x=tx;if(Math.abs(ty-cam.y)<2)cam.y=ty;
    ctx.setTransform(cam.dpr,0,0,cam.dpr,0,0);
    drawGround(t);
    drawFlows(t);
    drawHighlight(t,false);
    drawHint(t,pl);
    // y-sorted world objects
    const objs=[];
    for(const id of M.NODE_IDS)if(st.unlocked[id])objs.push({y:M.NODES[id].y,f:()=>drawNode(id,t)});
    for(const id of M.STATION_IDS)if(st.unlocked[id])objs.push({y:M.STATIONS[id].y,f:()=>drawStation(id,t)});
    for(const u of M.UNLOCK_IDS)if(M.padVisible(st,u))objs.push({y:M.UNLOCKS[u].y-1,f:()=>drawPad(u,t)});
    objs.push({y:M.DISPATCH.y-1,f:()=>drawDispatch(t)});objs.push({y:M.BIN.y,f:()=>drawBin()});
    for(const c of st.piles)objs.push({y:c.y-500,f:()=>drawPile(c,t)});
    st.workers.forEach((w,i)=>{const p0=prev.w[i]||w;objs.push({y:w.y,f:()=>drawWorker(w,{x:lerp(p0.x,w.x),y:lerp(p0.y,w.y)},t)});});
    objs.push({y:pl.y,f:()=>drawPlayer(pl,t)});
    objs.sort((a,b)=>a.y-b.y).forEach(o=>o.f());
    drawHighlight(t,true);
    drawFly(t,pl);drawParts(t);drawFloats(t);drawOffscreen(t,pl);drawJoystick();
  }
  function drawGround(t){
    ctx.fillStyle='#0b141a';ctx.fillRect(0,0,cam.W,cam.H);
    const x0=sx(0),y0=sy(0),x1=sx(M.MAP.w),y1=sy(M.MAP.h);
    const g=ctx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'#17262b');g.addColorStop(1,'#132026');
    ctx.fillStyle=g;ctx.fillRect(x0,y0,x1-x0,y1-y0);
    ctx.strokeStyle='#2b3d4c';ctx.lineWidth=2;ctx.strokeRect(x0,y0,x1-x0,y1-y0);
    // cleared ground grows around everything unlocked
    const clear=[[M.START.x,M.START.y,5],[M.DISPATCH.x,M.DISPATCH.y,5]];
    for(const id of M.NODE_IDS)if(st.unlocked[id])clear.push([M.NODES[id].x,M.NODES[id].y,3.6,id]);
    for(const id of M.STATION_IDS)if(st.unlocked[id])clear.push([M.STATIONS[id].x,M.STATIONS[id].y,4.4,id]);
    for(const [x,y,r,k] of clear){
      const R=px(r)*(k?Math.min(1,pop(k,t)):1),cx=sx(x),cy=sy(y);if(R<=0)continue;
      const gr=ctx.createRadialGradient(cx,cy,R*0.2,cx,cy,R);gr.addColorStop(0,'#2a4340');gr.addColorStop(0.7,'#22383a');gr.addColorStop(1,'#22383a00');
      ctx.fillStyle=gr;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fill();
    }
    // dots every 2 units, only those on screen
    ctx.fillStyle='#ffffff12';
    const a=Math.max(0,Math.floor((cam.x-cam.W/2/cam.s*U)/(2*U))),b=Math.min(20,Math.ceil((cam.x+cam.W/2/cam.s*U)/(2*U)));
    const c=Math.max(0,Math.floor((cam.y-cam.H/2/cam.s*U)/(2*U))),d=Math.min(13,Math.ceil((cam.y+cam.H/2/cam.s*U)/(2*U)));
    for(let i=a;i<=b;i++)for(let j=c;j<=d;j++){ctx.fillRect(sx(i*2*U)-1,sy(j*2*U)-1,2,2);}
    // rocks for texture, fixed positions
    ctx.fillStyle='#0c171d88';
    for(const [x,y,r] of ROCKS){ctx.beginPath();ctx.ellipse(sx(x*U),sy(y*U),px(r),px(r*0.5),0,0,Math.PI*2);ctx.fill();}
  }
  const ROCKS=[[6,2,.6],[14,1.6,.4],[26,2.2,.7],[35,8.5,.5],[38,20,.6],[25,23.5,.8],[14,23,.5],[2,12.5,.5],[8,22.5,.7],[33,15.5,.4],[17,18.5,.3],[28.5,12,.4]];
  // Faint dashed lines from every source to the station input that takes it.
  function drawFlows(t){
    ctx.lineWidth=Math.max(2,px(0.12));ctx.setLineDash([px(0.3),px(0.25)]);ctx.lineDashOffset=-(t/40)%1000;
    for(const s of M.STATION_IDS){
      if(!st.unlocked[s])continue;
      const inZ=M.ZONE['in:'+s];
      for(const item of Object.keys(M.STATIONS[s].in)){
        const src=M.sources(item)[0];if(!src||!M.zoneActive(st,src))continue;
        const Z=M.ZONE[src];ctx.strokeStyle=I[item].color+'40';
        ctx.beginPath();ctx.moveTo(sx(Z.x),sy(Z.y));ctx.lineTo(sx(inZ.x),sy(inZ.y));ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }
  function zoneRing(z,color,t,r){
    const Z=M.ZONE[z];if(!Z)return;
    const k=1+0.08*Math.sin(t/180),R=px((r||Z.r)/U)*k;
    ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(sx(Z.x),sy(Z.y),R,R*0.62,0,0,Math.PI*2);ctx.stroke();
  }
  function drawHighlight(t,top){
    if(!highlight)return;
    for(const h of highlight.zones){
      const color=h.role==='from'?'#f2d36b':h.role==='use'?'#a5e0c9':'#92b9e4';
      if(!top){zoneRing(h.zone,color,t);continue;}
      const Z=M.ZONE[h.zone];const tag=h.role==='from'?'FROM':h.role==='use'?'USED':'';
      if(tag)label(tag,sx(Z.x),sy(Z.y)+px(Z.r/U*0.62)+12,11,'#0b141a',color);
    }
  }
  function drawHint(t,pl){
    if(!hintInfo)return;
    if(st.tick>hintInfo.until||(hintInfo.zone&&st.player.zone===hintInfo.zone)){hintInfo=null;return;}
    const ax=sx(pl.x),ay=sy(pl.y),bx=sx(hintInfo.x),by=sy(hintInfo.y),d=Math.hypot(bx-ax,by-ay);
    if(hintInfo.zone)zoneRing(hintInfo.zone,'#e7c18b',t);
    if(d<px(1.2))return;
    const ux=(bx-ax)/d,uy=(by-ay)/d,step=px(0.9),off=(t/12)%step;
    ctx.fillStyle='#e7c18bcc';
    for(let s=px(0.9)+off;s<d-px(0.9);s+=step){
      const x=ax+ux*s,y=ay+uy*s,w=px(0.22);
      ctx.beginPath();ctx.moveTo(x+ux*w,y+uy*w);ctx.lineTo(x-ux*w-uy*w,y-uy*w+ux*w);ctx.lineTo(x-ux*w*0.3,y-uy*w*0.3);ctx.lineTo(x-ux*w+uy*w,y-uy*w-ux*w);ctx.closePath();ctx.fill();
    }
  }
  function drawNode(id,t){
    const N=M.NODES[id],k=pop(id,t),x=sx(N.x),y=sy(N.y),it=I[N.item];
    ctx.save();ctx.translate(x,y);ctx.scale(k,k);
    ctx.fillStyle=it.color+'22';ctx.strokeStyle=it.color+'88';ctx.lineWidth=2;ctx.setLineDash([6,5]);
    ctx.beginPath();ctx.ellipse(0,0,px(N.r/U),px(N.r/U)*0.62,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
    for(const [ox,oy,r] of [[-0.5,0.1,0.55],[0.45,-0.1,0.45],[0,0.35,0.4],[0.1,-0.35,0.35]]){
      shadow(px(ox),px(oy+0.18),px(r),px(r*0.4),0.25);
      ctx.fillStyle=it.color;ctx.beginPath();ctx.moveTo(px(ox-r),px(oy+0.15));ctx.lineTo(px(ox-r*0.4),px(oy-r));ctx.lineTo(px(ox+r*0.5),px(oy-r*0.7));ctx.lineTo(px(ox+r),px(oy+0.15));ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffffff30';ctx.beginPath();ctx.moveTo(px(ox-r*0.4),px(oy-r));ctx.lineTo(px(ox+r*0.5),px(oy-r*0.7));ctx.lineTo(px(ox+0.05),px(oy-r*0.2));ctx.closePath();ctx.fill();
    }
    // big floating icon of what it gives
    const bob=Math.sin(t/300+N.x)*px(0.12);
    shadow(0,px(-0.2),px(0.5),px(0.15),0.15);
    ctx.fillStyle='#0b141acc';ctx.beginPath();ctx.arc(0,px(-1.85)+bob,px(0.62),0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=it.color;ctx.lineWidth=3;ctx.stroke();
    drawIcon(it.icon,0,px(-1.85)+bob,px(0.8));
    if(!seen.has(id)){label(`${N.name} → ${it.name}`,0,px(-2.9)+bob,Math.max(11,px(0.3)),'#0b141a',it.color);}
    ctx.restore();
  }
  function drawStation(id,t){
    const R=M.STATIONS[id],S=st.stations[id],k=pop(id,t),x=sx(R.x),y=sy(R.y),col=I[R.out].color;
    const inZ=M.ZONE['in:'+id],outZ=M.ZONE['out:'+id];
    ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.translate(-x,-y);
    // pads
    for(const [Z,tag,c] of [[inZ,'IN','#92b9e4'],[outZ,'OUT',col]]){
      const zx=sx(Z.x),zy=sy(Z.y),w=px(1.5),h=px(1.0),here=st.player.zone===Z.id;
      ctx.fillStyle=here?c+'55':c+'26';ctx.strokeStyle=c;ctx.lineWidth=here?3:2;ctx.beginPath();roundRect(zx-w/2,zy-h/2,w,h,px(0.2));ctx.fill();ctx.stroke();
      label(tag,zx,zy+h/2+px(0.22),Math.max(9,px(0.22)),c);
    }
    // hopper contents on the IN pad
    const ins=Object.keys(R.in);
    ins.forEach((item,i)=>{const n=S.in[item];for(let j=0;j<Math.min(n,6);j++)token(item,sx(inZ.x)+px(-0.35+i*0.7),sy(inZ.y)+px(0.15)-j*px(0.13),px(0.42));});
    // finished goods piled on the OUT pad
    for(let j=0;j<S.out;j++)token(R.out,sx(outZ.x)+px((j%3-1)*0.36),sy(outZ.y)+px(0.18)-Math.floor(j/3)*px(0.2),px(0.42));
    // building
    const bw=px(2.2),bh=px(1.5);
    shadow(x+px(0.15),y+px(0.62),bw*0.58,px(0.32),0.35);
    ctx.fillStyle='#1d2f3a';ctx.beginPath();roundRect(x-bw/2,y-bh/2,bw,bh,px(0.18));ctx.fill();
    ctx.fillStyle=col;ctx.beginPath();roundRect(x-bw/2,y-bh/2,bw,px(0.34),px(0.18));ctx.fill();
    ctx.strokeStyle='#2b3d4c';ctx.lineWidth=2;ctx.beginPath();roundRect(x-bw/2,y-bh/2,bw,bh,px(0.18));ctx.stroke();
    if(S.busy>0){const f=1-S.busy/R.ticks;ctx.fillStyle='#0b141a';ctx.fillRect(x-bw*0.38,y+px(0.25),bw*0.76,px(0.16));ctx.fillStyle=col;ctx.fillRect(x-bw*0.38,y+px(0.25),bw*0.76*f,px(0.16));
      if(!reduced()&&Math.random()<0.05)parts.push({x:R.x+U*0.6,y:R.y-U*0.6,z:0.4,vx:0.2,vy:-0.3,vz:0.8,g:0,color:'#c9d6c7',t:now(),life:700,kind:'dust'});}
    drawIcon(I[R.out].icon,x,y-px(0.05),px(0.62));
    label(R.name,x,y-bh/2-px(0.25),Math.max(10,px(0.24)),'#a6b4bc');
    // recipe sign: inputs with load counters → output
    const fs=Math.max(10,px(0.26)),tk=px(0.46),gap=px(0.12);
    const partsW=ins.map(item=>tk+gap+fs*2.1);const signW=partsW.reduce((a,b)=>a+b,0)+ (ins.length-1)*fs*0.9+fs*1.4+tk+px(0.4);
    const sy0=y-bh/2-px(1.05);
    ctx.fillStyle='#0b141add';ctx.strokeStyle=col+'aa';ctx.lineWidth=1.5;ctx.beginPath();roundRect(x-signW/2,sy0-px(0.36),signW,px(0.72),px(0.2));ctx.fill();ctx.stroke();
    let cx=x-signW/2+px(0.2);
    ctx.textBaseline='middle';ctx.textAlign='left';
    ins.forEach((item,i)=>{
      if(i){ctx.fillStyle='#a6b4bc';ctx.font=`700 ${fs}px system-ui`;ctx.fillText('+',cx,sy0);cx+=fs*0.9;}
      token(item,cx+tk/2,sy0,tk);cx+=tk+gap;
      const need=R.in[item],have=S.in[item];ctx.font=`700 ${fs}px system-ui`;ctx.fillStyle=have>=need?'#a5e0c9':'#edf1ef';
      ctx.fillText(`${Math.min(have,need)}/${need}`,cx,sy0);cx+=fs*2.1;
    });
    ctx.fillStyle='#e7c18b';ctx.fillText('→',cx,sy0);cx+=fs*1.4;token(R.out,cx+tk/2,sy0,tk);
    ctx.restore();
  }
  function drawPad(u,t){
    const Ul=M.UNLOCKS[u],k=pop('pad-'+u,t),x=sx(Ul.x),y=sy(Ul.y),w=px(2),left=Ul.price-st.paid[u],here=st.player.zone==='unlock:'+u;
    const afford=st.wallet>=left;
    ctx.save();ctx.translate(x,y);
    const pulse=afford?1+0.04*Math.sin(t/160):1;ctx.scale(pulse,pulse);
    ctx.fillStyle=here?'#e7c18b33':'#0b141a99';ctx.strokeStyle=afford?'#f2d36b':'#e7c18b88';ctx.lineWidth=here?3:2;ctx.setLineDash([7,5]);
    ctx.beginPath();roundRect(-w/2,-w*0.36,w,w*0.72,px(0.25));ctx.fill();ctx.stroke();ctx.setLineDash([]);
    const f=st.paid[u]/Ul.price;if(f>0){ctx.fillStyle='#f2d36b44';ctx.beginPath();roundRect(-w/2,w*0.36-w*0.72*f,w,w*0.72*f,px(0.2));ctx.fill();}
    const gives=Ul.kind==='node'?M.NODES[Ul.target].item:Ul.kind==='station'?M.STATIONS[Ul.target].out:null;
    if(gives)token(gives,-px(0.45),-px(0.02),px(0.6));else drawIcon(Ul.kind==='pack'?'🎒':'🤖',-px(0.45),-px(0.02),px(0.6));
    ctx.textAlign='left';ctx.textBaseline='middle';ctx.font=`800 ${Math.max(11,px(0.34))}px system-ui`;ctx.fillStyle='#f2d36b';ctx.fillText(String(left),px(0.0),-px(0.02));
    drawIcon('🪙',px(0.1)+ctx.measureText(String(left)).width+px(0.22),-px(0.02),px(0.32));
    ctx.restore();
    const what=Ul.kind==='station'?`${Ul.name}: ${Object.keys(M.STATIONS[Ul.target].in).map(i=>I[i].icon).join('+')}→${I[M.STATIONS[Ul.target].out].icon}`:Ul.kind==='worker'?`Hire ${Ul.name}`:Ul.kind==='pack'?`${Ul.name} (${Ul.cap})`:`${Ul.name}`;
    label(what,x,y-w*0.36-px(0.32),Math.max(10,px(0.26)),'#edf1ef','#0b141acc');
  }
  function drawDispatch(t){
    const D=M.DISPATCH,x=sx(D.x),y=sy(D.y),r=px(D.r/U),here=st.player.zone==='dispatch';
    ctx.fillStyle=here?'#a5e0c944':'#a5e0c91a';ctx.strokeStyle='#a5e0c9';ctx.lineWidth=here?4:2.5;
    ctx.beginPath();ctx.ellipse(x,y,r,r*0.62,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#a5e0c955';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,r*0.62,r*0.38,0,0,Math.PI*2);ctx.stroke();
    drawIcon('🚀',x,y-px(0.15)+Math.sin(t/260)*px(0.06),px(0.8));
    label('DISPATCH',x,y+r*0.62+px(0.28),Math.max(10,px(0.26)),'#a5e0c9');
  }
  function drawBin(){const B=M.BIN,x=sx(B.x),y=sy(B.y),r=px(B.r/U);ctx.fillStyle='#f0a08c1a';ctx.strokeStyle='#f0a08c88';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,r,r*0.62,0,0,Math.PI*2);ctx.fill();ctx.stroke();drawIcon('🗑️',x,y-px(0.1),px(0.55));label('SCRAP',x,y+r*0.62+px(0.22),Math.max(9,px(0.2)),'#f0a08c');}
  function drawPile(c,t){
    const x=sx(c.x),y=sy(c.y),n=Math.min(8,2+Math.floor(c.n/8)),k=1+0.05*Math.sin(t/200+c.x);
    shadow(x,y+px(0.1),px(0.5),px(0.18));
    for(let i=0;i<n;i++){const ox=((i*37)%5-2)*px(0.09),oy=-i*px(0.09);ctx.fillStyle='#b8902f';ctx.beginPath();ctx.ellipse(x+ox,y+oy+px(0.04),px(0.27)*k,px(0.12)*k,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f2d36b';ctx.beginPath();ctx.ellipse(x+ox,y+oy,px(0.27)*k,px(0.12)*k,0,0,Math.PI*2);ctx.fill();}
    label(`${c.n}`,x,y-n*px(0.09)-px(0.35),Math.max(10,px(0.26)),'#f2d36b');
  }
  const sway={p:0,v:0,lastX:0};
  function drawStack(stack,x,baseY,size,t,swayV,hide){
    const n=stack.length-(hide||0),gap=size*0.62;
    for(let i=0;i<n;i++){
      const f=i/Math.max(6,n);const off=swayV*i*i*gap*0.012+(reduced()?0:Math.sin(t/260+i*0.5)*i*0.35*f);
      token(stack[i],x+off,baseY-i*gap,size);
    }
  }
  function drawPlayer(pl,t){
    const x=sx(pl.x),y=sy(pl.y),p=st.player,moving=p.vx||p.vy||p.goto;
    // the stack sways against the walking direction and springs back
    const target=moving?-(p.vx||0)/M.SPEED*1.2:0;sway.v+=(target-sway.p)*0.12;sway.v*=0.8;sway.p+=sway.v;
    const hop=moving&&!reduced()?Math.abs(Math.sin(t/90))*px(0.08):0;
    if(moving&&!reduced()&&Math.random()<0.18)parts.push({x:pl.x,y:pl.y+250,z:0,vx:(Math.random()-0.5)*0.6,vy:-0.2,vz:0.3,g:0,color:'#c9d6c7',t:now(),life:450,kind:'dust'});
    shadow(x,y+px(0.05),px(0.42),px(0.16),0.4);
    ctx.fillStyle='#a5e0c9';ctx.beginPath();ctx.ellipse(x,y-px(0.35)-hop,px(0.32),px(0.38),0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#edf1ef';ctx.beginPath();ctx.arc(x,y-px(0.85)-hop,px(0.26),0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#0b141a';ctx.beginPath();roundRect(x-px(0.18)+(p.vx>0?px(0.05):p.vx<0?-px(0.05):0),y-px(0.92)-hop,px(0.36),px(0.13),px(0.06));ctx.fill();
    const inflight=fly.filter(f=>f.land&&f.to===st.player).length;
    drawStack(p.stack,x+px(0.05),y-px(1.35)-hop,px(0.44),t,sway.p,inflight);
  }
  function drawWorker(w,pos,t){
    const x=sx(pos.x),y=sy(pos.y);
    shadow(x,y+px(0.04),px(0.32),px(0.12),0.35);
    ctx.fillStyle='#6fc8e8';ctx.beginPath();roundRect(x-px(0.28),y-px(0.62),px(0.56),px(0.56),px(0.14));ctx.fill();
    drawIcon('🤖',x,y-px(0.36),px(0.42));
    drawStack(w.stack,x,y-px(0.9),px(0.32),t,0,0);
    if(st.tick<(st.unlockedAt[w.id]||0)+40)label(M.JOBS[w.job].name,x,y-px(1.4)-w.stack.length*px(0.2),Math.max(10,px(0.24)),'#0b141a','#6fc8e8');
  }
  function drawFly(t,pl){
    for(let i=fly.length-1;i>=0;i--){
      const f=fly[i],k=Math.max(0,(t-f.t)/f.dur);if(k>=1){fly.splice(i,1);if(f.land&&!reduced())sway.v+=0.15;continue;}
      const to=f.to===st.player?{x:pl.x,y:pl.y-1350-(st.player.stack.length-1)*0.62*440}:f.to.stack?{x:f.to.x,y:f.to.y-900}:f.to;
      const x=f.from.x+(to.x-f.from.x)*k,y=f.from.y+(to.y-f.from.y)*k-Math.sin(Math.PI*k)*1300;
      if(f.coin){ctx.fillStyle='#f2d36b';ctx.beginPath();ctx.ellipse(sx(x),sy(y),px(0.16),px(0.08),0,0,Math.PI*2);ctx.fill();}
      else token(f.item,sx(x),sy(y),px(0.42));
    }
  }
  function drawParts(t){
    for(let i=parts.length-1;i>=0;i--){
      const q=parts[i],age=Math.max(0,t-q.t);if(age>q.life){parts.splice(i,1);continue;}
      const s=age/1000,x=q.x+q.vx*s*U,y=q.y+q.vy*s*U,z=Math.max(0,q.z+q.vz*s-0.5*q.g*s*s)*U;
      const a=1-age/q.life;ctx.globalAlpha=a;
      if(q.kind==='dust'){ctx.fillStyle=q.color+'88';ctx.beginPath();ctx.arc(sx(x),sy(y)-px(z/U),Math.max(0.5,px(0.12+0.2*(1-a))),0,Math.PI*2);ctx.fill();}
      else{ctx.fillStyle=q.color;ctx.fillRect(sx(x)-3,sy(y)-px(z/U)-2,6,4);}
      ctx.globalAlpha=1;
    }
  }
  function drawFloats(t){
    for(let i=floats.length-1;i>=0;i--){
      const f=floats[i],age=Math.max(0,t-f.t);if(age>1100){floats.splice(i,1);continue;}
      const a=1-age/1100;ctx.globalAlpha=a;
      if(f.ring){ctx.strokeStyle=f.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(sx(f.x),sy(f.y),px(0.2+age/1500),px(0.12+age/2500),0,0,Math.PI*2);ctx.stroke();}
      else label(f.text,sx(f.x),sy(f.y)-age/18,f.big?Math.max(16,px(0.5)):Math.max(12,px(0.34)),f.color);
      ctx.globalAlpha=1;
    }
  }
  // Arrows at the edge of the view towards highlighted or hinted places that are off screen.
  function drawOffscreen(t,pl){
    const targets=[];
    if(hintInfo)targets.push({x:hintInfo.x,y:hintInfo.y,color:'#e7c18b'});
    if(highlight)for(const h of highlight.zones){const Z=M.ZONE[h.zone];targets.push({x:Z.x,y:Z.y,color:h.role==='from'?'#f2d36b':h.role==='use'?'#a5e0c9':'#92b9e4'});}
    for(const g of targets){
      const x=sx(g.x),y=sy(g.y),m=22;if(x>m&&x<cam.W-m&&y>m&&y<cam.H-m)continue;
      const cx=cam.W/2,cy=cam.H/2,dx=x-cx,dy=y-cy,k=Math.min((cam.W/2-m)/Math.abs(dx||1e-6),(cam.H/2-m)/Math.abs(dy||1e-6));
      const ex=cx+dx*k,ey=cy+dy*k,a=Math.atan2(dy,dx);
      ctx.save();ctx.translate(ex,ey);ctx.rotate(a);ctx.fillStyle=g.color;ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-8,-9);ctx.lineTo(-4,0);ctx.lineTo(-8,9);ctx.closePath();ctx.fill();ctx.restore();
    }
  }
  function drawJoystick(){
    if(!joy||!joy.active)return;
    const dx=joy.x-joy.ox,dy=joy.y-joy.oy,d=Math.hypot(dx,dy),R=48,k=d>R?R/d:1;
    ctx.fillStyle='#edf1ef18';ctx.strokeStyle='#edf1ef55';ctx.lineWidth=2;ctx.beginPath();ctx.arc(joy.ox,joy.oy,R,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#a5e0c9cc';ctx.beginPath();ctx.arc(joy.ox+dx*k,joy.oy+dy*k,20,0,Math.PI*2);ctx.fill();
  }

  // ---- loop --------------------------------------------------------------------------------------------------------
  let hudT=0;
  // Animation clocks use performance.now(); a frame timestamp can be slightly older, so ages are clamped at 0 above.
  // The next frame is requested first, so one bad frame can never stop the shift.
  function frame(ts){
    requestAnimationFrame(frame);
    if(st){
      if(running&&!ending&&!st.done){
        if(lastTs)acc+=Math.min(250,ts-lastTs)*speed;
        while(acc>=M.TICK_MS&&!st.done){tickOnce();acc-=M.TICK_MS;}
      }
      lastTs=ts;
      if(ts-hudT>90){hudT=ts;updateHud();}
      render(ts);
    }
  }
  shell.start();
  requestAnimationFrame(frame);

  window.SupplyRunUI={get puzzle(){return pz;},get state(){return st;},get commands(){return commands;},get running(){return running;},
    get celebrations(){return celebrations;},get highlight(){return highlight;},get hint(){return hintInfo;},get camera(){return {...cam};},
    pause(){running=false;updateHud();},advanceTo(t){running=false;advance(t-st.tick);cam.snap=true;render(now());},
    steer(x,y){return input({type:'move',x,y});},goto(x,y){return input({type:'goto',x,y});},input,showItem,showChain};
})();
