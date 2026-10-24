// Castle drafts voxels: turns a model's parts into small voxels in the model's own (rotated) grid, then greedy-meshes
// the surface. Each voxel stores a palette entry (colour, surface pattern, glow); faces of the same entry merge into
// big quads, and the shader adds the per-voxel texture (tone, courses, grain, voxel edges) from the voxel coordinate
// carried on every vertex, so the texture costs no geometry. Parts the voxeliser does not handle (people, water,
// ground) are returned for the ordinary mesher.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CastleVox=factory();})(this,function(){
  'use strict';
  const VOXEL=new Set(['box','gable','hip','cyl','cone','dome','blob','beam','ramp','vdisk']);
  // A part in the model frame F={x,z,rot}: u = local x, v = local z.
  function toLocal(p,F){const c=Math.cos(F.rot),s=Math.sin(F.rot),L=(x,z)=>[(x-F.x)*c+(z-F.z)*s,-(x-F.x)*s+(z-F.z)*c],q={...p};
    if(p.x!=null)[q.x,q.z]=L(p.x,p.z);if(p.x0!=null){[q.x0,q.z0]=L(p.x0,p.z0);[q.x1,q.z1]=L(p.x1,p.z1);}if(p.rot!=null)q.rot=p.rot-F.rot;return q;}
  // Local bounds [x0,y0,z0,x1,y1,z1] of a part (conservative).
  function bounds(p){const B=(x,y,z,rx,ry0,ry1,rz)=>[x-rx,ry0,z-rz,x+rx,ry1,z+rz];
    switch(p.t){
      case 'box':case 'gable':case 'hip':{const r=Math.hypot(p.w,p.d)/2+.3;return B(p.x,0,p.z,r,p.y,p.y+p.h,r);}
      case 'cyl':{const r=Math.max(p.r,p.r2??p.r)+.3;return B(p.x,0,p.z,r,p.y,p.y+p.h,r);}
      case 'cone':return B(p.x,0,p.z,p.r+.3,p.y,p.y+p.h,p.r+.3);
      case 'dome':return B(p.x,0,p.z,p.r+.3,p.y,p.y+p.r,p.r+.3);
      case 'blob':return B(p.x,0,p.z,p.rx+.3,p.y-p.ry-.3,p.y+p.ry+.3,p.rz+.3);
      case 'beam':{const s=(p.s||.18)+.4;return [Math.min(p.x0,p.x1)-s,Math.min(p.y0,p.y1)-s,Math.min(p.z0,p.z1)-s,Math.max(p.x0,p.x1)+s,Math.max(p.y0,p.y1)+s,Math.max(p.z0,p.z1)+s];}
      case 'ramp':{const s=p.w/2+.3;return [Math.min(p.x0,p.x1)-s,p.base??Math.min(p.y0,p.y1)-.6,Math.min(p.z0,p.z1)-s,Math.max(p.x0,p.x1)+s,Math.max(p.y0,p.y1)+.3,Math.max(p.z0,p.z1)+s];}
      case 'vdisk':return B(p.x,0,p.z,p.r+.3,p.y-p.r-.3,p.y+p.r+.3,p.r+.3);}}
  // Inside test at a local point; returns 0 (outside), 1 (inside) or 2 (inside, secondary colour: rose-window glass).
  // Thin parts are thickened to at least one voxel, so beams, frames and sills always land.
  function inside(p,X,Y,Z,vs){const hv=vs*.5;
    switch(p.t){
      case 'box':{if(Y<p.y||Y>p.y+Math.max(p.h,vs))return 0;const c=Math.cos(p.rot||0),s=Math.sin(p.rot||0),dx=X-p.x,dz=Z-p.z,u=dx*c+dz*s,w=-dx*s+dz*c;return Math.abs(u)<=Math.max(p.w/2,hv)&&Math.abs(w)<=Math.max(p.d/2,hv)?1:0;}
      case 'gable':{const t=(Y-p.y)/p.h;if(t<0||t>1)return 0;const c=Math.cos(p.rot||0),s=Math.sin(p.rot||0),dx=X-p.x,dz=Z-p.z,u=dx*c+dz*s,w=-dx*s+dz*c;return Math.abs(u)<=p.w/2&&Math.abs(w)<=Math.max(p.d/2*(1-t),hv*.5)?1:0;}
      case 'hip':{const t=(Y-p.y)/p.h;if(t<0||t>1)return 0;const c=Math.cos(p.rot||0),s=Math.sin(p.rot||0),dx=X-p.x,dz=Z-p.z,u=dx*c+dz*s,w=-dx*s+dz*c,q=p.d/2*(1-t);return Math.abs(w)<=q&&Math.abs(u)<=p.w/2-p.d/2*t?1:0;}
      case 'cyl':{const t=(Y-p.y)/p.h;if(t<0||t>1)return 0;const r=p.r+((p.r2??p.r)-p.r)*t;return Math.hypot(X-p.x,Z-p.z)<=Math.max(r,hv)?1:0;}
      case 'cone':{const t=(Y-p.y)/p.h;if(t<0||t>1)return 0;const r=p.r*(p.inv?t:1-t);return Math.hypot(X-p.x,Z-p.z)<=Math.max(r,t<.98?hv*.7:0)?1:0;}
      case 'dome':{if(Y<p.y)return 0;return Math.hypot(X-p.x,Y-p.y,Z-p.z)<=p.r?1:0;}
      case 'blob':{const a=(X-p.x)/Math.max(p.rx,hv),b=(Y-p.y)/Math.max(p.ry,hv),cc=(Z-p.z)/Math.max(p.rz,hv);return a*a+b*b+cc*cc<=1?1:0;}
      case 'beam':{const dx=p.x1-p.x0,dy=p.y1-p.y0,dz=p.z1-p.z0,L2=dx*dx+dy*dy+dz*dz,t=Math.max(0,Math.min(1,((X-p.x0)*dx+(Y-p.y0)*dy+(Z-p.z0)*dz)/L2));
        return Math.hypot(X-p.x0-dx*t,Y-p.y0-dy*t,Z-p.z0-dz*t)<=Math.max((p.s||.18)/2,hv*.75)?1:0;}
      case 'ramp':{const dx=p.x1-p.x0,dz=p.z1-p.z0,L=Math.hypot(dx,dz)||1,t=((X-p.x0)*dx+(Z-p.z0)*dz)/(L*L);if(t<0||t>1)return 0;const ac=Math.abs((-(X-p.x0)*dz+(Z-p.z0)*dx)/L);if(ac>p.w/2)return 0;
        const top=p.y0+(p.y1-p.y0)*t,bot=p.base??top-.6;return Y<=top&&Y>=Math.min(bot,top-vs)?1:0;}
      case 'vdisk':{const c=Math.cos(p.rot),s=Math.sin(p.rot),dx=X-p.x,dy=Y-p.y,dz=Z-p.z,along=dx*c+dz*s;if(Math.abs(along)>Math.max(.06,hv))return 0;const ac=-dx*s+dz*c,rr=Math.hypot(ac,dy);
        return rr>p.r?0:rr<p.r*.82?2:1;}}
    return 0;}
  // Row fast path: for a voxel row at (Y,Z) running along X, the [x0,x1] span a part covers, or null to fall back to
  // per-cell tests. Axis-aligned boxes and gables (the walls and roofs) and the round parts are exact.
  function rowSpan(p,Y,Z,vs){const hv=vs*.5;
    switch(p.t){
      case 'box':case 'gable':{const c=Math.cos(p.rot||0),s=Math.sin(p.rot||0),al=Math.abs(s)<1e-6,ac=Math.abs(c)<1e-6;if(!al&&!ac)return null;
        let hw=Math.max(p.w/2,hv),hd=Math.max(p.d/2,hv);if(p.t==='box'){if(Y<p.y||Y>p.y+Math.max(p.h,vs))return false;}else{const t=(Y-p.y)/p.h;if(t<0||t>1)return false;hw=p.w/2;hd=Math.max(p.d/2*(1-t),hv*.5);}
        const [ex,ez]=al?[hw,hd]:[hd,hw];if(Math.abs(Z-p.z)>ez)return false;return [p.x-ex,p.x+ex];}
      case 'cyl':case 'cone':{const t=(Y-p.y)/p.h;if(t<0||t>1)return false;const r=Math.max(p.t==='cyl'?p.r+((p.r2??p.r)-p.r)*t:p.r*(p.inv?t:1-t),p.t==='cyl'?hv:t<.98?hv*.7:0),dz=Z-p.z;if(Math.abs(dz)>r)return false;const e=Math.sqrt(r*r-dz*dz);return [p.x-e,p.x+e];}
      case 'dome':{if(Y<p.y)return false;const q=p.r*p.r-(Y-p.y)**2-(Z-p.z)**2;if(q<0)return false;const e=Math.sqrt(q);return [p.x-e,p.x+e];}
      case 'blob':{const b=(Y-p.y)/Math.max(p.ry,hv),cc=(Z-p.z)/Math.max(p.rz,hv),q=1-b*b-cc*cc;if(q<0)return false;const e=Math.sqrt(q)*Math.max(p.rx,hv);return [p.x-e,p.x+e];}}
    return null;}
  // Voxelise parts in frame F at voxel size vs. colourOf(part) -> rgb, patOf(part) -> pattern id.
  // Returns {grid, n:[nx,ny,nz], o:[ox,oy,oz], vs, pal:[{col,pat,glow}], rest:[parts not voxelised]}.
  function voxelize(parts,F,vs,colourOf,patOf){
    const loc=[],rest=[];for(const p of parts){if(VOXEL.has(p.t)&&!(p.t==='ramp'&&p.rail!==false))loc.push(toLocal(p,F));else rest.push(p);}
    if(!loc.length)return {rest};
    let b=[1e9,1e9,1e9,-1e9,-1e9,-1e9];const bb=loc.map(bounds);for(const q of bb)for(let a=0;a<3;a++){b[a]=Math.min(b[a],q[a]);b[a+3]=Math.max(b[a+3],q[a+3]);}
    // Keep the grid under ~2.5 M cells: big models (the cathedral) get coarser voxels.
    const vol=(b[3]-b[0])*(b[4]-b[1])*(b[5]-b[2]);vs=Math.max(vs,Math.cbrt(vol/2.5e6));
    const o=[Math.floor(b[0]/vs)*vs-vs,Math.floor(b[1]/vs)*vs-vs,Math.floor(b[2]/vs)*vs-vs],n=[0,1,2].map(a=>Math.ceil((b[a+3]-o[a])/vs)+2),grid=new Uint8Array(n[0]*n[1]*n[2]);
    const pal=[],key=new Map(),entry=(col,pat,glow)=>{const k=col.map(v=>Math.round(v*255)).join(',')+'|'+pat+'|'+(glow?1:0);let e=key.get(k);if(e==null&&pal.length<254){e=pal.length;key.set(k,e);pal.push({col,pat,glow});}return e??0;};
    loc.forEach((p,pi)=>{const q=bb[pi],e1=entry(colourOf(p),patOf(p),!!p.glow)+1,e2=p.t==='vdisk'?entry(p.col2||[.18,.17,.24],0,false)+1:e1;
      const i0=Math.max(0,Math.floor((q[0]-o[0])/vs)),i1=Math.min(n[0]-1,Math.ceil((q[3]-o[0])/vs)),j0=Math.max(0,Math.floor((q[1]-o[1])/vs)),j1=Math.min(n[1]-1,Math.ceil((q[4]-o[1])/vs)),k0=Math.max(0,Math.floor((q[2]-o[2])/vs)),k1=Math.min(n[2]-1,Math.ceil((q[5]-o[2])/vs));
      for(let k=k0;k<=k1;k++){const Z=o[2]+(k+.5)*vs;for(let j=j0;j<=j1;j++){const Y=o[1]+(j+.5)*vs,row=(k*n[1]+j)*n[0],sp=rowSpan(p,Y,Z,vs);
        if(sp===false)continue;if(sp){const a=Math.max(i0,Math.ceil((sp[0]-o[0])/vs-.5)),b=Math.min(i1,Math.floor((sp[1]-o[0])/vs-.5));if(b>=a)grid.fill(e1,row+a,row+b+1);continue;}
        for(let i=i0;i<=i1;i++){const r=inside(p,o[0]+(i+.5)*vs,Y,Z,vs);if(r)grid[row+i]=r===2?e2:e1;}}}});
    return {grid,n,o,vs,pal,rest};}
  // Greedy-mesh the voxel surface into Mesh m (CastleRender.Mesh), placed by frame F. Every vertex carries its voxel
  // coordinate (the face's own cell on the normal axis, so floor() gives that voxel in the shader).
  const ORD_P=[0,1,2,0,2,3],ORD_N=[0,2,1,0,3,2];
  function meshVox(V,F,m){if(!V.grid)return m;const {grid,n,o,vs,pal}=V,c=Math.cos(F.rot),s=Math.sin(F.rot),at=(i,j,k)=>i<0||j<0||k<0||i>=n[0]||j>=n[1]||k>=n[2]?0:grid[(k*n[1]+j)*n[0]+i];
    const W=(lx,ly,lz)=>[F.x+lx*c-lz*s,ly,F.z+lx*s+lz*c];
    for(let d=0;d<3;d++){const u=(d+1)%3,v=(d+2)%3,x=[0,0,0],q=[0,0,0];q[d]=1;const mask=new Int16Array(n[u]*n[v]);
      const st=[1,n[0],n[0]*n[1]],su=st[u],sv=st[v],sd=st[d],nu=n[u],nv=n[v];
      for(x[d]=-1;x[d]<n[d];){let p=0,any=false;const hasA=x[d]>=0,hasB=x[d]+1<n[d],bd=x[d]*sd;
        for(let jv=0;jv<nv;jv++){let idx=bd+jv*sv;for(let iu=0;iu<nu;iu++,idx+=su){const a=hasA?grid[idx]:0,b=hasB?grid[idx+sd]:0,m2=(a&&!b)?a:(!a&&b)?-b:0;mask[p++]=m2;if(m2)any=true;}}
        x[d]++;p=0;if(!any)continue;
        for(let j=0;j<n[v];j++)for(let i=0;i<n[u];){const e=mask[p];if(!e){i++;p++;continue;}let w=1;while(i+w<n[u]&&mask[p+w]===e)w++;let h=1,done=false;
          while(j+h<n[v]){for(let k=0;k<w;k++)if(mask[p+k+h*n[u]]!==e){done=true;break;}if(done)break;h++;}
          // Quad corners in voxel units: P0, +du, +du+dv, +dv; emitted as two triangles wound to face the normal.
          const sg=e>0?1:-1,pe=pal[Math.abs(e)-1],P=[0,0,0];P[d]=x[d];P[u]=i;P[v]=j;
          const nl=[0,0,0];nl[d]=sg;const nwx=nl[0]*c-nl[2]*s,nwy=nl[1],nwz=nl[0]*s+nl[2]*c,off=sg>0?-.5:.5,glow=pe.glow?2:0,col=pe.col;
          const cu=[0,w,w,0],cv=[0,0,h,h],order=sg>0?ORD_P:ORD_N;
          for(let oi=0;oi<6;oi++){const kq=order[oi],L=[P[0],P[1],P[2]];L[u]+=cu[kq];L[v]+=cv[kq];const lx=o[0]+L[0]*vs,ly=o[1]+L[1]*vs,lz=o[2]+L[2]*vs;
            m.p.push(F.x+lx*c-lz*s,ly,F.z+lx*s+lz*c);m.n.push(nwx,nwy,nwz);m.c.push(col[0],col[1],col[2]);m.f.push(glow);m.t.push(pe.pat);L[d]+=off;m.q.push(L[0],L[1],L[2],vs);}
          m.k.push(m.solid,m.solid);m.id.push(-1,-1);
          for(let l=0;l<h;l++)for(let k=0;k<w;k++)mask[p+k+l*n[u]]=0;i+=w;p+=w;}}}
    return m;}
  // ---- Sparse voxels for ray marching. A coarse grid (cvs, e.g. 25 cm) whose cells are 0 (empty), 1..255 (solid, one
  // palette entry) or 256+b (brick b: SUB^3 fine voxels of cvs/SUB, e.g. 6.25 cm, each 0 or a palette entry). Parts are
  // applied in order: a cell a part fully covers (all nine samples: centre and corners) becomes solid; a cell it only
  // partly covers, or any cell a thin part's bounds touch, gets a brick and is sampled voxel by voxel. Bricks are laid out
  // for a 2D texture 1024 wide: brick b at x = (b%64)*16 + z*4 + x, y = floor(b/64)*4 + y (SUB = 4).
  function voxelizeSparse(parts,F,cvs,colourOf,patOf){const SUB=4;let fvs;
    const loc=[],rest=[];for(const p of parts){if(VOXEL.has(p.t)&&!(p.t==='ramp'&&p.rail!==false))loc.push(toLocal(p,F));else rest.push(p);}
    if(!loc.length)return {rest};
    let b=[1e9,1e9,1e9,-1e9,-1e9,-1e9];const bb=loc.map(bounds);for(const q of bb)for(let a=0;a<3;a++){b[a]=Math.min(b[a],q[a]);b[a+3]=Math.max(b[a+3],q[a+3]);}
    // Huge models (the cathedral) get a coarser grid, so no model exceeds ~1.5 M coarse cells.
    cvs=Math.max(cvs,Math.cbrt((b[3]-b[0])*(b[4]-b[1])*(b[5]-b[2])/1.5e6));const SUBV=4;
    const o=[Math.floor(b[0]/cvs)*cvs-cvs,Math.floor(b[1]/cvs)*cvs-cvs,Math.floor(b[2]/cvs)*cvs-cvs],n=[0,1,2].map(a=>Math.min(1024,Math.ceil((b[a+3]-o[a])/cvs)+2));
    const coarse=new Uint16Array(n[0]*n[1]*n[2]);let bricks=new Uint8Array(64*4096),nb=0;
    const pal=[],key=new Map(),entry=(col,pat,glow)=>{const k=col.map(v=>Math.round(v*255)).join(',')+'|'+pat+'|'+(glow?1:0);let e=key.get(k);if(e==null&&pal.length<255){e=pal.length;key.set(k,e);pal.push({col,pat,glow});}return e??0;};
    const newBrick=fill=>{if(nb>=65279)return -1;if((nb+1)*64>bricks.length){const nbuf=new Uint8Array(bricks.length*2);nbuf.set(bricks);bricks=nbuf;}if(fill)bricks.fill(fill,nb*64,nb*64+64);return nb++;};
    fvs=cvs/SUB;
    // Big axis-aligned boxes (walls, floors, plinths >= 1 m) snap to the coarse grid: they become whole solid cells and
    // need no bricks; their faces still sit within a cell of the design. Detail parts keep fine voxels.
    for(const p of loc)if(p.t==='box'&&Math.min(p.w,p.d,p.h)>=1){const r=((p.rot||0)%(Math.PI/2)+Math.PI/2)%(Math.PI/2);if(r>1e-4&&Math.PI/2-r>1e-4)continue;const sw=Math.abs(Math.sin(p.rot||0))>.5;
      const hw=sw?p.d/2:p.w/2,hd=sw?p.w/2:p.d/2,sn=v=>Math.round((v-o[0])/cvs)*cvs+o[0],snz=v=>Math.round((v-o[2])/cvs)*cvs+o[2],sny=v=>Math.round((v-o[1])/cvs)*cvs+o[1];
      const x0=sn(p.x-hw),x1=sn(p.x+hw),z0=snz(p.z-hd),z1=snz(p.z+hd),y0=sny(p.y),y1=sny(p.y+p.h);Object.assign(p,{x:(x0+x1)/2,z:(z0+z1)/2,w:sw?z1-z0:x1-x0,d:sw?x1-x0:z1-z0,y:y0,h:y1-y0,snapped:true});}
    const C9=[[.5,.5,.5],[.02,.02,.02],[.98,.02,.02],[.02,.98,.02],[.98,.98,.02],[.02,.02,.98],[.98,.02,.98],[.02,.98,.98],[.98,.98,.98]];
    loc.forEach((p,pi)=>{const q=bb[pi],e1=entry(colourOf(p),patOf(p),!!p.glow)+1,e2=p.t==='vdisk'?entry(p.col2||[.18,.17,.24],0,false)+1:e1;
      const ext=[q[3]-q[0],q[4]-q[1],q[5]-q[2]],thin=Math.min(...ext)<cvs*3||p.t==='beam'||p.t==='vdisk';
      const i0=Math.max(0,Math.floor((q[0]-o[0])/cvs)),i1=Math.min(n[0]-1,Math.floor((q[3]-o[0])/cvs)),j0=Math.max(0,Math.floor((q[1]-o[1])/cvs)),j1=Math.min(n[1]-1,Math.floor((q[4]-o[1])/cvs)),k0=Math.max(0,Math.floor((q[2]-o[2])/cvs)),k1=Math.min(n[2]-1,Math.floor((q[5]-o[2])/cvs));
      for(let k=k0;k<=k1;k++)for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const X=o[0]+i*cvs,Y=o[1]+j*cvs,Z=o[2]+k*cvs,ci=(k*n[1]+j)*n[0]+i;let cnt=0,first=0;
        for(const [a,bq,c] of C9){const r=inside(p,X+a*cvs,Y+bq*cvs,Z+c*cvs,fvs);if(r){cnt++;if(!first)first=r;}}
        if(cnt===9&&p.t!=='vdisk'){coarse[ci]=e1;continue;}
        // Thin parts: skip cells the part does not come near (its centre test with the part thickened to the cell).
        if(cnt===0&&(!thin||!inside(p,X+cvs*.5,Y+cvs*.5,Z+cvs*.5,cvs*2.2)))continue;
        let cv=coarse[ci],br;if(cv>=256)br=cv-256;else{br=newBrick(cv);if(br<0){if(cnt)coarse[ci]=e1;continue;}coarse[ci]=256+br;}
        const base=br*64;for(let fz=0;fz<4;fz++)for(let fy=0;fy<4;fy++)for(let fx=0;fx<4;fx++){const r=inside(p,X+(fx+.5)*fvs,Y+(fy+.5)*fvs,Z+(fz+.5)*fvs,fvs);if(r)bricks[base+(fz*4+fy)*4+fx]=r===2?e2:e1;}}});
    // Tidy: bricks that came out empty or all one entry go back to plain cells.
    for(let ci=0;ci<coarse.length;ci++){const cv=coarse[ci];if(cv<256)continue;const base=(cv-256)*64,v0=bricks[base];let same=true;for(let t=1;t<64;t++)if(bricks[base+t]!==v0){same=false;break;}if(same)coarse[ci]=v0;}
    // Compact: renumber the bricks still in use, then lay them out for the texture.
    const remap=new Int32Array(nb).fill(-1);let used=0;for(let ci=0;ci<coarse.length;ci++){const cv=coarse[ci];if(cv<256)continue;const ob=cv-256;if(remap[ob]<0)remap[ob]=used++;coarse[ci]=256+remap[ob];}
    const rows=Math.max(1,Math.ceil(used/64))*4,tex=new Uint8Array(1024*rows);
    for(let ob=0;ob<nb;ob++){const bi=remap[ob];if(bi<0)continue;const bx=(bi%64)*16,by=Math.floor(bi/64)*4,base=ob*64;for(let fz=0;fz<4;fz++)for(let fy=0;fy<4;fy++)for(let fx=0;fx<4;fx++)tex[(by+fy)*1024+bx+fz*4+fx]=bricks[base+(fz*4+fy)*4+fx];}
    const palTex=new Uint8Array(256*4);pal.forEach((e,i)=>{palTex[i*4]=Math.round(e.col[0]*255);palTex[i*4+1]=Math.round(e.col[1]*255);palTex[i*4+2]=Math.round(e.col[2]*255);palTex[i*4+3]=(e.pat&63)|(e.glow?128:0);});
    return {coarse,n,o,cvs,sub:SUB,bricks:tex,brickRows:rows,nb:used,pal:palTex,rest};}
  return {voxelize,meshVox,voxelizeSparse};
});
