'use strict';
// Signal breach rules: determinism; 200 seeds per difficulty where every daemon is uploadable within the buffer, the
// daemons back to back are longer than the buffer, and the planted overlaps are real; an exact solver checked against
// brute force; a random legal player rarely uploads everything; the pick rule, chained uploads, invalid moves, tiers,
// near-miss, auto fallback and hints; blueprint outputs (improved, complete, fragments that carry over, nothing).
const assert=require('node:assert/strict'),M=require('../../prototypes/signal-decoding-model.js'),K=require('../../prototypes/minigame-kit.js');

const value=(pz,picks)=>M.evaluate(pz,picks).value;
const contains=(a,b)=>{for(let o=0;o+b.length<=a.length;o++)if(b.every((x,i)=>a[o+i]===x))return true;return false;};
// Brute force: every legal pick sequence, no pruning. Independent of the model's solver.
function brute(pz,st=M.create()){let best=value(pz,st.picks);for(const c of M.legal(pz,st))best=Math.max(best,brute(pz,M.act(pz,st,{type:'pick',cell:c}).state));return best;}
// A random legal player, re-measured here with its own generator (independent of the generation gate's samples).
function randomAll(pz,r,runs){let hits=0;for(let i=0;i<runs;i++){let st=M.create();for(;;){const o=M.legal(pz,st);if(!o.length)break;st=M.act(pz,st,{type:'pick',cell:r.pick(o)}).state;}if(M.evaluate(pz,st.picks).uploaded.length===pz.daemons.length)hits++;}return hits/runs;}

assert.equal(M.DIFFICULTIES.length,4);
assert.deepEqual(M.DIFFICULTIES.map(d=>d.target),[30,45,60,90]);
assert.deepEqual(M.DIFFICULTIES.map(d=>d.size),[5,6,6,7]);

