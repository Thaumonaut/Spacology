'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const K=require('../../prototypes/labs/castle-drafts/toolkit/town-kit.js'),C=require('../../prototypes/labs/castle-drafts/castle-gen.js');
const context={window:{}};for(const file of ['castle-render.js','castle-walk.js'])vm.runInNewContext(fs.readFileSync(require.resolve('../../prototypes/labs/castle-drafts/'+file),'utf8'),context);
for(const grade of [0,.055,.18]){
 const s=K.street({grade}),mesh=context.window.CastleRender.meshParts(s.parts,C.PALETTES[0]),col=new context.window.CastleWalk.Collider(mesh);
 assert.equal(s.buildings.length,3);assert.equal(s.connections.length,3);assert(mesh.p.every(Number.isFinite));assert.equal(mesh.p.length,mesh.c.length);
 for(const b of s.buildings){const f=b.footprint;for(const dx of [-1,1])for(const dz of [-1,1])assert(Math.abs(s.ground(f.x+dx*f.w*.45,f.z+dz*f.d*.45)-(f.floor-.12))<1e-6,'building footprint is flattened');}
 for(const e of s.connections){const b=s.buildings.find(b=>b.id===e.building);assert.deepEqual(e.sockets.door,b.sockets.door);
  // Probe the actual rendered/collision triangles along the entire entrance flight.
  const a=e.sockets.street,d=e.sockets.door,N=120;let last=null;
  for(let i=0;i<=N;i++){const t=i/N,z=a.z+(d.z-a.z)*t,y=col.floor(a.x,Math.max(a.y,d.y)+.5,z,0);assert(Number.isFinite(y),'entrance has continuous support');if(last!=null)assert(Math.abs(y-last)<.19,'entrance risers stay walkable');last=y;}
  assert(Math.abs(last-b.footprint.floor)<.015,'landing meets door threshold');
 }
 for(let x=-20;x<=20;x+=.2){const y=col.floor(x,15,12,0);assert(Number.isFinite(y),'street remains continuous');}
 if(grade>.12)assert(s.road.steps>0,'steep street becomes stairs');else assert.equal(s.road.steps,0);
}
assert.throws(()=>K.street({grade:NaN}));assert.throws(()=>K.wallBay({w:-1}));
const bay=K.wallBay({h:1.65}),hole=bay.opening;assert(hole.y+hole.h<1.65,'short dormer windows fit their wall');
const transformed=K.transform([{t:'box',x:2,y:1,z:0,w:1,h:1,d:1}],10,2,5,Math.PI/2)[0];assert(Math.abs(transformed.x-10)<1e-6);assert.equal(transformed.z,7);assert.equal(transformed.y,3);
console.log('PASS toolkit: flat/sloping/stepped streets, grounded foundations, rendered entrance continuity, doorway sockets, dimensions and transforms');
// Roof geometry must not share a sloping surface with the gable infill.
const roof=K.roof({w:6,d:7,y:10,h:4});
for(const part of roof.parts.filter(p=>p.wallOnly)){
 const mesh=context.window.CastleRender.meshParts([part],C.PALETTES[0]);
 assert(mesh.n.every((n,i)=>i%3!==1||Math.abs(n)<1e-6),'gable infill contains vertical faces only, preventing coplanar roof strips');
}
for(const b of K.street({grade:.18}).buildings){const ch=b.chimney;
 for(const dx of [-1,1])for(const dz of [-1,1]){const contact=b.roofHeight(ch.x-b.footprint.x+dx*ch.w/2,ch.z+dz*ch.d/2);assert(ch.bottom<contact-.1,'chimney shaft embeds beneath every roof contact corner');assert(ch.top>contact+1,'chimney rises above roof');}
}
console.log('PASS vertical-only gable infill and chimney contact on both ridge orientations');
// A window is a connected assembly in 3D, not floating trim layered in front of glass.
for(const opening of ['window','shop','door']){
 const pieces=K.wallBay({opening}).joinery;
 const touches=(a,b)=>[0,1,2].every(axis=>{const key=['x','y','z'][axis],size=['w','h','d'][axis],a0=a[key]-(axis===1?0:a[size]/2),b0=b[key]-(axis===1?0:b[size]/2);return Math.max(a0,b0)<=Math.min(a0+a[size],b0+b[size])+1e-7;});
 const connected=new Set([0]);let changed=true;while(changed){changed=false;for(let i=0;i<pieces.length;i++)if(!connected.has(i)&&[...connected].some(j=>touches(pieces[i],pieces[j]))){connected.add(i);changed=true;}}
 assert.equal(connected.size,pieces.length,opening+' casing, backing and joinery physically connect');
}
console.log('PASS physically connected window, storefront and door assemblies');
{
 const passage=K.wallBay({opening:'bay',shutters:true});assert.equal(passage.joinery.length,0,'projecting bay replaces old window rather than covering it');
 const s=K.street(),shop=s.buildings.find(b=>b.id==='apothecary'),sign=shop.parts.find(p=>p.role==='sign-board'),bracket=shop.parts.find(p=>p.role==='sign-bracket'),hangers=shop.parts.filter(p=>p.role==='sign-hanger');
 const awning=shop.parts.find(p=>p.pat===10);assert(Math.abs(sign.x-awning.x0)>awning.w/2+sign.w/2+.1||sign.z-sign.d/2>Math.max(awning.z0,awning.z1)+.1,'sign clears the door awning sideways or beyond its edge');assert(sign.d>sign.w*4,'blade sign is perpendicular to facade');assert.equal(hangers.length,2);
 for(const h of hangers){assert(h.y<=sign.y+sign.h&&h.y+h.h>=bracket.y,'hanging rods connect the sign to its bracket');}
 assert(!s.parts.some(p=>p.pat===5),'kit plaster uses clean surfaces instead of projected exposed-brick patches');
}
console.log('PASS replaced bay opening, attached sign clear of awning, and clean plaster material');
{
 const r=K.roof({w:6,d:7,y:10,h:4}),m=context.window.CastleRender.meshParts(r.parts,C.PALETTES[0]),collider=new context.window.CastleWalk.Collider(m);
 for(const z of [-3.49,0,3.49])assert(collider.ray([0,9.8,z],[0,1,0],.5)<.5,'continuous eave closure blocks light/rays above wall top');
 const a={t:'box',x:0,y:2,z:0,w:1,h:1,d:1,col:[.8,.8,.7],pat:11},b={...a,x:10};
 assert.deepEqual(context.window.CastleRender.meshParts([a],C.PALETTES[0]).c,context.window.CastleRender.meshParts([b],C.PALETTES[0]).c,'clean plaster has no arbitrary per-piece color changes');
}
console.log('PASS solid roof/eave closure and consistent clean plaster');
for(const grade of [0,.055,.18]){
 const s=K.street({grade}),mesh=context.window.CastleRender.meshParts(s.parts,C.PALETTES[0]),col=new context.window.CastleWalk.Collider(mesh);
 assert.equal(s.terraced,grade>.1);assert(s.frontageSetback<=(s.terraced?3.2:2.00001));
 for(const e of s.connections){const l=e.landings.street;
  // Walk across a stair junction: the full entrance width meets one flat street level.
  for(const dx of [-.8,0,.8])for(const z of [l.z0+.1,l.z1-.1,l.z1+.15]){const floor=col.floor(l.x+dx,l.y+1,z,0);assert(Math.abs(floor-l.y)<.015,'stair junction and street landing remain flat across their width');}
  if(s.terraced)assert(Math.abs(e.sockets.door.y/.16-Math.round(e.sockets.door.y/.16))<1e-6,'steep frontage uses terraced floor datums');
 }
 if(s.terraced)assert.equal(s.pavement.sources.filter(s=>s.role==='terrace').length,3);
}
console.log('PASS compact frontage, flat street/entrance junctions, and terraced homes on steep ground');
for(const preset of ['craft','civic'])for(const grade of [0,.055,.18]){
 const s=K.street({preset,grade}),m=context.window.CastleRender.meshParts(s.parts,C.PALETTES[0]),col=new context.window.CastleWalk.Collider(m);assert.equal(s.buildings.length,3);assert(m.p.every(Number.isFinite),'all typology geometry is finite');
 for(const e of s.connections){const a=e.sockets.street,d=e.sockets.door;let last=null;for(let i=0;i<=120;i++){const t=i/120,y=col.floor(a.x,Math.max(a.y,d.y)+.5,a.z+(d.z-a.z)*t,0);assert(Number.isFinite(y),'each building type has supported access');if(last!=null)assert(Math.abs(y-last)<.2,'each building type has walkable entrance risers');last=y;}assert(Math.abs(last-d.y)<.02);}
 assert(!s.buildings.some(b=>b.variant==='guildhall'),'unique guild landmark is excluded from neighborhood presets');
}
assert.equal(K.TYPES.guildhall.unique,true);
console.log('PASS craft and neighborhood typologies, supported access at three grades, unique guild excluded from normal streets');
for(const preset of ['street','craft','civic']){
 const s=K.street({preset});for(let i=1;i<s.buildings.length;i++){const a=s.buildings[i-1].footprint,b=s.buildings[i].footprint,gap=b.x-b.w/2-a.x-a.w/2;assert(Math.abs(gap-.32)<1e-6,'frontage uses compact footprint-based spacing');}
 const smithy=s.buildings.find(b=>b.variant==='smithy');if(smithy){const a=smithy.features.workArea;assert(a.covered&&a.width>=7&&a.z1-a.z0>=2.4,'smithy has a usable covered work yard');assert(smithy.parts.some(p=>p.role==='forge-flue'));assert(smithy.parts.some(p=>p.role==='anvil'));const canopy=smithy.parts.find(p=>p.role==='work-canopy');assert(canopy.closedBottom&&canopy.thickness>0,'workshop roof is a closed structural canopy');}
 const warehouse=s.buildings.find(b=>b.variant==='warehouse');if(warehouse){assert.equal(warehouse.features.glazedWindows,0);assert.equal(warehouse.features.loadingLevels,3);assert(warehouse.parts.some(p=>p.role==='loading-door'));assert(!warehouse.parts.some(p=>p.role==='chimney'),'storage building has no decorative house chimney');}
 const pub=s.buildings.find(b=>b.variant==='pub');if(pub){assert.deepEqual(pub.features.materials,['stone','timber']);assert(pub.parts.some(p=>p.role==='pub-fascia'));assert(!pub.parts.some(p=>p.pat===10),'pub frontage is joinery and masonry rather than a cafe awning');}
}
console.log('PASS dense row packing, structural forge yard, freight warehouse, and wood/stone pub blueprint');
for(const preset of ['street','craft','civic']){
 const s=K.street({preset});s.buildings.forEach((b,i)=>{for(const side of [-1,1])if(side<0?i>0:i<s.buildings.length-1){const edge=b.footprint.x+side*b.footprint.w/2;assert(!b.parts.some(p=>p.role==='pane'&&Math.abs(Math.cos(p.rot||0))<.01&&Math.abs(p.x-edge)<.4),'party walls do not contain hidden side windows');}});
 assert(s.footway.parts.length>0,'continuous paved footway connects the frontage');
 const smithy=s.buildings.find(b=>b.variant==='smithy');if(smithy){const m=context.window.CastleRender.meshParts(s.parts,C.PALETTES[0]),col=new context.window.CastleWalk.Collider(m),a=smithy.features.workArea;assert(col.ray([a.x,smithy.footprint.floor+1.8,(a.z0+a.z1)/2],[0,1,0],1.5)<1.5,'forge working area is actually roofed');}
}
console.log('PASS blank party walls, shared frontage paving, and roofed forge working volume');
{
 const b=K.street({preset:'civic'}).buildings.find(b=>b.variant==='chapel'),shaft=b.parts.find(p=>p.role==='bell-shaft');
 const intersects=p=>{const c=Math.abs(Math.cos(p.rot||0)),s=Math.abs(Math.sin(p.rot||0)),hx=(p.w*c+p.d*s)/2,hz=(p.w*s+p.d*c)/2;return Math.abs(p.x-shaft.x)<hx+shaft.w/2&&Math.abs(p.z-shaft.z)<hz+shaft.d/2;};
 assert(!b.parts.some(p=>['pane','jamb','header','sill'].includes(p.role)&&intersects(p)),'bell tower replaces covered window openings and all their joinery');
}
console.log('PASS chapel tower junction has no buried or half-exposed windows');
const P=require('../../prototypes/labs/castle-drafts/toolkit/pavement-plan.js');
{
 const sources=[P.source({t:'box',x:0,z:0,y:-.2,w:10,d:10,h:.2},0),P.source({t:'box',x:0,z:0,y:.8,w:2,d:6,h:.2},10)],p=P.build(sources,()=>-.2);
 assert(Math.abs(p.parts.reduce((n,q)=>n+(q.x1-q.x0)*(q.z1-q.z0),0)-100)<1e-6,'shared paving retains the union area exactly once');
 for(let i=0;i<p.parts.length;i++)for(let j=0;j<i;j++){const a=p.parts[i],b=p.parts[j],overlap=Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))*Math.max(0,Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0));assert(overlap<1e-9,'pavement cells never overlap');}
 for(const q of p.parts.filter(q=>q.owner===1))for(const s of q.skirts){assert(Math.abs(s.lo0)<1e-6&&Math.abs(s.lo1)<1e-6,'raised entrance skirts stop at neighboring surface');}
}
for(const preset of ['slums','market','homes','shops'])for(const grade of [0,.055,.18]){
 const s=K.street({preset,grade}),m=context.window.CastleRender.meshParts(s.parts,C.PALETTES[0]),col=new context.window.CastleWalk.Collider(m);
 assert.equal(s.buildings.length,preset==='market'?5:preset==='homes'?4:3);assert(m.p.every(Number.isFinite));assert.equal(new Set(s.buildings.map(b=>b.shell)).size,s.buildings.length,'new set has distinct building shells');
 assert(!s.parts.some(p=>['door-landing','door-threshold','work-yard','display-pad','ground-floor'].includes(p.role)&&p.t==='box'),'owned paving is emitted only through shared surface patches');
 for(const e of s.connections){const a=e.sockets.street,d=e.sockets.door;let last=null;for(let i=0;i<=120;i++){const t=i/120,y=col.floor(a.x,Math.max(a.y,d.y)+.5,a.z+(d.z-a.z)*t,0);assert(Number.isFinite(y));if(last!=null)assert(Math.abs(y-last)<.2,'new shop/slum entrance stays walkable');last=y;}assert(Math.abs(last-d.y)<.02);}
}
console.log('PASS single-owner paving with exposed risers, varied slum/market shells, and supported entrances at three grades');

