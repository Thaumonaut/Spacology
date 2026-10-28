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
  // Regression: pads host only their own exhibit family — no stray ruin/rock/ancient lands on another pad's
  // exhibit, and boulders stay inside the boulder field instead of carpeting every open pad.
  const found=new Map();
  for(let z=-500;z<=700;z+=8)for(let x=-500;x<=1300;x+=8){
    const lm=w.landmarksAt(x,z);
    for(const kind of ['ancient','ruin','rock'])if(lm[kind])found.set(`${kind}@${Math.round(lm[kind].x)},${Math.round(lm[kind].z)}`,{kind,x:lm[kind].x,z:lm[kind].z});
  }
  for(const f of found.values()){
    const near=w.gallerySpots.some(s=>s.kind===f.kind&&Math.hypot(s.x-f.x,s.z-f.z)<8);
    assert.ok(near,`stray ${f.kind} at ${f.x.toFixed(0)},${f.z.toFixed(0)} has no matching exhibit`);
  }
  for(const s of w.gallerySpots)if(s.kind!=='boulders')
    assert.equal(w.bouldersNear(s.x,s.z,8).length,0,`no boulder carpet near ${s.label}`);
  // Regression: the spire pad's cell must satisfy the real spireCell gate (p<.02 on relief-20 ground), so the
  // 'crystal spires' spot always produces crystal voxels.
  const sp=spot('crystal spires');let crystal=0;
  for(let z=-15;z<=15;z++)for(let x=-15;x<=15;x++)
    if(w.column(Math.floor((sp.x+x)/cell),Math.floor((sp.z+z)/cell)).includes(M.MAT.crystal))crystal++;
  assert.ok(crystal>0,'crystal spires exhibit stamps crystal');
  // Regression: the whole 1.15 m ore disc lands on exposed pad ground, so every disc column carries ore.
  let exposedCols=0,oreCols=0;
  for(let z=-6;z<=6;z++)for(let x=-6;x<=6;x++){
    const cx=Math.floor((w.deposit.x+x*cell)/cell),cz=Math.floor((w.deposit.z+z*cell)/cell);
    if(Math.hypot((cx+.5)*cell-w.deposit.x,(cz+.5)*cell-w.deposit.z)>=1.15)continue;
    if(w.geography((cx+.5)*cell,(cz+.5)*cell).exposed)exposedCols++;
    if(w.column(cx,cz).includes(M.MAT.ore))oreCols++;
  }
  assert.ok(exposedCols>0,'ore disc has exposed columns');
  assert.equal(oreCols,exposedCols,'every exposed disc column carries ferrite ore');
  assert.ok(exposedCols>=60,'the full ore disc is exposed, not clipped at the pad edge');
  // Deterministic: the whole exhibit list and the deposit regenerate identically.
  const again=M.createWorld(2718,cell,'infinite',{gallery:true});
  assert.deepEqual(w.gallerySpots,again.gallerySpots,'exhibit layout is deterministic');
  assert.deepEqual(w.deposit,again.deposit,'deposit is deterministic');
}
// The spire pad must produce crystal on arbitrary seeds (the scan mirrors the real gate, not a looser roll).
for(const seed of [1,7,999]){
  const w=M.createWorld(seed,.25,'infinite',{gallery:true});
  const sp=w.gallerySpots.find(s=>s.label==='crystal spires');
  assert.ok(sp,`seed ${seed}: crystal spires exhibit is placed`);
  let crystal=0;
  for(let z=-15;z<=15;z++)for(let x=-15;x<=15;x++)
    if(w.column(Math.floor((sp.x+x)/.25),Math.floor((sp.z+z)/.25)).includes(M.MAT.crystal))crystal++;
  assert.ok(crystal>0,`seed ${seed}: crystal spires exhibit stamps crystal`);
  // Every landmark on the field belongs to a declared exhibit of the same kind on these seeds too.
  for(let z=-300;z<=400;z+=10)for(let x=-300;x<=1000;x+=10){
    const lm=w.landmarksAt(x,z);
    for(const kind of ['ancient','ruin','rock'])if(lm[kind]){
      const near=w.gallerySpots.some(s=>s.kind===kind&&Math.hypot(s.x-lm[kind].x,s.z-lm[kind].z)<8);
      assert.ok(near,`seed ${seed}: stray ${kind} at ${lm[kind].x.toFixed(0)},${lm[kind].z.toFixed(0)}`);
    }
  }
}
// Every advertised exhibit actually exists: pads declare cells, so an overlapping pad of another kind cannot
// suppress a spot, and the spire/ancient placement always resolves. Seeds chosen to cover the failure shapes:
// 51 boulder pad inside a ruin pad; 120 spire inside a ruin pad; 85 rocks inside a ruin pad; 67 sequoia inside a
// ruin pad; 71/205 no legal spire cell near the scan target.
for(const seed of [1,7,51,67,71,85,120,205,999]){
  const w=M.createWorld(seed,.25,'infinite',{gallery:true});
  for(const s of w.gallerySpots){
    if(s.kind==='ruin')assert.ok(w.landmarksAt(s.x,s.z).ruin,`seed ${seed}: ${s.label} resolves`);
    if(s.kind==='rock')assert.ok(w.landmarksAt(s.x,s.z).rock,`seed ${seed}: ${s.label} resolves`);
    if(s.kind==='ancient'){
      const a=w.landmarksAt(s.x,s.z).ancient;
      assert.ok(a,`seed ${seed}: ${s.label} resolves`);
      if(s.label==='giant sequoia')assert.equal(a.variant,'sequoia',`seed ${seed}: montane pad yields the sequoia variant`);
    }
    if(s.kind==='boulders')assert.ok(w.bouldersNear(s.x,s.z,50).length>0,`seed ${seed}: boulder field has boulders`);
    if(s.kind==='spire'){
      let crystal=0;
      for(let z=-15;z<=15;z++)for(let x=-15;x<=15;x++)
        if(w.column(Math.floor((s.x+x)/.25),Math.floor((s.z+z)/.25)).includes(M.MAT.crystal))crystal++;
      assert.ok(crystal>0,`seed ${seed}: crystal spires exhibit stamps crystal`);
    }
  }
}
console.log('gallery: flat field, every species exhibit, forced landmarks, ore outcrop, deterministic layout');
