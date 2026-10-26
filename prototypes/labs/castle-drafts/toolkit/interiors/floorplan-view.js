// A cut through the actual generated parts, rather than a separate sketch.
(function(root){'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function render(scene,level=0){const floor=scene.floors[level]??(scene.modules||[]).map(m=>m.floors[level]).find(Number.isFinite)??scene.spec.floor+level*3.2,w=scene.spec.w,d=scene.spec.d,out=[],cut=floor+.9,excluded=new Set(['door-head-stop','interior-lamp']);let xmin=-w/2,xmax=w/2,zmin=-d/2,zmax=d/2;
 for(const p of scene.parts){if(p.x==null||p.y==null||excluded.has(p.role))continue;const h=p.h??(p.ry?2*p.ry:0),furniture=p.interiorFurniture||p.role==='interior-stair';if(furniture?!(p.y<floor+2.2&&p.y+h>floor+.025):!(p.y<=cut&&p.y+h>cut))continue;
  const color=p.role==='interior-stair'?'#b98a50':p.role==='pane'?'#80b7c7':p.interiorPartition?'#59675b':furniture?'#bc9b73':'#7c827b',angle=(p.rot||0)*180/Math.PI;
  if(p.t==='box'){const c=Math.abs(Math.cos(p.rot||0)),s=Math.abs(Math.sin(p.rot||0)),rx=(c*p.w+s*p.d)/2,rz=(s*p.w+c*p.d)/2;xmin=Math.min(xmin,p.x-rx);xmax=Math.max(xmax,p.x+rx);zmin=Math.min(zmin,p.z-rz);zmax=Math.max(zmax,p.z+rz);}
  if(p.t==='box')out.push(`<rect x="${p.x-p.w/2}" y="${p.z-p.d/2}" width="${p.w}" height="${p.d}" fill="${color}" stroke="#37473c" stroke-width=".025" transform="rotate(${angle} ${p.x} ${p.z})"/>`);
  else if(p.t==='cyl')out.push(`<circle cx="${p.x}" cy="${p.z}" r="${p.r}" fill="${color}" stroke="#37473c" stroke-width=".025"/>`);
 }
 if(level>0)for(const module of scene.modules||[scene]){if(!module.stair||level>=module.floors.length)continue;const a=module.stair.start,b=module.stair.end,dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,nx=-uz*.62,nz=ux*.62,ax=a.x+ux*.25,az=a.z+uz*.25,bx=b.x-ux*.25,bz=b.z-uz*.25;out.push(`<path d="M${ax+nx},${az+nz} L${bx+nx},${bz+nz} L${bx-nx},${bz-nz} L${ax-nx},${az-nz} Z" fill="#d6be99" stroke="#926d3f" stroke-width=".04"/>`);for(let i=0;i<=20;i++){const t=i/20,x=ax+(bx-ax)*t,z=az+(bz-az)*t;out.push(`<path d="M${x+nx},${z+nz} L${x-nx},${z-nz}" stroke="#926d3f" stroke-width=".025"/>`);}}
 for(const door of scene.doors){if(Math.abs(door.y-floor)>.2)continue;const c=Math.cos(door.rot),s=Math.sin(door.rot),side=door.hingeSide||-1,x=door.x+c*side*door.w/2,z=door.z+s*side*door.w/2,a=[x-side*c*door.w,z-side*s*door.w],angle=door.rot+side*Math.PI/2,b=[x-side*Math.cos(angle)*door.w,z-side*Math.sin(angle)*door.w];out.push(`<path d="M${a} L${x},${z} L${b} M${a} A${door.w},${door.w} 0 0 ${side>0?1:0} ${b}" fill="none" stroke="#ac5d3f" stroke-width=".055"/>`);}

 const rooms=scene.rooms.filter(r=>r.level===level).map(r=>r.label).join(' · ');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${xmin-.6} ${zmin-.6} ${xmax-xmin+1.2} ${zmax-zmin+1.6}" role="img" aria-label="${esc('Floor '+(level+1)+': '+rooms)}"><rect x="${-w/2}" y="${-d/2}" width="${w}" height="${d}" fill="#eee6d4"/>${out.join('')}<text x="0" y="${zmax+.65}" text-anchor="middle" font-size=".3" fill="#243b31">FRONT / STREET</text></svg>`;
}
root.TownFloorplan={render};
})(typeof window==='object'?window:globalThis);
