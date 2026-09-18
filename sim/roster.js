// ============================================================================
//  Six tags, two tiers each.  Entry at 2 is mild and splashable; the tier at 4
//  changes a rule rather than a number.  Every applier ships with a spender.
// ============================================================================
module.exports.TAGS={
  Tank:    {2:'barriers 45% larger',
            4:'AMMUNITION \u2014 damage a shield swallows is returned to the attacker'},
  DoT:  {2:'one extra stack per application',
            4:'BLOOM \u2014 a bloom joins the turn order; every DoT action pulls it '+
              'forward; when it acts it detonates every DoT stack on the board'},
  Speed:   {2:'the crew act 12% sooner',
            4:'RELAY \u2014 a crew kill immediately advances the next crewmate'},
  DPS:{2:'20% more damage',
            4:'OVERSTRIKE \u2014 a hit that breaks a shield lands a second time'},
  Breaker:   {2:'shields shredded 60% faster',
            4:'DISSECTION \u2014 break costs the enemy two turns instead of one'},
  Healer:    {2:'healing 50% stronger',
            4:'RELIEF \u2014 the first crew member to fall is brought back once'}
};

// Anti-synergy, stated on purpose:
//   Breaker delays enemies.  DoT needs enemies to act so ailments tick.
//   A team leaning on both fights itself.  That is the point.

module.exports.CHARS={
  // ---- Tank: protection, and the carry that turns protection into damage ----
  Wex:    {tags:['Tank','Healer'],   dmg:9,  speed:104, shield:34,
           bio:'Tank tech. Patches things before they fail, including people.'},
  Tarn:   {tags:['Tank','DPS'],dmg:7, speed:82,  hpMul:.80, thorns:4.4, taunt:6,
           needsShield:1,
           bio:'Wears the ship\u2019s old boarding plate. Steps in front of everything '+
               'and lets it hit her.'},
  Ferrule:{tags:['Tank','DPS'],dmg:13,speed:88,  shield:22, shieldOnHit:1,
           bio:'Welder. Throws plating overheal whoever is nearest when she swings.'},
  Ballast:{tags:['Tank'],          dmg:13, speed:74,  hpMul:1.5, taunt:3, lifesteal:.3,
           bio:'Was cargo crew. Absorbs punishment and keeps walking.'},

  // ---- DoT: appliers and the spender they exist for ----
  Ash:    {tags:['DoT'],        dmg:8,  speed:100, appliesDot:1, dotPerHit:2, aoe:1, armorShred:12,
           bio:'Xeno-chemist. Aerosolises samples and lets the wind do the rest.'},
  Cinder: {tags:['DoT','DPS'],dmg:12,speed:94,appliesDot:1, dotPerHit:3,
           bio:'Reactor tech. Everything she touches keeps burning after she leaves.'},
  Pyre:   {tags:['DoT'],        dmg:11, speed:92,  detonate:1,
           bio:'Demolitions. Waits for the pile to get big enough, then lights it.'},
  Sump:   {tags:['DoT','Healer'], dmg:9,  speed:98,  appliesDot:1, dotPerHit:1, dotSpread:1, heal:18,
           bio:'Field biologist. Corruption jumps hosts when one dies; she counts on it.'},

  // ---- Speed: turn order as a resource ----
  Vane:   {tags:['Speed','Healer'],  dmg:9,  speed:112, turnBoost:.5,
           bio:'Helm. Reads the flow of a fight and shoves people into it early.'},
  Nettle: {tags:['Speed'],         dmg:8,  speed:120, procOn:'ally', procMax:4, procDmg:.42,
           bio:'Too fast, too eager. Fires whenever anyone else does.'},
  Mote:   {tags:['Speed','Breaker'], dmg:9,  speed:116, aoe:1, armorShred:14,
           bio:'Survey drone pilot. Sweeps the whole line looking for cracks.'},

  // ---- DPS: the payoff for everything else ----
  Corr:   {tags:['DPS'],      dmg:25, speed:84,
           bio:'Ship\u2019s gunner. One target. One number.'},
  Bosk:   {tags:['DPS','Tank'],dmg:17,speed:80,  hpMul:1.25,
           bio:'Ex-salvage. Enormous, patient, hits like falling cargo.'},
  Maul:   {tags:['DPS','Breaker'],dmg:20,speed:70, procOn:'break', procMax:1, procDmg:2.2,
           bio:'Waits for something to crack, then puts everything into the gap.'},

  // ---- Breaker: read the enemy, open it up ----
  Quill:  {tags:['Breaker','DoT'],dmg:9,  speed:110, marks:3,
           bio:'Xeno-botanist. Tags every specimen before she touches it.'},
  Vitre:  {tags:['Breaker','Speed'], dmg:8,  speed:108, marks:2, aoe:1, armorShred:10,
           bio:'Sensor officer. Paints the whole line at once, lightly.'},
  Rime:   {tags:['Breaker'],         dmg:9,  speed:98,  aoe:1, armorShred:19,
           bio:'Cryo-analyst. Freezes a shell until it fractures on its own.'},
  Ledger: {tags:['Breaker','Speed'], dmg:13, speed:96,  procOn:'mark', procMax:2, procDmg:.8,
           bio:'Ship archivist. Answers every hit on anything Quill has written down.'},

  // ---- Healer: the ones who keep it standing ----
  Fen:    {tags:['Healer'],          dmg:6,  speed:106, heal:30,
           bio:'Ship medic. Treats the crew like equipment: patched before it fails.'},
  Mire:   {tags:['Healer','Tank'],   dmg:10, speed:100, heal:24, overheal:1, thorns:.5,
           bio:'Navigator. Calm, unhurried, hits back without seeming to notice.'},
  Halo:   {tags:['Healer','Speed'],  dmg:7,  speed:94,  energyGain:36,
           bio:'Reactor engineer. Gives away her own power and runs cold doing it.'}
};

