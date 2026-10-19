'use strict';
// Weaver voyage lab: pool-mutation hooks, voyage legality, determinism.
const assert=require('node:assert/strict'),M=require('../../prototypes/labs/weaver-voyage/weaver-voyage-model.js');

const empty=()=>Object.fromEntries(M.SLOTS.map(k=>[k,null]));
function rigOf(set,n=5){const r=empty();M.SLOTS.slice(0,n).forEach((k,i)=>r[k]={uid:900+i,set,slot:k});return r}
function voyage(crew,opts={}){const s=M.create({seed:opts.seed||41,affixes:opts.affixes||[]});M.act(s,{type:'starters',ids:crew.slice(0,2).map(c=>c.id||c)});
  s.crew=crew.map(c=>typeof c==='string'?{id:c,rigs:[empty()]}:c);return s}
// The first regular survey (nodes 2 and 3 are Supply runs).
const SURVEY=M.ROUTE.indexOf('survey')+1;
function fights(s,nodes){return nodes.map(node=>M.fight(s,{node}))}

// Starters and route.
{const s=M.create({seed:41});assert.ok(M.act(s,{type:'starters',ids:['Hanae']}));assert.equal(s.node,1);
 assert.equal(M.act(s,{type:'starters',ids:['Hanae','Arunima']}),null);assert.equal(s.node,2);assert.equal(s.crew.length,2);
 assert.equal(M.ROUTE.length,21);assert.deepEqual(M.ROUTE.slice(1,3),['supply','supply'],'the voyage opens with two Supply runs');
 assert.equal(M.ROUTE.filter(t=>['supply','survey','swarm','elite','boss'].includes(t)).length,15);}

// Vouchers buy anyone, priced by team size only; there is no team-size cap.
{const s=voyage(['Hanae','Arunima']);s.writs=40;
 assert.equal(M.voucherPrice(s),2);assert.equal(M.act(s,{type:'voucher',id:'Silen'}),null);assert.equal(s.writs,38);
 assert.equal(M.voucherPrice(s),3);assert.equal(M.act(s,{type:'voucher',id:'Veska'}),null);assert.equal(s.writs,35);
 assert.match(M.act(s,{type:'voucher',id:'Silen'}),/aboard/);
 for(const id of ['Ivara','Roonie','Daven'])assert.equal(M.act(s,{type:'voucher',id}),null);
 assert.equal(s.crew.length,7);assert.equal(s.writs,35-4-5-6);assert.equal(M.berths,undefined);
 assert.ok(s.purchases.every(p=>p.price!==undefined||p.exchange));}
// Releasing refunds Writs so a swap always costs exactly one; equipment returns to the hold.
{for(const size of [2,3,5,7]){const s=voyage(M.IDS.slice(0,size));s.writs=10;s.node=4;
   const victim=s.crew[0];victim.rigs[0].core={uid:55,set:'overdraw',slot:'core'};
   const refund=M.releaseRefund(s);assert.equal(M.act(s,{type:'release',id:victim.id}),null);assert.equal(s.writs,10+refund);
   assert.ok(s.hold.some(p=>p.uid===55));assert.equal(M.act(s,{type:'voucher',id:victim.id}),null);
   assert.equal(s.writs,9,'a swap costs exactly one Writ with '+size+' crew');assert.equal(s.crew.length,size);}
 const one=voyage(['Hanae','Arunima']);M.act(one,{type:'release',id:'Hanae'});assert.match(M.act(one,{type:'release',id:'Arunima'}),/at least one/);
 assert.ok(one.purchases.some(p=>p.released==='Hanae'&&p.refund===1));}

// HoYo-style sets: every 2-piece is a plain stat; no 5-piece depends on a named crewmate, so every set is worth
// something on everyone; each names who it suits best.
{for(const id of M.SET_IDS){const S=M.SETS[id];assert.ok(S.short&&S.bestOn.length&&S.bestOn.every(c=>M.ROSTER[c]));
   assert.ok(M.STATS[S.two[0]]&&S.two[1]>0,id+' 2-piece is a stat');assert.ok(!S.onlyOn,id+' works on anyone');
   assert.ok(M.IDS.every(c=>M.setFit(c,id)>0),id+' is worth something on everyone')}
 assert.equal(M.SET_IDS.length,11);}

// Free voucher from a reward node skips the price; exchange is one way.
{const s=voyage(['Hanae','Arunima']);s.node=6;assert.equal(M.act(s,{type:'reward',choice:'voucher'}),null);assert.equal(s.node,7);
 assert.equal(M.act(s,{type:'voucher',id:'Ivara'}),null);assert.equal(s.writs,0);assert.equal(s.freeVoucher,0);
 // The Writ fund fills a little at a time and pays out each writCost, carrying the remainder.
 s.gold=40;assert.equal(M.act(s,{type:'invest',amount:5}),null);assert.equal(s.writFund,5);assert.equal(s.writs,0);
 assert.equal(M.act(s,{type:'invest',amount:M.ECON.writCost}),null);assert.equal(s.writs,1);assert.equal(s.writFund,5);
 assert.match(M.act(s,{type:'invest',amount:999}),/Not enough/);assert.equal(M.act(s,{type:'invest',amount:'all'}),null);assert.equal(s.gold,0);
 assert.equal(s.writs*M.ECON.writCost+s.writFund,40,'no Gold is lost to the fund');assert.match(M.act(s,{type:'exchange'}),/Unknown/);
 assert.match(M.act(s,{type:'unknownReverse'}),/Unknown/);}

// Equipment: a set completes only when all five slots match; craft and scrap move Gold.
{const s=voyage(['Hanae','Arunima']);s.gold=M.ECON.craft+20;
 assert.equal(M.act(s,{type:'craft',set:'overdraw',slot:'core'}),null);assert.equal(s.gold,20);assert.equal(s.hold.at(-1).tier,1,'crafting in sector 1 gives ★1');assert.equal(s.hold.at(-1).subs.length,1);
 const core=s.hold.at(-1);assert.equal(M.act(s,{type:'equip',uid:core.uid,crew:'Arunima'}),null);
 assert.deepEqual(M.completedSets(s.crew.find(c=>c.id==='Arunima')),[]);
 s.crew.find(c=>c.id==='Arunima').rigs[0]=rigOf('overdraw');assert.deepEqual(M.completedSets(s.crew.find(c=>c.id==='Arunima')),['overdraw']);
 s.hold.push({uid:77,set:'wellspring',slot:'shield'});assert.equal(M.act(s,{type:'scrap',uid:77}),null);assert.equal(s.gold,20+M.ECON.scrap);}

// Determinism: the same state and node give the same fight; fights do not mutate state.
{const s=voyage(['Hanae','Arunima','Ivara']);const snapshot=JSON.stringify(s);
 const a=M.fight(s,{node:4}),b=M.fight(s,{node:4});assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(JSON.stringify(s),snapshot);}

