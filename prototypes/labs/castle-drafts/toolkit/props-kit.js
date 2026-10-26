// Kit pieces beyond houses: castle, road, vendor and clutter assets. Same contract as town-kit.js: metres, Y up, ground
// at y = 0, front faces +Z, centred on the origin. Each asset returns {parts, footprint:{w,d,h}, sockets}; parts use the
// CastleRender format. Every asset is listed in ASSETS with its family and default options, so a gallery can show each
// one alone and scenes can combine them; place with TownKit.transform (or this module's transform).
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PropsKit=factory();})(this,function(){
  'use strict';
  const M={stone:[.6,.6,.58],stoneDark:[.44,.45,.46],stoneWarm:[.72,.66,.58],mortar:[.5,.5,.5],timber:[.33,.23,.16],wood:[.55,.4,.27],woodLight:[.7,.55,.36],
    iron:[.22,.22,.25],brass:[.72,.55,.25],roof:[.3,.4,.5],roofRed:[.66,.3,.24],slate:[.32,.36,.42],canvas:[.9,.86,.76],straw:[.86,.74,.42],leaf:[.3,.5,.26],
    water:[.25,.45,.55],dirt:[.55,.46,.34],cobble:[.66,.62,.58],flag:[.78,.72,.64],glow:[1,.8,.45],dark:[.12,.1,.1]};
  const CLOTH=[[.78,.24,.22],[.25,.42,.7],[.3,.58,.38],[.86,.66,.22],[.58,.3,.56],[.88,.86,.8]];
  const PRODUCE=[[.86,.22,.2],[.95,.58,.18],[.55,.75,.25],[.92,.82,.3],[.5,.25,.5],[.82,.5,.32]];
  // Small helpers in the CastleRender part format.
  const box=(x,y,z,w,h,d,col,o={})=>({t:'box',x,y,z,w,h,d,col,...o}),cyl=(x,y,z,r,h,col,o={})=>({t:'cyl',x,y,z,r,h,col,...o});
  const cone=(x,y,z,r,h,col,o={})=>({t:'cone',x,y,z,r,h,col,...o}),beam=(a,b,s,col)=>({t:'beam',x0:a[0],y0:a[1],z0:a[2],x1:b[0],y1:b[1],z1:b[2],s,col,nocol:true});
  const gable=(x,y,z,w,d,h,col,o={})=>({t:'gable',x,y,z,w,d,h,col,pat:2,...o}),blob=(x,y,z,r,col,ry=r*.8)=>({t:'blob',x,y,z,rx:r,ry,rz:r,col,nocol:true});
  const rng=seed=>{let a=(seed*2654435761)>>>0||1;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};};
  function transform(parts,x=0,y=0,z=0,rot=0){const c=Math.cos(rot),s=Math.sin(rot),P=(u,v)=>[x+u*c-v*s,z+u*s+v*c];return parts.map(p=>{const q={...p};
    if(p.x!=null){[q.x,q.z]=P(p.x,p.z);q.y=(p.y||0)+y;}if(p.x0!=null){[q.x0,q.z0]=P(p.x0,p.z0);[q.x1,q.z1]=P(p.x1,p.z1);q.y0=p.y0+y;q.y1=p.y1+y;}
    if(p.base!=null)q.base=p.base+y;if(p.rot!=null||['box','gable','hip','arch','vdisk','figure'].includes(p.t))q.rot=(p.rot||0)+rot;return q;});}

  // ================= Castle =================
  // Curtain wall: a battered stone plinth, the wall, a walkway on top with crenellated parapets on both sides, drain
  // spouts and arrow slits on the field side (+Z).
  function curtainWall({len=12,h=8,th=3}={}){const parts=[box(0,-.6,0,len,1.8,th+.8,M.stoneDark,{pat:4}),box(0,1.2,0,len,h-1.2,th,M.stone,{pat:4,crenel:true})];
    for(let x=-len/2+2;x<len/2-1;x+=3.2){parts.push(box(x,h*.55,th/2+.01,.18,1.3,.06,M.dark,{nocol:true}));parts.push(box(x+1.6,h-.6,th/2+.25,.25,.25,.5,M.stoneDark,{nocol:true}));}
    return {parts,footprint:{w:len,d:th+.8,h:h+2.3},sockets:{walk:{x:0,y:h,z:0},left:{x:-len/2,y:0,z:0},right:{x:len/2,y:0,z:0}}};}
  // Round tower: a battered base, the drum with slits, a corbelled ring, then a cone roof (slate) or open battlements.
  function roundTower({r=4,h=14,top='cone',roofCol=M.slate}={}){const parts=[cyl(0,-.6,0,r+.5,2.2,M.stoneDark,{r2:r,pat:4}),cyl(0,1.6,0,r,h-1.6,M.stone,{pat:4}),cyl(0,h-.4,0,r+.45,1,M.stoneDark,{r2:r+.55,pat:4})];
    for(let k=0;k<6;k++){const a=k/6*Math.PI*2+.3,y=h*(.35+.18*(k%3));parts.push(box(Math.cos(a)*(r+.02),y,Math.sin(a)*(r+.02),.16,1.2,.08,M.dark,{rot:-a+Math.PI/2,nocol:true}));}
    if(top==='cone')parts.push(cone(0,h+.6,0,r+.7,(r+.7)*2.3,roofCol,{pat:2}),cyl(0,h+.6+(r+.7)*2.2,0,.06,1.6,M.iron,{nocol:true}));
    else for(let k=0;k<14;k++){if(k%2)continue;const a=k/14*Math.PI*2;parts.push(box(Math.cos(a)*(r+.25),h+.6,Math.sin(a)*(r+.25),1.4,1.1,.6,M.stone,{rot:-a+Math.PI/2,pat:4}));}
    return {parts,footprint:{w:2*r+1.4,d:2*r+1.4,h:h+(top==='cone'?(r+.7)*2.3+2:1.7)},sockets:{base:{x:0,y:0,z:0},top:{x:0,y:h+.6,z:0}}};}
  // Square tower: a stone shaft with string courses, corner turrets hanging from the top, and a hipped or pyramid roof.
  function squareTower({w=6,h=16,roofCol=M.roofRed}={}){const parts=[box(0,-.6,0,w+.6,1.6,w+.6,M.stoneDark,{pat:4}),box(0,1,0,w,h-1,w,M.stone,{pat:4})];
    for(const y of [h*.4,h*.75])parts.push(box(0,y,0,w+.25,.25,w+.25,M.stoneWarm));
    for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*w/2,z=sz*w/2;parts.push(cone(x,h-3.2,z,1,1.6,M.stone,{inv:true}),cyl(x,h-1.6,z,1,3.4,M.stone,{pat:4}),cone(x,h+1.8,z,1.25,3.2,roofCol,{pat:2}));}
    for(const y of [h*.3,h*.6])parts.push(box(0,y,w/2+.01,.6,1.3,.08,M.dark,{nocol:true}));
    parts.push({t:'hip',x:0,y:h,z:0,w:w+.8,d:w+.8,h:w*.9,col:roofCol,pat:2});
    return {parts,footprint:{w:w+2.6,d:w+2.6,h:h+w*.9},sockets:{door:{x:0,y:0,z:w/2},top:{x:0,y:h,z:0}}};}
  // Gatehouse: two round towers flanking an arched passage, a portcullis half raised, crenellated top between the towers.
  function gatehouse({w=12,d=8,h=11,gate=4.2}={}){const parts=[],tr=2.6;
    parts.push({t:'arch',x:0,y:-.3,z:0,w:w-2*tr+1,h:h-.6,d,rot:0,span:gate,col:M.stone,pat:4});
    parts.push(box(0,h-1.6,0,w-2*tr+1,1.6,d,M.stone,{pat:4,crenel:true}));
    for(const sx of [-1,1])parts.push(...transform(roundTower({r:tr,h:h+3,top:'cone'}).parts,sx*(w/2-tr),0,d*.15));
    for(let k=-2;k<=2;k++)parts.push(box(k*gate/5,h*.45,d/2-.6,.1,h*.32,.1,M.iron,{nocol:true}));parts.push(box(0,h*.45,d/2-.6,gate,.12,.12,M.iron,{nocol:true}));
    parts.push(box(0,h*.62,d/2+.05,1.6,1.4,.12,CLOTH[1],{nocol:true}));
    return {parts,footprint:{w:w,d:d+2,h:h+3+tr*2.3},sockets:{passage:{x:0,y:0,z:0},wallLeft:{x:-w/2,y:0,z:0},wallRight:{x:w/2,y:0,z:0}}};}
  // Keep: a tall stone block with buttresses, round corner turrets, tall windows and a steep hipped roof with a lantern.
  function keep({w=16,d=14,h=22,roofCol=M.slate}={}){const parts=[box(0,-.6,0,w+1,2,d+1,M.stoneDark,{pat:4}),box(0,1.4,0,w,h-1.4,d,M.stone,{pat:4})];
    for(const sz of [-1,1])for(let x=-w/2+3;x<w/2-2;x+=3.6){parts.push(box(x,1,sz*(d/2+.4),1,h*.7,.8,M.stoneWarm,{pat:4}));for(const y of [h*.35,h*.62])parts.push(box(x+1.8,y,sz*(d/2+.02),1,2.6,.08,M.dark,{nocol:true}));}
    for(const sx of [-1,1])for(const sz of [-1,1])parts.push(cyl(sx*w/2,0,sz*d/2,2,h+3,M.stone,{pat:4}),cone(sx*w/2,h+3,sz*d/2,2.5,5.5,roofCol,{pat:2}));
    parts.push({t:'hip',x:0,y:h,z:0,w:w+1,d:d+1,h:Math.min(w,d)*.75,col:roofCol,pat:2},cyl(0,h+Math.min(w,d)*.7,0,1.2,2.4,M.stoneWarm),cone(0,h+Math.min(w,d)*.7+2.4,0,1.6,4,roofCol,{pat:2}));
    parts.push(box(0,0,d/2+.05,2.4,3.6,.15,M.timber,{pat:6}));
    return {parts,footprint:{w:w+5,d:d+5,h:h+Math.min(w,d)*.7+6.4},sockets:{door:{x:0,y:0,z:d/2},top:{x:0,y:h,z:0}}};}
  // Wall stair: a stone flight up the inside face of a curtain wall to its walkway.
  function wallStair({h=8,w=1.8}={}){const n=Math.ceil(h/.2),run=n*.3,parts=[];for(let i=0;i<n;i++)parts.push(box(-run/2+(i+.5)*.3,0,0,.32,(i+1)*h/n,w,M.stone,{pat:4}));
    return {parts,footprint:{w:run,d:w,h},sockets:{bottom:{x:-run/2,y:0,z:0},top:{x:run/2,y:h,z:0}}};}

  // ================= Roads =================
  // A straight road piece along X with kerbed footways; kind sets the surface (cobble, flag or dirt).
  function road({len=10,w=6,kind='cobble',kerbs=true}={}){const col=kind==='dirt'?M.dirt:kind==='flag'?M.flag:M.cobble,pat=kind==='dirt'?7:3,parts=[];
    const lane=kerbs?w-3:w;parts.push(box(0,-.3,0,len,.32,lane,col,{pat,noJitter:true}));
    if(kerbs)for(const sz of [-1,1]){parts.push(box(0,-.3,sz*(lane/2+.75),len,.46,1.5,M.flag,{pat:3}));parts.push(box(0,-.3,sz*(lane/2+.06),len,.48,.12,M.stoneDark));}
    if(kind==='dirt')for(const sz of [-1,1])parts.push(box(0,.01,sz*lane*.22,len,.02,.35,M.dirt.map(v=>v*.8),{nocol:true}));
    return {parts,footprint:{w:len,d:w,h:.5},sockets:{a:{x:-len/2,y:.02,z:0},b:{x:len/2,y:.02,z:0}}};}
  // A crossroads square: paving, kerbs only at the four corners, a drain in the middle.
  function junction({w=6}={}){const parts=[box(0,-.3,0,w+3,.32,w+3,M.cobble,{pat:3})];for(const sx of [-1,1])for(const sz of [-1,1])parts.push(box(sx*(w/2+.75),-.3,sz*(w/2+.75),1.5,.46,1.5,M.flag,{pat:3}));
    parts.push(box(0,.02,0,.8,.02,.8,M.iron,{nocol:true}));return {parts,footprint:{w:w+3,d:w+3,h:.5},sockets:{n:{x:0,y:0,z:-(w+3)/2},s:{x:0,y:0,z:(w+3)/2},e:{x:(w+3)/2,y:0,z:0},w:{x:-(w+3)/2,y:0,z:0}}};}
  // Street stairs: a flight between two levels (risers 16 cm, treads 32 cm) with stone cheek walls and a handrail post.
  function stairs({rise=2,w=3}={}){const n=Math.ceil(rise/.16),parts=[];for(let i=0;i<n;i++)parts.push(box(0,-.3,-n*.16+(i+.5)*.32,w,(i+1)*rise/n+.3,.34,M.flag,{pat:4}));
    for(const sx of [-1,1])parts.push({t:'ramp',x0:sx*(w/2+.2),z0:-n*.16,y0:.6,x1:sx*(w/2+.2),z1:n*.16,y1:rise+.6,w:.4,base:-.3,rail:false,col:M.stone,pat:4});
    return {parts,footprint:{w:w+.8,d:n*.32,h:rise+.6},sockets:{bottom:{x:0,y:0,z:-n*.16},top:{x:0,y:rise,z:n*.16}}};}
  // A stone bridge: one or more arches with a paved deck and parapets.
  function bridge({span=12,w=5,h=4,arches=1}={}){const parts=[],bay=span/arches;for(let i=0;i<arches;i++)parts.push({t:'arch',x:-span/2+(i+.5)*bay,y:-h,z:0,w:bay+.05,h:h+1.4,d:w,rot:0,span:bay*.72,col:M.stone,pat:4});
    parts.push(box(0,-.02,0,span,.04,w-1,M.cobble,{pat:3}));return {parts,footprint:{w:span,d:w,h:h+2.3},sockets:{a:{x:-span/2,y:0,z:0},b:{x:span/2,y:0,z:0}}};}
  // A round paved square with a kerb ring and a centre fountain.
  function plaza({r=9,fountain=true}={}){const parts=[{t:'disk',x:0,y:-.3,z:0,r,col:M.flag,pat:3},cyl(0,-.3,0,r+.3,.44,M.stoneDark,{r2:r+.3})];
    if(fountain)parts.push(cyl(0,0,0,2.6,.7,M.stone,{pat:4}),{t:'water',x:0,y:.6,z:0,r:2.3},cyl(0,0,0,.4,2.2,M.stoneWarm),cyl(0,2.2,0,1,.3,M.stone),{t:'water',x:0,y:2.45,z:0,r:.8});
    return {parts,footprint:{w:2*r+.6,d:2*r+.6,h:3},sockets:{centre:{x:0,y:0,z:0}}};}

  // ================= Vendors =================
  // Market stall: four posts, a counter, a striped canvas awning, and goods by kind (produce, cloth, pottery, fish).
  function stall({w=2.8,d=1.6,kind='produce',seed=1}={}){const R=rng(seed),pk=a=>a[Math.floor(R()*a.length)],parts=[],awn=pk(CLOTH);
    for(const sx of [-1,1])for(const sz of [-1,1])parts.push(box(sx*(w/2-.08),0,sz*(d/2-.08),.12,sz>0?2.2:2.6,.12,M.timber));
    parts.push(box(0,0,d/2-.35,w,.95,.6,M.wood,{pat:6}),box(0,.95,d/2-.35,w+.1,.06,.7,M.woodLight));
    parts.push({t:'ramp',x0:0,z0:-d/2-.1,y0:2.65,x1:0,z1:d/2+.5,y1:2.15,w:w+.3,base:2.1,rail:false,col:awn,pat:10,nocol:true});
    for(let i=0;i<Math.round(w/.55);i++){const x=-w/2+.3+i*.55;
      if(kind==='produce'){const c=pk(PRODUCE);parts.push(box(x,1.01,d/2-.35,.48,.18,.48,M.woodLight,{pat:6}));for(let k=0;k<3;k++)parts.push(blob(x+(k-1)*.13,1.24,d/2-.35+(R()-.5)*.2,.09,c));}
      else if(kind==='cloth'){parts.push(box(x,1.01,d/2-.35,.45,.12+.1*R(),.5,pk(CLOTH)));parts.push(box(x,1.3,-d/2+.15,.45,.9,.04,pk(CLOTH),{nocol:true}));}
      else if(kind==='pottery'){const r=.12+.08*R();parts.push(cyl(x,1.01,d/2-.35,r,.25+.25*R(),[.72,.45,.32],{r2:r*.6}));}
      else{parts.push(box(x,1.01,d/2-.35,.5,.08,.5,[.7,.8,.85]));parts.push({t:'blob',x,y:1.14,z:d/2-.35,rx:.2,ry:.05,rz:.07,col:[.6,.68,.72],nocol:true});}}
    parts.push(box(0,2.25,d/2+.45,.9,.35,.04,M.woodLight,{nocol:true}));
    return {parts,footprint:{w:w+.3,d:d+.6,h:2.7},sockets:{front:{x:0,y:0,z:d/2+.6}}};}
  // Hand cart: a plank bed on two spoked wheels, shafts on the ground, a load of sacks and crates.
  function cart({seed=2}={}){const R=rng(seed),parts=[box(0,.75,0,2.2,.12,1.3,M.wood,{pat:6})];for(const sz of [-1,1])parts.push(box(0,.87,sz*.62,2.2,.35,.06,M.wood,{pat:6}));
    for(const sz of [-1,1])parts.push({t:'vdisk',x:.2,y:.6,z:sz*.75,r:.6,rot:Math.PI/2*0+Math.PI/2,col:M.timber,col2:M.wood,nocol:true},cyl(.2,.58,sz*.75,.08,.06,M.iron,{nocol:true}));
    for(const sz of [-1,1])parts.push(beam([-1.1,.8,sz*.45],[-2.6,.05,sz*.4],.09,M.timber));
    for(let k=0;k<4;k++)parts.push(R()<.5?{t:'blob',x:-.6+k*.4,y:1.05,z:(R()-.5)*.5,rx:.25,ry:.2,rz:.22,col:[.8,.72,.55],nocol:true}:box(-.6+k*.4,.87,(R()-.5)*.4,.38,.38,.38,M.woodLight,{pat:6}));
    return {parts,footprint:{w:4,d:1.7,h:1.4},sockets:{handle:{x:-2.6,y:0,z:0}}};}
  // Merchant tent: a square canvas pavilion with a peaked roof, scalloped valance and a pennant.
  function tent({w=3.4,seed=3}={}){const R=rng(seed),c=CLOTH[Math.floor(R()*CLOTH.length)],parts=[];for(const sx of [-1,1])for(const sz of [-1,1])parts.push(box(sx*w/2,0,sz*w/2,.1,2.2,.1,M.timber));
    parts.push({t:'hip',x:0,y:2.2,z:0,w:w+.4,d:w+.4,h:1.6,col:c,pat:10,nocol:true});for(const sz of [-1,1])parts.push(box(0,1.8,sz*w/2,w,.4,.04,M.canvas,{nocol:true}));
    parts.push(box(0,1.8,-w/2+.01,w,.01,.01,c),box(0,0,-w/2,w,2,.04,M.canvas,{nocol:true}),cyl(0,3.8,0,.04,1,M.timber,{nocol:true}),box(.3,4.45,0,.6,.3,.02,c,{nocol:true}));
    parts.push(box(0,0,0,w*.6,.8,.7,M.wood,{pat:6}));return {parts,footprint:{w:w+.4,d:w+.4,h:4.8},sockets:{front:{x:0,y:0,z:w/2}}};}
  // Display rack: hanging goods (pots and pans or cloth lengths) on a timber frame.
  function displayRack({seed=4}={}){const R=rng(seed),parts=[];for(const sx of [-1,1])parts.push(box(sx*.9,0,0,.1,1.9,.1,M.timber));parts.push(box(0,1.85,0,1.9,.1,.1,M.timber));
    for(let k=0;k<5;k++){const x=-.7+k*.35;parts.push(R()<.5?box(x,1.1,0,.28,.7,.03,CLOTH[k%CLOTH.length],{nocol:true}):cyl(x,1.3,0,.15,.12,M.iron,{nocol:true}));}
    return {parts,footprint:{w:2,d:.4,h:1.95},sockets:{}};}
  // Shop sign on a post: a hanging painted board under a bracket.
  function signPost({seed=5}={}){const R=rng(seed);return {parts:[box(0,0,0,.14,2.8,.14,M.timber),box(.45,2.6,0,.95,.08,.08,M.iron),box(.6,1.85,0,.75,.55,.06,CLOTH[Math.floor(R()*6)]),box(.6,1.82,0,.85,.65,.04,M.timber,{nocol:true})],footprint:{w:1.2,d:.2,h:2.8},sockets:{}};}

  // ================= Clutter =================
  const barrel=({r=.36,h=.95}={})=>({parts:[cyl(0,0,0,r*.88,h/2,M.wood,{r2:r,pat:6}),cyl(0,h/2,0,r,h/2,M.wood,{r2:r*.88,pat:6}),cyl(0,h*.18,0,r*.97,.06,M.iron,{nocol:true}),cyl(0,h*.78,0,r*.97,.06,M.iron,{nocol:true})],footprint:{w:2*r,d:2*r,h},sockets:{top:{x:0,y:h,z:0}}});
  const crate=({s=.7}={})=>({parts:[box(0,0,0,s,s,s,M.woodLight,{pat:6}),beam([-s/2,.05,s/2+.01],[s/2,s-.05,s/2+.01],.06,M.wood),beam([-s/2-.01,.05,-s/2],[-s/2-.01,s-.05,s/2],.06,M.wood)],footprint:{w:s,d:s,h:s},sockets:{top:{x:0,y:s,z:0}}});
  function crateStack({seed=6}={}){const R=rng(seed),parts=[];const pos=[[-.4,0,0],[.4,0,.05],[0,.7,0]];for(const [x,y,z] of pos)parts.push(...transform(crate({s:.7}).parts,x,y,z,(R()-.5)*.3));return {parts,footprint:{w:1.6,d:.9,h:1.4},sockets:{}};}
  function sacks({n=4,seed=7}={}){const R=rng(seed),parts=[];for(let i=0;i<n;i++)parts.push({t:'blob',x:(i%2-.5)*.5,y:.25+Math.floor(i/2)*.32,z:(R()-.5)*.2,rx:.28,ry:.24,rz:.22,col:[.8,.7,.52],nocol:true});return {parts,footprint:{w:1,d:.6,h:.8},sockets:{}};}
  const lampPost=({h=3.4}={})=>({parts:[box(0,0,0,.3,.25,.3,M.stoneDark),cyl(0,.25,0,.07,h-.25,M.iron,{nocol:true}),box(0,h,0,.45,.55,.45,M.glow,{glow:true,nocol:true}),cone(0,h+.55,0,.38,.4,M.iron,{nocol:true}),box(0,h-.06,0,.55,.08,.55,M.iron,{nocol:true})],footprint:{w:.55,d:.55,h:h+1},sockets:{}});
  const bench=({w=1.8}={})=>({parts:[box(0,.42,0,w,.08,.45,M.wood,{pat:6}),box(0,.5,-.2,w,.45,.06,M.wood,{pat:6}),...[-1,1].map(sx=>box(sx*(w/2-.15),0,0,.1,.45,.4,M.iron,{nocol:true}))],footprint:{w,d:.5,h:.95},sockets:{}});
  function well({r=1.1}={}){return {parts:[cyl(0,0,0,r,.85,M.stone,{pat:4}),{t:'water',x:0,y:.5,z:0,r:r-.25},...[-1,1].map(sx=>box(sx*r,.85,0,.15,1.6,.15,M.timber)),beam([-r,2.4,0],[r,2.4,0],.12,M.timber),gable(0,2.45,0,2*r+.6,1.6,.7,M.roofRed),cyl(.2,1.6,0,.15,.25,M.wood,{nocol:true})],footprint:{w:2*r+.6,d:2*r,h:3.2},sockets:{}};}
  function fence({len=4,kind='picket'}={}){const parts=[],n=Math.round(len/(kind==='picket'?.25:1.2));for(let i=0;i<=n;i++){const x=-len/2+i*len/n;parts.push(box(x,0,0,.07,kind==='picket'?.9:1,.07,M.woodLight));}
    for(const y of kind==='picket'?[.25,.65]:[.35,.8])parts.push(box(0,y,-.05,len,.07,.04,M.woodLight));return {parts,footprint:{w:len,d:.2,h:1},sockets:{a:{x:-len/2,y:0,z:0},b:{x:len/2,y:0,z:0}}};}
  function planter({w=1.2,seed=8}={}){const R=rng(seed),parts=[box(0,0,0,w,.5,.5,M.stoneWarm,{pat:4}),box(0,.48,0,w-.12,.06,.38,M.dirt,{nocol:true})];for(let i=0;i<6;i++)parts.push(blob(-w/2+.2+i*(w-.4)/5,.65,(R()-.5)*.2,.14+.06*R(),R()<.4?M.leaf:PRODUCE[Math.floor(R()*PRODUCE.length)]));return {parts,footprint:{w,d:.5,h:.9},sockets:{}};}
  const haystack=()=>({parts:[{t:'blob',x:0,y:.7,z:0,rx:1.1,ry:.9,rz:1,col:M.straw,nocol:true},{t:'blob',x:.2,y:1.3,z:0,rx:.7,ry:.5,rz:.65,col:M.straw.map(v=>v*1.05),nocol:true}],footprint:{w:2.2,d:2,h:1.8},sockets:{}});
  function woodpile({w=1.6}={}){const parts=[];for(let r=0;r<3;r++)for(let i=0;i<Math.round(w/.22)-r;i++)parts.push({t:'vdisk',x:-w/2+.12+i*.22+r*.11,y:.12+r*.2,z:.4,r:.1,rot:Math.PI/2,col:M.wood,col2:M.woodLight,nocol:true},box(-w/2+.12+i*.22+r*.11,.02+r*.2,0,.2,.2,.8,M.wood,{nocol:true}));
    return {parts,footprint:{w,d:.9,h:.7},sockets:{}};}
  const bucket=()=>({parts:[cyl(0,0,0,.16,.3,M.wood,{r2:.2,pat:6}),cyl(0,.12,0,.18,.04,M.iron,{nocol:true})],footprint:{w:.4,d:.4,h:.3},sockets:{}});
  function wheelbarrow(){return {parts:[box(0,.4,0,.9,.35,.65,M.wood,{pat:6}),{t:'vdisk',x:.55,y:.25,z:0,r:.25,rot:Math.PI/2,col:M.timber,col2:M.wood,nocol:true},beam([-.4,.4,.25],[-1.1,.55,.25],.05,M.timber),beam([-.4,.4,-.25],[-1.1,.55,-.25],.05,M.timber),box(-.3,0,0,.06,.4,.5,M.timber)],footprint:{w:1.8,d:.7,h:.8},sockets:{}};}
  function flowerPots({n=3,seed=9}={}){const R=rng(seed),parts=[];for(let i=0;i<n;i++){const x=(i-(n-1)/2)*.45;parts.push(cyl(x,0,0,.16,.32,[.72,.42,.3],{r2:.2}),blob(x,.48,0,.22,R()<.5?M.leaf:PRODUCE[Math.floor(R()*PRODUCE.length)]));}return {parts,footprint:{w:n*.45,d:.45,h:.7},sockets:{}};}

  const ASSETS={
    curtainWall:{family:'castle',fn:curtainWall,label:'Curtain wall with walkway'},roundTower:{family:'castle',fn:roundTower,label:'Round tower'},
    roundTowerBattlement:{family:'castle',fn:o=>roundTower({...o,top:'battlement'}),label:'Battlemented round tower'},squareTower:{family:'castle',fn:squareTower,label:'Square tower with turrets'},
    gatehouse:{family:'castle',fn:gatehouse,label:'Gatehouse'},keep:{family:'castle',fn:keep,label:'Keep'},wallStair:{family:'castle',fn:wallStair,label:'Wall stair'},
    road:{family:'road',fn:road,label:'Cobbled road'},flagRoad:{family:'road',fn:o=>road({...o,kind:'flag'}),label:'Flagstone road'},dirtRoad:{family:'road',fn:o=>road({...o,kind:'dirt',kerbs:false}),label:'Dirt lane'},
    junction:{family:'road',fn:junction,label:'Crossroads'},stairs:{family:'road',fn:stairs,label:'Street stairs'},bridge:{family:'road',fn:bridge,label:'Stone bridge'},plaza:{family:'road',fn:plaza,label:'Fountain plaza'},
    stallProduce:{family:'vendor',fn:o=>stall({...o,kind:'produce'}),label:'Produce stall'},stallCloth:{family:'vendor',fn:o=>stall({...o,kind:'cloth',seed:11}),label:'Cloth stall'},
    stallPottery:{family:'vendor',fn:o=>stall({...o,kind:'pottery',seed:12}),label:'Pottery stall'},stallFish:{family:'vendor',fn:o=>stall({...o,kind:'fish',seed:13}),label:'Fish stall'},
    cart:{family:'vendor',fn:cart,label:'Hand cart'},tent:{family:'vendor',fn:tent,label:'Merchant tent'},displayRack:{family:'vendor',fn:displayRack,label:'Display rack'},signPost:{family:'vendor',fn:signPost,label:'Sign post'},
    barrel:{family:'clutter',fn:barrel,label:'Barrel'},crateStack:{family:'clutter',fn:crateStack,label:'Crate stack'},sacks:{family:'clutter',fn:sacks,label:'Sacks'},lampPost:{family:'clutter',fn:lampPost,label:'Lamp post'},
    bench:{family:'clutter',fn:bench,label:'Bench'},well:{family:'clutter',fn:well,label:'Well'},fence:{family:'clutter',fn:fence,label:'Picket fence'},planter:{family:'clutter',fn:planter,label:'Planter'},
    haystack:{family:'clutter',fn:haystack,label:'Haystack'},woodpile:{family:'clutter',fn:woodpile,label:'Woodpile'},bucket:{family:'clutter',fn:bucket,label:'Bucket'},wheelbarrow:{family:'clutter',fn:wheelbarrow,label:'Wheelbarrow'},flowerPots:{family:'clutter',fn:flowerPots,label:'Flower pots'}};
  const FAMILIES=['castle','road','vendor','clutter'];
  // One asset alone, or every asset of a family laid out in a row of pads (gallery scenes), at the origin.
  function make(name,opts={}){const a=ASSETS[name];if(!a)throw Error('Unknown asset '+name);return a.fn(opts);}
  function gallery(family){const names=Object.keys(ASSETS).filter(n=>!family||ASSETS[n].family===family),items=[];let x=0;
    for(const n of names){const r=make(n),w=Math.max(r.footprint.w,r.footprint.d)+2;items.push({name:n,label:ASSETS[n].label,x:x+w/2,w,r});x+=w;}
    const parts=[];for(const it of items){const cx=it.x-x/2;parts.push(box(cx,-.35,0,it.w-.4,.3,Math.max(it.w-.4,4),[.82,.84,.8],{noJitter:true}),...transform(it.r.parts,cx,0,0));}
    return {parts,items:items.map(it=>({name:it.name,label:it.label,x:it.x-x/2})),width:x};}
  // Combination scenes: how the families fit together.
  function scene(kind){const P=[];
    if(kind==='castleGate'){const g=gatehouse();P.push(...g.parts);for(const sx of [-1,1]){P.push(...transform(curtainWall({len:14}).parts,sx*13,0,0));P.push(...transform(roundTower({r:3.6,h:13}).parts,sx*21.5,0,0));}
      P.push(...transform(squareTower({w:6,h:20}).parts,-10,0,-16),...transform(keep().parts,6,0,-22),...transform(wallStair().parts,-15,0,-2.6));
      for(let i=0;i<4;i++)P.push(...transform(road({len:10}).parts,0,0,9+i*10,Math.PI/2));P.push(...transform(bridge({span:12,w:6}).parts,0,0,50,Math.PI/2));
      P.push(...transform(lampPost().parts,-3.6,0,10),...transform(lampPost().parts,3.6,0,10),...transform(cart().parts,2,0,20,.4),...transform(barrel().parts,-4,0,6),...transform(crateStack().parts,-4.6,0,7.3,.3));}
    else{P.push(...plaza({r:10}).parts);for(let i=0;i<4;i++){const a=i*Math.PI/2;for(let k=0;k<2;k++)P.push(...transform(road({len:10,kind:i%2?'flag':'cobble'}).parts,Math.cos(a)*(15+k*10),0,Math.sin(a)*(15+k*10),a));}
      const names=['stallProduce','stallCloth','stallPottery','stallFish','tent','stallProduce'];names.forEach((n,i)=>{const a=(i+.5)/6*Math.PI*2+.3,r=7;P.push(...transform(make(n).parts,Math.cos(a)*r,0,Math.sin(a)*r,-a-Math.PI/2));});
      const cl=[['barrel',-4,4],['crateStack',4.5,-4],['sacks',5,4.5],['bench',-6.5,-1],['lampPost',8.5,8.5],['lampPost',-8.5,-8.5],['planter',-3,-8],['well',13,13],['cart',-13,12],['signPost',12,-11],['flowerPots',-8,3],['woodpile',14,-13],['wheelbarrow',-12,-13],['displayRack',2,8.6]];
      for(const [n,x,z] of cl)P.push(...transform(make(n).parts,x,0,z,Math.atan2(-x,-z)));}
    return {parts:P};}
  return {M,ASSETS,FAMILIES,make,gallery,scene,transform,curtainWall,roundTower,squareTower,gatehouse,keep,wallStair,road,junction,stairs,bridge,plaza,stall,cart,tent,displayRack,signPost,barrel,crate,crateStack,sacks,lampPost,bench,well,fence,planter,haystack,woodpile,bucket,wheelbarrow,flowerPots};
});
