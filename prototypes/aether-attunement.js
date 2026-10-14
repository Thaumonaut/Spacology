// Aether attunement UI (Research, night: the boss study): wires AetherAttunement (rules, solver) into the MiniGameKit shell.
// A round is one boss; each sample is a board that targets one of its buffs and carries an objective (End on X, Lead
// with Y). Touch-first: tap a reagent (or a board cell of that element) to preview what it would absorb, tap again to
// apply. The crew strip of version 1 became the reagent rack: in the lab the crew's elements do not limit which
// reagents research can apply, so names would only be noise; the rack still varies per sample (inert tissue).
// Assist levels (Puzzle / Guided / Relaxed) are remembered in localStorage.
(function(){
  'use strict';
  const K=window.MiniGameKit,A=window.AetherAttunement,{ELEMENTS,GLYPHS}=A,esc=K.esc;
  const LEVEL_KEY='spacologyAetherAssistV1',RANK={puzzle:0,guided:1,relaxed:2};
  const load=(k,d)=>{try{return localStorage.getItem(k)||d;}catch{return d;}},save=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
  const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const levelOf=id=>A.ASSIST_LEVELS.find(l=>l.id===id);
  let level=RANK[load(LEVEL_KEY,'puzzle')]!==undefined?load(LEVEL_KEY,'puzzle'):'puzzle',levelUsed=level;
  let R=null,idx=0,P=null,st=null,history=[],armed=null,hinted=null,hints=0,undos=0,autoMoves=0,finished=false,locked=false,results=[],focusCell=0,obj=null;

  const shell=K.shell({id:'aether-attunement',defaultDifficulty:'calm',
    difficulties:A.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),
    rules:[
      '<b>Study the boss.</b> Each sample is boss tissue. Apply a reagent: the whole reacted region takes that element and absorbs every touching cell of it. Tap once to preview, tap again (or press Apply) to commit.',
      '<b>Meet the objective.</b> <i>End on X</i>: the sample only stabilises if X closes the reaction. Hold X back: one X move swallows every touching X group, and with no X left there is nothing to close on. <i>Lead with Y</i>: Y must open the reaction.',
      `<b>Each clean sample strips a buff.</b> Objective met within par+${A.SLACK} removes the buff; a broken objective only weakens it. A clean End-on sample reveals the boss’s weakness for exploration.`,
      '<b>The chip</b> over the board turns amber when par is out of reach and red when the objective can no longer be met. A previewed reagent that would break it shows ⚠.',
      '<b>Inert tissue</b> (dashed, not on the rack) joins by resonance the moment every open cell around it has reacted.',
      '<b>Round result:</b> Perfect, every buff removed at par with no hints; Good, all removed; Partial, some; Failed, none. Skip cleans the rest greedily, ignoring the objective, so those buffs only weaken.'
    ],
    onNew,onAuto,onUndo,onHint});

  const stage=shell.stage;
  stage.innerHTML=`<div class="aa">
    <section class="aa-boss" aria-label="Boss under study"><div class="aa-bosshead"><p class="eyebrow">BOSS STUDY</p><h2 id="aaBossName"></h2><p class="aa-small" id="aaBossMeta"></p></div><ul class="aa-buffs" id="aaBuffs"></ul></section>
    <div class="aa-objective" id="aaObjective" aria-live="polite"><p class="aa-obj-kicker" id="aaObjKicker"></p><p class="aa-obj-text" id="aaObjText"></p><span class="aa-chip" id="aaChip"></span></div>
    <div class="aa-rack" id="aaRack" role="group" aria-label="Reagent rack"></div>
    <p class="aa-foreign" id="aaForeign"></p>
    <div class="aa-boardwrap"><p class="aa-motif" id="aaMotif"></p><div class="aa-board" id="aaBoard" role="grid" aria-label="Sample"></div></div>
    <div class="aa-fillbar" aria-hidden="true"><div class="aa-fill" id="aaFill"></div><span id="aaFillText"></span></div>
    <div class="aa-actions"><button id="aaCommit" class="primary" disabled>Apply</button><button id="aaClear" disabled>Clear preview</button><button id="aaNext" class="primary" hidden>Next sample</button></div>
  </div>`;
  const $=id=>document.getElementById(id),board=$('aaBoard');

  // ---------- side panel: assist level and stakes ----------
  shell.side(`<p class="eyebrow">ASSIST LEVEL</p><div class="aa-levels" role="radiogroup" aria-label="Assist level">${A.ASSIST_LEVELS.map(l=>
    `<label class="aa-level"><input type="radio" name="aaLevel" value="${l.id}"${l.id===level?' checked':''}><span><b>${l.label}</b><small>${esc(l.note)}</small></span></label>`).join('')}</div>
    <p class="eyebrow">STAKES</p><p class="aa-small" id="aaStakes"></p>`);
  document.querySelectorAll('input[name="aaLevel"]').forEach(r=>r.addEventListener('change',e=>{if(e.target.checked)setLevel(e.target.value);}));
  function setLevel(id){
    if(!(id in RANK))return;
    level=id;save(LEVEL_KEY,id);
    if(R&&!finished&&RANK[id]>RANK[levelUsed])levelUsed=id;
    document.querySelectorAll('input[name="aaLevel"]').forEach(r=>{r.checked=r.value===id;});
    if(P&&!finished){render();shell.status(`${levelOf(id).label}: ${levelOf(id).note}`);if(!locked)runForced();}
  }

  // ---------- rendering ----------
  const elName=c=>ELEMENTS[c],cap=A.title;
  const tag=c=>`<span class="aa-el el-${elName(c)}"><span aria-hidden="true">${GLYPHS[elName(c)]}</span> ${cap(c)}</span>`;
  function objectiveHTML(o){const parts=[];if(o.lead!=null)parts.push(`Lead with ${tag(o.lead)}`);if(o.end!=null)parts.push(`End on ${tag(o.end)}`);return parts.join('<span class="aa-obj-sep"> · </span>');}
  function regionDistances(att){
    const s=P.size,d=new Int16Array(s*s).fill(-1),q=[P.origin];d[P.origin]=0;
    for(let h=0;h<q.length;h++){const i=q[h],x=i%s,y=(i/s)|0;for(const j of [x>0?i-1:-1,x<s-1?i+1:-1,y>0?i-s:-1,y<s-1?i+s:-1])if(j>=0&&att[j]&&d[j]<0){d[j]=d[i]+1;q.push(j);}}
    return d;
  }
  function frontier(){ // Guided: every cell of a rack group touching the reaction
    const T=A.topology(P),out=new Set();
    for(let a=0;a<T.n;a++)if(st.abs[a])for(const b of T.adj[a])if(!st.abs[b])for(const i of T.members[b])out.add(i);
    return out;
  }
  function renderBoss(){
    $('aaBossName').textContent=R.boss.name;$('aaBossMeta').textContent=`${R.boss.role} · ${R.boss.origin}`;
    const n=R.samples.length;
    $('aaBuffs').innerHTML=R.buffs.map((b,k)=>{
      const r=results[k],state=k>=n?'untested':r?r.outcome:k===idx&&!finished?'testing':'queued';
      const label={untested:'Not sampled tonight',removed:r&&r.atPar?'Removed · at par':'Removed',weakened:'Weakened',testing:`Sample ${k+1} · testing`,queued:`Sample ${k+1}`}[state];
      return `<li class="aa-buff" data-buff="${k}" data-state="${state}"><b>${esc(b.name)}</b><small>${esc(b.text)}</small><em>${label}</em></li>`;
    }).join('');
  }
  function renderRack(){
    $('aaRack').innerHTML=P.palette.map((c,k)=>{const r=A.preview(P,st,c),g=r.ok?r.absorbed.length+r.resonance.length:0;
      return `<button class="aa-swatch el-${elName(c)}" data-swatch="${elName(c)}" data-colour="${c}" aria-pressed="false" aria-label="${cap(c)} reagent${r.ok?`, reaches ${g} cells`:', touches nothing'}. Key ${k+1}."><span class="aa-glyph" aria-hidden="true">${GLYPHS[elName(c)]}</span><b>${cap(c)}</b><small>${r.ok&&!locked?`+${g} now`:'no contact'}</small><em aria-hidden="true">${k+1}</em><i class="aa-warn" aria-hidden="true">⚠</i></button>`;}).join('');
    $('aaForeign').innerHTML=P.foreign.length?`Inert in this sample: ${P.foreign.map(c=>`<span class="aa-tag el-${elName(c)}"><span aria-hidden="true">${GLYPHS[elName(c)]}</span> ${cap(c)}</span>`).join(' ')} <span class="aa-muted">· resonance only</span>`:'';
  }
  function cellLabel(i,att,shown){
    const s=P.size,r=((i/s)|0)+1,c=(i%s)+1,v=P.cells[i];
    if(v<0)return `Row ${r}, column ${c}: null-scar`;
    return `Row ${r}, column ${c}: ${att?'reacted, now '+elName(shown):elName(v)+(P.palette.includes(v)?'':' (inert, resonance only)')}${i===P.origin?', core':''}`;
  }
  function renderBoard(anim){
    const att=A.attuned(P,st),dist=anim?regionDistances(att):null,prev=anim&&anim.before,n=P.size*P.size,out=[];
    const front=level==='guided'&&!locked?frontier():null;
    for(let i=0;i<n;i++){
      const v=P.cells[i],a=att[i],shown=a?st.colour:v,cls=['aa-c'];
      if(v<0)cls.push('scar');else{cls.push('el-'+elName(shown));if(a)cls.push('att');else if(!P.palette.includes(v))cls.push('fx');}
      if(i===P.origin)cls.push('origin');
      if(front&&front.has(i))cls.push('frontier');
      let style='';
      if(dist&&a&&dist[i]>=0){cls.push(prev&&!prev[i]?'new':'wave');style=` style="--d:${dist[i]}"`;}
      out.push(`<button class="${cls.join(' ')}" data-cell="${i}" role="gridcell" tabindex="${i===focusCell?0:-1}" aria-label="${esc(cellLabel(i,a,shown))}"${style}></button>`);
    }
    board.style.setProperty('--n',P.size);board.innerHTML=out.join('');
    const total=A.absorbable(P),got=att.reduce((x,y)=>x+y,0),pct=Math.round(got/total*100);
    $('aaFill').style.width=pct+'%';$('aaFillText').textContent=`Reacted ${got} / ${total} cells`;
    return {pct};
  }
  const CHIP={par:p=>`Par ${p} in reach`,over:()=>'Par out of reach · clean still counts',lost:()=>'Objective lost · buff will only weaken',met:()=>'Objective met',broken:()=>'Objective broken'};
  function renderObjective(){
    obj=A.objectiveStatus(P,st);
    $('aaObjKicker').textContent=`Sample ${idx+1} of ${R.samples.length} · targets ${R.buffs[P.buff].name}`;
    $('aaObjText').innerHTML=objectiveHTML(P.objective);
    const chip=$('aaChip');chip.dataset.state=obj.state;chip.textContent=CHIP[obj.state](P.par);
  }
  function renderMeters(info){
    const moves=st.moves.length,tone=moves<=P.par?'good':moves<=P.limit?'warn':'bad',removed=results.filter(r=>r.outcome==='removed').length;
    shell.meters([
      {label:`Moves · par ${P.par}`,value:`${moves} / ${P.limit}`,tone},
      {label:'Sample',value:`${idx+1} / ${R.samples.length}`},
      {label:'Buffs removed',value:`${removed} / ${R.samples.length}`,tone:removed?'good':''},
      {label:'Reacted',value:info.pct+'%'}
    ]);
  }
  function render(anim){
    const info=renderBoard(anim);renderObjective();renderMeters(info);renderRack();renderBoss();
    shell.undoEnabled(history.length>0&&!finished&&!locked);
    setArmed(null);
  }
  function renderStakes(){
    $('aaStakes').innerHTML=`Par ${P.par} · limit ${P.limit} for “${esc(A.objectiveText(P.objective))}”. Par is the proven minimum among lines that meet the objective; without it this sample takes ${P.freePar}. A careful greedy player ${P.greedy.met?`needs ${P.greedy.moves} moves`:'cannot meet it'}; grabbing the most cells each move ${P.plainGreedy.met?`takes ${P.plainGreedy.moves} moves`:'breaks it'}.`;
  }

  // ---------- preview (arming) ----------
  function clearMarks(){board.querySelectorAll('.pre,.res').forEach(el=>el.classList.remove('pre','res'));document.querySelectorAll('.aa-swatch').forEach(b=>{b.classList.remove('previewing','warn');b.setAttribute('aria-pressed','false');});}
  function setArmed(next){
    armed=next;clearMarks();
    document.querySelectorAll('.aa-swatch').forEach(b=>b.classList.toggle('hint',hinted!=null&&hinted.colour===Number(b.dataset.colour)));
    const commit=$('aaCommit'),clear=$('aaClear');
    commit.disabled=!armed||finished||locked;clear.disabled=!armed;
    if(!armed){commit.textContent='Apply';return;}
    const c=armed.colour,r=A.preview(P,st,c),b=document.querySelector(`[data-swatch="${elName(c)}"]`),why=A.breakReason(P,st,c);
    if(b){b.classList.add('previewing');b.setAttribute('aria-pressed','true');if(why)b.classList.add('warn');}
    for(const i of r.absorbed)board.querySelector(`[data-cell="${i}"]`).classList.add('pre');
    for(const i of r.resonance)board.querySelector(`[data-cell="${i}"]`).classList.add('res');
    commit.textContent=`${why?'⚠ ':''}Apply ${cap(c)} (+${r.absorbed.length+r.resonance.length})`;
    const msg=`${cap(c)} would absorb ${r.absorbed.length} cell${r.absorbed.length===1?'':'s'}${r.resonance.length?` + ${r.resonance.length} by resonance`:''}.`;
    if(!armed.quiet)shell.status(why?`⚠ ${why}. ${msg} Tap again to apply anyway.`:`${msg} Tap again to apply.`,why?'warn':'');
  }
  function arm(c,quiet){
    if(finished||locked)return;
    if(armed&&armed.colour===c&&!quiet)return commit();
    const r=A.preview(P,st,c);
    if(!r.ok){setArmed(null);shell.status(r.reason,'warn');shell.flash(document.querySelector(`[data-swatch="${elName(c)}"]`),'mg-shake');return;}
    setArmed({colour:c,quiet:!!quiet});
  }

  // ---------- commit ----------
  function play(c,why){ // applies c; returns the apply result
    const before=A.attuned(P,st),r=A.apply(P,st,c);if(!r.ok)return r;
    shell.begin();shell.log('move',{colour:elName(c),sample:idx,...(why?{auto:why}:{})});
    const was=obj;history.push(st);st=r.state;hinted=null;
    render({before});
    shell.flash(document.querySelector(`[data-swatch="${elName(c)}"]`));
    r.was=was;return r;
  }
  function commit(){
    if(!armed||finished||locked)return;
    const c=armed.colour,why=A.breakReason(P,st,c),r=play(c);
    if(!r.ok){shell.status(r.reason,'warn');return;}
    const parts=[`${cap(c)}: +${r.absorbed.length} cell${r.absorbed.length===1?'':'s'}`];
    if(r.resonance.length)parts.push(`+${r.resonance.length} by resonance`);
    let tone='';
    if(why){parts.push(why);tone='warn';}
    else if(!r.done&&obj.state==='over'&&r.was.state==='par'){parts.push(`par is out of reach now: the best finish is ${obj.best} moves`);tone='warn';}
    shell.status(parts.join(' · ')+'.',tone);
    if(r.done)return completeSample();
    if(st.moves.length===P.limit+1)shell.status(`Past the move limit of ${P.limit}: you can still clean the sample, but the buff will only weaken.`,'warn');
    runForced();
  }
  // Relaxed: while exactly one reagent keeps the objective possible (and it does not close the sample), apply it
  function runForced(){
    if(level!=='relaxed'||finished||locked)return;
    for(let guard=0;guard<40&&!A.done(P,st);guard++){
      if(A.objectiveStatus(P,st).state==='lost')return;
      const safe=P.palette.filter(c=>A.apply(P,st,c).ok&&!A.breaks(P,st,c));
      if(safe.length!==1||A.apply(P,st,safe[0]).done)return;
      levelUsed='relaxed';autoMoves++;play(safe[0],'relaxed');
      shell.status(`Relaxed: ${cap(safe[0])} was the only reagent that keeps “${A.objectiveText(P.objective)}” possible, so it was applied for you.`);
    }
  }
  function completeSample(){
    locked=true;setArmed(null);
    const res=A.sampleResult(P,st);res.state=st;res.hints=hints;results.push(res);
    render();
    const buff=R.buffs[P.buff].name,found=res.weakness!=null?` Weakness found: ${cap(res.weakness)}.`:'';
    const what=res.outcome==='removed'?`${buff} removed${res.atPar?' at par':''}.${found}`:`${buff} only weakened: ${res.met?`clean in ${res.moves}, past the limit of ${P.limit}`:`“${res.objective}” was broken`}.`;
    if(idx<R.samples.length-1){
      shell.status(`Sample ${idx+1} clean in ${res.moves} moves (par ${P.par}). ${what} Next sample when ready.`,res.outcome==='removed'?'good':'warn');
      $('aaCommit').hidden=true;$('aaClear').hidden=true;$('aaNext').hidden=false;$('aaNext').focus();
      shell.undoEnabled(false);
    }else finishRound();
  }
  function delivery(){const found=results.find(r=>r.weakness!=null);return {kind:'research',boss:R.boss.name,removed:results.filter(r=>r.outcome==='removed').map(r=>R.buffs[r.buff].name),weakened:results.filter(r=>r.outcome==='weakened').map(r=>R.buffs[r.buff].name),weakness:found?A.ELEMENTS[found.weakness]:null};}
  function finishRound(){
    finished=true;shell.undoEnabled(false);
    const tier=A.roundTier(results,{hints,assist:levelUsed}),n=results.length,removed=results.filter(r=>r.outcome==='removed').length,relaxed=levelUsed==='relaxed';
    const found=results.find(r=>r.weakness!=null);
    const head=`${relaxed?'Solved · Relaxed. ':''}${removed} of ${n} buff${n===1?'':'s'} stripped from ${R.boss.name}${found?`; its weakness is ${cap(found.weakness)}`:''}.`;
    const result={tier,score:removed,headline:head,nearMiss:roundNearMiss(tier,relaxed),output:A.roundOutput(R,results),stats:roundStats(),delivery:delivery()};
    const go=()=>shell.finish(result);
    if(reduced())go();else setTimeout(go,650);
  }
  function roundNearMiss(tier,relaxed){
    const miss=results.findIndex(r=>!r.atPar);
    if(miss>=0)return `Sample ${miss+1}: ${A.nearMiss(R.samples[miss],results[miss].state)}`;
    if(tier==='perfect')return `Nothing left on the table: every sample at par under its objective.`;
    if(relaxed)return 'Every sample at par: at Puzzle or Guided level this was Perfect.';
    return `Every sample at par, but ${hints} hint${hints===1?'':'s'} used: without hints this was Perfect.`;
  }
  function roundStats(){
    return {Samples:results.map((r,k)=>`${r.moves}/${R.samples[k].par}${r.outcome==='removed'?'':' ✕'}`).join(' · ')+' (moves/par)',
      'Buffs removed':`${results.filter(r=>r.outcome==='removed').length} / ${results.length}`,Hints:String(hints),Undos:String(undos),
      'Assist level':levelOf(levelUsed).label+(autoMoves?` (${autoMoves} auto)`:''),'Careful greedy':R.samples.map(S=>S.greedy.met?String(S.greedy.moves):'fails').join(' · ')};
  }
  function loadSample(k){
    idx=k;P=R.samples[k];st=A.initial(P);history=[];armed=null;hinted=null;locked=false;focusCell=P.origin;
    $('aaCommit').hidden=false;$('aaClear').hidden=false;$('aaNext').hidden=true;
    $('aaMotif').textContent=`“${P.motif}” · ${A.FOLDS[P.symmetry].name}`;board.setAttribute('aria-label',`Sample ${k+1}: ${P.motif}`);
    render();renderStakes();
    const o=P.objective;
    shell.status(`Sample ${k+1}: ${A.objectiveText(o)}.${o.end!=null?` Hold ${cap(o.end)} back: it has to close the reaction.`:''} The reaction starts at the ringed core.`);
    runForced();
  }

  // ---------- kit callbacks ----------
  function onNew({seed,difficulty}){
    R=A.generate(seed,difficulty);results=[];hints=0;undos=0;autoMoves=0;finished=false;levelUsed=level;
    loadSample(0);
  }
  function onAuto(){
    if(!locked){const a=A.auto(P);history=[];st=a.state;const r=A.sampleResult(P,st,{auto:true});r.state=st;results.push(r);}
    for(let k=results.length;k<R.samples.length;k++){const S=R.samples[k],a=A.auto(S),r=A.sampleResult(S,a.state,{auto:true});r.state=a.state;results.push(r);}
    idx=R.samples.length-1;P=R.samples[idx];st=results[idx].state; // review shows the last sample as the fallback left it
    finished=true;locked=true;render();shell.undoEnabled(false);
    const skipped=results.filter(r=>r.auto).length;
    return {score:results.filter(r=>r.outcome==='removed').length,
      headline:`Skipped: the fallback cleaned ${skipped} sample${skipped===1?'':'s'} greedily, ignoring the objective, so ${skipped===1?'its buff is':'their buffs are'} only weakened.`,
      nearMiss:'A clean sample that meets its objective removes the buff instead of weakening it, and a clean End-on sample reveals the weakness.',
      output:A.roundOutput(R,results)+' (fallback)',stats:roundStats(),delivery:delivery()};
  }
  function onUndo(){
    if(finished||locked||!history.length)return;
    st=history.pop();undos++;hinted=null;render();
    shell.status(`Undone. ${st.moves.length} move${st.moves.length===1?'':'s'} played on this sample.`);
  }
  function onHint(){
    if(finished||locked)return;
    const h=A.hint(P,st);if(!h)return;hints++;
    hinted={colour:h.colour};armed=null;arm(h.colour,true);
    shell.status(`Hint: ${h.text} Tap ${cap(h.colour)} again to apply.`);
  }

  // ---------- input ----------
  $('aaRack').addEventListener('click',e=>{const b=e.target.closest('[data-swatch]');if(b)arm(Number(b.dataset.colour));});
  $('aaCommit').onclick=()=>{if(armed)armed.quiet=false;commit();};
  $('aaClear').onclick=()=>{setArmed(null);shell.status('');};
  $('aaNext').onclick=()=>{if(locked&&!finished&&idx<R.samples.length-1)loadSample(idx+1);};
  board.addEventListener('click',e=>{
    const b=e.target.closest('[data-cell]');if(!b||finished||locked)return;const i=Number(b.dataset.cell),v=P.cells[i];focusCell=i;
    if(v<0){setArmed(null);shell.status('A null-scar: it never reacts and does not count.');return;}
    if(A.attuned(P,st)[i]){setArmed(null);shell.status('Already reacted.');return;}
    if(!P.palette.includes(v)){setArmed(null);shell.status(`${cap(v)} is not on the rack: this inert pocket joins by resonance once every open cell around it has reacted.`);shell.flash(b,'mg-shake');return;}
    arm(v);
  });
  board.addEventListener('keydown',e=>{
    const s=P.size,d={ArrowLeft:-1,ArrowRight:1,ArrowUp:-s,ArrowDown:s}[e.key];if(d==null)return;
    const i=focusCell,x=i%s,j=i+d;if(j<0||j>=s*s||(d===-1&&x===0)||(d===1&&x===s-1))return;
    e.preventDefault();focusCell=j;board.querySelectorAll('[data-cell]').forEach(c=>c.tabIndex=-1);const t=board.querySelector(`[data-cell="${j}"]`);t.tabIndex=0;t.focus();
  });
  document.addEventListener('keydown',e=>{
    if(!P||finished||locked||e.target.closest('input,select,textarea')||!document.getElementById('mgResult').hidden)return;
    const k=Number(e.key);
    if(k>=1&&k<=P.palette.length){e.preventDefault();arm(P.palette[k-1]);}
    else if((e.key==='z'||e.key==='Z')&&(e.metaKey||e.ctrlKey)){e.preventDefault();document.getElementById('mgUndo').click();}
  });

  shell.start();
})();
