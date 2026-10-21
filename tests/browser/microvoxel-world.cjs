'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',URL=BASE+'/prototypes/microvoxel-world.html?seed=2718';
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const ready=p=>p.waitForFunction(()=>{const s=window.MicroWorldLab?.snapshot();return s&&!s.failed&&s.ready>0&&s.ready===s.visible&&!s.pending;},null,{timeout:60000});
const state=p=>p.evaluate(()=>MicroWorldLab.snapshot());
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:850}}),p=await context.newPage(),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>requests.push(r.url()));
  await p.goto(URL);await ready(p);const original=(await state(p)).deposit;
  assert.equal((await state(p)).step,4);await p.locator('#rootMarker').click();assert.match(await p.locator('#inspectBody').innerText(),/basalt.*fault/);assert.match(await p.locator('#inspectPosition').innerText(),/ore:root/);await p.locator('#closeInspection').click();
  await p.locator('#close').click();await ready(p);assert.equal((await state(p)).step,1);assert.deepEqual((await state(p)).deposit,original);
  // Check a real pixel is drawn (not merely a successfully allocated WebGL canvas).
  const pixel=await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const gl=document.getElementById('world').getContext('webgl2'),out=new Uint8Array(4);gl.readPixels(gl.drawingBufferWidth/2,gl.drawingBufferHeight/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);resolve([...out]);})));
  assert.ok(pixel[0]>20&&pixel[1]>pixel[0]&&pixel[1]>pixel[2]&&pixel[3]===255,'clearing has rendered green pixels, not an empty canvas');
  const first=(await state(p)).actors;await p.waitForFunction(x=>MicroWorldLab.snapshot().actors[0].x!==x,first[0].x);const moving=await state(p);
  for(const a of moving.actors)assert.equal(a.y,M.createWorld(2718).ground(a.x,a.z),'actor contacts exact voxel ground');
  await p.locator('#pause').click();const stopped=(await state(p)).simTime;await p.waitForFunction(n=>MicroWorldLab.snapshot().frameSamples>n,moving.frameSamples);assert.equal((await state(p)).simTime,stopped);assert.equal(await p.locator('#pause').getAttribute('aria-pressed'),'true');
  // Ground inspection agrees with projection at a flat, uncovered point in the clearing.
  const point=await p.evaluate(()=>MicroWorldLab.project(49,8,58)),rect=await p.locator('#world').boundingBox();
  await p.mouse.click(rect.x+point.x,rect.y+point.y);assert.match(await p.locator('#inspectBody').innerText(),/Surface 8.00 m/);await p.locator('#closeInspection').click();
  await p.locator('#world').focus();const x=(await state(p)).camera.x;await p.keyboard.press('ArrowRight');assert.ok((await state(p)).camera.x>x);await p.keyboard.press('r');await ready(p);assert.equal((await state(p)).camera.span,32);
  await p.locator('#economy').click();await ready(p);assert.equal((await state(p)).step,2);assert.deepEqual((await state(p)).deposit,original);await p.locator('#economy').click();await ready(p);
  const before=(await state(p)).camera;await p.mouse.move(rect.x+rect.width*.65,rect.y+rect.height*.45);await p.mouse.down();await p.mouse.move(rect.x+rect.width*.65+80,rect.y+rect.height*.45+30,{steps:5});await p.mouse.up();await ready(p);assert.notDeepEqual((await state(p)).camera,before,'drag pans');
  await p.locator('#wide').click();await ready(p);assert.equal((await state(p)).step,4);await p.locator('#close').click();await ready(p);
  const snapshot=await state(p);assert.ok(snapshot.meshCacheBytes<=snapshot.meshCacheLimit&&snapshot.meshCacheEntries<=320);assert.ok(snapshot.voxelCacheBytes<=4*1024*1024&&snapshot.voxelCacheEntries<=128);assert.ok(snapshot.cacheHits>0,'warm data reused');
  await p.locator('#metrics').click();assert.equal(await p.locator('#performance').isVisible(),true);assert.match(await p.locator('#metricList').innerText(),/Not measured/);
  const download=p.waitForEvent('download');await p.locator('#export').click();const saved=await download;const exportPath=await saved.path(),data=JSON.parse(fs.readFileSync(exportPath,'utf8'));assert.equal(data.worldId,snapshot.worldId);assert.equal(data.deposit.id,original.id);await p.keyboard.press('Escape');
  // Reduced motion suppresses decorative animation without changing data; pause remains explicit.
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal((await state(p)).reducedMotion,true);
  await p.locator('#info').click();await p.locator('#seed').fill('39');await p.locator('#seedForm button').click();await ready(p);assert.equal((await state(p)).seed,39);assert.notEqual((await state(p)).deposit.id,original.id);assert.match(p.url(),/seed=39/);
  const changed=(await state(p)).deposit;await p.reload();await ready(p);assert.deepEqual((await state(p)).deposit,changed,'reload retains coordinate identity');
  // Request changes while the worker is in flight; obsolete meshes may not populate a new seed.
  await p.locator('#info').click();await p.locator('#seed').fill('0');await p.locator('#seedForm button').click();await p.locator('#info').click();await p.locator('#seed').fill('2718');await p.locator('#seedForm button').click();await ready(p);assert.deepEqual((await state(p)).deposit,original);
  for(const [width,height] of [[390,844],[320,568],[768,1024],[844,390]]){
    await p.setViewportSize({width,height});await p.locator('#close').click();await ready(p);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),'fixed-screen layout');
    const canvas=await p.locator('#world').boundingBox();assert.ok(canvas.height>=100&&canvas.width<=width);
    for(const id of ['wide','close','zoomIn','zoomOut','pause','economy','metrics']){const r=await p.locator('#'+id).boundingBox();assert.ok(r.width>=44&&r.height>=44&&r.y+r.height<=height,'visible touch targets');}
    await p.locator('#metrics').click();assert.ok(await p.locator('#performance').evaluate(el=>el.scrollWidth<=el.clientWidth),'dialog does not overflow');await p.keyboard.press('Escape');
  }
  assert.ok(requests.every(r=>r.startsWith(BASE)),'no external runtime dependency');assert.deepEqual(errors,[]);
  if(process.env.SPACOLOGY_ARTIFACT_DIR){fs.mkdirSync(process.env.SPACOLOGY_ARTIFACT_DIR,{recursive:true});await p.setViewportSize({width:1280,height:850});await p.locator('#wide').click();await ready(p);await p.locator('#notice').waitFor({state:'hidden'});await p.screenshot({path:path.join(process.env.SPACOLOGY_ARTIFACT_DIR,'microvoxel-wide.png')});await p.locator('#close').click();await ready(p);await p.locator('#notice').waitFor({state:'hidden'});await p.screenshot({path:path.join(process.env.SPACOLOGY_ARTIFACT_DIR,'microvoxel-site.png')});fs.writeFileSync(path.join(process.env.SPACOLOGY_ARTIFACT_DIR,'microvoxel-browser-metrics.json'),JSON.stringify(await state(p),null,2));}
  await context.close();
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'spacology-voxel-'));
  try{
    const file=path.join(temporary,'world.html');execFileSync(process.execPath,[path.resolve(__dirname,'../../tools/package-microvoxel.cjs'),file]);
    const offline=await browser.newContext({offline:true,serviceWorkers:'block'}),copy=await offline.newPage(),copyErrors=[],copyRequests=[];
    copy.on('pageerror',e=>copyErrors.push(e.message));copy.on('request',r=>copyRequests.push(r.url()));
    await copy.goto(pathToFileURL(file).href);await ready(copy);assert.deepEqual((await state(copy)).deposit,original);
    await copy.locator('#close').click();await ready(copy);await copy.locator('#rootMarker').click();assert.match(await copy.locator('#inspectBody').innerText(),/western fault/);
    await copy.locator('#info').click();await copy.locator('#seed').fill('39');await copy.locator('#seedForm button').click();await ready(copy);assert.equal((await state(copy)).seed,39);
    assert.deepEqual(copyErrors,[],'exact single-file copy runs offline');assert.ok(copyRequests.every(r=>!/^https?:/.test(r)),'no network loads from the package');await offline.close();
  }finally{fs.rmSync(temporary,{recursive:true,force:true});}
  // Touch input uses the same pointer map and controls.
  const touch=await browser.newContext({serviceWorkers:'block',hasTouch:true,isMobile:true,viewport:{width:390,height:844}}),phone=await touch.newPage();await phone.goto(URL);await ready(phone);await phone.locator('#close').tap();await ready(phone);await phone.locator('#rootMarker').tap();assert.equal(await phone.locator('#inspection').isVisible(),true);await phone.locator('#closeInspection').tap();await phone.locator('#zoomIn').tap();await ready(phone);assert.ok((await state(phone)).camera.span<32);await touch.close();
  const unsupported=await browser.newContext();await unsupported.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};});const fallback=await unsupported.newPage();await fallback.goto(URL);await fallback.locator('#notice').waitFor();assert.match(await fallback.locator('#notice').innerText(),/WebGL2 is unavailable/);assert.equal(await fallback.locator('#close').isDisabled(),true);assert.ok(await fallback.locator('.brand').isVisible());await unsupported.close();
  const lost=await browser.newPage();await lost.goto(URL);await ready(lost);await lost.evaluate(()=>document.getElementById('world').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await lost.waitForFunction(()=>MicroWorldLab.snapshot().failed);assert.match(await lost.locator('#notice').innerText(),/context lost/);await lost.close();
  console.log('PASS microvoxel browser: rendered world, input/projection, crew/pause, seed/LOD identity, bounded caches, export, responsive/touch, reduced motion, WebGL fallback/context loss; zero runtime errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
