(function(root){
  'use strict';
  // Port of CastleRender's sparse coarse/fine DDA and texture contract, sharing the city mesh depth/shadow targets.
  const VS=`#version 300 es
  layout(location=0) in vec3 P;uniform mat4 M;uniform vec4 FRM;uniform vec3 ORG,DIM;out vec3 vLoc;
  void main(){vLoc=ORG+P*DIM;vec3 w=vec3(FRM.x+vLoc.x*FRM.z-vLoc.z*FRM.w,vLoc.y,FRM.y+vLoc.x*FRM.w+vLoc.z*FRM.z);gl_Position=M*vec4(w,1.);}`;
  const MARCH=`
  uniform highp usampler3D CO;uniform highp usampler2D BR;uniform vec4 FRM;uniform vec3 ORG;uniform float CS;uniform ivec3 NC;
  vec3 toLocal(vec3 w){vec3 d=w-vec3(FRM.x,0.,FRM.y);return vec3(d.x*FRM.z+d.z*FRM.w,w.y,-d.x*FRM.w+d.z*FRM.z);}
  vec3 dirLocal(vec3 d){return vec3(d.x*FRM.z+d.z*FRM.w,d.y,-d.x*FRM.w+d.z*FRM.z);}
  vec3 toWorld(vec3 l){return vec3(FRM.x+l.x*FRM.z-l.z*FRM.w,l.y,FRM.y+l.x*FRM.w+l.z*FRM.z);}
  vec3 nWorld(vec3 n){return vec3(n.x*FRM.z-n.z*FRM.w,n.y,n.x*FRM.w+n.z*FRM.z);}
  uint fine(uint b,ivec3 f){return texelFetch(BR,ivec2(int(b%64u)*16+f.z*4+f.x,int(b/64u)*4+f.y),0).r;}
  uint march(vec3 ro,vec3 rd,bool coarseOnly,out vec3 hp,out vec3 hn){
    rd=sign(rd+vec3(1e-12))*max(abs(rd),vec3(1e-7));
    vec3 g0=(ro-ORG)/CS,N=vec3(NC);rd=rd/CS;vec3 inv=1./rd,t0=-g0*inv,t1=(N-g0)*inv,tmn=min(t0,t1),tmx=max(t0,t1);
    float ta=max(max(tmn.x,tmn.y),max(tmn.z,0.)),tb=min(min(tmx.x,tmx.y),tmx.z);if(ta>=tb)return 0u;
    vec3 p=g0+rd*(ta+1e-4);ivec3 c=clamp(ivec3(floor(p)),ivec3(0),NC-1);vec3 st=sign(rd),tD=abs(inv),tM=((vec3(c)+max(st,0.))-g0)*inv;
    vec3 nrm=ta>0.?-st*step(tmn.yzx,tmn)*step(tmn.zxy,tmn):vec3(0,1,0);float t=ta;
    for(int i=0;i<640;i++){uint v=texelFetch(CO,c,0).r;
      if(v>0u){if(v<256u||coarseOnly){hp=ORG+(g0+rd*t)*CS;hn=nrm;return v<256u?v:255u;}
        uint b=v-256u;vec3 q=(g0+rd*(t+1e-4)-vec3(c))*4.;ivec3 f=clamp(ivec3(floor(q)),ivec3(0),ivec3(3));vec3 fM=((vec3(f)+max(st,0.))-q)*inv,fD=tD;float ft=0.;vec3 fn=nrm;
        for(int k=0;k<12;k++){uint e=fine(b,f);if(e>0u){float tt=t+ft/4.;hp=ORG+(g0+rd*tt)*CS;hn=fn;return e;}
          if(fM.x<fM.y&&fM.x<fM.z){ft=fM.x;fM.x+=fD.x;f.x+=int(st.x);fn=vec3(-st.x,0,0);}else if(fM.y<fM.z){ft=fM.y;fM.y+=fD.y;f.y+=int(st.y);fn=vec3(0,-st.y,0);}else{ft=fM.z;fM.z+=fD.z;f.z+=int(st.z);fn=vec3(0,0,-st.z);}
          if(any(lessThan(f,ivec3(0)))||any(greaterThan(f,ivec3(3))))break;}}
      if(tM.x<tM.y&&tM.x<tM.z){t=tM.x;tM.x+=tD.x;c.x+=int(st.x);nrm=vec3(-st.x,0,0);}else if(tM.y<tM.z){t=tM.y;tM.y+=tD.y;c.y+=int(st.y);nrm=vec3(0,-st.y,0);}else{t=tM.z;tM.z+=tD.z;c.z+=int(st.z);nrm=vec3(0,0,-st.z);}
      if(any(lessThan(c,ivec3(0)))||any(greaterThanEqual(c,NC)))break;
    }return 0u;
  }`;
  const FS=`#version 300 es
  precision highp float;precision highp usampler3D;precision highp usampler2D;precision highp sampler2DShadow;
  in vec3 vLoc;uniform vec3 EYE,SUN;uniform mat4 M,LVP;uniform sampler2D PAL;uniform sampler2DShadow SH;uniform float TEXEL;out vec4 o;
  ${MARCH}
  void main(){vec3 ro=toLocal(EYE),rd=normalize(vLoc-ro),hp,hn;uint e=march(ro,rd,false,hp,hn);if(e==0u)discard;
    vec3 p=toWorld(hp),n=normalize(nWorld(hn));vec4 pe=texelFetch(PAL,ivec2(int(e)-1,0),0),lp=LVP*vec4(p+n*CS*.375,1.);vec3 l=lp.xyz/lp.w*.5+.5;float sh=0.;
    for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)sh+=texture(SH,vec3(l.xy+vec2(i,j)*TEXEL,l.z-.0006));sh/=9.;if(l.x<0.||l.x>1.||l.y<0.||l.y>1.)sh=1.;
    float lit=smoothstep(.0,.08,dot(n,SUN))*sh,face=n.y>.5?1.:n.y<-.5?.62:(abs(n.x)>.5?.86:.78);
    vec3 shade=pe.rgb*mix(vec3(.52,.56,.72),vec3(.68,.66,.70),.5+.5*n.y)*face,lightc=pe.rgb*vec3(1.05,1.,.93)*face,col=mix(shade,lightc,lit);
    int a=int(pe.a*255.+.5);if(a>=128)col=pe.rgb*1.15;else if(a==64)col=pe.rgb*(.95+.25*lit);
    vec4 cp=M*vec4(p,1.);gl_FragDepth=cp.z/cp.w*.5+.5;o=vec4(col,1.);
  }`;
  const SFS=`#version 300 es
  precision highp float;precision highp usampler3D;precision highp usampler2D;in vec3 vLoc;uniform vec3 SUN;uniform mat4 M;out vec4 o;
  ${MARCH}
  void main(){vec3 rd=dirLocal(-SUN),hp,hn;uint e=march(vLoc-rd*4000.,rd,true,hp,hn);if(e==0u)discard;vec4 cp=M*vec4(toWorld(hp),1.);gl_FragDepth=cp.z/cp.w*.5+.5;o=vec4(1.);}`;
  function worldBounds(v){
    if(!v||!v.o||!v.n||v.o.length!==3||v.n.length!==3||!v.o.every(Number.isFinite)||!v.n.every(n=>Number.isFinite(n)&&n>0)||!Number.isFinite(v.cvs)||v.cvs<=0||!v.frame||![v.frame.x,v.frame.z,v.frame.rot].every(Number.isFinite))return null;
    // Use the full padded, cropped coarse box used by VS, not the parcel or
    // uncropped voxel lo/hi. This includes eaves, windows and upper overhangs.
    const c=Math.cos(v.frame.rot),s=Math.sin(v.frame.rot),end=v.o.map((o,i)=>o+v.n[i]*v.cvs),lo=[Infinity,v.o[1],Infinity],hi=[-Infinity,end[1],-Infinity];
    for(const x of [v.o[0],end[0]])for(const z of [v.o[2],end[2]]){const wx=v.frame.x+x*c-z*s,wz=v.frame.z+x*s+z*c;lo[0]=Math.min(lo[0],wx);hi[0]=Math.max(hi[0],wx);lo[2]=Math.min(lo[2],wz);hi[2]=Math.max(hi[2],wz);}
    return [...lo,...hi].every(Number.isFinite)?{lo,hi}:null;
  }
  function create(gl,compile,culling={}){
    const main=compile(gl,VS,FS),shadow=compile(gl,VS,SFS),rays=new Map(),vao=gl.createVertexArray(),vb=gl.createBuffer(),V=[],Q=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],F=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]];
    const max3D=gl.getParameter(gl.MAX_3D_TEXTURE_SIZE),max2D=gl.getParameter(gl.MAX_TEXTURE_SIZE),uniforms=new Map();
    for(const p of [main,shadow])uniforms.set(p,new Map(['M','SUN','CO','BR','EYE','LVP','PAL','SH','TEXEL','FRM','ORG','DIM','CS','NC'].map(n=>[n,gl.getUniformLocation(p,n)])));
    for(const f of F)for(const k of [0,1,2,0,2,3])V.push(...Q[f[k]]);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(V),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);gl.bindVertexArray(null);
    function drop(id){const g=rays.get(id);if(!g)return;[g.co,g.br,g.pal].forEach(t=>gl.deleteTexture(t));rays.delete(id);}
    function put(id,v){
      if(v.n.some(n=>n>max3D)||v.brickRows>max2D)throw new Error('Sparse model exceeds GPU texture limits');
      gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);const created=[];
      const tex=(target,load)=>{const t=gl.createTexture();if(!t)throw new Error('Sparse texture allocation failed');created.push(t);gl.bindTexture(target,t);load();for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(target,k,gl.NEAREST);for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(target,k,gl.CLAMP_TO_EDGE);return t;};
      try{
        const co=tex(gl.TEXTURE_3D,()=>gl.texImage3D(gl.TEXTURE_3D,0,gl.R16UI,...v.n,0,gl.RED_INTEGER,gl.UNSIGNED_SHORT,v.coarse)),br=tex(gl.TEXTURE_2D,()=>gl.texImage2D(gl.TEXTURE_2D,0,gl.R8UI,1024,v.brickRows,0,gl.RED_INTEGER,gl.UNSIGNED_BYTE,v.bricks)),pal=tex(gl.TEXTURE_2D,()=>gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,v.pal));
        const code=gl.getError?.()||0;if(code)throw new Error('Sparse texture upload GL error '+code);
        const next={co,br,pal,n:v.n.slice(),o:v.o.slice(),cvs:v.cvs,frame:{...v.frame},dim:v.n.map(n=>n*v.cvs),cos:Math.cos(v.frame.rot),sin:Math.sin(v.frame.rot),bounds:worldBounds(v),bytes:v.bytes};
        // Failed uploads never erase a visible model; free partial textures.
        drop(id);rays.set(id,next);
      }catch(e){created.forEach(t=>gl.deleteTexture(t));throw e;}
    }
    function draw(matrix,sun,eye,light,shadowTex,texel){
      if(!rays.size)return 0;const planes=culling.frustumPlanes?.(matrix),prog=eye?main:shadow,U=n=>uniforms.get(prog).get(n);gl.useProgram(prog);gl.bindVertexArray(vao);gl.enable(gl.CULL_FACE);gl.cullFace(gl.FRONT);gl.uniformMatrix4fv(U('M'),false,matrix);gl.uniform3fv(U('SUN'),sun);gl.uniform1i(U('CO'),5);gl.uniform1i(U('BR'),6);
      if(eye){gl.uniform3fv(U('EYE'),eye);gl.uniformMatrix4fv(U('LVP'),false,light);gl.uniform1i(U('PAL'),7);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,shadowTex);gl.uniform1i(U('SH'),1);gl.uniform1f(U('TEXEL'),texel);}
      let count=0;for(const g of rays.values()){if(g.enabled===false||culling.intersectsFrustum?.(g.bounds,planes)===false)continue;gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_3D,g.co);gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,g.br);gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,g.pal);const f=g.frame;gl.uniform4f(U('FRM'),f.x,f.z,g.cos,g.sin);gl.uniform3fv(U('ORG'),g.o);gl.uniform3fv(U('DIM'),g.dim);gl.uniform1f(U('CS'),g.cvs);gl.uniform3i(U('NC'),...g.n);gl.drawArrays(gl.TRIANGLES,0,36);count++;}
      gl.cullFace(gl.BACK);gl.disable(gl.CULL_FACE);gl.activeTexture(gl.TEXTURE0);return count;
    }
    return {put,drop,draw,setVisible:(id,visible)=>{const g=rays.get(id);if(g)g.enabled=visible;},clear:()=>{for(const id of rays.keys())drop(id);},bytes:()=>[...rays.values()].reduce((n,g)=>n+g.bytes,0),count:()=>rays.size,enabledCount:()=>[...rays.values()].filter(g=>g.enabled!==false).length};
  }
  const api={create,worldBounds};if(typeof module==='object'&&module.exports)module.exports=api;else root.CityRay=api;
})(typeof globalThis==='object'?globalThis:this);
