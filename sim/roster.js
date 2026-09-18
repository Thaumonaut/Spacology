// ============================================================================
//  Six tags, two tiers each.  Entry at 2 is mild and splashable; the tier at 4
//  changes a rule rather than a number.  Every applier ships with a spender.
// ============================================================================
module.exports.TAGS={
  Hull:    {2:'barriers 45% larger',
            4:'AMMUNITION \u2014 damage a barrier swallows is returned to the attacker'},
  Blight:  {2:'one extra stack per application',
            4:'BLOOM \u2014 a bloom joins the turn order; every Blight action pulls it '+
              'forward; when it acts it detonates every ailment on the board'},
  Drive:   {2:'the crew act 12% sooner',
            4:'RELAY \u2014 a crew kill immediately advances the next crewmate'},
  Ordnance:{2:'20% more damage',
            4:'OVERSTRIKE \u2014 a hit that breaks a shield lands a second time'},
  Assay:   {2:'shields shredded 60% faster',
            4:'DISSECTION \u2014 break costs the enemy two turns instead of one'},
  Crew:    {2:'healing 50% stronger',
            4:'RELIEF \u2014 the first crew member to fall is brought back once'}
};

// Anti-synergy, stated on purpose:
//   Assay delays enemies.  Blight needs enemies to act so ailments tick.
//   A team leaning on both fights itself.  That is the point.

module.exports.CHARS={
  // ---- Hull: protection, and the carry that turns protection into damage ----
  Wex:    {tags:['Hull','Crew'],   dmg:9,  sp:104, barrier:34,
           bio:'Hull tech. Patches things before they fail, including people.'},
  Tarn:   {tags:['Hull','Ordnance'],dmg:7, sp:82,  hpMul:.80, thorns:4.4, taunt:6,
           needsGuard:1,
           bio:'Wears the ship\u2019s old boarding plate. Steps in front of everything '+
               'and lets it hit her.'},
  Ferrule:{tags:['Hull','Ordnance'],dmg:13,sp:88,  barrier:22, onHitBarrier:1,
           bio:'Welder. Throws plating over whoever is nearest when she swings.'},
  Ballast:{tags:['Hull'],          dmg:13, sp:74,  hpMul:1.5, taunt:3, drain:.3,
           bio:'Was cargo crew. Absorbs punishment and keeps walking.'},

  // ---- Blight: appliers and the spender they exist for ----
  Ash:    {tags:['Blight'],        dmg:8,  sp:100, apply:1, stacks:2, aoe:1, shred:12,
           bio:'Xeno-chemist. Aerosolises samples and lets the wind do the rest.'},
  Cinder: {tags:['Blight','Ordnance'],dmg:12,sp:94,apply:1, stacks:3,
           bio:'Reactor tech. Everything she touches keeps burning after she leaves.'},
  Pyre:   {tags:['Blight'],        dmg:11, sp:92,  detonate:1,
           bio:'Demolitions. Waits for the pile to get big enough, then lights it.'},
  Sump:   {tags:['Blight','Crew'], dmg:9,  sp:98,  apply:1, stacks:1, spread:1, heal:18,
           bio:'Field biologist. Corruption jumps hosts when one dies; she counts on it.'},

  // ---- Drive: turn order as a resource ----
  Vane:   {tags:['Drive','Crew'],  dmg:9,  sp:112, advance:.5,
           bio:'Helm. Reads the flow of a fight and shoves people into it early.'},
  Nettle: {tags:['Drive'],         dmg:8,  sp:120, trig:'ally', react:4, ratio:.42,
           bio:'Too fast, too eager. Fires whenever anyone else does.'},
  Mote:   {tags:['Drive','Assay'], dmg:9,  sp:116, aoe:1, shred:14,
           bio:'Survey drone pilot. Sweeps the whole line looking for cracks.'},

  // ---- Ordnance: the payoff for everything else ----
  Corr:   {tags:['Ordnance'],      dmg:25, sp:84,
           bio:'Ship\u2019s gunner. One target. One number.'},
  Bosk:   {tags:['Ordnance','Hull'],dmg:17,sp:80,  hpMul:1.25,
           bio:'Ex-salvage. Enormous, patient, hits like falling cargo.'},
  Maul:   {tags:['Ordnance','Assay'],dmg:20,sp:70, trig:'break', react:1, ratio:2.2,
           bio:'Waits for something to crack, then puts everything into the gap.'},

  // ---- Assay: read the enemy, open it up ----
  Quill:  {tags:['Assay','Blight'],dmg:9,  sp:110, marks:3,
           bio:'Xeno-botanist. Tags every specimen before she touches it.'},
  Vitre:  {tags:['Assay','Drive'], dmg:8,  sp:108, marks:2, aoe:1, shred:10,
           bio:'Sensor officer. Paints the whole line at once, lightly.'},
  Rime:   {tags:['Assay'],         dmg:9,  sp:98,  aoe:1, shred:19,
           bio:'Cryo-analyst. Freezes a shell until it fractures on its own.'},
  Ledger: {tags:['Assay','Drive'], dmg:13, sp:96,  trig:'mark', react:2, ratio:.8,
           bio:'Ship archivist. Answers every hit on anything Quill has written down.'},

  // ---- Crew: the ones who keep it standing ----
  Fen:    {tags:['Crew'],          dmg:6,  sp:106, heal:30,
           bio:'Ship medic. Treats the crew like equipment: patched before it fails.'},
  Mire:   {tags:['Crew','Hull'],   dmg:10, sp:100, heal:24, over:1, thorns:.5,
           bio:'Navigator. Calm, unhurried, hits back without seeming to notice.'},
  Halo:   {tags:['Crew','Drive'],  dmg:7,  sp:94,  charge:36,
           bio:'Reactor engineer. Gives away her own power and runs cold doing it.'}
};

