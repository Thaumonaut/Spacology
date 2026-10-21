(function(){
  'use strict';
  const M=MicroWorld,$=id=>document.getElementById(id),canvas=$('world');
  const params=new URLSearchParams(location.search),initial=Number(params.get('seed')??2718),initialCell=Number(params.get('cell')??M.CELL);
  let world=M.createWorld(Number.isInteger(initial)&&initial>=0&&initial<=4294967295?initial:2718,[.25,.125].includes(initialCell)?initialCell:M.CELL);
  let renderer,worker,epoch=0,busy=false,failed=false,paused=false,economy=false,simTime=0,selection=null,visible=[],step=2;
  const camera={x:60,z:62,span:88},frameSamples=[],generationSamples=[],meshSamples=[],actors=[];
  let voxelCacheBytes=0,voxelCacheEntries=0,cacheHits=0,completed=0,workerStarted=0,firstReadyMs=null;
  let born=performance.now();const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const cache=new M.BudgetCache(320,32*1024*1024,mesh=>renderer?.dispose(mesh));
  function message(text){$('notice').textContent=text;$('notice').hidden=!text;}
  function fail(text){failed=true;message(text);$('summary').textContent='Rendering unavailable';for(const id of ['wide','close','zoomIn','zoomOut','pause','economy','rootMarker','densityBase','densityFine'])$(id).disabled=true;worker?.terminate();busy=false;}
  try{renderer=new MicroRenderer(canvas);worker=new Worker('labs/microvoxel-world/voxel-worker.js');}
  catch(error){fail(error.message);}
  const key=(cx,cz,s=step)=>`${world.dataId}:${s}:${cx}:${cz}`;
  const percentile=(list,p)=>{if(!list.length)return 0;const sorted=[...list].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*p)];};
  const push=(list,n)=>{list.push(n);if(list.length>240)list.shift();};
  const bytes=n=>n<1048576?`${(n/1024).toFixed(1)} KiB`:`${(n/1048576).toFixed(2)} MiB`;
  function resetActors(){actors.length=0;actors.push({worker:false,x:0,z:0,y:0,yaw:0,phase:0},{worker:true,x:0,z:0,y:0,yaw:0,phase:2});updateActors();}
  function updateActors(){
    actors.forEach((a,i)=>{const t=simTime*(i?.19:.14)+i*Math.PI;a.x=49+Math.cos(t)*(i?5:7);a.z=58+Math.sin(t)*(i?3.5:6);a.y=world.ground(a.x,a.z);a.yaw=Math.atan2(-Math.sin(t)*(i?5:7),Math.cos(t)*(i?3.5:6));});
  }
  function inspect(point,root=false){
    selection={...point,root};$('inspection').hidden=false;
    $('inspectKicker').textContent=root?'SURVEYED ROOT / 01':'VOXEL GROUND QUERY';
    $('inspectTitle').textContent=root?'Ferrite outcrop':world.geography(point.x,point.z).riverDistance<9?'River basin':world.geography(point.x,point.z).exposed?'Exposed basalt':'Grassland';
    $('inspectBody').textContent=root?world.deposit.rule+'. This is the starting resource, not a placed factory.':`Surface ${point.y.toFixed(2)} m. ${world.geography(point.x,point.z).clearing>.5?'Buildable clearing candidate.':'Natural terrain; no editing.'} Exact ground stays fixed at every render LOD.`;
    $('inspectPosition').textContent=`X ${point.x.toFixed(2)} · Z ${point.z.toFixed(2)}${root?' · '+world.deposit.id:''}`;
  }
  $('rootMarker').onclick=()=>inspect(world.deposit,true);
  $('closeInspection').onclick=()=>{selection=null;$('inspection').hidden=true;$('groundMarker').hidden=true;};
  function identity(){const d=world.deposit;$('seedLabel').textContent=`SEED ${world.seed} / ${M.EXTENT} m × ${M.EXTENT} m / ${world.cell*100} cm voxels`;$('seed').value=world.seed;$('worldId').textContent=`${world.dataId} · Root ${d.id}`;for(const [id,cell] of [['densityBase',.25],['densityFine',.125]])$(id).setAttribute('aria-pressed',String(world.cell===cell));}
  function updateView(){
    if(failed)return;
    renderer.resize(economy);epoch++;
    step=camera.span>80?1/world.cell:camera.span>44?.5/world.cell:1;if(economy)step=Math.min(1/world.cell,step*2);
    visible=[];
    const size=world.chunkMetres,count=M.EXTENT/size;
    for(let cz=0;cz<count;cz++)for(let cx=0;cx<count;cx++){
      const corners=[0,world.heightMetres].flatMap(y=>[cz*size,(cz+1)*size].flatMap(z=>[cx*size,(cx+1)*size].map(x=>renderer.project(camera,x,y,z))));
      if(Math.max(...corners.map(p=>p.x))<0||Math.min(...corners.map(p=>p.x))>canvas.clientWidth||Math.max(...corners.map(p=>p.y))<0||Math.min(...corners.map(p=>p.y))>canvas.clientHeight)continue;
      visible.push({cx,cz,key:key(cx,cz),distance:Math.hypot((cx+.5)*size-camera.x,(cz+.5)*size-camera.z)});
    }
    visible.sort((a,b)=>a.distance-b.distance);
    $('viewLabel').textContent=`${camera.span<=44?'SITE':camera.span<=80?'DISTRICT':'CATCHMENT'} VIEW · ${step*world.cell} m RENDER`;
    const scale=camera.span>80?20:camera.span>40?10:5;$('scaleText').textContent=`${scale} m`;$('scaleLine').style.width=`${canvas.clientWidth*scale/camera.span}px`;
    pump();hud();
  }
  function pump(){
    if(busy||failed)return;
    const next=visible.find(v=>!cache.items.has(v.key));
    if(!next)return;
    busy=true;workerStarted=performance.now();worker.postMessage({seed:world.seed,cell:world.cell,cx:next.cx,cz:next.cz,step,token:epoch});
  }
  if(worker){
    worker.onerror=()=>fail('The world worker could not load. Serve the lab over HTTP, then reload.');
    worker.onmessage=({data})=>{
      busy=false;if(data.error){fail(`World generation failed: ${data.error}`);return;}
      if(data.token===epoch&&data.cell===world.cell&&!failed){
        voxelCacheBytes=data.voxelCacheBytes;voxelCacheEntries=data.voxelCacheEntries;cacheHits+=Number(data.cacheHit);completed++;
        push(generationSamples,data.generateMs);push(meshSamples,data.meshMs);
        const mesh=renderer.upload(data);mesh.quads=data.quads;mesh.exposedFaces=data.exposedFaces;
        if(!cache.set(key(data.cx,data.cz,data.step),mesh)){fail('A chunk exceeded the mesh budget. Reload with Economy enabled.');return;}
      }
      pump();
    };
  }
  function clampCamera(){camera.x=Math.max(8,Math.min(120,camera.x));camera.z=Math.max(8,Math.min(120,camera.z));}
  function zoom(factor){camera.span=Math.max(8,Math.min(148,camera.span*factor));updateView();}
  $('wide').onclick=()=>{Object.assign(camera,{x:64,z:64,span:140});updateView();};
  $('close').onclick=()=>{Object.assign(camera,{x:44,z:59,span:32});updateView();};
  $('zoomIn').onclick=()=>zoom(.78);$('zoomOut').onclick=()=>zoom(1/.78);
  function togglePause(){paused=!paused;$('pause').textContent=paused?'Resume crew':'Pause crew';$('pause').setAttribute('aria-pressed',String(paused));}
  $('pause').onclick=togglePause;
  $('economy').onclick=()=>{economy=!economy;$('economy').setAttribute('aria-pressed',String(economy));updateView();};
  function regenerate(seed,cell){
    world=M.createWorld(seed,cell);cache.clear();voxelCacheBytes=0;voxelCacheEntries=0;cacheHits=completed=0;generationSamples.length=meshSamples.length=frameSamples.length=0;firstReadyMs=null;born=performance.now();simTime=0;identity();resetActors();$('closeInspection').click();
    const url=new URL(location.href);url.searchParams.set('seed',seed);url.searchParams.set('cell',cell);history.replaceState(null,'',url);updateView();
  }
  for(const [id,cell] of [['densityBase',.25],['densityFine',.125]])$(id).onclick=()=>{if(!failed&&world.cell!==cell)regenerate(world.seed,cell);};
  let dragging=null;
  canvas.addEventListener('pointerdown',e=>{if(failed)return;canvas.setPointerCapture(e.pointerId);dragging={id:e.pointerId,x:e.clientX,y:e.clientY,moved:0};canvas.focus({preventScroll:true});});
  canvas.addEventListener('pointermove',e=>{if(!dragging||dragging.id!==e.pointerId)return;const dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;dragging.moved+=Math.abs(dx)+Math.abs(dy);renderer.pan(camera,dx,dy);dragging.x=e.clientX;dragging.y=e.clientY;clampCamera();updateView();});
  canvas.addEventListener('pointerup',e=>{if(!dragging||dragging.id!==e.pointerId)return;if(dragging.moved<6){const p=renderer.pick(camera,e.clientX,e.clientY,world);if(p.x>=0&&p.x<M.EXTENT&&p.z>=0&&p.z<M.EXTENT)inspect(p);}dragging=null;});
  canvas.addEventListener('pointercancel',()=>{dragging=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();if(!failed)zoom(Math.exp(Math.max(-.4,Math.min(.4,e.deltaY*.001))));},{passive:false});
  canvas.addEventListener('keydown',e=>{
    if(failed)return;const n=camera.span*.08;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')camera.x-=n;if(e.key==='ArrowRight')camera.x+=n;if(e.key==='ArrowUp')camera.z-=n;if(e.key==='ArrowDown')camera.z+=n;clampCamera();updateView();}
    if(['+','=','-',' ','r','R'].includes(e.key)){e.preventDefault();if(e.repeat)return;if(e.key===' ')togglePause();else if(e.key==='r'||e.key==='R')$('close').click();else zoom(e.key==='-'?1/.78:.78);}
    if(e.key==='Escape')$('closeInspection').click();
  });
  $('info').onclick=()=>$('notes').showModal();$('metrics').onclick=()=>$('performance').showModal();
  $('seedForm').onsubmit=e=>{
    e.preventDefault();if(failed)return;const seed=Number($('seed').value);if(!Number.isInteger(seed)||seed<0||seed>4294967295)return;
    regenerate(seed,world.cell);$('notes').close();
  };
  function snapshot(){return {worldId:world.id,dataId:world.dataId,seed:world.seed,revision:M.REVISION,deposit:{...world.deposit},camera:{...camera},cellMetres:world.cell,chunkCells:[world.chunkCells,world.heightCells,world.chunkCells],chunkMetres:world.chunkMetres,step,visible:visible.length,ready:visible.filter(v=>cache.items.has(v.key)).length,pending:busy,failed,paused,economy,reducedMotion:motion.matches,simTime,actors:actors.map(a=>({...a})),meshCacheEntries:cache.items.size,meshCacheBytes:cache.bytes,meshCacheLimit:cache.maxBytes,voxelCacheBytes,voxelCacheEntries,cacheHits,completed,firstReadyMs,frameSamples:frameSamples.length,frameP50:percentile(frameSamples,.5),frameP95:percentile(frameSamples,.95),frameP99:percentile(frameSamples,.99),generationP95:percentile(generationSamples,.95),meshingP95:percentile(meshSamples,.95),drawCalls:renderer?.draws||0,triangles:renderer?.triangles||0,pixelRatio:renderer?.pixelRatio||0,viewport:{width:canvas.clientWidth,height:canvas.clientHeight},renderer:renderer?renderer.gl.getParameter(renderer.gl.RENDERER):null,userAgent:navigator.userAgent};}
  rootAPI();
  function rootAPI(){window.MicroWorldLab=Object.freeze({snapshot,project:(x,y,z)=>renderer?.project(camera,x,y,z)});}
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`microvoxel-${world.seed}-metrics.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  function hud(){
    const s=snapshot();if(!failed){const missing=s.visible-s.ready;message(missing?`Streaming ${missing} / ${s.visible} chunks…`:'');$('summary').textContent=`${s.ready}/${s.visible} chunks · ${bytes(s.meshCacheBytes)} GPU · p95 ${s.frameP95.toFixed(1)} ms`;}
    const fields=[['Frame p50 / p95 / p99',`${s.frameP50.toFixed(1)} / ${s.frameP95.toFixed(1)} / ${s.frameP99.toFixed(1)} ms`],['Frame sample count',s.frameSamples],['First complete view',firstReadyMs===null?'Loading':`${(firstReadyMs/1000).toFixed(2)} s`],['Voxel runs · worker cache',`${bytes(s.voxelCacheBytes)} / 4 MiB`],['Worker cached chunks',`${s.voxelCacheEntries} / 128`],['Vertex buffers · GPU estimate',`${bytes(s.meshCacheBytes)} / 32 MiB`],['GPU cached chunks',`${s.meshCacheEntries} / 320`],['Active / ready chunks',`${s.visible} / ${s.ready}`],['Generation / meshing p95',`${s.generationP95.toFixed(1)} / ${s.meshingP95.toFixed(1)} ms`],['Worker warm data hits',s.cacheHits],['Draw calls / triangles',`${s.drawCalls} / ${s.triangles.toLocaleString()}`],['Render step / pixel ratio',`${s.step}× / ${s.pixelRatio.toFixed(1)}×`],['Ground cell / world extent',`${world.cell} m / ${M.EXTENT} m`],['Whole-process memory','Not measured']];
    $('metricList').replaceChildren(...fields.flatMap(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;return [dt,dd];}));
  }
  let previous=performance.now(),lastHud=0;
  function frame(now){
    const delta=now-previous;previous=now;
    if(!document.hidden&&!failed){
      if(renderer.lost){fail('Graphics context lost. Reload this page to rebuild the world.');return;}
      push(frameSamples,delta);if(!paused)simTime+=Math.min(delta/1000,.05);updateActors();
      renderer.begin(camera,motion.matches?0:simTime,economy);
      for(const v of visible){const mesh=cache.get(v.key);if(mesh)renderer.draw(mesh,[v.cx*world.chunkMetres,0,v.cz*world.chunkMetres],[world.cell*step,world.cell*step,world.cell*step]);}
      for(const a of actors)renderer.actor(a,simTime,motion.matches);
      if(firstReadyMs===null&&visible.length&&visible.every(v=>cache.items.has(v.key)))firstReadyMs=performance.now()-born;
      const d=world.deposit,p=renderer.project(camera,d.x,d.y+.7,d.z);$('rootMarker').style.left=`${p.x}px`;$('rootMarker').style.top=`${p.y}px`;$('rootMarker').hidden=p.x<0||p.y<0||p.x>canvas.clientWidth||p.y>canvas.clientHeight;
      if(selection){const p=renderer.project(camera,selection.x,selection.y+.04,selection.z);$('groundMarker').hidden=false;$('groundMarker').style.left=`${p.x}px`;$('groundMarker').style.top=`${p.y}px`;}
      if(busy&&now-workerStarted>30000)fail('World generation stalled. Reload to restart the worker.');
    }
    if(now-lastHud>500){lastHud=now;hud();}requestAnimationFrame(frame);
  }
  window.addEventListener('resize',updateView);
  window.addEventListener('pagehide',()=>{worker?.terminate();cache.clear();});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  identity();resetActors();if(!failed){updateView();requestAnimationFrame(frame);}
})();
