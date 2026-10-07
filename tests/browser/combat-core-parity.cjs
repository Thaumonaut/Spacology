// @manual: node tests/browser/combat-core-parity.cjs record|check <file>
// Combat parity: drives the live resolver with a seeded Math.random and records every action event, so a refactor of
// the combat rules can be proven to change nothing. Headless.
//   node tests/browser/combat-core-parity.cjs record out.json   — write the event streams
//   node tests/browser/combat-core-parity.cjs check  base.json  — fail on the first difference
//   SPACOLOGY_SESSIONS_OUT=tests/unit/combat-voyage-sessions.json … — also save the voyage states it fought
const {chromium}=require('playwright');const fs=require('fs');const assert=require('node:assert/strict');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',[mode,file]=process.argv.slice(2);
if(!['record','check'].includes(mode)||!file){console.error('usage: record|check <file>');process.exit(2)}

// Runs inside the page: reseed, rebuild, resolve until the battle ends, and summarise without cycles.
const RUN=String(function run(args){
  let a=args.seed;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  build(args.team,args.planet);
  const ref=(k,v)=>v&&typeof v==='object'&&'side' in v&&'id' in v&&v!==G?'#'+v.id:typeof v==='number'?Math.round(v*1e6)/1e6:v;
  const events=[];let end=null;
  for(let i=0;i<args.steps;i++){const e=resolveAction();events.push(JSON.parse(JSON.stringify(e,ref)));if(e.end){end=e.end;break}}
  const units=G.units.map(u=>[u.id,u.side,Math.round(u.hp*1e6)/1e6,u.alive,u.layers,Math.round((u.av||0)*1e6)/1e6]);
  return {end,steps:events.length,events,units,aether:G.aether?{current:G.aether.current,max:G.aether.max,spent:G.aether.spent,generated:G.aether.generated}:null};
});

(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});const out={},sessions={};
try{
  // Standalone prototype teams on two planets.
  const p=await browser.newPage({serviceWorkers:'block'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(BASE+'/prototypes/watchable-fight.html');
  for(const team of ['bloom','plate','ledger','relay','found','flat'])for(const planet of ['spread','order'])
    out[team+'/'+planet]=await p.evaluate(`(${RUN})(${JSON.stringify({team,planet,seed:7,steps:600})})`);
  // Voyage-mode fights: write a legacy (six-battle) voyage state straight into storage and open the battle, skipping
  // the Ops screens. Covers the Aether pool, the Weaver kits and the bridged lore roster.
  const voyage=async(key,field,support,extra,seed)=>{
    await p.goto(BASE+'/prototypes/spacology-v0.1.0.html');
    await p.evaluate(([field,support,extra])=>{const s=JSON.parse(localStorage.spacologyRunV010);
      Object.assign(s,{field,support,reserve:[],level:5,capacity:6,gear:[],equipped:{},voyageVersion:0,round:1,maxRounds:6,end:null,aetherModes:{},aetherPriority:null,aetherOvercharge:{}},extra);
      localStorage.spacologyRunV010=JSON.stringify(s)},[field,support,extra]);
    await p.goto(BASE+'/prototypes/watchable-fight.html?spacology=1');await p.evaluate(()=>cancelSessionAutostart());
    assert.equal(await p.evaluate(()=>G.team),'ops','voyage-mode battle loaded');
    out[key]=await p.evaluate(`(${RUN})(${JSON.stringify({team:'ops',planet:'spread',seed,steps:600})})`);
    sessions[key]={session:await p.evaluate(()=>JSON.parse(localStorage.spacologyRunV010)),seed};
  };
  await voyage('voyage/bridged',['Tarn','Nour'],['Coda','Aurel','Maul','Spore'],{aetherModes:{Coda:'build'},aetherPriority:'Nour',aetherOvercharge:{Nour:true}},11);
  await voyage('voyage/weavers',['Arunima','Daven'],['Hanae','Ivara','Roonie','Veska'],{},13);
  await voyage('voyage/silen',['Silen','Daven'],['Hanae','Roonie','Veska','Ivara'],{},17);
  assert.deepEqual(errors,[]);
}finally{await browser.close()}
const summary=Object.entries(out).map(([k,v])=>`${k}: ${v.steps} actions, ${v.end&&(v.end.result||v.end.kind||JSON.stringify(v.end).slice(0,40))}`).join('\n');
// The voyage states, so tests/unit/combat-headless.cjs can replay the same battles in Node.
if(process.env.SPACOLOGY_SESSIONS_OUT)fs.writeFileSync(process.env.SPACOLOGY_SESSIONS_OUT,JSON.stringify(sessions,null,1)+'\n');
if(mode==='record'){fs.writeFileSync(file,JSON.stringify(out));console.log('recorded '+Object.keys(out).length+' fights\n'+summary);return}
const base=JSON.parse(fs.readFileSync(file,'utf8'));
for(const k of Object.keys(base)){
  const a=JSON.stringify(base[k]),b=JSON.stringify(out[k]);if(a===b)continue;
  const ea=base[k].events,eb=(out[k]||{}).events||[];const i=ea.findIndex((e,j)=>JSON.stringify(e)!==JSON.stringify(eb[j]));
  console.error(`MISMATCH ${k} at action ${i}:\n base ${JSON.stringify(ea[i]).slice(0,600)}\n  now ${JSON.stringify(eb[i]).slice(0,600)}`);process.exit(1);
}
console.log('PASS combat parity: '+Object.keys(base).length+' fights identical action by action\n'+summary);
})().catch(e=>{console.error(e);process.exit(1)});