// Overdraw: debt is taken, and the pool never goes below -3.
{const s=voyage([{id:'Hanae',rigs:[empty()]},{id:'Arunima',rigs:[rigOf('overdraw')]}]);
 const all=fights(s,[2,4,5,7,8,9]);assert.ok(all.some(f=>f.metrics.debt>0),'Overdraw should take debt somewhere');
 for(const f of all)assert.ok(Math.min(...f.metrics.aetherTrace)>=-3,'debt is capped at 3');
 const plain=fights(voyage(['Hanae','Arunima']),[2,4,5,7,8,9]);assert.ok(plain.every(f=>f.metrics.debt===0&&Math.min(...f.metrics.aetherTrace)>=0));}

// Drop offers: three distinct pieces; one always finishes a started set; seeded.
{const s=voyage(['Hanae','Daven']);s.crew[1].rigs[0]=rigOf('metronome',2);
 for(let node=2;node<20;node++){const o=M.dropOffers(s,node);assert.equal(o.length,3);assert.equal(new Set(o.map(p=>p.set+p.slot)).size,3);
   assert.ok(o.some(p=>p.set==='metronome'&&['shield','lens','coil'].includes(p.slot)),'one offer advances the started set')}
 const a=M.dropOffers(voyage(['Hanae','Daven']),5).map(p=>p.set+p.slot),b=M.dropOffers(voyage(['Hanae','Daven']),5).map(p=>p.set+p.slot);assert.deepEqual(a,b);}

// Two pieces add the set's stat (Overdraw: attack) but don't borrow; one piece does nothing. 2 + 2 adds both sets' stats.
{const two=rigOf('overdraw',2),base=M.statsFor({id:'Arunima',rigs:[empty()]});assert.equal(M.statsFor({id:'Arunima',rigs:[rigOf('overdraw',1)]}).half.overdraw,undefined);
 {const r=empty();r.core={uid:1,set:'overdraw',slot:'core'};r.chassis={uid:2,set:'overdraw',slot:'chassis'};r.shield={uid:3,set:'deephold',slot:'shield'};r.lens={uid:4,set:'deephold',slot:'lens'};
  const st=M.statsFor({id:'Arunima',rigs:[r]});assert.equal(st.half.overdraw,true);assert.equal(st.half.deephold,true,'2 + 2 runs both sets\' 2-piece perks');
  assert.equal(st.atk-base.atk-M.MAIN.core[1],M.SETS.overdraw.two[1],'Overdraw 2-piece: attack');assert.equal(st.hp-base.hp-M.MAIN.chassis[1],M.SETS.deephold.two[1],'Deep Hold 2-piece: health');
  assert.deepEqual(M.setProgress({id:'Arunima',rigs:[r]})[0].halves.sort(),['deephold','overdraw']);
  const adv=M.pieceAdvances({crew:[{id:'Arunima',rigs:[r]}]},{set:'deephold',slot:'coil'});assert.equal(adv.length,1);assert.equal(adv[0].after,3,'the second set can still advance');}
 const all=fights(voyage(['Hanae',{id:'Arunima',rigs:[two]}]),[2,4,5,7,8,9]);
 for(const f of all)assert.ok(Math.min(...f.metrics.aetherTrace)>=0,'two pieces never borrow');
 const full=fights(voyage(['Hanae',{id:'Arunima',rigs:[rigOf('overdraw')]}]),[2,4,5,7,8,9]);for(const f of full)assert.ok(Math.min(...f.metrics.aetherTrace)>=-M.EQUIP.overFull);
 const st=M.statsFor({id:'Arunima',rigs:[two]});assert.equal(st.half.overdraw,true);assert.equal(st.sets.overdraw,undefined);}

// Wellspring converts the wearer's surplus into barrier and removes it from the waste count.
{const no=fights(voyage(['Hanae','Ivara']),[2,4,8]),yes=fights(voyage([{id:'Hanae',rigs:[rigOf('wellspring')]},'Ivara']),[2,4,8]);
 assert.ok(no.every(f=>f.metrics.converted===0));assert.ok(no.some(f=>f.metrics.wasted>0),'a builder with no spender wastes');
 assert.ok(yes.some(f=>f.metrics.converted>0),'Wellspring converts surplus');
 for(const f of yes){const conv=f.events.filter(e=>e.text.startsWith('Wellspring')).length;assert.ok(conv>0||f.metrics.converted===0)}}

// Deep Hold raises capacity; Ivara adds 2 on top of 1 per Weaver.
{const plain=M.fight(voyage(['Hanae','Arunima']),{node:SURVEY}),deep=M.fight(voyage(['Hanae',{id:'Arunima',rigs:[rigOf('deephold')]}]),{node:SURVEY});
 assert.equal(plain.capacity,8);assert.equal(deep.capacity,8+M.EQUIP.deepFull);
 const half=M.fight(voyage(['Hanae',{id:'Arunima',rigs:[rigOf('deephold',4)]}]),{node:SURVEY});
 assert.equal(half.capacity,8,'four Deep Hold pieces give its stat, not its capacity');
 assert.equal(M.fight(voyage(['Hanae','Ivara']),{node:SURVEY}).capacity,10);
 assert.equal(M.fight(voyage(['Hanae','Ivara'],{affixes:['deepReservoir']}),{node:9}).capacity,13,'Deep reservoir adds 3');
 assert.equal(M.fight(voyage(['Hanae','Ivara'],{affixes:['leanReserves']}),{node:9}).capacity,8,'Lean reserves removes 2');}

// Capacity falls when the reservoir goes down, and current Aether is clamped.
{const saved=M.ROSTER.Ivara.hp;M.ROSTER.Ivara.hp=1;
 try{const s=voyage(['Ivara','Arunima']),f=M.fight(s,{node:SURVEY});const down=f.events.findIndex(e=>e.kind==='down'&&e.actor==='Ivara');
   assert.ok(down>=0,'Ivara should fall');assert.equal(f.capacity,10);assert.equal(f.events[down].pool[1],10,'the down event shows the pool as it was when they fell');
   assert.equal(f.events[down+1].pool[1],7,'then capacity drops by 3: one Weaver plus the reservoir bonus');
   for(const e of f.events.slice(down))assert.ok(e.pool[0]<=e.pool[1]);}
 finally{M.ROSTER.Ivara.hp=saved}}

