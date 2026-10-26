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
  // stores, studies) are never walked through, and the stair stacks through every floor and opens onto circulation.
  //   side       a passage along one side wall, straight stair in it, rooms in a row beside it (narrow plots)
  //   wing       the side passage, ending in a rear wing on an L-shaped footprint with a yard beside it
  //   centre     a short hall in the middle around a straight stair, rooms either side and full-width rooms behind
  //   stairhall  a broad entrance hall leading to a U-turn stair at the back, rooms either side
  //   cross      a passage across the house; rooms sit side by side along the street front and the back,
  //              with a U-turn stair off the passage (a side-street door on corner plots)
  //   cottage    no ground-floor hall: the front door opens into the living room, which holds the stair
  //   courtyard  a U around a courtyard: galleries along the outer walls, rooms looking onto the courtyard,
  //              and a stair tower in the courtyard corner
  const CELL=0.5,STOREY=3.0,REVISION='building-plan-3';
  const DIRS=[[-1,0,'xm'],[1,0,'xp'],[0,-1,'zm'],[0,1,'zp']],OPP={xm:'xp',xp:'xm',zm:'zp',zp:'zm'};

  // Room kinds. circ: circulation that may lead anywhere. leaf: never walked through to reach another room.
  // light: needs an outside window. minW: narrowest acceptable width (cells); minA: smallest sensible area (m2).
  const ROOMS={
    hall:{label:'Hall',circ:true,minW:2,light:false,minA:0},
    stair:{label:'Stair',minW:2,light:false,minA:0},
    living:{label:'Living room',circ:true,minW:6,light:true,minA:11},
    common:{label:'Common room',circ:true,minW:8,light:true,minA:24},
    shop:{label:'Shop',minW:5,light:true,minA:10},
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
  // Doors that make sense between two rooms when neither is circulation: a kitchen-diner, a shop's back store.
  const WORK_LINKS=new Set(['kitchen|shop','kitchen|workshop','kitchen|store','shop|store','store|workshop','dining|kitchen','common|kitchen','kitchen|living','office|shop','office|workshop']);
  const pairKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
  const canLink=(a,b)=>a!==b&&a!=='stair'&&b!=='stair'&&(ROOMS[a].circ||ROOMS[b].circ||WORK_LINKS.has(pairKey(a,b)));

  // Building types: frontage (metres), storeys and how likely each typology is. Typologies too narrow for the plot,
  // or with a straight stair on a 3-storey building, are skipped.
  const TYPES={
    shophouse:{label:'Shop-house (home over shop)',frontage:[6,9],storeys:[2,3],tall:.2,typologies:{side:3,wing:2.5,cross:1.2}},
    workshop:{label:'Workshop (home over workshop)',frontage:[7,10],storeys:[2,3],tall:.15,typologies:{side:2,wing:2,cross:1.2}},
    home:{label:'Family home',frontage:[7.5,12],storeys:[2,3],tall:.2,typologies:{centre:2,stairhall:2,cross:1.2,cottage:1.5,side:1,wing:1.5,courtyard:1}},
    inn:{label:'Inn',frontage:[11,14],storeys:[3,3],typologies:{stairhall:2.5,cross:1.3,courtyard:2.2}}
  };
  const TYPOLOGIES={
    side:{label:'Side passage',minW:12,straight:true},wing:{label:'Side passage + rear wing',minW:12,straight:true},
    centre:{label:'Central hall',minW:16,straight:true},stairhall:{label:'Stair hall',minW:18},
    cross:{label:'Cross passage',minW:12},cottage:{label:'Cottage, open plan',minW:12},courtyard:{label:'Courtyard',minW:22}
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
      const a=r()<.5;return {front:a?['living','study']:['living','dining'],support:['bath','store?'],back:a?['kitchen','dining?','bed?']:['kitchen','study?','bed?']};}
    if(type==='inn')return {front:['guest','guest','guest?'],support:['bath','store?'],back:['guest',f===top?'bed':'guest','guest?']};
    if(type==='home')return r()<.7?{front:['bed','bed','bed?'],support:['bath','store?'],back:['bed','bed?','study?']}:{front:['living','bed?'],support:['bath','store?'],back:['bed','bed','bed?']};
    return r()<.6?{front:['living'],support:['bath','store?'],back:['bed','study?']}:{front:['living','bed?'],support:['bath','store?'],back:['bed']};
  }

  function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const pick=(r,list)=>list[Math.floor(r()*list.length)];
  const between=(r,[a,b])=>a+(b-a)*r();
  const ri=(r,a,b)=>a+Math.floor(r()*(b-a+1));
  const weighted=(r,table)=>{const e=Object.entries(table).filter(([,w])=>w>0),sum=e.reduce((a,[,w])=>a+w,0);let t=r()*sum;for(const [k,w] of e){t-=w;if(t<=0)return k;}return e.at(-1)[0];};

  // --- Splitting a strip of rooms -----------------------------------------------------------------------------------
  const MINLEN={bath:3,store:3,study:5,office:5,bed:6,guest:6,kitchen:5,dining:6,living:7,shop:7,workshop:8,common:10,hall:2};
  const WEIGHT={bath:.7,store:.55,study:.85,office:.85,bed:1.1,guest:1,kitchen:1.15,dining:1,living:1.3,shop:1.4,workshop:1.5,common:2};
  const bare=t=>t.replace('?','');
  // Drop optional rooms (then required ones from the end) until the minimum lengths fit.
  function fitList(list,len,lastMin=0){const L=list.slice(),need=()=>L.reduce((a,t,k)=>a+Math.max(MINLEN[bare(t)],k===L.length-1?lastMin:0),0);
    while(L.length>1&&need()>len){const i=L.map(t=>t.endsWith('?')).lastIndexOf(true);L.splice(i>=0?i:L.length-1,1);}return L.map(bare);}
  // Lengths along a strip, by weight with a little jitter, each at least its minimum (the last at least lastMin).
  function splitLen(types,len,v,lastMin=0){const mins=types.map((t,k)=>Math.max(MINLEN[t],k===types.length-1?lastMin:0)),ws=types.map(t=>WEIGHT[t]*(.8+.4*v())),sum=ws.reduce((a,b)=>a+b,0);
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
      zone(x0,z0,x1,z1,axis,list,v,lastMin=0){const len=axis==='x'?x1-x0:z1-z0;if(len<=0||x1<=x0||z1<=z0)return [];let types=fitList(list,len,lastMin);if(!types.length)return [];
        const rects=(ts)=>{const lens=splitLen(ts,len,v,lastMin);let p=axis==='x'?x0:z0;return lens.map(l=>{const r=axis==='x'?[p,z0,p+l,z1]:[x0,p,x1,p+l];p+=l;return r;});};
        const lit=([a,b,c,e])=>{for(let z=b;z<e;z++)for(let x=a;x<c;x++){if(!(z===b||z===e-1||x===a||x===c-1))continue;if(x<0||z<0||x>=w||z>=d||!mask[x+w*z])continue;if(exteriorSides(plot,mask,x,z).some(s=>!s.party))return true;}return false;};
        for(let pass=0;pass<2;pass++){const rs=rects(types),flags=rs.map(lit),need=types.filter(t=>ROOMS[t].light),dark=types.filter(t=>!ROOMS[t].light),out=[];
          for(let i=0;i<types.length;i++){if(flags[i]&&need.length)out.push(need.shift());else if(!flags[i]&&dark.length)out.push(dark.shift());else if(need.length){const t=need.shift();out.push(flags[i]?t:(out.includes('bath')||types.includes('bath')||rooms.some(r=>r.type==='bath')||rs[i][2]-rs[i][0]+rs[i][3]-rs[i][1]>16?'store':'bath'));}else out.push(dark.shift());}
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
  //   spiral           treads round a central post, a 300-degree turn per storey (4x4, a 1.9 m drum)
  //   L                right angle: a flight, a corner landing, a flight across; arrives on its side (5x5)
  // Any kind can stand in an exterior tower (a bump-out): a 2-cell landing strip along the house wall, open to the
  // hall, with the stair behind it; the L adds a strip down its side so its arrival also lands on the hall.
  const STAIRS={
    straight:{U:2,V:6,flights:[[0,2,0,6,'+v',16,0]],landings:[],entry:[[0,-1],[1,-1]],arrive:[[0,6],[1,6]],arriveDir:'-v',stacks:false},
    straightLanding:{U:2,V:8,flights:[[0,2,0,3,'+v',8,0],[0,2,5,8,'+v',8,8]],landings:[[0,2,3,5,8]],entry:[[0,-1],[1,-1]],arrive:[[0,8],[1,8]],arriveDir:'-v',stacks:false},
    dogleg:{U:4,V:5,flights:[[0,2,0,3,'+v',8,0],[2,4,0,3,'-v',8,8]],landings:[[0,4,3,5,8]],entry:[[0,-1],[1,-1]],arrive:[[2,-1],[3,-1]],arriveDir:'+v',stacks:true},
    u3:{U:6,V:5,flights:[[0,2,0,3,'+v',6,0],[2,4,3,5,'+u',4,6],[4,6,0,3,'-v',6,10]],landings:[[0,2,3,5,6],[4,6,3,5,10]],entry:[[0,-1],[1,-1]],arrive:[[4,-1],[5,-1]],arriveDir:'+v',stacks:true},
    spiral:{U:4,V:4,flights:[],landings:[],spiral:{cu:2,cv:2,r:1.9,post:.25,a0:-100*Math.PI/180,sweep:300*Math.PI/180},entry:[[0,-1],[1,-1]],arrive:[[2,-1],[3,-1]],arriveDir:'+v',stacks:true},
    L:{U:5,V:5,flights:[[0,2,0,3,'+v',8,0],[2,5,3,5,'+u',8,8]],landings:[[0,2,3,5,8]],entry:[[0,-1],[1,-1]],arrive:[[5,3],[5,4]],arriveDir:'-u',stacks:false,
      cells:[[0,2,0,5],[2,5,3,5]]}
  };
  const STAIR_LABELS={straight:'straight',straightLanding:'straight with a landing',dogleg:'U-turn',u3:'C-shaped',spiral:'spiral',L:'L-shaped'};
  const U_DIR={zp:'xp',zm:'xm',xp:'zm',xm:'zp'};
  function stairBay(kind,orient,bx,bz,storeys,tower=false){
    const S=STAIRS[kind],top=storeys-1,ox=0,ov=tower?2:0,U=tower&&kind==='L'?7:S.U,Vn=S.V+ov;
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
      if(S.spiral){const sp=S.spiral,rot={zp:0,zm:Math.PI,xp:-Math.PI/2,xm:Math.PI/2}[orient];spirals.push({from:f,centre:pt(sp.cu+ox,sp.cv+ov),r:sp.r,post:sp.post,a0:sp.a0+rot,sweep:sp.sweep,risers:16});}
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
  // Jettied buildings step out over the street: each upper floor starts one row (0.5 m) further forward than the
  // floor below, so the ground floor starts at row storeys-1 and the top floor at row 0. Unjettied: all at row 1.
  const z0Of=(plot,f)=>plot.jetty?plot.front-f:plot.front;
  const sideHall=(plot,v)=>plot.party[0]&&!plot.party[1]?true:plot.party[1]&&!plot.party[0]?false:v()<.5;

  // Side passage (and wing): a 4-cell strip on one side (2 stair cells against the wall, a 2-cell lane) with a row
  // of rooms beside it. Front and back rooms may run the full width; a wing continues behind on the passage side.
  function tSide(plot,v,wing){
    // A shop or workshop fills the ground floor's whole width and most of its depth; the living quarters (stair,
    // kitchen, bath) sit behind it through a door at its rear, and the home's own way in is the yard door.
    const {w,front,storeys}=plot,biz=['shophouse','workshop'].includes(plot.type),left=sideHall(plot,v),sx=left?0:w-4,stairX=left?0:w-2,laneX=left?2:w-4,rx0=left?4:0,rx1=left?w:w-4;
    const ww=wing?Math.min(w-2,ri(v,9,12)):0,wl=wing?ri(v,8,11):0,wing2=wing&&v()<.5,cap=plot.maxDepth?plot.maxDepth-wl-(plot.forceStair?.tower?(STAIRS[plot.forceStair.kind].V+2):0):1e9;
    const Lm=Math.min(cap,biz?ri(v,26,32):ri(v,22,27)),Dm=front+Lm;if(Lm<(biz?20:18))return null; // on a shaped lot the house fits the depth it has
    // Sometimes the stair moves out into a tower on the back wall at the end of the passage (more room inside).
    const FS=plot.forceStair,tk=FS?(FS.tower&&!wing?FS.kind:null):!wing&&storeys===2&&v()<.3?weighted(v,{dogleg:1,spiral:1,u3:1,L:1}):null,Ut=tk?(tk==='L'?7:STAIRS[tk].U):0,Vt=tk?STAIRS[tk].V+2:0,tbx=tk?Math.max(0,Math.min(w-Ut,left?sx:sx+4-Ut)):0;
    plot.d=Dm+wl+Vt;plot.masks=blankMasks(plot);
    plot.masks.forEach((m,f)=>{maskRect(plot,m,0,z0Of(plot,f),w,Dm);if(wing&&(f===0||wing2))maskRect(plot,m,left?0:w-ww,Dm,left?ww:w,Dm+wl);if(tk)maskRect(plot,m,tbx,Dm,tbx+Ut,Dm+Vt);});
    const progs=plot.programs;
    // Band choices per floor: a full-width front room (upper floors only) and a full-width back room.
    const frontFull=[biz,...Array.from({length:storeys-1},()=>v()<.55)],backFull=Array.from({length:storeys},(_,f)=>!wing&&!tk&&!(biz&&f===0)&&v()<(f===0?.5:.45));
    const fbLen=Array.from({length:storeys},(_,f)=>f===0&&biz?Lm-(wing?ri(v,8,9):ri(v,9,11)):ri(v,8,10)),bbLen=ri(v,7,9); // a shop runs back to the living area (the stair, and a kitchen unless the wing has it)
    // Hall rows per floor (the strip), which the stair and its landings must sit inside.
    const hallRows=f=>[z0Of(plot,f)+(frontFull[f]?fbLen[f]:0),Dm-(backFull[f]?bbLen:0)];
    const orient=v()<.6?'zp':'zm';
    // landings never sit in a row against an outside wall (the wall would leave a 30 cm landing)
    const inner=(z,f)=>z>z0Of(plot,f)&&z<Dm-1;
    const fits=L=>{const out=[];for(let a=front;a+L<=Dm;a++){const entryZ=orient==='zp'?a-1:a+L,arriveZ=orient==='zp'?a+L:a-1,[h0,h1]=hallRows(0),[u0,u1]=hallRows(1);
      if(a>=h0&&a+L<=h1&&a>=u0&&a+L<=u1&&entryZ>=h0&&entryZ<h1&&arriveZ>=u0&&arriveZ<u1&&inner(entryZ,0)&&inner(arriveZ,1))out.push(a);}return out;};
    let st;
    if(tk)st=stairBay(tk,'zp',tbx,Dm,storeys,true);
    else{let kind=FS&&!STAIRS[FS.kind].stacks?FS.kind:v()<.45?'straightLanding':'straight',okA=fits(STAIRS[kind].V);if(!okA.length){kind='straight';okA=fits(6);}if(!okA.length)return null;
      st=stairBay(kind,orient,stairX,okA[Math.min(okA.length-1,Math.floor(v()*okA.length))],storeys);}
    const floors=[],entrances=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=progs[f],z0=z0Of(plot,f),[h0,h1]=hallRows(f);
      F.fill(sx,z0,sx+4,Dm,1);
      if(frontFull[f])F.zone(0,z0,w,z0+fbLen[f],'x',[P.front[0]],v);
      if(backFull[f])F.zone(0,Dm-bbLen,w,Dm,'x',[P.back[0]],v);
      const row=[...(frontFull[f]?P.front.slice(1):P.front),...P.support,...(backFull[f]?P.back.slice(1):wing&&f===0?(biz?[]:['dining?']):P.back)];
      F.zone(rx0,h0,rx1,h1,'z',row,v);
      if(wing&&(f===0||wing2))F.zone(left?0:w-ww,Dm,left?ww:w,Dm+wl,'z',f===0?['kitchen','store']:[pick(v,['bath','bed'])],v);
      putStair(F,st,plot);floors.push(F);}
    const shop=floors[0].rooms.findIndex(r=>['shop','workshop'].includes(r.type));
    if(biz&&shop>1)entrances.push({floor:0,room:shop,side:'zm'});else entrances.push({floor:0,room:1,side:'zm',at:laneX});
    return {stair:st,floors,entrances};
  }

  // Central hall: a 2 m hall from the front door to a straight stair in the middle of the house, a row of rooms each
  // side. The hall stops at the landing past the stair; behind it, the back rooms run the full width (one room, or
  // two meeting at the hall's end), so no space is lost to a hall running the length of the house.
  function tCentre(plot,v){
    const {w,front,storeys}=plot,biz=['shophouse','workshop'].includes(plot.type),sx=Math.round((w-4)/2+(v()-.5)*2),stairLeft=v()<.5,stairX=stairLeft?sx:sx+2,cap=plot.maxDepth?plot.maxDepth-(plot.forceStair?.tower?STAIRS[plot.forceStair.kind].V+2:0):1e9,Lm=Math.min(cap,biz?ri(v,26,30):ri(v,22,26)),Dm=front+Lm,shopLen=biz?Lm-ri(v,9,11):0;
    if(Lm<(biz?20:18))return null;
    // the tower (if any) is decided first: the plot grows to hold it before the floor masks are made
    const FS=plot.forceStair,tk=FS?(FS.tower?FS.kind:null):storeys===2&&v()<.3?weighted(v,{dogleg:1,spiral:1,u3:1,L:1}):null,Ut=tk?(tk==='L'?7:STAIRS[tk].U):0,Vt=tk?STAIRS[tk].V+2:0,tbx=tk?Math.max(0,Math.min(w-Ut,sx+2-Math.round(Ut/2))):0;
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
    const he=tk||Dm-(st.rect[3]+2)<BB-2?Dm:st.rect[3]+2,sz0=st.rect[1],sz1=st.rect[3];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=plot.programs[f],shop=biz&&f===0,
        // when the stair stands far back (behind a shop), the front room runs the full width so the hall still only
        // spans the stair
        fb=!shop&&!tk&&sz0-z0Of(plot,f)>=12&&sz0-z0Of(plot,f)-ri(v,4,6)>=MINLEN[bare(P.front[0])]?sz0-z0Of(plot,f)-ri(v,4,6):0,z0=z0Of(plot,f)+(shop?shopLen:fb);
      F.fill(sx,z0,sx+4,he,1);
      if(shop||fb)F.zone(0,z0Of(plot,f),w,z0,'x',[P.front[0]],v);
      // back band: one room across, or two meeting at the middle of the hall's end so both open off it
      let back=P.back.slice(),used=0,support=P.support.slice();
      // T junction: a 1 m cross hall at the end of the hall, a room at each end of it and a small room (the bath)
      // behind it, so the back band holds three rooms instead of one or two
      let T=null;
      if(he<Dm&&Dm-he>=9&&back.length>1&&v()<.7){const A=bare(back[0]),B=bare(back[1]),bi=support.findIndex(t=>bare(t)==='bath'),M=bi>=0?'bath':back[2]?bare(back[2]):'store',lo=MINLEN[A],hi=sx;
        if(hi>=lo){const xL=ri(v,lo,hi),xr0=Math.max(sx+4,xL+Math.max(4,MINLEN[M])),xr1=w-MINLEN[B];if(xr1>=xr0)T={A,B,M,xL,xR:ri(v,xr0,xr1),bi};}}
      if(T){const swap=v()<.5,a=F.room(swap?T.B:T.A),b=F.room(swap?T.A:T.B);F.fill(0,he,T.xL,Dm,a);F.fill(T.xR,he,w,Dm,b);F.fill(T.xL,he,T.xR,he+2,1);F.fill(T.xL,he+2,T.xR,Dm,F.room(T.M));
        used=T.bi<0&&back[2]?3:2;if(T.bi>=0)support.splice(T.bi,1);}
      else if(he<Dm){const two=back.length>1&&sx+2>=MINLEN[bare(back[1])]&&w-sx-2>=MINLEN[bare(back[0])]&&v()<.75;
        if(two){const l=F.room(bare(back[1])),r=F.room(bare(back[0]));const left=v()<.5;F.fill(0,he,sx+2,Dm,left?r:l);F.fill(sx+2,he,w,Dm,left?l:r);used=2;}
        else{F.zone(0,he,w,Dm,'x',[back[0]],v);used=1;}}
      const rest=[...support,...back.slice(used)],half=Math.ceil(rest.length/2),fr=shop?[[],[]]:fb?[P.front.slice(1),[]]:[[P.front[0]],[P.front[1]||P.front[0]]];
      // Beside the stair the hall is only open in front of it and behind it, so that side holds at most two rooms:
      // one reaching the hall in front of the stair, one behind. The rest go to the open side.
      const rows=[[...fr[0],...rest.slice(0,half)],[...fr[1],...rest.slice(half)]],ss=stairLeft||tk?0:1,open=1-ss,sr=rows[ss].filter(t=>!t.endsWith('?')||rows[ss].length<=2);
      const xs=[[0,sx],[sx+4,w]],[ax,bx]=xs[ss],gapF=sz0-z0,gapB=he-sz1;
      if(tk||he===Dm&&gapB<2||!sr.length){F.zone(xs[0][0],z0,xs[0][1],he,'z',rows[0],v);F.zone(xs[1][0],z0,xs[1][1],he,'z',rows[1],v);}
      else{const two=sr.length>1&&gapF>=2&&gapB>=2&&he-z0>=MINLEN[bare(sr[0])]+MINLEN[bare(sr[1])],keep=two?sr.slice(0,2):(gapB>=2||gapF>=2?sr.slice(0,1):[]);
        const left=rows[ss].slice();for(const t of keep)left.splice(left.indexOf(t),1);rows[open].push(...left);
        if(two){const m=Math.max(z0+MINLEN[bare(keep[0])],Math.min(he-Math.max(2,MINLEN[bare(keep[1])]),Math.round((z0+he)/2)));F.zone(ax,z0,bx,m,'z',[keep[0]],v);F.zone(ax,m,bx,he,'z',[keep[1]],v);}
        else if(keep.length)F.zone(ax,z0,bx,he,'z',keep,v);
        F.zone(xs[open][0],z0,xs[open][1],he,'z',rows[open],v);}
      putStair(F,st,plot);floors.push(F);}
    return {stair:st,floors,entrances:biz?[{floor:0,room:floors[0].rooms.findIndex(r=>['shop','workshop'].includes(r.type)),side:'zm'}]:[{floor:0,room:1,side:'zm',at:stairLeft?sx+2:sx}]};
  }

  // Stair hall: a 4-cell-wide hall from the front door to a U-turn stair at the back, rooms either side.
  function tStairhall(plot,v){
    const {w,front,storeys}=plot,FS=plot.forceStair,tower=FS?!!FS.tower:v()<.3,k=FS&&STAIRS[FS.kind].stacks||FS&&FS.tower?FS.kind:weighted(v,{dogleg:2,spiral:1.2,u3:1,...(tower&&storeys===2?{L:1}:{})}),S=STAIRS[k],Ub=tower?4:S.U,Vb=tower?0:S.V;
    const hx=Math.round((w-Ub)/2),Lm=Math.min(plot.maxDepth?plot.maxDepth-(tower?S.V+2:0):1e9,ri(v,22,27)),Dm=front+Lm,Ut=k==='L'?7:S.U,Vt=S.V+2,tbx=Math.max(0,Math.min(w-Ut,hx+2-Math.round(Ut/2)));
    const bay=tower?stairBay(k,'zp',tbx,Dm,storeys,true):stairBay(k,'zp',hx,Dm-Vb,storeys);
    plot.d=Dm+(tower?Vt:0);plot.masks=blankMasks(plot);plot.masks.forEach((m,f)=>{maskRect(plot,m,0,z0Of(plot,f),w,Dm);if(tower)maskRect(plot,m,tbx,Dm,tbx+Ut,Dm+Vt);});
    const biz=['shophouse','workshop'].includes(plot.type),commonFront=plot.type==='inn'||biz,floors=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=plot.programs[f],z0=z0Of(plot,f),full=f===0?commonFront:v()<.4&&plot.type!=='inn'&&!biz,fb=f===0&&biz?Lm-Vb-2-ri(v,4,6):ri(v,9,12);
      const hz0=full?z0+fb:z0;F.fill(hx,hz0,hx+Ub,Dm,1);if(full)F.zone(0,z0,w,hz0,'x',[P.front[0]],v);
      const rest=[...(full?P.front.slice(1):P.front.slice(1)),...P.support,...P.back],half=Math.ceil(rest.length/2),first=full?[]:[P.front[0]];
      // the last room in each row must still reach past the stair bay to the hall
      F.zone(0,hz0,hx,Dm,'z',[...first,...rest.slice(0,half)],v,Vb+2);F.zone(hx+Ub,hz0,w,Dm,'z',[...(full?[]:[P.front[1]||P.front[0]]),...rest.slice(half)],v,Vb+2);
      putStair(F,bay,plot);floors.push(F);}
    return {stair:bay,floors,entrances:[{floor:0,room:commonFront?floors[0].rooms.findIndex(r=>['common','shop','workshop'].includes(r.type)):1,side:'zm',at:hx+Math.floor(Ub/2)-1}]};
  }

  // Cross passage (and cottage): front rooms side by side along the street, a 2-row passage across, back rooms side by
  // side behind with a U-turn stair opening off the passage. Terraces reach the passage by a front lobby; corner and
  // detached plots may use a side door instead. The cottage folds the ground-floor passage into the living room.
  function tCross(plot,v,cottage){
    const {w,front,storeys,party}=plot,biz=['shophouse','workshop'].includes(plot.type),spurUp=(!party[0]||!party[1])&&w>=14&&v()<.7,laneU=Math.round(w/2)-1+ri(v,-2,2),fb=biz?ri(v,11,14):spurUp?ri(v,10,13):ri(v,7,10),bb=ri(v,6,9),m=front+fb,D=m+2+bb;
    plot.d=D;plot.masks=blankMasks(plot);plot.masks.forEach((m_,f)=>maskRect(plot,m_,0,z0Of(plot,f),w,D));
    const k=plot.forceStair&&STAIRS[plot.forceStair.kind].stacks?plot.forceStair.kind:weighted(v,{dogleg:2,spiral:1.2,u3:w>=16?1:0}),Ub=STAIRS[k].U,Vb=STAIRS[k].V,e=pick(v,[0,w-Ub,0,w-Ub,Math.round((w-Ub)/2)]),bay=stairBay(k,'zp',e,D-Vb,storeys); // at the back, with a lobby in front off the passage
    const openSide=!party[0]?'xm':!party[1]?'xp':null,sideDoor=!cottage&&openSide&&v()<.6,laneAt=['shophouse','workshop'].includes(plot.type)?pick(v,[0,w-2]):pick(v,[0,w-2,Math.round(w/2)-1]),floors=[],entrances=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P0=plot.programs[f],z0=z0Of(plot,f);
      const backRanges=[[0,e],[e+Ub,w]].filter(([a,b])=>b-a>=3);
      // Rooms that do not fit behind the passage (narrow plots) move to the front band instead of being dropped.
      let cap=backRanges.reduce((a,[x0,x1])=>a+x1-x0,0);const back=[],moved=[];
      const sup=[...P0.support].sort((a,b)=>(bare(b)==='bath')-(bare(a)==='bath')); // the bath keeps its place at the back; a store moves forward first
      for(const t of [P0.back[0],...sup,...P0.back.slice(1)]){const need=MINLEN[bare(t)];if(need<=cap){back.push(t);cap-=need;}else if(!t.endsWith('?'))moved.push(t);}
      // on a shop's ground floor the front band stays all shop; what does not fit behind is left out
      const P={front:biz&&f===0?[P0.front[0]]:[...P0.front,...moved],support:[],back};
      // The cottage's living room takes the passage too; on a wide plot a dining room opens off one end of it.
      if(f===0&&cottage){const liv=F.room('living');F.fill(0,z0,w,m+2,liv);if(w>=18){const dw=ri(v,7,9),left=v()<.5,dn=F.room('dining');F.fill(left?0:w-dw,z0,left?dw:w,m-1,dn);}}
      else{F.fill(0,m,w,m+2,1);
        if(f===0&&!sideDoor&&plot.type!=='inn'&&!biz){F.fill(laneAt,z0,laneAt+2,m,1);const parts=[[0,laneAt],[laneAt+2,w]].filter(([a,b])=>b-a>=4).sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]));
          parts.forEach(([a,b],k)=>F.zone(a,z0,b,m,'x',parts.length===1?P.front:k===0?[P.front[0]]:P.front.slice(1),v));
          // a sliver too thin for a room joins the lobby
          for(const [a,b] of [[0,laneAt],[laneAt+2,w]])if(b-a>0&&b-a<4)F.fill(a,z0,b,m,1);}
        // upper floors: a spur hall from the passage to the front wall splits the front band; a part against an open
        // side wall takes a room at the street and one behind it, both opening off the spur
        else if(spurUp&&f>0&&m-z0>=12){F.fill(laneU,z0,laneU+2,m,1);const parts=[[0,laneU],[laneU+2,w]],open=([a,b])=>a===0&&!party[0]||b===w&&!party[1];
          const L=P.front.slice(),take=[];parts.forEach(pt=>take.push(open(pt)?L.splice(0,2):[]));parts.forEach((pt,i)=>{if(!open(pt))take[i]=L.splice(0,Math.max(1,Math.ceil(L.length/(parts.filter((q,j)=>j>=i&&!open(q)).length||1))));});
          parts.forEach(([a,b],i)=>{if(!take[i].length)take[i]=[pick(v,['store','study'])];F.zone(a,z0,b,m,open([a,b])&&take[i].length>1?'z':'x',take[i],v);});}
        else F.zone(0,z0,w,m,'x',P.front,v);}
      const backList=P.back;
      const share=backRanges.map(([a,b])=>b-a),tot=share.reduce((x,y)=>x+y,0);let k=0;
      backRanges.forEach(([a,b],i)=>{const n=i===backRanges.length-1?backList.length-k:Math.max(1,Math.round(backList.length*share[i]/tot));F.zone(a,m+2,b,D,'x',backList.slice(k,k+n),v);k+=n;});
      // the cells between the passage and the stair are its lobby (part of the living room in a cottage)
      putStair(F,bay,plot);const lobby=f===0&&cottage?F.rooms.findIndex(r=>r.type==='living'):1;
      for(let z=m+2;z<D;z++)for(let x=e;x<e+Ub;x++)if(F.grid[x+plot.w*z]===-1&&plot.masks[f][x+plot.w*z])F.grid[x+plot.w*z]=lobby;
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
    const {w,front,storeys}=plot,k=plot.forceStair&&STAIRS[plot.forceStair.kind].stacks?plot.forceStair.kind:weighted(v,{dogleg:2,spiral:1.5,u3:1}),Ub=STAIRS[k].U,Vb=STAIRS[k].V,fb=ri(v,10,12),ww=Math.min(ri(v,8,9),Math.floor((w-8)/2)),wl=ri(v,12,16),D=front+fb+wl,zc=front+fb,left=v()<.5,tx=left?ww:w-ww-Ub;
    if(ww<7)return null;
    plot.d=D;plot.masks=blankMasks(plot);
    plot.masks.forEach((m,f)=>{maskRect(plot,m,0,z0Of(plot,f),w,zc);maskRect(plot,m,0,zc,ww,D);maskRect(plot,m,w-ww,zc,w,D);maskRect(plot,m,tx,zc,tx+Ub,zc+Vb);});
    if(w-2*ww<Ub+2)return null;
    const bay=stairBay(k,'zp',tx,zc,storeys),floors=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=plot.programs[f],z0=z0Of(plot,f);
      F.fill(0,zc-2,w,zc,1);F.fill(0,zc,2,D,1);F.fill(w-2,zc,w,D,1);
      if(f===0){const k=F.room(P.front[0]);F.fill(0,z0,w,zc-2,k);}else F.zone(0,z0,w,zc-2,'x',P.front,v);
      const wingsL=f===0?['kitchen','store']:[P.back[0],...P.support.slice(0,1),'guest?'],wingsR=f===0?[...P.support]:[P.back[1]||P.back[0],...P.support.slice(1),P.back[2]||'guest?'];
      F.zone(2,zc,ww,D,'z',wingsL,v);F.zone(w-ww,zc,w-2,D,'z',wingsR,v);
      putStair(F,bay,plot);floors.push(F);}
    return {stair:bay,floors,entrances:[{floor:0,room:2,side:'zm'}]};
  }
  const BUILD={side:(p,v)=>tSide(p,v,false),wing:(p,v)=>tSide(p,v,true),centre:tCentre,stairhall:tStairhall,cross:(p,v)=>tCross(p,v,false),cottage:(p,v)=>tCross(p,v,!['shophouse','workshop'].includes(p.type)),courtyard:tCourtyard};

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
    const {grid,rooms}=F,{w}=plot,runs=sharedRuns(plot,grid).filter(r=>r.cells.length>=2&&rooms[r.a].type!=='stair'&&rooms[r.b].type!=='stair');
    const links=runs.filter(r=>canLink(rooms[r.a].type,rooms[r.b].type)),cost=r=>{const A=rooms[r.a].type,B=rooms[r.b].type;return (A==='hall'||B==='hall'?0:ROOMS[A].circ||ROOMS[B].circ?1:2)+(r.cells.length<3?.5:0);};
    const reached=new Set([startRoom]),doors=[];
    while(true){let best=null;
      for(const l of links){const ina=reached.has(l.a),inb=reached.has(l.b);if(ina===inb)continue;const from=ina?l.a:l.b;
        if(ROOMS[rooms[from].type].leaf)continue;const c=cost(l);if(!best||c<best.c)best={l,c};}
      if(!best)break;reached.add(best.l.a);reached.add(best.l.b);doors.push(doorOn(best.l,rooms));}
    for(const l of links){if(!['dining|kitchen','kitchen|living','common|kitchen'].includes(pairKey(rooms[l.a].type,rooms[l.b].type)))continue;
      if(doors.some(dr=>(dr.a===l.a&&dr.b===l.b)||(dr.a===l.b&&dr.b===l.a)))continue;doors.push(doorOn(l,rooms));}
    for(const o of F.open){const k=grid[o.cells[0][0]+w*o.cells[0][1]];if(k<0||!ROOMS[rooms[k].type].circ)continue;doors.push({a:k,b:0,dir:o.dir,cells:o.cells,kind:'open'});if(reached.has(k))reached.add(0);}
    return {doors,reached};
  }
  function doorOn(run,rooms){const n=run.cells.length,circSide=ROOMS[rooms[run.a].type].circ||ROOMS[rooms[run.b].type].circ;
    const start=n<=3?Math.floor((n-2)/2):circSide?1:n-3;return {a:run.a,b:run.b,dir:run.dir,cells:run.cells.slice(start,start+2),kind:'door'};}

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
  // Exterior openings: front doors from the typology (the home's own door, the business door), a back door from the
  // kitchen, and windows spaced along each room's outside walls (none on party walls). Shops get a shopfront.
  function placeOpenings(plot,F,entrances,reached){
    const {grid,rooms,f}=F,{w,d}=plot,mask=plot.masks[f],edges=new Map();
    for(let z=0;z<d;z++)for(let x=0;x<w;x++){const g=grid[x+w*z];if(g<1)continue;
      for(const e of exteriorSides(plot,mask,x,z)){if(e.party)continue;const key=`${g}-${e.side}-${e.side[0]==='x'?x:z}`;if(!edges.has(key))edges.set(key,{room:g,side:e.side,cells:[]});edges.get(key).cells.push([x,z]);}}
    const lines=[];for(const e of edges.values()){e.cells.sort((p,q)=>p[0]-q[0]||p[1]-q[1]);for(const run of runsOf(e.cells))lines.push({room:e.room,side:e.side,cells:run});}
    const openings=[],street='zm',taken=new Set(),take=o=>{openings.push(o);for(const c of o.cells)taken.add(o.side+c.join(','));};
    if(f===0){
      // a street door is on the street row itself (not a back tower's wall that happens to face the same way)
      const streetRow=Math.min(...[...mask.keys()].filter(i=>mask[i]).map(i=>Math.floor(i/w)));
      for(const en of entrances){if(en.room<0)continue;const l=lines.filter(l=>l.room===en.room&&l.side===en.side&&l.cells.length>=2&&(en.side!=='zm'||l.cells[0][1]===streetRow)).sort((a,b)=>b.cells.length-a.cells.length)[0];if(!l)continue;
        const n=l.cells.length,type=rooms[en.room].type,free=l.cells.map((c,i)=>i).filter(i=>i+1<n&&!taken.has(l.side+l.cells[i].join(','))&&!taken.has(l.side+l.cells[i+1].join(',')));if(!free.length)continue;
        // a business door goes to the end of its frontage away from the home's door, so the two entrances are
        // apart and the shopfront runs between them
        let s=free[Math.floor(free.length/2)];if(['shop','workshop'].includes(type)){const home=openings.find(o=>o.kind==='front');const ref=home?home.cells[0][0]:w/2;s=free.sort((a,b)=>Math.abs(l.cells[b][0]-ref)-Math.abs(l.cells[a][0]-ref))[0];}
        if(en.at!==undefined&&type==='hall'){const near=free.filter(i=>l.cells[i][0]===en.at);if(near.length)s=near[0];}
        take({room:en.room,side:l.side,cells:l.cells.slice(s,s+2),kind:'front'});}
      const kit=rooms.findIndex(r=>r.type==='kitchen'),back=lines.filter(l=>l.room===kit&&l.side!==street&&l.cells.length>=3).sort((a,b)=>(b.side==='zp')-(a.side==='zp')||b.cells.length-a.cells.length)[0];
      // an extension the house does not reach inside opens onto the yard
      if(reached)rooms.forEach((rm,k)=>{if(k<2||reached.has(k)||!rm.cells&&!grid.includes(k))return;const yl=lines.filter(l=>l.room===k&&(l.side!==street||rm.extension)&&l.cells.length>=2&&l.cells.every(c=>!taken.has(l.side+c.join(',')))).sort((a,b)=>(a.side===street)-(b.side===street)||b.cells.length-a.cells.length)[0]; // a street-facing extension may have its own street door
        if(yl){const i=Math.floor((yl.cells.length-2)/2);take({room:k,side:yl.side,cells:yl.cells.slice(i,i+2),kind:'back'});}});
      if(kit>=0&&back){const n=back.cells.length,s=n>=6?n-3:Math.floor((n-2)/2);take({room:kit,side:back.side,cells:back.cells.slice(s,s+2),kind:'back'});}
      else{const hb=lines.filter(l=>l.room===1&&l.side!==street&&l.cells.length>=2).sort((a,b)=>(b.side==='zp')-(a.side==='zp'))[0];if(hb)take({room:1,side:hb.side,cells:hb.cells.slice(0,2),kind:'back'});}}
    for(const l of lines){const type=rooms[l.room].type;if(type==='hall'&&l.cells.length<3)continue;
      const free=l.cells.filter(c=>!taken.has(l.side+c.join(',')));
      if(f===0&&l.side===street&&l.cells[0][1]===Math.min(...[...mask.keys()].filter(i=>mask[i]).map(i=>Math.floor(i/w)))&&['shop','workshop','common'].includes(type)){for(const run of runsOf(free))if(run.length>=2)take({room:l.room,side:l.side,cells:run.slice(0,run.length-(run.length>5?1:0)),kind:type==='common'?'bay':'shopfront'});continue;}
      // Windows sit on one grid per wall: a 1 m opening every 2 m, centred on the wall and starting on an even cell
      // so it falls between the timber posts. Every floor uses the same grid, so windows stack. Baths, stores and
      // halls take one high window; a room with no grid slot free gets one centred window instead.
      const small=type==='bath'||type==='store'||type==='hall',alongX=l.side[0]==='z',phase=gridPhase(alongX?w:d);
      const coord=c=>alongX?c[0]:c[1],here=()=>openings.some(o=>o.room===l.room&&o.kind!=='front'&&o.kind!=='back');let first=true;
      for(const run of runsOf(free).sort((a,b)=>b.length-a.length)){const slots=[];for(let i=0;i+1<run.length;i++)if(((coord(run[i])-phase)%4+4)%4===0)slots.push(i);
        const pickSlots=small?(slots.length&&!here()?[slots.sort((a,b)=>Math.abs(a+1-run.length/2)-Math.abs(b+1-run.length/2))[0]]:[]):slots;
        for(const i of pickSlots){take({room:l.room,side:l.side,cells:run.slice(i,i+2),kind:small?'small':l.side===street&&f>0&&type==='living'&&first?'balcony':'window'});first=false;}}
      if(!here()&&ROOMS[type].light){const run=runsOf(free).sort((a,b)=>b.length-a.length)[0];if(run&&run.length>=2){const i=Math.floor((run.length-2)/2);take({room:l.room,side:l.side,cells:run.slice(i,i+2),kind:'window'});}}}
    return openings;
  }

  // Score: lower is better. Hard failures (unreachable, windowless or misshapen rooms) are listed in notes.
  function scoreFloor(plot,F,reached,openings){
    const {rooms,grid}=F,{w}=plot,notes=[];let s=0;
    rooms.forEach((room,k)=>{let x0=1e9,z0=1e9,x1=-1,z1=-1,n=0;for(let i=0;i<grid.length;i++)if(grid[i]===k){const x=i%w,z=Math.floor(i/w);n++;x0=Math.min(x0,x);z0=Math.min(z0,z);x1=Math.max(x1,x);z1=Math.max(z1,z);}
      room.cells=n;room.box=n?[x0,z0,x1,z1]:null;if(k<2||!n)return;const R=ROOMS[room.type],bw=x1-x0+1,bd=z1-z0+1,a=n*CELL*CELL,minW=Math.min(bw,bd);
      if(minW<R.minW)s+=(R.minW-minW)*15;if(a<R.minA)s+=(R.minA-a)*6;const asp=Math.max(bw,bd)/minW;if(asp>2.6)s+=(asp-2.6)*12;
      if(n<bw*bd&&!R.circ){s+=300;notes.push(room.type+' not rectangular');}
      if(!reached.has(k)&&!openings.some(o=>o.room===k&&(o.kind==='back'||o.kind==='front'))){s+=500;notes.push(room.type+' unreachable');}
      if(R.light&&!openings.some(o=>o.room===k&&o.kind!=='front'&&o.kind!=='back')){s+=200;notes.push(room.type+' windowless');}});
    if(rooms[0].cells&&!reached.has(0)){s+=500;notes.push('stair unreachable');}
    const hallCells=rooms[1].cells||0;if(hallCells&&rooms.length>2)s+=Math.max(0,hallCells*CELL*CELL-14)*.8; // halls are for walking, not living
    // more lived-in rooms (with a window) is better: a hall that serves an extra bedroom earns its space
    s-=rooms.filter((r,k)=>k>=2&&r.cells&&ROOMS[r.type].light&&!ROOMS[r.type].circ&&openings.some(o=>o.room===k&&o.kind!=='front'&&o.kind!=='back')).length*10;
    return {score:s,notes};
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
    const w=Math.round(between(r,T.frontage)/CELL),storeys=T.storeys[1]>T.storeys[0]?(r()<(T.tall??.5)?T.storeys[1]:T.storeys[0]):T.storeys[0];
    return {seed,type:typeId,context:contextId,party:CONTEXTS[contextId].party.slice(),w,d:0,front:opts.jetty?Math.max(1,storeys-1):1,storeys,jetty:!!opts.jetty};
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
    const Dl=ri(r,32,44),P=[];let pts;
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
    const opts=[];for(let w=Math.min(wb,L1-L0);w>=Math.max(12,Math.min(wb,L1-L0)-6);w-=2)for(const ox of [L0,L1-w,L0+Math.floor((L1-L0-w)/2)]){const d=depthAt(ox,w);opts.push({ox,w,d,s:w*Math.min(d,28)+(d>=20?200:0)+r()});}
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
    const P2={...P,w:W,d:D,masks,lot:{kind:lot.kind,mask:lot.mask,main:{ox,w:P.w,d:P.d}}};
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
        const sc=shared*2+Math.min(edge,12)+area*.25;if(!best||sc>best.sc)best={sc,r:[x0,z0,x1,z1],area};}}
      if(!best)break;const [x0,z0,x1,z1]=best.r,m2=best.area*CELL*CELL;
      // the extension's use: preferred by building type and size, but always one that can open off a room it touches
      const adj=new Set();for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(nx>=x0&&nx<=x1&&nz>=z0&&nz<=z1)continue;if(nx<0||nz<0||nx>=W||nz>=D)continue;const g=F0.grid[nx+W*nz];if(g>1)adj.add(F0.rooms[g].type);else if(g===1)adj.add('hall');}
      const prefs=biz?(made===0&&m2>=7?['workshop','store']:['store','workshop']):type==='inn'?(m2>=9&&made===0?['dining','store','workshop']:['store','dining']):(m2>=8&&made===0?[pick(v,['study','workshop','dining']),'workshop','dining','store']:['store','workshop','study']);
      const t=prefs.find(t=>[...adj].some(a=>canLink(t,a)))||prefs[0];
      const k=F0.rooms.length;F0.rooms.push({type:t,extension:true});for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){F0.grid[x+W*z]=k;masks[0][x+W*z]=1;}made++;}
    return {P:P2,floors,stair,entrances};
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
    seed=Number(seed)>>>0;const r=rng(hash('building:'+seed)),styleId=opts.style||pick(r,Object.keys(STYLES)),style=STYLES[styleId];
    const plot=makePlot(seed,{...opts,jetty:opts.jetty??(style.jettyOk&&r()<.6)});
    // The lot: rectangular by default for a plain plot, else one of the shaped lots (chosen per building).
    const lr=rng(hash('lot:'+seed)),lotKind=opts.lot??(lr()<.55?pick(lr,Object.keys(LOTS).filter(k=>k!=='rect')):'rect');let lot=null,main=null;
    if(lotKind!=='rect'){lot=makeLot(lotKind,lr,plot.front,plot.w+ri(lr,0,8));main=placeMain(lot,plot.w,plot.front,lr);if(main&&main.w>=12&&main.maxDepth>=16){plot.w=main.w;plot.maxDepth=main.maxDepth;}else{lot=null;main=null;}}
    const typology=chooseTypology(plot,rng(hash('typology:'+seed)),opts.typology);
    let best=null;const C=opts.candidates||10,stairPick=chooseStair(plot,typology,rng(hash('stair:'+seed)));
    for(let c=0;c<C;c++){const v=rng(hash(`variant:${seed}:${c}`)),pr=rng(hash(`program:${seed}:${c}`)),P={...plot,party:plot.party.slice()};
      P.programs=Array.from({length:P.storeys},(_,f)=>program(P.type,f,P.storeys-1,pr));
      P.forceStair=opts.stair||stairPick; // {kind, tower}
      let T=BUILD[typology](P,v),PP=P;if(!T)continue;
      if(lot){if(P.d-P.front>main.maxDepth)continue;const L2=pasteAndExtend(P,T,lot,main,v);
        // a variant whose wing or stair tower would cross the lot line is no good here
        if(L2.P.masks.some(m=>m.some((v_,i)=>v_&&Math.floor(i/L2.P.w)>=P.front&&!lot.mask[i])))continue;
        PP=L2.P;T={...T,floors:L2.floors,stair:L2.stair,entrances:L2.entrances};}
      const floors=T.floors.map(F=>{const arrive=F.f===0?null:F.open.map(o=>F.grid[o.cells[0][0]+PP.w*o.cells[0][1]]).find(k=>k>0&&ROOMS[F.rooms[k].type].circ);
        const start=F.f===0?(T.entrances.find(e=>e.floor===0&&e.room>0&&ROOMS[F.rooms[e.room].type].circ)?.room??1):(arrive??1);
        const {doors,reached}=placeDoors(PP,F,start),openings=placeOpenings(PP,F,T.entrances,F.f===0?reached:null),sc=scoreFloor(PP,F,reached,openings);return {F,doors,openings,...sc};});
      const score=floors.reduce((a,x)=>a+x.score,0);if(!best||score<best.score)best={score,P:PP,T,floors,candidate:c};}
    if(!best&&lot)return generate(seed,{...opts,lot:'rect'}); // the lot was too tight for this typology
    if(!best)throw new Error(`no ${typology} plan for seed ${seed}`);
    const {P,T}=best,sampled=sampleLook(styleId,P,seed),look={facade:{...sampled.facade,...(opts.look?.facade||{})},roof:{...sampled.roof,...(opts.look?.roof||{})}};
    // the turret stands mostly outside the corner and opens about one cell into it; keep doors out of that cell
    if(P.lot)look.roof.turret=null; // a turret needs a free corner of the main block, which a lot rarely leaves
    if(look.roof.turret){const xs=look.roof.turret.side==='xm'?[0,1]:[P.w-2,P.w-1],z0=P.front;
      if(best.floors.some(({openings})=>openings.some(o=>o.kind!=='window'&&o.kind!=='small'&&o.cells.some(([x,z])=>x>=xs[0]&&x<=xs[1]&&z<=z0+1))))look.roof.turret=null;}
    return {revision:REVISION,seed,type:P.type,typeLabel:TYPES[P.type].label,typology,typologyLabel:TYPOLOGIES[typology].label,style:styleId,styleLabel:style.label,context:P.context,cell:CELL,storey:STOREY,
      facade:look.facade,roof:look.roof,lotKind:P.lot?P.lot.kind:'rect',lotLabel:LOTS[P.lot?P.lot.kind:'rect'],
      plot:{w:P.w,d:P.d,front:P.front,jetty:P.jetty,party:P.party,context:P.context,masks:P.masks.map(m=>Array.from(m)),lot:P.lot?{kind:P.lot.kind,mask:Array.from(P.lot.mask),main:P.lot.main}:null},
      stair:{kind:T.stair.kind,label:STAIR_LABELS[T.stair.kind]+(T.stair.tower?' in a tower':''),tower:T.stair.tower,orient:T.stair.orient,rect:T.stair.rect,flights:T.stair.flights,landings:T.stair.landings,spirals:T.stair.spirals},
      floors:best.floors.map(({F,doors,openings,score,notes})=>({level:F.f,grid:Array.from(F.grid),rooms:F.rooms.map((room,k)=>({id:k,type:room.type,label:ROOMS[room.type].label,area:+((room.cells||0)*CELL*CELL).toFixed(2),box:room.box,cells:room.cells||0,...(room.extension?{extension:true}:{})})),
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

  const api={CELL,STOREY,REVISION,ROOMS,TYPES,TYPOLOGIES,STYLES,CONTEXTS,STAIRS,STAIR_LABELS,LOTS,isPartyEdge,makeLot,hash,rng,makePlot,stairBay,generate,ascii,canLink,sharedRuns,gridPhase,sampleLook};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.BuildingPlan=api;
})(typeof globalThis==='object'?globalThis:this);
