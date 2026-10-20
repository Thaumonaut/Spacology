'use strict';
const assert=require('node:assert/strict');
const M=require('../../prototypes/minigames/element-pairs/element-pairs-model.js');
const board=(entries,used=0)=>{const cells=Array(36).fill(null);for(const [i,v] of entries)cells[i]=v;return {cols:6,cells,used,moves:0};};
const opening=M.generate(42);
const smallBatches={...opening,batches:opening.batches.map(batch=>batch.slice(0,12))};
function newlyOpened(s,pair,result){
  const shifts=new Map(result.shifts.map(({from,to})=>[from,to]));
  const prior=new Set(M.pairs(s).filter(p=>!p.some(i=>pair.includes(i))).map(p=>p.map(i=>shifts.get(i)??i).sort((a,b)=>a-b).join(':')));
  return M.pairs(result.state).filter(p=>!prior.has(p.join(':')));
}

for(const a of M.ELEMENTS)for(const b of M.ELEMENTS){
  const expected=a===b||M.OPPOSITE[a]===b;
  assert.equal(M.compatible(a,b),expected,`${a} + ${b}`);
  assert.equal(M.inspect(board([[0,a],[1,b]]),0,1).ok,expected);
}
assert.equal(M.compatible(null,null),false);assert.equal(M.compatible('fire','fire'),false);
assert.deepEqual(M.FAMILIES,[['order','chaos'],['growth','decay'],['energy','void']]);

// All eight rays, both selection orders, with gaps. Even a compatible intervening cell blocks.
for(const [a,b,middle] of [[14,12,13],[14,16,15],[14,2,8],[14,26,20],[14,0,7],[14,4,9],[14,24,19],[14,28,21]]){
  const s=board([[a,'order'],[b,'chaos']]);
  assert.equal(M.inspect(s,a,b).ok,true);assert.equal(M.inspect(s,b,a).ok,true);
  s.cells[middle]='order';const copy=structuredClone(s),rejected=M.match(s,a,b);
  assert.equal(rejected.ok,false);assert.equal(rejected.blocker,middle);assert.strictEqual(rejected.state,s);assert.deepEqual(s,copy);
}

// Jacob's example: third cell of one row to last cell of the following row, through reading order.
for(const [a,b] of [[2,11],[11,2],[5,6],[6,5],[0,35],[35,0]]){
  const s=board([[a,'order'],[b,'order']]);assert.equal(M.inspect(s,a,b).ok,true);
  if(Math.abs(a-b)>1){
    const blocker=Math.min(a,b)+1;s.cells[blocker]='growth';
    // Some endpoints also have a geometric line. Obstruct it independently.
    const ar=Math.floor(a/6),ac=a%6,br=Math.floor(b/6),bc=b%6;
    if(Math.abs(ar-br)===Math.abs(ac-bc))s.cells[(ar+Math.sign(br-ar))*6+ac+Math.sign(bc-ac)]='growth';
    assert.equal(M.inspect(s,a,b).ok,false);
  }
}
assert.equal(M.inspect(board([[2,'order'],[11,'chaos']]),2,11).line,'wrap');
const wrapView=M.sightlines(board([[2,'order'],[11,'chaos'],[17,'growth']]),2);
assert.deepEqual(wrapView.find(line=>line.target===11),{target:11,ok:true,path:[3,4,5,6,7,8,9,10],line:'wrap',kind:'opposite'});
assert.ok(!wrapView.some(line=>line.target===17),'a tile beyond a blocker is not in sight');
assert.equal(M.sightlines(board([[0,'order'],[1,'growth']]),0)[0].ok,false,'visible incompatibles are distinguished');
assert.deepEqual(M.sightlines(board([]),0),[]);assert.deepEqual(M.sightlines(board([]),null),[]);
// A blocked reading-order path does not veto a clear vertical/diagonal path.
assert.equal(M.inspect(board([[0,'order'],[12,'order'],[3,'growth']]),0,12).line,'column');
assert.equal(M.inspect(board([[0,'order'],[14,'order'],[3,'growth']]),0,14).line,'diagonal');
// No arbitrary slope through an obstruction; no wrapping diagonals.
assert.equal(M.inspect(board([[0,'order'],[8,'order'],[4,'growth']]),0,8).ok,false);
assert.equal(M.inspect(board([[5,'order'],[12,'order'],[9,'growth']]),5,12).ok,false);
for(const [a,b] of [[0,0],[-1,1],[0,36],[0,1.5],[0,NaN]])assert.equal(M.inspect(board([[0,'order']]),a,b).ok,false);

