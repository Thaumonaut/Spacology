const assert=require('node:assert/strict');
const M=require('../../prototypes/affix-lab-model.js');

const TEAMS={aether:['Hanae','Arunima','Daven','Nahana'],carry:['Silen','Ekene','Daven','Nahana'],break:['Wren','Sevim','Daven','Nahana'],
  dot:['Nour','Spore','Daven','Nahana'],counter:['Reva','Ilka','Nahana','Nadira'],followup:['Nadira','Aurelio','Daven','Nahana']};
const ENCOUNTERS=[{format:'patrol'},{format:'swarm'},{format:'elite'},...Object.keys(M.BOSSES).map(boss=>({format:'boss',boss}))];
const sum=(team,affixes,key,seeds=12,extra={})=>{
  let total=0;
  for(const enc of ENCOUNTERS)for(let seed=1;seed<=seeds;seed++){
    const r=M.fight({crew:team,affixes,encounter:enc,scale:1.2,seed,...extra});
    total+=typeof key==='function'?key(r):r.metrics[key];
  }
  return total;
};

// Determinism, and the spec is not mutated.
{
  const spec={crew:[{id:'Hanae',gear:['capacitor']},{id:'Arunima'},{id:'Daven'},{id:'Nahana'}],affixes:['frost','hardened'],
    encounter:{format:'boss',boss:'carapace'},scale:1.3,seed:77};
  const before=JSON.stringify(spec);
  const a=M.fight(spec),b=M.fight(spec);
  assert.deepEqual(a,b);
  assert.equal(JSON.stringify(spec),before);
}

// The roster: six team types, sustain is a role inside each of them, and every crewmate belongs to one type.
{
  const types=Object.keys(M.FAMILIES);
  assert.deepEqual(types,['aether','carry','break','dot','counter','followup']);
  types.forEach(t=>{
    const s=M.ROSTER[M.FAMILIES[t].sustain];
    assert.ok(s&&s.sustain&&s.family===t,`${t} needs its own sustainer`);
    assert.ok(Object.values(M.ROSTER).filter(c=>c.family===t&&!c.sustain).length>=2,`${t} needs engine pieces`);
    M.FAMILIES[t].core.forEach(id=>assert.equal(M.ROSTER[id].family,t));
  });
  Object.values(M.ROSTER).forEach(c=>{
    assert.ok(types.includes(c.family),`${c.id} has no team type`);
    assert.ok(M.KITS[c.id]&&c.k,`${c.id} needs a kit and kit numbers`);
    if(c.sustain)assert.ok(c.keys.includes('sustain'),`${c.id} should fit sustain equipment`);
  });
}

// Every team, format and single affix produces finite, bounded results.
const NEW_TEAMS=[['Ivara','Veska','Beatriz','Maul'],['Atsa','Dolores','Tarn','Imke'],['Navigator','Daven','Reva','Nour']];
for(const team of [...Object.values(TEAMS),...NEW_TEAMS])for(const enc of ENCOUNTERS)for(const affix of [null,...Object.keys(M.AFFIXES)]){
  const r=M.fight({crew:team,affixes:affix?[affix]:[],encounter:enc,scale:1.4,seed:3});
  assert.ok(Number.isFinite(r.score)&&r.score>=0&&r.score<=1,`${affix} ${enc.format} score ${r.score}`);
  assert.ok(Number.isFinite(r.av)&&r.av>=0,`${affix} ${enc.format} av`);
  assert.ok(['cleared','time','wiped'].includes(r.outcome));
  Object.values(r.contributions).forEach(v=>assert.ok(Number.isFinite(v)&&v>=0));
}

