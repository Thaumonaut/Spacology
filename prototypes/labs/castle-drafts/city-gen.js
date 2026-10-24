// City drafts: a seeded walled fantasy city: a central plaza, radial avenues and ring streets, a river with bridges,
// an outer wall with gates, a castle on its hill, and thousands of buildings, each a random type for its district
// (house, shop, inn, smithy, warehouse, chapel, tower house, guildhall, market hall, bathhouse, barracks, a cathedral).
// Every building has an interior (rooms, storeys, stairs and furniture), built only when asked for (near the walker).
// Output parts use CastleGen's shapes; buildings carry their own plaster and roof colours (`col`).
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(root.CastleGen||require('./castle-gen.js'));else root.CityGen=factory(root.CastleGen);})(this,function(CastleGen){
  'use strict';
  const TAU=Math.PI*2,G=6;// ground level: rivers run 6 m below in walled channels
  function rng(seed){let a=seed>>>0||1;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  const PLASTER=[[.97,.94,.88],[.98,.9,.78],[.96,.84,.8],[.9,.92,.96],[.94,.9,.74],[.99,.97,.94],[.88,.84,.78]];
  const ROOFS=[[.8,.36,.24],[.8,.36,.24],[.86,.48,.26],[.72,.3,.24],[.36,.46,.66],[.34,.58,.54],[.62,.3,.34]];
  // Building types: weights by district and the footprint/height each takes.
  const TYPES={
    house:{w:[7,12],d:[10,15],st:[2,4],g:4},shop:{w:[7,12],d:[10,14],st:[2,3],g:4.4},inn:{w:[12,18],d:[12,16],st:[2,3],g:4.6},
    smithy:{w:[9,13],d:[10,14],st:[1,1],g:6},warehouse:{w:[12,20],d:[14,22],st:[1,2],g:6},chapel:{w:[10,13],d:[18,24],st:[1,1],g:12},
    towerhouse:{w:[7,8],d:[7,8],st:[5,7],g:4},guildhall:{w:[16,24],d:[22,30],st:[2,2],g:8},market:{w:[14,18],d:[28,36],st:[2,2],g:5.5},
    bath:{w:[14,18],d:[14,18],st:[1,1],g:8},barracks:{w:[10,13],d:[26,34],st:[2,2],g:4}};
  const ZONES={
    plaza:{guildhall:2,market:2,inn:3,shop:5,towerhouse:1},avenue:{shop:5,inn:2,house:4,chapel:.4,towerhouse:.8,bath:.4},
    town:{house:10,shop:1.6,inn:.6,smithy:.6,warehouse:.6,chapel:.3,towerhouse:.8,bath:.2},edge:{warehouse:3,smithy:3,barracks:2,house:7}};
  function generate(seed,opts={}){
    const R=rng(seed),r=(a,b)=>a+(b-a)*R(),pick=a=>a[Math.floor(R()*a.length)],S=opts.scale||1;
    const Rw=r(720,920)*S,plazaR=r(60,85)*S,gap=r(95,125),nA=Math.round(r(6,8)),a0=R()*TAU,pal=CastleGen.PALETTES[Math.floor(R()*CastleGen.PALETTES.length)];
    const parts=[],add=(t,o,mat)=>{const q={t,mat,...o};parts.push(q);return q;};
    // ---- River: a meander crossing the city, kept clear of the plaza.
    const side=R()<.5?-1:1,xr0=side*(plazaR+r(160,280)),rA=r(30,70),rL=r(180,320),rP=R()*TAU,rW=r(40,64),ang=r(-.5,.5),ca=Math.cos(ang),sa=Math.sin(ang);
    const toR=(x,z)=>[x*ca+z*sa,-x*sa+z*ca],riverOff=(x,z)=>{const [u,v]=toR(x,z);return u-(xr0+rA*Math.sin(v/rL+rP));},inRiver=(x,z,pad=0)=>Math.abs(riverOff(x,z))<rW/2+pad;
    // ---- Occupancy (3 m cells): streets, plaza, river, walls and the castle hill are reserved before any building.
    const OC=3,occ=new Set(),key=(i,j)=>i*100003+j,mark=(x,z)=>occ.add(key(Math.floor(x/OC),Math.floor(z/OC))),isOcc=(x,z)=>occ.has(key(Math.floor(x/OC),Math.floor(z/OC)));
    const markDisk=(x,z,rad)=>{for(let i=Math.floor((x-rad)/OC);i<=Math.floor((x+rad)/OC);i++)for(let j=Math.floor((z-rad)/OC);j<=Math.floor((z+rad)/OC);j++){if(Math.hypot((i+.5)*OC-x,(j+.5)*OC-z)<rad)occ.add(key(i,j));}};
    const streets=[];
    const street=(x0,z0,x1,z1,w,kind)=>{streets.push({x0,z0,x1,z1,w,kind});const L=Math.hypot(x1-x0,z1-z0),n=Math.ceil(L/1.5);for(let k=0;k<=n;k++){const t=k/n;markDisk(x0+(x1-x0)*t,z0+(z1-z0)*t,w/2+1);}};
    markDisk(0,0,plazaR+2);
    // ---- Castle on its hill, out along one avenue on the side away from the river.
    const radials=[];for(let i=0;i<nA;i++)radials.push(a0+i/nA*TAU+r(-.08,.08));
    const cA=radials.reduce((b,a)=>Math.cos(a)*-side>Math.cos(b)*-side?a:b,radials[0]),cD=Rw*r(.42,.55),cx=Math.cos(cA)*cD,cz=Math.sin(cA)*cD;
    // The castle stands on its own hill (with a road winding up, gate toward the plaza) or on level ground in the city.
    const onHill=opts.castleSeat?opts.castleSeat==='hill':R()<.6,flare=2.4;
    const castle=CastleGen.generate(seed*7+3,{style:onHill?'hill':'flat',ground:G,flare,gate:Math.atan2(-cz,-cx),layout:opts.castleLayout||pick(['rings','spur','palace','cluster']),scale:(onHill?r(.3,.38):r(.26,.32))*S,palette:CastleGen.PALETTES.indexOf(pal)});
    castle.parts=castle.parts.filter(p=>p.t!=='land');const hillR=onHill?castle.radius*1.25*flare+10:castle.radius*1.1+10;markDisk(cx,cz,hillR);
    // ---- Streets: radial avenues from the plaza to the gates, ring streets, and lanes splitting long blocks.
    const rings=[];for(let rr=plazaR+gap*.8;rr<Rw-45;rr+=gap*r(.85,1.15))rings.push(rr);
    for(const a of radials){if(a===cA){street(Math.cos(a)*plazaR,Math.sin(a)*plazaR,Math.cos(a)*(cD-hillR*.9),Math.sin(a)*(cD-hillR*.9),16,'avenue');continue;}
      street(Math.cos(a)*plazaR,Math.sin(a)*plazaR,Math.cos(a)*(Rw+60),Math.sin(a)*(Rw+60),14,'avenue');}
    const ringSeg=(rr,w,kind,from=0,to=TAU)=>{const n=Math.max(8,Math.ceil(rr*(to-from)/18));for(let k=0;k<n;k++){const t0=from+(to-from)*k/n,t1=from+(to-from)*(k+1)/n;street(Math.cos(t0)*rr,Math.sin(t0)*rr,Math.cos(t1)*rr,Math.sin(t1)*rr,w,kind);}};
    for(const rr of rings)ringSeg(rr,8,'ring');
    const sorted=[...radials].sort((a,b)=>a-b);
    for(let k=0;k+1<rings.length;k++)for(let i=0;i<sorted.length;i++){const s0=sorted[i],s1=i+1<sorted.length?sorted[i+1]:sorted[0]+TAU,mid=(rings[k]+rings[k+1])/2,n=Math.floor(mid*(s1-s0)/r(110,150));
      for(let q=1;q<=n;q++){const a=s0+(s1-s0)*q/(n+1);street(Math.cos(a)*rings[k],Math.sin(a)*rings[k],Math.cos(a)*rings[k+1],Math.sin(a)*rings[k+1],5,'lane');}}
    // River banks are kept clear (quays), and the wall band.
    const hasRiver=(x,z)=>inRiver(x,z,5);
    // ---- Buildings along every street, both sides, front door to the street.
    const buildings=[];
    const zoneAt=(x,z,kind)=>{const d=Math.hypot(x,z);return d<plazaR+40?'plaza':d>Rw-90?'edge':kind==='avenue'?'avenue':'town';};
    const pickType=z=>{const w=ZONES[z];let t=R()*Object.values(w).reduce((a,b)=>a+b,0);for(const [k,v] of Object.entries(w)){if((t-=v)<0)return k;}return 'house';};
    const fits=(x,z,w,d,rot)=>{const c=Math.cos(rot),s=Math.sin(rot);for(let u=-w/2+.5;u<=w/2;u+=2)for(let v=-d/2+.5;v<=d/2;v+=2){const px=x+u*c-v*s,pz=z+u*s+v*c;if(isOcc(px,pz)||hasRiver(px,pz)||Math.hypot(px,pz)>Rw-12)return false;}return true;};
    const claim=(x,z,w,d,rot)=>{const c=Math.cos(rot),s=Math.sin(rot);for(let u=-w/2;u<=w/2+.1;u+=1.5)for(let v=-d/2;v<=d/2+.1;v+=1.5)mark(x+u*c-v*s,z+u*s+v*c);};
    function place(type,x,z,w,d,rot,doorSide){const T=TYPES[type],n=Math.round(r(T.st[0],T.st[1])),st=[0];for(let i=1;i<n;i++)st.push(T.g+(i-1)*3.6);
      const H=type==='chapel'?r(11,16):type==='bath'?8:T.g+(n-1)*3.6+.8;
      const b={id:buildings.length,type,x,z,w,d,rot,doorSide,storeys:st,H,wall:pick(PLASTER),roof:type==='chapel'||type==='guildhall'?pick([[.36,.46,.66],[.34,.58,.54]]):pick(ROOFS),pitch:r(.6,1.05),seed:Math.floor(R()*1e9)};
      buildings.push(b);claim(x,z,w,d,rot);return b;}
    // The cathedral first, facing the plaza on the side opposite the castle.
    // It lies along the plaza's edge between the two avenues nearest the side opposite the castle, door to the plaza.
    {const opp=cA+Math.PI,srt=[...radials].sort((p,q)=>p-q),cw=r(26,32),dd=plazaR+cw/2+5;let best=null;
      for(let i=0;i<srt.length;i++){const lo=srt[i],hi=i+1<srt.length?srt[i+1]:srt[0]+TAU,m=(lo+hi)/2,score=(hi-lo)*(1.6+Math.cos(m-opp));if(!best||score>best.score)best={lo,hi,m,score};}
      // The chord between the two avenues, less their half-widths and a margin.
      const a=best.m,arc=2*dd*Math.sin((best.hi-best.lo)/2)-30,cl=Math.min(r(64,84),arc),x=Math.cos(a)*dd,z=Math.sin(a)*dd,rot=a+Math.PI/2;
      if(cl>40&&fits(x,z,cl,cw,rot)){const b=place('chapel',x,z,cl,cw,rot,1);b.type='cathedral';b.H=r(30,38);b.storeys=[0];}}
    for(const s of streets){const L=Math.hypot(s.x1-s.x0,s.z1-s.z0),rot=Math.atan2(s.z1-s.z0,s.x1-s.x0),nx=-Math.sin(rot),nz=Math.cos(rot);
      for(const sd of [-1,1]){let t=r(0,4);while(t<L){const zone=zoneAt(s.x0+(s.x1-s.x0)*t/L,s.z0+(s.z1-s.z0)*t/L,s.kind);let type=pickType(zone);const T=TYPES[type],w=r(T.w[0],T.w[1]),d=r(T.d[0],T.d[1]);
        const ut=t+w/2,px=s.x0+(s.x1-s.x0)*ut/L,pz=s.z0+(s.z1-s.z0)*ut/L,off=s.w/2+1.2+d/2,x=px+nx*sd*off,z=pz+nz*sd*off;
        // Square buildings (tower houses, baths) stand any way; the rest keep their long side to the street.
        if(ut+w/2<=L&&fits(x,z,w,d,rot)){place(type,x,z,w,d,rot,-sd);t+=w+r(0,1.5);}else t+=r(2,4);}}}
    // ---- The static city: ground, quays, streets, plaza, bridges, walls.
    const span=Rw+340,C=25;
    for(let i=Math.floor(-span/C);i<Math.ceil(span/C);i++)for(let j=Math.floor(-span/C);j<Math.ceil(span/C);j++){const x0=i*C,z0=j*C,xc=x0+C/2,zc=z0+C/2;if(inRiver(xc,zc))continue;
      if(inRiver(xc,zc,C))add('box',{x:xc,y:-4,z:zc,w:C,h:G+4,d:C,rot:0},'paving');else add('quad',{x0,z0,x1:x0+C,z1:z0+C,y:G},'grass');}
    for(const s of streets){const L=Math.hypot(s.x1-s.x0,s.z1-s.z0),rot=Math.atan2(s.z1-s.z0,s.x1-s.x0),n=Math.max(1,Math.ceil(L/12));
      for(let k=0;k<n;k++){const t0=k/n,t1=(k+1)/n,x=s.x0+(s.x1-s.x0)*(t0+t1)/2,z=s.z0+(s.z1-s.z0)*(t0+t1)/2;
        if(inRiver(x,z,2))add('arch',{x,y:-1,z,w:L/n+.3,h:G+1.4,d:s.w+1,rot,span:L/n*.75},'stone2');else add('box',{x,y:G-.2,z,w:L/n+.3,h:.32,d:s.w,rot,nocol:false},'stone2');}}
    // Plaza: paving disk, a fountain and a statue column.
    add('disk',{x:0,y:G-.45,z:0,r:plazaR},'stone2');add('cyl',{x:0,y:G,z:0,r:9,h:1.2},'stone');add('cyl',{x:0,y:G,z:0,r:1.6,h:9},'stone');add('cone',{x:0,y:G+9,z:0,r:2.6,h:4},'gold');
    // Outer wall: towers every ~70 m, gatehouses where avenues leave, water gates over the river.
    {const n=Math.round(Rw*TAU/70),wa=[];for(let i=0;i<n;i++)wa.push(i/n*TAU);
      for(let i=0;i<n;i++){const t0=wa[i],t1=i+1<n?wa[i+1]:TAU,p0=[Math.cos(t0)*Rw,Math.sin(t0)*Rw],p1=[Math.cos(t1)*Rw,Math.sin(t1)*Rw],mx=(p0[0]+p1[0])/2,mz=(p0[1]+p1[1])/2,len=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]),rot=Math.atan2(p1[1]-p0[1],p1[0]-p0[0]);
        if(inRiver(mx,mz,4)){add('arch',{x:mx,y:-1,z:mz,w:len,h:G+16,d:6,rot,span:len*.6},'stone');continue;}
        const gate=radials.some(a=>a!==cA&&Math.abs(Math.atan2(Math.sin(a-(t0+t1)/2),Math.cos(a-(t0+t1)/2)))<(t1-t0)/2);
        if(gate)add('gatewall',{x:mx,y:G-2,z:mz,w:len,h:18,d:6,rot,gap:12,gateH:11,crenel:true},'stone');else add('box',{x:mx,y:G-2,z:mz,w:len,h:18,d:6,rot,crenel:true},'stone');}
      for(const t of wa){const x=Math.cos(t)*Rw,z=Math.sin(t)*Rw;if(inRiver(x,z,6))continue;add('cyl',{x,y:G-2,z,r:7,h:28},'stone');add('cone',{x,y:G+26,z,r:8,h:20},'roof');}}
    const plazaA=cA+Math.PI*.5,spawn={x:Math.cos(plazaA)*(plazaR-6),y:G+1,z:Math.sin(plazaA)*(plazaR-6),yaw:Math.atan2(cz-Math.sin(plazaA)*(plazaR-6),cx-Math.cos(plazaA)*(plazaR-6))};
    return {seed,radius:Rw,ground:G,palette:pal,parts,buildings,castle,castleAt:{x:cx,z:cz},spawn,river:{inRiver}};
  }
  // ---- One building's parts. interior=false: a closed box and roof (far); true: a hollow shell with rooms and props.
  function buildingParts(b,interior){
    const out=[],R=rng(b.seed),r=(a,c)=>a+(c-a)*R(),c=Math.cos(b.rot),s=Math.sin(b.rot),W=(u,v)=>[b.x+u*c-v*s,b.z+u*s+v*c];
    const add=(t,o,mat)=>{out.push({t,mat,...o});};
    const prop=(u,v,w,d,h,y,col,rot=0)=>{const [x,z]=W(u,v);add('box',{x,y,z,w,h,d,rot:b.rot+rot,col});};
    const WOOD=[.56,.4,.27],DARK=[.28,.25,.25],CLOTH=[.72,.34,.3],STONE=[.85,.82,.76],y0=G,top=G+b.H,th=.6,iw=b.w-2*th,id=b.d-2*th;
    const roofH=b.d*b.pitch*.5,type=b.type;
    // Exterior bodies and roofs by type.
    const body=(o,mat)=>interior?add('shell',o,mat):add('box',{x:o.x,y:o.y,z:o.z,w:o.w,h:o.h,d:o.d,rot:o.rot,col:o.col},mat);
    if(type==='market'){
      // Open arcade below, a closed hall above reached by an outside stair.
      const up=y0+5;for(let u=-b.w/2+1;u<=b.w/2-1+.01;u+=(b.w-2)/Math.round((b.w-2)/4))for(const v of [-b.d/2+1,b.d/2-1]){const [x,z]=W(u,v);add('cyl',{x,y:y0,z,r:.55,h:5},'stone');}
      for(let v=-b.d/2+1;v<=b.d/2-1+.01;v+=(b.d-2)/Math.round((b.d-2)/4))for(const u of [-b.w/2+1,b.w/2-1]){const [x,z]=W(u,v);add('cyl',{x,y:y0,z,r:.55,h:5},'stone');}
      prop(0,0,b.w,b.d,.6,up-.6,STONE);body({x:b.x,y:up,z:b.z,w:b.w,h:b.H-5,d:b.d,rot:b.rot,th,floor:up,storeys:[0],door:{side:b.doorSide,u:b.w/2-2.5,wid:2,hgt:3},col:b.wall},'plaster');
      if(interior){for(let i=0;i<6;i++)prop(r(-b.w/3,b.w/3),r(-b.d/3,b.d/3),2.4,1.4,1,y0,[CLOTH,WOOD,[.4,.56,.7]][i%3]);const [ax,az]=W(b.w/2-2.5,b.doorSide*(b.d/2+3)),[bx,bz]=W(b.w/2-2.5-12,b.doorSide*(b.d/2+3));add('ramp',{x0:bx,z0:bz,y0:y0,x1:ax,z1:az,y1:up,w:2.4,base:y0},'stone2');}
      add('gable',{x:b.x,y:top,z:b.z,w:b.w,d:b.d+1.2,h:roofH,rot:b.rot,col:b.roof},'roof');return out;}
    const doorU=type==='cathedral'?0:r(-.25,.25)*iw,doorW=type==='smithy'||type==='warehouse'?4:type==='cathedral'?5:1.6,doorH=type==='cathedral'?8:type==='smithy'||type==='warehouse'?4:2.6;
    const door=type==='cathedral'?{side:1,u:0,wid:6,hgt:9}:{side:b.doorSide,u:doorU,wid:doorW,hgt:doorH};
    body({x:b.x,y:y0-1,z:b.z,w:b.w,h:b.H+1,d:b.d,rot:b.rot,th:type==='cathedral'?1.6:th,floor:y0,storeys:b.storeys,door,col:b.wall,grand:type==='cathedral'||type==='guildhall'},'plaster');
    if(type==='bath'){const [x,z]=W(0,0);add('cyl',{x,y:top,z,r:Math.min(b.w,b.d)*.42,h:2},'stone');add('dome',{x,y:top+2,z,r:Math.min(b.w,b.d)*.44,col:[.34,.58,.54]},'roof');}
    else add('gable',{x:b.x,y:top,z:b.z,w:b.w,d:b.d+1.2,h:type==='cathedral'?b.d*.7:roofH,rot:b.rot,col:b.roof},'roof');
    // Bell towers (chapels at the front corner, the cathedral's two west towers and a crossing spire), hollow with a stair.
    // The door opens toward the building's middle; the top landing is open over the stair's last turn.
    const belfry=(u,v,tr,h)=>{const [x,z]=W(u,v);if(interior){add('tube',{x,y:y0-1,z,r:tr,h:h+1,th:.8,doors:[{a:Math.atan2(b.z-z,b.x-x),y0,y1:y0+2.8}]},'stone');const ri=tr-.8,y1=y0+h-3,a1=(y1-y0)/.45*1.05/(ri*.55+.6);
        add('disk',{x,y:y0-.6,z,r:ri},'stone2');add('spiral',{x,z,r:ri,y0,y1,a0:0},'stone2');add('disk',{x,y:y1-.6,z,r:ri,hole:[a1-1.9,a1+.05]},'stone2');}
      else add('cyl',{x,y:y0-1,z,r:tr,h:h+1},'stone');add('cone',{x,y:y0+h,z,r:tr*1.15,h:tr*3.2,col:b.roof},'roof');};
    if(type==='chapel')belfry(-b.w/2+2.6,b.doorSide*(b.d/2-2.6),2.6,b.H+r(8,14));
    if(type==='cathedral'){for(const su of [-1,1])belfry(su*(b.w/2-4.5),b.d/2-4.5,4.2,b.H+r(25,40));const [x,z]=W(b.w*.1,0);add('cyl',{x,y:top,z,r:3.2,h:12},'stone');add('cone',{x,y:top+12,z,r:3.8,h:30,col:b.roof},'roof');}
    if(type==='towerhouse'){const [x,z]=W(0,0);add('box',{x,y:top,z,w:b.w,h:1.2,d:b.d,rot:b.rot,crenel:true},'stone');}
    if(type==='smithy'){const [x,z]=W(-b.w/2+2,0);add('cyl',{x,y:y0,z,r:.9,h:b.H+roofH+3,nocol:true},'stone');}
    if(!interior)return out;
    // ---- Rooms and furniture.
    const F=(sy)=>y0+sy;
    const hearth=(u,v,y)=>{prop(u,v,2.2,.9,1.6,y,DARK);prop(u,v,2.6,1.1,.3,y+1.6,STONE);};
    const table=(u,v,y,long=1.6)=>{prop(u,v,long,.9,.08,y+.75,WOOD);prop(u,v,long*.85,.12,.75,y,WOOD);for(const sv of [-1,1])prop(u,v+sv*.85,long,.35,.45,y,WOOD);};
    const bed=(u,v,y)=>{prop(u,v,2,1.1,.45,y,WOOD);prop(u-.65,v,.6,.9,.15,y+.45,[.92,.9,.86]);prop(u+.2,v,1.3,1.05,.12,y+.45,CLOTH);};
    // A partition across the house on each floor, with a doorway, leaving the stairwell end open.
    const part=(u,y,h)=>{const [x,z]=W(u,0);add('gatewall',{x,y,z,w:id,h,d:.3,rot:b.rot+Math.PI/2,gap:1.2,gateH:2.4},'plaster');};
    const stairU=iw/2-1.5-Math.min(iw-5,3.6/Math.tan(.62));
    if(type==='house'||type==='shop'||type==='inn'||type==='towerhouse'||type==='barracks'){
      b.storeys.forEach((sy,i)=>{const y=F(sy),hh=(i+1<b.storeys.length?b.storeys[i+1]:b.H)-sy-.6;
        if(i===0){if(type==='shop'){prop(0,b.doorSide*-(id/2-1.6),iw*.5,.7,1,y,WOOD);for(let k=0;k<3;k++)prop(-iw/2+1.6+k*2.4,-b.doorSide*(id/2-.35),2,.5,2.2,y,WOOD);}
          else if(type==='inn'){prop(-iw/2+1,0,.8,id*.6,1.1,y,WOOD,0);const n=Math.max(2,Math.floor(iw/4));for(let k=0;k<n;k++)table(-iw/2+3+k*(iw-5)/Math.max(1,n-1),r(-id/5,id/5),y);hearth(stairU-2,-b.doorSide*(id/2-.5),y);}
          else if(type==='barracks'){for(let k=0;k<Math.floor(iw/2.4);k++)for(const sv of [-1,1])bed(-iw/2+1.4+k*2.4,sv*(id/2-1.2),y);}
          else{table(-iw/4,0,y);hearth(-iw/2+1.2,0,y);}}
        else{const n=type==='inn'?Math.floor(iw/3):2;for(let k=0;k<n;k++)bed(-iw/2+1.5+k*2.8,(k%2?1:-1)*(id/2-1),y);prop(-iw/2+.6,0,.9,.5,.6,y,WOOD);}
        if(iw>9&&type!=='barracks'&&type!=='towerhouse')part((-iw/2+stairU)/2,y,hh);});}
    else if(type==='smithy'){prop(-iw/2+2,0,2.6,2.6,1.2,y0,DARK);prop(0,0,.8,.4,.8,y0,[.35,.35,.4]);prop(iw/3,id/3,1.2,1.2,1,y0,WOOD);}
    else if(type==='warehouse'){for(let k=0;k<12;k++){const sz=r(.9,1.8);prop(r(-iw/2+1,iw/2-1),r(-id/2+1,id/2-1),sz,sz,sz,y0,WOOD);}}
    else if(type==='guildhall'){table(0,0,y0,iw*.6);for(let k=1;k<5;k++)for(const sv of [-1,1]){const [x,z]=W(-iw/2+k*iw/5,sv*id*.3);add('cyl',{x,y:y0,z,r:.5,h:b.storeys[1]},'stone');}hearth(-iw/2+1.2,0,y0);}
    else if(type==='bath'){prop(0,0,iw*.6,id*.6,.5,y0,[.3,.6,.7]);}
    else if(type==='chapel'||type==='cathedral'){const n=Math.floor(iw/2.2)-3;for(let k=0;k<n;k++)for(const sv of [-1,1])prop(-iw/2+4+k*2.2,sv*id*.22,.5,id*.3,.5,y0,WOOD);prop(iw/2-2.5,0,1.6,3,1.1,y0,[.92,.88,.8]);
      if(type==='cathedral')for(let k=1;k<10;k++)for(const sv of [-1,1]){const [x,z]=W(-iw/2+k*iw/10,sv*id*.36);add('cyl',{x,y:y0,z,r:1,h:b.H-1},'stone');}}
    return out;
  }
  return {generate,buildingParts,TYPES};
});