const s=board([[0,'order'],[2,'chaos'],[7,'growth']]),copy=structuredClone(s),matched=M.match(s,0,2);
assert.equal(matched.ok,true);assert.deepEqual(s,copy);assert.equal(matched.state.cells[1],'growth');assert.equal(matched.state.cells[7],null);assert.deepEqual(matched.clearedRows,[0]);
assert.equal(matched.state.moves,1);assert.equal(M.remaining(matched.state),1);
assert.equal(M.status(board([])),'won');
assert.equal(M.status(board([[0,'order'],[1,'growth']])),'stuck');
assert.equal(M.status(board([[0,'order'],[1,'growth']],4)),'lost');
assert.equal(M.status(board([[0,'order'],[1,'chaos']],4)),'playing');

// Only whole empty rows disappear; partial-row gaps and all surviving columns are preserved.
const partial=board([[0,'order'],[1,'chaos'],[5,'growth'],[13,'energy']]);
const kept=M.match(partial,0,1);assert.deepEqual(kept.clearedRows,[]);assert.equal(kept.state.cells[5],'growth');assert.equal(kept.state.cells[13],'energy');assert.deepEqual(kept.shifts,[]);
const middle=board([[0,'growth'],[6,'order'],[11,'chaos'],[13,'energy'],[22,'void']]);
const middleBefore=structuredClone(middle),collapsed=M.match(middle,6,11);
assert.deepEqual(collapsed.clearedRows,[1]);assert.equal(collapsed.state.cells[0],'growth');assert.equal(collapsed.state.cells[7],'energy');assert.equal(collapsed.state.cells[16],'void');assert.equal(collapsed.state.cells.length,36);assert.deepEqual(middle,middleBefore);
assert.deepEqual(collapsed.shifts,[{from:13,to:7},{from:22,to:16}]);
const twoRows=M.match(board([[0,'order'],[6,'chaos'],[14,'growth']]),0,6);
assert.deepEqual(twoRows.clearedRows,[0,1]);assert.equal(twoRows.state.cells[2],'growth');assert.equal(twoRows.state.lines,2);
const lastRow=M.match(board([[0,'growth'],[24,'order'],[29,'chaos']]),24,29);
assert.deepEqual(lastRow.clearedRows,[4]);assert.equal(lastRow.state.cells[0],'growth');assert.equal(lastRow.state.cells.length,36);
let chain=board([[0,'order'],[1,'growth'],[2,'energy'],[3,'void'],[4,'decay'],[5,'chaos']]);
assert.equal(M.inspect(chain,1,4).ok,false);assert.equal(M.inspect(chain,0,5).ok,false);
chain=M.match(chain,2,3).state;assert.equal(M.inspect(chain,1,4).ok,true);assert.equal(M.inspect(chain,0,5).ok,false);
chain=M.match(chain,1,4).state;assert.equal(M.inspect(chain,0,5).ok,true);assert.equal(M.status(M.match(chain,0,5).state),'won');

// Deal immediately after the final occupied cell; earlier holes and coordinates survive unchanged.
let d=board([[0,'order'],[8,'growth']]),before=structuredClone(d);
const dealt=M.deal(smallBatches,d);assert.equal(dealt.ok,true);assert.equal(dealt.first,9);
assert.deepEqual(d,before);assert.deepEqual(dealt.state.cells.slice(0,9),d.cells.slice(0,9));
assert.deepEqual(dealt.state.cells.slice(9,21),smallBatches.batches[0]);assert.equal(dealt.state.cells.length%6,0);
assert.equal(dealt.state.cells[3],null);assert.equal(dealt.state.cells[8],'growth');
d=dealt.state;
for(let k=1;k<4;k++)d=M.deal(smallBatches,d).state;
assert.equal(d.used,4);assert.equal(M.remaining(d),50);
const fifth=M.deal(opening,d);assert.equal(fifth.ok,false);assert.strictEqual(fifth.state,d);
assert.equal(M.deal(opening,board([])).ok,false);