// Freeze: Aether spenders freeze and the pool loses charges; Thermal Lining keeps its wearer from freezing.
{
  assert.equal(sum(TEAMS.aether,[],'freezes'),0);
  assert.ok(sum(TEAMS.aether,['frost'],'freezes')>20);
  assert.ok(sum(TEAMS.aether,['frost'],'frozenAether')>0);
  const lined=[{id:'Hanae'},{id:'Arunima',gear:['lining']},{id:'Daven'},{id:'Nahana'}];
  assert.equal(sum(lined,['frost'],r=>r.metrics.frozenBy.Arunima||0),0);
  // Bigger spenders freeze more often per cast: the chance grows with each Aether spent.
  assert.ok(sum(TEAMS.aether,['frost'],r=>r.metrics.frozenBy.Arunima||0)>sum(TEAMS.aether,['frost'],r=>r.metrics.frozenBy.Nahana||0));
  // Nobody freezes twice in a row: in each crewmate's own log, a freeze is never followed by a spend that freezes again.
  let checked=0;
  for(const enc of ENCOUNTERS)for(let seed=1;seed<=20;seed++){
    const r=M.fight({crew:TEAMS.aether,affixes:['frost'],encounter:enc,scale:1.2,seed,record:true});
    for(const id of TEAMS.aether){
      const seq=r.log.filter(l=>l.text.startsWith(id+' skill')||l.text.startsWith(id+' froze')).map(l=>l.text.startsWith(id+' froze')?'F':'S').join('');
      assert.ok(!seq.includes('FSF'),`${id} froze twice in a row (seed ${seed}): ${seq}`);
      checked+=(seq.match(/F/g)||[]).length;
    }
  }
  assert.ok(checked>20,'the chain check saw enough freezes to mean something');
  // The gift: a Break freezes the enemy through its recovery turn.
  assert.ok(sum(TEAMS.break,['frost'],'skipped')>0);
  assert.equal(sum(TEAMS.break,['frost'],'skipped',12,{affixParts:{frost:'tax'}}),0);
}

// Shields harden: more damage is soaked; the gift cracks extra layers when something Breaks.
{
  const share=affixes=>sum(TEAMS.carry,affixes,'soaked')/sum(TEAMS.carry,affixes,r=>r.metrics.soaked+r.metrics.dealt);
  assert.ok(share(['hardened'])>share([])+.1);
  assert.ok(sum(TEAMS.break,['hardened'],'cracked')>0);
}

// Each remaining affix changes the thing it says it changes.
{
  // Fights run until enemies fall, so total poison barely moves; its rate per AV is what withers.
  const rate=affixes=>sum(TEAMS.dot,affixes,'poison')/sum(TEAMS.dot,affixes,r=>r.av);
  assert.ok(rate(['wither'])<rate([])*.9);
  // Shields snap back: broken shields return on a timer; Breaks provoke: each Break draws a counterattack.
  assert.equal(sum(TEAMS.break,[],'reformed'),0);
  assert.ok(sum(TEAMS.break,['snapback'],'reformed')>0);
  assert.equal(sum(TEAMS.break,[],'provoked'),0);
  assert.ok(sum(TEAMS.break,['provoke'],'provoked')>0);
  assert.ok(sum(TEAMS.break,['provoke'],'taken')>sum(TEAMS.break,[],'taken'));
  assert.ok(sum(TEAMS.break,['scarce'],'healed')<sum(TEAMS.break,[],'healed'));
  assert.ok(sum(TEAMS.break,['scarce'],'barrier')>sum(TEAMS.break,[],'barrier'));
  assert.ok(sum(TEAMS.break,['brutal'],'taken')>sum(TEAMS.break,[],'taken'));
  assert.ok(sum(TEAMS.aether,['horde'],r=>r.metrics.kills)>sum(TEAMS.aether,[],r=>r.metrics.kills));
  Object.values(M.AFFIXES).forEach(a=>{
    assert.ok(a.name&&a.tax&&a.report,`${a.id} needs a name, a tax and a report`);
    if(a.category==='rule')assert.ok(a.gift&&a.applyGift,`rule affix ${a.id} must trade: it needs a gift`);
  });
}

// The back row is safe: under every affix, format and boss (Reflectors and the Mirror included), no enemy damage
// reaches a back-row crewmate, so back-row attackers finish every fight at full health.
{
  const team=['Wren','Sevim','Nadira','Ivara'];   // one front-liner; three back-row crew who all deal damage
  for(const affix of [null,...Object.keys(M.AFFIXES)])for(const enc of ENCOUNTERS)for(let seed=1;seed<=4;seed++){
    const r=M.fight({crew:team,affixes:affix?[affix]:[],encounter:enc,scale:1.2,seed});
    r.crew.filter(c=>M.ROSTER[c.id].row==='back').forEach(c=>assert.equal(c.hp,c.maxHp,`${c.id} was hurt in the back row (${affix}, ${enc.boss||enc.format})`));
  }
}

