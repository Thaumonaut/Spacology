// Gear assembly: UI wiring. Rules, solver, hints and tiers live in gear-pack-model.js (window.GearPack).
(function(){
  'use strict';
  const K=MiniGameKit,G=GearPack,esc=K.esc;
  const LEVEL_KEY='spacologyGearPackAssistV1',RANK={puzzle:0,guided:1,relaxed:2};
  const loadLevel=()=>{try{const v=localStorage.getItem(LEVEL_KEY);return RANK[v]!==undefined?v:'puzzle';}catch{return 'puzzle';}};
  let level=loadLevel(),levelUsed=level;
  let shipTimer=null,P=null,st=null,ev=null,hist=[],sel=null,rot=0,hintCells=null,hintsUsed=0,moves=0,drag=null,suppress=false,shipArmed=false,shipping=false,focusStat=null,lastEv=null;
  const shell=K.shell({id:'gear-pack',rules:G.RULES,defaultDifficulty:'normal',
    difficulties:G.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),
    onNew,onAuto,onUndo,onHint});
  const $=id=>document.getElementById(id);
  const TY=i=>G.TYPES[P.parts[i].type],crew=o=>P.orders[o].crew;
  const busy=()=>shell.ended||shipping;
  const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const statTag=t=>t.stat?`${t.stat} +${t.value}`:'⚡ +1 to touching parts';

  // A soft click when a part snaps in. Created on the first gesture; silent if audio is unavailable.
  let audio=null;
  function click(high){try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
    o.type='triangle';o.frequency.setValueAtTime(high?1250:820,t);o.frequency.exponentialRampToValueAtTime(high?620:360,t+0.05);g.gain.setValueAtTime(0.07,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.07);
    o.connect(g).connect(audio.destination);o.start(t);o.stop(t+0.08);}catch{}}

  function onNew({seed,difficulty}){
    clearTimeout(shipTimer);shipTimer=null;shell.controls({auto:true,hint:true});
    P=G.generate(seed,difficulty);st=G.initial(P);hist=[];sel=null;rot=0;hintCells=null;hintsUsed=0;moves=0;shipArmed=false;shipping=false;focusStat=null;lastEv=null;levelUsed=level;
    shell.stage.innerHTML=`<div class="gp" id="gpRoot" data-sel="" data-rot="0">
<div class="gp-orders" id="gpOrders">${P.orders.map((O,o)=>`<section class="gp-order" data-order="${o}" style="--w:${O.w};--h:${O.h}">
<header class="gp-order-head"><p class="eyebrow">LT ORDER · GEAR KIT</p><h3>${esc(O.crew)} <small>${esc(O.role)}</small></h3><span class="gp-fit">fits ${O.w}×${O.h}</span></header>
<div class="gp-bars" id="gpBars${o}"></div>
<div class="gp-crate"><div class="gp-frame" id="gpFrame${o}" role="grid" aria-label="${esc(`${O.crew}'s frame, ${O.w} columns by ${O.h} rows`)}"></div><div class="gp-ghost" id="gpGhost${o}" aria-hidden="true"></div><div class="gp-lid" aria-hidden="true"></div></div>
<span class="gp-stamp" aria-hidden="true">READY</span></section>`).join('')}</div>
<section class="gp-dock"><div class="gp-tools"><button id="gpRotate" aria-keyshortcuts="R">Rotate ↻</button><button id="gpRemove">To tray</button><button id="gpShip" class="primary">Ship at dawn</button></div>
<p class="eyebrow">PARTS TRAY · MADE BY TONIGHT'S SUPPLY RUN</p><div id="gpTray" class="gp-tray"></div></section></div>`;
    shell.side(`<p class="eyebrow">ASSIST LEVEL</p><div class="gp-levels">${G.ASSIST_LEVELS.map(l=>`<label class="gp-level"><input type="radio" name="gpLevel" value="${l.id}"${l.id===level?' checked':''}><span><b>${esc(l.label)}</b><small>${esc(l.note)}</small></span></label>`).join('')}</div>
<p class="gp-fine">Keys: R turns the selected part, Delete sends it to the tray, Esc deselects.</p>`);
    document.querySelectorAll('input[name="gpLevel"]').forEach(r=>r.addEventListener('change',e=>{if(e.target.checked)setLevel(e.target.value);}));
    $('gpRotate').onclick=rotate;$('gpRemove').onclick=toTray;$('gpShip').onclick=ship;
    $('gpTray').addEventListener('click',e=>{const b=e.target.closest('[data-part]');if(!b||suppress||busy())return;tapPart(+b.dataset.part);});
    const orders=$('gpOrders');
    orders.addEventListener('click',e=>{if(suppress||busy())return;const c=e.target.closest('.gp-cell');if(c)return tap(+c.dataset.o,+c.dataset.cell);
      const bar=e.target.closest('[data-stat]');if(bar){const k=bar.dataset.order+':'+bar.dataset.stat;focusStat=focusStat===k?null:k;render();}});
    orders.addEventListener('pointerover',e=>{const bar=e.target.closest('[data-stat]');if(bar&&e.pointerType==='mouse')highlight(+bar.dataset.order,bar.dataset.stat);});
    orders.addEventListener('pointerout',e=>{if(e.target.closest('[data-stat]')&&e.pointerType==='mouse')highlight(null);});
    orders.addEventListener('pointermove',e=>{if(drag||e.pointerType!=='mouse')return;const c=e.target.closest('.gp-cell');ghost(c?+c.dataset.o:null,c?+c.dataset.cell:null);});
    orders.addEventListener('pointerleave',()=>{if(!drag)ghost(null);});
    orders.addEventListener('focusin',e=>{const c=e.target.closest('.gp-cell');if(c&&!drag)ghost(+c.dataset.o,+c.dataset.cell);});
    orders.addEventListener('keydown',e=>{const c=e.target.closest('.gp-cell');if(!c)return;const o=+c.dataset.o,O=P.orders[o],k=+c.dataset.cell,x=k%O.w,y=(k-x)/O.w,d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(d){e.preventDefault();const nx=Math.max(0,Math.min(O.w-1,x+d[0])),ny=Math.max(0,Math.min(O.h-1,y+d[1]));cellEl(o,ny*O.w+nx).focus();}});
    for(const el of [orders,$('gpTray')])el.addEventListener('pointerdown',down);
    render();
    const n=P.orders.length;
    shell.status(n>1?`${n} orders tonight, one tray of parts to share. Par is ${P.par} parts in all.`:`${crew(0)} needs a kit by dawn. Par is ${P.par} parts.`);
  }
  function setLevel(id){
    level=id;try{localStorage.setItem(LEVEL_KEY,id);}catch{}
    if(P&&!shell.ended&&RANK[id]>RANK[levelUsed])levelUsed=id;
    shell.log('level',{level:id});render();
    shell.status(`${G.ASSIST_LEVELS.find(l=>l.id===id).label}: ${G.ASSIST_LEVELS.find(l=>l.id===id).note}`);
  }

  // ---- moves ----
  function act(move,msg,opts={}){
    const r=G.apply(P,st,move);
    if(r.error){shell.status(r.error,'bad');shake(opts.o,opts.cell);ghost(null);return false;}
    shell.begin();hist.push(st);st=r.state;moves++;hintCells=null;shipArmed=false;
    shell.log(move.type,{part:move.part,order:move.order,x:move.x,y:move.y,rot:move.rot});
    if(move.type==='place')rot=move.rot;
    const why=move.type==='place'?G.reason(P,hist[hist.length-1],move):'';
    render();ghost(null);
    if(move.type==='place'){click(false);cellsOf(move.part).forEach(el=>shell.flash(el,'gp-snap'));}
    const done=ev.allMet?` Every order is ready${ev.used<=P.par?` at par (${P.par} parts)`:` (${ev.used} parts; par is ${P.par})`}: ship at dawn.`:'';
    shell.status(msg+(why?` ${why[0].toUpperCase()+why.slice(1)}.`:'')+done,ev.allMet?'good':'');
    return true;
  }
  function choose(i){
    sel=i;rot=st.placed[i]?st.placed[i].rot:0;render();
    const t=TY(i);
    shell.status(`${t.name} (${statTag(t)}) selected. ${st.placed[i]?`It is in ${crew(st.placed[i].order)}'s frame: tap a cell to move it, or send it to the tray.`:'Tap a frame cell to fit it, or drag it there.'} ↻ turns it.`);
  }
  function tapPart(i){
    if(level==='relaxed'&&!st.placed[i]){
      const s=G.bestSpot(P,st,i);
      if(!s){choose(i);return shell.status(`No order needs the ${TY(i).name} right now: it stays in stock.`,'warn');}
      sel=i;return act({type:'place',part:i,...s},`${TY(i).name} dropped into ${crew(s.order)}'s frame.`);
    }
    if(sel===i&&!st.placed[i])return rotate();
    choose(i);
  }
  function tap(o,k){
    const O=P.orders[o],x=k%O.w,y=(k-x)/O.w,at=partAt(o,x,y);
    if(sel!==null){
      if(at===sel)return rotate();
      if(at>=0)return choose(at);
      return placePart(sel,o,x,y,null,k);
    }
    if(at>=0)return choose(at);
    shell.status('Pick a part from the tray first.');
  }
  function partAt(o,x,y){for(let i=0;i<P.parts.length;i++){const p=st.placed[i];if(p&&p.order===o&&G.cellsAt(P,i,p).some(c=>c[0]===x&&c[1]===y))return i;}return -1;}
  // Where part i would go for a pointer at frame o, cell k: the grabbed offset if legal, else the nearest snap.
  function resolve(i,o,k,grab){
    const O=P.orders[o],x=k%O.w,y=(k-x)/O.w;
    let p=grab?{order:o,rot,x:x-grab[0],y:y-grab[1]}:null;if(p&&G.validate(P,st,{type:'place',part:i,...p}))p=null;
    if(!p)p=G.snap(P,st,i,o,rot,x,y);if(p)return {p,ok:true};
    const pv=G.pivot(G.oriented(P,i,rot));return {p:grab?{order:o,rot,x:x-grab[0],y:y-grab[1]}:{order:o,rot,x:x-pv[0],y:y-pv[1]},ok:false};
  }
  function placePart(i,o,x,y,grab,k){
    const res=resolve(i,o,k,grab);
    if(!res.ok){shell.status(G.validate(P,st,{type:'place',part:i,...res.p})||`No room for the ${TY(i).name} there.`,'bad');shake(o,k);ghost(null);return false;}
    const p=st.placed[i];if(p&&p.order===res.p.order&&p.x===res.p.x&&p.y===res.p.y&&p.rot===res.p.rot){shell.status(`The ${TY(i).name} is already there.`);return false;}
    return act({type:'place',part:i,...res.p},`${TY(i).name} ${p?(p.order===o?'moved':`moved to ${crew(o)}'s frame`):`fitted in ${crew(o)}'s frame`}.`,{o,cell:k});
  }
  function rotate(){
    if(sel===null||busy())return;
    const i=sel,nr=(rot+1)%4,p=st.placed[i];
    if(!p){rot=nr;render();return shell.status(`${TY(i).name} turned.`);}
    const pv=G.pivot(G.oriented(P,i,p.rot)),q=G.snap(P,st,i,p.order,nr,p.x+pv[0],p.y+pv[1]);
    if(!q){shake(p.order);return shell.status('No room to turn it here. Move it first.','bad');}
    act({type:'place',part:i,...q},`${TY(i).name} turned.`);
  }
  function toTray(){
    if(sel===null||busy()||!st.placed[sel])return;
    const o=st.placed[sel].order;act({type:'remove',part:sel},`${TY(sel).name} back in the tray, out of ${crew(o)}'s frame.`);
  }
  function onUndo(){if(!hist.length||shipping)return;st=hist.pop();hintCells=null;shipArmed=false;if(sel!==null&&st.placed[sel])rot=st.placed[sel].rot;render();ghost(null);shell.status('Undone.');}
  function onHint(){
    if(shipping)return;
    const h=G.hint(P,st);
    if(!h){shell.status('Nothing to add: every order is ready at par. Ship at dawn.','good');return;}
    hintsUsed++;const m=h.move;sel=m.part;
    if(m.type==='place'){rot=m.rot;hintCells={o:m.order,cells:G.cellsAt(P,m.part,m).map(([x,y])=>y*P.orders[m.order].w+x)};}
    else{const p=st.placed[m.part];rot=p.rot;hintCells={o:p.order,cells:G.cellsAt(P,m.part,p).map(([x,y])=>y*P.orders[p.order].w+x)};}
    render();shell.status('Hint: '+h.text);
  }
  function onAuto(){
    const a=G.autoAssembly(P);hist=[];st=a.state;sel=null;hintCells=null;render();ghost(null);
    return {score:null,headline:`The night shift grabbed whatever helped most at each step: ${ev.met} of ${P.orders.length} order${P.orders.length>1?'s':''} ready with ${ev.used} parts (par ${P.par}).`,
      nearMiss:G.nearMiss(P,st)||`Par plans the Power cells and lenses first, so each part lands where it touches the most.`,output:outText(),stats:stats(),delivery:delivery()};
  }
  function ship(){
    if(busy())return;
    const short=P.orders.length-ev.met;
    if(short&&!shipArmed){shipArmed=true;render();shake();return shell.status(`${short} order${short>1?'s are':' is'} not ready. Press again to ship anyway: unmet kits are held back.`,'warn');}
    const tier=G.tier(P,ev,{hints:hintsUsed,level:levelUsed}),relaxed=levelUsed==='relaxed';
    const head={perfect:`Every kit built at par: ${ev.used} part${ev.used>1?'s':''}, nothing wasted.`,
      good:`${relaxed?'Solved · Relaxed. ':''}Every order ready with ${ev.used} parts${ev.used>P.par?` (par ${P.par})`:''}${hintsUsed?` and ${hintsUsed} hint${hintsUsed>1?'s':''}`:''}.`,
      partial:`${ev.met} of ${P.orders.length} orders ready: the rest are held back.`,
      failed:'No kit met its order: nothing ships tonight.'}[tier];
    const result={tier,score:ev.used,headline:head,nearMiss:G.nearMiss(P,st),output:outText(),stats:stats(),delivery:delivery()};
    shipping=true;sel=null;render();shell.controls({auto:false,hint:false,undo:false});
    $('gpOrders').classList.add('shipping');
    shipTimer=setTimeout(()=>{shipTimer=null;shipping=false;shell.controls({auto:true,hint:true});shell.finish(result);},reduced()?0:750);
  }
  const stats=()=>({'Orders ready':`${ev.met}/${P.orders.length}`,'Parts used':`${ev.used} (par ${P.par})`,Hints:String(hintsUsed),'Assist level':G.ASSIST_LEVELS.find(l=>l.id===levelUsed).label,Moves:String(moves)});
  function delivery(){return {kind:'gear',kits:ev.orders.flatMap((o,i)=>o.met?[{crew:P.orders[i].crew,stats:{...o.tot}}]:[])};}
  function outText(){const o=G.output(P,st);return shell.embedded?o.replace(/^Shipped at dawn:/,'Ready for cargo:'):o;}

  // ---- drag (pointer events: mouse, pen and touch) ----
  function down(e){
    if(busy()||e.button>0)return;
    const card=e.target.closest('#gpTray [data-part]'),cell=e.target.closest('.gp-cell');let i=-1,grab=null;
    if(card)i=+card.dataset.part;
    else if(cell){const o=+cell.dataset.o,O=P.orders[o],k=+cell.dataset.cell,x=k%O.w,y=(k-x)/O.w;i=partAt(o,x,y);if(i>=0)grab=[x-st.placed[i].x,y-st.placed[i].y];}
    if(i<0)return;drag={i,grab,x0:e.clientX,y0:e.clientY,active:false,from:card?'tray':'frame'};
  }
  document.addEventListener('pointermove',e=>{
    if(!drag)return;
    if(!drag.active){if(Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)<10)return;drag.active=true;
      if(sel!==drag.i){sel=drag.i;rot=st.placed[sel]?st.placed[sel].rot:0;}
      // A part dragged into another frame keeps its turn but not its grab offset.
      hintCells=null;render();document.body.classList.add('gp-dragging');}
    e.preventDefault();const c=document.elementFromPoint(e.clientX,e.clientY)?.closest('.gp-cell');
    if(c){const o=+c.dataset.o,g=drag.grab&&st.placed[drag.i]&&st.placed[drag.i].order===o?drag.grab:null;ghost(o,+c.dataset.cell,g);}else ghost(null);
  },{passive:false});
  document.addEventListener('pointerup',e=>{
    if(!drag)return;const d=drag;drag=null;document.body.classList.remove('gp-dragging');if(!d.active)return;
    suppress=true;setTimeout(()=>{suppress=false;},0);
    const c=document.elementFromPoint(e.clientX,e.clientY)?.closest('.gp-cell');
    if(c){const o=+c.dataset.o,O=P.orders[o],k=+c.dataset.cell,g=d.grab&&st.placed[d.i]&&st.placed[d.i].order===o?d.grab:null;placePart(d.i,o,k%O.w,(k-k%O.w)/O.w,g,k);}
    else if(d.from==='frame'){sel=d.i;toTray();}
    else ghost(null);
  });
  document.addEventListener('pointercancel',()=>{drag=null;document.body.classList.remove('gp-dragging');ghost(null);});
  document.addEventListener('keydown',e=>{
    if(!P||busy()||e.target.matches('input,select,textarea')||e.metaKey||e.ctrlKey)return;
    if(e.key==='r'||e.key==='R'){e.preventDefault();rotate();}
    else if((e.key==='Delete'||e.key==='Backspace')&&sel!==null){e.preventDefault();toTray();}
    else if(e.key==='Escape'&&sel!==null){sel=null;render();ghost(null);}
  });

  // ---- rendering ----
  const cellEl=(o,k)=>document.querySelector(`#gpFrame${o} [data-cell="${k}"]`);
  const cellsOf=i=>{const p=st.placed[i];return p?G.cellsAt(P,i,p).map(([x,y])=>cellEl(p.order,y*P.orders[p.order].w+x)).filter(Boolean):[];};
  function shake(o,k){const el=o==null?$('gpOrders'):k!=null?cellEl(o,k):$('gpFrame'+o);if(el)shell.flash(el,'mg-shake');}
  const box=(O,x,y)=>`left:${x/O.w*100}%;top:${y/O.h*100}%;width:${100/O.w}%;height:${100/O.h}%`;
  // Hover or tap a stat bar: the parts that feed it glow (and the Power cells and lenses that boost them).
  function highlight(o,stat){
    document.querySelectorAll('.gp-cell.src').forEach(c=>c.classList.remove('src'));
    document.querySelectorAll('.gp-seg.on').forEach(c=>c.classList.remove('on'));
    if(o==null){if(focusStat){const [fo,fs]=focusStat.split(':');if(+fo!==o||fs!==stat)highlight(+fo,fs);}return;}
    const s=ev.orders[o].stats[stat];if(!s)return;
    const ids=new Set(s.from.flatMap(f=>f.via>=0?[f.part,f.via]:[f.part]));
    ids.forEach(i=>cellsOf(i).forEach(c=>c.classList.add('src')));
    document.querySelectorAll(`#gpBars${o} [data-stat="${stat}"] .gp-seg`).forEach(c=>c.classList.add('on'));
  }
  // Ghost footprint plus what the part would do there, before you commit.
  function ghost(o,k,grab){
    document.querySelectorAll('.gp-ghost').forEach(g=>{g.innerHTML='';});
    if(o==null||sel===null||busy())return;
    const O=P.orders[o],res=resolve(sel,o,k,grab),cells=G.cellsAt(P,sel,res.p);
    $('gpGhost'+o).innerHTML=cells.filter(([x,y])=>x>=0&&y>=0&&x<O.w&&y<O.h).map(([x,y])=>`<i class="g ${res.ok?'g-ok':'g-bad'}" style="${box(O,x,y)}"></i>`).join('');
    if(drag&&drag.active){
      if(res.ok){const why=G.reason(P,st,{type:'place',part:sel,...res.p});shell.status(`${TY(sel).name} here: ${why}.`,why.includes('adds nothing')?'warn':'good');}
      else shell.status(G.validate(P,st,{type:'place',part:sel,...res.p})||'No room here.','bad');
    }
  }
  function mini(cells,color,rule){
    const w=Math.max(...cells.map(p=>p[0]))+1,h=Math.max(...cells.map(p=>p[1]))+1;
    return `<span class="gp-mini" style="--mw:${w};--mh:${h}">${cells.map(([x,y])=>`<i style="grid-column:${x+1};grid-row:${y+1};--c:${color}">${rule==='power'?'⚡':rule==='focus'?'◎':''}</i>`).join('')}</span>`;
  }
  const KIND_ICON={power:'⚡',focus:'◎'};
  function bars(o){
    const O=P.orders[o],x=ev.orders[o],was=lastEv&&lastEv.orders[o];
    return Object.entries(x.stats).map(([s,v])=>{
      const scale=Math.max(v.target,v.value,1),info=G.STAT_INFO[s];
      const segs=v.from.map(f=>{const t=TY(f.part),src=f.kind==='base'?t.name:`${G.partName(P,f.via)} ${f.kind==='power'?'powers':'focuses'} the ${t.name}`;
        return `<i class="gp-seg k-${f.kind}" style="width:${f.amount/scale*100}%;--c:${t.color}" title="${esc(`${src}: +${f.amount} ${s}`)}">${f.kind==='base'?'':KIND_ICON[f.kind]}</i>`;}).join('');
      const up=was&&was.stats[s]&&v.value>was.stats[s].value?v.value-was.stats[s].value:0;
      const focused=focusStat===`${o}:${s}`;
      return `<button class="gp-bar ${v.met?'met':''} ${focused?'focus':''}" data-order="${o}" data-stat="${s}" aria-pressed="${focused}" aria-label="${esc(`${s} ${v.value} of ${v.target}${v.met?', met':''}. Show the parts that feed it.`)}">
<span class="gp-bar-l" style="--sc:${info.color}">${info.icon} ${s}</span><span class="gp-track"><span class="gp-fill">${segs}</span><span class="gp-goal" style="left:${v.target/scale*100}%"></span></span>
<span class="gp-bar-v"><b>${v.value}</b>/${v.target}${up?`<em class="gp-up">+${up}</em>`:''}</span></button>`;}).join('')+
      (Object.keys(x.extra).length?`<p class="gp-extra">Also: ${Object.entries(x.extra).map(([s,v])=>`${s} ${v}`).join(' · ')} (not ordered)</p>`:'');
  }
  function frame(o){
    const O=P.orders[o],W=O.w,grid=new Array(W*O.h).fill(-1);
    st.placed.forEach((p,i)=>{if(p&&p.order===o)for(const [x,y] of G.cellsAt(P,i,p))grid[y*W+x]=i;});
    const mk=new Map();ev.marks.filter(m=>m.order===o).forEach(m=>{const k=m.y*W+m.x;if(!mk.has(k))mk.set(k,[]);mk.get(k).push(m);});
    const hint=hintCells&&hintCells.o===o?hintCells.cells:[];
    return grid.map((pi,k)=>{
      const x=k%W,y=(k-x)/W,cls=['gp-cell'],sty=[];let inner='',lab=`${O.crew}'s frame, row ${y+1}, column ${x+1}: `;
      const same=(dx,dy)=>{const nx=x+dx,ny=y+dy;return nx>=0&&ny>=0&&nx<W&&ny<O.h&&grid[ny*W+nx]===pi;};
      if(pi>=0){const t=TY(pi),p=st.placed[pi];cls.push('item');if(same(0,-1))cls.push('it');if(same(1,0))cls.push('ir');if(same(0,1))cls.push('ib');if(same(-1,0))cls.push('il');sty.push(`--c:${t.color}`);
        if(sel===pi)cls.push('sel');
        const pv=G.pivot(G.oriented(P,pi,p.rot));if(x-p.x===pv[0]&&y-p.y===pv[1])inner+=`<span class="gp-tag">${t.code}</span>`;
        lab+=`${t.name} (${statTag(t)})`;}
      else lab+='empty';
      const ms=mk.get(k)||[];inner+=ms.map(m=>`<span class="gp-mk s-${m.side} ${m.kind} ${m.lit?'lit':''}">${KIND_ICON[m.kind]}</span>`).join('');
      if(ms.some(m=>m.lit))lab+=`, ${ms.filter(m=>m.lit).length} synergy link${ms.filter(m=>m.lit).length>1?'s':''} lit`;
      if(hint.includes(k))cls.push('hint');
      return `<button class="${cls.join(' ')}" data-o="${o}" data-cell="${k}" role="gridcell" aria-label="${esc(lab)}" style="${sty.join(';')}">${inner}</button>`;}).join('');
  }
  function render(){
    ev=G.evaluate(P,st);
    shell.meters([{label:'Orders ready',value:`${ev.met} / ${P.orders.length}`,tone:ev.allMet?'good':''},
      {label:'Parts used',value:`${ev.used} · par ${P.par}`,tone:ev.allMet?(ev.used<=P.par?'good':'warn'):''}]);
    const root=$('gpRoot');root.dataset.sel=sel===null?'':String(sel);root.dataset.rot=String(rot);root.dataset.level=level;
    P.orders.forEach((O,o)=>{
      const card=document.querySelector(`.gp-order[data-order="${o}"]`),x=ev.orders[o],was=lastEv&&lastEv.orders[o];
      card.classList.toggle('ready',x.met);if(x.met&&was&&!was.met){card.classList.remove('stamp-in');void card.offsetWidth;card.classList.add('stamp-in');click(true);}
      if(!x.met)card.classList.remove('stamp-in');
      $('gpBars'+o).innerHTML=bars(o);$('gpFrame'+o).innerHTML=frame(o);
      if(was)Object.entries(x.stats).forEach(([s,v])=>{if(was.stats[s]&&v.value!==was.stats[s].value)shell.flash(document.querySelector(`#gpBars${o} [data-stat="${s}"] .gp-bar-v b`));});
    });
    // Tray: every part, its stat in plain words, and where it went.
    const guided=level==='guided'&&!busy();
    $('gpTray').innerHTML=P.parts.map((pt,i)=>{const t=G.TYPES[pt.type],p=st.placed[i],r=sel===i?rot:p?p.rot:0,cells=G.oriented(P,i,r);
      const help=guided&&G.helps(P,st,i);
      return `<button class="gp-card ${p?'used':''} ${sel===i?'sel':''} ${help?'helps':''}" data-part="${i}" aria-pressed="${sel===i}" aria-label="${esc(`${t.name}: ${t.text} ${p?`In ${crew(p.order)}'s frame.`:'In the tray.'}`)}" style="--c:${t.color}">
${mini(cells,t.color,t.rule)}<span class="gp-card-t"><b>${esc(t.name)}</b><span class="gp-stat" style="--sc:${t.stat?G.STAT_INFO[t.stat].color:'var(--gold)'}">${esc(statTag(t))}</span>${t.rule==='focus'?'<small>◎ +2 Burst to a touching Sequencer</small>':''}${p?`<small class="gp-where">in ${esc(crew(p.order))}'s kit</small>`:''}</span></button>`;}).join('');
    $('gpRotate').disabled=sel===null||busy();
    $('gpRemove').disabled=sel===null||!st.placed[sel]||busy();
    $('gpShip').disabled=busy();
    $('gpShip').textContent=shipArmed?(shell.embedded?'Finish anyway':'Ship anyway'):(shell.embedded?'Finish assembly':'Ship at dawn');$('gpShip').classList.toggle('armed',shipArmed);
    shell.undoEnabled(hist.length>0&&!busy());
    lastEv=ev;
    if(focusStat){const [fo,fs]=focusStat.split(':');highlight(+fo,fs);}
  }
  shell.start();
})();