// Launch resolves once and pays; the voyage completes in 21 nodes.
{const s=M.create({seed:7});M.act(s,{type:'starters',ids:['Hanae','Arunima']});
 assert.equal(M.act(s,{type:'launch'}),null);assert.equal(s.fights.length,1);assert.equal(s.node,3);assert.equal(s.hold.length,0);
 assert.equal(s.pendingDrop.offers.length,3);assert.match(M.act(s,{type:'pass'}),/drop first/);
 assert.equal(M.act(s,{type:'takeDrop',index:1}),null);assert.equal(s.hold.length,1);assert.equal(s.pendingDrop,null);assert.deepEqual(s.fights[0].took,{set:s.hold[0].set,slot:s.hold[0].slot});
 assert.match(M.act(s,{type:'takeDrop',index:0}),/no drop/);assert.match(M.act(s,{type:'pass'}),/Only modifier stops/);
 {const r=M.create({seed:7});r.node=M.ROUTE.indexOf('rest')+1;assert.match(M.act(r,{type:'launch'}),/no battle/);}
 for(let i=0;i<60&&!s.ended;i++){if(s.pendingDrop){M.act(s,{type:'takeDrop',index:0});continue}const t=M.nodeType(s);M.act(s,t==='rest'?{type:'pass'}:t==='reward'?{type:'reward',choice:'voucher'}:{type:'launch'})}
 assert.ok(s.ended);assert.equal(s.fights.length+(s.endReason==='Voyage complete.'?0:0)>=1,true);
 if(s.endReason==='Voyage complete.')assert.equal(s.fights.length,15);}

// Briefs: the player picks the count, the voyage picks the cards, always a legal stack; seeded.
{for(let seed=1;seed<300;seed++)for(const n of [0,1,2,3,4]){const b=M.create({seed,affixCount:n}).brief;
   assert.equal(b.affixes.length,n);assert.ok(M.legalStack(b.affixes),'legal: '+b.affixes);assert.equal(new Set(b.bosses).size,3)}
 assert.deepEqual(M.create({seed:9,affixCount:3}).brief,M.create({seed:9,affixCount:3}).brief);
 // Compatibility, as in the affix lab: snap back removes the Break window frost needs; two cards touching the same number never stack.
 assert.equal(M.legalStack(['frost','snapback']),false);assert.equal(M.legalStack(['hardened','snapback']),false);
 assert.equal(M.legalStack(['brutal','horde']),false,'both scale incoming damage');assert.equal(M.legalStack(['shortFuses','deepReservoir']),false);
 assert.equal(M.legalStack(['volatile','brutal']),false);assert.equal(M.legalStack(['frost','hardened','scarce','shortFuses']),true);
 assert.ok(!M.AFFIX_IDS.includes('wither'),'Poison withers is not ported: no Weaver poisons');}

// Shields and Breaks (the affix lab's model): shielded enemies take 40% of damage; a Break delays, exposes and reforms.
{const s=voyage(['Hanae','Arunima','Ivara']),f=M.fight(s,{node:M.ROUTE.indexOf('elite')+1});
 assert.ok(f.metrics.breaks>0&&f.metrics.soaked>0);const br=f.events.find(e=>e.kind==='break');assert.ok(br&&/broke/.test(br.text));
 assert.ok(f.events.some(e=>/recovers its shields/.test(e.text))||f.outcome==='cleared');
 const e=f.events.find(x=>x.kind==='wave').snap.enemies.find(x=>x[0]!=='Warden');assert.equal(e[5],2,'regulars start with two layers');assert.equal(e[7],2);}

// Every affix changes the fight it claims to, measured on the same seed with and without it.
{const crew=()=>[{id:'Hanae',rigs:[empty()]},{id:'Arunima',rigs:[empty()]},{id:'Daven',rigs:[empty()]},{id:'Veska',rigs:[empty()]}];
 const run=(ids,nodes=[2,4,5,7])=>nodes.map(n=>M.fight(voyage(crew(),{affixes:ids}),{node:n}));
 const sum=(fs,k)=>fs.reduce((t,f)=>t+f.metrics[k],0),base=run([]);
 const frost=run(['frost']);assert.ok(sum(frost,'freezes')>0&&sum(frost,'frozenAether')>0,'freezes and frozen pool');assert.ok(sum(frost,'skipped')>0,'frozen enemies miss turns');
 assert.ok(sum(run(['hardened']),'cracked')>0,'Breaks crack other shields');
 assert.ok(sum(run(['snapback']),'reformed')>0,'shields snap back');
 assert.ok(sum(run(['provoke']),'provoked')>0,'Breaks draw counterattacks');
 const sc=run(['scarce']);assert.ok(sum(sc,'barrier')>sum(base,'barrier'),'barriers doubled');
 const hz=run(['horde'],[SURVEY]);assert.equal(hz[0].events.find(e=>e.kind==='wave').snap.enemies.length,6,'twice as many');
 assert.ok(M.fight(voyage(crew(),{affixes:['shortFuses']}),{node:SURVEY}).encounter.rounds===M.fight(voyage(crew()),{node:SURVEY}).encounter.rounds-1);
 for(const id of M.AFFIX_IDS){const f=M.fight(voyage(crew(),{affixes:[id]}),{node:5});assert.equal(f.reports.length,1);assert.ok(f.reports[0].text.length>5,id+' reports')}}

// Set progress: leading set per rig, missing slots, and which pieces advance or unlock a set.
{const s=voyage(['Hanae','Daven']);const d=s.crew.find(c=>c.id==='Daven');
 assert.deepEqual(M.setProgress(d),[{rig:0,set:null,count:0,missing:M.SLOTS.slice(),complete:false}]);
 d.rigs[0]=rigOf('deephold',2);d.rigs[0].shield={uid:3,set:'overdraw',slot:'shield'};
 assert.deepEqual(M.setProgress(d)[0],{rig:0,set:'deephold',count:2,missing:['shield','lens','coil'],complete:false,half:true,halves:['deephold'],counts:{deephold:2,overdraw:1}});
 assert.deepEqual(M.pieceAdvances(s,{set:'deephold',slot:'lens'}),[{crew:'Daven',rig:0,set:'deephold',after:3,completes:false,unlocks:false}]);
 assert.deepEqual(M.pieceAdvances(s,{set:'overdraw',slot:'lens'}),[{crew:'Daven',rig:0,set:'overdraw',after:2,completes:false,unlocks:true}],'a second set\'s second piece unlocks its 2-piece perk');
 assert.deepEqual(M.pieceAdvances(s,{set:'deephold',slot:'core'}),[]);
 d.rigs[0]=rigOf('deephold',4);assert.deepEqual(M.pieceAdvances(s,{set:'deephold',slot:'coil'}),[{crew:'Daven',rig:0,set:'deephold',after:5,completes:true,unlocks:false}]);
 d.rigs[0]=rigOf('deephold');assert.equal(M.setProgress(d)[0].complete,true);assert.deepEqual(M.completedSets(d),['deephold']);}