// ---- every seed, every difficulty ----------------------------------------------------------------------------------
const report={},rr=K.rng(2077);
for(const d of M.DIFFICULTIES){
  let gate=0,measured=0,spare=0,offOrder=0,buffers=new Set();const ov={};
  for(let seed=1;seed<=200;seed++){
    const pz=M.generate(seed,d.id),where=`${d.id} seed ${seed}`,n=pz.daemons.length;
    if(seed<=20)assert.deepEqual(M.generate(seed,d.id),pz,'same seed, same puzzle');
    assert.equal(pz.grid.length,d.size*d.size);
    assert.ok(pz.grid.every(c=>pz.codes.includes(c))&&pz.codes.length===d.codes&&pz.codes.every(c=>M.CODES.includes(c)));
    assert.equal(n,d.lengths.length);
    assert.deepEqual(pz.daemons.map(x=>x.seq.length).sort(),d.lengths.slice().sort());
    assert.deepEqual(pz.daemons.map(x=>x.name),M.DAEMONS.slice(0,n).map(x=>x.name),'daemons listed in a fixed order');
    assert.ok(M.BLUEPRINTS.includes(pz.blueprint),`${where}: a blueprint is dealt`);
    for(const a of pz.daemons){assert.ok(new Set(a.seq).size>=2);assert.ok(a.fragment.startsWith(`${a.name} fragment of the ${pz.blueprint.name}: `));
      for(const b of pz.daemons)if(a!==b)assert.ok(!contains(a.seq,b.seq),`${where}: one daemon hides inside another`);}
    // Buffer: the overlapped chain plus 0-1 spare, and always shorter than the daemons laid back to back.
    const naive=pz.daemons.reduce((s,x)=>s+x.seq.length,0);assert.equal(pz.naive,naive);
    assert.ok(pz.buffer<naive,`${where}: buffer ${pz.buffer} fits the daemons back to back (${naive})`);
    assert.ok(pz.buffer>=pz.chainLength&&pz.buffer-pz.chainLength<=Math.max(...d.spare),`${where}: spare`);
    spare+=pz.buffer-pz.chainLength;buffers.add(pz.buffer);
    // Overlaps: the planted chain visits every daemon once, each link a real tail-to-head overlap of 1-3 codes.
    assert.equal(pz.links.length,n-1);
    const chainOrder=[pz.links[0].from,...pz.links.map(l=>l.to)];assert.deepEqual(chainOrder.slice().sort(),[...Array(n).keys()]);
    for(const l of pz.links){assert.ok(l.k>=1&&l.k<=3);assert.ok(M.overlap(pz.daemons[l.from].seq,pz.daemons[l.to].seq)>=l.k,`${where}: link`);
      assert.deepEqual(pz.daemons[l.from].seq.slice(-l.k),pz.daemons[l.to].seq.slice(0,l.k));ov[l.k]=(ov[l.k]||0)+1;}
    if(chainOrder.some((j,i)=>j!==i))offOrder++;
    // Every daemon is uploadable within the buffer: par is all of them, the par route is legal and reaches it, and
    // the solver agrees from scratch. Uploading everything always chains (the buffer is shorter than back to back).
    assert.equal(pz.par,n);assert.equal(pz.total,n);
    const route=M.replay(pz,pz.parPath),e=M.evaluate(pz,route.picks);
    assert.equal(e.uploaded.length,n,where);assert.ok(route.picks.length<=pz.buffer);assert.equal(M.status(pz,route),'complete');
    assert.ok(e.chains.length>=1,`${where}: a full breach must chain`);
    assert.equal(M.solve(pz).value,n);
    // Never luck: a random legal player uploads everything at most 10% of the time.
    assert.ok(pz.randomRate<=M.MAX_RANDOM_RATE,`${where}: random rate ${pz.randomRate}`);gate+=pz.randomRate;
    if(seed<=50)measured+=randomAll(pz,rr,100);
    // Skip uploads exactly the first daemon.
    const a=M.auto(pz),ae=M.evaluate(pz,a.state.picks);assert.deepEqual(ae.uploaded,[0],`${where}: auto`);assert.ok(a.score<M.grade(pz,route).score);
  }
  report[d.id]={gateRate:+(gate/200).toFixed(4),measuredRate:+(measured/50).toFixed(4),spare:+(spare/200).toFixed(2),buffers:[...buffers].sort((a,b)=>a-b).join('-'),overlaps:ov,offOrder};
  assert.ok(measured/50<=M.MAX_RANDOM_RATE,`${d.id}: measured random rate ${measured/50}`);
  assert.ok(offOrder>=60,`${d.id}: chain order should usually differ from the listed order (${offOrder}/200)`);
}
assert.ok(Object.values(report).some(r=>r.overlaps[2])&&report.expert.overlaps[3],'overlaps of 2 and sometimes 3 occur');
assert.notDeepEqual(M.generate(1,'easy').grid,M.generate(2,'easy').grid);

// ---- the solver is exact: brute force agrees ------------------------------------------------------------------------
for(const [id,seeds] of [['easy',25],['normal',12],['hard',3]])for(let s=300;s<300+seeds;s++){const pz=M.generate(s,id);assert.equal(brute(pz),pz.par,`${id} ${s} brute force`);}
// Partial positions too: from a random prefix, the solver's best equals brute force.
{const r=K.rng(99);for(let t=0;t<40;t++){const pz=M.generate(r.int(500)+1,r.pick(['easy','normal']));let st=M.create();
  for(let k=r.int(3);k>0;k--){const o=M.legal(pz,st);if(!o.length)break;st=M.act(pz,st,{type:'pick',cell:r.pick(o)}).state;}
  assert.equal(M.solve(pz,st).value,brute(pz,st),'solver exact from a partial route');}}

// ---- rules on a hand-built matrix -----------------------------------------------------------------------------------
const [A,B,C,D]=['1C','55','BD','E9'];
const hand={size:4,buffer:3,codes:[A,B,C,D],grid:[A,B,C,D, B,A,D,C, C,D,A,B, D,C,B,A],
  daemons:[{name:'SCHEMA',seq:[A,B],value:1,fragment:'s'},{name:'TOLERANCE',seq:[B,C],value:1,fragment:'t'}],par:2,total:2,blueprint:M.BLUEPRINTS[0]};