{
 const city=require('../../prototypes/labs/castle-drafts/toolkit/city-kit.js').build();
 assert.equal(city.buildings.length,224);assert.equal(city.blocks.length,16);assert.equal(new Set(city.buildings.map(b=>b.id)).size,224);
 const byId=new Map(city.buildings.map(b=>[b.id,b]));
 for(const block of city.blocks)for(const row of block.rows){const fs=row.map(id=>byId.get(id).footprint);assert(Math.abs(fs[0].x-fs[0].w/2-(block.x-block.w/2))<1e-6);assert(Math.abs(fs.at(-1).x+fs.at(-1).w/2-(block.x+block.w/2))<1e-6);for(let i=1;i<fs.length;i++)assert(Math.abs(fs[i].x-fs[i].w/2-fs[i-1].x-fs[i-1].w/2-.18)<1e-6,'no unfilled frontage slots');}
 const mesh=context.window.CastleRender.meshParts(city.parts,C.PALETTES[0]);assert(mesh.p.every(Number.isFinite));const col=new context.window.CastleWalk.Collider(mesh);
 for(const c of city.connections){const a=c.sockets.street,d=c.sockets.door;const ay=col.floor(a.x,4.4,a.z,0);assert(ay>=3.83&&ay<=4.02,'street approach is supported: '+c.building+' '+ay);assert(Math.abs(col.floor(d.x,d.y+.4,d.z,0)-d.y)<.02,'transformed doorway threshold meets floor');}
 for(const b of city.buildings)for(const [key,s] of Object.entries(b.sockets))if(key!=='door'){const forward=key==='rearDoor'?(b.footprint.z<city.blocks.find(q=>q.rows.flat().includes(b.id)).z?1:-1):(b.footprint.z<city.blocks.find(q=>q.rows.flat().includes(b.id)).z?-1:1);const y=col.floor(s.x,s.y+.4,s.z+forward*.35,0);assert(Math.abs(y-s.y)<.16,'city elevated door connects to deck: '+b.id+' '+key);}
 console.log('PASS 224-building city: all 224 frontage slots occupied, unique IDs, finite full-detail mesh and supported approaches/thresholds');
}