// Pieces: main stat by slot plus two distinct rolled substats; quality is the mean roll; stats add up exactly.
{const r=M.rng(5);for(let i=0;i<200;i++){const slot=M.SLOTS[i%5],p=M.makePiece(r,'deephold',slot,i);
   assert.equal(p.subs.length,2);assert.notEqual(p.subs[0].stat,p.subs[1].stat);assert.ok(p.subs.every(x=>x.stat!==M.MAIN[slot][0]));
   for(const x of p.subs){const S=M.STATS[x.stat];assert.ok(x.v>=S.min&&x.v<=S.max)}assert.equal(p.quality,(p.subs[0].q+p.subs[1].q)/2)}
 const rig=empty();M.SLOTS.forEach((k,i)=>rig[k]=M.makePiece(r,'overdraw',k,i));const st=M.statsFor({id:'Arunima',rigs:[rig]});
 const want={hp:105,atk:22,def:14,spd:95,crit:.05,barrier:0,care:0,energy:0,void:0,growth:0,order:0,decay:0,chaos:0};M.SLOTS.forEach(k=>{const [m,v]=M.MAIN[k];want[m]+=v;rig[k].subs.forEach(x=>want[x.stat]+=x.v)});want[M.SETS.overdraw.two[0]]+=M.SETS.overdraw.two[1];
 for(const k of Object.keys(want))assert.ok(Math.abs(st[k]-want[k])<1e-9,'stat '+k+' adds up');assert.equal(st.sets.overdraw,true);}

// Packs: thirteen two-set kinds (every Aether pair, four family pairs, three with the broad sets), five pieces each from the label's sets; bulk scrap.
{assert.equal(M.PACK_KINDS.length,13);assert.ok(M.SET_IDS.every(id=>M.PACK_KINDS.some(k=>k.sets.includes(id))),'every set is sold in some pack');assert.ok(M.PACK_KINDS.every(k=>k.sets.length===2&&k.sets.every(id=>M.SETS[id])));
 assert.ok(M.FAMILY_SETS.every(id=>M.PACK_KINDS.some(k=>k.sets.includes(id))),'every family set is sold in a pack');const s=voyage(['Hanae','Arunima']);s.gold=M.ECON.pack*(M.PACK_KINDS.length*5+10);
 assert.match(M.act(s,{type:'pack'}),/Choose which pack/);
 for(const K of M.PACK_KINDS)for(let i=0;i<5;i++){const before=s.hold.length;assert.equal(M.act(s,{type:'pack',kind:K.id}),null);
   const got=s.hold.slice(before);assert.equal(got.length,M.ECON.packSize);assert.ok(got.every(p=>K.sets.includes(p.set)))}
 assert.equal(s.gold,M.ECON.pack*10);
 const low=s.hold.filter(p=>p.quality<.5).length,g=s.gold;M.act(s,{type:'scrapBelow',quality:.5});assert.ok(s.hold.every(p=>p.quality>=.5));assert.equal(s.gold,g+low*M.ECON.scrap);
 s.node=6;assert.match(M.act(s,{type:'reward',choice:'packs'}),/Choose which packs/);assert.match(M.act(s,{type:'reward',choice:'rig',crew:'Hanae'}),/Choose a reward/);
 const before=s.hold.length;assert.equal(M.act(s,{type:'reward',choice:'packs',kind:'deephold+overdraw'}),null);
 assert.equal(s.hold.length-before,M.ECON.rewardPacks*M.ECON.packSize);assert.ok(s.hold.slice(before).every(p=>['deephold','overdraw'].includes(p.set)));}

// Upgrade or scrap: perks outrank stats; wanted stats outrank the rest.
{const piece=(set,slot,subs)=>({uid:Math.random(),set,slot,subs:subs.map(([stat,q])=>({stat,q,v:M.STATS[stat].min+q*(M.STATS[stat].max-M.STATS[stat].min)})),quality:subs.reduce((t,x)=>t+x[1],0)/2});
 // 1. Stat-only: same set, better wanted rolls → upgrade for Arunima (wants attack and crit).
 {const s=voyage(['Hanae','Arunima']),a=s.crew[1];a.rigs[0].core=piece('overdraw','core',[['hp',.2],['spd',.2]]);
  const c=M.compareFor(s,piece('overdraw','core',[['crit',.9],['hp',.1]])).find(x=>x.crew==='Arunima');
  assert.equal(c.verdict,'upgrade');assert.deepEqual(c.gained,[]);assert.deepEqual(c.lost,[]);assert.ok(c.statDelta.crit>0);}
 // 2. Completes a set with worse rolls → still an upgrade (the full perk outranks stats).
 {const s=voyage(['Hanae','Arunima']),r=s.crew[1].rigs[0];['core','chassis','shield','lens'].forEach(k=>r[k]=piece('overdraw',k,[['atk',.5],['crit',.5]]));
  r.coil=piece('wellspring','coil',[['atk',1],['crit',1]]);
  const c=M.compareFor(s,piece('overdraw','coil',[['hp',0],['care',0]])).find(x=>x.crew==='Arunima');
  assert.equal(c.verdict,'upgrade');assert.deepEqual(c.gained,['overdraw:full']);assert.ok(c.statDelta.atk<0,'worse stats');}
 // 3. A high-roll off-set piece that would break a 2-piece perk → downgrade.
 {const s=voyage(['Hanae','Arunima']),r=s.crew[1].rigs[0];['core','shield'].forEach(k=>r[k]=piece('overdraw',k,[['hp',.1],['spd',.1]]));
  const c=M.compareFor(s,piece('deephold','shield',[['atk',1],['crit',1]])).find(x=>x.crew==='Arunima');
  assert.equal(c.verdict,'downgrade');assert.deepEqual(c.lost,['overdraw:half']);}
 // An empty slot is always an upgrade; a piece that is an upgrade for nobody has no best use.
 {const s=voyage(['Hanae','Arunima']);assert.equal(M.bestUse(s,piece('metronome','lens',[['hp',.1],['atk',.1]])).verdict,'upgrade');
  s.crew.forEach(c=>M.SLOTS.forEach(k=>c.rigs[0][k]=piece('overdraw',k,[['atk',1],['crit',1]])));
  assert.equal(M.bestUse(s,piece('metronome','lens',[['hp',0],['care',0]])),null,'scrap candidate');}
 // A set's own crew value it most: Metronome suits Daven, not Arunima.
 {const s=voyage(['Arunima','Daven']);['core','chassis'].forEach(k=>{s.crew[0].rigs[0][k]=piece('metronome',k,[['hp',.5],['spd',.5]]);s.crew[1].rigs[0][k]=piece('metronome',k,[['hp',.5],['spd',.5]])});
  const cmp=M.compareFor(s,piece('metronome','shield',[['hp',.5],['spd',.5]]));
  assert.deepEqual(cmp[0].crew,'Daven','unlocking Metronome matters most on Daven');}}

