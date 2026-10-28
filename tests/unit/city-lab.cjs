'use strict';
const assert=require('node:assert/strict');
const C=require('../../prototypes/labs/city-lab/city-model.js'),P=require('../../prototypes/labs/building-lab/plan.js'),V=require('../../prototypes/labs/building-lab/voxels.js'),R=require('../../prototypes/labs/building-lab/renderer.js'),Review=require('../../prototypes/labs/building-lab/review.js'),G=require('../../prototypes/labs/city-lab/city-geometry.js'),M=V.M;
const near=(a,b)=>Math.abs(a-b)<1e-6;
for(const seed of [1,2,5,99])for(const layout of ['woven','grid'])for(const width of [.75,1,1.25]){
  const c=C.generate(seed,{layout,width}),uneven=C.generate(seed,{layout,width,terrain:'uneven'}),summaries={};
  assert.deepEqual(C.validate(c),[]);assert.deepEqual(C.validate(uneven),[]);
  assert.equal(c.parcels.length,24);assert.equal(new Set(c.edges.map(e=>e.width)).size,4);assert.equal(new Set(c.blocks.map(b=>b.district)).size,4);
  assert.deepEqual(c.nodes.map(n=>[n.x,n.z]),uneven.nodes.map(n=>[n.x,n.z]));
  assert.deepEqual(c.parcels.map(p=>[p.id,p.seed,p.polygon,p.options]),uneven.parcels.map(p=>[p.id,p.seed,p.polygon,p.options]));
  assert.equal(c.landmarks.gate.x,0);assert.equal(c.landmarks.castle.x,0);assert.equal((c.landmarks.gate.z+c.landmarks.castle.z)/2,0);
  for(const e of c.edges){assert.equal(e.width,C.ROAD[e.kind]*(e.kind==='alley'?1:width));assert.equal(e.footway,e.kind==='alley'?0:1);if(e.kind==='avenue'){assert.equal(c.nodes[e.a].x,0);assert.equal(c.nodes[e.b].x,0);}}
  if(layout==='woven'){const grid=C.generate(seed,{layout:'grid',width});assert.notDeepEqual(c.nodes.map(n=>[n.x,n.z]),grid.nodes.map(n=>[n.x,n.z]),'minor road intersections bend away from a grid');assert.ok(new Set(c.blocks.map(b=>b.polygon[1][0]-b.polygon[0][0])).size>=2,'variation in block widths');}
  assert.equal(c.edges.filter(e=>e.kind==='alley').length,c.blocks.length);
  for(const b of c.blocks){assert.ok(near(C.area(b.buildable),b.regions.reduce((s,r)=>s+C.area(r),0)+C.area(b.alleyPolygon)),'only actual alley area is deducted');const alley=c.edges[b.alley];for(const id of [alley.a,alley.b])assert.ok(c.edges.some(e=>e.kind!=='alley'&&(e.a===id||e.b===id)),'rear alley must meet a real street junction at each end');for(const p of c.parcels.filter(p=>p.block===b.id))assert.ok(!C.overlaps(p.polygon,b.alleyPolygon),'no parcel blocks rear access');}
  for(const parcel of c.parcels){
    const p=P.generate(parcel.seed,parcel.options),tag=seed+':'+layout+':'+width+':'+parcel.id;
    assert.equal(p.typology,'rowhouse');assert.ok(parcel.width>=7&&parcel.width<=7.5);
    assert.ok([3,4].includes(p.floors.length));assert.ok(p.floors.length*3/parcel.width>=1.2);
    assert.ok(p.plot.w*p.cell<=parcel.width&&(p.plot.d-p.plot.front)*p.cell<=parcel.depth);
    assert.ok(parcel.projection>0);assert.equal(p.plot.front*p.cell,parcel.projection);
    assert.ok(p.plot.masks[0].slice(0,p.plot.front*p.plot.w).every(v=>v===0),'upper projections do not inflate ground density');
    for(const mask of p.plot.masks.slice(1))assert.ok(mask.slice(0,p.plot.front*p.plot.w).some(Boolean),'projection is real occupied upper floor area');
    assert.ok(c.edges[parcel.road].width+2*c.footway-2*parcel.projection-1>=.25,'opposing projections/eaves retain an open gap');
    assert.ok(p.floors.every(f=>f.notes.length===0),tag);
    const bays=p.floors.slice(1).map(f=>f.openings.filter(o=>o.side==='zm'&&['window','small','bay'].includes(o.kind)).length);
    assert.ok(bays.every(n=>n>=2&&n<=3),tag+': real two/three-window frontage');
    for(const f of p.floors)for(const o of f.openings)for(const [x,z] of o.cells)assert.ok(!P.isPartyEdge(p.plot,x,z,o.side),tag+': no party-edge openings');
    for(const [side,flag] of parcel.options.party.entries())if(flag){
      const edgeX=side?parcel.width:0,A=C.point(parcel,edgeX,0),B=C.point(parcel,edgeX,parcel.depth);
      assert.ok(c.parcels.some(q=>q.id!==parcel.id&&[0,q.width].some(x=>{
        const a=C.point(q,x,0),b=C.point(q,x,q.depth);
        return Math.hypot(A[0]-a[0],A[1]-a[1])<1e-6&&Math.hypot(B[0]-b[0],B[1]-b[1])<1e-6;
      })),tag+': party flags need actual full-depth neighbours');
    }
    assert.ok(c.edges[parcel.road].width/parcel.width<.65,'ordinary frontage road is not a multi-wagon highway');
    summaries[parcel.id]={footprint:C.footprint(p)};
  }
  const d=C.density(c,summaries);assert.ok(d.pass,JSON.stringify(d));assert.ok(d.ratio<=1);assert.ok(d.footprint<c.parcels.reduce((s,p)=>s+p.width*p.depth,0)+1e-6);
  delete summaries[0];assert.equal(C.density(c,summaries).pass,false,'missing geometry cannot pass density');
  assert.equal(C.density(c,{}).footprint,0,'paving/pads do not count as buildings');
}
const large=C.generate(1,{count:100});assert.ok(large.parcels.length>=100);assert.deepEqual(C.validate(large),[]);
let fp=0;for(const p of large.parcels)fp+=C.footprint(P.generate(p.seed,p.options));assert.ok(fp/large.buildableArea>=large.densityTarget);
const c=C.generate(1),uneven=C.generate(1,{terrain:'uneven'});
for(const i of [0,8,12]){
  const parcel=c.parcels[i],p=P.generate(parcel.seed,parcel.options),b=V.build(p);
  assert.deepEqual(Review.review(p,b).findings.filter(f=>f.severity==='error'),[],i+': real furnished narrow plan remains usable');
  const full=R.meshSegment(b.vol,b.dims,0,b.dims[1]),proxy=V.build(p);G.cityVolume(p,proxy,true);
  const shell=R.meshSegment(proxy.vol,proxy.dims,0,proxy.dims[1]);assert.ok(shell.quads<full.quads*.8,'exterior proxy removes furnished/internal geometry');
  const box=G.bounds(shell,proxy);assert.ok(box.lo[0]>=-(parcel.options.party[0]?0:.25));assert.ok(box.hi[0]<=parcel.width+(parcel.options.party[1]?0:.25));
  assert.ok(box.lo[2]>=-parcel.envelope.front&&box.hi[2]<=parcel.depth+.25,'mesh retains road projections but cannot cover the rear alley');
  for(const [x,y,z] of [[0,0,0],[p.plot.w*p.cell,2,p.plot.d*p.cell]]){
    const a=[x+proxy.origin[0]*proxy.cell,y+proxy.origin[1]*proxy.cell,z+proxy.origin[2]*proxy.cell+proxy.cityFront],T=G.model(parcel,proxy);
    const world=[0,1,2].map(j=>a[0]*T[j]+a[1]*T[4+j]+a[2]*T[8+j]+T[12+j]),q=C.point(parcel,x,z);
    assert.ok(Math.hypot(world[0]-q[0],world[2]-q[1])<1e-4);assert.ok(Math.abs(world[1]-parcel.padY-y)<1e-4);
  }
  for(const size of [.5,1,2]){const lod=G.coarseMesh(p,parcel,c.extent,M,size),lodBox=G.planBounds(lod,parcel,c.extent);
    assert.ok(lod.quads<shell.quads/10,'coarse voxels are greedily meshed, not furnished microgeometry');
    assert.ok(lodBox.lo[2]<-parcel.projection+size,'distant voxels also show occupied upper street projections');
    assert.ok(lod.voxelBytes>0&&lod.voxelSize===size);}
}
const cityScale=C.generate(1,{count:1000});assert.ok(cityScale.parcels.length>=1000);assert.deepEqual(C.validate(cityScale),[]);
assert.ok(cityScale.extent>large.extent*2,'large selector grows the physical district, not only a label');
assert.equal(G.surface(c,0,10,M),M.cobble,'avenue owns its surface, not an overlapping terrain strip');
assert.equal(G.surface(c,0,0,M),M.floor_stone);
assert.ok(G.environment(uneven,M).quads>0,'graded roads, pads and foundations are generated');
assert.throws(()=>C.generate(1,{width:2}),/Unsupported/);assert.throws(()=>C.generate(1,{width:0}),/Unsupported/);
assert.throws(()=>P.generate(1,{parcel:{width:6,depth:17}}),/Parcel requires/);
assert.throws(()=>P.generate(1,{storeys:5}),/storeys/);assert.throws(()=>P.generate(1,{party:[true,1]}),/party/);
console.log('dense flat/uneven districts: real-mask 80%+ coverage, narrow/tall usable houses, truthful party walls, road scale, deterministic identity, voxel/envelope checks');
