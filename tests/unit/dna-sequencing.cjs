'use strict';
// DNA sequencing (shotgun assembly) model: determinism; 200 seeds per difficulty with unique offsets, uniquely
// identifiable contamination and a logical way in; the consensus; run feedback counts; atomic invalid moves; tiers and
// the reduced automatic result; hints that are always right and converge; a Relaxed cascade that never misplaces.
const assert=require('node:assert/strict'),M=require('../../prototypes/minigames/dna-sequencing/dna-sequencing-model.js');
const Kit=require('../../prototypes/shared/minigames/minigame-kit.js');
const t0=Date.now();
const blank=P=>P.frags.map(f=>f.bases.map(()=>0));

// Determinism: same seed and difficulty give the same game; different seeds differ.
for(const d of M.DIFFICULTIES){
  assert.deepEqual(M.generate(42,d.id),M.generate(42,d.id),'same seed, same game');
  assert.notDeepEqual(M.generate(42,d.id).samples[0].frags,M.generate(43,d.id).samples[0].frags);
  assert.ok(d.label&&d.target>=45&&d.target<=120);
}
assert.deepEqual(M.DIFFICULTIES.map(d=>[d.id,d.target]),[['easy',45],['normal',60],['hard',90],['expert',120]]);

// 200 seeds per difficulty.
const missingShare={},sampleCounts={};
for(const d of M.DIFFICULTIES){
  let lost=0,total=0;sampleCounts[d.id]=new Set();
  for(let seed=1;seed<=200;seed++){
    const G=M.generate(seed,d.id);
    assert.ok(G.samples.length>=d.samples[0]&&G.samples.length<=d.samples[1],`${d.id} ${seed}: sample count`);
    sampleCounts[d.id].add(G.samples.length);
    assert.ok(M.CARDS.includes(G.card)&&M.FLAWS.includes(G.flaw));
    for(const P of G.samples){
      const tag=`${d.id} seed ${seed} sample ${P.index}`,F=P.frags.length,L=P.len,ans=M.solvedState(P);
      assert.equal(L,d.len,tag);
      assert.ok(F>=d.frags[0]&&F<=d.frags[1],tag+': fragment count');
      for(let i=0;i<F;i++){
        const f=P.frags[i];
        assert.ok(f.len>=Math.ceil(0.4*L)&&f.len<=Math.floor(0.7*L),tag+': window 40–70% of L');
        assert.ok(P.answer[i]>=0&&P.answer[i]+f.len<=L,tag+': window on the strand');
        f.bases.forEach((b,k)=>{
          assert.ok(b>=-1&&b<4);
          if(b<0){lost++;assert.equal(f.contam[k],0,tag+': contamination is always readable');}
          else if(!f.contam[k])assert.equal(b,P.strand[P.answer[i]+k],tag+': a genuine read matches the strand');
          total++;
        });
        // Scrambled start: never already in place.
        assert.notEqual(P.startOff[i],P.answer[i],tag+': start is scrambled');
        assert.ok(P.startOff[i]>=0&&P.startOff[i]+f.len<=L,tag);
      }
      // Contamination: the promised stretches, each 2–4 bases in its own fragment, and the only thing that disagrees.
      assert.equal(P.stretches.length,d.contam,tag);
      assert.equal(new Set(P.stretches.map(s=>s.frag)).size,d.contam,tag+': stretches in different fragments');
      for(const st of P.stretches){
        const len=st.to-st.from+1;assert.ok(len>=2&&len<=4&&len>=d.cLen[0]&&len<=d.cLen[1],tag+': stretch length');
        for(let k=st.from;k<=st.to;k++){
          const f=P.frags[st.frag],col=P.answer[st.frag]+k;
          assert.equal(f.contam[k],1);assert.notEqual(f.bases[k],P.strand[col],tag+': contaminated base differs');
          // At least two other fragments read this column, and they agree with each other (and with the strand).
          const others=P.frags.map((g,j)=>j===st.frag?-2:g.bases[col-P.answer[j]]).filter((b,j)=>j!==st.frag&&b!==undefined&&b>=0);
          assert.ok(others.length>=2,tag+': contamination overlaps two other reads');
          assert.ok(others.every(b=>b===P.strand[col]),tag+': those reads agree');
        }
      }
      // Identifiable only after alignment: at the answer, unflagged, the clashing columns are exactly the contaminated
      // ones; flag them and the consensus is full with no clash.
      {const raw=M.consensus(P,{off:P.answer,flag:blank(P)}),cc=new Set();
        P.stretches.forEach(st=>{for(let k=st.from;k<=st.to;k++)cc.add(P.answer[st.frag]+k);});
        raw.cols.forEach((c,i)=>assert.equal(c.status==='conflict',cc.has(i),tag+': only contamination clashes at the answer'));
        const done=M.consensus(P,ans);assert.ok(done.complete&&done.conflicts===0,tag+': full consensus');
        done.cols.forEach((c,i)=>assert.equal(c.base,P.strand[i],tag+': consensus spells the strand'));}
      // Uniqueness: exactly one (offsets, flags) pair makes every overlap consistent and the consensus full.
      {const sol=M.solve(P,2);assert.ok(sol,tag+': solver finished');assert.equal(sol.count,1,tag+': unique');
        assert.deepEqual(sol.solutions[0].off,P.answer,tag);assert.deepEqual(sol.solutions[0].flag,ans.flag,tag+': the flags are unique too');}
      // A logical way in: a pair of fragments that fits only one way, as the player sees the bases, and it is true.
      assert.ok(P.wayIn.length>0,tag+': a way in');
      for(const u of P.wayIn){
        let fits=0;for(let s=-P.frags[u.j].len+1;s<P.frags[u.i].len;s++){const x=M.pairFit(P,u.i,u.j,s);if(x.agree>=M.FIT&&!x.clash)fits++;}
        assert.equal(fits,1,tag+': way-in pair fits once');assert.equal(u.shift,P.answer[u.j]-P.answer[u.i],tag);
      }
      // Repeats and decoys.
      assert.equal(P.repeats.length,d.repeats,tag+': repeats');
      for(const r of P.repeats)assert.deepEqual(P.strand.slice(r.a,r.a+r.len),P.strand.slice(r.b,r.b+r.len),tag+': motif repeats');
      assert.ok(P.decoys.length>=d.decoys,tag+': decoy fits');
    }
  }
  missingShare[d.id]=lost/total;
  assert.ok(Date.now()-t0<60000,'generation stays fast');
}
// Missing data grows with difficulty; Normal has one and two samples; Hard and Expert always two.
const shares=M.DIFFICULTIES.map(d=>missingShare[d.id]);
for(let i=1;i<shares.length;i++)assert.ok(shares[i]>shares[i-1],'missing data grows: '+shares.map(x=>x.toFixed(2)));
assert.deepEqual([...sampleCounts.easy],[1]);assert.deepEqual([...sampleCounts.normal].sort(),[1,2]);
assert.deepEqual([...sampleCounts.hard],[2]);assert.deepEqual([...sampleCounts.expert],[2]);

