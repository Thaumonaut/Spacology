const {score}=require('./synergy.js');
const {CHARS,WORLDS}=require('./roster.js');
const NAMES=Object.keys(CHARS);
function mb(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=mb(20260909);
const WL=['open','murk','hive','fortress','bloom'];

// sample teams of five, duplicates allowed (doubling a tag is a real choice)
const seen=new Set(), teams=[];
while(teams.length<220){
  const t=[]; for(let i=0;i<5;i++) t.push(NAMES[Math.floor(rnd()*NAMES.length)]);
  const key=t.slice().sort().join('|');
  if(seen.has(key)) continue; seen.add(key); teams.push(t);
}
const results=teams.map(t=>{
  const per={}; WL.forEach(w=>per[w]=score(t,w,26));
  const vals=WL.map(w=>per[w]);
  return {t,per,avg:vals.reduce((a,b)=>a+b,0)/vals.length,
          best:Math.max(...vals),worst:Math.min(...vals)};
});
results.sort((a,b)=>b.avg-a.avg);
console.log('TOP TEAMS BY AVERAGE ACROSS FIVE WORLDS');
console.log('team                                        avg   open  murk  hive  fort  bloom');
results.slice(0,10).forEach(r=>console.log('  '+r.t.join(', ').padEnd(42)+
  r.avg.toFixed(2).padEnd(6)+WL.map(w=>r.per[w].toFixed(2).padEnd(6)).join('')));
console.log('\nMOST WORLD-DEPENDENT (biggest gap between best and worst planet)');
const swing=results.slice().sort((a,b)=>(b.best-b.worst)-(a.best-a.worst));
swing.slice(0,6).forEach(r=>console.log('  '+r.t.join(', ').padEnd(42)+
  'swing '+(r.best-r.worst).toFixed(2)+'   '+WL.map(w=>w[0]+':'+r.per[w].toFixed(2)).join(' ')));

// which tag counts actually lift a team
const {CHARS:C}=require('./roster.js');
const lift={};
results.forEach(r=>{
  const c={}; r.t.forEach(n=>C[n].tags.forEach(g=>c[g]=(c[g]||0)+1));
  Object.entries(c).forEach(([g,v])=>{
    const k=g+'x'+Math.min(4,v);
    (lift[k]=lift[k]||[]).push(r.avg); });
});
const overall=results.reduce((a,r)=>a+r.avg,0)/results.length;
console.log('\nTAG LIFT  (average team score when this many of a tag are present)');
console.log('  baseline across all sampled teams: '+overall.toFixed(2));
Object.entries(lift).filter(([,v])=>v.length>=8)
  .map(([k,v])=>[k,v.reduce((a,b)=>a+b,0)/v.length,v.length])
  .sort((a,b)=>b[1]-a[1]).forEach(([k,m,n])=>
    console.log('  '+k.padEnd(12)+m.toFixed(2)+'   ('+(m/overall>=1?'+':'')+
      ((m/overall-1)*100).toFixed(0)+'%, n='+n+')'));
require('fs').writeFileSync('search.json',JSON.stringify(results.slice(0,40),null,1));