hand.parPath=M.solve(hand).path;hand.parSet=[0,1];
let s=M.create();const snap0=JSON.stringify(s);
assert.deepEqual(M.legal(hand,s),[0,1,2,3],'first pick: top row');
for(const bad of [null,{type:'zap'},{type:'pick',cell:4},{type:'pick',cell:-1},{type:'pick',cell:16},{type:'pick',cell:1.5},{type:'pick'}])assert.ok(M.act(hand,s,bad).error);
assert.equal(JSON.stringify(s),snap0,'invalid moves leave the state untouched');
s=M.act(hand,s,{type:'pick',cell:0}).state;assert.equal(JSON.stringify(M.create()),snap0,'valid moves never mutate their input');
assert.deepEqual(M.activeLine(hand,s),{kind:'col',index:0});assert.deepEqual(M.legal(hand,s),[4,8,12],'second pick: column of the first, used cell excluded');
assert.match(M.act(hand,s,{type:'pick',cell:1}).error,/column 1/);assert.match(M.act(hand,s,{type:'pick',cell:0}).error,/already/);
const pv=M.preview(hand,s,4);assert.deepEqual(pv.newly,[0]);assert.deepEqual(pv.buffer,[A,B]);assert.equal(M.preview(hand,s,1),null);
s=M.act(hand,s,{type:'pick',cell:4}).state;assert.deepEqual(M.evaluate(hand,s.picks).uploaded,[0]);
assert.deepEqual(M.activeLine(hand,s),{kind:'row',index:1});assert.deepEqual(M.legal(hand,s),[5,6,7],'third pick: row of the second');
assert.deepEqual(M.evaluate(hand,s.picks).progress,[2,1],'B is the first code of TOLERANCE');
// Chaining: SCHEMA ends in B, TOLERANCE starts with it. Three picks (buffer 3, back to back 4) upload both.
s=M.act(hand,s,{type:'pick',cell:7}).state;const e=M.evaluate(hand,s.picks);
assert.deepEqual(e.buffer,[A,B,C]);assert.deepEqual(e.uploaded,[0,1]);assert.equal(e.value,2);assert.equal(M.status(hand,s),'complete');
assert.deepEqual(e.spans,{0:[0,2],1:[1,3]});assert.deepEqual(e.chains,[{from:0,to:1,start:1,end:2}],'slot 2 (55) did double duty');
assert.equal(M.overlap([A,B],[B,C]),1);assert.equal(M.overlap([B,C],[A,B]),0);assert.equal(M.overlap([A,B,C],[B,C,D]),2);
assert.match(M.act(hand,s,{type:'pick',cell:3}).error,/closed/);assert.equal(M.grade(hand,s).tier,'perfect');assert.equal(M.grade(hand,s).nearMiss,'');
assert.match(M.grade(hand,s).headline,/^Full breach: all 2 daemons in 3 of 3 slots, 1 chained\.$/);
assert.equal(M.grade(hand,s,{hints:1}).tier,'good','a hint caps Perfect at Good');assert.match(M.grade(hand,s,{hints:1}).nearMiss,/hint.*improved blueprint/);
// Blueprint outputs: Perfect = complete and improved; Good = complete; Partial = fragments that carry over; Failed = none.
const BP=M.BLUEPRINTS[0];
assert.equal(M.grade(hand,s).output,`Blueprint complete and improved: ${BP.name} (${BP.improved}). Logistics can build it: it ${BP.use}.`);
assert.deepEqual([M.grade(hand,s).blueprint.state,M.grade(hand,s).blueprint.carry],['improved',0]);
assert.equal(M.grade(hand,s,{hints:1}).output,`Blueprint complete: ${BP.name}. Logistics can build it: it ${BP.use}.`,'hint-capped: complete, not improved');
// Uploads without overlap do not chain.
assert.deepEqual(M.evaluate({...hand,buffer:6},[0,4,6,2]).chains,[]);
// Progress resets after a mismatch; a daemon counts anywhere in the buffer, not just at its end.
const prog=M.evaluate(hand,[1,5,6]);assert.deepEqual(prog.buffer,[B,A,D]);assert.deepEqual(prog.uploaded,[]);assert.deepEqual(prog.progress,[0,0]);
assert.deepEqual(M.evaluate(hand,[0,4,6]).uploaded,[0],'AB D still holds SCHEMA');
// Undo steps back one pick; disconnect ends early and keeps what is uploaded.
assert.deepEqual(M.undo(hand,s).picks,[0,4]);assert.deepEqual(M.undo(hand,M.create()).picks,[]);
const dc=M.act(hand,M.replay(hand,[0,4]),{type:'disconnect'}).state;assert.equal(M.status(hand,dc),'disconnected');assert.equal(M.grade(hand,dc).value,1);
assert.equal(M.grade(hand,dc).tier,'good','all but one is Good');
assert.equal(M.grade(hand,dc).nearMiss,`Instead of disconnecting after 2 picks, BD at row 2, column 4 would have uploaded all 2 daemons and recovered the whole ${BP.name} blueprint: 55 finishes SCHEMA while starting TOLERANCE.`);
assert.equal(M.grade(hand,dc).output,`Blueprint complete: ${BP.name}. Research rebuilt the missing TOLERANCE fragment from the rest. Logistics can build it: it ${BP.use}.`);
assert.equal(M.grade(hand,dc).blueprint.state,'complete');
assert.equal(M.grade(hand,M.create()).output,'','nothing uploaded, nothing delivered');assert.equal(M.grade(hand,M.create()).blueprint.state,'none');
assert.match(M.grade(hand,M.create()).headline,/Null transmission stays scrambled/);
// Full buffer ends the breach; so does an active line with no free cell.
const fullPz={...hand,buffer:4,daemons:[{name:'X',seq:[D,D,A],value:1},{name:'Y',seq:[C,C,A],value:1}]};
const f=M.replay(fullPz,[0,4,5,1]);assert.equal(M.status(fullPz,f),'full');assert.deepEqual(M.legal(fullPz,f),[]);
const tiny={size:2,buffer:6,codes:[A,B],grid:[A,B,B,A],daemons:[{name:'X',seq:[A,A,A],value:1},{name:'Y',seq:[B,B,B],value:1}],par:0,total:2};
const stuck=M.replay(tiny,[0,2,3,1]);assert.equal(M.status(tiny,stuck),'stuck');assert.equal(M.hint(tiny,stuck),null);

