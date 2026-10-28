(function(root){
  'use strict';
  const node=typeof module==='object'&&!!module.exports;
  const ABI_VERSION=1,MAX_PACKET=256*1024*1024,MAX_JSON=16*1024*1024,MAX_BUFFERS=128;
  const PORT_OPERATIONS=Object.freeze(['city.generate','city.validate','stream.targets','stream.prefetch','geometry.facade','geometry.coarse','geometry.prepare','geometry.doors','mesh.segment','sparse.pack']);
  let nextCityId=0;
  const types={u8:Uint8Array,u16:Uint16Array,u32:Uint32Array,i32:Int32Array,f32:Float32Array};
  const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true}),align8=n=>Math.ceil(n/8)*8;
  const littleEndian=new Uint8Array(new Uint16Array([1]).buffer)[0]===1;
  const defaultURL=node?null:new URL('wasm/city_lab_core.wasm',typeof document==='object'&&document.currentScript?document.currentScript.src:root.location.href).href;
  function error(code,message){return Object.assign(new Error(message),{code});}
  function ensure(condition,message){if(!condition)throw error('INVALID_PACKET',message);}
  const modes=['low','facade','exterior'],voxelSizes=[.5,1,2];
  function packedPrevious(previous){
    const bytes=new Uint32Array(previous.size*2);let i=0;
    for(const [id,t] of previous){
      const mode=modes.indexOf(t.mode),size=voxelSizes.indexOf(t.voxelSize);
      if(!Number.isInteger(id)||id<0||id>0xffffffff||mode<0||size<0||typeof t.near!=='boolean'||!Number.isFinite(t.distance)||!Number.isFinite(t.projected))return null;
      bytes[i++]=id;bytes[i++]=mode|(t.near?4:0)|(size<<3);
    }
    return bytes;
  }
  function packedTargets(reply){
    const {count,stride}=reply.meta,bytes=reply.buffers.targets;
    ensure(Number.isSafeInteger(count)&&count>=0&&stride===24&&bytes instanceof Uint8Array&&bytes.byteLength===count*stride,'Invalid compact targets');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),result=new Map();
    for(let i=0;i<count;i++){
      const p=i*stride,id=view.getUint32(p,true),flags=view.getUint32(p+4,true),mode=modes[flags&3],voxelSize=voxelSizes[flags>>>3],distance=view.getFloat64(p+8,true),projected=view.getFloat64(p+16,true);
      ensure(mode&&voxelSize&&Number.isFinite(distance)&&Number.isFinite(projected)&&!result.has(id),'Invalid packed target');
      result.set(id,{mode,near:!!(flags&4),voxelSize,distance,projected});
    }
    return result;
  }
  function stringify(value){return JSON.stringify(value,(_key,v)=>{
    if(typeof v==='number'&&!Number.isFinite(v))throw error('INVALID_REQUEST','Non-finite JSON metadata');
    if(ArrayBuffer.isView(v)||v instanceof ArrayBuffer)throw error('INVALID_REQUEST','Put typed arrays in buffers, not JSON metadata');
    return v;
  });}
  function encodePacket(op,meta={},buffers={}){
    ensure(typeof op==='string'&&op.length>0,'Missing operation');
    const entries=Object.entries(buffers),descriptors=[];let length=0;
    ensure(entries.length<=MAX_BUFFERS,'Too many buffers');
    for(const [name,array] of entries){
      const kind=Object.keys(types).find(k=>array instanceof types[k]&&array.constructor===types[k]);
      ensure(name.length>0&&kind,'Named Uint8/16/32, Int32 or Float32 buffers required');
      length=align8(length);descriptors.push({name,kind,offset:length,length:array.length});length+=array.byteLength;
      ensure(Number.isSafeInteger(length)&&length<=MAX_PACKET,'Payload exceeds ABI cap');
    }
    const json=encoder.encode(stringify({abi:ABI_VERSION,op,meta,buffers:descriptors})),start=align8(4+json.length);
    ensure(json.length<=MAX_JSON&&start+length<=MAX_PACKET,'Packet exceeds ABI cap');
    const packet=new Uint8Array(start+length),view=new DataView(packet.buffer);view.setUint32(0,json.length,true);packet.set(json,4);
    entries.forEach(([,array],i)=>{
      const d=descriptors[i],width=types[d.kind].BYTES_PER_ELEMENT;
      if(littleEndian||width===1)packet.set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),start+d.offset);
      else for(let j=0;j<array.length;j++)view[{u16:'setUint16',u32:'setUint32',i32:'setInt32',f32:'setFloat32'}[d.kind]](start+d.offset+j*width,array[j],true);
    });
    return packet;
  }
  function decodePacket(packet){
    ensure(packet instanceof Uint8Array&&packet.byteLength>=4&&packet.byteLength<=MAX_PACKET,'Invalid packet size');
    const view=new DataView(packet.buffer,packet.byteOffset,packet.byteLength),length=view.getUint32(0,true),start=align8(4+length);
    ensure(length<=MAX_JSON&&start<=packet.length,'Invalid JSON length/padding');
    const header=JSON.parse(decoder.decode(packet.subarray(4,4+length)));
    if(header.abi!==ABI_VERSION)throw error('ABI_MISMATCH','City Rust ABI version must be 1');
    ensure(Array.isArray(header.buffers)&&header.buffers.length<=MAX_BUFFERS,'Invalid buffer descriptors');
    const buffers=Object.create(null),ranges=[],names=new Set();
    for(const d of header.buffers){
      ensure(typeof d.name==='string'&&d.name.length>0&&!names.has(d.name)&&Object.hasOwn(types,d.kind),'Duplicate/invalid typed buffer');names.add(d.name);
      const Type=types[d.kind],width=Type.BYTES_PER_ELEMENT,bytes=d.length*width,end=d.offset+bytes;
      ensure(Number.isSafeInteger(d.offset)&&d.offset>=0&&d.offset%width===0&&Number.isSafeInteger(d.length)&&d.length>=0&&Number.isSafeInteger(end)&&end<=packet.length-start,'Invalid buffer bounds/alignment');
      if(bytes)ranges.push([d.offset,end]);
    }
    ranges.sort((a,b)=>a[0]-b[0]);ensure(!ranges.some((r,i)=>i&&ranges[i-1][1]>r[0]),'Overlapping buffers');
    // Validate every descriptor before copying any payload.
    for(const d of header.buffers){
      const Type=types[d.kind],width=Type.BYTES_PER_ELEMENT,end=d.offset+d.length*width;
      // Own every result: it survives city_free and can be transferred out of a worker.
      const copy=packet.slice(start+d.offset,start+end);
      if(littleEndian||width===1)buffers[d.name]=new Type(copy.buffer,copy.byteOffset,d.length);
      else {const a=new Type(d.length);for(let i=0;i<a.length;i++)a[i]=view[{u16:'getUint16',u32:'getUint32',i32:'getInt32',f32:'getFloat32'}[d.kind]](start+d.offset+i*width,true);buffers[d.name]=a;}
    }
    if(header.ok===false&&header.error&&typeof header.error.code==='string')throw error(header.error.code,header.error.message);
    ensure(header.ok===true&&!header.error,'Malformed response');
    return {meta:header.meta,buffers};
  }
  async function load({url,bytes,requiredOps=PORT_OPERATIONS}={}){
    const started=performance.now();let source=bytes;
    if(!source){
      if(node){const fs=require('node:fs/promises'),path=require('node:path');source=await fs.readFile(url||path.join(__dirname,'wasm','city_lab_core.wasm'));}
      else {const response=await fetch(url||defaultURL);if(!response.ok)throw error('LOAD_FAILED',`City Rust WASM HTTP ${response.status}`);source=await response.arrayBuffer();}
    }
    const read=performance.now(),compiled=await WebAssembly.compile(source),compile=performance.now();
    if(WebAssembly.Module.imports(compiled).length)throw error('ABI_MISMATCH','City Rust must not require JavaScript callbacks/imports');
    const instance=await WebAssembly.instantiate(compiled,{}),instantiated=performance.now();let wasm=instance.exports;
    for(const name of ['city_abi_version','city_alloc','city_buffer_ptr','city_buffer_len','city_run','city_free','city_live_bytes','city_live_allocations'])
      if(typeof wasm[name]!=='function')throw error('ABI_MISMATCH',`Missing WASM export ${name}`);
    if(!(wasm.memory instanceof WebAssembly.Memory)||wasm.city_abi_version()!==ABI_VERSION)throw error('ABI_MISMATCH','Incompatible City Rust memory/ABI');
    function call(op,meta={},buffers={}){
      if(!wasm)throw error('DISPOSED','City Rust engine disposed');
      const start=performance.now(),packet=encodePacket(op,meta,buffers),encoded=performance.now();let input=0,output=0;
      try{
        input=wasm.city_alloc(packet.length);if(!input)throw error('ALLOCATION_FAILED','WASM input allocation failed');
        const ptr=wasm.city_buffer_ptr(input)>>>0;
        ensure(ptr>0&&wasm.city_buffer_len(input)===packet.length,'Invalid input allocation');
        new Uint8Array(wasm.memory.buffer,ptr,packet.length).set(packet);const copiedIn=performance.now();
        output=wasm.city_run(input);const executed=performance.now();if(!output)throw error('ALLOCATION_FAILED','WASM operation/result allocation failed');
        const outPtr=wasm.city_buffer_ptr(output)>>>0,outLength=wasm.city_buffer_len(output)>>>0;
        ensure(outPtr>0&&outLength>0&&outLength<=MAX_PACKET,'Invalid result allocation');
        // memory.buffer may have grown during city_run; never retain old views.
        // Decode synchronously from the current memory view. decodePacket owns
        // every returned buffer before finally frees the handles; a whole-packet
        // JS slice here only duplicated those same bytes a second time.
        const result=new Uint8Array(wasm.memory.buffer,outPtr,outLength),copiedOut=performance.now();
        const reply=decodePacket(result),decoded=performance.now();
        const inputBufferBytes=Object.values(buffers).reduce((n,a)=>n+a.byteLength,0),outputBufferBytes=Object.values(reply.buffers).reduce((n,a)=>n+a.byteLength,0);
        return {...reply,timings:{encodeMs:encoded-start,copyInMs:copiedIn-encoded,executeMs:executed-copiedIn,copyOutMs:copiedOut-executed,decodeMs:decoded-copiedOut,totalMs:decoded-start},
          // JS-visible transport only, not Rust allocator/internal-copy counts.
          // copyOutMs now measures view setup; owned output copies are decodeMs.
          transport:{calls:1,inputBytes:packet.length,outputBytes:outLength,inputBufferBytes,outputBufferBytes,encodeBufferCopyBytes:inputBufferBytes,copyInBytes:packet.length,copyOutBytes:0,decodeBufferCopyBytes:outputBufferBytes}};
      }finally{if(output)wasm.city_free(output);if(input)wasm.city_free(input);}
    }
    const info=call('core.info').meta;
    function requireOperations(operations){const missing=operations.filter(op=>!info.implemented.includes(op));if(missing.length)throw error('NOT_IMPLEMENTED',`Selected Rust engine is incomplete: ${missing.join(', ')}. No JavaScript fallback.`);}
    requireOperations(requiredOps);
    const ready=performance.now();
    return {call,info,requireOperations,
      loadTimings:{readMs:read-started,compileMs:compile-read,instantiateMs:instantiated-compile,initMs:ready-instantiated,totalMs:ready-started},
      stats(){if(!wasm)throw error('DISPOSED','City Rust engine disposed');return {liveBytes:wasm.city_live_bytes(),liveAllocations:wasm.city_live_allocations(),memoryBytes:wasm.memory.buffer.byteLength};},
      dispose(){wasm=null;}
    };
  }
  // The same adapter is usable in a classic browser script, worker and Node. All
  // selected Rust operations cross the ABI; shared helpers are explicitly timed.
  function createAdapter(engine='js',core=null,shared=null){
    if(!['js','rust'].includes(engine))throw error('INVALID_ENGINE',`Unknown city engine ${engine}`);
    if(engine==='rust'){if(!core)throw error('NOT_READY','Rust core is not loaded. No JavaScript fallback.');core.requireOperations(PORT_OPERATIONS);}
    const D=shared||(node?{
      P:require('../building-lab/plan.js'),V:require('../building-lab/voxels.js'),R:require('../building-lab/renderer.js'),B:require('../building-lab/review.js'),
      C:require('./city-model.js'),G:require('./city-geometry.js'),S:require('./city-stream.js'),Q:require('./city-sparse.js')
    }:{P:root.BuildingPlan,V:root.BuildingVoxels,R:root.BuildingRenderer,B:root.BuildingReview,C:root.CityModel,G:root.CityGeometry,S:root.CityStream,Q:root.CitySparse});
    const {P,V,R,B,C,G,S,Q}=D,operations={},cities=new WeakMap();let transport={},jobOperations=null;
    function call(op,meta,buffers){
      const r=core.call(op,meta,buffers);operations[op]=(operations[op]||0)+1;
      if(jobOperations)jobOperations[op]=(jobOperations[op]||0)+1;
      for(const [k,v] of Object.entries(r.timings))transport[k]=(transport[k]||0)+v;
      for(const [k,v] of Object.entries(r.transport||{}))transport[k]=(transport[k]||0)+v;
      return r;
    }
    const mesh=r=>({...r.meta,...r.buffers});
    const spec=b=>({dims:b.dims,cell:b.cell,origin:b.origin,levels:b.levels||[],plate:b.plate||0,cityFront:b.cityFront||0,M:b.M});
    const adapter={engine,core,
      generate(seed,options){return engine==='rust'?call('city.generate',{seed:Number(seed)>>>0,options}).meta:C.generate(seed,options);},
      validate(city){return engine==='rust'?call('city.validate',{city}).meta.errors:C.validate(city);},
      targets(city,position,previous=new Map(),mode='stream',pinned=null,view={}){
        if(engine==='js')return S.targets(city,position,previous,mode,pinned,view);
        let cityId=cities.get(city),first=cityId===undefined;
        if(first){cityId=++nextCityId;if(cityId>0xffffffff)throw error('BUDGET_EXCEEDED','City cache IDs exhausted');}
        const packed=packedPrevious(previous),buffers=packed?{previous:packed}:{};
        const input={cityId,position,compact:true,mode,pinned,view};
        if(!packed)input.previous=[...previous].map(([id,t])=>({id,...t}));
        if(first)input.city={parcels:city.parcels};
        let result;
        try{result=call('stream.targets',input,buffers);}catch(e){
          if(e.code!=='UNKNOWN_CITY'||first)throw e;
          result=call('stream.targets',{...input,city:{parcels:city.parcels}},buffers);
        }
        cities.set(city,cityId);
        return packedTargets(result);
      },
      prefetch(position,summaries,current=null,inside=false){return engine==='rust'?call('stream.prefetch',{position,summaries:Object.entries(summaries).map(([id,s])=>({id:Number(id),entry:s.entry||null})),current,inside}).meta.id:S.prefetch(position,summaries,current,inside);},
      facade(plan,parcel,extent,voxelSize=1,coarse=false){
        if(engine==='js')return coarse?G.coarseMesh(plan,parcel,extent,V.M,voxelSize):G.planMesh(plan,parcel,extent,V.M);
        const t=performance.now(),{w,d,masks}=plan.plot;
        const input={plan,parcel,extent,M:V.M,voxelSize,
          spans:coarse?[]:masks.map((_,f)=>P.facadeSpans(plan.plot,f,plan.facade.bays)),
          rectangles:coarse?[]:masks.map(m=>V.decompose(m,w,d)),
          roofRectangles:coarse?[]:masks.map((m,f)=>V.decompose(m.map((v,i)=>v&&!masks[f+1]?.[i]?1:0),w,d))};
        adapter.sharedGeometryInputMs+=performance.now()-t;
        return mesh(call(coarse?'geometry.coarse':'geometry.facade',input));
      },
      prepare(plan,parcel,b,exterior){
        if(engine==='js'){G.cityVolume(plan,b,exterior);return G.model(parcel,b);}
        const r=call('geometry.prepare',{plan,parcel,volume:spec(b),exterior},{vol:b.vol});Object.assign(b,r.meta.volume,{vol:r.buffers.vol});return r.meta.model;
      },
      doors(b,leaves,model,id){
        if(engine==='js'){const r=G.doors(b,leaves);Object.assign(r.mesh,{model,id});return r;}
        const r=call('geometry.doors',{volume:spec(b),leaves,model,id},{vol:b.vol});return {mesh:{...r.meta.mesh,verts:r.buffers.verts,idx:r.buffers.idx},boxes:r.meta.boxes,indices:r.buffers.indices,materials:r.buffers.materials};
      },
      mesh(b,model,id){return engine==='rust'?mesh(call('mesh.segment',{volume:spec(b),y0:0,y1:b.dims[1],model,id},{vol:b.vol})):{...R.meshSegment(b.vol,b.dims,0,b.dims[1]),model,id};},
      sparse(b,model){return engine==='rust'?mesh(call('sparse.pack',{volume:spec(b),model},{vol:b.vol,palette:b.palette})):Q.fromVolume(b,model);},
      sharedGeometryInputMs:0,
      metrics(){return {engine,operations:{...operations},transport:{...transport},wasm:core?core.stats():null};},
      runJob(data){
        const {epoch,parcel,mode,extent,voxelSize=1,includeNavigation=false,sparse=false}=data;
        if(!['low','facade','exterior','full'].includes(mode))throw error('INVALID_REQUEST',`Unknown city job mode ${mode}`);
        const t=performance.now();transport={};jobOperations={};adapter.sharedGeometryInputMs=0;
        const timings={plan:0,voxels:0,prepare:0,mesh:0,coarse:0,sparse:0,batch:0,sharedGeometryInput:0,sharedNavigation:0,sharedBoundsSummary:0};
        const timed=(key,fn)=>{const a=performance.now(),v=fn();timings[key]+=performance.now()-a;return v;};
        const plan=timed('plan',()=>P.generate(parcel.seed,parcel.options));let b,m,box,bytes=0,walkData=null,ray=null,doorMesh=null,doorData=null;
        let nav=performance.now();
        const entry=plan.floors[0].openings.find(o=>o.kind==='front'&&plan.floors[0].rooms[o.room]?.zone==='resident')||plan.floors[0].openings.find(o=>o.kind==='front'),front=plan.plot.front*plan.cell;
        const entryPoint=entry?C.point(parcel,(entry.cells.reduce((v,c)=>v+c[0],0)/entry.cells.length+.5)*plan.cell,(entry.cells.reduce((v,c)=>v+c[1],0)/entry.cells.length+.5)*plan.cell-front):null;
        timings.sharedNavigation+=performance.now()-nav;
        if(mode==='full'||mode==='exterior'){
          b=timed('voxels',()=>V.build(plan,{exterior:mode==='exterior',closedDoors:true}));bytes=b.vol.byteLength;
          if(engine==='rust'){
            const input=timed('sharedNavigation',()=>({plan,parcel,volume:spec(b),exterior:mode==='exterior',batch:{render:sparse?'sparse':'mesh',navigation:mode==='full'&&includeNavigation,
              leaves:mode==='full'?b.info.doorLeaves:[],selectedLeaves:mode==='full'&&includeNavigation?b.info.doorLeaves.filter(l=>l.floor===0&&l.room===entry?.room):[]}}));
            const r=timed('batch',()=>call('geometry.prepare',input,sparse?{vol:b.vol,palette:b.palette}:{vol:b.vol}));
            // Old WASM advertises geometry.prepare too, but cannot execute this
            // extension. Reject it visibly; never silently take the JS pipeline.
            if(r.meta.batched!==true)throw error('ABI_MISMATCH','City Rust geometry.prepare batching requires a rebuilt WASM asset. No JavaScript fallback.');
            const model=r.meta.model;Object.assign(b,r.meta.volume);
            m=sparse?{verts:new Uint16Array(0),idx:new Uint32Array(0),quads:0,model,id:'building:'+parcel.id}:{...r.meta.mesh,verts:r.buffers.verts,idx:r.buffers.idx};
            if(sparse)ray={...r.meta.ray,coarse:r.buffers.coarse,bricks:r.buffers.bricks,pal:r.buffers.pal};
            box=r.meta.bounds;
            if(!box)box=timed('sharedBoundsSummary',()=>G.bounds(m,b));
            if(mode==='full'&&includeNavigation){
              ensure(r.buffers.vol instanceof Uint8Array&&r.buffers.vol.length===b.vol.length,'Batch collision volume is required for navigation');
              b.vol=r.buffers.vol;
              doorMesh={...r.meta.doorMesh,verts:r.buffers.doorVerts,idx:r.buffers.doorIdx};
              doorData={indices:r.buffers.doorIndices,materials:r.buffers.doorMaterials,boxes:r.meta.boxes};
            }else{
              ensure(!r.buffers.vol,'Non-navigation batches must not return a dense volume');
              // Source is transient: render output and compact volume metadata
              // are enough for bounds. Do not retain the shared JS dense build.
              b.vol=null;
            }
          }else{
            const model=timed('prepare',()=>adapter.prepare(plan,parcel,b,mode==='exterior'));
            if(mode==='full'){
              if(includeNavigation){const doors=timed('prepare',()=>adapter.doors(b,b.info.doorLeaves.filter(l=>l.floor===0&&l.room===entry?.room),model,'door:'+parcel.id));doorMesh=doors.mesh;doorData={indices:doors.indices,materials:doors.materials,boxes:doors.boxes};}
              b=timed('sharedNavigation',()=>B.openDoors(b));
            }
            if(sparse){ray=timed('sparse',()=>adapter.sparse(b,model));m={verts:new Uint16Array(0),idx:new Uint32Array(0),quads:0,model,id:'building:'+parcel.id};box=timed('sharedBoundsSummary',()=>G.bounds({verts:Uint16Array.from([...ray.lo,0,...ray.hi,0])},b));}
            else {m=timed('mesh',()=>adapter.mesh(b,model,'building:'+parcel.id));box=timed('sharedBoundsSummary',()=>G.bounds(m,b));}
          }
          if(mode==='full'&&includeNavigation)walkData={plan,building:{cell:b.cell,dims:b.dims,origin:b.origin,levels:b.levels,plate:b.plate,vol:b.vol,M:b.M,info:{doorLeaves:[]}},doors:doorData,entry:entryPoint};
        }else{
          m=timed(mode==='facade'?'mesh':'coarse',()=>adapter.facade(plan,parcel,extent,voxelSize,mode==='low'));bytes=m.voxelBytes||0;box=timed('sharedBoundsSummary',()=>G.planBounds(m,parcel,extent));
        }
        nav=performance.now();
        const windowBays=Math.max(...plan.floors.slice(1).map(f=>f.openings.filter(o=>o.side==='zm'&&['window','small','bay'].includes(o.kind)).length));
        const summary={entry:entryPoint,typology:plan.typology,storeys:plan.floors.length,projection:front,windowBays,footprint:C.footprint(plan),rooms:plan.floors.reduce((s,f)=>s+f.rooms.filter(r=>r.cells).length-1,0),plot:[plan.plot.w*plan.cell,(plan.plot.d-plan.plot.front)*plan.cell],candidate:plan.candidate};
        timings.sharedBoundsSummary+=performance.now()-nav;timings.sharedGeometryInput=adapter.sharedGeometryInputMs;
        // Shared facade decomposition is nested in mesh/coarse wall time. Do not
        // add these category totals together; totalMs is the end-to-end job clock.
        // Rust dense jobs have ONE batch wall clock (includes ABI encode/copies/
        // execute/decode), not fabricated prepare/door/mesh native phase clocks.
        const sharedMs=timings.plan+timings.voxels+timings.sharedNavigation+timings.sharedBoundsSummary+timings.sharedGeometryInput;
        const metrics={...adapter.metrics(),operations:{...jobOperations},batchedGeometry:engine==='rust'&&(mode==='full'||mode==='exterior'),sharedMs,totalMs:performance.now()-t};jobOperations=null;
        return {epoch,engine,id:parcel.id,mode,voxelSize,mesh:m,ray,doorMesh,walkData,timings,engineMetrics:metrics,voxelBytes:bytes,bounds:box,summary};
      }
    };
    return adapter;
  }
  function transferables(d){
    const arrays=[d.mesh?.verts,d.mesh?.idx,d.ray?.coarse,d.ray?.bricks,d.ray?.pal,d.walkData?.building.vol,d.walkData?.doors?.indices,d.walkData?.doors?.materials,d.doorMesh?.verts,d.doorMesh?.idx];
    return [...new Set(arrays.filter(Boolean).map(a=>a.buffer))];
  }
  const api={ABI_VERSION,PORT_OPERATIONS,load,createAdapter,transferables,encodePacket,decodePacket};
  if(node)module.exports=api;else root.CityRust=api;
})(typeof globalThis==='object'?globalThis:this);
