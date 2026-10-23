(function(root){
  'use strict';
  // Unified streamed LOD: every level is voxel nodes of world.nodeSize^2 columns, level L sampling one column per 2^L cells.
  // A view requests one target level. Until a target node is ready, the screen shows the lowest ready ancestor that covers
  // its whole group (or finer nodes still cached), so old detail never disappears before new detail covers it. New nodes
  // dissolve in over the ones they replace; node borders carry skirts (in the mesher) to hide level seams.
  const M=root.MicroWorld,FADE=250,SAMPLES=240;
  // Smooth-terrain comparison: ?mesh=smooth meshes the ground with Surface Nets (standing objects stay blocky).
  const SMOOTH=new URLSearchParams(root.location?.search||'').get('mesh')==='smooth';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const percentile=(list,p)=>{if(!list.length)return 0;const s=[...list].sort((a,b)=>a-b);return s[Math.floor((s.length-1)*p)];};
  const push=(list,n)=>{list.push(n);if(list.length>SAMPLES)list.shift();};
  // GPU budget: WebGL cannot report device memory, so classify the device. Desktop 384 MiB; phones/tablets 256 MiB with
  // >= 6 GB reported RAM, else 192 MiB. `?gpuMiB=` overrides; Economy uses 128 MiB.
  function deviceBudgetMiB(params){
    const forced=Number(params.get('gpuMiB'));if(Number.isFinite(forced)&&forced>=2)return forced;
    const mobile=matchMedia('(pointer: coarse)').matches&&navigator.maxTouchPoints>0;
    // A cache of tiles already seen; a full close view needs roughly 50 MiB, so these leave room to pan back without
    // holding a whole session's worth of terrain.
    return mobile?(navigator.deviceMemory>=6?256:192):384;
  }
  function create({renderer,canvas,createWorker,onFail}){
    const count=clamp((navigator.hardwareConcurrency||4)-1,1,4),workers=[];
    // Evicting a node the view still needs means the level does not fit the budget (e.g. tall terrain has larger nodes
    // than the cache average predicted): coarsen one level instead of thrashing.
    let pressure=0,requested=-1,targetKeys=new Set();
    const cache=new M.BudgetCache(16384,1024*1048576,mesh=>{if(targetKeys.has(mesh.key))pressure++;renderer.dispose(mesh);});
    let bias=0,lastView=null,world=null,level=0,targets=[],drawList=[],drawKeys=new Set(),drawDirty=true,epoch=0,camera=null,origin={x:0,z:0},coarseFirst=true,lit=new Set();
    const inflight=new Map(),fades=new Map(),outgoing=new Map();
    const stats={completed:0,coarse:0,retained:0,uploads:0,vegetation:0,maxOrigin:0},times={geography:[],trees:[],features:[],reduce:[],mesh:[],node:[],view:[],resolve:[],draw:[],upload:[],gpu:[]};
    let gpu=null;
    try{const gl=renderer.gl,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(ext)gpu={gl,ext,queries:[],active:null};}catch(_){gpu=null;}
    const K=(L,nx,nz)=>`${L}:${nx}:${nz}`;
    const ready=key=>cache.items.has(key);
    function spawn(){
      const w=createWorker(),slot={w,job:null,started:0};
      w.onerror=()=>onFail('The world worker could not load. Serve the lab over HTTP, then reload.');
      w.onmessage=({data})=>receive(slot,data);
      workers.push(slot);
    }
    // Detail: true builds objects, grass, leaf cards and flowers with each tile; false (Economy) is voxels only. Changing it
    // rebuilds every tile.
    let detail=true;
    function setDetail(on){if(detail===on)return;detail=on;if(world)setWorld(world);}
    function setWorld(next){
      world=next;pressure=bias=0;requested=-1;targetKeys=new Set();cache.clear();inflight.clear();fades.clear();outgoing.clear();lit.clear();targets=[];drawList=[];drawKeys=new Set();drawDirty=true;epoch++;
      for(const k of Object.keys(stats))stats[k]=0;for(const k of Object.keys(times))times[k].length=0;
      for(const s of workers)s.job=null;
      if(world.infinite)while(workers.length<count)spawn();
    }
    function setBudget(mib){cache.maxBytes=mib*1048576;while(cache.bytes>cache.maxBytes&&cache.items.size)cache.delete(cache.items.keys().next().value);}
    // Target nodes at level L that can reach the screen: candidates from the view footprint up to world height, then a
    // projection test against each node's own height bound.
    function compute(L){
      const m=world.nodeMetres(L),b=renderer.bounds(camera,world.heightMetres),out=[],w=canvas.clientWidth,h=canvas.clientHeight;
      for(let nz=Math.floor((b.minZ+origin.z)/m);nz<=Math.floor((b.maxZ+origin.z)/m);nz++)for(let nx=Math.floor((b.minX+origin.x)/m);nx<=Math.floor((b.maxX+origin.x)/m);nx++){
        const ox=nx*m-origin.x,oz=nz*m-origin.z,top=world.nodeBound(L,nx,nz);let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
        for(const y of [0,top])for(const z of [oz,oz+m])for(const x of [ox,ox+m]){const p=renderer.project(camera,x,y,z);x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);}
        if(x1<0||x0>w||y1<0||y0>h)continue;
        out.push({L,nx,nz,key:K(L,nx,nz),distance:Math.hypot(ox+m/2-camera.x,oz+m/2-camera.z)});
      }
      return out.sort((a,b)=>a.distance-b.distance);
    }
    // Choose the level: the requested one, made coarser (automatic) until the visible set fits comfortably in budget.
    // A pinned level never changes; the caller narrows the view instead when overBudget is reported.
    function update(view){
      const t0=performance.now();lastView=view;camera=view.camera;origin=view.origin;coarseFirst=!view.pinned;
      const avg=cache.items.size>16?cache.bytes/cache.items.size:40*1024,fits=list=>list.length<=cache.maxEntries*.5&&list.length*avg<=cache.maxBytes*.5;
      if(view.level!==requested||view.fresh){requested=view.level;bias=0;}
      if(pressure&&!view.pinned){bias++;pressure=0;}
      let L=clamp(view.level+bias,0,world.maxLevel),list=compute(L);
      while(!view.pinned&&!fits(list)&&L<world.maxLevel)list=compute(++L);
      epoch++;
      level=L;targets=list;targetKeys=new Set(list.map(t=>t.key));drawDirty=true;push(times.view,performance.now()-t0);pump();
      return {level,overBudget:!fits(list)};
    }
    const ancestor=(n,k)=>{const f=2**(k-n.L);return {L:k,nx:Math.floor(n.nx/f),nz:Math.floor(n.nz/f)};};
    // Draw list: per group, the finest complete coverage. A coarser node is drawn only where some target below it is not
    // ready, so a group swaps to finer detail all at once and never overlaps itself.
    function resolve(now){
      const t0=performance.now(),R=Math.min(world.maxLevel,level+3),tree=new Map(),roots=new Map();
      for(const t of targets){
        let child=t;
        for(let k=level+1;k<=R;k++){const a=ancestor(t,k),key=K(a.L,a.nx,a.nz);let node=tree.get(key);if(!node){node={...a,key,children:new Map()};tree.set(key,node);}node.children.set(child.key,child);child=node;}
        if(level===R)roots.set(t.key,t);else roots.set(child.key,child);
      }
      const fine=n=>{for(const d of [1,2]){if(n.L-d<0)break;const f=2**d,list=[];for(let j=0;j<f;j++)for(let i=0;i<f;i++){const key=K(n.L-d,n.nx*f+i,n.nz*f+j);if(!ready(key)){list.length=0;break;}list.push({L:n.L-d,nx:n.nx*f+i,nz:n.nz*f+j,key});}if(list.length===f*f)return list;}return null;};
      const visit=n=>{
        if(n.L===level){if(ready(n.key))return {list:[n],complete:true};const f=fine(n);return f?{list:f,complete:true}:{list:[],complete:false};}
        const parts=[...n.children.values()].map(visit);
        if(parts.every(p=>p.complete))return {list:parts.flatMap(p=>p.list),complete:true};
        if(ready(n.key))return {list:[n],complete:true};
        return {list:parts.flatMap(p=>p.list),complete:false};
      };
      const list=[...roots.values()].flatMap(r=>visit(r).list),keys=new Set(list.map(n=>n.key));
      // Dissolve: nodes that replace something on screen fade in; what they replaced fades out on the same clock.
      const chain=key=>{const [L,nx,nz]=key.split(':').map(Number),out=[];for(let k=L+1;k<=world.maxLevel;k++){const a=ancestor({L,nx,nz},k);out.push(K(a.L,a.nx,a.nz));}return out;};
      const prevUnder=new Map();for(const k of drawKeys)for(const a of chain(k))prevUnder.set(a,true);
      const fresh=[];
      // Only the real tile's arrival dissolves; coarse-first placeholders replace one another instantly, so a spot does
      // not sparkle through several dissolves before its detail arrives.
      for(const n of list)if(n.L<=level&&!drawKeys.has(n.key)&&(chain(n.key).some(a=>drawKeys.has(a))||prevUnder.has(n.key))){fades.set(n.key,now);fresh.push(n.key);}
      if(fresh.length){
        const freshSet=new Set(fresh),freshUnder=new Set();for(const k of fresh)for(const a of chain(k))freshUnder.add(a);
        for(const k of drawKeys)if(!keys.has(k)&&ready(k)&&(freshUnder.has(k)||chain(k).some(a=>freshSet.has(a))))outgoing.set(k,now);
      }
      for(const k of fades.keys())if(!keys.has(k))fades.delete(k);
      // A tile shown fully lit stays lit if a zoom turns it into a placeholder, rather than flashing flat until the finer
      // tiles arrive.
      for(const n of list)if(n.L<=level)lit.add(n.key);for(const k of lit)if(!keys.has(k)&&!outgoing.has(k))lit.delete(k);
      drawList=list;drawKeys=keys;drawDirty=false;push(times.resolve,performance.now()-t0);
    }
    function draw(now){
      if(!world?.infinite)return;
      if(drawDirty)resolve(now);
      const t0=performance.now(),gl=renderer.gl;stats.maxOrigin=0;renderer.worldOrigin=origin;
      if(gpu&&!gpu.active){const q=gl.createQuery();gl.beginQuery(gpu.ext.TIME_ELAPSED_EXT,q);gpu.active=q;}
      const one=(key,mode,t)=>{
        const mesh=cache.items.get(key);if(!mesh)return;const [L,nx,nz]=key.split(':').map(Number),m=world.nodeMetres(L),c=mesh.column;
        const ox=nx*m-origin.x,oz=nz*m-origin.z;stats.maxOrigin=Math.max(stats.maxOrigin,Math.abs(ox),Math.abs(oz));renderer.dither(mode,t);renderer.placeholder(L>level&&!lit.has(key));
        renderer.draw(mesh,[ox,0,oz],[c,c,c],0,0,0,[0,0,0],[((nx*m)%4096+4096)%4096,0,((nz*m)%4096+4096)%4096]);
      };
      for(const n of drawList){const s=fades.get(n.key),t=s===undefined?1:(now-s)/FADE;if(t>=1){fades.delete(n.key);one(n.key,0,0);}else one(n.key,1,t);}
      for(const [key,s] of outgoing){const t=(now-s)/FADE;if(t>=1||drawKeys.has(key)){outgoing.delete(key);continue;}one(key,-1,t);}
      renderer.dither(0,0);renderer.placeholder(false);
      if(gpu?.active){gl.endQuery(gpu.ext.TIME_ELAPSED_EXT);gpu.queries.push(gpu.active);gpu.active=null;
        while(gpu.queries.length&&gl.getQueryParameter(gpu.queries[0],gl.QUERY_RESULT_AVAILABLE)){const q=gpu.queries.shift();if(!gl.getParameter(gpu.ext.GPU_DISJOINT_EXT))push(times.gpu,gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}
        if(gpu.queries.length>8){for(const q of gpu.queries)gl.deleteQuery(q);gpu.queries.length=0;}}
      push(times.draw,performance.now()-t0);
      for(const s of workers)if(s.job&&now-s.started>30000){onFail('World generation stalled. Reload to restart the worker.');return;}
    }
    // Coverage first: a visible target with nothing drawable over it gets its ancestor two levels up built before any
    // fine node, so a fresh view fills quickly and then sharpens. Then targets nearest the view centre.
    function nextJob(){
      if(coarseFirst){
        const C=Math.min(world.maxLevel,level+2);
        if(C>level)for(const t of targets){
          if(ready(t.key))continue;let covered=false;
          for(let k=level+1;k<=Math.min(world.maxLevel,level+3)&&!covered;k++){const a=ancestor(t,k);covered=ready(K(a.L,a.nx,a.nz));}
          if(covered)continue;const a=ancestor(t,C),key=K(a.L,a.nx,a.nz);
          if(!inflight.has(key))return {...a,key,coarse:true};
        }
      }
      for(const t of targets)if(!ready(t.key)&&!inflight.has(t.key))return t;
      return null;
    }
    function pump(){
      if(!world?.infinite)return;
      for(const s of workers){
        if(s.job)continue;const job=nextJob();if(!job)return;
        s.job={...job,epoch};s.started=performance.now();inflight.set(job.key,s);
        s.w.postMessage({node:{L:job.L,nx:job.nx,nz:job.nz,smooth:SMOOTH,props:detail},key:job.key,dataId:world.dataId,seed:world.seed,cell:world.cell,extent:world.extent,map:world.map});
      }
    }
    function receive(slot,data){
      const job=slot.job;slot.job=null;if(job)inflight.delete(job.key);
      if(data.error){if(data.dataId===world.dataId)onFail(`World generation failed: ${data.error}`);pump();return;}
      if(data.dataId!==world.dataId||!job||data.key!==job.key){pump();return;}
      const t0=performance.now(),mesh=renderer.upload(data);Object.assign(mesh,{key:data.key,column:data.column,level:data.level,quads:data.quads});
      cache.set(data.key,mesh,[...drawKeys,...outgoing.keys()]);
      push(times.upload,performance.now()-t0);stats.completed++;stats.uploads++;if(job.coarse)stats.coarse++;if(job.epoch!==epoch)stats.retained++;stats.vegetation=data.vegetationEntries||stats.vegetation;
      push(times.node,data.generateMs);for(const k of ['geography','trees','features','reduce','mesh'])push(times[k],data.timing?.[k]||0);
      drawDirty=true;if(pressure&&lastView)update(lastView);else pump();
    }
    function snapshot(){
      // Covered: ready, or something drawable over it (a ready ancestor within three levels, or all finer nodes cached).
      const R=Math.min(world?.maxLevel??0,level+3),covered=targets.filter(t=>{if(ready(t.key))return true;for(let k=level+1;k<=R;k++){const a=ancestor(t,k);if(ready(K(a.L,a.nx,a.nz)))return true;}if(t.L===0)return false;const f=[];for(let j=0;j<2;j++)for(let i=0;i<2;i++)f.push(K(t.L-1,t.nx*2+i,t.nz*2+j));return f.every(ready);}).length;
      const readyCount=targets.filter(t=>ready(t.key)).length,levels={};
      for(const m of cache.items.values())levels[m.level]=(levels[m.level]||0)+1;
      return {level,column:world?world.nodeMetres(level)/world.nodeSize:0,visible:targets.length,ready:readyCount,covered,drawn:drawList.length,fading:fades.size+outgoing.size,inflight:inflight.size,workers:workers.length,
        entries:cache.items.size,bytes:cache.bytes,budget:cache.maxBytes,levels,...stats,gpuTimer:!!gpu,
        timing:Object.fromEntries(Object.entries(times).map(([k,v])=>[k,{p50:percentile(v,.5),p95:percentile(v,.95),n:v.length}]))};
    }
    const complete=()=>targets.length>0&&targets.every(t=>ready(t.key));
    function dispose(){for(const s of workers)s.w.terminate();workers.length=0;cache.clear();}
    return {setWorld,setDetail,setBudget,update,draw,pump,snapshot,dispose,complete,cache,get pending(){return inflight.size>0||drawDirty;}};
  }
  root.MicroLOD={create,deviceBudgetMiB};
})(globalThis);