// Shields are integral to the flow of battle: no card may remove them, and under every affix there is still a shield
// for a break team to Break.
{
  Object.values(M.AFFIXES).forEach(a=>assert.ok(!(a.removes||[]).includes('shields'),`${a.id} must not remove shields`));
  Object.keys(M.AFFIXES).forEach(id=>assert.ok(sum(TEAMS.break,[id],'breaks',2)>0,`${id}: nothing left to Break`));
}

// The newer kits each do the thing their card says.
{
  // Ivara holds: 6 base, +1 as a Weaver, +2 as the reservoir.
  assert.equal(M.fight({crew:['Ivara','Reva'],encounter:{format:'patrol'},scale:.5,seed:1}).aether.max,9);
  assert.ok(sum(['Beatriz','Silen','Ekene','Daven'],[],'executions')>0,'Beatriz refunds Aether on kills');
  assert.ok(sum(['Maul','Wren','Sevim','Atsa'],[],'extended')>0,'Maul pushes recoveries back');
  assert.ok(sum(['Dolores','Nour','Spore','Nahana'],[],'detonations')>0,'Dolores detonates poison');
  assert.ok(sum(['Tarn','Ilka','Nahana','Nour'],[],'reflected')>0,'Tarn returns what his barrier absorbs');
  assert.ok(sum(['Imke','Nadira','Navigator','Reva'],[],'followups')>0,'Imke follows up without Aurelio');
  // Veska turns Refrains back into Aether: switching the refund off generates less.
  const veska=['Veska','Silen','Ekene','Reva'];
  assert.ok(sum(veska,[],'healed')>0);
  const refunded=sum(veska,[],'aetherGenerated'),keepRefund=M.ROSTER.Veska.k.refund;
  M.ROSTER.Veska.k.refund=0;
  assert.ok(refunded>sum(veska,[],'aetherGenerated'),'Veska refunds Aether');
  M.ROSTER.Veska.k.refund=keepRefund;
  // Atsa's firm ground and Navigator's growing song, each against the same team without them.
  const barrier=sum(['Atsa','Wren','Sevim','Maul'],[],'barrier');
  const keepBreak=M.ROSTER.Atsa.k.onBreak;M.ROSTER.Atsa.k.onBreak=0;
  assert.ok(barrier>sum(['Atsa','Wren','Sevim','Maul'],[],'barrier'),'Atsa shields the crew when shields Break');
  M.ROSTER.Atsa.k.onBreak=keepBreak;
  const song=['Navigator','Reva','Daven','Nour'],grown=sum(song,[],r=>r.metrics.healed+r.metrics.barrier);
  const keepGrow=M.ROSTER.Navigator.k.grow;M.ROSTER.Navigator.k.grow=0;
  assert.ok(grown>sum(song,[],r=>r.metrics.healed+r.metrics.barrier),'Navigator’s healing grows');
  M.ROSTER.Navigator.k.grow=keepGrow;
}

// Every battle sets its own strength (derived by `sim/affix-lab.js route`), and the gentle opening sits below the rest.
{
  const s=M.createSession({seed:3,brief:{affixes:[],bosses:['carapace','brood','mirror']}});
  assert.equal(M.nextBattle(s).scale,M.ROUTE[0].scale);
  assert.ok(M.ROUTE.every(r=>r.scale>0));
  const opening=M.ROUTE.filter(r=>r.sector===1),later=M.ROUTE.filter(r=>r.sector>1);
  assert.ok(opening.every(r=>r.gentle)&&later.every(r=>!r.gentle));
  assert.ok(Math.max(...opening.map(r=>r.scale))<Math.min(...later.map(r=>r.scale)));
}

// No wall after the opening (playtest 2026-10-06: a DoT crew won all of sector 1, then lost every battle after it).
// The four-crew DoT team that cleared the sector 1 boss stays in reach of the first sector 2 battle with no equipment.
// A tuning regression by design: if a roster or economy change trips it, re-derive the route with
// `sim/affix-lab.js route --briefs 24 --seeds 3` rather than loosening the bound.
{
  const crew=['Nour','Spore','Dolores','Nahana'].map(id=>({id}));
  const at=i=>{const r=M.ROUTE[i];return Array.from({length:8},(_,k)=>M.fight({crew,affixes:[],encounter:{format:r.format,boss:r.format==='boss'?'carapace':null},
    scale:r.scale,seed:M.hash('wall',i,k)}).score);};
  const before=at(2),after=at(3),mean=list=>list.reduce((a,b)=>a+b,0)/list.length;
  assert.ok(mean(before)>.9,`sector 1 boss ${mean(before)}`);
  assert.ok(mean(after)>.6,`first sector 2 battle ${mean(after)}`);
}

