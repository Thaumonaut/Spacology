(function(root){
  'use strict';
  const M=root.MicroWorld,ANGLE=50*Math.PI/180,S=Math.sin(ANGLE),C=Math.cos(ANGLE),YAW=35*Math.PI/180,SY=Math.sin(YAW),CY=Math.cos(YAW);
  // One vertex source for both passes: SHADOW projects into the sun's view instead of the camera's.
  const vertex=shadow=>`#version 300 es
  ${shadow?'#define SHADOW':''}
  precision highp float;
  layout(location=0) in vec3 position;
  layout(location=1) in float face;
  layout(location=2) in float material;
  layout(location=3) in vec3 smoothNormal;
  uniform vec3 origin, scale, localOffset, center, patternOrigin;
  uniform vec2 halfView;
  uniform float yaw, pitch, overrideMaterial, depth, smoothMesh;
  uniform vec3 lightAt, lightHalf;
  uniform mat3 lightAxes;
  out vec3 worldPosition, localPosition;
  out vec3 lightCoord;
  out vec3 normal;
  out vec3 block;
  flat out int mat;
  flat out int shaded;
  void main(){
    vec3 p=(position+localOffset)*scale;
    p=vec3(p.x,p.y*cos(pitch)-p.z*sin(pitch),p.y*sin(pitch)+p.z*cos(pitch));
    p=vec3(p.x*cos(yaw)+p.z*sin(yaw),p.y,-p.x*sin(yaw)+p.z*cos(yaw));
    worldPosition=p+patternOrigin;p+=origin;localPosition=p;block=position;
    vec3 n=smoothMesh>.5?normalize(smoothNormal):face<.5?vec3(-1,0,0):face<1.5?vec3(1,0,0):face<2.5?vec3(0,-1,0):face<3.5?vec3(0,1,0):face<4.5?vec3(0,0,-1):vec3(0,0,1);
    n=vec3(n.x,n.y*cos(pitch)-n.z*sin(pitch),n.y*sin(pitch)+n.z*cos(pitch));
    normal=vec3(n.x*cos(yaw)+n.z*sin(yaw),n.y,-n.x*sin(yaw)+n.z*cos(yaw));
    int raw=int(overrideMaterial>0.?overrideMaterial:material);
    mat=raw&127;shaded=raw>>7;
    // Sun-view clip space: x/y across the light box, z increasing away from the sun.
    vec3 l=(p-lightAt)*lightAxes/lightHalf;
    lightCoord=l*.5+.5;
    #ifdef SHADOW
    gl_Position=vec4(l,1.);
    #else
    vec3 q=p-center;
    float forward=q.x*${SY}+q.z*${CY};
    gl_Position=vec4((q.x*${CY}-q.z*${SY})/halfView.x,(q.y*${C}-forward*${S})/halfView.y,-(q.y*${S}+forward*${C})/depth,1.);
    #endif
  }`;
  // Shadow casters: things standing on the ground (trees, spires, stones, arches), anything above the local ground top
  // (sky isles) and the crew. Terrain never casts, so its single-block steps cannot shadow each other into moiré.
  const aboveGround=[...M.ABOVE_GROUND].map(m=>`m==${m}`).join('||');
  // Material families from the model, as GLSL tests; and crown band colours per leaf material. Plain leaf and needle keep
  // the hand-picked anime greens; blossom, autumn, gold, birch and other leaves derive their bands from their palette
  // colour (cool shadow, the colour itself, a warm sunlit lift).
  const family=set=>[...set].map(m=>`m==${m}`).join('||');
  const MATERIALS=`bool isLeaf(int m){return ${family(M.LEAVES)}||${family(M.NEEDLES)};}
  bool isNeedle(int m){return ${family(M.NEEDLES)};}
  bool isBark(int m){return ${family(M.BARKS)};}
  bool isBladeGrass(int m){return ${family(M.BLADE_GRASS)};}
  bool isRock(int m){return ${family(M.ROCKS)};}
  bool isWarmRock(int m){return ${family(M.WARM_ROCKS)};}
  void crownBands(int m,vec3 tint,out vec3 shadow,out vec3 mid,out vec3 high){
    if(m==${M.MAT.needle}){shadow=vec3(.13,.3,.33);mid=vec3(.22,.48,.36);high=vec3(.5,.72,.4);}
    else if(m==${M.MAT.leaf}){shadow=vec3(.18,.38,.34);mid=vec3(.35,.62,.3);high=vec3(.7,.84,.38);}
    else{shadow=tint*vec3(.5,.56,.72);mid=tint;high=mix(tint,vec3(1.,.96,.82),.38);}
  }`;
  const casterFragment=`#version 300 es
  precision highp float;
  in vec3 block;
  flat in int mat;
  uniform float normalSize, groundBase, caster;
  uniform sampler2D normalMap;
  bool aboveGround(int m){return ${aboveGround};}
  void main(){
    bool casts=caster>.5||aboveGround(mat);
    if(!casts&&normalSize>0.){vec4 t=texture(normalMap,block.xz/normalSize);casts=t.a<.999&&block.y>t.a*255.+groundBase+.5;}
    if(!casts)discard;
  }`;
  // Meadow colour field shared by grass-topped ground and grass blades, so blade roots match the ground beneath them and
  // whole fields carry soft painted patches of lighter, yellower and deeper green.
  const MEADOW=`float meadowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453),b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5453),
    c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5453),d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5453);
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
  // Grass takes its biome's tone: bright warm green in open meadows, deep cool green on redwood and boreal forest floors.
  vec3 forestGrass(vec3 grass,float tone){return mix(grass*vec3(1.06,1.1,.82),vec3(.2,.38,.33),tone);}
  vec3 meadow(vec2 p,vec3 grass){
    float broad=meadowNoise(p*.04);
    return mix(grass*vec3(.86,.96,.86),grass*vec3(1.08,1.13,.88),smoothstep(.3,.7,broad));
  }
  // Drifting cloud shadows: big soft patches, cast along the sun so they land consistently on ground, crowns and grass.
  // They follow time, so they hold still when paused or with reduced motion. Returns the sunlight left after clouds.
  // One cloud field for the sky layer and the shadows. Its coordinate is the cloud's position slid along the sun to sea
  // level, so a cloud and its shadow share it. A slow ~900 m weather pattern decides where cloud banks form: big merged
  // masses inside them, mostly clear sky between.
  vec2 cloudCoord(vec2 seaLevel){return seaLevel/150.+cloudTime*vec2(.02,.008);}
  float cloudWeather(vec2 seaLevel){return meadowNoise(seaLevel/900.+cloudTime*vec2(.0033,.0013)+11.);}
  float cloudField(vec2 seaLevel){
    vec2 q=cloudCoord(seaLevel);
    float n=meadowNoise(q)*.6+meadowNoise(q*2.2+4.)*.3+meadowNoise(q*5.1+9.)*.1;
    return n*.72+smoothstep(.42,.8,cloudWeather(seaLevel))*.42-.14;
  }
  // Soft caustics: the edges between jittered cells, domain-warped so they wobble into rounded, wavy lines, drawn with a
  // screen-space-aware width so they stay smooth at every zoom. Two layers at different scales drift apart and shimmer.
  float causticLayer(vec2 p,float t){
    vec2 q=p+.45*vec2(meadowNoise(p*.55+t*.13),meadowNoise(p*.55+vec2(7.1,3.3)-t*.11))-.225,cell=floor(q);float d1=9.,d2=9.;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=cell+vec2(x,y),o=vec2(fract(sin(dot(c,vec2(12.9,78.2)))*43758.5),fract(sin(dot(c,vec2(39.3,11.1)))*24634.6));o=.5+.4*sin(t*.35+6.2831*o);float e=length(q-c-o);if(e<d1){d2=d1;d1=e;}else if(e<d2)d2=e;}
    float e=d2-d1,w=.07+fwidth(e)*1.5;return 1.-smoothstep(0.,w,e);
  }
  float caustic(vec2 p,float t){return causticLayer(p*.9,t)*.75+causticLayer(p*1.6+vec2(3.7,1.9),t*1.3)*.35;}
  float clouds(vec3 p){return 1.-.5*smoothstep(.56,.66,cloudField(p.xz+worldOffset+vec2(.5,-.4)*p.y));}`;
  // Fraction of sunlight reaching this point: five hardware-filtered taps soften the edge. The bias is about one block,
  // or two shadow texels when those are coarser, so a canopy does not shadow its own lit side.
  const SUNLIGHT=`float sunlight(){
    if(shadowOn<.5||any(lessThan(lightCoord,vec3(0)))||any(greaterThan(lightCoord,vec3(1))))return 1.;
    float bias=max(blockSize*1.2,shadowTexel*2.)/(2.*lightHalf.z),texel=shadowTexel/(2.*lightHalf.x),sum=0.;
    for(int i=0;i<5;i++){vec2 o=i==0?vec2(0):vec2(i<3?-1.2:1.2,(i&1)==0?-1.2:1.2)*texel;sum+=texture(shadowMap,vec3(lightCoord.xy+o,lightCoord.z-bias));}
    return sum/5.;
  }`;
  const fragment=`#version 300 es
  precision highp float;
  in vec3 worldPosition;
  in vec3 normal;
  in vec3 block;
  in vec3 lightCoord, localPosition;
  flat in int mat;
  flat in int shaded;
  uniform vec3 palette[96];
  uniform vec3 lightHalf;
  uniform float shadowOn, shadowTexel;
  uniform highp sampler2DShadow shadowMap;
  uniform float time, detail, normalSize, groundBase, blockSize, pixelWorld, cards, grassGrow, cloudTime, placeholder;
  uniform vec2 worldOffset;
  uniform vec2 dither;
  uniform sampler2D normalMap, canopyMap, biomeMap, waterMap;
  out vec4 color;
  const vec3 SUN=normalize(vec3(-.5,1.,.4));
  float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  // Patterns fade out before their wavelength drops under a few pixels, so they never alias into shimmer or moiré.
  float visible(float wavelength){return smoothstep(2.,5.,wavelength/pixelWorld);}
  ${SUNLIGHT}
  ${MEADOW}
  ${MATERIALS}
  void main(){
    // LOD dissolve: an incoming node keeps pixels below the fade threshold, the node it replaces keeps the rest.
    if(dither.x!=0.){float n=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(dither.x>0.?n>=dither.y:n<dither.y)discard;}
    vec3 n=normalize(normal);float cavity=0.;
    if(normalSize>0.){
      // Hillshade: distant blocks light as the slope they form, so treads and risers stop alternating into bands.
      // Close up, the block faces keep part of their own normal for a crisp voxel edge.
      // Only the ground takes it: sky isles and canopies above the local ground top keep their block faces.
      vec4 t=texture(normalMap,block.xz/normalSize);vec2 g=t.rg*2.-1.;
      float ground=t.a>.999?1.:step(block.y,t.a*255.+groundBase+.5);
      n=normalize(mix(n,vec3(g.x,sqrt(max(0.,1.-dot(g,g))),g.y),ground*(1.-.55*smoothstep(3.,12.,blockSize/pixelWorld))));
      cavity=clamp(t.b*2.-1.,-.5,.5)*ground;
    }
    // Warm sun over a cool sky fill; ridges catch a little more light than hollows.
    float key=max(0.,dot(n,SUN));
    // Shadow only removes the sun term, so shade keeps the sky fill: a soft afternoon shadow, never a black one.
    // A coarser tile standing in for finer ones keeps the same lighting (so long-lived fallback coverage never shows a
    // brightness step along tile edges); it only skips sun shadows, which its blocky shapes would cast wrongly.
    float sunVis=(placeholder>0.?1.:sunlight())*clouds(localPosition),sun=sunVis;if(isBladeGrass(mat))sun=.45+.55*sun;
    vec3 light=mix(vec3(.62,.58,.52),vec3(.78,.82,.9),n.y*.5+.5)*.72+vec3(1.,.95,.85)*key*.45*sun;
    light*=1.+cavity*.3;
    float grain=mat==7?0.:(hash(floor(worldPosition*4.+normal*.01))-.5)*.07*detail*visible(.25);
    vec3 base=palette[mat];
    // Grass ground: the root colour under visible blades; once they fade with distance, the blades' average colour, so a
    // meadow keeps its tone at every zoom.
    float conifer=normalSize>0.?texture(biomeMap,block.xz/normalSize).r:0.;vec3 grassTone=forestGrass(palette[3],conifer);
    if(isBladeGrass(mat))base=meadow(worldPosition.xz,forestGrass(palette[mat],conifer))*mix(vec3(1.08,1.1,.94),vec3(.86),grassGrow);
    // Soft meadow borders: the grass cover map, warped by noise, decides where meadow colour gives way to the ground
    // beside it, so grass creeps over dirt and sand in ragged tongues and frays to a dry fringe at its own edge.
    if(normalSize>0.&&normal.y>.5&&(isBladeGrass(mat)||mat==2||mat==4||mat==18||mat==32||mat==28||mat==29)){
      vec2 p=worldPosition.xz;float cover=texture(canopyMap,block.xz/normalSize).a,edge=meadowNoise(p*1.7)*.65+meadowNoise(p*5.3+2.1)*.35;
      float g=smoothstep(.4,.6,cover+(edge-.5)*.6);int local=int(texelFetch(biomeMap,clamp(ivec2(block.xz),ivec2(0),ivec2(int(normalSize)-1)),0).b*255.+.5);vec3 field=meadow(p,forestGrass(palette[local],conifer))*mix(vec3(1.08,1.1,.94),vec3(.86),grassGrow);
      base=isBladeGrass(mat)?mix(mix(field,palette[2],.3)*vec3(1.06,1.,.82),field,g):mix(base,field,g);
    }
    // Vertical water (waterfalls) carries bright streaks running down.
    if(mat==7&&abs(normal.y)<.5)base+=vec3(.1)*step(.7,fract(worldPosition.y*.8+time*2.4+floor(worldPosition.x*1.7+worldPosition.z*1.3)*.37))*visible(1.2);
    // Stylized water on the surface: depth bands from turquoise shallows to deep blue (depth from the biome map's alpha,
    // filtered so it fades toward shores), broken white foam where it meets land, rocks or lily pads, a faint wave line
    // rolling shoreward, and blinking sun glints.
    // Stylized water, after the user's references: calm and simple. Clear in the shallows (the bed shows through),
    // deepening to teal-blue with depth and distance from the banks; one soft caustic pattern carried downstream by a
    // two-phase flow map; a lighter band inside the shore with a thin antialiased white edge.
    vec4 wm=normalSize>0.?texture(waterMap,block.xz/normalSize):vec4(.125,1.,.5,.5);
    float waterM=wm.r*8.,shoreM=wm.g*4.;vec2 flow=wm.ba*2.-1.;
    if(mat==7&&normal.y>.5){
      vec2 p=worldPosition.xz;
      float look=min(waterM,.25+shoreM*1.6);
      vec3 bed=vec3(.74,.71,.56),col=mix(mix(vec3(.36,.8,.79),vec3(.15,.6,.73),smoothstep(.2,1.,look)),vec3(.08,.34,.6),smoothstep(1.2,3.5,look));
      base=mix(bed*vec3(.86,1.,.98),col,.3+.7*smoothstep(.0,.5,look));
      float speed=length(flow);vec2 dir=speed>.05?flow/speed:vec2(0);
      float ph=time*.1,w=abs(fract(ph)*2.-1.);
      float c=mix(caustic(p-dir*fract(ph)*1.4,time),caustic(p-dir*fract(ph+.5)*1.4+5.3,time),w);
      base=mix(base,base*1.1+vec3(.1,.14,.13),c*.42*(1.-smoothstep(.8,3.,look)*.6)*visible(.6));
      base=mix(base,base*1.08+vec3(.05,.07,.06),smoothstep(.5,.12,shoreM)*.6);
      float edge=shoreM+(meadowNoise(p*1.8+dir*time*.4)-.5)*.04,aa=max(fwidth(edge)*1.2,.006);
      base=mix(base,vec3(.97,.99,1.),1.-smoothstep(.06,.06+aa,edge));
    }
    if(mat==1&&normal.y<.5)base+=vec3(.045)*step(.85,fract(worldPosition.y*.7))*visible(1.4);
    if(mat==6)base+=vec3(.012,.025,.005)*sin(worldPosition.y*1.6)*visible(3.9);
    // Lowlands sit slightly darker; high ground brightens toward the summits so tall ranges read at any zoom.
    float heightShade=.88+.12*clamp(worldPosition.y/15.,0.,1.)+.14*clamp((worldPosition.y-24.)/140.,0.,1.);
    vec3 lit=base*(light+grain)*heightShade;
    // Aether crystal and moss carry their own light.
    if(mat==19)lit=base*(.82+.18*(.58+.42*key))+vec3(.1,.06,.16)*(.6+.4*sin(time*1.3+worldPosition.y*.9+worldPosition.x*.3));
    if(mat==20)lit+=vec3(.03,.02,.06)*(.6+.4*sin(time*.8+worldPosition.x*.7+worldPosition.z*.5));
    // Ground under a sky isle is pre-darkened by the generator; with shadows on the isle casts its own.
    if(shaded>0&&shadowOn<.5)lit*=.6;
    // Water reads flat and bright: shade only gently, then sparkle where the sun catches it.
    if(mat==7&&normal.y>.5){
      lit=base*mix(.82,1.04,sunVis)*heightShade;
      // Glints: small four-point sparkles in a sparse world grid, each blinking on its own clock.
      vec2 q=worldPosition.xz*.9,g=floor(q),f=fract(q)-.5;float id=fract(sin(dot(g,vec2(12.9898,78.233)))*43758.5453);
      float on=step(.97,id)*max(0.,sin(time*2.3+id*40.)),cross=max(smoothstep(.035,0.,abs(f.x))*smoothstep(.16,0.,abs(f.y)),smoothstep(.035,0.,abs(f.y))*smoothstep(.16,0.,abs(f.x)));
      lit=mix(lit,vec3(1.,.99,.92),cross*on*smoothstep(.3,.9,waterM)*sunVis*visible(.25));
    }
    // Anime crowns: leaves light by the rounded canopy shape, not their block faces, in three flat bands (sunny
    // yellow-green, leaf green, cool teal shadow), broken into leafy puffs and darker beneath the crown.
    // Trunks run up through their crowns to the tip; where bark peeks through the leaves (high in the tree, mostly trunk
    // tips) it is painted as deep crown interior, so forests do not freckle with bark. Below 45% of the tree's height
    // trunks keep their bark, including a giant's long visible trunk.
    bool trunkInCrown=false;
    if(isBark(mat)&&normalSize>0.){
      float ground=texture(normalMap,block.xz/normalSize).a*255.+groundBase,crown=max(texture(canopyMap,block.xz/normalSize).b*255.,1.),h=(block.y-ground)/crown;
      trunkInCrown=h>.45;
    }
    if(isLeaf(mat)||trunkInCrown){
      vec3 cn=normalize(normal);float below=0.;
      if(normalSize>0.){
        vec4 c=texture(canopyMap,block.xz/normalSize);vec2 g=c.rg*2.-1.;
        cn=normalize(mix(vec3(g.x,sqrt(max(0.,1.-dot(g,g))),g.y),cn,.22));
        vec4 t=texture(normalMap,block.xz/normalSize);below=(t.a*255.+groundBase+c.b*255.-block.y)*blockSize;
      }
      vec3 w=worldPosition;float puff=meadowNoise(w.xz*.32+w.y*.25)*.75+meadowNoise(w.xz*.9-w.y*.6+3.7)*.25-.5;
      float tone=(dot(cn,SUN)*.5+.5)*mix(.55,1.,sunVis)+puff*.3-smoothstep(.6,3.5,below)*.3-(trunkInCrown?.25:0.);
      bool pine=isNeedle(mat)||trunkInCrown&&conifer>.5;
      // Bob Ross conifers: the crown reads as five or six stacked bough skirts, each with a sunlit top and a dark drooping
      // underside, spaced by the crown's height (from the canopy map) so small and giant trees both get layers.
      if(pine&&normalSize>0.){
        // The tree's own top, not this column's: look around for the highest crown nearby, so a cone's sloping flanks
        // share its tiers instead of rippling into many thin bands.
        float top=texture(canopyMap,block.xz/normalSize).b*255.,r=max(2.,top*.45);
        for(int i=0;i<6;i++){float a=float(i)*1.0472;top=max(top,texture(canopyMap,(block.xz+vec2(cos(a),sin(a))*r)/normalSize).b*255.);}
        float ground=texture(normalMap,block.xz/normalSize).a*255.+groundBase,crownH=max(top*blockSize,1.),fromTop=(ground+top-block.y)*blockSize;
        float period=max(.9,crownH/5.5),f=fract(fromTop/period+puff*.08);
        // Tiers need several blocks each to read; on coarse blocks they would wrap faces in contour stripes, so they fade.
        float tiers=1.-smoothstep(.2,.4,blockSize/period);
        tone+=(.14*(1.-smoothstep(0.,.35,f))-.42*smoothstep(.62,.9,f))*tiers;
      }
      vec3 shadow,mid,high;crownBands(trunkInCrown?(pine?${M.MAT.needle}:${M.MAT.leaf}):mat,palette[mat],shadow,mid,high);
      // Broadleaf crowns get softer band edges so a crown reads as a few big lobes, not a cluster of florets.
      float soft=pine?.03:.07;
      lit=mix(mix(shadow,mid,smoothstep(.33-soft,.33+soft,tone)),mix(mid,high,.65),smoothstep(.83-soft,.83+soft,tone))*heightShade;
      // Trees on snowy ground carry snow on their upward-facing boughs and lobes (tier tops on conifers).
      float snow=normalSize>0.?texture(biomeMap,block.xz/normalSize).g:0.;
      if(snow>.05){float up=cn.y*.7+(normal.y>.5?.35:0.)+puff*.35;if(pine&&normalSize>0.)up+=.25*(1.-smoothstep(.2,.45,fract(((texture(normalMap,block.xz/normalSize).a*255.+groundBase+texture(canopyMap,block.xz/normalSize).b*255.-block.y)*blockSize)/max(.9,texture(canopyMap,block.xz/normalSize).b*255.*blockSize/5.5))));
        lit=mix(lit,mix(vec3(.74,.8,.92),vec3(.98,.98,1.),smoothstep(.4,.7,tone))*heightShade,smoothstep(.62,.7,up)*smoothstep(.05,.4,snow));}
      // Close up, leaf cards cover the crown. The blocks beneath carry the same small-leaf pattern in deeper tones, so any
      // that show through read as dense foliage rather than flat faces.
      if(normalSize>0.&&cards>0.){
        vec3 an=abs(normal);vec2 g=(an.y>.5?w.xz:an.x>.5?w.zy:w.xy)*2.6,cell=floor(g);float d=9.,id=0.;
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=cell+vec2(x,y),o=vec2(fract(sin(dot(c,vec2(12.9,78.2)))*43758.5),fract(sin(dot(c,vec2(39.3,11.1)))*24634.6));float e=length(g-c-o);if(e<d){d=e;id=fract(o.x*7.+o.y*3.);}}
        vec3 inner=mix(shadow,mid,smoothstep(.3,.6,tone+(id-.5)*.3))*mix(1.,.82,smoothstep(.32,.62,d));
        lit=mix(lit,inner*heightShade,cards*.5);
      }
    }
    // Anime rock: basalt, standing stone, sandstone and gravel in three flat bands like the crowns: warm sunlit tops, a
    // mid tone, and cool lavender-blue shadow faces. Ridges catch extra light, hollows sink, and soft facet patches stop
    // big faces reading flat. Sandstone keeps its warmth in every band.
    if(isRock(mat)){
      // Two rock looks. Paths and flat rock ground (an upward face with nothing standing on the column) break into angular
      // flagstones. Boulders, cliffs, ledges and every side face are pixel-art stone built from the voxels themselves:
      // each voxel a stone of its own shade, a chunky 4×4 pixel grain inside each face, a light pixel row on its upper
      // edge and a dark one on its lower edge, all in stepped palette tones.
      vec3 w=worldPosition,fn=normalize(normal);bool warm=isWarmRock(mat);
      float standing=normalSize>0.?texture(canopyMap,block.xz/normalSize).b:0.;
      // Flagstones only on genuinely flat rock (paths, slabs), not on every tread of a stepped slope.
      bool path=fn.y>.5&&standing<=.002&&n.y>.93;
      vec3 shadow=warm?vec3(.5,.36,.38):vec3(.33,.35,.5),mid=warm?vec3(.76,.56,.42):vec3(.5,.53,.6),high=warm?vec3(.9,.76,.58):vec3(.72,.71,.68);
      if(mat==30){shadow=mix(shadow,vec3(.45,.43,.42),.5);mid=mix(mid,vec3(.66,.63,.58),.5);high=mix(high,vec3(.82,.78,.7),.5);}
      if(path){
        vec3 q=w*1.4+vec3(7.1,3.3,5.9);vec3 cell=floor(q);float d1=9.,d2=9.;vec3 tilt=vec3(0);
        for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 c=cell+vec3(x,y,z),h=fract(sin(vec3(dot(c,vec3(127.1,311.7,74.7)),dot(c,vec3(269.5,183.3,246.1)),dot(c,vec3(113.5,271.9,124.6))))*43758.5);float e=length(q-c-h);if(e<d1){d2=d1;d1=e;tilt=h-.5;}else if(e<d2)d2=e;}
        vec3 rn=normalize(n+tilt*.35*visible(.7));float crack=(1.-smoothstep(.03,.08,d2-d1))*visible(.4);
        float tone=(dot(rn,SUN)*.5+.5)*mix(.55,1.,sunVis)+cavity*.4-crack*.15;
        lit=mix(mix(shadow,mid,smoothstep(.36,.42,tone)),mix(mid,high,.7),smoothstep(.86,.92,tone))*heightShade;
      }else{
        // Voxel stone after the references: faces lit directly while blocks are large on screen (so every step, ledge and
        // chip reads), blending to the smooth slope as blocks shrink (so distant slopes never stripe). Texture is an 8×8
        // pixel grid per voxel face, filled from clustered low-frequency blotches in three close tones (Minecraft-style
        // stone), with a faint light pixel row along each voxel's top edge.
        vec3 voxel=floor(block-fn*.01),local=fract(block-fn*.01);
        vec2 uv=abs(fn.x)>.5?local.zy:abs(fn.z)>.5?local.xy:local.xz;
        float px=blockSize/pixelWorld,close=smoothstep(4.,14.,px),detail=smoothstep(10.,24.,px);
        vec3 ln=fn;
        if(normalSize>0.&&standing<=.002){vec2 g=texture(normalMap,block.xz/normalSize).rg*2.-1.;ln=normalize(mix(vec3(g.x,sqrt(max(0.,1.-dot(g,g))),g.y),fn,close));}
        // Pixel centres in block space, so blotches run continuously across neighbouring voxels.
        vec2 cellUV=(floor(uv*8.)+.5)/8.;vec3 p=voxel+(abs(fn.x)>.5?vec3(.5,cellUV.y,cellUV.x):abs(fn.z)>.5?vec3(cellUV.x,cellUV.y,.5):vec3(cellUV.x,.5,cellUV.y));
        float blot=meadowNoise(p.xz*1.7+p.y*1.3)*.6+meadowNoise(p.xy*2.9-p.z*2.1+4.)*.4;
        float tex=(blot<.4?-1.:blot>.62?1.:0.)*.05*detail;
        float rim=(abs(fn.y)<.5&&uv.y>.875?.05:0.)*detail;
        float tone=(dot(ln,SUN)*.5+.5)*mix(.55,1.,sunVis)+cavity*.3;
        lit=mix(mix(shadow,mid,smoothstep(.3,.36,tone)),mix(mid,high,.7),smoothstep(.82,.88,tone))*heightShade;
        // Light varies gently within a band (faces turned more to the sun are a touch brighter), then the pixel texture.
        lit*=(.88+.24*clamp(tone,0.,1.))*(1.+tex+rim);
      }
      if(shaded>0&&shadowOn<.5)lit*=.6;
    }
    // Alpha marks what may carry an ink outline: flowers stay unlined (single blocks that coarsen into specks), and so
    // does a tile mid-dissolve between detail levels, whose dithered holes would otherwise ink into hatched ghosts.
    color=vec4(lit,mat==9||dither.x!=0.||placeholder>0.?0.:1.);
  }`;
  // Stylized grass: an instanced clump of seven long, curved blades per tuft (x, top, z in blocks; seed). Roots take the
  // ground's meadow colour and fade to bright yellow-green tips. Wind leans the blades with a quick flutter and slow gusts
  // rolling across the field, and each gust brightens the tips it passes, so the wind reads as light moving over the
  // meadow. It stops when time does (paused or reduced motion).
  const BLADES=7,BLADE_VERTS=9;
  const grassVertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec3 blade;
  layout(location=1) in vec4 tuft;
  uniform vec3 origin, scale, patternOrigin, center, lightAt, lightHalf;
  uniform mat3 lightAxes;
  uniform vec2 halfView;
  uniform float depth, time, grow;
  out vec3 lightCoord;
  out vec2 field, cloudAt;
  out float along, sheen, conifer;
  flat out int bladeMat;
  float rand(float n){return fract(sin(n*91.345+tuft.w*311.7)*43758.5453);}
  void main(){
    float v=blade.y,k=blade.z,seed=fract(tuft.w),cover=mod(floor(tuft.w),16.)/15.;conifer=floor(mod(tuft.w,128.)/16.)/7.;bladeMat=int(tuft.w/128.);
    // Each blade: its own spot in the clump, facing, length and lean.
    float a=rand(k)*6.2832,r=.13*sqrt(rand(k+.5)),h=(.34+.34*rand(k+.25))*grow*mix(.35,1.,cover),w=.055+.03*rand(k+.75);
    vec2 spot=vec2(cos(a),sin(a))*r,face=vec2(-sin(a*1.7+seed*9.),cos(a*1.7+seed*9.)),out_=normalize(spot+vec2(.001));
    vec3 root=origin+tuft.xyz*scale+vec3(spot.x,0,spot.y);vec2 at=patternOrigin.xz+tuft.xz*scale.x+spot,dir=vec2(.92,.39);
    float gust=.5+.5*sin(dot(at,dir)*.32-time*1.15+sin(dot(at,vec2(-.3,.9))*.11)*2.);gust=gust*gust*gust;
    float flutter=sin(time*2.4+seed*12.+k*1.7+dot(at,vec2(1.3,.7))*1.8);
    vec2 lean=out_*(.25+.35*rand(k+.1))+dir*(.15+.75*gust)+face*.06*flutter;
    vec2 bend=lean*h*v*v;
    float up=h*v*(1.-.28*dot(lean,lean)*v);
    vec3 p=root+vec3(face.x*blade.x*w*(1.-v*v)+bend.x,up,face.y*blade.x*w*(1.-v*v)+bend.y);
    along=v;sheen=gust;field=at;cloudAt=root.xz;
    vec3 l=(p-lightAt)*lightAxes/lightHalf;lightCoord=l*.5+.5;
    vec3 q=p-center;
    float forward=q.x*${SY}+q.z*${CY};
    gl_Position=vec4((q.x*${CY}-q.z*${SY})/halfView.x,(q.y*${C}-forward*${S})/halfView.y,-(q.y*${S}+forward*${C})/depth,1.);
  }`;
  const grassFragment=`#version 300 es
  precision highp float;
  in vec3 lightCoord;
  in vec2 field, cloudAt;
  in float along, sheen, conifer;
  flat in int bladeMat;
  uniform vec3 palette[96];
  uniform vec3 grassColor, lightHalf;
  uniform float shadowOn, shadowTexel, blockSize, cloudTime;
  uniform vec2 worldOffset;
  uniform vec2 dither;
  uniform highp sampler2DShadow shadowMap;
  out vec4 color;
  ${SUNLIGHT}
  ${MEADOW}
  void main(){
    if(dither.x!=0.){float n=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(dither.x>0.?n>=dither.y:n<dither.y)discard;}
    // Root matches the ground (same field, same .86 shade); tips lift toward sunlit yellow-green, more so in a gust.
    // Anime grass: one clean gradient from the ground's colour to a bright tip, a sheen where gusts pass, and shadow as a
    // light cool tint.
    vec3 ground=meadow(field,forestGrass(palette[bladeMat],conifer))*.86,tip=ground*vec3(1.32,1.3,1.)+vec3(.06,.07,.03)*sheen;
    vec3 base=mix(ground,tip,smoothstep(.15,1.,along));
    color=vec4(base*mix(vec3(.86,.9,.97),vec3(1.),smoothstep(.3,.7,sunlight()*clouds(vec3(cloudAt.x,0,cloudAt.y)))),dither.x!=0.?0.:1.);
  }`;
  function makeTuft(){
    // One blade: a tapering quad and a tip, 9 vertices; seven blades per tuft, indexed by z.
    const out=[];
    for(let k=0;k<BLADES;k++){
      for(const [u,v] of [[-1,0],[1,0],[-.55,.6],[1,0],[.55,.6],[-.55,.6],[-.55,.6],[.55,.6],[0,1]])out.push(u,v,k);
    }
    return new Float32Array(out);
  }
  // Leaf cards: camera-facing leaf clusters over the outside of each crown, cut to a fluffy, jagged outline in the
  // fragment shader and lit by the crown's outward direction in the same anime bands as the voxel crowns.
  const leafVertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec2 corner;
  layout(location=1) in vec4 card;
  layout(location=2) in vec4 facing;
  uniform vec3 origin, scale, patternOrigin, center, lightAt, lightHalf;
  uniform mat3 lightAxes;
  uniform vec2 halfView;
  uniform float depth, time, grow;
  out vec3 lightCoord, outward;
  out vec2 uv, field;
  out float seed, pine, snowCover;
  flat out int leafMat;
  void main(){
    seed=fract(card.w);leafMat=int(card.w);snowCover=floor(facing.w/20.)/3.;float packed=mod(facing.w,20.);pine=step(10.,packed);outward=facing.xyz;
    // Broadleaf clumps spin freely; conifer sprigs stay upright with a slight tilt so the crown keeps its cone.
    float size=(packed-10.*pine)*grow,a=mix(seed*6.2832,(seed-.5)*.5,pine);
    vec2 at=patternOrigin.xz+card.xz*scale.x;field=(origin+card.xyz*scale).xz;
    float sway=sin(time*1.7+dot(at,vec2(.6,.35))*.8+seed*6.)*.04+.05*pow(.5+.5*sin(dot(at,vec2(.92,.39))*.32-time*1.15),3.);
    vec3 p=origin+card.xyz*scale+outward*size*mix(.25,.1,pine);
    uv=mat2(cos(a),-sin(a),sin(a),cos(a))*corner;
    vec3 l=(p-lightAt)*lightAxes/lightHalf;lightCoord=l*.5+.5;
    vec3 q=p-center;
    float forward=q.x*${SY}+q.z*${CY};
    gl_Position=vec4((q.x*${CY}-q.z*${SY})/halfView.x,(q.y*${C}-forward*${S})/halfView.y,-(q.y*${S}+forward*${C})/depth,1.);
    // Wind sways a card on screen only, never in depth, so overlapping clumps cannot trade places as they move.
    gl_Position.xy+=(corner*size*.5+vec2(.92,.2)*sway*min(card.y*scale.y,30.)*.02)/halfView;
    // Drawn half a card nearer the camera: enough to clear its own crown's blocks, not a neighbouring tree in front.
    // A fixed per-card nudge breaks depth ties, so the same clump always wins where two overlap.
    gl_Position.z-=(size*.5+seed*.02)/depth;
  }`;
  const leafFragment=`#version 300 es
  precision highp float;
  in vec3 lightCoord, outward;
  in vec2 uv, field;
  in float seed, pine, snowCover;
  flat in int leafMat;
  uniform vec3 palette[96];
  uniform vec3 lightHalf;
  uniform float shadowOn, shadowTexel, blockSize, leafShape, cloudTime;
  uniform vec2 worldOffset;
  uniform vec2 dither;
  uniform highp sampler2DShadow shadowMap;
  out vec4 color;
  const vec3 SUN=normalize(vec3(-.5,1.,.4));
  ${SUNLIGHT}
  ${MEADOW}
  ${MATERIALS}
  // Signed distance to an upright triangle of the given size (negative inside).
  float triangle(vec2 p,float size){p/=size;p.x=abs(p.x)-1.;p.y+=.577;if(p.x+1.732*p.y>0.)p=vec2(p.x-1.732*p.y,-1.732*p.x-p.y)*.5;p.x-=clamp(p.x,-2.,0.);return -length(p)*sign(p.y)*size;}
  void main(){
    if(dither.x!=0.){float n=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(dither.x>0.?n>=dither.y:n<dither.y)discard;}
    float r=length(uv),ang=atan(uv.y,uv.x),lobes=meadowNoise(vec2(ang*2.2+seed*40.,seed*9.))*.5+meadowNoise(uv*5.+seed*23.)*.5;
    // Outline. Broadleaf: a round clump. Conifer, by leafShape: 0 round, 1 soft triangle, 2 hard triangle, 3 round or
    // soft per card, 4 any of the three. Rims are chewed into leaves; hard triangles only lightly.
    float pick=fract(seed*7.13),shape=leafShape<2.5?leafShape:leafShape<3.5?step(.5,pick):floor(pick*3.);
    float round=r-(.62+.36*lobes),soft=triangle(uv,.6)-.24+(lobes-.5)*.12,hard=triangle(uv,.9)-.03+(lobes-.5)*.05;
    float edge=pine<.5||shape<.5?round:shape<1.5?soft:hard;
    // Antialiased rim: coverage from the outline's screen-space slope (alpha to coverage on the multisampled canvas).
    float coverage=clamp(.5-edge/max(fwidth(edge),1e-4),0.,1.);if(coverage<=0.)discard;
    // Inside the clump: small leaves (nearest of jittered cell points), each with its own shade, softly darker in gaps.
    vec2 g=uv*4.6+seed*17.,cell=floor(g);float d=9.,leafId=0.;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=cell+vec2(x,y),o=vec2(fract(sin(dot(c,vec2(12.9,78.2)))*43758.5),fract(sin(dot(c,vec2(39.3,11.1)))*24634.6));float e=length(g-c-o);if(e<d){d=e;leafId=fract(o.x*7.+o.y*3.);}}
    float gap=smoothstep(.35,.7,d);
    // Each clump shades as a small tuft: lit toward the sun and its top, darker at its base and rim, a little hue drift.
    float tone=(dot(normalize(outward),SUN)*.5+.5)*mix(.55,1.,sunlight()*clouds(vec3(field.x,0,field.y)))+(leafId-.5)*.1+dot(uv,vec2(-.4,.5))*.2-r*.12-gap*.12+.12;
    vec3 shadow,mid,high;crownBands(leafMat,palette[leafMat],shadow,mid,high);
    vec3 c=mix(mix(shadow,mid,smoothstep(.3,.36,tone)),mix(mid,high,.65),smoothstep(.8,.86,tone));
    // Snow on the upper part of clumps facing up, on trees standing on snowy ground.
    if(snowCover>0.)c=mix(c,mix(vec3(.74,.8,.92),vec3(.98,.98,1.),smoothstep(.4,.7,tone)),smoothstep(.15,.45,uv.y+(lobes-.5)*.5+outward.y*.4)*smoothstep(0.,.5,snowCover));
    color=vec4(c*(.96+.08*fract(seed*3.7))+vec3(-.01,.01,0)*fract(seed*11.),coverage);
  }`;
  // Cloud layer for wide views: a plane high above the land shaded from the same noise as the cloud shadows (offset
  // along the sun by its height), so each cloud floats exactly over its shadow. Anime cumulus: white sunlit tops, a soft
  // blue-grey band on the far side, soft rims. Fades in only as the view widens.
  const CLOUD_HEIGHT=320;
  const cloudVertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec2 corner;
  uniform vec3 center;
  uniform vec2 halfView, extent, middle;
  uniform float depth;
  out vec2 at;
  void main(){
    vec3 p=vec3(middle+corner*extent,${CLOUD_HEIGHT}.).xzy;at=p.xz;
    vec3 q=p-center;
    float forward=q.x*${SY}+q.z*${CY};
    gl_Position=vec4((q.x*${CY}-q.z*${SY})/halfView.x,(q.y*${C}-forward*${S})/halfView.y,-(q.y*${S}+forward*${C})/depth,1.);
  }`;
  const cloudFragment=`#version 300 es
  precision highp float;
  in vec2 at;
  uniform vec2 worldOffset;
  uniform float cloudTime, cloudFade;
  out vec4 color;
  ${MEADOW}
  vec2 seaLevel(vec2 p){return p+worldOffset+vec2(.5,-.4)*${CLOUD_HEIGHT}.;}
  vec2 drift(vec2 p){return cloudCoord(seaLevel(p));}
  float cover(vec2 p){return cloudField(seaLevel(p));}
  // Billows: the nearest of jittered cell points, as round puffs (1 at a puff's heart, 0 between puffs), plus which side
  // of its puff this point is on, so every lobe can be lit on its own.
  vec3 billow(vec2 q){
    vec2 cell=floor(q);float d=9.;vec2 off=vec2(0);
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=cell+vec2(x,y),o=vec2(fract(sin(dot(c,vec2(12.9,78.2)))*43758.5),fract(sin(dot(c,vec2(39.3,11.1)))*24634.6))*.8+.1,v=q-c-o;float e=length(v);if(e<d){d=e;off=v;}}
    return vec3(1.-smoothstep(.1,.75,d),off/max(d,1e-3));
  }
  // Ghibli cumulus seen from above: masses from broad noise, scalloped into cauliflower lobes at two scales.
  float shapeAt(vec2 p){vec2 q=drift(p);return cover(p)+(billow(q*4.).x-.5)*.08+(billow(q*9.+3.1).x-.5)*.035;}
  void main(){
    vec2 q=drift(at);float n=cover(at),shape=shapeAt(at);
    float body=smoothstep(.58,.6,shape);
    // Thin wisps between the masses: noise stretched along the wind.
    // Wisps here and there: thin streaks along the wind, scattered around the fringes of the cloud banks.
    float weather=cloudWeather(seaLevel(at)),streak=meadowNoise(q*vec2(16.,1.1)+vec2(cloudTime*.04,0))*meadowNoise(q*.9+21.),wisp=smoothstep(.5,.56,streak)*smoothstep(.3,.45,weather)*(1.-smoothstep(.6,.8,weather))*(1.-body)*.35;
    float alpha=max(body,wisp)*cloudFade;if(alpha<.01)discard;
    // Always golden hour: each lobe lit from the low sun's side in warm cream and peach, a lavender-blue far side, the
    // whole mass darker where it thins away from the sun, and a golden rim on sunward edges.
    vec2 sunDir=normalize(vec2(-.6,.45));
    // Lit where the billowed shape falls away toward the sun (a sunward slope): each lobe gets a bright sunward cheek
    // and a shaded lee side.
    float tone=.6+(shape-shapeAt(at+sunDir*22.))*3.5+(n-cover(at+sunDir*90.))*2.5;
    vec3 shade=vec3(.72,.74,.9),mid=vec3(.97,.95,.97),lit=vec3(1.,.95,.88),gold=vec3(1.,.84,.66);
    vec3 c=mix(mix(shade,mid,smoothstep(.2,.45,tone)),lit,smoothstep(.62,.85,tone));
    float rim=1.-smoothstep(.6,.66,shape);c=mix(c,gold,rim*smoothstep(.5,.8,tone)*.55);
    c=mix(c,vec3(.97,.95,1.),wisp*(1.-body));
    color=vec4(c,alpha);
  }`;
  // Ink outlines: a full-screen pass over the resolved scene. Wherever the depth behind a pixel jumps away by more than
  // a zoom-scaled threshold, the nearer side gets a thin line in a deep, cool tint of its own colour (anime line art
  // rather than black). Grass, leaf clumps and single-block steps fall under the threshold, so only silhouettes ink.
  const postVertex=`#version 300 es
  void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0,1);}`;
  const postFragment=`#version 300 es
  precision highp float;
  uniform sampler2D sceneColor;
  uniform highp sampler2D sceneDepth;
  uniform vec2 texel;
  uniform float depthRange, threshold, ink, width;
  out vec4 color;
  float metres(vec2 uv){return texture(sceneDepth,uv).r*2.*depthRange;}
  void main(){
    vec2 uv=gl_FragCoord.xy*texel;vec4 s=texture(sceneColor,uv);vec3 c=s.rgb;float d=metres(uv),edge=0.;
    // Two rings of eight neighbours: the inner ring draws the line's core, the outer ring a softer fringe, so lines are
    // about two pixels wide (scaled with the device pixel ratio) and feather off rather than stopping hard.
    for(int r=1;r<=2;r++)for(int i=0;i<8;i++){
      float a=float(i)*.7854;vec2 o=vec2(cos(a),sin(a))*float(r)*width*texel;
      edge=max(edge,smoothstep(threshold,threshold*2.2,metres(uv+o)-d)*(r==1?1.:.45));
    }
    color=vec4(mix(c,c*vec3(.46,.48,.6),edge*ink*s.a),1.);
  }`;
  // Flower props: a camera-facing card rising from the flower's root, drawn as a thin stem and a five-petal head in the
  // flower's palette colour with a warm centre; it sways with the grass wind.
  const flowerVertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec2 corner;
  layout(location=1) in vec4 prop;
  uniform vec3 origin, scale, patternOrigin, center;
  uniform vec2 halfView;
  uniform float depth, time, pixelWorld;
  out vec2 uv;
  out float seed;
  flat out int flowerMat;
  void main(){
    seed=fract(prop.w);flowerMat=int(prop.w);
    vec3 root=origin+prop.xyz*scale+vec3(seed-.5,0,fract(seed*7.3)-.5)*scale.x*.6;
    vec2 at=patternOrigin.xz+prop.xz*scale.x;
    float sway=sin(time*2.1+seed*9.+dot(at,vec2(1.3,.7))*1.8)*.08+.12*pow(.5+.5*sin(dot(at,vec2(.92,.39))*.32-time*1.15),3.);
    float w=max(.42,pixelWorld*8.)*(.85+.3*fract(seed*3.1)),h=w*1.35;
    uv=corner*vec2(1.,.5)+vec2(0,.5);
    vec3 right=vec3(${CY},0,-${SY});
    vec3 q=root+right*(corner.x*w*.5+sway*w*uv.y*uv.y)+vec3(0,uv.y*h,0)-center;
    float forward=q.x*${SY}+q.z*${CY};
    gl_Position=vec4((q.x*${CY}-q.z*${SY})/halfView.x,(q.y*${C}-forward*${S})/halfView.y,-(q.y*${S}+forward*${C})/depth,1.);
  }`;
  const flowerFragment=`#version 300 es
  precision highp float;
  in vec2 uv;
  in float seed;
  flat in int flowerMat;
  uniform vec3 palette[96];
  out vec4 color;
  void main(){
    // Head centred near the top; petals as five round lobes; stem a thin line below.
    // uv.x spans the card width (-1..1), uv.y its height (0..1); one unit of y is about 1.74 of x on screen.
    vec2 p=vec2(uv.x,(uv.y-.68)*1.74);float r=length(p),a=atan(p.y,p.x)+seed*6.28;
    float petal=.5+.16*cos(a*5.);
    bool head=r<petal,core=r<.17,stem=abs(uv.x)<.07&&uv.y<.6;
    bool leaf=abs(uv.x-(uv.y-.2)*1.1-.08)<.09&&uv.y>.15&&uv.y<.42;
    if(!head&&!stem&&!leaf)discard;
    vec3 petalC=palette[flowerMat]*(1.05+.15*smoothstep(-.3,.4,p.y)),coreC=flowerMat==${M.MAT.flowerYellow}?vec3(.55,.32,.12):vec3(1.,.82,.3),green=vec3(.28,.5,.24);
    vec3 c=core?coreC:head?mix(petalC*.85,petalC,smoothstep(.0,petal,r)):green*(.8+.3*uv.y);
    color=vec4(c,0.);
  }`;
  // Stalk objects: a camera-facing card from the plant's root to its top, cut in the fragment shader into a bamboo culm
  // with nodes and leaf sprigs, a reed clump, a rush with a cattail head, a fern fan or a grass tuft. Thinner than a
  // block and swaying with the wind (taller plants bend more at the top).
  const stalkVertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec2 corner;
  layout(location=1) in vec4 prop;
  layout(location=2) in vec4 extra;
  uniform vec3 origin, scale, patternOrigin, center;
  uniform vec2 halfView;
  uniform float depth, time, pixelWorld;
  out vec2 uv;
  out float seed, heightM, head;
  flat out int stalkMat;
  void main(){
    seed=fract(prop.w);stalkMat=int(prop.w);head=extra.y;heightM=extra.x*scale.y;
    vec3 root=origin+prop.xyz*scale+vec3(seed-.5,0,fract(seed*7.3)-.5)*scale.x*.5;
    vec2 at=patternOrigin.xz+prop.xz*scale.x;
    float w=stalkMat==${M.MAT.bamboo}?.5:stalkMat==${M.MAT.fern}?max(.9,heightM*2.2):stalkMat==${M.MAT.tuft}?max(.45,heightM*1.6):.38;
    w=max(w,pixelWorld*5.);
    float sway=sin(time*1.6+seed*9.+dot(at,vec2(1.3,.7))*1.2)*.05+.09*pow(.5+.5*sin(dot(at,vec2(.92,.39))*.32-time*1.15),3.);
    // Bamboo carries its leaves in the canopy, which only shifts gently, so culms sway as little as the canopy does.
    if(stalkMat==${M.MAT.bamboo})sway*=.15;
    uv=corner*vec2(1.,.5)+vec2(0,.5);
    // An upright quad in world space facing the camera's right axis, so every point sorts at its true depth.
    vec3 right=vec3(${CY},0,-${SY});
    vec3 q=root+right*(corner.x*w*.5+sway*heightM*uv.y*uv.y)+vec3(0,uv.y*max(heightM,pixelWorld*6.),0)-center;
    float forward=q.x*${SY}+q.z*${CY};
    gl_Position=vec4((q.x*${CY}-q.z*${SY})/halfView.x,(q.y*${C}-forward*${S})/halfView.y,-(q.y*${S}+forward*${C})/depth,1.);
  }`;
  const stalkFragment=`#version 300 es
  precision highp float;
  in vec2 uv;
  in float seed, heightM, head;
  flat in int stalkMat;
  uniform vec3 palette[96];
  out vec4 color;
  void main(){
    vec3 base=palette[stalkMat],c=base;bool keep=false;float x=uv.x,y=uv.y;
    if(stalkMat==${M.MAT.bamboo}){
      // Culm: slim, with node rings every ~0.4 m; leaf sprigs off the upper nodes, alternating sides.
      float r=.16;keep=abs(x)<r;float along=y*heightM/.4,ring=fract(along);
      c=base*(.85+.3*smoothstep(-r,r,-x))*(ring<.06?.75:1.);
      float side=mod(floor(along),2.)*2.-1.,sx=x*side,sy=fract(along);
      if(!keep&&y>.35&&sx>0.&&sx<.9&&abs(sy-.15-sx*.25)<.05*(1.-sx)+.02){keep=true;c=palette[${M.MAT.bambooLeaf}]*(.9+.2*sx);}
    }else if(stalkMat==${M.MAT.fern}){
      // Fan of fronds from the root, each a tapering leaf with serrated edges.
      vec2 p=vec2(x*1.1,y);float a=atan(p.x,p.y),r=length(p),k=floor((a+1.2)/.4+.5),ca=k*.4-1.2,d=abs(a-ca)*r;
      keep=abs(ca)<1.15&&r<.95-abs(ca)*.15&&d<.06*(1.-r)+.012+.02*abs(sin(r*40.));c=base*(.75+.4*r);
    }else if(stalkMat==${M.MAT.tuft}){
      float a=atan(x*1.2,y),k=floor((a+1.)/.33+.5),ca=k*.33-1.;keep=abs(ca)<1.&&abs(a-ca)*length(vec2(x,y))<.035*(1.-y)+.004&&length(vec2(x,y))<.95-abs(ca)*.25;c=base*(.7+.5*y);
    }else{
      // Reeds: three slim stalks; rushes: one stalk, with a brown cattail head near the top.
      float bend=x-(y*y*.15);
      if(stalkMat==${M.MAT.reed}){for(int i=0;i<3;i++){float cx=float(i-1)*.38+(seed-.5)*.2;if(abs(bend-cx)<.07*(1.-y*.7)&&y<.92-float(i==1?0:1)*.12)keep=true;}c=base*(.75+.4*y);}
      else{keep=abs(bend)<.06*(1.-y*.6);c=base*(.75+.4*y);if(head>.5&&y>.7&&y<.88&&abs(bend)<.2){keep=true;c=palette[${M.MAT.cattail}];}}
    }
    if(!keep)discard;
    color=vec4(c,0.);
  }`;
  function compile(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const e=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(e);}return s;}
  function link(gl,vertexSource,fragmentSource,names){
    const program=gl.createProgram(),vs=compile(gl,gl.VERTEX_SHADER,vertexSource),fs=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    const u={};for(const n of names)u[n]=gl.getUniformLocation(program,n);return {program,u};
  }
  const SUN=(()=>{const l=Math.hypot(.5,1,.4);return [-.5/l,1/l,.4/l];})(),SHADOW_SIZE=2048;
  // Sun-view axes as mat3 columns: right, up, and forward (away from the sun).
  const LIGHT_AXES=(()=>{const f=SUN.map(v=>-v),r=[f[2],0,-f[0]],rl=Math.hypot(...r),R=r.map(v=>v/rl),U=[R[1]*f[2]-R[2]*f[1],R[2]*f[0]-R[0]*f[2],R[0]*f[1]-R[1]*f[0]];return [...R,...U,...f];})();
  const DRAW_UNIFORMS=['origin','scale','localOffset','patternOrigin','yaw','pitch','overrideMaterial','smoothMesh','normalMap','canopyMap','biomeMap','waterMap','normalSize','groundBase','blockSize','lightAt','lightHalf','lightAxes'];
  function makeCube(){
    const data=[];
    for(let d=0;d<3;d++)for(let side=0;side<2;side++){
      const u=(d+1)%3,v=(d+2)%3,corners=[];
      for(const [a,b] of [[0,0],[1,0],[1,1],[0,1]]){const p=[0,0,0];p[d]=side;p[u]=a;p[v]=b;corners.push(p);}
      for(const k of side?[0,1,2,0,2,3]:[0,2,1,0,3,2])data.push(...corners[k],d*2+side,1);
    }
    const buffer=new ArrayBuffer(36*8),v=new DataView(buffer);
    for(let i=0,j=0;i<data.length;i+=5,j+=8){for(let a=0;a<3;a++)v.setUint16(j+a*2,data[i+a],true);v.setUint8(j+6,data[i+3]);v.setUint8(j+7,data[i+4]);}
    return {buffer,count:36};
  }
  class Renderer{
    constructor(canvas){
      this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'low-power'});
      if(!gl)throw new Error('WebGL2 is unavailable. Enable hardware acceleration or try another browser.');
      ({program:this.program,u:this.u}=link(gl,vertex(false),fragment,[...DRAW_UNIFORMS,'center','halfView','palette','time','detail','depth','dither','pixelWorld','shadowMap','shadowOn','shadowTexel','cards','grassGrow','cloudTime','worldOffset','placeholder']));
      ({program:this.casterProgram,u:this.cu}=link(gl,vertex(true),casterFragment,[...DRAW_UNIFORMS,'caster']));
      ({program:this.grassProgram,u:this.gu}=link(gl,grassVertex,grassFragment,['origin','scale','patternOrigin','center','lightAt','lightHalf','lightAxes','halfView','depth','time','grow','grassColor','shadowOn','shadowTexel','blockSize','dither','shadowMap','cloudTime','worldOffset','palette']));
      ({program:this.leafProgram,u:this.lu}=link(gl,leafVertex,leafFragment,['origin','scale','patternOrigin','center','lightAt','lightHalf','lightAxes','halfView','depth','time','grow','shadowOn','shadowTexel','blockSize','dither','shadowMap','leafShape','cloudTime','worldOffset','palette']));
      gl.useProgram(this.leafProgram);gl.uniform1i(this.lu.shadowMap,1);gl.uniform1f(this.lu.blockSize,.3);
      // Conifer card outline for comparison (?leaves=round|soft|hard|round+soft|mixed); mixed by default.
      gl.uniform1f(this.lu.leafShape,Math.max(0,['round','soft','hard','round+soft','mixed'].indexOf(new URLSearchParams(root.location?.search||'').get('leaves')||'mixed')));
      ({program:this.cloudProgram,u:this.ku}=link(gl,cloudVertex,cloudFragment,['center','halfView','extent','middle','depth','worldOffset','cloudTime','cloudFade']));
      this.cloudVao=gl.createVertexArray();
      ({program:this.stalkProgram,u:this.su}=link(gl,stalkVertex,stalkFragment,['origin','scale','patternOrigin','center','halfView','depth','time','pixelWorld','palette']));
      ({program:this.flowerProgram,u:this.fu}=link(gl,flowerVertex,flowerFragment,['origin','scale','patternOrigin','center','halfView','depth','time','pixelWorld','palette']));
      ({program:this.postProgram,u:this.pu}=link(gl,postVertex,postFragment,['sceneColor','sceneDepth','texel','depthRange','threshold','ink','width']));
      gl.useProgram(this.postProgram);gl.uniform1i(this.pu.sceneColor,4);gl.uniform1i(this.pu.sceneDepth,5);this.postVao=gl.createVertexArray();
      // Outlines on by default; ?outlines=0 turns them off for comparison.
      this.outlines=new URLSearchParams(root.location?.search||'').get('outlines')!=='0';
      this.cardBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.cardBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
      this.tuft=makeTuft();this.tuftBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.tuftBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.tuft,gl.STATIC_DRAW);
      gl.useProgram(this.grassProgram);gl.uniform1i(this.gu.shadowMap,1);gl.uniform1f(this.gu.blockSize,.05);gl.uniform3fv(this.gu.grassColor,[1,3,5].map(i=>parseInt(M.COLORS[M.MAT.grass].slice(i,i+2),16)/255));
      gl.useProgram(this.casterProgram);gl.uniform1i(this.cu.normalMap,0);
      gl.useProgram(this.program);
      const colors=[...M.COLORS];
      const paletteValues=[...M.COLORS].flatMap(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255));
      for(const [program,u] of [[this.grassProgram,this.gu],[this.leafProgram,this.lu],[this.flowerProgram,this.fu],[this.stalkProgram,this.su]]){gl.useProgram(program);gl.uniform3fv(u.palette,paletteValues);}
      gl.useProgram(this.program);
      gl.uniform1i(this.u.normalMap,0);gl.uniform1i(this.u.shadowMap,1);gl.uniform1i(this.u.canopyMap,2);gl.uniform1i(this.u.biomeMap,3);gl.uniform1i(this.u.waterMap,6);gl.uniform3fv(this.u.palette,colors.flatMap(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255)));
      this.cube=this.upload(makeCube());this.draws=0;this.triangles=0;this.pixelRatio=1;this.lost=false;this.queue=[];this.dithering=[0,0];this.casting=false;this.shadow=null;
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(.77,.81,.76,1);
    }
    upload(mesh){const gl=this.gl,vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.buffer,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.UNSIGNED_SHORT,false,8,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.UNSIGNED_BYTE,false,8,6);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.UNSIGNED_BYTE,false,8,7);
      // Highest vertex in blocks, so the sun's shadow box can reach the tallest thing drawn.
      const ys=new Uint16Array(mesh.buffer);let top=0;for(let i=1;i<ys.length;i+=4)top=Math.max(top,ys[i]);
      const out={vao,buffer,count:mesh.count,bytes:mesh.buffer.byteLength,normalMap:null,normalSize:0,groundBase:0,top};
      if(mesh.normals){
        // Per-node hillshade normals, one texel per column, filtered between column centres.
        out.normalMap=gl.createTexture();out.normalSize=mesh.normalSize;out.groundBase=mesh.groundBase;out.bytes+=mesh.normals.byteLength;gl.bindTexture(gl.TEXTURE_2D,out.normalMap);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,mesh.normalSize,mesh.normalSize,0,gl.RGBA,gl.UNSIGNED_BYTE,mesh.normals);
        for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
      }
      if(mesh.waterMap){
        out.waterTex=gl.createTexture();out.bytes+=mesh.waterMap.byteLength;gl.bindTexture(gl.TEXTURE_2D,out.waterTex);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,mesh.normalSize,mesh.normalSize,0,gl.RGBA,gl.UNSIGNED_BYTE,mesh.waterMap);
        for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
      }
      if(mesh.biome){
        out.biomeMap=gl.createTexture();out.bytes+=mesh.biome.byteLength;gl.bindTexture(gl.TEXTURE_2D,out.biomeMap);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,mesh.normalSize,mesh.normalSize,0,gl.RGBA,gl.UNSIGNED_BYTE,mesh.biome);
        for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
      }
      if(mesh.canopy){
        out.canopyMap=gl.createTexture();out.bytes+=mesh.canopy.byteLength;gl.bindTexture(gl.TEXTURE_2D,out.canopyMap);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,mesh.normalSize,mesh.normalSize,0,gl.RGBA,gl.UNSIGNED_BYTE,mesh.canopy);
        for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
      }
      if(mesh.grass?.length){
        const gvao=gl.createVertexArray(),gbuffer=gl.createBuffer();gl.bindVertexArray(gvao);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.tuftBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,gbuffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.grass,gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,16,0);gl.vertexAttribDivisor(1,1);
        out.grass={vao:gvao,buffer:gbuffer,count:mesh.grass.length/4};out.bytes+=mesh.grass.byteLength;
      }
      if(mesh.leaves?.length){
        const lvao=gl.createVertexArray(),lbuffer=gl.createBuffer();gl.bindVertexArray(lvao);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.cardBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,lbuffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.leaves,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(1,1);
        gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,32,16);gl.vertexAttribDivisor(2,1);
        out.leaves={vao:lvao,buffer:lbuffer,count:mesh.leaves.length/8};out.bytes+=mesh.leaves.byteLength;
      }
      if(mesh.flowers?.length){
        const fvao=gl.createVertexArray(),fbuf=gl.createBuffer();gl.bindVertexArray(fvao);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.cardBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,fbuf);gl.bufferData(gl.ARRAY_BUFFER,mesh.flowers,gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,16,0);gl.vertexAttribDivisor(1,1);
        out.flowers={vao:fvao,buffer:fbuf,count:mesh.flowers.length/4};out.bytes+=mesh.flowers.byteLength;
      }
      if(mesh.stalks?.length){
        const svao=gl.createVertexArray(),sbuf=gl.createBuffer();gl.bindVertexArray(svao);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.cardBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,sbuf);gl.bufferData(gl.ARRAY_BUFFER,mesh.stalks,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(1,1);
        gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,32,16);gl.vertexAttribDivisor(2,1);
        let top=0;for(let k=0;k<mesh.stalks.length;k+=8)top=Math.max(top,mesh.stalks[k+1]+mesh.stalks[k+4]);
        out.stalks={vao:svao,buffer:sbuf,count:mesh.stalks.length/8};out.bytes+=mesh.stalks.byteLength;out.top=Math.max(out.top,Math.ceil(top));
      }
      if(mesh.smooth?.count){
        // Smooth terrain: float position, signed-byte normal, byte material (16 bytes a vertex).
        const svao=gl.createVertexArray(),sbuf=gl.createBuffer();gl.bindVertexArray(svao);gl.bindBuffer(gl.ARRAY_BUFFER,sbuf);gl.bufferData(gl.ARRAY_BUFFER,mesh.smooth.buffer,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,3,gl.BYTE,true,16,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.UNSIGNED_BYTE,false,16,15);
        out.smooth={vao:svao,buffer:sbuf,count:mesh.smooth.count};out.bytes+=mesh.smooth.buffer.byteLength;out.top=Math.max(out.top,Math.ceil(mesh.smooth.top));
      }
      gl.bindVertexArray(null);
      return out;
    }
    dither(mode,t){this.dithering=[mode,t];}
    // A coarser tile standing in while finer ones stream in: lit as usual but casting and receiving no sun shadows and
    // carrying no ink, so its blocky shapes stay quiet until the real tile arrives.
    placeholder(on){this.flat=on;}
    dispose(mesh){this.gl.deleteBuffer(mesh.buffer);this.gl.deleteVertexArray(mesh.vao);if(mesh.normalMap)this.gl.deleteTexture(mesh.normalMap);if(mesh.canopyMap)this.gl.deleteTexture(mesh.canopyMap);if(mesh.biomeMap)this.gl.deleteTexture(mesh.biomeMap);if(mesh.waterTex)this.gl.deleteTexture(mesh.waterTex);if(mesh.grass){this.gl.deleteBuffer(mesh.grass.buffer);this.gl.deleteVertexArray(mesh.grass.vao);}if(mesh.leaves){this.gl.deleteBuffer(mesh.leaves.buffer);this.gl.deleteVertexArray(mesh.leaves.vao);}if(mesh.stalks){this.gl.deleteBuffer(mesh.stalks.buffer);this.gl.deleteVertexArray(mesh.stalks.vao);}if(mesh.flowers){this.gl.deleteBuffer(mesh.flowers.buffer);this.gl.deleteVertexArray(mesh.flowers.vao);}if(mesh.smooth){this.gl.deleteBuffer(mesh.smooth.buffer);this.gl.deleteVertexArray(mesh.smooth.vao);}}
    resize(economy){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.pixelRatio=Math.min(devicePixelRatio||1,economy?1:1.5);const w=Math.max(1,Math.round(r.width*this.pixelRatio)),h=Math.max(1,Math.round(r.height*this.pixelRatio));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.aspect=w/h;}
    begin(camera,time,economy){const gl=this.gl;this.resize(economy);this.camera=camera;this.economy=economy;this.queue.length=0;gl.useProgram(this.program);gl.uniform3f(this.u.center,camera.x,camera.y??8,camera.z);gl.uniform2f(this.u.halfView,camera.span/2,camera.span/2/this.aspect);gl.uniform1f(this.u.time,time);this.time=time;gl.uniform1f(this.u.detail,economy?.5:1);gl.uniform1f(this.u.pixelWorld,camera.span/this.canvas.width);gl.uniform1f(this.u.depth,Math.max(600,camera.span*2.5/Math.min(1,this.aspect)));this.draws=0;this.triangles=0;}
    // Draws are recorded and replayed by end(): first into the sun's depth map (casters only), then to the screen.
    draw(mesh,origin,scale=[M.CELL,M.CELL,M.CELL],material=0,yaw=0,pitch=0,offset=[0,0,0],patternOrigin=origin){this.queue.push({mesh,origin,scale,material,yaw,pitch,offset,patternOrigin,dither:this.dithering,flat:!!this.flat,caster:this.casting});}
    replay(u,d){const gl=this.gl,m=d.mesh;gl.uniform3fv(u.origin,d.origin);gl.uniform3fv(u.scale,d.scale);gl.uniform3fv(u.localOffset,d.offset);gl.uniform1f(u.overrideMaterial,d.material);gl.uniform1f(u.yaw,d.yaw);gl.uniform1f(u.pitch,d.pitch);gl.uniform1f(u.blockSize,d.scale[0]);gl.uniform1f(u.normalSize,m.normalSize||0);if(m.normalMap){gl.uniform1f(u.groundBase,m.groundBase);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,m.normalMap);if(m.canopyMap){gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,m.canopyMap);gl.activeTexture(gl.TEXTURE0);}if(m.biomeMap){gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,m.biomeMap);gl.activeTexture(gl.TEXTURE0);}if(m.waterTex){gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,m.waterTex);gl.activeTexture(gl.TEXTURE0);}}gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count);if(m.smooth){gl.uniform1f(u.smoothMesh,1);gl.bindVertexArray(m.smooth.vao);gl.drawArrays(gl.TRIANGLES,0,m.smooth.count);gl.uniform1f(u.smoothMesh,0);}}
    shadowTarget(){
      // Allocated on first use and never in Economy, which renders without sun shadows.
      // It lives on texture unit 1 only: unit 0 holds hillshade maps, and a depth texture there breaks every draw.
      if(this.shadow)return this.shadow;const gl=this.gl,size=Math.min(SHADOW_SIZE,gl.getParameter(gl.MAX_TEXTURE_SIZE)),texture=gl.createTexture(),framebuffer=gl.createFramebuffer();
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.DEPTH_COMPONENT24,size,size);
      for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE],[gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL]])gl.texParameteri(gl.TEXTURE_2D,k,v);
      gl.activeTexture(gl.TEXTURE0);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,texture,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      return this.shadow={texture,framebuffer,size};
    }
    // The light box covers the camera footprint from sea floor to `top` (the tallest geometry drawn) plus room for casters
    // beyond its edges, snapped to whole texels so shadows do not crawl while panning.
    lightBox(camera,size,top=(camera.y??8)+camera.span*.5){
      const b=this.bounds(camera,top),pad=camera.span*.3,A=LIGHT_AXES,pts=[];
      for(const x of [b.minX-pad,b.maxX+pad])for(const z of [b.minZ-pad,b.maxZ+pad])for(const y of [0,top])pts.push([x,y,z]);
      const along=(p,k)=>p[0]*A[k*3]+p[1]*A[k*3+1]+p[2]*A[k*3+2],lo=[0,1,2].map(k=>Math.min(...pts.map(p=>along(p,k)))),hi=[0,1,2].map(k=>Math.max(...pts.map(p=>along(p,k))));
      const half=Math.max(hi[0]-lo[0],hi[1]-lo[1])/2,texel=2*half/size,c=[0,1].map(k=>Math.round((lo[k]+hi[k])/2/texel)*texel),cz=(lo[2]+hi[2])/2;
      const at=[0,1,2].map(i=>c[0]*A[i]+c[1]*A[3+i]+cz*A[6+i]);
      return {at,half:[half,half,(hi[2]-lo[2])/2+camera.span+256],texel};
    }
    // Offscreen scene: a multisampled colour + depth target (the canvas itself is not antialiased), resolved each frame
    // into textures the outline pass reads. Rebuilt when the canvas size changes.
    sceneTarget(){
      const gl=this.gl,w=this.canvas.width,h=this.canvas.height;let t=this.scene;
      if(t&&t.w===w&&t.h===h)return t;
      if(t){for(const f of [t.msaa,t.resolve])gl.deleteFramebuffer(f);for(const r of [t.colorRb,t.depthRb])gl.deleteRenderbuffer(r);for(const x of [t.color,t.depth])gl.deleteTexture(x);}
      const samples=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)),rb=(format)=>{const r=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,r);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,format,w,h);return r;};
      const tex=(format)=>{const x=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,x);gl.texStorage2D(gl.TEXTURE_2D,1,format,w,h);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);return x;};
      gl.activeTexture(gl.TEXTURE4);
      t={w,h,colorRb:rb(gl.RGBA8),depthRb:rb(gl.DEPTH_COMPONENT24),color:tex(gl.RGBA8),depth:tex(gl.DEPTH_COMPONENT24),msaa:gl.createFramebuffer(),resolve:gl.createFramebuffer()};
      gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER,t.msaa);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,t.colorRb);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,t.depthRb);
      gl.bindFramebuffer(gl.FRAMEBUFFER,t.resolve);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.color,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,t.depth,0);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      return this.scene=t;
    }
    // Whether a recorded tile overlaps the screen (with a margin): grass and leaf cards are skipped for tiles just outside
    // it, which the stream keeps loaded around the view.
    onScreen(d){
      const c=this.camera,size=32*d.scale[0],top=d.origin[1]+(d.mesh.top||0)*d.scale[1];let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
      for(const x of [d.origin[0],d.origin[0]+size])for(const z of [d.origin[2],d.origin[2]+size])for(const y of [d.origin[1],top]){const p=this.project(c,x,y,z);x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);}
      const m=40;return x1>-m&&x0<this.width+m&&y1>-m&&y0<this.height+m;
    }
    end(){
      // One world frame for everything cloud-related: the stream's rebasing origin (world metres at local zero). It is
      // wrapped only beyond ±195 km to stay exact in single precision; the wrap is centred on zero, because wrapping at
      // zero itself swapped in a different sky whenever the view crossed the world origin near home.
      const CLOUD_PERIOD=95*4096,o=this.worldOrigin||{x:0,z:0},off=[o.x,o.z].map(v=>v-CLOUD_PERIOD*Math.round(v/CLOUD_PERIOD));
      // Sun shadows fade to sub-pixel by about 600 m spans; beyond that the pass is skipped (cloud shadows carry the mood).
      const gl=this.gl,c=this.camera,shadows=!this.economy&&c.span<600;let top=(c.y??8)+c.span*.5;
      if(shadows)for(const d of this.queue)top=Math.max(top,d.origin[1]+(d.mesh.top+Math.abs(d.offset[1]))*d.scale[1]);
      const box=shadows?this.lightBox(c,this.shadowTarget().size,top):null;
      if(shadows){
        const t=this.shadow;gl.bindFramebuffer(gl.FRAMEBUFFER,t.framebuffer);gl.viewport(0,0,t.size,t.size);gl.clear(gl.DEPTH_BUFFER_BIT);
        // Back faces only: the sun-facing side of a caster never compares against its own depth, so it cannot self-shadow.
        gl.useProgram(this.casterProgram);gl.uniform3fv(this.cu.lightAt,box.at);gl.uniform3fv(this.cu.lightHalf,box.half);gl.uniformMatrix3fv(this.cu.lightAxes,false,LIGHT_AXES);gl.cullFace(gl.FRONT);
        for(const d of this.queue){if(d.flat||d.dither[0]<0)continue;gl.uniform1f(this.cu.caster,d.caster?1:0);this.replay(this.cu,d);}
        gl.cullFace(gl.BACK);
      }
      // Economy draws straight to the canvas without outlines or antialiasing.
      const ink=this.outlines&&!this.economy&&c.span<1800,scene=ink?this.sceneTarget():null;
      gl.bindFramebuffer(gl.FRAMEBUFFER,scene?scene.msaa:null);
      gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniform1f(this.u.shadowOn,shadows?1:0);
      // Grass and leaf cards are full grown up to ~3 cm per pixel, shrink away by 5 cm, and are skipped further out.
      const pixel=c.span/this.canvas.width,grow=1-Math.min(1,Math.max(0,(pixel-.03)/.02));gl.uniform1f(this.u.cloudTime,this.time);gl.uniform2f(this.u.worldOffset,...off);
      if(shadows){gl.uniform3fv(this.u.lightAt,box.at);gl.uniform3fv(this.u.lightHalf,box.half);gl.uniformMatrix3fv(this.u.lightAxes,false,LIGHT_AXES);gl.uniform1f(this.u.shadowTexel,box.texel);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.shadow.texture);gl.activeTexture(gl.TEXTURE0);}
      // Close-zoom tones apply per tile, only where that tile really carries leaf cards or grass blades: a coarse
      // placeholder shown while finer tiles load keeps the far-zoom colours instead of dark, bladeless grass and boxy crowns.
      for(const d of this.queue){gl.uniform3fv(this.u.patternOrigin,d.patternOrigin);gl.uniform2f(this.u.dither,d.dither[0],d.dither[1]);gl.uniform1f(this.u.placeholder,d.flat?1:0);gl.uniform1f(this.u.cards,d.mesh.leaves?grow:0);gl.uniform1f(this.u.grassGrow,d.mesh.grass?grow:0);this.replay(this.u,d);this.draws++;this.triangles+=d.mesh.count/3;}
      if(grow>0&&this.queue.some(d=>d.mesh.grass)){
        const g=this.gu;gl.useProgram(this.grassProgram);gl.disable(gl.CULL_FACE);
        gl.uniform3f(g.center,c.x,c.y??8,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.time,this.time);gl.uniform1f(g.cloudTime,this.time);gl.uniform2f(g.worldOffset,...off);gl.uniform1f(g.grow,grow*grow*(3-2*grow));gl.uniform1f(g.shadowOn,shadows?1:0);
        if(shadows){gl.uniform3fv(g.lightAt,box.at);gl.uniform3fv(g.lightHalf,box.half);gl.uniformMatrix3fv(g.lightAxes,false,LIGHT_AXES);gl.uniform1f(g.shadowTexel,box.texel);}
        // Tuft budget per frame tied to screen size (about one per 40 CSS pixels; Economy a quarter). Wide grassy views draw
        // the same fraction of every tile's shuffled list, so meadows thin evenly instead of costing millions of vertices.
        const shown=this.queue.filter(d=>d.mesh.grass&&this.onScreen(d)),total=shown.reduce((n,d)=>n+d.mesh.grass.count,0),budget=this.width*this.height/(this.economy?160:40),share=Math.min(1,budget/Math.max(1,total));
        for(const d of shown){const t=d.mesh.grass,count=Math.ceil(t.count*share);gl.uniform3fv(g.origin,d.origin);gl.uniform3fv(g.scale,d.scale);gl.uniform3fv(g.patternOrigin,d.patternOrigin);gl.uniform2f(g.dither,d.dither[0],d.dither[1]);gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,BLADES*BLADE_VERTS,count);this.draws++;this.triangles+=count*BLADES*3;}
        gl.enable(gl.CULL_FACE);
      }
      if(this.queue.some(d=>d.mesh.stalks)){
        const g=this.su;gl.useProgram(this.stalkProgram);gl.disable(gl.CULL_FACE);
        gl.uniform3f(g.center,c.x,c.y??8,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.time,this.time);gl.uniform1f(g.pixelWorld,c.span/this.width);
        for(const d of this.queue){const t=d.mesh.stalks;if(!t||!this.onScreen(d))continue;gl.uniform3fv(g.origin,d.origin);gl.uniform3fv(g.scale,d.scale);gl.uniform3fv(g.patternOrigin,d.patternOrigin);gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,6,t.count);this.draws++;this.triangles+=t.count*2;}
        gl.enable(gl.CULL_FACE);
      }
      // Flowers draw at every zoom their tiles exist (close views only), never smaller than a few pixels.
      if(this.queue.some(d=>d.mesh.flowers)){
        const g=this.fu;gl.useProgram(this.flowerProgram);gl.disable(gl.CULL_FACE);
        gl.uniform3f(g.center,c.x,c.y??8,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.time,this.time);gl.uniform1f(g.pixelWorld,c.span/this.width);
        for(const d of this.queue){const t=d.mesh.flowers;if(!t||!this.onScreen(d))continue;gl.uniform3fv(g.origin,d.origin);gl.uniform3fv(g.scale,d.scale);gl.uniform3fv(g.patternOrigin,d.patternOrigin);gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,6,t.count);this.draws++;this.triangles+=t.count*2;}
        gl.enable(gl.CULL_FACE);
      }
      if(grow>0&&this.queue.some(d=>d.mesh.leaves)){
        const g=this.lu;gl.useProgram(this.leafProgram);gl.disable(gl.CULL_FACE);gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
        gl.uniform3f(g.center,c.x,c.y??8,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.time,this.time);gl.uniform1f(g.cloudTime,this.time);gl.uniform2f(g.worldOffset,...off);gl.uniform1f(g.grow,grow*grow*(3-2*grow));gl.uniform1f(g.shadowOn,shadows?1:0);
        if(shadows){gl.uniform3fv(g.lightAt,box.at);gl.uniform3fv(g.lightHalf,box.half);gl.uniformMatrix3fv(g.lightAxes,false,LIGHT_AXES);gl.uniform1f(g.shadowTexel,box.texel);}
        for(const d of this.queue){const t=d.mesh.leaves;if(!t||!this.onScreen(d))continue;gl.uniform3fv(g.origin,d.origin);gl.uniform3fv(g.scale,d.scale);gl.uniform3fv(g.patternOrigin,d.patternOrigin);gl.uniform2f(g.dither,d.dither[0],d.dither[1]);gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,6,t.count);this.draws++;this.triangles+=t.count*2;}
        gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);gl.enable(gl.CULL_FACE);
      }
      if(scene){
        const W=scene.w,H=scene.h,p=this.pu;
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER,scene.msaa);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,scene.resolve);
        gl.blitFramebuffer(0,0,W,H,0,0,W,H,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H);
        gl.useProgram(this.postProgram);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,scene.color);gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,scene.depth);gl.activeTexture(gl.TEXTURE0);
        gl.uniform2f(p.texel,1/W,1/H);gl.uniform1f(p.depthRange,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));
        // Lines only where the depth jumps by about a metre up close, more as the view widens (tens of metres at continent
        // view, where only cliffs and isles ink); they fade out over the widest zooms.
        gl.uniform1f(p.width,Math.max(1,this.pixelRatio));gl.uniform1f(p.threshold,Math.max(1.2,c.span*.012));gl.uniform1f(p.ink,.75*(1-Math.min(1,Math.max(0,(c.span-600)/1200))));
        gl.disable(gl.DEPTH_TEST);gl.bindVertexArray(this.postVao);gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.DEPTH_TEST);gl.bindVertexArray(null);
      }
      // Clouds fade in from ~150 m spans to full by ~400 m, drawn last over everything (after the outlines, so no lines
      // show through them).
      const fade=Math.min(1,Math.max(0,(c.span-150)/250));
      if(fade>0&&(this.cloudOpacity??.85)>0){
        const k=this.ku,b=this.bounds(c,CLOUD_HEIGHT);
        gl.useProgram(this.cloudProgram);gl.bindVertexArray(this.cloudVao);gl.bindBuffer(gl.ARRAY_BUFFER,this.cardBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
        gl.uniform3f(k.center,c.x,c.y??8,c.z);gl.uniform2f(k.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(k.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));
        gl.uniform2f(k.middle,(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2);gl.uniform2f(k.extent,(b.maxX-b.minX)/2+20,(b.maxZ-b.minZ)/2+20);
        gl.uniform2f(k.worldOffset,...off);
        gl.uniform1f(k.cloudTime,this.time);gl.uniform1f(k.cloudFade,fade*fade*(3-2*fade)*(this.cloudOpacity??.85));
        gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES,0,6);
        gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.bindVertexArray(null);
      }
      this.queue.length=0;
    }
    actor(a,time,reduced){
      const walk=reduced?0:Math.sin(time*7+a.phase)*.5,y=a.y;this.casting=true;
      const part=(dx,dy,dz,sx,sy,sz,mat,pitch=0)=>{
        const x=a.x+dx*Math.cos(a.yaw)+dz*Math.sin(a.yaw),z=a.z-dx*Math.sin(a.yaw)+dz*Math.cos(a.yaw);
        this.draw(this.cube,[x,y+dy,z],[sx,sy,sz],mat,a.yaw,pitch,[-.5,-1,-.5]);
      };
      part(-.18,.75,0,.22,.75,.24,12,walk);part(.18,.75,0,.22,.75,.24,12,-walk);
      part(0,1.35,0,.65,.65,.36,a.worker?13:10);part(0,1.78,0,.43,.42,.43,11);
      part(0,1.87,0,.5,.16,.48,a.worker?12:10);
      part(-.43,1.35,0,.18,.6,.2,a.worker?13:10,a.worker?-1.2:-walk);
      part(.43,1.35,0,.18,.6,.2,a.worker?13:10,a.worker?-1.2:walk);
      if(a.worker)part(0,1.13,.54,.62,.43,.4,4);
      else part(0,1.2,-.28,.42,.5,.22,12);
      this.casting=false;
    }
    project(camera,x,y,z){const halfY=camera.span/2/this.aspect,dx=x-camera.x,dz=z-camera.z;return {x:this.width*(.5+(dx*CY-dz*SY)/camera.span),y:this.height*(.5-((y-(camera.y??8))*C-(dx*SY+dz*CY)*S)/(2*halfY))};}
    screenDirection(right,down){return {x:right*CY+down*SY,z:-right*SY+down*CY};}
    pan(camera,dx,dy){const horizontal=-dx*camera.span/this.width,forward=-dy*camera.span/(this.width*S);camera.x+=horizontal*CY+forward*SY;camera.z+=-horizontal*SY+forward*CY;}
    bounds(camera,height){
      const points=[];
      for(const y of [0,height])for(const h of [-camera.span/2,camera.span/2])for(const v of [-camera.span/2/this.aspect,camera.span/2/this.aspect]){const f=((y-(camera.y??8))*C-v)/S;points.push({x:camera.x+h*CY+f*SY,z:camera.z-h*SY+f*CY});}
      return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
    }
    pick(camera,clientX,clientY,world){
      const r=this.canvas.getBoundingClientRect(),horizontal=(clientX-r.left-r.width/2)/r.width*camera.span,vertical=(.5-(clientY-r.top)/r.height)*camera.span/this.aspect;
      // March from the camera-facing end, so a cliff cannot select hidden ground behind itself.
      // Coarse 1 m steps find the first hit; 1/16 m steps from just above it place it exactly.
      const at=y=>{const forward=((y-(camera.y??8))*C-vertical)/S,x=camera.x+horizontal*CY+forward*SY,z=camera.z-horizontal*SY+forward*CY,ground=world.ground(x,z);return ground!==null&&y<=ground?{x,z,y:ground}:null;};
      for(let top=world.heightMetres;top>-1;top--)if(at(Math.max(0,top))){for(let y=Math.min(world.heightMetres,top+1);y>=0;y-=.0625){const hit=at(y);if(hit)return hit;}break;}
      return {x:-1,y:0,z:-1};
    }
  }
  root.MicroRenderer=Renderer;
})(globalThis);
