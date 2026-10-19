'use strict';
// Supply run model: free movement (integer headings, no diagonal bonus, bounds, tap-to-walk) and zone rules (nodes,
// station IN/OUT pads, dispatch, scrap bin, locked zones); unlock pads, coin piles and coin streaming; workers walking
// their default loops; recipe unlocking and requests that climb the ladder; display data for every node, station and
// pad; chain highlight data; par replay and determinism over many seeds; Skip, tiers, hints and near-miss lines.
const assert=require('node:assert/strict'),P=require('../../prototypes/minigames/supply-run/supply-run-model.js');
const SEEDS=40,ids=P.DIFFICULTIES.map(d=>d.id),U=P.U;
const t0=Date.now();
const fresh=(d='normal',seed=1)=>{const pz=P.generate(seed,d);return {pz,st:P.create(pz,{fx:true})};};
const place=(st,z)=>{st.player.x=P.ZONE[z].x;st.player.y=P.ZONE[z].y;};
const steps=(pz,st,n)=>{for(let i=0;i<n;i++)P.step(pz,st);};

// ---- movement --------------------------------------------------------------------------------------------------------
{
  const {pz,st}=fresh();const x0=st.player.x,y0=st.player.y;
  assert.equal(P.apply(pz,st,{type:'move',x:100,y:0}),null);
  steps(pz,st,10);assert.equal(st.player.x,x0+10*P.SPEED);assert.equal(st.player.y,y0);
  P.apply(pz,st,{type:'move',x:0,y:0});const x1=st.player.x;steps(pz,st,5);assert.equal(st.player.x,x1,'0,0 stops');
  P.apply(pz,st,{type:'move',x:100,y:100});
  assert.ok(Math.abs(Math.hypot(st.player.vx,st.player.vy)-P.SPEED)<=1,'diagonals are no faster');
  P.apply(pz,st,{type:'move',x:-7,y:3});assert.ok(Math.abs(Math.hypot(st.player.vx,st.player.vy)-P.SPEED)<=1,'any heading is normalised');
  P.apply(pz,st,{type:'move',x:-100,y:0});steps(pz,st,200);assert.equal(st.player.x,600,'the map edge stops you');
  // tap-to-walk lands exactly on the target and stops there
  const g={type:'goto',x:20*U,y:9*U};assert.equal(P.apply(pz,st,g),null);steps(pz,st,200);
  assert.equal(st.player.x,g.x);assert.equal(st.player.y,g.y);assert.equal(st.player.goto,null);
  // invalid commands change nothing
  const before=JSON.stringify(st);
  for(const bad of [{type:'move',x:1.5,y:0},{type:'move',x:'a',y:0},{type:'goto',x:-5,y:0},{type:'fly'},null])assert.ok(P.apply(pz,st,bad));
  assert.equal(JSON.stringify(st),before);
}

// ---- zones -----------------------------------------------------------------------------------------------------------
{
  const {pz,st}=fresh();
  // A resource node puts items on your back, one at a time, up to your pack size.
  place(st,'node:ore');P.step(pz,st);assert.equal(st.player.zone,'node:ore');
  steps(pz,st,P.DWELL.node+1);assert.ok(st.player.stack.length>=1&&st.player.stack.every(i=>i==='ore'));
  steps(pz,st,60);assert.equal(st.player.stack.length,st.cap,'pack fills to capacity');
  assert.ok(st.fx.some(e=>e.type==='gather'&&e.item==='ore'&&e.zone==='node:ore'));
  // IN pad unloads matching items one by one; the station works the recipe; OUT pad hands the result over.
  place(st,'in:refinery');steps(pz,st,3);const s=st.stations.refinery;
  assert.ok(st.player.stack.length<st.cap&&st.player.stack.length>0,'unloads one item a tick, not all at once');
  steps(pz,st,10);assert.equal(st.player.stack.length,0,'every ore unloaded');
  steps(pz,st,P.STATIONS.refinery.ticks*2+2);assert.ok(s.out>=1,'plates appear on the OUT pad');
  place(st,'out:refinery');steps(pz,st,4);assert.ok(P.count(st.player.stack,'plate')>=1);
  // Dispatch takes only what an open request needs; anything else stays on your back.
  st.player.stack=['ore','plate','plate','plate','plate','plate'];
  steps(pz,st,1);const r=P.openReqs(st)[0];assert.ok(r,'a request is open');assert.equal(r.item,'plate','the first requests are plates');
  place(st,'dispatch');steps(pz,st,12);
  assert.equal(P.count(st.player.stack,'ore'),1,'ore is not delivered');
  assert.ok(st.reqs.some(q=>q.status==='filled'),'plates fill the request');
  // The scrap bin throws away the top item.
  st.player.stack=['ore','crystal'];place(st,'bin');steps(pz,st,P.DWELL.bin+2);assert.deepEqual(st.player.stack,['ore']);
  // Locked places do nothing: on the crystal bloom's spot there is only its price pad.
  const b=fresh();place(b.st,'node:crystal');steps(b.pz,b.st,30);
  assert.equal(b.st.player.zone,'unlock:crystal');assert.equal(b.st.player.stack.length,0);
  assert.equal(P.zoneActive(b.st,'in:synth'),false);assert.equal(P.zoneAt(b.st,P.ZONE['in:synth'].x,P.ZONE['in:synth'].y),null);
}

