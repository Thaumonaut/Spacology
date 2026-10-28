(function(){
  'use strict';
  const C=window.CityModel,G=window.CityGeometry,V=window.BuildingVoxels,W=window.BuildingWalk,S=window.CityStream,$=id=>document.getElementById(id),canvas=$('city'),MiB=1048576,BUDGET=128*MiB;
  const LIGHT_JOBS=3,TELEMETRY_LIMIT=600,isLight=job=>job.mode==='facade'||job.mode==='low';
  function recent(list,value){list.push(value);if(list.length>TELEMETRY_LIMIT)list.splice(0,list.length-TELEMETRY_LIMIT);}
  const state={epoch:0,city:null,queue:[],pending:null,inflight:new Map(),schedule:{calls:0,ms:0,posted:0,peakInflight:0,cancelled:0},phases:[],ready:false,completed:0,settled:new Set(),errors:[],summaries:{},groups:new Map(),graphFindings:[],timings:[],frames:[],uploads:[],selected:null,mode:'stream',stale:0,peakVoxelBytes:0,residentVoxelBytes:0};
  state.details=new Map();state.targets=new Map();state.failed=new Map();state.walkData=new Map();state.inside=null;state.sparseFailures=new Set();
  let renderer,worker,policy,mainCore,last=0,lastStats=0,lastStream=0,drag=null;const keys=new Set(),query=new URLSearchParams(location.search);
  for(const id of ['seed','terrain','layout','width','count','mode','backend','engine'])if(query.has(id))$(id).value=query.get(id);
  if(!['js','rust'].includes($('engine').value))$('engine').value='js';
  if(!['exterior','detailed','stream'].includes($('mode').value))$('mode').value='stream';
  function fatal(e){state.engineError=String(e.message||e);state.initializing=false;state.workerReady=false;state.pending=null;state.inflight.clear();state.queue=[];if(worker)worker.terminate();state.ready=false;recent(state.errors,state.engineError);$('status').textContent=`${state.engine==='rust'?'Rust/WASM':'JavaScript'} engine failed: ${state.engineError}`;$('metrics').textContent='Selected engine unavailable. No JavaScript engine fallback.';$('findings').textContent=state.errors.join('\n');}
  function makeWorker(){const epoch=state.epoch;state.workerCreatedAt=performance.now();worker=new Worker('labs/city-lab/city-worker.js');worker.onmessage=reply;worker.onerror=e=>{if(epoch===state.epoch)fatal(e.message||'Worker failure');};worker.postMessage({type:'init',epoch,engine:state.engine});}
  function sparseTarget(t,id){return (t.mode==='exterior'||t.mode==='full')&&$('backend').value==='sparse'&&renderer.rayAvailable&&!state.sparseFailures.has(id);}
  function targetKey(t,id){return t.mode==='exterior'&&sparseTarget(t,id)?'exterior:sparse':S.key(t);}
  function status(){if(state.engineError)return;const c=state.city;if(!c){$('status').textContent=`Initializing ${state.engine==='rust'?'Rust/WASM':'JavaScript'} engine…`;return;}$('status').textContent=`${state.engine==='rust'?'Rust/WASM':'JavaScript'} · ${c.terrain==='flat'?'Flat baseline':'Uneven terrain'} · ${state.completed}/${c.parcels.length} buildings · ${!state.workerReady?'initializing worker':state.pending?'generating':state.ready?'ready':'queued'}${state.errors.length?' · '+state.errors.length+' findings':''}`;
    const d=C.density(c,state.summaries);$('findings').textContent=[...state.graphFindings,...(c.shortfall?[`Only ${c.parcels.length}/${c.target} plots fit; no overlap allowed.`]:[]),...(state.ready&&!d.pass?[`DENSITY FAIL: ${(d.ratio*100).toFixed(1)}% actual footprint; target ${Math.round(d.target*100)}%. Missing buildings and empty paved plots do not count.`]:[]),...state.errors].join('\n')||'Graph connected. Parcels inside buildable blocks; no overlaps. Actual-mask density target met.';}
  function drawMap(){const c=state.city,E=c.extent,colour={craft:'#696e87',market:'#bd9467',harbour:'#66947e',residential:'#9387a1'},points=p=>p.map(a=>a.join(',')).join(' ');$('map').setAttribute('viewBox',`${-E} ${-E} ${E*2} ${E*2}`);
    $('map').innerHTML=`${c.blocks.map(b=>`<polygon points="${points(b.buildable)}" fill="${colour[b.district]}" opacity=".22"/>`).join('')}${c.edges.map(e=>{const a=c.nodes[e.a],b=c.nodes[e.b];return `<path d="M${a.x},${a.z} L${b.x},${b.z}" stroke="${e.kind==='avenue'?'#c6bba0':e.kind==='lane'?'#626d5b':'#8b9583'}" stroke-width="${e.width}"/>`;}).join('')}<polygon points="${points(c.landmarks.plaza.polygon)}" fill="#c6bba0"/>${c.parcels.map(p=>`<polygon class="plot${p.id===state.selected?' selected':''}" data-id="${p.id}" role="button" tabindex="0" aria-label="Building ${p.id+1}, ${p.type}, ${p.district}" points="${points(p.polygon)}" fill="${colour[p.district]}"/>`).join('')}<text x="0" y="2" text-anchor="middle">PLAZA</text><text x="0" y="${c.landmarks.gate.z+8}" text-anchor="middle">MAIN GATE</text><text x="0" y="${c.landmarks.castle.z-6}" text-anchor="middle">CASTLE</text>`;}
  async function build(){const epoch=++state.epoch;if(worker)worker.terminate();worker=null;mainCore?.dispose();mainCore=null;state.engine=$('engine').value;state.workerReady=false;state.initializing=true;state.engineError=null;state.city=null;state.engineJobs=[];state.mainInit=null;state.workerInit=null;state.mainShared={};state.pending=null;state.inflight.clear();state.schedule={calls:0,ms:0,posted:0,peakInflight:0,cancelled:0};state.phases=[];state.ready=false;state.completed=0;state.settled.clear();state.errors=[];state.summaries={};state.groups.clear();state.walkData.clear();state.inside=null;state.interiorJobs=0;state.timings=[];state.frames=[];state.uploads=[];state.peakVoxelBytes=0;state.selected=null;state.mode=$('mode').value;state.queue=[];state.navRequest=null;state.interior=null;status();
    const q=new URLSearchParams();for(const id of ['seed','terrain','layout','width','count','mode','backend','engine'])q.set(id,$(id).value);history.replaceState(null,'','?'+q);
    try{
    policy=null;state.sharedWalkMs=0;
    const core=state.engine==='rust'?await window.CityRust.load():null;
    if(epoch!==state.epoch){core?.dispose();return;}mainCore=core;policy=window.CityRust.createAdapter(state.engine,core);state.mainInit=core?.loadTimings||null;
    const cityStart=performance.now();state.city=policy.generate(Number($('seed').value),{terrain:$('terrain').value,layout:$('layout').value,width:Number($('width').value),count:Number($('count').value)});state.graphFindings=policy.validate(state.city);state.mainPolicyMs=performance.now()-cityStart;
    if(state.mode==='detailed'&&state.city.parcels.length>24){recent(state.errors,'All-detailed exterior comparison is limited to 24 buildings by the 128 MiB geometry budget. Switched to camera-driven streaming.');state.mode='stream';$('mode').value='stream';}
    q.set('mode',$('mode').value);history.replaceState(null,'','?'+q);
    let shared=performance.now();state.city.green=window.CityGreen.generate(state.city);state.mainShared.vegetationPlanMs=performance.now()-shared;
    shared=performance.now();const environment=G.environment(state.city,V.M);state.mainShared.environmentMs=performance.now()-shared;
    shared=performance.now();const vegetation=window.CityGreen.mesh(state.city,V.M);state.mainShared.vegetationMeshMs=performance.now()-shared;
    shared=performance.now();renderer.setScene([environment,vegetation],state.city.extent,V.palette());state.mainShared.sceneUploadMs=performance.now()-shared;renderer.state.glow=V.M.lantern_glow;renderer.state.paper=V.M.shoji;renderer.state.walkEye=null;renderer.state.pitch=.68;renderer.state.yaw=-.55;$('view').textContent='Street view';$('movement').hidden=true;$('enter').hidden=true;
    if($('backend').value==='sparse'&&!renderer.rayAvailable)recent(state.errors,'Sparse renderer unavailable; using greedy meshes. '+(renderer.state.rayError||''));
    $('selection').innerHTML='<option value="">Choose a plot</option>'+state.city.parcels.map(p=>`<option value="${p.id}">${p.id+1} · ${p.district} · ${p.type}</option>`).join('');$('inspect').hidden=true;$('selected').textContent='Select a plot to inspect its source building.';drawMap();
    makeWorker();status();
    }catch(e){if(epoch===state.epoch)fatal(e);}
  }
  function refresh(){
    if(state.streamEpoch!==state.epoch){state.details.clear();state.targets.clear();state.failed.clear();state.sparseFailures.clear();state.streamEpoch=state.epoch;}
    const requested=policy.prefetch(renderer.state.walkEye,state.summaries,state.navRequest,!!state.inside);
    if(requested!==state.navRequest){releaseInterior();state.navRequest=requested;if(requested!==null)state.failed.delete(requested);}
    state.targets=policy.targets(state.city,S.eye(renderer.state),state.targets,state.mode,state.navRequest,{height:canvas.clientHeight*Math.min(2,window.devicePixelRatio||1),aspect:canvas.clientWidth/canvas.clientHeight,fov:renderer.state.walkEye?70*Math.PI/180:.62,forward:renderer.forward()});
    // Keep the existing geometry visible until its replacement has actually arrived.
    const queuedAt=new Map(state.queue.map(j=>[j.parcel.id+':'+j.key,j.queuedAt])),now=performance.now(),jobs=[];
    if(state.navRequest!==null&&!state.interior&&state.failed.get(state.navRequest)!=='full')jobs.push({parcel:state.city.parcels[state.navRequest],mode:'full',near:true,voxelSize:.5,key:'full',priority:-1e6});
    for(const p of state.city.parcels){const target=state.targets.get(p.id),base=state.groups.get(p.block)?.get(p.id),detail=state.details.get(p.id),cold=!state.settled.has(p.id),t=cold&&target.mode==='exterior'?{...target,mode:'facade'}:target,key=targetKey(t,p.id);
      if(detail?.key===key||!detail&&t.mode==='low'&&base?.voxelSize===t.voxelSize||state.failed.get(p.id)===key)continue;
      jobs.push({parcel:p,mode:t.mode,near:t.near,voxelSize:t.voxelSize,key,priority:(target.mode==='full'?-1:cold?(t.mode==='facade'?0:2):target.mode==='exterior'?.5:target.mode==='facade'?1:3)*1e6+target.distance});}
    const retained=new Set(jobs.map(j=>j.parcel.id+':'+j.key));for(const key of queuedAt.keys())if(!retained.has(key))state.schedule.cancelled++;
    state.queue=jobs.filter(j=>!state.inflight.has(j.parcel.id)).map(j=>({...j,queuedAt:queuedAt.get(j.parcel.id+':'+j.key)??now})).sort((a,b)=>a.priority-b.priority||a.parcel.id-b.parcel.id);
  }
  function next(){if(!state.workerReady||state.engineError)return;const started=performance.now();try{
    refresh();
    // The worker is synchronous. Only cheap facade/low jobs may queue ahead of
    // main-thread uploads; at most three transferred replies can accumulate.
    // Drain that small queue for a doorway, and never enqueue behind dense work.
    const doorway=state.navRequest!==null&&!state.interior&&state.failed.get(state.navRequest)!=='full';
    if(state.inflight.size&&(doorway||[...state.inflight.values()].some(j=>!isLight(j))))return;
    while(state.inflight.size<LIGHT_JOBS&&state.queue.length){
      const job=state.queue[0];if(!isLight(job)&&state.inflight.size)break;state.queue.shift();
      state.ready=false;job.sentAt=performance.now();job.inflightAtSend=state.inflight.size;state.inflight.set(job.parcel.id,job);state.pending=state.inflight.values().next().value||null;
      state.schedule.posted++;state.schedule.peakInflight=Math.max(state.schedule.peakInflight,state.inflight.size);if(job.mode==='full')state.interiorJobs++;
      worker.postMessage({epoch:state.epoch,engine:state.engine,extent:state.city.extent,sparse:sparseTarget(job,job.parcel.id),includeNavigation:job.mode==='full',...job});
      if(!isLight(job))break;
    }
    state.ready=state.completed===state.city.parcels.length&&!state.inflight.size&&!state.queue.length;
    }catch(e){fatal(e);}finally{state.schedule.calls++;state.schedule.ms+=performance.now()-started;status();}}
  function finishReceive(phase,started){phase.receiveMs=performance.now()-started;phase.receiveNonUploadMs=Math.max(0,phase.receiveMs-phase.uploadMs);recent(state.phases,phase);next();}
  function repaint(blockId){const group=state.groups.get(blockId);if(!group)return;
    const meshes=[...group].filter(([id])=>!state.details.has(id)&&!(state.interior?.id===id&&(state.interior.open||state.inside))).map(([,m])=>m).concat([...group.values()].map(m=>m.access).filter(Boolean)),id='block:'+blockId;
    if(!meshes.length){renderer.dropMesh(id);return;}
    const bytes=meshes.reduce((n,m)=>n+m.verts.byteLength+m.idx.byteLength,0),resident=renderer.state.segments.reduce((n,m)=>n+m.bytes,0)+renderer.rayBytes();
    if(resident+bytes>BUDGET){recent(state.errors,'128 MiB geometry budget reached while rebuilding block; retaining available geometry.');return false;}
    const verts=new Uint16Array(meshes.reduce((n,m)=>n+m.verts.length,0)),idx=new Uint32Array(meshes.reduce((n,m)=>n+m.idx.length,0));let nv=0,ni=0,quads=0;
    for(const m of meshes){verts.set(m.verts,nv);for(let k=0;k<m.idx.length;k++)idx[ni+k]=m.idx[k]+nv/4;nv+=m.verts.length;ni+=m.idx.length;quads+=m.quads;}
    renderer.putMesh({id,verts,idx,quads,model:meshes[0].model});
  }
  function reply({data:d}){if(d.epoch!==state.epoch){state.stale++;return;}if(state.engineError)return;
    if(d.engine!==state.engine){fatal('Worker engine mismatch; no fallback permitted.');return;}
    if(d.type==='init-error'){fatal(d.error);return;}
    if(d.type==='ready'){const readyLatencyMs=performance.now()-state.workerCreatedAt;state.workerInit={...d.init,readyLatencyMs,bootstrapAndSchedulingMs:Math.max(0,readyLatencyMs-d.init.totalMs)};state.workerReady=true;state.initializing=false;next();return;}
    const job=state.inflight.get(d.id);if(!job||job.mode!==d.mode)return;
    const receivedAt=performance.now(),roundTripMs=receivedAt-job.sentAt,workerMs=d.engineMetrics?.totalMs??null,phase={id:d.id,mode:d.mode,queuedMs:job.sentAt-job.queuedAt,inflightAtSend:job.inflightAtSend,roundTripMs,workerMs,transferAndSchedulingMs:workerMs===null?null:Math.max(0,roundTripMs-workerMs),uploadMs:0,stale:false};
    state.inflight.delete(d.id);state.pending=state.inflight.values().next().value||null;const p=job.parcel;
    if(d.engineMetrics)recent(state.engineJobs,{...d.engineMetrics,roundTripMs,transferAndSchedulingMs:phase.transferAndSchedulingMs});
    // Includes worker queue wait and main-thread event-loop delay, NOT pure
    // transfer time. Worker timestamps are not available in this contract.
    const target=state.targets.get(d.id),obsolete=!target||(d.mode==='facade'?target.mode!=='facade'&&target.mode!=='exterior':targetKey(target,d.id)!==job.key);
    if(d.mode==='full'?state.navRequest!==d.id:obsolete){state.stale++;phase.stale=true;finishReceive(phase,receivedAt);return;}
    if(d.mode==='full'){phase.uploadMs=cacheInterior(d,job)||0;finishReceive(phase,receivedAt);return;}
    if(d.summary?.entry)p.entry=d.summary.entry;
    if(d.error){recent(state.errors,`Building ${d.id+1}: ${d.error}`);state.failed.set(d.id,job.key);}else{
      const bytes=d.ray?d.ray.bytes:d.mesh.verts.byteLength+d.mesh.idx.byteLength,resident=renderer.state.segments.reduce((s,m)=>s+m.bytes,0)+renderer.rayBytes(),group=new Map(state.groups.get(p.block)||[]);
      const access=d.mode==='low'?G.accessMesh(state.city,p):null;
      if(d.mode==='low')group.set(d.id,{...d.mesh,access});
      // Replacement uploads are transactional: the old geometry stays alive
      // until the new buffers exist. Count that peak, ALL access meshes and the
      // rebuilt block, not just final residency after subtracting old buffers.
      const groupBytes=[...group].reduce((n,[id,m])=>n+(m.access?m.access.verts.byteLength+m.access.idx.byteLength:0)+((id===d.id?d.mode==='low':!state.details.has(id))&&!(state.interior?.id===id&&(state.interior.open||state.inside))?m.verts.byteLength+m.idx.byteLength:0),0);
      if(resident+groupBytes+(d.mode==='low'?0:bytes)>BUDGET){recent(state.errors,`Building ${d.id+1}: 128 MiB geometry budget reached; retaining available coarse geometry.`);state.failed.set(d.id,job.key);}else{
        state.summaries[d.id]={...d.summary,mode:d.mode,voxelSize:d.voxelSize,bytes,quads:d.mesh.quads,timings:d.timings,bounds:d.bounds};
        const t=performance.now();if(d.mode!=='low'){
          if(d.ray)try{renderer.putRay(d.mesh.id,d.ray);}catch(e){state.sparseFailures.add(d.id);recent(state.errors,`Building ${d.id+1}: sparse upload unavailable; retrying greedy mesh (${e.message}).`);phase.uploadMs=performance.now()-t;finishReceive(phase,receivedAt);return;}else renderer.putMesh(d.mesh);
          state.details.set(d.id,{key:job.key,mode:d.mode,bytes,ray:!!d.ray});
        }else{if(!state.groups.has(p.block))state.groups.set(p.block,new Map());state.groups.get(p.block).set(d.id,{...d.mesh,access,voxelSize:d.voxelSize});state.details.delete(d.id);renderer.dropMesh(d.mesh.id);}repaint(p.block);syncInterior(true,false);phase.uploadMs=performance.now()-t;recent(state.uploads,phase.uploadMs);
        const {lo,hi}=d.bounds;if(lo[0]<-(p.options.party[0]?.075:.26)||hi[0]>p.width+(p.options.party[1]?.075:.26)||lo[2]<-p.envelope.front-.01||hi[2]>p.depth+.26)recent(state.errors,`Building ${d.id+1}: geometry extends beyond its reserved exterior envelope.`);
      }
      state.peakVoxelBytes=Math.max(state.peakVoxelBytes,d.voxelBytes);recent(state.timings,d.timings);
    }
    state.settled.add(d.id);state.completed=state.settled.size;if(state.selected===d.id)showSelection();finishReceive(phase,receivedAt);}
  function select(id){if(!state.city||!state.workerReady||id===null||id==='')return;state.selected=Number(id);$('selection').value=String(id);drawMap();showSelection();}
  function showSelection(){const p=state.city.parcels[state.selected],s=state.summaries[p.id];$('selected').textContent=`${p.district} · ${p.type}\nParcel ${p.width} × ${p.depth} m\n${s?`${s.typology} · ${s.storeys} storeys · ${s.windowBays} window bays\n${(s.storeys*3/p.width).toFixed(2)} height/frontage · ${state.city.edges[p.road].width.toFixed(2)} m carriageway\n${s.projection.toFixed(1)} m upper-floor street projection · 2 m rear alley\n${s.rooms} rooms\n${s.mode} · ${s.quads.toLocaleString()} quads`:'Geometry queued'}`;$('selected').style.whiteSpace='pre-line';const q=new URLSearchParams({seed:p.seed,...Object.fromEntries(['type','style','context','typology','storeys','lot','projection'].map(k=>[k,p.options[k]])),parcelWidth:p.width,parcelDepth:p.depth,party:p.options.party.map(Number).join(',')});$('inspect').href='building-lab.html?'+q;$('inspect').hidden=false;}
  function percent(a,p){if(!a.length)return 0;return [...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*p)];}
  function releaseInterior(){
    const old=state.interior;old?.walk.leave();state.interior=null;state.inside=null;state.navRequest=null;state.walkData.clear();
    if(old){renderer.dropMesh('interior:'+old.id);renderer.dropMesh('door:'+old.id);renderer.setVisible('building:'+old.id,true);repaint(state.city.parcels[old.id].block);}
    $('enter').textContent='Open door · E';
  }
  function syncInterior(force=false,paint=true){const i=state.interior;if(!i)return;const visible=i.open||!!state.inside;if(force||i.visible!==visible||i.drawOpen!==i.open){if(paint&&repaint(state.city.parcels[i.id].block)===false)return false;renderer.setVisible('interior:'+i.id,visible);renderer.setVisible('door:'+i.id,visible&&!i.open);renderer.setVisible('building:'+i.id,!visible);i.visible=visible;i.drawOpen=i.open;}}
  function cacheInterior(d,job){
    if(d.error||!d.walkData||!d.doorMesh){recent(state.errors,`Building ${d.id+1}: ${d.error||'Interior payload missing'}`);state.failed.set(d.id,'full');return;}
    const bytes=(d.ray?d.ray.bytes:d.mesh.verts.byteLength+d.mesh.idx.byteLength)+d.doorMesh.verts.byteLength+d.doorMesh.idx.byteLength,resident=renderer.state.segments.reduce((n,m)=>n+m.bytes,0)+renderer.rayBytes();
    if(resident+bytes>BUDGET){recent(state.errors,`Building ${d.id+1}: interior exceeds the 128 MiB geometry budget; door remains closed.`);state.failed.set(d.id,'full');return;}
    const t=performance.now();try{if(d.ray)renderer.putRay('interior:'+d.id,d.ray);else renderer.putMesh({...d.mesh,id:'interior:'+d.id});renderer.putMesh(d.doorMesh);state.interior={id:d.id,open:false,walk:window.CityWalk.create(job.parcel,d.walkData,state.city),bytes};state.walkData.set(d.id,d.walkData);syncInterior(true,false);
    }catch(e){renderer.dropMesh('interior:'+d.id);renderer.dropMesh('door:'+d.id);state.sparseFailures.add(d.id);if(!d.ray)state.failed.set(d.id,'full');recent(state.errors,`Building ${d.id+1}: interior upload failed (${e.message}).`);}
    const ms=performance.now()-t;recent(state.uploads,ms);recent(state.timings,d.timings);state.peakVoxelBytes=Math.max(state.peakVoxelBytes,d.voxelBytes);return ms;
  }
  function enter(){if(!state.workerReady||state.engineError)return;const s=renderer.state;if(!s.walkEye)return;
    const nearest=Object.entries(state.summaries).filter(([,d])=>d.entry).map(([id,d])=>({id:Number(id),distance:Math.hypot(s.walkEye[0]-d.entry[0],s.walkEye[2]-d.entry[1])})).sort((a,b)=>a.distance-b.distance)[0];
    if(!nearest||nearest.distance>3){$('walkStatus').textContent='Approach a doorway; E opens or closes it.';return;}
    if(!state.interior||state.interior.id!==nearest.id){if(!state.inside&&state.navRequest!==nearest.id){releaseInterior();state.navRequest=nearest.id;}state.failed.delete(nearest.id);$('walkStatus').textContent='Preparing interior; the door stays closed until ready.';next();return;}
    const i=state.interior,wasOpen=i.open;if(i.open){if(!i.walk.canCloseDoor()){$('walkStatus').textContent='Step clear of the doorway before closing it.';return;}i.walk.setDoorOpen(false);i.open=false;if(!state.inside)i.walk.leave();}
    else{i.walk.setDoorOpen(true);if(!i.walk.snapshot().active&&!i.walk.place(s.walkEye)){i.walk.setDoorOpen(false);$('walkStatus').textContent='Move closer to the entrance path.';return;}i.open=true;}
    if(syncInterior()===false){i.open=wasOpen;i.walk.setDoorOpen(wasOpen);if(!wasOpen&&!state.inside)i.walk.leave();$('walkStatus').textContent='Geometry budget reached; door state retained.';return;}select(i.id);$('enter').textContent=i.open?'Close door · E':'Open door · E';$('walkStatus').textContent=i.open?'Door open · walk in or out freely':'Door closed';
  }
  function metrics(){
    if(!state.city||state.engineError)return;
    const s=renderer.state,tot=state.timings.reduce((r,t)=>{for(const k in t)r[k]=(r[k]||0)+t[k];return r;},{}),d=C.density(state.city,state.summaries),green=state.city.green,tiers={full:0,exterior:0,facade:0,low:0},jobs=state.engineJobs,abi=jobs.reduce((r,j)=>{for(const [k,v] of Object.entries(j.transport))r[k]=(r[k]||0)+v;return r;},{});
    for(const v of Object.values(state.summaries))tiers[v.mode]++;
    state.residentVoxelBytes=[...state.walkData.values()].reduce((n,v)=>n+v.building.vol.byteLength,0);
    $('metrics').textContent=`Engine ${state.engine==='rust'?'Rust/WASM CPU core':'JavaScript baseline'} · shared WebGL renderer + JS rooms/furniture/voxels/navigation/vegetation
main init ${(state.mainInit?.totalMs||0).toFixed(1)} ms · worker ready ${(state.workerInit?.readyLatencyMs||0).toFixed(1)} ms (bootstrap/load/compile/instantiate separated in snapshot)
recent ≤${TELEMETRY_LIMIT} jobs: shared JS worker ${(jobs.reduce((n,j)=>n+j.sharedMs,0)/1000).toFixed(2)}s · end-to-end worker ${(jobs.reduce((n,j)=>n+j.totalMs,0)/1000).toFixed(2)}s
inflight ${state.inflight.size} / ${LIGHT_JOBS} light (dense exclusive) · queued ${state.queue.length} · scheduling ${state.schedule.ms.toFixed(1)}ms · receive p95 ${percent(state.phases.map(p=>p.receiveMs),.95).toFixed(1)}ms
WASM ABI execute ${((abi.executeMs||0)/1000).toFixed(2)}s · encode/copy/decode ${(((abi.totalMs||0)-(abi.executeMs||0))/1000).toFixed(2)}s · transfer+scheduling estimate ${(jobs.reduce((n,j)=>n+j.transferAndSchedulingMs,0)/1000).toFixed(2)}s
shared main JS ${Object.entries(state.mainShared).map(([k,v])=>k+' '+v.toFixed(1)+'ms').join(' · ')} · movement/collision ${state.sharedWalkMs.toFixed(1)}ms
Building footprint ${(d.ratio*100).toFixed(1)}% · target ≥${Math.round(d.target*100)}% (80–90% aim) · ${!d.complete?'measuring':d.pass?'PASS':'FAIL'}
Open within buildable blocks ${Math.max(0,d.available-d.footprint).toFixed(0)} m² · planted pockets ${green.parkArea.toFixed(0)} m² · plaza ${green.plazaArea.toFixed(0)} m²
Roads ${[6,3.5,2.5].map(w=>(w*state.city.width).toFixed(2)).join(' / ')} m + ${state.city.footway} m footways · ${tiers.full} full / ${tiers.exterior} detailed exterior / ${tiers.facade} facade / ${tiers.low} far voxels
frame p50/p95/p99 ${[.5,.95,.99].map(p=>percent(state.frames,p).toFixed(1)).join(' / ')} ms · CPU submit ${s.lastFrameMs.toFixed(1)} ms
${(s.triangles||0).toLocaleString()} mesh triangles · ${s.drawCalls||0} main+post draws · sparse main ${s.rayDraws||0} / resident ${s.rayResidents||0} · shadow ${s.shadowDrawCalls||0} draws (${s.shadowRayDraws||0} rays${s.shadowCached?', cached':''}) · GPU models ${((s.gpuBytes||0)/MiB).toFixed(1)} / 128 MiB
mesh ${((s.meshGpuBytes||0)/MiB).toFixed(1)} MiB · sparse ${((s.sparseGpuBytes||0)/MiB).toFixed(1)} MiB · CPU volumes ${(state.residentVoxelBytes/MiB).toFixed(1)} MiB
Interiors ${state.walkData.size} resident · ${state.interiorJobs} prefetched · ${state.inside?'inside':state.interior?.open?'door open':state.interior?'ready, door closed':state.navRequest!==null?'preparing on approach':'exteriors only'}
worker totals: ${['plan','voxels','prepare','batch','mesh','coarse','sparse'].map(k=>k+' '+((tot[k]||0)/1000).toFixed(1)+'s').join(' · ')}
largest source volume ${(state.peakVoxelBytes/MiB).toFixed(1)} MiB (not peak heap) · receive/upload p95 ${percent(state.uploads,.95).toFixed(1)} ms
WebGL upload CPU ${((s.uploads?.meshCpuMs||0)+(s.uploads?.rayCpuMs||0)).toFixed(1)} ms (not GPU elapsed) · GPU frame ${s.gpuFrameMs===null?'unavailable/pending':s.gpuFrameMs.toFixed(1)+' ms (async timer)'}`;
  }
  function tick(t){const dt=last?Math.min(.05,(t-last)/1000):0;if(last&&state.ready){state.frames.push(t-last);if(state.frames.length>600)state.frames.shift();}last=t;
    if(!state.city||!state.workerReady||state.engineError){requestAnimationFrame(tick);return;}
    const movementStart=performance.now();
    if(renderer.state.walkEye){const s=renderer.state,yaw=s.yaw,f=(keys.has('w')||keys.has('ArrowUp')?1:0)-(keys.has('s')||keys.has('ArrowDown')?1:0),side=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0),[dx,dz]=W.direction(yaw,side,f),x=s.walkEye[0]+dx*dt*W.BODY.speed,z=s.walkEye[2]+dz*dt*W.BODY.speed,i=state.interior;
      if(i?.walk.snapshot().active){i.walk.move(dx*dt*W.BODY.speed,dz*dt*W.BODY.speed);const snap=i.walk.snapshot();s.walkEye=snap.eye;state.inside=snap.room==='Outside'?null:i;syncInterior();$('walkStatus').textContent=state.inside?`Floor ${snap.floor+1} · ${snap.room}`:'Street · door open';if(!state.inside&&!i.open)i.walk.leave();}
      else{if((dx||dz)&&Math.abs(x)<state.city.extent&&Math.abs(z)<state.city.extent&&!state.city.parcels.some(p=>C.contains(p.polygon,[x,z],-.4))&&!state.city.green.plants.some(p=>p.kind==='tree'&&Math.hypot(x-p.x,z-p.z)<.45))s.walkEye=[x,G.walkHeight(state.city,x,z)+W.BODY.eye,z];
        if(state.navRequest!==null)$('walkStatus').textContent=i?'Interior ready · E opens the door':'Preparing nearby interior…';}}
    state.sharedWalkMs+=performance.now()-movementStart;
    if(t-lastStream>300){try{next();}catch(e){fatal(e);}lastStream=t;}renderer.draw();if(t-lastStats>500){metrics();lastStats=t;}requestAnimationFrame(tick);}
  $('rebuild').onclick=build;for(const id of ['terrain','layout','width','count','mode','backend','engine'])$(id).onchange=build;
  $('mapToggle').onclick=()=>{$('map').hidden=!$('map').hidden;$('mapToggle').setAttribute('aria-pressed',String(!$('map').hidden));};$('map').onclick=e=>{if(e.target.dataset.id!==undefined)select(e.target.dataset.id);};$('map').onkeydown=e=>{if(['Enter',' '].includes(e.key)&&e.target.dataset.id!==undefined){e.preventDefault();select(e.target.dataset.id);}};$('selection').onchange=()=>select($('selection').value);
  $('view').onclick=()=>{if(!state.city||!state.workerReady||state.engineError)return;const s=renderer.state;if(s.walkEye){releaseInterior();s.walkEye=null;s.pitch=.68;s.yaw=-.55;$('view').textContent='Street view';$('movement').hidden=true;$('enter').hidden=true;}else{s.walkEye=[0,G.roadHeight(state.city,0,state.city.landmarks.gate.z-5)+1.6,state.city.landmarks.gate.z-5];s.yaw=Math.PI;s.pitch=0;$('view').textContent='Overhead';$('movement').hidden=false;$('enter').hidden=false;$('enter').textContent='Open door · E';$('walkStatus').textContent='WASD · drag to look · E opens a door';$('map').hidden=true;$('mapToggle').setAttribute('aria-pressed','false');canvas.focus();}};$('enter').onclick=enter;
  canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);canvas.focus();};canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag[0],dy=e.clientY-drag[1];drag=[e.clientX,e.clientY];const s=renderer.state;if(s.walkEye)Object.assign(s,W.look(s.yaw,s.pitch,dx,dy));else{s.yaw+=dx*.006;s.pitch=Math.max(.12,Math.min(1.5,s.pitch+dy*.006));}};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;canvas.onwheel=e=>{e.preventDefault();if(state.city&&!renderer.state.walkEye)renderer.state.dist=Math.max(15,Math.min(state.city.extent*5,renderer.state.dist*Math.exp(e.deltaY*.001)));};
  window.addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='e'&&!e.repeat){e.preventDefault();enter();}if('wasd'.includes(e.key)||e.key.startsWith('Arrow')){e.preventDefault();keys.add(e.key);}});window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());
  for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key);}
  window.__cityLab={state,camera:values=>{if(values)Object.assign(renderer.state,values);return {walkEye:renderer.state.walkEye,yaw:renderer.state.yaw,pitch:renderer.state.pitch,target:renderer.state.target,dist:renderer.state.dist};},snapshot:()=>({ready:state.ready,completed:state.completed,errors:state.errors,parcels:state.city?.parcels.length,terrain:state.city?.terrain,mode:state.mode,selected:state.selected,gpuBytes:renderer?.state.gpuBytes,sparseGpuBytes:renderer?.state.sparseGpuBytes,rayDraws:renderer?.state.rayDraws,rayError:renderer?.state.rayError,inside:state.inside?.walk.snapshot()||null,prefetch:state.navRequest,doorOpen:!!state.interior?.open,interiorReady:!!state.interior,interiorJobs:state.interiorJobs,interiorResidents:state.walkData.size,triangles:renderer?.state.triangles,drawCalls:renderer?.state.drawCalls,peakVoxelBytes:state.peakVoxelBytes,residentVoxelBytes:[...state.walkData.values()].reduce((n,v)=>n+v.building.vol.byteLength,0),frames:state.frames,city:state.city,summaries:state.summaries,epoch:state.epoch,stale:state.stale,timings:state.timings,uploads:state.uploads})};
  function renderSnapshot(){const s=renderer?.state;if(!s)return null;return {rayResidents:s.rayResidents,rayEnabled:s.rayEnabled,mainRayDraws:s.rayDraws,mainRayCulled:Math.max(0,(s.rayEnabled||0)-(s.rayDraws||0)),shadowRayDraws:s.shadowRayDraws,shadowRayCulled:s.shadowCached?null:Math.max(0,(s.rayEnabled||0)-(s.shadowRayDraws||0)),mainDrawCalls:s.mainDrawCalls,shadowDrawCalls:s.shadowDrawCalls,shadowCached:s.shadowCached,totalDrawCalls:s.totalDrawCalls,mainTriangles:s.mainTriangles,shadowTriangles:s.shadowTriangles,totalTriangles:s.totalTriangles,uploadCpu:s.uploads,gpuTimingSupported:s.gpuTimingSupported,gpuFrameMs:s.gpuFrameMs};}
  const engineSnapshot=()=>({engine:state.engine,engineError:state.engineError,initializing:state.initializing,workerReady:state.workerReady,mainInit:state.mainInit,workerInit:state.workerInit,mainShared:state.mainShared,sharedWalkMs:state.sharedWalkMs,mainPolicyMs:state.mainPolicyMs,mainEngineMetrics:policy?.metrics(),engineJobs:state.engineJobs,pending:state.pending?{id:state.pending.parcel.id,mode:state.pending.mode}:null,pendingCount:state.inflight.size,inflightCount:state.inflight.size,queuedCount:state.queue.length,lightJobLimit:LIGHT_JOBS,telemetryLimit:TELEMETRY_LIMIT,scheduling:state.schedule,jobPhases:state.phases,renderMetrics:renderSnapshot()});
  const baseSnapshot=window.__cityLab.snapshot;window.__cityLab.snapshot=()=>({...baseSnapshot(),...engineSnapshot()});
  try{renderer=window.BuildingRenderer.createRenderer(canvas);build();requestAnimationFrame(tick);}catch(e){fatal(e);}
})();
