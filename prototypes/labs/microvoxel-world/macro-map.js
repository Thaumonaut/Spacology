(function(root){
  'use strict';
  // Macro map: an Azgaar-style continent map per seed (a port of the heightmap templates, climate, depression fill,
  // flux rivers and lakes of Azgaar's Fantasy Map Generator, via the Spacology-Worlds fork). It is built once per
  // (seed, template) on a jittered grid of ~16K cells over a finite 32 x 20 km world, then baked into a 100 m raster that
  // is sampled with a cubic B-spline plus a light domain warp and coastline noise, so no cell edge ever shows.
  // Coordinates: map metres (mx 0..W, my 0..H, north up) and world metres (x = mx - ox, z = my - oy; the home cell sits
  // at the world origin). Heights use Azgaar's 0-100 scale with 20 = sea level; metres() maps them to the voxel world.
  const W=32000,H=20000,CELLS=16000,SEA_H=20,SEA=14,RS=100,MIN_FLUX=70,UPLAND_H=58;
  const TEMPLATES={
    volcano:`Hill 1 90-100 44-56 40-60
Multiply 0.8 50-100 0 0
Range 1.5 30-55 45-55 40-60
Smooth 3 0 0 0
Hill 1.5 35-45 25-30 20-75
Hill 1 35-55 75-80 25-75
Hill 0.5 20-25 10-15 20-25
Mask 3 0 0 0`,
    highIsland:`Hill 1 90-100 65-75 47-53
Add 7 all 0 0
Hill 5-6 20-30 25-55 45-55
Range 1 40-50 45-55 45-55
Multiply 0.8 land 0 0
Mask 3 0 0 0
Smooth 2 0 0 0
Trough 2-3 20-30 20-30 20-30
Trough 2-3 20-30 60-80 70-80
Hill 1 10-15 60-60 50-50
Hill 1.5 13-16 15-20 20-75
Range 1.5 30-40 15-85 30-40
Range 1.5 30-40 15-85 60-70
Pit 3-5 10-30 15-85 20-80`,
    lowIsland:`Hill 1 90-99 60-80 45-55
Hill 1-2 20-30 10-30 10-90
Smooth 2 0 0 0
Hill 6-7 25-35 20-70 30-70
Range 1 40-50 45-55 45-55
Trough 2-3 20-30 15-85 20-30
Trough 2-3 20-30 15-85 70-80
Hill 1.5 10-15 5-15 20-80
Hill 1 10-15 85-95 70-80
Pit 5-7 15-25 15-85 20-80
Multiply 0.4 20-100 0 0
Mask 4 0 0 0`,
    continents:`Hill 1 80-85 60-80 40-60
Hill 1 80-85 20-30 40-60
Hill 6-7 15-30 25-75 15-85
Multiply 0.6 land 0 0
Hill 8-10 5-10 15-85 20-80
Range 1-2 30-60 5-15 25-75
Range 1-2 30-60 80-95 25-75
Range 0-3 30-60 80-90 20-80
Strait 2 vertical 0 0
Strait 1 vertical 0 0
Smooth 3 0 0 0
Trough 3-4 15-20 15-85 20-80
Trough 3-4 5-10 45-55 45-55
Pit 3-4 10-20 15-85 20-80
Mask 4 0 0 0`,
    archipelago:`Add 11 all 0 0
Range 2-3 40-60 20-80 20-80
Hill 5 15-20 10-90 30-70
Hill 2 10-15 10-30 20-80
Hill 2 10-15 60-90 20-80
Smooth 3 0 0 0
Trough 10 20-30 5-95 5-95
Strait 2 vertical 0 0
Strait 2 horizontal 0 0`,
    atoll:`Hill 1 75-80 50-60 45-55
Hill 1.5 30-50 25-75 30-70
Hill .5 30-50 25-35 30-70
Smooth 1 0 0 0
Multiply 0.2 25-100 0 0
Hill 0.5 10-20 50-55 48-52`,
    mediterranean:`Range 4-6 30-80 0-100 0-10
Range 4-6 30-80 0-100 90-100
Hill 6-8 30-50 10-90 0-5
Hill 6-8 30-50 10-90 95-100
Multiply 0.9 land 0 0
Mask -2 0 0 0
Smooth 1 0 0 0
Hill 2-3 30-70 0-5 20-80
Hill 2-3 30-70 95-100 20-80
Trough 3-6 40-50 0-100 0-10
Trough 3-6 40-50 0-100 90-100`,
    peninsula:`Range 2-3 20-35 40-50 0-15
Add 5 all 0 0
Hill 1 90-100 10-90 0-5
Add 13 all 0 0
Hill 3-4 3-5 5-95 80-100
Hill 1-2 3-5 5-95 40-60
Trough 5-6 10-25 5-95 5-95
Smooth 3 0 0 0
Invert 0.4 both 0 0`,
    pangea:`Hill 1-2 25-40 15-50 0-10
Hill 1-2 5-40 50-85 0-10
Hill 1-2 25-40 50-85 90-100
Hill 1-2 5-40 15-50 90-100
Hill 8-12 20-40 20-80 48-52
Smooth 2 0 0 0
Multiply 0.7 land 0 0
Trough 3-4 25-35 5-95 10-20
Trough 3-4 25-35 5-95 80-90
Range 5-6 30-40 10-90 35-65`,
    isthmus:`Hill 5-10 15-30 0-30 0-20
Hill 5-10 15-30 10-50 20-40
Hill 5-10 15-30 30-70 40-60
Hill 5-10 15-30 50-90 60-80
Hill 5-10 15-30 70-100 80-100
Smooth 2 0 0 0
Trough 4-8 15-30 0-30 0-20
Trough 4-8 15-30 10-50 20-40
Trough 4-8 15-30 30-70 40-60
Trough 4-8 15-30 50-90 60-80
Trough 4-8 15-30 70-100 80-100
Invert 0.25 x 0 0`,
    shattered:`Hill 8 35-40 15-85 30-70
Trough 10-20 40-50 5-95 5-95
Range 5-7 30-40 10-90 20-80
Pit 12-20 30-40 15-85 20-80`,
    taklamakan:`Hill 1-3 20-30 30-70 30-70
Hill 2-4 60-85 0-5 0-100
Hill 2-4 60-85 95-100 0-100
Hill 3-4 60-85 20-80 0-5
Hill 3-4 60-85 20-80 95-100
Smooth 3 0 0 0`,
    oldWorld:`Range 3 70 15-85 20-80
Hill 2-3 50-70 15-45 20-80
Hill 2-3 50-70 65-85 20-80
Hill 4-6 20-25 15-85 20-80
Multiply 0.5 land 0 0
Smooth 2 0 0 0
Range 3-4 20-50 15-35 20-45
Range 2-4 20-50 65-85 45-80
Strait 3-7 vertical 0 0
Trough 6-8 20-50 15-85 45-65
Pit 5-6 20-30 10-90 10-90`,
    fractious:`Hill 12-15 50-80 5-95 5-95
Mask -1.5 0 0 0
Mask 3 0 0 0
Add -20 30-100 0 0
Range 6-8 40-50 5-95 10-90`};
  // Seeded template choice: 'continents' dominates; the rest stay reachable (and selectable with ?map=<name>).
  // Atoll and taklamakan leave too little open lowland for a home start, so they are override-only.
  const WEIGHTS={continents:60,oldWorld:9,pangea:7,archipelago:6,highIsland:6,mediterranean:5,lowIsland:4,peninsula:4,isthmus:3,shattered:3,fractious:3,volcano:2};
  function hash(x,z,seed=0){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^(seed|0);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
  function noise(x,z,seed){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);const a=hash(ix,iz,seed),b=hash(ix+1,iz,seed),c=hash(ix,iz+1,seed),d=hash(ix+1,iz+1,seed);return (a+(b-a)*sx)*(1-sz)+(c+(d-c)*sx)*sz;}
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function mulberry(a){return function(){a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  // Azgaar height (0-100, 20 = sea) to metres. Lowland (20-45) stays gentle at ~14-60 m; mountains steepen to ~200 m at
  // 90 so crag detail on top tops out near the 240 m summit ceiling. Seabed shelves to 12 m deep.
  function metres(h){const d=h-SEA_H;return d>=0?SEA+1.3*d+.024*Math.max(0,d-12)**2:SEA-12*(1-Math.exp(d/5));}
  // Inverse of metres(): the Azgaar-scale height of a ground level, used to fold the range layer (metres) back into the
  // heights the hydrology works on. Above 100 it simply continues the curve (ranges reach ~140).
  function invMetres(m){const e=m-SEA;if(e<0)return SEA_H+5*Math.log(Math.max(1e-6,1+e/12));if(e<=15.6)return SEA_H+e/1.3;return SEA_H+12+(-1.3+Math.sqrt(1.69-.096*(15.6-e)))/.048;}
  // Cooling with height above the sea (C): about 6.5 C per 100 m, plus ~1.7 C over the first few tens of metres so the
  // lowland keeps the climate it had under the old, steeper lapse (0.17 C/m over the 14-60 m lowland). Treeline lands near
  // 210 m and the snowline near 280 m in the home latitudes, so 350-480 m ranges carry forest, meadow, rock and snow bands.
  const LAPSE=.065;
  function cooling(m){const e=Math.max(0,m-SEA);return LAPSE*e+1.7*(1-Math.exp(-e/12));}
  // Latitude (degrees) of a map row: home rows sit in the temperate band; 400 m per degree north-south.
  const latitudeAt=(latC,my)=>latC-(my-H/2)/400;

  function buildGraph(rng){
    const s=Math.round(Math.sqrt(W*H/CELLS)*100)/100,cellsX=Math.floor((W+.5*s-1e-10)/s),cellsY=Math.floor((H+.5*s-1e-10)/s),n=cellsX*cellsY;
    const px=new Float64Array(n),py=new Float64Array(n),jit=s/2*.9;
    for(let j=0;j<cellsY;j++)for(let i=0;i<cellsX;i++){const k=j*cellsX+i;px[k]=Math.min((i+.5)*s+rng()*2*jit-jit,W);py[k]=Math.min((j+.5)*s+rng()*2*jit-jit,H);}
    // Neighbours: the Delaunay triangulation of the jittered grid. Each grid quad is split along the diagonal that passes
    // the empty-circumcircle test (opposite angles summing under 180 degrees), so cells average six neighbours like
    // Azgaar's Voronoi cells and blobs spread as rounded, irregular rings rather than squares.
    const adj=Array.from({length:n},()=>[]),link=(a,b)=>{adj[a].push(b);adj[b].push(a);};
    const ang=(a,b,c)=>{const ux=px[a]-px[b],uy=py[a]-py[b],vx=px[c]-px[b],vy=py[c]-py[b];return Math.acos(clamp((ux*vx+uy*vy)/Math.hypot(ux,uy)/Math.hypot(vx,vy),-1,1));};
    for(let j=0;j<cellsY;j++)for(let i=0;i<cellsX;i++){const k=j*cellsX+i;
      if(i+1<cellsX)link(k,k+1);if(j+1<cellsY)link(k,k+cellsX);
      if(i+1<cellsX&&j+1<cellsY){const a=k,b=k+1,c=k+cellsX,d=k+cellsX+1;if(ang(a,b,d)+ang(a,c,d)<=Math.PI)link(a,d);else link(b,c);}}
    const off=new Int32Array(n+1);for(let k=0;k<n;k++)off[k+1]=off[k]+adj[k].length;
    const nb=new Int32Array(off[n]);for(let k=0;k<n;k++)nb.set(adj[k],off[k]);
    const border=new Uint8Array(n);for(let j=0;j<cellsY;j++)for(let i=0;i<cellsX;i++)if(!i||!j||i===cellsX-1||j===cellsY-1)border[j*cellsX+i]=1;
    return {s,cellsX,cellsY,n,px,py,off,nb,border};
  }

  // ---- Heightmap templates (port of heightmap-generator.ts; Math.random -> seeded rng, Uint8 truncation kept) ----
  function runTemplate(G,steps,rng){
    const {n,off,nb,px,py,s,cellsX,cellsY}=G;let heights=new Uint8Array(n);
    // blobPower/linePower are tabulated by cell count in Azgaar; 16K cells sits between the 10K and 20K entries.
    const blobPower=.986,linePower=.816;
    const lim=v=>clamp(v,0,100),P=p=>p>=1?true:p<=0?false:rng()<p;
    const rand=(a,b)=>{if(a===undefined&&b===undefined)return rng();if(b===undefined){b=a;a=0;}return Math.floor(rng()*(b-a+1))+a;};
    const numberIn=r=>{if(!isNaN(+r))return ~~r+ +P(+r-~~r);const sign=r[0]==='-'?-1:1;if(isNaN(+r[0]))r=r.slice(1);const g=r.split('-');const c=rand(parseFloat(g[0])*sign,+parseFloat(g[1]));return isNaN(c)||c<0?0:c;};
    const pointIn=(range,len)=>{const min=parseInt(range.split('-')[0],10)/100||0,max=parseInt(range.split('-')[1],10)/100||min;return rand(min*len,max*len);};
    const findCell=(x,y)=>Math.floor(Math.min(Math.max(0,y)/s,cellsY-1))*cellsX+Math.floor(Math.min(Math.max(0,x)/s,cellsX-1));
    const queue=new Int32Array(n*2);
    function hill(count,height,rx,ry){
      for(let t=numberIn(count);t>0;t--){
        const change=new Uint8Array(n),h=lim(numberIn(height));let start,limit=0;
        do{start=findCell(pointIn(rx,W),pointIn(ry,H));limit++;}while(heights[start]+h>90&&limit<50);
        change[start]=h;let qh=0,qt=0;queue[qt++]=start;
        while(qh<qt){const q=queue[qh++];for(let e=off[q];e<off[q+1];e++){const c=nb[e];if(change[c])continue;change[c]=change[q]**blobPower*(rng()*.2+.9);if(change[c]>1)queue[qt++]=c;}}
        heights=heights.map((v,i)=>lim(v+change[i]));
      }
    }
    function pit(count,height,rx,ry){
      for(let t=numberIn(count);t>0;t--){
        const used=new Uint8Array(n);let start,limit=0,h=lim(numberIn(height));
        do{start=findCell(pointIn(rx,W),pointIn(ry,H));limit++;}while(heights[start]<20&&limit<50);
        let qh=0,qt=0;queue[qt++]=start;
        out:while(qh<qt){const q=queue[qh++];h=h**blobPower*(rng()*.2+.9);if(h<1)break out;
          for(let e=off[q];e<off[q+1];e++){const c=nb[e];if(used[c])continue;heights[c]=lim(heights[c]-h*(rng()*.2+.9));used[c]=1;queue[qt++]=c;}}
      }
    }
    function line(count,height,rx,ry,sign,randomness){
      for(let t=numberIn(count);t>0;t--){
        const used=new Uint8Array(n);let h=lim(numberIn(height)),startX,startY,endX,endY,dist=0,limit=0;
        if(sign>0){startX=pointIn(rx,W);startY=pointIn(ry,H);}
        else do{startX=pointIn(rx,W);startY=pointIn(ry,H);limit++;}while(heights[findCell(startX,startY)]<20&&limit<50);
        limit=0;
        do{endX=rng()*W*.8+W*.1;endY=rng()*H*.7+H*.15;dist=Math.abs(endY-startY)+Math.abs(endX-startX);limit++;}while((dist<W/8||dist>(sign>0?W/3:W/2))&&limit<50);
        let cur=findCell(startX,startY);const end=findCell(endX,endY),range=[cur];used[cur]=1;
        while(cur!==end){let min=Infinity,next=cur;
          for(let e=off[cur];e<off[cur+1];e++){const c=nb[e];if(used[c])continue;let d=(px[end]-px[c])**2+(py[end]-py[c])**2;if(rng()>1-randomness)d/=2;if(d<min){min=d;next=c;}}
          if(min===Infinity)break;cur=next;range.push(cur);used[cur]=1;}
        let frontier=range.slice(),rings=0;
        while(frontier.length){rings++;for(const i of frontier)heights[i]=lim(heights[i]+sign*h*(rng()*.3+.85));h=h**linePower-1;if(h<2)break;
          const next=[];for(const f of frontier)for(let e=off[f];e<off[f+1];e++){const c=nb[e];if(!used[c]){next.push(c);used[c]=1;}}frontier=next;}
        // Prominences: every sixth ridge cell sends a spur downhill.
        range.forEach((c0,d)=>{if(d%6)return;let c=c0;for(let r=0;r<rings;r++){let m=-1;for(let e=off[c];e<off[c+1];e++)if(m<0||heights[nb[e]]<heights[m])m=nb[e];if(m<0)break;heights[m]=(heights[c]*2+heights[m])/3;c=m;}});
      }
    }
    function strait(width,dir){
      const desired=Math.min(numberIn(width),cellsX/3);if(desired<1&&P(desired))return;
      const used=new Uint8Array(n),vert=dir==='vertical';
      const sx=vert?Math.floor(rng()*W*.4+W*.3):5,sy=vert?5:Math.floor(rng()*H*.4+H*.3);
      const ex=vert?Math.floor(W-sx-W*.1+rng()*W*.2):W-5,ey=vert?H-5:Math.floor(H-sy-H*.1+rng()*H*.2);
      let cur=findCell(sx,sy);const end=findCell(ex,ey);let range=[];
      while(cur!==end){let min=Infinity,next=cur;for(let e=off[cur];e<off[cur+1];e++){const c=nb[e];let d=(px[end]-px[c])**2+(py[end]-py[c])**2;if(rng()>.8)d/=2;if(d<min){min=d;next=c;}}cur=next;range.push(cur);}
      const query=[],step=.1/desired;
      for(let i=0;i<desired;i++){const exp=.9-step*(desired-i);
        for(const r of range)for(let e=off[r];e<off[r+1];e++){const c=nb[e];if(used[c])continue;used[c]=1;query.push(c);heights[c]**=exp;if(heights[c]>100)heights[c]=5;}
        range=query.slice();}
    }
    function modify(range,add,mult){
      const min=range==='land'?20:range==='all'?0:+range.split('-')[0],max=range==='land'||range==='all'?100:+range.split('-')[1],land=min===20;
      heights=heights.map(h=>{if(h<min||h>max)return h;if(add)h=land?Math.max(h+add,20):h+add;if(mult!==1)h=land?(h-20)*mult+20:h*mult;return lim(h);});
    }
    function smooth(fr){const src=heights;heights=src.map((h,i)=>{let sum=h,c=1;for(let e=off[i];e<off[i+1];e++){sum+=src[nb[e]];c++;}const mean=sum/c;return fr===1?mean:lim((h*(fr-1)+mean)/fr);});}
    function mask(power){const fr=power?Math.abs(power):1;heights=heights.map((h,i)=>{const nx=2*px[i]/W-1,ny=2*py[i]/H-1;let d=(1-nx*nx)*(1-ny*ny);if(power<0)d=1-d;return lim((h*(fr-1)+h*d)/fr);});}
    function invert(count,axes){if(!P(count))return;const ix=axes!=='y',iy=axes!=='x',src=heights;heights=src.map((_,i)=>{const x=i%cellsX,y=Math.floor(i/cellsX);return src[(ix?cellsX-x-1:x)+(iy?cellsY-y-1:y)*cellsX];});}
    for(const step of steps.split('\n')){
      const [tool,a2,a3,a4,a5]=step.trim().split(/\s+/);
      if(tool==='Hill')hill(a2,a3,a4,a5);else if(tool==='Pit')pit(a2,a3,a4,a5);else if(tool==='Range')line(a2,a3,a4,a5,1,.15);else if(tool==='Trough')line(a2,a3,a4,a5,-1,.2);
      else if(tool==='Strait')strait(a2,a3);else if(tool==='Mask')mask(+a2);else if(tool==='Invert')invert(+a2,a3);else if(tool==='Add')modify(a3,+a2,1);else if(tool==='Multiply')modify(a3,0,+a2);else if(tool==='Smooth')smooth(+a2);
    }
    return heights;
  }

  // ---- Features, climate, rivers, lakes ----
  // hp: heights for the rain passes (default h). Range crests are passed compressed, so only the big ranges stop the wind.
  // legacy: the template-only pass that picks the home start keeps the earlier rules (0.17 C/m lapse, no rain on frozen
  // ground, every flux path a river, no source walk), so the start stays where it was before the range layer.
  // core: the range layer's core per cell (m), when present: a basin the ranges dam holds a lake only among mountains.
  function hydrology(G,h,rng,latC,hp=h,legacy=false,core=null,homeX=-1e9,homeY=-1e9){
    const {n,off,nb,px,py,border,cellsX,cellsY,s}=G;
    // Water bodies touching the map edge are ocean; enclosed ones are lakes (features-generator markup).
    const ocean=new Uint8Array(n),lakeOf=new Int32Array(n).fill(-1),stack=[];
    for(let k=0;k<n;k++)if(border[k]&&h[k]<SEA_H&&!ocean[k]){ocean[k]=1;stack.push(k);while(stack.length){const q=stack.pop();for(let e=off[q];e<off[q+1];e++){const c=nb[e];if(h[c]<SEA_H&&!ocean[c]){ocean[c]=1;stack.push(c);}}}}
    // Near-sea lakes break through a low (<=22) shore into the ocean (Grid.openNearSeaLakes).
    for(let k=0;k<n;k++)if(!ocean[k]&&h[k]>=SEA_H&&h[k]<=22){let toOcean=false,toLake=false;for(let e=off[k];e<off[k+1];e++){const c=nb[e];if(ocean[c])toOcean=true;else if(h[c]<SEA_H)toLake=true;}
      if(toOcean&&toLake){h[k]=19;const q=[k];ocean[k]=1;while(q.length){const a=q.pop();for(let e=off[a];e<off[a+1];e++){const c=nb[e];if(h[c]<SEA_H&&!ocean[c]){ocean[c]=1;q.push(c);}}}}}
    // Distance to coast in cell steps (+ land, - water), Azgaar's cells.t.
    const t=new Int16Array(n);let front=[];
    for(let k=0;k<n;k++){const land=!ocean[k];for(let e=off[k];e<off[k+1];e++)if(!ocean[nb[e]]!==land){t[k]=land?1:-1;front.push(k);break;}}
    for(let step=2;front.length&&step<400;step++){const next=[];for(const k of front)for(let e=off[k];e<off[k+1];e++){const c=nb[e];if(t[c])continue;t[c]=ocean[c]?-step:step;next.push(c);}front=next;}
    for(let k=0;k<n;k++)if(!t[k])t[k]=ocean[k]?-400:400;
    // Temperature: latitude (sea-level) minus the voxel world's altitude lapse, so the macro and streamed climates agree.
    const temp=new Float32Array(n),lat=new Float32Array(n);
    for(let k=0;k<n;k++){lat[k]=latitudeAt(latC,py[k]);temp[k]=29-.4*Math.abs(lat[k])-(legacy?.17*Math.max(0,metres(h[k])-SEA):cooling(metres(h[k])));}
    // Precipitation (precipitation-generator.ts): winds cross each row by latitude band (trades from the east under 30
    // degrees, westerlies 30-60), plus north/south passes, raining out on rising ground and refilling over water.
    const prec=new Float32Array(n),LAT_MOD=[4,2,2,2,1,1,2,2,2,2,3,3,2,2,1,1,1,.5],modifier=(n/10000)**.25,MAXPASS=85,winds=[225,45,225,315,135,315];
    const getPrec=(hum,i,next)=>{const hn=hp[i+next]??hp[i],normal=Math.max(hum/(10*modifier),1),diff=Math.max(hn-hp[i],0),mod=(hn/70)**2;return clamp(normal+diff*mod,1,hum);};
    const pass=(first,maxPrec,next,steps)=>{let hum=maxPrec-hp[first];if(hum<=0)return;
      // Snow counts as precipitation (it melts into the rivers), so only the very coldest ground is skipped.
      for(let st=0,cur=first;st<steps;st++,cur+=next){if(cur<0||cur>=n)break;if(temp[cur]<(legacy?-5:-20))continue;
        const nx=cur+next,hn=nx>=0&&nx<n?hp[nx]:hp[cur];
        if(h[cur]<SEA_H){if(hn>=SEA_H){if(nx>=0&&nx<n)prec[nx]+=Math.max(hum/(10+Math.floor(rng()*11)),1);}else{hum=Math.min(hum+5*modifier,maxPrec);prec[cur]+=5*modifier;}continue;}
        const ok=hn<=MAXPASS,p=ok?getPrec(hum,cur,nx>=0&&nx<n?next:0):hum;prec[cur]+=p;const ev=p>1.5?1:0;hum=ok?clamp(hum-p+ev,0,maxPrec):0;}};
    let northerly=0,southerly=0;
    for(let j=0;j<cellsY;j++){const L=latitudeAt(latC,(j+.5)*s),band=LAT_MOD[Math.min(17,(Math.abs(L)-1)/5|0)]||1,tier=Math.min(5,Math.abs(L-89)/30|0),a=winds[tier];
      if(a>40&&a<140)pass(j*cellsX,120*modifier*band,1,cellsX);
      if(a>220&&a<320)pass(j*cellsX+cellsX-1,120*modifier*band,-1,cellsX);
      if(a>100&&a<260)northerly++;if(a>280||a<80)southerly++;}
    const vt=northerly+southerly;
    if(northerly)for(let i=0;i<cellsX;i++)pass(i,northerly/vt*60*modifier*LAT_MOD[Math.min(17,Math.abs(latitudeAt(latC,0))/5|0)],cellsX,cellsY);
    if(southerly)for(let i=0;i<cellsX;i++)pass(n-cellsX+i,southerly/vt*60*modifier*LAT_MOD[Math.min(17,Math.abs(latitudeAt(latC,H))/5|0)],-cellsX,cellsY);
    // Mountains catch weather beyond what the passes leave them (cloud on the crests, snow): up to ~13 more on high ground,
    // so the ranges are the wettest land and every big river's headwaters lie in them.
    if(!legacy)for(let k=0;k<n;k++)if(!ocean[k]&&h[k]>=SEA_H)prec[k]+=10*clamp((metres(h[k])-50)/220,0,1.3);
    for(let k=0;k<n;k++)prec[k]=Math.min(255,prec[k]);
    // Depression fill (priority flood from the ocean) over Azgaar's altered heights (a slight slope toward the coast).
    const alt=new Float64Array(n);
    for(let k=0;k<n;k++){if(ocean[k]){alt[k]=h[k];continue;}let m=0,c=0;for(let e=off[k];e<off[k+1];e++){m+=t[nb[e]];c++;}alt[k]=Math.max(h[k],SEA_H)+t[k]/100+m/c/10000;}
    const fill=new Float64Array(n),down=new Int32Array(n).fill(-1),order=new Int32Array(n),done=new Uint8Array(n);let on=0;
    const hk=new Float64Array(n),hv=new Int32Array(n);let hn=0;
    const push=(e,k)=>{let c=hn++;while(c>0){const q=(c-1)>>1;if(hk[q]<=e)break;hk[c]=hk[q];hv[c]=hv[q];c=q;}hk[c]=e;hv[c]=k;};
    const pop=()=>{const k=hv[0],e=hk[--hn],v=hv[hn];let c=0;for(;;){let l=2*c+1;if(l>=hn)break;if(l+1<hn&&hk[l+1]<hk[l])l++;if(hk[l]>=e)break;hk[c]=hk[l];hv[c]=hv[l];c=l;}hk[c]=e;hv[c]=v;return k;};
    for(let k=0;k<n;k++)if(ocean[k]||border[k]){done[k]=1;fill[k]=ocean[k]?h[k]:alt[k];push(fill[k],k);}
    while(hn){const c=pop();order[on++]=c;for(let e=off[c];e<off[c+1];e++){const k=nb[e];if(done[k])continue;done[k]=1;fill[k]=Math.max(alt[k],fill[c]+.01);down[k]=c;push(fill[k],k);}}
    // Lakes: enclosed water (h < 20) plus filled depressions deeper than 2.5 units, flooded to their spill level. Basins
    // are keyed by their spill (the first cell the flood reached them through).
    const spill=new Int32Array(n).fill(-1);
    for(let o=0;o<on;o++){const c=order[o],d=down[c];if(d<0||ocean[c])continue;const wet=h[c]<SEA_H||fill[c]-alt[c]>.5;if(wet)spill[c]=spill[d]>=0?spill[d]:c;}
    const basins=new Map();
    for(let k=0;k<n;k++){const sp=spill[k];if(sp<0)continue;let b=basins.get(sp);if(!b){b={cells:[],deep:0,water:false};basins.set(sp,b);}b.cells.push(k);b.deep=Math.max(b.deep,fill[k]-alt[k]);if(h[k]<SEA_H)b.water=true;}
    const lakes=[];
    // With a range layer, a dry basin becomes a lake up in the mountains (most of its cells on a range's core: a tarn or a
    // lake dammed among the ranges) or out on plains the ranges don't touch (the template's own basins), never in the home
    // lowland; a lowland basin half-dammed by a range is filled and the water runs on.
    const mtnBasin=b=>{if(!core)return true;if(b.cells.some(k=>Math.hypot(px[k]-homeX,py[k]-homeY)<1500))return false;
      const up=b.cells.filter(k=>core[k]>25).length/b.cells.length;return up>.5||b.cells.every(k=>core[k]<8);};
    for(const [sp,b] of basins){if(!(b.water&&b.cells.length>=2||b.deep>=4&&b.cells.length>=3&&mtnBasin(b)))continue;
      const id=lakes.length,level=Math.max(...b.cells.map(k=>fill[k]));for(const k of b.cells)lakeOf[k]=id;
      lakes.push({id,cells:b.cells,spill:sp,height:level,outCell:down[sp],flux:0,evaporation:0,closed:false,inlets:[],outlet:-1});}
    // Water flux: precipitation down the filled surface, highest first. Lakes pool their inflow and pass on only what
    // evaporation leaves (lakes.ts defineClimateData), so arid lakes close and their rivers end in them.
    const fl=new Float64Array(n),pool=new Float64Array(lakes.length);
    for(const L of lakes){let sh=0,tt=0;for(const k of L.cells){tt+=temp[k];for(let e=off[k];e<off[k+1];e++)if(lakeOf[nb[e]]!==L.id)sh+=prec[nb[e]];}
      L.temp=tt/L.cells.length;L.shoreFlux=sh;const hm=metres(L.height)-SEA;L.evaporation=((700*(L.temp+.006*hm))/50+75)/(80-L.temp)*L.cells.length;}
    for(let o=on-1;o>=0;o--){const c=order[o];if(ocean[c])continue;
      const L=lakeOf[c];
      if(L>=0){pool[L]+=fl[c]+prec[c]/modifier;if(c===lakes[L].spill){const lk=lakes[L];lk.flux=pool[L]+lk.shoreFlux;const out=lk.flux-lk.evaporation;if(out>0&&down[c]>=0&&!ocean[down[c]]){fl[down[c]]+=out;lk.outlet=down[c];}else if(out>0&&down[c]>=0)lk.outlet=down[c];else lk.closed=true;}continue;}
      fl[c]+=prec[c]/modifier;if(down[c]>=0)fl[down[c]]+=fl[c];}
    // Rivers: cells with flux >= MIN_FLUX. The main stem continues through each confluence with the larger inflow;
    // smaller rivers end at the confluence cell (their parent's cell).
    // Macro rivers drain high ground: a cell is a river where the flux passes the threshold and its catchment reaches the
    // uplands (top: the highest ground upstream, ~80 m or more). Plains-only catchments are left to the world's local streams.
    const top=new Float32Array(n);
    for(let o=on-1;o>=0;o--){const c=order[o];if(ocean[c])continue;top[c]=Math.max(top[c],h[c]);const d=down[c];if(d>=0&&top[c]>top[d])top[d]=top[c];}
    const isRiver=k=>!ocean[k]&&lakeOf[k]<0&&fl[k]>=MIN_FLUX&&(legacy||top[k]>=UPLAND_H);
    const main=new Int32Array(n).fill(-1);
    for(let k=0;k<n;k++){if(!isRiver(k))continue;const d=down[k];if(d<0)continue;if(main[d]<0||fl[k]>fl[main[d]])main[d]=k;}
    // A lake outlet feeds its out cell as the main inflow.
    const fromLake=new Int32Array(n).fill(-1);for(const L of lakes)if(L.outlet>=0&&!L.closed&&isRiver(L.outlet)){fromLake[L.outlet]=L.id;if(main[L.outlet]>=0&&fl[main[L.outlet]]<fl[L.outlet]*.5)main[L.outlet]=-2;}
    const riverOf=new Int32Array(n).fill(-1),rivers=[];
    // Heads: river cells nobody flows into as main stem (in cell order; parents are resolved once all rivers exist).
    const heads=[];for(let k=0;k<n;k++)if(isRiver(k)&&(main[k]<0))heads.push(k);
    // Sources: a head is walked upstream along its largest inflow until the catchment above is a cell or two, so rivers
    // rise high in the ranges (cirques, snowfields, springs under the crests) rather than where the flux first passes the
    // river threshold out on the plain.
    const dOff=new Int32Array(n+1);for(let k=0;k<n;k++)if(down[k]>=0)dOff[down[k]+1]++;for(let k=0;k<n;k++)dOff[k+1]+=dOff[k];
    const dList=new Int32Array(dOff[n]),dFill=dOff.slice(0,n);for(let k=0;k<n;k++)if(down[k]>=0)dList[dFill[down[k]]++]=k;
    const upstream=hd=>{const chain=[];let c=hd;for(let guard=0;guard<2000;guard++){let b=-1;for(let e=dOff[c];e<dOff[c+1];e++){const d=dList[e];if(ocean[d]||lakeOf[d]>=0||isRiver(d))continue;if(b<0||top[d]>top[b]+.5||top[d]>top[b]-.5&&fl[d]>fl[b])b=d;}
      if(b<0||fl[b]<MIN_FLUX*.22)break;chain.push(b);c=b;}return chain.reverse();};
    for(const hd of heads){const cells=[];let c=hd,end='land',lake=-1;const src=fromLake[hd]>=0?fromLake[hd]:-1;
      if(src>=0)cells.push(lakes[src].spill);else if(!legacy)cells.push(...upstream(hd));
      for(let guard=0;guard<n;guard++){cells.push(c);const d=down[c];
        // A course reaching the map's edge runs on off the map, where the ground sinks into the sea: an ocean mouth.
        if(d<0){end=legacy?'edge':'ocean';break;}
        if(ocean[d]){cells.push(d);end='ocean';break;}
        if(lakeOf[d]>=0){cells.push(d);end='lake';lake=lakeOf[d];break;}
        if(main[d]!==c){cells.push(d);end='river';break;}
        c=d;}
      if(cells.length<3)continue;
      const id=rivers.length;for(let i=src>=0?1:0;i<cells.length-(end==='land'||end==='edge'?0:1);i++)riverOf[cells[i]]=id;
      if(src>=0)lakes[src].outletRiver=id;if(lake>=0)lakes[lake].inlets.push(id);
      rivers.push({id,cells,end,lake,parent:-1,discharge:fl[cells[cells.length-2]]});}
    for(const r of rivers)if(r.end==='river'){const last=r.cells[r.cells.length-1];r.parent=riverOf[last];}
    return {ocean,lakeOf,t,temp,prec,fl,fill,alt,lakes,rivers,lat};
  }

  // River courses (river-generator.ts addMeandering / pathUtils meander), in map metres. Azgaar's meander offsets are in
  // pixels of a ~7.2 px cell; U converts. Widths follow getOffset (widthFactor * (lengthWidth + min(flux^0.7/500, 1)) +
  // sourceWidth), calibrated so creek heads are ~2 m wide and big mouths ~25-30 m.
  function courses(G,X){
    const {px,py,s}=G,U=s/7.2,LP=[1,1,2,3,5,8,13,21,34].map(v=>v/200),wf=Math.round(1/(G.n/10000)**.25*100)/100;
    const out=[];
    for(const r of X.rivers){
      const cells=r.cells,pts=[],fx=[],anchors=[];let step=X.ocean[cells[0]]?1:10;
      for(let i=0;i<cells.length;i++,step++){
        const c=cells[i],x1=px[c],y1=py[c];anchors.push(pts.length);pts.push([x1,y1]);fx.push(X.fl[c]||0);if(i===cells.length-1)break;
        const c2=cells[i+1],x2=px[c2],y2=py[c2],d2=((x2-x1)**2+(y2-y1)**2)/(U*U);if(d2<=25&&cells.length>=6)continue;
        let mv=(.5+1/step+Math.max(.5-step/100,0))*U;const water=X.ocean[c]||X.lakeOf[c]>=0||X.ocean[c2]||X.lakeOf[c2]>=0;if(water)mv*=.25;
        const a=Math.atan2(y2-y1,x2-x1),sm=Math.sin(a)*mv,cm=Math.cos(a)*mv,f=X.fl[c]||0;
        if(step<20&&(d2>64||d2>36&&cells.length<5)){pts.push([(x1*2+x2)/3-sm,(y1*2+y2)/3+cm],[(x1+x2*2)/3+sm/2,(y1+y2*2)/3-cm/2]);fx.push(f,f);}
        else if(d2>25||cells.length<6){pts.push([(x1+x2)/2-sm,(y1+y2)/2+cm]);fx.push(f);}
      }
      // Wider lateral swings than Azgaar's map-scale meander: seeded per-point offsets across the course, so on the
      // ground a river bends every few hundred metres instead of following the cell chain.
      const main=r.parent<0;let flux=0;const hw=[];
      for(let i=0;i<pts.length;i++){flux=Math.max(flux,fx[i]);
        const sw=i===0?0:Math.min(flux**.9/500,1)*.1;// source width (Azgaar px)
        const lw=i*(1/200)+(LP[i]||LP[LP.length-1]),fw=Math.min(flux**.7/500,1),o=(main?wf*1.2:wf)*(lw+fw)+sw;
        hw.push(clamp(o*U*.5,1.2,16));}
      // Chaikin smoothing (three passes) turns the corner chain into a smooth curve; ends stay fixed.
      let P=pts.map((p,i)=>[p[0],p[1],fx[i],hw[i]]);
      for(let it=0;it<3;it++){if(P.length<3)break;const Q=[P[0]];for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1];Q.push(a.map((v,k)=>v*.75+b[k]*.25),a.map((v,k)=>v*.25+b[k]*.75));}Q.push(P[P.length-1]);P=Q;}
      out.push({id:r.id,parent:r.parent,end:r.end,lake:r.lake,discharge:r.discharge,pts:P});
    }
    // Tributaries end exactly on their parent's smoothed course.
    for(const r of out){if(r.end!=='river'||r.parent<0)continue;const p=out.find(o=>o.id===r.parent);if(!p)continue;const e=r.pts[r.pts.length-1];let best=null,bd=Infinity;
      for(let i=0;i<p.pts.length-1;i++){const a=p.pts[i],b=p.pts[i+1],ex=b[0]-a[0],ey=b[1]-a[1],L2=ex*ex+ey*ey||1,u=clamp(((e[0]-a[0])*ex+(e[1]-a[1])*ey)/L2,0,1),qx=a[0]+ex*u,qy=a[1]+ey*u,d=Math.hypot(e[0]-qx,e[1]-qy);if(d<bd){bd=d;best=[qx,qy];}}
      if(best){e[0]=best[0];e[1]=best[1];r.joinAt=best;}}
    return out;
  }

  // ---- Range layer ----
  // Fantasy mountain ranges on top of the template's continents (after Azgaar's addRange: a seeded walk lays a ridgeline,
  // the ground falls away from it). Each range is a curving crest polyline with a height H, a base half-width w and an
  // asymmetry a per vertex; the ground it adds is a core (the range itself, which the world counts as mountain relief:
  // crag, erosion, rough rock, treeline and snow all engage) plus an apron (foothills and uplands rising toward it from
  // up to ~6 km out). Kinds follow the continent's structure:
  //   spine     along a landmass's long axis through its interior (the tallest, 330-430 m, 2.6-3.6 km half-width)
  //   coastal   parallel to a coast 1.5-3 km inland (volcanoes stand on their seaward flanks)
  //   interior  other long chains crossing the interior
  //   massif    short, broad and tall knots of peaks
  //   secondary 4-10 km ranges of 150-250 m
  //   branch    spurs leaving the long ranges at an angle, lower than their parent
  //   minor     low ridges and hill ranges (50-130 m)
  //   home      one range on the start's skyline, about 1.1-1.4 km away, so the opening view shows mountains
  // Ranges keep off each other (parallel chains stay a valley apart), off the coast and out of the home lowland.
  const RANGE_KINDS={spine:{pw:1.6,apron:.16,K:2.4},coastal:{pw:1.6,apron:.15,K:2.2},interior:{pw:1.6,apron:.15,K:2.3},massif:{pw:1.25,apron:.2,K:2.4},
    secondary:{pw:1.5,apron:.14,K:2.2},branch:{pw:1.5,apron:.12,K:2},minor:{pw:1.4,apron:.12,K:2},home:{pw:1.55,apron:.14,K:2.6}};
  function landInfo(G,h){
    const {n,off,nb,border}=G,ocean=new Uint8Array(n),stack=[];
    for(let k=0;k<n;k++)if(border[k]&&h[k]<SEA_H&&!ocean[k]){ocean[k]=1;stack.push(k);while(stack.length){const q=stack.pop();for(let e=off[q];e<off[q+1];e++){const c=nb[e];if(h[c]<SEA_H&&!ocean[c]){ocean[c]=1;stack.push(c);}}}}
    const t=new Int16Array(n);let front=[];
    for(let k=0;k<n;k++){if(ocean[k])continue;for(let e=off[k];e<off[k+1];e++)if(ocean[nb[e]]){t[k]=1;front.push(k);break;}}
    for(let step=2;front.length&&step<400;step++){const next=[];for(const k of front)for(let e=off[k];e<off[k+1];e++){const c=nb[e];if(t[c]||ocean[c])continue;t[c]=step;next.push(c);}front=next;}
    for(let k=0;k<n;k++)if(!ocean[k]&&!t[k])t[k]=400;
    const comp=new Int32Array(n).fill(-1),comps=[];
    for(let k=0;k<n;k++){if(ocean[k]||comp[k]>=0)continue;const id=comps.length,cells=[k];comp[k]=id;
      for(let q=0;q<cells.length;q++){const a=cells[q];for(let e=off[a];e<off[a+1];e++){const c=nb[e];if(!ocean[c]&&comp[c]<0){comp[c]=id;cells.push(c);}}}comps.push(cells);}
    return {ocean,t,comp,comps};
  }
  // Nearest point of a range's crest to (x, y): o.d (m), o.i (segment), o.u (0-1 along it), o.side (+1 left, -1 right).
  // Segments are grouped in eights with a bounding circle, so most of a long range is skipped at once.
  function crestNear(r,x,y,o){
    let best=Infinity;const {x:X,y:Y,chunks}=r;
    for(let c=0;c<chunks.length;c+=5){if(Math.hypot(x-chunks[c],y-chunks[c+1])-chunks[c+2]>=best)continue;
      for(let i=chunks[c+3],i1=chunks[c+4];i<i1;i++){const ax=X[i],ay=Y[i],ex=X[i+1]-ax,ey=Y[i+1]-ay,L2=ex*ex+ey*ey||1,u=clamp(((x-ax)*ex+(y-ay)*ey)/L2,0,1),d=Math.hypot(x-ax-ex*u,y-ay-ey*u);
        if(d<best){best=d;o.i=i;o.u=u;o.side=ex*(y-ay)-ey*(x-ax)>=0?1:-1;}}}
    o.d=best;return o;
  }
  // Range layer at map point (x, y): out.core and out.apron (m). Cores combine as a 4-norm (a junction stands a little
  // above either range), aprons by maximum. A ~1.1 km noise wobbles the flanks so they don't run as even contours.
  const RQ={d:0,i:0,u:0,side:1};
  function rangeField(ranges,x,y,seed,out){
    const dn=(noise(x/1100,y/1100,seed+971)-.5)*2;let s4=0,ap=0;
    for(const r of ranges){if(x<r.bx0||x>r.bx1||y<r.by0||y>r.by1)continue;crestNear(r,x,y,RQ);const i=RQ.i,u=RQ.u;
      const Hc=r.H[i]+(r.H[i+1]-r.H[i])*u,w=r.w[i]+(r.w[i+1]-r.w[i])*u,a=r.a[i]+(r.a[i+1]-r.a[i])*u,ws=w*(1+a*RQ.side),d=Math.max(0,RQ.d+dn*.16*w),q=d/ws;
      if(q<1){const c=Hc*(1-q)**r.pw;s4+=c*c*c*c;}
      const qa=d/Math.min(r.K*ws,6500);if(qa<1){const v=Hc*r.apron*(1-qa)**2;if(v>ap)ap=v;}}
    out.core=Math.sqrt(Math.sqrt(s4));out.apron=ap;return out;
  }
  function buildRanges(G,h,seed,home){
    const {px,py,s,cellsX,cellsY,off,nb}=G,rng=mulberry(seed^0x2c1b3c6d),{ocean,t,comp,comps}=landInfo(G,h),ranges=[],volcanoes=[];
    const cellAt=(x,y)=>x<0||y<0||x>=W||y>=H?-1:Math.min(Math.floor(y/s),cellsY-1)*cellsX+Math.min(Math.floor(x/s),cellsX-1);
    const R=(a,b)=>a+(b-a)*rng(),hx=home!=null?px[home]:-1e9,hy=home!=null?py[home]:-1e9,sm=v=>v*v*(3-2*v);
    // Steering walk: each step tries five headings and scores a short and a longer look-ahead (stay on this landmass, keep
    // the coast distance at least minT cells, hold a target coast distance for coastal ranges, keep out of the home zone,
    // turn as little as possible), with a slowly drifting bias so crests curve.
    function walk(x,y,ang,len,o){
      const pts=[[x,y]];let a=ang,drift=0;
      for(let L=0;L<len;L+=o.step){
        const turn=o.turn||.5;drift=drift*.8+(rng()-.5)*.28*turn;let best=-Infinity,ba=a;
        for(const da of [-turn,-turn/2,0,turn/2,turn]){const b=a+drift+da;let sc=-Math.abs(da)*2.2+rng()*.6;
          for(const f of [2,5]){const lx=x+Math.cos(b)*o.step*f,ly=y+Math.sin(b)*o.step*f,c=cellAt(lx,ly);
            if(c<0||ocean[c]||comp[c]!==o.comp){sc-=f===2?100:6;continue;}
            const tt=t[c];if(tt<o.minT)sc-=(o.minT-tt)*1.4;if(o.target)sc-=Math.abs(tt-o.target)*.3;else sc+=Math.min(tt,o.minT+4)*.04;
            if(h[c]<SEA_H)sc-=5;const hd=Math.hypot(lx-hx,ly-hy);if(hd<o.homeR)sc-=(o.homeR-hd)/150;}
          if(sc>best){best=sc;ba=b;}}
        if(best<-40)break;a=ba;x+=Math.cos(a)*o.step;y+=Math.sin(a)*o.step;pts.push([x,y]);
      }
      return pts;
    }
    // Crest polyline (Chaikin-smoothed, resampled every 150 m) with per-vertex height, width and asymmetry. Long ranges
    // taper at both ends; a branch starts at its parent's flank height and tapers toward its tip.
    function finish(pts,kind,H0,w0,branch){
      for(let it=0;it<2&&pts.length>2;it++){const Q=[pts[0]];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];Q.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);}Q.push(pts[pts.length-1]);pts=Q;}
      const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
      const L=cum[cum.length-1];if(L<300)return null;const m=Math.max(2,Math.ceil(L/150)+1),X=new Float64Array(m),Y=new Float64Array(m),Hs=new Float64Array(m),ws=new Float64Array(m),as=new Float64Array(m),k=ranges.length*7.31+.5;
      for(let v=0,j=0;v<m;v++){const sv=L*v/(m-1);while(j<cum.length-2&&cum[j+1]<sv)j++;const f=(sv-cum[j])/((cum[j+1]-cum[j])||1);X[v]=pts[j][0]+(pts[j+1][0]-pts[j][0])*f;Y[v]=pts[j][1]+(pts[j+1][1]-pts[j][1])*f;
        const env=branch?sm(clamp((L-sv)/(.45*L),0,1))*(.8+.2*sm(clamp(sv/(.2*L),0,1))):sm(clamp(Math.min(sv,L-sv)/(.22*L),0,1));
        Hs[v]=H0*(.1+.9*env)*(.72+.28*noise(sv/2600,k,seed+961))+H0*.16*(noise(sv/700,k,seed+963)-.5)*env;
        ws[v]=w0*(.75+.5*noise(sv/3500,k,seed+965))*(.55+.45*env);as[v]=(noise(sv/5000,k,seed+967)-.5)*.6;}
      const K=RANGE_KINDS[kind],r={kind,x:X,y:Y,H:Hs,w:ws,a:as,length:L,pw:K.pw,apron:K.apron,K:K.K,chunks:[]};
      let reach=0;for(let v=0;v<m;v++)reach=Math.max(reach,Math.min(K.K*ws[v]*(1+Math.abs(as[v]))*1.2,6500));
      r.bx0=Math.min(...X)-reach;r.bx1=Math.max(...X)+reach;r.by0=Math.min(...Y)-reach;r.by1=Math.max(...Y)+reach;
      for(let c=0;c<m-1;c+=8){const e=Math.min(m-1,c+8);let cx=0,cy=0;for(let v=c;v<=e;v++){cx+=X[v];cy+=Y[v];}cx/=e-c+1;cy/=e-c+1;let rad=0;for(let v=c;v<=e;v++)rad=Math.max(rad,Math.hypot(X[v]-cx,Y[v]-cy));r.chunks.push(cx,cy,rad,c,e);}
      return r;
    }
    // Spacing: a new chain keeps (wa + wb) x f from every non-minor chain (a valley between parallel ranges) and its core
    // edge at least `homeGap` from home. A chain that runs into another is cut there, keeping its longest clear stretch plus
    // ~600 m on into the other range, so chains meet in junction knots instead of overlapping along their length.
    function clip(r,f,homeGap,kind,H0,w0){
      const m=r.x.length,bad=new Uint8Array(m);
      for(let v=0;v<m;v++){if(Math.hypot(r.x[v]-hx,r.y[v]-hy)<r.w[v]+homeGap){bad[v]=2;continue;}
        for(const o of ranges){if(o.kind==='minor'||r.x[v]<o.bx0||r.x[v]>o.bx1||r.y[v]<o.by0||r.y[v]>o.by1)continue;crestNear(o,r.x[v],r.y[v],RQ);if(RQ.d<(r.w[v]+o.w[RQ.i])*f){bad[v]=1;break;}}}
      let a=0,b=-1;for(let v=0,s0=0;v<=m;v++){if(v===m||bad[v]){if(v-1-s0>b-a){a=s0;b=v-1;}s0=v+1;}}
      if(b<0)return null;if(a===0&&b===m-1)return r;
      for(let k=0;k<4&&a>0&&bad[a-1]===1;k++)a--;for(let k=0;k<4&&b<m-1&&bad[b+1]===1;k++)b++;
      const pts=[];for(let v=a;v<=b;v++)pts.push([r.x[v],r.y[v]]);return pts.length>3?finish(pts,kind,H0,w0,false):null;
    }
    const pick=(cells,ok)=>{for(let k=0;k<80;k++){const c=cells[Math.floor(rng()*cells.length)];if(ok(c))return c;}return -1;};
    function chain(kind,c,ang,len,H0,w0,o,f,homeGap){
      const a=walk(px[c],py[c],ang,len/2,o),b=walk(px[c],py[c],ang+Math.PI,len/2,o);let r=finish([...b.reverse(),...a.slice(1)],kind,H0,w0,false);
      if(r)r=clip(r,f,homeGap,kind,H0,w0);if(!r||r.length<Math.max(len*.4,Math.min(len,2500)))return null;ranges.push(r);return r;
    }
    for(let ci=0;ci<comps.length;ci++){
      const cells=comps[ci],A=cells.length*s*s/1e6;if(A<6)continue;
      let mx=0,my=0;for(const c of cells){mx+=px[c];my+=py[c];}mx/=cells.length;my/=cells.length;
      let sxx=0,syy=0,sxy=0;for(const c of cells){const dx=px[c]-mx,dy=py[c]-my;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy;}
      const axis=.5*Math.atan2(2*sxy,sxx-syy),ext=4*Math.sqrt((sxx*Math.cos(axis)**2+syy*Math.sin(axis)**2+2*sxy*Math.sin(axis)*Math.cos(axis))/cells.length);
      const base={comp:ci,step:300,homeR:2600},deep=cells.reduce((b,c)=>t[c]>t[b]?c:b,cells[0]),majors=[];
      const tries=(n,fn)=>{for(let k=0,got=0;k<n*5&&got<n;k++)if(fn())got++;};
      // Spines: from near the deepest interior along the long axis.
      if(A>=45)tries(A>220?2:1,()=>{const c=majors.length?pick(cells,c=>t[c]>=Math.max(6,t[deep]*.5)):pick(cells,c=>t[c]>=t[deep]*.7);if(c<0)return false;
        const r=chain('spine',c,axis+(rng()-.5)*.5,clamp(ext*R(.55,.8),8000,30000),R(270,340),R(1700,2300),{...base,minT:5,turn:.3},.8,1500);if(r)majors.push(r);return !!r;});
      // Then coastal ranges (along a coast, holding the seed's coast distance) and interior chains in turn until the landmass
      // has about one long range per 40 km2 (2-5 on a continent).
      const wantMaj=A>=45?clamp(Math.round(A/40),2,5):A>=20?1:0;
      for(let k=0;k<60&&majors.length<wantMaj;k++){
        if(k%2===0&&A>=40){const c=pick(cells,c=>t[c]>=6&&t[c]<=16);if(c<0)continue;let gx=0,gy=0;for(let e=off[c];e<off[c+1];e++){const d=nb[e],L=Math.hypot(px[d]-px[c],py[d]-py[c])||1;gx+=(t[d]-t[c])*(px[d]-px[c])/L;gy+=(t[d]-t[c])*(py[d]-py[c])/L;}
          const r=chain('coastal',c,Math.atan2(gy,gx)+Math.PI/2,R(9000,20000),R(220,300),R(1300,1900),{...base,minT:4,target:t[c]},k<30?.7:.55,1500);if(r)majors.push(r);}
        else{const c=pick(cells,c=>t[c]>=6);if(c<0)continue;const r=chain('interior',c,rng()*Math.PI*2,R(7000,16000),R(240,320),R(1300,2000),{...base,minT:4,turn:.4},k<30?.7:.55,1500);if(r)majors.push(r);}}
      tries(clamp(Math.round(A/80),0,3),()=>{const c=pick(cells,c=>t[c]>=6);return c>=0&&!!chain('massif',c,rng()*Math.PI*2,R(800,2200),R(200,280),R(1200,1700),{...base,minT:4},.7,1500);});
      tries(clamp(Math.round(A/32),A>12?1:0,9),()=>{const c=pick(cells,c=>t[c]>=5);return c>=0&&!!chain('secondary',c,rng()*Math.PI*2,R(4000,10000),R(140,220),R(900,1400),{...base,minT:3},.65,1200);});
      // Branches: spurs off the long ranges, leaving at 30-65 degrees, lower and narrower than the parent there.
      for(const P of majors)for(let b=2+Math.floor(rng()*3);b>0;b--){
        const i=Math.floor(P.x.length*R(.15,.85)),j=Math.min(P.x.length-1,i+1),i0=Math.max(0,i-1),dir=Math.atan2(P.y[j]-P.y[i0],P.x[j]-P.x[i0]),side=rng()<.5?-1:1;
        const pts=walk(P.x[i],P.y[i],dir+side*R(.55,1.15),P.length*R(.2,.42),{...base,minT:3}),r=finish(pts,'branch',P.H[i]*R(.55,.8),P.w[i]*R(.55,.75),true);
        if(r&&r.length>1500&&r.x.every((x,v)=>Math.hypot(x-hx,r.y[v]-hy)>r.w[v]+900))ranges.push(r);}
      tries(clamp(Math.round(A/12),0,16),()=>{const c=pick(cells,c=>t[c]>=3);return c>=0&&!!chain('minor',c,rng()*Math.PI*2,R(1500,5000),R(50,130),R(450,1000),{...base,minT:2},.45,700);});
      // Stratovolcanoes on the seaward flank of coastal ranges (one or two each) and now and then alone on a big landmass.
      for(const P of majors){if(P.kind!=='coastal')continue;let last=-1e9;
        for(let v=Math.floor(P.x.length*.2);v<P.x.length*.8;v+=3){const sAlong=v*P.length/(P.x.length-1);if(sAlong-last<5000||rng()>.12)continue;
          const j=Math.min(P.x.length-1,v+1),dx=P.x[j]-P.x[v-1],dy=P.y[j]-P.y[v-1],L=Math.hypot(dx,dy)||1;
          for(const sd of [1,-1]){const x=P.x[v]-dy/L*sd*P.w[v]*.8,y=P.y[v]+dx/L*sd*P.w[v]*.8,c=cellAt(x,y);if(c<0||ocean[c]||t[c]>=t[cellAt(P.x[v],P.y[v])]||t[c]<3||Math.hypot(x-hx,y-hy)<3500||volcanoes.some(o=>Math.hypot(o.x-x,o.y-y)<4500))continue;
            volcanoes.push({x,y,H:R(150,230)});last=sAlong;break;}}}
      // Then volcanoes at the ends of long ranges near the coast and alone near the coast, up to ~1 per 50 km2 of land.
      const want=A>=30?clamp(Math.round(A/50),1,4):0,mine=()=>volcanoes.filter(v=>comp[cellAt(v.x,v.y)]===ci).length,spaced=(x,y)=>volcanoes.every(v=>Math.hypot(v.x-x,v.y-y)>4500)&&Math.hypot(x-hx,y-hy)>3500;
      for(const P of majors)for(const e of [0,P.x.length-1]){if(mine()>=want)break;const c=cellAt(P.x[e],P.y[e]);if(c>=0&&!ocean[c]&&t[c]>=3&&t[c]<=20&&spaced(P.x[e],P.y[e])&&rng()<.7)volcanoes.push({x:P.x[e],y:P.y[e],H:R(150,220)});}
      for(let k=0;k<30&&mine()<want;k++){const c=pick(cells,c=>t[c]>=4&&t[c]<=14&&h[c]>=SEA_H);if(c>=0&&spaced(px[c],py[c])&&rangeField(ranges,px[c],py[c],seed,{}).core<60)volcanoes.push({x:px[c],y:py[c],H:R(160,240)});}
    }
    // The home range: a chain whose crest passes 0.85-1 km from the start, diagonally up-screen (toward -x, -z in the
    // world, turned 35-60 degrees to one side), where the 50-degree view of a 2 km span still holds its summits, so the
    // opening view has mountains on its skyline. Its foot stays ~300 m clear of the camp.
    if(home!=null){
      const up=Math.atan2(-Math.cos(35*Math.PI/180),-Math.sin(35*Math.PI/180));
      for(let k=0;k<16;k++){const dir=up+(rng()<.5?-1:1)*R(.6,1.05),D=R(850,1000),x=hx+Math.cos(dir)*D,y=hy+Math.sin(dir)*D,c=cellAt(x,y);if(c<0||ocean[c]||t[c]<3)continue;
        const o={comp:comp[home],step:300,homeR:D*.92,minT:2},ang=dir+Math.PI/2+(rng()-.5)*.4,a=walk(x,y,ang,R(3500,6000),o),b=walk(x,y,ang+Math.PI,R(3500,6000),o);
        const r=finish([...b.reverse(),...a.slice(1)],'home',R(220,270),Math.min(D-300,R(560,700)),false);
        if(r&&r.length>3000){ranges.push(r);break;}}
    }
    return {ranges,volcanoes,land:{ocean,t,comp}};
  }
  // Volcano cone (m) at distance d from a volcano of height Hv: concave flanks to a summit (the world adds the crater).
  const coneAt=(Hv,d)=>{const R=Hv*2.8;return d<R?Hv*(1-d/R)**1.8:0;};

  function generate(seed,template){
    const t0=Date.now?Date.now():0,start=typeof performance!=='undefined'?performance.now():t0;
    seed=Number(seed)>>>0;const rng=mulberry(seed^0x5bd1e995);
    const G=buildGraph(rng);let chosen=template&&TEMPLATES[template]?template:null,h,X,home,latC=30+hash(seed,23,seed+611)*4,attempts=0;
    for(;attempts<8;attempts++){
      let name=chosen;if(!name){let r=(attempts?rng():hash(seed,29,seed+617))*Object.values(WEIGHTS).reduce((a,b)=>a+b,0);for(const k in WEIGHTS){r-=WEIGHTS[k];if(r<0){name=k;break;}}name=name||'continents';}
      h=runTemplate(G,TEMPLATES[name],rng);X=hydrology(G,Float32Array.from(h),rng,latC,undefined,true);home=pickHome(G,h,X,seed);
      if(!home&&chosen&&attempts>=1)home=pickHome(G,h,X,seed,true);
      if(home){template=name;break;}
      // A template override that leaves no room for a home start (atoll, taklamakan) falls back to the seeded choice.
      if(chosen&&attempts>=2)chosen=null;
    }
    if(!home)throw new Error('Macro map: no land for a home start');
    // Ranges are laid on the template's continents (the home start picked on them), folded into the heights, and the
    // hydrology runs again on the result: rivers rise in the ranges and route around them, basins between them hold lakes.
    const RL=buildRanges(G,h,seed,home),hc=new Float32Array(G.n),core=new Float32Array(G.n),q={};
    for(let k=0;k<G.n;k++){if(h[k]<SEA_H){hc[k]=h[k];continue;}rangeField(RL.ranges,G.px[k],G.py[k],seed,q);
      let cone=0;for(const v of RL.volcanoes)cone=Math.max(cone,coneAt(v.H,Math.hypot(G.px[k]-v.x,G.py[k]-v.y)));
      const f=rangeMask(RL.land.t[k]*G.s);core[k]=q.core*f;hc[k]=invMetres(upland(metres(h[k]))+(q.core+q.apron)*f+cone);}
    const ground=hc;
    const hp=hc.map(v=>v<=60?v:60+(v-60)*.35);
    X=hydrology(G,hc,mulberry(seed^0x7f4a7c15),latC,hp,false,core,G.px[home],G.py[home]);home=settleHome(G,ground,X,home);
    const C=courses(G,X),ox=G.px[home],oy=G.py[home];
    const map={seed,template,W,H,s:G.s,cellsX:G.cellsX,cellsY:G.cellsY,n:G.n,px:G.px,py:G.py,heights:hc,templateHeights:h,ocean:X.ocean,lakeOf:X.lakeOf,temp:X.temp,prec:X.prec,flux:X.fl,ox,oy,latC,home:{cell:home,x:0,z:0}};
    map.ranges=RL.ranges.map(r=>({kind:r.kind,length:r.length,height:Math.max(...r.H),x:Float32Array.from(r.x,v=>v-ox),z:Float32Array.from(r.y,v=>v-oy),H:Float32Array.from(r.H),w:Float32Array.from(r.w),comp:RL.land.comp[Math.min(Math.floor(r.y[r.y.length>>1]/G.s),G.cellsY-1)*G.cellsX+Math.min(Math.floor(r.x[r.x.length>>1]/G.s),G.cellsX-1)]}));
    map.volcanoes=RL.volcanoes.map(v=>({x:v.x-ox,z:v.y-oy,H:v.H}));
    bake(map,G,X,C,RL);
    map.ms=(typeof performance!=='undefined'?performance.now():Date.now())-start;
    return map;
  }
  // The template's own high ground (its central domes and ranges) is eased into uplands of at most ~140 m: the range
  // layer carries the mountains, so a range on a template dome does not stack into one broad plateau.
  const upland=m=>m<=60?m:60+(m-60)*.42;
  // Range layer fades out toward the sea: nothing within 200 m of the coast, full strength 1.2 km inland (d: coast
  // distance in metres), so ranges never make new land and coasts keep the template's shape.
  const rangeMask=d=>{const v=clamp((d-200)/1000,0,1);return v*v*(3-2*v);};
  // After the ranges and the second hydrology: keep the home start if it is still open lowland clear of rivers and lakes,
  // else move it to the nearest such cell within 1.5 km.
  function settleHome(G,h,X,home){
    const {n,off,nb,px,py}=G,wet=new Uint8Array(n);for(const r of X.rivers)for(const c of r.cells)wet[c]=1;
    const ok=k=>{if(X.ocean[k]||X.lakeOf[k]>=0||wet[k]||h[k]>46||X.t[k]<4)return false;let ring=[k];const seen=new Set(ring);
      for(let r=1;r<=2;r++){const next=[];for(const a of ring)for(let e=off[a];e<off[a+1];e++){const c=nb[e];if(seen.has(c))continue;seen.add(c);next.push(c);if(X.lakeOf[c]>=0||r<=1&&wet[c]&&!X.ocean[c])return false;}ring=next;}return true;};
    if(ok(home))return home;let best=home,bd=1500;
    for(let k=0;k<n;k++){const d=Math.hypot(px[k]-px[home],py[k]-py[home]);if(d<bd&&ok(k)){bd=d;best=k;}}
    return best;
  }
  // Home start: open temperate lowland well inside a continent, away from rivers and lakes.
  function pickHome(G,h,X,seed,relaxed=false){
    const {n,off,nb,px,py}=G,near=new Uint8Array(n);
    for(const r of X.rivers)for(const c of r.cells)near[c]=2;for(const L of X.lakes)for(const c of L.cells)near[c]=3;
    let best=-1,score=Infinity;
    for(let k=0;k<n;k++){
      if(X.ocean[k]||X.lakeOf[k]>=0||h[k]<(relaxed?22:24)||h[k]>(relaxed?42:36)||X.t[k]<(relaxed?4:7)||Math.abs(py[k]-H/2)>2600)continue;
      // Rings: no river within two cells, no lake within three, no high ground within two.
      let ok=true,ring=[k];const seen=new Set(ring);for(let r=1;r<=3&&ok;r++){const next=[];for(const a of ring)for(let e=off[a];e<off[a+1];e++){const c=nb[e];if(seen.has(c))continue;seen.add(c);next.push(c);if(near[c]===3||r<=2&&(near[c]||h[c]>(relaxed?48:42)))ok=false;}ring=next;}
      if(!ok)continue;
      const sc=Math.hypot(px[k]-W/2,(py[k]-H/2)*1.6)/W+hash(k,7,seed+613)*.35;if(sc<score){score=sc;best=k;}
    }
    return best>=0?best:null;
  }
  // ---- Bake: a 100 m raster of the smooth fields, a lake membership raster and a river segment index ----
  // Rasters: H (template height; lakes at their level), S (signed coast distance, m), P (precipitation), D/L (lake
  // membership), RC (range core, m, cut by river valleys), RA (range apron, m) and VF (valley factor: 0 on a macro river's
  // floodplain, 1 clear of its valley; hills fade with it).
  function bake(map,G,X,C,RL){
    const {n,px,py,s,cellsX,cellsY}=G,RW=Math.round(W/RS)+1,RH=Math.round(H/RS)+1,N=RW*RH,T=map.templateHeights;
    const fH=new Float32Array(N),fS=new Float32Array(N),fP=new Float32Array(N),fD=new Float32Array(N),fL=new Int16Array(N).fill(-1),fW=new Float32Array(N);
    // Per-cell values: template height on land (the range layer is added per raster point, not per cell); lakes of the
    // template stand at their fill level, lakes the ranges dam keep the ground (the ranges shape their basins); signed
    // coast distance in metres; precipitation normalized so the land median reads 0.55; template water (inland).
    const hv=new Float32Array(n),sv=new Float32Array(n),pv=new Float32Array(n),wv=new Float32Array(n),land=[];
    for(let k=0;k<n;k++)if(!X.ocean[k])land.push(X.prec[k]);land.sort((a,b)=>a-b);const med=Math.max(1,land[land.length>>1]||1);
    for(let k=0;k<n;k++){const L=X.lakeOf[k];hv[k]=X.ocean[k]?map.heights[k]:L>=0&&T[k]<SEA_H?Math.max(SEA_H+.5,X.lakes[L].height):Math.max(T[k],SEA_H);
      sv[k]=(X.t[k]>0?X.t[k]-.5:X.t[k]+.5)*s;pv[k]=1-Math.exp(-.8*X.prec[k]/med);wv[k]=!X.ocean[k]&&T[k]<SEA_H?1:0;}
    // Kernel regression over the jittered cells: weights (1 - d^2/R^2)^2, R = 1.6 cells. Smooth and cell-free.
    const R=1.6*s,R2=R*R,LR=1.35*s,LR2=LR*LR;
    for(let j=0;j<RH;j++)for(let i=0;i<RW;i++){
      const x=i*RS,y=j*RS,ci=Math.floor(x/s),cj=Math.floor(y/s),o=j*RW+i;let ws=0,a=0,b=0,c=0,e=0,bestD=0,bestL=-1;const lakeD=new Map();
      for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++){const ii=clamp(ci+di,0,cellsX-1),jj=clamp(cj+dj,0,cellsY-1);if(ii!==ci+di||jj!==cj+dj)continue;const k=jj*cellsX+ii,d2=(px[k]-x)**2+(py[k]-y)**2;
        if(d2<R2){const w=(1-d2/R2)**2;ws+=w;a+=w*hv[k];b+=w*sv[k];c+=w*pv[k];e+=w*wv[k];}
        const L=X.lakeOf[k];if(L>=0&&d2<LR2){const v=(lakeD.get(L)||0)+(1-d2/LR2)**2;lakeD.set(L,v);if(v>bestD){bestD=v;bestL=L;}}}
      if(ws>0){fH[o]=a/ws;fS[o]=b/ws;fP[o]=c/ws;fW[o]=e/ws;}else{const k=Math.min(cj,cellsY-1)*cellsX+Math.min(ci,cellsX-1);fH[o]=hv[k];fS[o]=sv[k];fP[o]=pv[k];fW[o]=wv[k];}
      fD[o]=bestD;fL[o]=bestL;}
    // Range layer per raster point, faded toward the coast and out over the template's own lakes.
    const RC=new Float32Array(N),RA=new Float32Array(N),VF=new Float32Array(N).fill(1),q={};
    if(RL)for(let o=0;o<N;o++){if(fH[o]<SEA_H-.5)continue;const f=rangeMask(fS[o])*(1-clamp((fW[o]-.15)/.35,0,1));if(f<=0)continue;
      rangeField(RL.ranges,(o%RW)*RS,Math.floor(o/RW)*RS,map.seed,q);RC[o]=q.core*f;RA[o]=q.apron*f;}
    map.raster={RW,RH,RS,H:fH,S:fS,P:fP,D:fD,L:fL,RC,RA,VF};
    // Lakes in world coordinates: level (metres) is set by the world from its own ground; outlet and centre here.
    // mountain: a lake the ranges dammed (a basin in the range layer rather than a lake of the template).
    map.lakes=X.lakes.map(L=>{let cx=0,cy=0;for(const k of L.cells){cx+=px[k];cy+=py[k];}cx/=L.cells.length;cy/=L.cells.length;
      return {id:L.id,cells:L.cells.length,height:L.height,metres:metres(Math.max(SEA_H+.5,L.height)),x:cx-map.ox,z:cy-map.oy,closed:L.closed,inlets:L.inlets,outletRiver:L.outletRiver??-1,flux:L.flux,evaporation:L.evaporation,
        mountain:!L.cells.some(k=>T[k]<SEA_H),outlet:L.outlet>=0&&!L.closed?{x:px[L.outlet]-map.ox,z:py[L.outlet]-map.oy}:null};});
    // Rivers in world coordinates (pts: x, z, flux, half-width), then mouths, deltas and confluences on the sampled ground.
    const at=sampler(map),o={},seaAt=(x,z)=>at(x,z,o).h<18.6,list=C.map(r=>({id:r.id,parent:r.parent,end:r.end,lake:r.lake,discharge:r.discharge,P:r.pts.map(p=>[p[0]-map.ox,p[1]-map.oy,p[2],p[3]])}));
    // Mouths meet the sea the world draws: a course is cut where the sampled ground (coast detail included) first lies
    // well under the sea (h < 18.6: no ground noise can lift it to land), or, where the coast detail put land over the map's
    // sea, carried on down toward the coast until it gets there; then 30 m on into open water.
    function mouth(P){
      let cut=-1;for(let i=1;i<P.length;i++)if(seaAt(P[i][0],P[i][1])){cut=i;break;}
      if(cut>0){const a=P[cut-1],b=P[cut];let lo=0,hi=1;for(let k=0;k<14;k++){const m=(lo+hi)/2;if(seaAt(a[0]+(b[0]-a[0])*m,a[1]+(b[1]-a[1])*m))hi=m;else lo=m;}
        P=P.slice(0,cut);P.push([a[0]+(b[0]-a[0])*hi,a[1]+(b[1]-a[1])*hi,a[2],a[3]]);}
      else{const l=P[P.length-1],pv=P[P.length-2]||l;let X=l[0],Z=l[1],ang=Math.atan2(l[1]-pv[1],l[0]-pv[0]);
        for(let k=0;k<200;k++){let best=Infinity,ba=ang;for(const da of [-.6,-.3,0,.3,.6]){const b=ang+da,v=at(X+Math.cos(b)*45,Z+Math.sin(b)*45,o).distToCoast+Math.abs(da)*25;if(v<best){best=v;ba=b;}}
          ang=ba;X+=Math.cos(ang)*15;Z+=Math.sin(ang)*15;const sea=seaAt(X,Z);if(k%2||sea)P.push([X,Z,l[2],l[3]]);if(sea)break;}}
      const e=P[P.length-1],f=P[P.length-2],L=Math.hypot(e[0]-f[0],e[1]-f[1])||1;P.push([e[0]+(e[0]-f[0])/L*30,e[1]+(e[1]-f[1])/L*30,e[2],e[3]]);
      return P;
    }
    for(const r of list)if(r.end==='ocean'&&r.P.length>1)r.P=mouth(r.P);
    const arrays=r=>{const P=r.P,m=P.length,x=new Float32Array(m),z=new Float32Array(m),f=new Float32Array(m),w=new Float32Array(m),d=new Float32Array(m),al=new Float32Array(m),cv=new Float32Array(m);
      for(let i=0;i<m;i++){x[i]=P[i][0];z[i]=P[i][1];f[i]=P[i][2];w[i]=P[i][3];d[i]=clamp(.2*Math.max(1,f[i])**.35,.3,3.5);if(i)al[i]=al[i-1]+Math.hypot(x[i]-x[i-1],z[i]-z[i-1]);}
      for(let i=1;i<m-1;i++){const ax=x[i]-x[i-1],az=z[i]-z[i-1],bx=x[i+1]-x[i],bz=z[i+1]-z[i],L=Math.hypot(ax,az)*Math.hypot(bx,bz)||1;cv[i]=Math.asin(clamp((ax*bz-az*bx)/L,-1,1))/(.5*(Math.hypot(ax,az)+Math.hypot(bx,bz))||1);}
      return {id:r.id,parent:r.parent,end:r.end,lake:r.lake,discharge:r.discharge,x,z,flux:f,hw:w,depth:d,along:al,curvature:cv,length:al[m-1],joins:[],...(r.extra||{})};};
    map.rivers=list.map(arrays);map.deltas=[];
    // Deltas and estuaries. A river reaching the sea at least ~5 m wide gets a mouth landform over its last Ld metres (300-900 m,
    // with its size): on a flat coast a delta (a fan from an apex, where 2-4 distributaries split off and run to the sea
    // across low marsh and sandbars), on a steeper one an estuary (the channel flares into a funnel). Distributaries are
    // rivers of their own (end 'ocean', parent: the river, distributary: {river, along}) so the world draws them like any
    // channel; the world levels the fan.
    const nMain=map.rivers.length;
    for(let ri=0;ri<nMain;ri++){const r=map.rivers[ri],m=r.x.length;if(r.end!=='ocean'||m<4)continue;
      const shore=m-2,hwM=r.hw[shore],Ls=r.along[shore];if(hwM<2.4||Ls<1500)continue;
      const Ld=clamp(220+hwM*45,300,900),aAl=Ls-Ld;let ia=0;while(ia<shore-1&&r.along[ia+1]<aAl)ia++;
      const u=clamp((aAl-r.along[ia])/((r.along[ia+1]-r.along[ia])||1),0,1),ax=r.x[ia]+(r.x[ia+1]-r.x[ia])*u,az=r.z[ia]+(r.z[ia+1]-r.z[ia])*u;
      const mx=r.x[shore],mz=r.z[shore],L=Math.hypot(mx-ax,mz-az)||1,dx=(mx-ax)/L,dz=(mz-az)/L;
      let low=at(ax,az,o).m;for(const sd of [-1,1])low=Math.max(low,at(ax-dz*sd*300,az+dx*sd*300,o).m);
      const hk=hash(ri,31,map.seed+977);
      if(low-SEA>9){const Le=clamp(200+hwM*30,250,700);map.deltas.push({river:ri,kind:'estuary',ax:mx-dx*Le,az:mz-dz*Le,mx,mz,dx,dz,R:Le,along:Ls-Le,shore:Ls,half:.5,hw:hwM,channels:[ri]});continue;}
      const k=hwM>9?4:hwM>5?3:2,D={river:ri,kind:'delta',ax,az,mx,mz,dx,dz,R:Ld*1.12,along:aAl,shore:Ls,half:.35,hw:hwM,channels:[ri]};
      for(let j=1;j<k;j++){const sd=(j%2?1:-1)*(hk<.5?1:-1),th=sd*(j<3?.38+.3*hash(ri,j,map.seed+979):.72+.18*hash(ri,j,map.seed+981)),c=Math.cos(th),sn=Math.sin(th),ex=dx*c-dz*sn,ez=dx*sn+dz*c;
        const P=[],cx=ax+dx*Ld*.35,cz=az+dz*Ld*.35,bx=ax+ex*Ld,bz=az+ez*Ld,steps=Math.ceil(Ld/25);let ok=false;
        for(let t=0;t<=steps;t++){const v=t/steps,w=1-v,X=w*w*ax+2*w*v*cx+v*v*bx,Z=w*w*az+2*w*v*cz+v*v*bz;P.push([X,Z,r.flux[ia]*.3,Math.max(1.5,hwM*(.35+.2*hash(ri,j,map.seed+983)))]);if(t>2&&seaAt(X,Z)){ok=true;break;}}
        for(let t=1;!ok&&t<=28;t++){const X=bx+ex*25*t,Z=bz+ez*25*t;P.push([X,Z,P[0][2],P[0][3]]);if(seaAt(X,Z))ok=true;}
        if(!ok)continue;const e=P[P.length-1];P.push([e[0]+ex*30,e[1]+ez*30,e[2],e[3]]);
        const id=map.rivers.length;map.rivers.push(arrays({id,parent:ri,end:'ocean',lake:-1,discharge:r.discharge*.3,P,extra:{distributary:{river:ri,along:aAl}}}));D.channels.push(id);D.half=Math.max(D.half,Math.abs(th)+.3);}
      map.deltas.push(D);}
    // Confluences: where each tributary meets its parent (along the parent, m) and the parent's width there.
    map.rivers.forEach((r,ri)=>{if(r.end!=='river'||r.parent<0||r.distributary)return;const P=map.rivers[r.parent],m=r.x.length,ex=r.x[m-1],ez=r.z[m-1];let bd=Infinity,ba=0,bw=0;
      for(let i=0;i<P.x.length-1;i++){const qx=P.x[i+1]-P.x[i],qz=P.z[i+1]-P.z[i],L2=qx*qx+qz*qz||1,u=clamp(((ex-P.x[i])*qx+(ez-P.z[i])*qz)/L2,0,1),d=Math.hypot(ex-P.x[i]-qx*u,ez-P.z[i]-qz*u);if(d<bd){bd=d;ba=P.along[i]+(P.along[i+1]-P.along[i])*u;bw=P.hw[i]+(P.hw[i+1]-P.hw[i])*u;}}
      if(bd<60){r.join={x:ex,z:ez,along:ba,hwP:bw};P.joins.push({river:ri,along:ba,hw:r.hw[m-1]});}});
    // Valleys: every raster point's nearest macro river within reach sets how far the river has cut into the range layer
    // (VF, the floodplain-to-hillside ramp; bigger rivers cut deeper and wider valleys) and fades the hills.
    const VC=new Float32Array(N);
    for(const r of map.rivers)for(let i=0;i<r.x.length-1;i++){const reach=Math.max(r.hw[i],r.hw[i+1])+70+9*16+260,x0=r.x[i]+map.ox,z0=r.z[i]+map.oy,x1=r.x[i+1]+map.ox,z1=r.z[i+1]+map.oy;
      const i0=Math.max(0,Math.floor((Math.min(x0,x1)-reach)/RS)),i1=Math.min(RW-1,Math.ceil((Math.max(x0,x1)+reach)/RS)),j0=Math.max(0,Math.floor((Math.min(z0,z1)-reach)/RS)),j1=Math.min(RH-1,Math.ceil((Math.max(z0,z1)+reach)/RS));
      const ex=x1-x0,ez=z1-z0,L2=ex*ex+ez*ez||1;
      for(let j=j0;j<=j1;j++)for(let ii=i0;ii<=i1;ii++){const x=ii*RS,z=j*RS,u=clamp(((x-x0)*ex+(z-z0)*ez)/L2,0,1),d=Math.hypot(x-x0-ex*u,z-z0-ez*u),hw=r.hw[i]+(r.hw[i+1]-r.hw[i])*u,ob=j*RW+ii;
        const Wv=70+9*hw+.55*RC[ob],v=clamp((d-hw)/Wv,0,1),f=v*v*(3-2*v);if(f<VF[ob]){VF[ob]=f;VC[ob]=clamp(.35+hw/14,.35,.9);}}}
    for(let ob=0;ob<N;ob++)if(VF[ob]<1){const cut=VC[ob]*(1-VF[ob]);RC[ob]*=1-cut;RA[ob]*=1-.5*cut;}
    // Segment index: 128 m buckets, each holding the segments whose influence (the flared width, 3.6 half-widths in an
    // estuary funnel and 2.6 elsewhere, + 110 m) reaches it.
    const B=128,REACH=110,bx0=-map.ox-256,bz0=-map.oy-256,BW=Math.ceil((W+512)/B),BH=Math.ceil((H+512)/B),lists=new Map(),funnel=new Set(map.deltas.filter(D=>D.kind==='estuary').map(D=>D.river));
    map.rivers.forEach((r,ri)=>{const F=funnel.has(ri)?3.6:2.6;for(let i=0;i<r.x.length-1;i++){const m=Math.max(r.hw[i],r.hw[i+1])*F+REACH;
      const i0=Math.floor((Math.min(r.x[i],r.x[i+1])-m-bx0)/B),i1=Math.floor((Math.max(r.x[i],r.x[i+1])+m-bx0)/B),j0=Math.floor((Math.min(r.z[i],r.z[i+1])-m-bz0)/B),j1=Math.floor((Math.max(r.z[i],r.z[i+1])+m-bz0)/B);
      for(let j=j0;j<=j1;j++)for(let ii=i0;ii<=i1;ii++){if(ii<0||j<0||ii>=BW||j>=BH)continue;const key=j*BW+ii;let l=lists.get(key);if(!l){l=[];lists.set(key,l);}l.push(ri,i);}}});
    const start=new Int32Array(BW*BH+1);for(let k=0;k<BW*BH;k++)start[k+1]=start[k]+((lists.get(k)||[]).length);const segs=new Int32Array(start[BW*BH]);for(const [k,l] of lists)segs.set(l,start[k]);
    map.segIndex={B,bx0,bz0,BW,BH,start,segs,REACH};
    // Mouth landform index: 512 m buckets listing the deltas and estuaries whose reach covers them.
    const DB=512,dl=new Map();map.deltas.forEach((D,di)=>{const m=D.R*1.3+60;for(let j=Math.floor((Math.min(D.az,D.mz)-m-bz0)/DB);j<=Math.floor((Math.max(D.az,D.mz)+m-bz0)/DB);j++)for(let i=Math.floor((Math.min(D.ax,D.mx)-m-bx0)/DB);i<=Math.floor((Math.max(D.ax,D.mx)+m-bx0)/DB);i++){const k=j*65536+i;if(!dl.has(k))dl.set(k,[]);dl.get(k).push(di);}});
    map.deltaNear=(x,z)=>dl.get(Math.floor((z-bz0)/DB)*65536+Math.floor((x-bx0)/DB))||NONE;
  }
  const NONE=Object.freeze([]);

  // ---- Continuous sampling ----
  // Cubic B-spline weights (C2): no cell or raster edges show in heights or slopes.
  function bw(t,o){const t2=t*t,t3=t2*t;o[0]=(1-3*t+3*t2-t3)/6;o[1]=(4-6*t2+3*t3)/6;o[2]=(1+3*t+3*t2-3*t3)/6;o[3]=t3/6;}
  const WX=[0,0,0,0],WZ=[0,0,0,0];
  // at(x, z): {h (Azgaar height after coast detail, ranges included), m (metres), land, distToCoast (m, + inland), precip
  // (0-1), temp (C, sea-level latitude minus lapse), lake (id or -1), lakeD (lake membership, > .5 inside), rc / ra (range
  // core / apron, m, included in m), valley (0 on a macro river's floodplain .. 1 clear of its valley), h0 (template
  // height: the coast)}. Writes into `out`.
  function sampler(map){
    const R=map.raster,{RW,RH}=R,seed=map.seed;
    return function at(x,z,out={}){
      // Light domain warp (~1.4 km wavelength, up to ~70 m) so smooth contours don't run parallel for long.
      const wx=x+(noise(x*.0007,z*.0007,seed+901)-.5)*140,wz=z+(noise(x*.0007,z*.0007,seed+903)-.5)*140;
      let mx=wx+map.ox,my=wz+map.oy;const ex=Math.max(0,-mx,mx-W),ez=Math.max(0,-my,my-H),e=Math.hypot(ex,ez);
      mx=clamp(mx,0,W);my=clamp(my,0,H);
      const gx=mx/RS,gz=my/RS,i=Math.floor(gx),j=Math.floor(gz);bw(gx-i,WX);bw(gz-j,WZ);
      let h=0,sd=0,p=0,d=0,bl=-1,bd=0;
      for(let b=0;b<4;b++){const jj=clamp(j-1+b,0,RH-1),wz2=WZ[b];for(let a=0;a<4;a++){const o=jj*RW+clamp(i-1+a,0,RW-1),w=WX[a]*wz2;h+=w*R.H[o];sd+=w*R.S[o];p+=w*R.P[o];const dv=R.D[o];d+=w*dv;if(dv>bd&&w>.02){bd=dv;bl=R.L[o];}}}
      if(e>0){h-=e/40;sd-=e;d=0;}
      // Coastline detail: fractal noise at ~480, 220 and 110 m wavelengths shapes coves, headlands and small islets,
      // fading out away from the coast so inland ground and the open sea are untouched.
      const amp=4.2*clamp(1-Math.abs(sd)/650,0,1);
      if(amp>0){const n=noise(x/480,z/480,seed+911)*.55+noise(x/220,z/220,seed+913)*.3+noise(x/110,z/110,seed+915)*.15-.5;h+=amp*n*2;sd+=n*2*amp*60;}
      // Range layer and valleys, sampled without the warp so valleys stay centred on the river courses.
      let rc=0,ra=0,vf=0;
      if(h>=SEA_H){const ux=clamp(x+map.ox,0,W)/RS,uz=clamp(z+map.oy,0,H)/RS,I=Math.floor(ux),J=Math.floor(uz);bw(ux-I,WX);bw(uz-J,WZ);
        for(let b=0;b<4;b++){const jj=clamp(J-1+b,0,RH-1),wz2=WZ[b];for(let a=0;a<4;a++){const o=jj*RW+clamp(I-1+a,0,RW-1),w=WX[a]*wz2;rc+=w*R.RC[o];ra+=w*R.RA[o];vf+=w*R.VF[o];}}}
      else vf=1;
      out.rc=Math.max(0,rc);out.ra=Math.max(0,ra);out.valley=clamp(vf,0,1);out.h0=h;
      out.m=(h>=SEA_H?upland(metres(h)):metres(h))+out.rc+out.ra;out.h=h>=SEA_H?invMetres(out.m):h;out.land=h>=SEA_H;out.distToCoast=sd;out.precip=clamp(p,0,1);
      const lat=latitudeAt(map.latC,z+map.oy);out.latitude=lat;out.temp=29-.4*Math.abs(lat)-cooling(out.m);
      out.lake=d>.05?bl:-1;out.lakeD=d;return out;
    };
  }
  // Nearest macro river channel to (x, z). Writes {e (normalized distance: (metres beyond the half-width)/size + 2.3),
  // dist, hw, size, river, seg, t (0-1 along the segment), dx, dz (downstream unit vector), flux} into out, or returns
  // null when no channel is within reach.
  function riverQuery(map){
    const I=map.segIndex,rv=map.rivers;
    return function near(x,z,out){
      const bi=Math.floor((x-I.bx0)/I.B),bj=Math.floor((z-I.bz0)/I.B);if(bi<0||bj<0||bi>=I.BW||bj>=I.BH)return null;
      const k=bj*I.BW+bi;let best=999,found=false;
      for(let q=I.start[k];q<I.start[k+1];q+=2){const r=rv[I.segs[q]],i=I.segs[q+1],ax=r.x[i],az=r.z[i],ex=r.x[i+1]-ax,ez=r.z[i+1]-az,L2=ex*ex+ez*ez||1;
        const t=clamp(((x-ax)*ex+(z-az)*ez)/L2,0,1),qx=ax+ex*t,qz=az+ez*t,dist=Math.hypot(x-qx,z-qz),hw=r.hw[i]+(r.hw[i+1]-r.hw[i])*t,size=clamp(.6+.4*(hw-2)/7,.6,1),e=(dist-hw)/size+2.3;
        if(e<best){best=e;found=true;const L=Math.sqrt(L2);Object.assign(out,{e,dist,hw,size,river:I.segs[q],seg:i,t,dx:ex/L,dz:ez/L,x:qx,z:qz,flux:r.flux[i]+(r.flux[i+1]-r.flux[i])*t});}}
      return found?out:null;
    };
  }
  const cache=new Map();
  // One map per (seed, template), shared by every world created in this realm.
  function get(seed,template=null){
    const key=(Number(seed)>>>0)+':'+(template||'');let m=cache.get(key);if(m)return m;
    m=generate(seed,template);m.at=sampler(m);m.riverNear=riverQuery(m);m.metres=metres;
    cache.set(key,m);if(cache.size>4)cache.delete(cache.keys().next().value);return m;
  }
  // RGBA image of the map (Azgaar-style height colours, rivers, lakes), w x h pixels covering the whole map, for the
  // minimap tool and an in-app world map. Sampled from the continuous fields, so it shows what the voxel world shows.
  function image(map,w=640,hgt=400,{rivers=true,home=true,ranges=false}={}){
    const rgba=new Uint8ClampedArray(w*hgt*4),o={},pal=[[0,[28,52,98]],[10,[42,78,140]],[18,[70,120,180]],[19.9,[110,160,200]],[20,[132,186,110]],[28,[170,206,120]],[38,[230,222,140]],[50,[236,178,96]],[65,[214,110,70]],[80,[160,72,60]],[95,[128,96,88]],[112,[178,174,170]],[128,[248,248,248]]];
    const col=v=>{for(let i=1;i<pal.length;i++)if(v<=pal[i][0]){const [a,A]=pal[i-1],[b,B]=pal[i],t=(v-a)/(b-a||1);return A.map((c,k)=>c+(B[k]-c)*t);}return pal[pal.length-1][1];};
    for(let j=0;j<hgt;j++)for(let i=0;i<w;i++){const x=(i+.5)/w*W-map.ox,z=(j+.5)/hgt*H-map.oy;map.at(x,z,o);let c=col(o.h);if(o.land){const dz=map.at(x+40,z-40,{}).h-o.h;c=c.map(v=>v*clamp(1+dz*.05,.75,1.2));}
      if(o.lakeD>.5)c=[88,146,196];const p=(j*w+i)*4;rgba[p]=c[0];rgba[p+1]=c[1];rgba[p+2]=c[2];rgba[p+3]=255;}
    const plot=(x,z,r,c)=>{const cx=(x+map.ox)/W*w,cy=(z+map.oy)/H*hgt;for(let b=Math.floor(cy-r);b<=cy+r;b++)for(let a=Math.floor(cx-r);a<=cx+r;a++){if(a<0||b<0||a>=w||b>=hgt||Math.hypot(a+.5-cx,b+.5-cy)>r)continue;const p=(b*w+a)*4;rgba[p]=c[0];rgba[p+1]=c[1];rgba[p+2]=c[2];}};
    if(rivers)for(const r of map.rivers)for(let i=0;i<r.x.length-1;i++){const L=Math.hypot(r.x[i+1]-r.x[i],r.z[i+1]-r.z[i]),steps=Math.ceil(L/(W/w/2));for(let s=0;s<=steps;s++){const t=s/steps;plot(r.x[i]+(r.x[i+1]-r.x[i])*t,r.z[i]+(r.z[i+1]-r.z[i])*t,Math.max(.5,r.hw[i]/(W/w)*2.2),[60,110,190]);}}
    if(ranges)for(const r of map.ranges)for(let i=0;i<r.x.length;i++)plot(r.x[i],r.z[i],.8,r.kind==='minor'?[90,60,40]:r.kind==='branch'?[60,40,30]:[20,20,20]);
    if(ranges)for(const v of map.volcanoes||[])plot(v.x,v.z,3,[255,90,0]);
    if(home)plot(0,0,3,[220,30,30]);
    return rgba;
  }
  const api={get,generate,image,metres,invMetres,cooling,LAPSE,TEMPLATES,WEIGHTS,WIDTH:W,HEIGHT:H,SEA_H,SEA,hash,noise};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MacroMap=api;
})(typeof globalThis==='object'?globalThis:this);
