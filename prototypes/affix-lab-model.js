(function(root){
  'use strict';
  // Affix team-building lab: the Brief, open requisition, a random equipment supply and a seeded combat model.
  // Shared by prototypes/affix-lab.html and sim/affix-lab.js. These are lab kits, not live combat parity;
  // see docs/design/affix-team-building.md. Aether costs, capacity and spending decisions come from aether-rules.js.
  const A=root.SpacologyAether||(typeof module!=='undefined'&&module.exports?require('./aether-rules.js'):null);

  // ---- Random numbers -------------------------------------------------------------------------------------------
  function hash(...parts){
    const s=parts.join('|');let h=2166136261>>>0;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    return h>>>0;
  }
  function rng(seed){
    let a=(seed>>>0)||1;
    return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  }
  function plural(n,one,many){return `${n} ${n===1?one:(many||one+'s')}`;}
  function shuffled(list,rand){const out=list.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}

  // ---- Tuning ---------------------------------------------------------------------------------------------------
  const T={
    round:100, normalRounds:10, bossRounds:14,
    soak:.4,              // a shielded enemy takes 40% of health damage (the live SOAK)
    vuln:.35,             // a broken enemy takes 35% more until it recovers
    breakDelay:.35,       // share of its turn a Break costs the enemy
    markBonus:.08, maxMarks:3,
    poisonPerAtk:.4, maxPoison:15,
    energy:{act:18,taken:9,cost:100},
    barrierCap:1,         // barrier cannot exceed max health
    // Calibrated with `sim/affix-lab.js sweep`: reference teams lose both ways (wiped and timed out) above their breakpoint.
    foeHp:.8, foeAtk:2.2,  // multipliers for every enemy
    burstPerAether:.6,     // Arunima: attack per Aether spent, on every enemy (live: 100%)
    followUp:1.1,          // Aurelio's follow-up, as a share of attack
    reflect:.6,            // Reva returns this share of each attack she absorbs or takes; returned damage ignores shields
    gearPower:.15          // every fitted item also raises its wearer's output by this much, on top of its rule
  };
  const ECON={
    startGold:12, startCrew:2, maxBerths:6, startIntegrity:70,   // 12: the first stop already offers berth 3 or two items
    voucher:{3:12,4:20,5:30,6:42},   // price of the Nth berth: convex, so breadth is a visible choice
    income:10, bossBonus:6, gearPrice:5, sellValue:2, offers:3, slots:2,
    upkeepFree:4, upkeep:5,          // gold per battle for each crewmate beyond upkeepFree (the design record's upkeep);
                                     // without it, breadth beats equipment on every Brief (docs/testing/affix-lab.md)
    reroll:n=>2+n                     // 2, 3, 4… within one stop
  };
  // Perfect means cleared: only a clear scores 1, and score() caps every other outcome at .999.
  const BANDS=[
    {id:'perfect',min:1,label:'Perfect recovery',integrity:4,gold:6},
    {id:'slight',min:.88,label:'Slight shortfall',integrity:0,gold:4},
    {id:'small',min:.68,label:'Small loss',integrity:-4,gold:2},
    {id:'mild',min:.42,label:'Mild loss',integrity:-8,gold:0},
    {id:'heavy',min:.18,label:'Heavy loss',integrity:-12,gold:0},
    {id:'total',min:-1,label:'Total loss',integrity:-18,gold:0}
  ];
  function band(score){return BANDS.find(b=>score>=b.min)}

  // ---- Crew -----------------------------------------------------------------------------------------------------
  // Six team types. Sustain is a role inside a team, not a type of its own: every type has engine pieces and a sustainer
  // built for that engine (team-roles-and-acquisition-plan.md, "Sustain specialties"). Stats follow the live roster
  // (speed × 10); kits are lab abstractions. `core` is the engine pair the affix matrix holds fixed.
  const FAMILIES={
    aether:{label:'Aether burst',core:['Hanae','Arunima'],sustain:'Veska',
      text:'Build the shared pool, then spend it in one huge burst. Veska heals and turns her Refrains back into Aether.'},
    carry:{label:'Hypercarry',core:['Silen','Ekene'],sustain:'Daven',
      text:'Feed one striker charge and tempo. Daven draws the attacks meant for the carry.'},
    break:{label:'Break',core:['Wren','Sevim'],sustain:'Atsa',
      text:'Strip shields, cash every Break and exploit the opening. Atsa shields the crew whenever a shield falls.'},
    dot:{label:'Poison',core:['Nour','Spore'],sustain:'Nahana',
      text:'Stack poison that ticks through shields, then detonate it. Nahana keeps the crew standing through the long fights poison makes.'},
    counter:{label:'Retaliation',core:['Reva','Tarn'],sustain:'Ilka',
      text:'Draw the attacks onto a prepared front-liner and return them. Ilka plates the crew before the first blow.'},
    followup:{label:'Marks & follow-ups',core:['Nadira','Aurelio'],sustain:'Navigator',
      text:'Turn every allied hit into another one. Navigator’s healing grows the longer a fight runs.'}
  };
  const ROSTER={
    Hanae:{family:'aether',role:'Support · Aether builder',row:'back',hp:118,atk:14,spd:110,keys:['aether'],art:'hanae-mori-v3.png',
      basic:'Hit one enemy. Generates 2 Aether.',skill:'1 Aether: hit for 150% and mark it, then restore 5 Aether.',ult:'Hit every enemy for 200% and restore 4 Aether.'},
    Arunima:{family:'aether',role:'DPS · Aether spender',row:'front',hp:98,atk:28,spd:80,keys:['aether','spender'],art:'arunima-das-v4.png',
      basic:'Hit one enemy.',skill:'Full burst: spend 3 or more Aether to hit every enemy for 60% per Aether spent and delay them.',ult:'Hit every enemy for 500%.'},
    Silen:{family:'carry',role:'DPS · chain striker',row:'front',hp:106,atk:26,spd:100,keys:['carry','spender'],art:'silen-newt-v1.png',
      basic:'Hit one enemy.',skill:'2 Aether: hit for 200%, then keep taking extra turns at 2, 3, 4… Aether, each 25% stronger.',ult:'Hit one enemy for 500%.'},
    Ekene:{family:'carry',role:'Support · carry amplifier',row:'back',hp:84,atk:11,spd:120,keys:['carry'],art:'../lore/ekene-baptiste-v2.png',
      basic:'Hit one enemy.',skill:'1 Aether: give the carry 35 ultimate charge and advance them 30 AV.',ult:'Heal everyone 16% and give everyone 45 ultimate charge.',
      passive:'The team’s carry deals 30% more damage while Ekene stands.'},
    Wren:{family:'break',role:'DPS · breaker',row:'front',hp:122,atk:18,spd:90,keys:['break'],art:'wren-adeyemi-v2.png',
      basic:'Hit one enemy; heavy shield damage.',skill:'2 Aether: hit for 220% with triple shield damage.',ult:'Hit for 300% and strip every shield layer.',
      passive:'Shatter: whenever any enemy Breaks, Wren hits it for 150%.'},
    Sevim:{family:'break',role:'Support · area breaker',row:'back',hp:94,atk:13,spd:105,keys:['break'],art:'sevim-aydar-v2.png',
      basic:'Hit one enemy; extra shield damage.',skill:'3 Aether: hit every enemy for 110% with heavy shield damage.',ult:'Hit every enemy for 200% with triple shield damage.',
      passive:'Broken enemies take a further 30% while Sevim stands.'},
    Nour:{family:'dot',role:'DPS · poison',row:'front',hp:90,atk:20,spd:105,keys:['dot'],art:'nour-bediako-v3.png',
      basic:'Hit one enemy and apply 1 poison.',skill:'2 Aether: hit for 160% and apply 4 poison.',ult:'Hit for 300% and double the target’s poison.'},
    Spore:{family:'dot',role:'Support · poison spread',row:'back',hp:98,atk:12,spd:105,keys:['dot'],art:'spore-v2.png',
      basic:'Hit one enemy and apply 1 poison.',skill:'1 Aether: apply 3 poison to every enemy and heal the most hurt ally 10%.',ult:'Apply 3 poison to every enemy and heal everyone 15%.'},
    Reva:{family:'counter',role:'DPS · retaliation',row:'front',hp:135,atk:14,spd:95,taunt:3,keys:['counter'],art:'reva-sokolovna-v2.png',
      basic:'Hit one enemy.',skill:'2 Aether: gain a 30% barrier, double her taunt until her next turn, hit for 100%.',ult:'Hit for 240%; her retaliation doubles until her next turn.',
      passive:'Returns 60% of each enemy attack she absorbs or takes, through shields.'},
    Tarn:{family:'counter',role:'Sub-DPS · bastion',row:'front',hp:136,atk:12,spd:70,taunt:3.5,keys:['counter'],art:'tarn-v2.png',
      basic:'Hit one enemy and gain 8 barrier.',skill:'2 Aether: gain a barrier worth 35% of his health and double his taunt until his next turn.',
      ult:'Gain a barrier worth 50% of his health and give everyone else 20 barrier.',
      passive:'Bastion: returns everything his barrier absorbs to the attacker, through shields.'},
    Ilka:{family:'counter',sustain:true,role:'Sustain · barrier engineer',row:'front',hp:126,atk:10,spd:105,keys:['counter','sustain'],art:'ilka-voressen-v2.png',
      basic:'Hit one enemy and gain a small barrier.',skill:'1 Aether: give the designated ally 44 barrier and double their taunt for two enemy attacks.',ult:'Heal everyone 20% and give everyone 30 barrier.',
      passive:'Opening plating: when a battle starts, every crewmate gains a barrier worth 20% of their health.'},
    Nadira:{family:'followup',role:'Support · marker',row:'back',hp:89,atk:13,spd:115,keys:['followup'],art:'nadira-quill-v2.png',
      basic:'Hit one enemy and mark it.',skill:'2 Aether: hit every enemy for 110% and give each 3 marks.',ult:'Hit every enemy for 220% and give each 3 marks.'},
    Aurelio:{family:'followup',role:'Sub-DPS · follow-ups',row:'front',hp:90,atk:15,spd:110,keys:['followup'],art:'aurelio-bassi-v3.png',
      basic:'Hit one enemy and mark it.',skill:'2 Aether: hit every marked enemy for 200%.',ult:'Hit the most-marked enemy for 320% and mark it 3 times.',
      passive:'When an ally hits a marked enemy, Aurelio follows up for 110% and spends a mark. Twice per action.'},
    Imke:{family:'followup',role:'Sub-DPS · eager skirmisher',row:'back',hp:86,atk:14,spd:140,keys:['followup'],art:'imke-v3.png',
      basic:'Hit one enemy.',skill:'2 Aether: hit the last enemy the crew struck for 200%, and act 25 AV sooner next time.',
      ult:'Hit one enemy for 320% and mark it twice.',
      passive:'Too eager: when another crewmate lands a skill or ultimate, Imke follows up on that enemy for 60%. Once per action.'},
    Navigator:{family:'followup',sustain:true,role:'Sustain · escalating healer',row:'back',hp:110,atk:10,spd:90,keys:['followup','sustain'],art:'navigator-v2.png',
      basic:'Hit one enemy.',skill:'1 Aether: heal the most hurt ally 15%, plus 5% for every earlier song this battle; healing past full becomes barrier.',
      ult:'Heal everyone 25%, plus the same growth; healing past full becomes barrier.',
      passive:'The song grows: each skill heals more than the last.'},
    Ivara:{family:'aether',role:'Sub-DPS · Aether reservoir',row:'back',hp:132,atk:26,spd:90,keys:['aether'],art:'void-narwhal-navigator-v1.png',
      basic:'Hit one enemy.',skill:'2 Aether: hit the toughest enemy for 300% with heavy shield damage.',ult:'Hit the toughest enemy for 600%.',
      passive:'Room for an echo: +2 Aether capacity while he stands.'},
    Veska:{family:'aether',sustain:true,role:'Sustain · cantor',row:'back',hp:114,atk:14,spd:100,keys:['aether','sustain'],art:'veska-reed-v3.png',
      basic:'Hit one enemy and build a Refrain (up to 3).',skill:'2 Aether: heal everyone 8%, plus 4% per Refrain, then turn each Refrain back into 1 Aether.',
      ult:'Heal everyone 30%.',passive:'Practiced together: ordinary attacks become healing and Aether.'},
    Beatriz:{family:'carry',role:'DPS · finisher',row:'front',hp:112,atk:25,spd:70,keys:['carry'],art:'beatriz-corriveau-v2.png',
      basic:'Hit one enemy.',skill:'2 Aether: hit the weakest enemy for 280%; a kill refunds 2 Aether.',ult:'Hit the weakest enemy for 450%.'},
    Daven:{family:'carry',sustain:true,role:'Sustain · interceptor',row:'front',hp:174,atk:18,spd:80,taunt:2.5,keys:['sustain','carry'],art:'daven-pell-v7.png',
      basic:'Hit one enemy and gain 6 barrier.',skill:'2 Aether: hit for 225%, gain 32 barrier and double his taunt until his next turn.',ult:'Give everyone 40 barrier.',
      passive:'The first hit his barrier absorbs between his turns returns 1 Aether.'},
    Maul:{family:'break',role:'Sub-DPS · Break responder',row:'front',hp:116,atk:20,spd:70,keys:['break'],art:'maul-v2.png',
      basic:'Hit one enemy, Broken ones first.',skill:'2 Aether: hit a Broken enemy for 220% and push its recovery 20 AV later.',
      ult:'Hit every Broken enemy for 300%.',passive:'Waits for the fracture: deals 40% more to Broken enemies.'},
    Atsa:{family:'break',sustain:true,role:'Sustain · Break anchor',row:'front',hp:119,atk:12,spd:90,keys:['break','sustain'],art:'atsa-begay-v1.png',
      basic:'Hit one enemy and gain 6 barrier.',skill:'2 Aether: give everyone a barrier worth 15% of their health.',
      ult:'Give everyone a barrier worth 30% of their health.',
      passive:'Firm ground: whenever an enemy Breaks, the most hurt crewmate gains a barrier worth 12% of their health.'},
    Dolores:{family:'dot',role:'DPS · detonator',row:'front',hp:104,atk:16,spd:90,keys:['dot'],art:'dolores-achterberg-v7.png',
      basic:'Hit one enemy and apply 1 poison.',skill:'2 Aether: detonate the most poisoned enemy, dealing its poison 2.2 times over at once, through shields.',
      ult:'Apply 3 poison to every enemy, then detonate the most poisoned twice over.'},
    Nahana:{family:'dot',sustain:true,role:'Sustain · healer',row:'back',hp:103,atk:9,spd:110,keys:['sustain','dot'],art:'nahana-v2.png',
      basic:'Hit one enemy.',skill:'1 Aether: heal the most hurt ally 30%.',ult:'Heal everyone 32%.'}
  };
  // `power` scales everything a crewmate puts out (damage, healing, barriers, poison, charge given) and, more gently,
  // their health. It is the flattening knob: `sim/affix-lab.js flatten` moves it, holding the roster's average fixed,
  // until no one is mandatory or unusable, and prints this table. Values far from 1 mark kits that need real work.
  const POWER={Hanae:.848,Arunima:.815,Silen:1.052,Ekene:1.012,Wren:.745,Sevim:1.53,Nour:.897,Spore:1.003,Reva:.677,Tarn:.787,
    Ilka:.556,Nadira:1.926,Aurelio:1.099,Imke:1.454,Navigator:2.249,Ivara:1.631,Veska:2.26,Beatriz:1.263,Daven:.603,Maul:1.28,
    Atsa:.966,Dolores:1.28,Nahana:1.533};
  Object.entries(ROSTER).forEach(([id,c])=>{c.id=id;c.taunt=c.taunt||1;c.power=POWER[id]||1;});
  const CARRY_ORDER=['Silen','Beatriz','Arunima','Wren','Nour','Dolores','Aurelio','Reva'];

  // ---- Enemies --------------------------------------------------------------------------------------------------
  const ENEMIES={
    chaff:{name:'Drone',hp:60,atk:8,spd:100,layers:1,layerHp:12,points:1},
    grunt:{name:'Sentry',hp:160,atk:14,spd:95,layers:2,layerHp:30,points:2},
    warden:{name:'Warden',hp:150,atk:12,spd:85,layers:4,layerHp:40,points:2,text:'Thick shields over a soft body.'},
    quick:{name:'Quickstep',hp:120,atk:10,spd:190,layers:1,layerHp:25,points:2,text:'Acts twice as often.'},
    cleanser:{name:'Cleanser',hp:170,atk:12,spd:100,layers:2,layerHp:30,points:2,cleanse:.5,text:'Halves poison on every enemy each turn.'},
    reflector:{name:'Reflector',hp:170,atk:13,spd:95,layers:2,layerHp:30,points:2,reflect:.34,text:'Returns 34% of each hit.'},
    mender:{name:'Mender',hp:140,atk:9,spd:100,layers:2,layerHp:25,points:2,mend:.2,text:'Heals the most hurt enemy every other turn.'}
  };
  const BOSSES={
    carapace:{name:'The Carapace',hp:1100,atk:22,spd:100,layers:6,layerHp:60,points:8,heavy:1.8,requires:['shields'],
      text:'Six thick shield layers that return in full whenever it recovers. Every third attack hits 80% harder.',answers:'Break and poison'},
    brood:{name:'The Brood',hp:800,atk:16,spd:100,layers:3,layerHp:40,points:8,summon:2,requires:['shields'],
      text:'Calls two drones every turn while its shield holds.',answers:'Area damage and poison spread'},
    sprinter:{name:'The Sprinter',hp:850,atk:18,spd:200,layers:3,layerHp:40,points:8,
      text:'Acts twice for every turn you take.',answers:'Sustain, retaliation and Break delay'},
    mirror:{name:'The Mirror',hp:900,atk:18,spd:100,layers:3,layerHp:40,points:8,reflect:.3,
      text:'Returns 30% of every hit to whoever landed it.',answers:'Few heavy hits, poison, barriers'},
    purifier:{name:'The Purifier',hp:900,atk:18,spd:110,layers:3,layerHp:40,points:8,purify:.06,
      text:'Each turn it clears all poison and heals every enemy 6%.',answers:'Burst and Break'}
  };
  const FORMATS={
    patrol:{label:'Patrol',rounds:T.normalRounds,text:'Two waves of three mixed enemies.'},
    swarm:{label:'Swarm',rounds:T.normalRounds,text:'Two waves of five fragile drones.'},
    elite:{label:'Elite',rounds:T.normalRounds,text:'A heavily shielded elite Warden with two Sentries.'},
    boss:{label:'Boss',rounds:T.bossRounds,text:'The sector boss.'}
  };
  // Enemy strength per battle, derived from the economy by `sim/affix-lab.js route --briefs 24 --seeds 3`: the strength
  // at which the median type's themed crew, with what it can afford by then, beats the battle 90% of the time in sector 1
  // and 75% after. Re-derive whenever the roster, items, economy or shoppers change. Formats differ in difficulty, so
  // the numbers are not monotonic; the challenge they set is. Strength scales enemy health and attack together, so
  // threat grows with its square: never step it by sector (docs/testing/affix-lab.md).
  const ROUTE=[
    {sector:1,format:'patrol',scale:.36,gentle:true},{sector:1,format:'swarm',scale:.65,gentle:true},{sector:1,format:'boss',scale:.6,gentle:true},
    {sector:2,format:'patrol',scale:1.05},{sector:2,format:'elite',scale:1.17},{sector:2,format:'boss',scale:1.3},
    {sector:3,format:'swarm',scale:1.97},{sector:3,format:'elite',scale:1.59},{sector:3,format:'boss',scale:1.81}
  ];
  const PATROL_POOL=['warden','quick','cleanser','reflector','mender'];

  // ---- Affixes --------------------------------------------------------------------------------------------------
  // Category caps from docs/design/modifiers.md: at most one stat and one shape modifier per Brief; rule modifiers stack.
  // Every rule affix states its tax and its gift. `report` turns fight metrics into one sentence for the battle report.
  const CAPS={stat:1,shape:1,rule:Infinity,cost:2};
  const AFFIXES={
    frost:{name:'Spending Aether can freeze',category:'rule',weight:3,favors:['break'],punishes:['aether','carry'],requires:['breakWindow'],
      tax:'Each Aether spent gives a 12% chance to Freeze the spender: their next turn comes 60 AV later, and the Aether pool freezes for 60 AV, losing any Aether gained. Nobody freezes twice in a row.',
      gift:'A Break freezes the enemy: it misses the turn it would recover on.',
      applyTax(f){on(f,'spend',p=>{
        const u=p.unit;
        // The spend right after a freeze is safe: a telegraphed lockout, never a chain of them (enemy-traits-backlog.md).
        if(u.freezeImmune)return;
        if(u.thawGuard){u.thawGuard=false;return;}
        if(f.rand()<1-Math.pow(.88,p.amount)){
          u.frozen=true;u.thawGuard=true;u.pendingDelay+=60;f.poolFrozenUntil=Math.max(f.poolFrozenUntil,f.t+60);
          f.m.freezes++;f.m.frozenBy[u.id]=(f.m.frozenBy[u.id]||0)+1;
          log(f,`${u.id} froze after spending ${p.amount} Aether; the pool freezes`);
        }
      });},
      applyGift(f){on(f,'break',p=>{p.tgt.skips=(p.tgt.skips||0)+1;});},
      report(m){const who=Object.entries(m.frozenBy).map(([id,n])=>`${id} ×${n}`).join(', ');
        return m.freezes?`Froze your crew ${m.freezes} time${m.freezes>1?'s':''} (${who}); ${Math.round(m.frozenAether)} Aether lost to the frozen pool.`:'Nobody froze.';}},
    hardened:{name:'Shields harden',category:'rule',weight:3,favors:['break','counter'],punishes:['carry','followup','aether'],touches:['soak'],
      tax:'Shielded enemies take 85% less health damage (normally 60% less).',
      gift:'When an enemy Breaks, every other enemy loses a shield layer, down to its last.',
      applyTax(f){f.rules.soak=.15;},
      applyGift(f){on(f,'break',p=>{foesAlive(f).forEach(e=>{if(e!==p.tgt&&!e.broken&&e.layers>1){e.layers--;f.m.cracked++;}});});},
      report(m){return `Shields swallowed ${Math.round(m.soaked)} health damage; ${m.breaks} Break${m.breaks===1?'':'s'} cracked ${m.cracked} more layer${m.cracked===1?'':'s'}.`;}},
    wither:{name:'Poison withers',category:'rule',weight:3,favors:['carry','aether'],punishes:['dot'],
      tax:'Poison halves after every tick instead of dropping by one.',
      gift:'Every enemy has one fewer shield layer, down to one.',
      applyTax(f){f.rules.poisonDecay='half';},
      applyGift(f){f.rules.layerDelta-=1;},
      report(m){return `Poison dealt ${Math.round(m.poison)} damage.`;}},
    snapback:{name:'Shields snap back',category:'rule',weight:3,favors:['carry','dot','followup'],punishes:['break'],
      removes:['breakWindow'],touches:['soak'],
      tax:'A Break no longer delays the enemy, and its shields come back 30 AV later.',
      gift:'Shields are thinner: shielded enemies take 50% less health damage (normally 60%).',
      applyTax(f){f.rules.breakDelayMul=0;f.rules.reformAfter=30;},
      applyGift(f){f.rules.soak=.5;},
      report(m){return `${plural(m.breaks,'Break')}; ${plural(m.reformed,'shield')} snapped back before the enemy's turn.`;}},
    provoke:{name:'Breaks provoke a counterattack',category:'rule',weight:3,favors:['dot','counter'],punishes:['break'],
      tax:'When an enemy Breaks, it strikes back at once at your front line.',
      gift:'Ultimates charge 30% faster.',
      applyTax(f){on(f,'break',p=>{
        if(!p.tgt.alive||p.src.side!=='crew')return;
        const t=enemyTarget(f);
        if(!t)return;
        f.m.provoked++;log(f,`${p.tgt.name} strikes back at ${t.id}`);
        hurtCrew(f,p.tgt,t,p.tgt.atk,'attack');
      });},
      applyGift(f){f.rules.chargeMul*=1.3;},
      report(m){return `${plural(m.provoked,'Break')} drew a counterattack; ${plural(m.ults,'ultimate')} fired.`;}},
    scarce:{name:'Healing is halved',category:'rule',weight:2,favors:['counter'],punishes:[],
      tax:'All healing is halved.',
      gift:'Barriers are doubled.',
      applyTax(f){f.rules.healMul*=.5;},
      applyGift(f){f.rules.barrierMul*=2;},
      report(m){return `Healed ${Math.round(m.healed)}; barriers granted ${Math.round(m.barrier)}.`;}},
    brutal:{name:'Enemies hit 40% harder',category:'stat',weight:3,favors:[],punishes:[],touches:['incoming'],
      tax:'Enemy attacks deal 40% more damage.',gift:null,
      applyTax(f){f.rules.enemyAtk*=1.4;},
      report(m){return `Enemies dealt ${Math.round(m.taken)} damage.`;}},
    horde:{name:'Twice as many, half as tough',category:'shape',weight:3,favors:['break'],punishes:['carry'],touches:['incoming'],
      tax:'Every wave has twice as many enemies at half health; bosses bring two drone escorts.',gift:null,
      applyTax(f){f.rules.horde=true;},
      report(m){return `Defeated ${plural(m.kills,'enemy','enemies')}.`;}}
  };
  Object.entries(AFFIXES).forEach(([id,a])=>{a.id=id;});

  // ---- Equipment ------------------------------------------------------------------------------------------------
  // `kin` is written by hand: the crew of the item's type whose kits use its rule (a type alone is not enough: Hair
  // Trigger does nothing for a marker with no follow-ups). `fits` is baked, never edited: kin plus anyone else the item
  // measurably helps, as `sim/affix-lab.js fits` prints it (re-run it when kits or items change; it reads only kin, so
  // a crewmate no longer helped drops off). A unit test checks that every crewmate in `fits` gets something from the rule.
  const GEAR={
    capacitor:{name:'Capacitor Coil',kin:['Hanae','Arunima','Ivara','Veska'],fits:['Hanae','Arunima','Ivara','Veska'],text:'+2 Aether capacity while the wearer stands.',apply(u){u.capPlus+=2;}},
    overdraw:{name:'Overdraw Rig',kin:['Arunima','Silen'],fits:['Arunima','Silen'],text:'The wearer’s skills cost 1 less Aether (minimum 1).',apply(u){u.discount=true;}},
    lining:{name:'Thermal Lining',kin:['Arunima','Silen'],fits:['Arunima','Silen'],text:'The wearer can’t be Frozen; spending 4 or more Aether at once refunds 1.',apply(u){u.freezeImmune=true;u.bigRefund=true;}},
    borebit:{name:'Bore Bit',kin:['Wren','Sevim','Maul','Atsa'],fits:['Hanae','Arunima','Silen','Wren','Sevim','Nadira','Aurelio','Imke','Navigator','Ivara','Veska','Beatriz','Daven','Maul','Atsa'],text:'+50% shield damage.',apply(u){u.shieldMul*=1.5;}},
    shatter:{name:'Shatter Charge',kin:['Wren','Sevim','Maul','Atsa'],fits:['Hanae','Silen','Wren','Sevim','Reva','Tarn','Nadira','Imke','Ivara','Beatriz','Maul','Atsa'],text:'When the wearer Breaks an enemy, it takes another 150% hit.',apply(u){u.shatter+=1.5;}},
    vessel:{name:'Culture Vessel',kin:['Nour','Spore','Dolores'],fits:['Nour','Spore','Dolores'],text:'+1 poison every time the wearer applies poison.',apply(u){u.poisonPlus+=1;}},
    catalyst:{name:'Catalyst Vial',kin:['Nour','Spore','Dolores'],fits:['Nour','Spore','Dolores'],text:'Poison the wearer applies deals 40% more.',apply(u){u.poisonMul*=1.4;}},
    spring:{name:'Recoil Spring',kin:['Reva','Tarn'],fits:['Reva','Tarn'],text:'The wearer returns 40% more of each attack they take (retaliators only).',apply(u){u.reflectPlus+=.4;}},
    lens:{name:'Focus Lens',kin:['Silen','Beatriz','Daven'],fits:['Hanae','Silen','Reva','Beatriz','Daven','Dolores'],text:'Single-target skills and ultimates deal 35% more.',apply(u){u.singleMul*=1.35;}},
    trigger:{name:'Hair Trigger',kin:['Aurelio','Imke'],fits:['Aurelio','Imke'],text:'Follow-ups deal 40% more, and one more can trigger each action.',apply(u){u.followMul*=1.4;u.followCap+=1;}},
    ballast:{name:'Ballast Plate',kin:['Ilka','Navigator','Daven','Atsa'],fits:['Ilka','Navigator','Daven','Atsa'],text:'Barriers the wearer grants are 40% larger.',apply(u){u.barrierMul*=1.4;}},
    bell:{name:'Mender’s Bell',kin:['Ilka','Navigator','Veska','Nahana'],fits:['Spore','Ilka','Navigator','Veska','Nahana'],text:'Healing the wearer grants is 40% stronger.',apply(u){u.healMul*=1.4;}}
  };
  Object.entries(GEAR).forEach(([id,g])=>{g.id=id;});
  function gearFits(gearId){return GEAR[gearId].fits.slice();}

  // ---- Fight construction ---------------------------------------------------------------------------------------
  function log(f,text){if(f.record)f.log.push({t:Math.round(f.t),text});}
  function wait(u){return 10000/u.spd;}
  function living(list){return list.filter(u=>u.alive);}
  function crewAlive(f){return f.crew.filter(u=>u.alive);}
  function foesAlive(f){return f.foes.filter(u=>u.alive);}

  function makeCrew(f,id,gear){
    const c=ROSTER[id];
    const hp=Math.round(c.hp*(.6+.4*c.power));
    const u={side:'crew',id,n:id,family:c.family,row:c.row,maxHp:hp,hp,atk:c.atk,spd:c.spd,taunt:c.taunt,alive:true,
      power:c.power,av:0,en:0,barrier:0,gear:(gear||[]).filter(g=>GEAR[g]),frozen:false,thawGuard:false,pendingDelay:0,tauntMul:1,provoke:0,
      refundUsed:false,reflectBoost:1,aetherWaits:0,refrain:0,songs:0,
      capPlus:0,discount:false,freezeImmune:false,bigRefund:false,shieldMul:1,shatter:0,poisonPlus:0,poisonMul:1,reflectPlus:0,
      singleMul:1,followMul:1,followCap:0,barrierMul:1,healMul:1};
    u.gear.forEach(g=>GEAR[g].apply(u));
    u.power*=1+T.gearPower*u.gear.length;
    u.av=wait(u)*(.85+.15*f.rand());
    return u;
  }
  function makeEnemy(f,kind,opts={}){
    const b=opts.boss?BOSSES[kind]:ENEMIES[kind],s=f.scale,r=f.rules;
    // Shields are integral to the flow of battle: an affix may change how they behave, never remove them (minimum one layer).
    let hp=b.hp*s*T.foeHp*r.enemyHp*(opts.hpMul||1),layers=Math.max(1,b.layers+r.layerDelta+(opts.extraLayers||0));
    const e={side:'foe',id:`${kind}${f.spawned++}`,kind,boss:!!opts.boss,name:opts.elite?`Elite ${b.name}`:b.name,summon:!!opts.summon,
      maxHp:Math.round(hp),hp:Math.round(hp),atk:b.atk*s*T.foeAtk*r.enemyAtk*(opts.atkMul||1),spd:b.spd,alive:true,
      maxLayers:layers,layers,layerHp:b.layerHp*Math.sqrt(s)*(opts.layerMul||1),shieldHp:0,broken:false,
      poison:0,poisonPer:0,poisonSrc:null,marks:0,attacks:0,turns:0,pendingDelay:0,skips:0,points:opts.summon?0:(opts.elite?4:b.points),
      reflect:b.reflect||0,cleanse:b.cleanse||0,mend:b.mend||0,summonCount:b.summon||0,purify:b.purify||0,heavy:b.heavy||0};
    e.shieldHp=e.layers>0?e.layerHp:0;
    e.av=wait(e)*(.9+.3*f.rand());
    if(!e.summon)f.pool.push(e);
    return e;
  }
  function buildWaves(f){
    const enc=f.encounter,rand=rng(hash(f.seed,'waves',enc.format,enc.boss||'')),h=f.rules.horde;
    const n=k=>h?k*2:k,hpMul=h?.5:1;
    if(enc.format==='boss'){
      const wave=[{kind:enc.boss||'carapace',boss:true,hpMul:h?.8:1}];
      if(h)wave.push({kind:'chaff'},{kind:'chaff'});
      return [wave];
    }
    if(enc.format==='swarm')return [0,1].map(()=>Array.from({length:n(5)},()=>({kind:'chaff',hpMul})));
    if(enc.format==='elite')return [[{kind:'warden',elite:true,hpMul:3*hpMul,atkMul:1.5,extraLayers:2,layerMul:1.3},
      ...Array.from({length:n(2)},()=>({kind:'grunt',hpMul}))]];
    return [0,1].map(()=>{
      const picks=shuffled(PATROL_POOL,rand);
      return Array.from({length:n(3)},(_,i)=>({kind:i===0?'grunt':picks[(i-1)%picks.length],hpMul}));
    });
  }
  function spawnWave(f){
    const wave=f.waves[f.waveIndex++];
    if(!wave)return false;
    wave.forEach(spec=>f.foes.push(makeEnemy(f,spec.kind,spec)));
    log(f,`Wave ${f.waveIndex}: ${wave.map(w=>(w.elite?'Elite ':'')+(w.boss?BOSSES[w.kind].name:ENEMIES[w.kind].name)).join(', ')}`);
    return true;
  }

  // ---- The event bus --------------------------------------------------------------------------------------------
  // Affixes, equipment and passives register handlers by event name. Payloads are mutable: a handler may change
  // `amount` before the engine applies it.
  function on(f,event,fn,owner){(f.handlers[event]=f.handlers[event]||[]).push({fn,owner});}
  function emit(f,event,payload){
    const list=f.handlers[event];
    if(!list)return payload;
    for(const h of list){if(!h.owner||h.owner.alive)h.fn(payload,h.owner);}
    return payload;
  }

  // Kit passives that react to events.
  function registerPassives(f){
    const by=id=>f.crew.find(u=>u.id===id);
    const ekene=by('Ekene');
    if(ekene)on(f,'outgoing',p=>{if(p.src===f.carry)p.amount*=1+K(ekene).buff*ekene.power;},ekene);
    const wren=by('Wren');
    if(wren)on(f,'break',p=>{if(p.tgt.alive){f.m.shatters++;strike(f,wren,p.tgt,K(wren).shatter,0,'shatter');}},wren);
    f.crew.filter(u=>u.shatter).forEach(u=>on(f,'break',p=>{if(p.src===u&&p.tgt.alive){f.m.shatters++;strike(f,u,p.tgt,u.shatter,0,'shatter');}},u));
    const sevim=by('Sevim');
    if(sevim)on(f,'outgoing',p=>{if(p.tgt.broken)p.amount*=1+K(sevim).vuln;},sevim);
    const aurelio=by('Aurelio');
    if(aurelio)on(f,'afterHit',p=>{
      if(p.src===aurelio||['follow','reflect','shatter'].includes(p.kind)||!p.tgt.alive||p.tgt.marks<=0)return;
      const cap=2+aurelio.followCap;
      if(f.followThisAction>=cap)return;
      f.followThisAction++;p.tgt.marks--;f.m.followups++;
      strike(f,aurelio,p.tgt,T.followUp*aurelio.followMul*f.rules.followMul,.3,'follow');
    },aurelio);
    const reva=by('Reva');
    if(reva)on(f,'afterIncoming',p=>{
      if(p.tgt!==reva||p.kind!=='attack'||!p.src.alive)return;
      const back=(p.absorbed+p.lost)*(T.reflect+reva.reflectPlus)*reva.reflectBoost;
      if(back>0){f.m.reflected+=back;strike(f,reva,p.src,0,0,'reflect',{flat:back,unsoaked:true});}
    },reva);
    const daven=by('Daven');
    if(daven)on(f,'afterIncoming',p=>{
      if(p.tgt!==daven||p.absorbed<=0||daven.refundUsed)return;
      daven.refundUsed=true;credit(f,1);
    },daven);
    const tarn=by('Tarn');
    if(tarn)on(f,'afterIncoming',p=>{
      if(p.tgt!==tarn||p.kind!=='attack'||p.absorbed<=0||!p.src.alive)return;
      const back=p.absorbed*(K(tarn).reflect+tarn.reflectPlus);
      f.m.reflected+=back;strike(f,tarn,p.src,0,0,'reflect',{flat:back,unsoaked:true});
    },tarn);
    const maul=by('Maul');
    if(maul)on(f,'outgoing',p=>{if(p.src===maul&&p.tgt.broken)p.amount*=1+K(maul).vuln;},maul);
    const atsa=by('Atsa');
    if(atsa)on(f,'break',()=>{const t=mostHurt(f);if(t)shield(f,atsa,t,t.maxHp*K(atsa).onBreak);},atsa);
    const imke=by('Imke');
    if(imke)on(f,'afterHit',p=>{
      // Once per action, plus one for each Hair Trigger she wears (followCap), as Aurelio's budget counts his.
      if(p.src===imke||p.src.side!=='crew'||!['skill','ult'].includes(p.kind)||!p.tgt.alive||f.eagerThisAction>=1+imke.followCap)return;
      f.eagerThisAction++;f.m.followups++;
      strike(f,imke,p.tgt,K(imke).follow*imke.followMul*f.rules.followMul,.3,'follow');
    },imke);
  }

  function createFight(spec){
    const seed=spec.seed>>>0,affixes=(spec.affixes||[]).filter(id=>AFFIXES[id]);
    const f={seed,rand:rng(hash(seed,'fight')),record:!!spec.record,log:[],t:0,scale:spec.scale||1,encounter:spec.encounter||{format:'patrol'},
      affixes,handlers:{},crew:[],foes:[],pool:[],waves:[],waveIndex:0,spawned:0,allyTurns:0,followThisAction:0,eagerThisAction:0,
      lastTarget:null,end:null,carry:null,poolFrozenUntil:-1,
      rules:{soak:T.soak,breakDelayMul:1,basicMul:1,skillMul:1,followMul:1,healMul:1,barrierMul:1,enemyHp:1,enemyAtk:1,layerDelta:0,
        poisonDecay:'one',regen:0,horde:false,capDelta:0,reformAfter:0,chargeMul:1},
      session:{aetherModes:{},aetherOvercharge:{}},
      m:{freezes:0,frozenBy:{},soaked:0,breaks:0,shatters:0,poison:0,reflected:0,followups:0,hits:0,healed:0,barrier:0,
        regen:0,taken:0,dealt:0,kills:0,enemyAttacks:0,downs:0,ults:0,aetherSpent:0,aetherWasted:0,aetherGenerated:0,crewTurns:0,byKind:{},
        frozenAether:0,cracked:0,skipped:0,reformed:0,provoked:0,detonations:0,executions:0,extended:0},
      contributions:{}};
    // affixParts lets the sim measure a tax or a gift on its own: {frost:'tax'} applies only the tax half.
    const parts=spec.affixParts||{};
    affixes.forEach(id=>{const a=AFFIXES[id],part=parts[id]||'both';if(part!=='gift')a.applyTax(f);if(part!=='tax'&&a.applyGift)a.applyGift(f);});
    f.crew=(spec.crew||[]).filter(c=>ROSTER[c.id||c]).map(c=>makeCrew(f,c.id||c,c.gear));
    f.carry=CARRY_ORDER.map(id=>f.crew.find(u=>u.id===id)).find(Boolean)||null;
    registerPassives(f);
    const ilka=f.crew.find(u=>u.id==='Ilka');
    if(ilka)f.crew.forEach(a=>shield(f,ilka,a,a.maxHp*K(ilka).opening));
    f.aether=A.create(f.crew);
    syncPool(f);
    f.waves=buildWaves(f);
    const fmt=FORMATS[f.encounter.format]||FORMATS.patrol;
    f.limit=(spec.rounds||fmt.rounds)*T.round;
    spawnWave(f);
    return f;
  }

  // ---- Aether ---------------------------------------------------------------------------------------------------
  function syncPool(f){
    const crew=crewAlive(f);
    const bonus=crew.reduce((sum,u)=>sum+u.capPlus,0)+f.rules.capDelta;
    f.aether.max=Math.max(1,A.capacity(crew)+bonus);
    f.aether.current=Math.min(f.aether.current,f.aether.max);
  }
  function credit(f,amount){
    if(f.t<f.poolFrozenUntil){f.m.frozenAether+=amount;f.m.aetherWasted+=amount;return 0;}
    const got=A.credit(f.aether,amount);
    f.m.aetherGenerated+=got;f.m.aetherWasted+=amount-got;
    return got;
  }
  function paid(f,u,amount){
    f.m.aetherSpent+=amount;
    emit(f,'spend',{f,unit:u,amount});
    if(u.bigRefund&&amount>=4)credit(f,1);
  }

  // ---- Damage ---------------------------------------------------------------------------------------------------
  // `mult` scales attack into health damage; `shieldMult` scales attack into shield damage. Shield damage lands first;
  // the hit that Breaks a shield is not soaked, and the Vulnerable bonus applies from the next hit on.
  function strike(f,src,tgt,mult,shieldMult,kind,opts={}){
    if(!tgt||!tgt.alive||!src)return 0;
    const single=!!opts.single;
    const out=src.power||1;
    const p=emit(f,'outgoing',{f,src,tgt,kind,single,amount:(opts.flat!==undefined?opts.flat:src.atk*mult)*out,shield:src.atk*shieldMult*src.shieldMul*out});
    if(kind==='basic')p.amount*=f.rules.basicMul;
    if(kind==='skill')p.amount*=f.rules.skillMul;
    if(single&&(kind==='skill'||kind==='ult'))p.amount*=src.singleMul;
    let broke=false;
    if(tgt.layers>0&&!tgt.broken&&p.shield>0){
      let left=p.shield;
      while(left>0&&tgt.layers>0){
        const take=Math.min(left,tgt.shieldHp);tgt.shieldHp-=take;left-=take;
        if(tgt.shieldHp<=0){tgt.layers--;tgt.shieldHp=tgt.layers>0?tgt.layerHp:0;}
      }
      if(tgt.layers===0)broke=true;
    }
    let amount=p.amount*(1+(tgt.broken?T.vuln:0)+Math.min(T.maxMarks,tgt.marks)*T.markBonus);
    if(!tgt.broken&&tgt.layers>0&&!opts.unsoaked){f.m.soaked+=amount*(1-f.rules.soak);amount*=f.rules.soak;}
    const dealt=Math.max(0,Math.min(tgt.hp,amount));
    tgt.hp-=amount;
    if(src.side==='crew')f.lastTarget=tgt;
    f.m.dealt+=dealt;f.m.hits++;f.m.byKind[kind]=(f.m.byKind[kind]||0)+dealt;
    f.contributions[src.id]=(f.contributions[src.id]||0)+dealt;
    if(tgt.hp<=0)killFoe(f,src,tgt);
    else if(broke)breakFoe(f,src,tgt);
    if(src.side==='crew'&&!['reflect','shatter'].includes(kind)&&tgt.reflect&&src.alive&&dealt>0)hurtCrew(f,tgt,src,dealt*tgt.reflect,'reflect');
    emit(f,'afterHit',{f,src,tgt,kind,dealt,broke});
    return dealt;
  }
  function breakFoe(f,src,tgt){
    tgt.broken=true;
    tgt.av+=wait(tgt)*T.breakDelay*f.rules.breakDelayMul;
    tgt.reformAt=f.rules.reformAfter?f.t+f.rules.reformAfter:null;
    f.m.breaks++;
    log(f,`${src.id} broke ${tgt.name}`);
    emit(f,'break',{f,src,tgt});
  }
  function killFoe(f,src,tgt){
    tgt.alive=false;tgt.hp=0;f.m.kills++;
    log(f,`${src.id} defeated ${tgt.name}`);
  }
  // The back row is safe: no enemy damage of any kind reaches it (the live resolver's hit() enforces the same rule).
  function hurtCrew(f,src,tgt,amount,kind){
    if(!tgt.alive||(src&&src.side==='foe'&&tgt.row==='back'))return;
    let dmg=amount,absorbed=0;
    if(tgt.barrier>0){absorbed=Math.min(tgt.barrier,dmg);tgt.barrier-=absorbed;dmg-=absorbed;}
    const lost=Math.min(tgt.hp,dmg);
    tgt.hp-=dmg;
    if(kind==='attack')f.m.taken+=absorbed+lost;
    charge(f,tgt,T.energy.taken);
    if(tgt.hp<=0){tgt.hp=0;tgt.alive=false;f.m.downs++;log(f,`${tgt.id} is down`);syncPool(f);}
    emit(f,'afterIncoming',{f,src,tgt,absorbed,lost,kind});
  }
  function charge(f,u,amount){u.en=Math.min(T.energy.cost,u.en+amount*f.rules.chargeMul);}
  // Shields that snap back return on a timer, without waiting for the enemy's turn.
  function reformDue(f){
    for(const e of f.foes){
      if(!e.alive||!e.broken||e.reformAt===null||e.reformAt===undefined||f.t<e.reformAt)continue;
      e.broken=false;e.layers=e.maxLayers;e.shieldHp=e.layerHp;e.reformAt=null;f.m.reformed++;
      log(f,`${e.name}'s shields snap back`);
    }
  }
  function heal(f,src,tgt,amount){
    if(!tgt.alive)return;
    const got=Math.min(tgt.maxHp-tgt.hp,amount*src.healMul*src.power*f.rules.healMul);
    tgt.hp+=got;f.m.healed+=got;
  }
  // Healing that overflows full health becomes barrier (Navigator). That barrier is one the healer grants, so it takes
  // their barrier multiplier (Ballast Plate) as shield() does; `total` already carries their power.
  function mend(f,src,tgt,amount){
    if(!tgt.alive)return;
    const total=amount*src.healMul*src.power*f.rules.healMul,got=Math.min(tgt.maxHp-tgt.hp,total);
    tgt.hp+=got;f.m.healed+=got;
    const extra=Math.min(tgt.maxHp*T.barrierCap-tgt.barrier,(total-got)*src.barrierMul*f.rules.barrierMul);
    if(extra>0){tgt.barrier+=extra;f.m.barrier+=extra;}
  }
  function shield(f,src,tgt,amount){
    if(!tgt.alive)return;
    const got=Math.min(tgt.maxHp*T.barrierCap-tgt.barrier,amount*src.barrierMul*src.power*f.rules.barrierMul);
    if(got>0){tgt.barrier+=got;f.m.barrier+=got;}
  }
  function poison(f,src,tgt,stacks){
    if(!tgt.alive)return;
    tgt.poison=Math.min(T.maxPoison,tgt.poison+stacks+src.poisonPlus);
    tgt.poisonPer=Math.max(tgt.poisonPer,src.atk*T.poisonPerAtk*src.poisonMul*src.power);
    tgt.poisonSrc=src.id;
  }
  function mark(tgt,n){tgt.marks=Math.min(T.maxMarks,tgt.marks+n);}

  // ---- Targeting ------------------------------------------------------------------------------------------------
  function effectiveHp(f,e){return e.broken||e.layers===0?e.hp:e.hp/f.rules.soak;}
  function weakest(f){return foesAlive(f).sort((a,b)=>effectiveHp(f,a)-effectiveHp(f,b))[0];}
  function toughest(f){return foesAlive(f).sort((a,b)=>b.hp-a.hp)[0];}
  function breakTarget(f){
    const shielded=foesAlive(f).filter(e=>!e.broken&&e.layers>0);
    return shielded.sort((a,b)=>(a.layers-1)*a.layerHp+a.shieldHp-((b.layers-1)*b.layerHp+b.shieldHp))[0]||weakest(f);
  }
  function mostMarked(f){return foesAlive(f).sort((a,b)=>b.marks-a.marks||a.hp-b.hp)[0];}
  function mostHurt(f,list){return (list||crewAlive(f)).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];}
  function frontline(f){return crewAlive(f).filter(u=>u.row==='front');}
  // Enemies only ever target the front row.
  function enemyTarget(f){
    const front=frontline(f);
    if(!front.length)return null;
    const weights=front.map(u=>u.taunt*u.tauntMul*(u.provoke>0?2:1)*(1+1.6*(1-u.hp/u.maxHp)));
    let roll=f.rand()*weights.reduce((a,b)=>a+b,0);
    for(let i=0;i<front.length;i++){roll-=weights[i];if(roll<=0)return front[i];}
    return front[front.length-1];
  }
  // A basic would finish the encounter: lets spenders save Aether, as in the live Auto.
  function basicFinishes(f,u){
    const foes=foesAlive(f);
    return f.waveIndex>=f.waves.length&&foes.length===1&&effectiveHp(f,foes[0])<=u.atk*f.rules.basicMul*.95;
  }

  // ---- Kits -----------------------------------------------------------------------------------------------------
  // assess(f,u) feeds aether-rules' teamPlan; skill(f,u,plan) runs after the cost is paid.
  // Kit numbers live apart from the kit logic so the sim can sweep them: `--set Sevim.aoe=1`.
  const KIT_NUMBERS={
    Hanae:{skill:1.5,ult:2,ultAether:4},
    Arunima:{ult:5},
    Silen:{ult:5},
    Ekene:{charge:35,advance:30,buff:.3,ultHeal:.16,ultCharge:45},
    Wren:{basicShred:1.5,skill:2.2,skillShred:3,ult:3,shatter:1.5},
    Sevim:{basicShred:1.25,aoe:1.1,aoeShred:2.8,ult:2,ultShred:3,vuln:.3},
    Nour:{skill:1.6,stacks:4,ult:3},
    Spore:{stacks:3,heal:.1,ultStacks:3,ultHeal:.15},
    Reva:{barrier:.3,skill:1,ult:2.4},
    Ilka:{barrier:44,ultHeal:.2,ultBarrier:30,opening:.2},
    Nadira:{aoe:1.1,marks:3,ult:2.2,ultMarks:3},
    Aurelio:{skill:2,ult:3.2},
    Nahana:{heal:.3,ultHeal:.32},
    Daven:{skill:2.25,barrier:32,ultBarrier:40},
    Ivara:{skill:3,skillShred:1.5,ult:6},
    Veska:{heal:.08,perRefrain:.04,refund:1,ult:.3},
    Beatriz:{skill:2.8,refund:2,ult:4.5},
    Maul:{skill:2.2,extend:20,vuln:.4,ult:3},
    Atsa:{onBreak:.12,skill:.15,ult:.3},
    Dolores:{detonate:2.2,fallback:1.6,ultStacks:3,ultDetonate:2},
    Tarn:{reflect:1,skill:.35,ult:.5,ultAll:20},
    Imke:{follow:.6,skill:2,advance:25,ult:3.2},
    Navigator:{heal:.15,grow:.05,ult:.25}
  };
  Object.entries(KIT_NUMBERS).forEach(([id,k])=>{ROSTER[id].k=k;});
  const K=u=>ROSTER[u.id].k;

  function basicHit(f,u,tgt,shieldMult=.75){return strike(f,u,tgt||weakest(f),1,shieldMult,'basic',{single:true});}
  const KITS={
    Hanae:{
      assess:(f)=>({useful:f.aether.current<=f.aether.max-2}),
      basic(f,u){basicHit(f,u);},
      skill(f,u){const t=weakest(f);strike(f,u,t,K(u).skill,1,'skill',{single:true});if(t&&t.alive)mark(t,1);credit(f,A.profile('Hanae').skillGain);},
      ult(f,u){foesAlive(f).forEach(e=>strike(f,u,e,K(u).ult,1,'ult'));credit(f,K(u).ultAether);}
    },
    Arunima:{
      assess:(f,u)=>({useful:foesAlive(f).length>0,basicEnough:basicFinishes(f,u),spendLimit:burstLimit(f,u)}),
      basic(f,u){basicHit(f,u);},
      skill(f,u,plan){
        const c=plan.cost;
        foesAlive(f).forEach(e=>{strike(f,u,e,c*T.burstPerAether,1+.25*c,'skill');if(e.alive)e.av+=15;});
      },
      ult(f,u){foesAlive(f).forEach(e=>strike(f,u,e,K(u).ult,1.5,'ult'));}
    },
    Silen:{
      assess:(f,u)=>({useful:foesAlive(f).length>0,basicEnough:basicFinishes(f,u)}),
      basic(f,u){basicHit(f,u);},
      skill(f,u){
        let target=toughest(f),index=0;
        strike(f,u,target,A.chainMultiplier(0),.6,'skill',{single:true});
        charge(f,u,T.energy.act);
        while(u.alive&&!u.frozen&&foesAlive(f).length&&index<12){
          if(!target||!target.alive)target=toughest(f);
          index++;
          const cost=A.continuationCost(index);
          if(!A.spendContinuation(f.aether,index))break;
          paid(f,u,cost);
          if(u.frozen)break;
          strike(f,u,target,A.chainMultiplier(index),.6,'skill',{single:true});
          charge(f,u,T.energy.act);
          log(f,`Silen extra turn ${index} for ${cost} Aether`);
          ensureWave(f);
        }
      },
      ult(f,u){strike(f,u,toughest(f),K(u).ult,1,'ult',{single:true});}
    },
    Ekene:{
      assess:(f)=>({useful:!!(f.carry&&f.carry.alive&&f.carry.en<T.energy.cost),setup:true}),
      basic(f,u){basicHit(f,u);},
      skill(f,u){const c=f.carry;if(!c||!c.alive)return;charge(f,c,K(u).charge*u.power);c.av=Math.max(0,c.av-K(u).advance*u.power);},
      ult(f,u){crewAlive(f).forEach(a=>{heal(f,u,a,a.maxHp*K(u).ultHeal);charge(f,a,K(u).ultCharge*u.power);});}
    },
    Wren:{
      assess:(f)=>{
        const w=f.crew.find(x=>x.id==='Wren'),shielded=foesAlive(f).filter(e=>!e.broken&&e.layers>0);
        const close=shielded.some(e=>e.layers===1&&e.shieldHp<=w.atk*K(w).skillShred*w.shieldMul);
        return {useful:shielded.length>0,opportunity:close};
      },
      basic(f,u){basicHit(f,u,breakTarget(f),K(u).basicShred);},
      skill(f,u){strike(f,u,breakTarget(f),K(u).skill,K(u).skillShred,'skill',{single:true});},
      ult(f,u){const t=breakTarget(f);if(!t)return;if(t.layers>0&&!t.broken){t.layers=0;t.shieldHp=0;breakFoe(f,u,t);}strike(f,u,t,K(u).ult,0,'ult',{single:true});}
    },
    Sevim:{
      assess:(f)=>{const n=foesAlive(f).filter(e=>!e.broken&&e.layers>0).length;return {useful:n>0,setup:n>=2};},
      basic(f,u){basicHit(f,u,breakTarget(f),K(u).basicShred);},
      skill(f,u){foesAlive(f).forEach(e=>strike(f,u,e,K(u).aoe,K(u).aoeShred,'skill'));},
      ult(f,u){foesAlive(f).forEach(e=>strike(f,u,e,K(u).ult,K(u).ultShred,'ult'));}
    },
    Nour:{
      assess:(f)=>({useful:foesAlive(f).length>0}),
      basic(f,u){const t=poisonTarget(f);basicHit(f,u,t);poison(f,u,t,1);},
      skill(f,u,plan){const t=poisonTarget(f);strike(f,u,t,K(u).skill,.5,'skill',{single:true});poison(f,u,t,K(u).stacks+2*(plan.extra||0));},
      ult(f,u){const t=toughest(f);strike(f,u,t,K(u).ult,1,'ult',{single:true});if(t&&t.alive)t.poison=Math.min(T.maxPoison,t.poison*2);}
    },
    Spore:{
      assess:(f)=>({useful:foesAlive(f).some(e=>e.poison<6),setup:true}),
      basic(f,u){const t=poisonTarget(f);basicHit(f,u,t);poison(f,u,t,1);},
      skill(f,u){foesAlive(f).forEach(e=>poison(f,u,e,K(u).stacks));const h=mostHurt(f);if(h)heal(f,u,h,h.maxHp*K(u).heal);},
      ult(f,u){foesAlive(f).forEach(e=>poison(f,u,e,K(u).ultStacks));crewAlive(f).forEach(a=>heal(f,u,a,a.maxHp*K(u).ultHeal));}
    },
    Reva:{
      assess:(f,u)=>({useful:u.barrier<u.maxHp*.2,emergency:u.hp<u.maxHp*.5}),
      basic(f,u){basicHit(f,u);},
      skill(f,u){shield(f,u,u,u.maxHp*K(u).barrier);u.tauntMul=2;strike(f,u,weakest(f),K(u).skill,.5,'skill',{single:true});},
      ult(f,u){strike(f,u,toughest(f),K(u).ult,1,'ult',{single:true});u.reflectBoost=2;}
    },
    Ilka:{
      assess:(f)=>{const t=designated(f);return {useful:!!t&&t.barrier<30,emergency:frontline(f).some(a=>a.hp<a.maxHp*.5)};},
      basic(f,u){basicHit(f,u);shield(f,u,u,6);},
      skill(f,u){const t=designated(f);if(!t)return;shield(f,u,t,K(u).barrier);t.provoke=2;},
      ult(f,u){crewAlive(f).forEach(a=>{heal(f,u,a,a.maxHp*K(u).ultHeal);shield(f,u,a,K(u).ultBarrier);});}
    },
    Nadira:{
      assess:(f)=>({useful:foesAlive(f).some(e=>e.marks<2),setup:true}),
      basic(f,u){const t=weakest(f);basicHit(f,u,t);if(t&&t.alive)mark(t,1);},
      skill(f,u){foesAlive(f).forEach(e=>{strike(f,u,e,K(u).aoe,.5,'skill');if(e.alive)mark(e,K(u).marks);});},
      ult(f,u){foesAlive(f).forEach(e=>{strike(f,u,e,K(u).ult,1,'ult');if(e.alive)mark(e,K(u).ultMarks);});}
    },
    Aurelio:{
      assess:(f)=>{const n=foesAlive(f).filter(e=>e.marks>0).length;return {useful:n>0,opportunity:n>=2};},
      basic(f,u){const t=weakest(f);basicHit(f,u,t);if(t&&t.alive)mark(t,1);},
      skill(f,u){foesAlive(f).filter(e=>e.marks>0).forEach(e=>strike(f,u,e,K(u).skill,.5,'skill'));},
      ult(f,u){const t=mostMarked(f);strike(f,u,t,K(u).ult,1,'ult',{single:true});if(t&&t.alive)mark(t,3);}
    },
    Nahana:{
      assess:(f)=>({useful:crewAlive(f).some(a=>a.hp<a.maxHp*.75),emergency:crewAlive(f).some(a=>a.hp<a.maxHp*.5)}),
      basic(f,u){basicHit(f,u);},
      skill(f,u){const t=mostHurt(f);if(t)heal(f,u,t,t.maxHp*K(u).heal);},
      ult(f,u){crewAlive(f).forEach(a=>heal(f,u,a,a.maxHp*K(u).ultHeal));}
    },
    Daven:{
      assess:(f,u)=>({useful:u.barrier<20,emergency:frontline(f).some(a=>a!==u&&a.hp<a.maxHp*.5)}),
      basic(f,u){basicHit(f,u);shield(f,u,u,6);},
      skill(f,u){strike(f,u,weakest(f),K(u).skill,1,'skill',{single:true});shield(f,u,u,K(u).barrier);u.tauntMul=2;},
      ult(f,u){crewAlive(f).forEach(a=>shield(f,u,a,K(u).ultBarrier));}
    },
    Ivara:{
      assess:(f,u)=>({useful:foesAlive(f).length>0,basicEnough:basicFinishes(f,u)}),
      basic(f,u){basicHit(f,u);},
      skill(f,u){strike(f,u,toughest(f),K(u).skill,K(u).skillShred,'skill',{single:true});},
      ult(f,u){strike(f,u,toughest(f),K(u).ult,1,'ult',{single:true});}
    },
    Veska:{
      assess:(f,u)=>({useful:u.refrain>0&&crewAlive(f).some(a=>a.hp<a.maxHp*.85),emergency:crewAlive(f).some(a=>a.hp<a.maxHp*.5)}),
      basic(f,u){basicHit(f,u);u.refrain=Math.min(3,u.refrain+1);},
      skill(f,u){
        const r=u.refrain;u.refrain=0;
        crewAlive(f).forEach(a=>heal(f,u,a,a.maxHp*(K(u).heal+K(u).perRefrain*r)));
        if(r)credit(f,r*K(u).refund);
      },
      ult(f,u){crewAlive(f).forEach(a=>heal(f,u,a,a.maxHp*K(u).ult));}
    },
    Beatriz:{
      assess:(f,u)=>({useful:foesAlive(f).length>0,basicEnough:basicFinishes(f,u)}),
      basic(f,u){basicHit(f,u);},
      skill(f,u){const t=weakest(f);strike(f,u,t,K(u).skill,.6,'skill',{single:true});if(t&&!t.alive){f.m.executions++;credit(f,K(u).refund);}},
      ult(f,u){strike(f,u,weakest(f),K(u).ult,1,'ult',{single:true});}
    },
    Maul:{
      assess:(f)=>({useful:foesAlive(f).length>0,opportunity:foesAlive(f).some(e=>e.broken)}),
      basic(f,u){basicHit(f,u,brokenTarget(f)||breakTarget(f));},
      skill(f,u){
        const t=brokenTarget(f)||breakTarget(f);
        strike(f,u,t,K(u).skill,.75,'skill',{single:true});
        if(t&&t.alive&&t.broken){t.av+=K(u).extend;if(t.reformAt!==null&&t.reformAt!==undefined)t.reformAt+=K(u).extend;f.m.extended++;}
      },
      ult(f,u){const broken=foesAlive(f).filter(e=>e.broken);(broken.length?broken:[breakTarget(f)]).forEach(e=>strike(f,u,e,K(u).ult,.75,'ult'));}
    },
    Atsa:{
      assess:(f)=>({useful:crewAlive(f).some(a=>a.barrier<a.maxHp*.1),emergency:frontline(f).some(a=>a.hp<a.maxHp*.5)}),
      basic(f,u){basicHit(f,u,breakTarget(f),1);shield(f,u,u,6);},
      skill(f,u){crewAlive(f).forEach(a=>shield(f,u,a,a.maxHp*K(u).skill));},
      ult(f,u){crewAlive(f).forEach(a=>shield(f,u,a,a.maxHp*K(u).ult));}
    },
    Dolores:{
      assess:(f)=>{const t=mostPoisoned(f);return {useful:foesAlive(f).length>0,opportunity:!!t&&t.poison>=5};},
      basic(f,u){const t=poisonTarget(f);basicHit(f,u,t);poison(f,u,t,1);},
      skill(f,u){
        const t=mostPoisoned(f);
        if(t&&t.poison>0)detonate(f,u,t,K(u).detonate,'skill');
        else{const p=poisonTarget(f);strike(f,u,p,K(u).fallback,.5,'skill',{single:true});poison(f,u,p,2);}
      },
      ult(f,u){foesAlive(f).forEach(e=>poison(f,u,e,K(u).ultStacks));const t=mostPoisoned(f);if(t)detonate(f,u,t,K(u).ultDetonate,'ult');}
    },
    Tarn:{
      assess:(f,u)=>({useful:u.barrier<u.maxHp*.2,emergency:u.hp<u.maxHp*.5}),
      basic(f,u){basicHit(f,u);shield(f,u,u,8);},
      skill(f,u){shield(f,u,u,u.maxHp*K(u).skill);u.tauntMul=2;},
      ult(f,u){shield(f,u,u,u.maxHp*K(u).ult);crewAlive(f).forEach(a=>{if(a!==u)shield(f,u,a,K(u).ultAll);});}
    },
    Imke:{
      assess:(f)=>({useful:foesAlive(f).length>0}),
      basic(f,u){basicHit(f,u);},
      skill(f,u){
        const t=f.lastTarget&&f.lastTarget.alive?f.lastTarget:weakest(f);
        strike(f,u,t,K(u).skill,.5,'skill',{single:true});u.pendingDelay-=K(u).advance;
      },
      ult(f,u){const t=toughest(f);strike(f,u,t,K(u).ult,1,'ult',{single:true});if(t&&t.alive)mark(t,2);}
    },
    Navigator:{
      assess:(f)=>({useful:crewAlive(f).some(a=>a.hp<a.maxHp*.8),emergency:crewAlive(f).some(a=>a.hp<a.maxHp*.5)}),
      basic(f,u){basicHit(f,u);},
      skill(f,u){const t=mostHurt(f);if(!t)return;mend(f,u,t,t.maxHp*(K(u).heal+K(u).grow*u.songs));u.songs++;},
      ult(f,u){crewAlive(f).forEach(a=>mend(f,u,a,a.maxHp*(K(u).ult+K(u).grow*u.songs)));}
    }
  };
  function brokenTarget(f){return foesAlive(f).filter(e=>e.broken).sort((a,b)=>a.hp-b.hp)[0];}
  function mostPoisoned(f){return foesAlive(f).filter(e=>e.poison>0).sort((a,b)=>b.poison*b.poisonPer-a.poison*a.poisonPer)[0];}
  // Detonation: the target's remaining poison lands at once, through shields, and the stacks are spent.
  function detonate(f,u,t,mult,kind){
    const dmg=t.poison*t.poisonPer*mult;
    t.poison=0;f.m.detonations++;
    strike(f,u,t,0,0,kind,{flat:dmg/(u.power||1),unsoaked:true,single:true});
  }
  function poisonTarget(f){return foesAlive(f).sort((a,b)=>(a.poison-b.poison)||(b.hp-a.hp))[0];}
  function designated(f){
    const front=frontline(f);
    return front.find(u=>u.id==='Reva')||front.filter(u=>u.id!=='Ilka').sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]||front[0];
  }
  // Arunima spends no more than it takes to clear the current field, as the live Auto does.
  function burstLimit(f,u){
    const foes=foesAlive(f);
    if(!foes.length||f.waveIndex<f.waves.length)return undefined;
    const ekene=f.crew.find(x=>x.id==='Ekene'&&x.alive);
    const need=Math.max(...foes.map(e=>effectiveHp(f,e)))/(u.atk*T.burstPerAether*f.rules.skillMul*(ekene&&f.carry===u?1+K(ekene).buff:1));
    return Math.max(3,Math.ceil(need));
  }

  // ---- Turns ----------------------------------------------------------------------------------------------------
  function resetAv(u){u.av=Math.max(0,wait(u)+u.pendingDelay);u.pendingDelay=0;}
  function ensureWave(f){if(!foesAlive(f).length)spawnWave(f);}

  function crewTurn(f,u){
    u.frozen=false;u.tauntMul=1;u.refundUsed=false;u.reflectBoost=1;
    f.followThisAction=0;f.eagerThisAction=0;f.m.crewTurns++;
    if(f.rules.regen){const before=u.hp;u.hp=Math.min(u.maxHp,u.hp+u.maxHp*f.rules.regen);f.m.regen+=u.hp-before;}
    if(u.discount)u.weaverDiscount=true;
    const kit=KITS[u.id];
    syncPool(f);
    const crew=crewAlive(f);
    const assess=kit.assess(f,u);
    const plan=A.teamPlan(f.aether,u,{...assess,crew,session:f.session,turn:f.allyTurns,canWait:true,
      useful:x=>x===u?!!assess.useful:KITS[x.id].assess(f,x).useful});
    A.recordAction(f.aether,u,plan,f.allyTurns,crew.length);
    f.allyTurns++;
    // A chain striker pays only its opening cost here; each extra turn is paid separately (as in the live resolver).
    const payment=plan.kind==='skill'&&A.profile(u.id).chain?{...plan,cost:A.skillCost(u)}:plan;
    if(plan.kind==='skill'&&A.spend(f.aether,payment)){
      // aether-rules returns `true` rather than a phrase for setup and opening skills.
      const why=typeof plan.reason==='string'?plan.reason:assess.opportunity?'an opening':'setting up';
      log(f,`${u.id} skill (${payment.cost} Aether: ${why})`);
      paid(f,u,payment.cost);
      kit.skill(f,u,payment);
    }else{
      kit.basic(f,u);
      const gain=credit(f,plan.gain||1);
      f.aether.basics++;
      if(f.record&&gain<(plan.gain||1))log(f,`${u.id} basic: Aether full, ${(plan.gain||1)-gain} wasted`);
    }
    if(u.discount)u.weaverDiscount=false;
    charge(f,u,T.energy.act);
    resetAv(u);
    ensureWave(f);
  }

  function fireUltimate(f){
    const u=f.crew.find(a=>a.alive&&!a.frozen&&a.en>=T.energy.cost&&foesAlive(f).length);
    if(!u)return false;
    u.en=0;f.m.ults++;f.followThisAction=0;f.eagerThisAction=0;
    log(f,`${u.id} ultimate`);
    KITS[u.id].ult(f,u);
    ensureWave(f);
    return true;
  }

  function enemyTurn(f,e){
    e.turns++;
    if(e.poison>0){
      const dmg=e.poison*e.poisonPer,dealt=Math.min(e.hp,dmg);
      e.hp-=dmg;f.m.poison+=dealt;f.m.dealt+=dealt;f.m.byKind.poison=(f.m.byKind.poison||0)+dealt;
      if(e.poisonSrc)f.contributions[e.poisonSrc]=(f.contributions[e.poisonSrc]||0)+dealt;
      e.poison=f.rules.poisonDecay==='half'?Math.floor(e.poison/2):e.poison-1;
      if(e.hp<=0){killFoe(f,{id:e.poisonSrc||'Poison'},e);ensureWave(f);return;}
    }
    if(e.broken&&e.skips>0){e.skips--;f.m.skipped++;log(f,`${e.name} is frozen and misses its turn`);resetAv(e);return;}
    if(e.broken){e.broken=false;e.layers=e.maxLayers;e.shieldHp=e.layerHp;e.reformAt=null;log(f,`${e.name} recovers its shield`);}
    if(e.cleanse)foesAlive(f).forEach(o=>{o.poison=Math.floor(o.poison*(1-e.cleanse));});
    if(e.purify)foesAlive(f).forEach(o=>{o.poison=0;o.hp=Math.min(o.maxHp,o.hp+o.maxHp*e.purify);});
    if(e.mend&&e.turns%2===0){const t=foesAlive(f).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(t)t.hp=Math.min(t.maxHp,t.hp+t.maxHp*e.mend);}
    if(e.summonCount&&e.layers>0){
      const adds=foesAlive(f).filter(o=>o.summon).length;
      for(let i=0;i<e.summonCount&&adds+i<6;i++){const s=makeEnemy(f,'chaff',{summon:true});f.foes.push(s);}
    }
    const tgt=enemyTarget(f);
    if(tgt){
      e.attacks++;f.m.enemyAttacks++;
      const heavy=e.heavy&&e.attacks%3===0?e.heavy:1;
      hurtCrew(f,e,tgt,e.atk*heavy*(.92+.16*f.rand()),'attack');
      if(tgt.provoke>0)tgt.provoke--;
    }
    resetAv(e);
  }

  // A board emptied in the same action that downs the last front-liner is a clear, so the clear is checked first.
  function checkEnd(f){
    const empty=!foesAlive(f).length;
    if(empty&&f.waveIndex>=f.waves.length){f.end='cleared';return true;}
    if(!f.crew.length||!frontline(f).length){f.end='wiped';return true;}
    if(empty)spawnWave(f);
    return false;
  }

  function fight(spec){
    const f=createFight(spec);
    let steps=0;
    while(!f.end&&steps++<5000){
      if(checkEnd(f))break;
      if(fireUltimate(f))continue;
      const units=[...crewAlive(f),...foesAlive(f)];
      const actor=units.reduce((a,b)=>b.av<a.av?b:a);
      const dt=Math.max(0,actor.av);
      if(f.t+dt>f.limit){f.t=f.limit;f.end='time';break;}
      f.t+=dt;units.forEach(u=>{u.av-=dt;});
      reformDue(f);
      if(actor.side==='crew')crewTurn(f,actor);else enemyTurn(f,actor);
    }
    if(!f.end)f.end='time';
    return result(f);
  }

  function score(f){
    if(f.end==='cleared')return 1;
    const total=f.waves.flat().reduce((sum,w)=>sum+(w.boss?BOSSES[w.kind].points:w.elite?4:ENEMIES[w.kind].points),0);
    const done=f.pool.reduce((sum,e)=>sum+e.points*(1-Math.max(0,e.hp)/e.maxHp),0);
    return Math.min(.999,total?done/total:0);
  }
  function result(f){
    const s=score(f);
    syncPool(f);
    return {score:s,outcome:f.end,av:Math.round(f.t),band:band(s).id,metrics:f.m,
      contributions:Object.fromEntries(Object.entries(f.contributions).map(([k,v])=>[k,Math.round(v)])),
      crew:f.crew.map(u=>({id:u.id,hp:Math.round(u.hp),maxHp:u.maxHp,alive:u.alive})),
      aether:{max:f.aether.max,spent:f.m.aetherSpent,generated:f.m.aetherGenerated,wasted:f.m.aetherWasted},
      reports:f.affixes.map(id=>({id,name:AFFIXES[id].name,text:AFFIXES[id].report(f.m)})),
      log:f.record?f.log:undefined};
  }

  // ---- The Brief ------------------------------------------------------------------------------------------------
  // The voyage writes the text, the player picks the weight: `count` affixes are drawn within the category caps.
  // Compatibility (modifiers.md: "the pair simply never draws together"). A card that `requires` something never shares
  // a Brief with one that `removes` it, so no card contradicts another or loses its gift. Two cards that `touch` the same
  // number never stack either: that is how "the gods problem" slips past the category caps.
  function removedBy(ids){return new Set(ids.flatMap(id=>AFFIXES[id].removes||[]));}
  function conflicts(ids){
    const gone=removedBy(ids),first={},out=new Set();
    ids.forEach(id=>{if((AFFIXES[id].requires||[]).some(r=>gone.has(r)))out.add(id);});
    ids.forEach(id=>(AFFIXES[id].touches||[]).forEach(t=>{if(first[t]){out.add(first[t]);out.add(id);}else first[t]=id;}));
    return ids.filter(id=>out.has(id));
  }
  function bossFits(boss,affixes){const gone=removedBy(affixes);return !(BOSSES[boss].requires||[]).some(r=>gone.has(r));}
  function legalStack(ids){
    const used={};
    for(const id of ids){const c=AFFIXES[id].category;used[c]=(used[c]||0)+1;if(used[c]>CAPS[c])return false;}
    return new Set(ids).size===ids.length&&conflicts(ids).length===0;
  }
  function legalBrief(b){
    return !!b&&Array.isArray(b.affixes)&&Array.isArray(b.bosses)&&b.affixes.every(id=>AFFIXES[id])&&legalStack(b.affixes)&&
      b.bosses.length===3&&new Set(b.bosses).size===3&&b.bosses.every(id=>BOSSES[id]&&bossFits(id,b.affixes));
  }
  function rollBrief(seed,count=2,options={}){
    const rand=rng(hash(seed,'brief'));
    const pool=shuffled(Object.keys(AFFIXES).filter(id=>!(options.exclude||[]).includes(id)),rand);
    const fittingBosses=ids=>Object.keys(BOSSES).filter(b=>bossFits(b,ids));
    const affixes=[];
    for(const id of pool){
      if(affixes.length>=count)break;
      const next=[...affixes,id];
      if(legalStack(next)&&fittingBosses(next).length>=3)affixes.push(id);
    }
    const bosses=shuffled(fittingBosses(affixes),rand).slice(0,3);
    return {affixes,bosses};
  }

  // ---- Session: requisition, supply and the route --------------------------------------------------------------
  function voucherPrice(berths){return berths>=ECON.maxBerths?null:ECON.voucher[berths+1];}
  function rollOffers(s){
    const rand=rng(hash(s.seed,'supply',s.stop,s.rerolls));
    return shuffled(Object.keys(GEAR),rand).slice(0,ECON.offers);
  }
  function createSession(options={}){
    const seed=(options.seed===undefined?Date.now():options.seed)>>>0;
    const brief=options.brief||rollBrief(seed,options.affixCount===undefined?2:options.affixCount);
    const s={version:1,lab:'affix-team-building',seed,brief:{affixes:brief.affixes.slice(),bosses:brief.bosses.slice()},
      phase:'draft',stop:0,battle:0,gold:ECON.startGold,integrity:ECON.startIntegrity,berths:ECON.startCrew,crew:[],gear:{},stash:[],
      offers:[],rerolls:0,results:[],purchases:[],history:[],plan:options.plan||'',startedAt:options.now||null};
    s.offers=rollOffers(s);
    return s;
  }
  function nextBattle(s){
    const r=ROUTE[s.battle];
    if(!r)return null;
    return {...r,boss:r.format==='boss'?s.brief.bosses[r.sector-1]:null};
  }
  function battleSpec(s,extra={}){
    const b=nextBattle(s);
    return {crew:s.crew.map(id=>({id,gear:(s.gear[id]||[]).slice()})),affixes:s.brief.affixes,
      encounter:{format:b.format,boss:b.boss,sector:b.sector},scale:b.scale,seed:hash(s.seed,'battle',s.battle),...extra};
  }
  function canLaunch(s){
    if(s.phase!=='ops')return 'Choose your two starting crew first.';
    if(!s.crew.some(id=>ROSTER[id].row==='front'))return 'Field at least one front-row crewmate.';
    return null;
  }
  function act(s,a){
    const fail=msg=>({ok:false,message:msg}),ok=msg=>({ok:true,message:msg});
    if(s.phase==='done')return fail('This session is over.');
    switch(a.type){
      case 'recruit':{
        if(!ROSTER[a.id])return fail('Unknown crewmate.');
        if(s.crew.includes(a.id))return fail(`${a.id} is already aboard.`);
        if(s.crew.length>=s.berths)return fail('Every berth is full. Buy a voucher or release someone.');
        s.crew.push(a.id);s.gear[a.id]=s.gear[a.id]||[];
        s.purchases.push({stop:s.stop,type:'recruit',id:a.id});
        if(s.phase==='draft'&&s.crew.length>=ECON.startCrew)s.phase='ops';
        return ok(`${a.id} joins the crew.`);
      }
      // Recruit straight from the roster: uses a free berth, or buys the next voucher first. Nothing is spent on failure.
      case 'hire':{
        if(s.phase!=='ops'||s.crew.length<s.berths)return act(s,{type:'recruit',id:a.id});
        if(!ROSTER[a.id])return fail('Unknown crewmate.');
        if(s.crew.includes(a.id))return fail(`${a.id} is already aboard.`);
        const price=voucherPrice(s.berths);
        if(price===null)return fail('All six berths are full. Release someone to swap.');
        if(s.gold<price)return fail(`Opening berth ${s.berths+1} costs ${price} gold.`);
        const opened=act(s,{type:'voucher'}),joined=act(s,{type:'recruit',id:a.id});
        return ok(`${opened.message} ${joined.message}`);
      }
      case 'release':{
        if(s.phase==='draft'||!s.crew.includes(a.id))return fail('Not aboard.');
        s.stash.push(...(s.gear[a.id]||[]));delete s.gear[a.id];
        s.crew=s.crew.filter(id=>id!==a.id);
        s.purchases.push({stop:s.stop,type:'release',id:a.id});
        return ok(`${a.id} leaves; their equipment returns to the hold.`);
      }
      case 'voucher':{
        const price=voucherPrice(s.berths);
        if(price===null)return fail('All six berths are open.');
        if(s.gold<price)return fail(`A voucher costs ${price} gold.`);
        s.gold-=price;s.berths++;
        s.purchases.push({stop:s.stop,type:'voucher',price,berths:s.berths});
        return ok(`Berth ${s.berths} opened for ${price} gold.`);
      }
      case 'buy':{
        const id=s.offers[a.index];
        if(!id)return fail('Nothing in that slot.');
        if(s.gold<ECON.gearPrice)return fail(`Equipment costs ${ECON.gearPrice} gold.`);
        s.gold-=ECON.gearPrice;s.offers[a.index]=null;s.stash.push(id);
        s.purchases.push({stop:s.stop,type:'gear',id,price:ECON.gearPrice});
        return ok(`${GEAR[id].name} is in the hold.`);
      }
      case 'reroll':{
        const price=ECON.reroll(s.rerolls);
        if(s.gold<price)return fail(`A reroll costs ${price} gold.`);
        s.gold-=price;s.rerolls++;s.offers=rollOffers(s);
        s.purchases.push({stop:s.stop,type:'reroll',price});
        return ok('New equipment in the supply.');
      }
      case 'equip':{
        const i=s.stash.indexOf(a.gear);
        if(i<0)return fail('That item is not in the hold.');
        if(!s.crew.includes(a.id))return fail('Not aboard.');
        if((s.gear[a.id]||[]).length>=ECON.slots)return fail(`${a.id} has no free slot.`);
        s.stash.splice(i,1);s.gear[a.id].push(a.gear);
        return ok(`${GEAR[a.gear].name} fitted to ${a.id}.`);
      }
      case 'unequip':{
        const list=s.gear[a.id]||[],i=list.indexOf(a.gear);
        if(i<0)return fail('Not fitted.');
        list.splice(i,1);s.stash.push(a.gear);
        return ok(`${GEAR[a.gear].name} returned to the hold.`);
      }
      case 'sell':{
        const i=s.stash.indexOf(a.gear);
        if(i<0)return fail('That item is not in the hold.');
        s.stash.splice(i,1);s.gold+=ECON.sellValue;
        s.purchases.push({stop:s.stop,type:'sell',id:a.gear,price:-ECON.sellValue});
        return ok(`Sold for ${ECON.sellValue} gold.`);
      }
      case 'launch':{
        const blocked=canLaunch(s);
        if(blocked)return fail(blocked);
        // `parts` lets the sim apply only a tax or a gift ({frost:'tax'}); explain replays inherit it through the spec.
        const b=nextBattle(s),spec=battleSpec(s,{record:!!a.record,affixParts:a.parts});
        const r=fight(spec),bd=band(r.score),sectorMul=[1,1.2,1.4][b.sector-1];
        // Opt-in, like `record`: the same battle, same seed, without each condition in turn, so the report can say which
        // ones decided it (and which helped). Off by default because the sim launches thousands of battles.
        if(a.explain)r.reports.forEach(rep=>{rep.without=fight({...spec,record:false,affixes:spec.affixes.filter(id=>id!==rep.id)}).score;});
        const integrity=Math.round(bd.integrity*(bd.integrity<0?sectorMul:1));
        const upkeep=ECON.upkeep*Math.max(0,s.crew.length-ECON.upkeepFree);
        const gold=Math.max(0,ECON.income+bd.gold+(b.format==='boss'?ECON.bossBonus:0)-upkeep);
        s.integrity=Math.max(0,Math.min(100,s.integrity+integrity));
        s.gold+=gold;
        const entry={battle:s.battle,sector:b.sector,format:b.format,boss:b.boss,score:r.score,outcome:r.outcome,band:bd.id,integrity,gold,upkeep,
          crew:s.crew.slice(),gear:JSON.parse(JSON.stringify(s.gear)),reports:r.reports,contributions:r.contributions};
        s.results.push(entry);
        s.history.push({stop:s.stop,crew:s.crew.slice(),berths:s.berths,gold:s.gold});
        s.battle++;s.stop++;s.rerolls=0;s.offers=rollOffers(s);
        if(s.battle>=ROUTE.length||s.integrity<=0)s.phase='done';
        return {ok:true,message:`${bd.label}: ${Math.floor(r.score*100+1e-9)}%`,result:r,entry};
      }
      default:return fail('Unknown action.');
    }
  }

  const api={T,ECON,BANDS,FAMILIES,ROSTER,ENEMIES,BOSSES,FORMATS,ROUTE,AFFIXES,CAPS,GEAR,KITS,KIT_NUMBERS,
    hash,rng,band,fight,legalStack,legalBrief,bossFits,conflicts,rollBrief,gearFits,voucherPrice,rollOffers,createSession,nextBattle,battleSpec,canLaunch,act};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.AffixLab=api;
})(typeof window!=='undefined'?window:globalThis);
