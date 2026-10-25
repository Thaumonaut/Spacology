'use strict';
// Building voxels: the shell matches the plan. Doors are walkable openings, windows are glazed, the roof covers the
// top floor, stairs climb storey to storey, kit pieces sit on floors without cutting walls, and every furnished room
// still lets its doors reach each other. Also checks the voxelised KayKit kit and the greedy mesher.
const assert=require('node:assert/strict');
const P=require('../../prototypes/labs/building-lab/plan.js'),V=require('../../prototypes/labs/building-lab/voxels.js'),KIT=require('../../prototypes/labs/building-lab/kit-pieces.js');
const R=require('../../prototypes/labs/building-lab/renderer.js');

// Kit: every piece decodes to its stated size, uses only kit palette slots and has a real-world scale.
for(const [id,p] of Object.entries(KIT.pieces)){const piece=V.piece(id),[X,Y,Z]=p.dims;assert.equal(piece.v.length,X*Y*Z);
  let solid=0;for(const v of piece.v){if(v){solid++;assert.ok(v>=KIT.first&&v<KIT.first+KIT.palette.length,`${id}: colour ${v} outside the kit palette`);}}
  assert.ok(solid>0,`${id} is not empty`);assert.ok(p.metres.every(m=>m>0&&m<2.2),`${id} is furniture-sized`);}
assert.equal(KIT.cell,V.V,'kit and building share the 6.25 cm cell');

let built=0,doorsChecked=0,pieces=0;
for(const [seed,type] of [[1,'shophouse'],[2,'home'],[3,'inn'],[4,'workshop'],[5,'home'],[6,'inn'],[9,'shophouse']]){
  const plan=P.generate(seed,{type}),b=V.build(plan),[X,Y,Z]=b.dims,{vol}=b,at=(x,y,z)=>x<0||y<0||z<0||x>=X||y>=Y||z>=Z?0:vol[x+X*(z+Z*y)];
  const [MX,,MZ]=b.origin,cx=x=>MX+x*V.CV,cz=z=>MZ+z*V.CV;built++;
  plan.floors.forEach((F,f)=>{const y=b.levels[f];
    // Doors: the middle of every door is open from floor to head height, across the wall.
    for(const dr of F.doors){const [x,z]=dr.cells[0],mid=dr.dir==='xp'?[cx(x)+8,cz(z)+8]:[cx(x)+8,cz(z)+8];
      for(let yy=y+1;yy<y+30;yy++)assert.equal(at(mid[0],yy,mid[1]),0,`${type} ${seed} floor ${f}: door ${F.rooms[dr.a].type}-${F.rooms[dr.b].type} blocked at +${yy-y}`);doorsChecked++;}
    // Windows: glazing (glass or shoji paper) inside the opening.
    for(const o of F.openings){if(o.kind!=='window')continue;const [x,z]=o.cells[0],glass=new Set([b.M.glass,b.M.shoji,b.M.timber_dark]);let found=false;
      for(let a=0;a<16&&!found;a++)for(let t=0;t<9&&!found;t++){const [px,pz]=o.side[0]==='x'?[o.side==='xm'?cx(x)+t-2:cx(x)+t,cz(z)+a]:[cx(x)+a,o.side==='zm'?cz(z)+t-2:cz(z)+t];
        if(glass.has(at(px,y+24,pz))&&at(px,y+24,pz)!==b.M.timber_dark)found=true;}
      assert.ok(found,`${type} ${seed} floor ${f}: window on ${o.side} is glazed`);}});
  // Roof: every top-floor cell is covered by solid voxels above the wall plate.
  const top=plan.floors.length-1;for(let z=0;z<plan.plot.d;z++)for(let x=0;x<plan.plot.w;x++){if(!plan.plot.masks[top][x+plan.plot.w*z])continue;
    let covered=false;for(let yy=b.plate;yy<Y&&!covered;yy++)if(at(cx(x)+4,yy,cz(z)+4))covered=true;assert.ok(covered,`${type} ${seed}: roof covers cell ${x},${z}`);}
  // Stairs: each run rises a full storey in 16 steps.
  for(const run of plan.stair.runs){const y0=b.levels[run.from];let last=y0;
    for(let k=0;k<16;k++){const zz=run.dir>0?cz(run.z)+k*3+1:cz(run.z)+48-k*3-2;let h=y0;while(at(cx(run.x)+8,h,zz))h++;assert.ok(h>last,`${type} ${seed}: step ${k} climbs`);last=h;}
    assert.equal(last,b.levels[run.from+1],`${type} ${seed}: the flight lands on the next floor`);}
  // Furniture: placed on a floor, inside its room's cells, and every furnished room keeps its doors connected.
  for(const it of b.info.furniture){pieces++;const gx=Math.floor((it.x+it.w/2-MX)/V.CV),gz=Math.floor((it.z+it.d/2-MZ)/V.CV);
    assert.equal(plan.floors[it.floor].grid[gx+plan.plot.w*gz],it.room,`${it.piece} sits in its own room`);assert.ok(it.y>=b.levels[it.floor],'on or above the floor');}
  for(const r of b.info.rooms)assert.ok(r.reachable,`${type} ${seed}: ${r.type} on floor ${r.floor} is still walkable`);
  const furnished=b.info.rooms.filter(r=>r.pieces>0).length;assert.ok(furnished>=plan.floors.reduce((a,F)=>a+F.rooms.length,0)*.6,`${type} ${seed}: most rooms are furnished`);
  // Deterministic.
  if(seed<3){const again=V.build(P.generate(seed,{type}));assert.ok(Buffer.from(again.vol).equals(Buffer.from(vol)),'same plan, same voxels');}
}
// Greedy mesher: a closed box meshes to exactly 6 quads; a segment boundary caps the cut.
{const dims=[6,6,6],vol=new Uint8Array(216);for(let y=1;y<5;y++)for(let z=1;z<5;z++)for(let x=1;x<5;x++)vol[x+6*(z+6*y)]=3;
  assert.equal(R.meshSegment(vol,dims,0,6).quads,6);assert.equal(R.meshSegment(vol,dims,0,3).quads,6,'a cut segment is closed on its own');}
console.log(`PASS building voxels: ${Object.keys(KIT.pieces).length} kit pieces, ${built} buildings, ${doorsChecked} doors open, roofs closed, stairs climb, ${pieces} pieces in walkable rooms`);
