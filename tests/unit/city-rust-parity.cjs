'use strict';
// Real served WASM and CPU only. Export the same gates for the serial benchmark.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const base='../../prototypes/labs/';
const L=require(base+'city-lab/city-rust.js'),C=require(base+'city-lab/city-model.js'),G=require(base+'city-lab/city-geometry.js'),S=require(base+'city-lab/city-stream.js'),Q=require(base+'city-lab/city-sparse.js');
const P=require(base+'building-lab/plan.js'),V=require(base+'building-lab/voxels.js'),R=require(base+'building-lab/renderer.js'),B=require(base+'building-lab/review.js');
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'?value:ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):JSON.stringify(value)).digest('hex');
const spec=b=>({dims:b.dims,cell:b.cell,origin:b.origin,levels:b.levels||[],plate:b.plate||0,cityFront:b.cityFront||0,M:b.M});
const unpack=r=>({...r.meta,...r.buffers});
function near(a,b,label='value'){
  if(typeof a==='number'&&typeof b==='number'){
    if(Number.isInteger(a)&&Number.isInteger(b))assert.ok(a===b,`${label}: ${a} != ${b}`); // JSON represents -0 as 0.
    else assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8,`${label}: ${a} != ${b}`);
  }else if(a&&b&&typeof a==='object'&&typeof b==='object'){
    assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),label+' keys');
    for(const k of Object.keys(a))near(a[k],b[k],label+'.'+k);
  }else assert.equal(a,b,label);
}
function released(core){const s=core.stats();assert.equal(s.liveAllocations,0,'input AND output handles released');assert.equal(s.liveBytes,0,'ABI live bytes released');return s;}
function faceKeys(mesh){
  assert.equal(mesh.verts.length,mesh.quads*16);assert.equal(mesh.idx.length,mesh.quads*6);
  const out=[];
  for(let q=0;q<mesh.quads;q++){
    const points=[];for(let k=0;k<4;k++)points.push(Array.from(mesh.verts.subarray(q*16+k*4,q*16+k*4+4)).join(','));
    // Cyclic rotation is allowed; winding, normals, materials and duplicate faces are not erased.
    out.push(points.map((_,i)=>points.slice(i).concat(points.slice(0,i)).join(';')).sort()[0]);
    assert.deepEqual(Array.from(mesh.idx.subarray(q*6,q*6+6)),[0,1,2,0,2,3].map(k=>q*4+k));
  }return out.sort();
}
function meshEqual(a,b,label,{canonical=false}={}){
  assert.ok(a.verts instanceof Uint16Array&&a.idx instanceof Uint32Array,label+' typed buffers');
  assert.equal(a.quads,b.quads,label+' quads');assert.equal(a.normals,undefined,label+' architecture stays hard shaded');assert.equal(b.normals,undefined);
  if(canonical)assert.deepEqual(faceKeys(a),faceKeys(b),label+' oriented canonical faces/material IDs');
  else {assert.deepEqual(a.verts,b.verts,label+' full vertex buffer/material IDs');assert.deepEqual(a.idx,b.idx,label+' full index buffer');}
  for(const k of ['model','id','voxelSize','voxelBytes'])if(a[k]!==undefined||b[k]!==undefined)near(a[k],b[k],label+' '+k);
}
function sparseEqual(a,b,volume,label){
  for(const k of ['coarse','bricks','pal'])assert.deepEqual(a[k],b[k],label+' '+k);
  near({...a,coarse:null,bricks:null,pal:null},{...b,coarse:null,bricks:null,pal:null},label+' crop/frame/dedup metadata');
  assert.equal(a.bytes,a.coarse.byteLength+a.bricks.byteLength+a.pal.byteLength,label+' actual bytes');
  const [X,Y,Z]=volume.dims,n=volume.vol.length,step=n<=32768?1:Math.max(1,Math.floor(n/4096));
  let samples=0;
  const sample=(x,y,z)=>{
    const expected=x>=0&&y>=0&&z>=0&&x<X&&y<Y&&z<Z?volume.vol[x+X*(z+Z*y)]:0;
    assert.equal(Q.sample(a,x,y,z),expected,`${label} material at ${x},${y},${z}`);assert.equal(Q.sample(b,x,y,z),expected);samples++;
  };
  for(let i=0;i<n;i+=step)sample(i%X,Math.floor(i/(X*Z)),Math.floor(i/X)%Z);
  let random=0x12345678;for(let i=0;i<1024;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;const j=random%n;sample(j%X,Math.floor(j/(X*Z)),Math.floor(j/X)%Z);}
  for(const x of [-1,0,X-1,X,Math.ceil(X/4)*4])for(const y of [-1,0,Y-1,Y])for(const z of [-1,0,Z-1,Z])sample(x,y,z);
  return samples;
}
function tinyFixtures(){
  let random=42;const rand=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random;};
  const defs=[['empty',[9,7,11],()=>0],['solid-glass',[8,8,8],()=>V.M.glass],['all-materials',[17,9,13],i=>i%256],['random',[11,9,13],()=>rand()%3?0:1+rand()%255],['repeated-cropped',[24,24,24],(_i,x,y,z)=>x>=8&&x<16&&y>=8&&y<16&&z>=8&&z<16?(x+y+z)%2+1:0],['single-shoji',[1,1,1],()=>V.M.shoji]];
  return defs.map(([name,dims,fill],k)=>{const [X,Y,Z]=dims,vol=new Uint8Array(X*Y*Z);for(let y=0;y<Y;y++)for(let z=0;z<Z;z++)for(let x=0;x<X;x++){const i=x+X*(z+Z*y);vol[i]=fill(i,x,y,z);}return {name,b:{dims,vol,cell:.0625,origin:[3,2,4],levels:[2,Y],plate:2,M:V.M,palette:V.palette()},model:k%2?[0,0,-1,0,0,1,0,0,1,0,0,0,-12.25,3.75,8.125,1]:[1,0,0,0,0,1,0,0,0,0,1,0,12,3,-8,1]};});
}
function geometryEnvelope(mesh,parcel,extent){
  const b=G.planBounds(mesh,parcel,extent);
  // Identical to the retained facade check; coarse quantisation is not a detailed envelope.
  assert.ok(b.lo[0]>=-(parcel.options.party[0]?.075:.26)&&b.hi[0]<=parcel.width+(parcel.options.party[1]?.075:.26)&&b.lo[2]>=-parcel.envelope.front-.01&&b.hi[2]<=parcel.depth+.26,`facade envelope parcel ${parcel.id}: ${JSON.stringify(b)}`);
}
function auditParty(city){
  const findings=[];
  for(const p of city.parcels)for(const [side,flag] of p.options.party.entries())if(flag){
    const A=C.point(p,side?p.width:0,0),Z=C.point(p,side?p.width:0,p.depth);
    const neighbour=city.parcels.some(q=>q.id!==p.id&&[0,q.width].some(x=>{const a=C.point(q,x,0),z=C.point(q,x,q.depth);return Math.hypot(A[0]-a[0],A[1]-a[1])<1e-6&&Math.hypot(Z[0]-z[0],Z[1]-z[1])<1e-6;}));
    if(!neighbour)findings.push({id:p.id,side,depth:p.depth});
  }return findings;
}
async function runParity({core:provided,log=()=>{}}={}){
  const core=provided||await L.load(),js=L.createAdapter('js'),rust=L.createAdapter('rust',core);
  const report={passed:false,gates:[],failures:[],coverage:{seeds:[1,2,42],terrains:['flat','uneven'],layouts:['grid','woven'],widths:[.75,1,1.25],requestedCounts:[24,100,1000],topologies:0,plans:0,facades:0,coarse:0,realVolumes:0,sparseCases:0,materialSamples:0,streamPaths:0,prefetchCases:0,repeatCycles:0},cities:[],qualityFindings:[],limitations:[],inputHashes:[]};
  const gate=(name,fn)=>{const start=performance.now();try{fn();released(core);report.gates.push({name,passed:true,ms:performance.now()-start});}catch(e){report.gates.push({name,passed:false,ms:performance.now()-start});report.failures.push({name,message:e.message,stack:e.stack});}log(name);};
  try{
    gate('native-readiness-and-budget',()=>{assert.equal(core.info.engine,'rust');assert.deepEqual([...core.info.implemented].sort(),[...L.PORT_OPERATIONS].sort());assert.equal(core.info.geometryBudgetBytes,128*1024*1024);});
    gate('literal-count-96-is-not-supported-by-either-engine',()=>{assert.throws(()=>js.generate(1,{count:96}),/Unsupported/);assert.throws(()=>rust.generate(1,{count:96}),{code:'INVALID_REQUEST'});});
    report.limitations.push('Production accepts count=24,100,1000, not literal 96. Actual parcel totals vary. The explicit 96-parcel comparison is a bounded batch selected from the unchanged 1152-parcel grid, not a claim to generate a count=96 city.');
    // Terrain is outermost: all flat fixtures execute before any uneven fixture.
    for(const terrain of report.coverage.terrains)for(const seed of report.coverage.seeds)for(const count of report.coverage.requestedCounts)for(const layout of report.coverage.layouts)for(const width of report.coverage.widths){
      const options={count,layout,width,terrain},tag=`seed=${seed}/${terrain}/${layout}/width=${width}/count=${count}`;
      let city,native;
      gate('topology '+tag,()=>{
        city=js.generate(seed,options);native=rust.generate(seed,options);near(native,city,'complete topology');
        assert.deepEqual(native.parcels.map(p=>[p.id,p.seed,p.options]),city.parcels.map(p=>[p.id,p.seed,p.options]),'exact IDs/seeds/Building Lab options');
        assert.deepEqual(rust.validate(city),C.validate(city));assert.deepEqual(C.validate(city),[]);
        report.coverage.topologies++;report.cities.push({seed,...options,actualParcels:city.parcels.length,identityHash:sha(city.parcels.map(p=>[p.id,p.seed,p.options]))});
      });
      if(!city||!native)continue; // A recorded failed gate never becomes a passing benchmark.
      const issues=auditParty(city);if(issues.length)report.qualityFindings.push({kind:'baseline-party-wall-depth',seed,...options,findingCount:issues.length,examples:issues.slice(0,4)});
      gate('streaming '+tag,()=>{
        let previous=new Map();
        for(const mode of ['stream','exterior','detailed','full'])for(const [i,eye] of [[0,2,0],[25,6,50],[city.extent*8,200,city.extent*8]].entries()){
          const view=i%2?{height:1080,fov:.62,aspect:1.6,forward:[0,-1]}:{height:720,fov:70*Math.PI/180,aspect:1.6,forward:[1,0]},pinned=i===1?city.parcels[0].id:null;
          const a=rust.targets(city,eye,previous,mode,pinned,view),b=S.targets(city,eye,previous,mode,pinned,view);near([...a],[...b],'ranked targets');
          assert.ok([...a.values()].every(t=>t.mode!=='full'),'initial target must never generate interiors');
          if(mode==='stream'){assert.ok([...a.values()].filter(t=>t.near).length<=6,'buffer policy close cap includes pinned');assert.ok([...a.values()].filter(t=>t.mode==='exterior').length<=64,'buffer policy exterior cap includes pinned');}
          previous=b;report.coverage.streamPaths++;
        }
      });
      gate('plan-facade-coarse '+tag,()=>{
        const sampled=[0,Math.floor(city.parcels.length/2),city.parcels.length-1];
        // Explicit bounded 96-building stress batch, not 1152 dense interiors.
        const ids=seed===1&&terrain==='flat'&&layout==='grid'&&width===1&&count===1000?Array.from({length:96},(_,i)=>Math.floor(i*(city.parcels.length-1)/95)):sampled;
        for(const id of ids){
          const parcel=city.parcels[id],plan=P.generate(parcel.seed,parcel.options);report.coverage.plans++;
          if(report.inputHashes.length<12||ids.length===96&&[0,95].includes(ids.indexOf(id)))report.inputHashes.push({tag,id,plan:sha(plan),options:sha(parcel.options)});
          assert.ok(plan.plot.w*plan.cell<=parcel.width&&(plan.plot.d-plan.plot.front)*plan.cell<=parcel.depth,'shared actual plot fits');
          const a=rust.facade(plan,parcel,city.extent),b=js.facade(plan,parcel,city.extent);meshEqual(a,b,tag+' facade '+id,{canonical:true});geometryEnvelope(a,parcel,city.extent);geometryEnvelope(b,parcel,city.extent);report.coverage.facades++;
          for(const size of [.5,1,2]){meshEqual(rust.facade(plan,parcel,city.extent,size,true),js.facade(plan,parcel,city.extent,size,true),tag+' coarse '+id+'/'+size,{canonical:true});report.coverage.coarse++;}
          released(core);
        }
      });
    }
    gate('stream-thresholds-hysteresis-and-single-door-selection',()=>{
      const city={parcels:[{id:0,origin:[0,0],right:[1,0],inward:[0,1],width:7,depth:12,padY:0,options:{storeys:3}},{id:1,origin:[20,0],right:[1,0],inward:[0,1],width:7,depth:12,padY:0,options:{storeys:4}}]};
      for(const d of [17.9999,18,23.9999,24,54.9999,55,64.9999,65,1000])for(const old of [null,{mode:'exterior',near:true,voxelSize:.5},{mode:'exterior',near:false,voxelSize:1},{mode:'low',near:false,voxelSize:2},{mode:'facade',near:false,voxelSize:1}]){
        const previous=old?new Map([[0,{distance:0,projected:0,...old}]]):new Map(),eye=[3.5,2,6+d];near([...rust.targets(city,eye,previous)],[...S.targets(city,eye,previous)]);report.coverage.streamPaths++;
      }
      const summaries={0:{entry:[0,0]},1:{entry:[0,0]},2:{entry:[10,0]},3:{entry:null}};
      for(const eye of [null,[0,2,0],[0,2,11.9999],[0,2,12],[0,2,17.9999],[0,2,18],[9,2,0],[100,2,100]])for(const current of [null,0,1,2])for(const inside of [false,true]){assert.equal(rust.prefetch(eye,summaries,current,inside),S.prefetch(eye,summaries,current,inside));report.coverage.prefetchCases++;}
    });
    const retained=[];
    gate('random-empty-all-materials-sparse-crop-dedup-and-greedy',()=>{
      for(const {name,b,model} of tinyFixtures()){
        meshEqual(rust.mesh(b,model,name),{...R.meshSegment(b.vol,b.dims,0,b.dims[1]),model,id:name},name);
        for(const deduplicate of [false,true])for(const crop of [false,true]){
          const a=unpack(core.call('sparse.pack',{volume:spec(b),model,options:{deduplicate,crop}},{vol:b.vol,palette:b.palette})),expected=Q.fromVolume(b,model,{deduplicate,crop});
          report.coverage.materialSamples+=sparseEqual(a,expected,b,name);report.coverage.sparseCases++;released(core);
          if(name==='repeated-cropped'&&crop&&deduplicate){assert.equal(a.nb,1);assert.deepEqual(a.offset,[8,8,8]);}
        }
        const ownership=new Map([[0,2],[b.vol.length-1,2],[1,3]]),y0=1,y1=Math.max(1,b.dims[1]-1);
        if(b.dims[1]>1){const a=unpack(core.call('mesh.segment',{volume:spec(b),y0,y1,segment:2},{vol:b.vol,ownerIndices:Uint32Array.from(ownership.keys()),ownerSegments:Int32Array.from(ownership.values())}));meshEqual(a,R.meshSegment(b.vol,b.dims,y0,y1,ownership,2),name+' owned segment');}
        const output=rust.mesh(b,model,name);retained.push({a:output.verts,b:output.verts.slice()});
      }
    });
    for(const terrain of ['flat','uneven'])for(const seed of [1,2,42])gate(`real-shared-volume seed=${seed}/${terrain}`,()=>{
      const city=C.generate(seed,{terrain}),parcel=city.parcels[0],plan=P.generate(parcel.seed,parcel.options);
      for(const exterior of [true,false]){
        const original=V.build(plan,{exterior,closedDoors:true}),a={...original,vol:original.vol.slice()},b={...original,vol:original.vol.slice()},originalHash=sha(original.vol);
        const model=rust.prepare(plan,parcel,a,exterior),expected=js.prepare(plan,parcel,b,exterior);
        near(model,expected,'prepared model');assert.deepEqual(a.vol,b.vol,'identical pruning/materials');assert.equal(a.cityFront,b.cityFront);assert.equal(sha(original.vol),originalHash,'ABI must not consume/mutate caller volume');
        if(!exterior){
          const entry=plan.floors[0].openings.find(o=>o.kind==='front'&&plan.floors[0].rooms[o.room]?.zone==='resident')||plan.floors[0].openings.find(o=>o.kind==='front');
          const leaves=a.info.doorLeaves.filter(l=>l.floor===0&&l.room===entry?.room),doorA=rust.doors(a,leaves,model,'selected-door'),doorB=js.doors(b,leaves,expected,'selected-door');
          meshEqual(doorA.mesh,doorB.mesh,'door');for(const k of ['indices','materials','boxes'])assert.deepEqual(doorA[k],doorB[k],'selected door '+k);
        }
        const openedA=exterior?a:B.openDoors(a),openedB=exterior?b:B.openDoors(b);assert.deepEqual(openedA.vol,openedB.vol,'shared open-doors');
        const ma=rust.mesh(openedA,model,'real'),mb=js.mesh(openedB,expected,'real');meshEqual(ma,mb,'real mesh');
        const bounds=G.bounds(ma,openedA);assert.ok(bounds.lo[0]>=-(parcel.options.party[0]?0:.25)&&bounds.hi[0]<=parcel.width+(parcel.options.party[1]?0:.25)&&bounds.lo[2]>=-parcel.envelope.front&&bounds.hi[2]<=parcel.depth+.25,'unchanged detailed envelope');
        const sa=rust.sparse(openedA,model),sb=js.sparse(openedB,expected);report.coverage.materialSamples+=sparseEqual(sa,sb,openedA,'real '+seed+'/'+terrain+'/'+exterior);report.coverage.sparseCases++;report.coverage.realVolumes++;
        report.inputHashes.push({seed,terrain,exterior,parcel:parcel.id,plan:sha(plan),volume:originalHash,dims:original.dims,bytes:original.vol.byteLength});released(core);
      }
    });
    gate('repeated-owned-results-error-paths-and-no-live-allocations',()=>{
      const {b,model}=tinyFixtures()[3];
      for(let i=0;i<100;i++){
        rust.mesh(b,model,'repeat');rust.sparse(b,model);assert.throws(()=>core.call('geometry.coarse',{}),{code:'INVALID_REQUEST'});released(core);report.coverage.repeatCycles++;
      }
      for(const {a,b:copy} of retained)assert.deepEqual(a,copy,'results survive memory growth and city_free');
      report.finalWasm=released(core);report.operations=rust.metrics().operations;
      for(const op of L.PORT_OPERATIONS)assert.ok(report.operations[op]>0,'native operation exercised '+op);
    });
    report.passed=report.failures.length===0;report.qualityPassed=report.qualityFindings.length===0;
    return report;
  }finally{released(core);if(!provided)core.dispose();}
}
if(require.main===module)runParity().then(report=>{
  console.log(JSON.stringify({passed:report.passed,coverage:report.coverage,qualityFindingCases:report.qualityFindings.length,limitations:report.limitations,finalWasm:report.finalWasm},null,2));
  for(const f of report.failures)console.error(f.name+'\n'+f.stack);if(!report.passed)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={runParity,near,meshEqual,sparseEqual,tinyFixtures,spec,unpack,sha,released,L,C,G,S,Q,P,V,R,B};
