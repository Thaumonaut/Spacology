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
  //   centre     a hall down the middle with a straight stair in it, rooms either side
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
      if(type==='shophouse')return {front:['shop'],support:['store','bath'],back:['kitchen','dining?']};
      if(type==='workshop')return {front:['workshop'],support:['store','office?'],back:['kitchen','bath?']};
      if(type==='inn')return {front:['common'],support:['office','store','bath?'],back:['kitchen','store?']};
      const a=r()<.5;return {front:a?['living','study']:['living','dining'],support:['bath','store?'],back:a?['kitchen','dining?']:['kitchen','study?']};}
    if(type==='inn')return {front:['guest','guest','guest?'],support:['bath','store?'],back:['guest',f===top?'bed':'guest','guest?']};
    if(type==='home')return r()<.7?{front:['bed','bed'],support:['bath','store?'],back:['bed','study?']}:{front:['living','bed?'],support:['bath','store?'],back:['bed','bed?']};
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
          for(let i=0;i<types.length;i++){if(flags[i]&&need.length)out.push(need.shift());else if(!flags[i]&&dark.length)out.push(dark.shift());else if(need.length){const t=need.shift();out.push(flags[i]?t:(out.includes('bath')||types.includes('bath')||rs[i][2]-rs[i][0]+rs[i][3]-rs[i][1]>16?'store':'bath'));}else out.push(dark.shift());}
          types=out;}
        const rs=rects(types);return types.map((t,k)=>{const k2=F.room(t),[a,b,c,e]=rs[k];F.fill(a,b,c,e,k2);return k2;});}};
    return F;}
  // Mask helpers.
  const blankMasks=(plot)=>Array.from({length:plot.storeys},()=>new Uint8Array(plot.w*plot.d));
  const maskRect=(plot,m,x0,z0,x1,z1)=>{for(let z=Math.max(0,z0);z<Math.min(plot.d,z1);z++)for(let x=Math.max(0,x0);x<Math.min(plot.w,x1);x++)m[x+plot.w*z]=1;};

  // --- Stairs -------------------------------------------------------------------------------------------------------
  // A stair is a bay of cells in local coordinates (u across the lanes, v along the climb) placed with an origin and an
  // orientation (the direction of +v). straight: one 2x6 flight of 16 risers (18.75 cm) per floor, entered at v = -1
  // and arrived at v = 6; only for 2 storeys. dogleg: a 4x5 bay; a flight of 8 risers up lane u 0-1, a half landing
  // across v 3-4, and 8 more back down lane u 2-3; entry and arrival are side by side at v = -1, so it stacks.
  function stairBay(kind,orient,bx,bz,storeys){
    const U=kind==='straight'?2:4,Vn=kind==='straight'?6:5,top=storeys-1;
    const at=(u,v)=>orient==='zp'?[bx+u,bz+v]:orient==='zm'?[bx+(U-1-u),bz+(Vn-1-v)]:orient==='xp'?[bx+v,bz+(U-1-u)]:[bx+(Vn-1-v),bz+u];
    const rectOf=(u0,v0,u1,v1)=>{const ps=[at(u0,v0),at(u1-1,v1-1)];return [Math.min(ps[0][0],ps[1][0]),Math.min(ps[0][1],ps[1][1]),Math.max(ps[0][0],ps[1][0])+1,Math.max(ps[0][1],ps[1][1])+1];};
    const cells=[];for(let u=0;u<U;u++)for(let v=0;v<Vn;v++)cells.push(at(u,v));
    const flights=[],landings=[],floors=Array.from({length:storeys},()=>({steps:[],voids:[],open:[]}));
    const asc=cs=>cs.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),edge=(u0,u1,v)=>({cells:asc([u0,u1-1].map(u=>at(u,v))),dir:orient}); // hall-side cells, door direction into the bay
    for(let f=0;f<top;f++){
      if(kind==='straight'){flights.push({from:f,rect:rectOf(0,0,2,6),dir:orient,risers:16,start:0});
        floors[f].open.push(edge(0,2,-1));floors[f+1].open.push({cells:asc([0,1].map(u=>at(u,6))),dir:OPP[orient]});}
      else{flights.push({from:f,rect:rectOf(0,0,2,3),dir:orient,risers:8,start:0},{from:f,rect:rectOf(2,0,4,3),dir:OPP[orient],risers:8,start:8});
        landings.push({from:f,rect:rectOf(0,3,4,5),rise:8});floors[f].open.push(edge(0,2,-1));floors[f+1].open.push(edge(2,4,-1));}
      for(const c of cells)floors[f].steps.push(c);}
    for(let f=1;f<storeys;f++)for(const c of cells)floors[f].voids.push(c);
    // Straight stairs leave the head of the flight over the lower floor; only the flight cells are void.
    return {kind,orient,cells,rect:rectOf(0,0,U,Vn),flights,landings,floors,need:{entry:kind==='straight'?[at(0,-1),at(1,-1)]:[at(0,-1),at(1,-1)],arrive:kind==='straight'?[at(0,6),at(1,6)]:[at(2,-1),at(3,-1)]}};
  }
  const putStair=(F,st,plot)=>{const S=st.floors[F.f];for(const [x,z] of [...S.steps,...S.voids])F.grid[x+plot.w*z]=0;
    F.steps=S.steps.map(([x,z])=>x+plot.w*z);F.voids=S.voids.map(([x,z])=>x+plot.w*z);F.open=S.open;};

  // --- Typologies ---------------------------------------------------------------------------------------------------
  // Each takes the plot (w, front, storeys, party, type, jetty) and a variant rng, sets the footprint masks and
  // returns {stair, floors, entrances:[{room, side}]} where floors are built Floor objects.
  const z0Of=(plot,f)=>f>0&&plot.jetty?0:plot.front;
  const sideHall=(plot,v)=>plot.party[0]&&!plot.party[1]?true:plot.party[1]&&!plot.party[0]?false:v()<.5;

  // Side passage (and wing): a 4-cell strip on one side (2 stair cells against the wall, a 2-cell lane) with a row
  // of rooms beside it. Front and back rooms may run the full width; a wing continues behind on the passage side.
  function tSide(plot,v,wing){
    const {w,front,storeys}=plot,left=sideHall(plot,v),sx=left?0:w-4,stairX=left?0:w-2,laneX=left?2:w-4,rx0=left?4:0,rx1=left?w:w-4;
    const Lm=ri(v,22,27),Dm=front+Lm,ww=wing?Math.min(w-2,ri(v,9,12)):0,wl=wing?ri(v,8,11):0,wing2=wing&&v()<.5;
    plot.d=Dm+wl;plot.masks=blankMasks(plot);
    plot.masks.forEach((m,f)=>{maskRect(plot,m,0,z0Of(plot,f),w,Dm);if(wing&&(f===0||wing2))maskRect(plot,m,left?0:w-ww,Dm,left?ww:w,Dm+wl);});
    const progs=plot.programs;
    // Band choices per floor: a full-width front room (upper floors only) and a full-width back room.
    const frontFull=[false,...Array.from({length:storeys-1},()=>v()<.55)],backFull=Array.from({length:storeys},(_,f)=>!wing&&v()<(f===0?.5:.45));
    const fbLen=ri(v,8,10),bbLen=ri(v,7,9);
    // Hall rows per floor (the strip), which the stair and its landings must sit inside.
    const hallRows=f=>[z0Of(plot,f)+(frontFull[f]?fbLen:0),Dm-(backFull[f]?bbLen:0)];
    const orient=v()<.6?'zp':'zm',okA=[];
    for(let a=front;a+6<=Dm;a++){const entryZ=orient==='zp'?a-1:a+6,arriveZ=orient==='zp'?a+6:a-1,[h0,h1]=hallRows(0),[u0,u1]=hallRows(1);
      if(a>=h0&&a+6<=h1&&a>=u0&&a+6<=u1&&entryZ>=h0&&entryZ<h1&&arriveZ>=u0&&arriveZ<u1)okA.push(a);}
    if(!okA.length)return null;
    const pos=v(),a=okA[Math.min(okA.length-1,Math.floor(pos*okA.length))],st=stairBay('straight',orient,stairX,orient==='zp'?a:a,storeys);
    const floors=[],entrances=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=progs[f],z0=z0Of(plot,f),[h0,h1]=hallRows(f);
      F.fill(sx,z0,sx+4,Dm,1);
      if(frontFull[f])F.zone(0,z0,w,z0+fbLen,'x',[P.front[0]],v);
      if(backFull[f])F.zone(0,Dm-bbLen,w,Dm,'x',[P.back[0]],v);
      const row=[...(frontFull[f]?P.front.slice(1):P.front),...P.support,...(backFull[f]?P.back.slice(1):wing&&f===0?['dining?']:P.back)];
      F.zone(rx0,h0,rx1,h1,'z',row,v);
      if(wing&&(f===0||wing2))F.zone(left?0:w-ww,Dm,left?ww:w,Dm+wl,'z',f===0?['kitchen','store']:[pick(v,['bath','bed'])],v);
      putStair(F,st,plot);floors.push(F);}
    entrances.push({floor:0,room:1,side:'zm',at:laneX});
    const biz=floors[0].rooms.findIndex(r=>['shop','workshop','living'].includes(r.type));if(biz>1&&floors[0].rooms[biz].type!=='living')entrances.push({floor:0,room:biz,side:'zm'});
    return {stair:st,floors,entrances};
  }

  // Central hall: hall lane and straight stair down the middle, a row of rooms each side.
  function tCentre(plot,v){
    const {w,front,storeys}=plot,sx=Math.round((w-4)/2+(v()-.5)*2),stairLeft=v()<.5,stairX=stairLeft?sx:sx+2,Lm=ri(v,22,26),Dm=front+Lm;
    plot.d=Dm;plot.masks=blankMasks(plot);plot.masks.forEach((m,f)=>maskRect(plot,m,0,z0Of(plot,f),w,Dm));
    const backFull=Array.from({length:storeys},()=>v()<.45),bbLen=ri(v,7,9),orient=v()<.6?'zp':'zm',okA=[];
    for(let a=front;a+6<=Dm-(backFull[0]||backFull[1]?bbLen:0);a++){const e=orient==='zp'?a-1:a+6,ar=orient==='zp'?a+6:a-1,lim=Dm-(backFull[0]||backFull[1]?bbLen:0);if(e>=front&&e<lim&&ar>=front&&ar<lim)okA.push(a);}
    if(!okA.length)return null;const a=okA[Math.floor(v()*okA.length)],st=stairBay('straight',orient,stairX,a,storeys),floors=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=plot.programs[f],z0=z0Of(plot,f),h1=Dm-(backFull[f]?bbLen:0);F.fill(sx,z0,sx+4,Dm,1);
      if(backFull[f])F.zone(0,h1,w,Dm,'x',[P.back[0]],v);
      const rest=[...P.support,...(backFull[f]?P.back.slice(1):P.back)],half=Math.ceil(rest.length/2);
      F.zone(0,z0,sx,h1,'z',[P.front[0],...rest.slice(0,half)],v);F.zone(sx+4,z0,w,h1,'z',[P.front[1]||P.front[0],...rest.slice(half)],v);
      putStair(F,st,plot);floors.push(F);}
    return {stair:st,floors,entrances:[{floor:0,room:1,side:'zm',at:stairLeft?sx+2:sx}]};
  }

  // Stair hall: a 4-cell-wide hall from the front door to a U-turn stair at the back, rooms either side.
  function tStairhall(plot,v){
    const {w,front,storeys}=plot,hx=Math.round((w-4)/2),Lm=ri(v,22,27),Dm=front+Lm,bay=stairBay('dogleg','zp',hx,Dm-5,storeys);
    plot.d=Dm;plot.masks=blankMasks(plot);plot.masks.forEach((m,f)=>maskRect(plot,m,0,z0Of(plot,f),w,Dm));
    const commonFront=plot.type==='inn',floors=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=plot.programs[f],z0=z0Of(plot,f),full=f===0?commonFront:v()<.4&&plot.type!=='inn',fb=ri(v,9,12);
      const hz0=full?z0+fb:z0;F.fill(hx,hz0,hx+4,Dm,1);if(full)F.zone(0,z0,w,hz0,'x',[P.front[0]],v);
      const rest=[...(full?P.front.slice(1):P.front.slice(1)),...P.support,...P.back],half=Math.ceil(rest.length/2),first=full?[]:[P.front[0]];
      // the last room in each row must still reach past the stair bay to the hall
      F.zone(0,hz0,hx,Dm,'z',[...first,...rest.slice(0,half)],v,7);F.zone(hx+4,hz0,w,Dm,'z',[...(full?[]:[P.front[1]||P.front[0]]),...rest.slice(half)],v,7);
      putStair(F,bay,plot);floors.push(F);}
    return {stair:bay,floors,entrances:[{floor:0,room:commonFront?floors[0].rooms.findIndex(r=>r.type==='common'):1,side:'zm',at:hx+1}]};
  }

  // Cross passage (and cottage): front rooms side by side along the street, a 2-row passage across, back rooms side by
  // side behind with a U-turn stair opening off the passage. Terraces reach the passage by a front lobby; corner and
  // detached plots may use a side door instead. The cottage folds the ground-floor passage into the living room.
  function tCross(plot,v,cottage){
    const {w,front,storeys,party}=plot,fb=ri(v,7,10),bb=ri(v,6,9),m=front+fb,D=m+2+bb;
    plot.d=D;plot.masks=blankMasks(plot);plot.masks.forEach((m_,f)=>maskRect(plot,m_,0,z0Of(plot,f),w,D));
    const e=pick(v,[0,w-4,0,w-4,Math.round((w-4)/2)]),bay=stairBay('dogleg','zp',e,D-5,storeys); // at the back, with a lobby in front off the passage
    const openSide=!party[0]?'xm':!party[1]?'xp':null,sideDoor=!cottage&&openSide&&v()<.6,laneAt=['shophouse','workshop'].includes(plot.type)?pick(v,[0,w-2]):pick(v,[0,w-2,Math.round(w/2)-1]),floors=[],entrances=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P0=plot.programs[f],z0=z0Of(plot,f);
      const backRanges=[[0,e],[e+4,w]].filter(([a,b])=>b-a>=3);
      // Rooms that do not fit behind the passage (narrow plots) move to the front band instead of being dropped.
      let cap=backRanges.reduce((a,[x0,x1])=>a+x1-x0,0);const back=[],moved=[];
      const sup=[...P0.support].sort((a,b)=>(bare(b)==='bath')-(bare(a)==='bath')); // the bath keeps its place at the back; a store moves forward first
      for(const t of [P0.back[0],...sup,...P0.back.slice(1)]){const need=MINLEN[bare(t)];if(need<=cap){back.push(t);cap-=need;}else if(!t.endsWith('?'))moved.push(t);}
      const P={front:[...P0.front,...moved],support:[],back};
      // The cottage's living room takes the passage too; on a wide plot a dining room opens off one end of it.
      if(f===0&&cottage){const liv=F.room('living');F.fill(0,z0,w,m+2,liv);if(w>=18){const dw=ri(v,7,9),left=v()<.5,dn=F.room('dining');F.fill(left?0:w-dw,z0,left?dw:w,m-1,dn);}}
      else{F.fill(0,m,w,m+2,1);
        if(f===0&&!sideDoor&&plot.type!=='inn'){F.fill(laneAt,z0,laneAt+2,m,1);const parts=[[0,laneAt],[laneAt+2,w]].filter(([a,b])=>b-a>=4).sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]));
          parts.forEach(([a,b],k)=>F.zone(a,z0,b,m,'x',parts.length===1?P.front:k===0?[P.front[0]]:P.front.slice(1),v));
          // a sliver too thin for a room joins the lobby
          for(const [a,b] of [[0,laneAt],[laneAt+2,w]])if(b-a>0&&b-a<4)F.fill(a,z0,b,m,1);}
        else F.zone(0,z0,w,m,'x',P.front,v);}
      const backList=P.back;
      const share=backRanges.map(([a,b])=>b-a),tot=share.reduce((x,y)=>x+y,0);let k=0;
      backRanges.forEach(([a,b],i)=>{const n=i===backRanges.length-1?backList.length-k:Math.max(1,Math.round(backList.length*share[i]/tot));F.zone(a,m+2,b,D,'x',backList.slice(k,k+n),v);k+=n;});
      // the cells between the passage and the stair are its lobby (part of the living room in a cottage)
      putStair(F,bay,plot);const lobby=f===0&&cottage?F.rooms.findIndex(r=>r.type==='living'):1;
      for(let z=m+2;z<D;z++)for(let x=e;x<e+4;x++)if(F.grid[x+plot.w*z]===-1&&plot.masks[f][x+plot.w*z])F.grid[x+plot.w*z]=lobby;
      floors.push(F);}
    if(cottage)entrances.push({floor:0,room:floors[0].rooms.findIndex(r=>r.type==='living'),side:'zm'});
    else if(plot.type==='inn')entrances.push({floor:0,room:floors[0].rooms.findIndex(r=>r.type==='common'),side:'zm'});
    else if(sideDoor)entrances.push({floor:0,room:1,side:openSide});
    else entrances.push({floor:0,room:1,side:'zm',at:laneAt});
    const biz=floors[0].rooms.findIndex(r=>['shop','workshop'].includes(r.type));if(biz>1)entrances.push({floor:0,room:biz,side:'zm'});
    return {stair:bay,floors,entrances};
  }

  // Courtyard: a front block across the street, two wings round a courtyard, galleries on the outer walls so every
  // room looks onto the courtyard (party walls do not matter), and a stair tower in a courtyard corner.
  function tCourtyard(plot,v){
    const {w,front,storeys}=plot,fb=ri(v,10,12),ww=Math.min(ri(v,8,9),Math.floor((w-8)/2)),wl=ri(v,12,16),D=front+fb+wl,zc=front+fb,left=v()<.5,tx=left?ww:w-ww-4;
    if(ww<7)return null;
    plot.d=D;plot.masks=blankMasks(plot);
    plot.masks.forEach((m,f)=>{maskRect(plot,m,0,z0Of(plot,f),w,zc);maskRect(plot,m,0,zc,ww,D);maskRect(plot,m,w-ww,zc,w,D);maskRect(plot,m,tx,zc,tx+4,zc+5);});
    const bay=stairBay('dogleg','zp',tx,zc,storeys),floors=[];
    for(let f=0;f<storeys;f++){const F=Floor(plot,f),P=plot.programs[f],z0=z0Of(plot,f);
      F.fill(0,zc-2,w,zc,1);F.fill(0,zc,2,D,1);F.fill(w-2,zc,w,D,1);
      if(f===0){const k=F.room(P.front[0]);F.fill(0,z0,w,zc-2,k);}else F.zone(0,z0,w,zc-2,'x',P.front,v);
      const wingsL=f===0?['kitchen','store']:[P.back[0],...P.support.slice(0,1),'guest?'],wingsR=f===0?[...P.support]:[P.back[1]||P.back[0],...P.support.slice(1),P.back[2]||'guest?'];
      F.zone(2,zc,ww,D,'z',wingsL,v);F.zone(w-ww,zc,w-2,D,'z',wingsR,v);
      putStair(F,bay,plot);floors.push(F);}
    return {stair:bay,floors,entrances:[{floor:0,room:2,side:'zm'}]};
  }
  const BUILD={side:(p,v)=>tSide(p,v,false),wing:(p,v)=>tSide(p,v,true),centre:tCentre,stairhall:tStairhall,cross:(p,v)=>tCross(p,v,false),cottage:(p,v)=>tCross(p,v,true),courtyard:tCourtyard};

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
  function exteriorSides(plot,mask,x,z){
    const out=[];for(const [dx,dz,s] of DIRS){const nx=x+dx,nz=z+dz,inside=nx>=0&&nz>=0&&nx<plot.w&&nz<plot.d&&mask[nx+plot.w*nz];
      if(inside)continue;const party=(s==='xm'&&nx<0&&plot.party[0])||(s==='xp'&&nx>=plot.w&&plot.party[1]);out.push({side:s,party});}
    return out;
  }
  // Exterior openings: front doors from the typology (the home's own door, the business door), a back door from the
  // kitchen, and windows spaced along each room's outside walls (none on party walls). Shops get a shopfront.
  function placeOpenings(plot,F,entrances){
    const {grid,rooms,f}=F,{w,d}=plot,mask=plot.masks[f],edges=new Map();
    for(let z=0;z<d;z++)for(let x=0;x<w;x++){const g=grid[x+w*z];if(g<1)continue;
      for(const e of exteriorSides(plot,mask,x,z)){if(e.party)continue;const key=`${g}-${e.side}-${e.side[0]==='x'?x:z}`;if(!edges.has(key))edges.set(key,{room:g,side:e.side,cells:[]});edges.get(key).cells.push([x,z]);}}
    const lines=[];for(const e of edges.values()){e.cells.sort((p,q)=>p[0]-q[0]||p[1]-q[1]);for(const run of runsOf(e.cells))lines.push({room:e.room,side:e.side,cells:run});}
    const openings=[],street='zm',taken=new Set(),take=o=>{openings.push(o);for(const c of o.cells)taken.add(o.side+c.join(','));};
    if(f===0){
      for(const en of entrances){if(en.room<0)continue;const l=lines.filter(l=>l.room===en.room&&l.side===en.side&&l.cells.length>=2).sort((a,b)=>b.cells.length-a.cells.length)[0];if(!l)continue;
        const n=l.cells.length,type=rooms[en.room].type,free=l.cells.map((c,i)=>i).filter(i=>i+1<n&&!taken.has(l.side+l.cells[i].join(','))&&!taken.has(l.side+l.cells[i+1].join(',')));if(!free.length)continue;
        // a business door goes to the end of its frontage nearest the home's door, leaving the rest as shopfront
        let s=free[Math.floor(free.length/2)];if(['shop','workshop'].includes(type)){const home=openings.find(o=>o.kind==='front');const ref=home?home.cells[0][0]:w/2;s=free.sort((a,b)=>Math.abs(l.cells[a][0]-ref)-Math.abs(l.cells[b][0]-ref))[0];}
        if(en.at!==undefined&&type==='hall'){const near=free.filter(i=>l.cells[i][0]===en.at);if(near.length)s=near[0];}
        take({room:en.room,side:l.side,cells:l.cells.slice(s,s+2),kind:'front'});}
      const kit=rooms.findIndex(r=>r.type==='kitchen'),back=lines.filter(l=>l.room===kit&&l.side!==street&&l.cells.length>=3).sort((a,b)=>(b.side==='zp')-(a.side==='zp')||b.cells.length-a.cells.length)[0];
      if(kit>=0&&back){const n=back.cells.length,s=n>=6?n-3:Math.floor((n-2)/2);take({room:kit,side:back.side,cells:back.cells.slice(s,s+2),kind:'back'});}}
    for(const l of lines){const type=rooms[l.room].type;if(type==='hall'&&l.cells.length<3)continue;
      const free=l.cells.filter(c=>!taken.has(l.side+c.join(',')));
      if(f===0&&l.side===street&&['shop','workshop','common'].includes(type)){for(const run of runsOf(free))if(run.length>=2)take({room:l.room,side:l.side,cells:run.slice(0,run.length-(run.length>5?1:0)),kind:type==='common'?'bay':'shopfront'});continue;}
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
      if(!reached.has(k)){s+=500;notes.push(room.type+' unreachable');}
      if(R.light&&!openings.some(o=>o.room===k&&o.kind!=='front'&&o.kind!=='back')){s+=200;notes.push(room.type+' windowless');}});
    if(rooms[0].cells&&!reached.has(0)){s+=500;notes.push('stair unreachable');}
    const hallCells=rooms[1].cells||0;if(hallCells&&rooms.length>2)s+=Math.max(0,hallCells*CELL*CELL-14)*.8; // halls are for walking, not living
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
    const mid=Math.floor(plot.w/2);
    roof.cross=roof.ridge==='frontage'&&plot.w>=14&&chance(S.crossGable)?{x0:mid-3-(plot.w>=20?1:0),x1:mid+3+(plot.w>=20?1:0),depth:ri(r,6,9)}:null;
    roof.dormers=roof.ridge==='frontage'&&!roof.cross&&roof.form!=='hip'&&chance(S.dormers)?ri(r,1,3):0;
    const sides=[!plot.party[0]?'xm':null,!plot.party[1]?'xp':null].filter(Boolean);
    roof.turret=sides.length&&chance(S.turret)?{side:pick(r,sides),r:ri(r,11,15),rise:ri(r,18,30)}:null;
    facade.oriels=chance(S.oriels)?ri(r,1,2):0;
    return {facade,roof};
  }
  function makePlot(seed,opts={}){
    const r=rng(hash('plot:'+seed)),typeId=opts.type||pick(r,Object.keys(TYPES)),T=TYPES[typeId],contextId=opts.context||pick(r,['terrace','terrace','corner','detached']);
    const w=Math.round(between(r,T.frontage)/CELL),storeys=T.storeys[1]>T.storeys[0]?(r()<(T.tall??.5)?T.storeys[1]:T.storeys[0]):T.storeys[0];
    return {seed,type:typeId,context:contextId,party:CONTEXTS[contextId].party.slice(),w,d:0,front:1,storeys,jetty:!!opts.jetty};
  }
  // The typology is chosen per building from the type's weights, among those that suit the plot.
  function chooseTypology(plot,r,forced){
    if(forced)return forced;const T=TYPES[plot.type],ok={};
    for(const [k,wt] of Object.entries(T.typologies)){const Y=TYPOLOGIES[k];if(plot.w<Y.minW||(Y.straight&&plot.storeys>2))continue;ok[k]=wt*(k==='courtyard'&&plot.context==='terrace'?.5:1)*(k==='cross'&&plot.context==='corner'?1.3:1)*(k==='stairhall'&&plot.type==='inn'&&plot.context!=='detached'?.4:1);}
    return Object.keys(ok).length?weighted(r,ok):'cross';
  }

  function generate(seed,opts={}){
    seed=Number(seed)>>>0;const r=rng(hash('building:'+seed)),styleId=opts.style||pick(r,Object.keys(STYLES)),style=STYLES[styleId];
    const plot=makePlot(seed,{...opts,jetty:opts.jetty??(style.jettyOk&&r()<.6)}),typology=chooseTypology(plot,rng(hash('typology:'+seed)),opts.typology);
    let best=null;const C=opts.candidates||10;
    for(let c=0;c<C;c++){const v=rng(hash(`variant:${seed}:${c}`)),pr=rng(hash(`program:${seed}:${c}`)),P={...plot,party:plot.party.slice()};
      P.programs=Array.from({length:P.storeys},(_,f)=>program(P.type,f,P.storeys-1,pr));
      const T=BUILD[typology](P,v);if(!T)continue;
      const floors=T.floors.map(F=>{const arrive=F.f===0?null:F.open.map(o=>F.grid[o.cells[0][0]+P.w*o.cells[0][1]]).find(k=>k>0&&ROOMS[F.rooms[k].type].circ);
        const start=F.f===0?(T.entrances.find(e=>e.floor===0&&e.room>0&&ROOMS[F.rooms[e.room].type].circ)?.room??1):(arrive??1);
        const {doors,reached}=placeDoors(P,F,start),openings=placeOpenings(P,F,T.entrances),sc=scoreFloor(P,F,reached,openings);return {F,doors,openings,...sc};});
      const score=floors.reduce((a,x)=>a+x.score,0);if(!best||score<best.score)best={score,P,T,floors,candidate:c};}
    if(!best)throw new Error(`no ${typology} plan for seed ${seed}`);
    const {P,T}=best,sampled=sampleLook(styleId,P,seed),look={facade:{...sampled.facade,...(opts.look?.facade||{})},roof:{...sampled.roof,...(opts.look?.roof||{})}};
    // the turret stands mostly outside the corner and opens about one cell into it; keep doors out of that cell
    if(look.roof.turret){const xs=look.roof.turret.side==='xm'?[0,1]:[P.w-2,P.w-1],z0=P.front;
      if(best.floors.some(({openings})=>openings.some(o=>o.kind!=='window'&&o.kind!=='small'&&o.cells.some(([x,z])=>x>=xs[0]&&x<=xs[1]&&z<=z0+1))))look.roof.turret=null;}
    return {revision:REVISION,seed,type:P.type,typeLabel:TYPES[P.type].label,typology,typologyLabel:TYPOLOGIES[typology].label,style:styleId,styleLabel:style.label,context:P.context,cell:CELL,storey:STOREY,
      facade:look.facade,roof:look.roof,plot:{w:P.w,d:P.d,front:P.front,jetty:P.jetty,party:P.party,masks:P.masks.map(m=>Array.from(m))},
      stair:{kind:T.stair.kind,orient:T.stair.orient,rect:T.stair.rect,flights:T.stair.flights,landings:T.stair.landings},
      floors:best.floors.map(({F,doors,openings,score,notes})=>({level:F.f,grid:Array.from(F.grid),rooms:F.rooms.map((room,k)=>({id:k,type:room.type,label:ROOMS[room.type].label,area:+((room.cells||0)*CELL*CELL).toFixed(2),box:room.box,cells:room.cells||0})),
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

  const api={CELL,STOREY,REVISION,ROOMS,TYPES,TYPOLOGIES,STYLES,CONTEXTS,hash,rng,makePlot,stairBay,generate,ascii,canLink,sharedRuns,gridPhase,sampleLook};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.BuildingPlan=api;
})(typeof globalThis==='object'?globalThis:this);
