// ---------------------------------------------------------------------------
// A modifier pool with a category cap. Each carries a weight so a stack can be
// read as a difficulty number, and so the generator can be told a budget.
// ---------------------------------------------------------------------------
module.exports.MODS=[
  // ---- STAT: these multiply with each other, so at most one is ever drawn ----
  {id:'hp',    cat:'stat', w:3, n:'Enemies carry 60% more health',
   note:'a straight tax \u2014 you play the same way, for longer'},
  {id:'dmg',   cat:'stat', w:3, n:'Enemies hit 40% harder',
   note:'a straight tax on your healing and barriers'},
  {id:'fast',  cat:'stat', w:4, n:'Enemies act 25% sooner',
   note:'a tax on everything, which is why it is the heaviest'},

  // ---- RULE: change what is correct. These are the body of the pool. ----
  {id:'inert',  cat:'rule', w:3, n:'Ailments wither here',
   gift:'but every shield is one layer thinner',
   note:'closes the decay answer, opens the break answer'},
  {id:'rigid',  cat:'rule', w:3, n:'Broken shields reform at once',
   gift:'but a break deals its damage twice',
   note:'closes the delay answer, rewards heavy single hits'},
  {id:'lonely', cat:'rule', w:2, n:'Follow-ups cannot chain',
   gift:'but each one lands 80% harder',
   note:'turns a cascade build into a burst build'},
  {id:'glass',  cat:'rule', w:2, n:'Everyone deals and takes 40% more',
   note:'symmetrical, so it shortens the fight rather than tilting it'},
  {id:'silt',   cat:'rule', w:2, n:'Everyone acts 25% slower',
   note:'symmetrical \u2014 favours whoever does more per turn'},
  {id:'thin',   cat:'rule', w:3, n:'Healing is halved',
   gift:'but barriers are doubled',
   note:'swaps sustain for prevention'},
  {id:'blind',  cat:'rule', w:2, n:'Weaknesses are hidden until struck',
   note:'a knowledge tax, not a power tax'},
  {id:'greed',  cat:'rule', w:2, n:'Ultimates cost half again as much',
   gift:'but hit half again as hard',
   note:'fewer, larger moments'},

  // ---- SHAPE: change the encounter, not the maths ----
  {id:'tide',   cat:'shape',w:3, n:'Twice as many, half as tough',
   note:'the answer is area damage, and it is always available'},
  {id:'wall',   cat:'shape',w:3, n:'Half as many, twice as tough',
   note:'the answer is single-target, and it is always available'},
  {id:'vanguard',cat:'shape',w:2,n:'Enemies come in waves of three',
   note:'rewards clearing fast, punishes slow engines'},
  {id:'anchored',cat:'shape',w:2,n:'One enemy strengthens the rest until it falls',
   note:'a priority target \u2014 a reading problem with one correct answer'},

  // ---- COST: touch the run, not the fight ----
  {id:'lean',   cat:'cost',w:2, n:'You field one fewer',
   gift:'but the rest are a tier stronger',
   note:'fewer decisions, each worth more'},
  {id:'scarce', cat:'cost',w:2, n:'Half the usual income',
   note:'the shop matters more, not less'}
];
module.exports.CAP={stat:1, rule:99, shape:1, cost:2};
