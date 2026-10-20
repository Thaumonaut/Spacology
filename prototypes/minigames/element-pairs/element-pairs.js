(function(){
  'use strict';
  const K=window.MiniGameKit,M=window.ElementPairs;
  const title=id=>id[0].toUpperCase()+id.slice(1),$=id=>document.getElementById(id);
  let puzzle,state,history=[],selected=null,hinted=[],lastPair=[],lastShift=[],hints=0,undos=0,assisted=true;
  const shell=K.shell({
    id:'element-pairs',timed:false,auto:false,
    difficulties:[{id:'standard',label:'Four reserves'}],
    rules:[
      'Clear every element from the board. <b>No timer.</b> You can finish with reserves unused.',
      'Pair <b>identical or opposing</b> elements: Order / Chaos, Growth / Decay, Energy / Void.',
      'Pair along a <b>row, column or 45° diagonal</b>. Horizontal lines also <b>wrap in reading order</b> from one row to the next, forwards or backwards. Every cell between the pair must be empty.',
      'Any intervening element blocks, even a compatible one. <b>Completely cleared rows disappear; rows below move up.</b> Gaps within a partly filled row stay put. No individual-tile gravity or reshuffling.',
      'An <b>8-column, 24-row board</b> shows eight rows at a time. Start with <b>4½ rows (36 elements)</b>. The opening needs reserve elements to finish. Four batches add <b>36 elements each, immediately after the last remaining element</b>. They do not fill internal gaps. Deal whenever you want more options—even while matches remain.',
      'Select a tile to see <b>clear sightlines</b>. Bright partners with a <b>+</b> can match; outlined tiles are visible but incompatible. Arrows locate matches outside the board window.',
      'Undo restores a removal or deal. Hints identify one legal pair, not a guaranteed winning move.'
    ],
    onNew:fresh,onUndo:undo,onHint:hint
  });
  document.body.classList.add('element-pairs');
  $('mgDifficulty').closest('label').hidden=true;
  document.querySelector('.mg-head .mg-role').textContent='Research trial';
  document.querySelector('.mg-side .eyebrow').textContent='THE MATCHING RULE';

  function fresh({seed}){
    puzzle=M.generate(seed);state=M.start(puzzle);history=[];selected=null;hinted=[];lastPair=[];lastShift=[];hints=0;undos=0;
    shell.log('layout',{version:puzzle.version});
    const undoButton=$('mgUndo'),hintButton=$('mgHint');
    shell.stage.innerHTML=`<section class="ep-instrument" aria-label="Element matching trial">
      <div class="ep-heading"><div><p class="eyebrow">RESEARCH / BENCH TRIAL 01</p><h2>Find the clear line.</h2></div><span class="ep-direction" aria-hidden="true">↖ ↑ ↗<br>← · →<br>↙ ↓ ↘</span></div>
      <p class="ep-instruction">Same or opposite. Nothing in between.</p>
      <div class="ep-sight" id="epSight" role="status">Select an element to light its sightlines.</div>
      <div class="ep-window"><span id="epWindow">Rows 1–8 of 24</span><span>8 columns · scroll to explore</span></div>
      <div class="ep-jumps"><button id="epAbove" hidden></button><button id="epBelow" hidden></button><button id="epLeft" hidden></button><button id="epRight" hidden></button></div>
      <div class="ep-scroll" id="epScroll" tabindex="0" aria-label="Scrollable element board">
        <div class="ep-grid" id="epGrid" role="group" aria-label="Eight-column, 24-row matching board"></div>
      </div>
      <p class="ep-deal-note" id="epDealNote"></p>
      <div class="ep-actions" id="epActions"><button id="epDeal" class="primary">Deal batch <span>4 left</span></button></div>
      <div class="ep-reserves" id="epReserves" aria-label="Reserve batches"></div>
      <section class="ep-end" id="epEnd" hidden aria-labelledby="epEndTitle"><h3 id="epEndTitle">No moves. No reserves.</h3><p>You can undo a move or a deal, retry this board, or finish this attempt.</p><button id="epFinish">Finish attempt</button></section>
      <div class="ep-bottom"><span>Clear a whole row to move the rows below up.</span><button id="epRetry" class="mg-quiet">Retry seed</button></div>
    </section>`;
    $('epActions').prepend(undoButton,hintButton);
    shell.side(`<div class="ep-legend">${M.FAMILIES.map(pair=>`<div>${pair.map(id=>`<span class="ep-key ep-${id}"><i aria-hidden="true">${M.GLYPHS[id]}</i>${title(id)}</span>`).join('<span class="ep-versus" aria-hidden="true">↔</span>')}</div>`).join('')}</div><label class="ep-assist"><input id="epAssist" type="checkbox" ${assisted?'checked':''}> Show selected sightlines</label><p class="ep-note">The full puzzle has a verified clearing route, not an independently solvable opening. Your choices can leave a dead end. Hints and highlights have no penalty.</p>`);
    $('epAssist').onchange=e=>{assisted=e.target.checked;paint();};
    $('epGrid').onclick=e=>{const b=e.target.closest('[data-cell]');if(b)pick(Number(b.dataset.cell));};
    $('epGrid').onkeydown=key;
    $('epScroll').onscroll=updateJumps;
    $('epAbove').onclick=()=>jump(-1);
    $('epBelow').onclick=()=>jump(1);
    $('epLeft').onclick=()=>jump(-2);
    $('epRight').onclick=()=>jump(2);
    $('epDeal').onclick=deal;
    $('epFinish').onclick=()=>finish(false);
    $('epRetry').onclick=()=>{if(!state.moves||window.confirm('Retry this seed? Your current board will be reset.'))shell.start();};
    paint();shell.status('Clear the board across reserve deals. Deal whenever you need more options.');
  }
  function paint(focus){
    const mode=M.status(state),left=M.remaining(state),legal=M.pairs(state),lines=assisted?M.sightlines(state,selected):[],partners=lines.filter(line=>line.ok).map(line=>line.target),visible=lines.map(line=>line.target),rays=new Set(lines.flatMap(line=>line.path));
    const path=lastPair.length?M.inspect({...state,cells:state.cells.map((v,i)=>lastPair.includes(i)?'order':v)},...lastPair).path||[]:[],shifts=new Map(lastShift.map(({from,to})=>[to,(from-to)/state.cols]));
    const first=state.cells.findLastIndex(v=>v!==null)+1,preview=!shell.ended&&mode!=='won'&&state.used<M.RESERVES,slots=Math.max(state.cells.length,preview?Math.ceil((first+M.BATCH_SIZE)/state.cols)*state.cols:0);
    $('epGrid').innerHTML=Array.from({length:slots},(_,i)=>{
      const id=state.cells[i]??null,next=preview&&i>=first&&i<first+M.BATCH_SIZE;
      if(id===null)return `<span class="ep-empty ${path.includes(i)?'ep-line':''} ${lastPair.includes(i)?'ep-cleared':''} ${rays.has(i)?'ep-ray':''} ${next?'ep-next':''}" ${next?'data-next="'+i+'"':''} aria-hidden="true">${next&&i===first?'<small>NEXT<br>BATCH</small>':''}</span>`;
      const partner=partners.includes(i),inView=visible.includes(i),description=selected!==null&&assisted&&selected!==i?(partner?' · compatible partner':inView?' · in sight, incompatible':' · outside selected sightlines'):'';
      return `<button class="ep-cell ep-${id} ${shifts.has(i)?'ep-rise':''} ${selected===i?'ep-selected':''} ${hinted.includes(i)?'ep-hinted':''} ${partner?'ep-partner':inView?'ep-visible':selected!==null&&assisted&&selected!==i?'ep-dim':''}" ${shifts.has(i)?`style="--ep-shift:${shifts.get(i)}"`:''} data-cell="${i}" aria-label="${title(id)}, row ${Math.floor(i/state.cols)+1}, column ${i%state.cols+1}${description}" aria-pressed="${selected===i}" ${shell.ended?'disabled':''}><i aria-hidden="true">${M.GLYPHS[id]}</i><small aria-hidden="true">${title(id)}</small></button>`;
    }).join('');
    $('epSight').textContent=selected===null?'Select an element to light its sightlines.':!assisted?'Sightline guidance is off.':`${title(state.cells[selected])}: ${partners.length} matching ${partners.length===1?'partner':'partners'} in sight${lines.some(line=>line.ok&&line.line==='wrap')?' · includes reading-order wrap':''}. + = match; outline = incompatible.`;
    $('epDealNote').textContent=mode==='won'?'Board clear.':preview?`Dashed slots: next batch starts at row ${Math.floor(first/state.cols)+1}, column ${first%state.cols+1}. The board grows and scrolls.`:'All four batches dealt. Clear what remains.';
    $('epGrid').dataset.mode=mode;
    $('epDeal').innerHTML=`Deal batch <span>${M.RESERVES-state.used} left</span>`;
    $('epDeal').disabled=shell.ended||mode==='won'||state.used>=M.RESERVES;
    $('epReserves').innerHTML=Array.from({length:M.RESERVES},(_,i)=>`<span class="ep-batch ${i<state.used?'ep-used':''}"><i aria-hidden="true">${i<state.used?'✓':'▦'}</i>Batch ${i+1}${i<state.used?' · dealt':''}</span>`).join('');
    $('epEnd').hidden=mode!=='lost'||shell.ended;
    shell.meters([{label:'On board',value:left},{label:'Reserves',value:`${M.RESERVES-state.used} / ${M.RESERVES}`},{label:'Legal pairs',value:legal.length,tone:legal.length?'good':'warn'}]);
    shell.controls({undo:history.length>0&&!shell.ended,hint:legal.length>0&&!shell.ended});
    if(focus!==undefined)document.querySelector(`[data-cell="${focus}"]`)?.focus({preventScroll:true});
    updateJumps();
    lastShift=[];
  }
  function offscreen(direction){
    const frame=$('epScroll').getBoundingClientRect();
    return [...document.querySelectorAll('.ep-partner')].filter(tile=>{const rect=tile.getBoundingClientRect();return direction===-1?rect.top<frame.top:direction===1?rect.bottom>frame.bottom:direction===-2?rect.left<frame.left:rect.right>frame.right;});
  }
  function updateJumps(){
    const frame=$('epScroll'),cell=document.querySelector('.ep-cell,.ep-empty');
    if(cell){const stride=cell.getBoundingClientRect().height+parseFloat(getComputedStyle($('epGrid')).rowGap),first=Math.min(M.ROWS-M.VISIBLE_ROWS+1,Math.floor(frame.scrollTop/stride)+1);$('epWindow').textContent=`Rows ${first}–${first+M.VISIBLE_ROWS-1} of ${M.ROWS}`;}
    for(const [id,direction,arrow,label] of [['epAbove',-1,'↑','above'],['epBelow',1,'↓','below'],['epLeft',-2,'←','left'],['epRight',2,'→','right']]){
      const count=offscreen(direction).length,button=$(id);button.hidden=!count;button.textContent=`${arrow} ${count} ${count===1?'match':'matches'} ${label}`;
    }
  }
  function jump(direction){
    const targets=offscreen(direction),target=direction<0?targets.at(-1):targets[0];
    if(target){target.scrollIntoView({block:'center',behavior:'instant'});target.focus({preventScroll:true});updateJumps();}
  }
  function remember(){history.push({...state,cells:state.cells.slice()});}
  function pick(i){
    if(shell.ended)return;
    shell.begin();hinted=[];lastPair=[];lastShift=[];
    if(selected===i){selected=null;paint(i);shell.status('Selection cleared.');return;}
    if(selected===null){selected=i;paint(i);shell.status(`${title(state.cells[i])} selected. Pair it with ${title(state.cells[i])} or ${title(M.OPPOSITE[state.cells[i]])} along a clear line.`);return;}
    const a=selected,result=M.match(state,a,i);
    if(!result.ok){
      selected=i;paint(i);shell.status(`${result.reason} ${title(state.cells[i])} is now selected.`,'warn');
      const b=document.querySelector(`[data-cell="${result.blocker??i}"]`);shell.flash(b,'mg-shake');return;
    }
    remember();state=result.state;selected=null;lastPair=result.shifts.length||result.clearedRows.length?[]:[a,i];lastShift=result.shifts;shell.log('pair',{a,b:i,kind:result.kind,clearedRows:result.clearedRows});paint();
    document.querySelector(`[data-cell="${M.visible(state,i)[0]??state.cells.findIndex(v=>v!==null)}"]`)?.focus({preventScroll:true});
    report(`${result.line==='wrap'?'Wrapped pair cleared.':'Pair cleared.'}${result.clearedRows.length?` ${result.clearedRows.length} ${result.clearedRows.length===1?'row cleared':'rows cleared'}; rows below moved up.`:''}`);
  }
  function deal(){
    if(shell.ended)return;
    const result=M.deal(puzzle,state);if(!result.ok){shell.status(result.reason,'warn');return;}
    shell.begin();remember();state=result.state;selected=null;hinted=[];lastPair=[];lastShift=[];
    shell.log('deal',{batch:state.used,first:result.first});paint();document.querySelector(`[data-cell="${result.first}"]`)?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});report(`Batch ${state.used} dealt. ${M.BATCH_SIZE} elements added after the last remaining element.`);
  }
  function undo(){
    if(!history.length||shell.ended)return;
    state=history.pop();selected=null;hinted=[];lastPair=[];lastShift=[];undos++;paint();report('Last action undone, including any cleared rows.');
  }
  function hint(){
    if(shell.ended)return;
    const pair=M.pairs(state)[0];if(!pair)return;
    hints++;selected=null;lastPair=[];lastShift=[];hinted=pair;paint();document.querySelector(`[data-cell="${pair[0]}"]`)?.scrollIntoView({block:'nearest',behavior:'instant'});
    shell.status(`One legal pair: row ${Math.floor(pair[0]/state.cols)+1}, column ${pair[0]%state.cols+1} to row ${Math.floor(pair[1]/state.cols)+1}, column ${pair[1]%state.cols+1}. It is not necessarily a winning move.`);
  }
  function report(prefix){
    const mode=M.status(state);
    if(mode==='won'){finish(true);return;}
    if(mode==='lost'){shell.status(`${prefix} No legal pairs and no reserve batches. Undo is still available.`,'warn');return;}
    shell.status(mode==='stuck'?`${prefix} No legal pairs remain. Deal a reserve batch or undo.`:prefix,mode==='stuck'?'warn':'good');
  }
  function finish(won){
    shell.controls({undo:false,hint:false});
    shell.finish({tier:won?'good':'failed',score:won?1:0,headline:won?'Board clear. Nicely done.':'No moves left this attempt.',nearMiss:won?'':`${M.remaining(state)} elements remained after all four reserve batches. Retry the same seed to try another route.`,stats:{'Elements left':M.remaining(state),'Rows cleared':state.lines,'Batches used':`${state.used} / ${M.RESERVES}`,Hints:hints,Undos:undos},output:''});
    if(won){$('mgTier').textContent='Board clear';$('mgTierNote').textContent='No timer. No penalties.';}
    paint();
  }
  function key(e){
    const b=e.target.closest('[data-cell]');if(!b)return;
    const i=Number(b.dataset.cell),directions={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};
    if(e.key==='Escape'){selected=null;hinted=[];lastPair=[];lastShift=[];paint(i);shell.status('Selection cleared.');return;}
    if(!directions[e.key])return;e.preventDefault();
    const [dr,dc]=directions[e.key];
    for(let r=Math.floor(i/state.cols)+dr,c=i%state.cols+dc;r>=0&&r<state.cells.length/state.cols&&c>=0&&c<state.cols;r+=dr,c+=dc){
      const next=r*state.cols+c;if(state.cells[next]!==null){document.querySelector(`[data-cell="${next}"]`)?.focus();break;}
    }
  }
  shell.start();
  window.addEventListener('resize',updateJumps);
})();
