const {evaluate,FOES}=require('./engine.js');
const BUILDS=require('./builds.js');
const KINDS=Object.keys(FOES);

// a realistic encounter: mostly chaff with a few of one archetype mixed in
function scene(d,kind){
  return {pool:16,field:8,hpBase:Math.round(60*d),dmgBase:Math.round(12*d),
          mix:kind==='chaff'?[['chaff',16]]:[['chaff',8],[kind,8]]};
}
function breakpoint(P,kind){
  let lo=0.4, hi=2.6, best=lo;
  for(let i=0;i<6;i++){
    const mid=(lo+hi)/2;
    if(evaluate(P,[scene(mid,kind)],70).winPct>=75){ best=mid; lo=mid; } else hi=mid;
  }
  return +best.toFixed(2);
}
const out=[['build'].concat(KINDS)];
console.log('build                          '+KINDS.map(k=>k.slice(0,8).padEnd(9)).join(''));
BUILDS.forEach(([name,P])=>{
  const row=[name.trim()];
  KINDS.forEach(k=>row.push(breakpoint(P,k)));
  out.push(row);
  console.log(name.padEnd(31)+row.slice(1).map(v=>String(v).padEnd(9)).join(''));
});
// relative difficulty: how far each archetype drags a build below its own average
const rel=[['build'].concat(KINDS)];
out.slice(1).forEach(r=>{
  // normalise on the median: the easy chaff column is an outlier and skews a mean
  const vals=r.slice(1), sorted=vals.slice().sort((a,b)=>a-b);
  const med=sorted.length%2?sorted[(sorted.length-1)/2]
            :(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
  rel.push([r[0]].concat(vals.map(v=>+(v/med).toFixed(2))));
});
require('fs').writeFileSync('counters.csv',out.map(r=>r.join(',')).join('\n'));
require('fs').writeFileSync('counters-rel.csv',rel.map(r=>r.join(',')).join('\n'));
console.log('\nRELATIVE  (1.00 = par for that build; below 0.85 is a hard counter)');
console.log('build                          '+KINDS.map(k=>k.slice(0,8).padEnd(9)).join(''));
rel.slice(1).forEach(r=>console.log(r[0].padEnd(31)+r.slice(1).map(v=>String(v).padEnd(9)).join('')));
