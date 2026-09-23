const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {window:{}, crypto:require('node:crypto').webcrypto};
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../../prototypes/treasure-rules.js'),'utf8'),context);
const T = context.window.SpacologyTreasure;
const state = seed => ({treasureSeed:seed, round:1, maxRounds:6, gold:40, scrap:0, crystals:0, gear:[]});
const copy = value => JSON.parse(JSON.stringify(value));
for (let i=0;i<100;i++) {
  const s=T.normalize(state('voyage-'+i)), rounds=[];
  for(s.round=1;s.round<=6;s.round++)if(T.encounter(s))rounds.push(s.round);
  assert.equal(rounds.length,2);
  assert(rounds[0]>=2&&rounds[0]<=3&&rounds[1]>=4&&rounds[1]<=5);
  s.round=rounds[0];const info=T.encounter(s), reward=T.rollReward(info);
  assert.deepEqual(copy(reward),copy(T.rollReward(copy(info))));
  s.gear.push(reward.item);
  assert(T.collect(s,reward));assert.equal(s.gear.filter(n=>n===reward.item).length,2);
  const granted=copy(s);assert.equal(T.collect(s,reward),false);assert.deepEqual(copy(s),granted);
  const saved=copy(s), contents=copy(reward.cache.contents);
  assert.deepEqual(copy(T.open(saved,reward.cache.id)),contents);
  assert.equal(saved.gold,granted.gold+contents.gold);
  assert.equal(saved.scrap,contents.scrap);assert.equal(saved.crystals,contents.crystals);
  const opened=copy(saved);assert.equal(T.open(saved,reward.cache.id),null);assert.deepEqual(copy(saved),opened);
  assert.equal(T.open(saved,'missing'),null);
  const unrelated=T.normalize(state('different'));assert.equal(T.collect(unrelated,reward),false);
}
// Pool categories and tier distribution remain bounded and all featured paths are reachable.
const seen=new Set();let advanced=0,tier3=0;
for(let i=0;i<10000;i++){
  const reward=T.rollReward({id:'sample-'+i,round:3}), c=reward.cache.contents;
  tier3+=reward.cache.tier===3;
  if(c.gear.length){seen.add('gear');if(['Resonance Coil','Survey Lance','Counterweight','Overdrive Relay','Breach Mantle'].includes(c.gear[0]))advanced++;}
  else if(c.scrap)seen.add('scrap');else if(c.crystals)seen.add('crystals');else seen.add('gold');
}
assert.equal(seen.size,4);assert(tier3>2000&&tier3<3000);assert(advanced>4000&&advanced<5000);
console.log('PASS 100 voyages: bounded sightings, fixed rolls, duplicate gear preservation, save/reload and exactly-once collection/opening; 10,000 pool samples.');
