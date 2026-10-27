(function(root){
  'use strict';
  // Building planner: plot -> house typology -> floors of rooms -> doors, windows and stairs. Pure and seeded.
  // The plan is a 0.5 m grid: x runs along the street frontage, z runs back from the street (z = 0 is the front row,
  // kept spare for upper floors that jetty over the street). Every later stage (voxel shell, furniture, renderer)
  // reads only this data, so it can be inspected and tested as a flat drawing before anything turns 3D.
  //
  // Real houses are not grown room by room; they follow a handful of plans that put circulation first. Each
  // typology below is one such plan. All of them keep the same rules: rooms are rectangles (circulation rooms such as
  // a hall, living room or common room may bend), every room opens off circulation, leaf rooms (bedrooms, baths,
  // studies) are never walked through, and the stair stacks through every floor and opens onto circulation.
  //   side       a passage along one side wall, straight stair in it, rooms in a row beside it (narrow plots)
  //   wing       the side passage, ending in a rear wing on an L-shaped footprint with a yard beside it
  //   centre     a short hall in the middle around a straight stair, rooms either side and full-width rooms behind
  //   stairhall  a broad entrance hall leading to a U-turn stair at the back, rooms either side
  //   cross      a passage across the house; rooms sit side by side along the street front and the back,
  //              with a U-turn stair off the passage (a side-street door on corner plots)
  //   cottage    no ground-floor hall: the front door opens into the living room, which holds the stair
  //   courtyard  a U around a courtyard: galleries along the outer walls, rooms looking onto the courtyard,
  //              and a stair tower in the courtyard corner
  const CELL=0.5,STOREY=3.0,REVISION='building-plan-6',HALL=4,DOOR=3;
  const DIRS=[[-1,0,'xm'],[1,0,'xp'],[0,-1,'zm'],[0,1,'zp']],OPP={xm:'xp',xp:'xm',zm:'zp',zp:'zm'};

  const ARCHITECTURE={
    hallway:{clear:1.2,cells:HALL},door:{cells:DOOR},roof:{maxWallRatio:.65},shop:{rearDoorStart:.6,minFloorShare:.3},
    preferredAspect:1.7,
    rareAspect:2.6,
    bath:{preferred:[5.25,10.5],large:10.5},
    depthRatio:{home:1.4,shophouse:1.85,workshop:1.75,inn:1.5},
    storage:{domestic:{minW:3,minA:3,maxA:6.25,preferred:4},undercroft:{minW:4,minA:6,maxA:24,preferred:12},commercial:{minA:4,maxA:36,preferred:12}},
    dining:{preferred:20,throughMin:16,maxKitchenSteps:2,maxKitchenDistance:8},
    bedroomDoors:['hall','bath','closet'],
    throughRooms:['hall','living','common','dining','kitchen','store'],
    serviceRooms:['shop','workshop','store','kitchen'],
    mixedUse:['shophouse','workshop']
  };

  // Room kinds. circ: circulation that may lead anywhere. leaf: never walked through to reach another room.
  // light: needs an outside window. minW: narrowest acceptable width (cells); minA: smallest sensible area (m2).
  const ROOMS={
    hall:{label:'Hall',circ:true,minW:HALL,light:false,minA:0},
    stair:{label:'Stair',minW:HALL,light:false,minA:0},
    living:{label:'Living room',circ:true,minW:6,light:true,minA:11,maxA:36},
    common:{label:'Common room',circ:true,minW:8,light:true,minA:24,maxA:100},
    shop:{label:'Shop',minW:5,light:true,minA:10,maxA:100},
    workshop:{label:'Workshop',minW:6,light:true,minA:14,maxA:100},
    kitchen:{label:'Kitchen',circ:true,minW:5,light:true,minA:9,maxA:24},
    dining:{label:'Dining room',circ:true,minW:8,light:true,minA:16,maxA:30},
    store:{label:'Store',circ:true,minW:HALL,light:false,minA:2,maxA:6},
    bath:{label:'Bath',leaf:true,minW:5,light:false,minA:5.25,maxA:10.5},
    bed:{label:'Bedroom',leaf:true,minW:5,light:true,minA:9,maxA:24},
    guest:{label:'Guest room',leaf:true,minW:5,light:true,minA:7,maxA:24},
    study:{label:'Study',leaf:true,minW:6,light:true,minA:9,maxA:16},
    office:{label:'Office',leaf:true,minW:4,light:true,minA:5,maxA:16}
  };
  function roomBudget(type,f,room){
    const R=ROOMS[room.type];
    return room.type==='store'?{...R,...ARCHITECTURE.storage[room.bulkStorage?'undercroft':room.commercial||roomZone(type,f,room)==='service'?'commercial':'domestic']}:R;
  }
  function throughRoom(room){return !!ROOMS[room.type].circ&&!(room.type==='store'&&!room.commercial&&!room.bulkStorage&&room.zone!=='service')&&(room.type!=='dining'||(room.area??room.cells*CELL*CELL)>=ARCHITECTURE.dining.throughMin);}
  function roomPath(F,doors,start,goal,forbidden=[],maxSteps=Infinity){
    if(forbidden.includes(F.rooms[start].type))return null;
    const q=[[start]],seen=new Set([start]);
    for(let i=0;i<q.length;i++){const route=q[i],a=route.at(-1);if(goal(F.rooms[a],a))return route;if(route.length>maxSteps)continue;
      if(a!==start&&(!throughRoom(F.rooms[a])||forbidden.includes(F.rooms[a].type)))continue;
      for(const dr of doors){const b=dr.a===a?dr.b:dr.b===a?dr.a:-1;if(b<0||seen.has(b)||forbidden.includes(F.rooms[b].type))continue;seen.add(b);q.push([...route,b]);}}
    return null;
  }
  function diningKitchenRoute(F,doors,id){
    const route=roomPath(F,doors,id,r=>r.type==='kitchen',['store','bed','guest','bath','study','office','stair'],ARCHITECTURE.dining.maxKitchenSteps);
    if(!route)return null;
    const centre=r=>[(r.box[0]+r.box[2]+1)*CELL/2,(r.box[1]+r.box[3]+1)*CELL/2],points=[centre(F.rooms[id])];
    for(let i=1;i<route.length;i++){const dr=doors.find(d=>d.a===route[i-1]&&d.b===route[i]||d.b===route[i-1]&&d.a===route[i]);points.push([dr.cells.reduce((s,c)=>s+c[0]+.5,0)/dr.cells.length*CELL,dr.cells.reduce((s,c)=>s+c[1]+.5,0)/dr.cells.length*CELL]);}
    points.push(centre(F.rooms[route.at(-1)]));const distance=points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
    return distance<=ARCHITECTURE.dining.maxKitchenDistance?{rooms:route,distance}:null;
  }
  // Doors that make sense between two rooms when neither is circulation: a kitchen-diner, a shop's back store.
  const WORK_LINKS=new Set(['kitchen|shop','kitchen|workshop','kitchen|store','shop|store','shop|workshop','store|workshop','dining|kitchen','common|kitchen','kitchen|living','office|shop','office|workshop']);
  const pairKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
  const isBedroom=t=>t==='bed'||t==='guest';
  const canLink=(a,b)=>a!=='stair'&&b!=='stair'&&pairKey(a,b)!=='store|study'&&
    (!isBedroom(a)||ARCHITECTURE.bedroomDoors.includes(b))&&(!isBedroom(b)||ARCHITECTURE.bedroomDoors.includes(a))&&
    (a!==b||ARCHITECTURE.throughRooms.includes(a))&&
    (ROOMS[a].circ||ROOMS[b].circ||WORK_LINKS.has(pairKey(a,b))||isBedroom(a)&&b==='bath'||isBedroom(b)&&a==='bath');

  function roomZone(type,f,room){
    if(room.domestic)return 'resident';
    if(['shop','common'].includes(room.type)||type==='inn'&&f===0&&room.type==='dining')return 'public';
    if(room.type==='workshop'||(ARCHITECTURE.mixedUse.includes(type)&&room.type==='store'&&(room.extension||room.commercial))||(type==='inn'&&f===0&&['kitchen','office','store'].includes(room.type)))return 'service';
    return 'resident';
  }
  function doorRoles(a,b){
    if(a.zone==='resident'||b.zone==='resident')return ['resident'];
    return a.zone==='service'||b.zone==='service'?['employee']:['customer','employee'];
  }

  // Building types: frontage (metres), storeys and how likely each typology is. Typologies too narrow for the plot,
  // or with a straight stair on a 3-storey building, are skipped.
  const TYPES={
    shophouse:{label:'Shop-house (home over shop)',frontage:[6,9],storeys:[2,3],tall:.2,typologies:{side:3,wing:2.5,cross:.8}},
    workshop:{label:'Workshop (home over workshop)',frontage:[7,10],storeys:[2,3],tall:.15,typologies:{side:2,wing:2,cross:.8}},
    home:{label:'Family home',frontage:[7.5,12],storeys:[2,3],tall:.2,typologies:{centre:2,stairhall:2,cross:.8,cottage:1.5,side:1,wing:1.5,courtyard:1,tower:1,undercroft:1}},
    inn:{label:'Inn',frontage:[11,14],storeys:[3,3],typologies:{stairhall:2.5,cross:.9,courtyard:2.2}}
  };
  const TYPOLOGIES={
    side:{label:'Side passage',minW:16,straight:true},wing:{label:'Side passage + rear wing',minW:20,straight:true},
    centre:{label:'Central hall',minW:20,straight:true},stairhall:{label:'Stair hall',minW:22},
    cross:{label:'Cross passage',minW:16},cottage:{label:'Cottage, open plan',minW:16},courtyard:{label:'Courtyard',minW:32},
    tower:{label:'Front tower',minW:20},undercroft:{label:'Undercroft, home above storage',minW:20},
    rowhouse:{label:'Narrow city row house',minW:14,parcelOnly:true}
  };
  // Street contexts: party walls are shared with neighbours, so they get no windows and no doors.
  const CONTEXTS={terrace:{label:'Terrace',party:[true,true]},corner:{label:'Corner plot',party:[true,false]},detached:{label:'Detached',party:[false,false]}};

  // Room programs: what goes where, per type and floor. '?' marks a room that is dropped when it does not fit.
  function program(type,f,top,r){
    if(f===0){
      // the shop is the store: the ground floor is shop, then a small living area behind (kitchen, bath)
      if(type==='shophouse')return {front:['shop'],support:['bath'],back:['kitchen']};
      if(type==='workshop')return {front:['workshop'],support:['bath?'],back:['kitchen']};
      if(type==='inn')return {front:['common'],support:['office','store','bath?'],back:['kitchen','store?']};
      const a=r()<.15;return {front:a?['living','study?']:['living'],support:['bath','store?'],back:['kitchen','dining']};}
    if(type==='inn')return {front:['guest','guest','guest?'],support:['bath','store?'],back:['guest',f===top?'bed':'guest','guest?']};
    if(type==='home'||f>1)return {front:['bed','bed?'],support:['bath','store?'],back:['bed',r()<.15?'study?':'bed?']};
    return {front:['living','bed?'],support:['bath','store?'],back:['bed',r()<.15?'study?':'bed?']};
  }

  function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const pick=(r,list)=>list[Math.floor(r()*list.length)];
  const between=(r,[a,b])=>a+(b-a)*r();
  const ri=(r,a,b)=>a+Math.floor(r()*(b-a+1));
  const weighted=(r,table)=>{const e=Object.entries(table).filter(([,w])=>w>0),sum=e.reduce((a,[,w])=>a+w,0);let t=r()*sum;for(const [k,w] of e){t-=w;if(t<=0)return k;}return e.at(-1)[0];};

  // --- Splitting a strip of rooms -----------------------------------------------------------------------------------
  const MINLEN={bath:5,store:HALL,study:6,office:5,bed:6,guest:6,kitchen:HALL+2,dining:7,living:7,shop:7,workshop:8,common:10,hall:HALL};
  const WEIGHT={bath:.85,store:.3,study:1,office:.85,bed:1.1,guest:1,kitchen:1.15,dining:1.4,living:1.3,shop:1.4,workshop:1.5,common:2};
  const bare=t=>t.replace('?','');
  // Drop optional rooms (then required ones from the end) until the minimum lengths fit.
  function fitList(list,len,lastMin=0,minimum=t=>MINLEN[t]){const L=list.slice(),need=()=>L.reduce((a,t,k)=>a+Math.max(minimum(bare(t)),k===L.length-1?lastMin:0),0);
    while(L.length>1&&need()>len){const i=L.map(t=>t.endsWith('?')).lastIndexOf(true);L.splice(i>=0?i:L.length-1,1);}return L.map(bare);}
  // Lengths along a strip, by weight with a little jitter, each at least its minimum (the last at least lastMin).
  function splitLen(types,len,v,lastMin=0,minimum=t=>MINLEN[t]){const mins=types.map((t,k)=>Math.max(minimum(t),k===types.length-1?lastMin:0)),ws=types.map(t=>WEIGHT[t]*(.8+.4*v())),sum=ws.reduce((a,b)=>a+b,0);
    const out=ws.map((w,k)=>Math.max(mins[k],Math.round(len*w/sum)));let total=out.reduce((a,b)=>a+b,0);
    while(total>len){let k=-1;for(let i=0;i<out.length;i++)if(out[i]>mins[i]&&(k<0||out[i]-mins[i]>out[k]-mins[k]))k=i;if(k<0)break;out[k]--;total--;}
    while(total<len){let k=0;for(let i=1;i<out.length;i++)if(ws[i]>ws[k])k=i;out[k]++;total++;}
    // Never spill past the strip: if the minimums cannot all fit, shrink the longest rooms below them.
    while(total>len){let k=0;for(let i=1;i<out.length;i++)if(out[i]>out[k])k=i;if(out[k]<=1)break;out[k]--;total--;}
    return out;}

  // --- A floor under construction -----------------------------------------------------------------------------------
  function Floor(plot,f){const {w,d}=plot,mask=plot.masks[f],grid=new Int16Array(w*d).fill(-1),rooms=[{type:'stair'},{type:'hall'}];
    const F={f,grid,rooms,steps:[],voids:[],open:[],
      room(type){rooms.push({type});return rooms.length-1;},
      fill(x0,z0,x1,z1,k){for(let z=Math.max(0,z0);z<Math.min(d,z1);z++)for(let x=Math.max(0,x0);x<Math.min(w,x1);x++)if(mask[x+w*z])grid[x+w*z]=k;},
      // Rooms side by side along an axis inside a rectangle; returns the room indices in order.
      // Rooms that need light go to the slots that can have a window; a dark slot gets a store or bath instead
      // (as in the middle of a terraced house). The split is redone once with the settled order.
      zone(x0,z0,x1,z1,axis,list,v,lastMin=0){const len=axis==='x'?x1-x0:z1-z0,span=axis==='x'?z1-z0:x1-x0;if(len<=0||span<=0)return [];
        const minimum=t=>{const R=roomBudget(plot.type,f,{type:t});return Math.max(MINLEN[t],R.minW,Math.ceil(R.minA/(span*CELL*CELL)));};
        let types=fitList(list,len,lastMin,minimum);if(!types.length)return [];
        const rects=(ts)=>{const lens=splitLen(ts,len,v,lastMin,minimum);let p=axis==='x'?x0:z0;return lens.map(l=>{const r=axis==='x'?[p,z0,p+l,z1]:[x0,p,x1,p+l];p+=l;return r;});};
        const lit=([a,b,c,e])=>{for(let z=b;z<e;z++)for(let x=a;x<c;x++){if(!(z===b||z===e-1||x===a||x===c-1))continue;if(x<0||z<0||x>=w||z>=d||!mask[x+w*z])continue;if(exteriorSides(plot,mask,x,z).some(s=>!s.party))return true;}return false;};
        for(let pass=0;pass<2;pass++){const rs=rects(types),flags=rs.map(lit),need=types.filter(t=>ROOMS[t].light),dark=types.filter(t=>!ROOMS[t].light),out=[];
          for(let i=0;i<types.length;i++){if(flags[i]&&need.length)out.push(need.shift());else if(!flags[i]&&dark.length)out.push(dark.shift());else if(need.length){const t=need.shift();out.push(flags[i]?t:(out.includes('bath')||types.includes('bath')||rs[i][2]-rs[i][0]+rs[i][3]-rs[i][1]>16?'store':'bath'));}else out.push(dark.shift());}
          types=out;}
        const rs=rects(types);return types.map((t,k)=>{const k2=F.room(t),[a,b,c,e]=rs[k];F.fill(a,b,c,e,k2);return k2;});}};
    return F;}
  // Mask helpers.
  const blankMasks=(plot)=>Array.from({length:plot.storeys},()=>new Uint8Array(plot.w*plot.d));
  const maskRect=(plot,m,x0,z0,x1,z1)=>{for(let z=Math.max(0,z0);z<Math.min(plot.d,z1);z++)for(let x=Math.max(0,x0);x<Math.min(plot.w,x1);x++)m[x+plot.w*z]=1;};

  // --- Stairs -------------------------------------------------------------------------------------------------------
  // Each stair kind is a spec in local cells: u across, v along the climb, entered from v = -1. Flights are
  // [u0,u1,v0,v1,dir,risers,start] (16 risers of 18.75 cm per storey), landings [u0,u1,v0,v1,rise], plus where you
  // arrive on the floor above. 'stacks' kinds arrive on the same edge they are entered from, so the next storey's
  // stair starts beside the arrival and they climb any number of floors; the others are for two storeys.
  //   straight         one 2x6 flight
  //   straightLanding  two 3-cell flights with a 1 m landing between (2x8)
  //   dogleg           U-turn: up one lane, a half landing, back down the other (4x5)
  //   u3               C-shaped: three flights round two corner landings and an open well (6x5)
  //   spiral           one full turn per storey, with a shared doorway-facing landing
  //   L                right angle: a flight, a corner landing, a flight across; arrives on its side (5x5)
  // Any kind can stand in an exterior tower (a bump-out): a 2-cell landing strip along the house wall, open to the
  // hall, with the stair behind it; the L adds a strip down its side so its arrival also lands on the hall.
  const STAIRS={
    straight:{U:4,V:6,flights:[[0,4,0,6,'+v',16,0]],landings:[],entry:[[0,-1],[1,-1],[2,-1],[3,-1]],arrive:[[0,6],[1,6],[2,6],[3,6]],arriveDir:'-v',stacks:false},
    straightLanding:{U:4,V:10,flights:[[0,4,0,3,'+v',8,0],[0,4,7,10,'+v',8,8]],landings:[[0,4,3,7,8]],entry:[[0,-1],[1,-1],[2,-1],[3,-1]],arrive:[[0,10],[1,10],[2,10],[3,10]],arriveDir:'-v',stacks:false},
    dogleg:{U:8,V:7,flights:[[0,4,0,3,'+v',8,0],[4,8,0,3,'-v',8,8]],landings:[[0,8,3,7,8]],entry:[[0,-1],[1,-1],[2,-1],[3,-1]],arrive:[[4,-1],[5,-1],[6,-1],[7,-1]],arriveDir:'+v',stacks:true},
    u3:{U:10,V:7,flights:[[0,4,0,3,'+v',6,0],[4,6,3,7,'+u',4,6],[6,10,0,3,'-v',6,10]],landings:[[0,4,3,7,6],[6,10,3,7,10]],entry:[[0,-1],[1,-1],[2,-1],[3,-1]],arrive:[[6,-1],[7,-1],[8,-1],[9,-1]],arriveDir:'+v',stacks:true},
    spiral:{U:8,V:8,flights:[],landings:[],spiral:{cu:4,cv:4,r:3.8,post:.25,a0:-Math.PI/2,sweep:2*Math.PI},entry:[[2,-1],[3,-1],[4,-1],[5,-1]],arrive:[[2,-1],[3,-1],[4,-1],[5,-1]],arriveDir:'+v',stacks:true},
    L:{U:7,V:7,flights:[[0,4,0,3,'+v',8,0],[4,7,3,7,'+u',8,8]],landings:[[0,4,3,7,8]],entry:[[0,-1],[1,-1],[2,-1],[3,-1]],arrive:[[7,3],[7,4],[7,5],[7,6]],arriveDir:'-u',stacks:false,
      cells:[[0,4,0,7],[4,7,3,7]]}
  };
  const STAIR_LABELS={straight:'straight',straightLanding:'straight with a landing',dogleg:'U-turn',u3:'C-shaped',spiral:'spiral',L:'L-shaped'};
  const U_DIR={zp:'xp',zm:'xm',xp:'zm',xm:'zp'};
  function stairBay(kind,orient,bx,bz,storeys,tower=false){
    const S=STAIRS[kind],top=storeys-1,ox=0,ov=tower?HALL:0,U=tower&&kind==='L'?S.U+HALL:S.U,Vn=S.V+ov;
    // local (u, v) -> grid cell, for the whole bay (tower included); continuous points for the spiral's centre
    const at=(u,v)=>orient==='zp'?[bx+u,bz+v]:orient==='zm'?[bx+(U-1-u),bz+(Vn-1-v)]:orient==='xp'?[bx+v,bz+(U-1-u)]:[bx+(Vn-1-v),bz+u];
    const pt=(u,v)=>orient==='zp'?[bx+u,bz+v]:orient==='zm'?[bx+U-u,bz+Vn-v]:orient==='xp'?[bx+v,bz+U-u]:[bx+Vn-v,bz+u];
    const rectOf=(u0,u1,v0,v1)=>{const ps=[at(u0+ox,v0+ov),at(u1-1+ox,v1-1+ov)];return [Math.min(ps[0][0],ps[1][0]),Math.min(ps[0][1],ps[1][1]),Math.max(ps[0][0],ps[1][0])+1,Math.max(ps[0][1],ps[1][1])+1];};
    const dirOf=d=>d==='+v'?orient:d==='-v'?OPP[orient]:d==='+u'?U_DIR[orient]:OPP[U_DIR[orient]];
    const stairCells=[],hallCells=[],inStair=new Set();
    for(const [u0,u1,v0,v1] of S.cells||[[0,S.U,0,S.V]])for(let u=u0;u<u1;u++)for(let v=v0;v<v1;v++){inStair.add(u+','+v);stairCells.push(at(u+ox,v+ov));}
    if(tower)for(let u=0;u<U;u++)for(let v=0;v<Vn;v++)if(!inStair.has(u+','+(v-ov)))hallCells.push(at(u,v));
    const asc=cs=>cs.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const flights=[],landings=[],spirals=[],floors=Array.from({length:storeys},()=>({steps:[],voids:[],open:[]}));
    for(let f=0;f<top;f++){
      for(const [u0,u1,v0,v1,dir,risers,start] of S.flights)flights.push({from:f,rect:rectOf(u0,u1,v0,v1),dir:dirOf(dir),risers,start});
      for(const [u0,u1,v0,v1,rise] of S.landings)landings.push({from:f,rect:rectOf(u0,u1,v0,v1),rise});
      if(S.spiral){const sp=S.spiral,rot={zp:0,zm:Math.PI,xp:-Math.PI/2,xm:Math.PI/2}[orient];spirals.push({from:f,centre:pt(sp.cu+ox,sp.cv+ov),r:sp.r,post:sp.post,a0:sp.a0+rot,sweep:sp.sweep,risers:16});
        landings.push({from:f,rect:rectOf(0,8,-HALL,.5),rise:0},{from:f,rect:rectOf(0,8,-HALL,.5),rise:16});}
      floors[f].open.push({cells:asc(S.entry.map(([u,v])=>at(u+ox,v+ov))),dir:orient});
      floors[f+1].open.push({cells:asc(S.arrive.map(([u,v])=>at(u+ox,v+ov))),dir:dirOf(S.arriveDir)});
      for(const c of stairCells)floors[f].steps.push(c);}
    for(let f=1;f<storeys;f++)for(const c of stairCells)floors[f].voids.push(c);
    const all=[...stairCells,...hallCells],xs=all.map(c=>c[0]),zs=all.map(c=>c[1]);
    return {kind,tower,orient,cells:stairCells,hallCells,rect:[Math.min(...xs),Math.min(...zs),Math.max(...xs)+1,Math.max(...zs)+1],U,V:Vn,flights,landings,spirals,floors};
  }
  // The stair's cells on a floor (and a tower's landing strip, which is hall).
  const putStair=(F,st,plot)=>{const S=st.floors[F.f];for(const [x,z] of st.hallCells)F.grid[x+plot.w*z]=1;for(const [x,z] of [...S.steps,...S.voids])F.grid[x+plot.w*z]=0;
    F.steps=S.steps.map(([x,z])=>x+plot.w*z);F.voids=S.voids.map(([x,z])=>x+plot.w*z);F.open=S.open;};

  // --- Typologies ---------------------------------------------------------------------------------------------------
  // Each takes the plot (w, front, storeys, party, type, jetty) and a variant rng, sets the footprint masks and
  // returns {stair, floors, entrances:[{room, side}]} where floors are built Floor objects.
  // Reserve street rows before laying out rooms; projections are usable floor area, not a displaced facade.
  const jettyRows=(plot,f)=>!f?0:(plot.jettyStep??1)>=4?Math.min(6,plot.jettyStep+(f-1)*2):f*(plot.jettyStep??1);
  const z0Of=(plot,f)=>plot.jetty?plot.front-jettyRows(plot,f):plot.front;
  const sideHall=(plot,v)=>plot.party[0]&&!plot.party[1]?true:plot.party[1]&&!plot.party[0]?false:v()<.5;

  // Side passage (and wing): a 4-cell strip on one side (2 stair cells against the wall, a 2-cell lane) with a row
  // of rooms beside it. Front and back rooms may run the full width; a wing continues behind on the passage side.
  function tSide(plot,v,wing){
    // A shop or workshop fills the ground floor's whole width and most of its depth; the living quarters (stair,
    // kitchen, bath) sit behind it through a door at its rear, and the home's own way in is the yard door.
    const {w,front,storeys}=plot,biz=['shophouse','workshop'].includes(plot.type),left=sideHall(plot,v),sx=left?0:w-8,stairX=left?0:w-4,laneX=left?4:w-8,rx0=left?8:0,rx1=left?w:w-8;
    const ww=wing?Math.min(w-4,ri(v,9,12)):0,wl=wing?ri(v,5,7):0,wing2=wing&&v()<.5,cap=Math.min(plot.maxDepth??Infinity,plot.compactDepth)-wl-(plot.forceStair?.tower&&!wing?(STAIRS[plot.forceStair.kind].V+HALL):0);
    const share=ARCHITECTURE.shop.minFloorShare,Lm=Math.min(cap,biz?Math.max(ri(v,w>=20?26:24,w>=20?29:27),Math.ceil(((w-HALL)*14+share*ww*wl)/((1-share)*w-HALL))):ri(v,22,26)),Dm=front+Lm;if(Lm<(biz?24:22))return null;
    // Sometimes the stair moves out into a tower on the back wall at the end of the passage (more room inside).
    const FS=plot.forceStair,tk=FS?(FS.tower&&!wing?FS.kind:null):!wing&&storeys===2&&v()<.3?weighted(v,{dogleg:1,spiral:1,u3:1,L:1}):null,Ut=tk?STAIRS[tk].U+(tk==='L'?HALL:0):0,Vt=tk?STAIRS[tk].V+HALL:0,tbx=tk?Math.max(0,Math.min(w-Ut,left?sx:sx+8-Ut)):0;
    plot.d=Dm+wl+Vt;plot.masks=blankMasks(plot);
    plot.masks.forEach((m,f)=>{maskRect(plot,m,0,z0Of(plot,f),w,Dm);if(wing&&(f===0||wing2))maskRect(plot,m,left?0:w-ww,Dm,left?ww:w,Dm+wl);if(tk)maskRect(plot,m,tbx,Dm,tbx+Ut,Dm+Vt);});
    const progs=plot.programs;
    // Band choices per floor: a full-width front room (upper floors only) and a full-width back room.
    const frontFull=[biz,...Array.from({length:storeys-1},()=>v()<.55)],backFull=Array.from({length:storeys},(_,f)=>!wing&&!tk&&!(biz&&f===0)&&v()<(f===0?.5:.45));
    const fbLen=Array.from({length:storeys},(_,f)=>f===0&&biz?Math.max(Lm-ri(v,14,16),Math.ceil(share*(w*Lm+ww*wl+Ut*Vt)/(w-HALL))):ri(v,8,10)),bbLen=ri(v,7,9); // a shop runs back to the living area (the stair, and a kitchen unless the wing has it)
    // Hall rows per floor (the strip), which the stair and its landings must sit inside.
    const hallRows=f=>[z0Of(plot,f)+(frontFull[f]?fbLen[f]:0),Dm-(backFull[f]?bbLen:0)];
    const orient=v()<.6?'zp':'zm';
    const fits=L=>{const out=[];for(let a=front;a+L<=Dm;a++){
      if(Array.from({length:storeys},(_,f)=>hallRows(f)).every(([lo,hi])=>a>=lo+HALL&&a+L+HALL<=hi))out.push(a);
    }return out;};
    let st;
    if(tk)st=stairBay(tk,'zp',tbx,Dm,storeys,true);
    else{let kind=FS&&!STAIRS[FS.kind].stacks?FS.kind:v()<.45?'straightLanding':'straight',okA=fits(STAIRS[kind].V);if(!okA.length){kind='straight';okA=fits(6);}if(!okA.length)return null;
      st=stairBay(kind,orient,stairX,okA[Math.min(okA.length-1,Math.floor(v()*okA.length))],storeys);}
    const floors=[],entrances=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=progs[f],z0=z0Of(plot,f),[h0,h1]=hallRows(f);
      F.fill(sx,z0,sx+8,Dm,1);
      if(frontFull[f])F.zone(0,z0,w,z0+fbLen[f],'x',[P.front[0]],v);
      if(backFull[f])F.zone(0,Dm-bbLen,w,Dm,'x',[P.back[0]],v);
      const row=[...(frontFull[f]?P.front.slice(1):P.front),...P.support,...(backFull[f]?P.back.slice(1):wing&&f===0?(biz?[]:['dining?']):P.back)];
      F.zone(rx0,h0,rx1,h1,'z',row,v);
      if(wing&&(f===0||wing2)){const first=F.rooms.length;F.zone(left?0:w-ww,Dm,left?ww:w,Dm+wl,'z',f===0?['kitchen','store']:[pick(v,['bath','bed'])],v);
        for(const room of F.rooms.slice(first)){room.extension=true;room.wing=true;}}
      putStair(F,st,plot);floors.push(F);}
    const shop=floors[0].rooms.findIndex(r=>['shop','workshop'].includes(r.type));
    if(biz&&shop>1)entrances.push({floor:0,room:shop,side:'zm'});else entrances.push({floor:0,room:1,side:'zm',at:laneX});
    return {stair:st,floors,entrances};
  }

  // Central hall: a 2 m hall from the front door to a straight stair in the middle of the house, a row of rooms each
  // side. The hall stops at the landing past the stair; behind it, the back rooms run the full width (one room, or
  // two meeting at the hall's end), so no space is lost to a hall running the length of the house.
  function tCentre(plot,v){
    const {w,front,storeys}=plot,biz=['shophouse','workshop'].includes(plot.type),sx=Math.round((w-8)/2+(v()-.5)*2),stairLeft=v()<.5,stairX=stairLeft?sx:sx+4,cap=Math.min(plot.maxDepth??Infinity,plot.compactDepth)-(plot.forceStair?.tower?STAIRS[plot.forceStair.kind].V+HALL:0),Lm=Math.min(cap,biz?ri(v,24,27):ri(v,22,26)),Dm=front+Lm,shopLen=biz?Lm-ri(v,9,11):0;
    if(Lm<(biz?20:18))return null;
    // the tower (if any) is decided first: the plot grows to hold it before the floor masks are made
    const FS=plot.forceStair,tk=FS?(FS.tower?FS.kind:null):storeys===2&&v()<.3?weighted(v,{dogleg:1,spiral:1,u3:1,L:1}):null,Ut=tk?STAIRS[tk].U+(tk==='L'?HALL:0):0,Vt=tk?STAIRS[tk].V+HALL:0,tbx=tk?Math.max(0,Math.min(w-Ut,sx+4-Math.round(Ut/2))):0;
    plot.d=Dm+Vt;plot.masks=blankMasks(plot);plot.masks.forEach((m,f)=>{maskRect(plot,m,0,z0Of(plot,f),w,Dm);if(tk)maskRect(plot,m,tbx,Dm,tbx+Ut,Dm+Vt);});
    const orient=v()<.6?'zp':'zm',BB=8; // the back band is at least 4 m deep
    const fits=L=>{const out=[];for(let a=front+shopLen;a+L<=Dm;a++){const e=orient==='zp'?a-1:a+L,ar=orient==='zp'?a+L:a-1;if(e>front+Math.max(0,shopLen-1)&&ar>z0Of(plot,1)&&e<Dm-1&&ar<Dm-1)out.push(a);}return out;};
    let st;const floors=[];
    if(tk)st=stairBay(tk,'zp',tbx,Dm,storeys,true);
    else{let kind=FS&&!STAIRS[FS.kind].stacks?FS.kind:v()<.45?'straightLanding':'straight',okA=fits(STAIRS[kind].V);if(!okA.length){kind='straight';okA=fits(6);}if(!okA.length)return null;
      // prefer a stair that leaves room for the back band and for a front room beside the hall on every floor
      const L=STAIRS[kind].V,good=okA.filter(a=>Dm-(a+L+1)>=BB&&a+L+1-front-shopLen>=(biz?3:7));
      const pool=good.length?good:okA;st=stairBay(kind,orient,stairX,pool[Math.floor(v()*pool.length)],storeys);}
    // the hall ends one landing past the stair (the tower stair needs the hall to reach the back wall)
    const he=tk||Dm-(st.rect[3]+HALL)<BB-2?Dm:st.rect[3]+HALL,sz0=st.rect[1],sz1=st.rect[3];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=plot.programs[f],shop=biz&&f===0,
        // when the stair stands far back (behind a shop), the front room runs the full width so the hall still only
        // spans the stair
        fb=!shop&&!tk&&sz0-z0Of(plot,f)>=12&&sz0-z0Of(plot,f)-ri(v,4,6)>=MINLEN[bare(P.front[0])]?sz0-z0Of(plot,f)-ri(v,4,6):0,z0=z0Of(plot,f)+(shop?shopLen:fb);
      F.fill(sx,z0,sx+8,he,1);
      if(shop||fb)F.zone(0,z0Of(plot,f),w,z0,'x',[P.front[0]],v);
      // back band: one room across, or two meeting at the middle of the hall's end so both open off it
      let back=P.back.slice(),used=0;
      if(he<Dm){const two=back.length>1&&sx+2>=MINLEN[bare(back[1])]&&w-sx-2>=MINLEN[bare(back[0])]&&v()<.75;
        if(two){const l=F.room(bare(back[1])),r=F.room(bare(back[0]));const left=v()<.5;F.fill(0,he,sx+2,Dm,left?r:l);F.fill(sx+2,he,w,Dm,left?l:r);used=2;}
        else{F.zone(0,he,w,Dm,'x',[back[0]],v);used=1;}}
      const rest=[...P.support,...back.slice(used)],half=Math.ceil(rest.length/2),fr=shop?[[],[]]:fb?[P.front.slice(1),[]]:[[P.front[0]],[P.front[1]||P.front[0]]];
      // Beside the stair the hall is only open in front of it and behind it, so that side holds at most two rooms:
      // one reaching the hall in front of the stair, one behind. The rest go to the open side.
      const rows=[[...fr[0],...rest.slice(0,half)],[...fr[1],...rest.slice(half)]],ss=stairLeft||tk?0:1,open=1-ss,sr=rows[ss].filter(t=>!t.endsWith('?')||rows[ss].length<=2);
      const xs=[[0,sx],[sx+8,w]],[ax,bx]=xs[ss],gapF=sz0-z0,gapB=he-sz1;
      if(tk||he===Dm&&gapB<2||!sr.length){F.zone(xs[0][0],z0,xs[0][1],he,'z',rows[0],v);F.zone(xs[1][0],z0,xs[1][1],he,'z',rows[1],v);}
      else{const two=sr.length>1&&gapF>=2&&gapB>=2&&he-z0>=MINLEN[bare(sr[0])]+MINLEN[bare(sr[1])],keep=two?sr.slice(0,2):(gapB>=2||gapF>=2?sr.slice(0,1):[]);
        const left=rows[ss].slice();for(const t of keep)left.splice(left.indexOf(t),1);rows[open].push(...left);
        if(two){const m=Math.max(z0+MINLEN[bare(keep[0])],Math.min(he-Math.max(2,MINLEN[bare(keep[1])]),Math.round((z0+he)/2)));F.zone(ax,z0,bx,m,'z',[keep[0]],v);F.zone(ax,m,bx,he,'z',[keep[1]],v);}
        else if(keep.length)F.zone(ax,z0,bx,he,'z',keep,v);
        F.zone(xs[open][0],z0,xs[open][1],he,'z',rows[open],v);}
      putStair(F,st,plot);floors.push(F);}
    return {stair:st,floors,entrances:biz?[{floor:0,room:floors[0].rooms.findIndex(r=>['shop','workshop'].includes(r.type)),side:'zm'}]:[{floor:0,room:1,side:'zm',at:stairLeft?sx+4:sx}]};
  }

  // Stair hall: a 4-cell-wide hall from the front door to a U-turn stair at the back, rooms either side.
  function tStairhall(plot,v){
    const {w,front,storeys}=plot,FS=plot.forceStair,tower=FS?!!FS.tower:v()<.3,k=FS&&STAIRS[FS.kind].stacks||FS&&FS.tower?FS.kind:weighted(v,{dogleg:2,spiral:1.2,u3:1,...(tower&&storeys===2?{L:1}:{})}),S=STAIRS[k],Ub=tower?8:S.U,Vb=tower?0:S.V;
    const hx=Math.round((w-Ub)/2),Lm=Math.min(plot.maxDepth??Infinity,plot.compactDepth-(tower?S.V+HALL:0),ri(v,22,26)),Dm=front+Lm,Ut=S.U+(k==='L'?HALL:0),Vt=S.V+HALL,tbx=Math.max(0,Math.min(w-Ut,hx+4-Math.round(Ut/2)));
    const bay=tower?stairBay(k,'zp',tbx,Dm,storeys,true):stairBay(k,'zp',hx,Dm-Vb,storeys);
    plot.d=Dm+(tower?Vt:0);plot.masks=blankMasks(plot);plot.masks.forEach((m,f)=>{maskRect(plot,m,0,z0Of(plot,f),w,Dm);if(tower)maskRect(plot,m,tbx,Dm,tbx+Ut,Dm+Vt);});
    const biz=['shophouse','workshop'].includes(plot.type),commonFront=plot.type==='inn'||biz,floors=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=plot.programs[f],z0=z0Of(plot,f),full=f===0?commonFront:v()<.4&&plot.type!=='inn'&&!biz,fb=f===0&&biz?Lm-Vb-2-ri(v,4,6):ri(v,9,12);
      const hz0=full?z0+fb:z0;F.fill(hx,hz0,hx+Ub,Dm,1);if(full)F.zone(0,z0,w,hz0,'x',[P.front[0]],v);
      const rest=[...(full?P.front.slice(1):P.front.slice(1)),...P.support,...P.back],half=Math.ceil(rest.length/2),first=full?[]:[P.front[0]];
      // the last room in each row must still reach past the stair bay to the hall
      F.zone(0,hz0,hx,Dm,'z',[...first,...rest.slice(0,half)],v,Vb+HALL);F.zone(hx+Ub,hz0,w,Dm,'z',[...(full?[]:[P.front[1]||P.front[0]]),...rest.slice(half)],v,Vb+HALL);
      putStair(F,bay,plot);floors.push(F);}
    return {stair:bay,floors,entrances:[{floor:0,room:commonFront?floors[0].rooms.findIndex(r=>['common','shop','workshop'].includes(r.type)):1,side:'zm',at:hx+Math.floor(Ub/2)-1}]};
  }

  // Cross passage (and cottage): front rooms side by side along the street, a 2-row passage across, back rooms side by
  // side behind with a U-turn stair opening off the passage. Terraces reach the passage by a front lobby; corner and
  // detached plots may use a side door instead. The cottage folds the ground-floor passage into the living room.
  function tCross(plot,v,cottage){
    const {w,front,storeys,party}=plot,biz=['shophouse','workshop'].includes(plot.type),frontDepth=biz?ri(v,7,10)+HALL:ri(v,7,10),bb0=ri(v,6,9),share=ARCHITECTURE.shop.minFloorShare;
    const k=plot.forceStair&&STAIRS[plot.forceStair.kind].stacks?plot.forceStair.kind:weighted(v,{dogleg:2,spiral:1.2,u3:w>=16?1:0}),Ub=STAIRS[k].U,Vb=STAIRS[k].V,bb=Math.max(bb0,Vb+HALL),fb=biz?Math.max(frontDepth,Math.ceil(share*w*(HALL+bb)/((1-share)*w-HALL))+1):frontDepth,m=front+fb,D=m+HALL+bb,chosen=pick(v,[0,w-Ub,0,w-Ub,Math.round((w-Ub)/2)]),e=chosen>0&&chosen<HALL?0:w-chosen-Ub>0&&w-chosen-Ub<HALL?w-Ub:chosen,bay=stairBay(k,'zp',e,D-Vb,storeys);
    plot.d=D;plot.masks=blankMasks(plot);plot.masks.forEach((m_,f)=>maskRect(plot,m_,0,z0Of(plot,f),w,D));
    const openSide=!party[0]?'xm':!party[1]?'xp':null,sideDoor=!cottage&&openSide&&v()<.6,laneAt=['shophouse','workshop'].includes(plot.type)?pick(v,[0,w-HALL]):pick(v,[0,w-HALL,Math.round(w/2)-HALL/2]),floors=[],entrances=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P0=plot.programs[f],z0=z0Of(plot,f);
      const backRanges=[[0,e],[e+Ub,w]].filter(([a,b])=>b-a>=HALL).sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));
      // Rooms that do not fit behind the passage (narrow plots) move to the front band instead of being dropped.
      let cap=backRanges.reduce((a,[x0,x1])=>a+x1-x0,0);const back=[],moved=[];
      const sup=[...P0.support].sort((a,b)=>(bare(b)==='bath')-(bare(a)==='bath')); // the bath keeps its place at the back; a store moves forward first
      for(const t of [P0.back[0],...sup,...P0.back.slice(1)]){const need=MINLEN[bare(t)];if(need<=cap){back.push(t);cap-=need;}else if(!t.endsWith('?'))moved.push(t);}
      // on a shop's ground floor the front band stays all shop; what does not fit behind is left out
      const P={front:biz&&f===0?[P0.front[0]]:[...P0.front,...moved],support:[],back};
      // A cottage keeps its broad street-facing living room, with a short rear passage serving the stair and back rooms.
      if(f===0&&cottage){const liv=F.room('living');F.fill(0,z0,w,m,liv);F.fill(0,m,w,m+HALL,1);if(w>=18){const dw=ri(v,7,9),left=v()<.5,dn=F.room('dining');F.fill(left?0:w-dw,z0,left?dw:w,m-1,dn);}}
      else{F.fill(0,m,w,m+HALL,1);
        if(f===0&&!sideDoor&&plot.type!=='inn'&&!biz){F.fill(laneAt,z0,laneAt+HALL,m,1);const parts=[[0,laneAt],[laneAt+HALL,w]].filter(([a,b])=>b-a>=4).sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]));
          parts.forEach(([a,b],k)=>F.zone(a,z0,b,m,'x',parts.length===1?P.front:k===0?[P.front[0]]:P.front.slice(1),v));
          // a sliver too thin for a room joins the lobby
          for(const [a,b] of [[0,laneAt],[laneAt+HALL,w]])if(b-a>0&&b-a<4)F.fill(a,z0,b,m,1);}
        else F.zone(0,z0,w,m,'x',P.front,v);}
      const backList=P.back;
      const share=backRanges.map(([a,b])=>b-a),tot=share.reduce((x,y)=>x+y,0);let k=0;
      backRanges.forEach(([a,b],i)=>{const n=i===backRanges.length-1?backList.length-k:Math.max(1,Math.round(backList.length*share[i]/tot));F.fill(a,m+HALL,b,D,1);F.zone(a,m+HALL,b,D,'x',backList.slice(k,k+n),v);k+=n;});
      // the cells between the passage and the stair are its lobby (part of the living room in a cottage)
      putStair(F,bay,plot);const lobby=1;
      for(let z=m+HALL;z<D;z++)for(let x=e;x<e+Ub;x++)if(F.grid[x+plot.w*z]===-1&&plot.masks[f][x+plot.w*z])F.grid[x+plot.w*z]=lobby;
      floors.push(F);}
    if(cottage)entrances.push({floor:0,room:floors[0].rooms.findIndex(r=>r.type==='living'),side:'zm'});
    else if(plot.type==='inn')entrances.push({floor:0,room:floors[0].rooms.findIndex(r=>r.type==='common'),side:'zm'});
    else if(biz){const shop=floors[0].rooms.findIndex(r=>['shop','workshop'].includes(r.type));entrances.push({floor:0,room:shop,side:'zm'});if(sideDoor)entrances.push({floor:0,room:1,side:openSide});}
    else if(sideDoor)entrances.push({floor:0,room:1,side:openSide});
    else entrances.push({floor:0,room:1,side:'zm',at:laneAt});
    return {stair:bay,floors,entrances};
  }

  // Courtyard: a front block across the street, two wings round a courtyard, galleries on the outer walls so every
  // room looks onto the courtyard (party walls do not matter), and a stair tower in a courtyard corner.
  function tCourtyard(plot,v){
    const {w,front,storeys}=plot,k=plot.forceStair&&STAIRS[plot.forceStair.kind].stacks?plot.forceStair.kind:weighted(v,{dogleg:2,spiral:1.5,u3:1}),Ub=STAIRS[k].U,Vb=STAIRS[k].V,fb=ri(v,10,12),ww=Math.min(ri(v,10,11),Math.floor((w-Ub-HALL)/2)),wl=Math.min(ri(v,12,16),plot.compactDepth-fb),D=front+fb+wl,zc=front+fb,left=v()<.5,tx=left?ww:w-ww-Ub;
    if(ww<9||wl<10)return null;
    plot.d=D;plot.masks=blankMasks(plot);
    plot.masks.forEach((m,f)=>{maskRect(plot,m,0,z0Of(plot,f),w,zc);maskRect(plot,m,0,zc,ww,D);maskRect(plot,m,w-ww,zc,w,D);maskRect(plot,m,tx,zc,tx+Ub,zc+Vb);});
    if(w-2*ww<Ub+HALL)return null;
    const bay=stairBay(k,'zp',tx,zc,storeys),floors=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=plot.programs[f],z0=z0Of(plot,f);
      F.fill(0,zc-HALL,w,zc,1);F.fill(0,zc,HALL,D,1);F.fill(w-HALL,zc,w,D,1);
      if(f===0){const k=F.room(P.front[0]);F.fill(0,z0,w,zc-HALL,k);}else F.zone(0,z0,w,zc-HALL,'x',P.front,v);
      const wingsL=f===0?['kitchen','store']:[P.back[0],...P.support.slice(0,1),'guest?'],wingsR=f===0?[...P.support]:[P.back[1]||P.back[0],...P.support.slice(1),P.back[2]||'guest?'];
      F.zone(HALL,zc,ww,D,'z',wingsL,v);F.zone(w-ww,zc,w-HALL,D,'z',wingsR,v);
      putStair(F,bay,plot);floors.push(F);}
    return {stair:bay,floors,entrances:[{floor:0,room:2,side:'zm'}]};
  }
  function tTower(plot,v){
    const depth=6;plot.front+=depth;const T=tCross(plot,v,false),{w}=plot,slots=[];
    for(let x=1;x<=w-7;x++)if(T.floors.every((F,f)=>{const z=z0Of(plot,f),k=F.grid[x+w*z];return k>1&&!['bath','store'].includes(F.rooms[k].type)&&Array.from({length:6},(_,a)=>F.grid[x+a+w*z]).every(n=>n===k);}))slots.push(x);
    if(!slots.length)return null;const x=pick(v,slots);
    for(const F of T.floors){const z0=z0Of(plot,F.f),k=F.grid[x+w*z0];F.rooms[k].annex=true;for(let z=z0-depth;z<z0;z++)for(let a=x;a<x+6;a++){F.grid[a+w*z]=k;plot.masks[F.f][a+w*z]=1;}}
    for(const e of T.entrances)if(e.side==='zm')e.row=plot.front;
    plot.features=[{kind:'tower',rect:[x,z0Of(plot,plot.storeys-1)-depth,x+6,z0Of(plot,plot.storeys-1)],width:6,depth}];return T;
  }
  function tUndercroft(plot,v){
    plot.programs[0]={front:['store'],support:[],back:['store']};
    plot.programs[1]={front:['living','kitchen'],support:['bath'],back:['bed','bed','bed?']};
    const T=tCross(plot,v,false),F=T.floors[0],{w}=plot;
    for(const room of F.rooms)if(room.type==='store')room.bulkStorage=true;
    let row=plot.front;while(row<plot.d&&!Array.from({length:w},(_,x)=>F.grid[x+w*row]).every(k=>k===1))row++;
    if(row>=plot.d)return null;
    for(let z=0;z<row;z++)for(let x=0;x<w;x++){F.grid[x+w*z]=-1;plot.masks[0][x+w*z]=0;}
    T.entrances=[{floor:0,room:1,side:'zm',row}];plot.features=[{kind:'undercroft',rect:[0,plot.front,w,row]}];return T;
  }
  // Narrow city row house (7-7.5 m, three window bays): a ground-floor lane runs to a U-turn stair at the back of
  // the main block, beside the living room; a full-width kitchen fills the deeper ground floor behind. Upper floors
  // have a cross hall behind a front bedroom and bath, with a back bedroom beside the stair, lit over the kitchen roof.
  function tRowhouse(plot,v){
    const {w,front,storeys}=plot;if(w<14||w>15||plot.type!=='home')return null;
    const S=STAIRS.dogleg,D=plot.targetDepth??front+25,occupied=D-front,annex=occupied>=24;
    if(![19,20,21,24,25].includes(occupied))return null;
    const fb=annex?8:occupied-HALL-S.V,m=front+fb,h1=m+HALL,Dm=h1+S.V;
    const left=v()<.5,e=left?0:w-S.U,rx0=left?S.U:0,rx1=left?w:w-S.U,lane=left?0:w-HALL,bay=stairBay('dogleg','zp',e,h1,storeys),bathAt=left?0:w-5;
    plot.d=D;plot.masks=blankMasks(plot);plot.masks.forEach((mask,f)=>maskRect(plot,mask,0,f&&plot.jetty?0:front,w,f?Dm:D));
    const floors=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f);
      if(f===0){F.fill(lane,front,lane+HALL,h1,1);const living=F.room('living');F.fill(left?HALL:0,front,left?w:w-HALL,h1,living);
        const back=F.room(annex?'hall':'kitchen');F.fill(rx0,h1,rx1,Dm,back);if(annex){const kitchen=F.room('kitchen');F.fill(0,Dm,w,D,kitchen);}}
      else{const face=plot.jetty?0:front;F.fill(0,m,w,h1,1);const bath=F.room('bath'),bed=F.room('bed'),back=F.room('bed');F.fill(bathAt,face,bathAt+5,m,bath);F.fill(left?5:0,face,left?w:w-5,m,bed);F.fill(rx0,h1,rx1,Dm,back);}
      putStair(F,bay,plot);floors.push(F);}
    const corner=plot.corner;
    if(corner){
      const cut=Math.round(corner.cut/CELL),length=Math.round(corner.length/CELL);
      for(let z=D-length;z<D;z++)for(let n=0;n<Math.ceil(cut*(z-(D-length)+.5)/length);n++){
        const x=corner.side==='left'?n:w-1-n,i=x+w*z;
        if(floors.some(F=>F.grid[i]>=0&&F.rooms[F.grid[i]].type!=='kitchen'))return null;
        for(const F of floors)F.grid[i]=-1;
        for(const mask of plot.masks)mask[i]=0;
      }
    }
    if(plot.jetty){plot.overhang={metres:front*CELL,frontOnly:true,core:{x:0,z:front,w,d:occupied},masks:plot.masks.map((mask,f)=>Array.from(mask,(v,i)=>f&&Math.floor(i/w)<front?v:0))};}
    return {stair:bay,floors,entrances:[{floor:0,room:1,side:'zm',at:lane}]};
  }
  const BUILD={side:(p,v)=>tSide(p,v,false),wing:(p,v)=>tSide(p,v,true),centre:tCentre,stairhall:tStairhall,cross:(p,v)=>tCross(p,v,false),cottage:(p,v)=>tCross(p,v,!['shophouse','workshop'].includes(p.type)),courtyard:tCourtyard,tower:tTower,undercroft:tUndercroft,rowhouse:tRowhouse};

  // --- Doors, openings, score ---------------------------------------------------------------------------------------
  function sharedRuns(plot,grid){
    const {w,d}=plot,runs=new Map();
    for(let z=0;z<d;z++)for(let x=0;x<w;x++){const a=grid[x+w*z];if(a<0)continue;
      for(const [dx,dz,s] of [[1,0,'xp'],[0,1,'zp']]){const nx=x+dx,nz=z+dz;if(nx>=w||nz>=d)continue;const b=grid[nx+w*nz];if(b<0||b===a)continue;
        const key=`${a}-${b}-${s}-${s==='xp'?x:z}`;if(!runs.has(key))runs.set(key,{a,b,dir:s,cells:[]});runs.get(key).cells.push([x,z]);}}
    const out=[];for(const r of runs.values()){r.cells.sort((p,q)=>p[0]-q[0]||p[1]-q[1]);let cur=null;
      for(const c of r.cells){if(cur&&Math.abs(c[0]-cur.cells.at(-1)[0])+Math.abs(c[1]-cur.cells.at(-1)[1])===1)cur.cells.push(c);else{cur={a:r.a,b:r.b,dir:r.dir,cells:[c]};out.push(cur);}}}
    return out;
  }
  // Doors grow outwards from where you arrive on the floor (front door, or the head of the stair), cheapest first, so
  // rooms open onto circulation. Leaf rooms are reached but never walked through. The stair opens where the
  // stair module says, onto whatever circulation room is there.
  function placeDoors(plot,F,startRoom){
    const {grid,rooms}=F,{w}=plot,bounds=roomDepths(plot,F),runs=sharedRuns(plot,grid).filter(r=>r.cells.length>=DOOR&&rooms[r.a].type!=='stair'&&rooms[r.b].type!=='stair')
      .map(r=>shopDoorRun(r,bounds[r.a].type==='shop'?bounds[r.a]:bounds[r.b])).filter(Boolean);
    const domesticStore=k=>rooms[k].type==='store'&&!rooms[k].bulkStorage&&roomZone(plot.type,F.f,rooms[k])==='resident',leaf=k=>ROOMS[rooms[k].type].leaf||domesticStore(k),
      links=runs.filter(r=>canLink(rooms[r.a].type,rooms[r.b].type)&&!(domesticStore(r.a)&&domesticStore(r.b))&&![r.a,r.b].some((k,i)=>domesticStore(k)&&roomZone(plot.type,F.f,rooms[i?r.a:r.b])!=='resident')),
      cost=r=>{const A=rooms[r.a].type,B=rooms[r.b].type;return (A==='hall'||B==='hall'?0:ROOMS[A].circ||ROOMS[B].circ?1:2)+(r.cells.length<3?.5:0);};
    const areas=rooms.map(()=>0);for(const k of grid)if(k>=0)areas[k]+=CELL*CELL;
    const reached=new Set([startRoom]),doors=[];
    const connect=(seen,privateOnly=false)=>{while(true){let best=null;
      for(const l of links){const ina=seen.has(l.a),inb=seen.has(l.b);if(ina===inb)continue;const from=ina?l.a:l.b;
        if(privateOnly&&[l.a,l.b].some(k=>roomZone(plot.type,F.f,rooms[k])!=='resident'))continue;
        if(leaf(from)||rooms[from].type==='dining'&&areas[from]<ARCHITECTURE.dining.throughMin)continue;
        const existing=doors.some(d=>d.a===l.a&&d.b===l.b||d.a===l.b&&d.b===l.a),c=cost(l)-(existing?10:0);if(!best||c<best.c)best={l,c,existing};}
      if(!best)break;seen.add(best.l.a);seen.add(best.l.b);if(!best.existing)doors.push(doorOn(best.l,rooms));}
      for(const k of seen)reached.add(k);};
    connect(reached);
    if(ARCHITECTURE.mixedUse.includes(plot.type))connect(new Set([startRoom]),true);
    for(const l of links){if(!['dining|kitchen','kitchen|living','common|kitchen','shop|workshop','shop|store','store|workshop'].includes(pairKey(rooms[l.a].type,rooms[l.b].type)))continue;
      if(domesticStore(l.a)||domesticStore(l.b))continue;
      if(['shop|store','store|workshop'].includes(pairKey(rooms[l.a].type,rooms[l.b].type))&&
         (rooms[l.a].zone==='resident'||rooms[l.b].zone==='resident'))continue;
      if(doors.some(dr=>(dr.a===l.a&&dr.b===l.b)||(dr.a===l.b&&dr.b===l.a)))continue;doors.push(doorOn(l,rooms));}
    for(const o of F.open){const k=grid[o.cells[0][0]+w*o.cells[0][1]];if(k<0||!ROOMS[rooms[k].type].circ)continue;doors.push({a:k,b:0,dir:o.dir,cells:o.cells,kind:'open'});if(reached.has(k))reached.add(0);}
    for(const door of doors)door.roles=doorRoles(rooms[door.a],rooms[door.b]);
    return {doors,reached};
  }
  function addPrivateArrival(plot,F,entrances){
    if(!ARCHITECTURE.mixedUse.includes(plot.type))return false;
    const {w,d}=plot,mask=plot.masks[0],street=Math.min(...[...mask.keys()].filter(i=>mask[i]).map(i=>Math.floor(i/w)));
    const at=(x,z)=>x<0||x>=w||z<0||z>=d?-1:F.grid[x+w*z];
    if(entrances.some(e=>e.floor===0&&e.room===1&&e.side==='zm'&&at(e.at??-1,street)===1))return true;
    for(let x=0;x<w-1;x++)if(at(x,street)===1&&at(x+1,street)===1){entrances.push({floor:0,room:1,side:'zm',at:x});return true;}
    const trade=F.rooms.findIndex((r,k)=>k>1&&r.type===(plot.type==='shophouse'?'shop':'workshop')&&!r.extension);
    if(trade<0)return false;
    const strips=[];
    for(let x=0;x<=w-HALL;x++){
      let end=street;
      while(end<d&&Array.from({length:HALL},(_,i)=>at(x+i,end)).every(k=>k===trade))end++;
      if(end===street||end>=d||Array.from({length:HALL},(_,i)=>at(x+i,end)).some(k=>k!==1))continue;
      // A strip must lie on the edge of the trade room throughout, so the remaining business stays rectangular.
      const same=(z,a,b)=>{for(let i=0;i<w;i++)if(at(i,z)===trade&&(i<x||i>=x+HALL)&&(i<a||i>b))return false;return true;};
      const left=Array.from({length:end-street},(_,k)=>street+k).every(z=>same(z,x+HALL,w-1));
      const right=Array.from({length:end-street},(_,k)=>street+k).every(z=>same(z,0,x-1));
      if(!left&&!right)continue;
      const service=Array.from({length:end-street},(_,k)=>street+k).filter(z=>[at(x-1,z),at(x+HALL,z)].some(k=>['workshop','store'].includes(F.rooms[k]?.type))).length;
      strips.push({x,end,service,remaining:Array.from({length:end-street},(_,k)=>street+k).reduce((n,z)=>n+Array.from({length:w},(_,i)=>at(i,z)===trade).filter(Boolean).length,0)-HALL*(end-street)});
    }
    strips.sort((a,b)=>a.service-b.service||b.remaining-a.remaining||a.end-b.end||a.x-b.x);
    const chosen=strips[0];if(!chosen)return false;
    for(let z=street;z<chosen.end;z++)for(let x=chosen.x;x<chosen.x+HALL;x++)F.grid[x+w*z]=1;
    entrances.push({floor:0,room:1,side:'zm',at:chosen.x});
    return true;
  }

  function refineRooms(plot,F,entrances,allowProgramme=true){
    const {w,d}=plot,mask=plot.masks[F.f],extra={living:['dining','study','bed','store'],kitchen:['dining','store'],dining:['study','store'],bed:['bed','study','bath'],guest:['guest','bath'],study:['study','store'],office:['office','store'],store:['store'],shop:['store'],workshop:['store'],common:['dining']},
      at=(x,z)=>x<0||z<0||x>=w||z>=d?-1:F.grid[x+w*z],cells=k=>Array.from(F.grid.keys()).filter(i=>F.grid[i]===k),
      box=cs=>[Math.min(...cs.map(i=>i%w)),Math.min(...cs.map(i=>Math.floor(i/w))),Math.max(...cs.map(i=>i%w))+1,Math.max(...cs.map(i=>Math.floor(i/w)))+1],
      start=()=>F.f===0?(entrances.find(e=>e.floor===0&&ROOMS[F.rooms[e.room]?.type]?.circ)?.room??1):(F.open.map(o=>at(...o.cells[0])).find(k=>k>0&&ROOMS[F.rooms[k].type].circ)??1),
      light=cs=>{const sides=new Map();for(const i of cs){const x=i%w,z=Math.floor(i/w);for(const [dx,dz,s] of DIRS){const xx=x+dx,zz=z+dz;if(xx>=0&&zz>=0&&xx<w&&zz<d&&mask[xx+w*zz]||isPartyEdge(plot,x,z,s))continue;
          let blocked=false;for(let n=2;n<=3;n++){const a=x+dx*n,b=z+dz*n;if(a>=0&&b>=0&&a<w&&b<d&&mask[a+w*b])blocked=true;}if(blocked)continue;
          const key=s+':'+(dx?x:z),c=dx?z:x;if(!sides.has(key))sides.set(key,new Set());sides.get(key).add(c);}}
        return [...sides.values()].some(s=>[...s].some(c=>s.has(c+1)));},
      usable=(cs,width=HALL,required=cs,connected=required===cs)=>{const set=new Set(cs),anchors=new Set(),covered=new Set();
        for(const i of cs){const x=i%w,z=Math.floor(i/w);if(x+width>w||z+width>d)continue;let full=true;
          for(let a=0;a<width&&full;a++)for(let b=0;b<width;b++)if(!set.has(i+a+w*b)){full=false;break;}
          if(full){anchors.add(i);for(let a=0;a<width;a++)for(let b=0;b<width;b++)covered.add(i+a+w*b);}}
        if(required.some(i=>!covered.has(i))||!anchors.size)return false;if(!connected)return true;
        const q=[anchors.values().next().value],seen=new Set(q);while(q.length){const i=q.pop();for(const j of [i-1,i+1,i-w,i+w])if(anchors.has(j)&&!seen.has(j)){seen.add(j);q.push(j);}}
        return seen.size===anchors.size;
      },
      child=(type,room)=>({...room,type,domestic:roomZone(plot.type,F.f,room)==='resident',commercial:type==='store'&&roomZone(plot.type,F.f,room)!=='resident'}),
      budget=(type,room={})=>roomBudget(plot.type,F.f,{...room,type}),
      valid=(type,cs,limit=true,source={})=>{if(!cs.length)return false;const B=box(cs),a=cs.length*CELL*CELL,W=B[2]-B[0],D=B[3]-B[1],R=budget(type,source);return a>=R.minA&&(!limit||a<=R.maxA)&&Math.min(W,D)>=R.minW&&(Math.max(W,D)/Math.min(W,D)<=ARCHITECTURE.rareAspect||!limit&&a>R.maxA)&&(!R.light||light(cs))&&(cs.length===W*D||usable(cs));},
      reclaimHall=()=>{if(F.f===0||plot.type==='inn')return;
        const protectedCells=new Set();for(const o of F.open){const [dx,dz]=DIRS.find(d=>d[2]===o.dir);for(const [x,z] of o.cells)for(let n=0;n<HALL;n++)protectedCells.add(x-dx*n+w*(z-dz*n));}
        for(let n=0;n<5&&cells(1).length*CELL*CELL>28;n++){
          const hall=cells(1),hs=new Set(hall),wide=new Set(),oldReach=placeDoors(plot,F,start()).reached,choices=[];
          for(const i of hall){const x=i%w,z=Math.floor(i/w),square=[];if(x+HALL>w||z+HALL>d)continue;for(let b=0;b<HALL;b++)for(let a=0;a<HALL;a++)square.push(i+a+w*b);if(square.every(j=>hs.has(j)))for(const j of square)wide.add(j);}
          for(let z=0;z<=d-5;z++)for(let x=0;x<=w-5;x++)if(at(x,z)===1)
            for(let width=5;width<=12&&x+width<=w;width++)for(let depth=5;depth<=12&&z+depth<=d;depth++){
              const area=width*depth*CELL*CELL;if(area<ROOMS.bed.minA||area>ROOMS.bed.maxA)continue;
              const part=[];let clear=true;
              for(let b=z;b<z+depth&&clear;b++)for(let a=x;a<x+width;a++)if(at(a,b)!==1||protectedCells.has(a+w*b)){clear=false;break;}else part.push(a+w*b);
              if(!clear||!light(part))continue;
              choices.push({part,cost:Math.abs(part.length*CELL*CELL-14)});
            }
          choices.sort((a,b)=>a.cost-b.cost);let found=false;
          for(const {part} of choices){
            const id=F.rooms.length,removed=new Set(part),remaining=hall.filter(i=>!removed.has(i));
            if(!usable(remaining,HALL,remaining.filter(i=>wide.has(i)),true))continue;
            const left=new Set(remaining),q=[remaining[0]],seen=new Set(q);while(q.length){const i=q.pop(),x=i%w;for(const j of [x?i-1:-1,x<w-1?i+1:-1,i-w,i+w])if(left.has(j)&&!seen.has(j)){seen.add(j);q.push(j);}}if(seen.size!==left.size)continue;
            F.rooms.push({type:'bed',domestic:true});for(const i of part)F.grid[i]=id;
            const reach=placeDoors(plot,F,start()).reached;
            if(reach.has(id)&&[...oldReach].every(i=>reach.has(i))){found=true;break;}
            F.rooms.pop();for(const i of part)F.grid[i]=1;
          }
          if(!found)break;
        }
        for(let n=0;n<8&&cells(1).length*CELL*CELL>28;n++){
          const hall=cells(1),hs=new Set(hall),wide=new Set(),choices=[],oldReach=placeDoors(plot,F,start()).reached;
          for(const i of hall){const x=i%w,z=Math.floor(i/w),square=[];if(x+HALL>w||z+HALL>d)continue;for(let b=0;b<HALL;b++)for(let a=0;a<HALL;a++)square.push(i+a+w*b);if(square.every(j=>hs.has(j)))for(const j of square)wide.add(j);}
          for(let k=2;k<F.rooms.length;k++){
            const room=F.rooms[k],original=cells(k);if(!original.length||!['bed','guest','living','kitchen','dining','study','office'].includes(room.type))continue;
            const B=box(original);if(original.length!==(B[2]-B[0])*(B[3]-B[1]))continue;
            for(const side of [0,1,2,3])for(let width=1;width<=4;width++){
              const C=B.slice();C[side]+=side<2?-width:width;if(C[0]<0||C[1]<0||C[2]>w||C[3]>d)continue;
              const part=[];let clear=true;for(let z=C[1];z<C[3]&&clear;z++)for(let x=C[0];x<C[2];x++)if(at(x,z)!==k){const i=x+w*z;if(at(x,z)!==1||protectedCells.has(i)){clear=false;break;}part.push(i);}
              if(clear&&part.length&&valid(room.type,[...original,...part],true,room))choices.push({k,part});
            }
          }
          choices.sort((a,b)=>b.part.length-a.part.length);let found=false;
          for(const {k,part} of choices){const removed=new Set(part),remaining=hall.filter(i=>!removed.has(i));if(!usable(remaining,HALL,remaining.filter(i=>wide.has(i)),true))continue;
            const left=new Set(remaining),q=[remaining[0]],seen=new Set(q);while(q.length){const i=q.pop(),x=i%w;for(const j of [x?i-1:-1,x<w-1?i+1:-1,i-w,i+w])if(left.has(j)&&!seen.has(j)){seen.add(j);q.push(j);}}if(seen.size!==left.size)continue;
            for(const i of part)F.grid[i]=k;const reach=placeDoors(plot,F,start()).reached;if([...oldReach].every(j=>reach.has(j))){found=true;break;}for(const i of part)F.grid[i]=1;
          }
          if(!found)break;
        }
      };
    for(let pass=0;pass<64;pass++){
      const k=F.rooms.findIndex((r,k)=>budget(r.type,r).maxA&&cells(k).length*CELL*CELL>budget(r.type,r).maxA);if(k<0){reclaimHall();return true;}
      const room=F.rooms[k],original=cells(k),B=box(original),variants=[{base:original,hall:[]}],choices=[],before=F.grid.slice(),oldReach=placeDoors(plot,F,start()).reached;
      if(room.type==='store'&&plot.type!=='inn'&&!room.commercial&&!room.bulkStorage&&roomZone(plot.type,F.f,room)==='resident'&&original.length===(B[2]-B[0])*(B[3]-B[1])&&light(original)&&sharedRuns(plot,F.grid).some(r=>(r.a===k&&r.b===1||r.b===k&&r.a===1)&&r.cells.length>=DOOR)){
        room.type='bed';continue;
      }
      let trimmed=false;
      if(room.type==='store'&&!room.commercial&&!room.bulkStorage||['kitchen','living','dining'].includes(room.type))for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])for(let width=1;width<=2&&!trimmed;width++){
        const strip=original.filter(i=>{const x=i%w,z=Math.floor(i/w);return dx>0?x<B[0]+width:dx<0?x>=B[2]-width:dz>0?z<B[1]+width:z>=B[3]-width;}),ss=new Set(strip),keep=original.filter(i=>!ss.has(i));
        if(strip.length*CELL*CELL>8||!valid(room.type,keep,true,room))continue;
        const recipientType=j=>j>=2&&(['kitchen','living'].includes(F.rooms[j].type)||F.rooms[j].type==='store'&&roomZone(plot.type,F.f,F.rooms[j])==='service');
        const edge=strip.filter(i=>{const x=i%w,z=Math.floor(i/w);return [at(x-dx,z-dz),at(x+dx,z+dz)].some(recipientType);});
        if(edge.length<DOOR)continue;
        const target=at(edge[0]%w-dx,Math.floor(edge[0]/w)-dz)===k?at(edge[0]%w+dx,Math.floor(edge[0]/w)+dz):at(edge[0]%w-dx,Math.floor(edge[0]/w)-dz),recipient=cells(target),grown=[...recipient,...strip];
        if(!recipient.length||!recipientType(target)||!valid(F.rooms[target].type,grown,true,F.rooms[target]))continue;
        for(const i of strip)F.grid[i]=target;const reach=placeDoors(plot,F,start()).reached;
        if([...oldReach].every(j=>reach.has(j)))trimmed=true;else F.grid.set(before);
      }
      if(trimmed)continue;
      if(room.type==='store'&&!room.commercial&&!room.bulkStorage)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        if(trimmed)break;
        for(let width=1;width<Math.max(B[2]-B[0],B[3]-B[1])&&!trimmed;width++){
          const strip=original.filter(i=>{const x=i%w,z=Math.floor(i/w);return dx>0?x<B[0]+width:dx<0?x>=B[2]-width:dz>0?z<B[1]+width:z>=B[3]-width;}),ss=new Set(strip),keep=original.filter(i=>!ss.has(i));
          if(!strip.length||!valid('store',keep,true,room)||!usable([...cells(1),...strip],HALL,strip,true))continue;
          if(!strip.some(i=>{const x=i%w,z=Math.floor(i/w);return at(x-dx,z-dz)===1||at(x+dx,z+dz)===1;}))continue;
          for(const i of strip)F.grid[i]=1;const reach=placeDoors(plot,F,start()).reached;
          if(reach.has(k)&&[...oldReach].every(j=>reach.has(j)))trimmed=true;else F.grid.set(before);
        }
      }
      if(trimmed)continue;
      if(room.type==='store'&&!room.commercial&&!room.bulkStorage){
        const corners=[];
        for(let width=3;width<=6;width++)for(let depth=3;depth<=8;depth++)for(const right of [false,true])for(const back of [false,true]){
          const x0=right?B[2]-width:B[0],z0=back?B[3]-depth:B[1],keep=original.filter(i=>i%w>=x0&&i%w<x0+width&&Math.floor(i/w)>=z0&&Math.floor(i/w)<z0+depth);
          if(keep.length!==width*depth||!valid('store',keep,true,room))continue;
          const ks=new Set(keep),donated=original.filter(i=>!ks.has(i));corners.push({keep,donated,cost:Math.abs(keep.length*CELL*CELL-ARCHITECTURE.storage.domestic.preferred)});
        }
        corners.sort((a,b)=>a.cost-b.cost);
        for(const {donated} of corners){if(!usable([...cells(1),...donated],HALL,donated,true))continue;
          for(const i of donated)F.grid[i]=1;const reach=placeDoors(plot,F,start()).reached;
          if(reach.has(k)&&[...oldReach].every(j=>reach.has(j))){trimmed=true;break;}F.grid.set(before);
        }
      }
      if(trimmed)continue;
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])for(let width=1;width<=HALL&&!trimmed;width++){
        const edge=original.filter(i=>{const x=i%w,z=Math.floor(i/w);return dx>0?x===B[0]:dx<0?x===B[2]-1:dz>0?z===B[1]:z===B[3]-1;});
        if(edge.filter(i=>at(i%w-dx,Math.floor(i/w)-dz)===1).length<DOOR)continue;
        const strip=original.filter(i=>{const x=i%w,z=Math.floor(i/w);return dx>0?x<B[0]+width:dx<0?x>=B[2]-width:dz>0?z<B[1]+width:z>=B[3]-width;}),ss=new Set(strip),keep=original.filter(i=>!ss.has(i));
        if(strip.length*CELL*CELL>8||!valid(room.type,keep,true,room))continue;
        for(const i of strip)F.grid[i]=1;const reach=placeDoors(plot,F,start()).reached;
        if([...oldReach].every(k=>reach.has(k))&&usable(cells(1),Math.ceil((ARCHITECTURE.hallway.clear+CELL/2)/CELL),strip))trimmed=true;else F.grid.set(before);
      }
      if(trimmed)continue;
      if(ROOMS[room.type].leaf)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const hall=original.filter(i=>{const x=i%w,z=Math.floor(i/w);return dx>0?x<B[0]+HALL:dx<0?x>=B[2]-HALL:dz>0?z<B[1]+HALL:z>=B[3]-HALL;});
        if(hall.length>original.length*.5||!hall.some(i=>{const x=i%w,z=Math.floor(i/w);return [[x-1,z],[x+1,z],[x,z-1],[x,z+1]].some(([a,b])=>at(a,b)===1);}))continue;
        const hs=new Set(hall);variants.push({base:original.filter(i=>!hs.has(i)),hall});
      }
      for(const {base,hall} of variants){const BB=box(base),regions=base.length===(BB[2]-BB[0])*(BB[3]-BB[1])?[BB]:decompose(Uint8Array.from(F.grid,(_,i)=>base.includes(i)?1:0),w,d).map(([a,b,c,e])=>[a,b,c+1,e+1]);
      for(const region of regions)for(const axis of [0,1])for(let cut=region[axis]+3;cut<=region[axis+2];cut++)for(const flip of [false,true]){
        const part=base.filter(i=>{const x=i%w,z=Math.floor(i/w);return x>=region[0]&&z>=region[1]&&x<region[2]&&z<region[3]&&(((axis?z:x)<cut)===flip);}),ps=new Set(part),keep=base.filter(i=>!ps.has(i));
        if(!valid(room.type,keep,false,room))continue;
        for(const type of extra[room.type]||[]){if(type==='dining'&&!F.rooms.some((r,j)=>r.type==='kitchen'&&cells(j).length))continue;
          if(type==='store'&&roomZone(plot.type,F.f,room)==='resident'&&!room.bulkStorage&&(room.type==='store'||F.rooms.filter((r,j)=>r.type==='store'&&roomZone(plot.type,F.f,r)==='resident'&&cells(j).length).length>=2))continue;
          const C=child(type,room);if(type==='store'&&F.f===0&&ARCHITECTURE.mixedUse.includes(plot.type)&&part.filter(i=>{const x=i%w,z=Math.floor(i/w);return [[x-1,z],[x+1,z],[x,z-1],[x,z+1]].some(([a,b])=>['shop','workshop'].includes(F.rooms[at(a,b)]?.type));}).length>=DOOR){C.domestic=false;C.commercial=true;}
          const R=budget(room.type,room),S=budget(type,C);if(!valid(type,part,false,C))continue;const PB=box(part);if(part.length!==(PB[2]-PB[0])*(PB[3]-PB[1]))continue;
          const pa=part.length*CELL*CELL,ka=keep.length*CELL*CELL,storage=type==='store'?Math.max(0,pa-S.preferred)*4+12:type==='study'?10:type==='bed'?-10:0;
          choices.push({part,keep,hall,type,room:C,cost:(Math.max(0,ka-R.maxA)+Math.max(0,pa-S.maxA))*5+hall.length*.2+Math.abs(ka-(R.preferred||R.maxA*.8))+storage+(type==='dining'?Math.abs(pa-ARCHITECTURE.dining.preferred)*.5:0)+F.rooms.filter(r=>r.type===type).length*2});}
      }}
      choices.sort((a,b)=>a.cost-b.cost);let done=false;
      for(const c of choices){F.grid.set(before);for(const i of c.hall)F.grid[i]=1;const id=F.rooms.length;F.rooms.push(c.room);for(const i of c.part)F.grid[i]=id;
        const {reached:reach,doors}=placeDoors(plot,F,start());
        let localDining=true;
        if(c.type==='dining'){
          const draft={rooms:F.rooms.map((room,j)=>{const cs=cells(j),b=cs.length?box(cs):[0,0,0,0];return {...room,area:cs.length*CELL*CELL,box:[b[0],b[1],b[2]-1,b[3]-1]};})};
          localDining=!!diningKitchenRoute(draft,doors,id);
        }
        if(localDining&&reach.has(k)&&reach.has(id)&&[...oldReach].every(k=>reach.has(k))){done=true;break;}
        F.rooms.pop();
      }
      if(!done){F.grid.set(before);
        if(allowProgramme&&isBedroom(room.type)&&(F.f===0&&ARCHITECTURE.mixedUse.includes(plot.type)||F.rooms.some((r,j)=>j!==k&&isBedroom(r.type)&&cells(j).length*CELL*CELL>=ROOMS[r.type].minA))){
          const saved=F.rooms.map(r=>({...r}));room.type='living';
          if(refineRooms(plot,F,entrances,false))return true;
          F.grid.set(before);F.rooms=saved;
        }
        return false;}
    }return false;
  }

  function refineBaths(plot,F){
    const {w,d}=plot,mask=plot.masks[F.f],grid=F.grid,bounds=k=>{
      let x0=w,z0=d,x1=-1,z1=-1,n=0;
      for(let i=0;i<grid.length;i++)if(grid[i]===k){const x=i%w,z=Math.floor(i/w);x0=Math.min(x0,x);z0=Math.min(z0,z);x1=Math.max(x1,x);z1=Math.max(z1,z);n++;}
      return n?{x0,z0,x1:x1+1,z1:z1+1,n}:null;
    };
    const light=cs=>{const cells=new Set(cs.map(([x,z])=>x+w*z));return cs.some(([x,z])=>exteriorSides(plot,mask,x,z).some(e=>{
      if(e.party)return false;const [nx,nz]=e.side[0]==='x'?[x,z+1]:[x+1,z];
      return nx<w&&nz<d&&cells.has(nx+w*nz)&&exteriorSides(plot,mask,nx,nz).some(n=>n.side===e.side&&!n.party);
    }));};
    const valid=(type,cs,minWidth=ROOMS[type].minW)=>{const xs=cs.map(c=>c[0]),zs=cs.map(c=>c[1]),a=cs.length*CELL*CELL,
      bw=Math.max(...xs)-Math.min(...xs)+1,bd=Math.max(...zs)-Math.min(...zs)+1,R=ROOMS[type];
      return a>=R.minA&&Math.min(bw,bd)>=minWidth&&Math.max(bw,bd)/Math.min(bw,bd)<=ARCHITECTURE.rareAspect&&(!R.light||light(cs));};
    for(let bath=2;bath<F.rooms.length;bath++){
      if(F.rooms[bath].type!=='bath')continue;
      const B=bounds(bath);if(!B)continue;
      const asp=Math.max(B.x1-B.x0,B.z1-B.z0)/Math.min(B.x1-B.x0,B.z1-B.z0);
      if(B.n*CELL*CELL>=ROOMS.bath.minA&&B.n*CELL*CELL<=ARCHITECTURE.bath.preferred[1]&&asp<=ARCHITECTURE.rareAspect)continue;
      let best=null;
      for(let other=2;other<F.rooms.length;other++){
        if(other!==bath&&!['living','kitchen','dining','store'].includes(F.rooms[other].type))continue;
        const O=bounds(other);if(!O)continue;
        const x0=Math.min(B.x0,O.x0),z0=Math.min(B.z0,O.z0),x1=Math.max(B.x1,O.x1),z1=Math.max(B.z1,O.z1),owner=new Set([bath,other]);
        if((x1-x0)*(z1-z0)!==B.n+(other===bath?0:O.n))continue;
        let whole=true;for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++)if(!owner.has(grid[x+w*z]))whole=false;
        if(!whole)continue;
        for(const side of ['zm','zp','xm','xp']){
          const along=side[0]==='z'?x1-x0:z1-z0,depth=side[0]==='z'?z1-z0:x1-x0;
          if(along<8||depth<8)continue;
          const cell=(u,v)=>side==='zm'?[x0+u,z0+v]:side==='zp'?[x0+u,z1-1-v]:side==='xm'?[x0+v,z0+u]:[x1-1-v,z0+u];
          const [dx,dz]=DIRS.find(d=>d[2]===side);
          for(let lane=3;lane<=along-HALL-3;lane++){
            if(Array.from({length:HALL},(_,i)=>lane+i).some(u=>{const [x,z]=cell(u,0),nx=x+dx,nz=z+dz;return nx<0||nx>=w||nz<0||nz>=d||grid[nx+w*nz]!==1;}))continue;
            for(let near=4;near<=depth-4;near++){
              const bathCells=[],spareCells=[],mainCells=[],hallCells=[];
              for(let v=0;v<depth;v++)for(let u=0;u<along;u++){
                const c=cell(u,v);
                if(v>=near)mainCells.push(c);
                else if(u<lane)bathCells.push(c);
                else if(u>=lane+HALL)spareCells.push(c);
                else hallCells.push(c);
              }
              if(!valid('bath',bathCells,5)||bathCells.length*CELL*CELL>ARCHITECTURE.bath.preferred[1]||!valid(other===bath?'store':F.rooms[other].type,mainCells))continue;
              const bedrooms=F.rooms.filter(r=>['bed','guest'].includes(r.type)).length;
              const preferred=F.f>0&&bedrooms<2?(plot.type==='inn'?'guest':'bed'):'study';
              const spare=valid(preferred,spareCells)?preferred:'store';
              if(!valid(spare,spareCells))continue;
              const cost=Math.abs(bathCells.length*CELL*CELL-5)+
                Math.abs(Math.max(along,depth-near)/Math.min(along,depth-near)-1.5)*3+
                (spare==='store'?3:0)+(other===bath?2:0);
              if(!best||cost<best.cost)best={cost,bathCells,spareCells,mainCells,hallCells,spare,other};
            }
          }
        }
      }
      if(!best){
        if(B.n!==(B.x1-B.x0)*(B.z1-B.z0))continue;
        const spare=F.rooms.length;
        for(let bw=ROOMS.bath.minW;bw<=B.x1-B.x0;bw++)for(let bd=ROOMS.bath.minW;bd<=B.z1-B.z0;bd++){
          const area=bw*bd*CELL*CELL;if(area>ARCHITECTURE.bath.preferred[1])break;
          for(const x of [B.x0,B.x1-bw])for(const z of [B.z0,B.z1-bd]){
            const bathCells=[],spareCells=[],test=grid.slice();
            for(let b=B.z0;b<B.z1;b++)for(let a=B.x0;a<B.x1;a++){
              const inside=a>=x&&a<x+bw&&b>=z&&b<z+bd;(inside?bathCells:spareCells).push([a,b]);test[a+w*b]=inside?bath:spare;
            }
            if(!valid('bath',bathCells)||!spareCells.length)continue;
            const donations=[],strips=[];
            if(bw<B.x1-B.x0)strips.push({side:x===B.x0?'xp':'xm',cells:spareCells.filter(([a])=>a<x||a>=x+bw)});
            if(bd<B.z1-B.z0)strips.push({side:z===B.z0?'zp':'zm',cells:spareCells.filter(([a])=>a>=x&&a<x+bw)});
            for(const strip of strips){const [dx,dz]=DIRS.find(d=>d[2]===strip.side),owners=new Set(strip.cells.map(([a,b])=>{
              const nx=dx<0?B.x0-1:dx>0?B.x1:a,nz=dz<0?B.z0-1:dz>0?B.z1:b;return nx>=0&&nz>=0&&nx<w&&nz<d?grid[nx+w*nz]:-1;
            })),k=[...owners][0],room=F.rooms[k];
              if(owners.size!==1||!room||room.type==='stair'||room.type==='bath'||roomZone(plot.type,F.f,room)!=='resident')break;
              if(!ROOMS[room.type].circ){const O=bounds(k),xs=strip.cells.map(c=>c[0]),zs=strip.cells.map(c=>c[1]);
                if((Math.max(O.x1,...xs.map(a=>a+1))-Math.min(O.x0,...xs))*(Math.max(O.z1,...zs.map(b=>b+1))-Math.min(O.z0,...zs))!==O.n+strip.cells.length)break;
              }
              donations.push({cells:strip.cells,room:k});
            }
            if(donations.length===strips.length){const donated=grid.slice();for(const c of bathCells)donated[c[0]+w*c[1]]=bath;
              for(const d of donations)for(const c of d.cells)donated[c[0]+w*c[1]]=d.room;
              const entry=sharedRuns(plot,donated).some(r=>r.cells.length>=DOOR&&(r.a===bath||r.b===bath)&&ROOMS[F.rooms[r.a===bath?r.b:r.a].type].circ);
              const cost=Math.abs(area-6.25)-1;if(entry&&(!best||cost<best.cost))best={cost,bathCells,donations};
            }
            if(B.x1-B.x0-bw>0&&B.x1-B.x0-bw<DOOR||B.z1-B.z0-bd>0&&B.z1-B.z0-bd<DOOR||!valid('store',spareCells))continue;
            const entry=sharedRuns(plot,test).filter(r=>r.cells.length>=DOOR&&(r.a===spare||r.b===spare)).some(r=>{
              const k=r.a===spare?r.b:r.a,room=F.rooms[k];return k!==bath&&ROOMS[room.type].circ&&roomZone(plot.type,F.f,room)==='resident';
            });
            if(!entry)continue;
            const cost=Math.abs(area-6.25)+(spareCells.length===(B.x1-B.x0)*(B.z1-B.z0-bd)||spareCells.length===(B.x1-B.x0-bw)*(B.z1-B.z0)?0:2);
            if(!best||cost<best.cost)best={cost,bathCells,spareCells};
          }
        }
        if(best){
          if(!best.donations)F.rooms.push({type:'store',domestic:true,...(F.rooms[bath].extension?{extension:true}:{})});
          const changes=[[best.bathCells,bath],...(best.donations?best.donations.map(d=>[d.cells,d.room]):[[best.spareCells,spare]])];
          for(const [cs,k] of changes)for(const [x,z] of cs)grid[x+w*z]=k;
        }
        continue;
      }
      const extra=F.rooms.length;F.rooms.push({type:best.spare,domestic:true});
      const main=best.other===bath?F.rooms.length:best.other;if(best.other===bath)F.rooms.push({type:'store'});
      for(const [cs,k] of [[best.bathCells,bath],[best.spareCells,extra],[best.mainCells,main],[best.hallCells,1]])
        for(const [x,z] of cs)grid[x+w*z]=k;
    }
  }
  function recessPrivateArrival(plot,F,entrances){
    if(!ARCHITECTURE.mixedUse.includes(plot.type))return false;
    const {w,d}=plot,mask=plot.masks[0],street=Math.min(...[...mask.keys()].filter(i=>mask[i]).map(i=>Math.floor(i/w))),
      entrance=entrances.find(e=>e.floor===0&&e.room===1&&e.side==='zm'&&e.at!==undefined);
    if(!entrance)return false;
    const x=entrance.at,protectedCells=new Set([...F.steps,...F.voids]);
    for(const o of F.open){const [dx,dz]=DIRS.find(d=>d[2]===o.dir);for(const [a,b] of o.cells){protectedCells.add(a+w*b);protectedCells.add(a-dx+w*(b-dz));}}
    const components=removed=>{const seen=new Set();let n=0;
      for(let i=0;i<F.grid.length;i++)if(F.grid[i]===1&&!removed.has(i)&&!seen.has(i)){n++;const q=[i];seen.add(i);
        for(let j=0;j<q.length;j++){const a=q[j]%w,b=Math.floor(q[j]/w);for(const [dx,dz] of DIRS){const nx=a+dx,nz=b+dz,k=nx+w*nz;
          if(nx>=0&&nx<w&&nz>=0&&nz<d&&F.grid[k]===1&&!removed.has(k)&&!seen.has(k)){seen.add(k);q.push(k);}}}}
      return n;},before=components(new Set());
    for(const depth of [2,1]){
      if(street+depth>=d||Array.from({length:HALL},(_,i)=>x+i).some(a=>F.grid[a+w*(street+depth)]!==1))continue;
      const removed=new Set();for(let z=street;z<street+depth;z++)for(let a=x;a<x+HALL;a++)removed.add(a+w*z);
      if([...removed].some(i=>F.grid[i]!==1||protectedCells.has(i))||components(removed)>before)continue;
      for(const i of removed){F.grid[i]=-1;mask[i]=0;}
      entrance.row=street+depth;entrance.recess={depth,width:HALL,mouth:Array.from({length:HALL},(_,i)=>[x+i,street])};
      for(let i=entrances.length-1;i>=0;i--)if(entrances[i]!==entrance&&entrances[i].room===1)entrances.splice(i,1);
      return true;
    }
    return false;
  }
  function roomDepths(plot,F){const bounds=F.rooms.map(r=>({...r,box:[0,Infinity,0,-Infinity]}));
    for(let i=0;i<F.grid.length;i++){const k=F.grid[i];if(k<0)continue;const z=Math.floor(i/plot.w);bounds[k].box[1]=Math.min(bounds[k].box[1],z);bounds[k].box[3]=Math.max(bounds[k].box[3],z);}return bounds;
  }
  function shopDoorAtRear(room,o){if(room.type!=='shop')return true;if(!room.box||!o.cells?.length)return false;
    const side=o.side||o.dir,z=side[0]==='z'?o.cells[0][1]+(side==='zp'?1:0):o.cells.reduce((a,c)=>a+c[1]+.5,0)/o.cells.length;
    return z>=room.box[1]+(room.box[3]-room.box[1]+1)*ARCHITECTURE.shop.rearDoorStart;
  }
  function shopDoorRun(run,room){if(room.type!=='shop')return run;let best=null;
    const ideal=room.box[1]+(room.box[3]-room.box[1]+1)*.8;
    for(let start=0;start+DOOR<=run.cells.length;start++){const cells=run.cells.slice(start,start+DOOR);if(!shopDoorAtRear(room,{...run,cells}))continue;
      const z=cells.reduce((a,c)=>a+c[1]+.5,0)/DOOR,cost=Math.abs(z-ideal)*10+Math.abs(start-(run.cells.length-DOOR)/2);
      if(!best||cost<best.cost)best={start,cost};
    }return best?{...run,doorStart:best.start}:null;
  }
  function doorOn(run,rooms){const types=[rooms[run.a].type,rooms[run.b].type],n=run.cells.length;
    const start=run.doorStart??(types.includes('hall')||n<=DOOR+1?Math.floor((n-DOOR)/2):types.some(t=>ROOMS[t].circ)?1:n-DOOR-1);
    return {a:run.a,b:run.b,dir:run.dir,cells:run.cells.slice(start,start+DOOR),kind:'door'};}

  function runsOf(cells){const out=[];for(const c of cells){const cur=out.at(-1);if(cur&&Math.abs(c[0]-cur.at(-1)[0])+Math.abs(c[1]-cur.at(-1)[1])===1)cur.push(c);else out.push([c]);}return out;}
  // A wall is a party wall (shared with a neighbour: no windows, no doors) when the cell beyond it is outside the
  // lot and that lot line is shared: never the street; on rectangular plots the sides per street context; on shaped
  // lots every non-street lot line except the open side of a corner plot, and none on a detached plot. A wall facing
  // the building's own yard is never a party wall.
  function isPartyEdge(plot,x,z,s){const [dx,dz]={xm:[-1,0],xp:[1,0],zm:[0,-1],zp:[0,1]}[s],nx=x+dx,nz=z+dz;
    if(nz<plot.front)return false;
    const inGrid=nx>=0&&nz>=0&&nx<plot.w&&nz<plot.d;
    if(!plot.lot)return !inGrid&&((s==='xm'&&plot.party[0])||(s==='xp'&&plot.party[1]));
    if(inGrid&&plot.lot.mask[nx+plot.w*nz])return false;
    if(plot.context==='detached')return false;
    return s==='xm'?plot.party[0]:s==='xp'?plot.party[1]:true;}
  function exteriorSides(plot,mask,x,z){
    const out=[];for(const [dx,dz,s] of DIRS){const nx=x+dx,nz=z+dz,inside=nx>=0&&nz>=0&&nx<plot.w&&nz<plot.d&&mask[nx+plot.w*nz];
      if(inside)continue;out.push({side:s,party:isPartyEdge(plot,x,z,s)});}
    return out;
  }
  function exteriorAccess(plot){
    const {w,d,front,party,lot}=plot,mask=plot.masks[0],W=w+2,D=d+2,cells=new Uint8Array(W*D);
    for(let z=-1;z<=d;z++)for(let x=-1;x<=w;x++){
      const inside=x>=0&&z>=0&&x<w&&z<d,i=x+w*z;
      if(z<front||inside&&!mask[i]&&(!lot||lot.mask[i])||!lot&&(x===-1&&!party[0]||x===w&&!party[1]||z===d))cells[x+1+W*(z+1)]=1;
    }
    const blocked=(x,z)=>z>=front&&(x>=0&&z>=0&&x<w&&z<d&&!!mask[x+w*z]||!!lot&&(x<0||z<0||x>=w||z>=d||!lot.mask[x+w*z]));
    for(let z=front;z<=d;z++)for(let x=-1;x<=w;x++)if(blocked(x-1,z)&&blocked(x+1,z)||blocked(x,z-1)&&blocked(x,z+1))cells[x+1+W*(z+1)]=0;
    return {w:W,d:D,cells,contains:(x,z)=>x>=-1&&z>=-1&&x<=w&&z<=d&&!!cells[x+1+W*(z+1)]};
  }
  function serviceYardRoutes(plot,openings){
    const area=exteriorAccess(plot),{w:W,d:D,cells}=area,component=new Int32Array(cells.length).fill(-1),groups=[];
    for(let i=0;i<cells.length;i++)if(cells[i]&&component[i]<0){const n=groups.length,q=[i];component[i]=n;
      for(let j=0;j<q.length;j++){const a=q[j],x=a%W,z=Math.floor(a/W);for(const [dx,dz] of DIRS){const nx=x+dx,nz=z+dz,b=nx+W*nz;
        if(nx>=0&&nz>=0&&nx<W&&nz<D&&cells[b]&&component[b]<0){component[b]=n;q.push(b);}}}groups.push(q);}
    const doors=openings.filter(o=>['front','back'].includes(o.kind)).map(o=>{
      const [dx,dz]=DIRS.find(d=>d[2]===o.side),outside=o.cells.filter(([x,z])=>area.contains(x+dx,z+dz)).map(([x,z])=>x+dx+1+W*(z+dz+1));
      return {o,outside:outside.filter(i=>i>=0&&i<component.length&&component[i]>=0)};
    }),routes=[];
    for(let a=0;a<doors.length;a++)for(let b=a+1;b<doors.length;b++){
      if(doors[a].o.room===doors[b].o.room)continue;
      const start=doors[a].outside.find(i=>doors[b].outside.some(j=>component[j]===component[i]));if(start===undefined)continue;
      const goals=new Set(doors[b].outside),prev=new Map([[start,null]]),q=[start];let end=null;
      for(let i=0;i<q.length;i++){const n=q[i];if(goals.has(n)){end=n;break;}const x=n%W,z=Math.floor(n/W);
        for(const [dx,dz] of DIRS){const nx=x+dx,nz=z+dz,j=nx+W*nz;if(nx>=0&&nz>=0&&nx<W&&nz<D&&cells[j]&&!prev.has(j)){prev.set(j,n);q.push(j);}}}
      if(end!==null){const path=[];for(let n=end;n!==null;n=prev.get(n))path.push([n%W-1,Math.floor(n/W)-1]);
        routes.push({a:doors[a].o.room,b:doors[b].o.room,cells:path.reverse()});}
    }
    return routes;
  }
  function serviceReach(plot,F,doors,openings,starts){
    const root=F.rooms.findIndex(r=>['shop','workshop'].includes(r.type)&&!r.extension),seen=new Set(starts??(root<0?[]:[root])),links=[
      ...doors.filter(d=>(d.roles||doorRoles(F.rooms[d.a],F.rooms[d.b])).includes('employee')),
      ...serviceYardRoutes(plot,openings).filter(r=>F.rooms[r.a].zone!=='resident'&&F.rooms[r.b].zone!=='resident')];
    for(let change=true;change;){change=false;for(const {a,b} of links)if(seen.has(a)!==seen.has(b)){seen.add(a);seen.add(b);change=true;}}
    return seen;
  }
  function redundantExteriorDoors(plot,F,doors,openings){
    if(!openings.some(o=>o.kind==='back'))return [];
    const isDoor=o=>o.kind==='front'||o.kind==='back',sources=os=>os.filter(o=>isDoor(o)&&F.rooms[o.room].zone!=='resident').map(o=>o.room),
      access=serviceReach(plot,F,doors,openings,sources(openings)),supply=serviceReach(plot,F,doors,openings);
    return openings.filter(o=>{
      if(o.kind!=='back')return false;
      if(openings.some(p=>p.kind==='front'&&p.room===o.room&&o.side!==OPP[p.side]))return true;
      if(F.rooms[o.room].zone==='resident')return false;
      const remaining=openings.filter(p=>p!==o),nextAccess=serviceReach(plot,F,doors,remaining,sources(remaining)),nextSupply=serviceReach(plot,F,doors,remaining);
      return [...access].every(k=>nextAccess.has(k))&&[...supply].every(k=>nextSupply.has(k));
    });
  }
  function facadeSpans(plot,f,bays){
    const {w,d}=plot,m=plot.masks[f],inside=(x,z)=>x>=0&&z>=0&&x<w&&z<d&&m[x+w*z],edges=new Map();
    for(let z=0;z<d;z++)for(let x=0;x<w;x++)if(inside(x,z))for(const [dx,dz,side] of DIRS)if(!inside(x+dx,z+dz)){
      const along=side[0]==='z'?x:z,fixed=side[0]==='z'?z:x,key=side+':'+fixed;
      if(!edges.has(key))edges.set(key,{side,fixed,coords:[]});edges.get(key).coords.push(along);
    }
    const spans=[];for(const {side,fixed,coords} of edges.values()){
      coords.sort((a,b)=>a-b);for(let i=0;i<coords.length;){const start=coords[i];let end=start+1;while(++i<coords.length&&coords[i]===end)end++;
        const phase=bays?.[side]??gridPhase(side[0]==='z'?w:d),posts=[start];
        for(let p=start+2;p<=end-2;p++)if(((p-phase-3)%4+4)%4===0)posts.push(p);
        posts.push(end);spans.push({side,fixed,start,end,posts});
      }
    }return spans;
  }
  // Exterior openings: front doors from the typology (the home's own door, the business door), a back door from the
  // kitchen, and windows spaced along each room's outside walls (none on party walls). Shops get a shopfront.
  function exteriorDoorsConflict(a,b){
    const edge=o=>{const xs=o.cells.map(c=>c[0]),zs=o.cells.map(c=>c[1]),x0=Math.min(...xs),z0=Math.min(...zs),x1=Math.max(...xs)+1,z1=Math.max(...zs)+1;
      return o.side==='xm'?[x0,z0,x0,z1]:o.side==='xp'?[x1,z0,x1,z1]:o.side==='zm'?[x0,z0,x1,z0]:[x0,z1,x1,z1];},A=edge(a),B=edge(b);
    return Math.hypot(Math.max(0,A[0]-B[2],B[0]-A[2]),Math.max(0,A[1]-B[3],B[1]-A[3]))<1;
  }
  function placeOpenings(plot,F,entrances,reached,doors=[]){
    const {grid,rooms,f}=F,{w,d}=plot,mask=plot.masks[f],edges=new Map(),bounds=roomDepths(plot,F);
    for(let z=0;z<d;z++)for(let x=0;x<w;x++){const g=grid[x+w*z];if(g<1)continue;
      for(const e of exteriorSides(plot,mask,x,z)){if(e.party)continue;const key=`${g}-${e.side}-${e.side[0]==='x'?x:z}`;if(!edges.has(key))edges.set(key,{room:g,side:e.side,cells:[]});edges.get(key).cells.push([x,z]);}}
    const lines=[];for(const e of edges.values()){e.cells.sort((p,q)=>p[0]-q[0]||p[1]-q[1]);for(const run of runsOf(e.cells))lines.push({room:e.room,side:e.side,cells:run});}
    const openings=[],street='zm',taken=new Set(),isDoor=o=>o.kind==='front'||o.kind==='back',
      fitsDoor=o=>o.cells.every(c=>!taken.has(o.side+c.join(',')))&&!openings.some(p=>isDoor(p)&&(exteriorDoorsConflict(p,o)||o.kind==='back'&&p.kind==='front'&&p.room===o.room&&o.side!==OPP[p.side])),
      take=o=>{if(o.cells.some(c=>taken.has(o.side+c.join(',')))||isDoor(o)&&!fitsDoor(o))return false;openings.push(o);for(const c of o.cells)taken.add(o.side+c.join(','));return true;},
      yardAccess=exteriorAccess(plot),backDoor=(line,preferred=0,roles)=>{const starts=Array.from({length:Math.max(0,line.cells.length-DOOR+1)},(_,i)=>i).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)),[dx,dz]=DIRS.find(d=>d[2]===line.side);
        for(const s of starts){const o={room:line.room,side:line.side,cells:line.cells.slice(s,s+DOOR),kind:'back',...(roles?{roles}:{})};if(fitsDoor(o)&&shopDoorAtRear(bounds[o.room],o)&&(!plot.lot||o.cells.every(([x,z])=>yardAccess.contains(x+dx,z+dz)&&yardAccess.contains(x+dx*2,z+dz*2))))return o;}return null;};
    if(f===0){
      // a street door is on the street row itself (not a back tower's wall that happens to face the same way)
      const streetRow=Math.min(...[...mask.keys()].filter(i=>mask[i]).map(i=>Math.floor(i/w)));
      const arrivals=entrances.slice().sort((a,b)=>(rooms[b.room]?.zone==='resident')-(rooms[a.room]?.zone==='resident'));
      for(const en of arrivals){if(en.room<0)continue;const l=lines.filter(l=>l.room===en.room&&l.side===en.side&&l.cells.length>=DOOR&&(en.side!=='zm'||l.cells[0][1]===(en.row??streetRow))).sort((a,b)=>b.cells.length-a.cells.length)[0];if(!l)continue;
        const n=l.cells.length,type=rooms[en.room].type,free=l.cells.map((c,i)=>i).filter(i=>i+DOOR<=n&&fitsDoor({side:l.side,cells:l.cells.slice(i,i+DOOR)}));if(!free.length)continue;
        // a business door goes to the end of its frontage away from the home's door, so the two entrances are
        // apart and the shopfront runs between them
        let s=free[Math.floor(free.length/2)];if(['shop','workshop'].includes(type)){const home=openings.find(o=>o.kind==='front'&&rooms[o.room].zone==='resident');const ref=home?(home.cells[0][0]+home.cells.at(-1)[0])/2:w/2;s=free.sort((a,b)=>Math.abs(l.cells[b][0]+(DOOR-1)/2-ref)-Math.abs(l.cells[a][0]+(DOOR-1)/2-ref))[0];}
        if(en.at!==undefined&&type==='hall'){const near=free.filter(i=>l.cells[i][0]===en.at);if(near.length)s=near[0];}
        take({room:en.room,side:l.side,cells:l.cells.slice(s,s+DOOR),kind:'front',...(en.recess?{recess:en.recess}:{})});}
      const kit=rooms.findIndex(r=>r.type==='kitchen'),back=lines.filter(l=>l.room===kit&&l.side!==street&&l.cells.length>=DOOR+2).sort((a,b)=>(b.side==='zp')-(a.side==='zp')||b.cells.length-a.cells.length);
      // an extension the house does not reach inside opens onto the yard
      if(reached)rooms.forEach((rm,k)=>{if(k<2||reached.has(k)||!rm.cells&&!grid.includes(k)||openings.some(o=>o.room===k&&isDoor(o)))return;const yl=lines.filter(l=>l.room===k&&(l.side!==street||rm.extension)&&l.cells.length>=DOOR)
        .map(l=>shopDoorRun(l,bounds[k])).filter(Boolean).sort((a,b)=>(a.side===street)-(b.side===street)||b.cells.length-a.cells.length);
        for(const l of yl){const o=backDoor(l,l.doorStart??Math.floor((l.cells.length-DOOR)/2));if(o){take(o);break;}}});
      const garden=back.filter(l=>l.cells.length>=DOOR+4||lines.some(q=>q.room===kit&&q!==l&&q.cells.length>=4)).map(l=>{const n=l.cells.length,s=n>=DOOR+3?n-DOOR-1:n-DOOR;return backDoor(l,s);}).find(Boolean);
      if(garden){if(!openings.some(o=>o.room===kit&&o.kind==='back'))take(garden);}
      else{const hb=lines.filter(l=>l.room===1&&l.side==='zp'&&l.cells.length>=DOOR).map(l=>backDoor(l)).find(Boolean);if(hb)take(hb);}}
    if(f===0&&ARCHITECTURE.mixedUse.includes(plot.type)){
      const yard=exteriorAccess(plot);
      for(let k=2;k<rooms.length;k++){
        const starts=openings.filter(o=>isDoor(o)&&rooms[o.room].zone!=='resident').map(o=>o.room);
        if(!['service','public'].includes(rooms[k].zone)||serviceReach(plot,F,doors,openings,starts).has(k))continue;
        const choices=[];
        for(const l of lines.filter(l=>l.room===k&&l.side!==street)){const [dx,dz]=DIRS.find(d=>d[2]===l.side);
          const free=l.cells.filter(([x,z])=>!taken.has(l.side+[x,z].join(','))&&yard.contains(x+dx,z+dz)&&yard.contains(x+dx*2,z+dz*2));
          for(const run of runsOf(free))if(run.length>=(ROOMS[rooms[k].type].light?DOOR+2:DOOR)){const candidate=shopDoorRun({...l,cells:run},bounds[k]);if(candidate){const o=backDoor(candidate,candidate.doorStart??0,['employee']);if(o)choices.push({...candidate,opening:o});}}}
        choices.sort((a,b)=>b.cells.length-a.cells.length);
        if(choices.length)take(choices[0].opening);
      }
      for(let pass=0;pass<rooms.length;pass++){
        const accessible=serviceReach(plot,F,doors,openings);let best=null;
        for(let k=2;k<rooms.length;k++)if(['service','public'].includes(rooms[k].zone)){
          for(const l of lines.filter(l=>l.room===k&&l.side!==street)){
            const [dx,dz]=DIRS.find(d=>d[2]===l.side),free=l.cells.filter(([x,z])=>!taken.has(l.side+[x,z].join(','))&&yard.contains(x+dx,z+dz)&&yard.contains(x+dx*2,z+dz*2));
            for(const run of runsOf(free))if(run.length>=(ROOMS[rooms[k].type].light?DOOR+2:DOOR)){
              const o=backDoor({...l,cells:run},0,['employee']);if(!o)continue;const gain=serviceReach(plot,F,doors,[...openings,o]).size-accessible.size;
              if(gain>0&&(!best||gain>best.gain))best={o,gain};
            }
          }
        }
        if(!best)break;take(best.o);
      }
    }
    for(let redundant;(redundant=redundantExteriorDoors(plot,F,doors,openings)[0]);){
      openings.splice(openings.indexOf(redundant),1);for(const c of redundant.cells)taken.delete(redundant.side+c.join(','));
    }
    const spans=facadeSpans(plot,f,plot.facadeBays),alcove=new Set();if(f===0)for(const en of entrances)if(en.recess)for(const [x,z] of en.recess.mouth)for(let v=0;v<en.recess.depth;v++)alcove.add(x+w*(z+v));
    for(const l of lines){const type=rooms[l.room].type;if(type==='hall'&&l.cells.length<3)continue;
      const [dx,dz]=DIRS.find(d=>d[2]===l.side),free=l.cells.filter(([x,z])=>!taken.has(l.side+[x,z].join(','))&&!alcove.has(x+dx+w*(z+dz)));
      if(f===0&&l.side===street&&l.cells[0][1]===Math.min(...[...mask.keys()].filter(i=>mask[i]).map(i=>Math.floor(i/w)))&&['shop','workshop','common'].includes(type)){for(const run of runsOf(free))if(run.length>=2)take({room:l.room,side:l.side,cells:run.slice(0,run.length-(run.length>5?1:0)),kind:type==='common'?'bay':'shopfront'});continue;}
      const small=type==='bath'||type==='store'||type==='hall',alongX=l.side[0]==='z',coord=c=>alongX?c[0]:c[1],
        fixed=alongX?l.cells[0][1]:l.cells[0][0],wall=spans.find(s=>s.side===l.side&&s.fixed===fixed&&coord(l.cells[0])>=s.start&&coord(l.cells[0])<s.end),
        here=()=>openings.some(o=>o.room===l.room&&o.kind!=='front'&&o.kind!=='back');let first=true;
      const clear=cells=>cells.every(([x,z])=>{for(let n=1;n<=3;n++){const xx=x+dx*n,zz=z+dz*n;if(xx>=0&&zz>=0&&xx<w&&zz<d&&mask[xx+w*zz])return false;}return true;});
      for(const run of runsOf(free).sort((a,b)=>b.length-a.length)){
        const slots=[];for(let j=1;j<wall.posts.length;j++){
          const centre=(wall.posts[j-1]+wall.posts[j])/2,start=Math.floor(centre-1),end=Math.ceil(centre+1),cells=run.filter(c=>coord(c)>=start&&coord(c)<end);
          if(cells.length===end-start&&start>=wall.start+1&&end<=wall.end-1&&clear(cells))slots.push(cells);
        }
        const selected=small?(slots.length&&!here()?[slots.sort((a,b)=>Math.abs(coord(a[0])+a.length/2-(coord(run[0])+run.length/2))-Math.abs(coord(b[0])+b.length/2-(coord(run[0])+run.length/2)))[0]]:[]):slots;
        for(let cells of selected){let deck;
          if(!small&&l.side===street&&f>0&&type==='living'&&first){const centre=coord(cells[0])+cells.length/2,start=Math.floor(centre-1.5),end=Math.ceil(centre+1.5),wide=run.filter(c=>coord(c)>=start&&coord(c)<end);
            if(wide.length===end-start&&start>=wall.start+1&&end<=wall.end-1&&clear(wide)&&wide.every(c=>!taken.has(l.side+c.join(',')))){
              cells=wide;deck={start:Math.max(wall.start+1,start-1),end:Math.min(wall.end-1,end+1),depth:3};
            }
          }
          take({room:l.room,side:l.side,cells,kind:deck?'balcony':small?'small':'window',...(deck?{deck}:{})});first=false;
        }
      }
      if(!here()&&ROOMS[type].light){const run=runsOf(free.filter(c=>coord(c)>=wall.start+1&&coord(c)<wall.end-1)).sort((a,b)=>b.length-a.length)[0];
        if(run&&run.length>=2){const width=run.length%2?3:2,i=Math.floor((run.length-width)/2),cells=run.slice(i,i+width);if(clear(cells))take({room:l.room,side:l.side,cells,kind:'window',offBay:true});}}
    }
    return openings;
  }

  // Score: lower is better. Hard failures (unreachable, windowless or misshapen rooms) are listed in notes.
  function scoreFloor(plot,F,reached,openings){
    const {rooms,grid}=F,{w}=plot,notes=[];let s=0;
    rooms.forEach((room,k)=>{let x0=1e9,z0=1e9,x1=-1,z1=-1,n=0;for(let i=0;i<grid.length;i++)if(grid[i]===k){const x=i%w,z=Math.floor(i/w);n++;x0=Math.min(x0,x);z0=Math.min(z0,z);x1=Math.max(x1,x);z1=Math.max(z1,z);}
      room.cells=n;room.box=n?[x0,z0,x1,z1]:null;if(k<2||!n)return;const R=ROOMS[room.type],bw=x1-x0+1,bd=z1-z0+1,a=n*CELL*CELL,minW=Math.min(bw,bd);
      if(minW<R.minW)s+=(R.minW-minW)*15;if(a<R.minA)s+=(R.minA-a)*6;const asp=Math.max(bw,bd)/minW;
      if(['study','bath','dining'].includes(room.type)&&(a<R.minA||minW<R.minW)){s+=500;notes.push(room.type+' below minimum usable size');}
      if(room.type!=='hall')s+=Math.max(0,asp-ARCHITECTURE.preferredAspect)*3+Math.max(0,asp-ARCHITECTURE.rareAspect)*18;
      if(room.type==='bath')s+=Math.max(0,a-ARCHITECTURE.bath.preferred[1])*8+Math.max(0,a-ARCHITECTURE.bath.large)*20;
      if(n<bw*bd&&!R.circ&&!room.annex){s+=300;notes.push(room.type+' not rectangular');}
      if(!reached.has(k)&&!openings.some(o=>o.room===k&&(o.kind==='back'||o.kind==='front'))){s+=500;notes.push(room.type+' unreachable');}
      if(R.light&&!openings.some(o=>o.room===k&&o.kind!=='front'&&o.kind!=='back')){s+=200;notes.push(room.type+' windowless');}});
    if(rooms[0].cells&&!reached.has(0)){s+=500;notes.push('stair unreachable');}
    const hallCells=rooms[1].cells||0,total=rooms.reduce((n,r)=>n+(r.cells||0),0);if(hallCells&&rooms.length>2)s+=Math.max(0,hallCells*CELL*CELL-14)*.8+Math.max(0,hallCells-total*.25)*2;
    return {score:s,notes};
  }
  function finishFloor(plot,F,entrances,start){
    const compose=()=>{const {doors,reached}=placeDoors(plot,F,start),openings=placeOpenings(plot,F,entrances,F.f===0?reached:null,doors),result={F,doors,openings,...scoreFloor(plot,F,reached,openings)};
      for(let k=2;k<F.rooms.length;k++){const room=F.rooms[k];if(!room.cells)continue;
        if(room.type==='dining'&&!diningKitchenRoute(F,doors,k)){result.notes.push('dining needs a nearby same-floor kitchen');result.score+=500;}
        if(room.type==='study'&&!roomPath(F,doors,start,(_,j)=>j===k,['store'])){result.notes.push('study access passes through storage');result.score+=500;}
      }return result;},
      fits=(room,type)=>{const R=roomBudget(plot.type,F.f,{...room,type}),b=room.box;return b&&room.cells*CELL*CELL>=R.minA&&room.cells*CELL*CELL<=R.maxA&&Math.min(b[2]-b[0]+1,b[3]-b[1]+1)>=R.minW;};
    let result=compose();
    for(let pass=0;pass<F.rooms.length;pass++){
      let repaired=false;
      for(let k=2;k<F.rooms.length&&!repaired;k++){const A=F.rooms[k];if(!A.cells||!ROOMS[A.type].light||result.openings.some(o=>o.room===k&&o.kind!=='front'&&o.kind!=='back'))continue;
        for(let j=2;j<F.rooms.length;j++){const B=F.rooms[j];if(!B.cells||ROOMS[B.type].light||A.zone!==B.zone||!fits(A,B.type)||!fits(B,A.type))continue;
          const type=A.type;A.type=B.type;B.type=type;const next=compose();
          if(next.notes.length<result.notes.length){result=next;repaired=true;break;}
          B.type=A.type;A.type=type;
        }
      }if(!repaired)break;
    }
    for(let pass=0;pass<3&&result.notes.some(n=>n.includes('dining')||n.includes('study'));pass++){
      let repaired=false;
      const dining=F.rooms.flatMap((r,k)=>r.type==='dining'&&r.cells?[k]:[]),served=dining.filter(k=>diningKitchenRoute(F,result.doors,k));
      for(const k of dining){const A=F.rooms[k];if(served.includes(k)||!served.length||!fits(A,'living'))continue;
        A.type='living';const next=compose();if(next.notes.length<result.notes.length){result=next;repaired=true;break;}A.type='dining';
      }
      for(let k=2;k<F.rooms.length&&!repaired;k++){const A=F.rooms[k];if(!A.cells||!['dining','kitchen','study'].includes(A.type))continue;
        for(let j=2;j<F.rooms.length;j++){const B=F.rooms[j];if(j===k||!B.cells||A.type===B.type||A.zone!==B.zone||!['living','dining','kitchen','study','office','store'].includes(B.type)||!fits(A,B.type)||!fits(B,A.type))continue;
          const type=A.type;A.type=B.type;B.type=type;const next=compose();
          if(next.notes.length<result.notes.length){result=next;repaired=true;break;}
          B.type=A.type;A.type=type;
        }
      }if(!repaired)break;
    }
    return result;
  }

  // Styles: everything visual the voxel stage needs, as a distribution. Each building samples its own facade and roof
  // (plan.facade, plan.roof) from its style, so a district shares a look without every house being the same.
  // Lists are choices; {name: weight} tables are weighted choices; [lo, hi] pairs are ranges.
  const STYLES={
    machiya:{label:'Lantern-street machiya',lattice:true,jettyOk:false,
      walls:['plaster_warm','plaster_cream','plaster_ochre','plaster_white'],timbers:{timber_dark:3,timber_brown:1},trims:{default:['timber_dark']},bases:['stone_grey','stone_white'],
      roofMats:{tile_charcoal:3,slate:1},noren:['cloth_indigo','cloth_white','cloth_coral'],
      roofForms:{gable:3,hip:1},ridges:{frontage:1},pitch:[.4,.55],eave:[3,3],curve:[.25,.45],crossGable:0,dormers:0,turret:0,oriels:0,
      frames:{posts:3,grid:1},windows:{rect:3,tall:1},groundWindows:{rect:1},glazing:{lattice:1},shutters:0,boxes:0,groundBoards:.85,canopy:0},
    harbour:{label:'Harbour white & blue',lattice:false,jettyOk:true,
      walls:['plaster_white','plaster_sky','plaster_mint','plaster_cream','plaster_rose'],timbers:{timber_honey:2,timber_grey:1},
      trims:{plaster_white:['paint_blue','paint_green','timber_honey'],default:['paint_white','paint_white','paint_blue']},bases:['stone_sand','stone_white'],
      roofMats:{tile_blue:3,tile_red:1,slate:1},noren:['cloth_coral','cloth_indigo','cloth_green'],
      roofForms:{hip:2,gable:1,halfhip:1,gambrel:1},ridges:{depth:1,frontage:1},pitch:[.45,.6],eave:[2,3],curve:[.1,.25],crossGable:.35,dormers:.45,turret:.3,oriels:.3,
      frames:{posts:2,none:2},windows:{rect:2,tall:1,arched:1},groundWindows:{rect:2,arched:1},glazing:{mullion:2,grid:1},
      shutters:.75,shutterColors:['tile_blue','paint_green','paint_red','paint_blue'],boxes:.7,groundBoards:0,canopy:.7},
    fairytale:{label:'Storybook half-timber',lattice:false,jettyOk:true,
      walls:['plaster_cream','plaster_ochre','plaster_rose','plaster_sage','plaster_white'],timbers:{timber_brown:3,timber_dark:2},trims:{default:['=timber']},bases:['stone_grey','brick_red','stone_white'],
      roofMats:{tile_red:3,shingle:2,slate:1,tile_purple:1},noren:['cloth_green','cloth_coral','cloth_indigo'],
      roofForms:{gable:3,hip:1,halfhip:2,gambrel:1},ridges:{depth:2,frontage:2},pitch:[.9,1.2],eave:[2,3],curve:[0,0],crossGable:.45,dormers:.5,turret:.5,oriels:.45,
      frames:{braced:3,cross:2,grid:1},windows:{rect:2,paired:1,arched:1},groundWindows:{rect:2,paired:1},glazing:{grid:2,mullion:1},
      shutters:.3,shutterColors:['paint_green','paint_red','timber_brown'],boxes:.8,groundBoards:0,canopy:.8},
    spire:{label:'Sky-temple lacquer',lattice:true,jettyOk:false,
      walls:['plaster_peach','plaster_white','plaster_rose','plaster_lavender'],timbers:{lacquer_red:3,timber_dark:1},trims:{default:['=timber']},bases:['stone_sand','stone_white'],
      roofMats:{tile_teal:3,tile_green:2,tile_purple:1,tile_blue:1},noren:['cloth_gold','cloth_coral','cloth_indigo'],
      roofForms:{hip:3,gable:1},ridges:{frontage:1},pitch:[.6,.8],eave:[3,4],curve:[.45,.65],crossGable:.35,dormers:0,turret:.5,oriels:.2,
      frames:{posts:2,grid:2},windows:{rect:2,arched:1,tall:1},groundWindows:{rect:1},glazing:{lattice:2,grid:1},shutters:0,boxes:0,groundBoards:.6,canopy:0}
  };
  // The window grid of each wall: a 1 m window every 2 m, centred on the wall and starting on an even cell (so it falls
  // between timber posts). placeOpenings and the voxel facade both use it, so posts, braces and windows line up.
  const gridPhase=len=>{let p=(Math.floor(len/2)-1)%4;if(p%2)p=(p+1)%4;return p;};
  function sampleLook(styleId,plot,seed){
    const S=STYLES[styleId],r=rng(hash('look:'+seed)),one=v=>Array.isArray(v)?pick(r,v):v&&typeof v==='object'?weighted(r,v):v,range=([a,b])=>+(a+(b-a)*r()).toFixed(3),chance=p=>r()<p;
    // Trim is chosen for the wall it sits on (never white on white); '=timber' means trim in the frame's timber.
    const wall=one(S.walls),timber=one(S.timbers),trimPick=one(S.trims[wall]||S.trims.default),trim=trimPick==='=timber'?timber:trimPick;
    const facade={wall,timber,trim,base:one(S.bases),noren:one(S.noren),lattice:S.lattice,frame:one(S.frames),
      window:one(S.windows),groundWindow:one(S.groundWindows),glazing:one(S.glazing),shutters:chance(S.shutters),shutter:S.shutterColors?one(S.shutterColors):null,boxes:chance(S.boxes),groundBoards:chance(S.groundBoards),canopy:chance(S.canopy),
      bays:{zm:gridPhase(plot.w),zp:gridPhase(plot.w),xm:gridPhase(plot.d),xp:gridPhase(plot.d)}};
    const roof={form:one(S.roofForms),ridge:one(S.ridges),pitch:range(S.pitch),eave:Math.round(range(S.eave)),curve:range(S.curve),mat:one(S.roofMats)};
    // Massing: a street-facing cross gable over the middle bays, dormers on a street-facing slope, a corner turret,
    // oriel windows. Each is a chance per style; geometry that does not suit the plot is dropped in generate().
    const mw=plot.lot?plot.lot.main.w:plot.w,mid=Math.floor((plot.lot?plot.lot.main.ox:0)+mw/2);
    roof.cross=roof.ridge==='frontage'&&mw>=14&&chance(S.crossGable)?{x0:mid-3-(plot.w>=20?1:0),x1:mid+3+(plot.w>=20?1:0),depth:ri(r,6,9)}:null;
    roof.dormers=roof.ridge==='frontage'&&!roof.cross&&roof.form!=='hip'&&chance(S.dormers)?ri(r,1,3):0;
    const sides=[!plot.party[0]?'xm':null,!plot.party[1]?'xp':null].filter(Boolean);
    roof.turret=sides.length&&chance(S.turret)?{side:pick(r,sides),r:ri(r,11,15),rise:ri(r,18,30)}:null;
    facade.oriels=chance(S.oriels)?ri(r,1,2):0;
    return {facade,roof};
  }
  function makePlot(seed,opts={}){
    const r=rng(hash('plot:'+seed)),typeId=opts.type||pick(r,Object.keys(TYPES)),T=TYPES[typeId],contextId=opts.context||pick(r,['terrace','terrace','corner','detached']);
    const sampledWidth=Math.max(Math.round(between(r,T.frontage)/CELL)+4,opts.typology?TYPOLOGIES[opts.typology].minW:0),w=opts.parcel?Math.floor(opts.parcel.width/CELL):sampledWidth,sampledStoreys=T.storeys[1]>T.storeys[0]?(r()<(T.tall??.5)?T.storeys[1]:T.storeys[0]):T.storeys[0],storeys=opts.storeys??sampledStoreys;
    if(opts.parcel&&(!Number.isFinite(w)||w<14||w>48||!Number.isFinite(opts.parcel.depth)||opts.parcel.depth<9.5||opts.parcel.depth>40))throw new Error('Parcel requires 7–24 m frontage and 9.5–40 m depth');
    if(opts.storeys!==undefined&&![2,3,4].includes(opts.storeys))throw new Error('storeys must be 2, 3 or 4');
    if(opts.party&&!(Array.isArray(opts.party)&&opts.party.length===2&&opts.party.every(p=>typeof p==='boolean')))throw new Error('party must be two booleans');
    const jettyStep=opts.jetty?opts.projection?Math.round(opts.projection/CELL):4+hash('jetty:'+seed)%3:0,
      front=opts.parcel&&opts.typology==='rowhouse'?jettyStep:opts.jetty?Math.max(1,jettyStep>=4?Math.min(6,jettyStep+(storeys-2)*2):(storeys-1)*jettyStep):1;
    return {seed,type:typeId,context:contextId,party:opts.party?opts.party.slice():CONTEXTS[contextId].party.slice(),w,d:0,front,storeys,jetty:!!opts.jetty,jettyStep,...(opts.parcel?{targetDepth:Math.floor(opts.parcel.depth/CELL)+(opts.typology==='rowhouse'?front:0)}:{})};
  }
  // The typology is chosen per building from the type's weights, among those that suit the plot.
  function chooseTypology(plot,r,forced){
    if(forced)return forced;const T=TYPES[plot.type],ok={};
    for(const [k,wt] of Object.entries(T.typologies)){const Y=TYPOLOGIES[k];if(plot.w<Y.minW||(Y.straight&&plot.storeys>2))continue;ok[k]=wt*(k==='courtyard'&&plot.context==='terrace'?.5:1)*(k==='cross'&&plot.context==='corner'?1.3:1)*(k==='stairhall'&&plot.type==='inn'&&plot.context!=='detached'?.4:1);}
    return Object.keys(ok).length?weighted(r,ok):'cross';
  }

  // --- Lots ---------------------------------------------------------------------------------------------------------
  // A lot is a polygon on the 0.5 m grid with a straight street edge at row `front`. The main house (laid out by its
  // typology exactly as on a rectangular plot) stands on the street frontage; the rest of the lot fills with
  // extensions (stores, workrooms, garden rooms), single-storey rectangles carved from what is left, each touching
  // the building, so a slanted or crooked lot line is followed in steps rather than with triangular rooms. Slivers too
  // small for a room stay yard.
  const LOTS={rect:'Rectangular',deep:'Deep, with a yard',wedge:'Wedge',slant:'Slanted back',flag:'Flag (narrow front)',dogleg:'Dog-leg',crooked:'Crooked'};
  function makeLot(kind,r,front,Wf){
    const Dl=kind==='deep'?ri(r,38,46):ri(r,28,36),P=[];let pts;
    if(kind==='deep')pts=[[0,0],[Wf,0],[Wf,Dl],[0,Dl]];
    else if(kind==='wedge'){const Wb=Math.max(10,Wf+pick(r,[-1,1])*ri(r,5,9));pts=[[0,0],[Wf,0],[Wb,Dl],[0,Dl]];}
    else if(kind==='slant'){const d1=Dl-ri(r,6,12);pts=r()<.5?[[0,0],[Wf,0],[Wf,Dl],[0,d1]]:[[0,0],[Wf,0],[Wf,d1],[0,Dl]];}
    else if(kind==='flag'){const k=ri(r,24,30),Wt=Wf+ri(r,6,10),left=r()<.5;pts=left?[[0,0],[Wf,0],[Wf,k],[Wt,k],[Wt,Dl],[0,Dl]]:[[Wt-Wf,0],[Wt,0],[Wt,Dl],[0,Dl],[0,k],[Wt-Wf,k]];}
    else if(kind==='dogleg'){const k=ri(r,20,28),sh=pick(r,[-1,1])*ri(r,4,7);pts=[[0,0],[Wf,0],[Wf,k],[Wf+sh,k],[Wf+sh,Dl],[sh,Dl],[sh,k],[0,k]];}
    else{const a=ri(r,-4,4),b=ri(r,-4,4);pts=[[0,0],[Wf,0],[Wf+b,Dl-ri(r,0,8)],[a,Dl-ri(r,0,8)]];}
    const minX=Math.min(...pts.map(q=>q[0])),W=Math.max(...pts.map(q=>q[0]))-minX,poly=pts.map(([x,z])=>[x-minX,z+front]),D=front+Dl;
    const inside=(px,pz)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i],[xj,zj]=poly[j];if((zi>pz)!==(zj>pz)&&px<(xj-xi)*(pz-zi)/(zj-zi)+xi)c=!c;}return c;};
    const mask=new Uint8Array(W*D);for(let z=front;z<D;z++)for(let x=0;x<W;x++)if(inside(x+.5,z+.5))mask[x+W*z]=1;
    return {kind,W,D,mask,poly,frontOffset:-minX};
  }
  // The main block's place on the lot: the street frontage, the building's width, aligned to a side, and how deep the
  // lot runs behind it.
  function placeMain(lot,wb,front,r){
    const row=[];for(let x=0;x<lot.W;x++)if(lot.mask[x+lot.W*front])row.push(x);if(!row.length)return null;
    const L0=Math.min(...row),L1=Math.max(...row)+1,depthAt=(ox,w)=>{let d=1e9;for(let x=ox;x<ox+w;x++){let z=front;while(z<lot.D&&lot.mask[x+lot.W*z])z++;d=Math.min(d,z-front);}return d;};
    // try the left, right and centred positions, and up to 3 m narrower, keeping the best of width and depth (a
    // narrowing lot gives a deeper house if it stands a little narrower); ties go to a seeded pick
    const opts=[];for(let w=Math.min(wb,L1-L0);w>=Math.max(12,Math.min(wb,L1-L0)-6);w-=2)for(const ox of [L0,L1-w,L0+Math.floor((L1-L0-w)/2)]){const d=depthAt(ox,w);opts.push({ox,w,d,s:w*Math.min(d,w*1.5)+r()});}
    opts.sort((a,b)=>b.s-a.s);
    return {ox:opts[0].ox,w:opts[0].w,maxDepth:opts[0].d};
  }
  // Greedy rectangle decomposition of a mask (largest rectangles first), as in voxels.js.
  function decompose(mask,w,d){const left=Uint8Array.from(mask),out=[];
    while(true){let best=null;for(let z0=0;z0<d;z0++)for(let x0=0;x0<w;x0++){if(!left[x0+w*z0])continue;let xmax=w;
      for(let z1=z0;z1<d&&left[x0+w*z1];z1++){let x1=x0;while(x1+1<xmax&&left[x1+1+w*z1])x1++;xmax=x1+1;const a=(x1-x0+1)*(z1-z0+1);if(!best||a>best.a)best={a,r:[x0,z0,x1,z1]};}}
      if(!best||best.a<4)break;const [x0,z0,x1,z1]=best.r;for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)left[x+w*z]=0;out.push(best.r);}
    return out;}
  // Paste a typology's building into the lot grid at the main block's offset, then carve extensions from the rest.
  function pasteAndExtend(P,T,lot,main,v){
    const W=lot.W,D=Math.max(lot.D,P.d),ox=main.ox,shift=i=>(i%P.w)+ox+W*Math.floor(i/P.w),sx=([x,z])=>[x+ox,z],sr=([x0,z0,x1,z1])=>[x0+ox,z0,x1+ox,z1];
    const masks=P.masks.map(m=>{const n=new Uint8Array(W*D);for(let i=0;i<m.length;i++)if(m[i])n[shift(i)]=1;return n;});
    const floors=T.floors.map(F=>{const g=new Int16Array(W*D).fill(-1);for(let i=0;i<F.grid.length;i++)if(F.grid[i]>=0)g[shift(i)]=F.grid[i];
      return {f:F.f,grid:g,rooms:F.rooms,steps:F.steps.map(shift),voids:F.voids.map(shift),open:F.open.map(o=>({cells:o.cells.map(sx),dir:o.dir}))};});
    const st=T.stair,stair={...st,rect:sr(st.rect),flights:st.flights.map(f=>({...f,rect:sr(f.rect)})),landings:st.landings.map(l=>({...l,rect:sr(l.rect)})),spirals:st.spirals.map(sp=>({...sp,centre:[sp.centre[0]+ox,sp.centre[1]]}))};
    const entrances=T.entrances.map(e=>({...e,...(e.at!==undefined?{at:e.at+ox}:{})}));
    const P2={...P,w:W,d:D,masks,features:P.features?.map(f=>({...f,rect:sr(f.rect)})),lot:{kind:lot.kind,mask:lot.mask,main:{ox,w:P.w,d:P.d}}};
    // Extensions: leftover rectangles that share at least 1.5 m of wall with the building (so they open off it), are
    // at least 2 x 2.5 m, and leave every room that needs a window a wall to have one; up to three, always leaving an
    // eighth of the lot as yard.
    const house=masks[0].slice(),F0=floors[0],lotCells=lot.mask.reduce((a,b)=>a+b,0),type=P.type,biz=['shophouse','workshop'].includes(type);let made=0;
    for(let it=0;it<3;it++){const left=new Uint8Array(W*D);let freeN=0;for(let i=0;i<W*D;i++)if(lot.mask[i]&&!masks[0][i]&&Math.floor(i/W)>=P.front){left[i]=1;freeN++;}
      let best=null;for(let [x0,z0,x1,z1] of decompose(left,W,D)){
        // trim to an extension's depth (3-5 m) out from the side it shares with the building; the rest stays yard
        const touch=(xa,za)=>xa>=0&&za>=0&&xa<W&&za<D&&house[xa+W*za];let sides={xm:0,xp:0,zm:0,zp:0};
        for(let z=z0;z<=z1;z++){if(touch(x0-1,z))sides.xm++;if(touch(x1+1,z))sides.xp++;}for(let x=x0;x<=x1;x++){if(touch(x,z0-1))sides.zm++;if(touch(x,z1+1))sides.zp++;}
        const side=Object.entries(sides).sort((a,b)=>b[1]-a[1])[0][0],maxD=ri(v,6,10);
        if(z0>=P.front+P.compactDepth)continue;
        z1=Math.min(z1,P.front+P.compactDepth-1);
        if(side==='xm')x1=Math.min(x1,x0+maxD-1);if(side==='xp')x0=Math.max(x0,x1-maxD+1);if(side==='zm')z1=Math.min(z1,z0+maxD-1);if(side==='zp')z0=Math.max(z0,z1-maxD+1);
        // and along the wall it shares: a lean-to covers part of a wall (45-70%), tried against either end, leaving
        // the rest of the wall its windows and the yard a way round
        const along=side[0]==='z'?x1-x0+1:z1-z0+1,len=Math.min(along,Math.max(5,Math.round(along*between(v,[.45,.7])))),tries=[];
        for(const end of [0,1]){const r=side[0]==='z'?(end?[x1-len+1,z0,x1,z1]:[x0,z0,x0+len-1,z1]):(end?[x0,z1-len+1,x1,z1]:[x0,z0,x1,z0+len-1]);tries.push(r);}
        for(const [tx0,tz0,tx1,tz1] of tries){const x0=tx0,z0=tz0,x1=tx1,z1=tz1;
        const rw=x1-x0+1,rd=z1-z0+1;if(Math.min(rw,rd)<4||Math.max(rw,rd)<5)continue;
        let shared=0,edge=0;for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(nx>=x0&&nx<=x1&&nz>=z0&&nz<=z1)continue;
          const inG=nx>=0&&nz>=0&&nx<W&&nz<D;if(inG&&house[nx+W*nz])shared++;else if(!inG||!lot.mask[nx+W*nz])edge++;}
        if(shared<3)continue;const area=rw*rd;if(freeN-area<lotCells*.12)continue;
        // never take the last outside wall of a room that needs a window
        const covers=(x,z)=>x>=x0&&x<=x1&&z>=z0&&z<=z1;
        const freeOf=ks=>{let free=0;for(let i=0;i<W*D;i++){if(!ks.includes(F0.grid[i]))continue;const x=i%W,z=Math.floor(i/W);for(const [dx,dz,sd] of DIRS){const nx=x+dx,nz=z+dz,inG=nx>=0&&nz>=0&&nx<W&&nz<D;
            if(inG&&masks[0][nx+W*nz])continue;if(inG&&covers(nx,nz))continue;if(!isPartyEdge(P2,x,z,sd))free++;}}return free;};
        if(F0.rooms.some((rm,k)=>k>=2&&ROOMS[rm.type].light&&freeOf([k])<2))continue;
        // and the hall or kitchen keeps a wall for the yard door as well as the kitchen's window
        const kit=F0.rooms.map((rm,k)=>rm.type==='kitchen'?k:-1).filter(k=>k>=0);if(kit.length&&freeOf([1,...kit])<6)continue;
        const m2=area*CELL*CELL;let domesticType=null;
        if(!biz&&type!=='inn'){
          const adj=new Set();for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(nx>=x0&&nx<=x1&&nz>=z0&&nz<=z1||nx<0||nz<0||nx>=W||nz>=D)continue;const k=F0.grid[nx+W*nz];if(k>=1)adj.add(F0.rooms[k].type);}
          const existing=F0.rooms.map(r=>r.type),width=Math.min(rw,rd);
          if(adj.has('hall')&&m2>=9&&m2<=24&&width>=ROOMS.bed.minW)domesticType='bed';
          else if(adj.has('kitchen')&&!existing.includes('dining')&&m2>=16&&m2<=30&&width>=ROOMS.dining.minW)domesticType='dining';
          else if((adj.has('hall')||adj.has('living')||adj.has('kitchen'))&&!existing.includes('workshop')&&m2>=14&&m2<=28&&width>=ROOMS.workshop.minW)domesticType='workshop';
          else if((adj.has('hall')||adj.has('living')||adj.has('kitchen'))&&existing.filter(t=>t==='store').length<2&&m2>=3&&m2<=ARCHITECTURE.storage.domestic.maxA&&width>=ROOMS.store.minW)domesticType='store';
          else continue;
        }
        const sc=shared*2+Math.min(edge,12)+area*.25+(domesticType==='bed'?10:0);if(!best||sc>best.sc)best={sc,r:[x0,z0,x1,z1],area,domesticType};}}
      if(!best)break;const [x0,z0,x1,z1]=best.r,m2=best.area*CELL*CELL;
      // the extension's use: preferred by building type and size, but always one that can open off a room it touches
      const adj=new Set();for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(nx>=x0&&nx<=x1&&nz>=z0&&nz<=z1)continue;if(nx<0||nz<0||nx>=W||nz>=D)continue;const g=F0.grid[nx+W*nz];if(g>1)adj.add(F0.rooms[g].type);else if(g===1)adj.add('hall');}
      const prefs=biz?(made===0&&m2>=7?['workshop','store']:['store','workshop']):type==='inn'?(m2>=9&&made===0?['dining','store','workshop']:['store','dining']):(m2>=8&&made===0?[pick(v,['study','workshop','dining']),'workshop','dining','store']:['store','workshop','study']);
      const t=best.domesticType||prefs.find(t=>m2>=ROOMS[t].minA&&Math.min(x1-x0+1,z1-z0+1)>=ROOMS[t].minW&&[...adj].some(a=>canLink(t,a)))||'store';
      const k=F0.rooms.length;F0.rooms.push({type:t,extension:true});for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){F0.grid[x+W*z]=k;masks[0][x+W*z]=1;}made++;}
    return {P:P2,floors,stair,entrances};
  }

  function projectUpperFloors(P,T,depth){
    const left=P.party[0]?0:depth,right=P.party[1]?0:depth,rear=!P.lot||P.context==='detached'?depth:0,W=P.w+left+right,D=P.d+rear,
      shift=i=>i%P.w+left+W*Math.floor(i/P.w),sx=([x,z])=>[x+left,z],sr=([a,b,c,e])=>[a+left,b,c+left,e],masks=P.masks.map(()=>new Uint8Array(W*D)),added=masks.map(()=>new Uint8Array(W*D)),
      floors=T.floors.map((F,f)=>{const grid=new Int16Array(W*D).fill(-1);for(let i=0;i<F.grid.length;i++)if(F.grid[i]>=0){grid[shift(i)]=F.grid[i];masks[f][shift(i)]=1;}
        if(f){const occupied=Array.from(F.grid.keys()).filter(i=>F.grid[i]>=0),x0=Math.min(...occupied.map(i=>i%P.w)),x1=Math.max(...occupied.map(i=>i%P.w)),z1=Math.max(...occupied.map(i=>Math.floor(i/P.w))),
          put=(x,z,k)=>{const i=x+W*z;if(x>=0&&z>=0&&x<W&&z<D&&grid[i]<0){grid[i]=k;masks[f][i]=1;added[f][i]=1;}};
          for(const i of occupied){const k=F.grid[i];if(k===0||['bath','store'].includes(F.rooms[k].type))continue;const x=i%P.w,z=Math.floor(i/P.w),l=x===x0&&left&&!isPartyEdge(P,x,z,'xm'),r=x===x1&&right&&!isPartyEdge(P,x,z,'xp'),b=z===z1&&rear&&!isPartyEdge(P,x,z,'zp');
            for(let n=1;n<=depth;n++){if(l)put(x+left-n,z,k);if(r)put(x+left+n,z,k);if(b)put(x+left,z+n,k);}
            if(b&&(l||r))for(let a=1;a<=depth;a++)for(let b=1;b<=depth;b++)put(x+left+(l?-a:a),z+b,k);
          }
        }
        return {...F,grid,steps:F.steps.map(shift),voids:F.voids.map(shift),open:F.open.map(o=>({...o,cells:o.cells.map(sx)}))};}),st=T.stair,
      stair={...st,rect:sr(st.rect),flights:st.flights.map(f=>({...f,rect:sr(f.rect)})),landings:st.landings.map(l=>({...l,rect:sr(l.rect)})),spirals:st.spirals.map(s=>({...s,centre:sx(s.centre)}))},
      entrances=T.entrances.map(e=>({...e,...(e.at!==undefined?{at:e.at+left}:{})}));
    let lot=P.lot;if(lot){const mask=new Uint8Array(W*D);for(let i=0;i<lot.mask.length;i++)if(lot.mask[i])mask[shift(i)]=1;lot={...lot,mask,main:{...lot.main,ox:lot.main.ox+left}};}
    return {P:{...P,w:W,d:D,masks,lot,features:P.features?.map(f=>({...f,rect:sr(f.rect)})),overhang:{metres:depth*CELL,core:{x:left,w:P.w,d:P.d},masks:added.map(m=>Array.from(m))}},T:{...T,floors,stair,entrances}};
  }

  // The stair is chosen once per building (kind, and whether it stands in an exterior tower), weighted by what the
  // typology can hold; the variants then all build that stair, so scoring never quietly prefers one kind.
  function chooseStair(plot,typology,r){
    const two=plot.storeys===2,w=plot.w;
    if(typology==='side'||typology==='wing'||typology==='centre'){if(typology!=='wing'&&two&&r()<.3)return {kind:weighted(r,{dogleg:1,spiral:1,u3:1,L:1}),tower:true};return {kind:r()<.45?'straightLanding':'straight'};}
    if(typology==='stairhall'){if(r()<.3)return {kind:weighted(r,{dogleg:1,spiral:1,u3:1,...(two?{L:1}:{})}),tower:true};return {kind:weighted(r,{dogleg:2,spiral:1.2,u3:1})};}
    if(typology==='courtyard')return {kind:weighted(r,{dogleg:2,spiral:1.5,u3:1})};
    return {kind:weighted(r,{dogleg:2,spiral:1.2,u3:w>=16?1:0})};
  }
  function generate(seed,opts={}){
    if(opts.parcel)opts={lot:'rect',projection:0,...opts};
    if(['tower','undercroft','rowhouse'].includes(opts.typology)){if(opts.type&&opts.type!=='home')throw new Error('Tower, undercroft and rowhouse programmes require the home type');opts={...opts,type:'home'};}
    if(opts.typology==='rowhouse'&&!opts.parcel)opts={...opts,storeys:opts.storeys??3,projection:0,lot:'rect',parcel:{width:7+(hash('width:'+seed)%2)*.5,depth:12.5}};
    seed=Number(seed)>>>0;const r=rng(hash('building:'+seed)),styleId=opts.style||pick(r,Object.keys(STYLES)),style=STYLES[styleId];
    if(opts.projection!==undefined&&![0,.5,1,1.5,2,2.5,3].includes(opts.projection))throw new Error('projection must be 0–3 metres in half-metre increments');
    const plot=makePlot(seed,{...opts,jetty:opts.projection!==undefined?opts.projection>0:opts.jetty??(style.jettyOk&&r()<.6)});
    // The lot: rectangular by default for a plain plot, else one of the shaped lots (chosen per building).
    const lr=rng(hash('lot:'+seed)),lotKind=opts.lot??(lr()<.55?pick(lr,Object.keys(LOTS).filter(k=>k!=='rect')):'rect');let lot=null,main=null;
    if(lotKind!=='rect'){lot=makeLot(lotKind,lr,plot.front,plot.w+ri(lr,0,8));main=placeMain(lot,plot.w,plot.front,lr);if(main&&main.w>=12&&main.maxDepth>=16){plot.w=main.w;plot.maxDepth=main.maxDepth;}else{lot=null;main=null;}}
    plot.compactDepth=Math.max(26,Math.floor(plot.w*ARCHITECTURE.depthRatio[plot.type]));
    if(opts.parcel){if(opts.lot&&opts.lot!=='rect')throw new Error('A city parcel currently requires a rectangular lot');plot.maxDepth=Math.floor(opts.parcel.depth/CELL)-(opts.typology==='rowhouse'?0:plot.front);plot.compactDepth=Math.min(plot.compactDepth,plot.maxDepth);plot.corner=opts.parcel.corner||null;}
    const typology=chooseTypology(plot,rng(hash('typology:'+seed)),opts.typology);
    let best=null;const C=opts.candidates||(typology==='rowhouse'?1:10),limit=opts.candidates?C:100,stairPick=chooseStair(plot,typology,rng(hash('stair:'+seed)));
    for(let c=0;c<limit&&(c<C||!best?.feasible);c++){const v=rng(hash(`variant:${seed}:${c}`)),pr=rng(hash(`program:${seed}:${c}`)),P={...plot,party:plot.party.slice()};
      P.programs=Array.from({length:P.storeys},(_,f)=>program(P.type,f,P.storeys-1,pr));
      P.forceStair=opts.stair||stairPick; // {kind, tower}
      if(P.forceStair?.tower){const needed=(ARCHITECTURE.mixedUse.includes(P.type)?24:22)+STAIRS[P.forceStair.kind].V+HALL;
        if(P.compactDepth<needed){if(opts.stair)P.compactDepth=needed;else P.forceStair={...P.forceStair,tower:false};}}
      let T=BUILD[typology](P,v),PP=P;if(!T)continue;
      if(P.d-P.front>P.compactDepth||P.maxDepth&&P.d-P.front>P.maxDepth||lot&&P.d-P.front>main.maxDepth)continue;
      if(lot){const L2=pasteAndExtend(P,T,lot,main,v);
        // a variant whose wing or stair tower would cross the lot line is no good here
        if(L2.P.masks.some(m=>m.some((v_,i)=>v_&&Math.floor(i/L2.P.w)>=P.front&&!lot.mask[i])))continue;
        PP=L2.P;T={...T,floors:L2.floors,stair:L2.stair,entrances:L2.entrances};}
      if(PP.jetty&&typology!=='rowhouse'){const projected=projectUpperFloors(PP,T,PP.jettyStep);PP=projected.P;T=projected.T;}
      const privateArrival=addPrivateArrival(PP,T.floors[0],T.entrances);
      for(const F of T.floors)for(const room of F.rooms)if(room.type==='store'&&roomZone(PP.type,F.f,room)==='service')room.commercial=true;
      for(const F of T.floors)refineBaths(PP,F);
      if(T.floors.some(F=>!refineRooms(PP,F,T.entrances)))continue;
      const areas=T.floors.flatMap(F=>{const area=F.rooms.map(()=>0);for(const k of F.grid)if(k>=0)area[k]+=CELL*CELL;return F.rooms.map((room,k)=>({type:room.type,area:area[k]}));}),
        kitchenArea=Math.min(...areas.filter(r=>r.type==='kitchen'&&r.area).map(r=>r.area));
      if(areas.some(r=>r.type==='bath'&&(r.area>ARCHITECTURE.bath.preferred[1]||r.area>=kitchenArea)))continue;
      const recessedArrival=recessPrivateArrival(PP,T.floors[0],T.entrances);
      for(const F of T.floors)for(const room of F.rooms)room.zone=roomZone(PP.type,F.f,room);
      const finish=F=>{const arrive=F.f===0?null:F.open.map(o=>F.grid[o.cells[0][0]+PP.w*o.cells[0][1]]).find(k=>k>0&&ROOMS[F.rooms[k].type].circ);
        const start=F.f===0?(T.entrances.find(e=>e.floor===0&&e.room>0&&ROOMS[F.rooms[e.room].type].circ)?.room??1):(arrive??1);
        return finishFloor(PP,F,T.entrances,start);},floors=T.floors.map(finish);
      if(ARCHITECTURE.mixedUse.includes(PP.type)){
        const F=T.floors[0],staff=serviceReach(PP,F,floors[0].doors,floors[0].openings),unserved=new Set(F.rooms.flatMap((room,k)=>room.extension&&room.zone==='service'&&room.cells&&!staff.has(k)?[k]:[]));
        if(unserved.size){for(let i=0;i<F.grid.length;i++)if(unserved.has(F.grid[i])){F.grid[i]=-1;PP.masks[0][i]=0;}for(const k of unserved)delete F.rooms[k].extension;floors[0]=finish(F);}
      }
      if(!floors[0].openings.some(o=>o.kind==='front'))continue;
      const ground=floors[0].F.rooms,business=ground.find(r=>['shop','workshop'].includes(r.type)&&!r.extension),mainArea=ground.reduce((a,r)=>a+(r.extension?0:r.cells||0),0),share=business?(business.cells||0)/mainArea:1;
      const staff=ARCHITECTURE.mixedUse.includes(PP.type)?serviceReach(PP,floors[0].F,floors[0].doors,floors[0].openings):null;
      const required={home:['living','kitchen','bed','bath'],shophouse:['shop','kitchen','living','bed','bath'],workshop:['workshop','kitchen','living','bed','bath'],inn:['common','kitchen','guest','bath']}[PP.type],missing=required.filter(t=>!floors.some(x=>x.F.rooms.some(r=>r.type===t&&r.cells))).length;
      const hard=missing+floors.reduce((n,F)=>n+F.notes.length,0)+(share<ARCHITECTURE.shop.minFloorShare?1:0)+(!privateArrival&&ARCHITECTURE.mixedUse.includes(PP.type)?1:0)+
        (staff?ground.filter((r,k)=>r.zone==='service'&&r.cells&&!staff.has(k)).length:0),feasible=hard===0;
      const score=floors.reduce((a,x)=>a+x.score,0)+(!privateArrival&&ARCHITECTURE.mixedUse.includes(PP.type)?1000:0)+(!recessedArrival&&ARCHITECTURE.mixedUse.includes(PP.type)?200:0)+Math.max(0,ARCHITECTURE.shop.minFloorShare-share)*2000;
      if(!best||hard<best.hard||hard===best.hard&&score<best.score)best={score,hard,feasible,P:PP,T,floors,candidate:c};}
    if(!best&&lot)return generate(seed,{...opts,lot:'rect'}); // the lot was too tight for this typology
    if(!best)throw new Error(`no ${typology} plan for seed ${seed}`);
    const {P,T}=best,sampled=sampleLook(styleId,P,seed),look={facade:{...sampled.facade,...(opts.look?.facade||{})},roof:{...sampled.roof,...(opts.look?.roof||{})}};
    // the turret stands mostly outside the corner and opens about one cell into it; keep doors out of that cell
    if(P.lot)look.roof.turret=null; // a turret needs a free corner of the main block, which a lot rarely leaves
    if(look.roof.turret){const xs=look.roof.turret.side==='xm'?[0,1]:[P.w-2,P.w-1],z0=P.front;
      if(best.floors.some(({openings})=>openings.some(o=>o.kind!=='window'&&o.kind!=='small'&&o.cells.some(([x,z])=>x>=xs[0]&&x<=xs[1]&&z<=z0+1))))look.roof.turret=null;}
    return {revision:REVISION,seed,type:P.type,typeLabel:TYPES[P.type].label,typology,typologyLabel:TYPOLOGIES[typology].label,style:styleId,styleLabel:style.label,context:P.context,cell:CELL,storey:STOREY,
      facade:look.facade,roof:look.roof,lotKind:P.lot?P.lot.kind:'rect',lotLabel:LOTS[P.lot?P.lot.kind:'rect'],
      plot:{w:P.w,d:P.d,front:P.front,compactDepth:P.compactDepth,jetty:P.jetty,jettyStep:P.jettyStep,overhang:P.overhang,features:P.features,party:P.party,context:P.context,masks:P.masks.map(m=>Array.from(m)),lot:P.lot?{kind:P.lot.kind,mask:Array.from(P.lot.mask),main:P.lot.main}:null},
      stair:{kind:T.stair.kind,label:STAIR_LABELS[T.stair.kind]+(T.stair.tower?' in a tower':''),tower:T.stair.tower,orient:T.stair.orient,rect:T.stair.rect,flights:T.stair.flights,landings:T.stair.landings,spirals:T.stair.spirals},
      floors:best.floors.map(({F,doors,openings,score,notes})=>({level:F.f,grid:Array.from(F.grid),rooms:F.rooms.map((room,k)=>({id:k,type:room.type,zone:room.zone,label:room.type==='store'&&(room.commercial||room.bulkStorage)?'Stockroom':ROOMS[room.type].label,area:+((room.cells||0)*CELL*CELL).toFixed(2),box:room.box,cells:room.cells||0,...(room.commercial?{commercial:true}:{}),...(room.bulkStorage?{bulkStorage:true}:{}),...(room.extension?{extension:true}:{}),...(room.annex?{annex:true}:{})})),
        doors,openings,voids:F.voids,steps:F.steps,score:+score.toFixed(2),notes})),score:+best.score.toFixed(2),candidate:best.candidate};
  }

  // Text drawing of one floor, for tests and quick inspection: one character per cell plus one per wall line.
  // Letters are rooms (see GLYPH), '.' the stair void, '^' the stair, '/' a door, ' ' an opening, '=' a window,
  // 'D' an outside door.
  const GLYPH={hall:'h',stair:'^',living:'L',common:'C',shop:'$',workshop:'W',kitchen:'K',dining:'D',store:'s',bath:'b',bed:'B',guest:'G',study:'y',office:'o'};
  function ascii(plan,f){
    const {w,d}=plan.plot,F=plan.floors[f],g=F.grid,voids=new Set(F.voids),steps=new Set(F.steps),X=2*w+1,Z=2*d+1,c=Array.from({length:Z},()=>new Array(X).fill(' '));
    const room=(x,z)=>x<0||z<0||x>=w||z>=d?-1:g[x+w*z];
    for(let z=0;z<d;z++)for(let x=0;x<w;x++){const k=room(x,z);if(k<0)continue;c[2*z+1][2*x+1]=voids.has(x+w*z)&&!steps.has(x+w*z)?'.':GLYPH[F.rooms[k].type]||'?';}
    for(let z=0;z<=d;z++)for(let x=0;x<w;x++)if(room(x,z-1)!==room(x,z))c[2*z][2*x+1]='-';
    for(let z=0;z<d;z++)for(let x=0;x<=w;x++)if(room(x-1,z)!==room(x,z))c[2*z+1][2*x]='|';
    for(let z=0;z<=d;z++)for(let x=0;x<=w;x++){const n=[c[2*z][2*x-1],c[2*z][2*x+1]].includes('-'),v=[c[2*z-1]?.[2*x],c[2*z+1]?.[2*x]].includes('|');if(n||v)c[2*z][2*x]=n&&v?'+':n?'-':'|';}
    const mark=(x,z,side,ch)=>{if(side==='xp')c[2*z+1][2*x+2]=ch;else if(side==='xm')c[2*z+1][2*x]=ch;else if(side==='zp')c[2*z+2][2*x+1]=ch;else c[2*z][2*x+1]=ch;};
    for(const dr of F.doors)for(const [x,z] of dr.cells)mark(x,z,dr.dir,dr.kind==='open'?' ':'/');
    for(const o of F.openings)for(const [x,z] of o.cells)mark(x,z,o.side,o.kind==='front'||o.kind==='back'?'D':'=');
    return c.map(r=>r.join('').trimEnd()).filter((r,k)=>k>0||r.trim()).join('\n');
  }

  const api={CELL,STOREY,REVISION,ARCHITECTURE,ROOMS,TYPES,TYPOLOGIES,STYLES,CONTEXTS,STAIRS,STAIR_LABELS,LOTS,isPartyEdge,makeLot,hash,rng,makePlot,stairBay,generate,ascii,canLink,sharedRuns,gridPhase,facadeSpans,sampleLook,roomZone,roomBudget,throughRoom,roomPath,diningKitchenRoute,doorRoles,exteriorAccess,serviceYardRoutes,shopDoorAtRear,exteriorDoorsConflict,redundantExteriorDoors};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.BuildingPlan=api;
})(typeof globalThis==='object'?globalThis:this);
