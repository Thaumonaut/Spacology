'use strict';
// Crown reach vs the stamp scan: column() stamps trees only from the neighbourhood of the column's own 3 m cell
// (+-4 after the crowns widened; +-2 before), so foliage whose lobe edge lands outside that neighbourhood silently
// vanishes — clipped wedges at cell boundaries. Replays the round-crown lobe layout (same hash rolls as
// stampPlant) to find guaranteed-foliage points out of the old scan range, and asserts they stamp leaf.
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js'),assert=require('node:assert/strict');
const w=M.createWorld(2718,.25,'infinite'),TG=3;
const SCAN=4,OLD_SCAN=2;
const hash=M.hash,seed=w.seed;
// Round-crown lobe layout, replayed from stampPlant: stem-tip lobes, a mid-height ring, and low skirt lobes.
function lobes(t){
  const R=t.radius,tidX=Math.floor(t.x*4),tidZ=Math.floor(t.z*4);
  const forkY=t.base+Math.round(t.height*(.5+.12*hash(tidX,tidZ,seed+167))),top=t.base+t.height;
  const a0=hash(tidX,tidZ,seed+173)*6.2832,nS=2+Math.floor(hash(tidZ,tidX,seed+169)*2),out=[],stems=[];
  for(let i=0;i<nS;i++){
    const a=a0+i*6.2832/nS+(hash(i,tidX,seed+175)-.5)*.8,o=R*(i===0?.05+.15*hash(0,tidZ,seed+177):.25+.4*hash(i,tidZ,seed+177));
    stems.push({x:t.x+Math.cos(a)*o*w.cell,z:t.z+Math.sin(a)*o*w.cell});
    out.push({x:stems[i].x,z:stems[i].z,y:top-Math.round(R*(.02+.3*hash(i,tidX*3,seed+179)))+Math.round(.5),r:Math.max(2,Math.round(R*(.5+.2*hash(i,tidZ*5+tidX,seed+181))))});
  }
  const nL=4+Math.floor(hash(tidX,tidZ,seed+171)*3);
  for(let i=0;i<nL;i++){
    const a=a0+(i+.5)*6.2832/nL+(hash(i,tidX+tidZ,seed+183)-.5)*.9,o=R*(.45+.4*hash(i,tidX,seed+185));
    out.push({x:t.x+Math.cos(a)*o*w.cell,z:t.z+Math.sin(a)*o*w.cell,y:Math.round(forkY+(top-forkY)*(.3+.6*hash(i,tidZ,seed+187))),r:Math.max(2,Math.round(R*(.38+.25*hash(i,tidX*3+tidZ,seed+189))))});
  }
  const nSkirt=1+Math.floor(hash(tidX,tidZ,seed+193)*2);
  for(let i=0;i<nSkirt;i++){
    const a=a0+hash(i,tidZ,seed+195)*6.2832,o=R*(.15+.35*hash(i,tidX,seed+197));
    out.push({x:t.x+Math.cos(a)*o*w.cell,z:t.z+Math.sin(a)*o*w.cell,y:Math.round(forkY+(top-forkY)*(.1+.2*hash(i,tidZ,seed+199))),r:Math.max(2,Math.round(R*(.3+.2*hash(i,tidX*7+tidZ,seed+201))))});
  }
  return out;
}
let checked=0;
for(let gz=-400;gz<=400;gz++)for(let gx=-400;gx<=400;gx++){
  const t=w.tree(gx,gz);if(!t||t.crown!=='round'||t.cls<1)continue;
  const tc={x:Math.floor(t.x/TG),z:Math.floor(t.z/TG)};
  for(const l of lobes(t)){
    // The far edge of a wide lobe: a point at 60% of the lobe radius away from the trunk is comfortably inside the
    // dome (the noisy rim shrinks r by at most 15%), so this column holds leaf wherever it is scanned.
    const dx=l.x-t.x,dz=l.z-t.z,o=Math.hypot(dx,dz)||1,px=l.x+dx/o*l.r*.6*w.cell,pz=l.z+dz/o*l.r*.6*w.cell;
    const cc={x:Math.floor(px/TG),z:Math.floor(pz/TG)};
    if(Math.abs(cc.x-tc.x)<=OLD_SCAN&&Math.abs(cc.z-tc.z)<=OLD_SCAN)continue;
    // A neighbouring tree could stamp leaf here and mask a miss: only check columns no other scanned tree reaches.
    let masked=false;
    for(let j=-SCAN;j<=SCAN&&!masked;j++)for(let i=-SCAN;i<=SCAN&&!masked;i++){
      const ot=w.tree(cc.x+i,cc.z+j);
      if(ot&&ot!==t&&ot.radius&&Math.hypot(ot.x-px,ot.z-pz)<ot.radius*w.cell*1.7+1)masked=true;
    }
    if(masked)continue;
    checked++;
    const hh=Math.sqrt(Math.max(1,(l.r*.85)**2-(l.r*.6)**2)),col=w.column(Math.floor(px/w.cell),Math.floor(pz/w.cell));
    assert.ok(col.slice(Math.floor(l.y-hh*.8),Math.ceil(l.y+hh*.6)).includes(t.leaf),
      `foliage ${Math.hypot(px-t.x,pz-t.z).toFixed(1)} m out on a ${t.species} lobe lands outside the +-${SCAN}-cell stamp scan`);
  }
}
assert.ok(checked>0,'found at least one out-of-scan lobe edge to verify');
console.log(`PASS crown reach: ${checked} out-of-scan lobe edges all stamp leaf`);
