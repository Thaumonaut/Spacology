// Depot sorting (Logistics day mini-game): a cargo take on water-sort / ball-sort. Pure rules, no DOM.
// The depot has bays (columns). Each bay holds a stack of up to `cap` crates; there are `cap` crates of every cargo
// type. One rule: lift the run of matching crates on top of a bay and drop it on an empty bay or on a crate of the
// same type; as many as fit move (the rest stay), exactly as liquid pours in water-sort. A bay that holds all `cap`
// crates of one type is full and sorted. The goal: every type gathered into one full bay, with nothing left over.
// Logistics twist, no new mechanics: from Normal up, some bays are loading bays that must end holding a given type
// (tonight's production draws from them); from Hard up there is a one-crate hold bay, a buffer that must end empty.
// A full bay in its right place (a loading bay with its type, or a plain bay whose type has no loading bay) is sealed
// with a stamp and locked. The fragile-crate idea for Expert is left out: crates only ever land on their own type, so a
// "never under heavy crates" rule could only matter for the starting layout and would add a variable without a choice.
// State: an array of bays, each an array of type ids (bottom first). Layout: P.bays[i] = {kind:'plain'|'load'|'hold',
// cap, want} where want is the type a loading bay needs. Par is the optimal move count from A* with an admissible
// lower bound (proven optimal for every generated puzzle; generation drops a seed whose search would exceed its node
// budget). Loads as a classic script (window.DepotSorting) or with require() in Node.
(function(root){
  'use strict';
  const Kit=typeof module==='object'&&module.exports&&typeof require==='function'?require('../../shared/minigames/minigame-kit.js'):root.MiniGameKit;

  const TYPES=[
    {id:'ore',label:'Ore',plural:'ore',color:'#d0805a',feeds:'refinery'},
    {id:'plates',label:'Plates',plural:'plates',color:'#9fb3c4',feeds:'workshop'},
    {id:'cells',label:'Cells',plural:'cells',color:'#6fc8e8',feeds:'power plant'},
    {id:'parts',label:'Parts',plural:'parts',color:'#e7c18b',feeds:'workshop'},
    {id:'kits',label:'Gear kits',plural:'gear kits',color:'#8fd18a',feeds:'armoury'},
    {id:'samples',label:'Samples',plural:'samples',color:'#b49cf0',feeds:'lab'},
    {id:'fuel',label:'Fuel',plural:'fuel',color:'#f0909a',feeds:'launch pad'},
    {id:'rations',label:'Rations',plural:'rations',color:'#e9e08a',feeds:'galley'}
  ];
  // types: cargo types; cap: crates per bay and per type; spare: empty plain bays; load: loading bays; hold: a
  // one-crate buffer; minPar/maxPar: accepted optimal lengths; budget: Expert's move budget is ceil(par × 1.4).
  const DIFFICULTIES=[
    {id:'easy',label:'Quiet shift · 4 types',types:4,cap:4,spare:2,load:0,hold:false,minPar:7,maxPar:14,target:60},
    {id:'normal',label:'Busy shift · 5 types',types:5,cap:4,spare:2,load:2,hold:false,minPar:9,maxPar:18,target:90},
    {id:'hard',label:'Rush hour · 6 types',types:6,cap:4,spare:1,load:3,hold:true,minPar:11,maxPar:24,target:120},
    {id:'expert',label:'Convoy day · 6 types, 5 high',types:6,cap:5,spare:1,load:3,hold:true,minPar:13,maxPar:30,target:150,budget:1.4}
  ];
  const ASSIST_LEVELS=[
    {id:'puzzle',label:'Puzzle',note:'Plan every move yourself. Perfect is possible.'},
    {id:'guided',label:'Guided',note:'A lifted stack lights the bays it can drop on. Perfect is still possible.'},
    {id:'relaxed',label:'Relaxed',note:'Guided, plus obvious finishing moves play themselves in a cascade. Scored Good at best.'}
  ];
  const difficulty=id=>DIFFICULTIES.find(d=>d.id===id)||DIFFICULTIES[0];
  const NODE_BUDGET=60000;

  // ---------- Board basics ----------
  const clone=s=>s.map(b=>b.slice());
  const top=b=>b.length?b[b.length-1]:-1;
  function runLength(b){if(!b.length)return 0;const t=b[b.length-1];let k=1;while(k<b.length&&b[b.length-1-k]===t)k++;return k;}
  const pure=b=>b.length>0&&runLength(b)===b.length;
  const full=(P,s,i)=>s[i].length===P.cap&&pure(s[i])&&P.bays[i].kind!=='hold';
  // Right place: a loading bay holding its type, or a plain bay holding a type no loading bay wants.
  const rightPlace=(P,i,t)=>P.bays[i].kind==='load'?P.bays[i].want===t:P.bays[i].kind==='plain'&&!P.wanted.has(t);
  const sealed=(P,s,i)=>full(P,s,i)&&rightPlace(P,i,s[i][0]);
  const sealedCount=(P,s)=>s.reduce((n,b,i)=>n+(sealed(P,s,i)?1:0),0);
  function solved(P,s){
    for(let i=0;i<s.length;i++){
      const b=s[i];if(!b.length)continue;
      if(P.bays[i].kind==='hold'||!full(P,s,i))return false;
      if(P.bays[i].kind==='load'&&P.bays[i].want!==b[0])return false;
    }
    for(const i of P.loads)if(!s[i].length)return false;
    return true;
  }

  // Why a move is not allowed, or '' when it is. Moves are {from,to}; the count that moves is derived.
  function illegal(P,s,m){
    const {from,to}=m||{};
    if(!Number.isInteger(from)||!Number.isInteger(to)||!s[from]||!s[to])return 'No such bay.';
    if(from===to)return 'Pick a different bay.';
    const a=s[from],b=s[to];
    if(!a.length)return 'That bay is empty.';
    if(sealed(P,s,from))return 'That bay is sealed for tonight.';
    if(b.length>=P.bays[to].cap)return 'That bay is full.';
    if(b.length&&top(b)!==top(a))return `Only ${TYPES[top(a)].plural} can go on ${TYPES[top(a)].plural}.`;
    return '';
  }
  const amount=(P,s,m)=>Math.min(runLength(s[m.from]),P.bays[m.to].cap-s[m.to].length);
  // Applies a move; returns {ok,state,count,reason}. An invalid move returns the same state object untouched.
  function apply(P,s,m){
    const reason=illegal(P,s,m);if(reason)return {ok:false,state:s,count:0,reason};
    const n=amount(P,s,m),next=s.slice();
    next[m.from]=s[m.from].slice(0,s[m.from].length-n);
    next[m.to]=s[m.to].concat(Array(n).fill(top(s[m.from])));
    return {ok:true,state:next,count:n,type:top(s[m.from]),reason:''};
  }
  function legalMoves(P,s){
    const out=[];
    for(let f=0;f<s.length;f++){
      if(!s[f].length||sealed(P,s,f))continue;
      for(let t=0;t<s.length;t++)if(t!==f&&!illegal(P,s,{from:f,to:t}))out.push({from:f,to:t});
    }
    return out;
  }
  const targets=(P,s,from)=>s.map((b,t)=>t).filter(t=>t!==from&&!illegal(P,s,{from,to:t}));

  // ---------- Solver: A* over canonical states ----------
  // Plain bays are interchangeable, so the key sorts them; loading bays and the hold keep their places.
  function key(P,s){
    const plain=[],fixed=[];
    for(let i=0;i<s.length;i++){const k=s[i].join(',');(P.bays[i].kind==='plain'?plain:fixed).push(k);}
    plain.sort();return fixed.join('|')+'#'+plain.join('|');
  }
  // Admissible lower bound: one move per extra run in a bay (a run must leave), every run of a loading bay whose bottom
  // is the wrong type, one for a busy hold, and for each type one per extra bay with it at the bottom (all but one of
  // those bottom runs must move). A single move lowers this by at most one, so A* with it returns optimal lengths.
  function lower(P,s){
    let h=0;const bottoms=new Array(P.types).fill(0);
    for(let i=0;i<s.length;i++){
      const b=s[i];if(!b.length)continue;
      let runs=1;for(let k=1;k<b.length;k++)if(b[k]!==b[k-1])runs++;
      const kind=P.bays[i].kind;
      if(kind==='hold'){h+=1;continue;}
      if(kind==='load'&&P.bays[i].want!==b[0]){h+=runs;continue;}
      h+=runs-1;bottoms[b[0]]++;
    }
    for(const c of bottoms)if(c>1)h+=c-1;
    return h;
  }
  // Binary min-heap on [f, -g, seq] so ties prefer deeper nodes, then insertion order (deterministic).
  function heap(){
    const a=[];const less=(x,y)=>x.f!==y.f?x.f<y.f:x.g!==y.g?x.g>y.g:x.seq<y.seq;
    return {get size(){return a.length;},
      push(n){a.push(n);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(!less(a[i],a[p]))break;[a[i],a[p]]=[a[p],a[i]];i=p;}},
      pop(){const t=a[0],l=a.pop();if(a.length){a[0]=l;let i=0;for(;;){const L=2*i+1,R=L+1;let m=i;if(L<a.length&&less(a[L],a[m]))m=L;if(R<a.length&&less(a[R],a[m]))m=R;if(m===i)break;[a[i],a[m]]=[a[m],a[i]];i=m;}}return t;}};
  }
  // solve(P, state, {budget, weight}) → {moves:[{from,to}], optimal, nodes} or {moves:null, exhausted} when no route
  // exists (exhausted:true means the search space ran out: a proven dead end) or the node budget ran out. weight > 1
  // trades optimality for speed (weighted A*), used as a fallback for hints from messy mid-game states.
  function solve(P,s,opts){
    const budget=(opts&&opts.budget)||NODE_BUDGET,w=(opts&&opts.weight)||1,limit=opts&&opts.limit;
    if(solved(P,s))return {moves:[],optimal:true,nodes:0};
    const open=heap(),best=new Map();let seq=0,nodes=0;
    const k0=key(P,s);best.set(k0,0);
    open.push({s,g:0,f:w*lower(P,s),seq:seq++,parent:null,move:null,k:k0});
    while(open.size){
      const n=open.pop();
      if(best.get(n.k)<n.g)continue;
      if(solved(P,n.s)){const moves=[];for(let x=n;x.parent;x=x.parent)moves.push(x.move);moves.reverse();return {moves,optimal:w===1,nodes};}
      if(++nodes>budget)return {moves:null,exhausted:false,nodes};
      if(limit!=null&&n.g>=limit)continue;
      for(const m of legalMoves(P,n.s)){
        const r=apply(P,n.s,m),k=key(P,r.state),g=n.g+1;
        if(best.has(k)&&best.get(k)<=g)continue;
        best.set(k,g);open.push({s:r.state,g,f:g+w*lower(P,r.state),seq:seq++,parent:n,move:m,k});
      }
    }
    return {moves:null,exhausted:true,nodes};
  }
  // Best route from a state: optimal A* first, then a weighted search if the exact one hits its budget.
  function route(P,s,opts){
    let r=solve(P,s,opts);
    if(!r.moves&&!r.exhausted)r=solve(P,s,{...opts,weight:2,budget:(opts&&opts.budget)||NODE_BUDGET});
    if(!r.moves&&!r.exhausted)r=solve(P,s,{...opts,weight:5,budget:(opts&&opts.budget)||NODE_BUDGET});
    return r;
  }

  // ---------- Generation ----------
  // Random fill: cap crates of each type shuffled across the first `types` plain-or-load bays; spare bays and the hold
  // start empty. Bays and loading targets are drawn from the same seed. A layout is kept when no bay starts sorted,
  // the exact solver proves its optimal length inside [minPar, maxPar] within the node budget.
  function generate(seed,diffId){
    const d=difficulty(diffId),salt=Kit.hashSeed(d.id);
    const rng=Kit.rng(((Number(seed)>>>0)^salt)>>>0);
    for(let attempt=0;attempt<400;attempt++){
      const nBays=d.types+d.spare;
      const bays=[];for(let i=0;i<nBays;i++)bays.push({kind:'plain',cap:d.cap,want:-1});
      const loadIdx=rng.shuffle([...Array(nBays).keys()]).slice(0,d.load).sort((a,b)=>a-b);
      const wants=rng.shuffle([...Array(d.types).keys()]).slice(0,d.load);
      loadIdx.forEach((i,k)=>{bays[i].kind='load';bays[i].want=wants[k];});
      if(d.hold)bays.push({kind:'hold',cap:1,want:-1});
      const filled=rng.shuffle([...Array(nBays).keys()]).slice(0,d.types).sort((a,b)=>a-b);
      const crates=rng.shuffle([].concat(...[...Array(d.types).keys()].map(t=>Array(d.cap).fill(t))));
      const state=bays.map(()=>[]);filled.forEach((b,k)=>{state[b]=crates.slice(k*d.cap,(k+1)*d.cap);});
      const P={seed:Number(seed)>>>0,difficulty:d.id,types:d.types,cap:d.cap,bays,loads:loadIdx,wanted:new Set(wants),start:state,par:0,budget:null};
      // No bay may start with three or more of one type on its floor, so every bay needs work.
      if(state.some(b=>b.length&&b.slice(0,3).every(t=>t===b[0])))continue;
      const r=solve(P,state,{budget:NODE_BUDGET});
      if(!r.moves||!r.optimal)continue;
      if(r.moves.length<d.minPar||r.moves.length>d.maxPar)continue;
      P.par=r.moves.length;P.solution=r.moves;P.attempts=attempt+1;
      P.budget=d.budget?Math.ceil(P.par*d.budget):null;
      return P;
    }
    throw new Error('No depot layout for seed '+seed+' at '+d.id);
  }

  // ---------- Names ----------
  const bayName=(P,i)=>P.bays[i].kind==='hold'?'the hold':`bay ${P.bays.slice(0,i+1).filter(b=>b.kind!=='hold').length}`;
  const plural=(n,t)=>`${n} ${n===1&&TYPES[t].plural.endsWith('s')?TYPES[t].plural.slice(0,-1):TYPES[t].plural}`;
  const moveText=(P,s,m)=>{const n=amount(P,s,m),t=top(s[m.from]);return `${plural(n,t)} from ${bayName(P,m.from)} to ${bayName(P,m.to)}`;};

  // ---------- Relaxed: obvious finishing moves ----------
  // A finishing move gathers a type into its home and the gathering ends with that bay sealed: the home is a bay of only
  // that type in the type's right place (its loading bay, or a plain bay when no loading bay wants it), and every other
  // crate of the type sits in a run on top of some bay, so the whole set can drop in, run after run. Gathering only
  // toward a seal is what keeps it safe: half-gathering can spend the empty bay a plan needed. Nothing ever goes into an
  // empty bay or the hold. The largest home wins (fewest moves), then the lowest bay; every step seals or nears a seal,
  // so a cascade terminates.
  function obvious(P,s){
    let best=null;
    for(let t=0;t<s.length;t++){
      const b=s[t];if(!pure(b)||P.bays[t].kind==='hold'||!rightPlace(P,t,b[0])||b.length>=P.cap||sealed(P,s,t))continue;
      const type=b[0];let onTop=b.length,first=null;
      for(let f=0;f<s.length;f++){
        if(f===t||!s[f].length)continue;
        const count=s[f].filter(x=>x===type).length;if(!count)continue;
        if(top(s[f])!==type||runLength(s[f])!==count){onTop=-1;break;}
        onTop+=count;if(first===null)first=f;
      }
      if(onTop!==P.cap||first===null)continue;
      if(!best||b.length>s[best.to].length)best={from:first,to:t};
    }
    return best;
  }
  function cascade(P,s,limit){
    const steps=[];let cur=s;
    for(let k=0;k<(limit||64);k++){const m=obvious(P,cur);if(!m)break;const r=apply(P,cur,m);steps.push({move:m,state:r.state,count:r.count,type:r.type});cur=r.state;}
    return {state:cur,steps};
  }

  // ---------- Hints ----------
  // Why the next move on a best route helps, in a few words.
  function reason(P,s,m){
    const r=apply(P,s,m),t=r.type,T=TYPES[t];
    if(sealed(P,r.state,m.to))return `seals ${bayName(P,m.to)} with all the ${T.plural}${P.bays[m.to].kind==='load'?' for tonight':''}.`;
    if(P.bays[m.from].kind==='hold')return `frees the hold.`;
    if(!r.state[m.from].length)return `empties ${bayName(P,m.from)} for a new stack.`;
    if(P.bays[m.to].kind==='hold')return `parks one crate in the hold to free the ${TYPES[top(r.state[m.from])].plural} beneath it.`;
    if(P.bays[m.from].kind==='load'&&P.bays[m.from].want!==s[m.from][0])return `clears ${bayName(P,m.from)} for the ${TYPES[P.bays[m.from].want].plural} it must end with.`;
    if(s[m.to].length)return `joins the ${T.plural} together.`;
    const under=top(r.state[m.from]);
    return `uncovers the ${TYPES[under].plural} in ${bayName(P,m.from)}.`;
  }
  // hint(P, state, history) where history is the list of earlier states (oldest first, not including `state`), and
  // movesLeft the Expert budget still to spend (null when there is none). Returns
  // {kind:'move', move, reason, text, remaining} for the next move on a best route,
  // {kind:'undo', steps, text} when no route finishes from here (or not within the budget), or {kind:'none'}.
  function hint(P,s,history,movesLeft){
    const ok=r=>r.moves&&(movesLeft==null||r.moves.length<=movesLeft);
    const r=route(P,s);
    if(solved(P,s))return {kind:'none',text:'The depot is already sorted.'};
    if(ok(r)){const m=r.moves[0];return {kind:'move',move:m,remaining:r.moves.length,optimal:r.optimal,reason:reason(P,s,m),
      text:`Move ${moveText(P,s,m)}: it ${reason(P,s,m)}`};}
    const past=history||[];
    for(let k=past.length-1;k>=0;k--){
      const left=movesLeft==null?null:movesLeft+(past.length-k);
      const back=route(P,past[k]);
      if(back.moves&&(left==null||back.moves.length<=left)){
        const steps=past.length-k;
        return {kind:'undo',steps,text:`Undo ${steps} step${steps===1?'':'s'}: ${r.moves?'no route finishes within the move budget':'no route finishes'} from here.`};
      }
    }
    return {kind:'undo',steps:past.length,text:'Undo back to the start: no route finishes from here.'};
  }

  // ---------- Scoring, near-miss, auto fallback, output ----------
  // moves is the net path length on the board (undo gives moves back). Perfect: sorted within par, no hints, not at
  // Relaxed. Good: sorted. Partial: half the types sealed at least (only reachable when Expert's budget runs out).
  // Score: 100 for Perfect; a solve loses 4 per move over par and 8 per hint, floored at 55, capped at 90 when not
  // Perfect; Partial 25–45 by sealed share; Failed 5 per sealed bay; the auto fallback is a flat 35.
  function score(r){
    const types=r.types||1,sealedN=r.sealed||0;
    if(r.auto)return {tier:'auto',score:35};
    if(r.solved){
      if(r.moves<=r.par&&!r.hints&&r.assist!=='relaxed')return {tier:'perfect',score:100};
      return {tier:'good',score:Math.max(55,Math.min(90,100-4*Math.max(0,r.moves-r.par)-8*(r.hints||0)-(r.assist==='relaxed'?10:0)))};
    }
    if(sealedN>=Math.ceil(types/2))return {tier:'partial',score:Math.round(25+20*sealedN/types)};
    return {tier:'failed',score:5*sealedN};
  }
  // The played move that cost the most: extra = 1 + dist(after) − dist(before), a dead end counting as the worst.
  // states: every board from the start to now (states[k+1] = after moves[k]). Returns '' when nothing was wasted or the
  // time cap runs out.
  function nearMiss(P,states,moves,opts){
    const cap=(opts&&opts.ms)||1500,t0=Date.now(),dist=[];
    for(let k=0;k<states.length;k++){
      if(Date.now()-t0>cap)return '';
      const r=solve(P,states[k],{budget:20000});dist.push(r.moves?r.moves.length:(r.exhausted?Infinity:null));
    }
    let worst=-1,extra=0;
    for(let k=0;k<moves.length;k++){
      if(dist[k]==null||dist[k+1]==null||dist[k]===Infinity)continue;
      const e=dist[k+1]===Infinity?Infinity:1+dist[k+1]-dist[k];
      if(e>extra){extra=e;worst=k;}
    }
    if(worst<0)return '';
    const m=moves[worst],before=states[worst],better=route(P,before),alt=better.moves&&better.moves[0];
    const what=`Move ${worst+1} (${moveText(P,before,m)})`;
    const instead=alt?` A best route moved ${moveText(P,before,alt)} instead.`:'';
    return extra===Infinity?`${what} led into a dead end.${instead}`:`${what} cost ${extra} extra move${extra===1?'':'s'}.${instead}`;
  }
  // Skip: the yard crew follows a best route from the current board but only until half the types are sealed; the rest
  // waits for tomorrow. Returns the moves played and the board they leave.
  function autoFallback(P,s){
    const r=route(P,s),goal=Math.ceil(P.types/2),played=[];let cur=s;
    if(r.moves)for(const m of r.moves){if(sealedCount(P,cur)>=goal)break;const x=apply(P,cur,m);played.push({move:m,state:x.state,count:x.count,type:x.type});cur=x.state;}
    return {moves:played,state:cur,sealed:sealedCount(P,cur)};
  }
  // "Depot sorted: 4 bays ready for tonight's refinery and workshop."
  function output(P,s,prefix){
    const types=s.map((b,i)=>sealed(P,s,i)?b[0]:-1).filter(t=>t>=0);
    const feeds=[...new Set(types.map(t=>TYPES[t].feeds))];
    const list=feeds.length<=1?feeds.join(''):feeds.slice(0,-1).join(', ')+' and '+feeds[feeds.length-1];
    return `${prefix||'Depot sorted'}: ${types.length} bay${types.length===1?'':'s'} ready for tonight’s ${list||'production'}.`;
  }

  const api={TYPES,DIFFICULTIES,ASSIST_LEVELS,NODE_BUDGET,difficulty,clone,top,runLength,pure,full,rightPlace,sealed,sealedCount,solved,
    illegal,amount,apply,legalMoves,targets,key,lower,solve,route,generate,bayName,moveText,obvious,cascade,reason,hint,score,nearMiss,autoFallback,output};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DepotSorting=api;
})(typeof globalThis==='object'?globalThis:this);