// Consensus on a hand-built sample: agree, single, empty, conflict, and flags leaving the count.
{const P={len:5,frags:[{len:3,bases:[0,1,-1],contam:[0,0,0]},{len:3,bases:[0,2,-1],contam:[0,0,0]}]};
  let s={off:[0,0],flag:[[0,0,0],[0,0,0]]},c=M.consensus(P,s);
  assert.deepEqual(c.cols.map(x=>x.status),['agree','conflict','empty','empty','empty']);
  assert.deepEqual([c.known,c.conflicts,c.complete],[1,1,false]);
  s={off:[0,0],flag:[[0,0,0],[0,1,0]]};c=M.consensus(P,s);
  assert.deepEqual(c.cols.map(x=>x.status),['agree','single','empty','empty','empty'],'a flagged base stops counting');
  assert.equal(c.cols[1].base,1);
  s={off:[0,2],flag:[[0,0,0],[0,0,0]]};c=M.consensus(P,s);
  assert.deepEqual(c.cols.map(x=>x.status),['single','single','single','single','empty']);
  assert.deepEqual(c.cols.map(x=>x.base),[0,1,0,2,-1]);assert.equal(c.known,4);
  const Q={len:2,frags:[0,0,1].map(b=>({len:1,bases:[b],contam:[0]}))};
  c=M.consensus(Q,{off:[0,0,0],flag:[[0],[0],[0]]});assert.equal(c.cols[0].status,'conflict');assert.equal(c.cols[0].majority,0,'majority base');}

