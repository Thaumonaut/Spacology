(function(root){
  'use strict';
  const node=typeof module==='object'&&module.exports;
  const P=node?require('./plan.js'):root.BuildingPlan,V=node?require('./voxels.js'):root.BuildingVoxels;
  const REVISION='architect-review-2';
  const BODY={radius:.25,height:1.6,maxStep:.25,sample:.125};
  const PROGRAMMES={
    home:{required:['living','kitchen','bed','bath'],arrival:'resident'},
    shophouse:{required:['shop','kitchen','living','bed','bath'],arrival:'customer'},
    workshop:{required:['workshop','kitchen','living','bed','bath'],arrival:'worker'},
    inn:{required:['common','kitchen','guest','bath'],arrival:'guest'}
  };
  const ESSENTIALS={bed:[['bed',/^bed_/]],guest:[['bed',/^bed_/]],bath:[['bathing fixture',/^(tub|shower)/],['toilet',/^toilet$/],['washbasin',/^washbasin$/]],
    study:[['desk',/^table_/],['desk chair',/^chair_/]],dining:[['dining table',/^table_/],['seating',/^chair_/]],
    kitchen:[['cooking appliance',/^(stove|oven)/],['sink',/^kitchencounter_sink/]],
    living:[['seating',/^(couch|armchair)/]],common:[['table',/table/],['seating',/^chair/]],
    shop:[['sales counter',/^sales_counter/]],workshop:[['work surface',/^(kitchentable|workbench|table)/]]};
  const PRIVATE=new Set(['bed','guest','bath','study','office']);
  const DIR={xm:[-1,0],xp:[1,0],zm:[0,-1],zp:[0,1]};
  const key=(f,k)=>`${f}:${k}`;
  function path(graph,starts,goal,allowed=()=>true){
    const prev=new Map(),queue=[];for(const s of starts)if(allowed(s)&&!prev.has(s)){prev.set(s,null);queue.push(s);}
    for(let i=0;i<queue.length;i++){const a=queue[i];if(goal(a)){const out=[];for(let n=a;n!==null;n=prev.get(n))out.push(n);return out.reverse();}
      for(const b of graph(a))if(!prev.has(b)&&allowed(b)){prev.set(b,a);queue.push(b);}}
    return null;
  }
  function review(plan,building=null,options={}){
    const body={...BODY,...options.body};
    const hallwayWidth=options.hallwayWidth??P.ARCHITECTURE.hallway.clear;
    if(!Number.isFinite(hallwayWidth)||hallwayWidth<body.radius*2)throw Error('Invalid minimum hallway width');
    for(const k of Object.keys(BODY))if(!Number.isFinite(body[k])||body[k]<=0)throw Error('Invalid review body '+k);
    if(body.height<=body.maxStep||body.sample>body.radius*2)throw Error('Review sampling must cover the body and leave headroom');
    const programme={...PROGRAMMES[plan.type],...options.programme};
    if(!programme.required)throw Error('No architectural programme for '+plan.type);
    const findings=[],journeys=[],rooms=new Map(),adj=new Map(),edgeRoles=new Map(),entrances=[];
    const add=(severity,code,message,where={})=>findings.push({severity,code,message,...where});
    if(Number.isFinite(plan.plot.compactDepth)){
      let rear=-1;plan.floors[0].grid.forEach((k,i)=>{if(k>=0)rear=Math.max(rear,Math.floor(i/plan.plot.w));});
      if(rear-plan.plot.front+1>plan.plot.compactDepth)add('error','building-depth',`Ground-floor wings and extensions exceed the ${(plan.plot.compactDepth*plan.cell).toFixed(1)} m occupied-depth allowance. Keep unused depth as yard instead.`,{floor:0});
    }
    const link=(a,b,roles)=>{if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);
      adj.get(a).push(b);adj.get(b).push(a);edgeRoles.set(a+'>'+b,roles);edgeRoles.set(b+'>'+a,roles);};
    const kitchenArea=Math.min(...plan.floors.flatMap(F=>F.rooms.filter(r=>r.type==='kitchen'&&r.cells).map(r=>r.area)));
    plan.floors.forEach((F,f)=>{
      F.rooms.forEach(r=>{if(r.cells)rooms.set(key(f,r.id),{...r,zone:r.zone||P.roomZone(plan.type,f,r),floor:f});});
      for(const d of F.doors)if(rooms.has(key(f,d.a))&&rooms.has(key(f,d.b)))
        link(key(f,d.a),key(f,d.b),d.roles||P.doorRoles(rooms.get(key(f,d.a)),rooms.get(key(f,d.b))));
      for(const o of F.openings)if(['front','back'].includes(o.kind))entrances.push({...o,floor:f,node:key(f,o.room)});
      const exteriorDoors=F.openings.filter(o=>['front','back'].includes(o.kind));
      for(let i=0;i<exteriorDoors.length;i++)for(let j=0;j<i;j++)if(P.exteriorDoorsConflict(exteriorDoors[i],exteriorDoors[j]))
        add('error','exterior-door-conflict','Exterior doors overlap or crowd the same corner; keep a wall pier between separate openings.',{floor:f,room:exteriorDoors[i].room});
      for(const o of P.redundantExteriorDoors(plan.plot,F,F.doors,F.openings))
        add('error','redundant-exterior-door','Remove the unnecessary exterior entrance; spacing it farther from another door does not justify it.',{floor:f,room:o.room});
      for(const d of F.doors.filter(d=>d.kind==='door'))for(const k of [d.a,d.b])if(F.rooms[k].type==='shop'&&!P.shopDoorAtRear(F.rooms[k],d))
        add('error','shop-door-position','Shop internal doors must be toward the rear, away from the customer entrance.',{floor:f,room:k});
      for(const o of F.openings.filter(o=>o.kind==='back'))if(F.rooms[o.room].type==='shop'&&!P.shopDoorAtRear(F.rooms[o.room],o))
        add('error','shop-door-position','Shop service doors must be toward the rear; only its customer entrance belongs at the front.',{floor:f,room:o.room});
      if(f&&rooms.has(key(f,0))&&rooms.has(key(f-1,0)))link(key(f-1,0),key(f,0),['resident']);
      for(const note of F.notes)add('error','planner-failure',note,{floor:f});
      const occupied=F.rooms.filter(r=>r.cells),area=occupied.reduce((s,r)=>s+r.area,0);
      for(const r of occupied){
        const budget=P.roomBudget(plan.type,f,r);
        if(budget.maxA&&r.area>budget.maxA)add('error','room-budget',`${r.label} occupies ${r.area} m²; its programme allows at most ${budget.maxA} m². Subdivide it with valid access and daylight.`,{floor:f,room:r.id});
        if(['study','bath','dining'].includes(r.type)&&(r.area<budget.minA||Math.min(r.box[2]-r.box[0]+1,r.box[3]-r.box[1]+1)<budget.minW))add('error','room-minimum',`${r.label} needs at least ${budget.minA} m² and a ${(budget.minW*plan.cell).toFixed(1)} m nominal width.`,{floor:f,room:r.id});
        if(r.type==='dining'&&!P.diningKitchenRoute(F,F.doors,r.id))add('error','dining-kitchen-proximity','Dining needs a nearby kitchen on the same floor, directly connected or across a short domestic circulation route.',{floor:f,room:r.id});
        if(r.type==='living'&&r.area>area*.5&&occupied.some(b=>b.type==='bed'))add('warning','room-balance',`Living room occupies ${Math.round(r.area/area*100)}% of floor ${f+1}; review household programme.`,{floor:f,room:r.id});
        if(r.type==='hall'&&r.area>area*.25)add('warning','circulation-area','More than a quarter of this floor is hall.',{floor:f,room:r.id});
        if(r.type==='bath'&&(r.area>P.ARCHITECTURE.bath.preferred[1]||r.area>=kitchenArea))add('error','bath-budget',`${r.label} occupies ${r.area} m²; bathrooms must stay within ${P.ARCHITECTURE.bath.preferred[1]} m² and be smaller than the kitchen.`,{floor:f,room:r.id});
        if(!['hall','stair'].includes(r.type)&&r.box){const width=r.box[2]-r.box[0]+1,depth=r.box[3]-r.box[1]+1,aspect=Math.max(width,depth)/Math.min(width,depth);
          if(aspect>P.ARCHITECTURE.rareAspect)add('warning','narrow-room',`${r.label} is ${aspect.toFixed(1)}:1; long narrow rooms should be rare.`,{floor:f,room:r.id});}
      }
    });
    const yardEdges=P.serviceYardRoutes(plan.plot,plan.floors[0].openings);
    for(const {a,b} of yardEdges)if(rooms.get(key(0,a))?.zone!=='resident'&&rooms.get(key(0,b))?.zone!=='resident')link(key(0,a),key(0,b),['employee']);
    for(const type of programme.required)if(![...rooms.values()].some(r=>r.type===type))add('error','missing-room',`Programme requires a ${type}.`);
    if(!entrances.length)add('error','missing-entrance','Building has no planned exterior entrance.');
    const roomType=id=>rooms.get(id)?.type;
    const roleAllows=(role,id)=>{const zone=rooms.get(id)?.zone;
      return role==='resident'?zone==='resident'||plan.type==='inn'&&zone==='public':role==='customer'?zone==='public':zone==='public'||zone==='service';};
    function journey(label,starts,target,role='resident',forbidden=[]){
      const allowed=id=>id===target||starts.includes(id)||roleAllows(role,id)&&!PRIVATE.has(roomType(id))&&!forbidden.includes(roomType(id))&&(roomType(id)!=='dining'||P.throughRoom(rooms.get(id)));
      const route=path(a=>(adj.get(a)||[]).filter(b=>edgeRoles.get(a+'>'+b)?.includes(role)),starts,a=>a===target,allowed);
      journeys.push({label,target,starts,role,entry:label.startsWith('Entrance')||label.startsWith(programme.arrival+' →'),forbidden,rooms:route,plan:route?'connected':'blocked',voxel:'not-run',points:[]});
      if(!route)add('error','programme-route',label+' has no appropriate route (privacy/service restrictions apply).',{floor:rooms.get(target).floor,room:rooms.get(target).id});
    }
    const groundEntrances=entrances.filter(e=>e.floor===0),publicType=plan.type==='shophouse'?'shop':plan.type==='workshop'?'workshop':plan.type==='inn'?'common':null;
    const residentStarts=groundEntrances.filter(e=>rooms.get(e.node)?.zone==='resident'||plan.type==='inn'&&rooms.get(e.node)?.zone==='public').map(e=>e.node);
    const publicStarts=groundEntrances.filter(e=>e.kind==='front'&&rooms.get(e.node)?.zone==='public').map(e=>e.node);
    const employeeStarts=groundEntrances.filter(e=>rooms.get(e.node)?.zone==='service'||e.kind==='front'&&rooms.get(e.node)?.zone==='public').map(e=>e.node);
    if(P.ARCHITECTURE.mixedUse.includes(plan.type)&&!groundEntrances.some(e=>e.kind==='front'&&rooms.get(e.node)?.zone==='resident'))
      add('error','resident-entrance','Mixed-use home has no independent resident street entrance.');
    for(const [id,r] of rooms){
      if(r.type==='stair')continue;
      if(r.type==='store'&&!r.bulkStorage&&r.zone==='resident'&&(adj.get(id)||[]).length>1)
        add('error','storage-through','Domestic storage must end at one entry, not connect other rooms.',{floor:r.floor,room:r.id});
      const role=r.zone==='public'?'customer':r.zone==='service'?'employee':'resident',starts=role==='customer'?publicStarts:role==='employee'?employeeStarts:residentStarts;
      journey(`Entrance → ${r.label} (floor ${r.floor+1})`,starts,id,role,r.type==='study'?['store']:[]);
      if(r.type==='study'&&!path(a=>(adj.get(a)||[]).filter(b=>edgeRoles.get(a+'>'+b)?.includes(role)),starts,a=>a===id,a=>a===id||roleAllows(role,a)&&!PRIVATE.has(roomType(a))&&roomType(a)!=='store'&&(roomType(a)!=='dining'||P.throughRoom(rooms.get(a)))))add('error','study-access','Study access must not depend on passing through storage.',{floor:r.floor,room:r.id});
      if(['bed','guest'].includes(r.type)){
        const baths=[...rooms].filter(([,b])=>b.type==='bath').map(([k])=>k);
        const nearest=path(a=>(adj.get(a)||[]).filter(b=>edgeRoles.get(a+'>'+b)?.includes('resident')),[id],a=>baths.includes(a),a=>a===id||baths.includes(a)||roleAllows('resident',a)&&!PRIVATE.has(roomType(a)));
        if(nearest)journey(`${r.label} → bath (floor ${r.floor+1})`,[id],nearest.at(-1),'resident');
        else add('error','bath-route',`${r.label} has no private route to a bath.`,{floor:r.floor,room:r.id});
      }
    }
    if(publicType){const targets=[...rooms].filter(([,r])=>r.type===publicType);
      for(const [id,r] of targets)journey(`${programme.arrival} → ${r.label}`,r.zone==='service'?employeeStarts:publicStarts,id,r.zone==='service'?'employee':'customer');
      for(const [id,r] of rooms)if(r.zone==='service'&&['store','workshop','kitchen'].includes(r.type)){
        const work=targets.map(([k])=>k);if(work.length&&id!==work[0])journey(`Service: ${r.label} → ${publicType}`,[id],work[0],'employee');
      }}
    let nav=null;
    if(building){
      const b=building,{w,d}=plan.plot,[X,Y,Z]=b.dims,[MX,,MZ]=b.origin,cv=Math.round(plan.cell/b.cell);
      const at=(x,y,z)=>x<0||y<0||z<0||x>=X||y>=Y||z>=Z?0:b.vol[x+X*(z+Z*y)];
      for(const [id,r] of rooms){
        const pieces=b.info.furniture.filter(it=>it.floor===r.floor&&it.room===r.id);
        for(const [name,re] of ESSENTIALS[r.type]||[])if(!pieces.some(it=>re.test(it.piece)))add('error','missing-essential',`${r.label} has no ${name}.`,{floor:r.floor,room:r.id});
      }
      for(const it of b.info.furniture){
        const p=V.rotated(V.piece(it.piece),it.face);let expected=0,matching=0;
        for(let y=0;y<p.h;y++)for(let z=0;z<p.d;z++)for(let x=0;x<p.w;x++){const m=p.get(x,y,z);if(m){expected++;if(at(it.x+x,it.y+y,it.z+z)===m)matching++;}}
        if(matching<expected)add(matching===0?'error':'warning','clipped-furniture',`${it.piece}: ${expected-matching}/${expected} expected material voxels differ; inspect clipping/overlap.`,{floor:it.floor,room:it.room,piece:it.piece,point:[it.x*b.cell,it.y*b.cell,it.z*b.cell]});
      }
      for(let f=0;f<plan.floors.length;f++){
        const F=plan.floors[f],above=plan.plot.masks[f+1];let holes=0,unroofed=0;
        for(let z=0;z<d;z++)for(let x=0;x<w;x++){
          const i=x+w*z,k=F.grid[i];if(k<1)continue;
          const px=MX+x*cv+(cv>>1),pz=MZ+z*cv+(cv>>1);
          if(!at(px,b.levels[f]-1,pz))holes++;
          if(!above?.[i]){let roof=false;for(let y=b.levels[f+1];y<Y;y++)if(at(px,y,pz)){roof=true;break;}if(!roof)unroofed++;}
        }
        if(holes)add('error','floor-hole',`${holes} non-stair plan-cell centres have no floor support.`,{floor:f});
        if(unroofed)add('error','roof-hole',`${unroofed} exposed plan-cell centres have no covering above.`,{floor:f});
      }
      const open=openDoors(b);
      nav=navigation(plan,open,body);
      for(const result of hallwayClearance(plan,open,hallwayWidth,body,nav))if(result.status!=='clear')
        add('error','hallway-width',`Hall does not maintain a continuous ${hallwayWidth.toFixed(2)} m clear route (${result.status}). Door thresholds and stair flights are checked separately.`,result);
      const yard=P.exteriorAccess(plan.plot),outsideAllowed=n=>{const a=nav.nodes[n],gx=Math.floor((a.point[0]/b.cell-MX)/cv),gz=Math.floor((a.point[2]/b.cell-MZ)/cv);
        return a.y<=b.levels[0]&&yard.contains(gx,gz);};
      for(const j of journeys){if(!j.rooms){j.voxel='not-applicable';continue;}
        const target=rooms.get(j.target),starts=j.starts.flatMap(id=>j.entry?entrances.filter(e=>e.node===id).flatMap(e=>nav.entry(e)):nav.anchors(id)),goals=new Set(nav.anchors(j.target));
        const route=path(a=>nav.edges(a),starts,a=>goals.has(a),n=>{
          const id=nav.nodes[n].room,t=roomType(id);return id===null?j.role==='employee'&&outsideAllowed(n):(id===j.target||j.starts.includes(id)||roleAllows(j.role,id)&&!PRIVATE.has(t)&&!j.forbidden.includes(t));});
        j.voxel=route?'connected':'blocked';j.points=route?route.map(n=>nav.nodes[n].point):[];
        if(!route)add('error','voxel-route',j.label+': no sampled body-clear route through finished voxels.',{floor:target.floor,room:target.id});
      }
      for(const [id,r] of rooms)for(const [name,re] of ESSENTIALS[r.type]||[]){
        const fixtures=b.info.furniture.filter(it=>it.floor===r.floor&&it.room===r.id&&re.test(it.piece));
        const goals=new Set(fixtures.flatMap(it=>nav.interaction(it)));
        if(fixtures.length&&!path(n=>nav.edges(n),nav.anchors(id),n=>goals.has(n),n=>nav.nodes[n].room===id))add('error','fixture-access',`${r.label}: no sampled access to ${name}.`,{floor:r.floor,room:r.id});
      }
      for(const it of b.info.furniture.filter(it=>/^sales_counter/.test(it.piece))){
        const id=key(it.floor,it.room),staff={...it,face:{xm:'xp',xp:'xm',zm:'zp',zp:'zm'}[it.face]},goals=new Set(nav.interaction(staff));
        if(!path(n=>nav.edges(n),nav.anchors(id),n=>goals.has(n),n=>nav.nodes[n].room===id))
          add('error','sales-counter-staff','Sales counter has no body-clear route to its staff side.',{floor:it.floor,room:it.room});
      }
      for(const e of groundEntrances){
        const [dx,dz]=DIR[e.side],c=e.cells,px=(c.reduce((s,a)=>s+a[0],0)/c.length+.5)*plan.cell+MX*b.cell,pz=(c.reduce((s,a)=>s+a[1],0)/c.length+.5)*plan.cell+MZ*b.cell;
        const recess=(e.recess?.depth||0)*plan.cell,inside=nav.nearest(e.node,px,pz,.9),outside=nav.nearest(null,px+dx*(.85+recess),pz+dz*(.85+recess),.8);
        const crossing=path(a=>nav.edges(a),inside,a=>outside.includes(a),n=>{const p=nav.nodes[n].point;return Math.hypot(p[0]-px,p[2]-pz)<1.7+recess;});
        if(!crossing){const unrecorded=e.kind==='back'&&!b.info.doorLeaves?.some(l=>l.floor===0&&l.room===e.room);
          add(unrecorded?'warning':'error',unrecorded?'closed-door':'entrance-blocked',unrecorded?'Back door has no recorded leaf; open-state clearance remains unverified.':`${e.kind} entrance has no sampled body-clear connection to outside with recorded door leaves opened.`,{floor:0,room:e.room,point:[px,b.levels[0]*b.cell,pz]});}
      }
    }
    const counts={errors:findings.filter(f=>f.severity==='error').length,warnings:findings.filter(f=>f.severity==='warning').length};
    return {revision:REVISION,seed:plan.seed,body,hallwayWidth,programme,counts,status:counts.errors?'defects':'needs-visual-review',findings,journeys,
      checks:{programme:'checked',hallwayWidth:building?'sampled':'not-run',furnishedRoutes:building?'sampled':'not-run',voxelIntegrity:building?'sampled':'not-run',doors:building?'recorded back-door leaves opened virtually; all other geometry as built':'not-run',visual:'pending',artDirection:'human-review',physics:'intentionally-not-enforced'},
      limitations:['Navigation samples standing surfaces and a cylindrical body with step allowance; it is not continuous player simulation.',
        'Floor/roof probes use plan-cell centres, not a proof of watertightness. Material checks cannot establish ownership of same-material overlaps.',
        'Style, silhouette appeal and deliberate fantasy impossibilities need visual judgement. No automatic quality approval.']};
  }

  function openDoors(b){
    const vol=b.vol.slice(),[X,,Z]=b.dims;
    for(const leaf of b.info.doorLeaves||[]){const [x0,y0,z0,x1,y1,z1]=leaf.box;
      for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){const i=x+X*(z+Z*y);if(vol[i]===b.M.door_wood||vol[i]===b.M.timber_dark)vol[i]=0;}}
    return {...b,vol};
  }

  function hallwayClearance(plan,b,width,body=BODY,normal=null){
    normal=normal||navigation(plan,b,body);
    const wide=navigation(plan,b,{...body,radius:width/2}),results=[],{w,d}=plan.plot,cv=plan.cell/b.cell,[MX,,MZ]=b.origin;
    plan.floors.forEach((F,f)=>{
      const thresholds=[...(F.doors||[]).filter(o=>o.kind==='door'),...F.openings.filter(o=>o.kind==='front'||o.kind==='back')].map(o=>{
        const side=o.side||o.dir,across=side[0]==='x'?0:1,along=1-across,coords=o.cells.map(c=>c[along]),edge=o.cells[0][across]+(side[1]==='p'?1:0),origin=[MX,MZ];
        return {across,along,edge:origin[across]*b.cell+edge*plan.cell,lo:origin[along]*b.cell+Math.min(...coords)*plan.cell,hi:origin[along]*b.cell+(Math.max(...coords)+1)*plan.cell};
      });
      const atThreshold=n=>{const p=[n.point[0],n.point[2]];return thresholds.some(t=>p[t.along]>=t.lo&&p[t.along]<=t.hi&&Math.abs(p[t.across]-t.edge)<=body.radius+3*b.cell);};
      const seen=new Set();
      for(let start=0;start<F.grid.length;start++){
        if(seen.has(start)||F.grid[start]<0||F.rooms[F.grid[start]].type!=='hall')continue;
        const cells=new Set([start]),queue=[start];seen.add(start);
        for(let i=0;i<queue.length;i++){const x=queue[i]%w,z=Math.floor(queue[i]/w);for(const [dx,dz] of Object.values(DIR)){
          const nx=x+dx,nz=z+dz,k=nx+w*nz;if(nx<0||nx>=w||nz<0||nz>=d||seen.has(k)||F.grid[k]<0||F.rooms[F.grid[k]].type!=='hall')continue;
          seen.add(k);cells.add(k);queue.push(k);
        }}
        const inside=n=>n.room?.startsWith(f+':')&&Math.abs(n.y-b.levels[f])<=body.maxStep/b.cell&&cells.has(Math.floor((n.point[0]/b.cell-MX)/cv)+w*Math.floor((n.point[2]/b.cell-MZ)/cv));
        const full=wide.nodes.flatMap((n,i)=>inside(n)?[i]:[]),small=normal.nodes.flatMap((n,i)=>inside(n)?[i]:[]),allowed=new Set(full),connected=new Set();let components=0;
        for(const start of full){if(connected.has(start))continue;components++;const q=[start];connected.add(start);
          for(let i=0;i<q.length;i++)for(const j of wide.edges(q[i]))if(allowed.has(j)&&!connected.has(j)){connected.add(j);q.push(j);}}
        // Cover the hall's usable edges/end caps from the full-width spine, without crossing walls or borrowing rooms.
        const positions=new Set(full.map(i=>wide.nodes[i].point.join(','))),distance=new Map(),q=[],smallSet=new Set(small);
        for(const i of small)if(positions.has(normal.nodes[i].point.join(','))){distance.set(i,0);q.push(i);}
        const reach=Math.max(width/2,width-body.radius*2)+body.sample*2;
        for(let i=0;i<q.length;i++)for(const j of normal.edges(q[i]))if(smallSet.has(j)&&!distance.has(j)){
          const next=distance.get(q[i])+body.sample;if(next<=reach){distance.set(j,next);q.push(j);}}
        // A doorway's wall-thickness/body envelope is checked by the separate body-clear routes, not hall width.
        const missed=small.find(i=>!distance.has(i)&&!atThreshold(normal.nodes[i])),status=!full.length?'too narrow':components>1?'pinched':missed!==undefined?'narrow branch':'clear',bad=normal.nodes[missed??small[0]];
        results.push({floor:f,room:F.grid[start],status,required:width,point:bad?.point||[(MX+(start%w+.5)*cv)*b.cell,b.levels[f]*b.cell,(MZ+(Math.floor(start/w)+.5)*cv)*b.cell]});
      }
    });
    return results;
  }

  function navigation(plan,b,body=BODY){
    const [X,Y,Z]=b.dims,[MX,,MZ]=b.origin,cv=Math.round(plan.cell/b.cell),{w,d}=plan.plot;
    const stride=Math.max(1,Math.floor(body.sample/b.cell)),radius=Math.ceil(body.radius/b.cell),height=Math.ceil(body.height/b.cell),step=Math.floor(body.maxStep/b.cell);
    const x0=Math.max(radius,MX-cv),z0=Math.max(radius,MZ-cv),nx=Math.floor((Math.min(X-radius,MX+(w+1)*cv)-x0)/stride),nz=Math.floor((Math.min(Z-radius,MZ+(d+1)*cv)-z0)/stride);
    const cols=Array.from({length:nx*nz},()=>[]),nodes=[],byRoom=new Map(),foot=[];
    for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
      const ax=Math.max(dx,0,-dx-1),az=Math.max(dz,0,-dz-1);
      if(ax*ax+az*az<(body.radius/b.cell)**2)foot.push([dx,dz]);
    }
    const at=(x,y,z)=>x<0||z<0||y<0||x>=X||z>=Z||y>=Y?0:b.vol[x+X*(z+Z*y)];
    for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
      const x=x0+ix*stride,z=z0+iz*stride,col=ix+nx*iz;
      for(let y=Math.max(1,b.levels[0]-cv);y<b.plate;y++){
        if(!at(x,y-1,z)||at(x,y,z))continue;
        const gx0=Math.floor((x-MX)/cv),gz0=Math.floor((z-MZ)/cv),f0=Math.min(plan.floors.length-1,Math.max(0,Math.floor((y-b.levels[0])/V.SH))),stair=gx0>=0&&gz0>=0&&gx0<w&&gz0<d&&plan.floors[f0].grid[gx0+w*gz0]===0;
        let clear=true;for(const [dx,dz] of foot){const sx=Math.floor((x+dx-MX)/cv),sz=Math.floor((z+dz-MZ)/cv),onStair=stair||sx>=0&&sz>=0&&sx<w&&sz<d&&plan.floors[f0].grid[sx+w*sz]===0;
          for(let yy=y+step;yy<y+height;yy++){const m=at(x+dx,yy,z+dz);
          if(m&&!(onStair&&yy<y+step*2&&(m===b.M.stair_wood||m===b.M.plank))){clear=false;break;}}if(!clear)break;}
        if(!clear)continue;
        let f=0;while(f+1<plan.floors.length&&y>=b.levels[f+1])f++;
        const gx=Math.floor((x-MX)/cv),gz=Math.floor((z-MZ)/cv),k=gx<0||gz<0||gx>=w||gz>=d?-1:plan.floors[f].grid[gx+w*gz];
        const room=k>=0?key(f,k):null,n=nodes.length;nodes.push({col,ix,iz,y,room,point:[x*b.cell,y*b.cell,z*b.cell]});cols[col].push(n);
        if(!byRoom.has(room))byRoom.set(room,[]);byRoom.get(room).push(n);
      }
    }
    const edges=n=>{const a=nodes[n],out=[];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const ix=a.ix+dx,iz=a.iz+dz;if(ix<0||iz<0||ix>=nx||iz>=nz)continue;
      for(const j of cols[ix+nx*iz])if(Math.abs(nodes[j].y-a.y)<=step)out.push(j);}return out;};
    const nearest=(room,x,z,r)=>{const floor=room===null?0:Number(room.split(':')[0]),level=b.levels[floor];
      const all=(byRoom.get(room)||[]).filter(n=>Math.abs(nodes[n].y-level)<=step).map(n=>[n,Math.hypot(nodes[n].point[0]-x,nodes[n].point[2]-z)]).filter(([,d])=>d<=r).sort((a,b)=>a[1]-b[1]);return all.slice(0,4).map(([n])=>n);};
    const interaction=it=>{const faces=/^chair_/.test(it.piece)?['xp','xm','zp','zm']:[it.face];return [...new Set(faces.flatMap(face=>{const [dx,dz]=DIR[face];return nearest(key(it.floor,it.room),(it.x+it.w/2+dx*(it.w/2+radius+1))*b.cell,(it.z+it.d/2+dz*(it.d/2+radius+1))*b.cell,.75);}))];};
    const entry=e=>{const c=e.cells;return nearest(e.node,MX*b.cell+(c.reduce((s,a)=>s+a[0],0)/c.length+.5)*plan.cell,MZ*b.cell+(c.reduce((s,a)=>s+a[1],0)/c.length+.5)*plan.cell,.9);};
    const anchors=room=>{
      const [f,k]=room.split(':').map(Number),F=plan.floors[f],r=F.rooms[k];
      const essential=b.info.furniture.find(it=>it.floor===f&&it.room===k&&(ESSENTIALS[r.type]||[]).some(([,re])=>re.test(it.piece)));
      if(essential)return interaction(essential);
      const x=(MX+(r.box[0]+r.box[2]+1)*cv/2)*b.cell,z=(MZ+(r.box[1]+r.box[3]+1)*cv/2)*b.cell;
      return nearest(room,x,z,Infinity);
    };
    return {nodes,edges,anchors,nearest,entry,interaction};
  }

  function fingerprints(p){
    const layout={masks:p.plot.masks,floors:p.floors.map(F=>({grid:F.grid.map(k=>k<0?'outside':F.rooms[k].type),doors:F.doors.map(d=>[d.dir,d.cells]),openings:F.openings.map(o=>[o.kind,o.side,o.cells])})),stair:p.stair};
    const silhouette={masks:p.plot.masks,stair:{kind:p.stair.kind,tower:p.stair.tower},roof:{form:p.roof.form,ridge:p.roof.ridge,pitch:p.roof.pitch,eave:p.roof.eave,curve:p.roof.curve,cross:p.roof.cross,dormers:p.roof.dormers,turret:p.roof.turret},oriels:p.facade.oriels};
    const facade={frame:p.facade.frame,window:p.facade.window,groundWindow:p.facade.groundWindow,glazing:p.facade.glazing,bays:p.facade.bays,lattice:p.facade.lattice,shutters:p.facade.shutters,boxes:p.facade.boxes,canopy:p.facade.canopy};
    const family=[p.typology,p.floors.length,p.stair.kind,!!p.stair.tower,p.lotKind,p.roof.form,!!p.roof.cross,!!p.roof.turret].join('/');
    return {layout:JSON.stringify(layout),silhouette:JSON.stringify(silhouette),facade:JSON.stringify(facade),family,language:p.style};
  }
  function diversity(plans){
    const groups=name=>{const m=new Map();plans.forEach((p,i)=>{const f=fingerprints(p)[name];if(!m.has(f))m.set(f,[]);m.get(f).push({index:i,seed:p.seed});});return m;};
    const layouts=groups('layout'),silhouettes=groups('silhouette'),facades=groups('facade'),families=groups('family'),language=groups('language'),total=plans.length;
    return {total,distinctLayouts:layouts.size,distinctSilhouettes:silhouettes.size,distinctFacadeRhythms:facades.size,
      repeatedLayouts:[...layouts.values()].filter(g=>g.length>1),repeatedSilhouettes:[...silhouettes.values()].filter(g=>g.length>1),
      families:[...families].map(([family,members])=>({family,count:members.length,share:total?members.length/total:0})).sort((a,b)=>b.count-a.count),
      languages:[...language].map(([style,members])=>({style,count:members.length})),
      note:'Seeds, palette swaps and furniture choices do not count as architectural uniqueness. Exact structural fingerprints and coarse families diagnose repetition, not artistic quality.'};
  }
  const api={REVISION,BODY,PROGRAMMES,ESSENTIALS,review,navigation,openDoors,hallwayClearance,diversity,fingerprints};
  if(node)module.exports=api;else root.BuildingReview=api;
})(typeof globalThis==='object'?globalThis:this);
