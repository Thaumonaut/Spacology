'use strict';
// Aether attunement (boss study): determinism, round structure (boss, buffs, samples, one weakness), authored motif
// boards, objective legality on hand-built boards, exact par under the objective, the objective gates (the objective
// changes the par line; careful and plain greedy miss par), chip states, ⚠ breaks, buffs removed per sample, round
// tiers, hints that stay optimal and speak the objective, near-miss lines, and the fallback.
// Run: node tests/unit/aether-attunement.cjs   (AA_SEEDS=n to change the per-difficulty round count, default 120)
const assert=require('node:assert/strict'),A=require('../../prototypes/minigames/aether-attunement/aether-attunement-model.js'),I=A._internal;
const SYM={D4:['mx','my','r180','t','r90','r270','at'],C4:['r90','r180','r270'],D2:['mx','my'],C2:['r180'],MX:['mx']};
const MAP={mx:(x,y,s)=>[s-1-x,y],my:(x,y,s)=>[x,s-1-y],r180:(x,y,s)=>[s-1-x,s-1-y],t:(x,y)=>[y,x],r90:(x,y,s)=>[s-1-y,x],r270:(x,y,s)=>[y,s-1-x],at:(x,y,s)=>[s-1-y,s-1-x]};
const SEEDS=Number(process.env.AA_SEEDS)||120;
const json=x=>JSON.stringify(x);
const built=new Map(),gen=(seed,d)=>{const k=seed+':'+d;if(!built.has(k))built.set(k,A.generate(seed,d));return built.get(k);};
const play=(P,plan)=>{let s=A.initial(P);for(const c of plan){const r=A.apply(P,s,c);assert.ok(r.ok,r.reason);s=r.state;}return s;};
const objLen=(P,s)=>{if(P.objective.lead!=null&&s.moves.length&&s.moves[0]!==P.objective.lead)return null; // a wrong lead is already broken
  const p=I.exactObj(A.topology(P),Uint8Array.from(s.abs),A.clauses(P),s.moves.length,1e7);return p?p.length:null;};
const hist=list=>Object.entries(list.reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{})).sort().map(([k,v])=>`${k}:${v}`).join(' ');
const pct=(a,b)=>`${Math.round(100*a/Math.max(1,b))}%`;

// ---- determinism ----
for(const D of A.DIFFICULTIES){
  assert.equal(json(A.generate(7,D.id)),json(A.generate(7,D.id)),D.id+' must be deterministic');
  assert.notEqual(json(A.generate(7,D.id).samples[0].cells),json(A.generate(8,D.id).samples[0].cells));
}

