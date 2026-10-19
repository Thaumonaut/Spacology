// Signal breach UI (Research, day): an intercepted Null transmission whose daemons are fragments of a blueprint for
// logistics. The code matrix with its active line and route trail, the buffer, the daemon list with progress
// pips and (once a pair is under way) the codes two daemons share, a "chained" pop when an upload reuses codes from
// another, tap-to-preview then Upload, Disconnect, hint and undo. All rules live in signal-decoding-model.js; this file
// only renders a state and sends actions to it.
(function(){
  'use strict';
  const K=window.MiniGameKit,M=window.SignalDecoding,esc=K.esc;
  const still=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let pz=null,st=null,sel=null,hinted=null,flags=null,pending=null,shownPicks=0,resize=null,links=[],begun=new Set();

  const shell=K.shell({
    id:'signal-decoding',
    rules:[
      'The matrix is an intercepted <b>Null transmission</b>. Each <b>daemon</b> is one fragment of a <b>blueprint</b>: upload it by making its code sequence appear, in order and unbroken, in the <b>buffer</b>.',
      'Your <b>first pick</b> comes from the <b>top row</b>. Then alternate: a pick from the <b>column</b> of your last pick, then from the <b>row</b> of that one, and so on. Each cell works once.',
      'The buffer is too short for the daemons back to back, but they <b>share codes</b>: where one daemon ends the way another begins, the shared codes count for both. Chain them to fit.',
      '<b>Tap a cell</b> to preview it, then tap it again or press <b>Upload</b>. The breach ends when the buffer is full, every daemon is in, or you <b>Disconnect</b>.',
      'Every daemon can always be uploaded. <b>Perfect</b> = all of them without a hint: the blueprint, <b>improved</b>. <b>Good</b> = all but one (research rebuilds the gap): the complete blueprint. <b>Partial</b> = some fragments, which carry over toward it.',
      'Logistics builds or crafts every completed blueprint.'
    ],
    difficulties:M.DIFFICULTIES.map(d=>({id:d.id,label:d.label,target:d.target})),
    defaultDifficulty:'easy',onNew,onAuto,onUndo,onHint
  });
  shell.side(`<div class="sb-legend"><p class="sb-tip">Daemons share codes — overlap them to fit the buffer.</p><p class="eyebrow">READING THE MATRIX</p>
<p><span class="sb-key sb-key-live">55</span> active line: pick from here</p>
<p><span class="sb-key sb-key-next">55</span> the line your preview opens next</p>
<p><span class="sb-key sb-key-used">55<i>1</i></span> already in the buffer, with its order</p>
<p class="eyebrow">THE BLUEPRINT</p><p>Each daemon you upload recovers one fragment. Every fragment (Perfect: improved) or all but one (Good) completes the blueprint, and logistics builds it. Fragments from a partial breach carry over toward the same blueprint.</p></div>`);
  const $=id=>document.getElementById(id);

  function onNew({seed,difficulty}){
    clearTimeout(pending);pending=null;shell.controls({auto:true,hint:true});
    pz=M.generate(seed,difficulty);st=M.create();sel=null;hinted=null;shownPicks=0;flags={hints:0,undos:0,misfires:0};
    // Every tail-to-head overlap between two daemons; each is revealed once either daemon of the pair is under way.
    begun=new Set();links=[];pz.daemons.forEach((a,i)=>pz.daemons.forEach((b,j)=>{const k=i===j?0:M.overlap(a.seq,b.seq);if(k)links.push({from:i,to:j,k});}));
    const n=pz.size,cols=Array.from({length:n},(_,c)=>`<span>${c+1}</span>`).join('');
    shell.stage.innerHTML=`<div class="sb-term">
<p class="sb-blueprint">Null transmission: <b>${esc(pz.blueprint.name)}</b> blueprint · ${pz.daemons.length} fragments</p>
<div class="sb-top"><span>BREACH PROTOCOL · NODE 0x${(seed*2654435761>>>0).toString(16).toUpperCase().padStart(8,'0').slice(0,4)}</span><span id="sbLine" class="sb-line"></span></div>
<div class="sb-body">
  <div class="sb-matrix-wrap" style="--n:${n}">
    <div class="sb-axis sb-axis-cols" aria-hidden="true">${cols}</div>
    <div class="sb-axis sb-axis-rows" aria-hidden="true">${cols}</div>
    <div class="sb-matrix" id="sbMatrix" role="grid" aria-label="Code matrix, ${n} by ${n}. Arrow keys move between cells.">
      ${pz.grid.map((code,c)=>`<button class="sb-cell" data-cell="${c}" data-code="${code}" aria-label="${code}, row ${Math.floor(c/n)+1}, column ${c%n+1}"><b>${code}</b><i></i></button>`).join('')}
      <svg class="sb-trail" id="sbTrail" aria-hidden="true"></svg>
    </div>
  </div>
  <div class="sb-panel">
    <p class="sb-label">BUFFER <b id="sbChain" class="sb-chainpop" aria-hidden="true"></b><span id="sbSlots"></span></p>
    <div id="sbBuffer" class="sb-buffer" aria-live="polite">${Array.from({length:pz.buffer},(_,i)=>`<span class="sb-slot" data-slot="${i}"></span>`).join('')}</div>
    <p class="sb-label">DAEMONS · FRAGMENTS <span>back to back: ${pz.naive} codes</span></p>
    <ul id="sbDaemons" class="sb-daemons">${pz.daemons.map((d,j)=>`<li class="sb-daemon" data-daemon="${j}">
      <div class="sb-dhead"><b>${esc(d.name)}</b><span class="sb-len">${d.seq.length} codes</span></div>
      <div class="sb-seq">${d.seq.map(c=>`<span class="sb-chip">${c}</span>`).join('')}<em class="sb-state"></em></div>
      <p class="sb-topic">${esc(d.topic)}</p><p class="sb-link"></p></li>`).join('')}</ul>
    <div class="sb-actions"><button id="sbUpload" class="primary">Upload</button><button id="sbDisconnect">Disconnect</button></div>
  </div>
</div></div>`;
    const grid=$('sbMatrix');
    grid.addEventListener('click',e=>{const b=e.target.closest('.sb-cell');if(b)tap(+b.dataset.cell);});
    grid.addEventListener('keydown',navigate);
    $('sbUpload').onclick=()=>{if(sel!==null)commit(sel);};
    $('sbDisconnect').onclick=disconnect;
    resize?.disconnect();if(window.ResizeObserver){resize=new ResizeObserver(drawTrail);resize.observe(grid);}
    shell.status(`Start in the top row. ${pz.daemons.length} daemons, the fragments of the ${pz.blueprint.name} blueprint, need ${pz.naive} codes back to back; the buffer holds ${pz.buffer}. Overlap them.`);
    render();
  }

  const playing=()=>!shell.ended&&!pending&&M.status(pz,st)==='playing';
  const where=c=>M.where(pz,c);

  function tap(cell){
    if(!playing())return;
    shell.begin();
    const err=M.validate(pz,st,{type:'pick',cell});
    if(err){flags.misfires++;shell.log('misfire',{cell});shell.flash(cellEl(cell),'mg-shake');shell.status(err,'warn');return;}
    if(sel===cell)return commit(cell);
    sel=cell;render();
    const p=M.preview(pz,st,cell),bits=[];
    p.newly.forEach(j=>bits.push(`uploads ${pz.daemons[j].name}`));
    p.advanced.forEach((a,j)=>{if(a&&!p.newly.includes(j))bits.push(`${pz.daemons[j].name} ${p.progress[j]}/${pz.daemons[j].seq.length}`);});
    shell.status(`Preview ${pz.grid[cell]}: ${bits.length?bits.join(', '):'advances no daemon'}. Tap again or press Upload.`,p.newly.length?'good':'');
  }

  function commit(cell){
    if(!playing())return;
    shell.begin();
    const before=M.evaluate(pz,st.picks),res=M.act(pz,st,{type:'pick',cell});
    if(res.error){shell.flash(cellEl(cell),'mg-shake');shell.status(res.error,'warn');return;}
    st=res.state;sel=null;hinted=null;shell.log('pick',{cell});
    const after=M.evaluate(pz,st.picks),newly=after.uploaded.filter(j=>!before.uploaded.includes(j));
    const had=new Set(before.chains.map(c=>c.from+'>'+c.to)),fresh=after.chains.filter(c=>!had.has(c.from+'>'+c.to));
    render();
    shell.flash(cellEl(cell));
    newly.forEach(j=>shell.flash(shell.stage.querySelector(`[data-daemon="${j}"]`)));
    // The chained moment: the shared slots pop and a badge names how many codes did double duty.
    fresh.forEach(c=>{for(let i=c.start;i<c.end;i++)shell.flash(shell.stage.querySelector(`[data-slot="${i}"]`),'sb-chained-pop');});
    if(fresh.length){const k=fresh.reduce((n,c)=>n+c.end-c.start,0);$('sbChain').textContent=`CHAINED ×${k}`;shell.flash($('sbChain'),'sb-chain-show');}
    const s=M.status(pz,st);
    const chainLine=fresh.map(c=>`${after.buffer.slice(c.start,c.end).join(' ')} finished ${pz.daemons[c.from].name} while starting ${pz.daemons[c.to].name}`).join('; ');
    if(newly.length)shell.status(`${newly.map(j=>pz.daemons[j].name).join(' and ')} uploaded: ${newly.length===1?'fragment':'fragments'} recovered.${chainLine?` Chained: ${chainLine}.`:''}${s==='playing'?' Keep going or Disconnect.':''}`,'good');
    else if(s==='playing')shell.status(`${pz.grid[cell]} in. Next pick from ${M.activeLine(pz,st).kind==='col'?'column':'row'} ${M.activeLine(pz,st).index+1}.`);
    if(s!=='playing'){
      shell.status(s==='complete'?`Every daemon uploaded. Full breach: the ${pz.blueprint.name} blueprint is whole.${chainLine?` Chained: ${chainLine}.`:''}`:s==='full'?'Buffer full. Breach closing.':'No free cell left in the active line. Breach closing.',s==='complete'?'good':'');
      end();
    }
  }

  function disconnect(){
    if(!playing())return;
    shell.begin();const r=M.act(pz,st,{type:'disconnect'});if(r.error)return;
    st=r.state;sel=null;hinted=null;shell.log('disconnect');render();shell.status('Disconnected.');end();
  }

  // A short pause lets the last buffer slot and daemon pop land before the result card covers the board.
  function end(){
    shell.controls({auto:false,hint:false,undo:false});render();
    pending=setTimeout(()=>{pending=null;shell.controls({auto:true,hint:true});const g=M.grade(pz,st,flags);
      shell.finish({...g,stats:{...g.stats,Undos:`${flags.undos}`}});render();},still()?120:700);
  }

  function onAuto(){
    clearTimeout(pending);pending=null;
    const a=M.auto(pz);st=a.state;sel=null;hinted=null;render();
    return a;
  }
  function onUndo(){
    if(pending||!st.picks.length)return;
    flags.undos++;st=M.undo(pz,st);sel=null;hinted=null;render();
    shell.status('Last pick withdrawn.');
  }
  function onHint(){
    if(!playing())return;
    const h=M.hint(pz,st);flags.hints++;
    if(!h||h.disconnect){shell.status('No remaining pick recovers another fragment. Disconnect to bank what you have.','warn');shell.flash($('sbDisconnect'));return;}
    sel=h.cell;hinted=h.cell;render();
    shell.status(`Hint: ${pz.grid[h.cell]} at ${where(h.cell)}. The best route from here still recovers ${h.value} of ${pz.daemons.length} fragments. A hint caps the result at Good.`);
    cellEl(h.cell)?.focus();
  }

  function navigate(e){
    const d={ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0]}[e.key];if(!d)return;
    const cur=document.activeElement?.closest?.('.sb-cell');const n=pz.size;let c=cur?+cur.dataset.cell:0;
    const r=(Math.floor(c/n)+d[0]+n)%n,cc=(c%n+d[1]+n)%n;cellEl(r*n+cc)?.focus();e.preventDefault();
  }
  const cellEl=c=>shell.stage.querySelector(`[data-cell="${c}"]`);

  // Route trail: a line through every pick in order, then a dashed leg to the previewed cell.
  function drawTrail(){
    const svg=$('sbTrail'),grid=$('sbMatrix');if(!svg||!grid)return;
    const w=grid.clientWidth,h=grid.clientHeight;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const pt=c=>{const b=cellEl(c);return [b.offsetLeft+b.offsetWidth/2,b.offsetTop+b.offsetHeight/2];};
    const pts=st.picks.map(pt),out=[];
    if(pts.length>1)out.push(`<polyline class="sb-path" points="${pts.map(p=>p.join(',')).join(' ')}"/>`);
    if(sel!==null){const q=pt(sel),from=pts.at(-1);if(from)out.push(`<line class="sb-path sb-ghost" x1="${from[0]}" y1="${from[1]}" x2="${q[0]}" y2="${q[1]}"/>`);}
    pts.forEach((p,i)=>out.push(`<circle class="sb-node${i===pts.length-1?' sb-head':''}" cx="${p[0]}" cy="${p[1]}" r="${i===pts.length-1?5:3.5}"/>`));
    svg.innerHTML=out.join('');
  }

  function render(){
    if(!pz)return;
    const live=playing(),line=M.activeLine(pz,st),lineSet=new Set(live?M.lineCells(pz,line):[]),order=new Map(st.picks.map((c,i)=>[c,i+1]));
    const nextLine=sel!==null?new Set(M.lineCells(pz,M.activeLine(pz,{picks:[...st.picks,sel]}))):new Set();
    const e=M.evaluate(pz,st.picks),pv=sel!==null?M.preview(pz,st,sel):null;
    // A daemon counts as begun, for revealing its shared codes, once it is uploaded or its first two codes (one for a
    // two-code daemon) are live in the buffer; a single matching code is too weak a signal. It stays begun.
    pz.daemons.forEach((d,j)=>{if(e.uploaded.includes(j)||e.progress[j]>=Math.min(2,d.seq.length-1))begun.add(j);});
    shell.stage.querySelectorAll('.sb-cell').forEach(b=>{
      const c=+b.dataset.cell,used=order.has(c),inLine=lineSet.has(c)&&!used;
      b.classList.toggle('live',inLine);b.classList.toggle('used',used);b.classList.toggle('sel',sel===c);b.classList.toggle('hint',hinted===c);
      b.classList.toggle('next',sel!==null&&nextLine.has(c)&&!used&&c!==sel);b.classList.toggle('dim',!inLine&&!used);
      b.querySelector('i').textContent=used?order.get(c):'';
      b.setAttribute('aria-pressed',sel===c?'true':'false');
      b.setAttribute('aria-label',`${pz.grid[c]}, row ${Math.floor(c/pz.size)+1}, column ${c%pz.size+1}${used?`, pick ${order.get(c)}`:inLine?', available':''}`);
    });
    // Buffer: committed codes, the previewed one in gold, empty slots after.
    const shared=new Set();e.chains.forEach(c=>{for(let i=c.start;i<c.end;i++)shared.add(i);});
    shell.stage.querySelectorAll('.sb-slot').forEach((s,i)=>{
      const code=i<e.buffer.length?e.buffer[i]:pv&&i===e.buffer.length?pz.grid[sel]:'';
      s.classList.toggle('shared',shared.has(i));
      const fresh=i<e.buffer.length&&i>=shownPicks&&!still();
      s.textContent=code;s.classList.toggle('full',i<e.buffer.length);s.classList.toggle('ghost',!!pv&&i===e.buffer.length);
      if(fresh){s.classList.remove('sb-type');void s.offsetWidth;s.classList.add('sb-type');}
    });
    shownPicks=e.buffer.length;
    $('sbSlots').textContent=`${st.picks.length}/${pz.buffer}`;
    const left=pz.buffer-st.picks.length,over=!live;
    shell.stage.querySelectorAll('.sb-daemon').forEach(li=>{
      const j=+li.dataset.daemon,d=pz.daemons[j],up=e.uploaded.includes(j),prog=e.progress[j],pprog=pv?pv.progress[j]:prog,soon=pv&&pv.newly.includes(j);
      const noRoom=!up&&(over||d.seq.length-prog>left);
      li.classList.toggle('up',up);li.classList.toggle('soon',!!soon);li.classList.toggle('out',noRoom);
      // Shared codes: shown for a pair only once one of its two daemons has been started or uploaded.
      const shown=links.filter(l=>(l.from===j||l.to===j)&&(begun.has(l.from)||begun.has(l.to)));
      const linked=new Set();shown.forEach(l=>{for(let k=0;k<l.k;k++)linked.add(l.from===j?d.seq.length-l.k+k:k);});
      li.querySelectorAll('.sb-chip').forEach((ch,k)=>{ch.classList.toggle('on',k<prog);ch.classList.toggle('pv',!up&&k>=prog&&k<pprog&&pprog>prog);ch.classList.toggle('link',linked.has(k));});
      li.querySelector('.sb-link').textContent=shown.map(l=>l.from===j?`ends as ${pz.daemons[l.to].name} starts`:`starts as ${pz.daemons[l.from].name} ends`).join(' · ');
      li.querySelector('.sb-state').textContent=up?'UPLOADED':soon?'UPLOAD ▸':noRoom?(over?'NOT UPLOADED':'NO ROOM'):'';
    });
    $('sbLine').textContent=live?(st.picks.length===0?'PICK FROM ROW 1':`PICK FROM ${line.kind==='row'?'ROW':'COLUMN'} ${line.index+1}`):'BREACH CLOSED';
    $('sbLine').className='sb-line'+(live?' sb-line-'+line.kind:'');
    $('sbUpload').disabled=!live||sel===null;$('sbDisconnect').disabled=!live;
    shell.undoEnabled(live&&st.picks.length>0);
    shell.meters([
      {label:'Buffer',value:`${st.picks.length}/${pz.buffer}`,tone:left<=1&&live?'warn':''},
      {label:'Daemons',value:`${e.uploaded.length}/${pz.daemons.length}`,tone:e.uploaded.length>=pz.daemons.length?'good':e.uploaded.length?'warn':''},
      {label:'Chained',value:`${e.chains.length}`}
    ]);
    drawTrail();
  }

  shell.start();
})();
