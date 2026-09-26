const assert=require('node:assert/strict');
const A=require('../../prototypes/aether-rules.js');
const units=[{n:'Aurel',alive:true},{n:'Coda',alive:true},{n:'Nour',alive:true}];
const pool=A.create(units);
assert.equal(pool.current,3);assert.equal(pool.max,11);
assert.equal(A.decide(pool,{n:'Nour'},{useful:true,reserve:3,priority:'Stella'}).kind,'basic');
assert.equal(A.decide(pool,{n:'Spore'},{useful:true,reserve:3,priority:'Stella',emergency:true}).kind,'skill');
assert.equal(A.decide(pool,{n:'Coda'},{useful:true,mode:'build'}).gain,2);
pool.current=11;assert.equal(A.generate(pool,2),0);assert.equal(pool.wasted,2);
units[0].alive=false;A.sync(pool,units);assert.equal(pool.max,8);assert.equal(pool.current,8);
const over=A.decide(pool,{n:'Nour'},{useful:true,overcharge:true});assert.equal(over.cost,3);assert.equal(over.extra,1);
const guarded=A.decide(pool,{n:'Nour'},{useful:true,overcharge:true,reserve:6});assert.equal(guarded.cost,2);assert.equal(guarded.extra,0);
assert(A.spend(pool,over));assert.equal(pool.current,5);
pool.current=0;assert(!A.spend(pool,over));assert.equal(pool.spent,3);assert.equal(pool.skills,1);
assert.equal(A.decide(pool,{n:'Nour'},{useful:true}).kind,'basic');
assert.equal(A.create([{n:'Maul',alive:true}]).max,6);
console.log('PASS shared cap, capped generation, reservoir death, reservations, emergency override, overcharge affordability and failed payment.');
const burstPool=A.create([{n:'Ivara',alive:true}]);burstPool.max=8;burstPool.current=8;
const burst=A.decide(burstPool,{n:'Arunima'},{useful:true,overcharge:true});
assert.equal(burst.cost,8);assert.equal(burst.extra,5);
assert(A.spend(burstPool,burst));assert.equal(burstPool.current,0);
assert.equal(A.decide(burstPool,{n:'Hanae'},{useful:true}).kind,'basic');
burstPool.current=8;
const discounted=A.decide(burstPool,{n:'Arunima',weaverDiscount:true},{useful:true,overcharge:true});
assert.equal(discounted.cost,7);assert.equal(discounted.extra,5);
const reserved=A.decide(burstPool,{n:'Arunima'},{useful:true,overcharge:true,reserve:2,priority:'Veska'});
assert.equal(reserved.cost,6);assert.equal(reserved.extra,3);
assert.equal(A.decide(burstPool,{n:'Arunima'},{useful:true,overcharge:false}).cost,3);
burstPool.current=4;
const refill=A.decide(burstPool,{n:'Hanae'},{useful:true,reserve:6,priority:'Arunima'});
assert.equal(refill.kind,'skill');assert(A.spend(burstPool,refill));
assert.equal(A.credit(burstPool,5),5);assert.equal(burstPool.current,8);
assert.equal(A.credit(burstPool,6),0);assert.equal(burstPool.wasted,6);
assert.equal(burstPool.basics,0);
console.log('PASS eight-charge burst, discount retains multiplier, reserved charges, zero-pool fallback and capped skill/ultimate refills.');

