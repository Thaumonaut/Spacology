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
  uniform vec3 origin, scale, localOffset, center, patternOrigin;
  uniform vec2 halfView;
  uniform float yaw, pitch, overrideMaterial, depth;
  uniform vec3 lightAt, lightHalf;
  uniform mat3 lightAxes;
  out vec3 worldPosition;
  out vec3 lightCoord;
  out vec3 normal;
  out vec3 block;
  flat out int mat;
  flat out int shaded;
  void main(){
    vec3 p=(position+localOffset)*scale;
    p=vec3(p.x,p.y*cos(pitch)-p.z*sin(pitch),p.y*sin(pitch)+p.z*cos(pitch));
    p=vec3(p.x*cos(yaw)+p.z*sin(yaw),p.y,-p.x*sin(yaw)+p.z*cos(yaw));
    worldPosition=p+patternOrigin;p+=origin;block=position;
    vec3 n=face<.5?vec3(-1,0,0):face<1.5?vec3(1,0,0):face<2.5?vec3(0,-1,0):face<3.5?vec3(0,1,0):face<4.5?vec3(0,0,-1):vec3(0,0,1);
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
  const fragment=`#version 300 es
  precision highp float;
  in vec3 worldPosition;
  in vec3 normal;
  in vec3 block;
  in vec3 lightCoord;
  flat in int mat;
  flat in int shaded;
  uniform vec3 palette[32];
  uniform vec3 lightHalf;
  uniform float shadowOn, shadowTexel;
  uniform highp sampler2DShadow shadowMap;
  uniform float time, detail, normalSize, groundBase, blockSize, pixelWorld;
  uniform vec2 dither;
  uniform sampler2D normalMap;
  out vec4 color;
  const vec3 SUN=normalize(vec3(-.5,1.,.4));
  float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  // Patterns fade out before their wavelength drops under a few pixels, so they never alias into shimmer or moiré.
  float visible(float wavelength){return smoothstep(2.,5.,wavelength/pixelWorld);}
  // Fraction of sunlight reaching this point: five hardware-filtered taps soften the edge. The bias is about one block,
  // or two shadow texels when those are coarser, so a canopy does not shadow its own lit side.
  float sunlight(){
    if(shadowOn<.5||any(lessThan(lightCoord,vec3(0)))||any(greaterThan(lightCoord,vec3(1))))return 1.;
    float bias=max(blockSize*1.2,shadowTexel*2.)/(2.*lightHalf.z),texel=shadowTexel/(2.*lightHalf.x),sum=0.;
    for(int i=0;i<5;i++){vec2 o=i==0?vec2(0):vec2(i<3?-1.2:1.2,(i&1)==0?-1.2:1.2)*texel;sum+=texture(shadowMap,vec3(lightCoord.xy+o,lightCoord.z-bias));}
    return sum/5.;
  }
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
    vec3 light=mix(vec3(.62,.58,.52),vec3(.78,.82,.9),n.y*.5+.5)*.72+vec3(1.,.95,.85)*key*.45*sunlight();
    light*=1.+cavity*.3;
    float grain=(hash(floor(worldPosition*4.+normal*.01))-.5)*.07*detail*visible(.25);
    vec3 base=palette[mat];
    // Vertical water (waterfalls) carries bright streaks running down.
    if(mat==7&&abs(normal.y)<.5)base+=vec3(.1)*step(.7,fract(worldPosition.y*.8+time*2.4+floor(worldPosition.x*1.7+worldPosition.z*1.3)*.37))*visible(1.2);
    if(mat==7){float ripple=sin(worldPosition.z*3.+worldPosition.x*1.7-time*1.4);base+=vec3(.025,.04,.04)*ripple*visible(1.8);}
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
    color=vec4(lit,1.);
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
  const DRAW_UNIFORMS=['origin','scale','localOffset','patternOrigin','yaw','pitch','overrideMaterial','normalMap','normalSize','groundBase','blockSize','lightAt','lightHalf','lightAxes'];
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
      this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'low-power'});
      if(!gl)throw new Error('WebGL2 is unavailable. Enable hardware acceleration or try another browser.');
      ({program:this.program,u:this.u}=link(gl,vertex(false),fragment,[...DRAW_UNIFORMS,'center','halfView','palette','time','detail','depth','dither','pixelWorld','shadowMap','shadowOn','shadowTexel']));
      ({program:this.casterProgram,u:this.cu}=link(gl,vertex(true),casterFragment,[...DRAW_UNIFORMS,'caster']));
      gl.useProgram(this.casterProgram);gl.uniform1i(this.cu.normalMap,0);
      gl.useProgram(this.program);
      const colors=[...M.COLORS];
      gl.uniform1i(this.u.normalMap,0);gl.uniform1i(this.u.shadowMap,1);gl.uniform3fv(this.u.palette,colors.flatMap(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255)));
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
      return out;
    }
    dither(mode,t){this.dithering=[mode,t];}
    dispose(mesh){this.gl.deleteBuffer(mesh.buffer);this.gl.deleteVertexArray(mesh.vao);if(mesh.normalMap)this.gl.deleteTexture(mesh.normalMap);}
    resize(economy){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.pixelRatio=Math.min(devicePixelRatio||1,economy?1:1.5);const w=Math.max(1,Math.round(r.width*this.pixelRatio)),h=Math.max(1,Math.round(r.height*this.pixelRatio));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.aspect=w/h;}
    begin(camera,time,economy){const gl=this.gl;this.resize(economy);this.camera=camera;this.economy=economy;this.queue.length=0;gl.useProgram(this.program);gl.uniform3f(this.u.center,camera.x,camera.y??8,camera.z);gl.uniform2f(this.u.halfView,camera.span/2,camera.span/2/this.aspect);gl.uniform1f(this.u.time,time);gl.uniform1f(this.u.detail,economy?.5:1);gl.uniform1f(this.u.pixelWorld,camera.span/this.canvas.width);gl.uniform1f(this.u.depth,Math.max(600,camera.span*2.5/Math.min(1,this.aspect)));this.draws=0;this.triangles=0;}
    // Draws are recorded and replayed by end(): first into the sun's depth map (casters only), then to the screen.
    draw(mesh,origin,scale=[M.CELL,M.CELL,M.CELL],material=0,yaw=0,pitch=0,offset=[0,0,0],patternOrigin=origin){this.queue.push({mesh,origin,scale,material,yaw,pitch,offset,patternOrigin,dither:this.dithering,caster:this.casting});}
    replay(u,d){const gl=this.gl,m=d.mesh;gl.uniform3fv(u.origin,d.origin);gl.uniform3fv(u.scale,d.scale);gl.uniform3fv(u.localOffset,d.offset);gl.uniform1f(u.overrideMaterial,d.material);gl.uniform1f(u.yaw,d.yaw);gl.uniform1f(u.pitch,d.pitch);gl.uniform1f(u.blockSize,d.scale[0]);gl.uniform1f(u.normalSize,m.normalSize||0);if(m.normalMap){gl.uniform1f(u.groundBase,m.groundBase);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,m.normalMap);}gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count);}
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
    end(){
      const gl=this.gl,shadows=!this.economy,c=this.camera;let top=(c.y??8)+c.span*.5;
      if(shadows)for(const d of this.queue)top=Math.max(top,d.origin[1]+(d.mesh.top+Math.abs(d.offset[1]))*d.scale[1]);
      const box=shadows?this.lightBox(c,this.shadowTarget().size,top):null;
      if(shadows){
        const t=this.shadow;gl.bindFramebuffer(gl.FRAMEBUFFER,t.framebuffer);gl.viewport(0,0,t.size,t.size);gl.clear(gl.DEPTH_BUFFER_BIT);
        // Back faces only: the sun-facing side of a caster never compares against its own depth, so it cannot self-shadow.
        gl.useProgram(this.casterProgram);gl.uniform3fv(this.cu.lightAt,box.at);gl.uniform3fv(this.cu.lightHalf,box.half);gl.uniformMatrix3fv(this.cu.lightAxes,false,LIGHT_AXES);gl.cullFace(gl.FRONT);
        for(const d of this.queue){gl.uniform1f(this.cu.caster,d.caster?1:0);this.replay(this.cu,d);}
        gl.cullFace(gl.BACK);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      }
      gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniform1f(this.u.shadowOn,shadows?1:0);
      if(shadows){gl.uniform3fv(this.u.lightAt,box.at);gl.uniform3fv(this.u.lightHalf,box.half);gl.uniformMatrix3fv(this.u.lightAxes,false,LIGHT_AXES);gl.uniform1f(this.u.shadowTexel,box.texel);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.shadow.texture);gl.activeTexture(gl.TEXTURE0);}
      for(const d of this.queue){gl.uniform3fv(this.u.patternOrigin,d.patternOrigin);gl.uniform2f(this.u.dither,d.dither[0],d.dither[1]);this.replay(this.u,d);this.draws++;this.triangles+=d.mesh.count/3;}
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