// ---- every generated round and sample ----
const kinds={};const K=k=>kinds[k]||(kinds[k]={n:0,rise:0,gap:[],plainBreak:0,plainOver:0,pars:[]});
const motifSeen={},bosses=new Set();let boards=0,lone=0;
for(const D of A.DIFFICULTIES){
  for(let seed=1;seed<=SEEDS;seed++){
    const R=gen(seed,D.id),tag=`${D.id} seed ${seed}`;
    // the round: a hero boss, D.buffs buffs (2-4), one sample per objective kind, each targeting its own buff
    assert.ok(A.BOSSES.some(b=>b.id===R.boss.id&&b.name===R.boss.name));bosses.add(R.boss.id);
    assert.equal(R.buffs.length,D.buffs);assert.ok(D.buffs>=2&&D.buffs<=4);
    assert.ok(R.samples.length>=1&&R.samples.length<=3&&R.samples.length<=R.buffs.length);
    assert.deepEqual(R.samples.map(P=>P.objective.kind),D.samples);assert.deepEqual(R.samples.map(P=>P.buff),R.samples.map((_,k)=>k));
    // one weakness per boss: every End-on sample closes on it, and its rack carries it
    assert.equal(R.weakness,R.samples[0].objective.end);
    for(const P of R.samples){
      if(P.objective.end!=null){assert.equal(P.objective.end,R.weakness,`${tag}: one weakness`);assert.ok(P.palette.includes(R.weakness));}
      if(P.objective.lead!=null){assert.ok(P.palette.includes(P.objective.lead));if(P.objective.end!=null)assert.notEqual(P.objective.lead,P.objective.end);}
    }
    for(const P of R.samples){
      const T=A.topology(P),n=P.size*P.size,cl=A.clauses(P),st=`${tag} sample ${P.index}`;boards++;
      // an authored, exactly symmetric pattern with no lone cells
      assert.equal(P.size,D.size);assert.equal(P.palette.length,D.crew);assert.equal(P.palette.length+P.foreign.length,6);
      for(const t of SYM[P.symmetry])for(let i=0;i<n;i++){const [x,y]=MAP[t](i%P.size,(i/P.size)|0,P.size);assert.equal(P.cells[y*P.size+x],P.cells[i],`${st}: not symmetric under ${t}`);}
      assert.equal(A.singles(P),0,`${st}: isolated cells`);lone+=A.singles(P);
      P.motifs.forEach(m=>motifSeen[m]=(motifSeen[m]||0)+1);
      // par under the objective: exact (fresh search, huge budget), in range, never below the free par
      assert.ok(P.par>=D.parRange[0]&&P.par<=D.parRange[1],`${st}: par ${P.par}`);
      assert.equal(objLen(P,A.initial(P)),P.par,`${st}: par must be the exact objective minimum`);
      assert.equal(I.exactPlan(T,I.absFor(P),1e7).length,P.freePar,`${st}: free par exact`);
      assert.ok(P.par>=P.freePar);assert.equal(P.limit,P.par+A.SLACK);
      // the par line meets the objective and cleans the sample in par moves, each move but the closing one a big chunk
      let s=A.initial(P);
      P.plan.forEach((c,k)=>{const r=A.apply(P,s,c);assert.ok(r.ok);assert.equal(r.absorbed.length+r.resonance.length,P.gains[k]);s=r.state;});
      assert.ok(A.done(P,s)&&s.moves.length===P.par&&A.satisfies(cl,s.moves),`${st}: par line`);
      assert.ok(Math.min(...P.gains.slice(0,-1))>=Math.max(3,Math.round(D.minGain*n)));
      assert.equal(A.sampleResult(P,s).outcome,'removed');assert.ok(A.sampleResult(P,s).atPar);
      // gate: the objective changes the par line (the free optimal line breaks it)
      assert.equal(A.satisfies(cl,P.freePlan),false,`${st}: the objective must change the par line`);
      assert.equal(play(P,P.freePlan).moves.length,P.freePar);
      // gate: greedy play under the objective misses par (careful greedy: most cells among moves that keep it possible)
      const careful=I.greedyObj(T,I.absFor(P),cl,true),plain=I.greedyObj(T,I.absFor(P),[],false);plain.met=A.satisfies(cl,plain.plan);
      assert.deepEqual(P.plainGreedy,{moves:plain.plan.length,met:plain.met});
      assert.ok(!(careful.met&&careful.plan.length<=P.par),`${st}: careful greedy reaches par`);
      assert.ok(!(plain.met&&plain.plan.length<=P.par),`${st}: plain greedy reaches par`);
      assert.deepEqual(P.greedy,{moves:careful.plan.length,met:careful.met});
      const k=K(P.objective.kind);k.n++;k.pars.push(P.par);if(P.par>P.freePar)k.rise++;
      k.gap.push(careful.met?'+'+(careful.plan.length-P.par):'fails');if(!plain.met)k.plainBreak++;else k.plainOver++;
    }
  }
}
for(const m of A.MOTIF_IDS)assert.ok(motifSeen[m]>0,`motif ${m} never appears`);
assert.ok(bosses.size>=6,'most hero bosses appear');
for(const g of ['same-line','greedy','impossible'])assert.ok(Object.keys(I.REJECT).some(k=>k.endsWith(':'+g)),`the ${g} gate fires`);