// One solution spans the whole finite puzzle; the opening cannot clear by itself.
let wrapped=0,diagonal=0,openingTotal=0,chainOpenings=0,longTotal=0,unlockedTotal=0,minChain=Infinity;
const reserveUse=new Set();let deadEnds=0,timingChanges=0;
for(let seed=1;seed<=200;seed++){
  const p=M.generate(seed);assert.deepEqual(p,M.generate(seed));
  assert.equal(p.initial.length,36);assert.equal(p.cols,8);assert.equal(p.rows,24);assert.equal(p.batches.length,4);assert.ok(p.batches.every(b=>b.length===36));
  const counts=M.FAMILIES.map(family=>p.initial.filter(id=>family.includes(id)).length);
  assert.ok(counts.some(n=>n%2===1),'an odd family count makes reserve material necessary');
  let state=M.start(p);const original=structuredClone(state);
  assert.equal(state.cells.length,192);assert.equal(M.remaining(state),36);assert.ok(state.cells.slice(36).every(id=>id===null));
  assert.ok(M.pairs(state).length>0,'every opening is playable');
  openingTotal+=M.pairs(state).length;
  const hasChain=M.pairs(state).some(pair=>{
    const second=M.match(state,...pair);
    return newlyOpened(state,pair,second).some(next=>{
      const third=M.match(second.state,...next);
      return newlyOpened(second.state,next,third).length>0;
    });
  });
  if(hasChain)chainOpenings++;
  for(let k=0;k<4;k++)state=M.deal(p,state).state;
  assert.equal(state.cells.length,192);assert.equal(M.remaining(state),180);
  let opened=[],run=0,long=0,unlocked=0,maxChain=0;
  for(const [a,b] of p.witness){
    const move=M.match(state,a,b);assert.equal(move.ok,true,`seed ${seed}: full puzzle witness`);
    if(move.path.length){long++;if(opened.some(p=>p[0]===a&&p[1]===b)){unlocked++;run++;}else run=0;}else run=0;
    maxChain=Math.max(maxChain,run);opened=newlyOpened(state,[a,b],move);
    if(move.line==='wrap')wrapped++;if(move.line==='diagonal')diagonal++;state=move.state;
  }
  assert.ok(long>=70,`seed ${seed}: long matches dominate the full solution`);
  assert.ok(unlocked>=60,`seed ${seed}: moves expose subsequent matches`);
  assert.ok(maxChain>=10,`seed ${seed}: a sustained unlock chain exists`);
  longTotal+=long;unlockedTotal+=unlocked;minChain=Math.min(minChain,maxChain);
  assert.equal(M.status(state),'won');assert.deepEqual(M.start(p),original);
  const play=early=>{
    let s=M.start(p);
    while(!['won','lost'].includes(M.status(s))){
      const pairs=M.pairs(s);
      s=s.used<4&&(!pairs.length||(early&&M.remaining(s)<=12))?M.deal(p,s).state:M.match(s,...pairs[0]).state;
    }
    assert.ok(s.used>0);return s;
  };
  const late=play(false),early=play(true);reserveUse.add(late.used);
  if(M.status(late)==='lost')deadEnds++;
  if(M.status(late)!==M.status(early))timingChanges++;
  // Fast legal-pair discovery agrees exactly with the public pair validator on a changing board.
  state=M.start(p);
  for(let step=0;step<5;step++){
    const expected=[];
    for(let a=0;a<state.cells.length;a++)for(let b=a+1;b<state.cells.length;b++)if(M.inspect(state,a,b).ok)expected.push(`${a}:${b}`);
    const actual=M.pairs(state).map(pair=>pair.join(':'));
    assert.deepEqual(actual.slice().sort(),expected.sort());assert.equal(actual.length,new Set(actual).size);
    for(let a=0;a<state.cells.length;a++)if(state.cells[a]!==null){
      const highlighted=M.sightlines(state,a).filter(line=>line.ok).map(line=>line.target).sort((a,b)=>a-b);
      assert.deepEqual(highlighted,expected.flatMap(pair=>{const [x,y]=pair.split(':').map(Number);return x===a?[y]:y===a?[x]:[];}).sort((a,b)=>a-b));
    }
    if(!actual.length)break;
    state=M.match(state,...M.pairs(state)[0]).state;
  }
}
const tooFull={cols:8,rows:24,cells:Array(192).fill('order'),used:0,moves:0};
assert.equal(M.deal(opening,tooFull).ok,false,'a deal cannot exceed the fixed board');
assert.ok(wrapped>0);assert.ok(diagonal>0);
assert.ok(reserveUse.size>1);assert.ok(deadEnds>0);assert.ok(timingChanges>0,'deal timing changes outcomes, not just the counter');
assert.ok(openingTotal/200<=16.5,'sampled openings reduce easy pairs from the previous mean of 22.8');
assert.ok(chainOpenings>=190,'three-step unlock chains exist during opening play, not only in the all-dealt witness');
assert.notDeepEqual(M.generate(42).initial,M.generate(43).initial);
console.log('PASS element pairs: compatibility/sightlines, whole-row collapse, undo-safe snapshots, finite reserves and 200 seeded solutions.');
console.log(JSON.stringify({seeds:200,meanOpeningPairs:openingTotal/200,openingsWithThreeStepChains:chainOpenings,meanLongWitnessMoves:longTotal/200,meanNewlyUnlockedWitnessMoves:unlockedTotal/200,minimumSustainedChain:minChain}));
