const assert=require('node:assert/strict');
const T=require('../../prototypes/enemy-traits.js'),A=require('../../prototypes/aether-rules.js'),C=require('../../sim/enemy-catalogue.js');
const foe=(archetype,id=archetype)=>({id,n:id,archetype,side:'foe',alive:true,hp:100,max:100,shL:1,shC:20,shMax:1,sp:100,baseSp:100,dmg:10,weak:['order'],shieldPer:20});
const crew=(id='crew')=>({id,n:'Silen',side:'ally',row:'front',alive:true,hp:100,max:100,bar:0,av:50,sp:100});
let medic=foe('mender'),a=foe('chaff','a'),b=foe('chaff','b');a.hp=20;b.hp=50;
assert.equal(T.plan(medic,[medic,a,b]),null);assert.equal(T.plan(medic,[medic,a,b]),null);assert.match(T.labels(medic),/HEAL NEXT/);
let p=T.plan(medic,[medic,a,b]);assert.deepEqual(p,{kind:'heal',target:'a',amount:25});a.alive=false;
for(let i=0;i<3;i++)p=T.plan(medic,[medic,a,b]);assert.equal(p.target,'b');assert.equal(medic.healUses,2);
for(let i=0;i<12;i++)assert.equal(T.plan(medic,[medic,a,b]),null);
medic=foe('mender');medic.traitTurns=2;assert.equal(T.plan(medic,[medic]),null);assert.equal(medic.healUses,undefined);
let actor=foe('sapper'),x=crew('x'),y=crew('y');
p=T.plan(actor,[actor,x,y],null,0);assert.equal(p.kind,'charge');assert.equal(p.target,'x');
p=T.plan(actor,[actor,x,y],null,10);assert.equal(p.delay,30);assert.equal(actor.lastDelayTarget,'x');
p=T.plan(actor,[actor,x,y],null,20);assert.equal(p.target,'y');T.interrupt(actor);assert.equal(actor.chargeTarget,undefined);
y.row='back';assert.equal(T.plan(actor,[actor,x,y],null,30),null);y.row='front';y.delayImmuneUntil=130;assert.equal(T.plan(actor,[actor,x,y],null,30),null);
actor=foe('channeler');T.plan(actor,[actor,x]);T.interrupt(actor);assert.equal(T.plan(actor,[actor,x]).kind,'charge');assert.equal(T.plan(actor,[actor,x]).scale,2.2);
T.plan(actor,[actor,x]);x.alive=false;assert.equal(T.plan(actor,[actor,x]).kind,'fizzle');x.alive=true;
actor=foe('duelist');assert.equal(T.plan(actor,[actor,x]).kind,'mark');assert.deepEqual(Array.from({length:5},()=>T.plan(actor,[actor,x]).scale),[1,1.2,1.4,1.6,1.6]);T.interrupt(actor);assert.equal(T.plan(actor,[actor,x]).kind,'mark');
actor=foe('leech');let pool={current:3,max:6};T.plan(actor,[actor],pool);assert.equal(T.plan(actor,[actor],pool).kind,'steal');assert.equal(pool.current,2);T.plan(actor,[actor],pool);T.plan(actor,[actor],pool);assert.equal(actor.stolenAether,2);for(let i=0;i<10;i++)T.plan(actor,[actor],pool);assert.equal(pool.current,1);
assert.deepEqual(T.interrupt(actor,pool),{stored:2,returned:2});assert.equal(pool.current,3);assert.deepEqual(T.interrupt(actor,pool),{stored:0,returned:0});actor.stolenAether=2;pool.current=5;assert.deepEqual(T.refund(actor,pool),{stored:2,returned:1});assert.equal(pool.current,6);
let guard=foe('bulwark'),guard2=foe('bulwark','guard2');medic=foe('mender');T.linkGuards([guard,guard2,medic,x]);assert.equal(guard.guardTarget,medic.id);assert.equal(T.protector(guard,[guard,guard2,medic]),undefined);guard.broken=true;T.linkGuards([guard,medic]);assert.equal(guard.guardTarget,undefined);
let banner=foe('anchor');actor=foe('bruiser');assert.equal(T.damageMultiplier(actor,[actor,banner,foe('anchor','banner2')]),1.2);banner.broken=true;assert.equal(T.damageMultiplier(actor,[actor,banner]),1);actor.hp=50;assert(T.enrage(actor));assert.equal(actor.shMax,0);assert.equal(T.damageMultiplier(actor,[actor]),1.4);assert(!T.enrage(actor));
for(const kind of ['poison','burn','bleed','hex','bomb']){
 x=crew();assert(!T.applyStatus(x,kind,'enemy',true));x.row='back';assert(!T.applyStatus(x,kind,'enemy',false));x.row='front';assert(T.applyStatus(x,kind,'enemy',false));assert.equal(T.cleanse(x),1);assert.deepEqual(x.ailments,{});
}
x=crew();for(let i=0;i<7;i++)T.applyStatus(x,'poison','enemy',false);assert.equal(x.ailments.poison.stacks,3);assert.equal(T.statusDamage(x,true)[0].amount,9);assert.equal(x.ailments.poison.turns,2);T.applyStatus(x,'poison','enemy',false);assert.equal(x.ailments.poison.turns,3);
T.cleanse(x);T.applyStatus(x,'burn','enemy',false);assert.equal(T.statusDamage(x,false)[0].amount,6);T.applyStatus(x,'burn','enemy',false);assert.equal(x.ailments.burn.turns,2);T.statusDamage(x,false);T.statusDamage(x,false);assert(!x.ailments.burn);
T.applyStatus(x,'bomb','enemy',false);assert(!T.applyStatus(x,'bomb','enemy',false));assert.equal(T.statusDamage(x,true).length,0);assert.equal(T.statusDamage(x,true)[0].amount,18);assert(!x.ailments.bomb);
T.applyStatus(x,'bleed','enemy',false);assert.equal(T.statusDamage(x,false).length,0);assert.equal(T.statusDamage(x,true)[0].amount,4);assert.equal(T.statusDamage(x,true)[0].amount,4);assert(!x.ailments.bleed);
T.applyStatus(x,'hex','enemy',false);assert.equal(A.skillCost(x),3);pool=A.create([x]);pool.current=2;assert.equal(A.decide(pool,x,{useful:true}).kind,'basic');pool.current=3;assert.equal(A.decide(pool,x,{useful:true}).cost,3);x.weaverDiscount=true;assert.equal(A.skillCost(x),2);assert.equal(A.decide(pool,x,{useful:true}).cost,2);
for(const role of Object.keys(T.definitions)){
 assert(T.kit(role));assert.equal(T.type({...foe(role),treasure:true}),null);assert.equal(T.type({...foe(role),boss:true}),null);assert.equal(T.type({...foe(role),enemyMinion:true}),null);
 for(const faction of Object.keys(C.FACTIONS)){const specimen=C.generateEnemy('traits',{faction,archetype:role});assert.equal(specimen.archetype,role);assert(specimen.portrait&&specimen.typeName)}
}
const found=new Set();for(let seed=0;seed<50;seed++)for(let index=1;index<=21;index++)for(let wave=1;wave<=2;wave++){
 const sector=Math.ceil(index/7),args={sector,index,wave,size:3,seed};const roles=T.roster(args);assert.deepEqual(roles,T.roster(args));roles.forEach(role=>{found.add(role);assert(!T.definitions[role]||T.definitions[role].sector<=sector)});assert(roles.filter(role=>role==='summoner').length<=1);
 assert.deepEqual(T.roster({...args,format:'swarm'}),['chaff','chaff','chaff']);assert.deepEqual(T.roster({...args,format:'ambush'}),['quickstep','quickstep','quickstep']);assert.deepEqual(T.roster({...args,format:'boss'}),['warden']);
}
for(const role of Object.keys(T.definitions))assert(found.has(role),'unreachable '+role);
console.log('PASS all 14 traits, finite heal/theft/duel rules, guard links, charge interruption, control immunity, ailment duration/stack/shield/cleanse rules, hex affordability and seeded sector introduction');