// Ilka's opening plating: every crewmate starts the battle behind a barrier.
{
  const team=['Ilka','Reva','Wren','Sevim'],saved=M.ROSTER.Ilka.k.opening;
  const opening=sum(team,[],'barrier');
  M.ROSTER.Ilka.k.opening=0;
  const without=sum(team,[],'barrier');
  M.ROSTER.Ilka.k.opening=saved;
  assert.ok(opening>without);
}

// Equipment raises output: the same crew deals damage faster with fitted items (totals track enemy health, rates don't).
{
  const bare=TEAMS.break.map(id=>({id})),fitted=[{id:'Wren',gear:['borebit','shatter']},{id:'Sevim',gear:['borebit']},{id:'Daven'},{id:'Nahana'}];
  const rate=crew=>sum(crew,[],'dealt')/sum(crew,[],r=>r.av);
  assert.ok(rate(fitted)>rate(bare)*1.1);
}

// The Brief respects category caps, is deterministic, and names three distinct bosses.
for(let seed=1;seed<=500;seed++){
  const count=seed%5,b=M.rollBrief(seed,count);
  assert.equal(b.affixes.length,Math.min(count,Object.keys(M.AFFIXES).length));
  assert.ok(M.legalStack(b.affixes),`seed ${seed}: ${b.affixes}`);
  assert.equal(b.affixes.filter(id=>M.AFFIXES[id].category==='stat').length<=1,true);
  assert.equal(b.affixes.filter(id=>M.AFFIXES[id].category==='shape').length<=1,true);
  assert.equal(new Set(b.bosses).size,3);
  assert.deepEqual(M.rollBrief(seed,count),b);
}
assert.equal(M.legalStack(['brutal','brutal']),false);

// Compatibility: a card never shares a Brief with one that removes what it needs, and two cards that touch the same
// number never stack.
assert.deepEqual(M.conflicts(['snapback','frost','brutal','horde']),['snapback','frost','brutal','horde'].filter(id=>id!=='snapback'));
assert.equal(M.legalStack(['snapback','frost']),false,'Freeze’s gift needs the Break window Snap back removes');
assert.equal(M.legalStack(['snapback','hardened']),false,'both set how much shields soak');
assert.equal(M.legalStack(['brutal','horde']),false,'both scale incoming damage');
assert.equal(M.legalStack(['snapback','provoke']),true);
assert.equal(M.legalStack(['hardened','wither','frost']),true);
assert.equal(M.legalBrief({affixes:['bare'],bosses:['mirror','sprinter','purifier']}),false,'removed cards are not legal');
Object.keys(M.BOSSES).forEach(b=>Object.keys(M.AFFIXES).forEach(a=>assert.ok(M.bossFits(b,[a]),`${b} with ${a}`)));
for(let seed=1;seed<=2000;seed++)for(let count=0;count<=4;count++){
  const b=M.rollBrief(seed,count);
  assert.ok(M.legalBrief(b),`seed ${seed} count ${count}: ${b.affixes} / ${b.bosses}`);
  assert.equal(b.affixes.length,count);
}

