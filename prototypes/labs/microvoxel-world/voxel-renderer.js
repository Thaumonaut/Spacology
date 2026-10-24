(function(root){
  'use strict';
  const M=root.MicroWorld,ANGLE=50*Math.PI/180,S=Math.sin(ANGLE),C=Math.cos(ANGLE),YAW=35*Math.PI/180,SY=Math.sin(YAW),CY=Math.cos(YAW);
  const CAMERA_UNIFORMS=['skyHorizon','skyZenith','fogLit','fogShade','viewProj','eye','camRight','camUp','camForward','walkView','cameraNear','cameraFar','cameraPixelScale','fogAmount','fogTime','fogOffset','fogLayer','fogY','inverseViewProj'];
  const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  // Biome atmospheres, all at golden hour: sky horizon and zenith, and the sunlit and shaded fog colours. The renderer
  // blends the biomes around the view and eases toward them, so crossing a border shifts the sky over a few seconds.
  const SKY={
    base:[[.86,.81,.7],[.39,.64,.82],[1,.93,.82],[.64,.71,.8]],
    blossom:[[.94,.8,.86],[.56,.55,.86],[1,.88,.93],[.72,.64,.86]],
    pinkgrass:[[.93,.82,.84],[.5,.6,.86],[1,.9,.9],[.74,.68,.84]],
    heath:[[.9,.79,.82],[.45,.55,.8],[.98,.9,.92],[.7,.66,.8]],
    autumn:[[.96,.78,.58],[.46,.6,.8],[1,.86,.68],[.72,.62,.62]],
    redwood:[[.72,.82,.78],[.4,.6,.7],[.86,.93,.86],[.46,.62,.62]],
    rainforest:[[.78,.86,.78],[.38,.64,.72],[.9,.96,.88],[.56,.72,.68]],
    bamboo:[[.82,.88,.76],[.42,.66,.74],[.94,.97,.86],[.58,.72,.64]],
    fen:[[.8,.84,.78],[.44,.6,.7],[.9,.93,.86],[.58,.68,.68]],
    wetland:[[.8,.86,.8],[.4,.62,.74],[.92,.95,.9],[.58,.7,.72]],
    desert:[[.97,.82,.6],[.46,.62,.86],[1,.9,.72],[.8,.68,.58]],
    badlands:[[.97,.76,.56],[.48,.58,.82],[1,.86,.7],[.8,.62,.56]],
    savanna:[[.96,.84,.62],[.44,.63,.85],[1,.91,.74],[.78,.7,.6]],
    golden:[[.97,.84,.6],[.45,.62,.84],[1,.9,.7],[.78,.68,.58]],
    steppe:[[.92,.84,.68],[.42,.62,.84],[.98,.92,.78],[.72,.7,.66]],
    boreal:[[.76,.84,.84],[.34,.56,.8],[.88,.94,.92],[.48,.64,.68]],
    tundra:[[.84,.87,.9],[.34,.56,.86],[.96,.97,1],[.64,.72,.86]],
    snow:[[.86,.89,.94],[.32,.54,.88],[.97,.98,1],[.66,.74,.9]],
    glacier:[[.84,.9,.95],[.3,.56,.88],[.96,.99,1],[.62,.76,.9]],
    montane:[[.78,.84,.84],[.36,.58,.82],[.9,.94,.92],[.5,.64,.7]],
    beach:[[.88,.86,.78],[.34,.64,.88],[1,.95,.86],[.66,.76,.84]],
    sea:[[.84,.86,.82],[.32,.62,.88],[.98,.96,.9],[.62,.74,.86]]};
  const skyFor=b=>SKY[b]||SKY.base;
  // 4×4 inverse (column-major), for unprojecting depth in the post pass.
  function invert(m){
    const o=new Float32Array(16),[a,b,c,d,e,f,g,h,i,j,k,l,mm,n,p,q]=m;
    o[0]=f*k*q-f*l*p-j*g*q+j*h*p+n*g*l-n*h*k;o[4]=-e*k*q+e*l*p+i*g*q-i*h*p-mm*g*l+mm*h*k;o[8]=e*j*q-e*l*n-i*f*q+i*h*n+mm*f*l-mm*h*j;o[12]=-e*j*p+e*k*n+i*f*p-i*g*n-mm*f*k+mm*g*j;
    o[1]=-b*k*q+b*l*p+j*c*q-j*d*p-n*c*l+n*d*k;o[5]=a*k*q-a*l*p-i*c*q+i*d*p+mm*c*l-mm*d*k;o[9]=-a*j*q+a*l*n+i*b*q-i*d*n-mm*b*l+mm*d*j;o[13]=a*j*p-a*k*n-i*b*p+i*c*n+mm*b*k-mm*c*j;
    o[2]=b*g*q-b*h*p-f*c*q+f*d*p+n*c*h-n*d*g;o[6]=-a*g*q+a*h*p+e*c*q-e*d*p-mm*c*h+mm*d*g;o[10]=a*f*q-a*h*n-e*b*q+e*d*n+mm*b*h-mm*d*f;o[14]=-a*f*p+a*g*n+e*b*p-e*c*n-mm*b*g+mm*c*f;
    o[3]=-b*g*l+b*h*k+f*c*l-f*d*k-j*c*h+j*d*g;o[7]=a*g*l-a*h*k-e*c*l+e*d*k+i*c*h-i*d*g;o[11]=-a*f*l+a*h*j+e*b*l-e*d*j-i*b*h+i*d*f;o[15]=a*f*k-a*g*j-e*b*k+e*c*j+i*b*g-i*c*f;
    const det=a*o[0]+b*o[4]+c*o[8]+d*o[12];for(let x=0;x<16;x++)o[x]/=det;return o;
  }
  function cameraView(c,aspect,width){
    const ortho=c.mode!=='walk',yaw=ortho?YAW:c.yaw,pitch=ortho?-ANGLE:c.lookPitch||0;
    const right=[Math.cos(yaw),0,-Math.sin(yaw)],forward=[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
    const up=[-Math.sin(yaw)*Math.sin(-pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(-pitch)];
    const near=.08,far=c.viewDistance||600,fovY=(c.fov||70)*Math.PI/180,depth=Math.max(600,c.span*2.5/Math.min(1,aspect));
    const eye=ortho?[c.x+SY*C*depth,c.y+S*depth,c.z+CY*C*depth]:[c.x,c.eyeY??c.y,c.z];
    const m=new Float32Array(16);
    if(ortho){
      const hy=c.span/2/aspect;
      m.set([CY/(c.span/2),-SY*S/hy,-SY*C/depth,0, 0,C/hy,-S/depth,0, -SY/(c.span/2),-CY*S/hy,-CY*C/depth,0,
        -(c.x*CY-c.z*SY)/(c.span/2),-((c.y??8)*C-(c.x*SY+c.z*CY)*S)/hy,((c.y??8)*S+(c.x*SY+c.z*CY)*C)/depth,1]);
    }else{
      const f=1/Math.tan(fovY/2),A=(far+near)/(far-near),B=-2*far*near/(far-near);
      for(let i=0;i<3;i++){m[i*4]=right[i]*f/aspect;m[i*4+1]=up[i]*f;m[i*4+2]=forward[i]*A;m[i*4+3]=forward[i];}
      m[12]=-dot(right,eye)*f/aspect;m[13]=-dot(up,eye)*f;m[14]=B-A*dot(forward,eye);m[15]=-dot(forward,eye);
    }
    return {viewProj:m,eye,forward,right,up,near,far,fovY,ortho,pixelWorldAt:d=>ortho?c.span/width:2*Math.max(near,d)*Math.tan(fovY/2)/(width/aspect)};
  }
  // Keep the map arithmetic order: matrix multiplication can round differently at voxel edges.
  const CAMERA=`uniform mat4 viewProj;
  uniform vec3 eye, camRight, camUp;
  uniform float walkView, cameraPixelScale;
  out float viewDistance, viewDepth;
  vec4 toClip(vec3 p){
    vec4 clip=viewProj*vec4(p,1.);viewDistance=length(p-eye);viewDepth=clip.w;
    if(walkView>.5)return clip;
    vec3 q=p-center;float forward=q.x*${SY}+q.z*${CY};
    return vec4((q.x*${CY}-q.z*${SY})/halfView.x,(q.y*${C}-forward*${S})/halfView.y,-(q.y*${S}+forward*${C})/depth,1.);
  }
  float localPixel(vec3 p,float mapPixel){return walkView>.5?max(.001,cameraPixelScale*length(p-eye)):mapPixel;}`;
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
  uniform float yaw, pitch, overrideMaterial, depth, smoothMesh, xray;
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
    // Foam voxels stamped on rapids draw as water surface; the water shader paints the white water itself.
    mat=raw&127;if(mat==${M.MAT.foam})mat=${M.MAT.water};shaded=raw>>7;
    // Sun-view clip space: x/y across the light box, z increasing away from the sun.
    vec3 l=(p-lightAt)*lightAxes/lightHalf;
    lightCoord=l*.5+.5;
    #ifdef SHADOW
    gl_Position=vec4(l,1.);
    #else
    gl_Position=toClip(p);
    // X-ray silhouettes only for real cover: pulled 1.5 m toward the camera, a crew part shows through only where
    // something at least that far in front hides it (never their own body, gear or the grass at their feet).
    if(walkView>.5)gl_Position=toClip(p+normalize(eye-p)*xray*1.5);else gl_Position.z-=xray*1.5/depth;
    #endif
  }`;
  // Biome tint: undergrowth (ferns, bushes, tufts, reeds) takes the biome's palette, and soil and stone lean slightly toward
  // it, so every biome harmonises without per-biome hand tuning: a blossom grove's undergrowth runs pink, violet and white,
  // a redwood forest's dark forest greens. The key is the column's grass as the eye sees it (conifer woods darker and
  // greener); each plant picks that tone, a paler one or a cooler one. Brightness moves halfway to the key's.
  // Needs palette[] declared before it.
  const BIOME_TINT=`vec3 biomeTint(vec3 c,vec3 key,float k){
    float l=dot(c,vec3(.3,.59,.11)),kl=max(dot(key,vec3(.3,.59,.11)),.05);return mix(c,clamp(key*mix(l/kl,1.,.5),0.,1.),k);
  }
  float plantSeed(vec2 block){return fract(sin(dot(floor(block*.35),vec2(12.9898,78.233)))*43758.5453);}
  // rgb: the key for this plant; a: how far it is from green (0 green or golden biomes, 1 rose and violet ones); a<0: none.
  vec4 biomeKey(sampler2D map,float size,vec2 block,float seed){
    if(size<=0.)return vec4(-1);
    vec4 t=texelFetch(map,clamp(ivec2(block),ivec2(0),ivec2(int(size)-1)),0);int local=int(t.b*255.+.5);if(local<=0)return vec4(-1);
    vec3 g=palette[local];float green=1.-smoothstep(0.,.05,g.b-g.g);
    vec3 key=mix(mix(g,g*vec3(1.06,1.1,.82),green),vec3(.22,.36,.22),t.r*green*.8);
    float r=fract(seed*7.13+.31);key=r<.55?key:r<.8?mix(key,vec3(1.),.4):clamp(key*vec3(.85,.9,1.2),0.,1.);
    return vec4(key,1.-green);
  }
  vec3 undergrowth(sampler2D map,float size,vec2 block,vec3 c,float k,float seed){
    vec4 key=biomeKey(map,size,block,seed);return key.a<0.?c:biomeTint(c,key.rgb,k);
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
  uniform float normalSize, groundBase, caster, quadMask;
  uniform sampler2D normalMap;
  bool aboveGround(int m){return ${aboveGround};}
  void main(){
    if(quadMask>0.){int qd=(block.x>=${M.NODE_SIZE||32}.*.5?1:0)+(block.z>=${M.NODE_SIZE||32}.*.5?2:0);if(((int(quadMask)>>qd)&1)==1)discard;}
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
  // The warm yellow-green grading suits green and golden grasses; rose and violet ones (blue above green) skip it and keep
  // their own hue instead of turning beige.
  float greenness(vec3 c){return 1.-smoothstep(0.,.05,c.b-c.g);}
  vec3 forestGrass(vec3 grass,float tone){float g=greenness(grass);return mix(mix(grass,grass*vec3(1.06,1.1,.82),g),vec3(.2,.38,.33),tone*g);}
  vec3 meadow(vec2 p,vec3 grass){
    float broad=meadowNoise(p*.04),g=greenness(grass);
    return mix(grass*mix(vec3(.9),vec3(.86,.96,.86),g),grass*mix(vec3(1.08),vec3(1.08,1.13,.88),g),smoothstep(.3,.7,broad));
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
  // Soft caustics, kept cheap: the edges between jittered cells (one layer, a cheap arithmetic hash), wobbled by a sine
  // warp into rounded, wavy lines, at a width that tracks screen-space change so they stay smooth at every zoom.
  vec2 cellJitter(vec2 c){vec3 q=fract(vec3(c.xyx)*vec3(.1031,.103,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
  float caustic(vec2 p,float t){
    vec2 q=p*.95+.25*sin(p.yx*1.3+vec2(t*.5,t*.37)),cell=floor(q);float d1=9.,d2=9.;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=cell+vec2(x,y),o=.5+.4*sin(t*.35+6.2831*cellJitter(c));float e=length(q-c-o);if(e<d1){d2=d1;d1=e;}else if(e<d2)d2=e;}
    float e=d2-d1,w=.07+fwidth(e)*1.5;return 1.-smoothstep(0.,w,e);
  }
  // Low-poly water facets: a world-space equilateral triangle lattice (edge ~0.7 m) whose corners bob on travelling waves;
  // each triangle takes one flat normal from its three corner heights, so the surface reads as displaced facets.
  float waveHeight(vec2 v,float t){return .055*sin(dot(v,vec2(.8,.6))*2.3+t*.7)+.04*sin(dot(v,vec2(-.45,.89))*3.1+t*.95+1.7)+.025*sin(dot(v,vec2(.15,-.99))*4.7+t*1.3+4.1);}
  vec3 facetNormal(vec2 p,float t){
    // A slow warp stretches and squeezes the lattice, so facets range from about half to one and a half times the edge.
    p+=.55*vec2(sin(p.y*.9+sin(p.x*.37)*2.),sin(p.x*.8+sin(p.y*.41)*2.));
    const float E=.7;vec2 s=vec2(p.x+p.y*.57735,p.y*1.1547)/E,c=floor(s),f=fract(s);
    // Lower triangle: c, c+(1,0), c+(0,1); upper: c+(1,1), c+(1,0), c+(0,1) (lattice coordinates).
    vec2 a=f.x+f.y<1.?c:c+vec2(1,1),b=c+vec2(1,0),d=c+vec2(0,1);
    vec2 A=vec2(a.x-a.y*.5,a.y*.866)*E,B=vec2(b.x-b.y*.5,b.y*.866)*E,D=vec2(d.x-d.y*.5,d.y*.866)*E;
    vec3 PA=vec3(A.x,waveHeight(A,t),A.y),PB=vec3(B.x,waveHeight(B,t),B.y),PD=vec3(D.x,waveHeight(D,t),D.y);
    vec3 n=normalize(cross(PD-PA,PB-PA));return n.y<0.?-n:n;
  }
  // Flow-aligned patterns rotate positions into along/across the current. World coordinates run to thousands of metres,
  // where the flow direction's tiny per-pixel wobble would swing the rotated position by metres and turn the pattern to
  // static, so patterns are evaluated relative to anchors on a 16 m grid (with a per-anchor offset) and the four nearest
  // anchors are blended bilinearly, which leaves no seams.
  float currentLines(vec2 q,vec2 dir,float speed,float t){
    vec2 across=vec2(-dir.y,dir.x);float u=dot(q,dir),v=dot(q,across);
    return meadowNoise(vec2(u*.35-t*(.6+1.6*speed),v*1.8))*.7+meadowNoise(vec2(u*.9-t*(1.+2.*speed),v*4.1+3.))*.3;
  }
  float whiteWater(vec2 q,vec2 dir,float rapids,float t){
    vec2 across=vec2(-dir.y,dir.x);float u=dot(q,dir),v=dot(q,across);
    float bend=meadowNoise(vec2(v*.35,u*.12))*2.4,crestWave=sin(u*2.6+bend+sin(t*.7+v*.4)*.25)*.5+.5;
    float broken=smoothstep(.35,.6,meadowNoise(vec2(v*.55,floor(u*2.6/6.2832)*1.7)));
    float crest=smoothstep(.78,.9,crestWave)*broken;
    float trail=smoothstep(.6,.72,meadowNoise(vec2(u*.28-t*1.8*rapids,v*1.1)))*smoothstep(.2,.9,crestWave+.3)*.7;
    return max(crest,trail);
  }
  vec2 flowPatterns(vec2 p,vec2 dir,float speed,float rapids,float t){
    vec2 g=p/16.-.5,gi=floor(g),gf=fract(g),r=vec2(0);
    for(int k=0;k<4;k++){
      vec2 o=vec2(k&1,k>>1),c=(gi+o+.5)*16.;float w=(o.x>.5?gf.x:1.-gf.x)*(o.y>.5?gf.y:1.-gf.y);
      vec2 q=p-c+fract(sin(dot(gi+o,vec2(127.1,311.7)))*vec2(43758.5,24634.6))*37.;
      r+=w*vec2(speed>.2?currentLines(q,dir,speed,t):0.,rapids>.01?whiteWater(q,dir,rapids,t):0.);
    }
    return r;
  }
  float clouds(vec3 p){return 1.-.5*smoothstep(.56,.66,cloudField(p.xz+worldOffset+vec2(.5,-.4)*p.y));}`;
  // Fraction of sunlight reaching this point: five hardware-filtered taps soften the edge. The bias is about one block,
  // or two shadow texels when those are coarser, so a canopy does not shadow its own lit side.
  // Peek: inside a soft screen circle around the cursor (x, y in device pixels, radius; z 0 = off), canopy dissolves with a
  // dither so the forest floor shows through. Returns true where this fragment should be cut.
  const PEEK=`uniform vec3 peek;
  bool peeked(){
    if(peek.z<=0.)return false;
    float k=1.-smoothstep(peek.z*.7,peek.z,length(gl_FragCoord.xy-peek.xy));
    return k>fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
  }`;
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
  uniform float time, detail, normalSize, groundBase, blockSize, pixelWorld, cards, grassGrow, cloudTime, placeholder, xray, yBase, quadMask;
  uniform vec2 worldOffset;
  uniform vec2 dither;
  uniform sampler2D normalMap, canopyMap, biomeMap, waterMap, rockMap;
  uniform float rockOn;
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  const vec3 SUN=normalize(vec3(-.5,1.,.4));
  float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  // Patterns fade out before their wavelength drops under a few pixels, so they never alias into shimmer or moiré.
  float visible(float wavelength){return smoothstep(2.,5.,wavelength/pixelWorld);}
  ${SUNLIGHT}
  ${MEADOW}
  ${MATERIALS}
  ${BIOME_TINT}
  ${PEEK}
  void main(){
    // LOD dissolve: an incoming node keeps pixels below the fade threshold, the node it replaces keeps the rest.
    if(dither.x!=0.){float n=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(dither.x>0.?n>=dither.y:n<dither.y)discard;}
    // A coarse stand-in skips the quarters already drawn by finished finer nodes (bit per quarter, x then z).
    if(quadMask>0.){int qd=(block.x>=${M.NODE_SIZE||32}.*.5?1:0)+(block.z>=${M.NODE_SIZE||32}.*.5?2:0);if(((int(quadMask)>>qd)&1)==1)discard;}
    if(peek.z>0.&&normalSize>0.&&xray<.5){
      float groundTop=texture(normalMap,block.xz/normalSize).a*255.+groundBase;
      if((block.y-groundTop)*blockSize>1.6&&peeked())discard;
    }
    // Crew hidden behind trees or terrain show through as a warm translucent silhouette.
    if(xray>.5){color=vec4(1.,.84,.5,.55);glowOut=vec4(0);return;}
    vec3 n=normalize(normal);float cavity=0.;
    if(normalSize>0.){
      // Hillshade: distant blocks light as the slope they form, so treads and risers stop alternating into bands.
      // Close up, the block faces keep part of their own normal for a crisp voxel edge.
      // Only the ground takes it: sky isles and canopies above the local ground top keep their block faces.
      vec4 t=texture(normalMap,block.xz/normalSize);vec2 g=t.rg*2.-1.;
      float ground=t.a>.999?1.:step(block.y,t.a*255.+groundBase+.5);
      n=normalize(mix(n,vec3(g.x,sqrt(max(0.,1.-dot(g,g))),g.y),ground*(1.-.55*smoothstep(3.,12.,blockSize/pixelWorld))));
      cavity=clamp(t.b*2.-1.,-.5,.5)*ground;
      // Rock detail (generator's rockDetail, close nodes only): on bare rock, its normal (ledges, cracks, chips, already
      // including the broad slope) replaces the hillshade's and its cracks darken, fading out where it would be sub-pixel.
      if(rockOn>.5&&(isRock(mat)||isWarmRock(mat))){vec4 rd=texture(rockMap,block.xz/normalSize);
        float f=rd.a*ground*(walkView>.5?1.-smoothstep(25.,60.,viewDistance):visible(.6));
        if(f>.01){vec2 g2=rd.rg*2.-1.;n=normalize(mix(n,vec3(g2.x,sqrt(max(0.,1.-dot(g2,g2))),g2.y),f));cavity-=rd.b*f*.55;}}
    }
    // Warm sun over a cool sky fill; ridges catch a little more light than hollows.
    float key=max(0.,dot(n,SUN));
    // Shadow only removes the sun term, so shade keeps the sky fill: a soft afternoon shadow, never a black one.
    // A coarser tile standing in for finer ones keeps the same lighting (so long-lived fallback coverage never shows a
    // brightness step along tile edges); it only skips sun shadows, which its blocky shapes would cast wrongly.
    float sunVis=(placeholder>0.?1.:sunlight())*clouds(localPosition+vec3(0,yBase,0)),sun=sunVis;if(isBladeGrass(mat))sun=.45+.55*sun;
    vec3 light=mix(vec3(.62,.58,.52),vec3(.78,.82,.9),n.y*.5+.5)*.72+vec3(1.,.95,.85)*key*.45*sun;
    // Relief lighting for mountains: rock, and ground in proportion to its steepness, gets a warm strong sun over a cool
    // darker fill, so peaks and slopes read as form (sunward faces bright and warm, shaded faces cool, never black).
    // Flat meadows keep the softer light above.
    float relief=isLeaf(mat)||isBark(mat)||mat==7?0.:isRock(mat)||isWarmRock(mat)?1.:smoothstep(.12,.55,1.-n.y);
    vec3 form=mix(vec3(.46,.5,.64),vec3(.64,.7,.84),n.y*.5+.5)*.72+vec3(1.1,.96,.78)*key*.68*sun;
    light=mix(light,form,relief);
    light*=1.+cavity*mix(.3,.65,relief);
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
    if(normalSize>0.){
      bool under=mat==${M.MAT.bushLeaf}||mat==${M.MAT.fern}||mat==${M.MAT.tuft}||mat==${M.MAT.mossy}||mat==${M.MAT.vine};
      float k=under?.85:isBladeGrass(mat)||isLeaf(mat)||isBark(mat)||mat==7||mat==19||mat==20?0.:.12;
      if(k>0.)base=undergrowth(biomeMap,normalSize,block.xz,base,k,under?plantSeed(block.xz):0.);
    }
    // Moss: fuzzy, a fine stipple of lighter tips and darker hollows, a little brighter on top.
    if(mat==${M.MAT.mossy}){
      vec3 w=worldPosition*14.;float f=hash(floor(w))*.6+hash(floor(w*2.3+.5))*.4;
      base*=mix(1.,.8+.38*f+(normal.y>.5?.06:0.),visible(.1));
    }
    // Ruin masonry: dressed blocks in 0.45 m courses, each 0.8 m stone offset from the course below, with its own tone and
    // a slightly darker, chipped mortar joint; tops read as a grid of laid stones. Fades to the plain colour when small.
    if(mat==${M.MAT.masonry}){
      vec3 w=worldPosition;bool top=abs(normal.y)>.5;float along=abs(normal.x)>abs(normal.z)?w.z:w.x,row=floor(w.y/.45);
      vec2 q=top?w.xz/vec2(.8,.45):vec2(along/.8+row*.5,w.y/.45);vec2 cell=floor(q),f=fract(q);
      float tone=hash(vec3(cell,top?7.:3.)),joint=min(min(f.x,1.-f.x)*.8,min(f.y,1.-f.y)*.45);
      float chip=meadowNoise(w.xz*3.1+w.y*2.7)*.03;
      base*=mix(1.,(.88+.2*tone)*mix(.72,1.,smoothstep(.025+chip,.05+chip,joint)),visible(.45));
    }
    // Vertical water (waterfalls) carries bright streaks running down.
    if(mat==7&&abs(normal.y)<.2)base+=vec3(.1)*step(.7,fract(worldPosition.y*.8+time*2.4+floor(worldPosition.x*1.7+worldPosition.z*1.3)*.37))*visible(1.2);
    // Stylized water on the surface: depth bands from turquoise shallows to deep blue (depth from the biome map's alpha,
    // filtered so it fades toward shores), broken white foam where it meets land, rocks or lily pads, a faint wave line
    // rolling shoreward, and blinking sun glints.
    // Stylized water, after the user's references: calm and simple. Clear in the shallows (the bed shows through),
    // deepening to teal-blue with depth and distance from the banks; one soft caustic pattern carried downstream by a
    // two-phase flow map; a lighter band inside the shore with a thin antialiased white edge.
    vec4 wm=normalSize>0.?texture(waterMap,block.xz/normalSize):vec4(.125,1.,.5,.5);
    float waterM=wm.r*8.,shoreM=wm.g*4.;vec2 flow=wm.ba*2.-1.;
    if(mat==7&&normal.y>.2){
      vec2 p=worldPosition.xz;
      // Colour from depth alone: the shore-distance estimate differs between detail levels and drew seams.
      float look=waterM;
      vec3 bed=vec3(.74,.71,.56),col=mix(mix(vec3(.36,.8,.79),vec3(.15,.6,.73),smoothstep(.2,1.,look)),vec3(.08,.34,.6),smoothstep(1.2,3.5,look));
      base=mix(bed*vec3(.86,1.,.98),col,.3+.7*smoothstep(.0,.5,look));
      float speed=length(flow);vec2 dir=speed>.05?flow/speed:vec2(0);float rush=smoothstep(.15,1.,speed);
      // Faster water carries its pattern further and quicker; lakes and pools barely drift.
      float ph=time*(.06+.5*rush),w=abs(fract(ph)*2.-1.);
      // Caustics and current lines give way to white water in rapids (layered fine patterns read as static there).
      float calmPart=1.-smoothstep(.65,.9,speed),show=visible(.6)*calmPart;
      if(show>.01){
        float reach=1.4+3.*rush;float c=mix(caustic(p-dir*fract(ph)*reach,time),caustic(p-dir*fract(ph+.5)*reach+5.3,time),w);
        base=mix(base,base*1.1+vec3(.1,.14,.13),c*.42*(1.-smoothstep(.8,3.,look)*.6)*show);
      }
      base=mix(base,base*1.08+vec3(.05,.07,.06),smoothstep(.5,.12,shoreM)*.6);
      // Current: soft lighter lines stretched along the flow and drifting downstream, so any river reads as moving.
      float rapids=smoothstep(.75,1.,speed);
      vec2 fp=speed>.2?flowPatterns(p,dir,speed,rapids,time):vec2(0);
      if(speed>.2)base=mix(base,base*1.08+vec3(.09,.13,.12),smoothstep(.58,.72,fp.x)*smoothstep(.2,.5,speed)*.75*visible(.5)*calmPart);
      // White water, as readable shapes: broken standing-wave crests across the current every couple of metres (they barely
      // move, as in real rapids) with soft foam trails streaming downstream, over aerated turquoise.
      if(rapids>.01){
        base=mix(base,mix(base,vec3(.6,.9,.92),.5),rapids);
        base=mix(base,vec3(.95,.99,1.),fp.y*rapids*visible(1.2));
      }
      float edge=shoreM+(meadowNoise(p*1.8+dir*time*(.4+2.*rush))-.5)*(.04+.08*rapids),aa=max(fwidth(edge)*1.2,.006);
      base=mix(base,vec3(.97,.99,1.),1.-smoothstep(.06,.06+aa,edge));
    }
    if(mat==1&&normal.y<.5)base+=vec3(.045)*step(.85,fract(worldPosition.y*.7))*visible(1.4);
    if(mat==6)base+=vec3(.012,.025,.005)*sin(worldPosition.y*1.6)*visible(3.9);
    // Lowlands sit slightly darker; high ground brightens toward the summits so tall ranges read at any zoom.
    float heightShade=.88+.12*clamp(worldPosition.y/15.,0.,1.)+.14*clamp((worldPosition.y-24.)/140.,0.,1.);
    vec3 lit=base*(light+grain)*heightShade;
    if(walkView>.5&&(mat==${M.MAT.bark}||mat==${M.MAT.redwood})){
      vec2 p=worldPosition.xz;float warp=meadowNoise(vec2(worldPosition.y*.12,p.x*.35+p.y*.27))-.5;
      float ridge=sin((p.x+p.y)*4.8+warp*1.8),fine=sin((p.x-p.y)*15.+warp*3.);
      float relief=(ridge*.16*visible(1.3)+fine*.045*visible(.4))*(1.-abs(normal.y));
      lit*=1.+relief;lit+=vec3(.035,.025,.015)*max(0.,ridge)*visible(1.3)*key*sun;
    }
    // Aether crystal and moss carry their own light.
    if(mat==19)lit=base*(.82+.18*(.58+.42*key))+vec3(.1,.06,.16)*(.6+.4*sin(time*1.3+worldPosition.y*.9+worldPosition.x*.3));
    if(mat==20)lit+=vec3(.03,.02,.06)*(.6+.4*sin(time*.8+worldPosition.x*.7+worldPosition.z*.5));
    // Ground under a sky isle is pre-darkened by the generator; with shadows on the isle casts its own.
    if(shaded>0&&shadowOn<.5)lit*=.6;
    // Water reads flat and bright: shade only gently, then sparkle where the sun catches it.
    float glint=0.;
    if(mat==7&&normal.y>.2){
      // Each low-poly facet shades flat: tilted toward the sun a touch brighter, away a touch darker.
      vec3 fn=facetNormal(worldPosition.xz,time);float facet=dot(fn,SUN)-dot(vec3(0,1,0),SUN);
      // Facets turned away from the sun shift toward a deeper, bluer tone rather than going dark.
      float fv=facet*visible(.35)*(1.-smoothstep(.75,1.,length(wm.ba*2.-1.))*.8);
      lit=base*mix(.82,1.04,sunVis)*heightShade*(1.+max(fv,0.)*2.2);
      lit=mix(lit,lit*vec3(.8,.92,1.08),clamp(-fv*9.,0.,1.));
      // Sun glints: a small moving wave normal per pixel; where a facet tilts to reflect the sun into the camera, the surface
      // flares. The camera's reflection angle stands in for the sun direction (a true reflection would sit off-screen).
      // Glints follow their own facet field on a clock ten times slower, so each flash lingers instead of flickering.
      vec2 wp=worldPosition.xz;float t=time;vec3 wn=facetNormal(wp,time*.1);
      glint=smoothstep(walkView>.5?.995:.99975,walkView>.5?.9995:.99998,walkView>.5?dot(reflect(-SUN,wn),normalize(eye-worldPosition)):dot(wn,normalize(vec3(-.07,1.,-.05))))*sunVis*smoothstep(.3,.9,waterM)*visible(.15);
      lit+=vec3(1.,.96,.86)*glint*.6;
    }
    // Anime crowns: leaves light by the rounded canopy shape, not their block faces, in three flat bands (sunny
    // yellow-green, leaf green, cool teal shadow), broken into leafy puffs and darker beneath the crown.
    // Map-only crown camouflage hides bark tips from above; Walk keeps the actual bark on trunks and branches.
    bool trunkInCrown=false;
    if(walkView<.5&&isBark(mat)&&normalSize>0.){
      float ground=texture(normalMap,block.xz/normalSize).a*255.+groundBase,crown=max(texture(canopyMap,block.xz/normalSize).b*255.,1.),h=(block.y-ground)/crown;
      trunkInCrown=h>.45;
    }
    if(isLeaf(mat)||trunkInCrown){
      vec3 cn=normalize(normal);float below=0.;
      if(normalSize>0.){
        vec4 c=texture(canopyMap,block.xz/normalSize);vec2 g=c.rg*2.-1.;
        // The heightfield describes the crown top, not the underside seen from the ground.
        float faceWeight=walkView>.5?(normal.y<-.1?1.:.35):.22;
        cn=normalize(mix(vec3(g.x,sqrt(max(0.,1.-dot(g,g))),g.y),cn,faceWeight));
        vec4 t=texture(normalMap,block.xz/normalSize);below=(t.a*255.+groundBase+c.b*255.-block.y)*blockSize;
      }
      vec3 w=worldPosition;float puff=meadowNoise(w.xz*.32+w.y*.25)*.75+meadowNoise(w.xz*.9-w.y*.6+3.7)*.25-.5;
      float tone=(dot(cn,SUN)*.5+.5)*mix(.55,1.,sunVis)+puff*.3-smoothstep(.6,3.5,below)*.3-(trunkInCrown?.25:0.);
      if(walkView>.5)tone-=(1.-smoothstep(-.35,.25,normal.y))*.14;
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
      vec3 shadow,mid,high;crownBands(trunkInCrown?(pine?${M.MAT.needle}:${M.MAT.leaf}):mat,mat==${M.MAT.bushLeaf}||mat==${M.MAT.vine}?base:palette[mat],shadow,mid,high);
      // Plain green crowns (leaf, needle) in a rose or violet biome take its colours too, one tone per tree.
      if(normalSize>0.&&(mat==${M.MAT.leaf}||mat==${M.MAT.needle}||trunkInCrown)){vec4 key=biomeKey(biomeMap,normalSize,block.xz,plantSeed(block.xz*.5));if(key.a>0.){float k=.8*key.a;shadow=biomeTint(shadow,key.rgb,k);mid=biomeTint(mid,key.rgb,k);high=biomeTint(high,key.rgb,k);}}
      if(walkView>.5){shadow*=vec3(.92,.96,1.04);high*=vec3(1.03,1.01,.97);}
      // Broadleaf crowns get softer band edges so a crown reads as a few big lobes, not a cluster of florets.
      float soft=pine?.03:(walkView>.5?.13:.07);
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
    // Alpha marks what may carry an ink outline. The second output carries sun-glint strength for the bloom.
    color=vec4(lit,mat==9||dither.x!=0.||placeholder>0.?0.:1.);
    glowOut=vec4(glint,0,0,1);
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
    float a=rand(k)*6.2832,r=.13*sqrt(rand(k+.5)),h=(.34+.34*rand(k+.25))*grow*(walkView>.5?1.-smoothstep(30.,60.,length(origin+tuft.xyz*scale-eye)):1.)*mix(.35,1.,cover),w=.055+.03*rand(k+.75);
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
    gl_Position=toClip(p);
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
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  ${SUNLIGHT}
  ${MEADOW}
  void main(){
    glowOut=vec4(0);
    if(dither.x!=0.){float n=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(dither.x>0.?n>=dither.y:n<dither.y)discard;}
    // Root matches the ground (same field, same .86 shade); tips lift toward sunlit yellow-green, more so in a gust.
    // Anime grass: one clean gradient from the ground's colour to a bright tip, a sheen where gusts pass, and shadow as a
    // light cool tint.
    vec3 ground=meadow(field,forestGrass(palette[bladeMat],conifer))*.86,tip=ground*mix(vec3(1.25),vec3(1.32,1.3,1.),greenness(ground))+mix(vec3(.06),vec3(.06,.07,.03),greenness(ground))*sheen;
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
  uniform float depth, time, grow, biomeSize;
  uniform vec3 palette[96];
  uniform sampler2D biomeMap;
  out vec3 lightCoord, outward;
  out vec2 uv, field;
  out float seed, pine, snowCover;
  flat out int leafMat;
  flat out vec3 cardTint;
  flat out vec4 crownKey;
  ${BIOME_TINT}
  void main(){
    seed=fract(card.w);leafMat=int(card.w);cardTint=palette[leafMat];
    // Bushes take the biome's colour like the rest of the undergrowth; tree crowns keep their species colours.
    if(leafMat==${M.MAT.bushLeaf}||leafMat==${M.MAT.vine})cardTint=undergrowth(biomeMap,biomeSize,card.xz,cardTint,.85,plantSeed(card.xz));
    crownKey=vec4(0);if(leafMat==${M.MAT.leaf}||leafMat==${M.MAT.needle}){vec4 key=biomeKey(biomeMap,biomeSize,card.xz,plantSeed(card.xz*.5));if(key.a>0.)crownKey=vec4(key.rgb,.8*key.a);}
    snowCover=floor(facing.w/20.)/3.;float packed=mod(facing.w,20.);pine=step(10.,packed);outward=facing.xyz;
    // Broadleaf clumps spin freely; conifer sprigs stay upright with a slight tilt so the crown keeps its cone.
    float size=(packed-10.*pine)*grow,a=mix(seed*6.2832,(seed-.5)*.5,pine);
    // Palm fronds point along their outward direction (projected to the screen) and are long, so crowns radiate.
    if(leafMat==${M.MAT.palmLeaf}){vec2 o=vec2(outward.x*${CY}-outward.z*${SY},outward.y*${C}-(outward.x*${SY}+outward.z*${CY})*${S});a=atan(o.x,-o.y)+(seed-.5)*.5;size*=1.9;}
    vec2 at=patternOrigin.xz+card.xz*scale.x;field=(origin+card.xyz*scale).xz;
    float sway=sin(time*1.7+dot(at,vec2(.6,.35))*.8+seed*6.)*.04+.05*pow(.5+.5*sin(dot(at,vec2(.92,.39))*.32-time*1.15),3.);
    vec3 p=origin+card.xyz*scale+outward*size*mix(.25,.1,pine);
    uv=mat2(cos(a),-sin(a),sin(a),cos(a))*corner;
    vec3 l=(p-lightAt)*lightAxes/lightHalf;lightCoord=l*.5+.5;
    gl_Position=toClip(p);
    // Wind sways a card on screen only, never in depth, so overlapping clumps cannot trade places as they move.
    if(walkView>.5){
      float distance=length(p-eye);size*=smoothstep(1.5,3.,distance)*(1.-smoothstep(30.,60.,distance));
      vec2 shift=corner*size*.5+vec2(.92,.2)*sway*min(card.y*scale.y,30.)*.02;
      p+=camRight*shift.x+camUp*shift.y+normalize(eye-p)*(size*.5+seed*.02);
      gl_Position=toClip(p);
    }else{    gl_Position.xy+=(corner*size*.5+vec2(.92,.2)*sway*min(card.y*scale.y,30.)*.02)/halfView;
    gl_Position.z-=(size*.5+seed*.02)/depth;
    }
    // Drawn half a card nearer the camera: enough to clear its own crown's blocks, not a neighbouring tree in front.
    // A fixed per-card nudge breaks depth ties, so the same clump always wins where two overlap.
  }`;
  const leafFragment=`#version 300 es
  precision highp float;
  in vec3 lightCoord, outward;
  in vec2 uv, field;
  in float seed, pine, snowCover;
  flat in int leafMat;
  flat in vec3 cardTint;
  flat in vec4 crownKey;
  uniform vec3 palette[96];
  uniform vec3 lightHalf;
  uniform float shadowOn, shadowTexel, blockSize, leafShape, cloudTime;
  uniform vec2 worldOffset;
  uniform vec2 dither;
  uniform highp sampler2DShadow shadowMap;
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  const vec3 SUN=normalize(vec3(-.5,1.,.4));
  ${SUNLIGHT}
  ${MEADOW}
  ${MATERIALS}
  ${BIOME_TINT}
  // Signed distance to an upright triangle of the given size (negative inside).
  float triangle(vec2 p,float size){p/=size;p.x=abs(p.x)-1.;p.y+=.577;if(p.x+1.732*p.y>0.)p=vec2(p.x-1.732*p.y,-1.732*p.x-p.y)*.5;p.x-=clamp(p.x,-2.,0.);return -length(p)*sign(p.y)*size;}
  ${PEEK}
  void main(){
    if(peeked())discard;
    glowOut=vec4(0);
    if(dither.x!=0.){float n=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(dither.x>0.?n>=dither.y:n<dither.y)discard;}
    float r=length(uv),ang=atan(uv.y,uv.x),lobes=meadowNoise(vec2(ang*2.2+seed*40.,seed*9.))*.5+meadowNoise(uv*5.+seed*23.)*.5;
    // Outline. Broadleaf: a round clump. Conifer, by leafShape: 0 round, 1 soft triangle, 2 hard triangle, 3 round or
    // soft per card, 4 any of the three. Rims are chewed into leaves; hard triangles only lightly.
    float pick=fract(seed*7.13),shape=leafShape<2.5?leafShape:leafShape<3.5?step(.5,pick):floor(pick*3.);
    float round=r-(.62+.36*lobes),soft=triangle(uv,.6)-.24+(lobes-.5)*.12,hard=triangle(uv,.9)-.03+(lobes-.5)*.05;
    float edge=pine<.5||shape<.5?round:shape<1.5?soft:hard;
    // Palm frond: a rib arching from the card centre outward (toward -y) and drooping, lined with comb-like leaflets.
    bool palm=leafMat==${M.MAT.palmLeaf};float along=0.;
    if(palm){
      along=clamp(-uv.y*.5+.5,0.,1.);float ribX=uv.x-.35*along*along*sign(seed-.5),width=.07+.42*sin(along*3.1416)*(1.-along*.3);
      float leaflet=abs(fract((along*9.+abs(ribX)*2.2))-.5);
      edge=abs(ribX)-width*(1.-smoothstep(.32,.5,leaflet)*.55)-(uv.y>.95?1.:0.);
      if(along<.04)edge=1.;
    }
    // Antialiased rim: coverage from the outline's screen-space slope (alpha to coverage on the multisampled canvas).
    float coverage=clamp(.5-edge/max(fwidth(edge),1e-4),0.,1.);if(coverage<=0.)discard;
    // Inside the clump: small leaves (nearest of jittered cell points), each with its own shade, softly darker in gaps.
    vec2 g=uv*4.6+seed*17.,cell=floor(g);float d=9.,leafId=0.;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=cell+vec2(x,y),o=vec2(fract(sin(dot(c,vec2(12.9,78.2)))*43758.5),fract(sin(dot(c,vec2(39.3,11.1)))*24634.6));float e=length(g-c-o);if(e<d){d=e;leafId=fract(o.x*7.+o.y*3.);}}
    float gap=smoothstep(.35,.7,d);
    // Each clump shades as a small tuft: lit toward the sun and its top, darker at its base and rim, a little hue drift.
    float tone=(dot(normalize(outward),SUN)*.5+.5)*mix(.55,1.,sunlight()*clouds(vec3(field.x,0,field.y)))+(leafId-.5)*.1+dot(uv,vec2(-.4,.5))*.2-r*.12-gap*.12+.12;
    vec3 shadow,mid,high;crownBands(leafMat,cardTint,shadow,mid,high);
    if(crownKey.a>0.){shadow=biomeTint(shadow,crownKey.rgb,crownKey.a);mid=biomeTint(mid,crownKey.rgb,crownKey.a);high=biomeTint(high,crownKey.rgb,crownKey.a);}
    if(palm){tone+=.18*along-.1;high=mix(high,vec3(.86,.9,.42),.35);}
    vec3 c=mix(mix(shadow,mid,smoothstep(.3,.36,tone)),mix(mid,high,.65),smoothstep(.8,.86,tone));
    // Snow on the upper part of clumps facing up, on trees standing on snowy ground.
    if(snowCover>0.)c=mix(c,mix(vec3(.74,.8,.92),vec3(.98,.98,1.),smoothstep(.4,.7,tone)),smoothstep(.15,.45,uv.y+(lobes-.5)*.5+outward.y*.4)*smoothstep(0.,.5,snowCover));
    color=vec4(c*(.96+.08*fract(seed*3.7))+vec3(-.01,.01,0)*fract(seed*11.),coverage);
  }`;
  // Cloud layer for wide views: a plane high above the land shaded from the same noise as the cloud shadows (offset
  // along the sun by its height), so each cloud floats exactly over its shadow. Anime cumulus: white sunlit tops, a soft
  // blue-grey band on the far side, soft rims. Fades in only as the view widens.
  // Cloud deck: 620 m over lowland, riding 600 m above the view over high ground (see cloudHeight); the cloud pattern
  // keeps this fixed reference height so the deck does not slide as it rises.
  const CLOUD_HEIGHT=620;
  const cloudVertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec2 corner;
  uniform vec3 center;
  uniform vec2 halfView, extent, middle;
  uniform float depth, cloudY;
  out vec2 at;
  void main(){
    vec3 p=vec3(middle+corner*extent,cloudY).xzy;at=p.xz;
    gl_Position=toClip(p);
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
  uniform sampler2D sceneColor, sceneGlow;
  uniform highp sampler2D sceneDepth;
  uniform vec2 texel;
  uniform float depthRange, threshold, ink, width, walkView, cameraNear, cameraFar, fogAmount, fogTime, fogY;
  uniform vec3 skyHorizon, skyZenith, fogLit, fogShade;
  uniform vec2 fogOffset, fogLayer;
  uniform vec3 eye;
  uniform mat4 inverseViewProj;
  out vec4 color;
  // Fog banks: drifting 3D noise clouds in a layer resting on fogLayer.x (the ground under the view, or the walker's feet),
  // densest low and thinning over fogLayer.y metres, carried by the wind and slowly churning. Each pixel marches its view
  // ray through the layer in ten jittered steps, so banks have thickness, overlap, part and pass in front of one another
  // (and of the sky in Walk). Tops and sun-facing sides catch warm light; the insides stay cool.
  float fogHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float fogNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
    return mix(mix(mix(fogHash(i),fogHash(i+vec3(1,0,0)),f.x),mix(fogHash(i+vec3(0,1,0)),fogHash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(fogHash(i+vec3(0,0,1)),fogHash(i+vec3(1,0,1)),f.x),mix(fogHash(i+vec3(0,1,1)),fogHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float bank(vec3 p,out float h){
    h=(p.y-fogLayer.x)/fogLayer.y;
    vec2 w=p.xz+fogOffset-fogTime*vec2(1.1,.45);
    vec3 q=vec3(w.x/52.,(p.y+fogY)/8.,w.y/52.);
    // Weather: whole stretches lie under fog while others are clear (~350 m drifts), banks within them.
    float weather=smoothstep(.3,.62,fogNoise(vec3(w/350.,fogTime*.004)));
    float n=fogNoise(q)*.62+fogNoise(q*2.3+vec3(0,fogTime*.025,0))*.38;
    return smoothstep(.56,.72,n+.2*weather-abs(h)*.14)*exp(-abs(h)*.8);
  }
  vec3 fogBanks(vec3 to,inout float T){
    // The layer is a slab 3 thicknesses either side of its base: valleys far below and peaks far above stay clear.
    vec3 r=to-eye;float top=fogLayer.x+3.*fogLayer.y,bottom=fogLayer.x-3.*fogLayer.y,t0=0.,t1=1.;
    if(abs(r.y)>1e-4){float a=(top-eye.y)/r.y,b=(bottom-eye.y)/r.y;t0=max(t0,min(a,b));t1=min(t1,max(a,b));}else if(eye.y>top||eye.y<bottom)return vec3(0);
    float L=length(r);t1=min(t1,t0+(walkView>.5?320.:600.)/L);
    if(t0>=t1)return vec3(0);
    float seg=(t1-t0)*L/10.,jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))),k=fogAmount*(walkView>.5?.06:.16);
    vec3 sun=normalize(vec3(-.5,1.,.4)),dir=r/L,acc=vec3(0);float glow=pow(max(0.,dot(dir,sun)),4.);
    for(int i=0;i<10;i++){
      vec3 p=eye+r*mix(t0,t1,(float(i)+jitter)/10.);float h,d=bank(p,h)*k;if(d<=0.)continue;
      float a=1.-exp(-d*seg);
      vec3 lit=mix(fogShade,fogLit,clamp(.45+h*.3-d*3.,0.,1.))+vec3(.12,.07,.02)*glow;
      acc+=T*a*lit;T*=1.-a;if(T<.03)break;
    }
    return acc;
  }
  float metres(vec2 uv){float d=texture(sceneDepth,uv).r;return walkView>.5?cameraNear*cameraFar/(cameraFar-d*(cameraFar-cameraNear)):d*2.*depthRange;}
  void main(){
    vec2 uv=gl_FragCoord.xy*texel;vec4 s=texture(sceneColor,uv);vec3 c=s.rgb;float edge=0.;
    // Two rings of eight neighbours: the inner ring draws the line's core, the outer ring a softer fringe, so lines are
    // about two pixels wide (scaled with the device pixel ratio) and feather off rather than stopping hard.
    if(ink>0.){
      float d=metres(uv);
      for(int r=1;r<=2;r++)for(int i=0;i<8;i++){
        float a=float(i)*.7854;vec2 o=vec2(cos(a),sin(a))*float(r)*width*texel;
        float limit=walkView>.5?max(.6,d*.015):threshold;
        edge=max(edge,smoothstep(limit,limit*2.2,metres(uv+o)-d)*(r==1?1.:.45));
      }
      if(walkView>.5)edge*=1.-smoothstep(12.,100.,d);
    }
    // Bloom: sun glints (alpha strictly between 0 and 1) glow outward like a blown-out sensor, with a faint four-point streak.
    float glow=0.;
    for(int r=1;r<=4;r++)for(int i=0;i<8;i++){
      float a=float(i)*.7854,d=float(r*r+1)*1.6*width;vec2 o=vec2(cos(a),sin(a))*d*texel;float g=texture(sceneGlow,uv+o).r;
      glow+=g*(i==0||i==2||i==4||i==6?1.4:1.)/float(r*r+1);
    }
    float self=texture(sceneGlow,uv).r;
    vec3 shade=c*(walkView>.5?vec3(.67,.72,.76):vec3(.46,.48,.6));
    vec3 inked=mix(c,shade,edge*ink*s.a);
    // Layered atmosphere, each layer capped so none becomes a wall: in Walk, aerial perspective (a sky-tinted haze that
    // warms toward the sun, nothing within ~12 m) and a thin ground-hugging mist; then the drifting fog banks.
    vec3 scene=inked+vec3(1.,.95,.84)*(glow*.55+self*.5),clear=scene;float T=1.,seen=1.;vec3 fog=vec3(0);
    if(fogAmount>0.){
      float z=texture(sceneDepth,uv).r;
      if(z<1.||walkView>.5){
        vec4 w=inverseViewProj*vec4(uv*2.-1.,min(z,.99999)*2.-1.,1.);vec3 to=w.xyz/w.w;
        if(walkView>.5&&z<1.){
          vec3 r=to-eye;float d=length(r);vec3 dir=r/d,sun=normalize(vec3(-.5,1.,.4));
          vec3 sky=mix(skyHorizon,skyZenith,smoothstep(0.,.85,dir.y));
          vec3 air=mix(mix(fogShade,skyHorizon,.45),sky,smoothstep(60.,320.,d))+vec3(.16,.09,.02)*pow(max(0.,dot(dir,sun)),5.);
          float aerial=(1.-exp(-max(0.,d-12.)*.007*fogAmount))*.6;
          scene=mix(scene,air,aerial);
          // Ground mist: a 2.5 m layer around the feet (mean density from three points along the ray), so grazing views
          // thicken while views down into a valley or up a slope stay clear.
          float B=fogLayer.x,H=2.5;vec3 mid=(eye+to)*.5;
          float mean=(exp(-abs(eye.y-B)/H)+exp(-abs(mid.y-B)/H)+exp(-abs(to.y-B)/H))/3.;
          float mist=(1.-exp(-mean*d*.02*fogAmount))*.4;
          scene=mix(scene,mix(air,fogLit,.5),mist);seen=(1.-aerial)*(1.-mist);
        }
        // Banks never hide more than 60% on their own (their light scaled down to match).
        fog=fogBanks(to,T);if(T<.4){fog*=.6/(1.-T);T=.4;}seen*=T;
      }
    }
    // However the layers stack, at least a fifth of the scene shows through.
    vec3 fogged=scene*T+fog;
    color=vec4(mix(clear,fogged,min(1.,.8/max(.001,1.-seen))),1.);
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
    float w=max(.42,localPixel(root,pixelWorld)*8.)*(.85+.3*fract(seed*3.1)),h=w*1.35;
    uv=corner*vec2(1.,.5)+vec2(0,.5);
    vec3 right=camRight;
    vec3 q=root+right*(corner.x*w*.5+sway*w*uv.y*uv.y)+vec3(0,uv.y*h,0)-center;
    gl_Position=toClip(q+center);
  }`;
  const flowerFragment=`#version 300 es
  precision highp float;
  in vec2 uv;
  in float seed;
  flat in int flowerMat;
  uniform vec3 palette[96];
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  void main(){
    glowOut=vec4(0);
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
  uniform float depth, time, pixelWorld, biomeSize;
  uniform vec3 palette[96];
  uniform sampler2D biomeMap;
  out vec2 uv;
  out float seed, heightM, head;
  flat out int stalkMat;
  flat out vec3 tint;
  ${BIOME_TINT}
  void main(){
    seed=fract(prop.w);stalkMat=int(prop.w);head=extra.y;heightM=extra.x*scale.y;
    tint=stalkMat==${M.MAT.bamboo}||stalkMat==${M.MAT.bambooNode}?palette[stalkMat]:undergrowth(biomeMap,biomeSize,prop.xz,palette[stalkMat],.85,seed);
    vec3 root=origin+prop.xyz*scale+vec3(seed-.5,0,fract(seed*7.3)-.5)*scale.x*.5;
    vec2 at=patternOrigin.xz+prop.xz*scale.x;
    float w=stalkMat==${M.MAT.bamboo}?.5:stalkMat==${M.MAT.fern}?max(.9,heightM*2.2):stalkMat==${M.MAT.tuft}?max(.45,heightM*1.6):stalkMat==${M.MAT.vine}?.4:.38;
    w=max(w,localPixel(root,pixelWorld)*5.);
    float sway=sin(time*1.6+seed*9.+dot(at,vec2(1.3,.7))*1.2)*.05+.09*pow(.5+.5*sin(dot(at,vec2(.92,.39))*.32-time*1.15),3.);
    // Bamboo carries its leaves in the canopy, which only shifts gently, so culms sway as little as the canopy does.
    if(stalkMat==${M.MAT.bamboo})sway*=.15;
    uv=corner*vec2(1.,.5)+vec2(0,.5);
    // Vines hang from their top, so they swing most at the bottom.
    float swing=stalkMat==${M.MAT.vine}?(1.-uv.y)*(1.-uv.y)*.6:uv.y*uv.y;
    // An upright quad in world space facing the camera's right axis, so every point sorts at its true depth.
    vec3 right=camRight;
    vec3 q=root+right*(corner.x*w*.5+sway*heightM*swing)+vec3(0,uv.y*max(heightM,localPixel(root,pixelWorld)*6.),0)-center;
    gl_Position=toClip(q+center);
  }`;
  const stalkFragment=`#version 300 es
  precision highp float;
  in vec2 uv;
  in float seed, heightM, head;
  flat in int stalkMat;
  flat in vec3 tint;
  uniform vec3 palette[96];
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  ${PEEK}
  void main(){
    if(stalkMat==${M.MAT.bamboo}&&uv.y*heightM>1.6&&peeked())discard;
    glowOut=vec4(0);
    vec3 base=tint,c=base;bool keep=false;float x=uv.x,y=uv.y;
    if(stalkMat==${M.MAT.bamboo}){
      // Culm: slim, with node rings every ~0.4 m; leaf sprigs off the upper nodes, alternating sides.
      float r=.16;keep=abs(x)<r;float along=y*heightM/.4,ring=fract(along);
      c=base*(.85+.3*smoothstep(-r,r,-x))*(ring<.06?.75:1.);
      float side=mod(floor(along),2.)*2.-1.,sx=x*side,sy=fract(along);
      if(!keep&&y>.35&&sx>0.&&sx<.9&&abs(sy-.15-sx*.25)<.05*(1.-sx)+.02){keep=true;c=palette[${M.MAT.bambooLeaf}]*(.9+.2*sx);}
    }else if(stalkMat==${M.MAT.vine}){
      // A wavy stem with small paired-off leaves every ~16 cm, alternating sides, larger toward the top.
      float m=y*heightM,stem=x-.18*sin(m*4.+seed*6.)*(1.-y*.5);
      keep=abs(stem)<.045;c=base*.75;
      float a=m/.16,side=mod(floor(a),2.)*2.-1.;vec2 l=vec2((stem-side*.2)/(.2+.08*y),(fract(a)-.5)/.42);
      if(dot(l,l)<1.){keep=true;c=base*(.85+.3*(1.-length(l))+.1*side);}
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
  // Fern objects, after the sword fern: ten long narrow fronds rising in a vase from the root and arching over at the tip,
  // each a ribbon cut in the fragment shader into slanted, pointed leaflets along a darker midrib. Up to about a metre
  // tall or more. Lit by the frond's own facing (darker undersides), tinted by the biome, swaying with the grass wind.
  const FERN_FRONDS=10,FERN_SEGS=7;
  const fernVertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec3 grid;
  layout(location=1) in vec4 prop;
  layout(location=2) in vec4 extra;
  uniform vec3 origin, scale, patternOrigin, center;
  uniform vec2 halfView;
  uniform float depth, time, biomeSize;
  uniform vec3 palette[96];
  uniform sampler2D biomeMap;
  out vec2 uv;
  out vec3 nrm;
  flat out vec3 tint;
  ${BIOME_TINT}
  void main(){
    float seed=fract(prop.w),H=max(extra.x*scale.y,.2),f=grid.x,t=grid.y,s=grid.z;
    vec3 root=origin+prop.xyz*scale+vec3(seed-.5,0,fract(seed*7.3)-.5)*scale.x*.5;
    vec2 at=patternOrigin.xz+prop.xz*scale.x;
    float a=(f+fract(seed*13.+f*.37)*.6)/${FERN_FRONDS}.*6.2832+seed*6.;
    // Inner fronds stand taller and steeper, outer ones reach out and arch lower.
    float inner=fract(seed*5.1+f*.618),R=H*(.75+.45*(1.-inner)),lift=H*(.9+.45*inner);
    vec3 dir=vec3(cos(a),0,sin(a)),side=vec3(-dir.z,0,dir.x);
    float sway=sin(time*1.6+seed*9.+dot(at,vec2(1.3,.7))*1.2+f*1.7)*.07;
    // Spine: rises steeply, then droops toward the tip.
    vec3 spine=dir*R*t*t+vec3(0,lift*(1.9*t-1.1*t*t),0)+side*sway*t*t*R;
    vec3 tang=normalize(dir*R*2.*t+vec3(0,lift*(1.9-2.2*t),0)+vec3(0,.001,0));
    float w=(lift+R)*.085*pow(max(0.,1.-t),.6)*smoothstep(0.,.15,t)+H*.008;
    // The blade is gently cupped: its edges sit a little lower than the midrib.
    vec3 p=root+spine+side*s*w-vec3(0,abs(s)*w*.3,0);
    nrm=normalize(cross(tang,side));if(nrm.y<0.)nrm=-nrm;
    uv=vec2(s,t);
    tint=palette[${M.MAT.fern}];
    tint=undergrowth(biomeMap,biomeSize,prop.xz,tint,.85,seed);
    gl_Position=toClip(p);
  }`;
  const fernFragment=`#version 300 es
  precision highp float;
  in vec2 uv;
  in vec3 nrm;
  flat in vec3 tint;
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  const vec3 SUN=normalize(vec3(-.5,1.,.4));
  void main(){
    glowOut=vec4(0);
    float s=abs(uv.x),t=uv.y;
    // About twenty leaflets a side, slanted toward the tip, each tapering to a point; the midrib runs down the middle.
    float cell=fract(t*20.-s*.7)-.5;bool rib=s<.08;
    if(!rib&&abs(cell)>.42*pow(max(0.,1.-s),.8)+.02)discard;
    vec3 n=normalize(nrm);float up=gl_FrontFacing?1.:-1.;
    float tone=(dot(n*up,SUN)*.5+.5)*.75+t*.18+(cell-.5)*.1;
    vec3 c=tint*mix(.6,1.15,tone)*(rib?.82:1.)*(1.-.12*s);
    color=vec4(c,0.);
  }`;
  function makeFern(){
    const out=[];for(let f=0;f<FERN_FRONDS;f++)for(let j=0;j<FERN_SEGS;j++)for(const [s0,s1] of [[-1,0],[0,1]]){
      const t0=j/FERN_SEGS,t1=(j+1)/FERN_SEGS;for(const [s,t] of [[s0,t0],[s1,t0],[s1,t1],[s0,t0],[s1,t1],[s0,t1]])out.push(f,t,s);
    }
    return new Float32Array(out);
  }
  // Mushroom objects: an instanced smooth dome cap (with a slightly curled rim) on a tapered stem, in the anime bands, with
  // six evenly spaced white spots on the cap and a soft dark ring where the stem meets the ground.
  const mushroomVertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec3 unit;
  layout(location=1) in float part;
  layout(location=2) in vec4 a;
  layout(location=3) in vec4 b;
  uniform vec3 origin, center, lightAt, lightHalf;
  uniform mat3 lightAxes;
  uniform vec2 halfView;
  uniform float depth;
  out vec3 n, local, lightCoord;
  out float isCap;
  void main(){
    // a: x, base, z, capRadius; b: capHeight, stemRadius, stemHeight, spin.
    float spin=b.w,cs=cos(spin),sn=sin(spin);isCap=part;
    vec3 p,nn;
    if(part>.5){p=vec3(unit.x*a.w,b.z+unit.y*b.x,unit.z*a.w);nn=normalize(vec3(unit.x/a.w,unit.y/b.x,unit.z/a.w));}
    else{float r=b.y*(1.-.18*unit.y);p=vec3(unit.x*r,unit.y*(b.z+b.x*.25),unit.z*r);nn=normalize(vec3(unit.x,0,unit.z));}
    n=vec3(nn.x*cs-nn.z*sn,nn.y,nn.x*sn+nn.z*cs);
    vec3 w=origin+vec3(a.x,a.y,a.z)+vec3(p.x*cs-p.z*sn,p.y,p.x*sn+p.z*cs);
    vec3 l=(w-lightAt)*lightAxes/lightHalf;lightCoord=l*.5+.5;
    gl_Position=toClip(w);
    local=p;
  }`;
  const mushroomFragment=`#version 300 es
  precision highp float;
  in vec3 n, local, lightCoord;
  in float isCap;
  uniform vec3 palette[96], lightHalf;
  uniform float shadowOn, shadowTexel, blockSize;
  uniform highp sampler2DShadow shadowMap;
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  const vec3 SUN=normalize(vec3(-.5,1.,.4));
  ${SUNLIGHT}
  void main(){
    glowOut=vec4(0);
    float tone=(dot(normalize(n),SUN)*.5+.5)*mix(.6,1.,sunlight());
    vec3 base=isCap>.5?palette[${M.MAT.mushroom}]:palette[${M.MAT.stem}];
    if(isCap>.5){
      // Spots: one at the crown and five around it, on the upper cap.
      float spot=0.;vec3 un=normalize(n);vec2 sp=un.xz/max(.25,un.y+.35);
      for(int k=0;k<6;k++){vec2 c=k==0?vec2(0):vec2(cos(float(k)*1.2566),sin(float(k)*1.2566))*.62;spot=max(spot,1.-smoothstep(.15,.2,length(sp-c)));}
      base=mix(base,palette[${M.MAT.stem}]*1.05,spot*step(.25,un.y));
    }
    vec3 shadow=base*vec3(.62,.6,.78),high=mix(base,vec3(1.,.95,.86),.3);
    vec3 c=mix(mix(shadow,base,smoothstep(.36,.42,tone)),high,smoothstep(.8,.86,tone));
    if(isCap<.5)c*=.8+.2*smoothstep(0.,.25,local.y);
    color=vec4(c,1.);
  }`;
  function makeMushroom(){
    // Cap: a unit upper hemisphere (y 0..1) with a slight downward rim lip; stem: a unit cylinder (y 0..1). part 1 = cap.
    const out=[],ring=14,rows=5,cap=(i,j)=>{const t=j/rows,ang=i/ring*Math.PI*2,phi=t*Math.PI/2,r=Math.cos(phi),y=Math.sin(phi);return [Math.cos(ang)*r,y,Math.sin(ang)*r];};
    for(let j=0;j<rows;j++)for(let i=0;i<ring;i++){const A=cap(i,j),B=cap(i+1,j),Cc=cap(i+1,j+1),D=cap(i,j+1);for(const v of [A,Cc,B,A,D,Cc])out.push(...v,1);}
    for(let i=0;i<ring;i++){const a0=i/ring*Math.PI*2,a1=(i+1)/ring*Math.PI*2,P=(a,y)=>[Math.cos(a),y,Math.sin(a)];const A=P(a0,0),B=P(a1,0),Cc=P(a1,1),D=P(a0,1);for(const v of [A,Cc,B,A,D,Cc])out.push(...v,0);}
    // Underside of the cap: a flat disc facing down, part 1 with y=0.
    for(let i=0;i<ring;i++){const a0=i/ring*Math.PI*2,a1=(i+1)/ring*Math.PI*2;for(const v of [[0,0,0],[Math.cos(a0),0,Math.sin(a0)],[Math.cos(a1),0,Math.sin(a1)]])out.push(...v,1);}
    return new Float32Array(out);
  }
  // Palm fronds as real ribbons: each runs from the crown top along its yaw, rising by tan(pitch)·u and falling by
  // droop·u² (u along its length), with leaflets cut into a comb along the rib. Lit in the leaf bands, swaying gently.
  const FROND_SEGS=10;
  const frondVertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec2 grid;
  layout(location=1) in vec4 a;
  layout(location=2) in vec4 b;
  uniform vec3 origin, center, lightAt, lightHalf;
  uniform mat3 lightAxes;
  uniform vec2 halfView;
  uniform float depth, time;
  out vec2 uv;
  out vec3 lightCoord, nrm;
  out float young;
  void main(){
    // a: crown x, y, z, yaw; b: pitch, droop, length, young.
    float u=grid.x,yaw=a.w,len=b.z;young=b.w;
    float sway=sin(time*1.1+a.x*.7+a.z*.5+yaw*2.)*.05;
    vec2 dir=vec2(cos(yaw+sway),sin(yaw+sway)),side=vec2(-dir.y,dir.x);
    float h=len*(tan(b.x)*u-b.y*u*u),half_=len*(.05+.17*sin(u*3.1416))*(young>.5?.5:1.);
    float slope=len*(tan(b.x)-2.*b.y*u);
    vec3 p=origin+vec3(a.x,a.y,a.z)+vec3(dir.x*u*len,h,dir.y*u*len)+vec3(side.x,0,side.y)*grid.y*half_;
    // Normal: across the frond's width and along its curve; leaflets droop to the sides a little.
    vec3 t=normalize(vec3(dir.x*len,slope,dir.y*len)),sv=vec3(side.x,-.35*grid.y,side.y);
    nrm=normalize(cross(sv,t));if(nrm.y<0.)nrm=-nrm;
    uv=vec2(u,grid.y);
    vec3 l=(p-lightAt)*lightAxes/lightHalf;lightCoord=l*.5+.5;
    gl_Position=toClip(p);
  }`;
  const frondFragment=`#version 300 es
  precision highp float;
  in vec2 uv;
  in vec3 lightCoord, nrm;
  in float young;
  uniform vec3 palette[96], lightHalf;
  uniform float shadowOn, shadowTexel, blockSize;
  uniform highp sampler2DShadow shadowMap;
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  const vec3 SUN=normalize(vec3(-.5,1.,.4));
  ${SUNLIGHT}
  ${MATERIALS}
  void main(){
    glowOut=vec4(0);
    // Comb: leaflets angled back toward the base, a gap between each; the rib stays solid.
    float side=abs(uv.y),comb=fract(uv.x*14.+side*2.2);
    if(side>.18&&comb>.62)discard;
    if(side>.92-.25*uv.x*uv.x)discard;
    float tone=(dot(normalize(nrm),SUN)*.5+.5)*mix(.6,1.,sunlight())+.16*uv.x-.08+(young>.5?.1:0.);
    vec3 shadow,mid,high;crownBands(${M.MAT.palmLeaf},palette[${M.MAT.palmLeaf}],shadow,mid,high);high=mix(high,vec3(.86,.9,.42),.35);
    vec3 c=mix(mix(shadow,mid,smoothstep(.3,.36,tone)),mix(mid,high,.65),smoothstep(.8,.86,tone));
    if(side<.06)c*=.85;
    color=vec4(c,1.);
  }`;
  function makeFrond(){
    const out=[];
    for(let i=0;i<FROND_SEGS;i++){const u0=i/FROND_SEGS,u1=(i+1)/FROND_SEGS;for(const [u,v] of [[u0,-1],[u1,-1],[u1,1],[u0,-1],[u1,1],[u0,1]])out.push(u,v);}
    return new Float32Array(out);
  }
  // Sequoia bough skirts: each tier a drooping cone from a stepped-in top radius to its full radius, with a lip curling
  // down at the edge and a concave underside back toward the trunk. Slightly larger than the voxel crown so it covers
  // it; needle-fringed edge, lit in the needle bands (bright top, dark underside), with sun shadows.
  const SKIRT_SEGS=28,SKIRT_ROWS=7;
  const skirtVertex=shadow=>`#version 300 es
  ${shadow?'#define SHADOW':''}
  precision highp float;
  layout(location=0) in vec3 grid;
  layout(location=1) in vec4 a;
  layout(location=2) in vec4 b;
  uniform vec3 origin, center, lightAt, lightHalf;
  uniform mat3 lightAxes;
  uniform vec2 halfView;
  uniform float depth, time;
  out vec3 lightCoord, nrm;
  out vec2 uvs;
  out float under, seed;
  flat out int tierMat;
  flat out float innerShell;
  void main(){
    // grid: angle 0..1, row 0..1 down the skirt (1..1.25 = lip), side (0 top, 1 underside). a: cx, cz, top, bottom; b: r, rTop,
    // seed, needle material (0: the plain needle).
    float ang=grid.x*6.2832,u=grid.y,h=a.z-a.w;seed=b.z;under=grid.z;tierMat=b.w>0.?int(b.w):${M.MAT.needle};innerShell=fract(b.w)>.25?1.:0.;
    float tips=fract(grid.x*11.+seed*5.),tipLen=fract(sin(floor(grid.x*11.+seed*5.)*91.3+seed*17.)*437.5);
    float jag=1.+.06*sin(ang*7.+seed*20.)+.04*sin(ang*13.+seed*7.)+(u>.6?.22*tipLen*(1.-abs(tips-.5)*2.)*smoothstep(.6,1.,u):0.);
    float r,y;
    if(grid.z<.5){
      float k=min(u,1.);r=mix(b.y,b.x*1.08,pow(k,.75))*jag;y=a.z-h*k;
      if(u>1.){float l=(u-1.)/.25;r=b.x*1.08*jag*(1.+.03*l);y=a.w-h*.22*l;}
    }else{
      // Underside: from the lip edge back in and up toward the trunk.
      r=mix(b.x*1.08*jag,b.y*.45,u);y=mix(a.w-h*.22,a.w+h*.32,u);
    }
    float sway=sin(time*.6+seed*9.)*.04*(a.z-y);
    vec3 p=origin+vec3(a.x+cos(ang)*r+sway,y,a.y+sin(ang)*r);
    vec2 slope=vec2(b.x*1.08-b.y,h);vec3 radial=vec3(cos(ang),0,sin(ang));
    nrm=grid.z<.5?normalize(radial*slope.y+vec3(0,slope.x,0)):normalize(-radial*.3+vec3(0,-1,0));
    uvs=vec2(grid.x,u);
    vec3 l=(p-lightAt)*lightAxes/lightHalf;lightCoord=l*.5+.5;
    #ifdef SHADOW
    gl_Position=vec4(l,1.);
    #else
    gl_Position=toClip(p);
    #endif
  }`;
  const skirtFragment=`#version 300 es
  precision highp float;
  in vec3 lightCoord, nrm;
  in vec2 uvs;
  in float under, seed;
  flat in int tierMat;
  flat in float innerShell;
  uniform vec3 palette[96], lightHalf;
  uniform vec2 dither;
  uniform float shadowOn, shadowTexel, blockSize;
  uniform float cloudTime;
  uniform vec2 worldOffset;
  uniform highp sampler2DShadow shadowMap;
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  const vec3 SUN=normalize(vec3(-.5,1.,.4));
  ${SUNLIGHT}
  ${MEADOW}
  ${MATERIALS}
  void main(){
    glowOut=vec4(0);
    if(dither.x!=0.){float dn=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(dither.x>0.?dn>=dither.y:dn<dither.y)discard;}
    // The lip's edge is shaped by the geometry's drooping branch tips (no sawtooth fringe: it shimmers when moving).
    vec3 n=normalize(nrm);float sun=sunlight();
    float clumps=meadowNoise(vec2(uvs.x*48.,uvs.y*5.+seed*11.))-.5;
    // Calm anime shading: one smooth light across the layer, a soft lift toward its top, its underside a gentle shade.
    float tone=(dot(n,SUN)*.5+.5)*mix(.8,1.,sun)+clumps*.08+(under>.5?-.22:.1*(1.-uvs.y))-innerShell*.4;
    vec3 shadow,mid,high;crownBands(tierMat,palette[tierMat],shadow,mid,high);
    vec3 c=mix(mix(shadow,mid,smoothstep(.33,.39,tone)),mix(mid,high,.65),smoothstep(.8,.86,tone));
    color=vec4(c,1.);
  }`;
  function makeSkirt(SEGS=SKIRT_SEGS,ROWS=SKIRT_ROWS){
    const out=[],rows=[];for(let i=0;i<=ROWS;i++)rows.push(i/ROWS);rows.push(1.125,1.25);
    const strip=(rs,side)=>{for(let j=0;j<rs.length-1;j++)for(let i=0;i<SEGS;i++){const a0=i/SEGS,a1=(i+1)/SEGS,v0=rs[j],v1=rs[j+1];for(const [x,y] of [[a0,v0],[a1,v0],[a1,v1],[a0,v0],[a1,v1],[a0,v1]])out.push(x,y,side);}};
    strip(rows,0);strip([0,.5,1],1);
    return new Float32Array(out);
  }
  // Object trees (see the model's treeParts): bark tubes and crown lobes, instanced per node, plus conifer tiers drawn with
  // the bough-skirt program on a lighter mesh. Each has a SHADOW variant for the sun's depth map.
  // Tubes: a smooth 12-sided tube in four rings from (a.xyz, radius a.w) to (b.xyz, radius b.w), bark material c.x, seed
  // c.y; a trunk foot (c.z = 1) swells into five rounded buttress roots near the ground, like the voxel trunks' flare but
  // smooth. Bark reads as cel bands with soft vertical ridges; birch is white with dark marks.
  const TUBE_SIDES=12,TUBE_RINGS=4;
  const tubeVertex=shadow=>`#version 300 es
  ${shadow?'#define SHADOW':''}
  precision highp float;
  layout(location=0) in vec2 unit;
  layout(location=1) in vec4 a;
  layout(location=2) in vec4 b;
  layout(location=3) in vec4 c;
  uniform vec3 origin, center, lightAt, lightHalf;
  uniform mat3 lightAxes;
  uniform vec2 halfView;
  uniform float depth;
  out vec3 lightCoord, nrm;
  out float along, around;
  flat out int mat;
  void main(){
    vec3 p0=origin+a.xyz,p1=origin+b.xyz,ax=p1-p0;float L=max(length(ax),1e-4);vec3 d=ax/L;
    vec3 u=normalize(abs(d.y)<.95?cross(d,vec3(0,1,0)):cross(d,vec3(1,0,0))),w=cross(d,u);
    float ang=unit.x*6.2832+c.y*6.2832;vec3 radial=cos(ang)*u+sin(ang)*w;
    float r=mix(a.w,b.w,unit.y),foot=(abs(c.z-1.)<.5?1.:0.)*(1.-unit.y)*(1.-unit.y);
    r*=1.+foot*(.55+.45*cos(ang*5.))*.7+.04*sin(unit.y*7.+c.y*20.+ang*2.);
    vec3 p=p0+ax*unit.y+radial*r-vec3(0,foot*a.w*.15,0);
    nrm=radial;mat=int(c.x);along=unit.y*L+a.y*.0;around=unit.x+c.y;
    vec3 l=(p-lightAt)*lightAxes/lightHalf;lightCoord=l*.5+.5;
    #ifdef SHADOW
    gl_Position=vec4(l,1.);
    #else
    gl_Position=toClip(p);
    #endif
  }`;
  const tubeFragment=`#version 300 es
  precision highp float;
  in vec3 lightCoord, nrm;
  in float along, around;
  flat in int mat;
  uniform vec3 palette[96], lightHalf;
  uniform vec2 dither;
  uniform float shadowOn, shadowTexel, blockSize;
  uniform highp sampler2DShadow shadowMap;
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  const vec3 SUN=normalize(vec3(-.5,1.,.4));
  ${SUNLIGHT}
  void main(){
    glowOut=vec4(0);
    if(dither.x!=0.){float dn=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(dither.x>0.?dn>=dither.y:dn<dither.y)discard;}
    vec3 n=normalize(nrm);float lit=max(0.,dot(n,SUN))*mix(.35,1.,sunlight()),tone=lit+.12*n.y;
    // Painted bark: long vertical plates of uneven width (wobbling a little up the trunk), dark cracks between them, a
    // few lighter streaks, and a warm highlight running down the lit edge.
    float wob=sin(along*.9+around*11.)*.04+sin(along*2.7)*.015,col=(around+wob)*14.,plate=fract(col),pid=floor(col);
    float crack=1.-smoothstep(.0,.09+.05*fract(sin(pid*12.9)*437.5),min(plate,1.-plate));
    float streak=step(.82,fract(sin(pid*7.7+floor(along*.6)*3.1)*437.5))*smoothstep(.3,.5,plate)*smoothstep(.7,.5,plate);
    vec3 base=palette[mat],c=base*mix(.6,1.06,smoothstep(.22,.34,tone))*(1.-crack*.32+streak*.14+(fract(sin(pid*3.3)*91.7)-.5)*.08);
    c=mix(c*vec3(.86,.9,1.04),c,smoothstep(.2,.4,tone));
    c+=vec3(.16,.11,.06)*smoothstep(.55,.85,lit)*(1.-crack);
    if(mat==${M.MAT.birchBark}){float band=fract(along*2.3+sin(around*11.+along*.7)*.12),w=.05+.06*fract(sin(floor(along*2.3)*17.1)*437.5),m=(1.-smoothstep(w*.6,w,abs(band-.5)))*step(.35,fract(around*2.2+floor(along*2.3)*.37))*step(.2,fract(around*5.1+along*1.3));c=mix(c,palette[${M.MAT.birchMark}],m*.85);}
    color=vec4(c,1.);
  }`;
  // Lobes as anime crown billboards: each crown blob (centre a.xyz, radius a.w, height scale b.x, leaf b.y, seed b.z) is one
  // camera-facing quad. The fragment rebuilds the blob's rounded surface from the quad (so it shades in the crown's three
  // bands with sun shadows), scallops its outline into leaf clumps, paints small leaves inside, and writes the depth of
  // that surface so trunks, terrain and other blobs overlap it correctly. In the sun's depth pass the quad faces the sun.
  const lobeVertex=shadow=>`#version 300 es
  ${shadow?'#define SHADOW':''}
  precision highp float;
  layout(location=0) in vec2 corner;
  layout(location=1) in vec4 a;
  layout(location=2) in vec4 b;
  layout(location=3) in vec4 crownIn;
  uniform vec3 origin, center, lightAt, lightHalf;
  uniform mat3 lightAxes;
  uniform vec2 halfView;
  uniform float depth, time, biomeSize, blockScale;
  uniform vec3 camForward;
  uniform vec3 palette[96];
  uniform sampler2D biomeMap;
  out vec2 q;
  out vec3 centre, ax, ay, az;
  out vec4 crown;
  out float rad, seed;
  flat out int mat;
  flat out vec3 tintBase;
  flat out vec4 crownKey;
  flat out float kind;
  flat out vec2 sprayDir;
  ${BIOME_TINT}
  void main(){
    // kind: 0 leaf cluster, 1 loose leaf (crown proxy in crownIn); 2..2.9 conifer needle spray, its tier normal in crownIn.xyz
    // and its depth shade in the fraction.
    mat=int(b.y);seed=b.z;rad=a.w;kind=b.w;crown=kind>1.5?vec4(crownIn.xyz,crownIn.w):vec4(origin+crownIn.xyz,crownIn.w);
    // Biome colours: bushes share the plain leaf greens of the crowns around them, and plain green crowns and bushes
    // follow rose and violet biomes, one tone per plant (keyed by the crown's centre).
    vec2 blk=(kind>1.5?a.xz:crownIn.xz)/max(blockScale,.001);
    // A spray's bough runs out along the tier and droops: its direction on the card, so the needles fan that way.
tintBase=palette[mat];crownKey=vec4(0);
    if(mat==${M.MAT.bushLeaf})mat=${M.MAT.leaf};
    if(mat==${M.MAT.leaf}||mat==${M.MAT.needle}){vec4 key=biomeKey(biomeMap,biomeSize,blk,plantSeed(blk*.5));if(key.a>0.)crownKey=vec4(key.rgb,.8*key.a);}
    float sway=sin(time*1.1+b.z*37.+a.x*.3)*.03*a.w;
    centre=origin+a.xyz;
    #ifdef SHADOW
    ax=lightAxes[0];ay=lightAxes[1];az=-lightAxes[2];
    #else
    if(walkView>.5){az=normalize(eye-centre);vec3 r=cross(vec3(0,1,0),az);ax=dot(r,r)>1e-4?normalize(r):camRight;ay=cross(az,ax);}
    else{ax=camRight;ay=camUp;az=-camForward;}
    #endif
    sprayDir=vec2(0,-1);if(kind>1.5){vec3 bough=normalize(vec3(crownIn.x,0.,crownIn.z)+vec3(0,-.6,0));vec2 d=vec2(dot(bough,ax),dot(bough,ay));if(dot(d,d)>1e-4)sprayDir=normalize(d);}
    // The squashed blob's extent along the quad's up axis.
    float sy=sqrt(ay.x*ay.x+ay.z*ay.z+b.x*b.x*ay.y*ay.y);
    q=corner*vec2(1.18,1.18*sy);
    vec3 p=centre+(ax*q.x+ay*q.y)*a.w+ax*sway;
    #ifdef SHADOW
    vec3 l=(p-lightAt)*lightAxes/lightHalf;gl_Position=vec4(l,1.);
    #else
    // Sit the card on the clump's front surface so it sorts against trunks and terrain without a per-pixel depth write.
    gl_Position=toClip(p+az*a.w*.5);gl_Position.z-=fract(b.z*7.31)*1e-4*gl_Position.w;
    #endif
    q.y/=sy;
  }`;
  // Shared by the lobe's colour and shadow fragments: the outline, scalloped into leaf clumps.
  // A leaf cluster's outline: a core and six leaves fanned around it at hashed angles and sizes, their tips serrated.
  // lobeEdge returns the cluster's extent along q's direction relative to |q| test: inside when lobeInside > 0.
  // A leaf cluster: a shaded core and eight leaves fanned around it at hashed angles and sizes, their tips serrated.
  // lobeLeaf returns how far inside the cluster the point is (> 0 inside) and, for the leaf it falls on (top-most wins),
  // its id, the gap to the next leaf under it (small along the overlaps) and which half of the leaf it is on (-1..1
  // across the midrib), so the fragment can paint each leaf with its own tone, a lit and a shaded half, and dark gaps.
  const LOBE_SHAPE=`float lobeLeaf(vec2 q,float seed,out float leaf,out float gap,out float side){
    float core=.42-length(q*vec2(1.,1.15)),v=core,second=-9.;leaf=-1.;side=0.;
    for(int i=0;i<8;i++){float fi=float(i),h=fract(sin(seed*91.7+fi*13.1)*4375.5),b=fi*.785+h*.6,L=.26+.18*fract(h*7.3);
      vec2 c=vec2(cos(b),sin(b))*(.48+.18*h),d=q-c;vec2 u=vec2(cos(b),sin(b)),w=vec2(-u.y,u.x);float along=dot(d,u),across=dot(d,w),t=atan(d.y,d.x)-b;
      float f=L*(1.-.2*abs(sin(t*3.+h*9.)))-length(vec2(along,across*1.7));
      if(f>v){second=v;v=f;leaf=fi;side=clamp(across/(L*.6),-1.,1.);}else second=max(second,f);}
    gap=v-second;return v;
  }
  // A conifer bough, as painted fir and spruce are: a fan widening from the twig at the top to a drooping, ragged needle
  // edge at the tip, with a darker branch line down its middle and a few needle notches cut into its sides. leaf: which
  // notch band; side: which side of the branch line (lit one way, shaded the other).
  float sprayLeaf(vec2 q,float seed,out float leaf,out float gap,out float side){
    float t=(.75-q.y)/1.5;side=sign(q.x);leaf=floor(t*6.);gap=1.;
    if(t<0.)return -1.;
    float w=.1+.62*smoothstep(0.,1.,t),h=fract(seed*13.7);
    float notch=.07*abs(sin(t*19.+h*9.+side*1.3))*smoothstep(.15,.5,t);
    float hem=1.-.14*abs(sin(q.x*21.+h*7.))-.06*h;
    float v=min(w-abs(q.x)-notch,hem-t);
    gap=abs(q.x)-.025;return v;
  }
  float lobeInside(vec2 q,float seed){float a,b,c;return lobeLeaf(q,seed,a,b,c);}
  float lobeEdge(vec2 q,float seed){return lobeInside(q,seed)>0.?9.:0.;}`;
  const lobeFragment=`#version 300 es
  precision highp float;
  in vec2 q;
  in vec3 centre, ax, ay, az;
  in vec4 crown;
  in float rad, seed;
  flat in int mat;
  flat in vec3 tintBase;
  flat in vec4 crownKey;
  flat in float kind;
  flat in vec2 sprayDir;
  uniform vec3 palette[96], lightHalf, lightAt;
  uniform mat3 lightAxes;
  uniform mat4 viewProj;
  uniform vec2 dither, worldOffset;
  uniform float cloudTime, shadowOn, shadowTexel, blockSize;
  uniform highp sampler2DShadow shadowMap;
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  const vec3 SUN=normalize(vec3(-.5,1.,.4));
  vec3 lightCoord;
  ${SUNLIGHT}
  ${MEADOW}
  ${MATERIALS}
  ${BIOME_TINT}
  ${LOBE_SHAPE}
  void main(){
    glowOut=vec4(0);
    if(dither.x!=0.){float dn=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(dither.x>0.?dn>=dither.y:dn<dither.y)discard;}
    float leaf,leafGap,leafSide,d=length(q),e=1.,inside;
    if(kind>1.5){
      // A conifer cluster: the oak cluster's blob, flattened along its bough and drooping, its rim broken into fine
      // needle points instead of leaf tips.
      vec2 qr=vec2(-sprayDir.y*q.x+sprayDir.x*q.y,-sprayDir.x*q.x-sprayDir.y*q.y)*vec2(1.,1.35);
      inside=lobeLeaf(qr,seed,leaf,leafGap,leafSide);float a=atan(qr.y,qr.x);
      inside-=.035*abs(sin(a*23.+seed*31.))*smoothstep(.25,.6,length(qr));leafGap=max(leafGap,.03);
    }else if(kind>.5){
      // A loose leaf: one pointed leaf at a hashed angle, split into a lit and a shaded half.
      float b=seed*6.2832;vec2 u=vec2(cos(b),sin(b)),w=vec2(-u.y,u.x);float al=dot(q,u),ac=dot(q,w);
      inside=.85*(1.-al*al)-abs(ac)*2.4-.12;leaf=floor(seed*8.);leafGap=1.;leafSide=clamp(ac*3.,-1.,1.);
    }
    else inside=lobeLeaf(q,seed,leaf,leafGap,leafSide);
    float edgeAA=clamp(inside/max(fwidth(inside),1e-4)+.5,0.,1.);if(edgeAA<.02)discard;d=min(d,.99);
    // The rounded surface behind this point of the quad, and its depth.
    float z=sqrt(max(0.,1.-(d*d)/(e*e)));vec3 nv=normalize(vec3(q.x,q.y,z*.9));
    vec3 n=normalize(ax*nv.x+ay*nv.y+az*nv.z),p=centre+(ax*q.x+ay*q.y+az*z*.9)*rad;
    // Light is taken at the cluster's fixed centre, not at the card point (which slides with the camera), so a cluster's
    // shading and sun shadow hold still as you move.
    lightCoord=((centre-lightAt)*lightAxes/lightHalf)*.5+.5;
    float leafId=fract(seed*7.31),gap=0.;
    // Anime-tree normal transfer: light mostly by the crown proxy's normal (one soft ellipsoid around the whole crown),
    // keeping a little of the blob's own roundness so clumps still separate.
    vec3 k=(centre-crown.xyz)/vec3(crown.w,crown.w*.78,crown.w);float inner=length(k);
    vec3 nc=normalize(k+vec3(0,.12,0)),N=nc;
    // Conifer sprigs are highlights: lit by their layer's normal, kept on the bright side.
    if(kind>1.5){float shade=(kind-2.)/.9;N=normalize(crown.xyz);nc=N;inner=1.-shade*.6;k=N*inner;}
    float sun=sunlight(),wrap=dot(N,SUN)*.5+.5;
    // Fake occlusion: the crown darkens toward its core and its underside.
    float occl=(1.-smoothstep(.35,.95,inner))*.18+(1.-smoothstep(-.7,.1,nc.y))*.2;
    // Each cluster is a little lighter toward its own sunward top and darker at its base, so clusters read as separate
    // painted clumps within the crown's one light.
    // Leaf texture: each leaf its own tone, its sun-facing half lighter and the other half darker (a painted crease
    // down the midrib), thin dark gaps where one leaf overlaps the next, the cluster's core in shade.
    float lh=leaf<0.?.5:fract(sin(seed*37.3+leaf*7.7)*4375.5),facing=dot(normalize(ax*1.+ay*.6),SUN)>0.?1.:-1.;
    float leafTone=leaf<0.?-.1:(lh-.5)*.16+leafSide*facing*.07-(1.-smoothstep(.0,.035,leafGap))*.14-(1.-smoothstep(0.,.05,inside))*.06;
    float own=q.y*.1+leafTone;
    // Forced shadow, painted rather than lit: below a wavy line through the lower third of the plant, and in its core,
    // the clusters drop into a flat darker band with a crisp edge.
    float forced=step(k.y+.08*sin(k.x*9.+k.z*7.),-.3)*.13+step(inner,.45)*.07;
    float tone=max(.12,wrap*mix(.5,1.,sun)+own+(leafId-.5)*.08-gap*.08-occl-forced);
    vec3 shadow,mid,high;crownBands(mat,tintBase,shadow,mid,high);
    if(crownKey.a>0.){shadow=biomeTint(shadow,crownKey.rgb,crownKey.a);mid=biomeTint(mid,crownKey.rgb,crownKey.a);high=biomeTint(high,crownKey.rgb,crownKey.a);}
    // Anime hue shift: shade cools toward teal-blue, light warms toward yellow-green.
    shadow*=vec3(.82,.95,1.12);high=mix(high,high*vec3(1.08,1.06,.84),.6);
    float soft=.06;
    vec3 c=mix(mix(shadow*mix(.8,1.,smoothstep(.05,.3,tone)),mid,smoothstep(.36-soft,.36+soft,tone)),mix(mid,high,.75),smoothstep(.76-soft,.76+soft,tone));
    // Back light: with the sun behind the crown, its clump edges glow warm, as if lit through the leaves.
    float through=pow(max(0.,dot(-az,SUN)),2.)*smoothstep(.55,1.,d/e)*smoothstep(.6,1.,inner)*sun;
    c=mix(c,high*vec3(1.12,1.08,.82),through*.6);
    color=vec4(c,edgeAA);
  }`;
  const lobeCasterFragment=`#version 300 es
  precision highp float;
  in vec2 q;
  in vec3 centre, ax, ay, az;
  in vec4 crown;
  in float rad, seed;
  flat in int mat;
  ${LOBE_SHAPE}
  flat in float kind;
  void main(){float a,b,c;if((kind>1.5?lobeInside(q*vec2(1.,1.35),seed):kind>.5?.85*(1.-q.x*q.x)-abs(q.y)*2.4-.12:lobeInside(q,seed))<=0.)discard;}`;
  // Forced contact shadows: a flat, scalloped dark pool under each plant (a.xyz ground centre, a.w radius), multiplied
  // over what is already drawn, darkest at the stem and softening to its painted edge.
  const pondVertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec2 corner;
  layout(location=1) in vec4 a;
  uniform vec3 origin, center;
  uniform vec2 halfView;
  uniform float depth;
  out vec2 q;
  out float seed;
  void main(){
    q=corner;seed=fract(a.x*.37+a.z*.71);
    vec3 p=origin+a.xyz+vec3(corner.x*a.w,.06,corner.y*a.w);
    gl_Position=toClip(p);
  }`;
  const pondFragment=`#version 300 es
  precision highp float;
  in vec2 q;
  in float seed;
  uniform vec2 dither;
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glowOut;
  void main(){
    float a=atan(q.y,q.x),edge=.86+.06*sin(a*6.+seed*30.)+.04*sin(a*11.+seed*9.),d=length(q)/edge;if(d>1.)discard;
    float k=mix(.62,.86,smoothstep(.35,1.,d));
    color=vec4(vec3(k)*vec3(.94,.97,1.04),1.);glowOut=vec4(1);
  }`;
  const objectCaster=`#version 300 es
  precision highp float;
  void main(){}`;
  function makeTube(SIDES=TUBE_SIDES,RINGS=TUBE_RINGS){
    const out=[];for(let j=0;j<RINGS;j++)for(let i=0;i<SIDES;i++){const a0=i/SIDES,a1=(i+1)/SIDES,v0=j/RINGS,v1=(j+1)/RINGS;for(const [a,v] of [[a0,v0],[a1,v0],[a1,v1],[a0,v0],[a1,v1],[a0,v1]])out.push(a,v);}
    return new Float32Array(out);
  }
  // Unit icosphere as a triangle list (subdivided `sub` times).
  function makeIcosphere(sub){
    const t=(1+Math.sqrt(5))/2,norm=v=>{const l=Math.hypot(...v);return v.map(c=>c/l);};
    let V=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(norm);
    let F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
    for(let s=0;s<sub;s++){const mid=new Map(),m=(a,b)=>{const k=a<b?a+','+b:b+','+a;if(!mid.has(k)){V.push(norm(V[a].map((c,i)=>(c+V[b][i])/2)));mid.set(k,V.length-1);}return mid.get(k);};
      F=F.flatMap(([a,b,c])=>{const ab=m(a,b),bc=m(b,c),ca=m(c,a);return [[a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]];});}
    return new Float32Array(F.flatMap(f=>f.flatMap(i=>V[i])));
  }
  function compile(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const e=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(e);}return s;}
  function link(gl,vertexSource,fragmentSource,names){
    names=[...names,...CAMERA_UNIFORMS];
    if(vertexSource.includes('toClip(')){
      vertexSource=vertexSource.replace('  void main(){',CAMERA+'\n  void main(){');
      if(fragmentSource.includes('out vec4 color')){
        fragmentSource=fragmentSource.replace('precision highp float;', 'precision highp float;\nin float viewDistance, viewDepth;\nuniform float walkView, cameraPixelScale, fogAmount, cameraFar;\nuniform vec3 skyHorizon;\nuniform vec3 eye;').replace('  void main(){','  void sceneMain(){');
        // Pattern visibility follows local projected size rather than the overhead span.
        fragmentSource=fragmentSource.replace(/(wavelength|blockSize)\/pixelWorld/g,'$1/(walkView>.5?max(.001,viewDepth*cameraPixelScale):pixelWorld)');
        fragmentSource+=`\nvoid main(){sceneMain();if(walkView>.5){float haze=min(.72,1.-exp(-max(0.,viewDistance-cameraFar*.55)*.0045));vec3 air=skyHorizon;color.rgb=mix(color.rgb,air,haze);${fragmentSource.includes('glowOut')?'glowOut*=1.-haze;':''}}}`;
      }
    }
    const program=gl.createProgram(),vs=compile(gl,gl.VERTEX_SHADER,vertexSource),fs=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    const u={};for(const n of names)u[n]=gl.getUniformLocation(program,n);return {program,u};
  }
  const SUN=(()=>{const l=Math.hypot(.5,1,.4);return [-.5/l,1/l,.4/l];})(),SHADOW_SIZE=2048;
  // Sun-view axes as mat3 columns: right, up, and forward (away from the sun).
  const LIGHT_AXES=(()=>{const f=SUN.map(v=>-v),r=[f[2],0,-f[0]],rl=Math.hypot(...r),R=r.map(v=>v/rl),U=[R[1]*f[2]-R[2]*f[1],R[2]*f[0]-R[0]*f[2],R[0]*f[1]-R[1]*f[0]];return [...R,...U,...f];})();
  const DRAW_UNIFORMS=['rockMap','rockOn','quadMask','origin','scale','localOffset','patternOrigin','yaw','pitch','overrideMaterial','smoothMesh','normalMap','canopyMap','biomeMap','waterMap','normalSize','groundBase','blockSize','lightAt','lightHalf','lightAxes'];
  const skyFragment=`#version 300 es
  precision highp float;
  uniform vec3 eye,camForward,camRight,camUp,skyHorizon,skyZenith;
  uniform vec2 resolution,worldOffset;
  uniform float tanFov,cloudTime,cloudFade,cloudY;
  layout(location=0) out vec4 color;
  layout(location=1) out vec4 glow;
  ${MEADOW}
  void main(){
    vec2 uv=(gl_FragCoord.xy/resolution*2.-1.)*vec2(resolution.x/resolution.y,1.);
    vec3 ray=normalize(camForward+(camRight*uv.x+camUp*uv.y)*tanFov);
    vec3 sky=mix(skyHorizon,skyZenith,smoothstep(0.,.85,ray.y));
    vec3 sun=normalize(vec3(-.5,1.,.4));float a=max(0.,dot(ray,sun));
    sky+=vec3(1.,.75,.4)*(pow(a,90.)*.3+smoothstep(.9997,.9999,a));
    if(ray.y>.015){
      vec2 at=eye.xz+ray.xz*max(0.,(cloudY-eye.y)/ray.y)+worldOffset+vec2(.5,-.4)*${CLOUD_HEIGHT}.;
      float n=cloudField(at),body=smoothstep(.55,.64,n),rim=1.-smoothstep(.6,.7,n);
      vec3 cloud=mix(vec3(.57,.62,.71),vec3(1.,.88,.68),rim*.8);
      sky=mix(sky,cloud,body*cloudFade*smoothstep(.015,.12,ray.y));
    }
    color=vec4(sky,1.);glow=vec4(0.);
  }`;
  function seamSkirts(mesh){
    const f=new Float32Array(mesh.buffer),bytes=new Uint8Array(mesh.buffer),edges=new Map(),vertex=i=>Array.from(f.subarray(i*4,i*4+3));
    const key=p=>p.map(x=>Math.round(x*100000)).join(',');
    for(let i=0;i<mesh.count;i+=3)for(const [a,b] of [[i,i+1],[i+1,i+2],[i+2,i]]){
      const A=vertex(a),B=vertex(b);
      if(![0,2].some(k=>Math.max(A[k],B[k])<.51||Math.min(A[k],B[k])>31.49))continue;
      const ka=key(A),kb=key(B),k=ka<kb?ka+':'+kb:kb+':'+ka;
      const edge=edges.get(k);if(edge)edge.count++;else edges.set(k,{a,b,count:1});
    }
    const boundary=[...edges.values()].filter(e=>e.count===1),buffer=new ArrayBuffer(boundary.length*6*16),out=new Uint8Array(buffer),of=new Float32Array(buffer);let n=0;
    for(const {a,b} of boundary)for(const [i,down] of [[b,0],[a,0],[a,1],[b,0],[a,1],[b,1]]){out.set(bytes.subarray(i*16,i*16+16),n*16);if(down)of[n*4+1]-=8;n++;}
    return {buffer,count:n};
  }
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
      ({program:this.program,u:this.u}=link(gl,vertex(false),fragment,[...DRAW_UNIFORMS,'center','halfView','palette','time','detail','depth','dither','pixelWorld','shadowMap','shadowOn','shadowTexel','cards','grassGrow','cloudTime','worldOffset','placeholder','xray','peek','yBase']));
      ({program:this.casterProgram,u:this.cu}=link(gl,vertex(true),casterFragment,[...DRAW_UNIFORMS,'caster']));
      ({program:this.grassProgram,u:this.gu}=link(gl,grassVertex,grassFragment,['origin','scale','patternOrigin','center','lightAt','lightHalf','lightAxes','halfView','depth','time','grow','grassColor','shadowOn','shadowTexel','blockSize','dither','shadowMap','cloudTime','worldOffset','palette']));
      ({program:this.leafProgram,u:this.lu}=link(gl,leafVertex,leafFragment,['origin','scale','patternOrigin','center','lightAt','lightHalf','lightAxes','halfView','depth','time','grow','shadowOn','shadowTexel','blockSize','dither','shadowMap','leafShape','cloudTime','worldOffset','palette','peek','biomeMap','biomeSize']));
      gl.useProgram(this.leafProgram);gl.uniform1i(this.lu.shadowMap,1);gl.uniform1f(this.lu.blockSize,.3);
      // Conifer card outline for comparison (?leaves=round|soft|hard|round+soft|mixed); mixed by default.
      gl.uniform1f(this.lu.leafShape,Math.max(0,['round','soft','hard','round+soft','mixed'].indexOf(new URLSearchParams(root.location?.search||'').get('leaves')||'mixed')));
      ({program:this.cloudProgram,u:this.ku}=link(gl,cloudVertex,cloudFragment,['center','halfView','extent','middle','depth','worldOffset','cloudTime','cloudFade','cloudY']));
      this.cloudVao=gl.createVertexArray();
      ({program:this.skirtProgram,u:this.ku2}=link(gl,skirtVertex(false),skirtFragment,['origin','center','lightAt','lightHalf','lightAxes','halfView','depth','time','palette','shadowOn','shadowTexel','blockSize','shadowMap','dither']));
      // Object trees: tubes, lobes and (on a lighter skirt mesh) conifer tiers, with depth-only shadow variants.
      const OBJ=['origin','center','lightAt','lightHalf','lightAxes','halfView','depth','time','palette','shadowOn','shadowTexel','blockSize','shadowMap','dither','biomeMap','biomeSize','blockScale'];
      ({program:this.tubeProgram,u:this.tu}=link(gl,tubeVertex(false),tubeFragment,OBJ));
      ({program:this.lobeProgram,u:this.lou}=link(gl,lobeVertex(false),lobeFragment,OBJ));
      ({program:this.tubeCaster,u:this.tuc}=link(gl,tubeVertex(true),objectCaster,OBJ));
      ({program:this.pondProgram,u:this.pu2}=link(gl,pondVertex,pondFragment,['origin','center','halfView','depth','dither']));
      ({program:this.lobeCaster,u:this.louc}=link(gl,lobeVertex(true),lobeCasterFragment,OBJ));
      ({program:this.skirtCaster,u:this.kuc}=link(gl,skirtVertex(true),objectCaster,OBJ));
      for(const [p,u] of [[this.tubeProgram,this.tu],[this.lobeProgram,this.lou]]){gl.useProgram(p);gl.uniform1i(u.shadowMap,1);gl.uniform1f(u.blockSize,.3);gl.uniform1i(u.biomeMap,3);}
      for(const [p,u] of [[this.lobeCaster,this.louc]]){gl.useProgram(p);gl.uniform1i(u.biomeMap,3);}
      const geometry=data=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return {buffer:b,count:data.length};};
      this.tubeGeom=geometry(makeTube());this.tubeGeom.verts=this.tubeGeom.count/2;
      // Stems and branches: a lighter tube (6 sides, 2 rings); only trunk feet need the full one for their roots.
      this.limbGeom=geometry(makeTube(6,2));this.limbGeom.verts=this.limbGeom.count/2;
      this.lobeGeom=geometry(new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]));this.lobeGeom.verts=6;
      this.tierGeom=geometry(makeSkirt(24,6));this.tierGeom.verts=this.tierGeom.count/3;
      this.skirtGeom=makeSkirt();this.skirtBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.skirtBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.skirtGeom,gl.STATIC_DRAW);
      gl.useProgram(this.skirtProgram);gl.uniform1i(this.ku2.shadowMap,1);gl.uniform1f(this.ku2.blockSize,.5);
      ({program:this.frondProgram,u:this.ru}=link(gl,frondVertex,frondFragment,['origin','center','lightAt','lightHalf','lightAxes','halfView','depth','time','palette','shadowOn','shadowTexel','blockSize','shadowMap']));
      this.frondBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.frondBuffer);gl.bufferData(gl.ARRAY_BUFFER,makeFrond(),gl.STATIC_DRAW);
      gl.useProgram(this.frondProgram);gl.uniform1i(this.ru.shadowMap,1);gl.uniform1f(this.ru.blockSize,.25);
      ({program:this.mushroomProgram,u:this.mu}=link(gl,mushroomVertex,mushroomFragment,['origin','center','lightAt','lightHalf','lightAxes','halfView','depth','palette','shadowOn','shadowTexel','blockSize','shadowMap']));
      this.mushroomGeom=makeMushroom();this.mushroomBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.mushroomBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.mushroomGeom,gl.STATIC_DRAW);
      gl.useProgram(this.mushroomProgram);gl.uniform1i(this.mu.shadowMap,1);gl.uniform1f(this.mu.blockSize,.2);
      ({program:this.stalkProgram,u:this.su}=link(gl,stalkVertex,stalkFragment,['origin','scale','patternOrigin','center','halfView','depth','time','pixelWorld','palette','peek','biomeMap','biomeSize']));
      ({program:this.fernProgram,u:this.fe}=link(gl,fernVertex,fernFragment,['origin','scale','patternOrigin','center','halfView','depth','time','palette','biomeMap','biomeSize']));
      this.fernGeom=makeFern();this.fernBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.fernBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.fernGeom,gl.STATIC_DRAW);
      for(const [program,u] of [[this.stalkProgram,this.su],[this.fernProgram,this.fe],[this.leafProgram,this.lu]]){gl.useProgram(program);gl.uniform1i(u.biomeMap,3);}
      ({program:this.flowerProgram,u:this.fu}=link(gl,flowerVertex,flowerFragment,['origin','scale','patternOrigin','center','halfView','depth','time','pixelWorld','palette']));
      ({program:this.postProgram,u:this.pu}=link(gl,postVertex,postFragment,['sceneColor','sceneDepth','sceneGlow','texel','depthRange','threshold','ink','width']));
      gl.useProgram(this.postProgram);gl.uniform1i(this.pu.sceneColor,4);gl.uniform1i(this.pu.sceneDepth,5);gl.uniform1i(this.pu.sceneGlow,7);this.postVao=gl.createVertexArray();
      // Outlines on by default; ?outlines=0 turns them off for comparison.
      this.outlines=new URLSearchParams(root.location?.search||'').get('outlines')!=='0';
      ({program:this.skyProgram,u:this.skyU}=link(gl,postVertex,skyFragment,['resolution','tanFov','worldOffset','cloudTime','cloudFade','cloudY']));
      this.cardBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.cardBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
      this.tuft=makeTuft();this.tuftBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.tuftBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.tuft,gl.STATIC_DRAW);
      gl.useProgram(this.grassProgram);gl.uniform1i(this.gu.shadowMap,1);gl.uniform1f(this.gu.blockSize,.05);gl.uniform3fv(this.gu.grassColor,[1,3,5].map(i=>parseInt(M.COLORS[M.MAT.grass].slice(i,i+2),16)/255));
      gl.useProgram(this.casterProgram);gl.uniform1i(this.cu.normalMap,0);
      gl.useProgram(this.program);
      const colors=[...M.COLORS];
      const paletteValues=[...M.COLORS].flatMap(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255));
      for(const [program,u] of [[this.grassProgram,this.gu],[this.leafProgram,this.lu],[this.flowerProgram,this.fu],[this.stalkProgram,this.su],[this.fernProgram,this.fe],[this.mushroomProgram,this.mu],[this.frondProgram,this.ru],[this.skirtProgram,this.ku2],[this.tubeProgram,this.tu],[this.lobeProgram,this.lou]]){gl.useProgram(program);gl.uniform3fv(u.palette,paletteValues);}
      gl.useProgram(this.program);
      gl.uniform1i(this.u.normalMap,0);gl.uniform1i(this.u.shadowMap,1);gl.uniform1i(this.u.canopyMap,2);gl.uniform1i(this.u.biomeMap,3);gl.uniform1i(this.u.waterMap,6);gl.uniform1i(this.u.rockMap,8);gl.uniform3fv(this.u.palette,colors.flatMap(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255)));
      this.cube=this.upload(makeCube());this.draws=0;this.triangles=0;this.pixelRatio=1;this.lost=false;this.queue=[];this.dithering=[0,0];this.casting=false;this.shadow=null;
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(.77,.81,.76,1);
    }
    // Voxel geometry of one mesh (or one vertical slice of a streamed node): the block mesh, and the smooth-terrain mesh
    // with its seam skirts when present. top: highest vertex in blocks (local to the mesh).
    geometry(mesh){const gl=this.gl,vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.buffer,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.UNSIGNED_SHORT,false,8,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.UNSIGNED_BYTE,false,8,6);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.UNSIGNED_BYTE,false,8,7);
      // Highest vertex in blocks, so the sun's shadow box can reach the tallest thing drawn.
      const ys=new Uint16Array(mesh.buffer);let top=0;for(let i=1;i<ys.length;i+=4)top=Math.max(top,ys[i]);
      const out={vao,buffer,count:mesh.count,bytes:mesh.buffer.byteLength,top};
      if(mesh.smooth?.count){
        // Smooth terrain: float position, signed-byte normal, byte material (16 bytes a vertex).
        const svao=gl.createVertexArray(),sbuf=gl.createBuffer();gl.bindVertexArray(svao);gl.bindBuffer(gl.ARRAY_BUFFER,sbuf);gl.bufferData(gl.ARRAY_BUFFER,mesh.smooth.buffer,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,3,gl.BYTE,true,16,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.UNSIGNED_BYTE,false,16,15);
        out.smooth={vao:svao,buffer:sbuf,count:mesh.smooth.count};out.bytes+=mesh.smooth.buffer.byteLength;out.top=Math.max(out.top,Math.ceil(mesh.smooth.top));
        const seams=seamSkirts(mesh.smooth),vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,seams.buffer,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,3,gl.BYTE,true,16,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.UNSIGNED_BYTE,false,16,15);
        out.seams={vao,buffer,count:seams.count};out.bytes+=seams.buffer.byteLength;
      }
      gl.bindVertexArray(null);return out;
    }
    // A streamed node arrives as vertical slices (mesh.slices, each with its origin y in blocks and slice-local vertex y)
    // plus per-footprint maps and props; other meshes (chunks, the crew cube) are one piece in their own frame.
    // Prop instances (grass, cards, stalks, flowers in blocks; skirts, fronds, mushrooms in metres) arrive in absolute
    // height; they are rebased in place on the node's lowest meshed block (mesh.base), which draws add back on the GPU
    // side relative to the explorer, so no prop vertex or uniform carries kilometres of altitude.
    rebaseProps(mesh){
      const rb=mesh.base||0,rm=rb*(mesh.column||0),shift=(a,stride,k,v)=>{if(a?.length&&v)for(let i=k;i<a.length;i+=stride)a[i]-=v;};
      shift(mesh.grass,4,1,rb);shift(mesh.flowers,4,1,rb);shift(mesh.leaves,8,1,rb);shift(mesh.stalks,8,1,rb);
      shift(mesh.skirts,8,2,rm);shift(mesh.skirts,8,3,rm);shift(mesh.fronds,8,1,rm);shift(mesh.mushrooms,8,1,rm);
      shift(mesh.treeSegs,12,1,rm);shift(mesh.treeSegs,12,5,rm);shift(mesh.treeLobes,12,1,rm);if(mesh.treeLobes&&rm)for(let i=0;i<mesh.treeLobes.length;i+=12)if(mesh.treeLobes[i+7]<1.5)mesh.treeLobes[i+9]-=rm;shift(mesh.treeTiers,8,2,rm);shift(mesh.treeTiers,8,3,rm);shift(mesh.treeShadows,4,1,rm);
      return {rb,rm};
    }
    upload(mesh){const gl=this.gl;let out;const {rb,rm}=mesh.slices?this.rebaseProps(mesh):{rb:0,rm:0};
      if(mesh.slices){
        const slices=mesh.slices.map(sl=>({y:sl.y,...this.geometry(sl)}));
        out={slices,count:slices.reduce((n,s)=>n+s.count,0),bytes:slices.reduce((n,s)=>n+s.bytes,0),top:slices.reduce((n,s)=>Math.max(n,s.y+s.top),0),bottom:slices.length?Math.min(...slices.map(s=>s.y)):0,normalMap:null,normalSize:0,groundBase:0};
      }else out={...this.geometry(mesh),normalMap:null,normalSize:0,groundBase:0};
      out.propBlocks=rb;out.propMetres=rm;
      if(mesh.rockDetail?.length){
        // Rock detail: RGBA8 at twice the column resolution, filtered.
        const n=Math.round(Math.sqrt(mesh.rockDetail.length/4));out.rockMap=gl.createTexture();out.bytes+=mesh.rockDetail.byteLength;gl.bindTexture(gl.TEXTURE_2D,out.rockMap);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,n,n,0,gl.RGBA,gl.UNSIGNED_BYTE,mesh.rockDetail);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      }
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
      // Object trees: instance buffers over the shared tube, lobe and tier meshes; their tops raise the tile's top (in
      // blocks) so culling and the sun's shadow box reach the crowns.
      const instanced=(data,geom,comps,slots)=>{
        const vao=gl.createVertexArray(),buf=gl.createBuffer(),stride=slots*16;gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER,geom.buffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,comps,gl.FLOAT,false,comps*4,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
        for(let k=0;k<slots;k++){gl.enableVertexAttribArray(1+k);gl.vertexAttribPointer(1+k,4,gl.FLOAT,false,stride,k*16);gl.vertexAttribDivisor(1+k,1);}
        out.bytes+=data.byteLength;return {vao,buffer:buf,count:data.length/(slots*4)};
      };
      let treeTop=0;
      if(mesh.treeSegs?.length){
        const all=mesh.treeSegs,feet=[],limbs=[];for(let k=0;k<all.length;k+=12){(all[k+10]===1?feet:limbs).push(k);treeTop=Math.max(treeTop,all[k+1],all[k+5]);}
        const pick=list=>{const a=new Float32Array(list.length*12);list.forEach((k,i)=>a.set(all.subarray(k,k+12),i*12));return a;};
        if(feet.length)out.treeSegs=instanced(pick(feet),this.tubeGeom,2,3);if(limbs.length)out.treeLimbs=instanced(pick(limbs),this.limbGeom,2,3);
      }
      if(mesh.treeLobes?.length){out.treeLobes=instanced(mesh.treeLobes,this.lobeGeom,2,3);for(let k=0;k<mesh.treeLobes.length;k+=12)treeTop=Math.max(treeTop,mesh.treeLobes[k+1]+mesh.treeLobes[k+3]*mesh.treeLobes[k+4]*1.3);}
      if(mesh.treeShadows?.length)out.treeShadows=instanced(mesh.treeShadows,this.lobeGeom,2,1);
      if(mesh.treeTiers?.length){out.treeTiers=instanced(mesh.treeTiers,this.tierGeom,3,2);for(let k=0;k<mesh.treeTiers.length;k+=8)treeTop=Math.max(treeTop,mesh.treeTiers[k+2]);}
      if(treeTop){out.frondTop=Math.max(out.frondTop||0,treeTop+rm);if(mesh.column)out.top=Math.max(out.top,Math.ceil((treeTop+rm)/mesh.column)-(out.slices?0:0));}
      if(mesh.skirts?.length){
        const kvao=gl.createVertexArray(),kbuf=gl.createBuffer();gl.bindVertexArray(kvao);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.skirtBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,kbuf);gl.bufferData(gl.ARRAY_BUFFER,mesh.skirts,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(1,1);
        gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,32,16);gl.vertexAttribDivisor(2,1);
        out.skirts={vao:kvao,buffer:kbuf,count:mesh.skirts.length/8};out.bytes+=mesh.skirts.byteLength;
        let top=0;for(let k=0;k<mesh.skirts.length;k+=8)top=Math.max(top,mesh.skirts[k+2]+rm);out.frondTop=Math.max(out.frondTop||0,top);
      }
      if(mesh.fronds?.length){
        const fvao=gl.createVertexArray(),fbuf=gl.createBuffer();gl.bindVertexArray(fvao);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.frondBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,fbuf);gl.bufferData(gl.ARRAY_BUFFER,mesh.fronds,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(1,1);
        gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,32,16);gl.vertexAttribDivisor(2,1);
        out.fronds={vao:fvao,buffer:fbuf,count:mesh.fronds.length/8};out.bytes+=mesh.fronds.byteLength;
        let top=0;for(let k=0;k<mesh.fronds.length;k+=8)top=Math.max(top,mesh.fronds[k+1]+mesh.fronds[k+6]+rm);out.frondTop=Math.max(out.frondTop||0,top);
      }
      if(mesh.mushrooms?.length){
        const mvao=gl.createVertexArray(),mbuf=gl.createBuffer();gl.bindVertexArray(mvao);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.mushroomBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,16,12);
        gl.bindBuffer(gl.ARRAY_BUFFER,mbuf);gl.bufferData(gl.ARRAY_BUFFER,mesh.mushrooms,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(2,1);
        gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,4,gl.FLOAT,false,32,16);gl.vertexAttribDivisor(3,1);
        out.mushrooms={vao:mvao,buffer:mbuf,count:mesh.mushrooms.length/8};out.bytes+=mesh.mushrooms.byteLength;
      }
      let ferns=null;
      if(mesh.stalks?.length){
        const all=mesh.stalks,keep=[],fern=[];for(let k=0;k<all.length;k+=8)(Math.floor(all[k+3])===M.MAT.fern?fern:keep).push(k);
        if(fern.length){ferns=new Float32Array(fern.length*8);fern.forEach((k,i)=>ferns.set(all.subarray(k,k+8),i*8));}
        const rest=new Float32Array(keep.length*8);keep.forEach((k,i)=>rest.set(all.subarray(k,k+8),i*8));mesh={...mesh,stalks:rest.length?rest:null};
      }
      if(ferns){
        const fvao=gl.createVertexArray(),fbuf=gl.createBuffer();gl.bindVertexArray(fvao);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.fernBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,fbuf);gl.bufferData(gl.ARRAY_BUFFER,ferns,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(1,1);
        gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,32,16);gl.vertexAttribDivisor(2,1);
        let top=0;for(let k=0;k<ferns.length;k+=8)top=Math.max(top,ferns[k+1]+ferns[k+4]*1.5);
        out.ferns={vao:fvao,buffer:fbuf,count:ferns.length/8};out.bytes+=ferns.byteLength;out.top=Math.max(out.top,Math.ceil(top));
      }
      if(mesh.stalks?.length){
        const svao=gl.createVertexArray(),sbuf=gl.createBuffer();gl.bindVertexArray(svao);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.cardBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,sbuf);gl.bufferData(gl.ARRAY_BUFFER,mesh.stalks,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(1,1);
        gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,32,16);gl.vertexAttribDivisor(2,1);
        let top=0;for(let k=0;k<mesh.stalks.length;k+=8)top=Math.max(top,mesh.stalks[k+1]+mesh.stalks[k+4]+rb);
        out.stalks={vao:svao,buffer:sbuf,count:mesh.stalks.length/8};out.bytes+=mesh.stalks.byteLength;out.top=Math.max(out.top,Math.ceil(top));
      }
      gl.bindVertexArray(null);
      return out;
    }
    dither(mode,t){this.dithering=[mode,t];}
    // A coarser tile standing in while finer ones stream in: lit as usual but casting and receiving no sun shadows and
    // carrying no ink, so its blocky shapes stay quiet until the real tile arrives.
    placeholder(on){this.flat=on;}
    // Quarters of the next drawn node to skip (finished finer nodes cover them); a masked stand-in draws ground only.
    mask(bits){this.maskBits=bits||0;}
    disposeGeometry(g){const gl=this.gl;gl.deleteBuffer(g.buffer);gl.deleteVertexArray(g.vao);if(g.seams){gl.deleteBuffer(g.seams.buffer);gl.deleteVertexArray(g.seams.vao);}if(g.smooth){gl.deleteBuffer(g.smooth.buffer);gl.deleteVertexArray(g.smooth.vao);}}
    dispose(mesh){for(const k of ['treeSegs','treeLimbs','treeLobes','treeTiers','treeShadows'])if(mesh[k]){this.gl.deleteBuffer(mesh[k].buffer);this.gl.deleteVertexArray(mesh[k].vao);}if(mesh.slices)for(const sl of mesh.slices)this.disposeGeometry(sl);else this.disposeGeometry(mesh);if(mesh.normalMap)this.gl.deleteTexture(mesh.normalMap);if(mesh.canopyMap)this.gl.deleteTexture(mesh.canopyMap);if(mesh.biomeMap)this.gl.deleteTexture(mesh.biomeMap);if(mesh.rockMap)this.gl.deleteTexture(mesh.rockMap);if(mesh.waterTex)this.gl.deleteTexture(mesh.waterTex);if(mesh.grass){this.gl.deleteBuffer(mesh.grass.buffer);this.gl.deleteVertexArray(mesh.grass.vao);}if(mesh.leaves){this.gl.deleteBuffer(mesh.leaves.buffer);this.gl.deleteVertexArray(mesh.leaves.vao);}if(mesh.skirts){this.gl.deleteBuffer(mesh.skirts.buffer);this.gl.deleteVertexArray(mesh.skirts.vao);}if(mesh.fronds){this.gl.deleteBuffer(mesh.fronds.buffer);this.gl.deleteVertexArray(mesh.fronds.vao);}if(mesh.mushrooms){this.gl.deleteBuffer(mesh.mushrooms.buffer);this.gl.deleteVertexArray(mesh.mushrooms.vao);}if(mesh.stalks){this.gl.deleteBuffer(mesh.stalks.buffer);this.gl.deleteVertexArray(mesh.stalks.vao);}if(mesh.ferns){this.gl.deleteBuffer(mesh.ferns.buffer);this.gl.deleteVertexArray(mesh.ferns.vao);}if(mesh.flowers){this.gl.deleteBuffer(mesh.flowers.buffer);this.gl.deleteVertexArray(mesh.flowers.vao);}}
    resize(economy){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.pixelRatio=Math.min(devicePixelRatio||1,economy?1:1.5);const w=Math.max(1,Math.round(r.width*this.pixelRatio)),h=Math.max(1,Math.round(r.height*this.pixelRatio));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.aspect=w/h;}
    // Biomes around the view (names; repeats weight a biome); the atmosphere eases toward their average.
    setAtmosphere(biomes,snap=false){
      const t=SKY.base.map(c=>c.map(()=>0));for(const b of biomes)skyFor(b).forEach((c,i)=>c.forEach((v,j)=>t[i][j]+=v/biomes.length));
      this.skyTarget=biomes.length?t:null;if(snap&&this.skyTarget)this.sky_=this.skyTarget.map(c=>[...c]);
    }
    // GPU frame: every position uploaded to the GPU is relative to the explorer in all three axes. The stream already
    // rebases x/z; height is rebased here by yBase (the view height snapped to 64 m), subtracted from every origin, centre,
    // eye, light box and cloud height at upload. CPU-side frames (queue, project, bounds) stay in absolute height, and
    // pattern origins stay absolute so shading never moves.
    cameraUniforms(time){
      const now=performance.now(),dt=Math.min(1,(now-(this.skyClock||now))/1000);this.skyClock=now;
      const target=this.skyTarget||SKY.base;this.sky_=this.sky_||target.map(c=>[...c]);
      const k=1-Math.exp(-dt/1.5);this.sky_.forEach((c,i)=>c.forEach((v,j)=>c[j]=v+(target[i][j]-v)*k));
      // Fog: the slider's amount (0..1), and the mist layer's base and thickness. The map's base is the eased ground under the view centre, its thickness growing with the span; Walk's
      // base is just under the walker's feet, a thin mist.
      const gl=this.gl,yb=this.yBase||0,v={...this.view,eye:[this.view.eye[0],this.view.eye[1]-yb,this.view.eye[2]],viewProj:Float32Array.from(this.view.viewProj)},c=this.camera,o=this.worldOrigin||{x:0,z:0},P=95*4096,off=[o.x,o.z].map(x=>x-P*Math.round(x/P)),fog=this.fogAmount??.5;
      for(let i=0;i<4;i++)v.viewProj[12+i]+=yb*this.view.viewProj[4+i];
      // Layer base in the GPU's explorer-relative height (like the eye); the bank noise adds yBase back so it stays put.
      const layer=v.ortho?[(c.y??8)-4-yb,10]:[(c.eyeY??c.y??8)-2.1-yb,6];
      for(const [program,u] of [[this.pondProgram,this.pu2],[this.tubeProgram,this.tu],[this.lobeProgram,this.lou],[this.program,this.u],[this.grassProgram,this.gu],[this.leafProgram,this.lu],[this.flowerProgram,this.fu],[this.stalkProgram,this.su],[this.fernProgram,this.fe],[this.mushroomProgram,this.mu],[this.frondProgram,this.ru],[this.skirtProgram,this.ku2],[this.cloudProgram,this.ku],[this.postProgram,this.pu],[this.skyProgram,this.skyU]]){
        gl.useProgram(program);gl.uniformMatrix4fv(u.viewProj,false,v.viewProj);gl.uniform3fv(u.eye,v.eye);gl.uniform3fv(u.camRight,v.right);gl.uniform3fv(u.camUp,v.up);gl.uniform3fv(u.camForward,v.forward);gl.uniform1f(u.walkView,v.ortho?0:1);gl.uniform1f(u.cameraNear,v.near);gl.uniform1f(u.cameraFar,v.far);gl.uniform1f(u.cameraPixelScale,v.pixelWorldAt(1));
        gl.uniform3fv(u.skyHorizon,this.sky_[0]);gl.uniform3fv(u.skyZenith,this.sky_[1]);gl.uniform3fv(u.fogLit,this.sky_[2]);gl.uniform3fv(u.fogShade,this.sky_[3]);gl.uniform1f(u.fogAmount,fog);gl.uniform1f(u.fogTime,time);gl.uniform2fv(u.fogOffset,off);gl.uniform2fv(u.fogLayer,layer);gl.uniform1f(u.fogY,yb);if(program===this.postProgram)gl.uniformMatrix4fv(u.inverseViewProj,false,invert(v.viewProj));
      }
    }
    sky(off){
      const gl=this.gl,u=this.skyU;gl.useProgram(this.skyProgram);gl.uniform2f(u.resolution,this.canvas.width,this.canvas.height);gl.uniform1f(u.tanFov,Math.tan(this.view.fovY/2));gl.uniform2fv(u.worldOffset,off);gl.uniform1f(u.cloudTime,this.time);gl.uniform1f(u.cloudFade,this.cloudOpacity??.85);gl.uniform1f(u.cloudY,this.cloudHeight(this.camera)-(this.yBase||0));
      gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.bindVertexArray(this.postVao);gl.drawArrays(gl.TRIANGLES,0,3);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);
    }
    // Cloud deck height (m): 620 m over lowland; over high ground it rides 600 m above the view so mountains stay under it.
    cloudHeight(camera){return Math.max(CLOUD_HEIGHT,(camera.mode==='walk'?camera.eyeY??camera.y??8:camera.y??8)+600);}
    begin(camera,time,economy){const gl=this.gl;this.resize(economy);this.camera=camera;this.view=cameraView(camera,this.aspect,this.canvas.width);this.yBase=Math.round((camera.mode==='walk'?camera.eyeY??camera.y??8:camera.y??8)/64)*64;this.cameraUniforms(time);this.economy=economy;this.queue.length=0;gl.useProgram(this.program);gl.uniform1f(this.u.yBase,this.yBase);gl.uniform3f(this.u.center,camera.x,(camera.y??8)-this.yBase,camera.z);gl.uniform2f(this.u.halfView,camera.span/2,camera.span/2/this.aspect);gl.uniform1f(this.u.time,time);this.time=time;gl.uniform1f(this.u.detail,economy?.5:1);gl.uniform1f(this.u.pixelWorld,camera.span/this.canvas.width);gl.uniform1f(this.u.depth,Math.max(600,camera.span*2.5/Math.min(1,this.aspect)));this.draws=0;this.triangles=0;}
    // Draws are recorded and replayed by end(): first into the sun's depth map (casters only), then to the screen.
    draw(mesh,origin,scale=[M.CELL,M.CELL,M.CELL],material=0,yaw=0,pitch=0,offset=[0,0,0],patternOrigin=origin){
      const mask=this.maskBits||0;if(mask)mesh={...mesh,grass:null,leaves:null,flowers:null,stalks:null,ferns:null,mushrooms:null,fronds:null,skirts:null,treeSegs:null,treeLimbs:null,treeLobes:null,treeTiers:null};
      this.queue.push({mesh,origin,scale,material,yaw,pitch,offset,patternOrigin,dither:this.dithering,flat:!!this.flat,caster:this.casting,mask});}
    replay(u,d){const gl=this.gl,m=d.mesh,yb=this.yBase||0;gl.uniform1f(u.quadMask,d.mask||0);gl.uniform3f(u.origin,d.origin[0],d.origin[1]-yb,d.origin[2]);gl.uniform3fv(u.scale,d.scale);gl.uniform3fv(u.localOffset,d.offset);gl.uniform1f(u.overrideMaterial,d.material);gl.uniform1f(u.yaw,d.yaw);gl.uniform1f(u.pitch,d.pitch);gl.uniform1f(u.blockSize,d.scale[0]);gl.uniform1f(u.normalSize,m.normalSize||0);if(m.normalMap){gl.uniform1f(u.groundBase,m.groundBase);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,m.normalMap);if(m.canopyMap){gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,m.canopyMap);gl.activeTexture(gl.TEXTURE0);}if(m.biomeMap){gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,m.biomeMap);gl.activeTexture(gl.TEXTURE0);}gl.uniform1f(u.rockOn,m.rockMap?1:0);if(m.rockMap){gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,m.rockMap);gl.activeTexture(gl.TEXTURE0);}if(m.waterTex){gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,m.waterTex);gl.activeTexture(gl.TEXTURE0);}}
      if(!m.slices){this.drawGeometry(u,m);return;}
      // Vertical slices: each draws at its own origin (y in blocks), with the pattern frame and the hillshade's ground base
      // moved by the same amount so shading stays in absolute world height.
      const o=d.origin,p=d.patternOrigin;
      for(const sl of m.slices){const dy=sl.y*d.scale[1];gl.uniform3f(u.origin,o[0],o[1]+dy-yb,o[2]);gl.uniform3f(u.patternOrigin,p[0],p[1]+dy,p[2]);if(m.normalMap)gl.uniform1f(u.groundBase,m.groundBase-sl.y);this.drawGeometry(u,sl);}}
    drawGeometry(u,m){const gl=this.gl;gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count);if(m.smooth){gl.uniform1f(u.smoothMesh,1);gl.bindVertexArray(m.smooth.vao);gl.drawArrays(gl.TRIANGLES,0,m.smooth.count);if(this.camera.mode==='walk'&&m.seams){gl.bindVertexArray(m.seams.vao);gl.drawArrays(gl.TRIANGLES,0,m.seams.count);}gl.uniform1f(u.smoothMesh,0);}}
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
    lightBox(camera,size,top=(camera.y??8)+camera.span*.5,bottom=0){
      const b=camera.mode==='walk'?{minX:camera.x-60,maxX:camera.x+60,minZ:camera.z-60,maxZ:camera.z+60}:this.bounds(camera,top,bottom),pad=camera.mode==='walk'?0:camera.span*.3,A=LIGHT_AXES,pts=[];
      for(const x of [b.minX-pad,b.maxX+pad])for(const z of [b.minZ-pad,b.maxZ+pad])for(const y of [bottom,top])pts.push([x,y,z]);
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
      if(t){for(const f of [t.msaa,t.resolve])gl.deleteFramebuffer(f);for(const r of [t.colorRb,t.glowRb,t.depthRb])gl.deleteRenderbuffer(r);for(const x of [t.color,t.glow,t.depth])gl.deleteTexture(x);}
      const samples=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)),rb=(format)=>{const r=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,r);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,format,w,h);return r;};
      const tex=(format)=>{const x=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,x);gl.texStorage2D(gl.TEXTURE_2D,1,format,w,h);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);return x;};
      gl.activeTexture(gl.TEXTURE4);
      t={w,h,colorRb:rb(gl.RGBA8),glowRb:rb(gl.RGBA8),depthRb:rb(gl.DEPTH_COMPONENT24),color:tex(gl.RGBA8),glow:tex(gl.RGBA8),depth:tex(gl.DEPTH_COMPONENT24),msaa:gl.createFramebuffer(),resolve:gl.createFramebuffer()};
      gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER,t.msaa);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,t.colorRb);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.RENDERBUFFER,t.glowRb);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,t.depthRb);
      gl.bindFramebuffer(gl.FRAMEBUFFER,t.resolve);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.color,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,t.glow,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,t.depth,0);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      return this.scene=t;
    }
    // Whether a recorded tile overlaps the screen (with a margin): grass and leaf cards are skipped for tiles just outside
    // it, which the stream keeps loaded around the view.
    // Screen area (CSS pixels) of a tile's ground footprint, scaled by the share of its screen box inside the viewport (map
    // view; the orthographic footprint area does not depend on height).
    screenArea(d){
      const c=this.camera,size=32*d.scale[0],y=d.origin[1],P=[[0,0],[size,0],[size,size],[0,size]].map(([u,v])=>this.project(c,d.origin[0]+u,y,d.origin[2]+v));
      let area=0;for(let i=0;i<4;i++){const a=P[i],b=P[(i+1)%4];area+=a.x*b.y-b.x*a.y;}area=Math.abs(area)/2;
      const x0=Math.min(...P.map(p=>p.x)),x1=Math.max(...P.map(p=>p.x)),y0=Math.min(...P.map(p=>p.y)),y1=Math.max(...P.map(p=>p.y)),box=(x1-x0)*(y1-y0);
      const seen=Math.max(0,Math.min(x1,this.width)-Math.max(x0,0))*Math.max(0,Math.min(y1,this.height)-Math.max(y0,0));
      return box>0?area*seen/box:0;
    }
    onScreen(d,margin=40){
      if(this.camera.mode==='walk'){
        if(d.caster)return true;
        const v=this.view,m=v.viewProj,size=32*d.scale[0],top=d.origin[1]+(d.mesh.top||0)*d.scale[1];
        const points=[];for(const x of [d.origin[0],d.origin[0]+size])for(const z of [d.origin[2],d.origin[2]+size])for(const y of [d.origin[1],top])points.push([x,y,z,1].map((_,i)=>m[i]*x+m[i+4]*y+m[i+8]*z+m[i+12]));
        // Conservative homogeneous clip-plane test, padded for wind-blown cards and a small turn margin.
        return ![p=>p[3]+12,p=>p[3]*1.2+p[0]+12,p=>p[3]*1.2-p[0]+12,p=>p[3]*1.2+p[1]+12,p=>p[3]*1.2-p[1]+12].some(plane=>points.every(p=>plane(p)<0));
      }
      const c=this.camera,size=32*d.scale[0],top=d.origin[1]+(d.mesh.top||0)*d.scale[1];let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
      for(const x of [d.origin[0],d.origin[0]+size])for(const z of [d.origin[2],d.origin[2]+size])for(const y of [d.origin[1],top]){const p=this.project(c,x,y,z);x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);}
      const m=margin;return x1>-m&&x0<this.width+m&&y1>-m&&y0<this.height+m;
    }
    // Object trees of the queued tiles: tubes, lobes and conifer tiers, into the sun's depth map (shadow) or the scene.
    drawTrees(shadow,c,{lightAt,box,cy,shadows}){
      const gl=this.gl,yb=this.yBase||0;if(!this.queue.some(d=>d.mesh.treeSegs||d.mesh.treeLimbs||d.mesh.treeLobes||d.mesh.treeTiers))return;
      gl.disable(gl.CULL_FACE);
      const kinds=[['treeSegs',shadow?this.tubeCaster:this.tubeProgram,shadow?this.tuc:this.tu,this.tubeGeom],['treeLimbs',shadow?this.tubeCaster:this.tubeProgram,shadow?this.tuc:this.tu,this.limbGeom],['treeLobes',shadow?this.lobeCaster:this.lobeProgram,shadow?this.louc:this.lou,this.lobeGeom],['treeTiers',shadow?this.skirtCaster:this.skirtProgram,shadow?this.kuc:this.ku2,this.tierGeom]];
      for(const [key,program,u,geom] of kinds){
        if(!this.queue.some(d=>d.mesh[key]))continue;gl.useProgram(program);
        gl.uniform3f(u.center,c.x,cy,c.z);gl.uniform2f(u.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(u.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(u.time,this.time);
        if(shadow||shadows){gl.uniform3fv(u.lightAt,lightAt);gl.uniform3fv(u.lightHalf,box.half);gl.uniformMatrix3fv(u.lightAxes,false,LIGHT_AXES);gl.uniform1f(u.shadowTexel,box.texel);}
        if(!shadow){gl.uniform1f(u.shadowOn,shadows?1:0);if(program===this.skirtProgram)gl.uniform1f(u.blockSize,.3);}
        if(!shadow&&program===this.lobeProgram)gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);else gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
        for(const d of this.queue){
          const t=d.mesh[key];if(!t)continue;
          if(shadow){if(d.flat||d.dither[0]<0||c.mode==='walk'&&(Math.abs(d.origin[0]-c.x)>96+32*d.scale[0]||Math.abs(d.origin[2]-c.z)>96+32*d.scale[0]))continue;}
          else{if(!this.onScreen(d))continue;gl.uniform2f(u.dither,d.dither[0],d.dither[1]);if(program===this.lobeProgram){this.bindBiome(u,d.mesh);gl.uniform1f(u.blockScale,d.scale[0]);}}
          const o=[d.origin[0],d.origin[1]+(d.mesh.propMetres||0)-yb,d.origin[2]];gl.uniform3fv(u.origin,program===this.skirtProgram||program===this.skirtCaster?[o[0],o[1],o[2]]:o);
          gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,geom.verts,t.count);
          if(!shadow){this.draws++;this.triangles+=t.count*geom.verts/3;}
        }
      }
      gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
      if(!shadow&&this.skirtProgram){gl.useProgram(this.skirtProgram);gl.uniform1f(this.ku2.blockSize,.5);gl.uniform2f(this.ku2.dither,0,0);}
      gl.enable(gl.CULL_FACE);gl.bindVertexArray(null);
    }
    // A tile's biome map on unit 3, for object programs that tint by biome (size 0: no map, no tint).
    bindBiome(u,m){const gl=this.gl;gl.uniform1f(u.biomeSize,m.biomeMap?m.normalSize||0:0);if(m.biomeMap){gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,m.biomeMap);gl.activeTexture(gl.TEXTURE0);}}
    end(){
      // One world frame for everything cloud-related: the stream's rebasing origin (world metres at local zero). It is
      // wrapped only beyond ±195 km to stay exact in single precision; the wrap is centred on zero, because wrapping at
      // zero itself swapped in a different sky whenever the view crossed the world origin near home.
      const CLOUD_PERIOD=95*4096,o=this.worldOrigin||{x:0,z:0},off=[o.x,o.z].map(v=>v-CLOUD_PERIOD*Math.round(v/CLOUD_PERIOD));
      // Sun shadows fade to sub-pixel by about 600 m spans; beyond that the pass is skipped (cloud shadows carry the mood).
      const gl=this.gl,c=this.camera,shadows=c.mode==='walk'||!this.economy&&c.span<600;let top=(c.y??8)+c.span*.5;
      // The box spans the drawn content's height range: from the lowest ground any drawn node holds (not sea level, which
      // can lie kilometres below a mountain view) to the tallest thing drawn.
      let bottom=Infinity;
      if(shadows)for(const d of this.queue){top=Math.max(top,d.origin[1]+(d.mesh.top+Math.abs(d.offset[1]))*d.scale[1],d.mesh.frondTop||0);bottom=Math.min(bottom,d.origin[1]+(d.mesh.normalMap?d.mesh.groundBase:0)*d.scale[1]-2);}
      const box=shadows?this.lightBox(c,this.shadowTarget().size,top,Math.max(0,Math.min(bottom,(c.y??8)-c.span))):null,yb=this.yBase||0,lightAt=box&&[box.at[0],box.at[1]-yb,box.at[2]],cy=(c.y??8)-yb;
      // Props whose instance data was rebased at upload (see upload) draw from the node's own height reference.
      const propOrigin=(d,metres)=>[d.origin[0],d.origin[1]+(metres?d.mesh.propMetres||0:(d.mesh.propBlocks||0)*d.scale[1])-yb,d.origin[2]];
      if(shadows){
        const t=this.shadow;gl.bindFramebuffer(gl.FRAMEBUFFER,t.framebuffer);gl.viewport(0,0,t.size,t.size);gl.clear(gl.DEPTH_BUFFER_BIT);
        // Back faces only: the sun-facing side of a caster never compares against its own depth, so it cannot self-shadow.
        gl.useProgram(this.casterProgram);gl.uniform3fv(this.cu.lightAt,lightAt);gl.uniform3fv(this.cu.lightHalf,box.half);gl.uniformMatrix3fv(this.cu.lightAxes,false,LIGHT_AXES);gl.cullFace(gl.FRONT);
        for(const d of this.queue){if(d.flat||d.dither[0]<0||c.mode==='walk'&&(Math.abs(d.origin[0]-c.x)>96+32*d.scale[0]||Math.abs(d.origin[2]-c.z)>96+32*d.scale[0]))continue;gl.uniform1f(this.cu.caster,d.caster?1:0);this.replay(this.cu,d);}
        gl.cullFace(gl.BACK);
        this.drawTrees(true,c,{lightAt,box,cy});
      }
      // Economy draws straight to the canvas without outlines or antialiasing.
      const post=!this.economy&&(c.mode==='walk'||(this.outlines||(this.fogAmount??.5)>0)&&c.span<1800),scene=post?this.sceneTarget():null;
      gl.bindFramebuffer(gl.FRAMEBUFFER,scene?scene.msaa:null);
      gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(scene)gl.clearBufferfv(gl.COLOR,1,[0,0,0,0]);if(c.mode==='walk')this.sky(off);gl.useProgram(this.program);gl.uniform1f(this.u.shadowOn,shadows?1:0);
      // Grass and leaf cards are full grown up to ~3 cm per pixel, shrink away by 5 cm, and are skipped further out.
      const pixel=c.mode==='walk'?0:c.span/this.canvas.width,grow=1-Math.min(1,Math.max(0,(pixel-.03)/.02));gl.uniform1f(this.u.cloudTime,this.time);const pk=c.mode!=='walk'&&this.peekAt?[this.peekAt.x*this.pixelRatio,(this.height-this.peekAt.y)*this.pixelRatio,(this.peekRadius||110)*this.pixelRatio]:[0,0,0];gl.uniform3fv(this.u.peek,pk);gl.uniform2f(this.u.worldOffset,...off);
      if(shadows){gl.uniform3fv(this.u.lightAt,lightAt);gl.uniform3fv(this.u.lightHalf,box.half);gl.uniformMatrix3fv(this.u.lightAxes,false,LIGHT_AXES);gl.uniform1f(this.u.shadowTexel,box.texel);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.shadow.texture);gl.activeTexture(gl.TEXTURE0);}
      // Close-zoom tones apply per tile, only where that tile really carries leaf cards or grass blades: a coarse
      // placeholder shown while finer tiles load keeps the far-zoom colours instead of dark, bladeless grass and boxy crowns.
      for(const d of this.queue){if(c.mode==='walk'&&!this.onScreen(d))continue;gl.uniform3fv(this.u.patternOrigin,d.patternOrigin);gl.uniform2f(this.u.dither,d.dither[0],d.dither[1]);gl.uniform1f(this.u.placeholder,d.flat?1:0);gl.uniform1f(this.u.cards,d.mesh.leaves?grow:0);gl.uniform1f(this.u.grassGrow,d.mesh.grass?grow:0);this.replay(this.u,d);this.draws++;this.triangles+=d.mesh.count/3;}
      if(this.queue.some(d=>d.mesh.treeShadows)){
        const g=this.pu2;gl.useProgram(this.pondProgram);gl.uniform3f(g.center,c.x,cy,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));
        gl.enable(gl.BLEND);gl.blendFunc(gl.DST_COLOR,gl.ZERO);gl.depthMask(false);gl.disable(gl.CULL_FACE);
        for(const d of this.queue){const t=d.mesh.treeShadows;if(!t||!this.onScreen(d))continue;gl.uniform3fv(g.origin,[d.origin[0],d.origin[1]+(d.mesh.propMetres||0)-(this.yBase||0),d.origin[2]]);gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,6,t.count);}
        gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.CULL_FACE);gl.bindVertexArray(null);
      }
      if(grow>0&&this.queue.some(d=>d.mesh.grass)){
        const g=this.gu;gl.useProgram(this.grassProgram);gl.disable(gl.CULL_FACE);
        gl.uniform3f(g.center,c.x,cy,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.time,this.time);gl.uniform1f(g.cloudTime,this.time);gl.uniform2f(g.worldOffset,...off);gl.uniform1f(g.grow,grow*grow*(3-2*grow));gl.uniform1f(g.shadowOn,shadows?1:0);
        if(shadows){gl.uniform3fv(g.lightAt,lightAt);gl.uniform3fv(g.lightHalf,box.half);gl.uniformMatrix3fv(g.lightAxes,false,LIGHT_AXES);gl.uniform1f(g.shadowTexel,box.texel);}
        // Tuft budget per frame tied to screen size (about one per 40 CSS pixels; Economy a quarter). Wide grassy views draw
        // the same fraction of every tile's shuffled list, so meadows thin evenly instead of costing millions of vertices.
        // On the map each tile gets its own budget from the screen area it covers (same density), so its grass never depends
        // on which other tiles happen to be queued; Walk shares one budget across the view.
        const shown=this.queue.filter(d=>d.mesh.grass&&this.onScreen(d)),total=shown.reduce((n,d)=>n+d.mesh.grass.count,0),density=this.economy?160:40,budget=this.width*this.height/density,share=Math.min(1,budget/Math.max(1,total));
        const tileCount=d=>{const t=d.mesh.grass;if(c.mode==='walk')return Math.ceil(t.count*share);const a=this.screenArea(d);return Math.min(t.count,Math.ceil(a/density));};
        for(const d of shown){const t=d.mesh.grass,count=tileCount(d);gl.uniform3fv(g.origin,propOrigin(d));gl.uniform3fv(g.scale,d.scale);gl.uniform3fv(g.patternOrigin,d.patternOrigin);gl.uniform2f(g.dither,d.dither[0],d.dither[1]);gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,BLADES*BLADE_VERTS,count);this.draws++;this.triangles+=count*BLADES*3;}
        gl.enable(gl.CULL_FACE);
      }
      if(this.queue.some(d=>d.mesh.skirts)){
        const g=this.ku2;gl.useProgram(this.skirtProgram);gl.disable(gl.CULL_FACE);
        gl.uniform3f(g.center,c.x,cy,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.time,this.time);gl.uniform1f(g.shadowOn,shadows?1:0);
        if(shadows){gl.uniform3fv(g.lightAt,lightAt);gl.uniform3fv(g.lightHalf,box.half);gl.uniformMatrix3fv(g.lightAxes,false,LIGHT_AXES);gl.uniform1f(g.shadowTexel,box.texel);}
        const n=this.skirtGeom.length/3;
        for(const d of this.queue){const t=d.mesh.skirts;if(!t||!this.onScreen(d))continue;gl.uniform3fv(g.origin,propOrigin(d,true));gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,n,t.count);this.draws++;this.triangles+=t.count*n/3;}
        gl.enable(gl.CULL_FACE);
      }
      this.drawTrees(false,c,{lightAt,box,cy,shadows});
      if(this.queue.some(d=>d.mesh.fronds)){
        const g=this.ru;gl.useProgram(this.frondProgram);gl.disable(gl.CULL_FACE);
        gl.uniform3f(g.center,c.x,cy,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.time,this.time);gl.uniform1f(g.shadowOn,shadows?1:0);
        if(shadows){gl.uniform3fv(g.lightAt,lightAt);gl.uniform3fv(g.lightHalf,box.half);gl.uniformMatrix3fv(g.lightAxes,false,LIGHT_AXES);gl.uniform1f(g.shadowTexel,box.texel);}
        for(const d of this.queue){const t=d.mesh.fronds;if(!t||!this.onScreen(d))continue;gl.uniform3fv(g.origin,propOrigin(d,true));gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,FROND_SEGS*6,t.count);this.draws++;this.triangles+=t.count*FROND_SEGS*2;}
        gl.enable(gl.CULL_FACE);
      }
      if(this.queue.some(d=>d.mesh.mushrooms)){
        const g=this.mu;gl.useProgram(this.mushroomProgram);
        gl.uniform3f(g.center,c.x,cy,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.shadowOn,shadows?1:0);
        if(shadows){gl.uniform3fv(g.lightAt,lightAt);gl.uniform3fv(g.lightHalf,box.half);gl.uniformMatrix3fv(g.lightAxes,false,LIGHT_AXES);gl.uniform1f(g.shadowTexel,box.texel);}
        const n=this.mushroomGeom.length/4;
        for(const d of this.queue){const t=d.mesh.mushrooms;if(!t||!this.onScreen(d))continue;gl.uniform3fv(g.origin,propOrigin(d,true));gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,n,t.count);this.draws++;this.triangles+=t.count*n/3;}
      }
      if(this.queue.some(d=>d.mesh.stalks)){
        const g=this.su;gl.useProgram(this.stalkProgram);gl.disable(gl.CULL_FACE);gl.uniform3fv(g.peek,pk);
        gl.uniform3f(g.center,c.x,cy,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.time,this.time);gl.uniform1f(g.pixelWorld,c.span/this.width);
        for(const d of this.queue){const t=d.mesh.stalks;if(!t||!this.onScreen(d))continue;this.bindBiome(g,d.mesh);gl.uniform3fv(g.origin,propOrigin(d));gl.uniform3fv(g.scale,d.scale);gl.uniform3fv(g.patternOrigin,d.patternOrigin);gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,6,t.count);this.draws++;this.triangles+=t.count*2;}
        gl.enable(gl.CULL_FACE);
      }
      if(this.queue.some(d=>d.mesh.ferns)){
        const g=this.fe,n=this.fernGeom.length/3;gl.useProgram(this.fernProgram);gl.disable(gl.CULL_FACE);
        gl.uniform3f(g.center,c.x,cy,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.time,this.time);
        for(const d of this.queue){const t=d.mesh.ferns;if(!t||!this.onScreen(d))continue;this.bindBiome(g,d.mesh);gl.uniform3fv(g.origin,propOrigin(d));gl.uniform3fv(g.scale,d.scale);gl.uniform3fv(g.patternOrigin,d.patternOrigin);gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,n,t.count);this.draws++;this.triangles+=t.count*n/3;}
        gl.enable(gl.CULL_FACE);
      }
      // Flowers draw at every zoom their tiles exist (close views only), never smaller than a few pixels.
      if(this.queue.some(d=>d.mesh.flowers)){
        const g=this.fu;gl.useProgram(this.flowerProgram);gl.disable(gl.CULL_FACE);
        gl.uniform3f(g.center,c.x,cy,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.time,this.time);gl.uniform1f(g.pixelWorld,c.span/this.width);
        for(const d of this.queue){const t=d.mesh.flowers;if(!t||!this.onScreen(d))continue;gl.uniform3fv(g.origin,propOrigin(d));gl.uniform3fv(g.scale,d.scale);gl.uniform3fv(g.patternOrigin,d.patternOrigin);gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,6,t.count);this.draws++;this.triangles+=t.count*2;}
        gl.enable(gl.CULL_FACE);
      }
      if(grow>0&&this.queue.some(d=>d.mesh.leaves)){
        const g=this.lu;gl.useProgram(this.leafProgram);gl.disable(gl.CULL_FACE);gl.uniform3fv(g.peek,pk);gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
        gl.uniform3f(g.center,c.x,cy,c.z);gl.uniform2f(g.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(g.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));gl.uniform1f(g.time,this.time);gl.uniform1f(g.cloudTime,this.time);gl.uniform2f(g.worldOffset,...off);gl.uniform1f(g.grow,grow*grow*(3-2*grow));gl.uniform1f(g.shadowOn,shadows?1:0);
        if(shadows){gl.uniform3fv(g.lightAt,lightAt);gl.uniform3fv(g.lightHalf,box.half);gl.uniformMatrix3fv(g.lightAxes,false,LIGHT_AXES);gl.uniform1f(g.shadowTexel,box.texel);}
        for(const d of this.queue){const t=d.mesh.leaves;if(!t||!this.onScreen(d))continue;this.bindBiome(g,d.mesh);gl.uniform3fv(g.origin,propOrigin(d));gl.uniform3fv(g.scale,d.scale);gl.uniform3fv(g.patternOrigin,d.patternOrigin);gl.uniform2f(g.dither,d.dither[0],d.dither[1]);gl.bindVertexArray(t.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,6,t.count);this.draws++;this.triangles+=t.count*2;}
        gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);gl.enable(gl.CULL_FACE);
      }
      // X-ray pass: crew parts drawn again only where something nearer covers them.
      if(this.queue.some(d=>d.caster)){
        gl.useProgram(this.program);gl.uniform1f(this.u.xray,1);gl.uniform1f(this.u.placeholder,0);gl.uniform2f(this.u.dither,0,0);
        gl.depthFunc(gl.GREATER);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE);
        for(const d of this.queue)if(d.caster){gl.uniform3fv(this.u.patternOrigin,d.patternOrigin);this.replay(this.u,d);}
        gl.disable(gl.BLEND);gl.depthMask(true);gl.depthFunc(gl.LESS);gl.uniform1f(this.u.xray,0);
      }
      if(scene){
        const W=scene.w,H=scene.h,p=this.pu;
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER,scene.msaa);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,scene.resolve);
        gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.NONE]);gl.blitFramebuffer(0,0,W,H,0,0,W,H,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);
        gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.drawBuffers([gl.NONE,gl.COLOR_ATTACHMENT1]);gl.blitFramebuffer(0,0,W,H,0,0,W,H,gl.COLOR_BUFFER_BIT,gl.NEAREST);
        gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H);
        gl.useProgram(this.postProgram);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,scene.color);gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,scene.depth);gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,scene.glow);gl.activeTexture(gl.TEXTURE0);
        gl.uniform2f(p.texel,1/W,1/H);gl.uniform1f(p.depthRange,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));
        // Lines only where the depth jumps by about a metre up close, more as the view widens (tens of metres at continent
        // view, where only cliffs and isles ink); they fade out over the widest zooms.
        gl.uniform1f(p.width,c.mode==='walk'?.8*this.pixelRatio:Math.max(1,this.pixelRatio));gl.uniform1f(p.threshold,c.mode==='walk'?.6:Math.max(1.2,c.span*.012));gl.uniform1f(p.ink,!this.outlines?0:c.mode==='walk'?.35:.75*(1-Math.min(1,Math.max(0,(c.span-600)/1200))));
        gl.disable(gl.DEPTH_TEST);gl.bindVertexArray(this.postVao);gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.DEPTH_TEST);gl.bindVertexArray(null);
      }
      // Clouds fade in from ~150 m spans to full by ~400 m, drawn last over everything (after the outlines, so no lines
      // show through them).
      const fade=c.mode==='walk'?0:Math.min(1,Math.max(0,(c.span-150)/250));
      if(fade>0&&(this.cloudOpacity??.85)>0){
        const k=this.ku,b=this.bounds(c,this.cloudHeight(c));
        gl.useProgram(this.cloudProgram);gl.bindVertexArray(this.cloudVao);gl.bindBuffer(gl.ARRAY_BUFFER,this.cardBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
        gl.uniform3f(k.center,c.x,cy,c.z);gl.uniform1f(k.cloudY,this.cloudHeight(c)-yb);gl.uniform2f(k.halfView,c.span/2,c.span/2/this.aspect);gl.uniform1f(k.depth,Math.max(600,c.span*2.5/Math.min(1,this.aspect)));
        gl.uniform2f(k.middle,(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2);gl.uniform2f(k.extent,(b.maxX-b.minX)/2+20,(b.maxZ-b.minZ)/2+20);
        gl.uniform2f(k.worldOffset,...off);
        gl.uniform1f(k.cloudTime,this.time);gl.uniform1f(k.cloudFade,fade*fade*(3-2*fade)*(this.cloudOpacity??.85));
        gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES,0,6);
        gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.bindVertexArray(null);
      }
      this.lastError=this.lastError||gl.getError();this.queue.length=0;
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
    project(camera,x,y,z){if(camera.mode==='walk'){const v=this.camera===camera&&this.view?this.view:cameraView(camera,this.aspect,this.canvas.width),m=v.viewProj,p=[x,y,z,1],q=[0,1,2,3].map(k=>p.reduce((n,a,i)=>n+a*m[i*4+k],0));return {x:this.width*(.5+q[0]/q[3]*.5),y:this.height*(.5-q[1]/q[3]*.5),depth:q[3]};}const halfY=camera.span/2/this.aspect,dx=x-camera.x,dz=z-camera.z;return {x:this.width*(.5+(dx*CY-dz*SY)/camera.span),y:this.height*(.5-((y-(camera.y??8))*C-(dx*SY+dz*CY)*S)/(2*halfY))};}
    screenDirection(right,down){return {x:right*CY+down*SY,z:-right*SY+down*CY};}
    pan(camera,dx,dy){const horizontal=-dx*camera.span/this.width,forward=-dy*camera.span/(this.width*S);camera.x+=horizontal*CY+forward*SY;camera.z+=-horizontal*SY+forward*CY;}
    // How far above or below the view centre content can still be on screen in the map view: the orthographic view keeps
    // a depth slab of +-depth along the view direction, so visible heights lie within halfY*cos + depth*sin of the centre.
    yReach(camera){if(camera.mode==='walk')return camera.viewDistance||600;const aspect=this.aspect||1,halfY=camera.span/2/aspect,depth=Math.max(600,camera.span*2.5/Math.min(1,aspect));return halfY*C+depth*S;}
    // Ground-plane footprint of the view for content between heights `low` and `height`.
    bounds(camera,height,low=0){
      if(camera.mode==='walk'){const d=camera.viewDistance||600;return {minX:camera.x-d,maxX:camera.x+d,minZ:camera.z-d,maxZ:camera.z+d};}
      const points=[];
      for(const y of [low,height])for(const h of [-camera.span/2,camera.span/2])for(const v of [-camera.span/2/this.aspect,camera.span/2/this.aspect]){const f=((y-(camera.y??8))*C-v)/S;points.push({x:camera.x+h*CY+f*SY,z:camera.z-h*SY+f*CY});}
      return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
    }
    pick(camera,clientX,clientY,world){
      if(camera.mode==='walk'){
        const r=this.canvas.getBoundingClientRect(),v=cameraView(camera,this.aspect,this.canvas.width),tx=((clientX-r.left)/r.width*2-1)*Math.tan(v.fovY/2)*this.aspect,ty=(1-(clientY-r.top)/r.height*2)*Math.tan(v.fovY/2);
        const ray=v.forward.map((n,i)=>n+v.right[i]*tx+v.up[i]*ty),len=Math.hypot(...ray);for(let i=0;i<3;i++)ray[i]/=len;
        const at=t=>{const x=v.eye[0]+ray[0]*t,y=v.eye[1]+ray[1]*t,z=v.eye[2]+ray[2]*t,g=world.ground(x,z);return g!==null&&y<=g?{x,y:g,z}:null;};
        for(let t=v.near;t<v.far;t+=.5)if(at(t)){let lo=Math.max(0,t-.5),hi=t;for(let i=0;i<8;i++){const mid=(lo+hi)/2;if(at(mid))hi=mid;else lo=mid;}return at(hi);}
        return {x:-1,y:0,z:-1};
      }
      const r=this.canvas.getBoundingClientRect(),horizontal=(clientX-r.left-r.width/2)/r.width*camera.span,vertical=(.5-(clientY-r.top)/r.height)*camera.span/this.aspect;
      // March from the camera-facing end, so a cliff cannot select hidden ground behind itself.
      // Coarse 1 m steps find the first hit; 1/16 m steps from just above it place it exactly.
      const at=y=>{const forward=((y-(camera.y??8))*C-vertical)/S,x=camera.x+horizontal*CY+forward*SY,z=camera.z-horizontal*SY+forward*CY,ground=world.ground(x,z);return ground!==null&&y<=ground?{x,z,y:ground}:null;};
      // Only heights inside the view's depth slab can be hit (see yReach); wide views march in coarser steps.
      // Through the class, so pick also works on view-like objects (project/pick are called that way).
      const ceiling=Math.min(world.heightMetres,(camera.y??8)+Renderer.prototype.yReach.call(this,camera)),step=Math.max(1,camera.span/800);
      for(let top=ceiling;top>-step;top-=step)if(at(Math.max(0,top))){for(let y=Math.min(ceiling,top+step);y>=0;y-=.0625){const hit=at(y);if(hit)return hit;}break;}
      return {x:-1,y:0,z:-1};
    }
  }
  Renderer.cameraView=cameraView;Renderer.seamSkirts=seamSkirts;
  root.MicroRenderer=Renderer;
})(globalThis);
