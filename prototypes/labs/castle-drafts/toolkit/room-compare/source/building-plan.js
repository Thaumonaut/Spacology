(function(root){
  'use strict';
  // Building planner: plot -> circulation spine -> bands of rooms -> doors, windows and stairs. Pure and seeded.
  // The plan is a 0.5 m grid: x runs along the street frontage, z runs back from the street (z = 0 is the front row).
  // Every later stage (voxel shell, furniture, renderer) reads only this data, so it can be inspected and tested as a
  // flat drawing before anything turns 3D.
  //
  // Layout follows how real town houses are organised rather than growing rooms freely:
  // - A spine (the stair against a wall, with a 1 m hall beside it) runs from front to back through every floor.
  //   Narrow plots put it along one side wall; wide plots put it down the middle with rooms either side.
  // - Each floor is three bands from the street: front (shop, living room, common room), middle (the stair bay
  //   with baths, stores and small rooms beside it) and back (kitchen-diner, bedroom). A band holds one room across
  //   the whole width, or one room per row beside the spine.
  // - Every room opens off the hall, so nobody walks through a bedroom. On the ground floor of a mixed-use building
  //   the hall runs out to its own street door: the home above has its own entrance beside the shop.
  const CELL=0.5,STOREY=3.0,REVISION='building-plan-2';
  const DIRS=[[-1,0,'xm'],[1,0,'xp'],[0,-1,'zm'],[0,1,'zp']];

  // Room kinds. circ: circulation that may lead anywhere. leaf: never walked through to reach another room.
  // light: needs an outside window. minW: narrowest acceptable width (cells); minA: smallest sensible area (m2).
  const ROOMS={
    hall:{label:'Hall',circ:true,minW:2,light:false,minA:0},
    stair:{label:'Stair',minW:2,light:false,minA:0},
    living:{label:'Living room',minW:6,light:true,minA:11},
    common:{label:'Common room',circ:true,minW:8,light:true,minA:24},
    shop:{label:'Shop',minW:6,light:true,minA:10},
    workshop:{label:'Workshop',minW:6,light:true,minA:14},
    kitchen:{label:'Kitchen',minW:5,light:true,minA:9},
    dining:{label:'Dining room',minW:5,light:true,minA:8},
    store:{label:'Store',leaf:true,minW:2,light:false,minA:2},
    bath:{label:'Bath',leaf:true,minW:3,light:false,minA:3},
    bed:{label:'Bedroom',leaf:true,minW:5,light:true,minA:7},
    guest:{label:'Guest room',leaf:true,minW:5,light:true,minA:7},
    study:{label:'Study',leaf:true,minW:4,light:true,minA:5},
    office:{label:'Office',leaf:true,minW:4,light:true,minA:5}
  };
  // Doors that make sense between two rooms when neither is the hall: a kitchen-diner loop, a shop's back store.
  const WORK_LINKS=new Set(['kitchen|shop','kitchen|workshop','kitchen|store','shop|store','store|workshop','dining|kitchen','common|kitchen','kitchen|living']);
  const pairKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
  const canLink=(a,b)=>a!==b&&a!=='stair'&&b!=='stair'&&(ROOMS[a].circ||ROOMS[b].circ||WORK_LINKS.has(pairKey(a,b)));

  // Building types. Plot sizes in metres. Each floor is a recipe of bands; see recipe() for how rows adapt to the
  // layout (side spine: one row of rooms; centre spine: a row each side) and to which side walls can have windows.
  const TYPES={
    shophouse:{label:'Shop-house (home over shop)',frontage:[6,8],front:[3.5,5],back:[3.5,4.5],storeys:2,layout:'side'},
    home:{label:'Family home',frontage:[9.5,11.5],front:[3.5,4.5],back:[3.5,4.5],storeys:2,layout:'centre'},
    inn:{label:'Inn',frontage:[11.5,13.5],front:[5,6.5],back:[3.5,4.5],storeys:3,layout:'centre'},
    workshop:{label:'Workshop (home over workshop)',frontage:[7,9],front:[4.5,6],back:[3.5,4.5],storeys:2,layout:'side'}
  };
  // Band recipes per floor. A row list is one room per row beside the spine, front to back within the band.
  // lit[k] is true when row k has an outside (non-party) side wall, so a room there can have a window.
  function recipe(type,f,storeys,lit,r){
    const one=(a,b)=>lit=>lit?a:b; // a room that needs light where possible, else an unlit alternative
    const rows=(...specs)=>({rows:specs.map((s,k)=>(Array.isArray(s)?s:[s]).map(x=>typeof x==='function'?x(lit[k]):x))});
    if(type==='shophouse'){
      if(f===0)return {laneToStreet:true,front:rows('shop'),mid:rows(['store','bath']),back:{full:'kitchen'}};
      return {front:{full:'living'},mid:rows([one('study','store'),'bath']),back:{full:'bed'}};}
    if(type==='workshop'){
      if(f===0)return {laneToStreet:true,front:rows('workshop'),mid:rows([one('office','store'),'bath']),back:{full:'kitchen'}};
      return {front:{full:'living'},mid:rows([one('bed','store'),'bath']),back:{full:'bed'}};}
    if(type==='home'){
      const diner=r()<.5;
      if(f===0)return {laneToStreet:true,front:rows('living',diner?'study':'dining'),mid:rows(['store','bath'],[one(diner?'dining':'study','store'),'store']),back:diner?{full:'kitchen'}:rows('kitchen',one('dining','store'))};
      return {front:rows('bed','bed'),mid:rows(['bath','store'],[one('study','store'),'store']),back:rows('bed',one('bed','study'))};}
    if(type==='inn'){
      if(f===0)return {front:{full:'common'},mid:rows([one('office','store'),'store'],['bath','store']),back:{full:'kitchen'}};
      const top=f===storeys-1;
      return {front:rows('guest','guest'),mid:rows(['bath','store'],[one('guest','store')]),back:top&&r()<.5?rows('bed','guest'):rows('guest','guest')};}
    throw new Error('unknown type '+type);
  }
  // Street contexts: party walls are shared with neighbours, so they get no windows and no doors.
  const CONTEXTS={terrace:{label:'Terrace',party:[true,true]},corner:{label:'Corner plot',party:[true,false]},detached:{label:'Detached',party:[false,false]}};

  function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const pick=(r,list)=>list[Math.floor(r()*list.length)];
  const between=(r,[a,b])=>a+(b-a)*r();

  // --- Plot ---------------------------------------------------------------------------------------------------------
  // A rectangular footprint. Upper floors may jetty one row out over the street, so the grid keeps a spare front row
  // (z = 0) for them. The stair bay is 10 cells long: a 1 m landing, a 3 m flight (16 risers of 18.75 cm), a landing.
  const BAY=10;
  function makePlot(seed,opts={}){
    const r=rng(hash('plot:'+seed)),typeId=opts.type||pick(r,Object.keys(TYPES)),T=TYPES[typeId];
    const contextId=opts.context||pick(r,['terrace','terrace','corner','detached']),C=CONTEXTS[contextId];
    // Depth follows the bands: a front band, the stair bay and a back band, each a sensible room depth.
    const w=Math.round(between(r,T.frontage)/CELL),front=1,frontBand=Math.round(between(r,T.front)/CELL),backBand=Math.round(between(r,T.back)/CELL),d=front+frontBand+BAY+backBand,jetty=!!opts.jetty;
    const masks=[];for(let f=0;f<T.storeys;f++){const m=new Uint8Array(w*d);for(let z=0;z<d;z++)for(let x=0;x<w;x++)if(z>=front||(jetty&&f>0))m[x+w*z]=1;masks.push(m);}
    return {seed,type:typeId,context:contextId,party:C.party.slice(),w,d,front,frontBand,storeys:T.storeys,jetty,notch:null,masks,layout:T.layout};
  }

  // The spine: stair columns against a wall (side layout) or mid-plan (centre), and a 2-cell hall lane beside them.
  // Three or more storeys switch back: the second flight sits on the other side of the lane, running the other way.
  function makeSpine(plot,r){
    const {w,d,front,storeys}=plot,switchback=storeys>2,width=switchback?6:4;
    let x0;
    if(plot.layout==='side'){const left=plot.party[0]&&!plot.party[1]?true:plot.party[1]&&!plot.party[0]?false:r()<.5;x0=left?0:w-width;}
    else x0=Math.round((w-width)/2+(r()-.5)*2);
    // Stair cells A (and B for a switchback) and the lane, in x.
    const outerLeft=plot.layout==='side'?x0===0:r()<.5,stairA=outerLeft?x0:x0+width-2,lane=switchback?x0+2:outerLeft?x0+2:x0,stairB=switchback?(outerLeft?x0+4:x0):null;
    // Bands: the stair bay starts where the plot's front band ends.
    const zone0=front+plot.frontBand;
    const a=zone0+2,runs=[];
    for(let f=0;f<storeys-1;f++){const up=f%2===0;
      runs.push(up?{from:f,x:stairA,z:a,len:6,dir:1,bottom:a-1,top:a+6}:{from:f,x:stairB,z:a,len:6,dir:-1,bottom:a+6,top:a-1});}
    return {x0,width,stairA,stairB,lane,zone:[zone0,zone0+BAY],a,runs,switchback};
  }

  // --- Floor layout -------------------------------------------------------------------------------------------------
  function layoutFloor(plot,spine,f,r,variant){
    const {w,d,storeys}=plot,mask=plot.masks[f],z0=Math.min(...[...Array(d).keys()].filter(z=>mask[w*z])),[zs,ze]=spine.zone;
    const grid=new Int16Array(w*d).fill(-1),rooms=[{type:'stair'},{type:'hall'}],steps=[],voids=[];
    const inSpine=x=>x>=spine.x0&&x<spine.x0+spine.width;
    // Rows beside the spine, and which of them may have side windows.
    const rowsX=plot.layout==='side'?[spine.x0===0?[spine.width,w]:[0,w-spine.width]]:[[0,spine.x0],[spine.x0+spine.width,w]];
    const lit=rowsX.map(([a,b])=>(a===0&&!plot.party[0])||(b===w&&!plot.party[1]));
    const rec=recipe(plot.type,f,storeys,lit,r),laneToStreet=f===0&&!!rec.laneToStreet;
    // Start with the spine as hall, then add the stair cells for this floor.
    for(let z=z0;z<d;z++)for(let x=spine.x0;x<spine.x0+spine.width;x++)if(mask[x+w*z])grid[x+w*z]=1;
    spine.runs.forEach((run,k)=>{const cells=[];for(let z=run.z;z<run.z+6;z++)for(let x=run.x;x<run.x+2;x++)cells.push(x+w*z);
      if(run.from===f){for(const i of cells){grid[i]=0;steps.push(i);}}if(run.from===f-1){for(const i of cells){grid[i]=0;voids.push(i);}}void k;});
    const add=(type,x0,x1,za,zb)=>{const k=rooms.length;rooms.push({type});for(let z=za;z<zb;z++)for(let x=x0;x<x1;x++)if(mask[x+w*z])grid[x+w*z]=k;return k;};
    // Bands. A band spec is {full:type} (wall to wall) or {rows:[[types front->back] per row]}.
    const bands=[[rec.front,z0,zs,'front'],[rec.mid,zs,ze,'mid'],[rec.back,ze,d,'back']];
    for(const [band,za,zb,name] of bands){if(!band||zb<=za)continue;
      if(band.full){band.room=add(band.full,0,w,za,zb);// a full-width room still leaves the hall lane free where the spine must pass
        if(name==='front'&&laneToStreet)for(let z=za;z<zb;z++)for(let x=spine.x0;x<spine.x0+spine.width;x++)grid[x+w*z]=1;continue;}
      band.rows.forEach((list,row)=>{const [xa,xb]=rowsX[row]||rowsX[0];if(!list.length)return;
        // Split the band's length between the row's rooms, by weight, with jitter between candidates.
        const weight=t=>({bath:.75,store:.55,study:.9,office:.9,guest:1.1,bed:1.2,dining:1.1}[t]||1)*(1+(variant()-.5)*.5),ws=list.map(weight),sum=ws.reduce((a,b)=>a+b,0);
        let z=za;list.forEach((type,k)=>{const len=k===list.length-1?zb-z:Math.max(2,Math.round((zb-za)*ws[k]/sum));add(type,xa,xb,z,Math.min(zb,z+len));z+=len;});});}
    void inSpine;
    return {grid,rooms,steps,voids,laneToStreet,rowsX,lit};
  }

  // Shared walls between rooms, as runs of cell edges: {a, b, cells:[[x,z]...] on a's side, dir toward b}.
  function sharedRuns(plot,grid){
    const {w,d}=plot,runs=new Map();
    for(let z=0;z<d;z++)for(let x=0;x<w;x++){const a=grid[x+w*z];if(a<0)continue;
      for(const [dx,dz,s] of [[1,0,'xp'],[0,1,'zp']]){const nx=x+dx,nz=z+dz;if(nx>=w||nz>=d)continue;const b=grid[nx+w*nz];if(b<0||b===a)continue;
        const key=`${a}-${b}-${s}-${s==='xp'?x:z}`;if(!runs.has(key))runs.set(key,{a,b,dir:s,cells:[]});runs.get(key).cells.push([x,z]);}}
    const out=[];for(const r of runs.values()){r.cells.sort((p,q)=>p[0]-q[0]||p[1]-q[1]);let cur=null;
      for(const c of r.cells){if(cur&&Math.abs(c[0]-cur.cells.at(-1)[0])+Math.abs(c[1]-cur.cells.at(-1)[1])===1)cur.cells.push(c);else{cur={a:r.a,b:r.b,dir:r.dir,cells:[c]};out.push(cur);}}}
    return out;
  }

  // Doors grow outwards from the entrance (or the hall upstairs), cheapest first, so rooms open onto the hall.
  // Leaf rooms are reached but never walked through. The stair opens onto the hall at the foot of each flight
  // and at the head of the flight arriving from below.
  function placeDoors(plot,f,lay,spine){
    const {grid,rooms}=lay,{w}=plot,runs=sharedRuns(plot,grid).filter(r=>r.cells.length>=2&&rooms[r.a].type!=='stair'&&rooms[r.b].type!=='stair');
    const links=runs.filter(r=>canLink(rooms[r.a].type,rooms[r.b].type)),cost=r=>{const A=rooms[r.a].type,B=rooms[r.b].type;return (A==='hall'||B==='hall'?0:ROOMS[A].circ||ROOMS[B].circ?1:2)+(r.cells.length<3?.5:0);};
    const start=f===0&&!lay.laneToStreet?entranceRoom(rooms):1,reached=new Set([start]),doors=[];
    while(true){let best=null;
      for(const l of links){const ina=reached.has(l.a),inb=reached.has(l.b);if(ina===inb)continue;const from=ina?l.a:l.b;
        if(ROOMS[rooms[from].type].leaf)continue;const c=cost(l);if(!best||c<best.c)best={l,c};}
      if(!best)break;reached.add(best.l.a);reached.add(best.l.b);doors.push(doorOn(best.l,rooms));}
    for(const l of links){if(!['dining|kitchen','kitchen|living','common|kitchen'].includes(pairKey(rooms[l.a].type,rooms[l.b].type)))continue;
      if(doors.some(dr=>(dr.a===l.a&&dr.b===l.b)||(dr.a===l.b&&dr.b===l.a)))continue;doors.push(doorOn(l,rooms));}
    // Stair openings: hall side of the flight's foot (this floor) and of the arriving flight's head (from below).
    for(const run of spine.runs){
      const foot=run.from===f?run.bottom:run.from===f-1?run.top:null;if(foot===null)continue;
      const cells=[[run.x,foot],[run.x+1,foot]];if(cells.some(([x,z])=>grid[x+w*z]!==1))continue;
      doors.push({a:1,b:0,dir:foot<run.z?'zp':'zm',cells,kind:'open'});reached.add(0);}
    return {doors,reached};
  }
  function entranceRoom(rooms){for(const t of ['common','shop','workshop','living','hall']){const k=rooms.findIndex(r=>r.type===t);if(k>=0)return k;}return 1;}
  // A door is 2 cells (1 m) wide, one cell in from a corner where the wall allows, else centred.
  function doorOn(run,rooms){const n=run.cells.length,hallSide=rooms[run.a].type==='hall'||rooms[run.b].type==='hall';
    const start=n<=3?Math.floor((n-2)/2):hallSide?1:n-3;return {a:run.a,b:run.b,dir:run.dir,cells:run.cells.slice(start,start+2),kind:'door'};}

  // Exterior openings: the front door on the street (the hall's own door on mixed-use buildings, plus the shop's),
  // a back door from the kitchen, and windows spaced along each room's outside walls (none on party walls).
  function runsOf(cells){const out=[];for(const c of cells){const cur=out.at(-1);if(cur&&Math.abs(c[0]-cur.at(-1)[0])+Math.abs(c[1]-cur.at(-1)[1])===1)cur.push(c);else out.push([c]);}return out;}
  function exteriorSides(plot,mask,x,z){
    const out=[];for(const [dx,dz,s] of DIRS){const nx=x+dx,nz=z+dz,inside=nx>=0&&nz>=0&&nx<plot.w&&nz<plot.d&&mask[nx+plot.w*nz];
      if(inside)continue;const party=(s==='xm'&&nx<0&&plot.party[0])||(s==='xp'&&nx>=plot.w&&plot.party[1]);out.push({side:s,party});}
    return out;
  }
  function placeOpenings(plot,f,lay){
    const {grid,rooms}=lay,{w,d}=plot,mask=plot.masks[f],edges=new Map();
    for(let z=0;z<d;z++)for(let x=0;x<w;x++){const g=grid[x+w*z];if(g<1)continue;
      for(const e of exteriorSides(plot,mask,x,z)){if(e.party)continue;const key=`${g}-${e.side}-${e.side[0]==='x'?x:z}`;if(!edges.has(key))edges.set(key,{room:g,side:e.side,cells:[]});edges.get(key).cells.push([x,z]);}}
    const lines=[];for(const e of edges.values()){e.cells.sort((p,q)=>p[0]-q[0]||p[1]-q[1]);for(const run of runsOf(e.cells))lines.push({room:e.room,side:e.side,cells:run});}
    const openings=[],street='zm',taken=new Set(),take=o=>{openings.push(o);for(const c of o.cells)taken.add(o.side+c.join(','));};
    if(f===0){
      const front=k=>lines.filter(l=>l.room===k&&l.side===street).sort((a,b)=>b.cells.length-a.cells.length)[0];
      if(lay.laneToStreet){const h=front(1);if(h){const s=Math.max(0,Math.floor((h.cells.length-2)/2));take({room:1,side:street,cells:h.cells.slice(s,s+2),kind:'front'});}}
      const biz=rooms.findIndex(r=>['shop','workshop','common'].includes(r.type)),k=biz>=0?biz:lay.laneToStreet?-1:entranceRoom(rooms),l=k>=0?front(k):null;
      if(l){// the business door sits at the end nearest the hall, so the rest of its frontage is shopfront
        const n=l.cells.length,nearHall=Math.abs(l.cells[0][0]-plot.w/2)>Math.abs(l.cells[n-1][0]-plot.w/2)?n-2:0,s=rooms[k].type==='common'?Math.floor((n-2)/2):nearHall;
        take({room:k,side:street,cells:l.cells.slice(s,s+2),kind:'front'});}
      const kit=rooms.findIndex(r=>r.type==='kitchen'),back=lines.filter(l=>l.room===kit&&l.side==='zp'&&l.cells.length>=3)[0]||lines.filter(l=>l.room===kit&&l.side!==street&&l.cells.length>=3)[0];
      if(kit>=0&&back){const n=back.cells.length,s=n>=6?n-3:Math.floor((n-2)/2);take({room:kit,side:back.side,cells:back.cells.slice(s,s+2),kind:'back'});}}
    for(const l of lines){const type=rooms[l.room].type;if(type==='hall'&&l.cells.length<3)continue;
      const free=l.cells.filter(c=>!taken.has(l.side+c.join(',')));
      if(f===0&&l.side===street&&['shop','workshop','common'].includes(type)){for(const run of runsOf(free))if(run.length>=2)take({room:l.room,side:l.side,cells:run.slice(0,run.length-(run.length>5?1:0)),kind:type==='common'?'bay':'shopfront'});continue;}
      const small=type==='bath'||type==='store'||type==='hall',wide=small?1:2,every=small?99:5;let here=openings.some(o=>o.room===l.room&&o.kind!=='front'&&o.kind!=='back');
      for(const run of runsOf(free).sort((a,b)=>b.length-a.length)){const n=run.length;if(n<wide+(here?1:0)||(small&&here))continue;
        const count=Math.max(1,Math.floor((n-1)/every));
        for(let k=0;k<count;k++){const s=Math.max(0,Math.min(n-wide,Math.round((n-wide)*(k+.5)/count)));here=true;
          take({room:l.room,side:l.side,cells:run.slice(s,s+wide),kind:small?'small':l.side===street&&f>0&&type==='living'&&k===0?'balcony':'window'});}}}
    return openings;
  }

  // Score: lower is better. Hard failures (unreachable or windowless rooms) are listed in notes and dominate.
  function scoreFloor(plot,f,lay,reached,openings){
    const {rooms,grid}=lay,{w}=plot,notes=[];let s=0;
    rooms.forEach((room,k)=>{let x0=1e9,z0=1e9,x1=-1,z1=-1,n=0;for(let i=0;i<grid.length;i++)if(grid[i]===k){const x=i%w,z=Math.floor(i/w);n++;x0=Math.min(x0,x);z0=Math.min(z0,z);x1=Math.max(x1,x);z1=Math.max(z1,z);}
      room.cells=n;room.box=n?[x0,z0,x1,z1]:null;if(k<2||!n)return;const R=ROOMS[room.type],bw=x1-x0+1,bd=z1-z0+1,a=n*CELL*CELL,minW=Math.min(bw,bd);
      if(minW<R.minW)s+=(R.minW-minW)*15;if(a<R.minA)s+=(R.minA-a)*6;const asp=Math.max(bw,bd)/minW;if(asp>2.4)s+=(asp-2.4)*12;
      if(n<bw*bd)s+=(1-n/(bw*bd))*20;
      if(!reached.has(k)){s+=500;notes.push(room.type+' unreachable');}
      if(R.light&&!openings.some(o=>o.room===k&&o.kind!=='front'&&o.kind!=='back')){s+=200;notes.push(room.type+' windowless');}});
    return {score:s,notes};
  }

  function planFloor(plot,spine,f,seed,candidates){
    let best=null;
    for(let c=0;c<candidates;c++){const r=rng(hash(`recipe:${seed}:${f}`)),variant=rng(hash(`cand:${seed}:${f}:${c}`));
      const lay=layoutFloor(plot,spine,f,r,variant),{doors,reached}=placeDoors(plot,f,lay,spine),openings=placeOpenings(plot,f,lay),sc=scoreFloor(plot,f,lay,reached,openings);
      if(!best||sc.score<best.score)best={...sc,lay,doors,openings,candidate:c};}
    const {lay}=best;
    return {level:f,grid:Array.from(lay.grid),rooms:lay.rooms.map((room,k)=>({id:k,type:room.type,label:ROOMS[room.type].label,area:+(room.cells*CELL*CELL).toFixed(2),box:room.box,cells:room.cells})),
      doors:best.doors,openings:best.openings,voids:lay.voids,steps:lay.steps,score:+best.score.toFixed(2),notes:best.notes,candidate:best.candidate};
  }

  // Styles: everything visual the voxel stage needs. A type plus a style is a building; districts choose the style.
  const STYLES={
    machiya:{label:'Lantern-street machiya',roof:'gable',ridge:'frontage',pitch:.45,eave:3,curve:.35,wall:'plaster_warm',timber:'timber_dark',base:'stone_grey',roofMat:'tile_charcoal',trim:'timber_dark',lattice:true,noren:'cloth_indigo',jettyOk:false},
    harbour:{label:'Harbour white & blue',roof:'hip',ridge:'depth',pitch:.5,eave:2,curve:.2,wall:'plaster_white',timber:'timber_honey',base:'stone_sand',roofMat:'tile_blue',trim:'paint_white',lattice:false,noren:'cloth_coral',jettyOk:true},
    fairytale:{label:'Storybook half-timber',roof:'gable',ridge:'depth',pitch:1.05,eave:2,curve:0,wall:'plaster_cream',timber:'timber_brown',base:'stone_grey',roofMat:'tile_red',trim:'timber_brown',lattice:false,halfTimber:true,noren:'cloth_green',jettyOk:true},
    spire:{label:'Sky-temple lacquer',roof:'hip',ridge:'frontage',pitch:.7,eave:4,curve:.6,wall:'plaster_peach',timber:'lacquer_red',base:'stone_sand',roofMat:'tile_teal',trim:'lacquer_red',lattice:true,noren:'cloth_gold',jettyOk:false}
  };

  function generate(seed,opts={}){
    seed=Number(seed)>>>0;const r=rng(hash('building:'+seed)),styleId=opts.style||pick(r,Object.keys(STYLES)),style=STYLES[styleId];
    const plot=makePlot(seed,{...opts,jetty:opts.jetty??(style.jettyOk&&r()<.6)}),spine=makeSpine(plot,rng(hash('spine:'+seed)));
    const floors=[];for(let f=0;f<plot.storeys;f++)floors.push(planFloor(plot,spine,f,seed,opts.candidates||24));
    return {revision:REVISION,seed,type:plot.type,typeLabel:TYPES[plot.type].label,style:styleId,styleLabel:style.label,context:plot.context,layout:plot.layout,cell:CELL,storey:STOREY,
      plot:{w:plot.w,d:plot.d,front:plot.front,jetty:plot.jetty,party:plot.party,notch:null,masks:plot.masks.map(m=>Array.from(m))},
      stair:{x:spine.stairA,z:spine.a,width:spine.width,lane:spine.lane,zone:spine.zone,runs:spine.runs},floors,score:+floors.reduce((a,f)=>a+f.score,0).toFixed(2)};
  }

  // Text drawing of one floor, for tests and quick inspection: one character per cell plus one per wall line.
  // Letters are rooms (see GLYPH), '.' the stair void, '^' the flight, '/' a door, ' ' an opening, '=' a window,
  // 'D' an outside door.
  const GLYPH={hall:'h',stair:'^',living:'L',common:'C',shop:'$',workshop:'W',kitchen:'K',dining:'D',store:'s',bath:'b',bed:'B',guest:'G',study:'y',office:'o'};
  function ascii(plan,f){
    const {w,d}=plan.plot,F=plan.floors[f],g=F.grid,voids=new Set(F.voids),X=2*w+1,Z=2*d+1,c=Array.from({length:Z},()=>new Array(X).fill(' '));
    const room=(x,z)=>x<0||z<0||x>=w||z>=d?-1:g[x+w*z];
    for(let z=0;z<d;z++)for(let x=0;x<w;x++){const k=room(x,z);if(k<0)continue;c[2*z+1][2*x+1]=voids.has(x+w*z)?'.':GLYPH[F.rooms[k].type]||'?';}
    for(let z=0;z<=d;z++)for(let x=0;x<w;x++)if(room(x,z-1)!==room(x,z))c[2*z][2*x+1]='-';
    for(let z=0;z<d;z++)for(let x=0;x<=w;x++)if(room(x-1,z)!==room(x,z))c[2*z+1][2*x]='|';
    for(let z=0;z<=d;z++)for(let x=0;x<=w;x++){const n=[c[2*z][2*x-1],c[2*z][2*x+1]].includes('-'),v=[c[2*z-1]?.[2*x],c[2*z+1]?.[2*x]].includes('|');if(n||v)c[2*z][2*x]=n&&v?'+':n?'-':'|';}
    const mark=(x,z,side,ch)=>{if(side==='xp')c[2*z+1][2*x+2]=ch;else if(side==='xm')c[2*z+1][2*x]=ch;else if(side==='zp')c[2*z+2][2*x+1]=ch;else c[2*z][2*x+1]=ch;};
    for(const dr of F.doors)for(const [x,z] of dr.cells)mark(x,z,dr.dir,dr.kind==='open'?' ':'/');
    for(const o of F.openings)for(const [x,z] of o.cells)mark(x,z,o.side,o.kind==='front'||o.kind==='back'?'D':'=');
    return c.map(r=>r.join('').trimEnd()).filter((r,k)=>k>0||r.trim()).join('\n');
  }

  const api={CELL,STOREY,REVISION,ROOMS,TYPES,STYLES,CONTEXTS,BAY,hash,rng,makePlot,makeSpine,generate,ascii,canLink,sharedRuns};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.BuildingPlan=api;
})(typeof globalThis==='object'?globalThis:this);