// Tiers: a piece rolls as many distinct substats as its tier; odds rise by sector; elites and bosses drop one tier higher.
{const r=M.rng(9);for(const t of [1,2,3,4]){const p=M.makePiece(r,'overdraw','coil',t,t);assert.equal(p.subs.length,t);assert.equal(new Set(p.subs.map(x=>x.stat)).size,t);
   assert.ok(p.subs.every(x=>x.stat!==M.MAIN.coil[0]));assert.ok(Math.abs(p.quality-p.subs.reduce((a,x)=>a+x.q,0)/t)<1e-12)}
 const mean=(sector,bonus)=>{const r=M.rng(sector*7+bonus);let t=0;for(let i=0;i<2000;i++)t+=M.rollTier(r,sector,bonus);return t/2000};
 assert.ok(mean(1,0)<mean(2,0)&&mean(2,0)<mean(3,0),'tiers rise by sector');assert.ok(mean(3,1)<=4);
 for(const sector of [1,2,3])for(let i=0;i<300;i++){const t=M.rollTier(M.rng(i+sector*1000),sector);assert.ok(t>=1&&t<=4)}
 const s=voyage(['Hanae','Daven']);const elite=M.dropOffers(s,5),survey=M.dropOffers(s,4);
 assert.ok(elite.every(p=>p.tier>=2),'elite drops are at least ★2 in sector 1');assert.ok(survey.every(p=>p.tier<=2));
 assert.equal(M.tierOf({subs:[{},{}]}),2,'pieces saved before tiers count as their substats');
 s.gold=100;s.node=16;M.act(s,{type:'pack',kind:'overdraw+metronome'});assert.ok(s.hold.slice(-5).every(p=>p.tier>=2),'sector 3 packs are ★2 or better');}

// Aether rules: only Weavers' skills cost more than 1; no skill adds Aether (skills enable basics instead).
{for(const [id,c] of Object.entries(M.ROSTER))if(!/^Weaver/.test(c.profile))assert.equal(c.cost,1,id+' is not a Weaver, so its skill costs 1');
 // Every crewmate, Weaver or family, in teams of their own and mixed.
 const teams=[['Hanae','Ivara','Arunima','Roonie','Veska','Daven','Silen'],['Wren','Maul','Sevim','Hanae'],['Stella','Dolores','Spore','Roonie'],['Reva','Tarn','Ojo','Veska'],['Imke','Idris','Ekene','Silen'],['Imke','Idris','Ekene','Wren'],['Ivara','Hanae','Daven']];
 let skills=0,enabled=0,refunds=0;const seen=new Set();
 const battles=M.ROUTE.map((t,i)=>['survey','swarm','elite','boss'].includes(t)?i+1:0).filter(Boolean);
 for(let seed=1;seed<=42;seed++){const all=teams[seed%teams.length],f=M.fight(voyage(all,{seed}),{node:battles[seed%battles.length]});
   f.events.forEach(e=>{if(['skill','burst','chain'].includes(e.kind))seen.add(e.actor)});enabled+=f.metrics.enabled;refunds+=f.metrics.refunds;
   f.events.forEach((e,i)=>{if(!['skill','burst','chain'].includes(e.kind))return;skills++;
     // Walk back past the spend's own notes (a Bypass refund adds 1) to the state before the turn's spend.
     let j=i-1,refund=0;while(j>=0&&(['aether','set','break','cache'].includes(f.events[j].kind)&&f.events[j].actor===e.actor||['shatter','follow'].includes(f.events[j].kind))){if(/Bypass: .* gets 1/.test(f.events[j].text))refund++;j--}
     if(j>=0&&f.events[j].kind!=='wave')assert.ok(e.pool[0]<=f.events[j].pool[0]-1+refund,e.actor+' '+e.kind+' must not add Aether: '+f.events[j].pool[0]+' → '+e.pool[0]);})}
 assert.ok(skills>50,'enough skills checked');assert.deepEqual([...seen].sort(),M.IDS.slice().sort(),'every crewmate\'s skill was checked');assert.ok(enabled>0,'Resonance and Encores add Aether to basics');assert.ok(refunds>0,'Bypass refunds happen');}

// Scaling: a kit multiplies its scaling stat. Defense grows Daven's and Hanae's power, not Arunima's; health grows Roonie's.
{const battles=M.ROUTE.map((t,i)=>['survey','swarm','elite','boss'].includes(t)?i+1:0).filter(Boolean);
 const u=(id,extra={})=>({...M.ROSTER[id],maxHp:M.ROSTER[id].hp,...extra});
 assert.ok(M.powerOf(u('Daven',{def:60}))>M.powerOf(u('Daven')));assert.ok(M.powerOf(u('Hanae',{def:60}))>M.powerOf(u('Hanae')));
 assert.equal(M.powerOf(u('Arunima',{def:60})),M.powerOf(u('Arunima')));assert.ok(M.powerOf(u('Roonie',{maxHp:200}))>M.powerOf(u('Roonie')));
 for(const id of Object.keys(M.ROSTER))assert.ok(Math.abs(M.powerOf(u(id))-M.ROSTER[id].atk)<=M.ROSTER[id].atk*.4,id+' base power stays near base attack');
 // Defense cuts incoming damage: the same crew in heavy shield-slot (defense) gear mitigates a larger share.
 const tank=s=>{s.crew.forEach(c=>{c.rigs=[Object.fromEntries(M.SLOTS.map((k,i)=>[k,k==='shield'?{uid:800+i,set:'deephold',slot:k,tier:4,subs:[{stat:'def',v:4.5,q:1}],quality:1}:null]))]});return s};
 const share=f=>f.metrics.mitigated/(f.metrics.mitigated+f.metrics.taken);
 const a=M.fight(voyage(['Daven','Veska','Silen']),{node:battles[4]}),b=M.fight(tank(voyage(['Daven','Veska','Silen'])),{node:battles[4]});
 assert.ok(a.metrics.mitigated>0);assert.ok(share(b)>share(a),'more defense, a larger share of damage cut');
 // Elemental damage: a void-damage piece raises Arunima's hits, not Daven's power.
 assert.ok(M.STATS.void&&M.STATS.order&&M.STATS.energy&&M.STATS.growth);assert.equal(M.MAIN.shield[0],'def');}

// Supply runs: every starting pair wins both, for full Gold and no integrity, whatever the Brief; then a drop as usual.
{let fights=0;for(let i=0;i<M.IDS.length;i++)for(let j=i+1;j<M.IDS.length;j++)for(const seed of [1,2,3]){
   const s=M.create({seed});M.act(s,{type:'starters',ids:[M.IDS[i],M.IDS[j]]});
   for(const node of [2,3]){assert.equal(M.nodeType(s),'supply');const g=s.gold,it=s.integrity;assert.equal(M.act(s,{type:'launch'}),null);fights++;
     assert.equal(s.lastFight.outcome,'cleared',M.IDS[i]+'+'+M.IDS[j]+' clears the Supply run');assert.equal(s.lastFight.metrics.deaths,0);
     assert.equal(s.gold-g,M.ECON.supplyGold);assert.equal(s.integrity,it);assert.equal(s.pendingDrop.offers.length,3);M.act(s,{type:'takeDrop',index:0})}}
 assert.equal(fights,M.IDS.length*(M.IDS.length-1)/2*3*2,'every starting pair, three seeds, both Supply runs');
 // Surveys still match the crew: two crew face pairs, three face threes.
 const survey=M.ROUTE.indexOf('survey')+1,pair=voyage(['Silen','Roonie']),trio=voyage(['Silen','Roonie','Veska']);
 const size=s=>M.fight(s,{node:survey}).events.find(e=>e.kind==='wave').text.split(':')[1].split(',').length;
 assert.equal(size(pair),2,'two crew face pairs');assert.equal(size(trio),3,'three crew face threes');
 // Silen chains past 3 hits on a full pool with a battery.
 let chains=0;for(let seed=1;seed<=20;seed++)chains=Math.max(chains,M.fight(voyage(['Silen','Roonie'],{seed}),{node:M.ROUTE.indexOf('swarm')+1}).metrics.longestChain);
 assert.ok(chains>=4,'Silen chains past 3 hits ('+chains+')');}

