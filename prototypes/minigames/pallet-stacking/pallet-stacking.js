// Rocket loading UI (file and global keep the old pallet-stacking name). Two modes share the side-view fairings and
// stacking rules from pallet-stacking-model.js:
// - Voyage (Easy/Normal/Hard): legs of loading rounds. Gear and sample crates arrive on the dock; load rockets on the
//   pad (tap a crate, tap a column), Launch them to the front or the lab, build and refit rockets in the hangar, then
//   End leg. Score = credits delivered vs par.
// - Single launch (practice): clear one dock into full, centred fairings.
// Tap a top crate (with nothing selected) to lift it back. Undo works within the current leg.
(function(){
  'use strict';
  const K=window.MiniGameKit,P=window.PalletStacking,esc=K.esc;
  const TOPS={flat:'flat top',narrow:'narrow top',peak:'peaked top',lid:'half lid'};
  const VICON=Object.fromEntries(P.STAGES.map(s=>[s.id,s.icon])),DTAG={front:'⚔️ Front',lab:'🔬 Lab'};
  const SETTINGS_KEY='spacologyPalletVoyageSettingsV1';
  // Voyage settings and the End-leg guard persist across voyages; "don't ask again" lasts for this voyage only.
  function loadPrefs(){try{const v=JSON.parse(localStorage.getItem(SETTINGS_KEY));return v&&typeof v==='object'?v:{};}catch{return {};}}
  function savePrefs(v){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(v));}catch{}}
  let prefs=loadPrefs(),guardMuted=false,transformed=null;
  const guardOn=()=>prefs.guard!==false&&!guardMuted;
  let mode='voyage',V=null,pz=null,st=null,history=[],selected=null,aim=null,hintMove=null,justPlaced=null,dispatched=false,leaving=null,count={moves:0,undos:0,hints:0,lifts:0};
  const voyage=()=>mode==='voyage';
  const shell=K.shell({id:'pallet-stacking',difficulties:P.MODES,defaultDifficulty:'normal',
    rules:['<b>Voyage</b>: each night leg, gear for exploration and <b>sample crates</b> from its fights arrive on the dock. Load rockets on the pad, then <b>Launch</b>: gear goes to the <b>front</b>, samples go up to the ship\'s <b>lab</b>, which needs them to run its research. A launch is paid when the leg ends; the rocket is in orbit for its trip.',
      'A rocket carries <b>one destination per launch</b>: the first crate in an empty fairing tags the bay for the front or the lab.',
      'Tap a crate, then tap a column. It <b>drops straight down</b> and rests on whatever is below it. Every column under it must be held at the <b>same height</b>: no overhangs.',
      'The <b>fairing narrows</b> towards the top: the hatched shoulders are blocked, so tall crates go low or in the middle.',
      '<b>Peaked</b> tops hold nothing, <b>narrow</b> tops only their middle, a <b>half lid</b> only its left half. <b>Fragile</b> crates take nothing on top. <b>Heavy</b> crates sit only on the deck or other heavy crates, unless the deck is reinforced.',
      'Each rocket has a <b>payload</b> limit, and its <b>centre of mass</b> must sit in the green middle half of the base: an off-centre rocket cannot launch.',
      'Spend credits in the <b>hangar</b>: more hoppers, refits into lifters and heavy lifters, wider fairings, more payload, faster turnarounds. Later goods are bigger, heavier and worth far more.',
      '<b>Orders</b> from the lieutenants and the lab pay a bonus if they launch by their leg. The dock holds a few items: at the end of a leg the cheapest overflow is scrapped.',
      'Score is the credits delivered over the voyage against par (a planner playing the same seed). <b>Single launch</b> is a practice puzzle: clear the dock into full, centred fairings.'],
    onNew,onAuto,onUndo,onHint});
  const stage=shell.stage;
  stage.innerHTML=`<div class="ps" id="psRoot">
    <details class="ps-panel ps-settings" id="psSettings" hidden><summary><b>Voyage settings</b> <span id="psSettingsNow"></span></summary><div id="psSettingsBody"></div></details>
    <section class="ps-panel ps-legbar" id="psLegBar" hidden></section>
    <section class="ps-panel" aria-labelledby="psDockTitle"><div class="ps-head"><p class="eyebrow" id="psDockTitle">DOCK · CHOOSE A CRATE</p><small id="psDockNote"></small></div><div class="ps-dock-list" id="psDock"></div></section>
    <section class="ps-panel ps-yard" aria-label="Launch pad: rockets and their cargo fairings"><div class="ps-pallets" id="psPallets"></div></section>
    <section class="ps-panel ps-go"><p class="ps-preview" id="psPreview" aria-live="polite"></p><p class="ps-stakes" id="psStakes" aria-live="polite"></p><button id="psDispatch" class="primary">Launch all</button><button id="psEndLeg" class="primary" hidden>End leg</button></section>
    <section class="ps-panel ps-depot" id="psDepot" hidden aria-labelledby="psDepotTitle"></section>
    <div class="ps-guard" id="psGuard" hidden><div class="ps-guardcard" role="dialog" aria-modal="true" aria-labelledby="psGuardTitle"><h3 id="psGuardTitle">End the leg?</h3><p id="psGuardText"></p>
      <label class="ps-mute"><input type="checkbox" id="psGuardMute"> Don't ask again this voyage</label>
      <div class="ps-guardbtns"><button id="psGuardSend" class="primary">Launch and end leg</button><button id="psGuardKeep">Keep it loaded and end leg</button><button id="psGuardCancel" class="mg-quiet">Cancel</button></div></div></div></div>`;
  const $=id=>document.getElementById(id);
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const the=c=>'the '+c.name.charAt(0).toLowerCase()+c.name.slice(1);
  const locked=()=>dispatched||shell.ended||(voyage()&&V&&V.over);
  const sync=()=>{if(voyage())({pz,st}=P.view(V));};
  const dockIds=()=>voyage()?V.dock.slice():P.dock(pz,st);

  function onNew({seed,difficulty}){
    mode=difficulty==='single'?'single':'voyage';
    history=[];selected=null;aim=null;hintMove=null;justPlaced=null;dispatched=false;leaving=null;transformed=null;guardMuted=false;closeGuard();count={moves:0,undos:0,hints:0,lifts:0};
    $('psRoot').classList.remove('ps-departing');$('psRoot').classList.toggle('ps-voyage',voyage());
    $('psDispatch').hidden=voyage();$('psEndLeg').hidden=!voyage();$('psDispatch').disabled=false;$('psEndLeg').disabled=false;$('psDepot').hidden=!voyage();$('psLegBar').hidden=!voyage();$('psSettings').hidden=!voyage();
    if(voyage()){prefs=loadPrefs();V=P.createVoyage(seed,difficulty,{settings:prefs.settings});sync();shell.log('settings',{...V.settings,text:P.settingsText(V.settings)});settingsPanel();$('psSettings').open=!prefs.seenSettings;}
    else{V=null;pz=P.generate(seed,difficulty);st=P.create();if(shell.embedded)pz.crates[0].name="Daven's field kit";}
    sizeCells();render();
    shell.status(voyage()?`Leg 1 of ${V.legs}: ${V.dock.length} goods on the dock and ${V.vehicles.length} hopper${V.vehicles.length===1?'':'s'} on the pad. Load, launch gear to the front and samples to the lab, and grow the pad. Par is ${V.par} cr.`
      :`${pz.crates.length} crates on the dock, ${pz.pallets.length} rockets. Fill every fairing and keep every centre of mass in the green band. Tap a crate to start.`);
  }
  function sizeCells(){
    if(!pz)return;
    const avail=Math.max(260,$('psPallets').clientWidth||stage.clientWidth-26),ws=pz.pallets.map(p=>p.width),gap=34,pad=56;
    let cell=44;
    // Fins and the open fairing halves stick out about 22px on each side; a single very wide heavy lifter on a phone
    // may go below 40px cells rather than be clipped.
    for(let per=ws.length;per>=1;per--){const widest=Math.max(...chunk(ws,per).map(r=>r.reduce((a,b)=>a+b,0))),fit=Math.floor((avail-per*pad-(per-1)*gap)/widest);
      if(fit>=46||per===1){cell=Math.max(Math.min(40,fit),30,Math.min(voyage()?56:64,fit));break;}}
    $('psRoot').style.setProperty('--cell',cell+'px');
  }
  const chunk=(a,n)=>{const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;};

  // ---- rendering --------------------------------------------------------------------------------------------------
  // Re-rendering replaces the buttons, so keyboard focus is carried over to the equivalent element.
  function focusKey(){const a=document.activeElement;if(!a||!stage.contains(a))return null;
    return a.dataset.crate!==undefined?`.ps-card[data-crate="${a.dataset.crate}"]`:a.classList.contains('ps-col')?`.ps-col[data-pallet="${a.dataset.pallet}"][data-col="${a.dataset.col}"]`:a.dataset.placed!==undefined?`[data-placed="${a.dataset.placed}"]`:a.id?'#'+a.id:null;}
  function render(){const key=focusKey();render0();if(key){const el=stage.querySelector(key);if(el)el.focus({preventScroll:true});}}
  function render0(){
    sync();
    const ev=voyage()?null:P.evaluate(pz,st),ids=dockIds();
    $('psRoot').querySelector('.ps-yard').classList.toggle('ps-aiming',selected!==null&&!locked());
    const over=voyage()&&V.dock.length>V.slots;
    $('psDockTitle').textContent=voyage()?`DOCK · ${V.dock.length}/${V.slots} SLOTS`:'DOCK · CHOOSE A CRATE';
    $('psDockNote').textContent=ids.length?`${voyage()&&over?`${V.dock.length-V.slots} over: the cheapest will be scrapped at leg end · `:''}${selected!==null?'now tap a column':'tap one to load it'}`:'Everything is loaded';
    $('psDockNote').className=over?'bad':'';
    const sorted=voyage()?ids.sort((a,b)=>V.items[b].value-V.items[a].value||a-b):ids;
    $('psDock').innerHTML=sorted.length?sorted.map(i=>card(pz.crates[i])).join(''):'<p class="ps-empty">The dock is empty.</p>';
    $('psPallets').innerHTML=pz.pallets.map((pal,p)=>pallet(pal,p,P.palletStats(pz,st,p))).join('');
    if(justPlaced!==null){const el=document.querySelector(`.ps-crate[data-placed="${justPlaced}"]`);if(el&&!reduced()){el.classList.add('ps-drop');el.addEventListener('animationend',()=>el.classList.remove('ps-drop'),{once:true});}justPlaced=null;}
    if(aim)ghost(aim.p,aim.col);
    if(voyage()){legBar();depot();vMeters();vStakes();vSide();}
    else{meters(ev);stakes(ev);side();}
    shell.undoEnabled(history.length>0&&!locked());
  }
  function mini(c){
    // Tiny to-scale drawing: the top row shows which columns can hold weight.
    let cells='';for(let r=0;r<c.h;r++)for(let i=0;i<c.w;i++)cells+=`<i class="${r===0?(c.fragile||!c.top[i]?'t-off':'t-on'):''}"></i>`;
    return `<span class="ps-mini" style="--c:${c.color};grid-template-columns:repeat(${c.w},11px)" aria-hidden="true">${cells}</span>`;
  }
  function tagList(c){
    const o=voyage()&&c.order?`<span class="ps-tag lt${V.leg>c.order.due?' late':''}">${esc(c.order.by)} · by leg ${c.order.due}${V.leg>c.order.due?' (late)':` · +${c.order.bonus}`}</span>`:'';
    const d=voyage()&&c.dest?`<span class="ps-tag dest ${c.dest}">${DTAG[c.dest]}</span>`:'';
    return `${o}${d}${c.heavy?'<span class="ps-tag heavy">Heavy</span>':''}${c.fragile?'<span class="ps-tag fragile">Fragile</span>':''}<span class="ps-tag top">${TOPS[c.topKind]}</span>`;
  }
  function card(c){
    const on=selected===c.id,hint=hintMove&&hintMove.type==='place'&&(hintMove.crate??hintMove.item)===c.id;
    const waited=voyage()?V.leg-c.arrived:0,fresh=voyage()&&c.arrived===V.leg;
    const label=`${c.name}: ${c.w} wide, ${c.h} high, weight ${c.weight}${voyage()?`, worth ${c.value} credits, ${c.dest==='lab'?'a sample for the lab':'for the front'}`:''}${c.heavy?', heavy':''}${c.fragile?', fragile':''}, ${TOPS[c.topKind]}${voyage()&&c.order?`. ${c.order.by} needs it by leg ${c.order.due}`:''}`;
    const btn=`<button class="ps-card${hint?' mg-pop':''}${fresh?' ps-new':''}${voyage()&&c.order?' ps-order':''}" data-crate="${c.id}" aria-pressed="${on}" aria-label="${esc(label)}" style="${hint?'box-shadow:0 0 0 3px var(--gold)':''}">
      ${mini(c)}<b>${esc(c.icon)} ${esc(c.name)}</b><span class="ps-nums"><span>${c.w}×${c.h}</span><span class="v">⚖ ${c.weight}</span>${voyage()?`<span class="cr">${c.value} cr</span>`:''}${waited?`<span class="wait">${waited} leg${waited===1?'':'s'} waiting</span>`:fresh&&V.leg>1?'<span class="new">new</span>':''}</span><span class="ps-tags">${tagList(c)}</span></button>`;
    if(!voyage())return btn;
    const sh=hintMove&&hintMove.type==='scrap'&&hintMove.item===c.id;
    return `<div class="ps-cardwrap">${btn}<button class="ps-scrap${sh?' ps-hint':''}" data-scrap="${c.id}" aria-label="Scrap the ${esc(c.name.toLowerCase())}" title="Scrap">✕</button></div>`;
  }
  // One rocket: its title and gauges, the destination tag, the column marks, then the rocket itself (open fairing
  // halves, the fairing bay with its hatched shoulders, the deck and the engine) and the centre-of-mass gauge.
  function pallet(pal,p,s){
    const qs=st.placed.filter(q=>q.pallet===p),sel=selected!==null?pz.crates[selected]:null,tilt=s.count&&!s.balanced,away=voyage()&&pal.away;
    const cap=P.ceilings(pal);
    const marks=[...Array(pal.width).keys()].map(col=>{
      if(!sel||locked()||away)return `<span>${col+1}</span>`;
      const ok=!P.landing(pz,st,sel.id,p,P.anchorFor(pz,sel.id,p,col)).reason;return `<span class="${ok?'ok':'no'}" title="${ok?'fits':'blocked'}">${ok?'▼':'·'}</span>`;}).join('');
    const hintCol=hintMove&&hintMove.type==='place'&&(hintMove.pallet??hintMove.vehicle)===p?P.columnFor(pz,hintMove.crate??hintMove.item,hintMove.x):-1;
    const cols=away?'':[...Array(pal.width).keys()].map(col=>{
      let label=`${pal.name}, column ${col+1}${cap[col]<pal.height?` (fairing ${cap[col]} high here)`:''}`;
      if(sel){const x=P.anchorFor(pz,sel.id,p,col),l=P.landing(pz,st,sel.id,p,x);label+=l.reason?`: ${sel.name} cannot go here. ${l.reason}`:`: drop ${sel.name} to rest at height ${l.y}`;}
      return `<button class="ps-col${hintCol===col?' ps-hint':''}" style="--i:${col}" data-pallet="${p}" data-col="${col}" aria-label="${esc(label)}" ${sel&&!locked()?'':'tabindex="-1"'}></button>`;}).join('');
    // The taper: each column's blocked cells above its ceiling, drawn as hatched hull.
    const blocks=cap.map((h,x)=>h<pal.height?`<span class="ps-block" style="--x:${x};--y:${h};--bh:${pal.height-h}" aria-hidden="true"></span>`:'').join('');
    const crates=qs.map(q=>{const c=pz.crates[q.crate],lift=!locked()&&P.liftable(pz,st,q.crate),hint=hintMove&&hintMove.type==='lift'&&(hintMove.crate??hintMove.item)===c.id;
      const cls=['ps-crate',c.heavy?'heavy':'',c.fragile?'fragile':'',c.topKind==='peak'?'peak':'',lift?'can-lift':'',hint?'ps-hint':''].join(' ');
      const tops=c.top.map(t=>`<i class="${t&&!c.fragile?'on':'off'}"></i>`).join('');
      const label=`${c.name} in ${pal.name}, columns ${q.x+1} to ${q.x+c.w}, height ${q.y}, weight ${c.weight}.${lift?' Tap to lift it back to the dock.':' Something rests on it.'}`;
      return `<button class="${cls}" data-placed="${c.id}" style="--x:${q.x};--y:${q.y};--cw:${c.w};--ch:${c.h};--c:${c.color};--fall:calc(${pal.height-q.y} * var(--cell))" aria-label="${esc(label)}" ${lift&&selected===null?'':'tabindex="-1"'}>
        <span class="tops">${tops}</span><span class="body"><span class="ic">${esc(c.icon)}</span>${c.w*c.h>=2?`<span class="nm">${esc(c.name)}</span>`:''}<span class="wv">⚖${c.weight}</span></span></button>`;}).join('');
    const pct=x=>Math.max(0,Math.min(100,x/pal.width*100));
    const btext=!s.count?'Empty · centred':s.balanced?`Centred · ${s.com.toFixed(2)} in ${fmt(s.lo)}–${fmt(s.hi)}`:`Off-centre! ${s.com.toFixed(2)} outside ${fmt(s.lo)}–${fmt(s.hi)}`;
    const lean=s.com<pal.width/2?'-9deg':'9deg';
    let title,bars,foot='',tag='';
    if(voyage()){
      const v=V.vehicles[p],wPct=Math.min(100,s.weight/pal.maxWeight*100),wFull=s.weight>=pal.maxWeight;
      title=`<b>${VICON[v.type]||'🚀'} ${esc(pal.name)}</b>${s.full?'<span class="ps-full">FULL</span>':''}<span>${pal.width}×${pal.height}${v.reinforced?' · deck':''} · ${v.trip}-leg trip</span>`;
      bars=`<div class="ps-bars" aria-hidden="true"><span class="lbl">▦ ${s.filled}/${s.area}</span><div class="ps-fill${s.full?' full':''}"><i style="width:${Math.min(100,s.filled/s.area*100)}%"></i></div>
        <span class="lbl${wFull?' hot':''}">⚖ ${s.weight}/${pal.maxWeight}</span><div class="ps-wfill${wFull?' full':''}"><i style="width:${wPct}%"></i></div></div>`;
      tag=away?'':pal.dest?`<p class="ps-dest ${pal.dest}" data-dest="${pal.dest}">${pal.dest==='lab'?'🔬 Bound for the orbit lab':'⚔️ Bound for the front'}</p>`:'<p class="ps-dest open" data-dest="">Open bay: the first crate sets its destination</p>';
      const why=away?'':P.departCheck(V,p),dh=hintMove&&hintMove.type==='depart'&&hintMove.vehicle===p,note=away?'':P.weightNote(V,p);
      foot=away?`<p class="ps-away" data-away="${p}">In orbit · back from orbit at leg ${V.leg+pal.away}</p>`
        :`${note?`<p class="ps-wnote">${esc(note)}</p>`:''}<button class="ps-depart${dh?' ps-hint':''}" data-depart="${p}" ${why?'aria-disabled="true"':''} title="${esc(why||'')}">${why&&s.count?'⚠ ':''}🚀 Launch${why?'':` to ${pal.dest==='lab'?'the lab':'the front'} · ${qs.reduce((a,q)=>a+pz.crates[q.crate].value,0)} cr`}<small>${esc(why||`back from orbit at leg ${V.leg+pal.trip}`)}</small></button>`;
    }else{
      title=`<b>🚀 ${esc(pal.name)}</b>${s.full?'<span class="ps-full">FULL</span>':`<span class="ps-fillnum">▦ ${s.filled}/${s.area}</span>`}<span>⚖ ${s.weight}</span><span>↕ ${pal.height}</span>`;
      bars=`<div class="ps-fill${s.full?' full':''}" aria-hidden="true"><i style="width:${Math.min(100,s.filled/s.area*100)}%"></i></div>`;
    }
    const type=voyage()?V.vehicles[p].type:'lifter';
    return `<div class="ps-pallet${tilt?' tipping':''}${away?' away':''}${leaving===p?' leaving':''} v-${type}" data-pallet-box="${p}" style="--w:${pal.width};--h:${pal.height}" role="group" aria-label="${esc(`${pal.name}: ${pal.width} columns, ${pal.height} high, fairing narrows to ${cap.filter(h=>h===pal.height).length} at the top, ${s.filled} of ${s.area} cells filled${voyage()?`, weight ${s.weight} of ${pal.maxWeight}${pal.dest?`, bound for ${pal.dest==='lab'?'the lab':'the front'}`:''}`:''}${s.full?', full':''}${away?`, in orbit until leg ${V.leg+pal.away}`:''}, ${btext}`)}">
      <div class="ps-ptitle">${title}</div>${bars}${tag}
      <div class="ps-marks" aria-hidden="true">${marks}</div>
      <div class="ps-site"><div class="ps-rocket" style="--lean:${lean}"><span class="ps-half l" aria-hidden="true"></span><span class="ps-half r" aria-hidden="true"></span>
        <div class="ps-bay">${blocks}${cols}${crates}<div class="ps-ghost" hidden></div>${voyage()&&transformed&&transformed.vehicle===p?`<div class="ps-transformed" aria-live="polite"><small>REFITTED</small><b>${VICON[V.vehicles[p].type]} ${esc(V.vehicles[p].name)}</b></div>`:''}</div>
        <div class="ps-base" aria-hidden="true"></div><div class="ps-sled" aria-hidden="true"><span class="cab"></span><span class="ps-flame"></span></div></div>
        ${away?`<div class="ps-awaycover"><b>${pal.away}</b><span>leg${pal.away===1?'':'s'} in orbit</span></div>`:''}</div>
      <div class="ps-balance" aria-hidden="true" title="Centre of mass"><span class="safe"></span><span class="pivot"></span><span class="needle${s.balanced?'':' bad'}" style="left:${pct(s.com)}%"></span><span class="needle proj" hidden></span></div>
      <p class="ps-btext ${!s.count?'':s.balanced?'ok':'bad'}">${btext}</p>${foot}</div>`;
  }
  const fmt=n=>Number.isInteger(n)?String(n):n.toFixed(2).replace(/0$/,'');
  // Ghost preview and projected balance needle for the selected crate aimed at one column.
  function ghost(p,col){
    clearGhost();if(selected===null||locked())return;
    const box=document.querySelector(`[data-pallet-box="${p}"]`);if(!box||!box.querySelector('.ps-ghost'))return;
    const c=pz.crates[selected],pal=pz.pallets[p];if(pal.away)return;
    const x=P.anchorFor(pz,c.id,p,col),l=P.landing(pz,st,c.id,p,x),g=box.querySelector('.ps-ghost');
    const y=Math.min(l.y,Math.max(0,pal.height-c.h));
    g.hidden=false;g.className='ps-ghost'+(l.reason?' bad':'');g.style.cssText=`--x:${x};--y:${y};--cw:${c.w};--ch:${c.h}`;g.textContent=l.reason?'✕':'▼';
    const s=P.palletStats(pz,st,p),com=(s.weight*s.com*(s.count?1:0)+c.weight*(x+c.w/2))/(s.weight+c.weight),n=box.querySelector('.needle.proj');
    n.hidden=false;n.style.left=Math.max(0,Math.min(100,com/pal.width*100))+'%';n.classList.toggle('bad',com<s.lo||com>s.hi);
    aim={p,col};
    const pv=$('psPreview');pv.className='ps-preview'+(l.reason?' bad':'');
    pv.textContent=l.reason?`✕ ${l.reason}.`:`${c.name} would rest at height ${l.y} in ${pal.name}; centre of mass ${com.toFixed(2)} (${com<s.lo||com>s.hi?'off-centre: it could not launch':'centred'}).`;
  }
  function clearGhost(){document.querySelectorAll('.ps-ghost').forEach(g=>g.hidden=true);document.querySelectorAll('.needle.proj').forEach(n=>n.hidden=true);const pv=$('psPreview');if(pv)pv.textContent='';}

  // ---- single-load panels ------------------------------------------------------------------------------------------
  function meters(ev){
    const loaded=ev.pallets.filter(x=>x.count),level=loaded.filter(x=>x.balanced).length,fullN=ev.pallets.filter(x=>x.full).length;
    shell.meters([{label:'Dock',value:ev.left?`${ev.left} left`:'clear',tone:ev.left?'warn':'good'},{label:'Full',value:`${fullN}/${ev.pallets.length}`,tone:fullN===ev.pallets.length?'good':''},{label:'Centred',value:`${level}/${loaded.length}`,tone:level===loaded.length?'good':'bad'},
      {label:'Moves',value:String(count.moves)},{label:'Hints',value:String(count.hints),tone:count.hints?'warn':''}]);
  }
  function stakes(ev){
    const bits=[`Launch now: <b>${ev.shipped.length}</b> of ${ev.total} crates reach the front`];
    if(ev.left)bits.push(`<span class="bad">${ev.left} still on the dock</span>`);
    for(const s of ev.tipped)bits.push(`<span class="bad">${esc(pz.pallets[s.pallet].name)} is off-centre and cannot launch its ${s.count} crate${s.count===1?'':'s'}</span>`);
    if(ev.cleared&&ev.allLevel)bits.push('<span class="ok">dock clear, every rocket centred: ready for launch</span>');
    $('psStakes').innerHTML=bits.join(' · ');
    $('psDispatch').textContent=dispatched?'Liftoff':`🚀 Launch all · ${ev.shipped.length}/${ev.total}`;
    $('psDispatch').classList.toggle('ps-hint',!!hintMove&&hintMove.type==='dispatch');
  }
  function side(){
    shell.side(`<p class="eyebrow">LOADING SENSE</p><ul class="ps-legend"><li>Heavy crates can only stand on the deck or on each other: they are the foundations.</li>
      <li>The fairing narrows at the top: save the middle columns for tall crates and fill the shoulders with short ones.</li>
      <li>A narrow top only takes something as narrow as its middle; a half lid only its left half.</li><li>Fragile and peaked crates end a stack: load them last.</li>
      <li>Fill each fairing bottom-up and leave no gap you cannot close: the crates fill the fairings exactly.</li></ul>${legend()}`);
  }
  const legend=()=>`<p class="eyebrow">READING A CRATE</p><ul class="ps-legend"><li><span style="color:var(--mint)">▬</span> mint top edge: can hold weight</li><li><span style="color:var(--rose)">┅</span> hatched edge: holds nothing there</li>
      <li><span class="ps-keyblock"></span> hatched shoulder: the fairing narrows, nothing goes there</li>
      <li>⚖ weight · ▦ cells filled · ↕ fairing height</li><li>▼ above a column: the crate fits there</li><li>Needle in the green band: centre of mass OK to launch</li></ul>`;

  // ---- voyage panels -------------------------------------------------------------------------------------------------
  function legBar(){
    const dots=[...Array(V.legs).keys()].map(i=>{const leg=i+1;
      return `<span class="ps-leg${leg===V.leg?' now':leg<V.leg?' done':''}" title="Leg ${leg}">${leg}</span>`;}).join('');
    const r=V.lastReport;
    $('psLegBar').innerHTML=`<div class="ps-legs" aria-label="Leg ${V.leg} of ${V.legs}">${dots}</div><p class="ps-report">${r?`Leg ${r.leg}: <b>+${r.paid+r.bonus} cr</b> delivered${r.bonus?` (incl. ${r.bonus} order bonus)`:''}${r.front||r.lab?` · ${r.front} to the front, ${r.lab} sample${r.lab===1?'':'s'} to the lab`:''}${r.scrapped.length?` · scrapped ${r.scrapped.map(i=>esc(V.items[i].name.toLowerCase())).join(', ')}`:''}${r.returned.length?` · back from orbit: ${r.returned.map(i=>esc(V.vehicles[i].name.toLowerCase()+' '+(i+1))).join(', ')}`:''}`:'Goods arrive at the start of each leg. Launches are paid when the leg ends.'}</p>`;
  }
  function depot(){
    // Keep any "More upgrades" panel the player opened open across re-renders (liftoff and refit timers re-render).
    const opened=new Set([...document.querySelectorAll('.ps-group .ps-more[open]')].map(el=>el.closest('.ps-group').dataset.group));
    const d=P.shop(V),h=hintMove&&(hintMove.type==='buy'||hintMove.type==='upgrade')?hintMove:null;
    const card=o=>{const key=o.type==='buy'?'data-buy="hopper"':`data-upgrade="${o.vehicle}:${o.kind}"`,isHint=h&&h.type===o.type&&(o.type==='buy'||(h.kind===o.kind&&h.vehicle===o.vehicle));
      return `<button class="ps-shopitem${o.kind==='stage'?' ps-transform':''}${isHint?' ps-hint':''}" ${key} ${o.reason?'aria-disabled="true"':''} title="${esc(o.reason||'')}"><b>${esc(o.label)}</b><span class="price">${o.price==null?'—':o.price+' cr'}</span><small>${esc(o.detail)}</small></button>`;};
    const groups=d.groups.map(g=>{const v=V.vehicles[g.vehicle],openMore=opened.has(String(g.vehicle))||h&&h.type==='upgrade'&&h.vehicle===g.vehicle&&g.more.some(o=>o.kind===h.kind);
      const route=g.route.map(r=>`<span class="ps-node ${r.state}" title="${esc(r.name)}">${r.icon}<small>${esc(r.name)}${r.price!=null?` · ${r.price} cr`:''}</small></span>`).join('<span class="ps-arrow" aria-hidden="true">→</span>');
      return `<div class="ps-group" data-group="${g.vehicle}"><div class="ps-ghead"><b>${VICON[v.type]} ${esc(v.name)} ${g.vehicle+1}</b><small>fairing ${v.width}×${v.height}, top row ${v.cap.filter(h=>h===v.height).length} · payload ${v.maxWeight} · ${v.trip}-leg trip${v.reinforced?' · reinforced deck':''}${v.away?` · in orbit until leg ${V.leg+v.away}`:''}</small></div>
        <div class="ps-route" aria-label="Upgrade route">${route}</div>
        <div class="ps-shop">${g.transform?card(g.transform):''}${g.upgrades.map(card).join('')}</div>
        ${g.more.length?`<details class="ps-more"${openMore?' open':''}><summary>More upgrades (${g.more.length})</summary><div class="ps-shop">${g.more.map(card).join('')}</div></details>`:''}</div>`;}).join('');
    $('psDepot').innerHTML=`<div class="ps-head"><p class="eyebrow" id="psDepotTitle">HANGAR · ${V.credits} CR TO SPEND</p><small>Each rocket grows along its route. Upgrades need the rocket on the pad, not in orbit.</small></div>
      ${groups}<div class="ps-shop ps-addrow">${card(d.add)}</div>`;
  }
  function vMeters(){
    shell.meters([{label:'Leg',value:`${V.leg}/${V.legs}`},{label:'Delivered',value:`${V.delivered} cr`,tone:V.delivered>=V.par?'good':''},{label:'Par',value:`${V.par}`},
      {label:'Credits',value:`${V.credits}`},{label:'Rockets',value:`${V.vehicles.length}/${V.settings.maxFleet}`},{label:'Dock',value:`${V.dock.length}/${V.slots}`,tone:V.dock.length>V.slots?'bad':''}]);
  }
  function vStakes(){
    const bits=[],loaded=V.vehicles.filter(v=>!v.away&&v.load.length);
    for(const v of loaded){const why=P.departCheck(V,v.id);bits.push(why?`<span class="bad">${esc(why)}</span>`:`${esc(v.name)} ${v.id+1} loaded but not launched: it keeps its load into next leg`);}
    const over=V.dock.length-V.slots;if(over>0)bits.push(`<span class="bad">Dock ${V.dock.length}/${V.slots}: the ${over} cheapest good${over===1?'':'s'} will be scrapped</span>`);
    const due=V.items.filter(it=>it.order&&it.status!=='shipped'&&it.status!=='transit'&&it.status!=='scrapped'&&it.order.due===V.leg);
    for(const it of due)bits.push(`<span class="bad">${esc(it.order.by)}'s ${esc(it.name.toLowerCase())} must launch this leg for its +${it.order.bonus} bonus</span>`);
    const sent=V.pending.reduce((a,p)=>a+p.items.reduce((b,i)=>b+V.items[i].value,0),0);
    bits.unshift(sent?`Launched this leg: <b>${sent} cr</b>, paid when the leg ends`:'Nothing launched this leg yet');
    $('psStakes').innerHTML=bits.join(' · ');
    $('psEndLeg').textContent=V.over?'Voyage over':V.leg>=V.legs?'End the voyage':`End leg ${V.leg} → leg ${V.leg+1}`;
    $('psEndLeg').classList.toggle('ps-hint',!!hintMove&&hintMove.type==='end');
  }
  function vSide(){
    const li=o=>{const done=o.paid===o.qty,late=!done&&V.leg>o.due,lost=o.items.some(i=>i.status==='scrapped'),moving=o.items.some(i=>i.status==='transit');
      return `<li class="${done?'done':late||lost?'risk':'wait'}">${done?'✓':late?'✕':moving?'↑':'○'} ${esc(P.orderText(o))} (+${o.bonus}${o.qty>1?' each':''})${o.qty>1?` · ${o.sent}/${o.qty} launched`:''}</li>`;};
    const all=P.orders(V),front=all.filter(o=>o.team!=='lab').map(li),lab=all.filter(o=>o.team==='lab').map(li);
    shell.side(`<p class="eyebrow">FRONT ORDERS</p><ul class="ps-reqs">${front.join('')||'<li class="wait">None yet</li>'}</ul>
      <p class="eyebrow">LAB REQUESTS</p><ul class="ps-reqs">${lab.join('')||'<li class="wait">None yet</li>'}</ul>
      <p class="eyebrow">LAUNCH PAD</p><ul class="ps-reqs">${V.vehicles.map((v,i)=>{const d=P.destOf(V,v);return `<li class="${v.away?'wait':'done'}">${VICON[v.type]} ${esc(v.name)} ${i+1}: ${v.width}×${v.height} fairing, payload ${v.maxWeight}${v.away?` · in orbit, back at leg ${V.leg+v.away}`:d?` · on the pad, bound for ${d==='lab'?'the lab':'the front'}`:' · on the pad'}</li>`;}).join('')}</ul>
      <p class="eyebrow">LEG GUARD</p><label class="ps-guardpref"><input type="checkbox" id="psGuardPref" ${guardOn()?'checked':''}> Ask before ending a leg while a rocket is loaded</label>
      <p class="ps-settingsline">Settings: ${esc(P.settingsText(V.settings))}</p>${legend()}`);
  }
  // ---- voyage settings (tuning playtests) ----------------------------------------------------------------------------
  function settingsPanel(){
    const s=V.settings,opt=(list,val,fmt=x=>x)=>list.map(x=>`<option value="${x}"${String(x)===String(val)?' selected':''}>${fmt(x)}</option>`).join('');
    const scales=[0.5,0.75,1,1.25,1.5,2];
    $('psSettingsNow').textContent=P.settingsText(s);
    $('psSettingsBody').innerHTML=`<p class="ps-settingsnote">For playtests: change the launch economy, then restart the voyage. Par uses the same settings, and they are saved with every result.</p>
      <div class="ps-presets">${P.PRESETS.map(p=>`<button data-preset="${p.id}" class="${s.preset===p.id?'on':''}" aria-pressed="${s.preset===p.id}">${esc(p.name)}<small>${p.start} rocket${p.start===1?'':'s'} · max ${p.maxFleet}${p.priceScale!==1?` · price ×${p.priceScale}`:''}${p.incomeScale!==1?` · income ×${p.incomeScale}`:''}${p.legs?` · ${p.legs} legs`:''}</small></button>`).join('')}</div>
      <div class="ps-setgrid"><label>Starting rockets<select id="psSetStart">${opt([1,2,3],s.start)}</select></label><label>Max rockets<select id="psSetMax">${opt([2,3,4,5,6],s.maxFleet)}</select></label>
      <label>Price scale<select id="psSetPrice">${opt(scales,s.priceScale,x=>'×'+x)}</select></label><label>Income scale<select id="psSetIncome">${opt(scales,s.incomeScale,x=>'×'+x)}</select></label>
      <label>Voyage length<select id="psSetLegs">${opt([0,6,8,10,14],s.legs,x=>x?x+' legs':'Difficulty default')}</select></label></div>
      <button id="psApplySettings" class="primary">Apply and restart the voyage</button>`;
  }
  function applySettings(next){
    prefs={...loadPrefs(),settings:P.normSettings(next),seenSettings:true};savePrefs(prefs);shell.start();
    shell.status(`Settings applied: ${P.settingsText(V.settings)}. Par is now ${V.par} cr.`,'good');
  }
  // ---- actions ----------------------------------------------------------------------------------------------------
  function select(id){
    if(locked())return;
    selected=selected===id?null:id;aim=null;
    if(hintMove&&!(hintMove.type==='place'&&(hintMove.crate??hintMove.item)===selected))hintMove=null;
    render();
    if(selected!==null){const c=pz.crates[selected],fits=pz.pallets.reduce((n,pal,p)=>n+[...Array(Math.max(0,pal.width-c.w+1)).keys()].filter(x=>!P.landing(pz,st,c.id,p,x).reason).length,0);
      shell.status(fits?`${c.name} selected (${c.w} wide, weight ${c.weight}${c.heavy?', heavy':''}${c.fragile?', fragile':''}). ▼ marks show where it fits: ${fits} spot${fits===1?'':'s'}.`:`${c.name} fits nowhere right now.${voyage()?' A wider fairing, more payload, a rocket bound for its destination or one back from orbit would change that.':' Lift something or leave it on the dock.'}`,fits?'':'warn');}
    else shell.status('');
  }
  const snapshot=()=>voyage()?P.cloneVoyage(V):P.clone(st);
  // Applies one move through the model. Voyage moves use act(); single-load moves use apply().
  function commit(move,el){
    const before=snapshot();
    const why=voyage()?P.act(V,toAction(move)):P.apply(pz,st,move);
    if(why){shell.flash(el,'mg-shake');shell.status('✕ '+why+'.','bad');shell.log('illegal',{move,why});return false;}
    shell.begin();history.push(before);count.moves++;shell.log(move.type,move);
    if(hintMove&&hintMove.type===move.type)hintMove=null;
    sync();return true;
  }
  const toAction=m=>m.type==='place'?{type:'place',item:m.crate,vehicle:m.pallet,x:m.x}:m.type==='lift'?{type:'lift',item:m.crate}:m;
  function place(p,col,el){
    if(locked())return;
    if(selected===null){shell.status('Pick a crate from the dock first.');shell.flash($('psDock'),'mg-shake');return;}
    const c=pz.crates[selected],move={type:'place',crate:c.id,pallet:p,x:P.anchorFor(pz,c.id,p,col)},wasFull=P.palletStats(pz,st,p).full;
    if(!commit(move,el.closest('.ps-pallet'))){ghost(p,col);return;}
    justPlaced=c.id;selected=null;aim=null;render();
    const s=P.palletStats(pz,st,p),pal=pz.pallets[p];
    if(!s.balanced)shell.status(`${c.name} loaded into ${pal.name}, but it is now off-centre: centre of mass ${s.com.toFixed(2)}, launch band ${fmt(s.lo)}–${fmt(s.hi)}.`,'warn');
    else if(voyage())shell.status(`${c.name} loaded into ${pal.name}${s.full&&!wasFull?`: ${pal.name} is FULL`:''}. ${V.dock.length} left on the dock.`,'good');
    else{const left=P.evaluate(pz,st).left;shell.status(`${c.name} loaded into ${pal.name}${s.full&&!wasFull?`: ${pal.name} is FULL`:''}. ${left?`${left} left on the dock.`:'The dock is clear.'}`,'good');}
    // The last gap closing is the payoff: pop the whole bed and its badge.
    if(s.full&&!wasFull){const box=document.querySelector(`[data-pallet-box="${p}"]`);shell.flash(box?.querySelector('.ps-bay'),'ps-filled');shell.flash(box?.querySelector('.ps-full'));shell.log('full',{pallet:p});}
    shell.flash(document.querySelector('#mgMeters .mg-meter'));
  }
  function lift(id,el){
    if(locked())return;
    if(!P.liftable(pz,st,id)){shell.flash(el,'mg-shake');shell.status(`Something is resting on ${the(pz.crates[id])}: lift the top crate first.`,'bad');return;}
    if(!commit({type:'lift',crate:id},el))return;
    count.lifts++;selected=id;aim=null;render();
    shell.status(`${pz.crates[id].name} lifted back to the dock and selected: tap a column to put it somewhere else.`);
    shell.flash(document.querySelector(`.ps-card[data-crate="${id}"]`));
  }
  function depart(vi,el){
    if(locked())return;
    const why=P.departCheck(V,vi);if(why){shell.flash(el,'mg-shake');shell.status('✕ '+why+'.','bad');return;}
    const v=V.vehicles[vi],value=v.load.reduce((a,q)=>a+V.items[q.item].value,0),dest=P.destOf(V,v);
    if(!commit({type:'depart',vehicle:vi},el))return;
    selected=null;aim=null;
    shell.status(`Liftoff! ${v.name} ${vi+1} is on its way to ${dest==='lab'?'the lab':'the front'} with ${value} cr of ${dest==='lab'?'samples':'cargo'}: paid when the leg ends, back from orbit at leg ${V.leg+v.trip}.`,'good');
    // Lift off, then show it as in orbit (the cover is there at once and fades in under the rising rocket).
    leaving=vi;render();setTimeout(()=>{leaving=null;if(!shell.ended)render();},reduced()?0:1300);
  }
  function buy(a,el){
    if(locked())return;
    if(P.checkAct(V,a)){shell.flash(el,'mg-shake');shell.status('✕ '+P.checkAct(V,a)+'.','bad');return;}
    if(!commit(a,el))return;
    if(a.type==='upgrade'&&a.kind==='stage'){transformed={vehicle:a.vehicle};setTimeout(()=>{if(transformed&&transformed.vehicle===a.vehicle){transformed=null;if(!shell.ended)render();}},reduced()?600:1800);}
    sizeCells();render();
    const v=a.type==='buy'?V.vehicles.at(-1):V.vehicles[a.vehicle];
    shell.status(a.type==='buy'?`Hopper ${V.vehicles.length} joins the pad: it can be refitted into a lifter and then a heavy lifter.`:a.kind==='stage'?`REFITTED: rocket ${a.vehicle+1} is now a ${v.name.toLowerCase()} with a ${v.width}×${v.height} fairing (${P.shapeArea(v)} cells) and payload ${v.maxWeight}.`:`${v.name} ${a.vehicle+1}: ${P.UPGRADES[a.kind].label.toLowerCase()} done.`,'good');
    shell.flash(a.type==='buy'?document.querySelector(`[data-pallet-box="${V.vehicles.length-1}"]`):document.querySelector(`[data-pallet-box="${a.vehicle}"] .ps-bay`),a.type==='upgrade'&&a.kind==='stage'?'ps-filled':'mg-pop');
  }
  function scrap(id,el){
    if(locked())return;const name=V.items[id].name;
    if(!commit({type:'scrap',item:id},el))return;if(selected===id)selected=null;render();shell.status(`${name} scrapped to free a dock slot.`);
  }
  // The End-leg guard: if a rocket on the pad is loaded, ask first (launch it, keep it loaded, or cancel).
  function endLeg(){
    if(locked())return;
    const loaded=V.vehicles.filter(v=>!v.away&&v.load.length);
    if(!loaded.length||!guardOn()){doEndLeg();return;}
    const ready=loaded.filter(v=>!P.departCheck(V,v.id)),stuck=loaded.filter(v=>P.departCheck(V,v.id));
    const val=v=>v.load.reduce((a,q)=>a+V.items[q.item].value,0),nm=v=>`${v.name.toLowerCase()} ${v.id+1}`,to=v=>P.destOf(V,v)==='lab'?'the lab':'the front';
    const lines=[];
    if(ready.length)lines.push(`${ready.map(v=>`The ${nm(v)} is loaded for ${to(v)} (${val(v)} cr)`).join('; ')}. Launch ${ready.length===1?'it':'them'} before ending the leg?`);
    for(const v of stuck)lines.push(`The ${nm(v)} is loaded but can't launch: ${P.departCheck(V,v.id).replace(/^The [^:]*? is /,'it is ')}.`);
    $('psGuardText').textContent=lines.join(' ');
    $('psGuardSend').hidden=!ready.length;$('psGuardSend').textContent=ready.length>1?'Launch them and end leg':'Launch and end leg';
    $('psGuardKeep').textContent=ready.length?`Keep ${ready.length+stuck.length>1?'them':'it'} loaded and end leg`:'End leg anyway';
    $('psGuardMute').checked=false;$('psGuard').hidden=false;guardReady=ready.map(v=>v.id);
    (ready.length?$('psGuardSend'):$('psGuardKeep')).focus();
  }
  let guardReady=[];
  function closeGuard(){const g=$('psGuard');if(g)g.hidden=true;}
  function guardChoice(choice){
    if($('psGuard').hidden)return;
    if($('psGuardMute').checked&&choice!=='cancel'){guardMuted=true;}
    closeGuard();
    if(choice==='cancel'){shell.status('Still on this leg.');$('psEndLeg').focus();return;}
    if(choice==='send')for(const vi of guardReady){if(!P.departCheck(V,vi)){P.act(V,{type:'depart',vehicle:vi});count.moves++;shell.log('depart',{vehicle:vi,via:'guard'});}}
    doEndLeg();
  }
  function doEndLeg(){
    if(locked())return;
    shell.begin();P.act(V,{type:'end'});count.moves++;shell.log('end',{leg:V.lastReport.leg});
    history=[];selected=null;aim=null;hintMove=null;leaving=null;transformed=null;sync();
    if(V.over){finishVoyage();return;}
    sizeCells();render();
    const r=V.lastReport;shell.status(`Leg ${V.leg} of ${V.legs}: ${V.arrivals[V.leg-1].length} new goods on the dock${r.paid+r.bonus?` · +${r.paid+r.bonus} cr delivered last leg`:''}${r.returned.length?` · ${r.returned.map(i=>V.vehicles[i].name+' '+(i+1)).join(' and ')} back from orbit`:''}.`,'good');
    document.querySelectorAll('.ps-card.ps-new').forEach(el=>shell.flash(el));
  }
  function finishVoyage(){
    dispatched=true;render();
    const tier=P.voyageTier(V),shipped=V.items.filter(it=>it.status==='shipped'),lab=shipped.filter(it=>it.dest==='lab').length,ups=V.log.filter(a=>a.type==='upgrade').length;
    const headline=tier==='failed'?'Nothing reached the front or the lab this voyage.':`${V.delivered} cr delivered over ${V.legs} legs (par ${V.par})${tier==='perfect'?': at or above par.':'.'}`;
    shell.finish({tier,score:V.delivered,headline,nearMiss:P.voyageNearMiss(V),output:P.voyageOutput(V),
      stats:{Delivered:`${V.delivered} / par ${V.par}`,Launches:String(V.launches||0),'To the front':`${shipped.length-lab} crates`,'To the lab':`${lab} samples`,'Items launched':`${shipped.length} of ${V.items.length}`,'Order bonuses':`${V.bonuses} cr`,Rockets:V.vehicles.map(v=>v.name).join(', '),Upgrades:String(ups),
        Scrapped:String(V.items.filter(it=>it.status==='scrapped').length),Hints:String(count.hints),Settings:P.settingsText(V.settings)}});
  }
  function onUndo(){
    if(locked()||!history.length)return;
    if(voyage()){V=history.pop();sync();}else st=history.pop();
    count.undos++;selected=null;aim=null;hintMove=null;leaving=null;sizeCells();render();shell.status('Undone.');
  }
  function onHint(){
    if(locked())return;count.hints++;aim=null;
    if(!voyage()){
      const h=P.hint(pz,st);hintMove=h;
      if(h.type==='place'){selected=h.crate;render();ghost(h.pallet,P.columnFor(pz,h.crate,h.x));}else{selected=null;render();}
      shell.status('Hint: '+h.text,'good');return;
    }
    const h=P.voyageHint(V);hintMove=h;
    if(h.type==='place'){selected=h.item;render();ghost(h.vehicle,P.columnFor(pz,h.item,h.x));}else{selected=null;render();}
    shell.status('Hint: '+h.text,'good');
  }
  function onAuto(){
    if(voyage()){
      V=P.autoVoyage(V);sync();dispatched=true;selected=null;aim=null;hintMove=null;render();
      const shipped=V.items.filter(it=>it.status==='shipped').length;
      return {score:V.delivered,headline:`The pad crew ran the rest of the voyage: loaded by value, launched anything loaded, never built or upgraded. ${V.delivered} cr delivered (par ${V.par}).`,
        nearMiss:P.voyageNearMiss(V),output:P.voyageOutput(V),stats:{Delivered:`${V.delivered} / par ${V.par}`,'Items launched':`${shipped} of ${V.items.length}`,Rockets:String(V.vehicles.length),Settings:P.settingsText(V.settings)}};
    }
    const a=P.auto(pz),ev=a.evaluation,near=P.nearMiss(pz,a.state);st=a.state;history=[];selected=null;aim=null;hintMove=null;dispatched=true;render();departAll(ev);
    return {score:a.shipped,headline:`The pad crew loaded biggest first and got stuck: ${a.shipped} of ${ev.total} crates launched${ev.left?`, ${ev.left} left on the dock`:''}${ev.tipped.length?`, ${ev.tipped.length} rocket${ev.tipped.length===1?'':'s'} off-centre`:''}.`,
      nearMiss:near,output:P.output(pz,ev),delivery:{kind:'cargo',shippedIds:ev.shipped.slice(),total:ev.total},stats:{Launched:`${a.shipped} / ${ev.total}`,'Left on dock':String(ev.left),'Rockets centred':`${ev.pallets.filter(s=>s.count&&s.balanced).length}/${ev.pallets.filter(s=>s.count).length}`}};
  }
  function departAll(ev){
    $('psDispatch').disabled=true;
    document.querySelectorAll('[data-pallet-box]').forEach((el,p)=>{const s=ev.pallets[p];el.classList.add(s.count&&!s.balanced?'tipped':s.count?'level':'idle');});
    requestAnimationFrame(()=>$('psRoot').classList.add('ps-departing'));
  }
  function dispatch(){
    if(locked())return;
    shell.begin();dispatched=true;selected=null;aim=null;hintMove=null;
    const ev=P.evaluate(pz,st),tier=P.tier(pz,ev,count.hints);
    shell.log('dispatch',{shipped:ev.shipped.length,tier});render();departAll(ev);
    const tipped=ev.tipped.map(s=>pz.pallets[s.pallet].name);
    const headline=tier==='perfect'?`Dock cleared: all ${ev.total} crates launched, every rocket centred, no hints.`
      :tier==='good'?`Dock cleared with ${count.hints} hint${count.hints===1?'':'s'}: all ${ev.total} crates launched centred.`
      :tier==='failed'?(st.placed.length?`Nothing reached the front: ${tipped.join(' and ')} stayed on the pad, off-centre.`:'No rocket was loaded.')
      :`${ev.shipped.length} of ${ev.total} crates launched${ev.left?`; ${ev.left} left on the dock`:''}${tipped.length?`; ${tipped.join(' and ')} off-centre`:''}.`;
    const result={tier,score:ev.shipped.length,headline,nearMiss:P.nearMiss(pz,st),output:P.output(pz,ev),delivery:{kind:'cargo',shippedIds:ev.shipped.slice(),total:ev.total},
      stats:{Launched:`${ev.shipped.length} / ${ev.total}`,'Left on dock':String(ev.left),
        'Rockets centred':`${ev.pallets.filter(s=>s.count&&s.balanced).length}/${ev.pallets.filter(s=>s.count).length}`,Moves:String(count.moves),Undos:String(count.undos),Hints:String(count.hints)}};
    setTimeout(()=>shell.finish(result),reduced()?0:1150);
  }

  // ---- events -----------------------------------------------------------------------------------------------------
  stage.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return;
    if(t.dataset.crate!==undefined){select(+t.dataset.crate);
      if(e.detail===0&&selected!==null){const c=pz.crates[selected],ok=[...stage.querySelectorAll('.ps-col')].find(b=>!P.landing(pz,st,c.id,+b.dataset.pallet,P.anchorFor(pz,c.id,+b.dataset.pallet,+b.dataset.col)).reason);if(ok)ok.focus();}}
    else if(t.classList.contains('ps-col'))place(+t.dataset.pallet,+t.dataset.col,t);
    else if(t.dataset.placed!==undefined){if(selected===null)lift(+t.dataset.placed,t);}
    else if(t.dataset.depart!==undefined)depart(+t.dataset.depart,t);
    else if(t.dataset.buy!==undefined)buy({type:'buy'},t);
    else if(t.dataset.preset!==undefined)applySettings({preset:t.dataset.preset});
    else if(t.id==='psApplySettings')applySettings({preset:'custom',start:+$('psSetStart').value,maxFleet:+$('psSetMax').value,priceScale:+$('psSetPrice').value,incomeScale:+$('psSetIncome').value,legs:+$('psSetLegs').value});
    else if(t.id==='psGuardSend')guardChoice('send');else if(t.id==='psGuardKeep')guardChoice('keep');else if(t.id==='psGuardCancel')guardChoice('cancel');
    else if(t.dataset.upgrade!==undefined){const [v,kind]=t.dataset.upgrade.split(':');buy({type:'upgrade',vehicle:+v,kind},t);}
    else if(t.dataset.scrap!==undefined)scrap(+t.dataset.scrap,t);
    else if(t.id==='psDispatch')dispatch();
    else if(t.id==='psEndLeg')endLeg();
  });
  // Mouse and pen preview on hover; touch and keyboard preview on focus. The ghost never commits by itself.
  stage.addEventListener('pointerover',e=>{const c=e.target.closest('.ps-col');if(c&&e.pointerType!=='touch')ghost(+c.dataset.pallet,+c.dataset.col);});
  stage.addEventListener('pointerleave',()=>{if(aim&&!hintMove){aim=null;clearGhost();}});
  stage.addEventListener('focusin',e=>{const c=e.target.closest('.ps-col');if(c)ghost(+c.dataset.pallet,+c.dataset.col);});
  // The guard pref lives in the side panel (outside the stage).
  document.addEventListener('change',e=>{if(e.target.id!=='psGuardPref')return;prefs={...loadPrefs(),guard:e.target.checked};savePrefs(prefs);guardMuted=false;
    shell.status(e.target.checked?'You will be asked before ending a leg with a loaded rocket.':'End leg will no longer ask about loaded rockets.');});
  $('psSettings').addEventListener('toggle',()=>{if(!$('psSettings').open){prefs={...loadPrefs(),seenSettings:true};savePrefs(prefs);}});
  document.addEventListener('keydown',e=>{
    if(!$('psGuard').hidden){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();guardChoice('cancel');}
      else if(e.key==='Enter'&&e.target.tagName!=='BUTTON'&&e.target.type!=='checkbox'){e.preventDefault();guardChoice($('psGuardSend').hidden?'keep':'send');}return;}
    if(e.key==='Escape'&&selected!==null&&document.getElementById('mgResult').hidden){select(selected);return;}
    const c=e.target.closest&&e.target.closest('.ps-col');if(!c||!['ArrowLeft','ArrowRight'].includes(e.key))return;
    const next=c.parentElement.querySelector(`.ps-col[data-col="${+c.dataset.col+(e.key==='ArrowLeft'?-1:1)}"]`);if(next){e.preventDefault();next.focus();}
  });
  let resizeT=null;window.addEventListener('resize',()=>{clearTimeout(resizeT);resizeT=setTimeout(()=>{if(pz){sizeCells();if(!dispatched)render();}},120);});
  shell.start();
  window.PalletStackingUI={get puzzle(){return pz;},get state(){return st;},get voyage(){return V;}};
})();
