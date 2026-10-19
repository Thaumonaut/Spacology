// Pipes UI: wires Pipes (rules) into the MiniGameKit shell. All rule decisions live in pipes-model.js.
// Tap turns a pipe 90° clockwise (right-click, Q or Shift+Enter turns it back); long-press, L or the Lock tool locks a
// tile you are sure of. Flow spreads visibly from every extractor through connected pipe as you turn tiles; open ends
// on a wet line drip, two products meeting show a red contamination marker, a fed plant lights up and a sealed
// network pulses. Assist levels (Puzzle / Guided / Relaxed, remembered in localStorage): Guided marks the tiles that
// can only fit one way; Relaxed also snaps forced tiles into place around the tile you touch, cascading outward.
// A move and its cascade are one undo step. Rotations used by hints and the Relaxed cascade never count.
(function(){
  'use strict';
  const K=window.MiniGameKit,M=window.Pipes,esc=K.esc;
  const LEVEL_KEY='spacologyPipesAssistV1',RANK={puzzle:0,guided:1,relaxed:2};
  const SNAP_STEP=110,FLOW_STEP=45; // ms between snapped tiles in a cascade, ms per pipe of newly arriving flow
  const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loadLevel=()=>{try{const v=localStorage.getItem(LEVEL_KEY);return RANK[v]!==undefined?v:'puzzle';}catch{return 'puzzle';}};
  let level=loadLevel(),levelUsed=level;
  let P=null,st=null,view=null,history=[],hints=0,hintLog=[],turns=[],angle=[],tiles=[],tool='rotate',pick=null;
  let prevA=null,anim=[],pendingSteps=null,finishing=false,armed=0,armTimer=0,hinted=-1;

  const shell=K.shell({
    id:'pipes',
    difficulties:M.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),
    rules:[
      '<b>Tap</b> a pipe to turn it 90° (right-click, Q or Shift+Enter turns it back). Link every <b>extractor</b> to the plant for its product.',
      '<b>No leaks</b>: every open pipe end must meet another, and every pipe must carry flow.',
      '<b>Keep products apart</b>: where two meet in one pipe it is contaminated (red). <b>Bridges</b> let one line hop over another.',
      '<b>Long-press</b> a tile (or use the Lock tool) to lock one you are sure of.',
      'Hard and Expert have empty <b>slots</b>: fill them from the connector tray.',
      '<b>Perfect</b>: solved within par rotations, no hints, at the Puzzle level. Expert has a rotation budget.'
    ],
    onNew:fresh,onAuto:auto,onUndo:undo,onHint:giveHint
  });
  const stage=shell.stage;

  // ---- drawing ----------------------------------------------------------------------------------------------------
  const END=[[50,0],[100,50],[50,100],[0,50]];
  const arm=(d,inward)=>inward?`M${END[d][0]} ${END[d][1]} L50 50`:`M50 50 L${END[d][0]} ${END[d][1]}`;
  const ports=m=>[0,1,2,3].filter(d=>m&M.BIT[d]);
  const flange=d=>d===0?'<rect class="pp-flange" x="29" y="0" width="42" height="9" rx="2"/>':d===2?'<rect class="pp-flange" x="29" y="91" width="42" height="9" rx="2"/>':
    d===1?'<rect class="pp-flange" x="91" y="29" width="9" height="42" rx="2"/>':'<rect class="pp-flange" x="0" y="29" width="9" height="42" rx="2"/>';
  function pipeSvg(mask,cap,bridge){
    const ps=ports(mask),path=ds=>ds.map(d=>arm(d)).join(' ');
    if(bridge){
      const layer=(ds,cls)=>`<g class="${cls}"><path class="pp-case" d="${path(ds)}"/><path class="pp-metal" d="${path(ds)}"/><path class="pp-bore" d="${path(ds)}"/>${ds.map(d=>`<path class="pp-flow" data-port="${d}" d="${arm(d)}"/>`).join('')}${ds.map(flange).join('')}</g>`;
      return layer([0,2],'pp-under')+`<path class="pp-hop" d="M0 50 L100 50"/>`+layer([1,3],'pp-over');
    }
    return `<path class="pp-case" d="${path(ps)}"/>${cap?'<circle class="pp-case" cx="50" cy="50" r="19"/>':''}<path class="pp-metal" d="${path(ps)}"/>${cap?'<circle class="pp-metal" cx="50" cy="50" r="15"/>':''}
<path class="pp-bore" d="${path(ps)}"/>${ps.map(d=>`<path class="pp-flow" data-port="${d}" d="${arm(d)}"/>`).join('')}${ps.map(flange).join('')}${cap?'<circle class="pp-valve" cx="50" cy="50" r="8"/>':''}`;
  }
  function endpointSvg(c){
    const T=M.TYPES[c.type],glyph=T.label[0];
    const body=c.kind==='source'?`<circle class="pp-body" cx="50" cy="50" r="27"/><circle class="pp-ring" cx="50" cy="50" r="20"/>`:
      `<rect class="pp-body" x="22" y="22" width="56" height="56" rx="9"/><rect class="pp-ring" x="29" y="29" width="42" height="42" rx="6"/>`;
    return `${pipeSvg(c.mask,false,false)}${body}<text class="pp-glyph" x="50" y="58">${glyph}</text>`;
  }
  function tileHtml(i){
    const c=P.cells[i],piece=c.kind==='slot'?view.placed[i]:c.piece;
    let inner;
    if(c.kind==='source'||c.kind==='sink')inner=endpointSvg(c);
    else if(c.kind==='bridge')inner=pipeSvg(15,false,true);
    else if(!piece)inner=`<rect class="pp-slotbox" x="12" y="12" width="76" height="76" rx="10"/><path class="pp-plus" d="M50 36 V64 M36 50 H64"/>`;
    else inner=`<g class="pp-rot" style="transform:rotate(${angle[i]}deg)">${pipeSvg(M.PIECES[piece].base,piece==='end',false)}</g>`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true">${inner}<g class="pp-marks"></g></svg><span class="pp-bolts" aria-hidden="true"></span>`;
  }
  function buildBoard(){
    stage.innerHTML=`<div class="pp-wrap"><div id="ppBoard" class="pp-board" style="--n:${P.n}" role="grid" aria-label="Pipe grid, ${P.n} by ${P.n}">${P.cells.map((c,i)=>
      `<button class="pp-tile pp-${c.kind}" data-cell="${i}" ${c.type?`data-type="${c.type}"`:''}></button>`).join('')}</div>
<div class="pp-tools"><div class="pp-seg" role="group" aria-label="Tap tool"><button id="ppRotate" aria-pressed="true">Rotate</button><button id="ppLock" aria-pressed="false">Lock</button>${P.slots.length?'<button id="ppLift" aria-pressed="false">Lift</button>':''}</div>
${P.slots.length?`<p class="eyebrow pp-tray-head">CONNECTOR TRAY</p><div id="ppTray" class="pp-tray"></div>`:''}
<div class="pp-lines" id="ppLines"></div><button id="ppRun" class="pp-run">Run production</button></div></div>`;
    tiles=[...stage.querySelectorAll('.pp-tile')];
    tiles.forEach((el,i)=>{el.innerHTML=tileHtml(i);wire(el,i);});
    stage.querySelector('#ppRotate').onclick=()=>setTool('rotate');stage.querySelector('#ppLock').onclick=()=>setTool('lock');
    const lf=stage.querySelector('#ppLift');if(lf)lf.onclick=()=>setTool('lift');
    stage.querySelector('#ppRun').onclick=runNow;
  }
  function setTool(t){tool=t;for(const [id,v] of [['ppRotate','rotate'],['ppLock','lock'],['ppLift','lift']]){const b=document.getElementById(id);if(b)b.setAttribute('aria-pressed',String(t===v));}
    shell.status(t==='lock'?'Lock tool: tap tiles you are sure of to lock or unlock them.':t==='lift'?'Lift tool: tap a placed connector to return it to the tray.':'');}

  // ---- input ------------------------------------------------------------------------------------------------------
  function wire(el,i){
    let timer=0,suppress=false,down=null,ptype='mouse';
    el.addEventListener('pointerdown',e=>{ptype=e.pointerType||'mouse';if(e.button&&e.button!==0)return;down=[e.clientX,e.clientY];clearTimeout(timer);
      timer=setTimeout(()=>{timer=0;suppress=true;act(i,'lock');},480);});
    const cancel=()=>{clearTimeout(timer);timer=0;};
    el.addEventListener('pointerup',cancel);el.addEventListener('pointercancel',cancel);el.addEventListener('pointerleave',cancel);
    el.addEventListener('pointermove',e=>{if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])>12)cancel();});
    el.addEventListener('click',e=>{if(suppress){suppress=false;e.preventDefault();return;}act(i,tool==='lock'?'lock':tool==='lift'?'lift':'tap');});
    el.addEventListener('contextmenu',e=>{e.preventDefault();if(ptype==='mouse')act(i,'ccw');});
    el.addEventListener('keydown',e=>{
      const k=e.key;
      if(k==='Enter'&&e.shiftKey||k==='q'||k==='Q'){e.preventDefault();act(i,'ccw');return;}
      if(k==='l'||k==='L'){e.preventDefault();act(i,'lock');return;}
      const mv={ArrowUp:-P.n,ArrowDown:P.n,ArrowLeft:-1,ArrowRight:1}[k];
      if(mv!==undefined){e.preventDefault();const j=i+mv;if(j>=0&&j<P.cells.length&&(Math.abs(mv)!==1||Math.floor(j/P.n)===Math.floor(i/P.n)))tiles[j].focus();}
    });
  }
  function busy(){return finishing||shell.ended;}
  function act(i,kind){
    if(busy()||!P)return;finishAnim();if(busy())return;shell.begin();disarm();
    const c=P.cells[i];let r;
    if(kind==='lock')r=M.toggleLock(P,st,i);
    else if(kind==='lift')r=M.lift(P,st,i);
    else if(c.kind==='slot'&&!st.placed[i]){const left=M.trayLeft(P,st),p=pick&&left[pick]>0?pick:M.TRAY_ORDER.find(x=>left[x]>0);
      r=p?M.place(P,st,i,p):{ok:false,state:st,reason:'The tray is empty: lift a connector to move it.'};}
    else r=M.rotate(P,st,i,kind==='ccw'?-1:1);
    if(!r.ok){shell.status(r.reason,'warn');shell.flash(tiles[i],'mg-shake');return;}
    const before=st;history.push(st);
    let next=r.state;
    if(kind==='tap'||kind==='ccw'){if(next.taps>before.taps){turns[i]=(turns[i]||0)+1;}}
    shell.log(kind,{cell:i});
    let steps=[];
    if(level==='relaxed'&&kind!=='lift'){const s=M.settle(P,next,{from:i});steps=s.steps;next=s.state;}
    commit(next,steps,i);
    if(kind==='lock')shell.status(next.locked[i]?`${M.label(P,i)} locked.`:`${M.label(P,i)} unlocked.`);
  }
  function commit(next,steps,origin){
    const from=st;st=next;hinted=hinted===origin?hinted:-1;
    // Snapped tiles play back one after another over the final board.
    if(steps.length&&!reduced()){
      view={...st,rot:st.rot.slice(),locked:st.locked.slice()};
      const pending=steps.filter(s=>s.cell!==origin);
      const mid=from.rot.slice(),midLock=from.locked.slice();
      // origin tile shows its final state at once; the others keep their old turn until their moment
      for(const s of pending){view.rot[s.cell]=mid[s.cell];view.locked[s.cell]=midLock[s.cell];}
      render();
      pending.forEach((s,k)=>anim.push(setTimeout(()=>{view.rot[s.cell]=st.rot[s.cell];view.locked[s.cell]=true;render();shell.flash(tiles[s.cell],'pp-snap');},SNAP_STEP*(k+1))));
      pendingSteps=steps;
      anim.push(setTimeout(()=>{anim=[];pendingSteps=null;view=st;render();afterMove(steps);},SNAP_STEP*(pending.length+1)));
    }else{view=st;render();afterMove(steps);}
  }
  // Cutting a cascade short shows the final board at once and still runs the end-of-move checks (a cascade can solve it).
  function finishAnim(){if(!anim.length)return;anim.forEach(clearTimeout);anim=[];view=st;render();
    const steps=pendingSteps;pendingSteps=null;if(steps)afterMove(steps);}
  function afterMove(steps){
    const a=M.analyze(P,st);
    if(steps.length)shell.status(`Relaxed: ${steps.length} ${steps.length===1?'tile':'tiles'} snapped into place (${steps.slice(0,6).map(s=>M.label(P,s.cell)).join(', ')}${steps.length>6?'…':''}).`,'good');
    if(a.solved){celebrate();return;}
    if(P.budget&&st.taps>=P.budget){shell.status('Out of rotations: tonight runs with the lines you have.','bad');end('out');}
  }
  function celebrate(){
    finishing=true;shell.controls({auto:false,hint:false,undo:false});
    stage.querySelector('#ppBoard').classList.add('pp-done');shell.status('Every line sealed. Base coming online…','good');
    setTimeout(()=>{finishing=false;end('solved');},reduced()?250:950);
  }

  // ---- render -----------------------------------------------------------------------------------------------------
  // Each tile's visual angle stays continuous, so a tile always turns the short way round.
  function render(){
    if(!P||!view)return;
    P.cells.forEach((c,i)=>{if(!M.rotatable(P,view,i))return;const cur=((Math.round(angle[i]/90)%4)+4)%4;let d=(view.rot[i]-cur+4)%4;if(d===3)d=-1;angle[i]+=d*90;});
    const a=M.analyzeMasks(P,M.masksOf(P,view),P.cells.every((c,i)=>c.kind!=='slot'||!!view.placed[i]));
    const showForced=level!=='puzzle'&&!shell.ended;
    const forcedSet=new Set(showForced?M.forced(P,view,{chain:false}).filter(f=>!view.locked[f.cell]).map(f=>f.cell):[]);
    const leakBy=new Map(),contBy=new Map();
    a.leaks.forEach(l=>{if(!leakBy.has(l.cell))leakBy.set(l.cell,[]);leakBy.get(l.cell).push(l.dir);});
    a.contam.forEach(c=>{for(const [cell,dir] of [[c.a,c.dir],[c.b,(c.dir+2)%4]]){if(!contBy.has(cell))contBy.set(cell,[]);contBy.get(cell).push(dir);}});
    // newly wet channels: delay their fill by how far the flow travelled to reach them
    let minNew=Infinity;const isNew=u=>a.claimed[u]!==null&&(!prevA||prevA.claimed[u]!==a.claimed[u]);
    for(let u=0;u<a.claimed.length;u++)if(isNew(u))minNew=Math.min(minNew,a.depth[u]);
    const sinkFed=new Map(a.nets.map(x=>[x.sink,x]));
    P.cells.forEach((c,i)=>{
      const el=tiles[i];
      const want=c.kind==='slot'?(view.placed[i]||''):null;
      if(c.kind==='slot'&&el.dataset.piece!==want){el.dataset.piece=want;el.innerHTML=tileHtml(i);}
      const g=el.querySelector('.pp-rot');if(g)g.style.transform=`rotate(${angle[i]}deg)`;
      // flow arms
      const rot=M.rotatable(P,view,i)?view.rot[i]:0;
      el.querySelectorAll('.pp-flow').forEach(f=>{
        const base=Number(f.dataset.port),actual=c.kind==='bridge'||c.kind==='source'||c.kind==='sink'?base:(base+rot)%4;
        const u=c.kind==='bridge'?i*2+(actual&1):i*2,t=a.claimed[u];
        if(t===null){f.removeAttribute('class');f.setAttribute('class','pp-flow');f.style.removeProperty('--flow');return;}
        const inward=a.entry[u]===actual;f.setAttribute('d',arm(base,inward));
        const fresh=isNew(u);
        f.setAttribute('class','pp-flow pp-wet'+(fresh?' pp-new':''));f.style.setProperty('--flow',M.TYPES[t].color);
        f.style.setProperty('--dl',fresh?Math.min(1200,(a.depth[u]-minNew)*FLOW_STEP)+'ms':'0ms');
      });
      // markers drawn upright (not rotated): drips on wet open ends, red joints where products meet
      const marks=[];
      for(const d of leakBy.get(i)||[]){const u=c.kind==='bridge'?i*2+(d&1):i*2,t=a.claimed[u];
        const [x,y]=END[d],cx=x===0?7:x===100?93:x,cy=y===0?7:y===100?93:y;
        marks.push(t?`<circle class="pp-drip" cx="${cx}" cy="${cy}" r="7" style="--flow:${M.TYPES[t].color}"/>`:`<circle class="pp-open" cx="${cx}" cy="${cy}" r="5"/>`);}
      for(const d of contBy.get(i)||[]){const [x,y]=END[d],cx=x===0?6:x===100?94:x,cy=y===0?6:y===100?94:y;
        marks.push(`<g class="pp-contam"><circle cx="${cx}" cy="${cy}" r="11"/><path d="M${cx-5} ${cy-5} L${cx+5} ${cy+5} M${cx+5} ${cy-5} L${cx-5} ${cy+5}"/></g>`);}
      el.querySelector('.pp-marks').innerHTML=marks.join('');
      const net=sinkFed.get(i);
      el.classList.toggle('pp-locked',!!view.locked[i]);
      el.classList.toggle('pp-forced',forcedSet.has(i));
      el.classList.toggle('pp-hinted',hinted===i);
      el.classList.toggle('pp-leak',(leakBy.get(i)||[]).some(d=>a.claimed[c.kind==='bridge'?i*2+(d&1):i*2]));
      el.classList.toggle('pp-bad',contBy.has(i));
      if(c.kind==='sink'){el.classList.toggle('pp-fed',!!net&&net.fed);el.classList.toggle('pp-sealed',!!net&&net.sealed);}
      el.setAttribute('aria-label',ariaFor(i,a));
    });
    // a plant that just came online pops; a network that just sealed pulses
    if(prevA)a.nets.forEach((x,k)=>{const was=prevA.nets[k];
      if(x.fed&&!was.fed){shell.flash(tiles[x.sink]);shell.status(`${M.TYPES[x.type].label} reaches the ${M.TYPES[x.type].sink}.`,'good');}
      if(x.sealed&&!was.sealed)pulseNet(a,x);});
    if(prevA&&a.contam.length>prevA.contam.length){const c=a.contam[a.contam.length-1];
      shell.status(`Contamination at ${M.label(P,c.a)}–${M.label(P,c.b)}: two products meet. Keep the lines apart.`,'bad');}
    prevA=a;
    meters(a);tray();lines(a);
    shell.undoEnabled(history.length>0&&!busy());
  }
  function pulseNet(a,x){if(reduced())return;const root=a.find(x.sink*2);
    P.cells.forEach((c,i)=>{const chans=c.kind==='bridge'?[i*2,i*2+1]:[i*2];if(chans.some(u=>a.masks[i]&&a.find(u)===root))shell.flash(tiles[i],'pp-pulse');});}
  function ariaFor(i,a){
    const c=P.cells[i],L=M.label(P,i);
    if(c.kind==='source'||c.kind==='sink'){const net=a.nets.find(x=>x.sink===i);return `${L}, ${M.pieceName(P,i)}${net?(net.fed?', fed':', not fed'):''}`;}
    if(c.kind==='bridge')return `${L}, bridge`;
    if(c.kind==='slot'&&!view.placed[i])return `${L}, empty slot`;
    const open=ports(a.masks[i]).map(d=>M.DIR_NAME[d]).join(' and ');
    return `${L}, ${M.pieceName(P,i,view)}, open ${open}${view.locked[i]?', locked':''}`;
  }
  function meters(a){
    const mixed=a.contam.length,leaks=a.leaks.filter(l=>a.claimed[P.cells[l.cell].kind==='bridge'?l.cell*2+(l.dir&1):l.cell*2]).length;
    const list=[{label:'Lines',value:`${a.fed}/${P.nets.length}`,tone:a.fed===P.nets.length?'good':''},{label:'Leaks',value:String(leaks),tone:leaks?'warn':'good'}];
    list.push({label:'Dry',value:String(a.dry),tone:a.dry?'':'good'});
    if(P.nets.length>1)list.push({label:'Mixed',value:String(mixed),tone:mixed?'bad':'good'});
    if(P.budget){const left=P.budget-st.taps;list.push({label:'Rotations',value:`${st.taps}/${P.budget}`,tone:left<=Math.ceil(P.budget*0.1)?'bad':st.taps>P.par?'warn':''});}
    else list.push({label:'Rotations',value:`${st.taps} · par ${P.par}`,tone:st.taps>P.par?'warn':''});
    shell.meters(list);
  }
  function tray(){
    const box=document.getElementById('ppTray');if(!box)return;const left=M.trayLeft(P,st);
    if(!pick||!(left[pick]>0))pick=M.TRAY_ORDER.find(p=>left[p]>0)||pick;
    box.innerHTML=M.TRAY_ORDER.filter(p=>P.tray[p]>0).map(p=>`<button class="pp-piece${pick===p?' on':''}" data-piece="${p}" aria-pressed="${pick===p}" ${left[p]>0?'':'disabled'} aria-label="${M.PIECES[p].label}, ${left[p]} left">
<svg viewBox="0 0 100 100" aria-hidden="true">${pipeSvg(M.PIECES[p].base,p==='end',false)}</svg><b>×${left[p]}</b></button>`).join('');
    box.querySelectorAll('[data-piece]').forEach(b=>b.onclick=()=>{pick=b.dataset.piece;if(tool!=='rotate')setTool('rotate');tray();shell.status(`Next empty slot you tap gets the ${M.PIECES[pick].label}.`);});
  }
  function lines(a){
    const box=document.getElementById('ppLines');if(!box)return;
    box.innerHTML=a.nets.map(x=>{const T=M.TYPES[x.type];return `<div class="pp-line${x.fed?' on':''}${x.mixed?' bad':''}" style="--flow:${T.color}"><i></i><span>${esc(T.label)} → ${esc(T.sinkLabel)}</span><b>${x.sealed?'sealed':x.fed?'fed':x.mixed?'mixed':'dry'}</b></div>`;}).join('');
  }

  // ---- puzzle flow --------------------------------------------------------------------------------------------------
  function fresh({seed,difficulty}){
    finishAnim();finishing=false;disarm();
    P=M.generate(seed,difficulty);st=M.initial(P);view=st;history=[];hints=0;hintLog=[];turns=[];hinted=-1;levelUsed=level;tool='rotate';pick=null;prevA=null;
    angle=P.cells.map((c,i)=>(st.rot[i]||0)*90);
    buildBoard();render();shell.controls({auto:true,hint:true,undo:false});
    shell.status(`${P.nets.map(x=>`${M.TYPES[x.type].label} → ${M.TYPES[x.type].sink}`).join(', ')}. ${P.slots.length?`${P.slots.length} empty ${P.slots.length===1?'slot':'slots'} to fill from the tray. `:''}${P.budget?`Budget: ${P.budget} rotations.`:`Par: ${P.par} rotations.`}`);
  }
  function undo(){
    if(busy()||!history.length)return;finishAnim();if(busy())return;disarm();const prev=history.pop();st={...prev,taps:st.taps};view=st;hinted=-1;render();
    shell.status(`Undone. Rotations used stay counted (${st.taps} on the board).`);
  }
  function giveHint(){
    if(busy())return;finishAnim();if(busy())return;disarm();
    const h=M.hint(P,st);if(!h){shell.status('Nothing to hint: the board already works.');return;}
    history.push(st);hints++;hintLog.push(h);hinted=h.cell;
    let next=M.applyHint(P,st,h),steps=[];
    // the hint's own turns are free: they do not count toward par or the budget
    next.taps=st.taps;
    if(level==='relaxed'&&h.kind!=='lift'){const s=M.settle(P,next,{from:h.cell});next=s.state;steps=s.steps;}
    commit(next,steps,h.cell);
    if(!M.analyze(P,st).solved)shell.status(`Hint ${hints}: ${h.reason}`,'good');
    tiles[h.cell].focus({preventScroll:true});
  }
  function disarm(){if(!armed)return;armed=0;clearTimeout(armTimer);const b=document.getElementById('ppRun');if(b){b.textContent='Run production';b.classList.remove('armed');}}
  function runNow(){
    if(busy())return;finishAnim();if(busy())return;
    const a=M.analyze(P,st);if(a.solved){celebrate();return;}
    if(!armed){armed=1;const b=document.getElementById('ppRun');b.textContent=`Run with ${a.fed}/${P.nets.length} lines? Tap again`;b.classList.add('armed');
      armTimer=setTimeout(disarm,4000);return;}
    disarm();shell.begin();end('run');
  }
  function mostTurned(){let best=null,k=0;turns.forEach((v,i)=>{if(v>k){k=v;best=i;}});return {cell:best,count:k};}
  function end(why){
    const assist=levelUsed,mt=mostTurned(),info={hints,assist,firstHint:hintLog[0]&&hintLog[0].reason,mostTurned:mt.cell,mostTurnedCount:mt.count};
    const s=M.score(P,st,info),a=M.analyze(P,st);info.tier=s.tier;
    const headline=s.tier==='perfect'?'Every line sealed within par: the base runs at full output tonight.':
      s.tier==='good'?(assist==='relaxed'?'Solved · Relaxed':assist==='guided'?'Solved · Guided':'Solved: every line runs tonight.'):
      s.tier==='partial'?`${a.fed} of ${P.nets.length} lines online${why==='out'?': out of rotations':''}.`:
      `No line reaches its plant${why==='out'?': out of rotations':''}.`;
    shell.controls({auto:false,hint:false,undo:false});
    shell.finish({tier:s.tier,score:s.score,headline,nearMiss:M.nearMiss(P,st,info),output:M.output(P,a),stats:stats(a,assist)});
    render();
  }
  function stats(a,assist){
    return {Lines:`${a.fed}/${P.nets.length}`,Rotations:`${st.taps} (par ${P.par}${P.budget?`, budget ${P.budget}`:''})`,Hints:String(hints),Assist:M.ASSIST_LEVELS.find(l=>l.id===assist).label,Locked:String(st.locked.filter(Boolean).length)};
  }
  function auto(){
    finishAnim();disarm();
    const r=M.autoFallback(P);st={...r.state,taps:st.taps};view=st;render();
    const info={tier:'auto'};shell.controls({auto:false,hint:false,undo:false});
    return {score:r.score,headline:'The automatic layout runs at reduced output.',nearMiss:M.nearMiss(P,st,info),output:r.output,stats:stats(M.analyze(P,st),levelUsed)};
  }
  function setLevel(id){
    if(!(id in RANK))return;level=id;try{localStorage.setItem(LEVEL_KEY,id);}catch{}
    if(P&&!shell.ended&&RANK[id]>RANK[levelUsed])levelUsed=id;
    document.querySelectorAll('input[name="ppLevel"]').forEach(r=>{r.checked=r.value===id;});
    if(!P||busy())return;shell.log('level',{level:id});finishAnim();render();
    shell.status(`${M.ASSIST_LEVELS.find(l=>l.id===id).label}: ${M.ASSIST_LEVELS.find(l=>l.id===id).note}`);
  }

  shell.side(`<p class="eyebrow">ASSIST LEVEL</p><div class="pp-levels" role="radiogroup" aria-label="Assist level">${M.ASSIST_LEVELS.map(l=>
    `<label class="pp-level"><input type="radio" name="ppLevel" value="${l.id}"${l.id===level?' checked':''}><span><b>${l.label}</b><small>${esc(l.note)}</small></span></label>`).join('')}</div>
<p class="eyebrow">LEGEND</p><ul class="pp-legend">
<li><i class="pp-k pp-k-src"></i>Extractor (source)</li><li><i class="pp-k pp-k-sink"></i>Plant: lights up when fed</li>
<li><i class="pp-k pp-k-drip"></i>Leak: an open end on a wet line</li><li><i class="pp-k pp-k-bad">×</i>Contamination: two products meet</li>
<li><i class="pp-k pp-k-lock"></i>Locked tile (long-press, L, or the Lock tool)</li><li><i class="pp-k pp-k-forced"></i>Can only fit one way (Guided, Relaxed)</li>
<li><i class="pp-k pp-k-bridge"></i>Bridge: two separate lines cross</li></ul>`);
  document.querySelectorAll('input[name="ppLevel"]').forEach(r=>r.addEventListener('change',e=>{if(e.target.checked)setLevel(e.target.value);}));
  window.__pipes={get P(){return P;},get st(){return st;}};
  shell.start();
})();
