'use strict';
const assert=require('node:assert/strict'),P=require('../../prototypes/labs/castle-drafts/toolkit/room-compare/room-plan.js'),R=require('../../prototypes/labs/castle-drafts/toolkit/room-compare/roof-field.js');
for(const family of Object.keys(P.FAMILIES))for(const seed of [1,45256]){
 const layout=P.compile(P.make(seed,family)),field=R.build(layout);
 for(const key of ['roof','walls','trim','ridges','valleys'])assert(field[key].every(Number.isFinite),family+' '+key+' finite');
 assert.equal(field.uv.length,field.roof.length/3*2);assert.equal(field.ridgeUV.length,field.ridges.length/3*2);
 // All exterior trim has clearance beneath the roof, including the native wall's 31.4 cm projection.
 for(const e of layout.edges.filter(e=>!e.neighbor)){const x=e.x-Math.sin(e.rot)*.314,z=e.z+Math.cos(e.rot)*.314;assert(field.height(x,z)-field.thickness>3.1227,family+' roof does not penetrate wall trim');}
 // Every emitted roof triangle lies on the exposed union, never below another wing.
 for(let i=0;i<field.roof.length;i+=9){const a=field.roof.slice(i,i+3),b=field.roof.slice(i+3,i+6),c=field.roof.slice(i+6,i+9),x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3,y=(a[1]+b[1]+c[1])/3;assert(Math.abs(y-field.height(x,z))<1e-6,family+' buried roof triangle removed');}
 const counts=new Map();for(let i=0;i<field.roof.length;i+=9){const p=[0,3,6].map(k=>field.roof.slice(i+k,i+k+3).join(','));for(const [a,b] of [[0,1],[1,2],[2,0]]){const key=[p[a],p[b]].sort().join('|');counts.set(key,(counts.get(key)||0)+1);}}assert([...counts.values()].every(n=>n===1||n===2),'one surface, no stacked triangles');
 if(family==='courtyard'){const center=layout.plan.rooms.find(r=>r.id==='hall');assert(center);const roofPoints=field.roof;let coversCenter=false;const x=(layout.bounds.x0+layout.bounds.x1)/2,z=6;for(let i=0;i<roofPoints.length;i+=9){const xs=[roofPoints[i],roofPoints[i+3],roofPoints[i+6]],zs=[roofPoints[i+2],roofPoints[i+5],roofPoints[i+8]];if(x>Math.min(...xs)&&x<Math.max(...xs)&&z>Math.min(...zs)&&z<Math.max(...zs))coversCenter=true;}assert(!coversCenter,'courtyard stays open');}
 assert(field.ridges.length>0,'ridge caps generated');
}
console.log('PASS fitted roof coverage, finite joined surfaces, wall clearance, courtyard and ridge caps');
