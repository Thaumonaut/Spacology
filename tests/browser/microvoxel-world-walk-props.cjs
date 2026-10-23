'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',dir='artifacts/voxel-rendering';
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1',channel:process.env.SPACOLOGY_BROWSER_CHANNEL||undefined});
try{
  const p=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});
  await p.setContent('<style>body{margin:0}canvas{display:block;width:960px;height:640px}</style><canvas></canvas>');
  for(const file of ['macro-map.js','voxel-world-model.js','voxel-renderer.js'])await p.addScriptTag({url:BASE+'/prototypes/labs/microvoxel-world/'+file});
  for(const fixture of [
    {name:'palm',x:-386.14587421899193,z:561.5324577879394,base:16.5,target:20.5,prop:'fronds'},
    {name:'mushroom',x:-2036.12765730978,z:-2231.1978865843266,base:22.75,target:24.7,prop:'mushrooms'},
    {name:'water',x:-404,z:566,target:15.5}
  ]){
    const result=await p.evaluate(q=>{
      document.querySelector('canvas').remove();const canvas=document.createElement('canvas');document.body.append(canvas);const w=MicroWorld.createWorld(2718,.25,'infinite'),r=new MicroRenderer(canvas),meshes=[],nx=Math.floor(q.x/8),nz=Math.floor(q.z/8);
      const x=q.x+6,z=q.z+7,eyeY=Math.max(w.ground(x,z)+1.6,q.base||0),camera={mode:'walk',x,z,y:eyeY-1.6,eyeY,yaw:Math.atan2(x-q.x,z-q.z),lookPitch:Math.atan2(q.target-eyeY,Math.hypot(x-q.x,z-q.z)),fov:70,viewDistance:600,span:32};
      let count=0,water=false;
      for(let j=nz-2;j<=nz+2;j++)for(let i=nx-2;i<=nx+2;i++){
        const data=w.node(0,i,j,{smooth:true,props:true});count+=q.prop?(data[q.prop]?.length||0)/8:0;water ||= data.waterMap.some((v,k)=>k%4===0&&v>0);
        meshes.push({mesh:r.upload(data),origin:[i*8,0,j*8]});
      }
      const draw=()=>{
        r.begin(camera,0,false);for(const d of meshes)r.draw(d.mesh,d.origin);r.end();
        const gl=r.gl,bytes=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;
      };
      const withProps=draw();let changed=0;
      if(q.prop){
        const saved=meshes.map(d=>d.mesh[q.prop]);meshes.forEach(d=>delete d.mesh[q.prop]);const without=draw();
        for(let i=0;i<withProps.length;i+=4)if(withProps[i]!==without[i]||withProps[i+1]!==without[i+1]||withProps[i+2]!==without[i+2])changed++;
        meshes.forEach((d,i)=>d.mesh[q.prop]=saved[i]);draw();
      }
      const png=canvas.toDataURL(),error=r.lastError||r.gl.getError();
      for(const d of meshes)r.dispose(d.mesh);r.gl.getExtension('WEBGL_lose_context')?.loseContext();return {count,changed,water,error,png};
    },fixture);
    assert.equal(result.error,0,fixture.name+' renders without WebGL errors');
    if(fixture.prop){assert.ok(result.count>0,fixture.name+' fixture includes real generated props');assert.ok(result.changed>100,fixture.name+' prop geometry changes visible perspective pixels');}
    else assert.ok(result.water,'water fixture includes a shoreline');
    fs.writeFileSync(dir+'/walk-'+fixture.name+'.png',Buffer.from(result.png.split(',')[1],'base64'));
    console.log(fixture.name,JSON.stringify({instances:result.count,visiblePixels:result.changed,water:result.water}));
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
