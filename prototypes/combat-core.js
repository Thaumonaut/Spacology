/* ============================================================================
   Spacology combat core — the live combat rules, shared by watchable-fight.html
   and headless runners.

   Extracted verbatim from watchable-fight.html: no rule changed in the move, and
   tests/browser/combat-core-parity.cjs proves it action by action. This is a
   classic script, not a module: it declares the same globals the page always
   had (G is still the page's), so the page behaves exactly as before.

   The rules call a few page functions to redraw or log. A headless host must
   define them (no-ops are fine): clr, pxClear, log, ribbons, paintAll, track,
   chainNote, aiNote, injNote, updateEnemyCounter, reflowFoes, paintTreasure,
   and the page globals G, playing, busy.

   Host surface: rng() / COMBAT_RNG (every rule draw; inject a source or leave
   Math.random), rngFree(fn) for displays that call rule helpers, and
   voyageEncounter(state) + applyVoyageEncounter(enc) to set up a voyage battle
   from a voyage state exactly as the page does. COMBAT_HOOKS listens to the
   fight, COMBAT_RULES changes it per fight, enemyAttack() adds an enemy attack
   from a hook, u.frozen passes a crewmate's turns, and G.metrics counts what the
   rest of G does not. All are described where they are declared; unset, they
   change nothing (tests/unit/combat-hooks.cjs).
   ============================================================================ */

/* ---- Data: constants, prototype teams, tags, targeting profiles, enemy kits (watchable-fight.html, lines 432–656 before extraction) ---- */
/* ============ data ============ */
var EL={order:'#7FA8C9',chaos:'#C97F9E',growth:'#8FB878',
        void:'#8F8FC9',decay:'#A89070',energy:'#D4A45C'};
var HEALC='#4FD97F', CARRY=true;
var MAXROUND=14, SHLAYERS=2, SHPER=14, UNMATCHED=0.2, SOAK=0.4;
var DEATHCOST=2, INJURY=0.65;
var EN={act:18,perHit:7,taken:9,cost:100};
var INJURED={};
var BRK={delay:.35,vuln:.35,vdur:2,regen:2}, HARM=.6;

var PLANETS={
  order:{n:'Bastion',weak:[['order','decay'],['order','energy'],['order','void']]},
  pairish:{n:'Cairn',weak:[['order','growth'],['energy','chaos'],['growth','decay']]},
  spread:{n:'Verge',weak:[['order','chaos'],['growth','void'],['decay','energy']]},
  away:{n:'The Hollows',weak:[['decay','void'],['energy','decay'],['void','chaos']]}
};
function isWeak(u,el){ return !!(u.weak && u.weak.indexOf(el)>=0); }
function coverage(team,planet){
  var els={}; TEAMS[team].crew.forEach(function(c){els[c.e]=1});
  var slots=0, hit=0, enemies=0, covered=0;
  PLANETS[planet].weak.forEach(function(w){
    enemies++; var any=false;
    w.forEach(function(e){ slots++; if(els[e]){hit++; any=true;} });
    if(any) covered++;
  });
  return {slots:slots,hit:hit,enemies:enemies,covered:covered,
          pct:Math.round(hit/slots*100)};
}
var TEAMS={
  bloom:{note:'<b>Bloom</b> \u2014 Blight\u00d75. Seeders coat the board, igniters set it off, '+
    'and at four Blight the Bloom joins the turn order and detonates everything.',
    crew:[
      {n:'Ash',e:'decay',sp:100,dmg:9,aoe:1,frac:2,shred:16,tags:['Blight'],p:'breaker',row:'front',
       bio:'Xeno-chemist. Aerosolises samples and lets the wind do the rest.',
       ult:{kind:'aoe',mult:3.0,frac:2,name:'Scatterfall'}},
      {n:'Cinder',e:'energy',sp:94,dmg:14,frac:3,tags:['Blight','Ordnance'],p:'finisher',row:'front',
       bio:'Reactor tech. Everything she touches keeps burning after she leaves.',
       ult:{kind:'nuke',mult:3.0,name:'Flashpoint'}},
      {n:'Pyre',e:'chaos',sp:92,dmg:13,detonate:1,tags:['Blight'],p:'finisher',row:'front',
       bio:'Demolitions. Waits for the pile to get big enough, then lights it.',
       ult:{kind:'nuke',mult:2.6,eat:2.2,name:'Unmaking'}},
      {n:'Sump',e:'growth',sp:98,dmg:10,frac:1,heal:20,over:1,tags:['Blight','Crew'],
       p:'opportunist',row:'back',
       bio:'Field biologist. Corruption jumps hosts when one dies; she counts on it.',
       ult:{kind:'mend',amt:28,barrier:18,name:'Bloomtide'}},
      {n:'Quill',e:'void',sp:110,dmg:10,marks:3,tags:['Blight','Assay'],p:'breaker',row:'back',
       bio:'Xeno-botanist. Marks every enemy before she attacks.',
       ult:{kind:'aoe',mult:2.2,survey:3,name:'Full Survey'}},
      {n:'Fen',e:'order',sp:106,dmg:7,heal:30,tags:['Crew'],p:'opportunist',row:'back',
       bio:'Ship medic. Treats the crew like equipment: patched before it fails.',
       ult:{kind:'mend',amt:32,name:'Field Kit'}}]},

  plate:{note:'<b>Plate and payback</b> \u2014 Hull\u00d74. Tarn drags every attack onto '+
    'herself; at four Hull the barriers stop absorbing and start answering.',
    crew:[
      {n:'Tarn',e:'order',sp:82,dmg:9,hp:78,reflect:4.4,taunt:6,tags:['Hull','Ordnance'],
       p:'bully',row:'front',
       bio:'Wears the ship\u2019s old boarding plate. Steps in front of everything.',
       ult:{kind:'lash',mult:2.4,name:'Recoil'}},
      {n:'Ballast',e:'growth',sp:74,dmg:16,hp:190,taunt:3,drain:.3,tags:['Hull'],
       p:'bully',row:'front',
       bio:'Was cargo crew. Absorbs punishment and keeps walking.',
       ult:{kind:'lash',mult:2.2,name:'Deadweight'}},
      {n:'Ferrule',e:'decay',sp:88,dmg:15,heal:16,over:1,tags:['Hull','Ordnance'],
       p:'breaker',row:'front',
       bio:'Welder. Throws plating over whoever is nearest when she swings.',
       ult:{kind:'nuke',mult:3.0,name:'Seam Split'}},
      {n:'Wex',e:'chaos',sp:104,dmg:10,heal:34,over:1,tags:['Hull','Crew'],
       p:'opportunist',row:'back',
       bio:'Hull tech. Patches things before they fail, including people.',
       ult:{kind:'mend',amt:26,barrier:30,name:'Overplate'}},
      {n:'Corr',e:'void',sp:84,dmg:26,tags:['Ordnance'],p:'finisher',row:'back',
       bio:'Ship\u2019s gunner. One target. One number.',
       ult:{kind:'nuke',mult:3.2,name:'Arc Collapse'}},
      {n:'Mire',e:'energy',sp:100,dmg:11,heal:24,over:1,reflect:.5,tags:['Crew','Hull'],
       p:'opportunist',row:'back',
       bio:'Navigator. Calm, unhurried, hits back without seeming to notice.',
       ult:{kind:'mend',amt:28,barrier:20,name:'Slack Water'}}]},

  ledger:{note:'<b>The Ledger</b> \u2014 Assay\u00d74. Quill and Vitre write targets down; '+
    'everyone else answers. At four Assay a break costs the enemy two turns.',
    crew:[
      {n:'Ledger',e:'order',sp:96,dmg:14,react:2,trig:'mark',ratio:.8,tags:['Assay','Drive'],
       p:'finisher',row:'front',
       bio:'Ship archivist. Hates away missions, brought a rifle anyway.',
       ult:{kind:'nuke',mult:3.2,name:'Final Entry'}},
      {n:'Maul',e:'decay',sp:70,dmg:21,react:1,trig:'break',ratio:2.2,tags:['Assay','Ordnance'],
       p:'bully',row:'front',
       bio:'Waits for something to crack, then puts everything into the gap.',
       ult:{kind:'nuke',mult:3.0,name:'Deadweight'}},
      {n:'Rime',e:'void',sp:98,dmg:10,aoe:1,shred:24,tags:['Assay'],p:'breaker',row:'front',
       bio:'Cryo-analyst. Freezes a shell until it fractures on its own.',
       ult:{kind:'aoe',mult:2.8,name:'Hoarfrost'}},
      {n:'Quill',e:'growth',sp:110,dmg:10,marks:3,tags:['Assay','Blight'],p:'breaker',row:'back',
       bio:'Xeno-botanist. Marks every enemy before she attacks.',
       ult:{kind:'aoe',mult:2.2,survey:3,name:'Full Survey'}},
      {n:'Vitre',e:'chaos',sp:108,dmg:9,marks:2,aoe:1,shred:13,tags:['Assay','Drive'],
       p:'tactician',row:'back',
       bio:'Sensor officer. Paints the whole line at once, lightly.',
       ult:{kind:'aoe',mult:2.4,survey:2,name:'Wide Scan'}},
      {n:'Fen',e:'energy',sp:106,dmg:7,heal:30,tags:['Crew'],p:'opportunist',row:'back',
       bio:'Ship medic. Treats the crew like equipment: patched before it fails.',
       ult:{kind:'mend',amt:32,name:'Field Kit'}}]},

  relay:{note:'<b>Relay</b> \u2014 Drive\u00d74. Nothing here is individually large. '+
    'Every kill throws the next crewmate forward, so the turn order never settles.',
    crew:[
      {n:'Nettle',e:'chaos',sp:120,dmg:9,react:4,trig:'ally',ratio:.42,tags:['Drive'],
       p:'opportunist',row:'front',
       bio:'Too fast, too eager. Fires whenever anyone else does.',
       ult:{kind:'nuke',mult:2.8,name:'Overrun'}},
      {n:'Mote',e:'growth',sp:116,dmg:10,aoe:1,shred:18,tags:['Drive','Assay'],
       p:'breaker',row:'front',
       bio:'Survey drone pilot. Sweeps the line looking for cracks.',
       ult:{kind:'aoe',mult:2.6,name:'Sweep'}},
      {n:'Bosk',e:'decay',sp:80,dmg:18,hp:140,tags:['Ordnance','Hull'],p:'bully',row:'front',
       bio:'Ex-salvage. Enormous, patient, hits like falling cargo.',
       ult:{kind:'nuke',mult:3.0,name:'Deadfall'}},
      {n:'Vane',e:'order',sp:112,dmg:10,kindle:1,tags:['Drive','Crew'],p:'tactician',row:'back',
       bio:'Helm. Reads the flow of a fight and shoves people into it early.',
       ult:{kind:'mend',amt:14,charge:48,name:'Full Ahead'}},
      {n:'Halo',e:'energy',sp:94,dmg:8,kindle:1,tags:['Crew','Drive'],p:'tactician',row:'back',
       bio:'Reactor engineer. Gives away her own power and runs cold doing it.',
       ult:{kind:'mend',amt:16,charge:45,name:'Overdraw'}},
      {n:'Fen',e:'void',sp:106,dmg:7,heal:30,tags:['Crew'],p:'opportunist',row:'back',
       bio:'Ship medic. Treats the crew like equipment: patched before it fails.',
       ult:{kind:'mend',amt:32,name:'Field Kit'}}]},

  found:{note:'<b>Seeders behind a wall</b> \u2014 nobody designed this one. '+
    'The search found it: fragile Blight seeders need time, and a payback carry '+
    'drags every attack onto herself to buy it.',
    crew:[
      {n:'Tarn',e:'order',sp:82,dmg:9,hp:78,reflect:4.4,taunt:6,tags:['Hull','Ordnance'],
       p:'bully',row:'front',
       bio:'Wears the ship\u2019s old boarding plate. Steps in front of everything.',
       ult:{kind:'lash',mult:2.4,name:'Recoil'}},
      {n:'Ferrule',e:'decay',sp:88,dmg:15,heal:16,over:1,tags:['Hull','Ordnance'],
       p:'breaker',row:'front',
       bio:'Welder. Throws plating over whoever is nearest when she swings.',
       ult:{kind:'nuke',mult:3.0,name:'Seam Split'}},
      {n:'Ash',e:'chaos',sp:100,dmg:9,aoe:1,frac:2,shred:16,tags:['Blight'],p:'breaker',row:'front',
       bio:'Xeno-chemist. Aerosolises samples and lets the wind do the rest.',
       ult:{kind:'aoe',mult:3.0,frac:2,name:'Scatterfall'}},
      {n:'Sump',e:'growth',sp:98,dmg:10,frac:1,heal:20,over:1,tags:['Blight','Crew'],
       p:'opportunist',row:'back',
       bio:'Field biologist. Corruption jumps hosts when one dies.',
       ult:{kind:'mend',amt:28,barrier:18,name:'Bloomtide'}},
      {n:'Pyre',e:'void',sp:92,dmg:13,detonate:1,tags:['Blight'],p:'finisher',row:'back',
       bio:'Demolitions. Waits for the pile to get big enough, then lights it.',
       ult:{kind:'nuke',mult:2.6,eat:2.2,name:'Unmaking'}},
      {n:'Wex',e:'energy',sp:104,dmg:10,heal:34,over:1,tags:['Hull','Crew'],
       p:'opportunist',row:'back',
       bio:'Hull tech. Patches things before they fail, including people.',
       ult:{kind:'mend',amt:26,barrier:30,name:'Overplate'}}]},

  flat:{note:'<b>Flat</b> \u2014 six units, no tag past two. The control.',
    crew:[
      {n:'Corr',e:'void',sp:84,dmg:26,tags:['Ordnance'],p:'finisher',row:'front',
       ult:{kind:'nuke',mult:3.0,name:'Strike'}},
      {n:'Bosk',e:'decay',sp:80,dmg:18,hp:140,tags:['Ordnance','Hull'],p:'bully',row:'front',
       ult:{kind:'nuke',mult:3.0,name:'Strike'}},
      {n:'Rime',e:'order',sp:98,dmg:10,aoe:1,shred:24,tags:['Assay'],p:'breaker',row:'front',
       ult:{kind:'aoe',mult:2.8,name:'Sweep'}},
      {n:'Vane',e:'chaos',sp:112,dmg:10,kindle:1,tags:['Drive','Crew'],p:'tactician',row:'back',
       ult:{kind:'mend',amt:14,charge:48,name:'Full Ahead'}},
      {n:'Quill',e:'growth',sp:110,dmg:10,marks:3,tags:['Assay','Blight'],p:'breaker',row:'back',
       ult:{kind:'aoe',mult:2.2,survey:3,name:'Full Survey'}},
      {n:'Fen',e:'energy',sp:106,dmg:7,heal:30,tags:['Crew'],p:'opportunist',row:'back',
       ult:{kind:'mend',amt:32,name:'Field Kit'}}]}
};
var TAGS={
  Hull:    {2:'barriers 45% larger',
            4:'AMMUNITION \u2014 what a barrier swallows is returned to the attacker'},
  Blight:  {2:'one extra stack per application',
            4:'BLOOM \u2014 joins the turn order, dragged forward by Blight actions'},
  Drive:   {2:'the crew act 12% sooner',
            4:'RELAY \u2014 a kill advances the next crewmate'},
  Ordnance:{2:'20% more damage',
            4:'OVERSTRIKE \u2014 a hit that breaks a shield lands twice'},
  Assay:   {2:'shield damage +60%',
            4:'DISSECTION \u2014 break costs the enemy two turns'},
  Crew:    {2:'healing 50% stronger',
            4:'RELIEF \u2014 the first crew member to fall is brought back'}
};
var TAGCOL={Hull:'#7FA8C9',Blight:'#A89070',Drive:'#D4A45C',
            Ordnance:'#C97F9E',Assay:'#8F8FC9',Crew:'#8FB878'};
var PROFILES={
  finisher:  {focus:2.8,kill:3.4,brk:1.0,vuln:1.8,threat:0.4,bulk:0.3,waste:2.4,match:0.8,
              piled:2.2,label:'goes for the throat'},
  breaker:   {focus:2.2,kill:1.0,brk:3.6,vuln:0.6,threat:0.8,bulk:0.4,waste:0.6,match:2.0,
              piled:1.6,label:'cracks shields'},
  tactician: {focus:2.2,kill:1.4,brk:1.8,vuln:0.8,threat:3.0,bulk:0.2,waste:0.8,match:1.0,
              piled:2.4,label:'plays the clock'},
  bully:     {focus:2.4,kill:1.2,brk:0.8,vuln:1.2,threat:0.5,bulk:2.6,waste:1.8,match:0.6,
              piled:1.4,label:'hits the biggest thing'},
  opportunist:{focus:2.4,kill:1.8,brk:0.5,vuln:3.2,threat:0.6,bulk:0.5,waste:1.2,match:0.5,
              piled:2.0,label:'piles onto the exposed'}
};
var UNIFORM={focus:2.6,kill:2.0,brk:2.0,vuln:1.6,threat:1.2,bulk:0.8,waste:1.4,match:1.2,
             piled:1.8,label:'balanced'};
