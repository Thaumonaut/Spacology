(function(root){
  'use strict';
  // Optional bridge, not a generator/renderer. Both engines still use the shared BuildingPlan/BuildingVoxels.
  const CELL=1/16,MiB=1048576,LIMITS=Object.freeze({gpu:47*MiB,reply:32*MiB,scratch:64*MiB,terrain:80*MiB,total:128*MiB});
  const assert=(ok,text)=>{if(!ok)throw new Error('City World: '+text);};
  const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  function rigid(m){
    assert(m?.length===16&&Array.from(m).every(Number.isFinite),'invalid model');
    const c=m[0],s=m[8],e=1e-6;
    assert(Math.abs(c*c+s*s-1)<e&&Math.abs(m[2]+s)<e&&Math.abs(m[10]-c)<e&&Math.abs(m[5]-1)<e&&Math.abs(m[15]-1)<e&&[1,3,4,6,7,9,11].every(i=>Math.abs(m[i])<e),'model must be a rigid Y rotation');
    return m;
  }
  function compose(model,anchor){const m=Array.from(rigid(model));assert(anchor?.length===3&&anchor.every(Number.isFinite),'invalid anchor');for(let i=0;i<3;i++)m[12+i]+=anchor[i];return m;}
  function point(m,p){return [m[0]*p[0]+m[8]*p[2]+m[12],p[1]+m[13],m[2]*p[0]+m[10]*p[2]+m[14]];}
  function inverse(m,p){const x=p[0]-m[12],z=p[2]-m[14];return [x*m[0]+z*m[2],p[1]-m[13],x*m[8]+z*m[10]];}
  function bounds(local,m){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const x of [local.lo[0],local.hi[0]])for(const y of [local.lo[1],local.hi[1]])for(const z of [local.lo[2],local.hi[2]]){const p=point(m,[x,y,z]);for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}}return {lo,hi};}
  function intersects(b,x0,z0,x1,z1){return b.lo[0]<x1&&b.hi[0]>x0&&b.lo[2]<z1&&b.hi[2]>z0;}
  function chunks(b,size=8){assert(Number.isFinite(size)&&size>0,'invalid chunk size');const out=[];for(let z=Math.floor(b.lo[2]/size);z<Math.ceil(b.hi[2]/size);z++)for(let x=Math.floor(b.lo[0]/size);x<Math.ceil(b.hi[0]/size);x++){assert(out.length<4096,'bounds exceed chunk index cap');out.push([x,z]);}return out;}
  function convert(mesh,maxBytes=LIMITS.reply){
    const v=mesh.verts,idx=mesh.idx;assert(v instanceof Uint16Array&&idx instanceof Uint32Array&&v.length%4===0&&idx.length%3===0,'invalid indexed mesh');
    assert(idx.length*8<=maxBytes,'mesh reply exceeds byte cap');rigid(mesh.model);
    const buffer=new ArrayBuffer(idx.length*8),d=new DataView(buffer),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],tri=new Uint32Array(3);let count=0;
    // One fixed scratch tuple, no per-triangle arrays/objects in the expansion loop.
    for(let i=0;i<idx.length;i+=3){tri[0]=idx[i];tri[1]=idx[i+1];tri[2]=idx[i+2];assert(tri[0]<v.length/4&&tri[1]<v.length/4&&tri[2]<v.length/4,'invalid mesh index');
      const a=tri[0]*4,b=tri[1]*4,c=tri[2]*4,raw=v[a+3],face=raw&255,mat=raw>>>8;
      assert(face<6&&mat>0&&v[b+3]===raw&&v[c+3]===raw,'invalid face/material');
      const ux=v[b]-v[a],uy=v[b+1]-v[a+1],uz=v[b+2]-v[a+2],wx=v[c]-v[a],wy=v[c+1]-v[a+1],wz=v[c+2]-v[a+2],nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx;
      if(nx===0&&ny===0&&nz===0)continue;const dot=(face<2?nx:face<4?ny:nz)*(face%2?-1:1);assert(dot!==0,'face normal perpendicular to triangle');if(dot<0){const temp=tri[1];tri[1]=tri[2];tri[2]=temp;}
      for(const n of tri){const o=count++*8;for(let k=0;k<3;k++){const x=v[n*4+k];d.setUint16(o+k*2,x,true);lo[k]=Math.min(lo[k],x*CELL);hi[k]=Math.max(hi[k],x*CELL);}d.setUint8(o+6,face^1);d.setUint8(o+7,mat);}
    }
    return {kind:'building',buffer:count===idx.length?buffer:buffer.slice(0,count*8),count,bounds:count?{lo,hi}:{lo:[0,0,0],hi:[0,0,0]},model:Array.from(mesh.model)};
  }
  // Complete terrace rows only; never remove one party-wall neighbour or renumber original parcel IDs.
  function select(city,count){assert([6,12].includes(count),'fixture count must be 6 or 12');const rows=[];let row=[];for(const p of city.parcels){if(row.length&&!p.options.party[0]){rows.push(row);row=[];}row.push(p);if(!p.options.party[1]){rows.push(row);row=[];}}if(row.length)rows.push(row);
    const out=[];for(const r of rows){assert(!r[0].options.party[0]&&!r.at(-1).options.party[1],'incomplete terrace');if(out.length+r.length<=count)out.push(...r);if(out.length===count)return out;}throw new Error('City World: no complete-row fixture of requested size');}
  function place(world,city,count){
    assert(world.infinite,'district proof requires the streamed World');const parcels=select(city,count),xs=parcels.flatMap(p=>p.polygon.map(v=>v[0])),zs=parcels.flatMap(p=>p.polygon.map(v=>v[1]));
    // Fixed XZ in both flat and uneven fixtures. City jobs remain local (no uint16 wrapping at distant anchors).
    const anchor=[-80,0,80],site={x0:Math.floor(Math.min(...xs)+anchor[0]-6),x1:Math.ceil(Math.max(...xs)+anchor[0]+6),z0:Math.floor(Math.min(...zs)+anchor[2]-7),z1:Math.ceil(Math.max(...zs)+anchor[2]+7)};
    assert(site.x1-site.x0<=96&&site.z1-site.z0<=96,'site exceeds 96 m');
    let low=Infinity,high=-Infinity,samples=0;
    for(let z=site.z0;z<=site.z1;z+=4)for(let x=site.x0;x<=site.x1;x+=4){const g=world.geography(x,z),h=world.ground(x,z);assert(++samples<=1024&&h!==null&&!g.sea&&(g.water||0)<=g.height,'site is wet or survey cap exceeded');low=Math.min(low,h);high=Math.max(high,h);}
    assert(high-low<=6,'site cut/fill exceeds 6 m');const height=Math.ceil((low+high)/2/world.cell)*world.cell;anchor[1]=height;
    const district={revision:'city-world-exterior-1',id:`${city.seed}:${count}:${site.x0}:${site.z0}:${height}`, ...site,height,halo:8,closed:parcels.map(p=>({origin:[p.origin[0]+anchor[0],p.origin[1]+anchor[2]],right:p.right,inward:p.inward,width:p.width,depth:p.depth,projection:p.projection}))};
    const placed=parcels.map(p=>({...p,padY:0,roadY:0}));const first=placed[0],front=[first.origin[0]+first.right[0]*first.width/2-first.inward[0]*4+anchor[0],first.origin[1]+first.right[1]*first.width/2-first.inward[1]*4+anchor[2]];
    return {district,anchor,parcels:placed,spawn:{x:front[0],z:front[1]},yaw:Math.atan2(-first.inward[0],-first.inward[1]),samples,cutFill:high-low};
  }
  // Render-only v1: conservative CLOSED parcel collider, not a furnished high-resolution interior query.
  function closedAt(fixture,x,z,low,high,radius=.25){return fixture.parcels.some(p=>{const dx=x-fixture.anchor[0]-p.origin[0],dz=z-fixture.anchor[2]-p.origin[1],u=dx*p.right[0]+dz*p.right[1],v=dx*p.inward[0]+dz*p.inward[1];return u>-radius&&u<p.width+radius&&v>-(p.projection||0)-.5&&v<p.depth+radius&&high>fixture.anchor[1]&&low<fixture.anchor[1]+30;});}
  function sourceBytes(plan){const {w,d}=plan.plot,e=plan.roof.eave*4,margin=e+24,mz=margin+24,X=2*margin+w*8,Z=mz+d*8+margin,rise=Math.ceil(plan.roof.pitch*(Math.max(w,d)*8/2+e)*(1+plan.roof.curve*.1))+24,T=plan.roof.turret,Y=(3+4+plan.floors.length*48+Math.max(rise*(plan.roof.form==='gambrel'?1.35:1),T?T.rise+T.r*1.8+16:0)+24)|0;return X*Y*Z;}
  function create({renderer,fixture,engine='js',createWorker,onError=()=>{},worldId}){
    assert(['js','rust'].includes(engine),'unsupported engine');const worker=createWorker(),resident=new Map();let live=true,workerStopped=false,ready=false,pending=null,serial=0,gpuBytes=0,error=null,metrics=null,eye=null;
    const epoch=worldId+':'+fixture.district.id;
    function stopWorker(){if(!workerStopped){workerStopped=true;worker.terminate();}}
    function fail(e){error=String(e.message||e);ready=false;pending=null;stopWorker();onError(error);}
    function release(id){const r=resident.get(id);if(r){resident.delete(id);gpuBytes-=r.gpu.bytes;renderer.dispose(r.gpu);}}
    function pump(){if(!live||!ready||pending||!eye||error)return;
      const candidates=fixture.parcels.filter(p=>!resident.has(p.id)).map(p=>({p,d:Math.hypot(p.origin[0]+fixture.anchor[0]-eye.x,p.origin[1]+fixture.anchor[2]-eye.z)})).filter(p=>p.d<128).sort((a,b)=>a.d-b.d);
      const next=candidates[0];if(!next)return;pending={id:next.p.id,jobId:++serial};worker.postMessage({epoch,engine,worldId,jobId:serial,parcel:next.p,mode:'exterior',extent:0,sparse:false,includeNavigation:false});
    }
    worker.onmessage=({data:d})=>{if(!live||d.epoch!==epoch)return;if(d.type==='init-error'){fail(d.error);return;}if(d.type==='ready'){if(d.engine!==engine){fail('Building worker engine mismatch; no fallback.');return;}ready=true;pump();return;}
      if(!pending||d.jobId!==pending.jobId||d.id!==pending.id||d.worldId!==worldId)return;const id=pending.id;pending=null;
      if(d.error){fail(d.error);return;}
      try{assert(d.worldMesh?.kind==='building'&&d.engine===engine,'worker namespace/engine mismatch');const mesh=d.worldMesh;assert(mesh.buffer.byteLength<=LIMITS.reply&&gpuBytes+mesh.buffer.byteLength<=LIMITS.gpu,'building GPU/reply cap reached; retaining closed shells');const model=compose(mesh.model,fixture.anchor),gpu=renderer.upload(mesh);if(gpuBytes+gpu.bytes>LIMITS.gpu){renderer.dispose(gpu);throw new Error('City World: GPU cap exceeded');}resident.set(id,{gpu,model,bounds:bounds(mesh.bounds,model)});gpuBytes+=gpu.bytes;metrics=d.engineMetrics||null;}catch(e){fail(e);}pump();};
    worker.onerror=()=>{if(live&&!error)fail('Building worker failed; no engine fallback.');};worker.postMessage({type:'init',epoch,engine});
    return {update(p){if(!live)return;eye=p;for(const [id,r] of resident){const b=r.bounds,dist=Math.hypot(Math.max(b.lo[0]-p.x,0,p.x-b.hi[0]),Math.max(b.lo[2]-p.z,0,p.z-b.hi[2]));if(dist>160)release(id);}pump();},
      draw(origin){for(const r of resident.values()){const m=r.model,o=[m[12]-origin.x,m[13],m[14]-origin.z],P=4096;renderer.draw(r.gpu,o,[CELL,CELL,CELL],0,Math.atan2(m[8],m[0]),0,[0,0,0],[m[12]%P,m[13]%P,m[14]%P]);}},
      snapshot:()=>({ready,error,engine,count:fixture.parcels.length,loaded:resident.size,pending:!!pending,gpuBytes,gpuLimit:LIMITS.gpu,replyLimit:LIMITS.reply,sourceBytes:0,scratchLimit:LIMITS.scratch,enterable:false,collision:'conservative closed parcels',metrics,site:fixture.district,anchor:fixture.anchor,spawn:fixture.spawn,parcelIds:fixture.parcels.map(p=>p.id)}),
      dispose(){if(!live)return;live=false;stopWorker();pending=null;for(const id of resident.keys())release(id);eye=null;metrics=null;}};
  }
  const api={CELL,LIMITS,identity,rigid,compose,point,inverse,bounds,intersects,chunks,convert,select,place,closedAt,sourceBytes,create};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CityWorld=api;
  // Dedicated worker wrapper. The existing City worker still selects/executes its engine; only its mesh ABI is adapted.
  if(typeof importScripts==='function'&&typeof document==='undefined'){
    importScripts('city-worker.js');const handle=root.onmessage,post=root.postMessage.bind(root);let job=null;
    root.postMessage=(reply,transfer)=>{if(!reply.mesh){post(job?{...reply,worldId:job.worldId,jobId:job.jobId}:reply,transfer);return;}try{assert(reply.mesh.verts.byteLength+reply.mesh.idx.byteLength<=LIMITS.reply,'indexed reply exceeds byte cap');const worldMesh=convert(reply.mesh);post({...reply,mesh:null,worldMesh,worldId:job.worldId,jobId:job.jobId},[worldMesh.buffer]);}catch(e){post({epoch:reply.epoch,id:reply.id,engine:reply.engine,worldId:job.worldId,jobId:job.jobId,error:e.message});}};
    root.onmessage=e=>{if(e.data.type==='init')return handle(e);job=e.data;try{assert(job.mode==='exterior'&&!job.sparse&&!job.includeNavigation,'exterior-only adapter');const plan=root.BuildingPlan.generate(job.parcel.seed,job.parcel.options);assert(sourceBytes(plan)<=LIMITS.scratch,'dense scratch exceeds 64 MiB');return handle(e);}catch(error){post({epoch:job.epoch,id:job.parcel?.id,worldId:job.worldId,jobId:job.jobId,error:error.message});}};
  }
})(globalThis);
