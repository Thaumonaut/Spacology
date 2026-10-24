// A shared surface plan for axis-aligned urban paving. Higher-priority regions own
// their footprint; the result has one top face per cell and only exposed risers.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PavementPlan=factory();})(this,function(){
  'use strict';
  const EPS=1e-6,snap=x=>Math.round(x/EPS)*EPS;
  function source(part,priority=0){
    if(part.t==='box')return {part,priority,role:part.role,x0:part.x-part.w/2,x1:part.x+part.w/2,z0:part.z-part.d/2,z1:part.z+part.d/2,height:()=>part.y+part.h};
    if(part.t!=='ramp')throw Error('Pavement sources must be boxes or axis-aligned ramps');
    const dx=part.x1-part.x0,dz=part.z1-part.z0;
    if(Math.abs(dx)>EPS&&Math.abs(dz)>EPS)throw Error('Pavement source is not axis aligned');
    const alongX=Math.abs(dx)>Math.abs(dz),half=part.w/2;
    return {part,priority,role:part.role,x0:alongX?Math.min(part.x0,part.x1):part.x0-half,x1:alongX?Math.max(part.x0,part.x1):part.x0+half,z0:alongX?part.z0-half:Math.min(part.z0,part.z1),z1:alongX?part.z0+half:Math.max(part.z0,part.z1),height:(x,z)=>part.y0+(part.y1-part.y0)*(alongX?(x-part.x0)/dx:(z-part.z0)/dz)};
  }
  function build(sources,ground){
    const xs=[...new Set(sources.flatMap(s=>[snap(s.x0),snap(s.x1)]))].sort((a,b)=>a-b),zs=[...new Set(sources.flatMap(s=>[snap(s.z0),snap(s.z1)]))].sort((a,b)=>a-b),nx=xs.length-1,nz=zs.length-1,grid=new Array(nx*nz),parts=[];
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
      const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;
      let owner=null;for(const s of sources)if(x>s.x0-EPS&&x<s.x1+EPS&&z>s.z0-EPS&&z<s.z1+EPS&&(!owner||s.priority>=owner.priority))owner=s;
      if(!owner)continue;
      const x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1],heights=[owner.height(x0,z0),owner.height(x0,z1),owner.height(x1,z1),owner.height(x1,z0)];
      const p={t:'surfacePatch',x0,x1,z0,z1,heights,skirts:[],col:owner.part.col||[.65,.62,.53],pat:owner.part.pat??3,sidePat:4,noJitter:true,role:owner.role||'paving',owner:sources.indexOf(owner)};
      grid[j*nx+i]={p,owner,i,j};parts.push(p);
    }
    for(const cell of grid){if(!cell)continue;const {p,owner,i,j}=cell,points=[[p.x0,p.z0],[p.x0,p.z1],[p.x1,p.z1],[p.x1,p.z0]],near=[i>0?grid[j*nx+i-1]:null,j+1<nz?grid[(j+1)*nx+i]:null,i+1<nx?grid[j*nx+i+1]:null,j>0?grid[(j-1)*nx+i]:null];
      for(let edge=0;edge<4;edge++){
        const a=points[edge],b=points[(edge+1)%4],ha=p.heights[edge],hb=p.heights[(edge+1)%4],n=near[edge];
        let la=n?n.owner.height(...a):Math.min(ground(...a),ha)-.5,lb=n?n.owner.height(...b):Math.min(ground(...b),hb)-.5,da=ha-la,db=hb-lb;
        if(da<=EPS&&db<=EPS)continue;
        let t0=0,t1=1;if(da<-EPS)t0=da/(da-db);if(db<-EPS)t1=da/(da-db);
        const lo0=la+(lb-la)*t0,lo1=la+(lb-la)*t1;
        p.skirts.push({edge,t0,t1,lo0,lo1});
      }
    }
    // Terrain under paving is fill, not another visible walking surface. A one-cell
    // margin keeps interpolated heightfield triangles below the pavement at edges.
    function terrain(x,z){let y=ground(x,z);for(const s of sources)if(x>=s.x0-.85&&x<=s.x1+.85&&z>=s.z0-.85&&z<=s.z1+.85){const xx=Math.max(s.x0,Math.min(s.x1,x)),zz=Math.max(s.z0,Math.min(s.z1,z));y=Math.min(y,s.height(xx,zz)-.35);}return y;}
    return {parts,sources,terrain};
  }
  return {source,build};
});
