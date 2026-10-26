'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Castle=require('../../prototypes/labs/castle-drafts/castle-gen.js');
const City=require('../../prototypes/labs/castle-drafts/city-gen.js');
for(const seed of [1,45256,987]){
  const c=City.generate(seed,{scale:.7});
  const e=c.castle.entry,a=c.streets.find(s=>s.kind==='castle-approach');
  assert(e&&a,'city castle has a connected entrance');
  assert(Math.hypot(a.x1-c.castleAt.x-e.x,a.z1-c.castleAt.z-e.z)<1e-6,'approach ends at actual outer gate');
  const ring=c.streets.filter(s=>s.kind==='castle-ring');
  assert(ring.length>20,'precinct has a perimeter street');
  for(const s of c.streets)for(const k of ['x0','z0','x1','z1','w'])assert(Number.isFinite(s[k]));
  assert(c.castle.height-c.castle.top<c.castle.radius*1.3,'city castle has a broad skyline');
  const terraces=c.castle.parts.filter(p=>p.t==='ring');
  assert(terraces.length>=2&&terraces.every(p=>p.top>p.y),'terraces have solid vertical depth');
}
const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../../prototypes/labs/castle-drafts/castle-render.js'),'utf8'),context);
const R=context.window.CastleRender,p={t:'box',x:0,y:0,z:0,w:4,h:3.2,d:4,col:[.9,.85,.8],pat:5,bakeShade:true};
const m=R.meshParts([p],Castle.PALETTES[0]);assert(m.p.every(Number.isFinite));assert.equal(m.p.length,m.c.length);assert.equal(m.n.length,m.p.length);
for(const axis of [0,2])for(const sign of [-1,1]){const top=[],mid=[];for(let i=0;i<m.p.length;i+=3){if(Math.abs(m.n[i+axis]-sign)>.01)continue;const y=m.p[i+1];if(y===3.2)top.push(m.c[i]);if(y>1&&y<2.5)mid.push(m.c[i]);}assert(top.length&&mid.length);assert(Math.max(...top)<Math.min(...mid),'baked contact shade covers all four walls');}
console.log('PASS city castle entrance alignment, precinct streets, solid terraces, skyline proportions, baked wall shading');
// A plaza must rest on the same flat datum at its centre and perimeter.
for(const terrain of ['flat','rolling','hilly']){
  const c=City.generate(45256,{scale:.7,terrain,castleLayout:'rings'}),p=c.parts.find(p=>p.t==='disk'&&p.x===0&&p.z===0),top=p.y+.6;
  for(let i=0;i<32;i++){const a=i/32*Math.PI*2;for(const r of [0,p.r*.5,p.r])assert(Math.abs(top-c.gy(Math.cos(a)*r,Math.sin(a)*r)-.15)<.03,'central plaza terrain matches paving datum');}
}
for(const terrain of ['flat','hilly']){
  const c=City.generate(45256,{scale:.7,terrain}),roads=c.parts.filter(p=>p.terrainRoad);
  assert(roads.length>100);
  for(const p of roads){
    const L=Math.hypot(p.x1-p.x0,p.z1-p.z0),nx=-(p.z1-p.z0)/L*p.w/2,nz=(p.x1-p.x0)/L*p.w/2;
    for(const [x,z] of [[p.x0-nx,p.z0-nz],[p.x0+nx,p.z0+nz],[p.x1-nx,p.z1-nz],[p.x1+nx,p.z1+nz]])assert(p.base<=c.gy(x,z)+.001,'road retaining sides reach the terrain');
    assert.equal(p.sidePat,4,'road support uses stone instead of paving');
    if(p.stair)assert.equal(p.y0,p.y1,'stair treads are horizontal');
    else assert(Math.abs(p.y1-p.y0)/L<=.12001,'steep road grades use stairs');
  }
  const central=c.parts.find(p=>p.t==='disk'&&p.x===0&&p.z===0);
  const fields=c.parts.filter(p=>p.t==='field'&&p.x0<=central.r&&p.x0+160>=-central.r&&p.z0<=central.r&&p.z0+160>=-central.r);
  vm.runInNewContext(fs.readFileSync(require.resolve('../../prototypes/labs/castle-drafts/castle-walk.js'),'utf8'),context);
  const ground=R.meshParts(fields,c.palette),col=new context.window.CastleWalk.Collider(ground);
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2,x=Math.cos(a)*central.r*.8,z=Math.sin(a)*central.r*.8;assert(Math.abs(col.floor(x,c.gy(x,z)+1,z)-c.gy(x,z))<.01,'actual terrain triangles support the plaza');}
}
console.log('PASS plaza datum on flat/rolling/hilly terrain, supported roads, stair treads, retaining materials, terrain collision');
{
  const c=City.generate(45256,{scale:.7,terrain:'hilly'}),treads=c.parts.filter(p=>p.terrainRoad&&p.role==='street');
  let joins=0;for(let i=1;i<treads.length;i++){const a=treads[i-1],b=treads[i];if(Math.hypot(a.x1-b.x0,a.z1-b.z0)<1e-5){assert(Math.abs(a.y1-b.y0)<=.16001,'adjacent road treads have walkable risers');joins++;}}
  assert(joins>100);
  for(const p of c.parts.filter(p=>p.t==='disk'&&p.pat===3))for(let i=0;i<12;i++){const a=i/12*Math.PI*2;assert(Math.abs(p.y+.6-c.gy(p.x+Math.cos(a)*p.r*.9,p.z+Math.sin(a)*p.r*.9)-.15)<.03,'secondary plaza remains grounded');}
}
console.log('PASS walkable road risers and secondary plaza supports');
