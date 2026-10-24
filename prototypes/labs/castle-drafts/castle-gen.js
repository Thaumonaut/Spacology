// Castle drafts: a seeded fairy-tale castle generator that outputs a list of simple parts (metres, y up, water at y=0).
// The parts are the same kind of shapes the world generator will later voxelize, so a design settled here ports over:
//   box     {x,y,z,w,h,d,rot}           y is the base; rot about y (radians)
//   cyl     {x,y,z,r,h,r2?}             a tower body (frustum when r2 is set: r at the base, r2 at the top)
//   cone    {x,y,z,r,h}                 a spire roof standing on y
//   dome    {x,y,z,r}                   a half-sphere on y
//   gable   {x,y,z,w,d,h,rot}           a pitched roof prism, ridge along w, standing on y
//   arch    {x,y,z,w,h,d,rot,span}      a bridge bay: a deck block with a round arch cut from below (span wide)
//   crag    {pts,top,base}              the rock: an outline ring (top radius per angle) standing in the water
//   blob    {x,y,z,rx,ry,rz}            greenery clumps
// Every part carries `mat`: stone, stone2, trim, roof, roof2, rock, green, sand, grass.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CastleGen=factory();})(this,function(){
  'use strict';
  function rng(seed){let a=seed>>>0||1;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  const TAU=Math.PI*2;
  // Roof palettes, after the references: slate blue, red, verdigris, and mixed courts.
  const PALETTES=[
    {name:'slate',roof:[.36,.5,.7],roof2:[.3,.42,.6],stone:[.9,.86,.78],stone2:[.84,.79,.7]},
    {name:'crimson',roof:[.78,.32,.24],roof2:[.68,.26,.2],stone:[.93,.88,.8],stone2:[.86,.8,.72]},
    {name:'verdigris',roof:[.36,.62,.55],roof2:[.3,.52,.48],stone:[.88,.86,.8],stone2:[.8,.78,.72]},
    {name:'royal',roof:[.38,.46,.74],roof2:[.78,.34,.26],stone:[.95,.93,.9],stone2:[.88,.86,.82]},
    {name:'amber',roof:[.84,.5,.26],roof2:[.62,.32,.3],stone:[.94,.88,.76],stone2:[.86,.78,.66]},
  ];
  function generate(seed,opts={}){
    const R=rng(seed),r=(a,b)=>a+(b-a)*R(),pick=a=>a[Math.floor(R()*a.length)],S=opts.scale||1,style=opts.style||pick(['island','hill','cliff']);
    const pal=opts.palette!=null?PALETTES[opts.palette%PALETTES.length]:pick(PALETTES),parts=[],sky=[];
    const add=(t,o,mat)=>{parts.push({t,mat,...o});return parts[parts.length-1];};
    // ---- The seat: what the castle stands on.
    //   island: a sheer crag rising from a broad low island (meadow, woods) in a lake or the sea;
    //   hill:   a great grassy hill on the mainland, the castle crowning it in rings;
    //   cliff:  a sheer crag in a gorge lake, a high bridge leaping to the mainland cliff across the water.
    const big=style==='island'?1:r(1.25,1.6),top=(style==='hill'?r(150,240):style==='cliff'?r(140,230):r(120,200))*S,Rc=(style==='island'?r(170,250):r(260,380)*(style==='hill'?1:.85))*S,lobes=[];
    for(let k=0;k<4;k++)lobes.push([1+Math.floor(R()*4)+k,R()*TAU,r(.04,.14)/(k+1)]);
    const rad=a=>Rc*(1+lobes.reduce((s,[f,p,m])=>s+m*Math.sin(f*a+p),0));
    const N=128,pts=[];for(let i=0;i<N;i++){const a=i/N*TAU;pts.push([a,rad(a)]);}
    const ga=R()*TAU,gx=Math.cos(ga),gz=Math.sin(ga),bridgeLen=r(260,480)*S;
    // Bridge: from (start distance, height) to (end distance, height) along the gate direction; null for none.
    let bridge=null;
    if(style==='island'){
      // The island: a low lobed shelf of meadow and woods around the crag foot.
      const isle=r(2.1,2.8),ih=r(8,16)*S;add('crag',{pts:pts.map(([a,d])=>[a,d*isle*(1+.08*Math.sin(a*3+1))]),top:ih,base:-8,flare:1.25,skin:'grass'},'grass');
      add('crag',{pts,top,base:ih-2,flare:1.22},'rock');
      for(let i=0;i<140;i++){const a=R()*TAU,d=rad(a)*r(1.3,isle*.92),s2=r(8,18)*S;add('blob',{x:Math.cos(a)*d,y:ih+s2*.6,z:Math.sin(a)*d,rx:s2,ry:s2*1.1,rz:s2},'green');}
      const from=rad(ga)*isle*.95;bridge={from,to:from+bridgeLen,y0:ih+2*S,y1:ih+2*S,gate:false};
      add('shore',{x:gx*(from+bridgeLen+1400*S),z:gz*(from+bridgeLen+1400*S),r:1400*S,h:ih},'grass');
      // A road climbs the crag face to the gate tower: the gate sits low on the cliff.
      bridge.gateY=Math.min(top*.5,r(40,70)*S);bridge.gateFrom=ih;
    }else if(style==='hill'){
      add('land',{y:2*S},'grass');
      add('crag',{pts,top,base:0,flare:r(2.6,3.4),skin:'grass'},'grass');
      for(let i=0;i<180;i++){const a=R()*TAU,f=r(1.2,2.8),d=rad(a)*f,yy=top*Math.max(0,1-Math.pow((f-1)/2.3,.75)),s2=r(8,18)*S;add('blob',{x:Math.cos(a)*d,y:yy+s2*.4,z:Math.sin(a)*d,rx:s2,ry:s2*1.1,rz:s2},'green');}
    }else{
      add('crag',{pts,top,base:-6,flare:1.16},'rock');
      // The mainland cliff across the gorge, nearly level with the crag top.
      const md=rad(ga)+bridgeLen+900*S,mt=top-r(5,25)*S,mp=pts.map(([a])=>[a,900*S*(1+.05*Math.sin(a*5))]);add('crag',{pts:mp,top:mt,base:-6,flare:1.1,cx:gx*md,cz:gz*md,skin:'cap'},'rock');
      bridge={from:rad(ga)*.97,to:rad(ga)+bridgeLen+40*S,y0:top+2*S,y1:mt+2*S,gate:true};
    }
    // ---- Tiers: the castle climbs in rings, each a terrace with its own wall and towers.
    const tiers=[];let y=top,scale=.94;
    const nT=style==='island'?pick([2,3,3]):pick([3,4,4]);
    for(let t=0;t<nT;t++){
      const k=scale,wallH=(t===0?r(16,24):r(14,22))*S*big,towerR=(t===0?r(7,10):r(6,9))*S*Math.sqrt(big),nTow=Math.max(5,Math.round(Rc*k*TAU/(t===0?r(55,75):r(60,90))/S));
      tiers.push({y,k,wallH,towerR,nTow});
      // Terrace body for inner tiers: a raised stone platform with the wall around it.
      if(t>0)add('ring',{cx:0,cz:0,pts:pts.map(([a,d])=>[a,d*k]),y:y-tiers[t-1].wallH*.0,h:0,top:y},'stone2');
      // Wall ring with towers at evenly spread outline points; the gate faces the bridge.
      const ang=[];for(let i=0;i<nTow;i++)ang.push(ga+(i+.5+(t?R()*.4-.2:0))/nTow*TAU);
      for(let i=0;i<nTow;i++){
        const a0=ang[i],a1=ang[(i+1)%nTow]+(i===nTow-1?TAU:0),p0=[Math.cos(a0)*rad(a0)*k,Math.sin(a0)*rad(a0)*k],p1=[Math.cos(a1)*rad(a1)*k,Math.sin(a1)*rad(a1)*k];
        const mx=(p0[0]+p1[0])/2,mz=(p0[1]+p1[1])/2,len=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);
        add('box',{x:mx,y:y-4*S,z:mz,w:len,h:wallH+4*S,d:3.5*S,rot:Math.atan2(p1[1]-p0[1],p1[0]-p0[0]),crenel:true},'stone');
      }
      for(let i=0;i<nTow;i++){
        const a=ang[i],d=rad(a)*k,tx=Math.cos(a)*d,tz=Math.sin(a)*d,tr=towerR*r(.85,1.2),th=wallH+r(10,26)*S*(1+t*.25);
        tower(tx,y-6*S,tz,tr,th+6*S,R()<.15?'flat':'cone',t===0&&R()<.5);
      }
      scale*=t===0?r(.62,.72):r(.58,.7);y+=r(30,55)*S*(style==='hill'?.8:1);
    }
    // ---- Halls on each terrace: pitched-roof buildings in a loose ring inside the wall.
    tiers.forEach((T,t)=>{const inner=t+1<tiers.length?tiers[t+1].k:0,n=Math.round(r(4,9)*(t===0?1.5:1)*big*big);
      for(let i=0;i<n;i++){const a=ga+R()*TAU,dd=(inner+(T.k-inner)*r(.35,.7)),d=rad(a)*dd,hx=Math.cos(a)*d,hz=Math.sin(a)*d,w=r(16,34)*S,dp=r(10,16)*S,h=r(12,22)*S,rot=a+Math.PI/2;
        add('box',{x:hx,y:T.y-2*S,z:hz,w,h:h+2*S,d:dp,rot},'stone2');add('gable',{x:hx,y:T.y+h,z:hz,w,d:dp+1.5*S,h:dp*r(.7,1.1),rot},'roof2');
        if(R()<.5)tower(hx+Math.cos(rot)*w/2,T.y,hz+Math.sin(rot)*w/2,r(3,4.5)*S,h+r(6,14)*S,'cone',false);}});
    // ---- The palace keep on the top tier: a tall block with a steep roof, corner turrets, dormers and a spire tower.
    const K=tiers[tiers.length-1],ky=K.y,kw=r(50,80)*S*big,kd=r(34,52)*S*big,kh=r(70,120)*S*Math.sqrt(big),kr=ga+Math.PI/2+r(-.3,.3),cs=Math.cos(kr),sn=Math.sin(kr);
    const kp=(u,w)=>[u*cs-w*sn,u*sn+w*cs];
    add('box',{x:0,y:ky-4*S,z:0,w:kw,h:kh+4*S,d:kd,rot:kr},'stone');add('gable',{x:0,y:ky+kh,z:0,w:kw,d:kd+2*S,h:kd*r(.8,1.2),rot:kr},'roof');
    for(const su of [-1,1])for(const sw of [-1,1]){const [px,pz]=kp(su*kw/2,sw*kd/2),tr=r(5,7)*S;tower(px,ky+kh*r(.45,.65),pz,tr,kh*r(.5,.7)+r(8,20)*S,'cone',true,true);}
    for(let i=0;i<Math.round(r(2,4));i++){const u=(i/(3)-.4)*kw*.8;for(const sw of [-1,1]){const [px,pz]=kp(u,sw*(kd/2+1)),dw=r(7,10)*S;add('box',{x:px,y:ky+kh-2*S,z:pz,w:dw,h:dw*.9,d:6*S,rot:kr},'stone');add('gable',{x:px,y:ky+kh-2*S+dw*.9,z:pz,w:6*S,d:dw+1*S,h:dw*.8,rot:kr+Math.PI/2},'roof');}}
    // Great spire tower behind the keep and a few lesser ones of very different heights.
    {const [px,pz]=kp(-kw*.35,-kd*.65),tr=r(10,14)*S;tower(px,ky-4*S,pz,tr,kh+r(80,130)*S,'cone',true,false,true);}
    for(let i=0;i<Math.round(r(4,8));i++){const a=R()*TAU,d=r(.55,1.1)*Math.max(kw,kd)*.8,tr=r(5,10)*S;tower(Math.cos(a)*d,ky-4*S,Math.sin(a)*d,tr,kh*r(.5,1.5),R()<.15?'dome':'cone',R()<.6);}
    // ---- Bridge: tall round arches from the castle's landing to the mainland, the deck easing between the two heights.
    if(bridge){const len=bridge.to-bridge.from,bays=Math.max(5,Math.round(len/r(30,44)/S)),bl=len/bays;
      for(let i=0;i<bays;i++){const f=(i+.5)/bays,d=bridge.from+f*len,deck=bridge.y0+(bridge.y1-bridge.y0)*f;
        add('arch',{x:gx*d,y:-2,z:gz*d,w:bl+.2*S,h:deck+2,d:10*S,rot:ga,span:bl*.72},'stone2');}
      if(bridge.gate)for(const sg of [-1,1]){const d=bridge.to-6*S;tower(gx*d-gz*sg*9*S,bridge.y1-2*S,gz*d+gx*sg*9*S,r(6,8)*S,r(18,26)*S,'cone',true);}
      // Island castles: the gate sits low on the crag; a great gate tower climbs the cliff face to the walls.
      if(bridge.gateY!=null)tower(gx*rad(ga)*.98,bridge.gateFrom,gz*rad(ga)*.98,r(12,16)*S,top-bridge.gateFrom+tiers[0].wallH+r(18,30)*S,'cone',true);}
    else{// Hill castles: a gatehouse pair on the outer wall facing the approach.
      for(const sg of [-1,1]){const a=ga+sg*.05,d=rad(a)*tiers[0].k;tower(Math.cos(a)*d,top-4*S,Math.sin(a)*d,r(9,12)*S,tiers[0].wallH+r(16,24)*S,'cone',true);}}
    // ---- Greenery: clumps hugging ledges and the cliff foot, trees on the shore.
    for(let i=0;i<70;i++){const a=R()*TAU,d=rad(a),hgt=R()<.5?r(2,top*.3):top*r(.75,1.0),f=hgt>top*.6?1.0:1.2;const s=r(6,16)*S;
      add('blob',{x:Math.cos(a)*d*f,y:hgt,z:Math.sin(a)*d*f,rx:s*1.4,ry:s*.8,rz:s*1.4},'green');}
    function tower(x,y,z,tr,th,roof,corbel,hang=false,main=false){
      const base=hang?tr*.3:tr;
      if(hang){add('cone',{x,y:y-tr*1.6,z,r:tr*.98,h:tr*1.6,inv:true},'stone2');}
      add('cyl',{x,y,z,r:tr,h:th},'stone');
      let ty=y+th;
      if(corbel){add('cyl',{x,y:ty-2.2*S,z,r:tr*1.18,h:3.4*S,r2:tr*1.22},'trim');ty+=1.2*S;}
      if(roof==='cone'){const rh=tr*r(2.6,3.8)*(main?1.25:1);add('cone',{x,y:ty,z,r:tr*(corbel?1.28:1.12),h:rh},main||R()<.7?'roof':'roof2');sky.push({x,z,y:ty,r:tr,h:rh});
        if(R()<.6)add('cyl',{x,y:ty+rh*.92,z,r:.25*S,h:rh*.25},'trim');}
      else if(roof==='dome'){add('dome',{x,y:ty,z,r:tr*1.08},'roof2');}
      else add('box',{x,y:ty,z,w:tr*2,h:1.5*S,d:tr*2,rot:0,crenel:true},'stone');
      return base;
    }
    return {seed,style,palette:pal,parts,top,radius:Rc,height:Math.max(...parts.map(p=>(p.y||0)+(p.h||0))),skyline:sky};
  }
  return {generate,PALETTES};
});
