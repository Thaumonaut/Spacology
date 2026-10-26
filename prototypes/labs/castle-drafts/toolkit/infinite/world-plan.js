(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TownWorldPlan=factory();})(this,function(){
'use strict';const SIZE=40,NEAR=1,FAR=4;
function hash(seed,x,z,k=0){let h=Math.imul((seed|0)^0x9e3779b9,0x85ebca6b);h=Math.imul(h^(x|0),0xc2b2ae35);h=Math.imul(h^(z|0),0x27d4eb2d);h=Math.imul(h^(k|0),0x85ebca6b);return (h^(h>>>16))>>>0;}
function height(x,z){return 5.5*Math.sin(x/145)+4.5*Math.sin(z/170)+2*Math.sin((x+z)/230)+.55*Math.sin(x/34)*Math.sin(z/40);}
function cell(x,z){return {x:Math.floor((x+SIZE/2)/SIZE),z:Math.floor((z+SIZE/2)/SIZE)};}
function desired(x,z){const c=cell(x,z),out=[];for(let j=-FAR;j<=FAR;j++)for(let i=-FAR;i<=FAR;i++)out.push({x:c.x+i,z:c.z+j,lod:Math.max(Math.abs(i),Math.abs(j))<=NEAR?0:1,distance:i*i+j*j});return out.sort((a,b)=>a.lod-b.lod||a.distance-b.distance||a.x-b.x||a.z-b.z);}
function chunk(x,z,seed=45256){
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(z)||Math.abs(x)>1000000||Math.abs(z)>1000000)throw Error('Chunk coordinates outside supported world range');
 const cx=x*SIZE,cz=z*SIZE,w=(32-.16*4)/5,d=9,buildings=[],rows=[[],[]],endRows=[[],[]],types=['house','house','house','apothecary','bakery','bookseller','generalGoods','clothing'],roofs=[[.28,.4,.43],[.43,.3,.25],[.3,.42,.32],[.35,.32,.43]];
 const add=(side,i,bx,bz,width,rot)=>{const h=hash(seed,x,z,side*8+i),variant=types[h%types.length],shell=['gable','front-gable','hip'][Math.floor(h/11)%3],stairs=(h>>>12)%2?'left':'right',floorplan=['open','rear','front_room'][(h>>>14)%3],upperPlan=['rooms','loft','small_rooms'][(h>>>17)%3],doorX=(stairs==='left'?1:-1)*width/4,doorZ=d/2+.17,c=Math.cos(rot),n=Math.sin(rot),floor=Math.round((height(bx+doorX*c-doorZ*n,bz+doorX*n+doorZ*c)+.28)/.16)*.16,id=`${seed}:v2:${x}:${z}:${side}:${i}`;const s={id,variant,shell,stairs,floorplan,upperPlan,storeys:2,w:width,d,x:bx,z:bz,rot,floor,seed:h,partyLeft:side<2?(side===0?i<4:i>0):(side===2?i===0:i===1),partyRight:side<2?(side===0?i>0:i<4):(side===2?i===1:i===0),roofCol:roofs[(h>>>8)%4]};buildings.push(s);return id;};
 // Street-facing rows occupy the two complete fronts; side houses close the
 // remaining ends while leaving a 1.6 m passage into the shared courtyard.
 for(let side=0;side<2;side++)for(let i=0;i<5;i++){const sign=side?1:-1;rows[side].push(add(side,i,cx-16+w/2+i*(w+.16),cz+sign*(16-d/2),w,side?0:Math.PI));}
 for(let side=0;side<2;side++)for(let i=0;i<2;i++){const sign=side?1:-1;endRows[side].push(add(side+2,i,cx+sign*(16-d/2),cz+(i?1:-1)*3.9,6.2,side?-Math.PI/2:Math.PI/2));}
 const courtyard={x0:cx-7,x1:cx+7,z0:cz-7,z1:cz+7,level:Math.min(...buildings.map(b=>b.floor))-.12,gates:[{x0:cx-16,x1:cx-7,z0:cz-.8,z1:cz+.8,side:0},{x0:cx+7,x1:cx+16,z0:cz-.8,z1:cz+.8,side:1}]};
 return {key:x+','+z,x,z,cx,cz,seed,buildings,courtyard,block:{x:cx,z:cz,w:32,d:32,rows,endRows,gateLandings:[0,1].map(side=>({axis:'z',side,u:cz,y:Math.round((height(cx+(side?16:-16),cz)+.28)/.16)*.16}))},bounds:{x0:cx-20,x1:cx+20,z0:cz-20,z1:cz+20}};
}
return {SIZE,NEAR,FAR,hash,height,cell,desired,chunk};
});
