// City drafts: a seeded walled fantasy city: a central plaza, radial avenues and ring streets, a river with bridges,
// an outer wall with gates, a castle on its hill, and thousands of buildings, each a random type for its district
// (house, shop, inn, smithy, warehouse, chapel, tower house, guildhall, market hall, bathhouse, barracks, a cathedral).
// Every building has an interior (rooms, storeys, stairs and furniture), built only when asked for (near the walker).
// Output parts use CastleGen's shapes; buildings carry their own plaster and roof colours (`col`).
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(root.CastleGen||require('./castle-gen.js'));else root.CityGen=factory(root.CastleGen);})(this,function(CastleGen){
  'use strict';
  const TAU=Math.PI*2,G=6,Q=4.5;// G: the mean ground level; Q: quay level (the river's water is at 0)
  function vnoise(x,z,s){const h=(i,j)=>{let n=Math.imul(i,374761393)^Math.imul(j,668265263)^Math.imul(s,2246822519);n=Math.imul(n^n>>>13,1274126177);return ((n^n>>>16)>>>0)/4294967296;};
    const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return (h(i,j)*(1-u)+h(i+1,j)*u)*(1-v)+(h(i,j+1)*(1-u)+h(i+1,j+1)*u)*v;}
  function rng(seed){let a=seed>>>0||1;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  const PLASTER=[[.97,.94,.88],[.98,.9,.78],[.96,.84,.8],[.9,.92,.96],[.94,.9,.74],[.99,.97,.94],[.88,.84,.78]];
  const ROOFS=[[.8,.36,.24],[.8,.36,.24],[.86,.48,.26],[.72,.3,.24],[.36,.46,.66],[.34,.58,.54],[.62,.3,.34]];
  // Building types: weights by district and the footprint/height each takes.
  const TYPES={
    house:{w:[7,12],d:[10,15],st:[2,4],g:4},shop:{w:[7,12],d:[10,14],st:[2,3],g:4.4},inn:{w:[12,18],d:[12,16],st:[2,3],g:4.6},
    smithy:{w:[9,13],d:[10,14],st:[1,1],g:6},warehouse:{w:[12,20],d:[14,22],st:[1,2],g:6},chapel:{w:[10,13],d:[18,24],st:[1,1],g:12},
    towerhouse:{w:[7,8],d:[7,8],st:[5,7],g:4},shack:{w:[4,6],d:[4,6],st:[1,1],g:3},guildhall:{w:[16,24],d:[22,30],st:[2,2],g:8},market:{w:[14,18],d:[28,36],st:[2,2],g:5.5},
    bath:{w:[14,18],d:[14,18],st:[1,1],g:8},barracks:{w:[10,13],d:[26,34],st:[2,2],g:4}};
  const ZONES={
    plaza:{guildhall:2,market:2,inn:3,shop:5,towerhouse:1},avenue:{shop:5,inn:2,house:4,chapel:.4,towerhouse:.8,bath:.4},
    town:{house:10,shop:1.6,inn:.6,smithy:.6,warehouse:.6,chapel:.3,towerhouse:.8,bath:.2},edge:{warehouse:3,smithy:3,barracks:2,house:7},
    slum:{shack:9,house:2,smithy:.5}};
  const SHACK=[[.62,.52,.42],[.55,.5,.46],[.66,.58,.48],[.5,.44,.38],[.7,.64,.56]],CLOTHS=[[.8,.3,.28],[.9,.76,.3],[.3,.5,.75],[.35,.62,.42],[.88,.88,.82],[.7,.4,.62]];
  function generate(seed,opts={}){
    const R=rng(seed),r=(a,b)=>a+(b-a)*R(),pick=a=>a[Math.floor(R()*a.length)],S=opts.scale||1;
    const Rw=r(720,920)*S,plazaR=r(58,72)*S,gap=r(95,125),nA=Math.round(r(6,8)),a0=R()*TAU,pal=CastleGen.PALETTES[Math.floor(R()*CastleGen.PALETTES.length)];
    const parts=[],add=(t,o,mat)=>{const q={t,mat,...o};parts.push(q);return q;};
    // Small things (stalls, lanterns, trees, benches) are grouped per spot, so the viewer can file them into tiles.
    const props=[];const prop=(x,z,list)=>props.push({type:'prop',x,z,parts:list});
    // ---- River: a meander crossing the city, kept clear of the plaza.
    const side=R()<.5?-1:1,xr0=side*(plazaR+r(160,280)),rA=r(30,70),rL=r(180,320),rP=R()*TAU,rW=r(40,64),ang=r(-.5,.5),ca=Math.cos(ang),sa=Math.sin(ang);
    const toR=(x,z)=>[x*ca+z*sa,-x*sa+z*ca],riverOff=(x,z)=>{const [u,v]=toR(x,z);return u-(xr0+rA*Math.sin(v/rL+rP));},inRiver=(x,z,pad=0)=>Math.abs(riverOff(x,z))<rW/2+pad;
    // ---- Ground: rolling or hilly (or flat), the river in a valley down to stone quays, plazas and the castle grounds
    // levelled. flats: discs eased to a level over `fall` metres.
    const relief=opts.terrain==='flat'?0:opts.terrain==='hilly'?r(20,30):opts.terrain==='rolling'?r(8,12):pick([r(8,12),r(18,28)]),ns=Math.floor(R()*1e6),flats=[];
    const raw=(x,z)=>G+relief*((vnoise(x/520,z/520,ns)-.5)*1.6+(vnoise(x/190,z/190,ns+1)-.5)*.5);
    const gy=(x,z)=>{const off=Math.abs(riverOff(x,z));if(off<rW/2)return -3;let h=raw(x,z);const t=Math.min(1,Math.max(0,(off-rW/2-7)/90));h=Q+(h-Q)*t*t*(3-2*t);
      for(const f of flats){const d=Math.hypot(x-f.x,z-f.z);if(d<f.r+f.fall){const k=d<f.r?1:1-(d-f.r)/f.fall,e=k*k*(3-2*k);h=h+(f.level-h)*e*(off>rW/2+7?1:0);}}return Math.max(Q,h);};
    flats.push({x:0,z:0,r:plazaR+18,fall:60,level:raw(0,0)});
    // ---- Occupancy (3 m cells): streets, plaza, river, walls and the castle hill are reserved before any building.
    const OC=3,occ=new Set(),key=(i,j)=>i*100003+j,mark=(x,z)=>occ.add(key(Math.floor(x/OC),Math.floor(z/OC))),isOcc=(x,z)=>occ.has(key(Math.floor(x/OC),Math.floor(z/OC)));
    const markDisk=(x,z,rad)=>{for(let i=Math.floor((x-rad)/OC);i<=Math.floor((x+rad)/OC);i++)for(let j=Math.floor((z-rad)/OC);j<=Math.floor((z+rad)/OC);j++){if(Math.hypot((i+.5)*OC-x,(j+.5)*OC-z)<rad)occ.add(key(i,j));}};
    const streets=[],heroZones=[];
    const street=(x0,z0,x1,z1,w,kind,id=-1)=>{if(heroZones.some(h=>h.inside((x0+x1)/2,(z0+z1)/2)))return;streets.push({x0,z0,x1,z1,w,kind,id});const L=Math.hypot(x1-x0,z1-z0),n=Math.ceil(L/1.5);for(let k=0;k<=n;k++){const t=k/n;markDisk(x0+(x1-x0)*t,z0+(z1-z0)*t,w/2+1);}};
    markDisk(0,0,plazaR+2);
    // ---- Castle on its hill, out along one avenue on the side away from the river.
    // Plaza spokes. Not a uniform hub: one main road runs right through the city (two spokes, gate to gate), one road
    // leads to the castle, and two or three short streets reach only the first ring. The castle sits on the side away
    // from the river; the main road crosses roughly square to the castle road.
    const cA=(side>0?Math.PI:0)-ang+r(-.5,.5),mA=cA+Math.PI/2+r(-.35,.35),mB=mA+Math.PI+r(-.3,.3),cD=Rw*r(.6,.68),cx=Math.cos(cA)*cD,cz=Math.sin(cA)*cD;
    const radials=[mA,mB,cA],MAIN=new Set([mA,mB]);
    {const free=[];for(let q=0;q<48;q++){const a=q/48*TAU;if(radials.every(b=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))>.75))free.push(a);}
      for(let k=Math.round(r(2,3));k>0&&free.length;k--){const a=free.splice(Math.floor(R()*free.length),1)[0];radials.push(a);for(let q=free.length-1;q>=0;q--)if(Math.abs(Math.atan2(Math.sin(free[q]-a),Math.cos(free[q]-a)))<.75)free.splice(q,1);}}
    // The castle stands on its own hill (with a road winding up, gate toward the plaza) or on level ground in the city.
    const onHill=opts.castleSeat?opts.castleSeat==='hill':R()<.6,flare=1.9,cLevel=gy(cx,cz);
    const castle=CastleGen.generate(seed*7+3,{style:onHill?'hill':'flat',ground:cLevel,flare,gate:Math.atan2(-cz,-cx),layout:opts.castleLayout||pick(['rings','spur','palace','cluster']),scale:(onHill?r(.28,.34):r(.26,.32))*S,palette:CastleGen.PALETTES.indexOf(pal)});
    castle.parts=castle.parts.filter(p=>p.t!=='land');const hillR=onHill?castle.radius*1.25*flare+10:castle.radius*1.1+10;markDisk(cx,cz,hillR);if(!onHill)flats.push({x:cx,z:cz,r:hillR,fall:50,level:cLevel});
    // ---- Plaza gaps between avenues, best first (wide, and on the side opposite the castle). The cathedral takes the best:
    // it stands end-on to the plaza, its west front on the plaza and its nave running outward, and streets that would
    // cross its site are not laid (the ring street parts round it).
    const gaps=[];{const srt=[...radials].sort((p,q)=>p-q),opp=cA+Math.PI;for(let i=0;i<srt.length;i++){const lo=srt[i],hi=i+1<srt.length?srt[i+1]:srt[0]+TAU;gaps.push({lo,hi,m:(lo+hi)/2});}
      gaps.sort((g1,g2)=>(g2.hi-g2.lo)*(1.6+Math.cos(g2.m-opp))-(g1.hi-g1.lo)*(1.6+Math.cos(g1.m-opp)));}
    const cath=(()=>{const g=gaps[0],L=r(100,130)*S,Wd=Math.min(r(42,52)*S,2*(plazaR+10)*Math.sin((g.hi-g.lo)/2)-24),d=plazaR+6+L/2,a=g.m,x=Math.cos(a)*d,z=Math.sin(a)*d,c=Math.cos(a),s2=Math.sin(a);
      heroZones.push({inside:(px,pz)=>{const u=(px-x)*c+(pz-z)*s2,v=-(px-x)*s2+(pz-z)*c;return Math.abs(u)<L/2+8&&Math.abs(v)<Wd/2+14;}});return {x,z,L,Wd,a};})();
    // ---- Streets: radial avenues from the plaza to the gates, ring streets, and lanes splitting long blocks.
    const rings=[];for(let rr=plazaR+gap*.8;rr<Rw-45;rr+=gap*r(.85,1.15))rings.push(rr);
    // Avenues bend gently on their way out (as old roads do); ring streets wobble round the city; the avenue toward the
    // castle stops at its grounds. bendAt(a,d): the avenue's angle at distance d.
    const bends=radials.map(()=>[R()*TAU,r(.03,.07)]),bendAt=(i,d)=>radials[i]+bends[i][1]*Math.sin(d/260+bends[i][0])-bends[i][1]*Math.sin(plazaR/260+bends[i][0]);
    radials.forEach((a,i)=>{const end=MAIN.has(a)?Rw+60:a===cA?cD-hillR*.9:rings[0]+1,n=Math.ceil((end-plazaR)/40);for(let k=0;k<n;k++){const d0=plazaR+(end-plazaR)*k/n,d1=plazaR+(end-plazaR)*(k+1)/n,a0=bendAt(i,d0),a1=bendAt(i,d1);
      street(Math.cos(a0)*d0,Math.sin(a0)*d0,Math.cos(a1)*d1,Math.sin(a1)*d1,MAIN.has(a)?16:a===cA?14:9,MAIN.has(a)||a===cA?'avenue':'street',i);}});
    const wob=rings.map(()=>[R()*TAU,R()*TAU,r(.02,.05),r(.01,.03)]),ringR=(k,t)=>rings[k]*(1+wob[k][2]*Math.sin(3*t+wob[k][0])+wob[k][3]*Math.sin(5*t+wob[k][1]));
    const ringSeg=(k,w,kind)=>{const rr=rings[k],n=Math.max(8,Math.ceil(rr*TAU/16));for(let q=0;q<n;q++){const t0=TAU*q/n,t1=TAU*(q+1)/n;street(Math.cos(t0)*ringR(k,t0),Math.sin(t0)*ringR(k,t0),Math.cos(t1)*ringR(k,t1),Math.sin(t1)*ringR(k,t1),w,kind);}};
    rings.forEach((_,k)=>ringSeg(k,8,'ring'));
    // Connectors between ring streets: each band gets its own, staggered (never lined up with the band inside), a few wide
    // streets and the rest lanes, each with a kink so blocks are not all wedges. The outermost ring also reaches the wall.
    for(let k=0;k+1<rings.length;k++){const mid=(rings[k]+rings[k+1])/2,n=Math.max(4,Math.round(mid*TAU/r(95,140))),off=R()*TAU;
      for(let q=0;q<n;q++){const a=off+(q+r(.25,.75))/n*TAU;if([mA,mB].some(b=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<.06))continue;
        const am=a+r(-.05,.05),r0=ringR(k,a),r1=ringR(k+1,a),rm=(r0+r1)/2,wide=R()<.35,w=wide?7:5,kind=wide?'street':'lane';
        street(Math.cos(a)*r0,Math.sin(a)*r0,Math.cos(am)*rm,Math.sin(am)*rm,w,kind);street(Math.cos(am)*rm,Math.sin(am)*rm,Math.cos(a)*r1,Math.sin(a)*r1,w,kind);}}
    // ---- Bridges are costly: only the avenues nearest the plaza (two or three) cross the river; every other street that
    // reaches it stops at the quay.
    {const crossing=[...new Set(streets.filter(st=>st.kind==='avenue'&&st.id>=0&&inRiver((st.x0+st.x1)/2,(st.z0+st.z1)/2,2)).map(st=>st.id))];
      const dist=id=>Math.min(...streets.filter(st=>st.id===id&&inRiver((st.x0+st.x1)/2,(st.z0+st.z1)/2,2)).map(st=>Math.hypot(st.x0,st.z0)));
      const keep=new Set(crossing.sort((a,b)=>dist(a)-dist(b)).slice(0,Math.round(r(2,3))));
      for(let i=streets.length-1;i>=0;i--){const st=streets[i];if(inRiver((st.x0+st.x1)/2,(st.z0+st.z1)/2,2)&&!(st.kind==='avenue'&&keep.has(st.id)))streets.splice(i,1);}
      // A kept avenue crosses on the shortest span: its segments near the water give way to a bridge square to the river
      // (along the local normal of the centreline) and two short connectors from the avenue's ends on each bank.
      for(const id of keep){const segs=streets.filter(st=>st.id===id),wet=st=>inRiver((st.x0+st.x1)/2,(st.z0+st.z1)/2,9),i0=segs.findIndex(wet),i1=segs.length-1-[...segs].reverse().findIndex(wet);if(i0<1||i1>=segs.length-1)continue;
        const mid=segs[(i0+i1)>>1],[,vm]=toR((mid.x0+mid.x1)/2,(mid.z0+mid.z1)/2),k=rA/rL*Math.cos(vm/rL+rP),uc=xr0+rA*Math.sin(vm/rL+rP),nl=Math.hypot(1,k),nu=1/nl,nv=-k/nl,half=rW/2+5;
        const W=(u,v)=>[u*ca-v*sa,u*sa+v*ca],A=W(uc-nu*half,vm-nv*half),B=W(uc+nu*half,vm+nv*half),before=segs[i0-1],after=segs[i1+1],w=before.w;
        for(let i=i0;i<=i1;i++)streets.splice(streets.indexOf(segs[i]),1);
        const [P,Q2]=Math.hypot(A[0]-before.x1,A[1]-before.z1)<Math.hypot(B[0]-before.x1,B[1]-before.z1)?[A,B]:[B,A];
        street(before.x1,before.z1,P[0],P[1],w,'avenue',id);street(P[0],P[1],Q2[0],Q2[1],w,'avenue',id);street(Q2[0],Q2[1],after.x0,after.z0,w,'avenue',id);}
      // An avenue without a bridge ends at the quay: drop its segments beyond the river too.
      for(const id of crossing)if(!keep.has(id)){const segs=streets.filter(st=>st.id===id);let past=false;for(const st of segs){if(past)streets.splice(streets.indexOf(st),1);else if(inRiver(st.x1,st.z1,4))past=true;}}}
    // River banks are kept clear (quays), and the wall band.
    const hasRiver=(x,z)=>inRiver(x,z,5);
    // ---- Buildings along every street, both sides, front door to the street.
    const buildings=[];
    const zoneAt=(x,z,kind)=>{const d=Math.hypot(x,z);return inSlum(x,z)?'slum':d<plazaR+40?'plaza':d>Rw-90?'edge':kind==='avenue'?'avenue':'town';};
    const pickType=z=>{const w=ZONES[z];let t=R()*Object.values(w).reduce((a,b)=>a+b,0);for(const [k,v] of Object.entries(w)){if((t-=v)<0)return k;}return 'house';};
    const fits=(x,z,w,d,rot)=>{const c=Math.cos(rot),s=Math.sin(rot);for(let u=-w/2+.9;u<=w/2-.8;u+=1.6)for(let v=-d/2+.9;v<=d/2-.8;v+=1.6){const px=x+u*c-v*s,pz=z+u*s+v*c;if(isOcc(px,pz)||hasRiver(px,pz)||Math.hypot(px,pz)>Rw-12)return false;}return true;};
    const claim=(x,z,w,d,rot)=>{const c=Math.cos(rot),s=Math.sin(rot);for(let u=-w/2+.6;u<=w/2-.5;u+=1.2)for(let v=-d/2+.6;v<=d/2-.5;v+=1.2)mark(x+u*c-v*s,z+u*s+v*c);};
    function place(type,x,z,w,d,rot,doorSide){const T=TYPES[type],dc=Math.hypot(x,z)/Rw,tall=type==='house'||type==='shop'||type==='inn'?Math.round(Math.max(0,1.8-dc*2.6)):0,n=Math.round(r(T.st[0],T.st[1]))+tall,st=[0];for(let i=1;i<n;i++)st.push(T.g+(i-1)*3.6);
      const H=type==='chapel'?r(11,16):type==='bath'?8:T.g+(n-1)*3.6+.8;
      const tudor=(type==='house'||type==='inn'||type==='shop')&&R()<.45;
      const b={id:buildings.length,type,x,z,w,d,rot,doorSide,storeys:st,H,tudor,wall:type==='shack'?pick(SHACK):tudor?[.96,.94,.88]:pick(PLASTER),roof:type==='chapel'||type==='guildhall'?pick([[.36,.46,.66],[.34,.58,.54]]):pick(ROOFS),pitch:type==='shack'?r(.25,.45):r(.6,1.05),doorU:type==='chapel'?0:r(-.25,.25)*(w-1.2),roofStyle:type==='shack'?'gable':w<8.5&&d>w*1.1&&R()<.55?'front':R()<.32?'hip':'gable',chimney:(type==='house'||type==='inn'||type==='smithy')&&R()<.65,seed:Math.floor(R()*1e9)};
      // Floor on the highest ground under the footprint; a plinth reaches down to the lowest, so nothing floats.
      {const c=Math.cos(rot),s2=Math.sin(rot),hs=[];for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1],[0,0]])hs.push(gy(x+u*w/2*c-v*d/2*s2,z+u*w/2*s2+v*d/2*c));b.floor=Math.max(...hs)+.15;b.base=Math.min(...hs)-.8;}
      buildings.push(b);claim(x,z,w,d,rot);return b;}
    // ---- Hero buildings on the plaza, each along the plaza's edge in the gap between two avenues, door to the plaza:
    // the cathedral opposite the castle, then the guildhall and the grand market hall in the next best gaps. They always
    // spawn: a gap too short shortens the building rather than dropping it.
    {const b=place('chapel',cath.x,cath.z,cath.L,cath.Wd,cath.a,-1);b.type='cathedral';b.hero=true;b.H=r(32,40);b.storeys=[0];b.roof=[.56,.6,.66];b.wall=[.96,.88,.84];
      [null,['guildhall',r(24,30),r(40,52)],['market',r(22,28),r(38,50)]].forEach((e,i)=>{if(!e)return;const [type,cw,want]=e,g=gaps[i];if(!g)return;
        const dd=plazaR+cw/2+5,arc=2*dd*Math.sin((g.hi-g.lo)/2)-26,cl=Math.max(30,Math.min(want,arc)),a=g.m,x=Math.cos(a)*dd,z=Math.sin(a)*dd,rot=a+Math.PI/2;
        const b=place(type,x,z,cl,cw,rot,1);b.type=type;b.hero=true;
        if(type==='guildhall'){b.storeys=[0,8,13];b.H=18.8;}else{b.storeys=[0];b.H=r(13,16);}});}
    // ---- Secondary plazas with fountains where some avenues cross ring streets; parks between them.
    const plazas=[],parks=[];
    const fountain=(x,z,rr)=>{const g=gy(x,z),L=[{t:'cyl',x,y:g,z,r:rr,h:.9,mat:'stone'},{t:'water',x,y:g+.75,z,r:rr-.5},{t:'cyl',x,y:g,z,r:.8,h:3.2,mat:'stone'},{t:'cyl',x,y:g+3.2,z,r:1.8,h:.5,mat:'stone'},{t:'water',x,y:g+3.6,z,r:1.4},{t:'cone',x,y:g+3.7,z,r:.5,h:1.4,mat:'gold'}];prop(x,z,L);};
    for(let k=0;k<rings.length;k++)for(const a of radials){if(a===cA||R()>.28)continue;const x=Math.cos(a)*rings[k],z=Math.sin(a)*rings[k],pr=r(20,28);if(inRiver(x,z,pr)||Math.hypot(x-cx,z-cz)<hillR+pr)continue;
      const lv=gy(x,z);flats.push({x,z,r:pr+2,fall:30,level:lv});markDisk(x,z,pr);plazas.push({x,z,r:pr});add('disk',{x,y:lv-.45,z,r:pr,pat:3},'paving');fountain(x,z,r(4,6));}
    for(let tries=0;tries<40&&parks.length<Math.round(r(2,4));tries++){const a=R()*TAU,d=r(plazaR+gap,Rw-120),x=Math.cos(a)*d,z=Math.sin(a)*d,pr=r(32,58);
      let free=true;for(let q=0;q<24&&free;q++){const b=q/24*TAU,f=(q%3+1)/3;if(isOcc(x+Math.cos(b)*pr*f,z+Math.sin(b)*pr*f)&&R()<.7||inRiver(x+Math.cos(b)*pr*f,z+Math.sin(b)*pr*f))free=false;}
      if(!free||Math.hypot(x-cx,z-cz)<hillR+pr)continue;markDisk(x,z,pr);parks.push({x,z,r:pr});
      // A pond off-centre, crossing gravel paths, trees round the edge and in clumps, benches by the paths.
      const L=[],px=x+r(-.25,.25)*pr,pz=z+r(-.25,.25)*pr,prr=pr*r(.2,.3),pg=gy(px,pz);flats.push({x:px,z:pz,r:prr+2,fall:12,level:pg});L.push({t:'cyl',x:px,y:pg-.6,z:pz,r:prr+.6,h:.7,mat:'stone'},{t:'water',x:px,y:pg+.02,z:pz,r:prr});
      for(const b of [R()*TAU,R()*TAU]){const c2=Math.cos(b),s2=Math.sin(b);{const ax=x-c2*pr,az=z-s2*pr,bx=x+c2*pr,bz=z+s2*pr;L.push({t:'ramp',x0:ax,z0:az,y0:gy(ax,az)+.06,x1:bx,z1:bz,y1:gy(bx,bz)+.06,w:3,base:Math.min(gy(ax,az),gy(bx,bz))-1,mat:'sand',pat:3});}}
      for(let q=0;q<Math.round(pr*.9);q++){const b=R()*TAU,f=Math.sqrt(R())*.92,tx=x+Math.cos(b)*pr*f,tz=z+Math.sin(b)*pr*f;if(Math.hypot(tx-px,tz-pz)<prr+3)continue;const th=r(5,9);const tg=gy(tx,tz);L.push({t:'cyl',x:tx,y:tg-.3,z:tz,r:.3,h:th*.55+.3,mat:'wood'},{t:'blob',x:tx,y:tg+th*.65,z:tz,rx:th*.38,ry:th*.34,rz:th*.38,mat:'green'});}
      for(let q=0;q<6;q++){const b=R()*TAU,bx=x+Math.cos(b)*pr*.5,bz=z+Math.sin(b)*pr*.5;const bg=gy(bx,bz);L.push({t:'box',x:bx,y:bg+.4,z:bz,w:1.8,h:.1,d:.5,rot:b,mat:'wood'},{t:'box',x:bx,y:bg-.2,z:bz,w:1.6,h:.6,d:.3,rot:b,mat:'dark'});}
      prop(x,z,L);}
    // ---- Slums: a sector against the wall (on the river side, downstream) of shacks and cramped houses.
    const slumA=Math.atan2(Math.sin(cA+Math.PI)*.4+(-side)*0,Math.cos(cA+Math.PI))+r(-.8,.8),slumW=r(.45,.7);
    const inSlum=(x,z)=>Math.hypot(x,z)>Rw*.6&&Math.abs(Math.atan2(Math.sin(Math.atan2(z,x)-slumA),Math.cos(Math.atan2(z,x)-slumA)))<slumW;
    // ---- Market stalls along the avenues near the plaza, lanterns along avenues and ring streets.
    const stall=(x,z,rot)=>{const c=Math.cos(rot),s2=Math.sin(rot),cl=pick(CLOTHS),L=[],G=gy(x,z);for(const [u,v] of [[-1.3,-.9],[1.3,-.9],[-1.3,.9],[1.3,.9]])L.push({t:'cyl',x:x+u*c-v*s2,y:G,z:z+u*s2+v*c,r:.07,h:2.4,mat:'wood',nocol:true});
      L.push({t:'box',x,y:G,z,w:2.6,h:.9,d:.9,rot,mat:'wood'},{t:'gable',x,y:G+2.4,z,w:3,d:2.2,h:.5,rot,col:cl});for(let k=0;k<3;k++)L.push({t:'box',x:x+(k-1)*.7*c,y:G+.9,z:z+(k-1)*.7*s2,w:.5,h:.3,d:.4,rot,col:pick([[.9,.6,.2],[.6,.8,.3],[.8,.3,.3],[.7,.6,.4]])});prop(x,z,L);};
    const lantern=(x,z)=>{const G=gy(x,z);prop(x,z,[{t:'cyl',x,y:G-.3,z,r:.08,h:3.6,mat:'dark',nocol:true},{t:'box',x,y:G+3.3,z,w:.42,h:.5,d:.42,rot:0,col:[1,.78,.38],glow:true,nocol:true},{t:'cone',x,y:G+3.8,z,r:.34,h:.35,mat:'dark',nocol:true}]);};
    for(const st of streets){if(st.kind==='lane')continue;const L=Math.hypot(st.x1-st.x0,st.z1-st.z0),rot=Math.atan2(st.z1-st.z0,st.x1-st.x0),nx=-Math.sin(rot),nz=Math.cos(rot),mid=Math.hypot((st.x0+st.x1)/2,(st.z0+st.z1)/2);
      for(let t=r(0,6);t<L;t+=26){const sd=Math.floor(t/26)%2?1:-1,x=st.x0+(st.x1-st.x0)*t/L+nx*sd*(st.w/2+.55),z=st.z0+(st.z1-st.z0)*t/L+nz*sd*(st.w/2+.55);if(!inRiver(x,z,3)&&mid<Rw-8)lantern(x,z);}
      if(st.kind==='avenue'&&mid<plazaR+gap*1.8&&mid>plazaR+8)for(let t=3;t<L-3;t+=4.5)for(const sd of [-1,1]){if(R()<.3)continue;const x=st.x0+(st.x1-st.x0)*t/L+nx*sd*(st.w/2-1.6),z=st.z0+(st.z1-st.z0)*t/L+nz*sd*(st.w/2-1.6);if(!inRiver(x,z,4))stall(x,z,rot);}}
    // Townsfolk for scale: crowds on the plazas and at the stalls, a few on every street, strollers in parks.
    const CLOTH2=[[.55,.28,.25],[.3,.38,.55],[.42,.5,.32],[.6,.52,.36],[.38,.32,.42],[.72,.66,.58],[.25,.3,.3]],HAT=[[.3,.22,.16],[.5,.4,.25],[.2,.2,.24],[.62,.3,.2]];
    const person=(x,z)=>prop(x,z,[{t:'figure',x,y:gy(x,z),z,rot:R()*TAU,h:r(1.55,1.88),col:pick(CLOTH2),hat:pick(HAT),nocol:true}]);
    for(let k=0;k<70;k++){const a=R()*TAU,d=Math.sqrt(R())*(plazaR-4);person(Math.cos(a)*d,Math.sin(a)*d);}
    for(const pz of plazas)for(let k=0;k<10;k++){const a=R()*TAU,d=r(pz.r*.3,pz.r*.9);person(pz.x+Math.cos(a)*d,pz.z+Math.sin(a)*d);}
    for(const pk of parks)for(let k=0;k<14;k++){const a=R()*TAU,d=Math.sqrt(R())*pk.r*.9;person(pk.x+Math.cos(a)*d,pk.z+Math.sin(a)*d);}
    for(const st of streets){const L=Math.hypot(st.x1-st.x0,st.z1-st.z0),rot=Math.atan2(st.z1-st.z0,st.x1-st.x0),nx=-Math.sin(rot),nz=Math.cos(rot),dens=st.kind==='avenue'?1/14:st.kind==='ring'?1/30:1/60;
      for(let t=R()/dens;t<L;t+=r(.5,1.5)/dens){const o=r(-.4,.4)*st.w,x=st.x0+(st.x1-st.x0)*t/L+nx*o,z=st.z0+(st.z1-st.z0)*t/L+nz*o;if(!inRiver(x,z,2)&&Math.hypot(x,z)<Rw-8)person(x,z);}}
    for(let k=0;k<16;k++){const a=k/16*TAU;lantern(Math.cos(a)*(plazaR-3),Math.sin(a)*(plazaR-3));}
    for(let k=0;k<10;k++){const a=(k+.5)/10*TAU,d=plazaR*r(.45,.75);stall(Math.cos(a)*d,Math.sin(a)*d,a+Math.PI/2);}
    for(const s of streets){const L=Math.hypot(s.x1-s.x0,s.z1-s.z0),rot=Math.atan2(s.z1-s.z0,s.x1-s.x0),nx=-Math.sin(rot),nz=Math.cos(rot);
      // Inner streets are terraced: narrow houses wall to wall; the outer town has small gaps and gardens.
      for(const sd of [-1,1]){let t=r(0,4);while(t<L){const px0=s.x0+(s.x1-s.x0)*t/L,pz0=s.z0+(s.z1-s.z0)*t/L,zone=zoneAt(px0,pz0,s.kind),inner=Math.hypot(px0,pz0)<Rw*.58&&zone!=='slum';let type=pickType(zone);const T=TYPES[type],w=r(T.w[0],T.w[1])*(inner&&(type==='house'||type==='shop')?.75:1),d=r(T.d[0],T.d[1]);
        const ut=t+w/2,px=s.x0+(s.x1-s.x0)*ut/L,pz=s.z0+(s.z1-s.z0)*ut/L,off=s.w/2+1.2+d/2,x=px+nx*sd*off,z=pz+nz*sd*off;
        // Square buildings (tower houses, baths) stand any way; the rest keep their long side to the street.
        if(ut+w/2<=L&&fits(x,z,w,d,rot)){place(type,x,z,w,d,rot,-sd);t+=w+(inner?r(0,.15):r(.6,3));}else t+=r(1.5,3);}}}
    // ---- Back lots: clusters of homes round small courtyards behind the street fronts, each reached by an alley from
    // the nearest street (the alley is laid first, so the cluster is never walled in). Slum clusters are shacks.
    const nearestStreet=(x,z)=>{let best=null;for(const st of streets){const dx=st.x1-st.x0,dz=st.z1-st.z0,L2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-st.x0)*dx+(z-st.z0)*dz)/L2)),qx=st.x0+dx*t,qz=st.z0+dz*t,d=Math.hypot(x-qx,z-qz);if(!best||d<best.d)best={d,qx,qz,st};}return best;};
    for(let tries=0;tries<2600;tries++){const a=R()*TAU,dd=Math.sqrt(R())*(Rw-25),x=Math.cos(a)*dd,z=Math.sin(a)*dd,slum=inSlum(x,z),cr=slum?r(3.5,5):r(5,8);
      if(isOcc(x,z)||inRiver(x,z,cr+6)||Math.hypot(x-cx,z-cz)<hillR+10)continue;let open=true;for(let q=0;q<8;q++){const b=q/8*TAU;if(isOcc(x+Math.cos(b)*cr,z+Math.sin(b)*cr))open=false;}if(!open)continue;
      const ns=nearestStreet(x,z);if(!ns||ns.d<cr+6||ns.d>85)continue;
      // The alley must run through open ground (its last metres meet the street's own reserved strip).
      const L=ns.d,ux=(ns.qx-x)/L,uz=(ns.qz-z)/L;let clear=true;for(let t=cr;t<L-ns.st.w/2-2;t+=1.5)if(isOcc(x+ux*t,z+uz*t)||inRiver(x+ux*t,z+uz*t,2))clear=false;if(!clear)continue;
      street(x+ux*cr*.5,z+uz*cr*.5,ns.qx,ns.qz,slum?2.6:3.2,'alley');markDisk(x,z,cr);
      const n=Math.round(slum?r(5,9):r(3,6)),aa=Math.atan2(uz,ux);
      for(let k=0;k<n;k++){const b=aa+(k+.5)/n*TAU*(slum?1:.86)+(slum?0:TAU*.07),type=slum?'shack':R()<.85?'house':pick(['smithy','towerhouse','shop']),T=TYPES[type],w=r(T.w[0],T.w[1])*(slum?1:.85),d=r(T.d[0],T.d[1])*(slum?1:.8),off=cr+d/2+.4;
        const hx=x+Math.cos(b)*off,hz=z+Math.sin(b)*off,rot=b+Math.PI/2+(slum?r(-.25,.25):0);if(fits(hx,hz,w,d,rot))place(type,hx,hz,w,d,rot,1);}
      prop(x,z,[{t:'disk',x,y:gy(x,z)-.5,z,r:cr,mat:'paving',pat:3}]);}
    // ---- The static city: ground, quays, streets, plaza, bridges, walls.
    const span=Rw+340,C=10,TL=160;
    // Ground: one heightfield per 160 m tile (10 m cells); cells over the river are left out (the water plane shows).
    for(let ti=Math.floor(-span/TL);ti<Math.ceil(span/TL);ti++)for(let tj=Math.floor(-span/TL);tj<Math.ceil(span/TL);tj++){const n=TL/C,x0=ti*TL,z0=tj*TL,h=new Float32Array((n+1)*(n+1)),skip=new Uint8Array(n*n);
      for(let j=0;j<=n;j++)for(let i=0;i<=n;i++)h[j*(n+1)+i]=gy(x0+i*C,z0+j*C);for(let j=0;j<n;j++)for(let i=0;i<n;i++)skip[j*n+i]=inRiver(x0+(i+.5)*C,z0+(j+.5)*C,-2)?1:0;
      add('field',{x0,z0,n,C,h,skip,x:x0+TL/2,z:z0+TL/2},'grass');}
    // Quay walls along both banks, stone, from the riverbed to the quay.
    {const [u0]=[0];for(let v=-span;v<span;v+=8)for(const sd of [-1,1]){const u=xr0+rA*Math.sin(v/rL+rP)+sd*(rW/2+.6),x=u*ca-v*sa,z=u*sa+v*ca,u2=xr0+rA*Math.sin((v+8)/rL+rP)+sd*(rW/2+.6),x2=u2*ca-(v+8)*sa,z2=u2*sa+(v+8)*ca;
      add('box',{x:(x+x2)/2,y:-3,z:(z+z2)/2,w:Math.hypot(x2-x,z2-z)+.3,h:Q+3.2,d:1.4,rot:Math.atan2(z2-z,x2-x),pat:4},'stone');}}
    for(const s of streets){const L=Math.hypot(s.x1-s.x0,s.z1-s.z0),rot=Math.atan2(s.z1-s.z0,s.x1-s.x0),n=Math.max(1,Math.ceil(L/10));
      for(let k=0;k<n;k++){const t0=k/n,t1=(k+1)/n,ax=s.x0+(s.x1-s.x0)*t0,az=s.z0+(s.z1-s.z0)*t0,bx=s.x0+(s.x1-s.x0)*t1,bz=s.z0+(s.z1-s.z0)*t1,x=(ax+bx)/2,z=(az+bz)/2;
        // Over the river: a bridge bay at quay level (+1.2 m); elsewhere the street is laid on the ground as a gentle ramp.
        if(inRiver(x,z,2))add('arch',{x,y:-3,z,w:L/n+.3,h:Q+4.4,d:s.w+1,rot,span:L/n*.75},'stone2');
        else{const ya=inRiver(ax,az,2)?Q+1.4:gy(ax,az)+.12,yb=inRiver(bx,bz,2)?Q+1.4:gy(bx,bz)+.12;add('ramp',{x0:ax,z0:az,y0:ya,x1:bx,z1:bz,y1:yb,w:s.w,base:Math.min(ya,yb)-1.2,pat:3,x,z},s.kind==='alley'?'paving':'stone2');}}}
    // Plaza: paving disk, a fountain and a statue column.
    {const g0=gy(0,0);add('disk',{x:0,y:g0-.45,z:0,r:plazaR,pat:3},'stone2');add('cyl',{x:0,y:g0,z:0,r:9,h:1.2},'stone');add('cyl',{x:0,y:g0,z:0,r:1.6,h:9},'stone');add('cone',{x:0,y:g0+9,z:0,r:2.6,h:4},'gold');}
    // Outer wall: towers every ~70 m, gatehouses where avenues leave, water gates over the river.
    {const n=Math.round(Rw*TAU/70),wa=[];for(let i=0;i<n;i++)wa.push(i/n*TAU);
      for(let i=0;i<n;i++){const t0=wa[i],t1=i+1<n?wa[i+1]:TAU,p0=[Math.cos(t0)*Rw,Math.sin(t0)*Rw],p1=[Math.cos(t1)*Rw,Math.sin(t1)*Rw],mx=(p0[0]+p1[0])/2,mz=(p0[1]+p1[1])/2,len=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]),rot=Math.atan2(p1[1]-p0[1],p1[0]-p0[0]);
        if(inRiver(mx,mz,4)){add('arch',{x:mx,y:-3,z:mz,w:len,h:Q+18,d:6,rot,span:len*.6},'stone');continue;}
        const ga0=gy(...p0),ga1=gy(...p1),wb=Math.min(ga0,ga1)-2,wt=Math.max(ga0,ga1)+16;
        const gate=[mA,mB].map((a,i)=>bendAt(i,Rw)).some(a=>Math.abs(Math.atan2(Math.sin(a-(t0+t1)/2),Math.cos(a-(t0+t1)/2)))<(t1-t0)/2);
        if(gate)add('gatewall',{x:mx,y:wb,z:mz,w:len,h:wt-wb,d:6,rot,gap:12,gateH:wt-wb-7,crenel:true},'stone');else add('box',{x:mx,y:wb,z:mz,w:len,h:wt-wb,d:6,rot,crenel:true},'stone');}
      for(const t of wa){const x=Math.cos(t)*Rw,z=Math.sin(t)*Rw;if(inRiver(x,z,6))continue;const g=gy(x,z);add('cyl',{x,y:g-3,z,r:7,h:31},'stone');add('cone',{x,y:g+26,z,r:8,h:20},'roof');}}
    const plazaA=cA+Math.PI*.5,spawn={x:Math.cos(plazaA)*(plazaR-6),y:gy(0,0)+1,z:Math.sin(plazaA)*(plazaR-6),yaw:Math.atan2(cz-Math.sin(plazaA)*(plazaR-6),cx-Math.cos(plazaA)*(plazaR-6))};
    return {seed,radius:Rw,ground:G,relief,gy,palette:pal,parts,buildings,props,plazas,parks,castle,castleAt:{x:cx,z:cz},spawn,river:{inRiver}};
  }
  // ---- One building's parts. interior=false: a closed box and roof (far); true: a hollow shell with rooms and props.
  function buildingParts(b,interior){
    if(b.type==='prop')return b.parts;
    if(b.type==='cathedral')return cathedralParts(b);
    const out=[],R=rng(b.seed),r=(a,c)=>a+(c-a)*R(),c=Math.cos(b.rot),s=Math.sin(b.rot),W=(u,v)=>[b.x+u*c-v*s,b.z+u*s+v*c];
    const add=(t,o,mat)=>{out.push({t,mat,...o});};
    const prop=(u,v,w,d,h,y,col,rot=0)=>{const [x,z]=W(u,v);add('box',{x,y,z,w,h,d,rot:b.rot+rot,col});};
    const WOOD=[.56,.4,.27],DARK=[.28,.25,.25],CLOTH=[.72,.34,.3],STONE=[.85,.82,.76],y0=b.floor??G,top=y0+b.H,base=b.base??y0-1,th=.6,iw=b.w-2*th,id=b.d-2*th;
    const roofH=b.d*b.pitch*.5,type=b.type;
    // Exterior bodies and roofs by type.
    // Closed shells carry painted windows (patterns 8 and 9); open interiors have real ones.
    const pat=type==='shack'?6:interior?(b.tudor?1:5):(b.tudor?9:8);
    const body=(o,mat)=>interior?add('shell',{...o,pat},mat):add('box',{x:o.x,y:o.y,z:o.z,w:o.w,h:o.h,d:o.d,rot:o.rot,col:o.col,pat},mat);
    if(type==='market'){
      // Open arcade below, a closed hall above reached by an outside stair.
      const up=y0+5;for(let u=-b.w/2+1;u<=b.w/2-1+.01;u+=(b.w-2)/Math.round((b.w-2)/4))for(const v of [-b.d/2+1,b.d/2-1]){const [x,z]=W(u,v);add('cyl',{x,y:y0,z,r:.55,h:5},'stone');}
      for(let v=-b.d/2+1;v<=b.d/2-1+.01;v+=(b.d-2)/Math.round((b.d-2)/4))for(const u of [-b.w/2+1,b.w/2-1]){const [x,z]=W(u,v);add('cyl',{x,y:y0,z,r:.55,h:5},'stone');}
      prop(0,0,b.w,b.d,.6,up-.6,STONE);body({x:b.x,y:up,z:b.z,w:b.w,h:b.H-5,d:b.d,rot:b.rot,th,floor:up,storeys:[0],door:{side:b.doorSide,u:b.w/2-2.5,wid:2,hgt:3},col:b.wall},'plaster');
      if(interior){for(let i=0;i<6;i++)prop(r(-b.w/3,b.w/3),r(-b.d/3,b.d/3),2.4,1.4,1,y0,[CLOTH,WOOD,[.4,.56,.7]][i%3]);const [ax,az]=W(b.w/2-2.5,b.doorSide*(b.d/2+3)),[bx,bz]=W(b.w/2-2.5-12,b.doorSide*(b.d/2+3));add('ramp',{x0:bx,z0:bz,y0:y0,x1:ax,z1:az,y1:up,w:2.4,base:y0},'stone2');}
      add('gable',{x:b.x,y:top,z:b.z,w:b.w,d:b.d+1.2,h:roofH,rot:b.rot,col:b.roof},'roof');return out;}
    const doorU=type==='cathedral'||b.hero?0:b.doorU,doorW=type==='smithy'||type==='warehouse'?4:type==='cathedral'?5:1.6,doorH=type==='cathedral'?8:type==='smithy'||type==='warehouse'?4:2.6;
    const door=type==='cathedral'?{side:1,u:0,wid:6,hgt:9}:{side:b.doorSide,u:doorU,wid:doorW,hgt:doorH};
    body({x:b.x,y:base,z:b.z,w:b.w,h:top-base,d:b.d,rot:b.rot,th:type==='cathedral'?1.6:th,floor:y0,storeys:b.storeys,door,col:b.wall,grand:type==='cathedral'||type==='guildhall'},'plaster');
    if(type==='bath'){const [x,z]=W(0,0);add('cyl',{x,y:top,z,r:Math.min(b.w,b.d)*.42,h:2},'stone');add('dome',{x,y:top+2,z,r:Math.min(b.w,b.d)*.44,col:[.34,.58,.54]},'roof');}
    // Roofs: a gable along the street, a gable end to the street (narrow houses), or hipped; chimneys on homes.
    else if(type!=='cathedral'&&b.roofStyle==='front')add('gable',{x:b.x,y:top,z:b.z,w:b.d+1.2,d:b.w+.6,h:b.w*b.pitch*.6,rot:b.rot+Math.PI/2,col:b.roof},'roof');
    else if(type!=='cathedral'&&b.roofStyle==='hip')add('hip',{x:b.x,y:top,z:b.z,w:b.w+.8,d:b.d+1.2,h:roofH,rot:b.rot,col:b.roof},'roof');
    else add('gable',{x:b.x,y:top,z:b.z,w:b.w,d:b.d+1.2,h:type==='cathedral'?b.d*.7:roofH,rot:b.rot,col:b.roof},'roof');
    if(b.chimney&&type!=='smithy'){const su=R()<.5?-1:1,[x,z]=W(su*b.w*.3,-b.doorSide*b.d*.15);add('box',{x,y:top,z,w:.9,h:(b.roofStyle==='front'?b.w*b.pitch*.6:roofH)+1.2,d:.9,rot:b.rot,col:[.62,.42,.34],nocol:true},'stone');}
    // Bell towers (chapels at the front corner, the cathedral's two west towers and a crossing spire), hollow with a stair.
    // The door opens toward the building's middle; the top landing is open over the stair's last turn.
    const belfry=(u,v,tr,h)=>{const [x,z]=W(u,v);if(interior){add('tube',{x,y:y0-1,z,r:tr,h:h+1,th:.8,doors:[{a:Math.atan2(b.z-z,b.x-x),y0,y1:y0+2.8}]},'stone');const ri=tr-.8,y1=y0+h-3,a1=(y1-y0)/.45*1.05/(ri*.55+.6);
        add('disk',{x,y:y0-.6,z,r:ri},'stone2');add('spiral',{x,z,r:ri,y0,y1,a0:0},'stone2');add('disk',{x,y:y1-.6,z,r:ri,hole:[a1-1.9,a1+.05]},'stone2');}
      else add('cyl',{x,y:y0-1,z,r:tr,h:h+1},'stone');add('cone',{x,y:y0+h,z,r:tr*1.15,h:tr*3.2,col:b.roof},'roof');};
    if(type==='chapel')belfry(-b.w/2+2.6,b.doorSide*(b.d/2-2.6),2.6,b.H+r(8,14));
    if(type==='cathedral'){for(const su of [-1,1])belfry(su*(b.w/2-4.5),b.d/2-4.5,4.2,b.H+r(25,40));const [x,z]=W(b.w*.1,0);add('cyl',{x,y:top,z,r:3.2,h:12},'stone');add('cone',{x,y:top+12,z,r:3.8,h:30,col:b.roof},'roof');}
    if(type==='guildhall'&&b.hero){
      // The guildhall: an arcade along the plaza front, a clock tower rising from the middle of the front, flags.
      const fv=b.doorSide*(b.d/2+2.4);for(let u=-b.w/2+1;u<=b.w/2-1+.01;u+=(b.w-2)/Math.round((b.w-2)/4)){const [x,z]=W(u,fv);add('cyl',{x,y:y0,z,r:.55,h:6},'stone');}
      {const [x,z]=W(0,b.doorSide*(b.d/2+1.25));add('box',{x,y:y0+6,z,w:b.w,h:.8,d:3.1,rot:b.rot},'stone');}
      const [tx,tz]=W(0,b.doorSide*(b.d/2-3)),tw=7.5,tH=b.H+r(22,30);add('box',{x:tx,y:y0-1,z:tz,w:tw,h:tH+1,d:tw,rot:b.rot,pat:4},'stone');add('box',{x:tx,y:y0+tH,z:tz,w:tw+.8,h:1.2,d:tw+.8,rot:b.rot,crenel:true},'stone');
      add('cone',{x:tx,y:y0+tH+1.2,z:tz,r:tw*.62,h:tw*1.6,col:b.roof},'roof');{const [cx2,cz2]=W(0,b.doorSide*(b.d/2-3+tw/2+.05));add('cyl',{x:cx2,y:y0+tH-6,z:cz2,r:2.1,h:.1,col:[.95,.92,.82],nocol:true},'stone');}
      for(const su of [-1,1]){const [fx,fz]=W(su*(b.w/2-1),b.doorSide*(b.d/2-1));add('cyl',{x:fx,y:top,z:fz,r:.08,h:7,mat:'dark',nocol:true},'dark');add('box',{x:fx+.9,y:top+5,z:fz,w:1.8,h:1.1,d:.05,rot:0,col:R()<.5?[.7,.2,.2]:[.2,.3,.6],nocol:true},"cloth");}}
    if(type==='towerhouse'){const [x,z]=W(0,0);add('box',{x,y:top,z,w:b.w,h:1.2,d:b.d,rot:b.rot,crenel:true},'stone');}
    if(type==='smithy'){const [x,z]=W(-b.w/2+2,0);add('cyl',{x,y:y0,z,r:.9,h:b.H+roofH+3,nocol:true},'stone');}
    // Closed: a door panel in the doorway, so doors read from the street (E opens it in Walk).
    if(!interior){if(door.side){const [x,z]=W(door.u,door.side*(b.d/2+.04));add('box',{x,y:y0,z,w:door.wid,h:door.hgt,d:.12,rot:b.rot,col:[.42,.28,.18],pat:6},'wood');}return out;}
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
    else if(type==='shack'){bed(-iw/2+1.2,0,y0);prop(iw/4,0,.9,.9,.75,y0,WOOD);}
    else if(type==='smithy'){prop(-iw/2+2,0,2.6,2.6,1.2,y0,DARK);prop(0,0,.8,.4,.8,y0,[.35,.35,.4]);prop(iw/3,id/3,1.2,1.2,1,y0,WOOD);}
    else if(type==='warehouse'){for(let k=0;k<12;k++){const sz=r(.9,1.8);prop(r(-iw/2+1,iw/2-1),r(-id/2+1,id/2-1),sz,sz,sz,y0,WOOD);}}
    else if(type==='guildhall'){table(0,0,y0,iw*.6);for(let k=1;k<5;k++)for(const sv of [-1,1]){const [x,z]=W(-iw/2+k*iw/5,sv*id*.3);add('cyl',{x,y:y0,z,r:.5,h:b.storeys[1]},'stone');}hearth(-iw/2+1.2,0,y0);}
    else if(type==='bath'){prop(0,0,iw*.6,id*.6,.5,y0,[.3,.6,.7]);}
    else if(type==='chapel'||type==='cathedral'){const n=Math.floor(iw/2.2)-3;for(let k=0;k<n;k++)for(const sv of [-1,1])prop(-iw/2+4+k*2.2,sv*id*.22,.5,id*.3,.5,y0,WOOD);prop(iw/2-2.5,0,1.6,3,1.1,y0,[.92,.88,.8]);
      if(type==='cathedral')for(let k=1;k<10;k++)for(const sv of [-1,1]){const [x,z]=W(-iw/2+k*iw/10,sv*id*.36);add('cyl',{x,y:y0,z,r:1,h:b.H-1},'stone');}}
    return out;
  }
  // ---- The cathedral, after Milan's Duomo: a west front on the plaza (buttress piers crowned by tall spires, five
  // pointed portals, tall pointed windows, a rose window, a stepped gable, balustrades), a high nave over lower aisles,
  // flying buttresses with pinnacles, rows of pinnacles along every roof edge, a transept, a crossing lantern with a
  // very tall spire and a gilded statue, and a rounded apse. Pale pink marble, grey lead roofs. Local frame: u runs
  // from the west front (u = -L/2, toward the plaza) to the apse; v across.
  function cathedralParts(b){
    const out=[],R=rng(b.seed),r=(a,c)=>a+(c-a)*R(),c=Math.cos(b.rot),s=Math.sin(b.rot),W=(u,v)=>[b.x+u*c-v*s,b.z+u*s+v*c];
    const M=[.96,.88,.84],M2=[.9,.81,.77],LEAD=[.56,.6,.66],DARK=[.17,.15,.2],GOLD=[.96,.78,.34],y0=b.floor,base=b.base,L=b.w,D=b.d,Hn=b.H,Ha=Hn*.55,nv=D*.4,aw=(D-nv)/2;
    const box=(u,v,w,d,y,h,col,rot=0,o={})=>{const [x,z]=W(u,v);out.push({t:'box',x,y,z,w,h,d,rot:b.rot+rot,col,pat:4,...o});};
    const spire=(u,v,y,rr,h,gold)=>{const [x,z]=W(u,v);out.push({t:'cyl',x,y,z,r:rr*1.15,h:rr*1.4,col:M2},{t:'cone',x,y:y+rr*1.4,z,r:rr,h,col:M},{t:'cone',x,y:y+rr*1.4+h*.96,z,r:rr*.22,h:rr*1.6,col:gold?GOLD:M});};
    const gableAt=(u,v,w,d,y,h,col,rot=0)=>{const [x,z]=W(u,v);out.push({t:'gable',x,y,z,w,d,h,rot:b.rot+rot,col});};
    const u0=-L/2+3,uA=L/2-D*.28,uT=L*.12;
    // Nave over its aisles, lead roofs; a plinth to the lowest ground.
    box((u0+uA)/2,0,uA-u0,D,base,y0-base+.2,M2);
    box((u0+uA)/2,0,uA-u0,nv,y0,Hn,M);gableAt((u0+uA)/2,0,uA-u0,nv+1,y0+Hn,nv*.42,LEAD);
    for(const sv of [-1,1]){box((u0+uA)/2,sv*(nv/2+aw/2),uA-u0,aw,y0,Ha,M);gableAt((u0+uA)/2,sv*(nv/2+aw/2),uA-u0,aw+.6,y0+Ha,aw*.22,LEAD);
      // Buttress piers along the aisle, each with a pinnacle and a flyer to the nave wall; pinnacles along the nave edge.
      for(let u=u0+8;u<uA-4;u+=8){if(Math.abs(u-uT)<14)continue;box(u,sv*(D/2-.6),1.8,1.8,y0,Ha+6,M2);spire(u,sv*(D/2-.6),y0+Ha+6,.75,7,false);
        const [ax,az]=W(u,sv*(D/2-1.4)),[bx,bz]=W(u,sv*(nv/2+.2));out.push({t:'ramp',x0:ax,z0:az,y0:y0+Ha+5,x1:bx,z1:bz,y1:y0+Hn-3,w:.9,base:y0+Ha+3.5,col:M2,nocol:true});
        spire(u,sv*(nv/2),y0+Hn,.45,4.5,false);}
      // Tall pointed clerestory windows between the piers.
      for(let u=u0+12;u<uA-6;u+=8){if(Math.abs(u-uT)<14)continue;box(u,sv*(nv/2+.08),2,.2,y0+Ha+3,Hn-Ha-7,DARK);gableAt(u,sv*(nv/2+.08),.2,2,y0+Hn-4,1.4,DARK,Math.PI/2);}}
    // Transept across the nave, gabled ends with rose windows and pinnacles.
    {const tw=22,td=D+18;box(uT,0,tw,td,y0,Hn,M);gableAt(uT,0,td+1,tw,y0+Hn,tw*.42,LEAD,Math.PI/2);
      for(const sv of [-1,1]){const [x,z]=W(uT,sv*(td/2+.1));out.push({t:'vdisk',x,y:y0+Hn-6,z,r:4.2,rot:b.rot+sv*Math.PI/2,col:M2});for(const su of [-1,1])spire(uT+su*(tw/2-.8),sv*(td/2-.8),y0+Hn,1,12,false);}}
    // Crossing: an octagonal drum, an open lantern and the great spire, a gilded statue on top.
    {const [x,z]=W(uT,0),hs=r(48,62);out.push({t:'cyl',x,y:y0+Hn,z,r:9,h:12,col:M},{t:'cyl',x,y:y0+Hn+12,z,r:6.5,h:9,col:M2},{t:'cone',x,y:y0+Hn+21,z,r:4.2,h:hs,col:M},
      {t:'cyl',x,y:y0+Hn+21+hs-2,z,r:.5,h:3,col:GOLD},{t:'figure',x,y:y0+Hn+21+hs+1,z,h:3.2,col:GOLD,hat:GOLD,nocol:true});
      for(let k=0;k<8;k++){const a=k/8*TAU,[px,pz]=[x+Math.cos(a)*9.4,z+Math.sin(a)*9.4];out.push({t:'cone',x:px,y:y0+Hn+12,z:pz,r:.7,h:9,col:M});}}
    // Apse: a rounded east end with a lower ambulatory, ringed with pinnacles.
    {const [x,z]=W(uA,0),ra=nv*.72;out.push({t:'cyl',x,y:base,z,r:D*.47,h:y0+Ha-base,col:M,pat:4},{t:'cone',x,y:y0+Ha,z,r:D*.5,h:5,col:LEAD},{t:'cyl',x,y:y0+Ha,z,r:ra,h:Hn-Ha,col:M,pat:4},{t:'cone',x,y:y0+Hn,z,r:ra+.6,h:ra*.9,col:LEAD});
      for(let k=0;k<12;k++){const a=k/12*TAU;out.push({t:'cone',x:x+Math.cos(a)*D*.47,y:y0+Ha,z:z+Math.sin(a)*D*.47,r:.6,h:6,col:M});}}
    // West front on the plaza: a slab with a stepped gable, six buttress piers crowned by spires, portals, windows, rose.
    {const fu=-L/2+1.5,FW=D+3,Hf=Hn+6,np=6,pv=k=>-FW/2+k*FW/(np-1);
      box(fu,0,3,FW,base,Hf-(base-y0),M);gableAt(fu,0,3,FW*.62,y0+Hf,FW*.3,M);
      for(let k=0;k<np;k++){const v=pv(k),mid=Math.min(k,np-1-k),hp=Hf+[-4,4,10][Math.min(2,mid)];box(fu-1.4,v,4.2,2.6,base,hp-(base-y0),M2);spire(fu-1.4,v,y0+hp,1.25,[13,16,20][Math.min(2,mid)],true);
        for(let lv=0;lv<3;lv++)out.push({t:'figure',x:W(fu-3.6,v)[0],y:y0+9+lv*9,z:W(fu-3.6,v)[1],rot:b.rot+Math.PI,h:2.2,col:[.93,.86,.82],hat:[.93,.86,.82],nocol:true});}
      for(let k=0;k<np-1;k++){const v=(pv(k)+pv(k+1))/2,gw=FW/(np-1)-2.8,big=k===2,dw=gw*(big?.62:.5),dh=big?12:8.5;
        box(fu-1.62,v,.3,dw+1.6,y0,dh+1,M2);gableAt(fu-1.62,v,.3,dw+1.6,y0+dh+1,dw*.7,M2);box(fu-1.68,v,.3,dw,y0,dh,DARK);gableAt(fu-1.68,v,.3,dw,y0+dh,dw*.55,DARK);
        // Tall pointed windows above each portal; a balustrade across the front.
        const ww=gw*.32;box(fu-1.62,v,.3,ww,y0+dh+dw*.8+3,10,DARK);gableAt(fu-1.62,v,.3,ww,y0+dh+dw*.8+13,ww*.7,DARK);}
      for(const yb of [y0+16,y0+Hn-8])box(fu-2.4,0,.8,FW,yb,.9,M2);
      // The Duomo's bristle: spirelets climbing the gable slopes and the top edge, and in tiers up every pier.
      {const gw=FW*.31,gh=FW*.3;for(let v=-gw;v<=gw+.01;v+=gw/5){const [x,z]=W(fu-.6,v);out.push({t:'cone',x,y:y0+Hf+gh*(1-Math.abs(v)/gw)-.6,z,r:.42,h:4.2,col:M});}
        for(let v=-FW/2+1;v<=FW/2-1;v+=3.2){const [x,z]=W(fu-.6,v);out.push({t:'cone',x,y:y0+Hf,z,r:.38,h:3.2,col:M});}
        for(let k=0;k<np;k++)for(const yy of [.38,.6,.82])for(const sv of [-1,1]){const [x,z]=W(fu-3.4,pv(k)+sv*1.2);out.push({t:'cone',x,y:y0+Hf*yy,z,r:.32,h:3,col:M2});}}
      {const [x,z]=W(fu-1.6,0);out.push({t:'vdisk',x,y:y0+Hn-1,z,r:5,rot:b.rot+Math.PI,col:M2});}}
    return out;
  }
  return {generate,buildingParts,TYPES};
});
