'use strict';
const assert=require('node:assert/strict'),P=require('../../prototypes/labs/castle-drafts/toolkit/infinite/world-plan.js'),I=require('../../prototypes/labs/castle-drafts/toolkit/interiors/interior-kit.js');
assert.equal(P.desired(0,24).length,81);assert.equal(P.desired(0,24).filter(c=>!c.lod).length,9);
for(const [x,z] of [[0,0],[-1,-2],[123,-78]]){const a=P.chunk(x,z,1234),b=P.chunk(x,z,1234);assert.deepEqual(a,b,'chunk regeneration is deterministic');assert.equal(new Set(a.buildings.map(b=>b.id)).size,14);assert.equal(a.buildings.length,14);assert(a.buildings.every(b=>b.w>=6&&b.d>=8));for(const s of a.buildings.slice(0,2)){const i=I.create({...s,includeInterior:true});assert(i.rooms.length>=2);assert(i.doors.every(d=>Number.isFinite(d.x)&&Number.isFinite(d.y)&&Number.isFinite(d.z)));}}
assert.notDeepEqual(P.chunk(0,0,1),P.chunk(0,0,2),'different seeds produce different neighborhoods');
assert.equal(P.cell(-20.01,0).x,-1);assert.equal(P.cell(-20,0).x,0);assert.equal(P.cell(20,0).x,1);
for(let z=-20;z<=20;z+=2){const left=P.chunk(0,0),right=P.chunk(1,0);assert.equal(left.bounds.x1,right.bounds.x0);assert.equal(P.height(left.bounds.x1,z),P.height(right.bounds.x0,z),'shared terrain boundary');}
assert.throws(()=>P.chunk(Infinity,0));console.log('PASS streaming plan: deterministic seeds/negative coordinates, enterable lots, shared borders, bounded detail rings');

const plan=P.chunk(0,0);assert.equal(plan.block.endRows.flat().length,4);assert.equal(plan.courtyard.x1-plan.courtyard.x0,14);assert.equal(plan.courtyard.gates.length,2);
assert(Math.abs(P.height(80,0)-P.height(-80,0))>5,'terrain has visible city-scale elevation change');
for(let i=0;i<plan.buildings.length;i++)for(let j=i+1;j<plan.buildings.length;j++){const bounds=s=>{const c=Math.abs(Math.cos(s.rot)),n=Math.abs(Math.sin(s.rot));return {x:s.x,z:s.z,w:c*s.w+n*s.d,d:n*s.w+c*s.d};},a=bounds(plan.buildings[i]),b=bounds(plan.buildings[j]);assert(Math.abs(a.x-b.x)>=(a.w+b.w)/2-1e-6||Math.abs(a.z-b.z)>=(a.d+b.d)/2-1e-6,'courtyard ring lots do not overlap');}

for(const s of P.chunk(0,0).buildings){const b=I.create({...s,x:0,z:0,rot:0,floor:0});for(const side of [-1,1])if(side<0?s.partyLeft:s.partyRight)assert(!b.parts.some(p=>p.role==='pane'&&Math.abs(p.x)>s.w/2-.4&&Math.sign(p.x)===side),'shared side walls do not generate windows');}

const layouts=P.chunk(0,0).buildings;assert(new Set(layouts.map(s=>s.floorplan)).size>1,'city lots use varied ground plans');assert(new Set(layouts.map(s=>s.stairs)).size===2,'city lots use both stair sides');
