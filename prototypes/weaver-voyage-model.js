// ============================================================================
//  Weaver voyage lab — model.  Runs identically in Node and the browser.
//
//  An isolated experiment for docs/design/weaver-voyage-walkthrough.md: one
//  Weaver team across a 21-node voyage, with vouchers that buy anyone (no team-size cap),
//  five-slot equipment sets with rolled substats, equipment packs, Gold and Writs, and a seeded Brief.
//
//  Spending decisions come from aether-rules.js (teamPlan), not a copy of it.
//  Set rules hook the same pool-mutation path that keeps generated / wasted /
//  spent, so the waste metric stays honest.  This is NOT the live resolver.
// ============================================================================
(function(root){
  'use strict';
  const A=root.SpacologyAether||(typeof module!=='undefined'&&module.exports?require('./aether-rules.js'):null);
  if(!A)throw new Error('weaver-voyage-model needs aether-rules.js');

  function rng(seed){let a=seed>>>0||1;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function mix(...n){let h=2166136261;for(const x of n){h^=x>>>0;h=Math.imul(h,16777619)>>>0;h^=h>>>13;}return h>>>0||1}
  const clone=o=>JSON.parse(JSON.stringify(o));

  // ---- Crew --------------------------------------------------------------
  // Each crewmate has an element and a scaling stat: the stat their kit multiplies (attack, health or defense), so the
  // equipment that grows one crewmate does little for another. Skills cost 1 Aether unless the crewmate is a Weaver,
  // and no skill makes Aether: skills open windows in which basics make more. Ultimates may still refill the pool.
  const ROSTER={
    Hanae:{up3:'Resonance basics gather +2 instead of +1.',el:'energy',scales:'def',cost:1,wants:['def','energy','spd'],name:'Hanae Mori',role:'Support',profile:'Weaver — generator',art:'hanae-mori-v3.png',hp:110,atk:20,def:26,spd:100,
      kit:'Basics gather 2 Aether. Skill (−1): 200% hit and a mark, then Resonance — for the next 3 crew turns every basic gathers +1 Aether. Ultimate: 300% to all, +4 Aether.'},
    Ivara:{up3:'+1 more Aether capacity (3 in all).',el:'void',scales:'atk',cost:2,wants:['atk','crit','void'],name:'Ivara',role:'Sub-DPS',profile:'Weaver — expander',art:'void-narwhal-navigator-v1.png',hp:100,atk:26,def:15,spd:100,
      kit:'+2 Aether capacity while alive. Skill (−2): 300% focused lance and a mark. Builds below 75% of the pool. Ultimate: 600% single.'},
    Arunima:{up3:'Each charge in a burst adds 120% instead of 100%.',el:'void',scales:'atk',cost:3,wants:['atk','crit','void'],name:'Arunima Das',role:'DPS',profile:'Weaver — multi-point consumer',art:'arunima-das-v4.png',hp:105,atk:22,def:14,spd:95,
      kit:'Full burst (−3 or more): every charge spent adds 100% to a hit on every specimen. Ultimate: 500% to all.'},
    Roonie:{up3:'Bypass refunds 75% of the time.',el:'energy',scales:'hp',cost:1,wants:['hp','spd'],name:'Roonie Baelk',role:'Support',profile:'Battery',art:'roonie-baelk-v7.png',hp:90,atk:16,def:14,spd:112,
      kit:'Skill (−1): Bypass the priority spender for 2 of their turns — +attack equal to 12% of Roonie\'s max health, and each Aether spend has a 50% chance to refund 1. Every second basic discounts their next skill. Ultimate: heal, ultimate charge, +6 Aether.'},
    Veska:{up3:'Holds one more Refrain.',el:'growth',scales:'hp',cost:1,wants:['hp','care'],name:'Veska Reed',role:'Sustain',profile:'Cadence',art:'veska-reed-v3.png',hp:105,atk:16,def:16,spd:100,
      kit:'Basics build a Refrain (max 3). Skill (−1): heal everyone 11% of her max health + 5.5% per Refrain; each Refrain becomes an Encore — the next crew basic gathers +1 Aether. Ultimate: heal 34% of her max health to all.'},
    Daven:{up3:'Draws attacks for 2 turns.',el:'order',scales:'def',cost:1,wants:['def','barrier'],name:'Daven Pell',role:'Sustain',profile:'Cadence',art:'daven-pell-v7.png',hp:150,atk:18,def:32,spd:90,
      kit:'Basics add barrier (19% of defense). Skill (−1): 225% hit, barrier equal to his defense, draws attacks until his next turn. First absorbed hit between turns returns 1 Aether. Ultimate: barrier of 125% defense to all.'},
    Silen:{up3:'Extra turns cost 1, 1, 1, 2, 2, 3…',el:'order',scales:'atk',cost:2,wants:['atk','crit','order'],name:'Silen',role:'DPS',profile:'Weaver — multi-point consumer',art:'silen-newt-v1.png',hp:100,atk:22,def:16,spd:105,
      kit:'Skill (−2): 200% hit, then extra turns at rising cost (1, 1, 2, 2, 3…), each 25 points stronger. Kills carry to the healthiest specimen. Ultimate: 500% single.'},
    // ---- Families (kits adapted from the affix lab; skills cost 1). Stats from lore: hp, attack = damage, speed × 10.
    // Break: strip shields, cash the Break.
    Wren:{up3:'Shatter hits twice.',family:'break',el:'decay',scales:'atk',cost:1,wants:['atk','crit','decay'],name:'Wren Adeyemi',role:'DPS',profile:'Breaker',art:'wren-adeyemi-v2.png',hp:122,atk:15,def:20,spd:80,
      kit:'Basics shred shields. Skill (−1): 220% with triple shield damage. Shatter: whenever any enemy Breaks, Wren hits it for 150%. Ultimate: 300% and strip every shield layer.'},
    Maul:{up3:'Deals 70% more to Broken enemies.',family:'break',el:'decay',scales:'atk',cost:1,wants:['atk','crit','decay'],name:'Maul',role:'Sub-DPS',profile:'Break responder',art:'maul-v2.png',hp:116,atk:20,def:20,spd:70,
      kit:'Deals 40% more to Broken enemies and hits them first. Skill (−1): 220% to a Broken enemy and push its recovery 20 AV later. Ultimate: 300% to every Broken enemy.'},
    Sevim:{up3:'Broken enemies take 45% more while Sevim stands.',family:'break',el:'order',scales:'def',cost:1,wants:['def','order','spd'],name:'Sevim Aydar',role:'Support',profile:'Area breaker',art:'sevim-aydar-v2.png',hp:94,atk:16,def:22,spd:100,
      kit:'Broken enemies take 30% more while Sevim stands. Skill (−1): 110% to every enemy with heavy shield damage. Ultimate: 200% to every enemy with triple shield damage.'},
    // Blight: stack poison that ticks through shields on the enemy's own turn, then detonate it.
    Stella:{up3:'Reagent Mist applies 3 poison.',family:'blight',el:'decay',scales:'atk',cost:1,wants:['atk','decay','spd'],name:'Stella Anuye',role:'Sub-DPS',profile:'Poison spreader',art:'stella-anuye-v2.png',hp:96,atk:18,def:15,spd:100,
      kit:'Basics apply 1 poison. Skill (−1): 70% to every enemy and 2 poison on each. Ultimate: 150% to every enemy and 3 poison on each.'},
    Dolores:{up3:'Detonations deal the poison 3 times over.',family:'blight',el:'chaos',scales:'atk',cost:1,wants:['atk','crit','chaos'],name:'Dolores Achterberg',role:'DPS',profile:'Detonator',art:'dolores-achterberg-v7.png',hp:104,atk:16,def:15,spd:90,
      kit:'Basics apply 1 poison. Skill (−1): detonate the most poisoned enemy — its poison 2.2 times over, at once, through shields. Ultimate: 3 poison on every enemy, then detonate the most poisoned twice over.'},
    Spore:{up3:'Culture Thread also heals everyone 8% of Spore\'s health.',family:'blight',heal:true,el:'growth',scales:'hp',cost:1,wants:['hp','care','growth'],name:'Spore',role:'Sustain',profile:'Poison and healing',art:'spore-v2.png',hp:98,atk:17,def:15,spd:100,
      kit:'Basics apply 1 poison. Skill (−1): 3 poison on every enemy and heal the most hurt ally 15% of Spore\'s health. Ultimate: 3 poison on every enemy and heal everyone 15% of Spore\'s health.'},
    // Hull: draw the attacks onto a prepared front-liner and return them.
    Reva:{up3:'Returns 100% of every attack.',family:'hull',guard:true,taunt:3,reflect:.8,el:'chaos',scales:'hp',cost:1,wants:['hp','def','chaos'],name:'Reva Sokolovna',role:'Sub-DPS',profile:'Retaliation',art:'reva-sokolovna-v2.png',hp:135,atk:24,def:26,spd:95,
      kit:'Returns 80% of every attack she takes, through shields, and 40% of that to every other enemy. Skill (−1): barrier of 30% of her health, draws attacks until her next turn, 220% hit. Ultimate: 240% and double retaliation until her next turn.'},
    Tarn:{up3:'Anchor Strike barrier is 150% of defense.',family:'hull',guard:true,taunt:3.5,el:'order',scales:'def',cost:1,wants:['def','barrier','hp'],name:'Tarn',role:'Sustain',profile:'Bastion',art:'tarn-v2.png',hp:136,atk:22,def:32,spd:70,
      kit:'Bastion: returns everything his barrier absorbs, through shields. Basics add barrier (25% of defense). Skill (−1): 180% hit and 70% to every other enemy, barrier of 110% defense, and draws attacks. Ultimate: barrier of 160% defense, and 60% to everyone else.'},
    Ojo:{up3:'Containment holds up to 8.',family:'hull',guard:true,taunt:3,el:'growth',scales:'hp',cost:1,wants:['hp','def','growth'],name:'Ojo Mbeki',role:'Sub-DPS',profile:'Containment',art:'lore/ojo-mbeki-v1.webp',hp:154,atk:26,def:30,spd:60,
      kit:'Containment: +1 each time any crewmate is hit (max 5). Skill (−1): 100% + 60% per Containment (spent) — at 3 or more, 50% to every other enemy too — barrier of 15% health, draws attacks. Ultimate: 120% + 30% per Containment to every enemy.'},
    // Drive: tempo and follow-ups.
    Imke:{up3:'Follows up twice per action.',family:'drive',el:'energy',scales:'atk',cost:1,wants:['atk','crit','spd'],name:'Imke',role:'Sub-DPS',profile:'Follow-ups',art:'imke-v3.png',hp:86,atk:14,def:14,spd:140,
      kit:'Too eager: when another crewmate lands a skill or ultimate, Imke follows up on that enemy for 80%, once per action. Skill (−1): 200% to the last enemy the crew struck, and act 25 AV sooner. Ultimate: 320% and two marks.'},
    Idris:{up3:'Adds 80% to every follow-up.',family:'drive',el:'energy',scales:'atk',cost:1,wants:['atk','energy','spd'],name:'Idris Okonjo',role:'Sub-DPS',profile:'Swarm follow-ups',art:'idris-okonjo-v2.png',hp:87,atk:13,def:14,spd:130,
      kit:'Basics hit every enemy for 60%. Motes: whenever a crewmate follows up, Idris adds 50% to the same enemy. Skill (−1): 90% to every enemy with shield damage. Ultimate: 200% to every enemy.'},
    Ekene:{up3:'The carry deals 50% more.',family:'drive',heal:true,el:'energy',scales:'hp',cost:1,wants:['hp','spd','care'],name:'Ekene Baptiste',role:'Support',profile:'Carry amplifier',art:'lore/ekene-baptiste-v2.png',hp:84,atk:15,def:14,spd:120,
      kit:'The carry deals 30% more while Ekene stands. Skill (−1): give the carry 35 ultimate charge and advance them 30 AV. Ultimate: heal everyone 16% of Ekene\'s health and give everyone 45 ultimate charge.'}
  };
  const FAMILIES={aether:'Aether Weavers',break:'Break',blight:'Blight',hull:'Hull',drive:'Drive'};
  // A kit multiplies power: attack, or health × HP_SCALE, or defense × DEF_SCALE (each chosen so base power ≈ base attack).
  // Silen's extra turns in the lab cost 1, 1, 2, 2, 3, 3…, so an 8-charge pool buys 6 hits rather than the live game's 3.
  const chainCost=i=>Math.ceil(i/2);
  const SCALING={atk:{name:'Attack',k:1},hp:{name:'Health',k:.18},def:{name:'Defense',k:.75}};
  const ELEMENTS=['energy','void','growth','order','decay','chaos'];
  const powerOf=u=>(u.scales==='atk'?u.atk:u.scales==='hp'?(u.maxHp||u.hp)*SCALING.hp.k:u.def*SCALING.def.k)+(u.bonusPower||0)+(u.lodestone||0);
  const IDS=Object.keys(ROSTER);

  // ---- Equipment ---------------------------------------------------------
  // Five slots. A piece's main stat is fixed by its slot; it also carries two random substats with
  // rolled values. Quality is the mean of those rolls (0–1), so "is this one worth keeping" is one
  // number. Two matching pieces on a crewmate turn on a set's 2-piece perk (so 2 + 2 runs two sets' perks at once); five, the full perk.
  const SLOTS=['core','chassis','shield','lens','coil'];
  const SLOT_NAMES={core:'Core',chassis:'Chassis',shield:'Shield',lens:'Lens',coil:'Coil'};
  const STATS={
    atk:{name:'Attack',min:1,max:3},hp:{name:'Health',min:4,max:12},spd:{name:'Speed',min:1.5,max:4.5},
    crit:{name:'Crit',min:.015,max:.045,pct:true},care:{name:'Healing & barrier',min:.015,max:.045,pct:true},
    barrier:{name:'Opening barrier',min:3,max:9},def:{name:'Defense',min:1.5,max:4.5},
    energy:{name:'Energy damage',min:.02,max:.06,pct:true},void:{name:'Void damage',min:.02,max:.06,pct:true},
    growth:{name:'Growth damage',min:.02,max:.06,pct:true},order:{name:'Order damage',min:.02,max:.06,pct:true},
    decay:{name:'Decay damage',min:.02,max:.06,pct:true},chaos:{name:'Chaos damage',min:.02,max:.06,pct:true}};
  const STAT_IDS=Object.keys(STATS);
  const MAIN={core:['atk',3],chassis:['hp',15],shield:['def',5],lens:['crit',.05],coil:['spd',5]};
  const SET_SIZE={half:2,full:5};
  const setCounts=rig=>{const c={};SLOTS.forEach(k=>{if(rig[k])c[rig[k].set]=(c[rig[k].set]||0)+1});return c};
  // Sets follow HoYoverse's pattern. The 2-piece perk is a plain stat (`two`), so anyone who wants that stat can use it
  // and 2 + 2 is a real build. The 5-piece perk rewards an action (spending, Breaking, poisoning, extra hits, timed
  // effects, ultimates…), never a named crewmate, so a set serves everyone who does that thing. Three sets add the
  // other HoYo patterns: a threshold (Steady Hand), a stat conversion (Lodestone) and a team buff (Chorus).
  // bestOn says who it suits best (faces in the UI); offFit is how much its perks are worth on anyone else.
  const SETS={
    wellspring:{name:'Wellspring',verb:'build',two:['spd',6],short:'Surplus Aether becomes barrier',bestOn:['Hanae','Roonie','Veska'],why:'Whoever generates the most Aether',
      rule:'5 pieces: each charge you generate while the pool is full becomes 15 barrier on the most hurt ally.'},
    deephold:{offFit:.7,name:'Deep Hold',verb:'hold',two:['hp',12],short:'More capacity; full-pool basics +50%',bestOn:['Ivara','Daven','Hanae'],why:'Anyone for the capacity',
      rule:'5 pieces: +3 Aether capacity, and while the pool is full your basics hit 50% harder.'},
    overdraw:{name:'Overdraw',verb:'spend',two:['atk',3],short:'Spend Aether you don\'t have yet',bestOn:['Arunima','Silen'],why:'Multi-point spenders',
      rule:'5 pieces: your skill can borrow up to 3 charges the pool does not have; new charges repay the debt first.'},
    metronome:{offFit:.5,name:'Metronome',verb:'cadence',two:['care',.06],short:'Timed effects last longer',bestOn:['Daven','Veska','Hanae','Roonie','Tarn','Reva'],why:'Anyone with a timed effect: taunts, Resonance, Bypass, Refrains',
      rule:'5 pieces: your timed effects last 1 turn longer (taunts, Resonance, Bypass; Veska holds 4 Refrains), and recasting the turn one ends is 50% stronger.'},
    faultline:{name:'Fault Line',verb:'break',two:['atk',3],short:'Bigger Breaks',bestOn:['Wren','Maul','Sevim','Ivara'],why:'Anyone who strips shields',
      rule:'5 pieces: +30% shield damage, and an enemy you Break takes 20% more from everyone until it recovers.'},
    longrot:{name:'Long Rot',verb:'blight',two:['spd',6],short:'Stronger, spreading poison',bestOn:['Stella','Dolores','Spore'],why:'Poison appliers',
      rule:'5 pieces: your poison deals 25% more, and when an enemy carrying it dies, half its stacks jump to the healthiest enemy.'},
    riposte:{name:'Riposte',verb:'retaliate',two:['def',4],short:'Harder returns',bestOn:['Reva','Tarn'],why:'Crew who return damage',
      rule:'5 pieces: damage you return deals 30% more and heals you for 30% of it.'},
    relay:{offFit:.4,name:'Relay',verb:'extra hits',two:['crit',.05],short:'Extra hits hit harder',bestOn:['Imke','Idris','Wren','Silen','Reva'],why:'Anyone who lands extra hits: follow-ups, Shatters, Silen\'s extra turns, returned damage',
      rule:'5 pieces: your extra hits (follow-ups, Shatters, extra turns, returned damage) deal 25% more, and each brings your next turn 5 AV sooner.'},
    steadyhand:{offFit:.6,name:'Steady Hand',verb:'threshold',two:['crit',.05],short:'Crit threshold: skills +20%',bestOn:['Arunima','Silen','Ivara','Dolores','Wren'],why:'Damage dealers who stack crit',
      rule:'5 pieces: while your crit is 25% or higher, your skills and ultimates deal 20% more.'},
    lodestone:{offFit:.6,name:'Lodestone',verb:'convert',two:['def',4],short:'Defense becomes power',bestOn:['Daven','Tarn','Sevim','Hanae','Ojo'],why:'Sturdy crew who should hit harder',
      rule:'5 pieces: you gain power equal to 40% of your defense.'},
    chorus:{offFit:.7,name:'Chorus',verb:'team buff',two:['hp',12],short:'Ultimate: the crew +15% power',bestOn:['Veska','Roonie','Ekene','Spore','Hanae'],why:'Supports who cast ultimates',
      rule:'5 pieces: when you cast an ultimate, every crewmate deals 15% more for their next 2 turns (does not stack).'}
  };
  // The 2-piece text comes from its stat.
  for(const S of Object.values(SETS))S.half='2 pieces: '+(STATS[S.two[0]].pct?'+'+Math.round(S.two[1]*100)+'% ':'+'+S.two[1]+' ')+STATS[S.two[0]].name.toLowerCase();
  // Equipment strength, in one place so the simulation can sweep it.
  // defK: defense D cuts incoming damage by D/(D+defK). bypassPower: Roonie's Bypass adds this share of his max health as attack.
  const EQUIP={wellFull:15,deepFull:3,deepBasic:1.5,overFull:3,beat:1.5,steadyAt:.25,steadyBonus:.2,lodestone:.4,chorus:.15,defK:200,bypassPower:.12,maxPoison:15,poisonPerPower:.4};
  const SET_IDS=Object.keys(SETS);
  const PIECES=SET_IDS.flatMap(set=>SLOTS.map(slot=>({set,slot})));
  // Packs focus on two sets: every pair, so a player can aim at the sets their crew needs.
  // Packs pair two sets: every pair of the four Aether sets, four family pairs and three with the broad sets (55 pairs would bury the shop).
  const AETHER_SETS=['wellspring','deephold','overdraw','metronome'],FAMILY_SETS=['faultline','longrot','riposte','relay'],BROAD_SETS=['steadyhand','lodestone','chorus'];
  const PACK_KINDS=[...AETHER_SETS.flatMap((a,i)=>AETHER_SETS.slice(i+1).map(b=>[a,b])),['faultline','longrot'],['riposte','relay'],['faultline','riposte'],['longrot','relay'],['steadyhand','lodestone'],['chorus','relay'],['steadyhand','chorus']]
    .map(([a,b])=>({id:a+'+'+b,sets:[a,b],name:SETS[a].name+' & '+SETS[b].name}));
  // Tiers: a piece rolls as many substats as its tier (★1–★4). Early pieces are thin, later ones carry more, so
  // there is always something better to find. Odds by sector; elite and boss drops are one tier higher.
  const TIER_ODDS={1:[[1,.7],[2,.3]],2:[[1,.1],[2,.5],[3,.4]],3:[[2,.1],[3,.5],[4,.4]]};
  function rollTier(r,sector,bonus=0){let x=r(),t=TIER_ODDS[sector][0][0];
    for(const [tier,p] of TIER_ODDS[sector]){x-=p;if(x<=0){t=tier;break}}return Math.min(4,t+bonus)}
  function makePiece(r,set,slot,uid,tier=2){
    const pool=STAT_IDS.filter(k=>k!==MAIN[slot][0]),subs=[];
    while(subs.length<tier){const k=pool.splice(Math.floor(r()*pool.length),1)[0],q=r(),S=STATS[k];subs.push({stat:k,v:S.min+q*(S.max-S.min),q})}
    return {uid,set,slot,tier,subs,quality:subs.reduce((t,x)=>t+x.q,0)/subs.length};
  }
  const tierOf=p=>p.tier||(p.subs?p.subs.length:1);
  const fmtStat=(k,v)=>STATS[k].pct?'+'+Math.round(v*100)+'% '+STATS[k].name.toLowerCase():'+'+Math.round(v)+' '+STATS[k].name.toLowerCase();
  function pieceStat(p){const [k,v]=MAIN[p.slot];return [fmtStat(k,v),...(p.subs||[]).map(x=>fmtStat(x.stat,x.v))].join(' · ')}
  const quality=p=>p.quality===undefined?.5:p.quality;

  // ---- The Brief: affixes ----------------------------------------------------
  // Ported from the affix lab (prototypes/affix-lab-model.js on the affix-team-building branch): the player picks how
  // many affixes (0–4), the voyage picks which, within category caps and compatibility. Every rule affix closes one
  // door and opens another. `rules(R)` edits the fight's rules; `report(m)` turns fight metrics into one sentence.
  // Not ported: Poison withers (no Weaver poisons, so it would be a pure gift). Proposed in the affix doc and not yet
  // in its pool: Concentrated fire, Channelers.
  const CAPS={stat:1,shape:1,rule:Infinity};
  const plural=(n,a,b)=>n+' '+(n===1?a:(b||a+'s'));
  const AFFIXES={
    frost:{name:'Spending Aether can freeze',category:'rule',requires:['breakWindow'],
      tax:'Each Aether spent gives a 12% chance to freeze the spender: their next turn comes 60 AV later, and the pool takes in nothing for 60 AV. Nobody freezes twice in a row.',
      gift:'A Break freezes the enemy: it misses the turn it would recover on.',
      rules(R){R.frost=true},
      report:m=>m.freezes?`Froze your crew ${plural(m.freezes,'time')}; ${m.frozenAether} Aether lost to the frozen pool. ${plural(m.skipped,'enemy turn')} skipped.`:'Nobody froze.'},
    hardened:{name:'Shields harden',category:'rule',touches:['soak'],
      tax:'Shielded enemies take 85% less health damage (normally 60% less).',
      gift:'When an enemy Breaks, every other enemy loses a shield layer, down to its last.',
      rules(R){R.soak=.15;R.crack=true},
      report:m=>`Shields swallowed ${Math.round(m.soaked)} damage; ${plural(m.breaks,'Break')} cracked ${plural(m.cracked,'more layer')}.`},
    snapback:{name:'Shields snap back',category:'rule',removes:['breakWindow'],touches:['soak'],
      tax:'A Break no longer delays the enemy, and its shields come back 30 AV later.',
      gift:'Shields are thinner: shielded enemies take 50% less health damage (normally 60%).',
      rules(R){R.breakDelayMul=0;R.reformAfter=30;R.soak=.5},
      report:m=>`${plural(m.breaks,'Break')}; ${plural(m.reformed,'shield')} snapped back before the enemy's turn.`},
    provoke:{name:'Breaks provoke a counterattack',category:'rule',
      tax:'When an enemy Breaks, it strikes back at once.',
      gift:'Ultimates charge 30% faster.',
      rules(R){R.provoke=true;R.chargeMul*=1.3},
      report:m=>`${plural(m.provoked,'Break')} drew a counterattack; ${plural(m.ults,'ultimate')} fired.`},
    scarce:{name:'Healing is halved',category:'rule',
      tax:'All healing is halved.',gift:'Barriers are doubled.',
      rules(R){R.healMul*=.5;R.barrierMul*=2},
      report:m=>`Healed ${Math.round(m.healing)}; barriers granted ${Math.round(m.barrier)}.`},
    shortFuses:{name:'Short fuses',category:'rule',touches:['aetherStart'],
      tax:'Battles are one round shorter.',gift:'Battles start with 5 Aether instead of 3.',
      rules(R){R.rounds-=1;R.start=5},
      report:m=>`Finished in ${m.rounds} rounds.`},
    deepReservoir:{name:'Deep reservoir',category:'rule',touches:['aetherStart','capacity'],
      tax:'Battles start with no Aether.',gift:'+3 Aether capacity.',
      rules(R){R.start=0;R.cap+=3},
      report:m=>`Biggest burst ${m.peakBurst}; ${m.wasted} Aether wasted at the cap.`},
    leanReserves:{name:'Lean reserves',category:'rule',touches:['capacity'],
      tax:'−2 Aether capacity.',gift:'Basics deal 25% more damage.',
      rules(R){R.cap-=2;R.basic*=1.25},
      report:m=>`${plural(m.basics,'basic')}; biggest burst ${m.peakBurst}.`},
    volatile:{name:'Volatile atmosphere',category:'rule',touches:['incoming'],
      tax:'Enemies deal 30% more damage.',gift:'Your crew deal 30% more damage.',
      rules(R){R.enemyAtk*=1.3;R.crewDmg*=1.3},
      report:m=>`You took ${Math.round(m.taken)} damage.`},
    brutal:{name:'Enemies hit 40% harder',category:'stat',touches:['incoming'],
      tax:'Enemy attacks deal 40% more damage.',gift:null,
      rules(R){R.enemyAtk*=1.4},
      report:m=>`You took ${Math.round(m.taken)} damage.`},
    horde:{name:'Twice as many, half as tough',category:'shape',touches:['incoming'],
      tax:'Every wave has twice as many enemies at half health; bosses bring two escorts.',gift:null,
      rules(R){R.horde=true},
      report:m=>`Defeated ${plural(m.kills,'enemy','enemies')}.`}
  };
  const AFFIX_IDS=Object.keys(AFFIXES);
  function baseRules(){return {soak:.4,vuln:.35,breakDelay:.35,breakDelayMul:1,reformAfter:0,enemyAtk:1,crewDmg:1,healMul:1,barrierMul:1,chargeMul:1,
    horde:false,rounds:0,start:3,cap:0,basic:1,frost:false,crack:false,provoke:false}}
  function rulesFor(ids){const R=baseRules();(ids||[]).forEach(id=>AFFIXES[id]&&AFFIXES[id].rules(R));return R}
  // Compatibility: a card that `requires` something never shares a Brief with one that `removes` it, and two cards
  // that `touch` the same number never stack. Category caps: at most one stat and one shape card.
  function conflicts(ids){
    const gone=new Set(ids.flatMap(id=>AFFIXES[id].removes||[])),first={},out=new Set();
    ids.forEach(id=>{if((AFFIXES[id].requires||[]).some(r=>gone.has(r)))out.add(id)});
    ids.forEach(id=>(AFFIXES[id].touches||[]).forEach(t=>{if(first[t]){out.add(first[t]);out.add(id)}else first[t]=id}));
    return ids.filter(id=>out.has(id));
  }
  function legalStack(ids){
    const used={};for(const id of ids){if(!AFFIXES[id])return false;const c=AFFIXES[id].category;used[c]=(used[c]||0)+1;if(used[c]>CAPS[c])return false}
    return new Set(ids).size===ids.length&&conflicts(ids).length===0;
  }
  // The player picks the weight (count); the voyage picks the text, rejecting draws that would break a rule.
  function rollBrief(seed,count){
    const r=rng(mix(seed,991)),shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
    const affixes=[];for(const id of shuffle(AFFIX_IDS)){if(affixes.length>=count)break;if(legalStack([...affixes,id]))affixes.push(id)}
    return {affixes,bosses:shuffle(Object.keys(BOSSES)),count};
  }
  const BOSSES={
    brood:{name:'The Brood',text:'Summons a small specimen every turn. Only the Brood itself counts toward recovery.'},
    carapace:{name:'The Carapace',text:'Six shield layers over enormous health. Every third attack is heavy.'},
    sprinter:{name:'The Sprinter',text:'Acts twice a round and hits hard.'}
  };

  // ---- Recovery caches -----------------------------------------------------
  // Some enemies carry a cache (the corpus's Recovery caches; Currency Wars' crystals). Defeating the carrier drops it;
  // it waits unopened until the player opens it on the Prepare screen. Tier sets the pool; the sector it dropped in sets
  // the amounts. Contents are seeded by voyage and cache, so reloading can't reroll them. Every source is fixed by the
  // route (Supply runs, at most one carrier per regular battle, the elites' Warden, the boss), so a voyage's caches are bounded.
  const CACHE={
    names:{1:'Tier I cache',2:'Tier II cache',3:'Tier III cache'},
    pools:{1:[['gold',.7],['piece',.3]],2:[['gold',.35],['piece',.3],['writ',.2],['insight',.15]],3:[['pieces',.35],['voucher',.25],['gold',.2],['insight',.2]]},
    gold:{1:[4,7],2:[9,14],3:[24,34]},sectorGold:[1,1.4,1.8],
    supply:{1:3,2:1},regularChance:.3,regularTier2:.3};
  function rollCache(s,cache){
    const r=rng(mix(s.seed,cache.id,7777)),sector=sectorOf(Math.min(cache.node,21)),pool=CACHE.pools[cache.tier];
    let x=r(),kind=pool[0][0];for(const [k,p] of pool){x-=p;if(x<=0){kind=k;break}}
    const [lo,hi]=CACHE.gold[cache.tier],gold=Math.round((lo+r()*(hi-lo))*CACHE.sectorGold[sector-1]);
    const piece=bonus=>{const p=PIECES[Math.floor(r()*PIECES.length)];return makePiece(r,p.set,p.slot,s.uid++,rollTier(r,sector,bonus))};
    if(kind==='gold')return {kind,gold};
    if(kind==='piece')return {kind,pieces:[piece(cache.tier-1)]};
    if(kind==='pieces')return {kind,pieces:[piece(1),piece(1)]};
    if(kind==='writ')return {kind,writs:1};
    if(kind==='insight')return {kind,insight:cache.tier-1};
    return {kind:'voucher',vouchers:1};
  }
  function describeCache(o){return o.gold?'+'+o.gold+' Gold':o.writs?'+1 Writ':o.insight?'+'+o.insight+' Insight':o.vouchers?'a free voucher':o.pieces.map(p=>'★'.repeat(tierOf(p))+' '+SETS[p.set].name+' '+SLOT_NAMES[p.slot]).join(' and ')}

  // ---- Route -------------------------------------------------------------
  // Nodes 2 and 3 are Supply runs (Currency Wars' reward fights): weak enemies, no deadline, full rewards every time.
  const ROUTE=['setup','supply','supply','swarm','elite','reward','boss','survey','swarm','rest','survey','elite','reward','boss','swarm','survey','rest','survey','elite','reward','boss'];
  const NODE_NAMES={supply:'Supply run',setup:'Departure',survey:'Survey',swarm:'Swarm',elite:'Elite',reward:'Reward',boss:'Boss',rest:'Modifier stop'};
  const sectorOf=node=>Math.min(3,Math.ceil(node/7));
  const BATTLES=new Set(['supply','survey','swarm','elite','boss']);

  // ---- Economy -----------------------------------------------------------
  // Gold buys equipment; Writs buy crew. Exchange is scaled so Writs per battle stay about as before
  // (14 Gold a battle, 18 per Writ). Calibrated with sim/weaver-voyage.js; starting values, not balance.
  // A pack holds five pieces from the two sets on its label. Scrapping a whole pack returns about 60%
  // of its price, so opening is still a decision; crafting a chosen piece costs about 1.5 packs.
  // Gold can be paid into the Writ fund a little at a time; every writCost Gold becomes a Writ.
  // supplyGold: a Supply run pays this much Gold whatever happens (a normal battle pays up to goldPerBattle); most of its
  // reward is in the caches its enemies carry.
  // Stars: every crewmate starts at ★1 and is promoted with Insight (elites, bosses, some caches, and Gold at a rising price).
  // ★2/★3 match the live game's steps (crew-progression.js); ★4 is a late-voyage goal. ★3 also upgrades the kit (up3).
  const STARS={max:4,cost:{2:2,3:3,4:5},hp:[1,1.35,1.8,2.2],atk:[1,1.25,1.6,2],insightGold:25,insightStep:5};
  const ECON={insight:{elite:1,boss:2},supplyGold:8,goldPerBattle:14,pack:8,packSize:5,craft:12,scrap:1,writCost:18,rewardPacks:3,writs:{elite:1,boss:2},startIntegrity:70};
  const BANDS=[
    {min:1,name:'Perfect recovery',pay:1,delta:s=>2+s},
    {min:.88,name:'Slight shortfall',pay:.75,delta:()=>0},
    {min:.68,name:'Small loss',pay:.55,delta:s=>-(2+2*s)},
    {min:.42,name:'Mild loss',pay:.35,delta:s=>-(4+3*s)},
    {min:.18,name:'Heavy loss',pay:.2,delta:s=>-(6+4*s)},
    {min:-1,name:'Total loss',pay:.08,delta:s=>-(8+5*s)}];
  const band=score=>BANDS.find(b=>score>=b.min-1e-9);

  // ---- Voyage state ------------------------------------------------------
  function create(opts={}){
    const seed=(opts.seed>>>0)||41,count=Math.max(0,Math.min(4,opts.affixCount===undefined?2:opts.affixCount|0));
    const brief=opts.affixes?{affixes:opts.affixes.filter(id=>AFFIXES[id]),bosses:rollBrief(seed,0).bosses,count:opts.affixes.length}:rollBrief(seed,count);
    return {version:3,seed,brief,node:1,integrity:ECON.startIntegrity,writs:0,gold:0,
      crew:[],hold:[],pendingDrop:null,writFund:0,freeVoucher:0,priority:'auto',uid:1,ended:false,endReason:'',
      fights:[],purchases:[],log:[],caches:[],cacheSeq:1,opened:[],insight:0,insightBought:0};
  }
  const nodeType=s=>ROUTE[s.node-1];
  const insightPrice=s=>STARS.insightGold+STARS.insightStep*(s.insightBought||0);
  const voucherPrice=s=>Math.max(2,s.crew.length);
  // Releasing refunds the price of the voucher that would refill the spot, minus one,
  // so a swap always costs exactly one Writ at any team size.
  const releaseRefund=s=>Math.max(0,Math.max(2,s.crew.length-1)-1);
  function setOn(rig){const sets=SLOTS.map(k=>rig[k]&&rig[k].set);return sets[0]&&sets.every(x=>x===sets[0])?sets[0]:null}
  function completedSets(member){return member.rigs.map(setOn).filter(Boolean)}
  // For each rig: the set with the most pieces, how many, and which slots still need it.
  // A slot holding another set's piece counts as missing: it has to be replaced.
  function setProgress(member){
    return member.rigs.map((rig,i)=>{
      const counts={};SLOTS.forEach(k=>{if(rig[k])counts[rig[k].set]=(counts[rig[k].set]||0)+1});
      const best=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
      if(!best)return {rig:i,set:null,count:0,missing:SLOTS.slice(),complete:false};
      const [set,count]=best;
      const halves=Object.entries(counts).filter(([id,n])=>n>=SET_SIZE.half&&n<SET_SIZE.full).map(([id])=>id);
      return {rig:i,set,count,missing:SLOTS.filter(k=>!rig[k]||rig[k].set!==set),complete:count===SET_SIZE.full,half:count>=SET_SIZE.half,halves,counts};
    });
  }
  // Where a piece would move a set forward: crewmates whose leading set on a rig matches it and
  // who still need that slot.
  function pieceAdvances(s,piece){
    return s.crew.flatMap(c=>c.rigs.map((rig,i)=>({rig,i,n:setCounts(rig)[piece.set]||0}))
      .filter(x=>x.n>0&&x.n<SET_SIZE.full&&!(x.rig[piece.slot]&&x.rig[piece.slot].set===piece.set))
      .map(x=>({crew:c.id,rig:x.i,set:piece.set,after:x.n+1,completes:x.n+1===SET_SIZE.full,unlocks:x.n+1===SET_SIZE.half})));
  }
  function capacityPreview(s,crewIds){
    const ids=crewIds||s.crew.map(c=>c.id),cond=rulesFor(s.brief.affixes);
    const stars=s.crew.filter(c=>ids.includes(c.id)&&c.id==='Ivara'&&(c.star||1)>=3).length,base=A.capacity(ids.map(n=>({n})))+stars,deep=s.crew.filter(c=>ids.includes(c.id)).reduce((t,c)=>{const st=statsFor(c);return t+(st.sets.deephold?EQUIP.deepFull:0)},0);
    return {base:6,weavers:ids.filter(n=>A.profile(n).role).length,reservoir:ids.includes('Ivara')?2:0,stars,deepHold:deep,condition:cond.cap||0,total:Math.max(1,base+deep+(cond.cap||0))};
  }
  function budgetWords(s){
    const ids=s.crew.map(c=>c.id),spenders=ids.filter(id=>['Arunima','Silen'].includes(id)),makers=ids.filter(id=>['Hanae','Roonie'].includes(id));
    if(!ids.length)return 'No crew yet.';
    if(!spenders.length)return makers.length?'Generates far more than it spends — surplus will be wasted at the cap.':'No heavy spender; the pool will mostly sit.';
    if(spenders.length>1)return 'Two heavy spenders; one will wait while the other spends.';
    if(!makers.length)return 'One heavy spender and nobody building for it — bursts will be small or slow.';
    return 'A builder feeding a spender — the pool cycles.';
  }
  function note(s,text){s.log.push({node:s.node,text})}
  function advance(s){
    s.node++;
    if(s.integrity<=0){s.ended=true;s.endReason='Integrity reached zero.';s.node=Math.min(s.node,22)}
    else if(s.node>21){s.ended=true;s.endReason='Voyage complete.'}
  }
  function newRig(){return Object.fromEntries(SLOTS.map(k=>[k,null]))}

  function act(s,a){
    if(!s.caches){s.caches=[];s.cacheSeq=1;s.opened=[]} // saves from before caches
    if(s.insight===undefined){s.insight=0;s.insightBought=0} // saves from before stars
    if(s.ended&&a.type!=='takeDrop')return 'The voyage is over. Start a new one.';
    const type=nodeType(s);
    if(s.pendingDrop&&['launch','pass','reward'].includes(a.type))return 'Choose your drop first.';
    switch(a.type){
      case 'starters':{
        if(type!=='setup')return 'Starters are chosen at departure.';
        const ids=[...new Set(a.ids||[])];
        if(ids.length!==2||!ids.every(id=>ROSTER[id]))return 'Choose exactly two crew.';
        s.crew=ids.map(id=>({id,rigs:[newRig()]}));
        s.purchases.push({node:1,id:ids[0],price:0,source:'starter'},{node:1,id:ids[1],price:0,source:'starter'});
        note(s,'Departed with '+ids.map(id=>ROSTER[id].name).join(' and ')+'.');advance(s);return null;}
      case 'voucher':{
        if(type==='setup')return 'Choose your two starters first.';
        if(!ROSTER[a.id])return 'Unknown crewmate.';
        if(s.crew.some(c=>c.id===a.id))return ROSTER[a.id].name+' is already aboard.';
        const free=s.freeVoucher>0,price=free?0:voucherPrice(s);
        if(s.writs<price)return 'Needs '+price+' Writs.';
        if(free)s.freeVoucher--;else s.writs-=price;
        s.crew.push({id:a.id,rigs:[newRig()]});
        s.purchases.push({node:s.node,id:a.id,price,source:free?'free voucher':'voucher',crewSize:s.crew.length});
        note(s,ROSTER[a.id].name+' joined'+(free?' (free voucher).':' for '+price+' Writs.'));return null;}
      case 'release':{
        const i=s.crew.findIndex(c=>c.id===a.id);if(i<0)return 'Not aboard.';
        if(s.crew.length<=1)return 'Keep at least one crewmate.';
        const refund=releaseRefund(s);
        s.crew[i].rigs.forEach(r=>SLOTS.forEach(k=>{if(r[k])s.hold.push(r[k])}));s.crew.splice(i,1);s.writs+=refund;if(s.priority===a.id)s.priority='auto';
        s.purchases.push({node:s.node,released:a.id,refund});
        note(s,ROSTER[a.id].name+' left the ship for '+refund+(refund===1?' Writ.':' Writs.')+' Their equipment is in the hold.');return null;}
      case 'pack':{
        if(type==='setup')return 'Choose your starters first.';
        if(!PACK_KINDS.some(k=>k.id===a.kind))return 'Choose which pack to open.';
        if(s.gold<ECON.pack)return 'A pack costs '+ECON.pack+' Gold.';
        s.gold-=ECON.pack;const opened=openPack(s,a.kind);s.lastPack=opened.map(p=>p.uid);
        note(s,'Opened a pack: '+opened.map(p=>SETS[p.set].name+' '+SLOT_NAMES[p.slot]).join(', ')+'.');return null;}
      case 'craft':{
        if(type==='setup')return 'Choose your starters first.';
        if(!SETS[a.set]||!SLOTS.includes(a.slot))return 'Choose a set and a slot.';
        if(s.gold<ECON.craft)return 'Crafting costs '+ECON.craft+' Gold.';
        s.gold-=ECON.craft;s.hold.push(makePiece(rng(mix(s.seed,s.node,s.uid,31)),a.set,a.slot,s.uid++,sectorOf(Math.min(s.node,21))));note(s,'Crafted '+SETS[a.set].name+' '+SLOT_NAMES[a.slot]+'.');return null;}
      case 'scrap':{
        const i=s.hold.findIndex(p=>p.uid===a.uid);if(i<0)return 'That piece is not in the hold.';
        s.hold.splice(i,1);s.gold+=ECON.scrap;return null;}
      case 'scrapBelow':{
        const cut=+a.quality,gone=s.hold.filter(p=>quality(p)<cut);if(!gone.length)return 'Nothing in the hold is below that.';
        s.hold=s.hold.filter(p=>quality(p)>=cut);s.gold+=gone.length*ECON.scrap;
        note(s,'Scrapped '+gone.length+' pieces below '+Math.round(cut*100)+'% for '+gone.length*ECON.scrap+' Gold.');return null;}
      case 'invest':{
        const amount=a.amount==='all'?s.gold:Math.floor(+a.amount);
        if(!(amount>0))return 'Choose how much Gold to put in.';if(s.gold<amount)return 'Not enough Gold.';
        s.gold-=amount;s.writFund=(s.writFund||0)+amount;let made=0;while(s.writFund>=ECON.writCost){s.writFund-=ECON.writCost;s.writs++;made++}
        s.purchases.push({node:s.node,invest:amount,writs:made});if(made)note(s,'The Writ fund paid out '+made+(made>1?' Writs.':' Writ.'));return null;}
      case 'equip':{
        const i=s.hold.findIndex(p=>p.uid===a.uid),m=s.crew.find(c=>c.id===a.crew);
        if(i<0||!m)return 'Choose a piece in the hold and a crewmate.';
        const rig=m.rigs[a.rig||0];if(!rig)return 'No such rig.';
        const p=s.hold[i];if(rig[p.slot])s.hold.push(rig[p.slot]);rig[p.slot]=p;s.hold.splice(i,1);return null;}
      case 'unequip':{
        const m=s.crew.find(c=>c.id===a.crew),rig=m&&m.rigs[a.rig||0];
        if(!rig||!rig[a.slot])return 'Nothing equipped there.';
        s.hold.push(rig[a.slot]);rig[a.slot]=null;return null;}
      case 'priority':{s.priority=a.name==='auto'||ROSTER[a.name]?a.name:'auto';return null;}
      case 'reward':{
        if(type!=='reward')return 'This is not a reward node.';
        if(a.choice==='voucher'){s.freeVoucher++;note(s,'Reward: a free voucher.');}
        else if(a.choice==='packs'){if(!PACK_KINDS.some(k=>k.id===a.kind))return 'Choose which packs.';const opened=[];for(let i=0;i<ECON.rewardPacks;i++)opened.push(...openPack(s,a.kind));s.lastPack=opened.map(p=>p.uid);
          note(s,'Reward: '+ECON.rewardPacks+' packs, '+opened.length+' pieces.');}
        else if(a.choice==='craft'){if(!SETS[a.set]||!SLOTS.includes(a.slot))return 'Choose a set and a slot.';
          s.hold.push(makePiece(rng(mix(s.seed,s.node,s.uid,37)),a.set,a.slot,s.uid++,Math.min(4,sectorOf(Math.min(s.node,21))+1)));note(s,'Reward: crafted '+SETS[a.set].name+' '+SLOT_NAMES[a.slot]+'.');}
        else return 'Choose a reward.';
        advance(s);return null;}
      // Quick equip: repeatedly make the single biggest upgrade from the hold until none is left. Each move raises one
      // crewmate's rig value and changes no one else's, so it always ends. A replaced piece returns to the hold.
      case 'quickEquip':{
        const moves=[];
        for(let guard=0;guard<60;guard++){
          let best=null;for(const p of s.hold){const u=bestUse(s,p);if(u&&(!best||u.delta>best.u.delta))best={p,u}}
          if(!best)break;
          const m=s.crew.find(c=>c.id===best.u.crew),rig=m.rigs[0],old=rig[best.p.slot];
          s.hold.splice(s.hold.indexOf(best.p),1);if(old)s.hold.push(old);rig[best.p.slot]=best.p;
          moves.push({uid:best.p.uid,crew:m.id,slot:best.p.slot,set:best.p.set,replaced:old?old.uid:null,gained:best.u.gained});
        }
        s.lastQuick=moves;if(!moves.length)return 'Nothing in the hold is an upgrade for anyone.';
        note(s,'Quick equip: '+moves.length+' piece'+(moves.length>1?'s':'')+' — '+moves.map(x=>SETS[x.set].name+' '+SLOT_NAMES[x.slot]+' on '+ROSTER[x.crew].name.split(' ')[0]).join(', ')+'.');return null;}
      case 'promote':{
        const m=s.crew.find(c=>c.id===a.id);if(!m)return 'Not aboard.';const star=m.star||1;
        if(star>=STARS.max)return ROSTER[m.id].name+' is already ★'+STARS.max+'.';
        const cost=STARS.cost[star+1];if(s.insight<cost)return 'Needs '+cost+' Insight.';
        s.insight-=cost;m.star=star+1;m.insightSpent=(m.insightSpent||0)+cost;
        s.purchases.push({node:s.node,promote:m.id,star:m.star,insight:cost});
        note(s,ROSTER[m.id].name+' is now ★'+m.star+(m.star===3?' — kit upgraded':'')+'.');return null;}
      case 'buyInsight':{
        const price=insightPrice(s);if(s.gold<price)return 'Needs '+price+' Gold.';
        s.gold-=price;s.insight++;s.insightBought++;note(s,'Bought 1 Insight for '+price+' Gold.');return null;}
      case 'openCache':{
        const ids=(a.ids||[]).filter(id=>s.caches.some(c=>c.id===id));if(!ids.length)return 'Choose a cache to open.';
        const out=[];
        for(const id of ids){const i=s.caches.findIndex(c=>c.id===id),cache=s.caches[i],o=rollCache(s,cache);s.caches.splice(i,1);
          if(o.gold)s.gold+=o.gold;if(o.writs)s.writs+=o.writs;if(o.insight)s.insight+=o.insight;if(o.vouchers)s.freeVoucher+=o.vouchers;if(o.pieces)s.hold.push(...o.pieces);
          const rec={id,tier:cache.tier,node:cache.node,from:cache.from,...o,text:describeCache(o)};s.opened.push({...rec,pieces:o.pieces?o.pieces.map(p=>({set:p.set,slot:p.slot,tier:p.tier})):undefined});out.push(rec)}
        s.lastOpened=out;note(s,'Opened '+out.length+' cache'+(out.length>1?'s':'')+': '+out.map(o=>o.text).join(', ')+'.');return null;}
      case 'takeDrop':{
        const pd=s.pendingDrop;if(!pd)return 'There is no drop to choose.';
        const p=pd.offers[a.index];if(!p)return 'Choose one of the three pieces.';
        s.hold.push(p);s.pendingDrop=null;const rec=s.fights.find(f=>f.node===pd.node);if(rec)rec.took={set:p.set,slot:p.slot};
        note(s,'Took '+SETS[p.set].name+' '+SLOT_NAMES[p.slot]+' from the drop.');return null;}
      case 'pass':{if(type!=='rest')return 'Only modifier stops can be passed.';note(s,'Passed the modifier stop (modifiers are the Brief in this lab).');advance(s);return null;}
      case 'launch':{
        if(!BATTLES.has(type))return 'There is no battle at this node.';
        if(!s.crew.length)return 'No crew.';
        s.lastPack=null;const f=fight(s);applyFight(s,f);return null;}
      default:return 'Unknown action.';
    }
  }

  // After each battle: three pieces to choose from. If any crewmate has started a set, one offer is a
  // piece that set still needs; the others are random. Seeded per node, so reloading can't reroll them.
  function dropOffers(s,node){
    const r=rng(mix(s.seed,node,4242)),out=[];
    const needs=s.crew.flatMap(c=>setProgress(c).filter(p=>p.set&&!p.complete).flatMap(p=>p.missing.map(slot=>({set:p.set,slot}))));
    if(needs.length)out.push(needs[Math.floor(r()*needs.length)]);
    while(out.length<3){const p=PIECES[Math.floor(r()*PIECES.length)];if(!out.some(o=>o.set===p.set&&o.slot===p.slot))out.push(p)}
    const bonus=['elite','boss'].includes(ROUTE[node-1])?1:0;
    return out.map(p=>makePiece(r,p.set,p.slot,s.uid++,rollTier(r,sectorOf(node),bonus)));
  }
  // A pack holds five pieces, each from one of its two sets in a random slot. Seeded by voyage, node and uid.
  function openPack(s,kind){
    const K=PACK_KINDS.find(k=>k.id===kind);if(!K)return null;
    const r=rng(mix(s.seed,s.node,s.uid,8191)),out=[];
    const sector=sectorOf(Math.min(s.node,21));
    for(let i=0;i<ECON.packSize;i++)out.push(makePiece(r,K.sets[Math.floor(r()*2)],SLOTS[Math.floor(r()*SLOTS.length)],s.uid++,rollTier(r,sector)));
    s.hold.push(...out);return out;
  }

  // ---- Upgrade or scrap? -------------------------------------------------
  // How much a set's perks are worth on a crewmate: fully on the crew it suits (bestOn), offFit elsewhere, and nothing
  // where its rule can't work (onlyOn).
  function setFit(id,set){const S=SETS[set];return S.bestOn.includes(id)?1:S.onlyOn?0:(S.offFit===undefined?.3:S.offFit)}
  // What a rig is worth to one crewmate. Set perks dominate (3 for the 2-piece perk, 6 for the full
  // set, plus a little for progress toward the leading set); then stats, normalised by each stat's
  // largest substat roll, with the crewmate's wanted stats counted fully and the rest at 0.3.
  function rigValue(member,rig){
    const m={id:member.id,rigs:[rig]},st=statsFor(m),base=statsFor({id:member.id,rigs:[Object.fromEntries(SLOTS.map(k=>[k,null]))]});
    const wants=ROSTER[member.id].wants;let stats=0;
    for(const k of STAT_IDS)stats+=(st[k]-base[k])/STATS[k].max*(wants.includes(k)?1:.3);
    let sets=0;const pr=setProgress(m)[0];
    // A threshold set (Steady Hand) is worth its 5-piece perk only if this rig clears the threshold; short of it, building
    // toward the set is worth a little (the 2-piece crit still counts as a stat).
    const reach=id=>id!=='steadyhand'||st.crit>=EQUIP.steadyAt?1:.2;
    for(const id of SET_IDS){const n=SLOTS.filter(k=>rig[k]&&rig[k].set===id).length;sets+=(n>=SET_SIZE.full?6*reach(id):n>=SET_SIZE.half?3:0)*setFit(member.id,id)}
    // Each piece toward the leading set counts 2 on someone the set suits (more than its share of the 2-piece perk), so a
    // set's own crew outrank a better main stat on someone else; off-fit crew get setFit of that.
    if(pr.set)sets+=2*pr.count*setFit(member.id,pr.set)*reach(pr.set);
    return {sets,stats,total:sets+stats,stat:st};
  }
  // For a piece: what it would do in its slot on each crewmate, best first. Verdict order: a perk
  // gained or lost outranks any stat change; among stat changes, wanted stats outrank the rest.
  function compareFor(s,piece){
    return s.crew.map(c=>{
      const rig=c.rigs[0],cur=rig[piece.slot],after=Object.assign({},rig,{[piece.slot]:piece});
      const b=rigValue(c,rig),a=rigValue(c,after),pb=setProgress({id:c.id,rigs:[rig]})[0],pa=setProgress({id:c.id,rigs:[after]})[0];
      const perks=r=>SET_IDS.flatMap(id=>{const n=SLOTS.filter(k=>r[k]&&r[k].set===id).length;return n>=SET_SIZE.full?[id+':full']:n>=SET_SIZE.half?[id+':half']:[]});
      const before=perks(rig),now=perks(after);
      const statDelta={};for(const k of STAT_IDS){const d=a.stat[k]-b.stat[k];if(Math.abs(d)>1e-9)statDelta[k]=d}
      const delta=a.total-b.total;
      return {crew:c.id,slot:piece.slot,current:cur||null,delta,statDelta,
        gained:now.filter(x=>!before.includes(x)),lost:before.filter(x=>!now.includes(x)),
        setBefore:{set:pb.set,count:pb.count},setAfter:{set:pa.set,count:pa.count},
        verdict:delta>.05?'upgrade':delta<-.05?'downgrade':'sidegrade'};
    }).sort((x,y)=>y.delta-x.delta);
  }
  const bestUse=(s,piece)=>compareFor(s,piece).find(x=>x.verdict==='upgrade')||null;

  function applyFight(s,f){
    const type=nodeType(s),supply=type==='supply',b=supply?BANDS[0]:band(f.score),sector=sectorOf(s.node);
    // Supply runs always pay in full and never cost integrity, whatever the result.
    const delta=supply?0:b.delta(sector),gold=supply?ECON.supplyGold:Math.round(ECON.goldPerBattle*b.pay),writs=ECON.writs[type]||0,insight=ECON.insight[type]||0;
    const offers=dropOffers(s,s.node);
    s.integrity=Math.max(0,Math.min(100,s.integrity+delta));s.gold+=gold;s.writs+=writs;s.insight=(s.insight||0)+insight;s.pendingDrop={node:s.node,offers};
    const caches=(f.drops||[]).map(d=>({id:s.cacheSeq++,tier:d.tier,node:s.node,from:d.from}));s.caches.push(...caches);
    const record={node:s.node,type,sector,score:f.score,band:b.name,integrity:delta,gold,writs,insight,offers:offers.map(p=>({set:p.set,slot:p.slot})),took:null,caches:caches.map(c=>c.tier),
      crew:s.crew.map(c=>({id:c.id,sets:completedSets(c),pieces:c.rigs.flatMap(r=>SLOTS.map(k=>r[k]&&r[k].set+':'+k)).filter(Boolean)})),
      capacity:f.capacity,metrics:f.metrics,outcome:f.outcome,reports:f.reports};
    s.fights.push(record);s.lastFight=f;
    note(s,NODE_NAMES[type]+': '+(supply?'supplies secured':b.name+' ('+Math.round(f.score*100)+'%)')+'. '+(supply?'':(delta>0?'+':'')+delta+' integrity, ')+'+'+gold+' Gold'+(writs?', +'+writs+' Writs':'')+(insight?', +'+insight+' Insight':'')+(caches.length?', '+caches.length+' cache'+(caches.length>1?'s':''):'')+'. Choose one of three pieces.');
    advance(s);
    return record;
  }

  // ---- Encounters --------------------------------------------------------
  // Calibrated so no branch saturates (sim/weaver-voyage.js); initial values, not balance findings.
  // Every enemy carries shield layers (the affix lab's model): layers × layerHp, scaled by √(sector health).
  // Sectors 2 and 3 were raised when stars arrived (were hp .8/2.5/5, attack .85/1.75/2.65): a crew that skips its upgrades falls behind.
  const SCALE={hp:[.8,3,7.5],atk:[.85,2,3.4],enemyHp:3,enemyAtk:2.3,eliteHp:.6,bossHp:.55,layerHp:1};
  function enemy(name,hp,atk,spd,sector,layers,layerHp,extra={}){
    const kind=extra.boss?SCALE.bossHp:extra.elite?SCALE.eliteHp:1,hpMul=extra.hpMul||1;
    return {name,maxHp:Math.round(hp*kind*hpMul*SCALE.enemyHp*SCALE.hp[sector-1]),atk:atk*SCALE.enemyAtk*SCALE.atk[sector-1],spd,scoring:extra.scoring!==false,
      layers,layerHp:Math.round(layerHp*SCALE.layerHp*Math.sqrt(SCALE.hp[sector-1])),boss:extra.boss,elite:extra.elite};
  }
  function encounter(s,node){
    const type=ROUTE[node-1],sector=sectorOf(node),r=rng(mix(s.seed,node,1313)),R=rulesFor(s.brief.affixes);
    const n=k=>R.horde?k*2:k,hpMul=R.horde?.5:1;
    const regulars=['Drifter','Husk','Lancer','Grazer'];
    const reg=()=>enemy(regulars[Math.floor(r()*regulars.length)],70+Math.floor(r()*25),8+r()*2,92+Math.floor(r()*16),sector,2,25,{hpMul});
    const mote=()=>enemy('Mote',26,5,100+Math.floor(r()*10),sector,1,10,{hpMul});
    let waves=[],rounds=7,boss=null;
    // Survey waves match the crew: two starters face pairs; from three crewmates on, the full three.
    const crewN=Math.max(2,Math.min(3,(s.crew||[]).length||2));
    if(type==='survey'){waves=[0,1].map(()=>Array.from({length:n(crewN)},reg));rounds=7}
    // A Supply run: two waves of weak regulars, crew size + 2 each (a quarter of the health, 20% of the attack, one shield
    // layer so Breaks still show), and no deadline worth the name.
    else if(type==='supply'){const weak=()=>{const e=reg();return {...e,maxHp:Math.round(e.maxHp*.25),atk:e.atk*.2,layers:1}};
      waves=[0,1].map(()=>Array.from({length:crewN+2},weak));rounds=99}
    else if(type==='swarm'){waves=[0,1,2].map(()=>Array.from({length:n(5)},mote));rounds=7}
    else if(type==='elite'){waves=[0,1].map(()=>[enemy('Warden',240,12,98,sector,4,40,{elite:true,hpMul}),...Array.from({length:n(2)},reg)]);rounds=8}
    else if(type==='boss'){
      boss=s.brief.bosses[sector-1];rounds=10;const bm=R.horde?.8:1;
      if(boss==='brood')waves=[[enemy('The Brood',700,9,100,sector,3,40,{boss:'brood',hpMul:bm})]];
      if(boss==='carapace')waves=[[enemy('The Carapace',1500,12,80,sector,6,60,{boss:'carapace',hpMul:bm})]];
      if(boss==='sprinter')waves=[[enemy('The Sprinter',900,11,200,sector,3,40,{boss:'sprinter',hpMul:bm})]];
      if(R.horde)waves[0].push(mote(),mote());
    }
    rounds+=sector-1+R.rounds;
    // Cache carriers.
    const flat=waves.flat();
    if(type==='supply'){const free=flat.map((_,i)=>i);for(const tier of [2,1])for(let k=0;k<CACHE.supply[tier]&&free.length;k++)flat[free.splice(Math.floor(r()*free.length),1)[0]].cache=tier}
    else if((type==='survey'||type==='swarm')&&r()<CACHE.regularChance)flat[Math.floor(r()*flat.length)].cache=r()<CACHE.regularTier2?2:1;
    else if(type==='elite'){const w=flat.find(e=>e.elite);if(w)w.cache=2}
    else if(type==='boss'){const b=flat.find(e=>e.boss);if(b)b.cache=3}
    return {type,sector,waves,rounds,boss,affixes:s.brief.affixes.slice()};
  }

  // ---- Combat ------------------------------------------------------------
  function statsFor(member){
    const base=ROSTER[member.id],star=Math.max(1,Math.min(STARS.max,member.star||1)),hm=STARS.hp[star-1],am=STARS.atk[star-1];
    const out={hp:base.hp*hm,atk:base.atk*am,def:base.def*hm,spd:base.spd,crit:.05,barrier:0,care:0,energy:0,void:0,growth:0,order:0,decay:0,chaos:0};
    member.rigs.forEach(r=>SLOTS.forEach(k=>{const p=r[k];if(!p)return;const [m,mv]=MAIN[k];out[m]+=mv;(p.subs||[]).forEach(x=>out[x.stat]+=x.v)}));
    out.sets={};out.half={};
    member.rigs.forEach(rig=>Object.entries(setCounts(rig)).forEach(([id,n])=>{if(n>=SET_SIZE.half)out[SETS[id].two[0]]+=SETS[id].two[1];if(n>=SET_SIZE.full)out.sets[id]=true;else if(n>=SET_SIZE.half)out.half[id]=true}));
    return out;
  }

  function fight(s,opts={}){
    const node=opts.node||s.node,enc=encounter(s,node),r=rng(mix(s.seed,node,(opts.salt||0)+5151));
    const R=rulesFor(enc.affixes),dmgMult=R.crewDmg,basicMult=R.basic;let poolFrozenUntil=-1;
    const session={aetherModes:{},aetherOvercharge:{},aetherPriority:s.priority&&s.priority!=='auto'?s.priority:undefined};
    const crew=s.crew.map((m,i)=>{const st=statsFor(m);return {side:'crew',n:m.id,id:m.id,name:ROSTER[m.id].name,hp:st.hp,maxHp:st.hp,atk:st.atk,def:st.def,spd:st.spd,crit:st.crit,
      el:ROSTER[m.id].el,scales:ROSTER[m.id].scales,edmg:st[ROSTER[m.id].el]||0,bonusPower:0,bypass:0,
      star:m.star||1,tauntBase:ROSTER[m.id].taunt||1,reflect:ROSTER[m.id].reflect||0,containment:0,reflectBoost:1,
      // 5-piece set strengths: Fault Line shield damage, Long Rot poison, Riposte returned damage.
      shieldMul:st.sets.faultline?1.3:1,poisonMul:st.sets.longrot?1.25:1,returnMul:st.sets.riposte?1.3:1,followMul:1,
      // Lodestone: power from defense. Chorus buffs are counted in turns on each crewmate (chorusTurns).
      lodestone:st.sets.lodestone?st.def*EQUIP.lodestone:0,chorusTurns:0,
      care:1+st.care,barrier:st.barrier*R.barrierMul,sets:st.sets,half:st.half,alive:true,av:10000/st.spd,ult:0,refrains:0,taunt:0,tauntExpired:false,absorbed:false,roonieBasics:0,slot:i}});
    const metrics={bursts:0,burstCharges:[],peakBurst:0,chains:0,chainTurns:0,longestChain:0,ults:0,basics:0,skills:0,generated:0,wasted:0,converted:0,spent:0,debt:0,
      crewTurns:0,enemyTurns:0,healing:0,barrier:0,deaths:0,rounds:0,peaksPerCycle:0,aetherTrace:[],
      breaks:0,cracked:0,reformed:0,provoked:0,skipped:0,freezes:0,frozenAether:0,soaked:0,taken:0,mitigated:0,kills:0,enabled:0,refunds:0,carryDowns:0,carryLowest:1,saves:0,overheal:0,held:0,
      byKind:{},poison:0,reflected:0,followups:0,shatters:0,detonations:0};
    // Enablers: Hanae's Resonance (crew turns left in which basics gather +1) and Veska's Encores (next basics +1 each).
    let resonance=0,resonanceFresh=false,encore=0,resonanceGain=1;
    const power=powerOf;
    const events=[],drops=[];let enemies=[],wave=0,elapsed=0,turn=0;
    const scoringTotal=enc.waves.flat().filter(e=>e.scoring).reduce((a,e)=>a+e.maxHp,0);let removed=0;
    const living=()=>crew.filter(u=>u.alive),foes=()=>enemies.filter(e=>e.alive);
    function capacity(){const c=A.capacity(living())+living().filter(u=>u.id==='Ivara'&&u.star>=3).length+living().reduce((t,u)=>t+(u.sets.deephold?EQUIP.deepFull:0),0)+R.cap;return Math.max(1,c)}
    const pool=A.create(living());pool.max=capacity();
    pool.current=Math.min(pool.max,R.start);pool.converted=0;pool.debtTaken=0;const startCapacity=pool.max;
    const snap=()=>({crew:crew.map(u=>[u.hp,u.maxHp,Math.round(u.barrier),u.alive?1:0,u.ult]),enemies:enemies.map(e=>[e.name,Math.max(0,Math.round(e.hp)),e.maxHp,e.alive?1:0,e.marks||0,e.layers,e.broken?1:0,e.maxLayers,e.cache||0,e.poison||0])});
    function log(kind,actor,text,extra={}){events.push({kind,actor,text,pool:[pool.current,pool.max],t:Math.round(elapsed),...extra,snap:snap()})}
    const shieldUp=e=>Object.assign(e,{maxLayers:e.layers,shieldHp:e.layers>0?e.layerHp:0,broken:false,skips:0,reformAt:null});
    function spawn(){enemies=enc.waves[wave].map(e=>shieldUp({...e,side:'enemy',hp:e.maxHp,alive:true,av:10000/e.spd*(.6+r()*.4),attacks:0,marks:0}));log('wave',null,'Wave '+(wave+1)+' of '+enc.waves.length+': '+enemies.map(e=>e.name).join(', ')+'.');}
    function syncCap(){pool.max=capacity();pool.current=Math.min(pool.current,pool.max)}
    function mostHurt(){return living().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]}
    // Every generated charge goes through here so set hooks see the real counters.
    function credit(actor,amount){
      if(amount<=0)return 0;
      if(elapsed<poolFrozenUntil){metrics.frozenAether+=amount;return 0}
      const before=pool.wasted,got=A.credit(pool,amount),waste=pool.wasted-before;
      const per=actor&&(actor.sets.wellspring?EQUIP.wellFull:0);
      if(waste>0&&per){const t=mostHurt();if(t){pool.wasted-=waste;pool.converted+=waste;const b=per*waste*actor.care*R.barrierMul;t.barrier+=b;metrics.barrier+=b;
        log('set',actor.id,'Wellspring: '+waste+' surplus Aether becomes '+Math.round(b)+' barrier on '+t.name+'.')}}
      return got;
    }
    // Shield damage lands first (attack × shieldMult); the hit that Breaks a shield is not soaked; a shielded enemy
    // takes R.soak of health damage; a Broken one takes 35% more until it recovers (the affix lab's strike()).
    // Every kill goes through here (hits, poison ticks, returned damage), so caches, kill counts and the Brood's
    // broodlings behave the same whatever landed the blow. Long Rot (5 pieces) moves half the poison on.
    function killFoe(e,actor){
      e.alive=false;e.hp=0;metrics.kills++;
      if(e.cache){drops.push({tier:e.cache,from:e.name});log('cache',actor&&actor.id,e.name+' drops a '+CACHE.names[e.cache]+'.')}
      if(e.boss==='brood')enemies.forEach(x=>{if(!x.scoring&&x.alive){x.alive=false;x.hp=0}});
      const src=e.poisonSrc&&crew.find(u=>u.id===e.poisonSrc);
      if(e.poison>1&&src&&src.sets.longrot){const t=foes().sort((a,b)=>b.hp-a.hp)[0];if(t){const n=Math.floor(e.poison/2);t.poison=Math.min(EQUIP.maxPoison,(t.poison||0)+n);t.poisonPer=Math.max(t.poisonPer||0,e.poisonPer);t.poisonSrc=src.id;
        log('set',src.id,'Long Rot: '+n+' poison spreads to '+t.name+'.')}}
    }
    const add=(kind,v)=>{metrics.byKind[kind]=(metrics.byKind[kind]||0)+v};
    let lastHit=null,lastStruck=null,bypassBy=null; // the enemy the last skill or ultimate struck (for follow-ups); the last enemy anyone struck (Imke)
    // Damage straight to health, through shields (poison ticks, returned damage): no soak, no layers, no Break bonus.
    function directHit(actor,e,amount,kind){
      if(!e||!e.alive||amount<=0)return 0;if(actor&&actor.side==='crew')amount*=setAmp(actor,kind);const dealt=Math.min(e.hp,amount);e.hp-=amount;if(e.scoring)removed+=dealt;add(kind,dealt);
      if(e.hp<=0)killFoe(e,actor);return dealt;
    }
    function hitEnemy(actor,e,mult,shieldMult,kind='skill',opts={}){
      if(!e||!e.alive)return 0;
      if(kind==='skill'||kind==='ult')lastHit=e;lastStruck=e;
      let broke=false;
      if(e.layers>0&&!e.broken&&shieldMult>0){
        let left=power(actor)*shieldMult*(actor.shieldMul||1)*dmgMult;
        while(left>0&&e.layers>0){const take=Math.min(left,e.shieldHp);e.shieldHp-=take;left-=take;if(e.shieldHp<=0){e.layers--;e.shieldHp=e.layers>0?e.layerHp:0}}
        if(e.layers===0)broke=true;
      }
      // Family bonuses: Maul +40% on Broken enemies, Sevim standing +30% on Broken, Fault Line's mark +20%, Ekene's carry +30%.
      const vs=1+.1*Math.min(3,e.marks||0)+(e.broken?R.vuln+(actor.id==='Maul'?(actor.star>=3?.7:.4):0)+(alive('Sevim')?(alive('Sevim').star>=3?.45:.3):0):0)+(e.faulted?.2:0);
      const amp=(alive('Ekene')&&actor.id!=='Ekene'&&actor===carry()?(alive('Ekene').star>=3?1.5:1.3):1)*setAmp(actor,kind,opts);
      const crit=r()<actor.crit?1.5:1;let dmg=power(actor)*(1+(actor.edmg||0))*mult*crit*dmgMult*vs*amp;
      if(!opts.unsoaked&&!e.broken&&e.layers>0){metrics.soaked+=dmg*(1-R.soak);dmg*=R.soak}
      const dealt=Math.min(e.hp,dmg);e.hp-=dmg;if(e.scoring)removed+=dealt;add(kind,dealt);
      if(e.hp<=0)killFoe(e,actor);
      else if(broke)breakFoe(actor,e);
      return dmg;
    }
    function breakFoe(src,e){
      e.broken=true;e.av+=10000/e.spd*R.breakDelay*R.breakDelayMul;e.reformAt=R.reformAfter?elapsed+R.reformAfter:null;metrics.breaks++;
      log('break',src.id,src.name.split(' ')[0]+' broke '+e.name+"'s shield"+(R.breakDelayMul?' — it is delayed and takes 35% more damage.':'.'));
      if(R.frost)e.skips++;
      if(R.crack)foes().forEach(x=>{if(x!==e&&!x.broken&&x.layers>1){x.layers--;metrics.cracked++}});
      // Provoked counters wait until the action that caused the Break has finished (flushCounters), so the striker is
      // never downed halfway through their own skill or ultimate and then carries on hitting.
      if(R.provoke&&src.side==='crew')counters.push(e);
      if(src.sets&&src.sets.faultline)e.faulted=true;
      // Wren's Shatter: any Break, by anyone, earns a 150% hit (no shield damage, so it can't cascade).
      const w=alive('Wren');if(w&&e.alive){metrics.shatters++;hitEnemy(w,e,1.5,0,'shatter');if(w.star>=3&&e.alive){metrics.shatters++;hitEnemy(w,e,1.5,0,'shatter')}log('shatter','Wren','Shatter: Wren hits '+e.name+'.')}
    }
    const alive=id=>crew.find(u=>u.id===id&&u.alive)||null;
    // 5-piece damage perks: Relay on extra hits (and the next turn comes 5 AV sooner), Steady Hand over its crit threshold,
    // and Chorus while its buff lasts on the attacker.
    function setAmp(u,kind,opts={}){
      if(!u.sets)return 1;let m=1;
      if(u.sets.relay&&(kind==='follow'||kind==='shatter'||kind==='reflect'||opts.extra)){m*=1.25;u.av=Math.max(0,u.av-5)}
      if(u.sets.steadyhand&&u.crit>=EQUIP.steadyAt&&(kind==='skill'||kind==='ult'))m*=1+EQUIP.steadyBonus;
      if(u.chorusTurns>0&&kind!=='poison')m*=1+EQUIP.chorus;
      return m;
    }
    // Poison (the affix lab's rule): stacks up to maxPoison; per-stack damage is the strongest applier's; the last applier
    // gets the credit. It ticks at the start of the poisoned enemy's own turn, through shields, and drops by 1.
    function poisonFoe(src,e,stacks){if(!e||!e.alive)return;e.poison=Math.min(EQUIP.maxPoison,(e.poison||0)+stacks);
      e.poisonPer=Math.max(e.poisonPer||0,power(src)*EQUIP.poisonPerPower*src.poisonMul);e.poisonSrc=src.id}
    const mostPoisoned=()=>foes().filter(e=>e.poison>0).sort((a,b)=>b.poison*b.poisonPer-a.poison*a.poisonPer)[0];
    // Dolores: the target's poison lands at once, through shields; Break vulnerability and marks apply (it's a strike).
    function detonate(u,e,mult,kind){const amount=e.poison*e.poisonPer*mult;e.poison=0;metrics.detonations++;return hitEnemy(u,e,amount/Math.max(1,power(u)*(1+u.edmg)*dmgMult),0,kind,{unsoaked:true})}
    // Follow-ups: Imke answers another crewmate's skill or ultimate once per action; Idris adds to every follow-up.
    // Follow-ups never set off follow-ups, and neither they nor returned damage make Aether.
    function afterAction(u){
      const t=lastHit;lastHit=null;if(!t||!t.alive)return;
      const imke=alive('Imke');if(imke&&u!==imke){follow(imke,t,.8);if(imke.star>=3){const t2=t.alive?t:pickLow();if(t2)follow(imke,t2,.8)}}
    }
    function follow(f,t,mult){
      if(!t.alive)return;metrics.followups++;hitEnemy(f,t,mult,.3,'follow');log('follow',f.id,f.name.split(' ')[0]+' follows up on '+t.name+'.');
      const idris=alive('Idris');if(idris&&idris!==f&&t.alive)hitEnemy(idris,t,idris.star>=3?.8:.5,.2,'follow');
    }
    function reformDue(){for(const e of foes())if(e.broken&&e.reformAt!==null&&elapsed>=e.reformAt){e.broken=false;e.faulted=false;e.layers=e.maxLayers;e.shieldHp=e.layerHp;e.reformAt=null;metrics.reformed++;log('enemy',null,e.name+"'s shields snap back.")}}
    const counters=[];
    function flushCounters(){
      while(counters.length){const e=counters.shift();if(!e.alive)continue;const t=crewTarget();if(!t)continue;metrics.provoked++;const counterAlive=e.alive,raw=hitCrew(e,t,1);log('enemy',null,e.name+' strikes back at '+t.name+' for '+Math.round(raw)+'.',{counterAlive})}
    }
    function crewTarget(){const targets=living();if(!targets.length)return null;
      const weights=targets.map(weightOf),sum=weights.reduce((a,b)=>a+b,0);let pick=r()*sum;
      for(let i=0;i<targets.length;i++){pick-=weights[i];if(pick<=0)return targets[i]}return targets[0]}
    // How likely a crewmate is to be attacked: Daven's old weights, and for the Hull crew their taunt, doubled while drawing attacks.
    function weightOf(u){return u.id==='Daven'?(u.taunt>0?6:2):(u.tauntBase||1)*(u.taunt>0?2:1)}
    function addBarrier(t,amount){const b=amount*R.barrierMul;t.barrier+=b;metrics.barrier+=b;return b}
    function hitCrew(e,u,mult){
      const raw=e.atk*mult*R.enemyAtk,cut=raw*u.def/(u.def+EQUIP.defK);let left=raw-cut;metrics.mitigated+=cut;metrics.taken+=left;
      const landed=left;let absorbed=0;
      if(u.barrier>0){const a=Math.min(u.barrier,left);u.barrier-=a;left-=a;absorbed=a;
        if(u.id==='Daven'&&a>0&&!u.absorbed){u.absorbed=true;const got=credit(u,1);log('aether','Daven','Recovered load: absorbed hit returns '+got+' Aether.')}}
      u.hp-=left;u.ult=Math.min(100,u.ult+8*R.chargeMul);
      const ojo=alive('Ojo');if(ojo)ojo.containment=Math.min(ojo.star>=3?8:5,ojo.containment+1);
      // Returned damage (kind 'reflect'): Reva returns 60% of what reaches her, Tarn everything his barrier absorbs. Through shields.
      // Reva returns a share of the attack's full strength (before her defense), so getting sturdier never shrinks her returns.
      const back=(u.reflect?raw*(u.id==='Reva'&&u.star>=3?1:u.reflect)*u.reflectBoost:0)+(u.id==='Tarn'?absorbed:0);
      if(back>0&&e.alive&&u.hp>0){const d=directHit(u,e,back*u.returnMul,'reflect');metrics.reflected+=d;
        // Reva is volatile: what she returns also splashes 40% onto every other enemy.
        if(u.id==='Reva')foes().forEach(x=>{if(x!==e)metrics.reflected+=directHit(u,x,back*u.returnMul*.4,'reflect')});
        if(d>0&&u.sets.riposte){const h=Math.min(u.maxHp-u.hp,d*.3);u.hp+=h;metrics.healing+=h}}
      if(u===carry()){metrics.carryLowest=Math.min(metrics.carryLowest,Math.max(0,u.hp)/u.maxHp);if(u.hp<=0)metrics.carryDowns++}
      if(u.hp<=0){u.hp=0;u.alive=false;metrics.deaths++;log('down',u.id,u.name+' is down.'+(u.id==='Ivara'?' Capacity falls.':''));syncCap()}
      return raw;
    }
    const pickHigh=()=>foes().sort((a,b)=>b.hp-a.hp)[0],pickLow=()=>foes().sort((a,b)=>a.hp-b.hp)[0];
    const owner=()=>living().find(u=>u.n===session.aetherPriority)||living().find(u=>u.id==='Arunima')||living().find(u=>u.id==='Silen')||null;
    const refrainCap=u=>(u.sets.metronome?4:3)+(u.star>=3?1:0);
    function heal(actor,amount){living().forEach(u=>{const want=amount*actor.care*R.healMul,h=Math.min(u.maxHp-u.hp,want);u.hp+=h;metrics.healing+=h;metrics.overheal+=want-h})}
    const borrowCap=u=>u.sets.overdraw?EQUIP.overFull:0;
    const room=u=>borrowCap(u)?Math.max(0,borrowCap(u)+Math.min(0,pool.current)):0;
    function view(u){
      if(!borrowCap(u))return pool;
      const extra=room(u);
      return Object.assign({},pool,{current:pool.current+extra,max:pool.max+extra});
    }
    // ---- Sustain AI: forecast the damage each crewmate can take before the healer's next turn, and protect the carry.
    // The carry is the priority spender (or failing that the strongest attacker): losing them usually loses the fight.
    function carry(){return owner()||living().filter(x=>x.scales==='atk').sort((a,b)=>power(b)-power(a))[0]||null}
    function enemyHit(e,u){const heavy=e.boss==='carapace'&&(e.attacks+1)%3===0?1.8:1,raw=e.atk*heavy*R.enemyAtk;return raw-raw*u.def/(u.def+EQUIP.defK)}
    // Enemy actions before `horizon` AV from now: an enemy acts once at e.av, then every 10000/spd. Broken or frozen ones are skipped.
    function actsWithin(e,horizon){if(e.av>horizon)return 0;if(e.broken&&e.skips>0)return Math.max(0,Math.floor((horizon-e.av)/(10000/e.spd)));return 1+Math.floor((horizon-e.av)/(10000/e.spd))}
    function threat(u,horizon){
      const targets=living(),weights=targets.map(weightOf),sum=weights.reduce((a,b)=>a+b,0),share=weights[targets.indexOf(u)]/sum;
      const hits=[];foes().forEach(e=>{const n=actsWithin(e,horizon);for(let i=0;i<n;i++)hits.push(enemyHit(e,u))});
      hits.sort((a,b)=>b-a);const expected=hits.reduce((a,b)=>a+b,0)*share,worst=hits.slice(0,2).reduce((a,b)=>a+b,0);
      return {expected:Math.max(0,expected-u.barrier),worst:Math.max(0,worst-u.barrier)};
    }
    // danger(u): 'lethal' if the two biggest coming hits could down them, 'low' if the expected damage leaves them under 40%.
    function danger(u,horizon){const t=threat(u,horizon);if(u.hp-t.worst<=0)return 'lethal';if((u.hp-t.expected)/u.maxHp<.4)return 'low';return null}
    function atRisk(horizon){return living().map(u=>({u,d:danger(u,horizon)})).filter(x=>x.d)}
    function sustainCall(u){
      const horizon=10000/u.spd,risk=atRisk(horizon),c=carry(),carryRisk=c&&risk.find(x=>x.u===c);
      const lethal=risk.filter(x=>x.d==='lethal'),missing=living().reduce((t,x)=>t+(x.maxHp-x.hp),0);
      if(carryRisk)return {act:true,why:(carryRisk.d==='lethal'?'saving ':'protecting ')+c.name.split(' ')[0]+' (the carry)',save:carryRisk.d==='lethal',urgent:true};
      if(lethal.length)return {act:true,why:'saving '+lethal[0].u.name.split(' ')[0],save:true,urgent:true};
      if(u.id==='Veska'){const heal=u.maxHp*(.11+.055*u.refrains)*u.care*R.healMul;
        if(u.refrains>=refrainCap(u)&&missing>0)return {act:true,why:'Refrains full'};
        if(missing>=heal*living().length*.7)return {act:true,why:'the crew is worn down'};
        return {act:false,why:'holding One More Verse ('+u.refrains+'/'+refrainCap(u)+' Refrains, no one in danger)'}}
      if(ROSTER[u.id].family==='hull')return {act:true,why:u.taunt<=0?'drawing fire':''};
      if(u.id==='Daven')return u.taunt<=0&&foes().length?{act:true,why:'drawing fire'}:{act:false,why:'still drawing fire'};
      return {act:true,why:''};
    }
    function useful(u){
      if(!foes().length)return false;
      if(u.id==='Veska'||u.id==='Daven'||ROSTER[u.id].guard)return sustainCall(u).act;
      if(u.id==='Ekene'){const c=carry();return !!(c&&c!==u)}
      if(u.id==='Roonie'){const o=bypassTarget(u);return !!(o&&o.bypass<=0)}
      if(u.id==='Hanae')return resonance===0;
      return true;
    }
    // Roonie bypasses the priority spender, or failing that the crewmate with the most power.
    function bypassTarget(u){const o=owner();if(o&&o!==u)return o;return living().filter(x=>x!==u).sort((a,b)=>power(b)-power(a))[0]||null}
    function burstLimit(u){
      // Smallest burst that clears every visible specimen, as the live planner does.
      const need=Math.max(...foes().map(e=>e.hp/(e.broken||!e.layers?1:R.soak)/(power(u)*(1+u.edmg)*dmgMult*(1+.1*Math.min(3,e.marks||0)))));
      return Math.max(3,Math.ceil(need));
    }
    function pay(u,cost){const before=pool.current;pool.current-=cost;pool.spent+=cost;pool.skills++;
      // Spending Aether can freeze: 1 − 0.88^cost to freeze; the next spend after a freeze is safe.
      if(R.frost&&cost>0){if(u.thawGuard)u.thawGuard=false;else if(r()<1-Math.pow(.88,cost)){u.thawGuard=true;u.av+=60;poolFrozenUntil=Math.max(poolFrozenUntil,elapsed+60);metrics.freezes++;
        log('set',u.id,u.name.split(' ')[0]+' froze after spending '+cost+' Aether; the pool freezes.')}}
      const debt=Math.max(0,cost-Math.max(0,before));if(debt>0){pool.debtTaken+=debt;log('set',u.id,'Overdraw: spent '+debt+' Aether the pool did not have.')}
      if(u.bypass>0&&cost>0&&r()<(bypassBy&&bypassBy.star>=3?.75:.5)){const got=credit(u,1);if(got){metrics.refunds+=got;log('aether',u.id,'Bypass: '+u.name.split(' ')[0]+' gets 1 Aether back.')}}}
    function fireUlts(){
      for(const u of living()){
        if(!u.alive||u.ult<100||!foes().length)continue;
        const hurt=living().some(x=>x.hp<x.maxHp*.6),risk=atRisk(10000/u.spd),c=carry();
        // Veska holds her heal for danger: anyone at lethal risk, the carry at risk, or two crew under 55%. Daven's barrier
        // prevents damage, so it goes up whenever enemies will act before his next turn.
        if(['Veska','Spore'].includes(u.id)&&!(risk.some(x=>x.d==='lethal')||risk.some(x=>x.u===c)||living().filter(x=>x.hp<x.maxHp*.55).length>=2)){metrics.held++;continue}
        if(['Daven','Tarn'].includes(u.id)&&!foes().some(e=>actsWithin(e,10000/u.spd)>0)){metrics.held++;continue}
        if(u.id==='Roonie'&&!hurt&&!(pool.current<pool.max/2))continue;
        if(['Veska','Daven'].includes(u.id)&&risk.some(x=>x.d==='lethal'))metrics.saves++;
        u.ult=0;metrics.ults++;
        if(u.id==='Hanae'){foes().forEach(e=>{hitEnemy(u,e,3,1,'ult');e.marks=Math.min(3,(e.marks||0)+2)});const g=credit(u,4);log('ult',u.id,'Every Seam Sings: 300% to all, +'+g+' Aether.')}
        if(u.id==='Ivara'){const t=pickHigh();hitEnemy(u,t,6,1,'ult');log('ult',u.id,'The Returning Signal: 600% to '+t.name+'.')}
        if(u.id==='Arunima'){foes().forEach(e=>hitEnemy(u,e,5,1.5,'ult'));log('ult',u.id,'No Distance Remains: 500% to every specimen.')}
        if(u.id==='Roonie'){heal(u,u.maxHp*.13);living().forEach(x=>{if(x!==u)x.ult=Math.min(100,x.ult+25)});const g=credit(u,6);log('ult',u.id,'All Circuits Clear: heal, ultimate charge, +'+g+' Aether.')}
        if(u.id==='Veska'){heal(u,u.maxHp*.34);log('ult',u.id,'The Room Sings Back: '+Math.round(u.maxHp*.34)+' healing to everyone.')}
        if(u.id==='Daven'){const b=u.def*1.25*u.care;living().forEach(x=>addBarrier(x,b));log('ult',u.id,'Everyone Behind Me: '+Math.round(b)+' barrier to all.')}
        if(u.id==='Silen'){const t=pickHigh();hitEnemy(u,t,5,1,'ult');log('ult',u.id,'Pressure Release: 500% to '+t.name+'.')}
        if(u.id==='Wren'){const t=pickHigh();if(t.layers>0&&!t.broken){t.layers=0;t.shieldHp=0;breakFoe(u,t)}hitEnemy(u,t,3,0,'ult');log('ult',u.id,'Fault Lines: 300% and every shield layer stripped from '+t.name+'.')}
        if(u.id==='Maul'){const b=foes().filter(e=>e.broken),ts=b.length?b:[pickHigh()];ts.forEach(e=>hitEnemy(u,e,3,1,'ult'));log('ult',u.id,'Settle the Load: 300% to '+(b.length?'every Broken enemy':ts[0].name)+'.')}
        if(u.id==='Sevim'){foes().forEach(e=>hitEnemy(u,e,2,3,'ult'));log('ult',u.id,'Full Assay: 200% to every enemy, triple shield damage.')}
        if(u.id==='Stella'){foes().forEach(e=>{hitEnemy(u,e,1.5,.5,'ult');poisonFoe(u,e,3)});log('ult',u.id,'Reagent Storm: 150% and 3 poison on every enemy.')}
        if(u.id==='Dolores'){foes().forEach(e=>poisonFoe(u,e,3));const t=mostPoisoned();if(t)detonate(u,t,u.star>=3?2.6:2,'ult');log('ult',u.id,'Chain Reaction: 3 poison on every enemy'+(t?', '+t.name+' detonated twice over':'')+'.')}
        if(u.id==='Spore'){foes().forEach(e=>poisonFoe(u,e,3));heal(u,u.maxHp*.15);log('ult',u.id,'Bloom Season: 3 poison on every enemy, healing everyone.')}
        if(u.id==='Reva'){const t=pickHigh();hitEnemy(u,t,2.4,1,'ult');u.reflectBoost=2;log('ult',u.id,'Counterweight: 240% to '+t.name+'; retaliation doubled until her next turn.')}
        if(u.id==='Tarn'){addBarrier(u,u.def*1.6*u.care);living().forEach(x=>{if(x!==u)addBarrier(x,u.def*.6*u.care)});log('ult',u.id,'Hold the Route: a heavy barrier on Tarn and barriers for everyone.')}
        if(u.id==='Ojo'){const c=u.containment;foes().forEach(e=>hitEnemy(u,e,1.2+.3*c,1,'ult'));u.containment=0;log('ult',u.id,'Full Containment: '+Math.round((1.2+.3*c)*100)+'% to every enemy.')}
        if(u.id==='Imke'){const t=pickHigh();hitEnemy(u,t,3.2,1,'ult');t.marks=Math.min(3,(t.marks||0)+2);log('ult',u.id,'Fox Fire: 320% and two marks on '+t.name+'.')}
        if(u.id==='Idris'){foes().forEach(e=>hitEnemy(u,e,2,1,'ult'));log('ult',u.id,'Full Survey: 200% to every enemy.')}
        if(u.id==='Ekene'){heal(u,u.maxHp*.16);living().forEach(x=>{if(x!==u)x.ult=Math.min(100,x.ult+45)});log('ult',u.id,'Shared Current: healing and 45 ultimate charge for everyone.')}
        if(u.sets.chorus){living().forEach(x=>x.chorusTurns=2);log('set',u.id,'Chorus: the crew deals 15% more for 2 turns.')}
        afterAction(u);flushCounters();
      }
    }
    function crewTurn(u){
      turn++;metrics.crewTurns++;u.ult=Math.min(100,u.ult+20*R.chargeMul);
      if(u.id==='Daven'){u.absorbed=false;u.tauntExpired=u.taunt===1;u.taunt=Math.max(0,u.taunt-1)}
      else if(ROSTER[u.id].guard){u.taunt=Math.max(0,u.taunt-1);u.reflectBoost=1}
      fireUlts();if(!u.alive||!foes().length)return; // a provoked counter to an ultimate can down the actor
      const only=foes().length===1?foes()[0]:null;
      // The reserve for the priority spender: their lab cost plus any burst/overcharge headroom (A.budget uses live costs).
      const own=A.priority(living(),session,useful),ownBudget=own&&A.budget(view(u),own,session);
      const plan=A.teamPlan(view(u),u,{crew:living(),session,useful,turn,canWait:true,cost:ROSTER[u.id].cost,skillGain:0,
        ownerBudget:own&&own.n!==u.id?Math.min(ownBudget,ROSTER[own.n].cost+Math.max(0,ownBudget-A.skillCost(own))):undefined,
        emergency:(u.id==='Veska'||u.id==='Daven'||ROSTER[u.id].guard||ROSTER[u.id].heal)&&!!sustainCall(u).urgent,
        setup:(u.id==='Roonie'&&!!(bypassTarget(u)&&bypassTarget(u).bypass<=0))||(u.id==='Hanae'&&resonance===0),
        basicEnough:!!(only&&['Arunima','Ivara','Silen'].includes(u.id)&&only.hp<=power(u)*1.25*dmgMult),
        spendLimit:u.id==='Arunima'?burstLimit(u):undefined});
      A.recordAction(pool,u,plan,turn,living().length);
      if(plan.kind==='skill'&&pool.current+room(u)<plan.cost)plan.kind='basic';
      if(['Veska','Daven'].includes(u.id)||ROSTER[u.id].guard||ROSTER[u.id].heal){const call=sustainCall(u);if(plan.kind==='skill'&&call.save)metrics.saves++;if(call.why)plan.reason=call.why}
      if(plan.kind!=='skill')basic(u,plan);
      else{metrics.skills++;skill(u,plan)}
      flushCounters();
    }
    // After each crew turn: Resonance counts down (not on the turn Hanae opens it), and Bypass counts the holder's turns.
    function endTurn(u){
      if(resonanceFresh)resonanceFresh=false;else if(resonance>0)resonance--;
      if(u.bypass>0&&--u.bypass===0){u.bonusPower=0;log('aether',u.id,'Bypass ends for '+u.name.split(' ')[0]+'.')}
      if(u.chorusTurns>0)u.chorusTurns--;
    }
    function skill(u,plan){
      if(u.id==='Arunima'){
        const charges=plan.cost;pay(u,charges);const counted=charges+(plan.discount||0),mult=counted*(u.star>=3?1.2:1);u.weaverDiscount=false;
        foes().forEach(e=>hitEnemy(u,e,mult,1+.25*mult));metrics.bursts++;metrics.burstCharges.push(counted);metrics.peakBurst=Math.max(metrics.peakBurst,counted);
        log('burst',u.id,'Proof by Transit: '+charges+' Aether → '+Math.round(mult*100)+'% to every specimen.',{charges:counted});afterAction(u);return;}
      if(u.id==='Silen'){
        const open=Math.max(1,2-(u.weaverDiscount?1:0));pay(u,open);u.weaverDiscount=false;let t=pickHigh(),hits=1;hitEnemy(u,t,2,.6);
        let text='Rising Current: 200%';const floor=plan.reserve||0;
        for(let i=1;foes().length;i++){
          if(!t.alive)t=pickHigh();
          const cost=u.star>=3?Math.max(1,Math.ceil((i-1)/2)):chainCost(i);
          if(pool.current+room(u)-floor<cost)break;
          pay(u,cost);hitEnemy(u,t,A.chainMultiplier(i),.6,'skill',{extra:true});hits++;text+=' → '+Math.round(A.chainMultiplier(i)*100)+'%';
        }
        metrics.chains++;metrics.chainTurns+=hits;metrics.longestChain=Math.max(metrics.longestChain,hits);metrics.peakBurst=Math.max(metrics.peakBurst,hits);
        log('chain',u.id,text+' ('+hits+' turns).',{turns:hits});afterAction(u);return;}
      pay(u,plan.cost);u.weaverDiscount=false;
      if(u.id==='Hanae'){const t=pickHigh();hitEnemy(u,t,2,1);t.marks=Math.min(3,(t.marks||0)+1);resonance=u.sets.metronome?4:3;resonanceFresh=true;resonanceGain=u.star>=3?2:1;
        log('skill',u.id,'Pass the Chord: 200% and a mark on '+t.name+'; Resonance — basics gather +1 for 3 crew turns.');}
      else if(u.id==='Ivara'){const t=pickHigh();hitEnemy(u,t,3,1.5);t.marks=Math.min(3,(t.marks||0)+1);log('skill',u.id,'Echo Lance: 300% to '+t.name+'.')}
      else if(u.id==='Roonie'){const o=bypassTarget(u);if(o){bypassBy=u;o.bypass=u.sets.metronome?3:2;o.bonusPower=u.maxHp*EQUIP.bypassPower*u.care}
        log('skill',u.id,'Borrow My Bypass'+(o?': '+o.name.split(' ')[0]+' gains '+Math.round(o.bonusPower)+' attack and a 50% Aether refund on spends for 2 turns':'')+'.');}
      else if(u.id==='Veska'){const R=u.refrains,beat=u.sets.metronome&&R===refrainCap(u)?EQUIP.beat:1;heal(u,u.maxHp*(.11+.055*R)*beat);encore+=R;u.refrains=0;
        log('skill',u.id,'One More Verse: '+R+' Refrains'+(beat>1?' on the beat (+50%)':'')+', healing everyone; the next '+R+' crew basics gather +1.');}
      else if(u.id==='Wren'){const t=breakTarget();hitEnemy(u,t,2.2,3);log('skill',u.id,'Load Path: 220% to '+t.name+', triple shield damage.')}
      else if(u.id==='Maul'){const t=foes().find(e=>e.broken)||pickHigh();hitEnemy(u,t,2.2,1);if(t.alive&&t.broken)t.av+=20;log('skill',u.id,'Test Blow: 220% to '+t.name+(t.broken?', its recovery pushed back':'')+'.')}
      else if(u.id==='Sevim'){foes().forEach(e=>hitEnemy(u,e,1.1,2));log('skill',u.id,'Measured Cooling: 110% to every enemy, heavy shield damage.')}
      else if(u.id==='Stella'){foes().forEach(e=>{hitEnemy(u,e,.7,.3);poisonFoe(u,e,u.star>=3?3:2)});log('skill',u.id,'Reagent Mist: 70% and 2 poison on every enemy.')}
      else if(u.id==='Dolores'){const t=mostPoisoned();if(t){const d=detonate(u,t,u.star>=3?3:2.2,'skill');log('skill',u.id,'Hyphal Charge: '+t.name+' detonates for '+Math.round(d)+'.')}
        else{const p=pickHigh();hitEnemy(u,p,1.5,.5);poisonFoe(u,p,2);log('skill',u.id,'Hyphal Charge: nothing to detonate — 150% and 2 poison on '+p.name+'.')}}
      else if(u.id==='Spore'){foes().forEach(e=>poisonFoe(u,e,3));const h=mostHurt();if(h)healOne(u,h,u.maxHp*.15);if(u.star>=3)heal(u,u.maxHp*.08);log('skill',u.id,'Culture Thread: 3 poison on every enemy'+(h?', healing '+h.name.split(' ')[0]:'')+'.')}
      else if(u.id==='Reva'){addBarrier(u,u.maxHp*.3*u.care);u.taunt=u.sets.metronome?2:1;const t=pickHigh();hitEnemy(u,t,2.2,1);log('skill',u.id,'Shell Rush: a barrier, 220% to '+t.name+', drawing attacks.')}
      else if(u.id==='Tarn'){const t=pickHigh();hitEnemy(u,t,1.8,1);foes().forEach(e=>{if(e!==t)hitEnemy(u,e,.7,.5)});addBarrier(u,u.def*(u.star>=3?1.5:1.1)*u.care);u.taunt=u.sets.metronome?2:1;log('skill',u.id,'Anchor Strike: 180% to '+t.name+' and 70% to the rest, '+Math.round(u.def*1.1*u.care)+' barrier, drawing attacks.')}
      else if(u.id==='Ojo'){const c=u.containment,t=pickHigh();hitEnemy(u,t,1+.6*c,1);if(c>=3)foes().forEach(e=>{if(e!==t)hitEnemy(u,e,.5,.5)});u.containment=0;addBarrier(u,u.maxHp*.15*u.care);u.taunt=u.sets.metronome?2:1;
        log('skill',u.id,'Set Weight: '+Math.round((1+.6*c)*100)+'% to '+t.name+' ('+c+' Containment), a barrier, drawing attacks.')}
      else if(u.id==='Imke'){const t=(lastStruck&&lastStruck.alive)?lastStruck:pickHigh();hitEnemy(u,t,2,1);u.av=Math.max(0,u.av-25);log('skill',u.id,'Nettle Shot: 200% to '+t.name+'; Imke acts sooner.')}
      else if(u.id==='Idris'){foes().forEach(e=>hitEnemy(u,e,.9,1));log('skill',u.id,'Mote Sweep: 90% to every enemy.')}
      else if(u.id==='Ekene'){const c=carry();if(c&&c!==u){c.ult=Math.min(100,c.ult+35);c.av=Math.max(0,c.av-30)}log('skill',u.id,'Distribution Pulse'+(c&&c!==u?': '+c.name.split(' ')[0]+' gains 35 ultimate charge and acts sooner':'')+'.')}
      else if(u.id==='Daven'){const t=pickHigh();hitEnemy(u,t,2.25,1);const beat=u.sets.metronome&&u.tauntExpired?EQUIP.beat:1;addBarrier(u,u.def*u.care*beat);
        u.taunt=(u.sets.metronome?2:1)+(u.star>=3?1:0);log('skill',u.id,'Hold the Line: 225%, '+Math.round(u.def*u.care*beat)+' barrier'+(beat>1?' on the beat':'')+', drawing attacks.');}
      afterAction(u);
    }
    // Break targets: the shielded enemy closest to Breaking.
    function breakTarget(){const sh=foes().filter(e=>!e.broken&&e.layers>0);return sh.sort((a,b)=>a.layers-b.layers||a.shieldHp-b.shieldHp)[0]||pickHigh()}
    function healOne(actor,u,amount){const want=amount*actor.care*R.healMul,h=Math.min(u.maxHp-u.hp,want);u.hp+=h;metrics.healing+=h;metrics.overheal+=want-h}
    function basic(u,plan){
      metrics.basics++;const t=u.id==='Maul'?(foes().find(e=>e.broken)||pickLow()):['Wren','Sevim'].includes(u.id)?breakTarget():['Ivara','Silen'].includes(u.id)?pickHigh():pickLow(),deep=u.sets.deephold&&pool.current>=pool.max?EQUIP.deepBasic:1;
      if(u.id==='Idris')foes().forEach(e=>hitEnemy(u,e,.6*basicMult*deep,.4,'basic'));
      else hitEnemy(u,t,1.25*basicMult*deep,{Wren:1.5,Sevim:1.5}[u.id]||.75,'basic');lastStruck=t;
      if(['Stella','Dolores','Spore'].includes(u.id))poisonFoe(u,t,1);
      if(u.id==='Tarn')addBarrier(u,u.def*.25*u.care);const boost=(resonance>0?resonanceGain:0)+(encore>0?1:0);if(encore>0)encore--;let gain=(u.id==='Hanae'?2:1)+boost;pool.basics++;const g=credit(u,gain);metrics.enabled+=Math.min(g,boost);
      if(u.id==='Arunima')t.marks=Math.min(3,(t.marks||0)+1);
      if(u.id==='Veska')u.refrains=Math.min(refrainCap(u),u.refrains+1);
      if(u.id==='Daven')addBarrier(u,u.def*.19*u.care);
      if(u.id==='Roonie'){u.roonieBasics++;const o=owner();if(u.roonieBasics%2===0&&o&&o!==u)o.weaverDiscount=true}
      log('basic',u.id,(u.name.split(' ')[0])+' basic'+(deep>1?' (Deep Hold, full pool)':'')+': +'+g+' Aether'+(plan&&plan.reason?' · '+plan.reason:'')+'.');
    }
    function enemyTurn(e){
      metrics.enemyTurns++;const targets=living();if(!targets.length)return;
      if(e.poison>0){const src=crew.find(u=>u.id===e.poisonSrc),amount=e.poison*e.poisonPer;
        log('poison',src&&src.id,e.name+' takes '+Math.round(Math.min(e.hp,amount))+' poison ('+e.poison+' stacks).');
        metrics.poison+=directHit(src,e,amount,'poison');e.poison=e.poison-1;if(!e.alive)return}
      if(e.broken&&e.skips>0){e.skips--;metrics.skipped++;log('enemy',null,e.name+' is frozen and misses its turn.');return}
      if(e.broken){e.broken=false;e.faulted=false;e.layers=e.maxLayers;e.shieldHp=e.layerHp;e.reformAt=null;log('enemy',null,e.name+' recovers its shields.')}
      if(e.boss==='brood'&&enemies.filter(x=>x.alive&&!x.scoring).length<4){
        enemies.push(shieldUp({name:'Broodling',maxHp:Math.round(28*SCALE.hp[enc.sector-1]),hp:Math.round(28*SCALE.hp[enc.sector-1]),atk:6*SCALE.atk[enc.sector-1],spd:100,scoring:false,side:'enemy',alive:true,av:10000/100,attacks:0,marks:0,layers:1,layerHp:10}));
        log('enemy',null,'The Brood summons a Broodling.')}
      const t=crewTarget();
      e.attacks++;const heavy=e.boss==='carapace'&&e.attacks%3===0?1.8:1;const raw=hitCrew(e,t,heavy);
      log('enemy',null,e.name+(heavy>1?' heavy strike':' attacks')+' '+t.name+' for '+Math.round(raw)+'.');
    }
    spawn();
    const limit=enc.rounds*100;let outcome='time';
    for(let guard=0;guard<4000;guard++){
      if(!living().length){outcome='wiped';break}
      if(!foes().some(e=>e.scoring)){
        if(wave<enc.waves.length-1){wave++;spawn();continue}
        outcome='cleared';break;
      }
      const all=[...living(),...foes()],next=all.reduce((a,b)=>a.av<=b.av?a:b);
      const step=next.av;if(elapsed+step>limit){elapsed=limit;outcome='time';break}
      elapsed+=step;all.forEach(x=>x.av-=step);reformDue();next.av=10000/next.spd;
      if(next.side==='crew'){crewTurn(next);endTurn(next)}else enemyTurn(next);
      metrics.aetherTrace.push(pool.current);
    }
    const score=outcome==='cleared'?1:Math.min(.999,removed/scoringTotal);
    metrics.rounds=Math.round(elapsed/10)/10;
    metrics.generated=pool.generated;metrics.wasted=pool.wasted;metrics.converted=pool.converted;metrics.spent=pool.spent;metrics.debt=pool.debtTaken;
    metrics.peaksPerCycle=metrics.bursts?(metrics.bursts+metrics.chains)/metrics.bursts:metrics.chains?1:0;
    log('end',null,(outcome==='cleared'?'All specimens recovered.':outcome==='wiped'?'The crew is down.':'Extraction deadline reached.')+' Recovery '+Math.round(score*100)+'%.');
    const reports=enc.affixes.map(id=>({id,name:AFFIXES[id].name,text:AFFIXES[id].report(metrics)}));
    return {node,reports,encounter:{type:enc.type,sector:enc.sector,rounds:enc.rounds,boss:enc.boss,affixes:enc.affixes},
      crewOrder:crew.map(u=>u.id),capacity:startCapacity,endCapacity:pool.max,score,outcome,metrics,events,drops};
  }

  const api={STARS,insightPrice,FAMILIES,AETHER_SETS,FAMILY_SETS,setFit,CACHE,rollCache,describeCache,SCALING,ELEMENTS,powerOf,TIER_ODDS,rollTier,tierOf,AFFIXES,AFFIX_IDS,CAPS,legalStack,conflicts,rollBrief,rulesFor,SCALE,EQUIP,STATS,STAT_IDS,MAIN,SET_SIZE,PACK_KINDS,makePiece,openPack,compareFor,bestUse,rigValue,quality,fmtStat,rng,ROSTER,IDS,SETS,SET_IDS,SLOTS,SLOT_NAMES,PIECES,BOSSES,ROUTE,NODE_NAMES,ECON,BANDS,
    create,act,fight,encounter,dropOffers,voucherPrice,releaseRefund,capacityPreview,budgetWords,completedSets,setProgress,pieceAdvances,setOn,sectorOf,nodeType,band,pieceStat,statsFor,clone};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.WeaverVoyage=api;
})(typeof window!=='undefined'?window:globalThis);
