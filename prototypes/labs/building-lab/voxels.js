(function(root){
  'use strict';
  // Voxel builder: turns a plan (plan.js) into a 6.25 cm material volume. Walls follow room edges, openings follow
  // the plan's doors and windows, the roof is a height field over the top floor's footprint, and furniture is
  // stamped from the voxelised KayKit pieces (kit-pieces.js) by room rules. Pure and seeded, like the planner.
  const isNode=typeof module==='object'&&module.exports;
  const Plan=isNode?require('./plan.js'):root.BuildingPlan,KIT=isNode?require('./kit-pieces.js'):root.BuildingKitPieces;
  const V=0.0625,CV=8,SH=48,SLAB=3,PLINTH=4,GROUND=3,REVISION='building-voxels-2';
  const DOOR_H=34,SILL=14,HEAD=34;

  // Architecture palette (1-127). Kit pieces own 128-255 (kit-pieces.js). Order is the material id.
  const MATS=[
    ['air',0x000000],['cobble',0x8d8a86],['cobble_dark',0x75726f],['earth',0x8a6f52],['grass',0x7fae5a],['grass_dark',0x6a9a4b],
    ['stone_grey',0x9a9ba0],['stone_grey_dark',0x7d7e85],['stone_sand',0xc9b48f],['stone_sand_dark',0xae9a75],
    ['plaster_white',0xf4f1ea],['plaster_cream',0xf1e3c4],['plaster_warm',0xe9dcc4],['plaster_peach',0xf2cdb0],['plaster_inside',0xefe8dc],
    ['timber_dark',0x4a3426],['timber_brown',0x7a5236],['timber_honey',0xb98a55],['lacquer_red',0xb8402f],['paint_white',0xfbfbf6],
    ['tile_charcoal',0x4b5058],['tile_charcoal_dark',0x3a3e46],['tile_blue',0x3f6fa8],['tile_blue_dark',0x335b8c],['tile_red',0xbc5a3c],['tile_red_dark',0x9c4630],
    ['tile_teal',0x2f8a86],['tile_teal_dark',0x26706d],['ridge',0x2e2e33],['gold',0xe0b24a],
    ['plank',0xc89a66],['plank_dark',0xb3875a],['tatami',0xcfc58f],['tatami_edge',0x5d6b46],['floor_stone',0xb7b0a4],['floor_stone_dark',0xa39b8e],
    ['glass',0x9fd3e6],['shoji',0xfff6dc],['door_wood',0x8b5a35],['stair_wood',0xa87846],
    ['cloth_indigo',0x2f3f73],['cloth_coral',0xe86f5c],['cloth_green',0x4f8a5b],['cloth_gold',0xe5b443],['cloth_white',0xf6f1e4],
    ['lantern',0xe8573e],['lantern_glow',0xffd27a],['brick',0xa45b45],['brick_dark',0x8a4a38],['terracotta',0xc0703f],['leaf',0x5f9c4a],['leaf_dark',0x4a7f3a],
    ['flower_pink',0xf08cb4],['flower_yellow',0xf5d34d],['flower_white',0xfaf6ee],['iron',0x3b3b40],['water',0x6fb3d6],['sign',0x6b4528],['sign_ink',0xf1e6cf],['soot',0x2a2626],
    // appended (never renumber): close-up detail and facade variants
    ['plank_light',0xd2a673],['lantern_dark',0xb23f2c],['terracotta_dark',0x9c5630],
    ['plaster_sage',0xd9e2c8],['plaster_rose',0xf0d2cf],['plaster_sky',0xd6e4ee],['plaster_ochre',0xead19a],['plaster_lavender',0xe2d8ec],['plaster_mint',0xd3ebe0],
    ['stone_white',0xdcd8cf],['stone_white_dark',0xc0bbb0],['slate',0x5b6470],['slate_dark',0x4a525d],['tile_green',0x5f8a52],['tile_green_dark',0x4c7142],
    ['shingle',0x8a6a4c],['shingle_dark',0x6f543c],['paint_green',0x4f7d5c],['paint_red',0xa8463e],['paint_blue',0x3e5f8a],['paint_cream',0xf3ead2],['timber_grey',0x7b746c],
    ['brick_red',0xb4583f],['brick_red_dark',0x94452f],['tile_purple',0x6b5a8c],['tile_purple_dark',0x56487a]
  ];
  const M={};MATS.forEach(([n],i)=>{M[n]=i;});
  function palette(){const p=new Uint8Array(256*4);MATS.forEach(([,c],i)=>{p.set([c>>16&255,c>>8&255,c&255,255],i*4);});
    KIT.palette.forEach(([r,g,b],i)=>p.set([r,g,b,255],(KIT.first+i)*4));return p;}
  const dark=m=>M[MATS[m][0]+'_dark']??m;

  // Kit stamps are decoded once.
  const pieces={};
  function piece(id){if(pieces[id])return pieces[id];const src=KIT.pieces[id];if(!src)throw new Error('unknown kit piece '+id);
    const [X,Y,Z]=src.dims,v=new Uint8Array(X*Y*Z);let o=0;for(let i=0;i<src.rle.length;i+=2){v.fill(src.rle[i+1],o,o+src.rle[i]);o+=src.rle[i];}
    return pieces[id]={id,dims:src.dims,tags:src.tags,v};}

  function build(plan,opts={}){
    const t0=Date.now(),FA=plan.facade,RF=plan.roof,{w,d,front,party}=plan.plot,storeys=plan.floors.length,r=Plan.rng(Plan.hash('voxels:'+plan.seed));
    const C={wall:M[FA.wall],timber:M[FA.timber],trim:M[FA.trim],base:M[FA.base],noren:M[FA.noren]||M.cloth_indigo,tile:M[RF.mat]};C.tileDk=dark(C.tile);C.baseDk=dark(C.base);
    const eave=RF.eave*4,pitch=RF.pitch,curve=RF.curve,margin=eave+24,MX=margin,MZ=margin+24,X=2*margin+w*CV,Z=MZ+d*CV+margin,roofRise=Math.ceil(pitch*(Math.max(w,d)*CV/2+eave)*(1+curve*.1))+24;
    const TU=RF.turret,Y0=GROUND,FL=f=>Y0+PLINTH+f*SH,plate=FL(storeys),Y=plate+Math.max(roofRise*(RF.form==='gambrel'?1.35:1),TU?TU.rise+TU.r*1.8+16:0)+24|0,vol=new Uint8Array(X*Y*Z);
    const at=(x,y,z)=>x<0||y<0||z<0||x>=X||y>=Y||z>=Z?0:vol[x+X*(z+Z*y)];
    const set=(x,y,z,m)=>{if(x>=0&&y>=0&&z>=0&&x<X&&y<Y&&z<Z)vol[x+X*(z+Z*y)]=m;};
    const box=(x0,y0,z0,x1,y1,z1,m)=>{for(let y=Math.max(0,y0);y<Math.min(Y,y1);y++)for(let z=Math.max(0,z0);z<Math.min(Z,z1);z++)vol.fill(m,X*(z+Z*y)+Math.max(0,x0),X*(z+Z*y)+Math.min(X,x1));};
    const fillIfAir=(x,y,z,m)=>{if(!at(x,y,z))set(x,y,z,m);};
    const airFill=(x0,y0,z0,x1,y1,z1,m)=>{for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++)fillIfAir(x,y,z,m);};
    const cx=x=>MX+x*CV,cz=z=>MZ+z*CV,mask=(f,x,z)=>x>=0&&z>=0&&x<w&&z<d&&plan.plot.masks[f][x+w*z]===1;
    const info={furniture:[],rooms:[],lights:[]};

    // Ground: a cobbled street in front, packed earth and grass behind and in any yard or courtyard.
    for(let z=0;z<Z;z++)for(let x=0;x<X;x++){const street=z<MZ+front*CV,yard=!street&&!mask(0,Math.floor((x-MX)/CV),Math.floor((z-MZ)/CV));
      for(let y=0;y<Y0;y++)set(x,y,z,y<Y0-1?M.earth:street?(((x>>2)+(z>>2)*3)%5===0||((x+z*7)%11===0)?M.cobble_dark:M.cobble):yard?((x*31+z*17)%13===0?M.grass_dark:M.grass):M.earth);}

    // Floors: stone plinth under the ground floor, timber slabs above; stair voids stay open. Boards run along x, 4
    // voxels (25 cm) wide, with staggered butt joints; tatami on lattice styles; stone flags in wet and work rooms.
    const roomAt=(f,x,z)=>{if(!mask(f,x,z))return null;const k=plan.floors[f].grid[x+w*z];return k>=0?plan.floors[f].rooms[k]:null;};
    const floorMat=(room,tx,tz)=>{const t=room.type;
      if(t==='kitchen'||t==='bath'||t==='store'||t==='workshop'){const u=tx%12,v=tz%12;return u===0||v===0?M.floor_stone_dark:M.floor_stone;}
      if(FA.lattice&&(t==='bed'||t==='guest'||t==='living'||t==='study')){const u=(tx%24+24)%24,v=(tz%12+12)%12;return u===0||v===0?M.tatami_edge:M.tatami;}
      const board=tz>>2;if(((tx+board*11)%28)===0)return M.plank_dark;return board%3===0?M.plank_light:board%3===1?M.plank:M.plank_light;};
    for(let f=0;f<storeys;f++){const F=plan.floors[f],voids=new Set(F.voids),yTop=FL(f);
      for(let z=0;z<d;z++)for(let x=0;x<w;x++){if(!mask(f,x,z)||voids.has(x+w*z))continue;const room=roomAt(f,x,z);
        if(f===0)box(cx(x),Y0,cz(z),cx(x)+CV,yTop-1,cz(z)+CV,C.base);else box(cx(x),yTop-SLAB,cz(z),cx(x)+CV,yTop-1,cz(z)+CV,M.timber_brown);
        for(let a=0;a<CV;a++)for(let b=0;b<CV;b++)set(cx(x)+a,yTop-1,cz(z)+b,room?floorMat(room,x*CV+a,z*CV+b):M.plank);}}

    // --- Facade ---------------------------------------------------------------------------------------------------
    // Exterior walls are 3 voxels thick in the outer edge of each cell. The face is drawn from plan.facade: the timber
    // frame snaps to the window grid (plan.facade.bays: a window on cells p, p+1 of every 4, so a post stands at the
    // start of cell p+3, centred in the gap between windows), a beam band at each floor, a stone base course with
    // mortar joints and a cap, boards under machiya windows, and braces in the frame panels.
    const DIRS=[['xm',-1,0],['xp',1,0],['zm',0,-1],['zp',0,1]];
    const isParty=(s,x)=>(s==='xm'&&x===0&&party[0])||(s==='xp'&&x===w-1&&party[1]);
    const extWall=[]; // [f] -> Set of "X,Z" wall columns, for the roof's gable fill
    const baseH=FA.groundBoards?6:9;
    // Along-wall position: cell index and the voxel inside it, measured from the plot origin.
    const cellOf=(s,A)=>{const o=s[0]==='z'?A-MX:A-MZ;return [Math.floor(o/CV),((o%CV)+CV)%CV];};
    const postAt=(s,A)=>{const [c,o]=cellOf(s,A),p=FA.bays[s];return (o===0&&((c-p-3)%4+4)%4===0)||(o===CV-1&&((c+1-p-3)%4+4)%4===0);};
    // distance (in the wall plane) from (u,v) to a segment; braces are 2 voxels thick
    const segDist=(u,v,u0,v0,u1,v1)=>{const du=u1-u0,dv=v1-v0,t=Math.max(0,Math.min(1,((u-u0)*du+(v-v0)*dv)/(du*du+dv*dv)));return Math.hypot(u-u0-t*du,v-v0-t*dv);};
    const frameAt=(f,s,A,v,corner)=>{
      if(v<0||v>=SH-3)return C.timber;                                         // floor beam band
      if(f===0&&v<baseH)return null;                                           // base course drawn separately
      if(corner)return C.timber;
      const kind=FA.frame;if(kind==='none')return null;
      if(postAt(s,A)||postAt(s,A-1))return C.timber;
      if(f===0&&FA.groundBoards&&v<SILL)return null;
      if(kind==='posts')return null;
      // rails at sill and head height on framed styles
      if((v===SILL-2||v===SILL-1||v===HEAD+1||v===HEAD+2)&&(kind==='grid'||kind==='braced'||kind==='cross'))return C.timber;
      const [c,o]=cellOf(s,A),p=FA.bays[s],k=((c-p)%4+4)%4,u=k*CV+o; // position within the 4-cell bay: window on k 0-1, post at k 3
      if(kind==='braced'&&f>0){const pu=3*CV;if(segDist(u,v,pu,SILL,pu-7,HEAD)<=1||segDist(u,v,pu,SILL,pu+7,HEAD)<=1)return C.timber;
        const pv=pu-4*CV;if(segDist(u,v,pv,SILL,pv+7,HEAD)<=1)return C.timber;}
      if(kind==='cross'&&k<2&&v<SILL-2){if(segDist(u,v,1,0,2*CV-2,SILL-3)<=1||segDist(u,v,2*CV-2,0,1,SILL-3)<=1)return C.timber;}
      return null;};
    const baseAt=(A,v)=>{const row=v>>2,j=(A+row*5)%9;if(v===baseH-1)return C.base;if((v&3)===3||j===0)return C.baseDk;return C.base;};
    const facade=(f,s,A,v,depth,party_,corner)=>{
      if(depth>0)return M.plaster_inside;
      if(party_)return v>=SH-3||v<0?C.timber:f===0&&v<baseH?C.base:C.wall; // a neighbour will stand against it
      const fr=frameAt(f,s,A,v,corner);if(fr)return fr;
      if(f===0&&v<baseH)return baseAt(A,v);
      if(f===0&&FA.groundBoards&&v<SILL)return (A%3===0)?M.timber_dark:C.timber;
      return C.wall;};
    // Proud parts (1 voxel out from the plaster): the timber frame and the base course cap.
    const proudAt=(f,s,A,v,corner)=>{const fr=frameAt(f,s,A,v,corner);if(fr)return fr;if(f===0&&v===baseH-1)return C.base;return null;};
    for(let f=0;f<storeys;f++){const y0=FL(f)-(f===0?PLINTH:SLAB),y1=FL(f+1),cols=new Set();extWall.push(cols);
      for(let z=0;z<d;z++)for(let x=0;x<w;x++){if(!mask(f,x,z))continue;
        for(const [s,dx,dz] of DIRS){if(mask(f,x+dx,z+dz))continue;const party_=isParty(s,x);
          // a corner post where the wall turns: the along-wall neighbour has no wall on this side
          const along=s[0]==='z'?[[-1,0],[1,0]]:[[0,-1],[0,1]],endLo=!mask(f,x+along[0][0],z+along[0][1])||mask(f,x+along[0][0]+dx,z+along[0][1]+dz),endHi=!mask(f,x+along[1][0],z+along[1][1])||mask(f,x+along[1][0]+dx,z+along[1][1]+dz);
          const [ax0,ax1]=s==='xm'?[cx(x),cx(x)+3]:s==='xp'?[cx(x)+5,cx(x)+8]:[cx(x),cx(x)+8],[az0,az1]=s==='zm'?[cz(z),cz(z)+3]:s==='zp'?[cz(z)+5,cz(z)+8]:[cz(z),cz(z)+8];
          const lo=s[0]==='z'?cx(x):cz(z),cornerOf=A=>(endLo&&A-lo<2)||(endHi&&A-lo>=CV-2);
          for(let y=y0;y<y1;y++)for(let zz=az0;zz<az1;zz++)for(let xx=ax0;xx<ax1;xx++){
            const depth=s==='xm'?xx-cx(x):s==='xp'?cx(x)+7-xx:s==='zm'?zz-cz(z):cz(z)+7-zz,A=s[0]==='x'?zz:xx;
            set(xx,y,zz,facade(f,s,A,y-FL(f),depth,party_,cornerOf(A)));cols.add(xx+','+zz);}
          if(!party_)for(let y=y0;y<y1;y++)for(let A=lo;A<lo+CV;A++){const m=proudAt(f,s,A,y-FL(f),cornerOf(A));if(m===null)continue;
            const ox=s==='xm'?cx(x)-1:s==='xp'?cx(x)+8:A,oz=s==='zm'?cz(z)-1:s==='zp'?cz(z)+8:A;fillIfAir(s[0]==='x'?ox:A,y,s[0]==='x'?A:oz,m);}}}
      // Interior walls between different rooms, with a post at each wall corner; they only fill air, so they never
      // paint over the facade. A stairwell is open (railed) only towards circulation.
      const F=plan.floors[f],g=F.grid,yw0=FL(f),yw1=FL(f+1)-SLAB;
      const voidSet=new Set(F.voids),circ=k=>k>=0&&['hall','living','common'].includes(F.rooms[k].type),railed=(i,j)=>(voidSet.has(i)&&circ(g[j]))||(voidSet.has(j)&&circ(g[i]));
      for(let z=0;z<d;z++)for(let x=0;x<w;x++){const a=g[x+w*z];if(a<0)continue;const i=x+w*z;
        if(x+1<w&&g[i+1]>=0&&g[i+1]!==a&&!railed(i,i+1))airFill(cx(x)+7,yw0,cz(z),cx(x)+9,yw1,cz(z)+8,M.plaster_inside);
        if(z+1<d&&g[i+w]>=0&&g[i+w]!==a&&!railed(i,i+w))airFill(cx(x),yw0,cz(z)+7,cx(x)+8,yw1,cz(z)+9,M.plaster_inside);}
      for(let z=1;z<d;z++)for(let x=1;x<w;x++){const q=[g[x-1+w*(z-1)],g[x+w*(z-1)],g[x-1+w*z],g[x+w*z]];if(q.some(k=>k<0))continue;if(new Set(q).size>=2&&!(q[0]===q[1]&&q[2]===q[3])&&!(q[0]===q[2]&&q[1]===q[3]))airFill(cx(x)-1,yw0,cz(z)-1,cx(x)+1,yw1,cz(z)+1,C.timber);}}

    // --- Stairs ----------------------------------------------------------------------------------------------------
    // Solid timber flights of 3-voxel risers and treads, and landings, from the plan's stair module. Steps only fill
    // air, so a flight against an outside wall never punches through it. A railing goes round every stair void that
    // opens onto circulation, except where the stair opens onto the hall (the foot of the next flight, the head of
    // the last); bedrooms, baths and stores beside a stairwell keep their wall.
    for(const fl of plan.stair.flights){const yb=FL(fl.from),[x0,z0,x1,z1]=fl.rect,X0=cx(x0),X1=cx(x1),Z0=cz(z0),Z1=cz(z1),len=fl.dir[0]==='z'?Z1-Z0:X1-X0,t=len/fl.risers;
      for(let k=0;k<fl.risers;k++){const a=Math.round(k*t),b=Math.round((k+1)*t),top=yb+(fl.start+k+1)*3;
        const [bx0,bx1,bz0,bz1]=fl.dir==='zp'?[X0,X1,Z0+a,Z0+b]:fl.dir==='zm'?[X0,X1,Z1-b,Z1-a]:fl.dir==='xp'?[X0+a,X0+b,Z0,Z1]:[X1-b,X1-a,Z0,Z1];
        airFill(bx0,top-1,bz0,bx1,top,bz1,M.plank);airFill(bx0,yb+(fl.start?fl.start*3-2:0),bz0,bx1,top-1,bz1,M.stair_wood);}}
    for(const ld of plan.stair.landings){const yb=FL(ld.from),[x0,z0,x1,z1]=ld.rect,top=yb+ld.rise*3;airFill(cx(x0),top-1,cz(z0),cx(x1),top,cz(z1),M.plank);airFill(cx(x0),top-6,cz(z0),cx(x1),top-1,cz(z1),M.stair_wood);
      // a landing is carried on posts at its corners, not a solid block
      for(const [px,pz] of [[cx(x0),cz(z0)],[cx(x1)-2,cz(z0)],[cx(x0),cz(z1)-2],[cx(x1)-2,cz(z1)-2]])airFill(px,yb,pz,px+2,top-6,pz+2,C.timber);}
    for(let f=1;f<storeys;f++){const voids=new Set(plan.floors[f].voids),yr=FL(f),open=new Set();
      for(const dr of plan.floors[f].doors)if(dr.kind==='open')for(const [x,z] of dr.cells)open.add(x+','+z);
      for(const i of voids){const x=i%w,z=Math.floor(i/w);for(const [s,dx,dz] of DIRS){const n=x+dx+w*(z+dz);if(voids.has(n)||!mask(f,x+dx,z+dz))continue;
        const nk=plan.floors[f].grid[x+dx+w*(z+dz)];if(open.has((x+dx)+','+(z+dz))||!['hall','living','common'].includes(plan.floors[f].rooms[nk]?.type))continue;
        const [x0,x1]=s==='xm'?[cx(x),cx(x)+1]:s==='xp'?[cx(x)+7,cx(x)+8]:[cx(x),cx(x)+8],[z0,z1]=s==='zm'?[cz(z),cz(z)+1]:s==='zp'?[cz(z)+7,cz(z)+8]:[cz(z),cz(z)+8];
        box(x0,yr+14,z0,x1,yr+16,z1,C.timber);for(let a=0;a<8;a+=4){const px=s[0]==='x'?x0:x0+a,pz=s[0]==='z'?z0:z0+a;for(let yy=yr;yy<yr+14;yy++)if(!at(px,yy,pz))set(px,yy,pz,C.timber);}}}}

    // --- Openings ---------------------------------------------------------------------------------------------------
    // Each opening is cut through its wall, then framed, glazed or hung. Wall layers are addressed by depth from the
    // face (0 = the plaster surface, 1-2 inside); 'proud' layers stand 1 and 2 voxels out from it.
    const edgeBox=(x,z,s,interior)=>{const t=interior?[7,9]:null;
      if(s==='xm')return [cx(x)-1,cx(x)+3,cz(z),cz(z)+8];if(s==='xp')return interior?[cx(x)+t[0],cx(x)+t[1],cz(z),cz(z)+8]:[cx(x)+5,cx(x)+9,cz(z),cz(z)+8];
      if(s==='zm')return [cx(x),cx(x)+8,cz(z)-1,cz(z)+3];return interior?[cx(x),cx(x)+8,cz(z)+t[0],cz(z)+t[1]]:[cx(x),cx(x)+8,cz(z)+5,cz(z)+9];};
    const span=(cells,s,interior)=>{let b=null;for(const [x,z] of cells){const e=edgeBox(x,z,s,interior);b=b?[Math.min(b[0],e[0]),Math.max(b[1],e[1]),Math.min(b[2],e[2]),Math.max(b[3],e[3])]:e;}return b;};
    const alongOf=(b,s)=>s[0]==='x'?[b[2],b[3]]:[b[0],b[1]],acrossOf=(b,s)=>s[0]==='x'?[b[0],b[1]]:[b[2],b[3]];
    const put=(s,a,c,y,m)=>s[0]==='x'?set(c,y,a,m):set(a,y,c,m);
    const fillAt=(s,a,c,y,m)=>s[0]==='x'?fillIfAir(c,y,a,m):fillIfAir(a,y,c,m),atS=(s,a,c,y)=>s[0]==='x'?at(c,y,a):at(a,y,c);
    const cut=(b,y0,y1,inset)=>box(b[0]+(inset?.[0]||0),y0,b[2]+(inset?.[2]||0),b[1]-(inset?.[1]||0),y1,b[3]-(inset?.[3]||0),0);
    const outward=s=>({xm:[-1,0],xp:[1,0],zm:[0,-1],zp:[0,1]})[s],sgn=s=>{const o=outward(s);return o[0]+o[1];};
    // Dressing is all-or-nothing: drawn only if every voxel it needs is empty, so it never cuts into a neighbour.
    const clearPut=(s,cells)=>{for(const [a,c,y] of cells)if(atS(s,a,c,y))return false;for(const [a,c,y,m] of cells)put(s,a,c,y,m);return true;};
    // Window shapes on a 12-voxel-wide light: rect, tall (French), arched (round head), paired (two lights).
    const windowShape=(kind,small,f)=>{const W=12,lo=small?22:kind==='tall'?(f===0?baseH+3:6):SILL,hi=small?HEAD-2:kind==='tall'?HEAD+2:kind==='arched'?HEAD+2:HEAD;
      const clear=(u,v)=>{if(u<0||u>=W||v<lo||v>=hi)return false;if(kind==='arched'&&!small){const r=W/2,top=hi-r;if(v>=top){const du=u+.5-r,dv=v+.5-top;if(du*du+dv*dv>r*r)return false;}}
        if(kind==='paired'&&!small&&(u===5||u===6))return false;return true;};
      return {W,lo,hi,clear};};
    function opening(f,o,interior){
      const s=o.side||o.dir,b=span(o.cells,s,interior),[a0,a1]=alongOf(b,s),[c0,c1]=acrossOf(b,s),y=FL(f),kind=o.kind,k=sgn(s);
      // layer(dep): wall layer at depth dep from the face; proud(n): n voxels out from the face
      const layer=dep=>k<0?c0+1+dep:c1-2-dep,proud=n=>k<0?c0+1-n:c1-2+n,face=layer(0),mid=Math.floor((c0+c1)/2);
      const ins=n=>s[0]==='x'?[0,0,n,n]:[n,n,0,0];
      if(kind==='open'){cut(b,y,y+DOOR_H+4,ins(0));return;}
      if(interior&&kind==='door'){cut(b,y,y+DOOR_H,ins(1));for(let yy=y;yy<y+DOOR_H+1;yy++)for(let c=c0;c<c1;c++){put(s,a0,c,yy,M.timber_dark);put(s,a1-1,c,yy,M.timber_dark);}
        for(let a=a0;a<a1;a++)for(let c=c0;c<c1;c++)put(s,a,c,y+DOOR_H,M.timber_dark);return;}
      if(kind==='front'||kind==='back'){
        const L=a0+1,R=a1-2; // jambs; the clear opening is L+1..R-1 (12 voxels)
        for(let a=L+1;a<R;a++)for(let yy=y;yy<y+DOOR_H;yy++)for(let dep=0;dep<3;dep++)put(s,a,layer(dep),yy,0);
        for(let yy=y;yy<y+DOOR_H+2;yy++)for(let dep=-1;dep<3;dep++){put(s,L,dep<0?proud(1):layer(dep),yy,C.trim);put(s,R,dep<0?proud(1):layer(dep),yy,C.trim);}
        for(let a=L-1;a<=R+1;a++)for(let n=0;n<2;n++)put(s,a,proud(n),y+DOOR_H+n,C.trim);   // lintel
        for(let a=L+1;a<R;a++)for(let n=1;n<6;n++)fillAt(s,a,proud(n),y-1-Math.floor(n/3),M.stone_grey); // threshold step
        if(kind==='back'){for(let a=L+1;a<R;a++)for(let yy=y;yy<y+DOOR_H;yy++)put(s,a,layer(1),yy,((a-L)%4===0)||yy===y+DOOR_H-1||yy===y+12?M.timber_dark:M.door_wood);return;}
        if(FA.lattice){// sliding shoji door pushed half open, a noren across the head, paper lanterns either side
          for(let a=L+1;a<L+7;a++)for(let yy=y;yy<y+DOOR_H;yy++)put(s,a,layer(1),yy,(yy-y)%6===0||(a-L)%5===1?M.timber_dark:M.shoji);
          for(let a=L;a<=R;a++)for(let yy=y+DOOR_H-12;yy<y+DOOR_H;yy++)if((a-L)%6!==0||yy>y+DOOR_H-3)put(s,a,proud(1),yy,yy>y+DOOR_H-3?M.timber_dark:C.noren);
          for(const a of [L-5,R+5])paperLantern(s,a,proud(3),y+DOOR_H+1);}
        else{// a panelled door standing open into the room, a small canopy over the step and a wall lamp
          for(let n=0;n<11;n++)for(let yy=y;yy<y+DOOR_H-1;yy++)fillAt(s,L+1,layer(2)-k*n,yy,(yy-y)%9===0||n===0||n===10?M.timber_dark:M.door_wood);
          if(FA.canopy){for(let a=L-2;a<=R+2;a++)for(let n=0;n<6;n++){const yy=y+DOOR_H+5-Math.floor(n/2);put(s,a,proud(n),yy,C.tile);put(s,a,proud(n),yy-1,C.timber);}
            for(const a of [L-2,R+2])for(let n=1;n<5;n++)fillAt(s,a,proud(n),y+DOOR_H+5-n-2,C.timber);}
          wallLamp(s,R+4,proud(1),y+DOOR_H-4);}
        for(const a of [L-9,R+9])pot(s,a,proud(4),Y0,face);
        return;}
      if(kind==='shopfront'||kind==='bay'){
        const top=y+HEAD+2;for(let a=a0;a<a1;a++)for(let yy=y+1;yy<top;yy++)for(let dep=0;dep<3;dep++)put(s,a,layer(dep),yy,0);
        for(let a=a0;a<a1;a++)for(let dep=-1;dep<3;dep++){put(s,a,dep<0?proud(1):layer(dep),top-1,C.timber);put(s,a,dep<0?proud(1):layer(dep),top,C.timber);} // head beam
        for(let a=a0;a<a1;a+=16)for(let yy=y;yy<top;yy++)for(let dep=-1;dep<3;dep++)put(s,a,dep<0?proud(1):layer(dep),yy,C.timber);for(let yy=y;yy<top;yy++)for(let dep=-1;dep<3;dep++)put(s,a1-1,dep<0?proud(1):layer(dep),yy,C.timber);
        // stall riser below, then lattice or glazing; a wide sliding section stands open on a shop
        for(let a=a0;a<a1;a++)for(let yy=y;yy<y+8;yy++)put(s,a,layer(1),yy,(a-a0)%4===0?M.timber_dark:C.timber);
        for(let a=a0;a<a1;a++)put(s,a,proud(1),y+8,C.timber),put(s,a,proud(2),y+8,C.timber); // a display ledge
        const openFrom=kind==='shopfront'?a0+Math.floor((a1-a0)*.55):a1;
        for(let a=a0;a<openFrom;a++)for(let yy=y+9;yy<top-1;yy++){if((a-a0)%16===0)continue;const lat=FA.lattice?((a-a0)%3===0||(yy-y)%9===0):((a-a0)%8===0||yy===y+21);put(s,a,layer(1),yy,lat?M.timber_dark:FA.lattice?M.shoji:M.glass);}
        if(FA.lattice)hisashi(s,a0-4,a1+4,face,top+5);else awning(s,a0,a1,proud(1),top+2);
        if(kind==='shopfront')signboard(s,a0,a1,proud(1),top+8);
        return;}
      if(kind==='balcony'){const W=windowShape('tall'),L=a0+1,R=a1-2;
        for(let a=L+1;a<R;a++)for(let yy=y;yy<y+DOOR_H;yy++)for(let dep=0;dep<3;dep++)put(s,a,layer(dep),yy,0);
        for(let a=L+1;a<R;a++)for(let yy=y;yy<y+DOOR_H;yy++)put(s,a,layer(1),yy,(a-L)%6===0||(yy-y)%8===0||yy===y+DOOR_H-1?M.timber_dark:FA.lattice?M.shoji:M.glass);
        for(let yy=y;yy<y+DOOR_H+1;yy++){put(s,L,face,yy,C.trim);put(s,R,face,yy,C.trim);}for(let a=L;a<=R;a++)put(s,a,face,y+DOOR_H,C.trim);
        // a deck 10 voxels deep on brackets, with a railing of balusters and a top rail
        for(let n=1;n<=10;n++)for(let a=a0-2;a<a1+2;a++){const c=face+k*n;put(s,a,c,y-1,C.timber);if(n===10||a===a0-2||a===a1+1){put(s,a,c,y+13,C.trim);put(s,a,c,y+14,C.trim);if((a+n)%3===0||a===a0-2||a===a1+1)for(let yy=y;yy<y+13;yy++)put(s,a,c,yy,C.trim);}}
        for(let a=a0;a<a1;a+=8)for(let n=1;n<=9;n++)fillAt(s,a,face+k*n,y-2-Math.floor((10-n)/2),C.timber);
        void W;return;}
      if(oriels.has(o)){oriel(s,a0,a1,y,layer,proud,face,k);return;}
      // windows: a recessed light with glazing bars, a 1-voxel frame, a lintel and a 2-deep sill
      const small=kind==='small',wk=small?'rect':f===0?FA.groundWindow:FA.window,shape=windowShape(wk,small,f),wa=a0+2;
      for(let u=-1;u<=shape.W;u++)for(let yy=y+shape.lo-1;yy<=y+shape.hi;yy++){const v=yy-y,isClear=shape.clear(u,v),near=!isClear&&[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].some(([du,dv])=>shape.clear(u+du,v+dv));
        if(isClear){for(let dep=0;dep<3;dep++)put(s,wa+u,layer(dep),yy,0);
          const gl=FA.glazing==='lattice'?(u%3===2||(v-shape.lo)%4===3):FA.glazing==='grid'?(u%4===3||(v-shape.lo)%5===4):(u===5||u===6||v===shape.lo+Math.floor((shape.hi-shape.lo)*.6));
          put(s,wa+u,layer(1),yy,gl?M.timber_dark:FA.lattice?M.shoji:M.glass);}
        else if(near){put(s,wa+u,face,yy,C.trim);put(s,wa+u,layer(1),yy,C.trim);}}
      for(let u=-2;u<=shape.W+1;u++){fillAt(s,wa+u,proud(1),y+shape.lo-1,C.trim);fillAt(s,wa+u,proud(2),y+shape.lo-1,C.trim);}  // sill
      if(wk!=='arched')for(let u=-1;u<=shape.W;u++)fillAt(s,wa+u,proud(1),y+shape.hi,C.trim);                                     // lintel (an arch carries its own)
      else fillAt(s,wa+5,proud(1),y+shape.hi,C.trim),fillAt(s,wa+6,proud(1),y+shape.hi,C.trim);                                    // keystone
      if(!small&&!FA.lattice&&f>0&&FA.boxes)flowerBox(s,wa-1,wa+shape.W+1,proud(1),y+shape.lo-2);
      if(!small&&FA.shutters&&wk!=='arched'){const sh=M[FA.shutter]||C.timber,shd=dark(sh)===sh?C.timber:dark(sh);
        for(const a of [wa-5,wa+shape.W+1]){const cells=[];for(let n=0;n<4;n++)for(let yy=y+shape.lo;yy<y+shape.hi;yy++)cells.push([a+n,proud(1),yy,(yy-y-shape.lo)%3===0?shd:sh]);clearPut(s,cells);}}
    }
    // An oriel: a glazed bay projecting 7 voxels on corbels, open to the room behind, under a small tiled cap.
    function oriel(s,a0,a1,y,layer,proud,face,k){const A0=a0-1,A1=a1+1,lo=y+SILL-3,hi=y+HEAD+2,D=7;
      for(let a=A0+1;a<A1-1;a++)for(let yy=lo;yy<hi;yy++)for(let dep=0;dep<3;dep++)put(s,a,layer(dep),yy,0);
      for(let n=1;n<=D;n++)for(let a=A0;a<A1;a++){const c=proud(n),side=a===A0||a===A1-1,frontN=n===D;
        put(s,a,c,lo-1,C.timber);
        for(let yy=lo;yy<hi;yy++){const glassFront=frontN&&!side&&yy>=lo+3&&yy<hi-2,glassSide=side&&n>=2&&n<=D-1&&yy>=lo+3&&yy<hi-2;
          if(frontN||side)put(s,a,c,yy,glassFront||glassSide?((frontN&&(a-A0)%5===0)||yy===lo+12?M.timber_dark:FA.lattice?M.shoji:M.glass):(yy<lo+3?C.wall:C.trim));}
        for(let t=0;t<4;t++)put(s,a,c,hi+t-Math.floor(n/2),C.tile);}
      for(let a=A0-1;a<=A1;a++)for(let t=0;t<3;t++)put(s,a,proud(D+1),hi-1+t-Math.floor((D+1)/2),C.tile);
      for(const a of [A0,A1-1,Math.floor((A0+A1)/2)])for(let n=1;n<=D;n++)for(let yy=lo-2-(D-n);yy<lo-1;yy++)put(s,a,proud(n),yy,C.timber); // corbels
      void face;void k;}
    function flowerBox(s,a0,a1,c,y){const k=sgn(s),cells=[];for(let a=a0;a<a1;a++)for(let t=0;t<3;t++){cells.push([a,c+k*t,y-1,M.terracotta],[a,c+k*t,y-2,M.terracotta]);
      const h=(a*7+t*3)%5;cells.push([a,c+k*t,y,h<3?M.leaf:M.leaf_dark]);if(h===0||h===3)cells.push([a,c+k*t,y+1,[M.flower_pink,M.flower_yellow,M.flower_white][(a+t)%3]]);}clearPut(s,cells);}
    // A paper lantern on a bracket: ribbed body, black caps top and bottom, a glowing core.
    function paperLantern(s,a,c,ytop){const k=sgn(s),cells=[];for(let n=0;n<3;n++)cells.push([a,c-k*n,ytop,M.iron]);
      for(let yy=ytop-12;yy<ytop;yy++){const v=yy-(ytop-6),rad=yy>=ytop-2||yy<ytop-11?1.6:3.1-Math.abs(v+.5)*.12;
        for(let da=-3;da<=3;da++)for(let dc=-3;dc<=3;dc++){const rr=Math.hypot(da,dc);if(rr>rad)continue;const cap=yy>=ytop-2||yy<ytop-11;cells.push([a+da,c+dc*k,yy,cap?M.soot:(yy-ytop)%3===0&&rr>rad-1.2?M.lantern_dark:rr<1.5?M.lantern_glow:M.lantern]);}}
      if(clearPut(s,cells))info.lights.push({s,a,c,y:ytop-6});}
    // An iron wall lamp: a bracket arm and a small glazed lantern with a glowing pane.
    function wallLamp(s,a,c,y){const k=sgn(s),cells=[];for(let n=0;n<4;n++)cells.push([a,c+k*n,y+6,M.iron]);
      for(let yy=y;yy<y+6;yy++)for(let da=-1;da<=1;da++)for(let n=2;n<5;n++){const edge=yy===y||yy===y+5||Math.abs(da)===1&&(n===2||n===4);cells.push([a+da,c+k*n,yy,edge?M.iron:M.lantern_glow]);}
      if(clearPut(s,cells))info.lights.push({s,a,c,y:y+3});}
    // A potted plant on the pavement, only in front of solid wall (not across a shopfront or another door).
    function pot(s,a,c,y,face){for(let da=-3;da<=3;da++)if(!atS(s,a+da,face,y+PLINTH+6))return;const cells=[];
      for(let yy=y;yy<y+6;yy++)for(let da=-3;da<=3;da++)for(let dc=-3;dc<=3;dc++){const rr=da*da+dc*dc,rad=yy===y+5?9.5:5+(yy-y)*.6;if(rr<=rad)cells.push([a+da,c+dc,yy,yy===y+5?M.terracotta_dark:M.terracotta]);}
      for(let yy=y+6;yy<y+14;yy++)for(let da=-4;da<=4;da++)for(let dc=-4;dc<=4;dc++){const v=yy-(y+9);if(da*da+dc*dc+v*v*1.1<=14&&((da*3+dc*5+yy*7)%5))cells.push([a+da,c+dc,yy,(da+2*dc+yy)%3?M.leaf:M.leaf_dark]);}
      clearPut(s,cells);}
    function awning(s,a0,a1,c,y){const k=sgn(s),cloth=C.noren;for(let t=0;t<12;t++)for(let a=a0;a<a1;a++){const yy=y-Math.floor(t/2);put(s,a,c+k*t,yy,((a-a0)>>2)&1?cloth:M.cloth_white);if(t===11)for(let q=1;q<3;q++)put(s,a,c+k*t,yy-q,((a-a0)>>2)&1?cloth:M.cloth_white);}}
    function hisashi(s,a0,a1,face,y){const k=sgn(s);for(let t=-1;t<14;t++)for(let a=a0;a<a1;a++){const yy=y-Math.floor((t+1)*.55);put(s,a,face+k*t,yy,(a%4===0)?C.tileDk:C.tile);put(s,a,face+k*t,yy-1,M.timber_dark);if(a%4===0)fillAt(s,a,face+k*t,yy+1,C.tile);}
      for(let a=a0;a<a1;a+=16)for(let t=0;t<12;t++)put(s,a,face+k*t,y-2-Math.floor(t*.55),M.timber_dark);}
    function signboard(s,a0,a1,c,y){const k=sgn(s),mid=Math.floor((a0+a1)/2),half=Math.min(14,Math.floor((a1-a0)/2)-2),cells=[];
      for(let a=mid-half;a<mid+half;a++)for(let yy=y;yy<y+9;yy++){const edge=a===mid-half||a===mid+half-1||yy===y||yy===y+8,ink=!edge&&((Plan.hash(`${plan.seed}:${a>>1}:${yy>>1}`)%7)<2)&&yy>y+1&&yy<y+7&&(a-mid+half)%9>1;cells.push([a,c+k,yy,edge?M.timber_dark:ink?M.sign_ink:M.sign]);}
      // hung clear of balconies and windows above: try the usual height, then lower onto the shopfront head
      if(!clearPut(s,cells))clearPut(s,cells.map(([a,cc,yy,m])=>[a,cc,yy-6,m]));}

    // Oriels: the front windows nearest the middle on each upper floor, up to plan.facade.oriels.
    const oriels=new Set();if(FA.oriels)for(let f=1;f<storeys;f++){const ws=plan.floors[f].openings.filter(o=>o.kind==='window'&&o.side==='zm').sort((a,b)=>Math.abs(a.cells[0][0]+1-w/2)-Math.abs(b.cells[0][0]+1-w/2));for(const o of ws.slice(0,FA.oriels))oriels.add(o);}
    for(let f=0;f<storeys;f++){const F=plan.floors[f];for(const dr of F.doors)opening(f,dr,true);for(const o of F.openings)opening(f,o,false);}

    // Jetty brackets under any upper floor that overhangs the street, on the post grid.
    if(plan.plot.jetty)for(let A=cx(0);A<cx(w);A++)if(postAt('zm',A)&&!postAt('zm',A-1)||A===cx(0)||A===cx(w)-2)for(let t=0;t<CV;t++){const zz=cz(front)-1-t,yy=FL(1)-SLAB-1-(CV-1-t);box(A,yy,zz,A+2,yy+1,zz+1,C.timber);}

    // --- Roofs -----------------------------------------------------------------------------------------------------
    // One per level: each storey's footprint with nothing built above it gets a roof at that storey's plate. The main
    // roof follows plan.roof (gable, hip; ridge along the frontage or the depth; terraces never hip into a party wall).
    // A lower part that meets a taller block (a rear wing, a stair tower) gets a lean-to; a small free-standing part
    // gets a hipped cap. Up close: the slope's voxel steps are the tile courses, round-tile
    // ribs stand 1 voxel proud every 4 along the eave, a fascia board finishes the eave, rafter tails show under the
    // overhang, bargeboards finish the gable verges, and the ridge and hips carry caps.
    const roofY=new Int16Array(X*Z).fill(-1),top=storeys-1;
    for(let L=top;L>=0;L--){const region=plan.plot.masks[L].map((v,i)=>v&&!(L<top&&plan.plot.masks[L+1][i])?1:0);if(!region.some(Boolean))continue;
      const lvlPlate=FL(L+1),above=L<top?plan.plot.masks[L+1]:null,lvY=new Int16Array(X*Z).fill(-1),kind=new Uint8Array(X*Z),eaveAxisX=new Uint8Array(X*Z);
      const zTop=Math.min(...[...region.keys()].filter(i=>region[i]).map(i=>Math.floor(i/w))),rects=decompose(region,w,d).map(r=>[r,false]);
      if(L===top&&RF.cross)rects.push([[RF.cross.x0,zTop,RF.cross.x1-1,Math.min(d-1,zTop+RF.cross.depth-1)],true]);
      for(const [[rx0,rz0,rx1,rz1],isCross] of rects){
        const x0=cx(rx0),x1=cx(rx1+1),z0=cz(rz0),z1=cz(rz1+1),wide=x1-x0,deep=z1-z0;
        const touch=s_=>{if(!above)return 0;let n=0;if(s_==='xm')for(let z=rz0;z<=rz1;z++)n+=rx0>0&&above[rx0-1+w*z]?1:0;if(s_==='xp')for(let z=rz0;z<=rz1;z++)n+=rx1+1<w&&above[rx1+1+w*z]?1:0;
          if(s_==='zm')for(let x=rx0;x<=rx1;x++)n+=rz0>0&&above[x+w*(rz0-1)]?1:0;if(s_==='zp')for(let x=rx0;x<=rx1;x++)n+=rz1+1<d&&above[x+w*(rz1+1)]?1:0;return n;};
        const lean=['xm','xp','zm','zp'].map(s_=>[s_,touch(s_)]).sort((a,b)=>b[1]-a[1])[0],isLean=lean[1]>0;
        const small=!isCross&&!isLean&&rx1-rx0<6&&rz1-rz0<6,shape=isCross?'gable':small?'hip':isLean?'lean':L===top?(RF.form==='hip'&&!party[0]&&!party[1]?'hip':'gable'):'gable';
        const ridgeX=isCross?false:isLean?lean[0][0]==='z':L===top?(RF.ridge==='frontage'?true:RF.ridge==='depth'?false:wide>=deep):wide>=deep;
        const main=L===top&&!isCross&&!isLean&&!small;
        const noEave=s_=>(s_==='xm'&&rx0===0&&party[0])||(s_==='xp'&&rx1===w-1&&party[1])||(isLean&&s_===lean[0])||(isCross&&s_==='zp');
        const eS=s_=>noEave(s_)?0:(shape==='gable'&&((ridgeX&&s_[0]==='x')||(!ridgeX&&s_[0]==='z'))?Math.round(eave*.5):eave);
        const gx0=x0-eS('xm'),gx1=x1+eS('xp'),gz0=z0-eS('zm'),gz1=z1+eS('zp');
        const span=ridgeX?deep:wide,half=span/2,lp=isLean?Math.min(pitch,(SH-14)/span):pitch;
        for(let z=gz0;z<gz1;z++)for(let x=gx0;x<gx1;x++){
          const wz=Math.min(z-z0,z1-1-z),wx=Math.min(x-x0,x1-1-x);let dist,full,slopeAlongZ;
          if(isLean){const s_=lean[0];dist=s_==='xm'?x1-1-x:s_==='xp'?x-x0:s_==='zm'?z1-1-z:z-z0;full=span;slopeAlongZ=s_[0]==='z';}
          else{const dz_=ridgeX?wz:1e9,dx_=ridgeX?1e9:wx;if(shape==='hip'){dist=Math.min(half,Math.min(wz,wx));slopeAlongZ=wz<=wx;}else{dist=Math.min(half,ridgeX?dz_:dx_);slopeAlongZ=ridgeX;}full=half;}
          const t=dist/full;let h=lp*dist;
          // gambrel: a steep lower slope and a shallow upper one; half-hip: the top of each gable end is clipped
          if(main&&RF.form==='gambrel'&&dist>0){const k=.45*half;h=dist<k?lp*1.9*dist:lp*1.9*k+lp*.5*(dist-k);}
          if(main&&RF.form==='halfhip'&&shape==='gable'){const dE=ridgeX?wx:wz;h=Math.min(h,lp*1.2*dE+.6*lp*half);}
          if(t>0&&!isLean&&!(main&&RF.form==='gambrel'))h-=curve*lp*half*.22*Math.sin(Math.PI*Math.min(1,t));else if(t<=0)h+=curve*lp*dist*dist/Math.max(1,eave)*.9;
          if(curve>0&&!isLean){const ex=Math.min(x-gx0,gx1-1-x),ez=Math.min(z-gz0,gz1-1-z);if(ex<eave&&ez<eave)h+=curve*12*(1-ex/eave)*(1-ez/eave);}
          // eave tips (fascia) and gable verges (bargeboards)
          const tipEave=slopeAlongZ?Math.min(z-gz0,gz1-1-z):Math.min(x-gx0,gx1-1-x),tipVerge=shape==='gable'?(ridgeX?Math.min(x-gx0,gx1-1-x):Math.min(z-gz0,gz1-1-z)):1e9;
          const hipLine=shape==='hip'&&Math.abs(wz-wx)<1&&dist<half-1,yy=Math.round(lvlPlate+2+h),i=x+X*z;
          if(yy>lvY[i]){lvY[i]=yy;kind[i]=(!isLean&&dist>=full-1?2:0)|(tipEave<1?4:0)|(tipVerge<2?8:0)|(hipLine?16:0);eaveAxisX[i]=slopeAlongZ?1:0;}}}
      const cols=extWall[L],lower=L<top,put3=(x,y,z,m)=>lower?fillIfAir(x,y,z,m):set(x,y,z,m);
      for(let z=0;z<Z;z++)for(let x=0;x<X;x++){const i=x+X*z,ry=lvY[i];if(ry<0)continue;roofY[i]=Math.max(roofY[i],ry);
        const gx=Math.floor((x-MX)/CV),gz=Math.floor((z-MZ)/CV),inside=x>=MX&&z>=MZ&&gx<w&&gz<d&&region[gx+w*gz],ea=eaveAxisX[i]?x:z,kd=kind[i];
        // gable infill: the outer wall rises to meet the roof
        if(cols.has(x+','+z)&&inside)for(let yy=lvlPlate;yy<ry-2;yy++){const s_=x<MX+3?'xm':x>=MX+w*CV-3?'xp':z<MZ+3?'zm':'zp',par=isParty(s_,s_==='xm'?0:w-1)&&(s_==='xm'||s_==='xp');
          const m=par?C.wall:FA.frame==='none'||FA.frame==='posts'?(postAt(s_,s_[0]==='x'?z:x)||postAt(s_,(s_[0]==='x'?z:x)-1)?C.timber:C.wall):facade(L,s_,s_[0]==='x'?z:x,SILL+2+(yy-lvlPlate)%(SH-SILL-6),0,false,false);put3(x,yy,z,m);}
        const surf=(kd&4)?C.trim:C.tile; // the voxel steps of the slope read as tile courses on their own
        put3(x,ry,z,surf);put3(x,ry-1,z,C.tile);put3(x,ry-2,z,inside?C.tile:M.timber_brown);
        if(!inside&&!(kd&4)&&!(kd&8)&&(ea%8)<2)put3(x,ry-3,z,M.timber_dark);                       // rafter tails under the overhang
        if(kd&4)for(let n=1;n<3;n++)put3(x,ry-n,z,C.trim);                                        // fascia board
        if(kd&8)for(let n=0;n<4;n++)put3(x,ry-n,z,C.trim);                                        // bargeboard on the verge
        if(!(kd&(2|4|8|16))&&ea%4===0)fillIfAir(x,ry+1,z,C.tileDk);                                // round-tile ribs, a shade darker
        if(kd&2){fillIfAir(x,ry+1,z,M.ridge);fillIfAir(x,ry+2,z,M.ridge);}
        if(kd&16)fillIfAir(x,ry+1,z,M.ridge);}
      // The ridge cap runs 3 voxels wide; ridge ends carry an ornament on lattice styles, a plain end tile otherwise.
      for(let z=1;z<Z-1;z++)for(let x=1;x<X-1;x++){const i=x+X*z;if(!(kind[i]&2))continue;
        for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]])if(lvY[(x+a)+X*(z+b)]>=lvY[i]-1&&!(kind[(x+a)+X*(z+b)]&2))fillIfAir(x+a,lvY[i]+1,z+b,M.ridge);
        const nb=[[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b])=>kind[(x+a)+X*(z+b)]&2).length;
        if(nb===1)for(let yy=lvY[i]+1;yy<lvY[i]+(FA.lattice?6:4);yy++)for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)fillIfAir(x+a,yy,z+b,FA.lattice&&plan.style==='spire'?M.gold:M.ridge);}}

    // Dormers on a street-facing slope, on the window grid: a walled box with a window and its own small gable.
    if(RF.dormers){const zTop=Math.min(...[...plan.plot.masks[top].keys()].filter(i=>plan.plot.masks[top][i]).map(i=>Math.floor(i/w))),zf=cz(zTop)+5,p0=FA.bays.zm,slots=[];
      for(let c=2;c+3<w;c++)if(((c-p0)%4+4)%4===0)slots.push(c);slots.sort((a,b)=>Math.abs(a+1-w/2)-Math.abs(b+1-w/2));
      for(const c of slots.slice(0,RF.dormers)){const X0=cx(c)-1,X1=cx(c+2)+1,xc=(X0+X1-1)/2,yb=roofY[Math.round(xc)+X*zf];if(yb<0)continue;const yt=yb+16,hw=(X1-X0)/2;
        for(let z=zf;z<Z;z++){let done=true;for(let x=X0;x<X1;x++){const ry=roofY[x+X*z];if(ry>=yt)continue;done=false;
            for(let y=Math.max(ry-1,yb-2);y<yt;y++){const edge=x===X0||x===X1-1||z===zf;if(edge)set(x,y,z,x===X0||x===X1-1?C.timber:C.wall);else set(x,y,z,0);}}
          // the dormer's gable roof, ridge running back into the main roof
          for(let x=X0-2;x<X1+2;x++){const h=Math.round(yt+(hw+1.5-Math.abs(x+.5-xc-.5))*.95);if(h<=roofY[x+X*z])continue;set(x,h,z,Math.abs(x+.5-xc-.5)<1?M.ridge:C.tile);set(x,h-1,z,C.tile);set(x,h-2,z,M.timber_brown);}
          if(z===zf)for(let zz=zf-3;zz<zf;zz++)for(let x=X0-2;x<X1+2;x++){const h=Math.round(yt+(hw+1.5-Math.abs(x+.5-xc-.5))*.95);set(x,h,zz,C.tile);set(x,h-1,zz,C.trim);}
          if(done)break;}
        // its window: framed, glazed, with a sill
        for(let x=X0+3;x<X1-3;x++)for(let y=yb+3;y<yt-2;y++){const u=x-X0-3,v=y-yb-3,fr=x===X0+3||x===X1-4||y===yb+3||y===yt-3;set(x,y,zf,fr?C.trim:(u===Math.floor((X1-X0-6)/2)||v===5)?M.timber_dark:FA.lattice?M.shoji:M.glass);}
        for(let x=X0+2;x<X1-2;x++)set(x,yb+2,zf-1,C.trim);}}

    // A corner turret: a round tower standing mostly outside a free front corner, open inside as an alcove of the
    // corner room, with floor bands, a window per floor, and a steep cone with a finial above the eaves.
    if(TU){const R=TU.r,cxT=TU.side==='xm'?MX-R*.35:MX+w*CV+R*.35,czT=cz(front)-R*.35,topWall=plate+TU.rise,dist=(x,z)=>Math.hypot(x+.5-cxT,z+.5-czT);
      const ang0=Math.atan2(-1,TU.side==='xm'?-1:1); // facing out across the street corner
      for(let z=Math.floor(czT-R-4);z<czT+R+4;z++)for(let x=Math.floor(cxT-R-4);x<cxT+R+4;x++){const dd=dist(x,z),inBldg=mask(0,Math.floor((x-MX)/CV),Math.floor((z-MZ)/CV));
        if(dd<R){for(let y=Y0;y<topWall;y++){const f=Math.min(storeys-1,Math.max(0,Math.floor((y-Y0-PLINTH)/SH))),v=y-FL(f);
            if(dd>=R-3){// the ring wall
              let m=y<FL(0)+(FA.groundBoards?6:9)?C.base:(v<0||v>=SH-3)&&y<plate?C.timber:y>=topWall-3?C.timber:C.wall;
              const a=Math.atan2(z+.5-czT,x+.5-cxT),da=Math.abs(((a-ang0+Math.PI*3)%(Math.PI*2))-Math.PI),da2=Math.abs(((a-ang0-.9*(TU.side==='xm'?-1:1)+Math.PI*3)%(Math.PI*2))-Math.PI);
              const win=(y<plate&&f>0&&v>=SILL&&v<HEAD&&(da<.2||da2<.18))||(y>=plate+4&&y<topWall-6&&da<.16);
              if(win)m=dd<R-1.5?(FA.lattice?M.shoji:M.glass):(dd>=R-1?C.trim:0);
              if(win&&dd>=R-1&&!(v===SILL||v===HEAD-1||y===plate+4||y===topWall-7)&&!(da<.2&&(da>.17)))m=0;
              set(x,y,z,m);}
            else if(!inBldg||y>=plate){// inside the tower: floors at each level, air elsewhere
              const lvl=y<FL(0)?'plinth':null;set(x,y,z,lvl?C.base:(y-Y0-PLINTH)%SH===SH-1&&y<plate+SH?M.plank:0);}
            else{// where the tower overlaps the house corner, open the corner into the room (keep the floor slabs)
              const v2=((y-Y0-PLINTH)%SH+SH)%SH;if(y>=FL(0)&&v2<SH-SLAB)set(x,y,z,0);}}}
        // the cone roof, overhanging 3 voxels
        if(dd<R+3){const h=Math.round(topWall+(R+3-dd)*1.75);for(let k=0;k<3;k++)set(x,h-k,z,k===0&&(Math.floor(Math.atan2(z-czT,x-cxT)*8/Math.PI)&1)?C.tileDk:C.tile);if(dd>=R+1)set(x,h-3,z,C.trim);}}
      const apex=Math.round(topWall+(R+3)*1.75);for(let y=apex;y<apex+7;y++)set(Math.round(cxT),y,Math.round(czT),y>apex+4?M.gold:M.iron);}

    // Chimney over the kitchen's back wall: brick with a stone cap and a pot.
    const kitchenFloor=plan.floors.findIndex(F=>F.rooms.some(r=>r.type==='kitchen'));
    if(kitchenFloor>=0){const F=plan.floors[kitchenFloor],k=F.rooms.findIndex(r=>r.type==='kitchen'),cells=[];for(let i=0;i<w*d;i++)if(F.grid[i]===k)cells.push(i);
      const c=cells.sort((a,b)=>Math.floor(b/w)-Math.floor(a/w)||((a%w)-(b%w)))[0],x=c%w,z=Math.floor(c/w),bx=cx(x)+1,bz=cz(z)+(mask(kitchenFloor,x,z+1)?1:-2);
      let peak=0;for(let zz=bz;zz<bz+9;zz++)for(let xx=bx;xx<bx+9;xx++)peak=Math.max(peak,roofY[xx+X*zz]);
      for(let yy=FL(kitchenFloor);yy<peak+12;yy++)for(let zz=bz;zz<bz+9;zz++)for(let xx=bx;xx<bx+9;xx++){const edge=xx===bx||xx===bx+8||zz===bz||zz===bz+8;if(!edge&&yy>peak)continue;
        set(xx,yy,zz,(yy%3===2)||((xx+zz+(yy/3|0)*2)%5===0)?M.brick_dark:M.brick);}
      box(bx-1,peak+12,bz-1,bx+10,peak+14,bz+10,M.stone_grey);for(let yy=peak+14;yy<peak+18;yy++)for(let zz=bz+3;zz<bz+6;zz++)for(let xx=bx+3;xx<bx+6;xx++)if(xx!==bx+4||zz!==bz+4)set(xx,yy,zz,M.terracotta);}

    // Furniture.
    furnish(plan,{vol,X,Y,Z,at,set,cx,cz,FL,mask,r,info,M});

    info.ms=Date.now()-t0;let solid=0;for(let i=0;i<vol.length;i++)if(vol[i])solid++;
    return {revision:REVISION,cell:V,dims:[X,Y,Z],origin:[MX,Y0,MZ],levels:Array.from({length:storeys+1},(_,f)=>FL(f)),plate,vol,palette:palette(),info,solid,materials:MATS.map(m=>m[0]),M};
  }

  // Greedy rectangle decomposition of a footprint mask (largest rectangles first).
  function decompose(mask,w,d){const left=Uint8Array.from(mask),out=[];
    while(true){let best=null;for(let z0=0;z0<d;z0++)for(let x0=0;x0<w;x0++){if(!left[x0+w*z0])continue;let xmax=w;
      for(let z1=z0;z1<d&&left[x0+w*z1];z1++){let x1=x0;while(x1+1<xmax&&left[x1+1+w*z1])x1++;xmax=x1+1;const a=(x1-x0+1)*(z1-z0+1);if(!best||a>best.a)best={a,r:[x0,z0,x1,z1]};}}
      if(!best||best.a<4)break;const [x0,z0,x1,z1]=best.r;for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)left[x+w*z]=0;out.push(best.r);}
    return out;}

  // --- Furniture --------------------------------------------------------------------------------------------------
  // Rooms are rectangles. Each room type has an ordered list of wants, each placed by an anchor rule into a per-floor
  // occupancy map where 1 is a piece's footprint and 2 is reserved walking space (in front of each piece, at every
  // door, at the stair's foot and head). A footprint may not touch either. A piece's walking space may overlap other
  // walking space (rooms share walkways) but never a footprint. Backs go against solid wall, tall pieces never across
  // a window. After each piece, every door of the room must still reach every other door on foot.
  //
  // Anchors: wall (back to a wall), corner (back to a wall, tucked to its end), centre (a table with its chairs, as one
  // group), front (in the walking space in front of the previous piece, e.g. a coffee table before a sofa), tuck (a
  // chair pulled up to the previous desk), beside (next to the previous piece, same wall), onTop (on the previous
  // table or cabinet), high (wall shelf at 1.4 m), rug (under the previous group).
  // Options: c clearance in voxels (default 10), long (prefer the longest wall), far (away from doors), window
  // (prefer a window behind), street (face the street), run (continue the previous piece's wall run), chairs, n.
  const WANTS={
    bed:[['wall','bed_double_A',{long:true,far:true,c:10}],['beside','cabinet_small',{c:6}],['onTop','lamp_table'],['rug','rug_oval_A'],['wall','cabinet_medium_decorated',{c:8}],['high','shelf_B_small_decorated'],['corner','cactus_medium_A',{c:4}]],
    guest:[['wall','bed_single_A',{far:true,c:10}],['beside','cabinet_small',{c:6}],['onTop','lamp_table'],['wall','table_small',{window:true,c:4}],['tuck','chair_A_wood'],['corner','lamp_standing',{c:4}]],
    living:[['wall','couch_pillows',{long:true,c:22}],['front','table_low',{gap:6}],['rug','rug_rectangle_A'],['corner','armchair_pillows',{c:8}],['wall','cabinet_medium_decorated',{c:8}],['wall','table_small',{c:6}],['onTop','lamp_table'],['corner','lamp_standing',{c:4}],['corner','cactus_medium_A',{c:4}],['high','shelf_B_large_decorated']],
    common:[['wall','kitchencounter_straight_A_decorated',{c:14,far:true}],['beside','kitchencounter_straight_A',{c:14}],['beside','kitchencounter_straight_A',{c:14}],['centre','table_round_A_decorated',{chairs:'chair_B',n:4}],['centre','table_medium_long',{chairs:'chair_A_wood',n:6}],['centre','table_round_A_decorated',{chairs:'chair_B',n:4}],['centre','table_round_A_decorated',{chairs:'chair_B',n:3}],['high','shelf_B_large_decorated'],['corner','crate_potatoes',{c:4}],['corner','jar_C_large',{c:4}],['corner','cactus_medium_A',{c:4}]],
    dining:[['centre','table_medium_long|table_medium|table_round_A_decorated',{chairs:'chair_A_wood',n:6}],['rug','rug_rectangle_A'],['wall','cabinet_medium_decorated',{c:8}],['corner','cactus_medium_A',{c:4}],['high','shelf_B_small_decorated']],
    kitchen:[['wall','kitchencounter_sink',{window:true,c:12}],['beside','stove_single',{c:12}],['beside','kitchencounter_straight_A_decorated',{c:12}],['beside','kitchencounter_straight_A',{c:12}],['wall','kitchencabinet',{c:10}],['beside','kitchencabinet',{c:10}],['centre','table_medium_long|table_medium',{chairs:'chair_A_wood',n:6,minArea:16}],['centre','kitchentable_A_large_decorated',{chairs:'chair_stool_wood',n:2}],['onTop','pot_large'],['rug','rug_rectangle_A'],['corner','crate_carrots',{c:4}],['corner','jar_C_large',{c:4}],['high','shelf_B_small_decorated']],
    shop:[['wall','kitchencounter_straight_A',{street:true,c:12}],['beside','kitchencounter_straight_A_decorated',{c:12}],['wall','cabinet_medium_decorated',{c:10}],['wall','cabinet_medium_decorated',{c:10}],['centre','table_medium',{n:0}],['onTop','jar_C_large'],['corner','crate_tomatoes',{c:4}],['corner','crate_carrots',{c:4}],['corner','crate_potatoes',{c:4}],['high','shelf_B_large_decorated']],
    workshop:[['wall','kitchentable_A_large_decorated',{window:true,c:12}],['tuck','chair_stool_wood'],['wall','kitchentable_A_large_decorated',{c:12}],['wall','kitchencabinet',{c:10}],['centre','table_medium_long',{n:0}],['onTop','book_set'],['corner','crate',{c:4}],['corner','crate_potatoes',{c:4}],['corner','jar_C_large',{c:4}],['high','shelf_B_large_decorated']],
    store:[['wall','kitchencabinet',{c:8}],['beside','kitchencabinet',{c:8}],['corner','crate',{c:2}],['onTop','crate_potatoes'],['corner','crate_carrots',{c:2}],['corner','crate',{c:2}],['onTop','crate_tomatoes'],['corner','jar_C_large',{c:2}],['corner','jar_C_large',{c:2}],['high','shelf_B_small_decorated']],
    study:[['wall','table_medium',{window:true,c:4}],['tuck','chair_A_wood'],['onTop','book_set'],['rug','rug_rectangle_stripes_A'],['wall','cabinet_medium_decorated',{c:8}],['corner','armchair_pillows',{c:8}],['corner','lamp_standing',{c:4}],['high','shelf_B_large_decorated'],['corner','cactus_medium_A',{c:4}]],
    office:[['wall','table_medium',{window:true,c:4}],['tuck','chair_A_wood'],['onTop','book_set'],['wall','cabinet_medium_decorated',{c:8}],['corner','crate',{c:4}],['high','shelf_B_large_decorated']],
    bath:[['wall','tub',{long:true,c:8}],['beside','chair_stool_wood',{c:4}],['corner','jar_C_large',{c:2}]],
    hall:[['corner','cactus_medium_A',{c:2,max:1}]]
  };
  // The kit has no bath, so the tub is a voxel piece built here: a wooden tub of steaming water.
  pieces.tub=(()=>{const X=22,Y=10,Z=14,v=new Uint8Array(X*Y*Z);for(let y=0;y<Y;y++)for(let z=0;z<Z;z++)for(let x=0;x<X;x++){const ex=Math.min(x,X-1-x),ez=Math.min(z,Z-1-z),wall=ex<2||ez<2,corner=ex+ez<3;
    if(corner)continue;v[x+X*(z+Z*y)]=wall||y===0?((x+z)%4?M.timber_honey:M.timber_brown):y<Y-2?M.water:0;}return {id:'tub',dims:[X,Y,Z],tags:['wall'],v};})();
  function rotated(p,face){const [X,Y,Z]=p.dims,sw=face==='xp'||face==='xm';return {w:sw?Z:X,d:sw?X:Z,h:Y,
    get:(x,y,z)=>{let lx,lz;if(face==='zp'){lx=x;lz=z;}else if(face==='zm'){lx=X-1-x;lz=Z-1-z;}else if(face==='xp'){lx=X-1-z;lz=x;}else{lx=z;lz=Z-1-x;}return p.v[lx+X*(lz+Z*y)];}};}
  const FACES=['zp','zm','xp','xm'],OPP={zp:'zm',zm:'zp',xp:'xm',xm:'xp'};
  function furnish(plan,ctx){
    const {at,set,cx,cz,FL,r,info,X,Z}=ctx,{w,d}=plan.plot;
    for(let f=0;f<plan.floors.length;f++){const F=plan.floors[f],y=FL(f);
      // Floor map: walkable columns (floor below, air to head height) and the room each belongs to.
      const roomOf=new Int16Array(X*Z).fill(-1),floor=new Uint8Array(X*Z),occ=new Uint8Array(X*Z);
      for(let z=0;z<d;z++)for(let x=0;x<w;x++){const k=F.grid[x+w*z];if(k<1)continue;for(let a=0;a<8;a++)for(let b=0;b<8;b++){const X_=cx(x)+a,Z_=cz(z)+b,i=X_+X*Z_;roomOf[i]=k;
        let clear=at(X_,y-1,Z_)!==0;for(let yy=y;yy<y+28&&clear;yy+=3)if(at(X_,yy,Z_))clear=false;floor[i]=clear?1:0;}}
      const inside=(x,z)=>x>=0&&z>=0&&x<X&&z<Z;
      const reserve=(x0,z0,x1,z1,k)=>{for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++)if(inside(x,z)&&(k===undefined||roomOf[x+X*z]===k)&&!occ[x+X*z])occ[x+X*z]=2;};
      // Door and stair zones: a 1 m square of walking space inside each side of every door, opening and flight end.
      const doorPts=new Map(),addPt=(k,x,z)=>{if(!doorPts.has(k))doorPts.set(k,[]);doorPts.get(k).push([x,z]);};
      const zone=(cells,dir,both)=>{const [dx,dz]={xm:[-1,0],xp:[1,0],zm:[0,-1],zp:[0,1]}[dir],xs=cells.map(c=>c[0]),zs=cells.map(c=>c[1]);
        const X0=cx(Math.min(...xs)),X1=cx(Math.max(...xs)+1),Z0=cz(Math.min(...zs)),Z1=cz(Math.max(...zs)+1);
        for(const side of both?[0,1]:[0]){const k=F.grid[(Math.min(...xs)+(side?dx:0))+w*(Math.min(...zs)+(side?dz:0))];if(k<1)continue;
          // side 0 is the door cells' own room (zone ends at the wall); side 1 is the room past the wall
          const a0=dx?(side?(dx>0?X1:X0-16):(dx>0?X1-16:X0)):X0,a1=dx?a0+16:X1,b0=dz?(side?(dz>0?Z1:Z0-16):(dz>0?Z1-16:Z0)):Z0,b1=dz?b0+16:Z1;
          reserve(a0,b0,a1,b1,k);addPt(k,(a0+a1)>>1,(b0+b1)>>1);}};
      for(const dr of F.doors)zone(dr.cells,dr.dir,true);
      for(const o of F.openings)if(o.kind==='front'||o.kind==='back'||o.kind==='balcony')zone(o.cells,o.side,false);
      // Reachability: every door point of room k can reach the others through columns that are not footprints.
      const reach=k=>{const pts=doorPts.get(k)||[];if(pts.length<2)return true;const S=2,seen=new Uint8Array(X*Z),q=[];
        const ok=(x,z)=>{for(let a=-2;a<=2;a+=2)for(let b=-2;b<=2;b+=2){const i=x+a+X*(z+b);if(!inside(x+a,z+b)||roomOf[i]!==k||!floor[i]&&!occ[i]||occ[i]===1)return false;}return true;};
        const start=pts[0];let s0=null;for(let a=-4;a<=4&&!s0;a++)for(let b=-4;b<=4&&!s0;b++)if(ok(start[0]+a,start[1]+b))s0=[start[0]+a,start[1]+b];if(!s0)return false;
        q.push(s0);seen[s0[0]+X*s0[1]]=1;while(q.length){const [x,z]=q.pop();for(const [a,b] of [[S,0],[-S,0],[0,S],[0,-S]]){const nx=x+a,nz=z+b,i=nx+X*nz;if(!inside(nx,nz)||seen[i]||!ok(nx,nz))continue;seen[i]=1;q.push([nx,nz]);}}
        return pts.every(([px,pz])=>{for(let a=-5;a<=5;a++)for(let b=-5;b<=5;b++)if(inside(px+a,pz+b)&&seen[px+a+X*(pz+b)])return true;return false;});};
      F.rooms.forEach((room,k)=>{const wants=WANTS[room.type];if(!wants||k<1||!room.box)return;
        // Interior rectangle: the walkable columns of this room.
        let rx0=X,rz0=Z,rx1=0,rz1=0;for(let z=cz(room.box[1]);z<cz(room.box[3]+1);z++)for(let x=cx(room.box[0]);x<cx(room.box[2]+1);x++){const i=x+X*z;if(roomOf[i]===k&&floor[i]){rx0=Math.min(rx0,x);rz0=Math.min(rz0,z);rx1=Math.max(rx1,x+1);rz1=Math.max(rz1,z+1);}}
        if(rx1<=rx0)return;const placed=[],mx=(rx0+rx1)/2,mz=(rz0+rz1)/2,doors=doorPts.get(k)||[];
        const fits=(x0,z0,pw,pd,need=1)=>{for(let z=z0;z<z0+pd;z++)for(let x=x0;x<x0+pw;x++){const i=x+X*z;if(!inside(x,z)||roomOf[i]!==k||!floor[i]||occ[i]>=need)return false;}return true;};
        const clearOk=(x0,z0,pw,pd)=>{for(let z=z0;z<z0+pd;z++)for(let x=x0;x<x0+pw;x++){const i=x+X*z;if(!inside(x,z)||roomOf[i]!==k||!floor[i]||occ[i]===1)return false;}return true;};
        // The rectangle in front of a piece facing `face`, c voxels deep.
        const frontRect=(x0,z0,pw,pd,face,c)=>face==='zp'?[x0,z0+pd,pw,c]:face==='zm'?[x0,z0-c,pw,c]:face==='xp'?[x0+pw,z0,c,pd]:[x0-c,z0,c,pd];
        const stamp=(p,face,x0,z0,y0,mark=true)=>{const R=rotated(p,face);for(let yy=0;yy<R.h;yy++)for(let zz=0;zz<R.d;zz++)for(let xx=0;xx<R.w;xx++){const v=R.get(xx,yy,zz);if(v&&!at(x0+xx,y0+yy,z0+zz))set(x0+xx,y0+yy,z0+zz,v);}
          if(mark)for(let zz=0;zz<R.d;zz++)for(let xx=0;xx<R.w;xx++)occ[x0+xx+X*(z0+zz)]=1;const rec={floor:f,room:k,piece:p.id,face,x:x0,z:z0,y:y0,w:R.w,d:R.d,h:R.h};placed.push(rec);info.furniture.push(rec);return rec;};
        // Try a floor piece: footprint free, walking space clear, then the room must stay walkable.
        const tryPut=(p,face,x0,z0,c,extra,inWalk)=>{const R=rotated(p,face);if(!fits(x0,z0,R.w,R.d,inWalk?3:1))return null;const fr=frontRect(x0,z0,R.w,R.d,face,c);if(c&&!clearOk(...fr))return null;
          if(extra&&!extra(R))return null;const saved=[];for(let zz=0;zz<R.d;zz++)for(let xx=0;xx<R.w;xx++){const i=x0+xx+X*(z0+zz);saved.push([i,occ[i]]);occ[i]=1;}
          if(!reach(k)){for(const [i,v] of saved)occ[i]=v;return null;}for(const [i,v] of saved)occ[i]=v;
          const rec=stamp(p,face,x0,z0,y);if(c)reserve(fr[0],fr[1],fr[0]+fr[2],fr[1]+fr[3],k);return rec;};
        // Wall slots for a piece facing `face`: its back touches the room edge, so the wall is right behind it.
        const wallSlots=(R,face)=>{const out=[];
          if(face==='zp'||face==='zm'){const z0=face==='zp'?rz0:rz1-R.d,bz=face==='zp'?rz0-1:rz1;for(let x=rx0;x+R.w<=rx1;x++)out.push([x,z0,bz,'x']);}
          else{const x0=face==='xp'?rx0:rx1-R.w,bx=face==='xp'?rx0-1:rx1;for(let z=rz0;z+R.d<=rz1;z++)out.push([x0,z,bx,'z']);}return out;};
        const solidBehind=(x0,z0,R,face,b,axis)=>{const tall=R.h>15,ys=[y+3,y+Math.min(R.h,30)-1];const n=axis==='x'?R.w:R.d;
          for(let t=0;t<n;t++){const [bx,bz]=axis==='x'?[x0+t,b]:[b,z0+t];for(const yy of tall?ys:[y+3])if(!at(bx,yy,bz))return false;}return true;};
        const windowBehind=(x0,z0,R,b,axis)=>{const n=axis==='x'?R.w:R.d,[bx,bz]=axis==='x'?[x0+(n>>1),b]:[b,z0+(n>>1)];for(let t=1;t<4;t++){const m=at(axis==='x'?bx:bx+(b<(axis==='x'?z0:x0)?-t:t),y+24,axis==='x'?bz+(b<z0?-t:t):bz);if(m===ctx.M.glass||m===ctx.M.shoji||m===0)return true;}return false;};
        const distDoor=(x,z)=>doors.length?Math.min(...doors.map(([px,pz])=>Math.hypot(px-x,pz-z))):99;
        let last=null,main=null;const count={};
        const area=(rx1-rx0)*(rz1-rz0)*V*V;
        for(const [anchor,ids,o={}] of wants){if(o.minArea&&area<o.minArea)continue;const alts=ids.split('|');let id=alts[0],p=piece(id),c=o.c??10,rec=null;if(o.max&&(count[id]||0)>=o.max)continue;
          if(anchor==='onTop'){if(!last)continue;const host=last,R=rotated(p,host.face);if(R.w>host.w||R.d>host.d)continue;const x0=host.x+((host.w-R.w)>>1),z0=host.z+((host.d-R.d)>>1);let top=host.y;
            for(let yy=host.y;yy<host.y+host.h+1;yy++)if(at(x0+(R.w>>1),yy,z0+(R.d>>1)))top=yy+1;rec=stamp(p,host.face,x0,z0,top,false);count[id]=(count[id]||0)+1;continue;}
          if(anchor==='rug'){const m=main;if(!m)continue;const host=m.group||(last?.main===m?last:null)||(()=>{const fr=frontRect(m.x,m.z,m.w,m.d,m.face,14);return {x:fr[0],z:fr[1],w:fr[2],d:fr[3]};})();const R=rotated(p,'zp');const cxh=host.x+host.w/2,czh=host.z+host.d/2,x0=Math.round(cxh-R.w/2),z0=Math.round(czh-R.d/2);
            let ok=true;for(let z=z0;z<z0+R.d&&ok;z++)for(let x=x0;x<x0+R.w;x++)if(!inside(x,z)||roomOf[x+X*z]!==k||!floor[x+X*z]&&occ[x+X*z]!==1){ok=false;break;}if(ok)stamp(p,'zp',x0,z0,y,false);continue;}
          if(anchor==='high'){const R0=rotated(p,'zp');let best=null;
            for(const face of FACES){const R=rotated(p,face);for(const [x0,z0,b,axis] of wallSlots(R,face)){const hy=y+22;let ok=true;const n=axis==='x'?R.w:R.d;
              for(let t=0;t<n&&ok;t++){const [bx,bz]=axis==='x'?[x0+t,b]:[b,z0+t];for(let yy=hy;yy<hy+R.h;yy++)if(!at(bx,yy,bz)){ok=false;break;}}
              for(let zz=0;zz<R.d&&ok;zz++)for(let xx=0;xx<R.w&&ok;xx++)for(let yy=hy-2;yy<hy+R.h;yy++)if(at(x0+xx,yy,z0+zz)){ok=false;break;}
              if(!ok)continue;const s=Math.abs((axis==='x'?x0+R.w/2-mx:z0+R.d/2-mz))+r()*4;if(!best||s<best.s)best={s,face,x0,z0};}}
            if(best){stamp(p,best.face,best.x0,best.z0,y+22,false);}void R0;continue;}
          if(anchor==='beside'||anchor==='tuck'||anchor==='front'){if(!last||last.group)continue;const L=last;let cand=[];
            if(anchor==='beside'){const R=rotated(p,L.face),gap=1;
              if(L.face==='zp'||L.face==='zm'){const z0=L.face==='zp'?L.z:L.z+L.d-R.d;cand=[[L.x+L.w+gap,z0,L.face],[L.x-R.w-gap,z0,L.face]];}
              else{const x0=L.face==='xp'?L.x:L.x+L.w-R.w;cand=[[x0,L.z+L.d+gap,L.face],[x0,L.z-R.d-gap,L.face]];}}
            else{const face=anchor==='tuck'?OPP[L.face]:L.face,R=rotated(p,face),g=anchor==='tuck'?-Math.round(R.d/3):(o.gap??6);
              if(L.face==='zp')cand=[[L.x+((L.w-R.w)>>1),L.z+L.d+g,face]];else if(L.face==='zm')cand=[[L.x+((L.w-R.w)>>1),L.z-R.d-g,face]];
              else if(L.face==='xp')cand=[[L.x+L.w+g,L.z+((L.d-R.d)>>1),face]];else cand=[[L.x-R.w-g,L.z+((L.d-R.d)>>1),face]];}
            for(const [x0,z0,face] of cand){if(anchor==='tuck'){// a chair may slide under its desk: only its outer part needs free floor
                const R=rotated(p,face);let ok=true;for(let zz=0;zz<R.d&&ok;zz++)for(let xx=0;xx<R.w;xx++){const i=x0+xx+X*(z0+zz);if(!inside(x0+xx,z0+zz)||roomOf[i]!==k){ok=false;break;}}
                if(ok){rec=stamp(p,face,x0,z0,y,false);break;}continue;}
              rec=tryPut(p,face,x0,z0,anchor==='front'?0:c,null,anchor==='front');if(rec)break;}
            if(rec&&anchor==='beside')last=rec;if(rec&&anchor==='front'){rec.main=main;last=rec;}if(rec)count[id]=(count[id]||0)+1;continue;}
          if(anchor==='centre'){// table + chairs as one group, nearest the room's middle with a 0.6 m walkway round it
            const ch=o.chairs?piece(o.chairs):null,ring=ch?Math.max(ch.dims[0],ch.dims[2])+2:0,pad=ring+4;let best=null;
            for(const alt of alts){if(best)break;p=piece(alt);id=alt;for(const face of ['zp','xp']){const R=rotated(p,face);for(let z0=rz0+pad;z0+R.d+pad<=rz1;z0+=2)for(let x0=rx0+pad;x0+R.w+pad<=rx1;x0+=2){
              if(!fits(x0-ring,z0-ring,R.w+2*ring,R.d+2*ring))continue;if(!clearOk(x0-pad,z0-pad,R.w+2*pad,R.d+2*pad))continue;
              const s=Math.hypot(x0+R.w/2-mx,z0+R.d/2-mz)+r()*3;if(!best||s<best.s)best={s,face,x0,z0,R};}}}
            if(!best)continue;const {face,x0,z0,R}=best;const t=tryPut(p,face,x0,z0,0);if(!t)continue;
            if(ch){const n=o.n??4,seats=[];const long=R.w>=R.d;
              // seats along the long sides first, then the ends
              const sides=long?[['zm',0,1],['zp',0,-1],['xm',1,0],['xp',-1,0]]:[['xm',1,0],['xp',-1,0],['zm',0,1],['zp',0,-1]];
              for(const [cf] of sides){const C=rotated(ch,cf),along=cf[0]==='z'?R.w:R.d,per=along>=C.w*2+10&&n>=4?2:1;
                for(let q=0;q<per;q++){const off=per===2?(q?.72:.28):.5;let x,z;
                  if(cf==='zm'){x=Math.round(x0+R.w*off-C.w/2);z=z0+R.d+1;}else if(cf==='zp'){x=Math.round(x0+R.w*off-C.w/2);z=z0-C.d-1;}
                  else if(cf==='xm'){x=x0+R.w+1;z=Math.round(z0+R.d*off-C.d/2);}else{x=x0-C.w-1;z=Math.round(z0+R.d*off-C.d/2);}seats.push([cf,x,z]);}}
              let put=0;for(const [cf,x,z] of seats){if(put>=n)break;const C=rotated(ch,cf);if(fits(x,z,C.w,C.d,1)){stamp(ch,cf,x,z,y);put++;}}}
            reserve(x0-pad,z0-pad,x0+R.w+pad,z0+R.d+pad,k);
            rec=t;rec.group={x:x0-ring,z:z0-ring,w:R.w+2*ring,d:R.d+2*ring};last=main=rec;count[id]=(count[id]||0)+1;continue;}
          // wall and corner: score every slot on every wall.
          const cands=[];
          for(const face of FACES){const R=rotated(p,face),slots=wallSlots(R,face),wallLen=face[0]==='z'?rx1-rx0:rz1-rz0;
            for(const [x0,z0,b,axis] of slots){if(!fits(x0,z0,R.w,R.d))continue;if(!solidBehind(x0,z0,R,face,b,axis))continue;
              const along=axis==='x'?x0+R.w/2:z0+R.d/2,lo=axis==='x'?rx0:rz0,hi=axis==='x'?rx1:rz1,toEnd=Math.min(along-lo,hi-along)-(axis==='x'?R.w:R.d)/2;
              let s=r()*3;
              if(anchor==='corner')s+=toEnd*3;else s+=Math.abs(along-(lo+hi)/2)*.5;
              if(o.long)s-=wallLen*.8;if(o.far)s-=Math.min(60,distDoor(x0+R.w/2,z0+R.d/2))*.6;
              if(o.window&&windowBehind(x0,z0,R,b,axis))s-=40;if(o.street)s+=face==='zm'?-60:face[0]==='x'?0:40;
              cands.push({face,x0,z0,s});}}
          cands.sort((a,b)=>a.s-b.s);
          for(const cd of cands.slice(0,80)){rec=tryPut(p,cd.face,cd.x0,cd.z0,c);if(rec)break;}
          if(rec){last=rec;if(anchor==='wall')main=rec;count[id]=(count[id]||0)+1;}}
        info.rooms.push({floor:f,room:k,type:room.type,pieces:placed.length,reachable:reach(k)});});
    }
  }

  const api={V,CV,SH,SLAB,PLINTH,REVISION,MATS,M,WANTS,palette,piece,rotated,build,decompose};
  if(isNode)module.exports=api;else root.BuildingVoxels=api;
})(typeof globalThis==='object'?globalThis:this);
