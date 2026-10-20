'use strict';
// Depot sorting (water-sort with crates) model: determinism, 200 solvable seeds per difficulty with proven-optimal par,
// the move rule and its edge cases, invalid moves leaving the state untouched, seals and loading bays, the hold,
// Relaxed cascades that never break solvability, correct hints (next move and undo-to-here), tiers, the auto fallback
// and near-miss lines.
const assert=require('node:assert/strict'),D=require('../../prototypes/minigames/depot-sorting/depot-sorting-model.js'),K=require('../../prototypes/shared/minigames/minigame-kit.js');
const t0=Date.now(),SEEDS=200;
const play=(P,s,moves)=>moves.reduce((st,m)=>{const r=D.apply(P,st,m);assert.ok(r.ok,r.reason);return r.state;},s);
const counts=s=>{const c={};for(const b of s)for(const t of b)c[t]=(c[t]||0)+1;return c;};

// Determinism and difficulty table.
for(const d of D.DIFFICULTIES){
  assert.deepEqual(D.generate(42,d.id),D.generate(42,d.id),'same seed, same depot');
  assert.notDeepEqual(D.generate(42,d.id).start,D.generate(43,d.id).start);
  assert.ok(d.label&&d.target>=30&&d.types>=4&&d.types<=8);
}
assert.ok(D.DIFFICULTIES.every((d,k)=>!k||d.target>D.DIFFICULTIES[k-1].target));

// 200 seeds per difficulty: layout shape, the stored solution replays to solved in exactly par moves, A*'s plan is
// optimal (BFS agrees on a sample), and Expert's budget is ceil(par × 1.4).
function bfs(P,s,cap){const seen=new Set([D.key(P,s)]);let fr=[s],d=0;
  while(fr.length&&d<=cap){if(fr.some(x=>D.solved(P,x)))return d;const nx=[];
    for(const x of fr)for(const m of D.legalMoves(P,x)){const r=D.apply(P,x,m),k=D.key(P,r.state);if(!seen.has(k)){seen.add(k);nx.push(r.state);}}fr=nx;d++;}
  return null;}
const parStats={};let bfsChecked=0;
for(const d of D.DIFFICULTIES){
  const pars=[];
  for(let seed=1;seed<=SEEDS;seed++){
    const P=D.generate(seed,d.id),tag=`${d.id} seed ${seed}`;
    assert.equal(P.types,d.types);assert.equal(P.cap,d.cap);
    assert.equal(P.bays.filter(b=>b.kind!=='hold').length,d.types+d.spare,tag);
    assert.equal(P.bays.filter(b=>b.kind==='load').length,d.load,tag);
    assert.equal(P.bays.filter(b=>b.kind==='hold').length,d.hold?1:0,tag);
    assert.equal(new Set(P.bays.filter(b=>b.kind==='load').map(b=>b.want)).size,d.load,'loading bays want distinct types');
    assert.ok(Object.values(counts(P.start)).every(c=>c===d.cap)&&Object.keys(counts(P.start)).length===d.types,tag+': cap crates per type');
    assert.ok(P.start.every((b,i)=>b.length<=P.bays[i].cap),tag);
    assert.ok(P.start.every((b,i)=>!D.full(P,P.start,i)),tag+': nothing starts sorted');
    assert.equal(D.sealedCount(P,P.start),0);assert.ok(!D.solved(P,P.start));
    assert.ok(P.par>=d.minPar&&P.par<=d.maxPar,tag);assert.equal(P.solution.length,P.par);
    const end=play(P,P.start,P.solution);assert.ok(D.solved(P,end),tag+': solution solves');
    assert.equal(D.sealedCount(P,end),d.types,tag+': every type sealed at the end');
    for(const i of P.loads)assert.equal(end[i][0],P.bays[i].want,tag+': loading bay holds its type');
    assert.equal(P.budget,d.budget?Math.ceil(P.par*d.budget):null);
    pars.push(P.par);
    if(d.id==='easy'&&seed<=12||d.id==='normal'&&seed<=6){assert.equal(bfs(P,P.start,P.par),P.par,tag+': BFS confirms par is optimal');bfsChecked++;}
  }
  pars.sort((a,b)=>a-b);parStats[d.id]=`${pars[0]}–${pars[pars.length-1]} (median ${pars[pars.length>>1]})`;
}

