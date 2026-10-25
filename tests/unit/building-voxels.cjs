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
const CASES=[];for(const [type,T] of Object.entries(P.TYPES))for(const typology of Object.keys(T.typologies)){for(let s=1;s<60;s++){const p=P.makePlot(s,{type,context:'corner'}),Y=P.TYPOLOGIES[typology];if(p.w>=Y.minW&&!(Y.straight&&p.storeys>2)){CASES.push([s,type,typology]);break;}}}
for(const [seed,type,typology] of CASES){
  const plan=P.generate(seed,{type,typology,context:'corner'}),b=V.build(plan),[X,Y,Z]=b.dims,{vol}=b,at=(x,y,z)=>x<0||y<0||z<0||x>=X||y>=Y||z>=Z?0:vol[x+X*(z+Z*y)];
  const [MX,,MZ]=b.origin,cx=x=>MX+x*V.CV,cz=z=>MZ+z*V.CV;built++;
  plan.floors.forEach((F,f)=>{const y=b.levels[f];
    // Doors: the middle of every door is open from floor to head height, across the wall.
    for(const dr of F.doors){const [x,z]=dr.cells[0],mid={xp:[cx(x)+8,cz(z)+8],zp:[cx(x)+8,cz(z)+8],xm:[cx(x),cz(z)+8],zm:[cx(x)+8,cz(z)]}[dr.dir];
      for(let yy=y+1;yy<y+30;yy++)assert.equal(at(mid[0],yy,mid[1]),0,`${type} ${seed} floor ${f}: door ${F.rooms[dr.a].type}-${F.rooms[dr.b].type} blocked at +${yy-y}`);doorsChecked++;}
    // Windows: glazing (glass or shoji paper) inside the opening.
    for(const o of F.openings){if(o.kind!=='window')continue;const [x,z]=o.cells[0],glass=new Set([b.M.glass,b.M.shoji,b.M.timber_dark]);let found=false;
      for(let a=0;a<16&&!found;a++)for(let t=0;t<9&&!found;t++){const [px,pz]=o.side[0]==='x'?[o.side==='xm'?cx(x)+t-2:cx(x)+t,cz(z)+a]:[cx(x)+a,o.side==='zm'?cz(z)+t-2:cz(z)+t];
        if(glass.has(at(px,y+24,pz))&&at(px,y+24,pz)!==b.M.timber_dark)found=true;}
      assert.ok(found,`${type} ${seed} floor ${f}: window on ${o.side} is glazed`);}});
  // Roofs: every footprint cell with nothing built above it is covered above its own storey.
  plan.plot.masks.forEach((m,L)=>{for(let z=0;z<plan.plot.d;z++)for(let x=0;x<plan.plot.w;x++){const i=x+plan.plot.w*z;if(!m[i]||(L<plan.plot.masks.length-1&&plan.plot.masks[L+1][i]))continue;
    let covered=false;for(let yy=b.levels[L+1];yy<Y&&!covered;yy++)if(at(cx(x)+4,yy,cz(z)+4))covered=true;assert.ok(covered,`${type} ${seed}: roof covers level ${L} cell ${x},${z}`);}});
  // Stairs: each flight climbs one riser per tread and ends where its risers say (a full storey over the whole stair).
  for(const fl of plan.stair.flights){const y0=b.levels[fl.from],[x0,z0,x1,z1]=fl.rect,X0=cx(x0),X1=cx(x1),Z0=cz(z0),Z1=cz(z1),along=fl.dir[0]==='z'?Z1-Z0:X1-X0,t=along/fl.risers,base=y0+fl.start*3;let last=base;
    for(let k=0;k<fl.risers;k++){const a=Math.floor((k+.5)*t),[px,pz]=fl.dir==='zp'?[(X0+X1)>>1,Z0+a]:fl.dir==='zm'?[(X0+X1)>>1,Z1-1-a]:fl.dir==='xp'?[X0+a,(Z0+Z1)>>1]:[X1-1-a,(Z0+Z1)>>1];
      let h=base;while(at(px,h,pz))h++;assert.ok(h>last,`${type}/${typology} ${seed}: flight ${fl.dir} ${fl.risers} step ${k} climbs (${h-base} after ${last-base})`);last=h;}
    assert.equal(last,y0+(fl.start+fl.risers)*3,`${type} ${seed}: the flight ends at its height`);}
  assert.equal(Math.max(...plan.stair.flights.filter(fl=>fl.from===0).map(fl=>(fl.start+fl.risers)*3)),V.SH,'the ground-floor stair reaches the next floor');
  // Furniture: placed on a floor, inside its room's cells, and every furnished room keeps its doors connected.
  for(const it of b.info.furniture){pieces++;const gx=Math.floor((it.x+it.w/2-MX)/V.CV),gz=Math.floor((it.z+it.d/2-MZ)/V.CV);
    assert.equal(plan.floors[it.floor].grid[gx+plan.plot.w*gz],it.room,`${it.piece} sits in its own room`);assert.ok(it.y>=b.levels[it.floor],'on or above the floor');}
  for(const r of b.info.rooms)assert.ok(r.reachable,`${type} ${seed}: ${r.type} on floor ${r.floor} is still walkable`);
  const real=b.info.rooms.filter(r=>!['hall','stair'].includes(r.type)),furnished=real.filter(r=>r.pieces>0).length;assert.ok(furnished>=real.length*.8,`${type}/${typology} ${seed}: most rooms are furnished (${furnished}/${real.length})`);
  // Deterministic.
  if(CASES.indexOf(CASES.find(c=>c[0]===seed&&c[1]===type&&c[2]===typology))<2){const again=V.build(P.generate(seed,{type,typology,context:'corner'}));assert.ok(Buffer.from(again.vol).equals(Buffer.from(vol)),'same plan, same voxels');}
}
// Greedy mesher: a closed box meshes to exactly 6 quads; a segment boundary caps the cut.
{const dims=[6,6,6],vol=new Uint8Array(216);for(let y=1;y<5;y++)for(let z=1;z<5;z++)for(let x=1;x<5;x++)vol[x+6*(z+6*y)]=3;
  assert.equal(R.meshSegment(vol,dims,0,6).quads,6);assert.equal(R.meshSegment(vol,dims,0,3).quads,6,'a cut segment is closed on its own');}
console.log(`PASS building voxels: ${Object.keys(KIT.pieces).length} kit pieces, ${built} buildings, ${doorsChecked} doors open, roofs closed, stairs climb, ${pieces} pieces in walkable rooms`);
