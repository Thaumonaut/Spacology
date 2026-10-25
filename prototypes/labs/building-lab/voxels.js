(function(root){
  'use strict';
  // Voxel builder: turns a plan (plan.js) into a 6.25 cm material volume. Walls follow room edges, openings follow
  // the plan's doors and windows, the roof is a height field over the top floor's footprint, and furniture is
  // stamped from the voxelised KayKit pieces (kit-pieces.js) by room rules. Pure and seeded, like the planner.
  const isNode=typeof module==='object'&&module.exports;
  const Plan=isNode?require('./plan.js'):root.BuildingPlan,KIT=isNode?require('./kit-pieces.js'):root.BuildingKitPieces;
  const V=0.0625,CV=8,SH=48,SLAB=3,PLINTH=4,GROUND=3,REVISION='building-voxels-1';
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
    ['flower_pink',0xf08cb4],['flower_yellow',0xf5d34d],['flower_white',0xfaf6ee],['iron',0x3b3b40],['water',0x6fb3d6],['sign',0x6b4528],['sign_ink',0xf1e6cf],['soot',0x2a2626]
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
    const t0=Date.now(),src=Plan.STYLES[plan.style],style={...src,wall:M[src.wall],timber:M[src.timber],base:M[src.base],trim:M[src.trim]},{w,d,front,party}=plan.plot,storeys=plan.floors.length,r=Plan.rng(Plan.hash('voxels:'+plan.seed));
    const eave=style.eave*4,margin=eave+24,MX=margin,MZ=margin+24,X=2*margin+w*CV,Z=MZ+d*CV+margin,roofRise=Math.ceil(style.pitch*(Math.max(w,d)*CV/2+eave)*(1+style.curve*.1))+24;
    const Y0=GROUND,FL=f=>Y0+PLINTH+f*SH,plate=FL(storeys),Y=plate+roofRise+24,vol=new Uint8Array(X*Y*Z);
    const at=(x,y,z)=>x<0||y<0||z<0||x>=X||y>=Y||z>=Z?0:vol[x+X*(z+Z*y)];
    const set=(x,y,z,m)=>{if(x>=0&&y>=0&&z>=0&&x<X&&y<Y&&z<Z)vol[x+X*(z+Z*y)]=m;};
    const box=(x0,y0,z0,x1,y1,z1,m)=>{for(let y=Math.max(0,y0);y<Math.min(Y,y1);y++)for(let z=Math.max(0,z0);z<Math.min(Z,z1);z++)vol.fill(m,X*(z+Z*y)+Math.max(0,x0),X*(z+Z*y)+Math.min(X,x1));};
    const fillIfAir=(x,y,z,m)=>{if(!at(x,y,z))set(x,y,z,m);};
    const cx=x=>MX+x*CV,cz=z=>MZ+z*CV,mask=(f,x,z)=>x>=0&&z>=0&&x<w&&z<d&&plan.plot.masks[f][x+w*z]===1;
    const info={furniture:[],rooms:[],lights:[]};

    // Ground: a cobbled street in front, packed earth and grass behind and in any yard.
    for(let z=0;z<Z;z++)for(let x=0;x<X;x++){const street=z<MZ+front*CV,yard=!street&&!mask(0,Math.floor((x-MX)/CV),Math.floor((z-MZ)/CV));
      for(let y=0;y<Y0;y++)set(x,y,z,y<Y0-1?M.earth:street?(((x>>2)+(z>>2)*3)%5===0||((x+z*7)%11===0)?M.cobble_dark:M.cobble):yard?((x*31+z*17)%13===0?M.grass_dark:M.grass):M.earth);}
    // Stepping stones from the street to a yard door are added with the back door below.

    // Floors: stone plinth under the ground floor, timber slabs above; stair voids stay open.
    const roomAt=(f,x,z)=>{if(!mask(f,x,z))return null;const k=plan.floors[f].grid[x+w*z];return k>=0?plan.floors[f].rooms[k]:null;};
    const floorMat=(room,x,z,tx,tz)=>{const t=room.type;
      if(t==='kitchen'||t==='bath'||t==='store'||(t==='workshop'))return (((tx>>3)+(tz>>3))&1)?M.floor_stone:M.floor_stone_dark;
      if((style.lattice)&&(t==='bed'||t==='guest'||t==='living'||t==='study')){const u=(tx%24+24)%24,v=(tz%12+12)%12;return u===0||v===0?M.tatami_edge:M.tatami;}
      return ((tz>>1)%2===0&&(tx%16===0))||((tx>>2)&1)?M.plank:M.plank_dark;};
    for(let f=0;f<storeys;f++){const F=plan.floors[f],voids=new Set(F.voids),yTop=FL(f);
      for(let z=0;z<d;z++)for(let x=0;x<w;x++){if(!mask(f,x,z)||voids.has(x+w*z))continue;const room=roomAt(f,x,z);
        if(f===0)box(cx(x),Y0,cz(z),cx(x)+CV,yTop-1,cz(z)+CV,style.base);else box(cx(x),yTop-SLAB,cz(z),cx(x)+CV,yTop-1,cz(z)+CV,M.timber_brown);
        for(let a=0;a<CV;a++)for(let b=0;b<CV;b++)set(cx(x)+a,yTop-1,cz(z)+b,room?floorMat(room,x,z,x*CV+a,z*CV+b):M.plank);}}

    // Walls. Exterior walls sit in the outer 3 voxels of edge cells; interior walls straddle the room boundary.
    // The exterior face carries the style: posts, floor beams, base course, half-timber braces.
    const DIRS=[['xm',-1,0],['xp',1,0],['zm',0,-1],['zp',0,1]],sideOf=Object.fromEntries(DIRS.map(([s,dx,dz])=>[s,[dx,dz]]));
    const isParty=(s,x)=>(s==='xm'&&x===0&&party[0])||(s==='xp'&&x===w-1&&party[1]);
    const extWall=[]; // [f] -> Set of "X,Z" wall columns, for the roof's gable fill
    const facade=(f,s,u,v,depth,party)=>{
      if(depth>0)return M.plaster_inside;
      if(party)return v>=SH-3||v<0?style.timber:f===0&&v<8?style.base:style.wall; // a neighbour will stand against it
      if(v<0||v>=SH-3)return style.timber;                                   // floor beam band
      if(f===0&&v<8)return ((u>>2)+(v>>2))%2?style.base:dark(style.base);     // base course
      if(f===0&&style.lattice&&v<14)return (u%3===0)?M.timber_dark:style.timber;   // machiya lower boards
      const spacing=style.halfTimber||style.lattice?16:32,post=((u%spacing)+spacing)%spacing<2;
      if(post)return style.timber;
      if(style.halfTimber&&f>0){const p=((u%16)+16)%16,diag=Math.abs(((Math.floor(u/16)&1)?p:15-p)-v*15/(SH-4));if(diag<1.2)return style.timber;}
      if(v===SILL-1&&!style.halfTimber)return style.trim;
      return style.wall;};
    for(let f=0;f<storeys;f++){const y0=FL(f)-(f===0?PLINTH:SLAB),y1=FL(f+1)-(f+1<storeys?0:0),cols=new Set();extWall.push(cols);
      for(let z=0;z<d;z++)for(let x=0;x<w;x++){if(!mask(f,x,z))continue;
        for(const [s,dx,dz] of DIRS){if(mask(f,x+dx,z+dz))continue;const party_=isParty(s,x);
          const [ax0,ax1]=s==='xm'?[cx(x),cx(x)+3]:s==='xp'?[cx(x)+5,cx(x)+8]:[cx(x),cx(x)+8],[az0,az1]=s==='zm'?[cz(z),cz(z)+3]:s==='zp'?[cz(z)+5,cz(z)+8]:[cz(z),cz(z)+8];
          for(let y=y0;y<y1;y++)for(let zz=az0;zz<az1;zz++)for(let xx=ax0;xx<ax1;xx++){
            const depth=s==='xm'?xx-cx(x):s==='xp'?cx(x)+7-xx:s==='zm'?zz-cz(z):cz(z)+7-zz,u=s[0]==='x'?zz-MZ:xx-MX;
            set(xx,y,zz,facade(f,s,s==='xp'||s==='zm'?u:-u-1,y-FL(f),depth,party_));cols.add(xx+','+zz);}
          // Posts and beams stand 1 voxel proud of the plaster, so the frame reads in light and outline.
          if(!party_)for(let y=y0;y<y1;y++){const along=s[0]==='x'?[cz(z),cz(z)+8]:[cx(x),cx(x)+8];for(let a=along[0];a<along[1];a++){
            const u=a-(s[0]==='x'?MZ:MX),uu=s==='xp'||s==='zm'?u:-u-1,m=facade(f,s,uu,y-FL(f),0,false);if(m!==style.timber)continue;
            const ox=s==='xm'?cx(x)-1:s==='xp'?cx(x)+8:a,oz=s==='zm'?cz(z)-1:s==='zp'?cz(z)+8:a;if(s[0]==='x')fillIfAir(ox,y,a,m);else fillIfAir(a,y,oz,m);}}}}
      // Interior walls between different rooms, with a post at each wall corner.
      const F=plan.floors[f],g=F.grid,yw0=FL(f),yw1=FL(f+1)-SLAB;
      const voidSet=new Set(F.voids);
      for(let z=0;z<d;z++)for(let x=0;x<w;x++){const a=g[x+w*z];if(a<0)continue;const i=x+w*z;
        if(x+1<w&&g[i+1]>=0&&g[i+1]!==a&&!voidSet.has(i)&&!voidSet.has(i+1))box(cx(x)+7,yw0,cz(z),cx(x)+9,yw1,cz(z)+8,M.plaster_inside);
        if(z+1<d&&g[i+w]>=0&&g[i+w]!==a&&!voidSet.has(i)&&!voidSet.has(i+w))box(cx(x),yw0,cz(z)+7,cx(x)+8,yw1,cz(z)+9,M.plaster_inside);}
      for(let z=1;z<d;z++)for(let x=1;x<w;x++){const q=[g[x-1+w*(z-1)],g[x+w*(z-1)],g[x-1+w*z],g[x+w*z]];if(q.some(k=>k<0))continue;if(new Set(q).size>=2&&!(q[0]===q[1]&&q[2]===q[3])&&!(q[0]===q[2]&&q[1]===q[3]))box(cx(x)-1,yw0,cz(z)-1,cx(x)+1,yw1,cz(z)+1,style.timber);}}

    // Stairs: solid timber flights, 16 risers of 3 voxels over 6 cells; a railing round each stair void.
    for(const run of plan.stair.runs){const yb=FL(run.from);
      // Steps only fill air, so a flight against an outside wall never punches through it.
      const airBox=(x0,y0,z0,x1,y1,z1,m)=>{for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++)fillIfAir(x,y,z,m);};
      for(let k=0;k<16;k++){const zz0=run.dir>0?cz(run.z)+k*3:cz(run.z)+48-(k+1)*3;airBox(cx(run.x),yb+(k+1)*3-1,zz0,cx(run.x)+16,yb+(k+1)*3,zz0+3,M.plank);
        airBox(cx(run.x),yb,zz0,cx(run.x)+16,yb+(k+1)*3-1,zz0+3,M.stair_wood);}}
    for(let f=1;f<storeys;f++){const voids=new Set(plan.floors[f].voids),yr=FL(f);
      for(const i of voids){const x=i%w,z=Math.floor(i/w);for(const [s,dx,dz] of DIRS){const n=x+dx+w*(z+dz);if(voids.has(n)||!mask(f,x+dx,z+dz))continue;
        const run=plan.stair.runs[f-1],arrival=run&&z+dz===run.top&&x+dx>=run.x&&x+dx<run.x+2;if(arrival)continue;
        const [x0,x1]=s==='xm'?[cx(x),cx(x)+1]:s==='xp'?[cx(x)+7,cx(x)+8]:[cx(x),cx(x)+8],[z0,z1]=s==='zm'?[cz(z),cz(z)+1]:s==='zp'?[cz(z)+7,cz(z)+8]:[cz(z),cz(z)+8];
        box(x0,yr+14,z0,x1,yr+16,z1,style.timber);for(let a=0;a<8;a+=4){const px=s[0]==='x'?x0:x0+a,pz=s[0]==='z'?z0:z0+a;box(px,yr,pz,px+1,yr+14,pz+1,style.timber);}}}}

    // Openings. Each is cut through its wall, then framed, glazed or hung.
    const edgeBox=(x,z,s,interior)=>{const t=interior?[7,9]:null;
      if(s==='xm')return [cx(x)-1,cx(x)+3,cz(z),cz(z)+8];if(s==='xp')return interior?[cx(x)+t[0],cx(x)+t[1],cz(z),cz(z)+8]:[cx(x)+5,cx(x)+9,cz(z),cz(z)+8];
      if(s==='zm')return [cx(x),cx(x)+8,cz(z)-1,cz(z)+3];return interior?[cx(x),cx(x)+8,cz(z)+t[0],cz(z)+t[1]]:[cx(x),cx(x)+8,cz(z)+5,cz(z)+9];};
    const span=(cells,s,interior)=>{let b=null;for(const [x,z] of cells){const e=edgeBox(x,z,s,interior);b=b?[Math.min(b[0],e[0]),Math.max(b[1],e[1]),Math.min(b[2],e[2]),Math.max(b[3],e[3])]:e;}return b;};
    const along=(b,s)=>s[0]==='x'?[b[2],b[3]]:[b[0],b[1]];
    const across=(b,s)=>s[0]==='x'?[b[0],b[1]]:[b[2],b[3]];
    const put=(s,a,c,y,m)=>s[0]==='x'?set(c,y,a,m):set(a,y,c,m);
    const cut=(b,y0,y1,inset)=>box(b[0]+(inset?.[0]||0),y0,b[2]+(inset?.[2]||0),b[1]-(inset?.[1]||0),y1,b[3]-(inset?.[3]||0),0);
    const outward=s=>({xm:[-1,0],xp:[1,0],zm:[0,-1],zp:[0,1]})[s];
    function opening(f,o,interior){
      const s=o.side||o.dir,b=span(o.cells,s,interior),[a0,a1]=along(b,s),[c0,c1]=across(b,s),y=FL(f),kind=o.kind;
      const out=outward(s),face=out[0]+out[1]<0?c0:c1-1,proud=face+(out[0]+out[1]),mid=Math.floor((c0+c1)/2);
      const ins=k=>s[0]==='x'?[0,0,k,k]:[k,k,0,0];
      if(kind==='open'){cut(b,y,y+DOOR_H+4,ins(0));return;}
      if(kind==='door'||kind==='front'||kind==='back'){
        cut(b,y,y+DOOR_H,ins(1));for(let yy=y;yy<y+DOOR_H+2;yy++)for(let c=c0;c<c1;c++){put(s,a0,c,yy,M.timber_dark);put(s,a1-1,c,yy,M.timber_dark);}
        for(let a=a0;a<a1;a++)for(let c=c0;c<c1;c++)put(s,a,c,y+DOOR_H,M.timber_dark);
        if(kind==='back'){for(let a=a0+1;a<a1-1;a++)for(let yy=y;yy<y+DOOR_H;yy++)put(s,a,mid,yy,((a-a0)%4===0)?M.timber_dark:M.door_wood);}
        if(kind==='front'){// sliding door pushed open, a noren hung across the head, lanterns either side
          for(let a=a0+1;a<a0+(a1-a0)/2;a++)for(let yy=y;yy<y+DOOR_H;yy++)put(s,a,c0+(out[0]+out[1]<0?1:c1-c0-2),yy,(yy-y)%6===0||(a-a0)%5===0?M.timber_dark:M.shoji);
          for(let a=a0+1;a<a1-1;a++)for(let yy=y+DOOR_H-12;yy<y+DOOR_H;yy++)if((a-a0)%6!==0||yy>y+DOOR_H-4)put(s,a,proud,yy,yy>y+DOOR_H-3?M.timber_dark:style.noren?M[style.noren]:M.cloth_indigo);
          for(const a of [a0-4,a1+3])lantern(s,a,proud+(out[0]+out[1]),y+DOOR_H-2);
          // stepping stone and potted plants at the threshold
          for(let a=a0+1;a<a1-1;a++)for(let k=1;k<6;k++)put(s,a,face+(out[0]+out[1])*k,y-1-Math.floor(k/3),M.stone_grey);
          pot(s,a0-8,proud+(out[0]+out[1])*3,Y0);pot(s,a1+7,proud+(out[0]+out[1])*3,Y0);}
        return;}
      if(kind==='shopfront'||kind==='bay'){
        const top=y+HEAD+2;cut(b,y+1,top,ins(1));for(let c=c0;c<c1;c++)for(let a=a0;a<a1;a++)put(s,a,c,top-1,style.timber);
        for(let a=a0;a<a1;a+=16)for(let yy=y;yy<top;yy++)for(let c=c0;c<c1;c++)put(s,a,c,yy,style.timber);
        // stall boards below, lattice or glazing above; a wide sliding section stays open on a shop.
        for(let a=a0;a<a1;a++)for(let yy=y;yy<y+8;yy++)put(s,a,mid,yy,(a-a0)%4===0?M.timber_dark:style.timber);
        const openFrom=kind==='shopfront'?a0+Math.floor((a1-a0)*.55):a1;
        for(let a=a0;a<openFrom;a++)for(let yy=y+8;yy<top-1;yy++){const lat=style.lattice?((a-a0)%3===0||(yy-y)%9===0):((a-a0)%16===0||yy===y+20);put(s,a,mid,yy,lat?M.timber_dark:style.lattice?M.shoji:M.glass);}
        // awning or a small tiled eave (hisashi) across the front
        if(style.lattice)hisashi(f,s,a0-4,a1+4,face,top+5);else awning(s,a0,a1,proud,top+2);
        if(kind==='shopfront')signboard(s,a0,a1,proud,top+8);
        return;}
      if(kind==='balcony'){cut(b,y,y+DOOR_H,ins(2));
        for(let a=a0+1;a<a1-1;a++)for(let yy=y;yy<y+DOOR_H;yy++)put(s,a,mid,yy,(a-a0)%5===0||(yy-y)%8===0?M.timber_dark:style.lattice?M.shoji:M.glass);
        frame(s,a0+1,a1-1,proud,y,y+DOOR_H);
        for(let k=1;k<=10;k++)for(let a=a0-2;a<a1+2;a++){const c=face+(out[0]+out[1])*k;put(s,a,c,y-1,style.timber);if(k===10||a===a0-2||a===a1+1)for(let yy=y;yy<y+15;yy++)if(yy===y+14||(a+k)%3===0)put(s,a,c,yy,style.trim);}
        for(let a=a0;a<a1;a+=8)for(let k=1;k<=10;k++)put(s,a,face+(out[0]+out[1])*k,y-2-Math.floor(k/2),style.timber); // brackets
        return;}
      // windows
      const small=kind==='small',lo=y+(small?26:SILL),hi=y+HEAD-(small?2:0),wa0=small?a0+2:a0+1,wa1=small?a1-2:a1-1;
      for(let a=wa0;a<wa1;a++)for(let yy=lo;yy<hi;yy++)for(let c=c0;c<c1;c++)put(s,a,c,yy,0);
      for(let a=wa0;a<wa1;a++)for(let yy=lo;yy<hi;yy++){const u=a-wa0,v=yy-lo,lat=style.lattice?(u%3===0||v%4===0):(u===Math.floor((wa1-wa0)/2)||v===Math.floor((hi-lo)*.6));put(s,a,mid,yy,lat?M.timber_dark:style.lattice?M.shoji:M.glass);}
      frame(s,wa0-1,wa1+1,proud,lo-1,hi+1);
      if(!small&&!style.lattice&&f>0)flowerBox(s,wa0-1,wa1+1,proud,lo-1);
      if(!small&&style.label.startsWith('Harbour'))for(const a of [wa0-4,wa1])for(let k=0;k<3;k++)for(let yy=lo;yy<hi;yy++)put(s,a+k+(a<wa0?0:1),proud,yy,(yy-lo)%3===0?M.tile_blue_dark:M.tile_blue);
    }
    const sgn=s=>{const o=outward(s);return o[0]+o[1];};
    function frame(s,a0,a1,c,y0,y1){for(let a=a0;a<a1;a++){put(s,a,c,y0,style.trim);put(s,a,c,y1-1,style.trim);}for(let yy=y0;yy<y1;yy++){put(s,a0,c,yy,style.trim);put(s,a1-1,c,yy,style.trim);}}
    function flowerBox(s,a0,a1,c,y){const k=sgn(s);for(let a=a0;a<a1;a++)for(let t=0;t<3;t++){put(s,a,c+k*t,y-1,M.terracotta);put(s,a,c+k*t,y-2,M.terracotta);
      const h=(a*7+t*3)%5;put(s,a,c+k*t,y,h<3?M.leaf:M.leaf_dark);if(h===0||h===3)put(s,a,c+k*t,y+1,[M.flower_pink,M.flower_yellow,M.flower_white][(a+t)%3]);}}
    function lantern(s,a,c,ytop){for(let yy=ytop-9;yy<=ytop;yy++)for(let da=-2;da<=2;da++)for(let dc=-2;dc<=2;dc++){const v=yy-(ytop-5),rr=da*da+dc*dc+v*v*.45;
      if(yy>=ytop-1){if(da===0&&dc===0)put(s,a,c,yy,M.iron);continue;}if(rr<=6.2)put(s,a+da,c+dc*sgn(s),yy,v===-4||v===3?M.soot:rr<3?M.lantern_glow:M.lantern);}
      info.lights.push({s,a,c,y:ytop-5});}
    function pot(s,a,c,y){for(let yy=y;yy<y+5;yy++)for(let da=-2;da<=2;da++)for(let dc=-2;dc<=2;dc++)if(da*da+dc*dc<=4.5)put(s,a+da,c+dc,yy,M.terracotta);
      for(let yy=y+5;yy<y+12;yy++)for(let da=-3;da<=3;da++)for(let dc=-3;dc<=3;dc++){const v=yy-(y+8);if(da*da+dc*dc+v*v*1.2<=10&&((da*3+dc*5+yy)%4))put(s,a+da,c+dc,yy,(da+dc+yy)%3?M.leaf:M.leaf_dark);}}
    function awning(s,a0,a1,c,y){const k=sgn(s),cloth=style.noren?M[style.noren]:M.cloth_coral;for(let t=0;t<12;t++)for(let a=a0;a<a1;a++){const yy=y-Math.floor(t/2);put(s,a,c+k*t,yy,((a-a0)>>2)&1?cloth:M.cloth_white);if(t===11)for(let q=1;q<3;q++)put(s,a,c+k*t,yy-q,((a-a0)>>2)&1?cloth:M.cloth_white);}}
    function hisashi(f,s,a0,a1,face,y){const k=sgn(s),roofM=M[style.roofMat],dk=dark(roofM);for(let t=-1;t<14;t++)for(let a=a0;a<a1;a++){const yy=y-Math.floor((t+1)*.55);put(s,a,face+k*t,yy,a%2?roofM:dk);put(s,a,face+k*t,yy-1,M.timber_dark);}
      for(let a=a0;a<a1;a+=16)for(let t=0;t<12;t++)put(s,a,face+k*t,y-2-Math.floor(t*.55),M.timber_dark);}
    function signboard(s,a0,a1,c,y){const k=sgn(s),mid=Math.floor((a0+a1)/2),half=Math.min(14,Math.floor((a1-a0)/2)-2);
      for(let a=mid-half;a<mid+half;a++)for(let yy=y;yy<y+9;yy++){const edge=a===mid-half||a===mid+half-1||yy===y||yy===y+8,ink=!edge&&((Plan.hash(`${plan.seed}:${a>>1}:${yy>>1}`)%7)<2)&&yy>y+1&&yy<y+7&&(a-mid+half)%9>1;put(s,a,c+k,yy,edge?M.timber_dark:ink?M.sign_ink:M.sign);}}

    for(let f=0;f<storeys;f++){const F=plan.floors[f];for(const dr of F.doors)opening(f,dr,true);for(const o of F.openings)opening(f,o,false);}

    // Jetty brackets under any upper floor that overhangs the street.
    if(plan.plot.jetty)for(let x=0;x<w;x+=2)for(let t=0;t<CV;t++){const xx=cx(x)+(x===0?0:-1),zz=cz(front)-1-t,yy=FL(1)-SLAB-1-(CV-1-t);box(xx,yy,zz,xx+2,yy+1,zz+1,style.timber);}

    // Roof: union of gable/hip height fields over the top floor's footprint rectangles. Ridges along the frontage
    // slope to the street; terraces never hip into a party wall.
    const top=storeys-1,rects=decompose(plan.plot.masks[top],w,d),hipOk=!party[0]&&!party[1],shape=style.roof==='hip'&&hipOk?'hip':'gable';
    const roofY=new Int16Array(X*Z).fill(-1),roofKind=new Uint8Array(X*Z),pitch=style.pitch,curve=style.curve;
    for(const [rx0,rz0,rx1,rz1] of rects){
      const x0=cx(rx0),x1=cx(rx1+1),z0=cz(rz0),z1=cz(rz1+1),wide=x1-x0,deep=z1-z0;
      const ridgeX=style.ridge==='frontage'?true:style.ridge==='depth'?false:wide>=deep,el=rx0===0&&party[0]?0:eave,er=rx1===w-1&&party[1]?0:eave;
      const ge=shape==='gable'?Math.round(eave*.5):eave,gx0=x0-(ridgeX?(rx0===0&&party[0]?0:ge):el),gx1=x1+(ridgeX?(rx1===w-1&&party[1]?0:ge):er),gz0=z0-(ridgeX?eave:ge),gz1=z1+(ridgeX?eave:ge);
      const half=(ridgeX?deep:wide)/2,Hmax=pitch*(half+eave);
      for(let z=gz0;z<gz1;z++)for(let x=gx0;x<gx1;x++){
        // Distances are measured from the wall line (negative out on the eaves), so a party-wall side with no
        // eave still meets its wall top. Hip roofs slope from all four walls.
        const wz=Math.min(z-z0,z1-1-z),wx=Math.min(x-x0,x1-1-x),tip=Math.min(ridgeX?Math.min(z-gz0,gz1-1-z):Math.min(x-gx0,gx1-1-x),shape==='hip'?(ridgeX?Math.min(x-gx0,gx1-1-x):Math.min(z-gz0,gz1-1-z)):1e9);
        const dist=Math.min(half,shape==='hip'?Math.min(wz,wx):ridgeX?wz:wx),t=dist/half;
        // Straight pitch, a gentle sag between wall line and ridge (zero at both), eaves that flick up past the
        // wall line, and more lift at the corners.
        let h=pitch*dist;
        if(t>0)h-=curve*pitch*half*.22*Math.sin(Math.PI*Math.min(1,t));else h+=curve*pitch*dist*dist/eave*.9;
        if(curve>0){const ex=Math.min(x-gx0,gx1-1-x),ez=Math.min(z-gz0,gz1-1-z);if(ex<eave&&ez<eave)h+=curve*12*(1-ex/eave)*(1-ez/eave);}
        const yy=Math.round(plate+2+h),i=x+X*z;void Hmax;if(yy>roofY[i]){roofY[i]=yy;roofKind[i]=(dist>=half-1?2:0)|(tip<2?4:0);}}}
    const tile=M[style.roofMat],tileDk=dark(tile),topCols=extWall[top];
    for(let z=0;z<Z;z++)for(let x=0;x<X;x++){const i=x+X*z,ry=roofY[i];if(ry<0)continue;
      const inside=mask(top,Math.floor((x-MX)/CV),Math.floor((z-MZ)/CV))&&x>=MX&&z>=MZ;
      // gable infill: the outer wall rises to meet the roof
      if(topCols.has(x+','+z))for(let yy=plate;yy<ry-2;yy++){const s=x<MX+3?'xm':x>=MX+w*CV-3?'xp':z<MZ+3?'zm':'zp';set(x,yy,z,facade(top,s,s[0]==='x'?z-MZ:x-MX,SILL+2+(yy-plate)%(SH-SILL-6),0,isParty(s,s==='xm'?0:w-1)&&(s==='xm'||s==='xp')));}
      for(let k=0;k<3;k++)set(x,ry-k,z,k===2&&!inside?M.timber_dark:(roofKind[i]&4)?tileDk:((ridgeAxis(x,z))&1)?tile:tileDk);
      if(roofKind[i]&2){set(x,ry+1,z,M.ridge);set(x,ry+2,z,M.ridge);}}
    function ridgeAxis(x,z){return style.ridge==='depth'?(z>>1):(x>>1);}
    // Ridge-end ornaments on the lacquer and machiya styles.
    if(style.lattice){for(let z=0;z<Z;z++)for(let x=0;x<X;x++){const i=x+X*z;if(!(roofKind[i]&2))continue;const nb=[[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b])=>roofKind[(x+a)+X*(z+b)]&2).length;
      if(nb===1)box(x-1,roofY[i]+1,z-1,x+2,roofY[i]+6,z+2,style.label.startsWith('Sky')?M.gold:M.ridge);}}
    // Chimney over the kitchen's back wall.
    const kitchenFloor=plan.floors.findIndex(F=>F.rooms.some(r=>r.type==='kitchen'));
    if(kitchenFloor>=0){const F=plan.floors[kitchenFloor],k=F.rooms.findIndex(r=>r.type==='kitchen'),cells=[];for(let i=0;i<w*d;i++)if(F.grid[i]===k)cells.push(i);
      const c=cells.sort((a,b)=>Math.floor(b/w)-Math.floor(a/w)||((a%w)-(b%w)))[0],x=c%w,z=Math.floor(c/w),bx=cx(x)+1,bz=cz(z)+(mask(kitchenFloor,x,z+1)?1:-2);
      let peak=0;for(let zz=bz;zz<bz+9;zz++)for(let xx=bx;xx<bx+9;xx++)peak=Math.max(peak,roofY[xx+X*zz]);
      for(let yy=FL(kitchenFloor);yy<peak+12;yy++)for(let zz=bz;zz<bz+9;zz++)for(let xx=bx;xx<bx+9;xx++){const edge=xx===bx||xx===bx+8||zz===bz||zz===bz+8;if(!edge&&yy>peak)continue;set(xx,yy,zz,yy>=peak+10?M.soot:((xx+zz)>>1)+(yy>>1)&1?M.brick:M.brick_dark);}}

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