// The rule, on a hand-built depot: bays 0–2 plain (cap 4), 3 a loading bay wanting type 1, 4 the hold.
const P={types:3,cap:4,bays:[{kind:'plain',cap:4,want:-1},{kind:'plain',cap:4,want:-1},{kind:'plain',cap:4,want:-1},{kind:'load',cap:4,want:1},{kind:'hold',cap:1,want:-1}],
  loads:[3],wanted:new Set([1])};
{
  const s=[[0,2,2],[1,2],[],[0,0,0],[]];
  assert.equal(D.runLength(s[0]),2);assert.equal(D.runLength([]),0);
  // A run moves whole onto an empty bay.
  let r=D.apply(P,s,{from:0,to:2});assert.ok(r.ok);assert.equal(r.count,2);assert.deepEqual(r.state[2],[2,2]);assert.deepEqual(r.state[0],[0]);
  // Onto its own type when the whole run fits.
  r=D.apply(P,s,{from:0,to:1});assert.ok(r.ok);assert.equal(r.count,2);assert.deepEqual(r.state[1],[1,2,2,2]);
  // Partial pour: a run of three onto a bay with room for one moves just one, the rest stay.
  const s2=[[0,0,0],[2,2,0],[],[],[]];r=D.apply(P,s2,{from:0,to:1});assert.ok(r.ok);assert.equal(r.count,1,'only what fits moves');
  assert.deepEqual(r.state[0],[0,0]);assert.deepEqual(r.state[1],[2,2,0,0]);
  // The hold takes exactly one crate of a run.
  r=D.apply(P,s,{from:0,to:4});assert.ok(r.ok);assert.equal(r.count,1);assert.deepEqual(r.state[4],[2]);assert.deepEqual(r.state[0],[0,2]);
  // Invalid moves: the very same state object comes back, untouched, with a reason.
  const frozen=JSON.stringify(s);
  for(const m of [{from:0,to:0},{from:2,to:0},{from:0,to:3},{from:9,to:1},{from:0,to:-1},{from:1.5,to:2},null,{from:0}]){
    const x=D.apply(P,s,m);assert.equal(x.ok,false);assert.equal(x.state,s,'invalid move returns the same state');assert.ok(x.reason);
  }
  assert.match(D.apply(P,s,{from:0,to:3}).reason,/Only/);assert.match(D.apply(P,s,{from:2,to:0}).reason,/empty/);
  const fullHold=[[0,2,2],[],[],[],[1]];assert.match(D.apply(P,fullHold,{from:0,to:4}).reason,/full/);
  const fullBay=[[2,2,2,2],[2],[],[],[]];assert.match(D.illegal(P,fullBay,{from:1,to:0}),/sealed|full/);
  assert.equal(JSON.stringify(s),frozen,'apply never mutates its input');
  // Seals: a full bay of an unwanted type in a plain bay seals and locks; a full bay of the wanted type outside its
  // loading bay is not sealed and can still move (onto the empty loading bay, all four).
  const t=[[2,2,2,2],[1,1,1,1],[],[],[]];
  assert.ok(D.sealed(P,t,0));assert.ok(!D.sealed(P,t,1));assert.ok(D.full(P,t,1));
  assert.match(D.illegal(P,t,{from:0,to:2}),/sealed/);
  r=D.apply(P,t,{from:1,to:3});assert.ok(r.ok);assert.equal(r.count,4);assert.ok(D.sealed(P,r.state,3));
  // Solved: every type full in one bay, loading bay holds its type, hold empty.
  assert.ok(D.solved(P,[[2,2,2,2],[0,0,0,0],[],[1,1,1,1],[]]));
  assert.ok(!D.solved(P,[[2,2,2,2],[1,1,1,1],[],[0,0,0,0],[]]),'wrong type in the loading bay');
  assert.ok(!D.solved(P,[[2,2,2,2],[0,0,0,0],[1],[1,1,1],[]]),'a type split across bays');
  assert.ok(!D.solved(P,[[2,2,2,2],[0,0,0,0],[],[1,1,1],[1]]),'the hold must end empty');
  // Targets lists exactly the legal drops (used by Guided).
  assert.deepEqual(D.targets(P,s,0),[1,2,4]);
  assert.deepEqual(D.targets(P,s,1),[0,2,4]);
  // Lower bound is admissible on the hand-built depot: never above the true distance.
  for(const st of [s,s2,t]){const r2=D.solve(P,st);if(r2.moves)assert.ok(D.lower(P,st)<=r2.moves.length);}
}