var AIMODE='profile', RETARGET='random', CHAINCAP=12, CHAINSTAGE=2;
var ELITES=[{n:'Warden',sp:98,hp:150,dmg:19,layers:3,guard:22,trait:'Fortified'},
            {n:'Anchor',sp:120,hp:135,dmg:22,layers:2,guard:20,haste:.1,cap:4,trait:'Accelerates'},
            {n:'Bulwark',sp:82,hp:185,dmg:26,layers:3,guard:24,trait:'Heavy armor'}];
var ENEMY_KITS={
  Summoner:{n:'Summoner',sp:100,hp:88,dmg:10,layers:1,guard:16,trait:'Summons reinforcements'},
  Chaff:{n:'Chaff',sp:100,hp:52,dmg:11,layers:1,guard:18,trait:'Soldier'},
  Bruiser:{n:'Bruiser',sp:90,hp:66,dmg:15,layers:1,guard:20,haste:.12,cap:5,trait:'Accelerates'},
  Quickstep:{n:'Quickstep',sp:158,hp:45,dmg:9,layers:1,guard:16,trait:'Fast'},
  Cleanser:{n:'Cleanser',sp:108,hp:58,dmg:11,layers:1,guard:18,cleanse:2,trait:'Sheds 2 fracture'},
  Reflector:{n:'Reflector',sp:94,hp:56,dmg:12,layers:2,guard:18,trait:'Plated'},
  Sapper:{n:'Sapper',sp:112,hp:50,dmg:13,layers:1,guard:17,trait:'Disruptor'},
  Mender:{n:'Mender',sp:96,hp:62,dmg:10,layers:2,guard:18,trait:'Restorative'}
};
var OPS_SPEED=1, OPS_GUARD=1, OPS_RECOVERY=.25;
var CHAFFNAMES=['Chaff','Bruiser','Cleanser','Reflector','Quickstep','Chaff','Bruiser','Cleanser','Reflector'];
var FIELD=6, POOL=12, OPS_PRESSURE=1, OPS_HP=1, OPS_DMG=1, OPS_WAVES=2, OPS_RUN_ROUND=1;
var OPS_FACTION='ossuary',OPS_PLANET=null,OPS_NODE=null;
var FACTION_ORDER=['ossuary','mycelial','glasswake','tideworn','tannhul','custodian','redaction'];
// Every random draw the rules make goes through rng(). A host may inject its own source (COMBAT_RNG); otherwise
// Math.random. Displays that call rule helpers (an Aether preview, say) use rngFree() so they never shift the fight.
var COMBAT_RNG=null;
function rng(){return COMBAT_RNG?COMBAT_RNG():Math.random()}
function rngFree(fn){var prev=COMBAT_RNG;COMBAT_RNG=function(){return .5};try{return fn()}finally{COMBAT_RNG=prev}}
// Hooks: a host may listen to the fight. COMBAT_HOOKS maps an event name to a listener, or a list of them, called as
// listener(payload, api). Unset, nothing is emitted and the fight is unchanged. Payloads carry live units, so a listener
// may act on them (u.av+=60, u.frozen=1); u.av on the unit whose turn it is moves its next turn (foldPendingDelay), and
// a unit moved below 0 acts next. Each emit site says which payload fields it reads back. Status damage names
// the live enemy that applied it as src, even after it fell (enemyAttack refuses a fallen enemy).
//   spend          {actor, amount, pool, kind}       after an Aether payment ('skill', or 'continuation' for Silen)
//   gain           {actor, amount, pool, source}     before an Aether credit; amount may be set to any whole number from
//                                                    0 up. What is taken away is reported on the action's event
//                                                    (reportRefused).
//                                                    Stolen Aether a Broken thief returns (enemy-traits.js) is not seen.
//   outgoing       {src, tgt, kind, single, amount}  before mitigation; a listener either changes amount or returns a
//                                                    factor, not both (p=>p.amount*=2 returns the new amount, which
//                                                    would then multiply again). Every listener's factor applies.
//   afterHit       {src, tgt, kind, single, broke, dmg, absorbed, killed, hit}   after every hit that landed
//   break          {src, tgt}                        when an enemy's last shield layer falls
//   afterIncoming  {src, tgt, kind, dmg, absorbed, hit}   after an enemy's hit on a crewmate landed
// kind: basic, skill (the kit action: a paid skill in voyage fights, every turn in prototype fights), ult, follow,
// chain (Harmony and overstrike hits after a Break), reflect, transfer (a guard intercepting), attack (an enemy's
// turn), or a status's own name for status damage. single: true only for a crewmate's basic, skill or ult on the
// action's one target; area hits, extra targets, follow-ups, chains and every enemy hit are not single.
// The api: {G, rules, enemyAttack, U, liveFoes, livingCrew, rng}.
var COMBAT_HOOKS=null;
// Per-fight rules a host may change. The defaults change nothing. healMul and barrierMul scale what the crew restores
// and grants; enemyAtkMul scales enemy damage; reformDelay adds AV before a Broken enemy reforms (below 0 it reforms
// sooner, but never sooner than now); layerDelta adds enemy shield layers (or removes them, down to one) to every
// enemy that enters, except the treasure carrier, which keeps its single layer.
var COMBAT_RULES={healMul:1,barrierMul:1,enemyAtkMul:1,reformDelay:0,layerDelta:0};
// Healing and barriers the crew gives pass through these. At the default 1 they return their input untouched.
function healAmount(x){return COMBAT_RULES.healMul===1?x:Math.round(x*COMBAT_RULES.healMul)}
function barrierAmount(x){return COMBAT_RULES.barrierMul===1?x:Math.round(x*COMBAT_RULES.barrierMul)}
function countHeal(u,before){if(G.metrics&&u.hp>before)G.metrics.healed+=u.hp-before}
function countBarrier(u,before){if(G.metrics&&u.bar>before)G.metrics.barrier+=u.bar-before}
function combatHooked(name){var h=COMBAT_HOOKS&&COMBAT_HOOKS[name];return typeof h==='function'||Array.isArray(h)&&h.length>0}
function combatEmit(name,payload){
  if(!combatHooked(name))return undefined;
  var api={G:G,rules:COMBAT_RULES,enemyAttack:enemyAttack,U:U,liveFoes:liveFoes,livingCrew:livingCrew,rng:rng},factor;
  // Every listener's returned factor applies: the product of the finite numbers returned (each at least 0), else undefined.
  [].concat(COMBAT_HOOKS[name]).forEach(function(listener){
    var r=listener(payload,api);
    if(typeof r==='number'&&isFinite(r))factor=(factor===undefined?1:factor)*Math.max(0,r);
  });
  return factor;
}
function enemyKitFor(archetype){
  var traitKit=SpacologyEnemyTraits.kit(archetype);if(traitKit)return traitKit;
  var label=window.SpacologyEnemyCatalogue&&window.SpacologyEnemyCatalogue.ARCHETYPES[archetype]
    ?window.SpacologyEnemyCatalogue.ARCHETYPES[archetype].label:'Chaff';
  return ENEMY_KITS[label]||ELITES.filter(function(kit){return kit.n===label})[0]||ENEMY_KITS.Chaff;
}

/* ---- Battle setup (watchable-fight.html, lines 790–876 before extraction) ---- */
function build(team,planet){
  clr(); pxClear(); playing=false; busy=false;
  $('bPlay').textContent='Play'; $('hState').textContent='ready'; $('log').innerHTML='';
  $('stats').innerHTML='';
  var t=TEAMS[team], pl=PLANETS[planet];
  G={team:team,planet:planet,round:1,av:0,over:false,units:[],wave:0,totalWaves:Math.ceil(POOL/FIELD),ship:Object.assign({},t.ship||{}),
     allyTurns:0,advances:0,advanceSaved:0,shieldedHits:0,alliedHits:0,breaks:0,chains:0,longest:1,supp:0,foeTurns:0,foeAttacks:0,recoveries:0,dealt:{},actions:0,
     limit:MAXROUND,deaths:0,heals:0,drains:0,lowest:100,downed:[],ults:0,biggest:0,
     pending:null,react:{},follows:0,doubles:0,firstMageSummon:true};
  // Counters the rest of G does not keep: damage dealt by kind, what the crew healed, shielded and took, and Aether.
  // lowestHp is the lowest health a crewmate (not a summon) reached: their starting health, then lowered by every hit,
  // so a crewmate who goes down reaches 0, revived or not, and a last stand reaches 1. null with no crew. (G.lowest is
  // the page's own figure: it starts at 100 whatever the crew's health.)
  G.metrics={byKind:{},healed:0,barrier:0,taken:0,absorbed:0,aetherRefused:0,aetherPeak:0,lowestHp:null};
  t.crew.forEach(function(c,i){
    var hurt = CARRY && INJURED[c.n];
    var unitHp=window.SPACOLOGY_SESSION?(c.hp||100):100;
    G.units.push({id:'a'+i,side:'ally',n:c.n,e:c.e,sp:c.sp,
      dmg:Math.round(c.dmg*(hurt?INJURY:1)), heal:c.heal||0, drain:c.drain||0,
      p:c.p||'breaker', aoe:c.aoe||0, frac:c.frac||0, shred:c.shred||0,
      consume:c.consume||0, follow:c.follow||0, reflect:c.reflect||0, taunt:c.taunt||1,
      marks:c.marks||0, react:c.react||0, dbl:c.dbl||0, onFollow:c.onFollow||0,
      trig:c.trig||null, ratio:c.ratio||0.7, hits:c.hits||1, tags:c.tags||[],
      barrierMul:c.barrierMul||1,ultMul:c.ultMul||1,guardMul:c.guardMul||1,
      extraTargets:c.extraTargets||0,spreadExtra:c.spreadExtra||0,openingBoost:c.openingBoost||0,followMul:c.followMul||1,
      bio:c.bio||'', row:c.row||'front', over:c.over||0, kindle:c.kindle||0, bar:0,
      ult:c.ult||null, en:c.startEnergy||0, taken:0,
      hurt:!!hurt, hp:unitHp,max:unitHp,av:Math.max(1,10000/c.sp-(c.startAdvance||0)),alive:true});
    G.dealt[c.n]=0; });
  G.units.forEach(function(u){if(u.side==='ally'&&!u.summon)G.metrics.lowestHp=G.metrics.lowestHp===null?u.hp:Math.min(G.metrics.lowestHp,u.hp)});
  if(window.SPACOLOGY_SESSION)G.aether=SpacologyAether.create(G.units);
  if(G.aether)G.metrics.aetherPeak=G.aether.current;
  G.pool=[]; G.spawned=0;
  G.units=G.units.filter(function(u){return u.side!=='foe'});
  var catalogue=window.SpacologyEnemyCatalogue;
  var faction=catalogue&&catalogue.FACTIONS[OPS_FACTION];
  for(var q=0;q<POOL;q++){
    var wave=Math.floor(q/FIELD)+1,slot=q%FIELD;
    var elite=OPS_NODE?OPS_NODE.format==='elite'&&slot===FIELD-1:slot===FIELD-1&&(wave===G.totalWaves||OPS_RUN_ROUND>=3);
    var eliteTier=elite?(OPS_NODE?OPS_NODE.sector:1+Math.floor((OPS_RUN_ROUND-1)/2)+Math.floor((wave-1)/2)):0;
    var specimen=null,archetype=null,base=null;
    if(faction){
      var eliteRoles=faction.archetypes.filter(function(role){return role==='warden'||role==='anchor'||role==='bulwark'||role==='bruiser'});
      var regularRoles=faction.archetypes.filter(function(role){return !['warden','anchor','bulwark'].includes(role)});
      var roleDeck=elite&&eliteRoles.length?eliteRoles:OPS_NODE?(regularRoles.length?regularRoles:['chaff']):faction.archetypes;
      archetype=OPS_NODE&&OPS_NODE.format==='swarm'?'chaff':OPS_NODE&&OPS_NODE.format==='ambush'?'quickstep':OPS_NODE&&OPS_NODE.format==='boss'?'warden':roleDeck[(q+OPS_RUN_ROUND+wave-2)%roleDeck.length];
      if(OPS_NODE)archetype=SpacologyEnemyTraits.roster({sector:OPS_NODE.sector,format:OPS_NODE.format,index:OPS_RUN_ROUND,wave:wave,size:FIELD,seed:window.SPACOLOGY_SESSION&&window.SPACOLOGY_SESSION.treasureSeed})[slot];
      if(archetype==='summoner'&&(OPS_RUN_ROUND===1||G.pool.some(function(p){return p.wave===wave&&p.archetype==='summoner'})))archetype='chaff';
      specimen=catalogue.generateEnemy('voyage-'+OPS_RUN_ROUND+'-'+OPS_FACTION+'-'+q,{faction:OPS_FACTION,archetype:archetype});
      base=enemyKitFor(archetype);
    }else base=elite?ELITES[(OPS_RUN_ROUND+wave-2)%ELITES.length]:ENEMY_KITS[CHAFFNAMES[(q+OPS_RUN_ROUND-1)%CHAFFNAMES.length]];
    var eliteScale=elite?1.3+(eliteTier-1)*.10:1;
    if(!OPS_NODE)eliteScale=elite?1+(eliteTier-1)*.10:1;
    if(OPS_NODE){
      base=Object.assign({},base);
      if(OPS_NODE.format==='swarm'){base.hp=30;base.dmg=6;base.guard=8;base.layers=1;base.sp=100;}
      if(OPS_NODE.format==='ambush'){base.hp=40;base.dmg=8;base.guard=12;base.layers=1;base.sp=150;}
      if(OPS_NODE.format==='boss'){base.hp=560;base.dmg=23;base.sp=110;base.layers=3;base.guard=24;base.trait='Two phases · heavy strike every third attack';}
    }
    G.pool.push({boss:!!OPS_NODE&&OPS_NODE.format==='boss',n:OPS_NODE&&OPS_NODE.format==='boss'?'Sector '+OPS_NODE.sector+' boss':specimen?specimen.typeName:(elite&&eliteTier>=3?'Prime '+base.n:base.n),sp:Math.round(base.sp*OPS_SPEED),
      hp:Math.round(base.hp*OPS_HP*eliteScale),dmg:Math.round(base.dmg*OPS_DMG*(elite?1+(eliteTier-1)*.1:1)),
      elite:elite,eliteTier:eliteTier,wave:wave,
      archetype:archetype||base.n.toLowerCase(),archetypeName:specimen?specimen.archetypeName:base.n,
      typeName:specimen&&specimen.typeName,specimenName:specimen&&specimen.name,portrait:specimen&&specimen.portrait,
      factionId:specimen&&specimen.faction,factionName:specimen&&specimen.factionName,
      factionRule:specimen&&specimen.factionRule,bodyPlan:specimen&&specimen.bodyPlan,
      material:specimen&&specimen.material,adaptation:specimen&&specimen.adaptation,
      nullStage:specimen&&specimen.nullStage,nullSymptom:specimen&&specimen.nullSymptom,
      guard:Math.round(base.guard*OPS_GUARD),haste:base.haste||0,hasteCap:base.cap||0,cleanse:base.cleanse||0,trait:base.trait,
      weak:pl.weak[q%pl.weak.length].slice(), layers:base.layers+(elite?Math.min(1,Math.floor((eliteTier-1)/2)):0)});
  }
  spawnFoes();
  spawnTreasureCarrier();
  var cov=coverage(team,planet);
  var bios=t.crew.filter(function(c){return c.bio}).map(function(c){
    return '<b>'+c.n+'</b> \u2014 '+c.bio; }).join('<br>');
  $('teamNote').innerHTML=t.note+(bios?'<div style="margin-top:7px;color:var(--ink3);'+
    'line-height:1.6">'+bios+'</div>':'')+
    '<br><span style="color:var(--ink3)">Planet <b>'+
    pl.n+'</b> &mdash; you cover <b>'+cov.hit+' of '+cov.slots+
    '</b> weakness slots ('+cov.pct+'%) across <b>'+cov.covered+' of '+cov.enemies+
    '</b> enemies</span>';
  computeTags();
  G.units.forEach(function(u){ if(u.side!=='ally') return;
    u.dmg=Math.round(u.dmg*G.bon.dmgMul);
    u.sp*=G.bon.speed;
    u.av=u.av/G.bon.speed; });
  ribbons(); paintAll(); track(); injNote(); aiNote(); chainNote(); tagNote();
  log('Round 1','rnd');
  if(window.SPACOLOGY_SESSION)log('Clear every wave before '+G.limit+' combat rounds elapse. Pausing and animation speed do not spend time.','rnd');
  G.units.filter(function(u){return u.hurt}).forEach(function(u){
    log('&nbsp;&nbsp;'+u.n+' is still recovering'); });
  setTimeout(pxResize,50);
}

