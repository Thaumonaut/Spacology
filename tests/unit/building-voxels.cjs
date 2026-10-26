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
// Forced looks so every massing feature is built and checked: gambrel + cross gable + oriels + turret, half-hip +
// dormers, and a spire hip with a turret.
const FORCED=[[3,'home','centre',{style:'fairytale',context:'detached',look:{roof:{form:'gambrel',ridge:'frontage',cross:{x0:7,x1:13,depth:7},dormers:0,turret:{side:'xp',r:14,rise:28}},facade:{oriels:2,window:'arched',frame:'cross'}}}],
  [3,'home','centre',{style:'harbour',context:'detached',look:{roof:{form:'halfhip',ridge:'frontage',cross:null,dormers:3,turret:null},facade:{window:'tall',glazing:'grid',shutters:true,shutter:'paint_green'}}}],
  [3,'home','cross',{style:'spire',context:'detached',look:{roof:{form:'hip',turret:{side:'xm',r:13,rise:24}},facade:{oriels:1,window:'paired'}}}],
  // every stair kind, inside and in a tower
  [1,'home','side',{context:'detached',stair:{kind:'straightLanding'}}],[3,'home','stairhall',{context:'detached',stair:{kind:'spiral'}}],[3,'home','stairhall',{context:'detached',stair:{kind:'u3'}}],
  [1,'home','centre',{context:'detached',stair:{kind:'L',tower:true}}],[1,'home','side',{context:'detached',stair:{kind:'spiral',tower:true}}],[3,'home','stairhall',{context:'detached',stair:{kind:'dogleg',tower:true}}],
  [1,'inn','courtyard',{context:'detached',stair:{kind:'spiral'}}],[1,'shophouse','centre',{context:'detached'}],[1,'shophouse','stairhall',{context:'detached'}]];