// Run feedback: counts only, never which.
{const P=M.generate(7,'normal').samples[0],F=P.frags.length,ans=M.solvedState(P);
  assert.deepEqual(M.runCheck(P,ans),{correct:true,misplaced:0,flag:'ok',wrong:0,missing:0});
  const s=M.cloneState(ans);s.off[0]=P.startOff[0];s.off[1]=P.startOff[1];
  let r=M.runCheck(P,s);assert.equal(r.misplaced,2);assert.equal(r.flag,'ok');assert.equal(M.runText(r),'2 fragments misplaced');
  const st=P.stretches[0];s.flag[st.frag][st.from]=0;r=M.runCheck(P,s);
  assert.equal(r.flag,'missing');assert.equal(M.runText(r),'2 fragments misplaced · contamination flag missing');
  const g=P.frags.findIndex((f,i)=>i!==st.frag),k=P.frags[g].bases.findIndex(b=>b>=0);s.flag[g][k]=1;
  r=M.runCheck(P,s);assert.equal(r.flag,'wrong');assert.match(M.runText(r),/contamination flag wrong$/);
  r=M.runCheck(P,M.startState(P));assert.equal(r.misplaced,F);assert.equal(r.flag,'missing');
  assert.ok(!/fragment \d/.test(M.runText(r)),'a run never names the fragment');
  assert.equal(M.RUNS,3);}

// Invalid moves leave the state unchanged and return null.
{const P=M.generate(3,'hard').samples[0],s=M.startState(P),snap=JSON.stringify(s),f=P.frags[0];
  const bad=[null,{type:'move',frag:-1,to:0},{type:'move',frag:P.frags.length,to:0},{type:'move',frag:0,to:-1},
    {type:'move',frag:0,to:P.len-f.len+1},{type:'move',frag:0,to:s.off[0]},{type:'move',frag:0,to:1.5},{type:'spin',frag:0},
    {type:'flag',frag:0,from:2,to:1},{type:'flag',frag:0,from:0,to:f.len},{type:'unflag',frag:0,from:0,to:1}];
  const miss=f.bases.findIndex(b=>b<0);if(miss>=0)bad.push({type:'flag',frag:0,from:miss,to:miss});
  for(const m of bad){assert.equal(M.apply(P,s,m),null,JSON.stringify(m));assert.equal(JSON.stringify(s),snap,'state untouched');}
  // Valid ones return a new state and never mutate the old one.
  const to=s.off[0]===0?1:0,n=M.apply(P,s,{type:'move',frag:0,to});assert.equal(n.off[0],to);assert.equal(JSON.stringify(s),snap);
  const k=f.bases.findIndex(b=>b>=0),fl=M.apply(P,s,{type:'flag',frag:0,from:k,to:k});assert.equal(fl.flag[0][k],1);assert.equal(JSON.stringify(s),snap);
  // A tap toggle: flags a fresh range, clears a fully flagged one, and skips missing data.
  assert.equal(M.toggleMove(P,s,0,k,k).type,'flag');assert.equal(M.toggleMove(P,fl,0,k,k).type,'unflag');
  if(miss>=0)assert.equal(M.toggleMove(P,s,0,miss,miss),null);}