/* ---- Tags, spawning, summons and treasure (watchable-fight.html, lines 877–984 before extraction) ---- */
function tagCounts(){
  var t={};
  G.units.forEach(function(u){ if(u.side!=='ally') return;
    (u.tags||[]).forEach(function(g){ t[g]=(t[g]||0)+1; }); });
  return t;
}
function computeTags(){
  var t=tagCounts(), T=function(g){return t[g]||0;};
  G.tags=t;
  G.bon={
    barrier:  T('Hull')>=2?1.45:1,
    ammo:     T('Hull')>=4,
    stackUp:  T('Blight')>=2?1:0,
    bloomOn:  T('Blight')>=4,
    speed:    T('Drive')>=2?1.12:1,
    relay:    T('Drive')>=4,
    dmgMul:   T('Ordnance')>=2?1.2:1,
    overstrike:T('Ordnance')>=4,
    shredMul: T('Assay')>=2?1.6:1,
    dissect:  T('Assay')>=4,
    healMul:  T('Crew')>=2?1.5:1,
    relief:   T('Crew')>=4
  };
  G.reliefUsed=!G.bon.relief;
  G.bloom={av:300,base:300,live:G.bon.bloomOn};
  G.blightN=Math.max(1,T('Blight'));
}
function tagNote(){
  var el=$('tagNote'); if(!el) return;
  var t=G.tags||{};
  var parts=Object.keys(TAGS).filter(function(g){return (t[g]||0)>=2}).map(function(g){
    var n=t[g], tier=n>=4?4:2;
    return '<span style="color:'+TAGCOL[g]+'"><b>'+g+'\u00d7'+n+'</b> '+
      TAGS[g][tier]+'</span>';
  });
  el.innerHTML=parts.length?parts.join('<br>'):
    '<span style="color:var(--ink3)">no tag reaches two</span>';
}
function spawnFoes(){
  var live=G.units.filter(function(u){return u.side==='foe'&&u.alive&&!u.treasure}).length;
  var added=[];
  if(live||G.spawned>=G.pool.length) return added;
  G.wave=G.pool[G.spawned].wave;
  while(live<FIELD && G.spawned<G.pool.length&&G.pool[G.spawned].wave===G.wave){
    var p=G.pool[G.spawned];
    G.units.push({boss:p.boss,phase:p.boss?1:undefined,bossAttacks:0,lowestHP:p.hp,id:'f'+G.spawned,side:'foe',n:p.n,weak:p.weak.slice(),e:p.weak[0],
      archetype:p.archetype,archetypeName:p.archetypeName,typeName:p.typeName,specimenName:p.specimenName,portrait:p.portrait,
      factionId:p.factionId,factionName:p.factionName,
      factionRule:p.factionRule,bodyPlan:p.bodyPlan,material:p.material,adaptation:p.adaptation,
      nullStage:p.nullStage,nullSymptom:p.nullSymptom,
      sp:p.sp,baseSp:p.sp,haste:p.haste,hasteCap:p.hasteCap,hasteStacks:0,cleanse:p.cleanse,trait:p.trait,shieldPer:p.guard,dmg:p.dmg,elite:p.elite,eliteTier:p.eliteTier,hp:p.hp,max:p.hp,
      av:10000/p.sp*(0.5+rng()*0.5),alive:true,frac:0,struck:false,survey:0,
      shMax:p.layers,shL:p.layers,shC:p.guard,broken:false,regen:0,vuln:0});
    applyLayerDelta(G.units[G.units.length-1]);
    added.push('f'+G.spawned); G.spawned++; live++;
  }
  SpacologyEnemyTraits.linkGuards(G.units);
  updateEnemyCounter();
  return added;
}
// The layerDelta rule: more or fewer shield layers for every enemy that enters, never below one for a shielded enemy.
function applyLayerDelta(u){
  var delta=COMBAT_RULES.layerDelta;if(!delta)return;
  u.shMax=u.shL=Math.max(u.shMax>0?1:0,u.shMax+delta);
  if(u.shL>0&&!(u.shC>0))u.shC=shieldCapacity(u);
}
function summonEnemy(actor,ev){
  var catalogue=window.SpacologyEnemyCatalogue;
  var specimen=catalogue.generateEnemy(actor.id+'-reinforcement-'+(actor.summonCalls||0),{faction:actor.factionId||OPS_FACTION,archetype:'chaff',element:actor.e});
  var child=SpacologyEnemySummoning.act(actor,G.units,FIELD,{
    n:specimen.typeName,typeName:specimen.typeName,specimenName:specimen.name,portrait:specimen.portrait,
    factionId:specimen.faction,factionName:specimen.factionName,factionRule:specimen.factionRule,
    bodyPlan:specimen.bodyPlan,material:specimen.material,adaptation:specimen.adaptation,
    nullStage:specimen.nullStage,nullSymptom:specimen.nullSymptom
  });
  if(!child)return false;
  applyLayerDelta(child);
  G.units.push(child);ev.enemySummoned={id:child.id,name:child.n};
  ev.notes.push(actor.n+' calls '+child.n+' · '+(SpacologyEnemySummoning.MAX_CALLS-actor.summonCalls)+' calls remaining.');
  updateEnemyCounter();reflowFoes();queueReset(actor);return true;
}
function spawnTreasureCarrier(){
  if(!window.SPACOLOGY_SESSION)return;
  var info=SpacologyTreasure.encounter(window.SPACOLOGY_SESSION);
  if(!info||FIELD>=6)return;
  G.treasureInfo=info;
  if(window.SPACOLOGY_SESSION.treasureClaims.includes(info.id)){G.treasureStatus='collected';G.treasureReward=SpacologyTreasure.rollReward(info);return;}
  var model=G.units.find(function(u){return u.side==='foe'&&!u.elite});
  if(!model)return;
  var carrier=Object.assign({},model,{id:'treasure',n:'Treasure carrier',typeName:'Treasure carrier · '+model.n,
    treasure:true,elite:false,eliteTier:0,hp:55+(OPS_NODE?OPS_NODE.sector*2:OPS_RUN_ROUND)*12,max:55+(OPS_NODE?OPS_NODE.sector*2:OPS_RUN_ROUND)*12,
    dmg:0,haste:0,cleanse:0,trait:'Treasure',shMax:1,shL:1,shC:10,shieldPer:10,
    av:0,frac:0,survey:0,bar:0,escapeAt:G.av+info.escapeAV});
  G.units.push(carrier);G.treasureStatus='present';
}
function settleTreasure(ending){
  if(!G||!G.treasureInfo)return;
  var carrier=U('treasure');
  if(!carrier||G.treasureStatus!=='present')return;
  if(!carrier.alive&&carrier.hp<=0){
    G.treasureStatus='collected';G.treasureReward=SpacologyTreasure.rollReward(G.treasureInfo);
    // Save immediately, including on partial extraction or a subsequent retreat.
    var saved=JSON.parse(localStorage.getItem(SpacologyStore.run)||'null');
    if(saved&&saved.treasureSeed===window.SPACOLOGY_SESSION.treasureSeed&&saved.round===OPS_RUN_ROUND){
      SpacologyTreasure.collect(saved,G.treasureReward);
      localStorage.setItem(SpacologyStore.run,JSON.stringify(saved));
      $('sessionGold').textContent=saved.gold;
    }
    log('<b>Treasure secured</b> · +'+G.treasureReward.gold+' gold · '+G.treasureReward.item+' · Tier '+G.treasureReward.cache.tier+' cache saved to Ops.','chain');
  }else if(ending||G.av>=carrier.escapeAt||!G.units.some(function(u){return u.side==='foe'&&!u.treasure&&u.alive})){
    carrier.alive=false;carrier.escaped=true;carrier.retired=true;carrier.retiring=false;
    var card=$('r-'+carrier.id);if(card)card.remove();
    G.treasureStatus='escaped';log('Treasure carrier escaped. Mission rewards are unchanged.','rnd');
  }
  paintTreasure();
}

/* ---- Treasure targeting and unit lookup (watchable-fight.html, lines 993–999 before extraction) ---- */
function treasureTargets(pool){
  if(!window.SPACOLOGY_SESSION)return pool;
  var carrier=pool.find(function(u){return u.treasure&&u.alive});
  if(!carrier)return pool;
  return window.SPACOLOGY_SESSION.treasureOrder==='mission'?pool.filter(function(u){return !u.treasure}):[carrier];
}
function U(id){ for(var i=0;i<G.units.length;i++) if(G.units[i].id===id) return G.units[i]; }

/* ---- Recovery score (watchable-fight.html, lines 1085–1092 before extraction) ---- */
function currentRecovery(){
  var observed=window.SPACOLOGY_SESSION&&SpacologyExpedition.observed(window.SPACOLOGY_SESSION,G,false);
  // Safe recovery is only completed by a full clear without a crew death.
  if(window.SPACOLOGY_SESSION&&SpacologyExpedition.goal(window.SPACOLOGY_SESSION).metric==='safeWins')observed=G.deaths===0;
  return SpacologyRecovery.score(G.pool,G.units,observed);
}
function projectedIntegrity(score){var start=window.SPACOLOGY_SESSION?window.SPACOLOGY_SESSION.integrity:70;return Math.max(0,Math.min(100,start+score.integrity))-start;}
function signedIntegrity(value){return value>0?'+'+value:String(value);}

/* ---- Ultimate policy and the projected turn order (watchable-fight.html, lines 1273–1368 before extraction) ---- */
// An ultimate cuts into the order rather than costing a turn, so the only
// question is when to spend it.  The answer is the character.
function ultPolicy(u){
  if(!u.ult||u.en<EN.cost||!u.alive) return null;
  var foes=G.units.filter(function(x){return x.side==='foe'&&x.alive});
  if(!foes.length) return null;
  var k=u.ult.kind;
  var forced=u.heldFor>4?'charge cannot be held any longer':null;

  if(G.aether&&u.ult.aether&&G.aether.max-G.aether.current>=Math.min(4,u.ult.aether))return 'refill the shared Aether pool';
  if(k==='mend'){
    if(livingCrew().some(function(x){return Object.keys(x.ailments||{}).length}))return 'cleanse the crew';
    var hurt=G.units.filter(function(a){
      return a.side==='ally'&&a.alive&&a.hp/a.max<0.55; });
    if(hurt.length>=2) return 'the crew is hurt';
    if(hurt.some(function(a){return a.hp/a.max<0.3})) return 'someone is about to fall';
    return forced;
  }
  if(window.SPACOLOGY_SESSION&&['lash','aoe','nuke'].includes(k)&&basicCleanupSoon(foes))return null;
  if(k==='lash'){
    if(u.taken>=Math.round(u.max*0.55)) return 'enough stored to hurt';
    return forced;
  }
  if(k==='aoe'){
    if(foes.length>=3) return 'the board is full';
    if(foes.filter(function(f){return !f.broken&&f.shL>0}).length>=3)
      return 'shields everywhere';
    return forced;
  }
  // Prefer meaningful damage over spending an ultimate on a nearly defeated target.
  var target=chooseUltimateTarget(u,foes);
  if(target){
    if(ultimateDamage(u,target)>=target.hp)return 'it finishes '+target.n;
    if(target.vuln>0)return 'the window is open';
    if(target.frac>=5)return 'the stacks are worth it';
  }
  // otherwise hold, unless charge would be wasted sitting at full
  if(forced) return forced;
  return null;
}
function nextUltimate(){
  var ready=[];
  G.units.filter(function(u){return u.side==='ally'&&u.alive&&u.ult&&u.en>=EN.cost&&!(u.frozen>0)})
    .forEach(function(u){
      u.heldFor=(u.heldFor||0)+1;
      var r=ultPolicy(u);
      if(r)ready.push({u:u,why:r});
    });
  if(G.aether&&SpacologyAether.priority(livingCrew(),window.SPACOLOGY_SESSION||{},aetherSkillUseful)){
    var critical=livingCrew().some(function(x){return x.hp/x.max<.3});
    function rank(cut){
      if(critical&&cut.u.ult.kind==='mend'&&cut.u.ult.amt>0)return 3;
      if(cut.u.ult.aether&&G.aether.max-G.aether.current>=Math.min(4,cut.u.ult.aether))return 2;
      return 1;
    }
    ready.sort(function(a,b){return rank(b)-rank(a)});
  }
  return ready[0]||null;
}
function bloomReady(){
  if(!G.bloom||!G.bloom.live) return false;
  var st=0;
  G.units.forEach(function(u){ if(u.side==='foe'&&u.alive) st+=(u.frac||0); });
  return st>=10;
}
function silenBonusTurn(){
  var chain=G.silenChain,session=window.SPACOLOGY_SESSION||{};
  if(!chain||!G.aether||G.aether.current<SpacologyAether.continuationCost(chain.index)+(chain.reserve||0))return null;
  var actor=U(chain.actor),target=U(chain.target);
  if(!actor||!actor.alive||actor.frozen>0||!SpacologyAether.overchargeEnabled(session,actor.n)||(session.aetherModes||{})[actor.n]==='build')return null;
  if(!target||!target.alive)target=treasureTargets(liveFoes()).slice().sort(function(a,b){return b.hp-a.hp})[0];
  if(!target&&G.spawned>=G.pool.length)return null;
  return {actor:actor,target:target,chain:chain};
}
function project(n){
  var sim=G.units.filter(function(u){return u.alive&&!u.treasure})
    .map(function(u){return {u:u,av:G.pending&&G.pending.id===u.id?G.pending.av:u.av}});
  var out=[],elapsed=0,bonus=silenBonusTurn();
  if(bonus&&n>0)out.push({u:bonus.actor,wait:0,bonus:true,index:bonus.chain.index});
  for(var k=out.length;k<n;k++){ sim.sort(function(a,b){return a.av-b.av});
    var t=sim[0]; if(!t) break; var adv=Math.max(0,t.av);elapsed+=adv;
    sim.forEach(function(x){x.av-=adv});
    out.push({u:t.u,wait:elapsed}); t.av=10000/t.u.sp; }
  return out;
}
function timelineEntries(){
  var end=Math.max(0,G.limit*100-G.av),horizon=Math.min(end,(Math.floor(G.av/100)+2)*100-G.av),q=project(128).filter(function(sl){return sl.wait<horizon});
  var carrier=U('treasure');
  if(carrier&&carrier.alive&&carrier.escapeAt-G.av<=horizon)q.push({treasureEscape:true,wait:Math.max(0,carrier.escapeAt-G.av)});
  if(G.bloom&&G.bloom.live&&bloomReady()&&G.bloom.av<horizon)q.push({bloom:1,wait:G.bloom.av});
  var boundary=(Math.floor(G.av/100)+1)*100;
  // Markers win exact ties, matching the resolver's exclusive final deadline.
  for(var at=boundary;at<=G.av+horizon;at+=100)q.push({roundMarker:1,round:at/100+1,extraction:at===G.limit*100,wait:at-G.av});
  if(G.limit*100%100&&end<=horizon)q.push({roundMarker:1,round:Math.ceil(G.limit),extraction:true,wait:end});
  return q.sort(function(a,b){return a.wait-b.wait||(b.roundMarker||0)-(a.roundMarker||0)});
}

