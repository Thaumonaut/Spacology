'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const ready=p=>p.waitForFunction(()=>{const s=window.MicroWorldLab?.snapshot();return s&&!s.failed&&s.visible>0&&s.ready===s.visible&&!s.pending&&!s.moving;},null,{timeout:90000});
const state=p=>p.evaluate(()=>MicroWorldLab.snapshot());
const terrainImage=p=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve(document.getElementById('world').toDataURL('image/png')))));
async function jump(p,cx,cz){await p.locator('#info').click();await p.locator('#chunkX').fill(String(cx));await p.locator('#chunkZ').fill(String(cz));await p.locator('#travelForm button').click();await ready(p);}
function bounded(s){assert.equal(s.camera.x,0);assert.equal(s.camera.z,0);assert.equal(s.actors.length,2);assert.ok(s.position.x>=0&&s.position.x<8&&s.position.z>=0&&s.position.z<8);assert.ok(s.meshCacheBytes<=s.meshCacheLimit,'LOD node cache stays within its GPU budget');assert.ok(s.voxelCacheEntries<=128&&s.voxelCacheBytes<=4*1024*1024);assert.ok(s.vegetationEntries<=2048&&s.mainVegetationEntries<=2048);assert.ok(s.maxRenderOrigin<Math.max(256,s.camera.span*3),'GPU origins stay relative to the explorer');}
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'}),p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
    const names=new WeakMap(),proto=WebGL2RenderingContext.prototype,get=proto.getUniformLocation,uniform=proto.uniform3fv,center=proto.uniform3f;
    window.__maxPositionUniform=0;
    proto.getUniformLocation=function(...args){const result=get.apply(this,args);if(result)names.set(result,args[1]);return result;};
    proto.uniform3fv=function(location,value){if(names.get(location)==='origin')window.__maxPositionUniform=Math.max(window.__maxPositionUniform,...value.map(Math.abs));return uniform.call(this,location,value);};
    proto.uniform3f=function(location,x,y,z){if(names.get(location)==='center')window.__maxPositionUniform=Math.max(window.__maxPositionUniform,Math.abs(x),Math.abs(z));return center.call(this,location,x,y,z);};
  });
  await p.goto(BASE+'/prototypes/microvoxel-world.html?extent=infinite&seed=2718&gpuMiB=8');await ready(p);await p.locator('#pause').click();
  const original=await state(p);bounded(original);assert.equal(original.extent,'infinite');assert.equal(original.revision,'micro-wilds-13');
  const fixture=M.createWorld(original.seed,original.cellMetres,'infinite');for(const a of original.actors)assert.equal(a.y,fixture.ground(a.x,a.z),'crew stand on exact voxel ground at their task sites');
  const home=await terrainImage(p),samples=[];assert.ok(home.length>10000,'capture contains rendered terrain, not an empty framebuffer');
  for(const [cx,cz] of [[125,0],[-125,-125],[250,250],[200000,-200000],[-200000,200000],[500000,-500000],[-500000,500000],[1000000,-1000000],[-1000000,1000000],[M.MAX_CHUNK-32,-M.MAX_CHUNK+32]]){
    await jump(p,cx,cz);const s=await state(p);bounded(s);assert.equal(s.position.cx,cx);assert.equal(s.position.cz,cz);assert.equal(s.position.x,4);assert.deepEqual(s.actors.map(a=>[a.x,a.z]),original.actors.map(a=>[a.x,a.z]),'paused crew stay at their task sites while the camera travels');assert.ok(await p.locator('#rootMarker').isHidden());samples.push(s);
  }
  assert.ok(await p.evaluate(()=>window.__maxPositionUniform<256),'actual GPU position uniforms stay small after distant travel');
  const distant=samples.at(-1).position,distantX=distant.cx*8+distant.x+2,distantZ=distant.cz*8+distant.z+2;
  const target=await p.evaluate(({x,y,z})=>MicroWorldLab.project(x,y,z),{x:distantX,y:fixture.ground(distantX,distantZ),z:distantZ}),canvasRect=await p.locator('#world').boundingBox();
  await p.mouse.click(canvasRect.x+target.x,canvasRect.y+target.y);assert.ok(await p.locator('#inspection').isVisible());assert.match(await p.locator('#inspectPosition').innerText(),/X 134217/);await p.locator('#closeInspection').click();
  const beforeReturn=await state(p);assert.ok(beforeReturn.meshCacheBytes<=beforeReturn.meshCacheLimit&&beforeReturn.meshCacheLimit===8*1048576,'distant travel stays within the small test budget (?gpuMiB=8), evicting home nodes');
  await p.locator('#close').click();await ready(p);const returnedState=await state(p);assert.deepEqual(returnedState.position,original.position);
  assert.ok(returnedState.completed>beforeReturn.completed,'returning rebuilds evicted meshes');assert.equal(returnedState.cacheHits,beforeReturn.cacheHits,'returning regenerates evicted CPU chunks too');
  assert.ok(await terrainImage(p)===home,'returning after eviction renders the same paused terrain pixels without stored terrain');
  // A rebase must not snap a logical landmark, even across negative chunk zero.
  await jump(p,0,0);const before=await p.evaluate(()=>MicroWorldLab.project(2,8,2)),rect=await p.locator('#world').boundingBox();
  const x=rect.x+rect.width*.75,y=rect.y+rect.height*.65,dx=170,dy=80;
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx,y+dy,{steps:8});await p.mouse.up();await ready(p);
  const after=await p.evaluate(()=>MicroWorldLab.project(2,8,2));assert.ok(Math.abs(after.x-before.x-dx)<.01&&Math.abs(after.y-before.y-dy)<.01,'landmark follows drag continuously through rebasing');
  let s=await state(p);bounded(s);assert.ok(s.position.cx<0||s.position.cz<0);const saved=s.position;
  await p.reload();await ready(p);assert.deepEqual((await state(p)).position,saved,'URL retains compact signed position');
  await p.locator('#world').focus();await p.keyboard.press('ArrowRight');await ready(p);s=await state(p);bounded(s);assert.notDeepEqual(s.position,saved);
  const q=s.position,ground=fixture.ground(q.cx*8+q.x,q.cz*8+q.z);assert.equal(s.actors[0].y,fixture.ground(s.actors[0].x,s.actors[0].z));
  const pick=await p.evaluate(({x,y,z})=>MicroWorldLab.project(x,y,z),{x:q.cx*8+q.x+2,y:ground,z:q.cz*8+q.z+2});
  await p.mouse.click(rect.x+pick.x,rect.y+pick.y);assert.ok(await p.locator('#inspection').isVisible());
  assert.ok((await p.locator('#inspectPosition').innerText()).includes('X '));await p.locator('#closeInspection').click();
  const densityPosition=(await state(p)).position;await p.locator('#densityFine').click();await ready(p);bounded(await state(p));assert.deepEqual((await state(p)).position,densityPosition);assert.equal((await state(p)).cellMetres,.125);
  await jump(p,-1000000,1000000);bounded(await state(p));await p.locator('#wide').click();await ready(p);bounded(await state(p));
  await p.setViewportSize({width:390,height:844});await ready(p);bounded(await state(p));
  for(let i=0;i<2;i++){await p.locator('#close').click();await ready(p);for(let z=0;z<4;z++){await p.locator('#zoomOut').click();await ready(p);}bounded(await state(p));}
  if(process.env.SPACOLOGY_ARTIFACT_DIR){fs.mkdirSync(process.env.SPACOLOGY_ARTIFACT_DIR,{recursive:true});await p.locator('#close').click();await ready(p);await p.locator('#notice').waitFor({state:'hidden'});await p.screenshot({path:path.join(process.env.SPACOLOGY_ARTIFACT_DIR,'microvoxel-infinite.png')});fs.writeFileSync(path.join(process.env.SPACOLOGY_ARTIFACT_DIR,'microvoxel-infinite-metrics.json'),JSON.stringify(samples,null,2));}
  await p.locator('#info').click();await p.locator('#worldSize').selectOption('128');await p.locator('#seedForm button').click();await ready(p);assert.equal((await state(p)).extent,128);assert.ok(await p.locator('#travelForm').isHidden());assert.equal((await state(p)).deposit.id,M.createWorld(2718,.125).deposit.id);
  await p.locator('#info').click();await p.locator('#worldSize').selectOption('infinite');await p.locator('#seedForm button').click();await ready(p);bounded(await state(p));assert.equal((await state(p)).deposit.id,original.deposit.id);assert.deepEqual(errors,[]);
  await context.close();
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'spacology-infinite-'));
  try{
    const file=path.join(tmp,'world.html');execFileSync(process.execPath,[path.resolve(__dirname,'../../tools/package-microvoxel.cjs'),file]);
    const offline=await browser.newContext({offline:true,serviceWorkers:'block',hasTouch:true,isMobile:true,viewport:{width:390,height:844}}),copy=await offline.newPage(),copyErrors=[];copy.on('pageerror',e=>copyErrors.push(e.message));
    await copy.goto(pathToFileURL(file).href+'?extent=infinite&cx=-125&cz=125&lx=7.875&lz=0.125');await ready(copy);bounded(await state(copy));assert.equal((await state(copy)).position.x,7.875);
    const touchPoint=await state(copy),landmark=await copy.evaluate(({cx,cz,x,z})=>MicroWorldLab.project(cx*8+x,8,cz*8+z),touchPoint.position),touchRect=await copy.locator('#world').boundingBox(),finger=await offline.newCDPSession(copy),tx=touchRect.x+touchRect.width*.55,ty=touchRect.y+touchRect.height*.45,tdx=55,tdy=70;
    await finger.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});
    for(let i=1;i<=4;i++)await finger.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx+tdx*i/4,y:ty+tdy*i/4}]});
    await finger.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await ready(copy);
    const moved=await copy.evaluate(({cx,cz,x,z})=>MicroWorldLab.project(cx*8+x,8,cz*8+z),touchPoint.position);bounded(await state(copy));assert.ok(Math.abs(moved.x-landmark.x-tdx)<1&&Math.abs(moved.y-landmark.y-tdy)<1,'packaged terrain follows native touch across signed chunks');
    await copy.locator('#densityFine').tap();await ready(copy);await copy.locator('#close').tap();await ready(copy);await copy.locator('#rootMarker').tap();assert.match(await copy.locator('#inspectBody').innerText(),/seeded ridge/);await copy.locator('#closeInspection').tap();
    assert.deepEqual(copyErrors,[]);await offline.close();
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
  console.log('PASS streamed world: distant signed travel, GPU origin bounds, deterministic return image, drag/rebase continuity, compact reload, ground selection, density, portrait LOD and packaged touch');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