// ============================================================================
//  Enemies.  Only archetypes that actually discriminate between builds earn a
//  name.  Four earlier ones were cut for moving every build equally.
// ============================================================================
module.exports.FOEKIND={
  swarm:   {hp:.55,dmg:.5, armorLayers:1,speed:96,
            note:'numerous and disposable \u2014 the fight where your build just works'},
  bruiser: {hp:1.7, dmg:1.1,armorLayers:2,speed:74,
            note:'slow and heavy \u2014 a mild tax on everyone'},
  armored:  {hp:1.15,dmg:.5, armorLayers:7,speed:82, dotTaken:2.1,
            note:'enormous shields, soft underneath, and damage over time walks straight past them'},
  cleanser:{hp:1.1, dmg:.8, armorLayers:2,speed:104,cleanse:.45,
            note:'cleanses a share of the DoT you put on it'},
  reflector:{hp:.95,dmg:.7, armorLayers:2,speed:90, thorns:.34,
            note:'answers each hit with a little of its own \u2014 punishes cascades'},
  // new, written against the new tags
  buffer:  {hp:1.2, dmg:.5, armorLayers:2,speed:88, buffAllyDmg:.14,
            note:'strengthens every other enemy \u2014 punishes a slow clear'},
  guardian: {hp:1.3, dmg:.7, armorLayers:3,speed:86, protectAlly:.3,
            note:'shelters the enemy beside it \u2014 the answer to single-target burst'},
  fast:{hp:.8, dmg:.6, armorLayers:1,speed:128,
            note:'acts twice as often \u2014 punishes teams that need setup turns'}
};

// ============================================================================
//  Planet conditions.  This is the meta dial: rotate these and the best team
//  changes without a single balance edit.
// ============================================================================
module.exports.WORLDS={
  open:     {note:'nothing unusual', speedMul:1,
             mix:[['swarm',9],['bruiser',4],['armored',3]]},
  murk:     {note:'low visibility \u2014 everyone acts slower', speedMul:.72,
             mix:[['swarm',9],['bruiser',4],['armored',3]]},
  hive:     {note:'a tide of small things', speedMul:1,
             mix:[['swarm',18],['fast',5]]},
  fortress: {note:'a few very tough things', speedMul:1,
             mix:[['bruiser',3],['guardian',3],['armored',2]]},
  bloom:    {note:'the Null is thick here \u2014 damage over time bites harder', speedMul:1,
             ailMul:1.8, mix:[['swarm',10],['cleanser',4],['bruiser',3]]},
  cascade:  {note:'everything here answers back', speedMul:1.1,
             mix:[['reflector',5],['swarm',8],['buffer',3]]}
};
