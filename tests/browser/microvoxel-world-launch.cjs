'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';
const ready=p=>p.waitForFunction(()=>{const s=window.MicroWorldLab?.snapshot();return s&&!s.failed&&s.visible>0&&s.ready===s.visible&&!s.pending;},null,{timeout:90000});
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'}),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'spacology-voxel-launch-'));
try{
  const source=await browser.newPage();await source.goto(pathToFileURL(path.resolve(__dirname,'../../prototypes/microvoxel-world.html')).href);
  await source.waitForFunction(()=>window.MicroWorldLab?.snapshot().failed);assert.match(await source.locator('#notice').innerText(),/Local source launch blocked.*npm run serve.*packaged standalone HTML/);await source.close();
  console.log('PASS source file launch explains separate worker restriction and safe alternatives');
  const file=path.join(temporary,'world.html');execFileSync(process.execPath,[path.resolve(__dirname,'../../tools/package-microvoxel.cjs'),file]);
  const blocked=await browser.newPage();await blocked.addInitScript(()=>{window.Worker=class{constructor(){throw new DOMException('Embedded worker blocked','SecurityError');}};});await blocked.goto(pathToFileURL(file).href);await blocked.waitForFunction(()=>window.MicroWorldLab?.snapshot().failed);assert.equal(await blocked.locator('#notice').innerText(),'Embedded worker blocked','packaged worker errors are not misidentified as a separate source script');await blocked.close();
  const context=await browser.newContext({viewport:{width:390,height:844}}),host=await context.newPage(),errors=[];
  host.on('pageerror',e=>errors.push(e.message));host.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await host.route('**/__world-embed',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0"><iframe id="lab" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe>'}));
  await host.goto(BASE+'/__world-embed');await host.locator('#lab').evaluate((iframe,html)=>{iframe.src=URL.createObjectURL(new Blob([html],{type:'text/html'}));},fs.readFileSync(file,'utf8'));
  const frame=host.frames().find(f=>f.parentFrame());await ready(frame);assert.equal(await frame.evaluate(()=>self.origin),'null','embedded world has an opaque sandbox origin');assert.equal(await frame.evaluate(()=>MicroWorldLab.snapshot().extent),'infinite','streamed world is the default');
  for(let i=0;i<2;i++)for(const [opener,dialog,close] of [['info','notes','Close field notes'],['metrics','performance','Close performance']]){
    await frame.locator('#'+opener).click();assert.ok(await frame.locator('#'+dialog).isVisible());await frame.getByRole('button',{name:close,exact:true}).click();await frame.locator('#'+dialog).waitFor({state:'hidden',timeout:2000});
  }
  await frame.locator('#info').click();await frame.locator('#worldSize').selectOption('infinite');await frame.locator('#seed').fill('');await frame.locator('#seedForm button').click();assert.ok(await frame.locator('#notes').isVisible(),'required seed validation still applies');
  await frame.locator('#seed').fill('39');await frame.locator('#seed').press('Enter');await frame.locator('#notes').waitFor({state:'hidden'});await ready(frame);assert.equal(await frame.evaluate(()=>MicroWorldLab.snapshot().seed),39);assert.equal(await frame.evaluate(()=>MicroWorldLab.snapshot().extent),'infinite');
  await frame.locator('#info').click();await frame.locator('#chunkX').fill('-3');await frame.locator('#chunkZ').fill('4');await frame.locator('#travelForm button').click();await frame.locator('#notes').waitFor({state:'hidden'});await ready(frame);assert.deepEqual(await frame.evaluate(()=>MicroWorldLab.snapshot().position),{cx:-3,cz:4,x:4,z:4});
  await frame.locator('#info').click();await frame.locator('#chunkX').fill('7');await frame.locator('#chunkZ').press('Enter');await frame.locator('#notes').waitFor({state:'hidden'});await ready(frame);assert.equal(await frame.evaluate(()=>MicroWorldLab.snapshot().position.cx),7);
  await frame.locator('#metrics').click();await frame.locator('#performance').press('Escape');await frame.locator('#performance').waitFor({state:'hidden'});assert.deepEqual(errors,[],'no blocked form submissions or history errors in the restricted preview');
  await context.close();console.log('PASS restricted preview: repeated modal dismissal, validation, Enter, Generate and Travel without allow-forms or allow-same-origin');
}finally{await browser.close();fs.rmSync(temporary,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exit(1);});