// Relaxed cascades: on many random mid-game boards, the cascade only ever makes finishing moves (each ends a gathering
// with a seal), terminates, is idempotent, and never turns a board that could finish into one that cannot.
let cascades=0,cascadeMoves=0;
for(const d of D.DIFFICULTIES)for(let seed=1;seed<=40;seed++){
  const G=D.generate(seed,d.id),rng=K.rng(seed*31+7);let s=G.start;
  for(let k=0;k<24;k++){
    const ms=D.legalMoves(G,s);if(!ms.length)break;s=D.apply(G,s,rng.pick(ms)).state;
    const c=D.cascade(G,s);if(!c.steps.length)continue;
    cascades++;cascadeMoves+=c.steps.length;
    assert.ok(D.sealedCount(G,c.state)>D.sealedCount(G,s),'a cascade seals at least one bay');
    for(const st of c.steps)assert.notEqual(G.bays[st.move.to].kind,'hold');
    assert.equal(D.cascade(G,c.state).steps.length,0,'idempotent');
    const a=D.solve(G,s,{budget:20000});
    if(a.moves){const b=D.solve(G,c.state,{budget:20000});assert.ok(b.moves||!b.exhausted,`${d.id} seed ${seed}: cascade broke solvability`);}
  }
}
assert.ok(cascades>100,'cascades are exercised');
// Played the solution at Relaxed: the cascade finishes the last bays and the result still solves.
for(let seed=1;seed<=20;seed++){const G=D.generate(seed,'normal');let s=G.start,n=0;
  while(!D.solved(G,s)&&n<60){const h=D.hint(G,s,[],null);assert.equal(h.kind,'move');s=D.cascade(G,D.apply(G,s,h.move).state).state;n++;}
  assert.ok(D.solved(G,s)&&n<=G.par,'hint + cascade play finishes within par');}

// Hints: from the start and from mid-solve boards, the hinted move is legal and lowers the optimal distance by one.
let hintChecks=0;
for(const d of D.DIFFICULTIES)for(let seed=1;seed<=25;seed++){
  const G=D.generate(seed,d.id),rng=K.rng(seed);let s=G.start;
  for(let k=0;k<3;k++){
    const h=D.hint(G,s,[],null),a=D.solve(G,s);
    if(!a.moves){assert.equal(h.kind,'undo');break;}
    assert.equal(h.kind,'move');assert.ok(h.text.startsWith('Move ')&&h.reason);
    const r=D.apply(G,s,h.move);assert.ok(r.ok);const b=D.solve(G,r.state);
    assert.equal(b.moves.length,a.moves.length-1,'a hint stays on a best route');hintChecks++;
    // Wander a little: the hinted move, then two random ones.
    s=r.state;for(let j=0;j<2;j++){const ms=D.legalMoves(G,s);if(ms.length)s=D.apply(G,s,rng.pick(ms)).state;}
  }
  // Following hints alone from the start solves in exactly par moves.
  if(seed<=5){let st=G.start,n=0;while(!D.solved(G,st)&&n<60){const h=D.hint(G,st,[],null);st=D.apply(G,st,h.move).state;n++;}assert.equal(n,G.par,'hint-only play hits par');}
}
// Undo-to-here: dead ends point back to the most recent earlier state that can still finish.
{
  const Z={types:2,cap:2,bays:[{kind:'plain',cap:2,want:-1},{kind:'plain',cap:2,want:-1}],loads:[],wanted:new Set()};
  const stuck=[[0,1],[1,0]];assert.equal(D.legalMoves(Z,stuck).length,0);
  assert.ok(D.solve(Z,stuck).exhausted,'a board with no moves is a proven dead end');
  assert.ok(D.solve(Z,[[0,0],[1,1]]).moves.length===0);
  // Expert-style budget: a route that is too long for the moves left also asks for an undo.
  const G=D.generate(7,'expert'),after=D.apply(G,G.start,D.legalMoves(G,G.start)[0]).state;
  const h=D.hint(G,after,[G.start],G.par-1);
  const best=D.solve(G,after).moves.length;
  if(best>G.par-1){assert.equal(h.kind,'undo');assert.equal(h.steps,1);assert.match(h.text,/budget/);}
  else assert.equal(h.kind,'move');
  // A real dead end in a generated depot: hint walks back through the history to a state that routes.
  let found=0;
  for(let seed=1;seed<=60&&!found;seed++){const W=D.generate(seed,'hard'),rng=K.rng(seed*5);let s=W.start;const hist=[];
    for(let k=0;k<40;k++){const ms=D.legalMoves(W,s);if(!ms.length)break;hist.push(s);s=D.apply(W,s,rng.pick(ms)).state;
      const r=D.solve(W,s,{budget:20000});
      if(r.exhausted){const hh=D.hint(W,s,hist,null);assert.equal(hh.kind,'undo');assert.ok(hh.steps>=1);
        assert.ok(D.route(W,hist[hist.length-hh.steps]).moves,'undo-to-here lands on a state that can finish');
        for(let j=1;j<hh.steps;j++)assert.ok(!D.route(W,hist[hist.length-j]).moves,'and it is the most recent one');found++;break;}}}
  assert.ok(found,'found a dead end to test');
}

