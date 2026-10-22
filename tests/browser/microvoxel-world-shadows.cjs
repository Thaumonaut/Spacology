'use strict';
// Sun shadows must not break drawing: every draw in both worlds succeeds and the finite world still shows terrain.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';
const ready=p=>p.waitForFunction(()=>{const s=window.MicroWorldLab?.snapshot();return s&&!s.failed&&s.visible>0&&s.ready===s.visible&&!s.pending;},null,{timeout:180000});
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  for(const query of ['extent=128','extent=infinite&seed=2718']){
    const p=await browser.newPage({viewport:{width:900,height:640}});
    await p.addInitScript(()=>{
      window.__drawErrors=0;window.__draws=0;const draw=WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays=function(...a){draw.apply(this,a);window.__draws++;if(this.getError()!==this.NO_ERROR)window.__drawErrors++;};
    });
    await p.goto(`${BASE}/prototypes/microvoxel-world.html?${query}`);await ready(p);await p.locator('#pause').click();await p.waitForTimeout(500);
    const {errors,draws,pixel}=await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
      const c=document.getElementById('world'),g=c.getContext('webgl2'),px=new Uint8Array(4);g.readPixels(c.width>>1,c.height>>1,1,1,g.RGBA,g.UNSIGNED_BYTE,px);
      resolve({errors:window.__drawErrors,draws:window.__draws,pixel:[...px]});})));
    assert.ok(draws>0,`${query}: drew something`);
    assert.equal(errors,0,`${query}: ${errors}/${draws} draws raised a GL error`);
    const clear=[.77,.81,.76].map(v=>Math.round(v*255));
    assert.ok(pixel.slice(0,3).some((v,i)=>Math.abs(v-clear[i])>12),`${query}: centre shows terrain, not the clear colour (${pixel})`);
    await p.close();
  }
  console.log('PASS microvoxel shadows: finite and streamed worlds draw without GL errors and show terrain');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
