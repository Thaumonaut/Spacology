(function(root){
  'use strict';
  // Building lab renderer: greedy-meshed voxel segments (one per storey, one for the roof, so floors can be hidden for
  // a cutaway without remeshing), drawn with banded toon light, a sun shadow map and depth-edge outlines.
  // A single building at 6.25 cm is a few million cells, which plain greedy meshing handles; this is not the
  // many-buildings path (see README).
  const NORMALS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

  // Greedy mesh of vol restricted to y in [y0, y1). Faces against the segment boundary are kept, so each segment is
  // closed on its own. Output: 8-byte vertices (uint16 x,y,z; uint8 normal, material) and uint32 indices.
  function meshSegment(vol,dims,y0,y1,ownership=null,segment=-1){
    const [X,Y,Z]=dims,at=(x,y,z)=>{if(x<0||z<0||x>=X||z>=Z||y<0||y>=Y)return 0;const i=x+X*(z+Z*y),v=vol[i];if(!v)return 0;const owner=ownership?.get(i);return owner===undefined?(y<y0||y>=y1?0:v):owner===segment?v:0;};
    let scan0=y0,scan1=y1;if(ownership)for(const [i,owner] of ownership)if(owner===segment){const y=Math.floor(i/(X*Z));scan0=Math.min(scan0,y);scan1=Math.max(scan1,y+1);}
    const verts=[],idx=[];let nq=0;
    const quad=(p,du,dv,n,m)=>{for(const c of [[0,0],[1,0],[1,1],[0,1]])verts.push(p[0]+du[0]*c[0]+dv[0]*c[1],p[1]+du[1]*c[0]+dv[1]*c[1],p[2]+du[2]*c[0]+dv[2]*c[1],n|(m<<8));
      const b=nq*4;idx.push(b,b+1,b+2,b,b+2,b+3);nq++;};
    // Bounds of solid content in this segment, to skip empty space.
    let lo=[X,y1,Z],hi=[-1,y0-1,-1];
    for(let y=scan0;y<scan1;y++)for(let z=0;z<Z;z++)for(let x=0;x<X;x++)if(at(x,y,z)){if(x<lo[0])lo[0]=x;if(x>hi[0])hi[0]=x;if(z<lo[2])lo[2]=z;if(z>hi[2])hi[2]=z;if(y<lo[1])lo[1]=y;if(y>hi[1])hi[1]=y;}
    if(hi[0]<0)return {verts:new Uint16Array(0),idx:new Uint32Array(0),quads:0};
    for(let axis=0;axis<3;axis++){const u=(axis+1)%3,v=(axis+2)%3,U=hi[u]-lo[u]+1,Vn=hi[v]-lo[v]+1,mask=new Int16Array(U*Vn);
      for(const dir of [1,-1]){const n=axis*2+(dir>0?0:1);
        for(let q=lo[axis];q<=hi[axis];q++){mask.fill(0);
          for(let b=0;b<Vn;b++)for(let a=0;a<U;a++){const c=[0,0,0];c[axis]=q;c[u]=lo[u]+a;c[v]=lo[v]+b;const m=at(c[0],c[1],c[2]);if(!m)continue;c[axis]+=dir;if(!at(c[0],c[1],c[2]))mask[a+U*b]=m;}
          for(let b=0;b<Vn;b++)for(let a=0;a<U;){const m=mask[a+U*b];if(!m){a++;continue;}let wdt=1;while(a+wdt<U&&mask[a+wdt+U*b]===m)wdt++;
            let h=1;outer:for(;b+h<Vn;h++){for(let k=0;k<wdt;k++)if(mask[a+k+U*(b+h)]!==m)break outer;}
            for(let hh=0;hh<h;hh++)for(let k=0;k<wdt;k++)mask[a+k+U*(b+hh)]=0;
            const p=[0,0,0];p[axis]=q+(dir>0?1:0);p[u]=lo[u]+a;p[v]=lo[v]+b;const du=[0,0,0],dv=[0,0,0];du[u]=wdt;dv[v]=h;quad(p,du,dv,n,m);a+=wdt;}}}}
    return {verts:Uint16Array.from(verts),idx:Uint32Array.from(idx),quads:nq};
  }

  const VS=`#version 300 es
  layout(location=0) in uvec4 a;layout(location=1) in vec3 aSmooth;
  uniform mat4 uVP;uniform mat4 uLight;uniform mat4 uModel;uniform float uCell;uniform bool uSoft;
  out vec3 vPos;out vec3 vNormal;flat out uint vN;flat out uint vM;out vec4 vLight;
  const vec3 NN[6]=vec3[6](vec3(1,0,0),vec3(-1,0,0),vec3(0,1,0),vec3(0,-1,0),vec3(0,0,1),vec3(0,0,-1));
  // Shadows are looked up from a point nudged off the surface along its normal, so a wall never shadows itself.
  void main(){vec3 p=(uModel*vec4(vec3(a.xyz)*uCell,1.)).xyz;vPos=p;vN=a.w&255u;vM=a.w>>8u;vNormal=mat3(uModel)*(uSoft?aSmooth:NN[vN]);vLight=uLight*vec4(p+vNormal*uCell*1.5,1.);gl_Position=uVP*vec4(p,1.);}`;
  const FS=`#version 300 es
  precision highp float;precision highp sampler2DShadow;
  in vec3 vPos;in vec3 vNormal;flat in uint vN;flat in uint vM;in vec4 vLight;
  uniform sampler2D uPal;uniform sampler2DShadow uShadow;uniform vec3 uSun;uniform float uTexel;uniform uint uGlow;uniform uint uPaper;
  layout(location=0) out vec4 oColor;
  const vec3 N[6]=vec3[6](vec3(1,0,0),vec3(-1,0,0),vec3(0,1,0),vec3(0,-1,0),vec3(0,0,1),vec3(0,0,-1));
  void main(){
    vec3 n=normalize(vNormal),base=texelFetch(uPal,ivec2(int(vM),0),0).rgb;
    vec3 l=vLight.xyz/vLight.w*.5+.5;float sh=0.;
    for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)sh+=texture(uShadow,vec3(l.xy+vec2(i,j)*uTexel,l.z-.0006));
    sh/=9.;if(l.x<0.||l.x>1.||l.y<0.||l.y>1.)sh=1.;
    float ndl=dot(n,uSun),lit=smoothstep(.0,.08,ndl)*sh;
    // banded toon: lit / shade, with a cool sky ambient from above and warm bounce from below
    float face=n.y>.5?1.:n.y<-.5?.62:(abs(n.x)>.5?.86:.78);
    vec3 shade=base*mix(vec3(.52,.56,.72),vec3(.68,.66,.70),.5+.5*n.y)*face;
    vec3 lightc=base*vec3(1.05,1.0,.93)*face;
    vec3 c=mix(shade,lightc,lit);
    if(vM==uGlow||vM==uPaper)c=base*(vM==uGlow?1.15:.95+.25*lit); // lantern glow, shoji paper
    oColor=vec4(c,1.);}`;
  const SVS=`#version 300 es
  layout(location=0) in uvec4 a;uniform mat4 uLight;uniform mat4 uModel;uniform float uCell;
  void main(){gl_Position=uLight*uModel*vec4(vec3(a.xyz)*uCell,1.);}`;
  const SFS=`#version 300 es
  precision mediump float;out vec4 o;void main(){o=vec4(1);}`;
  const PVS=`#version 300 es
  out vec2 vUv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=p;gl_Position=vec4(p*2.-1.,0,1);}`;
  const PFS=`#version 300 es
  precision highp float;in vec2 vUv;uniform sampler2D uColor;uniform sampler2D uDepth;uniform vec2 uPx;uniform vec2 uNF;uniform float uLine;out vec4 o;
  float lin(float d){float z=d*2.-1.;return 2.*uNF.x*uNF.y/(uNF.y+uNF.x-z*(uNF.y-uNF.x));}
  // Greedy-meshed quads meet at T-junctions, which can leave single-pixel cracks showing whatever lies behind. A pixel
  // much farther than both neighbours on one axis is a crack: it takes their colour and depth before outlining.
  void main(){float d0=texture(uDepth,vUv).r;vec3 sky=mix(vec3(.98,.86,.74),vec3(.56,.74,.93),smoothstep(.0,1.,vUv.y));
    vec3 c=texture(uColor,vUv).rgb;float z=d0>=1.?1e4:lin(d0);
    for(int a=0;a<2;a++){vec2 off=(a==0?vec2(uPx.x,0):vec2(0,uPx.y));float da=texture(uDepth,vUv+off).r,db=texture(uDepth,vUv-off).r;
      if(da<1.&&db<1.){float za=lin(da),zb=lin(db),near=min(za,zb);if(z>max(za,zb)*1.02&&abs(za-zb)<near*.02){c=.5*(texture(uColor,vUv+off).rgb+texture(uColor,vUv-off).rgb);z=.5*(za+zb);d0=.5*(da+db);}}}
    if(d0>=1.){o=vec4(sky,1);return;}
    float e=0.;
    for(int i=0;i<4;i++){vec2 off=vec2(i==0?1.:i==1?-1.:0.,i==2?1.:i==3?-1.:0.)*uPx*uLine;float dz=texture(uDepth,vUv+off).r;float zz=dz>=1.?1e4:lin(dz);e=max(e,(zz-z)/z);}
    float ink=smoothstep(.035,.07,e);
    o=vec4(mix(c,c*.28+vec3(.04,.03,.06),ink),1);}`;

  function compile(gl,vs,fs){const p=gl.createProgram();for(const [t,s] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
  const M4={
    mul(a,b){const r=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];r[i*4+j]=s;}return r;},
    persp(fov,asp,n,f){const t=1/Math.tan(fov/2);return new Float32Array([t/asp,0,0,0,0,t,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0]);},
    ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);},
    look(e,c,u){const z=norm(sub(e,c)),x=norm(cross(u,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1]);}};
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};

  // WebGL clip planes are row 4 +/- rows 1..3 of the column-major VP.
  // Invalid/degenerate inputs fail open: culling must never hide real content.
  function frustumPlanes(matrix){
    if(!matrix||matrix.length!==16||!Array.from(matrix).every(Number.isFinite))return null;
    const planes=[];
    for(let axis=0;axis<3;axis++)for(const sign of [1,-1]){
      const p=[0,1,2,3].map(i=>matrix[i*4+3]+sign*matrix[i*4+axis]),length=Math.hypot(p[0],p[1],p[2]);
      if(!Number.isFinite(length)||length<1e-12)return null;planes.push(p.map(v=>v/length));
    }
    return planes.every(p=>p.every(Number.isFinite))?planes:null;
  }
  function intersectsFrustum(bounds,planes){
    if(!bounds||!planes||planes.length!==6)return true;
    const {lo,hi}=bounds;if(!lo||!hi||lo.length!==3||hi.length!==3||!lo.every(Number.isFinite)||!hi.every(Number.isFinite)||lo.some((v,i)=>v>hi[i]))return true;
    if(!planes.every(p=>p&&p.length===4&&p.every(Number.isFinite)&&Math.hypot(p[0],p[1],p[2])>1e-12))return true;
    // Normalized planes: retain edge touches plus float32 transform roundoff.
    const epsilon=1e-4+1e-6*Math.max(...lo.map(Math.abs),...hi.map(Math.abs));
    for(const p of planes)if(p[0]*(p[0]>=0?hi[0]:lo[0])+p[1]*(p[1]>=0?hi[1]:lo[1])+p[2]*(p[2]>=0?hi[2]:lo[2])+p[3]<-epsilon)return false;
    return true;
  }
  function cameraEye(s){if(s.walkEye)return s.walkEye;const {yaw,pitch,dist,target:t}=s;return [t[0]+Math.cos(pitch)*Math.sin(yaw)*dist,t[1]+Math.sin(pitch)*dist,t[2]-Math.cos(pitch)*Math.cos(yaw)*dist];}
  function cameraLook(s){return s.walkEye?s.walkEye.map((v,i)=>v+[Math.sin(s.yaw)*Math.cos(s.pitch),Math.sin(s.pitch),Math.cos(s.yaw)*Math.cos(s.pitch)][i]):s.target;}
  function cameraForward(s){const e=cameraEye(s),look=cameraLook(s),x=look[0]-e[0],z=look[2]-e[2],length=Math.hypot(x,z);return Number.isFinite(length)&&length>1e-12?[x/length,z/length]:undefined;}

  function createRenderer(canvas){
    const gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL2 is required');
    const prog=compile(gl,VS,FS),sprog=compile(gl,SVS,SFS),pprog=compile(gl,PVS,PFS),U=(p,n)=>gl.getUniformLocation(p,n);
    const SHADOW=2048,shadowTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTex);gl.texStorage2D(gl.TEXTURE_2D,1,gl.DEPTH_COMPONENT24,SHADOW,SHADOW);
    for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
    const shadowFb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTex,0);
    const palTex=gl.createTexture();let fb=null,colorTex=null,depthTex=null,fbW=0,fbH=0;
    const state={segments:[],dims:[1,1,1],cell:.0625,visible:0,yaw:-.75,pitch:.5,dist:22,target:[0,0,0],sun:norm([-.45,.8,-.4]),lightVP:null,quads:0,lastFrameMs:0,uploads:{meshCalls:0,rayCalls:0,meshCpuMs:0,rayCpuMs:0,lastCpuMs:0},gpuFrameMs:null};
    // Optional full-frame GPU elapsed time: never read an unavailable result or
    // wait/finish. A maximum of four queries lives across frames; disjoint data
    // is discarded. Upload metrics below are CPU wall time, including driver
    // stalls, NOT GPU upload elapsed time or a GPU memory/bandwidth ceiling.
    const timerExt=gl.getExtension('EXT_disjoint_timer_query_webgl2'),gpuQueries=[];state.gpuTimingSupported=!!timerExt;
    function pollGpuTimers(){if(!timerExt)return false;if(gl.getParameter(timerExt.GPU_DISJOINT_EXT)){for(const q of gpuQueries)gl.deleteQuery(q);gpuQueries.length=0;state.gpuFrameMs=null;return false;}
      while(gpuQueries.length&&gl.getQueryParameter(gpuQueries[0],gl.QUERY_RESULT_AVAILABLE)){const q=gpuQueries.shift(),ms=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;state.gpuFrameMs=Number.isFinite(ms)?ms:null;gl.deleteQuery(q);}return true;}
    function resetTelemetry(){for(const q of gpuQueries)gl.deleteQuery(q);gpuQueries.length=0;state.gpuFrameMs=null;state.uploads={meshCalls:0,rayCalls:0,meshCpuMs:0,rayCpuMs:0,lastCpuMs:0};}
    function recordUpload(kind,started){const ms=performance.now()-started;state.uploads[kind+'Calls']++;state.uploads[kind+'CpuMs']+=ms;state.uploads.lastCpuMs=ms;}
    let ray=null;if(root.CityRay)try{ray=root.CityRay.create(gl,compile,{frustumPlanes,intersectsFrustum});}catch(e){state.rayError=e.message;}
    const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    function upload(m){const started=performance.now(),s={vao:null,vb:null,ib:null,nb:null};try{
      s.vao=gl.createVertexArray();s.vb=gl.createBuffer();s.ib=gl.createBuffer();if(!s.vao||!s.vb||!s.ib)throw new Error('Mesh buffer allocation failed');gl.bindVertexArray(s.vao);gl.bindBuffer(gl.ARRAY_BUFFER,s.vb);gl.bufferData(gl.ARRAY_BUFFER,m.verts,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribIPointer(0,4,gl.UNSIGNED_SHORT,8,0);
      if(m.normals){s.nb=gl.createBuffer();if(!s.nb)throw new Error('Mesh normal allocation failed');gl.bindBuffer(gl.ARRAY_BUFFER,s.nb);gl.bufferData(gl.ARRAY_BUFFER,m.normals,gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);}gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,s.ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.idx,gl.STATIC_DRAW);gl.bindVertexArray(null);const code=gl.getError?.()||0;if(code)throw new Error('Mesh upload GL error '+code);
      return {...s,soft:!!m.normals,count:m.idx.length,quads:m.quads,bytes:m.verts.byteLength+m.idx.byteLength+(m.normals?.byteLength||0),model:m.model||identity,id:m.id};
    }catch(e){gl.bindVertexArray(null);release(s);throw e;}finally{recordUpload('mesh',started);}}
    function release(s){gl.deleteVertexArray(s.vao);gl.deleteBuffer(s.vb);gl.deleteBuffer(s.ib);if(s.nb)gl.deleteBuffer(s.nb);}
    function sceneBounds(extent,palette){state.cell=.0625;state.extent=extent*3;state.target=[0,0,0];state.dist=extent*2.5;state.glow=0;state.paper=0;
      gl.bindTexture(gl.TEXTURE_2D,palTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,palette);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      const r=extent*1.5,c=[0,0,0],e=state.sun.map(v=>v*extent*2);state.lightVP=M4.mul(M4.ortho(-r,r,-r,r,1,extent*6),M4.look(e,c,[0,1,0]));state.shadowDirty=true;}
    function setScene(meshes,extent,palette){resetTelemetry();ray?.clear();state.segments.forEach(release);state.segments=meshes.map(upload);sceneBounds(extent,palette);state.visible=state.segments.length;}
    function putMesh(m){const i=state.segments.findIndex(s=>s.id===m.id),s=upload(m);ray?.drop(m.id);if(i>=0){release(state.segments[i]);state.segments[i]=s;}else state.segments.push(s);state.visible=state.segments.length;state.shadowDirty=true;}
    function dropMesh(id){ray?.drop(id);const i=state.segments.findIndex(s=>s.id===id);if(i>=0){release(state.segments[i]);state.segments.splice(i,1);state.visible=state.segments.length;}state.shadowDirty=true;}
    function putRay(id,v){if(!ray)throw new Error('Sparse ray backend unavailable');const started=performance.now();try{ray.put(id,v);const i=state.segments.findIndex(s=>s.id===id);if(i>=0){release(state.segments[i]);state.segments.splice(i,1);state.visible=state.segments.length;}state.shadowDirty=true;}finally{recordUpload('ray',started);}}
    function setVisible(id,visible){const s=state.segments.find(s=>s.id===id);if(s)s.enabled=visible;ray?.setVisible(id,visible);state.shadowDirty=true;}
    function ensureFb(w,h){if(fb&&w===fbW&&h===fbH)return;fbW=w;fbH=h;for(const t of [colorTex,depthTex])if(t)gl.deleteTexture(t);if(fb)gl.deleteFramebuffer(fb);
      colorTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,colorTex);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,w,h);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      depthTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,depthTex);gl.texStorage2D(gl.TEXTURE_2D,1,gl.DEPTH_COMPONENT24,w,h);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,colorTex,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depthTex,0);}
    function setBuilding(b){
      resetTelemetry();
      for(const s of state.segments){gl.deleteVertexArray(s.vao);gl.deleteBuffer(s.vb);gl.deleteBuffer(s.ib);}
      const t0=performance.now(),cuts=[0,...b.levels.slice(1,-1).map(y=>y-3),b.plate-3,b.dims[1]],ownership=new Map();for(const bracket of b.info.brackets||[])for(const i of bracket.voxels)ownership.set(i,bracket.floor);state.segments=[];state.quads=0;
      for(let k=0;k<cuts.length-1;k++){const m=meshSegment(b.vol,b.dims,cuts[k],cuts[k+1],ownership,k),started=performance.now(),vao=gl.createVertexArray(),vb=gl.createBuffer(),ib=gl.createBuffer();gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,m.verts,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribIPointer(0,4,gl.UNSIGNED_SHORT,8,0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.idx,gl.STATIC_DRAW);gl.bindVertexArray(null);recordUpload('mesh',started);
        state.segments.push({vao,vb,ib,count:m.idx.length,quads:m.quads,label:k<b.levels.length-1?`floor ${k}`:'roof'});state.quads+=m.quads;}
      state.meshMs=performance.now()-t0;state.glow=b.M.lantern_glow;state.paper=b.M.shoji;state.dims=b.dims;state.cell=b.cell;state.visible=state.segments.length;
      gl.bindTexture(gl.TEXTURE_2D,palTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,b.palette);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      const [X,Y,Z]=b.dims.map(v=>v*b.cell);state.target=[X/2,b.levels[1]*b.cell*.9,Z/2];state.extent=Math.hypot(X,Y,Z);
      const c=[X/2,Y/2,Z/2],e=[c[0]+state.sun[0]*40,c[1]+state.sun[1]*40,c[2]+state.sun[2]*40],r=state.extent*.6;
      state.lightVP=M4.mul(M4.ortho(-r,r,-r,r,1,80+state.extent),M4.look(e,c,[0,1,0]));state.shadowDirty=true;
      return {meshMs:state.meshMs,quads:state.quads,segments:state.segments.map(s=>({label:s.label,quads:s.quads}))};}
    function eye(){return cameraEye(state);}
    function draw(){const t0=performance.now(),dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}ensureFb(w,h);
      const canTime=pollGpuTimers(),gpuQuery=canTime&&gpuQueries.length<4?gl.createQuery():null;if(gpuQuery)gl.beginQuery(timerExt.TIME_ELAPSED_EXT,gpuQuery);
      const segs=state.segments.slice(0,state.visible).filter(s=>s.enabled!==false);gl.enable(gl.DEPTH_TEST);state.shadowDrawCalls=0;state.shadowRayDraws=0;state.shadowTriangles=0;state.shadowCached=true;
      // Shadow pass (re-rendered when the visible floors change, so a cutaway lets the sun in).
      if(state.shadowDirty||state.shadowVisible!==state.visible){gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFb);gl.viewport(0,0,SHADOW,SHADOW);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(sprog);
        gl.uniformMatrix4fv(U(sprog,'uLight'),false,state.lightVP);gl.uniform1f(U(sprog,'uCell'),state.cell);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2,4);
        for(const s of segs){gl.uniformMatrix4fv(U(sprog,'uModel'),false,s.model||identity);gl.bindVertexArray(s.vao);gl.drawElements(gl.TRIANGLES,s.count,gl.UNSIGNED_INT,0);}gl.disable(gl.POLYGON_OFFSET_FILL);state.shadowRayDraws=ray?.draw(state.lightVP,state.sun,null)||0;state.shadowDrawCalls=segs.length+state.shadowRayDraws;state.shadowTriangles=segs.reduce((n,s)=>n+s.count/3,0)+state.shadowRayDraws*12;state.shadowCached=false;state.shadowDirty=false;state.shadowVisible=state.visible;}
      const near=state.walkEye?.04:.1,far=state.extent*4+state.dist,look=cameraLook(state),
        vp=M4.mul(M4.persp(state.walkEye?70*Math.PI/180:.62,w/h,near,far),M4.look(eye(),look,[0,1,0]));
      gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(prog);
      gl.uniformMatrix4fv(U(prog,'uVP'),false,vp);gl.uniformMatrix4fv(U(prog,'uLight'),false,state.lightVP);gl.uniform1f(U(prog,'uCell'),state.cell);gl.uniform3fv(U(prog,'uSun'),state.sun);gl.uniform1f(U(prog,'uTexel'),1/SHADOW);gl.uniform1ui(U(prog,'uGlow'),state.glow||0);gl.uniform1ui(U(prog,'uPaper'),state.paper||0);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,palTex);gl.uniform1i(U(prog,'uPal'),0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,shadowTex);gl.uniform1i(U(prog,'uShadow'),1);
      for(const s of segs){gl.uniformMatrix4fv(U(prog,'uModel'),false,s.model||identity);gl.uniform1i(U(prog,'uSoft'),s.soft?1:0);gl.bindVertexArray(s.vao);gl.drawElements(gl.TRIANGLES,s.count,gl.UNSIGNED_INT,0);}
      const rayDraws=ray?.draw(vp,state.sun,eye(),state.lightVP,shadowTex,1/SHADOW)||0;
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.disable(gl.DEPTH_TEST);gl.useProgram(pprog);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,colorTex);gl.uniform1i(U(pprog,'uColor'),0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,depthTex);gl.uniform1i(U(pprog,'uDepth'),1);
      gl.uniform2f(U(pprog,'uPx'),1/w,1/h);gl.uniform2f(U(pprog,'uNF'),near,far);gl.uniform1f(U(pprog,'uLine'),Math.max(1,dpr*.9));gl.bindVertexArray(null);gl.drawArrays(gl.TRIANGLES,0,3);
      if(gpuQuery){gl.endQuery(timerExt.TIME_ELAPSED_EXT);gpuQueries.push(gpuQuery);}
      state.lastFrameMs=performance.now()-t0;state.drawCalls=segs.length+1+rayDraws;state.mainDrawCalls=segs.length+rayDraws;state.totalDrawCalls=state.drawCalls+state.shadowDrawCalls;state.rayDraws=rayDraws;state.rayResidents=ray?.count()||0;state.rayEnabled=ray?.enabledCount()||0;state.triangles=segs.reduce((n,s)=>n+s.count/3,0);/* Legacy triangles is mesh-only; new totals include submitted ray boxes and post triangle. */state.mainTriangles=state.triangles+rayDraws*12;state.totalTriangles=state.mainTriangles+state.shadowTriangles+1;state.meshGpuBytes=state.segments.reduce((n,s)=>n+(s.bytes||0),0);state.sparseGpuBytes=ray?.bytes()||0;state.gpuBytes=state.meshGpuBytes+state.sparseGpuBytes;}
    return {gl,state,setBuilding,setScene,putMesh,putRay,dropMesh,setVisible,draw,eye,forward:()=>cameraForward(state),rayAvailable:!!ray,rayBytes:()=>ray?.bytes()||0};
  }

  const api={meshSegment,createRenderer,NORMALS,frustumPlanes,intersectsFrustum,cameraForward};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.BuildingRenderer=api;
})(typeof globalThis==='object'?globalThis:this);
