(function(root){
  'use strict';
  const M=root.MicroWorld,ANGLE=50*Math.PI/180,S=Math.sin(ANGLE),C=Math.cos(ANGLE),YAW=35*Math.PI/180,SY=Math.sin(YAW),CY=Math.cos(YAW);
  const vertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec3 position;
  layout(location=1) in float face;
  layout(location=2) in float material;
  uniform vec3 origin, scale, localOffset, center, patternOrigin;
  uniform vec2 halfView;
  uniform float yaw, pitch, overrideMaterial;
  out vec3 worldPosition;
  out vec3 normal;
  flat out int mat;
  void main(){
    vec3 p=(position+localOffset)*scale;
    p=vec3(p.x,p.y*cos(pitch)-p.z*sin(pitch),p.y*sin(pitch)+p.z*cos(pitch));
    p=vec3(p.x*cos(yaw)+p.z*sin(yaw),p.y,-p.x*sin(yaw)+p.z*cos(yaw));
    worldPosition=p+patternOrigin;p+=origin;
    vec3 n=face<.5?vec3(-1,0,0):face<1.5?vec3(1,0,0):face<2.5?vec3(0,-1,0):face<3.5?vec3(0,1,0):face<4.5?vec3(0,0,-1):vec3(0,0,1);
    n=vec3(n.x,n.y*cos(pitch)-n.z*sin(pitch),n.y*sin(pitch)+n.z*cos(pitch));
    normal=vec3(n.x*cos(yaw)+n.z*sin(yaw),n.y,-n.x*sin(yaw)+n.z*cos(yaw));
    mat=int(overrideMaterial>0.?overrideMaterial:material);
    vec3 q=p-center;
    float forward=q.x*${SY}+q.z*${CY};
    gl_Position=vec4((q.x*${CY}-q.z*${SY})/halfView.x,(q.y*${C}-forward*${S})/halfView.y,-(q.y*${S}+forward*${C})/200.,1.);
  }`;
  const fragment=`#version 300 es
  precision highp float;
  in vec3 worldPosition;
  in vec3 normal;
  flat in int mat;
  uniform vec3 palette[24];
  uniform float time, detail;
  out vec4 color;
  float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  void main(){
    float light=.58+.42*max(0.,dot(normalize(normal),normalize(vec3(-.5,1.,.4))));
    float grain=(hash(floor(worldPosition*4.+normal*.01))-.5)*.07*detail;
    vec3 base=palette[mat];
    if(mat==7){float ripple=sin(worldPosition.z*3.+worldPosition.x*1.7-time*1.4);base+=vec3(.025,.04,.04)*ripple;}
    if(mat==1&&normal.y<.5)base+=vec3(.045)*step(.85,fract(worldPosition.y*.7));
    if(mat==6)base+=vec3(.012,.025,.005)*sin(worldPosition.y*1.6);
    float heightShade=.88+.12*clamp(worldPosition.y/15.,0.,1.);
    color=vec4(base*(light+grain)*heightShade,1.);
  }`;
  function compile(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const e=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(e);}return s;}
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
      this.program=gl.createProgram();const vs=compile(gl,gl.VERTEX_SHADER,vertex),fs=compile(gl,gl.FRAGMENT_SHADER,fragment);
      gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
      gl.useProgram(this.program);this.u={};for(const n of ['origin','scale','localOffset','center','patternOrigin','halfView','yaw','pitch','overrideMaterial','palette','time','detail'])this.u[n]=gl.getUniformLocation(this.program,n);
      const colors=[...M.COLORS];
      gl.uniform3fv(this.u.palette,colors.flatMap(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255)));
      this.cube=this.upload(makeCube());this.draws=0;this.triangles=0;this.pixelRatio=1;this.lost=false;
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(.77,.81,.76,1);
    }
    upload(mesh){const gl=this.gl,vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.buffer,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.UNSIGNED_SHORT,false,8,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.UNSIGNED_BYTE,false,8,6);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.UNSIGNED_BYTE,false,8,7);return {vao,buffer,count:mesh.count,bytes:mesh.buffer.byteLength};}
    dispose(mesh){this.gl.deleteBuffer(mesh.buffer);this.gl.deleteVertexArray(mesh.vao);}
    resize(economy){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.pixelRatio=Math.min(devicePixelRatio||1,economy?1:1.5);const w=Math.max(1,Math.round(r.width*this.pixelRatio)),h=Math.max(1,Math.round(r.height*this.pixelRatio));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.aspect=w/h;}
    begin(camera,time,economy){const gl=this.gl;this.resize(economy);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniform3f(this.u.center,camera.x,8,camera.z);gl.uniform2f(this.u.halfView,camera.span/2,camera.span/2/this.aspect);gl.uniform1f(this.u.time,time);gl.uniform1f(this.u.detail,economy?.5:1);this.draws=0;this.triangles=0;}
    draw(mesh,origin,scale=[M.CELL,M.CELL,M.CELL],material=0,yaw=0,pitch=0,offset=[0,0,0],patternOrigin=origin){const gl=this.gl;gl.uniform3fv(this.u.origin,origin);gl.uniform3fv(this.u.patternOrigin,patternOrigin);gl.uniform3fv(this.u.scale,scale);gl.uniform3fv(this.u.localOffset,offset);gl.uniform1f(this.u.overrideMaterial,material);gl.uniform1f(this.u.yaw,yaw);gl.uniform1f(this.u.pitch,pitch);gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,0,mesh.count);this.draws++;this.triangles+=mesh.count/3;}
    actor(a,time,reduced){
      const walk=reduced?0:Math.sin(time*7+a.phase)*.5,y=a.y;
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
    }
    project(camera,x,y,z){const halfY=camera.span/2/this.aspect,dx=x-camera.x,dz=z-camera.z;return {x:this.width*(.5+(dx*CY-dz*SY)/camera.span),y:this.height*(.5-((y-8)*C-(dx*SY+dz*CY)*S)/(2*halfY))};}
    screenDirection(right,down){return {x:right*CY+down*SY,z:-right*SY+down*CY};}
    pan(camera,dx,dy){const horizontal=-dx*camera.span/this.width,forward=-dy*camera.span/(this.width*S);camera.x+=horizontal*CY+forward*SY;camera.z+=-horizontal*SY+forward*CY;}
    bounds(camera,height){
      const points=[];
      for(const y of [0,height])for(const h of [-camera.span/2,camera.span/2])for(const v of [-camera.span/2/this.aspect,camera.span/2/this.aspect]){const f=((y-8)*C-v)/S;points.push({x:camera.x+h*CY+f*SY,z:camera.z-h*SY+f*CY});}
      return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
    }
    pick(camera,clientX,clientY,world){
      const r=this.canvas.getBoundingClientRect(),horizontal=(clientX-r.left-r.width/2)/r.width*camera.span,vertical=(.5-(clientY-r.top)/r.height)*camera.span/this.aspect;
      // March from the camera-facing end, so a cliff cannot select hidden ground behind itself.
      for(let y=world.heightMetres;y>=0;y-=.0625){const forward=((y-8)*C-vertical)/S,x=camera.x+horizontal*CY+forward*SY,z=camera.z-horizontal*SY+forward*CY,ground=world.ground(x,z);if(ground!==null&&y<=ground)return {x,z,y:ground};}
      return {x:-1,y:0,z:-1};
    }
  }
  root.MicroRenderer=Renderer;
})(globalThis);
