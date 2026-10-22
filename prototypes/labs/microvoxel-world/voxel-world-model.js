(function(root){
  'use strict';
  const CELL=.25,CHUNK=32,HEIGHT=96,STREAM_HEIGHT=1024,EXTENT=128,REVISION='micro-catchment-1';
  const MAT=Object.freeze({air:0,basalt:1,soil:2,grass:3,sand:4,bark:5,leaf:6,water:7,ore:8,flower:9,snow:16,needle:17,dry:18,crystal:19,moss:20,ice:21,stone:22,redwood:23,foam:24,sandstone:25});
  const COLORS=Object.freeze(['#000000','#717d91','#72614e','#85a96b','#c1b993','#665145','#426c57','#488f9b','#d6a85e','#e6baac','#dfac5c','#edcfad','#33434c','#a0c7c0','#ede7d4','#273b41','#eef2f2','#2e4c3c','#b5a067','#c9b2ff','#8a86c8','#bcdde6','#a9a596','#8b4a35','#f4fbfb','#c58a5c']);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function hash(x,z,seed=0){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^(seed|0);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
  function noise(x,z,seed){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);const a=hash(ix,iz,seed),b=hash(ix+1,iz,seed),c=hash(ix,iz+1,seed),d=hash(ix+1,iz+1,seed);return (a+(b-a)*sx)*(1-sz)+(c+(d-c)*sx)*sz;}
  const riverX=z=>78+9*Math.sin(z*.046)+3*Math.sin(z*.11);
  const SHADE=128,MAX_CHUNK=16777215,CHUNK_METRES=CELL*CHUNK;
  function movePosition(position,dx=0,dz=0){
    if(![position.cx,position.cz].every(n=>Number.isInteger(n)&&Math.abs(n)<=MAX_CHUNK)||![position.x,position.z,dx,dz].every(Number.isFinite))throw new Error('Valid chunk/local coordinates required');
    const result={};
    for(const [axis,delta] of [['x',dx],['z',dz]]){
      const local=position[axis]+delta,shift=Math.floor(local/CHUNK_METRES),chunk=position['c'+axis]+shift;
      result['c'+axis]=clamp(chunk,-MAX_CHUNK,MAX_CHUNK);
      result[axis]=chunk< -MAX_CHUNK?0:chunk>MAX_CHUNK?CHUNK_METRES-1/1024:local-shift*CHUNK_METRES;
    }
    return result;
  }
  const positionAt=(x,z)=>movePosition({cx:0,cz:0,x:0,z:0},x,z);
  function createWorld(seed=2718,cellMetres=CELL,extent=EXTENT){
    if(![CELL,CELL/2].includes(cellMetres))throw new Error('Cell size must be 0.25 or 0.125 metres');
    if(![EXTENT,EXTENT*2,'infinite'].includes(extent))throw new Error('World extent must be 128, 256 or infinite');
    const infinite=extent==='infinite',revision=infinite?'micro-wilds-7':REVISION;
    const density=CELL/cellMetres,chunkCells=CHUNK*density,heightCells=(infinite?STREAM_HEIGHT:HEIGHT)*density;
    seed=Number(seed)>>>0;
    const massifAngle=hash(seed,7,seed+241)*Math.PI*2,massifX=Math.cos(massifAngle)*70,massifZ=Math.sin(massifAngle)*70;
    const gorgeX=-Math.cos(massifAngle)*58,gorgeZ=-Math.sin(massifAngle)*58,gorgeDX=-Math.sin(massifAngle),gorgeDZ=Math.cos(massifAngle);
    const id=`${infinite?'wilds':'catchment'}:${revision}:${seed}`,trees=new Map();
    // Streamed geography is a pure function of (seed, x, z): plates → relief → climate → biome. Nothing is stored.
    const PLATE=640,SEA=14,W=160;
    const sites=new Map();
    function site(i,j){
      const k=i*1048576+j;let s=sites.get(k);if(s)return s;
      const a=hash(i,j,seed+307)*Math.PI*2,v=.4+.6*hash(i,j,seed+309);
      s={i,j,x:(i-.35+.7*hash(i,j,seed+301))*PLATE,z:(j-.35+.7*hash(i,j,seed+303))*PLATE,continental:i===0&&j===0||hash(i,j,seed+305)<.62,vx:Math.cos(a)*v,vz:Math.sin(a)*v};
      sites.set(k,s);if(sites.size>4096)sites.delete(sites.keys().next().value);return s;
    }
    // The nearest plates and their distances; boundaries are evaluated pairwise so relief is continuous everywhere.
    // Returns a shared scratch list (valid until the next call): plateRelief reads it before anything calls plates again.
    // Stable insertion sort, so ties keep the same order a stable sort would give.
    const nearP=new Array(9),nearD=new Float64Array(9),near5=Array.from({length:5},()=>({p:null,D:0}));
    function plates(x,z){
      const wx=x+(noise(x*.002,z*.002,seed+311)-.5)*180,wz=z+(noise(x*.002,z*.002,seed+313)-.5)*180;
      const ci=Math.floor(wx/PLATE+.5),cj=Math.floor(wz/PLATE+.5);let n=0;
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
        const p=site(ci+di,cj+dj),D=Math.hypot(wx-p.x,wz-p.z);let k=n++;
        while(k>0&&nearD[k-1]>D){nearD[k]=nearD[k-1];nearP[k]=nearP[k-1];k--;}nearD[k]=D;nearP[k]=p;
      }
      for(let i=0;i<5;i++){near5[i].p=nearP[i];near5[i].D=nearD[i];}
      return near5;
    }
    const ridged=(x,z,k)=>1-Math.abs(noise(x,z,k)-.5)*2;
    // Plate relief: crust level, shelves, collision/subduction ranges, arcs, rifts. Used by columns and, unblended, by climate.
    function plateRelief(x,z){
      const near=plates(x,z),open=clamp((130-Math.hypot(x,z))/60,0,1),D0=near[0].D;
      const level=p=>p.continental?20+(noise(x*.004,z*.004,seed+317)-.5)*12+(noise(x*.011,z*.011,seed+319)-.5)*5:4+noise(x*.006,z*.006,seed+321)*3;
      const r=ridged(x*.011,z*.011,seed+323)*.65+ridged(x*.029,z*.029,seed+325)*.35;
      let base=0,sum=0;for(const {p,D} of near){const k=Math.exp(-(D-D0)/45);base+=level(p)*k;sum+=k;}base/=sum;
      let up=0,down=0,best=null,shearF=0;
      for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){
        const P=near[i],Q=near[j],third=near.reduce((m,o,k)=>k===i||k===j?m:Math.min(m,o.D),Infinity),w=clamp((third-Q.D)/180,0,1);if(!w)continue;
        const a=P.p,b=Q.p,ex=b.x-a.x,ez=b.z-a.z,len=Math.hypot(ex,ez),nx=ex/len,nz=ez/len,rx=a.vx-b.vx,rz=a.vz-b.vz;
        // Belt coordinates use one orientation per plate pair (by plate index), so they don't flip where the nearer plate changes.
        const o=a.i<b.i||a.i===b.i&&a.j<b.j?1:-1,u=o*(z*nx-x*nz),s=o*(x*nx+z*nz),belt=(ridged(u*.003,s*.009,seed+329)*.6+ridged(u*.008,s*.02,seed+330)*.4)*.7+r*.3,peaks=.5+.8*noise(u*.004,len*.01,seed+332);
        const conv=rx*nx+rz*nz,shear=Math.abs(rz*nx-rx*nz),edge=(Q.D**2-P.D**2)/(2*len),f=clamp(1-edge/W,0,1),c=clamp(conv/1.1,0,1);
        // Distance from the boundary measured into the continental side (negative offshore) for ocean–continent margins.
        const land=a.continental?edge:-edge;let v=0,setting=null;
        if(conv>.2){
          if(a.continental&&b.continental){v=c*(150*f**1.6*(.3+.7*belt)*peaks+14*clamp(1-edge/(W*2.2),0,1));setting='collision';}
          else if(a.continental!==b.continental){v=land>0?c*105*Math.exp(-(((land-95)/60)**2))*clamp(land/30,0,1)*(.35+.65*belt)*peaks:-9*c*Math.exp(-(((land+40)/30)**2))*clamp(-land/20,0,1);setting=land>0?'subduction':'trench';}
          else{v=c*f*clamp((noise(x*.009,z*.009,seed+327)-.55)/.12,0,1)*40*(.5+.5*r);setting='arc';}
        }else if(conv<-.45){v=a.continental&&b.continental?-8*f**1.5*clamp(-conv/1.1,0,1):3*f;setting='rift';}
        else if(shear>.6)shearF=Math.max(shearF,f*w);
        v*=w;if(v>0)up=Math.max(up,v);else down=Math.min(down,v);
        if(setting&&(!best||Math.abs(v)>best.v))best={v:Math.abs(v),setting,f:f*w};
      }
      let relief=(up+down)*(1-open*.85),setting='craton',f=0;
      if(best&&best.v>1){setting=best.setting;f=best.f;}else if(shearF>.4){setting='transform';f=shearF;}
      let h=base+relief;if(open)h+=open*Math.max(0,SEA+4-h);
      if(h<SEA)setting=h>SEA-6?'shelf':'ocean';
      return {h,base:base+(relief<0?relief:0),relief,setting,f,cone:0};
    }
    // Stratovolcanoes on the land side of subduction margins and in island arcs: one candidate per 700 m cell, a smooth
    // cone 110-190 m high with a summit crater. They are part of plate relief, so rivers route around them and they cast
    // rain shadows; tall cones on high ground are capped softly below the column ceiling.
    const VG=700,volcanoes=new Map();
    function volcanoCell(i,j){
      const k=i*65536+j;if(volcanoes.has(k))return volcanoes.get(k);let v=null;
      if(hash(i,j,seed+421)<.55){
        const x=(i+.25+.5*hash(i,j,seed+423))*VG,z=(j+.25+.5*hash(i,j,seed+425))*VG;
        if(Math.hypot(x,z)>400){const p=plateRelief(x,z);if((p.setting==='subduction'||p.setting==='arc')&&p.h>SEA){const H=110+80*hash(i,j,seed+427);v={x,z,H,R:H*2.6};}}
      }
      volcanoes.set(k,v);if(volcanoes.size>4096)volcanoes.delete(volcanoes.keys().next().value);return v;
    }
    function tectonics(x,z){
      const t=plateRelief(x,z),i=Math.floor(x/VG),j=Math.floor(z/VG);let cone=0,vx=0,vz=0;
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
        const V=volcanoCell(i+di,j+dj);if(!V)continue;const d=Math.hypot(x-V.x,z-V.z);if(d>=V.R)continue;
        let c=V.H*(1-d/V.R)**1.8;const crater=V.R*.05;if(d<crater)c-=V.H*.06*(1-d/crater);if(c>cone){cone=c;vx=V.x;vz=V.z;}
      }
      if(!cone)return t;
      let h=t.h+cone;if(h>215)h=215+(h-215)*.3;
      return {...t,h,cone:h-t.h,vx,vz};
    }
    // Climate on a 32 m grid: latitude temperature, banded prevailing winds, moisture carried from sea and rained out on rising ground.
    const latAngle=hash(seed,13,seed+331)*Math.PI*2,latCos=Math.cos(latAngle),latSin=Math.sin(latAngle),lat0=18+hash(seed,17,seed+333)*34,twist=(hash(seed,19,seed+335)-.5)*.8;
    const climateCells=new Map(),CG=32;
    function latitude(x,z){return lat0+(x*latCos+z*latSin)/110;}
    function wind(lat){const L=Math.abs(lat),dir=L<30||L>60?-1:1,t=twist;return {x:dir*(-latSin*Math.cos(t)-latCos*Math.sin(t)),z:dir*(latCos*Math.cos(t)-latSin*Math.sin(t))};}
    function climateCell(i,j){
      const k=i*16777216+j;let v=climateCells.get(k);if(v)return v;
      const x=i*CG,z=j*CG,lat=latitude(x,z),w=wind(lat);let m=.55,prev=null,lift=0;
      for(let s=10;s>=0;s--){const e=tectonics(x-w.x*48*s,z-w.z*48*s).h;if(e<SEA)m=1;else{if(prev!==null){const rise=Math.max(0,e-Math.max(prev,SEA));const rain=Math.min(m*.7,rise*.018);m-=rain;if(s<=1)lift+=rise;}m=m*.99+.003;}prev=e;}
      const here=tectonics(x,z).h,T=30-.5*Math.abs(lat)+(noise(x*.003,z*.003,seed+337)-.5)*6-.17*Math.max(0,here-SEA);
      v={T,M:clamp(m*.85+lift*.02+(noise(x*.005,z*.005,seed+339)-.5)*.2,0,1)};climateCells.set(k,v);if(climateCells.size>8192)climateCells.delete(climateCells.keys().next().value);return v;
    }
    function climate(x,z){
      const gx=x/CG,gz=z/CG,i=Math.floor(gx),j=Math.floor(gz),u=gx-i,w=gz-j,a=climateCell(i,j),b=climateCell(i+1,j),c=climateCell(i,j+1),d=climateCell(i+1,j+1),mix=k=>(a[k]+(b[k]-a[k])*u)*(1-w)+(c[k]+(d[k]-c[k])*u)*w;
      return {T:mix('T'),M:mix('M')};
    }
    // Mountains zone by temperature: montane conifer forest, subalpine parkland, alpine meadow, then snow on all but cliffs.
    function biomeOf(T,M,h,wet,steep,cliff,mountain,sheer=cliff){
      if(h<SEA)return 'sea';
      if(mountain&&h>=SEA+1.2){
        if(T<-3&&!sheer)return 'snow';
        if(cliff&&T<2)return 'alpine';
        if(T<-1)return 'meadow';
        if(T<1.5)return 'subalpine';
        if(T<16&&M>.15&&!(wet&&M>.5))return 'montane';
      }
      if(T<-5&&!cliff)return 'snow';
      if(steep&&T<3)return 'alpine';
      if(h<SEA+1.2)return T<0?'tundra':'beach';
      if(wet&&M>.5&&T>0&&!steep)return 'wetland';
      if(T<1)return 'tundra';
      if(T<7)return M>.38?'boreal':'tundra';
      if(T<19)return M>.5?'forest':M>.24?'grassland':'desert';
      return M>.66?'rainforest':M>.34?'savanna':'desert';
    }
    const TREES={rainforest:.92,forest:.82,montane:.86,boreal:.78,subalpine:.3,meadow:.02,wetland:.3,savanna:.12,grassland:.06,tundra:.03};
    // Home massif: stepped plateau walled by vertical 4.5 m tiers; inside notch zones the same uplift is a climbable ramp (a pass).
    function massifDistance(x,z){
      const dx=x-massifX,dz=z-massifZ,along=-dx*Math.sin(massifAngle)+dz*Math.cos(massifAngle),across=dx*Math.cos(massifAngle)+dz*Math.sin(massifAngle);
      return Math.hypot(along/1.9,across*1.15)+(noise(x*.03,z*.03,seed+245)-.5)*10;
    }
    function upliftAt(x,z){
      const dm=massifDistance(x,z);if(dm>46)return {lift:0,pass:false,up:0};
      const lift=clamp(1.6-dm/28,0,1),pass=lift>0&&noise(x*.025,z*.025,seed+223)<.24+clamp(.15-lift,0,.15);
      return {lift,pass,up:lift>0?pass?lift*9:4.5*Math.min(2,Math.floor(lift*2)+1):0};
    }
    // Where a tier boundary meets a pass or contour tip, a raised strip one or two voxels wide would stand alone; such strips take the higher of their lower neighbours.
    function liftAt(x,z){
      const c=upliftAt(x,z);if(!c.up)return c;
      const d=cellMetres,at=k=>k.map(([u,v])=>upliftAt(x+u,z+v)),low=n=>n.up<c.up-1.5,top=(a,b)=>a.up>=b.up?a:b;
      let best=null;
      for(const [u,v] of [[d,0],[0,d]]){
        const [m,p]=at([[-u,-v],[u,v]]);let n=null;
        if(low(m)&&low(p))n=top(m,p);
        else if(low(m)){const [p2]=at([[2*u,2*v]]);if(low(p2))n=top(m,p2);}
        else if(low(p)){const [m2]=at([[-2*u,-2*v]]);if(low(m2))n=top(m2,p);}
        if(n&&(!best||n.up>best.up))best=n;
      }
      return best||c;
    }
    // Drainage on a jittered 64 m node grid, computed per 2 km tile with a 1 km margin: priority-flood fills pits (lakes),
    // every node drains to one neighbour, and upstream node counts give river size. Rivers are cut into the final terrain.
    const RG=64,RT=32,RM=16,RW=RT+2*RM,RIVER=20,riverTiles=new Map(),N8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    function riverTile(ti,tj){
      const key=ti*65536+tj;let T=riverTiles.get(key);if(T)return T;
      const i0=ti*RT-RM,j0=tj*RT-RM,n=RW*RW,rel=new Float32Array(n),px=new Float32Array(n),pz=new Float32Array(n),h=new Float32Array(n),fill=new Float32Array(n),down=new Int32Array(n).fill(-1),acc=new Float32Array(n),done=new Uint8Array(n),order=new Int32Array(n);
      for(let j=0;j<RW;j++)for(let i=0;i<RW;i++){const k=j*RW+i,gi=i0+i,gj=j0+j;px[k]=(gi+.2+.6*hash(gi,gj,seed+341))*RG;pz[k]=(gj+.2+.6*hash(gi,gj,seed+343))*RG;const t=tectonics(px[k],pz[k]);h[k]=t.h+upliftAt(px[k],pz[k]).up;rel[k]=Math.max(t.relief,t.cone);}
      const hk=new Float64Array(n),hv=new Int32Array(n);let hn=0,on=0;
      const push=(e,k)=>{let c=hn++;while(c>0){const q=(c-1)>>1;if(hk[q]<=e)break;hk[c]=hk[q];hv[c]=hv[q];c=q;}hk[c]=e;hv[c]=k;};
      const pop=()=>{const k=hv[0],e=hk[--hn],v=hv[hn];let c=0;for(;;){let l=2*c+1;if(l>=hn)break;if(l+1<hn&&hk[l+1]<hk[l])l++;if(hk[l]>=e)break;hk[c]=hk[l];hv[c]=hv[l];c=l;}hk[c]=e;hv[c]=v;return k;};
      for(let k=0;k<n;k++){const i=k%RW,j=(k/RW)|0;if(i===0||j===0||i===RW-1||j===RW-1||h[k]<SEA){done[k]=1;fill[k]=h[k];push(h[k],k);}}
      while(hn){const c=pop(),ci=c%RW,cj=(c/RW)|0;order[on++]=c;for(const [di,dj] of N8){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=RW||j>=RW)continue;const k=j*RW+i;if(done[k])continue;done[k]=1;fill[k]=Math.max(h[k],fill[c]+.01);down[k]=c;push(fill[k],k);}}
      for(let o=on-1;o>=0;o--){const c=order[o];acc[c]+=1;if(down[c]>=0)acc[down[c]]+=acc[c];}
      T={i0,j0,px,pz,h,fill,down,acc,rel};riverTiles.set(key,T);if(riverTiles.size>24)riverTiles.delete(riverTiles.keys().next().value);return T;
    }
    function riverAt(x,z){
      const wx=x+(noise(x*.02,z*.02,seed+345)-.5)*14,wz=z+(noise(x*.02,z*.02,seed+347)-.5)*14,ii=Math.floor(wx/RG),jj=Math.floor(wz/RG);
      let d=999,level=0,lake=0,foam=false,tk=NaN,T=null;const riverWidth={d:999,w:0};
      for(let gj=jj-2;gj<=jj+2;gj++)for(let gi=ii-2;gi<=ii+2;gi++){
        const ti=Math.floor(gi/RT),tj=Math.floor(gj/RT);if(ti*65536+tj!==tk){tk=ti*65536+tj;T=riverTile(ti,tj);}
        const a=(gj-T.j0)*RW+(gi-T.i0),ax=T.px[a],az=T.pz[a];
        if(T.fill[a]-T.h[a]>.6&&Math.hypot(wx-ax,wz-az)<RG*.9)lake=Math.max(lake,T.fill[a]);
        // Mountain belts start headwater streams from small catchments, so ranges carry streams (and their falls).
        const need=T.rel[a]>15?3:RIVER,b=T.down[a];if(b<0||T.acc[a]<need||T.h[a]<SEA)continue;
        // Rounded course: quadratic curve from the A–B midpoint through B to the B–C midpoint, plus the head piece near sources.
        const c=T.down[b],bx=T.px[b],bz=T.pz[b],cx=c<0?bx:(bx+T.px[c])/2,cz=c<0?bz:(bz+T.pz[c])/2,fc=c<0?T.fill[b]:(T.fill[b]+T.fill[c])/2;
        const hw=Math.min(9,1.2+.35*Math.sqrt(T.acc[a]));
        // Every piece of this course lies inside the box of A, B and the B-C midpoint: if even the box is no closer than the
        // best course so far, this node cannot change the result.
        {const ox=wx<Math.min(ax,bx,cx)?Math.min(ax,bx,cx)-wx:wx>Math.max(ax,bx,cx)?wx-Math.max(ax,bx,cx):0,oz=wz<Math.min(az,bz,cz)?Math.min(az,bz,cz)-wz:wz>Math.max(az,bz,cz)?wz-Math.max(az,bz,cz):0;if(Math.hypot(ox,oz)-hw+2.3>=d)continue;}
        const mx=(ax+bx)/2,mz=(az+bz)/2,fm=(T.fill[a]+T.fill[b])/2;
        // A piece steeper than 8% holds its level and drops in falls of about 4 m (a waterfall face across the river).
        const piece=(x0,z0,f0,x1,z1,f1)=>{const ex=x1-x0,ez=z1-z0,t=clamp(((wx-x0)*ex+(wz-z0)*ez)/(ex*ex+ez*ez||1),0,1),e=Math.hypot(wx-x0-ex*t,wz-z0-ez*t)-hw+2.3;if(e<d){
          d=e;const len=Math.hypot(ex,ez)||1,drop=f0-f1;let u=t;foam=false;
          if(drop/len>.08&&f1>SEA+1){const k=Math.max(1,Math.round(drop/4)),q=t*k+.5,step=Math.floor(q);u=Math.min(1,step/k);foam=step>0&&step<=k&&(q-step)*len/k<2.5;}
          level=f0+(f1-f0)*u;}};
        if(T.acc[a]<need*2)piece(ax,az,T.fill[a],mx,mz,fm);
        let px0=mx,pz0=mz,pf0=fm;
        for(let k=1;k<=4;k++){const t=k/4,u=1-t,qx=u*u*mx+2*u*t*bx+t*t*cx,qz=u*u*mz+2*u*t*bz+t*t*cz,qf=u*u*fm+2*u*t*T.fill[b]+t*t*fc;piece(px0,pz0,pf0,qx,qz,qf);px0=qx;pz0=qz;pf0=qf;}
        if(d<riverWidth.d)riverWidth.d=d,riverWidth.w=hw;
      }
      return {d,level,lake,w:riverWidth.w,foam};
    }
    // Mountain detail on top of plate relief: squared ridged noise gives sharp arêtes and summits, scaled by how much the plates lift here.
    // Domain-warped so ridgelines wander, and modulated by a broad field so peaks cluster into massifs between lower cols.
    function cragAt(x,z,relief){
      const m=clamp((relief-6)/50,0,1);if(!m)return 0;
      const wx=x+(noise(x*.012,z*.012,seed+355)-.5)*40,wz=z+(noise(x*.012,z*.012,seed+357)-.5)*40,massif=.55+.45*ridged(x*.006,z*.006,seed+359);
      return relief*.36*m*massif*(ridged(wx*.021,wz*.021,seed+351)**2*.75+ridged(wx*.053,wz*.053,seed+353)**3*.25);
    }
    // Basalt outcrops: small scattered knolls (one candidate per 36 m cell, 2-4.5 m across), never broad sheets of rock.
    // They gather below the home massif's cliffs, where fallen blocks would lie.
    function outcropAt(x,z){
      const G=36,i=Math.floor(x/G),j=Math.floor(z/G),cx=(i+.25+.5*hash(i,j,seed+363))*G,cz=(j+.25+.5*hash(i,j,seed+367))*G;
      if(hash(i,j,seed+361)>(massifDistance(cx,cz)<70?.9:.4))return 0;
      const r=2+2.5*hash(i,j,seed+365),d=Math.hypot(x-cx,z-cz)+(noise(x*.4,z*.4,seed+369)-.5)*1.6;
      return d<r?1-d/r:0;
    }
    // Sky isles: aether-lifted rock, one candidate per 120 m cell, commoner over mountain belts. Not ground: crew walk beneath them.
    const IG=120,isles=new Map();
    function isleCell(i,j){
      const k=i*65536+j;if(isles.has(k))return isles.get(k);
      let v=null;const p=hash(i,j,seed+371);
      if(p<.45){
        const x=(i+.3+.4*hash(i,j,seed+373))*IG,z=(j+.3+.4*hash(i,j,seed+375))*IG,t=tectonics(x,z);
        if(p<(t.relief>20?.45:.16)&&Math.hypot(x,z)>90){
          // Hover clear of the highest ground beneath the whole slab.
          const r=8+13*hash(i,j,seed+377);let under=SEA;
          for(const [u,v] of [[0,0],[r,0],[-r,0],[0,r],[0,-r],[.7*r,.7*r],[-.7*r,.7*r],[.7*r,-.7*r],[-.7*r,-.7*r]]){const q=tectonics(x+u,z+v);under=Math.max(under,q.h+cragAt(x+u,z+v,q.relief)+12);}
          const top=Math.min(heightCells*cellMetres-14,under+22+30*hash(i,j,seed+379));
          v={x,z,r,top,cold:climate(x,z).T-.17*Math.max(0,top-t.h)<-5,fall:null};
          // About 40% of isles spill a thin waterfall from under the rim (the outermost point still on the slab).
          if(hash(i,j,seed+387)<.4)for(let n=0,a=hash(i,j,seed+389)*Math.PI*2;n<12&&!v.fall;n++,a+=.52)for(const f of [.88,.8,.7]){const fx=x+Math.cos(a)*r*f,fz=z+Math.sin(a)*r*f,S=isleShape(v,fx,fz);if(S){v.fall={x:fx,z:fz,bottom:S.bottom};break;}}
        }
      }
      isles.set(k,v);if(isles.size>4096)isles.delete(isles.keys().next().value);return v;
    }
    // Floating slab at (x,z): {bottom, top} in metres, with a glowing crystal keel under its centre.
    function isleAt(x,z){const I=isleCell(Math.floor(x/IG),Math.floor(z/IG));return I?isleShape(I,x,z):null;}
    function isleShape(I,x,z){
      const d=Math.hypot(x-I.x,z-I.z)/I.r+(noise(x*.06,z*.06,seed+381)-.5)*.55+(noise(x*.2,z*.2,seed+385)-.5)*.12;if(d>=1)return null;
      const top=I.top+(1-d*d)*2.5,bottom=top-2-I.r*(.12+1.1*(1-d)**1.3)*(.75+.5*noise(x*.15,z*.15,seed+383));
      return {top,bottom,keel:d<.14?bottom-3*(1-d/.14):bottom,cold:I.cold};
    }
    // Aether crystal spires: leaning, tapering violet pillars in clusters, mostly in mountains and along gorges, rarely in the lowlands.
    const SG=44,spireCells=new Map();
    function spireCell(i,j){
      const k=i*65536+j;if(spireCells.has(k))return spireCells.get(k);
      let v=null;const p=hash(i,j,seed+391);
      if(p<.4){
        const x=(i+.3+.4*hash(i,j,seed+393))*SG,z=(j+.3+.4*hash(i,j,seed+395))*SG,g=geography(x,z);
        if(!g.sea&&!g.wet&&!g.highland&&Math.hypot(x,z)>40&&p<(g.gorgeDistance<24?.4:g.relief>20?.2:.02)){
          const n=3+Math.floor(hash(i,j,seed+397)*5),list=[];
          for(let s=0;s<n;s++){
            const a=hash(s,k,seed+399)*Math.PI*2,o=s?1.5+4*hash(s,k,seed+401):0,sx=x+Math.cos(a)*o,sz=z+Math.sin(a)*o,lean=.08+.14*hash(s,k,seed+403);
            list.push({x:sx,z:sz,lx:Math.cos(a)*lean,lz:Math.sin(a)*lean,r:(s?.5:1.1)+.6*hash(s,k,seed+405),h:(s?4:10)+(s?7:6)*hash(s,k,seed+407),base:geography(sx,sz).height*cellMetres-.5});
          }
          v={x,z,list,top:Math.max(...list.map(s=>s.base+s.h))};
        }
      }
      spireCells.set(k,v);if(spireCells.size>4096)spireCells.delete(spireCells.keys().next().value);return v;
    }
    const spiresNear=(x,z)=>spireCell(Math.floor(x/SG),Math.floor(z/SG));
    // Ancient trees: rare giants, one candidate per 96 m cell in forest. Broadleaf giants (buttressed trunk, lumpy crown
    // ~25 m across) in temperate/tropical forest; sequoia-like conifers (red trunk, narrow cone) in montane/boreal forest.
    const AG=96,ancients=new Map();
    function ancientCell(i,j){
      const k=i*65536+j;if(ancients.has(k))return ancients.get(k);let v=null;const p=hash(i,j,seed+441);
      if(p<.35){
        const x=(i+.3+.4*hash(i,j,seed+443))*AG,z=(j+.3+.4*hash(i,j,seed+445))*AG,g=geography(x,z),chance={rainforest:.35,forest:.3,montane:.25,boreal:.15}[g.biome]||0;
        if(p<chance&&!g.exposed&&!g.highland&&!g.wet&&g.slope<.6&&g.water<=g.height&&Math.hypot(x,z)>40){
          const conifer=g.biome==='montane'||g.biome==='boreal'||g.biome==='forest'&&g.temperature<11,h=hash(i,j,seed+447),base=g.height*cellMetres-1;
          const H=conifer?48+14*h:32+12*h,R=(conifer?1.7:1.4)+.6*hash(i,j,seed+449),lumps=[];
          if(conifer)v={x,z,conifer,base,H,R,crownLow:base+H*.42,crown:6.5+2*h,top:base+H+3,reach:8.5+2*h};
          else{
            lumps.push({x,z,y:base+H,r:10+2.5*h});
            for(let n=0;n<4;n++){const a=hash(n,k,seed+451)*Math.PI*2+n*1.57,o=5+3*hash(n,k,seed+453);lumps.push({x:x+Math.cos(a)*o,z:z+Math.sin(a)*o,y:base+H*(.78+.14*hash(n,k,seed+455)),r:6+2.5*hash(n,k,seed+457)});}
            v={x,z,conifer,base,H,R,lumps,top:base+H+8,reach:Math.max(...lumps.map(l=>Math.hypot(l.x-x,l.z-z)+l.r))};
          }
        }
      }
      ancients.set(k,v);if(ancients.size>4096)ancients.delete(ancients.keys().next().value);return v;
    }
    const ancientNear=(x,z)=>ancientCell(Math.floor(x/AG),Math.floor(z/AG));
    // Standing-stone ruins: one candidate per 150 m cell on gentle, open or raised ground: a stone circle (some stones
    // fallen, lintels across some pairs, an altar), a lone monolith, or a broken round tower with rubble.
    const STG=150,ruins=new Map();
    function ruinCell(i,j){
      const k=i*65536+j;if(ruins.has(k))return ruins.get(k);let v=null;const p=hash(i,j,seed+461);
      if(p<.3){
        const x=(i+.3+.4*hash(i,j,seed+463))*STG,z=(j+.3+.4*hash(i,j,seed+465))*STG,g=geography(x,z);
        const raised=g.height*cellMetres-[[25,0],[-25,0],[0,25],[0,-25]].reduce((m,[u,w])=>m+geography(x+u,z+w).height*cellMetres,0)/4;
        const open=['meadow','grassland','tundra','savanna','desert','subalpine'].includes(g.biome)||g.pass;
        if(!g.sea&&!g.wet&&!g.glacier&&g.biome!=='snow'&&g.slope<.35&&g.water<=g.height&&!g.gorge&&(raised>1||open)&&Math.hypot(x,z)>60){
          const kind=hash(i,j,seed+467),boxes=[],ground=(u,w)=>geography(u,w).height*cellMetres;
          // An oriented box: centre, unit axis (ux,uz), half length/width, and a vertical span; `seat` boxes start at each
          // column's own ground so they never float on a slope.
          const box=(cx,cz,a,hl,hw,y0,y1,seat=true)=>boxes.push({cx,cz,ux:Math.cos(a),uz:Math.sin(a),hl,hw,y0,y1,seat});
          let wall=null;
          if(kind<.55){
            const n=8+Math.floor(hash(i,j,seed+469)*5),R=5+3*hash(i,j,seed+471),tops=[];
            for(let s=0;s<n;s++){
              const a=s/n*Math.PI*2+(hash(s,k,seed+473)-.5)*.2,sx=x+Math.cos(a)*R,sz=z+Math.sin(a)*R,g0=ground(sx,sz),H=2.4+1.4*hash(s,k,seed+475);
              if(hash(s,k,seed+477)<.25){box(sx+Math.cos(a)*H/2,sz+Math.sin(a)*H/2,a,H/2,.45,g0-.3,g0+.7);tops.push(null);}
              else{box(sx,sz,a+Math.PI/2,.45,.3,g0-.5,g0+H);tops.push({sx,sz,top:g0+H,a});}
            }
            for(let s=0;s<n;s++){const A=tops[s],B=tops[(s+1)%n];if(A&&B&&Math.abs(A.top-B.top)<.8&&hash(s,k,seed+479)<.35){const y=Math.max(A.top,B.top);box((A.sx+B.sx)/2,(A.sz+B.sz)/2,Math.atan2(B.sz-A.sz,B.sx-A.sx),Math.hypot(B.sx-A.sx,B.sz-A.sz)/2+.45,.35,y,y+.6,false);}}
            const g0=ground(x,z);box(x,z,hash(i,j,seed+481)*Math.PI,1,.55,g0-.3,g0+.8);
          }else if(kind<.8){const g0=ground(x,z);box(x,z,hash(i,j,seed+481)*Math.PI,.7,.5,g0-1,g0+7+3*hash(i,j,seed+483));}
          else{
            const g0=ground(x,z);wall={x,z,r:3.5,t:.8,base:g0-.5,door:hash(i,j,seed+485)*Math.PI*2,k};
            for(let s=0;s<6;s++){const a=hash(s,k,seed+487)*Math.PI*2,o=4.5+3*hash(s,k,seed+489),bx=x+Math.cos(a)*o,bz=z+Math.sin(a)*o,b0=ground(bx,bz);box(bx,bz,a,.45,.4,b0-.3,b0+.5);}
          }
          v={x,z,boxes,wall,top:Math.max(wall?wall.base+11:0,...boxes.map(b=>b.y1)),reach:wall?8:12};
        }
      }
      ruins.set(k,v);if(ruins.size>4096)ruins.delete(ruins.keys().next().value);return v;
    }
    const ruinNear=(x,z)=>ruinCell(Math.floor(x/STG),Math.floor(z/STG));
    // Rock landforms, one candidate per 130 m cell: in desert and dry badlands a sandstone arch or a cluster of hoodoos
    // (spires pinched in the middle under a dark caprock); off rocky coasts a sea stack or a sea arch standing in shallows.
    const KG=130,rocks=new Map();
    function rockCell(i,j){
      const k=i*65536+j;if(rocks.has(k))return rocks.get(k);let v=null;const p=hash(i,j,seed+501);
      if(p<.5){
        const x=(i+.3+.4*hash(i,j,seed+503))*KG,z=(j+.3+.4*hash(i,j,seed+505))*KG,g=geography(x,z),h=hash(i,j,seed+507),a=hash(i,j,seed+509)*Math.PI;
        const dry=['desert','savanna'].includes(g.biome)||g.biome==='grassland'&&g.moisture<.3;
        const arch=(base,Ls,Ha)=>({kind:'arch',x,z,ux:Math.cos(a),uz:Math.sin(a),base,Ls,Ha,t:1.6+.8*hash(i,j,seed+511),dh:1.4+.8*hash(i,j,seed+513)});
        if(dry&&!g.wet&&!g.sea&&g.slope<.6&&g.water<=g.height&&Math.hypot(x,z)>60&&p<.4){
          const base=g.height*cellMetres-.5;
          if(h<.45){v=arch(base,6+5*hash(i,j,seed+515),8+6*hash(i,j,seed+517));v.mat=MAT.sandstone;}
          else{
            const n=3+Math.floor(hash(i,j,seed+519)*5),list=[];
            for(let s2=0;s2<n;s2++){const b=hash(s2,k,seed+521)*Math.PI*2,o=s2?2+6*hash(s2,k,seed+523):0,sx=x+Math.cos(b)*o,sz=z+Math.sin(b)*o;
              list.push({x:sx,z:sz,r:1+.8*hash(s2,k,seed+525),h:(s2?5:9)+5*hash(s2,k,seed+527),base:geography(sx,sz).height*cellMetres-.5});}
            v={kind:'hoodoos',x,z,list};
          }
        }else if(g.sea&&g.height*cellMetres>SEA-7&&Math.hypot(x,z)>60&&[[35,0],[-35,0],[0,35],[0,-35]].some(([u,w])=>geography(x+u,z+w).height*cellMetres>SEA)){
          if(h<.6)v={kind:'stack',x,z,r:3+3*hash(i,j,seed+529),top:SEA+8+10*hash(i,j,seed+531)};
          else{v=arch(SEA-2,7+5*hash(i,j,seed+533),11+6*hash(i,j,seed+535));v.mat=MAT.basalt;}
        }
        if(v)v.reach=v.kind==='arch'?v.Ls+v.t+v.dh+1:v.kind==='stack'?v.r+2:11;
      }
      rocks.set(k,v);if(rocks.size>4096)rocks.delete(rocks.keys().next().value);return v;
    }
    const rockNear=(x,z)=>rockCell(Math.floor(x/KG),Math.floor(z/KG));
    // Boulders: one candidate per 9 m cell. Common on mountain foothills and moraine ground below glaciers (relief),
    // rare lone erratics elsewhere. Lumpy ellipsoids 0.8-2.5 m half-size, half sunk, sometimes with a smaller companion.
    const BG=9,boulders=new Map();
    function boulderCell(i,j){
      const k=i*1048576+j;if(boulders.has(k))return boulders.get(k);let v=null;const p=hash(i,j,seed+551);
      if(p<.2){
        const x=(i+.2+.6*hash(i,j,seed+553))*BG,z=(j+.2+.6*hash(i,j,seed+555))*BG,g=geography(x,z);
        const chance=g.sea||g.wet||g.water>g.height||g.gorge||g.highland||g.slope>1.1||g.biome==='snow'||g.glacier||Math.hypot(x,z)<30?0:g.relief>15?.2:['meadow','tundra','subalpine'].includes(g.biome)?.1:.006;
        if(p<chance){
          const big=g.relief>15?1:.7,r=(.8+1.7*hash(i,j,seed+557)**2)*big,list=[{x,z,r,ry:r*(.6+.25*hash(i,j,seed+559)),y:g.height*cellMetres-r*.25}];
          if(hash(i,j,seed+561)<.4){const a=hash(i,j,seed+563)*Math.PI*2,o=r+.4,cx=x+Math.cos(a)*o,cz=z+Math.sin(a)*o,cr=r*.45;list.push({x:cx,z:cz,r:cr,ry:cr*.7,y:geography(cx,cz).height*cellMetres-cr*.25});}
          v={x,z,list,reach:r*2+1};
        }
      }
      boulders.set(k,v);if(boulders.size>16384)boulders.delete(boulders.keys().next().value);return v;
    }
    // Regular trees keep clear of giant crowns, ruins and rock landforms.
    const landmarkNear=(x,z)=>{const A=ancientNear(x,z),R=ruinNear(x,z),K=rockNear(x,z);return !!A&&Math.hypot(x-A.x,z-A.z)<A.reach+1||!!R&&Math.hypot(x-R.x,z-R.z)<R.reach+3||!!K&&Math.hypot(x-K.x,z-K.z)<K.reach+2;};
    const spireNear=(x,z,margin)=>{const S=spiresNear(x,z);return !!S&&S.list.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+margin);};
    function geography(x,z){
      if(infinite){
        const t=tectonics(x,z);
        const RV=riverAt(x,z),riverDistance=RV.d;
        const ridge=1-Math.abs(noise(x*.009,z*.009,seed+107)-.5)*2;
        const fault=Math.abs(noise(x*.04,z*.04,seed+109)-.5)*20;
        const crag=cragAt(x,z,t.relief),bump=noise(x*.032,z*.032,seed)*2.4+noise(x*.13,z*.13,seed+1)*.7+ridge**4*3;let h=t.h+bump*(t.h<SEA?.4:1)+crag;
        // Volcano flanks: radial gullies and ribs below the smooth cone, so ice gathers in gullies as radiating glaciers.
        if(t.cone>20){const a=Math.atan2(z-t.vz,x-t.vx),r=Math.hypot(x-t.vx,z-t.vz);h+=t.cone*.1*(ridged(a*4.5+r*.006,r*.01,seed+431)-.62);}
        // Slope of the mountain surface (only where plates lift the land; lowlands are gentle by construction).
        let slope=0;if(t.relief>12||t.cone>5){const e=1.5,hx=tectonics(x+e,z),hz=tectonics(x,z+e);slope=Math.hypot(hx.h+cragAt(x+e,z,hx.relief)-t.h-crag,hz.h+cragAt(x,z+e,hz.relief)-t.h-crag)/e;}
        // Glaciers: in cold ground, ice fills hollows up to a smooth surface (plate relief plus a share of the crag), so
        // ridges and summits stand out of the ice fields as rock; ice thins out toward the warm margin.
        const C=climate(x,z),mC=clamp((t.relief-6)/50,0,1),iceTop=t.h+bump+1.5+t.relief*.36*mC*.22,Tice=C.T-.17*Math.max(0,iceTop-t.h);
        let ice=0;if((t.relief>15||t.cone>20)&&Tice<-2&&iceTop>h)ice=(iceTop-h)*clamp((-2-Tice)/3,0,1);
        let iceBase=h;h+=ice;
        // Rivers sit in valleys rather than slots: the taller the ground beside a river, the wider its valley. Width follows the
        // smooth landform (not small bumps), so the valley edge, where massif tiers end, stays a clean line.
        const floor=Math.max(SEA-.6,RV.level-1.2),valley=6+RV.w+Math.min(70,Math.max(0,t.h+crag-floor)*1.3);
        const bt=clamp((riverDistance-2.3)/valley,0,1),bank=bt*bt*(3-2*bt);
        const L=liftAt(x,z),pass=L.pass,lift=bank<1?0:L.lift;
        const gw=(noise(x*.008,z*.008,seed+227)-.5)*60,half=2+noise(x*.05,z*.05,seed+233);
        const sx=x-gorgeX,sz=z-gorgeZ,along=clamp(sx*gorgeDX+sz*gorgeDZ,-32,32),homeGorge=Math.hypot(sx-along*gorgeDX,sz-along*gorgeDZ)+Math.sin(along*.15)*1.5;
        const faulted=(t.setting==='rift'||t.setting==='transform')&&t.f>.3;
        const gorgeDistance=lift>0||riverDistance<16||t.base<SEA+6?Infinity:Math.min(homeGorge,faulted?Math.abs(noise((x+gw)*.006,(z-gw)*.006,seed+231)-.5)*170:Infinity);
        const gorge=gorgeDistance<half,rock=noise(x*.02,z*.02,seed+239)>.45?'sound':'fractured';
        // Raising ground (massif tiers, knolls) raises the glacier bed with it; only ice counts as ice.
        if(lift>0){const before=h;h=Math.max(h,Math.min(h,SEA+8)+L.up);iceBase+=h-before;}
        const knoll=lift>0||riverDistance<14||t.h<SEA+1.5||gorgeDistance<half+6||slope>.5?0:outcropAt(x,z);
        h+=knoll*1.6;iceBase+=knoll*1.6;
        if(bank<1)h=Math.min(h,floor+(h-floor)*bank);
        if(gorge)h=Math.max(SEA+1,t.base-7);
        iceBase=Math.min(iceBase,h);
        const height=clamp(Math.floor(h/cellMetres),1,heightCells-28*density),metres=height*cellMetres,sea=metres<SEA,steep=slope>.9;
        const lakeWater=RV.lake>metres+.2&&!gorge,wet=riverDistance<12||lakeWater,T=C.T-.17*Math.max(0,metres-t.h),iceCells=Math.max(0,height-Math.floor(iceBase/cellMetres));
        const glacier=!gorge&&!sea&&iceCells>=2,biome=gorge?'gorge':glacier?'glacier':biomeOf(T,C.M,metres,wet,steep,slope>1.4,t.relief>15||t.cone>20,slope>1.8);
        const water=sea?Math.round(SEA/cellMetres):riverDistance<7&&!gorge?Math.floor((floor+1)/cellMetres):lakeWater?Math.floor(RV.lake/cellMetres):0;
        // Bare rock only where landform demands it: gorge lips, the rims of massif tiers, thin fault seams, outcrop knolls,
        // cliff-steep mountainsides and alpine ground. Plateau tops, grassland and forest stay vegetated.
        const rim=lift>0&&!pass&&[[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]].some(([u,v])=>upliftAt(x+u,z+v).up<L.up-1.5);
        const exposed=gorgeDistance<half+1.5||rim||lift>0&&fault<.9&&ridge>.55||knoll>0||slope>(T>2?1.8:1.4)&&!sea&&biome!=='snow'&&!glacier||slope>1.8&&!sea&&!glacier||biome==='alpine';
        return {height,riverDistance,riverLevel:floor,riverWidth:RV.w,foam:RV.foam&&riverDistance<7&&!gorge,ridge,fault,clearing:0,exposed,wet,slope,
          lift,highland:lift>0,pass,gorge,gorgeDistance,gorgeHalf:half,rock,sea,water,biome,glacier,iceCells:glacier?iceCells:0,cone:t.cone,setting:t.setting,temperature:T,moisture:C.M,relief:t.relief};
      }
      const riverDistance=Math.abs(x-riverX(z));
      const ridge=Math.exp(-(((x-29)/14)**2))*(.65+.35*Math.sin(z*.025+.4));
      const fault=Math.abs(x-(39+3*Math.sin(z*.075)));
      let h=7+noise(x*.032,z*.032,seed)*3+noise(x*.13,z*.13,seed+1)*.8+ridge*7;
      const clearing=1-clamp((Math.hypot(x-49,z-58)-8)/7,0,1);
      h=h*(1-clearing)+8*clearing;
      const bank=clamp((riverDistance-2.3)/8,0,1);
      h=5+(h-5)*bank;
      const exposed=ridge>.45||fault<1.4&&x<45;
      return {height:clamp(Math.floor(h/cellMetres),1,heightCells-28*density),riverDistance,ridge,fault,clearing,exposed,wet:riverDistance<12};
    }
    function ground(x,z){if(!infinite&&(x<0||z<0||x>=extent||z>=extent))return null;return geography((Math.floor(x/cellMetres)+.5)*cellMetres,(Math.floor(z/cellMetres)+.5)*cellMetres).height*cellMetres;}
    const TG=infinite?3:5;
    // A streamed tree is a pure function of its 3 m grid cell; tree() memoizes it, the continent view keeps its own memo.
    function makeTree(gx,gz){
        const x=(gx+.15+.7*hash(gx,gz,seed+9))*TG,z=(gz+.15+.7*hash(gx,gz,seed+11))*TG,g=geography(x,z);
        const patch=clamp((noise(x*.03,z*.03,seed+341)-.25)/.3,0,1),dense=(TREES[g.biome]||0)*(.35+.65*patch);
        const conifer=g.biome==='boreal'||g.biome==='tundra'||g.biome==='montane'||g.biome==='subalpine'||g.biome==='forest'&&g.temperature<11,big=g.biome==='rainforest',small=g.biome==='subalpine'||g.biome==='tundra';
        const value=g.riverDistance<9||g.water>g.height||g.exposed||g.highland||g.sea||g.slope>(g.biome==='montane'?1.6:1.2)||g.gorgeDistance<g.gorgeHalf+4||hash(gx,gz,seed+23)>=dense||spireNear(x,z,4)||landmarkNear(x,z)?null
          :Object.freeze({x,z,base:g.height,conifer,height:((small?8:conifer?14:big?18:11)+Math.floor(hash(gx,gz,seed+4)*(small?5:big?12:8)))*density,radius:((small?3:conifer?4:big?7:5)+Math.floor(hash(gx,gz,seed+5)*(small?2:3)))*density});
        return value;
    }
    function tree(gx,gz){
      if(infinite){
        const key=gx*134217728+gz;if(trees.has(key))return trees.get(key);
        const value=makeTree(gx,gz);
        if(trees.size>=2048)trees.delete(trees.keys().next().value);trees.set(key,value);return value;
      }
      const grid=Math.ceil(extent/5);
      if(!infinite&&(gx<0||gz<0||gx>=grid||gz>=grid))return null;
      const key=gx*134217728+gz;if(trees.has(key))return trees.get(key);
      const x=(gx+.2+.6*hash(gx,gz,seed+9))*5,z=(gz+.2+.6*hash(gx,gz,seed+11))*5;
      const g=geography(x,z);
      const edge=gx<Math.ceil(EXTENT/5)&&gz<Math.ceil(EXTENT/5)?EXTENT:extent;
      const value=(!infinite&&(x<1||z<1||x>edge-1||z>edge-1||x>extent-1||z>extent-1))||g.clearing>.1||g.riverDistance<11||g.exposed||g.highland||g.gorgeDistance<g.gorgeHalf+4||hash(gx,gz,seed+23)<.28?null:{x,z,base:g.height,height:(12+Math.floor(hash(gx,gz,seed+4)*9))*density,radius:(5+Math.floor(hash(gx,gz,seed+5)*3))*density};
      if(value)Object.freeze(value);if(trees.size>=2048)trees.delete(trees.keys().next().value);trees.set(key,value);return value;
    }
    // Root geology and identity survive render/cache changes.
    let rootSite=null,score=Infinity;
    if(infinite){
      // The opening needs engineered terrain beside it: chart barrier landforms (gorge floors and
      // >=2.5 m steps) on a coarse grid, distance-transform it, and admit only roots near — not on — one.
      const BG=4,BN=93,B0=-(BN>>1)*BG,bh=new Float32Array(BN*BN),bsea=new Uint8Array(BN*BN),bmark=new Uint8Array(BN*BN),bd=new Float32Array(BN*BN);
      for(let j=0;j<BN;j++)for(let i=0;i<BN;i++){const g=geography(B0+i*BG,B0+j*BG),k=j*BN+i;bh[k]=g.height*cellMetres;bsea[k]=g.sea;bmark[k]=g.gorge&&!g.sea?1:0;}
      for(let j=0;j<BN;j++)for(let i=0;i<BN;i++){const k=j*BN+i;
        for(const o of [i+1<BN?1:0,j+1<BN?BN:0])if(o&&!(bsea[k]&&bsea[k+o])&&Math.abs(bh[k+o]-bh[k])>=2.5)bmark[k]=bmark[k+o]=1;}
      for(let j=0;j<BN;j++)for(let i=0;i<BN;i++){const k=j*BN+i;if(bmark[k]){bd[k]=0;continue;}
        if(i)bd[k]=Math.min(bd[k],bd[k-1]+BG);if(j){bd[k]=Math.min(bd[k],bd[k-BN]+BG);if(i)bd[k]=Math.min(bd[k],bd[k-BN-1]+BG*1.4143);if(i+1<BN)bd[k]=Math.min(bd[k],bd[k-BN+1]+BG*1.4143);}}
      for(let j=BN-1;j>=0;j--)for(let i=BN-1;i>=0;i--){const k=j*BN+i;
        if(i+1<BN)bd[k]=Math.min(bd[k],bd[k+1]+BG);if(j+1<BN){bd[k]=Math.min(bd[k],bd[k+BN]+BG);if(i+1<BN)bd[k]=Math.min(bd[k],bd[k+BN+1]+BG*1.4143);if(i)bd[k]=Math.min(bd[k],bd[k+BN-1]+BG*1.4143);}}
      const nearBarrier=(x,z,lo,hi)=>{const i=Math.round((x-B0)/BG),j=Math.round((z-B0)/BG),d=i<0||j<0||i>=BN||j>=BN?1e9:bd[j*BN+i];return d>=lo&&d<=hi;};
      for(const [lo,hi] of [[9,42],[6,54],[0,1e9]]){
        for(let z=-128;z<=128;z+=2)for(let x=-128;x<=128;x+=2){const g=geography(x,z);if(g.exposed&&g.riverDistance>12&&!g.highland&&g.gorgeDistance>12&&nearBarrier(x,z,lo,hi)&&[.0625,.125].every(offset=>geography(x+offset,z+offset).exposed)){const s=Math.hypot(x,z);if(s<score){score=s;rootSite={x,z};}}}
        if(rootSite)break;
      }
      if(!rootSite)throw new Error('No dry basalt root in the starting survey');
    }else for(let z=40;z<77;z+=.5)for(let x=34;x<44;x+=.5){const g=geography(x,z);if(g.exposed&&g.fault<1){const s=Math.hypot(x-42,z-58);if(s<score){score=s;rootSite={x,z};}}}
    const deposit=Object.freeze({id:`${id}:ore:root`,kind:'Ferrite',x:rootSite.x,z:rootSite.z,y:ground(rootSite.x,rootSite.z),rule:infinite?'Dry basalt outcrop in the seeded ridge and fracture fields':'Exposed basalt along the western fault above the river catchment',geology:infinite?'Outcrop-exposed basalt':'Fault-exposed basalt',surveyed:true});
    // Optional stage timer (set by node()): geography, tree lookups/stamping, and features (isles, spires, ore, flowers).
    let prof=null;const now=()=>performance.now();
    // colTop: one past the highest cell the last column() call can have written, so callers reusing a buffer scan and clear
    // only that far.
    let colTop=0;
    function column(vx,vz,into){
      const values=into||new Uint8Array(heightCells);colTop=0;
      const x=(vx+.5)*cellMetres,z=(vz+.5)*cellMetres;
      if(!infinite&&(x<0||z<0||x>=extent||z>=extent))return values;
      let t0=prof&&prof.on&&now();
      const g=geography(x,z),h=g.height;let written=h+density;
      if(prof&&prof.on){const t=now();prof.geography+=t-t0;t0=t;}
      values.fill(MAT.basalt,0,Math.max(0,h-4*density));
      values.fill(g.exposed?MAT.basalt:MAT.soil,Math.max(0,h-4*density),h);
      if(infinite){
        const b=g.biome,sub=b==='desert'||b==='beach'||b==='sea'?MAT.sand:MAT.soil;
        if(!g.exposed)values.fill(sub,Math.max(0,h-4*density),h);
        values[h-1]=g.exposed?MAT.basalt:b==='glacier'?(g.temperature<-6?MAT.snow:MAT.ice):b==='snow'?MAT.snow:b==='sea'||b==='desert'||b==='beach'||g.riverDistance<9?MAT.sand:b==='grassland'||b==='savanna'||b==='tundra'?MAT.dry:b==='alpine'?MAT.basalt:MAT.grass;
        if(g.iceCells)values.fill(MAT.ice,h-g.iceCells,h);
      }else values[h-1]=g.exposed?MAT.basalt:g.riverDistance<9?MAT.sand:MAT.grass;
      if(Math.hypot(x-deposit.x,z-deposit.z)<1.15&&g.exposed)values.fill(MAT.ore,h-3*density,h);
      if(infinite){if(g.water>h){values.fill(MAT.water,h,g.water);if(g.foam)values[g.water-1]=MAT.foam;written=Math.max(written,g.water);}}
      else if(h<24*density&&g.riverDistance<7)values.fill(MAT.water,h,24*density);
      if(prof&&prof.on){const t=now();prof.features+=t-t0;t0=t;}
      const gx=Math.floor(x/TG),gz=Math.floor(z/TG);
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        const t=tree(gx+dx,gz+dz);if(!t)continue;
        const dist=Math.hypot((x-t.x)/cellMetres,(z-t.z)/cellMetres),top=t.base+t.height;
        written=Math.max(written,top+Math.ceil(t.radius*.65)+2*density+1);
        if(dist<.72*density)values.fill(MAT.bark,t.base,top);
        if(t.conifer){
          const low=t.base+3*density;
          for(let y=low;y<Math.min(heightCells,top+2*density);y++)if(!values[y]&&dist<t.radius*(1-(y-low)/(top+2*density-low))+.5)values[y]=MAT.needle;
        }else if(dist<t.radius){
          const rise=Math.sqrt(t.radius*t.radius-dist*dist);
          const low=Math.max(t.base+5*density,Math.floor(top-rise*.55)),high=Math.min(heightCells,Math.ceil(top+rise*.65));
          for(let y=low;y<high;y++)if(!values[y])values[y]=MAT.leaf;
        }
      }
      if(prof&&prof.on){const t=now();prof.trees+=t-t0;t0=t;}
      if(infinite){
        const I=isleAt(x,z),F=isleCell(Math.floor(x/IG),Math.floor(z/IG))?.fall;
        if(F){const q=Math.hypot(x-F.x,z-F.z);
          if(q<.75){const to=Math.min(heightCells,Math.floor(F.bottom/cellMetres));if(to>h){values.fill(MAT.water,h,to);written=Math.max(written,to);}}
          else if(q<3&&values[h]===0&&g.water<=h){values[h]=q<1.8?MAT.foam:MAT.water;}}
        // Ground beneath a sky isle lies in its shadow (material bit 7), which shows the gap under the slab from above.
        if(I&&I.bottom>h*cellMetres)values[h-1]|=SHADE;
        if(I){const b=clamp(Math.floor(I.bottom/cellMetres),0,heightCells),t=clamp(Math.floor(I.top/cellMetres),b+1,heightCells);
          written=Math.max(written,t);values.fill(MAT.crystal,clamp(Math.floor(I.keel/cellMetres),0,b),b);values.fill(MAT.basalt,b,t);values.fill(MAT.soil,Math.max(b,t-4*density),t);values[t-1]=I.cold?MAT.snow:MAT.grass;}
        const S=spiresNear(x,z);
        if(S){
          let near=false;
          for(const p of S.list){
            const dx=x-p.x,dz=z-p.z;if(Math.hypot(dx,dz)>p.r+p.h*.25+1){if(Math.hypot(dx,dz)<p.r+3.5)near=true;continue;}near=true;
            const y0=Math.max(0,Math.floor(p.base/cellMetres)),y1=Math.min(heightCells,Math.ceil((p.base+p.h)/cellMetres));written=Math.max(written,y1);
            for(let y=y0;y<y1;y++){const u=y*cellMetres-p.base,r=p.r*(1-u/p.h)**.8;if(Math.hypot(dx-p.lx*u,dz-p.lz*u)<r)values[y]=MAT.crystal;}
          }
          // Aether moss carpets soft ground around a cluster.
          if(near&&!g.exposed&&values[h-1]!==MAT.crystal&&values[h-1]!==MAT.sand)values[h-1]=MAT.moss;
        }
      }
      if(infinite){
        const A=ancientNear(x,z);
        if(A&&Math.abs(x-A.x)<A.reach+1&&Math.abs(z-A.z)<A.reach+1){
          const d=Math.hypot(x-A.x,z-A.z),y0=Math.max(0,Math.floor(A.base/cellMetres));
          // Trunk with a buttress flare over the lowest 4 m.
          for(let y=y0;y<Math.min(heightCells,Math.ceil((A.base+A.H*(A.conifer?.88:1))/cellMetres));y++){const u=y*cellMetres-A.base;if(d<A.R*(1+1.2*Math.max(0,1-u/4)**2)*(A.conifer?1-.8*u/A.H:1-.3*u/A.H))values[y]=A.conifer?MAT.redwood:MAT.bark;}
          if(A.conifer){for(let y=Math.floor(A.crownLow/cellMetres);y<Math.min(heightCells,Math.ceil(A.top/cellMetres));y++){const r=A.crown*(1-(y*cellMetres-A.crownLow)/(A.top-A.crownLow));if(d<r&&!values[y])values[y]=MAT.needle;}}
          else for(const l of A.lumps){const r=l.r*(.86+.28*noise(x*.35,z*.35,seed+459)),q=Math.hypot(x-l.x,z-l.z);if(q>=r)continue;const half=Math.sqrt(r*r-q*q)*.72;for(let y=Math.max(0,Math.floor((l.y-half)/cellMetres));y<Math.min(heightCells,Math.ceil((l.y+half)/cellMetres));y++)if(!values[y])values[y]=MAT.leaf;}
          written=Math.max(written,Math.ceil(A.top/cellMetres)+1);
        }
        const bi=Math.floor(x/BG),bj=Math.floor(z/BG);
        for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
          const B=boulderCell(bi+di,bj+dj);if(!B||Math.abs(x-B.x)>B.reach||Math.abs(z-B.z)>B.reach)continue;
          for(const q of B.list){const d=Math.hypot(x-q.x,z-q.z)/(q.r*(.85+.3*noise(x*.9,z*.9,seed+565)));if(d>=1)continue;
            const half=q.ry*Math.sqrt(1-d*d),a=Math.max(0,Math.floor(Math.min(q.y-half,h*cellMetres-.25)/cellMetres)),b=Math.min(heightCells,Math.ceil((q.y+half)/cellMetres));
            if(b>a){values.fill(MAT.basalt,a,b);written=Math.max(written,b);}}
        }
        const K=rockNear(x,z);
        if(K&&Math.abs(x-K.x)<K.reach&&Math.abs(z-K.z)<K.reach){
          const ground=h*cellMetres-.25,put=(m,y0,y1)=>{const a=Math.max(0,Math.floor(y0/cellMetres)),b=Math.min(heightCells,Math.ceil(y1/cellMetres));if(b>a){values.fill(m,a,b);written=Math.max(written,b);}};
          if(K.kind==='arch'){
            // A thick elliptical band: outer ellipse minus inner ellipse; legs run down to each column's own ground.
            const dx=x-K.x,dz=z-K.z,u=dx*K.ux+dz*K.uz,v=-dx*K.uz+dz*K.ux,Lo=K.Ls+K.t,Li=K.Ls-K.t;
            if(Math.abs(v)<K.dh*(.8+.4*noise(x*.4,z*.4,seed+537))&&Math.abs(u)<Lo){
              const out=K.base+(K.Ha+K.t)*Math.sqrt(1-(u/Lo)**2)+(noise(x*.5,z*.5,seed+539)-.5)*.8;
              if(Math.abs(u)<Li){const inn=K.base+(K.Ha-K.t)*Math.sqrt(1-(u/Li)**2);put(K.mat,inn,out);}else put(K.mat,Math.min(ground,K.base),out);
            }
          }else if(K.kind==='stack'){
            const d=Math.hypot(x-K.x,z-K.z)+(noise(x*.3,z*.3,seed+541)-.5)*2;
            if(d<K.r){put(MAT.basalt,ground-.5,K.top-1);put(MAT.grass,K.top-1,K.top);}
          }else for(const q of K.list){
            const d=Math.hypot(x-q.x,z-q.z);if(d>q.r*1.3)continue;
            // Pinched in the middle, capped by a wider dark stone.
            for(let y=Math.max(0,Math.floor(q.base/cellMetres));y<Math.min(heightCells,Math.ceil((q.base+q.h+1.2)/cellMetres));y++){
              const u=y*cellMetres-q.base;if(u>q.h){if(d<q.r*1.3)values[y]=MAT.basalt;}else if(d<q.r*(1-.38*Math.sin(Math.PI*u/q.h)))values[y]=MAT.sandstone;}
            written=Math.max(written,Math.ceil((q.base+q.h+1.2)/cellMetres));
          }
        }
        const R=ruinNear(x,z);
        if(R&&Math.abs(x-R.x)<R.reach&&Math.abs(z-R.z)<R.reach){
          for(const b of R.boxes){
            const dx=x-b.cx,dz=z-b.cz;if(Math.abs(dx*b.ux+dz*b.uz)>=b.hl||Math.abs(-dx*b.uz+dz*b.ux)>=b.hw)continue;
            const from=Math.max(0,Math.floor((b.seat?Math.min(b.y0,h*cellMetres-.25):b.y0)/cellMetres)),to=Math.min(heightCells,Math.ceil(b.y1/cellMetres));
            values.fill(MAT.stone,from,to);written=Math.max(written,to);
          }
          const W=R.wall;
          if(W){const d=Math.hypot(x-W.x,z-W.z);if(Math.abs(d-W.r)<W.t/2){
            const a=Math.atan2(z-W.z,x-W.x),door=Math.abs(((a-W.door+Math.PI*3)%(Math.PI*2))-Math.PI)<.3,top=W.base+3+7*noise(a*2.2+W.k,.5,seed+491);
            const from=Math.max(0,Math.floor((door?W.base+3:Math.min(W.base,h*cellMetres-.25))/cellMetres)),to=Math.min(heightCells,Math.ceil(top/cellMetres));
            if(to>from){values.fill(MAT.stone,from,to);written=Math.max(written,to);}}}
        }
      }
      if(prof&&prof.on)prof.features+=now()-t0;
      if(!g.exposed&&!g.wet&&g.clearing<.5&&(!infinite||values[h-1]===MAT.grass)&&hash(Math.floor(vx/density),Math.floor(vz/density),seed+52)>.994&&values[h]===0)values.fill(MAT.flower,h,h+density);
      colTop=Math.min(heightCells,written);
      return values;
    }
    function generateChunk(cx,cz){
      if(![cx,cz].every(n=>Number.isInteger(n)&&(!infinite||Math.abs(n)<=MAX_CHUNK)))throw new Error('Chunk coordinates exceed the supported range');
      const offsets=new Uint16Array(chunkCells*chunkCells+1),ends=[],materials=[];
      for(let z=0;z<chunkCells;z++)for(let x=0;x<chunkCells;x++){
        const i=z*chunkCells+x,v=column(cx*chunkCells+x,cz*chunkCells+z);offsets[i]=ends.length;
        for(let y=0;y<heightCells;){const material=v[y];let end=y+1;while(end<heightCells&&v[end]===material)end++;ends.push(end);materials.push(material);y=end;}
      }
      if(ends.length>65535)throw new Error('Column runs exceed the chunk offset format');
      offsets[chunkCells*chunkCells]=ends.length;
      const chunk={cx,cz,size:chunkCells,height:heightCells,cell:cellMetres,offsets,ends:heightCells>255?Uint16Array.from(ends):Uint8Array.from(ends),materials:Uint8Array.from(materials)};
      chunk.bytes=chunk.offsets.byteLength+chunk.ends.byteLength+chunk.materials.byteLength;
      return chunk;
    }
    // Streamed LOD nodes: level L samples one world column every 2^L cells, so a node of NODE x NODE columns covers
    // NODE*2^L cells per side. Every level is real voxels (trees, spires, isles included), built at its own spacing
    // rather than generated at full resolution and thrown away.
    const NODE=32,MAX_LEVEL=Math.round(Math.log2(8/cellMetres)),nodeMetres=L=>NODE*cellMetres*2**L;
    // Upper bound on anything a node can hold (ground, trees, spires, isles), so a view only requests nodes that can reach it.
    const bounds=new Map();
    function nodeBound(L,nx,nz){
      if(!infinite)return heightCells*cellMetres;
      const k=L+':'+nx+':'+nz;let v=bounds.get(k);if(v!==undefined)return v;
      const m=nodeMetres(L),n=m>64?4:2,x0=nx*m,z0=nz*m;v=SEA+12;
      for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const t=tectonics(x0+m*i/n,z0+m*j/n);v=Math.max(v,Math.max(t.h,SEA)+t.relief*.36+24);}
      for(let j=Math.floor(z0/IG);j<=Math.floor((z0+m)/IG);j++)for(let i=Math.floor(x0/IG);i<=Math.floor((x0+m)/IG);i++){const I=isleCell(i,j);if(I)v=Math.max(v,I.top+3);}
      for(let j=Math.floor((z0-16)/AG);j<=Math.floor((z0+m+16)/AG);j++)for(let i=Math.floor((x0-16)/AG);i<=Math.floor((x0+m+16)/AG);i++){const A=ancientCell(i,j);if(A)v=Math.max(v,A.top+2);}
      v=Math.min(v,heightCells*cellMetres);bounds.set(k,v);if(bounds.size>16384)bounds.delete(bounds.keys().next().value);return v;
    }
    const heightBound=(cx,cz)=>nodeBound(Math.log2(CHUNK*density/NODE),cx,cz);
    function node(L,nx,nz){
      if(!infinite)throw new Error('LOD nodes are only generated for the streamed world');
      if(!(Number.isInteger(L)&&L>=0&&L<=MAX_LEVEL)||![nx,nz].every(Number.isInteger))throw new Error('Invalid LOD node');
      const s=2**L,P=NODE+2,blocks=Math.ceil(heightCells/s),cols=new Array(P*P),tops=new Int32Array(P*P);let ny=1,reduce=0;
      prof={geography:0,trees:0,features:0,on:false};let sampled=0;
      // One sampled column per block column, reduced vertically by keeping each block's top occupied material. The column
      // buffer is reused: only cells below colTop were written, so only those are scanned and cleared.
      const buf=new Uint8Array(heightCells),floor=new Int32Array(P*P);
      for(let j=0;j<P;j++)for(let i=0;i<P;i++){
        prof.on=((i+j)&3)===0;if(prof.on)sampled++;
        const c=column((nx*NODE+i-1)*s+(s>>1),(nz*NODE+j-1)*s+(s>>1),buf),lim=colTop,t0=prof.on&&now(),b=new Uint8Array(blocks);let top=0;
        let hi=lim-1;while(hi>=0&&!c[hi])hi--;
        for(let y=0;y<=hi;y++){const m=c[y];if(m){b[(y/s)|0]=m;top=((y/s)|0)+1;}}
        c.fill(0,0,lim);let f=0;while(f<top&&b[f])f++;
        cols[j*P+i]=b;tops[j*P+i]=top;floor[j*P+i]=f;if(prof.on)reduce+=now()-t0;
        if(i>0&&j>0&&i<=NODE&&j<=NODE)ny=Math.max(ny,top);
      }
      // Skirt: halo columns stop two blocks below the lower of themselves and the adjacent inside column, so every
      // border carries a short wall that covers height mismatches against a coarser or finer neighbour.
      const limits=new Int32Array(P*P);let low=ny;
      for(let j=0;j<P;j++)for(let i=0;i<P;i++){const k=j*P+i,inside=i>0&&j>0&&i<=NODE&&j<=NODE;limits[k]=Math.min(ny,inside?ny:Math.max(0,Math.min(tops[k],tops[clamp(j,1,NODE)*P+clamp(i,1,NODE)])-2));low=Math.min(low,floor[k],limits[k]);}
      // Below the lowest air in any column every block is solid and has no visible face: mesh from just under it, with a
      // solid layer beneath so no bottom faces are emitted. Output y is offset back by `base`.
      const base=Math.max(0,low-1),span=ny-base,plane=P*(span+2),dense=new Uint8Array(P*plane);
      for(let j=0;j<P;j++)for(let i=0;i<P;i++){
        const k=j*P+i,b=cols[k],o=j*plane+i;dense[o]=1;
        for(let y=base;y<limits[k];y++)dense[o+(y-base+1)*P]=b[y];
      }
      const scale=P*P/Math.max(1,sampled),timing={geography:prof.geography*scale,trees:prof.trees*scale,features:prof.features*scale,reduce:reduce*scale};prof=null;const t1=now(),mesh=greedy(dense,NODE,span,NODE,base);timing.mesh=now()-t1;
      return {...mesh,normals:hillshade(tops,P),normalSize:NODE,level:L,nx,nz,column:cellMetres*s,top:ny,timing};
    }
    // Smooth surface normals per inside column (RGBA8: x, z, cavity, unused) from the haloed column tops, so distant
    // terraces light as the slope they form instead of alternating tread/riser bands. Blocks are cubic, so the gradient
    // is unitless. Sobel, then a 3×3 blur, widens the kernel enough to hide single-block steps.
    function hillshade(tops,P){
      const N=P-2,T=(i,j)=>tops[j*P+i],gx=new Float32Array(N*N),gz=new Float32Array(N*N),cavity=new Float32Array(N*N),out=new Uint8Array(N*N*4);
      for(let j=0;j<N;j++)for(let i=0;i<N;i++){
        const I=i+1,J=j+1;let sum=0;for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++)sum+=T(I+a,J+b);
        gx[j*N+i]=(T(I+1,J-1)+2*T(I+1,J)+T(I+1,J+1)-T(I-1,J-1)-2*T(I-1,J)-T(I-1,J+1))/8;
        gz[j*N+i]=(T(I-1,J+1)+2*T(I,J+1)+T(I+1,J+1)-T(I-1,J-1)-2*T(I,J-1)-T(I+1,J-1))/8;
        cavity[j*N+i]=T(I,J)-sum/9;
      }
      for(let j=0;j<N;j++)for(let i=0;i<N;i++){
        let x=0,z=0,n=0;
        for(let b=Math.max(0,j-1);b<=Math.min(N-1,j+1);b++)for(let a=Math.max(0,i-1);a<=Math.min(N-1,i+1);a++){x+=gx[b*N+a];z+=gz[b*N+a];n++;}
        x/=n;z/=n;const l=Math.hypot(x,1,z),o=(j*N+i)*4;
        out[o]=Math.round(128-127*x/l);out[o+1]=Math.round(128-127*z/l);out[o+2]=clamp(Math.round(128+cavity[j*N+i]*40),0,255);out[o+3]=255;
      }
      return out;
    }
    return Object.freeze({id,dataId:`${id}:cell:${cellMetres}:extent:${extent}`,seed,revision,extent,infinite,cell:cellMetres,chunkCells,heightCells,chunkMetres:chunkCells*cellMetres,heightMetres:heightCells*cellMetres,deposit,geography,ground,column,tree,generateChunk,node,landmarksAt:(x,z)=>infinite?{ancient:ancientNear(x,z),ruin:ruinNear(x,z),rock:rockNear(x,z)}:{ancient:null,ruin:null,rock:null},nodeBound,heightBound,nodeSize:NODE,maxLevel:MAX_LEVEL,nodeMetres,vegetationEntries:()=>trees.size});
  }
  function voxel(chunk,x,y,z){
    const {size:CHUNK,height:HEIGHT}=chunk;
    if(x<0||z<0||y<0||x>=CHUNK||z>=CHUNK||y>=HEIGHT)return MAT.air;
    const i=z*CHUNK+x;
    for(let r=chunk.offsets[i];r<chunk.offsets[i+1];r++)if(y<chunk.ends[r])return chunk.materials[r];
    return MAT.air;
  }
  function meshChunk(world,chunk,step=1){
    const {size:CHUNK,height:HEIGHT}=chunk;
    if(chunk.cell!==world.cell)throw new Error('Chunk resolution does not match the world');
    if(![1,2,4,8].includes(step))throw new Error('Render step must be 1, 2, 4 or 8');
    // Mesh only up to the chunk's top occupied cell: tall streamed columns cost nothing where the ground is low.
    let top=1;for(let i=0;i<CHUNK*CHUNK;i++){const e=chunk.offsets[i+1]-1;if(e>chunk.offsets[i]&&chunk.materials[e]===MAT.air)top=Math.max(top,chunk.ends[e-1]);else if(chunk.materials[e])top=HEIGHT;}
    const nx=CHUNK/step,ny=Math.ceil(top/step),dims=[nx,ny,nx],halo=nx+2;
    const dense=new Uint8Array(halo*halo*(ny+2));
    const at=(x,y,z)=>dense[(z+1)*halo*(ny+2)+(y+1)*halo+x+1];
    for(let z=-1;z<=nx;z++)for(let x=-1;x<=nx;x++){
      const local=x>=0&&z>=0&&x<nx&&z<nx;
      const col=local?null:world.column(chunk.cx*CHUNK+x*step,chunk.cz*CHUNK+z*step);
      for(let y=0;y<ny;y++){
        let material=0;
        // Preserve the top occupied material when reducing a vertical block (grass must not become soil).
        for(let dy=step-1;dy>=0&&!material;dy--)material=local?voxel(chunk,x*step,y*step+dy,z*step):col[y*step+dy];
        dense[(z+1)*halo*(ny+2)+(y+1)*halo+x+1]=material;
      }
    }
    return {...greedy(dense,nx,ny,nx),step,temporaryDenseBytes:dense.byteLength};
  }
  // Greedy mesher over a dense block grid with a one-block halo on every side: layout (z+1)*halo*(ny+2)+(y+1)*halo+x+1,
  // halo=nx+2. Merges coplanar same-material exposed faces; a face on the halo boundary belongs to the neighbour.
  function greedy(dense,nx,ny,nz,yOffset=0){
    const halo=nx+2,stride=[1,halo,halo*(ny+2)],dims=[nx,ny,nz],origin=stride[0]+stride[1]+stride[2];
    const mask=new Int16Array(Math.max(nx*ny,nx*nz,ny*nz));
    let output=new ArrayBuffer(16384),view=new DataView(output),used=0,quads=0,exposedFaces=0;
    for(let d=0;d<3;d++){
      const u=(d+1)%3,v=(d+2)%3,su=stride[u],sv=stride[v],sd=stride[d],nu=dims[u],nv=dims[v];
      for(let pd=-1;pd<dims[d];pd++){
        let n=0;
        for(let pv=0;pv<nv;pv++){let i=origin+pd*sd+pv*sv;for(let pu=0;pu<nu;pu++,i+=su){
          const a=dense[i],b=dense[i+sd];
          // The neighbouring solid owns its face; never duplicate it in this block.
          const value=a&&!b&&pd>=0?a:!a&&b&&pd<dims[d]-1?-b:0;
          mask[n++]=value;if(value)exposedFaces++;
        }}
        for(let j=0;j<nv;j++)for(let i=0;i<nu;){
          n=j*nu+i;const c=mask[n];if(!c){i++;continue;}
          let w=1;while(i+w<nu&&mask[n+w]===c)w++;
          let h=1;outer:while(j+h<nv){for(let k=0;k<w;k++)if(mask[n+k+h*nu]!==c)break outer;h++;}
          const pos=[0,0,0],du=[0,0,0],dv=[0,0,0];pos[d]=pd+1;pos[u]=i;pos[v]=j;du[u]=w;dv[v]=h;
          const normal=d*2+(c>0?1:0),m=Math.abs(c),corners=[pos,pos.map((t,k)=>t+du[k]),pos.map((t,k)=>t+du[k]+dv[k]),pos.map((t,k)=>t+dv[k])];
          if(used+48>output.byteLength){const larger=new ArrayBuffer(output.byteLength*2);new Uint8Array(larger).set(new Uint8Array(output));output=larger;view=new DataView(output);}
          for(const k of c>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]){for(let a=0;a<3;a++)view.setUint16(used+a*2,corners[k][a]+(a===1?yOffset:0),true);view.setUint8(used+6,normal);view.setUint8(used+7,m);used+=8;}
          quads++;for(let b=0;b<h;b++)for(let a=0;a<w;a++)mask[n+a+b*nu]=0;i+=w;
        }
      }
    }
    const buffer=output.slice(0,used);
    return {buffer,count:quads*6,quads,exposedFaces,scratchBytes:dense.byteLength+mask.byteLength+output.byteLength+used};
  }
  class BudgetCache{
    constructor(maxEntries=144,maxBytes=32*1024*1024,dispose=()=>{}){this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.dispose=dispose;this.items=new Map();this.bytes=0;}
    get(key){const v=this.items.get(key);if(v){this.items.delete(key);this.items.set(key,v);}return v;}
    set(key,value,retain=[]){this.delete(key);if(value.bytes>this.maxBytes){this.dispose(value);return false;}for(const k of retain)this.get(k);this.items.set(key,value);this.bytes+=value.bytes;while(this.items.size>this.maxEntries||this.bytes>this.maxBytes)this.delete(this.items.keys().next().value);return true;}
    delete(key){const v=this.items.get(key);if(v){this.bytes-=v.bytes;this.items.delete(key);this.dispose(v);}}
    clear(){for(const key of this.items.keys())this.delete(key);}
  }
  const api={CELL,CHUNK,HEIGHT,EXTENT,REVISION,MAX_CHUNK,MAT,SHADE,COLORS,hash,riverX,movePosition,positionAt,createWorld,voxel,meshChunk,BudgetCache};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MicroWorld=api;
})(typeof globalThis==='object'?globalThis:this);
