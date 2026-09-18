// ============================================================================
//  Roster diversity.  Is any character mandatory, and how many genuinely
//  different strong teams exist?  Samples random fives, then asks what the best
//  team is with each of the most-used characters banned.
//
//  Slow - a few minutes.  node diversity.js
// ============================================================================
const {score}=require('./synergy.js');
const {CHARS}=require('./roster.js');
const NAMES=Object.keys(CHARS);
function mb(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=mb(77003);
const WL=['open','murk','hive','fortress','bloom'];
const seen=new Set(), teams=[];
while(teams.length<260){
  const t=[]; for(let i=0;i<5;i++) t.push(NAMES[Math.floor(rnd()*NAMES.length)]);
  const key=t.slice().sort().join('|');
  if(seen.has(key)) continue; seen.add(key); teams.push(t);
}
const R=teams.map(t=>{
  const vals=WL.map(w=>score(t,w,26));
  return {t,avg:vals.reduce((a,b)=>a+b,0)/vals.length};
}).sort((a,b)=>b.avg-a.avg);

const N=50, top=R.slice(0,N);
console.log(`sampled ${R.length} random fives; baseline avg ${(R.reduce((a,r)=>a+r.avg,0)/R.length).toFixed(2)}`);
console.log(`top ${N} range ${top[N-1].avg.toFixed(2)} .. ${top[0].avg.toFixed(2)}\n`);

console.log(`CHARACTER FREQUENCY IN TOP ${N} TEAMS  (of ${N*5} slots; even share would be ${(N*5/NAMES.length).toFixed(1)})`);
const freq={}; NAMES.forEach(n=>freq[n]=0);
top.forEach(r=>r.t.forEach(n=>freq[n]++));
Object.entries(freq).sort((a,b)=>b[1]-a[1]).forEach(([n,c])=>{
  const bar='#'.repeat(Math.round(c/2));
  console.log('  '+n.padEnd(9)+String(c).padStart(3)+'  '+bar);
});

console.log('\nBEST TEAM ACHIEVABLE WITHOUT EACH OF THE TOP 5 CHARACTERS');
const hot=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);
console.log('  with everyone          '+R[0].avg.toFixed(2)+'   '+R[0].t.join(', '));
hot.forEach(h=>{
  const best=R.find(r=>!r.t.includes(h));
  console.log('  without '+h.padEnd(14)+best.avg.toFixed(2)+'   '+best.t.join(', '));
});
const banAll=R.find(r=>!r.t.some(n=>hot.includes(n)));
console.log('  without all five       '+(banAll?banAll.avg.toFixed(2)+'   '+banAll.t.join(', '):'none in sample'));

console.log('\nDISJOINT GOOD TEAMS  (greedy: each shares no character with any already taken)');
const picked=[]; const used=new Set();
for(const r of R){ if(r.t.some(n=>used.has(n))) continue; picked.push(r); r.t.forEach(n=>used.add(n)); if(picked.length>=4) break; }
picked.forEach((r,i)=>console.log('  '+(i+1)+'. '+r.avg.toFixed(2)+'   '+r.t.join(', ')));
