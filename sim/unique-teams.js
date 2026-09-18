// ============================================================================
//  Same questions as diversity.js, but teams must be UNIQUE characters - no
//  duplicates, which is the rule.  Also reports what banning duplicates costs
//  the ceiling, since the previous run's best teams all doubled up.
//
//  Slow - a few minutes.  node unique-teams.js
// ============================================================================
const {score}=require('./synergy.js');
const {CHARS}=require('./roster.js');
const NAMES=Object.keys(CHARS);
function mb(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=mb(414141);
const WL=['open','murk','hive','fortress','bloom'];
const SIZE=5, SAMPLE=420;

const seen=new Set(), teams=[];
while(teams.length<SAMPLE){
  const pool=NAMES.slice(), t=[];
  for(let i=0;i<SIZE;i++) t.push(pool.splice(Math.floor(rnd()*pool.length),1)[0]);
  const key=t.slice().sort().join('|');
  if(seen.has(key)) continue; seen.add(key); teams.push(t);
}
const R=teams.map(t=>{
  const per={}; WL.forEach(w=>per[w]=score(t,w,26));
  const vals=WL.map(w=>per[w]);
  return {t,per,avg:vals.reduce((a,b)=>a+b,0)/vals.length};
}).sort((a,b)=>b.avg-a.avg);

const base=R.reduce((a,r)=>a+r.avg,0)/R.length;
console.log(`${R.length} UNIQUE fives of ${NAMES.length} characters (C(21,5)=20349 possible)`);
console.log(`baseline ${base.toFixed(2)}   ceiling ${R[0].avg.toFixed(2)}`);
console.log(`with duplicates allowed the ceiling was 5.62 - banning them costs ${(5.62-R[0].avg).toFixed(2)}\n`);

console.log('TOP 12 UNIQUE TEAMS');
console.log('  team                                     avg   open  murk  hive  fort  bloom');
R.slice(0,12).forEach(r=>console.log('  '+r.t.join(', ').padEnd(41)+
  r.avg.toFixed(2).padEnd(6)+WL.map(w=>r.per[w].toFixed(2).padEnd(6)).join('')));

const N=50, top=R.slice(0,N);
console.log(`\nFREQUENCY IN TOP ${N}  (${N*SIZE} slots; even share ${(N*SIZE/NAMES.length).toFixed(1)})`);
const freq={}; NAMES.forEach(n=>freq[n]=0);
top.forEach(r=>r.t.forEach(n=>freq[n]++));
const ranked=Object.entries(freq).sort((a,b)=>b[1]-a[1]);
ranked.forEach(([n,c])=>console.log('  '+n.padEnd(9)+String(c).padStart(3)+'  '+'#'.repeat(Math.round(c/2))));

console.log('\nBEST TEAM WITHOUT EACH OF THE TOP 5');
const hot=ranked.slice(0,5).map(x=>x[0]);
console.log('  with everyone         '+R[0].avg.toFixed(2)+'   '+R[0].t.join(', '));
hot.forEach(h=>{
  const b=R.find(r=>!r.t.includes(h));
  console.log('  without '+h.padEnd(13)+b.avg.toFixed(2)+'   '+b.t.join(', '));
});
const banAll=R.find(r=>!r.t.some(n=>hot.includes(n)));
console.log('  without all five      '+(banAll?banAll.avg.toFixed(2)+'   '+banAll.t.join(', '):'none in sample'));

console.log('\nDISJOINT TEAMS  (four teams of five = 20 of 21 characters)');
const picked=[], used=new Set();
for(const r of R){ if(r.t.some(n=>used.has(n))) continue; picked.push(r); r.t.forEach(n=>used.add(n)); if(picked.length>=4) break; }
picked.forEach((r,i)=>console.log('  '+(i+1)+'. '+r.avg.toFixed(2)+'   '+r.t.join(', ')));
console.log('  above baseline: '+picked.filter(r=>r.avg>base).length+' of '+picked.length);
