'use strict';
const assert=require('node:assert/strict');
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const {createAtlas}=require('../../prototypes/labs/microvoxel-world/hex-atlas.js');
for(const extent of [128,256,'infinite']){
  const world=M.createWorld(2718,.25,extent),atlas=createAtlas(world),again=createAtlas(M.createWorld(2718,.25,extent));
  for(const [q,r] of [[0,0],[3,-2],[-4,7],[10,10]]){const c=atlas.center(q,r);assert.deepEqual(atlas.hexAt(c.x,c.z),{q,r});assert.deepEqual(atlas.hexAt(c.x+4,c.z-2),atlas.hexAt(c.x+4,c.z-2));assert.deepEqual(atlas.summary(q,r),again.summary(q,r),'summaries are deterministic from seed and coordinates');}
  const root=atlas.summary(atlas.rootHex.q,atlas.rootHex.r);assert.equal(root.resource,'Ferrite root');assert.ok(root.inside);
  const start=atlas.snapshot();assert.equal(start.surveyed,1);assert.equal(start.identified,1);assert.ok(start.frontier>0);
  assert.deepEqual(atlas.view('logistics').map(h=>h.state),['usable']);
  for(let i=0;i<20*90;i++)atlas.update(.05);
  const later=atlas.snapshot();assert.ok(later.surveyed>start.surveyed,'explorer surveys frontier hexes');
  for(const a of atlas.crew)assert.equal(a.y,world.ground(a.x,a.z),'crew stand on exact voxel ground');
  for(const h of atlas.view('explore'))assert.ok(h.inside,'frontier never leaves the surveyable world');
  if(!world.infinite)for(const a of atlas.crew)assert.ok(a.x>0&&a.z>0&&a.x<world.extent&&a.z<world.extent);
  const far=atlas.frontier()[0];assert.match(atlas.assign(far.q,far.r),/Explorer assigned/);assert.equal(atlas.crew[0].task.source,'player');assert.equal(atlas.crew[0].task.key,far.key);
  const unknown=atlas.hexAt(atlas.center(far.q,far.r).x,atlas.center(far.q,far.r).z);assert.equal(atlas.known(unknown.q,unknown.r)?.surveyed??false,false,'assigning does not reveal the hex');
  for(let i=0;i<20*120&&!atlas.known(far.q,far.r)?.surveyed;i++)atlas.update(.05);assert.ok(atlas.known(far.q,far.r).surveyed,'player survey task completes');
  for(let i=0;i<20*400&&atlas.snapshot().identified<2;i++)atlas.update(.05);
  const research=atlas.view('research');assert.ok(research.length>1,'surveys reveal resource signs for Research');
  assert.ok(atlas.snapshot().identified>=2,'researcher samples a lead, carries it to camp and identifies it for Logistics');
  assert.ok(atlas.view('logistics').filter(h=>h.state==='usable').length>=2);
}
console.log('PASS hex atlas: deterministic summaries, survey frontier, player tasks, sample-to-identification flow and bounded crew');