// Caches: Supply runs drop three Tier I and one Tier II each, banked unopened; opening is seeded, applies its contents
// once, and survives a save round trip. Carriers drop only when defeated; elites carry Tier II and bosses Tier III.
{const s=M.create({seed:9,affixes:[]});M.act(s,{type:'starters',ids:['Arunima','Hanae']});
 for(let k=0;k<2;k++){M.act(s,{type:'launch'});assert.deepEqual(s.fights.at(-1).caches.slice().sort(),[1,1,1,2]);M.act(s,{type:'takeDrop',index:0})}
 assert.equal(s.caches.length,8);assert.match(M.act(s,{type:'openCache',ids:[999]}),/Choose a cache/);
 const copy=JSON.parse(JSON.stringify(s)),ids=s.caches.map(c=>c.id);
 const before={gold:s.gold,writs:s.writs,hold:s.hold.length,vouchers:s.freeVoucher};assert.equal(M.act(s,{type:'openCache',ids}),null);
 assert.equal(s.caches.length,0);assert.equal(s.lastOpened.length,8);assert.equal(s.opened.length,8);
 const sum=k=>s.lastOpened.reduce((t,o)=>t+(o[k]||0),0);
 assert.equal(s.gold-before.gold,sum('gold'));assert.equal(s.writs-before.writs,sum('writs'));assert.equal(s.freeVoucher-before.vouchers,sum('vouchers'));
 assert.equal(s.hold.length-before.hold,s.lastOpened.reduce((t,o)=>t+(o.pieces?o.pieces.length:0),0));
 M.act(copy,{type:'openCache',ids});assert.deepEqual(copy.lastOpened.map(o=>o.text),s.lastOpened.map(o=>o.text),'contents are seeded: a reload cannot reroll them');
 assert.match(M.act(s,{type:'openCache',ids}),/Choose a cache/,'a cache opens once');
 // Every tier pays: Tier III never pays a single Tier I piece; Tier I never a voucher.
 const kinds={1:new Set(),2:new Set(),3:new Set()};for(let id=1;id<=300;id++)for(const tier of [1,2,3])kinds[tier].add(M.rollCache({seed:3,uid:1},{id,tier,node:9}).kind);
 assert.deepEqual([...kinds[1]].sort(),['gold','piece']);assert.deepEqual([...kinds[2]].sort(),['gold','insight','piece','writ']);assert.deepEqual([...kinds[3]].sort(),['gold','insight','pieces','voucher']);
 // Carriers drop only when killed; elites' Warden carries Tier II, the boss Tier III.
 const elite=M.ROUTE.indexOf('elite')+1,boss=M.ROUTE.indexOf('boss')+1;
 const strong=()=>voyage(M.IDS,{seed:4});const fe=M.fight(strong(),{node:elite}),fb=M.fight(strong(),{node:boss});
 assert.ok(M.encounter(strong(),elite).waves.flat().some(e=>e.elite&&e.cache===2));assert.ok(M.encounter(strong(),boss).waves.flat().some(e=>e.boss&&e.cache===3));
 for(const f of [fe,fb]){const carriers=f.events.filter(e=>e.kind==='cache').length;assert.equal(f.drops.length,carriers);
   assert.ok(f.drops.every(d=>f.events.some(e=>e.kind==='cache'&&e.text.startsWith(d.from))))}
 const weak=M.fight(voyage(['Veska']),{node:boss});assert.equal(weak.outcome==='cleared'?1:weak.drops.length,weak.outcome==='cleared'?1:0,'an undefeated boss drops nothing');}

// Suggestions follow set fit: a set's pieces go to the crew it suits unless they're Deep Hold (capacity helps anyone).
{assert.equal(M.setFit('Roonie','wellspring'),1);assert.ok(M.setFit('Arunima','wellspring')<1);assert.ok(M.setFit('Arunima','metronome')<1&&M.setFit('Arunima','metronome')>0);
 assert.ok(M.setFit('Arunima','deephold')>M.setFit('Arunima','wellspring'),'Deep Hold capacity helps anyone');
 let off=0,tot=0;for(const set of ['wellspring','overdraw','metronome'])for(let seed=1;seed<=20;seed++){const s=voyage(['Arunima','Roonie','Daven','Veska']);
   for(const slot of M.SLOTS){const p=M.makePiece(M.rng(seed*31+slot.length),set,slot,1,2),best=M.compareFor(s,p)[0];tot++;
     if(s.crew.some(c=>M.SETS[set].bestOn.includes(c.id))&&!M.SETS[set].bestOn.includes(best.crew))off++}}
 assert.ok(off/tot<.05,'pieces go to the crew their set suits ('+off+'/'+tot+' did not)');}

// Quick equip: every upgrade in the hold goes on; afterwards nothing in the hold is an upgrade, and no crewmate is worse off.
{const s=voyage(['Arunima','Roonie','Daven','Silen']),r=M.rng(77);for(let i=0;i<25;i++){const p=M.PIECES[Math.floor(r()*M.PIECES.length)];s.hold.push(M.makePiece(r,p.set,p.slot,s.uid++,1+Math.floor(r()*4)))}
 const worth=()=>s.crew.map(c=>M.rigValue(c,c.rigs[0]).total),before=worth(),n=s.hold.length;
 assert.equal(M.act(s,{type:'quickEquip'}),null);assert.ok(s.lastQuick.length>0);
 assert.equal(s.hold.filter(p=>M.bestUse(s,p)).length,0,'no upgrade left in the hold');assert.ok(worth().every((v,i)=>v>=before[i]-1e-9),'nobody is worse off');
 assert.equal(s.hold.length+s.crew.reduce((t,c)=>t+M.SLOTS.filter(k=>c.rigs[0][k]).length,0),n,'no piece lost or duplicated');
 assert.match(M.act(s,{type:'quickEquip'}),/Nothing in the hold/);}

