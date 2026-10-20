// ============================================================================
//  Weaver voyage lab — scripted branches.  Plays the walkthrough's branches
//  (docs/design/weaver-voyage-walkthrough.md) as fixed policies over many seeds
//  and prints the §7 measurement table.  Isolated model, not the live game.
//
//  node sim/weaver-voyage.js [seeds=60] [out.json]
// ============================================================================
'use strict';
const M=require('../prototypes/labs/weaver-voyage/weaver-voyage-model.js');
// SCALE='{"hp":[...],"atk":[...]}' overrides enemy scaling for a calibration sweep.
if(process.env.SCALE)Object.assign(M.SCALE,JSON.parse(process.env.SCALE));
const SEEDS=Number(process.argv[2]||60),OUT=process.argv[3];

// Each crewmate's 'home' set: the first set that lists them in bestOn.
const HOME=Object.fromEntries(M.IDS.map(id=>[id,M.SET_IDS.find(k=>M.SETS[k].bestOn[0]===id)||M.SET_IDS.find(k=>M.SETS[k].bestOn.includes(id))]));
const POLICIES={
  'A · build + spend':{starters:['Hanae','Arunima'],recruits:[[7,'Ivara'],[8,'Roonie'],[15,'Veska']]},
  'B · hold + spend':{starters:['Ivara','Arunima'],recruits:[[7,'Hanae'],[8,'Roonie'],[15,'Veska']]},
  'C · build + hold':{starters:['Hanae','Ivara'],recruits:[[7,'Arunima'],[8,'Roonie'],[15,'Silen']]},
  'A, no equipment':{starters:['Hanae','Arunima'],noGear:true,recruits:[[7,'Ivara'],[8,'Roonie'],[15,'Veska']]},
  'Wide, unequipped':{starters:['Hanae','Arunima'],wide:true,recruits:[[1,'Ivara'],[1,'Roonie'],[1,'Veska'],[1,'Silen'],[1,'Daven']]},
  'Wide, equipped':{starters:['Hanae','Arunima'],recruits:[[1,'Ivara'],[1,'Roonie'],[1,'Veska'],[1,'Silen'],[1,'Daven']]},
  'A, no stars':{starters:['Hanae','Arunima'],noStars:true,recruits:[[7,'Ivara'],[8,'Roonie'],[15,'Veska']]},
  'Hull + Drive':{starters:['Tarn','Ojo'],recruits:[[4,'Reva'],[7,'Imke'],[9,'Idris'],[14,'Ekene']]}
};

function due(s,p){return p.recruits.filter(([n,id])=>s.node>=n&&!s.crew.some(c=>c.id===id))}
// Equip the best upgrade for anyone; scrap whatever is an upgrade for nobody — the same rule the UI shows.
function gear(s,p){
  if(p.wide||p.noGear){while(s.hold.length&&!M.act(s,{type:'scrap',uid:s.hold[0].uid}));return}
  for(let guard=0;guard<60&&s.hold.length;guard++){
    let best=null;for(const x of s.hold){const u=M.bestUse(s,x);if(u&&(!best||u.delta>best.u.delta))best={x,u}}
    if(!best)break;M.act(s,{type:'equip',uid:best.x.uid,crew:best.u.crew});
  }
  for(const x of s.hold.slice())if(!M.bestUse(s,x))M.act(s,{type:'scrap',uid:x.uid});
}
// The pack pair covering the most crew whose home set isn't complete yet.
function packKind(s){
  const need=s.crew.filter(c=>!M.setProgress(c)[0].complete||M.setProgress(c)[0].set!==HOME[c.id]).map(c=>HOME[c.id]);
  return M.PACK_KINDS.map(k=>({k,n:need.filter(x=>k.sets.includes(x)).length})).sort((a,b)=>b.n-a.n)[0].k.id;
}
function missingPiece(s){
  for(const c of s.crew){const pr=M.setProgress(c)[0],home=HOME[c.id];
    if(pr.set===home&&pr.half&&!pr.complete)return {set:home,slot:pr.missing[0]}}
  return null;
}
// Stars: promote the carry first (the first starter), then the next crewmate, each as far as Insight allows.
// From sector 3, surplus Gold buys Insight while it stays under the price of two packs plus the next recruit.
function promote(s,p){
  if(p.noStars)return;
  if(s.node>=15)while(s.gold-M.insightPrice(s)>=2*M.ECON.pack&&!M.act(s,{type:'buyInsight'}));
  for(const c of s.crew)while(!M.act(s,{type:'promote',id:c.id}));
}
function ops(s,p){
  // Open every cache first, as a player would on the Prepare screen.
  if(s.caches&&s.caches.length)M.act(s,{type:'openCache',ids:s.caches.map(c=>c.id)});
  if(s.ended)return;
  promote(s,p);
  for(const [,id] of due(s,p)){
    const price=s.freeVoucher?0:M.voucherPrice(s);
    if(s.writs<price&&s.gold>0)M.act(s,{type:'invest',amount:Math.min(s.gold,(price-s.writs)*M.ECON.writCost-(s.writFund||0))});
    if(M.act(s,{type:'voucher',id}))break;
  }
  if(p.wide||p.noGear){if(s.gold>0)M.act(s,{type:'invest',amount:'all'});return}
  const upcoming=due(s,p).filter(([n])=>n<=s.node+8).length;
  while(s.gold-M.ECON.pack>=upcoming*M.ECON.writCost&&!M.act(s,{type:'pack',kind:packKind(s)}))gear(s,p);
  gear(s,p);
}
function reward(s,p){
  if(p.wide||p.noGear){M.act(s,{type:'reward',choice:'voucher'});return}
  if(due(s,p).some(([n])=>n<=s.node+1)){M.act(s,{type:'reward',choice:'voucher'});return}
  const miss=missingPiece(s);
  if(miss){M.act(s,{type:'reward',choice:'craft',...miss});return}
  M.act(s,{type:'reward',choice:'packs',kind:packKind(s)});
}
// Take the offered piece that best advances a crewmate's home set; otherwise one for a home set at all.
function pickDrop(s,p){
  const offers=s.pendingDrop.offers,score=o=>{if(p.wide||p.noGear)return 0;
    const adv=M.pieceAdvances(s,o).filter(a=>HOME[a.crew]===o.set);if(adv.some(a=>a.completes||a.unlocks))return 3+o.quality;if(adv.length)return 2+o.quality;
    return s.crew.some(c=>HOME[c.id]===o.set)?1:0};
  let best=0;offers.forEach((o,i)=>{if(score(o)>score(offers[best]))best=i});M.act(s,{type:'takeDrop',index:best});
}
function play(seed,count,p){
  const s=M.create({seed,affixCount:count});M.act(s,{type:'starters',ids:p.starters});
  for(let guard=0;guard<80&&!s.ended;guard++){
    if(s.pendingDrop){pickDrop(s,p);continue}
    ops(s,p);const t=M.nodeType(s);
    if(t==='rest')M.act(s,{type:'pass'});else if(t==='reward')reward(s,p);else M.act(s,{type:'launch'});
    ops(s,p);
  }
  return s;
}