// ---- objective legality on hand-built boards ----
// 2×2: origin order(0) at cell 0; growth (2) at cells 1 and 3 (one group); energy (5) at cell 2.
// End on energy: growth then energy. The trap: energy first swallows the only energy group, nothing left to close on.
const mk=(objective,extra)=>({game:'aether-attunement',seed:0,difficulty:'calm',size:2,cells:[0,2,5,2],palette:[0,2,5],foreign:[1,3,4],origin:0,
  motif:'Rings',motifs:['rings'],symmetry:'MX',objective,par:2,limit:4,plan:[2,5],gains:[2,1],freePar:2,freePlan:[5,2],buff:0,index:0,...extra});
{
  const H=mk({kind:'endOn',end:5}),s0=A.initial(H);
  assert.deepEqual(I.exactObj(A.topology(H),I.absFor(H),A.clauses(H),0,1e6),[2,5],'par line under End on energy');
  assert.equal(A.objectiveStatus(H,s0).state,'par');
  // every Flood-It move stays legal: the objective never refuses a move
  assert.ok(A.apply(H,s0,5).ok);assert.equal(A.apply(H,s0,0).ok,false);assert.match(A.apply(H,s0,1).reason,/not on the rack/);
  assert.equal(A.breaks(H,s0,5),true,'energy first breaks End on energy');assert.equal(A.breaks(H,s0,2),false);
  assert.match(A.breakReason(H,s0,5),/^Hold Energy for last: taking it now leaves the .+ with no Energy to close on$/);
  const trap=A.apply(H,s0,5).state;assert.equal(A.objectiveStatus(H,trap).state,'lost','red chip once the objective cannot be met');
  const broken=A.apply(H,trap,2).state;assert.ok(A.done(H,broken));assert.equal(A.objectiveStatus(H,broken).state,'broken');
  assert.equal(A.sampleResult(H,broken).outcome,'weakened','clean but objective broken: weakened');assert.equal(A.sampleResult(H,broken).weakness,null);
  const good=play(H,[2,5]);assert.equal(A.objectiveStatus(H,good).state,'met');
  assert.deepEqual([A.sampleResult(H,good).outcome,A.sampleResult(H,good).atPar,A.sampleResult(H,good).weakness],['removed',true,5]);
  assert.match(A.nearMiss(H,broken),/^Move 1: Hold Energy for last: taking it now leaves .+ with no Energy to close on\. Growth \(\+2\) instead would have finished clean in 2 moves \(par\), closing on Energy\.$/);
  assert.match(A.nearMiss(H,good),/Nothing left on the table/);
  // hint: growth first, explaining why energy waits
  const h=A.hint(H,s0);assert.equal(h.colour,2);assert.match(h.text,/^Hold Energy for last: taking it now leaves .+ with no Energy to close on\. Growth \(\+2\) keeps a 2-move finish that closes on Energy\.$/);
  assert.match(A.hint(H,A.apply(H,s0,2).state).text,/Energy closes the reaction/);
  // End on growth is impossible here (energy would always be last or never): red from the start
  const G=mk({kind:'endOn',end:0});assert.equal(I.exactObj(A.topology(G),I.absFor(G),A.clauses(G),0,1e6),null);assert.equal(A.objectiveStatus(G,A.initial(G)).state,'lost');
  // Lead with energy: energy then growth
  const L=mk({kind:'leadWith',lead:5},{plan:[5,2]}),l0=A.initial(L);
  assert.deepEqual(I.exactObj(A.topology(L),I.absFor(L),A.clauses(L),0,1e6),[5,2]);
  assert.equal(A.breaks(L,l0,2),true);assert.match(A.breakReason(L,l0,2),/^Lead with Energy: the reaction only takes if Energy opens it$/);
  assert.equal(A.sampleResult(L,play(L,[2,5])).outcome,'weakened');assert.equal(A.sampleResult(L,play(L,[5,2])).outcome,'removed');
  assert.match(A.hint(L,l0).text,/^Lead with Energy/);
  // satisfies, as clauses
  const both=A.clausesOf({kind:'leadEnd',lead:2,end:5});
  assert.deepEqual([[2,5],[2,0,5],[5,2],[2,5,2]].map(m=>A.satisfies(both,m)),[true,true,false,false]);
  assert.equal(A.objectiveText({kind:'leadEnd',lead:2,end:5}),'Lead with Growth · End on Energy');
}

