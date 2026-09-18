// ---------------------------------------------------------------------------
// designer -> composer -> evaluator, run in generations.  Characters that keep
// turning up in good rosters survive and get mutated; the rest are replaced.
// ---------------------------------------------------------------------------
function mb(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const {TEMPLATES,make}=require('./designer.js');
const {compose,tagCount}=require('./composer.js');
const {evaluate}=require('./evaluator.js');
const TKEYS=Object.keys(TEMPLATES);
const TAGS=['Hull','Blight','Drive','Ordnance','Assay','Crew'];
const rnd=mb(90210);

const POOL=48, GENS=Number(process.argv[2]||3), TEAMS=Number(process.argv[3]||26);
let pool=[];
for(let i=0;i<POOL;i++) pool.push(make(rnd,TKEYS[i%TKEYS.length],0));
pool.forEach((c,i)=>c.id='c'+i);

function mutate(c,gen){
  const d=make(rnd,c.tmpl,gen);
  // keep roughly half of what worked
  Object.keys(d).forEach(k=>{ if(['tmpl','tags','gen'].includes(k))return;
    if(rnd()<0.5 && c[k]!==undefined) d[k]=c[k]; });
  d.id=c.id+'m'+gen; d.parent=c.id;
  return d;
}
let history=[];
for(let g=1;g<=GENS;g++){
  const rosters=[];
  for(let i=0;i<TEAMS;i++){
    const tag=TAGS[Math.floor(rnd()*TAGS.length)];
    const t=compose(pool,rnd,5,tag);
    if(!t) continue;
    const r=evaluate(t,t.map(c=>c.id),16);
    r.team=t; r.target=tag; r.tags=tagCount(t);
    rosters.push(r);
  }
  // niche by target tag so one strong archetype cannot crowd out the rest
  const byTag={};
  rosters.forEach(r=>{ (byTag[r.target]=byTag[r.target]||[]).push(r); });
  Object.values(byTag).forEach(list=>list.sort((a,b)=>b.fit-a.fit));
  const credit={};
  Object.values(byTag).forEach(list=>
    list.slice(0,Math.max(1,Math.ceil(list.length/2))).forEach(r=>
      r.team.forEach(c=>credit[c.id]=(credit[c.id]||0)+r.fit)));
  rosters.sort((a,b)=>b.fit-a.fit);
  pool.forEach(c=>c.score=credit[c.id]||0);
  pool.sort((a,b)=>b.score-a.score);
  const keep=pool.slice(0,Math.floor(POOL*0.5));
  const bred=keep.slice(0,Math.floor(POOL*0.25)).map(c=>mutate(c,g));
  const fresh=[];
  while(keep.length+bred.length+fresh.length<POOL){
    const c=make(rnd,TKEYS[Math.floor(rnd()*TKEYS.length)],g);
    c.id='g'+g+'n'+fresh.length; fresh.push(c);
  }
  pool=keep.concat(bred,fresh);
  const champs=Object.entries(byTag).map(([t,l])=>l[0]).sort((a,b)=>b.fit-a.fit);
  console.log('gen '+g+'  '+champs.map(c=>c.target+' '+c.fit.toFixed(2)).join('   '));
  history.push({gen:g,rosters:champs});
}
const final=history[history.length-1].rosters;
console.log('\nBEST ROSTER PER ARCHETYPE, FINAL GENERATION');
final.forEach((r,i)=>{
  console.log('\n#'+(i+1)+'  fit '+r.fit+'   power '+r.power+'  interest '+r.interest);
  console.log('   tags: '+Object.entries(r.tags).filter(([,v])=>v>=2)
    .map(([k,v])=>k+'\u00d7'+v).join(' '));
  console.log('   avg '+r.avg+'  spread '+r.spread+'x  biggest '+r.big+'  ev/rnd '+r.ev);
  r.team.forEach(c=>{
    const kit=Object.entries(c).filter(([k])=>
      !['tmpl','tags','gen','spent','id','score','parent'].includes(k))
      .map(([k,v])=>k+':'+v).join(' ');
    console.log('     '+c.tmpl.padEnd(9)+'['+c.tags.join('/')+'] '+kit);
  });
});
require('fs').writeFileSync('best.json',JSON.stringify(final,null,1));