// ---- coins and unlock pads -------------------------------------------------------------------------------------------
{
  const {pz,st}=fresh();
  steps(pz,st,pz.lts[0].first+1);const r=P.openReqs(st)[0];st.player.stack=Array(r.qty).fill('plate');place(st,'dispatch');steps(pz,st,r.qty+3);
  assert.equal(r.status,'filled');assert.equal(st.wallet,0,'coins are not in the wallet until picked up');
  assert.equal(st.piles.length,1);assert.equal(st.piles[0].n,r.reward);assert.equal(st.earned,r.reward);
  st.player.x=st.piles[0].x;st.player.y=st.piles[0].y;steps(pz,st,1);
  assert.equal(st.piles.length,0);assert.equal(st.wallet,r.reward,'walking over a pile collects it');
  // Pads: visible only after what they need; coins stream in after a short dwell, counting the price down.
  assert.equal(P.padVisible(st,'crystal'),true);assert.equal(P.padVisible(st,'synth'),false,'synthesiser pad hidden until the crystal bloom opens');
  st.wallet=3;place(st,'unlock:crystal');steps(pz,st,P.DWELL.unlock);
  assert.equal(st.paid.crystal,0,'nothing paid during the dwell');
  steps(pz,st,10);assert.equal(st.paid.crystal,3);assert.equal(st.wallet,0);assert.equal(st.unlocked.crystal,undefined);
  st.player.x=16*U;st.player.y=12*U;steps(pz,st,2);assert.equal(st.paid.crystal,3,'paid coins stay paid when you leave');
  st.wallet=50;place(st,'unlock:crystal');steps(pz,st,P.DWELL.unlock+6);
  assert.equal(st.unlocked.crystal,true);assert.equal(st.wallet,50-(P.UNLOCKS.crystal.price-3));
  assert.ok(st.fx.some(e=>e.type==='pay')&&st.fx.some(e=>e.type==='unlock'&&e.id==='crystal'));
  assert.equal(P.padVisible(st,'synth'),true,'the next pad appears');assert.equal(P.zoneActive(st,'node:crystal'),true);
  // streaming takes a moment, not one tick, even for the big prices
  for(const u of P.UNLOCK_IDS){const per=Math.max(1,Math.ceil(P.UNLOCKS[u].price/12));assert.ok(P.UNLOCKS[u].price/per>=6&&P.UNLOCKS[u].price/per<=13,u);}
  // Station unlocks open the recipe and say so; pack unlocks raise the cap.
  st.wallet=500;place(st,'unlock:synth');steps(pz,st,30);
  assert.equal(st.unlocked.synth,true);assert.ok(st.fx.some(e=>e.type==='recipe'&&e.station==='synth'&&e.item==='cell'));
  place(st,'unlock:pack1');steps(pz,st,30);assert.equal(st.cap,P.CARRY[1]);
}