// ---- chip states and ⚠ on generated samples: par / over / lost agree with exact search ----
let chips={par:0,over:0,lost:0},warnChecks=0,tempting=0;
for(const D of A.DIFFICULTIES)for(let seed=1;seed<=12;seed++)for(const P of gen(seed,D.id).samples){
  const s0=A.initial(P);assert.equal(A.objectiveStatus(P,s0).state,'par');
  for(const c of P.palette){const r=A.apply(P,s0,c);if(!r.ok)continue;
    const o=A.objectiveStatus(P,r.state),len=r.done?null:objLen(P,r.state);
    if(r.done)continue;
    const want=len==null?'lost':1+len<=P.par?'par':'over';
    assert.equal(o.state,want,`${D.id} ${seed}: chip after ${A.title(c)}`);chips[want]++;
    assert.equal(A.breaks(P,s0,c),want==='lost','⚠ exactly when the move loses the objective');warnChecks++;
    if(want==='lost'&&P.objective.kind==='endOn'&&P.objective.end===c){tempting++;assert.match(A.breakReason(P,s0,c),new RegExp(`^Hold ${A.title(c)} for last`));}
  }
}
assert.ok(chips.over>0&&chips.lost>0,'amber and red chip states both occur from the opening move');

// ---- per-sample outcomes and round tiers ----
{
  const P=gen(3,'steady').samples[0],fake=moves=>({abs:new Array(A.topology(P).n).fill(1),colour:0,moves});
  const okLine=extra=>{const m=P.plan.slice(0,-1);for(let k=0;k<extra;k++)m.push(m[m.length-1]===P.plan[0]?P.plan[1]:P.plan[0]);return m.concat(P.objective.end);};
  assert.deepEqual([0,1,2,3].map(k=>{const r=A.sampleResult(P,fake(okLine(k)));return r.outcome+(r.atPar?'@par':'');}),['removed@par','removed','removed','weakened'],'par, par+1, par+2 remove; past the limit weakens');
  const wrongEnd=P.plan.slice(0,-1).concat(P.palette.find(c=>c!==P.objective.end));
  assert.equal(A.sampleResult(P,fake(wrongEnd)).outcome,'weakened','objective broken: weakened even at par');
  assert.equal(A.sampleResult(P,fake(P.plan),{auto:true}).outcome,'weakened','Skip ignores the objective: weakened');
}
{
  const r=(outcome,atPar)=>({outcome,atPar:outcome==='removed'&&atPar});
  assert.equal(A.roundTier([r('removed',true),r('removed',true)],{hints:0,assist:'puzzle'}),'perfect');
  assert.equal(A.roundTier([r('removed',true),r('removed',true)],{hints:0,assist:'guided'}),'perfect');
  assert.equal(A.roundTier([r('removed',true),r('removed',true)],{hints:1}),'good','a hint costs Perfect');
  assert.equal(A.roundTier([r('removed',true)],{hints:0,assist:'relaxed'}),'good','Relaxed is never Perfect');
  assert.equal(A.roundTier([r('removed',true),r('removed',false)],{}),'good');
  assert.equal(A.roundTier([r('removed',true),r('weakened')],{}),'partial');
  assert.equal(A.roundTier([r('weakened'),r('weakened')],{}),'failed');
  const R=gen(4,'tense'),res=[{buff:0,outcome:'removed',weakness:R.weakness},{buff:1,outcome:'weakened',weakness:null}];
  assert.equal(A.roundOutput(R,res),`Boss buffs removed: ${R.buffs[0].name} · Weakened: ${R.buffs[1].name} · Weakness found: ${A.title(R.weakness)}`);
  assert.equal(A.roundOutput(R,[{buff:0,outcome:'weakened',weakness:null}]),`Boss buffs removed: none · Weakened: ${R.buffs[0].name} · Weakness found: none`);
}