/* ---- Resolving one action: shields, Breaks, tempo, Weaver kits, Aether planning, enemy traits (watchable-fight.html, lines 1690–2126 before extraction) ---- */
/* ============ resolve one action (pure) ============ */
function shieldCapacity(u){return u.shieldPer||SHPER;}
// Whether act's attack can still damage tgt's shield, at every site that shreds: both still standing (a follow-up or a
// hook may have felled either earlier in the action, and a fallen unit Breaks nothing), and a shield left to damage.
function canShred(act,tgt){return act.alive&&tgt.alive&&!tgt.broken&&tgt.shL>0}
function setEnemySpeed(u,speed){
  var ratio=u.sp/speed;
  // Preserve progress through the current wait, including a deferred queue reset.
  u.av=Math.max(0,u.av*ratio);
  if(G.pending&&G.pending.id===u.id)G.pending.av*=ratio;
  u.sp=speed;
}
function breakEnemy(u,src){
  u.broken=true;u.vuln=1;u.skips=G.bon&&G.bon.dissect?2:0;
  if(u.hasteStacks){u.hasteStacks=0;setEnemySpeed(u,u.baseSp);}
  u.av+=(10000/u.sp)*(window.SPACOLOGY_SESSION?OPS_RECOVERY:BRK.delay);
  if(COMBAT_RULES.reformDelay)u.av=Math.max(0,u.av+COMBAT_RULES.reformDelay); // a faster reform is due now, never in the past
  var returned=SpacologyEnemyTraits.interrupt(u,G.aether);
  if(returned.stored)traitNote(u.n+' releases '+returned.returned+' of '+returned.stored+' stored Aether.');
  G.breaks++;
  if(src)(G.justBroke||(G.justBroke={}))[u.id]=src.id; // the breaker's next hit on u reports broke
  combatEmit('break',{src:src||null,tgt:u});
}
function accelerateEnemy(u,damage){
  if(u.side!=='foe'||!u.alive||u.broken||!u.haste||damage<=0||u.hasteStacks>=u.hasteCap)return;
  u.hasteStacks++;
  setEnemySpeed(u,Math.round(u.baseSp*(1+u.haste*u.hasteStacks)));
}
function advanceAlly(u,amount){
  var pending=G.pending&&G.pending.id===u.id,wait=pending?G.pending.av:u.av;
  var saved=Math.min(Math.max(0,wait-1),Math.max(0,amount));
  if(!saved)return 0;
  if(pending)G.pending.av-=saved;else u.av-=saved;
  G.advances=(G.advances||0)+1;G.advanceSaved=(G.advanceSaved||0)+saved;u.lastAdvanceAt=G.av;
  return saved;
}
function queueReset(u){ G.pending={id:u.id,av:10000/u.sp}; }
function applyReset(){
  if(!G||!G.pending) return false;
  var u=U(G.pending.id);
  if(u) u.av=G.pending.av;
  G.pending=null;
  return true;
}
function advanceCombat(wait){
  var remaining=Math.max(0,G.limit*100-G.av),step=Math.min(wait,remaining),previous=G.round;
  G.units.forEach(function(u){if(u.alive)u.av-=step;});
  G.av+=step;G.round=Math.min(Math.ceil(G.limit),Math.floor(G.av/100)+1);
  if(G.round>previous){G.units.forEach(function(u){if(u.side==='foe')u.struck=false;});G.react={};}
  settleTreasure(false);
  return G.av>=G.limit*100;
}
function weaverAllies(){return livingCrew()}
function weaverPartner(act,flag){
  var burst=G.aether&&SpacologyAether.priority(weaverAllies(),window.SPACOLOGY_SESSION||{});
  return weaverAllies().filter(function(x){return x.id!==act.id&&!x[flag]&&(flag!=='weaverDiscount'||SpacologyAether.profile(x.n).cost>1)})
    .sort(function(a,b){return flag==='weaverDiscount'?((b===burst?1:0)-(a===burst?1:0)||SpacologyAether.profile(b.n).cost-SpacologyAether.profile(a.n).cost):a.av-b.av})[0];
}
function weaverBarrier(u,amount){var added=barrierAmount(Math.round(amount*((G.bon&&G.bon.barrier)||1)*(u.barrierMul||1)));var before=u.bar;u.bar=Math.min(160,u.bar+added);countBarrier(u,before);return u.bar-before}
function weaverGuard(act,tgt,amount,ev){
  if(!canShred(act,tgt))return;
  var before=tgt.shL,pressure=amount*(isWeak(tgt,act.e)?1:UNMATCHED)*((G.bon&&G.bon.shredMul)||1)*(act.guardMul||1);
  while(pressure>0&&tgt.shL>0){if(pressure>=tgt.shC){pressure-=tgt.shC;tgt.shL--;tgt.shC=tgt.shL>0?shieldCapacity(tgt):0}else{tgt.shC-=pressure;pressure=0}}
  ev.shield={id:tgt.id,from:before,to:tgt.shL,match:isWeak(tgt,act.e)};
  if(tgt.shL<=0){breakEnemy(tgt,act);ev.broke=tgt.id;cascade(ev,act,tgt,['break'])}
}
function weaverAfterBasic(act,ev){
  if(act.weaverTune)delete act.weaverTune;
  if(act.n==='Daven'&&act.alive){var bar=weaverBarrier(act,6);ev.notes.push('Check the Brace: +'+bar+' barrier.');}
  if(act.n==='Veska'){act.refrain=Math.min(3,(act.refrain||0)+1);ev.notes.push('Refrain '+act.refrain+'/3.');}
  if(act.n==='Roonie'){
    act.workshopBasics=(act.workshopBasics||0)+1;
    if(act.workshopBasics%2===0){var target=weaverPartner(act,'weaverDiscount');if(target){target.weaverDiscount=true;ev.notes.push('Pocket Workshop: '+target.n+' next skill costs 1 less.');}}
  }
}
// Every Aether credit the core makes asks the gain hook first. A listener may set amount to any whole number from 0 up;
// what it takes away is counted as refused (metrics.aetherRefused) and held in G.aetherRefusedPending until
// resolveAction reports it on the action's event (see there), so every refusal is on exactly one event.
function combatGain(actor,amount,source){
  if(!combatHooked('gain'))return amount;
  var p={actor:actor||null,amount:amount,pool:G.aether,source:source};
  combatEmit('gain',p);
  var allowed=Math.max(0,Math.floor(Number(p.amount)||0)),refused=Math.max(0,amount-allowed);
  if(refused){
    if(G.metrics)G.metrics.aetherRefused+=refused;
    G.aetherRefusedPending=(G.aetherRefusedPending||0)+refused;
  }
  return allowed;
}
function weaverRefill(ev,amount){
  if(!G.aether||!amount)return;
  var asked=amount;amount=combatGain(ev.actor,amount,'refill');
  var before=G.aether.current,gain=SpacologyAether.credit(G.aether,amount);
  ev.aether=ev.aether||{kind:'ultimate',delta:0,before:before,reason:'shared pool refill'};
  ev.aether.generated=(ev.aether.generated||0)+gain;
  ev.aether.delta+=gain;ev.aether.after=G.aether.current;
  ev.notes.push('Restored '+gain+' Aether'+(gain<amount?' ('+(amount-gain)+' overflow)':'')+(asked>amount?' ('+(asked-amount)+' refused)':'')+'.');
}
function resolveSilenStrike(act,tgt,ev,index){
  weaverGuard(act,tgt,act.dmg*.5,ev);
  if(!tgt.alive)return;
  var strike=hit(act,tgt,SpacologyAether.chainMultiplier(index),{kind:'skill'});
  strike.chain=false; // This is the turn's attack, not a follow-up.
  strike.pulse=index+1;strike.multiplier=SpacologyAether.chainMultiplier(index);strike.aetherAfter=G.aether.current;
  ev.hits.push(strike);
  reactTo(ev,act,tgt,0);
}
function resolveSilenBonus(bonus){
  var act=bonus.actor,tgt=bonus.target,chain=bonus.chain,before=G.aether.current,fresh=[];
  if(!tgt){fresh=spawnFoes();if(fresh.length)reflowFoes();tgt=treasureTargets(liveFoes()).slice().sort(function(a,b){return b.hp-a.hp})[0];}
  if(!tgt)return null;
  var retargeted=tgt.id!==chain.target;chain.target=tgt.id;
  var cost=SpacologyAether.continuationCost(chain.index);
  if(!SpacologyAether.spendContinuation(G.aether,chain.index))return null;
  combatEmit('spend',{actor:act,amount:cost,pool:G.aether,kind:'continuation'});
  G.allyTurns=(G.allyTurns||0)+1;act.lastStandGuard=false;
  if(chain.releasesReservation)G.aether.reserveAfter++;
  var ev={actor:act,hits:[],chains:[],notes:[],bonusTurn:true,bonusIndex:chain.index,
    aether:{kind:'skill',spent:cost,delta:-cost,before:before,after:G.aether.current,reason:'Rising Current extra turn '+(chain.index+1)}};
  if(fresh.length)ev.reinforced=fresh;
  if(retargeted)ev.notes.push('Rising Current carries its charge to '+tgt.n+'.');
  resolveSilenStrike(act,tgt,ev,chain.index);
  act.en=Math.min(EN.cost,act.en+EN.act+EN.perHit);
  chain.index++;
  ev.notes.push('Silen takes an extra turn: '+Math.round(SpacologyAether.chainMultiplier(ev.bonusIndex)*100)+'% attack.');
  if(!silenBonusTurn())G.silenChain=null;
  // His ordinary turn already has its cooldown. Extra turns do not move it.
  return ev;
}
function resolveWeaverSkill(act,tgt,ev,plan){
  var target,bar;
  ev.notes.push(SpacologyWeavers.crew[act.n].kit.basic[0]);
  delete act.aetherPower; // Dedicated kits specify their own damage multipliers.
  if(act.n==='Hanae'){
    weaverGuard(act,tgt,act.dmg,ev);ev.hits.push(hit(act,tgt,2,{kind:'skill'}));weaverRefill(ev,5);if(act.alive){tgt.survey=Math.max(tgt.survey||0,1);ev.surveyed=tgt.id;}
    target=weaverPartner(act,'weaverTune');if(target){target.weaverTune=true;ev.notes.push(target.n+' next basic gathers +1 Aether.');}
  }else if(act.n==='Ivara'){
    weaverGuard(act,tgt,act.dmg*1.5,ev);ev.hits.push(hit(act,tgt,3,{kind:'skill'}));if(act.alive){tgt.survey=Math.max(tgt.survey||0,1);ev.surveyed=tgt.id;}
  }else if(act.n==='Silen'){
    resolveSilenStrike(act,tgt,ev,0);
    G.silenChain={actor:act.id,target:tgt.id,index:1,reserve:plan.reserve||0,releasesReservation:plan.releasesReservation};
    if(!silenBonusTurn())G.silenChain=null;
    if(G.silenChain)ev.notes.push('Rising Current grants an immediate extra turn.');
  }else if(act.n==='Arunima'){
    var delayed=0;
    G.units.filter(function(x){return x.side==='foe'&&x.alive}).forEach(function(x){
      weaverGuard(act,x,act.dmg*(2+.5*plan.extra),ev);
      ev.hits.push(hit(act,x,3+plan.extra,{area:true,kind:'skill'}));if(x.alive&&act.alive){x.av+=15;delayed++;}
    });ev.notes.push('Proof by Transit: '+((3+plan.extra)*100)+'% attack; '+(act.alive?'all enemies delayed 15 AV.':'Arunima fell partway; '+delayed+(delayed===1?' enemy':' enemies')+' delayed 15 AV.'));
  }else if(act.n==='Roonie'){
    target=weaverPartner(act,'weaverDiscount');if(target){target.weaverDiscount=true;bar=weaverBarrier(target,20);ev.mends=[{tgt:target.id,amt:0,bar:bar,ch:0}];ev.notes.push(target.n+' next skill costs 1 less.');}
    weaverRefill(ev,3);
  }else if(act.n==='Veska'){
    var refrains=act.refrain||0,amount=healAmount(Math.round((12+6*refrains)*((G.bon&&G.bon.healMul)||1)));act.refrain=0;weaverRefill(ev,refrains);
    ev.mends=weaverAllies().map(function(x){var before=x.hp;x.hp=Math.min(x.max,x.hp+amount);countHeal(x,before);return {tgt:x.id,amt:x.hp-before,bar:0,ch:0}});G.heals++;
  }else if(act.n==='Daven'){
    weaverGuard(act,tgt,act.dmg*1.5,ev);ev.hits.push(hit(act,tgt,2.25,{kind:'skill'}));bar=act.alive?weaverBarrier(act,32):0;act.taunt=5;ev.mends=[{tgt:act.id,amt:0,bar:bar,ch:0}];ev.notes.push('Daven draws attacks until his next turn.');
  }
  act.en=Math.min(EN.cost,act.en+EN.act+EN.perHit);
  queueReset(act);return ev;
}
function livingCrew(){
  return G.units.filter(function(x){return x.side==='ally'&&x.alive&&!x.summon});
}
function activeJ3K(){
  return G.units.filter(function(x){return x.summon&&x.alive});
}
function createMageSummon(name){
  var definition=SpacologyExpedition.summons[name],combat=definition.combat||{};
  var speed=(combat.speed||10)*10,hp=combat.hp||76;
  var unit={id:'j3k-'+name.slice(-3),side:'ally',summon:true,n:name,
    e:combat.element||'order',sp:speed,dmg:combat.dmg||7,p:'support',row:'back',
    tags:[],hp:hp,max:hp,av:Math.max(1,10000/speed),alive:true,bar:0,en:0,
    taken:0,taunt:0,barrierMul:1,ultMul:1,guardMul:1};
  G.units.push(unit);G.dealt[name]=0;
  return unit;
}
function resolveMageSkill(act,ev){
  var names=Object.keys(SpacologyExpedition.summons||{}),active=activeJ3K();
  var deployed={};active.forEach(function(x){deployed[x.n]=true});
  var missing=names.filter(function(name){return !deployed[name]});
  if(missing.length){
    var name=missing[Math.floor(rng()*missing.length)],unit=createMageSummon(name);
    if(G.firstMageSummon){unit.av=0;G.firstMageSummon=false;ev.immediateSummon=true;}
    ev.summoned={id:unit.id,name:name,role:SpacologyExpedition.summons[name].role};
    ev.notes.push(name+' joins the support field · '+SpacologyExpedition.summons[name].role+'.');
  }else if(active.length){
    active.sort(function(a,b){return b.av-a.av});
    var waiting=active[0],saved=advanceAlly(waiting,waiting.av);
    ev.advanced={id:waiting.id,name:waiting.n};
    ev.notes.push('Full line deployed: '+waiting.n+' is commanded forward by '+Math.round(saved)+' AV.');
  }
  queueReset(act);return ev;
}
function resolveSummonAction(act,ev){
  var crew=livingCrew(),target,bar,before,foes;
  ev.supportAction=true;
  if(act.n==='J3K-017'){
    ev.mends=crew.map(function(x){bar=weaverBarrier(x,12);return {tgt:x.id,amt:0,bar:bar,ch:0}});
    target=crew.slice().sort(function(a,b){return b.av-a.av})[0];
    if(target){advanceAlly(target,(10000/target.sp)*.3);ev.advanced={id:target.id,name:target.n};}
    ev.notes.push('Route Sweep: crew barriers raised'+(target?' and '+target.n+' advanced.':'.'));
  }else if(act.n==='J3K-036'){
    foes=G.units.filter(function(x){return x.side==='foe'&&x.alive});ev.aoe=true;
    foes.forEach(function(x){weaverGuard(act,x,act.dmg*1.5,ev);x.survey=Math.max(x.survey||0,1);ev.hits.push(hit(act,x,.55,{area:true,kind:'skill'}));});
    ev.surveyedAll=true;ev.notes.push('Harmonic Survey: all enemies marked and dealt shield damage.');
  }else{
    target=crew.slice().sort(function(a,b){return a.hp/a.max-b.hp/b.max})[0];
    if(target){before=target.hp;target.hp=Math.min(target.max,target.hp+healAmount(18));countHeal(target,before);bar=weaverBarrier(target,10);G.heals++;
      ev.heal={src:act.id,tgt:target.id,amt:target.hp-before,bar:bar,clutch:before<=18};}
    ev.notes.push('Sample Return: '+(target?target.n+' restored and protected.':'sample secured.'));
  }
  queueReset(act);return ev;
}
function aetherSkillUseful(u){
  if(u.n==='Hanae')return G.aether.max-G.aether.current>=3;
  if(u.n==='Roonie')return G.aether.max-G.aether.current>=2||!!weaverPartner(u,'weaverDiscount');
  if(u.n==='Veska')return weaverAllies().some(function(x){return x.hp/x.max<.75});
  if(u.n==='Daven')return u.bar<24;
  if(u.n==='The Mage')return Object.keys(SpacologyExpedition.summons||{}).some(function(name){
    return !activeJ3K().some(function(x){return x.n===name});
  })||activeJ3K().length>0;

  var allies=livingCrew();
  if(u.heal)return allies.some(function(x){return x.hp/x.max<.45});
  if(u.kindle)return allies.some(function(x){return x.id!==u.id&&x.ult&&x.en<EN.cost});
  return G.units.some(function(x){return x.side==='foe'&&x.alive});
}
function aetherKindleTarget(act){
  var crew=livingCrew(),session=window.SPACOLOGY_SESSION||{},owner=G.aether&&SpacologyAether.priority(crew,session,aetherSkillUseful);
  var candidates=crew.filter(function(x){return x.id!==act.id&&x.ult&&x.en<EN.cost});
  function value(x){
    if(G.aether&&x.ult.aether&&x.en+34>=EN.cost&&G.aether.max-G.aether.current>=Math.min(4,x.ult.aether))return 3;
    if(x===owner&&x.en+34>=EN.cost)return 2;
    return 0;
  }
  return candidates.sort(function(a,b){return value(b)-value(a)||b.en-a.en})[0];
}
function aetherSetupReason(u,owner){
  if(!owner||owner===u)return null;
  if(u.n==='Roonie'&&weaverPartner(u,'weaverDiscount')===owner&&
      Math.min(G.aether.max,G.aether.current-SpacologyAether.skillCost(u)+SpacologyAether.profile(u.n).skillGain)>=Math.max(1,SpacologyAether.skillCost(owner)-1))
    return 'discount before '+owner.n+' burst';
  if(u.kindle){
    var target=aetherKindleTarget(u);
    if(target&&target.en+34>=EN.cost){
      if(target.ult.aether&&G.aether.max-G.aether.current>=Math.min(4,target.ult.aether))return 'ready an Aether refill ultimate';
      if(target===owner)return 'ready '+owner.n+' ultimate';
    }
  }
  return null;
}
// Conservative direct-hit estimates: ignore follow-ups, but account for guard breaks,
// existing vulnerability, ailments, opening boosts and the actual attack multiplier.
function estimatedAttack(u,t,kind,extra){
  extra=extra||0;
  var basic=kind==='basic',weaver=!!SpacologyWeavers.crew[u.n],mult=basic?(weaver?1.25:.75):1;
  var pressure=u.dmg*(basic?.75:1)*(isWeak(t,u.e)?1:UNMATCHED)*((G.bon&&G.bon.shredMul)||1)*(u.guardMul||1);
  var frac=t.frac||0;
  if(basic&&u.frac)frac=Math.min(12,frac+1);
  if(!basic){
    if(u.n==='Arunima'){mult=3+extra;pressure=u.dmg*(2+.5*extra)*(isWeak(t,u.e)?1:UNMATCHED)*((G.bon&&G.bon.shredMul)||1)*(u.guardMul||1)}
    else if(u.n==='Hanae')mult=2;
    else if(u.n==='Ivara'){mult=3;pressure*=1.5;}
    else if(u.n==='Silen'){mult=SpacologyAether.chainMultiplier(extra);pressure*=.5;}
    else if(u.n==='Daven')mult=2.25;
    else{
      mult=(u.aoe||u.heal||u.kindle?1:1.5)*(extra?1.35:1);
      if(u.aoe)pressure=(u.shred||0)*(isWeak(t,u.e)?1:.5)*((G.bon&&G.bon.shredMul)||1)*(u.guardMul||1);
      if(u.frac)frac=Math.min(12,frac+u.frac+((G.bon&&G.bon.stackUp)||0));
      if(u.consume&&frac){mult*=1+u.consume*frac/Math.max(1,u.dmg);frac=0;}
      if(u.follow&&t.struck)mult*=1+u.follow;
    }
  }
  var guard=t.broken?0:Math.max(0,(t.shL-1)*shieldCapacity(t)+t.shC);
  var breaks=guard>0&&pressure>=guard,vuln=t.vuln>0||breaks;
  return Math.round(u.dmg*mult*(u.openingBoost&&!u.openingUsed?1+u.openingBoost:1)*(1+(vuln?BRK.vuln:0)+frac*.12)*(guard>pressure?SOAK:1));
}
function burstHealthBudget(u,foes,target){
  if(!u||SpacologyAether.profile(u.n).role!=='conduit')return null;
  if(u.n!=='Arunima'){
    target=target||(foes.length?(chooseTarget(u,foes)||{}).t:null);
    if(!target)return null;
    if(u.n==='Silen'){
      if(foes.length===1&&G.spawned>=G.pool.length&&estimatedAttack(u,target,'basic')>=target.hp)return 0;
      return SpacologyAether.budget(G.aether,u,window.SPACOLOGY_SESSION||{});
    }
    if(estimatedAttack(u,target,'basic')>=target.hp)return 0;
    if(estimatedAttack(u,target,'skill',0)>=target.hp)return SpacologyAether.skillCost(u);
    return SpacologyAether.budget(G.aether,u,window.SPACOLOGY_SESSION||{});
  }
  if(foes.length===1&&estimatedAttack(u,foes[0],'basic')>=foes[0].hp)return 0;
  var cost=SpacologyAether.skillCost(u),max=SpacologyAether.budget(G.aether,u,window.SPACOLOGY_SESSION||{});
  for(var spend=cost;spend<=max;spend++){
    if(foes.length&&foes.every(function(t){return estimatedAttack(u,t,'skill',spend-cost)>=t.hp}))return spend;
  }
  return max;
}
function basicCleanupSoon(foes){
  if(!foes.length||foes.length>2)return false;
  var used={},remaining=G.limit*100-G.av;
  return foes.every(function(t){
    var helper=livingCrew().filter(function(u){if(u.heal||u.kindle||['Roonie','Veska','The Mage'].includes(u.n))return false;var wait=G.pending&&G.pending.id===u.id?G.pending.av:u.av;return !used[u.id]&&wait<t.av&&wait<remaining&&estimatedAttack(u,t,'basic')>=t.hp})
      .sort(function(a,b){return a.av-b.av})[0];
    if(helper)used[helper.id]=true;
    return !!helper;
  });
}
function ultimateDamage(u,t){
  var mult=u.ult.mult||0;
  if(u.ult.eat)mult+=u.ult.eat*(t.frac||0);
  return Math.round(u.dmg*mult*(u.ultMul||1)*(u.openingBoost&&!u.openingUsed?1+u.openingBoost:1)*
    (1+(t.vuln>0?BRK.vuln:0)+(u.ult.eat?0:t.frac||0)*.12)*(!t.broken&&t.shL>0?SOAK:1));
}
function chooseUltimateTarget(u,foes){
  foes=treasureTargets(foes);
  return foes.slice().sort(function(a,b){
    function value(t){var damage=ultimateDamage(u,t);return Math.min(t.hp,damage)*(damage>=t.hp?1.35:1)}
    return value(b)-value(a);
  })[0];
}
function planAetherAction(u,target){
  var session=window.SPACOLOGY_SESSION,allies=livingCrew();
  SpacologyAether.sync(G.aether,allies);
  var owner=SpacologyAether.priority(allies,session,aetherSkillUseful),foes=liveFoes();
  var nextTurn=10000/u.sp,remaining=G.limit*100-G.av,opportunity=null;
  target=target||(foes.length?(chooseTarget(u,foes)||{}).t:null);
  var damageSkill=!u.heal&&!u.kindle&&!['Roonie','Veska','The Mage','Hanae'].includes(u.n);
  var basicEnough=damageSkill&&target&&(!u.aoe||foes.length===1)&&estimatedAttack(u,target,'basic')>=target.hp;
  if(u.n==='Silen'&&SpacologyAether.overchargeEnabled(session,u.n)&&(foes.length>1||G.spawned<G.pool.length))basicEnough=false;
  var spendLimit=burstHealthBudget(u,foes,target),ownerBudget=owner===u?spendLimit:burstHealthBudget(owner,foes);
  var critical=allies.some(function(x){return x.hp/x.max<.3});
  var emergency=(!!u.heal||u.n==='Veska')&&critical;
  if(u.n==='Daven')emergency=u.row==='front'&&u.hp/u.max<.3&&u.bar<24;
  if(remaining<=nextTurn)opportunity='deadline approaching';
  if(damageSkill&&SpacologyAether.profile(u.n).spending==='conservative'&&target&&!basicEnough){
    if(target.broken||target.vuln>0)opportunity='sub-DPS using a break window';
    if(estimatedAttack(u,target,'skill')>=target.hp)opportunity='sub-DPS securing a kill';
  }
  if(owner===u){
    if(critical)opportunity='crew under pressure';
    if(foes.some(function(x){return x.broken||x.vuln>0}))opportunity='use the open break window';
    if(u.n==='Arunima'&&G.aether.current>=SpacologyAether.skillCost(u)){
      var extra=SpacologyAether.overchargeEnabled(session,u.n)?Math.max(0,Math.min(SpacologyAether.budget(G.aether,u,session)-SpacologyAether.skillCost(u),G.aether.current-SpacologyAether.skillCost(u))):0;
      if(foes.some(function(x){return x.hp<=Math.round(u.dmg*(3+extra)*(1+(x.vuln>0?BRK.vuln:0)+(x.frac||0)*.12)*(!x.broken&&x.shL>0?SOAK:1))}))opportunity='finish an enemy now';
    }
  }
  var projected=G.aether.current+SpacologyAether.profile(u.n).gain;
  allies.filter(function(x){return x!==u&&x.av<=nextTurn}).forEach(function(x){
    var p=SpacologyAether.profile(x.n),gain=p.gain;
    if((session.aetherModes||{})[x.n]!=='build'&&aetherSkillUseful(x)&&projected>=SpacologyAether.skillCost(x))
      gain=Math.max(gain,(x.n==='Veska'?(x.refrain||0):p.skillGain)-SpacologyAether.skillCost(x));
    projected+=gain;
  });
  return SpacologyAether.teamPlan(G.aether,u,{crew:allies,session:session,turn:G.allyTurns,useful:aetherSkillUseful,
    emergency:emergency,setup:aetherSetupReason(u,owner),opportunity:opportunity,basicEnough:basicEnough,damageSkill:damageSkill,
    spendLimit:spendLimit===null?undefined:spendLimit,ownerBudget:ownerBudget===null?undefined:ownerBudget,
    skillGain:u.n==='Veska'?(u.refrain||0):SpacologyAether.profile(u.n).skillGain,
    canWait:remaining>nextTurn&&owner===u&&projected>=(spendLimit===null?SpacologyAether.budget(G.aether,u,session):spendLimit)});
}
function resolveBasic(act,tgt,ev,plan){
  if(canShred(act,tgt)){
    var before=tgt.shL,pressure=act.dmg*.75*(isWeak(tgt,act.e)?1:UNMATCHED)*((G.bon&&G.bon.shredMul)||1)*(act.guardMul||1);
    while(pressure>0&&tgt.shL>0){if(pressure>=tgt.shC){pressure-=tgt.shC;tgt.shL--;tgt.shC=tgt.shL>0?shieldCapacity(tgt):0}else{tgt.shC-=pressure;pressure=0}}
    ev.shield={id:tgt.id,from:before,to:tgt.shL,match:isWeak(tgt,act.e)};
    if(tgt.shL<=0){
      breakEnemy(tgt,act);ev.broke=tgt.id;
      if(G.bon&&G.bon.overstrike){var over=hit(act,tgt,.9,{kind:'chain'});over.over=true;ev.chains.push(over)}
      var harmony=livingCrew().filter(function(u){return u.e===act.e&&u.id!==act.id});
      if(harmony.length){G.chains++;G.longest=Math.max(G.longest,harmony.length+1);harmony.forEach(function(u){ev.chains.push(hit(u,tgt,HARM*(u.followMul||1),{kind:'chain'}))})}
      cascade(ev,act,tgt,['break']);
    }
  }
  if(act.alive&&act.frac){tgt.frac=Math.min(12,(tgt.frac||0)+1);ev.fracs=[tgt.id]}
  if(act.alive&&act.marks){tgt.survey=Math.max(tgt.survey||0,1);ev.surveyed=tgt.id}
  var basicMult=SpacologyWeavers.crew[act.n]?1.25:.75;
  ev.hits.push(hit(act,tgt,basicMult,{kind:'basic'}));if(act.alive)tgt.struck=true;
  if(act.extraTargets)G.units.filter(function(x){return x.side==='foe'&&x.alive&&x.id!==tgt.id}).slice(0,act.extraTargets).forEach(function(x){ev.hits.push(hit(act,x,basicMult*.7,{kind:'basic',single:false}))});
  act.en=Math.min(EN.cost,act.en+EN.act+EN.perHit);
  reactTo(ev,act,tgt,0);
  var beforeAether=G.aether.current,allowed=combatGain(act,plan.gain,'basic'),gain=SpacologyAether.generate(G.aether,allowed);
  ev.aether={kind:'basic',delta:gain,before:beforeAether,after:G.aether.current,reason:plan.reason};
  weaverAfterBasic(act,ev);queueReset(act);return ev;
}
function traitNote(note){(G.traitNotes||(G.traitNotes=[])).push(note)}
function settleEnemyTraits(){
  var added=false;
  G.units.slice().forEach(function(u){
    if(!SpacologyEnemyTraits.type(u))return;
    if(SpacologyEnemyTraits.enrage(u))traitNote(u.n+' enrages: +40% damage, shield lost.');
    if(u.alive||u.traitDeathHandled)return;
    u.traitDeathHandled=true;
    var returned=SpacologyEnemyTraits.interrupt(u,G.aether);
    if(returned.stored)traitNote(u.n+' releases '+returned.returned+' of '+returned.stored+' stored Aether.');
    if(u.archetype!=='brood'||u.broken)return;
    var parent=Object.assign({},u,{alive:true,archetype:'summoner',summonCalls:0,summonCooldown:0});
    for(var i=0;i<2;i++){
      parent.summonCooldown=0;
      var specimen=SpacologyEnemyCatalogue.generateEnemy(u.id+'-brood-'+i,{faction:u.factionId||OPS_FACTION,archetype:'chaff',element:u.e});
      var child=SpacologyEnemySummoning.act(parent,G.units,FIELD,{n:specimen.typeName,typeName:specimen.typeName,specimenName:specimen.name,portrait:specimen.portrait,factionId:specimen.faction,factionName:specimen.factionName,factionRule:specimen.factionRule,bodyPlan:specimen.bodyPlan,material:specimen.material,adaptation:specimen.adaptation,nullStage:specimen.nullStage,nullSymptom:specimen.nullSymptom});
      if(child){applyLayerDelta(child);G.units.push(child);added=true;traitNote(u.n+' releases '+child.n+' (no recovery points).');}
    }
  });
  SpacologyEnemyTraits.linkGuards(G.units);
  if(added)G.traitSpawned=true;
}
function fieldCleanse(act,ev){
  if(!(act.heal>0||act.n==='Veska'))return false;
  var patients=livingCrew().filter(function(u){return Object.keys(u.ailments||{}).length});
  patients.sort(function(a,b){function urgency(u){var s=u.ailments||{};return (s.bomb?10-s.bomb.turns:0)+(s.poison?s.poison.stacks*2:0)+Object.keys(s).length}return urgency(b)-urgency(a)});
  var target=patients[0];if(!target)return false;
  var removed=SpacologyEnemyTraits.cleanse(target),before=target.hp;
  target.hp=Math.min(target.max,target.hp+healAmount(Math.max(1,Math.round((act.heal||20)*.5))));countHeal(target,before);
  ev.mends=[{tgt:target.id,amt:target.hp-before,bar:0,ch:0}];ev.supportAction=true;
  ev.notes.push(act.n+' cleanses '+removed+' status effects from '+target.n+'.');
  if(G.aether){var beforeAether=G.aether.current,asked=SpacologyAether.profile(act.n).gain,allowed=combatGain(act,asked,'basic'),gain=SpacologyAether.generate(G.aether,allowed);ev.aether={kind:'basic',delta:gain,before:beforeAether,after:G.aether.current,reason:'field cleanse'};}
  act.en=Math.min(EN.cost,act.en+EN.act);G.heals++;queueReset(act);return true;
}
function enemyTraitAction(act,tgt,ev){
  var plan=SpacologyEnemyTraits.plan(act,G.units,G.aether,G.av);if(!plan)return null;
  var target=plan.target?U(plan.target):tgt;
  if(plan.kind==='strike')return {target:target,plan:plan};
  ev.supportAction=true;
  if(plan.kind==='heal'){var before=target.hp;target.hp=Math.min(target.max,target.hp+plan.amount);ev.heal={src:act.id,tgt:target.id,amt:target.hp-before,bar:0};ev.notes.push(act.n+' heals '+target.n+'; '+(2-act.healUses)+' heals remain.');}
  if(plan.kind==='steal')ev.notes.push(act.n+' steals 1 Aether; '+act.stolenAether+' stored. Break or defeat it to reclaim.');
  if(plan.kind==='charge')ev.notes.push(act.n+' charges '+(act.archetype==='sapper'?'a delay strike':'a heavy strike')+' on '+target.n+'. Break it before its next turn.');
  if(plan.kind==='mark')ev.notes.push(act.n+' challenges '+target.n+'.');
  if(plan.kind==='fizzle')ev.notes.push(act.n+' loses its charged target.');
  queueReset(act);return {handled:true};
}
function finishCrewConditions(ev){
  var act=ev&&ev.actor;if(!act||act.side!=='ally'||act.summon)return;
  if(act.ailments)delete act.ailments.hex;
  // Scheduled turns, not multi-hits, interrupts or Silen's immediate extra turns.
  if(!ev.interrupt&&!ev.bonusTurn&&act.alive){
    var attacked=ev.hits.some(function(h){return h.src===act.id&&!h.skipped&&U(h.tgt)?.side==='foe'});
    SpacologyEnemyTraits.statusDamage(act,attacked).forEach(function(tick){
      if(!act.alive||act.recoveryGuard||act.lastStandGuard)return;
      var live=U(tick.source),source=live||{id:act.id,side:'foe',alive:true,dmg:tick.amount};
      // Ticks persist after their source falls and share normal barrier/downing rules. The damage uses a living copy;
      // hooks are told the live source (options.source), fallen or not.
      var h=hit(Object.assign({},source,{alive:true,side:'foe'}),act,1,{flat:tick.amount,condition:true,kind:tick.kind,source:live||null});
      h.condition=tick.kind;ev.hits.push(h);ev.notes.push(act.n+' suffers '+tick.kind+' ('+h.dmg+' health damage).');
    });
  }
}
// Refused Aether (combatGain) is reported on the event of the action it happened in: as event.aether.refused when the
// action has an Aether record, else as a top-level event.refused (Aether too), never as a stub event.aether (the page
// reads ev.aether.kind). The count is drained here, after status ticks, and never reset, so a refusal made between
// actions lands on the next event and the events always add up to metrics.aetherRefused.
function reportRefused(event){
  var n=G.aetherRefusedPending;if(!n)return;
  if(event.aether)event.aether.refused=(event.aether.refused||0)+n;else event.refused=(event.refused||0)+n;
  G.aetherRefusedPending=0;
}
// A hook may move the acting unit (u.av+=60), including from a status tick after its turn reset is queued. queueReset
// sets the next wait without reading u.av and applyReset then overwrites u.av, so the actor's av at the end of the action
// (exactly 0 unless a hook moved it: advanceCombat spent it, and the actor's own av is clamped at 0 there) is added to
// the queued wait. A crewmate revived this action is skipped: the revival already set its wait.
function foldPendingDelay(){
  if(!G.pending)return;
  var pu=U(G.pending.id);
  if(pu&&!pu.recoveryGuard&&pu.av)G.pending.av+=pu.av;
}
function resolveAction(){
  var event;
  try{G.units.forEach(function(u){u.recoveryGuard=false});G.damageTimeline=[];G.justBroke={};G.hookHits=[];event=resolveActionCore();if(event){finishCrewConditions(event);foldPendingDelay();if(G.hookHits.length&&event.hits)event.hits=event.hits.concat(G.hookHits);reportRefused(event);settleEnemyTraits();if(G.traitSpawned){event.traitSpawned=true;G.traitSpawned=false;}if(event.notes)event.notes.push(...(G.traitNotes||[]));G.traitNotes=[];event.timeline=G.damageTimeline.slice();if(event.hits)event.hits=event.hits.filter(h=>!h.skipped);if(event.chains)event.chains=event.chains.filter(h=>!h.skipped)}return event}
  finally{if(G){
    G.units.forEach(function(u){if(SpacologyVoyage.updateBoss(u)){var note='Boss phase 2: guard strength falls 40%; attack damage rises 35%.';if(event&&event.notes)event.notes.push(note);log(note,'rnd');}});
    settleTreasure(false);
    G.units.forEach(function(u){delete u.aetherPower});
    if(G.aether){
      var previousCap=G.aether.max;
      SpacologyAether.sync(G.aether,G.units.filter(function(u){return u.side==='ally'&&!u.summon}));
      if(event&&event.aether)event.aether.after=G.aether.current;
      if(event&&event.notes&&G.aether.max<previousCap)event.notes.push('Aether capacity falls to '+G.aether.max+'.');
      if(G.metrics)G.metrics.aetherPeak=Math.max(G.metrics.aetherPeak,G.aether.current);
    }
  }}
}

