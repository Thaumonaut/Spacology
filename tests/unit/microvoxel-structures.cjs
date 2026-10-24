'use strict';
// Ruins and settlements in the streamed world: every small ruin kind appears near the start, sites are built from the
// anime-ruin kit in the new stones, the part index finds every part that can touch a column, decay stays in the ruin
// range, and everything regenerates identically.
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js'),assert=require('node:assert/strict');
const w=M.createWorld(2718,.25,'infinite'),sites=new Map();
for(let j=-12;j<=12;j++)for(let i=-12;i<=12;i++){const R=w.landmarksAt(i*150+75,j*150+75).ruin;if(R)sites.set(R,1);}
const list=[...sites.keys()],kinds=new Set(list.map(R=>R.kind));
for(const k of ['castle','town','temple','monoliths'])assert.ok(kinds.has(k),`a ${k} ruin within 1.8 km`);
for(const R of list){
  assert.ok(R.decay>=.5&&R.decay<=.9,`${R.kind} decay ${R.decay} is a ruin's`);
  assert.ok([10,15].includes(R.course),'course height is 0.5 or 0.75 m (10 or 15 in 5 cm steps)');
  assert.ok([M.MAT.masonryWarm,M.MAT.masonryDark].includes(R.mat),'site stone is warm or dark masonry');
  for(const q of R.parts)assert.ok(['box','ring','pillar','fallen','pave'].includes(q.t),`known part ${q.t}`);
}
assert.ok(list.filter(R=>R.mat===M.MAT.masonryWarm).length>list.length/2,'cream sandstone is the common ruin stone');
// The part index: every part whose footprint (plus the 2 m strip margin) holds a point is in that point's bucket.
const rect=q=>{if(q.t==='ring'){const r=q.r+(q.th?q.th/2:0);return [q.cx-r,q.cz-r,q.cx+r,q.cz+r];}const ex=Math.abs(q.ux)*q.hl+Math.abs(q.uz)*q.hw,ez=Math.abs(q.uz)*q.hl+Math.abs(q.ux)*q.hw;return [q.cx-ex,q.cz-ez,q.cx+ex,q.cz+ez];};
let probes=0;
for(const R of list.slice(0,12))for(let n=0;n<400;n++){
  const x=R.x+(M.hash(n,1,7)-.5)*2*R.reach,z=R.z+(M.hash(n,2,7)-.5)*2*R.reach,b=R.grid.get(Math.floor(x/16)*65536+Math.floor(z/16))||[];
  for(const q of R.parts){const r=rect(q);if(x>r[0]-2&&x<r[2]+2&&z>r[1]-2&&z<r[3]+2){assert.ok(b.includes(q),`${R.kind} part ${q.t} indexed at ${x.toFixed(1)},${z.toFixed(1)}`);probes++;}}
}
assert.ok(probes>500,'index probes hit many parts');
// Columns across a site carry the new stone and paving; regenerated worlds agree column for column.
const again=M.createWorld(2718,.25,'infinite'),seen=new Set();
for(const R of list.slice(0,8))for(let n=0;n<300;n++){
  const vx=Math.floor((R.x+(M.hash(n,3,9)-.5)*1.6*R.reach)/.25),vz=Math.floor((R.z+(M.hash(n,4,9)-.5)*1.6*R.reach)/.25),a=w.column(vx,vz),b=again.column(vx,vz);
  assert.deepEqual(a,b,'ruin columns are deterministic');for(const m of a)seen.add(m);
}
for(const m of ['masonryWarm','paving'])assert.ok(seen.has(M.MAT[m]),`${m} appears in ruin columns`);
assert.ok(M.ABOVE_GROUND.has(M.MAT.masonryWarm)&&M.ABOVE_GROUND.has(M.MAT.masonryDark)&&!M.ABOVE_GROUND.has(M.MAT.paving),'ruin stone stands on the ground; paving is ground');
assert.equal(M.COLORS.length,M.MAT.paving+1,'every material has a colour');
console.log(`microvoxel structures: PASS (${list.length} ruins, kinds ${[...kinds].join(', ')}, ${probes} index probes)`);
