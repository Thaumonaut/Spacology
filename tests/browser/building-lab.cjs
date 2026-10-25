'use strict';
// Building lab: the page builds one seeded building of every house typology headlessly with no errors, every
// furnished room stays walkable, cutaways and camera presets draw, and screenshots land in
// artifacts/building-generator/: a three-quarter view and a ground-floor cutaway per typology, plus contact sheets of
// ground-floor plans across many seeds (the variety at a glance).
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../../prototypes/labs/building-lab/plan.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',OUT=path.resolve(__dirname,'../../artifacts/building-generator');
const SHOTS=process.env.SPACOLOGY_BUILDING_SHOTS!=='0';
// One case per typology: the first seed whose plot suits it.
const WANT=[['side','shophouse','machiya','terrace'],['wing','workshop','fairytale','corner'],['centre','home','harbour','terrace'],['stairhall','home','fairytale','detached'],
  ['cross','shophouse','spire','corner'],['cottage','home','fairytale','detached'],['courtyard','inn','spire','detached']];
const CASES=WANT.map(([typology,type,style,context])=>{const Y=P.TYPOLOGIES[typology];for(let seed=1;seed<200;seed++){const p=P.makePlot(seed,{type,context});if(p.w>=Y.minW&&!(Y.straight&&p.storeys>2))return {seed,type,style,context,typology};}throw new Error('no seed for '+typology);});
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const ready=()=>page.waitForFunction(()=>window.BuildingLab?.snapshot().ready,null,{timeout:60000});
  if(SHOTS){fs.mkdirSync(OUT,{recursive:true});for(const f of fs.readdirSync(OUT))if(f.endsWith('.png'))fs.rmSync(path.join(OUT,f));}
  const metrics=[];
  for(const c of CASES){
    await page.goto(`${BASE}/prototypes/building-lab.html?seed=${c.seed}&type=${c.type}&style=${c.style}&context=${c.context}&typology=${c.typology}`);await ready();
    const s=await page.evaluate(()=>BuildingLab.snapshot());
    assert.deepEqual(s.errors,[],'no build errors');assert.equal(s.typology,c.typology);assert.equal(s.type,c.type);
    assert.ok(s.quads>5000,'the building meshes');assert.ok(s.furniture>=15,`furnished (${s.furniture} pieces)`);assert.equal(s.unreachable,0,'every furnished room keeps its doors connected');
    const name=`${c.typology}-${c.type}-${c.style}`;
    for(const [view,visible,label] of [['corner',s.storeys+1,'corner'],['street',s.storeys+1,'street'],['above',1,'ground'],['above',2,'upper']]){
      await page.evaluate(([v,k])=>{BuildingLab.setVisible(k);BuildingLab.setView(v);},[view,visible]);
      const ms=[];for(let i=0;i<3;i++)ms.push(await page.evaluate(()=>BuildingLab.frame()));
      if(SHOTS&&label!=='street')await page.locator('#view').screenshot({path:path.join(OUT,`${name}-${label}.png`)});
      metrics.push({case:name,view:label,frameMs:+Math.min(...ms).toFixed(2)});}
    if(SHOTS){await page.evaluate(()=>BuildingLab.setVisible(1));await page.locator('#plan').screenshot({path:path.join(OUT,`${name}-plan-ground.png`)});}
    // Close-ups (3-6 m) of the street door, an eave and a roof corner: regressions in detail show up here first.
    if(SHOTS&&['side','centre','courtyard','wing'].includes(c.typology)){const info=await page.evaluate(()=>BuildingLab.camera({})),[X,,Z]=info.dims,L=info.levels,fz=Z*.17,top=L[s.storeys];
      for(const [label,cam] of [['door',{yaw:.25,pitch:.05,dist:4,target:[X*.5,L[0]+1.3,fz]}],['eave',{yaw:-.6,pitch:-.02,dist:5,target:[X*.25,top-.2,fz]}],['roof-corner',{yaw:-.8,pitch:.35,dist:6,target:[X*.2,top+.5,fz]}]]){
        await page.evaluate(([cm,v])=>{BuildingLab.setVisible(v);BuildingLab.camera(cm);BuildingLab.frame();},[cam,s.storeys+1]);await page.locator('#view').screenshot({path:path.join(OUT,`${name}-close-${label}.png`)});}}
    metrics.push({case:name,seed:s.seed,dims:s.dims,quads:s.quads,furniture:s.furniture,timings:s.timings});
    console.log(`PASS ${name}: ${s.quads} quads, ${s.furniture} kit pieces, plan ${s.timings.planMs} ms, voxels ${s.timings.voxelMs} ms, mesh ${s.timings.meshMs} ms`);
  }
  // Contact sheets: ground floors of 16 seeds per type, plot and plan chosen freely.
  for(const type of Object.keys(P.TYPES)){const url=await page.evaluate(([t])=>BuildingLab.planSheet(Array.from({length:16},(_,i)=>i+1),{type:t}),[type]);
    if(SHOTS)fs.writeFileSync(path.join(OUT,`variety-${type}.png`),Buffer.from(url.split(',')[1],'base64'));}
  // Facade contact sheets: the street fronts of 8 seeds per style (type, plan and look chosen freely).
  if(SHOTS)for(const style of Object.keys(P.STYLES)){const tiles=[];
    for(let seed=1;seed<=8;seed++){await page.evaluate(([sd,st])=>BuildingLab.build({seed:sd,style:st,type:'',context:'',typology:''}),[seed,style]);
      await page.waitForFunction(sd=>BuildingLab.snapshot().ready&&BuildingLab.snapshot().seed===sd,seed,{timeout:60000});
      tiles.push(await page.evaluate(()=>{const i=BuildingLab.camera({}),[X,,Z]=i.dims,L=i.levels,s=BuildingLab.snapshot();BuildingLab.setVisible(9);
        BuildingLab.camera({yaw:.3,pitch:.12,dist:Math.max(14,X*1.15),target:[X/2,L[Math.min(2,s.storeys)]*.75,Z*.3]});BuildingLab.frame();return [`${s.seed} · ${s.type} · ${s.typology}`,document.getElementById('view').toDataURL('image/png')];}));}
    const sheet=await page.evaluate(tiles=>new Promise(res=>{const W=420,H=280,cols=4,c=document.createElement('canvas');c.width=cols*W;c.height=Math.ceil(tiles.length/cols)*(H+20);const g=c.getContext('2d');g.fillStyle='#f3ecdc';g.fillRect(0,0,c.width,c.height);let n=0;
      tiles.forEach(([label,u],i)=>{const im=new Image();im.onload=()=>{const x=(i%cols)*W,y=Math.floor(i/cols)*(H+20);g.drawImage(im,x,y+20,W,H);g.fillStyle='#2b241d';g.font='600 13px system-ui';g.fillText(label,x+6,y+15);if(++n===tiles.length)res(c.toDataURL('image/png'));};im.src=u;});}),tiles);
    fs.writeFileSync(path.join(OUT,`facades-${style}.png`),Buffer.from(sheet.split(',')[1],'base64'));}
  await page.locator('#seed').fill('42');await page.locator('#typology').selectOption('');await page.locator('#build').click();
  await page.waitForFunction(()=>BuildingLab.snapshot().ready&&BuildingLab.snapshot().seed===42,null,{timeout:60000});
  assert.deepEqual(errors,[],'no page errors');
  if(SHOTS)fs.writeFileSync(path.join(OUT,'metrics.json'),JSON.stringify({note:'headless Chromium (software GL); CPU submit time, not GPU time',metrics},null,1)+'\n');
  console.log('PASS building lab: every typology builds, cutaways, contact sheets and a form rebuild with no page errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
