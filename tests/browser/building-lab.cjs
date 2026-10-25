'use strict';
// Building lab: the page builds a seeded building headlessly with no errors, every furnished room stays walkable,
// floor cutaways and camera presets draw, and a fixed set of screenshots lands in artifacts/building-generator/.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',OUT=path.resolve(__dirname,'../../artifacts/building-generator');
const SHOTS=process.env.SPACOLOGY_BUILDING_SHOTS!=='0';
const CASES=[
  {seed:1,type:'shophouse',style:'machiya',context:'terrace'},
  {seed:7,type:'home',style:'fairytale',context:'detached'},
  {seed:6,type:'inn',style:'harbour',context:'corner'},
  {seed:3,type:'workshop',style:'spire',context:'terrace'}
];
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const ready=()=>page.waitForFunction(()=>window.BuildingLab?.snapshot().ready,null,{timeout:60000});
  if(SHOTS)fs.mkdirSync(OUT,{recursive:true});
  const metrics=[];
  for(const c of CASES){
    await page.goto(`${BASE}/prototypes/building-lab.html?seed=${c.seed}&type=${c.type}&style=${c.style}&context=${c.context}`);await ready();
    const s=await page.evaluate(()=>BuildingLab.snapshot());
    assert.deepEqual(s.errors,[],'no build errors');assert.equal(s.type,c.type);assert.equal(s.style,c.style);
    assert.ok(s.quads>5000,'the building meshes');assert.ok(s.furniture>=15,`furnished (${s.furniture} pieces)`);assert.equal(s.unreachable,0,'every furnished room keeps its doors connected');
    const name=`${c.type}-${c.style}`;
    for(const [view,visible] of [['corner',s.storeys+1],['street',s.storeys+1],['back',s.storeys+1],['above',1],['above',2]]){
      await page.evaluate(([v,k])=>{BuildingLab.setVisible(k);BuildingLab.setView(v);},[view,visible]);
      const ms=[];for(let i=0;i<5;i++)ms.push(await page.evaluate(()=>BuildingLab.frame()));
      if(SHOTS)await page.locator('#view').screenshot({path:path.join(OUT,`${name}-${view}${visible<=s.storeys?'-floor'+visible:''}.png`)});
      metrics.push({case:name,view,visible,frameMs:+Math.min(...ms).toFixed(2)});}
    if(SHOTS)await page.locator('#plan').screenshot({path:path.join(OUT,`${name}-plan-ground.png`)});
    metrics.push({case:name,seed:s.seed,dims:s.dims,quads:s.quads,furniture:s.furniture,timings:s.timings});
    console.log(`PASS ${name}: ${s.quads} quads, ${s.furniture} kit pieces, plan ${s.timings.planMs} ms, voxels ${s.timings.voxelMs} ms, mesh ${s.timings.meshMs} ms`);
  }
  // Rebuilding with a new seed from the form replaces the building cleanly.
  await page.locator('#seed').fill('42');await page.locator('#build').click();await page.waitForFunction(()=>BuildingLab.snapshot().ready&&BuildingLab.snapshot().seed===42,null,{timeout:60000});
  assert.deepEqual(errors,[],'no page errors');
  if(SHOTS)fs.writeFileSync(path.join(OUT,'metrics.json'),JSON.stringify({note:'headless Chromium (software GL); CPU submit time, not GPU time',metrics},null,1)+'\n');
  console.log('PASS building lab: form rebuild, cutaways and camera presets with no page errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
