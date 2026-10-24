// Castle drafts Walk: first-person movement against the castle mesh. Solid triangles go in an 8 m grid; the walker
// finds the floor with a ray down (stepping up to 0.6 m, so stairs and ramps climb) and is stopped by walls with rays
// along the move at knee, chest and head height. Movement is resolved one axis at a time, so walls slide.
(function(){
  'use strict';
  const CELL=8,BIG=400;
  function Collider(mesh){
    const P=mesh.p,K=mesh.k;this.tris=[];this.grid=new Map();this.big=[];
    for(let v=0;v<P.length/3;v+=3){if(!K[v/3])continue;const t=[P[v*3],P[v*3+1],P[v*3+2],P[v*3+3],P[v*3+4],P[v*3+5],P[v*3+6],P[v*3+7],P[v*3+8]],id=this.tris.length;this.tris.push(t);
      const x0=Math.min(t[0],t[3],t[6]),x1=Math.max(t[0],t[3],t[6]),z0=Math.min(t[2],t[5],t[8]),z1=Math.max(t[2],t[5],t[8]);
      if(x1-x0>BIG||z1-z0>BIG){this.big.push(id);continue;}
      for(let i=Math.floor(x0/CELL);i<=Math.floor(x1/CELL);i++)for(let j=Math.floor(z0/CELL);j<=Math.floor(z1/CELL);j++){const k=i*65536+j;let a=this.grid.get(k);if(!a)this.grid.set(k,a=[]);a.push(id);}}
  }
  // Nearest hit distance along a ray (Möller–Trumbore) among triangles in the cells the segment touches.
  Collider.prototype.ray=function(o,d,max){
    const seen=new Set(),ids=[...this.big],ex=o[0]+d[0]*max,ez=o[2]+d[2]*max;
    for(let i=Math.floor(Math.min(o[0],ex)/CELL);i<=Math.floor(Math.max(o[0],ex)/CELL);i++)for(let j=Math.floor(Math.min(o[2],ez)/CELL);j<=Math.floor(Math.max(o[2],ez)/CELL);j++){const a=this.grid.get(i*65536+j);if(a)for(const id of a)if(!seen.has(id)){seen.add(id);ids.push(id);}}
    let best=max;for(const id of ids){const t=this.tris[id],e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]];
      const p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-9)continue;
      const inv=1/det,s=[o[0]-t[0],o[1]-t[1],o[2]-t[2]],u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])*inv;if(u<0||u>1)continue;
      const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*inv;if(v<0||u+v>1)continue;
      const tt=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;if(tt>1e-4&&tt<best)best=tt;}
    return best;};
  // Floor under (x,z) for feet at y: the first surface below y+step; -Infinity when there is none (falling into the sea).
  Collider.prototype.floor=function(x,y,z,step=.6){const t=this.ray([x,y+step,z],[0,-1,0],600);return t<600?y+step-t:-Infinity;};
  // Several colliders as one (the city: static ground and walls, the castle, and the interior tiles near the walker).
  function Multi(list){this.list=list;}
  Multi.prototype.ray=function(o,d,max){let best=max;for(const c of this.list)best=Math.min(best,c.ray(o,d,best));return best;};
  Multi.prototype.floor=Collider.prototype.floor;
  function Walker(col,spawn){this.col=col;this.x=spawn.x;this.z=spawn.z;this.yaw=spawn.yaw;this.pitch=0;this.vy=0;this.fly=false;this.keys={};
    const f=col.floor(spawn.x,spawn.y+40,spawn.z,0);this.y=isFinite(f)?f:spawn.y;}
  Walker.prototype.blocked=function(x,y,z,dx,dz){const L=Math.hypot(dx,dz);if(L<1e-6)return false;const d=[dx/L,0,dz/L];
    for(const h of [.75,1.3,1.75])if(this.col.ray([x,y+h,z],d,L+.35)<L+.35)return true;return false;};
  Walker.prototype.update=function(dt){const k=this.keys,sp=(k.shift?14:5)*(this.fly?4:1),f=(k.w?1:0)-(k.s?1:0),r=(k.d?1:0)-(k.a?1:0);
    const fx=Math.cos(this.yaw),fz=Math.sin(this.yaw),dx=(fx*f-fz*r)*sp*dt,dz=(fz*f+fx*r)*sp*dt;
    if(this.fly){this.x+=dx;this.z+=dz;this.y+=((k.space?1:0)-(k.c?1:0))*sp*dt;return;}
    // One axis at a time, so a wall stops only the part of the move that runs into it.
    if(!this.blocked(this.x,this.y,this.z,dx,0))this.x+=dx;if(!this.blocked(this.x,this.y,this.z,0,dz))this.z+=dz;
    const g=this.col.floor(this.x,this.y,this.z);this.vy-=22*dt;this.y+=this.vy*dt;
    if(this.y<=g){this.y=g;this.vy=k.space?7:0;}if(this.y<-30){const s=this.spawn0;if(s){this.x=s.x;this.z=s.z;this.y=s.y;this.vy=0;}}};
  Walker.prototype.camera=function(){return {eye:[this.x,this.y+1.65,this.z],yaw:this.yaw,pitch:this.pitch};};
  window.CastleWalk={Collider,Multi,Walker};
})();