// ---- workers ---------------------------------------------------------------------------------------------------------
{
  const {pz,st}=fresh();
  Object.assign(st.unlocked,{crystal:true,synth:true});st.wallet=100;
  place(st,'unlock:oreHauler');steps(pz,st,30);
  assert.equal(st.workers.length,1);assert.equal(st.workers[0].job,'ore');
  st.player.x=30*U;st.player.y=22*U; // far from everything
  steps(pz,st,600);
  assert.ok(st.stations.refinery.made>=5,`the ore hauler keeps the refinery busy (${st.stations.refinery.made} plates)`);
  assert.equal(st.player.stack.length,0,'without you touching anything');
  assert.ok(st.fx.some(e=>e.type==='load'&&e.who==='oreHauler'));
  // The workshop courier carries plates and cells into the workshop: gear kits appear on their own.
  const b=fresh();Object.assign(b.st.unlocked,{crystal:true,synth:true,workshop:true,oreHauler:true,crystalHauler:true});b.st.wallet=200;
  b.st.stations.refinery.out=6;b.st.stations.synth.out=6;
  place(b.st,'unlock:courier');steps(b.pz,b.st,30);b.st.player.x=30*U;b.st.player.y=22*U;
  assert.equal(b.st.workers[0].job,'courier');steps(b.pz,b.st,500);
  assert.ok(b.st.stations.workshop.made>=2,`the courier feeds the workshop (${b.st.stations.workshop.made} gear kits)`);
  for(const j of Object.values(P.JOBS))for(const s of j.stops)assert.ok(P.ZONE[s.z],s.z);
}

// ---- recipes and the ladder ------------------------------------------------------------------------------------------
{
  const tiers=Object.fromEntries(P.CRAFTED.map(i=>[i,P.ITEMS[i].tier]));
  assert.deepEqual([...new Set(Object.values(tiers))].sort(),[1,2,3],'three tiers');
  assert.equal(P.CRAFTED.length,6);assert.equal(P.RAW.length,3);
  for(const s of P.STATION_IDS){const R=P.STATIONS[s];for(const k of Object.keys(R.in))assert.ok(P.ITEMS[k].tier<P.ITEMS[R.out].tier,`${s} builds up`);}
  for(const i of P.CRAFTED)assert.ok(P.ITEMS[i].value>(P.ITEMS[i].tier-1)*15,'higher tiers pay more');
  assert.ok(P.ITEMS.relay.value>=3*P.ITEMS.gear.value);
  // Requests only ask for what you can make now, and climb as stations open.
  const pz=P.generate(5,'normal'),st=P.create(pz),tally={1:0,2:0,3:0};
  for(let k=0;k<20;k++){st.lts[0].idx=k;assert.equal(P.rollRequest(pz,st,0).item,'plate');}
  Object.assign(st.unlocked,{crystal:true,synth:true,workshop:true});
  for(let k=0;k<60;k++){st.lts[0].idx=k;const q=P.rollRequest(pz,st,0);assert.ok(['plate','cell','gear'].includes(q.item));if(q.item==='gear')tally[2]++;}
  assert.ok(tally[2]>15,'a new tier-2 recipe shows up in requests');
  Object.assign(st.unlocked,{press:true,salvage:true,armoury:true,loom:true});
  for(let k=0;k<60;k++){st.lts[1].idx=k;const q=P.rollRequest(pz,st,1);tally[P.ITEMS[q.item].tier]++;
    assert.ok(q.reward===q.qty*P.ITEMS[q.item].value&&q.duration>0);}
  assert.ok(tally[3]>20,'with the whole ladder open, top-tier requests are common');
  // In planner shifts later requests are richer than the early ones.
  for(const d of ids){
    let early=0,late=0;
    for(let seed=1;seed<=10;seed++){const z=P.generate(seed,d),s=P.run(z,z.plan).state,n=s.reqs.length,t=r=>P.ITEMS[r.item].tier;
      early+=s.reqs.slice(0,Math.floor(n/3)).reduce((a,r)=>a+t(r),0)/Math.floor(n/3);late+=s.reqs.slice(-Math.floor(n/3)).reduce((a,r)=>a+t(r),0)/Math.floor(n/3);}
    assert.ok(late>early+0.5,`${d}: requests escalate (${(early/10).toFixed(2)} → ${(late/10).toFixed(2)})`);
  }
}

