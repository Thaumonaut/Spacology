'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',URL=BASE+'/prototypes/microvoxel-world.html?seed=2718&extent=128';
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const ready=p=>p.waitForFunction(()=>{const s=window.MicroWorldLab?.snapshot();return s&&!s.failed&&s.ready>0&&s.ready===s.visible&&!s.pending&&!s.moving;},null,{timeout:60000});
const state=p=>p.evaluate(()=>MicroWorldLab.snapshot());
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:850}}),p=await context.newPage(),errors=[],requests=[];
  await p.addInitScript(()=>{
    const NativeWorker=window.Worker,replies=[];
    window.__holdVoxelStep=null;
    window.__releaseVoxelMeshes=()=>{window.__holdVoxelStep=null;for(const {worker,data} of replies.splice(0))worker.dispatchEvent(new MessageEvent('message',{data}));};
    window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',event=>{if(window.__holdVoxelStep===event.data.step){event.stopImmediatePropagation();replies.push({worker:this,data:event.data});}});}};
  });
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>requests.push(r.url()));
  await p.goto(URL);await ready(p);const original=(await state(p)).deposit;
  assert.equal((await state(p)).step,4);await p.locator('#rootMarker').click();assert.match(await p.locator('#inspectBody').innerText(),/basalt.*fault/);assert.match(await p.locator('#inspectPosition').innerText(),/ore:root/);await p.locator('#closeInspection').click();
  await p.locator('#close').click();await ready(p);assert.equal((await state(p)).step,1);assert.deepEqual((await state(p)).deposit,original);
  await p.evaluate(()=>window.__holdVoxelStep=2);
  await p.locator('#zoomOut').click();await p.locator('#zoomOut').click();
  await p.waitForFunction(()=>{const s=MicroWorldLab.snapshot();return s.step===2&&s.renderStep===1&&s.ready<s.visible&&s.renderReady>0;});
  const heldPixel=await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const gl=document.getElementById('world').getContext('webgl2'),out=new Uint8Array(4);gl.readPixels(gl.drawingBufferWidth/2,gl.drawingBufferHeight/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);resolve([...out]);})));
  assert.ok(heldPixel[1]>heldPixel[0]&&heldPixel[1]>heldPixel[2],'terrain remains rendered while the next LOD loads');
  await p.evaluate(()=>window.__releaseVoxelMeshes());
  await ready(p);await p.waitForFunction(()=>MicroWorldLab.snapshot().renderStep===2);assert.equal((await state(p)).renderReady,(await state(p)).visible,'LOD swaps only after full view is ready');
  await p.locator('#close').click();await ready(p);await p.waitForFunction(()=>MicroWorldLab.snapshot().renderStep===1);
  // Check a real pixel is drawn (not merely a successfully allocated WebGL canvas).
  const pixel=await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const gl=document.getElementById('world').getContext('webgl2'),out=new Uint8Array(4);gl.readPixels(gl.drawingBufferWidth/2,gl.drawingBufferHeight/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);resolve([...out]);})));
  assert.ok(pixel[0]>20&&pixel[1]>pixel[0]&&pixel[1]>pixel[2]&&pixel[3]===255,'clearing has rendered green pixels, not an empty canvas');
  const first=(await state(p)).actors;await p.waitForFunction(x=>MicroWorldLab.snapshot().actors[0].x!==x,first[0].x);const moving=await state(p);
  for(const a of moving.actors)assert.equal(a.y,M.createWorld(2718).ground(a.x,a.z),'actor contacts exact voxel ground');
  // Hex atlas: crew work tasks independently of the camera, and each role sees the same hexes.
  assert.equal(moving.atlas.view,'explore');assert.deepEqual(moving.actors.map(a=>a.role),['explorer','researcher']);
  await p.waitForFunction(()=>MicroWorldLab.snapshot().atlas.surveyed>1,null,{timeout:20000});
  const atlasPixels=()=>p.evaluate(()=>{const c=document.getElementById('atlasLayer'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)n+=d[i]>0;return n;});
  assert.ok(await atlasPixels()>500,'explore view draws surveyed and frontier hexes');
  await p.locator('[data-atlas=logistics]').click();assert.equal((await state(p)).atlas.view,'logistics');assert.equal(await p.locator('[data-atlas=logistics]').getAttribute('aria-pressed'),'true');
  await p.locator('[data-atlas=off]').click();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await atlasPixels(),0,'terrain view hides the atlas');await p.locator('[data-atlas=explore]').click();
  await p.locator('#rootMarker').click();assert.match(await p.locator('#hexSummary').innerText(),/Ferrite root \(identified\)/);assert.ok(await p.locator('#hexTask').isHidden());await p.locator('#closeInspection').click();
  await p.locator('#pause').click();const crew=(await state(p)).actors.map(a=>[a.x,a.z]),box=await p.locator('#world').boundingBox();
  await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2-120,box.y+box.height/2-80,{steps:6});await p.mouse.up();
  const dragged=await state(p);assert.deepEqual(dragged.actors.map(a=>[a.x,a.z]),crew,'camera drag does not move task-linked crew');await p.locator('#pause').click();await p.locator('#close').click();await ready(p);
  await p.locator('#pause').click();const stopped=(await state(p)).simTime;await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));assert.equal((await state(p)).simTime,stopped);assert.equal(await p.locator('#pause').getAttribute('aria-pressed'),'true');
  // Ground inspection agrees with projection at a flat, uncovered point in the clearing.
  const point=await p.evaluate(()=>MicroWorldLab.project(49,8,58)),rect=await p.locator('#world').boundingBox();
  await p.mouse.click(rect.x+point.x,rect.y+point.y);assert.match(await p.locator('#inspectBody').innerText(),/Surface 8.00 m/);await p.locator('#closeInspection').click();
  await p.locator('#world').focus();const x=(await state(p)).camera.x;await p.keyboard.press('ArrowRight');assert.ok((await state(p)).camera.x>x);await p.keyboard.press('r');await ready(p);assert.equal((await state(p)).camera.span,32);
  await p.locator('#economy').click();await ready(p);assert.equal((await state(p)).step,2);assert.deepEqual((await state(p)).deposit,original);await p.locator('#economy').click();await ready(p);
  const before=(await state(p)).camera;await p.mouse.move(rect.x+rect.width*.65,rect.y+rect.height*.45);await p.mouse.down();await p.mouse.move(rect.x+rect.width*.65+80,rect.y+rect.height*.45+30,{steps:5});await p.mouse.up();await ready(p);assert.notDeepEqual((await state(p)).camera,before,'drag pans');
  for(const [dx,dy] of [[70,0],[-70,0],[0,60],[0,-60],[45,35]]){
    await p.locator('#close').click();await ready(p);
    const landmark=await p.evaluate(()=>MicroWorldLab.project(49,8,58)),bounds=await p.locator('#world').boundingBox();
    const x=bounds.x+bounds.width*.8,y=bounds.y+bounds.height*.6;
    await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx,y+dy,{steps:4});await p.mouse.up();await ready(p);
    const moved=await p.evaluate(()=>MicroWorldLab.project(49,8,58));
    assert.ok(Math.abs(moved.x-landmark.x-dx)<1&&Math.abs(moved.y-landmark.y-dy)<1,`terrain follows drag by (${dx}, ${dy}) pixels`);
    assert.equal(await p.locator('#inspection').isVisible(),false,'drag does not inspect terrain');
  }
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
    for(const id of ['wide','close','zoomIn','zoomOut','pause','economy','metrics','densityBase','densityFine']){const r=await p.locator('#'+id).boundingBox();assert.ok(r.width>=44&&r.height>=44&&r.y+r.height<=height,'visible touch targets');}
    await p.locator('#metrics').click();assert.ok(await p.locator('#performance').evaluate(el=>el.scrollWidth<=el.clientWidth),'dialog does not overflow');await p.keyboard.press('Escape');
  }
  // Density changes actual cells, not metres, resource identity or camera framing.
  await p.setViewportSize({width:1280,height:850});await p.locator('#close').click();await ready(p);
  const baseline=await state(p);await p.locator('#densityFine').click();await ready(p);const fine=await state(p);
  assert.equal(fine.cellMetres,.125);assert.deepEqual(fine.chunkCells,[64,192,64]);assert.equal(fine.chunkMetres,8);assert.equal(fine.step,1);
  assert.equal(fine.worldId,baseline.worldId);assert.equal(fine.deposit.id,baseline.deposit.id);assert.notEqual(fine.dataId,baseline.dataId);assert.deepEqual(fine.camera,baseline.camera);
  assert.equal(fine.renderStep,1,'density regeneration cannot reuse previous world geometry');
  await p.waitForFunction(n=>MicroWorldLab.snapshot().triangles>n,baseline.triangles);
  assert.equal(await p.locator('#densityFine').getAttribute('aria-pressed'),'true');assert.match(p.url(),/cell=0.125/);
  for(const a of fine.actors)assert.equal(a.y,M.createWorld(2718,.125).ground(a.x,a.z));
  assert.ok(fine.meshCacheBytes<=32*1024*1024&&fine.voxelCacheBytes<=4*1024*1024,'fine mode respects unchanged budgets');
  await p.locator('#metrics').click();assert.match(await p.locator('#metricList').innerText(),/0.125 m/);await p.keyboard.press('Escape');
  for(let i=0;i<8;i++)await p.locator('#zoomIn').click();await ready(p);assert.equal((await state(p)).camera.span,8,'fine voxels can be inspected close up');await p.locator('#close').click();await ready(p);
  await p.locator('#rootMarker').click();assert.match(await p.locator('#inspectPosition').innerText(),new RegExp(fine.deposit.id));await p.locator('#closeInspection').click();
  await p.reload();await ready(p);assert.equal((await state(p)).cellMetres,.125,'reload retains density');
  await p.locator('#wide').click();await ready(p);assert.equal((await state(p)).step,8,'wide views keep metre-scale LOD');
  await p.waitForFunction(()=>MicroWorldLab.snapshot().renderStep===8);assert.ok((await state(p)).meshCacheBytes<=32*1024*1024);
  await p.locator('#densityBase').click();await p.locator('#densityFine').click();await p.locator('#densityBase').click();await ready(p);
  assert.equal((await state(p)).cellMetres,.25);assert.equal((await state(p)).dataId,baseline.dataId,'rapid switches reject obsolete meshes');
  const edge=await p.evaluate(()=>{
    const canvas=document.getElementById('world'),r=canvas.getBoundingClientRect(),view={canvas,width:r.width,height:r.height,aspect:r.width/r.height},camera={x:64,z:64,span:140},world=MicroWorld.createWorld(2718);
    const projected=MicroRenderer.prototype.project.call(view,camera,127.875,world.ground(127.875,64),64);
    return MicroRenderer.prototype.pick.call(view,camera,r.left+projected.x,r.top+projected.y,world);
  });
  assert.ok(edge.x>=0&&edge.x<128&&Math.abs(edge.x-127.875)<.2&&Math.abs(edge.z-64)<.2,'off-map air does not hide valid edge terrain');
  await p.locator('#info').click();await p.locator('#worldSize').selectOption('256');await p.locator('#seedForm button').click();await ready(p);
  let regional=await state(p);assert.equal(regional.extent,256);assert.equal(regional.deposit.id,original.id);assert.equal(regional.camera.x,128);assert.ok(regional.visible<320&&regional.meshCacheEntries<=320&&regional.meshCacheBytes<=regional.meshCacheLimit);
  assert.match(p.url(),/extent=256/);assert.equal(await p.locator('#wide').innerText(),'Region');assert.match(await p.locator('#seedLabel').innerText(),/256 m × 256 m/);
  await p.locator('#world').focus();await p.keyboard.down('ArrowRight');
  try{await p.waitForFunction(()=>MicroWorldLab.snapshot().camera.x>193,null,{timeout:60000});}finally{await p.keyboard.up('ArrowRight');}
  await ready(p);regional=await state(p);
  assert.ok(regional.camera.x>192,'camera pans well beyond the previous eastern border');assert.ok(regional.visible>0&&regional.ready===regional.visible&&regional.voxelCacheBytes<=4*1024*1024);
  await p.locator('#close').click();await ready(p);assert.equal((await state(p)).deposit.id,original.id,'root is reachable from the new region');
  await p.locator('#densityFine').click();await ready(p);assert.equal((await state(p)).extent,256);assert.equal((await state(p)).cellMetres,.125);
  await p.locator('#wide').click();await ready(p);assert.ok((await state(p)).meshCacheBytes<=32*1024*1024);
  if(process.env.SPACOLOGY_ARTIFACT_DIR){fs.mkdirSync(process.env.SPACOLOGY_ARTIFACT_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.SPACOLOGY_ARTIFACT_DIR,'microvoxel-region.png')});fs.writeFileSync(path.join(process.env.SPACOLOGY_ARTIFACT_DIR,'microvoxel-region-metrics.json'),JSON.stringify(await state(p),null,2));}
  await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>MicroWorldLab.snapshot().camera.span<=81);await ready(p);regional=await state(p);
  assert.ok(regional.camera.span<=81&&regional.visible<320&&regional.ready===regional.visible,'portrait switch limits streamed viewport to cache capacity');
  await p.setViewportSize({width:320,height:1500});await p.waitForFunction(()=>MicroWorldLab.snapshot().camera.span<81);await ready(p);regional=await state(p);
  assert.ok(regional.visible<=320&&regional.ready===regional.visible,'very tall viewports cannot request more meshes than the entry budget');
  await p.setViewportSize({width:1280,height:850});await p.locator('#wide').click();await ready(p);
  await p.reload();await ready(p);assert.equal((await state(p)).extent,256,'reload retains selected footprint');
  await p.locator('#info').click();await p.locator('#worldSize').selectOption('128');await p.locator('#seedForm button').click();await ready(p);
  assert.equal((await state(p)).extent,128);assert.equal((await state(p)).cellMetres,.125);assert.equal(await p.locator('#wide').innerText(),'Catchment');
  assert.ok(requests.every(r=>r.startsWith(BASE)),'no external runtime dependency');assert.deepEqual(errors,[]);
  if(process.env.SPACOLOGY_ARTIFACT_DIR){fs.mkdirSync(process.env.SPACOLOGY_ARTIFACT_DIR,{recursive:true});await p.setViewportSize({width:1280,height:850});await p.locator('#wide').click();await ready(p);await p.locator('#notice').waitFor({state:'hidden'});await p.screenshot({path:path.join(process.env.SPACOLOGY_ARTIFACT_DIR,'microvoxel-wide.png')});await p.locator('#close').click();await ready(p);await p.locator('#notice').waitFor({state:'hidden'});await p.screenshot({path:path.join(process.env.SPACOLOGY_ARTIFACT_DIR,'microvoxel-site.png')});fs.writeFileSync(path.join(process.env.SPACOLOGY_ARTIFACT_DIR,'microvoxel-browser-metrics.json'),JSON.stringify(await state(p),null,2));}
  await context.close();
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'spacology-voxel-'));
  try{
    const file=path.join(temporary,'world.html');execFileSync(process.execPath,[path.resolve(__dirname,'../../tools/package-microvoxel.cjs'),file]);
    const offline=await browser.newContext({offline:true,serviceWorkers:'block'}),copy=await offline.newPage(),copyErrors=[],copyRequests=[];
    copy.on('pageerror',e=>copyErrors.push(e.message));copy.on('request',r=>copyRequests.push(r.url()));
    await copy.goto(pathToFileURL(file).href+'?extent=128');await ready(copy);assert.deepEqual((await state(copy)).deposit,original);
    await copy.locator('#close').click();await ready(copy);await copy.locator('#rootMarker').click();assert.match(await copy.locator('#inspectBody').innerText(),/western fault/);
    await copy.locator('#info').click();await copy.locator('#seed').fill('39');await copy.locator('#seedForm button').click();await ready(copy);assert.equal((await state(copy)).seed,39);
    await copy.locator('#densityFine').click();await copy.locator('#close').click();await ready(copy);assert.equal((await state(copy)).cellMetres,.125,'fine offline package uses the real worker');
    await copy.locator('#info').click();await copy.locator('#worldSize').selectOption('256');await copy.locator('#seedForm button').click();await ready(copy);assert.equal((await state(copy)).extent,256,'offline worker builds the larger region');
    assert.deepEqual(copyErrors,[],'exact single-file copy runs offline');assert.ok(copyRequests.every(r=>!/^https?:/.test(r)),'no network loads from the package');await offline.close();
  }finally{fs.rmSync(temporary,{recursive:true,force:true});}
  // Touch input uses the same pointer map and controls.
  const touch=await browser.newContext({serviceWorkers:'block',hasTouch:true,isMobile:true,viewport:{width:390,height:844}}),phone=await touch.newPage();await phone.goto(URL);await ready(phone);await phone.locator('#close').tap();await ready(phone);await phone.locator('#rootMarker').tap();assert.equal(await phone.locator('#inspection').isVisible(),true);await phone.locator('#closeInspection').tap();await phone.locator('#zoomIn').tap();await ready(phone);assert.ok((await state(phone)).camera.span<32);
  await phone.locator('#densityFine').tap();await ready(phone);assert.equal((await state(phone)).cellMetres,.125);
  const finger=await touch.newCDPSession(phone);
  for(const [dx,dy] of [[0,45],[0,-45],[45,0],[-45,0]]){
    const landmark=await phone.evaluate(()=>MicroWorldLab.project(49,8,58)),r=await phone.locator('#world').boundingBox(),x=r.x+r.width*.75,y=r.y+r.height*.6;
    await finger.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=4;i++)await finger.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/4,y:y+dy*i/4}]});
    await finger.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await ready(phone);
    const moved=await phone.evaluate(()=>MicroWorldLab.project(49,8,58));assert.ok(Math.abs(moved.x-landmark.x-dx)<1&&Math.abs(moved.y-landmark.y-dy)<1,'terrain follows native touch drag in both axes');
  }
  await finger.detach();
  for(let cycle=0;cycle<2;cycle++){
    await phone.locator('#close').tap();await ready(phone);
    for(let zoom=0;zoom<4;zoom++){await phone.locator('#zoomOut').tap();await ready(phone);}
    const settled=await state(phone);assert.equal(settled.step,8);assert.equal(settled.ready,settled.visible,'portrait LOD streaming finishes even when old and new views exceed the entry budget together');assert.ok(settled.meshCacheEntries<=320&&settled.meshCacheBytes<=32*1024*1024);
  }
  await touch.close();
  const unsupported=await browser.newContext();await unsupported.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};});const fallback=await unsupported.newPage();await fallback.goto(URL);await fallback.locator('#notice').waitFor();assert.match(await fallback.locator('#notice').innerText(),/WebGL2 is unavailable/);assert.equal(await fallback.locator('#close').isDisabled(),true);assert.ok(await fallback.locator('.brand').isVisible());await unsupported.close();
  const lost=await browser.newPage();await lost.goto(URL);await ready(lost);await lost.evaluate(()=>document.getElementById('world').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await lost.waitForFunction(()=>MicroWorldLab.snapshot().failed);assert.match(await lost.locator('#notice').innerText(),/context lost/);await lost.close();
  console.log('PASS microvoxel browser: rendered world, input/projection, crew/pause, seed/LOD identity, bounded caches, export, responsive/touch, reduced motion, WebGL fallback/context loss; zero runtime errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
