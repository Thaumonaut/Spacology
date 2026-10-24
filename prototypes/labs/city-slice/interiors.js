// Interiors for town-kit buildings, generated on demand from the building's footprint, storeys and door, as CastleRender
// parts (so the same converter and collider apply). Engine-neutral: the same function can run inside the world
// generator. Layout per storey, in a local frame whose +Z faces the street (the door side):
//   - a boarded floor (ground) or a joisted slab (upper storeys) with a stairwell opening;
//   - a switchback stair in two strips against one side wall, alternating direction each storey, risers <= 18 cm;
//   - a partition across the plan with a doorway when the plan is deep enough, splitting front and back rooms;
//   - furniture by building role and storey (shop counter and shelves, tavern tables and bar, forge, kitchen, bedroom);
//   - one or two warm light points per storey (positions only; the renderer decides how many become real lights).
const WOOD=[.5,.34,.22],DARK=[.32,.22,.15],LINEN=[.88,.85,.78],CLOTH=[[.62,.22,.2],[.24,.36,.55],[.3,.48,.32],[.7,.55,.25]],STONE=[.62,.6,.58],IRON=[.24,.24,.27],PLASTER=[.9,.86,.78];
const ROLE={inn:'tavern',pub:'tavern',courtyardInn:'tavern',smithy:'forge',towerWorkshop:'forge',warehouse:'store',bakery:'shop',florist:'shop',armourer:'shop',apothecary:'shop',bookseller:'shop',generalGoods:'shop',clothing:'shop'};
function rng(seed){let a=seed>>>0||1;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
// b: {id, variant, footprint:{x,z,w,d,floor}, front (+1/-1: door toward +Z or -Z), storeys, storeyHeight}.
export function interior(b){
  const R=rng((b.id*2654435761)>>>0),fp=b.footprint,F=b.front,h=b.storeyHeight||3.2,n=Math.max(1,b.storeys||2),role=ROLE[b.variant]||'home';
  const parts=[],lights=[],wall=.2,iw=fp.w-2*wall-.14,id=fp.d-2*wall-.14,x0=-iw/2,z0=-id/2;
  // Local (u across, v toward the street) to world.
  const W=(u,v)=>[fp.x+u,fp.z+v*F];
  const box=(u,v,w,d,y,hh,col,o={})=>{const [x,z]=W(u,v);parts.push({t:'box',x,y,z,w,h:hh,d,rot:0,col,...o});};
  const cyl=(u,v,r,y,hh,col,o={})=>{const [x,z]=W(u,v);parts.push({t:'cyl',x,y,z,r,h:hh,col,...o});};
  const blob=(u,v,y,r,col)=>{const [x,z]=W(u,v);parts.push({t:'blob',x,y,z,rx:r,ry:r*.8,rz:r,col,nocol:true});};
  const sw=Math.min(.95,iw*.22),su0=x0+.05,stairX=[su0+sw/2,su0+sw*1.5],rise=h,steps=Math.ceil(rise/.18),tread=.27,run=steps*tread,vS=z0+.3,vE=Math.min(z0+.3+run,id/2-1);
  const fy=k=>fp.floor+k*h;
  for(let k=0;k<n;k++){const y=fy(k),dir=k%2?-1:1,strip=stairX[k%2],top=k<n-1;
    // Floor: boards on the ground storey, a slab with a stairwell hole on upper storeys.
    if(k===0)box(0,0,iw+.1,id+.1,y-.06,.06,WOOD,{pat:6});
    else{const holeU0=su0-.05,holeU1=su0+sw*2+.05,hv0=vS-.1,hv1=vE+.4;
      box((x0+holeU0)/2,0,holeU0-x0,id,y-.25,.25,WOOD,{pat:6});box((holeU1+iw/2)/2,0,iw/2-holeU1,id,y-.25,.25,WOOD,{pat:6});
      box((holeU0+holeU1)/2,(z0+hv0)/2,holeU1-holeU0,hv0-z0,y-.25,.25,WOOD,{pat:6});box((holeU0+holeU1)/2,(hv1+id/2)/2,holeU1-holeU0,id/2-hv1,y-.25,.25,WOOD,{pat:6});
      for(let u=x0+.4;u<iw/2;u+=.8)if(u<holeU0||u>holeU1)box(u,0,.12,id,y-.42,.18,DARK);
      // The landing: the strip not used by this storey's flight, so the flight below arrives on solid floor.
      box(stairX[(k+1)%2],(hv0+hv1)/2,sw,hv1-hv0,y-.25,.25,WOOD,{pat:6});}
    // Stair to the next storey: steps as solid blocks (each a riser and tread), a handrail on the open side.
    if(top){for(let s=0;s<steps;s++){const t=(s+.5)/steps,v=dir>0?vS+t*(vE-vS):vE-t*(vE-vS),yy=y+(s+1)*rise/steps;box(strip,v,sw-.04,tread+.02,y,yy-y,WOOD,{pat:6});}
      const sv=dir>0?vS:vE,ev=dir>0?vE:vS,hx=strip+sw/2;const [ax,az]=W(hx,sv),[bx,bz]=W(hx,ev);parts.push({t:'beam',x0:ax,y0:y+1,z0:az,x1:bx,y1:y+rise+1,z1:bz,s:.06,col:DARK,nocol:true});}
    // Ceiling under the roof on the top storey.
    if(!top)box(0,0,iw,id,y+h-.12,.12,PLASTER,{pat:5,nocol:true});
    // Partition: across the plan behind the front room, with a doorway clear of the stair strips.
    const deep=id>5.2;if(deep){const pv=-id*.05,dw=1.1,du=Math.max(su0+sw*2+.8,0)+R()*Math.max(0,iw/2-1.4-Math.max(su0+sw*2+.8,0));
      const segs=[[su0+sw*2+.05,du-dw/2],[du+dw/2,iw/2]];for(const [a,c] of segs)if(c-a>.1)box((a+c)/2,pv,c-a,.14,y,h-.12,PLASTER,{pat:5});box(du,pv,dw,.14,y+2.2,h-2.32,PLASTER,{pat:5});}
    // Furniture.
    const front=[x0+sw*2+.3,iw/2-.3,(deep?-id*.05:z0)+.3,id/2-.4],back=[x0+sw*2+.3,iw/2-.3,z0+.3,deep?-id*.05-.3:id/2-.4];
    const area=k===0?front:back.concat();const cu=(area[0]+area[1])/2,cv=(area[2]+area[3])/2,aw=area[1]-area[0],ad=area[3]-area[2];
    if(k===0&&role==='shop'){box(cu,area[2]+ad*.35,aw*.7,.6,y,1,WOOD,{pat:6});box(cu,area[2]+ad*.35,aw*.72,.65,y+1,.06,DARK);
      for(const e of [-1,1]){const u=e>0?iw/2-.25:area[0]+.05;for(let s=0;s<4;s++){box(u,cv,.4,ad*.8,y+.3+s*.5,.04,WOOD);for(let g=0;g<5;g++)box(u,area[2]+ad*.15+g*ad*.15,.2,.18,y+.34+s*.5,.18+.1*R(),CLOTH[(s+g)%4]);}}
      for(let i=0;i<3;i++)box(area[0]+.5+i*.7,area[3]-.4,.5,.5,y,.5,WOOD,{pat:6});}
    else if(k===0&&role==='tavern'){box(area[1]-.4,cv,.6,ad*.7,y,1.05,DARK,{pat:6});for(let i=0;i<3;i++)cyl(area[1]-.25,area[2]+.4+i*.7,.3,y+1.05,.7,WOOD,{pat:6});
      for(let i=0;i<Math.max(1,Math.floor(aw/2.2));i++)for(let j=0;j<Math.max(1,Math.floor(ad/2.2));j++){const u=area[0]+1+i*2.2,v=area[2]+1+j*2.2;box(u,v,1.1,.8,y+.72,.06,WOOD,{pat:6});box(u,v,.12,.12,y,.72,DARK);for(const e of [-1,1])box(u,v+e*.65,1,.3,y,.45,WOOD);cyl(u,v,.05,y+.78,.18,[1,.8,.45],{glow:true,nocol:true});}
      lights.push({x:W(area[1]-.6,cv)[0],y:y+2.4,z:W(area[1]-.6,cv)[1],i:1.4});}
    else if(k===0&&role==='forge'){box(area[0]+.8,cv,1.4,1.4,y,1,STONE,{pat:4});box(area[0]+.8,cv,.9,.9,y+1,.12,[1,.45,.15],{glow:true,nocol:true});cyl(cu,cv,.25,y,.6,DARK);box(cu,cv,.7,.25,y+.6,.22,IRON);cyl(area[1]-.4,area[3]-.4,.35,y,.8,WOOD,{pat:6});
      lights.push({x:W(area[0]+.8,cv)[0],y:y+1.4,z:W(area[0]+.8,cv)[1],i:2.2,c:[1,.55,.25]});}
    else if(k===0&&role==='store'){for(let i=0;i<10;i++){const s=.5+.4*R();box(area[0]+R()*aw,area[2]+R()*ad,s,s,y,s,WOOD,{pat:6});}}
    else if(k===0){// Home: a kitchen hearth on the back wall of the front room, a dining table with chairs, a dresser, a rug.
      box(cu,area[2]+.35,1.4,.7,y,1.2,STONE,{pat:4});box(cu,area[2]+.35,.8,.4,y+.15,.4,[1,.5,.2],{glow:true,nocol:true});box(cu,area[2]+.35,1.6,.8,y+1.2,.12,DARK);
      box(cu,cv+.3,1.4,.85,y+.74,.06,WOOD,{pat:6});box(cu,cv+.3,.12,.12,y,.74,DARK);for(const e of [-1,1]){box(cu+e*.9,cv+.3,.4,.4,y+.42,.05,WOOD);box(cu+e*1.08,cv+.3,.05,.4,y+.42,.5,WOOD);box(cu+e*.9,cv+.3,.06,.06,y,.42,DARK);}
      box(area[1]-.25,cv,.45,1.3,y,1.8,WOOD,{pat:6});box(cu,cv+.3,2.2,1.5,y+.005,.015,CLOTH[Math.floor(R()*4)],{nocol:true});
      lights.push({x:W(cu,area[2]+.6)[0],y:y+1.2,z:W(cu,area[2]+.6)[1],i:1.2,c:[1,.6,.3]});}
    if(k>0){// Bedrooms: a bed, a chest, a wardrobe, a small table with a candle.
      const bu=area[1]-1,bv=area[2]+1.1;box(bu,bv,1.5,2.1,y,.45,WOOD,{pat:6});box(bu,bv-.15,1.4,1.7,y+.45,.15,LINEN,{nocol:true});box(bu,bv+.65,1.4,.5,y+.45,.18,LINEN,{nocol:true});box(bu,bv-.4,1.42,1.1,y+.6,.03,CLOTH[Math.floor(R()*4)],{nocol:true});box(bu,bv+1.05,1.5,.08,y,1.1,DARK);
      box(bu,bv-1.25,1,.5,y,.5,DARK,{pat:6});box(area[0]+.35,area[3]-.6,.6,1,y,1.9,WOOD,{pat:6});box(area[0]+.6,bv,.6,.6,y+.7,.04,WOOD);cyl(area[0]+.6,bv,.04,y+.74,.2,[1,.85,.5],{glow:true,nocol:true});
      lights.push({x:W(area[0]+.6,bv)[0],y:y+1.3,z:W(area[0]+.6,bv)[1],i:.9});}}
  return {parts,lights};}