// ---- tiers and near-miss on generated puzzles -----------------------------------------------------------------------
for(const d of M.DIFFICULTIES)for(let seed=1;seed<=30;seed++){
  const pz=M.generate(seed,d.id),n=pz.par;
  assert.equal(M.tierOf(pz,n),'perfect');assert.equal(M.tierOf(pz,n-1),'good');assert.equal(M.tierOf(pz,0),'failed');
  if(n>=3)assert.equal(M.tierOf(pz,1),'partial');
  // A first pick that breaks every full route gets a concrete, correct near-miss naming the overlap that was missed.
  const wrong=M.legal(pz,M.create()).find(c=>M.solve(pz,{picks:[c],disconnected:false}).value<n);
  if(wrong!==undefined){const st=M.act(pz,M.replay(pz,[wrong]),{type:'disconnect'}).state,g=M.grade(pz,st);assert.notEqual(g.tier,'perfect');
    const m=g.nearMiss.match(/^Taking (\w\w) at row 1, column (\d) as your first pick would have uploaded all (\d) daemons and recovered the whole ([\w ]+) blueprint: ([0-9A-F ]+) finishes (\w+) while starting (\w+)\.$/);assert.ok(m,g.nearMiss);
    assert.equal(m[4],pz.blueprint.name);m.splice(4,1);
    const cell=+m[2]-1;assert.equal(pz.grid[cell],m[1]);assert.equal(+m[3],n);assert.equal(M.solve(pz,M.replay(pz,[cell])).value,n,'the named pick really uploads everything');
    const shared=m[4].split(' '),from=pz.daemons.find(x=>x.name===m[5]),to=pz.daemons.find(x=>x.name===m[6]);
    assert.deepEqual(from.seq.slice(-shared.length),shared);assert.deepEqual(to.seq.slice(0,shared.length),shared);}
}
const g0=M.grade(M.generate(5,'easy'),{picks:[],disconnected:true});assert.equal(g0.tier,'failed');assert.equal(g0.output,'');assert.match(g0.nearMiss,/^Starting with \w\w at row 1, column \d would have uploaded all 2 daemons and recovered the whole [\w ]+ blueprint: /);
// A partial breach on a generated puzzle: the fragments recovered carry over toward its blueprint.
{const pz=M.generate(4,'hard');let st=M.create();for(const c of pz.parPath){st=M.act(pz,st,{type:'pick',cell:c}).state;if(M.evaluate(pz,st.picks).uploaded.length===1)break;}
  st=M.act(pz,st,{type:'disconnect'}).state;const g=M.grade(pz,st),got=M.evaluate(pz,st.picks).uploaded;
  assert.equal(g.tier,'partial');assert.equal(g.blueprint.state,'fragments');assert.equal(g.blueprint.carry,1);
  assert.match(g.output,new RegExp(`^1 of 3 fragments toward the ${pz.blueprint.name} blueprint \\(${pz.daemons[got[0]].name}\\)\\. They carry over: \\w+ and \\w+ still to recover\\.$`));}

