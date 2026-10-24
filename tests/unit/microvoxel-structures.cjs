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
  for(const q of R.parts)assert.ok(['box','ring','pillar','fallen','pave','roof','cone','dome'].includes(q.t),`known part ${q.t}`);
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
assert.equal(M.COLORS.length,M.MAT.plaster+1,'every material has a colour');
for(const m of ['roofSlate','roofRed','roofGreen','roofGold','plaster'])assert.ok(M.ABOVE_GROUND.has(M.MAT[m])&&M.BODY_SOLID.has(M.MAT[m]),`${m} stands and blocks like masonry`);
// Decay: the same walled sites intact (0) stand far taller than buried (0.9); temple pillars stand whole when intact.
const stone=new Set([M.MAT.masonryWarm,M.MAT.masonryDark,M.MAT.mossy]);
const intact=M.createWorld(2718,.25,'infinite',{ruinDecay:0}),buried=M.createWorld(2718,.25,'infinite',{ruinDecay:.9});
assert.notEqual(intact.dataId,buried.dataId,'a forced decay has its own cache identity');
for(const R of [...list.filter(R=>R.kind==='town').slice(0,2),...list.filter(R=>R.kind==='castle').slice(0,2)]){let a=0,b=0;
  for(let vz=Math.floor((R.z-R.reach)/.25);vz<(R.z+R.reach)/.25;vz+=4)for(let vx=Math.floor((R.x-R.reach)/.25);vx<(R.x+R.reach)/.25;vx+=4){
    const ca=intact.column(vx,vz),cb=buried.column(vx,vz),h=Math.ceil(intact.ground((vx+.5)*.25,(vz+.5)*.25)/.25)+1;
    for(let y=h;y<ca.length;y++){if(stone.has(ca[y]))a++;if(stone.has(cb[y]))b++;}}
  assert.ok(a>b*1.6,`${R.kind} at ${R.x.toFixed(0)},${R.z.toFixed(0)}: intact stone ${a} well above buried ${b}`);
  assert.equal(intact.landmarksAt(R.x,R.z).ruin.decay,0);assert.equal(buried.landmarksAt(R.x,R.z).ruin.decay,.9);
}
{const T=list.find(R=>R.kind==='temple'),whole=W=>W.landmarksAt(T.x,T.z).ruin.parts.filter(q=>q.t==='pillar'&&q.cap).length;assert.ok(whole(intact)>whole(buried),'more whole temple pillars when intact');}
// Intact hamlets keep their tiled roofs (and the roof material shows in their columns); buried ones have none.
{const T=list.find(R=>R.kind==='town'),roofs=W=>W.landmarksAt(T.x,T.z).ruin.parts.filter(q=>q.t==='roof').length;assert.ok(roofs(intact)>4&&roofs(buried)===0,'roofs on intact houses only');
  const R=intact.landmarksAt(T.x,T.z).ruin,q=R.parts.find(q=>q.t==='roof'),col=intact.column(Math.floor(q.cx/.25),Math.floor(q.cz/.25));assert.ok(col.includes(q.mat),'a roof column holds its tiles');}
// Per-building decay varies around the site's: a hamlet's houses do not all share one value.
{const T=list.find(R=>R.kind==='town'),decs=new Set(T.parts.filter(q=>q.t==='box'&&q.maxS).map(q=>q.dec.toFixed(3)));assert.ok(decs.size>3,'houses carry their own decay');}
console.log(`microvoxel structures: PASS (${list.length} ruins, kinds ${[...kinds].join(', ')}, ${probes} index probes)`);
// Crag castles: a few within 6 km of the start, intact, on a raised crag with a walkable bridge deck down to the land;
// cone-roofed towers, a palace roof; their footprint keeps small ruins out, node bounds cover their spires, and a
// castle is the same whichever way its cell is first reached.
{
  const castles=w.sitesIn(-6000,-3000,6000,3000).filter(S=>S.kind==='castle');
  assert.ok(castles.length>=2,`castles near the start (${castles.length})`);
  for(const C of castles){
    assert.ok(C.decay<=.25,'castles are mostly intact');
    const kinds=new Set(C.parts.map(q=>q.t));for(const t of ['cone','roof','ring','bridge'])assert.ok(kinds.has(t),`castle has ${t} parts`);
    assert.ok(Math.abs(w.ground(C.crag.cx,C.crag.cz)-C.crag.T)<1,'crag top at its level');
    assert.ok(C.top>C.crag.T+30,'towers rise well over the crag');
    const B=C.bridge;let prev=null,rise=0;
    for(let u=0;u<=B.len;u+=.25){const g=w.ground(B.x0+B.ux*u,B.z0+B.uz*u);if(prev!=null)rise=Math.max(rise,Math.abs(g-prev));prev=g;}
    assert.ok(rise<=.55,`bridge deck is walkable (largest 25 cm step ${rise.toFixed(2)} m)`);
    const L=Math.floor(Math.log2(64/.25))-2,m=w.nodeMetres(L);assert.ok(w.nodeBound(L,Math.floor(C.x/m),Math.floor(C.z/m))>=C.top,'node bound covers the spires');
    for(let n=0;n<40;n++){const a=n/40*Math.PI*2,R=w.landmarksAt(C.x+Math.cos(a)*C.reach*.8,C.z+Math.sin(a)*C.reach*.8).ruin;if(R)assert.ok(Math.hypot(R.x-C.x,R.z-C.z)>R.reach+C.reach*.5||!R,'no small ruin inside a castle');}
  }
  // Island castles: water stays under the bridge arches.
  const I=castles.find(C=>C.setting==='island');
  if(I){const B=I.bridge;let wet=0;for(let u=B.flat+4;u<B.len;u+=1){const c=w.column(Math.floor((B.x0+B.ux*u)/.25),Math.floor((B.z0+B.uz*u)/.25));if(c.includes(M.MAT.water))wet++;}assert.ok(wet>3,'water flows under an island castle bridge');}
  const C=castles[0],fresh=M.createWorld(2718,.25,'infinite');fresh.column(Math.floor(C.x/.25),Math.floor(C.z/.25));
  const D=fresh.landmarksAt(C.x,C.z).site;assert.ok(D&&D.parts.length===C.parts.length&&D.crag.T===C.crag.T,'castle independent of first touch');
  console.log(`crag castles: PASS (${castles.length} within 6 km: ${castles.map(C=>`${C.setting} ${C.x.toFixed(0)},${C.z.toFixed(0)}`).join('; ')})`);
}