// Tiers: Perfect (all first-run, no hints, not Relaxed), Good, Partial, Failed; the automatic result is below Perfect.
{const G=M.generate(5,'hard'),gain=M.difficulty('hard').gain,ok={correct:true,firstRun:true,runs:1},late={correct:true,firstRun:false,runs:2},bad={correct:false,firstRun:false,runs:3};
  const t=(results,o={})=>M.score(G,{results,hints:0,assist:'puzzle',...o});
  assert.equal(t([ok,ok]).tier,'perfect');assert.equal(t([ok,ok]).completion,gain);
  assert.equal(t([ok,late]).tier,'good');assert.equal(t([ok,ok],{hints:1}).tier,'good');assert.equal(t([ok,ok],{assist:'relaxed'}).tier,'good');
  assert.equal(t([ok,ok],{assist:'guided'}).tier,'perfect','Guided can still be Perfect');
  assert.equal(t([ok,bad]).tier,'partial');assert.equal(t([bad,bad]).tier,'failed');assert.equal(t([bad,bad]).completion,0);
  assert.ok(t([ok,late]).completion<gain&&t([ok,bad]).completion<t([ok,late]).completion);
  for(const d of M.DIFFICULTIES){const a=M.score(M.generate(1,d.id),{auto:true});assert.equal(a.tier,'auto');assert.ok(a.completion>0&&a.completion<d.gain,'auto scores below Perfect');}
  assert.match(M.output(G,t([ok,ok])),new RegExp(`^Flaw cleared: .+ on the .+ \\(card prototype\\) · \\+${gain}% completion$`));
  assert.match(M.output(G,t([bad,bad])),/^Flaw remains/);
  assert.deepEqual(M.autoSolve(G.samples[0]),M.solvedState(G.samples[0]));}
assert.ok(Kit.TIERS.perfect&&Kit.TIERS.auto);

// Hints: every hint is a step towards the answer (never a wrong place or a wrong flag) and they converge, from the
// start and from messy random boards.
function hintWalk(P,s,tag){
  const F=P.frags.length,limit=F+2*P.frags.reduce((k,f)=>k+f.len,0);
  for(let n=0;n<limit;n++){
    const h=M.hint(P,s);
    if(!h){assert.ok(M.runCheck(P,s).correct,tag+': no hint only when solved');return n;}
    assert.ok(typeof h.reason==='string'&&h.reason.length>10,tag);
    const m=h.move;
    if(m.type==='move')assert.equal(m.to,P.answer[m.frag],tag+': hint places at the true offset');
    if(m.type==='flag')for(let k=m.from;k<=m.to;k++)if(P.frags[m.frag].bases[k]>=0)assert.equal(P.frags[m.frag].contam[k],1,tag+': hint flags only contamination');
    if(m.type==='unflag')for(let k=m.from;k<=m.to;k++)if(s.flag[m.frag][k])assert.equal(P.frags[m.frag].contam[k],0,tag+': hint clears only genuine bases');
    const before=M.runCheck(P,s);s=M.apply(P,s,m);assert.ok(s,tag+': hint move is valid');
    const after=M.runCheck(P,s);assert.ok(after.misplaced<=before.misplaced&&after.wrong<=before.wrong,tag+': never undoes progress');
  }
  assert.fail(tag+': hints did not converge');
}
{let hintedMoves=0,moveReasons=0,flagHint=0;
  for(const d of M.DIFFICULTIES)for(let seed=1;seed<=40;seed++)for(const P of M.generate(seed,d.id).samples){
    const tag=`${d.id} ${seed}`,h0=M.hint(P,M.startState(P));
    assert.equal(h0.kind,'move',tag+': first hint places a fragment');
    if(/fits fragment \d+’s .+ only one way/.test(h0.reason))moveReasons++;
    hintedMoves+=hintWalk(P,M.startState(P),tag);
    // Once the alignment is done, the hint points to the contamination.
    const aligned={off:P.answer.slice(),flag:blank(P)},h=M.hint(P,aligned);assert.equal(h.kind,'flag',tag);
    assert.match(h.reason,/contamination/);flagHint++;
    // A messy board: random offsets and random flags.
    const r=Kit.rng(seed*31+P.index),s=M.startState(P);
    P.frags.forEach((f,i)=>{s.off[i]=r.range(0,P.len-f.len);f.bases.forEach((b,k)=>{if(b>=0&&r.chance(0.15))s.flag[i][k]=1;});});
    hintWalk(P,s,tag+' messy');
  }
  assert.ok(moveReasons>100,'placement hints quote the matching bases');assert.ok(hintedMoves>0&&flagHint>0);}
// The hint prefers the most constrained fragment: with one fragment placed, a hinted fragment that has a unique clean
// fit against it says "only fits".
{let only=0;for(let seed=1;seed<=60;seed++){const P=M.generate(seed,'normal').samples[0],u=P.wayIn[0],s=M.startState(P);s.off[u.i]=P.answer[u.i];
  const h=M.hint(P,s);assert.equal(h.move.to,P.answer[h.move.frag]);if(/only fits where/.test(h.reason))only++;}
  assert.ok(only>=30,'anchored hints usually name a unique fit: '+only);}

