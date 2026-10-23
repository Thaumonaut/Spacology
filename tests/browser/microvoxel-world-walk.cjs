'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',dir='artifacts/voxel-rendering';
const state=p=>p.evaluate(()=>MicroWorldLab.snapshot());
const ready=p=>p.waitForFunction(()=>{const s=window.MicroWorldLab?.snapshot();return s&&!s.failed&&s.visible>0&&s.ready===s.visible&&!s.pending&&!s.walk.transitioning;},null,{timeout:360000});
const point=s=>s.position?{x:s.position.cx*8+s.position.x,z:s.position.cz*8+s.position.z}:{x:s.camera.x,z:s.camera.z};
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1',channel:process.env.SPACOLOGY_BROWSER_CHANNEL||undefined});
try{
  const p=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(BASE+'/prototypes/microvoxel-world.html?seed=2718&extent=infinite&cx=-1&cz=-5&lx=4&lz=6');await ready(p);
  await p.locator('#walk').click();await ready(p);let s=await state(p);
  assert.equal(s.camera.mode,'walk');assert.ok(s.walk.active);assert.ok(s.camera.eyeY>s.walk.height+1.2);assert.equal(s.camera.fov,70);
  assert.ok(Object.keys(s.stream.rings).length>=4,'several distance rings are simultaneously requested');assert.equal(s.stream.level,0,'the near ring keeps L0 detail at the default budget');
  assert.ok(s.meshCacheBytes<=s.meshCacheLimit);assert.equal(s.camera.viewDistance,6000);assert.ok(await p.locator('#coop').isHidden());
  console.log('Walk ready',JSON.stringify({rings:s.stream.rings,frames:[s.frameP50,s.frameP95],bytes:s.meshCacheBytes}));const start=point(s);await p.locator('#world').focus();await p.keyboard.down('w');
  try{await p.waitForFunction(start=>{const s=MicroWorldLab.snapshot(),q=s.position;return Math.hypot(q.cx*8+q.x-start.x,q.cz*8+q.z-start.z)>=10;},start,{timeout:Math.max(45000,s.frameP95*120)});}catch(e){console.log('Movement failed',JSON.stringify(await state(p)));await p.screenshot({path:dir+'/walk-debug.png'});throw e;}await p.keyboard.up('w');await ready(p);
  s=await state(p);const walked=point(s);assert.ok(Math.hypot(walked.x-start.x,walked.z-start.z)>=10);assert.ok(s.camera.eyeY>s.walk.height+1.2);assert.equal(s.camera.x,0);assert.equal(s.camera.z,0);
  const rect=await p.locator('#world').boundingBox(),yaw=s.camera.yaw;
  await p.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
  const locked=await p.evaluate(()=>!!document.pointerLockElement);
  if(locked){
    await p.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:-Math.PI/.0025,movementY:80})));
    s=await state(p);assert.ok(Math.abs(s.camera.yaw-yaw-Math.PI)<.01);
    await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.pointerLockElement);assert.equal((await state(p)).camera.mode,'walk');
  }else{
    await p.waitForFunction(()=>document.getElementById('walkHint').textContent.includes('Mouse capture unavailable'));
    console.log('Pointer lock unsupported in this headless browser: verifying the real drag-look fallback instead.');
    const x=rect.x+rect.width*.85,y=rect.y+rect.height/2;
    await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x-Math.PI/.004,y+60,{steps:16});await p.mouse.up();
    await p.waitForFunction(yaw=>Math.abs(MicroWorldLab.snapshot().camera.yaw-yaw-Math.PI)<.02,yaw);
  }
  const hit=await p.evaluate(()=>{const r=document.getElementById('world').getBoundingClientRect();return MicroWorldLab.pick(r.x+r.width/2,r.y+r.height/2);});assert.ok(hit.y>0,'terrain remains under the downward crosshair');
  for(let i=0;i<8;i++){
    const x=rect.x+rect.width*.65,y=rect.y+rect.height/2,old=(await state(p)).camera.yaw;
    await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x-Math.PI/4/.004,y,{steps:4});await p.mouse.up();
    await p.waitForFunction(old=>Math.abs(MicroWorldLab.snapshot().camera.yaw-old-Math.PI/4)<.02,old);
  }
  await ready(p);s=await state(p);assert.equal(s.glError,0);assert.equal(s.stream.covered,s.visible,'a full turn retains complete terrain coverage');
  await p.screenshot({path:dir+'/walk-ground.png'});fs.writeFileSync(dir+'/walk-metrics.json',JSON.stringify(s,null,2));
  await p.locator('#settings').click();await p.locator('#walkFov').fill('90');assert.equal((await state(p)).camera.fov,90);await p.locator('#settings').click();
  await p.reload();await ready(p);s=await state(p);assert.equal(s.camera.mode,'walk');assert.equal(s.camera.fov,90);assert.ok(Math.hypot(point(s).x-walked.x,point(s).z-walked.z)<.01,'URL keeps rebased position');
  await p.keyboard.press('m');await ready(p);s=await state(p);assert.equal(s.camera.mode,'map');assert.ok(Math.hypot(point(s).x-walked.x,point(s).z-walked.z)<.01,'Map returns at the walker position');assert.ok(!new URL(p.url()).searchParams.has('walk'));
  assert.deepEqual(errors,[]);assert.equal(s.glError,0);
  await p.close();const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),mobile=await context.newPage();
  mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(BASE+'/prototypes/microvoxel-world.html?seed=2718&extent=infinite&cx=-1&cz=-5&lx=4&lz=6&walk=1');await ready(mobile);
  const cd=await context.newCDPSession(mobile),r=await mobile.locator('#world').boundingBox(),before=await state(mobile),x=r.x+r.width*.2,y=r.y+r.height*.7;
  const touch=(type,x,y)=>cd.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  await touch('touchStart',x,y);await touch('touchMove',x,y-60);await mobile.waitForFunction(start=>{const s=MicroWorldLab.snapshot(),q=s.position;return Math.hypot(q.cx*8+q.x-start.x,q.cz*8+q.z-start.z)>.5;},point(before),{timeout:60000});await touch('touchEnd');
  let after=await state(mobile);assert.ok(Math.hypot(point(after).x-point(before).x,point(after).z-point(before).z)>.5,'native left touch stick moves the walker');
  await touch('touchStart',r.x+r.width*.8,y);await touch('touchMove',r.x+r.width*.8-70,y+20);await touch('touchEnd');
  await mobile.waitForFunction(yaw=>Math.abs(MicroWorldLab.snapshot().camera.yaw-yaw)>.2,after.camera.yaw);
  assert.ok(await mobile.locator('#coop').isHidden());assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'compact Walk UI fits a phone');
  await mobile.locator('#map').tap();await ready(mobile);assert.equal((await state(mobile)).camera.mode,'map');
  const mapRect=await mobile.locator('#world').boundingBox(),tx=mapRect.x+mapRect.width/2,ty=mapRect.y+mapRect.height/2;
  for(let i=0;i<2;i++){await touch('touchStart',tx,ty);await touch('touchEnd');}
  await ready(mobile);assert.equal((await state(mobile)).camera.mode,'walk','double-tap enters Walk');assert.ok(Math.abs((await state(mobile)).camera.yaw-35*Math.PI/180)<1e-9,'fresh entry follows the overhead heading');
  await mobile.locator('#map').tap();await ready(mobile);
  for(let i=0;i<2;i++){await touch('touchStart',tx,ty);await touch('touchMove',tx+40,ty+10);await touch('touchEnd');}
  assert.equal((await state(mobile)).camera.mode,'map','two quick pans do not count as a double-tap');assert.deepEqual(errors,[]);
  console.log('Walk: 10 m, look controls, full turn, terrain pick, URL/FOV, map return and native touch stick/look pass.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
