// Signal breach rules (after Cyberpunk 2077's Breach Protocol). Pure and deterministic from seed + difficulty.
// Every puzzle can upload every daemon: generation builds a planted superstring in which each daemon starts inside
// the previous one's tail, plants it on a legal row/column route, and sizes the buffer to the overlapped chain (plus
// 0-1 spare) but below the daemons laid back to back, so finding the shared codes is the puzzle. Also: legal picks,
// uploads and chains, an exact DFS solver, hints, grading, the near-miss line and the automatic fallback.
// Fiction: the matrix is an intercepted Null transmission, each daemon one fragment of a blueprint, and the breach's
// output is that blueprint for logistics to build (improved on Perfect, complete on Good, fragments on Partial).
// Loads as a classic script (window.SignalDecoding) or with require().
(function(root,factory){
  const kit=typeof module==='object'&&module.exports?require('../../shared/minigames/minigame-kit.js'):root.MiniGameKit;
  const api=factory(kit);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.SignalDecoding=api;
})(typeof globalThis==='object'?globalThis:this,function(K){
  'use strict';
  const CODES=['1C','55','BD','E9','7A','FF'];
  // size: matrix side; codes: distinct codes in play; lengths: daemon sequence lengths (one per daemon, dealt to the
  // daemons in a random order); overlaps: how many codes each daemon in the planted chain shares with the one before
  // it (drawn from the list, capped by the shorter daemon); spare: extra buffer slots beyond the overlapped chain.
  // The buffer is always the chain plus spare, and always shorter than the daemons laid back to back.
  const DIFFICULTIES=[
    {id:'easy',label:'Easy',size:5,codes:4,lengths:[3,3],overlaps:[1,2],spare:[0,1],target:30},
    {id:'normal',label:'Normal',size:6,codes:5,lengths:[2,3,3],overlaps:[1,1,2],spare:[0,1],target:45},
    {id:'hard',label:'Hard',size:6,codes:5,lengths:[3,4,4],overlaps:[1,2,2,3],spare:[0,1],target:60},
    {id:'expert',label:'Expert',size:7,codes:6,lengths:[3,3,4,5],overlaps:[1,2,2,3],spare:[0],target:90}
  ];
  // Each daemon is one fragment of a Null blueprint, listed in this order; the order they chain in is dealt separately
  // and is not the listed order. topic: what the fragment carries; notes: one is dealt per puzzle as flavour.
  const DAEMONS=[
    {name:'SCHEMA',topic:'part layout',notes:['frame layout, 14 parts','exploded view, 3 sub-assemblies','part list with 9 fittings','cutaway, 2 moving parts']},
    {name:'TOLERANCE',topic:'fit and load limits',notes:['fit limits to 0.2 mm','heat rating to 900 K','load rating 4 t','vibration margin 12 Hz']},
    {name:'MATERIALS',topic:'bill of materials',notes:['2 alloy plate, 1 coil','3 ceramic tile, 1 seal kit','1 alloy plate, 2 polymer sheet','4 ore ingot, 1 circuit']},
    {name:'ASSEMBLY',topic:'build sequence',notes:['7-step build order','jig set-up and weld order','press sequence in 5 stages','calibration and test run']}
  ];
  // What a full breach recovers: a blueprint logistics can build or craft. improved: the bonus a Perfect breach adds.
  const BLUEPRINTS=[
    {id:'shield-press',name:'Field shield press',use:'presses barrier plates for the front line',improved:'one extra plate per press'},
    {id:'hopper-fairing',name:'Hopper fairing extension',use:'adds a cargo bay to the rocket hopper',improved:'one less alloy plate to build'},
    {id:'ore-conveyor',name:'Ore conveyor',use:'links an extractor to a refinery',improved:'runs a quarter faster'},
    {id:'coolant-manifold',name:'Coolant manifold',use:'keeps a refinery running through the day',improved:'cools two refineries at once'},
    {id:'relay-mast',name:'Relay mast kit',use:'extends a supply route by one stop',improved:'folds flat: half the rocket space'},
    {id:'med-printer',name:'Field med printer',use:'prints repair packs for the crew',improved:'prints two packs per run'}
  ];
  const SAMPLES=200,MAX_RANDOM_RATE=0.1,MAX_TRIES=60;
  const diffOf=id=>DIFFICULTIES.find(d=>d.id===id)||DIFFICULTIES[0];
  const ORD=['first','second','third','fourth','fifth','sixth','seventh','eighth'];

  // ---- matching helpers -------------------------------------------------------------------------------------------
  const endsWith=(buf,seq)=>{if(buf.length<seq.length)return false;const o=buf.length-seq.length;for(let i=0;i<seq.length;i++)if(buf[o+i]!==seq[i])return false;return true;};
  // Longest k < seq.length with the last k buffer codes equal to the first k of seq: the daemon's live progress.
  function progressOf(buf,seq){for(let k=Math.min(seq.length-1,buf.length);k>0;k--){let ok=true;for(let i=0;i<k;i++)if(buf[buf.length-k+i]!==seq[i]){ok=false;break;}if(ok)return k;}return 0;}
  const contains=(a,b)=>{outer:for(let o=0;o+b.length<=a.length;o++){for(let i=0;i<b.length;i++)if(a[o+i]!==b[i])continue outer;return true;}return false;};

  // ---- state -------------------------------------------------------------------------------------------------------
  const create=()=>({picks:[],disconnected:false});
  // The active line for pick number i: row 0 first, then the column of the last pick, then that pick's row, and so on.
  function activeLine(pz,st){
    const i=st.picks.length;if(i===0)return {kind:'row',index:0};
    const last=st.picks[i-1],r=Math.floor(last/pz.size),c=last%pz.size;
    return i%2===1?{kind:'col',index:c}:{kind:'row',index:r};
  }
  function lineCells(pz,line){const n=pz.size,out=[];for(let k=0;k<n;k++)out.push(line.kind==='row'?line.index*n+k:k*n+line.index);return out;}
  function evaluate(pz,picks){
    const buffer=picks.map(c=>pz.grid[c]),uploaded=[],at={};
    for(let i=1;i<=buffer.length;i++){const b=buffer.slice(0,i);pz.daemons.forEach((d,j)=>{if(!(j in at)&&endsWith(b,d.seq)){at[j]=i;uploaded.push(j);}});}
    const value=uploaded.reduce((s,j)=>s+pz.daemons[j].value,0);
    // Each uploaded daemon occupies buffer slots [start,end). Two uploads whose slots overlap were chained: the shared
    // slots did double duty, finishing one daemon while starting the next.
    const spans={};for(const j of uploaded)spans[j]=[at[j]-pz.daemons[j].seq.length,at[j]];
    const chains=[];
    for(const a of uploaded)for(const b of uploaded){const [sa,ea]=spans[a],[sb,eb]=spans[b];
      if(a!==b&&(sa<sb||(sa===sb&&ea<eb))&&sb<ea)chains.push({from:a,to:b,start:sb,end:Math.min(ea,eb)});}
    chains.sort((x,y)=>x.start-y.start||x.end-y.end);
    return {buffer,uploaded,uploadedAt:at,value,spans,chains,progress:pz.daemons.map((d,j)=>j in at?d.seq.length:progressOf(buffer,d.seq))};
  }
  function legal(pz,st){
    if(status(pz,st)!=='playing')return [];
    const used=new Set(st.picks);return lineCells(pz,activeLine(pz,st)).filter(c=>!used.has(c));
  }
  // playing | disconnected | complete (all daemons) | full (buffer) | stuck (no free cell in the active line)
  function status(pz,st){
    if(st.disconnected)return 'disconnected';
    const e=evaluate(pz,st.picks);
    if(e.uploaded.length===pz.daemons.length)return 'complete';
    if(st.picks.length>=pz.buffer)return 'full';
    const used=new Set(st.picks);
    if(!lineCells(pz,activeLine(pz,st)).some(c=>!used.has(c)))return 'stuck';
    return 'playing';
  }
  function validate(pz,st,action){
    if(!action||typeof action!=='object')return 'No action.';
    if(status(pz,st)!=='playing')return 'The breach is closed.';
    if(action.type==='disconnect')return null;
    if(action.type!=='pick')return 'Unknown action.';
    const c=action.cell;
    if(!Number.isInteger(c)||c<0||c>=pz.size*pz.size)return 'No such cell.';
    if(st.picks.includes(c))return 'That cell is already in the buffer.';
    const line=activeLine(pz,st);
    if(!lineCells(pz,line).includes(c))return line.kind==='row'?`Pick from the highlighted row (${line.index===0&&!st.picks.length?'the top row':'row '+(line.index+1)}).`:`Pick from the highlighted column (column ${line.index+1}).`;
    return null;
  }
  function act(pz,st,action){
    const error=validate(pz,st,action);if(error)return {error};
    if(action.type==='disconnect')return {state:{picks:st.picks.slice(),disconnected:true}};
    return {state:{picks:[...st.picks,action.cell],disconnected:false}};
  }
  const undo=(pz,st)=>st.picks.length&&!st.disconnected?{picks:st.picks.slice(0,-1),disconnected:false}:{picks:st.picks.slice(),disconnected:false};
  const replay=(pz,picks)=>picks.reduce((s,c)=>{const r=act(pz,s,{type:'pick',cell:c});if(r.error)throw new Error(r.error);return r.state;},create());
  function preview(pz,st,cell){
    if(validate(pz,st,{type:'pick',cell}))return null;
    const before=evaluate(pz,st.picks),after=evaluate(pz,[...st.picks,cell]);
    return {...after,newly:after.uploaded.filter(j=>!before.uploaded.includes(j)),advanced:after.progress.map((p,j)=>p>before.progress[j]&&!before.uploaded.includes(j))};
  }

  // ---- solver ------------------------------------------------------------------------------------------------------
  // Exact DFS over legal continuations from st. Returns the best total value reachable (including what is already
  // uploaded) and the shortest continuation that reaches it; ties go to the earliest cells in reading order.
  // only: optional list of daemon indices that count (others are worth 0), used for per-daemon checks and auto.
  function solve(pz,st,only){
    st=st||create();
    const n=pz.size,N=n*n,cap=pz.buffer,ds=pz.daemons,count=only?new Set(only):null;
    const val=ds.map((d,j)=>!count||count.has(j)?d.value:0),total=val.reduce((a,b)=>a+b,0);
    const used=new Uint8Array(N),path=st.picks.slice(),buf=path.map(c=>pz.grid[c]);for(const c of path)used[c]=1;
    const up=ds.map(()=>false);
    {const e=evaluate(pz,path);for(const j of e.uploaded)up[j]=true;}
    let cur=up.reduce((s,u,j)=>s+(u?val[j]:0),0);
    const start={value:cur,path:[],set:ds.map((_,j)=>j).filter(j=>up[j]&&val[j]>0)};
    if(st.disconnected||status(pz,st)!=='playing')return start;
    let best=start.value,bestPath=[],bestSet=start.set;const base=path.length;
    const counted=ds.map((_,j)=>j).filter(j=>val[j]>0);
    const keep=()=>{const len=path.length-base;if(cur>best||(cur===best&&cur>start.value&&len<bestPath.length)){best=cur;bestPath=path.slice(base);bestSet=counted.filter(j=>up[j]);}};
    function bound(){
      let b=cur;const left=cap-buf.length;
      for(const j of counted)if(!up[j]&&ds[j].seq.length-progressOf(buf,ds[j].seq)<=left)b+=val[j];
      return b;
    }
    function rec(){
      keep();
      if(path.length>=cap||counted.every(j=>up[j])||up.every(Boolean))return;
      const len=path.length-base,b=bound();
      if(b<best||(b===best&&(best===start.value||len+1>=bestPath.length)))return;
      const i=path.length,last=path[i-1],isRow=i%2===0,idx=i===0?0:isRow?Math.floor(last/n):last%n;
      for(let k=0;k<n;k++){
        const c=isRow?idx*n+k:k*n+idx;if(used[c])continue;
        used[c]=1;path.push(c);buf.push(pz.grid[c]);
        const gained=[];for(let j=0;j<ds.length;j++)if(!up[j]&&endsWith(buf,ds[j].seq)){up[j]=true;cur+=val[j];gained.push(j);}
        rec();
        for(const j of gained){up[j]=false;cur-=val[j];}
        buf.pop();path.pop();used[c]=0;
      }
    }
    rec();
    return {value:best,path:bestPath,set:bestSet};
  }

  // A player who picks uniformly among legal cells until the breach ends. Returns the value reached.
  function randomRun(pz,r){
    let st=create();
    for(;;){const opts=legal(pz,st);if(!opts.length)break;st=act(pz,st,{type:'pick',cell:r.pick(opts)}).state;}
    return evaluate(pz,st.picks).value;
  }

  // ---- generation --------------------------------------------------------------------------------------------------
  // Longest k shorter than both where a's last k codes are b's first k: how far b can start inside a.
  function overlap(a,b){for(let k=Math.min(a.length,b.length)-1;k>0;k--){let ok=true;for(let i=0;i<k;i++)if(a[a.length-k+i]!==b[i]){ok=false;break;}if(ok)return k;}return 0;}
  // The cells open to pick number i (0-based) after the previous pick `last`.
  function lineFor(n,i,last){const out=[];if(i===0){for(let k=0;k<n;k++)out.push(k);return out;}
    const isRow=i%2===0,idx=isRow?Math.floor(last/n):last%n;for(let k=0;k<n;k++)out.push(isRow?idx*n+k:k*n+idx);return out;}
  function randomPath(n,len,r){
    for(let t=0;t<200;t++){
      const path=[],used=new Set();let ok=true;
      for(let i=0;i<len&&ok;i++){const opts=lineFor(n,i,path[i-1]).filter(c=>!used.has(c));if(!opts.length){ok=false;break;}const c=r.pick(opts);path.push(c);used.add(c);}
      if(ok)return path;
    }
    return null;
  }
  // One attempt: deal lengths and a chain order, build the planted superstring with each daemon starting inside the
  // previous one's tail, plant it on a legal route (after 0..spare junk picks), then lay decoys and fill the rest.
  function candidate(d,r){
    const codes=CODES.slice(0,d.codes),k=d.lengths.length,n=d.size;
    const lens=r.shuffle(d.lengths),order=r.shuffle(d.lengths.map((_,i)=>i));
    const seqs=new Array(k),links=[];let chain=[];
    order.forEach((j,i)=>{
      const len=lens[j];
      if(i===0){seqs[j]=Array.from({length:len},()=>r.pick(codes));chain=seqs[j].slice();return;}
      const prev=order[i-1],o=Math.min(r.pick(d.overlaps),len-1,lens[prev]-1);
      const s=chain.slice(chain.length-o);while(s.length<len)s.push(r.pick(codes));
      seqs[j]=s;chain=chain.concat(s.slice(o));links.push({from:prev,to:j,k:o});
    });
    // A sequence like 55 55 reads as noise; a daemon inside another would upload for free.
    if(seqs.some(s=>new Set(s).size<2))return null;
    for(let a=0;a<k;a++)for(let b=0;b<k;b++)if(a!==b&&contains(seqs[a],seqs[b]))return null;
    const naive=lens.reduce((a,b)=>a+b,0),spare=Math.min(r.pick(d.spare),naive-chain.length-1);
    if(spare<0)return null;
    const buffer=chain.length+spare,lead=r.int(spare+1),path=randomPath(n,lead+chain.length,r);if(!path)return null;
    const fixed=new Map();path.forEach((c,i)=>fixed.set(c,i<lead?r.pick(codes):chain[i-lead]));
    // Decoys: a daemon's opening codes laid as a legal pick sequence that branches off the planted route (or starts
    // fresh in the top row), so a player who chases the first match they see walks onto the wrong line.
    let placed=0;
    for(let t=0;t<n*4&&placed<n;t++){
      const j=r.int(k),seq=seqs[j],plen=Math.min(seq.length-1,2),step=r.int(Math.min(path.length,buffer-1));
      let last=step?path[step-1]:null;const cells=[];
      for(let q=0;q<plen;q++){
        const opts=lineFor(n,step+q,last).filter(c=>!fixed.has(c)&&!cells.includes(c));
        if(!opts.length)break;last=r.pick(opts);cells.push(last);
      }
      if(cells.length<plen)continue;
      cells.forEach((c,q)=>fixed.set(c,seq[q]));placed++;
    }
    const grid=[];for(let c=0;c<n*n;c++)grid.push(fixed.has(c)?fixed.get(c):r.pick(codes));
    const daemons=seqs.map((seq,j)=>{const info=DAEMONS[j];return {id:info.name.toLowerCase(),name:info.name,topic:info.topic,seq,value:1,note:r.pick(info.notes)};});
    return {grid,daemons,links,buffer,naive,planted:path,lead,chainLength:chain.length,chainOrder:order};
  }

  function generate(seed,difficulty){
    const d=diffOf(difficulty),r=K.rng(K.hashSeed(`signal-breach:${d.id}:${seed}`));
    // The blueprint comes from its own stream, so the matrix and daemons stay the same whichever blueprint is dealt.
    const bp=K.rng(K.hashSeed(`signal-breach-blueprint:${d.id}:${seed}`)).pick(BLUEPRINTS);
    let last=null;
    for(let t=0;t<MAX_TRIES;t++){
      const c=candidate(d,r);if(!c)continue;
      const pz={seed,difficulty:d.id,size:d.size,buffer:c.buffer,codes:CODES.slice(0,d.codes),grid:c.grid,
        daemons:c.daemons.map(x=>({...x,fragment:`${x.name} fragment of the ${bp.name}: ${x.note}`})),blueprint:bp,links:c.links,naive:c.naive,chainLength:c.chainLength,target:d.target};
      const total=pz.daemons.length,best=solve(pz,create());
      if(best.value<total)continue; // the planted route guarantees this; kept as a guard
      // Skip must be able to upload the first daemon alone, so the fallback is always exactly one daemon.
      const solo=soloRoute(pz,0),se=evaluate(pz,solo);if(se.uploaded.length!==1||se.uploaded[0]!==0)continue;
      const rr=K.rng(K.hashSeed(`signal-breach-sample:${d.id}:${seed}:${t}`));let hits=0;
      for(let s=0;s<SAMPLES;s++)if(randomRun(pz,rr)>=total)hits++;
      const done={...pz,par:total,autoPath:solo,parPath:best.path,parSet:best.set,total,randomRate:hits/SAMPLES,tries:t+1};
      if(!last||done.randomRate<last.randomRate)last=done;
      if(hits/SAMPLES>MAX_RANDOM_RATE)continue;
      return done;
    }
    if(last)return last;
    throw new Error('Signal breach generation failed for seed '+seed);
  }

  // ---- hints, grading, auto ----------------------------------------------------------------------------------------
  function hint(pz,st){
    st=st||create();if(status(pz,st)!=='playing')return null;
    const now=evaluate(pz,st.picks).value,s=solve(pz,st);
    if(s.value<=now||!s.path.length)return {cell:null,value:s.value,disconnect:true};
    return {cell:s.path[0],value:s.value,set:s.set,path:s.path};
  }
  const names=list=>list.map(j=>j.name);
  function joinNames(list){if(list.length<=1)return list.join('');return list.slice(0,-1).join(', ')+' and '+list.at(-1);}
  function where(pz,cell){const n=pz.size;return `row ${Math.floor(cell/n)+1}, column ${cell%n+1}`;}
  // The overlap a player who left the route at pick k missed: the first chain on the full route whose shared codes
  // sit at or after that pick. Reads "55 1C finishes TRACE while starting DATAMINE".
  function chainNote(pz,picks,k){
    const e=evaluate(pz,picks),c=e.chains.find(x=>x.end>k)||e.chains.at(-1);if(!c)return '';
    return `${e.buffer.slice(c.start,c.end).join(' ')} finishes ${pz.daemons[c.from].name} while starting ${pz.daemons[c.to].name}`;
  }
  function routeStory(pz,picks,set,k){
    const all=set.length===pz.daemons.length,head=all?`uploaded all ${set.length} daemons and recovered the whole ${blueprintOf(pz).name} blueprint`:`uploaded ${joinNames(set.map(j=>pz.daemons[j].name))}`;
    const note=chainNote(pz,picks,k||0);return note?`${head}: ${note}`:head;
  }
  function nearMiss(pz,st){
    const picks=st.picks,v=evaluate(pz,picks).value;if(v>=pz.par)return '';
    let k=0;for(let i=picks.length;i>=0;i--){if(solve(pz,{picks:picks.slice(0,i),disconnected:false}).value>=pz.par){k=i;break;}}
    const pre={picks:picks.slice(0,k),disconnected:false},s=solve(pz,pre);if(!s.path.length)return '';
    const cell=s.path[0],full=[...pre.picks,...s.path],story=routeStory(pz,full,s.set,k),code=pz.grid[cell];
    if(!picks.length)return `Starting with ${code} at ${where(pz,cell)} would have ${story}.`;
    if(k===picks.length)return `Instead of disconnecting after ${k} pick${k===1?'':'s'}, ${code} at ${where(pz,cell)} would have ${story}.`;
    return `Taking ${code} at ${where(pz,cell)} as your ${ORD[k]||'next'} pick would have ${story}.`;
  }
  const blueprintOf=pz=>pz.blueprint||BLUEPRINTS[0];
  // What the breach hands to logistics. Perfect: the complete blueprint, improved. Good: the complete blueprint (all
  // fragments, or all but one that research rebuilds from the rest). Partial: the fragments recovered, which carry over
  // toward the blueprint. Failed: nothing.
  function blueprintResult(pz,tier,uploaded){
    const bp=blueprintOf(pz),got=uploaded.map(j=>pz.daemons[j].name),n=pz.daemons.length;
    const missing=pz.daemons.filter((d,j)=>!uploaded.includes(j)).map(d=>d.name);
    if(tier==='perfect')return {state:'improved',name:bp.name,fragments:got,carry:0,
      output:`Blueprint complete and improved: ${bp.name} (${bp.improved}). Logistics can build it: it ${bp.use}.`};
    if(tier==='good')return {state:'complete',name:bp.name,fragments:got,carry:0,
      output:`Blueprint complete: ${bp.name}.${missing.length?` Research rebuilt the missing ${joinNames(missing)} fragment from the rest.`:''} Logistics can build it: it ${bp.use}.`};
    if(tier==='partial'||got.length)return {state:'fragments',name:bp.name,fragments:got,carry:got.length,
      output:`${got.length} of ${n} fragments toward the ${bp.name} blueprint (${joinNames(got)}). They carry over: ${joinNames(missing)} still to recover.`};
    return {state:'none',name:bp.name,fragments:[],carry:0,output:''};
  }
  // Perfect = every daemon; Good = all but one; Partial = at least one; Failed = none.
  function tierOf(pz,value){
    if(value>=pz.par)return 'perfect';
    if(pz.par>=2&&value>=pz.par-1)return 'good';
    return value>0?'partial':'failed';
  }
  function grade(pz,st,flags){
    flags=flags||{};
    const e=evaluate(pz,st.picks);let tier=tierOf(pz,e.value),capped=false;
    if(tier==='perfect'&&flags.hints>0){tier='good';capped=true;}
    const up=e.uploaded.map(j=>pz.daemons[j]),all=up.length===pz.daemons.length,ch=e.chains.length;
    const headline=!up.length?'No daemon uploaded. The Null transmission stays scrambled.'
      :all?`Full breach: all ${up.length} daemons in ${st.picks.length} of ${pz.buffer} slots${ch?`, ${ch} chained`:''}.`
      :`Breach: ${joinNames(names(up))} uploaded, ${up.length} of ${pz.daemons.length} daemons.`;
    let near=nearMiss(pz,st);
    if(capped)near='The route was perfect, but the hint caps the result at Good. Find it unaided for Perfect and an improved blueprint.';
    const bp=blueprintResult(pz,tier,e.uploaded);
    return {tier,score:Math.round(100*e.value/pz.par),headline,nearMiss:near,output:bp.output,blueprint:bp,
      stats:{Daemons:`${up.length}/${pz.daemons.length}`,Buffer:`${st.picks.length}/${pz.buffer}`,Chained:`${ch}`,Hints:`${flags.hints||0}`},uploaded:e.uploaded,value:e.value};
  }
  // The automatic fallback: a fresh breach that takes the shortest route to the first listed daemon, then disconnects.
  // Shortest legal route that uploads daemon j and no other (iterative deepening, reading order breaks ties).
  function soloRoute(pz,j){
    const picks=[];
    function dfs(depth){
      const e=evaluate(pz,picks);
      if(e.uploaded.length)return e.uploaded.length===1&&e.uploaded[0]===j;
      if(picks.length>=depth||pz.daemons[j].seq.length-e.progress[j]>depth-picks.length)return false;
      for(const c of legal(pz,{picks,disconnected:false})){picks.push(c);if(dfs(depth))return true;picks.pop();}
      return false;
    }
    for(let depth=pz.daemons[j].seq.length;depth<=pz.buffer;depth++)if(dfs(depth))return picks.slice();
    return solve(pz,create(),[j]).path;
  }
  function auto(pz){
    const state={picks:(pz.autoPath||soloRoute(pz,0)).slice(),disconnected:true},e=evaluate(pz,state.picks),d=pz.daemons[0];
    return {state,score:Math.round(100/pz.par),value:1,uploaded:[0],
      headline:`Automatic breach: only ${d.name} uploaded, 1 of ${pz.daemons.length} daemons.`,
      nearMiss:`Planning the route yourself, ${pz.grid[pz.parPath[0]]} at row 1, column ${pz.parPath[0]%pz.size+1} as your first pick would have ${routeStory(pz,pz.parPath,pz.parSet,0)}.`,
      output:blueprintResult(pz,'partial',[0]).output,blueprint:blueprintResult(pz,'partial',[0]),stats:{Daemons:`1/${pz.daemons.length}`,Buffer:`${state.picks.length}/${pz.buffer}`},allUploaded:e.uploaded};
  }

  return {CODES,DIFFICULTIES,DAEMONS,BLUEPRINTS,SAMPLES,MAX_RANDOM_RATE,generate,create,activeLine,lineCells,legal,status,validate,act,undo,replay,
    evaluate,preview,progressOf,overlap,solve,randomRun,hint,grade,tierOf,nearMiss,blueprintResult,auto,where};
});
