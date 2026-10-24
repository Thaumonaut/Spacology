(function(root){
  'use strict';
  const CELL=.25,CHUNK=32,HEIGHT=96,STREAM_HEIGHT=40000,EXTENT=128,REVISION='micro-catchment-1';
  const MAT=Object.freeze({air:0,basalt:1,soil:2,grass:3,sand:4,bark:5,leaf:6,water:7,ore:8,flower:9,snow:16,needle:17,dry:18,crystal:19,moss:20,ice:21,stone:22,redwood:23,foam:24,sandstone:25,mossy:26,tundra:27,podzol:28,litter:29,gravel:30,mud:31,dirt:32,
    // Vegetation (appended; never renumber): leaves/needles, barks/culms, then small standing objects.
    birchBark:33,birchLeaf:34,larch:35,bushLeaf:36,bamboo:37,bambooLeaf:38,blossom:39,blossomWhite:40,coral:41,fern:42,tuft:43,mushroom:44,stem:45,glowFlower:46,reed:47,flowerYellow:48,flowerViolet:49,cactus:50,acacia:51,larchGold:52,birchMark:53,bambooNode:54,
    // Biome ground (appended after vegetation; never renumber): grass tones, meadow flowers, autumn leaves and litter, blossom,
    // rosegrass, fen moss, heather, steppe/savanna/golden grasses, badland clays, dunes, rainforest floor. Bamboo culms use 37.
    lushgrass:55,sungrass:56,buttercup:57,violet:58,autumngrass:59,autumnlitter:60,autumnleaf:61,rustleaf:62,petal:63,blossomleaf:64,
    pinkgrass:65,sphagnum:66,heather:67,steppegrass:68,savgrass:69,goldgrass:70,clay:71,ochre:72,dune:73,junglefloor:74,
    // ---- Riparian materials (appended; never renumber). Renderer family sets, to add at merge:
    //   LEAVES:       willowLeaf 75, vine 76, palmLeaf 77, alderLeaf 78
    //   BARKS:        palmBark 79
    //   ABOVE_GROUND: rush 80 (cattail stalk), cattail 81 (brown head), lilyPad 82 (flat pad replacing the top water
    //                 cell), lilyFlower 83 (bloom on a pad)
    //   BLADE_GRASS:  floodgrass 84 (lush floodplain / oasis grass)
    //   ground (no set): cobble 85 (rocky river beds and banks in fast reaches)
    willowLeaf:75,vine:76,palmLeaf:77,alderLeaf:78,palmBark:79,rush:80,cattail:81,lilyPad:82,lilyFlower:83,floodgrass:84,cobble:85,
    // ---- Mountain rock materials (appended; never renumber). Renderer family sets, to add at merge:
    //   ROCKS:        rockDark 86, rockPale 87 (strata tones of mountain rock), lichen 89 (grey-green lichen on rock)
    //   WARM_ROCKS:   rockWarm 88 (warm brown-grey stratum), lichenOrange 90 (rust lichen on rock)
    //   ABOVE_GROUND: boulder 91, boulderPale 92 (boulders, tors and loose stones)
    rockDark:86,rockPale:87,rockWarm:88,lichen:89,lichenOrange:90,boulder:91,boulderPale:92,
    // ---- Ruin materials (appended; never renumber). ABOVE_GROUND: masonry 93 (dressed stone of ruin walls and rubble).
    masonry:93});
  const COLORS=Object.freeze(['#000000','#717d91','#72614e','#85a96b','#c1b993','#665145','#426c57','#488f9b','#d6a85e','#e6baac','#dfac5c','#edcfad','#33434c','#a0c7c0','#ede7d4','#273b41','#eef2f2','#2e4c3c','#b5a067','#c9b2ff','#8a86c8','#bcdde6','#a9a596','#8b4a35','#f4fbfb','#c58a5c','#5f7d3c','#8e9c66','#5a4433','#8a6a42','#9a9184','#5e5040','#8c7356',
    '#e9e4d8','#a3c86a','#a9b552','#5c9a52','#b6c46a','#78b24c','#b88ae6','#f6eefa','#f28b6e','#4e8d45','#98b862','#d9473b','#f1e6cc','#71dcff','#a3a45c','#f4d04e','#a483e6','#5e9a5a','#8aa24c','#e0a93c','#45403c','#7d8f3e',
    '#6fa456','#9dbd63','#ecc94e','#b08ad6','#b0a84a','#cf8a3c','#e3a238','#cf6e34','#f1c3d6','#d9a4dd','#d8a3bc','#a4b84c','#9c7aa0','#adb86c','#bdb75a','#d6b254','#bf6a43','#dda067','#e2c27f','#4f7f3f',
    // Riparian (75-85): willow, vine, palm frond, alder, palm bark, rush, cattail head, lily pad, lily flower, floodgrass, cobble.
    '#9fc65a','#3d7a3c','#5fae4a','#4a8048','#a07d55','#6f9f45','#7b4a2b','#5b9e4c','#f7c4dc','#5fb35a','#8f938e',
    // Mountain rock (86-92): dark, pale and warm strata, grey-green and rust lichen, boulder, pale boulder.
    '#5f6a7c','#8a919d','#83776b','#8a9470','#a8845e','#8b8a88','#a4a29c','#aba595']);
  // Display names for streamed biome ids (atlas hexes, ground inspection). 'Desert' is matched by coop-session.js.
  const BIOME_NAMES=Object.freeze({sea:'Coastal shallows',beach:'Beach',snow:'Snowfield',alpine:'Alpine rock',tundra:'Tundra',boreal:'Boreal forest',forest:'Temperate forest',rainforest:'Rainforest',grassland:'Grassland',savanna:'Savanna',desert:'Desert',wetland:'Wetland',gorge:'Gorge',montane:'Montane conifer forest',subalpine:'Subalpine parkland',glacier:'Glacier',meadow:'Alpine meadow',redwood:'Redwood forest',steppe:'Steppe',
    flowers:'Wildflower meadow',autumn:'Autumn woodland',blossom:'Blossom grove',fen:'Mossy fen',heath:'Heather moor',golden:'Golden savanna',bamboo:'Bamboo grove',badlands:'Badlands',pinkgrass:'Rosegrass prairie'});
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  // Things that stand on the ground rather than shape it: trees, crystal spires (sunk 0.5 m into the ground), standing
  // stones, ruins and sandstone arches. They neither tilt the hillshade nor take it, and they cast sun shadows.
  // Renderer families: crown leaves (broadleaf and needle), trunks, and the grasses that grow stylized blades.
  const LEAVES=Object.freeze(new Set([MAT.willowLeaf,MAT.vine,MAT.palmLeaf,MAT.alderLeaf,MAT.leaf,MAT.birchLeaf,MAT.bushLeaf,MAT.bambooLeaf,MAT.blossom,MAT.blossomWhite,MAT.coral,MAT.acacia,MAT.autumnleaf,MAT.rustleaf,MAT.blossomleaf]));
  const NEEDLES=Object.freeze(new Set([MAT.needle,MAT.larch,MAT.larchGold]));
  const BARKS=Object.freeze(new Set([MAT.palmBark,MAT.bark,MAT.redwood,MAT.birchBark,MAT.birchMark,MAT.bamboo,MAT.bambooNode]));
  // Rock surfaces cel-shaded as anime rock; WARM_ROCKS keep warm sandstone-like bands.
  const WARM_ROCKS=Object.freeze(new Set([MAT.rockWarm,MAT.lichenOrange,MAT.sandstone,MAT.ochre,MAT.clay]));
  const ROCKS=Object.freeze(new Set([MAT.basalt,MAT.stone,MAT.gravel,MAT.cobble,MAT.rockDark,MAT.rockPale,MAT.lichen,MAT.boulder,MAT.boulderPale,...WARM_ROCKS]));
  // Flowers render as props (stem and petals), not voxels, in close views.
  const FLOWERS=Object.freeze(new Set([MAT.flower,MAT.flowerYellow,MAT.flowerViolet,MAT.glowFlower]));
  // Thin plants drawn as objects at every zoom: bamboo culms, reeds, rushes with cattail heads, ferns, tufts and hanging
  // vine strands.
  const STALKS=Object.freeze(new Set([MAT.bamboo,MAT.bambooNode,MAT.reed,MAT.rush,MAT.cattail,MAT.fern,MAT.tuft,MAT.vine]));
  const BLADE_GRASS=Object.freeze(new Set([MAT.floodgrass,MAT.grass,MAT.lushgrass,MAT.sungrass,MAT.buttercup,MAT.violet,MAT.autumngrass,MAT.pinkgrass,MAT.steppegrass,MAT.savgrass,MAT.goldgrass]));
  const ABOVE_GROUND=Object.freeze(new Set([...LEAVES,...NEEDLES,...BARKS,MAT.flower,MAT.crystal,MAT.stone,MAT.masonry,MAT.sandstone,MAT.fern,MAT.tuft,MAT.mushroom,MAT.stem,MAT.glowFlower,MAT.reed,MAT.flowerYellow,MAT.flowerViolet,MAT.cactus,MAT.rush,MAT.cattail,MAT.lilyPad,MAT.lilyFlower,MAT.boulder,MAT.boulderPale]));
  // What a walking body can't pass through: trunks and limbs, giant mushroom stems, boulders, rock
  // crags and sea stacks, crystals and ruin masonry. Every terrain rock lives below the capsule's low
  // bound, so the whole ROCKS family is safe to include. Foliage, water and thin plants stay passable.
  const BODY_SOLID=Object.freeze(new Set([...BARKS,...ROCKS,MAT.stem,MAT.mossy,MAT.masonry,MAT.crystal,MAT.cactus]));
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
  // The macro map module: a global in the page and worker (loaded before this file), required in Node.
  const MacroLib=root.MacroMap||(typeof require==='function'?require('./macro-map.js'):null);
  // options.map: a macro-map template override (e.g. 'archipelago'); otherwise the seed picks one.
  function createWorld(seed=2718,cellMetres=CELL,extent=EXTENT,options={}){
    if(![CELL,CELL/2].includes(cellMetres))throw new Error('Cell size must be 0.25 or 0.125 metres');
    if(![EXTENT,EXTENT*2,'infinite'].includes(extent))throw new Error('World extent must be 128, 256 or infinite');
    const infinite=extent==='infinite',revision=infinite?'micro-wilds-27':REVISION;
    const density=CELL/cellMetres,chunkCells=CHUNK*density,heightCells=(infinite?STREAM_HEIGHT:HEIGHT)*density;
    seed=Number(seed)>>>0;const mapTemplate=infinite&&options&&MacroLib&&MacroLib.TEMPLATES[options.map]?options.map:null;
    // gallery: a flat specimen field instead of terrain — exhibits for eyeballing props outside worldgen (see below).
    const gallery=infinite&&options&&!!options.gallery;
    const massifAngle=hash(seed,7,seed+241)*Math.PI*2,massifX=Math.cos(massifAngle)*70,massifZ=Math.sin(massifAngle)*70;
    const gorgeX=-Math.cos(massifAngle)*58,gorgeZ=-Math.sin(massifAngle)*58,gorgeDX=-Math.sin(massifAngle),gorgeDZ=Math.cos(massifAngle);
    const id=`${infinite?'wilds':'catchment'}:${revision}:${seed}${mapTemplate?':'+mapTemplate:''}${gallery?':gallery':''}`,trees=new Map();
    // Streamed geography is a pure function of (seed, x, z): macro map → relief → climate → biome. Nothing is stored
    // per column; the macro map (MacroMap, one finite Azgaar-style continent map per seed) is built once and cached.
    const SEA=14,MM=infinite?MacroLib.get(seed,mapTemplate):null;
    // Cooling with height (C): ~6.5 C per 100 m above the lowland (see MacroMap.cooling), shared with the macro map.
    const cool=MacroLib?MacroLib.cooling:m=>.17*Math.max(0,m-SEA);
    const ridged=(x,z,k)=>1-Math.abs(noise(x,z,k)-.5)*2;
    // Macro relief (the old plate relief's role): ground level from the macro map (template continents plus its range
    // layer, see macro-map.js), `relief` (the mountain share: the range core plus template ground above the ~28 m
    // lowland, which drives crag detail, erosion, zonation and the treeline) and a `setting` for the atlas and volcanoes:
    // coastal ranges near the sea are 'subduction', inland ranges 'collision', high islets 'arc', and a slow fault field
    // cuts 'rift' seams (narrow gorges) through low hills. Rolling hills and uplands ride on top (hillsAt; not relief).
    // Near the home start relief and hills are softened and the ground kept at least 8 m above the sea.
    const mac={},hill={h:0,mesa:0,wall:0};
    function plateRelief(x,z){
      MM.at(x,z,mac);const r=Math.hypot(x,z),open=clamp((180-r)/90,0,1);
      let relief=Math.max(0,mac.m-mac.ra-SEA-14);const flat=mac.m-relief;
      hillsAt(x,z,r,relief);
      let h=mac.m+hill.h;
      if(open){relief*=1-open*.85;h=flat+hill.h+relief;h+=open*Math.max(0,SEA+8-h);}
      let setting='craton',f=0;
      if(h<SEA)setting=h>SEA-6?'shelf':'ocean';
      else if(relief>40)setting=mac.distToCoast<2400?'subduction':'collision';
      else if(relief>12&&mac.distToCoast<700)setting='arc';
      else if(relief<25){const n=noise(x*.0006,z*.0006,seed+931);if(n>.74){setting='rift';f=clamp((n-.74)/.08,0,1);}}
      return {h,base:h-relief,relief,setting,f,cone:0,coast:mac.distToCoast,precip:mac.precip,lake:mac.lake,lakeD:mac.lakeD,valley:mac.valley,mesa:hill.mesa,wall:hill.wall};
    }
    // Rolling hills and uplands everywhere on land, at ~150 m to 1.5 km wavelengths, in regional styles: plains (+-1-3 m),
    // rolling country (5-20 m) and hill country (20-60 m), chosen by a ~5 km field. Uplands rise toward the ranges (the
    // range apron lifts the ground; hills grow with it), low ridges run through rolling and hill country, knolls stand
    // alone, and in dry country flat-topped mesas and buttes with cliff walls (hill.wall: 0-1 on the wall; hill.mesa: the
    // cap). Hills fade out on macro floodplains (valley), at the coast, at lakes, in high mountains and in the home
    // lowland; around home (250 m-3 km) they are at least rolling, so the opening view has hills.
    function hillsAt(x,z,r,relief){
      hill.h=0;hill.mesa=0;hill.wall=0;if(!mac.land&&mac.distToCoast<0)return hill;
      // The home lowland is eased to the hills' mean level rather than their valley floor, so the camp sits on a gentle
      // rise that drains outward instead of in a bowl.
      const fade=clamp((mac.distToCoast-120)/500,0,1)*clamp(mac.valley*1.25-.1,0,1)*(1-clamp((mac.lakeD-.03)*4,0,1))*(1-.6*clamp(relief/120,0,1)),hf=clamp((r-200)/350,0,1);
      if(fade<=0)return hill;
      const S=noise(x*.00019+3.1,z*.00019,seed+951)*.68+noise(x*.0007,z*.0007,seed+953)*.32;
      let amp=S<.4?1.5+2.5*S/.4:S<.55?4+16*smooth01((S-.4)/.15):20+40*smooth01((S-.55)/.25);
      amp=Math.max(amp,(6+40*clamp(mac.ra/30,0,1))*clamp(mac.ra/6,0,1),26*clamp((r-250)/500,0,1)*clamp((3000-r)/800,0,1));
      const wx=x+(noise(x*.0011,z*.0011,seed+955)-.5)*500,wz=z+(noise(x*.0011,z*.0011,seed+957)-.5)*500;
      const f=noise(wx/1500,wz/1500,seed+959)*.45+noise(wx/650,wz/650,seed+961)*.3+noise(wx/300,wz/300,seed+963)*.17+noise(wx/150,wz/150,seed+965)*.08;
      const q=clamp((f-.3)/.42,0,1);let v=amp*q**1.3;
      // Low ridges: a ridged ~900 m field on rotated axes, in rolling and hill country.
      const rg=1-Math.abs(noise((wx*.8+wz*.6)/900,(wz*.8-wx*.6)/900,seed+967)*2-1);v+=amp*.35*rg**5*clamp((amp-4)/10,0,1);
      // Knolls: one candidate per 420 m cell, 50-140 m across.
      // Only this cell and the three neighbours on its nearer sides can reach the point (centres sit 84 m inside a cell).
      {const K=420,gx=x/K,gz=z/K,i=Math.floor(gx),j=Math.floor(gz),si=gx-i<.5?-1:1,sj=gz-j<.5?-1:1;for(let q=0;q<4;q++){const a=i+(q&1?si:0),b=j+(q&2?sj:0);if(hash(a,b,seed+969)>.35)continue;
        const cx=(a+.2+.6*hash(a,b,seed+971))*K,cz=(b+.2+.6*hash(a,b,seed+973))*K,R=50+90*hash(a,b,seed+975),d=Math.hypot(x-cx,z-cz)/R;if(d<1){const c=Math.cos(d*Math.PI/2);v+=(4+12*hash(a,b,seed+977))*c*c*clamp(amp/8,.5,1.5);}}}
      hill.h=(v*hf+amp*.3*(1-hf))*fade;
      // Mesas and buttes in dry country: one candidate per 520 m cell; a flat cap with a cliff wall 4-9 m wide over a talus apron.
      const dry=clamp((.42-mac.precip)/.14,0,1)*clamp((r-900)/600,0,1)*fade;
      if(dry>0){const K=520,i=Math.floor(x/K),j=Math.floor(z/K);
        for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const a=i+di,b=j+dj;if(hash(a,b,seed+979)>.5*dry)continue;
          const cx=(a+.25+.5*hash(a,b,seed+981))*K,cz=(b+.25+.5*hash(a,b,seed+983))*K,butte=hash(a,b,seed+985)<.35,R=butte?35+45*hash(a,b,seed+987):70+170*hash(a,b,seed+987);
          const Hm=(butte?18:12)+26*hash(a,b,seed+989),ww=4+5*hash(a,b,seed+991),d=Math.hypot(x-cx,z-cz)+(noise(x/(R*.5),z/(R*.5),seed+993)-.5)*R*.45+(noise(x*.09,z*.09,seed+995)-.5)*3;
          if(d>R+ww+R*.6)continue;let m;
          if(d<=R){m=Hm*(1-.04*d/R);hill.mesa=Math.max(hill.mesa,1);}
          else if(d<R+ww){const t=(d-R)/ww;m=Hm*(1-.65*t*t*(3-2*t));hill.wall=Math.max(hill.wall,1-Math.abs(t-.5)*2*.6);}
          else{const t=(d-R-ww)/(R*.6);m=Hm*.35*(1-t)**1.5;}
          hill.h=Math.max(hill.h,m*dry+(v*hf+amp*.3*(1-hf))*fade*(1-dry*.5));}}
      return hill;
    }
    const smooth01=v=>v*v*(3-2*v);
    // Tiers of the home massif rise from just above the home ground (8 m above the sea in the plate world).
    const homeLevel=infinite?plateRelief(0,0).h:SEA+6;
    // Stratovolcanoes come from the macro map's range layer: on the seaward flanks of coastal ranges and now and then alone
    // on a big landmass, each a smooth cone (base radius 3x its height, flanks steepening from gentle at the foot to ~34 degrees near the crater, like Rainier or Fuji) with a summit crater. They are
    // part of plate relief, so rivers route around them and they cast rain shadows; tall cones are capped softly below the
    // column ceiling. One volcano per 700 m lookup cell at most (their bases are narrower than a cell).
    // Volcano lookup: each cone is registered in every VG cell its radius touches (R can be ~5 km now, far more than one
    // cell), so a point anywhere on the flank finds its volcano with a single map hit instead of a fixed ±1-cell scan.
    const VG=700,volcanoCells=new Map();
    if(infinite)for(const v of MM.volcanoes||[]){const V={x:v.x,z:v.z,H:v.H,R:v.H*3};
      const i0=Math.floor((v.x-V.R)/VG),i1=Math.floor((v.x+V.R)/VG),j0=Math.floor((v.z-V.R)/VG),j1=Math.floor((v.z+V.R)/VG);
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=i*65536+j;let a=volcanoCells.get(k);if(!a)volcanoCells.set(k,a=[]);a.push(V);}}
    function tectonics(x,z){
      const t=plateRelief(x,z),list=volcanoCells.get(Math.floor(x/VG)*65536+Math.floor(z/VG));let cone=0,vx=0,vz=0,vr=0;
      if(list)for(const V of list){
        const d=Math.hypot(x-V.x,z-V.z);if(d>=V.R)continue;
        // Concave flanks steepening to a summit crater: a bowl inside a sharp rim with a slight raised lip.
        const crater=V.R*.075,q=d/crater;let c=q<1?V.H*((1-crater/V.R)**2-.08*(1-q*q)):V.H*(1-d/V.R)**2;c+=V.H*.02*Math.exp(-(((q-1)/.35)**2));
        if(c>cone){cone=c;vx=V.x;vz=V.z;vr=V.R;}
      }
      if(!cone)return t;
      let h=t.h+cone;if(h>3200)h=3200+(h-3200)*.3;
      return {...t,h,cone:h-t.h,vx,vz,vr};
    }
    // Climate on a 32 m grid: latitude temperature, banded prevailing winds, moisture carried from sea and rained out on rising ground.
    // Latitude runs north-south across the macro map (400 m per degree, folding at the poles far out at sea), the same
    // field the macro map's climate used, so the ~20 km map spans warm south to cool north. Home sits at 24-40 degrees.
    // Moisture blends the local upwind rain-out with the macro map's precipitation, so continental rain shadows and wet
    // windward coasts agree with the map; arid basins are where the macro map is dry.
    const twist=(hash(seed,19,seed+335)-.5)*.8,latC=infinite?MM.latC:30,latOff=infinite?MM.oy-MacroLib.HEIGHT/2:0;
    const climateCells=new Map(),CG=32;
    function latitude(x,z){const a=((latC-(z+latOff)/400+90)%360+360)%360;return a<180?a-90:270-a;}
    // Easterly trades under 30 degrees and over 60, westerlies between (as the macro map's wind passes).
    function wind(lat){const L=Math.abs(lat),dir=L<30||L>60?-1:1,t=twist;return {x:dir*Math.cos(t),z:dir*Math.sin(t)};}
    // Slow region fields ride along in the cached cell: V and U pick among biomes that share a climate (kilometre-scale, gently
    // domain-warped, so regions are large blobs), A marks the arid basins (deserts, badlands) and dries their moisture.
    function climateCell(i,j){
      const k=i*16777216+j;let v=climateCells.get(k);if(v)return v;
      const x=i*CG,z=j*CG,lat=latitude(x,z),w=wind(lat);let m=.6,prev=null,lift=0;
      for(let s=10;s>=0;s--){const e=tectonics(x-w.x*48*s,z-w.z*48*s).h;if(e<SEA)m=1;else{if(prev!==null){const rise=Math.max(0,e-Math.max(prev,SEA));const rain=Math.min(m*.3,rise*.007);m-=rain;if(s<=1)lift+=rise;}m=m*.995+.004;}prev=e;}
      const T0=tectonics(x,z),here=T0.h,P=T0.precip,T=29-.4*Math.abs(lat)+(noise(x*.0011,z*.0011,seed+343)-.5)*7+(noise(x*.003,z*.003,seed+337)-.5)*3-cool(here);
      const wx=x+(noise(x*.0015,z*.0015,seed+345)-.5)*700,wz=z+(noise(x*.0015,z*.0015,seed+347)-.5)*700;
      const V=noise(wx*.0011,wz*.0011,seed+349)*.7+noise(wx*.004,wz*.004,seed+351)*.3,U=noise(wz*.0009,wx*.0009,seed+353)*.7+noise(wx*.0035,wz*.0035,seed+355)*.3;
      const A=clamp((.36-P+(noise(wx*.0012,wz*.0012,seed+359)-.5)*.12)/.12,0,1)*clamp((Math.hypot(x,z)-900)/1200,0,1);
      const local=m*.8+lift*.008+(noise(wx*.0008,wz*.0008,seed+361)-.5)*.35+(noise(x*.005,z*.005,seed+339)-.5)*.08;
      const M=clamp((local*.55+P*.42)*(1-.6*A),0,1);
      v={T,M,V,U,A};climateCells.set(k,v);if(climateCells.size>8192)climateCells.delete(climateCells.keys().next().value);return v;
    }
    // The last cell quad is kept: neighbouring columns and the biome-edge samples (see geography) mostly share it, which
    // skips four Map lookups.
    const quad={i:NaN,j:NaN,a:null,b:null,c:null,d:null};
    function climate(x,z){
      const gx=x/CG,gz=z/CG,i=Math.floor(gx),j=Math.floor(gz),u=gx-i,w=gz-j;
      if(i!==quad.i||j!==quad.j){quad.i=i;quad.j=j;quad.a=climateCell(i,j);quad.b=climateCell(i+1,j);quad.c=climateCell(i,j+1);quad.d=climateCell(i+1,j+1);}
      const {a,b,c,d}=quad,mix=k=>(a[k]+(b[k]-a[k])*u)*(1-w)+(c[k]+(d[k]-c[k])*u)*w;
      return {T:mix('T'),M:mix('M'),V:mix('V'),U:mix('U'),A:mix('A')};
    }
    // climate() plus its gradient per metre (d.T, d.M, ... as [x, z]), from a quad cache of its own. Fields are bilinear
    // within a 32 m cell, so value + gradient·offset is near exact a few tens of metres away: the biome-edge samples use
    // that instead of four more climate() calls.
    // Fills the returned scratch object: T, M, V, U, A and their gradients Tx, Tz, Mx, ... (valid until the next call).
    const quadD={i:NaN,j:NaN,a:null,b:null,c:null,d:null},climD={};
    function climateD(x,z){
      const gx=x/CG,gz=z/CG,i=Math.floor(gx),j=Math.floor(gz),u=gx-i,w=gz-j,Q=quadD,o=climD;
      if(i!==Q.i||j!==Q.j){Q.i=i;Q.j=j;Q.a=climateCell(i,j);Q.b=climateCell(i+1,j);Q.c=climateCell(i,j+1);Q.d=climateCell(i+1,j+1);}
      const {a,b,c,d}=Q,f=(k,kx,kz)=>{const A=a[k],B=b[k],C=c[k],D=d[k];o[k]=(A+(B-A)*u)*(1-w)+(C+(D-C)*u)*w;o[kx]=((B-A)*(1-w)+(D-C)*w)/CG;o[kz]=((C-A)*(1-u)+(D-B)*u)/CG;};
      f('T','Tx','Tz');f('M','Mx','Mz');f('V','Vx','Vz');f('U','Ux','Uz');f('A','Ax','Az');return o;
    }
    // Mountains zone by temperature: montane conifer forest, subalpine parkland, green alpine meadow, then rock and snow.
    // Snow holds only on ground gentler than a limit that rises as it gets colder (steeper cold ground is bare rock), and
    // it lies lower in gullies than on spurs, so the snowline runs down creases in tongues instead of following a contour.
    // zone.slope / zone.crease / zone.hollow / zone.spur: the mountain slope, erosion crease, depth below the broad landform
    // (m, + in hollows) and erosion spur of the current column, set by geography(). zone.x / zone.z: the column.
    // R: lowland region values for the column (see region()): V/U pick among same-climate biomes, A is aridity (desert and
    // badlands only inside the few large arid basins), j* are small per-column jitters so lowland borders are ragged, not contours.
    const zone={slope:0,crease:0,hollow:0,spur:0,x:0,z:0};
    function biomeOf(T,M,h,wet,steep,cliff,mountain,sheer=cliff,R=null){
      if(h<SEA)return 'sea';
      if(mountain&&h>=SEA+1.2){
        // Snow gathers where wind and avalanches drop it: in hollows, gullies, cirques and cols (a little lower there).
        // Peaks, ridge crests, arêtes and spurs that stand out of the broad landform blow bare; only gentle ledges on them
        // keep thin patches. Below the snowline nothing changes.
        const hollow=zone.hollow,snowT=T-2.2*zone.crease,deep=.12*clamp(hollow,0,6);
        const gentle=zone.slope<.7+.12*clamp(-3-snowT+deep,0,5)+.15*clamp(hollow/4,0,1)+.55*zone.crease;
        if(snowT>=-3&&snowT-deep<-3&&gentle)return 'snow';
        if(snowT<-3){
          const j=noise(zone.x*.11,zone.z*.11,seed+801)-.5,crest=clamp((-hollow-1.2+j*3)/3,0,1)+clamp((zone.spur-.35+j*.5)/.4,0,1);
          if(crest<.5)return gentle?'snow':'alpine';
          return zone.slope<.32&&snowT<-5&&noise(zone.x*.3,zone.z*.3,seed+803)>.62?'snow':'alpine';
        }
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
      // Cool: boreal forest where wet enough, otherwise heather moor; bare tundra only near freezing. Forests yield to open
      // country more readily than before: moors, meadows and grasslands claim a wider moisture band.
      if(T<7)return M>.48?'boreal':T<3.5?'tundra':'heath';
      if(T<19){
        if(M>.82&&T<13&&!steep&&U>.58)return 'fen';
        if(M>.68&&T>=9&&T<16&&V>.58&&!wet)return 'redwood';
        if(M>.56)return T<12.5&&V<.4?'autumn':T>=11.5&&U>.6?'blossom':'forest';
        if(M>.24)return T<10.5&&V<.3?'heath':U<.45?'flowers':T>=12&&V>.64?'pinkgrass':'grassland';
        return A>.55&&M<.24&&T>=13?'desert':'steppe';
      }
      // Warm: rainforest, bamboo on its wetter hills and fringes, savanna (golden in its own regions), deserts and badlands in arid basins.
      if(M>.76)return U>.62||h>SEA+14&&U>.45?'bamboo':'rainforest';
      if(M>.6&&(h>SEA+10||U>.55))return 'bamboo';
      if(A>.55&&M<.32)return V>.58||h>SEA+18?'badlands':'desert';
      return V>.5?'golden':'savanna';
    }
    // Lowland region values for biomeOf: the cached region fields plus per-column jitter (about 20 m and 6 m wobble).
    // W: the climate at the column's warped position (see biomeWarp); its difference from C rides in jt/jm, which only the
    // lowland branch of biomeOf applies, so lowland borders meander while mountain zonation keeps the column's own climate.
    function region(C,x,z,W=C){
      const f=(noise(x*.21,z*.21,seed+365)-.5)*.6,j=noise(x*.05,z*.05,seed+363)-.5+f,k=noise(x*.045,z*.045,seed+367)-.5-f;
      return {V:W.V+j*.14,U:W.U+k*.14,A:W.A,jt:j*1.8+W.T-C.T,jm:k*.08+W.M-C.M};
    }
    // Lowland biome decisions read the climate fields at a domain-warped position (~240 m and ~90 m wavelengths, typically
    // 30-60 m and up to ~110 m displacement; region()'s 20 m jitter rides on top), so borders that are isolines of the smooth climate meander
    // instead of running as long straight lines. warp.a and warp.D: a slowly turning angle and a 10-24 m reach that
    // the edge samples reuse.
    const warp={x:0,z:0,a:0,D:0};
    function biomeWarp(x,z){
      // Octaves on rotated axes, so neither lines up with the climate grid (whose cell rows are what read as straight).
      const p=(x*.8+z*.6)*.011,q=(z*.8-x*.6)*.011,a=noise(x*.0042,z*.0042,seed+801)-.5,b=noise(x*.0042+17,z*.0042,seed+803)-.5,c=noise(p,q,seed+805)-.5,d=noise(q+29,p,seed+807)-.5;
      warp.x=x+a*170+c*130;warp.z=z+b*170+d*130;warp.a=(a-b)*9;warp.D=17+20*a;return warp;
    }
    // Biomes from biomeOf's lowland branch: the only ones that blend at their edges (see geography). Sea, shore, gorge,
    // glacier and the mountain zonation (montane, subalpine, meadow, alpine, snow) keep their own edges.
    const LOWLAND=new Set(['forest','grassland','flowers','autumn','blossom','fen','wetland','heath','steppe','savanna','golden','desert','badlands','boreal','tundra','redwood','rainforest','bamboo','pinkgrass']);
    // Dithered pick between a column's biome and its edge partner: biome2 wins where blend beats a threshold made of
    // ~20 m clumps plus per-cell speckle (f: a 0-1 hash of the caller's cell). On the border (blend 0.5) the two mix
    // about evenly in fine speckle; further in only the clump lows pass, so the other biome thins to scattered patches.
    // White hash and >=20 m noise cannot alias into stripes when LOD nodes sample one column per 2^L cells.
    function pickBiome(g,x,z,f){
      if(!(g.blend>0))return g.biome;
      return g.blend>.5+(noise(x*.05,z*.05,seed+813)-.5)*.9+(f-.5)*.55?g.biome2:g.biome;
    }
    const TREES={steppe:.03,redwood:.95,rainforest:.92,forest:.82,montane:.86,boreal:.78,subalpine:.3,meadow:.02,wetland:.3,savanna:.08,grassland:.04,tundra:.03,
      flowers:.02,autumn:.8,blossom:.5,fen:.1,heath:.03,golden:.05,bamboo:.9,badlands:.01,pinkgrass:.03,desert:0,beach:0};
    // Vegetated ground: everything tree floors, scree, worn patches and landmarks may paint over. GRASSY: where voxel flowers grow.
    const TURF=new Set([MAT.grass,MAT.tundra,MAT.dry,MAT.dirt,MAT.mossy,MAT.lushgrass,MAT.sungrass,MAT.buttercup,MAT.violet,MAT.autumngrass,MAT.pinkgrass,MAT.sphagnum,MAT.heather,MAT.steppegrass,MAT.savgrass,MAT.goldgrass,MAT.junglefloor,MAT.floodgrass]);
    const GRASSY=new Set([MAT.grass,MAT.lushgrass,MAT.sungrass,MAT.pinkgrass,MAT.floodgrass]);
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
        // Blossom groves: rose grass with violet drifts under the pink and white crowns.
        case 'blossom':return n2>.55&&s<.5?MAT.violet:n<.4?MAT.violet:MAT.pinkgrass;
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
    // Wired: mountain creases from the eroded-terrain filter, with the stand-in field keeping lowland valleys winding.
    let creaseAt=(x,z)=>Math.max(ownCrease(x,z),erosionAt(x,z).crease);const CREASE_DEPTH=3.5;
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
      const fed=new Uint8Array(n),src=new Map(),sink=new Uint8Array(n),sinkAt=new Map();
      for(let j=0;j<W;j++)for(let i=0;i<W;i++){
        const k=j*W+i,gi=i0+i,gj=j0+j;px[k]=(gi+.2+.6*hash(gi,gj,seed+D.salt))*G;pz[k]=(gj+.2+.6*hash(gi,gj,seed+D.salt+2))*G;
        const t=tectonics(px[k],pz[k]);cragAt(px[k],pz[k],t.relief,t.cone);
        const g=t.h+upliftAt(px[k],pz[k]).up+cragLow;h[k]=g<SEA?g:g-(creaseAt||ownCrease)(px[k],pz[k])*CREASE_DEPTH*clamp((g-SEA-.5)/12,0,1);rel[k]=Math.max(t.relief,t.cone);
        // The home start sits on a low drainage dome (in the routed surface only), so creeks rise around camp and flow
        // away from it instead of crossing the opening's gorge and massif.
        {const r=Math.hypot(px[k],pz[k]);if(r<240&&h[k]>=SEA)h[k]+=7*(1-r/240)**2;}
        // Macro rivers and lakes are outlets for the local network: nodes on a macro channel or under a macro lake drain
        // at its level, so creeks and streams end in them (never crossing a lake) and never redraw the big rivers.
        if(h[k]>=SEA){
          if(t.lake>=0&&t.lakeD>.4){sink[k]=1;h[k]=Math.min(h[k],lakeLevel(t.lake));}
          else if(MM.riverNear(px[k],pz[k],mr)&&mr.dist<mr.hw+G*.45){const lv=macroLevels(mr.river);sink[k]=2;h[k]=Math.min(h[k],lv[mr.seg]+(lv[mr.seg+1]-lv[mr.seg])*mr.t);sinkAt.set(k,[mr.x,mr.z]);}
        }
      }
      const hk=new Float64Array(n),hv=new Int32Array(n);let hn=0,on=0;
      const push=(e,k)=>{let c=hn++;while(c>0){const q=(c-1)>>1;if(hk[q]<=e)break;hk[c]=hk[q];hv[c]=hv[q];c=q;}hk[c]=e;hv[c]=k;};
      const pop=()=>{const k=hv[0],e=hk[--hn],v=hv[hn];let c=0;for(;;){let l=2*c+1;if(l>=hn)break;if(l+1<hn&&hk[l+1]<hk[l])l++;if(hk[l]>=e)break;hk[c]=hk[l];hv[c]=hv[l];c=l;}hk[c]=e;hv[c]=v;return k;};
      for(let k=0;k<n;k++){const i=k%W,j=(k/W)|0;if(i===0||j===0||i===W-1||j===W-1||h[k]<SEA||sink[k]){done[k]=1;fill[k]=h[k];push(h[k],k);}}
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
        if(d<0||h[d]<SEA||sink[d]){mouth[c]=acc[c];steps[c]=0;}else{mouth[c]=mouth[d];steps[c]=steps[d]+1;}
        if(d>=0&&fill[c]-h[c]>.5){const s=spill[d]>=0?spill[d]:d;spill[c]=s;deep[s]=Math.max(deep[s],fill[c]-h[c]);area[s]++;}
      }
      // Lakes come from the macro map, so every local basin is breached: its nodes keep their own height and the levels
      // downstream are lowered until they fall again.
      const lake=new Uint8Array(n),lvl=new Float32Array(n),keep=new Map();
      for(let k=0;k<n;k++){
        const s=spill[k];if(s<0){lvl[k]=fill[k];continue;}
        let ok=keep.get(s);if(ok===undefined){ok=false;keep.set(s,ok);}
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
      // A creek or stream ending in a macro river runs on to that river's centreline, so it always reaches the water.
      const qx=new Float32Array(px),qz=new Float32Array(pz);for(const [k,q] of sinkAt){qx[k]=q[0];qz[k]=q[1];}
      for(let k=0;k<n;k++){
        const d=down[k];if(d<0||h[k]<SEA||lake[k]||sink[k])continue;const C=channelClass(acc[k],rel[k],fed[k],mouth[k]);if(!C)continue;
        const ex=px[d]-px[k],ez=pz[d]-pz[k],L=Math.hypot(ex,ez)||1,grade=Math.max(0,lvl[k]-lvl[d])/L;
        const flat=(.3+.7*clamp(1-grade/.06,0,1))*clamp(1-rel[k]/30,0,1),side=((C.s>=.6?steps[k]>>1:steps[k])&1?1:-1)*(.65+.35*hash(k%W+i0,((k/W)|0)+j0,seed+349));
        const a=flat*(6+3.2*C.hw)*side;qx[k]=px[k]-ez/L*a;qz[k]=pz[k]+ex/L*a;
      }
      // Per-node channel class (half-width, reach, head area; head 0 = no channel; spring = a creek head), and falls: a
      // reach dropping at least 7 m at over 18% onto a reach less than half as steep is a real step, so its water falls.
      const hw=new Float32Array(n),cs=new Float32Array(n),head=new Float32Array(n),knick=new Uint8Array(n),spring=new Uint8Array(n);
      for(let k=0;k<n;k++){const C=sink[k]?null:channelClass(acc[k],rel[k],fed[k],mouth[k]);if(C){hw[k]=C.hw;cs[k]=C.s;head[k]=C.head;spring[k]=C.head<Infinity&&acc[k]<C.head*2&&!lake[k]?1:0;}}
      const grade=k=>{const d=down[k];return d<0?0:(lvl[k]-lvl[d])/(Math.hypot(px[d]-px[k],pz[d]-pz[k])||1);};
      for(let k=0;k<n;k++){const d=down[k];if(!head[k]||d<0||h[k]<SEA||lake[k]||lvl[d]<SEA+1)continue;const g=grade(k);if(g>.18&&lvl[k]-lvl[d]>=7&&grade(d)<g*.5)knick[k]=1;}
      T={i0,j0,W,px,pz,qx,qz,h,lvl,lake,feed,down,acc,rel,fed,mouth,hw,cs,head,spring,knick,src,sink};D.tiles.set(key,T);if(D.tiles.size>D.cap)D.tiles.delete(D.tiles.keys().next().value);return T;
    }
    // Local channel mouths (for checks): every drawn channel node in [x0,x1]x[z0,z1] whose downstream node is an outlet (a
    // macro river, a macro lake or the sea). x, z: where its course ends; kind: 'river', 'lake' or 'sea'.
    function streamMouths(x0,z0,x1,z1){
      const D=DRAIN[0],G=D.G,out=[];
      for(let tj=Math.floor(z0/G/D.T);tj<=Math.floor(z1/G/D.T);tj++)for(let ti=Math.floor(x0/G/D.T);ti<=Math.floor(x1/G/D.T);ti++){
        const T=drainTile(0,ti,tj);
        for(let j=D.M;j<D.M+D.T;j++)for(let i=D.M;i<D.M+D.T;i++){const a=j*T.W+i,b=T.down[a];
          if(!T.head[a]||b<0||T.h[a]<SEA||T.sink[a]||T.lake[a]||!(T.sink[b]||T.h[b]<SEA))continue;const x=T.qx[b],z=T.qz[b];if(x<x0||x>x1||z<z0||z>z1)continue;
          out.push({x,z,kind:T.sink[b]===2?'river':T.sink[b]===1?'lake':'sea'});}
      }
      return out;
    }
    // Channel classes by upstream area. hw: half-width (m); s: how far its influence reaches (banks, sand, tree-free strip)
    // relative to a main river; head: area where the channel starts.
    // Channels whose system reaches its mouth with under 20 nodes of catchment aren't drawn (unless fed by an isle fall).
    function channelClass(acc,rel,fed,mouth){
      if(mouth<20&&!fed)return null;
      // The macro map carries the main rivers: the local network's largest class is a stream.
      if(acc>=20)return {hw:Math.min(3.5,.9+.2*Math.sqrt(acc)),s:.6,head:20};
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
        if(!T.head[a]||T.h[a]<SEA||b<0||T.sink[a])continue;
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
          if(e<r.e){const L=Math.hypot(ex,ez)||1,S=Math.max(.0005,(f0-f1)/L),d=clamp(.25+hw*.3,.25,1.2);Object.assign(r,{e,dist,hw,s,level,foam,x:qx,z:qz,spring,dx:ex/L,dz:ez/L,macro:false,
            speed:clamp(d**(2/3)*Math.sqrt(S)/.045,.1,3)*(foam?1.5:1),depth:d,zone:spring?'source':S>.03||T.rel[a]>15?'upper':'middle',curve:0,slope:S});}
        };
        if(F)piece(F.x,F.z,fa,ax,az,fa,0,0);
        else if(T.spring[a]){
          // A creek head is a spring: a small pool where groundwater rises.
          if(As<.5){const sd=Math.hypot(wx-ax,wz-az),e=(sd-1.6)/As+2.3;if(e<r.e){const L=Math.hypot(bx-ax,bz-az)||1;Object.assign(r,{e,dist:sd,hw:1.6,s:As,level:fa,foam:false,x:ax,z:az,spring:true,dx:(bx-ax)/L,dz:(bz-az)/L,macro:false,speed:.1,depth:.4,zone:'source',curve:0,slope:0});}}
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
    // Macro rivers: the macro map's flux rivers are the main channels. Each river's water level is a profile along its
    // course (built on first use): the broad landform under each course point (macro height plus the smooth crag octaves),
    // as a running minimum from the source so the water only ever runs down, held at least at the level of the lake or
    // parent river it ends in and at most at the level of the lake it leaves.
    const riverLevels=new Map(),lakeLevels=new Map(),mr={},RIVER_ZONES=['source','upper','middle','lower','estuary'];
    // Mouth landform of each river (main channel and distributaries) and the rivers that leave lakes.
    const deltaOf=new Map(),outlets=new Set();
    if(infinite){for(const D of MM.deltas||[])for(const id of D.channels)deltaOf.set(id,D);for(const L of MM.lakes)if(L.outletRiver>=0)outlets.add(L.outletRiver);}
    function lakeLevel(id){let v=lakeLevels.get(id);if(v===undefined){v=Math.max(SEA+1,MM.lakes[id].metres-.4);lakeLevels.set(id,v);}return v;}
    function macroLevels(ri){
      let lv=riverLevels.get(ri);if(lv)return lv;
      const r=MM.rivers[ri],m=r.x.length,D=deltaOf.get(ri);lv=new Float32Array(m);let run=Infinity;
      // A distributary leaves its river at the delta apex, at the river's level there.
      if(r.distributary){const P=macroLevels(r.distributary.river);run=levelAt(r.distributary.river,P,r.distributary.along)+.3;}
      for(let i=0;i<m;i++){const t=tectonics(r.x[i],r.z[i]),c=cragAt(r.x[i],r.z[i],t.relief,t.cone);run=Math.min(run,t.h+Math.min(c,cragLow));lv[i]=run-.3;}
      // Rivers reaching the sea ease down to sea level at the shore (the second-to-last vertex; the last lies 30 m out in
      // open water): straight across a delta from its apex, over an estuary's funnel, else over the last 300 m.
      if(r.end==='ocean'){const shore=r.along[Math.max(0,m-2)],from=D?D.kind==='delta'&&!r.distributary?shore-D.along:D.kind==='delta'?shore:D.R:300;
        let top=Infinity;if(D&&D.kind==='delta'){const a=r.distributary?0:D.along;for(let i=0;i<m;i++)if(r.along[i]<=a+1)top=lv[i];top=Math.min(top,lv[0]);}
        for(let i=0;i<m;i++){const rest=shore-r.along[i];if(rest<from){const k=clamp(rest/from,0,1),base=top<Infinity?Math.min(lv[i],top):lv[i];lv[i]=Math.min(lv[i],SEA+.2+k*(base-SEA-.2));}}}
      if(r.end==='lake'&&r.lake>=0){const L=lakeLevel(r.lake);for(let i=0;i<m;i++)lv[i]=Math.max(lv[i],L);}
      // A tributary eases down to its parent's level at the join over its last 250 m (at most half its length), so the two
      // water surfaces meet without a step; it never sinks below the parent there.
      if(r.end==='river'&&r.parent>=0&&!r.distributary){const P=macroLevels(r.parent),Pj=r.join?levelAt(r.parent,P,r.join.along):P[nearestVertex(r.parent,r.x[m-1],r.z[m-1])],E=Math.min(250,r.length*.5);
        for(let i=0;i<m;i++){const rest=r.length-r.along[i];if(rest<E)lv[i]=Math.min(lv[i],Pj+rest/E*(lv[i]-Pj));lv[i]=Math.max(lv[i],Pj);}}
      for(const L of MM.lakes)if(L.outletRiver===ri){const v=lakeLevel(L.id);for(let i=0;i<m;i++)lv[i]=Math.min(lv[i],v);}
      // Bed slope over a ~120 m window, flow speed (Manning: v = d^(2/3) sqrt(S) / n, n = 0.04; pools, lake reaches and
      // estuaries run slow) and the course zone from elevation, slope and discharge. Delta channels and estuary funnels
      // are 'estuary'.
      const al=r.along,sl=new Float32Array(m),sp=new Float32Array(m),zn=new Uint8Array(m),outlet=outlets.has(ri),Q=r.flux;
      for(let i=0,a=0,b=0;i<m;i++){while(a<i&&al[i]-al[a]>60)a++;while(b<m-1&&al[b]-al[i]<60)b++;sl[i]=Math.max(.0003,(lv[a]-lv[b])/Math.max(1,al[b]-al[a]));}
      for(let i=0;i<m;i++){
        const rest=r.length-al[i],h=lv[i]-SEA,S=sl[i],mouth=D&&(r.distributary||al[i]>=D.along);
        zn[i]=mouth||r.end==='ocean'&&h<1.6&&rest<700?4:!outlet&&!r.distributary&&al[i]<250?0:S>.015||h>80?1:S<.003&&(Q[i]>500||h<12&&Q[i]>250)?3:2;
        sp[i]=clamp(r.depth[i]**(2/3)*Math.sqrt(S)/.04,.15,4)*(zn[i]===4?.6:1)*(r.end==='lake'&&rest<300?.4+.6*rest/300:1);
      }
      lv.slope=sl;lv.speed=sp;lv.zone=zn;
      riverLevels.set(ri,lv);return lv;
    }
    // Level of river ri (levels P) at `along` metres from its source; nearest vertex of river ri to (x, z).
    function levelAt(ri,P,along){const r=MM.rivers[ri],a=r.along;let i=0;while(i<a.length-2&&a[i+1]<along)i++;const u=clamp((along-a[i])/((a[i+1]-a[i])||1),0,1);return P[i]+(P[i+1]-P[i])*u;}
    function nearestVertex(ri,x,z){const q=MM.rivers[ri];let best=0,bd=Infinity;for(let i=0;i<q.x.length;i++){const d=(q.x[i]-x)**2+(q.z[i]-z)**2;if(d<bd){bd=d;best=i;}}return best;}
    // A macro river's course for renderers: per vertex x, z, flux (discharge; tributaries add in), hw (half-width, m),
    // depth (m), level (water surface, m), slope (m/m), speed (m/s) and zone (0 source .. 4 estuary; names in zones).
    function riverProfile(i){const r=MM.rivers[i];if(!r)return null;const lv=macroLevels(i);
      return {id:i,end:r.end,parent:r.parent,lake:r.lake,x:r.x,z:r.z,flux:r.flux,hw:r.hw,depth:r.depth,level:Float32Array.from(lv,v=>v-.2),slope:lv.slope,speed:lv.speed,zone:lv.zone,zones:RIVER_ZONES};}
    // Macro channel at a point, in courseAt's terms (e, dist, hw, s, level, x, z, dx, dz), merged into r if nearer.
    // Widths flare where water meets water: a tributary over its last few tens of metres into its parent, the parent into
    // a junction pool at each confluence (wider where two big rivers meet), a lake inlet into the lake and an outlet out of
    // it, and an estuary into its funnel. r.join: the confluence whose pool this point lies in (for the gravel bar).
    function macroCourse(wx,wz,r){
      if(!MM.riverNear(wx,wz,mr))return;
      const ri=mr.river,lv=macroLevels(ri),level=lv[mr.seg]+(lv[mr.seg+1]-lv[mr.seg])*mr.t,R=MM.rivers[ri],i=mr.seg,t=mr.t,at=R.along[i]+(R.along[i+1]-R.along[i])*t,rest=R.length-at,D=deltaOf.get(ri);
      let hw=mr.hw*(D?1:1+.8*clamp((SEA+1.2-level)/1.2,0,1)),pool=null;
      if(D&&D.kind==='estuary'&&at>D.along){const k=clamp((at-D.along)/D.R,0,1.15);hw*=1+2.4*k*k;}
      if(R.join){const FL=25+2.5*R.join.hwP;if(rest<FL)hw*=1+clamp(.5+.5*R.join.hwP/Math.max(1,mr.hw),.6,1.6)*smooth01(1-rest/FL);}
      else if(R.end==='lake'&&rest<100)hw*=1+.7*smooth01(1-rest/100);
      if(at<60&&outlets.has(ri))hw*=1+.6*smooth01(1-at/60);
      for(const J of R.joins){const rp=Math.max(mr.hw*1.6,6+J.hw*1.5),d=Math.abs(at-J.along);if(d<rp*2){const big=J.hw>mr.hw*.5;hw*=1+(big?.8:.35)*smooth01(1-d/(rp*2));if(!pool||d<pool.d)pool={J,d,rp,at};}}
      const e=(mr.dist-hw)/mr.size+2.3;
      if(e<r.e){const j=t<.5?i:i+1;Object.assign(r,{e,dist:mr.dist,hw,s:mr.size,level,foam:false,x:mr.x,z:mr.z,spring:false,dx:mr.dx,dz:mr.dz,macro:true,river:ri,pool,
        speed:lv.speed[i]+(lv.speed[i+1]-lv.speed[i])*t,depth:R.depth[i]+(R.depth[i+1]-R.depth[i])*t,zone:RIVER_ZONES[lv.zone[j]],curve:R.curvature[i]+(R.curvature[i+1]-R.curvature[i])*t,slope:lv.slope[i]+(lv.slope[i+1]-lv.slope[i])*t});}
    }
    // Gravel bar at a confluence: an emergent bar of gravel in the junction pool just downstream of the join, on the
    // tributary's side (where its load drops). Returns 0-1 (1: bar crest) for a point in pool p of the parent course.
    function barAt(x,z,p,dx,dz){
      const J=p.J,T=MM.rivers[J.river];if(J.side===undefined){const n=T.x.length,k=Math.max(0,n-4);J.side=Math.sign(dx*(T.z[k]-T.z[n-1])-dz*(T.x[k]-T.x[n-1]))||1;}
      const P=MM.rivers[T.parent],q=pointAlong(P,J.along+p.rp*1.1),u=(x-q[0])*dx+(z-q[1])*dz,v=-(x-q[0])*dz+(z-q[1])*dx-J.side*p.rp*.35;
      const d=Math.hypot(u/(p.rp*.9),v/(p.rp*.28));return d<1?1-d*d:0;
    }
    function pointAlong(R,along){const a=R.along;let i=0;while(i<a.length-2&&a[i+1]<along)i++;const u=clamp((along-a[i])/((a[i+1]-a[i])||1),0,1);return [R.x[i]+(R.x[i+1]-R.x[i])*u,R.z[i]+(R.z[i+1]-R.z[i])*u];}
    // Delta fan at (x, z): {k (0-1 membership), level (marsh surface, m)} from the mouth landforms near the point, or null.
    // The fan spreads from the apex toward the coast; its marsh stands ~1.2 m above the sea, sloping up gently to the
    // apex, and sinks to sandbars and lagoons in the last ~90 m before open water.
    const fan={k:0,level:0};
    function deltaAt(x,z,coast){
      let best=null;
      for(const di of MM.deltaNear(x,z)){const D=MM.deltas[di];if(D.kind!=='delta')continue;
        const px=x-D.ax,pz=z-D.az,a=px*D.dx+pz*D.dz,c=-px*D.dz+pz*D.dx,rr=Math.hypot(px,pz);if(rr>D.R*1.3||a<-40)continue;
        const ang=Math.abs(Math.atan2(c,Math.max(a,1))),k=clamp((D.half+.15-ang)/.3,0,1)*clamp((D.R*1.3-rr)/(D.R*.3),0,1)*clamp((rr+40)/120,0,1);if(k<=0||best&&k<=best.k)continue;
        if(D.la===undefined)D.la=levelAt(D.river,macroLevels(D.river),D.along);
        let lvl=SEA+1.25+Math.max(0,D.la-SEA-1)*clamp(1-rr/D.R,0,1);
        if(coast<90){const bar=noise(a/45+c*.004,c/140,seed+931)+(noise(x*.06,z*.06,seed+933)-.5)*.3;lvl=Math.min(lvl,SEA+.2+Math.max(0,coast)/90*1.05+(bar-.55)*1.1);}
        best={k:k*k*(3-2*k),level:lvl};}
      if(!best)return null;fan.k=best.k;fan.level=best.level;return fan;
    }
    // A light meander warp only (meander loops come from the macro courses and the local control network). Local creeks
    // and streams (courseAt) are skipped out at sea, beyond any coast.
    // Channels are only looked for out to a normalized distance of 125 (past any valley, bank or riparian reach);
    // beyond that the point reads as far from water (999), which lets the course search prune most candidates.
    function riverAt(x,z,t){
      const wx=x+(noise(x*.02,z*.02,seed+345)-.5)*12,wz=z+(noise(x*.02,z*.02,seed+347)-.5)*12;
      const r={e:125,lake:0,dx:0,dz:0};macroCourse(wx,wz,r);if(!(t&&t.coast<-700))courseAt(0,wx,wz,r);if(r.hw===undefined)r.e=999;
      return {d:r.e,level:r.level||0,lake:0,w:r.e<999?r.hw:0,foam:!!r.foam,spring:!!r.spring,size:r.s||0,dir:[r.dx||0,r.dz||0],macro:!!r.macro,pool:r.macro?r.pool:null,
        speed:r.speed||0,depth:r.depth||0,zone:r.e<999?r.zone:null,curve:r.curve||0,slope:r.slope||0,cx:r.x,cz:r.z,dist:r.dist||0};
    }
    // Mountains are built in two layers on top of plate relief (and volcano cones):
    // 1. cragAt: the massif landform. Gradient-damped fBm (Inigo Quilez's trick): value-noise octaves fade where the
    //    octaves above are already steep, so detail collects on summits and spurs rather than in valleys. Domain-warped so
    //    ridgelines wander, modulated by a broad field so peaks cluster into massifs between lower cols, and raised to a
    //    power so summits sharpen. Side outputs: cragLow (the first two octaves: the broad, smooth landform without gullies,
    //    read by the drainage and the glacier surface) and cragGx/cragGz (its analytic gradient, m/m).
    // 2. erodeAt: the eroded-terrain filter (Clay John / Fuse, with Rune Vision's refinements) carves branching gullies
    //    and sharp arêtes into the surface, aligned with its downhill direction.
    let cragLow=0,cragGx=0,cragGz=0,lowGx=0,lowGz=0;
    // The crag's share of relief saturates: the range layer already carries the bulk of a big range, so peaks and ridges
    // add up to ~110 m on the tallest chains instead of doubling them.
    const cragRelief=r=>r<80?r:80+(r-80)*.2;
    function noiseD(x,z,k,out){
      const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz),dsx=6*fx*(1-fx),dsz=6*fz*(1-fz);
      const a=hash(ix,iz,k),b=hash(ix+1,iz,k),c=hash(ix,iz+1,k),d=hash(ix+1,iz+1,k),e=a-b-c+d;
      out[0]=a+(b-a)*sx+(c-a)*sz+e*sx*sz;out[1]=dsx*((b-a)+e*sz);out[2]=dsz*((c-a)+e*sx);
    }
    const nd=[0,0,0],wa=[0,0,0],wb=[0,0,0];
    function cragAt(x,z,relief,cone=0){
      const m=Math.max(clamp((relief-6)/50,0,1),clamp(cone/70,0,1)*.6);if(!m){cragLow=cragGx=cragGz=lowGx=lowGz=0;return 0;}
      noiseD(x*.008,z*.008,seed+355,wa);noiseD(x*.008,z*.008,seed+357,wb);
      const wx=x+(wa[0]-.5)*50,wz=z+(wb[0]-.5)*50,massif=.6+.4*noise(x*.004,z*.004,seed+359);
      // j: Jacobian of the octave coordinates with respect to the warped point, so gradients come out in metres.
      let px=wx*.011,pz=wz*.011,sum=0,gx=0,gz=0,amp=1,norm=0,dx=0,dz=0,low=0,ldx=0,ldz=0,j00=.011,j01=0,j10=0,j11=.011;
      for(let o=0;o<6;o++){
        noiseD(px,pz,seed+351+o,nd);gx+=nd[1]*amp;gz+=nd[2]*amp;
        const k=amp/(1+gx*gx+gz*gz);sum+=k*nd[0];norm+=amp;
        dx+=k*(nd[1]*j00+nd[2]*j10);dz+=k*(nd[1]*j01+nd[2]*j11);
        if(o===1){low=sum/norm;ldx=dx/norm;ldz=dz/norm;}
        amp*=.5;const qx=1.6*px-1.2*pz,qz=1.2*px+1.6*pz;px=qx;pz=qz;
        const a0=1.6*j00-1.2*j10,a1=1.6*j01-1.2*j11;j10=1.2*j00+1.6*j10;j11=1.2*j01+1.6*j11;j00=a0;j01=a1;
      }
      // Volcano cones get only a light share of this landform: their shape comes from the cone and its erosion.
      // Detail height is capped (28 m) well under its wavelength (~90 m): taller mountains get their size from the broad ridge layer
      // below, not from taller noise, which would stand up as needles.
      const A=Math.min(28,Math.max(cragRelief(relief),cone*.3)*.6)*m*massif,v=sum/norm*1.5-.15,f=clamp(v,0,1.2),lv=low*1.5-.15,lf=clamp(lv,0,1.2);
      const s=v>0&&v<1.2?A*1.7*f**.7*1.5/norm:0,ls=lv>0&&lv<1.2?A*1.7*lf**.7*1.5:0;
      // Chain rule through the domain warp: d(warped)/d(world) = I + 50 * d(warp noise).
      const Wxx=1+50*.008*wa[1],Wxz=50*.008*wa[2],Wzx=50*.008*wb[1],Wzz=1+50*.008*wb[2];
      cragGx=s*(dx*Wxx+dz*Wzx);cragGz=s*(dx*Wxz+dz*Wzz);
      cragLow=A*lf**1.7;lowGx=ls*(ldx*Wxx+ldz*Wzx);lowGz=ls*(ldx*Wxz+ldz*Wzz);
      // Broad ridges for big ranges: three gradient-damped octaves at ~350 m, so large relief breaks into sub-peaks,
      // spurs and wide valleys whose slopes stay walkable (height scales with wavelength, not with relief alone).
      const Bm=clamp((relief-60)/140,0,1);let big=0;
      if(Bm>0){
        const Ab=Math.min(relief*.32,120)*Bm*massif;let bx=x*.0029,bz=z*.0029,bs=0,bgx=0,bgz=0,ba=1,bn=0,bdx=0,bdz=0,J=.0029,K=0,L=0,N=.0029;
        for(let o=0;o<3;o++){noiseD(bx,bz,seed+381+o,nd);bgx+=nd[1]*ba;bgz+=nd[2]*ba;const k=ba/(1+bgx*bgx+bgz*bgz);bs+=k*nd[0];bn+=ba;
          bdx+=k*(nd[1]*J+nd[2]*L);bdz+=k*(nd[1]*K+nd[2]*N);ba*=.5;const qx=1.6*bx-1.2*bz,qz=1.2*bx+1.6*bz;bx=qx;bz=qz;
          const a0=1.6*J-1.2*L,a1=1.6*K-1.2*N;L=1.2*J+1.6*L;N=1.2*K+1.6*N;J=a0;K=a1;}
        const bv=clamp(bs/bn*1.4-.1,0,1.2),bsl=bv>0&&bv<1.2?Ab*1.5*bv**.5*1.4/bn:0;big=Ab*bv**1.5;
        cragGx+=bsl*bdx;cragGz+=bsl*bdz;cragLow+=big;lowGx+=bsl*bdx;lowGz+=bsl*bdz;
      }
      return A*f**1.7+big;
    }
    // Eroded-terrain filter. Each octave sums 3x3 jittered cells; every cell lays a wave whose phase is the distance across
    // the local downhill direction, so its crests and troughs run downhill. Blending the cells by a smooth falloff makes
    // the stripes fork and merge into a dendritic pattern. Rune Vision's refinements:
    // - normalized gullies: the summed (cos, sin) pair is read as an angle on the unit circle, so every place gets a full
    //   ridge-to-gully swing whatever the blend;
    // - straight gullies: that angle drives a (slightly softened) triangle wave: straight V gullies and sharp arêtes;
    // - stacked fading: each octave's strength fades with the slope of the surface carved so far (gentle ground, such as
    //   summit plateaus, cirque floors and valley bottoms, stays smooth), and its gradient joins the running gradient,
    //   so the next, finer octave runs down the walls of the gullies above it.
    // Input: point, running gradient (m/m) and first-octave amplitude (m). Writes height offset, gradient and crease to
    // `ero`: crease is 0-1, high on gully floors where the coarse octaves converge (where water would gather).
    const ero={offset:0,gx:0,gz:0,crease:0},EG=84,TAU=Math.PI*2,ASK=Math.asin(.95);
    function erodeAt(x,z,gx,gz,E){
      let off=0,ox=0,oz=0,crease=0,cell=EG,amp=E;
      for(let o=0;o<3;o++,cell*=.5,amp*=.42){
        // Finer octaves need steeper ground: where the running gradient is weak its direction swings quickly, and so would
        // the waves laid along it.
        const G=Math.hypot(gx,gz),fade=clamp((G-.06-.14*o)/.4,0,1);if(!fade)continue;
        const ux=-gz/G,uz=gx/G,px=x/cell,pz=z/cell,ix=Math.floor(px),iz=Math.floor(pz),k=seed+701+o*7;
        let C=0,S=0,Cx=0,Cz=0,Sx=0,Sz=0,wt=0;
        for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
          const ci=ix+i,cj=iz+j,qx=px-(ci+.5+(hash(ci,cj,k)-.5)*.6),qz=pz-(cj+.5+(hash(ci,cj,k+1)-.5)*.6),w=Math.exp(-4*(qx*qx+qz*qz));
          // Per-cell jitter of the wave direction (about ±11°) breaks up parallel combing without chopping arêtes into
          // isolated spikes — ridges stay coherent enough to read as rock.
          const t=(hash(ci,cj,k+2)-.5)*.38,ct=Math.cos(t),st=Math.sin(t),vx=ux*ct-uz*st,vz=ux*st+uz*ct;
          const ph=(qx*vx+qz*vz)*TAU,c=Math.cos(ph)*w,s=Math.sin(ph)*w,d=TAU/cell;
          C+=c;S+=s;Cx-=s*vx*d;Cz-=s*vz*d;Sx+=c*vx*d;Sz+=c*vz*d;wt+=w;
        }
        const L2=C*C+S*S;if(L2<1e-12)continue;
        // Soft triangle wave of the summed angle: asin(k cos a), nearly straight-sided but with crests and floors rounded
        // over a few metres, so no crest is a one-voxel fin.
        const len=Math.sqrt(L2),cn=C/len,tri=Math.asin(.95*cn)/ASK,conf=clamp(len/wt*2.5,0,1),q=.95/(ASK*Math.sqrt(1-.9025*cn*cn))*S/(L2*len)*conf;
        // Where the blend is incoherent the wave fades out rather than snapping between ridge and gully.
        const h=amp*fade,dx=h*q*(S*Cx-C*Sx),dz=h*q*(S*Cz-C*Sz);
        // The next octave follows the gradient of the plain cosine wave (cn): the soft triangle's crests turn the gradient
        // too abruptly to steer by.
        const r=h*conf*S/(L2*len);off+=h*tri*conf;ox+=dx;oz+=dz;gx+=r*(S*Cx-C*Sx);gz+=r*(S*Cz-C*Sz);
        if(o<2)crease=Math.max(crease,fade*conf*clamp((-tri-.3)/.55,0,1)*(o?.7:1));
      }
      ero.offset=off;ero.gx=ox;ero.gz=oz;ero.crease=crease;return ero;
    }
    // Gradient of plate relief and cones (m/m), as central differences on a cached 16 m lattice, bilinearly interpolated.
    // The lattice smooths kinks in plate relief: the erosion waves take their direction from this gradient and would
    // tear where it turned abruptly.
    const MG=16,mgCells=new Map(),mgrad=[0,0];
    function macroCell(i,j){
      const k=i*16777216+j;let v=mgCells.get(k);if(v)return v;const x=i*MG,z=j*MG,e=MG/2;
      v=[(tectonics(x+e,z).h-tectonics(x-e,z).h)/MG,(tectonics(x,z+e).h-tectonics(x,z-e).h)/MG];
      mgCells.set(k,v);if(mgCells.size>16384)mgCells.delete(mgCells.keys().next().value);return v;
    }
    function macroGradient(x,z){
      const gx=x/MG,gz=z/MG,i=Math.floor(gx),j=Math.floor(gz),u=gx-i,w=gz-j,a=macroCell(i,j),b=macroCell(i+1,j),c=macroCell(i,j+1),d=macroCell(i+1,j+1);
      for(let k=0;k<2;k++)mgrad[k]=(a[k]+(b[k]-a[k])*u)*(1-w)+(c[k]+(d[k]-c[k])*u)*w;return mgrad;
    }
    // Mountain surface (only where plates or a cone lift the land; lowlands are gentle by construction). Call right after
    // cragAt(x,z,...) for the same point. The lattice gradient of plates and cones plus the crag's broad-landform gradient
    // seeds the erosion filter (gullies follow the broad landform, not every crag bump); the full crag gradient plus the
    // erosion's own gives the slope, exactly and without re-evaluating anything. spur: erosion / strength, about -1.4
    // (gully floor) to 1.4 (spur crest). gx, gz: gradient of the eroded surface (m/m).
    const surf={slope:0,erosion:0,crease:0,spur:0,gx:0,gz:0};
    function mountainSurface(x,z,t){
      surf.slope=surf.erosion=surf.crease=surf.spur=surf.gx=surf.gz=0;if(!(t.relief>12||t.cone>5))return surf;
      macroGradient(x,z);const mx=mgrad[0],mz=mgrad[1],E=erosionStrength(t,x,z);let gx=mx+cragGx,gz=mz+cragGz;
      if(E>0){erodeAt(x,z,mx+lowGx,mz+lowGz,E);surf.erosion=ero.offset;surf.crease=ero.crease;surf.spur=ero.offset/E;gx+=ero.gx;gz+=ero.gz;}
      surf.gx=gx;surf.gz=gz;surf.slope=Math.hypot(gx,gz);return surf;
    }
    // Public erosion sample for other systems (drainage): {offset (m, added to the ground), crease (0-1, high on gully
    // floors where coarse erosion octaves converge, 0 off mountains), gradient [gx, gz] of the eroded mountain surface
    // (m/m)}. Pure function of (seed, x, z); costs one plate/crag evaluation plus three erosion octaves.
    function erosionAt(x,z){
      const t=tectonics(x,z);cragAt(x,z,t.relief,t.cone);const s=mountainSurface(x,z,t);
      return {offset:s.erosion,crease:s.crease,gradient:[s.gx,s.gz]};
    }
    // Soft ceiling for the tallest summits: above 3 km, height eases toward 3.4 km, well inside the 10 km column.
    const summit=h=>h>3000?3000+400*Math.tanh((h-3000)/400):h;
    // Strength of erosion here (first-octave amplitude, m): proportional to the relief the plates or a cone raise. A
    // volcano's crater and the smooth summit cone just around it are left uneroded.
    // Erosion is patchy: a broad field decides which faces are deeply dissected and which stay smooth slabs and scree
    // aprons, so a range reads as rock massif rather than a uniform bed of spikes. Depth tracks relief (its cap grew with
    // the ranges); a volcano's crater and smooth summit cone stay uneroded.
    const erosionStrength=(t,x,z)=>{const patch=.3+.7*noise(x*.0009,z*.0009,seed+743);
      // Gully depth is capped at 10 m (about an eighth of the first octave's 84 m cell), so gullies stay V-shaped, not needle combs.
      return Math.min(10,clamp((t.relief-8)/40,0,1)*Math.min(t.relief,480)*.11+(t.cone?clamp(t.cone/40,0,1)*t.cone*.12*clamp((Math.hypot(x-t.vx,z-t.vz)/(t.vr*.075)-1.4)/1.6,0,1):0))*patch;};
    // Basalt outcrops: small scattered knolls (one candidate per 36 m cell, 2-4.5 m across), never broad sheets of rock.
    // They gather below the home massif's cliffs, where fallen blocks would lie.
    function outcropAt(x,z){
      const G=36,i=Math.floor(x/G),j=Math.floor(z/G),cx=(i+.25+.5*hash(i,j,seed+363))*G,cz=(j+.25+.5*hash(i,j,seed+367))*G;
      if(hash(i,j,seed+361)>(massifDistance(cx,cz)<70?.9:.4))return 0;
      const r=2+2.5*hash(i,j,seed+365),d=Math.hypot(x-cx,z-cz)+(noise(x*.4,z*.4,seed+369)-.5)*1.6;
      return d<r?1-d/r:0;
    }
    // Sky isles: aether-lifted rock, one candidate per 120 m cell, commoner over mountain belts. Not ground: crew walk beneath them.
    // Disabled for now (SKY_ISLES=false): no slabs, no isle falls feeding drainage, no shade marks. Flip to restore.
    const SKY_ISLES=false,IG=120,isles=new Map();
    function isleCell(i,j){
      if(!SKY_ISLES)return null;
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
          v={x,z,r,top,cold:climate(x,z).T-(cool(top)-cool(t.h))<-5,fall:null};
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
      if(gallery)return galleryAncientSite(i,j);
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
          // Giant sequoia: the conifer hero of cool forests. A tall buttressed red trunk on level ground and a narrow
          // crown of 6-8 drooping bough tiers from ~40% up, counted down from the apex (the renderer's tier shading).
          if(['redwood','montane','boreal'].includes(g.biome)||g.biome==='forest'&&g.temperature<12){
            const H=45+15*H_(3),R=2.4+.6*H_(4),base=g0-.5,crownLow=base+H*.4,apex=base+H,tiers=[],nT=6+Math.floor(H_(5)*3),per=(apex-crownLow)/nT,CR=7.5+2.5*H_(6);
            for(let m=0;m<nT;m++){const yTop=apex-m*per,env=CR*Math.min(1,(m+1)/nT*1.1)*(.86+.14*hash(m,k,seed+451));tiers.push({top:yTop,bottom:yTop-per,r:m===0?env*.55:env,step:.32+.13*hash(m,k,seed+453)});}
            const roots=[];for(let m=0;m<6;m++){const a=m/6*Math.PI*2+(H_(20+m)-.5)*.6;roots.push({ux:Math.cos(a),uz:Math.sin(a),len:R*(1.8+.8*H_(40+m))});}
            v={x,z,g0,variant:'sequoia',base,H,R,crownLow,apex,tiers,per,roots,top:apex+1,reach:CR+2,floorR:CR*1.15};
            ancients.set(k,v);if(ancients.size>4096)ancients.delete(ancients.keys().next().value);return v;
          }
          const Mr=18+6*H_(1),Mh=2.2+1.6*H_(2),base=g0+Mh-.6,H=20+7*H_(3),R=4+1.1*H_(4),la=H_(5)*Math.PI*2,lean=3.5+3*H_(6);
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
          // Low forks carry a broad, layered crown rather than a cluster perched on a tall pole.
          const limbs=[],lumps=[],pads=[],nl=7+Math.floor(H_(11)*2);
          for(let m=0;m<nl;m++){
            const a=m/nl*Math.PI*2+(H_(80+m)-.5)*.45,reach=15+9*H_(100+m),ey=cy-2+6*H_(120+m),ex=cx+Math.cos(a)*reach,ez=cz+Math.sin(a)*reach,f=.48+.18*H_(320+m);
            const x0=x+lx*f**1.6,z0=z+lz*f**1.6,y0=base+H*f,steps=Math.ceil(Math.hypot(ex-x0,ez-z0,ey-y0)/.65);
            limbs.push({x0,z0,y0,x1:ex,z1:ez,y1:ey,r0:R*.65,r1:.85,steps});
            const ix=x0+(ex-x0)*.55,iz=z0+(ez-z0)*.55,iy=y0+(ey-y0)*Math.sqrt(.55);
            if(variant==='blossom'){
              lumps.push({x:ex,z:ez,y:ey+1,r:7+3.5*H_(140+m)});
              lumps.push({x:ix,z:iz,y:iy+1,r:5+2*H_(180+m)});
            }else{
              pads.push({x:ex,z:ez,y:ey+1.5,r:7+3.5*H_(140+m),th:3+1.6*H_(160+m)});
              pads.push({x:ix,z:iz,y:iy+1,r:5+2*H_(180+m),th:2.8});
            }
          }
          if(variant==='blossom')lumps.push({x:cx,z:cz,y:cy+4,r:10});
          else pads.push({x:cx,z:cz,y:cy+4,r:10,th:3.8});
          // A separate lower storey leaves open windows between the old boughs and the high crown.
          for(let m=0;m<4;m++){
            const a=la+m*Math.PI/2+.25,reach=12+7*H_(340+m),f=.28+.1*H_(360+m),ey=base+H*(.52+.12*H_(380+m));
            const ex=x+Math.cos(a)*reach,ez=z+Math.sin(a)*reach,x0=x+lx*f**1.6,z0=z+lz*f**1.6,y0=base+H*f;
            limbs.push({x0,z0,y0,x1:ex,z1:ez,y1:ey,r0:R*.55,r1:.85,steps:Math.ceil(Math.hypot(ex-x0,ez-z0,ey-y0)/.65)});
            const r=6+2*H_(400+m);
            if(variant==='blossom')lumps.push({x:ex,z:ez,y:ey+1,r});
            else pads.push({x:ex,z:ez,y:ey+1,r,th:2.8});
          }
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
    // Boulders: one candidate cell per 9 m. Lowlands keep rare lone erratics (and a few on tundra and alpine meadow); on
    // mountains boulders are everywhere but snow and ice: clusters of two to five in falling sizes (0.5-3 m across) on rock
    // slopes, denser smaller rubble on talus and scree, clusters on alpine meadows and moraine ground, few in montane
    // forest, and tors (stacked blocks, the upper ones perched) on ridge crests and peaks. Boulders sit on the ground with
    // only their foot embedded; a small one may rest on a bigger one.
    const BG=9,boulders=new Map();
    // A rock block: rounded-angular, wider than tall (about 1.2-1.6 : 1) with a flatter top, undercut toward its foot so
    // it is widest a little above the ground and a shadow line wraps its base. In a frame scaled by (r, ry, r): the
    // intersection of a near-level top facet, six random half-spaces, a slightly larger ellipsoid and an inverted cone
    // (the undercut). The block spans about -0.85 (foot) to 0.65 (top) in that frame. rest: grounded, so its foot reaches
    // the ground. cap: material for top faces (moss or snow), or 0. rot: yaw of its first side facet.
    function rockShape(x,z,y,r,ry,k,mat,cap,rest=true){
      const P=new Float32Array(28);
      for(let n=0;n<7;n++){const a=hash(n,k,seed+591)*TAU,e=n?hash(n,k,seed+593)*1-.2:1.35+.2*hash(n,k,seed+593),c=Math.cos(e);
        P[n*4]=Math.cos(a)*c;P[n*4+1]=Math.sin(e);P[n*4+2]=Math.sin(a)*c;P[n*4+3]=n?.78+.17*hash(n,k,seed+595):.58+.12*hash(n,k,seed+595);}
      return {x,z,y,r,ry,P,mat,cap,rest,rot:hash(1,k,seed+591)*TAU,k};
    }
    // Vertical span [lo, hi] (m) of a rock block in the column at (x, z), or null. jit (0-1, per column) nudges the faces
    // for one-block surface roughness. Also sets spanFoot: the column is near the block's centre (where it meets the ground).
    const span=[0,0];let spanFoot=false;
    function rockSpan(q,x,z,jit){
      const u=(x-q.x)/q.r,v=(z-q.z)/q.r,d2=u*u+v*v;if(d2>=1.3)return null;
      const P=q.P,f=1+(jit-.5)*.12,dn=Math.sqrt(d2);let hi=Math.sqrt(1.3-d2),lo=Math.max(-hi,-.85+1.05*dn*Math.sqrt(dn));
      for(let i=0;i<28;i+=4){const ny=P[i+1],R=P[i+3]*f-P[i]*u-P[i+2]*v;
        if(ny>.02)hi=Math.min(hi,R/ny);else if(ny<-.02)lo=Math.max(lo,R/ny);else if(R<0)return null;}
      if(hi<=lo)return null;span[0]=q.y+lo*q.ry;span[1]=q.y+hi*q.ry;spanFoot=dn<.45;return span;
    }
    const BOULDER_MEADOW=new Set(['meadow','tundra','subalpine']);
    // Centre height for a block of half-height ry resting on ground g (m): about 15% of its height embedded, a little
    // deeper on slopes so the uphill side beds in.
    const restY=(ground,r,ry,slope)=>ground+.63*ry-Math.min(slope,1.5)*r*.2;
    function boulderCell(i,j){
      const k=i*1048576+j;if(boulders.has(k))return boulders.get(k);let v=null;const p=hash(i,j,seed+551);
      const x=(i+.2+.6*hash(i,j,seed+553))*BG,z=(j+.2+.6*hash(i,j,seed+555))*BG;
      let mtn=false;if(p>=.2){const t=tectonics(x,z);mtn=gallery||t.relief>15||t.cone>20;}
      if(p<.2||mtn){
        const g=geography(x,z),bad=G=>G.sea||G.wet||G.water>G.height||G.gorge||G.highland||G.biome==='snow'||G.glacier||G.iceCells>0;
        const tone=b=>{const t=hash(b,k,seed+575);return t<.6?MAT.boulder:MAT.boulderPale;};
        const capOf=G=>G.temperature<-6?MAT.snow:G.temperature>-1&&!G.exposed&&G.biome!=='alpine'?MAT.mossy:0;
        mtn=g.relief>15||g.cone>20;
        if(!mtn){
          // Lone erratics (with an occasional smaller companion).
          const chance=bad(g)||g.slope>1.1||Math.hypot(x,z)<30?0:BOULDER_MEADOW.has(g.biome)?.1:.006;
          if(p<chance){
            const r=.4+.9*hash(i,j,seed+557)**2,ry=r*(1+.25*hash(i,j,seed+559)),list=[rockShape(x,z,restY(g.height*cellMetres,r,ry,g.slope),r,ry,k,tone(0),capOf(g))];
            if(hash(i,j,seed+561)<.4){const a=hash(i,j,seed+563)*TAU,o=r+.3,cx=x+Math.cos(a)*o,cz=z+Math.sin(a)*o,cr=r*.5,G=geography(cx,cz);list.push(rockShape(cx,cz,restY(G.height*cellMetres,cr,cr*.9,G.slope),cr,cr*.9,k+7,tone(1),capOf(G)));}
            v={x,z,list,reach:r*2.5+1};
          }
        }else if(!bad(g)&&g.slope<1.9){
          const q=hash(i,j,seed+557),rock=g.exposed||g.biome==='alpine',talus=rock&&g.slope>.45&&g.slope<1.15&&g.spur<-.25||!rock&&g.slope>.9;
          const tor=(rock||BOULDER_MEADOW.has(g.biome))&&g.slope<.8&&(g.spur>.75||g.hollow<-5)&&q<.45,m=hash(i,j,seed+561);
          // Clusters in this cell and blocks per cluster.
          const clusters=tor?1:talus?(q<.9?2:0):rock?(q<.8?1+(m<.4):0):BOULDER_MEADOW.has(g.biome)?(q<.6?1:0):q<.3?1:0;
          const list=[];let reach=0;
          const add=(o)=>{list.push(o);reach=Math.max(reach,Math.hypot(o.x-x,o.z-z)+o.r*1.2);};
          if(tor){
            // Tor: two or three slabby blocks, each smaller, stacked with a lean; only the base is grounded.
            let r=1.3+.9*hash(0,k,seed+569),ry=r*(.62+.15*hash(0,k,seed+571)),y=restY(g.height*cellMetres,r,ry,g.slope),cx=x,cz=z;const blocks=2+Math.floor(2*hash(0,k,seed+573));
            for(let s2=0;s2<blocks;s2++){
              add(rockShape(cx,cz,y,r,ry,k*7+s2,s2&1?MAT.boulderPale:MAT.boulder,s2===blocks-1?capOf(g):0,s2===0));
              const nr=r*(.65+.2*hash(s2,k,seed+577)),nry=nr*(.62+.15*hash(s2,k,seed+579)),a=hash(s2,k,seed+581)*TAU,o=r*.3*hash(s2,k,seed+583);
              y+=ry*.6+nry*.8;cx+=Math.cos(a)*o;cz+=Math.sin(a)*o;r=nr;ry=nry;
            }
          }
          for(let c=0;c<clusters&&!tor;c++){
            // A cluster: a main block and up to four smaller ones around it in falling sizes; sometimes the last small one
            // rests on top of the main block instead.
            const n=talus?2+Math.floor(3*hash(c,k,seed+587)):rock||BOULDER_MEADOW.has(g.biome)?2+Math.floor(4*hash(c,k,seed+587)):1+Math.floor(2*hash(c,k,seed+587));
            const cx=(i+.15+.7*hash(c,k,seed+565))*BG,cz=(j+.15+.7*hash(c,k,seed+567))*BG,h=hash(c,k,seed+569);
            let main=null;
            for(let b=0;b<n;b++){
              const id=c*8+b,a=hash(id,k,seed+581)*TAU;
              let r=b?main.r*.72**b*(.85+.3*hash(id,k,seed+577)):(talus?.35+.5*h:.5+1*h*h);if(r<.25)break;
              let ry=r*(1+.25*hash(id,k,seed+571));
              if(b&&b===n-1&&r<main.r*.5&&hash(id,k,seed+589)<.35){
                const o=main.r*.3,px=main.x+Math.cos(a)*o,pz=main.z+Math.sin(a)*o;
                add(rockShape(px,pz,main.y+main.ry*.6+ry*.8,r,ry,k*31+id,tone(id),main.cap,false));break;
              }
              const o=b?main.r*.95+r*.6:0,px=cx+Math.cos(a)*o,pz=cz+Math.sin(a)*o,G=b?geography(px,pz):geography(cx,cz);
              if(bad(G)||G.slope>2){if(!b)break;continue;}
              if(G.slope>1.4){r*=.6;ry*=.6;}
              const o2=rockShape(px,pz,restY(G.height*cellMetres,r,ry,G.slope),r,ry,k*31+id,tone(id),capOf(G));
              add(o2);if(!b)main=o2;
            }
          }
          if(list.length)v={x,z,list,reach:reach+.5};
        }
      }
      boulders.set(k,v);if(boulders.size>16384)boulders.delete(boulders.keys().next().value);return v;
    }
    // Boulder props near (x, z) within `radius` m, for renderers that draw rock meshes: centre (m), size (half-width, m),
    // height (half-height, m), yaw and a per-block seed. The voxel boulders are stamped regardless.
    // Mushrooms as objects (metres) for renderers that draw them as meshes: one entry per cluster member.
    function mushroomsNear(x,z,radius=12){
      if(!infinite)return [];const out=[];
      for(let gz=Math.floor((z-radius-4)/TG);gz<=Math.floor((z+radius+4)/TG);gz++)for(let gx=Math.floor((x-radius-4)/TG);gx<=Math.floor((x+radius+4)/TG);gx++){
        const t=tree(gx,gz);if(!t||t.kind!=='mushroom')continue;
        for(const m of t.list)if(Math.hypot(m.x-x,m.z-z)<radius+m.cr)out.push({x:m.x,z:m.z,base:m.base*cellMetres,capRadius:m.cr,capHeight:m.ct,stemRadius:m.sr,stemHeight:m.sh,spin:m.spin,color:MAT.mushroom,spot:MAT.stem});
      }
      return out;
    }
    // Palms as objects (metres): trunk base and lean, crown point, and per-frond yaw/pitch/droop/length for authored meshes.
    function palmsNear(x,z,radius=12){
      if(!infinite)return [];const out=[];
      for(let gz=Math.floor((z-radius-4)/TG);gz<=Math.floor((z+radius+4)/TG);gz++)for(let gx=Math.floor((x-radius-4)/TG);gx<=Math.floor((x+radius+4)/TG);gx++){
        const t=tree(gx,gz);if(!t||t.species!=='palm'||Math.hypot(t.x-x,t.z-z)>radius+3)continue;
        const H=t.height*cellMetres,b=t.base*cellMetres;
        out.push({x:t.x,z:t.z,base:b,height:H,lean:[t.lx,t.lz],crownTop:[t.x+t.lx,b+H,t.z+t.lz],
          fronds:t.fronds.map(f=>({yaw:f.yaw,pitch:Math.atan(f.rise),droop:f.droop,length:f.length})),
          young:t.young.map(f=>({yaw:f.yaw,pitch:Math.atan(1.6),length:f.length})),coconuts:!!t.coconuts,leaf:t.leaf,bark:t.bark});
      }
      return out;
    }
    function bouldersNear(x,z,radius=12){
      const out=[];
      for(let j=Math.floor((z-radius-6)/BG);j<=Math.floor((z+radius+6)/BG);j++)for(let i=Math.floor((x-radius-6)/BG);i<=Math.floor((x+radius+6)/BG);i++){
        const B=boulderCell(i,j);if(B)for(const q of B.list)if(Math.hypot(q.x-x,q.z-z)<radius+q.r)out.push({x:q.x,z:q.z,y:q.y,size:q.r,height:q.ry,rot:q.rot,seed:q.k});}
      // River rocks too (river: true; inWater: set for rocks standing in the channel, which the renderer foams around).
      for(let j=Math.floor((z-radius-4)/RG);j<=Math.floor((z+radius+4)/RG);j++)for(let i=Math.floor((x-radius-4)/RG);i<=Math.floor((x+radius+4)/RG);i++){
        const B=riverRockCell(i,j);if(B)B.list.forEach((q,n)=>{if(Math.hypot(q.x-x,q.z-z)<radius+q.r)out.push({x:q.x,z:q.z,y:q.y,size:q.r,height:q.ry,rot:hash(i*7+n,j,seed+589)*TAU,seed:i*1048576+j+n,river:true,inWater:!!q.wet});});}
      return out;
    }
    // River rocks: one candidate per 4 m cell, kept only in fast reaches (boulders mid-stream and at the water's edge,
    // their tops clear of the water) and in the spray zone around falls and springs (smaller mossy rocks on the banks).
    // Under a metre across, so only stamped at the finer LODs.
    const RG=4,riverRocks=new Map();
    function riverRockCell(i,j){
      const k=i*1048576+j;if(riverRocks.has(k))return riverRocks.get(k);let v=null;const p=hash(i,j,seed+571);
      if(p<.6){
        const x=(i+.15+.7*hash(i,j,seed+573))*RG,z=(j+.15+.7*hash(i,j,seed+575))*RG,g=geography(x,z);
        // Upper-course channels are strewn with boulders (more of them mid-stream); falls and springs keep their spray rocks.
        if(!g.sea&&!g.gorge&&(g.fast&&g.riverDistance<5.5||g.splash)&&g.slope<1.3&&(p<.45||g.riverZone==='upper'||g.splash)){
          const wet=g.water>g.height,n=g.splash&&!wet?2+Math.floor(hash(i,j,seed+577)*2):1,list=[],mossy=g.splash||!wet;
          for(let s2=0;s2<n;s2++){
            const a=hash(s2,k,seed+579)*Math.PI*2,o=s2?.6+1.2*hash(s2,k,seed+581):0,qx=x+Math.cos(a)*o,qz=z+Math.sin(a)*o,G=s2?geography(qx,qz):g;
            const r=(g.splash&&!wet?.25+.3*hash(s2,k,seed+583):.35+.55*hash(s2,k,seed+583))*(g.riverSize>=.9?1.3:1),ry=r*.7,ground=G.height*cellMetres;
            // In the channel the rock sits on the bed and its top stands 0.1-0.4 m above the water.
            const y=G.water>G.height?Math.max(ground+ry*.5,G.water*cellMetres+.1+.3*hash(s2,k,seed+585)-ry):ground+ry*(.1-.3*hash(s2,k,seed+587));
            list.push({x:qx,z:qz,r,ry,y,mossy:mossy&&!(G.water>G.height),wet:G.water>G.height});
          }
          v={x,z,list,reach:3.2};
        }
      }
      riverRocks.set(k,v);if(riverRocks.size>16384)riverRocks.delete(riverRocks.keys().next().value);return v;
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
        if(gallery)return galleryGeo(x,z);
        const t=tectonics(x,z);
        const RV=riverAt(x,z,t),riverDistance=RV.d;
        // Macro lakes: membership is the macro map's smooth lake field, its edge roughened by ~90 m and ~22 m noise so
        // shores wander into coves and points. LD > .5 is water; a shore band outside it shelves gently up from the water.
        let LD=0,lakeL=0;
        if(t.lake>=0&&t.lakeD>.05){LD=t.lakeD+(noise(x*.011,z*.011,seed+921)-.5)*.3+(noise(x*.045,z*.045,seed+923)-.5)*.1;
          // The lake follows the land's contour: ground standing well above its level (a mountain flank that now rises where
          // the macro lake field reaches) is shore, not lake, so lakes never cut walls into hillsides.
          if(LD>.1){const L0=lakeLevel(t.lake);LD=Math.max(Math.min(LD,.16),Math.min(LD,.5+.4*clamp((L0+3-t.h)/6,-1,1)));if(LD>.1){lakeL=L0;RV.lake=lakeL;}}}
        const ridge=1-Math.abs(noise(x*.009,z*.009,seed+107)-.5)*2;
        const fault=Math.abs(noise(x*.04,z*.04,seed+109)-.5)*20;
        const crag=cragAt(x,z,t.relief,t.cone),low=cragLow,bump=noise(x*.032,z*.032,seed)*2.4+noise(x*.13,z*.13,seed+1)*.7+ridge**4*3;
        const {slope,erosion,crease,spur}=mountainSurface(x,z,t);
        let h=summit(t.h+bump*(t.h<SEA?.4:1)+crag+erosion);
        // Crags: steep mountain ground breaks into cliff bands, 2.5-6 m risers between narrower ledges along wandering
        // contours (a cubic step within each band, so the band keeps its height but stands up as a wall), with rounded
        // knuckles of rock along spur crests, so rock faces read as fractured stepped walls rather than smooth slopes. Bands
        // fade out beside channels and break open into ramps (about a third of the ground, in ~50 m patches), so every face
        // has a walkable way up between its walls. cliff: 0-1 on a riser (bare rock); talus: the foot of a riser (scree).
        let cliff=0,talus=false;
        const cs=t.relief>15?clamp((slope-.95)/.5,0,1)*clamp((t.relief-15)/30,0,1)*clamp((riverDistance-3)/6,0,1)*clamp((noise(x*.02,z*.02,seed+949)-.36)/.12,0,1):0;
        // The band period is constant: a period that varied over the map would be multiplied by the band count (h/band, ~400
        // at 1.5 km), sliding the steps sideways a whole band per few metres and shredding faces into comb teeth. Riser
        // height varies instead through the step's sharpness.
        if(cs>0){const band=4,sharp=1.6+1.2*noise(x*.013,z*.013,seed+941),wq=(noise(x*.035,z*.035,seed+943)-.5)*band*1.6+(noise(x*.11,z*.11,seed+945)-.5)*1.2,u=h+wq,k=Math.floor(u/band),f=u/band-k;
          h+=((k+f**sharp)*band-wq-h)*cs*.7;if(f>.55)cliff=cs*clamp((f-.55)/.2,0,1);else if(f<.2&&cs>.5)talus=true;}
        if(t.relief>15&&spur>.55&&slope>.45){const b=noise(x*.3,z*.3,seed+947)*.7+noise(x*.75,z*.75,seed+948)*.3;h+=(b-.5)*1.6*clamp((spur-.55)/.4,0,1)*clamp((slope-.45)/.4,0,1);}
        // Mesa and butte walls are cliffs too.
        if(t.wall>.3)cliff=Math.max(cliff,t.wall);
        // Glaciers: in cold ground, ice fills hollows up to a smooth surface (plate relief plus a share of the crag), so
        // ridges and summits stand out of the ice fields as rock; ice thins out toward the warm margin.
        // Glacier surface follows the broad landform (the first erosion octaves): ice fills cirques and valleys carved below it.
        const C=climate(x,z),iceTop=summit(t.h+bump+low*.95-1),Tice=C.T-(cool(iceTop)-cool(t.h));
        // A volcano's crater is bare dark rock to just over the rim, free of ice.
        const crater=t.cone>20&&Math.hypot(x-t.vx,z-t.vz)<t.vr*.075+1.5+noise(x*.3,z*.3,seed+707)*2;
        // Ice is capped in thickness (thicker along erosion creases, where glaciers flow), so a glacier keeps the shape of
        // its gully or cirque instead of levelling it into a flat sheet.
        // hollow (m): depth of the ground below that broad surface: positive in cirques, gullies and cols, negative on peaks,
        // ridge crests and spurs that stand out of it. Snow gathers by it (biomeOf).
        const hollow=iceTop+1-h;
        let ice=0;if((t.relief>15||t.cone>20)&&!crater&&Tice<-2&&iceTop>h)ice=Math.min(iceTop-h,2.5+7*crease)*clamp((-2-Tice)/3,0,1);
        let iceBase=h;h+=ice;
        // Rivers sit in valleys rather than slots: the taller the ground beside a river, the wider its valley. Width follows the
        // smooth landform (not small bumps), so the valley edge, where massif tiers end, stays a clean line. Big rivers open
        // wide V valleys; creeks only notch the slope.
        // The drainage level is interpolated between coarse nodes; cap it by the broad landform (plate relief plus the lower
        // of the crag and its broad octaves, and the gully the erosion cut here, never above the ground) so water sits on the
        // valley or gully floor and cuts into the ground.
        // A channel at a lake's level (running through it, or across a low island in it) holds exactly that level.
        const held=RV.lake&&RV.level>=RV.lake-.5,floor=Math.max(SEA-1,(held?RV.lake:Math.min(RV.level,t.h+Math.min(crag,low)+Math.min(0,erosion)+.1))-1.2),valley=held?4+RV.w:6+RV.w+Math.min(70,Math.max(0,t.h+crag-floor)*1.3)*(.3+.7*clamp((RV.size-.3)/.7,0,1));
        const bt=clamp((riverDistance-2.3)/valley,0,1),bank=bt*bt*(3-2*bt);
        // Rivers and streams clear the massif from their valleys; creeks just notch through it (bank carving below).
        const L=liftAt(x,z),pass=L.pass,lift=bank<1&&RV.size>=.5?0:L.lift;
        // Gorges (the home gorge and rift seams) are cracks in the rock: a floor of irregular width (1-4 m across, wobbling
        // over ~25 m), stepped walls of 2-4 ledges 1-3 m wide up to a broken rim (a jagged outline at 0.5-1.5 m, and some
        // 1.25 m rim blocks have dropped), and talus banked against the foot of the walls.
        const gw=(noise(x*.008,z*.008,seed+227)-.5)*60,half=(.7+1.9*noise(x*.04,z*.04,seed+235))*(.8+.4*noise(x*.11,z*.11,seed+233)),wallW=1+2.2*noise(x*.07,z*.07,seed+237);
        const sx=x-gorgeX,sz=z-gorgeZ,along=clamp(sx*gorgeDX+sz*gorgeDZ,-32,32),homeGorge=Math.hypot(sx-along*gorgeDX,sz-along*gorgeDZ)+Math.sin(along*.15)*1.5;
        const faulted=(t.setting==='rift'||t.setting==='transform')&&t.f>.3;
        const gorgeDistance=lift>0||riverDistance<16||lakeL||t.base<SEA+6?Infinity:Math.min(homeGorge,faulted?Math.abs(noise((x+gw)*.006,(z-gw)*.006,seed+231)-.5)*170:Infinity);
        const blk=hash(Math.floor(x*.8),Math.floor(z*.8),seed+249),gd=gorgeDistance+(noise(x*.5,z*.5,seed+247)-.5)*.55,rimEdge=half+wallW;
        const gorge=gd<half,rock=noise(x*.02,z*.02,seed+239)>.45?'sound':'fractured';
        // Raising ground (massif tiers, knolls) raises the glacier bed with it; only ice counts as ice.
        if(lift>0){const before=h;h=Math.max(h,Math.min(h,homeLevel+2)+L.up);iceBase+=h-before;}
        const knoll=lift>0||riverDistance<14||t.h<SEA+1.5||gd<rimEdge+5||slope>.5?0:outcropAt(x,z);
        h+=knoll*1.6;iceBase+=knoll*1.6;
        // Lake basin: a bed shelving from 0.3 m at the shore to the lake's depth, flat water at the lake level. The shore
        // band holds the ground at least 0.2 m above the water (raising it only where the land would dip below the lake),
        // easing from a low beach up into the natural land.
        let underLake=false;
        if(lakeL){
          if(LD>.5){const k=clamp((LD-.5)/.3,0,1),bed=lakeL-.3-(1.5+Math.min(5,Math.sqrt(MM.lakes[t.lake].cells)*1.2))*k*k*(3-2*k);h=Math.min(h,bed);underLake=true;}
          else{const k=(.5-LD)/.4,w=clamp((LD-.1)/.15,0,1),tgt=Math.max(lakeL+.2,Math.min(h,lakeL+.2+k*k*10)),/* shore shaping only near lake level: high ground (mountain walls above a lake) is left alone, not cut down */near=h>tgt?clamp(1-(h-lakeL-12)/30,0,1):1,d=(tgt-h)*w*w*(3-2*w)*near;h+=d;if(d>0)iceBase+=d;}
        }
        // Delta fan: low marsh spreading from the apex toward the sea, sinking to sandbars and lagoons at the shore (only ever
        // lowering the land); the distributaries are carved through it below.
        const fanD=t.coast<1400&&!underLake?deltaAt(x,z,t.coast):null;
        if(fanD&&h>fanD.level){const d=(h-fanD.level)*fanD.k;h-=d;iceBase-=d;}
        // Carve the valley and the channel. Ws is the water surface; edge (m) is the distance beyond the wet edge. The bed
        // shelves from just under the water at the edge to its full depth over about half the channel, and outside it a
        // bank rises gently (0.18-0.3 m per m) from 0.25 m above the water into the valley side, never above the original
        // land, so water is always contained and banks are shallow slopes rather than dirt walls. Ground under a lake keeps
        // the lake bed (no channel grooves through the lake).
        const Ws=floor+1,edge=(riverDistance-2.3)*(RV.size||.3)-.5;
        // Nothing is carved into the seabed: channels end where the ground is already under the sea.
        let bar=false;
        if(riverDistance<999&&!underLake&&h>=SEA-.4){const before=h;
          if(edge<0){const sh=Math.max(1.2,RV.w*.45),q=clamp(-edge/sh,0,1),depth=.8+Math.min(1.6,RV.w*.12);h=Math.min(before,Ws-.12-depth*q*q*(3-2*q));}
          else{if(bank<1)h=Math.min(h,floor+(h-floor)*bank);h=Math.max(h,Math.min(before,Ws+.25+edge*(RV.size>=.6?.18:.3)));}
          // A gravel bar breaks the surface of a confluence pool, just downstream of the join on the tributary's side.
          if(RV.pool&&edge<0){const b=barAt(x,z,RV.pool,RV.dir[0],RV.dir[1]);if(b>.05){h=Math.max(h,Ws+.06+.3*b);bar=true;}}}
        if(gd<rimEdge+1.4){const F=Math.max(SEA+1,t.base-7);
          if(gorge){const ta=clamp((gd-half+1.3)/1.3,0,1);h=F+ta*ta*1.3+blk*.25;talus=ta>.25;}
          else if(gd<rimEdge){const n=2+Math.floor(noise(x*.02,z*.02,seed+251)*2.99),k=Math.floor((gd-half)/wallW*n+(noise(x*.12,z*.12,seed+253)-.5)*.5),lv=clamp(k/n,0,1);
            if(h>F)h=Math.min(h,F+(h-F)*(.15+.85*lv));cliff=1;}
          else if(blk<.3&&h>F+3)h-=.4+.8*blk/.3;}
        iceBase=Math.min(iceBase,h);
        const height=clamp(Math.floor(h/cellMetres),1,heightCells-28*density),metres=height*cellMetres,sea=metres<SEA&&!underLake&&!(edge<0&&Ws>SEA+.1&&riverDistance<999),steep=slope>.9;
        const lakeWater=underLake&&RV.lake>metres+.2&&!gorge,wet=riverDistance<12||lakeWater,T=C.T-(cool(metres)-cool(t.h)),iceCells=Math.max(0,height-Math.floor(iceBase/cellMetres));
        zone.slope=slope;zone.crease=crease;zone.hollow=hollow;zone.spur=spur;zone.x=x;zone.z=z;
        const BW=biomeWarp(x,z),bang=BW.a,breach=BW.D,CW=climateD(BW.x,BW.z),RG=region(C,x,z,CW),mountain=t.relief>15||t.cone>20;
        const glacier=!gorge&&!sea&&iceCells>=2,biome=gorge?'gorge':glacier?'glacier':biomeOf(T,C.M,sea?metres:Math.max(metres,SEA),wet,steep,slope>1.4,mountain,slope>1.8,RG);
        const water=sea?Math.round(SEA/cellMetres):lakeWater?Math.floor(RV.lake/cellMetres):edge<0&&!gorge&&Ws/cellMetres>height?Math.floor((RV.lake>floor+1&&RV.lake<floor+1.25?RV.lake:floor+1)/cellMetres):0;
        // Bare rock only where landform demands it: gorge lips, the rims of massif tiers, thin fault seams, outcrop knolls,
        // cliff-steep mountainsides and alpine ground. Plateau tops, grassland and forest stay vegetated.
        const rim=lift>0&&!pass&&[[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]].some(([u,v])=>upliftAt(x+u,z+v).up<L.up-1.5);
        // Rock knolls and spur crests break through alpine meadow and subalpine parkland along the eroded ridges.
        const tor=(biome==='meadow'||biome==='subalpine')&&slope>.4&&spur>.75+(noise(x*.09,z*.09,seed+705)-.5)*.5;
        const exposed=gd<rimEdge+.6||cliff>.3||rim||lift>0&&fault<.9&&ridge>.55||knoll>0||slope>(T>2?1.8:1.4)&&!sea&&biome!=='snow'&&!glacier||slope>1.8&&!sea&&!glacier||biome==='alpine'||tor||crater;
        // Riparian corridor: a layer over the chosen biome (biomeOf is untouched). Water feeds the land beside it, falling off
        // with distance beyond the bank, scaled by channel size (rivers ~34 m, streams ~18 m, creeks ~6 m), and only on ground
        // near the water's level (a canyon rim far above a river stays dry). Lake shores count by height above the lake.
        // corridor: the planting style, keyed on climate because the banks themselves usually read as 'wetland' (biomeOf's
        // wet flag): 'dry' oasis ribbons, 'temperate' willow banks, 'jungle' overhang, 'cold' scrub.
        let riparian=0,corridor=null,fast=false,calm=false,splash=false;
        if(RV.size>0||RV.lake){
          const sz=RV.size||.3,reach=clamp(6+40*(sz-.3),6,34),past=Math.max(0,riverDistance-2.3)*sz;
          const rise=Math.max(0,metres-floor-1),dry=1-clamp(rise/(3+reach*.25),0,1);
          if(riverDistance<999){const t=clamp(past/reach,0,1);riparian=(1-t*t*(3-2*t))*dry;}
          if(RV.lake&&!lakeWater)riparian=Math.max(riparian,clamp(1-(metres-RV.lake)/3,0,1));
          if(water>height)riparian=0;
          if(riparian>0){const Mx=C.M,b=biome;
            corridor=T<7||b==='tundra'||b==='boreal'||b==='montane'||b==='subalpine'||b==='meadow'||b==='heath'?'cold':b==='desert'||b==='badlands'||b==='steppe'||b==='savanna'||b==='golden'||Mx<.3&&T>=15?'dry':T>=19&&Mx>.5?'jungle':'temperate';}
          // Reach character from existing fields: fast (falls, steep mountain reaches) carries cobbles and boulders; calm
          // (lakes, held reaches, flat lowland water) holds lilies and cattails; splash: the spray zone around falls and springs.
          if(riverDistance<9&&!lakeWater&&!held){fast=RV.foam||RV.zone==='upper'&&RV.speed>1.2||slope>.45||t.relief>15&&slope>.25&&RV.size<.9;splash=(RV.foam||RV.spring)&&riverDistance<7;}
          calm=lakeWater||held||!fast&&slope<.2&&!RV.foam;
        }
        // Biome edge blend: biomeOf again at four points 10-24 m (warp.D) around the warped position, on a cross whose angle drifts
        // slowly (climate extrapolated by its gradient). Each re-evaluation keeps this column's height, wet/steep/mountain flags and region jitter and
        // only moves the climate, so sea, shore, snow and mountain zonation never flip (only LOWLAND results count), and a
        // riparian corridor is not a biome, so it is never a blend partner. blend: the share of samples in another lowland
        // biome, 0.5 on the border falling to 0 at that reach (bands ~20-48 m wide); biome2: the commonest such biome. Consumers draw biome2 by
        // pickBiome() (ground, scatter) or a per-tree-cell roll (trees).
        let biome2=biome,blend=0;
        if(LOWLAND.has(biome)&&!(water>height)){
          const ux=Math.cos(bang)*breach,uz=Math.sin(bang)*breach,G=CW,SR={V:0,U:0,A:0,jt:0,jm:0};let n1=0,n2=0,b1=null,b2=null;
          for(let q=0;q<4;q++){const ox=q&1?-1:1,sx=q<2?ux*ox:-uz*ox,sz=q<2?uz*ox:ux*ox;
            SR.V=RG.V+G.Vx*sx+G.Vz*sz;SR.U=RG.U+G.Ux*sx+G.Uz*sz;SR.A=RG.A+G.Ax*sx+G.Az*sz;SR.jt=RG.jt+G.Tx*sx+G.Tz*sz;SR.jm=RG.jm+G.Mx*sx+G.Mz*sz;
            const o=biomeOf(T,C.M,metres,wet,steep,slope>1.4,mountain,slope>1.8,SR);
            if(o===biome||!LOWLAND.has(o))continue;if(o===b1||!b1){b1=o;n1++;}else if(o===b2||!b2){b2=o;n2++;}}
          if(n1||n2){biome2=n2>n1?b2:b1;blend=(n1+n2)/4;}
        }
        // crease: 0-1 erosion crease (gully floors where the coarse erosion octaves converge; 0 off mountains). erosion:
        // the eroded-terrain offset (m) included in height. hollow (m): depth below the broad landform (+ hollows and cols,
        // - peaks and ridges). spur: erosion / strength, about -1.4 (gully floor) to 1.4 (spur crest); 0 off mountains.
        // surface: ground height (m) before it is quantized to cells.
        // Flow: the reach's speed, fastest mid-channel and slowing toward the banks and on the inside of bends; zero on
        // lakes. riverDepth: water depth in this column (m); riverZone: source, upper, middle, lower or estuary.
        let riverSpeed=0;
        if(riverDistance<999&&!lakeWater){const across=clamp(RV.dist/Math.max(.5,RV.w),0,1.5),mid=clamp(1-across*across,0,1),side=RV.dir[0]*(z-RV.cz)-RV.dir[1]*(x-RV.cx),
          inside=side*RV.curve>0?clamp(Math.abs(RV.curve)*60,0,1)*clamp(across,0,1):0;riverSpeed=RV.speed*(.3+.7*mid)*(1-.45*inside);}
        const riverDepth=water>height&&!sea&&!lakeWater?(water-height)*cellMetres:0;
        // Out at sea there is no river: no channel distance, width, speed, depth or zone (a mouth ends at the shore).
        const rv=!sea;
        return {height,riverDistance:rv?riverDistance:999,riparian,corridor,fast,calm,splash,lake:RV.lake,riverLevel:floor,riverWidth:rv?RV.w:0,riverSize:rv?RV.size:0,riverDir:rv?RV.dir:[0,0],riverSpeed:rv?riverSpeed:0,riverDepth,riverZone:rv&&riverDistance<999?RV.zone:null,macroRiver:rv&&RV.macro,coast:t.coast,spring:rv&&RV.spring&&riverDistance<3.4,foam:rv&&RV.foam&&riverDistance<3.4&&!gorge,bar,ridge,fault,clearing:0,exposed,wet,slope,cliff,talus,
          lift,highland:lift>0,pass,gorge,gorgeDistance,gorgeHalf:rimEdge,rock,sea,water,biome,biome2,blend,glacier,iceCells:glacier?iceCells:0,crease,erosion,hollow,spur,surface:h,cone:t.cone,setting:t.setting,temperature:T,moisture:Math.min(1,C.M+riparian*.3),relief:t.relief};
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
    // crown: round (broadleaf: a forked trunk carrying a deep lobed canopy), oval (airy birch), cone (spruce), larch
    // (open tiered cone), spire (redwood: a needle point over the trunk), umbrella (flat acacia pads), gnarled
    // (twisted, leaning lakeside tree).
    const SPECIES={
      oak:{crown:'round',bark:MAT.bark,leaf:MAT.leaf,h:[7,5],r:[3.4,.85],trunk:.6},
      jungle:{crown:'round',bark:MAT.bark,leaf:MAT.leaf,h:[9,6],r:[3.4,.85],trunk:.7},
      birch:{crown:'oval',bark:MAT.birchBark,leaf:MAT.birchLeaf,h:[6,4],r:[1.9,.6],trunk:.3},
      spruce:{crown:'cone',bark:MAT.bark,leaf:MAT.needle,h:[32,10],r:[4.6,1.15],trunk:1.35,conifer:true},
      larch:{crown:'larch',bark:MAT.bark,leaf:MAT.larch,h:[30,10],r:[4.2,1.05],trunk:1.15,conifer:true},
      redwood:{crown:'spire',bark:MAT.redwood,leaf:MAT.redwood,h:[40,10],r:[3.6,1],trunk:2.4,conifer:true},
      umbrella:{crown:'umbrella',bark:MAT.bark,leaf:MAT.acacia,h:[5,3],r:[2.4,.6],trunk:.32},
      gnarled:{crown:'gnarled',bark:MAT.bark,leaf:MAT.leaf,h:[5,3],r:[1.8,.5],trunk:.42},
      // Riparian species (corridor planting only). willow: a domed crown whose rim hangs in curtains of strands; alder: a
      // small dark round tree of cold banks; palm: a ringed, gently curving trunk under a star of drooping fronds; overhang:
      // a big jungle tree leaning out over the water, hung with vines.
      willow:{crown:'willow',bark:MAT.bark,leaf:MAT.willowLeaf,h:[5,3],r:[2.8,.6],trunk:.4},
      alder:{crown:'round',bark:MAT.bark,leaf:MAT.alderLeaf,h:[5,3],r:[2,.5],trunk:.4},
      palm:{crown:'palm',bark:MAT.palmBark,leaf:MAT.palmLeaf,h:[5,3],r:[2,.4],trunk:.24},
      overhang:{crown:'gnarled',bark:MAT.bark,leaf:MAT.leaf,h:[6,4],r:[1.6,.4],trunk:.6},
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
      subalpine:{mix:{spruce:.6,larch:.4},size:.95,bush:.05},
      tundra:{mix:{spruce:.65,birch:.35},size:.7,bush:.04},
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
    // Riparian corridor planting by style (geography's `corridor`). tree/bush: chances per 3 m cell at full rip; edge: the
    // share of water-facing cells that take a waterside tree; mix/water: species for floodplain and waterside cells; k: a
    // fixed small size (scrub).
    const HOT_DRY=new Set(['desert','badlands','savanna','golden']);
    const CORRIDOR={
      dry:{tree:.42,bush:.22,edge:.4,mix:(b,r)=>!HOT_DRY.has(b)?(r<.55?'willow':r<.75?'alder':'umbrella'):(b==='savanna'||b==='golden'?r<.5:r<.75)?'palm':'umbrella',
        water:(b,r)=>!HOT_DRY.has(b)?'willow':r<.85?'palm':'umbrella'},
      temperate:{tree:.3,bush:.2,edge:.38,mix:(b,r)=>r<.4?'willow':r<.72?'alder':'birch',water:(b,r)=>r<.75?'willow':'alder'},
      jungle:{tree:.35,bush:.18,edge:.45,mix:(b,r)=>r<.8?'jungle':'palm',water:()=>'overhang'},
      cold:{tree:.5,bush:.12,edge:.45,k:.32,mix:(b,r)=>r<.55?'willow':r<.85?'alder':'birch',water:(b,r)=>r<.6?'willow':'alder'},
    };
    const treeStyle=b=>TREE_STYLE[b]||TREE_STYLE.default;
    // Quarter-metre units times density: identical metre sizes at either cell size, always integer cells.
    const cells=m=>Math.max(1,Math.round(m*4))*density;
    // Stamped heights stay under nodeBound (ground + 50 m on low relief, +60 m where relief exceeds 15 m); crowns fit the
    // 9x9 tree-cell neighbourhood scanned for stamping (max foliage reach ~10.6 m < 12 m of unscanned-cell distance).
    const MAX_TREE=48,MAX_RADIUS=6.5;
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
    // plantBiome: the biome makeTree is planting for (growTree records it as t.biome, which picks the under-canopy floor).
    let plantBiome=null;
    function makeTree(gx,gz){
      // Near a biome edge the cell plants for its own biome or the neighbour's (pickBiome), so species, density and
      // extras from both sides mix with a share that falls off with distance from the border.
      const x=(gx+.15+.7*hash(gx,gz,seed+9))*TG,z=(gz+.15+.7*hash(gx,gz,seed+11))*TG,g=geography(x,z),b=pickBiome(g,x,z,hash(gx,gz,seed+817)),S=treeStyle(b);plantBiome=b;
      // Trees never stand on bare rock, cliff-steep ground or water, at the trunk or within 1.5 m of it (so a crown never
      // sits on a rock face). Snow and ice are allowed: the renderer gives those trees snowy crowns.
      const bare=G=>G.exposed||G.sea||G.water>G.height||G.biome==='alpine'||G.biome==='gorge'||G.slope>1.3;
      if(bare(g)||g.highland||g.gorgeDistance<g.gorgeHalf+4||spireNear(x,z,4)||landmarkNear(x,z))return null;
      for(const [u,w] of [[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]])if(bare(geography(x+u,z+w)))return null;
      // Riparian corridor (see geography): rip 0-1 and its planting style. Deserts and badlands are barren except where
      // a river or lake feeds them.
      const rip=g.riparian||0,cor=rip>0&&!TREELESS.has(b)?g.corridor:null,CS=cor&&CORRIDOR[cor];
      const patch=clamp((noise(x*.03,z*.03,seed+341)-.25)/.3,0,1),edge=1-patch,roll=hash(gx,gz,seed+23),roll2=hash(gx,gz,seed+29),barren=TREELESS.has(b)||(b==='desert'||b==='badlands')&&!(cor&&rip>.12);
      let base=S.density??TREES[b]??(TREELESS.has(b)?0:.25);
      // Ruins are overgrown: trees crowd their courtyards and stand right against the walls.
      const RU=ruinNear(x,z);if(RU&&!barren&&Math.hypot(x-RU.x,z-RU.z)<RU.reach)base=Math.max(base,.5);
      // Treeline: forest thins and shrinks over the last ~4 degrees C (about 25 m) below the line, broadleaf dropping out
      // before conifers. The line is ~1 C (it follows the climate's temperature and lapse rate), lower on steep, exposed
      // ground. Just above it, only rare stunted krummholz conifers. Applies on any ground, snow included.
      const warmth=g.temperature-1-g.slope*1.6,tl=clamp(warmth/4,0,1),tline=tl*tl*(3-2*tl);
      if(tline<=0){
        // Above the treeline, streams still carry a fringe of willow and alder scrub.
        if(cor&&warmth>-7&&b!=='snow'&&roll2<.6*rip)return growTree(roll<.6?'willow':'alder',S,g,gx,gz,x,z,{k:.22+.12*hash(gx,gz,seed+757)});
        if(warmth>-2.5&&!barren&&roll<.06*(1+warmth/2.5))return growTree('spruce',S,g,gx,gz,x,z,{k:.28+.1*hash(gx,gz,seed+751)});
        return null;
      }
      base*=tline;
      const dense=base*(.35+.65*patch),common={x,z,base:g.height,biome:b};
      const bush=(scale=1)=>Object.freeze({...common,kind:'bush',leaf:S.bushLeaf,lumps:bushLumps(x,z,gx,gz,601,scale)});
      // River and lake edges: twisted trees leaning out over the water, bushes on the bank.
      if(g.riverDistance<12||rip>.6&&g.lake){
        // Only cells that would take a lakeside plant sample their surroundings for water.
        let wx=0,wz=0;if(roll<.55&&!barren)for(const [u,w] of [[4.5,0],[-4.5,0],[0,4.5],[0,-4.5]]){const G=geography(x+u,z+w);if(G.water>G.height&&!G.sea){wx+=u;wz+=w;}}
        // Waterside trees lean out over the water: a twisted tree, or the corridor's own (palm, willow, vine-hung jungle
        // giant, cold-bank scrub).
        if(wx||wz){const lean=Math.atan2(wz,wx);
          if(roll<(CS?CS.edge:.3))return CS?growTree(CS.water(b,hash(gx,gz,seed+775)),S,g,gx,gz,x,z,{lean,maxLean:2,vines:cor==='jungle',scale:(.6+.4*tline)*(CS.scale||1),k:CS.k?CS.k+.15*hash(gx,gz,seed+757):0}):growTree('gnarled',S,g,gx,gz,x,z,{lean});
          if(roll<.55)return bush();}
        if(g.riverDistance<9)return roll2<(CS?.28:.15)&&g.riverDistance>4&&!barren?bush():null;
      }
      // Corridor planting on the floodplain beyond the bank, densest near the water and fading out with rip.
      if(CS){const r3=hash(gx,gz,seed+771),tl=cor==='cold'?Math.max(tline,.7):tline;
        if(r3<rip*CS.tree*tl)return growTree(CS.mix(b,hash(gx,gz,seed+773)),S,g,gx,gz,x,z,{scale:(.55+.45*tline)*(CS.scale||1),k:CS.k?CS.k+.2*hash(gx,gz,seed+757):0});
        if(r3<rip*(CS.tree*tl+CS.bush))return bush();}
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
      if(roll2<(c+=(S.cactus||0)*(1-rip))){
        const ht=1.4+2*hash(gx,gz,seed+61),arms=[];
        for(let i=0;i<1+Math.floor(hash(gx,gz,seed+63)*2.4);i++){const a=hash(i,gx+gz*5,seed+65)*Math.PI*2;arms.push({ux:Math.cos(a),uz:Math.sin(a),at:ht*(.3+.25*hash(i,gx,seed+67)),up:.5+.7*hash(i,gz,seed+69)});}
        return Object.freeze({...common,kind:'cactus',ht,r:.2+.06*hash(gx,gz,seed+71),arms});
      }
      if(roll2<(c+=(S.mushroom||0)*(.5+patch))){
        // One to three distinct mushrooms of falling size, spaced so their caps never touch.
        const n=1+Math.floor(hash(gx,gz,seed+73)*3),list=[],R0=1.3+.6*hash(gx,gz,seed+83);
        // Members on a slope: a member whose ground differs from the main one by more than 30% of its stem height would
        // be half-buried (or float), so it is dropped.
        for(let i=0;i<n;i++){
          const s=i===0?1:i===1?.6+.1*hash(i,gz,seed+79):.42+.08*hash(i,gz,seed+79),cr=R0*s,a=hash(i,gx+gz*3,seed+75)*Math.PI*2+i*2.1,o=i?R0+cr+.25:0;
          const mx=x+Math.cos(a)*o,mz=z+Math.sin(a)*o,base=geography(mx,mz).height,sh=cr*(1.1+.4*hash(i,gx*3+gz,seed+81));
          if(i&&Math.abs(base-list[0].base)*cellMetres>sh*.3)continue;
          list.push({x:mx,z:mz,base,cr,sr:cr*.34,sh,ct:cr*.62,spin:hash(i,gx,seed+77)*6.28});
        }
        return Object.freeze({...common,kind:'mushroom',list});
      }
      if(roll2<(c+=S.deadwood||0)){
        if(hash(gx,gz,seed+85)<.55){const a=hash(gx,gz,seed+87)*Math.PI;return Object.freeze({...common,kind:'log',ux:Math.cos(a),uz:Math.sin(a),len:2.4+2*hash(gx,gz,seed+89),r:.24+.14*hash(gx,gz,seed+91)});}
        return Object.freeze({...common,kind:'stump',r:.28+.18*hash(gx,gz,seed+93),ht:.35+.45*hash(gx,gz,seed+95)});
      }
      if(roll2<(c+=(S.bush||0)*near*1.5))return bush(.45+.35*hash(gx,gz,seed+97));
      if(roll2<(c+=(S.shrub||0)*near))return growTree(S.shrubLeaf||((S.mix.birch||0)>(S.mix.oak||0)?'birch':'oak'),S,g,gx,gz,x,z,{k:.3});
      return null;
    }
    // A tree record. Heights and radii are integer cells (quarter-metre quantized, so both cell sizes agree).
    function growTree(sp,S,g,gx,gz,x,z,o={}){
      const P=SPECIES[sp]||SPECIES.oak,C=o.k?{cls:o.cls??-1,k:o.k}:sizeClass(x,z,gx,gz),k=C.k*(S.size||1)*(o.scale||1);
      // Per-tree girth: most trunks sit near the species norm but the range runs from skinny poles (~0.5x) to real
      // veterans (~1.85x), so a stand mixes whip-thin boles with chonky ones. Big-class trees are floored fat.
      const girth=C.cls===2?1.1+.8*hash(gx,gz,seed+13):.5+Math.pow(hash(gx,gz,seed+13),1.35)*1.35;
      const hm=Math.min(MAX_TREE,(P.h[0]+P.h[1]*hash(gx,gz,seed+4))*k),rm=Math.min(MAX_RADIUS,(P.r[0]+P.r[1]*hash(gx,gz,seed+5))*k*(o.k?1.3:1));
      // Trunk girth scales with the tree's own height (allometry: a given species keeps its proportions at its mean
      // height, so a young 12 m spruce is a pole while a 40 m veteran is chonky) rather than varying free of height.
      const height=cells(hm),radius=cells(rm),t={x,z,base:g.height,biome:plantBiome,kind:'tree',species:sp,crown:P.crown,bark:P.bark,leaf:P.leaf,conifer:!!P.conifer,redwood:sp==='redwood',cls:C.cls,height,radius,trunk:Math.max(.72*density,hm*(P.trunk/P.h[0])*girth/cellMetres)};
      // Larches turn autumn gold in patches.
      if(sp==='larch'&&noise(x*.015,z*.015,seed+741)>.64)t.leaf=MAT.larchGold;
      // Biome canopy colours (autumn gold and rust, blossom pinks) for broadleaf crowns, one per tree.
      else if(S.leaf&&(P.crown==='round'||P.crown==='oval'))t.leaf=S.leaf[Math.floor(hash(gx,gz,seed+743)*S.leaf.length)];
      // Crown-overrun bound: oval crowns reach top+1.3R, round lobes ~0.8R, cones/larches a few cells — t.top must cover
      // the highest cell any crown writes, or banded columns and t.top users truncate the crown.
      let top=g.height+height+Math.ceil(radius*1.4)+4*density+1;
      if(P.crown==='umbrella'){const a=hash(gx,gz,seed+97)*Math.PI*2,d=rm*.45;t.pads=[{x,z,y:g.height+height,r:radius},{x:x+Math.cos(a)*d,z:z+Math.sin(a)*d,y:g.height+Math.round(height*.72),r:Math.max(density,Math.round(radius*.6))}];}
      if(P.crown==='gnarled'){
        const a=o.lean??hash(gx,gz,seed+99)*Math.PI*2,L=Math.min(o.maxLean??99,(.9+.8*hash(gx,gz,seed+101))*hm*.5);t.lx=Math.cos(a)*L;t.lz=Math.sin(a)*L;
        const tx=x+t.lx,tz=z+t.lz;
        t.lumps=[0,1,2].map(i=>{const b=a+(i-1)*1.5+hash(i,gx+gz,seed+103)*.4,d=i===1?0:rm*.6;return {x:tx+Math.cos(b)*d,z:tz+Math.sin(b)*d,y:g.height+height-(i===1?0:cells(.35)),r:i===1?radius:Math.max(density,Math.round(radius*.75))};});
        top+=radius;
      }
      if(P.crown==='palm'){
        // Crown offset by a gentle lean (toward the water on banks); 7-9 fronds, evenly spread with a little jitter.
        const a=o.lean??hash(gx,gz,seed+99)*Math.PI*2,L=Math.min(1,hm*.12)*(.4+.6*hash(gx,gz,seed+101)),n=7+Math.floor(hash(gx,gz,seed+141)*3),a0=hash(gx,gz,seed+143)*6.28;
        // Each frond: yaw, length 2-3.5 m, rise (initial upward slope) and droop; alternate fronds sit lower and droop more.
        // Two or three short young fronds point up from the centre.
        t.lx=Math.cos(a)*L;t.lz=Math.sin(a)*L;t.fronds=[];t.young=[];
        for(let i=0;i<n;i++){const b=a0+i*6.2832/n+(hash(i,gx*3+gz,seed+145)-.5)*.5,low=i%2===1,len=2+1.5*hash(i,gz*3+gx,seed+147);
          t.fronds.push({yaw:b,ux:Math.cos(b),uz:Math.sin(b),length:len,rise:low?.35:.75+.25*hash(i,gx,seed+149),droop:low?1.25:.9+.2*hash(i,gz,seed+151)});}
        for(let i=0;i<2+Math.floor(hash(gx,gz,seed+153)*2);i++){const b=a0+i*2.4;t.young.push({yaw:b,ux:Math.cos(b),uz:Math.sin(b),length:.9+.4*hash(i,gx,seed+155)});}
        t.frond=Math.max(...t.fronds.map(f=>f.length));t.coconuts=hash(gx,gz,seed+157)<.6;
        top+=2*density;
      }
      // Riverside jungle trees trail vines from their crowns.
      if(o.vines||sp==='jungle'&&g.riparian>.25)t.vines=true;
      // Big trees shelter a bush or two at their feet.
      if(C.cls===2&&S.bush){const a=hash(gx,gz,seed+105)*Math.PI*2,d=Math.max(.9,rm*.75);t.under=bushLumps(x+Math.cos(a)*d,z+Math.sin(a)*d,gx,gz,611,.5+.3*hash(gx,gz,seed+107));if(S.bushLeaf)t.underLeaf=S.bushLeaf;}
      t.top=top;return Object.freeze(t);
    }
    function tree(gx,gz){
      if(infinite){
        if(gallery)return galleryTreeCell(gx,gz);
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
    // Specimen gallery (options.gallery): a flat exhibit field instead of terrain, for checking props outside worldgen.
    // geography returns a fixed field; feature cells are forced only where a pad makes them legal (highland blocks ruins,
    // spires, rocks and boulders everywhere else but stamps nothing itself), and each pad is a cell whose own roll
    // produces the exhibit — so every specimen is built by the same code path as the wild.
    const GAL_H=Math.round(28/cellMetres),GAL_BOUND=140,GAL_PADS=[],GAL_ANCIENTS=new Map(),GAL_TREES=new Map(),GAL_SPOTS=[];
    const galPadAt=(x,z)=>{for(const p of GAL_PADS)if(x>=p.x0&&x<p.x1&&z>=p.z0&&z<p.z1)return p;return null;};
    function galleryGeo(x,z){
      const o=(galPadAt(x,z)||{}).over||{},biome=o.biome||'grassland';
      return {height:GAL_H,riverDistance:999,riparian:0,corridor:null,fast:false,calm:false,splash:false,lake:0,riverLevel:0,riverWidth:0,riverSize:0,riverDir:[0,0],riverSpeed:0,riverDepth:0,riverZone:null,macroRiver:false,coast:999,spring:false,foam:false,bar:0,ridge:0,fault:99,clearing:0,exposed:!!o.exposed,wet:false,slope:.05,cliff:0,talus:false,lift:0,highland:!o.open,pass:false,gorge:false,gorgeDistance:999,gorgeHalf:0,rock:0,sea:false,water:0,biome,biome2:null,blend:0,glacier:false,iceCells:0,crease:0,erosion:0,hollow:0,spur:0,surface:GAL_H*cellMetres,cone:0,setting:'',temperature:o.temperature??14,moisture:.55,relief:20};
    }
    const galleryTreeCell=(gx,gz)=>GAL_TREES.get(gx*134217728+gz)||null;
    const galleryAncientSite=(i,j)=>{const s=GAL_ANCIENTS.get(i*65536+j);return s?{x:s.x,z:s.z,g:galleryGeo(s.x,s.z),p:0}:null;};
    function buildGallery(){
      const pad=(x0,z0,x1,z1,over)=>GAL_PADS.push({x0,z0,x1,z1,over});
      const site=(i,j,S,a,b)=>[(i+.3+.4*hash(i,j,seed+a))*S,(j+.3+.4*hash(i,j,seed+b))*S];
      const put=(x,z,rec,kind,label)=>{const gx=Math.floor(x/TG),gz=Math.floor(z/TG);GAL_TREES.set(gx*134217728+gz,Object.freeze({x,z,base:GAL_H,biome:'grassland',top:GAL_H+cells(14),...rec}));GAL_SPOTS.push({kind,label,x,z});};
      // Cells near (tx,tz) whose own roll passes `test(i,j)`, nearest first.
      const scan=(S,tx,tz,test)=>{let best=null,bd=1e9;for(let j=Math.floor(tz/S)-8;j<=Math.floor(tz/S)+8;j++)for(let i=Math.floor(tx/S)-8;i<=Math.floor(tx/S)+8;i++){if(!test(i,j))continue;const d=Math.hypot((i+.5)*S-tx,(j+.5)*S-tz);if(d<bd){bd=d;best=[i,j];}}return best;};
      // Ferrite outcrop at spawn: the root survey lands here, and the ore fill shows beside it.
      pad(6,-16,20,-2,{open:true,exposed:true});GAL_SPOTS.push({kind:'outcrop',label:'ferrite outcrop',x:12,z:-8});
      // Exhibit avenue along +x: every species at young / mature / veteran size, alternating sides of the walk.
      const NATURAL={oak:'forest',birch:'forest',jungle:'rainforest',spruce:'montane',larch:'montane',redwood:'redwood',umbrella:'savanna',gnarled:'wetland',willow:'wetland',alder:'wetland',palm:'desert',overhang:'rainforest'};
      let x=26,side=1;
      for(const {sp,S:style,label} of [...SPECIES_KEYS.map(sp=>({sp})),{sp:'oak',S:'autumn',label:'oak (autumn)'},{sp:'oak',S:'blossom',label:'oak (blossom)'}]){
        const wide=SPECIES[sp].conifer||sp==='umbrella',S=treeStyle(style||NATURAL[sp]||'forest');
        for(const [k,cls,tag] of [[.55,0,'young'],[1,1,'mature'],[1.55,2,'veteran']]){
          const gx=Math.floor(x/TG),gz=Math.floor(side*(wide?10:9)/TG);
          plantBiome=style||NATURAL[sp]||'forest';const t=growTree(sp,S,galleryGeo(x,side*(wide?10:9)),gx,gz,x,side*(wide?10:9),{k,cls,vines:sp==='jungle'||sp==='overhang'});
          GAL_TREES.set(gx*134217728+gz,t);GAL_SPOTS.push({kind:'tree',label:`${label||sp} ${tag}`,x,z:side*(wide?10:9)});x+=wide?26:15;side=-side;
        }
      }
      // Ground props on the avenue shoulder.
      const FS=treeStyle('forest'),AS=treeStyle('autumn');
      put(x+4,-9,{kind:'bush',leaf:FS.bushLeaf,lumps:bushLumps(x+4,-9,Math.floor((x+4)/TG),Math.floor(-9/TG),601,1)},'prop','bush');
      put(x+12,-9,{kind:'bush',leaf:AS.bushLeaf,lumps:bushLumps(x+12,-9,Math.floor((x+12)/TG),Math.floor(-9/TG),601,1)},'prop','bush (autumn)');
      put(x+20,-9,{kind:'mushroom',list:[{x:x+20,z:-9,base:GAL_H,cr:1.8,sr:.61,sh:2.2,ct:1.12,spin:1},{x:x+23.4,z:-8,base:GAL_H,cr:1.2,sr:.41,sh:1.5,ct:.75,spin:3.2},{x:x+17.4,z:-7,base:GAL_H,cr:.8,sr:.27,sh:1,ct:.5,spin:5.1}]},'prop','mushrooms');
      put(x+30,-9,{kind:'log',ux:Math.cos(.7),uz:Math.sin(.7),len:3.4,r:.34},'prop','fallen log');
      put(x+36,-9,{kind:'stump',r:.42,ht:.7},'prop','stump');
      pad(x+42,-14,x+54,-4,{open:true,biome:'desert'});
      put(x+48,-9,{kind:'cactus',ht:2.4,r:.24,arms:[{ux:1,uz:0,at:1,up:.7},{ux:0,uz:1,at:1.5,up:.9}]},'prop','cactus');
      put(x+62,-9,{kind:'bamboo',culms:[{x:x+62,z:-9,lx:.02,lz:0,h:9,tr:.55},{x:x+63,z:-8.5,lx:0,lz:.02,h:7.5,tr:.45},{x:x+61.3,z:-8,lx:-.02,lz:0,h:8,tr:.5}],top:GAL_H+cells(10)+2},'prop','bamboo');
      // One castle, one town and one temple ruin — the cells picked are ones whose own rolls make that kind.
      const ruinKind=(i,j)=>hash(i,j,seed+461)<.45?(hash(1,i*65536+j,seed+471)<.25?'castle':hash(1,i*65536+j,seed+471)<.7?'town':'temple'):null;
      for(const kind of ['castle','town','temple']){const f=scan(STG,300,300,(i,j)=>ruinKind(i,j)===kind);if(f){const [rx,rz]=site(f[0],f[1],STG,463,465);if(Math.hypot(rx,rz)>60){pad(f[0]*STG,f[1]*STG,(f[0]+1)*STG,(f[1]+1)*STG,{open:true});GAL_SPOTS.push({kind:'ruin',label:`${kind} ruin`,x:rx,z:rz});}}}
      // Sandstone arch and hoodoos on desert pads; a spire cluster; a boulder meadow.
      const rockKind=(i,j)=>hash(i,j,seed+501)<.4?(hash(i,j,seed+507)<.45?'arch':'hoodoos'):null;
      for(const kind of ['arch','hoodoos']){const f=scan(KG,700,-80,(i,j)=>rockKind(i,j)===kind);if(f){const [rx,rz]=site(f[0],f[1],KG,503,505);if(Math.hypot(rx,rz)>60){pad(f[0]*KG,f[1]*KG,(f[0]+1)*KG,(f[1]+1)*KG,{open:true,biome:'desert'});GAL_SPOTS.push({kind:'rock',label:kind,x:rx,z:rz});}}}
      {const f=scan(SG,140,-70,(i,j)=>hash(i,j,seed+391)<.2);if(f){const [sx2,sz2]=site(f[0],f[1],SG,393,395);if(Math.hypot(sx2,sz2)>40){pad(f[0]*SG,f[1]*SG,(f[0]+1)*SG,(f[1]+1)*SG,{open:true});GAL_SPOTS.push({kind:'spire',label:'crystal spires',x:sx2,z:sz2});}}}
      pad(60,-64,140,-28,{open:true,biome:'meadow'});GAL_SPOTS.push({kind:'boulders',label:'boulder field',x:100,z:-46});
      // Two world trees: a giant sequoia on a montane pad and a blossom/coral ancient, each in a real site cell.
      {const [ax,az]=site(-1,0,AG,443,445);pad(ax-40,az-40,ax+40,az+80,{open:true,biome:'montane'});
        GAL_ANCIENTS.set(-65536,{x:ax,z:az});GAL_SPOTS.push({kind:'ancient',label:'giant sequoia',x:ax,z:az});}
      {let bc=null;for(const [i,j] of [[-1,-1],[-2,-1],[-1,-2],[-2,0],[0,-1],[-2,-2],[-3,-1],[-1,-3],[-3,0],[0,-2]])if(hash(9,i*65536+j,seed+447)<.62){bc=[i,j];break;}
        if(bc){const [bx,bz]=site(bc[0],bc[1],AG,443,445);if(Math.hypot(bx,bz)>40){pad(bx-40,bz-40,bx+40,bz+40,{open:true,biome:'forest'});GAL_ANCIENTS.set(bc[0]*65536+bc[1],{x:bx,z:bz});GAL_SPOTS.push({kind:'ancient',label:'blossom ancient',x:bx,z:bz});}}}
    }
    if(gallery)buildGallery();
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
    // colH, colSurf: the last column's ground height in cells and its unquantized surface (cells; NaN when unknown), so
    // nodes can light slopes from the exact ground instead of its 1-block steps.
    let colTop=0,colFloor=0,colH=0,colSurf=NaN,scratch=null,scratch32=null;
    // colStep: cells between sampled columns (set by node()). Plants and scatter smaller than a sampled column are skipped.
    let colStep=1,propsMode=false;
    // Stamp one plant record into the column at (x,z) whose first air cell is h. Returns one past the highest cell the
    // stamp may have written (0 if none). Plants only fill air, except trunks and culms.
    function stampPlant(t,x,z,values,h){
      const kind=t.kind||'tree',small=colStep*cellMetres>1.01;
      if(propsMode&&kind==='mushroom')return 0;
      if(kind==='tree')return stampTree(t,x,z,values,h,small);
      if(kind==='bamboo')return stampBamboo(t,x,z,values,h,small);
      if(small)return 0;
      const c=m=>Math.round(m/cellMetres),fillAir=(m,a,b)=>{b=Math.min(heightCells,b);for(let y=a;y<b;y++)if(!values[y])values[y]=m;return b;};
      if(kind==='bush')return stampLumps(t.lumps,x,z,values,h,t.leaf||MAT.bushLeaf);
      if(kind==='log'){
        const dx=x-t.x,dz=z-t.z,u=dx*t.ux+dz*t.uz,v=-dx*t.uz+dz*t.ux;if(Math.abs(u)>=t.len/2||Math.abs(v)>=t.r)return 0;
        // A straight log at its centre's ground height (rests on the hillside rather than bending with it).
        const B=t.base??h,lo=Math.max(h,B+c(t.r-Math.sqrt(t.r*t.r-v*v))),e=fillAir(MAT.bark,lo,Math.max(lo+1,B+c(t.r+Math.sqrt(t.r*t.r-v*v))));
        if(noise(u*1.3+t.x,v*3+t.z,seed+111)>.55&&values[e-1]===MAT.bark)values[e-1]=MAT.mossy;return e;
      }
      if(kind==='stump'){
        const d=Math.hypot(x-t.x,z-t.z);if(d>=t.r)return 0;const e=fillAir(MAT.bark,h,Math.max(h+1,(t.base??h)+c(t.ht)));
        if(d<t.r-.12&&values[e-1]===MAT.bark)values[e-1]=MAT.dry;return e;
      }
      if(kind==='mushroom'){
        let top=0;
        for(const m of t.list){
          const dx=x-m.x,dz=z-m.z,d=Math.hypot(dx,dz);if(d>=m.cr)continue;
          // Clean dome cap, wider than tall, its rim curling down a little; short thick stem under the centre.
          // Anchored to the mushroom's own base (not each column's ground), so caps stay level on slopes.
          const q=d/m.cr,B=m.base??h,capLow=Math.max(h,B+c(m.sh-m.ct*.3*q*q)),e=Math.min(heightCells,Math.max(capLow+1,B+c(m.sh)+Math.max(1,c(m.ct*Math.sqrt(1-q*q)))));
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
      if(crown==='gnarled')return Math.max(w,stampGnarled(t,x,z,values,leaf,bark,trunk,small));
      if(crown==='palm')return Math.max(w,stampPalm(t,x,z,values,leaf,bark,trunk));
      if(crown==='willow')return Math.max(w,stampWillow(t,x,z,values,leaf,bark,trunk,small));
      const dist=Math.hypot((x-t.x)/cellMetres,(z-t.z)/cellMetres);
      if(dist>=(crown==='umbrella'?R*1.15+1:crown==='round'?R*1.55+2*density:R+1))return w;
      const tTop=t.top||top+Math.ceil(crown==='round'?R*1.1:R*.65)+2*density+1;
      if(crown==='spire'||crown==='cone'||crown==='larch'){
        // Conifers: stacked bough tiers ("Bob Ross" trees) rather than one smooth cone. The crown runs from cell `low` up to
        // `apex` (one past the highest needle cell); span = apex - low. Tiers are counted DOWN from apex with period
        // span/5.5 (u = apex - y, tier k = floor(u/period), phase q = (u mod period)/period: 0 at a tier's top, 1 at its
        // bottom), so the renderer can shade the same tiers. Each tier's radius follows the cone envelope at its bottom
        // edge, flares outward toward that edge (a drooping skirt) and steps in by 30-45% to the tier above; a per-tier
        // hash varies size and step. The top tier is a small point. Larches are softer (smaller steps) and open.
        // Clear bole: mature and big conifers are self-pruned — bare trunk for roughly the lower third (more on the
        // biggest), so a 30 m spruce shows ~10 m of trunk before the first boughs. Young and fixed-size trees keep
        // their skirts low.
        const bole=t.cls===0?.1:t.cls===-1?.12:crown==='spire'?(t.cls===2?.5:.45):crown==='larch'?(t.cls===2?.42:.35):(t.cls===2?.4:.3);
        const low=t.base+Math.max(3*density,Math.floor(t.height*bole)),apex=top+(crown==='spire'?3:2)*density,span=apex-low;
        const period=span/5.5,id=Math.floor(t.x*7)*31+Math.floor(t.z*7),soft=crown==='larch';
        const bearing=Math.atan2(z-t.z,x-t.x);
        const tierR=(y,ang)=>{
          const u=apex-y,k=Math.floor(u/period),q=(u-k*period)/period,h1=hash(k,id,seed+131),h2=hash(k,id,seed+137);
          // Convex envelope: the crown holds near-full width through its lower tiers and narrows fast toward the tip —
          // stacked shelves, not a smooth cone. Each tier droops out to its full width early (q**1.15) and steps in hard.
          const env=R*Math.pow(Math.min(1,(k+1)/5.5),.55)*(.86+.14*h1);
          if(k===0)return ang===undefined?env*q**.8*.62:env*q**.8;
          const step=soft?.3+.12*h2:.45+.18*h2,base=env*(1-step+step*q**1.15);
          if(ang===undefined)return base*.62;
          // Each tier reaches farther in its own random directions (hemlock tiers sway most): the silhouette is ragged
          // limbs of unequal length, not a lathe of even shelves.
          const asym=(soft?.5:.4)*(hash(k,id,seed+139)-.5)*2;
          return base*(1+asym*Math.cos(ang-hash(k,id,seed+141)*6.2832));
        };
        // The trunk stops below the first height where the tiers no longer wrap it in at least a cell of needles, so it never
        // pokes out of the crown (the tier tops are the narrow points). Its foot flares into root buttresses over the
        // first ~3 m (more on bigger trees) and the bole tapers to ~55% of its base radius by the crown, like an
        // old-growth trunk.
        const flareH=Math.min(t.height*.12,Math.round(3/cellMetres));
        if(dist<trunk*2.6){let trunkTop=low;while(trunkTop<apex&&tierR(trunkTop)-.5>=trunk)trunkTop++;const tspan=Math.max(1,trunkTop-t.base);
          for(let y=t.base;y<Math.min(heightCells,trunkTop);y++){const f=clamp((y-t.base)/flareH,0,1),g=(y-t.base)/tspan,r=trunk*(1+1.6*(1-f)*(1-f))*(1-.45*g);if(dist<r)values[y]=bark;}}
        // Short dead branch stubs whisker the clear bole of grown trees (self-pruned limbs break off near the trunk).
        if(t.cls>=1&&dist<trunk+4*density){
          const nS=5+Math.floor(hash(id,7,seed+163)*4);
          for(let i=0;i<nS;i++){
            const a=hash(i,id,seed+165)*6.2832,len=1.5+2.5*hash(i,id,seed+167),sy=t.base+Math.floor((low-t.base)*(.15+.75*hash(i,id,seed+169)));
            const ux=Math.cos(a),uz=Math.sin(a),along=(x-t.x)*ux+(z-t.z)*uz;if(along<0||along>=len*cellMetres)continue;
            const u=along/(len*cellMetres),perp=Math.abs((x-t.x)*uz-(z-t.z)*ux)/cellMetres,r=(1-u)*Math.min(1.2,trunk*.45);
            if(perp>=r+.4)continue;const py=sy+Math.round(u*len*.25),hh=Math.sqrt(Math.max(0,r*r-perp*perp));
            for(let y=Math.max(t.base,Math.floor(py-hh));y<Math.min(heightCells,low,Math.ceil(py+hh)+1);y++)values[y]=bark;
          }
        }
        // Drooping tips: the outer edge of every shelf hangs a little below its line (~0.9 m on stiff conifers), so
        // crowns read as draped boughs rather than stacked plates. Below the floor, only the lowest shelf drapes.
        const droop=Math.max(1,Math.round((soft?.4:.9)/cellMetres));
        const effR=y=>{
          if(y<low)return tierR(low,bearing)*Math.max(0,1-(low-y)/(droop+1));
          let r=tierR(y,bearing);for(let dy=1;dy<=droop&&y+dy<apex;dy++){const ra=tierR(y+dy,bearing)*(1-dy/(droop+1));if(ra>r)r=ra;}return r;
        };
        // A sparse per-cell gap lets sky show between the branch platforms, like real crowns.
        const gap=soft?.3:.15;
        for(let y=Math.max(t.base+1,low-droop);y<Math.min(heightCells,apex);y++){
          if(values[y])continue;
          if(dist<effR(y)+.5&&hash(Math.floor(x*8)+y*131,Math.floor(z*8),seed+123)>gap)values[y]=leaf;
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
      // Broadleaf crown (oak and kin): a thick bole ends in a fork partway up and splits into a few
      // leaning stems; branches run out from the stems to leaf lobes at differing heights — a deep,
      // irregular canopy hanging in separate masses around the stems, not a lid on a pole.
      // Positions come from hashes so the same tree stamps identically in both worlds.
      // Canopy floor: at least ~2.5 m of clearance under a full tree (8 ft headroom), more on tall
      // trees — the crown reads as a roof overhead, not foliage walls at eye level.
      const clear=t.cls===-1?density:Math.max(Math.ceil(2.5/cellMetres),Math.round(t.height*.35));
      const tidX=Math.floor(t.x*4),tidZ=Math.floor(t.z*4);
      const forkY=t.base+Math.round(t.height*(.5+.12*hash(tidX,tidZ,seed+167)));
      // Trunk: a strong root flare tapering to the trunk radius at the fork, where it ends.
      if(dist<trunk*1.9)for(let y=t.base;y<Math.min(heightCells,forkY);y++){const f=(y-t.base)/Math.max(1,forkY-t.base);if(dist<trunk*(1+.9*(1-f)*(1-f)))values[y]=bark;}
      // Stems: 2-3 leaders rising from the fork and leaning apart; one stays near the trunk axis so
      // bark always reaches the canopy's heart. Each ends inside a high lobe.
      const a0=hash(tidX,tidZ,seed+173)*6.2832,nS=2+Math.floor(hash(tidZ,tidX,seed+169)*2),stems=[];
      for(let i=0;i<nS;i++){
        const a=a0+i*6.2832/nS+(hash(i,tidX,seed+175)-.5)*.8,o=R*(i===0?.05+.15*hash(0,tidZ,seed+177):.25+.4*hash(i,tidZ,seed+177));
        stems.push({x:t.x+Math.cos(a)*o*cellMetres,z:t.z+Math.sin(a)*o*cellMetres,y:top-Math.round(R*(.02+.3*hash(i,tidX*3,seed+179)))});
      }
      // Lobes: one crowning each stem tip, a ring at mid heights between them, and a couple of low
      // skirt lobes that drape beside the trunk under the main canopy.
      const lobes=[],nL=4+Math.floor(hash(tidX,tidZ,seed+171)*3);
      for(let i=0;i<nS;i++)lobes.push({x:stems[i].x,z:stems[i].z,y:stems[i].y+Math.round(density*.5),r:Math.max(2*density,Math.round(R*(.5+.2*hash(i,tidZ*5+tidX,seed+181)))),stem:i,at:.95});
      for(let i=0;i<nL;i++){
        const a=a0+(i+.5)*6.2832/nL+(hash(i,tidX+tidZ,seed+183)-.5)*.9,o=R*(.45+.4*hash(i,tidX,seed+185));
        lobes.push({x:t.x+Math.cos(a)*o*cellMetres,z:t.z+Math.sin(a)*o*cellMetres,y:Math.round(forkY+(top-forkY)*(.3+.6*hash(i,tidZ,seed+187))),r:Math.max(2*density,Math.round(R*(.38+.25*hash(i,tidX*3+tidZ,seed+189)))),stem:i%nS,at:.4+.3*hash(i,tidX,seed+191)});
      }
      const nSkirt=1+Math.floor(hash(tidX,tidZ,seed+193)*2);
      for(let i=0;i<nSkirt;i++){
        const a=a0+hash(i,tidZ,seed+195)*6.2832,o=R*(.15+.35*hash(i,tidX,seed+197));
        lobes.push({x:t.x+Math.cos(a)*o*cellMetres,z:t.z+Math.sin(a)*o*cellMetres,y:Math.round(forkY+(top-forkY)*(.1+.2*hash(i,tidZ,seed+199))),r:Math.max(2*density,Math.round(R*(.3+.2*hash(i,tidX*7+tidZ,seed+201)))),stem:i%nS,at:.15+.15*hash(i,tidZ,seed+203)});
      }
      // Bark: each stem runs fork→tip and a thinner branch leaves the stem partway up for every
      // other lobe. Steps follow the branch length so the bark never breaks into dashes; stamped
      // before the leaves so a wrapped limb keeps a bark heart.
      const tube=(x0,z0,y0,x1,z1,y1,r0,r1)=>{
        const steps=Math.max(8,Math.ceil(Math.hypot((x1-x0)/cellMetres,(z1-z0)/cellMetres,y1-y0)*2));
        for(let s=0;s<=steps;s++){
          const u=s/steps,px=x0+(x1-x0)*u,pz=z0+(z1-z0)*u,q=Math.hypot(x-px,z-pz)/cellMetres,r=r0+(r1-r0)*u;
          if(q>=r+.5)continue;const py=y0+(y1-y0)*Math.sqrt(u),hh=Math.sqrt(Math.max(0,r*r-q*q));
          for(let y=Math.max(t.base,Math.floor(py-hh));y<Math.min(heightCells,Math.ceil(py+hh));y++)values[y]=bark;
        }
      };
      for(const s of stems)tube(t.x,t.z,forkY,s.x,s.z,s.y,Math.max(.75*density,trunk*.7),Math.max(1,.5*density));
      for(let i=nS;i<lobes.length;i++){
        const l=lobes[i],s=stems[l.stem],u=l.at,sx=t.x+(s.x-t.x)*u,sz=t.z+(s.z-t.z)*u,sy=forkY+(s.y-forkY)*Math.sqrt(u);
        tube(sx,sz,sy,l.x,l.z,l.y,Math.max(1,.6*density),Math.max(1,.45*density));
      }
      // Lobes: squashed domes drooping below their centres with a noise-ragged rim; at fine detail
      // the edge drips a cell here and there, so the underside reads as separate boughs.
      let vineFrom=0;
      for(const l of lobes){
        const q=Math.hypot((x-l.x)/cellMetres,(z-l.z)/cellMetres);if(q>=l.r*1.2)continue;
        const r=l.r*(.85+.3*noise(x*.5,z*.5,seed+125));if(q>=r)continue;
        const hh=Math.sqrt(r*r-q*q);let lo=Math.max(t.base+clear,Math.floor(l.y-hh*.8));
        if(!small&&q>r*.5&&hash(Math.floor(x*4),Math.floor(z*4),seed+127)<.4)lo=Math.max(t.base+clear,lo-density);
        const hi=Math.min(heightCells,Math.ceil(l.y+hh*.6));
        for(let y=lo;y<hi;y++)if(!values[y])values[y]=leaf;
        if(!vineFrom||lo<vineFrom)vineFrom=lo;
      }
      if(t.vines&&!small&&vineFrom&&dist>R*.3)hangVine(x,z,values,vineFrom,t.base);
      return Math.max(w,tTop);
    }
    // A vine strand on ~22% of quarter-metre columns: hangs 0.75-3.25 m below `from` (only through air, so it stops at
    // the water surface or the ground), never lower than 0.5 m above the tree's base.
    function hangVine(x,z,values,from,base){
      const cx=Math.floor(x*4),cz=Math.floor(z*4),r=hash(cx,cz,seed+151);if(r>=.22)return;
      const to=Math.max(base+2*density,from-Math.round((.75+2.5*hash(cx,cz,seed+153))/cellMetres));
      for(let y=from-1;y>=to;y--){if(values[y])break;values[y]=MAT.vine;}
    }
    // Palm: a trunk ringed every third cell that curves toward its lean (offset grows with the square of height), and a
    // star of fronds that rise a little from the crown heart then droop, each narrow at the base, widest a third along.
    function stampPalm(t,x,z,values,leaf,bark,trunk){
      const tx=t.x+t.lx,tz=t.z+t.lz,F=t.frond,dx=x-tx,dz=z-tz,d=Math.hypot(dx,dz),top=t.base+t.height;
      if(d>F+.3&&Math.hypot(x-t.x,z-t.z)>Math.hypot(t.lx,t.lz)+trunk*cellMetres+.3)return 0;
      for(let y=t.base;y<Math.min(heightCells,top);y++){
        const f=(y-t.base)/t.height,cx=t.x+t.lx*f*f,cz=t.z+t.lz*f*f;
        if(Math.hypot((x-cx)/cellMetres,(z-cz)/cellMetres)<trunk*(1.2-.35*f))values[y]=(y-t.base)%3===2?MAT.bark:bark;
      }
      if(d>=F||propsMode)return propsMode?top:t.top;
      if(d<.3){for(let y=top-density;y<Math.min(heightCells,top+density);y++)if(!values[y])values[y]=d<.2&&y<top?MAT.palmBark:leaf;}
      // Coconuts: a small cluster just under the crown.
      if(t.coconuts&&d<.45&&d>.15){const y=top-2*density;for(let k=y;k<y+density;k++)if(!values[k])values[k]=MAT.palmBark;}
      // Fronds as thin arched strokes (1-2 voxels): up and out, then drooping; a stroke keeps the starburst from afar.
      const stroke=(f,rise,droop,thick)=>{
        const along=dx*f.ux+dz*f.uz;if(along<=0||along>=f.length)return;
        const u=along/f.length,perp=Math.abs(dx*f.uz-dz*f.ux);if(perp>=thick*(1-.5*u))return;
        const y=top+Math.round(f.length*(rise*u-droop*u*u)/cellMetres);
        for(let k=y;k<Math.min(heightCells,y+density);k++)if(k>t.base&&!values[k])values[k]=leaf;
      };
      for(const f of t.fronds)stroke(f,f.rise,f.droop,.2);
      for(const f of t.young)stroke(f,1.6,.4,.14);
      return t.top;
    }
    // Weeping willow: a low dome whose outer ring hangs in curtains of strands to near the ground (gaps between strands at
    // fine detail; solid at coarse LOD so it keeps its silhouette from afar). Strands only fill air, so over water they
    // stop at the surface.
    function stampWillow(t,x,z,values,leaf,bark,trunk,small){
      const R=t.radius,dist=Math.hypot((x-t.x)/cellMetres,(z-t.z)/cellMetres),top=t.base+t.height,O=R*1.08;
      if(dist>=O+1)return 0;
      if(dist<trunk)values.fill(bark,t.base,Math.min(heightCells,top));
      if(dist>=O)return t.top;
      // Lumpy low dome; strands from its outer two thirds, their hem scalloped by low-frequency noise so the curtain
      // reads as separate falls of leaves rather than a lampshade. A quarter of strands are a darker green for depth.
      const q=dist/O,c=Math.sqrt(1-q*q),hi=Math.min(heightCells,Math.ceil(top+R*.42*c*(.8+.4*noise(x*.9,z*.9,seed+159)))),crownLow=Math.floor(top-R*.3*c);
      let lo=crownLow,m=leaf;
      if(q>.35){const cx=Math.floor(x*4),cz=Math.floor(z*4),s=hash(cx,cz,seed+155);
        if(small||s>.4){const fall=clamp((noise(x*1.1,z*1.1,seed+161)-.2)*1.6,.15,1);
          lo=Math.max(t.base+2*density,crownLow-Math.round(t.height*(.3+.55*(q-.35)/.65)*fall*(small?.85:.55+.45*s)));if(!small&&s>.82)m=MAT.leaf;}}
      for(let y=lo;y<hi;y++)if(!values[y])values[y]=y<crownLow?m:leaf;
      return t.top;
    }
    // Twisted lakeside tree: a trunk that leans out (over the water) with a wobble, and a broad lumpy crown that droops.
    function stampGnarled(t,x,z,values,leaf,bark,trunk,small){
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
        if(t.vines&&!small&&q>r*.25)hangVine(x,z,values,Math.max(0,lo),t.base);
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
    // Cattail from cell h: a green rush stalk whose top stands 0.8-1.4 m above `from` (the water surface or the ground),
    // a 0.5 m brown head just under its tip.
    function cattail(values,h,from,r){
      const e=Math.min(heightCells,from+Math.round((.8+.6*r)/cellMetres)),hd=Math.max(1,Math.round(.5/cellMetres));
      values.fill(MAT.rush,h,e);for(let y=Math.max(h,e-1-hd);y<e-1;y++)values[y]=MAT.cattail;return e;
    }
    // b: the column's dithered surface biome (pickBiome), so decorations change with the ground across a biome edge.
    function scatter(g,x,z,values,h,b=g.biome){
      const cx=Math.floor(x*4),cz=Math.floor(z*4),r=hash(cx,cz,seed+52),r2=hash(cx,cz,seed+54),top=values[h-1]&127;
      const put=(m,n)=>{const e=Math.min(heightCells,h+Math.max(1,n));values.fill(m,h,e);return e;};
      if(g.water>h){
        if(g.sea||g.foam||values[g.water-1]!==MAT.water)return 0;
        const depth=g.water-h,still=g.calm&&(g.lake||g.riverSize<.9||g.riverDistance>1.2);
        // Water lilies: round pads 0.65-1.2 m across, flush with the surface (they replace the top water cell), gathered in
        // drifts on calm water away from the very edge. One pad per 1.6 m cell, its centre kept far enough inside the cell
        // that the disc is never clipped square; the larger pads have a narrow notch, and about a third carry a pink bloom.
        if(still&&depth>density){const n=noise(x*.13,z*.13,seed+661);
          if(n>.6){const L=1.6,lx=Math.floor(x/L),lz=Math.floor(z/L),pr=.32+.28*hash(lx,lz,seed+663);
            if(hash(lx,lz,seed+665)<clamp((n-.6)*5,0,.85)){
              const px=(lx+(pr+(L-2*pr)*hash(lx,lz,seed+667))/L)*L,pz=(lz+(pr+(L-2*pr)*hash(lx,lz,seed+669))/L)*L,dx=x-px,dz=z-pz,d=Math.hypot(dx,dz);
              const na=hash(lx,lz,seed+671)*6.2832,cut=pr>.45&&d>pr*.35&&Math.cos(Math.atan2(dz,dx)-na)>.94;
              if(d<pr&&!cut){values[g.water-1]=MAT.lilyPad;
                if(hash(lx,lz,seed+673)<.33&&Math.abs(dx)<Math.max(.25,cellMetres*.6)&&Math.abs(dz)<Math.max(.25,cellMetres*.6)){values[g.water]=MAT.lilyFlower;return g.water+1;}
                return g.water;}}}
        }
        if(depth>2*density)return 0;
        const n=noise(x*.2,z*.2,seed+641);
        // Shallows: cattails (a brown head on a green stalk) where the water is still, reeds elsewhere.
        if(still&&n>.5&&r<.08*clamp((n-.5)*3,0,1))return cattail(values,h,g.water,r2);
        if(r>=.3*clamp(n-.35,0,1))return 0;
        const e=Math.min(heightCells,g.water+Math.round((.3+.5*r2)/cellMetres));values.fill(MAT.reed,h,e);return e;
      }
      if(values[h]!==0||g.exposed)return 0;
      // Wet bank mud and marsh grass: reeds, and cattails beside still water; oasis banks carry reed beds into the grass.
      const marsh=top===MAT.mud||(b==='wetland'||b==='fen')&&(GRASSY.has(top)||top===MAT.litter||top===MAT.sphagnum)||g.corridor==='dry'&&g.riverDistance<10&&top===MAT.floodgrass;
      if(marsh){const p=clamp((noise(x*.25,z*.25,seed+643)-.35)*2.5,0,1);
        if(r<.14*p*(top===MAT.mud?1:.5))return g.calm&&r2<.4?cattail(values,h,h,r2/.4):put(MAT.reed,Math.round((.45+.6*r2)/cellMetres));
        return 0;}
      const floor=LITTER.has(top);
      if(floor||FOREST_FLOOR.has(b)&&TURF.has(top)){
        if(floor&&r>.993&&noise(x*.1,z*.1,seed+657)>.55)return put(MAT.glowFlower,density);
        // Ferns: big sword ferns crowded in clumps in damp patches, rarely alone; one plant per ~0.9 m grid cell, filling
        // most cells toward a patch's heart and growing larger there (0.5-1.25 m), with a baseline scatter so the
        // forest floor reads like the Pacific Northwest everywhere. Each plant is a single column (snapped to even
        // cells so 0.5 m sampling still finds it); the renderer draws the whole fern as one object.
        const FG=.9,fx=Math.floor(x/FG),fz=Math.floor(z/FG),patch=clamp((noise(x*.12,z*.12,seed+645)-.42)*3.2,0,1);
        if(hash(fx,fz,seed+651)<.8*patch+.08){
          const cell=2*cellMetres,cx=Math.floor((fx+.5+(hash(fx,fz,seed+653)-.5)*.5)*FG/cell),cz=Math.floor((fz+.5+(hash(fx,fz,seed+655)-.5)*.5)*FG/cell);
          if(Math.floor(x/cell)===cx&&Math.floor(z/cell)===cz)return put(MAT.fern,Math.round((.5+.3*hash(fx,fz,seed+659)+.45*patch)/cellMetres));
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
    // Riparian ground: lush floodplain grass near water fading through greener grass into the biome's own ground, its edge
    // wobbled by noise. Dry country turns into an oasis ribbon (sand and clay give way to grass); temperate and jungle banks
    // get lusher; cold banks a little greener. Only open ground is repainted (not litter, snow, rock or bank mud).
    const RIP_GROUND=new Set([...TURF,MAT.sand,MAT.dune,MAT.clay,MAT.ochre]);
    function riparianGround(g,x,z,m){
      if(!RIP_GROUND.has(m)||m===MAT.sphagnum||m===MAT.mossy)return 0;
      const s=hash(Math.floor(x*2),Math.floor(z*2),seed+783),q=g.riparian+(noise(x*.09,z*.09,seed+781)-.5)*.4+(s-.5)*.1,c=g.corridor;
      if(c==='dry'){if(q>.5)return s<.22?MAT.lushgrass:s>.93?MAT.sungrass:MAT.floodgrass;if(q>.3)return s<.5?MAT.sungrass:MAT.grass;if(q>.18)return s<.4?MAT.savgrass:0;return 0;}
      if(c==='cold'){if(q>.55)return s<.3?MAT.mossy:MAT.lushgrass;return 0;}
      if(q>.55&&TURF.has(m))return s<.3?MAT.lushgrass:MAT.floodgrass;
      if(q>.35&&(m===MAT.grass||m===MAT.sungrass||m===MAT.dry||m===MAT.steppegrass))return MAT.lushgrass;
      return 0;
    }
    // Rough mountain rock. Smooth rock slopes voxelize into regular one-block staircases that light as striped contours, so
    // exposed mountain rock (away from water and ice) is broken up in the column: strata 0.55-1.65 m thick, wandering with a
    // 2D warp, are cut back into ledges of uneven height and length (soft layers recessed, hard ones jutting); a chip field
    // of 1-3 blocks roughens every tread; at fine levels hard layers overhang the ledge below as lips. Tones follow the
    // strata and lichen speckles the treads. Talus (gully-side rock of moderate slope, below crags) is rubble instead:
    // gravel and stone with chips only. Snow and ice stay smooth. Returns the new ground top (cells); writes rockTop, the
    // highest cell written (lips included).
    let rockTop=0;
    const STRATA=1.1,stratum=k=>(k+.5*hash(k,7,seed+815))*STRATA;
    function rockTone(k,region){const t=hash(k,11,seed+825)+(region-.5)*.5;return t<.2?MAT.rockDark:t>.85?MAT.rockPale:t>.78&&region>.68?MAT.rockWarm:MAT.basalt;}
    function roughRock(g,x,z,values,h,scree=false){
      // Crag walls (gorge walls, cliff bands, mesa walls) count as steep whatever the smooth slope says.
      const s=Math.min(Math.max(g.slope,(g.cliff||0)*2.2),3),r=.35+.65*clamp((s-.2)/.8,0,1),Hm=h*cellMetres,step=colStep*cellMetres;
      const chip=((noise(x*.9,z*.9,seed+819)-.5)*2+(noise(x*2.1,z*2.1,seed+821)-.5))*.3*(.4+r);
      const talus=scree||s>.45&&s<1.15&&g.spur<-.25&&g.hollow>-2;
      // Strata follow the smooth (unquantized) surface, so ledge lines are clean contours, never one-column fins.
      const Hs=Math.min(g.surface,Hm+cellMetres),warp=(noise(x*.06,z*.06,seed+811)-.5)*3+(noise(x*.19,z*.19,seed+813)-.5)*.8,u=Hs+warp;
      let k=Math.floor(u/STRATA);if(u<stratum(k))k--;
      const depth=u-stratum(k),soft=hash(k,9,seed+817);
      const ht=clamp(Math.floor((Hs-(talus?0:r*(.2+.3*soft)*depth)+chip*(talus?.6:1))/cellMetres),Math.max(1,h-8*density),heightCells-8*density);
      if(ht<h)values.fill(0,ht,h);else if(ht>h)values.fill(MAT.basalt,h,ht);
      rockTop=ht;
      if(talus){const c=hash(Math.floor(x*2),Math.floor(z*2),seed+837);values[ht-1]=c<.3?MAT.stone:c<.4?MAT.boulder:MAT.gravel;if(ht>h)values.fill(MAT.gravel,h,ht-1);return ht;}
      // Tones through the visible riser depth, by the stratum each cell lies in.
      const region=noise(x*.035,z*.035,seed+823),D=Math.min(ht,Math.ceil((s*step+1.8)/cellMetres));
      let kk=k+1;for(let y=ht-1;y>=ht-D;y--){const uy=(y+.5)*cellMetres+warp;while(kk>-1e9&&uy<stratum(kk))kk--;values[y]=rockTone(kk,region);}
      // Lichen on treads: grey-green in patches, rust in drier regions.
      if(s<1.7&&noise(x*.4,z*.4,seed+827)>.7&&hash(Math.floor(x*4),Math.floor(z*4),seed+829)<.6)values[ht-1]=noise(x*.07,z*.07,seed+831)>.84&&hash(Math.floor(x*4),Math.floor(z*4),seed+853)<.4?MAT.lichenOrange:MAT.lichen;
      return ht;
    }
    // A column is a vertical band: cells [colFloor, colTop) are written into a reused full-height scratch; everything
    // below colFloor is bedrock (basalt) and is neither written nor read, and everything from colTop up is air. The floor
    // sits below the deepest thing a column can place under its ground (rough-rock strata tones reach ~3 sampled columns
    // of riser below the tread, ice up to its thickness, sunk boulders and ruin foundations a few metres), with margin.
    function bandFloor(h,ice=0){return infinite?Math.max(0,Math.min(h-ice,h-8*density-Math.ceil((3.2*colStep*cellMetres+2)/cellMetres))-64*density)&~7:0;}
    function column(vx,vz,into){
      const values=into||new Uint8Array(heightCells);colTop=0;colFloor=0;colSurf=NaN;
      const x=(vx+.5)*cellMetres,z=(vz+.5)*cellMetres;
      if(!infinite&&(x<0||z<0||x>=extent||z>=extent))return values;
      let t0=prof&&prof.on&&now();
      const g=geography(x,z);let h=g.height,written=h+density,top=h,scree=false;colH=h;colSurf=g.surface!=null?g.surface/cellMetres:NaN;
      if(prof&&prof.on){const t=now();prof.geography+=t-t0;t0=t;}
      colFloor=into?bandFloor(h,g.iceCells):0;
      values.fill(MAT.basalt,colFloor,Math.max(colFloor,h-4*density));
      values.fill(g.exposed?MAT.basalt:MAT.soil,Math.max(0,h-4*density),h);
      if(infinite){
        // b: this column's surface biome, dithered across biome edges (pickBiome on its 50 cm cell).
        const b=pickBiome(g,x,z,hash(Math.floor(x*2),Math.floor(z*2),seed+815)),sub=b==='desert'||b==='beach'||b==='sea'?MAT.sand:b==='badlands'?MAT.clay:MAT.soil;
        if(!g.exposed)values.fill(sub,Math.max(0,h-4*density),h);
        // Ground variety, each with a noise-wobbled edge: wet mud then sand on river banks (creeks: mud only), gravel scree on
        // steep mountain soil, and worn coarse-dirt patches in open grass.
        const wob=(noise(x*.35,z*.35,seed+611)-.5)*1.6,rd=g.riverDistance+wob;
        // Fast reaches (falls, steep mountain water) have rocky banks: cobbles with gravel and stone, then gravel; their beds are
        // cobble too.
        const cob=g.fast&&(hash(Math.floor(x*2),Math.floor(z*2),seed+787)<.3?MAT.gravel:noise(x*.6,z*.6,seed+789)>.68?MAT.stone:MAT.cobble);
        const bank=g.bar?MAT.gravel:g.water>h&&!g.sea?cob:rd<4.6?cob||MAT.mud:g.riverSize>=.6&&rd<9?(g.fast||g.riverZone==='middle'&&noise(x*.08,z*.08,seed+791)>.5?MAT.gravel:MAT.sand):0;
        values[h-1]=g.exposed?MAT.basalt:b==='glacier'?(g.temperature<-6?MAT.snow:MAT.ice):b==='snow'?MAT.snow:b==='sea'||b==='beach'?MAT.sand:bank?bank:b==='alpine'?MAT.basalt:turf(b,x,z,h,g);
        if(g.riparian>0&&!bank&&!g.exposed){const m=riparianGround(g,x,z,values[h-1]);if(m)values[h-1]=m;}
        if(TURF.has(values[h-1])){
          if(g.relief>15&&g.slope>.95+(noise(x*.3,z*.3,seed+613)-.5)*.35||g.talus){values[h-1]=MAT.gravel;scree=true;}
          else if((b==='grassland'||b==='steppe'||b==='savanna')&&noise(x*.06,z*.06,seed+615)>.93-(noise(x*.5,z*.5,seed+617)-.5)*.08)values[h-1]=MAT.dirt;
        }
        if(g.iceCells)values.fill(MAT.ice,h-g.iceCells,h);
        // Snow is a layer, not a skin: steps in snowfields and on cold glaciers (their snowy upper reaches; warmer tongues
        // show blue ice) are white down the riser too.
        if(b==='snow'&&!g.exposed||b==='glacier'&&g.temperature<-6)values.fill(MAT.snow,Math.max(0,h-(b==='snow'?4*density:Math.min(4*density,g.iceCells))),h);
        // Talus on a gorge floor: gravel with fallen stones.
        if(g.gorge&&g.talus&&g.water<=h){const c=hash(Math.floor(x*2),Math.floor(z*2),seed+839);values[h-1]=c<.35?MAT.stone:c<.45?MAT.boulder:MAT.gravel;}
        if((g.exposed&&(g.relief>15||g.cone>20||g.cliff>0)||scree)&&!g.iceCells&&!g.gorge&&g.water<=h&&g.riverDistance>6){top=h=roughRock(g,x,z,values,h,scree);written=Math.max(written,rockTop+density);}
      }else values[h-1]=g.exposed?MAT.basalt:g.riverDistance<9?MAT.sand:MAT.grass;
      if(infinite){if(g.water>h){values.fill(MAT.water,h,g.water);if(g.foam)values[g.water-1]=MAT.foam;written=Math.max(written,g.water);}}
      else if(h<24*density&&g.riverDistance<7)values.fill(MAT.water,h,24*density);
      if(prof&&prof.on){const t=now();prof.features+=t-t0;t0=t;}
      const gx=Math.floor(x/TG),gz=Math.floor(z/TG),floorWob=(noise(x*.45,z*.45,seed+619)-.5)*.45;let floorMat=9,floorBiome=null;
      for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){
        const t=tree(gx+dx,gz+dz);if(!t)continue;
        // One squared distance per candidate gates both the litter ring and the stamp call: no crown part of a tree
        // reaches past ~1.6 crown radii plus its gnarled/palm lean offset, so farther trees can be skipped without a
        // sqrt or a stampPlant entry. Other plant kinds are rare enough to stamp unconditionally.
        const ddx=x-t.x,ddz=z-t.z,d2=ddx*ddx+ddz*ddz;
        if(!t.kind||t.kind==='tree'){const reach=Math.max(t.radius?t.radius*cellMetres*1.6:0,3.8)+Math.hypot(t.lx||0,t.lz||0);if(d2>reach*reach)continue;}
        // Needle or leaf litter under trees and bamboo, a ring of bare dirt around conifers.
        if(t.radius&&t.cls!==-1||t.kind==='bamboo'){
          const f=Math.sqrt(d2)/(t.radius?t.radius*cellMetres*(t.redwood?1.5:1.05):1.9)+floorWob;
          if(f<1.12){const m=f<1?(t.conifer?0:1):t.conifer?2:3;if(m<floorMat){floorMat=m;floorBiome=t.biome;}}
        }
        const w=stampPlant(t,x,z,values,h);if(w>written)written=w;
      }
      if(prof&&prof.on){const t=now();prof.trees+=t-t0;t0=t;}
      // Under-canopy floor: podzol under conifers; under broadleaf, leaf litter in temperate woods, gold litter in autumn woods,
      // rose grass in blossom groves, dark jungle floor under rainforest and bamboo, and a shaded moss disc under lone trees in open
      // country. The fringe ring is worn dirt only around conifers (2); around other trees (3) the ground runs up to the trunk.
      // The floor follows the sheltering tree's biome (rose grass under a blossom tree even in a blend band).
      if(infinite&&floorMat<9&&(TURF.has(values[h-1])||values[h-1]===MAT.gravel)){const b=floorBiome||g.biome,m=floorMat===0?MAT.podzol:b==='autumn'?MAT.autumnlitter:b==='blossom'?MAT.pinkgrass:floorMat===2?MAT.dirt:floorMat===3?0
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
          if(A.variant==='sequoia'){
            // Podzol and needle litter under the crown, with a noisy edge.
            const f=d/A.floorR+(noise(x*.3,z*.3,seed+655)-.5)*.35;if(f<1&&TURF.has(values[h-1]))values[h-1]=f<.55?MAT.podzol:MAT.litter;
            // Trunk: flared buttressed foot with root ridges, tapering to the apex.
            const ang=Math.atan2(z-A.z,x-A.x);let ridge=0;for(const r of A.roots){const c=Math.cos(ang-Math.atan2(r.uz,r.ux));if(c>ridge)ridge=c;}
            if(d<A.R*3.4)for(let y=Math.max(0,h-1);y<Math.min(heightCells,Math.ceil(A.apex/cellMetres));y++){
              const u=y*cellMetres-A.base,flare=Math.max(0,1-u/5)**2,rad=A.R*(1-.82*clamp(u/A.H,0,1))*(1+1.1*flare*(.55+.45*ridge**6));if(d<rad)values[y]=MAT.redwood;}
            // Crown: stacked drooping tiers; each flares toward its bottom edge, then steps in to the tier above.
            if(d<A.reach)for(let y=Math.max(0,Math.floor(A.crownLow/cellMetres));y<Math.min(heightCells,Math.ceil(A.apex/cellMetres));y++){
              const Y=y*cellMetres,m=Math.min(A.tiers.length-1,Math.floor((A.apex-Y)/A.per)),T=A.tiers[m],q=(T.top-Y)/A.per;
              const rad=m===0?T.r*q**.8:T.r*(1-T.step+T.step*q**1.6),wob=(noise(x*.5+Y*.3,z*.5,seed+657)-.5)*.6;
              if(d<rad+wob&&!values[y])values[y]=MAT.needle;}
            written=Math.max(written,Math.ceil(A.top/cellMetres)+1);
          }else{
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
          for(const l of A.limbs){
            if(x<Math.min(l.x0,l.x1)-l.r0||x>Math.max(l.x0,l.x1)+l.r0||z<Math.min(l.z0,l.z1)-l.r0||z>Math.max(l.z0,l.z1)+l.r0)continue;
            for(let s2=0;s2<=l.steps;s2++){const t=s2/l.steps,px=l.x0+(l.x1-l.x0)*t,pz=l.z0+(l.z1-l.z0)*t,py=l.y0+(l.y1-l.y0)*Math.sqrt(t),r=l.r0+(l.r1-l.r0)*t,q=Math.hypot(x-px,z-pz);
              if(q<r){const hh=Math.sqrt(r*r-q*q);fill(MAT.bark,py-hh,py+hh);}}
          }
          // Blossom canopy: lumpy violet domes with white drifts and a little green, strands hanging beneath.
          const drape=hash(Math.floor(x*4),Math.floor(z*4),seed+629);
          for(const l of A.lumps){const r=l.r*(.85+.3*noise(x*.3,z*.3,seed+463)),q=Math.hypot(x-l.x,z-l.z);if(q>=r)continue;const hh=Math.sqrt(r*r-q*q)*.5;
            const a=Math.max(0,Math.floor((l.y-hh*.7-(drape<.14?1+3*drape/.14:0))/cellMetres)),b=Math.min(heightCells,Math.ceil((l.y+hh)/cellMetres));
            for(let y=a;y<b;y++)if(!values[y]){const n=noise(x*1.1+y*cellMetres*.8,z*1.1,seed+631)*.6+noise(x*.15,z*.15,seed+637)*.4;values[y]=n>.7?MAT.blossomWhite:n<.2?MAT.leaf:MAT.blossom;}}
          // Coral variant: overlapping domes with full shaded undersides around the supporting boughs.
          for(const p of A.pads){const r=p.r*(.88+.24*noise(x*.35,z*.35,seed+633)),q=Math.hypot(x-p.x,z-p.z);if(q>=r)continue;
            fill(MAT.coral,p.y-p.th*(.45+.55*Math.sqrt(1-(q/r)**2)),p.y+p.th*Math.sqrt(1-(q/r)**4));}
          // Broken pillars and wall stubs among the roots, mossy on top.
          for(const s2 of A.stones){const dx=x-s2.x,dz=z-s2.z,inside=s2.wall?Math.abs(dx*s2.ux+dz*s2.uz)<s2.hl&&Math.abs(dz*s2.ux-dx*s2.uz)<.4:Math.hypot(dx,dz)<s2.r;if(!inside)continue;
            const t=Math.min(heightCells,gTop+Math.max(1,Math.round(s2.ht*(.75+.5*noise(x*.6,z*.6,seed+635))/cellMetres)));for(let y=gTop-1;y<t;y++)values[y]=MAT.masonry;values[t-1]=MAT.mossy;written=Math.max(written,t);}
          written=Math.max(written,gTop,Math.ceil(A.top/cellMetres)+1);
          }
        }
        // Boulders and tors (blocks under half a sampled column are skipped; none at 4 m+ columns), then loose stones on
        // mountain ground at the two finest levels: one candidate per 1.5 m cell, kept inside its cell.
        if(colStep*cellMetres<2.01){const bi=Math.floor(x/BG),bj=Math.floor(z/BG),jit=hash(Math.floor(x*4),Math.floor(z*4),seed+597),half=colStep*cellMetres*.5;
          for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
            const B=boulderCell(bi+di,bj+dj);if(!B||Math.abs(x-B.x)>B.reach||Math.abs(z-B.z)>B.reach)continue;
            for(const q of B.list){if(q.r<half)continue;const sp=rockSpan(q,x,z,jit);if(!sp)continue;
              let a=Math.floor(sp[0]/cellMetres);const b=Math.min(heightCells,Math.floor(sp[1]/cellMetres)+(jit>.8?1:jit<.15?-1:0));
              // Only the foot meets the ground; elsewhere the undercut leaves a gap (solid over air) that reads as a shadow line.
              if(q.rest&&spanFoot)a=Math.min(a,Math.max(top-1,a-2*density));a=Math.max(0,a);
              // Rims thinner than two blocks are dropped: no single floating voxels.
              if(b-a>=2){values.fill(q.mat,a,b);if(q.cap&&noise(x*.7,z*.7,seed+599)>.5)values[b-1]=q.cap;else if(jit<.1)values[b-1]=MAT.lichen;written=Math.max(written,b);}}
          }}
        if(colStep*cellMetres<.51&&(g.relief>15||g.cone>20)&&!g.iceCells&&g.biome!=='snow'&&g.water<=h&&!g.riparian&&values[top]===0){
          const b=g.biome,p=g.exposed||b==='alpine'?.45:scree?.4:BOULDER_MEADOW.has(b)?.3:b==='montane'?.05:0;
          const si=Math.floor(x/1.5),sj=Math.floor(z/1.5);
          if(p&&hash(si,sj,seed+841)<p){const sx=(si+.25+.5*hash(si,sj,seed+843))*1.5,sz=(sj+.25+.5*hash(si,sj,seed+845))*1.5,sr=.15+.22*hash(si,sj,seed+847),d=Math.hypot(x-sx,z-sz)/sr;
            if(d<1){const th=Math.max(1,Math.round(sr*(.5+.5*hash(si,sj,seed+849))*Math.sqrt(1-d*d)/cellMetres+hash(Math.floor(x*4),Math.floor(z*4),seed+597)-.5));const c=hash(si,sj,seed+851);
              values.fill(c<.5?MAT.boulder:c<.8?MAT.boulderPale:MAT.stone,top,Math.min(heightCells,top+th));written=Math.max(written,top+th);}}
        }
        if(colStep*cellMetres<1.01){const ri=Math.floor(x/RG),rj=Math.floor(z/RG);
          for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
            const B=riverRockCell(ri+di,rj+dj);if(!B||Math.abs(x-B.x)>B.reach||Math.abs(z-B.z)>B.reach)continue;
            for(const q of B.list){const d=Math.hypot(x-q.x,z-q.z)/(q.r*(.85+.3*noise(x*1.3,z*1.3,seed+589)));if(d>=1)continue;
              const half=q.ry*Math.sqrt(1-d*d),a=Math.max(0,Math.floor(Math.min(q.y-half,h*cellMetres-.25)/cellMetres)),b=Math.min(heightCells,Math.ceil((q.y+half)/cellMetres));
              if(b>a){values.fill(MAT.stone,a,b);if(q.mossy&&d<.8)values[b-1]=MAT.mossy;written=Math.max(written,b);}}
          }}
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
            // Rubble: fallen stones heaped against the foot of broken stretches, out to 1.6 m from the face.
            const broken=q.rough?clamp((noise(x*.3+q.k*7.1,z*.3,seed+493)-.35)*2.2,0,1):0;
            if(!inside&&broken>.25&&q.seat!==false){
              const out=q.t==='box'?Math.abs(-(x-q.cx)*q.uz+(z-q.cz)*q.ux)-q.hw:(q.th?Math.abs(Math.hypot(x-q.cx,z-q.cz)-q.r)-q.th/2:Math.hypot(x-q.cx,z-q.cz)-q.r);
              const along=q.t==='box'?(x-q.cx)*q.ux+(z-q.cz)*q.uz:u;
              if(out>.3&&out<1.6&&(q.t!=='box'||Math.abs(along)<q.hl+.5)){
                const pile=broken*(1-out/1.6)*(.25+.6*noise(x*1.6+q.k,z*1.6,seed+519)),cells=Math.round(pile/cellMetres);
                if(cells>0&&!values[h]){values.fill(MAT.masonry,h,Math.min(heightCells,h+cells));written=Math.max(written,h+cells);}
              }
            }
            if(!inside&&!side)continue;
            let top=q.y1+(q.gable?q.gable*(1-Math.abs(u)/q.hl):0);
            // Crumbling: broken stretches drop by up to `rough`, in whole stone courses (0.45 m), with single stones missing
            // here and there along the top; intact stretches keep battlements (alternate 0.8 m merlons).
            top-=q.rough*broken;
            if(broken>0){top=Math.floor(top/.45)*.45;if(hash(Math.floor(u/.8+Math.floor(top/.45)*.5),q.k,seed+517)<.3)top-=.45;}
            if(q.crenel&&broken<.05&&Math.floor(u/.8)%2)top-=.8;
            const from=Math.max(0,Math.floor((q.seat===false?q.y0:Math.min(q.y0,ground))/cellMetres)),to=Math.min(heightCells,Math.ceil(top/cellMetres));
            if(to<=from)continue;
            if(side){
              // Ivy curtains hang from the wall top down a stretch of the face, in patches along the wall.
              // Climbing ivy creeps up from the foot of the wall in other patches.
              // Each 25 cm strand has its own length and some are missing, so curtains read as hanging strands, not stripes.
              const ivy=noise(u*.45+q.k*3.3,.5,seed+497),climb=noise(u*.5+q.k*1.7,2.5,seed+507),strand=hash(Math.floor(u*4),q.k,seed+521);
              if(ivy>=.48&&strand>.2){const len=(to-from)*(.35+.65*strand*noise(u*1.3+q.k,1.5,seed+499));for(let y=Math.max(from,Math.floor(to-len));y<to;y++)if(!values[y])values[y]=MAT.vine;}
              if(climb>=.5&&strand<.8){const up=Math.max(h,from)+Math.round((to-from)*(.1+.7*strand*noise(u*1.6+q.k,3.5,seed+511)));for(let y=Math.max(h,from);y<Math.min(to,up);y++)if(!values[y])values[y]=MAT.vine;}
              // Grass tufts crowd the corner where the wall meets the ground.
              if(!values[h]&&hash(Math.floor(x*4),Math.floor(z*4),seed+523)<.45){const n=1+Math.round(hash(Math.floor(x*4),Math.floor(z*4),seed+525)*.25/cellMetres);for(let y=h;y<Math.min(heightCells,h+n);y++)if(!values[y])values[y]=MAT.tuft;}
              written=Math.max(written,to);continue;
            }
            values.fill(MAT.masonry,from,to);written=Math.max(written,to);
            // Moss: on the wall top where it is level enough to hold soil, and in damp patches lower down. Grass tufts take
            // root in the cracks of crumbled tops.
            if(noise(x*.6+q.k,z*.6,seed+501)>.3)values[to-1]=MAT.mossy;
            if(broken>.1&&to<heightCells-2&&!values[to]&&hash(Math.floor(x*4),to*31+Math.floor(z*4),seed+527)<.35){const n=1+Math.round(hash(Math.floor(x*4),Math.floor(z*4),seed+529)*.3/cellMetres);for(let y=to;y<to+n;y++)values[y]=MAT.tuft;written=Math.max(written,to+n);}
            for(let y=from;y<to-1;y++)if(hash(Math.floor(x*4),y*7919+Math.floor(z*4),seed+503)<.12*clamp((noise(x*.4,z*.4+y*.05,seed+505)-.35)*3,0,1))values[y]=MAT.mossy;
            // Damp moss creeps up the foot of the wall from the ground.
            {const band=h+Math.round((.2+.9*noise(x*.5+q.k,z*.5,seed+513))/cellMetres);for(let y=Math.max(from,h-1);y<Math.min(to-1,band);y++)if(hash(Math.floor(x*4),y*131+Math.floor(z*4),seed+515)<.6)values[y]=MAT.mossy;}
          }
        }
      }
      if(prof&&prof.on)prof.features+=now()-t0;
      if(!infinite){if(!g.exposed&&!g.wet&&g.clearing<.5&&hash(Math.floor(vx/density),Math.floor(vz/density),seed+52)>.994&&values[h]===0)values.fill(MAT.flower,h,h+density);}
      else if(colStep*cellMetres<.51)written=Math.max(written,scatter(g,x,z,values,h,pickBiome(g,x,z,hash(Math.floor(x*2),Math.floor(z*2),seed+815))));
      // The ferrite vein fills last so later stamps (a trunk flare, litter, moss) cannot hide the whole seam; ore under a
      // root edge reads as the vein running beneath the tree.
      if(Math.hypot(x-deposit.x,z-deposit.z)<1.15&&g.exposed)values.fill(MAT.ore,h-3*density,h);
      colTop=Math.min(heightCells,written);
      return values;
    }
    const bodyCol=new Uint8Array(heightCells);
    // True when the column at (x,z) metres holds a body-solid voxel between `low` and `high` metres.
    // Walk mode tests the body capsule against this so trunks, boulders and ruin walls stop the walker.
    function blockingAt(x,z,low,high){
      bodyCol.fill(0);const v=column(Math.floor(x/cellMetres),Math.floor(z/cellMetres),bodyCol);
      for(let y=Math.max(0,Math.floor(low/cellMetres)),e=Math.min(heightCells,Math.ceil(high/cellMetres));y<e;y++)if(BODY_SOLID.has(v[y]))return true;
      return false;
    }
    // Run-encoded chunk of CHUNK x CHUNK columns. Finite worlds encode the whole column height; the streamed world encodes
    // only the chunk's vertical band [y0, y0+height): below y0 is bedrock (basalt), above it air, and run ends are local
    // to y0, so a 10 km column costs only its occupied band.
    function generateChunk(cx,cz){
      if(![cx,cz].every(n=>Number.isInteger(n)&&(!infinite||Math.abs(n)<=MAX_CHUNK)))throw new Error('Chunk coordinates exceed the supported range');
      const offs=new Array(chunkCells*chunkCells+1),ends=[],materials=[];
      if(!scratch){scratch=new Uint8Array(heightCells+8);scratch32=new Uint32Array(scratch.buffer);}else scratch.fill(0);
      const bands=[];let y0=heightCells,y1=0;
      for(let z=0;z<chunkCells;z++)for(let x=0;x<chunkCells;x++){
        const v=infinite?column(cx*chunkCells+x,cz*chunkCells+z,scratch):column(cx*chunkCells+x,cz*chunkCells+z),fl=infinite?colFloor:0,top=infinite?colTop:heightCells;
        bands.push({fl,v:v.slice(fl,top)});if(infinite)scratch.fill(0,fl,top);y0=Math.min(y0,fl);y1=Math.max(y1,top);
      }
      if(!infinite){y0=0;y1=heightCells;}y1=Math.max(y1,y0+1);
      const height=y1-y0;
      for(let i=0;i<bands.length;i++){
        const {fl,v}=bands[i],at=y=>y<fl?MAT.basalt:y-fl<v.length?v[y-fl]:0;offs[i]=ends.length;
        for(let y=y0;y<y1;){const material=at(y);let end=y+1;while(end<y1&&at(end)===material)end++;ends.push(end-y0);materials.push(material);y=end;}
      }
      offs[chunkCells*chunkCells]=ends.length;
      // High-altitude bands alternate materials enough to outgrow Uint16 offsets at fine cell sizes, so like `ends`
      // the array widens only when a chunk actually needs it.
      const offsets=ends.length>65535?Uint32Array.from(offs):Uint16Array.from(offs);
      const chunk={cx,cz,size:chunkCells,y0,height,cell:cellMetres,offsets,ends:height>255?Uint16Array.from(ends):Uint8Array.from(ends),materials:Uint8Array.from(materials)};
      chunk.bytes=chunk.offsets.byteLength+chunk.ends.byteLength+chunk.materials.byteLength;
      return chunk;
    }
    // A column's occupied band as a copy: {floor, top, values} with values[y-floor] for cells floor..top-1 (bedrock below
    // floor, air from top up).
    function columnBand(vx,vz){
      if(!scratch){scratch=new Uint8Array(heightCells+8);scratch32=new Uint32Array(scratch.buffer);}else scratch.fill(0);
      if(!infinite){const v=column(vx,vz);return {floor:0,top:heightCells,values:v};}
      const v=column(vx,vz,scratch),floor=colFloor,top=colTop,out={floor,top,values:v.slice(floor,top)};scratch.fill(0,floor,top);return out;
    }
    // Streamed LOD nodes: level L samples one world column every 2^L cells, so a node of NODE x NODE columns covers
    // NODE*2^L cells per side. Every level is real voxels (trees, spires, isles included), built at its own spacing
    // rather than generated at full resolution and thrown away.
    // MAX_LEVEL covers the 8 km zoom-out (autoLevel requests ~8 there) and lets distant walk rings go coarse and cheap.
    const NODE=32,MAX_LEVEL=Math.round(Math.log2(64/cellMetres)),nodeMetres=L=>NODE*cellMetres*2**L;
    // Upper bound on anything a node can hold (ground, trees, spires, isles), so a view only requests nodes that can reach it.
    const bounds=new Map();
    function nodeBound(L,nx,nz){
      if(!infinite)return heightCells*cellMetres;
      const k=L+':'+nx+':'+nz;let v=bounds.get(k);if(v!==undefined)return v;
      const m=nodeMetres(L),n=m>64?4:2,x0=nx*m,z0=nz*m;v=SEA+12;
      // Ground plus the most crag, erosion, bump and ice could add there, trees on top, and a margin for relief peaking
      // between the samples.
      for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const t=tectonics(x0+m*i/n,z0+m*j/n),A=Math.max(cragRelief(t.relief),t.cone*.3)*.6;
        v=Math.max(v,Math.max(t.h,SEA)+A*1.4+1.6*erosionStrength(t,x0+m*i/n,z0+m*j/n)+(t.relief>15?60:50)+(t.relief>0?Math.min(m*.15,30):0));}
      for(let j=Math.floor(z0/IG);j<=Math.floor((z0+m)/IG);j++)for(let i=Math.floor(x0/IG);i<=Math.floor((x0+m)/IG);i++){const I=isleCell(i,j);if(I)v=Math.max(v,I.top+3);}
      for(let j=Math.floor((z0-16)/AG);j<=Math.floor((z0+m+16)/AG);j++)for(let i=Math.floor((x0-16)/AG);i<=Math.floor((x0+m+16)/AG);i++){const A=ancientCell(i,j);if(A)v=Math.max(v,A.top+2);}
      if(gallery)v=Math.max(v,GAL_BOUND);
      v=Math.min(v,heightCells*cellMetres);bounds.set(k,v);if(bounds.size>16384)bounds.delete(bounds.keys().next().value);return v;
    }
    const heightBound=(cx,cz)=>nodeBound(Math.log2(CHUNK*density/NODE),cx,cz);
    // Upper bound on any content in the whole world (m): the macro map's highest ground plus room for crags, erosion,
    // trees and sky isles. Views and picking scan no higher than this instead of the 10 km world ceiling.
    let contentCeiling=0;
    function contentTop(){
      if(!infinite)return heightCells*cellMetres;
      if(gallery)return GAL_BOUND;
      if(!contentCeiling){let m=SEA;for(const h of MM.heights)m=Math.max(m,MacroLib.metres(h));contentCeiling=Math.min(heightCells*cellMetres,Math.max(m*1.25,2900)+300);}
      return contentCeiling;
    }
    // Vertical slices (3D chunks): every level splits its columns into slices of SLICE blocks, so slice k of level L holds
    // blocks [k*SLICE, (k+1)*SLICE) (cells [k*SLICE*2^L, ...)) and slices nest across levels like an octree. A node builds
    // its footprint once (one sampled column per block column, each kept only as the band from its bedrock top to its
    // highest cell) and returns only the slices that hold faces: empty air above and solid rock below cost nothing. Slice
    // mesh y is local to the slice (Uint16 blocks, 0..SLICE); the slice origin is `y` (blocks) on each slice record. The
    // 2D outputs (hillshade, canopy, biome, water) and the props stay per footprint, in absolute blocks / metres.
    const SLICE=128;
    function node(L,nx,nz,options={}){
      if(!infinite)throw new Error('LOD nodes are only generated for the streamed world');
      if(!(Number.isInteger(L)&&L>=0&&L<=MAX_LEVEL)||![nx,nz].every(Number.isInteger))throw new Error('Invalid LOD node');
      const s=2**L,P=NODE+2,G=NODE+4,cols=new Array(P*P),colY0=new Int32Array(P*P),tops=new Int32Array(P*P),grounds=new Int32Array(G*G),fine=new Float32Array(G*G),canopy=new Int32Array(G*G),water=new Float32Array(G*G),grassy=new Uint8Array(G*G),grassMat=new Uint8Array(G*G),snowy=new Uint8Array(G*G);let ny=1,reduce=0;
      prof={geography:0,trees:0,features:0,on:false};let sampled=0;colStep=s;propsMode=!!options.props;
      // Lighting height of the column just sampled, in blocks: its exact surface where the ground is bare terrain (top block at
      // the terrain height), else the block ground (boulders, ruins, water). The exact height is offset by the mean amount the
      // block ground rounds up ((s-2)/2s blocks), so the two kinds sit level beside each other.
      const fineGround=gb=>colSurf===colSurf&&gb===Math.floor((colH-1)/s)+1?(colSurf+s/2-1)/s:gb;
      // One sampled column per block column, reduced vertically by keeping each block's top occupied material. The column
      // scratch is reused: only the band [colFloor, colTop) was written, so only that is scanned and cleared.
      if(!scratch){scratch=new Uint8Array(heightCells+8);scratch32=new Uint32Array(scratch.buffer);}else scratch.fill(0);
      const buf=scratch,buf32=scratch32,floor=new Int32Array(P*P),BASALT=MAT.basalt;
      const blockAt=(k,y)=>{const y0=colY0[k];if(y<y0)return BASALT;const b=cols[k];return y-y0<b.length?b[y-y0]:0;};
      for(let j=0;j<P;j++)for(let i=0;i<P;i++){
        prof.on=((i+j)&3)===0;if(prof.on)sampled++;
        const c=column((nx*NODE+i-1)*s+(s>>1),(nz*NODE+j-1)*s+(s>>1),buf),lim=colTop,fl=colFloor,t0=prof.on&&now();
        let hi=lim-1;while(hi>=fl&&!c[hi])hi--;
        // The column's bedrock run (basalt from the band floor up) is whole basalt blocks, kept implicit below y0; only the
        // cells above it are read one by one, so tall mountain columns cost little more than lowland ones.
        const run=basaltRun(c,buf32,hi+1,fl),full=Math.floor(run/s),top=hi>=full*s?((hi/s)|0)+1:full,b=new Uint8Array(top-full);
        for(let y=full*s;y<=hi;y++){const m=c[y];if(m)b[((y/s)|0)-full]=m;}
        const k=j*P+i;cols[k]=b;colY0[k]=full;
        const kk=(j+1)*G+i+1;grounds[kk]=groundBlocks(c,lim,s,run);fine[kk]=fineGround(grounds[kk]);canopy[kk]=top;water[kk]=waterDepth(c,lim);{const m=top>0?blockAt(k,top-1)&127:0;grassy[kk]=BLADE_GRASS.has(m)?1:0;grassMat[kk]=grassy[kk]?m:0;const gm=grounds[kk]>0?blockAt(k,grounds[kk]-1)&127:0;snowy[kk]=gm===MAT.snow||gm===MAT.ice||m===MAT.snow||m===MAT.ice?1:0;}c.fill(0,fl,lim);let f=full;while(f<top&&b[f-full])f++;
        tops[k]=top;floor[k]=f;if(prof.on)reduce+=now()-t0;
        if(i>0&&j>0&&i<=NODE&&j<=NODE)ny=Math.max(ny,top);
      }
      // Hillshade sees one ring further than the mesh halo, so its blur matches across node borders.
      for(let j=0;j<G;j++)for(let i=0;i<G;i++)if(i===0||j===0||i===G-1||j===G-1){const c=column((nx*NODE+i-2)*s+(s>>1),(nz*NODE+j-2)*s+(s>>1),buf),lim=colTop,fl=colFloor;grounds[j*G+i]=groundBlocks(c,lim,s,basaltRun(c,buf32,lim,fl));fine[j*G+i]=fineGround(grounds[j*G+i]);let h=lim-1;while(h>=fl&&!c[h])h--;canopy[j*G+i]=h<0?0:((h/s)|0)+1;water[j*G+i]=waterDepth(c,lim);grassy[j*G+i]=h>=0&&BLADE_GRASS.has(c[h]&127)?1:0;grassMat[j*G+i]=grassy[j*G+i]?c[h]&127:0;{const gy=grounds[j*G+i]*s-1,gm=gy>=0?c[gy]&127:0,tm=h>=0?c[h]&127:0;snowy[j*G+i]=gm===MAT.snow||gm===MAT.ice||tm===MAT.snow||tm===MAT.ice?1:0;}c.fill(0,fl,lim);}
      // Skirt: halo columns stop two blocks below the lower of themselves and the adjacent inside column, so every
      // border carries a short wall that covers height mismatches against a coarser or finer neighbour.
      const limits=new Int32Array(P*P);let low=ny;
      for(let j=0;j<P;j++)for(let i=0;i<P;i++){const k=j*P+i,inside=i>0&&j>0&&i<=NODE&&j<=NODE;limits[k]=Math.min(ny,inside?ny:Math.max(0,Math.min(tops[k],tops[clamp(j,1,NODE)*P+clamp(i,1,NODE)])-2));low=Math.min(low,floor[k],limits[k]);}
      // Below the lowest air in any column every block is solid and has no visible face: mesh from just under it, with a
      // solid layer beneath so no bottom faces are emitted. Dense layer d holds block base-1+d.
      const base=Math.max(0,low-1),span=ny-base,plane=P*(span+2),dense=new Uint8Array(P*plane);
      for(let j=0;j<P;j++)for(let i=0;i<P;i++){
        const k=j*P+i,b=cols[k],y0=colY0[k],o=j*plane+i;dense[o]=1;
        for(let y=base;y<limits[k];y++)dense[o+(y-base+1)*P]=y<y0?BASALT:b[y-y0];
      }
      colStep=1;propsMode=false;const scale=P*P/Math.max(1,sampled),timing={geography:prof.geography*scale,trees:prof.trees*scale,features:prof.features*scale,reduce:reduce*scale};prof=null;const t1=now(),detail=options.props!==false,none=new Float32Array(0),flowers=detail?flowerProps(L,nx,nz,dense,P,plane,base,span):none,stalks=detail?stalkProps(L,nx,nz,dense,P,plane,base,span):new Float32Array(0);
      // Slices: greedy meshing runs per slice over a window of the footprint's dense volume (the rows just above and below
      // the window take part, so each face between two slices is emitted exactly once); Surface Nets runs once over the
      // footprint and each quad goes to the slice holding its owned edge, so slice seams close exactly.
      const SL=options.sliceBlocks||SLICE,voxels=options.smooth?objectsOnly(dense):dense,byK=new Map(),k0=Math.floor(base/SL),k1=Math.floor((ny-1)/SL);
      for(let k=k0;k<=k1;k++){const a=Math.max(base,k*SL),e=Math.min(ny,(k+1)*SL);if(e<=a)continue;const m=greedy(voxels,NODE,span,NODE,a-k*SL,{y0:a-base+1,h:e-a});if(m.count)byK.set(k,{y:k*SL,...m});}
      if(options.smooth)for(const [k,m] of surfaceNets(cols,colY0,tops,grounds,fine,G,P,base,SL)){const r=byK.get(k)||{y:k*SL,buffer:new ArrayBuffer(0),count:0,quads:0,exposedFaces:0};r.smooth=m;byK.set(k,r);}
      const slices=[...byK.keys()].sort((a,b)=>a-b).map(k=>byK.get(k));timing.mesh=now()-t1;
      return {slices,slice:SL,base,flowers,stalks,skirts:detail?sequoiaSkirts(L,nx,nz):new Float32Array(0),fronds:detail?frondProps(L,nx,nz):new Float32Array(0),mushrooms:detail?mushroomProps(L,nx,nz):new Float32Array(0),...hillshade(grounds,fine,G),rockDetail:L<=2?rockDetail(fine,G,rockColumns(cols,colY0,grounds,P,G),P,L,nx,nz):new Uint8Array(0),...canopyShade(canopy,grounds,grassy,G),...(()=>{const biome=biomeTint(L,nx,nz,grassy,grassMat,snowy,G,water);return {biome,waterMap:waterMap(L,nx,nz,water,G),grass:detail?grassTufts(L,nx,nz,tops,grounds,P,grassy,G,biome):new Float32Array(0)};})(),leaves:detail?leafCards(L,nx,nz,dense,P,plane,base,span,snowy,G):new Float32Array(0),normalSize:NODE,level:L,nx,nz,column:cellMetres*s,top:ny,timing};
    }
    // Canopy shape per inside column (RGBA8: x, z of a broad, smoothed normal of the top surface including trees; canopy
    // top in blocks above the column's ground, capped at 255; grass cover, the 5×5 share of grass-topped columns, which
    // the shader turns into a noisy, soft border wherever grass meets other ground). Lit by this instead of their block faces, leaves read as
    // soft rounded crowns, and the depth below the crown top darkens their undersides.
    function cover(grassy,G,I,J){let n=0;for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++)n+=grassy[(J+b)*G+I+a];return n/25;}
    function canopyShade(tops,grounds,grassy,G){
      const N=G-4,T=(i,j)=>tops[j*G+i],out=new Uint8Array(N*N*4);
      for(let j=0;j<N;j++)for(let i=0;i<N;i++){
        const I=i+2,J=j+2;let x=0,z=0;
        for(let b=-1;b<=1;b++){x+=T(I+2,J+b)-T(I-2,J+b)+T(I+1,J+b)-T(I-1,J+b);z+=T(I+b,J+2)-T(I+b,J-2)+T(I+b,J+1)-T(I+b,J-1);}
        x/=18;z/=18;const l=Math.hypot(x,1,z),o=(j*N+i)*4;
        out[o]=Math.round(128-127*x/l);out[o+1]=Math.round(128-127*z/l);out[o+2]=clamp(T(I,J)-grounds[J*G+I],0,255);out[o+3]=Math.round(cover(grassy,G,I,J)*255);
      }
      return {canopy:out};
    }
    // Giant sequoia crowns as bough skirts, from the hero tree's tier data: one record per tier, in node-local metres:
    // crown centre x, z, tier top, tier bottom; radius at the bottom, radius at the top (stepped in), seed. Listed by the
    // node holding the trunk, at every level (the giant is visible from afar).
    function sequoiaSkirts(L,nx,nz){
      const m=NODE*cellMetres*2**L,x0=nx*m,z0=nz*m,A=landmarksAt0(x0+m/2,z0+m/2);
      if(!A||A.variant!=='sequoia'||!A.tiers||A.x<x0||A.x>=x0+m||A.z<z0||A.z>=z0+m)return new Float32Array(0);
      const cx=(A.cx??A.x)-x0,cz=(A.cz??A.z)-z0,out=[];
      A.tiers.forEach((t,k)=>out.push(cx,cz,t.top,t.bottom,t.r,t.r*(1-(t.step||.35)),k*.137+(A.x%1),0));
      return Float32Array.from(out);
    }
    const landmarksAt0=(x,z)=>infinite?ancientNear(x,z):null;
    // Palm fronds as objects (props mode skips palm crown voxels): one record per frond, in node-local metres: crown top
    // x, y, z, yaw, pitch, droop, length, and 1 for a young upright frond (0 otherwise).
    function frondProps(L,nx,nz){
      const column=cellMetres*2**L;if(column>2)return new Float32Array(0);
      const m=NODE*column,x0=nx*m,z0=nz*m,out=[];
      for(const p of palmsNear(x0+m/2,z0+m/2,m*.71)){
        if(p.x<x0||p.x>=x0+m||p.z<z0||p.z>=z0+m)continue;const [cx,cy,cz]=p.crownTop;
        for(const f of p.fronds)out.push(cx-x0,cy,cz-z0,f.yaw,f.pitch,f.droop,f.length,0);
        for(const f of p.young||[])out.push(cx-x0,cy,cz-z0,f.yaw,f.pitch,0,f.length,1);
      }
      return Float32Array.from(out);
    }
    // Mushroom objects (the generator skips their voxels in props mode): x, base y, z in node-local metres, then cap radius,
    // cap height, stem radius, stem height and spin. Only where a mushroom spans a few pixels (columns up to 1 m).
    function mushroomProps(L,nx,nz){
      const column=cellMetres*2**L;if(column>1)return new Float32Array(0);
      const m=NODE*column,x0=nx*m,z0=nz*m,out=[];
      for(const r of mushroomsNear(x0+m/2,z0+m/2,m*.71))if(r.x>=x0&&r.x<x0+m&&r.z>=z0&&r.z<z0+m)out.push(r.x-x0,r.base,r.z-z0,r.capRadius,r.capHeight,r.stemRadius,r.stemHeight,r.spin);
      return Float32Array.from(out);
    }
    // Flower props for close views: each column's flower voxels are taken out of the mesh and listed once as x, base y, z
    // (node-local blocks) and material + 0–1 seed, drawn as a stemmed flower that sways with the grass.
    function flowerProps(L,nx,nz,dense,P,plane,base,span){
      if(cellMetres*2**L>.5)return new Float32Array(0);const out=[];
      for(let j=1;j<=NODE;j++)for(let i=1;i<=NODE;i++){
        let low=-1,m=0;
        for(let y=base;y<base+span;y++){const k=j*plane+(y-base+1)*P+i,v=dense[k]&127;if(FLOWERS.has(v)){if(low<0){low=y;m=v;}dense[k]=0;}}
        if(low>=0)out.push(i-.5,low,j-.5,m+hash(nx*NODE+i,nz*NODE+j,seed+131)*.999);
      }
      return Float32Array.from(out);
    }
    // Stalk objects: each vertical run of a thin-plant material in a column is taken out of the mesh and listed as x, base
    // y, z (node-local blocks), material + 0–1 seed, then height in blocks and whether a cattail head tops it.
    function stalkProps(L,nx,nz,dense,P,plane,base,span){
      const out=[];
      for(let j=1;j<=NODE;j++)for(let i=1;i<=NODE;i++){
        let start=-1,m=0,head=0;
        for(let y=base;y<=base+span;y++){
          const k=j*plane+(y-base+1)*P+i,v=y<base+span?dense[k]&127:0;
          if(y<base+span&&STALKS.has(v)){if(start<0){start=y;m=v===MAT.cattail?MAT.rush:v===MAT.bambooNode?MAT.bamboo:v;head=0;}if(v===MAT.cattail)head=1;dense[k]=0;continue;}
          if(start>=0){out.push(i-.5,start,j-.5,m+hash(nx*NODE+i,nz*NODE+j+start,seed+137)*.999,y-start,head,0,0);start=-1;}
        }
      }
      return Float32Array.from(out);
    }
    // Leaf cards for close views: on leaf and needle blocks at the outside of a crown, about 3.5 per square metre of
    // crown surface (twice that for the smaller conifer sprigs). Each card is x, y, z (block centre, node-local blocks), material + 0–1 seed; then the outward direction (from the
    // empty space in its 3×3×3 neighbourhood) and a size in metres, +10 for needles, +20 per level of snow cover (0–3).
    function leafCards(L,nx,nz,dense,P,plane,base,span,snowy,G){
      const column=cellMetres*2**L,out=[];if(column>.5)return new Float32Array(0);
      const chance=Math.min(1,3.5*column*column),at=(i,y,j)=>dense[j*plane+(y-base+1)*P+i];
      for(let j=1;j<=NODE;j++)for(let i=1;i<=NODE;i++)for(let y=base;y<base+span;y++){
        const m=at(i,y,j)&127;if(!LEAVES.has(m)&&!NEEDLES.has(m))continue;
        if(at(i-1,y,j)&&at(i+1,y,j)&&at(i,y-1,j)&&at(i,y+1,j)&&at(i,y,j-1)&&at(i,y,j+1))continue;
        // Ivy hangs in a thin strip against ruin walls and cliffs: leaf within two blocks of rock gets no card, so walls
        // stay readable under their own voxel ivy instead of vanishing under tree-sized clumps.
        let wall=false;for(let r=1;r<=2&&!wall;r++)for(const [a,c] of [[r,0],[-r,0],[0,r],[0,-r]])if(ROCKS.has(at(clamp(i+a,0,P-1),y,clamp(j+c,0,P-1))&127)){wall=true;break;}
        if(wall)continue;
        const gx=nx*NODE+i-1,gz=nz*NODE+j-1,h=hash(gx*131+y,gz,seed+L*577+81);if(h>=(NEEDLES.has(m)?Math.min(1,chance*2):chance))continue;
        let ox=0,oy=0,oz=0;
        for(let c=-1;c<=1;c++)for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++)if(!at(i+a,y+b,j+c)){ox+=a;oy+=b;oz+=c;}
        const l=Math.hypot(ox,oy,oz);if(!l)continue;
        const pine=NEEDLES.has(m),size=(pine?.45:1.15)+(pine?.2:.55)*hash(gx,gz*7+y,seed+83);
        out.push(i-.5,y+.5,j-.5,m+hash(gx,gz+y*17,seed+82)*.999,ox/l,oy/l,oz/l,size+(pine?10:0)+20*Math.round(cover(snowy,G,i+1,j+1)*3));
      }
      return Float32Array.from(out);
    }
    // Biome tint per inside column (RGBA8: the biome's grass tone (deep forest green vs bright meadow), and in alpha the open
    // water depth (1/32 m steps, up to 8 m); snow cover in the 5×5 around it, the local blade-grass material): how much the local forest is conifer rather
    // than broadleaf, from the same biome and temperature rule as the trees. Sampled on a fixed 16 m world grid and
    // interpolated, so neighbouring nodes agree and forests blend over tens of metres. Grass and ground take their tone
    // from it: deep blue-green among conifers, bright warm green among broadleaf trees.
    const TINT=16,tints=new Map();
    // Grass tone per biome, 0 = bright open meadow to 1 = deep, cool forest floor green.
    const GRASS_TONE={redwood:1,boreal:.9,montane:.85,rainforest:.75,bamboo:.6,subalpine:.6,fen:.6,tundra:.55,wetland:.5,forest:.5,heath:.45,autumn:.35,blossom:.2,meadow:.15,steppe:.1,flowers:.05,grassland:0,savanna:0,golden:0,pinkgrass:0,desert:0,badlands:0,beach:0};
    function coniferAt(i,j){
      const k=i*65536+j;let v=tints.get(k);if(v!==undefined)return v;const g=geography(i*TINT,j*TINT);
      v=GRASS_TONE[g.biome]??.3;
      tints.set(k,v);if(tints.size>65536)tints.delete(tints.keys().next().value);return v;
    }
    // The grass growing around a column: its own blade grass, else the commonest one in the 5×5 around it, else plain grass.
    // The grass of a column, or the commonest within two columns; failing that (deep under canopy) the node's commonest
    // grass, so undergrowth and soil there still take the biome's colour rather than a default green.
    function dominantGrass(grassMat){const n=new Map();let best=MAT.grass,most=0;for(const m of grassMat)if(m){const c=(n.get(m)||0)+1;n.set(m,c);if(c>most){most=c;best=m;}}return best;}
    function localGrass(grassy,grassMat,G,I,J,fallback=MAT.grass){
      const k=J*G+I;if(grassMat[k])return grassMat[k];const n=new Map();let best=fallback,most=0;
      for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++){const m=grassMat[(J+b)*G+I+a];if(m){const c=(n.get(m)||0)+1;n.set(m,c);if(c>most){most=c;best=m;}}}
      return best;
    }
    // Depth of open water at the top of a column, in metres (0 where the surface is land or rock; water under a lily pad counts).
    function waterDepth(c,lim){let y=lim-1;while(y>=0&&!c[y])y--;
      // Lily pads float: the water beneath still counts, so drifts of pads do not ring themselves with foam.
      while(y>=0&&((c[y]&127)===MAT.lilyPad||(c[y]&127)===MAT.lilyFlower))y--;let n=0;
      // Foam stamped on rapids is water too (the renderer draws the white water itself).
      while(y>=0&&(c[y]&127)===MAT.foam){n++;y--;}while(y>=0&&(c[y]&127)===MAT.water){n++;y--;}return n*cellMetres;}
    // Water map per inside column (RGBA8): open-water depth (1/32 m, up to 8 m), distance to the nearest shore within two
    // columns (1/64 m, up to 4 m), and the river's flow (x, z; 0.5 = still water; direction downstream, length the speed: calm pools to rapids), smoothed on an 8 m grid.
    const FLOW=8,flows=new Map();
    function flowAt(i,j){
      const k=i*65536+j;let v=flows.get(k);if(v)return v;const x=i*FLOW,z=j*FLOW,g=geography(x,z);v=[0,0];
      // Open sea has no river current (the generator's river data runs on past the mouth); estuaries flow gently.
      if(g.sea){flows.set(k,v);return v;}
      // Prefer the generator's own river data (direction and speed stored along each river) when it provides them.
      if(g.riverDir&&g.riverSpeed!==undefined&&g.riverWidth>0&&Math.abs(g.riverDistance)<g.riverWidth*1.5+6){const sp=g.riverZone==='estuary'?Math.min(.45,g.riverSpeed*.4):clamp(g.riverSpeed,0,1);v=[g.riverDir[0]*sp,g.riverDir[1]*sp];}
      else if(g.riverWidth>0&&Math.abs(g.riverDistance)<g.riverWidth*1.5+6){
        const gx=geography(x+2,z).riverDistance-geography(x-2,z).riverDistance,gz=geography(x,z+2).riverDistance-geography(x,z-2).riverDistance,l=Math.hypot(gx,gz);
        if(l>1e-6){let dx=-gz/l,dz=gx/l;const ahead=geography(x+dx*4,z+dz*4).riverLevel,behind=geography(x-dx*4,z-dz*4).riverLevel;if(ahead>behind){dx=-dx;dz=-dz;}
          // Speed 0–1: every river flows (base 0.4), rising with the drop along the course (about 1 m in 80 m is full speed)
          // and where the channel narrows. Stored as the flow vector's length; lakes have none.
          const speed=clamp(.4+Math.abs(behind-ahead)/8/.012*.6+clamp((6-g.riverWidth)/6,0,1)*.25,0,1);v=[dx*speed,dz*speed];}
      }
      flows.set(k,v);if(flows.size>65536)flows.delete(flows.keys().next().value);return v;
    }
    function waterMap(L,nx,nz,water,G){
      const column=cellMetres*2**L,x0=nx*NODE*column,z0=nz*NODE*column,out=new Uint8Array(NODE*NODE*4);
      for(let j=0;j<NODE;j++)for(let i=0;i<NODE;i++){
        // No shore within the two-column ring means it is further than we can see here: record it as far (4 m), so close
        // views keep their real depth colour instead of reading as shore everywhere.
        const I=i+2,J=j+2,d=water[J*G+I],o=(j*NODE+i)*4;let near=4;
        if(d)for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++)if(!water[(J+b)*G+I+a])near=Math.min(near,Math.max(0,(Math.hypot(a,b)-.5)*column));
        const x=(x0+(i+.5)*column)/FLOW,z=(z0+(j+.5)*column)/FLOW,a=Math.floor(x),b=Math.floor(z),u=x-a,v=z-b,f=[0,1].map(c=>(flowAt(a,b)[c]*(1-u)+flowAt(a+1,b)[c]*u)*(1-v)+(flowAt(a,b+1)[c]*(1-u)+flowAt(a+1,b+1)[c]*u)*v);
        out[o]=Math.min(255,Math.round(d*32));out[o+1]=d?Math.min(255,Math.round(near*64)):0;out[o+2]=Math.round(128+f[0]*127);out[o+3]=Math.round(128+f[1]*127);
      }
      return out;
    }
    function biomeTint(L,nx,nz,grassy,grassMat,snowy,G,water){
      const column=cellMetres*2**L,x0=nx*NODE*column,z0=nz*NODE*column,out=new Uint8Array(NODE*NODE*4),dominant=dominantGrass(grassMat);
      for(let j=0;j<NODE;j++)for(let i=0;i<NODE;i++){
        // Grass tone blends between biomes in irregular drifts: the sample point is warped by noise and the tone averaged over
        // a 3×3 spread, so a biome border never shows as a straight line along the sampling grid.
        const wx=x0+(i+.5)*column,wz=z0+(j+.5)*column,dx=(noise(wx*.02,wz*.02,seed+611)-.5)*40,dz=(noise(wx*.02+9.1,wz*.02,seed+613)-.5)*40;
        const bil=(px,pz)=>{const x=px/TINT,z=pz/TINT,a=Math.floor(x),b=Math.floor(z),u=x-a,v=z-b;return (coniferAt(a,b)*(1-u)+coniferAt(a+1,b)*u)*(1-v)+(coniferAt(a,b+1)*(1-u)+coniferAt(a+1,b+1)*u)*v;};
        let c=0;for(let q=-1;q<=1;q++)for(let r=-1;r<=1;r++)c+=bil(wx+dx+r*TINT*.75,wz+dz+q*TINT*.75)*(r?.5:1)*(q?.5:1);c/=4;const o=(j*NODE+i)*4;
        out[o]=Math.round(c*255);out[o+1]=Math.round(cover(snowy,G,i+2,j+2)*255);out[o+2]=localGrass(grassy,grassMat,G,i+2,j+2,dominant);out[o+3]=255;
      }
      return out;
    }
    // Grass tufts for close views, about 24 per square metre on columns whose surface is a blade grass: x, top, z (blocks, node
    // local) and a 0–1 variation seed each. A pure function of the column, so tufts never reshuffle between visits.
    function grassTufts(L,nx,nz,tops,grounds,P,grassy,G,tint){
      const column=cellMetres*2**L,out=[];if(column>.5)return new Float32Array(0);
      const per=24*column*column;
      for(let j=1;j<=NODE;j++)for(let i=1;i<=NODE;i++){
        // Fewer, shorter tufts toward the edge of a meadow; a few stray ones spill onto the ground beside it. The fourth
        // value packs the blade material (×128), conifer-ness (0–7, ×16) and the local cover (0–15) with the 0–1 variation seed.
        // Tufts stand on the ground, and spill only onto open ground: never on a mushroom, bush or stone in the column.
        const t=grounds[(j+1)*G+i+1],own=grassy[(j+1)*G+i+1],c=cover(grassy,G,i+1,j+1);if(!t||!own&&(c<.3||tops[j*P+i]!==t))continue;
        const mat=tint[((j-1)*NODE+i-1)*4+2];
        const gx=nx*NODE+i-1,gz=nz*NODE+j-1,n=Math.floor(per*(own?.35+.65*c:c*.35)+hash(gx,gz,seed+L*977+61));
        for(let q=0;q<n;q++)out.push(i-1+hash(gx,gz,seed+62+q*7),t,j-1+hash(gx,gz,seed+63+q*7),mat*128+Math.round(tint[((j-1)*NODE+i-1)*4]/255*7)*16+Math.floor(c*15)+hash(gx,gz,seed+64+q*7)*.999);
      }
      // Shuffled by a fixed hash, so drawing any prefix of the list thins the whole tile evenly (the renderer's budget).
      const order=[...Array(out.length/4).keys()].sort((a,b)=>hash(a,nx*7+nz,seed+91)-hash(b,nx*7+nz,seed+91)),shuffled=new Float32Array(out.length);
      order.forEach((k,i)=>shuffled.set(out.slice(k*4,k*4+4),i*4));
      return shuffled;
    }
    // Smooth-terrain comparison (?mesh=smooth): Surface Nets over the ground materials, standing objects still blocky.
    // The voxel data is unchanged; only the mesh differs. Samples are block centres (dense index i, block coordinate i-0.5);
    // each cell between eight samples with a solid/air change gets one vertex at the mean of its crossing edges, lightly
    // relaxed toward its neighbours. A node owns the edges whose lower sample is inside it, so neighbours never double up.
    // Rock objects (boulders, chips, stone) are smoothed with the ground, so mountains do not mix blobs and cubes.
    const isTerrain=m=>m&&(!ABOVE_GROUND.has(m&127)||ROCKS.has(m&127)||(m&127)===MAT.stone);
    function objectsOnly(dense){const out=new Uint8Array(dense.length);for(let k=0;k<dense.length;k++){const m=dense[k];out[k]=isTerrain(m)?0:m;}return out;}
    // Returns Map(slice index -> {buffer, count, top}): each quad goes to the slice holding the lower sample of its owned
    // edge, with y local to that slice's origin (k*SL blocks).
    function surfaceNets(cols,colY0,tops,grounds,fine,G,P,base,SL){
      const cell=(k,b)=>{const y0=colY0[k];if(b<y0)return MAT.basalt;const c=cols[k];return b-y0<c.length?c[b-y0]:0;};
      // Height range covers every sampled column, halo included, so a taller neighbour is never cut off at the seam.
      let ny=1;for(let k=0;k<P*P;k++)ny=Math.max(ny,tops[k]);
      // Ground-surface gradient (Sobel over the hillshade's two-ring exact ground heights): identical on both sides of a seam.
      const GH=(i,j)=>grounds[clamp(j,0,G-1)*G+clamp(i,0,G-1)],FH=(i,j)=>fine[clamp(j,0,G-1)*G+clamp(i,0,G-1)];
      const groundNormal=(bx,bz)=>{const fx=bx-.5+2,fz=bz-.5+2,i0=Math.floor(fx),j0=Math.floor(fz),u=fx-i0,v=fz-j0;let x=0,z=0;
        for(const [di,dj,w] of [[0,0,(1-u)*(1-v)],[1,0,u*(1-v)],[0,1,(1-u)*v],[1,1,u*v]]){const i=i0+di,j=j0+dj;
          x+=w*(FH(i+1,j-1)+2*FH(i+1,j)+FH(i+1,j+1)-FH(i-1,j-1)-2*FH(i-1,j)-FH(i-1,j+1))/8;z+=w*(FH(i-1,j+1)+2*FH(i,j+1)+FH(i+1,j+1)-FH(i-1,j-1)-2*FH(i,j-1)-FH(i+1,j-1))/8;}
        const l=Math.hypot(x,1,z);return [-x/l,1/l,-z/l];};
      // Ground range around a vertex: the lowest and highest ground of the 3×3 columns about it. On a steep slope a riser's
      // vertices sit several blocks from their own column's ground but still within this range.
      const groundSpan=(bx,bz)=>{const i=Math.floor(bx)+2,j=Math.floor(bz)+2;let lo=Infinity,hi=-Infinity;for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){const h=GH(i+a,j+b);if(h<lo)lo=h;if(h>hi)hi=h;}return [lo,hi];};
      // Each column's surface material and height, so a slope shows its grass, snow or rock rather than the soil beneath.
      const surf=new Uint8Array(P*P),surfY=new Int32Array(P*P);for(let k=0;k<P*P;k++){for(let b=ny-1;b>=0;b--){const m=cell(k,b);if(isTerrain(m)){surf[k]=m&127;surfY[k]=b;break;}}}
      const Y=ny-base+2,at=(i,y,j)=>{if(i<0||j<0||i>=P||j>=P)return 0;const b=y+base-1;if(b<0)return 1;if(b>=ny)return 0;const m=cell(j*P+i,b);return isTerrain(m)?m:0;};
      const solid=new Uint8Array(P*P*Y);for(let j=0;j<P;j++)for(let y=0;y<Y;y++)for(let i=0;i<P;i++)solid[(j*Y+y)*P+i]=at(i,y,j);
      const S=(i,y,j)=>i<0||j<0||y<0||i>=P||j>=P||y>=Y?(y<0?1:0):solid[(j*Y+y)*P+i];
      // One vertex per cell (cell c spans samples c..c+1 on each axis).
      const C=P-1,CY=Y-1,vid=new Int32Array(C*C*CY).fill(-1),vx=[],vy=[],vz=[];
      for(let j=0;j<C;j++)for(let y=0;y<CY;y++)for(let i=0;i<C;i++){
        let mask=0;for(let k=0;k<8;k++)if(S(i+(k&1),y+(k>>1&1),j+(k>>2)))mask|=1<<k;
        if(mask===0||mask===255)continue;
        let sx=0,sy=0,sz=0,n=0;
        for(const [a,b] of [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]]){
          if(((mask>>a)&1)===((mask>>b)&1))continue;
          sx+=((a&1)+(b&1))/2;sy+=((a>>1&1)+(b>>1&1))/2;sz+=((a>>2)+(b>>2))/2;n++;
        }
        vid[(j*CY+y)*C+i]=vx.length;vx.push(i+sx/n);vy.push(y+sy/n);vz.push(j+sz/n);
      }
      // Relax each vertex halfway toward the mean of its face neighbours: rounds the chamfered staircase into slopes.
      const V=vx.length,rx=new Float32Array(V),ry=new Float32Array(V),rz=new Float32Array(V);
      for(let j=0;j<C;j++)for(let y=0;y<CY;y++)for(let i=0;i<C;i++){
        const v=vid[(j*CY+y)*C+i];if(v<0)continue;
        // Border cells are shared with the neighbouring node, which sees different neighbours: leave them unrelaxed so both
        // nodes place them identically and the seam stays closed.
        if(i===0||j===0||i===C-1||j===C-1){rx[v]=vx[v];ry[v]=vy[v];rz[v]=vz[v];continue;}
        let sx=0,sy=0,sz=0,n=0;
        for(const [a,b,c] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const I=i+a,Yy=y+b,J=j+c;if(I<0||J<0||Yy<0||I>=C||J>=C||Yy>=CY)continue;const u=vid[(J*CY+Yy)*C+I];if(u<0)continue;sx+=vx[u];sy+=vy[u];sz+=vz[u];n++;}
        rx[v]=n?vx[v]*.5+sx/n*.5:vx[v];ry[v]=n?vy[v]*.5+sy/n*.5:vy[v];rz[v]=n?vz[v]*.5+sz/n*.5:vz[v];
      }
      // Normals from the occupancy gradient over a 4×4×4 block around each cell: smooth and pointing into the air.
      const normal=(i,y,j)=>{let x=0,yy=0,z=0;for(let c=-1;c<=2;c++)for(let b=-1;b<=2;b++)for(let a=-1;a<=2;a++){if(!S(i+a,y+b,j+c))continue;const w=(a<=0?-1:1)*(Math.abs(a-.5)<1?1:.5),wy=(b<=0?-1:1)*(Math.abs(b-.5)<1?1:.5),wz=(c<=0?-1:1)*(Math.abs(c-.5)<1?1:.5);x-=w;yy-=wy;z-=wz;}const l=Math.hypot(x,yy,z)||1;return [x/l,yy/l,z/l];};
      const outs=new Map();let out=null,sliceY=0;
      // On the ground surface (within the local ground range, give or take 2.5 blocks), normals come from the ground gradient
      // (so seams match and steep risers light as one slope); elsewhere (isles, overhangs) from the 3D occupancy.
      const push=(v,i,y,j,m)=>{const X=rx[v]-.5,Yv=ry[v]-1+base+.5-sliceY,Z=rz[v]-.5,[lo,hi]=groundSpan(X,Z),Y=Yv+sliceY,[a,b,c]=Y>lo-2.5&&Y<hi+2.5?groundNormal(X,Z):normal(i,y,j);out.push(X,Yv,Z,a,b,c,m);};
      // Quads across each owned edge with a solid/air change; wound so the front faces the air.
      for(let d=0;d<3;d++)for(let j=1;j<=NODE;j++)for(let y=0;y<CY;y++)for(let i=1;i<=NODE;i++){
        const A=S(i,y,j),B=d===0?S(i+1,y,j):d===1?S(i,y+1,j):S(i,y,j+1);if(!A===!B)continue;
        // The four cells sharing this edge.
        const cells=d===0?[[i,y-1,j-1],[i,y,j-1],[i,y,j],[i,y-1,j]]:d===1?[[i-1,y,j-1],[i-1,y,j],[i,y,j],[i,y,j-1]]:[[i-1,y-1,j],[i,y-1,j],[i,y,j],[i-1,y,j]];
        const ids=cells.map(([a,b,c])=>a<0||b<0||c<0||a>=C||b>=CY||c>=C?-1:vid[(c*CY+b)*C+a]);if(ids.some(v=>v<0))continue;
        // Material: the solid sample's column surface when it lies within three blocks of that surface, else its own.
        const si=d===0&&!A?i+1:i,sj=d===2&&!A?j+1:j,sy2=d===1&&!A?y+1:y,sk=sj*P+si,m=surfY[sk]-(sy2+base-1)<=3?surf[sk]:(A||B),order=A?[0,1,2,0,2,3]:[0,2,1,0,3,2];
        const sk2=Math.floor((y+base-1)/SL);out=outs.get(sk2);if(!out){out=[];outs.set(sk2,out);}sliceY=sk2*SL;
        for(const k of order){const [a,b,c]=cells[k];push(ids[k],a,b,c,m&127);}
      }
      const result=new Map();
      for(const [sk,out] of outs){
        const buf=new ArrayBuffer(out.length/7*16),f=new Float32Array(buf),bytes=new Int8Array(buf),u8=new Uint8Array(buf);let top=0;
        for(let k=0,o=0;k<out.length;k+=7,o+=16){f[o/4]=out[k];f[o/4+1]=out[k+1];f[o/4+2]=out[k+2];top=Math.max(top,out[k+1]);bytes[o+12]=Math.round(out[k+3]*127);bytes[o+13]=Math.round(out[k+4]*127);bytes[o+14]=Math.round(out[k+5]*127);u8[o+15]=out[k+6];}
        result.set(sk,{buffer:buf,count:out.length/7,top});
      }
      return result;
    }
    // Ground surface of a column in blocks: solid from the bottom up to the first air gap, ignoring trees and spires, so
    // isles, canopies and spires do not tilt the hillshade. Water counts: it is the visible surface.
    // from: a known solid run at the bottom (see basaltRun) the scan may skip.
    function groundBlocks(c,lim,s,from=0){let y=Math.min(from,lim);while(y<lim&&c[y]&&!ABOVE_GROUND.has(c[y]&127))y++;return Math.floor((y-1)/s)+1;}
    // Length of the column's leading basalt run below lim, read four cells at a time (c32: a Uint32 view of c's buffer).
    const BASALT4=MAT.basalt*0x01010101;
    // from: the band floor (a multiple of 8): everything below it is basalt and is not read.
    function basaltRun(c,c32,lim,from=0){const n=lim>>2;let k=from>>2;while(k<n&&c32[k]===BASALT4)k++;let y=k<<2;while(y<lim&&c[y]===MAT.basalt)y++;return y;}
    // Smooth surface normals per inside column (RGBA8: x, z, cavity, local ground top) from exact ground heights (block ground where objects stand) with a two-column
    // ring (G=N+4), so distant terraces light as the slope they form instead of alternating tread/riser bands. Blocks are
    // cubic, so the gradient is unitless. Sobel, then a 3×3 blur, widens the kernel enough to hide single-block steps.
    // Alpha is the highest ground in the 3×3 around the column, in blocks above groundBase (255: out of range); the shader
    // keeps block-face lighting for anything above it (isles, canopies).
    // Bare-rock ground materials that take the rock detail map (scree, cobble and boulders keep their own look).
    const DETAIL_ROCK=new Set([MAT.basalt,MAT.stone,MAT.rockDark,MAT.rockPale,MAT.rockWarm,MAT.lichen,MAT.lichenOrange]);
    // 1 where a column's ground top (P grid, halo included) is bare rock.
    function rockColumns(cols,colY0,grounds,P,G){
      const out=new Uint8Array(P*P);
      for(let j=0;j<P;j++)for(let i=0;i<P;i++){const k=j*P+i,g=grounds[(j+1)*G+i+1]-1,y0=colY0[k],c=cols[k];if(g<0)continue;
        const m=g<y0?MAT.basalt:g-y0<c.length?c[g-y0]&127:0;out[k]=DETAIL_ROCK.has(m)?1:0;}
      return out;
    }
    // Mountain rock detail for close nodes (L<=2), as lighting only, so faces read rugged while the walkable surface stays
    // smooth. RGBA8 at twice the column resolution over the inside columns ((2N)², row-major from the node's -x,-z corner):
    // R,G the detail normal's x,z (encoded like hillshade normals), B crack occlusion (0 none, 255 deepest), A the rock
    // mask (0 not rock). The normal is the exact ground's gradient (the hillshade's Sobel, interpolated) plus an analytic
    // detail height: strata ledges on roughRock's warped contours (flat treads, steep risers), cracks and 0.3-2 m lumps. Everything
    // is a function of world position and the exact ground, so neighbouring nodes match at the seam. Empty when the node
    // has no bare rock.
    function rockDetail(fine,G,rocky,P,L,nx,nz){
      if(!rocky.some(v=>v))return new Uint8Array(0);
      const N=NODE*2,W=N+2,bs=2**L*cellMetres,e=bs/2,x0=nx*NODE*bs,z0=nz*NODE*bs,D=new Float32Array(W*W),C=new Float32Array(W*W),out=new Uint8Array(N*N*4);
      const FH=(i,j)=>fine[clamp(j,0,G-1)*G+clamp(i,0,G-1)],lerp2=(f,fx,fz)=>{const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;return (f(i,j)*(1-u)+f(i+1,j)*u)*(1-v)+(f(i,j+1)*(1-u)+f(i+1,j+1)*u)*v;};
      const SX=(i,j)=>(FH(i+1,j-1)+2*FH(i+1,j)+FH(i+1,j+1)-FH(i-1,j-1)-2*FH(i-1,j)-FH(i-1,j+1))/8,SZ=(i,j)=>(FH(i-1,j+1)+2*FH(i,j+1)+FH(i+1,j+1)-FH(i-1,j-1)-2*FH(i,j-1)-FH(i+1,j-1))/8;
      const RK=(i,j)=>rocky[clamp(j,0,P-1)*P+clamp(i,0,P-1)];
      // Texel a (-1..N) sits at inside column (a+.5)/2-.5: fine-grid index +2, P-grid index +1.
      const col=a=>(a+.5)/2-.5;
      for(let b=-1;b<=N;b++)for(let a=-1;a<=N;a++){
        const x=x0+(a+.5)*e,z=z0+(b+.5)*e,Hm=lerp2(FH,col(a)+2,col(b)+2)*bs;
        const warp=(noise(x*.06,z*.06,seed+811)-.5)*3+(noise(x*.19,z*.19,seed+813)-.5)*.8,u=(Hm+warp)/STRATA,f=u-Math.floor(u);
        const ledge=(f*f*(3-2*f)-f)*STRATA*1.2,c=Math.abs(noise(x*.45+warp*.15,z*.45,seed+861)-.5)*2,crack=clamp(1-c/.16,0,1);
        const lumps=(noise(x*.55,z*.55,seed+865)-.5)*.45+(noise(x*1.3,z*1.3,seed+863)-.5)*.22+(noise(x*3.4,z*3.4,seed+864)-.5)*.08;
        const k=(b+1)*W+a+1;D[k]=ledge+lumps-.22*crack*crack;C[k]=crack;
      }
      for(let b=0;b<N;b++)for(let a=0;a<N;a++){
        const k=(b+1)*W+a+1,fx=col(a)+2,fz=col(b)+2,o=(b*N+a)*4;
        const gx=lerp2(SX,fx,fz)+(D[k+1]-D[k-1])/(2*e),gz=lerp2(SZ,fx,fz)+(D[k+W]-D[k-W])/(2*e),l=Math.hypot(gx,1,gz);
        out[o]=Math.round(128-127*gx/l);out[o+1]=Math.round(128-127*gz/l);out[o+2]=Math.round(C[k]*255);out[o+3]=Math.round(clamp(lerp2(RK,col(a)+1,col(b)+1),0,1)*255);
      }
      return out;
    }
    function hillshade(grounds,fine,G){
      const N=G-4,M=N+2,T=(i,j)=>fine[j*G+i],gx=new Float32Array(M*M),gz=new Float32Array(M*M),out=new Uint8Array(N*N*4);
      for(let j=0;j<M;j++)for(let i=0;i<M;i++){
        const I=i+1,J=j+1;
        gx[j*M+i]=(T(I+1,J-1)+2*T(I+1,J)+T(I+1,J+1)-T(I-1,J-1)-2*T(I-1,J)-T(I-1,J+1))/8;
        gz[j*M+i]=(T(I-1,J+1)+2*T(I,J+1)+T(I+1,J+1)-T(I-1,J-1)-2*T(I,J-1)-T(I+1,J-1))/8;
      }
      let groundBase=Infinity;for(let j=2;j<N+2;j++)for(let i=2;i<N+2;i++)groundBase=Math.min(groundBase,grounds[j*G+i]);
      for(let j=0;j<N;j++)for(let i=0;i<N;i++){
        let x=0,z=0,sum=0,high=0;
        for(let b=0;b<3;b++)for(let a=0;a<3;a++){x+=gx[(j+b)*M+i+a];z+=gz[(j+b)*M+i+a];sum+=T(i+1+a,j+1+b);high=Math.max(high,grounds[(j+1+b)*G+i+1+a]);}
        x/=9;z/=9;const l=Math.hypot(x,1,z),o=(j*N+i)*4;
        out[o]=Math.round(128-127*x/l);out[o+1]=Math.round(128-127*z/l);out[o+2]=clamp(Math.round(128+(T(i+2,j+2)-sum/9)*40),0,255);out[o+3]=Math.min(255,high-groundBase);
      }
      return {normals:out,groundBase};
    }
    return Object.freeze({id,dataId:`${id}:cell:${cellMetres}:extent:${extent}`,seed,revision,extent,infinite,map:mapTemplate,macro:MM,riverProfile:id=>infinite?riverProfile(id):null,cell:cellMetres,chunkCells,heightCells,chunkMetres:chunkCells*cellMetres,heightMetres:heightCells*cellMetres,deposit,geography,erosionAt,ground,column,blockingAt,mushroomsNear,palmsNear,bouldersNear:(x,z,radius)=>infinite?bouldersNear(x,z,radius):[],tree,generateChunk,columnBand,node,landmarksAt:(x,z)=>infinite?{ancient:ancientNear(x,z),ruin:ruinNear(x,z),rock:rockNear(x,z)}:{ancient:null,ruin:null,rock:null},nodeBound,heightBound,contentTop,slice:SLICE,streamMouths:(x0,z0,x1,z1)=>infinite&&!gallery?streamMouths(x0,z0,x1,z1):[],nodeSize:NODE,maxLevel:MAX_LEVEL,nodeMetres,gallery,gallerySpots:gallery?Object.freeze(GAL_SPOTS.slice()):null,vegetationEntries:()=>trees.size,setDrainageCrease:fn=>{creaseAt=typeof fn==='function'?fn:null;for(const D of DRAIN)D.tiles.clear();}});
  }
  function voxel(chunk,x,y,z){
    const {size:CHUNK,height:HEIGHT}=chunk,y0=chunk.y0||0;
    if(x<0||z<0||y<0||x>=CHUNK||z>=CHUNK||y>=y0+HEIGHT)return MAT.air;
    if(y<y0)return MAT.basalt;y-=y0;
    const i=z*CHUNK+x;
    for(let r=chunk.offsets[i];r<chunk.offsets[i+1];r++)if(y<chunk.ends[r])return chunk.materials[r];
    return MAT.air;
  }
  // Meshes a chunk's band: vertex y is in render blocks above the band floor (mesh.y0, cells; 0 for finite worlds), with
  // solid bedrock under the band so no bottom faces are emitted there.
  function meshChunk(world,chunk,step=1){
    const {size:CHUNK,height:HEIGHT}=chunk,y0=chunk.y0||0,b0=y0/step;
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
      if(y0)dense[(z+1)*halo*(ny+2)+x+1]=MAT.basalt;
      for(let y=0;y<ny;y++){
        let material=0;
        // Preserve the top occupied material when reducing a vertical block (grass must not become soil).
        for(let dy=step-1;dy>=0&&!material;dy--)material=local?voxel(chunk,x*step,y0+y*step+dy,z*step):col[y0+y*step+dy];
        dense[(z+1)*halo*(ny+2)+(y+1)*halo+x+1]=material;
      }
    }
    return {...greedy(dense,nx,ny,nx),step,y0,temporaryDenseBytes:dense.byteLength};
  }
  // Greedy mesher over a dense block grid with a one-block halo on every side: layout (z+1)*halo*(ny+2)+(y+1)*halo+x+1,
  // halo=nx+2. Merges coplanar same-material exposed faces; a face on the halo boundary belongs to the neighbour.
  // win {y0, h}: mesh only dense layers y0 .. y0+h-1 (a vertical slice); the layers just outside the window are its
  // neighbours, and each face between two windows belongs to exactly one of them (same rule as the x/z halo).
  function greedy(dense,nx,ny,nz,yOffset=0,win=null){
    const halo=nx+2,stride=[1,halo,halo*(ny+2)],dims=[nx,win?win.h:ny,nz],origin=stride[0]+(win?win.y0:1)*stride[1]+stride[2];
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
  const api={STALKS,FLOWERS,ABOVE_GROUND,LEAVES,NEEDLES,BARKS,BLADE_GRASS,ROCKS,WARM_ROCKS,CELL,CHUNK,HEIGHT,EXTENT,REVISION,MAX_CHUNK,MAT,SHADE,COLORS,BIOME_NAMES,hash,riverX,movePosition,positionAt,createWorld,voxel,meshChunk,BudgetCache};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MicroWorld=api;
})(typeof globalThis==='object'?globalThis:this);
