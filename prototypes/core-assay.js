// Core assay UI: wires CoreAssay (rules) into the MiniGameKit shell. All rule decisions live in the model.
// The reading is a phosphor trace over discrete channels; the player's mix is stacked under it in each mineral's colour,
// and the residual strip below shows each channel's consequence (green match, amber too little, red too much). When
// every channel is accounted for the residual flatlines. Tap or hover the scope to read a channel; ◀ ▶ step through
// channels; Expert flags the stray peak on the selected channel. Assist levels (Puzzle / Guided / Relaxed, saved in
// localStorage): Guided stars unique peaks, Relaxed fills in forced amounts one by one (never Perfect).
(function(){
  'use strict';
  const K=window.MiniGameKit,A=window.CoreAssay,esc=K.esc;
  const LEVEL_KEY='spacologyCoreAssayAssistV1',RANK={puzzle:0,guided:1,relaxed:2};
  const FILL_STEP=180,CLOSE_MS=1100;
  const loadLevel=()=>{try{const v=localStorage.getItem(LEVEL_KEY);return RANK[v]!==undefined?v:'puzzle';}catch{return 'puzzle';}};
  const saveLevel=v=>{try{localStorage.setItem(LEVEL_KEY,v);}catch{}};
  let level=loadLevel(),levelUsed=level;
  let P=null,si=0,st=null,history=[],results=[],cursor=0,hover=null,hlMineral=null,wrongMarks=new Set(),flagWrong=false;
  let phase='play',queue=[],timers=[],filled=new Set(),hinted=new Set(),wasFlat=false,ymax=10;
  const $=id=>document.getElementById(id);

  const shell=K.shell({
    id:'core-assay',
    difficulties:A.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),
    rules:[
      'The <b>reading</b> (green trace) is a core sample’s spectrum. Each library mineral adds its own peaks: its height on that channel × its <b>amount, 0–3</b>.',
      'Set an amount for every mineral. Your mix stacks under the trace; the <b>residual</b> below shows what is left: <b>green</b> matches, <b>amber</b> needs more, <b>red</b> is too much.',
      'When every channel is green the residual <b>flatlines</b>. Then <b>Test</b> it: 3 tests per sample. A wrong test names the wrong minerals, not by how much.',
      'Tap or hover the scope to read a channel (◀ ▶ step). Highlighting a mineral marks its peaks; a selected channel marks the minerals that peak there.',
      'Deep and Null cores carry <b>±1 noise</b>, drawn as a band: inside the band is a match. Null cores also hide one <b>stray peak</b> no mineral explains: select it and <b>Flag</b> it.',
      '<b>Assist level</b> (side panel): Guided stars the peaks only one mineral makes; Relaxed fills forced amounts in for you. Perfect needs no hints and no Relaxed.',
      'Every sample has exactly one answer, reachable one channel at a time. Start where only one mineral peaks.'
    ],
    onNew:fresh,onAuto:auto,onUndo:undo,onHint:giveHint
  });

  // ---------- Round / sample setup ----------
  function fresh({seed,difficulty}){
    stopTimers();P=A.generate(seed,difficulty);levelUsed=level;
    results=P.samples.map(()=>({exact:false,testsUsed:0,hints:0,hinted:[],firstWrong:null,failed:false}));
    shell.controls({auto:true,hint:true});
    openSample(0);sidePanel();
  }
  function openSample(k){
    stopTimers();si=k;st=A.empty(P);history=[];wrongMarks=new Set();flagWrong=false;phase='play';filled=new Set();hinted=new Set();wasFlat=false;hover=null;hlMineral=null;
    const o=P.samples[si].obs;cursor=Math.max(0,o.findIndex(v=>v>P.tol));
    ymax=niceMax(Math.max(...o)+P.tol+2);
    build();
    if(level==='relaxed')relax();
    render();
    shell.status(`Sample ${si+1} of ${P.samples.length}: ${P.samples[si].site}. Work out how much of each mineral is in the reading.`+(P.stray?' One peak is a stray: flag it.':''));
  }
  const niceMax=v=>{for(const s of [1,2,5,10])if(v/s<=8)return Math.ceil(v/s)*s;return Math.ceil(v/10)*10;};
  const gridStep=()=>{for(const s of [1,2,5,10])if(ymax/s<=6)return s;return 10;};

  function build(){
    const C=P.channels,s=P.samples[si],tol=P.tol,y=v=>ymax-v,step=gridStep();
    const lines=[];for(let v=step;v<ymax;v+=step)lines.push(`<line x1="0" x2="${C}" y1="${y(v)}" y2="${y(v)}"/>`);
    const ylab=[];for(let v=step;v<ymax;v+=step*(ymax/step>4?2:1))ylab.push(`<span style="bottom:${v/ymax*100}%">${v}</span>`);
    const pts=s.obs.map((v,c)=>`${c+0.5},${y(v)}`).join(' ');
    const cols=[],rcols=[],axis=[];
    for(let c=0;c<C;c++){
      const segs=P.byChannel[c].map(({m})=>`<i class="ca-seg" data-seg="${m}" style="--mc:${P.library[m].color}"></i>`).join('');
      const band=tol?`<span class="ca-band" style="bottom:${Math.max(0,s.obs[c]-tol)/ymax*100}%;height:${(Math.min(ymax,s.obs[c]+tol)-Math.max(0,s.obs[c]-tol))/ymax*100}%"></span>`:'';
      cols.push(`<div class="ca-col" data-channel="${c}">${band}<span class="ca-stack">${segs}</span><b class="ca-star" aria-hidden="true">★</b><b class="ca-clip" aria-hidden="true">▲</b></div>`);
      rcols.push(`<div class="ca-rcol" data-rchannel="${c}"><i class="ca-rbar"></i></div>`);
      if(c%4===0||c===C-1)axis.push(`<span style="grid-column:${c+1}">${c+1}</span>`);
    }
    shell.stage.innerHTML=`<div class="ca-wrap">
<div class="ca-samples" id="caSamples"></div>
<div class="ca-dock" id="caDock"><div class="ca-scope" id="caScope" tabindex="0" aria-label="Spectrum scope: arrow keys choose a channel${P.stray?', F flags it':''}" style="--C:${C}">
  <div class="ca-plot" id="caPlot"><svg class="ca-grid" viewBox="0 0 ${C} ${ymax}" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>
    <div class="ca-ylab" aria-hidden="true">${ylab.join('')}</div>
    <div class="ca-cols">${cols.join('')}</div>
    <svg class="ca-trace" viewBox="0 0 ${C} ${ymax}" preserveAspectRatio="none" aria-hidden="true"><polyline class="ca-glow" points="${pts}"/><polyline class="ca-line" points="${pts}"/></svg>
  </div>
  <div class="ca-axis" aria-hidden="true">${axis.join('')}</div>
  <div class="ca-res" id="caRes"><span class="ca-flatline" aria-hidden="true"></span>${rcols.join('')}</div>
</div>
<div class="ca-tools">
  <div class="ca-read"><button id="caPrev" class="ca-step" aria-label="Previous channel">◀</button><p id="caReadout" class="ca-readout" aria-live="polite"></p><button id="caNext" class="ca-step" aria-label="Next channel">▶</button></div>
  <div class="ca-acts">${P.stray?'<button id="caFlag" class="ca-flagbtn"></button>':''}<button id="caTest" class="primary"></button><button id="caNextSample" class="primary" hidden></button></div>
</div></div>
<div id="caFound" class="ca-found" hidden></div>
<div class="ca-lib" id="caLib">${P.library.map((M,m)=>`<div class="ca-row" data-row="${m}" style="--mc:${M.color}">
  <span class="ca-ico" aria-hidden="true">${esc(M.icon)}</span>
  <div class="ca-name"><b>${esc(M.name)}</b>${M.rare?'<em>rare</em>':''}<span class="ca-badge"></span></div>
  <span class="ca-sig" aria-label="Peaks">${M.peaks.map(p=>`<span class="ca-chip" data-chip="${p.ch}">${p.ch+1}<small>×${p.h}</small></span>`).join('')}</span>
  <div class="ca-amts" role="group" aria-label="${esc(M.name)} amount">${A.AMOUNTS.map(v=>`<button class="ca-amt" data-mineral="${m}" data-amount="${v}" aria-pressed="false">${v}</button>`).join('')}</div></div>`).join('')}</div></div>`;
    wire();dockTop();
  }
  // The scope and its tools stay pinned under the page header while the library scrolls, so every amount change is
  // seen on the trace.
  function dockTop(){const h=document.querySelector('.mg-head');if($('caDock')&&h)$('caDock').style.setProperty('--ca-top',h.offsetHeight+'px');}
  window.addEventListener('resize',dockTop);

  function wire(){
    const scope=$('caScope'),pick=e=>{const r=$('caPlot').getBoundingClientRect();return Math.max(0,Math.min(P.channels-1,Math.floor((e.clientX-r.left)/r.width*P.channels)));};
    scope.addEventListener('pointerdown',e=>{cursor=pick(e);hover=null;render();});
    scope.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){const c=pick(e);if(c!==hover){hover=c;render();}}});
    scope.addEventListener('pointerleave',()=>{if(hover!==null){hover=null;render();}});
    scope.addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}
      else if((e.key==='f'||e.key==='F')&&P.stray){e.preventDefault();toggleFlag();}
    });
    $('caPrev').onclick=()=>step(-1);$('caNext').onclick=()=>step(1);
    $('caTest').onclick=submit;
    $('caNextSample').onclick=()=>{if(si+1<P.samples.length)openSample(si+1);};
    if(P.stray)$('caFlag').onclick=toggleFlag;
    const lib=$('caLib');
    lib.addEventListener('click',e=>{const b=e.target.closest('[data-amount]');if(!b)return;const m=+b.dataset.mineral,v=+b.dataset.amount;setAmount(m,st.amounts[m]===v?null:v);});
    lib.addEventListener('pointerover',e=>{const r=e.target.closest('[data-row]');const m=r?+r.dataset.row:null;if(m!==hlMineral){hlMineral=m;render();}});
    lib.addEventListener('pointerleave',()=>{hlMineral=null;render();});
    lib.addEventListener('focusin',e=>{const r=e.target.closest('[data-row]');if(r){hlMineral=+r.dataset.row;render();}});
    lib.addEventListener('keydown',e=>{const r=e.target.closest('[data-row]');if(!r||!/^[0-3]$/.test(e.key))return;e.preventDefault();setAmount(+r.dataset.row,+e.key);});
  }
  function step(d){cursor=(cursor+d+P.channels)%P.channels;hover=null;render();}

  // ---------- Moves ----------
  function playing(){return phase==='play'&&!shell.ended;}
  function commit(move){
    flush();const r=A.apply(P,st,move);if(!r.ok){shell.status(r.reason,'warn');return false;}
    shell.begin();history.push({st,filled:new Set(filled)});st=r.state;return true;
  }
  function setAmount(m,v){
    if(!playing())return;
    if(!commit({type:'amount',mineral:m,value:v}))return;
    shell.log('amount',{sample:si,mineral:P.library[m].id,value:v});
    wrongMarks.delete(m);filled.delete(m);
    if(level==='relaxed'&&v!==null)relax(m);
    render();shell.flash(document.querySelector(`[data-mineral="${m}"][data-amount="${v}"]`));
  }
  function toggleFlag(){
    if(!playing())return;
    const ch=st.flag===cursor?null:cursor;
    if(!commit({type:'flag',channel:ch}))return;
    shell.log('flag',{sample:si,channel:ch});flagWrong=false;
    if(level==='relaxed')relax();
    render();
  }
  // Relaxed: forced amounts drop in one at a time (the drop is one undo step with the move that caused it). At the start
  // of a sample the single-mineral peaks fill; after a move, only what that move directly forces (no cascade).
  function relax(trigger){
    const r=A.relaxedFills(P,si,st,trigger);
    if(r.flag!==null&&st.flag===null){st={...st,flag:r.flag};filled.add('flag');}
    queue=queue.concat(r.fills);
    const tick=()=>{const f=queue.shift();if(!f)return;place(f);render();
      shell.flash(document.querySelector(`[data-mineral="${f.mineral}"][data-amount="${f.value}"]`));
      if(queue.length)timers.push(setTimeout(tick,FILL_STEP));};
    if(queue.length){stopTimers(true);timers.push(setTimeout(tick,FILL_STEP));}
  }
  function place(f){if(st.amounts[f.mineral]!==null)return;const a=st.amounts.slice();a[f.mineral]=f.value;st={...st,amounts:a};filled.add(f.mineral);wrongMarks.delete(f.mineral);}
  function flush(){while(queue.length)place(queue.shift());stopTimers(true);}
  function stopTimers(keepQueue){timers.forEach(clearTimeout);timers=[];if(!keepQueue)queue=[];}

  function undo(){
    if(!playing()||!history.length)return;
    stopTimers();queue=[];const h=history.pop();st=h.st;filled=h.filled;wrongMarks=new Set();flagWrong=false;render();
  }
  function giveHint(){
    if(!playing())return;
    flush();const h=A.hint(P,si,st);
    if(!h){shell.status('Your mix is already right: test it.','good');return;}
    const move=h.kind==='flag'?{type:'flag',channel:h.channel}:{type:'amount',mineral:h.mineral,value:h.value};
    if(!commit(move))return;
    const rec=results[si];rec.hints++;rec.hinted.push(h.kind==='flag'?'flag':h.mineral);
    if(h.kind==='amount'){hinted.add(h.mineral);wrongMarks.delete(h.mineral);filled.delete(h.mineral);}else flagWrong=false;
    cursor=h.channel;hover=null;
    if(level==='relaxed')relax(h.kind==='amount'?h.mineral:undefined);
    render();shell.status(`Hint ${rec.hints}: ${h.reason}`);
    shell.flash(document.querySelector(`[data-channel="${h.channel}"]`));
  }
  function submit(){
    if(!playing())return;
    flush();shell.begin();
    const rec=results[si],r=A.test(P,si,st);rec.testsUsed++;
    shell.log('test',{sample:si,exact:r.exact,wrong:r.wrong.length,flagWrong:r.flagWrong});
    if(r.exact){
      rec.exact=true;phase='solved';
      const n=A.node(P,si,P.samples[si].amounts);
      $('caFound').hidden=false;$('caFound').innerHTML=`<p class="eyebrow">ASSAY ${rec.testsUsed===1&&!rec.hints?'CLEAN':'COMPLETE'}</p><p>${esc(n.text)}</p>`;
      shell.status(`Exact on test ${rec.testsUsed}. ${n.text}.`,'good');
      endSample();return;
    }
    if(!rec.firstWrong)rec.firstWrong=r.wrong.concat(r.flagWrong?['flag']:[]);
    wrongMarks=new Set(r.wrong);flagWrong=r.flagWrong;
    const names=r.wrong.map(m=>P.library[m].name);if(r.flagWrong)names.push(st.flag===null?'the missing stray flag':'the stray flag');
    const left=P.tests-rec.testsUsed;
    shell.flash($('caScope'),'mg-shake');
    if(left<=0){
      rec.failed=true;phase='failed';st={amounts:P.samples[si].amounts.slice(),flag:P.samples[si].stray};wrongMarks=new Set();flagWrong=false;
      shell.status(`Out of tests: ${list(names)} ${names.length>1?'were':'was'} wrong. The answer is shown; no node from this sample.`,'bad');
      endSample();return;
    }
    shell.status(`Test ${rec.testsUsed}: ${list(names)} ${names.length>1?'are':'is'} wrong (not by how much). ${left} test${left>1?'s':''} left.`,'warn');
    render();
  }
  const list=a=>a.length<=1?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
  function endSample(){
    stopTimers();render();
    if(phase==='solved')shell.flash($('caRes'),'ca-sweep');
    const last=si+1>=P.samples.length;
    if(last){phase='closing';shell.controls({auto:false,hint:false,undo:false});timers.push(setTimeout(finishRound,CLOSE_MS));}
    else{$('caNextSample').hidden=false;$('caNextSample').focus();}
    render();
  }

  // ---------- Results ----------
  function finishRound(){
    const relaxed=levelUsed==='relaxed',g=A.grade(P,results,{relaxed}),n=P.samples.length;
    const nodes=P.samples.map((s,k)=>results[k].exact?A.node(P,k,s.amounts):null).filter(Boolean);
    const tests=results.reduce((t,r)=>t+r.testsUsed,0),hints=results.reduce((t,r)=>t+r.hints,0);
    const base=g.tier==='perfect'?`Every sample exact on the first test: ${nodes.length} resource node${nodes.length>1?'s':''} for logistics.`
      :g.tier==='good'?`All ${n} samples assayed.`:g.tier==='partial'?`${g.exact} of ${n} samples assayed.`:'No sample was assayed.';
    shell.finish({tier:g.tier,score:g.score,headline:(relaxed&&g.exact?'Solved · Relaxed. ':'')+base,nearMiss:A.nearMiss(P,results),
      output:nodes.map(x=>x.text).join('; '),
      stats:{Score:g.score,Exact:`${g.exact}/${n}`,Tests:tests,Hints:hints,Assist:A.ASSIST_LEVELS.find(l=>l.id===levelUsed).label}});
  }
  function auto(){
    stopTimers();queue=[];
    if(results[si]&&!results[si].exact&&!results[si].failed){st={amounts:P.samples[si].amounts.slice(),flag:P.samples[si].stray};}
    phase='auto';
    const r=A.auto(P,results);render();
    const unsolved=P.samples.map((s,k)=>r.results[k].auto?A.node(P,k,s.amounts).text:null).filter(Boolean);
    return {score:r.score,headline:`Automatic assay: ${r.nodes.length} rough node${r.nodes.length===1?'':'s'}.`,
      nearMiss:unsolved.length?`Solving would have found: ${unsolved.join('; ')}.`:'',output:r.nodes.map(x=>x.text).join('; '),
      stats:{Score:r.score,Auto:`${r.results.filter(x=>x.auto).length}/${P.samples.length}`}};
  }

  // ---------- Assist panel ----------
  function sidePanel(){
    shell.side(`<p class="eyebrow">ASSIST LEVEL</p><div class="ca-assist" role="group" aria-label="Assist level">${A.ASSIST_LEVELS.map(l=>`<button data-assist="${l.id}" aria-pressed="${l.id===level}">${l.label}</button>`).join('')}</div><p class="ca-assist-note" id="caAssistNote"></p>`);
    document.querySelectorAll('[data-assist]').forEach(b=>b.onclick=()=>setLevel(b.dataset.assist));
    noteLevel();
  }
  function noteLevel(){
    const l=A.ASSIST_LEVELS.find(x=>x.id===level);$('caAssistNote').textContent=l.note+(levelUsed!==level&&RANK[levelUsed]>RANK[level]?` This round used ${A.ASSIST_LEVELS.find(x=>x.id===levelUsed).label}.`:'');
    document.querySelectorAll('[data-assist]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.assist===level)));
  }
  function setLevel(id){
    level=id;saveLevel(id);if(RANK[id]>RANK[levelUsed]&&!shell.ended)levelUsed=id;
    noteLevel();
    if(P&&playing()){if(id==='relaxed')relax();render();}
  }

  // ---------- Render ----------
  function render(){
    if(!P)return;
    const s=P.samples[si],C=P.channels,tol=P.tol,states=A.channelStates(P,si,st.amounts,st.flag),res=A.residual(P,si,st.amounts),guess=A.mix(P,st.amounts);
    const flat=A.flatline(P,si,st.amounts,st.flag),view=hover!==null?hover:cursor,guided=level!=='puzzle';
    const uniq=new Set();if(guided)P.library.forEach((_,m)=>A.uniquePeaks(P,m).forEach(c=>uniq.add(c)));
    const hlCh=new Set(hlMineral!==null?P.library[hlMineral].peaks.map(p=>p.ch):[]);
    const onView=new Set(P.byChannel[view].map(x=>x.m));
    const rscale=Math.max(4,ymax/2);
    document.querySelectorAll('#caPlot [data-channel]').forEach(col=>{
      const c=+col.dataset.channel;
      col.className=`ca-col ca-${states[c]}`+(c===cursor?' ca-cursor':'')+(c===hover?' ca-hover':'')+(hlCh.has(c)?' ca-hlpeak':'')+(uniq.has(c)?' ca-unique':'')+(c===st.flag?' ca-flagged':'')+(guess[c]>ymax?' ca-over-top':'');
      col.querySelectorAll('[data-seg]').forEach(seg=>{const m=+seg.dataset.seg,h=P.library[m].peaks.find(p=>p.ch===c).h;seg.style.height=((st.amounts[m]||0)*h/ymax*100)+'%';});
    });
    document.querySelectorAll('#caRes [data-rchannel]').forEach(rc=>{
      const c=+rc.dataset.rchannel,r=res[c],k=states[c],bar=rc.firstChild,signal=s.obs[c]>tol||guess[c]>0;
      rc.className=`ca-rcol ca-r-${k}`+(signal?' ca-signal':'')+(c===cursor?' ca-cursor':'');
      const pct=Math.min(50,Math.abs(r)/rscale*50);
      bar.style.height=(k==='match'||k==='stray'||k==='badflag')?'':pct+'%';
    });
    $('caScope').classList.toggle('ca-flat',flat);
    if(flat&&!wasFlat&&phase==='play')shell.flash($('caRes'),'ca-sweep');
    wasFlat=flat;
    // Readout for the viewed channel.
    const cons=P.byChannel[view],r=res[view],k=states[view];
    const contrib=cons.filter(x=>st.amounts[x.m]).map(x=>`${P.library[x.m].name} ${st.amounts[x.m]}×${x.h}`).join(' + ');
    const kText={match:'match',under:`needs ${r} more`,over:`${-r} too much`,stray:'flagged stray: unexplained, as it should be',badflag:'flagged, but your mix explains it'}[k];
    $('caReadout').innerHTML=`<b>Ch ${view+1}</b> reads <b>${s.obs[view]}</b>${tol?` <small>±${tol}</small>`:''} · mix <b>${guess[view]}</b>${contrib?` <small class="ca-contrib">(${esc(contrib)})</small>`:''} · <span class="ca-k-${k}">${kText}</span><small class="ca-peaks"><br>${cons.length?'Peaks here: '+cons.map(x=>`${esc(P.library[x.m].name)} ×${x.h}`).join(', '):'No library mineral peaks here.'}</small>`;
    // Library rows.
    document.querySelectorAll('#caLib [data-row]').forEach(row=>{
      const m=+row.dataset.row,a=st.amounts[m];
      row.className='ca-row'+(wrongMarks.has(m)?' ca-wrong':'')+(hinted.has(m)?' ca-hinted':'')+(filled.has(m)?' ca-filled':'')+(onView.has(m)?' ca-onch':'')+(m===hlMineral?' ca-hl':'')+(a===null?' ca-unset':'');
      row.querySelectorAll('[data-amount]').forEach(b=>{b.setAttribute('aria-pressed',String(+b.dataset.amount===a));b.disabled=!playing();});
      row.querySelectorAll('[data-chip]').forEach(ch=>{const c=+ch.dataset.chip;ch.className='ca-chip'+(uniq.has(c)?' ca-unique':'')+(c===view?' ca-chip-on':'')+(states[c]!=='match'&&states[c]!=='stray'?' ca-chip-off':'');});
      row.querySelector('.ca-badge').textContent=wrongMarks.has(m)?'wrong':hinted.has(m)?'hint':filled.has(m)?'auto':'';
    });
    // Tools.
    const rec=results[si],left=P.tests-rec.testsUsed;
    $('caTest').textContent=`Test mix · ${left} left`;$('caTest').disabled=!playing();$('caTest').hidden=phase!=='play';
    $('caTest').classList.toggle('ca-ready',flat);
    if(P.stray){const f=$('caFlag');f.textContent=st.flag===cursor?`Unflag ch ${cursor+1}`:`Flag ch ${cursor+1} as stray`;f.disabled=!playing();f.classList.toggle('ca-flag-wrong',flagWrong);f.setAttribute('aria-pressed',String(st.flag===cursor));}
    $('caNextSample').hidden=phase!=='solved'&&phase!=='failed'||si+1>=P.samples.length;
    $('caNextSample').textContent=`Next sample (${si+2}/${P.samples.length})`;
    if(phase==='play')$('caFound').hidden=true;
    // Sample pills and meters.
    $('caSamples').innerHTML=P.samples.map((x,k)=>{const r=results[k],mark=r.exact?'✓':r.failed?'✗':k===si?'●':'○';
      return `<span class="ca-pill${k===si?' ca-pill-on':''}${r.exact?' ca-pill-ok':''}${r.failed?' ca-pill-bad':''}">${mark} ${esc(x.site)}</span>`;}).join('');
    const exact=results.filter(r=>r.exact).length,hints=results.reduce((t,r)=>t+r.hints,0);
    shell.meters([{label:'Sample',value:`${si+1}/${P.samples.length}`},{label:'Tests left',value:String(left),tone:left<=1?'bad':left<P.tests?'warn':''},
      {label:'Exact',value:`${exact}/${P.samples.length}`,tone:exact?'good':''},{label:'Hints',value:String(hints),tone:hints?'warn':''}]);
    shell.undoEnabled(playing()&&history.length>0);
  }

  shell.start();
})();