for(const preset of ['fronts','massing','storage','green','forms','large','slumDense'])for(const grade of [0,.055,.18]){
 const s=K.street({preset,grade}),m=context.window.CastleRender.meshParts(s.parts,C.PALETTES[0]);assert(m.p.every(Number.isFinite));assert.equal(s.buildings.length,preset==='slumDense'?5:3);
}
for(const variant of ['house','inn','apothecary','galleryHouse','manor']){
 const b=K.building({...K.TYPES[variant],id:variant,variant,x:0,z:0,floor:4,ground:()=>3.84});const walls=b.parts.filter(p=>p.role==='masonry-wall');assert(walls.length>0,variant+' has stone ground floor');assert(walls.every(p=>p.y+p.h<=4+b.storeyHeight+.001),'stone finish ends at the first storey');assert(b.parts.some(p=>p.pat===11&&p.y>=4+b.storeyHeight),'plaster upper floor remains');
}
{const b=K.bridge({a:{x:1,z:2},b:{x:5,z:10}});assert(b.clearance>3);assert.deepEqual(b.sockets.a,{x:1,z:2,y:7.2});assert.deepEqual(b.sockets.b,{x:5,z:10,y:7.2});}

for(const preset of ['large','forms','green']){
 const s=K.street({preset}),mesh=context.window.CastleRender.meshParts(s.parts,C.PALETTES[0]),col=new context.window.CastleWalk.Collider(mesh);
 for(const b of s.buildings)for(const [name,d] of Object.entries(b.sockets))if(name.startsWith('upperDoor')){for(const dx of [-.45,0,.45])for(const dz of [.15,.4,.65]){const y=col.floor(d.x+dx,d.y+.4,d.z+dz,0);assert(Math.abs(y-d.y)<.16,'elevated door has a full supported landing: '+b.variant);}}
}
assert.equal(K.wallBay({w:.65,h:3,windowWidth:.45}).opening.w,.45,'bay side openings fit within their walls');

