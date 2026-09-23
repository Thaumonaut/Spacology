const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context={window:{},crypto:require('node:crypto').webcrypto};vm.createContext(context);
for(const file of ['voyage-settings','voyage-rules','treasure-rules','recovery-scoring'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../prototypes/'+file+'.js'),'utf8'),context);
const {SpacologyVoyage:V,SpacologyVoyageSettings:D,SpacologyTreasure:T,SpacologyRecovery:R}=context.window;
context.window.SpacologyExpedition={modifiers:{test:{category:'stat'},same:{category:'stat'}},activeModifiers:s=>s.modifiers};
const state=seed=>T.normalize({voyageVersion:1,treasureSeed:seed,round:1,maxRounds:21,gold:42,integrity:70,modifiers:[],modifierChoices:[]});
const clone=x=>JSON.parse(JSON.stringify(x));
for(let i=0;i<300;i++){
 const s=state('route-'+i),nodes=V.route(s);assert.equal(nodes.length,21);assert.deepEqual(clone(V.route(clone(s))),clone(nodes));
 assert.equal(nodes.filter(n=>n.kind==='battle').length,14);assert.equal(nodes.filter(n=>n.kind==='reward').length,4);
 assert.deepEqual(clone(nodes.filter(n=>n.kind==='modifier').map(n=>n.index)),[3,10,17]);
 assert.deepEqual(clone(nodes.filter(n=>n.format==='boss').map(n=>n.index)),[7,14,21]);
 assert.deepEqual(clone(nodes.filter(n=>n.format==='elite').map(n=>n.index)),[5,12,19]);
 assert.equal(new Set(nodes.filter(n=>n.kind==='reward'&&n.index!==1).map(n=>n.format)).size,3);
 assert.equal(V.claim(s,nodes[0].id,0),null);assert(V.start(s,'standard'));assert(!V.start(s,'hard'));
 const reward=V.claim(s,nodes[0].id,0);assert.equal(reward.gold,20);assert.equal(s.round,2);assert.equal(V.claim(s,nodes[0].id,0),null);
 const sightings=[];for(s.round=1;s.round<=21;s.round++){const n=V.current(s),info=T.encounter(s);if(info){assert(n.kind==='battle'&&!['elite','boss'].includes(n.format));sightings.push(n.sector);const drop=T.rollReward(info);const gold=s.gold;assert(T.collect(s,drop));assert.equal(s.gold,gold+drop.gold);assert.equal(drop.lootLevel,n.sector*2);assert(!T.collect(s,drop));}}
 assert.deepEqual(sightings,[1,2,3]);
 s.round=3;assert(V.chooseModifier(s,nodes[2].id,'test'));assert(!V.chooseModifier(s,nodes[2].id,'skip'));s.round=10;assert(!V.chooseModifier(s,nodes[9].id,'same'));assert(V.chooseModifier(s,nodes[9].id,'skip'));assert.equal(s.round,11);
}
for(const difficulty of ['relaxed','standard','hard']){
 const s=state('scales');V.start(s,difficulty);s.round=2;const a=V.profile(s);s.round=4;assert.equal(V.profile(s).hp,a.hp);s.round=8;assert(V.profile(s).hp>a.hp);s.round=15;assert(V.profile(s).hp>1.5*a.hp);assert.equal(D.roundLimit({...s,round:7}),D.roundLimit({...s,round:2})+1);
}
const boss={boss:true,alive:true,hp:50,max:100,phase:1,dmg:20,shieldPer:20,shC:18,frac:8,broken:true};assert(V.updateBoss(boss));assert.equal(boss.dmg,27);assert.equal(boss.shieldPer,12);assert.equal(boss.frac,8);assert.equal(boss.broken,true);assert(!V.updateBoss(boss));
boss.hp=90;V.updateBoss(boss);assert.equal(boss.lowestHP,50);
assert.equal(R.score([{boss:true,hp:100}],[{...boss,id:'f0',side:'foe'}],false).percent,40);
assert.equal(R.score([{boss:true,hp:100}],[{...boss,id:'f0',side:'foe',hp:0,alive:false}],false).percent,100);
assert.equal(V.current({round:1,maxRounds:6}),null);assert.equal(D.roundLimit({round:6,difficulty:'hard'}),6);
console.log('PASS 300 seeded routes: fixed slots, varied rewards, exactly-once claims, modifier gating, three bounded carriers, difficulty lock/scaling and boss recovery. Legacy settings preserved.');
