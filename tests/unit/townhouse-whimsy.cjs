'use strict';
const assert=require('node:assert/strict'),P=require('../../prototypes/labs/castle-drafts/toolkit/shape-study/plot-plan.js'),T=require('../../prototypes/labs/castle-drafts/toolkit/shape-study/trim-plan.js');
const area=loop=>Math.abs(loop.reduce((s,p,i)=>{const q=loop[(i+1)%loop.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
for(const form of Object.keys(P.FORMS))for(const plot of ['straight','tapered'])for(const width of [5,6,9])for(const storeys of [2,3,4]){
 const p=P.make({form,plot,width,storeys,character:'whimsical'}),base=p.floors[0],top=p.floors.at(-1);assert.equal(p.character,'whimsical');assert.equal(p.floors.length,storeys);assert(area(top.parts.find(p=>p.id==='main').poly)>area(base.parts.find(p=>p.id==='main').poly)*1.08,'top-heavy usable floor area');for(const f of p.floors){assert.equal(f.loops.length,1);for(const loop of f.loops){assert(T.ring(loop,f.y,.16).every(Number.isFinite));for(const v of loop){assert(v[0]>=.35-1e-6&&v[0]<=width-.35+1e-6&&v[1]>=.5-1e-6&&v[1]<=p.depth-.5+1e-6);}}assert(f.parts.some(part=>P.inside([p.stair.x+.9,p.stair.z+1.4],part.poly)));}assert(base.edges.some(e=>Math.abs(e.a[1]-p.front)<1e-6&&Math.abs(e.b[1]-p.front)<1e-6&&p.door.x-p.door.width/2>=Math.min(e.a[0],e.b[0])-1e-6&&p.door.x+p.door.width/2<=Math.max(e.a[0],e.b[0])+1e-6));
}
assert.notDeepEqual(P.make({character:'whimsical'}).floors,P.make({character:'grounded'}).floors,'style changes volumes rather than decoration');
console.log('PASS whimsical massing: top-heavy floor area, connected supported storeys, entrance and parcel clearance');
