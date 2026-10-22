(function(root){
  'use strict';
  const CELL=.25,CHUNK=32,HEIGHT=96,STREAM_HEIGHT=1024,EXTENT=128,REVISION='micro-catchment-1';
  const MAT=Object.freeze({air:0,basalt:1,soil:2,grass:3,sand:4,bark:5,leaf:6,water:7,ore:8,flower:9,snow:16,needle:17,dry:18,crystal:19,moss:20,ice:21,stone:22,redwood:23,foam:24,sandstone:25,mossy:26,tundra:27,podzol:28,litter:29,gravel:30,mud:31,dirt:32,
    // Vegetation (appended; never renumber): leaves/needles, barks/culms, then small standing objects.
    birchBark:33,birchLeaf:34,larch:35,bushLeaf:36,bamboo:37,bambooLeaf:38,blossom:39,blossomWhite:40,coral:41,fern:42,tuft:43,mushroom:44,stem:45,glowFlower:46,reed:47,flowerYellow:48,flowerViolet:49,cactus:50,acacia:51,larchGold:52,birchMark:53,bambooNode:54,
    // Biome ground (appended after vegetation; never renumber): grass tones, meadow flowers, autumn leaves and litter, blossom,
    // rosegrass, fen moss, heather, steppe/savanna/golden grasses, badland clays, dunes, rainforest floor. Bamboo culms use 37.
    lushgrass:55,sungrass:56,buttercup:57,violet:58,autumngrass:59,autumnlitter:60,autumnleaf:61,rustleaf:62,petal:63,blossomleaf:64,
    pinkgrass:65,sphagnum:66,heather:67,steppegrass:68,savgrass:69,goldgrass:70,clay:71,ochre:72,dune:73,junglefloor:74});
  const COLORS=Object.freeze(['#000000','#717d91','#72614e','#85a96b','#c1b993','#665145','#426c57','#488f9b','#d6a85e','#e6baac','#dfac5c','#edcfad','#33434c','#a0c7c0','#ede7d4','#273b41','#eef2f2','#2e4c3c','#b5a067','#c9b2ff','#8a86c8','#bcdde6','#a9a596','#8b4a35','#f4fbfb','#c58a5c','#5f7d3c','#8e9c66','#5a4433','#8a6a42','#9a9184','#5e5040','#8c7356',
    '#e9e4d8','#a3c86a','#a9b552','#5c9a52','#b6c46a','#78b24c','#b88ae6','#f6eefa','#f28b6e','#4e8d45','#98b862','#d9473b','#f1e6cc','#71dcff','#a3a45c','#f4d04e','#a483e6','#5e9a5a','#8aa24c','#e0a93c','#45403c','#7d8f3e',
    '#6fa456','#9dbd63','#ecc94e','#b08ad6','#b0a84a','#cf8a3c','#e3a238','#cf6e34','#f1c3d6','#d9a4dd','#d8a3bc','#a4b84c','#9c7aa0','#adb86c','#bdb75a','#d6b254','#bf6a43','#dda067','#e2c27f','#4f7f3f']);
  // Display names for streamed biome ids (atlas hexes, ground inspection). 'Desert' is matched by coop-session.js.
  const BIOME_NAMES=Object.freeze({sea:'Coastal shallows',beach:'Beach',snow:'Snowfield',alpine:'Alpine rock',tundra:'Tundra',boreal:'Boreal forest',forest:'Temperate forest',rainforest:'Rainforest',grassland:'Grassland',savanna:'Savanna',desert:'Desert',wetland:'Wetland',gorge:'Gorge',montane:'Montane conifer forest',subalpine:'Subalpine parkland',glacier:'Glacier',meadow:'Alpine meadow',redwood:'Redwood forest',steppe:'Steppe',
    flowers:'Wildflower meadow',autumn:'Autumn woodland',blossom:'Blossom grove',fen:'Mossy fen',heath:'Heather moor',golden:'Golden savanna',bamboo:'Bamboo grove',badlands:'Badlands',pinkgrass:'Rosegrass prairie'});
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function hash(x,z,seed=0){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^(seed|0);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
  function noise(x,z,seed){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);const a=hash(ix,iz,seed),b=hash(ix+1,iz,seed),c=hash(ix,iz+1,seed),d=hash(ix+1,iz+1,seed);return (a+(b-a)*sx)*(1-sz)+(c+(d-c)*sx)*sz;}
  const riverX=z=>78+9*Math.sin(z*.046)+3*Math.sin(z*.11);
  const SHADE=128,MAX_CHUNK=16777215,CHUNK_METRES=CELL*CHUNK;
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
    const infinite=extent==='infinite',revision=infinite?'micro-wilds-12':REVISION;
    const density=CELL/cellMetres,chunkCells=CHUNK*density,heightCells=(infinite?STREAM_HEIGHT:HEIGHT)*density;
    seed=Number(seed)>>>0;
    const massifAngle=hash(seed,7,seed+241)*Math.PI*2,massifX=Math.cos(massifAngle)*70,massifZ=Math.sin(massifAngle)*70;
    const gorgeX=-Math.cos(massifAngle)*58,gorgeZ=-Math.sin(massifAngle)*58,gorgeDX=-Math.sin(massifAngle),gorgeDZ=Math.cos(massifAngle);
    const id=`${infinite?'wilds':'catchment'}:${revision}:${seed}`,trees=new Map();
    // Streamed geography is a pure function of (seed, x, z): plates → relief → climate → biome. Nothing is stored.
    const PLATE=640,SEA=14,W=160;
    const sites=new Map();
    function site(i,j){
      const k=i*1048576+j;let s=sites.get(k);if(s)return s;
      const a=hash(i,j,seed+307)*Math.PI*2,v=.4+.6*hash(i,j,seed+309);
      s={i,j,x:(i-.35+.7*hash(i,j,seed+301))*PLATE,z:(j-.35+.7*hash(i,j,seed+303))*PLATE,continental:i===0&&j===0||hash(i,j,seed+305)<.62,vx:Math.cos(a)*v,vz:Math.sin(a)*v};
      sites.set(k,s);if(sites.size>4096)sites.delete(sites.keys().next().value);return s;
    }
    // The nearest plates and their distances; boundaries are evaluated pairwise so relief is continuous everywhere.
    // Returns a shared scratch list (valid until the next call): plateRelief reads it before anything calls plates again.
    // Stable insertion sort, so ties keep the same order a stable sort would give.
    const nearP=new Array(9),nearD=new Float64Array(9),near5=Array.from({length:5},()=>({p:null,D:0}));
    function plates(x,z){
      const wx=x+(noise(x*.002,z*.002,seed+311)-.5)*180,wz=z+(noise(x*.002,z*.002,seed+313)-.5)*180;
      const ci=Math.floor(wx/PLATE+.5),cj=Math.floor(wz/PLATE+.5);let n=0;
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
        const p=site(ci+di,cj+dj),D=Math.hypot(wx-p.x,wz-p.z);let k=n++;
        while(k>0&&nearD[k-1]>D){nearD[k]=nearD[k-1];nearP[k]=nearP[k-1];k--;}nearD[k]=D;nearP[k]=p;
      }
      for(let i=0;i<5;i++){near5[i].p=nearP[i];near5[i].D=nearD[i];}
      return near5;
    }
    const ridged=(x,z,k)=>1-Math.abs(noise(x,z,k)-.5)*2;
    // Plate relief: crust level, shelves, collision/subduction ranges, arcs, rifts. Used by columns and, unblended, by climate.
    function plateRelief(x,z){
      const near=plates(x,z),open=clamp((130-Math.hypot(x,z))/60,0,1),D0=near[0].D;
      const level=p=>p.continental?20+(noise(x*.004,z*.004,seed+317)-.5)*12+(noise(x*.011,z*.011,seed+319)-.5)*5:4+noise(x*.006,z*.006,seed+321)*3;
      const r=ridged(x*.011,z*.011,seed+323)*.65+ridged(x*.029,z*.029,seed+325)*.35;
      let base=0,sum=0;for(const {p,D} of near){const k=Math.exp(-(D-D0)/45);base+=level(p)*k;sum+=k;}base/=sum;
      let up=0,down=0,best=null,shearF=0;
      for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){
        const P=near[i],Q=near[j],third=near.reduce((m,o,k)=>k===i||k===j?m:Math.min(m,o.D),Infinity),w=clamp((third-Q.D)/180,0,1);if(!w)continue;
        const a=P.p,b=Q.p,ex=b.x-a.x,ez=b.z-a.z,len=Math.hypot(ex,ez),nx=ex/len,nz=ez/len,rx=a.vx-b.vx,rz=a.vz-b.vz;
        // Belt coordinates use one orientation per plate pair (by plate index), so they don't flip where the nearer plate changes.
        const o=a.i<b.i||a.i===b.i&&a.j<b.j?1:-1,u=o*(z*nx-x*nz),s=o*(x*nx+z*nz),belt=(ridged(u*.003,s*.009,seed+329)*.6+ridged(u*.008,s*.02,seed+330)*.4)*.7+r*.3,peaks=.5+.8*noise(u*.004,len*.01,seed+332);
        const conv=rx*nx+rz*nz,shear=Math.abs(rz*nx-rx*nz),edge=(Q.D**2-P.D**2)/(2*len),f=clamp(1-edge/W,0,1),c=clamp(conv/1.1,0,1);
        // Distance from the boundary measured into the continental side (negative offshore) for ocean–continent margins.
        const land=a.continental?edge:-edge;let v=0,setting=null;
        if(conv>.2){
          if(a.continental&&b.continental){v=c*(150*f**1.6*(.3+.7*belt)*peaks+14*clamp(1-edge/(W*2.2),0,1));setting='collision';}
          else if(a.continental!==b.continental){v=land>0?c*105*Math.exp(-(((land-95)/60)**2))*clamp(land/30,0,1)*(.35+.65*belt)*peaks:-9*c*Math.exp(-(((land+40)/30)**2))*clamp(-land/20,0,1);setting=land>0?'subduction':'trench';}
          else{v=c*f*clamp((noise(x*.009,z*.009,seed+327)-.55)/.12,0,1)*40*(.5+.5*r);setting='arc';}
        }else if(conv<-.45){v=a.continental&&b.continental?-8*f**1.5*clamp(-conv/1.1,0,1):3*f;setting='rift';}
        else if(shear>.6)shearF=Math.max(shearF,f*w);
        v*=w;if(v>0)up=Math.max(up,v);else down=Math.min(down,v);
        if(setting&&(!best||Math.abs(v)>best.v))best={v:Math.abs(v),setting,f:f*w};
      }
      let relief=(up+down)*(1-open*.85),setting='craton',f=0;
      if(best&&best.v>1){setting=best.setting;f=best.f;}else if(shearF>.4){setting='transform';f=shearF;}
      let h=base+relief;if(open)h+=open*Math.max(0,SEA+4-h);
      if(h<SEA)setting=h>SEA-6?'shelf':'ocean';
      return {h,base:base+(relief<0?relief:0),relief,setting,f,cone:0};
    }
    // Stratovolcanoes on the land side of subduction margins and in island arcs: one candidate per 700 m cell, a smooth
    // cone 110-190 m high with a summit crater. They are part of plate relief, so rivers route around them and they cast
    // rain shadows; tall cones on high ground are capped softly below the column ceiling.
    const VG=700,volcanoes=new Map();
    function volcanoCell(i,j){
      const k=i*65536+j;if(volcanoes.has(k))return volcanoes.get(k);let v=null;
      if(hash(i,j,seed+421)<.55){
        const x=(i+.25+.5*hash(i,j,seed+423))*VG,z=(j+.25+.5*hash(i,j,seed+425))*VG;
        if(Math.hypot(x,z)>400){const p=plateRelief(x,z);if((p.setting==='subduction'||p.setting==='arc')&&p.h>SEA){const H=110+80*hash(i,j,seed+427);v={x,z,H,R:H*2.6};}}
      }
      volcanoes.set(k,v);if(volcanoes.size>4096)volcanoes.delete(volcanoes.keys().next().value);return v;
    }
    function tectonics(x,z){
      const t=plateRelief(x,z),i=Math.floor(x/VG),j=Math.floor(z/VG);let cone=0,vx=0,vz=0;
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
        const V=volcanoCell(i+di,j+dj);if(!V)continue;const d=Math.hypot(x-V.x,z-V.z);if(d>=V.R)continue;
        let c=V.H*(1-d/V.R)**1.8;const crater=V.R*.05;if(d<crater)c-=V.H*.06*(1-d/crater);if(c>cone){cone=c;vx=V.x;vz=V.z;}
      }
      if(!cone)return t;
      let h=t.h+cone;if(h>215)h=215+(h-215)*.3;
      return {...t,h,cone:h-t.h,vx,vz};
    }
    // Climate on a 32 m grid: latitude temperature, banded prevailing winds, moisture carried from sea and rained out on rising ground.
    // Latitude changes one degree per 170 m and folds at the poles, so a few kilometres span cool-temperate to warm and an endless
    // walk cycles through every climate instead of freezing over. Home sits at a temperate 24-40 degrees.
    const latAngle=hash(seed,13,seed+331)*Math.PI*2,latCos=Math.cos(latAngle),latSin=Math.sin(latAngle),lat0=24+hash(seed,17,seed+333)*16,twist=(hash(seed,19,seed+335)-.5)*.8;
    const climateCells=new Map(),CG=32;
    function latitude(x,z){const a=((lat0+(x*latCos+z*latSin)/170+90)%360+360)%360;return a<180?a-90:270-a;}
    function wind(lat){const L=Math.abs(lat),dir=L<30||L>60?-1:1,t=twist;return {x:dir*(-latSin*Math.cos(t)-latCos*Math.sin(t)),z:dir*(latCos*Math.cos(t)-latSin*Math.sin(t))};}
    // Slow region fields ride along in the cached cell: V and U pick among biomes that share a climate (kilometre-scale, gently
    // domain-warped, so regions are large blobs), A marks the few large arid basins (deserts, badlands) and dries their moisture.
    function climateCell(i,j){
      const k=i*16777216+j;let v=climateCells.get(k);if(v)return v;
      const x=i*CG,z=j*CG,lat=latitude(x,z),w=wind(lat);let m=.6,prev=null,lift=0;
      for(let s=10;s>=0;s--){const e=tectonics(x-w.x*48*s,z-w.z*48*s).h;if(e<SEA)m=1;else{if(prev!==null){const rise=Math.max(0,e-Math.max(prev,SEA));const rain=Math.min(m*.3,rise*.007);m-=rain;if(s<=1)lift+=rise;}m=m*.995+.004;}prev=e;}
      const here=tectonics(x,z).h,T=29-.4*Math.abs(lat)+(noise(x*.0011,z*.0011,seed+343)-.5)*7+(noise(x*.003,z*.003,seed+337)-.5)*3-.17*Math.max(0,here-SEA);
      const wx=x+(noise(x*.0015,z*.0015,seed+345)-.5)*700,wz=z+(noise(x*.0015,z*.0015,seed+347)-.5)*700;
      const V=noise(wx*.0011,wz*.0011,seed+349)*.7+noise(wx*.004,wz*.004,seed+351)*.3,U=noise(wz*.0009,wx*.0009,seed+353)*.7+noise(wx*.0035,wz*.0035,seed+355)*.3;
      const A=clamp((noise(wx*.00028,wz*.00028,seed+357)*.8+noise(wx*.0012,wz*.0012,seed+359)*.2-.6)/.12,0,1)*clamp((Math.hypot(x,z)-900)/1200,0,1);
      const M=clamp((m*.8+lift*.008+(noise(wx*.0008,wz*.0008,seed+361)-.5)*.35+(noise(x*.005,z*.005,seed+339)-.5)*.08)*(1-.7*A),0,1);
      v={T,M,V,U,A};climateCells.set(k,v);if(climateCells.size>8192)climateCells.delete(climateCells.keys().next().value);return v;
    }
    function climate(x,z){
      const gx=x/CG,gz=z/CG,i=Math.floor(gx),j=Math.floor(gz),u=gx-i,w=gz-j,a=climateCell(i,j),b=climateCell(i+1,j),c=climateCell(i,j+1),d=climateCell(i+1,j+1),mix=k=>(a[k]+(b[k]-a[k])*u)*(1-w)+(c[k]+(d[k]-c[k])*u)*w;
      return {T:mix('T'),M:mix('M'),V:mix('V'),U:mix('U'),A:mix('A')};
    }
    // Mountains zone by temperature: montane conifer forest, subalpine parkland, alpine meadow, then snow on all but cliffs.
    // R: lowland region values for the column (see region()): V/U pick among same-climate biomes, A is aridity (desert and
    // badlands only inside the few large arid basins), j* are small per-column jitters so lowland borders are ragged, not contours.
    function biomeOf(T,M,h,wet,steep,cliff,mountain,sheer=cliff,R=null){
      if(h<SEA)return 'sea';
      if(mountain&&h>=SEA+1.2){
        if(T<-3&&!sheer)return 'snow';
        if(cliff&&T<2)return 'alpine';
        if(T<-1)return 'meadow';
        if(T<1.5)return 'subalpine';
        if(T<16&&M>.15&&!(wet&&M>.5))return 'montane';
      }
      if(T<-5&&!cliff)return 'snow';
      if(steep&&T<3)return 'alpine';
      if(h<SEA+1.2)return T<0?'tundra':'beach';
      const V=R?R.V:.5,U=R?R.U:.5,A=R?R.A:0;if(R){T+=R.jt;M+=R.jm;}
      if(wet&&M>.5&&T>0&&!steep)return T<13&&V>.5?'fen':'wetland';
      if(T<1)return 'tundra';
      // Cool: boreal forest where wet enough, otherwise heather moor; bare tundra only near freezing.
      if(T<7)return M>.42?'boreal':T<3.5?'tundra':'heath';
      if(T<19){
        if(M>.82&&T<13&&!steep&&U>.58)return 'fen';
        if(M>.68&&T>=9&&T<16&&V>.58&&!wet)return 'redwood';
        if(M>.5)return T<12.5&&V<.4?'autumn':T>=11.5&&U>.6?'blossom':'forest';
        if(M>.24)return T<10.5&&V<.3?'heath':U<.36?'flowers':T>=12&&V>.64?'pinkgrass':'grassland';
        return A>.55&&M<.24&&T>=13?'desert':'steppe';
      }
      // Warm: rainforest, bamboo on its wetter hills and fringes, savanna (golden in its own regions), deserts and badlands in arid basins.
      if(M>.72)return U>.62||h>SEA+14&&U>.45?'bamboo':'rainforest';
      if(M>.56&&(h>SEA+10||U>.55))return 'bamboo';
      if(A>.55&&M<.32)return V>.58||h>SEA+18?'badlands':'desert';
      return V>.5?'golden':'savanna';
    }
    // Lowland region values for biomeOf: the cached region fields plus per-column jitter (about 20 m and 6 m wobble).
    function region(C,x,z){
      const f=(noise(x*.21,z*.21,seed+365)-.5)*.6,j=noise(x*.05,z*.05,seed+363)-.5+f,k=noise(x*.045,z*.045,seed+367)-.5-f;
      return {V:C.V+j*.14,U:C.U+k*.14,A:C.A,jt:j*1.8,jm:k*.08};
    }
    const TREES={steppe:.03,redwood:.95,rainforest:.92,forest:.82,montane:.86,boreal:.78,subalpine:.3,meadow:.02,wetland:.3,savanna:.1,grassland:.06,tundra:.03,
      flowers:.03,autumn:.8,blossom:.5,fen:.1,heath:.04,golden:.06,bamboo:.9,badlands:.01,pinkgrass:.04,desert:0,beach:0};
    // Vegetated ground: everything tree floors, scree, worn patches and landmarks may paint over. GRASSY: where voxel flowers grow.
    const TURF=new Set([MAT.grass,MAT.tundra,MAT.dry,MAT.dirt,MAT.mossy,MAT.lushgrass,MAT.sungrass,MAT.buttercup,MAT.violet,MAT.autumngrass,MAT.pinkgrass,MAT.sphagnum,MAT.heather,MAT.steppegrass,MAT.savgrass,MAT.goldgrass,MAT.junglefloor]);
    const GRASSY=new Set([MAT.grass,MAT.lushgrass,MAT.sungrass,MAT.pinkgrass]);
    // Biome ground palette. n and n2 are ~30-45 m tone blobs whose edges are roughened by 3 m noise, so patches of one
    // material never meet another along a straight voxel line; flower and petal speckle is per 50 cm patch (finer
    // speckle multiplies mesh quads), and plain grassland, forest and jungle floors carry no speckle at all.
    // s: per-cell speckle that sprinkles a second tone through each patch, so fills read as grass texture rather than flat paint.
    function turf(b,x,z,h,g){
      const r=(noise(x*.3,z*.3,seed+703)-.5)*.16,n=noise(x*.03,z*.03,seed+701)+r,n2=noise(x*.022+40,z*.022,seed+705)-r,s=hash(Math.floor(x*2),Math.floor(z*2),seed+713);
      switch(b){
        case 'flowers':{const p=noise(x*.07,z*.07,seed+709)+(noise(x*.4,z*.4,seed+711)-.5)*.2;
          if(p>.45&&s<Math.min(.4,(p-.45)*1.1))return n2<.45?MAT.buttercup:n2<.68?MAT.violet:s<.05?MAT.flower:MAT.buttercup;
          return s>.9?MAT.sungrass:n<.45?MAT.lushgrass:n>.75?MAT.sungrass:MAT.grass;}
        case 'pinkgrass':return n2>.32-(g.riverDistance<30?.22:0)?(s<.16?MAT.violet:s>.9?MAT.sungrass:MAT.pinkgrass):s>.93?MAT.pinkgrass:n<.5?MAT.sungrass:MAT.grass;
        case 'autumn':return n2>.62?(s<.25?MAT.autumngrass:MAT.autumnlitter):s<.1?MAT.autumnlitter:n<.33?MAT.sungrass:MAT.autumngrass;
        case 'blossom':return s<.06+.3*clamp((n2-.55)*4,0,1)?MAT.petal:n<.4?MAT.lushgrass:MAT.grass;
        case 'fen':return n2>.86&&r>-.02?MAT.mud:n>.55?(s<.2?MAT.mossy:MAT.sphagnum):n<.3?MAT.lushgrass:s<.15?MAT.sphagnum:MAT.mossy;
        case 'heath':return n2>.45?(s<.3?MAT.sungrass:s<.4?MAT.violet:MAT.heather):s<.12?MAT.heather:n>.55?MAT.sungrass:MAT.steppegrass;
        case 'steppe':return n>.8?(s<.4?MAT.steppegrass:MAT.dry):s<.12?MAT.goldgrass:n<.32?MAT.sungrass:MAT.steppegrass;
        case 'savanna':return n>.7?MAT.goldgrass:s<.15?MAT.goldgrass:n<.3?MAT.sungrass:MAT.savgrass;
        case 'golden':return n<.25?(s<.2?MAT.goldgrass:MAT.savgrass):s<.18?MAT.savgrass:n2>.84&&s<.5?MAT.dry:MAT.goldgrass;
        case 'bamboo':return n>.62?MAT.grass:MAT.lushgrass;
        case 'rainforest':return n>.58?MAT.lushgrass:MAT.junglefloor;
        case 'desert':return n2>.72?MAT.sand:MAT.dune;
        // Badlands: clay, ochre and pale bands that follow height, so hillsides read as layered strata.
        case 'badlands':{const k=Math.floor(h*cellMetres/1.25+(noise(x*.05,z*.05,seed+715)-.5)*1.4+r*3);return [MAT.clay,MAT.ochre,MAT.clay,MAT.dry][(k%4+4)%4];}
        case 'tundra':return MAT.tundra;
        case 'grassland':case 'forest':case 'wetland':case 'redwood':return n<.32?MAT.lushgrass:n>.7?MAT.sungrass:MAT.grass;
        default:return b==='boreal'&&n>.74?MAT.tundra:MAT.grass;
      }
    }
    // Home massif: stepped plateau walled by vertical 4.5 m tiers; inside notch zones the same uplift is a climbable ramp (a pass).
    function massifDistance(x,z){
      const dx=x-massifX,dz=z-massifZ,along=-dx*Math.sin(massifAngle)+dz*Math.cos(massifAngle),across=dx*Math.cos(massifAngle)+dz*Math.sin(massifAngle);
      return Math.hypot(along/1.9,across*1.15)+(noise(x*.03,z*.03,seed+245)-.5)*10;
    }
    function upliftAt(x,z){
      const dm=massifDistance(x,z);if(dm>46)return {lift:0,pass:false,up:0};
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
    // Drainage network: a regional hydrology bake on a jittered 64 m node grid, per 2 km tile with a 2 km margin on every
    // side. Nodes sample the landform at that scale (plate relief, massif tiers and the broad crag octaves), so rivers find
    // valleys and pass around peaks rather than through them. A priority-flood from the sea routes every node downhill;
    // each drowned basin is then judged: a deep, sizeable one with a channel leaving it becomes a lake, the rest are
    // breached (the outlet is cut down so the channel keeps falling and no puddle-lakes appear). Upstream area grades
    // channels into main rivers, streams and creeks, and only systems whose mouth drains a real catchment are drawn, so
    // coastal slopes don't sprout rows of short parallel creeks. Creek heads are springs. Sky-isle waterfalls land on the
    // ground as extra sources whose water is routed downstream like any other.
    // Creases (an inverted ridge map): node heights sink along a 0-1 crease field so flow on even slopes gathers into
    // winding valley lines (and the carve below opens them) instead of running down in parallel straight lines. Creases
    // only lower the ground the drainage sees, never raise it, so channel levels stay at or below the land; they fade out
    // toward sea level so coastal plains keep their land and their rivers meander instead.
    // CREASE HOOK (wired by the coordinator at merge): the eroded-terrain filter exposes a 0-1 `crease` (valley-line) field
    // via geography()/world.erosionAt(x,z). Call world.setDrainageCrease((x,z)=>world.erosionAt(x,z).crease) (or assign
    // creaseAt here) to use it instead of the stand-in below, so creeks and small streams follow the eroded crease lines.
    // At 64 m node spacing this biases routing between nodes; it doesn't align channels to features finer than that.
    let creaseAt=null;const CREASE_DEPTH=3.5;
    function ownCrease(x,z){
      const wx=x+(noise(x*.0021,z*.0021,seed+371)-.5)*260,wz=z+(noise(x*.0021,z*.0021,seed+373)-.5)*260;
      return (1-Math.abs(noise(wx*.0034,wz*.0034,seed+375)*2-1))**3;
    }
    const N8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    const DRAIN=[{G:64,T:32,M:32,salt:341,tiles:new Map(),cap:16}];
    function drainTile(lv,ti,tj){
      const D=DRAIN[lv],key=ti*65536+tj;let T=D.tiles.get(key);if(T)return T;
      const {G,T:TS,M:MG}=D,W=TS+2*MG,i0=ti*TS-MG,j0=tj*TS-MG,n=W*W;
      const px=new Float32Array(n),pz=new Float32Array(n),h=new Float32Array(n),rel=new Float32Array(n),fill=new Float32Array(n),down=new Int32Array(n).fill(-1),acc=new Float32Array(n),done=new Uint8Array(n),order=new Int32Array(n);
      const fed=new Uint8Array(n),src=new Map();
      for(let j=0;j<W;j++)for(let i=0;i<W;i++){
        const k=j*W+i,gi=i0+i,gj=j0+j;px[k]=(gi+.2+.6*hash(gi,gj,seed+D.salt))*G;pz[k]=(gj+.2+.6*hash(gi,gj,seed+D.salt+2))*G;
        const t=tectonics(px[k],pz[k]);cragAt(px[k],pz[k],t.relief,t.cone);
        const g=t.h+upliftAt(px[k],pz[k]).up+cragLow;h[k]=g<SEA?g:g-(creaseAt||ownCrease)(px[k],pz[k])*CREASE_DEPTH*clamp((g-SEA-.5)/12,0,1);rel[k]=Math.max(t.relief,t.cone);
      }
      const hk=new Float64Array(n),hv=new Int32Array(n);let hn=0,on=0;
      const push=(e,k)=>{let c=hn++;while(c>0){const q=(c-1)>>1;if(hk[q]<=e)break;hk[c]=hk[q];hv[c]=hv[q];c=q;}hk[c]=e;hv[c]=k;};
      const pop=()=>{const k=hv[0],e=hk[--hn],v=hv[hn];let c=0;for(;;){let l=2*c+1;if(l>=hn)break;if(l+1<hn&&hk[l+1]<hk[l])l++;if(hk[l]>=e)break;hk[c]=hk[l];hv[c]=hv[l];c=l;}hk[c]=e;hv[c]=v;return k;};
      for(let k=0;k<n;k++){const i=k%W,j=(k/W)|0;if(i===0||j===0||i===W-1||j===W-1||h[k]<SEA){done[k]=1;fill[k]=h[k];push(h[k],k);}}
      while(hn){const c=pop(),ci=c%W,cj=(c/W)|0;order[on++]=c;for(const [di,dj] of N8){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=W||j>=W)continue;const k=j*W+i;if(done[k])continue;done[k]=1;fill[k]=Math.max(h[k],fill[c]+.01);down[k]=c;push(fill[k],k);}}
      // The flood only proves a way down exists; water takes the steepest one (over the filled surface, so it stays
      // acyclic and lakes still drain through their spill). On jittered nodes this bends courses instead of leaving the
      // long straight diagonal chains of flood order.
      for(let k=0;k<n;k++){
        if(down[k]<0)continue;const ki=k%W,kj=(k/W)|0;let best=down[k],bs=(fill[k]-fill[best])/Math.hypot(px[best]-px[k],pz[best]-pz[k]);
        for(const [di,dj] of N8){const i=ki+di,j=kj+dj;if(i<0||j<0||i>=W||j>=W)continue;const m=j*W+i;if(fill[m]>=fill[k])continue;const s=(fill[k]-fill[m])/Math.hypot(px[m]-px[k],pz[m]-pz[k]);if(s>bs){bs=s;best=m;}}
        down[k]=best;
      }
      // Isle waterfalls: the node nearest each landing point becomes a source fed from the sky.
      for(let j=Math.floor(j0*G/IG);j<=Math.floor((j0+W)*G/IG);j++)for(let i=Math.floor(i0*G/IG);i<=Math.floor((i0+W)*G/IG);i++){
        const F=isleCell(i,j)?.fall;if(!F)continue;let best=-1,bd=1e9;const ci=Math.floor(F.x/G)-i0,cj=Math.floor(F.z/G)-j0;
        for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const a=ci+di,b=cj+dj;if(a<0||b<0||a>=W||b>=W)continue;const k=b*W+a,d=Math.hypot(px[k]-F.x,pz[k]-F.z);if(d<bd){bd=d;best=k;}}
        if(best>=0&&h[best]>=SEA){fed[best]=1;src.set(best,{x:F.x+(noise(F.x*.02,F.z*.02,seed+345)-.5)*12,z:F.z+(noise(F.x*.02,F.z*.02,seed+347)-.5)*12});}
      }
      for(let o=on-1;o>=0;o--){const c=order[o];acc[c]+=1;if(down[c]>=0){acc[down[c]]+=acc[c];if(fed[c])fed[down[c]]=1;}}
      // Downstream-first pass: the catchment at each system's mouth, steps from the mouth, and drowned basins keyed by
      // their spill node (the first node below them that isn't drowned): depth and node count.
      const mouth=new Float32Array(n),steps=new Uint16Array(n),spill=new Int32Array(n).fill(-1),deep=new Float32Array(n),area=new Uint16Array(n);
      for(let o=0;o<on;o++){
        const c=order[o],d=down[c];
        if(d<0||h[d]<SEA){mouth[c]=acc[c];steps[c]=0;}else{mouth[c]=mouth[d];steps[c]=steps[d]+1;}
        if(d>=0&&fill[c]-h[c]>.5){const s=spill[d]>=0?spill[d]:d;spill[c]=s;deep[s]=Math.max(deep[s],fill[c]-h[c]);area[s]++;}
      }
      // Lakes: basins at least 4 m deep over 4+ nodes (or 8 m deep), with a channel leaving through the spill. Every other
      // basin is breached: its nodes keep their own height and the levels downstream are lowered until they fall again.
      const lake=new Uint8Array(n),lvl=new Float32Array(n),keep=new Map();
      for(let k=0;k<n;k++){
        const s=spill[k];if(s<0){lvl[k]=fill[k];continue;}
        let ok=keep.get(s);if(ok===undefined){ok=(deep[s]>=4&&area[s]>=4||deep[s]>=8)&&!!channelClass(acc[s],rel[s],fed[s],mouth[s]);keep.set(s,ok);}
        lake[k]=ok?1:0;lvl[k]=ok?fill[k]:h[k];
      }
      for(let o=on-1;o>=0;o--){const c=order[o],d=down[c];if(d>=0&&!lake[d]&&lvl[d]>lvl[c]-.01)lvl[d]=lvl[c]-.01;}
      // Lake nodes that carry a channel flowing in from the shore (the inflow continues across the lake to its outlet).
      const feed=new Uint8Array(n);
      for(let o=on-1;o>=0;o--){const c=order[o],d=down[c];if(d>=0&&lake[d]&&(feed[c]||!lake[c]&&channelClass(acc[c],rel[c],fed[c],mouth[c])))feed[d]=1;}
      // Meanders live in the control network: on flat lowland a channel node's curve control point is pushed sideways
      // from its downhill direction, alternating every node (creeks) or every two nodes (rivers), so the smooth course
      // swings in loops; hillside reaches only bend gently and mountain reaches stay straight. Confluences share the node,
      // so tributaries still join.
      const qx=new Float32Array(px),qz=new Float32Array(pz);
      for(let k=0;k<n;k++){
        const d=down[k];if(d<0||h[k]<SEA||lake[k])continue;const C=channelClass(acc[k],rel[k],fed[k],mouth[k]);if(!C)continue;
        const ex=px[d]-px[k],ez=pz[d]-pz[k],L=Math.hypot(ex,ez)||1,grade=Math.max(0,lvl[k]-lvl[d])/L;
        const flat=(.3+.7*clamp(1-grade/.06,0,1))*clamp(1-rel[k]/30,0,1),side=((C.s>=.6?steps[k]>>1:steps[k])&1?1:-1)*(.65+.35*hash(k%W+i0,((k/W)|0)+j0,seed+349));
        const a=flat*(6+3.2*C.hw)*side;qx[k]=px[k]-ez/L*a;qz[k]=pz[k]+ex/L*a;
      }
      // Per-node channel class (half-width, reach, head area; head 0 = no channel; spring = a creek head), and falls: a
      // reach dropping at least 7 m at over 18% onto a reach less than half as steep is a real step, so its water falls.
      const hw=new Float32Array(n),cs=new Float32Array(n),head=new Float32Array(n),knick=new Uint8Array(n),spring=new Uint8Array(n);
      for(let k=0;k<n;k++){const C=channelClass(acc[k],rel[k],fed[k],mouth[k]);if(C){hw[k]=C.hw;cs[k]=C.s;head[k]=C.head;spring[k]=C.head<Infinity&&acc[k]<C.head*2&&!lake[k]?1:0;}}
      const grade=k=>{const d=down[k];return d<0?0:(lvl[k]-lvl[d])/(Math.hypot(px[d]-px[k],pz[d]-pz[k])||1);};
      for(let k=0;k<n;k++){const d=down[k];if(!head[k]||d<0||h[k]<SEA||lake[k]||lvl[d]<SEA+1)continue;const g=grade(k);if(g>.18&&lvl[k]-lvl[d]>=7&&grade(d)<g*.5)knick[k]=1;}
      T={i0,j0,W,px,pz,qx,qz,h,lvl,lake,feed,down,acc,rel,fed,mouth,hw,cs,head,spring,knick,src};D.tiles.set(key,T);if(D.tiles.size>D.cap)D.tiles.delete(D.tiles.keys().next().value);return T;
    }
    // Channel classes by upstream area. hw: half-width (m); s: how far its influence reaches (banks, sand, tree-free strip)
    // relative to a main river; head: area where the channel starts.
    // Channels whose system reaches its mouth with under 20 nodes of catchment aren't drawn (unless fed by an isle fall).
    function channelClass(acc,rel,fed,mouth){
      if(mouth<20&&!fed)return null;
      if(acc>=60)return {hw:Math.min(12,1+.42*Math.sqrt(acc)),s:1,head:60};
      if(acc>=20)return {hw:.9+.2*Math.sqrt(acc),s:.6,head:20};
      const need=rel>15?4:8;if(acc>=need)return {hw:.35+.06*Math.sqrt(acc),s:.3,head:need};
      return fed?{hw:.6,s:.3,head:Infinity}:null;
    }
    // Nearest channel to the (lightly warped) point. `e` is the normalized distance: (metres beyond the half-width) / s,
    // offset by 2.3 so 0..2.3 is the channel floor. Each node's course is a quadratic B-spline through its control points
    // (from the A-B midpoint, bent by B, to the B-C midpoint), so courses are smooth and tributaries meet tangentially.
    // Width and reach grow smoothly from A's class to B's, and a river widens into an estuary as it reaches sea level.
    function courseAt(lv,wx,wz,best=null){
      const D=DRAIN[lv],G=D.G,ii=Math.floor(wx/G),jj=Math.floor(wz/G);let tk=NaN,T=null,r=best||{e:999};
      for(let gj=jj-2;gj<=jj+2;gj++)for(let gi=ii-2;gi<=ii+2;gi++){
        const ti=Math.floor(gi/D.T),tj=Math.floor(gj/D.T);if(ti*65536+tj!==tk){tk=ti*65536+tj;T=drainTile(lv,ti,tj);}
        const a=(gj-T.j0)*T.W+(gi-T.i0),b=T.down[a];
        // A lake is open water over its drowned nodes at the spill level. An inflow's channel runs on through it (at that
        // level) so it reaches the water wherever the shore lies; geography() doesn't carve it where the ground is under the
        // lake. Other lake nodes draw no channel and no springs.
        if(T.lake[a]){if(Math.hypot(wx-T.px[a],wz-T.pz[a])<G*1.6)r.lake=Math.max(r.lake||0,T.lvl[a]);if(!T.feed[a])continue;}
        if(!T.head[a]||T.h[a]<SEA||b<0)continue;
        const Ah=T.hw[a],As=T.cs[a],Bh=T.head[b]?T.hw[b]:Ah,Bs=T.head[b]?T.cs[b]:As,ax=T.qx[a],az=T.qz[a];
        const bx=T.qx[b],bz=T.qz[b],c=T.down[b],cx=c<0?bx:(bx+T.qx[c])/2,cz=c<0?bz:(bz+T.qz[c])/2,F=T.src.get(a);
        const wide=Math.max(Ah,Bh)*(Bs>=.6?1.8:1),sMax=Math.max(As,Bs),sMin=Math.min(As,Bs);
        // Box prune: every piece lies within the box of A, B, the B-C midpoint (and an isle-fall landing that feeds A).
        {let x0=Math.min(ax,bx,cx),x1=Math.max(ax,bx,cx),z0=Math.min(az,bz,cz),z1=Math.max(az,bz,cz);if(F){x0=Math.min(x0,F.x);x1=Math.max(x1,F.x);z0=Math.min(z0,F.z);z1=Math.max(z1,F.z);}
          const dx=wx<x0?x0-wx:wx>x1?wx-x1:0,dz=wz<z0?z0-wz:wz>z1?wz-z1:0,m=Math.hypot(dx,dz)-wide;if(m/(m>=0?sMax:sMin)+2.3>=r.e)continue;}
        const fa=T.lvl[a],fb=T.lvl[b],fc=c<0?fb:(fb+T.lvl[c])/2;
        // pieces: straight sub-segments of the course, with parameter U0..U1 along the whole curve, levels f0..f1;
        // width and reach blend from A's class to B's along the curve.
        let fall=null;
        const piece=(x0,z0,f0,x1,z1,f1,U0,U1,spring=false)=>{
          const ex=x1-x0,ez=z1-z0,t=clamp(((wx-x0)*ex+(wz-z0)*ez)/(ex*ex+ez*ez||1),0,1),qx=x0+ex*t,qz=z0+ez*t,dist=Math.hypot(wx-qx,wz-qz),U=U0+(U1-U0)*t;
          let level=f0+(f1-f0)*t,foam=false;
          if(fall){const q=U*fall.k,step=Math.ceil(q-1e-6);level=fall.f0+(fall.f1-fall.f0)*Math.min(1,step/fall.k);foam=q>.001&&step<fall.k&&(q-Math.floor(q))*fall.len/fall.k<3;}
          const hw=(Ah+(Bh-Ah)*U)*(Bs>=.6?1+.8*clamp((SEA+1.2-level)/1.2,0,1):1),s=As+(Bs-As)*U,e=(dist-hw)/s+2.3;
          if(e<r.e)Object.assign(r,{e,dist,hw,s,level,foam,x:qx,z:qz,spring});
        };
        if(F)piece(F.x,F.z,fa,ax,az,fa,0,0);
        else if(T.spring[a]){
          // A creek head is a spring: a small pool where groundwater rises.
          if(As<.5){const sd=Math.hypot(wx-ax,wz-az),e=(sd-1.6)/As+2.3;if(e<r.e)Object.assign(r,{e,dist:sd,hw:1.6,s:As,level:fa,foam:false,x:ax,z:az,spring:true});}
          piece(ax,az,fa,(ax+bx)/2,(az+bz)/2,(fa+fb)/2,0,0);
        }
        const mx=(ax+bx)/2,mz=(az+bz)/2,fm=(fa+fb)/2,len=Math.hypot(bx-mx,bz-mz)+Math.hypot(cx-bx,cz-bz),drop=fm-fc,N=As>=.6?8:4;
        // At a real step (see knick in drainTile) the water drops in falls of about 5 m, each reach holding the LOWER
        // level, so a fall is a notch cut into the land with foam in the plunge pool just below it. Everywhere else the
        // water runs down as a continuous slope.
        if(T.knick[a]&&drop>=3)fall={k:Math.max(1,Math.round(drop/5)),f0:fm,f1:fc,len};
        let p0x=mx,p0z=mz,p0f=fm;
        for(let k=1;k<=N;k++){const t=k/N,u=1-t,qx=u*u*mx+2*u*t*bx+t*t*cx,qz=u*u*mz+2*u*t*bz+t*t*cz,qf=u*u*fm+2*u*t*fb+t*t*fc;piece(p0x,p0z,p0f,qx,qz,qf,(k-1)/N,t);p0x=qx;p0z=qz;p0f=qf;}
      }
      return r.e<999?r:null;
    }
    // A light meander warp only (meander loops come from the control network above).
    function riverAt(x,z){
      const wx=x+(noise(x*.02,z*.02,seed+345)-.5)*12,wz=z+(noise(x*.02,z*.02,seed+347)-.5)*12;
      const r={e:999,lake:0};courseAt(0,wx,wz,r);
      return {d:r.e,level:r.level||0,lake:r.lake||0,w:r.e<999?r.hw:0,foam:!!r.foam,spring:!!r.spring,size:r.s||0};
    }
    // Mountain detail on top of plate relief: squared ridged noise gives sharp arêtes and summits, scaled by how much the plates lift here.
    // Domain-warped so ridgelines wander, and modulated by a broad field so peaks cluster into massifs between lower cols.
    // Eroded mountain detail: value-noise octaves whose strength fades where the octaves above are already steep
    // (gradient-damped fBm), so detail collects into branching ridges and V-valleys instead of uniform bumps. The result is
    // raised to a power so summits sharpen into horns. Volcano flanks get the same detail, weaker, scaled by the cone.
    let cragLow=0;
    function noiseD(x,z,k,out){
      const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz),dsx=6*fx*(1-fx),dsz=6*fz*(1-fz);
      const a=hash(ix,iz,k),b=hash(ix+1,iz,k),c=hash(ix,iz+1,k),d=hash(ix+1,iz+1,k),e=a-b-c+d;
      out[0]=a+(b-a)*sx+(c-a)*sz+e*sx*sz;out[1]=dsx*((b-a)+e*sz);out[2]=dsz*((c-a)+e*sx);
    }
    const nd=[0,0,0];
    function cragAt(x,z,relief,cone=0){
      const m=Math.max(clamp((relief-6)/50,0,1),clamp(cone/70,0,1)*.6);if(!m){cragLow=0;return 0;}
      const wx=x+(noise(x*.008,z*.008,seed+355)-.5)*50,wz=z+(noise(x*.008,z*.008,seed+357)-.5)*50,massif=.6+.4*noise(x*.004,z*.004,seed+359);
      let px=wx*.011,pz=wz*.011,sum=0,gx=0,gz=0,amp=1,norm=0;
      for(let o=0;o<6;o++){
        noiseD(px,pz,seed+351+o,nd);gx+=nd[1]*amp;gz+=nd[2]*amp;
        sum+=amp*nd[0]/(1+gx*gx+gz*gz);norm+=amp;
        if(o===1)cragLow=sum/norm;
        amp*=.5;const qx=1.6*px-1.2*pz,qz=1.2*px+1.6*pz;px=qx;pz=qz;
      }
      const f=clamp(sum/norm*1.5-.15,0,1.2),A=Math.max(relief,cone*.55)*.6*m*massif;
      cragLow=A*clamp(cragLow*1.5-.15,0,1.2)**1.7;
      return A*f**1.7;
    }
    // Basalt outcrops: small scattered knolls (one candidate per 36 m cell, 2-4.5 m across), never broad sheets of rock.
    // They gather below the home massif's cliffs, where fallen blocks would lie.
    function outcropAt(x,z){
      const G=36,i=Math.floor(x/G),j=Math.floor(z/G),cx=(i+.25+.5*hash(i,j,seed+363))*G,cz=(j+.25+.5*hash(i,j,seed+367))*G;
      if(hash(i,j,seed+361)>(massifDistance(cx,cz)<70?.9:.4))return 0;
      const r=2+2.5*hash(i,j,seed+365),d=Math.hypot(x-cx,z-cz)+(noise(x*.4,z*.4,seed+369)-.5)*1.6;
      return d<r?1-d/r:0;
    }
    // Sky isles: aether-lifted rock, one candidate per 120 m cell, commoner over mountain belts. Not ground: crew walk beneath them.
    const IG=120,isles=new Map();
    function isleCell(i,j){
      const k=i*65536+j;if(isles.has(k))return isles.get(k);
      let v=null;const p=hash(i,j,seed+371);
      if(p<.45){
        const x=(i+.3+.4*hash(i,j,seed+373))*IG,z=(j+.3+.4*hash(i,j,seed+375))*IG,t=tectonics(x,z);
        // Only over high mountain ground, gathered into sky-isle highlands (a broad regional field).
        const highlands=clamp((noise(x*.0015,z*.0015,seed+389)-.42)/.15,0,1);
        if(p<.45*highlands*clamp((Math.max(t.relief,t.cone)-22)/15,0,1)&&Math.hypot(x,z)>90){
          // Hover clear of the highest ground beneath the whole slab.
          const r=8+13*hash(i,j,seed+377);let under=SEA;
          for(const [u,v] of [[0,0],[r,0],[-r,0],[0,r],[0,-r],[.7*r,.7*r],[-.7*r,.7*r],[.7*r,-.7*r],[-.7*r,-.7*r]]){const q=tectonics(x+u,z+v);under=Math.max(under,q.h+cragAt(x+u,z+v,q.relief,q.cone)+12);}
          const top=Math.min(heightCells*cellMetres-14,under+22+30*hash(i,j,seed+379));
          v={x,z,r,top,cold:climate(x,z).T-.17*Math.max(0,top-t.h)<-5,fall:null};
          // About 40% of isles spill a thin waterfall from under the rim (the outermost point still on the slab).
          if(hash(i,j,seed+387)<.4)for(let n=0,a=hash(i,j,seed+389)*Math.PI*2;n<12&&!v.fall;n++,a+=.52)for(const f of [.88,.8,.7]){const fx=x+Math.cos(a)*r*f,fz=z+Math.sin(a)*r*f,S=isleShape(v,fx,fz);if(S){v.fall={x:fx,z:fz,bottom:S.bottom};break;}}
        }
      }
      isles.set(k,v);if(isles.size>4096)isles.delete(isles.keys().next().value);return v;
    }
    // Floating slab at (x,z): {bottom, top} in metres, with a glowing crystal keel under its centre.
    function isleAt(x,z){const I=isleCell(Math.floor(x/IG),Math.floor(z/IG));return I?isleShape(I,x,z):null;}
    function isleShape(I,x,z){
      const d=Math.hypot(x-I.x,z-I.z)/I.r+(noise(x*.06,z*.06,seed+381)-.5)*.55+(noise(x*.2,z*.2,seed+385)-.5)*.12;if(d>=1)return null;
      const top=I.top+(1-d*d)*2.5,bottom=top-2-I.r*(.12+1.1*(1-d)**1.3)*(.75+.5*noise(x*.15,z*.15,seed+383));
      return {top,bottom,keel:d<.14?bottom-3*(1-d/.14):bottom,cold:I.cold};
    }
    // Aether crystal spires: leaning, tapering violet pillars in clusters, mostly in mountains and along gorges, rarely in the lowlands.
    const SG=44,spireCells=new Map();
    function spireCell(i,j){
      const k=i*65536+j;if(spireCells.has(k))return spireCells.get(k);
      let v=null;const p=hash(i,j,seed+391);
      if(p<.4){
        const x=(i+.3+.4*hash(i,j,seed+393))*SG,z=(j+.3+.4*hash(i,j,seed+395))*SG,g=geography(x,z);
        if(!g.sea&&!g.wet&&!g.highland&&Math.hypot(x,z)>40&&p<(g.gorgeDistance<24?.4:g.relief>20?.2:.02)){
          const n=3+Math.floor(hash(i,j,seed+397)*5),list=[];
          for(let s=0;s<n;s++){
            const a=hash(s,k,seed+399)*Math.PI*2,o=s?1.5+4*hash(s,k,seed+401):0,sx=x+Math.cos(a)*o,sz=z+Math.sin(a)*o,lean=.08+.14*hash(s,k,seed+403);
            list.push({x:sx,z:sz,lx:Math.cos(a)*lean,lz:Math.sin(a)*lean,r:(s?.5:1.1)+.6*hash(s,k,seed+405),h:(s?4:10)+(s?7:6)*hash(s,k,seed+407),base:geography(sx,sz).height*cellMetres-.5});
          }
          v={x,z,list,top:Math.max(...list.map(s=>s.base+s.h))};
        }
      }
      spireCells.set(k,v);if(spireCells.size>4096)spireCells.delete(spireCells.keys().next().value);return v;
    }
    const spiresNear=(x,z)=>spireCell(Math.floor(x/SG),Math.floor(z/SG));
    // World trees ("tree of life"): at most one candidate per 220 m cell (half the old chance), and a candidate yields to
    // any neighbouring candidate with a lower roll, so two never stand within ~350 m of each other (never in one view).
    // A raised grassy mound with great exposed roots arching over it; a massive twisted trunk that leans and tapers;
    // limbs fanning out to a strongly coloured canopy: violet and white blossom domes with hanging strands, or (variant)
    // flat coral umbrella pads. Some stand among a few broken ruins.
    const AG=220,ancients=new Map(),ancientSites=new Map();
    const ANCIENT_CHANCE={rainforest:.15,forest:.15,redwood:.08,montane:.06,grassland:.06,savanna:.06,wetland:.05,blossom:.15,autumn:.12,flowers:.08,pinkgrass:.05,golden:.05};
    function ancientSite(i,j){
      const k=i*65536+j;if(ancientSites.has(k))return ancientSites.get(k);let v=null;const p=hash(i,j,seed+441);
      if(p<.15){
        const x=(i+.3+.4*hash(i,j,seed+443))*AG,z=(j+.3+.4*hash(i,j,seed+445))*AG,g=geography(x,z);
        if(p<(ANCIENT_CHANCE[g.biome]||0)&&!g.exposed&&!g.highland&&g.slope<.5&&g.water<=g.height&&g.riverDistance>14&&Math.hypot(x,z)>40)v={x,z,g,p};
      }
      ancientSites.set(k,v);if(ancientSites.size>4096)ancientSites.delete(ancientSites.keys().next().value);return v;
    }
    function ancientCell(i,j){
      const k=i*65536+j;if(ancients.has(k))return ancients.get(k);let v=null;const s=ancientSite(i,j);
      if(s){
        let first=true;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;const o=ancientSite(i+di,j+dj);if(o&&o.p<s.p)first=false;}
        if(first){
          const {x,z,g}=s,H_=n=>hash(n,k,seed+447),g0=g.height*cellMetres;
          const Mr=12+5*H_(1),Mh=2.2+1.6*H_(2),base=g0+Mh-.6,H=20+7*H_(3),R=2.3+.7*H_(4),la=H_(5)*Math.PI*2,lean=3.5+3*H_(6);
          const lx=Math.cos(la)*lean,lz=Math.sin(la)*lean,cx=x+lx,cz=z+lz,cy=base+H,twist=(H_(7)<.5?1:-1)*(.25+.15*H_(8)),variant=H_(9)<.62?'blossom':'coral';
          const mound=d=>g0+Mh*(.5+.5*Math.cos(Math.PI*clamp(d/Mr,0,1)))**1.3;
          // Roots: tapering tubes from the trunk foot, arching over the mound and diving into the ground beyond it.
          const roots=[],nr=7+Math.floor(H_(10)*3);
          for(let m=0;m<nr;m++){
            const a=m/nr*Math.PI*2+(H_(20+m)-.5)*.5,len=Mr*(.75+.35*H_(40+m)),r0=R*(.4+.15*H_(60+m)),pts=[];let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
            for(let s2=0;s2<=16;s2++){
              const t=s2/16,d=R*.6+t*len,b=a+.35*Math.sin(t*3+m),px=x+Math.cos(b)*d,pz=z+Math.sin(b)*d,r=r0*(1-t)**.8+.25;
              const py=mound(d)+r*.15+1.5*Math.sin(Math.PI*Math.min(1,t*1.15))*(1-t*.5)-(t>.9?.6:0);
              pts.push({x:px,z:pz,y:py,r});x0=Math.min(x0,px-r);x1=Math.max(x1,px+r);z0=Math.min(z0,pz-r);z1=Math.max(z1,pz+r);
            }
            roots.push({pts,x0,x1,z0,z1});
          }
          // Limbs fan out and up from the leaning crown point; the canopy sits on their ends.
          const limbs=[],lumps=[],pads=[],nl=5+Math.floor(H_(11)*2);
          for(let m=0;m<nl;m++){
            const a=m/nl*Math.PI*2+(H_(80+m)-.5)*.7,reach=7+5*H_(100+m),ey=cy+2.5+4*H_(120+m),ex=cx+Math.cos(a)*reach,ez=cz+Math.sin(a)*reach;
            limbs.push({x0:cx,z0:cz,y0:cy-2,x1:ex,z1:ez,y1:ey,r0:R*.45,r1:.45});
            if(variant==='blossom')lumps.push({x:ex,z:ez,y:ey+1,r:4.5+2.5*H_(140+m)});
            else{pads.push({x:ex,z:ez,y:ey+.4,r:4.2+2.4*H_(140+m),th:1.1+.5*H_(160+m)});
              pads.push({x:cx+Math.cos(a)*reach*.55,z:cz+Math.sin(a)*reach*.55,y:cy+(ey-cy)*.45-1.2,r:2.6+1.4*H_(180+m),th:.9});}
          }
          if(variant==='blossom'){lumps.push({x:cx,z:cz,y:cy+5,r:6.5});for(let m=0;m<nl;m++){const A=lumps[m],B=lumps[(m+1)%nl];lumps.push({x:(A.x+B.x+cx)/3,z:(A.z+B.z+cz)/3,y:(A.y+B.y)/2+1.5,r:4});}}
          else pads.push({x:cx,z:cz,y:cy+5.5,r:5.2,th:1.4});
          // A few broken pillars and wall stubs among the roots.
          const stones=[];if(H_(12)<.45)for(let m=0;m<3+Math.floor(H_(13)*3);m++){const a=H_(200+m)*Math.PI*2,d=Mr*(.6+.4*H_(220+m));stones.push({x:x+Math.cos(a)*d,z:z+Math.sin(a)*d,ux:Math.cos(a+1.6),uz:Math.sin(a+1.6),wall:H_(240+m)<.4,r:.55+.3*H_(260+m),hl:1.2+.8*H_(280+m),ht:1.2+3*H_(300+m)});}
          const top=Math.max(...lumps.map(l=>l.y+l.r*.5),...pads.map(p=>p.y+p.th))+1;
          const reach=Math.max(Mr,...roots.map(r=>Math.max(Math.abs(r.x0-x),Math.abs(r.x1-x),Math.abs(r.z0-z),Math.abs(r.z1-z))),...lumps.map(l=>Math.hypot(l.x-x,l.z-z)+l.r*1.15),...pads.map(p=>Math.hypot(p.x-x,p.z-z)+p.r*1.15))+1;
          v={x,z,g0,Mr,Mh,base,H,R,lx,lz,cx,cz,cy,twist,variant,roots,limbs,lumps,pads,stones,top,reach,mound};
        }
      }
      ancients.set(k,v);if(ancients.size>4096)ancients.delete(ancients.keys().next().value);return v;
    }
    const ancientNear=(x,z)=>ancientCell(Math.floor(x/AG),Math.floor(z/AG));
    // Ruins of grand structures, one candidate per 150 m cell: a castle on raised ground (curtain wall with battlements,
    // a gate and breaches, round corner towers, a hollow keep), an old town (roofless gabled house shells along a street,
    // a chapel with a bell tower, a well), or a temple (stepped platform, colonnade with fallen columns and lintels).
    // All are crumbling: wall tops are broken by noise. Primitives: oriented boxes and (hollow) rings.
    const STG=150,ruins=new Map();
    function ruinCell(i,j){
      const k=i*65536+j;if(ruins.has(k))return ruins.get(k);let v=null;const p=hash(i,j,seed+461);
      if(p<.45){
        const x=(i+.3+.4*hash(i,j,seed+463))*STG,z=(j+.3+.4*hash(i,j,seed+465))*STG,g=geography(x,z);
        const raised=g.height*cellMetres-[[30,0],[-30,0],[0,30],[0,-30]].reduce((m,[u,w])=>m+geography(x+u,z+w).height*cellMetres,0)/4;
        // The whole footprint (out to 50 m) must be dry ground: no sea, lake, river or stream anywhere under a ruin.
        const dry=()=>{for(let r=5;r<=50;r+=5)for(let q=0;q<16;q++){const A=q/10*Math.PI*2,G2=geography(x+Math.cos(A)*r,z+Math.sin(A)*r);if(G2.sea||G2.water>G2.height||G2.riverDistance<4)return false;}return true;};
        if(!g.sea&&!g.wet&&!g.glacier&&g.biome!=='snow'&&g.slope<.45&&g.water<=g.height&&!g.gorge&&!g.highland&&Math.hypot(x,z)>60&&dry()){
          const R=n=>hash(n,k,seed+471),a=hash(i,j,seed+467)*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a),g0=g.height*cellMetres;
          const parts=[],at=(u,w)=>[x+u*ca-w*sa,z+u*sa+w*ca];let n=0;
          // box(u,w): centre in the site frame; ang: extra rotation; walls stand on each column's own ground.
          const box=(u,w,ang,hl,hw,y0,y1,o={})=>{const [cx,cz]=at(u,w),A=a+ang;parts.push({t:'box',cx,cz,ux:Math.cos(A),uz:Math.sin(A),hl,hw,y0,y1,seat:true,rough:0,crenel:false,gable:0,k:n++,...o});};
          const ring=(u,w,r,th,y0,y1,o={})=>{const [cx,cz]=at(u,w);parts.push({t:'ring',cx,cz,r,th,y0,y1,rough:0,crenel:false,door:null,k:n++,...o});};
          // A wall along u from u0 to u1 at w, optionally with gaps [g0,g1] (gate or breach).
          const wall=(u0,u1,w,th,H,gaps=[],o={})=>{let cuts=[u0,...gaps.flat(),u1];for(let c=0;c<cuts.length;c+=2)if(cuts[c+1]-cuts[c]>.4)box((cuts[c]+cuts[c+1])/2,w,0,(cuts[c+1]-cuts[c])/2,th/2,g0-1,g0+H,o);};
          const wallZ=(w0,w1,u,th,H,gaps=[],o={})=>{let cuts=[w0,...gaps.flat(),w1];for(let c=0;c<cuts.length;c+=2)if(cuts[c+1]-cuts[c]>.4)box(u,(cuts[c]+cuts[c+1])/2,Math.PI/2,(cuts[c+1]-cuts[c])/2,th/2,g0-1,g0+H,o);};
          let kind,reach;
          if(raised>1.2&&R(1)<.75||R(1)<.25){
            kind='castle';const L=12+5*R(2),H=6+2*R(3),T=1.3,wo={rough:2.5,crenel:true};
            const breach=()=>{const c=(R(n+40)-.5)*L;return R(n+41)<.35?[[c-2,c+2]]:[];};
            wall(-L,L,-L,T,H,[[-2.2,2.2]],wo);wall(-L,L,L,T,H,breach(),wo);wallZ(-L,L,-L,T,H,breach(),wo);wallZ(-L,L,L,T,H,breach(),wo);
            for(const [u,w] of [[-L,-L],[L,-L],[-L,L],[L,L]])ring(u,w,3.2,1,g0-1,g0+H+3+2*R(n),{rough:3,crenel:true});
            box(-2.6,-L,0,1,1.4,g0-1,g0+H+2,{rough:1.5});box(2.6,-L,0,1,1.4,g0-1,g0+H+2,{rough:1.5});
            const K=4+1.5*R(4),KH=13+6*R(5),ko={rough:5,crenel:true};
            wall(-K,K,-K,1.2,KH,[[-1,1]],ko);wall(-K,K,K,1.2,KH,[],ko);wallZ(-K,K,-K,1.2,KH,[],ko);wallZ(-K,K,K,1.2,KH,[],ko);
            reach=L+5;
          }else if(R(1)<.7){
            kind='town';const lot=11,houses=[];
            for(let gu=-2;gu<=2;gu++)for(const side of [-1,1]){const hk=100+gu*20+side*7;if(R(hk)<.15)continue;
              const u=gu*lot+(R(hk+1)-.5)*2,w=side*(7+2*R(hk+2)),hl=2.5+1.2*R(hk+3),hw=3+1.5*R(hk+4),H=R(hk+5)<.25?1.6:3.6+2*R(hk+6),th=.5,o={rough:1.6};
              // Front wall faces the street (w toward 0) with a door; gable ends rise on the short sides.
              const front=w-side*hw,back=w+side*hw;
              wall(u-hl,u+hl,front,th,H,[[u-.6,u+.6]],o);wall(u-hl,u+hl,back,th,H,R(hk+7)<.5?[[u+.5,u+1.5]]:[],o);
              wallZ(Math.min(front,back),Math.max(front,back),u-hl,th,H,[],{...o,gable:H>2?2.2:0});wallZ(Math.min(front,back),Math.max(front,back),u+hl,th,H,[],{...o,gable:H>2?2.2:0});
            }
            // Chapel at the end of the street, with a bell tower, and a well in the square.
            const cu=3*lot+3;wall(cu-6,cu+6,-4,.8,7,[],{rough:2});wall(cu-6,cu+6,4,.8,7,[],{rough:2});wallZ(-4,4,cu-6,.8,7,[[-1,1]],{rough:1,gable:4});wallZ(-4,4,cu+6,.8,7,[],{rough:2,gable:4});
            box(cu+8.5,0,0,2,2,g0-1,g0+14+4*R(n+70),{rough:3});ring(0,0,1.2,.45,g0-1,g0+1);
            // Cobbled street from the town's edge to the chapel door, worn away in patches.
            {const [cx,cz]=at(lot*.5,0);parts.push({t:'path',cx,cz,ux:ca,uz:sa,hl:3*lot+2.5,hw:1.8,k:n++});}
            reach=3*lot+14;
          }else{
            kind='temple';const L=10+3*R(2),W=6+2*R(3),P=1.4,top=g0+P,colH=7+2*R(4);
            box(0,0,0,L,W,g0-1,top,{});for(let s2=1;s2<=3;s2++)box(-L-s2*.8,0,0,.4,W*.8,g0-1,top-s2*P/4,{});
            const cols=[];for(let c=0;c<=6;c++)for(const side of [-1,1]){const u=-L+1.3+c*(2*L-2.6)/6,w=side*(W-1.2),r=R(n+80);
              if(r<.2){box(u,w-side*3,Math.PI/2,3,.55,top,top+1.1,{seat:false});cols.push(null);}
              else{const ch=r<.45?2+3*R(n+81):colH;const [cx,cz]=at(u,w);parts.push({t:'ring',cx,cz,r:.6,th:0,y0:top-.2,y1:top+ch,rough:0,crenel:false,door:null,k:n++});cols.push({u,w,full:ch===colH});}}
            for(let c=0;c<12;c+=2){const A2=cols[c],B2=cols[c+2];if(A2&&B2&&A2.full&&B2.full)box((A2.u+B2.u)/2,A2.w,0,(B2.u-A2.u)/2+.7,.6,top+colH,top+colH+1,{seat:false});}
            reach=L+5;
          }
          v={x,z,kind,parts,top:Math.max(...parts.filter(q=>q.t!=='path').map(q=>q.y1+(q.gable||0))),reach};
        }
      }
      ruins.set(k,v);if(ruins.size>4096)ruins.delete(ruins.keys().next().value);return v;
    }
    const ruinNear=(x,z)=>ruinCell(Math.floor(x/STG),Math.floor(z/STG));
    // Rock landforms, one candidate per 130 m cell: in desert and dry badlands a sandstone arch or a cluster of hoodoos
    // (spires pinched in the middle under a dark caprock); off rocky coasts a sea stack or a sea arch standing in shallows.
    const KG=130,rocks=new Map();
    function rockCell(i,j){
      const k=i*65536+j;if(rocks.has(k))return rocks.get(k);let v=null;const p=hash(i,j,seed+501);
      if(p<.5){
        const x=(i+.3+.4*hash(i,j,seed+503))*KG,z=(j+.3+.4*hash(i,j,seed+505))*KG,g=geography(x,z),h=hash(i,j,seed+507),a=hash(i,j,seed+509)*Math.PI;
        const dry=['desert','savanna','steppe'].includes(g.biome);
        const arch=(base,Ls,Ha)=>({kind:'arch',x,z,ux:Math.cos(a),uz:Math.sin(a),base,Ls,Ha,t:1.6+.8*hash(i,j,seed+511),dh:1.4+.8*hash(i,j,seed+513)});
        if(dry&&!g.wet&&!g.sea&&g.slope<.6&&g.water<=g.height&&Math.hypot(x,z)>60&&p<.4){
          const base=g.height*cellMetres-.5;
          if(h<.45){v=arch(base,6+5*hash(i,j,seed+515),8+6*hash(i,j,seed+517));v.mat=MAT.sandstone;}
          else{
            const n=3+Math.floor(hash(i,j,seed+519)*5),list=[];
            for(let s2=0;s2<n;s2++){const b=hash(s2,k,seed+521)*Math.PI*2,o=s2?2+6*hash(s2,k,seed+523):0,sx=x+Math.cos(b)*o,sz=z+Math.sin(b)*o;
              list.push({x:sx,z:sz,r:1+.8*hash(s2,k,seed+525),h:(s2?5:9)+5*hash(s2,k,seed+527),base:geography(sx,sz).height*cellMetres-.5});}
            v={kind:'hoodoos',x,z,list};
          }
        }else if(g.sea&&g.height*cellMetres>SEA-7&&Math.hypot(x,z)>60&&[[35,0],[-35,0],[0,35],[0,-35]].some(([u,w])=>geography(x+u,z+w).height*cellMetres>SEA)){
          if(h<.6)v={kind:'stack',x,z,r:3+3*hash(i,j,seed+529),top:SEA+8+10*hash(i,j,seed+531)};
          else{v=arch(SEA-2,7+5*hash(i,j,seed+533),11+6*hash(i,j,seed+535));v.mat=MAT.basalt;}
        }
        if(v)v.reach=v.kind==='arch'?v.Ls+v.t+v.dh+1:v.kind==='stack'?v.r+2:11;
      }
      rocks.set(k,v);if(rocks.size>4096)rocks.delete(rocks.keys().next().value);return v;
    }
    const rockNear=(x,z)=>rockCell(Math.floor(x/KG),Math.floor(z/KG));
    // Boulders: one candidate per 9 m cell. Common on mountain foothills and moraine ground below glaciers (relief),
    // rare lone erratics elsewhere. Lumpy ellipsoids 0.8-2.5 m half-size, half sunk, sometimes with a smaller companion.
    const BG=9,boulders=new Map();
    function boulderCell(i,j){
      const k=i*1048576+j;if(boulders.has(k))return boulders.get(k);let v=null;const p=hash(i,j,seed+551);
      if(p<.2){
        const x=(i+.2+.6*hash(i,j,seed+553))*BG,z=(j+.2+.6*hash(i,j,seed+555))*BG,g=geography(x,z);
        const chance=g.sea||g.wet||g.water>g.height||g.gorge||g.highland||g.slope>1.1||g.biome==='snow'||g.glacier||Math.hypot(x,z)<30?0:g.relief>15?.2:['meadow','tundra','subalpine'].includes(g.biome)?.1:.006;
        if(p<chance){
          const big=g.relief>15?1:.7,r=(.8+1.7*hash(i,j,seed+557)**2)*big,list=[{x,z,r,ry:r*(.6+.25*hash(i,j,seed+559)),y:g.height*cellMetres-r*.25}];
          if(hash(i,j,seed+561)<.4){const a=hash(i,j,seed+563)*Math.PI*2,o=r+.4,cx=x+Math.cos(a)*o,cz=z+Math.sin(a)*o,cr=r*.45;list.push({x:cx,z:cz,r:cr,ry:cr*.7,y:geography(cx,cz).height*cellMetres-cr*.25});}
          v={x,z,list,reach:r*2+1};
        }
      }
      boulders.set(k,v);if(boulders.size>16384)boulders.delete(boulders.keys().next().value);return v;
    }
    // Regular trees keep clear of giant crowns, ruins and rock landforms.
    // Ruins mask trees tightly: only trunks within 0.6 m of a wall (or on the street) are removed, so forest grows into
    // courtyards and right against the walls.
    function ruinBlocks(R,x,z,m){
      for(const q of R.parts){
        if(q.t==='box'||q.t==='path'){const dx=x-q.cx,dz=z-q.cz;if(Math.abs(dx*q.ux+dz*q.uz)<q.hl+m&&Math.abs(-dx*q.uz+dz*q.ux)<q.hw+(q.t==='path'?.3:m))return true;}
        else{const d=Math.hypot(x-q.cx,z-q.cz);if(q.th?Math.abs(d-q.r)<q.th/2+m:d<q.r+m)return true;}
      }
      return false;
    }
    const landmarkNear=(x,z)=>{const A=ancientNear(x,z),R=ruinNear(x,z),K=rockNear(x,z);return !!A&&Math.hypot(x-A.x,z-A.z)<A.reach+1||!!R&&Math.hypot(x-R.x,z-R.z)<R.reach&&ruinBlocks(R,x,z,.6)||!!K&&Math.hypot(x-K.x,z-K.z)<K.reach+2;};
    const spireNear=(x,z,margin)=>{const S=spiresNear(x,z);return !!S&&S.list.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+margin);};
    function geography(x,z){
      if(infinite){
        const t=tectonics(x,z);
        const RV=riverAt(x,z),riverDistance=RV.d;
        const ridge=1-Math.abs(noise(x*.009,z*.009,seed+107)-.5)*2;
        const fault=Math.abs(noise(x*.04,z*.04,seed+109)-.5)*20;
        const crag=cragAt(x,z,t.relief,t.cone),low=cragLow,bump=noise(x*.032,z*.032,seed)*2.4+noise(x*.13,z*.13,seed+1)*.7+ridge**4*3;let h=t.h+bump*(t.h<SEA?.4:1)+crag;
        // Slope of the mountain surface (only where plates lift the land; lowlands are gentle by construction).
        let slope=0;if(t.relief>12||t.cone>5){const e=1.5,hx=tectonics(x+e,z),hz=tectonics(x,z+e);slope=Math.hypot(hx.h+cragAt(x+e,z,hx.relief,hx.cone)-t.h-crag,hz.h+cragAt(x,z+e,hz.relief,hz.cone)-t.h-crag)/e;}
        // Glaciers: in cold ground, ice fills hollows up to a smooth surface (plate relief plus a share of the crag), so
        // ridges and summits stand out of the ice fields as rock; ice thins out toward the warm margin.
        // Glacier surface follows the broad landform (the first erosion octaves): ice fills cirques and valleys carved below it.
        const C=climate(x,z),iceTop=t.h+bump+low*.95-1,Tice=C.T-.17*Math.max(0,iceTop-t.h);
        let ice=0;if((t.relief>15||t.cone>20)&&Tice<-2&&iceTop>h)ice=(iceTop-h)*clamp((-2-Tice)/3,0,1);
        let iceBase=h;h+=ice;
        // Rivers sit in valleys rather than slots: the taller the ground beside a river, the wider its valley. Width follows the
        // smooth landform (not small bumps), so the valley edge, where massif tiers end, stays a clean line. Big rivers open
        // wide V valleys; creeks only notch the slope.
        // The drainage level is interpolated between coarse nodes; cap it by the broad landform (plate relief plus the lower
        // of the crag and its broad octaves, never above the ground) so water sits on the valley floor and cuts into the ground.
        // A channel at a lake's level (running through it, or across a low island in it) holds exactly that level.
        const held=RV.lake&&RV.level>=RV.lake-.5,floor=Math.max(SEA-.6,(held?RV.lake:Math.min(RV.level,t.h+Math.min(crag,low)+.1))-1.2),valley=held?4+RV.w:6+RV.w+Math.min(70,Math.max(0,t.h+crag-floor)*1.3)*(.3+.7*clamp((RV.size-.3)/.7,0,1));
        const bt=clamp((riverDistance-2.3)/valley,0,1),bank=bt*bt*(3-2*bt);
        // Rivers and streams clear the massif from their valleys; creeks just notch through it (bank carving below).
        const L=liftAt(x,z),pass=L.pass,lift=bank<1&&RV.size>=.5?0:L.lift;
        const gw=(noise(x*.008,z*.008,seed+227)-.5)*60,half=2+noise(x*.05,z*.05,seed+233);
        const sx=x-gorgeX,sz=z-gorgeZ,along=clamp(sx*gorgeDX+sz*gorgeDZ,-32,32),homeGorge=Math.hypot(sx-along*gorgeDX,sz-along*gorgeDZ)+Math.sin(along*.15)*1.5;
        const faulted=(t.setting==='rift'||t.setting==='transform')&&t.f>.3;
        const gorgeDistance=lift>0||riverDistance<16||t.base<SEA+6?Infinity:Math.min(homeGorge,faulted?Math.abs(noise((x+gw)*.006,(z-gw)*.006,seed+231)-.5)*170:Infinity);
        const gorge=gorgeDistance<half,rock=noise(x*.02,z*.02,seed+239)>.45?'sound':'fractured';
        // Raising ground (massif tiers, knolls) raises the glacier bed with it; only ice counts as ice.
        if(lift>0){const before=h;h=Math.max(h,Math.min(h,SEA+8)+L.up);iceBase+=h-before;}
        const knoll=lift>0||riverDistance<14||t.h<SEA+1.5||gorgeDistance<half+6||slope>.5?0:outcropAt(x,z);
        h+=knoll*1.6;iceBase+=knoll*1.6;
        // Carve the valley, but keep a bank: outside the wet channel the ground stays 0.3 m above the water surface
        // (never above the original land), so water is always contained. Ground already under a lake keeps its natural
        // bed (no channel grooves through the lake), and only that ground holds lake water (not an outlet cut below it).
        const underLake=RV.lake>h+.2;
        if(bank<1&&!underLake){const before=h;h=Math.min(h,floor+(h-floor)*bank);if(riverDistance>=3.4)h=Math.max(h,Math.min(before,floor+1.3));}
        if(gorge)h=Math.max(SEA+1,t.base-7);
        iceBase=Math.min(iceBase,h);
        const height=clamp(Math.floor(h/cellMetres),1,heightCells-28*density),metres=height*cellMetres,sea=metres<SEA,steep=slope>.9;
        const lakeWater=underLake&&RV.lake>metres+.2&&!gorge,wet=riverDistance<12||lakeWater,T=C.T-.17*Math.max(0,metres-t.h),iceCells=Math.max(0,height-Math.floor(iceBase/cellMetres));
        const glacier=!gorge&&!sea&&iceCells>=2,biome=gorge?'gorge':glacier?'glacier':biomeOf(T,C.M,metres,wet,steep,slope>1.4,t.relief>15||t.cone>20,slope>1.8,region(C,x,z));
        const water=sea?Math.round(SEA/cellMetres):lakeWater?Math.floor(RV.lake/cellMetres):riverDistance<3.4&&!gorge&&(floor+1)/cellMetres>height?Math.floor((RV.lake>floor+1&&RV.lake<floor+1.25?RV.lake:floor+1)/cellMetres):0;
        // Bare rock only where landform demands it: gorge lips, the rims of massif tiers, thin fault seams, outcrop knolls,
        // cliff-steep mountainsides and alpine ground. Plateau tops, grassland and forest stay vegetated.
        const rim=lift>0&&!pass&&[[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]].some(([u,v])=>upliftAt(x+u,z+v).up<L.up-1.5);
        const exposed=gorgeDistance<half+1.5||rim||lift>0&&fault<.9&&ridge>.55||knoll>0||slope>(T>2?1.8:1.4)&&!sea&&biome!=='snow'&&!glacier||slope>1.8&&!sea&&!glacier||biome==='alpine';
        return {height,riverDistance,riverLevel:floor,riverWidth:RV.w,riverSize:RV.size,spring:RV.spring&&riverDistance<3.4,foam:RV.foam&&riverDistance<3.4&&!gorge,ridge,fault,clearing:0,exposed,wet,slope,
          lift,highland:lift>0,pass,gorge,gorgeDistance,gorgeHalf:half,rock,sea,water,biome,glacier,iceCells:glacier?iceCells:0,cone:t.cone,setting:t.setting,temperature:T,moisture:C.M,relief:t.relief};
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
    // ---- Vegetation ----
    // Species: sizes in metres as [base, random spread] for height (h) and crown radius (r); trunk = trunk radius.
    // crown: round (broadleaf dome), oval (airy birch), cone (spruce), larch (open tiered cone), spire (redwood: a needle
    // point over the trunk), umbrella (flat acacia pads), gnarled (twisted, leaning lakeside tree).
    const SPECIES={
      oak:{crown:'round',bark:MAT.bark,leaf:MAT.leaf,h:[2.75,2],r:[1.25,.75],trunk:.18},
      jungle:{crown:'round',bark:MAT.bark,leaf:MAT.leaf,h:[4.5,2.75],r:[1.75,.75],trunk:.22},
      birch:{crown:'oval',bark:MAT.birchBark,leaf:MAT.birchLeaf,h:[3.25,1.75],r:[.75,.4],trunk:.12},
      spruce:{crown:'cone',bark:MAT.bark,leaf:MAT.needle,h:[3.5,1.75],r:[1,.5],trunk:.18,conifer:true},
      larch:{crown:'larch',bark:MAT.bark,leaf:MAT.larch,h:[3.75,2],r:[1,.5],trunk:.16,conifer:true},
      redwood:{crown:'spire',bark:MAT.redwood,leaf:MAT.needle,h:[7.5,4],r:[1,.5],trunk:.33,conifer:true},
      umbrella:{crown:'umbrella',bark:MAT.bark,leaf:MAT.acacia,h:[2.5,1.25],r:[1.75,.75],trunk:.15},
      gnarled:{crown:'gnarled',bark:MAT.bark,leaf:MAT.leaf,h:[2.5,1],r:[1.1,.4],trunk:.24},
    };
    const SPECIES_KEYS=Object.keys(SPECIES);
    // Per-biome tree style. mix: species weights (each species also gathers into groves by its own noise); cold: a
    // replacement mix below a temperature; size: height/radius multiplier; density: tree chance per 3 m cell (falls back
    // to TREES); shrubLeaf: species of the bush-sized trees. Extras roll on cells without a tree, as chances per cell:
    // bush (round clumps), shrub (x0.3 trees), deadwood (logs and stumps), mushroom (giant red caps), bamboo (grove
    // strength in warm wet ground), cactus. leaf: canopy materials for broadleaf crowns (round and oval), one picked per
    // tree (autumn gold/rust, blossom pinks); bushLeaf: the bush-clump material. Biomes not listed use `default`: a new
    // biome slots in with one line here.
    const TREE_STYLE={
      default:{mix:{oak:.75,birch:.25},density:.25,bush:.05,shrub:.03,deadwood:.01},
      forest:{mix:{oak:.62,birch:.2,spruce:.18},cold:{below:11,mix:{spruce:.55,larch:.2,birch:.25}},bush:.08,shrub:.04,deadwood:.04,mushroom:.012,bamboo:.5},
      redwood:{mix:{redwood:.9,spruce:.1},bush:.1,deadwood:.05,mushroom:.02},
      rainforest:{mix:{jungle:.85,umbrella:.15},bush:.12,deadwood:.03,mushroom:.015,bamboo:1},
      montane:{mix:{spruce:.6,larch:.4},bush:.04,deadwood:.03,mushroom:.006},
      boreal:{mix:{spruce:.55,birch:.25,larch:.2},bush:.05,deadwood:.04,mushroom:.008},
      subalpine:{mix:{spruce:.6,larch:.4},size:.6,bush:.05},
      tundra:{mix:{spruce:.65,birch:.35},size:.55,bush:.04},
      wetland:{mix:{gnarled:.4,birch:.3,oak:.3},bush:.1,deadwood:.03},
      savanna:{mix:{umbrella:.85,oak:.15},bush:.05,bamboo:.4},
      steppe:{mix:{umbrella:.6,oak:.4},size:.8,bush:.04},
      grassland:{mix:{oak:.7,birch:.3},bush:.06,shrub:.05,deadwood:.006},
      meadow:{mix:{larch:.6,spruce:.4},size:.7,bush:.03,shrub:.03},
      desert:{mix:{umbrella:1},density:0,cactus:.06},
      beach:{mix:{oak:1},density:0,bush:.01},
      flowers:{mix:{oak:.6,birch:.4},bush:.09,shrub:.07,deadwood:.004},
      autumn:{mix:{oak:.65,birch:.35},leaf:[MAT.autumnleaf,MAT.rustleaf,MAT.autumnleaf,MAT.rustleaf,MAT.larchGold],bushLeaf:MAT.rustleaf,bush:.08,shrub:.04,deadwood:.05,mushroom:.015},
      blossom:{mix:{oak:.8,birch:.2},leaf:[MAT.blossomleaf,MAT.blossomleaf,MAT.blossom,MAT.blossomWhite],bush:.07,shrub:.04,deadwood:.01},
      fen:{mix:{gnarled:.45,birch:.55},size:.8,bush:.08,deadwood:.04},
      heath:{mix:{birch:.6,spruce:.4},size:.6,bush:.08,shrub:.03},
      pinkgrass:{mix:{umbrella:.6,oak:.4},bush:.04,shrub:.03},
      golden:{mix:{umbrella:1},bush:.03,shrub:.02},
      bamboo:{mix:{jungle:1},density:.2,bamboo:5,bush:.1,mushroom:.004},
      badlands:{mix:{umbrella:1},density:0,cactus:.015,deadwood:.004},
    };
    const TREELESS=new Set(['sea','snow','glacier','alpine','gorge']);
    const treeStyle=b=>TREE_STYLE[b]||TREE_STYLE.default;
    // Quarter-metre units times density: identical metre sizes at either cell size, always integer cells.
    const cells=m=>Math.max(1,Math.round(m*4))*density;
    // Stamped heights stay well under nodeBound (ground + 24 m); radii fit the 3x3 tree-cell neighbourhood.
    const MAX_TREE=16,MAX_RADIUS=3.25;
    function pickSpecies(S,g,x,z,gx,gz,edge){
      const mix=S.cold&&g.temperature<S.cold.below?S.cold.mix:S.mix,w={};let total=0;
      // Groves: each species is weighted by its own low-frequency noise; birches favour forest edges.
      for(const k in mix){w[k]=mix[k]*(.2+1.6*noise(x*.022,z*.022,seed+731+SPECIES_KEYS.indexOf(k)*7))*(k==='birch'?.5+1.5*edge:1);total+=w[k];}
      let r=hash(gx,gz,seed+31)*total;for(const k in w){r-=w[k];if(r<0)return k;}
      return Object.keys(mix)[0];
    }
    // Size class, clustered by low-frequency noise into young groves and old stands: on average ~25% young (x0.45-0.75),
    // ~60% mature (x0.85-1.15), ~15% big (x1.3-1.7).
    function sizeClass(x,z,gx,gz){
      const n=noise(x*.018,z*.018,seed+703),r=hash(gx,gz,seed+705),r2=hash(gx,gz,seed+707),young=.22-(n-.5)*.7,big=.84-(n-.5)*.45;
      return r<young?{cls:0,k:.45+.3*r2}:r<big?{cls:1,k:.85+.3*r2}:{cls:2,k:1.3+.4*r2};
    }
    // Round leaf clumps (bushes): 1-3 lumps within ~1 m, 0.6-1.5 m tall, stamped on each column's own ground.
    function bushLumps(x,z,gx,gz,k,scale=1){
      const n=1+Math.floor(hash(gx,gz,seed+k)*3),list=[],id=gx*31+gz;
      for(let i=0;i<n;i++){const a=hash(i,id,seed+k+1)*Math.PI*2,o=i?.5+.6*hash(i,id,seed+k+2):0,r=(.35+.4*hash(i,id,seed+k+3))*scale;
        list.push({x:x+Math.cos(a)*o,z:z+Math.sin(a)*o,r,ht:clamp(r*(1.3+.6*hash(i,id,seed+k+4)),.6,1.5)*scale});}
      return list;
    }
    // A streamed tree cell is a pure function of its 3 m grid cell; tree() memoizes it. It holds one plant: a tree, a
    // bush clump, a bamboo clump, a cactus, a mushroom cluster, a log or a stump (or nothing).
    function makeTree(gx,gz){
      const x=(gx+.15+.7*hash(gx,gz,seed+9))*TG,z=(gz+.15+.7*hash(gx,gz,seed+11))*TG,g=geography(x,z),b=g.biome,S=treeStyle(b);
      // Trees never stand on bare rock, cliff-steep ground or water, at the trunk or within 1.5 m of it (so a crown never
      // sits on a rock face). Snow and ice are allowed: the renderer gives those trees snowy crowns.
      const bare=G=>G.exposed||G.sea||G.water>G.height||G.biome==='alpine'||G.biome==='gorge'||G.slope>1.3;
      if(bare(g)||g.highland||g.gorgeDistance<g.gorgeHalf+4||spireNear(x,z,4)||landmarkNear(x,z))return null;
      for(const [u,w] of [[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]])if(bare(geography(x+u,z+w)))return null;
      const patch=clamp((noise(x*.03,z*.03,seed+341)-.25)/.3,0,1),edge=1-patch,roll=hash(gx,gz,seed+23),roll2=hash(gx,gz,seed+29),barren=TREELESS.has(b)||b==='desert'||b==='badlands';
      let base=S.density??TREES[b]??(TREELESS.has(b)?0:.25);
      // Ruins are overgrown: trees crowd their courtyards and stand right against the walls.
      const RU=ruinNear(x,z);if(RU&&!barren&&Math.hypot(x-RU.x,z-RU.z)<RU.reach)base=Math.max(base,.5);
      // Treeline: forest thins and shrinks over the last ~4 degrees C (about 25 m) below the line, broadleaf dropping out
      // before conifers. The line is ~1 C (it follows the climate's temperature and lapse rate), lower on steep, exposed
      // ground. Just above it, only rare stunted krummholz conifers. Applies on any ground, snow included.
      const warmth=g.temperature-1-g.slope*1.6,tl=clamp(warmth/4,0,1),tline=tl*tl*(3-2*tl);
      if(tline<=0){
        if(warmth>-2.5&&!barren&&roll<.06*(1+warmth/2.5))return growTree('spruce',S,g,gx,gz,x,z,{k:.28+.1*hash(gx,gz,seed+751)});
        return null;
      }
      base*=tline;
      const dense=base*(.35+.65*patch),common={x,z,base:g.height};
      const bush=(scale=1)=>Object.freeze({...common,kind:'bush',leaf:S.bushLeaf,lumps:bushLumps(x,z,gx,gz,601,scale)});
      // River and lake edges: twisted trees leaning out over the water, bushes on the bank.
      if(g.riverDistance<12){
        // Only cells that would take a lakeside plant sample their surroundings for water.
        let wx=0,wz=0;if(roll<.55&&!barren)for(const [u,w] of [[4.5,0],[-4.5,0],[0,4.5],[0,-4.5]]){const G=geography(x+u,z+w);if(G.water>G.height&&!G.sea){wx+=u;wz+=w;}}
        if(wx||wz){if(roll<.3)return growTree('gnarled',S,g,gx,gz,x,z,{lean:Math.atan2(wz,wx)});if(roll<.55)return bush();}
        if(g.riverDistance<9)return roll2<.15&&g.riverDistance>4&&!barren?bush():null;
      }
      // Warm, wet hills and rainforest margins: dense bamboo clumps that join into groves.
      if(S.bamboo&&g.temperature>15&&g.moisture>.5&&noise(x*.012,z*.012,seed+721)>.62-.08*S.bamboo&&roll2<.9){
        const n=10+Math.floor(hash(gx,gz,seed+41)*8),culms=[],H=6+3*hash(gx,gz,seed+43),id=gx*7+gz;let top=0;
        for(let i=0;i<n;i++){const a=hash(i,id,seed+45)*Math.PI*2,o=1.5*Math.sqrt(hash(i,id,seed+47)),lean=.012+.025*hash(i,id,seed+49),h=Math.min(12,H+3*hash(i,id,seed+51));
          culms.push({x:x+Math.cos(a)*o,z:z+Math.sin(a)*o,lx:Math.cos(a)*lean,lz:Math.sin(a)*lean,h,tr:.45+.3*hash(i,id,seed+53)});top=Math.max(top,h);}
        return Object.freeze({...common,kind:'bamboo',culms,top:g.height+Math.ceil((top+1)/cellMetres)+2});
      }
      if(roll<dense){
        let sp=pickSpecies(S,g,x,z,gx,gz,edge);
        // Near the line broadleaf gives way to conifers; trees shrink toward krummholz size.
        if(tline<1&&!(SPECIES[sp]||{}).conifer&&hash(gx,gz,seed+753)>tline*1.6-.3)sp=S.mix.larch&&hash(gx,gz,seed+755)<.4?'larch':'spruce';
        return growTree(sp,S,g,gx,gz,x,z,{scale:.4+.6*tline});
      }
      // Cells without a tree: extras by biome. Bushes and shrubs gather at forest edges and in open ground.
      const near=base>.4?.4+1.6*edge:1;let c=0;
      if(roll2<(c+=S.cactus||0)){
        const ht=1.4+2*hash(gx,gz,seed+61),arms=[];
        for(let i=0;i<1+Math.floor(hash(gx,gz,seed+63)*2.4);i++){const a=hash(i,gx+gz*5,seed+65)*Math.PI*2;arms.push({ux:Math.cos(a),uz:Math.sin(a),at:ht*(.3+.25*hash(i,gx,seed+67)),up:.5+.7*hash(i,gz,seed+69)});}
        return Object.freeze({...common,kind:'cactus',ht,r:.2+.06*hash(gx,gz,seed+71),arms});
      }
      if(roll2<(c+=(S.mushroom||0)*(.5+patch))){
        // One to three distinct mushrooms of falling size, spaced so their caps never touch.
        const n=1+Math.floor(hash(gx,gz,seed+73)*3),list=[],R0=1.3+.6*hash(gx,gz,seed+83);
        for(let i=0;i<n;i++){
          const s=i===0?1:i===1?.6+.1*hash(i,gz,seed+79):.42+.08*hash(i,gz,seed+79),cr=R0*s,a=hash(i,gx+gz*3,seed+75)*Math.PI*2+i*2.1,o=i?R0+cr+.25:0;
          list.push({x:x+Math.cos(a)*o,z:z+Math.sin(a)*o,cr,sr:cr*.34,sh:cr*(1.1+.4*hash(i,gx*3+gz,seed+81)),ct:cr*.62,spin:hash(i,gx,seed+77)*6.28});
        }
        return Object.freeze({...common,kind:'mushroom',list});
      }
      if(roll2<(c+=S.deadwood||0)){
        if(hash(gx,gz,seed+85)<.55){const a=hash(gx,gz,seed+87)*Math.PI;return Object.freeze({...common,kind:'log',ux:Math.cos(a),uz:Math.sin(a),len:2.4+2*hash(gx,gz,seed+89),r:.24+.14*hash(gx,gz,seed+91)});}
        return Object.freeze({...common,kind:'stump',r:.28+.18*hash(gx,gz,seed+93),ht:.35+.45*hash(gx,gz,seed+95)});
      }
      if(roll2<(c+=(S.bush||0)*near))return bush();
      if(roll2<(c+=(S.shrub||0)*near))return growTree(S.shrubLeaf||((S.mix.birch||0)>(S.mix.oak||0)?'birch':'oak'),S,g,gx,gz,x,z,{k:.3});
      return null;
    }
    // A tree record. Heights and radii are integer cells (quarter-metre quantized, so both cell sizes agree).
    function growTree(sp,S,g,gx,gz,x,z,o={}){
      const P=SPECIES[sp]||SPECIES.oak,C=o.k?{cls:-1,k:o.k}:sizeClass(x,z,gx,gz),k=C.k*(S.size||1)*(o.scale||1);
      const hm=Math.min(MAX_TREE,(P.h[0]+P.h[1]*hash(gx,gz,seed+4))*k),rm=Math.min(MAX_RADIUS,(P.r[0]+P.r[1]*hash(gx,gz,seed+5))*k*(o.k?1.3:1));
      const height=cells(hm),radius=cells(rm),t={x,z,base:g.height,kind:'tree',species:sp,crown:P.crown,bark:P.bark,leaf:P.leaf,conifer:!!P.conifer,redwood:sp==='redwood',cls:C.cls,height,radius,trunk:Math.max(.72*density,P.trunk*Math.sqrt(C.k)/cellMetres)};
      // Larches turn autumn gold in patches.
      if(sp==='larch'&&noise(x*.015,z*.015,seed+741)>.64)t.leaf=MAT.larchGold;
      // Biome canopy colours (autumn gold and rust, blossom pinks) for broadleaf crowns, one per tree.
      else if(S.leaf&&(P.crown==='round'||P.crown==='oval'))t.leaf=S.leaf[Math.floor(hash(gx,gz,seed+743)*S.leaf.length)];
      let top=g.height+height+Math.ceil(radius*.7)+4*density+1;
      if(P.crown==='umbrella'){const a=hash(gx,gz,seed+97)*Math.PI*2,d=rm*.45;t.pads=[{x,z,y:g.height+height,r:radius},{x:x+Math.cos(a)*d,z:z+Math.sin(a)*d,y:g.height+Math.round(height*.72),r:Math.max(density,Math.round(radius*.6))}];}
      if(P.crown==='gnarled'){
        const a=o.lean??hash(gx,gz,seed+99)*Math.PI*2,L=(.9+.8*hash(gx,gz,seed+101))*hm*.5;t.lx=Math.cos(a)*L;t.lz=Math.sin(a)*L;
        const tx=x+t.lx,tz=z+t.lz;
        t.lumps=[0,1,2].map(i=>{const b=a+(i-1)*1.5+hash(i,gx+gz,seed+103)*.4,d=i===1?0:rm*.6;return {x:tx+Math.cos(b)*d,z:tz+Math.sin(b)*d,y:g.height+height-(i===1?0:cells(.35)),r:i===1?radius:Math.max(density,Math.round(radius*.75))};});
        top+=radius;
      }
      // Big trees shelter a bush or two at their feet.
      if(C.cls===2&&S.bush){const a=hash(gx,gz,seed+105)*Math.PI*2,d=Math.max(.9,rm*.75);t.under=bushLumps(x+Math.cos(a)*d,z+Math.sin(a)*d,gx,gz,611,.9);if(S.bushLeaf)t.underLeaf=S.bushLeaf;}
      t.top=top;return Object.freeze(t);
    }
    function tree(gx,gz){
      if(infinite){
        const key=gx*134217728+gz;if(trees.has(key))return trees.get(key);
        const value=makeTree(gx,gz);
        if(trees.size>=2048)trees.delete(trees.keys().next().value);trees.set(key,value);return value;
      }
      const grid=Math.ceil(extent/5);
      if(!infinite&&(gx<0||gz<0||gx>=grid||gz>=grid))return null;
      const key=gx*134217728+gz;if(trees.has(key))return trees.get(key);
      const x=(gx+.2+.6*hash(gx,gz,seed+9))*5,z=(gz+.2+.6*hash(gx,gz,seed+11))*5;
      const g=geography(x,z);
      const edge=gx<Math.ceil(EXTENT/5)&&gz<Math.ceil(EXTENT/5)?EXTENT:extent;
      const value=(!infinite&&(x<1||z<1||x>edge-1||z>edge-1||x>extent-1||z>extent-1))||g.clearing>.1||g.riverDistance<11||g.exposed||g.highland||g.gorgeDistance<g.gorgeHalf+4||hash(gx,gz,seed+23)<.28?null:{x,z,base:g.height,height:(12+Math.floor(hash(gx,gz,seed+4)*9))*density,radius:(5+Math.floor(hash(gx,gz,seed+5)*3))*density};
      if(value)Object.freeze(value);if(trees.size>=2048)trees.delete(trees.keys().next().value);trees.set(key,value);return value;
    }
    // Root geology and identity survive render/cache changes.
    let rootSite=null,score=Infinity;
    if(infinite){
      // The opening needs engineered terrain beside it: chart barrier landforms (gorge floors and
      // >=2.5 m steps) on a coarse grid, distance-transform it, and admit only roots near — not on — one.
      const BG=4,BN=93,B0=-(BN>>1)*BG,bh=new Float32Array(BN*BN),bsea=new Uint8Array(BN*BN),bmark=new Uint8Array(BN*BN),bd=new Float32Array(BN*BN);
      for(let j=0;j<BN;j++)for(let i=0;i<BN;i++){const g=geography(B0+i*BG,B0+j*BG),k=j*BN+i;bh[k]=g.height*cellMetres;bsea[k]=g.sea;bmark[k]=g.gorge&&!g.sea?1:0;}
      for(let j=0;j<BN;j++)for(let i=0;i<BN;i++){const k=j*BN+i;
        for(const o of [i+1<BN?1:0,j+1<BN?BN:0])if(o&&!(bsea[k]&&bsea[k+o])&&Math.abs(bh[k+o]-bh[k])>=2.5)bmark[k]=bmark[k+o]=1;}
      for(let j=0;j<BN;j++)for(let i=0;i<BN;i++){const k=j*BN+i;if(bmark[k]){bd[k]=0;continue;}
        if(i)bd[k]=Math.min(bd[k],bd[k-1]+BG);if(j){bd[k]=Math.min(bd[k],bd[k-BN]+BG);if(i)bd[k]=Math.min(bd[k],bd[k-BN-1]+BG*1.4143);if(i+1<BN)bd[k]=Math.min(bd[k],bd[k-BN+1]+BG*1.4143);}}
      for(let j=BN-1;j>=0;j--)for(let i=BN-1;i>=0;i--){const k=j*BN+i;
        if(i+1<BN)bd[k]=Math.min(bd[k],bd[k+1]+BG);if(j+1<BN){bd[k]=Math.min(bd[k],bd[k+BN]+BG);if(i+1<BN)bd[k]=Math.min(bd[k],bd[k+BN+1]+BG*1.4143);if(i)bd[k]=Math.min(bd[k],bd[k+BN-1]+BG*1.4143);}}
      const nearBarrier=(x,z,lo,hi)=>{const i=Math.round((x-B0)/BG),j=Math.round((z-B0)/BG),d=i<0||j<0||i>=BN||j>=BN?1e9:bd[j*BN+i];return d>=lo&&d<=hi;};
      for(const [lo,hi] of [[9,42],[6,54],[0,1e9]]){
        for(let z=-128;z<=128;z+=2)for(let x=-128;x<=128;x+=2){const g=geography(x,z);if(g.exposed&&g.riverDistance>12&&!g.highland&&g.gorgeDistance>12&&nearBarrier(x,z,lo,hi)&&[.0625,.125].every(offset=>geography(x+offset,z+offset).exposed)){const s=Math.hypot(x,z);if(s<score){score=s;rootSite={x,z};}}}
        if(rootSite)break;
      }
      if(!rootSite)throw new Error('No dry basalt root in the starting survey');
    }else for(let z=40;z<77;z+=.5)for(let x=34;x<44;x+=.5){const g=geography(x,z);if(g.exposed&&g.fault<1){const s=Math.hypot(x-42,z-58);if(s<score){score=s;rootSite={x,z};}}}
    const deposit=Object.freeze({id:`${id}:ore:root`,kind:'Ferrite',x:rootSite.x,z:rootSite.z,y:ground(rootSite.x,rootSite.z),rule:infinite?'Dry basalt outcrop in the seeded ridge and fracture fields':'Exposed basalt along the western fault above the river catchment',geology:infinite?'Outcrop-exposed basalt':'Fault-exposed basalt',surveyed:true});
    // Optional stage timer (set by node()): geography, tree lookups/stamping, and features (isles, spires, ore, flowers).
    let prof=null;const now=()=>performance.now();
    // colTop: one past the highest cell the last column() call can have written, so callers reusing a buffer scan and clear
    // only that far.
    let colTop=0;
    // colStep: cells between sampled columns (set by node()). Plants and scatter smaller than a sampled column are skipped.
    let colStep=1;
    // Stamp one plant record into the column at (x,z) whose first air cell is h. Returns one past the highest cell the
    // stamp may have written (0 if none). Plants only fill air, except trunks and culms.
    function stampPlant(t,x,z,values,h){
      const kind=t.kind||'tree',small=colStep*cellMetres>1.01;
      if(kind==='tree')return stampTree(t,x,z,values,h,small);
      if(kind==='bamboo')return stampBamboo(t,x,z,values,h,small);
      if(small)return 0;
      const c=m=>Math.round(m/cellMetres),fillAir=(m,a,b)=>{b=Math.min(heightCells,b);for(let y=a;y<b;y++)if(!values[y])values[y]=m;return b;};
      if(kind==='bush')return stampLumps(t.lumps,x,z,values,h,t.leaf||MAT.bushLeaf);
      if(kind==='log'){
        const dx=x-t.x,dz=z-t.z,u=dx*t.ux+dz*t.uz,v=-dx*t.uz+dz*t.ux;if(Math.abs(u)>=t.len/2||Math.abs(v)>=t.r)return 0;
        const e=fillAir(MAT.bark,h,h+Math.max(1,c(2*Math.sqrt(t.r*t.r-v*v))));
        if(noise(u*1.3+t.x,v*3+t.z,seed+111)>.55&&values[e-1]===MAT.bark)values[e-1]=MAT.mossy;return e;
      }
      if(kind==='stump'){
        const d=Math.hypot(x-t.x,z-t.z);if(d>=t.r)return 0;const e=fillAir(MAT.bark,h,h+Math.max(1,c(t.ht)));
        if(d<t.r-.12&&values[e-1]===MAT.bark)values[e-1]=MAT.dry;return e;
      }
      if(kind==='mushroom'){
        let top=0;
        for(const m of t.list){
          const dx=x-m.x,dz=z-m.z,d=Math.hypot(dx,dz);if(d>=m.cr)continue;
          // Clean dome cap, wider than tall, its rim curling down a little; short thick stem under the centre.
          const q=d/m.cr,capLow=h+c(m.sh-m.ct*.3*q*q),e=Math.min(heightCells,h+c(m.sh)+Math.max(1,c(m.ct*Math.sqrt(1-q*q))));
          if(d<m.sr)fillAir(MAT.stem,h,capLow);
          fillAir(MAT.mushroom,capLow,e);
          // White spots on the top surface only: one at the crown and five evenly spaced around it.
          let spot=d<m.cr*.16;for(let k=0;k<5&&!spot;k++){const A=m.spin+k*1.2566;spot=Math.hypot(dx-Math.cos(A)*m.cr*.55,dz-Math.sin(A)*m.cr*.55)<m.cr*.15;}
          if(spot&&values[e-1]===MAT.mushroom)values[e-1]=MAT.stem;
          top=Math.max(top,e);
        }
        return top;
      }
      if(kind==='cactus'){
        let top=0;const put=(a,b)=>{const lo=h+c(a);top=Math.max(top,fillAir(MAT.cactus,lo,Math.max(lo+1,h+c(b))));};
        const d=Math.hypot(x-t.x,z-t.z);if(d<t.r)put(0,t.ht+(t.r-d)*.6);
        for(const A of t.arms){
          const ax=t.x+A.ux*.6,az=t.z+A.uz*.6;if(Math.hypot(x-ax,z-az)<t.r*.8)put(A.at,A.at+A.up+.1);
          const u=(x-t.x)*A.ux+(z-t.z)*A.uz,v=Math.abs((z-t.z)*A.ux-(x-t.x)*A.uz);if(u>0&&u<.6&&v<t.r*.75)put(A.at-.05,A.at+t.r*1.3);
        }
        return top;
      }
      return 0;
    }
    // Round clumps: each lump a dome on the column's own ground.
    function stampLumps(list,x,z,values,h,mat){
      let top=0;
      for(const l of list){
        const q=Math.hypot(x-l.x,z-l.z);if(q>=l.r)continue;
        const e=Math.min(heightCells,h+Math.max(1,Math.round(l.ht*Math.sqrt(1-(q/l.r)**2)/cellMetres)));
        for(let y=h;y<e;y++)if(!values[y])values[y]=mat;top=Math.max(top,e);
      }
      return top;
    }
    // Bamboo: thin culms with a darker node every ~0.4 m and leaf tufts only along the top third. Culms are one column
    // thin, so at coarse LOD only the leafy tops remain.
    function stampBamboo(t,x,z,values,h,small){
      const period=Math.max(2,Math.round(.4/cellMetres));let top=0;
      for(const m of t.culms){
        const reach=m.tr+Math.hypot(m.lx,m.lz)*m.h+.2;if(Math.abs(x-m.x)>reach||Math.abs(z-m.z)>reach)continue;
        const y1=Math.min(heightCells,t.base+Math.round(m.h/cellMetres)),leafFrom=t.base+Math.round(m.h*.64/cellMetres),y2=Math.min(heightCells,y1+Math.round(.4/cellMetres));
        const lean=Math.hypot(m.lx,m.lz)*m.h+.13,culmClose=Math.abs(x-m.x)<lean&&Math.abs(z-m.z)<lean;
        for(let y=small||!culmClose?Math.max(h,leafFrom):h;y<y2;y++){
          const u=(y-t.base)*cellMetres,dx=x-m.x-m.lx*u,dz=z-m.z-m.lz*u,v=values[y];
          if(!small&&y<y1&&Math.abs(dx)<.13&&Math.abs(dz)<.13){if(!v||v===MAT.bambooLeaf){values[y]=(y-h)%period?MAT.bamboo:MAT.bambooNode;top=Math.max(top,y+1);}continue;}
          if(y<leafFrom||v)continue;
          const f=(u-m.h*.64)/(m.h*.36+.4);if(Math.hypot(dx,dz)<m.tr*Math.sin(Math.PI*clamp(f,0,1))+.05&&hash(Math.floor(x*8)+y*131,Math.floor(z*8),seed+121)>.3){values[y]=MAT.bambooLeaf;top=Math.max(top,y+1);}
        }
      }
      return top;
    }
    function stampTree(t,x,z,values,h,small){
      const crown=t.crown||'round',R=t.radius,top=t.base+t.height,bark=t.bark||MAT.bark,leaf=t.leaf||MAT.leaf,trunk=t.trunk||.72*density;
      let w=t.under&&!small?stampLumps(t.under,x,z,values,h,t.underLeaf||MAT.bushLeaf):0;
      if(crown==='gnarled')return Math.max(w,stampGnarled(t,x,z,values,leaf,bark,trunk));
      const dist=Math.hypot((x-t.x)/cellMetres,(z-t.z)/cellMetres);
      if(dist>=(crown==='umbrella'?R*1.15+1:R+1))return w;
      const tTop=t.top||top+Math.ceil(R*.65)+2*density+1;
      if(crown==='spire'||crown==='cone'||crown==='larch'){
        // Conifers: stacked bough tiers ("Bob Ross" trees) rather than one smooth cone. The crown runs from cell `low` up to
        // `apex` (one past the highest needle cell); span = apex - low. Tiers are counted DOWN from apex with period
        // span/5.5 (u = apex - y, tier k = floor(u/period), phase q = (u mod period)/period: 0 at a tier's top, 1 at its
        // bottom), so the renderer can shade the same tiers. Each tier's radius follows the cone envelope at its bottom
        // edge, flares outward toward that edge (a drooping skirt) and steps in by 30-45% to the tier above; a per-tier
        // hash varies size and step. The top tier is a small point. Larches are softer (smaller steps) and open.
        const low=t.base+(crown==='spire'?Math.floor(t.height*.45):crown==='larch'?4*density:3*density),apex=top+(crown==='spire'?3:2)*density,span=apex-low;
        const period=span/5.5,id=Math.floor(t.x*7)*31+Math.floor(t.z*7),soft=crown==='larch';
        const tierR=y=>{
          const u=apex-y,k=Math.floor(u/period),q=(u-k*period)/period,h1=hash(k,id,seed+131),h2=hash(k,id,seed+137);
          const env=R*Math.min(1,(k+1)/5.5)*(.86+.14*h1);
          if(k===0)return env*q**.8;
          const step=soft?.2+.1*h2:.3+.15*h2;
          return env*(1-step+step*q**1.6);
        };
        // The trunk stops below the first height where the tiers no longer wrap it in at least a cell of needles, so it never
        // pokes out of the crown (the tier tops are the narrow points).
        if(dist<trunk){let trunkTop=low;while(trunkTop<apex&&tierR(trunkTop)-.5>=trunk)trunkTop++;values.fill(bark,t.base,Math.min(heightCells,trunkTop));}
        for(let y=low;y<Math.min(heightCells,apex);y++){
          if(values[y])continue;
          if(dist<tierR(y)+.5&&(!soft||hash(Math.floor(x*8)+y*131,Math.floor(z*8),seed+123)>.3))values[y]=leaf;
        }
        return Math.max(w,tTop);
      }
      if(crown==='oval'){
        // Birch: slender white trunk with dark marks, small airy oval crown.
        if(dist<trunk)for(let y=t.base;y<Math.min(heightCells,top);y++)values[y]=hash(y,Math.floor(x*8)*3+Math.floor(z*8)*7,seed+115)<.16?MAT.birchMark:bark;
        if(dist<R){
          const ry=R*1.6,cy=top-R*.3,hh=ry*Math.sqrt(1-(dist/R)**2),lo=Math.max(t.base+Math.floor(t.height*.4),Math.floor(cy-hh)),hi=Math.min(heightCells,Math.ceil(cy+hh));
          for(let y=lo;y<hi;y++)if(!values[y]&&hash(Math.floor(x*8)+y*131,Math.floor(z*8),seed+117)>.2)values[y]=leaf;
        }
        return Math.max(w,tTop);
      }
      if(crown==='umbrella'){
        // Acacia: thin trunk, a branch to a lower side pad, flat leaf pads with gently domed tops.
        if(dist<trunk)values.fill(bark,t.base,Math.min(heightCells,top));
        const P2=t.pads[1],y0=t.base+Math.round(t.height*.45),sx=P2.x-t.x,sz=P2.z-t.z,L2=sx*sx+sz*sz,s=clamp(((x-t.x)*sx+(z-t.z)*sz)/L2,0,1);
        if(Math.hypot(x-t.x-sx*s,z-t.z-sz*s)<trunk*cellMetres*.9){const y=Math.round(y0+(P2.y-y0)*s);values.fill(bark,y,Math.min(heightCells,y+density+1));}
        const th=2*density;
        for(const p of t.pads){
          const q=Math.hypot((x-p.x)/cellMetres,(z-p.z)/cellMetres),rr=p.r*(.85+.3*noise(x*.6,z*.6,seed+119));if(q>=rr)continue;
          const lo=p.y-th+(q>rr*.8?density:0),hi=Math.min(heightCells,p.y+Math.max(1,Math.round(th*(1-(q/rr)**2))));
          for(let y=lo;y<hi;y++)if(!values[y])values[y]=leaf;
        }
        return Math.max(w,tTop);
      }
      // Round broadleaf crown.
      const clear=t.cls===-1?density:5*density;
      if(dist<trunk)values.fill(bark,t.base,top);
      if(dist<R){
        const rise=Math.sqrt(R*R-dist*dist),low=Math.max(t.base+clear,Math.floor(top-rise*.55)),high=Math.min(heightCells,Math.ceil(top+rise*.65));
        for(let y=low;y<high;y++)if(!values[y])values[y]=leaf;
      }
      return Math.max(w,tTop);
    }
    // Twisted lakeside tree: a trunk that leans out (over the water) with a wobble, and a broad lumpy crown that droops.
    function stampGnarled(t,x,z,values,leaf,bark,trunk){
      const L=Math.hypot(t.lx,t.lz),mx=t.x+t.lx/2,mz=t.z+t.lz/2;
      if(Math.hypot(x-mx,z-mz)>L/2+t.radius*cellMetres*1.4+1)return 0;
      const nx=-t.lz/(L||1),nz=t.lx/(L||1);
      for(let y=t.base;y<Math.min(heightCells,t.base+t.height);y++){
        const f=(y-t.base)/t.height,wob=Math.sin(f*7+t.x)*.35*f,cx=t.x+t.lx*f**1.5+nx*wob,cz=t.z+t.lz*f**1.5+nz*wob;
        if(Math.hypot((x-cx)/cellMetres,(z-cz)/cellMetres)<trunk*(1.35-.55*f))values[y]=bark;
      }
      for(const l of t.lumps){
        const q=Math.hypot((x-l.x)/cellMetres,(z-l.z)/cellMetres),r=l.r*(.85+.3*noise(x*.5,z*.5,seed+125));if(q>=r)continue;
        const hh=Math.sqrt(r*r-q*q),lo=Math.floor(l.y-hh*.5)-(hash(Math.floor(x*4),Math.floor(z*4),seed+127)<.3?2*density:0),hi=Math.min(heightCells,Math.ceil(l.y+hh*.7));
        for(let y=Math.max(0,lo);y<hi;y++)if(!values[y])values[y]=leaf;
      }
      return t.top;
    }
    // Per-column ground scatter by biome, from hashes only (no lookups): ferns and glowing blue flowers on forest floors,
    // wildflower patches and grass tufts in open ground, reeds on wet mud and in still shallows. Smaller than a sampled
    // column at coarse LOD, so column() only calls it for the finest levels. Returns one past the highest cell written.
    // Ground sets for scatter: under-canopy litter (ferns, glow flowers) and dry grasses (more tufts). TURF and GRASSY
    // (open green grass, where flowers grow) are defined with the biome ground palette.
    const LITTER=new Set([MAT.podzol,MAT.litter,MAT.autumnlitter,MAT.petal,MAT.junglefloor]),DRYGRASS=new Set([MAT.dry,MAT.steppegrass,MAT.savgrass,MAT.goldgrass]);
    const FOREST_FLOOR=new Set(['forest','redwood','rainforest','boreal','montane','autumn','blossom','bamboo']);
    function scatter(g,x,z,values,h){
      const b=g.biome,cx=Math.floor(x*4),cz=Math.floor(z*4),r=hash(cx,cz,seed+52),r2=hash(cx,cz,seed+54),top=values[h-1]&127;
      const put=(m,n)=>{const e=Math.min(heightCells,h+Math.max(1,n));values.fill(m,h,e);return e;};
      if(g.water>h){
        if(g.sea||g.foam||g.water-h>2*density||r>=.3*clamp(noise(x*.2,z*.2,seed+641)-.35,0,1))return 0;
        const e=Math.min(heightCells,g.water+Math.round((.3+.5*r2)/cellMetres));values.fill(MAT.reed,h,e);return e;
      }
      if(values[h]!==0||g.exposed)return 0;
      if(top===MAT.mud||(b==='wetland'||b==='fen')&&(GRASSY.has(top)||top===MAT.litter||top===MAT.sphagnum))
        return r<.14*clamp((noise(x*.25,z*.25,seed+643)-.35)*2.5,0,1)*(top===MAT.mud?1:.5)?put(MAT.reed,Math.round((.45+.6*r2)/cellMetres)):0;
      const floor=LITTER.has(top);
      if(floor||FOREST_FLOOR.has(b)&&TURF.has(top)){
        if(floor&&r>.993&&noise(x*.1,z*.1,seed+657)>.55)return put(MAT.glowFlower,density);
        // Ferns: small domed clumps on a 0.75 m grid, gathered in damp patches.
        const fx=Math.floor(x/.75),fz=Math.floor(z/.75);
        if(hash(fx,fz,seed+651)<.16*clamp((noise(x*.12,z*.12,seed+645)-.4)*3,0,1)+.006){
          const d=Math.hypot(x-(fx+.5+(hash(fx,fz,seed+653)-.5)*.2)*.75,z-(fz+.5+(hash(fx,fz,seed+655)-.5)*.2)*.75);
          if(d<.34)return put(MAT.fern,Math.round((.35+.35*hash(fx,fz,seed+659))*(1-d/.5)/cellMetres));
        }
        return 0;
      }
      if(TURF.has(top)){
        // Wildflower patches in open grass and meadows: yellow, pink and violet drifts. Tufts are commoner on dry grasses.
        const dry=DRYGRASS.has(top);
        if((GRASSY.has(top)||top===MAT.tundra)&&!FOREST_FLOOR.has(b)){const p=noise(x*.07,z*.07,seed+647)+(b==='flowers'?.2:0);if(p>.7&&r<.08*(p-.7)/.3+.012){const c=noise(x*.03,z*.03,seed+649)+(r2-.5)*.35;return put(c<.42?MAT.flowerYellow:c<.62?MAT.flower:MAT.flowerViolet,density);}}
        if(r<(dry?.02:.008))return put(MAT.tuft,Math.round((.25+.3*r2)/cellMetres));
        if(GRASSY.has(top)&&r>.994&&!g.wet)return put(MAT.flower,density);
      }
      return 0;
    }
    function column(vx,vz,into){
      const values=into||new Uint8Array(heightCells);colTop=0;
      const x=(vx+.5)*cellMetres,z=(vz+.5)*cellMetres;
      if(!infinite&&(x<0||z<0||x>=extent||z>=extent))return values;
      let t0=prof&&prof.on&&now();
      const g=geography(x,z),h=g.height;let written=h+density;
      if(prof&&prof.on){const t=now();prof.geography+=t-t0;t0=t;}
      values.fill(MAT.basalt,0,Math.max(0,h-4*density));
      values.fill(g.exposed?MAT.basalt:MAT.soil,Math.max(0,h-4*density),h);
      if(infinite){
        const b=g.biome,sub=b==='desert'||b==='beach'||b==='sea'?MAT.sand:b==='badlands'?MAT.clay:MAT.soil;
        if(!g.exposed)values.fill(sub,Math.max(0,h-4*density),h);
        // Ground variety, each with a noise-wobbled edge: wet mud then sand on river banks (creeks: mud only), gravel scree on
        // steep mountain soil, and worn coarse-dirt patches in open grass.
        const wob=(noise(x*.35,z*.35,seed+611)-.5)*1.6,rd=g.riverDistance+wob;
        const bank=g.water>h&&!g.sea?0:rd<4.6?MAT.mud:g.riverSize>=.6&&rd<9?MAT.sand:0;
        values[h-1]=g.exposed?MAT.basalt:b==='glacier'?(g.temperature<-6?MAT.snow:MAT.ice):b==='snow'?MAT.snow:b==='sea'||b==='beach'?MAT.sand:bank?bank:b==='alpine'?MAT.basalt:turf(b,x,z,h,g);
        if(TURF.has(values[h-1])){
          if(g.relief>15&&g.slope>.95+(noise(x*.3,z*.3,seed+613)-.5)*.35)values[h-1]=MAT.gravel;
          else if((b==='grassland'||b==='steppe'||b==='savanna')&&noise(x*.06,z*.06,seed+615)>.93-(noise(x*.5,z*.5,seed+617)-.5)*.08)values[h-1]=MAT.dirt;
        }
        if(g.iceCells)values.fill(MAT.ice,h-g.iceCells,h);
      }else values[h-1]=g.exposed?MAT.basalt:g.riverDistance<9?MAT.sand:MAT.grass;
      if(Math.hypot(x-deposit.x,z-deposit.z)<1.15&&g.exposed)values.fill(MAT.ore,h-3*density,h);
      if(infinite){if(g.water>h){values.fill(MAT.water,h,g.water);if(g.foam)values[g.water-1]=MAT.foam;written=Math.max(written,g.water);}}
      else if(h<24*density&&g.riverDistance<7)values.fill(MAT.water,h,24*density);
      if(prof&&prof.on){const t=now();prof.features+=t-t0;t0=t;}
      const gx=Math.floor(x/TG),gz=Math.floor(z/TG),floorWob=(noise(x*.45,z*.45,seed+619)-.5)*.45;let floorMat=9;
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        const t=tree(gx+dx,gz+dz);if(!t)continue;
        // Needle or leaf litter under trees and bamboo, a ring of bare dirt around conifers.
        if(t.radius&&t.cls!==-1||t.kind==='bamboo'){
          const f=Math.hypot(x-t.x,z-t.z)/(t.radius?t.radius*cellMetres*(t.redwood?1.5:1.05):1.9)+floorWob;
          if(f<1.12)floorMat=Math.min(floorMat,f<1?(t.conifer?0:1):t.conifer?2:3);
        }
        const w=stampPlant(t,x,z,values,h);if(w>written)written=w;
      }
      if(prof&&prof.on){const t=now();prof.trees+=t-t0;t0=t;}
      // Under-canopy floor: podzol under conifers; under broadleaf, leaf litter in temperate woods, gold litter in autumn woods,
      // petals in blossom groves, dark jungle floor under rainforest and bamboo, and a shaded moss disc under lone trees in open
      // country. The fringe ring is worn dirt only around conifers (2); around other trees (3) the ground runs up to the trunk.
      if(infinite&&floorMat<9&&(TURF.has(values[h-1])||values[h-1]===MAT.gravel)){const b=g.biome,m=floorMat===0?MAT.podzol:b==='autumn'?MAT.autumnlitter:b==='blossom'?MAT.petal:floorMat===2?MAT.dirt:floorMat===3?0
        :b==='forest'||b==='redwood'||b==='wetland'?MAT.litter:b==='rainforest'||b==='bamboo'?MAT.junglefloor:b==='fen'?MAT.sphagnum:MAT.mossy;if(m)values[h-1]=m;}
      if(infinite){
        const I=isleAt(x,z),F=isleCell(Math.floor(x/IG),Math.floor(z/IG))?.fall;
        if(F){const q=Math.hypot(x-F.x,z-F.z);
          if(q<.75){const to=Math.min(heightCells,Math.floor(F.bottom/cellMetres));if(to>h){values.fill(MAT.water,h,to);written=Math.max(written,to);}}
          else if(q<3&&values[h]===0&&g.water<=h){values[h]=q<1.8?MAT.foam:MAT.water;}}
        // Ground beneath a sky isle lies in its shadow (material bit 7), which shows the gap under the slab from above.
        if(I&&I.bottom>h*cellMetres)values[h-1]|=SHADE;
        if(I){const b=clamp(Math.floor(I.bottom/cellMetres),0,heightCells),t=clamp(Math.floor(I.top/cellMetres),b+1,heightCells);
          written=Math.max(written,t);values.fill(MAT.crystal,clamp(Math.floor(I.keel/cellMetres),0,b),b);values.fill(MAT.basalt,b,t);values.fill(MAT.soil,Math.max(b,t-4*density),t);values[t-1]=I.cold?MAT.snow:MAT.grass;}
        const S=spiresNear(x,z);
        if(S){
          let near=false;
          for(const p of S.list){
            const dx=x-p.x,dz=z-p.z;if(Math.hypot(dx,dz)>p.r+p.h*.25+1){if(Math.hypot(dx,dz)<p.r+3.5)near=true;continue;}near=true;
            const y0=Math.max(0,Math.floor(p.base/cellMetres)),y1=Math.min(heightCells,Math.ceil((p.base+p.h)/cellMetres));written=Math.max(written,y1);
            for(let y=y0;y<y1;y++){const u=y*cellMetres-p.base,r=p.r*(1-u/p.h)**.8;if(Math.hypot(dx-p.lx*u,dz-p.lz*u)<r)values[y]=MAT.crystal;}
          }
          // Aether moss carpets soft ground around a cluster.
          if(near&&!g.exposed&&values[h-1]!==MAT.crystal&&values[h-1]!==MAT.sand)values[h-1]=MAT.moss;
        }
      }
      if(infinite){
        const A=ancientNear(x,z);
        if(A&&Math.abs(x-A.x)<A.reach&&Math.abs(z-A.z)<A.reach){
          const d=Math.hypot(x-A.x,z-A.z),blossom=A.variant==='blossom';
          const fill=(m,y0,y1,force)=>{const a=Math.max(0,Math.floor(y0/cellMetres)),b=Math.min(heightCells,Math.ceil(y1/cellMetres));for(let y=a;y<b;y++)if(force||!values[y]||m===MAT.bark)values[y]=m;};
          // Raised grassy mound, mossy near the trunk, strewn with fallen petals under the canopy.
          let gTop=h;
          if(d<A.Mr*1.1){
            const mt=Math.ceil(A.mound(d+(noise(x*.2,z*.2,seed+623)-.5)*1.6)/cellMetres);
            if(mt>h&&values[h]!==MAT.water){values.fill(MAT.soil,h-1,Math.min(heightCells,mt));gTop=Math.min(heightCells,mt);
              const r=hash(Math.floor(x*4),Math.floor(z*4),seed+625);values[gTop-1]=d<A.R*2.2+noise(x*.4,z*.4,seed+627)*2?MAT.moss:r<.1?(blossom?(r<.04?MAT.blossomWhite:MAT.blossom):MAT.coral):MAT.grass;}
          }
          // Trunk: massive at the foot (root flare), tapering as it leans; spiral ridges twist around it.
          if(Math.hypot(x-A.x-A.lx/2,z-A.z-A.lz/2)<Math.hypot(A.lx,A.lz)/2+A.R*2.6+1)
            for(let y=Math.max(0,Math.floor((A.base-1.5)/cellMetres));y<Math.min(heightCells,Math.ceil((A.cy+1)/cellMetres));y++){
              const u=y*cellMetres-A.base,f=clamp(u/A.H,0,1),ox=A.x+A.lx*f**1.6,oz=A.z+A.lz*f**1.6;
              const r=A.R*(1-.5*f)*(1+1.3*Math.max(0,1-u/3.5)**2)*(1+.2*Math.sin(Math.atan2(z-oz,x-ox)*6+u*A.twist));if(Math.hypot(x-ox,z-oz)<r)values[y]=MAT.bark;}
          // Exposed roots arching over the mound.
          for(const r of A.roots){if(x<r.x0||x>r.x1||z<r.z0||z>r.z1)continue;
            for(const p of r.pts){const q=Math.hypot(x-p.x,z-p.z);if(q<p.r){const hh=Math.sqrt(p.r*p.r-q*q);fill(MAT.bark,p.y-hh,p.y+hh,true);}}}
          // Limbs: tapering cylinders sampled as spheres along each branch.
          for(const l of A.limbs)for(let s2=0;s2<=14;s2++){const t=s2/14,px=l.x0+(l.x1-l.x0)*t,pz=l.z0+(l.z1-l.z0)*t,py=l.y0+(l.y1-l.y0)*Math.sqrt(t),r=l.r0+(l.r1-l.r0)*t,q=Math.hypot(x-px,z-pz);
            if(q<r){const hh=Math.sqrt(r*r-q*q);fill(MAT.bark,py-hh,py+hh);}}
          // Blossom canopy: lumpy violet domes with white drifts and a little green, strands hanging beneath.
          const drape=hash(Math.floor(x*4),Math.floor(z*4),seed+629);
          for(const l of A.lumps){const r=l.r*(.85+.3*noise(x*.3,z*.3,seed+463)),q=Math.hypot(x-l.x,z-l.z);if(q>=r)continue;const hh=Math.sqrt(r*r-q*q)*.5;
            const a=Math.max(0,Math.floor((l.y-hh*.7-(drape<.14?1+3*drape/.14:0))/cellMetres)),b=Math.min(heightCells,Math.ceil((l.y+hh)/cellMetres));
            for(let y=a;y<b;y++)if(!values[y]){const n=noise(x*1.1+y*cellMetres*.8,z*1.1,seed+631)*.6+noise(x*.15,z*.15,seed+637)*.4;values[y]=n>.7?MAT.blossomWhite:n<.2?MAT.leaf:MAT.blossom;}}
          // Coral variant: flat umbrella pads with softly domed tops.
          for(const p of A.pads){const r=p.r*(.88+.24*noise(x*.35,z*.35,seed+633)),q=Math.hypot(x-p.x,z-p.z);if(q>=r)continue;
            fill(MAT.coral,p.y-p.th*.4-(q>r*.86?.3:0),p.y+p.th*Math.sqrt(1-(q/r)**4));}
          // Broken pillars and wall stubs among the roots, mossy on top.
          for(const s2 of A.stones){const dx=x-s2.x,dz=z-s2.z,inside=s2.wall?Math.abs(dx*s2.ux+dz*s2.uz)<s2.hl&&Math.abs(dz*s2.ux-dx*s2.uz)<.4:Math.hypot(dx,dz)<s2.r;if(!inside)continue;
            const t=Math.min(heightCells,gTop+Math.max(1,Math.round(s2.ht*(.75+.5*noise(x*.6,z*.6,seed+635))/cellMetres)));for(let y=gTop-1;y<t;y++)values[y]=MAT.stone;values[t-1]=MAT.mossy;written=Math.max(written,t);}
          written=Math.max(written,gTop,Math.ceil(A.top/cellMetres)+1);
        }
        const bi=Math.floor(x/BG),bj=Math.floor(z/BG);
        for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
          const B=boulderCell(bi+di,bj+dj);if(!B||Math.abs(x-B.x)>B.reach||Math.abs(z-B.z)>B.reach)continue;
          for(const q of B.list){const d=Math.hypot(x-q.x,z-q.z)/(q.r*(.85+.3*noise(x*.9,z*.9,seed+565)));if(d>=1)continue;
            const half=q.ry*Math.sqrt(1-d*d),a=Math.max(0,Math.floor(Math.min(q.y-half,h*cellMetres-.25)/cellMetres)),b=Math.min(heightCells,Math.ceil((q.y+half)/cellMetres));
            if(b>a){values.fill(MAT.basalt,a,b);written=Math.max(written,b);}}
        }
        const K=rockNear(x,z);
        if(K&&Math.abs(x-K.x)<K.reach&&Math.abs(z-K.z)<K.reach){
          const ground=h*cellMetres-.25,put=(m,y0,y1)=>{const a=Math.max(0,Math.floor(y0/cellMetres)),b=Math.min(heightCells,Math.ceil(y1/cellMetres));if(b>a){values.fill(m,a,b);written=Math.max(written,b);}};
          if(K.kind==='arch'){
            // A thick elliptical band: outer ellipse minus inner ellipse; legs run down to each column's own ground.
            const dx=x-K.x,dz=z-K.z,u=dx*K.ux+dz*K.uz,v=-dx*K.uz+dz*K.ux,Lo=K.Ls+K.t,Li=K.Ls-K.t;
            if(Math.abs(v)<K.dh*(.8+.4*noise(x*.4,z*.4,seed+537))&&Math.abs(u)<Lo){
              const out=K.base+(K.Ha+K.t)*Math.sqrt(1-(u/Lo)**2)+(noise(x*.5,z*.5,seed+539)-.5)*.8;
              if(Math.abs(u)<Li){const inn=K.base+(K.Ha-K.t)*Math.sqrt(1-(u/Li)**2);put(K.mat,inn,out);}else put(K.mat,Math.min(ground,K.base),out);
            }
          }else if(K.kind==='stack'){
            const d=Math.hypot(x-K.x,z-K.z)+(noise(x*.3,z*.3,seed+541)-.5)*2;
            if(d<K.r){put(MAT.basalt,ground-.5,K.top-1);put(MAT.grass,K.top-1,K.top);}
          }else for(const q of K.list){
            const d=Math.hypot(x-q.x,z-q.z);if(d>q.r*1.3)continue;
            // Pinched in the middle, capped by a wider dark stone.
            for(let y=Math.max(0,Math.floor(q.base/cellMetres));y<Math.min(heightCells,Math.ceil((q.base+q.h+1.2)/cellMetres));y++){
              const u=y*cellMetres-q.base;if(u>q.h){if(d<q.r*1.3)values[y]=MAT.basalt;}else if(d<q.r*(1-.38*Math.sin(Math.PI*u/q.h)))values[y]=MAT.sandstone;}
            written=Math.max(written,Math.ceil((q.base+q.h+1.2)/cellMetres));
          }
        }
        const R=ruinNear(x,z);
        // Ruins never stand in water: a column under a pond or stream keeps its water.
        if(R&&g.water<=h&&Math.abs(x-R.x)<R.reach&&Math.abs(z-R.z)<R.reach){
          const ground=h*cellMetres-.25;
          for(const q of R.parts){
            let u,inside,side=false;
            if(q.t==='path'){const dx=x-q.cx,dz=z-q.cz;if(Math.abs(dx*q.ux+dz*q.uz)<q.hl&&Math.abs(-dx*q.uz+dz*q.ux)<q.hw&&noise(x*.5,z*.5,seed+495)>.3&&values[h]===0)values[h-1]=MAT.stone;continue;}
            // `side`: the 0.3 m strip just outside a wall face, where ivy hangs.
            if(q.t==='box'){const dx=x-q.cx,dz=z-q.cz,v=Math.abs(-dx*q.uz+dz*q.ux);u=dx*q.ux+dz*q.uz;inside=Math.abs(u)<q.hl&&v<q.hw;side=!inside&&Math.abs(u)<q.hl&&v<q.hw+.3;}
            else{const d=Math.hypot(x-q.cx,z-q.cz),o=q.th?Math.abs(d-q.r)-q.th/2:d-q.r;inside=o<0;side=!inside&&o<.3;u=Math.atan2(z-q.cz,x-q.cx)*q.r;}
            if(!inside&&!side)continue;
            let top=q.y1+(q.gable?q.gable*(1-Math.abs(u)/q.hl):0);
            // Crumbling: broken stretches drop by up to `rough`; intact stretches keep battlements (alternate 0.8 m merlons).
            const broken=q.rough?clamp((noise(x*.3+q.k*7.1,z*.3,seed+493)-.35)*2.2,0,1):0;top-=q.rough*broken;
            if(q.crenel&&broken<.05&&Math.floor(u/.8)%2)top-=.8;
            const from=Math.max(0,Math.floor((q.seat===false?q.y0:Math.min(q.y0,ground))/cellMetres)),to=Math.min(heightCells,Math.ceil(top/cellMetres));
            if(to<=from)continue;
            if(side){
              // Ivy curtains hang from the wall top down a stretch of the face, in patches along the wall.
              // Climbing ivy creeps up from the foot of the wall in other patches.
              const ivy=noise(u*.45+q.k*3.3,.5,seed+497),climb=noise(u*.5+q.k*1.7,2.5,seed+507),m=noise(u*.8,q.k,seed+509)>.5?MAT.leaf:MAT.bushLeaf;
              if(ivy>=.52){const len=(to-from)*(.35+.6*noise(u*1.3+q.k,1.5,seed+499));for(let y=Math.max(from,Math.floor(to-len));y<to;y++)if(!values[y])values[y]=m;}
              if(climb>=.5){const up=Math.max(h,from)+Math.round((to-from)*(.15+.75*noise(u*1.6+q.k,3.5,seed+511)));for(let y=Math.max(h,from);y<Math.min(to,up);y++)if(!values[y])values[y]=MAT.bushLeaf;}
              written=Math.max(written,to);continue;
            }
            values.fill(MAT.stone,from,to);written=Math.max(written,to);
            // Moss: on the wall top where it is level enough to hold soil, and in damp patches lower down.
            if(noise(x*.6+q.k,z*.6,seed+501)>.3)values[to-1]=MAT.mossy;
            for(let y=from;y<to-1;y++)if(hash(Math.floor(x*4),y*7919+Math.floor(z*4),seed+503)<.12*clamp((noise(x*.4,z*.4+y*.05,seed+505)-.35)*3,0,1))values[y]=MAT.mossy;
            // Damp moss creeps up the foot of the wall from the ground.
            {const band=h+Math.round((.2+.9*noise(x*.5+q.k,z*.5,seed+513))/cellMetres);for(let y=Math.max(from,h-1);y<Math.min(to-1,band);y++)if(hash(Math.floor(x*4),y*131+Math.floor(z*4),seed+515)<.6)values[y]=MAT.mossy;}
          }
        }
      }
      if(prof&&prof.on)prof.features+=now()-t0;
      if(!infinite){if(!g.exposed&&!g.wet&&g.clearing<.5&&hash(Math.floor(vx/density),Math.floor(vz/density),seed+52)>.994&&values[h]===0)values.fill(MAT.flower,h,h+density);}
      else if(colStep*cellMetres<.51)written=Math.max(written,scatter(g,x,z,values,h));
      colTop=Math.min(heightCells,written);
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
    // Streamed LOD nodes: level L samples one world column every 2^L cells, so a node of NODE x NODE columns covers
    // NODE*2^L cells per side. Every level is real voxels (trees, spires, isles included), built at its own spacing
    // rather than generated at full resolution and thrown away.
    const NODE=32,MAX_LEVEL=Math.round(Math.log2(8/cellMetres)),nodeMetres=L=>NODE*cellMetres*2**L;
    // Upper bound on anything a node can hold (ground, trees, spires, isles), so a view only requests nodes that can reach it.
    const bounds=new Map();
    function nodeBound(L,nx,nz){
      if(!infinite)return heightCells*cellMetres;
      const k=L+':'+nx+':'+nz;let v=bounds.get(k);if(v!==undefined)return v;
      const m=nodeMetres(L),n=m>64?4:2,x0=nx*m,z0=nz*m;v=SEA+12;
      for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const t=tectonics(x0+m*i/n,z0+m*j/n);v=Math.max(v,Math.max(t.h,SEA)+t.relief*.36+24);}
      for(let j=Math.floor(z0/IG);j<=Math.floor((z0+m)/IG);j++)for(let i=Math.floor(x0/IG);i<=Math.floor((x0+m)/IG);i++){const I=isleCell(i,j);if(I)v=Math.max(v,I.top+3);}
      for(let j=Math.floor((z0-16)/AG);j<=Math.floor((z0+m+16)/AG);j++)for(let i=Math.floor((x0-16)/AG);i<=Math.floor((x0+m+16)/AG);i++){const A=ancientCell(i,j);if(A)v=Math.max(v,A.top+2);}
      v=Math.min(v,heightCells*cellMetres);bounds.set(k,v);if(bounds.size>16384)bounds.delete(bounds.keys().next().value);return v;
    }
    const heightBound=(cx,cz)=>nodeBound(Math.log2(CHUNK*density/NODE),cx,cz);
    function node(L,nx,nz){
      if(!infinite)throw new Error('LOD nodes are only generated for the streamed world');
      if(!(Number.isInteger(L)&&L>=0&&L<=MAX_LEVEL)||![nx,nz].every(Number.isInteger))throw new Error('Invalid LOD node');
      const s=2**L,P=NODE+2,blocks=Math.ceil(heightCells/s),cols=new Array(P*P),tops=new Int32Array(P*P);let ny=1,reduce=0;
      prof={geography:0,trees:0,features:0,on:false};let sampled=0;colStep=s;
      // One sampled column per block column, reduced vertically by keeping each block's top occupied material. The column
      // buffer is reused: only cells below colTop were written, so only those are scanned and cleared.
      const buf=new Uint8Array(heightCells),floor=new Int32Array(P*P);
      for(let j=0;j<P;j++)for(let i=0;i<P;i++){
        prof.on=((i+j)&3)===0;if(prof.on)sampled++;
        const c=column((nx*NODE+i-1)*s+(s>>1),(nz*NODE+j-1)*s+(s>>1),buf),lim=colTop,t0=prof.on&&now(),b=new Uint8Array(blocks);let top=0;
        let hi=lim-1;while(hi>=0&&!c[hi])hi--;
        for(let y=0;y<=hi;y++){const m=c[y];if(m){b[(y/s)|0]=m;top=((y/s)|0)+1;}}
        c.fill(0,0,lim);let f=0;while(f<top&&b[f])f++;
        cols[j*P+i]=b;tops[j*P+i]=top;floor[j*P+i]=f;if(prof.on)reduce+=now()-t0;
        if(i>0&&j>0&&i<=NODE&&j<=NODE)ny=Math.max(ny,top);
      }
      // Skirt: halo columns stop two blocks below the lower of themselves and the adjacent inside column, so every
      // border carries a short wall that covers height mismatches against a coarser or finer neighbour.
      const limits=new Int32Array(P*P);let low=ny;
      for(let j=0;j<P;j++)for(let i=0;i<P;i++){const k=j*P+i,inside=i>0&&j>0&&i<=NODE&&j<=NODE;limits[k]=Math.min(ny,inside?ny:Math.max(0,Math.min(tops[k],tops[clamp(j,1,NODE)*P+clamp(i,1,NODE)])-2));low=Math.min(low,floor[k],limits[k]);}
      // Below the lowest air in any column every block is solid and has no visible face: mesh from just under it, with a
      // solid layer beneath so no bottom faces are emitted. Output y is offset back by `base`.
      const base=Math.max(0,low-1),span=ny-base,plane=P*(span+2),dense=new Uint8Array(P*plane);
      for(let j=0;j<P;j++)for(let i=0;i<P;i++){
        const k=j*P+i,b=cols[k],o=j*plane+i;dense[o]=1;
        for(let y=base;y<limits[k];y++)dense[o+(y-base+1)*P]=b[y];
      }
      colStep=1;const scale=P*P/Math.max(1,sampled),timing={geography:prof.geography*scale,trees:prof.trees*scale,features:prof.features*scale,reduce:reduce*scale};prof=null;const t1=now(),mesh=greedy(dense,NODE,span,NODE,base);timing.mesh=now()-t1;
      return {...mesh,normals:hillshade(tops,P),normalSize:NODE,level:L,nx,nz,column:cellMetres*s,top:ny,timing};
    }
    // Smooth surface normals per inside column (RGBA8: x, z, cavity, unused) from the haloed column tops, so distant
    // terraces light as the slope they form instead of alternating tread/riser bands. Blocks are cubic, so the gradient
    // is unitless. Sobel, then a 3×3 blur, widens the kernel enough to hide single-block steps.
    function hillshade(tops,P){
      const N=P-2,T=(i,j)=>tops[j*P+i],gx=new Float32Array(N*N),gz=new Float32Array(N*N),cavity=new Float32Array(N*N),out=new Uint8Array(N*N*4);
      for(let j=0;j<N;j++)for(let i=0;i<N;i++){
        const I=i+1,J=j+1;let sum=0;for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++)sum+=T(I+a,J+b);
        gx[j*N+i]=(T(I+1,J-1)+2*T(I+1,J)+T(I+1,J+1)-T(I-1,J-1)-2*T(I-1,J)-T(I-1,J+1))/8;
        gz[j*N+i]=(T(I-1,J+1)+2*T(I,J+1)+T(I+1,J+1)-T(I-1,J-1)-2*T(I,J-1)-T(I+1,J-1))/8;
        cavity[j*N+i]=T(I,J)-sum/9;
      }
      for(let j=0;j<N;j++)for(let i=0;i<N;i++){
        let x=0,z=0,n=0;
        for(let b=Math.max(0,j-1);b<=Math.min(N-1,j+1);b++)for(let a=Math.max(0,i-1);a<=Math.min(N-1,i+1);a++){x+=gx[b*N+a];z+=gz[b*N+a];n++;}
        x/=n;z/=n;const l=Math.hypot(x,1,z),o=(j*N+i)*4;
        out[o]=Math.round(128-127*x/l);out[o+1]=Math.round(128-127*z/l);out[o+2]=clamp(Math.round(128+cavity[j*N+i]*40),0,255);out[o+3]=255;
      }
      return out;
    }
    return Object.freeze({id,dataId:`${id}:cell:${cellMetres}:extent:${extent}`,seed,revision,extent,infinite,cell:cellMetres,chunkCells,heightCells,chunkMetres:chunkCells*cellMetres,heightMetres:heightCells*cellMetres,deposit,geography,ground,column,tree,generateChunk,node,landmarksAt:(x,z)=>infinite?{ancient:ancientNear(x,z),ruin:ruinNear(x,z),rock:rockNear(x,z)}:{ancient:null,ruin:null,rock:null},nodeBound,heightBound,nodeSize:NODE,maxLevel:MAX_LEVEL,nodeMetres,vegetationEntries:()=>trees.size,setDrainageCrease:fn=>{creaseAt=typeof fn==='function'?fn:null;for(const D of DRAIN)D.tiles.clear();}});
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
    return {...greedy(dense,nx,ny,nx),step,temporaryDenseBytes:dense.byteLength};
  }
  // Greedy mesher over a dense block grid with a one-block halo on every side: layout (z+1)*halo*(ny+2)+(y+1)*halo+x+1,
  // halo=nx+2. Merges coplanar same-material exposed faces; a face on the halo boundary belongs to the neighbour.
  function greedy(dense,nx,ny,nz,yOffset=0){
    const halo=nx+2,stride=[1,halo,halo*(ny+2)],dims=[nx,ny,nz],origin=stride[0]+stride[1]+stride[2];
    const mask=new Int16Array(Math.max(nx*ny,nx*nz,ny*nz));
    let output=new ArrayBuffer(16384),view=new DataView(output),used=0,quads=0,exposedFaces=0;
    for(let d=0;d<3;d++){
      const u=(d+1)%3,v=(d+2)%3,su=stride[u],sv=stride[v],sd=stride[d],nu=dims[u],nv=dims[v];
      for(let pd=-1;pd<dims[d];pd++){
        let n=0;
        for(let pv=0;pv<nv;pv++){let i=origin+pd*sd+pv*sv;for(let pu=0;pu<nu;pu++,i+=su){
          const a=dense[i],b=dense[i+sd];
          // The neighbouring solid owns its face; never duplicate it in this block.
          const value=a&&!b&&pd>=0?a:!a&&b&&pd<dims[d]-1?-b:0;
          mask[n++]=value;if(value)exposedFaces++;
        }}
        for(let j=0;j<nv;j++)for(let i=0;i<nu;){
          n=j*nu+i;const c=mask[n];if(!c){i++;continue;}
          let w=1;while(i+w<nu&&mask[n+w]===c)w++;
          let h=1;outer:while(j+h<nv){for(let k=0;k<w;k++)if(mask[n+k+h*nu]!==c)break outer;h++;}
          const pos=[0,0,0],du=[0,0,0],dv=[0,0,0];pos[d]=pd+1;pos[u]=i;pos[v]=j;du[u]=w;dv[v]=h;
          const normal=d*2+(c>0?1:0),m=Math.abs(c),corners=[pos,pos.map((t,k)=>t+du[k]),pos.map((t,k)=>t+du[k]+dv[k]),pos.map((t,k)=>t+dv[k])];
          if(used+48>output.byteLength){const larger=new ArrayBuffer(output.byteLength*2);new Uint8Array(larger).set(new Uint8Array(output));output=larger;view=new DataView(output);}
          for(const k of c>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]){for(let a=0;a<3;a++)view.setUint16(used+a*2,corners[k][a]+(a===1?yOffset:0),true);view.setUint8(used+6,normal);view.setUint8(used+7,m);used+=8;}
          quads++;for(let b=0;b<h;b++)for(let a=0;a<w;a++)mask[n+a+b*nu]=0;i+=w;
        }
      }
    }
    const buffer=output.slice(0,used);
    return {buffer,count:quads*6,quads,exposedFaces,scratchBytes:dense.byteLength+mask.byteLength+output.byteLength+used};
  }
  class BudgetCache{
    constructor(maxEntries=144,maxBytes=32*1024*1024,dispose=()=>{}){this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.dispose=dispose;this.items=new Map();this.bytes=0;}
    get(key){const v=this.items.get(key);if(v){this.items.delete(key);this.items.set(key,v);}return v;}
    set(key,value,retain=[]){this.delete(key);if(value.bytes>this.maxBytes){this.dispose(value);return false;}for(const k of retain)this.get(k);this.items.set(key,value);this.bytes+=value.bytes;while(this.items.size>this.maxEntries||this.bytes>this.maxBytes)this.delete(this.items.keys().next().value);return true;}
    delete(key){const v=this.items.get(key);if(v){this.bytes-=v.bytes;this.items.delete(key);this.dispose(v);}}
    clear(){for(const key of this.items.keys())this.delete(key);}
  }
  const api={CELL,CHUNK,HEIGHT,EXTENT,REVISION,MAX_CHUNK,MAT,SHADE,COLORS,BIOME_NAMES,hash,riverX,movePosition,positionAt,createWorld,voxel,meshChunk,BudgetCache};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MicroWorld=api;
})(typeof globalThis==='object'?globalThis:this);
