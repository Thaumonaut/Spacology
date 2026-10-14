// Depot sorting UI: wires DepotSorting (rules) into the MiniGameKit shell. Every rule decision lives in the model.
// Tap a bay to lift its top run, tap another to drop it (or drag it there). The model state is committed at once on a
// drop; the lift, the arcing flight, the clunk and the seal stamp are decoration layered over the new board, so input
// never races an animation. Assist levels (remembered in localStorage): Puzzle; Guided lights the legal drops for a
// lifted stack; Relaxed also plays obvious finishing moves in a cascade (one undo step with the move that set it off).
(function(){
  'use strict';
  const K=window.MiniGameKit,D=window.DepotSorting,esc=K.esc;
  const LEVEL_KEY='spacologyDepotSortingAssistV1',RANK={puzzle:0,guided:1,relaxed:2};
  const CASCADE_STEP=260,FLIGHT=300,FINISH_DELAY=650;
  const ICONS={
    ore:'<path d="M4 15.5 7.5 7l6-2.5 5.5 4 1 7.5-6.5 3.5-7.5-1z"/><path d="M9 9.5l3 2.5 4-2" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1.4"/>',
    plates:'<rect x="4" y="5" width="16" height="3.4" rx="1"/><rect x="4" y="10.3" width="16" height="3.4" rx="1"/><rect x="4" y="15.6" width="16" height="3.4" rx="1"/>',
    cells:'<rect x="5" y="6" width="12" height="13" rx="2"/><rect x="8.5" y="3.5" width="5" height="2.5" rx=".8"/><path d="M12 8.5 8.8 13h2.6l-1.2 4 3.6-5h-2.6z" fill="#fff" fill-opacity=".55"/>',
    parts:'<path fill-rule="evenodd" d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
    kits:'<path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"/>',
    samples:'<path d="M9 3.5h6V5h-1v4.2l5 8.3A2 2 0 0 1 17.3 20.5H6.7A2 2 0 0 1 5 17.5l5-8.3V5H9z"/>',
    fuel:'<path d="M12 3.5S6 10.4 6 14.5a6 6 0 0 0 12 0C18 10.4 12 3.5 12 3.5z"/>',
    rations:'<rect x="5.5" y="4" width="13" height="16" rx="3"/><rect x="5.5" y="9.5" width="13" height="5" fill="#fff" fill-opacity=".4"/>'
  };
  const icon=t=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[D.TYPES[t].id]}</svg>`;
  const loadLevel=()=>{try{const v=localStorage.getItem(LEVEL_KEY);return RANK[v]!==undefined?v:'puzzle';}catch{return 'puzzle';}};
  const levelOf=id=>D.ASSIST_LEVELS.find(l=>l.id===id);
  const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let level=loadLevel(),levelUsed=level;
  let P=null,state=[],steps=[],lifted=-1,hints=0,hintMarks=null,rewind=0,undos=0,closing=false,timers=[],view=null,drag=null,suppressClick=false;
  let board=null,bayEls=[],rewindBtn=null;
  const busy=()=>!!view||closing||shell.ended;
  const moves=()=>steps.reduce((n,s)=>n+s.path.length,0);
  const autoMoves=()=>steps.reduce((n,s)=>n+s.path.length-1,0);
  const left=()=>P.budget==null?null:P.budget-moves();

  const shell=K.shell({
    id:'depot-sorting',
    difficulties:D.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),
    rules:[
      '<b>Tap a bay</b> to lift its top crate, with any matching crates under it. <b>Tap another bay</b> (or drag there) to drop.',
      'Crates only land on an <b>empty bay</b> or on <b>their own type</b>, and only as many as there is room for.',
      'Gather <b>all the crates of each type</b> into one full bay. A full bay in the right place is <b>sealed</b>.',
      '<b>Loading bays</b> (marked <b>LOAD</b>) must end with the type shown: tonight’s production draws from them. The <b>hold</b> takes one crate and must end empty.',
      'Sort within <b>par</b> moves, without hints, for Perfect. Undo is free and gives moves back. Convoy day has a move budget.'
    ],
    onNew:fresh,onAuto:auto,onUndo:()=>undo(1),onHint:giveHint
  });

  // ---------- Setup ----------
  function fresh({seed,difficulty}){
    stopView();timers.forEach(clearTimeout);timers=[];
    P=D.generate(seed,difficulty);state=P.start;steps=[];lifted=-1;hints=0;hintMarks=null;rewind=0;undos=0;closing=false;levelUsed=level;drag=null;
    shell.controls({auto:true,hint:true});build();render();
    const extras=[P.loads.length?`${P.loads.length} loading bays`:'',P.bays.some(b=>b.kind==='hold')?'a one-crate hold':'',P.budget?`a budget of ${P.budget} moves`:''].filter(Boolean);
    shell.status(`${P.types} cargo types, ${P.cap} crates each. Par ${P.par} moves${extras.length?'; '+extras.join(', '):''}.`);
  }
  function build(){
    const legend=[...new Set(P.start.flat())].sort((a,b)=>a-b).map(t=>`<li style="--c:${D.TYPES[t].color}"><span class="dp-chip">${icon(t)}</span>${esc(D.TYPES[t].label)}<small>→ ${esc(D.TYPES[t].feeds)}</small></li>`).join('');
    shell.stage.innerHTML=`<div class="dp-wrap"><div class="dp-board" id="dpBoard" data-busy="0" style="--cap:${P.cap};--half:${Math.ceil(P.bays.length/2)}">${P.bays.map((b,i)=>
      `<button type="button" class="dp-bay dp-${b.kind}" data-bay="${i}" style="--slots:${b.cap}${b.kind==='load'?`;--want:${D.TYPES[b.want].color}`:''}">
<span class="dp-tag">${b.kind==='load'?`LOAD <span class="dp-chip dp-mini" style="--c:${D.TYPES[b.want].color}">${icon(b.want)}</span>`:b.kind==='hold'?'HOLD':''}</span>
<span class="dp-slots">${b.kind==='load'?`<span class="dp-ghost" style="--c:${D.TYPES[b.want].color}">${icon(b.want)}</span>`:''}<span class="dp-stack"></span></span>
<span class="dp-stamp" aria-hidden="true">SEALED</span><span class="dp-num">${b.kind==='hold'?'H':D.bayName(P,i).replace('bay ','')}</span></button>`).join('')}</div>
<div class="dp-under"><ul class="dp-legend" aria-label="Cargo types">${legend}</ul><button type="button" id="dpRewind" class="dp-rewind" hidden></button></div></div>`;
    board=document.getElementById('dpBoard');bayEls=[...board.querySelectorAll('[data-bay]')];rewindBtn=document.getElementById('dpRewind');
    board.addEventListener('click',onClick);
    board.addEventListener('pointerdown',onDown);
    rewindBtn.addEventListener('click',()=>{if(rewind)undo(rewind);});
  }

  // ---------- Drawing ----------
  function crateHtml(t,cls){return `<span class="dp-crate${cls?' '+cls:''}" data-type="${D.TYPES[t].id}" style="--c:${D.TYPES[t].color}">${icon(t)}</span>`;}
  function render(s){
    const S=s||view&&view.state||state,guided=level!=='puzzle'&&lifted>=0&&!busy();
    const ok=guided?new Set(D.targets(P,S,lifted)):null,run=lifted>=0?D.runLength(S[lifted]):0;
    bayEls.forEach((el,i)=>{
      const b=S[i],seal=D.sealed(P,S,i);
      el.querySelector('.dp-stack').innerHTML=b.map((t,k)=>crateHtml(t,lifted===i&&k>=b.length-run?'dp-lifted':'')).join('');
      el.classList.toggle('dp-sealed',seal);
      el.classList.toggle('dp-wrong',D.full(P,S,i)&&!seal);
      el.classList.toggle('dp-up',lifted===i);
      el.classList.toggle('dp-ok',!!ok&&ok.has(i));
      el.classList.toggle('dp-no',!!ok&&i!==lifted&&!ok.has(i));
      el.classList.toggle('dp-hint-from',!!hintMarks&&hintMarks.from===i);
      el.classList.toggle('dp-hint-to',!!hintMarks&&hintMarks.to===i);
      el.setAttribute('aria-pressed',lifted===i?'true':'false');
      const kind=P.bays[i].kind==='load'?`, loading bay for ${D.TYPES[P.bays[i].want].plural}`:P.bays[i].kind==='hold'?', holds one crate':'';
      el.setAttribute('aria-label',`${D.bayName(P,i).replace(/^./,c=>c.toUpperCase())}${kind}: ${b.length?b.map(t=>D.TYPES[t].label).join(', ')+' (top last)':'empty'}${seal?', sealed':''}`);
    });
    board.dataset.busy=view||closing?'1':'0';
    const sealedN=D.sealedCount(P,S),m=view?view.moves:moves(),l=P.budget==null?null:P.budget-m;
    const list=[{label:'Moves',value:String(m),tone:m>P.par?'warn':''},{label:'Par',value:String(P.par)},{label:'Sealed',value:`${sealedN}/${P.types}`,tone:sealedN===P.types?'good':''}];
    if(l!=null)list.push({label:'Budget left',value:String(l),tone:l<=3?'bad':l<=Math.ceil(P.par*0.15)?'warn':''});
    shell.meters(list);
    shell.undoEnabled(steps.length>0&&!closing&&!shell.ended);
    rewindBtn.hidden=!rewind;if(rewind)rewindBtn.textContent=`Undo ${rewind} step${rewind===1?'':'s'} to here`;
  }

  // Flight: the crates that just landed in `to` start where they were lifted and arc in. Purely visual.
  function fly(fromRects,to,count){
    if(reduced()||!fromRects.length)return;
    const landed=[...bayEls[to].querySelectorAll('.dp-crate')].slice(-count);
    landed.forEach((el,k)=>{
      const src=fromRects[Math.min(k,fromRects.length-1)];if(!src)return;
      const dst=el.getBoundingClientRect(),dx=src.left-dst.left,dy=src.top-dst.top,peak=Math.min(dy,0)-46-k*6;
      el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:`translate(${dx*0.5}px,${peak}px)`,offset:0.5},{transform:'translate(0,0)'}],
        {duration:FLIGHT+k*40,easing:'cubic-bezier(.4,.1,.3,1)'});
      el.animate([{transform:'scale(1,1)'},{transform:'scale(1.08,.86)'},{transform:'scale(1,1)'}],{duration:160,delay:FLIGHT+k*40,easing:'ease-out',composite:'add'});
    });
  }
  const rectsOf=(i,count)=>[...bayEls[i].querySelectorAll('.dp-crate')].slice(-count).map(el=>el.getBoundingClientRect());
  function celebrate(before,after){
    bayEls.forEach((el,i)=>{if(!D.sealed(P,before,i)&&D.sealed(P,after,i)){el.classList.remove('dp-stamped');void el.offsetWidth;el.classList.add('dp-stamped');shell.flash(el);}});
  }

  // ---------- Moves ----------
  function lift(i){
    if(!state[i].length){shake(i,'That bay is empty.');return;}
    if(D.sealed(P,state,i)){shake(i,'That bay is sealed for tonight.');return;}
    lifted=i;hintMarks=hintMarks&&hintMarks.from===i?hintMarks:null;render();
  }
  function shake(i,text){const el=bayEls[i];el.classList.remove('mg-shake');void el.offsetWidth;el.classList.add('mg-shake');if(text)shell.status(text,'warn');}
  function drop(to){
    const from=lifted,m={from,to},r=D.apply(P,state,m);
    if(!r.ok){shake(to,r.reason);return false;}
    shell.begin();
    const before=state,rects=rectsOf(from,r.count),path=[{move:m,state:r.state,count:r.count,type:r.type}];
    const relaxed=level==='relaxed';let after=r.state;
    if(relaxed){const c=D.cascade(P,r.state);path.push(...c.steps);after=c.state;}
    steps.push({path,before});state=after;lifted=-1;hintMarks=null;rewind=0;
    shell.log('move',{from,to,count:r.count,auto:path.length-1});
    if(path.length>1){play(before,path,rects);return true;}
    render();fly(rects,to,r.count);celebrate(before,state);afterMove();
    return true;
  }
  // Relaxed cascade: the board is already final; this shows each step in turn. A tap fast-forwards it.
  function play(before,path,rects){
    stopView();
    view={state:path[0].state,moves:moves()-path.length+1};
    render();fly(rects,path[0].move.to,path[0].count);celebrate(before,path[0].state);
    let prev=path[0].state,k=1;
    const next=()=>{
      if(!view)return;
      if(k>=path.length){stopView();render();afterMove();return;}
      const st=path[k],r=rectsOf(st.move.from,st.count);
      view={state:st.state,moves:view.moves+1};render();fly(r,st.move.to,st.count);celebrate(prev,st.state);prev=st.state;k++;
      view.timer=setTimeout(next,CASCADE_STEP);
    };
    view.timer=setTimeout(next,CASCADE_STEP+80);
    shell.status(`Relaxed: ${path.length-1} finishing move${path.length===2?'':'s'} drop${path.length===2?'s':''} into place…`,'good');
  }
  function stopView(){if(view){clearTimeout(view.timer);view=null;}}
  function fastForward(){if(!view)return false;stopView();render();afterMove();return true;}
  function afterMove(){
    const sealedN=D.sealedCount(P,state);
    if(D.solved(P,state)){closeOut();return;}
    const l=left();
    if(l!=null&&l<=0){closing=true;render();shell.controls({auto:false,hint:false,undo:false});timers.push(setTimeout(()=>{closing=false;finishUnsolved();},FINISH_DELAY));return;}
    if(!D.legalMoves(P,state).length){shell.status('No moves left from here. Undo, or ask for a hint.','warn');return;}
    const r=D.solve(P,state,{budget:15000});
    if(r.exhausted)shell.status('No route finishes from here any more. Undo a step or two (a hint shows how far).','warn');
    else if(r.moves&&l!=null&&r.moves.length>l)shell.status(`The best route left needs ${r.moves.length} moves, but only ${l} remain in the budget. Undo to get back on track.`,'warn');
    else{const last=steps[steps.length-1],sealedBefore=D.sealedCount(P,last.before);
      shell.status(sealedN>sealedBefore?`Sealed! ${sealedN} of ${P.types} bays ready.`:`${moves()} move${moves()===1?'':'s'}, par ${P.par}.`,sealedN>sealedBefore?'good':'');}
  }
  function undo(n){
    if(shell.ended||closing)return;
    fastForward();
    let k=0;while(k<n&&steps.length){const s=steps.pop();state=s.before;k++;}
    if(!k)return;
    undos+=k;lifted=-1;hintMarks=null;rewind=0;render();
    shell.status(`Undid ${k} step${k===1?'':'s'}. ${moves()} move${moves()===1?'':'s'} on the board.`);
  }

  // ---------- Input ----------
  function tapBay(i){
    if(shell.ended||closing)return;
    if(fastForward())return;
    if(lifted<0){lift(i);return;}
    if(lifted===i){lifted=-1;render();return;}
    drop(i);
  }
  function onClick(e){
    if(suppressClick){suppressClick=false;return;}
    const el=e.target.closest('[data-bay]');if(!el)return;
    tapBay(Number(el.dataset.bay));
  }
  // Drag: press on a bay with crates and move more than a few px (bays allow vertical page scrolling, so on touch a
  // drag starts sideways); the run follows the pointer as a ghost and drops on
  // the bay under it. A press without movement stays a tap (handled by click).
  function onDown(e){
    suppressClick=false;
    if(e.button>0||busy())return;
    const el=e.target.closest('[data-bay]');if(!el)return;
    const i=Number(el.dataset.bay);if(!state[i].length||D.sealed(P,state,i))return;
    drag={i,x:e.clientX,y:e.clientY,id:e.pointerId,ghost:null,wasLifted:lifted};
    window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);window.addEventListener('pointercancel',onCancel);
  }
  function onMove(e){
    if(!drag||e.pointerId!==drag.id)return;
    if(!drag.ghost){
      if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8)return;
      lifted=drag.i;render();
      const run=[...bayEls[drag.i].querySelectorAll('.dp-lifted')],r0=run.length?run[run.length-1].getBoundingClientRect():bayEls[drag.i].getBoundingClientRect();
      const g=document.createElement('div');g.className='dp-ghost-run';g.innerHTML=run.map(c=>c.outerHTML).join('');
      document.body.appendChild(g);drag.ghost=g;drag.ox=e.clientX-r0.left;drag.oy=e.clientY-r0.top;
      bayEls[drag.i].classList.add('dp-dragging');
    }
    drag.ghost.style.transform=`translate(${e.clientX-drag.ox}px,${e.clientY-drag.oy}px)`;
    const over=document.elementFromPoint(e.clientX,e.clientY),bay=over&&over.closest&&over.closest('[data-bay]');
    bayEls.forEach(b=>b.classList.toggle('dp-over',b===bay));
  }
  function endDrag(){
    window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);window.removeEventListener('pointercancel',onCancel);
    if(drag&&drag.ghost){drag.ghost.remove();bayEls.forEach(b=>b.classList.remove('dp-over','dp-dragging'));}
  }
  function onUp(e){
    if(!drag||e.pointerId!==drag.id)return;
    const d=drag;endDrag();drag=null;
    if(!d.ghost)return; // a tap: click handles it
    suppressClick=true;setTimeout(()=>{suppressClick=false;},0); // the click that follows a drag, if any, comes first
    const over=document.elementFromPoint(e.clientX,e.clientY),bay=over&&over.closest&&over.closest('[data-bay]');
    const to=bay?Number(bay.dataset.bay):-1;
    if(to<0||to===d.i){lifted=-1;render();return;}
    if(!drop(to)){lifted=-1;render();}
  }
  function onCancel(){endDrag();drag=null;lifted=-1;render();}
  document.addEventListener('keydown',e=>{
    if(!P||e.target.closest&&e.target.closest('input,select,textarea'))return;
    if(!document.getElementById('mgResult').hidden)return;
    if(e.key==='Escape'&&lifted>=0){lifted=-1;render();return;}
    if((e.key==='z'&&(e.metaKey||e.ctrlKey))||e.key==='u'){e.preventDefault();undo(1);return;}
    const n=Number(e.key);if(n>=1&&n<=9){const i=P.bays.findIndex((b,k)=>b.kind!=='hold'&&D.bayName(P,k)===`bay ${n}`);if(i>=0){tapBay(i);bayEls[i].focus();}return;}
    if(e.key==='h'||e.key==='0'){const i=P.bays.findIndex(b=>b.kind==='hold');if(i>=0){tapBay(i);bayEls[i].focus();}}
  });

  // ---------- Hint, finish, auto ----------
  function giveHint(){
    if(closing)return;fastForward();
    const h=D.hint(P,state,steps.map(s=>s.before),left());
    if(h.kind==='none')return;
    hints++;lifted=-1;
    if(h.kind==='move'){hintMarks=h.move;rewind=0;}else{hintMarks=null;rewind=h.steps;}
    render();shell.status(`Hint ${hints}: ${h.text}`);
    shell.log('hint',{kind:h.kind});
  }
  function flat(){
    const states=[P.start],list=[];
    for(const s of steps)for(const p of s.path){list.push(p.move);states.push(p.state);}
    return {states,moves:list};
  }
  function closeOut(){
    closing=true;render();shell.controls({auto:false,hint:false,undo:false});
    const m=moves(),assisted=levelUsed==='relaxed';
    const s=D.score({solved:true,moves:m,par:P.par,hints,assist:levelUsed,sealed:P.types,types:P.types});
    let near='';
    if(s.tier!=='perfect'){
      if(m<=P.par&&hints)near=`Within par: without the ${hints} hint${hints===1?'':'s'} this was Perfect.`;
      else if(m<=P.par&&assisted)near='Within par: at Puzzle or Guided level this was Perfect.';
      else{const f=flat();near=D.nearMiss(P,f.states,f.moves)||'';}
    }
    shell.status(`Depot sorted in ${m} moves (par ${P.par}).`,'good');
    timers.push(setTimeout(()=>{
      closing=false;
      shell.finish({tier:s.tier,score:s.score,
        headline:`${assisted?'Solved · Relaxed. ':''}All ${P.types} types gathered in ${m} moves, par ${P.par}.`,
        nearMiss:near,output:D.output(P,state),stats:stats(s.score)});
      render();
    },FINISH_DELAY));
  }
  function finishUnsolved(){
    const sealedN=D.sealedCount(P,state),s=D.score({solved:false,moves:moves(),par:P.par,hints,assist:levelUsed,sealed:sealedN,types:P.types});
    const f=flat(),near=D.nearMiss(P,f.states,f.moves)||`A best route from the start takes ${P.par} moves.`;
    shell.finish({tier:s.tier,score:s.score,headline:`The move budget ran out with ${sealedN} of ${P.types} bays sealed.`,nearMiss:near,
      output:sealedN?D.output(P,state,'Partly sorted'):'Nothing sorted in time: tonight’s production waits.',stats:stats(s.score)});
    render();
  }
  function stats(score){
    return {Moves:`${moves()} / par ${P.par}`,...(P.budget?{Budget:String(P.budget)}:{}),Hints:String(hints),Undos:String(undos),
      'Assist level':levelOf(levelUsed).label,'Auto-moves':String(autoMoves()),Score:String(score)};
  }
  function auto(){
    fastForward();timers.forEach(clearTimeout);timers=[];closing=false;
    const before=state,r=D.autoFallback(P,state);
    if(r.moves.length)steps.push({path:r.moves,before});
    state=r.state;lifted=-1;hintMarks=null;rewind=0;
    setTimeout(()=>{render();celebrate(before,state);},0);
    const sc=D.score({auto:true});
    return {score:sc.score,headline:`The yard crew sealed ${r.sealed} of ${P.types} bays by the book; the rest waits for tomorrow.`,
      nearMiss:`Sorting it yourself would have readied all ${P.types} bays (par ${P.par}).`,
      output:D.output(P,state,'Depot half sorted'),stats:{Sealed:`${r.sealed}/${P.types}`,'Crew moves':String(r.moves.length),Hints:String(hints),Score:String(sc.score)}};
  }

  // ---------- Assist level ----------
  function setLevel(id){
    level=id;try{localStorage.setItem(LEVEL_KEY,id);}catch{}
    if(RANK[id]>RANK[levelUsed]&&P&&!shell.ended&&steps.length)levelUsed=id;
    if(P&&!steps.length&&!shell.ended)levelUsed=id;
    document.querySelectorAll('input[name="dpLevel"]').forEach(r=>{r.checked=r.value===id;});
    shell.log('level',{level:id});
    if(!P||shell.ended){return;}
    render();
    if(id==='relaxed'&&!busy()){
      const c=D.cascade(P,state);
      if(c.steps.length){const before=state;steps.push({path:c.steps,before});state=c.state;play(before,c.steps,rectsOf(c.steps[0].move.from,c.steps[0].count));return;}
    }
    shell.status(`${levelOf(id).label}: ${levelOf(id).note}`);
  }
  shell.side(`<p class="eyebrow dp-side-top">ASSIST LEVEL</p><div class="dp-levels" role="radiogroup" aria-label="Assist level">${D.ASSIST_LEVELS.map(l=>
    `<label class="dp-level"><input type="radio" name="dpLevel" value="${l.id}"${l.id===level?' checked':''}><span><b>${l.label}</b><small>${esc(l.note)}</small></span></label>`).join('')}</div>
<p class="eyebrow">QUALITY OF LIFE</p><ul class="dp-help"><li><b>Undo</b> is unlimited and gives the moves back. <b>Hint</b> shows the next move on a best route, or how far to undo when no route finishes.</li>
<li>A warning appears as soon as a move leaves no way to finish.</li><li>Keys: <b>1–9</b> pick a bay, <b>H</b> the hold, <b>U</b> or ctrl/⌘+Z undo, <b>Esc</b> puts a lifted stack down.</li></ul>`);
  document.querySelectorAll('input[name="dpLevel"]').forEach(r=>r.addEventListener('change',e=>{if(e.target.checked)setLevel(e.target.value);}));
  shell.start();
})();
