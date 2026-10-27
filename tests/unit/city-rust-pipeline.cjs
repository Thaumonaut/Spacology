'use strict';
// CPU contract tests only. The core below is an explicitly synthetic transport
// fixture, NOT a Rust implementation or a WASM parity/performance result. Native
// packet tests in geometry.rs test the real algorithms; city-rust.cjs tests the
// rebuilt served WASM during final integration.
const assert=require('node:assert/strict');
const base='../../prototypes/labs/';
const L=require(base+'city-lab/city-rust.js'),C=require(base+'city-lab/city-model.js'),G=require(base+'city-lab/city-geometry.js');
const P=require(base+'building-lab/plan.js'),V=require(base+'building-lab/voxels.js'),B=require(base+'building-lab/review.js');
const fail=()=>{throw new Error('Rust runJob called a forbidden JS port/openDoors target');};
const js=L.createAdapter('js');
let cases=0;
for(const terrain of ['flat','uneven']){
  const city=C.generate(2,{terrain}),parcel={...city.parcels[12],right:[-.6,.8],inward:[.8,.6]};
  for(const [mode,includeNavigation] of [['exterior',false],['full',false],['full',true]])for(const sparse of [false,true]){
    const request={epoch:5,parcel,mode,includeNavigation,sparse,extent:city.extent};
    const expected=js.runJob(request),plan=P.generate(parcel.seed,parcel.options);
    let calls=0,source=null,original=null,sourceArray=null;
    const core={
      requireOperations(ops){assert.deepEqual(ops,L.PORT_OPERATIONS);},
      stats(){return {liveBytes:0,liveAllocations:0,memoryBytes:0};},
      call(op,meta,buffers){
        calls++;assert.equal(op,'geometry.prepare');assert.equal(meta.exterior,mode==='exterior');
        assert.equal(meta.batch.render,sparse?'sparse':'mesh');assert.equal(meta.batch.navigation,includeNavigation);
        assert.equal(buffers.vol,source.vol,'one source buffer, no JS intermediate clone');
        assert.deepEqual(buffers.vol,original,'source stays closed before native batch');
        assert.deepEqual(Object.keys(buffers).sort(),sparse?['palette','vol']:['vol']);
        if(sparse)assert.equal(buffers.palette,source.palette);
        const all=mode==='full'?source.info.doorLeaves:[];
        assert.deepEqual(meta.batch.leaves,all,'all recorded leaves are opened for full rendering');
        const entry=plan.floors[0].openings.find(o=>o.kind==='front'&&plan.floors[0].rooms[o.room]?.zone==='resident')||plan.floors[0].openings.find(o=>o.kind==='front');
        assert.deepEqual(meta.batch.selectedLeaves,includeNavigation?all.filter(l=>l.floor===0&&l.room===entry?.room):[]);
        const out={};
        if(sparse)for(const k of ['coarse','bricks','pal'])out[k]=expected.ray[k].slice();
        else for(const k of ['verts','idx'])out[k]=expected.mesh[k].slice();
        if(includeNavigation){
          out.vol=expected.walkData.building.vol.slice();
          out.doorVerts=expected.doorMesh.verts.slice();out.doorIdx=expected.doorMesh.idx.slice();
          out.doorIndices=expected.walkData.doors.indices.slice();out.doorMaterials=expected.walkData.doors.materials.slice();
        }
        const render={...(sparse?expected.ray:expected.mesh)};
        for(const k of sparse?['coarse','bricks','pal']:['verts','idx'])delete render[k];
        const doorMesh=includeNavigation?{quads:expected.doorMesh.quads,model:expected.doorMesh.model,id:expected.doorMesh.id}:null;
        return {meta:{batched:true,volume:{...meta.volume,cityFront:plan.plot.front*plan.cell},model:expected.mesh.model,bounds:expected.bounds,
          mesh:sparse?null:render,ray:sparse?render:null,doorMesh,boxes:includeNavigation?expected.walkData.doors.boxes:null},buffers:out,timings:{}};
      }
    };
    const shared={P,V:{...V,build(p,opts){source=V.build(p,opts);sourceArray=source.vol;original=source.vol.slice();return source;}},B:{...B,openDoors:fail},
      C,G:{...G,cityVolume:fail,doors:fail,model:fail,planMesh:fail,coarseMesh:fail},R:{meshSegment:fail},Q:{fromVolume:fail},S:{}};
    const rust=L.createAdapter('rust',core,shared),actual=rust.runJob(request);
    assert.equal(calls,1);assert.deepEqual(actual.engineMetrics.operations,{'geometry.prepare':1});
    assert.equal(actual.engineMetrics.batchedGeometry,true);assert.equal(actual.engine,'rust');
    for(const k of ['mesh','ray','doorMesh','walkData','bounds','summary','voxelBytes'])assert.deepEqual(actual[k],expected[k],terrain+'/'+mode+'/'+sparse+'/'+k);
    assert.deepEqual(sourceArray,original,'adapter never mutates shared closed source');
    assert.notEqual(source.vol,sourceArray,'source dense reference released or replaced by collision result');
    if(!includeNavigation)assert.equal(source.vol,null);
    for(const k of ['prepare','mesh','sparse'])assert.equal(actual.timings[k],0,'no invented per-native-phase timings');
    assert.ok(actual.timings.batch>=0);assert.ok(actual.engineMetrics.totalMs>=actual.engineMetrics.sharedMs);
    const list=L.transferables(actual);assert.equal(list.length,new Set(list).size);
    if(includeNavigation)assert.ok(list.includes(actual.walkData.building.vol.buffer));
    else assert.ok(!list.includes(sourceArray.buffer),'exterior/full-without-nav source not transferred/retained');
    cases++;
  }
}
// Stale assets and Rust errors are visible, never a legacy/JS fallback. Synthetic
// cores intentionally do not pretend these are successful native operations.
const city=C.generate(1,{}),request={parcel:city.parcels[0],mode:'exterior',extent:city.extent};
for(const call of [()=>({meta:{volume:{}},buffers:{},timings:{}}),()=>{throw Object.assign(new Error('native batch failure'),{code:'INVALID_REQUEST'});}]){
  const core={requireOperations(){},stats(){return {};},call};
  assert.throws(()=>L.createAdapter('rust',core).runJob(request),e=>['ABI_MISMATCH','INVALID_REQUEST'].includes(e.code));
}
// Exercise the real loader's output ownership/copy accounting with core.echo on
// the existing asset. No build is triggered; the batch ABI is tested natively
// above, not falsely certified against this deliberately potentially stale WASM.
(async()=>{
  const core=await L.load({requiredOps:[]});
  try{
    const source=Uint8Array.of(2,5,7,11,13),vol=source.subarray(1,4),verts=Uint16Array.of(7,65535),reply=core.call('core.echo',{}, {vol,verts});
    assert.deepEqual(reply.buffers.vol,vol);assert.deepEqual(reply.buffers.verts,verts);
    assert.equal(reply.transport.calls,1);assert.equal(reply.transport.inputBufferBytes,7);assert.equal(reply.transport.outputBufferBytes,7);
    assert.equal(reply.transport.copyOutBytes,0);assert.equal(reply.transport.decodeBufferCopyBytes,7);
    assert.equal(reply.transport.encodeBufferCopyBytes,7);assert.equal(reply.transport.copyInBytes,reply.transport.inputBytes);
    assert.ok(reply.transport.inputBytes>=7);assert.ok(reply.transport.outputBytes>=7);
    for(let i=0;i<10;i++)core.call('core.echo',{}, {vol:new Uint8Array(1024*1024)});
    source.fill(0);assert.deepEqual(reply.buffers.vol,Uint8Array.of(5,7,11));
    assert.equal(core.stats().liveAllocations,0);assert.equal(core.stats().liveBytes,0);
  }finally{core.dispose();}
  console.log(`${cases} synthetic one-call bridge cases: flat then uneven, rotated frames, sparse/mesh, exterior/full/nav; no JS port fallback; real existing-WASM echo ownership/copy counters. Batch served-WASM parity awaits final integration build.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
