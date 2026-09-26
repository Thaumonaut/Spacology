const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
 try{
 const page=await browser.newPage({viewport:{width:1280,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE+'/prototypes/spacology-v0.1.0.html');
 await page.locator('#titleSettings').click();await page.locator('[data-preference="autoBattle"]').uncheck();await page.keyboard.press('Escape');
 await page.locator('#titleNewVoyage').click();await page.locator('[data-difficulty="standard"]').click();await page.locator('[data-menu="depart"]').click();await page.locator('[data-node-reward="0"]').click();
 await page.evaluate(()=>{const s=JSON.parse(localStorage.spacologyRunV010);s.field=['Tarn','Bosk'];s.support=['Coda'];s.reserve=[];localStorage.spacologyRunV010=JSON.stringify(s)});
 await page.reload();await page.locator('#enterOps').click();await page.locator('#continueButton').click();await page.waitForURL('**/watchable-fight.html?**');
 const report=await page.evaluate(()=>{
  const checks=[];function ok(value,message){if(!value)throw Error(message);checks.push(message)}
  window.traitFixture=function(roles){
   cancelSessionAutostart();build('ops','spread');MODE='none';playing=false;G.limit=99;G.bloom.live=false;G.bon={shredMul:1,dmgMul:1,healMul:1,barrier:1};
   G.units=G.units.filter(u=>u.side==='ally'&&!u.summon);G.units.forEach(u=>Object.assign(u,{hp:1000,max:1000,en:0,ult:null,dmg:8,reflect:0,react:0,taunt:1,heal:0,bar:0,frac:0,aoe:0,shred:0,hits:1,follow:0,drain:0,marks:0,ailments:{},av:900}));
   G.aether.current=0;G.silenChain=null;G.pending=null;G.traitNotes=[];G.pool=[];G.spawned=roles.length;G.totalWaves=1;G.wave=1;G.treasureInfo=null;G.ship={};
   roles.forEach((role,i)=>{const k=enemyKitFor(role),p={hp:k.hp,n:k.n,archetype:role,elite:false};G.pool.push(p);G.units.push({id:'f'+i,side:'foe',n:k.n,archetype:role,archetypeName:k.n,factionId:'ossuary',hp:k.hp,max:k.hp,dmg:k.dmg,sp:k.sp,baseSp:k.sp,shL:k.layers,shMax:k.layers,shC:k.guard,shieldPer:k.guard,weak:['order','decay'],e:'order',alive:true,av:800,bar:0,frac:0,vuln:0,survey:0,haste:0});});
   SpacologyEnemyTraits.linkGuards(G.units);ribbons();paintAll();track();return G.units.filter(u=>u.side==='foe');
  };
  window.traitTurn=function(id){G.pending=null;G.silenChain=null;G.units.forEach(u=>{u.av=u.id===id?0:900;u.en=0});const ev=resolveAction();applyReset();return ev;};
  let [medic,patient]=traitFixture(['mender','chaff']);patient.hp=5;traitTurn(medic.id);traitTurn(medic.id);const ev=traitTurn(medic.id);ok(ev.heal&&patient.hp>5&&medic.healUses===1,'medic heals on third turn');
  let [leech]=traitFixture(['leech']);G.aether.current=3;traitTurn(leech.id);traitTurn(leech.id);ok(leech.stolenAether===1&&G.aether.current===2,'leech steals shared Aether');breakEnemy(leech);ok(!leech.stolenAether&&G.aether.current===3,'break refunds Aether immediately');leech.broken=false;leech.stolenAether=2;G.aether.current=1;hit(U('a0'),leech,100);ok(G.aether.current===3,'death refunds stored Aether');
  let [disruptor]=traitFixture(['sapper']);traitTurn(disruptor.id);const marked=U(disruptor.chargeTarget);let d=traitTurn(disruptor.id);ok(d.notes.some(n=>n.includes('delayed 30'))&&marked.av===930,'charged disruptor delays marked front only');traitTurn(disruptor.id);ok(disruptor.chargeTarget!==marked.id,'disruptor changes target');breakEnemy(disruptor);ok(!disruptor.chargeTarget,'break cancels charge');
  let [venom]=traitFixture(['venom']);G.units.filter(u=>u.side==='ally').forEach(u=>u.bar=50);traitTurn(venom.id);traitTurn(venom.id);ok(G.units.every(u=>!u.ailments?.poison),'barrier blocks poison');G.units.filter(u=>u.side==='ally').forEach(u=>u.bar=0);traitTurn(venom.id);traitTurn(venom.id);let poisoned=G.units.find(u=>u.ailments?.poison);ok(poisoned&&poisoned.row==='front','poison reaches front row');const hp=poisoned.hp;traitTurn(poisoned.id);ok(poisoned.hp===hp-30&&poisoned.ailments.poison.turns===2,'poison ticks once per scheduled turn');
  let [guard,protectedUnit]=traitFixture(['bulwark','mender']);const source=U('a0');source.dmg=100;guard.hp=guard.max=1000;protectedUnit.hp=protectedUnit.max=1000;const h=hit(source,protectedUnit,1),guardDamage=1000-guard.hp;ok(guardDamage>0&&h.dmg>0,'bodyguard splits a direct hit');guard.hp=protectedUnit.hp=1000;const area=hit(source,protectedUnit,1,{area:true});ok(guard.hp===1000&&area.dmg===h.dmg+guardDamage,'area attack bypasses interception');breakEnemy(guard);guard.hp=protectedUnit.hp=1000;hit(source,protectedUnit,1);ok(guard.hp===1000,'breaking guard removes protection');
  let [brood]=traitFixture(['brood']);let total=currentRecovery().total;hit(U('a0'),brood,100);let children=G.units.filter(u=>u.enemyMinion);ok(children.length===2&&children.every(u=>u.av===10000/u.sp&&u.bodyPlan&&u.nullStage),'brood releases two delayed nonrecursive children with catalogue details');ok(currentRecovery().total===total,'offspring add no recovery points');ok(!resolveAction().end,'offspring block victory');children.forEach(u=>{u.hp=0;u.alive=false});ok(resolveAction().end==='Crew wins','victory after offspring clear');
  [brood]=traitFixture(['brood']);breakEnemy(brood);hit(U('a0'),brood,100);ok(!G.units.some(u=>u.enemyMinion),'broken brood dies without offspring');
  [brood]=traitFixture(['brood','chaff','chaff','chaff','chaff','chaff']);hit(U('a0'),brood,100);ok(!G.units.some(u=>u.enemyMinion),'full enemy row prevents brood overflow');
  let [berserker]=traitFixture(['bruiser']);berserker.hp=berserker.max/2;settleEnemyTraits();ok(berserker.enraged&&berserker.shMax===0,'berserker loses guard on enrage');
  let [channeler]=traitFixture(['channeler']);traitTurn(channeler.id);ok(channeler.chargeTarget,'channeler announces target');breakEnemy(channeler);const recovery=traitTurn(channeler.id);ok(recovery.recovered&&!channeler.chargeTarget&&recovery.hits[0].dmg<channeler.dmg*2,'recovery cancels charged strike');
  let [hexer]=traitFixture(['hexer']);traitTurn(hexer.id);traitTurn(hexer.id);const hexed=G.units.find(u=>u.ailments?.hex);ok(hexed,'hex applied');G.aether.current=0;traitTurn(hexed.id);ok(!hexed.ailments.hex,'basic clears unaffordable hex');
  let [bombEnemy]=traitFixture(['saboteur']);const victim=U('a0');SpacologyEnemyTraits.applyStatus(victim,'bomb',bombEnemy.id,false);const before=victim.hp;traitTurn(victim.id);ok(victim.hp===before&&victim.ailments.bomb.turns===1,'bomb waits through first action');victim.bar=200;traitTurn(victim.id);ok(victim.hp===before&&victim.bar===20&&!victim.ailments.bomb,'bomb detonates after second action into barrier');
  traitFixture(['venom']);const healer=U('a2'),hurt=U('a0');healer.heal=20;SpacologyEnemyTraits.applyStatus(hurt,'poison','f0',false);SpacologyEnemyTraits.applyStatus(hurt,'bomb','f0',false);const cleaned=traitTurn(healer.id);ok(cleaned.supportAction&&!Object.keys(hurt.ailments).length,'automatic healer cleanse removes all harmful effects');
  traitFixture(['venom']);SPACOLOGY_SESSION.downRecovery='revive';const down=U('a0');down.hp=1;SpacologyEnemyTraits.applyStatus(down,'poison','f0',false);const prev=G.limit;traitTurn(down.id);ok(down.alive&&down.hp===500&&G.limit===prev-.5&&!Object.keys(down.ailments).length,'poison down clears ailments and pays recovery once');
  traitFixture(['bloodletter']);const repeated=U('a0');SpacologyEnemyTraits.applyStatus(repeated,'bleed','f0',false);const oldHP=repeated.hp;
  finishCrewConditions({actor:repeated,hits:[{src:repeated.id,tgt:'f0',dmg:1}],notes:[],bonusTurn:true});ok(repeated.hp===oldHP&&repeated.ailments.bleed.turns===3,'bonus turns do not multiply bleed');
  finishCrewConditions({actor:repeated,hits:[{src:repeated.id,tgt:'f0',dmg:1},{src:repeated.id,tgt:'f0',dmg:1}],notes:[]});ok(repeated.hp===oldHP-40,'multi-hit action triggers bleed once');
  traitFixture(['sapper','mender','bulwark']);traitTurn('f0');ribbons();paintAll();track();ok(document.querySelector('#rt-f0').textContent.includes('DELAY'),'enemy card shows marked intent');ok(document.querySelector('#track').textContent.includes('DELAY'),'timeline shows marked intent');
  SpacologyEnemyTraits.applyStatus(U('a0'),'burn','f0',false);paintUnit(U('a0'));ok(getComputedStyle(document.querySelector('#r-a0 .ailment-label')).display!=='none','crew conditions visible above portrait footer');G.aether.current=1;U('f0').stolenAether=1;saveCombatCheckpoint();const saved=SpacologyPreferences.readCheckpoint(SPACOLOGY_SESSION).combat;ok(saved.units.find(u=>u.id==='f0').chargeTarget===U('f0').chargeTarget&&saved.units.find(u=>u.id==='a0').ailments.burn.turns===2,'checkpoint preserves charge and conditions');
  return checks;
 });
 report.forEach(s=>console.log('PASS '+s));
 // Exercise presentation and inspection through the real animated action path.
 await page.evaluate(()=>{traitFixture(['channeler','mender','bulwark']);MODE='full';G.units.forEach(u=>u.av=u.id==='f0'?0:900);G.pending=null;});
 await page.evaluate(()=>new Promise(resolve=>playAction(resolve)));await page.locator('#r-f0').click();assert.match(await page.locator('#enemyDetails').innerText(),/Channeler|charging|charged/i);
 await page.screenshot({path:'/tmp/spacology-enemy-traits.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS animated trait action, inspection and no runtime errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