// ---- display data: every node and station says what it gives and takes ---------------------------------------------
{
  const icons=new Set(P.ITEM_IDS.map(i=>P.ITEMS[i].icon)),colors=new Set(P.ITEM_IDS.map(i=>P.ITEMS[i].color));
  assert.equal(icons.size,P.ITEM_IDS.length,'one icon per item');assert.equal(colors.size,P.ITEM_IDS.length,'one colour per item');
  const {pz,st}=fresh();st.stations.workshop.in.plate=1;
  const D=P.display(st);
  assert.equal(D.nodes.length,P.NODE_IDS.length);assert.equal(D.stations.length,P.STATION_IDS.length);
  for(const n of D.nodes){assert.ok(P.ITEMS[n.gives]);assert.equal(n.icon,P.ITEMS[n.gives].icon);assert.equal(n.color,P.ITEMS[n.gives].color);assert.ok(n.name&&P.ZONE[n.zone]);}
  assert.equal(D.nodes.find(n=>n.id==='ore').open,true);assert.equal(D.nodes.find(n=>n.id==='crystal').open,false);
  for(const s of D.stations){
    assert.ok(s.takes.length>=1&&s.gives.item&&s.gives.icon===P.ITEMS[s.gives.item].icon,s.id);
    for(const t of s.takes){assert.ok(t.per>=1&&t.icon===P.ITEMS[t.item].icon);assert.ok(t.batch<=t.per);}
    assert.ok(P.ZONE[s.input]&&P.ZONE[s.output]);
  }
  const w=D.stations.find(s=>s.id==='workshop');assert.deepEqual(w.takes.map(t=>[t.item,t.loaded,t.per]),[['plate',1,1],['cell',0,1]]);
  assert.deepEqual(D.pads.map(p=>p.id),['crystal','oreHauler'],'the crystal bloom and the early ore hauler show at the start');
  assert.equal(D.pads[0].gives,'crystal');assert.equal(D.pads[0].left,P.UNLOCKS.crystal.price);
  Object.assign(st.unlocked,{crystal:true});const pad=P.display(st).pads.find(p=>p.id==='synth');
  assert.equal(pad.recipe.gives.item,'cell');assert.deepEqual(pad.recipe.takes.map(t=>t.item),['crystal']);
  void pz;
}

// ---- chain highlight -------------------------------------------------------------------------------------------------
{
  assert.deepEqual(P.sources('ore'),['node:ore']);assert.deepEqual(P.sources('cell'),['out:synth']);
  assert.deepEqual(P.uses('cell').sort(),['dispatch','in:press','in:workshop']);
  assert.deepEqual(P.uses('parts'),['in:armoury']);
  assert.deepEqual(P.chain('plate').zones,['node:ore','in:refinery','out:refinery','dispatch']);
  const c=P.chain('relay');
  assert.deepEqual(c.stations.slice().sort(),['loom','press','refinery','synth','workshop']);
  assert.deepEqual(c.nodes.sort(),['crystal','ore']);assert.equal(c.zones[c.zones.length-1],'dispatch');
  for(const s of c.steps)for(const k of Object.keys(s.in))assert.ok(c.items.indexOf(k)<c.items.indexOf(s.out),'inputs come before outputs');
  for(const i of P.CRAFTED){const ch=P.chain(i);for(const z of ch.zones)assert.ok(P.ZONE[z],z);assert.equal(ch.steps[ch.steps.length-1].out,i);}
  assert.equal(P.unlockFor('ore'),null);assert.equal(P.unlockFor('core'),'press');assert.equal(P.unlockFor('parts'),'salvage');
}

