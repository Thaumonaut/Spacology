const assert=require('node:assert/strict');
const S=require('../../prototypes/enemy-summoning.js'),C=require('../../sim/enemy-catalogue.js');
const parent=()=>({id:'f0',side:'foe',archetype:'summoner',alive:true,max:100,dmg:10,sp:100,baseSp:100,weak:['order','growth'],e:'order',shieldPer:20});
let actor=parent(),units=[actor];
let first=S.act(actor,units,3,{n:'Needleling'});assert(first);units.push(first);assert.equal(first.hp,35);assert.equal(first.dmg,7);assert.equal(first.av,100);assert.notEqual(first.weak,actor.weak);assert.equal(first.enemyMinion,true);assert.equal(S.label(actor),'ATTACK NEXT');
assert.equal(S.act(actor,units,3,{}),null);let second=S.act(actor,units,3,{});assert(second);assert.notEqual(first.id,second.id);units.push(second);for(let i=0;i<10;i++)assert.equal(S.act(actor,units,3,{}),null);assert.equal(S.label(actor),'CALLS SPENT');assert.equal(S.act(first,units,3,{}),null);
actor=parent();units=[actor,...Array.from({length:4},()=>({side:'foe',alive:true}))];assert.equal(S.label(actor,units,3),'ATTACK NEXT');assert.equal(S.act(actor,units,3,{}),null);assert.equal(actor.summonCalls,undefined);units[1].alive=false;assert.equal(S.label(actor,units,3),'SUMMON NEXT');assert(S.act(actor,units,3,{}));
actor=parent();actor.broken=true;assert.equal(S.act(actor,[actor],3,{}),null);actor.broken=false;actor.alive=false;assert.equal(S.act(actor,[actor],3,{}),null);actor=parent();actor.treasure=true;assert.equal(S.act(actor,[actor],3,{}),null);
for(const faction of Object.keys(C.FACTIONS)){
 const enemy=C.generateEnemy('summoner-test',{faction,archetype:'summoner'});assert.equal(enemy.archetype,'summoner');assert(enemy.portrait&&enemy.typeName);assert.equal(C.FACTIONS[faction].types.summoner.name,enemy.typeName);
}
assert.equal(S.limit(6),7);assert.equal(S.limit(3),5);
console.log('PASS two calls, intervening attacks, stable IDs, delayed first turn, weaker children, no recursion, row cap, full-row retry, break/death/treasure guards and all faction types');
