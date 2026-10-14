// Core assay (Research, day): spectrum decomposition as a deduction puzzle. Pure rules, no DOM.
// A core sample's reading is a spectrum over C channels. Each reference mineral in the round's library has 2–4 peaks at
// fixed channels with fixed heights per unit. The sample is a mix: each mineral at an integer amount 0–3, and the reading
// is the sum of amount × height on every channel. The player works out every amount; the guess is drawn over the
// reading with the residual (reading − guess) below it, so they see the consequence of a guess, never the answer.
// Hard and Expert add ±1 noise on every channel (the tolerance band): a channel matches when |reading − guess| ≤ 1.
// Expert adds exactly one stray peak per sample, a contaminant no mineral explains, which must be flagged.
//
// Guarantees (checked by tests/unit/core-assay.cjs):
// - Every sample is solved by the sound single-channel deduction solver below, which proves the answer unique; the
//   exhaustive counter agrees.
// - Construction gives a deduction chain: the first mineral in a hidden order has a unique peak, and each later mineral
//   has a "key" channel whose other contributors all come earlier in the order. On Hard and Expert most later minerals
//   have no unique peak at all, so a shared-channel step ("channel 30 says brine is 2, so channel 12 says quartz is 1")
//   is needed.
// - Expert strays sit on a channel no mineral uses, or one used only by minerals absent from that sample whose other
//   peaks read flat, so the stray is provable before any other reading is trusted.
// Loads as a classic script (window.CoreAssay) or with require() in Node.
(function(root){
  'use strict';
  const Kit=typeof module==='object'&&module.exports&&typeof require==='function'?require('./minigame-kit.js'):root.MiniGameKit;

  // unique: how many minerals (in the hidden deduction order) get a unique key channel; the rest are chained onto a
  // channel shared with earlier minerals. extraUnique: whether chained minerals may also get a unique extra peak.
  const DIFFICULTIES=[
    {id:'easy',label:'Surface core · 4 minerals',minerals:4,channels:24,samples:2,heights:[1,3],noise:0,stray:false,present:[2,3],unique:4,extraUnique:true,target:45},
    {id:'normal',label:'Ridge core · 5 minerals',minerals:5,channels:28,samples:3,heights:[1,3],noise:0,stray:false,present:[2,3],unique:3,extraUnique:true,target:60},
    {id:'hard',label:'Deep core · 6 minerals, noise',minerals:6,channels:32,samples:3,heights:[3,5],noise:1,stray:false,present:[2,4],unique:2,extraUnique:false,target:90},
    {id:'expert',label:'Null core · 8 minerals, noise, stray',minerals:8,channels:36,samples:4,heights:[3,5],noise:1,stray:true,present:[3,4],unique:2,extraUnique:false,target:120}
  ];
  const TESTS=3,MAX_AMOUNT=3,AMOUNTS=[0,1,2,3];
  const MINERALS=[
    {id:'plate',name:'Plate ore',resource:'ore',icon:'▰',color:'#e39b62',rare:false},
    {id:'crystal',name:'Crystal bloom',resource:'crystal',icon:'✦',color:'#7fd6f0',rare:false},
    {id:'brine',name:'Salt brine',resource:'water',icon:'≈',color:'#6a95ff',rare:false},
    {id:'salvage',name:'Salvage alloy',resource:'salvage',icon:'⊞',color:'#b9c2cc',rare:false},
    {id:'frost',name:'Frost seam',resource:'water',icon:'✲',color:'#e6f2ff',rare:false},
    {id:'ember',name:'Ember sulphur',resource:'ore',icon:'▲',color:'#f1d06a',rare:false},
    {id:'quartz',name:'Aether quartz',resource:'aether',icon:'◈',color:'#c995ff',rare:true},
    {id:'null',name:'Null-glass',resource:'null',icon:'◇',color:'#ff73b0',rare:true}
  ];
  const SITES=['Ash ridge','Glass flats','Brine hollow','Cinder shelf','Hollow spur','Tide scar','Quiet basin','Rust mesa','Echo fault','Pale terrace','Drift saddle','Vane gulch'];
  const ASSIST_LEVELS=[
    {id:'puzzle',label:'Puzzle',note:'No help. Perfect is possible.'},
    {id:'guided',label:'Guided',note:'Unique peaks are starred in the library and on the chart.'},
    {id:'relaxed',label:'Relaxed',note:'Single-mineral peaks fill in at the start, and each amount you set drops in whatever it directly forces. Never Perfect.'}
  ];
  const RICHNESS=['trace','thin','rich','deep'];
  const SCORE_BY_TEST=[100,70,45],HINT_COST=20,AUTO_SAMPLE=40,RELAXED_FACTOR=0.75;

  const difficulty=id=>DIFFICULTIES.find(d=>d.id===id)||DIFFICULTIES[0];
  const ch=c=>c+1; // channels are shown 1-based
  const matches=(obs,g,tol)=>Math.abs(obs-g)<=tol;

  // byChannel[c] = [{m,h}] for every library mineral with a peak on channel c.
  function channelMap(library,C){
    const by=Array.from({length:C},()=>[]);
    library.forEach((M,m)=>M.peaks.forEach(p=>by[p.ch].push({m,h:p.h})));
    return by;
  }
  // Channels on which only this mineral peaks: the "way in" that Guided highlights.
  function uniquePeaks(P,m){return P.library[m].peaks.filter(p=>P.byChannel[p.ch].length===1).map(p=>p.ch);}

  // ---------- Library ----------
  function buildLibrary(R,d){
    const C=d.channels,[hlo,hhi]=d.heights;
    let pool;
    if(d.minerals>=MINERALS.length)pool=MINERALS.slice();
    else{
      const commons=R.shuffle(MINERALS.filter(M=>!M.rare)),rares=R.shuffle(MINERALS.filter(M=>M.rare));
      const nRare=d.id==='easy'?0:d.id==='normal'?1:2;
      pool=rares.slice(0,nRare).concat(commons.slice(0,d.minerals-nRare));
    }
    const order=R.shuffle(pool.map((_,i)=>i)); // hidden deduction order: rank[i] = position in the chain
    const rank=[];order.forEach((i,k)=>rank[i]=k);
    const peaks=pool.map(()=>[]),onCh=Array.from({length:C},()=>[]),keyOf=new Array(C).fill(-1); // keyOf[c]=rank owning c as key
    const used=c=>onCh[c].length>0;
    const fresh=()=>{
      const all=[];for(let c=1;c<C-1;c++)if(!used(c))all.push(c);
      const spaced=all.filter(c=>!used(c-1)&&!used(c+1));
      const list=spaced.length?spaced:all;return list.length?R.pick(list):-1;
    };
    const add=(i,c)=>{const h=R.range(hlo,hhi);peaks[i].push({ch:c,h});onCh[c].push(i);};
    const uniqueSet=new Set();
    for(let k=0;k<order.length;k++){
      const i=order[k];
      if(k<d.unique){const c=fresh();add(i,c);keyOf[c]=k;uniqueSet.add(i);}
      else{
        // Chained key: a fresh channel shared with one (sometimes two) earlier minerals.
        const roomy=order.slice(0,k).filter(j=>peaks[j].length<3),c=fresh(),js=R.shuffle(roomy.length?roomy:order.slice(0,k)).slice(0,R.chance(0.3)&&k>=2?2:1);
        for(const j of js)add(j,c);add(i,c);keyOf[c]=k;
      }
    }
    // Extra peaks up to 2–4 per mineral. A mineral of rank r may join channel c only if c is not the key of an earlier
    // rank (that would break the chain), and it may open a fresh unique channel only where the difficulty allows.
    for(const i of R.shuffle(pool.map((_,i)=>i))){
      const want=R.range(2,d.id==='easy'?3:4);
      let guard=0;
      while(peaks[i].length<want&&guard++<40){
        const r=rank[i],mayUnique=uniqueSet.has(i)||d.extraUnique;
        const joinable=[];for(let c=1;c<C-1;c++)if(used(c)&&!onCh[c].includes(i)&&(keyOf[c]<0||keyOf[c]>=r)&&onCh[c].length<3)joinable.push(c);
        if(mayUnique&&(R.chance(0.5)||!joinable.length)){const c=fresh();if(c>=0){add(i,c);continue;}}
        if(joinable.length&&R.chance(0.75))add(i,R.pick(joinable));
        else{ // a fresh shared (non-key) channel with another mineral
          const c=fresh(),j=R.pick(pool.map((_,x)=>x).filter(x=>x!==i&&peaks[x].length<4));
          if(c>=0&&j!==undefined){add(i,c);add(j,c);}else if(joinable.length)add(i,R.pick(joinable));else break;
        }
      }
    }
    return pool.map((M,i)=>({...M,peaks:peaks[i].slice().sort((a,b)=>a.ch-b.ch)}));
  }

  // ---------- Spectra ----------
  function mix(P,amounts){
    const out=new Array(P.channels).fill(0);
    P.library.forEach((M,m)=>{const a=amounts[m]||0;if(a)for(const p of M.peaks)out[p.ch]+=a*p.h;});
    return out;
  }
  function residual(P,si,amounts){const g=mix(P,amounts),o=P.samples[si].obs;return o.map((v,c)=>v-g[c]);}
  // Per-channel state for the residual strip: match, over (guess too high), under (guess too low), flag (the channel
  // the player flagged as the stray: shown as "stray" when the reading really exceeds the guess, else "badflag").
  function channelStates(P,si,amounts,flag){
    const r=residual(P,si,amounts),tol=P.tol;
    return r.map((v,c)=>c===flag?(v>tol?'stray':'badflag'):Math.abs(v)<=tol?'match':v>0?'under':'over');
  }
  // Every channel accounted for: in band, plus (Expert) a flag on a channel that really is unexplained.
  function flatline(P,si,amounts,flag){
    const st=channelStates(P,si,amounts,flag);
    return st.every(s=>s==='match'||s==='stray')&&(!P.stray||st.includes('stray'));
  }

  // ---------- Deduction solver (sound: every pruning uses the exact acceptance rule) ----------
  // Domains start at {0,1,2,3}. A channel step keeps only values that some combination of the channel's undetermined
  // contributors supports. Channels with the fewest undetermined contributors go first, then the lowest channel. On
  // Expert, until the stray is found only upper bounds are used (a stray only ever adds), and a channel whose reading
  // exceeds anything its minerals could still produce is the stray. After that, every other channel is trusted.
  function solve(P,si){
    const s=P.samples[si],L=P.library.length,C=P.channels,tol=P.tol,by=P.byChannel;
    const dom=Array.from({length:L},()=>AMOUNTS.slice());
    let stray=P.stray?undefined:null;const steps=[];
    const det=m=>dom[m].length===1;
    for(let guard=0;guard<400;guard++){
      if(stray===undefined){
        let found=-1;
        for(let c=0;c<C&&found<0;c++){const max=by[c].reduce((t,{m,h})=>t+h*Math.max(...dom[m]),0);if(s.obs[c]-tol>max)found=c;}
        if(found>=0){stray=found;steps.push({kind:'stray',channel:found,level:by[found].length?1:0,reason:strayReason(P,si,found,dom)});continue;}
      }
      const upper=stray===undefined;
      const order=[];
      for(let c=0;c<C;c++){if(c===stray)continue;const u=by[c].filter(x=>!det(x.m)).length;if(u&&u<=5)order.push([u,c]);}
      // Before the stray is found, flat channels come first: a channel reading nothing rules out every mineral peaking there.
      const flat=c=>upper&&s.obs[c]<=tol?0:1;
      order.sort((a,b)=>flat(a[1])-flat(b[1])||a[0]-b[0]||a[1]-b[1]);
      let progressed=false;
      for(const [,c] of order){
        const cons=by[c],und=cons.filter(x=>!det(x.m)),known=cons.filter(x=>det(x.m));
        const base=known.reduce((t,{m,h})=>t+h*dom[m][0],0),sup=und.map(()=>new Set());
        const vals=new Array(und.length);
        (function rec(k,sum){
          if(k===und.length){const ok=upper?sum<=s.obs[c]+tol:matches(s.obs[c],sum,tol);if(ok)vals.forEach((v,j)=>sup[j].add(v));return;}
          for(const v of dom[und[k].m]){vals[k]=v;rec(k+1,sum+und[k].h*v);}
        })(0,base);
        const changes=[];
        und.forEach((x,j)=>{const nd=dom[x.m].filter(v=>sup[j].has(v));if(nd.length<dom[x.m].length)changes.push([x,nd]);});
        if(!changes.length)continue;
        for(const [x,nd] of changes){
          if(!nd.length)return {solved:false,contradiction:true,amounts:dom.map(d=>d[0]),stray,steps};
          const level=cons.length===1?0:und.length===1?1:2;
          const step={kind:nd.length===1?'fix':'narrow',channel:c,mineral:x.m,from:dom[x.m].slice(),domain:nd,value:nd.length===1?nd[0]:null,level,upper,
            known:known.map(k=>({m:k.m,h:k.h,a:dom[k.m][0]})),others:und.filter(o=>o.m!==x.m).map(o=>o.m)};
          dom[x.m]=nd;step.reason=stepReason(P,si,step);steps.push(step);
        }
        progressed=true;break;
      }
      if(!progressed)break;
    }
    const solved=dom.every(d=>d.length===1)&&stray!==undefined;
    return {solved,amounts:dom.map(d=>d[0]),stray:stray===undefined?null:stray,steps};
  }
  const nm=(P,m)=>P.library[m].name;
  const reads=(P,v)=>P.tol?`${v} (±${P.tol})`:String(v);
  function stepReason(P,si,st){
    const c=st.channel,o=P.samples[si].obs[c],name=nm(P,st.mineral),h=P.library[st.mineral].peaks.find(p=>p.ch===c).h;
    const of=a=>a===0?`there is no ${name}`:`${name} is ${a}`;
    if(st.upper){
      const max=Math.max(...st.domain);
      return max===0?`Channel ${ch(c)} reads only ${o}: even one unit of ${name} would add ${h} there, so ${of(0)}.`
        :`Channel ${ch(c)} reads only ${o}, so ${name} (${h} per unit there) is at most ${max}.`;
    }
    if(st.level===0)return `Channel ${ch(c)} only shows ${name} (${h} per unit). It reads ${reads(P,o)}, so ${of(st.value??st.domain.join(' or '))}.`;
    if(st.level===1){
      const ks=st.known.filter(k=>k.a>0),sum=ks.reduce((t,k)=>t+k.h*k.a,0);
      const known=st.known.length?st.known.map(k=>`${nm(P,k.m)} at ${k.a}`).join(' and '):'';
      const rest=o-sum;
      const head=`Channel ${ch(c)} is shared by ${[name,...st.known.map(k=>nm(P,k.m))].join(' and ')}. With ${known} giving ${sum}`;
      if(st.value===0)return `${head} and the channel reading ${reads(P,o)}, nothing is left over, so ${of(0)}.`;
      return `${head}, the remaining ${reads(P,rest)} is ${name} at ${h} per unit, so ${of(st.value??st.domain.join(' or '))}.`;
    }
    const names=[name,...st.others.map(m=>nm(P,m))].join(', ');
    return st.value!==null?`Channel ${ch(c)} reads ${reads(P,o)}: of ${names}, only ${name} at ${st.value} can make that add up.`
      :`Channel ${ch(c)} reads ${reads(P,o)}: of ${names}, ${name} can only be ${st.domain.join(' or ')}.`;
  }
  function strayReason(P,si,c,dom){
    const o=P.samples[si].obs[c],cons=P.byChannel[c];
    if(!cons.length)return `Channel ${ch(c)} reads ${o}, but no mineral in the library peaks there: that is the stray peak. Flag it.`;
    return `Channel ${ch(c)} reads ${o}, but only ${cons.map(x=>nm(P,x.m)).join(' and ')} ${cons.length>1?'peak':'peaks'} there, and ${cons.length>1?'they are':'it is'} absent: that is the stray peak. Flag it.`;
  }

  // ---------- Exhaustive count (independent of the solver) ----------
  // DFS over minerals with a running partial spectrum: prune when a channel already exceeds reading + tol; once every
  // contributor of a channel is assigned, check its band. On Expert one complete channel may fail, and only with a
  // positive excess (that is the flag). Returns {count, solutions:[{amounts,stray}]} up to cap.
  function countSolutions(P,si,cap=2){
    const s=P.samples[si],L=P.library.length,C=P.channels,tol=P.tol,by=P.byChannel;
    const last=by.map(cons=>cons.length?Math.max(...cons.map(x=>x.m)):-1);
    const closes=Array.from({length:L+1},()=>[]);last.forEach((m,c)=>closes[m+1].push(c)); // closes[0]: empty channels
    const g=new Array(C).fill(0),a=new Array(L).fill(0),out=[];
    function check(list,bad){
      for(const c of list){if(!matches(s.obs[c],g[c],tol)){if(!P.stray||s.obs[c]-g[c]<=tol)return null;bad=bad.concat(c);if(bad.length>1)return null;}}
      return bad;
    }
    function rec(m,bad){
      if(out.length>=cap)return;
      if(m===L){if(!P.stray?bad.length===0:bad.length===1)out.push({amounts:a.slice(),stray:P.stray?bad[0]:null});return;}
      for(let v=0;v<=MAX_AMOUNT;v++){
        a[m]=v;let over=false;
        for(const p of P.library[m].peaks){g[p.ch]+=v*p.h;if(g[p.ch]>s.obs[p.ch]+tol)over=true;}
        if(!over){const nb=check(closes[m+1],bad);if(nb)rec(m+1,nb);}
        for(const p of P.library[m].peaks)g[p.ch]-=v*p.h;
        if(over)break; // larger amounts only overshoot more
      }
      a[m]=0;
    }
    const b0=check(closes[0],[]);if(b0)rec(0,b0);
    return {count:out.length,solutions:out};
  }

  // ---------- Generation ----------
  function makeSample(R,P,d,taken){
    const L=P.library.length,C=P.channels;
    const n=R.range(d.present[0],d.present[1]),present=R.shuffle([...Array(L).keys()]).slice(0,n);
    const amounts=new Array(L).fill(0);for(const m of present)amounts[m]=R.range(1,MAX_AMOUNT);
    const key=amounts.join('');if(taken.has(key))return null;
    const truth=mix(P,amounts),obs=truth.map(v=>d.noise?Math.max(0,v+R.range(-d.noise,d.noise)):v);
    let stray=null;
    if(d.stray){
      const empty=[],absentOnly=[];
      // A stray on a used channel only where each mineral peaking there has another peak reading flat: "its other peak
      // reads zero, so it is absent, so this peak is the stray" is then a short, crisp proof.
      const flatElsewhere=(x,c)=>P.library[x.m].peaks.some(p=>p.ch!==c&&truth[p.ch]===0);
      for(let c=1;c<C-1;c++){const cons=P.byChannel[c];if(!cons.length)empty.push(c);else if(cons.every(x=>!amounts[x.m]&&flatElsewhere(x,c)))absentOnly.push(c);}
      const list=absentOnly.length&&R.chance(0.5)?absentOnly:empty.length?empty:absentOnly;
      if(!list.length)return null;
      stray=R.pick(list);obs[stray]=Math.max(0,truth[stray]+R.range(3,6)+R.range(-d.noise,d.noise));
    }
    return {amounts,obs,stray,key};
  }
  function generate(seed,diffId){
    const d=difficulty(diffId);
    // Salt 0 is the normal stream; a salted stream only runs if 60 attempts all fail (never seen in 270k test rounds),
    // so the page can never be left without a puzzle.
    for(let salt=0;salt<20;salt++){
    const R=Kit.rng(Kit.hashSeed(`core-assay:${d.id}:${seed}${salt?':'+salt:''}`));
    for(let attempt=0;attempt<60;attempt++){
      const library=buildLibrary(R,d);
      const P={seed:Number(seed),difficulty:d.id,channels:d.channels,tol:d.noise,stray:d.stray,tests:TESTS,library,byChannel:channelMap(library,d.channels),samples:[]};
      // Distinct signatures: no two minerals share the same peak channels.
      const sigs=new Set(library.map(M=>M.peaks.map(p=>p.ch).join(',')));
      if(sigs.size<library.length||library.some(M=>M.peaks.length<2||M.peaks.length>4))continue;
      const taken=new Set(),sites=R.shuffle(SITES);
      for(let k=0;k<d.samples;k++){
        let best=null;
        for(let t=0;t<40;t++){
          const smp=makeSample(R,P,d,taken);if(!smp)continue;
          P.samples.push({site:sites[k],amounts:smp.amounts,obs:smp.obs,stray:smp.stray});
          const S=solve(P,P.samples.length-1);P.samples.pop();
          if(!S.solved)continue;
          const depth=Math.max(0,...S.steps.filter(x=>x.kind==='fix'&&smp.amounts[x.mineral]>0).map(x=>x.level));
          const cand={smp,depth};
          if(!best||depth>best.depth)best=cand;
          if(d.unique>=d.minerals||depth>=1)break; // Hard/Expert look for a sample that needs a shared-channel step
        }
        if(!best)break;
        taken.add(best.smp.key);
        P.samples.push({site:sites[k],amounts:best.smp.amounts,obs:best.smp.obs,stray:best.smp.stray});
      }
      if(P.samples.length===d.samples)return P;
    }
    }
    throw new Error(`core-assay: could not generate ${d.id} seed ${seed}`);
  }

  // ---------- Moves ----------
  // Sample state: {amounts:[null|0..3 per mineral], flag:null|channel}. null means "not set" and counts as 0.
  const empty=P=>({amounts:new Array(P.library.length).fill(null),flag:null});
  function validate(P,st,move){
    if(!move||typeof move!=='object')return 'No move.';
    if(move.type==='amount'){
      if(!Number.isInteger(move.mineral)||move.mineral<0||move.mineral>=P.library.length)return 'No such mineral.';
      if(move.value!==null&&!(Number.isInteger(move.value)&&move.value>=0&&move.value<=MAX_AMOUNT))return 'Amounts run from 0 to 3.';
      return null;
    }
    if(move.type==='flag'){
      if(!P.stray)return 'Only Expert cores carry a stray peak.';
      if(move.channel!==null&&!(Number.isInteger(move.channel)&&move.channel>=0&&move.channel<P.channels))return 'No such channel.';
      return null;
    }
    return 'Unknown move.';
  }
  // apply never mutates st; an invalid move returns {ok:false, state:st} with st untouched.
  function apply(P,st,move){
    const err=validate(P,st,move);if(err)return {ok:false,reason:err,state:st};
    const next={amounts:st.amounts.slice(),flag:st.flag};
    if(move.type==='amount')next.amounts[move.mineral]=move.value;else next.flag=move.channel;
    return {ok:true,state:next};
  }
  // A test submission: exact when every amount equals the answer (unset counts as 0) and, on Expert, the flag sits on
  // the stray. A wrong test says which minerals are wrong (not by how much) and whether the flag is wrong.
  function test(P,si,st){
    const s=P.samples[si],wrong=[];
    st.amounts.forEach((a,m)=>{if((a||0)!==s.amounts[m])wrong.push(m);});
    const flagWrong=!!P.stray&&st.flag!==s.stray;
    return {exact:!wrong.length&&!flagWrong,wrong,flagWrong};
  }

  // ---------- Assists ----------
  // Hint: the next step of the solver's chain the player does not already have right. A stray step comes as a flag.
  function hint(P,si,st){
    const S=solve(P,si),s=P.samples[si];
    for(const step of S.steps){
      if(step.kind==='stray'){if(st.flag!==s.stray)return {kind:'flag',channel:step.channel,reason:step.reason,level:step.level};continue;}
      if(step.kind!=='fix')continue;
      if(st.amounts[step.mineral]!==step.value)return {kind:'amount',mineral:step.mineral,value:step.value,channel:step.channel,reason:step.reason,level:step.level};
    }
    return null;
  }
  // Relaxed: a mineral whose amount one channel forces, given what is already set, fills itself in. One pass, no
  // cascade: at the start of a sample (trigger undefined) that is every single-mineral peak; after a player move
  // (trigger = the mineral just set) only channels where that mineral peaks are read, so each move drops the pieces it
  // directly forces while the chained reasoning stays with the player.
  // Honest about the player's values: a wrong value can force a wrong fill, exactly as the reasoning would. On Expert the
  // stray is auto-flagged only when no library mineral peaks on it, and readings are used only once a flag is placed.
  function relaxedFills(P,si,st,trigger){
    const s=P.samples[si],tol=P.tol,by=P.byChannel,am=st.amounts,fills=[],seen=new Set();let flag=st.flag,flagFill=null;
    if(P.stray&&flag===null){
      const lone=[];for(let c=0;c<P.channels;c++)if(!by[c].length&&s.obs[c]>tol)lone.push(c);
      if(lone.length===1){flag=lone[0];flagFill=flag;}
    }
    if(P.stray&&flag===null)return {fills,flag:null};
    const chans=Number.isInteger(trigger)?P.library[trigger].peaks.map(p=>p.ch):[...Array(P.channels).keys()];
    for(const c of chans){
      if(c===flag)continue;const cons=by[c],un=cons.filter(x=>am[x.m]===null);if(un.length!==1||seen.has(un[0].m))continue;
      const base=cons.reduce((t,x)=>t+(am[x.m]===null?0:am[x.m]*x.h),0),h=un[0].h;
      const vs=AMOUNTS.filter(v=>matches(s.obs[c],base+h*v,tol));
      if(vs.length===1){seen.add(un[0].m);fills.push({mineral:un[0].m,value:vs[0],channel:c});}
    }
    return {fills,flag:flagFill};
  }

  // ---------- Results ----------
  // A sample result: {exact, testsUsed, hints, failed, auto}. Scores per sample: exact on test 1/2/3 = 100/70/45, minus
  // 20 per hint (at least 10), failed = 0, auto = 40. Relaxed scales the round by 0.75 and is never Perfect.
  function sampleScore(r){
    if(r.auto)return AUTO_SAMPLE;if(!r.exact)return 0;
    return Math.max(10,SCORE_BY_TEST[Math.min(r.testsUsed,TESTS)-1]-HINT_COST*(r.hints||0));
  }
  function grade(P,results,opts={}){
    const exact=results.filter(r=>r.exact).length,n=P.samples.length;
    const raw=results.reduce((t,r)=>t+sampleScore(r),0)/n;
    const score=Math.round(opts.relaxed?raw*RELAXED_FACTOR:raw);
    let tier=exact===n?'good':exact>0?'partial':'failed';
    if(exact===n&&!opts.relaxed&&results.every(r=>r.testsUsed===1&&!r.hints))tier='perfect';
    return {tier,score,exact};
  }
  // Resource node from a sample's amounts. quality 'auto' drops one richness step and keeps only the dominant mineral.
  function node(P,si,amounts,quality){
    const s=P.samples[si],list=amounts.map((a,m)=>({m,a:a||0})).filter(x=>x.a>0).sort((x,y)=>y.a-x.a||x.m-y.m);
    const auto=quality==='auto',parts=auto?list.slice(0,1):list,top=parts[0]?parts[0].a:0;
    const rich=RICHNESS[Math.max(0,top-(auto?1:0))],rare=parts.some(x=>P.library[x.m].rare);
    const names=parts.map((x,k)=>`${k===0?rich+' ':''}${P.library[x.m].name.toLowerCase().replace('aether','Aether').replace('null','Null')}${auto?'':` (${x.a})`}`);
    return {site:s.site,rare,richness:rich,minerals:parts.map(x=>({id:P.library[x.m].id,amount:x.a})),
      text:`${rare?'Rare resource node':'Resource node'} found: ${names.join(' + ')} at ${s.site}${auto?' (rough survey)':''}`};
  }
  // Skip: unsolved samples are auto-assayed (dominant mineral only, one richness step lower); solved ones stand.
  function auto(P,results){
    const rs=P.samples.map((_,si)=>results[si]&&(results[si].exact||results[si].failed)?results[si]:{auto:true});
    const nodes=P.samples.map((s,si)=>rs[si].exact?node(P,si,s.amounts):rs[si].auto?node(P,si,s.amounts,'auto'):null).filter(Boolean);
    const score=Math.round(rs.reduce((t,r)=>t+sampleScore(r),0)/P.samples.length);
    return {score,nodes,results:rs};
  }
  // Near miss: the channel that would have told you, for the first sample that was not clean.
  function nearMiss(P,results){
    for(let si=0;si<P.samples.length;si++){
      const r=results[si];if(!r||r.auto)continue;
      if(r.exact&&r.testsUsed===1&&!r.hints)continue;
      const S=solve(P,si),miss=(r.firstWrong&&r.firstWrong.length?r.firstWrong:r.hinted||[])[0];
      let step=miss===undefined?null:miss==='flag'?S.steps.find(x=>x.kind==='stray'):S.steps.find(x=>x.kind==='fix'&&x.mineral===miss);
      if(!step)step=S.steps.find(x=>x.kind==='fix'||x.kind==='stray');
      if(step)return `Sample ${si+1}: channel ${ch(step.channel)} would have told you. ${step.reason}`;
    }
    return '';
  }

  const api={DIFFICULTIES,MINERALS,SITES,ASSIST_LEVELS,TESTS,MAX_AMOUNT,AMOUNTS,RICHNESS,difficulty,ch,matches,mix,residual,channelStates,flatline,
    uniquePeaks,solve,countSolutions,generate,empty,validate,apply,test,hint,relaxedFills,sampleScore,grade,node,auto,nearMiss};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CoreAssay=api;
})(typeof globalThis==='object'?globalThis:this);
