(function(root){
  'use strict';
  const CELL=.25,CHUNK=32,HEIGHT=96,STREAM_HEIGHT=384,EXTENT=128,REVISION='micro-catchment-1';
  const MAT=Object.freeze({air:0,basalt:1,soil:2,grass:3,sand:4,bark:5,leaf:6,water:7,ore:8,flower:9,snow:16,needle:17,dry:18});
  const COLORS=Object.freeze(['#000000','#717d91','#72614e','#85a96b','#c1b993','#665145','#426c57','#488f9b','#d6a85e','#e6baac','#dfac5c','#edcfad','#33434c','#a0c7c0','#ede7d4','#273b41','#eef2f2','#2e4c3c','#b5a067']);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function hash(x,z,seed=0){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^(seed|0);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
  function noise(x,z,seed){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);const a=hash(ix,iz,seed),b=hash(ix+1,iz,seed),c=hash(ix,iz+1,seed),d=hash(ix+1,iz+1,seed);return (a+(b-a)*sx)*(1-sz)+(c+(d-c)*sx)*sz;}
  const riverX=z=>78+9*Math.sin(z*.046)+3*Math.sin(z*.11);
  const MAX_CHUNK=16777215,CHUNK_METRES=CELL*CHUNK;
  function movePosition(position,dx=0,dz=0){
    if(![position.cx,position.cz].every(n=>Number.isInteger(n)&&Math.abs(n)<=MAX_CHUNK)||![position.x,position.z,dx,dz].every(Number.isFinite))throw new Error('Valid chunk/local coordinates required');
    const result={};
    for(const [axis,delta] of [['x',dx],['z',dz]]){
      const local=position[axis]+delta,shift=Math.floor(local/CHUNK_METRES),chunk=position['c'+axis]+shift;
      result['c'+axis]=clamp(chunk,-MAX_CHUNK,MAX_CHUNK);
      result[axis]=chunk< -MAX_CHUNK?0:chunk>MAX_CHUNK?CHUNK_METRES-1/1024:local-shift*CHUNK_METRES;
    }
    return result;
  }
  const positionAt=(x,z)=>movePosition({cx:0,cz:0,x:0,z:0},x,z);
  function createWorld(seed=2718,cellMetres=CELL,extent=EXTENT){
    if(![CELL,CELL/2].includes(cellMetres))throw new Error('Cell size must be 0.25 or 0.125 metres');
    if(![EXTENT,EXTENT*2,'infinite'].includes(extent))throw new Error('World extent must be 128, 256 or infinite');
    const infinite=extent==='infinite',revision=infinite?'micro-wilds-3':REVISION;
    const density=CELL/cellMetres,chunkCells=CHUNK*density,heightCells=(infinite?STREAM_HEIGHT:HEIGHT)*density;
    seed=Number(seed)>>>0;
    const massifAngle=hash(seed,7,seed+241)*Math.PI*2,massifX=Math.cos(massifAngle)*70,massifZ=Math.sin(massifAngle)*70;
    const gorgeX=-Math.cos(massifAngle)*58,gorgeZ=-Math.sin(massifAngle)*58,gorgeDX=-Math.sin(massifAngle),gorgeDZ=Math.cos(massifAngle);
    const id=`${infinite?'wilds':'catchment'}:${revision}:${seed}`,trees=new Map();
    // Streamed geography is a pure function of (seed, x, z): plates → relief → climate → biome. Nothing is stored.
    const PLATE=640,SEA=14,W=160;
    function site(i,j){
      const a=hash(i,j,seed+307)*Math.PI*2,v=.4+.6*hash(i,j,seed+309);
      return {i,j,x:(i-.35+.7*hash(i,j,seed+301))*PLATE,z:(j-.35+.7*hash(i,j,seed+303))*PLATE,continental:i===0&&j===0||hash(i,j,seed+305)<.62,vx:Math.cos(a)*v,vz:Math.sin(a)*v};
    }
    // The nearest plates and their distances; boundaries are evaluated pairwise so relief is continuous everywhere.
    function plates(x,z){
      const wx=x+(noise(x*.002,z*.002,seed+311)-.5)*180,wz=z+(noise(x*.002,z*.002,seed+313)-.5)*180;
      const ci=Math.floor(wx/PLATE+.5),cj=Math.floor(wz/PLATE+.5),near=[];
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const p=site(ci+di,cj+dj);near.push({p,D:Math.hypot(wx-p.x,wz-p.z)});}
      return near.sort((u,v)=>u.D-v.D).slice(0,5);
    }
    const ridged=(x,z,k)=>1-Math.abs(noise(x,z,k)-.5)*2;
    // Plate relief: crust level, shelves, collision/subduction ranges, arcs, rifts. Used by columns and, unblended, by climate.
    function tectonics(x,z){
      const near=plates(x,z),open=clamp((130-Math.hypot(x,z))/60,0,1),D0=near[0].D;
      const level=p=>p.continental?20+(noise(x*.004,z*.004,seed+317)-.5)*12+(noise(x*.011,z*.011,seed+319)-.5)*5:4+noise(x*.006,z*.006,seed+321)*3;
      const r=ridged(x*.011,z*.011,seed+323)*.65+ridged(x*.029,z*.029,seed+325)*.35;
      let base=0,sum=0;for(const {p,D} of near){const k=Math.exp(-(D-D0)/45);base+=level(p)*k;sum+=k;}base/=sum;
      let up=0,down=0,best=null,shearF=0;
      for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){
        const P=near[i],Q=near[j],third=near.reduce((m,o,k)=>k===i||k===j?m:Math.min(m,o.D),Infinity),w=clamp((third-Q.D)/120,0,1);if(!w)continue;
        const a=P.p,b=Q.p,ex=b.x-a.x,ez=b.z-a.z,len=Math.hypot(ex,ez),nx=ex/len,nz=ez/len,rx=a.vx-b.vx,rz=a.vz-b.vz;
        const conv=rx*nx+rz*nz,shear=Math.abs(rz*nx-rx*nz),edge=(Q.D**2-P.D**2)/(2*len),f=clamp(1-edge/W,0,1),c=clamp(conv/1.1,0,1);
        // Distance from the boundary measured into the continental side (negative offshore) for ocean–continent margins.
        const land=a.continental?edge:-edge;let v=0,setting=null;
        if(conv>.2){
          if(a.continental&&b.continental){v=c*(62*f**1.6*(.3+.7*r)+9*clamp(1-edge/(W*2.2),0,1));setting='collision';}
          else if(a.continental!==b.continental){v=land>0?c*44*Math.exp(-(((land-95)/60)**2))*clamp(land/30,0,1)*(.35+.65*r):-9*c*Math.exp(-(((land+40)/30)**2))*clamp(-land/20,0,1);setting=land>0?'subduction':'trench';}
          else{v=c*f*clamp((noise(x*.009,z*.009,seed+327)-.55)/.12,0,1)*20*(.5+.5*r);setting='arc';}
        }else if(conv<-.45){v=a.continental&&b.continental?-8*f**1.5*clamp(-conv/1.1,0,1):3*f;setting='rift';}
        else if(shear>.6)shearF=Math.max(shearF,f*w);
        v*=w;if(v>0)up=Math.max(up,v);else down=Math.min(down,v);
        if(setting&&(!best||Math.abs(v)>best.v))best={v:Math.abs(v),setting,f:f*w};
      }
      let relief=(up+down)*(1-open*.85),setting='craton',f=0;
      if(best&&best.v>1){setting=best.setting;f=best.f;}else if(shearF>.4){setting='transform';f=shearF;}
      let h=base+relief;if(open)h+=open*Math.max(0,SEA+4-h);
      if(h<SEA)setting=h>SEA-6?'shelf':'ocean';
      return {h,base:base+(relief<0?relief:0),relief,setting,f};
    }
    // Climate on a 32 m grid: latitude temperature, banded prevailing winds, moisture carried from sea and rained out on rising ground.
    const latAngle=hash(seed,13,seed+331)*Math.PI*2,latCos=Math.cos(latAngle),latSin=Math.sin(latAngle),lat0=18+hash(seed,17,seed+333)*34,twist=(hash(seed,19,seed+335)-.5)*.8;
    const climateCells=new Map(),CG=32;
    function latitude(x,z){return lat0+(x*latCos+z*latSin)/110;}
    function wind(lat){const L=Math.abs(lat),dir=L<30||L>60?-1:1,t=twist;return {x:dir*(-latSin*Math.cos(t)-latCos*Math.sin(t)),z:dir*(latCos*Math.cos(t)-latSin*Math.sin(t))};}
    function climateCell(i,j){
      const k=i*16777216+j;let v=climateCells.get(k);if(v)return v;
      const x=i*CG,z=j*CG,lat=latitude(x,z),w=wind(lat);let m=.55,prev=null,lift=0;
      for(let s=10;s>=0;s--){const e=tectonics(x-w.x*48*s,z-w.z*48*s).h;if(e<SEA)m=1;else{if(prev!==null){const rise=Math.max(0,e-Math.max(prev,SEA));const rain=Math.min(m*.7,rise*.018);m-=rain;if(s<=1)lift+=rise;}m=m*.99+.003;}prev=e;}
      const here=tectonics(x,z).h,T=30-.5*Math.abs(lat)+(noise(x*.003,z*.003,seed+337)-.5)*6-.32*Math.max(0,here-SEA);
      v={T,M:clamp(m*.85+lift*.02+(noise(x*.005,z*.005,seed+339)-.5)*.2,0,1)};climateCells.set(k,v);if(climateCells.size>8192)climateCells.delete(climateCells.keys().next().value);return v;
    }
    function climate(x,z){
      const gx=x/CG,gz=z/CG,i=Math.floor(gx),j=Math.floor(gz),u=gx-i,w=gz-j,a=climateCell(i,j),b=climateCell(i+1,j),c=climateCell(i,j+1),d=climateCell(i+1,j+1),mix=k=>(a[k]+(b[k]-a[k])*u)*(1-w)+(c[k]+(d[k]-c[k])*u)*w;
      return {T:mix('T'),M:mix('M')};
    }
    function biomeOf(T,M,h,wet,steep){
      if(h<SEA)return 'sea';
      if(T<-5)return 'snow';
      if(steep&&T<3)return 'alpine';
      if(h<SEA+1.2)return T<0?'tundra':'beach';
      if(wet&&M>.5&&T>0&&!steep)return 'wetland';
      if(T<1)return 'tundra';
      if(T<7)return M>.38?'boreal':'tundra';
      if(T<19)return M>.5?'forest':M>.24?'grassland':'desert';
      return M>.66?'rainforest':M>.34?'savanna':'desert';
    }
    const TREES={rainforest:.92,forest:.82,boreal:.78,wetland:.3,savanna:.12,grassland:.06,tundra:.03};
    // Home massif: stepped plateau walled by vertical 4.5 m tiers; inside notch zones the same uplift is a climbable ramp (a pass).
    function upliftAt(x,z){
      const dm=Math.hypot(x-massifX,z-massifZ);if(dm>46)return {lift:0,pass:false,up:0};
      const lift=clamp(1.6-dm/28,0,1),pass=lift>0&&noise(x*.025,z*.025,seed+223)<.24+clamp(.15-lift,0,.15);
      return {lift,pass,up:lift>0?pass?lift*9:4.5*Math.min(2,Math.floor(lift*2)+1):0};
    }
    // Where a tier boundary meets a pass or contour tip, a raised strip one or two voxels wide would stand alone; such strips take the higher of their lower neighbours.
    function liftAt(x,z){
      const c=upliftAt(x,z);if(!c.up)return c;
      const d=cellMetres,at=k=>k.map(([u,v])=>upliftAt(x+u,z+v)),low=n=>n.up<c.up-1.5,top=(a,b)=>a.up>=b.up?a:b;
      let best=null;
      for(const [u,v] of [[d,0],[0,d]]){
        const [m,p]=at([[-u,-v],[u,v]]);let n=null;
        if(low(m)&&low(p))n=top(m,p);
        else if(low(m)){const [p2]=at([[2*u,2*v]]);if(low(p2))n=top(m,p2);}
        else if(low(p)){const [m2]=at([[-2*u,-2*v]]);if(low(m2))n=top(m2,p);}
        if(n&&(!best||n.up>best.up))best=n;
      }
      return best||c;
    }
    function geography(x,z){
      if(infinite){
        const t=tectonics(x,z),warp=(noise(x*.006,z*.006,seed+101)-.5)*50;
        const riverDistance=Math.abs(noise((x+warp)*.012,z*.012,seed+103)-.5)*180+Math.max(0,t.relief-10)*1.5+(t.h<SEA+1?40:0);
        const ridge=1-Math.abs(noise(x*.009,z*.009,seed+107)-.5)*2;
        const fault=Math.abs(noise(x*.04,z*.04,seed+109)-.5)*20;
        const bank=clamp((riverDistance-2.3)/8,0,1),floor=Math.max(SEA+.4,Math.min(t.h,t.base)-1.5);
        let h=t.h+(noise(x*.032,z*.032,seed)*2.4+noise(x*.13,z*.13,seed+1)*.7+ridge**4*3)*(t.h<SEA?.4:1);
        h=floor+(h-floor)*bank;
        const L=liftAt(x,z),{lift,pass}=L;
        const gw=(noise(x*.008,z*.008,seed+227)-.5)*60,half=2+noise(x*.05,z*.05,seed+233);
        const sx=x-gorgeX,sz=z-gorgeZ,along=clamp(sx*gorgeDX+sz*gorgeDZ,-32,32),homeGorge=Math.hypot(sx-along*gorgeDX,sz-along*gorgeDZ)+Math.sin(along*.15)*1.5;
        const faulted=(t.setting==='rift'||t.setting==='transform')&&t.f>.3;
        const gorgeDistance=lift>0||riverDistance<16||t.base<SEA+6?Infinity:Math.min(homeGorge,faulted?Math.abs(noise((x+gw)*.006,(z-gw)*.006,seed+231)-.5)*170:Infinity);
        const gorge=gorgeDistance<half,rock=noise(x*.02,z*.02,seed+239)>.45?'sound':'fractured';
        if(lift>0)h=Math.max(h,Math.min(h,SEA+8)+L.up);
        if(gorge)h=Math.max(SEA+1,t.base-7);
        const height=clamp(Math.floor(h/cellMetres),1,heightCells-28*density),metres=height*cellMetres,sea=metres<SEA,steep=t.relief>24&&ridge>.45;
        const C=climate(x,z),wet=riverDistance<12,biome=gorge?'gorge':biomeOf(C.T-.32*Math.max(0,metres-t.h),C.M,metres,wet,steep);
        const water=sea?Math.round(SEA/cellMetres):riverDistance<7&&!gorge?Math.floor((floor+1)/cellMetres):0;
        return {height,riverDistance,ridge,fault,clearing:0,exposed:gorgeDistance<half+2||(lift>0?ridge>.7||fault<2.5:ridge>.82||fault<1.4||steep&&ridge>.7)||biome==='alpine',wet,
          lift,highland:lift>0,pass,gorge,gorgeDistance,gorgeHalf:half,rock,sea,water,biome,setting:t.setting,temperature:C.T,moisture:C.M,relief:t.relief};
      }
      const riverDistance=Math.abs(x-riverX(z));
      const ridge=Math.exp(-(((x-29)/14)**2))*(.65+.35*Math.sin(z*.025+.4));
      const fault=Math.abs(x-(39+3*Math.sin(z*.075)));
      let h=7+noise(x*.032,z*.032,seed)*3+noise(x*.13,z*.13,seed+1)*.8+ridge*7;
      const clearing=1-clamp((Math.hypot(x-49,z-58)-8)/7,0,1);
      h=h*(1-clearing)+8*clearing;
      const bank=clamp((riverDistance-2.3)/8,0,1);
      h=5+(h-5)*bank;
      const exposed=ridge>.45||fault<1.4&&x<45;
      return {height:clamp(Math.floor(h/cellMetres),1,heightCells-28*density),riverDistance,ridge,fault,clearing,exposed,wet:riverDistance<12};
    }
    function ground(x,z){if(!infinite&&(x<0||z<0||x>=extent||z>=extent))return null;return geography((Math.floor(x/cellMetres)+.5)*cellMetres,(Math.floor(z/cellMetres)+.5)*cellMetres).height*cellMetres;}
    const TG=infinite?3:5;
    function tree(gx,gz){
      if(infinite){
        const key=`${gx}:${gz}`;if(trees.has(key))return trees.get(key);
        const x=(gx+.15+.7*hash(gx,gz,seed+9))*TG,z=(gz+.15+.7*hash(gx,gz,seed+11))*TG,g=geography(x,z);
        const patch=clamp((noise(x*.03,z*.03,seed+341)-.25)/.3,0,1),dense=(TREES[g.biome]||0)*(.35+.65*patch);
        const conifer=g.biome==='boreal'||g.biome==='tundra'||g.biome==='forest'&&g.temperature<11,big=g.biome==='rainforest';
        const value=g.riverDistance<9||g.exposed||g.highland||g.sea||g.gorgeDistance<g.gorgeHalf+4||hash(gx,gz,seed+23)>=dense?null
          :Object.freeze({x,z,base:g.height,conifer,height:((conifer?14:big?18:11)+Math.floor(hash(gx,gz,seed+4)*(big?12:8)))*density,radius:((conifer?4:big?7:5)+Math.floor(hash(gx,gz,seed+5)*3))*density});
        if(trees.size>=2048)trees.delete(trees.keys().next().value);trees.set(key,value);return value;
      }
      const grid=Math.ceil(extent/5);
      if(!infinite&&(gx<0||gz<0||gx>=grid||gz>=grid))return null;
      const key=`${gx}:${gz}`;if(trees.has(key))return trees.get(key);
      const x=(gx+.2+.6*hash(gx,gz,seed+9))*5,z=(gz+.2+.6*hash(gx,gz,seed+11))*5;
      const g=geography(x,z);
      const edge=gx<Math.ceil(EXTENT/5)&&gz<Math.ceil(EXTENT/5)?EXTENT:extent;
      const value=(!infinite&&(x<1||z<1||x>edge-1||z>edge-1||x>extent-1||z>extent-1))||g.clearing>.1||g.riverDistance<11||g.exposed||g.highland||g.gorgeDistance<g.gorgeHalf+4||hash(gx,gz,seed+23)<.28?null:{x,z,base:g.height,height:(12+Math.floor(hash(gx,gz,seed+4)*9))*density,radius:(5+Math.floor(hash(gx,gz,seed+5)*3))*density};
      if(value)Object.freeze(value);if(trees.size>=2048)trees.delete(trees.keys().next().value);trees.set(key,value);return value;
    }
    // Root geology and identity survive render/cache changes.
    let rootSite=null,score=Infinity;
    if(infinite){
      for(let z=-128;z<=128;z+=2)for(let x=-128;x<=128;x+=2){const g=geography(x,z);if(g.exposed&&g.riverDistance>12&&!g.highland&&g.gorgeDistance>12&&[.0625,.125].every(offset=>geography(x+offset,z+offset).exposed)){const s=Math.hypot(x,z);if(s<score){score=s;rootSite={x,z};}}}
      if(!rootSite)throw new Error('No dry basalt root in the starting survey');
    }else for(let z=40;z<77;z+=.5)for(let x=34;x<44;x+=.5){const g=geography(x,z);if(g.exposed&&g.fault<1){const s=Math.hypot(x-42,z-58);if(s<score){score=s;rootSite={x,z};}}}
    const deposit=Object.freeze({id:`${id}:ore:root`,kind:'Ferrite',x:rootSite.x,z:rootSite.z,y:ground(rootSite.x,rootSite.z),rule:infinite?'Dry exposed basalt in the seeded ridge and fracture fields':'Exposed basalt along the western fault above the river catchment',geology:infinite?'Ridge/fracture-exposed basalt':'Fault-exposed basalt',surveyed:true});
    function column(vx,vz){
      const values=new Uint8Array(heightCells);
      const x=(vx+.5)*cellMetres,z=(vz+.5)*cellMetres;
      if(!infinite&&(x<0||z<0||x>=extent||z>=extent))return values;
      const g=geography(x,z),h=g.height;
      values.fill(MAT.basalt,0,Math.max(0,h-4*density));
      values.fill(g.exposed?MAT.basalt:MAT.soil,Math.max(0,h-4*density),h);
      if(infinite){
        const b=g.biome,sub=b==='desert'||b==='beach'||b==='sea'?MAT.sand:MAT.soil;
        if(!g.exposed)values.fill(sub,Math.max(0,h-4*density),h);
        values[h-1]=g.exposed?MAT.basalt:b==='snow'?MAT.snow:b==='sea'||b==='desert'||b==='beach'||g.riverDistance<9?MAT.sand:b==='grassland'||b==='savanna'||b==='tundra'?MAT.dry:b==='alpine'?MAT.basalt:MAT.grass;
      }else values[h-1]=g.exposed?MAT.basalt:g.riverDistance<9?MAT.sand:MAT.grass;
      if(Math.hypot(x-deposit.x,z-deposit.z)<1.15&&g.exposed)values.fill(MAT.ore,h-3*density,h);
      if(infinite){if(g.water>h)values.fill(MAT.water,h,g.water);}
      else if(h<24*density&&g.riverDistance<7)values.fill(MAT.water,h,24*density);
      const gx=Math.floor(x/TG),gz=Math.floor(z/TG);
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        const t=tree(gx+dx,gz+dz);if(!t)continue;
        const dist=Math.hypot((x-t.x)/cellMetres,(z-t.z)/cellMetres),top=t.base+t.height;
        if(dist<.72*density)values.fill(MAT.bark,t.base,top);
        if(t.conifer){
          const low=t.base+3*density;
          for(let y=low;y<Math.min(heightCells,top+2*density);y++)if(!values[y]&&dist<t.radius*(1-(y-low)/(top+2*density-low))+.5)values[y]=MAT.needle;
        }else if(dist<t.radius){
          const rise=Math.sqrt(t.radius*t.radius-dist*dist);
          const low=Math.max(t.base+5*density,Math.floor(top-rise*.55)),high=Math.min(heightCells,Math.ceil(top+rise*.65));
          for(let y=low;y<high;y++)if(!values[y])values[y]=MAT.leaf;
        }
      }
      if(!g.exposed&&!g.wet&&g.clearing<.5&&(!infinite||values[h-1]===MAT.grass)&&hash(Math.floor(vx/density),Math.floor(vz/density),seed+52)>.994&&values[h]===0)values.fill(MAT.flower,h,h+density);
      return values;
    }
    function generateChunk(cx,cz){
      if(![cx,cz].every(n=>Number.isInteger(n)&&(!infinite||Math.abs(n)<=MAX_CHUNK)))throw new Error('Chunk coordinates exceed the supported range');
      const offsets=new Uint16Array(chunkCells*chunkCells+1),ends=[],materials=[];
      for(let z=0;z<chunkCells;z++)for(let x=0;x<chunkCells;x++){
        const i=z*chunkCells+x,v=column(cx*chunkCells+x,cz*chunkCells+z);offsets[i]=ends.length;
        for(let y=0;y<heightCells;){const material=v[y];let end=y+1;while(end<heightCells&&v[end]===material)end++;ends.push(end);materials.push(material);y=end;}
      }
      if(ends.length>65535)throw new Error('Column runs exceed the chunk offset format');
      offsets[chunkCells*chunkCells]=ends.length;
      const chunk={cx,cz,size:chunkCells,height:heightCells,cell:cellMetres,offsets,ends:heightCells>255?Uint16Array.from(ends):Uint8Array.from(ends),materials:Uint8Array.from(materials)};
      chunk.bytes=chunk.offsets.byteLength+chunk.ends.byteLength+chunk.materials.byteLength;
      return chunk;
    }
    // Cheap per-chunk vertical extent (5×5 ground samples plus tree headroom) for culling tall streamed columns.
    return Object.freeze({id,dataId:`${id}:cell:${cellMetres}:extent:${extent}`,seed,revision,extent,infinite,cell:cellMetres,chunkCells,heightCells,chunkMetres:chunkCells*cellMetres,heightMetres:heightCells*cellMetres,deposit,geography,ground,column,tree,generateChunk,vegetationEntries:()=>trees.size});
  }
  function voxel(chunk,x,y,z){
    const {size:CHUNK,height:HEIGHT}=chunk;
    if(x<0||z<0||y<0||x>=CHUNK||z>=CHUNK||y>=HEIGHT)return MAT.air;
    const i=z*CHUNK+x;
    for(let r=chunk.offsets[i];r<chunk.offsets[i+1];r++)if(y<chunk.ends[r])return chunk.materials[r];
    return MAT.air;
  }
  function meshChunk(world,chunk,step=1){
    const {size:CHUNK,height:HEIGHT}=chunk;
    if(chunk.cell!==world.cell)throw new Error('Chunk resolution does not match the world');
    if(![1,2,4,8].includes(step))throw new Error('Render step must be 1, 2, 4 or 8');
    // Mesh only up to the chunk's top occupied cell: tall streamed columns cost nothing where the ground is low.
    let top=1;for(let i=0;i<CHUNK*CHUNK;i++){const e=chunk.offsets[i+1]-1;if(e>chunk.offsets[i]&&chunk.materials[e]===MAT.air)top=Math.max(top,chunk.ends[e-1]);else if(chunk.materials[e])top=HEIGHT;}
    const nx=CHUNK/step,ny=Math.ceil(top/step),dims=[nx,ny,nx],halo=nx+2;
    const dense=new Uint8Array(halo*halo*(ny+2));
    const at=(x,y,z)=>dense[(z+1)*halo*(ny+2)+(y+1)*halo+x+1];
    for(let z=-1;z<=nx;z++)for(let x=-1;x<=nx;x++){
      const local=x>=0&&z>=0&&x<nx&&z<nx;
      const col=local?null:world.column(chunk.cx*CHUNK+x*step,chunk.cz*CHUNK+z*step);
      for(let y=0;y<ny;y++){
        let material=0;
        // Preserve the top occupied material when reducing a vertical block (grass must not become soil).
        for(let dy=step-1;dy>=0&&!material;dy--)material=local?voxel(chunk,x*step,y*step+dy,z*step):col[y*step+dy];
        dense[(z+1)*halo*(ny+2)+(y+1)*halo+x+1]=material;
      }
    }
    const mask=new Int16Array(Math.max(nx*ny,nx*nx));
    let output=new ArrayBuffer(16384),view=new DataView(output),used=0,quads=0,exposedFaces=0;
    for(let d=0;d<3;d++){
      const u=(d+1)%3,v=(d+2)%3,p=[0,0,0],q=[0,0,0];q[d]=1;
      for(p[d]=-1;p[d]<dims[d];p[d]++){
        let n=0;
        for(p[v]=0;p[v]<dims[v];p[v]++)for(p[u]=0;p[u]<dims[u];p[u]++){
          const a=at(...p),b=at(p[0]+q[0],p[1]+q[1],p[2]+q[2]);
          // The neighbouring solid owns its face; never duplicate it in this chunk.
          const value=a&&!b&&p[d]>=0?a:!a&&b&&p[d]<dims[d]-1?-b:0;
          mask[n++]=value;if(value)exposedFaces++;
        }
        for(let j=0;j<dims[v];j++)for(let i=0;i<dims[u];){
          n=j*dims[u]+i;const c=mask[n];if(!c){i++;continue;}
          let w=1;while(i+w<dims[u]&&mask[n+w]===c)w++;
          let h=1;outer:while(j+h<dims[v]){for(let k=0;k<w;k++)if(mask[n+k+h*dims[u]]!==c)break outer;h++;}
          const pos=[0,0,0],du=[0,0,0],dv=[0,0,0];pos[d]=p[d]+1;pos[u]=i;pos[v]=j;du[u]=w;dv[v]=h;
          const normal=d*2+(c>0?1:0),m=Math.abs(c),corners=[pos,pos.map((t,k)=>t+du[k]),pos.map((t,k)=>t+du[k]+dv[k]),pos.map((t,k)=>t+dv[k])];
          if(used+48>output.byteLength){const larger=new ArrayBuffer(output.byteLength*2);new Uint8Array(larger).set(new Uint8Array(output));output=larger;view=new DataView(output);}
          for(const k of c>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]){for(let a=0;a<3;a++)view.setUint16(used+a*2,corners[k][a],true);view.setUint8(used+6,normal);view.setUint8(used+7,m);used+=8;}
          quads++;for(let b=0;b<h;b++)for(let a=0;a<w;a++)mask[n+a+b*dims[u]]=0;i+=w;
        }
      }
    }
    const buffer=output.slice(0,used);
    return {buffer,count:quads*6,quads,exposedFaces,step,temporaryDenseBytes:dense.byteLength,scratchBytes:dense.byteLength+mask.byteLength+output.byteLength+used};
  }
  class BudgetCache{
    constructor(maxEntries=144,maxBytes=32*1024*1024,dispose=()=>{}){this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.dispose=dispose;this.items=new Map();this.bytes=0;}
    get(key){const v=this.items.get(key);if(v){this.items.delete(key);this.items.set(key,v);}return v;}
    set(key,value,retain=[]){this.delete(key);if(value.bytes>this.maxBytes){this.dispose(value);return false;}for(const k of retain)this.get(k);this.items.set(key,value);this.bytes+=value.bytes;while(this.items.size>this.maxEntries||this.bytes>this.maxBytes)this.delete(this.items.keys().next().value);return true;}
    delete(key){const v=this.items.get(key);if(v){this.bytes-=v.bytes;this.items.delete(key);this.dispose(v);}}
    clear(){for(const key of this.items.keys())this.delete(key);}
  }
  const api={CELL,CHUNK,HEIGHT,EXTENT,REVISION,MAX_CHUNK,MAT,COLORS,hash,riverX,movePosition,positionAt,createWorld,voxel,meshChunk,BudgetCache};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MicroWorld=api;
})(typeof globalThis==='object'?globalThis:this);