for(const [seed,type,typology,extra] of [...CASES.map(c=>[...c,{context:'corner'}]),...FORCED]){
  const plan=P.generate(seed,{type,typology,...extra}),b=V.build(plan),[X,Y,Z]=b.dims,{vol}=b,at=(x,y,z)=>x<0||y<0||z<0||x>=X||y>=Y||z>=Z?0:vol[x+X*(z+Z*y)];
  const [MX,,MZ]=b.origin,cx=x=>MX+x*V.CV,cz=z=>MZ+z*V.CV;built++;
  plan.floors.forEach((F,f)=>{const y=b.levels[f];
    // Doors: the middle of every door is open from floor to head height, across the wall.
    for(const dr of F.doors){const [x,z]=dr.cells[0],mid={xp:[cx(x)+8,cz(z)+8],zp:[cx(x)+8,cz(z)+8],xm:[cx(x),cz(z)+8],zm:[cx(x)+8,cz(z)]}[dr.dir];
      for(let yy=y+1;yy<y+30;yy++)assert.equal(at(mid[0],yy,mid[1]),0,`${type} ${seed} floor ${f}: door ${F.rooms[dr.a].type}-${F.rooms[dr.b].type} blocked at +${yy-y}`);doorsChecked++;}
    // Windows: glazing (glass or shoji paper) inside the opening.
    for(const o of F.openings){if(o.kind!=='window')continue;const [x,z]=o.cells[0],glass=new Set([b.M.glass,b.M.shoji,b.M.timber_dark]);let found=false;
      for(let a=0;a<16&&!found;a++)for(let t=-8;t<9&&!found;t++){const [px,pz]=o.side[0]==='x'?[o.side==='xm'?cx(x)+t-2:cx(x)+t,cz(z)+a]:[cx(x)+a,o.side==='zm'?cz(z)+t-2:cz(z)+t];
        if(glass.has(at(px,y+24,pz))&&at(px,y+24,pz)!==b.M.timber_dark)found=true;}
      assert.ok(found,`${type} ${seed} floor ${f}: window on ${o.side} is glazed`);}});
  // Stairwells: open (railed) only onto circulation; a bedroom, bath or store beside one keeps a full wall.
  plan.floors.forEach((F,f)=>{if(!f)return;const voids=new Set(F.voids),y=b.levels[f];
    for(const i of voids){const x=i%plan.plot.w,z=Math.floor(i/plan.plot.w);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,j=nx+plan.plot.w*nz;
      if(nx<0||nz<0||nx>=plan.plot.w||nz>=plan.plot.d||voids.has(j)||F.grid[j]<1||P.ROOMS[F.rooms[F.grid[j]].type].circ)continue;
      const px=dx>0?cx(nx):dx<0?cx(x)-1:cx(x)+4,pz=dz>0?cz(nz):dz<0?cz(z)-1:cz(z)+4;
      assert.ok(at(px,y+20,pz),`${type}/${typology} ${seed} floor ${f}: the ${F.rooms[F.grid[j]].type} beside the stairwell has a full wall`);}}});
  // Massing: a turret has its ring wall, its cone above the eaves and an open alcove into the corner room; dormers
  // carry a glazed window on the roof; oriels project glass out from the wall.
  if(plan.roof.turret){const T=plan.roof.turret,cxT=T.side==='xm'?MX-T.r*.35:MX+plan.plot.w*V.CV+T.r*.35,czT=cz(plan.plot.front)-T.r*.35,yw=b.levels[1]+20;
    assert.ok(at(Math.round(cxT),yw,Math.round(czT-(T.r-1.5))),'the turret ring wall stands'); // probed on the street side, between its windows
    let cone=0;for(let y=b.plate+T.rise;y<Y;y++)if(at(Math.round(cxT),y,Math.round(czT)))cone=y;assert.ok(cone>b.plate+T.rise+T.r,'the turret cone rises above its walls');
    const ix=Math.round(cxT+(T.side==='xm'?1:-1)*T.r*.5),iz=Math.round(czT+T.r*.5);assert.equal(at(ix,b.levels[1]+12,iz),0,'the turret opens into the corner room');}
  if(plan.roof.dormers){let glass=0;for(let z=0;z<Z;z++)for(let x=0;x<X;x++)for(let y=b.plate;y<Y;y++){const m=vol[x+X*(z+Z*y)];if(m===b.M.glass||m===b.M.shoji)glass++;}assert.ok(glass>=plan.roof.dormers*20,'dormer windows are glazed');}
  if(plan.facade.oriels){let out=0;const zf=cz(plan.plot.front);for(let x=0;x<X;x++)for(let y=b.levels[1];y<b.levels[2];y++)for(let z=zf-8;z<zf-2;z++){const m=at(x,y,z);if(m===b.M.glass||m===b.M.shoji)out++;}assert.ok(out>=40,'oriel glass projects from the facade');}
  // Roofs: every footprint cell with nothing built above it is covered above its own storey.
  plan.plot.masks.forEach((m,L)=>{for(let z=0;z<plan.plot.d;z++)for(let x=0;x<plan.plot.w;x++){const i=x+plan.plot.w*z;if(!m[i]||(L<plan.plot.masks.length-1&&plan.plot.masks[L+1][i]))continue;
    let covered=false;for(let yy=b.levels[L+1];yy<Y&&!covered;yy++)if(at(cx(x)+4,yy,cz(z)+4))covered=true;assert.ok(covered,`${type} ${seed}: roof covers level ${L} cell ${x},${z}`);}});
  // Stairs: each flight climbs one riser per tread and ends where its risers say (a full storey over the whole stair).
  for(const fl of plan.stair.flights){const y0=b.levels[fl.from],[x0,z0,x1,z1]=fl.rect,X0=cx(x0),X1=cx(x1),Z0=cz(z0),Z1=cz(z1),along=fl.dir[0]==='z'?Z1-Z0:X1-X0,t=along/fl.risers,base=y0+fl.start*3;let last=base;
    for(let k=0;k<fl.risers;k++){const a=Math.floor((k+.5)*t),[px,pz]=fl.dir==='zp'?[(X0+X1)>>1,Z0+a]:fl.dir==='zm'?[(X0+X1)>>1,Z1-1-a]:fl.dir==='xp'?[X0+a,(Z0+Z1)>>1]:[X1-1-a,(Z0+Z1)>>1];
      let h=base;while(at(px,h,pz))h++;assert.ok(h>last,`${type}/${typology} ${seed}: flight ${fl.dir} ${fl.risers} step ${k} climbs (${h-base} after ${last-base})`);last=h;}
    assert.equal(last,y0+(fl.start+fl.risers)*3,`${type} ${seed}: the flight ends at its height`);}
  // Spirals: walking round from the entry, each tread is higher than the last and the last reaches the next floor.
  for(const sp of plan.stair.spirals||[]){const y0=b.levels[sp.from],cxs=MX+sp.centre[0]*V.CV,czs=MZ+sp.centre[1]*V.CV,rr=sp.r*V.CV*.7,step=sp.sweep/sp.risers;let last=y0;
    for(let k=0;k<sp.risers;k++){const a=sp.a0-(k+.5)*step,px=Math.floor(cxs+Math.cos(a)*rr),pz=Math.floor(czs+Math.sin(a)*rr);let h=y0;for(let yy=y0;yy<y0+V.SH;yy++)if(at(px,yy,pz))h=yy+1;assert.ok(h>last,`${type}/${typology} ${seed}: spiral tread ${k} climbs (${h-y0})`);last=h;}
    assert.equal(last,y0+V.SH,`${type}/${typology} ${seed}: the spiral lands on the next floor`);}
  const climbs=[...plan.stair.flights.filter(fl=>fl.from===0).map(fl=>(fl.start+fl.risers)*3),...(plan.stair.spirals||[]).filter(sp=>sp.from===0).map(sp=>sp.risers*3)];
  assert.equal(Math.max(...climbs),V.SH,'the ground-floor stair reaches the next floor');
  // Furniture: placed on a floor, inside its room's cells, and every furnished room keeps its doors connected.
  for(const it of b.info.furniture){pieces++;const gx=Math.floor((it.x+it.w/2-MX)/V.CV),gz=Math.floor((it.z+it.d/2-MZ)/V.CV);
    assert.equal(plan.floors[it.floor].grid[gx+plan.plot.w*gz],it.room,`${it.piece} sits in its own room`);assert.ok(it.y>=b.levels[it.floor],'on or above the floor');}
  for(const r of b.info.rooms)assert.ok(r.reachable,`${type} ${seed}: ${r.type} on floor ${r.floor} is still walkable`);
  const real=b.info.rooms.filter(r=>!['hall','stair'].includes(r.type)),furnished=real.filter(r=>r.pieces>0).length;assert.ok(furnished>=real.length*.8,`${type}/${typology} ${seed}: most rooms are furnished (${furnished}/${real.length})`);
  // Deterministic.
  if(built<=2||extra.look){const again=V.build(P.generate(seed,{type,typology,...extra}));assert.ok(Buffer.from(again.vol).equals(Buffer.from(vol)),'same plan, same voxels');}
}
// Greedy mesher: a closed box meshes to exactly 6 quads; a segment boundary caps the cut.
{const dims=[6,6,6],vol=new Uint8Array(216);for(let y=1;y<5;y++)for(let z=1;z<5;z++)for(let x=1;x<5;x++)vol[x+6*(z+6*y)]=3;
  assert.equal(R.meshSegment(vol,dims,0,6).quads,6);assert.equal(R.meshSegment(vol,dims,0,3).quads,6,'a cut segment is closed on its own');}
console.log(`PASS building voxels: ${Object.keys(KIT.pieces).length} kit pieces, ${built} buildings, ${doorsChecked} doors open, roofs closed, stairs climb, ${pieces} pieces in walkable rooms`);
