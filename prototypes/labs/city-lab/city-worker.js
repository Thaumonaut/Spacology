importScripts('../building-lab/plan.js','../building-lab/kit-pieces.js','../building-lab/voxels.js','../building-lab/renderer.js','../building-lab/review.js','city-model.js','city-geometry.js','city-stream.js','city-sparse.js','city-rust.js');
let cityAdapter=null,cityInit=null,cityEpoch=null,cityEngine='js';
self.onmessage=({data})=>{
  if(data.type==='init'){
    const {epoch,engine='js',wasmURL}=data;cityEpoch=epoch;cityEngine=engine;cityAdapter?.core?.dispose();cityAdapter=null;
    const started=performance.now();
    cityInit=(async()=>{
      const core=engine==='rust'?await CityRust.load({url:wasmURL}):null;
      if(cityEpoch!==epoch){core?.dispose();return;}
      cityAdapter=CityRust.createAdapter(engine,core);
      self.postMessage({type:'ready',epoch,engine,init:{totalMs:performance.now()-started,load:core?.loadTimings||null,wasm:core?.stats()||null}});
    })().catch(e=>{if(cityEpoch===epoch)self.postMessage({type:'init-error',epoch,engine,error:String(e.message||e),code:e.code||'INIT_FAILED'});});
    return cityInit;
  }
  if(cityInit){
    // The main thread waits for ready. Early/mismatched jobs are explicit errors,
    // not queued under a different engine or silently computed in JavaScript.
    const {epoch,parcel,mode}=data;
    if(epoch!==cityEpoch)return;
    try{
      if(!cityAdapter)throw new Error('Selected city engine is not ready. No JavaScript fallback.');
      if(data.engine!==cityEngine)throw new Error('Worker engine mismatch');
      const reply=cityAdapter.runJob(data),transfer=CityRust.transferables(reply);reply.engineMetrics.transferBufferBytes=transfer.reduce((n,b)=>n+b.byteLength,0);self.postMessage(reply,transfer);
    }catch(e){self.postMessage({epoch,engine:cityEngine,id:parcel?.id,mode,error:String(e.message||e),code:e.code||'JOB_FAILED'});}return;
  }
  const {epoch,parcel,mode,extent,voxelSize=1,includeNavigation=false,sparse=false}=data;
  if(data.engine==='rust'){self.postMessage({epoch,engine:'rust',id:parcel?.id,mode,error:'Rust worker requires explicit initialization. No JavaScript fallback.'});return;}
  // Legacy JS-only direct jobs remain compatible with existing CPU unit fixtures.
  try{
  const t=performance.now(),plan=BuildingPlan.generate(parcel.seed,parcel.options),p=performance.now();let b,m,box,prepared,built=p,bytes=0,walkData=null,ray=null,entryPoint=null,doorMesh=null,doorData=null;
  const entry=plan.floors[0].openings.find(o=>o.kind==='front'&&plan.floors[0].rooms[o.room]?.zone==='resident')||plan.floors[0].openings.find(o=>o.kind==='front'),front=plan.plot.front*plan.cell;
  entryPoint=entry?CityModel.point(parcel,(entry.cells.reduce((v,c)=>v+c[0],0)/entry.cells.length+.5)*plan.cell,(entry.cells.reduce((v,c)=>v+c[1],0)/entry.cells.length+.5)*plan.cell-front):null;
  if(mode==='full'||mode==='exterior'){
    b=BuildingVoxels.build(plan,{exterior:mode==='exterior',closedDoors:true});built=performance.now();bytes=b.vol.byteLength;CityGeometry.cityVolume(plan,b,mode==='exterior');
    if(mode==='full'){
      if(includeNavigation){const doors=CityGeometry.doors(b,b.info.doorLeaves.filter(l=>l.floor===0&&l.room===entry?.room));doorMesh={...doors.mesh,id:'door:'+parcel.id};doorData={indices:doors.indices,materials:doors.materials,boxes:doors.boxes};}
      b=BuildingReview.openDoors(b);
    }
    prepared=performance.now();const model=CityGeometry.model(parcel,b);
    if(doorMesh)doorMesh.model=model;
    if(sparse){
      ray=CitySparse.fromVolume(b,model);m={verts:new Uint16Array(0),idx:new Uint32Array(0),quads:0};box=CityGeometry.bounds({verts:Uint16Array.from([...ray.lo,0,...ray.hi,0])},b);
    }else{m=BuildingRenderer.meshSegment(b.vol,b.dims,0,b.dims[1]);box=CityGeometry.bounds(m,b);}
    m.id='building:'+parcel.id;m.model=model;
    if(mode==='full'&&includeNavigation)walkData={plan,building:{cell:b.cell,dims:b.dims,origin:b.origin,levels:b.levels,plate:b.plate,vol:b.vol,M:b.M,info:{doorLeaves:[]}},doors:doorData,entry:entryPoint};
  }else{
    prepared=p;m=mode==='facade'?CityGeometry.planMesh(plan,parcel,extent,BuildingVoxels.M):CityGeometry.coarseMesh(plan,parcel,extent,BuildingVoxels.M,voxelSize);bytes=m.voxelBytes||0;box=CityGeometry.planBounds(m,parcel,extent);
  }
  const elapsed=performance.now()-prepared,timings={plan:p-t,voxels:built-p,prepare:prepared-built,mesh:mode==='facade'||mode==='exterior'&&!ray||mode==='full'&&!ray?elapsed:0,coarse:mode==='low'?elapsed:0,sparse:ray?elapsed:0};
  const windowBays=Math.max(...plan.floors.slice(1).map(f=>f.openings.filter(o=>o.side==='zm'&&['window','small','bay'].includes(o.kind)).length));
  self.postMessage({epoch,id:parcel.id,mode,voxelSize,mesh:m,ray,doorMesh,walkData,timings,voxelBytes:bytes,bounds:box,summary:{entry:entryPoint,typology:plan.typology,storeys:plan.floors.length,projection:plan.plot.front*plan.cell,windowBays,footprint:CityModel.footprint(plan),rooms:plan.floors.reduce((s,f)=>s+f.rooms.filter(r=>r.cells).length-1,0),plot:[plan.plot.w*plan.cell,(plan.plot.d-plan.plot.front)*plan.cell],candidate:plan.candidate}},[m.verts.buffer,m.idx.buffer,...(ray?[ray.coarse.buffer,ray.bricks.buffer,ray.pal.buffer]:[]),...(walkData?[b.vol.buffer,doorData.indices.buffer,doorData.materials.buffer]:[]),...(doorMesh?[doorMesh.verts.buffer,doorMesh.idx.buffer]:[])]);
}catch(e){self.postMessage({epoch,id:parcel.id,mode,error:String(e.message||e)});}};
