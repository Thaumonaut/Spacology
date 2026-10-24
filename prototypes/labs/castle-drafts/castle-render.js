// Castle drafts renderer: turns CastleGen parts into one triangle mesh and draws it in WebGL2 with a soft anime cel
// look (warm sunlit side, cool blue shadow side, sun shadows, painted sky and water). Built for fast design iteration,
// not for the world renderer: everything is rebuilt from scratch on each change.
(function(){
  'use strict';
  const TAU=Math.PI*2;
  // ---- Mesh building: positions, normals, colours and a material flag (1 = water) per vertex.
  function Mesh(){this.p=[];this.n=[];this.c=[];this.f=[];this.t=[];this.k=[];this.id=[];this.pid=-1;this.solid=1;this.pat=0;this.glow=0;}
  Mesh.prototype.tri=function(a,b,c,col,na,nb,nc,flag=0){
    if(!na){const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const l=Math.hypot(...n)||1;n=n.map(x=>x/l);na=nb=nc=n;}
    const fl=flag||(this.glow?2:0);for(const [p,n] of [[a,na],[b,nb],[c,nc]]){this.p.push(...p);this.n.push(...n);this.c.push(...col);this.f.push(fl);this.t.push(this.pat);}this.k.push(flag?0:this.solid);this.id.push(this.pid);
  };
  Mesh.prototype.quad=function(a,b,c,d,col,ns){if(ns){this.tri(a,b,c,col,ns[0],ns[1],ns[2]);this.tri(a,c,d,col,ns[0],ns[2],ns[3]);}else{this.tri(a,b,c,col);this.tri(a,c,d,col);}};
  const shade=(c,k)=>c.map(v=>Math.min(1,v*k));
  // Small deterministic jitter so neighbouring parts of one material differ a touch (painted, not flat).
  const jit=(c,s)=>{const h=Math.sin(s*12.9898)*43758.5453,f=h-Math.floor(h);return shade(c,.94+.12*f);};
  function colours(pal){return {stone:pal.stone,stone2:pal.stone2,trim:shade(pal.stone,.92),roof:pal.roof,roof2:pal.roof2,rock:[.66,.63,.6],green:[.38,.62,.3],grass:[.47,.7,.34],sand:[.9,.84,.68],
    wood:[.56,.4,.27],dark:[.3,.27,.27],cloth:[.72,.32,.3],paving:[.8,.76,.68],plaster:[.95,.92,.86],gold:[.92,.74,.32],water:[.3,.6,.7]};}
  function box(m,o,col){
    const {x,y,z,w,h,d,rot=0}=o,c=Math.cos(rot),s=Math.sin(rot),P=(u,v,wv)=>[x+u*c-wv*s,y+v,z+u*s+wv*c];
    const u=w/2,q=d/2,v0=0,v1=h,C=[P(-u,v0,-q),P(u,v0,-q),P(u,v0,q),P(-u,v0,q),P(-u,v1,-q),P(u,v1,-q),P(u,v1,q),P(-u,v1,q)];
    m.quad(C[4],C[7],C[6],C[5],col);m.quad(C[0],C[1],C[5],C[4],col);m.quad(C[1],C[2],C[6],C[5],col);m.quad(C[2],C[3],C[7],C[6],col);m.quad(C[3],C[0],C[4],C[7],col);
  }
  // Battlements: a low parapet with merlons along both edges of the wall top, leaving the walkway between them clear.
  function crenels(m,o,col){const {x,y,z,w,h,d,rot=0}=o,c=Math.cos(rot),s=Math.sin(rot),step=2.6,n=Math.floor(w/step),pw=Math.min(.8,d*.2);
    for(const e of [-1,1]){const ox=-s*e*(d/2-pw/2),oz=c*e*(d/2-pw/2);box(m,{x:x+ox,y:y+h,z:z+oz,w,h:1.1,d:pw,rot},col);
      for(let i=0;i<n;i+=2){const u=-w/2+(i+.5)*step+(w-n*step)/2;box(m,{x:x+u*c+ox,y:y+h+1.1,z:z+u*s+oz,w:step*.9,h:1.2,d:pw,rot},col);}}}
  function cyl(m,o,col,seg){const {x,y,z,r,h,r2=r}=o;seg=seg||Math.max(12,Math.min(36,Math.round(r*2.4)));const sl=(r-r2)/h;
    for(let i=0;i<seg;i++){const a0=i/seg*TAU,a1=(i+1)/seg*TAU,n0=[Math.cos(a0),sl,Math.sin(a0)],n1=[Math.cos(a1),sl,Math.sin(a1)];
      const A=[x+Math.cos(a0)*r,y,z+Math.sin(a0)*r],B=[x+Math.cos(a1)*r,y,z+Math.sin(a1)*r],C=[x+Math.cos(a1)*r2,y+h,z+Math.sin(a1)*r2],D=[x+Math.cos(a0)*r2,y+h,z+Math.sin(a0)*r2];
      m.quad(A,D,C,B,col,[n0,n0,n1,n1]);m.tri([x,y+h,z],C,D,col,[0,1,0],[0,1,0],[0,1,0]);}}
  function cone(m,o,col){const {x,y,z,r,h,inv}=o,seg=Math.max(12,Math.min(36,Math.round(r*2.4))),ap=inv?[x,y,z]:[x,y+h,z],by=inv?y+h:y,sl=r/h;
    for(let i=0;i<seg;i++){const a0=i/seg*TAU,a1=(i+1)/seg*TAU,am=(a0+a1)/2,A=[x+Math.cos(a0)*r,by,z+Math.sin(a0)*r],B=[x+Math.cos(a1)*r,by,z+Math.sin(a1)*r];
      const nn=a=>{const v=[Math.cos(a),inv?-sl:sl,Math.sin(a)],l=Math.hypot(...v);return v.map(t=>t/l);};
      if(inv)m.tri(ap,A,B,col,nn(am),nn(a0),nn(a1));else m.tri(ap,B,A,col,nn(am),nn(a1),nn(a0));}}
  function dome(m,o,col){const {x,y,z,r}=o,la=8,lo=24,P=(i,j)=>{const t=i/la*Math.PI/2,a=j/lo*TAU;return [Math.cos(t)*Math.cos(a),Math.sin(t),Math.cos(t)*Math.sin(a)];};
    for(let i=0;i<la;i++)for(let j=0;j<lo;j++){const n=[P(i,j),P(i+1,j),P(i+1,j+1),P(i,j+1)],v=n.map(q=>[x+q[0]*r,y+q[1]*r,z+q[2]*r]);m.quad(v[0],v[1],v[2],v[3],col,n);}}
  // Hipped roof: the ridge stops short of both ends, which slope back to it (a pyramid when the plan is square).
  function hip(m,o,col){const {x,y,z,w,d,h,rot=0}=o,c=Math.cos(rot),s=Math.sin(rot),P=(u,v,wv)=>[x+u*c-wv*s,y+v,z+u*s+wv*c],u=w/2,q=d/2,rl=Math.max(0,u-q);
    const a=P(-u,0,-q),b=P(u,0,-q),cc=P(u,0,q),dd=P(-u,0,q),r0=P(-rl,h,0),r1=P(rl,h,0);
    m.quad(a,r0,r1,b,col);m.quad(cc,r1,r0,dd,col);m.tri(a,dd,r0,shade(col,.92));m.tri(b,r1,cc,shade(col,.92));}
  function gable(m,o,col){const {x,y,z,w,d,h,rot=0}=o,c=Math.cos(rot),s=Math.sin(rot),P=(u,v,wv)=>[x+u*c-wv*s,y+v,z+u*s+wv*c],u=w/2,q=d/2;
    const a=P(-u,0,-q),b=P(u,0,-q),cc=P(u,0,q),dd=P(-u,0,q),r0=P(-u,h,0),r1=P(u,h,0);
    m.quad(a,r0,r1,b,col);m.quad(cc,r1,r0,dd,col);m.tri(a,dd,r0,shade(col,.9));m.tri(b,r1,cc,shade(col,.9));}
  // A bridge bay: two piers, a round arch, and the deck band above (the spandrel as thin columns along the curve).
  function arch(m,o,col){const {x,y,z,w,h,d,rot,span}=o,c=Math.cos(rot),s=Math.sin(rot),pier=(w-span)/2,R=span/2,spring=Math.max(2,h-R-3);
    for(const sgn of [-1,1]){const u=sgn*(w/2-pier/2);box(m,{x:x+u*c,y,z:z+u*s,w:pier,h,d,rot},col);}
    const n=12;for(let i=0;i<n;i++){const u0=-R+i*span/n,u1=u0+span/n,um=(u0+u1)/2,ah=spring+Math.sqrt(Math.max(0,R*R-um*um));
      box(m,{x:x+um*c,y:y+ah,z:z+um*s,w:span/n+.02,h:h-ah,d,rot},col);}
    box(m,{x,y:y+h,z,w,h:1.4,d:d+.6,rot},shade(col,.95));}
  // The crag: rings from the water up the cliff, flared at the foot, streaked by vertical jags, meadow on top.
  function crag(m,o,cols){const {pts,top,base,flare,cx=0,cz=0}=o,N=pts.length,L=18,V=[];
    for(let l=0;l<=L;l++){const t=l/L,yy=base+(top-base)*t,row=[];
      for(let i=0;i<N;i++){const [a,d]=pts[i],jag=1+.05*Math.sin(a*37+1.3)*Math.sin(a*11)+.03*Math.sin(a*83+t*3),f=(1+(flare-1)*Math.pow(1-t,o.profile||2.6))*jag*(1-.04*Math.sin(t*9+a*5));
        row.push([cx+Math.cos(a)*d*f,yy,cz+Math.sin(a)*d*f]);}V.push(row);}
    // Skins: rock (strata bands), grass (rock showing through in streaks) or cap (rock sides, the top kept rock-grey edge).
    const skin=o.skin||'rock';
    for(let l=0;l<L;l++)for(let i=0;i<N;i++){const j=(i+1)%N,t=l/L,k=.86+.16*Math.sin(l*1.7+i*.3)*Math.sin(i*.9);
      const rocky=skin!=='grass'||Math.sin(i*.7+l*.4)*Math.sin(i*.23+1.3)>.55,col=shade(rocky?cols.rock:cols.grass,k*(rocky&&t<.12?.85:1));m.quad(V[l][i],V[l+1][i],V[l+1][j],V[l][j],col);}
    // A rim of turf spilling over the cliff edge, then the meadow top.
    const T=V[L],C=[cx,top,cz];for(let i=0;i<N;i++){const j=(i+1)%N;m.tri(C,T[j],T[i],cols.grass,[0,1,0],[0,1,0],[0,1,0]);}}
  function prism(m,o,col){const {pts,y,top,cx=0,cz=0}=o,N=pts.length,P=([a,d],yy)=>[cx+Math.cos(a)*d,yy,cz+Math.sin(a)*d];
    for(let i=0;i<N;i++){const j=(i+1)%N;m.quad(P(pts[i],y-40),P(pts[i],top),P(pts[j],top),P(pts[j],y-40),col);m.tri([cx,top,cz],P(pts[j],top),P(pts[i],top),shade(col,1.02),[0,1,0],[0,1,0],[0,1,0]);}}
  function blob(m,o,col){const {x,y,z,rx,ry,rz}=o,small=Math.max(rx,ry,rz)<.6,la=small?3:5,lo=small?5:8,P=(i,j)=>{const t=-Math.PI/2+i/la*Math.PI,a=j/lo*TAU;return [Math.cos(t)*Math.cos(a),Math.sin(t),Math.cos(t)*Math.sin(a)];};
    for(let i=0;i<la;i++)for(let j=0;j<lo;j++){const n=[P(i,j),P(i+1,j),P(i+1,j+1),P(i,j+1)],v=n.map(q=>[x+q[0]*rx,y+q[1]*ry,z+q[2]*rz]);m.quad(v[0],v[3],v[2],v[1],col,[n[0],n[3],n[2],n[1]]);}}
  // A wall panel along local u (length L, from u0) in a frame, with rectangular openings cut out: split the length at
  // every opening edge, and in each strip keep the heights no opening covers.
  function panel(m,F,u0,L,y0,y1,th,openings,col){const cuts=[u0,u0+L];for(const o of openings){cuts.push(Math.max(u0,Math.min(u0+L,o.u0)),Math.max(u0,Math.min(u0+L,o.u1)));}
    const us=[...new Set(cuts)].sort((a,b)=>a-b);
    for(let i=0;i+1<us.length;i++){const a=us[i],b=us[i+1];if(b-a<1e-3)continue;const mid=(a+b)/2,holes=openings.filter(o=>o.u0<=mid&&o.u1>=mid).map(o=>[o.y0,o.y1]).sort((p,q)=>p[0]-q[0]);
      let yy=y0;for(const [h0,h1] of [...holes,[y1,y1]]){if(h0>yy+1e-3)F.box(m,mid,b-a,yy,Math.min(h0,y1),th,col);yy=Math.max(yy,h1);}}}
  // Frame helper: local (u along w, v along d) to world for a rotated rectangle.
  function frame(o,off){const c=Math.cos(o.rot||0),s=Math.sin(o.rot||0);return {c,s,
    box:(m,u,len,ya,yb,th,col,v=off)=>box(m,{x:o.x+u*c-v*s,y:ya,z:o.z+u*s+v*c,w:len,h:yb-ya,d:th,rot:o.rot||0},col),
    boxZ:(m,v,len,ya,yb,th,col,u=off)=>box(m,{x:o.x+u*c-v*s,y:ya,z:o.z+u*s+v*c,w:th,h:yb-ya,d:len,rot:o.rot||0},col)};}
  function shell(m,o,col){const {w,h,d,th,floor,storeys,door,y}=o,top=y+h,flo=shade(col,.9);
    // Windows: one every ~5 m on every storey, tall arched-height slots; the ground hall of a grand keep gets taller ones.
    const wins=(L,side)=>{const out=[];storeys.forEach((sy,i)=>{const hh=i===0&&o.grand?9:2.4,y0=floor+sy+(i===0&&o.grand?3.5:1.2),n=Math.floor(L/5);for(let k=0;k<n;k++){const u=-L/2+(k+.5)*L/n;if(door&&side===door.side&&Math.abs(u-door.u)<door.wid+1)continue;out.push({u0:u-.8,u1:u+.8,y0,y1:Math.min(y0+hh,top-1)});}});return out;};
    for(const side of [-1,1]){const F=frame(o,side*(d/2-th/2)),op=wins(w,side);if(door&&door.side===side)op.push({u0:door.u-door.wid/2,u1:door.u+door.wid/2,y0:floor-.1,y1:floor+door.hgt});panel(m,F,-w/2,w,y,top,th,op,col);}
    for(const side of [-1,1]){const F=frame(o,0),u=side*(w/2-th/2),op=wins(d-2*th,9);if(door&&door.end===side)op.push({u0:door.u-door.wid/2,u1:door.u+door.wid/2,y0:floor-.1,y1:floor+door.hgt});
      // End walls run along local v: reuse the panel with a frame rotated by 90 degrees.
      const G={box:(m,v,len,ya,yb,tt,cc)=>F.boxZ(m,v,len,ya,yb,tt,cc,u)};panel(m,G,-(d/2-th),d-2*th,y,top,th,op,col);}
    // Floors and stairwells, as switchbacks: storey i's ramp runs along one long wall (side s alternating each storey)
    // between uS and uE, with a 1.5 m landing between uE and the end wall. Odd storeys climb toward -u (from the landing),
    // even storeys toward +u (onto the landing), so each ramp starts on solid floor where the last one arrived. Floor i
    // is solid except over its own ramp.
    const iw=w-2*th,id=d-2*th,sw=Math.min(3.2,id*.35),F=frame(o,0),uE=iw/2-1.5;
    for(let i=1;i<storeys.length;i++){const fy=floor+storeys[i],y0=floor+storeys[i-1],rise=storeys[i]-storeys[i-1],run=Math.min(iw-5,rise/Math.tan(.62)),uS=uE-run,sd=i%2?1:-1,vs=sd*(id/2-sw/2);
      F.box(m,0,iw,fy-.6,fy,id-sw,flo,-sd*sw/2);F.box(m,(-iw/2+uS)/2,uS+iw/2,fy-.6,fy,sw,flo,vs);F.box(m,(uE+iw/2)/2,iw/2-uE,fy-.6,fy,sw,flo,vs);
      const P=(u,v)=>[o.x+u*F.c-v*F.s,o.z+u*F.s+v*F.c],[ax,az]=P(i%2?uE:uS,vs),[bx,bz]=P(i%2?uS:uE,vs);ramp(m,{x0:ax,z0:az,y0,x1:bx,z1:bz,y1:fy,w:sw-.1,base:y0-.6},flo);}
    // A ceiling under the roof seals the top; a boarded ground floor covers the terrain inside.
    F.box(m,0,iw,top-.8,top,id,flo,0);F.box(m,0,iw,floor-.4,floor+.04,id,o.floorCol||[.62,.48,.34],0);}
  function tube(m,o,col){const {x,y,z,r,h,th,doors=[]}=o,seg=Math.max(18,Math.min(48,Math.round(r*3.2)));
    for(let i=0;i<seg;i++){const a=(i+.5)/seg*TAU,len=TAU*(r-th/2)/seg*1.04,ca=Math.cos(a),sa=Math.sin(a),F={box:(m,u,l,ya,yb,tt,cc)=>box(m,{x:x+ca*(r-th/2),y:ya,z:z+sa*(r-th/2),w:l,h:yb-ya,d:tt,rot:a+Math.PI/2},cc)};
      const holes=doors.filter(dd=>Math.abs(Math.atan2(Math.sin(a-dd.a),Math.cos(a-dd.a)))<1.3/r+.5*TAU/seg).map(dd=>({u0:-1,u1:1,y0:dd.y0,y1:dd.y1}));
      panel(m,F,-len/2,len,y,y+h,th,holes.map(q=>({...q,u0:-len,u1:len})),col);}}
  function spiral(m,o,col){const {x,z,r,y0,y1,a0}=o,rm=r*.55+.6,newel=.7,step=.45,da=1.05/rm,n=Math.ceil((y1-y0)/step);
    cyl(m,{x,y:y0-.5,z,r:newel,h:y1-y0+.5},shade(col,.95));
    for(let i=0;i<n;i++){const a=a0+i*da,yt=Math.min(y1,y0+(i+1)*step),cr=(r+newel)/2;box(m,{x:x+Math.cos(a)*cr,y:yt-.9,z:z+Math.sin(a)*cr,w:r-newel+.1,h:.9,d:1.25,rot:a},col);}}
  function disk(m,o,col){const {x,y,z,r,hole}=o,seg=40;for(let i=0;i<seg;i++){const a0=i/seg*TAU,a1=(i+1)/seg*TAU,am=(a0+a1)/2;
      if(hole){const off=Math.atan2(Math.sin(am-(hole[0]+hole[1])/2),Math.cos(am-(hole[0]+hole[1])/2));if(Math.abs(off)<(hole[1]-hole[0])/2)continue;}
      const A=[x+Math.cos(a0)*r,y+.6,z+Math.sin(a0)*r],B=[x+Math.cos(a1)*r,y+.6,z+Math.sin(a1)*r],C=[x,y+.6,z];m.tri(C,B,A,col,[0,1,0],[0,1,0],[0,1,0]);
      m.tri([x,y,z],[A[0],y,A[2]],[B[0],y,B[2]],col,[0,-1,0],[0,-1,0],[0,-1,0]);}}
  // A sloped way between two points, solid down to `base` (or a 0.6 m slab), with low parapets along both sides.
  function ramp(m,o,col){const {x0,z0,y0,x1,z1,y1,w,base}=o,dx=x1-x0,dz=z1-z0,L=Math.hypot(dx,dz)||1,nx=-dz/L*w/2,nz=dx/L*w/2,b0=base!=null?base:y0-.6,b1=base!=null?base:y1-.6;
    const T=[[x0-nx,y0,z0-nz],[x0+nx,y0,z0+nz],[x1+nx,y1,z1+nz],[x1-nx,y1,z1-nz]],B=[[x0-nx,b0,z0-nz],[x0+nx,b0,z0+nz],[x1+nx,b1,z1+nz],[x1-nx,b1,z1-nz]];
    m.quad(T[0],T[1],T[2],T[3],col);m.quad(B[0],T[0],T[3],B[3],shade(col,.92));m.quad(B[1],B[2],T[2],T[1],shade(col,.92));m.quad(B[0],B[1],T[1],T[0],shade(col,.9));m.quad(B[3],T[3],T[2],B[2],shade(col,.9));
    if(o.rail!==false)for(const e of [-1,1]){const ex=nx*e*.94,ez=nz*e*.94;const a=[x0+ex,y0,z0+ez],b=[x1+ex,y1,z1+ez],a2=[a[0],y0+1.1,a[2]],b2=[b[0],y1+1.1,b[2]];m.quad(a,b,b2,a2,shade(col,.95));}}
  // A person, 1.6-1.85 m: legs, a coat (tapered), arms, head and a hat or hair. For scale; no collision.
  function figure(m,o){const {x,y,z,rot=0,h=1.75,col=[.5,.3,.3]}=o,k=h/1.75,c=Math.cos(rot),s=Math.sin(rot),P=(u,v)=>[x+u*c-v*s,z+u*s+v*c],skin=[.92,.74,.6],leg=[.3,.28,.3];
    for(const v of [-.1,.1]){const [lx,lz]=P(0,v*k);box(m,{x:lx,y,z:lz,w:.18*k,h:.82*k,d:.16*k,rot},leg);}
    cyl(m,{x,y:y+.78*k,z,r:.22*k,h:.68*k,r2:.16*k},col,10);for(const v of [-.27,.27]){const [ax,az]=P(0,v*k);box(m,{x:ax,y:y+.8*k,z:az,w:.12*k,h:.6*k,d:.12*k,rot},col);}
    blob(m,{x,y:y+1.6*k,z,rx:.12*k,ry:.14*k,rz:.12*k},skin);cyl(m,{x,y:y+1.68*k,z,r:.14*k,h:.08*k,r2:.12*k},o.hat||[.3,.22,.16],10);}
  function gatewall(m,o,col){const F=frame(o,0),g=o.gap/2;panel(m,F,-o.w/2,o.w,o.y,o.y+o.h,o.d,[{u0:-g,u1:g,y0:o.y-1,y1:o.y+o.gateH}],col);crenels(m,o,col);}
  // Surface patterns drawn by the shader (no geometry): 1 timber framing, 2 roof tiles, 3 cobbles, 4 stone blocks,
  // 5 plaster, 6 wood planks, 7 grass.
  const PAT={roof:2,roof2:2,gold:0,paving:3,stone:4,stone2:4,trim:4,plaster:5,wood:6,grass:7,green:0};
  // Parts to triangles. `p.col` overrides the palette colour (city buildings carry their own plaster and roof colours).
  function meshParts(parts,pal,ox=0,oz=0,m=new Mesh()){const cols=colours(pal);
    for(let pi=0;pi<parts.length;pi++){const p0=parts[pi],p={...p0};m.pid=pi;if(p.x!=null){p.x+=ox;p.z+=oz;}if(p.cx!=null||p.t==='crag'||p.t==='ring'){p.cx=(p.cx||0)+ox;p.cz=(p.cz||0)+oz;}if(p.x0!=null){p.x0+=ox;p.z0+=oz;p.x1+=ox;p.z1+=oz;}
      const col=jit(p.col||cols[p.mat]||[1,0,1],(p.x||p.x0||0)*.37+(p.z||p.z0||0)*.11+(p.y||0));
      m.solid=p.t==='blob'||p.nocol?0:1;m.glow=p.glow?1:0;m.pat=p.pat!=null?p.pat:PAT[p.mat]||0;
      if(p.t==='box'){box(m,p,col);if(p.crenel)crenels(m,p,col);}
      else if(p.t==='shell')shell(m,p,col);else if(p.t==='tube')tube(m,p,col);else if(p.t==='spiral')spiral(m,p,col);else if(p.t==='disk')disk(m,p,col);
      else if(p.t==='ramp')ramp(m,p,col);else if(p.t==='gatewall')gatewall(m,p,col);
      else if(p.t==='cyl')cyl(m,p,col);else if(p.t==='cone')cone(m,p,col);else if(p.t==='dome')dome(m,p,col);else if(p.t==='gable')gable(m,p,col);else if(p.t==='hip')hip(m,p,col);
      else if(p.t==='arch')arch(m,p,col);else if(p.t==='crag')crag(m,p,cols);else if(p.t==='ring')prism(m,p,col);else if(p.t==='blob')blob(m,p,col);
      else if(p.t==='land'){const W=20000;m.quad([-W,p.y,-W],[-W,p.y,W],[W,p.y,W],[W,p.y,-W],cols.grass,[[0,1,0],[0,1,0],[0,1,0],[0,1,0]]);}
      else if(p.t==='water'){const seg=32,N=[0,1,0];for(let i=0;i<seg;i++){const a0=i/seg*TAU,a1=(i+1)/seg*TAU;m.tri([p.x,p.y,p.z],[p.x+Math.cos(a1)*p.r,p.y,p.z+Math.sin(a1)*p.r],[p.x+Math.cos(a0)*p.r,p.y,p.z+Math.sin(a0)*p.r],[.2,.5,.62],N,N,N,1);}}
      else if(p.t==='figure'){figure(m,p);}
      else if(p.t==='beam'){// A square timber between two points (braces, barge boards, ridge caps).
        const a=[p.x0,p.y0,p.z0],b=[p.x1,p.y1,p.z1],d=sub(b,a),L=Math.hypot(...d),t=d.map(v=>v/L),up=Math.abs(t[1])>.9?[1,0,0]:[0,1,0],x=norm(cross(t,up)),y=cross(x,t),h=(p.s||.18)/2;
        const C=(i,j,k)=>[0,1,2].map(q=>(k?b:a)[q]+x[q]*i*h+y[q]*j*h);const q4=[[-1,-1],[1,-1],[1,1],[-1,1]];
        for(let e=0;e<4;e++){const [i0,j0]=q4[e],[i1,j1]=q4[(e+1)%4];m.quad(C(i0,j0,0),C(i1,j1,0),C(i1,j1,1),C(i0,j0,1),col);}m.quad(C(-1,-1,1),C(1,-1,1),C(1,1,1),C(-1,1,1),col);m.quad(C(-1,1,0),C(1,1,0),C(1,-1,0),C(-1,-1,0),col);}
      else if(p.t==='vdisk'){// A round panel standing upright, facing along rot (rose windows, clock faces): rim ring and spoked tracery.
        const seg=24,c=Math.cos(p.rot),sn=Math.sin(p.rot),P=(a,rr,o=0)=>[p.x+c*o-sn*Math.cos(a)*rr,p.y+Math.sin(a)*rr,p.z+sn*o+c*Math.cos(a)*rr],N=[c,0,sn];
        for(let i=0;i<seg;i++){const a0=i/seg*TAU,a1=(i+1)/seg*TAU;m.tri(P(0,0,.02),P(a0,p.r*.82,.02),P(a1,p.r*.82,.02),p.col2||[.18,.17,.24],N,N,N);m.quad(P(a0,p.r*.82,.05),P(a0,p.r,.05),P(a1,p.r,.05),P(a1,p.r*.82,.05),col,[N,N,N,N]);
          if(i%3===0)m.quad(P(a0-.04,0,.06),P(a0-.04,p.r*.82,.06),P(a0+.04,p.r*.82,.06),P(a0+.04,0,.06),col,[N,N,N,N]);}}
      else if(p.t==='field'){// Heightfield ground: smooth normals from the neighbouring heights; skipped cells stay open.
        const {x0,z0,n,C,h,skip}=p,H=(i,j)=>h[Math.max(0,Math.min(n,j))*(n+1)+Math.max(0,Math.min(n,i))],P=(i,j)=>[x0+i*C,H(i,j),z0+j*C],N=(i,j)=>{const v=[H(i-1,j)-H(i+1,j),2*C,H(i,j-1)-H(i,j+1)],l=Math.hypot(...v);return v.map(t=>t/l);};
        for(let j=0;j<n;j++)for(let i=0;i<n;i++){if(skip[j*n+i])continue;m.quad(P(i,j),P(i,j+1),P(i+1,j+1),P(i+1,j),col,[N(i,j),N(i,j+1),N(i+1,j+1),N(i+1,j)]);}}
      else if(p.t==='quad'){const {x0,z0,x1,z1,y}=p,N=[0,1,0];m.quad([x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0],col,[N,N,N,N]);}
      else if(p.t==='shore'){cyl(m,{x:p.x,y:-4,z:p.z,r:p.r,h:p.h+4,r2:p.r*.985},cols.grass,96);}}
    return m;}
  function waterMesh(m=new Mesh()){m.pat=0;m.glow=0;const W=30000;for(const [a,b,c] of [[[-W,0,-W],[-W,0,W],[W,0,W]],[[-W,0,-W],[W,0,W],[W,0,-W]]])m.tri(a,b,c,[.2,.5,.62],[0,1,0],[0,1,0],[0,1,0],1);return m;}
  function build(castles){const m=new Mesh();for(const {castle,ox,oz} of castles)meshParts(castle.parts,castle.palette,ox,oz,m);return waterMesh(m);}
  // ---- GL
  const VS=`#version 300 es
  in vec3 P;in vec3 N;in vec3 C;in float F;in float T;uniform mat4 VP;uniform mat4 LVP;out vec3 vP;out vec3 vN;out vec3 vC;out float vF;out float vT;out vec4 vL;
  void main(){vP=P;vN=N;vC=C;vF=F;vT=T;vL=LVP*vec4(P,1.);gl_Position=VP*vec4(P,1.);}`;
  const FS=`#version 300 es
  precision highp float;in vec3 vP;in vec3 vN;in vec3 vC;in float vF;in float vT;in vec4 vL;uniform vec3 SUN;uniform vec3 EYE;uniform highp sampler2DShadow SH;uniform float TX;uniform float GOLD;layout(location=0) out vec4 o;layout(location=1) out vec4 nrm;
  vec3 skyCol(vec3 d){float t=clamp(d.y,0.,1.);return mix(mix(vec3(.82,.9,.98),vec3(1.,.82,.62),GOLD),mix(vec3(.28,.52,.9),vec3(.36,.5,.86),GOLD),pow(t,.6));}
  float shadow(){vec3 c=vL.xyz/vL.w*.5+.5;if(any(lessThan(c,vec3(0)))||any(greaterThan(c,vec3(1))))return 1.;float s=0.;
    for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)s+=texture(SH,vec3(c.xy+vec2(i,j)*TX,c.z-.0012));return s/9.;}
  float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y);}
  // Surface pattern: returns the base colour with the pattern applied; fades out with distance so it never shimmers.
  vec3 pattern(vec3 c,vec3 n,float dist){int t=int(vT+.5);if(t==0)return c;float fade=1.-smoothstep(40.,260.,dist);if(fade<=0.)return c;
    vec3 p=vP;bool wall=abs(n.y)<.5;vec2 tg=normalize(vec2(-n.z,n.x)+1e-5);float u=dot(p.xz,tg);vec3 o=c;
    if(t==1&&wall){float y=p.y-6.,fy=fract(y/3.6),fu=fract(u/1.7),cell=floor(u/1.7)+floor(y/3.6)*7.;
      float beam=step(fy,.06)+step(.94,fy)+step(fu,.07)+step(.93,fu);if(hh(vec2(cell,3.))<.45)beam+=step(abs(fu-fy),.05);if(y>0.)o=mix(c,vec3(.27,.19,.14),clamp(beam,0.,1.));}
    else if(t==2){float y=p.y*2.4,row=floor(y);float j=step(fract(y),.12)+step(fract(u*1.4+row*.5),.07);o=c*(1.-.16*clamp(j,0.,1.))*(.93+.12*hh(vec2(floor(u*1.4+row*.5),row)));}
    else if(t==3&&!wall){vec2 q=p.xz*1.6,cl=floor(q+vec2(0,floor(q.x)*.5)),f=fract(q+vec2(0,floor(q.x)*.5));float e=min(min(f.x,1.-f.x),min(f.y,1.-f.y));o=c*(.86+.18*hh(cl))*(1.-.22*(1.-smoothstep(.04,.1,e)));}
    else if(t==4){vec2 q=wall?vec2(u/1.15,p.y/.55):p.xz/vec2(1.15,.8);q.x+=floor(q.y)*.5;vec2 f=fract(q);float e=min(min(f.x,1.-f.x)*1.15,min(f.y,1.-f.y)*.55);o=c*(.88+.16*hh(floor(q)))*(1.-.18*(1.-smoothstep(.02,.06,e)));}
    else if(t==5){o=c*(.95+.08*vn(vec2(u,p.y)*.6));if(wall)o*=1.-.18*(1.-smoothstep(6.,7.2,p.y));}
    else if(t==6){o=c*(.9+.14*hh(vec2(floor((wall?u:p.x)*4.),2.)));}
    else if(t==7){o=c*(.86+.2*vn(p.xz*.12)+.06*vn(p.xz*1.3));}
    else if(t==10){o=mix(c,vec3(.97,.95,.9),step(.5,fract(dot(p.xz,vec2(.7071))*1.6)));}
    else if(t==8||t==9){
      // Closed buildings: the plaster or framing, then painted windows on each storey (dark glass, pale frame).
      if(t==9&&wall){float y=p.y-6.,fy=fract(y/3.6),fu=fract(u/1.7),cell=floor(u/1.7)+floor(y/3.6)*7.;float beam=step(fy,.06)+step(.94,fy)+step(fu,.07)+step(.93,fu);if(y>0.)o=mix(c,vec3(.27,.19,.14),clamp(beam,0.,1.));}
      else o=c*(.95+.08*vn(vec2(u,p.y)*.6));
      if(wall&&p.y>6.9){float y=p.y-6.,wy=fract(y/3.6),wu=fract(u/2.6+.5);float win=step(.34,wu)*step(wu,.66)*step(.3,wy)*step(wy,.78),frame=step(.3,wu)*step(wu,.7)*step(.26,wy)*step(wy,.82);
        o=mix(o,vec3(.93,.9,.84),frame*(1.-win)*.8);o=mix(o,vec3(.2,.25,.34)+.06*hh(floor(vec2(u/2.6,y/3.6))),win);}}
    return mix(c,o,fade);}
  void main(){vec3 V=normalize(EYE-vP),n=normalize(vN);n=dot(n,V)<0.?-n:n;float dist=length(EYE-vP);nrm=vec4(n*.5+.5,vF>.5&&vF<1.5?0.:1.);
    // Closed solids only show faces turned to the eye, so a normal facing away is a winding slip: flip it.
    if(vF>.5&&vF<1.5){
      // Water: deep teal to sky by fresnel, with a sun glint path and gentle ripple shading.
      vec2 q=vP.xz*.02;float rip=sin(q.x*3.1+sin(q.y*2.3))*.5+sin(q.y*4.7+q.x*1.3)*.5;vec3 wn=normalize(vec3(rip*.02,1.,rip*.015)*mix(1.,.2,clamp(dist/3000.,0.,1.))+vec3(0,1,0)*0.);
      float fr=pow(1.-max(dot(wn,V),0.),4.);vec3 R=reflect(-V,wn);vec3 col=mix(vec3(.12,.42,.55),skyCol(R),.25+.65*fr);
      col+=vec3(1.,.95,.8)*pow(max(dot(R,SUN),0.),180.)*1.5*shadow();col*=mix(.8,1.,shadow());
      o=vec4(mix(col,skyCol(normalize(vP-EYE)*vec3(1,0,1)+vec3(0,.02,0)),1.-exp(-dist/9000.)),1.);return;}
    if(vF>1.5){o=vec4(mix(vC*1.4+vec3(.35,.25,.08),vec3(1.,.92,.6),.5),1.);return;}
    vec3 base=pattern(vC,n,dist);
    float ndl=dot(n,SUN),sh=shadow(),lit=max(ndl,0.)*sh;
    // Soft cel: a shadow tone, a mid tone and a lit tone with short smooth steps between them.
    float tone=smoothstep(.02,.16,lit)*.62+smoothstep(.45,.62,lit)*.38;
    // Golden hour: a warmer, stronger key light and violet-blue shadows (anime evening palette).
    vec3 cool=base*mix(vec3(.6,.66,.92)*.82,vec3(.52,.5,.82)*.8,GOLD)+vec3(.02,.03,.07),warm=base*mix(vec3(1.1,1.02,.9),vec3(1.28,1.03,.76),GOLD);
    vec3 col=mix(cool,warm,tone);
    col+=base*.1*(n.y*.5+.5)*vec3(.7,.85,1.);
    col+=vec3(1.,.92,.8)*pow(1.-max(dot(n,V),0.),3.)*.18*sh*max(dot(-V,SUN)+.3,0.);
    // Aerial perspective toward the horizon sky.
    o=vec4(mix(col,skyCol(normalize(vP-EYE)*vec3(1,.3,1)),1.-exp(-dist/7000.)),1.);}`;
  const SVS=`#version 300 es
  in vec3 P;uniform mat4 LVP;void main(){gl_Position=LVP*vec4(P,1.);}`;
  const SFS=`#version 300 es
  precision mediump float;out vec4 o;void main(){o=vec4(1);}`;
  const SKYV=`#version 300 es
  out vec2 uv;void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);uv=p;gl_Position=vec4(p,.9999,1.);}`;
  const SKYF=`#version 300 es
  precision highp float;in vec2 uv;uniform mat4 IVP;uniform vec3 SUN;uniform float GOLD;layout(location=0) out vec4 o;layout(location=1) out vec4 nrm;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p*=2.1;a*=.5;}return s;}
  void main(){vec4 a=IVP*vec4(uv,-1,1),b=IVP*vec4(uv,1,1);vec3 d=normalize(b.xyz/b.w-a.xyz/a.w);float t=clamp(d.y,0.,1.);
    nrm=vec4(.5,.5,.5,0.);vec3 col=mix(mix(vec3(.82,.9,.98),vec3(1.,.82,.62),GOLD),mix(vec3(.28,.52,.9),vec3(.36,.5,.86),GOLD),pow(t,.6));
    // Cumulus: puffy cloud masses near the horizon band, white tops and soft blue-grey bellies.
    if(d.y>0.){vec2 q=d.xz/(d.y+.08)*1.6;float c=fbm(q+vec2(3.1,1.7)),m=smoothstep(.52,.62,c)*smoothstep(0.,.08,d.y);float belly=smoothstep(.55,.75,fbm(q*1.3+vec2(.4,.2)));
      col=mix(col,mix(mix(vec3(.72,.78,.9),vec3(.75,.62,.72),GOLD),mix(vec3(1.,.99,.96),vec3(1.,.86,.66),GOLD),belly),m*.95);}
    col+=vec3(1.,.9,.7)*pow(max(dot(d,SUN),0.),60.)*.4;o=vec4(col,1.);}`;
  // Ink pass: edges where depth jumps (silhouettes) or normals turn (creases) become soft dark lines tinted from the
  // surface colour, fading with distance; then a gentle saturation lift for the painted look.
  const POSTF=`#version 300 es
  precision highp float;in vec2 uv;uniform sampler2D COL,NRM,DEP;uniform vec2 PX;uniform float NEAR,FAR,INK;out vec4 o;
  float lin(vec2 q){float d=texture(DEP,q).r*2.-1.;return 2.*NEAR*FAR/(FAR+NEAR-d*(FAR-NEAR));}
  void main(){vec2 q=uv*.5+.5;vec3 c=texture(COL,q).rgb;vec4 nc=texture(NRM,q);float zc=lin(q),e=0.;
    if(INK>0.&&nc.a>.5){vec2 o4[4]=vec2[4](vec2(1,0),vec2(-1,0),vec2(0,1),vec2(0,-1));
      for(int i=0;i<4;i++){vec2 p=q+o4[i]*PX*1.2;float z=lin(p);vec4 nn=texture(NRM,p);
        e=max(e,smoothstep(.025,.06,(z-zc)/zc));if(nn.a>.5)e=max(e,smoothstep(.72,.5,dot(nc.xyz*2.-1.,nn.xyz*2.-1.))*.85);else e=max(e,1.);}
      e*=INK*(1.-smoothstep(250.,1600.,zc)*.8);}
    float l=dot(c,vec3(.3,.59,.11));c=mix(vec3(l),c,1.12);c=mix(c,c*vec3(.28,.22,.3),e*.8);o=vec4(c,1.);}`;
  function prog(gl,v,f){const p=gl.createProgram();for(const [t,s] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
  // ---- Matrices (column-major).
  const mul=(a,b)=>{const o=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s;}return o;};
  function persp(fov,asp,n,f){const t=1/Math.tan(fov/2);return new Float32Array([t/asp,0,0,0,0,t,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0]);}
  function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
  function look(e,c,u){const z=norm(sub(e,c)),x=norm(cross(u,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1]);}
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
  function invert(m){const inv=new Float32Array(16),a=m;
    inv[0]=a[5]*a[10]*a[15]-a[5]*a[11]*a[14]-a[9]*a[6]*a[15]+a[9]*a[7]*a[14]+a[13]*a[6]*a[11]-a[13]*a[7]*a[10];inv[4]=-a[4]*a[10]*a[15]+a[4]*a[11]*a[14]+a[8]*a[6]*a[15]-a[8]*a[7]*a[14]-a[12]*a[6]*a[11]+a[12]*a[7]*a[10];
    inv[8]=a[4]*a[9]*a[15]-a[4]*a[11]*a[13]-a[8]*a[5]*a[15]+a[8]*a[7]*a[13]+a[12]*a[5]*a[11]-a[12]*a[7]*a[9];inv[12]=-a[4]*a[9]*a[14]+a[4]*a[10]*a[13]+a[8]*a[5]*a[14]-a[8]*a[6]*a[13]-a[12]*a[5]*a[10]+a[12]*a[6]*a[9];
    inv[1]=-a[1]*a[10]*a[15]+a[1]*a[11]*a[14]+a[9]*a[2]*a[15]-a[9]*a[3]*a[14]-a[13]*a[2]*a[11]+a[13]*a[3]*a[10];inv[5]=a[0]*a[10]*a[15]-a[0]*a[11]*a[14]-a[8]*a[2]*a[15]+a[8]*a[3]*a[14]+a[12]*a[2]*a[11]-a[12]*a[3]*a[10];
    inv[9]=-a[0]*a[9]*a[15]+a[0]*a[11]*a[13]+a[8]*a[1]*a[15]-a[8]*a[3]*a[13]-a[12]*a[1]*a[11]+a[12]*a[3]*a[9];inv[13]=a[0]*a[9]*a[14]-a[0]*a[10]*a[13]-a[8]*a[1]*a[14]+a[8]*a[2]*a[13]+a[12]*a[1]*a[10]-a[12]*a[2]*a[9];
    inv[2]=a[1]*a[6]*a[15]-a[1]*a[7]*a[14]-a[5]*a[2]*a[15]+a[5]*a[3]*a[14]+a[13]*a[2]*a[7]-a[13]*a[3]*a[6];inv[6]=-a[0]*a[6]*a[15]+a[0]*a[7]*a[14]+a[4]*a[2]*a[15]-a[4]*a[3]*a[14]-a[12]*a[2]*a[7]+a[12]*a[3]*a[6];
    inv[10]=a[0]*a[5]*a[15]-a[0]*a[7]*a[13]-a[4]*a[1]*a[15]+a[4]*a[3]*a[13]+a[12]*a[1]*a[7]-a[12]*a[3]*a[5];inv[14]=-a[0]*a[5]*a[14]+a[0]*a[6]*a[13]+a[4]*a[1]*a[14]-a[4]*a[2]*a[13]-a[12]*a[1]*a[6]+a[12]*a[2]*a[5];
    inv[3]=-a[1]*a[6]*a[11]+a[1]*a[7]*a[10]+a[5]*a[2]*a[11]-a[5]*a[3]*a[10]-a[9]*a[2]*a[7]+a[9]*a[3]*a[6];inv[7]=a[0]*a[6]*a[11]-a[0]*a[7]*a[10]-a[4]*a[2]*a[11]+a[4]*a[3]*a[10]+a[8]*a[2]*a[7]-a[8]*a[3]*a[6];
    inv[11]=-a[0]*a[5]*a[11]+a[0]*a[7]*a[9]+a[4]*a[1]*a[11]-a[4]*a[3]*a[9]-a[8]*a[1]*a[7]+a[8]*a[3]*a[5];inv[15]=a[0]*a[5]*a[10]-a[0]*a[6]*a[9]-a[4]*a[1]*a[10]+a[4]*a[2]*a[9]+a[8]*a[1]*a[6]-a[8]*a[2]*a[5];
    const det=a[0]*inv[0]+a[1]*inv[4]+a[2]*inv[8]+a[3]*inv[12];return inv.map(v=>v/det);}
  function Renderer(canvas){
    const gl=canvas.getContext('webgl2',{antialias:true,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL2 unavailable');this.gl=gl;
    this.main=prog(gl,VS,FS);this.shadowProg=prog(gl,SVS,SFS);this.sky=prog(gl,SKYV,SKYF);this.vao=gl.createVertexArray();this.svao=gl.createVertexArray();this.count=0;
    const S=4096;this.SM=S;this.depth=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.depth);gl.texStorage2D(gl.TEXTURE_2D,1,gl.DEPTH_COMPONENT32F,S,S);
    for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
    this.cache=new Map();this.list=[];this.fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.depth,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    this.post=prog(gl,SKYV,POSTF);this.ink=1;this.setLight('noon');
  }
  // Meshes are uploaded once per key and kept; setMeshes picks which keys draw. Water (flag 1) never casts.
  Renderer.prototype.upload=function(key,m){const gl=this.gl;if(this.cache.has(key))return this.cache.get(key);const g={vao:gl.createVertexArray(),svao:gl.createVertexArray(),count:m.p.length/3,bufs:[]};
    const buf=(data,loc,size,vao,prog)=>{gl.bindVertexArray(vao);const b=gl.createBuffer();g.bufs.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const l=gl.getAttribLocation(prog,loc);if(l>=0){gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,gl.FLOAT,false,0,0);}};
    for(const [d,l,s] of [[m.p,'P',3],[m.n,'N',3],[m.c,'C',3],[m.f,'F',1],[m.t,'T',1]])buf(d,l,s,g.vao,this.main);buf(m.p,'P',3,g.svao,this.shadowProg);g.casts=!m.f.length||m.f[0]!==1;
    // Bounding sphere for culling (the water plane is never culled).
    let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<m.p.length;i+=3)for(let a=0;a<3;a++){const v=m.p[i+a];if(v<lo[a])lo[a]=v;if(v>hi[a])hi[a]=v;}
    g.c=lo.map((v,a)=>(v+hi[a])/2);g.r=g.casts?Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])/2:1e9;this.cache.set(key,g);return g;};
  // Frustum planes from a view-projection matrix (column-major), and a sphere test against them.
  function planes(M){const r=i=>[M[i],M[4+i],M[8+i],M[12+i]],R0=r(0),R1=r(1),R2=r(2),R3=r(3),out=[];
    for(const [a,sg] of [[R0,1],[R0,-1],[R1,1],[R1,-1],[R2,1],[R2,-1]]){const p=R3.map((v,i)=>v+sg*a[i]),l=Math.hypot(p[0],p[1],p[2]);out.push(p.map(v=>v/l));}return out;}
  const visible=(P,g)=>{for(const p of P)if(p[0]*g.c[0]+p[1]*g.c[1]+p[2]*g.c[2]+p[3]<-g.r)return false;return true;};
  Renderer.prototype.drop=function(key){const g=this.cache.get(key);if(!g)return;const gl=this.gl;g.bufs.forEach(b=>gl.deleteBuffer(b));gl.deleteVertexArray(g.vao);gl.deleteVertexArray(g.svao);this.cache.delete(key);};
  Renderer.prototype.setLight=function(mode){this.gold=mode==='golden'?1:0;this.sun=norm(this.gold?[-.62,.3,.5]:[-.55,.62,.42]);};
  // Offscreen targets (colour, normal, depth) at the canvas size, for the ink pass.
  Renderer.prototype.targets=function(w,h){const gl=this.gl;if(this.tw===w&&this.th===h)return;this.tw=w;this.th=h;const mk=(fmt,ifmt,type)=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,ifmt,w,h,0,fmt,type,null);
      for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);return t;};
    if(this.ofb){gl.deleteFramebuffer(this.ofb);[this.tc,this.tn,this.td].forEach(t=>gl.deleteTexture(t));}
    this.tc=mk(gl.RGBA,gl.RGBA8,gl.UNSIGNED_BYTE);this.tn=mk(gl.RGBA,gl.RGBA8,gl.UNSIGNED_BYTE);this.td=mk(gl.DEPTH_COMPONENT,gl.DEPTH_COMPONENT24,gl.UNSIGNED_INT);
    this.ofb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.ofb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.tc,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,this.tn,0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.td,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);gl.bindFramebuffer(gl.FRAMEBUFFER,null);};
  Renderer.prototype.setMeshes=function(list,bounds){this.list=list.map(({key,mesh})=>this.upload(key,mesh));if(bounds)this.bounds=bounds;};
  Renderer.prototype.setMesh=function(m,bounds){for(const k of [...this.cache.keys()])this.drop(k);this.setMeshes([{key:'main'+(this.n=(this.n||0)+1),mesh:m}],bounds);};
  // Shadows cover a sun-aligned box: the scene bounds, or a focus (Walk) so nearby shadows stay sharp.
  Renderer.prototype.lightFor=function(f){const {cx,cz,r,h}=f,L=this.sun,target=[cx,h*.3,cz],eye=target.map((v,i)=>v+L[i]*r*3);return mul(ortho(-r,r,-r,r,r*.2,r*6),look(eye,target,[0,1,0]));};
  Renderer.prototype.draw=function(cam){const gl=this.gl,c=gl.canvas,w=c.width,h=c.height;
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.fb);gl.viewport(0,0,this.SM,this.SM);gl.clear(gl.DEPTH_BUFFER_BIT);gl.disable(gl.CULL_FACE);gl.useProgram(this.shadowProg);
    this.lvp=this.lightFor(cam.shadowFocus||this.bounds);
    const LP=planes(this.lvp);let st=0;
    gl.uniformMatrix4fv(gl.getUniformLocation(this.shadowProg,'LVP'),false,this.lvp);for(const g of this.list)if(g.casts&&visible(LP,g)){gl.bindVertexArray(g.svao);gl.drawArrays(gl.TRIANGLES,0,g.count);st+=g.count/3;}
    this.targets(w,h);gl.bindFramebuffer(gl.FRAMEBUFFER,this.ofb);gl.viewport(0,0,w,h);gl.clearColor(.8,.88,.97,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    // Orbit camera, or first person (cam.fp: eye, yaw, pitch) for Walk.
    let eye,vp;
    let NEAR=2,FAR=60000;if(cam.fp){NEAR=.15;FAR=30000;eye=cam.fp.eye;const {yaw,pitch}=cam.fp,dir=[Math.cos(pitch)*Math.cos(yaw),Math.sin(pitch),Math.cos(pitch)*Math.sin(yaw)];vp=mul(persp(1.15,w/h,.15,30000),look(eye,eye.map((v,i)=>v+dir[i]),[0,1,0]));}
    else{eye=[cam.tx+Math.cos(cam.pitch)*Math.cos(cam.yaw)*cam.dist,cam.ty+Math.sin(cam.pitch)*cam.dist,cam.tz+Math.cos(cam.pitch)*Math.sin(cam.yaw)*cam.dist];vp=mul(persp(cam.fov||.75,w/h,2,60000),look(eye,[cam.tx,cam.ty,cam.tz],[0,1,0]));}
    gl.disable(gl.DEPTH_TEST);gl.useProgram(this.sky);gl.uniformMatrix4fv(gl.getUniformLocation(this.sky,'IVP'),false,invert(vp));gl.uniform3fv(gl.getUniformLocation(this.sky,'SUN'),this.sun);gl.uniform1f(gl.getUniformLocation(this.sky,'GOLD'),this.gold);gl.bindVertexArray(null);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.useProgram(this.main);const U=n=>gl.getUniformLocation(this.main,n);
    gl.uniformMatrix4fv(U('VP'),false,vp);gl.uniformMatrix4fv(U('LVP'),false,this.lvp);gl.uniform3fv(U('SUN'),this.sun);gl.uniform3fv(U('EYE'),eye);gl.uniform1f(U('TX'),1/this.SM);gl.uniform1f(U('GOLD'),this.gold);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.depth);gl.uniform1i(U('SH'),0);const VPl=planes(vp);let tris=0,drawn=0;for(const g of this.list){if(!visible(VPl,g))continue;gl.bindVertexArray(g.vao);gl.drawArrays(gl.TRIANGLES,0,g.count);tris+=g.count/3;drawn++;}
    this.stats={meshes:this.list.length,drawn,tris:Math.round(tris),shadowTris:Math.round(st)};
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.disable(gl.DEPTH_TEST);gl.useProgram(this.post);const P=n=>gl.getUniformLocation(this.post,n);
    [[this.tc,'COL'],[this.tn,'NRM'],[this.td,'DEP']].forEach(([t,n],i)=>{gl.activeTexture(gl.TEXTURE1+i);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(P(n),1+i);});
    gl.uniform2f(P('PX'),1/w,1/h);gl.uniform1f(P('NEAR'),NEAR);gl.uniform1f(P('FAR'),FAR);gl.uniform1f(P('INK'),this.ink);gl.bindVertexArray(null);gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);};
  // The beam part needs these helpers outside the GL section.
  window.CastleRender={build,meshParts,waterMesh,Mesh,Renderer};
})();
