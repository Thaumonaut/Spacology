(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../shape-study/plot-plan.js'));else root.CityNeighborhoods=factory(root.PlotShapeStudy);})(typeof globalThis!=='undefined'?globalThis:this,function(P){
'use strict';
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
function half(poly,f){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],fa=f(a),fb=f(b);if(fa>=-1e-8)out.push(a);if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return clean(out);}
function clean(poly){const out=[];for(const p of poly)if(!out.length||Math.hypot(p[0]-out.at(-1)[0],p[1]-out.at(-1)[1])>1e-6)out.push(p);if(out.length>1&&Math.hypot(out[0][0]-out.at(-1)[0],out[0][1]-out.at(-1)[1])<1e-6)out.pop();return out;}
function voronoi(domain,seeds){return seeds.map((seed,i)=>{let poly=domain;for(let j=0;j<seeds.length&&poly.length>=3;j++){if(j===i)continue;const other=seeds[j],dx=other[0]-seed[0],dy=other[1]-seed[1],limit=(other[0]**2+other[1]**2-seed[0]**2-seed[1]**2)/2;poly=half(poly,p=>limit-dx*p[0]-dy*p[1]);}return poly;});}
function inset(poly,distances){return P.insetEdges(poly,distances);}
function build({domain,kind,random,toWorld,roadForEdge}){
 const xs=domain.map(p=>p[0]),ys=domain.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),mid=(y0+y1)/2,n=Math.max(2,Math.round((x1-x0)/8)),parcels=[],lanes=[],courtyards=[];
 const center=(x0+x1)/2;
 if(kind==='voronoi'){
  const seeds=[];for(let row=0;row<2;row++)for(let i=0;i<n;i++){const p=[x0+(i+.5+(random()-.5)*.32)*(x1-x0)/n,y0+(row?.75:.25)*(y1-y0)+(random()-.5)*1.7];if(P.inside(p,domain))seeds.push(p);}seeds.push([center,mid]);const cells=voronoi(domain,seeds);
  const court=cells.at(-1);if(court.length>=3)courtyards.push(court.map(toWorld));
  for(let index=0;index<cells.length-1;index++){const cell=cells[index];if(cell.length<3||area(cell)<32)continue;const defs=[],distances=[];
   for(let edge=0;edge<cell.length;edge++){const a=cell[edge],b=cell[(edge+1)%cell.length],midpoint=[(a[0]+b[0])/2,(a[1]+b[1])/2],publicEdge=roadForEdge(a,b),courtEdge=court.length>=3&&court.some((p,j)=>onEdge(midpoint,p,court[(j+1)%court.length],.02));defs.push({edge,label:publicEdge?.label||(courtEdge?'Courtyard':'Winding alley'),roadWidth:publicEdge?.roadWidth||(courtEdge?6:1.8)});distances.push(publicEdge?0:courtEdge?.2:.9);if(!publicEdge)lanes.push({a:toWorld(a),b:toWorld(b),width:courtEdge?2.2:1.8});}
   const poly=inset(cell,distances);if(poly.every(p=>p.every(Number.isFinite))&&poly.length>=3&&area(poly)>25)parcels.push({poly,frontages:defs,kind});
  }
 }else{
  const laneHalf=1.3,courtHalfW=Math.min(7,(x1-x0)*.16),courtHalfD=4.5,court=P.clip([[center-courtHalfW,mid-courtHalfD],[center+courtHalfW,mid-courtHalfD],[center+courtHalfW,mid+courtHalfD],[center-courtHalfW,mid+courtHalfD]],domain);if(court.length>=3)courtyards.push(court.map(toWorld));
  const line=intersections(domain,mid);if(line.length===2)lanes.push({a:toWorld(line[0]),b:toWorld(line[1]),width:2.6});
  for(let row=0;row<2;row++)for(let i=0;i<n;i++){let lo=x0+i*(x1-x0)/n,hi=x0+(i+1)*(x1-x0)/n;if(i>0&&i%3===0)lo+=.9;if(i<n-1&&(i+1)%3===0)hi-=.9;let poly=half(domain,p=>p[0]-lo);poly=half(poly,p=>hi-p[0]);const atCourt=(lo+hi)/2>center-courtHalfW&&(lo+hi)/2<center+courtHalfW,edge=row?mid+(atCourt?courtHalfD:laneHalf):mid-(atCourt?courtHalfD:laneHalf);poly=half(poly,p=>row?p[1]-edge:edge-p[1]);if(poly.length<3||area(poly)<30)continue;const defs=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],publicEdge=roadForEdge(a,b),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(publicEdge)defs.push({...publicEdge,edge:j});else if(Math.abs(m[1]-edge)<.02)defs.push({edge:j,label:atCourt?'Courtyard':'Cross-block alley',roadWidth:atCourt?6:2.6});else if(Math.abs(m[0]-lo)<.02&&i>0&&i%3===0||Math.abs(m[0]-hi)<.02&&i<n-1&&(i+1)%3===0)defs.push({edge:j,label:'Side passage',roadWidth:1.8});}parcels.push({poly,frontages:defs,kind});}
  for(let i=3;i<n;i+=3){const x=x0+i*(x1-x0)/n,points=intersectionsX(domain,x);if(points.length===2)lanes.push({a:toWorld(points[0]),b:toWorld(points[1]),width:1.8});}
 }
 return {parcels,lanes,courtyards};
}
function onEdge(p,a,b,eps=.02){const dx=b[0]-a[0],dz=b[1]-a[1],ll=dx*dx+dz*dz,t=((p[0]-a[0])*dx+(p[1]-a[1])*dz)/ll;return t>=-eps&&t<=1+eps&&Math.abs((p[0]-a[0])*dz-(p[1]-a[1])*dx)/Math.sqrt(ll)<eps;}
function intersections(poly,y){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)){const t=(y-a[1])/(b[1]-a[1]);out.push([a[0]+t*(b[0]-a[0]),y]);}}return out.sort((a,b)=>a[0]-b[0]);}
function intersectionsX(poly,x){return intersections(poly.map(p=>[p[1],p[0]]),x).map(p=>[p[1],p[0]]);}
return {build,voronoi,half,area,onEdge};
});