/* ---- The action core, targeting, cascades and damage (watchable-fight.html, lines 2139–2607 before extraction) ---- */
function resolveActionCore(){
  applyReset();settleTreasure(false);
  var living=G.units.filter(function(u){return u.alive});
  if(!living.some(function(u){return u.side==='foe'&&!u.treasure})&&G.spawned>=G.pool.length)return {end:'Crew wins'};
  if(!living.some(function(u){return u.side==='ally'&&!u.summon&&(!window.SPACOLOGY_SESSION||u.row==='front')}))return {end:'Crew wiped'};
  if(G.av>=G.limit*100)return {end:'Out of time'};
  G.react={};          // every action gets a fresh cascade budget
  // the whole action resolves before any of it is drawn, so keep a snapshot
  // of health to open the cards on; otherwise every target starts at its end state
  G.hp0={};
  G.units.forEach(function(u){ G.hp0[u.id]=u.hp; });

  // an ultimate interrupts: it costs charge, never a turn
  var cut=nextUltimate();
  if(cut){
    var au=cut.u;
    var ev1={actor:au,hits:[],chains:[],notes:[],ult:{name:au.ult.name,kind:au.ult.kind},
             interrupt:true,why:cut.why};
    au.en=0; au.heldFor=0; G.ults++;
    var u2=au.ult;
    var fs2=G.units.filter(function(x){return x.side==='foe'&&x.alive});
    if(u2.kind==='aoe'){
      fs2.forEach(function(x){ ev1.hits.push(hit(au,x,u2.mult*(au.ultMul||1),{area:true,kind:'ult'}));
        if(u2.frac) x.frac=Math.min(12,(x.frac||0)+u2.frac+((G.bon&&G.bon.stackUp)||0));
        if(u2.survey){ x.survey=u2.survey; ev1.surveyedAll=true; } });
    } else if(u2.kind==='nuke'){
      var bt2=chooseUltimateTarget(au,fs2);
      if(bt2){ var m2=u2.mult+(u2.eat&&bt2.frac?u2.eat*bt2.frac:0);
        if(u2.eat) bt2.frac=0;
        ev1.hits.push(hit(au,bt2,m2*(au.ultMul||1),{kind:'ult'})); }
    } else if(u2.kind==='mend'){
      livingCrew().forEach(function(a){
        var b4=a.hp; a.hp=Math.min(a.max,a.hp+healAmount(u2.amt)); countHeal(a,b4);
        var cleansed=SpacologyEnemyTraits.cleanse(a);if(cleansed)ev1.notes.push(a.n+' cleansed of '+cleansed+' status effects.');
        var barrier2=u2.barrier?barrierAmount(Math.round(u2.barrier*(a.barrierMul||1))):0;
        if(barrier2){ var bar4=a.bar; a.bar=Math.min(160,a.bar+barrier2); countBarrier(a,bar4); }
        if(u2.charge) a.en=Math.min(EN.cost,a.en+u2.charge);
        ev1.mends=ev1.mends||[];
        ev1.mends.push({tgt:a.id,amt:a.hp-b4,bar:barrier2,ch:u2.charge||0}); });
    } else if(u2.kind==='lash'){
      var pool4=au.taken*u2.mult/Math.max(1,fs2.length);
      fs2.forEach(function(x){ ev1.hits.push(hit(au,x,(pool4/Math.max(1,au.dmg))*(au.ultMul||1),{area:true,kind:'ult'})); });
      ev1.lashed=Math.round(au.taken); au.taken=0;
    }
    if(G.aether&&u2.aether)weaverRefill(ev1,u2.aether);
    return ev1;      // note: no queueReset, so nobody loses a turn
  }

  var bonus=silenBonusTurn();
  if(bonus)return resolveSilenBonus(bonus);
  G.silenChain=null;

  // the Bloom holds a slot in the order and burns the board when it comes up
  if(G.bloom&&G.bloom.live){
    var nx=project(1)[0];
    if(nx && G.bloom.av<=nx.wait && bloomReady()){
      var ev0={hits:[],chains:[],notes:[],bloom:true,burn:[]};
      var adv=G.bloom.av;
      var previousRound=G.round;
      if(advanceCombat(adv))return {end:'Out of time'};
      if(G.round>previousRound)ev0.roundStart=G.round;
      G.units.filter(function(x){return x.side==='foe'&&x.alive&&x.frac>0})
        .forEach(function(f){
          var d=Math.round(f.frac*7*(1+0.12*f.frac));
          f.hp=Math.max(0,f.hp-d);
          if(G.metrics)G.metrics.byKind.bloom=(G.metrics.byKind.bloom||0)+d;
          G.biggest=Math.max(G.biggest,d);
          ev0.burn.push({id:f.id,dmg:d,stacks:f.frac});
          f.frac=0;
          if(f.hp<=0&&f.alive){ f.alive=false; ev0.burn[ev0.burn.length-1].killed=1; }
        });
      G.bloom.av=G.bloom.base;
      G.blooms=(G.blooms||0)+1;
      return ev0;
    }
  }
  var alive=G.units.filter(function(u){return u.alive&&!u.treasure});
  if(!alive.some(function(u){return u.side==='foe'}) && G.spawned>=G.pool.length)
    return {end:'Crew wins'};
  if(!alive.some(function(u){return u.side==='ally'&&!u.summon})) return {end:'Crew wiped'};
  alive.sort(function(a,b){return a.av-b.av});
  var act=alive[0], adv=Math.max(0,act.av); // a unit overdue (a hook moved it below 0) acts now; time never runs back
  var oldRound=G.round;
  if(advanceCombat(adv))return {end:'Out of time'};
  if(act.av<0)act.av=0; // the overdue part is spent by acting now; foldPendingDelay must not carry it into the next wait
  if(act.side==='ally'){G.allyTurns=(G.allyTurns||0)+1;act.lastStandGuard=false;}
  if(act.n==='Daven'){act.weaverRefundUsed=false;act.taunt=2;}
  var ev={actor:act,hits:[],chains:[],notes:[],roundStart:G.round>oldRound?G.round:null,suppressed:false};

  var fresh=spawnFoes();
  if(fresh.length){ ev.reinforced=fresh; reflowFoes(); }
  // A frozen crewmate's turn passes: u.frozen counts the turns left. Reinforcements above still arrive.
  if(act.side==='ally'&&act.frozen>0){ act.frozen--; ev.frozen=true; ev.notes.push(act.n+' is frozen and loses the turn.'); queueReset(act); return ev; }
  var pool=G.units.filter(function(u){return u.side!==act.side&&u.alive&&!(act.side==='foe'&&u.summon)});
  if(!pool.length && G.spawned>=G.pool.length) return {end:'Crew wins'};
  if(!pool.length) return ev;
  var tgt;
  if(act.side==='foe'){
    tgt=weightedPick(pool);
  } else if(AIMODE==='naive'){
    var v=pool.filter(function(u){return u.vuln>0});
    tgt=v.length?v[0]:pool.slice().sort(function(a,b){return a.hp-b.hp})[0];
  } else {
    var pickd=chooseTarget(act,pool);
    if(pickd){ tgt=pickd.t; ev.why=pickd.why; }
    else tgt=pool[0];
  }

  if(act.side==='foe'){ G.foeTurns++;
    if(act.broken){
      if(act.skips>0){
        act.skips--; G.supp++; ev.suppressed=true; queueReset(act); return ev;
      }
      ev.recovered=act.id;G.recoveries++;
      act.broken=false; act.vuln=0; act.shL=act.shMax; act.shC=shieldCapacity(act);
      ev.notes.push(act.n+' reforms and attacks.');
    }
    if(!ev.recovered&&SpacologyEnemySummoning.isSummoner(act)&&summonEnemy(act,ev))return ev;
    var special=!ev.recovered?enemyTraitAction(act,tgt,ev):null;
    if(special&&special.handled)return ev;
    if(special)tgt=special.target;
    var protectedAtImpact=tgt&&(tgt.bar>0||tgt.weaverShelter||tgt.recoveryGuard||tgt.lastStandGuard),downsBefore=G.deaths;
    if(act.cleanse&&act.frac){var shed=Math.min(act.frac,act.cleanse);act.frac-=shed;ev.notes.push(act.n+' sheds '+shed+' fracture.');}
    G.foeAttacks++;
    if(act.boss){act.bossAttacks++;if(act.bossAttacks%3===2)ev.notes.push('Boss is charging a heavy strike for its next attack. Break or delay it.');if(act.bossAttacks%3===0)ev.notes.push('Boss releases its heavy strike!');}
    var h0=hit(act,tgt,special?special.plan.scale:act.boss&&act.bossAttacks%3===0?1.8:undefined,{kind:'attack'}); ev.hits.push(h0);
    if(special&&!h0.skipped&&!h0.guarded&&!h0.sheltered&&tgt.alive&&G.deaths===downsBefore){
      if(special.plan.status&&SpacologyEnemyTraits.applyStatus(tgt,special.plan.status,act.id,protectedAtImpact))ev.notes.push(tgt.n+' receives '+special.plan.status+'.');
      if(special.plan.delay&&!protectedAtImpact&&(tgt.delayImmuneUntil||0)<=G.av){tgt.av+=special.plan.delay;tgt.delayImmuneUntil=G.av+100;ev.notes.push(tgt.n+' delayed '+special.plan.delay+' AV.');}
    }
    cascade(ev,act,liveFoes()[0],['hurt']);
    if(tgt.reflect&&tgt.alive){
      ev.reflect=hit(tgt,act,(h0.dmg*tgt.reflect)/Math.max(1,tgt.dmg),{kind:'reflect'});
      ev.hits.push(ev.reflect); }
    queueReset(act); return ev; }

  if(act.summon)return resolveSummonAction(act,ev);
  if(fieldCleanse(act,ev))return ev;

  if(G.aether){
    var actionPlan=planAetherAction(act,tgt);
    if(actionPlan.kind==='basic'){SpacologyAether.recordAction(G.aether,act,actionPlan,G.allyTurns,livingCrew().length);return resolveBasic(act,tgt,ev,actionPlan);}
    var beforeAether=G.aether.current;
    var payment=SpacologyAether.profile(act.n).chain?Object.assign({},actionPlan,{cost:SpacologyAether.skillCost(act)}):actionPlan;
    if(!SpacologyAether.spend(G.aether,payment))throw new Error('Aether changed during action');
    if(actionPlan.discount)delete act.weaverDiscount;
    ev.aether={kind:'skill',spent:payment.cost,delta:-payment.cost,before:beforeAether,after:G.aether.current,reason:actionPlan.reason};
    combatEmit('spend',{actor:act,amount:payment.cost,pool:G.aether,kind:'skill'});
    act.aetherPower=(act.aoe||act.heal||act.kindle?1:1.5)*(actionPlan.extra?1.35:1);
    SpacologyAether.recordAction(G.aether,act,actionPlan,G.allyTurns,livingCrew().length);
  }

  if(G.aether&&act.n==='The Mage')return resolveMageSkill(act,ev);

  if(G.aether&&SpacologyWeavers.crew[act.n])return resolveWeaverSkill(act,tgt,ev,actionPlan);

  if(false && act.en>=EN.cost && act.ult){
    var u=act.ult; act.en=0; G.ults++;
    ev.ult={name:u.name,kind:u.kind};
    var foes=G.units.filter(function(x){return x.side==='foe'&&x.alive});
    if(u.kind==='aoe'){
      foes.forEach(function(x){ ev.hits.push(hit(act,x,u.mult*(act.ultMul||1)));
        if(u.frac) x.frac=Math.min(12,(x.frac||0)+u.frac+((G.bon&&G.bon.stackUp)||0));
        if(u.survey){ x.survey=u.survey; ev.surveyedAll=true; } });
    } else if(u.kind==='nuke'){
      var bt=null,bw=-1e9;
      foes.forEach(function(x){ var sc=(x.frac||0)*1.5+(x.broken?2:0)-x.hp/120;
        if(sc>bw){bw=sc;bt=x} });
      if(bt){ var m=u.mult+(u.eat&&bt.frac?u.eat*bt.frac:0);
        if(u.eat) bt.frac=0;
        ev.hits.push(hit(act,bt,m*(act.ultMul||1))); }
    } else if(u.kind==='mend'){
      livingCrew().forEach(function(a){
        var b4=a.hp; a.hp=Math.min(a.max,a.hp+u.amt);
        var barrier=u.barrier?Math.round(u.barrier*(a.barrierMul||1)):0;
        if(barrier) a.bar=Math.min(60,a.bar+barrier);
        if(u.charge) a.en=Math.min(EN.cost,a.en+u.charge);
        ev.mends=ev.mends||[];
        ev.mends.push({tgt:a.id,amt:a.hp-b4,bar:barrier,ch:u.charge||0}); });
    } else if(u.kind==='lash'){
      var pool2=act.taken*u.mult/Math.max(1,foes.length);
      foes.forEach(function(x){ ev.hits.push(hit(act,x,(pool2/Math.max(1,act.dmg))*(act.ultMul||1))); });
      ev.lashed=Math.round(act.taken); act.taken=0;
    }
    queueReset(act); return ev;
  }
  if(act.heal){
    var hurt=livingCrew().filter(function(u){
      return u.hp/u.max<0.45})
      .sort(function(a,b){return a.hp/a.max-b.hp/b.max});
    if(hurt.length){
      var pt=hurt[0], before2=pt.hp, mendAmt=healAmount(act.heal);
      var room=pt.max-pt.hp, gain=Math.min(room,mendAmt), spill=mendAmt-gain;
      pt.hp+=gain; countHeal(pt,before2);
      gain=Math.round(gain*((G.bon&&G.bon.healMul)||1));
      if(act.over&&spill>0){ var barBefore2=pt.bar; pt.bar=Math.min(90,
        pt.bar+barrierAmount(Math.round(spill*0.8*((G.bon&&G.bon.barrier)||1)*(pt.barrierMul||1)))); countBarrier(pt,barBefore2); }
      G.heals++;
      act.en=Math.min(EN.cost,act.en+EN.act+18);
      ev.heal={src:act.id,tgt:pt.id,amt:gain,bar:act.over?barrierAmount(Math.round(spill*0.8*(pt.barrierMul||1))):0,
               clutch:before2<=18};
      queueReset(act); return ev;
    }
  }
  if(G.bloom&&G.bloom.live&&(act.tags||[]).indexOf('Blight')>=0)
    G.bloom.av=Math.max(0,G.bloom.av-(G.bloom.base/G.blightN)*1.05);
  act.en=Math.min(EN.cost,act.en+EN.act+EN.perHit*(act.aoe?
    G.units.filter(function(x){return x.side==='foe'&&x.alive}).length:1));

  if(act.kindle){
    var kindleTarget=aetherKindleTarget(act),need=kindleTarget?[kindleTarget]:[];
    if(need.length){
      var kt=need[0];
      kt.en=Math.min(EN.cost,kt.en+34);
      advanceAlly(kt,(10000/kt.sp)*0.3);
      act.en=Math.min(EN.cost,act.en+EN.act+12);
      ev.kindle={src:act.id,tgt:kt.id,name:kt.n,full:kt.en>=EN.cost};
      queueReset(act); return ev;
    }
  }
  if(act.aoe){
    var all=G.units.filter(function(x){return x.side==='foe'&&x.alive});
    ev.aoe=true;
    all.forEach(function(x){
      if(canShred(act,x)){
        var b0=x.shL, p0=act.shred*(isWeak(x,act.e)?1:0.5)*((G.bon&&G.bon.shredMul)||1)*(act.guardMul||1);
        while(p0>0&&x.shL>0){ if(p0>=x.shC){p0-=x.shC;x.shL--;x.shC=x.shL>0?shieldCapacity(x):0}
          else{x.shC-=p0;p0=0} }
        if(b0>x.shL) (ev.shreds=ev.shreds||[]).push({id:x.id,from:b0,to:x.shL});
        if(x.shL<=0){ breakEnemy(x,act); (ev.broke2=ev.broke2||[]).push(x.id); }
      }
      if(act.alive&&act.frac){ x.frac=Math.min(12,(x.frac||0)+act.frac+((G.bon&&G.bon.stackUp)||0));
        (ev.fracs=ev.fracs||[]).push(x.id); }
      ev.hits.push(hit(act,x,1,{area:true,kind:'skill'})); if(act.alive)x.struck=true; });
    reactTo(ev,act,all[0],0);
    queueReset(act); return ev;
  }

  if(canShred(act,tgt)){
    var before=tgt.shL, match=isWeak(tgt,act.e);
    var p=act.dmg*(match?1:UNMATCHED)*((G.bon&&G.bon.shredMul)||1)*(act.guardMul||1);
    while(p>0&&tgt.shL>0){ if(p>=tgt.shC){p-=tgt.shC;tgt.shL--;tgt.shC=tgt.shL>0?shieldCapacity(tgt):0}
      else{tgt.shC-=p;p=0} }
    ev.shield={id:tgt.id,from:before,to:tgt.shL,match:match};
    if(tgt.shL<=0){
      breakEnemy(tgt,act);
      if(G.bon&&G.bon.overstrike){ var h2=hit(act,tgt,0.9,{kind:'chain'}); h2.over=true; ev.chains.push(h2); }
      ev.broke=tgt.id;
      var al=livingCrew().filter(function(u){
        return u.e===act.e&&u.id!==act.id});
      if(al.length){ G.chains++; G.longest=Math.max(G.longest,al.length+1);
        al.forEach(function(a){ ev.chains.push(hit(a,tgt,HARM*(a.followMul||1),{kind:'chain'})); }); }
      cascade(ev,act,tgt,['break']);
    }
  }
  // A crewmate felled earlier in this action (a hook's counterattack) marks, fractures and strikes nothing more.
  if(act.alive&&act.marks){ tgt.survey=act.marks; ev.surveyed=tgt.id; }
  if(act.alive&&act.frac){ tgt.frac=Math.min(12,(tgt.frac||0)+act.frac+((G.bon&&G.bon.stackUp)||0));
    ev.fracs=[tgt.id];
    if(act.spreadExtra){G.units.filter(function(x){return x.side==='foe'&&x.alive&&x.id!==tgt.id}).slice(0,act.spreadExtra).forEach(function(x){x.frac=Math.min(12,(x.frac||0)+act.frac);ev.fracs.push(x.id)})} }
  var scale=1;
  if(act.consume&&tgt.frac){ scale += act.consume*tgt.frac/Math.max(1,act.dmg); tgt.frac=0;
    ev.consumed=true; }
  if(act.follow&&tgt.struck){ scale *= (1+act.follow); ev.followed=true;
    var q=G.units.filter(function(u){
      return u.side==='ally'&&u.alive&&u.follow&&u.id!==act.id})
      .sort(function(a,b){return a.av-b.av});
    if(q.length){ var nx=q[0];
      advanceAlly(nx,(10000/nx.sp)*0.5);
      ev.advanced={id:nx.id,name:nx.n}; } }
  ev.hits.push(hit(act,tgt,scale===1?undefined:scale,{kind:'skill'}));
  if(act.extraTargets){G.units.filter(function(x){return x.side==='foe'&&x.alive&&x.id!==tgt.id}).slice(0,act.extraTargets).forEach(function(x){ev.hits.push(hit(act,x,.7,{kind:'skill',single:false}))})}
  if(act.dbl && tgt.survey>0 && tgt.alive){
    var h2=hit(act,tgt,0.7,{kind:'follow'}); h2.dbl=true; ev.chains.push(h2); G.doubles++; }
  if(act.alive)tgt.struck=true;
  reactTo(ev,act,tgt,0);
  queueReset(act);
  return ev;
}
function actsIn(u){
  var q=project(9);
  for(var i=0;i<q.length;i++) if(q[i].u.id===u.id) return i;
  return 9;
}
function evalTarget(act,t,pool){
  var w = AIMODE==='uniform' ? UNIFORM : (PROFILES[act.p]||UNIFORM);
  var match = isWeak(t,act.e);
  var chip = act.dmg*(match?1:UNMATCHED);
  var shieldLeft = t.broken ? 0 : ((t.shL-1)*shieldCapacity(t) + t.shC);
  var eff = Math.round(act.dmg*(1+(t.vuln>0?BRK.vuln:0)));
  var willBreak = !t.broken && shieldLeft>0 && chip>=shieldLeft;
  var willKill = t.broken||shieldLeft<=0 ? eff>=t.hp : false;
  var soon = actsIn(t);
  var f={}, why='';

  // finishing a break is worth far more than starting one
  f.brk = willBreak ? 1 : (shieldLeft>0 ? Math.max(0,1-shieldLeft/Math.max(1,chip*3))*0.55 : 0);
  f.kill = willKill ? 1 : (t.broken? Math.min(.8, eff/Math.max(1,t.hp))*0.6 : 0);
  f.vuln = t.vuln>0 ? 1 : (t.broken?0.55:0);
  f.threat = (1-Math.min(1,soon/6)) * (t.broken?0.25:1) * (t.dmg/30)+SpacologyEnemyTraits.threat(t);
  f.bulk = Math.min(1,t.hp/190);
  f.match = match?1:0;
  // waste: penalty for oversized damage into a nearly dead target
  f.waste = (t.broken&&t.hp>0) ? -Math.max(0,(eff-t.hp)/Math.max(1,eff)) : 0;
  f.piled = (act.follow && t.struck) ? 1 : 0;
  if(t.survey>0 && !act.marks) f.piled = 1;
  if(act.marks && t.survey<=0) f.piled = 0.9;

  // focus fire: prefer whoever needs the fewest remaining turns to finish
  function workOf(x){
    var sl2 = x.broken ? 0 : ((x.shL-1)*shieldCapacity(x) + x.shC);
    var c2  = act.dmg*(isWeak(x,act.e)?1:UNMATCHED);
    var e2  = Math.max(1, Math.round(act.dmg*(1+(x.vuln>0?BRK.vuln:0))*
                ((!x.broken&&sl2>0)?SOAK:1)));
    return sl2/Math.max(1,c2) + x.hp/e2;
  }
  var mine=workOf(t);
  var worst=mine;
  (pool||[t]).forEach(function(x){ worst=Math.max(worst,workOf(x)); });
  f.focus = 1 - Math.min(1, mine/Math.max(0.001,worst));

  var score=0, best=-1;
  ['focus','brk','kill','vuln','threat','bulk','match','waste','piled'].forEach(function(k){
    var v=(f[k]||0)*(w[k]||0);
    if(!isFinite(v)) v=0;
    score+=v;
    if(v>best && k!=='waste'){ best=v; why=k; }
  });
  if(!isFinite(score)) score=0;
  var label={piled:'piling on',focus:'finishing what is started',
    brk:willBreak?'finishing the break':'wearing the shield down',
    kill:willKill?'going for the kill':'closing it out',
    vuln:'hitting the exposed one',threat:'delaying the next attacker',
    bulk:'biggest health pool',match:'matched element'}[why]||'nearest';
  return {score:score,why:label,willBreak:willBreak,willKill:willKill};
}
function chooseTarget(act,pool){
  if(act.side==='ally')pool=treasureTargets(pool);
  if(!pool||!pool.length) return null;
  var best={t:pool[0],why:'nearest'}, bw=-Infinity;
  pool.forEach(function(t){
    var e=evalTarget(act,t,pool);
    var sc=e.score*(1+(rng()-0.5)*0.06);
    if(isFinite(sc)&&sc>bw){ bw=sc; best={t:t,why:e.why}; }
  });
  return best;
}
function liveFoes(){ return G.units.filter(function(u){return u.side==='foe'&&u.alive}); }
function retarget(cur){
  var fs=liveFoes(); if(!fs.length) return null;
  if(RETARGET==='same') return (cur&&cur.alive)?cur:null;
  if(RETARGET==='redirect') return (cur&&cur.alive)?cur:fs[Math.floor(rng()*fs.length)];
  if(RETARGET==='spread'){ var o=fs.filter(function(f){return f!==cur});
    return o.length?o[Math.floor(rng()*o.length)]:fs[0]; }
  return fs[Math.floor(rng()*fs.length)];
}
// a follow-up can set off further follow-ups; budget and cap stop the runaway
function cascade(ev,src,cur,events){
  if(ev.chains.length>=CHAINCAP) return;
  G.units.filter(function(r){
    return r.side==='ally'&&r.alive&&r.trig&&r.id!==src.id;
  }).forEach(function(r){
    if(ev.chains.length>=CHAINCAP) return;
    if(events.indexOf(r.trig)<0) return;
    G.react[r.id]=G.react[r.id]||0;
    if(G.react[r.id]>=(r.react||1)) return;
    var t=retarget(cur); if(!t) return;
    G.react[r.id]++; G.follows++;
    for(var k=0;k<(r.hits||1);k++){
      var t2=retarget(t); if(!t2) break;
      if(t2.survey>0) t2.survey--;
      var h=hit(r,t2,r.ratio*(r.followMul||1),{kind:'follow'}); h.follow=true; h.depth=ev.chains.length;
      ev.chains.push(h);
      ev.touched=ev.touched||{}; ev.touched[t2.id]=1;
      var evs=['ally'];
      if(t2.survey>0) evs.push('mark');
      if(h.killed) evs.push('kill');
      cascade(ev,r,t2,evs);
    }
    G.units.filter(function(m){
      return m.side==='ally'&&m.alive&&m.onFollow;
    }).forEach(function(m){
      var nx=G.units.filter(function(u){
        return u.side==='ally'&&u.alive&&u.id!==m.id&&(!ev.actor||ev.interrupt||u.id!==ev.actor.id)})
        .sort(function(a,b){return a.av-b.av})[0];
      if(nx){ advanceAlly(nx,(10000/nx.sp)*0.45);
        ev.advanced={id:nx.id,name:nx.n,by:m.n}; }
    });
  });
}
function reactTo(ev,src,tgt,depth){
  if(!tgt) return;
  var evs=['ally'];
  if(tgt.survey>0) evs.push('mark');
  cascade(ev,src,tgt,evs);
}
function weightedPick(pool){
  // spread damage, but lean toward the wounded so pressure still builds
  var front=pool.filter(function(u){return u.row==='front'});
  if(window.SPACOLOGY_SESSION){pool=front;if(!pool.length)return null;}
  if(front.length) pool=front.concat(pool.filter(function(u){return u.row!=='front'}));
  var ws=pool.map(function(u){
    var w=(1 + 1.6*(1-u.hp/u.max))*(u.taunt||1);
    if(u.row==='back') w *= front.length? 0.18 : 1;
    return w; });
  var sum=ws.reduce(function(a,b){return a+b},0), r=rng()*sum;
  for(var i=0;i<pool.length;i++){ r-=ws[i]; if(r<=0) return pool[i]; }
  return pool[pool.length-1];
}
// An extra enemy attack, for hooks: foe strikes target, or whoever its usual targeting picks, without spending its
// turn. It lands like the attack on a turn (back-row and summoned crew are spared as there, follow-ups on 'hurt'
// trigger, a Reflector answers) and is added to the current action's hits. A listener that answers attacks with
// attacks must stop itself. A Broken enemy can strike; a fallen one and the treasure carrier, which never attacks,
// cannot. Returns the hit, or null if there was nothing to attack.
function enemyAttack(foe,target){
  if(!G||!foe||foe.side!=='foe'||!foe.alive||foe.treasure)return null;
  var tgt=target||weightedPick(G.units.filter(function(u){return u.side==='ally'&&u.alive&&!u.summon}));
  if(!tgt||tgt.side!=='ally'||!tgt.alive)return null;
  var extra=G.hookHits||(G.hookHits=[]),h=hit(foe,tgt,undefined,{kind:'attack'});
  extra.push(h);
  if(h.skipped)return h;
  G.foeAttacks++;
  var answer={actor:foe,hits:[],chains:[],notes:[]};
  cascade(answer,foe,liveFoes()[0],['hurt']);
  extra.push.apply(extra,answer.chains);
  if(tgt.reflect&&tgt.alive&&foe.alive)extra.push(hit(tgt,foe,(h.dmg*tgt.reflect)/Math.max(1,tgt.dmg),{kind:'reflect'}));
  return h;
}
function hit(src,tgt,scale,options){
  options=options||{};
  if(!src||!tgt||!src.alive||!tgt.alive||(window.SPACOLOGY_SESSION&&src.side==='foe'&&tgt.side==='ally'&&(tgt.row==='back'||tgt.summon)))return {src:src&&src.id,tgt:tgt&&tgt.id,dmg:0,skipped:true};
  var hpBefore=tgt.hp,barBefore=tgt.bar||0,stoodBefore=!!tgt.lastStandUsed;
  var h=(tgt.lastStandGuard||tgt.recoveryGuard)&&src.side==='foe'?{src:src.id,tgt:tgt.id,dmg:0,guarded:true}:resolveHitDamage(src,tgt,scale,options);
  h.hpBefore=hpBefore;h.hpAfter=tgt.hp;h.barBefore=barBefore;h.barAfter=tgt.bar||0;
  h.lastStand=!stoodBefore&&!!tgt.lastStandUsed;
  settleEnemyTraits();
  if(G.damageTimeline)G.damageTimeline.push(h);
  afterHit(src,tgt,h,options);
  return h;
}
// A hit's kind and whether it is the action's single target. Hooks and metrics read these; the event stream never does.
function hitKind(src,options){return options.kind||(src.side==='foe'?'attack':'skill')}
// The unit hooks are told dealt a hit: src, or options.source where the hit was dealt by a stand-in (a status tick's
// living copy of its source). null means the source is not in the fight: the hit lands, but hooks do not hear of it.
function hookSource(src,options){return 'source' in options?options.source:src}
function hitSingle(kind,options){
  if(options.single!==undefined)return !!options.single;
  return !options.area&&!options.transfer&&!options.condition&&(kind==='basic'||kind==='skill'||kind==='ult');
}
// Counts a landed hit and tells the hooks. A guarded or sheltered hit landed for nothing, so it is reported with dmg 0.
function afterHit(src,tgt,h,options){
  var kind=hitKind(src,options),single=hitSingle(kind,options),m=G.metrics;
  var broke=!!(G.justBroke&&G.justBroke[tgt.id]===src.id&&kind!=='chain'&&kind!=='follow');
  if(broke)delete G.justBroke[tgt.id];
  if(m){
    if(src.side==='ally'&&tgt.side==='foe')m.byKind[kind]=(m.byKind[kind]||0)+(h.dmg||0);
    if(tgt.side==='ally'){m.taken+=h.dmg||0;m.absorbed+=h.absorbed||0;}
  }
  var by=hookSource(src,options);if(!by)return;
  combatEmit('afterHit',{src:by,tgt:tgt,kind:kind,single:single,broke:broke,dmg:h.dmg||0,absorbed:h.absorbed||0,killed:!!h.killed,hit:h});
  if(tgt.side==='ally')combatEmit('afterIncoming',{src:by,tgt:tgt,kind:kind,dmg:h.dmg||0,absorbed:h.absorbed||0,hit:h});
}
function resolveHitDamage(src,tgt,scale,options){
  options=options||{};
  if(tgt.side==='ally'&&tgt.weaverShelter&&src.side==='foe'){
    delete tgt.weaverShelter;
    return {src:src.id,tgt:tgt.id,dmg:0,absorbed:0,soaked:true,killed:false,chain:!!scale,cost:0,sheltered:true};
  }

  var amt=src.dmg*(scale||1)*(src.aetherPower||1)*SpacologyEnemyTraits.damageMultiplier(src,G.units);
  if(src.side==='ally'&&src.openingBoost&&!src.openingUsed){amt*=1+src.openingBoost;src.openingUsed=true;}
  var flat=options.flat;
  if(src.side==='foe'&&COMBAT_RULES.enemyAtkMul!==1){if(flat===undefined)amt*=COMBAT_RULES.enemyAtkMul;else flat=Math.round(flat*COMBAT_RULES.enemyAtkMul);}
  var by=hookSource(src,options);
  if(by&&combatHooked('outgoing')&&!options.transfer){ // a guard's share was already shaped as part of the original hit
    var kind=hitKind(src,options),out={src:by,tgt:tgt,kind:kind,single:hitSingle(kind,options),amount:flat===undefined?amt:flat};
    var factor=combatEmit('outgoing',out);
    if(typeof factor==='number'&&isFinite(factor))out.amount*=factor;
    var amount=Math.max(0,Number(out.amount)||0);
    if(flat===undefined)amt=amount;else flat=Math.round(amount);
  }
  var mult=1+(tgt.vuln>0?BRK.vuln:0)+(tgt.frac||0)*0.12;
  var soaked=false, absorbed=0;
  if(tgt.side==='foe'&&!tgt.broken&&tgt.shL>0){ mult*=SOAK; soaked=true; }
  var d=flat===undefined?Math.round(amt*mult):flat;
  if(tgt.side==='foe'&&!options.area&&!options.transfer){
    var guard=SpacologyEnemyTraits.protector(tgt,G.units);
    if(guard&&d>0){var shared=Math.floor(d*.35);d-=shared;if(shared){hit(src,guard,1,{flat:shared,transfer:true,kind:'transfer'});traitNote(guard.n+' intercepts '+shared+' damage for '+tgt.n+'.');}}
  }
  if(tgt.side==='ally'&&G.ship&&G.ship.brace>0&&d>0){d=Math.max(1,Math.round(d*.6));G.ship.brace--;} // a hit of 0 (enemyAtkMul, outgoing) stays 0 and keeps the charge
  G.biggest=Math.max(G.biggest,d);
  if(src.side==='ally'){G.dealt[src.n]=(G.dealt[src.n]||0)+d;G.alliedHits=(G.alliedHits||0)+1;if(soaked)G.shieldedHits=(G.shieldedHits||0)+1;}
  var rawIn=d;
  if(tgt.side==='ally'&&tgt.bar>0){
    var soak2=Math.min(tgt.bar,d); tgt.bar-=soak2; d-=soak2;
    if(soak2>0){ G.barSoak=(G.barSoak||0)+soak2; absorbed=soak2;
      if(G.bon&&G.bon.ammo&&src.side==='foe'&&src.alive&&!options.condition){
        var back=Math.round(rawIn*0.9);
        src.hp=Math.max(0,src.hp-back);
        G.ammoDmg=(G.ammoDmg||0)+back;
        if(G.metrics)G.metrics.byKind.reflect=(G.metrics.byKind.reflect||0)+back;
        if(src.hp<=0&&src.alive) src.alive=false; } }
  }
  var hpBeforeDamage=tgt.hp;
  tgt.hp=Math.max(0,tgt.hp-d);
  if(tgt.side==='ally'&&tgt.hp<=0&&!tgt.lastStandUsed&&window.SPACOLOGY_SESSION&&SpacologyDownRecovery.mode(window.SPACOLOGY_SESSION)==='lastStand'){
    tgt.hp=1;tgt.lastStandUsed=true;tgt.lastStandGuard=true;d=Math.max(0,hpBeforeDamage-1);G.lastStands=(G.lastStands||0)+1;
  }
  if(tgt.side==='ally'){ G.lowest=Math.min(G.lowest,tgt.hp); if(G.metrics&&!tgt.summon)G.metrics.lowestHp=G.metrics.lowestHp===null?tgt.hp:Math.min(G.metrics.lowestHp,tgt.hp); // before any revival: a downed crewmate reached 0
    tgt.en=Math.min(EN.cost,tgt.en+EN.taken); tgt.taken+=d; }
  var killed=false, cost=0,revival=null;
  if(tgt.hp<=0&&tgt.alive){ tgt.alive=false; killed=true;
    if(tgt.side==='ally')SpacologyEnemyTraits.cleanse(tgt);
    if(tgt.side==='ally'){ G.deaths++; G.downed.push(tgt.n);
      if(!window.SPACOLOGY_SESSION){G.limit=Math.max(G.round+1,G.limit-DEATHCOST);cost=DEATHCOST;}
      else{revival=SpacologyDownRecovery.recover(window.SPACOLOGY_SESSION,tgt,G);if(revival)killed=false;} } }
  if(G.aether&&!options.condition&&src.side==='foe'&&tgt.n==='Daven'&&tgt.alive&&!revival&&absorbed>0&&!tgt.weaverRefundUsed){
    tgt.weaverRefundUsed=true;SpacologyAether.credit(G.aether,combatGain(tgt,1,'refund'));G.weaverRefunds=(G.weaverRefunds||0)+1;
  }
  accelerateEnemy(tgt,d);
  if(src.side==='ally'&&src.drain&&src.alive&&src.hp<src.max){
    var back=healAmount(Math.round(d*src.drain)),drainedFrom=src.hp;
    src.hp=Math.min(src.max,src.hp+back); countHeal(src,drainedFrom); G.drains++;
    return {src:src.id,tgt:tgt.id,dmg:d,vuln:tgt.vuln>0,soaked:soaked,killed:killed,
            chain:!!scale,cost:cost,drain:back}; }
  return {src:src.id,tgt:tgt.id,dmg:d,vuln:tgt.vuln>0,soaked:soaked,absorbed:absorbed,
          killed:killed,chain:!!scale,cost:cost,revival:revival};
}

