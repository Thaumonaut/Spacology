// Shared shell/interior dimensions. Canonical buildings are cached; placement is a transform.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../town-kit.js'),require('./content-kit.js'));else root.TownInteriors=factory(root.TownKit,root.TownInteriorContent);})(this,function(K,Content){
'use strict';
const cache=new Map(),M=K.M;
const box=(x,y,z,w,h,d,col,role,extra={})=>({t:'box',x,y,z,w,h,d,col,role,...extra});
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
function point(p,s){const c=Math.cos(s.rot||0),n=Math.sin(s.rot||0);return {x:s.x+p.x*c-p.z*n,y:s.floor+p.y,z:s.z+p.x*n+p.z*c};}
function blueprint(s){const key=[s.variant,s.shell,s.w,s.d,s.storeys,s.storeyHeight,s.stairs,!!s.closet,s.upperPlan,!!s.partyLeft,!!s.partyRight,!!s.blankBack,...s.roofCol].join('|');if(cache.has(key)){const b=cache.get(key);cache.delete(key);cache.set(key,b);return b;}const b=K.building({id:'shell',variant:s.variant,shell:s.shell,x:0,z:0,w:s.w,d:s.d,storeys:s.storeys,storeyHeight:s.storeyHeight,floor:0,ground:()=>-4,streetHeight:()=>0,roofCol:s.roofCol,decorative:true,partyLeft:s.stairs==='left'?s.partyRight:s.partyLeft,partyRight:s.stairs==='left'?s.partyLeft:s.partyRight,blankBack:s.blankBack,interiorStair:s.storeys>1,interiorMode:true,interiorWindows:{closet:!!s.closet,smallRooms:s.upperPlan==='small_rooms'}});cache.set(key,b);while(cache.size>32)cache.delete(cache.keys().next().value);return b;}
function door(id,x,y,z,rot=0){return {id,x,y,z,rot,w:1.07,h:2.4,open:false};}
function doorParts(d,open=d.open){const side=d.hingeSide||-1,sign=-side,angle=open?side*Math.PI/2:0,w=d.w,hinge=side*w/2,parts=[box(sign*w/2,0,0,w,d.h,.075,M.timber,'door-leaf',{pat:6}),box(sign*(w-.12),1.05,.09,.065,.09,.12,M.brass,'door-handle'),...[.3,1.15,2.05].map(y=>({t:'cyl',x:0,y,z:0,r:.025,h:.12,col:[.24,.22,.17],role:'door-hinge'}))];return K.transform(K.transform(parts,hinge,0,0,angle),d.x,d.y,d.z,d.rot);}
function reflectParts(parts){return parts.map(p=>{const q={...p};if(p.x!=null)q.x=-p.x;if(p.x0!=null){q.x0=-p.x0;q.x1=-p.x1;}if(p.rot!=null)q.rot=-p.rot;return q;});}
function floorWithHole(p,y,hole){const x0=p.x-p.w/2,x1=p.x+p.w/2,z0=p.z-p.d/2,z1=p.z+p.d/2,parts=[];const add=(a,b,c,d)=>{if(b-a>.01&&d-c>.01)parts.push(box((a+b)/2,y-.18,(c+d)/2,b-a,.18,d-c,[.5,.36,.23],'interior-floor',{pat:6}));};add(x0,hole.x0,z0,z1);add(hole.x1,x1,z0,z1);add(hole.x0,hole.x1,z0,hole.z0);add(hole.x0,hole.x1,hole.z1,z1);return parts;}
// Multi-wing compounds use independently enterable wings around a shared
// outdoor court. Joined faces are solid; court-facing doors remain accessible.
function compound(options,profile){
 const s={id:'home',x:0,z:0,floor:.28,rot:0,seed:1,includeInterior:true,...profile,...options},kind=s.variant,mainDepth=kind==='towerWorkshop'?11:9,wingLength=s.d-mainDepth-.2;
 if(s.stairs==='left')throw Error('Compound stairs currently use the authored wing layouts');if(s.w<20||wingLength<8)throw Error('Compound footprint too small');
 const main=create({...s,variant:kind==='courtyardInn'?'inn':kind==='towerWorkshop'?'smithy':'house',x:0,z:s.d/2-mainDepth/2,floor:0,rot:0,w:s.w,d:mainDepth,storeys:s.storeys,blankBack:true}),modules=[main],sides=kind==='courtyardInn'?[-1,1]:[kind==='towerWorkshop'?1:-1],parts=[...main.parts];
 for(const side of sides){const wing=create({...s,id:s.id+':wing:'+side,variant:kind==='courtyardInn'?'inn':kind==='towerWorkshop'?'towerhouse':'house',x:side*(s.w/2-4),z:-s.d/2+wingLength/2,floor:0,rot:side>0?Math.PI/2:-Math.PI/2,w:wingLength,d:8,storeys:kind==='courtyardInn'?2:kind==='towerWorkshop'?3:1,partyLeft:side<0,partyRight:side>0});modules.push(wing);parts.push(...wing.parts,box(side*(s.w/2-4),0,s.d/2-mainDepth-.1,8,Math.min(s.storeys,wing.spec.storeys)*3.2,.22,M.stone,'wing-junction'));}
 const court={x0:-s.w/2+(sides.includes(-1)?8:0),x1:s.w/2-(sides.includes(1)?8:0),z0:-s.d/2,z1:s.d/2-mainDepth};parts.push(box((court.x0+court.x1)/2,-.12,(court.z0+court.z1)/2,court.x1-court.x0,.12,court.z1-court.z0,[.65,.61,.5],'courtyard-floor',{pat:3}));
 const P=p=>point(p,s),D=d=>({...d,...P(d),rot:(d.rot||0)+s.rot}),stair=main.stair?{...main.stair,start:P(main.stair.start),end:P(main.stair.end)}:null;
 return {id:s.id,spec:s,profile:kind,parts:K.transform(parts,s.x,s.floor,s.z,s.rot),doors:modules.flatMap(m=>m.doors.map(D)),entry:P(main.entry),entries:modules.map(m=>P(m.entry)),rooms:modules.flatMap((m,i)=>m.rooms.map(r=>({...r,id:i+':'+r.id,label:(i?'Wing '+i+' · ':'')+r.label}))),destinations:modules.flatMap(m=>m.destinations.map(d=>({...d,...P(d)}))),floors:main.floors.map(y=>y+s.floor),stair,route:main.route.map(P),footprint:{x:s.x,z:s.z,w:s.w,d:s.d,rot:s.rot,floor:s.floor},modules:modules.map(m=>({id:m.id,entry:P(m.entry),rot:(m.spec.rot||0)+s.rot,floors:m.floors.map(y=>y+s.floor),stair:m.stair?{...m.stair,start:P(m.stair.start),end:P(m.stair.end)}:null})),cacheSize:cache.size};
}
function create(options={}){
 const profile=Content.profiles[options.variant||'house'];if(!profile)throw Error('Interior plan not available for '+options.variant);if(profile.family==='compound')return compound(options,profile);
 const s={id:'home',stairs:'right',upperPlan:'rooms',floorplan:'auto',variant:'house',shell:'gable',w:8,d:8,x:0,z:0,floor:.28,rot:0,seed:1,includeInterior:true,roofCol:[.29,.4,.43],storeyHeight:3.2,...profile,...options};
 if(!['left','right'].includes(s.stairs))throw Error('Unknown stair position');if(!['rooms','loft','small_rooms'].includes(s.upperPlan))throw Error('Unknown upstairs plan');
 if(s.closet&&(profile.family!=='home'||s.w<7||s.d<8))throw Error('Closets require a home at least 7 × 8 metres');
 if(s.w<(s.storeys>1?6:4)||s.d<(s.variant==='smithy'?10.5:s.storeys>1?8:5))throw Error('Footprint too small for this interior plan');if(!Number.isInteger(s.storeys)||s.storeys<1||s.storeys>6)throw Error('Interior plans support one to six storeys');
 const linen=[[.37,.46,.47],[.48,.32,.3],[.4,.43,.3]][hash(s.seed)%3],base=blueprint(s),entry=base.sockets.door,H=s.storeyHeight,F=H+.08,N=Math.ceil(F/.16),floors=Array.from({length:s.storeys},(_,i)=>i?i*H+.08:0),front=entry.z-.17,doors=[door(s.id+':front',entry.x,0,entry.z-.24)],parts=[...base.parts],rooms=[],localDestinations=[],stairX=s.w/2-.95,stairStart=front-1.4,stairEnd=stairStart-5.6,hole={x0:stairX-.62,x1:stairX+.62,z0:stairEnd,z1:stairStart};
 if(s.includeInterior||s.movableEntrance)for(let i=parts.length-1;i>=0;i--){const p=parts[i];if((p.role==='pane'||p.role==='handle')&&p.y<1.2&&Math.abs(p.x-entry.x)<.8&&Math.abs(p.z-(entry.z-.24))<.4)parts.splice(i,1);}
 if(s.includeInterior){
  // Remove both the floorboards and the full-span storey beam that capped the stairs.
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];if(p.role==='ground-floor'){parts[i]={...p,pat:6,noJitter:true};continue;}if(p.role==='ground-floor-frame'){parts[i]={...p,h:p.h-.025};continue;}if((p.role==='freight-crate'&&p.x>hole.x0&&p.z>stairEnd&&p.z<stairStart+1)||p.role==='upper-floor'||p.role==='upper-frame'||(p.t==='box'&&p.w>=s.w*.8&&p.d>=s.d*.5&&p.h<=.25&&floors.slice(1).some(y=>Math.abs(p.y-y)<.3)))parts.splice(i,1);
   else if((p.role==='pane'||p.role==='handle')&&p.y<.1+1.1&&Math.abs(p.x-entry.x)<.8&&Math.abs(p.z-(entry.z-.24))<.4)parts.splice(i,1);
  }
  const plate=base.parts.find(p=>p.role==='upper-floor')||base.parts.find(p=>p.role==='ground-floor');if(!plate)throw Error('Shell has no floor plate');
  for(let level=1;level<s.storeys;level++){const baseY=floors[level-1],top=floors[level],rise=top-baseY;parts.push(...floorWithHole(plate,top,hole));
  for(let i=0;i<N;i++){const z1=stairStart-5.6*i/N,z0=stairStart-5.6*(i+1)/N;parts.push(box(stairX,level===1?baseY:baseY+(i+1)*rise/N-.18,(z0+z1)/2,1.24,level===1?(i+1)*rise/N:.18,z1-z0,[.49,.34,.21],'interior-stair',{pat:6}));}
  // A continuous handrail follows the stairs; a guard protects the open upper landing.
  parts.push({t:'beam',x0:hole.x0+.05,y0:baseY+.95,z0:stairStart,x1:hole.x0+.05,y1:top+.95,z1:stairEnd,s:.08,col:M.timber,role:'stair-handrail'});
  for(let i=0;i<=8;i++){const t=i/8;parts.push(box(hole.x0+.05,baseY+rise*t,stairStart+(stairEnd-stairStart)*t,.065,.95,.065,M.timber,'stair-baluster'));}
  const guardLeft=hole.x0-.08,guardRight=s.w/2-.65;
  if(level===s.storeys-1)parts.push(box(guardLeft,top,hole.z1,.1,1,.1,M.timber,'landing-guard'),box((guardLeft+guardRight)/2,top+.95,hole.z1+.09,guardRight-guardLeft,.1,.1,M.timber,'landing-guard'),box(guardRight,top,hole.z1+.09,.1,1,.1,M.timber,'landing-guard'));
  parts.push(box(guardLeft,top+.95,(hole.z0+hole.z1)/2,.1,.1,hole.z1-hole.z0,M.timber,'landing-guard'));for(let i=0;i<=8;i++)parts.push(box(guardLeft,top,hole.z0+(hole.z1-hole.z0)*i/8,.07,.95,.07,M.timber,'landing-guard'));
  }
  // Interior casings connect to the existing reveals, with their own recessed
  // mullions. The shell's glass and exterior frames remain the same assembly.
  const windows=parts.filter(p=>p.role==='pane'&&p.pat!==6&&p.y>.3);
  for(const window of windows){const w=window.w-.04,h=window.h,col=[.44,.32,.21],trim=[];
   for(const sign of [-1,1])trim.push(box(sign*(w/2+.015),-.03,-.13,.12,h+.08,.24,col,'interior-window-jamb'));
   trim.push(box(0,h-.03,-.13,w+.27,.12,.24,col,'interior-window-header'),box(0,-.12,-.13,w+.3,.14,.38,col,'interior-window-sill'),box(0,.02,-.16,.07,h-.05,.1,M.timber,'interior-window-mullion'));
   const len=(w-.07)/2;for(const sign of [-1,1])trim.push(box(sign*(len+.07)/2,h*.55,-.16,len,.07,.1,M.timber,'interior-window-crossbar'));
   parts.push(...K.transform(trim.map(p=>({...p,noJitter:true})),window.x,window.y,window.z,window.rot||0));
  }
  const partition=(id,x,y,z,w,rot=0,height=H-.14)=>{const bay=K.wallBay({w,h:height,opening:'door',col:[.78,.72,.61],timber:true,threshold:false});parts.push(...K.transform(bay.parts.filter(p=>!['pane','handle'].includes(p.role)).map(p=>({...p,interiorPartition:true})),x,y,z,rot));const p=point({x:0,y:0,z:-.07},{x,y:0,z,floor:y,rot});doors.push(door(s.id+':'+id,p.x,p.y,p.z,rot));};
  const family=profile.family,openHall=['pub','inn','warehouse','smithy'].includes(family),layout=s.floorplan||'auto',divided=layout==='rear'||layout==='front_room'||(layout==='auto'&&!openHall&&s.storeys>1);if(!['auto','rear','open','front_room'].includes(layout))throw Error('Unknown floor plan');
  if(divided){if(s.w<6||s.d<8)throw Error('Divided plans require at least 6 × 8 metres');const frontRoom=layout==='front_room';partition('pantry',-.65,0,frontRoom?front-2.6:-s.d/2+2.7,s.w-2.1,0,(s.storeys>1?F:H)-.14);rooms.push({id:'front',label:frontRoom?'Entrance room':family==='home'?'Living room':'Shop floor',level:0},{id:'pantry',label:frontRoom?'Rear hall':family==='home'?'Kitchen':'Stockroom',level:0});}
  else rooms.push({id:'front',label:family==='pub'?'Taproom':family==='inn'?'Common room & reception':family==='warehouse'?'Receiving hall':family==='smithy'?'Workshop':family==='home'||family==='slum'?'Living space':'Shop floor',level:0});
  for(let level=1;level<s.storeys;level++){
   if(family!=='warehouse'&&s.upperPlan==='small_rooms'){
    const length=plate.d-.5;for(const side of [-1,1]){partition('bedroom-'+level+'-'+side,-.45,floors[level],plate.z+side*length/4,length/2,Math.PI/2);rooms.push({id:'bedroom-'+level+'-'+side,label:side<0?'Rear bedroom':'Front bedroom',level});}
    const left=-s.w/2+.35;parts.push(box((left-.45)/2,floors[level],plate.z,-.45-left,H-.14,.14,[.78,.72,.61],'room-divider',{interiorPartition:true}));
   }else if(family!=='warehouse'&&s.upperPlan!=='loft'){partition(level===1?'bedroom':'bedroom-'+level,-.45,floors[level],plate.z,plate.d-.5,Math.PI/2);rooms.push({id:'bedroom-'+level,label:family==='inn'?'Guest room '+level:family==='slum'?'Shared sleeping room':'Bedroom',level});}
   rooms.push({id:'landing-'+level,label:s.upperPlan==='loft'?'Open loft '+level:family==='warehouse'?'Storage loft '+level:'Upstairs landing',level});
  }
  if(s.closet){const cx=-s.w/2+1.3,z=-s.d/2+1.5;partition('closet',cx,0,z,1.8,0,(s.storeys>1?F:H)-.14);parts.push(box(cx+.9,0,z-.75,.14,(s.storeys>1?F:H)-.14,1.5,[.78,.72,.61],'closet-wall',{interiorPartition:true}));rooms.push({id:'closet',label:'Storage closet',level:0});}
  const furnished=Content.furnish(s,{front,back:-s.d/2+.35,floors});parts.push(...furnished.parts);localDestinations.push(...furnished.destinations);
  for(const level of floors)parts.push(box(-s.w/2+.4,level+2.35,front-2,.13,.23,.18,[.95,.74,.3],'interior-lamp',{glow:true,nocol:true}));
 }
 for(const d of doors)parts.push(...K.transform([box(0,d.h,.19,d.w+.14,.145,.42,M.timber,'door-head-stop')],d.x,d.y,d.z,d.rot));
 const mirror=s.stairs==='left',P=p=>point(mirror?{...p,x:-p.x}:p,s),destinations=localDestinations.map(d=>({...d,...P(d),id:s.id+':destination:'+d.kind+':'+d.level}));
 const transformDoor=d=>{const p=P(d);return {...d,...p,rot:(mirror?-d.rot:d.rot)+s.rot,hingeSide:mirror?1:-1};};
 const worldParts=K.transform(mirror?reflectParts(parts):parts,s.x,s.floor,s.z,s.rot),worldEntry=P(entry),worldDoors=doors.map(transformDoor);
 return {id:s.id,spec:s,parts:worldParts,doors:worldDoors,rooms,entry:worldEntry,footprint:{x:s.x,z:s.z,w:s.w,d:s.d,rot:s.rot,floor:s.floor},profile:s.variant,destinations,floors:floors.map(y=>y+s.floor),stair:s.storeys>1?{start:P({x:stairX,y:0,z:stairStart+.25}),end:P({x:stairX,y:F,z:stairEnd-.25}),hole:mirror?{...hole,x0:-hole.x1,x1:-hole.x0}:hole,steps:N,riser:F/N,tread:5.6/N,finishedFloor:F}:null,route:[P({x:entry.x,y:0,z:front-1}),P({x:stairX,y:0,z:stairStart+.3}),P({x:stairX,y:F,z:stairEnd-.3})],cacheSize:cache.size};
}
return {create,doorParts,hash,point,profiles:Content.profiles,cacheSize:()=>cache.size};
});
