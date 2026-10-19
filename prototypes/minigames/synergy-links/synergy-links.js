// Synergy links UI: drag from a crewmate to their partner to draw a synergy link (Flow Free rules). Taps work too: tap
// a crewmate or a line, then tap the next square. The board is one SVG built once per puzzle; dragging only rewrites
// path data and a few fills, computed from a rect cached on pointerdown. Rules, solver, hints and scoring live in
// synergy-links-model.js.
(function(){
  'use strict';
  const K=window.MiniGameKit,M=window.SynergyLinks,esc=K.esc,SVGNS='http://www.w3.org/2000/svg';
  const ASSIST_KEY='spacologySynergyAssist',ASSIST_RANK={off:0,dead:1,auto:2};
  let activeEnd=null,pz=null,st=null,history=[],count={strokes:0,undos:0,hints:0},assist=loadAssist(),assistUsed='off',drag=null,active=null,busy=false,done=false,hover=-1;
  let els=null,fills=[],wasConnected=[];
  const shell=K.shell({id:'synergy-links',difficulties:M.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),defaultDifficulty:'normal',
    rules:['Each pair of crewmates shares a <b>synergy</b>. Drag from one to their partner (same colour) to draw the link.',
      'Links move <b>up, down or sideways</b>, never cross, and cannot pass through another crewmate.',
      'Drawing over another link <b>cuts</b> it. Drag back along your own link to shorten it; tap a crewmate to clear theirs.',
      'Connect every pair <b>and fill every square</b> for Perfect. Every puzzle has exactly one such solution.',
      'Tap play: tap a crewmate or a line end, then tap the next square. Undo steps back one stroke.',
      'Assists (dead ends, auto-finish) and hints make it relaxed; assisted solves count as Good.'],
    onNew,onAuto,onUndo,onHint});
  const stage=shell.stage;
  stage.innerHTML=`<div class="sl" id="slRoot">
    <div class="sl-assist" role="group" aria-label="Assist level"><span class="sl-assist-label">Assist</span>${M.ASSISTS.map(a=>`<button data-assist="${a.id}" aria-pressed="false">${esc(a.label)}</button>`).join('')}</div>
    <div class="sl-boardwrap" id="slWrap"><div class="sl-caption" id="slCaption" aria-live="polite"></div>
      <svg id="slBoard" class="sl-board" xmlns="${SVGNS}" tabindex="0" role="application" aria-describedby="slProgress"></svg></div>
    <div class="sl-foot"><p class="sl-progress" id="slProgress" aria-live="polite"></p><button id="slDeploy" class="primary">Deploy links</button></div></div>`;
  const $=id=>document.getElementById(id);
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const wait=ms=>new Promise(r=>setTimeout(r,reduced()?0:ms));
  function loadAssist(){try{const v=localStorage.getItem(ASSIST_KEY);return v in ASSIST_RANK?v:'off';}catch{return 'off';}}
  const locked=()=>done||shell.ended;

  // ---- board construction (once per puzzle) -----------------------------------------------------------------------------
  function el(tag,attrs,parent){const e=document.createElementNS(SVGNS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
  function build(){
    const n=pz.size,svg=$('slBoard');svg.textContent='';
    svg.setAttribute('viewBox',`-0.06 -0.06 ${n+0.12} ${n+0.12}`);svg.style.setProperty('--n',n);
    svg.setAttribute('aria-label',`${n} by ${n} formation grid with ${pz.pairs.length} synergy pairs`);
    const defs=el('defs',{},svg),pat=el('pattern',{id:'slHatch',width:0.25,height:0.25,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'},defs);
    el('rect',{width:0.25,height:0.25,fill:'#04080c'},pat);el('rect',{width:0.08,height:0.25,fill:'#1a2631'},pat);
    const gCells=el('g',{class:'sl-cells'},svg),cells=[];
    for(let i=0;i<n*n;i++)cells.push(el('rect',{class:'sl-cell',x:i%n+0.04,y:Math.floor(i/n)+0.04,width:0.92,height:0.92,rx:0.12,'data-cell':i},gCells));
    const gPipes=el('g',{class:'sl-pipes'},svg),pipes=[],flows=[];
    for(const q of pz.pairs){pipes.push(el('path',{class:'sl-pipe',stroke:q.color,color:q.color,'data-pair':q.id,d:''},gPipes));}
    for(const q of pz.pairs){flows.push(el('path',{class:'sl-flow','data-pair':q.id,d:''},gPipes));}
    const gEnds=el('g',{class:'sl-ends'},svg),ends=[];
    for(const q of pz.pairs)for(const [cell,who] of [[q.a,q.synergy.from],[q.b,q.synergy.to]]){
      const g=el('g',{class:'sl-end','data-pair':q.id,'data-cell':cell,transform:`translate(${cell%n+0.5} ${Math.floor(cell/n)+0.5})`},gEnds);
      const inner=el('g',{class:'sl-end-in'},g);
      el('circle',{class:'sl-halo',r:0.47,fill:q.color},inner);
      el('circle',{class:'sl-disc',r:0.37,fill:q.color},inner);
      const t=el('text',{class:'sl-initial','text-anchor':'middle','dominant-baseline':'central',y:0.01},inner);t.textContent=M.CREW[who].initial;
      const title=el('title',{},g);title.textContent=`${who} (${M.CREW[who].weaver}) · ${M.caption(pz,q.id)}`;
      ends.push(g);
    }
    const cursor=el('rect',{class:'sl-cursor',x:0,y:0,width:1,height:1,rx:0.16,visibility:'hidden'},svg);
    els={svg,cells,pipes,flows,ends,cursor};fills=new Array(n*n).fill('');
  }

  // ---- rendering --------------------------------------------------------------------------------------------------------
  const centre=c=>`${c%pz.size+0.5} ${Math.floor(c/pz.size)+0.5}`;
  function pathD(p,lead){
    if(!p||p.length<2)return lead&&p&&p.length===1?`M${centre(p[0])}L${lead}`:'';
    return 'M'+p.map(centre).join('L')+(lead?`L${lead}`:'');
  }
  // Fast render of a (possibly preview) state: pipe paths, cell tints, dead cells, endpoint states.
  function draw(state,lead){
    const n=pz.size,ev=M.evaluate(pz,state),own=M.owners(pz,state),dead=assist!=='off'&&!locked()?new Set(M.deadCells(pz,state)):null;
    pz.pairs.forEach(q=>{
      const p=state.paths[q.id],ld=drag&&drag.pair===q.id?lead:null;
      els.pipes[q.id].setAttribute('d',pathD(p,ld));
      els.pipes[q.id].classList.toggle('done',ev.connected[q.id]);
      els.flows[q.id].setAttribute('d',ev.connected[q.id]?pathD(p):'');
    });
    for(let i=0;i<n*n;i++){
      const k=own[i],covered=k>=0&&state.paths[k].length>1,f=covered?pz.pairs[k].color:dead&&dead.has(i)?'dead':'';
      if(fills[i]!==f){fills[i]=f;const r=els.cells[i];if(f==='dead'){r.style.fill='';r.classList.add('dead');}else{r.classList.remove('dead');r.style.fill=f?f+'38':'';}}
    }
    for(const g of els.ends){const k=+g.dataset.pair;g.classList.toggle('done',ev.connected[k]);g.classList.toggle('active',active===k||(drag&&drag.pair===k));}
    return ev;
  }
  function render(){
    const ev=draw(st);
    const pct=Math.round(ev.filled/ev.cells*100);
    shell.meters([{label:'Links',value:`${ev.connectedCount}/${ev.pairs}`,tone:ev.allConnected?'good':''},{label:'Fill',value:pct+'%',tone:ev.full?'good':''},
      {label:'Strokes',value:String(count.strokes)},{label:'Hints',value:String(count.hints),tone:count.hints?'warn':''}]);
    $('slProgress').innerHTML=ev.solved?'<b class="ok">Every link connected and every square filled.</b>'
      :ev.allConnected?`All links connected · <b class="warn">${ev.empty} square${ev.empty===1?'':'s'} still empty</b>: fill the board for Perfect, or deploy now for Good.`
      :`${ev.connectedCount} of ${ev.pairs} links connected · ${pct}% of the grid filled${assist!=='off'?` · <span class="warn">assist on: ${esc(assistLabel(assist))}</span>`:''}`;
    $('slDeploy').textContent=`Deploy links · ${ev.connectedCount}/${ev.pairs}`;$('slDeploy').disabled=locked();
    shell.undoEnabled(history.length>0&&!locked()&&!busy);
    side(ev);
    return ev;
  }
  function side(ev){
    shell.side(`<p class="eyebrow">SYNERGIES ON THIS GRID</p><ul class="sl-list">${pz.pairs.map(q=>{const s=q.synergy,on=ev.connected[q.id];
      return `<li class="${on?'on':''}" style="--c:${q.color}"><span class="sl-sw" aria-hidden="true">${on?'✓':''}</span><div><b>${esc(s.from)} → ${esc(s.to)}</b> · ${esc(s.name)}<small>${esc(s.detail)}</small></div></li>`;}).join('')}</ul>
      <p class="eyebrow">ACTIVE FOR THE NEXT FIGHT</p><p class="sl-active">${ev.connectedCount?esc(M.output(pz,st)):'None yet'}</p>`);
  }
  const assistLabel=id=>(M.ASSISTS.find(a=>a.id===id)||{}).label||id;
  function paintAssist(){stage.querySelectorAll('[data-assist]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.assist===assist)));}
  function setAssist(id){
    if(!(id in ASSIST_RANK))return;assist=id;try{localStorage.setItem(ASSIST_KEY,id);}catch{}
    if(!locked()&&(count.strokes||count.hints)&&ASSIST_RANK[id]>ASSIST_RANK[assistUsed])assistUsed=id;
    paintAssist();fills.fill('#');render();
    shell.status(id==='off'?'Assists off: a full board without hints is Perfect.':`Assist on: ${assistLabel(id)}. Assisted solves count as Good.`,id==='off'?'':'warn');
    if(id==='auto'&&!locked()&&count.strokes)cascade();
  }

  // ---- feedback ---------------------------------------------------------------------------------------------------------
  let capTimer=null;
  function caption(k){
    const c=$('slCaption'),q=pz.pairs[k];c.innerHTML=`<span style="--c:${q.color}">${esc(M.caption(pz,k))}</span>`;
    c.classList.remove('show');void c.offsetWidth;c.classList.add('show');clearTimeout(capTimer);capTimer=setTimeout(()=>c.classList.remove('show'),2200);
  }
  function celebrate(before){
    const ev=M.evaluate(pz,st),fresh=pz.pairs.filter(q=>ev.connected[q.id]&&!before[q.id]).map(q=>q.id);
    for(const k of fresh){els.ends.filter(g=>+g.dataset.pair===k).forEach(g=>shell.flash(g,'sl-pop'));shell.flash(els.pipes[k],'sl-glow');}
    if(fresh.length)caption(fresh[fresh.length-1]);
    return fresh;
  }

  // ---- input ------------------------------------------------------------------------------------------------------------
  function cellAt(e){
    const r=drag?drag.rect:els.svg.getBoundingClientRect(),n=pz.size,pad=0.06,span=n+0.12;
    const x=(e.clientX-r.left)/r.width*span-pad,y=(e.clientY-r.top)/r.height*span-pad;
    return {cell:Math.max(0,Math.min(n-1,Math.floor(y)))*n+Math.max(0,Math.min(n-1,Math.floor(x))),x,y,inside:x>=0&&y>=0&&x<n&&y<n};
  }
  function showCursor(cell,bad){
    const c=els.cursor;if(cell<0){c.setAttribute('visibility','hidden');return;}
    c.setAttribute('x',cell%pz.size);c.setAttribute('y',Math.floor(cell/pz.size));c.setAttribute('visibility','visible');c.classList.toggle('bad',!!bad);
    if(drag)c.style.stroke=pz.pairs[drag.pair].color;else c.style.stroke='';
  }
  function startAt(cell){
    // Where a stroke may begin. Tap play first: the square next to the active link's tip (empty, or its partner) extends
    // it. Otherwise a crewmate restarts their link, and a cell on a line continues from there.
    const ep=M.endpointMap(pz),own=M.owners(pz,st);
    if(active!==null&&!M.isConnected(pz,st,active)){
      const p=st.paths[active],trail=p.length?p.slice():activeEnd!==null?[activeEnd]:null;
      if(trail){const tip=trail[trail.length-1],partner=M.partnerOf(pz,active,trail[0]);
        if(M.adjacent(pz.size,tip,cell)&&(own[cell]===-1||cell===partner))return {pair:active,trail,origin:trail[0],extend:cell};}
    }
    if(ep[cell]>=0)return {pair:ep[cell],trail:[cell],origin:cell};
    if(own[cell]>=0){const p=st.paths[own[cell]],i=p.indexOf(cell);return {pair:own[cell],trail:p.slice(0,i+1),origin:p[0]};}
    return null;
  }
  function stepTo(target){
    // Walk from the trail's tip to the target cell one square at a time; stop at the first blocked square.
    const n=pz.size;let blocked=false,moved=false;
    for(let guard=0;guard<2*n;guard++){
      const tip=drag.trail[drag.trail.length-1];if(tip===target)break;
      const tr=Math.floor(tip/n),tc=tip%n,gr=Math.floor(target/n),gc=target%n;
      const next=Math.abs(gc-tc)>=Math.abs(gr-tr)?tip+Math.sign(gc-tc):tip+n*Math.sign(gr-tr);
      const r=M.strokePath(pz,drag.base,{type:'stroke',pair:drag.pair,cells:drag.trail.concat(next)});
      if(r.why){blocked=r.why;break;}
      drag.trail=r.path.length?r.path:[drag.origin];moved=true;
    }
    return {blocked,moved};
  }
  function preview(lead){
    const s=M.clone(drag.base);M.apply(pz,s,{type:'stroke',pair:drag.pair,cells:drag.trail});drag.state=s;draw(s,lead);
  }
  function leadPoint(pt){
    // The pipe reaches a little toward the finger, along one axis, so the line follows the drag smoothly.
    const tip=drag.trail[drag.trail.length-1],n=pz.size,cx=tip%n+0.5,cy=Math.floor(tip/n)+0.5,dx=pt.x-cx,dy=pt.y-cy;
    if(Math.max(Math.abs(dx),Math.abs(dy))<0.12)return null;
    return Math.abs(dx)>=Math.abs(dy)?`${cx+Math.max(-0.45,Math.min(0.45,dx))} ${cy}`:`${cx} ${cy+Math.max(-0.45,Math.min(0.45,dy))}`;
  }
  const board=$('slBoard');
  board.addEventListener('pointerdown',e=>{
    if(!pz||locked()||busy||e.button>0)return;
    const pt=cellAt(e);if(!pt.inside)return;
    const s=startAt(pt.cell);
    if(!s){shell.status('Start on a crewmate or on one of your links.');shell.flash(els.cells[pt.cell],'mg-shake');active=null;draw(st);return;}
    e.preventDefault();shell.begin();
    try{board.setPointerCapture(e.pointerId);}catch{}
    drag={pair:s.pair,trail:s.trail,origin:s.origin,base:M.clone(st),rect:board.getBoundingClientRect(),id:e.pointerId,last:pt.cell,state:null};
    active=s.pair;activeEnd=s.origin;
    if(s.extend!==undefined){const r=stepTo(s.extend);if(r.blocked)shell.status('✕ '+r.blocked+'.','bad');}
    preview(null);showCursor(pt.cell);
  });
  board.addEventListener('pointermove',e=>{
    if(!pz)return;
    if(!drag){if(e.pointerType==='mouse'&&!locked()){const pt=cellAt(e),c=pt.inside?pt.cell:-1;if(c!==hover){hover=c;showCursor(c);}}return;}
    if(e.pointerId!==drag.id)return;
    const pt=cellAt(e);
    if(pt.cell!==drag.last){
      drag.last=pt.cell;const r=stepTo(pt.cell);
      showCursor(pt.cell,!!r.blocked);
      if(r.blocked&&r.blocked!==drag.lastWhy){drag.lastWhy=r.blocked;shell.status('✕ '+r.blocked+'.','bad');}
      preview(leadPoint(pt));
    }else if(drag.state)els.pipes[drag.pair].setAttribute('d',pathD(drag.state.paths[drag.pair].length?drag.state.paths[drag.pair]:[drag.origin],leadPoint(pt)));
  });
  function endDrag(e,cancel){
    if(!drag||(e&&e.pointerId!==drag.id))return;
    const d=drag;drag=null;showCursor(-1);hover=-1;
    if(cancel||!d.state){draw(st);return;}
    const changed=JSON.stringify(d.state.paths)!==JSON.stringify(st.paths);
    if(!changed){draw(st);return;}
    const before=pz.pairs.map(q=>M.isConnected(pz,st,q.id)),cut=st.paths.map((p,k)=>k!==d.pair&&p.length&&d.state.paths[k].length<p.length?k:-1).filter(k=>k>=0);
    history.push(st);st=d.state;count.strokes++;shell.log('stroke',{pair:d.pair,cells:st.paths[d.pair].length});
    if(M.isConnected(pz,st,d.pair))active=null;
    const fresh=celebrate(before);render();
    if(fresh.length)shell.status(`Linked: ${M.caption(pz,fresh[0])}.`,'good');
    else if(cut.length)shell.status(`Cut ${cut.map(k=>M.label(pz,k)).join(' and ')}.`,'warn');
    else if(!st.paths[d.pair].length)shell.status(`${M.label(pz,d.pair)} cleared.`);
    else shell.status(`${M.label(pz,d.pair)}: tap or drag on to reach ${pz.pairs[d.pair].synergy[st.paths[d.pair][0]===pz.pairs[d.pair].a?'to':'from']}.`);
    afterMove();
  }
  board.addEventListener('pointerup',e=>endDrag(e,false));
  board.addEventListener('pointercancel',e=>endDrag(e,true));
  board.addEventListener('pointerleave',()=>{if(!drag&&hover>=0){hover=-1;showCursor(-1);}});
  board.addEventListener('keydown',e=>{
    const dirs={ArrowUp:-pz.size,ArrowDown:pz.size,ArrowLeft:-1,ArrowRight:1};if(!(e.key in dirs)||active===null||locked()||busy)return;
    const p=st.paths[active].length?st.paths[active]:activeEnd!==null?[activeEnd]:null;if(!p)return;e.preventDefault();const tip=p[p.length-1],next=tip+dirs[e.key];
    if(next<0||next>=pz.size*pz.size||!M.adjacent(pz.size,tip,next))return;
    commitMove({type:'stroke',pair:active,cells:p.concat(next)});
  });
  function commitMove(move){
    const before=pz.pairs.map(q=>M.isConnected(pz,st,q.id)),next=M.clone(st),why=M.apply(pz,next,move);
    if(why){shell.status('✕ '+why+'.','bad');return false;}
    shell.begin();history.push(st);st=next;count.strokes++;if(M.isConnected(pz,st,move.pair))active=null;
    const fresh=celebrate(before);render();if(fresh.length)shell.status(`Linked: ${M.caption(pz,fresh[0])}.`,'good');afterMove();return true;
  }
  stage.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.assist)setAssist(b.dataset.assist);
    else if(b.id==='slDeploy')deploy();
  });

  // ---- animated drawing (hints and forced links) ------------------------------------------------------------------------
  async function animateLink(k,path,stepMs){
    // Cut what is in the way, then grow the link one square at a time.
    const before=pz.pairs.map(q=>M.isConnected(pz,st,q.id)),target=M.clone(st);M.apply(pz,target,{type:'stroke',pair:k,cells:path});
    const tmp=M.clone(target);
    if(!reduced())for(let i=2;i<=path.length;i++){tmp.paths[k]=path.slice(0,i);draw(tmp);await wait(stepMs);}
    st=target;celebrate(before);render();
  }
  async function cascade(){
    if(assist!=='auto'||locked())return;
    busy=true;shell.controls({hint:false,undo:false,auto:false});
    try{
      for(let i=0;i<pz.pairs.length;i++){
        const f=M.forcedLink(pz,st);if(!f)break;
        shell.status(`Forced: ${M.label(pz,f.pair)} has only one route left.`,'good');shell.log('forced',{pair:f.pair});
        await animateLink(f.pair,f.path,35);await wait(140);
      }
    }finally{busy=false;shell.controls({hint:true,auto:true});shell.undoEnabled(history.length>0&&!locked());}
  }
  async function afterMove(){
    if(ASSIST_RANK[assist]>ASSIST_RANK[assistUsed])assistUsed=assist;
    if(assist==='auto')await cascade();
    if(M.evaluate(pz,st).solved)complete();
  }

  // ---- game flow --------------------------------------------------------------------------------------------------------
  function onNew({seed,difficulty}){
    const t=performance.now();pz=M.generate(seed,difficulty);const ms=performance.now()-t;
    st=M.create(pz);history=[];count={strokes:0,undos:0,hints:0};assistUsed='off';drag=null;active=null;activeEnd=null;busy=false;done=false;hover=-1;
    shell.controls({hint:true,auto:true});$('slRoot').classList.remove('sl-solved');$('slCaption').classList.remove('show');
    build();paintAssist();render();
    shell.log('generated',{ms:Math.round(ms),attempts:pz.stats.attempts});
    shell.status(`${pz.pairs.length} synergies to link on a ${pz.size}×${pz.size} grid. Drag from a crewmate to their partner; fill every square.`);
  }
  function onUndo(){
    if(locked()||busy||!history.length)return;
    st=history.pop();count.undos++;active=null;render();shell.status('Undone: one stroke back.');
  }
  async function onHint(){
    if(locked()||busy)return;
    const h=M.hint(pz,st);if(!h){shell.status('Nothing to hint: every link already matches the solution.');return;}
    busy=true;shell.controls({hint:false,undo:false,auto:false});
    count.hints++;history.push(st);active=null;shell.log('hint',{pair:h.pair});
    shell.status('Hint: '+h.text,'good');
    try{await animateLink(h.pair,h.path,30);}finally{busy=false;shell.controls({hint:true,auto:true});}
    count.strokes++;render();afterMove();
  }
  function aid(){return {hints:count.hints,assist:assistUsed};}
  function stats(ev){
    return {Links:`${ev.connectedCount} / ${ev.pairs}`,Filled:`${Math.round(ev.filled/ev.cells*100)}%`,Strokes:String(count.strokes),Undos:String(count.undos),Hints:String(count.hints),Assist:assistLabel(assistUsed)};
  }
  async function complete(){
    if(locked())return;done=true;render();shell.controls({hint:false,undo:false,auto:false});
    $('slRoot').classList.add('sl-solved');
    const token=pz;await wait(900);if(pz===token&&!shell.ended)finishNow();
  }
  function deploy(){
    if(locked()||busy)return;shell.begin();done=true;render();finishNow();
  }
  function finishNow(){
    const ev=M.evaluate(pz,st),a=aid(),tier=M.tier(pz,ev,a);
    const aided=[a.hints?`${a.hints} hint${a.hints===1?'':'s'}`:'',a.assist!=='off'?`assist: ${assistLabel(a.assist)}`:''].filter(Boolean).join(' and ');
    const headline=ev.solved?(tier==='perfect'?`Every synergy linked and the whole formation filled, unaided.`:`Every synergy linked and the formation filled, with ${aided}.`)
      :ev.allConnected?`All ${ev.pairs} synergies linked, with ${ev.empty} square${ev.empty===1?'':'s'} left empty${aided?` (${aided})`:''}.`
      :ev.connectedCount?`${ev.connectedCount} of ${ev.pairs} synergies linked${aided?` (${aided})`:''}.`:'No synergies linked.';
    shell.log('finish',{tier});
    shell.finish({tier,score:M.score(pz,ev,a),headline,nearMiss:M.nearMiss(pz,st),output:M.output(pz,st),stats:stats(ev)});
  }
  function onAuto(){
    const a=M.auto(pz);st=a.state;history=[];active=null;done=true;
    const before=pz.pairs.map(()=>false);celebrate(before);render();
    const ev=a.evaluation;
    return {score:M.score(pz,ev,{assist:'auto'}),headline:`Skipped: the crew linked only the ${a.easy.length} easy pair${a.easy.length===1?'':'s'}; ${ev.pairs-a.easy.length} synergies stay inactive.`,
      nearMiss:a.nearMiss,output:M.output(pz,st),stats:{...stats(ev),Assist:'Skip (auto)'}};
  }
  let resizeT=null;window.addEventListener('resize',()=>{clearTimeout(resizeT);resizeT=setTimeout(()=>{if(drag)drag.rect=board.getBoundingClientRect();},100);});
  shell.start();
  window.SynergyLinksUI={get puzzle(){return pz;},get state(){return st;},get busy(){return busy;},get assistUsed(){return assistUsed;}};
})();
