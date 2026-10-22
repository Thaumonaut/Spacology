(function(){
  'use strict';
  const M=MicroWorld,H=HexAtlas,$=id=>document.getElementById(id),canvas=$('world');
  const params=new URLSearchParams(location.search),initial=Number(params.get('seed')??2718),initialCell=Number(params.get('cell')??M.CELL),initialExtent=(params.get('extent')??'infinite')==='infinite'?'infinite':Number(params.get('extent'));
  let world=M.createWorld(Number.isInteger(initial)&&initial>=0&&initial<=4294967295?initial:2718,[.25,.125].includes(initialCell)?initialCell:M.CELL,[128,256,'infinite'].includes(initialExtent)?initialExtent:'infinite');
  let renderer,worker,epoch=0,busy=false,failed=false,paused=false,economy=false,simTime=0,selection=null,visible=[],step=2,renderStep=null;
  const camera={x:60,z:62,span:88},frameSamples=[],generationSamples=[],meshSamples=[],actors=[];
  let position=M.positionAt(world.deposit.x+4,world.deposit.z+4),travelled=0,vegetationEntries=0;
  let atlas=H.createAtlas(world),atlasView='explore',selectedHex=null;
  if(world.infinite){
    Object.assign(camera,{x:0,z:0,span:32});
    const saved={cx:Number(params.get('cx')),cz:Number(params.get('cz')),x:Number(params.get('lx')),z:Number(params.get('lz'))};
    if(['cx','cz','lx','lz'].every(k=>params.has(k))&&[saved.cx,saved.cz].every(n=>Number.isInteger(n)&&Math.abs(n)<=M.MAX_CHUNK)&&[saved.x,saved.z].every(n=>Number.isFinite(n)&&n>=0&&n<8))position=M.movePosition(saved);
  }
  let voxelCacheBytes=0,voxelCacheEntries=0,cacheHits=0,completed=0,retainedMeshes=0,placeholders=0,workerStarted=0,firstReadyMs=null,viewDirty=false,persistOnStop=false;
  const heldKeys=new Set(),velocity={x:0,z:0};
  let born=performance.now();const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const cache=new M.BudgetCache(320,32*1024*1024,mesh=>renderer?.dispose(mesh));
  function message(text){$('notice').textContent=text;$('notice').hidden=!text;}
  function fail(text){failed=true;message(text);$('summary').textContent='Rendering unavailable';for(const id of ['wide','close','zoomIn','zoomOut','pause','economy','rootMarker','densityBase','densityFine'])$(id).disabled=true;worker?.terminate();busy=false;}
  try{renderer=new MicroRenderer(canvas);worker=new Worker('labs/microvoxel-world/voxel-worker.js');}
  catch(error){const localSource=location.protocol==='file:'&&document.currentScript?.src;fail(localSource&&error.name==='SecurityError'?'Local source launch blocked: browsers cannot load this separate worker via file://. Run npm run serve from the repository root and open http://localhost:4173/prototypes/microvoxel-world.html, or use the packaged standalone HTML.':error.message);}
  const key=(cx,cz,s=step)=>`${world.dataId}:${s}:${cx}:${cz}`;
  const placeholderStep=()=>step*world.cell<.25?Math.min(1/world.cell,step*4):null;
  const fallback=v=>{const coarse=placeholderStep();return [v.key,key(v.cx,v.cz,renderStep),coarse&&key(v.cx,v.cz,coarse)].find(k=>k&&cache.items.has(k));};
  const percentile=(list,p)=>{if(!list.length)return 0;const sorted=[...list].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*p)];};
  const push=(list,n)=>{list.push(n);if(list.length>240)list.shift();};
  const bytes=n=>n<1048576?`${(n/1024).toFixed(1)} KiB`:`${(n/1048576).toFixed(2)} MiB`;
  const logical=()=>({x:position.cx*world.chunkMetres+position.x,z:position.cz*world.chunkMetres+position.z});
  function localPoint(p){const q=logical();return world.infinite?{...p,x:p.x-q.x,z:p.z-q.z}:p;}
  function chunkOrigin(cx,cz){return world.infinite?{x:(cx-position.cx)*world.chunkMetres-position.x,z:(cz-position.cz)*world.chunkMetres-position.z}:{x:cx*world.chunkMetres,z:cz*world.chunkMetres};}
  function persist(){
    const url=new URL(location.href);url.searchParams.set('seed',world.seed);url.searchParams.set('cell',world.cell);url.searchParams.set('extent',world.extent);
    for(const [key,value] of Object.entries({cx:position.cx,cz:position.cz,lx:position.x,lz:position.z}))world.infinite?url.searchParams.set(key,value):url.searchParams.delete(key);
    history.replaceState(null,'',url);
  }
  function resetActors(){atlas=H.createAtlas(world);selectedHex=null;actors.length=0;actors.push(...atlas.crew);updateActors();}
  function updateActors(){
    for(const a of actors)a.y=world.ground(a.x,a.z)??0;
  }
  function inspect(point,root=false){
    selection={...point,root};$('inspection').hidden=false;
    $('inspectKicker').textContent=root?'SURVEYED ROOT / 01':'VOXEL GROUND QUERY';
    $('inspectTitle').textContent=root?'Ferrite outcrop':world.geography(point.x,point.z).riverDistance<9?'River basin':world.geography(point.x,point.z).exposed?'Exposed basalt':'Grassland';
    $('inspectBody').textContent=root?world.deposit.rule+'. This is the starting resource, not a placed factory.':`Surface ${point.y.toFixed(2)} m. ${world.geography(point.x,point.z).clearing>.5?'Buildable clearing candidate.':'Natural terrain; no editing.'} Exact ground stays fixed at every render LOD.`;
    $('inspectPosition').textContent=`X ${point.x.toFixed(2)} · Z ${point.z.toFixed(2)}${root?' · '+world.deposit.id:''}`;
    $('hexStatus').textContent='';selectHex(atlas.hexAt(point.x,point.z));
  }
  function selectHex(h){
    selectedHex=h;
    $('hexTask2').hidden=true;
    if(coop?.active){const key=atlas.key(h.q,h.r);hexActions=coop.actions(key);$('hexSummary').textContent=coop.describe(key);
      ['hexTask','hexTask2'].forEach((id,i)=>{const a=hexActions[i];$(id).hidden=!a;if(a){$(id).textContent=a.label;$(id).disabled=!!a.disabled;}});return;}
    const s=atlas.summary(h.q,h.r),k=atlas.known(h.q,h.r);
    $('hexSummary').textContent=`HEX ${h.q}, ${h.r} · `+(s.barrier?`${s.biome} · impassable ${s.terrain}; Logistics must engineer a crossing`:k?.surveyed?`${s.biome} · relief ${s.relief.toFixed(1)} m · travel cost ${s.cost}${s.resource?` · ${s.resource} (${k.identified?'identified':k.sampled?'studying':'unsampled'})`:''}`:'Unsurveyed: send the explorer to learn what is here');
    $('hexTask').hidden=!s.inside||s.barrier||!!k?.identified||!!k?.surveyed&&!s.resource;$('hexTask').disabled=!!k?.sampled;
    $('hexTask').textContent=!k?.surveyed?'Send explorer':k.sampled?'Studying at camp':'Send researcher';
  }
  let hexActions=[];
  $('hexTask2').onclick=()=>{if(selectedHex&&coop.active&&hexActions[1]){coop.act(hexActions[1].intent);selectHex(selectedHex);}};
  $('hexTask').onclick=()=>{if(!selectedHex)return;if(coop.active){if(hexActions[0])coop.act(hexActions[0].intent);}else $('hexStatus').textContent=atlas.assign(selectedHex.q,selectedHex.r);selectHex(selectedHex);};
  function setAtlasView(v){atlasView=v;for(const o of document.querySelectorAll('[data-atlas]'))o.setAttribute('aria-pressed',String(o.dataset.atlas===v));}
  for(const b of document.querySelectorAll('[data-atlas]'))b.onclick=()=>setAtlasView(b.dataset.atlas);
  let coopRegen=false;
  const coop=CoopPlay.create({world:()=>world,regenerate:(s,c,e)=>{coopRegen=true;try{regenerate(s,c,e);}finally{coopRegen=false;}},changed:()=>{if(selectedHex)selectHex(selectedHex);},focus:setAtlasView});
  const layer=$('atlasLayer'),ctx=layer.getContext('2d');
  const ATLAS_STYLE={surveyed:['#f3ead140','#f3ead1cc'],frontier:[null,'#e8bc72'],usable:['#58c27a66','#6fe08f'],unconfirmed:[null,'#dfe4d6'],ground:[null,'#dfe4d688'],identified:['#a98ee840','#c7b6f5'],studying:['#a98ee899','#efe9ff'],'needs-sample':[null,'#c7b6f5'],selected:[null,'#ffffff'],
    planned:['#e8bc7266','#ffd38a'],hinted:['#a98ee833','#d9cbff'],signs:[null,'#a98ee8'],line:['#58c27a99','#9ff0b4'],route:['#58c27a33','#6fe08f99'],
    barrier:['hatch','#d7a184'],scouted:['hatch','#f0c9a8'],'barrier-known':['hatch','#f0c9a8'],crossing:['hatch','#ffd38a'],crossed:['#e8bc7233','#ffd38a'],'rock-sample':['hatch','#c7b6f5'],'rock-rated':['hatch','#efe9ff']};
  const ATLAS_LABEL=h=>({usable:`${h.root?'ROOT':h.profile?h.profile.name.toUpperCase():'FERRITE'} · ${h.steps} HEX`,frontier:`COST ${h.cost}`,'needs-sample':'SAMPLE',studying:'STUDYING',planned:h.order?`SURVEY ${h.order}`:'EXTRACTOR',hinted:'HINT',signs:'SIGNS',line:h.root?'ROOT LINE':'LINE',
    barrier:h.terrain?.toUpperCase(),scouted:'SCOUTED','barrier-known':`${h.terrain?.toUpperCase()} · ${(h.rating||'unrated').toUpperCase()}`,crossing:h.crossing&&`${h.crossing.type.toUpperCase()} ${h.crossing.progress}/${h.crossing.price}`,crossed:h.crossed?.toUpperCase(),'rock-sample':'ROCK','rock-rated':`ROCK · ${(h.rating||'').toUpperCase()}`})[h.state];
  let hatch=null;
  function hatchFill(){if(hatch)return hatch;const c=document.createElement('canvas');c.width=c.height=8;const g=c.getContext('2d');g.strokeStyle='#e0b49a66';g.lineWidth=1.5;g.beginPath();g.moveTo(0,8);g.lineTo(8,0);g.moveTo(-2,2);g.lineTo(2,-2);g.moveTo(6,10);g.lineTo(10,6);g.stroke();return hatch=ctx.createPattern(c,'repeat');}
  // Crossings are drawn as structures over unchanged terrain: zigzag ramp, notch cutting, twin-rail bridge.
  function glyph(type,x,y,progress){
    ctx.save();ctx.translate(x,y-16);ctx.strokeStyle='#ffd38a';ctx.lineWidth=2.5;ctx.setLineDash(progress<1?[3,3]:[]);ctx.beginPath();
    if(type==='ramp'){ctx.moveTo(-9,6);ctx.lineTo(9,2);ctx.lineTo(-9,-2);ctx.lineTo(9,-6);}else if(type==='cutting'){ctx.moveTo(-9,-6);ctx.lineTo(-3,6);ctx.lineTo(3,6);ctx.lineTo(9,-6);}else{ctx.moveTo(-10,-3);ctx.lineTo(10,-3);ctx.moveTo(-10,3);ctx.lineTo(10,3);for(const i of [-6,0,6]){ctx.moveTo(i,-3);ctx.lineTo(i,3);}}
    ctx.stroke();ctx.restore();
  }
  // Hex edges are draped on the voxel ground; shared edges sample identical points, so neighbours tile on any slope.
  const outlines=new Map(),EDGE_SAMPLES=6;
  function outline(hx){
    const k=world.seed+':'+world.cell+':'+world.extent+':'+hx.key;let pts=outlines.get(k);if(pts)return pts;
    const c=atlas.corners(hx.q,hx.r);pts=[];
    for(let i=0;i<6;i++){const a=c[i],b=c[(i+1)%6];for(let j=0;j<EDGE_SAMPLES;j++){const t=j/EDGE_SAMPLES,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;pts.push({x,y:(world.ground(x,z)??hx.height)+.12,z});}}
    outlines.set(k,pts);if(outlines.size>2048)outlines.delete(outlines.keys().next().value);return pts;
  }
  function drawAtlas(){
    const w=canvas.clientWidth,h=canvas.clientHeight,r=Math.min(devicePixelRatio||1,2);
    if(layer.width!==Math.round(w*r)||layer.height!==Math.round(h*r)){layer.width=Math.round(w*r);layer.height=Math.round(h*r);}
    ctx.setTransform(r,0,0,r,0,0);ctx.clearRect(0,0,w,h);ctx.font='650 10px system-ui,sans-serif';ctx.textAlign='center';
    const list=atlasView==='off'?[]:coop.active?[...coop.hexes()]:atlas.view(atlasView);if(selectedHex)list.push({...atlas.summary(selectedHex.q,selectedHex.r),state:'selected'});
    for(const hx of list){
      const pts=outline(hx).map(c=>{const p=localPoint(c);return renderer.project(camera,p.x,p.y,p.z);});
      if(pts.every(p=>p.x<0)||pts.every(p=>p.x>w)||pts.every(p=>p.y<0)||pts.every(p=>p.y>h))continue;
      const [fill,stroke]=ATLAS_STYLE[hx.state];ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
      ctx.setLineDash(['frontier','needs-sample','unconfirmed','signs','barrier','rock-sample'].includes(hx.state)?[5,4]:[]);ctx.lineWidth=hx.state==='selected'?3:1.5;
      if(fill){ctx.fillStyle=fill==='hatch'?hatchFill():fill;ctx.fill();}ctx.strokeStyle=stroke;ctx.stroke();
      const type=hx.crossed||hx.crossing?.type;if(type){const cx=pts.reduce((a,p)=>a+p.x,0)/pts.length,cy=pts.reduce((a,p)=>a+p.y,0)/pts.length;glyph(type,cx,cy,hx.crossed?1:hx.crossing.progress/hx.crossing.price);}
      const label=camera.span<=80&&ATLAS_LABEL(hx);if(label){const x=pts.reduce((a,p)=>a+p.x,0)/pts.length,y=pts.reduce((a,p)=>a+p.y,0)/pts.length,m=ctx.measureText(label).width;ctx.fillStyle='#172a28d0';ctx.fillRect(x-m/2-4,y-8,m+8,15);ctx.fillStyle=stroke;ctx.fillText(label,x,y+3);}
    }
  }
  $('rootMarker').onclick=()=>inspect(world.deposit,true);
  $('closeInspection').onclick=()=>{selection=null;selectedHex=null;$('inspection').hidden=true;$('groundMarker').hidden=true;};
  function identity(){
    const d=world.deposit;$('seedLabel').textContent=`SEED ${world.seed} / ${world.infinite?'STREAMED WILDS':`${world.extent} m × ${world.extent} m`} / ${world.cell*100} cm voxels`;$('seed').value=world.seed;$('worldSize').value=world.extent;$('wide').textContent=world.infinite?'Surroundings':world.extent===128?'Catchment':'Region';$('travelForm').hidden=!world.infinite;$('worldId').textContent=`${world.dataId} · Root ${d.id}`;
    $('worldTitle').textContent=world.infinite?'The streamed wilds':'The ferrite catchment';$('regionLabel').textContent=world.infinite?'STREAMED WORLD':'SURVEYED REGION';$('regionDetail').textContent=world.infinite?'Seeded ridges / wet corridors':'Basalt ridge / river basin';
    for(const [id,cell] of [['densityBase',.25],['densityFine',.125]])$(id).setAttribute('aria-pressed',String(world.cell===cell));
  }
  function updateView(){
    if(failed)return;
    viewDirty=false;
    renderer.resize(economy);if(world.extent!==128)camera.span=Math.min(camera.span,maximumSpan());epoch++;
    const size=world.chunkMetres,count=world.extent/size;
    let shrink;
    do{
      step=camera.span>80?1/world.cell:camera.span>44?.5/world.cell:1;if(economy)step=Math.min(1/world.cell,step*2);
      visible=[];
      const bounds=renderer.bounds(camera,world.heightMetres);
      const minX=world.infinite?Math.max(-M.MAX_CHUNK,position.cx+Math.floor((bounds.minX+position.x)/size)):0,maxX=world.infinite?Math.min(M.MAX_CHUNK,position.cx+Math.floor((bounds.maxX+position.x)/size)):count-1;
      const minZ=world.infinite?Math.max(-M.MAX_CHUNK,position.cz+Math.floor((bounds.minZ+position.z)/size)):0,maxZ=world.infinite?Math.min(M.MAX_CHUNK,position.cz+Math.floor((bounds.maxZ+position.z)/size)):count-1;
      for(let cz=minZ;cz<=maxZ;cz++)for(let cx=minX;cx<=maxX;cx++){
        const origin=chunkOrigin(cx,cz);
        const corners=[0,world.heightMetres].flatMap(y=>[origin.z,origin.z+size].flatMap(z=>[origin.x,origin.x+size].map(x=>renderer.project(camera,x,y,z))));
        if(Math.max(...corners.map(p=>p.x))<0||Math.min(...corners.map(p=>p.x))>canvas.clientWidth||Math.max(...corners.map(p=>p.y))<0||Math.min(...corners.map(p=>p.y))>canvas.clientHeight)continue;
        visible.push({cx,cz,key:key(cx,cz),distance:Math.hypot(origin.x+size/2-camera.x,origin.z+size/2-camera.z)});
      }
      shrink=visible.length>cache.maxEntries&&camera.span>8;if(shrink)camera.span=Math.max(8,camera.span*.9);
    }while(shrink);
    if(renderStep===null)renderStep=step;
    visible.sort((a,b)=>a.distance-b.distance);
    $('viewLabel').textContent=`${camera.span<=44?'SITE':camera.span<=80?'DISTRICT':world.extent===128?'CATCHMENT':'REGION'} VIEW · ${step*world.cell} m RENDER`;
    const scale=camera.span>80?20:camera.span>40?10:5;$('scaleText').textContent=`${scale} m`;$('scaleLine').style.width=`${canvas.clientWidth*scale/camera.span}px`;
    pump();hud();
  }
  function pump(){
    if(busy||failed||viewDirty)return;
    const coarse=placeholderStep();let next=coarse&&visible.find(v=>!fallback(v)),requestStep=coarse;
    if(!next){next=visible.find(v=>!cache.items.has(v.key));requestStep=step;}
    if(!next)return;
    busy=true;workerStarted=performance.now();worker.postMessage({dataId:world.dataId,seed:world.seed,cell:world.cell,extent:world.extent,cx:next.cx,cz:next.cz,step:requestStep,token:epoch});
  }
  if(worker){
    worker.onerror=()=>fail('The world worker could not load. Serve the lab over HTTP, then reload.');
    worker.onmessage=({data})=>{
      busy=false;if(data.error){if(data.dataId===world.dataId)fail(`World generation failed: ${data.error}`);else pump();return;}
      const wanted=visible.some(v=>v.cx===data.cx&&v.cz===data.cz&&(data.step===step||data.step===renderStep||data.step===placeholderStep()));
      if(data.dataId===world.dataId&&wanted&&!failed){
        voxelCacheBytes=data.voxelCacheBytes;voxelCacheEntries=data.voxelCacheEntries;vegetationEntries=data.vegetationEntries;cacheHits+=Number(data.cacheHit);completed++;
        if(data.token!==epoch)retainedMeshes++;if(data.step!==step&&data.step===placeholderStep())placeholders++;
        push(generationSamples,data.generateMs);push(meshSamples,data.meshMs);
        const mesh=renderer.upload(data);mesh.step=data.step;mesh.quads=data.quads;mesh.exposedFaces=data.exposedFaces;
        const retain=visible.filter(v=>v.cx!==data.cx||v.cz!==data.cz).map(fallback).filter(Boolean);
        if(!cache.set(key(data.cx,data.cz,data.step),mesh,retain)){fail('A chunk exceeded the mesh budget. Reload with Economy enabled.');return;}
      }
      pump();
    };
  }
  function clampCamera(){
    if(world.infinite){
      const previous=position;position=M.movePosition(position,camera.x,camera.z);
      travelled+=Math.hypot((position.cx-previous.cx)*8+position.x-previous.x,(position.cz-previous.cz)*8+position.z-previous.z);
      camera.x=camera.z=0;
    }else{camera.x=Math.max(8,Math.min(world.extent-8,camera.x));camera.z=Math.max(8,Math.min(world.extent-8,camera.z));}
  }
  function maximumSpan(){return world.extent===128?148:Math.min(116,Math.max(81,renderer.aspect*70));}
  function moveCamera(x,z){camera.x+=x;camera.z+=z;clampCamera();viewDirty=true;}
  function stopKeys(){heldKeys.clear();velocity.x=velocity.z=0;if(persistOnStop){persistOnStop=false;persist();}}
  function zoom(factor){camera.span=Math.max(8,Math.min(maximumSpan(),camera.span*factor));updateView();}
  $('wide').onclick=()=>{if(world.infinite)camera.span=maximumSpan();else Object.assign(camera,{x:world.extent/2,z:world.extent/2,span:world.extent===128?140:maximumSpan()});updateView();};
  $('close').onclick=()=>{stopKeys();if(world.infinite){position=M.positionAt(world.deposit.x+4,world.deposit.z+4);Object.assign(camera,{x:0,z:0,span:32});updateActors();persist();}else Object.assign(camera,{x:44,z:59,span:32});updateView();};
  $('zoomIn').onclick=()=>zoom(.78);$('zoomOut').onclick=()=>zoom(1/.78);
  function togglePause(){paused=!paused;$('pause').textContent=paused?'Resume crew':'Pause crew';$('pause').setAttribute('aria-pressed',String(paused));}
  $('pause').onclick=togglePause;
  $('economy').onclick=()=>{economy=!economy;$('economy').setAttribute('aria-pressed',String(economy));updateView();};
  function regenerate(seed,cell,extent=world.extent){
    if(coop.active&&!coopRegen)coop.stop();
    const resized=extent!==world.extent;
    const reseeded=seed!==world.seed;
    stopKeys();world=M.createWorld(seed,cell,extent);cache.clear();renderStep=null;voxelCacheBytes=vegetationEntries=0;voxelCacheEntries=0;cacheHits=completed=retainedMeshes=placeholders=0;generationSamples.length=meshSamples.length=frameSamples.length=0;firstReadyMs=null;born=performance.now();simTime=0;
    if(world.infinite&&(resized||reseeded)){position=M.positionAt(world.deposit.x+4,world.deposit.z+4);travelled=0;Object.assign(camera,{x:0,z:0,span:32});}
    else if(resized)Object.assign(camera,{x:world.extent/2,z:world.extent/2,span:world.extent===128?140:maximumSpan()});
    identity();resetActors();$('closeInspection').click();
    persist();updateView();
  }
  for(const [id,cell] of [['densityBase',.25],['densityFine',.125]])$(id).onclick=()=>{if(!failed&&world.cell!==cell)regenerate(world.seed,cell);};
  let dragging=null;
  canvas.addEventListener('pointerdown',e=>{if(failed)return;stopKeys();canvas.setPointerCapture(e.pointerId);dragging={id:e.pointerId,x:e.clientX,y:e.clientY,moved:0};canvas.focus({preventScroll:true});});
  canvas.addEventListener('pointermove',e=>{if(!dragging||dragging.id!==e.pointerId)return;const dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;dragging.moved+=Math.abs(dx)+Math.abs(dy);renderer.pan(camera,dx,dy);dragging.x=e.clientX;dragging.y=e.clientY;clampCamera();viewDirty=true;});
  canvas.addEventListener('pointerup',e=>{if(!dragging||dragging.id!==e.pointerId)return;if(dragging.moved<6){const q=logical(),groundWorld=world.infinite?{heightMetres:world.heightMetres,ground:(x,z)=>world.ground(q.x+x,q.z+z)}:world,p=renderer.pick(camera,e.clientX,e.clientY,groundWorld);if(p.y>0&&(world.infinite||p.x>=0&&p.x<world.extent&&p.z>=0&&p.z<world.extent))inspect(world.infinite?{...p,x:p.x+q.x,z:p.z+q.z}:p);}dragging=null;if(world.infinite)persist();});
  canvas.addEventListener('pointercancel',()=>{dragging=null;if(world.infinite)persist();});
  canvas.addEventListener('wheel',e=>{e.preventDefault();if(!failed)zoom(Math.exp(Math.max(-.4,Math.min(.4,e.deltaY*.001))));},{passive:false});
  const ARROWS=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
  window.addEventListener('keydown',e=>{
    if(failed||!ARROWS.includes(e.key)||e.altKey||e.ctrlKey||e.metaKey||document.querySelector('dialog[open]')||e.target.closest?.('input,select,textarea,[contenteditable]'))return;
    e.preventDefault();if(!heldKeys.has(e.key)){heldKeys.add(e.key);const d=renderer.screenDirection(e.key==='ArrowLeft'?-.05:e.key==='ArrowRight'?.05:0,e.key==='ArrowUp'?-.05:e.key==='ArrowDown'?.05:0);moveCamera(d.x,d.z);}persistOnStop=world.infinite;
  });
  window.addEventListener('keyup',e=>heldKeys.delete(e.key));
  canvas.addEventListener('keydown',e=>{
    if(failed)return;
    if(['+','=','-',' ','r','R'].includes(e.key)){e.preventDefault();if(e.repeat)return;if(e.key===' ')togglePause();else if(e.key==='r'||e.key==='R')$('close').click();else zoom(e.key==='-'?1/.78:.78);}
    if(e.key==='Escape')$('closeInspection').click();
  });
  window.addEventListener('blur',stopKeys);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopKeys();});
  $('info').onclick=()=>{stopKeys();$('notes').showModal();};$('metrics').onclick=()=>{stopKeys();$('performance').showModal();};
  $('closeNotes').onclick=()=>$('notes').close();$('closePerformance').onclick=()=>$('performance').close();
  function actionForm(id,action){
    const form=$(id),run=()=>{if(!failed&&form.reportValidity())action();};
    form.querySelector('button').onclick=run;
    form.onsubmit=e=>{e.preventDefault();run();};
    form.onkeydown=e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();run();}};
  }
  actionForm('seedForm',()=>{
    const seed=Number($('seed').value);if(!Number.isInteger(seed)||seed<0||seed>4294967295)return;
    regenerate(seed,world.cell,$('worldSize').value==='infinite'?'infinite':Number($('worldSize').value));$('notes').close();
  });
  actionForm('travelForm',()=>{
    if(!world.infinite)return;
    const cx=Number($('chunkX').value),cz=Number($('chunkZ').value);
    if(![cx,cz].every(n=>Number.isInteger(n)&&Math.abs(n)<=M.MAX_CHUNK))return;
    position=M.movePosition({cx,cz,x:4,z:4});updateActors();$('closeInspection').click();persist();updateView();$('notes').close();
  });
  function snapshot(){return {worldId:world.id,dataId:world.dataId,seed:world.seed,revision:world.revision,extent:world.extent,position:world.infinite?{...position}:null,travelled,vegetationEntries,mainVegetationEntries:world.vegetationEntries(),maxRenderOrigin:world.infinite?Math.max(0,...visible.flatMap(v=>{const p=chunkOrigin(v.cx,v.cz);return [Math.abs(p.x),Math.abs(p.z)];})):null,deposit:{...world.deposit},camera:{...camera},cellMetres:world.cell,chunkCells:[world.chunkCells,world.heightCells,world.chunkCells],chunkMetres:world.chunkMetres,step,renderStep,viewUpdates:epoch,retainedMeshes,placeholders,shown:visible.filter(v=>fallback(v)).length,moving:heldKeys.size>0||velocity.x!==0||velocity.z!==0,visible:visible.length,ready:visible.filter(v=>cache.items.has(v.key)).length,renderReady:visible.filter(v=>cache.items.has(key(v.cx,v.cz,renderStep))).length,pending:busy||viewDirty,failed,paused,economy,reducedMotion:motion.matches,simTime,actors:actors.map(a=>({...a,task:a.task&&{...a.task}})),atlas:{view:atlasView,selected:selectedHex&&{...selectedHex},...atlas.snapshot()},meshCacheEntries:cache.items.size,meshCacheBytes:cache.bytes,meshCacheLimit:cache.maxBytes,voxelCacheBytes,voxelCacheEntries,cacheHits,completed,firstReadyMs,frameSamples:frameSamples.length,frameP50:percentile(frameSamples,.5),frameP95:percentile(frameSamples,.95),frameP99:percentile(frameSamples,.99),generationP95:percentile(generationSamples,.95),meshingP95:percentile(meshSamples,.95),drawCalls:renderer?.draws||0,triangles:renderer?.triangles||0,pixelRatio:renderer?.pixelRatio||0,viewport:{width:canvas.clientWidth,height:canvas.clientHeight},renderer:renderer?renderer.gl.getParameter(renderer.gl.RENDERER):null,userAgent:navigator.userAgent};}
  rootAPI();
  function rootAPI(){window.MicroWorldLab=Object.freeze({snapshot,project:(x,y,z)=>{const p=localPoint({x,y,z});return renderer?.project(camera,p.x,p.y,p.z);},coop:Object.freeze({snapshot:coop.snapshot,start:coop.start,claim:coop.claim,act:coop.act,ready:coop.ready,stop:coop.stop,center:(q,r)=>atlas.center(q,r)})});}
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`microvoxel-${world.seed}-metrics.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  function hud(){
    const s=snapshot();if(!failed){const missing=s.visible-s.ready;message(missing?`Streaming ${missing} / ${s.visible} chunks…`:'');$('summary').textContent=`${s.ready}/${s.visible} chunks · ${bytes(s.meshCacheBytes)} GPU · p95 ${s.frameP95.toFixed(1)} ms`;}
    $('positionLabel').hidden=!world.infinite;
    if(world.infinite)$('positionLabel').textContent=`CHUNK ${position.cx}, ${position.cz} · LOCAL ${position.x.toFixed(2)}, ${position.z.toFixed(2)} m`;
    const fields=[['Frame p50 / p95 / p99',`${s.frameP50.toFixed(1)} / ${s.frameP95.toFixed(1)} / ${s.frameP99.toFixed(1)} ms`],['Frame sample count',s.frameSamples],['First complete view',firstReadyMs===null?'Loading':`${(firstReadyMs/1000).toFixed(2)} s`],['Voxel runs · worker cache',`${bytes(s.voxelCacheBytes)} / 4 MiB`],['Worker cached chunks',`${s.voxelCacheEntries} / 128`],['Vertex buffers · GPU estimate',`${bytes(s.meshCacheBytes)} / 32 MiB`],['GPU cached chunks',`${s.meshCacheEntries} / 320`],['Active / ready chunks',`${s.visible} / ${s.ready}`],['Generation / meshing p95',`${s.generationP95.toFixed(1)} / ${s.meshingP95.toFixed(1)} ms`],['Worker warm data hits',s.cacheHits],['Draw calls / triangles',`${s.drawCalls} / ${s.triangles.toLocaleString()}`],['Render step / pixel ratio',`${s.renderStep}× displayed / ${s.step}× requested / ${s.pixelRatio.toFixed(1)}×`],['Ground cell / world extent',`${world.cell} m / ${world.extent} m`],['Whole-process memory','Not measured']];
    fields.push(['Vegetation memo entries',`${vegetationEntries} worker + ${s.mainVegetationEntries} main / 2,048 each`]);
    fields.push(['Useful meshes retained after view changes',retainedMeshes],['Coarse placeholders while fine detail loads',placeholders]);
    if(world.infinite)fields.push(['Logical chunk / local metres',`${position.cx}, ${position.cz} / ${position.x.toFixed(3)}, ${position.z.toFixed(3)}`],['Largest render chunk origin',`${s.maxRenderOrigin.toFixed(2)} m`],['Travelled (excludes jumps)',`${travelled.toFixed(1)} m`]);
    $('metricList').replaceChildren(...fields.flatMap(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;return [dt,dd];}));
  }
  let previous=performance.now(),lastHud=0;
  function frame(now){
    const delta=now-previous;previous=now;
    if(!document.hidden&&!failed){
      if(renderer.lost){fail('Graphics context lost. Reload this page to rebuild the world.');return;}
      const dt=Math.min(delta/1000,.05),{x:dx,z:dz}=renderer.screenDirection(Number(heldKeys.has('ArrowRight'))-Number(heldKeys.has('ArrowLeft')),Number(heldKeys.has('ArrowDown'))-Number(heldKeys.has('ArrowUp'))),length=Math.hypot(dx,dz)||1,speed=Math.min(12,Math.max(2,camera.span*.18)),ease=1-Math.exp(-dt*(dx||dz?16:36));
      velocity.x+=(dx/length*speed-velocity.x)*ease;velocity.z+=(dz/length*speed-velocity.z)*ease;
      if(!dx&&!dz&&Math.hypot(velocity.x,velocity.z)<.01){velocity.x=velocity.z=0;if(persistOnStop&&!heldKeys.size){persistOnStop=false;persist();}}
      if(velocity.x||velocity.z)moveCamera(velocity.x*dt,velocity.z*dt);
      if(viewDirty)updateView();
      push(frameSamples,delta);if(!paused){simTime+=dt;if(!coop.update(dt,atlas.crew,atlas))atlas.update(dt);}
      if(visible.length&&visible.every(v=>cache.items.has(v.key)))renderStep=step;
      renderer.begin(camera,motion.matches?0:simTime,economy);
      for(const v of visible){
        const requested=cache.get(v.key),coarse=placeholderStep(),mesh=cache.items.get(key(v.cx,v.cz,renderStep))||requested||coarse&&cache.items.get(key(v.cx,v.cz,coarse));
        if(mesh){const p=chunkOrigin(v.cx,v.cz);renderer.draw(mesh,[p.x,0,p.z],[world.cell*mesh.step,world.cell*mesh.step,world.cell*mesh.step],0,0,0,[0,0,0],world.infinite?[(v.cx%512)*8,0,(v.cz%512)*8]:[p.x,0,p.z]);}
      }
      for(const a of actors){const p=localPoint(a);if(Math.abs(p.x-camera.x)>camera.span*2||Math.abs(p.z-camera.z)>camera.span*2)continue;renderer.actor({...a,x:p.x,z:p.z},simTime,motion.matches||!a.walking);}
      drawAtlas();
      if(firstReadyMs===null&&visible.length&&visible.every(v=>cache.items.has(v.key)))firstReadyMs=performance.now()-born;
      const d=localPoint(world.deposit),p=renderer.project(camera,d.x,d.y+.7,d.z);$('rootMarker').style.left=`${p.x}px`;$('rootMarker').style.top=`${p.y}px`;$('rootMarker').hidden=p.x<0||p.y<0||p.x>canvas.clientWidth||p.y>canvas.clientHeight;
      if(selection){const s=localPoint(selection),p=renderer.project(camera,s.x,s.y+.04,s.z);$('groundMarker').hidden=p.x<0||p.y<0||p.x>canvas.clientWidth||p.y>canvas.clientHeight;$('groundMarker').style.left=`${p.x}px`;$('groundMarker').style.top=`${p.y}px`;}
      if(busy&&now-workerStarted>30000)fail('World generation stalled. Reload to restart the worker.');
    }
    if(now-lastHud>500){lastHud=now;hud();}requestAnimationFrame(frame);
  }
  window.addEventListener('resize',updateView);
  window.addEventListener('pagehide',()=>{worker?.terminate();cache.clear();});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  identity();resetActors();if(!failed){updateView();requestAnimationFrame(frame);}
})();