/* ---- Battle analysis (watchable-fight.html, lines 2950–2962 before extraction) ---- */
/* ============ finish ============ */
function battleAnalysis(){
  var remaining=G.units.filter(function(u){return u.side==='foe'&&u.alive&&!u.treasure});
  var unspawned=Math.max(0,G.pool.length-G.spawned),shieldShare=G.alliedHits?Math.round(G.shieldedHits/G.alliedHits*100):0;
  var notes=[];
  if(unspawned)notes.push(unspawned+' enemies in later waves were not reached.');
  if(remaining.length)notes.push(remaining.length+' enemies still active'+(remaining.length===1?': '+remaining[0].n+' at '+Math.ceil(remaining[0].hp/remaining[0].max*100)+'% health':'')+'.');
  if(shieldShare>=50)notes.push(shieldShare+'% of your hits landed into shields; matching Weaknesses and shield damage can open longer damage windows.');
  if(G.deaths)notes.push(G.deaths+' crew went down, reducing your available actions.');
  if(G.recoveries>=3)notes.push(G.recoveries+' enemy recoveries closed break windows; coordinate burst or delay their turns.');
  if(!notes.length)notes.push('Compare damage per turn with crew turns to choose between stronger hits and faster rotations.');
  return {crewTurns:G.allyTurns||0,advances:G.advances||0,savedAV:Math.round(G.advanceSaved||0),shieldShare:shieldShare,remaining:remaining.length+unspawned,notes:notes};
}