// Relaxed: the cascade and the drop snap never place a fragment wrongly, from any board; and they do fill boards in.
{let snaps=0,filled=0;
  for(const d of M.DIFFICULTIES)for(let seed=1;seed<=50;seed++)for(const P of M.generate(seed,d.id).samples){
    const r=Kit.rng(seed*97+P.index+d.len);
    for(let trial=0;trial<6;trial++){
      const s=M.startState(P);
      P.frags.forEach((f,i)=>{s.off[i]=r.chance(0.35)?P.answer[i]:r.range(0,P.len-f.len);});
      const c=M.cascade(P,s);
      for(const m of c.moves){assert.equal(m.to,P.answer[m.frag],`${d.id} ${seed}: cascade misplaced`);snaps++;}
      P.frags.forEach((f,i)=>{if(s.off[i]===P.answer[i])assert.equal(c.state.off[i],P.answer[i],'a settled fragment never moves');});
      for(let i=0;i<P.frags.length;i++){const drop=r.range(0,P.len-P.frags[i].len),t=M.snap(P,s,i,drop);assert.ok(t===drop||t===P.answer[i],'snap is the drop or the truth');}
    }
    // From one correct placement (the way-in pair's first fragment) the cascade usually finishes the board.
    const s=M.startState(P),u=P.wayIn[0];s.off[u.i]=P.answer[u.i];
    if(M.cascade(P,s).state.off.every((o,i)=>o===P.answer[i]))filled++;
  }
  assert.ok(snaps>200,'the cascade snaps fragments: '+snaps);assert.ok(filled>100,'one placement often cascades to the full board: '+filled);}

// Guided: only offsets on the board; with the fitted evidence all at the truth, a 'fit' guide is never wrong.
for(let seed=1;seed<=60;seed++)for(const P of M.generate(seed,'expert').samples){
  for(const s of [M.startState(P),(()=>{const x=M.startState(P);P.wayIn.slice(0,1).forEach(u=>{x.off[u.i]=P.answer[u.i];x.off[u.j]=P.answer[u.j];});return x;})()]){
    for(const g of M.guided(P,s)){assert.ok(g.to>=0&&g.to+P.frags[g.frag].len<=P.len,'guide on the board');assert.ok(['fit','pair'].includes(g.kind));
      if(g.kind==='pair'){const u=P.wayIn.find(w=>w.i===g.frag&&w.j===g.with[0]||w.j===g.frag&&w.i===g.with[0]);assert.ok(u,'a pair guide is a way-in pair');}
      const fit=M.fitted(P,s);if(g.kind==='fit'&&[...fit].every(j=>s.off[j]===P.answer[j]))assert.equal(g.to,P.answer[g.frag],'fit guide against true evidence is true');}
  }
}

// Near-miss: names the misplaced fragment and the overlap, or the stretch that disagreed.
{const P=M.generate(11,'normal').samples[0],s=M.solvedState(P);s.off[1]=P.startOff[1];
  assert.match(M.nearMiss(P,s),/^Fragment 2 sat \d+ columns? too far (left|right): its [ACGT](-[ACGT])* lines up with fragment \d+’s/);
  const t=M.solvedState(P),st=P.stretches[0];t.flag[st.frag]=t.flag[st.frag].map(()=>0);
  assert.match(M.nearMiss(P,t),new RegExp(`^Fragment ${st.frag+1}’s .+ disagreed with every fragment over it`));}

console.log(`PASS dna-sequencing unit: determinism; 200 seeds × 4 difficulties with unique offsets and flags, contamination overlapping 2+ agreeing reads and clashing only at the answer, a way-in pair, repeats and decoys, scrambled starts; missing data ${shares.map(x=>Math.round(x*100)+'%').join(' < ')}; consensus; run counts; invalid moves atomic; tiers and auto below Perfect; hints right and converging from start and messy boards; Relaxed cascade and snap never misplace; Guided on-board; near-miss lines (${Date.now()-t0} ms)`);
