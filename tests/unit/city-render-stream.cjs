'use strict';
// CPU-only execution of the real frontend with DOM/renderer/worker doubles.
// No browser, GL driver, worker CPU benchmark or UI acceptance is implied.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../prototypes/labs/city-lab/city-lab.js'),'utf8'),S=require('../../prototypes/labs/city-lab/city-stream.js'),R=require('../../prototypes/labs/building-lab/renderer.js');
async function harness({mode='facade',engine='js',count=7,access=null}={}){
  let clock=0,raf,nav=null,targetMode=mode,voxelSize=.5,near=false;
  const elements=new Map(),workers=[],views=[],uploaded=[],rays=new Map(),city={terrain:'flat',extent:100,width:1,footway:1,target:count,parcels:Array.from({length:count},(_,id)=>({id,block:0,width:10,depth:10,options:{party:[false,false]},envelope:{front:0},polygon:[]})),blocks:[],edges:[],nodes:[],landmarks:{plaza:{polygon:[]},gate:{z:20},castle:{z:-20}}};
  function el(id){if(!elements.has(id))elements.set(id,{value:({engine,mode:'stream',backend:'sparse',seed:'1',terrain:'flat',layout:'woven',width:'1',count:String(count)})[id]||'',clientHeight:600,clientWidth:800,textContent:'',setAttribute(){},focus(){}});return elements.get(id);}
  const renderer={state:{segments:[],target:[0,0,0],walkEye:null,yaw:0,pitch:.68,dist:100,lastFrameMs:0,gpuFrameMs:null},rayAvailable:true,
    setScene(){this.state.segments=[];rays.clear();},forward(){return R.cameraForward(this.state);},draw(){},rayBytes:()=>[...rays.values()].reduce((n,v)=>n+v.bytes,0),
    putMesh(m){this.dropMesh(m.id);this.state.segments.push({id:m.id,bytes:m.verts.byteLength+m.idx.byteLength});uploaded.push(m.id);},
    putRay(id,v){this.dropMesh(id);rays.set(id,v);uploaded.push(id);},dropMesh(id){this.state.segments=this.state.segments.filter(s=>s.id!==id);rays.delete(id);},setVisible(){}};
  class Worker{constructor(){this.sent=[];this.terminated=false;workers.push(this);}postMessage(d){this.sent.push(d);}terminate(){this.terminated=true;}reply(d){clock+=10;this.onmessage({data:d});}}
  const policy={generate:()=>city,validate:()=>[],metrics:()=>({}),prefetch:()=>nav,targets(c,e,old,m,p,view){views.push(view);return new Map(c.parcels.map(p=>[p.id,{mode:targetMode,near,voxelSize,distance:p.id+10,projected:100}]));}};
  const window={CityModel:{density:()=>({pass:true,complete:true,ratio:1,target:.8,available:10,footprint:8})},CityGeometry:{environment:()=>({}),accessMesh:()=>access},BuildingVoxels:{M:{},palette:()=>new Uint8Array(1024)},BuildingWalk:{direction:()=>[0,0],BODY:{speed:1,eye:1.6}},CityStream:S,CityGreen:{generate:()=>({plants:[],parkArea:0,plazaArea:0}),mesh:()=>({})},CityWalk:{create:()=>({leave(){}})},CityRust:{load:async()=>({dispose(){}}),createAdapter:()=>policy},BuildingRenderer:{createRenderer:()=>renderer},devicePixelRatio:1,addEventListener(){}};
  vm.runInNewContext(source,{window,document:{getElementById:el,querySelectorAll:()=>[]},Worker,performance:{now:()=>++clock},URLSearchParams,location:{search:''},history:{replaceState(){}},requestAnimationFrame:f=>{raf=f;},console});
  await Promise.resolve();await Promise.resolve();
  const app=window.__cityLab,state=app.state;
  function ready(w=workers.at(-1)){w.reply({epoch:state.epoch,engine:state.engine,type:'ready',init:{totalMs:1}});}
  function tick(){clock+=400;raf(clock);}
  function result(job,extra={}){return {epoch:job.epoch??state.epoch,engine:job.engine??state.engine,id:job.parcel.id,mode:job.mode,voxelSize:job.voxelSize,mesh:{id:'building:'+job.parcel.id,verts:new Uint16Array(4),idx:new Uint32Array(0),quads:0},bounds:{lo:[0,0,0],hi:[1,1,1]},summary:{footprint:1},timings:{plan:1},voxelBytes:0,engineMetrics:{totalMs:2,sharedMs:1,transport:{}},...extra};}
  return {app,state,workers,views,uploaded,rays,renderer,ready,tick,result,el,setNav:v=>{nav=v;},setNear:v=>{near=v;},setTarget:(mode,size=.5)=>{targetMode=mode;voxelSize=size;}};
}
(async()=>{
  for(const engine of ['js','rust']){
    const h=await harness({engine});h.ready();const w=h.workers[0],s=h.state;
    assert.equal(s.inflight.size,3,'three light jobs sent before any receive');assert.equal(w.sent.length,4,'init plus bounded jobs');assert.equal(s.pending,[...s.inflight.values()][0],'legacy pending remains the oldest job');
    h.tick();h.tick();assert.equal(w.sent.length,4,'periodic scheduling cannot duplicate inflight parcels');
    const outOfOrder=[...s.inflight.values()][1];w.reply(h.result(outOfOrder));assert.equal(s.completed,1);assert.equal(s.inflight.size,3,'light pipeline refills after receiving any matching parcel');assert.equal(s.pending.parcel.id,0);
    assert.ok(h.views.every(v=>v.height===600&&v.aspect===800/600&&v.fov===.62&&v.forward.length===2));
    assert.ok(Math.abs(h.views[0].forward[0]+Math.sin(-.55))<1e-10&&Math.abs(h.views[0].forward[1]-Math.cos(-.55))<1e-10,'orbit forward matches the existing initial camera yaw, not walking yaw signs');
    let guard=0;while(s.inflight.size&&guard++<30){const job=s.inflight.values().next().value;assert.equal(job.engine,undefined,'engine is on the wire, not an alternate CPU fallback');w.reply(h.result({...job,epoch:s.epoch,engine:s.engine}));assert.ok(s.inflight.size<=3);}
    assert.ok(s.ready);assert.equal(s.completed,7);assert.equal(s.inflight.size,0);assert.equal(h.app.snapshot().pending,null);assert.equal(h.app.snapshot().pendingCount,0);assert.equal(h.app.snapshot().scheduling.peakInflight,3);
    assert.equal(w.sent.filter(j=>j.parcel).length,7);assert.ok(w.sent.every(j=>j.engine===engine));
    const phases=h.app.snapshot().jobPhases;assert.equal(phases.length,7);assert.ok(phases.every(p=>p.workerMs===2&&p.roundTripMs>=2&&p.queuedMs>=0&&p.receiveMs>=p.uploadMs&&p.receiveNonUploadMs>=0));
    // No nearby exterior job prefetches a full interior without a doorway request.
    assert.equal(s.interiorJobs,0);
    h.app.camera({walkEye:[0,1.6,0],yaw:.4,pitch:.2});h.tick();const view=h.views.at(-1);assert.equal(view.height,600);assert.equal(view.fov,70*Math.PI/180);assert.ok(Math.abs(view.forward[0]-Math.sin(.4))<1e-10&&Math.abs(view.forward[1]-Math.cos(.4))<1e-10,'walking view forwards renderer look direction without orbit sign inversion');
  }
  {
    const h=await harness({mode:'exterior',count:4});h.ready();const w=h.workers[0],s=h.state;let guard=0,sawDense=false;
    while(s.inflight.size&&guard++<30){const job=s.inflight.values().next().value;if(job.mode==='exterior'){sawDense=true;assert.equal(s.inflight.size,1,'dense exterior work is exclusive');}w.reply(h.result({...job,epoch:s.epoch,engine:s.engine}));}
    assert.ok(sawDense&&s.ready);assert.equal(w.sent.filter(j=>j.mode==='exterior').length,4);assert.equal(w.sent.filter(j=>j.mode==='facade').length,4,'cold facades still arrive before detail');
  }
  {
    const h=await harness({mode:'exterior',count:1});h.ready();const w=h.workers[0],s=h.state;
    w.reply(h.result(s.pending));const job=s.pending,wire=w.sent.at(-1);
    assert.equal(job.near,false);assert.equal(wire.sparse,true,'mid-range full-resolution exteriors use compact bricks, not large triangle buffers');
    assert.equal(wire.includeNavigation,false,'more exterior detail cannot request interior data');
    assert.equal(job.key,'exterior:sparse');h.setNear(true);h.tick();
    w.reply(h.result(job,{ray:{bytes:1024}}));assert.equal(s.stale,0,'close flag changes do not reject identical sparse exterior geometry');
    assert.equal(s.details.get(0).ray,true);assert.equal(s.details.get(0).key,'exterior:sparse');
    h.setNear(false);h.tick();assert.equal(w.sent.filter(j=>j.mode==='exterior').length,1,'crossing the close/mid boundary does not regenerate the same bricks');
    assert.equal(s.interiorJobs,0);assert.equal(s.walkData.size,0);assert.equal(s.peakVoxelBytes,0);
  }
  for(const backend of ['greedy','sparse-unavailable']){
    const h=await harness({mode:'exterior',count:1});if(backend==='greedy')h.el('backend').value='greedy';else h.renderer.rayAvailable=false;
    h.ready();const w=h.workers[0];w.reply(h.result(h.state.pending));assert.equal(w.sent.at(-1).sparse,false,'greedy fallback stays explicit when sparse is not selected/available');
    assert.equal(h.state.pending.key,'exterior:mid');w.reply(h.result(h.state.pending));assert.ok(h.state.ready);
  }
  {
    const h=await harness({mode:'exterior',count:1});h.ready();const w=h.workers[0],s=h.state;
    w.reply(h.result(s.pending));h.renderer.putRay=()=>{throw new Error('test upload failure');};
    w.reply(h.result(s.pending,{ray:{bytes:1024}}));assert.equal(s.details.get(0).mode,'facade','failed ray upload keeps the previous recognizable facade');
    assert.equal(s.sparseFailures.has(0),true);assert.equal(w.sent.at(-1).sparse,false,'failed sparse upload retries once with greedy geometry');
    assert.equal(s.pending.key,'exterior:mid');w.reply(h.result(s.pending));assert.ok(s.ready);assert.equal(s.details.get(0).ray,false);
  }
  {
    const h=await harness();h.ready();const w=h.workers[0],s=h.state;h.setNav(0);h.tick();assert.equal(s.navRequest,0);const before=w.sent.length;
    while([...s.inflight.values()].some(j=>j.mode==='facade')){const job=s.inflight.values().next().value;w.reply(h.result({...job,epoch:s.epoch,engine:s.engine}));if(s.inflight.size>1)assert.equal(w.sent.length,before,'do not refill light work ahead of doorway');}
    assert.equal(s.inflight.size,1);const full=s.pending;assert.equal(full.mode,'full');assert.equal(full.parcel.id,0);assert.equal(s.interiorJobs,1);
    h.tick();h.tick();assert.equal(s.interiorJobs,1,'no duplicate full job while it is pending');
    h.setNav(null);h.tick();w.reply(h.result({...full,epoch:s.epoch,engine:s.engine}));assert.equal(s.stale,1,'cancelled full payload is discarded before upload');assert.equal(s.interior,null);assert.ok(!h.uploaded.some(id=>id.startsWith('interior:')));
  }
  {
    const h=await harness({count:1});h.ready();const w=h.workers[0];w.reply(h.result(h.state.pending));assert.equal(h.state.interior,null);h.setNav(0);h.tick();const full=h.state.pending;h.state.uploads=Array(600).fill(0);
    w.reply(h.result(full,{ray:{bytes:1024},walkData:{building:{vol:new Uint8Array(4)}},doorMesh:{id:'door:0',verts:new Uint16Array(4),idx:new Uint32Array(0)}}));assert.ok(h.state.interior);assert.ok(h.state.phases.at(-1).uploadMs>0,'interior upload phase survives a full telemetry ring');assert.equal(h.state.uploads.length,600);assert.equal(h.state.interior.open,false,'prefetch does not open the closed door');assert.equal(h.state.walkData.size,1);h.tick();assert.equal(h.state.interiorJobs,1);h.setNav(null);h.tick();assert.equal(h.state.interior,null);assert.equal(h.state.walkData.size,0);assert.equal(h.rays.size,0,'departing doorway releases the resident interior');
  }
  {
    const h=await harness({mode:'low',count:1});h.ready();const old=h.state.pending,w=h.workers[0];h.setTarget('low',2);h.tick();w.reply(h.result({...old,epoch:h.state.epoch,engine:'js'}));assert.equal(h.state.stale,1,'changed low resolution invalidates a queued old reply');assert.equal(h.uploaded.length,0);assert.equal(h.state.pending.voxelSize,2);
  }
  {
    const h=await harness({count:1});h.ready();const job=h.state.pending;h.workers[0].reply(h.result({...job,epoch:h.state.epoch,engine:'js'},{ray:{bytes:128*1048576+1}}));assert.equal(h.uploaded.length,0);assert.match(h.state.errors[0],/128 MiB/);assert.equal(h.state.inflight.size,0,'budget failure settles without an unbounded retry');
  }
  {
    const h=await harness();h.ready();const old=h.state.pending,w=h.workers[0],epoch=h.state.epoch;await h.el('rebuild').onclick();assert.ok(w.terminated);assert.equal(h.state.inflight.size,0);assert.equal(h.state.epoch,epoch+1);
    w.reply(h.result({...old,epoch,engine:'js'}));assert.equal(h.state.stale,1);assert.equal(h.uploaded.length,0);h.ready();assert.equal(h.state.inflight.size,3);
    h.workers.at(-1).reply({epoch:h.state.epoch,engine:'rust',id:0,mode:'facade'});assert.match(h.state.engineError,/engine mismatch/);assert.equal(h.state.inflight.size,0);assert.ok(h.workers.at(-1).terminated);
  }
  {
    const h=await harness();h.ready();h.setTarget('low',2);h.tick();assert.equal(h.app.snapshot().scheduling.cancelled,4,'abandoned queued identities are counted once');h.tick();assert.equal(h.app.snapshot().scheduling.cancelled,4);
    Object.assign(h.renderer.state,{rayEnabled:6,rayDraws:2,shadowRayDraws:5,shadowCached:false});let r=h.app.snapshot().renderMetrics;assert.equal(r.mainRayCulled,4);assert.equal(r.shadowRayCulled,1);h.renderer.state.shadowCached=true;assert.equal(h.app.snapshot().renderMetrics.shadowRayCulled,null);
  }
  {
    const h=await harness({count:1});h.ready();
    for(const name of ['engineJobs','timings','uploads','phases'])h.state[name]=Array(600).fill({});
    h.workers[0].reply(h.result(h.state.pending));
    for(const name of ['engineJobs','timings','uploads','phases'])assert.equal(h.state[name].length,600,'bounded recent telemetry '+name);
    assert.equal(h.app.snapshot().telemetryLimit,600);
  }
  {
    const h=await harness({mode:'low',count:1,access:{verts:{byteLength:128*1048576},idx:{byteLength:0}}});h.ready();
    h.workers[0].reply(h.result(h.state.pending));assert.equal(h.uploaded.length,0,'access meshes count toward pre-upload cap');assert.match(h.state.errors[0],/128 MiB/);
  }
  {
    const h=await harness({count:1});h.ready();const old={id:'building:0',bytes:128*1048576-4};h.renderer.state.segments.push(old);
    h.workers[0].reply(h.result(h.state.pending));assert.equal(h.uploaded.length,0,'replacement peak counts old resident buffers until swap');assert.ok(h.renderer.state.segments.includes(old));
  }
  {
    const h=await harness({mode:'exterior',count:64});h.renderer.state.segments.push({id:'environment',bytes:96*1048576});h.ready();const s=h.state,w=h.workers[0];let guard=0;
    while(s.inflight.size&&guard++<200){const job=s.pending;w.reply(h.result(job,job.mode==='exterior'?{ray:{bytes:.75*1048576}}:{}));
      const bytes=h.renderer.rayBytes()+h.renderer.state.segments.reduce((n,v)=>n+v.bytes,0);assert.ok(bytes<=128*1048576,'expanded residency never admits geometry beyond 128 MiB');
    }
    assert.ok(s.ready&&s.completed===64);assert.ok(h.rays.size>=40,'compact exteriors increase admitted detail even under deliberately high base pressure');
    assert.ok(s.failed.size>0,'pressure fixture reaches the cap rather than silently avoiding it');
    assert.ok([...s.details.values()].some(t=>t.mode==='facade'),'budget-refused upgrades retain recognizable facades');
  }
  console.log('bounded light pipeline, exclusive dense work, doorway drain/cancellation, identity/epoch guards, budget, camera view and phase metrics (CPU doubles only)');
})().catch(e=>{console.error(e);process.exitCode=1;});
