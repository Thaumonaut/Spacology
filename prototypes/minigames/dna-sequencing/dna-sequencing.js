// DNA sequencing UI: wires DnaSequencing (rules) into the MiniGameKit shell. All rule decisions live in the model.
// Each row is one fragment, a partial read of the hidden strand. Drag a fragment (mouse, pen or finger) left or right as
// a whole; or tap it to select it and use ◀ ▶ or the arrow keys. Columns glow green where reads agree and red where
// they clash, and the consensus row underneath fills in base by base. Flag mode greys out a stretch (tap its first and
// last base, or drag across it). "Run sequence" checks the sample: three runs per sample. Assist levels (Puzzle /
// Guided / Relaxed) are remembered in localStorage.
(function(){
  'use strict';
  const K=window.MiniGameKit,M=window.DnaSequencing,esc=K.esc;
  const LEVEL_KEY='spacologyDnaAssistV1',SOUND_KEY='spacologyDnaSoundV1',RANK={puzzle:0,guided:1,relaxed:2};
  const load=(k,d)=>{try{return localStorage.getItem(k)??d;}catch{return d;}};
  const save=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
  let level=RANK[load(LEVEL_KEY,'puzzle')]!==undefined?load(LEVEL_KEY,'puzzle'):'puzzle',levelUsed=level,sound=load(SOUND_KEY,'on')!=='off';
  // G: the game (1–2 samples). P: the sample on the board. results: one {correct, firstRun, runs} per finished sample.
  let G=null,P=null,si=0,state=null,history=[],results=[],runsUsed=0,firstMiss='',hints=0,moves=0;
  let flagging=false,pending=null,selected=-1,drag=null,closing=false,autoShown=false,hinted=null,hintTimer=0,timers=[];
  let cw=44,strips=[],tiles=[],colbg=[],cells=[],lastStatus=[];
  const levelOf=id=>M.ASSIST_LEVELS.find(l=>l.id===id);
  const busy=()=>shell.ended||closing||autoShown;
  const plural=(k,w)=>`${k} ${w}${k===1?'':w.endsWith('ch')?'es':'s'}`;
  const $=id=>document.getElementById(id);
  const reducedMotion=()=>!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const shell=K.shell({
    id:'dna-sequencing',
    difficulties:M.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),
    rules:[
      'Each row is a <b>fragment</b>: a partial read of one hidden strand. Dim <b>?</b> tiles are missing data.',
      '<b>Slide fragments</b> left or right until their bases line up. Columns glow <b>green</b> where reads agree and turn <b>red</b> where they clash.',
      'The <b>consensus</b> row underneath fills in as columns agree. Fill all of it.',
      'One stretch of 2–4 bases (two stretches on Outbreak) is <b>contamination</b>. Once everything lines up, it is the only part that disagrees with the rest. <b>Flag</b> it to grey it out.',
      '<b>Run sequence</b> to check. You get 3 runs per sample, and a failed run only tells you how many fragments are off. Undo is free.'
    ],
    onNew:fresh,onAuto:auto,onUndo:undo,onHint:giveHint
  });

  // ---------- Samples ----------
  function fresh({seed,difficulty}){
    G=M.generate(seed,difficulty);results=[];hints=0;moves=0;levelUsed=level;autoShown=false;
    loadSample(0);
  }
  function loadSample(i){
    timers.forEach(clearTimeout);timers=[];clearTimeout(hintTimer);
    si=i;P=G.samples[i];state=M.startState(P);history=[];runsUsed=0;firstMiss='';
    flagging=false;pending=null;selected=-1;drag=null;closing=false;hinted=null;
    shell.controls({auto:true,hint:true});
    lastStatus=M.consensus(P,state).cols.map(c=>c.status);
    build();layout();
    shell.status(`Sample ${si+1} of ${G.samples.length}: ${P.frags.length} fragments of a ${P.len}-base strand. Slide them until the overlaps agree, then flag ${P.stretches.length===1?'the stretch that doesn’t':'the '+P.stretches.length+' stretches that don’t'} match the rest.`);
    if(level==='relaxed')relaxedCascade();
  }

  // ---------- Board ----------
  function tileHtml(b,i,k){
    if(b<0)return `<span class="dna-tile dna-miss" data-k="${k}" aria-hidden="true"><i>?</i></span>`;
    const B=M.BASES[b];return `<span class="dna-tile dna-b${b}" data-k="${k}"><i aria-hidden="true">${B.glyph}</i><small aria-hidden="true">${B.id}</small></span>`;
  }
  function build(){
    const L=P.len;
    shell.stage.innerHTML=`<div class="dna-wrap">
<div class="dna-tools"><button id="dnaLeft" class="dna-tool dna-nudge" aria-label="Nudge the selected fragment left" title="Nudge left (←)">◀</button>
<button id="dnaRight" class="dna-tool dna-nudge" aria-label="Nudge the selected fragment right" title="Nudge right (→)">▶</button>
<button id="dnaFlag" class="dna-tool" aria-pressed="false" title="Flag a stretch as contamination (F)">⚑ Flag contamination</button>
<button id="dnaRun" class="dna-tool primary">Run sequence</button>
<span class="dna-goal" id="dnaGoal"></span></div>
<div class="dna-frame" id="dnaFrame"><div class="dna-board" id="dnaBoard" style="--W:${L}">
<div class="dna-cols">${Array.from({length:L},(_,c)=>`<div class="dna-colbg" data-colbg="${c}"></div>`).join('')}</div>
${P.frags.map((f,i)=>`<div class="dna-row" data-row="${i}"><span class="dna-label">${i+1}</span><div class="dna-track" data-track="${i}">
<div class="dna-ghost" data-ghost="${i}" style="--n:${f.len}"></div>
<div class="dna-frag" data-frag="${i}" role="button" tabindex="0" style="--n:${f.len}" aria-label="Fragment ${i+1}: ${f.len} bases, reading ${M.letters(f.bases)}">${f.bases.map((b,k)=>tileHtml(b,i,k)).join('')}</div>
</div></div>`).join('')}
<div class="dna-row dna-consensus-row"><span class="dna-label" title="Consensus">≡</span><div class="dna-cons" id="dnaCons" aria-label="Consensus">${Array.from({length:L},(_,c)=>`<span class="dna-cell" data-cell="${c}"><i></i></span>`).join('')}</div></div>
</div></div>
<div class="dna-foot">${M.BASES.map((B,b)=>`<span class="dna-key dna-b${b}"><i>${B.glyph}</i>${B.id}</span>`).join('')}<span class="dna-key"><i class="dna-k-miss">?</i>Missing data</span><span class="dna-key"><i class="dna-k-cut"></i>Flagged</span><span class="dna-key"><i class="dna-k-agree"></i>Agree</span><span class="dna-key"><i class="dna-k-clash"></i>Clash</span></div></div>`;
    const q=s=>[...shell.stage.querySelectorAll(s)];
    strips=q('.dna-frag');tiles=strips.map(s=>[...s.querySelectorAll('.dna-tile')]);colbg=q('.dna-colbg');cells=q('.dna-cell');
    const board=$('dnaBoard');
    board.addEventListener('pointerdown',down);
    board.addEventListener('keydown',key);
    $('dnaLeft').onclick=()=>nudge(-1);$('dnaRight').onclick=()=>nudge(1);
    $('dnaFlag').onclick=()=>setFlagging(!flagging);
    $('dnaRun').onclick=run;
  }
  // Column width: fit the board to the frame (22–52px); phones that cannot fit at 22px get 40px tiles and the frame scrolls.
  function layout(){
    const frame=$('dnaFrame');if(!frame)return;
    const avail=frame.clientWidth-18-28,fit=Math.floor(avail/P.len);
    cw=fit>=22?Math.min(52,fit):40;
    const board=$('dnaBoard');board.style.setProperty('--cw',cw+'px');board.classList.toggle('dna-narrow',cw<30);
    render();
  }

  function render(preview){
    const s=preview||state,con=M.consensus(P,s),guide=RANK[level]>=1&&!busy()?M.guided(P,s).filter(g=>!g.here):[];
    P.frags.forEach((f,i)=>{
      const el=strips[i],dragging=drag&&drag.moved&&!drag.flag&&drag.frag===i;
      el.style.transform=`translateX(${dragging?drag.px:s.off[i]*cw}px)`;
      el.dataset.off=s.off[i];
      el.classList.toggle('dna-drag',!!dragging);
      el.classList.toggle('dna-sel',selected===i);
      el.classList.toggle('dna-hinted',!!hinted&&hinted.frag===i);
      const g=guide.find(x=>x.frag===i);
      el.classList.toggle('dna-guide',!!g);
      const ghost=strips[i].parentNode.querySelector('.dna-ghost');
      ghost.hidden=!g;if(g)ghost.style.transform=`translateX(${g.to*cw}px)`;
      el.setAttribute('aria-pressed',String(selected===i));
      tiles[i].forEach((t,k)=>{
        const col=con.cols[s.off[i]+k];
        t.classList.toggle('dna-cut',!!s.flag[i][k]);
        t.classList.toggle('dna-pending',!!pending&&pending.frag===i&&inRange(pending,k));
        t.classList.toggle('dna-agree',f.bases[k]>=0&&!s.flag[i][k]&&col.status==='agree');
        t.classList.toggle('dna-clash',f.bases[k]>=0&&!s.flag[i][k]&&col.status==='conflict');
      });
    });
    con.cols.forEach((col,c)=>{
      colbg[c].className='dna-colbg'+(col.status==='agree'?' dna-c-agree':col.status==='conflict'?' dna-c-clash':'');
      const cell=cells[c],was=lastStatus[c];
      cell.className='dna-cell dna-s-'+col.status+(col.base>=0?' dna-b'+col.base:'');
      cell.dataset.status=col.status;
      cell.firstChild.textContent=col.status==='conflict'?'✕':col.base>=0?M.BASES[col.base].glyph:'?';
      cell.title=col.status==='conflict'?'Reads clash here':col.base>=0?M.BASES[col.base].name+(col.status==='single'?' (one read)':''):'Nothing known';
      if(!preview&&col.status==='agree'&&was&&was!=='agree')shell.flash(cell,'dna-in');
    });
    if(!preview){
      const fresh=con.cols.filter((c,i)=>c.status==='agree'&&lastStatus[i]&&lastStatus[i]!=='agree').length;
      if(fresh)click(fresh);
      lastStatus=con.cols.map(c=>c.status);
    }
    const board=$('dnaBoard');board.dataset.known=con.known;board.classList.toggle('dna-flagging',flagging);
    $('dnaFlag').setAttribute('aria-pressed',String(flagging));
    const dead=busy();$('dnaFlag').disabled=dead;$('dnaRun').disabled=dead;
    $('dnaLeft').disabled=$('dnaRight').disabled=dead||selected<0;
    $('dnaGoal').innerHTML=`Sample <b>${si+1}</b>/${G.samples.length} · Run <b>${Math.min(runsUsed+1,M.RUNS)}</b>/${M.RUNS}`;
    meters(con);
    shell.undoEnabled(history.length>0&&!dead);
  }
  const inRange=(p,k)=>k>=Math.min(p.from,p.to)&&k<=Math.max(p.from,p.to);
  function meters(con){
    const prev=($('dnaKnown')||{}).textContent,val=`${con.known} / ${P.len}`,flagged=state.flag.reduce((k,f)=>k+f.filter(Boolean).length,0);
    shell.meters([{label:'Consensus',value:val,id:'dnaKnown',tone:con.complete&&!con.conflicts?'good':con.conflicts?'warn':''},
      {label:'Clashes',value:String(con.conflicts),tone:con.conflicts?'bad':'good'},
      {label:'Runs left',value:String(M.RUNS-runsUsed),id:'dnaRuns',tone:M.RUNS-runsUsed<=1?'warn':''},
      {label:'Sample',value:`${si+1}/${G.samples.length}`},
      {label:'Flagged',value:String(flagged)}]);
    if(prev!==undefined&&prev!==val)shell.flash($('dnaKnown'));
  }

  // ---------- Input ----------
  function down(e){
    if(busy()||e.button>0)return;
    const strip=e.target.closest('.dna-frag');if(!strip)return;
    wakeAudio();e.preventDefault();
    const i=+strip.dataset.frag,t=e.target.closest('.dna-tile'),k=t?+t.dataset.k:-1;
    drag={frag:i,k,x0:e.clientX,id:e.pointerId,moved:false,flag:flagging,from:state.off[i],px:state.off[i]*cw,to:state.off[i],over:k};
    try{strip.setPointerCapture(e.pointerId);}catch{}
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);
  }
  function detach(){window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);}
  function move(e){
    if(!drag||e.pointerId!==drag.id)return;
    const dx=e.clientX-drag.x0;
    if(!drag.moved&&Math.abs(dx)<6)return;
    drag.moved=true;
    if(drag.flag){if(drag.k<0)return;drag.over=baseAt(drag.frag,e.clientX);pending={frag:drag.frag,from:drag.k,to:drag.over};render();return;}
    const f=P.frags[drag.frag];
    drag.px=Math.max(0,Math.min((P.len-f.len)*cw,drag.from*cw+dx));
    drag.to=Math.round(drag.px/cw);
    const p=drag.to===drag.from?null:M.apply(P,state,{type:'move',frag:drag.frag,to:drag.to});
    render(p||state);
  }
  function up(e){
    if(!drag||e.pointerId!==drag.id)return;
    const d=drag;drag=null;detach();
    if(d.flag){
      if(d.k<0){render();return;}
      if(d.moved&&d.over!==d.k){pending=null;flagRange(d.frag,d.k,d.over);}
      else tapBase(d.frag,d.k);
      return;
    }
    if(!d.moved){select(d.frag);return;}
    let to=d.to;if(level==='relaxed')to=M.snap(P,state,d.frag,to);
    if(to===state.off[d.frag]){render();return;}
    commit({type:'move',frag:d.frag,to});
  }
  function cancel(){drag=null;pending=null;detach();render();}
  // The base of a fragment nearest the pointer (for flag drags).
  function baseAt(i,x){
    const box=strips[i].getBoundingClientRect();return Math.max(0,Math.min(P.frags[i].len-1,Math.floor((x-box.left)/cw)));
  }
  function select(i){
    if(busy())return;
    selected=selected===i?-1:i;render();
    if(selected>=0)shell.status(`Fragment ${i+1} selected: use ◀ ▶ or the arrow keys to slide it, or drag it.`);
  }
  function tapBase(i,k){
    if(busy())return;
    if(pending&&pending.frag===i){const a=pending.from;pending=null;flagRange(i,a,k);return;}
    pending={frag:i,from:k,to:k};render();
    shell.status(`Flag: tap the last base of the stretch in fragment ${i+1} (or this base again for just one).`);
  }
  function nudge(d){
    if(busy()||selected<0)return;
    const i=selected,to=state.off[i]+d;
    if(!commit({type:'move',frag:i,to},true))return;
    requestAnimationFrame(()=>strips[i]&&strips[i].focus({preventScroll:true}));
  }
  function key(e){
    const strip=e.target.closest('.dna-frag');if(!strip||busy())return;
    const i=+strip.dataset.frag;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();selected=i;nudge(e.key==='ArrowLeft'?-1:1);}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();select(i);}
    else if(e.key==='f'||e.key==='F'){e.preventDefault();setFlagging(!flagging);}
  }
  function flagRange(i,a,b){
    const m=M.toggleMove(P,state,i,a,b);
    if(!m){shell.status('Missing data can’t be flagged: pick a stretch with known bases.','warn');render();return;}
    commit(m);
  }
  function setFlagging(on){
    if(busy())return;
    flagging=on;pending=null;render();
    shell.status(on?'Flag: tap the first and last base of a stretch, or drag across it. Flag a flagged stretch again to clear it. Tap ⚑ again to stop.':'Back to sliding fragments.');
  }

  // ---------- Moves ----------
  function commit(move,keepSelection){
    if(busy())return false;
    const next=M.apply(P,state,move);
    if(!next){
      if(move.type==='move')shell.flash(strips[move.frag],'mg-shake');
      shell.status(move.type==='move'?'That fragment can’t go past the edge of the strand.':'Nothing to change there.','warn');
      pending=null;render();return false;
    }
    shell.begin();
    history.push(state);state=next;moves++;
    if(move.type!=='move'){flagging=false;pending=null;}
    if(!keepSelection)selected=-1;
    shell.log(move.type,{...move,sample:si});
    render();
    const con=M.consensus(P,state);
    if(move.type==='move')shell.status(`Fragment ${move.frag+1} moved. Consensus ${con.known}/${P.len}${con.conflicts?`, ${plural(con.conflicts,'clash')}`:''}.`,con.complete&&!con.conflicts?'good':'');
    else shell.status(`${move.type==='flag'?'Flagged':'Cleared'} ${plural(move.to-move.from+1,'base')} in fragment ${move.frag+1}. Consensus ${con.known}/${P.len}${con.conflicts?`, ${plural(con.conflicts,'clash')}`:''}.`,con.complete&&!con.conflicts?'good':'');
    if(level==='relaxed'&&move.type==='move')relaxedCascade();
    return true;
  }
  // Relaxed: every fragment the placed ones pin down falls in after them, one at a time.
  function relaxedCascade(){
    const c=M.cascade(P,state);if(!c.moves.length)return;
    closing=true;render();
    const step=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:260;
    c.moves.forEach((m,n)=>timers.push(setTimeout(()=>{
      state=M.apply(P,state,m)||state;shell.log('snap',{...m,sample:si});render();shell.flash(strips[m.frag]);
      if(n===c.moves.length-1){closing=false;render();shell.status(`${plural(c.moves.length,'fragment')} fell into place.`,'good');}
    },(n+1)*step)));
  }
  function undo(){
    if(busy()||!history.length)return;
    state=history.pop();selected=-1;pending=null;render();
    shell.status('Undone. Undo is always free.');
  }
  function giveHint(){
    if(busy())return;
    const h=M.hint(P,state);
    if(!h){shell.status('Everything is in place and the contamination is flagged: press Run sequence.','good');return;}
    hints++;
    hinted={frag:h.move.frag};clearTimeout(hintTimer);hintTimer=setTimeout(()=>{hinted=null;if(P&&!shell.ended)render();},2000);
    const ok=commit(h.move);
    if(ok)shell.status(`Hint ${hints}: ${h.reason}`,'good');
  }

  // ---------- Runs ----------
  function run(){
    if(busy())return;
    shell.begin();runsUsed++;
    const res=M.runCheck(P,state);
    shell.log('run',{sample:si,run:runsUsed,correct:res.correct,misplaced:res.misplaced,flag:res.flag});
    if(res.correct){
      results.push({correct:true,firstRun:runsUsed===1,runs:runsUsed});
      celebrate();return;
    }
    if(!firstMiss)firstMiss=M.nearMiss(P,state);
    const left=M.RUNS-runsUsed;
    // The shake goes on the Runs-left meter, never on the Run button, so a quick second press is never blocked.
    if(left>0){shell.status(`Run ${runsUsed} failed: ${M.runText(res)}. ${plural(left,'run')} left.`,'bad');render();shell.flash($('dnaRuns'),'mg-shake');return;}
    // Third failure: the sample fails, and the true alignment is shown before moving on.
    results.push({correct:false,firstRun:false,runs:runsUsed,miss:firstMiss});
    closing=true;state=M.solvedState(P);render();
    shell.status(`Run ${runsUsed} failed: ${M.runText(res)}. Sample lost. This is how it lined up.`,'bad');
    timers.push(setTimeout(()=>{closing=false;next();},reducedMotion()?300:1600));
  }
  function celebrate(){
    closing=true;shell.controls({auto:false,hint:false,undo:false});render();
    const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,step=reduced?0:30;
    cells.forEach((el,c)=>timers.push(setTimeout(()=>{el.classList.remove('dna-wave');void el.offsetWidth;el.classList.add('dna-wave');},c*step)));
    click(3);
    shell.status(`Sequence confirmed: sample ${si+1} is clean${runsUsed>1?` (run ${runsUsed})`:''}.`,'good');
    timers.push(setTimeout(()=>{closing=false;next();},cells.length*step+(step?500:0)));
  }
  function next(){
    if(si+1<G.samples.length){loadSample(si+1);return;}
    end();
  }
  function end(){
    if(shell.ended)return;
    const r=M.score(G,{results,hints,assist:levelUsed}),relaxed=levelUsed==='relaxed',n=G.samples.length;
    const miss=results.find(x=>!x.correct)?.miss||results.find(x=>x.runs>1)?.miss||'';
    const near=r.tier==='perfect'?'':results.some(x=>!x.correct)?miss:results.some(x=>x.runs>1)?`First run missed: ${miss}`
      :hints?`Every sample sequenced, but ${plural(hints,'hint')} kept this from Perfect.`:relaxed?'Relaxed placed fragments for you, so this tops out at Good.':'';
    shell.finish({tier:r.tier,score:r.correct,
      headline:`${relaxed&&r.tier!=='failed'?'Solved · Relaxed. ':''}${r.correct} of ${plural(n,'sample')} sequenced clean${r.tier==='perfect'?', each on the first run':''}.`,
      nearMiss:near,output:M.output(G,r),
      stats:{Samples:`${r.correct}/${n}`,Runs:results.map(x=>x.runs).join(' + '),Completion:`+${r.completion}%`,Moves:String(moves),Hints:String(hints),'Assist level':levelOf(levelUsed).label}});
    shell.controls({auto:false,hint:false});render();
  }
  function auto(){
    timers.forEach(clearTimeout);timers=[];closing=false;
    const r=M.score(G,{auto:true});
    autoShown=true;history=[];state=M.autoSolve(P);selected=-1;pending=null;flagging=false;
    lastStatus=[];render();
    return {score:0,headline:`The automatic pass assembled ${plural(G.samples.length-results.filter(x=>x.correct).length,'sample')} and cut the contamination, at a reduced result.`,
      nearMiss:'Skipped: the automatic pass earns less than sequencing it yourself.',
      output:M.output(G,r),stats:{Completion:`+${r.completion}%`,Hints:String(hints)}};
  }

  // ---------- Sound: a short click when a consensus base becomes certain ----------
  let actx=null;
  function wakeAudio(){
    if(!sound)return;
    try{if(!actx){const A=window.AudioContext||window.webkitAudioContext;if(A)actx=new A();}if(actx&&actx.state==='suspended')actx.resume().catch(()=>{});}catch{actx=null;}
  }
  function click(count){
    if(!sound||!actx)return;
    try{
      for(let i=0;i<Math.min(3,count);i++){
        const t=actx.currentTime+i*0.07,o=actx.createOscillator(),g=actx.createGain();
        o.type='triangle';o.frequency.setValueAtTime(1500+i*220,t);o.frequency.exponentialRampToValueAtTime(650,t+0.05);
        g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.16,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+0.09);
        o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+0.11);
      }
    }catch{}
  }

  // ---------- Side panel ----------
  function setLevel(id){
    if(!(id in RANK))return;
    level=id;save(LEVEL_KEY,id);
    if(P&&!shell.ended&&RANK[id]>RANK[levelUsed])levelUsed=id;
    document.querySelectorAll('input[name="dnaLevel"]').forEach(r=>{r.checked=r.value===id;});
    if(P){render();shell.status(`${levelOf(id).label}: ${levelOf(id).note}`);if(id==='relaxed'&&!busy())relaxedCascade();}
  }
  shell.side(`<p class="eyebrow">ASSIST LEVEL</p><div class="dna-levels" role="radiogroup" aria-label="Assist level">${M.ASSIST_LEVELS.map(l=>
    `<label class="dna-level"><input type="radio" name="dnaLevel" value="${l.id}"${l.id===level?' checked':''}><span><b>${l.label}</b><small>${esc(l.note)}</small></span></label>`).join('')}</div>
<label class="dna-opt"><input type="checkbox" id="dnaSound"${sound?' checked':''}><span>Click when a consensus base locks in</span></label>
<p class="eyebrow">TOOLS</p><ul class="dna-help">
<li><b>Drag</b> a fragment, or tap it and use <b>◀ ▶</b> (or ← →).</li>
<li><b>⚑ Flag</b> (or F): tap the first and last base of a stretch, or drag across it. Flagged bases stop counting.</li>
<li><b>Hint</b> places the most constrained fragment, or points at the contamination once the alignment is done. It costs Perfect.</li>
<li><b>Undo</b> is free. <b>Skip</b> assembles the sample for you at a reduced result.</li></ul>`);
  document.querySelectorAll('input[name="dnaLevel"]').forEach(r=>r.addEventListener('change',e=>{if(e.target.checked)setLevel(e.target.value);}));
  $('dnaSound').addEventListener('change',e=>{sound=e.target.checked;save(SOUND_KEY,sound?'on':'off');if(sound)wakeAudio();});
  let resizeTimer=0;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(P)layout();},80);});
  shell.start();
})();