// Tiers and score.
{
  const base={moves:20,par:20,hints:0,assist:'puzzle',types:6,sealed:6};
  assert.equal(D.score({...base,solved:true}).tier,'perfect');assert.equal(D.score({...base,solved:true}).score,100);
  assert.equal(D.score({...base,solved:true,assist:'guided'}).tier,'perfect','Guided only shows legal drops');
  assert.equal(D.score({...base,solved:true,assist:'relaxed'}).tier,'good','Relaxed is never Perfect');
  assert.equal(D.score({...base,solved:true,hints:1}).tier,'good');
  const over=D.score({...base,solved:true,moves:23});assert.equal(over.tier,'good');assert.ok(over.score<100&&over.score>=55);
  assert.ok(D.score({...base,solved:true,moves:21}).score>D.score({...base,solved:true,moves:30}).score);
  assert.equal(D.score({...base,solved:false,sealed:3}).tier,'partial','half the bays sealed');
  assert.equal(D.score({...base,solved:false,sealed:2}).tier,'failed');
  assert.equal(D.score({...base,solved:false,sealed:0}).score,0);
  assert.equal(D.score({...base,types:5,solved:false,sealed:3}).tier,'partial');
  assert.equal(D.score({...base,types:5,solved:false,sealed:2}).tier,'failed');
  const a=D.score({auto:true});assert.equal(a.tier,'auto');assert.ok(a.score<D.score({...base,solved:true,moves:99,hints:9}).score,'auto scores below any solve');
}

// Auto fallback: follows a best route until half the types are sealed, from the start or from a mid-game board.
for(const d of D.DIFFICULTIES)for(let seed=1;seed<=10;seed++){
  const G=D.generate(seed,d.id),r=D.autoFallback(G,G.start);
  assert.equal(r.sealed,Math.ceil(G.types/2),'auto seals half');assert.ok(!D.solved(G,r.state));
  assert.deepEqual(play(G,G.start,r.moves.map(m=>m.move)),r.state);
  assert.ok(r.moves.length<G.par);
}

// Near-miss: names the costliest played move; nothing for a par solve.
{
  const G=D.generate(11,'normal'),states=[G.start];let s=G.start;for(const m of G.solution){s=D.apply(G,s,m).state;states.push(s);}
  assert.equal(D.nearMiss(G,states,G.solution),'');
  // A detour: one wasted move first (hold-free normal: shuttle a crate to an empty bay and back is 2 extra).
  const first=D.legalMoves(G,G.start).find(m=>{const r=D.apply(G,G.start,m);return D.solve(G,r.state).moves.length>=G.par;});
  const after=D.apply(G,G.start,first).state,rest=D.solve(G,after).moves,all=[first,...rest],st=[G.start];let x=G.start;for(const m of all){x=D.apply(G,x,m).state;st.push(x);}
  const line=D.nearMiss(G,st,all);assert.match(line,/^Move 1 \(/);assert.match(line,/extra move/);assert.match(line,/A best route moved/);
}

// Output wording.
{const G=D.generate(2,'easy'),end=play(G,G.start,G.solution);assert.match(D.output(G,end),/^Depot sorted: 4 bays ready for tonight’s .+\.$/);
  assert.match(D.output(G,G.start,'Partly sorted'),/^Partly sorted: 0 bays/);}

const secs=(Date.now()-t0)/1000;
assert.ok(secs<25,'stays quick');
console.log(`PASS depot-sorting model: determinism, ${SEEDS*D.DIFFICULTIES.length} depots (${SEEDS}/difficulty) replayed to solved in exactly par, par optimal by A* (BFS-confirmed on ${bfsChecked}), par ranges ${JSON.stringify(parStats)}, run/partial pours, hold of one, seals and wanted-type bays, invalid moves return the same untouched state, ${cascades} Relaxed cascades (${cascadeMoves} moves) all sealing and never breaking solvability, ${hintChecks} hints each one step down a best route, hint-only play = par, undo-to-here (dead ends and budget), tiers, auto = half sealed below any solve, near-miss lines (${secs.toFixed(1)}s)`);
