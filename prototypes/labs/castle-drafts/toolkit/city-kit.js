// Dense, level city-scale assembly of the full-detail building kit.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./town-kit.js'),require('./pavement-plan.js'));else root.TownKitCity=factory(root.TownKit,root.PavementPlan);})(this,function(K,P){
'use strict';
function build({grade=0}={}){
 if(!Number.isFinite(grade)||Math.abs(grade)>.2)throw Error("City grade must be between -0.2 and 0.2");
 const blocks=[],buildings=[],parts=[],connections=[],placements=[],ground=(x,z)=>3.84+grade*x+grade*.25*z,bw=42,bd=24,road=8,pitchX=bw+road,pitchZ=bd+road;
 const homes=['steppedHouse','doubleBayHouse','cornerHouse','courtyardInn','towerWorkshop','undercroftHouse','orielHouse','bayHouse','galleryHouse','gambrelHouse','sweptHouse','manor','stoneCottage','weaversHouse','merchantHouse','gableHouse','house','tenement','inn'],shops=['bakery','florist','bookseller','armourer','apothecary','generalGoods','clothing','pub','smithy','warehouse'];
 const extentX=4*pitchX/2,extentZ=4*pitchZ/2;
 parts.push({t:'surfacePatch',x0:-extentX-4,x1:extentX+4,z0:-extentZ-4,z1:extentZ+4,heights:[ground(-extentX-4,-extentZ-4),ground(-extentX-4,extentZ+4),ground(extentX+4,extentZ+4),ground(extentX+4,-extentZ-4)],skirts:[],col:[.62,.59,.49],pat:3,noJitter:true,role:'city-ground'});
 for(let bz=0;bz<4;bz++)for(let bx=0;bx<4;bx++){
  const cx=(bx-1.5)*pitchX,cz=(bz-1.5)*pitchZ,block={x:cx,z:cz,w:bw,d:bd,rows:[]};blocks.push(block);
  for(let side=0;side<2;side++){
   const pool=bz===3?K.SLUM_KINDS:null;
   const variants=pool?Array.from({length:7},(_,i)=>pool[(bx+i)%pool.length]):Array.from({length:7},(_,i)=>((bz===1||bz===2)&&side===(bx%2)?shops:homes)[(bx*3+bz*5+i)%((bz===1||bz===2)&&side===(bx%2)?shops.length:homes.length)]);
   if((bx===1||bx===2)&&((side===1&&bz<2)||(side===0&&bz>0&&bz<=2)))variants[3]='house';
   const bridgeIndex=[3,2,4,1,5,0,6].find(i=>K.TYPES[variants[i]].storeys>=2&&!K.TYPES[variants[i]].storeyHeight&&!['inn','pub','smithy','warehouse',...K.COMPOUND_KINDS].includes(variants[i]));
   const gap=.18,available=bw-gap*6,weight=variants.reduce((n,v)=>n+K.TYPES[v].w,0);let cursor=-bw/2;const row=[];
   for(let i=0;i<7;i++){
    const variant=variants[i],type=K.TYPES[variant],w=type.w*available/weight,d=Math.min(type.d,10),xx=cursor+w/2;cursor+=w+gap;
    const rot=side?0:Math.PI,localZ=side?bd/2-d/2:-bd/2+d/2,front=side?1:-1;
    const isBridge=(bx===1||bx===2)&&((side===1&&bz<2)||(side===0&&bz>0&&bz<=2))&&i===bridgeIndex;
    const bayCount=Math.round(w/3),firstBay=-w/2+w/bayCount/2,doorLocalX=variant==='warehouse'?0:variant==='pub'?-w/2+(Math.floor(bayCount/2)+.5)*w/bayCount:firstBay,recess=variant==='galleryHouse'?.65:variant==='undercroftHouse'?2.2:variant==='smithy'?2.5:0,frontZ=cz+localZ+front*(d/2+.17-recess),datum=ground(cx+xx+front*doorLocalX,frontZ)+.16,localGround=(u,v)=>ground(cx+xx+front*u,cz+localZ+front*v),localStreet=u=>ground(cx+xx+front*u,frontZ);
    const b=K.building({...type,id:`city-${bx}-${bz}-${side}-${i}`,variant,bridgeDoor:isBridge,x:0,z:0,w,d,floor:datum,ground:localGround,streetHeight:localStreet,partyLeft:i>0,partyRight:i<6,roofCol:[[.34,.4,.4],[.43,.29,.24],[.31,.4,.33],[.29,.34,.43]][(bx+bz+i)%4]});
    if((bx+bz+i)%3===0)b.parts.push(...K.greenery(b,{density:.65}).parts);
    const owned=[],rest=[];for(const p of b.parts){const priority={'work-yard':50,'ground-floor-frame':60,'ground-floor':70,'door-threshold':100}[p.role];if(p.role==='display-pad')continue;if(priority!=null)owned.push(P.source(p,priority));else rest.push(p);}
    if(owned.length)rest.push(...P.build(owned,localGround).parts);
    // Convert patches explicitly: the normal component transform handles primitive parts.
    const converted=rest.map(p=>{if(p.t!=='surfacePatch')return K.transform([p],cx+xx,0,cz+localZ,rot)[0];const q={...p};if(side){q.x0+=cx+xx;q.x1+=cx+xx;q.z0+=cz+localZ;q.z1+=cz+localZ;}else{q.x0=cx+xx-p.x1;q.x1=cx+xx-p.x0;q.z0=cz+localZ-p.z1;q.z1=cz+localZ-p.z0;q.heights=[p.heights[2],p.heights[3],p.heights[0],p.heights[1]];q.skirts=p.skirts.map(s=>({...s,edge:(s.edge+2)%4}));}return q;});
    // Use the same transform for sockets and footprint as for the shell.
    const door={x:cx+xx+(side?b.sockets.door.x:-b.sockets.door.x),y:datum,z:cz+localZ+front*b.sockets.door.z};
    parts.push(...converted);const result={...b,bridgeAnchor:isBridge,parts:converted,sockets:{door,...Object.fromEntries(Object.entries(b.sockets).filter(([k])=>k.startsWith('upperDoor')).map(([k,s])=>[k,{x:cx+xx+front*s.x,y:s.y,z:cz+localZ+front*s.z}])),...(b.sockets.rearDoor?{rearDoor:{x:cx+xx+front*b.sockets.rearDoor.x,y:b.sockets.rearDoor.y,z:cz+localZ+front*b.sockets.rearDoor.z}}:{})},footprint:{x:cx+xx,z:cz+localZ,w,d,floor:datum}};buildings.push(result);row.push(result.id);connections.push({building:b.id,steps:1,sockets:{door,street:{x:door.x,y:ground(door.x,door.z+front),z:door.z+front*1}}});
   }block.rows.push(row);
  }
 }
 const bridges=[];
 for(const block of blocks.filter(q=>(q.x===-25||q.x===25)&&q.z<16)){
   const next=blocks.find(q=>q.x===block.x&&q.z===block.z+pitchZ);if(!next)continue;
   const a=buildings.find(b=>block.rows[1].includes(b.id)&&b.bridgeAnchor&&b.sockets.upperDoor1),b=buildings.find(b=>next.rows[0].includes(b.id)&&b.bridgeAnchor&&b.sockets.upperDoor1);if(!a||!b)continue;
   const span=K.bridge({a:a.sockets.upperDoor1,b:b.sockets.upperDoor1,y:a.sockets.upperDoor1.y,y1:b.sockets.upperDoor1.y});parts.push(...span.parts);bridges.push(span);
 }
 // Props stay at the facade edges; the middle of every street stays open.
 for(let i=0;i<buildings.length;i+=3){const b=buildings[i],f=b.footprint,block=blocks.find(q=>q.rows.flat().includes(b.id)),sign=f.z<block.z?-1:1,px=f.x+f.w*.35,pz=f.z+sign*(f.d/2+.65);if(Math.abs(px-b.sockets.door.x)<1.3)continue;
   parts.push({t:'box',x:px,y:ground(px,pz),z:pz,w:.65,h:.6,d:.65,col:K.M.timber,pat:6,role:'street-crate'}, {t:'cyl',x:px+.6,y:ground(px+.6,pz),z:pz,r:.23,h:.65,col:[.4,.29,.17],pat:6,role:'street-barrel'});
 }
 const strings=[];
 for(const block of blocks.filter(q=>q.z<48)){
   const next=blocks.find(q=>q.x===block.x&&q.z===block.z+pitchZ);if(!next)continue;
   const a=buildings.find(b=>b.id===block.rows[1][5]),b=buildings.find(b=>b.id===next.rows[0][5]),A={x:a.footprint.x,z:block.z+bd/2+.2},B={x:b.footprint.x,z:next.z-bd/2-.2},Y=Math.max(ground(A.x,A.z),ground(B.x,B.z))+4.56;
   const point=t=>({x:A.x+(B.x-A.x)*t,z:A.z+(B.z-A.z)*t,y:Y-.6*Math.sin(Math.PI*t)});
   for(let k=0;k<12;k++){const u=point(k/12),v=point((k+1)/12);parts.push({t:'beam',x0:u.x,y0:u.y,z0:u.z,x1:v.x,y1:v.y,z1:v.z,s:.025,col:K.M.timber,role:'street-line',nocol:true});}
   for(let k=1;k<6;k++){const q=point(k/6);if(block.x<0)parts.push({t:'box',x:q.x,y:q.y-.55,z:q.z,w:.48,h:.55,d:.035,col:[[.52,.35,.28],[.56,.54,.38],[.3,.43,.45]][k%3],role:'street-laundry',nocol:true});else parts.push({t:'box',x:q.x,y:q.y-.24,z:q.z,w:.18,h:.22,d:.18,col:[.95,.78,.38],glow:.6,role:'street-lantern',nocol:true});}
   strings.push({a:A,b:B,clearance:3.41});
 }

 return {parts,buildings,blocks,bridges,strings,connections,placements,ground,grade,preset:'city',terraced:Math.abs(grade)>.1,bounds:{cx:0,cz:0,r:125,h:26+Math.abs(grade)*100},spawn:{x:-extentX+3,z:-extentZ+4,y:ground(-extentX+3,-extentZ+4)+.16,yaw:Math.PI/2},coverage:{blocks:16,frontageSlots:224,occupiedSlots:buildings.length,gap:.18}};
}
return {build};
});
