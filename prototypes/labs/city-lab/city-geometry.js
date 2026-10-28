(function(root){
  'use strict';
  const C=typeof module==='object'?require('./city-model.js'):root.CityModel;
  const V=typeof module==='object'?require('../building-lab/voxels.js'):root.BuildingVoxels;
  const P=typeof module==='object'?require('../building-lab/plan.js'):root.BuildingPlan;
  const R=typeof module==='object'?require('../building-lab/renderer.js'):root.BuildingRenderer;
  const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const edgeGrids=new WeakMap(),GRID=12;
  function nearby(city,x,z){let grid=edgeGrids.get(city);if(!grid){grid=new Map();for(const e of city.edges){const a=city.nodes[e.a],b=city.nodes[e.b],r=e.width/2+6;for(let i=Math.floor((Math.min(a.x,b.x)-r)/GRID);i<=Math.floor((Math.max(a.x,b.x)+r)/GRID);i++)for(let j=Math.floor((Math.min(a.z,b.z)-r)/GRID);j<=Math.floor((Math.max(a.z,b.z)+r)/GRID);j++){const k=i+','+j;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(e);}}edgeGrids.set(city,grid);}return grid.get(Math.floor(x/GRID)+','+Math.floor(z/GRID))||[];}
  function model(p,b){const m=identity(),c=b.cell,z=b.origin[2]*c+(b.cityFront||0);m[0]=p.right[0];m[2]=p.right[1];m[8]=p.inward[0];m[10]=p.inward[1];m[12]=p.origin[0]-p.right[0]*b.origin[0]*c-p.inward[0]*z;m[13]=p.padY-b.origin[1]*c;m[14]=p.origin[1]-p.right[1]*b.origin[0]*c-p.inward[1]*z;return m;}
  function roadHeight(city,x,z){let best=Infinity,value=C.height(x,z,city.terrain);for(const e of nearby(city,x,z)){const a=city.nodes[e.a],b=city.nodes[e.b],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz))),dist=Math.hypot(x-a.x-dx*t,z-a.z-dz*t),d=dist-e.width/2;
      if(d<best&&d<5){best=d;const blend=Math.max(0,Math.min(1,(5-d)/3));value=C.height(x,z,city.terrain)*(1-blend)+(a.y+(b.y-a.y)*t)*blend;}}
    const r=Math.hypot(x,z);if(r<city.landmarks.plaza.r+3){const t=Math.max(0,Math.min(1,(r-city.landmarks.plaza.r)/3));value*=t;}return value;}
  function accessPath(city,p){const e=city.edges[p.road],a=city.nodes[e.a],b=city.nodes[e.b],front=p.entry?p.entry.map((v,i)=>v-p.inward[i]*.9):C.point(p,p.width/2,0),dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((front[0]-a.x)*dx+(front[1]-a.z)*dz)/(dx*dx+dz*dz)));return {front,street:[a.x+dx*t,a.z+dz*t],top:p.padY+(p.entry?.0625:.03),bottom:p.roadY+.06};}
  function accessMesh(city,p){const g=builder(city.extent),{front,street,top,bottom}=accessPath(city,p),r=p.right;g.quad([[front[0]-r[0],top,front[1]-r[1]],[front[0]+r[0],top,front[1]+r[1]],[street[0]+r[0],bottom,street[1]+r[1]],[street[0]-r[0],bottom,street[1]-r[1]]],2,V.M.floor_stone);return g.finish('access:'+p.id);}
  function walkHeight(city,x,z,parcels=city.parcels){
    for(const p of parcels){if(C.contains(p.polygon,[x,z]))return p.padY;
      const {front,street,top,bottom}=accessPath(city,p),vx=street[0]-front[0],vz=street[1]-front[1],length=vx*vx+vz*vz;
      if(!length)continue;const u=((x-front[0])*vx+(z-front[1])*vz)/length,side=(x-front[0])*p.right[0]+(z-front[1])*p.right[1];
      if(u>=0&&u<=1&&Math.abs(side)<=1)return top+(bottom-top)*u;
    }return roadHeight(city,x,z);
  }
  function doors(b,leaves){const [X,,Z]=b.dims,verts=[],idx=[],indices=[],materials=[];
    for(const leaf of leaves){const [x0,y0,z0,x1,y1,z1]=leaf.box,n=[x1-x0,y1-y0,z1-z0],vol=new Uint8Array(n[0]*n[1]*n[2]);
      for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){const i=x+X*(z+Z*y),m=b.vol[i];if(m!==b.M.door_wood&&m!==b.M.timber_dark)continue;vol[x-x0+n[0]*(z-z0+n[2]*(y-y0))]=m;indices.push(i);materials.push(m);}
      const mesh=R.meshSegment(vol,n,0,n[1]),base=verts.length/4;for(let i=0;i<mesh.verts.length;i+=4)verts.push(mesh.verts[i]+x0,mesh.verts[i+1]+y0,mesh.verts[i+2]+z0,mesh.verts[i+3]);for(const i of mesh.idx)idx.push(i+base);
    }return {mesh:{verts:Uint16Array.from(verts),idx:Uint32Array.from(idx),quads:idx.length/6},indices:Uint32Array.from(indices),materials:Uint8Array.from(materials),boxes:leaves.map(l=>l.box)};
  }
  function builder(extent,ground=0){const verts=[],idx=[];let quads=0;const offset=32;
    const quad=(points,n,material)=>{const base=verts.length/4;for(const [x,y,z] of points)verts.push(Math.round((x+extent)*16),Math.round((y-ground+offset)*16),Math.round((z+extent)*16),n|(material<<8));idx.push(base,base+1,base+2,base,base+2,base+3);quads++;};
    const box=(x0,y0,z0,x1,y1,z1,m)=>{if(y1<=y0)return;quad([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],2,m);quad([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],0,m);quad([[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0]],1,m);quad([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],4,m);quad([[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]],5,m);};
    return {quad,box,finish(id){const m=identity();m[12]=-extent;m[13]=-offset+ground;m[14]=-extent;return {id,verts:Uint16Array.from(verts),idx:Uint32Array.from(idx),quads,model:m};}};
  }
  function coarseMesh(plan,p,extent,M,size=1){
    if(![.5,1,2].includes(size))throw new Error('Coarse voxel size must be .5, 1 or 2 metres');
    const {w,d,front,masks}=plan.plot,cell=plan.cell,N=masks.length,X=Math.ceil(w*cell/size),Z=Math.ceil(d*cell/size),Y=Math.ceil((N*3+3)/size),vol=new Uint8Array(X*Y*Z),top=masks[N-1],axis=plan.roof.ridge==='frontage'?1:0;
    const coords=top.flatMap((v,i)=>v?[(axis?Math.floor(i/w):i%w)*cell]:[]),lo=Math.min(...coords),hi=Math.max(...coords)+cell,mid=(lo+hi)/2,rise=Math.min(2.3,Math.max(.5,plan.roof.pitch*3));
    for(let z=0;z<Z;z++)for(let x=0;x<X;x++){
      const px=Math.min((x+.5)*size,w*cell-cell/2),pz=Math.min((z+.5)*size,d*cell-cell/2),i=Math.floor(px/cell)+w*Math.floor(pz/cell),roof=N*3+rise*Math.max(0,1-Math.abs((axis?pz:px)-mid)/((hi-lo)/2));
      for(let y=0;y<Y;y++){
        const yc=(y+.5)*size,f=Math.floor(yc/3);let mat=0;
        if(f<N&&masks[f][i])mat=M[f===0?plan.facade.base:plan.facade.wall];
        else if(f===N&&top[i]&&y*size<roof)mat=M[plan.roof.mat];
        else if(f>0&&f<N&&masks[f-1][i]&&yc-f*3<size/2+.2)mat=M[plan.roof.mat];
        vol[x+X*(z+Z*y)]=mat;
      }
    }
    const raw=R.meshSegment(vol,[X,Y,Z],0,Y),g=builder(extent);
    for(let i=0;i<raw.verts.length;i+=16){const pts=[];for(let j=0;j<16;j+=4){const v=i+j,[x,z]=C.point(p,Math.min(raw.verts[v]*size,w*cell),Math.min(raw.verts[v+2]*size,d*cell)-front*cell);pts.push([x,p.padY+raw.verts[v+1]*size,z]);}
      let n=raw.verts[i+3]&255;if(n<2)n=p.right[0]>0?n:1-n;else if(n>=4)n=p.inward[1]>0?n:9-n;g.quad(pts,n,raw.verts[i+3]>>8);
    }
    return {...g.finish('building:'+p.id),voxelSize:size,voxelBytes:vol.byteLength};
  }
  function planMesh(plan,p,extent,M){
    const g=builder(extent,p.padY),{w,d,masks,front,party}=plan.plot,cell=plan.cell,face=plan.facade,roof=plan.roof,
      wall=M[face.wall],timber=M[face.timber],tile=M[roof.mat],base=M[face.base],glass=M.glass;
    const pt=(x,z,y)=>{x=Math.max(party[0]?0:-Infinity,Math.min(party[1]?w:Infinity,x));const [a,b]=C.point(p,x*cell,z*cell-front*cell);return [a,p.padY+y,b];};
    const quad=(coords,n,mat)=>{let normal=n;if(n<2)normal=p.right[0]>0?n:1-n;else if(n>=4)normal=p.inward[1]>0?n:9-n;g.quad(coords.map(([x,z,y])=>pt(x,z,y)),normal,mat);};
    const box=(x0,z0,y0,x1,z1,y1,mat)=>{quad([[x0,z0,y1],[x1,z0,y1],[x1,z1,y1],[x0,z1,y1]],2,mat);quad([[x0,z1,y0],[x1,z1,y0],[x1,z0,y0],[x0,z0,y0]],3,mat);quad([[x0,z0,y0],[x0,z0,y1],[x0,z1,y1],[x0,z1,y0]],1,mat);quad([[x1,z1,y0],[x1,z1,y1],[x1,z0,y1],[x1,z0,y0]],0,mat);quad([[x0,z1,y0],[x0,z1,y1],[x1,z1,y1],[x1,z1,y0]],4,mat);quad([[x1,z0,y0],[x1,z0,y1],[x0,z0,y1],[x0,z0,y0]],5,mat);};
    for(let f=0;f<masks.length;f++){
      const mask=masks[f],y=f*3,topy=y+3;
      for(const [x0,z0,x1,z1] of V.decompose(mask,w,d)){
        const x=x1+1,z=z1+1;
        quad([[x0,z0,topy],[x,z0,topy],[x,z,topy],[x0,z,topy]],2,wall);
        if(f&&!masks[f-1][x0+w*z0])quad([[x0,z0,y],[x0,z,y],[x,z,y],[x,z0,y]],3,timber);
      }
      for(let z=0;z<d;z++)for(let x=0;x<w;x++){
        if(!mask[x+w*z])continue;
        if(x===0||!mask[x-1+w*z])quad([[x,z,y],[x,z,topy],[x,z+1,topy],[x,z+1,y]],1,x===0&&party[0]?wall:x===0&&f===0?base:wall);
        if(x===w-1||!mask[x+1+w*z])quad([[x+1,z+1,y],[x+1,z+1,topy],[x+1,z,topy],[x+1,z,y]],0,x===w-1&&party[1]?wall:x===w-1&&f===0?base:wall);
        if(z===0||!mask[x+w*(z-1)])quad([[x+1,z,y],[x+1,z,topy],[x,z,topy],[x,z,y]],5,f===0?base:wall);
        if(z===d-1||!mask[x+w*(z+1)])quad([[x,z+1,y],[x,z+1,topy],[x+1,z+1,topy],[x+1,z+1,y]],4,f===0?base:wall);
      }
      for(const opening of plan.floors[f].openings){const s=opening.side;if(!['xm','xp','zm','zp'].includes(s)||!['window','small','bay','door','front','back'].includes(opening.kind))continue;
        const zSide=s[0]==='z',sign=s.endsWith('m')?-1:1,along=opening.cells.map(c=>c[zSide?0:1]),fixed=opening.cells[0][zSide?1:0]+(sign>0?1:0),a0=Math.min(...along)+.1,a1=Math.max(...along)+.9,edge=fixed+sign*.25,door=['front','back','door'].includes(opening.kind),bottom=y+(door?.0625:opening.kind==='small'?1.25:.9),top=y+(door?2.3:2.1),point=(a,h)=>zSide?[a,edge,h]:[edge,a,h],n={xm:1,xp:0,zm:5,zp:4}[s];
        quad([point(a0,bottom),point(a1,bottom),point(a1,top),point(a0,top)],n,door?M.door_wood:glass);
        const frame=(l,r,b,t)=>{const e0=Math.min(fixed+sign*.2,fixed+sign*.4),e1=Math.max(fixed+sign*.2,fixed+sign*.4);if(zSide)box(l,e0,b,r,e1,t,timber);else box(e0,l,b,e1,r,t,timber);};
        frame(a0-.15,a0,bottom,top+.1);frame(a1,a1+.15,bottom,top+.1);frame(a0-.15,a1+.15,top,top+.1);if(!door)frame(a0-.15,a1+.15,bottom-.1,bottom);
      }
      for(const span of P.facadeSpans(plan.plot,f,face.bays)){
        const s=span.side,edge=span.fixed+(s==='xp'||s==='zp'?1:0),ptSide=(a,v)=>s[0]==='z'?[a,edge+(s==='zm'?-.25:.25),v]:[edge+(s==='xm'?-.25:.25),a,v],n={xm:1,xp:0,zm:5,zp:4}[s];
        for(const post of span.posts)quad([ptSide(post,y),ptSide(Math.min(span.end,post+.24),y),ptSide(Math.min(span.end,post+.24),topy),ptSide(post,topy)],n,timber);
        for(const v of [y,topy-.12])quad([ptSide(span.start,v),ptSide(span.end,v),ptSide(span.end,v+.12),ptSide(span.start,v+.12)],n,timber);
      }
    }
    const top=masks.length-1,eave=Math.min(.24,roof.eave/2),rise=Math.min(2.3,roof.pitch*3);
    for(let f=0;f<masks.length;f++)for(const [x0,z0,x1,z1] of V.decompose(masks[f].map((v,i)=>v&&!(f<top&&masks[f+1][i])?1:0),w,d)){const x=x1+1,z=z1+1,y=(f+1)*3+.1,ridgeX=roof.ridge==='frontage'||roof.ridge!=='depth'&&x-x0>=z-z0;
      if(f<top){quad([[x0,z0,y+.7],[x,z0,y+.7],[x,z,y],[x0,z,y]],2,tile);continue;}
      if(ridgeX){const mid=(z0+z)/2;
        quad([[x0,z0-eave,y],[x,z0-eave,y],[x,mid,y+rise],[x0,mid,y+rise]],2,tile);
        quad([[x0,mid,y+rise],[x,mid,y+rise],[x,z+eave,y],[x0,z+eave,y]],2,tile);
        for(const [a,n] of [[x0,1],[x,0]])quad([[a,z0,y],[a,z,y],[a,mid,y+rise],[a,mid,y+rise]],n,wall);
      }else{const mid=(x0+x)/2;
        quad([[x0-(party[0]?0:eave),z0,y],[mid,z0,y+rise],[mid,z,y+rise],[x0-(party[0]?0:eave),z,y]],2,tile);
        quad([[mid,z0,y+rise],[x+(party[1]?0:eave),z0,y],[x+(party[1]?0:eave),z,y],[mid,z,y+rise]],2,tile);
        for(const [a,n] of [[z0,5],[z,4]])quad([[x0,a,y],[x,a,y],[mid,a,y+rise],[mid,a,y+rise]],n,wall);
      }
    }
    if(front)for(const x of [1,Math.floor(w/2),w-2]){
      quad([[x,front,2.3],[x+1,front,2.3],[x+1,0,2.92],[x,0,2.92]],3,timber);
    }
    return g.finish('building:'+p.id);
  }
  function surface(city,x,z,M){let road=false,walk=false;for(const e of nearby(city,x,z)){const a=city.nodes[e.a],b=city.nodes[e.b],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz))),d=Math.hypot(x-a.x-dx*t,z-a.z-dz*t);road||=d<=e.width/2;walk||=d<=e.width/2+e.footway;}
    const plaza=C.contains(city.landmarks.plaza.polygon,[x,z]);return plaza?M.floor_stone:road?M.cobble:walk?M.floor_stone:city.green?.keys.has(Math.floor(x*2)+','+Math.floor(z*2))?M.grass:M.earth;
  }
  function environment(city,M){const g=builder(city.extent),E=Math.ceil(Math.max(...city.nodes.map(n=>Math.max(Math.abs(n.x),Math.abs(n.z)))))+4,step=.5;
    // A single classified surface owns roads and junctions: no coplanar grass/road/footway overlays.
    for(let z=-E;z<E;z+=step){let x=-E;while(x<E){const material=surface(city,x+step/2,z+step/2,M),start=x;x+=step;
      if(city.terrain==='flat')while(x<E&&surface(city,x+step/2,z+step/2,M)===material)x+=step;
      const h=(a,b)=>city.terrain==='flat'?0:roadHeight(city,a,b);g.quad([[start,h(start,z),z],[x,h(x,z),z],[x,h(x,z+step),z+step],[start,h(start,z+step),z+step]],2,material);
    }}
    for(const p of city.parcels){const top=p.padY,pts=p.polygon,bottom=Math.min(...pts.map(([x,z])=>C.height(x,z,city.terrain)))-.25;
      g.quad(pts.map(([x,z])=>[x,top,z]),2,M.cobble_dark);for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];g.quad([[a[0],bottom,a[1]],[b[0],bottom,b[1]],[b[0],top,b[1]],[a[0],top,a[1]]],i%2?0:4,M.stone_white);}
      const e=city.edges[p.road],a=city.nodes[e.a],b=city.nodes[e.b],front=C.point(p,p.width/2,0),dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((front[0]-a.x)*dx+(front[1]-a.z)*dz)/(dx*dx+dz*dz))),street=[a.x+dx*t,a.z+dz*t],r=p.right;
      g.quad([[front[0]-r[0],top+.03,front[1]-r[1]],[front[0]+r[0],top+.03,front[1]+r[1]],[street[0]+r[0],p.roadY+.06,street[1]+r[1]],[street[0]-r[0],p.roadY+.06,street[1]-r[1]]],2,M.floor_stone);
    }
    const gate=city.landmarks.gate,gy=C.height(gate.x,gate.z,city.terrain);for(const x of [-10,6])g.box(x,gy,gate.z-3,x+4,gy+10,gate.z+3,M.stone_white);g.box(-10,gy+8,gate.z-2,10,gy+11,gate.z+2,M.stone_white);
    const castle=city.landmarks.castle,cy=C.height(castle.x,castle.z,city.terrain);g.box(-16,cy,castle.z-14,16,cy+13,castle.z+4,M.stone_white);g.box(-5,cy+13,castle.z-10,5,cy+25,castle.z,M.stone_white);for(const x of [-17,12])g.box(x,cy,castle.z-16,x+5,cy+20,castle.z-10,M.stone_white);
    return g.finish('environment');
  }
  function cityVolume(plan,b,exterior){const [X,Y,Z]=b.dims,[MX,Y0,MZ]=b.origin,cv=Math.round(plan.cell/b.cell),{w,d}=plan.plot,vol=b.vol;b.cityFront=plan.plot.front*plan.cell;
    vol.fill(0,0,X*Z*Y0);
    const left=MX-(plan.plot.party[0]?0:4),right=MX+w*cv+(plan.plot.party[1]?0:4),front=MZ-8,back=MZ+d*cv+4;
    for(let y=Y0;y<Y;y++)for(let z=0;z<Z;z++){const row=X*(z+Z*y);if(z<front||z>=back)vol.fill(0,row,row+X);else{vol.fill(0,row,row+left);vol.fill(0,row+right,row+X);}}
    if(exterior){for(let f=0;f<plan.floors.length;f++){const mask=plan.plot.masks[f];for(let z=1;z<d-1;z++)for(let x=1;x<w-1;x++){
      if(!mask[x+w*z]||![-1,0,1].every(dz=>[-1,0,1].every(dx=>mask[x+dx+w*(z+dz)])))continue;
      for(let y=b.levels[f];y<b.levels[f+1];y++)for(let zz=MZ+z*cv;zz<MZ+(z+1)*cv;zz++)vol.fill(b.M[plan.facade.wall],MX+x*cv+X*(zz+Z*y),MX+(x+1)*cv+X*(zz+Z*y));
    }}}
    return b;
  }
  function bounds(mesh,b){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<mesh.verts.length;i+=4)for(let j=0;j<3;j++){const v=(mesh.verts[i+j]-b.origin[j])*b.cell-(j===2?b.cityFront||0:0);lo[j]=Math.min(lo[j],v);hi[j]=Math.max(hi[j],v);}return {lo,hi};}
  function planBounds(mesh,p,extent){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],m=mesh.model;for(let i=0;i<mesh.verts.length;i+=4){const x=mesh.verts[i]/16+(m?.[12]??-extent)-p.origin[0],z=mesh.verts[i+2]/16+(m?.[14]??-extent)-p.origin[1],v=[x*p.right[0]+z*p.right[1],mesh.verts[i+1]/16+(m?.[13]??-32)-p.padY,x*p.inward[0]+z*p.inward[1]];for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],v[j]);hi[j]=Math.max(hi[j],v[j]);}}return {lo,hi};}
  const api={model,environment,roadHeight,walkHeight,accessMesh,doors,cityVolume,bounds,builder,surface,planMesh,coarseMesh,planBounds};if(typeof module==='object'&&module.exports)module.exports=api;else root.CityGeometry=api;
})(typeof globalThis==='object'?globalThis:this);
