'use strict';
const assert=require('node:assert/strict'),P=require('../../prototypes/labs/castle-drafts/toolkit/shape-study/plot-plan.js');
for(const form of Object.keys(P.FORMS))for(const plot of ['straight','tapered'])for(const width of [5,6,9])for(const depth of [12,20])for(const storeys of [2,4]){
 const p=P.make({form,plot,width,depth,storeys});assert.equal(p.floors.length,storeys);
 for(const f of p.floors){assert.equal(f.loops.length,1,form+' stays connected');for(const part of f.parts)for(const v of part.poly){assert(v.every(Number.isFinite));assert(v[0]>=.35-1e-6&&v[0]<=width-.35+1e-6);assert(v[1]>=.5-1e-6&&v[1]<=depth-.5+1e-6);const maxX=width-.35-(plot==='tapered'?.8:0)*(v[1]-.5)/(depth-1);assert(v[0]<=maxX+1e-6,'tapered parcel respected');}
 // Every retained wall faces outside the complete footprint; buried component walls are removed.
 for(const e of f.edges){const dx=e.b[0]-e.a[0],dz=e.b[1]-e.a[1],len=Math.hypot(dx,dz),mid=[(e.a[0]+e.b[0])/2,(e.a[1]+e.b[1])/2];assert(len>1e-6);assert(!f.parts.some(part=>P.inside([mid[0]+dz/len*.0001,mid[1]-dx/len*.0001],part.poly)));}
 assert(f.parts.some(part=>P.inside([p.stair.x+.9,p.stair.z+1.4],part.poly)),'stair reservation remains in building');}
 const ground=p.floors[0];assert(ground.edges.some(e=>Math.abs(e.a[1]-p.front)<1e-6&&Math.abs(e.b[1]-p.front)<1e-6&&p.door.x>Math.min(e.a[0],e.b[0])&&p.door.x<Math.max(e.a[0],e.b[0])),'front entrance remains exposed');
}
const oriel=P.make({form:'oriel'});assert(!oriel.floors[0].parts.some(p=>p.id==='bay'));assert(oriel.floors[1].parts.some(p=>p.id==='bay'));
assert.deepEqual(P.make({form:'turret'}),P.make({form:'turret'}));
console.log('PASS townhouse shapes: connected unions, tapered plots, side clearance, stairs and exposed entrances');