// Team reservations protect the full burst, while useful setup and refills remain legal.
const session={aetherModes:{},aetherOvercharge:{}},burstCrew=[{n:'Arunima',alive:true},{n:'Hanae',alive:true},{n:'Ivara',alive:true},{n:'Roonie',alive:true},{n:'Veska',alive:true},{n:'Stella',alive:true}];
const teamPool=A.create(burstCrew);teamPool.max=8;teamPool.current=8;
const [arunima,hanae,ivara,roonie,veska,stella]=burstCrew;
const team=(actor,extra={})=>A.teamPlan(teamPool,actor,{crew:burstCrew,session,turn:1,useful:()=>true,...extra});
assert.equal(A.priority(burstCrew,session).n,'Arunima');
assert.equal(team(stella).kind,'basic');
assert.equal(team(arunima).cost,8);
teamPool.current=1;
assert.equal(team(hanae).kind,'skill'); // 1 → 5 is useful even below the 8-charge reservation.
assert.equal(team(arunima).kind,'basic');
teamPool.current=4;
assert.equal(team(arunima,{canWait:true}).waiting,true);
A.recordAction(teamPool,arunima,team(arunima,{canWait:true}),1,6);
assert.equal(team(arunima,{canWait:true}).kind,'skill'); // Never wait two consecutive own turns.
arunima.aetherWaits=0;
assert.equal(team(arunima,{canWait:true,opportunity:'break window'}).kind,'skill');
assert.equal(team(roonie,{setup:'discount before burst'}).kind,'skill');
assert.equal(team(roonie).kind,'skill'); // His +2 net refill funds the reservation.
assert.equal(team(ivara).kind,'basic'); // Sub-DPS does not consume the saved burst.
assert.equal(A.profile('Ivara').cost,2);
assert.equal(A.profile('Roonie').skillGain,3);
assert.equal(team(veska,{emergency:true}).kind,'skill');
assert.equal(team(veska,{skillGain:3}).kind,'skill');
assert.equal(team(veska,{skillGain:1}).kind,'basic');
teamPool.current=8;
const full=team(arunima);A.spend(teamPool,full);A.recordAction(teamPool,arunima,full,1,6);
teamPool.current=4;
assert.equal(team(stella,{turn:2}).kind,'skill');
assert.equal(team(stella,{turn:7}).kind,'basic');
teamPool.reserveAfter=0;
session.aetherPriority='Stella';assert.equal(A.priority(burstCrew,session).n,'Stella');
assert.equal(team(arunima).cost,undefined); // Four charges cannot cover both skills.
teamPool.current=8;assert.equal(team(arunima).cost,5); // Reserve Stella's 3.
session.aetherModes.Stella='build';assert.equal(A.priority(burstCrew,session).n,'Arunima');
session.aetherPriority=null;session.aetherModes.Arunima='build';assert.equal(A.priority(burstCrew,session),null);
assert.equal(team(arunima).kind,'basic');
session.aetherModes.Arunima='auto';session.aetherOvercharge.Arunima=false;
assert.equal(A.priority(burstCrew,session),null);assert.equal(team(arunima).cost,3);
delete session.aetherOvercharge.Arunima;arunima.weaverDiscount=true;
assert.equal(A.budget(teamPool,arunima,session),7);assert.equal(team(arunima).cost,7);
ivara.alive=false;A.sync(teamPool,burstCrew);assert.equal(teamPool.max,10);assert.equal(A.budget(teamPool,arunima,session),9);assert.equal(team(arunima).cost,8);
arunima.alive=false;assert.equal(A.priority(burstCrew,session),null);assert.equal(team(stella).kind,'basic'); // Explicit Build remains honored.
session.aetherModes.Stella='auto';assert.equal(team(stella).kind,'skill');
assert.equal(A.priority([{n:'Arunima',summon:true}],session),null);
console.log('PASS automatic full-burst reservation, refill deadlock prevention, setup/emergency exceptions, bounded waiting, spending window, manual settings, discount and reservoir/owner deaths');

const six=['Hanae','Ivara','Arunima','Roonie','Veska','Daven'].map(n=>({n,alive:true}));
assert.deepEqual(A.capacityBreakdown(six),{base:6,weavers:6,bonus:2,total:14});
assert.equal(A.capacity([...six,{n:'Aurel',alive:true}]),17);
assert.equal(A.capacity([...six,{n:'Coda',alive:false},{n:'Aurel',summon:true},six[0]]),14);
const expanded=A.create(six);assert.equal(expanded.current,3);expanded.current=14;
const large=A.decide(expanded,{n:'Arunima'},{useful:true,overcharge:true});assert.equal(large.cost,14);assert.equal(large.extra,11);
const cheap=A.decide(expanded,{n:'Arunima',weaverDiscount:true},{useful:true,overcharge:true});assert.equal(cheap.cost,13);assert.equal(cheap.extra,11);
assert.equal(A.decide(expanded,{n:'Arunima'},{useful:true,overcharge:true,spendLimit:5}).cost,5);
assert.equal(A.decide(expanded,{n:'Arunima'},{useful:true,overcharge:true,basicEnough:true}).kind,'basic');
six[1].alive=false;A.sync(expanded,six);assert.equal(expanded.max,11);assert.equal(expanded.current,11);
six[1].alive=true;A.sync(expanded,six);assert.equal(expanded.max,14);assert.equal(expanded.current,11);
console.log('PASS per-Weaver storage, additive capacity passives, summons/dead/duplicate exclusions, 14-charge burst, discount, health budget and safe cap changes');

