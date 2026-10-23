'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  const p=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  await p.goto((process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173')+'/prototypes/microvoxel-world.html?extent=128');
  const result=await p.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.style.cssText='width:640px;height:400px';document.body.append(canvas);
    const r=new MicroRenderer(canvas),w=MicroWorld.createWorld(2718,.25,128),camera={x:52,y:8,z:60,span:32};
    r.cloudOpacity=0;r.begin(camera,0,false);
    for(let z=5;z<10;z++)for(let x=4;x<10;x++){const m=r.upload(MicroWorld.meshChunk(w,w.generateChunk(x,z),1));r.draw(m,[x*8,0,z*8]);}
    r.end();return canvas.toDataURL();
  });
  const file='artifacts/voxel-rendering/walk-map-baseline.png',bytes=Buffer.from(result.split(',')[1],'base64');
  if(process.env.SPACOLOGY_CAPTURE_CAMERA==='1'){fs.writeFileSync(file,bytes);console.log('Captured original overhead renderer');}
  else{assert.ok(fs.existsSync(file),'Capture the unmodified renderer baseline first');assert.deepEqual(bytes,fs.readFileSync(file),'overhead framebuffer is byte-identical to the original renderer');console.log('PASS: overhead renderer pixel parity');}
  const sky=await p.evaluate(()=>{const canvas=document.createElement('canvas');canvas.style.cssText='width:640px;height:400px';document.body.append(canvas);const r=new MicroRenderer(canvas);r.cloudOpacity=0;r.begin({mode:'walk',x:0,z:0,y:30,eyeY:31.6,yaw:0,lookPitch:.4,span:32},0,false);r.end();const gl=r.gl,pixel=new Uint8Array(4);gl.readPixels(320,300,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return {pixel:[...pixel],error:gl.getError(),view:r.view.forward};});assert.equal(sky.error,0);assert.ok(sky.pixel[2]>sky.pixel[0],'Walk sky renders blue, never the flat map clear colour');
  const contour=await p.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.style.cssText='width:640px;height:400px';document.body.append(canvas);
    const r=new MicroRenderer(canvas),gl=r.gl,camera={mode:'walk',x:0,z:0,y:0,eyeY:1.6,yaw:0,lookPitch:0,span:32,fov:70};
    const frame=outlines=>{r.outlines=outlines;r.begin(camera,0,false);r.draw(r.cube,[-3,0,-8],[2,4,2],4);r.draw(r.cube,[14,0,-160],[22,22,22],4);r.end();const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
    const plain=frame(false),shaded=frame(true);let near=0,far=0,maxDarkening=0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const i=(y*canvas.width+x)*4,delta=Math.max(...[0,1,2].map(c=>plain[i+c]-shaded[i+c]));
      if(delta){if(x<canvas.width/2)near++;else far++;maxDarkening=Math.max(maxDarkening,delta);}
    }
    return {near,far,maxDarkening,error:gl.getError()};
  });
  assert.equal(contour.error,0);
  assert.ok(contour.near>50,'near Walk silhouettes retain a subtle shaded edge');
  assert.equal(contour.far,0,'Walk contours fade away on distant scenery');
  assert.ok(contour.maxDarkening<=35,'Walk silhouettes are softly shaded, not heavily inked');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
