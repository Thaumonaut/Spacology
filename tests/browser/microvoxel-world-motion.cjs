'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';
const state=p=>p.evaluate(()=>MicroWorldLab.snapshot());
const ready=p=>p.waitForFunction(()=>{const s=window.MicroWorldLab?.snapshot();return s&&!s.failed&&s.visible>0&&s.ready===s.visible&&!s.pending&&!s.moving;},null,{timeout:90000});
const frames=(p,count)=>p.evaluate(count=>new Promise(resolve=>{const samples=[];function sample(){samples.push(MicroWorldLab.snapshot().position);if(samples.length===count)resolve(samples);else requestAnimationFrame(sample);}requestAnimationFrame(sample);}),count);
async function holdMesh(p){
  await p.evaluate(()=>{window.__holdMeshes=true;document.getElementById('world').addEventListener('pointerdown',e=>window.__pointerId=e.pointerId,{once:true});});
  const r=await p.locator('#world').boundingBox(),x=r.x+r.width*.75,y=r.y+r.height*.5;
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x-420,y,{steps:8});await p.waitForFunction(()=>window.__heldMeshes.length>=1);
  return {x:x-420,y};
}
async function exercise(p,url){
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
    const NativeWorker=window.Worker;window.__heldMeshes=[];window.__holdMeshes=false;
    window.Worker=class extends NativeWorker{
      set onmessage(callback){super.onmessage=event=>{const delivery={data:event.data,deliver:()=>callback.call(this,event)};if(window.__holdMeshes)window.__heldMeshes.push(delivery);else delivery.deliver();};}
    };
  });
  await p.goto(url+'?extent=infinite&cell=0.125&cx=50&cz=50&lx=4&lz=4');await p.locator('#zoomIn').click();await p.locator('#zoomIn').click();await ready(p);
  const point=await holdMesh(p);await p.mouse.move(point.x+8,point.y+3,{steps:6});
  const batch=await p.locator('#world').evaluate((canvas,{x,y})=>{
    const before=MicroWorldLab.snapshot().viewUpdates;
    for(let i=1;i<=40;i++)canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:window.__pointerId,clientX:x+i*.01,clientY:y,buttons:1}));
    return {before,after:MicroWorldLab.snapshot().viewUpdates};
  },{x:point.x+8,y:point.y+3});
  assert.equal(batch.after,batch.before,'pointer bursts defer view work to the animation frame');await frames(p,2);
  const before=await state(p),after=await p.evaluate(()=>{window.__holdMeshes=false;window.__heldMeshes.shift().deliver();return MicroWorldLab.snapshot();});
  assert.equal(after.completed,before.completed+1,'still-visible in-flight fine mesh is accepted during drag, not discarded by the old view epoch');assert.ok(after.retainedMeshes>before.retainedMeshes);
  // Several workers may each have held a reply; release the rest so their workers return to the pool.
  await p.evaluate(()=>{for(const d of window.__heldMeshes.splice(0))d.deliver();});
  await p.mouse.up();await ready(p);let s=await state(p);assert.equal(s.cellMetres,.125);assert.equal(s.step,1,'settled terrain keeps full fine density');assert.ok(s.meshCacheBytes<=s.meshCacheLimit);
  const fast=await state(p),r=await p.locator('#world').boundingBox();await p.mouse.move(r.x+r.width*.9,r.y+r.height*.5);await p.mouse.down();await p.mouse.move(r.x+r.width*.05,r.y+r.height*.55,{steps:3});await p.mouse.up();
  await p.waitForFunction(()=>{const s=MicroWorldLab.snapshot();return s.shown===s.visible&&s.ready<s.visible;},null,{polling:'raf',timeout:30000});
  assert.ok((await state(p)).placeholders>fast.placeholders,'large fast fine drag covers new ground with coarse-first LOD nodes before fine detail');await ready(p);assert.equal((await state(p)).step,1,'placeholders are replaced by full fine density');
  await p.locator('#world').focus();await p.keyboard.down('ArrowRight');const samples=await frames(p,12);await p.keyboard.up('ArrowRight');
  assert.ok(new Set(samples.map(q=>`${q.cx}:${q.x}`)).size>=10,'held key moves on frames without OS key-repeat jumps');await ready(p);
  const stopped=await state(p);for(const q of await frames(p,4))assert.deepEqual(q,stopped.position,'travel stops after bounded easing');
  await p.evaluate(()=>{const b=document.getElementById('settings'),p=document.getElementById('settingsPanel');if(b&&p&&p.hidden)b.click();});await p.locator('#densityFine').focus();const k=await state(p);await p.keyboard.down('ArrowUp');await frames(p,10);await p.keyboard.up('ArrowUp');
  const settle=await p.evaluate(()=>new Promise(resolve=>{let n=0;(function tick(){n++;if(!MicroWorldLab.snapshot().moving||n>60)resolve(n);else requestAnimationFrame(tick);})();}));
  const moved=(await state(p)).position,upX=(moved.cx-k.position.cx)*8+moved.x-k.position.x,upZ=(moved.cz-k.position.cz)*8+moved.z-k.position.z;assert.ok(upZ<0&&Math.abs(upX/upZ-Math.tan(35*Math.PI/180))<.02,'one held keydown travels screen-up along the 35 degree view, even when a lab button has focus');assert.ok(settle<=20,'travel stops promptly on keyup');await ready(p);
  await p.keyboard.down('ArrowLeft');await frames(p,3);await p.locator('#info').click();assert.equal((await state(p)).moving,false,'modal focus stops held-key motion');await p.keyboard.up('ArrowLeft');await p.locator('#closeNotes').click();await ready(p);
  await holdMesh(p);await p.mouse.up();await p.locator('#info').click();await p.locator('#seed').fill('39');await p.locator('#seedForm button').click();
  const stale=await p.evaluate(()=>{window.__holdMeshes=false;window.__heldMeshes.shift().deliver();return MicroWorldLab.snapshot();});
  assert.equal(stale.seed,39);assert.equal(stale.completed,0,'old-seed mesh cannot enter regenerated world');assert.equal(stale.failed,false);
  // Replies from the new world that arrived before holding was switched off are held too; release them so the workers'
  // jobs complete (as after the drag check above).
  await p.evaluate(()=>{for(const d of window.__heldMeshes.splice(0))d.deliver();});await ready(p);
  await holdMesh(p);await p.mouse.up();await p.evaluate(()=>{const b=document.getElementById('settings'),p=document.getElementById('settingsPanel');if(b&&p&&p.hidden)b.click();});await p.locator('#densityBase').click();
  const staleError=await p.evaluate(()=>{window.__holdMeshes=false;const held=window.__heldMeshes.shift();held.data.error='obsolete fine-density failure';held.deliver();return MicroWorldLab.snapshot();});
  assert.equal(staleError.cellMetres,.25);assert.equal(staleError.completed,0);assert.equal(staleError.failed,false,'obsolete-world errors cannot fail the replacement world');
  await p.evaluate(()=>{for(const d of window.__heldMeshes.splice(0))d.deliver();});await ready(p);assert.deepEqual(errors,[]);
}
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'}),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'spacology-voxel-motion-'));
try{
  const p=await browser.newPage({viewport:{width:960,height:720}});await exercise(p,BASE+'/prototypes/microvoxel-world.html');await p.close();
  const file=path.join(temporary,'world.html');execFileSync(process.execPath,[path.resolve(__dirname,'../../tools/package-microvoxel.cjs'),file]);
  const offline=await browser.newPage({viewport:{width:960,height:720}});await exercise(offline,pathToFileURL(file).href);await offline.close();
  console.log('PASS source and offline package: fine-density drag retains useful delayed work, frame-batches view updates, smooth held keys, blur stop and stale-world response isolation');
}finally{await browser.close();fs.rmSync(temporary,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exit(1);});