// Silen's escalating chain shares reservations, but pays one continuation at a time.
const chainCrew=[{n:'Silen',alive:true},{n:'Arunima',alive:true},{n:'Roonie',alive:true},{n:'Ivara',alive:true}];
const chainPool=A.create(chainCrew);chainPool.current=chainPool.max;
const chainSession={aetherModes:{},aetherPriority:'Silen'};
const chainActor=chainCrew[0];
assert.equal(A.priority(chainCrew,{}).n,'Arunima');
assert.equal(A.priority(chainCrew,chainSession).n,'Silen');
const chainPlan=A.teamPlan(chainPool,chainActor,{crew:chainCrew,session:chainSession,useful:()=>true});
assert.equal(chainPlan.cost,chainPool.max);
assert(A.spend(chainPool,{...chainPlan,cost:A.skillCost(chainActor)}));
assert.equal(chainPool.skills,1);
assert.deepEqual([1,2,3,4].map(A.continuationCost),[2,3,4,5]);
assert(A.spendContinuation(chainPool,1));assert.equal(chainPool.skills,2);assert.equal(chainPool.spent,4);
assert(A.spendContinuation(chainPool,2));assert.equal(chainPool.skills,3);assert.equal(chainPool.spent,7);
assert.deepEqual([0,1,2,3].map(A.chainMultiplier),[2,2.25,2.5,2.75]);
chainPool.current=3;assert.equal(A.spendContinuation(chainPool,3),false);assert.equal(chainPool.spent,7);
chainPool.current=chainPool.max;chainActor.weaverDiscount=true;
assert.equal(A.skillCost(chainActor),1);assert.equal(A.budget(chainPool,chainActor,chainSession),chainPool.max);
assert.equal(A.budget(chainPool,chainActor,{aetherOvercharge:{Silen:false}}),1);
assert.equal(A.teamPlan(chainPool,chainActor,{crew:chainCrew,session:{},useful:()=>true}).kind,'basic');
console.log('PASS Silen priority, separate skill-turn accounting, increasing costs and multipliers, insufficient pool and discount/chain toggle');

chainSession.aetherPriority='Arunima';chainPool.current=chainPool.max;
const savedForOther=A.teamPlan(chainPool,chainActor,{crew:chainCrew,session:chainSession,useful:()=>true});
assert.equal(savedForOther.reserve,chainPool.max);
chainSession.aetherPriority='Silen';
const fullChain=A.teamPlan(chainPool,chainActor,{crew:chainCrew,session:chainSession,useful:()=>true});
assert.equal(fullChain.reserve,0);assert.equal(fullChain.cost,chainPool.max);
console.log('PASS sustained Silen reservation floor and discounted full-pool budget');
// Formation roles inform Auto spending without blocking refills or explicit priorities.
assert.equal(A.spendingStyle('Silen'),'greedy');assert.equal(A.spendingStyle('Ivara'),'conservative');assert.equal(A.spendingStyle('Roonie'),'support');
const roleCrew=[{n:'Silen',alive:true},{n:'Ivara',alive:true},{n:'Hanae',alive:true}],rolePool=A.create(roleCrew);rolePool.current=4;rolePool.reserveAfter=100;
const rolePlan=(actor,extra={})=>A.teamPlan(rolePool,actor,{crew:roleCrew,session:{},turn:1,useful:()=>true,damageSkill:true,...extra});
assert.equal(rolePlan(roleCrew[1]).kind,'basic');
assert.equal(rolePlan(roleCrew[1],{opportunity:'secure kill'}).kind,'skill');
assert.equal(rolePlan(roleCrew[1],{session:{aetherPriority:'Ivara'}}).kind,'skill');
assert.equal(rolePlan(roleCrew[1],{damageSkill:false}).kind,'skill');
rolePool.current=rolePool.max;assert.equal(rolePlan(roleCrew[1]).kind,'skill');
rolePool.current=1;assert.equal(rolePlan(roleCrew[2]).kind,'skill');
rolePool.reserveAfter=0;rolePool.current=4;assert.equal(rolePlan(roleCrew[0],{canWait:true}).kind,'skill');
console.log('PASS main-DPS spending, sub-DPS generation, opportunities, surplus pool, manual priority and useful refill exceptions');