// ---- hints: from the start they reproduce the par line; off the line every hint is optimal under the objective ----
const rnd=require('../../prototypes/shared/minigames/minigame-kit.js').rng(99);let hintChecks=0,holdText=0;
for(const D of A.DIFFICULTIES)for(let seed=1;seed<=20;seed++)for(const P of gen(seed,D.id).samples){
  let h=A.initial(P);
  while(!A.done(P,h)){const x=A.hint(P,h);assert.ok(x.text.length>10);if(/^Hold \w+ for last/.test(x.text))holdText++;h=A.apply(P,h,x.colour).state;}
  assert.deepEqual(h.moves,P.plan,`${D.id} ${seed}: hints from the start follow the par line`);
  // wander off the par line with moves that keep the objective possible, then follow hints
  let w=A.initial(P);
  for(let k=0;k<2;k++){const safe=P.palette.filter(c=>{const r=A.apply(P,w,c);return r.ok&&!r.done&&!A.breaks(P,w,c);}),off=safe.filter(c=>c!==P.plan[k]);if(!safe.length)break;w=A.apply(P,w,rnd.pick(off.length?off:safe)).state;}
  while(!A.done(P,w)){
    const c=A.hint(P,w).colour,res=A.apply(P,w,c);assert.ok(res.ok);
    const before=objLen(P,w),after=res.done?0:objLen(P,res.state);
    assert.equal(after,before-1,`${D.id} ${seed}: hint must be optimal under the objective`);hintChecks++;
    w=res.state;
  }
  assert.ok(A.satisfies(A.clauses(P),w.moves),'hints keep the objective');
}
assert.ok(holdText>0,'hints tell you to hold the closing element');

// ---- fallback and near-miss lines ----
let named=0,trapLines=0;
for(const D of A.DIFFICULTIES)for(let seed=1;seed<=15;seed++)for(const P of gen(seed,D.id).samples){
  const a=A.auto(P);assert.ok(A.done(P,a.state));assert.equal(A.sampleResult(P,a.state,{auto:true}).outcome,'weakened');
  const line=A.nearMiss(P,a.state);
  assert.match(line,/^Move \d+: |^The objective|^Par was/);if(/^Move/.test(line))named++;
  assert.match(A.nearMiss(P,play(P,P.plan)),/Nothing left on the table/);
  // the trap: take the closing element whenever it breaks the objective
  if(P.objective.end!=null){let s=A.initial(P);
    for(let k=0;k<12&&!A.done(P,s);k++){const X=P.objective.end,c=A.apply(P,s,X).ok&&A.breaks(P,s,X)?X:A.hint(P,s).colour;s=A.apply(P,s,c).state;}
    const t=A.nearMiss(P,s);if(/Hold \w+ for last|would close the reaction, not/.test(t))trapLines++;}
}
assert.ok(named>0,'greedy games get a move-level near miss');assert.ok(trapLines>0,'trap games name the trap in the objective’s words');

// ---- stats ----
const kindLine=Object.entries(kinds).map(([k,v])=>`${k}: ${v.n} samples, par [${hist(v.pars)}], objective raises par ${pct(v.rise,v.n)} (else same par, different line), careful-greedy gap [${hist(v.gap)}], plain greedy breaks it ${pct(v.plainBreak,v.n)} (meets it over par ${pct(v.plainOver,v.n)})`).join('; ');
console.log(`PASS aether-attunement: ${SEEDS} rounds × 4 difficulties (${boards} samples, ${bosses.size} bosses, isolated cells ${(lone/boards*100).toFixed(2)}%), exact symmetry, one weakness per boss, objective legality, exact par under the objective, gates (objective changes the par line on 100%; careful and plain greedy miss par), chips par/over/lost from the opening (${chips.par}/${chips.over}/${chips.lost}, ${warnChecks} ⚠ checks, ${tempting} closing-element traps), buffs removed/weakened per sample, tiers, ${hintChecks} optimal off-line hints (${holdText} “Hold X for last”), near misses (${trapLines} trap lines). Objectives — ${kindLine}.`);