const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0,pct=x=>Math.round(x*100)+'%';
const results={};
const COUNTS=(process.env.COUNTS||'0,2,4').split(',').map(Number);
for(const brief of COUNTS){
  results[brief]={};
  for(const [name,p] of Object.entries(POLICIES)){
    const runs=[];for(let i=0;i<SEEDS;i++)runs.push(play(1000+i*7,brief,p));
    const fights=runs.flatMap(s=>s.fights),bySector=k=>fights.filter(f=>f.sector===k).map(f=>f.score);
    const bosses=[1,2,3].map(k=>fights.filter(f=>f.sector===k&&f.type==='boss').map(f=>f.score));
    const elites=fights.filter(f=>f.type==='elite').map(f=>f.score),eliteWin=elites.filter(x=>x>=.88).length/(elites.length||1),bossWin=fights.filter(f=>f.type==='boss').filter(f=>f.score>=.88).length/(bosses.flat().length||1);
    const gen=mean(fights.map(f=>f.metrics.generated+f.metrics.wasted)),waste=mean(fights.map(f=>f.metrics.wasted));
    results[brief][name]={
      sector:[1,2,3].map(k=>mean(bySector(k))),boss:bosses.map(mean),elite:mean(elites),eliteWin,bossWin,
      complete:runs.filter(s=>s.endReason==='Voyage complete.').length/runs.length,
      integrity:mean(runs.map(s=>s.integrity)),waste:gen?waste/gen:0,
      peak:mean(fights.map(f=>f.metrics.peakBurst)),bursts:mean(fights.map(f=>f.metrics.bursts)),
      chains:mean(fights.map(f=>f.metrics.chains)),crew:mean(runs.map(s=>s.crew.length)),
      sets:mean(runs.map(s=>s.crew.reduce((a,c)=>a+M.completedSets(c).length,0))),
      purchases:runs[0].purchases};
  }
}
for(const [brief,rows] of Object.entries(results)){
  console.log(`\n${brief} AFFIXES (random Briefs) · ${SEEDS} seeds`);
  console.log('policy'.padEnd(22)+'sec1  sec2  sec3 | boss1 boss2 boss3 | elite eWin bWin | home  integ | waste peak  sets crew');
  for(const [name,r] of Object.entries(rows))
    console.log(name.padEnd(22)+r.sector.map(pct).map(x=>x.padStart(4)).join('  ')+' | '+r.boss.map(pct).map(x=>x.padStart(5)).join(' ')+' | '+pct(r.elite).padStart(5)+pct(r.eliteWin).padStart(5)+pct(r.bossWin).padStart(5)+' | '
      +pct(r.complete).padStart(4)+'  '+String(Math.round(r.integrity)).padStart(4)+'  | '+pct(r.waste).padStart(4)+'  '+r.peak.toFixed(1).padStart(4)+'  '+r.sets.toFixed(1).padStart(3)+'  '+r.crew.toFixed(1));
}
if(OUT){require('fs').writeFileSync(OUT,JSON.stringify({seeds:SEEDS,results},null,1));console.log('\nwrote '+OUT)}