for(const variant of ['apothecary','pub'])for(const grade of [-.18,.18]){
 const b=K.building({...K.TYPES[variant],variant,id:variant,x:0,z:0,floor:4,ground:()=>3.84,streetHeight:x=>3.84+grade*x});const sign=b.parts.find(p=>['sign-board','pub-sign'].includes(p.role));assert(sign.x*grade<0,'blade sign prefers downhill side');
}
{const s=K.street({preset:'large',grade:.18});for(const b of s.buildings){const f=b.footprint;for(const p of b.parts)if(p.role==='sill'&&p.y<f.floor+1&&Math.abs(p.z-(f.z+f.d/2+.32))<.15)assert(Math.max(s.roadHeight(p.x-.8),s.roadHeight(p.x+.8))<=f.floor+.45,'uphill ground windows are omitted before road buries them');}}

{
 const b=K.building({...K.TYPES.galleryHouse,variant:'galleryHouse',x:0,z:0,floor:4,ground:()=>3.84});assert(b.sockets.door.z<b.footprint.d/2-.4,'gallery door is recessed');for(const p of b.parts.filter(p=>p.role==='gallery-post'))assert(Math.abs(p.x-b.sockets.door.x)>.75,'gallery posts leave door approach clear');
 const city=require('../../prototypes/labs/castle-drafts/toolkit/city-kit.js').build({grade:.12});assert(city.strings.every(s=>s.clearance>3.3));assert.equal(city.coverage.occupiedSlots,224);assert.equal(city.bridges.length,4);assert(new Set(city.buildings.map(b=>Math.round(b.footprint.floor))).size>10,'city uses varied elevations');
 const mesh=context.window.CastleRender.meshParts(city.parts,C.PALETTES[0]),col=new context.window.CastleWalk.Collider(mesh);assert(mesh.p.every(Number.isFinite));
 for(const e of city.connections){const s=e.sockets.door,y=col.floor(s.x,s.y+.4,s.z,0);assert(Math.abs(y-s.y)<.17,'sloped city doorway has support: '+e.building+' '+y+' '+s.y);}
 for(const b of city.bridges){const a=b.sockets.a,d=b.sockets.b;for(let i=1;i<20;i++){const t=i/20,y=a.y+(d.y-a.y)*t,yy=col.floor(a.x+(d.x-a.x)*t,y+.3,a.z+(d.z-a.z)*t,0);assert(Math.abs(yy-y)<.03,'street bridge slope meets both doors');}}
}