// Session economy.
{
  const s=M.createSession({seed:11,brief:{affixes:['frost'],bosses:['carapace','brood','mirror']}});
  assert.equal(s.phase,'draft');
  assert.equal(M.act(s,{type:'launch'}).ok,false);
  assert.equal(M.act(s,{type:'release',id:'Hanae'}).ok,false);
  assert.ok(M.act(s,{type:'recruit',id:'Hanae'}).ok);
  assert.equal(M.act(s,{type:'recruit',id:'Hanae'}).ok,false);
  assert.ok(M.act(s,{type:'recruit',id:'Sevim'}).ok);
  assert.equal(s.phase,'ops');
  assert.equal(M.act(s,{type:'recruit',id:'Wren'}).ok,false,'no third berth yet');
  assert.match(M.canLaunch(s),/front-row/);
  // Vouchers are convex and charge exactly once.
  assert.deepEqual([2,3,4,5,6].map(M.voucherPrice),[12,20,30,42,null]);
  s.gold=200;
  assert.ok(M.act(s,{type:'voucher'}).ok);
  assert.equal(s.gold,188);assert.equal(s.berths,3);
  assert.ok(M.act(s,{type:'recruit',id:'Wren'}).ok);
  assert.equal(M.canLaunch(s),null);
  ['voucher','voucher','voucher'].forEach(type=>assert.ok(M.act(s,{type}).ok));
  assert.equal(s.berths,6);assert.equal(s.gold,188-20-30-42);
  assert.equal(M.act(s,{type:'voucher'}).ok,false);
  // Supply: deterministic offers, rerolls rise within a stop, buying charges once and empties the slot.
  const offers=s.offers.slice();
  assert.equal(offers.length,M.ECON.offers);
  assert.deepEqual(M.rollOffers(s),offers);
  const gold=s.gold;
  assert.ok(M.act(s,{type:'reroll'}).ok);assert.ok(M.act(s,{type:'reroll'}).ok);
  assert.equal(s.gold,gold-2-3);
  const item=s.offers[0];
  assert.ok(M.act(s,{type:'buy',index:0}).ok);
  assert.equal(s.offers[0],null);assert.equal(M.act(s,{type:'buy',index:0}).ok,false);
  assert.deepEqual(s.stash,[item]);
  // Two slots per crewmate; release returns equipment to the hold; selling refunds.
  s.stash.push('borebit','shatter');
  assert.ok(M.act(s,{type:'equip',gear:'borebit',id:'Wren'}).ok);
  assert.ok(M.act(s,{type:'equip',gear:'shatter',id:'Wren'}).ok);
  assert.equal(M.act(s,{type:'equip',gear:item,id:'Wren'}).ok,false);
  assert.ok(M.act(s,{type:'release',id:'Wren'}).ok);
  assert.equal(s.crew.includes('Wren'),false);
  assert.ok(s.stash.includes('borebit')&&s.stash.includes('shatter'));
  const g2=s.gold;assert.ok(M.act(s,{type:'sell',gear:'shatter'}).ok);assert.equal(s.gold,g2+M.ECON.sellValue);
  // A launch pays income, advances the route and resets rerolls.
  assert.ok(M.act(s,{type:'recruit',id:'Reva'}).ok);
  const r=M.act(s,{type:'launch'});
  assert.ok(r.ok);assert.equal(s.battle,1);assert.equal(s.rerolls,0);assert.equal(s.results.length,1);
  assert.ok(r.entry.gold>=M.ECON.income);
}

// Hire from the roster: a free berth if there is one, otherwise the next voucher first; nothing is spent on failure.
{
  const s=M.createSession({seed:31,brief:{affixes:[],bosses:['carapace','brood','mirror']}});
  assert.ok(M.act(s,{type:'hire',id:'Reva'}).ok);
  assert.ok(M.act(s,{type:'hire',id:'Hanae'}).ok);
  assert.equal(s.phase,'ops');assert.equal(s.gold,M.ECON.startGold);
  const r=M.act(s,{type:'hire',id:'Wren'});
  assert.ok(r.ok,r.message);
  assert.equal(s.berths,3);assert.equal(s.gold,M.ECON.startGold-M.voucherPrice(2));
  assert.ok(s.crew.includes('Wren'));
  const before=JSON.stringify(s);
  assert.equal(M.act(s,{type:'hire',id:'Sevim'}).ok,false,'cannot afford berth 4');
  assert.equal(M.act(s,{type:'hire',id:'Wren'}).ok,false,'already aboard');
  assert.equal(JSON.stringify(s),before,'a failed hire spends nothing');
}

// Upkeep: every crewmate beyond the free four costs gold after each battle.
{
  const s=M.createSession({seed:21,brief:{affixes:[],bosses:['carapace','brood','mirror']}});
  ['Reva','Daven'].forEach(id=>M.act(s,{type:'recruit',id}));
  s.gold=500;
  for(let i=0;i<4;i++)M.act(s,{type:'voucher'});
  ['Wren','Sevim','Hanae','Nahana'].forEach(id=>M.act(s,{type:'recruit',id}));
  const r=M.act(s,{type:'launch'});
  assert.equal(r.entry.upkeep,M.ECON.upkeep*2);
  assert.equal(r.entry.gold,Math.max(0,M.ECON.income+M.band(r.entry.score).gold-M.ECON.upkeep*2));
}

