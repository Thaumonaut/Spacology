'use strict';
// Specimen gallery (?gallery=1): a flat exhibit field for checking props outside worldgen. The world must be flat,
// carry the ferrite outcrop (so the spawn survey still lands), stamp every species exhibit, resolve the forced
// landmarks through the same cell builders as the wild, and stay deterministic.
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js'),assert=require('node:assert/strict');
for(const cell of [.25,.125]){
  const w=M.createWorld(2718,cell,'infinite',{gallery:true});
  assert.equal(w.gallery,true,'gallery flag is exposed');
  assert.ok(w.dataId.includes(':gallery:'),'gallery world has its own cache identity');
  assert.equal(w.ground(0,0),w.ground(400,300),'gallery ground is flat');
  assert.ok(Math.abs(w.ground(0,0)-28)<1,'gallery ground sits at the exhibit height');
  assert.equal(w.contentTop(),140,'gallery bounds the stream to the exhibits');
  // The spawn outcrop: the survey found the exposed pad and the ore fill survives feature stamping.
  assert.ok(w.geography(w.deposit.x,w.deposit.z).exposed,'deposit sits on the exposed pad');
  assert.ok(w.column(Math.floor(w.deposit.x/cell),Math.floor(w.deposit.z/cell)).includes(M.MAT.ore),'ferrite vein is stamped');
  // Every species appears at young/mature/veteran size and stamps a trunk.
  const trees=w.gallerySpots.filter(s=>s.kind==='tree'),spot=l=>w.gallerySpots.find(s=>s.label===l);
  for(const tag of ['young','mature','veteran'])for(const sp of ['oak','birch','spruce','larch','redwood','palm'])
    assert.ok(trees.some(s=>s.label===`${sp} ${tag}`),`${sp} ${tag} exhibit is listed`);
  const spruce=spot('spruce veteran');
  const trunk=w.column(Math.floor(spruce.x/cell),Math.floor(spruce.z/cell));
  assert.ok(trunk.includes(M.MAT.bark)&&trunk.includes(M.MAT.needle),'spruce exhibit stamps trunk and needles');
  assert.ok(w.blockingAt(spruce.x,spruce.z,28,29),'trunk collision works in the gallery');
  // Landmarks resolve through the real cell builders.
  for(const s of w.gallerySpots.filter(s=>s.kind==='ruin')){
    const lm=w.landmarksAt(s.x,s.z);assert.ok(lm.ruin&&lm.ruin.kind===s.label.split(' ')[0],`${s.label} resolves`);
  }
  for(const s of w.gallerySpots.filter(s=>s.kind==='ancient')){
    const lm=w.landmarksAt(s.x,s.z);assert.ok(lm.ancient,`${s.label} resolves`);
    if(s.label==='giant sequoia')assert.equal(lm.ancient.variant,'sequoia','montane pad yields the sequoia variant');
  }
  const bf=spot('boulder field'),mu=spot('mushrooms'),pa=spot('palm mature');
  assert.ok(w.bouldersNear(bf.x,bf.z,50).length>0,'boulder field has boulders');
  assert.ok(w.mushroomsNear(mu.x,mu.z,12).length>0,'mushroom exhibit is queryable');
  assert.ok(w.palmsNear(pa.x,pa.z,20).length>0,'palm exhibit is queryable');
  // Deterministic: the whole exhibit list and the deposit regenerate identically.
  const again=M.createWorld(2718,cell,'infinite',{gallery:true});
  assert.deepEqual(w.gallerySpots,again.gallerySpots,'exhibit layout is deterministic');
  assert.deepEqual(w.deposit,again.deposit,'deposit is deterministic');
}
console.log('gallery: flat field, every species exhibit, forced landmarks, ore outcrop, deterministic layout');