for(const grade of [-.18,0,.18]){
 const city=require('../../prototypes/labs/castle-drafts/toolkit/city-kit.js').build({grade}),mesh=context.window.CastleRender.meshParts(city.parts,C.PALETTES[0]),col=new context.window.CastleWalk.Collider(mesh);
 assert.equal(city.sidewalk.rows.length,32);assert(city.sidewalk.carriagewayWidth>=4,'road has room for wagons');
 for(const row of city.sidewalk.rows){
  for(let i=1;i<row.sections.length;i++)assert(Math.abs(row.sections[i].y-row.sections[i-1].y)<=.161,'sidewalk risers stay shallow');
  for(const n of row.landings)for(const dx of [-.65,0,.65]){const z=row.face+row.sign*.45,y=col.floor(n.x+dx,n.y+.25,z,0);assert(Math.abs(y-n.y)<.025,'door frontage has a broad level landing: '+grade+' '+n.building+' '+dx+' '+y+' expected '+n.y);}
  let lastWalk=null;for(let x=row.x0+.05;x<row.x1;x+=.12){const z=row.face+row.sign*1.55,y=col.floor(x,city.sidewalk.heightAt(x,z)+.5,z,0);assert(Number.isFinite(y),'sidewalk has continuous support');if(lastWalk!=null)assert(Math.abs(y-lastWalk)<.21,'rendered sidewalk risers stay walkable: '+grade+' '+row.block+' '+row.side+' '+x+' '+y+' after '+lastWalk);lastWalk=y;}
  // Sample the carriageway outside the curb, where it must remain a smooth plane.
  const z=row.face+row.sign*3.7;for(let x=row.x0+.3;x<row.x1;x+=.8){const y=city.ground(x,z),actual=col.floor(x,y+.25,z,0);assert(Math.abs(actual-y)<.015,'carriageway stays smooth beside stepped sidewalks');}
 }
 assert(city.parts.some(p=>p.role==='curb-cap'));assert(city.parts.some(p=>p.role==='corner-curb-ramp'));
}
console.log('PASS stepped sidewalks: level door landings, <=16 cm risers, curb ramps and smooth wagon roads at +/-18%');
