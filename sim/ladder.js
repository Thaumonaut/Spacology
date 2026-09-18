const {evaluate}=require('./engine.js');
const BUILDS=require('./builds.js');

// One difficulty knob scales enemy health and damage together.
function scene(d,shape){
  const base={reference:{pool:18,field:9,elitePct:.2},
              swarm:{pool:26,field:9,elitePct:.10},
              elite:{pool:6,field:4,elitePct:.6}}[shape];
  return Object.assign({},base,{
    chaffHp:Math.round(30*d), eliteHp:Math.round(140*d),
    chaffDmg:Math.round(6*d), eliteDmg:Math.round(17*d)});
}
// the difficulty at which a build stops winning three fights in four
function breakpoint(P,shape){
  let lo=0.6, hi=3.4, best=lo;
  for(let i=0;i<7;i++){
    const mid=(lo+hi)/2;
    const w=evaluate(P,[scene(mid,shape)],90).winPct;
    if(w>=75){ best=mid; lo=mid; } else hi=mid;
  }
  return +best.toFixed(2);
}
const out=[['build','shape','breakpoint','win@bp','rounds','ev/rnd','biggest',
            'dot','heal','follows','even','escal','drama']];
console.log('build                             shape      breakpoint  rounds  ev/rnd  biggest  escal');
BUILDS.forEach(([name,P])=>{
  ['reference','swarm','elite'].forEach(shape=>{
    const bp=breakpoint(P,shape);
    const r=evaluate(P,[scene(bp,shape)],150);
    out.push([name.trim(),shape,bp,r.winPct,r.rounds,r.eventsPerRound,r.biggest,
      r.dotDmg,r.healed,r.follows,r.evenness,r.escalation,r.drama]);
    if(shape==='reference')
      console.log(name.padEnd(34)+shape.padEnd(11)+String(bp).padEnd(12)+
        String(r.rounds).padEnd(8)+String(r.eventsPerRound).padEnd(8)+
        String(r.biggest).padEnd(9)+r.escalation);
  });});
require('fs').writeFileSync('ladder.csv',out.map(r=>r.map(String).map(v=>v.replace(/,/g,' ')).join(',')).join('\n'));
console.log('\nrows: '+(out.length-1));
