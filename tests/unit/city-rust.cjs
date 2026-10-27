'use strict';
// CPU/ABI tests only: no browser, GL context, server or UI automation.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='../../prototypes/labs/',L=require(base+'city-lab/city-rust.js'),C=require(base+'city-lab/city-model.js'),G=require(base+'city-lab/city-geometry.js'),V=require(base+'building-lab/voxels.js'),P=require(base+'building-lab/plan.js'),R=require(base+'building-lab/renderer.js'),S=require(base+'city-lab/city-stream.js'),B=require(base+'building-lab/review.js');
const wasm=path.resolve(__dirname,base+'city-lab/wasm/city_lab_core.wasm');
function close(a,b,where='value'){
  if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<1e-6,where+': '+a+' != '+b);return;}
  if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),where);for(const k of Object.keys(a))close(a[k],b[k],where+'.'+k);return;}
  assert.equal(a,b,where);
}
// JSON metadata canonicalizes -0 to 0. Preserve exact nonzero model terms and
// every typed byte/field; only the sign of numeric zero is immaterial to a rigid transform.
function doorEqual(a,b){const canonical=m=>({...m,model:m.model.map(v=>v===0?0:v)});assert.deepEqual(canonical(a),canonical(b));}
(async()=>{
  assert.ok(fs.existsSync(wasm),'Build the real served WASM first: node tools/build-city-rust.cjs --test');
  await assert.rejects(L.load({url:wasm+'.missing'}),/ENOENT/);
  await assert.rejects(L.load({bytes:new Uint8Array([1,2,3])}),WebAssembly.CompileError);
  assert.throws(()=>L.createAdapter('rust'),{code:'NOT_READY'});assert.throws(()=>L.createAdapter('other'),{code:'INVALID_ENGINE'});
  const core=await L.load({url:wasm}),js=L.createAdapter('js');
  const forbidden=()=>{throw new Error('Selected Rust operation called a JS port target');};
  const rust=L.createAdapter('rust',core,{
    P,V,B:{...B,openDoors:forbidden},
    C:{...C,generate:forbidden,validate:forbidden},S:{...S,targets:forbidden,prefetch:forbidden},
    G:{...G,planMesh:forbidden,coarseMesh:forbidden,cityVolume:forbidden,doors:forbidden,model:forbidden},
    R:{meshSegment:forbidden},Q:{fromVolume:forbidden}
  });
  assert.equal(core.info.engine,'rust');assert.equal(core.info.geometryBudgetBytes,128*1024*1024);
  assert.deepEqual([...core.info.implemented].sort(),[...L.PORT_OPERATIONS].sort());
  const city=rust.generate(1,{});close(city,js.generate(1,{}));assert.deepEqual(rust.validate(city),C.validate(city));
  for(const terrain of ['flat','uneven']){
    const actual=rust.generate(0xffffffff,{layout:'grid',terrain,width:.75,count:24});close(actual,C.generate(0xffffffff,{layout:'grid',terrain,width:.75,count:24}));
  }
  let prior=new Map();for(const eye of [[0,5,0],[0,2,40],[200,80,200],[-10,3,-20]]){
    const a=rust.targets(city,eye,prior,'stream',null,{height:1080,fov:.62}),b=S.targets(city,eye,prior,'stream',null,{height:1080,fov:.62});
    close([...a],[...b]);assert.ok([...a.values()].every(t=>t.mode!=='full'));prior=a;
  }
  // New policy boundaries must also agree through the rebuilt served WASM,
  // both legacy JSON and cached compact records (native-only parity is not enough).
  for(const {input,expected} of require('./city-stream-buffer.cjs').matrix()){
    const a=core.call('stream.targets',input).meta.targets;
    close(a,expected,'legacy policy matrix');
    const previous=new Map(input.previous.map(({id,...t})=>[id,t]));
    const b=rust.targets(input.city,input.position,previous,input.mode,input.pinned,input.view);
    close([...b].map(([id,t])=>({id,...t})),expected,'compact policy matrix');
  }
  const requests=[],cached=L.createAdapter('rust',{...core,call(op,meta,buffers){if(op==='stream.targets')requests.push({meta,buffers});return core.call(op,meta,buffers);}});
  const initial=cached.targets(city,[0,2,0]),held=cached.targets(city,[0,2,0],initial);
  close([...initial],[...S.targets(city,[0,2,0])]);close([...held],[...S.targets(city,[0,2,0],initial)]);
  assert.ok(requests[0].meta.city,'city descriptor crosses only once');assert.equal(requests[1].meta.city,undefined);
  assert.ok(requests[1].buffers.previous instanceof Uint32Array);assert.equal(requests[1].buffers.previous.length,city.parcels.length*2);
  assert.equal(requests[1].meta.previous,undefined,'no full previous-target JSON');
  const independent=L.createAdapter('rust',core);
  for(let i=2;i<8;i++)independent.targets(C.generate(i,{}),[0,2,0]);
  const beforeRetry=requests.length,recovered=cached.targets(city,[2,2,0],held);
  close([...recovered],[...S.targets(city,[2,2,0],held)]);assert.equal(requests.length,beforeRetry+2,'bounded cache miss retries in Rust');
  assert.equal(requests.at(-2).meta.city,undefined);assert.ok(requests.at(-1).meta.city);
  const legacy=new Map([[0,{mode:'full',near:false,voxelSize:3,distance:2,projected:1}]]);
  close([...cached.targets(city,[0,2,0],legacy)],[...S.targets(city,[0,2,0],legacy)]);
  assert.ok(requests.at(-1).meta.previous,'unpackable legacy previous values stay on the Rust metadata path');
  assert.throws(()=>cached.targets(city,[0,2,0],new Map([[0,{mode:'low',near:false,voxelSize:1,distance:Infinity,projected:1}]])),{code:'INVALID_REQUEST'});
  const summaries={0:{entry:[0,0]},1:{entry:[10,0]}};
  for(const eye of [null,[0,2,11.99],[0,2,12],[0,2,17.99],[0,2,18],[9,2,0]])for(const current of [null,0,1])for(const inside of [false,true])assert.equal(rust.prefetch(eye,summaries,current,inside),S.prefetch(eye,summaries,current,inside));
  const parcel=city.parcels[0],retained=[];
  for(const [mode,sparse] of [['facade',false],['low',false],['exterior',false],['exterior',true],['full',false],['full',true]]){
    const request={epoch:7,parcel,mode,extent:city.extent,voxelSize:.5,includeNavigation:mode==='full',sparse};
    const a=rust.runJob(request),b=js.runJob(request);
    assert.equal(a.engine,'rust');assert.equal(b.engine,'js');assert.equal(a.epoch,7);assert.equal(a.id,parcel.id);assert.equal(a.mode,mode);
    for(const key of ['verts','idx'])assert.deepEqual(a.mesh[key],b.mesh[key],mode+' '+key);
    close(a.mesh.model,b.mesh.model);close(a.bounds,b.bounds);close(a.summary,b.summary);
    assert.equal(a.mesh.normals,undefined,'architecture remains hard shaded');
    if(a.ray){for(const key of ['coarse','bricks','pal'])assert.deepEqual(a.ray[key],b.ray[key],mode+' '+key);close({...a.ray,coarse:null,bricks:null,pal:null},{...b.ray,coarse:null,bricks:null,pal:null});}
    if(mode==='full'){
      exerciseDoor(parcel,a,city);
      assert.ok(a.walkData.building.vol.byteLength>0);assert.deepEqual(a.walkData.building.vol,b.walkData.building.vol);assert.ok(a.doorMesh.quads>0);
      for(const key of ['verts','idx'])assert.deepEqual(a.doorMesh[key],b.doorMesh[key]);
      assert.deepEqual(a.walkData.doors,b.walkData.doors);close(a.doorMesh.model,a.mesh.model);
    }else assert.equal(a.walkData,null,'initial exterior jobs never create interiors');
    assert.ok(a.engineMetrics.totalMs>=a.engineMetrics.sharedMs);assert.ok(a.engineMetrics.transport.executeMs>=0);
    if(['exterior','full'].includes(mode)){
      assert.deepEqual(a.engineMetrics.operations,{'geometry.prepare':1},'one real WASM dispatch, no fabricated dependent operation counts');
      assert.equal(a.engineMetrics.batchedGeometry,true);assert.ok(a.timings.batch>=a.engineMetrics.transport.totalMs);
      for(const key of ['prepare','mesh','sparse'])assert.equal(a.timings[key],0,'no fabricated native phase clock '+key);
      assert.equal(a.engineMetrics.transport.calls,1);
      assert.equal(a.engineMetrics.transport.inputBufferBytes,a.voxelBytes+(sparse?1024:0));
      assert.equal(a.engineMetrics.transport.copyOutBytes,0,'no full output-packet slice');
      assert.equal(a.engineMetrics.transport.decodeBufferCopyBytes,L.transferables(a).reduce((n,b)=>n+b.byteLength,0));
    }
    assert.equal(core.stats().liveAllocations,0);assert.equal(core.stats().liveBytes,0);
    const list=L.transferables(a);assert.equal(new Set(list).size,list.length);retained.push([a.mesh.verts,a.mesh.verts.slice()]);
  }
  // Arbitrarily rotated flat frame, not merely an axis-aligned parcel. Native
  // packet tests also compare these door/render transforms bit-for-bit to JS.
  for(const sparse of [false,true]){
    const p={...parcel,right:[-.6,.8],inward:[.8,.6]},request={epoch:8,parcel:p,mode:'full',extent:city.extent,includeNavigation:true,sparse};
    const a=rust.runJob(request),b=js.runJob(request);
    assert.deepEqual(a.mesh,b.mesh);assert.deepEqual(a.ray,b.ray);assert.deepEqual(a.walkData,b.walkData);assert.deepEqual(a.doorMesh,b.doorMesh);close(a.bounds,b.bounds);
    assert.deepEqual(a.engineMetrics.operations,{'geometry.prepare':1});
  }
  const uneven=rust.generate(1,{terrain:'uneven'});
  close(uneven.parcels.map(p=>[p.id,p.seed,p.origin,p.right,p.inward,p.options]),city.parcels.map(p=>[p.id,p.seed,p.origin,p.right,p.inward,p.options]),'terrain keeps XZ identity');
  for(const [mode,includeNavigation] of [['exterior',false],['full',false],['full',true]])for(const sparse of [false,true]){
    const p=uneven.parcels[0],request={epoch:8,parcel:p,mode,extent:uneven.extent,includeNavigation,sparse},a=rust.runJob(request),b=js.runJob(request);
    assert.deepEqual(a.mesh.verts,b.mesh.verts);assert.deepEqual(a.mesh.idx,b.mesh.idx);close(a.mesh.model,b.mesh.model);close(a.bounds,b.bounds);close(a.summary,b.summary);
    if(sparse){for(const k of ['coarse','bricks','pal'])assert.deepEqual(a.ray[k],b.ray[k]);close({...a.ray,coarse:null,bricks:null,pal:null},{...b.ray,coarse:null,bricks:null,pal:null});}
    if(includeNavigation){assert.deepEqual(a.walkData,b.walkData);doorEqual(a.doorMesh,b.doorMesh);exerciseDoor(p,a,uneven);}
    else {assert.equal(a.walkData,null);assert.equal(a.doorMesh,null);}
    assert.deepEqual(a.engineMetrics.operations,{'geometry.prepare':1});assert.equal(core.stats().liveBytes,0);
  }
  for(let i=0;i<20;i++){
    const repeated=rust.runJob({epoch:9,parcel,mode:i%2?'facade':'low',extent:city.extent});
    assert.equal(repeated.error,undefined);assert.equal(repeated.engine,'rust');
    assert.equal(repeated.engineMetrics.wasm.liveBytes,0);assert.equal(repeated.engineMetrics.wasm.liveAllocations,0);
  }
  const plan=P.generate(parcel.seed,parcel.options),before=rust.metrics().operations['geometry.facade'];
  const reference=G.planMesh(plan,parcel,city.extent,V.M);
  // runJob intentionally no longer dispatches doors/pack/mesh separately. Keep
  // real standalone ABI coverage explicit rather than inventing operation counts.
  const source=V.build(plan,{closedDoors:true}),legacyA={...source,vol:source.vol.slice()},legacyB={...source,vol:source.vol.slice()};
  const legacyModel=rust.prepare(plan,parcel,legacyA,false),jsModel=js.prepare(plan,parcel,legacyB,false);
  close(legacyModel,jsModel);assert.deepEqual(legacyA.vol,legacyB.vol);
  const entry=plan.floors[0].openings.find(o=>o.kind==='front'&&plan.floors[0].rooms[o.room]?.zone==='resident')||plan.floors[0].openings.find(o=>o.kind==='front');
  const leaves=source.info.doorLeaves.filter(l=>l.floor===0&&l.room===entry?.room);
  const doorsA=rust.doors(legacyA,leaves,legacyModel,'door:'+parcel.id),doorsB=js.doors(legacyB,leaves,jsModel,'door:'+parcel.id);
  doorEqual(doorsA.mesh,doorsB.mesh);assert.deepEqual({...doorsA,mesh:null},{...doorsB,mesh:null});
  const original=legacyA.vol.slice();rust.mesh(legacyA,legacyModel,'standalone');rust.sparse(legacyA,legacyModel);assert.deepEqual(legacyA.vol,original,'standalone extraction/mesh/packing does not open source');
  const tiny={cell:.0625,dims:[5,5,5],origin:[0,0,0],levels:[],plate:0,M:V.M,palette:V.palette(),vol:Uint8Array.from({length:125},(_,i)=>i%11===0?V.M.glass:i%7===0?V.M.door_wood:0)},model=[1,0,0,0,0,1,0,0,0,0,1,0,-2,3,4,1];
  const expected=R.meshSegment(tiny.vol,tiny.dims,0,5);
  for(let i=0;i<100;i++){
    const a=rust.mesh(tiny,model,'repeat');assert.deepEqual(a.verts,expected.verts);assert.deepEqual(a.idx,expected.idx);
    const ray=rust.sparse(tiny,model);assert.ok(ray.bytes>0);
    if(i<5)assert.deepEqual(rust.facade(plan,parcel,city.extent).verts,reference.verts);
    assert.throws(()=>core.call('geometry.coarse',{}),{code:'INVALID_REQUEST'});
    assert.equal(core.stats().liveBytes,0);assert.equal(core.stats().liveAllocations,0);
  }
  assert.equal(rust.metrics().operations['geometry.facade'],before+5);
  for(const [a,b] of retained)assert.deepEqual(a,b,'owned results survive repeated calls and memory growth');
  for(const op of L.PORT_OPERATIONS)assert.ok(rust.metrics().operations[op]>0,'actual native dispatch '+op);
  console.log('Real served WASM: all 10 standalone operations; single-call dense jobs; exact JS exterior/full sparse+mesh, collision and selected doors; flat then uneven; explicit standalone parity; 100 repeat mesh+sparse cycles; zero live ABI allocations.');
  core.dispose();assert.throws(()=>rust.generate(1,{}),{code:'DISPOSED'});
})().catch(e=>{console.error(e);process.exitCode=1;});
function exerciseDoor(parcel,result,city){
  parcel.entry=result.summary.entry;
  const walk=require(base+'city-lab/city-walk.js').create(parcel,result.walkData,city),outside=parcel.entry.map((v,i)=>v-parcel.inward[i]*1.5);
  const eye=[outside[0],G.walkHeight(city,...outside)+1.6,outside[1]];assert.ok(walk.place(eye));close(walk.snapshot().eye,eye,'no activation teleport');
  function move(n,sign=1){for(let i=0;i<n;i++){const before=walk.snapshot().position;walk.move(...parcel.inward.map(v=>v*.05*sign));const after=walk.snapshot().position;assert.ok(Math.hypot(after[0]-before[0],after[2]-before[2])<.051,'no threshold teleport');}}
  move(60);assert.equal(walk.snapshot().room,'Outside','closed native door blocks entry');
  const calls=result.engineMetrics.operations;walk.setDoorOpen(true);move(50);assert.notEqual(walk.snapshot().room,'Outside','physical entry through native door');
  assert.ok(walk.canCloseDoor());walk.setDoorOpen(false);move(70,-1);assert.notEqual(walk.snapshot().room,'Outside','closed native door blocks exit');
  walk.setDoorOpen(true);move(70,-1);assert.equal(walk.snapshot().room,'Outside','physical exit through native door');
  move(70);assert.notEqual(walk.snapshot().room,'Outside','cached re-entry through native door without rebuilding');
  assert.deepEqual(result.engineMetrics.operations,calls,'door changes use ready payload, not full jobs');
}
