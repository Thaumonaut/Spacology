'use strict';
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const {createAtlas}=require('../../prototypes/labs/microvoxel-world/hex-atlas.js');
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',URL=BASE+'/prototypes/microvoxel-world.html?seed=2718&coopNet=local';
const ready=p=>p.waitForFunction(()=>{const s=window.MicroWorldLab?.snapshot();return s&&!s.failed&&s.visible>0&&s.ready===s.visible&&!s.pending;},null,{timeout:90000});
const coop=p=>p.evaluate(()=>MicroWorldLab.coop.snapshot());
const until=(p,fn,arg)=>p.waitForFunction(fn,arg,{timeout:10000});
// Selects a hex through the map itself, so the inspector buttons are exercised as a player would.
async function select(p,h){const pt=await p.evaluate(h=>MicroWorldLab.project(h.x,h.height,h.z),h),r=await p.locator('#world').boundingBox();await p.mouse.click(r.x+pt.x,r.y+pt.y);
  await until(p,()=>!document.getElementById('inspection').hidden);return p.locator('#hexSummary').innerText();}
async function phase(p,want){for(let i=0;i<3&&(await coop(p)).phase!==want;i++){const {phase:ph,view:{day:d}}=await coop(p);await p.locator('#coopReady').click();await until(p,([ph,d])=>{const s=MicroWorldLab.coop.snapshot();return s.phase!==ph||s.view.day!==d;},[ph,d]);}assert.equal((await coop(p)).phase,want);}
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(URL);await ready(p);
  assert.equal((await p.evaluate(()=>MicroWorldLab.snapshot())).revision,'micro-wilds-18');
  await p.locator('[data-role="explore"]').click();await p.locator('#coopSolo').click();await until(p,()=>MicroWorldLab.coop.snapshot().role==='explore');
  const W=M.createWorld(2718,.25,'infinite'),A=createAtlas(W),hd=(a,b)=>(Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.q+a.r-b.q-b.r))/2;let wall=null;
  for(let n=1;n<=6&&!wall;n++)for(let dq=-n;dq<=n&&!wall;dq++)for(let dr=Math.max(-n,-dq-n);dr<=Math.min(n,-dq+n);dr++){const h=A.summary(A.rootHex.q+dq,A.rootHex.r+dr);if(h.barrier&&hd(h,A.rootHex)===n){wall=h;break;}}
  const edges=async()=>(await coop(p)).view.hexes.filter(h=>h.state==='barrier').sort((a,b)=>a.key.localeCompare(b.key));
  for(let d=0;!(await edges()).length&&d<8;d++){for(const h of (await coop(p)).view.hexes.filter(h=>h.state==='frontier'||h.state==='hinted').sort((x,y)=>hd(x,wall)-hd(y,wall)||x.key.localeCompare(y.key)).slice(0,3))await p.evaluate(k=>MicroWorldLab.coop.act({kind:'toggle',key:k}),h.key);await phase(p,'dusk');await phase(p,'night');}
  let v;const edge=(await edges())[0];assert.ok(edge,'surveying reaches a barrier edge');
  await p.locator('#coopFold').click();await p.locator('text=Surroundings').click();await ready(p);await p.locator('#coopFold').click();
  assert.match(await select(p,edge),/impassable (cliff|gorge).*rock unknown/);assert.equal(await p.locator('#hexTask').innerText(),'Scout edge (cost 1)');assert.ok(await p.locator('#hexTask2').isHidden());
  await p.locator('#hexTask').click();v=(await coop(p)).view;assert.deepEqual(v.plan,[edge.key]);
  await phase(p,'day');assert.ok((await coop(p)).view.crew.paths[edge.key],'crew walk a passable path to the edge');
  await phase(p,'dusk');v=(await coop(p)).view;assert.equal(v.report.scouted,1);assert.equal(v.hexes.find(h=>h.key===edge.key).state,'scouted');assert.match(await p.locator('#coopReport').innerText(),/1 edge\(s\) scouted/);
  console.log('PASS Exploration scouts a hatched barrier edge from the inspector instead of surveying through it');
  await phase(p,'night');await p.evaluate(()=>MicroWorldLab.coop.claim('logistics'));await until(p,()=>MicroWorldLab.coop.snapshot().role==='logistics');
  assert.match(await select(p,edge),/rock unrated/);
  if(edge.terrain==='cliff'){assert.match(await p.locator('#hexTask').innerText(),/Build switchback ramp \(6 pts\)/);assert.equal(await p.locator('#hexTask2').innerText(),'Cutting needs sound rock');assert.ok(await p.locator('#hexTask2').isDisabled());}
  else assert.match(await p.locator('#hexTask').innerText(),/Build bridge \(8 pts\)/);
  await p.locator('#hexTask').click();v=(await coop(p)).view;assert.equal(v.crossing.key,edge.key);assert.match(await p.locator('#hexTask').innerText(),/^Cancel /);assert.match(await p.locator('#coopBrief').innerText(),/0\/\d pts/);
  let days=0;while(!(await coop(p)).view.crossings.length&&days++<8){await phase(p,'dusk');if(!(await coop(p)).view.crossings.length)await phase(p,'night');}
  assert.ok(days>1,'the crossing takes several days');v=(await coop(p)).view;assert.ok(v.crossings.some(c=>c.key===edge.key));
  assert.match(await select(p,edge),/(switchback ramp|bridge|cutting) built · travel cost/);assert.ok(await p.locator('#hexTask2').isHidden());
  await p.screenshot({path:'/tmp/spacology-crossing.png'});
  await p.evaluate(()=>MicroWorldLab.coop.claim('explore'));await until(p,()=>MicroWorldLab.coop.snapshot().role==='explore');
  assert.equal((await coop(p)).view.hexes.find(h=>h.key===edge.key).state,'crossed');
  assert.deepEqual(errors,[]);console.log(`PASS Logistics engineers the scouted crossing over ${days} days; Exploration can survey beyond it`);
}catch(e){for(const pg of browser.contexts().flatMap(c=>c.pages()))await pg.screenshot({path:"/tmp/spacology-crossing-fail.png"}).catch(()=>{});console.error(JSON.stringify((await browser.contexts()[0].pages()[0].evaluate(()=>MicroWorldLab.coop.snapshot())),null,0).slice(0,1500));throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