/* ---- Voyage encounter: the crew, ship and encounter settings for one voyage battle (was in the page's loadSpacologySession) ---- */
// Pure: works on a normalised copy of the voyage state and never writes storage. The page persists its own normalisation.
// Temporary mechanical bridge from the 28-character lore roster to the proven combat prototypes. Display names,
// elements, tags, stats, art and kit copy remain canonical; only the underlying action implementation is borrowed
// until each new kit receives its dedicated combat verbs.
var VOYAGE_ALIASES={
  Ilka:'Wex',Reva:'Tarn','Tomás':'Ferrule',Ojo:'Ballast',Stella:'Ash',Nour:'Cinder',
  Dolores:'Pyre',Spore:'Sump',Abike:'Sump',Aurel:'Vane',Imke:'Nettle',Idris:'Mote',
  Beatriz:'Corr',Otaremnivas:'Ballast',Wren:'Maul',Nadira:'Quill',Yusuf:'Vitre',
  Sevim:'Rime',Aurelio:'Ledger',Nahana:'Fen',Navigator:'Mire',Ekene:'Halo',
  Coda:'Vane',Morrow:'Ash',Latch:'Nettle'
};
function voyageEncounter(source){
  var state=JSON.parse(JSON.stringify(source));
  // A state the game never normalised has no treasure seed; derive one rather than let normalize roll a random one.
  if(!state.treasureSeed)state.treasureSeed='voyage-'+(state.seed||'star-singer');
  SpacologyFormation.normalize(state);SpacologyTreasure.normalize(state);
  state.difficulty=SpacologyVoyageSettings.normalize(state).difficulty;
  var difficulty=SpacologyVoyageSettings.difficulties[state.difficulty];
  var rules=SpacologyExpedition,modifierEffects=rules.effects(state);
  var library={};
  Object.keys(TEAMS).forEach(function(key){if(key!=='ops')TEAMS[key].crew.forEach(function(c){if(!library[c.n])library[c.n]=c;});});
  var all=state.field.concat(state.support).filter(Boolean);
  var planetHealth=rules.planetHealth(all);
  var crew=all.map(function(name){
    var source=rules.crew[name]?.combat||library[name]||library[VOYAGE_ALIASES[name]]||library.Corr;
    var c=JSON.parse(JSON.stringify(source));
    c.n=name;c.row=state.field.indexOf(name)>=0?'front':'back';
    if(rules.crew[name]){c.e=rules.crew[name].element;c.tags=rules.crew[name].tags.slice();}
    var canonical=rules.crew[name]?.combat?rules.crew[name].stats:state.combatStats&&state.combatStats[name];
    if(canonical){c.hp=canonical.hp;c.dmg=canonical.dmg;c.sp=canonical.speed*10;}
    var rank=(state.crewUpgrades&&state.crewUpgrades[name])||0;
    c.hp=Math.round((c.hp||100)*SpacologyCrew.bonuses(rank).hp*planetHealth);
    c.dmg=Math.round(c.dmg*SpacologyCrew.bonuses(rank).attack*modifierEffects.crewDamage);
    var gear=(state.equipped&&state.equipped[name])||[];
    gear.forEach(function(item){
      if(item==='Tuning Fork'&&c.frac)c.frac++;
      if(item==='Spore Sling')c.spreadExtra=(c.spreadExtra||0)+1;
      if(item==='Ranging Sight')c.extraTargets=(c.extraTargets||0)+1;
      if(item==='Loaded Die')c.openingBoost=(c.openingBoost||0)+.2;
      if(item==='Recoil Spring')c.followMul=(c.followMul||1)*1.3;
      if(item==='Quick Latch')c.startAdvance=(c.startAdvance||0)+8;
      if(item==='Ballast Plate')c.barrierMul=(c.barrierMul||1)*1.3;
      if(item==='Slow Fuse')c.ultMul=(c.ultMul||1)*1.25;
      if(item==='Bore Bit')c.guardMul=(c.guardMul||1)*1.4;
      var recipe=rules.recipes.find(function(r){return r.name===item});
      if(recipe)Object.keys(recipe.stats).forEach(function(key){var value=recipe.stats[key];if(key==='frac'){if(c.frac)c.frac+=value;}else if(/Mul$/.test(key))c[key]=(c[key]||1)*value;else c[key]=(c[key]||0)+value;});
    });
    return c;
  });
  var ship={brace:0,survey:0};
  (state.shipEquipped||[]).filter(Boolean).forEach(function(item){
    var part=rules.shipParts[item];if(!part)return;
    crew.forEach(function(c){
      if(part.stacks&&c.frac)c.frac+=part.stacks;
      if(part.startEnergy)c.startEnergy=Math.min(100,(c.startEnergy||0)+part.startEnergy);
      if(part.startAdvance)c.startAdvance=(c.startAdvance||0)+part.startAdvance;
    });
    ship.brace+=part.brace||0;ship.survey=Math.max(ship.survey,part.survey||0);
  });
  var g={};
  g.OPS_RUN_ROUND=state.round;g.OPS_NODE=SpacologyVoyage.current(state);
  g.OPS_FACTION=FACTION_ORDER[(state.round-1)%FACTION_ORDER.length];
  g.OPS_PLANET=globalThis.SpacologyEnemyCatalogue?globalThis.SpacologyEnemyCatalogue.generatePlanet('voyage-'+(state.seed||'star-singer')+'-'+state.round):null;
  g.OPS_HP=(1+(state.round-1)*.22)*difficulty.enemyScale*modifierEffects.enemyHp;
  g.OPS_DMG=(.9+(state.round-1)*.16)*difficulty.enemyScale*modifierEffects.enemyDamage;
  g.OPS_SPEED=(1+(state.round-1)*.025)*difficulty.enemySpeed;
  g.OPS_GUARD=(1+(state.round-1)*.06)*difficulty.enemyGuard;
  g.OPS_RECOVERY=difficulty.breakDelay;
  g.OPS_PRESSURE=g.OPS_HP;
  g.FIELD=[3,3,4,4,5,6][Math.min(5,state.round-1)];
  g.OPS_WAVES=[2,2,2,3,3,3][Math.min(5,state.round-1)];
  if(g.OPS_NODE){var profile=SpacologyVoyage.profile(state);g.OPS_HP=profile.hp*modifierEffects.enemyHp;g.OPS_DMG=profile.damage*modifierEffects.enemyDamage;g.OPS_SPEED=profile.speed;g.OPS_GUARD=profile.guard;g.OPS_RECOVERY=profile.recovery;g.FIELD=profile.field;g.OPS_WAVES=profile.waves;g.OPS_PRESSURE=g.OPS_HP;}
  g.POOL=g.FIELD*g.OPS_WAVES;
  g.MAXROUND=SpacologyVoyageSettings.roundLimit(state);
  return {session:state,crew:crew,ship:ship,globals:g,difficulty:difficulty};
}
// Installs an encounter: the crew becomes TEAMS.ops and the encounter settings become the rules' globals.
function applyVoyageEncounter(enc){
  TEAMS.ops={note:'<b>Ops formation</b> &mdash; exact crew rows and equipped Gear carried from the Ops room.',crew:enc.crew,ship:enc.ship};
  var g=enc.globals;
  OPS_RUN_ROUND=g.OPS_RUN_ROUND;OPS_NODE=g.OPS_NODE;OPS_FACTION=g.OPS_FACTION;OPS_PLANET=g.OPS_PLANET;
  OPS_HP=g.OPS_HP;OPS_DMG=g.OPS_DMG;OPS_SPEED=g.OPS_SPEED;OPS_GUARD=g.OPS_GUARD;OPS_RECOVERY=g.OPS_RECOVERY;OPS_PRESSURE=g.OPS_PRESSURE;
  FIELD=g.FIELD;OPS_WAVES=g.OPS_WAVES;POOL=g.POOL;MAXROUND=g.MAXROUND;
}