// A whole session completes, and a saved session continues exactly as an unsaved one.
{
  const play=s=>{while(s.phase!=='done'){const r=M.act(s,{type:'launch'});assert.ok(r.ok,r.message);}return s;};
  const make=()=>{const s=M.createSession({seed:5,affixCount:2});['Reva','Hanae'].forEach(id=>M.act(s,{type:'recruit',id}));return s;};
  const a=make();M.act(a,{type:'launch'});
  const b=JSON.parse(JSON.stringify(a));
  play(a);play(b);
  assert.deepEqual(a.results.map(r=>r.score),b.results.map(r=>r.score));
  assert.equal(a.results.length===M.ROUTE.length||a.integrity===0,true);
}

// Each condition's impact (playtest 2026-10-06: one card decided the voyage, and the report could not say which).
// An explained launch replays the battle without each condition in turn; a plain launch, as the sim uses, does not.
{
  const start=affixes=>{
    const s=M.createSession({seed:282216,brief:{affixes,bosses:['mirror','carapace','purifier']}});
    ['Spore','Dolores'].forEach(id=>M.act(s,{type:'recruit',id}));M.act(s,{type:'hire',id:'Nour'});
    return s;
  };
  const plain=M.act(start(['brutal']),{type:'launch'});
  assert.equal(plain.entry.reports[0].without,undefined);
  const alone=M.act(start(['brutal']),{type:'launch',explain:true}),none=M.act(start([]),{type:'launch'});
  assert.equal(alone.entry.score,plain.entry.score,'explaining does not change the battle');
  assert.equal(alone.entry.reports[0].without,none.entry.score);
  const four=['snapback','brutal','scarce','wither'],s=start(four),spec=M.battleSpec(s);
  const r=M.act(s,{type:'launch',explain:true});
  r.entry.reports.forEach(rep=>assert.equal(rep.without,M.fight({...spec,affixes:four.filter(id=>id!==rep.id)}).score,rep.id));
  assert.deepEqual(JSON.parse(JSON.stringify(s)).results[0].reports.map(x=>typeof x.without),four.map(()=>'number'),'the export carries it');
}

// A battle is never both lost and a perfect recovery: the last enemy and the last front-liner can fall in one action
// (a Break's provoked counterattack, or a Reflector returning the killing blow).
{
  const s=M.createSession({seed:1,affixCount:2});
  M.act(s,{type:'hire',id:'Wren'});M.act(s,{type:'hire',id:'Sevim'});
  const provoked=M.act(s,{type:'launch'}).result;
  assert.ok(provoked.outcome==='cleared'||provoked.band!=='perfect',`provoke: ${provoked.outcome} at ${provoked.score} is ${provoked.band}`);
  const reflected=M.fight({crew:[{id:'Dolores',gear:['catalyst','overdraw']}],affixes:['brutal'],encounter:{format:'boss',boss:'mirror'},
    scale:0.3271805999800563,seed:680});
  assert.ok(reflected.outcome==='cleared'||reflected.band!=='perfect',`reflect: ${reflected.outcome} at ${reflected.score} is ${reflected.band}`);
}

// The frost card tells the truth: if the pool takes Aether while a crewmate is still frozen, the card must not say
// the pool stays frozen while anyone is.
{
  const A=require('../../prototypes/aether-rules.js');
  const teamPlan=A.teamPlan,credit=A.credit;let crew=null,thawedEarly=0;
  A.teamPlan=function(p,a,o){crew=o.crew;return teamPlan.apply(this,arguments);};
  A.credit=function(){const got=credit.apply(this,arguments);if(got>0&&(crew||[]).some(u=>u.frozen&&u.alive))thawedEarly++;return got;};
  try{M.fight({crew:['Arunima','Hanae','Veska','Daven'],affixes:['frost'],encounter:{format:'boss',boss:'carapace'},scale:1,seed:4});}
  finally{A.teamPlan=teamPlan;A.credit=credit;}
  const promise=/while anyone is frozen the Aether pool is frozen/i.test(M.AFFIXES.frost.tax);
  assert.ok(!(thawedEarly&&promise),`the pool took Aether ${thawedEarly} times while a crewmate was frozen, but the card says it cannot`);
}

