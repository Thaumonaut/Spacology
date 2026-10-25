(function(){
  'use strict';
  // Building lab page: seed/type/style/plot controls, floor cutaway, camera presets and a live floor plan.
  // URL: ?seed=4&type=inn&style=harbour&context=corner&view=corner&floors=2 (floors = how many storeys to show).
  const P=window.BuildingPlan,V=window.BuildingVoxels,$=id=>document.getElementById(id);
  const ROOM_COLOURS={entry:'#e9d8b4',hall:'#e6dcc6',stair:'#cbbd9f',living:'#f2c79b',common:'#f0b98a',shop:'#f6d27a',workshop:'#d7c08d',kitchen:'#bcd8a6',dining:'#e8c4a2',store:'#cfc7b5',bath:'#a9d3e0',bed:'#d6b8d8',guest:'#c9bde3',study:'#b9cfe0',office:'#c4d4c0'};
  const state={plan:null,building:null,visible:0,errors:[],ready:false,view:'corner',timings:{}};
  let renderer=null;
  window.addEventListener('error',e=>state.errors.push(String(e.message)));

  for(const [id,src] of [['type',P.TYPES],['style',P.STYLES],['context',P.CONTEXTS],['typology',P.TYPOLOGIES]])for(const [k,v] of Object.entries(src)){const o=document.createElement('option');o.value=k;o.textContent=v.label;$(id).append(o);}
  const q=new URLSearchParams(location.search);
  $('seed').value=q.get('seed')||'1';for(const k of ['type','style','context','typology'])if(q.get(k))$(k).value=q.get(k);
  if(q.get('view'))state.view=q.get('view');

  function notice(t){$('notice').textContent=t;}
  function build(){
    state.ready=false;notice('Building…');
    requestAnimationFrame(()=>setTimeout(()=>{try{
      const t0=performance.now(),opts={type:$('type').value||undefined,style:$('style').value||undefined,context:$('context').value||undefined,typology:$('typology').value||undefined};
      const plan=P.generate(Number($('seed').value)||0,opts),t1=performance.now(),b=V.build(plan),t2=performance.now();
      if(!renderer)renderer=window.BuildingRenderer.createRenderer($('view'));
      const mesh=renderer.setBuilding(b);state.plan=plan;state.building=b;
      state.timings={planMs:Math.round(t1-t0),voxelMs:Math.round(t2-t1),meshMs:Math.round(mesh.meshMs)};state.quads=mesh.quads;
      const floors=Number(q.get('floors'));state.visible=floors>0?Math.min(floors,plan.floors.length):plan.floors.length+1;q.delete('floors');
      setView(state.view,false);summary();floorButtons();applyVisible();notice('');state.ready=true;
      const u=new URL(location.href);u.searchParams.set('seed',plan.seed);for(const k of ['type','style','context','typology']){if($(k).value)u.searchParams.set(k,$(k).value);else u.searchParams.delete(k);}history.replaceState(null,'',u);
    }catch(e){state.errors.push(e.message);notice('Could not build: '+e.message);console.error(e);}},0));
  }
  function summary(){const p=state.plan,b=state.building,[X,Y,Z]=b.dims;
    $('name').textContent=`${p.typeLabel} · ${p.styleLabel}`;
    $('facts').textContent=`${P.CONTEXTS[p.context].label}, ${(p.plot.w*p.cell).toFixed(1)} m frontage × ${((p.plot.d-p.plot.front)*p.cell).toFixed(1)} m deep, ${p.floors.length} storeys${p.plot.jetty?', upper floor jettied over the street':''}${p.plot.masks[0].some((v,i)=>!v&&Math.floor(i/p.plot.w)>=p.plot.front)?', with a yard':''}. Plan: ${p.typologyLabel.toLowerCase()}, ${p.stair.kind==='dogleg'?'U-turn':'straight'} stair. ${b.info.furniture.length} kit pieces placed.`;
    $('stats').textContent=`seed ${p.seed} · plan score ${p.score}\nvolume ${X}×${Y}×${Z} @ 6.25 cm (${(X*Y*Z/1e6).toFixed(1)} M cells, ${(b.solid/1e6).toFixed(2)} M solid)\nquads ${state.quads.toLocaleString()} · plan ${state.timings.planMs} ms · voxels ${state.timings.voxelMs} ms · mesh ${state.timings.meshMs} ms\nframe ${renderer.state.lastFrameMs.toFixed(1)} ms (CPU submit)`;}
  function floorButtons(){const box=$('floors');box.textContent='';const n=state.plan.floors.length;
    for(let k=1;k<=n+1;k++){const btn=document.createElement('button');btn.type='button';btn.textContent=k===n+1?'Roof':k===1?'Ground':`Floor ${k}`;btn.dataset.visible=k;btn.addEventListener('click',()=>{state.visible=k;applyVisible();});box.append(btn);}}
  function applyVisible(){renderer.state.visible=state.visible;for(const b of $('floors').children)b.setAttribute('aria-pressed',String(Number(b.dataset.visible)===state.visible));drawPlan();redraw();}

  // Floor plan of the highest visible storey: rooms, walls, doors, windows and placed furniture.
  function drawPlan(){const p=state.plan,b=state.building,f=Math.min(state.visible,p.floors.length)-1,c=$('plan'),g=c.getContext('2d');
    $('planFloor').textContent=f===0?'ground floor':`floor ${f+1}`;g.clearRect(0,0,c.width,c.height);planTo(g,p,f,12,12,c.width-24,c.height-24,b,12);
    const F=p.floors[f];
    $('rooms').textContent=F.rooms.filter(r=>r.type!=='stair').map(r=>`${r.label} ${r.area} m²`).join(' · ');}

  // Draw one floor of a plan into a box (also used for the contact sheet of many seeds).
  function planTo(g,p,f,bx,by,bw,bh,b,font){const F=p.floors[f],{w,d}=p.plot,s=Math.min(bw/w,bh/d),ox=bx+(bw-w*s)/2,oz=by+(bh-d*s)/2;
    g.fillStyle='#d9cfb9';g.fillRect(ox,oz,w*s,p.plot.front*s);g.fillStyle='#e4dcc6';
    for(let z=p.plot.front;z<d;z++)for(let x=0;x<w;x++)if(F.grid[x+w*z]<0)g.fillRect(ox+x*s,oz+z*s,s+.5,s+.5); // yard and courtyard
    for(let z=0;z<d;z++)for(let x=0;x<w;x++){const k=F.grid[x+w*z];if(k<0)continue;g.fillStyle=F.voids.includes(x+w*z)&&!F.steps.includes(x+w*z)?'#9a8d74':ROOM_COLOURS[F.rooms[k].type]||'#ddd';g.fillRect(ox+x*s,oz+z*s,s+.5,s+.5);}
    if(b){const vs=s/V.CV,[MX,,MZ]=b.origin;g.fillStyle='#5d4a3a88';for(const it of b.info.furniture)if(it.floor===f)g.fillRect(ox+(it.x-MX)*vs,oz+(it.z-MZ)*vs,it.w*vs,it.d*vs);}
    g.strokeStyle='#3b3128';g.lineWidth=Math.max(1.2,s*.18);g.beginPath();const room=(x,z)=>x<0||z<0||x>=w||z>=d?-1:F.grid[x+w*z];
    for(let z=0;z<=d;z++)for(let x=0;x<w;x++)if(room(x,z-1)!==room(x,z)){g.moveTo(ox+x*s,oz+z*s);g.lineTo(ox+(x+1)*s,oz+z*s);}
    for(let z=0;z<d;z++)for(let x=0;x<=w;x++)if(room(x-1,z)!==room(x,z)){g.moveTo(ox+x*s,oz+z*s);g.lineTo(ox+x*s,oz+(z+1)*s);}g.stroke();
    const edge=(x,z,side,col,wd)=>{g.strokeStyle=col;g.lineWidth=wd;g.beginPath();const X0=ox+x*s,Z0=oz+z*s,q=s*.15;
      if(side==='xp'){g.moveTo(X0+s,Z0+q);g.lineTo(X0+s,Z0+s-q);}else if(side==='xm'){g.moveTo(X0,Z0+q);g.lineTo(X0,Z0+s-q);}else if(side==='zp'){g.moveTo(X0+q,Z0+s);g.lineTo(X0+s-q,Z0+s);}else{g.moveTo(X0+q,Z0);g.lineTo(X0+s-q,Z0);}g.stroke();};
    const lw=Math.max(2,s*.3);for(const dr of F.doors)for(const [x,z] of dr.cells)edge(x,z,dr.dir,dr.kind==='open'?'#cbbd9f':'#f3ecdc',lw);
    for(const o of F.openings)for(const [x,z] of o.cells)edge(x,z,o.side,o.kind==='front'||o.kind==='back'?'#c0503a':'#5fa8d3',lw);
    g.fillStyle='#2b241d';g.font=`600 ${font}px system-ui`;g.textAlign='center';
    F.rooms.forEach(r=>{if(!r.box||r.type==='stair'||r.type==='hall')return;const [x0,z0,x1,z1]=r.box;g.fillText(r.label.replace(' room',''),ox+(x0+x1+1)/2*s,oz+(z0+z1+1)/2*s+font/3);});g.textAlign='left';}
  // A contact sheet: ground floors of many seeds side by side, to see the variety at a glance.
  function planSheet(seeds,opts={},cols=4,cell=300){const c=document.createElement('canvas'),rows=Math.ceil(seeds.length/cols);c.width=cols*cell;c.height=rows*(cell+34);const g=c.getContext('2d');g.fillStyle='#f3ecdc';g.fillRect(0,0,c.width,c.height);
    seeds.forEach((seed,i)=>{const p=P.generate(seed,opts),x=(i%cols)*cell,y=Math.floor(i/cols)*(cell+34);planTo(g,p,opts.floor||0,x+8,y+30,cell-16,cell-16,null,10);
      g.fillStyle='#2b241d';g.font='600 12px system-ui';g.fillText(`${seed} · ${p.typeLabel.split(' (')[0]} · ${p.typologyLabel}`,x+8,y+14);g.font='11px system-ui';g.fillStyle='#6b5d48';g.fillText(`${P.CONTEXTS[p.context].label}, ${p.floors.length} storeys, ${p.stair.kind==='dogleg'?'U-turn':'straight'} stair`,x+8,y+27);});
    return c.toDataURL('image/png');}
  // Camera.
  const VIEWS={street:{yaw:.18,pitch:.1,dist:.62},corner:{yaw:-.7,pitch:.42,dist:.9},back:{yaw:Math.PI+.55,pitch:.35,dist:.85},above:{yaw:-.35,pitch:1.15,dist:.95}};
  function setView(name,draw=true){const v=VIEWS[name]||VIEWS.corner,s=renderer.state,[X,,Z]=state.building.dims.map(n=>n*state.building.cell);state.view=name;
    s.yaw=v.yaw;s.pitch=v.pitch;s.dist=s.extent*v.dist;s.target=[X/2,(state.building.levels[1]*state.building.cell)*(name==='street'?.8:1.1),Z/2+(name==='street'?-1:0)];
    for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===name));if(draw)redraw();}
  let pending=false;function redraw(){if(pending||!renderer)return;pending=true;requestAnimationFrame(()=>{pending=false;renderer.draw();if(state.plan)$('stats').textContent=$('stats').textContent.replace(/frame [\d.]+ ms/,`frame ${renderer.state.lastFrameMs.toFixed(1)} ms`);});}
  const cv=$('view'),pts=new Map();let last=null;
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);last=null;});
  cv.addEventListener('pointerup',e=>{pts.delete(e.pointerId);last=null;});cv.addEventListener('pointercancel',e=>{pts.delete(e.pointerId);last=null;});
  cv.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId)||!renderer)return;const prev=pts.get(e.pointerId),dx=e.clientX-prev[0],dy=e.clientY-prev[1];pts.set(e.pointerId,[e.clientX,e.clientY]);const s=renderer.state;
    if(pts.size===2){const [a,b]=[...pts.values()],dd=Math.hypot(a[0]-b[0],a[1]-b[1]);if(last)s.dist=Math.max(2,Math.min(s.extent*2,s.dist*last/dd));last=dd;}
    else if(e.shiftKey||e.buttons===2){const k=s.dist*.0016;s.target[0]-=(Math.cos(s.yaw)*dx)*k;s.target[2]-=(Math.sin(s.yaw)*dx)*k;s.target[1]+=dy*k;}
    else{s.yaw+=dx*.006;s.pitch=Math.max(-.05,Math.min(1.45,s.pitch+dy*.005));}redraw();});
  cv.addEventListener('wheel',e=>{e.preventDefault();const s=renderer.state;s.dist=Math.max(2,Math.min(s.extent*2,s.dist*Math.exp(e.deltaY*.0012)));redraw();},{passive:false});
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('keydown',e=>{const s=renderer?.state;if(!s)return;const k={ArrowLeft:[-.08,0],ArrowRight:[.08,0],ArrowUp:[0,.06],ArrowDown:[0,-.06]}[e.key];
    if(k){s.yaw+=k[0];s.pitch=Math.max(-.05,Math.min(1.45,s.pitch+k[1]));e.preventDefault();redraw();}else if(e.key==='+'||e.key==='='){s.dist*=.9;redraw();}else if(e.key==='-'){s.dist/=.9;redraw();}});
  window.addEventListener('resize',redraw);
  for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view));
  $('form').addEventListener('submit',e=>{e.preventDefault();build();});
  $('random').addEventListener('click',()=>{$('seed').value=Math.floor(Math.random()*1e6);build();});

  window.BuildingLab={snapshot:()=>({ready:state.ready,errors:state.errors.slice(),seed:state.plan?.seed,type:state.plan?.type,typology:state.plan?.typology,style:state.plan?.style,context:state.plan?.context,storeys:state.plan?.floors.length,visible:state.visible,view:state.view,
      quads:state.quads,furniture:state.building?.info.furniture.length,unreachable:state.building?.info.rooms.filter(r=>!r.reachable).length,timings:state.timings,frameMs:renderer?.state.lastFrameMs,dims:state.building?.dims}),
    setView,setVisible:k=>{state.visible=k;applyVisible();},build:(o={})=>{for(const k of ['seed','type','style','context','typology'])if(k in o)$(k).value=o[k]??'';build();},
    frame:()=>{renderer.draw();return renderer.state.lastFrameMs;},planSheet};
  build();
})();