// ---- auto fallback --------------------------------------------------------------------------------------------------
for(const d of M.DIFFICULTIES)for(let seed=1;seed<=40;seed++){
  const pz=M.generate(seed,d.id),a=M.auto(pz);
  assert.deepEqual(M.auto(pz),a,'auto is deterministic');
  assert.equal(M.replay(pz,a.state.picks).picks.length,a.state.picks.length,'auto plays legal picks');
  assert.deepEqual(M.evaluate(pz,a.state.picks).uploaded,[0],'auto uploads only the first daemon');
  assert.equal(a.output,`1 of ${pz.daemons.length} fragments toward the ${pz.blueprint.name} blueprint (${pz.daemons[0].name}). They carry over: ${M.DAEMONS.slice(1,pz.daemons.length).map(x=>x.name).join(', ').replace(/, (\w+)$/,' and $1')} still to recover.`);
  assert.equal(a.blueprint.carry,1);assert.equal(a.value,1);assert.ok(a.score<100);assert.match(a.nearMiss,/Planning the route yourself/);
}

// ---- hints are always on an optimal route ---------------------------------------------------------------------------
const r=K.rng(7);let disc=0;
for(let t=0;t<300;t++){
  const d=r.pick(M.DIFFICULTIES),pz=M.generate(r.int(4000)+1,d.id);let st=M.create();
  for(let k=r.int(pz.buffer);k>0;k--){const o=M.legal(pz,st);if(!o.length)break;st=M.act(pz,st,{type:'pick',cell:r.pick(o)}).state;}
  if(M.status(pz,st)!=='playing'){assert.equal(M.hint(pz,st),null);continue;}
  const best=M.solve(pz,st).value,h=M.hint(pz,st);
  if(h.disconnect){disc++;assert.equal(best,value(pz,st.picks));continue;}
  assert.ok(M.legal(pz,st).includes(h.cell),'hint is a legal pick');
  assert.equal(M.solve(pz,M.act(pz,st,{type:'pick',cell:h.cell}).state).value,best,'hint keeps the best result reachable');
  let f=st;while(M.status(pz,f)==='playing'){const x=M.hint(pz,f);if(x.disconnect)break;f=M.act(pz,f,{type:'pick',cell:x.cell}).state;}
  assert.equal(value(pz,f.picks),best,'following hints reaches the best result');
}
// From a fresh breach, following hints always uploads every daemon.
for(const d of M.DIFFICULTIES)for(let seed=1;seed<=10;seed++){const pz=M.generate(seed,d.id);let f=M.create();
  while(M.status(pz,f)==='playing'){const x=M.hint(pz,f);if(x.disconnect)break;f=M.act(pz,f,{type:'pick',cell:x.cell}).state;}
  assert.equal(M.status(pz,f),'complete');}

console.log(`PASS signal-decoding unit: 800 seeds all-uploadable within a buffer shorter than back to back, overlaps planted (${JSON.stringify(report)}), brute-force-exact solver, pick rule, chaining, invalid moves, end states, tiers, near-miss, blueprint outputs (improved/complete/fragments carry over/none), auto, ${300-disc} hint walks.`);
