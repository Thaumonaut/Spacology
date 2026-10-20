// DNA sequencing (Research, night): shotgun-sequencing assembly. Pure rules, no DOM.
// A sample is one hidden strand of L bases (A/C/G/T) read as 4–6 fragments: each fragment is a contiguous window of the
// strand (40–70% of L long) with some bases lost as missing data ("?"). The board is L columns wide. The player slides
// each fragment, whole, to an offset; overlapping fragments must agree wherever both read a base. One fragment (two on
// Expert, in different fragments) holds a contaminated stretch of 2–4 bases: once everything is lined up, that stretch is
// the only thing that disagrees with the rest. Flagged bases stop counting toward the consensus.
// A sample is solved when every fragment sits at its true offset and exactly the contaminated bases are flagged.
// "Run sequence" checks it: three runs per sample; a failed run says how many fragments are misplaced and whether the
// contamination flag is wrong or missing, never which.
//
// Generator guarantees (each checked, otherwise the attempt is thrown away):
//  - Full consensus: at the answer every column holds at least one known, uncontaminated base, so the consensus reaches
//    L/L with no conflicts once the contamination is flagged.
//  - Contamination: every contaminated base is known, differs from the strand, and its column holds genuine known bases
//    from at least two other fragments (which therefore agree with each other); stretches never share a column.
//  - Uniqueness (solve): over every offset vector and every flag set of exactly C runs (2–4 known bases in one fragment,
//    each flagged base disagreeing with the other known bases in its column), exactly one pair (offsets, flags) leaves no
//    conflicting column and a full consensus: the planted one.
//  - A logical way in: some pair of fragments has exactly one relative shift where they overlap on ≥ FIT known bases with
//    no disagreement (as the player sees them, contamination included), and it is the true one.
//  - Repeats: Normal and up plant 2–4-base motifs twice in the strand; Hard and Expert also need at least one decoy
//    (a pair of fragments that fits cleanly at a wrong shift), so some placements stay plausible until cross-checked.
// Loads as a classic script (window.DnaSequencing) or with require() in Node.
(function(root){
  'use strict';
  const Kit=typeof module==='object'&&module.exports&&typeof require==='function'?require('../../shared/minigames/minigame-kit.js'):root.MiniGameKit;

  const FIT=4,RUNS=3,NODE_BUDGET=400000;
  const BASES=[
    {id:'A',glyph:'▲',name:'adenine'},
    {id:'C',glyph:'●',name:'cytosine'},
    {id:'G',glyph:'■',name:'guanine'},
    {id:'T',glyph:'◆',name:'thymine'}
  ];
  // len = strand length L; frags = fragment count [min,max]; samples = [min,max]; missing = share of bases lost;
  // repeats = motifs planted twice; decoys = clean wrong-shift pair fits required; contam = stretches; cLen = their length.
  const DIFFICULTIES=[
    {id:'easy',label:'Swab · 4 fragments',len:20,frags:[4,4],samples:[1,1],missing:0.08,repeats:0,decoys:0,contam:1,cLen:[2,3],target:45,gain:20},
    {id:'normal',label:'Culture · 5 fragments',len:26,frags:[5,5],samples:[1,2],missing:0.15,repeats:1,decoys:0,contam:1,cLen:[2,4],target:60,gain:25},
    {id:'hard',label:'Biopsy · 5–6 fragments',len:30,frags:[5,6],samples:[2,2],missing:0.22,repeats:2,decoys:1,contam:1,cLen:[3,4],target:90,gain:30},
    {id:'expert',label:'Outbreak · 6 fragments',len:36,frags:[6,6],samples:[2,2],missing:0.25,repeats:2,decoys:2,contam:2,cLen:[2,4],target:120,gain:40}
  ];
  // Assist levels. Puzzle and Guided can reach Perfect; Relaxed snaps for you and tops out at Good.
  const ASSIST_LEVELS=[
    {id:'puzzle',label:'Puzzle',note:'Every placement is yours. Perfect is possible.'},
    {id:'guided',label:'Guided',note:'Fragments that fit only one place on the board as it stands are outlined, with that place. Perfect is still possible.'},
    {id:'relaxed',label:'Relaxed',note:'Drop a fragment in its place and every fragment it pins down falls in after it. Tops out at Good.'}
  ];
  // Research assistance cards and the flaws a clean sample clears (flavour only; never changes the rules).
  const CARDS=['Adrenal primer','Lattice plating','Spore ward','Echo lens','Tidewalker serum','Ion bandage','Null damper','Rootbinder gel'];
  const FLAWS=['Jittery aim (−8% accuracy)','Slow onset (first strike delayed)','Brittle (shield breaks early)','Fever (−5% max HP each round)',
    'Loud (draws the first enemy hit)','Short shelf life (fades after 3 rounds)','Allergic (heals 20% less)','Clumsy (−10% speed)'];
  const difficulty=id=>DIFFICULTIES.find(d=>d.id===id)||DIFFICULTIES[0];
  const plural=(k,w)=>`${k} ${w}${k===1?'':w.endsWith('ch')?'es':'s'}`;
  const letters=list=>list.map(b=>b<0?'?':BASES[b].id).join('-');

  // ---------- Board reading ----------
  // state: {off:[offset per fragment], flag:[[0|1 per base]]}. A base counts when it is known (not −1) and not flagged.
  // Column status: 'empty' (nothing known), 'single' (one known base), 'agree' (2+ known, all the same), 'conflict'.
  function consensus(P,state){
    const L=P.len,cols=[];
    for(let c=0;c<L;c++)cols.push({counts:[0,0,0,0],n:0,from:[]});
    P.frags.forEach((f,i)=>{const o=state.off[i];
      f.bases.forEach((b,k)=>{if(b<0||state.flag[i][k])return;const col=cols[o+k];col.counts[b]++;col.n++;col.from.push(i);});});
    let known=0,conflicts=0;
    for(const col of cols){
      const kinds=col.counts.filter(x=>x>0).length;
      let best=-1;col.counts.forEach((x,b)=>{if(x>0&&(best<0||x>col.counts[best]))best=b;});
      col.status=!col.n?'empty':kinds>1?'conflict':col.n===1?'single':'agree';
      col.base=kinds===1?best:-1;col.majority=best;
      if(col.status==='conflict')conflicts++;else if(col.n)known++;
    }
    return {cols,known,conflicts,len:L,complete:known===L};
  }

  // ---------- Generator ----------
  // generate(seed, difficulty): a game of 1–2 samples, one card and one flaw.
  function generate(seed,diffId){
    const D=difficulty(diffId),r=Kit.rng(Kit.hashSeed(`dna-sequencing|${seed}|${D.id}`));
    const count=r.range(D.samples[0],D.samples[1]),samples=[];
    for(let s=0;s<count;s++)samples.push(generateSample(seed,D,s));
    const fr=Kit.rng(Kit.hashSeed(`dna-flavour|${seed}|${D.id}`));
    return {seed,difficulty:D.id,samples,card:fr.pick(CARDS),flaw:fr.pick(FLAWS)};
  }
  function generateSample(seed,D,index){
    for(let attempt=0;attempt<400;attempt++){
      const P=build(Kit.rng(Kit.hashSeed(`dna-sample|${seed}|${D.id}|${index}|${attempt}`)),D);
      if(!P)continue;
      P.index=index;P.attempt=attempt;
      return P;
    }
    throw new Error('dna-sequencing: no sample for seed '+seed);
  }
  function build(rng,D){
    const L=D.len,F=rng.range(D.frags[0],D.frags[1]);
    // The strand: no three identical bases in a row, so a fragment never reads as a featureless run.
    const strand=[];
    for(let c=0;c<L;c++){let b;do b=rng.int(4);while(c>=2&&strand[c-1]===b&&strand[c-2]===b);strand.push(b);}
    // Repeats: a 3–4-base motif copied elsewhere, so a fragment can be pulled into the wrong copy.
    const repeats=[];
    for(let d=0;d<D.repeats;d++){
      const m=rng.range(3,4),far=(x,y)=>Math.abs(x-y)>=m+2;let a=-1,b=-1;
      for(let t=0;t<40&&a<0;t++){const x=rng.range(0,L-m),y=rng.range(0,L-m);
        if(far(x,y)&&repeats.every(r=>far(r.a,x)&&far(r.b,x)&&far(r.a,y)&&far(r.b,y))){a=x;b=y;}}
      if(a<0)return null;
      for(let i=0;i<m;i++)strand[b+i]=strand[a+i];
      repeats.push({a,b,len:m});
    }
    // Windows: lengths 40–70% of L; one starts the strand and one ends it.
    // Every column must lie under at least two windows (so there is always an overlap to read).
    const lo=Math.ceil(0.4*L),hi=Math.floor(0.7*L);let frags=null;
    for(let t=0;t<30&&!frags;t++){
      const w=[];
      for(let i=0;i<F;i++){const len=rng.range(lo,hi);w.push({len,start:i===0?0:i===1?L-len:rng.range(0,L-len)});}
      let ok=true;for(let c=0;c<L&&ok;c++)if(w.filter(f=>c>=f.start&&c<f.start+f.len).length<2)ok=false;
      if(ok)frags=w;
    }
    if(!frags)return null;
    // Shuffle the row order so the strand's start is not always fragment 1.
    const order=rng.shuffle(frags);
    // Missing data, at most 40% of a fragment.
    for(const f of order){
      f.bases=strand.slice(f.start,f.start+f.len);f.contam=f.bases.map(()=>0);
      const lose=Math.min(Math.floor(0.4*f.len),Math.round(D.missing*f.len*(0.7+0.6*rng.next())));
      for(const k of rng.shuffle([...Array(f.len).keys()]).slice(0,lose))f.bases[k]=-1;
    }
    // A column that lost every read gets one base back.
    for(let c=0;c<L;c++){
      const over=order.filter(f=>c>=f.start&&c<f.start+f.len);
      if(!over.some(f=>f.bases[c-f.start]>=0)){const f=rng.pick(over);f.bases[c-f.start]=strand[c];}
    }
    // Contamination, in different fragments: a stretch whose columns each hold known bases from 2+ other fragments.
    const stretches=[];
    for(const i of rng.shuffle([...Array(F).keys()]).slice(0,D.contam)){
      const f=order[i],len=rng.range(D.cLen[0],D.cLen[1]),cands=[];
      for(let k=0;k+len<=f.len;k++){
        let ok=true;
        for(let j=k;j<k+len&&ok;j++){
          // Stretches never share a column, and only genuine reads count as the agreeing others.
          const col=f.start+j;let others=0,taken=false;
          order.forEach((g,gi)=>{if(col<g.start||col>=g.start+g.len)return;const kk=col-g.start;
            if(g.contam[kk])taken=true;else if(gi!==i&&g.bases[kk]>=0)others++;});
          if(others<2||taken)ok=false;
        }
        if(ok)cands.push(k);
      }
      if(!cands.length)return null;
      const k=rng.pick(cands);
      for(let j=k;j<k+len;j++){let b;do b=rng.int(4);while(b===strand[f.start+j]);f.bases[j]=b;f.contam[j]=1;}
      stretches.push({frag:i,from:k,to:k+len-1});
    }
    // Full consensus at the answer: every column has a known uncontaminated base.
    for(let c=0;c<L;c++)if(!order.some(f=>c>=f.start&&c<f.start+f.len&&f.bases[c-f.start]>=0&&!f.contam[c-f.start]))return null;
    const P={len:L,strand,frags:order.map(f=>({len:f.len,bases:f.bases,contam:f.contam})),answer:order.map(f=>f.start),stretches,repeats,
      contamCount:D.contam,difficulty:D.id};
    // Uniqueness over (offsets, flags).
    const sol=solve(P,2);
    if(!sol||sol.count!==1||sol.solutions[0].off.some((o,i)=>o!==P.answer[i]))return null;
    P.solverNodes=sol.nodes;
    // A logical way in, and the decoys.
    const pf=pairFits(P);
    P.wayIn=pf.unique;P.decoys=pf.decoys;
    if(!P.wayIn.length||P.decoys.length<D.decoys)return null;
    // Start: every fragment away from its place.
    P.startOff=P.frags.map((f,i)=>{let o;do o=rng.range(0,L-f.len);while(o===P.answer[i]);return o;});
    return P;
  }

  // ---------- Solver ----------
  // Counts (offsets, flags) solutions, stopping at `stop`. Backtracks over fragment offsets (longest first) and prunes any
  // partial board whose conflicting columns no longer fit inside C windows of 4 columns (every conflict needs a flagged
  // base, and flags are C runs of at most 4 bases). Each complete board is checked for a valid flag set.
  function solve(P,stop=2,budget=NODE_BUDGET){
    const L=P.len,F=P.frags.length,C=P.contamCount;
    const counts=[];for(let c=0;c<L;c++)counts.push([0,0,0,0]);
    const order=[...Array(F).keys()].sort((a,b)=>P.frags[b].len-P.frags[a].len||a-b);
    const off=new Array(F).fill(-1),solutions=[];let nodes=0,aborted=false;
    const conflictCols=()=>{const q=[];for(let c=0;c<L;c++){let k=0;for(let b=0;b<4;b++)if(counts[c][b])k++;if(k>1)q.push(c);}return q;};
    const fits=q=>{let w=0,end=-1;for(const c of q)if(c>end){w++;end=c+3;if(w>C)return false;}return true;};
    const place=(i,o,d)=>{const f=P.frags[i];for(let k=0;k<f.len;k++)if(f.bases[k]>=0)counts[o+k][f.bases[k]]+=d;};
    function rec(t){
      if(solutions.length>=stop||aborted)return;
      if(++nodes>budget){aborted=true;return;}
      if(t===F){
        const flags=flagSets(P,off);
        for(const flag of flags){solutions.push({off:off.slice(),flag});if(solutions.length>=stop)return;}
        return;
      }
      const i=order[t],f=P.frags[i];
      for(let o=0;o+f.len<=L;o++){
        place(i,o,1);off[i]=o;
        if(fits(conflictCols()))rec(t+1);
        place(i,o,-1);off[i]=-1;
        if(solutions.length>=stop||aborted)return;
      }
    }
    rec(0);
    if(aborted)return null;
    return {count:solutions.length,solutions,nodes};
  }
  // All valid flag sets for a complete board: exactly C runs (2–4 known bases inside one fragment, runs never touching),
  // each flagged base disagreeing with the remaining known bases in its column, leaving no conflict and a full consensus.
  function flagSets(P,off){
    const L=P.len,C=P.contamCount,F=P.frags.length;
    const counts=[];for(let c=0;c<L;c++)counts.push([0,0,0,0]);
    P.frags.forEach((f,i)=>f.bases.forEach((b,k)=>{if(b>=0)counts[off[i]+k][b]++;}));
    const conflict=counts.map(x=>x.filter(Boolean).length>1);
    // Candidate runs: contiguous known bases of one fragment, all in conflicting columns.
    const runs=[];
    P.frags.forEach((f,i)=>{for(let a=0;a<f.len;a++)for(let e=a+1;e<Math.min(f.len,a+4);e++){
      let ok=true;for(let k=a;k<=e;k++)if(f.bases[k]<0||!conflict[off[i]+k]){ok=false;break;}
      if(ok)runs.push({frag:i,from:a,to:e});else if(f.bases[e]<0||!conflict[off[i]+e])break;
    }});
    const out=[];
    const check=chosen=>{
      for(let x=0;x<chosen.length;x++)for(let y=x+1;y<chosen.length;y++){const a=chosen[x],b=chosen[y];
        if(a.frag===b.frag&&a.from<=b.to+1&&b.from<=a.to+1)return;}
      const cnt=counts.map(x=>x.slice());
      for(const r of chosen)for(let k=r.from;k<=r.to;k++)cnt[off[r.frag]+k][P.frags[r.frag].bases[k]]--;
      for(let c=0;c<L;c++){const kinds=cnt[c].filter(Boolean).length;if(kinds!==1)return;}
      // Each flagged base must disagree with what is left in its column.
      for(const r of chosen)for(let k=r.from;k<=r.to;k++){const col=off[r.frag]+k;if(cnt[col][P.frags[r.frag].bases[k]]>0)return;}
      const flag=P.frags.map(f=>f.bases.map(()=>0));
      for(const r of chosen)for(let k=r.from;k<=r.to;k++)flag[r.frag][k]=1;
      out.push(flag);
    };
    // Every flag set of up to C runs is tried, so a wrong board that is already conflict-free (nothing to flag) counts too.
    const pick=(start,chosen)=>{
      check(chosen);if(chosen.length===C)return;
      for(let j=start;j<runs.length;j++){chosen.push(runs[j]);pick(j+1,chosen);chosen.pop();}
    };
    pick(0,[]);
    void F;
    return out;
  }
  // Pairwise fits as the player sees the bases (contamination included): a relative shift where two fragments overlap on
  // ≥ FIT known bases and disagree nowhere. unique: pairs with exactly one fit, the true one. decoys: clean wrong fits.
  function pairFit(P,i,j,d){
    // d = offset of j minus offset of i.
    const a=P.frags[i],b=P.frags[j];let agree=0,clash=0;
    for(let k=Math.max(0,d);k<Math.min(a.len,d+b.len);k++){
      const x=a.bases[k],y=b.bases[k-d];if(x<0||y<0)continue;if(x===y)agree++;else clash++;
    }
    return {agree,clash};
  }
  function pairFits(P){
    const F=P.frags.length,unique=[],decoys=[];
    for(let i=0;i<F;i++)for(let j=i+1;j<F;j++){
      const fits=[],truth=P.answer[j]-P.answer[i];
      for(let d=-P.frags[j].len+1;d<P.frags[i].len;d++){
        const s=pairFit(P,i,j,d);if(s.agree>=FIT&&!s.clash)fits.push(d);
      }
      if(fits.length===1&&fits[0]===truth)unique.push({i,j,shift:truth});
      for(const d of fits)if(d!==truth)decoys.push({i,j,shift:d});
    }
    return {unique,decoys};
  }

  // ---------- State and moves ----------
  function startState(P){return {off:P.startOff.slice(),flag:P.frags.map(f=>f.bases.map(()=>0))};}
  function solvedState(P){return {off:P.answer.slice(),flag:P.frags.map(f=>f.contam.slice())};}
  const cloneState=s=>({off:s.off.slice(),flag:s.flag.map(f=>f.slice())});
  // {type:'move',frag,to}: slide a whole fragment to offset `to`. {type:'flag'|'unflag',frag,from,to}: flag (or clear)
  // the known bases from..to of a fragment ("?" tiles in the range are skipped). Returns the new state, or null for an
  // invalid move (the state is never touched).
  function apply(P,state,move){
    if(!move||!Number.isInteger(move.frag)||move.frag<0||move.frag>=P.frags.length)return null;
    const i=move.frag,f=P.frags[i];
    if(move.type==='move'){
      if(!Number.isInteger(move.to)||move.to<0||move.to+f.len>P.len||move.to===state.off[i])return null;
      const s=cloneState(state);s.off[i]=move.to;return s;
    }
    if(move.type==='flag'||move.type==='unflag'){
      const {from,to}=move,want=move.type==='flag'?1:0;
      if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to>=f.len||from>to)return null;
      const s=cloneState(state);let changed=false;
      for(let k=from;k<=to;k++)if(f.bases[k]>=0&&s.flag[i][k]!==want){s.flag[i][k]=want;changed=true;}
      return changed?s:null;
    }
    return null;
  }
  // A flag drag or tap over from..to: clears the range when every known base in it is flagged, otherwise flags it.
  function toggleMove(P,state,frag,a,b){
    const from=Math.min(a,b),to=Math.max(a,b),f=P.frags[frag];let all=true,any=false;
    for(let k=from;k<=to;k++)if(f.bases[k]>=0){any=true;if(!state.flag[frag][k])all=false;}
    if(!any)return null;
    return {type:all?'unflag':'flag',frag,from,to};
  }

  // ---------- Run check ----------
  // misplaced: fragments away from their offset. flag: 'ok', 'missing' (no genuine base flagged, but some contamination
  // left) or 'wrong' (a genuine base is flagged).
  function runCheck(P,state){
    let misplaced=0,wrong=0,missing=0;
    P.frags.forEach((f,i)=>{if(state.off[i]!==P.answer[i])misplaced++;
      f.bases.forEach((b,k)=>{if(state.flag[i][k]&&!f.contam[k])wrong++;if(f.contam[k]&&!state.flag[i][k])missing++;});});
    const flag=wrong?'wrong':missing?'missing':'ok';
    return {correct:!misplaced&&flag==='ok',misplaced,flag,wrong,missing};
  }
  function runText(res){
    if(res.correct)return 'Sequence confirmed: every fragment in place and the contamination flagged.';
    const parts=[];
    if(res.misplaced)parts.push(`${plural(res.misplaced,'fragment')} misplaced`);
    if(res.flag!=='ok')parts.push(`contamination flag ${res.flag}`);
    return parts.join(' · ');
  }

  // ---------- Fits against a set of placed fragments ----------
  // Fragment i at offset o against fragments `others` at state.off: agree = its known bases matching a known base in the
  // column, clash = known bases disagreeing. skip(j,k): bases left out of the evidence.
  function fitAt(P,state,i,o,others,skip){
    const f=P.frags[i];let agree=0,clash=0;
    for(let k=0;k<f.len;k++){
      const b=f.bases[k];if(b<0||skip(i,k))continue;
      const col=o+k;let ok=false,bad=false;
      for(const j of others){
        const g=P.frags[j],kk=col-state.off[j];if(kk<0||kk>=g.len)continue;
        const y=g.bases[kk];if(y<0||skip(j,kk))continue;
        if(y===b)ok=true;else bad=true;
      }
      if(bad)clash++;else if(ok)agree++;
    }
    return {agree,clash};
  }
  function fitPositions(P,state,i,others,skip){
    const out=[];
    for(let o=0;o+P.frags[i].len<=P.len;o++){const s=fitAt(P,state,i,o,others,skip);if(s.agree>=FIT&&!s.clash)out.push({o,agree:s.agree});}
    return out;
  }
  const settledSet=(P,state)=>P.frags.map((f,i)=>i).filter(i=>state.off[i]===P.answer[i]);
  // Fitted fragments, read from the board alone (no answer): a fragment that, where it sits, shares ≥ FIT agreeing known
  // bases with another fragment and clashes with none of them (flagged bases left out).
  function fitted(P,state){
    const skip=(j,k)=>!!state.flag[j][k],F=P.frags.length,out=new Set();
    for(let i=0;i<F;i++)for(let j=i+1;j<F;j++){
      const s=fitAt(P,state,i,state.off[i],[j],skip);
      if(s.agree>=FIT&&!s.clash){out.add(i);out.add(j);}
    }
    return out;
  }
  // Guided: fragments with exactly one clean, supported position against the fitted fragments (the evidence a player
  // has built), so a scrambled neighbour never pulls the highlight. Before anything fits, the pairs of fragments that fit
  // each other only one way are shown instead (kind 'pair', as the bases read). Returns [{frag, to, here, kind, with}].
  function guided(P,state){
    const out=[],skip=(j,k)=>!!state.flag[j][k],fit=fitted(P,state);
    if(fit.size){
      P.frags.forEach((f,i)=>{
        const others=[...fit].filter(j=>j!==i);if(!others.length)return;
        const pos=fitPositions(P,state,i,others,skip);
        if(pos.length===1)out.push({frag:i,to:pos[0].o,here:pos[0].o===state.off[i],kind:'fit',with:others});
      });
      if(out.some(g=>!g.here))return out;
    }
    // Pairs that fit only one way, as the player sees the bases.
    const pairs=[];
    for(const u of P.wayIn){const d=state.off[u.j]-state.off[u.i];if(d!==u.shift)pairs.push(u);}
    if(out.some(g=>!g.here))return out;
    const inside=(i,o)=>o>=0&&o+P.frags[i].len<=P.len;
    for(const u of pairs){
      // Slide one of the pair against the other where it sits; whichever stays on the board.
      if(inside(u.j,state.off[u.i]+u.shift)){out.push({frag:u.j,to:state.off[u.i]+u.shift,here:false,kind:'pair',with:[u.i]});break;}
      if(inside(u.i,state.off[u.j]-u.shift)){out.push({frag:u.i,to:state.off[u.j]-u.shift,here:false,kind:'pair',with:[u.j]});break;}
    }
    return out;
  }
  // Relaxed: the evidence is only fragments already in their true place, contamination left out, so a snap is never
  // wrong. forced(i): the true offset is the one clean, supported position against that evidence.
  const contamSkip=P=>(j,k)=>!!P.frags[j].contam[k];
  function forced(P,state,i){
    if(state.off[i]===P.answer[i])return false;
    const S=settledSet(P,state);if(!S.length)return false;
    const pos=fitPositions(P,state,i,S,contamSkip(P));
    return pos.length===1&&pos[0].o===P.answer[i];
  }
  // The cascade after a placement: snap every forced fragment, repeatedly, in order. Returns the moves.
  function cascade(P,state){
    const moves=[];let s=state,again=true;
    while(again){again=false;
      for(let i=0;i<P.frags.length;i++)if(forced(P,s,i)){const m={type:'move',frag:i,to:P.answer[i]};moves.push(m);s=apply(P,s,m);again=true;}
    }
    return {moves,state:s};
  }
  // Relaxed drop: a fragment dropped within two columns of its place snaps there when a settled fragment backs it.
  function snap(P,state,i,drop){
    const t=P.answer[i];if(drop===t)return t;
    if(Math.abs(drop-t)>2)return drop;
    const S=settledSet(P,state).filter(j=>j!==i);if(!S.length)return drop;
    const s=fitAt(P,state,i,t,S,contamSkip(P));
    return s.agree>=FIT&&!s.clash?t:drop;
  }

  // ---------- Hints ----------
  // The longest run of columns where fragment i (at offset oi) and j (at oj) both read the same known base.
  function sharedMotif(P,i,oi,j,oj){
    const a=P.frags[i],b=P.frags[j];let best=null,cur=[];
    const lo=Math.max(oi,oj),hi=Math.min(oi+a.len,oj+b.len);
    for(let c=lo;c<=hi;c++){
      const x=c<hi?a.bases[c-oi]:-2,y=c<hi?b.bases[c-oj]:-3;
      if(c<hi&&x>=0&&x===y&&!a.contam[c-oi]&&!b.contam[c-oj])cur.push(x);
      else{if(cur.length&&(!best||cur.length>best.length))best=cur;cur=[];}
    }
    return best||[];
  }
  // Agreeing known bases between i and j at their true offsets (contamination left out).
  function trueAgree(P,i,j){
    const s=solvedState(P);return fitAt(P,s,i,P.answer[i],[j],contamSkip(P)).agree;
  }
  // One step towards the answer, never undoing progress: clear a flag on genuine bases, else place one misplaced fragment
  // (the most constrained by the fragments already in place), else flag a missing contaminated stretch.
  // Returns {move, reason, kind} or null when the sample is already solved.
  function hint(P,state){
    for(let i=0;i<P.frags.length;i++){
      const f=P.frags[i],k=f.bases.findIndex((b,kk)=>state.flag[i][kk]&&!f.contam[kk]);
      if(k<0)continue;let e=k;while(e+1<f.len&&!f.contam[e+1]&&(state.flag[i][e+1]||f.bases[e+1]<0))e++;
      while(e>k&&!state.flag[i][e])e--;
      return {kind:'unflag',move:{type:'unflag',frag:i,from:k,to:e},reason:`Fragment ${i+1}’s ${letters(f.bases.slice(k,e+1))} ${e>k?'are':'is'} genuine: ${e>k?'they agree':'it agrees'} with the strand.`};
    }
    const mis=P.frags.map((f,i)=>i).filter(i=>state.off[i]!==P.answer[i]);
    if(mis.length){
      const S=settledSet(P,state),skip=contamSkip(P);let best=null;
      for(const i of mis){
        let partner=-1,agree=-1;
        for(const j of (S.length?S:P.frags.map((g,j)=>j).filter(j=>j!==i))){const a=trueAgree(P,i,j);if(a>agree){agree=a;partner=j;}}
        if(agree<=0)continue;
        // Clean, supported positions against the settled fragments; none at all means unconstrained, not most constrained.
        const n=S.length?fitPositions(P,{off:P.answer},i,S,skip).length:0,pos=n||99;
        const cand={i,partner,agree,choices:pos,anchored:S.length>0};
        if(!best||cand.choices<best.choices||cand.choices===best.choices&&cand.agree>best.agree)best=cand;
      }
      // Nothing placed yet: start from a pair that fits together only one way.
      const u=!S.length&&P.wayIn.find(w=>mis.includes(w.i));
      if(u){const motif=letters(sharedMotif(P,u.i,P.answer[u.i],u.j,P.answer[u.j]).slice(0,6));
        return {kind:'move',move:{type:'move',frag:u.i,to:P.answer[u.i]},
          reason:`Start here: fragment ${u.i+1}’s ${motif} fits fragment ${u.j+1}’s ${motif} only one way, so line fragment ${u.j+1} up with it next.`};}
      if(!best)best={i:mis[0],partner:-1,agree:0,choices:99,anchored:false};
      const i=best.i,j=best.partner,move={type:'move',frag:i,to:P.answer[i]};
      let reason;
      if(j<0)reason=`Fragment ${i+1} goes here, where the strand runs.`;
      else{
        const motif=letters(sharedMotif(P,i,P.answer[i],j,P.answer[j]).slice(0,6));
        reason=best.anchored&&best.choices===1?`Fragment ${i+1}’s ${motif} only fits where fragment ${j+1} reads ${motif}.`
          :`Fragment ${i+1}’s ${motif} fits where fragment ${j+1} reads ${motif}${best.anchored?'':', with no disagreement anywhere along the overlap'}.`;
      }
      return {kind:'move',move,reason};
    }
    for(const st of P.stretches){
      const f=P.frags[st.frag];if(f.contam.every((c,k)=>!c||state.flag[st.frag][k]))continue;
      // The fragments that read genuine bases over the stretch.
      const others=P.frags.map((g,j)=>j).filter(j=>{if(j===st.frag)return false;const g=P.frags[j];
        for(let k=st.from;k<=st.to;k++){const kk=P.answer[st.frag]+k-P.answer[j];if(kk>=0&&kk<g.len&&g.bases[kk]>=0&&!g.contam[kk])return true;}return false;});
      return {kind:'flag',move:{type:'flag',frag:st.frag,from:st.from,to:st.to},
        reason:`Fragment ${st.frag+1}’s ${letters(f.bases.slice(st.from,st.to+1))} disagrees with ${others.length>1?'fragments '+others.slice(0,-1).map(j=>j+1).join(', ')+' and '+(others[others.length-1]+1):'fragment '+(others[0]+1)}, which agree with each other: that is the contamination.`};
    }
    return null;
  }

  // ---------- Results ----------
  // results: one {correct, firstRun, runs} per sample played. s: {results, hints, assist, auto}.
  // Perfect: every sample correct on its first run, no hint, not Relaxed. Good: every sample correct. Partial: some.
  // Completion: the difficulty's gain for Perfect, 80% of it for Good, in proportion for Partial; Skip earns 40%.
  function score(G,s){
    const D=difficulty(G.difficulty),n=G.samples.length,res=s.results||[];
    if(s.auto)return {tier:'auto',completion:Math.round(D.gain*0.4),correct:res.filter(r=>r.correct).length};
    const correct=res.filter(r=>r.correct).length,first=res.filter(r=>r.correct&&r.firstRun).length;
    let tier=correct===n?'good':correct>0?'partial':'failed';
    const capped=(s.hints||0)>0||s.assist==='relaxed';
    if(tier==='good'&&first===n&&!capped)tier='perfect';
    const completion=tier==='perfect'?D.gain:Math.round(D.gain*0.8*correct/n);
    return {tier,completion,correct,capped};
  }
  function output(G,res){
    if(res.tier==='failed')return `Flaw remains: ${G.flaw} on the ${G.card} (card prototype). The DNA is still contaminated.`;
    return `Flaw cleared: ${G.flaw} on the ${G.card} (card prototype) · +${res.completion}% completion`;
  }
  // One concrete sentence about a failed run: the misplaced fragment and the overlap that would have told you, or the
  // stretch that disagreed.
  function nearMiss(P,state){
    const mis=P.frags.map((f,i)=>i).filter(i=>state.off[i]!==P.answer[i]);
    if(mis.length){
      const i=mis[0];let j=-1,a=0;
      P.frags.forEach((g,jj)=>{if(jj===i)return;const x=trueAgree(P,i,jj);if(x>a){a=x;j=jj;}});
      const d=state.off[i]-P.answer[i],where=`${plural(Math.abs(d),'column')} too far ${d>0?'right':'left'}`;
      if(j<0)return `Fragment ${i+1} sat ${where}.`;
      const motif=letters(sharedMotif(P,i,P.answer[i],j,P.answer[j]).slice(0,6));
      return `Fragment ${i+1} sat ${where}: its ${motif} lines up with fragment ${j+1}’s ${motif}${mis.length>1?` (${plural(mis.length-1,'other fragment')} also off)`:''}.`;
    }
    const f=P.frags;
    for(let i=0;i<f.length;i++){const k=f[i].bases.findIndex((b,kk)=>state.flag[i][kk]&&!f[i].contam[kk]);
      if(k>=0)return `Fragment ${i+1}’s base ${k+1} (${letters([f[i].bases[k]])}) was genuine: it agrees with the fragments above and below it.`;}
    for(const st of P.stretches){if(f[st.frag].contam.some((c,k)=>c&&!state.flag[st.frag][k]))
      return `Fragment ${st.frag+1}’s ${letters(f[st.frag].bases.slice(st.from,st.to+1))} (bases ${st.from+1}–${st.to+1}) disagreed with every fragment over it: that was the contamination.`;}
    return '';
  }
  // Skip: the answer is laid out, at a reduced result.
  function autoSolve(P){return solvedState(P);}

  const api={FIT,RUNS,BASES,DIFFICULTIES,ASSIST_LEVELS,CARDS,FLAWS,difficulty,letters,consensus,generate,generateSample,solve,flagSets,
    pairFit,pairFits,startState,solvedState,cloneState,apply,toggleMove,runCheck,runText,fitAt,fitPositions,settledSet,fitted,guided,forced,
    cascade,snap,hint,score,output,nearMiss,autoSolve};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DnaSequencing=api;
})(typeof globalThis==='object'?globalThis:this);