// Every item does what it says on every crewmate it is listed as fitting.
{
  // Ballast Plate on Navigator, whose barriers come from overflow healing: his first barrier is 40% larger than with an
  // item that does nothing for him. The two fights are identical up to that moment (totals diverge and hit the cap), and
  // the barrier cap (max health) is lifted here so it cannot clip the difference being measured.
  assert.ok(M.gearFits('ballast').includes('Navigator'));
  const firstBarrier=(gear,seed,format)=>{
    let first=0;const kit=M.KITS.Navigator,keep={...kit},cap=M.T.barrierCap;
    ['basic','skill','ult'].forEach(k=>{if(keep[k])kit[k]=function(f){const before=f.m.barrier,out=keep[k].apply(this,arguments);
      if(!first&&f.m.barrier>before)first=f.m.barrier-before;return out;};});
    M.T.barrierCap=100;
    try{M.fight({crew:[{id:'Silen'},{id:'Navigator',gear:[gear]},{id:'Ekene'},{id:'Beatriz'}],affixes:[],encounter:{format},scale:1.3,seed});}
    finally{Object.assign(kit,keep);M.T.barrierCap=cap;}
    return first;
  };
  const ratios=['patrol','swarm'].flatMap(format=>[1,2,3,4,5,6].map(seed=>[firstBarrier('ballast',seed,format),firstBarrier('spring',seed,format)])).filter(([a,b])=>a&&b).map(([a,b])=>a/b);
  assert.ok(ratios.length>0,'Navigator granted a barrier');
  assert.ok(ratios.every(r=>r>1.3),`Navigator's first barrier with Ballast against without: ${ratios.map(r=>r.toFixed(2)).join(', ')}`);

  // Hair Trigger on Imke: one more follow-up can trigger each action, so some action brings two.
  assert.ok(M.gearFits('trigger').includes('Imke'));
  const most=gear=>{
    let best=0;const wrap={};
    ['Sevim','Imke','Wren','Daven'].forEach(id=>['basic','skill','ult'].forEach(k=>{
      const fn=M.KITS[id][k];if(!fn)return;
      (wrap[id]=wrap[id]||{})[k]=fn;
      M.KITS[id][k]=function(f){const before=f.m.followups,out=fn.apply(this,arguments);best=Math.max(best,f.m.followups-before);return out;};
    }));
    try{
      for(let seed=1;seed<=20;seed++)['patrol','swarm','elite'].forEach(format=>M.fight({
        crew:[{id:'Sevim'},{id:'Imke',gear},{id:'Wren'},{id:'Daven'}],affixes:[],encounter:{format},scale:1.5,seed}));
    }finally{Object.entries(wrap).forEach(([id,ks])=>Object.assign(M.KITS[id],ks));}
    return best;
  };
  assert.equal(most([]),1,'without the item Imke follows up once per action');
  assert.equal(most(['trigger']),2,'with Hair Trigger Imke can follow up twice in one action');
}

// Every crewmate an item is listed as fitting gets something from its rule, beyond the output every item gives.
// Each wearer fights with its own type, so pooled effects (Aether capacity) have room to matter; the control is an
// item with no rule, so the shared +15% output cancels out.
{
  M.GEAR.__control={id:'__control',name:'Control',keys:[],text:'',apply(){}};
  try{
    const team=id=>{
      const fam=M.ROSTER[id].family,t=[id,...Object.values(M.ROSTER).filter(c=>c.family===fam&&c.id!==id).map(c=>c.id)].slice(0,4);
      if(!t.some(x=>M.ROSTER[x].row==='front'))t[t.length-1]='Daven';
      return t;
    };
    const encounters=[{format:'patrol'},{format:'elite'},{format:'swarm'},{format:'boss',boss:'carapace'}];
    const inert=(id,item)=>[[],['frost']].every(affixes=>encounters.every(encounter=>[1,2,3,4].every(seed=>{
      const run=gear=>JSON.stringify(M.fight({crew:team(id).map(c=>({id:c,gear:c===id?[gear]:[]})),affixes,encounter,scale:1,seed}).metrics);
      return run(item)===run('__control');
    })));
    const empty=Object.keys(M.GEAR).filter(g=>g!=='__control').flatMap(g=>M.gearFits(g).filter(id=>inert(id,g)).map(id=>`${M.GEAR[g].name} on ${id}`));
    assert.deepEqual(empty,[],`listed as fitting, but the item's rule does nothing for them: ${empty.join('; ')}`);
  }finally{delete M.GEAR.__control;}
}

console.log('PASS affix-lab model');