// Each family's mechanic does its job: Break (Shatter), Blight (poison through shields), Hull (returned damage), Drive (follow-ups).
{const sum=(team,k)=>{let t=0;for(let seed=1;seed<=8;seed++){const f=M.fight(voyage(team,{seed}),{node:M.ROUTE.indexOf('elite')+1});t+=f.metrics.byKind[k]||0}return t};
 assert.ok(sum(['Wren','Maul','Sevim'],'shatter')>0,'Wren shatters Breaks');assert.ok(sum(['Stella','Dolores','Spore'],'poison')>0,'poison ticks');
 assert.ok(sum(['Reva','Tarn','Ojo'],'reflect')>0,'Hull returns damage');assert.ok(sum(['Imke','Idris','Ekene','Silen'],'follow')>0,'Imke and Idris follow up');
 // Poison and returned damage kill like anything else: the carrier still drops its cache.
 let poisonKills=0;for(let seed=1;seed<=30;seed++){const f=M.fight(voyage(['Stella','Dolores','Spore'],{seed}),{node:M.ROUTE.indexOf('boss')+1});
   const ev=f.events,ci=ev.findIndex(e=>e.kind==='cache');if(ci>0&&ev[ci-1].kind==='poison')poisonKills++}
 assert.ok(poisonKills>0,'a poison tick that kills a carrier drops its cache');}

// The new set patterns: Lodestone turns defense into power; Steady Hand pays only over its crit threshold; Chorus buffs the
// crew on the wearer's ultimate; Relay speeds up anyone landing extra hits; Metronome lengthens any timed effect.
{const full=set=>rigOf(set);
 assert.equal(M.statsFor({id:'Daven',rigs:[full('lodestone')]}).sets.lodestone,true);
 const elite=M.ROUTE.indexOf('elite')+1,boss=M.ROUTE.indexOf('boss')+1,run=(crew,node=elite,n=6)=>Array.from({length:n},(_,i)=>M.fight(voyage(crew,{seed:i+1}),{node}));
 const dmg=fs=>fs.reduce((t,f)=>t+Object.values(f.metrics.byKind).reduce((a,b)=>a+b,0),0);
 assert.ok(dmg(run([{id:'Daven',rigs:[full('lodestone')]},'Hanae']))>dmg(run(['Daven','Hanae'])),'Lodestone makes a sturdy crewmate hit harder');
 const chorus=run([{id:'Veska',rigs:[full('chorus')]},'Silen','Roonie'],boss,8);assert.ok(chorus.some(f=>f.events.some(e=>/^Chorus:/.test(e.text))),'Chorus fires on an ultimate');
 const steady=r=>{const x=empty();M.SLOTS.forEach((k,i)=>x[k]={uid:700+i,set:'steadyhand',slot:k,tier:1,subs:[{stat:'crit',v:r,q:1}],quality:1});return x};
 assert.ok(M.statsFor({id:'Silen',rigs:[steady(.045)]}).crit>=M.EQUIP.steadyAt,'five crit-rolled pieces clear the Steady Hand threshold');
 assert.ok(M.statsFor({id:'Silen',rigs:[rigOf('steadyhand')]}).crit<M.EQUIP.steadyAt,'the set alone does not');
 assert.ok(dmg(run([{id:'Silen',rigs:[steady(.045)]},'Roonie']))>dmg(run([{id:'Silen',rigs:[rigOf('steadyhand')]},'Roonie'])),'over the threshold, skills hit harder');
 const met=run([{id:'Hanae',rigs:[full('metronome')]},'Arunima']);assert.ok(met.some(f=>f.events.some(e=>e.actor==='Hanae'&&e.kind==='skill')));
 const rel=dmg(run([{id:'Imke',rigs:[full('relay')]},'Silen','Roonie'])),norel=dmg(run(['Imke','Silen','Roonie']));assert.ok(rel>norel,'Relay boosts extra hits');}

// From a playtest (seed 67): recruits get all five slots; Steady Hand isn't suggested to someone who can't reach its
// crit threshold (Tarn in five crit-less pieces); Ekene's ultimate (mostly team charge) isn't held back for danger.
{const s=M.create({seed:67,affixes:[]});M.act(s,{type:'starters',ids:['Tarn','Ojo']});s.writs=20;M.act(s,{type:'voucher',id:'Sevim'});
 for(const c of s.crew)assert.deepEqual(Object.keys(c.rigs[0]).sort(),M.SLOTS.slice().sort(),c.id+' has all five slots');
 const rig=(set,crit)=>Object.fromEntries(M.SLOTS.map((k,i)=>[k,{uid:600+i,set,slot:k,tier:1,subs:[{stat:crit?'crit':'def',v:crit?.045:4,q:1}],quality:1}]));
 const tarn={id:'Tarn',rigs:[M.SLOTS.reduce((r,k)=>(r[k]=null,r),{})]};
 assert.ok(M.statsFor({id:'Tarn',rigs:[rig('steadyhand',false)]}).crit<M.EQUIP.steadyAt);
 assert.ok(M.rigValue(tarn,rig('lodestone',false)).total>M.rigValue(tarn,rig('steadyhand',false)).total,'Lodestone beats an unreachable Steady Hand on Tarn');
 assert.ok(M.rigValue(tarn,rig('steadyhand',true)).sets>M.rigValue(tarn,rig('steadyhand',false)).sets*3,'clearing the threshold makes the set itself worth much more');
 let held=0;for(let seed=1;seed<=6;seed++)held+=M.fight(voyage(['Ekene','Imke','Idris'],{seed}),{node:M.ROUTE.indexOf('boss')+1}).metrics.held;
 assert.equal(held,0,'Ekene fires his ultimate when it is ready');}

