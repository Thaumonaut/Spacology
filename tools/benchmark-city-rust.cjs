#!/usr/bin/env node
'use strict';
// Serial CPU comparison of the actual opt-in adapter; never launches a browser/server/GL.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {runParity,near,meshEqual,sparseEqual,spec,unpack,sha,released,L,C,G,S,Q,P,V,R,B}=require('../tests/unit/city-rust-parity.cjs');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'output/city-rust-comparison');
const sumBytes=buffers=>Object.values(buffers||{}).reduce((n,b)=>n+(ArrayBuffer.isView(b)?b.byteLength:0),0);
const median=a=>{const s=[...a].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const stats=a=>({n:a.length,min:Math.min(...a),median:median(a),max:Math.max(...a)});
function version(command,args){const r=cp.spawnSync(command,args,{encoding:'utf8'});return r.status===0?r.stdout.trim():{unavailable:true,error:r.error?.message||r.stderr?.trim()};}
function bytesOf(value){if(Array.isArray(value))return value.reduce((n,v)=>n+bytesOf(v),0);if(value?.engineMetrics)return L.transferables(value).reduce((n,b)=>n+b.byteLength,0);return sumBytes(value);}
function counts(value){
  if(Array.isArray(value)){const all=value.map(counts);return Object.fromEntries(Object.keys(all[0]||{}).map(k=>[k,all.reduce((n,v)=>n+v[k],0)]));}
  const mesh=value?.mesh||value,ray=value?.ray,door=value?.doorMesh;
  return {typedArrayBytes:bytesOf(value),geometryBytes:mesh?.verts?mesh.verts.byteLength+mesh.idx.byteLength+(ray?sumBytes(ray):0)+(door?sumBytes(door):0):value?.coarse?sumBytes(value):0,vertices:mesh?.verts?.length/4||0,indices:mesh?.idx?.length||0,quads:mesh?.quads||0,mixedBricks:value?.nb||ray?.nb||0,mixedCells:value?.mixedCells||ray?.mixedCells||0};
}
const metadataBytes=value=>Buffer.byteLength(JSON.stringify(value,(_k,v)=>ArrayBuffer.isView(v)?undefined:v));
function summaryRows(rows){
  const groups=new Map();for(const r of rows){const key=r.phase+' / '+(r.context.mode||r.context.layout||'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  return [...groups].map(([phase,rs])=>({phase,samples:rs.length,fixtures:new Set(rs.map(r=>JSON.stringify(r.context))).size,jsMs:stats(rs.map(r=>r.jsMs)),rustMs:stats(rs.map(r=>r.rustMs)),pairedJsOverRustRatio:stats(rs.map(r=>r.jsMs/r.rustMs)),abi:Object.fromEntries(['encodeMs','copyInMs','executeMs','copyOutMs','decodeMs'].map(k=>[k,stats(rs.map(r=>r.abi[k]||0))]))}));
}
async function coldChild(){const core=await L.load();const result={load:core.loadTimings,wasm:released(core),info:core.info};core.dispose();console.log(JSON.stringify(result));}
async function profile({repeats=3,coldRepeats=3}={}){
  assert.ok(Number.isInteger(repeats)&&repeats>=3&&repeats<=20,'Use 3..20 warmed serial repetitions');
  assert.ok(Number.isInteger(coldRepeats)&&coldRepeats>=1&&coldRepeats<=10);
  const sources=['prototypes/labs/building-lab/plan.js','prototypes/labs/building-lab/voxels.js','prototypes/labs/building-lab/renderer.js','prototypes/labs/building-lab/review.js','prototypes/labs/city-lab/city-model.js','prototypes/labs/city-lab/city-stream.js','prototypes/labs/city-lab/city-geometry.js','prototypes/labs/city-lab/city-sparse.js','prototypes/labs/city-lab/city-rust.js','tools/benchmark-city-rust.cjs','tests/unit/city-rust-parity.cjs'];
  const wasmBytes=fs.readFileSync(path.join(ROOT,'prototypes/labs/city-lab/wasm/city_lab_core.wasm'));
  const report={schemaVersion:1,environment:{date:new Date().toISOString(),node:process.version,npm:version('npm',['--version']),rustc:version('rustc',['--version']),cargo:version('cargo',['--version']),rustup:version('rustup',['--version']),targets:version('rustup',['target','list','--installed']),platform:process.platform,arch:process.arch,kernel:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem(),repeats,coldRepeats,gcExposed:typeof global.gc==='function',setupInstalled:[],wasm:{bytes:wasmBytes.byteLength,sha256:sha(wasmBytes)},sources:Object.fromEntries(sources.map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f)))]))},cold:[],rows:[],shared:[],metadataMarshaling:[],correctness:null,eligibleForEndToEndSpeedupClaim:false,limitations:[
    'Node serial CPU measurements only. No software GL, browser, upload, draw-call, GPU, FPS, phone/tablet or end-to-end rendering claims.',
    'JavaScript is unchanged/default. Rust is the actual served WASM adapter, not a renderer or a port of Building Lab room/furniture planning.',
    'Shared Building Lab JS plan, room/furniture and dense voxels remain. Facade span/rectangle preprocessing, navigation/open doors, bounds/summary, collision, vegetation/environment and rendering remain JS.',
    'ABI encode includes metadata JSON AND packet binary packing. copyIn includes input allocation and full packet copy (not pure volume memcpy). execute includes Rust ABI parse/serialize and internal copies, not isolated algorithm time. copyOut and decode are separate owned copies.',
    'metadataMarshaling is an encoder-only metadata packet probe with no typed payload. It is not an additional additive phase of a measured call.',
    'Cold initialization uses fresh child processes (OS filesystem cache may remain warm); process wall includes fork/module setup. Other samples run serially after parity and one per-fixture warm-up, alternating JS/Rust first.',
    'Shared facade preprocessing is included in Rust facade wall time; it is an overlapping subcategory, not added a second time. runJob timings also overlap. Typed-array bytes exclude JS object metadata and are not measured GPU residency.',
    'Zero live ABI handles/bytes does not mean zero WASM retained capacity or zero JavaScript heap. WASM capacity is a high-water mark; disposal drops the export reference for GC.',
    'No geometry quality, material IDs, collision/envelope checks or golden buffers are reduced to improve timing. Existing shared quality findings are reported separately and block a certified overall speedup claim.',
    'Native count options are 24,100,1000; actual counts are recorded. Literal 96 is unsupported. A labeled 96-building facade batch uses identical sampled parcels of the unchanged 1152-parcel grid. No count=96 topology claim.'
  ]};
  for(let i=0;i<coldRepeats;i++){
    const start=performance.now(),child=cp.spawnSync(process.execPath,[__filename,'--cold-child'],{cwd:ROOT,encoding:'utf8',timeout:60000});
    assert.equal(child.status,0,child.stderr||child.error?.message);report.cold.push({repeat:i,processWallMs:performance.now()-start,...JSON.parse(child.stdout)});
  }
  const core=await L.load();let lastCall=null;
  const observed={...core,call(...args){lastCall=core.call(...args);return lastCall;}};
  const js=L.createAdapter('js'),rust=L.createAdapter('rust',observed);
  const native=(op,meta,buffers={})=>{const r=core.call(op,meta,buffers);return {value:unpack(r),abi:r.timings};};
  const fromAdapter=fn=>{rust.sharedGeometryInputMs=0;const value=fn();return {value,abi:lastCall.timings,sharedMs:rust.sharedGeometryInputMs};};
  const probe=(phase,context,meta,op)=>{for(let repeat=0;repeat<repeats;repeat++){const start=performance.now(),packet=L.encodePacket(op,meta,{});report.metadataMarshaling.push({phase,context,repeat,encodeMs:performance.now()-start,packetBytes:packet.byteLength});}};
  function pair(phase,context,jsFn,rustFn,check,inputBytes=0,reset=()=>{}){
    reset();let a=jsFn(),b=rustFn();check(b.value,a.value);released(core);a=b=null;
    for(let repeat=0;repeat<repeats;repeat++){
      if(global.gc)global.gc();reset();
      let jsMs,rustMs;const order=repeat%2?['rust','js']:['js','rust'];
      for(const engine of order){const start=performance.now();if(engine==='js'){a=jsFn();jsMs=performance.now()-start;}else{b=rustFn();rustMs=performance.now()-start;}}
      check(b.value,a.value);const state=released(core);
      report.rows.push({phase,context,repeat,order,jsMs,rustMs,abi:b.abi||{},rustSharedInputMs:b.sharedMs||0,inputTypedArrayBytes:inputBytes,js:counts(a.value),rust:counts(b.value),jsOutputMetadataBytes:metadataBytes(a.value),rustOutputMetadataBytes:metadataBytes(b.value),wasm:state,jsJobTimings:a.value?.timings||null,jobTimings:b.value?.timings||null,jsJobSharedMs:a.value?.engineMetrics?.sharedMs??null,jobSharedMs:b.value?.engineMetrics?.sharedMs??null});a=b=null;
    }
  }
  function shared(phase,context,fn,fingerprint=()=>null){
    let value=fn();const expected=fingerprint(value);value=null;
    for(let repeat=0;repeat<repeats;repeat++){if(global.gc)global.gc();const start=performance.now();value=fn();const ms=performance.now()-start;assert.deepEqual(fingerprint(value),expected);report.shared.push({phase,context,repeat,ms,denseBytes:value?.vol?.byteLength||0,hash:expected});value=null;}
  }
  try{
    console.error('Running non-skippable actual-WASM correctness gates (flat, then uneven)...');
    report.correctness=await runParity({core});
    if(!report.correctness.passed){report.failure='Parity/envelope gate failed; timing comparison withheld.';return report;}
    console.error('Parity passed; running warmed serial CPU pairs...');
    for(const terrain of ['flat','uneven'])for(const seed of [1,2,42])for(const count of [24,100,1000])for(const layout of ['grid','woven'])for(const width of [.75,1,1.25]){
      const options={terrain,count,layout,width},city=C.generate(seed,options),context={seed,...options,actualParcels:city.parcels.length};
      pair('city.generate',context,()=>({value:C.generate(seed,options)}),()=>{const r=core.call('city.generate',{seed,options});return {value:r.meta,abi:r.timings};},near);
      const eye=[0,2,30],view={height:1080,fov:.62},previous=new Map();
      pair('stream.targets',context,()=>({value:[...S.targets(city,eye,previous,'stream',null,view)]}),()=>fromAdapter(()=>[...rust.targets(city,eye,previous,'stream',null,view)]),near);
      const parcel=city.parcels[0],plan=P.generate(parcel.seed,parcel.options),geoContext={...context,id:parcel.id,planHash:sha(plan)};
      pair('geometry.facade',geoContext,()=>({value:js.facade(plan,parcel,city.extent)}),()=>fromAdapter(()=>rust.facade(plan,parcel,city.extent)),(a,b)=>meshEqual(a,b,'facade',{canonical:true}));
      for(const voxelSize of [.5,1,2])pair('geometry.coarse',{...geoContext,voxelSize},()=>({value:js.facade(plan,parcel,city.extent,voxelSize,true)}),()=>fromAdapter(()=>rust.facade(plan,parcel,city.extent,voxelSize,true)),(a,b)=>meshEqual(a,b,'coarse',{canonical:true}));
    }
    // A labeled 24/96 startup-facade workload, sampled from real city topology; no fake count=96 option.
    for(const terrain of ['flat','uneven'])for(const batchSize of [24,96]){
      const city=C.generate(1,{terrain,layout:'grid',count:batchSize===24?24:1000}),ids=Array.from({length:batchSize},(_,i)=>Math.floor(i*(city.parcels.length-1)/(batchSize-1)));
      const context={seed:1,terrain,layout:'grid',actualCityParcels:city.parcels.length,batchSize,parcelIds:ids};
      const job=(adapter)=>ids.map(id=>adapter.runJob({epoch:1,parcel:city.parcels[id],extent:city.extent,mode:'facade'}));
      pair('facade-job-batch',context,()=>({value:job(js)}),()=>{const value=job(rust),abi={};for(const j of value)for(const [k,v] of Object.entries(j.engineMetrics.transport))abi[k]=(abi[k]||0)+v;return {value,abi};},(a,b)=>{assert.equal(a.length,b.length);for(let i=0;i<a.length;i++){meshEqual(a[i].mesh,b[i].mesh,'batch facade',{canonical:true});near(a[i].summary,b[i].summary);}});
    }
    for(const terrain of ['flat','uneven'])for(const seed of [1,2,42]){
      const city=C.generate(seed,{terrain}),parcel=city.parcels[0],plan=P.generate(parcel.seed,parcel.options),context={seed,terrain,id:parcel.id,planHash:sha(plan)};
      shared('shared.BuildingPlan.generate',context,()=>P.generate(parcel.seed,parcel.options),sha);
      for(const exterior of [true,false]){
        const cx={...context,mode:exterior?'exterior':'full'},original=V.build(plan,{exterior,closedDoors:true});
        shared('shared.BuildingVoxels.build',cx,()=>V.build(plan,{exterior,closedDoors:true}),b=>sha(b.vol));
        const jsVolume={...original,vol:original.vol.slice()},rustVolume={...original,vol:original.vol.slice()};
        const prepareMeta={plan,parcel,volume:spec(original),exterior};probe('geometry.prepare',cx,prepareMeta,'geometry.prepare');
        // Reset both inputs outside timing; fixture reset cost is not a conversion advantage for either engine.
        pair('geometry.prepare',cx,()=>{G.cityVolume(plan,jsVolume,exterior);return {value:{vol:jsVolume.vol,model:G.model(parcel,jsVolume)}};},()=>native('geometry.prepare',prepareMeta,{vol:rustVolume.vol}),(a,b)=>{assert.deepEqual(a.vol,b.vol);near(a.model,b.model);},original.vol.byteLength,()=>jsVolume.vol.set(original.vol));
        G.cityVolume(plan,jsVolume,exterior);let b=exterior?jsVolume:B.openDoors(jsVolume);const model=G.model(parcel,b),volumeMeta=spec(b),inputHash=sha(b.vol),inputBytes=b.vol.byteLength;
        const meshMeta={volume:volumeMeta,y0:0,y1:b.dims[1],model,id:'matched'};probe('mesh.segment',cx,meshMeta,'mesh.segment');
        pair('mesh.segment',{...cx,dims:b.dims,volumeHash:inputHash},()=>({value:{...R.meshSegment(b.vol,b.dims,0,b.dims[1]),model,id:'matched'}}),()=>native('mesh.segment',meshMeta,{vol:b.vol}),(a,b)=>meshEqual(a,b,'real conversion'),inputBytes);
        const sparseMeta={volume:volumeMeta,model};probe('sparse.pack',cx,sparseMeta,'sparse.pack');
        pair('sparse.pack',{...cx,dims:b.dims,volumeHash:inputHash},()=>({value:Q.fromVolume(b,model)}),()=>native('sparse.pack',sparseMeta,{vol:b.vol,palette:b.palette}),(a,expected)=>sparseEqual(a,expected,b,'real storage'),inputBytes+b.palette.byteLength);
        assert.equal(sha(b.vol),inputHash,'conversion inputs unchanged');
      }
      if(seed===1)for(const [mode,sparse] of [['facade',false],['low',false],['exterior',false],['exterior',true],['full',false],['full',true]]){
        const request={epoch:1,parcel,extent:city.extent,voxelSize:.5,mode,sparse,includeNavigation:mode==='full'};
        pair('integrated.runJob',{...context,mode:mode+'/'+(sparse?'sparse':'mesh')},()=>({value:js.runJob(request)}),()=>{const value=rust.runJob(request);return {value,abi:value.engineMetrics.transport};},(a,b)=>{meshEqual(a.mesh,b.mesh,'job');near(a.bounds,b.bounds);near(a.summary,b.summary);if(a.ray){for(const k of ['coarse','bricks','pal'])assert.deepEqual(a.ray[k],b.ray[k]);}if(a.walkData){assert.deepEqual(a.walkData.building.vol,b.walkData.building.vol);assert.deepEqual(a.walkData.doors,b.walkData.doors);meshEqual(a.doorMesh,b.doorMesh,'job door');}});
      }
    }
    report.summaries=summaryRows(report.rows);report.finalWasm=released(core);report.completed=true;return report;
  }catch(e){report.failure=e.stack;report.completed=false;report.summaries=[];return report;}
  finally{released(core);core.dispose();}
}
// Deliberately bounded follow-up: one real sparse exterior from the unchanged
// seed1/woven/count24 stream fixture, plus its 24-facade startup work. Not the
// cost of settling/rendering every stream target; no interiors are generated.
async function bounded({repeats=3}={}){
  assert.ok(Number.isInteger(repeats)&&repeats>=3&&repeats<=5);
  const core=await L.load(),js=L.createAdapter('js'),rust=L.createAdapter('rust',core),wasm=fs.readFileSync(path.join(ROOT,'prototypes/labs/city-lab/wasm/city_lab_core.wasm'));
  const data={schemaVersion:1,date:new Date().toISOString(),environment:{node:process.version,cpu:os.cpus()[0]?.model,platform:process.platform,arch:process.arch,repeats,gcExposed:!!global.gc,wasmBytes:wasm.length,wasmSha256:sha(wasm)},fixture:{seed:1,layout:'woven',count:24,mode:'stream',backend:'sparse',position:[0,1.6,0],view:{height:720,fov:70*Math.PI/180,forward:[0,1]}},cold:[],rows:[],shared:[],terrains:[],limitations:[
    'Serial Node CPU only. No browser/worker transfer/scheduling, upload, WebGL/cull/draw, GPU, FPS, phone or tablet measurements. No complete scene-settle or end-to-end speedup claim.',
    'One excluded warm-up and three alternating-order samples per phase, flat before uneven. Only parcel 0 sparse exterior plus all 24 startup facades; not all stream targets/interiors.',
    'Shared JS plan/volume generation is separately sampled. runJob includes these and other shared JS work; sharedMs is overlapping, not additive.',
    'ABI execute includes Rust packet parsing, internal copies and serialization. Encode/copy/decode is separated; zero live ABI bytes is not zero retained WASM capacity or JS heap.',
    'Counts/arrays/materials/models checked on every pair. Actual-WASM full parity and shared party-wall findings belong to the separately run focused unit gates; quality/UI acceptance is not certified.'
  ]};
  function checkJob(a,b,canonical=false){meshEqual(a.mesh,b.mesh,'bounded job',{canonical});near(a.summary,b.summary);near(a.bounds,b.bounds);if(a.ray){assert.ok(b.ray);for(const k of ['coarse','bricks','pal'])assert.deepEqual(a.ray[k],b.ray[k]);for(const k of ['n','o','cvs','frame','bytes','nb','brickRows'])near(a.ray[k],b.ray[k]);}assert.equal(bytesOf(a),bytesOf(b));}
  async function pair(phase,context,jsFn,rustFn,check){
    let a=jsFn(),b=rustFn();check(a,b);released(core);a=b=null;
    for(let repeat=0;repeat<repeats;repeat++){
      if(global.gc)global.gc();const order=repeat%2?['rust','js']:['js','rust'],times={};
      for(const engine of order){const started=performance.now();if(engine==='js')a=jsFn();else b=rustFn();times[engine]=performance.now()-started;}
      check(a,b);const jobs=Array.isArray(b)?b:[b],abi={};for(const j of jobs)for(const [k,v] of Object.entries(j.engineMetrics?.transport||{}))abi[k]=(abi[k]||0)+v;
      data.rows.push({phase,context,repeat,order,jsMs:times.js,rustMs:times.rust,abi,js:counts(a),rust:counts(b),rustSharedMs:jobs.reduce((n,j)=>n+(j.engineMetrics?.sharedMs||0),0),wasm:released(core)});a=b=null;
    }
  }
  try{
    for(let repeat=0;repeat<3;repeat++){const child=cp.spawnSync(process.execPath,[__filename,'--cold-child'],{cwd:ROOT,encoding:'utf8',timeout:60000});assert.equal(child.status,0,child.stderr);data.cold.push(JSON.parse(child.stdout));}
    for(const terrain of ['flat','uneven']){
      const options={terrain,layout:'woven',width:1,count:24},city=C.generate(1,options),parcel=city.parcels[0],context={terrain,id:parcel.id,actualParcels:city.parcels.length},plan=P.generate(parcel.seed,parcel.options);
      near(city,rust.generate(1,options));const targets=S.targets(city,data.fixture.position,new Map(),'stream',null,data.fixture.view);near([...targets],[...rust.targets(city,data.fixture.position,new Map(),'stream',null,data.fixture.view)]);
      data.terrains.push({...context,targets:[...targets],planHash:sha(plan),sourceDims:V.build(plan,{exterior:true,closedDoors:true}).dims});
      const shared=(phase,fn,fingerprint)=>{let v=fn(),hash=fingerprint(v);v=null;for(let repeat=0;repeat<repeats;repeat++){if(global.gc)global.gc();const started=performance.now();v=fn();const ms=performance.now()-started;assert.equal(fingerprint(v),hash);data.shared.push({phase,context,repeat,ms,hash,sourceBytes:v?.vol?.byteLength||0});v=null;}};
      shared('shared.BuildingPlan.generate',()=>P.generate(parcel.seed,parcel.options),sha);
      shared('shared.BuildingVoxels.build.exterior',()=>V.build(plan,{exterior:true,closedDoors:true}),v=>sha(v.vol));
      const jobs=adapter=>city.parcels.map(parcel=>adapter.runJob({epoch:1,parcel,extent:city.extent,mode:'facade'}));
      await pair('startup.24facades',context,()=>jobs(js),()=>jobs(rust),(a,b)=>{assert.equal(a.length,b.length);a.forEach((j,i)=>checkJob(j,b[i],true));});
      const request={epoch:1,parcel,extent:city.extent,voxelSize:.5,mode:'exterior',sparse:true,includeNavigation:false};
      await pair('integrated.exterior.sparse',context,()=>js.runJob(request),()=>rust.runJob(request),checkJob);
    }
    data.finalWasm=released(core);data.completed=true;data.summaries=summaryRows(data.rows);return data;
  }finally{released(core);core.dispose();}
}
function markdown(data){
  const n=x=>Number(x).toFixed(3),lines=['# City Lab Rust/WASM CPU comparison','',`Generated: ${data.environment.date}. Node ${data.environment.node}; ${data.environment.cpu}.`,'',`Parity gates: **${data.correctness?.passed?'PASS':'FAIL'}**. Shared baseline quality audit: **${data.correctness?.qualityPassed?'PASS':'FINDINGS'}**. Completed timed comparison: **${data.completed?'yes':'no'}**. No certified end-to-end speedup.`, ''];
  if(data.failure)lines.push('```text',data.failure,'```','');
  lines.push('## Cold process initialization','', '| Repeat | Read ms | Compile ms | Instantiate ms | Core init ms | Load total ms | Process wall ms |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for(const r of data.cold)lines.push(`| ${r.repeat} | ${n(r.load.readMs)} | ${n(r.load.compileMs)} | ${n(r.load.instantiateMs)} | ${n(r.load.initMs)} | ${n(r.load.totalMs)} | ${n(r.processWallMs)} |`);
  lines.push('','## Warmed serial CPU phases','', 'Medians pool the listed fixture samples; use per-fixture rows in `comparison.json` for matched comparisons. Ratio is the median of paired JS/Rust wall-time ratios, not a city/rendering speedup.','', '| Phase | Fixtures / pairs | JS median ms | Rust median ms | Paired JS/Rust |','| --- | ---: | ---: | ---: | ---: | ---: |');
  for(const r of data.summaries||[])lines.push(`| ${r.phase} | ${r.fixtures} / ${r.samples} | ${n(r.jsMs.median)} | ${n(r.rustMs.median)} | ${n(r.pairedJsOverRustRatio.median)} |`);
  lines.push('','## Shared JavaScript work (unchanged)','', '| Phase | Mode | Samples | Median ms |','| --- | --- | ---: | ---: |');
  for(const phase of ['shared.BuildingPlan.generate','shared.BuildingVoxels.build'])for(const mode of ['','exterior','full']){const rows=data.shared.filter(r=>r.phase===phase&&(r.context.mode||'')===mode);if(rows.length)lines.push(`| ${phase} | ${mode||'plan'} | ${rows.length} | ${n(median(rows.map(r=>r.ms)))} |`);}
  lines.push('','## Correctness and limits','', 'Coverage: `'+JSON.stringify(data.correctness?.coverage||{})+'`.','',`Shared party-wall depth findings: ${data.correctness?.qualityFindings.length||0} matrix cases. Full examples and actual parcel counts are in JSON; they are not removed or repaired by this comparison.`, '');
  for(const limit of data.limitations)lines.push('- '+limit);
  if(data.finalWasm)lines.push('',`Final ABI allocations: ${data.finalWasm.liveAllocations}; live bytes: ${data.finalWasm.liveBytes}; retained linear memory: ${data.finalWasm.memoryBytes} bytes.`);
  return lines.join('\n')+'\n';
}
async function main(){
  if(process.argv.includes('--cold-child'))return coldChild();
  const args=process.argv.slice(2);assert.ok(args.every(a=>a==='--bounded'||/^--(?:repeats|cold-repeats)=\d+$/.test(a)),'Options: --bounded --repeats=3 --cold-repeats=3');
  assert.ok(fs.statSync(OUT).isDirectory(),'Create output/city-rust-comparison first');
  const option=(key,fallback)=>Number(args.find(a=>a.startsWith('--'+key+'='))?.split('=')[1]||fallback);
  if(args.includes('--bounded')){const data=await bounded({repeats:option('repeats',3)});fs.writeFileSync(path.join(OUT,'bounded.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({completed:data.completed,rows:data.rows.length,sharedRows:data.shared.length,output:path.relative(ROOT,path.join(OUT,'bounded.json'))},null,2));return;}
  const data=await profile({repeats:option('repeats',3),coldRepeats:option('cold-repeats',3)});
  fs.writeFileSync(path.join(OUT,'comparison.json'),JSON.stringify(data,null,2)+'\n');fs.writeFileSync(path.join(OUT,'comparison.md'),markdown(data));
  console.log(JSON.stringify({completed:data.completed||false,parity:data.correctness?.passed,rows:data.rows.length,sharedRows:data.shared.length,output:path.relative(ROOT,OUT),failure:data.failure||null},null,2));
  if(!data.correctness?.passed||!data.completed)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={profile,bounded,markdown};
