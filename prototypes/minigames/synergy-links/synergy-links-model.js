// Synergy links (Lieutenant): Flow Free on the formation grid. Pure rules, no DOM; deterministic from (seed, difficulty).
//
// Rules (pure Flow):
// - The grid holds pairs of endpoints, one pair per synergy, each pair in its own colour. Cells are numbered r*size+c.
// - A link is drawn from either endpoint of its pair. It moves orthogonally, one cell at a time, and may not pass
//   through any other pair's endpoint. Reaching the partner endpoint completes the link; it cannot go further.
// - Links never cross. Drawing over another pair's line cuts that line where it was crossed (the cut line keeps the
//   part nearest its own start). Drawing back over your own line retracts it to that cell.
// - Perfect: every pair connected and every cell filled, unaided. All pairs connected with gaps left is Good; so is a
//   full board solved with a hint or an assist on. Some pairs connected is Partial; none is Failed.
//
// Generator: random non-crossing path cover, then uniqueness by an exact solver.
// - Start with every cell its own path. Repeatedly join two paths whose ends touch, preferring the shortest paths (so
//   nothing is stranded) with some random joins that let a few paths grow long and winding. A join is refused if the
//   merged path would touch itself (a non-consecutive cell beside another of its own cells): such paths almost always
//   leave a second solution. Stop at the target pair count.
// - Reject covers with a path under 3 cells, too many straight 3-cell runs, or no long path.
// - Solver: grow one link at a time from its head toward its partner, always the head with the fewest moves (forced
//   moves first). Prune when an empty cell has fewer than two open neighbours, when an empty region touches no pair
//   that could still pass through it, or when a head can no longer reach its partner. Count solutions, stop at 2.
//   Keep the cover only if exactly one solution exists. Everything is driven by the seeded rng and node budgets, never
//   wall-clock time, so generation is deterministic.
(function(root){
  'use strict';
  const Kit=typeof module==='object'&&module.exports&&typeof require==='function'?require('../../shared/minigames/minigame-kit.js'):root.MiniGameKit;

  const DIFFICULTIES=[
    {id:'easy',label:'5×5 · 4 links',size:5,pairs:[4,4],maxStraight:0,target:45},
    {id:'normal',label:'6×6 · 5–6 links',size:6,pairs:[5,6],maxStraight:1,target:60},
    {id:'hard',label:'7×7 · 6–7 links',size:7,pairs:[6,7],maxStraight:1,target:90},
    {id:'expert',label:'8×8 · 7–8 links',size:8,pairs:[7,8],maxStraight:1,target:120},
    {id:'large',label:'10×10 · relaxed',size:10,pairs:[11,12],maxStraight:2,budget:25000,target:180}
  ];
  // The seven Weavers (prototypes/shared/combat/weaver-roster.js, docs/design/aether-weavers.md).
  const CREW={
    Hanae:{name:'Hanae',full:'Hanae Mori',weaver:'Gatherer',initial:'H',element:'energy'},
    Ivara:{name:'Ivara',full:'Ivara',weaver:'Reservoir',initial:'I',element:'void'},
    Arunima:{name:'Arunima',full:'Arunima Das',weaver:'Conduit',initial:'A',element:'void'},
    Roonie:{name:'Roonie',full:'Roonie Baelk',weaver:'Tuner',initial:'R',element:'energy'},
    Veska:{name:'Veska',full:'Veska Reed',weaver:'Cantor',initial:'V',element:'growth'},
    Silen:{name:'Silen',full:'Silen',weaver:'Cascade',initial:'S',element:'order'},
    Daven:{name:'Daven',full:'Daven Pell',weaver:'Anchor',initial:'D',element:'order'}
  };
  // Each synergy is a real interaction between two kits.
  const SYNERGIES=[
    {id:'feed',from:'Hanae',to:'Arunima',name:'Aether feed',detail:'Pass the Chord’s +4 refills fund Proof by Transit’s full burst.'},
    {id:'cover',from:'Daven',to:'Veska',name:'Barrier cover',detail:'Everyone Behind Me shields Veska while she builds her Refrains.'},
    {id:'discount',from:'Roonie',to:'Arunima',name:'Burst discount',detail:'Borrow My Bypass saves a charge on Proof by Transit without cutting its damage.'},
    {id:'aperture',from:'Ivara',to:'Arunima',name:'Wider aperture',detail:'Room for an Echo adds 2 pool capacity, so Full burst can spend more.'},
    {id:'opening',from:'Roonie',to:'Silen',name:'Opening discount',detail:'A Bypass discount on Rising Current’s first hit buys an extra turn.'},
    {id:'current',from:'Hanae',to:'Silen',name:'Current refill',detail:'Hanae’s refills keep Rising Current’s chain affordable for longer.'},
    {id:'refrain',from:'Veska',to:'Hanae',name:'Refrain return',detail:'One More Verse returns up to 3 Aether for Hanae to pass on.'},
    {id:'isolation',from:'Daven',to:'Roonie',name:'Isolation check',detail:'Daven’s barrier keeps the apprentice safe; Recovered Load returns a charge.'},
    {id:'reservoir',from:'Ivara',to:'Silen',name:'Deeper reservoir',detail:'The larger pool lets Rising Current reach a fourth pulse.'},
    {id:'lance',from:'Roonie',to:'Ivara',name:'Lance tuning',detail:'Pocket Workshop discounts Echo Lance by a charge.'},
    {id:'chord',from:'Hanae',to:'Roonie',name:'Chord pass',detail:'Pass the Chord makes Roonie’s next basic gather +1 Aether.'},
    {id:'steady',from:'Veska',to:'Daven',name:'Steady refrain',detail:'Her healing keeps the anchor standing, so Recovered Load keeps paying.'},
    {id:'circuits',from:'Roonie',to:'Veska',name:'All circuits clear',detail:'Roonie’s ultimate charge brings The Room Sings Back round sooner.'},
    {id:'guard',from:'Daven',to:'Hanae',name:'Gatherer guard',detail:'Hold the Line draws fire away from the crew’s main gatherer.'}
  ];
  // Flow-style colours: bright, well separated on the dark board.
  const COLORS=['#f0524f','#3d7eff','#3ccf63','#f5d33d','#ff8f2e','#33d6e6','#e45ce0','#c49260','#9a6bff','#eef1f4','#ff9ec4','#9aa63a'];
  const COLOR_NAMES=['red','blue','green','yellow','orange','cyan','magenta','tan','violet','white','pink','olive'];
  const ASSISTS=[{id:'off',label:'Off'},{id:'dead',label:'Show dead ends'},{id:'auto',label:'Auto-finish forced links'}];

  const nbCache={};
  function neighbours(n){
    if(nbCache[n])return nbCache[n];
    const out=[];for(let i=0;i<n*n;i++){const r=Math.floor(i/n),c=i%n,l=[];if(r>0)l.push(i-n);if(c<n-1)l.push(i+1);if(r<n-1)l.push(i+n);if(c>0)l.push(i-1);out.push(l);}
    return nbCache[n]=out;
  }
  const adjacent=(n,a,b)=>{const ra=Math.floor(a/n),rb=Math.floor(b/n);return (ra===rb&&Math.abs(a-b)===1)||Math.abs(a-b)===n;};
  const turns=(n,p)=>{let t=0;for(let i=2;i<p.length;i++)if((p[i]-p[i-1])!==(p[i-1]-p[i-2]))t++;return t;};
  const straight3=(n,p)=>p.length===3&&turns(n,p)===0;
  const diffOf=id=>DIFFICULTIES.find(d=>d.id===id)||DIFFICULTIES[0];

  // ---- solver ---------------------------------------------------------------------------------------------------------
  // solveGrid(n, ends, opts): ends[k]=[a,b]; opts.fixed: per-pair cell arrays already drawn (from a, contiguous, maybe
  // complete); opts.limit (default 2); opts.budget node limit. Returns {count, solution (first found), nodes, exhausted}.
  function solveGrid(n,ends,opts={}){
    // Both ends of every open pair grow; each step extends the live tip with the fewest moves (forced tips first).
    const N=n*n,nb=neighbours(n),K=ends.length,limit=opts.limit||2,budget=opts.budget||400000;
    const col=new Int8Array(N).fill(-1),tip=new Int16Array(2*K),done=new Uint8Array(K),side=[];
    let filled=0;
    for(let k=0;k<K;k++){const [a,b]=ends[k];col[a]=k;col[b]=k;filled+=a===b?1:2;tip[2*k]=a;tip[2*k+1]=b;side.push([a],[b]);}
    for(let k=0;k<K;k++){
      const [a,b]=ends[k],fx=opts.fixed&&opts.fixed[k]&&opts.fixed[k].length>1?opts.fixed[k]:null;
      if(!fx)continue;
      const j=fx[0]===a?2*k:2*k+1,t=fx[0]===a?b:a;
      for(const c of fx){if(c===a||c===b)continue;if(col[c]!==-1)return {count:0,solution:null,nodes:0,exhausted:true};col[c]=k;filled++;}
      if(fx[fx.length-1]===t){done[k]=1;side[2*k]=fx[0]===a?fx.slice():fx.slice().reverse();side[2*k+1]=[];}
      else{side[j]=fx.slice();tip[j]=fx[fx.length-1];}
    }
    let count=0,nodes=0,solution=null,aborted=false;
    const comp=new Int16Array(N),stack=new Int16Array(N),open=new Uint8Array(N);
    function viable(){
      // 1. Every empty cell needs two open neighbours (empty, or a live tip of an open pair).
      open.fill(0);
      for(let k=0;k<K;k++)if(!done[k]){open[tip[2*k]]=1;open[tip[2*k+1]]=1;}
      for(let i=0;i<N;i++){if(col[i]!==-1)continue;let o=0;for(const x of nb[i])if(col[x]===-1||open[x])o++;if(o<2)return false;}
      // 2. Each empty region must touch both tips of some open pair, and each open pair's tips must touch or share a region.
      comp.fill(-1);let nc=0;const hm=[],tm=[];
      for(let i=0;i<N;i++){
        if(col[i]!==-1||comp[i]!==-1)continue;
        let sp=0;stack[sp++]=i;comp[i]=nc;let h=0,t=0;
        while(sp){const c=stack[--sp];for(const x of nb[c]){if(col[x]===-1){if(comp[x]===-1){comp[x]=nc;stack[sp++]=x;}}
          else if(open[x]){const k=col[x];if(x===tip[2*k])h|=1<<k;if(x===tip[2*k+1])t|=1<<k;}}}
        hm.push(h);tm.push(t);if(!(h&t))return false;nc++;
      }
      for(let k=0;k<K;k++){
        if(done[k]||adjacent(n,tip[2*k],tip[2*k+1]))continue;
        let ok=false;for(let c=0;c<nc&&!ok;c++)if(hm[c]&tm[c]&(1<<k))ok=true;
        if(!ok)return false;
      }
      return true;
    }
    function rec(){
      if(aborted)return;
      if(++nodes>budget){aborted=true;return;}
      let best=-1,bestMoves=null;
      for(let j=0;j<2*K;j++){
        const k=j>>1;if(done[k])continue;
        const m=[],other=tip[j^1];for(const x of nb[tip[j]])if(col[x]===-1||x===other)m.push(x);
        if(!m.length)return;
        if(!bestMoves||m.length<bestMoves.length){best=j;bestMoves=m;if(m.length===1)break;}
      }
      if(best<0){if(filled===N){count++;if(!solution)solution=ends.map((_,k)=>side[2*k].concat(side[2*k+1].slice().reverse()));}return;}
      if(!viable())return;
      const j=best,k=j>>1;
      for(const x of bestMoves){
        const old=tip[j];
        if(x===tip[j^1]){done[k]=1;rec();done[k]=0;}
        else{col[x]=k;tip[j]=x;filled++;side[j].push(x);rec();side[j].pop();filled--;tip[j]=old;col[x]=-1;}
        if(count>=limit||aborted)return;
      }
    }
    rec();
    return {count,solution,nodes,exhausted:!aborted};
  }

  // ---- generator ------------------------------------------------------------------------------------------------------
  function partition(n,goal,r,greed,rewireBudget=0){
    const N=n*n,nb=neighbours(n),pathOf=new Int16Array(N),paths=[];
    for(let i=0;i<N;i++){pathOf[i]=i;paths.push([i]);}
    let alive=N,rewires=0;
    const ends=p=>p.length===1?[p[0]]:[p[0],p[p.length-1]];
    const isEnd=(p,c)=>p[0]===c||p[p.length-1]===c;
    function canMerge(A,e,B,f){
      const bid=pathOf[f];
      for(const x of A)for(const y of nb[x])if(pathOf[y]===bid&&!(x===e&&y===f))return false;
      return true;
    }
    while(alive>goal){
      const live=[];for(let i=0;i<N;i++)if(paths[i])live.push(i);
      let order=r.shuffle(live);
      // Mostly short-first (so nothing is stranded); sometimes a random path grows, which makes the long winders.
      if(!r.chance(greed))order=order.map((id,i)=>({id,k:paths[id].length+r.next()*0.5})).sort((x,y)=>x.k-y.k).map(o=>o.id);
      let merged=false;
      for(const id of order){
        const A=paths[id];
        for(const e of r.shuffle(ends(A))){
          for(const f of r.shuffle(nb[e])){
            const bid=pathOf[f];if(bid===id)continue;const B=paths[bid];if(!isEnd(B,f))continue;
            if(!canMerge(A,e,B,f))continue;
            const a2=A[A.length-1]===e?A:A.slice().reverse(),b2=B[0]===f?B:B.slice().reverse(),m=a2.concat(b2);
            paths[id]=m;paths[bid]=null;for(const c of b2)pathOf[c]=id;alive--;merged=true;break;
          }
          if(merged)break;
        }
        if(merged)break;
      }
      if(merged)continue;
      // Stuck: rewire. An end of path A beside the middle of path B takes over one half of B; B keeps the other half.
      // The count is unchanged but the ends move, which opens new joins. Bounded, so it always terminates.
      let rewired=false;
      for(let tries=0;tries<40&&rewires<rewireBudget&&!rewired;tries++){
        const id=r.pick(live),A=paths[id],e=r.pick(ends(A)),f=r.pick(nb[e]),bid=pathOf[f];
        if(bid===id)continue;const B=paths[bid],i=B.indexOf(f);if(i<=0||i>=B.length-1)continue;
        const take=r.chance(0.5)?B.slice(i):B.slice(0,i+1).reverse(),keep=take[take.length-1]===B[B.length-1]?B.slice(0,i):B.slice(i+1);
        const a2=A[A.length-1]===e?A:A.slice().reverse(),tset=new Set(take);let ok=true;
        for(const x of a2){for(const y of nb[x])if(tset.has(y)&&!(x===e&&y===f)){ok=false;break;}if(!ok)break;}
        if(!ok)continue;
        paths[id]=a2.concat(take);for(const c of take)pathOf[c]=id;paths[bid]=keep;rewires++;rewired=true;
      }
      if(!rewired)break;
    }
    return paths.filter(Boolean);
  }
  function seedFor(seed,difficulty){return (Kit.hashSeed(difficulty+':'+seed)^(Number(seed)>>>0))>>>0;}
  // Winding score: turns plus the longest path, so a few long bends beat many short stubs.
  const winding=(n,sol)=>sol.reduce((s,p)=>s+turns(n,p),0)+Math.max(...sol.map(p=>p.length))*0.75;

  function generate(seed,difficulty){
    const d=diffOf(difficulty),n=d.size,N=n*n,r=Kit.rng(seedFor(seed,d.id));
    const stats={attempts:0,rejected:{shape:0,count:0,quality:0,ambiguous:0,budget:0},nodes:0};
    const want=2;let best=null,found=0;
    for(let attempt=0;attempt<4000&&found<want;attempt++){
      stats.attempts++;
      const goal=r.range(d.pairs[0],d.pairs[1]),paths=partition(n,goal,r,0.25,200);
      if(paths.length<d.pairs[0]||paths.length>d.pairs[1]){stats.rejected.count++;continue;}
      if(paths.some(p=>p.length<3)){stats.rejected.shape++;continue;}
      const st3=paths.filter(p=>straight3(n,p)).length,longest=Math.max(...paths.map(p=>p.length));
      if(st3>d.maxStraight||longest<Math.ceil(N/paths.length*1.4)){stats.rejected.quality++;continue;}
      const res=solveGrid(n,paths.map(p=>[p[0],p[p.length-1]]),{limit:2,budget:d.budget||12000});
      stats.nodes+=res.nodes;
      if(!res.exhausted){stats.rejected.budget++;continue;}
      if(res.count!==1){stats.rejected.ambiguous++;continue;}
      found++;const w=winding(n,paths);
      if(!best||w>best.w)best={paths,w};
    }
    if(!best)throw new Error(`No unique puzzle for ${d.id} seed ${seed}`);
    // Pair order: longest link first gets the first colours; synergies dealt from a shuffled catalogue.
    const sol=best.paths.slice().sort((a,b)=>b.length-a.length||a[0]-b[0]);
    const syn=r.shuffle(SYNERGIES).slice(0,sol.length);
    const colors=COLORS.slice(0,Math.max(sol.length,0));
    const pairs=sol.map((p,i)=>({id:i,a:p[0],b:p[p.length-1],color:colors[i],colorName:COLOR_NAMES[i],synergy:syn[i]}));
    stats.winding=+best.w.toFixed(2);stats.longest=sol[0].length;stats.turns=sol.reduce((s,p)=>s+turns(n,p),0);
    stats.straight3=sol.filter(p=>straight3(n,p)).length;stats.lengths=sol.map(p=>p.length);
    return {seed:Number(seed)>>>0,difficulty:d.id,size:n,pairs,solution:sol,stats};
  }

  // ---- state and moves -----------------------------------------------------------------------------------------------
  const create=pz=>({paths:pz.pairs.map(()=>[])});
  const clone=st=>({paths:st.paths.map(p=>p.slice())});
  function endpointMap(pz){const m=new Int16Array(pz.size*pz.size).fill(-1);for(const p of pz.pairs){m[p.a]=p.id;m[p.b]=p.id;}return m;}
  const partnerOf=(pz,k,c)=>pz.pairs[k].a===c?pz.pairs[k].b:pz.pairs[k].a;
  const isConnected=(pz,st,k)=>{const p=st.paths[k],q=pz.pairs[k];return p.length>=2&&((p[0]===q.a&&p[p.length-1]===q.b)||(p[0]===q.b&&p[p.length-1]===q.a));};
  // owner[cell] = pair whose drawn line or endpoint covers it, or -1.
  function owners(pz,st){const o=endpointMap(pz);st.paths.forEach((p,k)=>{for(const c of p)o[c]=k;});return o;}

  // A stroke: {type:'stroke', pair, cells:[start, ...]}; start is an endpoint of the pair (the line restarts there) or a
  // cell on its current line (the line is kept up to it). Each later cell must touch the previous one. Moving back onto
  // the line retracts it. {type:'extend', pair, cell} is a one-cell stroke from the line's tip. {type:'clear', pair}.
  // Returns the new line or a reason.
  function strokePath(pz,st,move){
    const n=pz.size,N=n*n;
    if(!move||typeof move!=='object')return {why:'No move'};
    if(move.type==='clear'){if(!pz.pairs[move.pair])return {why:'No such link'};return {pair:move.pair,path:[]};}
    let cells;
    if(move.type==='extend'){
      if(!pz.pairs[move.pair])return {why:'No such link'};
      const cur=st.paths[move.pair];if(!cur.length)return {why:'Start this link from one of its endpoints'};
      if(isConnected(pz,st,move.pair))return {why:'This link is already complete'};
      cells=[cur[cur.length-1],move.cell];
    }else if(move.type==='stroke')cells=move.cells;
    else return {why:'Unknown move'};
    const k=move.pair,q=pz.pairs[k];
    if(!q)return {why:'No such link'};
    if(!Array.isArray(cells)||!cells.length)return {why:'Empty stroke'};
    if(cells.some(c=>!Number.isInteger(c)||c<0||c>=N))return {why:'Off the grid'};
    const ep=endpointMap(pz),cur=st.paths[k],s=cells[0];
    let path;
    if(s===q.a||s===q.b)path=[s];
    else{const i=cur.indexOf(s);if(i<0)return {why:'Start on one of this link’s endpoints or on its line'};path=cur.slice(0,i+1);}
    for(let j=1;j<cells.length;j++){
      const c=cells[j],tip=path[path.length-1];
      if(!adjacent(n,tip,c))return {why:'Links move one square at a time, up, down or sideways'};
      const back=path.indexOf(c);
      if(back>=0){path=path.slice(0,back+1);continue;}
      const partner=partnerOf(pz,k,path[0]);
      if(tip===partner&&path.length>1)return {why:'This link is already complete'};
      if(ep[c]!==-1&&ep[c]!==k)return {why:`Links cannot pass through ${q.synergy?'another crewmate':'another endpoint'}`};
      if(ep[c]===k&&c!==partner)return {why:'Start this link from one of its endpoints'};
      path.push(c);
    }
    return {pair:k,path:path.length>1?path:[]};
  }
  function validate(pz,st,move){const r=strokePath(pz,st,move);return r.why||null;}
  // Applies a move. Lines it crosses are cut at the crossing. Returns null, or a reason with the state untouched.
  function apply(pz,st,move){
    const r=strokePath(pz,st,move);if(r.why)return r.why;
    const k=r.pair,set=new Set(r.path);
    st.paths[k]=r.path;
    st.paths.forEach((p,d)=>{if(d===k)return;const i=p.findIndex(c=>set.has(c));if(i>=0)st.paths[d]=i>1?p.slice(0,i):[];});
    return null;
  }
  // Lines that would be cut by a move (for captions and hints).
  function cutsBy(pz,st,move){
    const r=strokePath(pz,st,move);if(r.why)return [];const set=new Set(r.path);
    return st.paths.map((p,d)=>d!==r.pair&&p.some(c=>set.has(c))?d:-1).filter(d=>d>=0);
  }

  function evaluate(pz,st){
    const N=pz.size*pz.size,connected=pz.pairs.map(p=>isConnected(pz,st,p.id)),cover=new Uint8Array(N);
    st.paths.forEach(p=>{for(const c of p)cover[c]=1;});
    const filled=cover.reduce((a,b)=>a+b,0),count=connected.filter(Boolean).length;
    return {connected,connectedCount:count,pairs:pz.pairs.length,filled,cells:N,empty:N-filled,full:filled===N,
      allConnected:count===pz.pairs.length,solved:count===pz.pairs.length&&filled===N};
  }
  // tier(pz, ev, {hints, assist}): any hint or assist caps a full board at Good.
  function tier(pz,ev,aid={}){
    const aided=(aid.hints||0)>0||(aid.assist&&aid.assist!=='off');
    if(ev.solved)return aided?'good':'perfect';
    if(ev.allConnected)return 'good';
    return ev.connectedCount?'partial':'failed';
  }
  function score(pz,ev,aid={}){
    const base=ev.solved?100:Math.round(70*ev.connectedCount/ev.pairs+30*ev.filled/ev.cells)-10;
    const pen=(aid.hints||0)*5+(aid.assist==='auto'?15:aid.assist==='dead'?8:0);
    return Math.max(0,Math.min(100,base-pen));
  }

  // ---- solving from a partial state ----------------------------------------------------------------------------------
  // Exact solve keeping the player's completed links (correct or not). Returns the solution paths or null.
  function solve(pz,st,opts={}){
    const fixed=st?pz.pairs.map(p=>isConnected(pz,st,p.id)?st.paths[p.id]:null):null;
    const res=solveGrid(pz.size,pz.pairs.map(p=>[p.a,p.b]),{fixed,limit:opts.limit||1,budget:opts.budget||400000});
    return opts.count?res:res.solution;
  }
  const samePath=(x,y)=>x.length===y.length&&(x.every((c,i)=>c===y[i])||x.every((c,i)=>c===y[y.length-1-i]));
  const correct=(pz,st,k)=>samePath(st.paths[k],pz.solution[k]);
  const label=(pz,k)=>{const s=pz.pairs[k].synergy;return `${s.from} → ${s.to}`;};
  const caption=(pz,k)=>{const s=pz.pairs[k].synergy;return `${s.from} → ${s.to}: ${s.name}`;};

  // ---- assists -------------------------------------------------------------------------------------------------------
  // Live ends of each open pair: the line's tip and its partner, or both endpoints when nothing is drawn.
  function liveEnds(pz,st){
    return pz.pairs.map(q=>{if(isConnected(pz,st,q.id))return null;const p=st.paths[q.id];return p.length?[p[p.length-1],partnerOf(pz,q.id,p[0])]:[q.a,q.b];});
  }
  // Dead cells: empty cells no open pair can still pass through: fewer than two open neighbours, or an empty region
  // that does not touch both live ends of any open pair.
  function deadCells(pz,st){
    const n=pz.size,N=n*n,nb=neighbours(n),own=owners(pz,st),ends=liveEnds(pz,st),liveMark=new Int16Array(N).fill(-1);
    // A live end may serve several pairs only in theory; each cell belongs to at most one pair, so a plain map works.
    ends.forEach((e,k)=>{if(e){liveMark[e[0]]=k;liveMark[e[1]]=k;}});
    const comp=new Int16Array(N).fill(-1),dead=[];
    for(let i=0;i<N;i++){
      if(own[i]!==-1||comp[i]!==-1)continue;
      const cells=[i],seenA=new Set(),seenB=new Set();comp[i]=i;
      for(let j=0;j<cells.length;j++){const c=cells[j];for(const x of nb[c]){
        if(own[x]===-1){if(comp[x]===-1){comp[x]=i;cells.push(x);}}
        else if(liveMark[x]>=0){const k=liveMark[x];(x===ends[k][0]?seenA:seenB).add(k);}}}
      const usable=[...seenA].some(k=>seenB.has(k));
      for(const c of cells){
        let o=0;for(const x of nb[c])if(own[x]===-1||liveMark[x]>=0)o++;
        if(!usable||o<2)dead.push(c);
      }
    }
    return dead.sort((a,b)=>a-b);
  }
  // Viable routes for one open pair on the current board (its own line ignored): simple paths between its endpoints
  // through empty cells that leave every other open pair able to connect and strand no empty cell. Stops at `limit`.
  function routes(pz,st,k,limit=2,budget=6000,check='loose'){
    const n=pz.size,nb=neighbours(n),q=pz.pairs[k],base=clone(st);base.paths[k]=[];
    const own=owners(pz,base),out=[];let steps=0,over=false;
    const path=[q.a],used=new Uint8Array(n*n);used[q.a]=1;
    function ok(p){
      const t=clone(base);t.paths[k]=p.slice();
      return check==='raw'?true:check==='strict'?deadCells(pz,t).length===0&&connectable(pz,t):connectable(pz,t);
    }
    function dfs(c){
      if(out.length>=limit||over)return;
      if(++steps>budget){over=true;return;}
      for(const x of nb[c]){
        if(x===q.b){path.push(x);if(ok(path))out.push(path.slice());path.pop();if(out.length>=limit)return;continue;}
        if(used[x]||own[x]!==-1)continue;
        used[x]=1;path.push(x);dfs(x);path.pop();used[x]=0;
        if(out.length>=limit||over)return;
      }
    }
    dfs(q.a);
    return {routes:out,complete:!over};
  }
  // Every open pair's live ends still share an empty region (or touch).
  function connectable(pz,st){
    const n=pz.size,nb=neighbours(n),own=owners(pz,st),ends=liveEnds(pz,st);
    for(const e of ends){
      if(!e)continue;const [s,t]=e;if(adjacent(n,s,t))continue;
      const seen=new Uint8Array(n*n),q=[];for(const x of nb[s])if(own[x]===-1&&!seen[x]){seen[x]=1;q.push(x);}
      let hit=false;
      for(let j=0;j<q.length&&!hit;j++){for(const x of nb[q[j]]){if(x===t){hit=true;break;}if(own[x]===-1&&!seen[x]){seen[x]=1;q.push(x);}}}
      if(!hit)return false;
    }
    return true;
  }
  // The first open pair with exactly one viable route, or null.
  function forcedLink(pz,st){
    for(const q of pz.pairs){
      if(isConnected(pz,st,q.id))continue;
      const r=routes(pz,st,q.id,2);
      if(r.complete&&r.routes.length===1)return {pair:q.id,path:r.routes[0]};
    }
    return null;
  }
  // Applies forced links one after another (a cascade). Returns the list of {pair,path} drawn, mutating st.
  function autoFinish(pz,st,max=20){
    const drawn=[];
    for(let i=0;i<max;i++){
      const f=forcedLink(pz,st);if(!f)break;
      apply(pz,st,{type:'stroke',pair:f.pair,cells:f.path});drawn.push(f);
    }
    return drawn;
  }

  // ---- hint, auto, near-miss -----------------------------------------------------------------------------------------
  // Draws one full correct link from the unique solution: the most constrained pair still wrong (fewest viable routes
  // on the current board, then the shortest solution route). Lines in its way are cut first.
  function hint(pz,st){
    const wrong=pz.pairs.filter(q=>!correct(pz,st,q.id));
    if(!wrong.length)return null;
    const ranked=wrong.map(q=>{const r=routes(pz,st,q.id,3,2500),raw=routes(pz,st,q.id,3,2500,'raw');
      return {k:q.id,n:r.complete?r.routes.length:3,raw:raw.complete?raw.routes.length:3,len:pz.solution[q.id].length};})
      .sort((x,y)=>x.n-y.n||x.raw-y.raw||x.len-y.len||x.k-y.k);
    const k=ranked[0].k,path=pz.solution[k],move={type:'stroke',pair:k,cells:path};
    const cuts=cutsBy(pz,st,move);
    const text=`${caption(pz,k)}. ${cuts.length?`It cuts ${cuts.map(d=>label(pz,d)).join(' and ')} out of the way. `:''}${st.paths[k].length&&!cuts.length?'Your line for it is redrawn. ':''}`.trim();
    return {pair:k,path,cuts,move,text};
  }
  // Skip: the crew connects only the easy pairs (the shorter, straighter half of the solution), for a reduced result.
  function easyPairs(pz){
    const n=pz.size,ranked=pz.pairs.map(q=>({k:q.id,cost:pz.solution[q.id].length+2*turns(n,pz.solution[q.id])})).sort((a,b)=>a.cost-b.cost||a.k-b.k);
    const take=Math.max(1,Math.min(pz.pairs.length-1,Math.floor(pz.pairs.length/2)));
    return ranked.slice(0,take).map(x=>x.k).sort((a,b)=>a-b);
  }
  function auto(pz){
    const st=create(pz),easy=easyPairs(pz);
    for(const k of easy)st.paths[k]=pz.solution[k].slice();
    const ev=evaluate(pz,st),open=pz.pairs.filter(q=>!easy.includes(q.id)).map(q=>q.id);
    return {state:st,easy,open,evaluation:ev,
      nearMiss:`Skip linked only the ${easy.length} easy pair${easy.length===1?'':'s'}; ${open.map(k=>label(pz,k)).slice(0,2).join(' and ')}${open.length>2?` and ${open.length-2} more`:''} needed the long winding routes.`};
  }
  // Near-miss: which line blocked the solution. With a unique solution, any completed line that differs from it makes
  // a full board impossible; name the pair whose route it occupied.
  function nearMiss(pz,st){
    const ev=evaluate(pz,st);if(ev.solved)return '';
    const owner=new Int16Array(pz.size*pz.size).fill(-1);pz.solution.forEach((p,k)=>{for(const c of p)owner[c]=k;});
    let best=null;
    st.paths.forEach((p,d)=>{
      if(!p.length||correct(pz,st,d))return;
      const hits={};for(const c of p)if(owner[c]!==d&&owner[c]>=0)hits[owner[c]]=(hits[owner[c]]||0)+1;
      for(const [e,cnt] of Object.entries(hits)){
        const score=(ev.connected[+e]?0:100)+(ev.connected[d]?50:0)+cnt;
        if(!best||score>best.score)best={d,e:+e,score};
      }
    });
    if(best){
      const {d,e}=best,sd=pz.pairs[d].synergy,se=pz.pairs[e].synergy,longer=st.paths[d].length>pz.solution[d].length;
      const how=!ev.connected[d]?'unfinished line cut across':longer?'link took the long way round and sealed off':'link cut across';
      return `Your ${sd.from} → ${sd.to} ${how} ${se.from}’s route to ${se.to}.`;
    }
    if(ev.allConnected){
      const empty=new Set();const cover=owners(pz,st);for(let i=0;i<cover.length;i++)if(cover[i]===-1)empty.add(i);
      let k=0,most=-1;pz.solution.forEach((p,j)=>{const c=p.filter(x=>empty.has(x)).length;if(c>most){most=c;k=j;}});
      return `All ${ev.pairs} links connected, but ${ev.empty} cell${ev.empty===1?'':'s'} stayed empty: ${label(pz,k)} should have run through them.`;
    }
    const open=pz.pairs.filter(q=>!ev.connected[q.id]);
    const closest=open.map(q=>({k:q.id,got:st.paths[q.id].filter(c=>pz.solution[q.id].includes(c)).length})).sort((a,b)=>b.got-a.got||a.k-b.k)[0];
    return `${open.length} link${open.length===1?'':'s'} left open; ${label(pz,closest.k)} was the closest to joining up.`;
  }
  function output(pz,st){
    const ev=evaluate(pz,st),on=pz.pairs.filter(q=>ev.connected[q.id]);
    return on.length?on.map(q=>caption(pz,q.id)).join('; '):'No synergies active';
  }
  function activeSynergies(pz,st){const ev=evaluate(pz,st);return pz.pairs.filter(q=>ev.connected[q.id]).map(q=>({pair:q.id,...q.synergy}));}

  const api={DIFFICULTIES,CREW,SYNERGIES,COLORS,ASSISTS,neighbours,adjacent,turns,straight3,solveGrid,partition,generate,create,clone,
    endpointMap,partnerOf,isConnected,owners,strokePath,validate,apply,cutsBy,evaluate,tier,score,solve,samePath,correct,label,caption,
    liveEnds,deadCells,routes,connectable,forcedLink,autoFinish,hint,easyPairs,auto,nearMiss,output,activeSynergies};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.SynergyLinks=api;
})(typeof globalThis==='object'?globalThis:this);