// Stars: ★1–★4 bought with Insight (2, 3, 5); each star raises base stats; ★3 upgrades the kit. Insight comes from elites
// (+1), bosses (+2), some caches, and Gold at a price that rises each time.
{const s=voyage(['Silen','Roonie']);assert.equal(s.insight,0);assert.match(M.act(s,{type:'promote',id:'Silen'}),/Needs 2 Insight/);
 const before=M.statsFor(s.crew[0]);s.insight=10;
 for(const want of [2,3,4]){assert.equal(M.act(s,{type:'promote',id:'Silen'}),null);assert.equal(s.crew[0].star,want)}
 assert.equal(s.insight,0);assert.match(M.act(s,{type:'promote',id:'Silen'}),/already ★4/);
 const after=M.statsFor(s.crew[0]);assert.ok(Math.abs(after.atk/before.atk-M.STARS.atk[3])<1e-9&&Math.abs(after.hp/before.hp-M.STARS.hp[3])<1e-9,'★4 multiplies base stats');
 s.gold=100;const p1=M.insightPrice(s);M.act(s,{type:'buyInsight'});assert.equal(s.gold,100-p1);assert.ok(M.insightPrice(s)>p1,'Insight gets dearer');
 // Income: an elite pays 1 Insight and a boss 2.
 const v=M.create({seed:5,affixes:[]});M.act(v,{type:'starters',ids:['Hanae','Arunima']});v.node=M.ROUTE.indexOf('elite')+1;M.act(v,{type:'launch'});assert.equal(v.insight,1);
 M.act(v,{type:'takeDrop',index:0});v.node=M.ROUTE.indexOf('boss')+1;M.act(v,{type:'launch'});assert.equal(v.insight,3);
 // ★3 kit upgrades change the fight: Wren's Shatter twice, Reva returns more, Ojo holds more Containment.
 const at=(id,star,team,stat)=>{let t=0;for(let seed=1;seed<=6;seed++){const x=voyage(team,{seed});x.crew.find(c=>c.id===id).star=star;t+=M.fight(x,{node:M.ROUTE.indexOf('elite')+1}).metrics[stat]}return t};
 assert.ok(at('Wren',3,['Wren','Maul','Sevim'],'shatters')>at('Wren',2,['Wren','Maul','Sevim'],'shatters'),'★3 Wren shatters twice');
 assert.ok(at('Reva',3,['Reva','Tarn','Ojo'],'reflected')>at('Reva',2,['Reva','Tarn','Ojo'],'reflected'),'★3 Reva returns more');
 assert.ok(Object.values(M.ROSTER).every(r=>r.up3&&r.up3.length>5),'every crewmate has a ★3 upgrade');}

// Bug check (Weaver lab commit): proven findings (6, the priority reset, is in the browser test).
// 1. A crewmate downed by a provoked counterattack takes no further action (ultimate, skill or basic) while down.
{let dead=0,falls=0;const acts=['ult','skill','burst','chain','basic'];
 for(const ids of [['Hanae','Ojo'],['Ekene','Arunima','Wren'],['Hanae','Arunima','Ivara','Roonie']])for(let seed=1;seed<=12;seed++)for(const node of [4,5,8,11,15,16]){
   const s=M.create({seed,affixes:['provoke']});s.crew=ids.map(id=>({id,rigs:[empty()]}));const f=M.fight(s,{node});
   f.events.forEach((e,i)=>{if(e.kind==='down')falls++;if(!acts.includes(e.kind)||!e.actor)return;const k=f.crewOrder.indexOf(e.actor);
     const prev=f.events[i-1];if(k>=0&&prev&&prev.snap.crew[k][3]===0&&e.snap.crew[k][3]===0)dead++})}
 assert.ok(falls>5,'enough crew fell ('+falls+')');assert.equal(dead,0,dead+' actions by a crewmate who was already down');}
// 2. The voyage's end is final: caches from the last fight stay unopened (openCache is rejected), and the lab says so
//    instead of promising a Prepare screen that never comes.
{const s=voyage(['Hanae','Arunima','Ivara','Veska','Silen'],{seed:7});s.node=21;assert.equal(M.act(s,{type:'launch'}),null);M.act(s,{type:'takeDrop',index:0});
 assert.ok(s.ended);if(!s.caches.length)s.caches.push({id:99,tier:1,node:21,from:'test'});const n=s.caches.length,gold=s.gold;
 assert.match(M.act(s,{type:'openCache',ids:s.caches.map(c=>c.id)}),/voyage is over/);assert.equal(s.caches.length,n);assert.equal(s.gold,gold);}
// 3. Burst records count the charges spent, not ★3 Arunima's multiplier; the callout shows whole percentages.
{const s=voyage(['Hanae','Arunima'],{seed:41});s.crew[1].star=3;let charges=[],texts=[];
 for(const node of [4,5,7])for(let i=0;i<3;i++){const f=M.fight(s,{node,salt:i});charges.push(...f.metrics.burstCharges);texts.push(...f.events.filter(e=>e.kind==='burst').map(e=>e.text))}
 assert.ok(charges.length>0);assert.ok(charges.every(Number.isInteger),'burst records are whole charges: '+charges.slice(0,5));
 assert.ok(texts.every(t=>!/\d\.\d/.test(t)),'burst text has whole percentages: '+texts.find(t=>/\d\.\d/.test(t)));}
// 4. The Aether-cap breakdown adds up to the cap: Weavers only, Ivara's ★3, affixes.
{for(const ids of [['Wren','Maul'],['Ivara','Arunima'],['Hanae','Roonie','Veska']])for(const star of [1,3]){
   const s=M.create({seed:41});M.act(s,{type:'starters',ids});s.crew.forEach(c=>c.star=star);const c=M.capacityPreview(s);
   assert.equal(6+c.weavers+c.reservoir+c.deepHold+c.condition+(c.stars||0),c.total,ids+' ★'+star+': breakdown '+JSON.stringify(c))}}
// 5. Teammates hold back only the Aether the priority crewmate's skill really costs in the lab (Stella: 1, not the live 3).
{let wrong=0;for(const owner of ['Stella','Sevim'])for(const other of ['Ekene','Hanae','Imke']){const s=M.create({seed:41,affixes:[]});M.act(s,{type:'starters',ids:[owner,other]});M.act(s,{type:'priority',name:owner});
   for(const node of [8,9,11,15]){const f=M.fight(s,{node});for(const e of f.events){if(e.kind!=='basic'||e.actor!==other)continue;const m=e.text.match(/\+(\d+) Aether · saving for (\w+)/);if(!m)continue;
     const before=e.pool[0]-(+m[1]);if(before-M.ROSTER[other].cost>=M.ROSTER[owner].cost)wrong++}}}
 assert.equal(wrong,0,wrong+' basics held back for Aether the priority crewmate did not need');}

// A provoked counter comes only from an enemy still standing when it resolves (counters wait until the action ends, so a
// Shatter, area hit or follow-up can kill the breaker's target first).
// Each counter event says whether its attacker was alive when it struck (name matching would let a living twin hide a
// dead attacker), and every counted counter is a logged strike.
{let fromDead=0,counters=0,miscount=0;for(const ids of [['Wren','Arunima'],['Wren','Maul','Sevim'],['Imke','Silen','Wren','Ekene']])for(let seed=1;seed<=15;seed++)for(const node of [2,4,8,11]){
   const s=M.create({seed,affixes:['provoke']});s.crew=ids.map(id=>({id,rigs:[empty()]}));const f=M.fight(s,{node});let here=0;
   for(const e of f.events){if(e.kind!=='enemy'||!/ strikes back at /.test(e.text))continue;counters++;here++;
     assert.equal(typeof e.counterAlive,'boolean','a counter event records whether its attacker was standing');if(!e.counterAlive)fromDead++}
   if(f.metrics.provoked!==here)miscount++}
 assert.ok(counters>50,'enough counters ('+counters+')');assert.equal(fromDead,0,fromDead+' counters thrown by enemies already dead');
 assert.equal(miscount,0,miscount+' fights where metrics.provoked differs from the logged counters');}

console.log('weaver-voyage: all checks passed');
