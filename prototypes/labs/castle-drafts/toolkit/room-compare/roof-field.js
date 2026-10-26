/* Footprint-fitted roof experiment, following Building Lab's upper-envelope approach.
   One surface owns each column: overlapping wings form valleys, never stacked roofs. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RoomRoofField=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function build(layout,{step=.125,eave=.375,pitch=1.05,plate=3.6,thickness=.12,wallBase=3}={}){
 const zones=layout.plan.roofs.map(r=>({...r}));
 // Room coverage is authoritative, including small stores omitted by prefab roof slots.
 for(const c of layout.cells)if(!zones.some(r=>Math.abs(c.x-r.x)<r.w/2&&Math.abs(c.z-r.z)<r.d/2))zones.push({x:c.x,z:c.z,w:c.size||2,d:c.size||2});
 // Continue a ridge through adjoining sections rather than placing end gables between them.
 for(let i=0;i<zones.length;i++)for(let j=i+1;j<zones.length;j++){const a=zones[i],b=zones[j];if(a.x===b.x&&a.w===b.w&&Math.abs(a.z-b.z)===(a.d+b.d)/2){const lo=Math.min(a.z-a.d/2,b.z-b.d/2),hi=Math.max(a.z+a.d/2,b.z+b.d/2);a.z=(lo+hi)/2;a.d=hi-lo;zones.splice(j--,1);}}
 zones.sort((a,b)=>b.w*b.d-a.w*a.d);
 for(let i=0;i<zones.length;i++){const r=zones[i];r.cross=r.ridge==='x'||(!r.ridge&&zones.slice(0,i).some(a=>Math.abs(a.x-r.x)===(a.w+r.w)/2&&Math.abs(a.z-r.z)<(a.d+r.d)/2));}
 const near=(x,z)=>layout.cells.some(c=>Math.max(Math.abs(x-c.x)-(c.size||2)/2,Math.abs(z-c.z)-(c.size||2)/2)<=eave+1e-7);
 function height(x,z){let h=-Infinity;for(const r of zones){if(Math.abs(x-r.x)>r.w/2+eave+1e-6||Math.abs(z-r.z)>r.d/2+eave+1e-6)continue;const dist=r.cross?r.d/2-Math.abs(z-r.z):r.w/2-Math.abs(x-r.x);h=Math.max(h,plate+pitch*dist);}return h;}
 const roof=[],uv=[],walls=[],trim=[],planes=[],patches=[];
 const tri=(out,a,b,c)=>out.push(...a,...b,...c),quad=(out,a,b,c,d)=>{tri(out,a,b,c);tri(out,a,c,d);};
 // Each gable is two bounded planes. Subtract every region covered by a higher
 // plane, splitting polygons at the actual intersection rather than a voxel grid.
 for(const r of zones)for(const sign of [-1,1]){const p={x0:r.x-r.w/2-eave,x1:r.x+r.w/2+eave,z0:r.z-r.d/2-eave,z1:r.z+r.d/2+eave,ax:0,az:0,c:plate+pitch*(r.cross?r.d:r.w)/2};if(r.cross){p.az=-sign*pitch;p.c+=sign*pitch*r.z;if(sign<0)p.z1=r.z;else p.z0=r.z;}else{p.ax=-sign*pitch;p.c+=sign*pitch*r.x;if(sign<0)p.x1=r.x;else p.x0=r.x;}planes.push(p);}
 const at=(p,v)=>p.ax*v[0]+p.az*v[1]+p.c;
 function clip(poly,f){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],fa=f(a),fb=f(b),ia=fa>=-1e-9,ib=fb>=-1e-9;if(ia)out.push(a);if(ia!==ib){const t=fa/(fa-fb);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;}
 const area=poly=>Math.abs(poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
 for(let i=0;i<planes.length;i++){const p=planes[i];let polygons=[[[p.x0,p.z0],[p.x0,p.z1],[p.x1,p.z1],[p.x1,p.z0]]];
  for(let j=0;j<planes.length;j++){if(j===i)continue;const q=planes[j],next=[],same=Math.abs(p.ax-q.ax)+Math.abs(p.az-q.az)+Math.abs(p.c-q.c)<1e-8;
   for(const poly of polygons){let inside=poly;for(const f of [v=>v[0]-q.x0,v=>q.x1-v[0],v=>v[1]-q.z0,v=>q.z1-v[1]]){const outside=clip(inside,v=>-f(v));if(area(outside)>1e-9)next.push(outside);inside=clip(inside,f);if(inside.length<3)break;}if(inside.length>=3){const exposed=same?(i<j?inside:[]):clip(inside,v=>at(p,v)-at(q,v));if(area(exposed)>1e-9)next.push(exposed);}}
   polygons=next;
  }for(const poly of polygons)patches.push({p,poly});
 }
 // Split collinear edges at all neighbouring vertices so the union has no T seams.
 const vertices=patches.flatMap(p=>p.poly);
 for(const {p,poly} of patches){const boundary=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1],ll=dx*dx+dz*dz;if(ll<1e-12)continue;const ts=[0];for(const v of vertices){const t=((v[0]-a[0])*dx+(v[1]-a[1])*dz)/ll;if(t>1e-7&&t<1-1e-7&&Math.abs((v[0]-a[0])*dz-(v[1]-a[1])*dx)<1e-7)ts.push(t);}for(const t of [...new Set(ts.map(t=>Math.round(t*1e9)/1e9))].sort((a,b)=>a-b))boundary.push([a[0]+dx*t,a[1]+dz*t]);}
  const center=poly.reduce((s,v)=>[s[0]+v[0]/poly.length,s[1]+v[1]/poly.length],[0,0]),lift=v=>[v[0],at(p,v),v[1]],mid=lift(center);
  for(let i=0;i<boundary.length;i++){const a=lift(boundary[i]),b=lift(boundary[(i+1)%boundary.length]);tri(roof,mid,a,b);for(const v of [mid,a,b])uv.push(v[0]/2,v[2]/2);tri(trim,[mid[0],mid[1]-thickness,mid[2]],[b[0],b[1]-thickness,b[2]],[a[0],a[1]-thickness,a[2]]);
   const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);if(len<1e-8)continue;const x=(a[0]+b[0])/2-dz/len*1e-5,z=(a[2]+b[2])/2+dx/len*1e-5,other=height(x,z),h=(a[1]+b[1])/2;if(!Number.isFinite(other)||other<h-1e-4){const bottomA=Number.isFinite(other)?Math.min(a[1]-thickness,other-thickness):a[1]-thickness,bottomB=Number.isFinite(other)?Math.min(b[1]-thickness,other-thickness):b[1]-thickness;quad(trim,a,b,[b[0],bottomB,b[2]],[a[0],bottomA,a[2]]);}
  }
 }
 // Gable infill belongs only to exposed walls; room boundaries never spawn hidden gables.
 for(const e of layout.edges.filter(e=>!e.neighbor)){const span=e.span||2,n=Math.ceil(span/step),cx=Math.cos(e.rot),sz=Math.sin(e.rot);for(let i=0;i<n;i++){const a=-span/2+span*i/n,c=-span/2+span*(i+1)/n,x=e.x+a*cx,z=e.z+a*sz,xx=e.x+c*cx,zz=e.z+c*sz;quad(walls,[x,wallBase,z],[xx,wallBase,zz],[xx,height(xx,zz)-thickness,zz],[x,height(x,z)-thickness,z]);}}
 // Find shared crease edges on the actual joined surface, including diagonal valleys.
 const features=new Map(),ridges=[],ridgeUV=[],valleys=[];
 for(let i=0;i<roof.length;i+=9){const a=roof.slice(i,i+3),b=roof.slice(i+3,i+6),c=roof.slice(i+6,i+9),u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);for(let k=0;k<3;k++)n[k]/=len;
  for(const [p,q] of [[a,b],[b,c],[c,a]]){const key=[p.map(v=>v.toFixed(6)).join(','),q.map(v=>v.toFixed(6)).join(',')].sort().join('|');if(!features.has(key))features.set(key,{p,q,n});else{const edge=features.get(key);edge.other=n;}}
 }
 for(const {p,q,n,other} of features.values()){if(!other||n.reduce((sum,x,k)=>sum+x*other[k],0)>.94)continue;const dx=q[0]-p[0],dz=q[2]-p[2],len=Math.hypot(dx,dz);if(len<1e-6)continue;const nx=-dz/len,nz=dx/len,x=(p[0]+q[0])/2,z=(p[2]+q[2])/2,h=(p[1]+q[1])/2,sideA=height(x+nx*.1,z+nz*.1),sideB=height(x-nx*.1,z-nz*.1),valley=(sideA+sideB)/2>h+.015,out=valley?valleys:ridges,segments=valley?2:6,width=valley?.12:.105;
  for(let j=0;j<segments;j++){const strip=[];for(const [point,t] of [[p,j],[q,j],[q,j+1],[p,j+1]]){const off=(t/segments*2-1)*width,xx=point[0]+nx*off,zz=point[2]+nz*off,hh=height(xx,zz);strip.push([xx,Math.max(hh,point[1])+.025+(valley?Math.abs(off)*.18:Math.sqrt(Math.max(0,1-(off/width)**2))*.085),zz]);}quad(out,...strip);if(!valley)for(const point of [strip[0],strip[1],strip[2],strip[0],strip[2],strip[3]])ridgeUV.push(point[0]/2,point[2]/2);}
 }
 return {roof,uv,walls,trim,ridges,ridgeUV,valleys,zones,height,step,plate,thickness};
}
return {build};
});
