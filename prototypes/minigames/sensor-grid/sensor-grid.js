// Sensor placement UI (Research, night): scouting the battlefield of the upcoming elective fight. Wires SensorGrid
// (rules) into the MiniGameKit shell. All rule decisions, and the scout report, live in the model.
// Quality of life, as in the best Queens / Catdoku apps: auto-× on by default, probes ("what if" sensors whose
// consequences show without committing), row/column/zone highlight on hover or tap, ✓ and open counts on every line,
// one-step hints that light up the area they reason about, a mistake check, undo/redo and a closing cascade.
// Assist levels (Puzzle / Guided / Relaxed, remembered in localStorage) let the game do the simple deductions: Guided
// crosses out what is obvious after each move, Relaxed also drops forced sensors in, chaining like dominoes. A player
// move and its whole cascade are one undo step; the cascade is played back as a short animation over the final board.
// Big maps (9×9 to 15×15) get zoom: −/Fit/+ buttons, pinch with two fingers (two fingers also pan), ctrl/⌘ + wheel or a
// trackpad pinch, and scrollbars; one finger still taps and drags ×s at any zoom.
(function(){
  'use strict';
  const K=window.MiniGameKit,S=window.SensorGrid,esc=K.esc;
  const {EMPTY,SENSOR,X,AUTO,DEDUCED}=S;
  const REVEAL_STEP=150; // ms between zones in the closing reveal cascade
  const X_STEP=90,DROP_STEP=170,RIPPLE=30; // cascade playback: ms per × deduction, per dropped sensor, per cell of ripple
  const LEVEL_KEY='spacologySensorGridAssistV1',RANK={puzzle:0,guided:1,relaxed:2};
  const loadLevel=()=>{try{const v=localStorage.getItem(LEVEL_KEY);return RANK[v]!==undefined?v:'puzzle';}catch{return 'puzzle';}};
  let level=loadLevel(),levelUsed=level,dropped=new Set(),animView=null,animTimers=[];
  const levelOf=id=>S.ASSIST_LEVELS.find(l=>l.id===id);
  let P=null,G=null,marks=[],history=[],future=[],hints=[],errors=0,firstError=null,checks=0,autoView=null;
  let assist=true,assistOn=false,assistOff=false; // auto-× is the default; the stats record whether it was ever off
  let probes=new Set(),probeMode=false,probesUsed=0,checked=new Set(),hintFocus=new Set(),hl=null;
  let revealed=new Set(),cells=[],chips=[],rowHeads=[],colHeads=[],tools={},focus=0,t0=0,closing=false,timers=[],drag=null,suppressClick=false,endDrag=null;
  // Zoom: the cell size is real CSS px (never a transform), so taps, drag-to-× and keyboard focus work at any zoom.
  // fit = the size that fits the space (z = 1); z scales it, from "whole map in view" up to comfortable tap size.
  let zoom={fit:44,z:1,min:1,max:1},pinch=null;const touches=new Map();
  const go=()=>{if(!t0)t0=Date.now();shell.begin();};
  const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const busy=()=>shell.ended||closing||!!autoView;

  const shell=K.shell({
    id:'sensor-grid',
    difficulties:S.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),
    rules:[
      'The map is the battlefield of the upcoming <b>elective fight</b>, the harder optional battle. Place <b>one sensor</b> in every row, every column and every terrain zone.',
      '<b>Sensors never touch</b>, not even diagonally.',
      '<b>Tap</b> a cell to place what the <b>Sensor | ✕</b> switch is set to (tap again to clear it). <b>Drag</b> across cells to ✕ many at once. <b>Auto-×</b> crosses out what each sensor rules out.',
      '<b>Probe</b> (or right-click) tries a sensor without committing: the cells it would rule out are shaded and any line or zone left empty turns red. Probes are free.',
      '<b>Assist level</b> (side panel): Guided crosses out the obvious for you; Relaxed also drops forced sensors in. Perfect is kept for Puzzle.',
      'Every map has exactly one answer, reachable by logic alone. Solve it and each zone reveals the enemy contact holding it.',
      'The scout <b>lowers the elective fight’s difficulty</b>: more with every zone revealed and a cleaner solve. A <b>full scout</b> also strips one of its <b>affixes</b>.'
    ],
    onNew:fresh,onAuto:auto,onUndo:undo,onHint:giveHint
  });

  function fresh({seed,difficulty}){
    timers.forEach(clearTimeout);timers=[];finishAnim();levelUsed=level;dropped=new Set();
    P=S.generate(seed,difficulty);G=S.geo(P);marks=S.empty(P);history=[];future=[];hints=[];errors=0;firstError=null;checks=0;autoView=null;
    assistOn=assist;assistOff=!assist;probes=new Set();probeMode=false;probesUsed=0;checked=new Set();hintFocus=new Set();hl=null;
    revealed=new Set();focus=0;t0=0;closing=false;drag=null;pinch=null;touches.clear();zoom.z=1;
    shell.controls({auto:true,hint:true});
    build();layout();render();
    shell.status(`Elective fight battlefield: ${P.n} zones, ${P.n} sensors. One per row, column and zone, none touching.`);
  }

  // Region borders: a side is thick where the neighbour belongs to another zone (or is the map edge); an outer corner
  // of a zone is rounded so each zone reads as one soft shape.
  function edges(i){
    const n=P.n,x=i%n,y=Math.floor(i/n),z=P.region[i],diff=(dx,dy)=>{const a=x+dx,b=y+dy;return a<0||b<0||a>=n||b>=n||P.region[b*n+a]!==z;};
    const t=diff(0,-1),r=diff(1,0),b=diff(0,1),l=diff(-1,0);
    return [t&&'sg-bt',r&&'sg-br',b&&'sg-bb',l&&'sg-bl',t&&l&&'sg-rtl',t&&r&&'sg-rtr',b&&l&&'sg-rbl',b&&r&&'sg-rbr'].filter(Boolean).join(' ');
  }
  // ---------- Shapes: each zone drawn as smooth outlines rather than per-cell tiles ----------
  // For every zone: an underlay in the zone's seam shade, and on top its open part and its crossed-out part. Each is
  // one clip-path traced from the union of its cells, pulled in by GAP on every side, with every corner curved (CONVEX
  // outward corners, CONCAVE inward ones). Between zones the dark board shows through a 2×GAP gap; inside a zone the
  // two parts sit 2×GAP apart over the seam-coloured underlay. Edges always land GAP from a grid line, so they align.
  const GAP=3,CONVEX=10,CONCAVE=6;let lastOut=null,shapeEls=new Map();
  function outline(set,c){
    const n=P.n,inSet=(x,y)=>x>=0&&y>=0&&x<n&&y<n&&set.has(y*n+x),segs=new Map(),key=(x,y)=>x+','+y;
    const add=(x1,y1,x2,y2)=>{const k=key(x1,y1);if(!segs.has(k))segs.set(k,[]);segs.get(k).push([x1,y1,x2,y2]);};
    for(const i of set){const x=i%n,y=(i-x)/n;   // edges run with the inside on their right (clockwise on screen)
      if(!inSet(x,y-1))add(x,y,x+1,y);if(!inSet(x+1,y))add(x+1,y,x+1,y+1);if(!inSet(x,y+1))add(x+1,y+1,x,y+1);if(!inSet(x-1,y))add(x,y+1,x,y);}
    let d='';
    for(;;){
      let start=null;for(const [k,l] of segs)if(l.length){start=l[0];break;}if(!start)break;
      const pts=[];let seg=start;
      for(;;){const list=segs.get(key(seg[0],seg[1]));list.splice(list.indexOf(seg),1);pts.push([seg[0],seg[1]]);
        if(seg[2]===start[0]&&seg[3]===start[1])break;
        const nx=segs.get(key(seg[2],seg[3]))||[],dx=seg[2]-seg[0],dy=seg[3]-seg[1];if(!nx.length)break;
        // where two shapes touch only at a corner, keep turning right so each loop closes on its own shape
        seg=nx.length>1?(nx.find(q=>(dx*(q[3]-q[1])-dy*(q[2]-q[0]))>0)||nx[0]):nx[0];}
      // corners only: drop points where the direction does not change
      const v=[];for(let k=0;k<pts.length;k++){const a=pts[(k-1+pts.length)%pts.length],b=pts[k],e=pts[(k+1)%pts.length];
        if((b[0]-a[0])*(e[1]-b[1])-(b[1]-a[1])*(e[0]-b[0])!==0)v.push(b);}
      const m=v.length,q=v.map((b,k)=>{const a=v[(k-1+m)%m],e=v[(k+1)%m];
        const d1=[Math.sign(b[0]-a[0]),Math.sign(b[1]-a[1])],d2=[Math.sign(e[0]-b[0]),Math.sign(e[1]-b[1])];
        const turn=d1[0]*d2[1]-d1[1]*d2[0];   // > 0: a right turn, an outer corner
        return {x:b[0]*c+GAP*(-d1[1]-d2[1]),y:b[1]*c+GAP*(d1[0]+d2[0]),d1,d2,convex:turn>0};});
      let path='';
      q.forEach((p,k)=>{const prev=q[(k-1+m)%m],next=q[(k+1)%m];
        const lin=Math.hypot(p.x-prev.x,p.y-prev.y),lout=Math.hypot(next.x-p.x,next.y-p.y);
        const r=Math.min(p.convex?CONVEX:CONCAVE,lin/2,lout/2);
        const ax=p.x-p.d1[0]*r,ay=p.y-p.d1[1]*r,bx=p.x+p.d2[0]*r,by=p.y+p.d2[1]*r;
        path+=(k?'L':'M')+ax.toFixed(1)+' '+ay.toFixed(1)+'Q'+p.x.toFixed(1)+' '+p.y.toFixed(1)+' '+bx.toFixed(1)+' '+by.toFixed(1);});
      d+=path+'Z';
    }
    return d;
  }
  function paintShapes(out){
    lastOut=out;const host=document.getElementById('sgShapes');if(!host||!P)return;
    const c=zoom.fit*zoom.z,n=P.n,want=new Set();
    const shape=(id,cls,set)=>{want.add(id);let el=shapeEls.get(id);
      if(!el){el=document.createElement('i');shapeEls.set(id,el);host.appendChild(el);}
      el.className='sg-shape '+cls;const d=set.size?outline(set,c):'';
      el.style.clipPath=d?`path(evenodd,"${d}")`:'inset(50%)';};
    G.zones.forEach((cellsOf,z)=>{const T=S.terrainOf(P,z),open=new Set(),gone=new Set();
      for(const i of cellsOf)(out[i]?gone:open).add(i);
      shape('u'+z,'sg-u sg-t-'+T.id,new Set(cellsOf));
      shape('o'+z,'sg-o sg-t-'+T.id,open);
      shape('x'+z,'sg-xs sg-t-'+T.id,gone);});
    for(const [id,el] of shapeEls)if(!want.has(id)){el.remove();shapeEls.delete(id);}
  }
  function build(){
    shapeEls=new Map();lastOut=null;
    const first=new Set(G.zones.map(z=>z[0])),n=P.n;
    shell.stage.innerHTML=`<div class="sg-wrap">
<div class="sg-zoom" role="group" aria-label="Zoom"${n<9?' hidden':''}><button id="sgZoomOut" class="sg-tool" aria-label="Zoom out" title="Zoom out (−)">−</button><button id="sgZoomFit" class="sg-tool" title="Fit the map to the screen (0)">Fit</button><button id="sgZoomIn" class="sg-tool" aria-label="Zoom in" title="Zoom in (+)">+</button><span id="sgZoomLevel" class="sg-zoom-level" aria-live="polite">100%</span><small class="sg-zoom-tip">Pinch or two fingers to zoom and pan · ctrl + wheel</small></div>
<div class="sg-view" id="sgView">
<div class="sg-frame" style="--n:${n}">
  <div class="sg-cols" aria-hidden="true">${Array.from({length:n},(_,x)=>`<span class="sg-head" data-col="${x}"><b>${S.colName(x)}</b><i></i></span>`).join('')}</div>
  <div class="sg-rows" aria-hidden="true">${Array.from({length:n},(_,y)=>`<span class="sg-head" data-row="${y}"><b>${y+1}</b><i></i></span>`).join('')}</div>
  <div class="sg-board" id="sgBoard" role="grid" aria-label="Sensor map, ${n} by ${n}"><div class="sg-shapes" id="sgShapes" aria-hidden="true"></div>${
      Array.from({length:n},(_,y)=>`<div role="row" class="sg-row">${Array.from({length:n},(_,x)=>{const i=y*n+x,z=P.region[i],T=S.terrainOf(P,z);
        return `<button role="gridcell" class="sg-cell sg-t-${T.id} ${edges(i)}" data-cell="${i}" data-zone="${z}" tabindex="-1">${first.has(i)?`<span class="sg-glyph" aria-hidden="true">${T.glyph}</span>`:''}<i class="sg-fx" aria-hidden="true"></i><i class="sg-mark" aria-hidden="true"></i></button>`;}).join('')}</div>`).join('')
  }</div>
</div>
</div>
<div class="sg-tools" role="toolbar" aria-label="Solving tools">
  <div class="sg-modes" role="radiogroup" aria-label="A tap places"><button id="sgModeSensor" class="sg-tool sg-mode" role="radio" data-tapmode="sensor" title="Tap places a sensor (M to switch)"><i class="sg-mode-ico sg-mode-dish" aria-hidden="true"></i>Sensor</button><button id="sgModeX" class="sg-tool sg-mode" role="radio" data-tapmode="x" title="Tap places a ✕ (M to switch)"><i class="sg-mode-ico" aria-hidden="true">✕</i>Cross</button></div>
  <button id="sgProbe" class="sg-tool" aria-pressed="false" title="Tap cells to try sensors without committing (also: right-click, or P)"><i class="sg-ico" aria-hidden="true"></i>Probe</button>
  <button id="sgCommit" class="sg-tool" title="Turn every probe into a real sensor">Commit probes</button>
  <button id="sgClear" class="sg-tool" title="Remove every probe">Clear probes</button>
  <button id="sgObvious" class="sg-tool" title="Cross out every cell the simple rules rule out (a zone stuck in one line, and so on)">Mark the obvious <small id="sgObviousCost"></small></button>
  <button id="sgCheck" class="sg-tool" title="Marks any sensor that is not part of the answer. Using it caps the result at Good.">Check <small>· costs Perfect</small></button>
  <button id="sgRedo" class="sg-tool" title="Redo (Y)">Redo</button>
</div>
<div class="sg-note" id="sgNote" aria-live="polite" hidden></div>
<p class="sg-help">Tap: place the selected tool · Drag: ✕ many · Right-click or Probe: try a sensor · Keys: arrows, Space, M (switch tool), X, S, P, Delete, Z / Y</p>
<p class="sg-zones-head">ELECTIVE FIGHT · ENEMY CONTACTS</p>
<ul class="sg-zones" id="sgZones" aria-label="Battlefield zones of the elective fight">${P.zones.map((Z,r)=>{const T=S.terrainOf(P,r);
      return `<li class="sg-zone sg-t-${T.id}" data-zone="${r}"><b class="sg-sw" aria-hidden="true">${T.glyph}</b><span><em>${esc(T.name)}</em><small class="sg-contact">Contact unscouted</small></span><i class="sg-ok" aria-hidden="true"></i></li>`;}).join('')}</ul></div>`;
    const $=id=>shell.stage.querySelector('#'+id),board=$('sgBoard');
    cells=[...board.querySelectorAll('[data-cell]')];chips=[...shell.stage.querySelectorAll('.sg-zone')];
    rowHeads=[...shell.stage.querySelectorAll('[data-row]')];colHeads=[...shell.stage.querySelectorAll('[data-col]')];
    tools={probe:$('sgProbe'),obvious:$('sgObvious'),obviousCost:$('sgObviousCost'),commit:$('sgCommit'),clear:$('sgClear'),check:$('sgCheck'),redo:$('sgRedo'),note:$('sgNote'),board,
      view:$('sgView'),frame:shell.stage.querySelector('.sg-frame'),zoomLevel:$('sgZoomLevel')};
    $('sgZoomIn').addEventListener('click',()=>setZoom(zoom.z*1.25));
    $('sgZoomOut').addEventListener('click',()=>setZoom(zoom.z/1.25));
    $('sgZoomFit').addEventListener('click',()=>setZoom(1));
    tools.view.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setZoom(zoom.z*Math.exp(-e.deltaY*.01),{x:e.clientX,y:e.clientY});},{passive:false});
    for(const b of document.querySelectorAll('[data-tapmode]'))b.addEventListener('click',()=>{if(b.dataset.tapmode!==tapMode)setTapMode(b.dataset.tapmode);});
    updateModes();
    tools.probe.addEventListener('click',()=>setProbeMode(!probeMode));
    tools.commit.addEventListener('click',commitProbes);
    tools.clear.addEventListener('click',()=>clearProbes(true));
    tools.check.addEventListener('click',runCheck);
    tools.obvious.addEventListener('click',markObvious);
    tools.redo.addEventListener('click',redo);
    wire(board);
  }

  // Input. A tap places whatever the Sensor | ✕ switch is set to, and tapping the same mark again clears it, so every
  // action is one tap (the old Queens-style cycle needed two taps per sensor). The choice is remembered. Dragging across
  // cells paints × on every empty cell it crosses (or erases ×s when the drag starts on a ×): marking a whole row or a
  // zone's leftovers in one stroke is what makes the genre feel quick on touch. One drag = one undo step.
  // In probe mode a tap toggles a probe instead; right-click (and a long-press where the browser maps it to the
  // context menu) toggles a probe in any mode.
  function wire(board){
    const cellAt=e=>{const el=document.elementFromPoint(e.clientX,e.clientY);const c=el&&el.closest('[data-cell]');return c&&board.contains(c)?+c.dataset.cell:null;};
    board.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch'){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
        // A second finger: this is a pinch / two-finger pan, not a stroke. Any × the first finger painted is undone.
        if(touches.size===2){if(drag&&drag.mode){marks=drag.base;render();}drag=null;startPinch();return;}
        if(touches.size>2)return;}
      if(busy()||(e.pointerType==='mouse'&&e.button!==0))return;
      const c=e.target.closest('[data-cell]');if(!c)return;
      drag={id:e.pointerId,start:+c.dataset.cell,base:marks,mode:null,cells:new Set()};
    });
    board.addEventListener('pointermove',e=>{
      if(touches.has(e.pointerId)){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch){movePinch();return;}}
      if(drag&&e.pointerId===drag.id){
        const i=cellAt(e);if(i===null||(i===drag.start&&!drag.mode))return;
        if(!drag.mode){const m=drag.base[drag.start];drag.mode=m===X?'clear':m===SENSOR?null:'mark';if(!drag.mode){drag=null;return;}paint(drag.start);}
        paint(i);
      }
    });
    // Soft highlight of the row, column and zone under the mouse (touch and keys highlight the tapped/focused cell).
    board.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const c=e.target.closest('[data-cell]');if(c)setHl(+c.dataset.cell);});
    board.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')setHl(null);});
    const end=e=>{
      if(touches.delete(e.pointerId)&&pinch){if(touches.size<2){pinch=null;suppressClick=true;setTimeout(()=>{suppressClick=false;},350);}return;}
      if(!drag||e.pointerId!==drag.id)return;
      const d=drag;drag=null;
      if(!d.mode)return;
      suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
      if(!d.cells.size){marks=d.base;render();return;}
      const next=marks;marks=d.base;
      commitMove(next,{type:'drag',cells:[...d.cells],mark:d.mode==='mark'?X:EMPTY});
      if(!animView)shell.status(d.mode==='mark'?`Marked ${d.cells.size} ${d.cells.size===1?'cell':'cells'} ×.`:`Cleared ${d.cells.size} ×.`);
    };
    // No pointer capture (it would retarget the tap's click away from the cell); touch input is implicitly captured
    // anyway, which is why the cell under the finger comes from elementFromPoint. Ending on window catches releases
    // outside the board.
    endDrag=end;
    board.addEventListener('contextmenu',e=>{
      const c=e.target.closest('[data-cell]');if(!c)return;e.preventDefault();
      if(drag&&drag.mode)return;drag=null;
      suppressClick=true;setTimeout(()=>{suppressClick=false;},350);
      const i=+c.dataset.cell;focus=i;setHl(i);toggleProbe(i);
    });
    board.addEventListener('click',e=>{
      const c=e.target.closest('[data-cell]');if(!c||suppressClick)return;
      const i=+c.dataset.cell;focus=i;setHl(i);
      if(probeMode)toggleProbe(i);else tapMark(i);
    });
    board.addEventListener('focusin',e=>{const c=e.target.closest('[data-cell]');if(c&&e.target.matches(':focus-visible'))setHl(+c.dataset.cell);});
    board.addEventListener('keydown',e=>{
      const c=e.target.closest('[data-cell]');if(!c)return;const i=+c.dataset.cell,n=P.n;
      const step={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowDown:[0,1],ArrowUp:[0,-1]}[e.key];
      if(step){e.preventDefault();const x=i%n+step[0],y=Math.floor(i/n)+step[1];if(x>=0&&y>=0&&x<n&&y<n){focus=y*n+x;rovingFocus(true);setHl(focus);}return;}
      const k=e.key.toLowerCase();
      if(k==='x'){e.preventDefault();move(i,{mark:marks[i]===X?EMPTY:X});}
      else if(k==='s'){e.preventDefault();move(i,{mark:marks[i]===SENSOR?EMPTY:SENSOR});}
      else if(k==='p'){e.preventDefault();toggleProbe(i);}
      else if(k==='m'){e.preventDefault();setTapMode(tapMode==='sensor'?'x':'sensor');}
      else if(k==='+'||k==='='){e.preventDefault();setZoom(zoom.z*1.25);cells[i].focus();}
      else if(k==='-'||k==='_'){e.preventDefault();setZoom(zoom.z/1.25);cells[i].focus();}
      else if(k==='0'){e.preventDefault();setZoom(1);cells[i].focus();}
      else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();move(i,{mark:EMPTY});}
      else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();redo();}
      else if(k==='z'||k==='u'){e.preventDefault();undo();}
    });
  }
  // ---------- Zoom and pan ----------
  // Fit: as big as the space allows (up to 68px cells), but never wider than the stage. Height also counts on desktop
  // and iPad, down to a floor that keeps cells comfortable to tap (44px, 36px from 9×9, 32px from 12×12): below that floor
  // the page scrolls a little instead. On a phone, maps above 9×9 fit the width and you zoom in to tap.
  function layout(){
    if(!tools.view)return;
    const n=P.n,css=getComputedStyle(tools.frame),px=v=>parseFloat(css.getPropertyValue(v))||0;
    const chrome=px('--hw')+px('--gap')+2*px('--pad'),availW=tools.view.clientWidth,availH=Math.max(260,window.innerHeight-300);
    const fitW=(availW-chrome)/n,fitH=(availH-chrome)/n,floor=n>=12?32:n>=9?36:44;
    zoom.fit=Math.max(12,Math.min(68,fitW,Math.max(fitH,floor)));
    zoom.min=Math.min(1,Math.max(.4,fitH/zoom.fit));zoom.max=Math.max(1,64/zoom.fit);
    applyZoom(zoom.z);
  }
  function applyZoom(z){
    zoom.z=Math.min(zoom.max,Math.max(zoom.min,z));
    tools.frame.style.setProperty('--cs',(zoom.fit*zoom.z).toFixed(2)+'px');
    if(lastOut)paintShapes(lastOut);
    tools.view.classList.toggle('sg-zoomed',zoom.z>1.001);
    tools.zoomLevel.textContent=Math.round(zoom.z*100)+'%';
  }
  // at: the screen point to hold still while zooming (the pinch centre or the mouse); default the view's centre.
  function setZoom(z,at){
    const v=tools.view,r=v.getBoundingClientRect(),ax=at?at.x-r.left:v.clientWidth/2,ay=at?at.y-r.top:v.clientHeight/2;
    const before=zoom.fit*zoom.z,cx=(v.scrollLeft+ax)/before,cy=(v.scrollTop+ay)/before;
    applyZoom(z);const after=zoom.fit*zoom.z;
    v.scrollLeft=cx*after-ax;v.scrollTop=cy*after-ay;
  }
  const pair=()=>{const [a,b]=[...touches.values()];return {d:Math.hypot(a.x-b.x,a.y-b.y)||1,x:(a.x+b.x)/2,y:(a.y+b.y)/2};};
  function startPinch(){const p=pair();pinch={d0:p.d,z0:zoom.z,x:p.x,y:p.y};setHl(null);}
  // Two fingers: spread to zoom around their centre, move together to pan.
  function movePinch(){
    const p=pair(),v=tools.view;
    setZoom(pinch.z0*p.d/pinch.d0,{x:p.x,y:p.y});
    v.scrollLeft-=p.x-pinch.x;v.scrollTop-=p.y-pinch.y;pinch.x=p.x;pinch.y=p.y;
  }
  // Drag painting only touches eligible cells: empty ones when marking, manual ×s when erasing. Sensors are never hit.
  function paint(i){
    const base=drag.base[i];
    if(drag.mode==='mark'?base!==EMPTY:base!==X)return;
    if(drag.cells.has(i))return;drag.cells.add(i);
    marks=withAssist(S.apply(P,drag.base,{cells:[...drag.cells],mark:drag.mode==='mark'?X:EMPTY}).marks);
    render();shell.flash(cells[i].querySelector('.sg-mark'));
  }
  // Every change goes through here so the assist's auto-×s always match the sensors on the board.
  const withAssist=m=>S.withAuto(P,m,assist);
  function rovingFocus(take){cells.forEach(c=>{c.tabIndex=+c.dataset.cell===focus?0:-1;});if(take)cells[focus].focus();}
  function setHl(i){
    if(i===hl)return;hl=i;
    const r=i===null?-1:G.row[i],c=i===null?-1:G.col[i],z=i===null?-1:G.reg[i];
    for(const el of cells){const k=+el.dataset.cell;el.classList.toggle('sg-hl',i!==null&&(G.row[k]===r||G.col[k]===c||G.reg[k]===z));}
    rowHeads.forEach((h,k)=>h.classList.toggle('sg-hl',k===r));colHeads.forEach((h,k)=>h.classList.toggle('sg-hl',k===c));
    chips.forEach((h,k)=>h.classList.toggle('sg-hl',k===z));
  }

  // One committed change: counts a new clash as an error (Perfect needs none; the first is kept with the step that was
  // available just before it, for the near-miss line), records undo, clears redo, and drops stale probe/check marks.
  function change(next,detail,cell){
    if(next.every((v,k)=>v===marks[k]))return false;
    go();
    const before=S.analyze(P,marks),after=S.analyze(P,next);
    if(after.pairs.length>before.pairs.length){
      errors++;const pair=after.pairs.find(p=>cell!==undefined&&p.cells.includes(cell))||after.pairs[0];
      if(!firstError)firstError={pair,step:S.hint(P,marks)};
    }
    shell.log(detail.type,detail);
    history.push(marks);future=[];marks=next;tidy();hintFocus=new Set();
    return true;
  }
  function tidy(){
    for(const c of [...probes])if(marks[c]===SENSOR)probes.delete(c);
    for(const c of [...checked])if(marks[c]!==SENSOR)checked.delete(c);
  }

  // Tap mode: 'sensor' or 'x'. A sensor tap on an empty or crossed cell places a sensor; a cross tap marks ✕. Tapping a
  // cell that already holds the selected mark clears it; a sensor tapped in cross mode is cleared too.
  const MODE_KEY='spacologySensorTapModeV1';
  let tapMode=(()=>{try{return localStorage.getItem(MODE_KEY)==='x'?'x':'sensor';}catch{return 'sensor';}})();
  function setTapMode(m){tapMode=m;try{localStorage.setItem(MODE_KEY,m);}catch{}updateModes();shell.status(m==='sensor'?'Tap places a sensor.':'Tap places a ✕.');}
  function updateModes(){for(const b of document.querySelectorAll('[data-tapmode]')){const on=b.dataset.tapmode===tapMode;b.setAttribute('aria-checked',on);b.classList.toggle('sg-mode-on',on);}}
  function tapMark(i){
    const m=marks[i];
    // A short pulse on the tapped cell confirms the tap landed, even when the move only clears a mark.
    const el=cells[i];if(el){el.classList.remove('sg-tapped');void el.offsetWidth;el.classList.add('sg-tapped');}
    if(tapMode==='sensor')move(i,{mark:m===SENSOR?EMPTY:SENSOR});
    else move(i,{mark:m===X||m===SENSOR?EMPTY:X});
  }
  function move(cell,m){
    if(busy())return;finishAnim();
    const r=S.apply(P,marks,{cell,...m});
    if(r.error){shell.status(r.error,'warn');shell.flash(cells[cell],'mg-shake');return;}
    commitMove(withAssist(r.marks),{type:'mark',cell,mark:r.marks[cell]},cell);
  }

  // ---------- Assist levels and the cascade ----------
  // A player move, then (Guided/Relaxed) everything the simple rules now imply, committed as ONE undo step. The board
  // state jumps to the final marks at once; the cascade is only a playback (animView) the next action cuts short.
  const settleOpts=()=>({drop:level==='relaxed',assist});
  function commitMove(next,detail,cell){
    finishAnim();
    let final=next,steps=[],paused=false;
    if(level!=='puzzle'){const r=S.settle(P,next,settleOpts());final=r.marks;steps=r.steps;paused=r.paused;}
    if(!change(final,detail,cell)){render();return false;}
    for(const st of steps)if(st.type==='drop')dropped.add(st.cell);
    play(next,final,steps,cell,paused);
    return true;
  }
  // The board as the current level wants it, without animation (undo, redo, level changes, assist toggle).
  function normalize(m){
    return level==='puzzle'?withAssist(m.map(v=>v===DEDUCED?EMPTY:v)):S.settle(P,m,settleOpts()).marks;
  }
  function finishAnim(){
    if(!animTimers.length&&!animView)return;
    animTimers.forEach(clearTimeout);animTimers=[];animView=null;
  }
  // Playback: × deductions ripple out from the cell that caused them; dropped sensors pop in one by one.
  function play(start0,final,steps,origin,paused){
    const start=final.slice(),frames=[];
    for(const st of steps){const cs=st.cells.filter(c=>start0[c]!==final[c]);if(cs.length)frames.push({...st,cells:cs});}
    for(const f of frames)for(const c of f.cells)start[c]=start0[c]===DEDUCED?EMPTY:start0[c];
    const done=()=>{animView=null;animTimers=[];render();cascadeStatus(frames,paused);};
    if(reduced()||!frames.length){render(origin);if(frames.length||paused)cascadeStatus(frames,paused);return;}
    animView=start;render(origin);
    let t=0,from=origin;
    for(const f of frames){
      t+=f.type==='drop'?DROP_STEP:X_STEP;
      const src=from;if(f.type==='drop')from=f.cell;
      animTimers.push(setTimeout(()=>{
        if(!animView)return;
        for(const c of f.cells)animView[c]=final[c];render();
        for(const c of f.cells){
          const el=cells[c].querySelector('.sg-mark'),d=src===undefined?0:Math.max(Math.abs(G.row[c]-G.row[src]),Math.abs(G.col[c]-G.col[src]));
          if(f.type==='drop'&&c===f.cell)shell.flash(el,'sg-drop');else{el.style.setProperty('--d',`${d*RIPPLE}ms`);shell.flash(el,'sg-xin');}
        }
      },t));
    }
    animTimers.push(setTimeout(done,t+120));
  }
  function cascadeStatus(frames,paused){
    if(paused){if(!S.analyze(P,marks).pairs.length)shell.status('Auto-steps paused: something on the board does not fit the answer. Undo it, or use Check.','warn');return;}
    const xs=frames.filter(f=>f.type==='x').reduce((k,f)=>k+f.cells.length,0),dr=frames.filter(f=>f.type==='drop');
    if(!frames.length)return;
    const parts=[];if(dr.length)parts.push(`${dr.length} ${dr.length===1?'sensor':'sensors'} dropped in (${dr.map(f=>S.label(P,f.cell)).join(', ')})`);
    if(xs)parts.push(`${xs} ${xs===1?'cell':'cells'} crossed out`);
    shell.status(`Auto: ${parts.join(', ')}. ${frames.at(-1).reason}`,'good');
  }
  function setLevel(id){
    if(!RANK.hasOwnProperty(id))return;
    level=id;try{localStorage.setItem(LEVEL_KEY,id);}catch{}
    if(RANK[id]>RANK[levelUsed]&&P&&!shell.ended)levelUsed=id;
    document.querySelectorAll('input[name="sgLevel"]').forEach(r=>{r.checked=r.value===id;});
    if(!P||busy())return;
    shell.log('level',{level:id});finishAnim();
    if(id==='puzzle'){marks=normalize(marks);render();shell.status('Puzzle level: every deduction is yours again.');return;}
    if(!commitMove(withAssist(marks),{type:'level',level:id}))shell.status(`${levelOf(id).label} level: ${levelOf(id).note}`);
  }
  // Mark the obvious: applies every simple × deduction now, with the cascade. Free at Guided/Relaxed; at Puzzle it is
  // one hint (and its ×s become ordinary ×s you can clear).
  function markObvious(){
    if(busy())return;finishAnim();
    if(level!=='puzzle'){
      if(!commitMove(withAssist(marks),{type:'obvious'}))shell.status(S.settle(P,marks,settleOpts()).paused?'Auto-steps paused: something on the board does not fit the answer.':'Nothing obvious left to mark: the next step needs a closer look.');
      return;
    }
    const r=S.settle(P,marks,{drop:false,assist});
    if(r.paused){giveHint();return;}
    const final=r.marks.map(v=>v===DEDUCED?X:v),k=final.filter((v,i)=>v!==marks[i]).length;
    if(!k){shell.status('Nothing obvious left to mark: the next step needs a closer look.');return;}
    const steps=r.steps.map(st=>({...st,cells:st.cells.filter(c=>final[c]!==marks[c])})).filter(st=>st.cells.length);
    hints.push({kind:'obvious',reason:`Mark the obvious crossed out ${k} cells. ${steps.length?steps[0].reason:''}`.trim()});
    const before=marks;change(final,{type:'obvious',cells:k});
    play(before,final,steps,undefined,false);
    if(!animView)shell.status(`Marked the obvious: ${k} cells crossed out (counts as hint ${hints.length}).`);
  }

  function undo(){
    if(!history.length||busy())return;finishAnim();
    future.push(marks);marks=normalize(history.pop());tidy();hintFocus=new Set();render();shell.status('Undone (the move and everything it set off).');
  }
  function redo(){
    if(!future.length||busy())return;finishAnim();
    shell.log('redo');history.push(marks);marks=normalize(future.pop());tidy();hintFocus=new Set();render();shell.status('Redone.');
  }

  // ---------- Probes ----------
  function setProbeMode(on){
    if(busy())return;probeMode=on;
    shell.status(on?'Probe mode: tap cells to try sensors. Probes change nothing until you commit them, and cost nothing.':
      probes.size?'Probe mode off. Your probes stay on the board until you commit or clear them.':'Probe mode off.');
    render();
  }
  function toggleProbe(i){
    if(busy())return;finishAnim();
    if(marks[i]===SENSOR){shell.status(`${S.label(P,i)} already holds a sensor.`,'warn');shell.flash(cells[i],'mg-shake');return;}
    go();
    if(probes.has(i))probes.delete(i);else{probes.add(i);probesUsed++;}
    shell.log('probe',{cell:i,on:probes.has(i)});
    render();
    // The first consequence also goes to the status line at the top, so it is visible without scrolling.
    const pr=probes.size?S.probe(P,marks,[...probes]):null,bad=pr?[...pr.clashes,...pr.dead]:[];
    if(!pr)shell.status('No probes on the board.');
    else if(bad.length)shell.status(bad[0].reason+(bad.length>1?` (${bad.length-1} more below the map.)`:''),'warn');
    else shell.status(`No contradiction from ${pr.probes.length===1?'this probe':pr.probes.length+' probes'}: ${pr.shaded.length} more ${pr.shaded.length===1?'cell':'cells'} ruled out (shaded).${pr.forced.length?' '+pr.forced[0].reason:''}`);
    if(probes.has(i))shell.flash(cells[i].querySelector('.sg-mark'));
  }
  function commitProbes(){
    if(busy()||!probes.size)return;
    finishAnim();const list=[...probes],next=S.commitProbes(P,marks,list,assist).marks;
    probes=new Set();probeMode=false;
    commitMove(next,{type:'commit',cells:list},list.at(-1));
    if(animView)return;
    const A=S.analyze(P,marks),clash=A.pairs.find(q=>q.cells.some(c=>list.includes(c)));
    if(clash&&!A.solved)shell.status(`Clash: ${S.clashText(P,clash)}.`,'warn');
    else if(!A.solved&&!A.pairs.length)shell.status(`Committed ${list.length===1?'the probe':list.length+' probes'} as ${list.length===1?'a sensor':'sensors'}: ${list.map(c=>S.label(P,c)).join(', ')}.`,'good');
  }
  function clearProbes(say){
    if(busy()||!probes.size)return;
    const k=probes.size;probes=new Set();shell.log('clearProbes');render();
    if(say)shell.status(`Cleared ${k===1?'the probe':k+' probes'}.`);
  }

  // ---------- Check and hints ----------
  function runCheck(){
    if(busy())return;
    go();checks++;shell.log('check');
    const c=S.check(P,marks);checked=new Set(c.wrong);render();
    c.wrong.forEach(i=>shell.flash(cells[i],'mg-shake'));
    const best=' Best result is now Good.';
    if(c.wrong.length)shell.status(`Check: ${c.wrong.length===1?'the sensor on '+S.label(P,c.wrong[0])+' is':c.wrong.length+' sensors ('+c.wrong.map(i=>S.label(P,i)).join(', ')+') are'} not part of the answer.${best}`,'warn');
    else shell.status(c.right.length?`Check: all ${c.right.length===1?'1 sensor is':c.right.length+' sensors are'} right.${best}`:`Check: no sensors placed yet, so nothing is wrong.${best}`);
  }

  // A hint applies one step: one sensor, or up to S.HINT_CAP ×s from one deduction; the zone(s) and line(s) it reasons
  // about stay softly lit until the next move.
  function giveHint(){
    if(busy())return;
    finishAnim();go();const h=S.hint(P,marks);if(!h){shell.status('The map is already solved.');return;}
    hints.push(h);
    const next=withAssist(S.apply(P,marks,{cells:h.cells,mark:h.mark}).marks);
    commitMove(next,{type:'hint',cells:h.cells,mark:h.mark},h.cells[0]);
    hintFocus=new Set(h.focus);focus=h.cells[0];render();
    cells.forEach(c=>c.classList.remove('sg-hinted'));h.cells.forEach(c=>{cells[c].classList.add('sg-hinted');shell.flash(cells[c].querySelector('.sg-mark'));});
    shell.status(`Hint ${hints.length}: ${h.reason}`,h.kind==='fix'?'warn':'');
  }

  function toggleAssist(on){
    assist=on;if(on)assistOn=true;else assistOff=true;
    if(!P||busy())return;
    finishAnim();marks=normalize(marks);
    shell.log('assist',{on});render();
  }
  const assistStat=()=>assistOn&&assistOff?'on part-time':assistOn?'on':'off';

  function auto(){
    timers.forEach(clearTimeout);timers=[];closing=false;probes=new Set();probeMode=false;finishAnim();
    const nextStep=S.hint(P,marks),A=S.autoFallback(P,marks);
    autoView=A.marks;A.zones.forEach(z=>revealed.add(z));render();
    const total=P.n,{score}=S.score({auto:true,revealed:A.zones.length,total}),sc=S.scout(P,A.zones,'auto');
    return {score,headline:`The automatic sweep placed ${A.zones.length} of ${total} sensors and scouted ${A.zones.length} zones of the elective fight; the rest stay dark.`,
      nearMiss:S.nearMiss(P,{tier:'auto',revealed:A.zones,nextStep:nextStep&&nextStep.kind!=='fix'?nextStep:null}),
      output:sc.output,
      stats:{Zones:`${A.zones.length}/${total}`,Difficulty:`−${sc.reduction}`,Hints:String(hints.length),'Assist level':levelOf(levelUsed).label,'Auto-placed':String(dropped.size),'Auto-×':assistStat()}};
  }

  // Edge status for a row, column or zone: ✓ once it holds exactly one sensor that clashes with nothing; otherwise the
  // number of cells still open; red when it holds two sensors or has no open cell left.
  function headState(el,{ok,count,open,pdead}){
    const bad=count>1||(count===0&&open===0);
    el.classList.toggle('sg-ok',ok);el.classList.toggle('sg-bad',bad&&!ok);el.classList.toggle('sg-pdead',!!pdead);
    el.querySelector('i').textContent=ok?'✓':count>1?'×2':String(open);
  }

  function render(placed){
    const shown=autoView||animView||marks,A=S.analyze(P,shown);
    const pr=!autoView&&probes.size?S.probe(P,marks,[...probes]):null;
    // Relaxed: open cells that could still hold a sensor glow softly, and a probe shows the chain it would set off.
    const relaxed=level==='relaxed'&&!autoView&&!closing&&!shell.ended;
    const cand=new Set(relaxed&&!animView?S.candidates(P,marks):[]),chain=relaxed&&pr&&pr.ok?S.probeChain(P,marks,[...probes]):null;
    if(pr)pr.chain=chain;const ghosts=new Set(chain?chain.ghosts:[]);
    const shade=new Set(pr?pr.shaded:[]),pclash=new Set(pr?pr.clashes.flatMap(c=>c.cells.filter(x=>probes.has(x))):[]);
    const unitCells=u=>u.kind==='zone'?G.zones[u.k]:u.kind==='row'?G.rows[u.k]:G.cols[u.k];
    const deadList=pr?pr.dead.concat(chain&&chain.dead?[{...chain.dead,cells:unitCells(chain.dead.unit)}]:[]):[];
    const deadCells=new Set(deadList.flatMap(d=>d.cells)),forced=new Set(pr&&pr.ok&&!chain?pr.forced.map(f=>f.cell):[]);
    const deadUnit=(kind,k)=>deadList.some(d=>d.unit.kind===kind&&d.unit.k===k);
    // Out of play: any open cell a placed sensor rules out (its row, column, zone or the ring around it), whether or not
    // it carries a ×, so what is left stands out even with Auto-× off.
    const outOfPlay=new Set(),sensors=[];for(let i=0;i<shown.length;i++)if(shown[i]===SENSOR)sensors.push(i);
    for(const s_ of sensors)for(let k=0;k<shown.length;k++){if(k===s_||shown[k]===SENSOR)continue;
      if(G.row[k]===G.row[s_]||G.col[k]===G.col[s_]||G.reg[k]===G.reg[s_]||(Math.abs(G.row[k]-G.row[s_])<=1&&Math.abs(G.col[k]-G.col[s_])<=1))outOfPlay.add(k);}
    // Dynamic islands: each zone splits into its open part and its crossed-out part, and each part is drawn as its own
    // rounded shape (see paintShapes): dark gaps between colours, seams in a dim shade where one colour splits.
    // Once the map is solved everything rejoins.
    const whole=closing||shell.ended,out=new Uint8Array(shown.length);
    if(!whole)for(let i=0;i<shown.length;i++){const m=shown[i];out[i]=m!==SENSOR&&!(!autoView&&probes.has(i))&&(m===X||m===AUTO||m===DEDUCED||outOfPlay.has(i))?1:0;}
    paintShapes(out);
    for(const el of cells){
      const i=+el.dataset.cell,m=shown[i],pb=!autoView&&probes.has(i);
      el.classList.toggle('sg-sensor',m===SENSOR);el.classList.toggle('sg-x',m===X&&!pb);el.classList.toggle('sg-ax',m===AUTO&&!pb);el.classList.toggle('sg-dx',m===DEDUCED&&!pb);
      el.classList.toggle('sg-cand',cand.has(i)&&!pb);el.classList.toggle('sg-ghost',ghosts.has(i));
      el.classList.toggle('sg-bad',A.bad.has(i));el.classList.toggle('sg-auto',!!autoView&&m===SENSOR);
      el.classList.toggle('sg-lit',revealed.has(P.region[i]));
      el.classList.toggle('sg-out',!!out[i]);
      el.classList.toggle('sg-probe',pb);el.classList.toggle('sg-pclash',pclash.has(i));el.classList.toggle('sg-pshade',shade.has(i));
      el.classList.toggle('sg-pdead',deadCells.has(i));el.classList.toggle('sg-forced',forced.has(i));
      el.classList.toggle('sg-wrong',checked.has(i)&&m===SENSOR);el.classList.toggle('sg-harea',hintFocus.has(i));
      el.setAttribute('aria-label',`${S.label(P,i)}, ${S.terrainOf(P,P.region[i]).name}${m===SENSOR?', sensor':pb?', probe':m===X?', marked ×':m===AUTO?', ruled out':m===DEDUCED?', ruled out by logic':''}${ghosts.has(i)?', would drop in':''}${A.bad.has(i)?', clashes':''}${checked.has(i)&&m===SENSOR?', not in the answer':''}${shade.has(i)?', ruled out by probe':''}`);
    }
    rowHeads.forEach((h,r)=>headState(h,{ok:A.rowOk[r],count:A.rowCount[r],open:A.open.row[r],pdead:deadUnit('row',r)}));
    colHeads.forEach((h,c)=>headState(h,{ok:A.colOk[c],count:A.colCount[c],open:A.open.col[c],pdead:deadUnit('col',c)}));
    chips.forEach((li,r)=>{
      const was=li.classList.contains('sg-done');li.classList.toggle('sg-done',A.zoneOk[r]);
      if(A.zoneOk[r]&&!was&&placed!==undefined&&P.region[placed]===r)shell.flash(li);
      const known=revealed.has(r),T=S.ARCHETYPES[P.zones[r].contact];li.classList.toggle('sg-known',known);
      li.classList.toggle('sg-pdead',deadUnit('zone',r));
      const open=A.open.zone[r],dead=A.zoneCount[r]===0&&open===0;li.classList.toggle('sg-empty',dead);
      li.querySelector('.sg-contact').textContent=known?`${T.name} · ${T.note}`:A.zoneOk[r]?'Covered':A.zoneCount[r]>1?`${A.zoneCount[r]} sensors: one too many`:dead?'No open cell left':`${open} open ${open===1?'cell':'cells'}`;
      li.querySelector('.sg-ok').textContent=A.zoneOk[r]?'✓':'';
    });
    if(placed!==undefined&&shown[placed]===SENSOR)shell.flash(cells[placed].querySelector('.sg-mark'),A.bad.has(placed)?'mg-shake':'mg-pop');
    rovingFocus(false);
    const zOk=A.zoneOk.filter(Boolean).length,lOk=A.rowOk.filter(Boolean).length+A.colOk.filter(Boolean).length;
    shell.meters([
      {label:'Sensors',value:`${A.sensors.length}/${P.n}`,tone:A.sensors.length===P.n&&!A.pairs.length?'good':''},
      {label:'Zones ✓',value:`${zOk}/${P.n}`,tone:zOk===P.n?'good':''},
      {label:'Lines ✓',value:`${lOk}/${2*P.n}`,tone:lOk===2*P.n?'good':''},
      {label:'Clashes',value:String(A.pairs.length),tone:A.pairs.length?'bad':''}
    ]);
    note(pr);
    updateTools();
    if(placed!==undefined&&A.bad.has(placed)){const p=A.pairs.find(q=>q.cells.includes(placed));shell.status(`Clash: ${S.clashText(P,p)}.`,'warn');}
    else if(placed!==undefined&&shown[placed]===SENSOR&&A.zoneOk[P.region[placed]])shell.status(`${S.terrainOf(P,P.region[placed]).name} covered.`,'good');
    if(A.solved&&!autoView&&!animView&&!closing&&!shell.ended)win();
  }
  // The probe panel: what the probes would do, in plain sentences. Problems first (red), then forced cells.
  function note(pr){
    const el=tools.note;if(!el)return;
    if(!pr&&!(probeMode&&!busy())){el.hidden=true;el.innerHTML='';return;}
    el.hidden=false;
    if(!pr){el.className='sg-note';el.innerHTML='<b>Probe mode.</b> Tap cells to try sensors: shaded cells are what they would rule out, red lines and zones would be left with nowhere to go. Probes are free.';return;}
    const bad=[...pr.clashes,...pr.dead,...(pr.chain&&pr.chain.dead?[pr.chain.dead]:[])],k=pr.probes.length,head=`${k===1?'1 probe':k+' probes'} (${pr.probes.map(c=>S.label(P,c)).join(', ')})`;
    el.className='sg-note'+(bad.length?' sg-note-bad':' sg-note-ok');
    const lines=bad.length?bad.slice(0,3).map(x=>x.reason).concat(bad.length>3?[`…and ${bad.length-3} more.`]:[])
      :[`No contradiction yet: ${pr.shaded.length===1?'1 more cell':pr.shaded.length+' more cells'} ruled out (shaded).`,...(pr.chain?(pr.chain.ghosts.length?[`The chain would drop ${pr.chain.ghosts.length===1?'a sensor':pr.chain.ghosts.length+' sensors'} in: ${pr.chain.ghosts.map(c=>S.label(P,c)).join(', ')} (ghosts).`]:[]):pr.forced.slice(0,2).map(f=>f.reason))];
    el.innerHTML=`<b>${esc(head)}:</b> ${lines.map(l=>`<span>${esc(l)}</span>`).join(' ')}`;
  }
  function updateTools(){
    if(!tools.probe)return;const off=busy();
    tools.probe.setAttribute('aria-pressed',String(probeMode&&!off));tools.probe.disabled=off;
    tools.board.classList.toggle('sg-probing',probeMode&&!off);
    tools.commit.disabled=off||!probes.size;tools.clear.disabled=off||!probes.size;
    tools.commit.textContent=probes.size>1?`Commit ${probes.size} probes`:'Commit probes';
    tools.check.disabled=off;tools.redo.disabled=off||!future.length;tools.obvious.disabled=off;
    tools.obviousCost.textContent=level==='puzzle'?'· counts as a hint':'· free';
    shell.undoEnabled(history.length>0&&!off);
  }

  // Closing cascade: the board shimmers, then zone by zone (in row order of their sensors) each sensor rings, its zone
  // lights up and names its contact.
  function win(){
    closing=true;probes=new Set();probeMode=false;hintFocus=new Set();shell.controls({auto:false,hint:false,undo:false});updateTools();note(null);
    const ms=Date.now()-(t0||Date.now()),targetMs=S.difficulty(P.difficulty).target*1000;
    const order=P.solution.map(c=>P.region[c]),step=reduced()?0:REVEAL_STEP;
    shell.status('Battlefield scouted: reading every zone…','good');
    shell.flash(tools.board,'sg-won');
    order.forEach((z,k)=>timers.push(setTimeout(()=>{
      revealed.add(z);render();
      G.zones[z].forEach(c=>shell.flash(cells[c],'sg-flare'));shell.flash(chips[z]);
      shell.flash(cells[P.solution[k]],'sg-cheer');
    },k*step)));
    timers.push(setTimeout(()=>{
      closing=false;shell.controls({auto:true,hint:true});
      // Scored at the most assisted level used during this map, so switching to Puzzle at the end does not earn Perfect.
      const assisted=levelUsed!=='puzzle',L=levelOf(levelUsed).label;
      const s=S.score({solved:true,hints:hints.length,errors,checks,ms,targetMs,assist:levelUsed}),sc=S.scout(P,P.zones.map((z,k)=>k),s.tier);
      shell.finish({tier:s.tier,score:s.score,
        headline:`${assisted?`Solved · ${L}. `:''}All ${P.n} zones covered with ${P.n} sensors: the elective fight is scouted, every contact identified.`,
        nearMiss:S.nearMiss(P,{tier:s.tier,hintLog:hints,firstError,checks,ms,targetMs,assist:levelUsed}),
        output:sc.output,
        stats:{Difficulty:`−${sc.reduction}`,'Affix stripped':sc.affixStripped?'yes':'no','Assist level':L,'Auto-placed':String(dropped.size),Hints:String(hints.length),Clashes:String(errors),Checks:String(checks),Probes:String(probesUsed),'Auto-×':assistStat(),Score:String(s.score)}});
      updateTools();
    },order.length*step+(step?450:0)));
  }

  shell.side(`<p class="eyebrow sg-side-top">ASSIST LEVEL</p><div class="sg-levels" role="radiogroup" aria-label="Assist level">${S.ASSIST_LEVELS.map(l=>
    `<label class="sg-level"><input type="radio" name="sgLevel" value="${l.id}"${l.id===level?' checked':''}><span><b>${l.label}</b><small>${esc(l.note)}</small></span></label>`).join('')}</div>
<label class="sg-assist"><input type="checkbox" id="sgAssist" checked><span><b>Auto-× conflicts</b><small>Placing a sensor crosses out its row, column, zone and 8 neighbours; removing it clears them again. Free: it never costs Perfect.</small></span></label>
<p class="eyebrow">TOOLS</p><ul class="sg-toolhelp">
<li><b>Probe</b> tries sensors without committing. Shaded cells are what they would rule out; a red row, column or zone would be left with nowhere to go. <b>Commit</b> makes them real, <b>Clear</b> removes them. Free.</li>
<li><b>Hover or tap</b> a cell to light up its row, column and zone. Edge numbers count each line’s open cells; ✓ when it holds its one sensor.</li>
<li><b>Mark the obvious</b> crosses out everything the simple rules rule out right now, with a quick cascade. Free at Guided and Relaxed; one hint at Puzzle.</li>
<li><b>Hint</b> does one step: one sensor, or up to ${S.HINT_CAP} ×s, and lights up the area it reasons about. One hint: Good; two or more: Partial.</li>
<li><b>Check</b> marks any sensor that is not part of the answer. Using it caps the result at Good.</li>
<li><b>Undo / Redo</b> step through every move (Z / Y); a move and the cascade it set off undo together.</li>
<li>At <b>Relaxed</b>, a probe also shows the sensors its chain would drop in, as ghosts.</li></ul>
<p class="eyebrow">LEGEND</p><ul class="sg-legend"><li><i class="sg-k sg-k-sensor"></i>Sensor</li><li><i class="sg-k sg-k-probe"></i>Probe (not committed)</li><li><i class="sg-k sg-k-shade"></i>Ruled out by a probe</li><li><i class="sg-k sg-k-x">×</i>Ruled out (yours)</li><li><i class="sg-k sg-k-ax">×</i>Ruled out (auto)</li><li><i class="sg-k sg-k-dx">×</i>Ruled out by logic (Guided / Relaxed)</li><li><i class="sg-k sg-k-cand"></i>Still possible (Relaxed)</li><li><i class="sg-k sg-k-ghost"></i>Would drop in (Relaxed probe)</li><li><i class="sg-k sg-k-bad"></i>Clash, or nowhere to go</li><li><i class="sg-k sg-k-wrong">!</i>Not in the answer (Check)</li><li><i class="sg-k sg-k-ok">✓</i>Line or zone covered</li></ul>`);
  window.addEventListener('pointerup',e=>endDrag&&endDrag(e));window.addEventListener('pointercancel',e=>endDrag&&endDrag(e));
  let resizeTimer=0;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(P)layout();},80);});
  document.getElementById('sgAssist').addEventListener('change',e=>toggleAssist(e.target.checked));
  document.querySelectorAll('input[name="sgLevel"]').forEach(r=>r.addEventListener('change',e=>{if(e.target.checked)setLevel(e.target.value);}));
  shell.start();
})();