// ---- par, replay and determinism -------------------------------------------------------------------------------------
const report={};
for(const d of ids){
  assert.deepEqual(P.generate(7,d),P.generate(7,d),'same seed, same shift');
  assert.notDeepEqual(P.generate(7,d).lts.map(l=>l.rolls),P.generate(8,d).lts.map(l=>l.rolls));
  const rz=P.generate(7,d,{relaxed:true});assert.equal(rz.relaxed,true);assert.equal(rz.par,P.planner(rz).score,'relaxed par is its own');
  const st0=P.create(rz),q=P.rollRequest(rz,st0,0),q2=P.rollRequest(P.generate(7,d),P.create(P.generate(7,d)),0);
  assert.equal(q.item,q2.item);assert.ok(q.duration>q2.duration,'relaxed timers are longer');
  {const pz=P.generate(11,d);assert.deepEqual(P.run(pz,pz.plan).state,P.run(pz,pz.plan).state,'two replays, identical states');}
  let par=0,auto=0,t2=0,t3=0;
  for(let seed=1;seed<=SEEDS;seed++){
    const pz=P.generate(seed,d);
    assert.ok(pz.plan.every(c=>c.cmd.type==='move'&&Number.isInteger(c.cmd.x)&&Number.isInteger(c.cmd.y)),'the planner only changes heading');
    const rep=P.run(pz,pz.plan);assert.deepEqual(rep.rejected,[]);
    const ev=P.evaluate(pz,rep.state);
    assert.equal(ev.score,pz.par,`${d}/${seed} replay equals par`);assert.equal(ev.filled,pz.parFilled);
    assert.equal(pz.perfectAt,Math.ceil(pz.par*0.85));assert.equal(P.tier(pz,ev),'perfect');
    assert.equal(P.tier(pz,{...ev,score:pz.perfectAt-1}),'good');assert.equal(P.tier(pz,{...ev,score:pz.goodAt-1}),'partial');
    assert.equal(P.tier(pz,{...ev,score:0,filled:0}),'failed');
    assert.ok(ev.unlocks>=8,`${d}/${seed} the planner climbs the ladder (${ev.unlocks})`);
    if(ev.topTier>=2)t2++;if(ev.topTier>=3)t3++;
    const a=P.auto(pz).evaluation;assert.ok(a.score<pz.perfectAt,`${d}/${seed} Skip ${a.score} stays under Perfect ${pz.perfectAt}`);
    const h=P.hint(pz,P.create(pz));assert.ok(h.text&&h.target,'an opening hint with a place to walk to');
    par+=pz.par;auto+=a.score;
  }
  assert.equal(t2,SEEDS,`${d}: tier-2 items are delivered in every planner shift`);
  if(d!=='easy')assert.ok(t3>=SEEDS*0.6,`${d}: top-tier items in most planner shifts (${t3})`);
  report[d]={par:Math.round(par/SEEDS),auto:Math.round(auto/par*100)+'%',tier3:Math.round(t3/SEEDS*100)+'%'};
}
// Hints name the chain step; an idle shift explains the gap.
{
  const pz=P.generate(3,'normal'),mid=P.run(pz,pz.plan,{until:1200}).state,h=P.hint(pz,mid);
  assert.match(h.text,/walk|Wait|Stand|Pick up|Save/);
  const st=P.create(pz);Object.assign(st.unlocked,{crystal:true,synth:true,workshop:true,press:true});
  st.lts[0].req={lt:0,idx:0,item:'core',qty:1,got:0,reward:26,duration:500,openedAt:0,deadline:500,status:'open'};st.reqs.push(st.lts[0].req);
  st.lts[1].readyAt=st.lts[2].readyAt=9999;st.player.stack=[];
  const ch=P.hint(pz,st);assert.match(ch.text,/Burst core needs|Aether cell needs|walk to the/);
  const near=P.nearMiss(pz,[]);assert.match(near,/short of Perfect/);assert.match(near,/planner unlocked/);
  assert.equal(P.nearMiss(pz,pz.plan),'');
  assert.match(P.output(pz,P.evaluate(pz,P.run(pz,pz.plan).state)),/to the lieutenants' fronts/);
}
console.log(`PASS supply run model: movement, zones, coins + unlock pads, workers, ladder requests, display data, chain highlight; par replays exactly for ${SEEDS} seeds × ${ids.length} difficulties ${JSON.stringify(report)} (${((Date.now()-t0)/1000).toFixed(1)}s)`);
