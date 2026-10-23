'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',dir='artifacts/voxel-rendering';
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1',channel:process.env.SPACOLOGY_BROWSER_CHANNEL||undefined});
try{
  const p=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});
  await p.setContent('<style>body{margin:0}canvas{display:block;width:960px;height:640px}</style><canvas></canvas>');
  for(const file of ['macro-map.js','voxel-world-model.js','voxel-renderer.js'])await p.addScriptTag({url:BASE+'/prototypes/labs/microvoxel-world/'+file});
  const lighting=await p.evaluate(()=>{
    const r=new MicroRenderer(document.querySelector('canvas')),gl=r.gl;r.cloudOpacity=0;r.outlines=false;
    const tex=bytes=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(bytes));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t;};
    Object.assign(r.cube,{normalSize:1,groundBase:0,normalMap:tex([128,128,128,0]),canopyMap:tex([128,128,1,0])});
    const sample=(below,mat)=>{
      const eyeY=below?12:28;r.begin({mode:'walk',x:0,z:0,y:eyeY-1.6,eyeY,yaw:0,lookPitch:below?Math.PI/2:-Math.PI/2,span:32,fov:70},0,false);
      r.draw(r.cube,below?[-3,21,3]:[-3,20,-3],[6,1,6],mat,0,below?Math.PI:0);r.end();
      const pixel=new Uint8Array(4);gl.readPixels(480,320,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel];
    };
    const top=sample(false,MicroWorld.MAT.coral),bottom=sample(true,MicroWorld.MAT.coral),bark=sample(false,MicroWorld.MAT.bark),error=r.lastError||gl.getError();
    gl.getExtension('WEBGL_lose_context')?.loseContext();return {top,bottom,bark,error};
  });
  assert.equal(lighting.error,0);const luminance=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
  assert.ok(luminance(lighting.top)>luminance(lighting.bottom)+15,'sunlit crown tops are brighter than downward-facing undersides');
  assert.ok(lighting.bark[0]>lighting.bark[1],'high trunks keep brown bark in Walk, not green crown camouflage');
  console.log('canopy lighting',JSON.stringify(lighting));
  // World-tree sites move with terrain revisions: search outward from home for one of each variant.
  const fixtures=await p.evaluate(()=>{const w=MicroWorld.createWorld(2718,.25,'infinite'),out=[];
    for(const want of ['coral','blossom']){let hit=null;
      for(let r=0;r<9000&&!hit;r+=110)for(let k=0;k<Math.max(1,Math.floor(r/110))*6&&!hit;k++){const t=k/Math.max(1,Math.floor(r/110)*6)*Math.PI*2,x=Math.round(Math.cos(t)*r),z=Math.round(Math.sin(t)*r),A=w.landmarksAt(x,z).ancient;if(A&&A.variant===want)hit={name:want,x:Math.round(A.x),z:Math.round(A.z)};}
      if(hit)out.push(hit);}
    return out;});
  assert.equal(fixtures.length,2,'a coral and a blossom world tree exist');
  for(const fixture of fixtures){
    const result=await p.evaluate(q=>{
      document.querySelector('canvas').remove();const canvas=document.createElement('canvas');document.body.append(canvas);
      const w=MicroWorld.createWorld(2718,.25,'infinite'),A=w.landmarksAt(q.x,q.z).ancient,r=new MicroRenderer(canvas),meshes=[],L=2,size=w.nodeMetres(L),nx=Math.floor(A.x/size),nz=Math.floor(A.z/size);
      r.worldOrigin={x:A.x,z:A.z};r.cloudOpacity=.4;
      const x=A.x+40,z=A.z+48,eyeY=w.ground(x,z)+1.6,camera={mode:'walk',x:x-A.x,z:z-A.z,y:eyeY-1.6,eyeY,yaw:Math.atan2(x-A.cx,z-A.cz),lookPitch:Math.atan2((A.g0+A.top)*.5-eyeY,Math.hypot(x-A.cx,z-A.cz)),span:32,fov:70,viewDistance:600};
      let bytes=0;
      for(let j=nz-2;j<=nz+2;j++)for(let i=nx-2;i<=nx+2;i++){
        const data=w.node(L,i,j,{smooth:true,props:false});for(const sl of data.slices)bytes+=sl.buffer.byteLength+(sl.smooth?.buffer.byteLength||0);
        meshes.push({mesh:r.upload(data),origin:[i*size-A.x,0,j*size-A.z],pattern:[i*size,0,j*size],column:data.column});
      }
      r.begin(camera,0,false);for(const d of meshes)r.draw(d.mesh,d.origin,[d.column,d.column,d.column],0,0,0,[0,0,0],d.pattern);r.end();
      const png=canvas.toDataURL(),error=r.lastError||r.gl.getError();for(const d of meshes)r.dispose(d.mesh);r.gl.getExtension('WEBGL_lose_context')?.loseContext();
      return {png,error,bytes,height:A.top-A.g0,spread:A.reach*2};
    },fixture);
    assert.equal(result.error,0,fixture.name+' renders from ground level without GL errors');assert.ok(result.bytes>0);
    fs.writeFileSync(dir+'/walk-grand-tree-'+fixture.name+'.png',Buffer.from(result.png.split(',')[1],'base64'));
    console.log(fixture.name,JSON.stringify({meshBytes:result.bytes,height:result.height,spread:result.spread}));
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