// ============================================================================
//  Enemies.  Only archetypes that actually discriminate between builds earn a
//  name.  Four earlier ones were cut for moving every build equally.
// ============================================================================
module.exports.FOEKIND={
  chaff:   {hp:.55,dmg:.5, shl:1,sp:96,
            note:'numerous and disposable \u2014 the fight where your build just works'},
  bruiser: {hp:1.7, dmg:1.1,shl:2,sp:74,
            note:'slow and heavy \u2014 a mild tax on everyone'},
  warden:  {hp:1.15,dmg:.5, shl:7,sp:82, rot:2.1,
            note:'enormous shields, soft underneath, and ailments walk straight past them'},
  cleanser:{hp:1.1, dmg:.8, shl:2,sp:104,cleanse:.45,
            note:'sheds a share of whatever you put on it'},
  reflector:{hp:.95,dmg:.7, shl:2,sp:90, thorns:.34,
            note:'answers each hit with a little of its own \u2014 punishes cascades'},
  // new, written against the new tags
  anchor:  {hp:1.2, dmg:.5, shl:2,sp:88, empower:.14,
            note:'strengthens every other enemy \u2014 punishes a slow clear'},
  bulwark: {hp:1.3, dmg:.7, shl:3,sp:86, guard:.3,
            note:'shelters the enemy beside it \u2014 the answer to single-target burst'},
  quickstep:{hp:.8, dmg:.6, shl:1,sp:128,evasive:1,
            note:'acts twice as often \u2014 punishes teams that need setup turns'}
};

// ============================================================================
//  Planet conditions.  This is the meta dial: rotate these and the best team
//  changes without a single balance edit.
// ============================================================================
module.exports.WORLDS={
  open:     {note:'nothing unusual', speedMul:1,
             mix:[['chaff',9],['bruiser',4],['warden',3]]},
  murk:     {note:'low visibility \u2014 everyone acts slower', speedMul:.72,
             mix:[['chaff',9],['bruiser',4],['warden',3]]},
  hive:     {note:'a tide of small things', speedMul:1,
             mix:[['chaff',18],['quickstep',5]]},
  fortress: {note:'a few very tough things', speedMul:1,
             mix:[['bruiser',3],['bulwark',3],['warden',2]]},
  bloom:    {note:'the Null is thick here \u2014 ailments bite harder', speedMul:1,
             ailMul:1.8, mix:[['chaff',10],['cleanser',4],['bruiser',3]]},
  cascade:  {note:'everything here answers back', speedMul:1.1,
             mix:[['reflector',5],['chaff',8],['anchor',3]]}
};
