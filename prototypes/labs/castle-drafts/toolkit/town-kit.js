// Metres, Y up; fronts face +Z. Every reusable component emits CastleRender parts.
// Components own geometry and attachment points; the street demo only composes them.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./pavement-plan.js'));else root.TownKit=factory(root.PavementPlan);})(this,function(PavementPlan){
  'use strict';
  const M={plaster:[.89,.84,.72],stone:[.57,.59,.57],trim:[.75,.73,.65],timber:[.27,.19,.14],roof:[.26,.39,.45],glass:[.12,.23,.28],leaf:[.27,.44,.22],brass:[.7,.52,.22]};
  const TYPES={
    house:{label:'Townhouse',w:6,d:6,storeys:2},shop:{label:'Shop',w:6,d:6,storeys:2},inn:{label:'Wayfarer inn',w:14,d:10,storeys:3},
    smithy:{label:'Smithy',w:7.5,d:8,storeys:2},warehouse:{label:'Warehouse',w:7,d:10,storeys:3},
    chapel:{label:'Chapel',w:7,d:10,storeys:1,storeyHeight:5.4},pub:{label:'Neighborhood pub',w:12,d:10,storeys:2},guildhall:{label:'Adventurers guild (landmark)',w:12,d:8,storeys:3,unique:true},towerhouse:{label:'Tower house',w:5,d:5,storeys:5}
  };
  Object.assign(TYPES,{armourer:{label:'Armourer',w:5.5,d:6,storeys:2,shell:'front-gable'},apothecary:{label:'Apothecary',w:5,d:6,storeys:2,shell:'hip'},bookseller:{label:'Bookseller',w:5.5,d:6,storeys:2,shell:'cross-gable'},generalGoods:{label:'General goods',w:6,d:6.5,storeys:1,shell:'cottage'},clothing:{label:'Clothier',w:5.5,d:6,storeys:2,shell:'jetty'},shack:{label:'Patched shack',w:4,d:4.5,storeys:1,storeyHeight:2.4,shell:'cottage'},leanTo:{label:'Lean-to dwelling',w:3.5,d:5,storeys:1,storeyHeight:2.5,shell:'shed'},tenement:{label:'Narrow tenement',w:4.5,d:6,storeys:3,storeyHeight:2.6,shell:'jetty'}});
  Object.assign(TYPES,{stoneCottage:{label:'Stone cottage',w:6,d:6,storeys:1,shell:'cottage'},weaversHouse:{label:'Weaver residence',w:5,d:6.5,storeys:2,shell:'jetty'},merchantHouse:{label:'Merchant residence',w:7,d:7,storeys:3,shell:'hip'},gableHouse:{label:'Narrow gabled home',w:4.5,d:7,storeys:3,shell:'front-gable'},bakery:{label:'Bakery',w:6,d:7,storeys:2,shell:'front-gable'},florist:{label:'Florist',w:5,d:6,storeys:1,shell:'cottage'}});
  Object.assign(TYPES,{galleryHouse:{label:'Gallery house',w:6,d:7,storeys:2,shell:'deep-jetty'},gambrelHouse:{label:'Broken-pitch roof house',w:6,d:7,storeys:2,shell:'gambrel'},sweptHouse:{label:'Swept-gable house',w:5,d:7,storeys:3,shell:'swept'}});
  TYPES.manor={label:'Merchant manor',w:16,d:10,storeys:3,shell:'gambrel'};
  Object.assign(TYPES,{orielHouse:{label:'Oriel house',w:6,d:7,storeys:2,shell:'cross-gable'},bayHouse:{label:'Shallow bay house',w:5.5,d:6,storeys:2,shell:'shallow-bay'}});
  TYPES.undercroftHouse={label:'Undercroft lodging',w:9,d:8,storeys:3,shell:'undercroft'};
  const COMPOUND_KINDS=['cornerHouse','courtyardInn','towerWorkshop'];
  Object.assign(TYPES,{cornerHouse:{label:'L-shaped residence',w:10,d:10,storeys:2},courtyardInn:{label:'Courtyard inn',w:16,d:12,storeys:3},towerWorkshop:{label:'Tower workshop',w:9,d:9,storeys:2}});
  Object.assign(TYPES,{steppedHouse:{label:'Stepped-front residence',w:7,d:7,storeys:3,shell:'stacked-bay'},doubleBayHouse:{label:'Twin-wing merchant house',w:9,d:7,storeys:3,shell:'twin-bay'}});
  const HOME_KINDS=['steppedHouse','doubleBayHouse','undercroftHouse','orielHouse','bayHouse','manor','galleryHouse','gambrelHouse','sweptHouse','stoneCottage','weaversHouse','merchantHouse','gableHouse'];
  const STORE_KINDS=['bakery','florist','armourer','apothecary','bookseller','generalGoods','clothing'],SLUM_KINDS=['stackedDwelling','patchedLodging','shack','leanTo','tenement'];
  Object.assign(TYPES,{stackedDwelling:{label:'Stacked dwelling',w:4,d:6,storeys:4,storeyHeight:2.5,shell:'shed'},patchedLodging:{label:'Patched lodging',w:6,d:6,storeys:2,storeyHeight:2.6,shell:'cross-gable'}});
  const PRESETS={fronts:[['steppedHouse',0],['doubleBayHouse',0],['orielHouse',0]],massing:COMPOUND_KINDS.map(v=>[v,0]),storage:[['undercroftHouse',0],['galleryHouse',0],['warehouse',0]],large:[['pub',0],['inn',0],['manor',0]],forms:['galleryHouse','gambrelHouse','sweptHouse'].map(v=>[v,0]),homes:['stoneCottage','weaversHouse','merchantHouse','gableHouse'].map(v=>[v,0]),green:[['orielHouse',0],['bayHouse',0],['galleryHouse',0]],shops:[['bakery',0],['florist',0],['bookseller',0]],street:[['apothecary',-9],['inn',0],['house',9]],craft:[['smithy',-12],['warehouse',-1],['house',11]],civic:[['chapel',-12],['pub',0],['towerhouse',11]],slumDense:SLUM_KINDS.map(v=>[v,0]),slums:[['shack',0],['leanTo',0],['tenement',0]],market:[['armourer',0],['apothecary',0],['bookseller',0],['generalGoods',0],['clothing',0]]};
  const CATALOG=[['foundation','Level building pad with buried stone plinth'],['wallBay','Wall with actual openings and recessed joinery'],['roof','Pitched roof, closed gables, fascia and ridge'],['dormer','Roof attachment seated in the main slope'],['oriel','Projecting window bay with a parent-wall opening and joined cross-gable'],['entrance','Landing and terrain-sized stair flight'],['path','Grade-following paving or walkable stairs'],['retainingWall','Stone support between ground and a terrace']];
  const box=(x,y,z,w,h,d,col,extra={})=>({t:'box',x,y,z,w,h,d,col,...extra});
  const tint=(c,k)=>c.map(x=>x*k);
  function checkPositive(...values){if(values.some(x=>!Number.isFinite(x)||x<=0))throw Error('Component dimensions must be positive finite metres');}
  // Rotate both geometry and sockets as a unit; no caller-specific coordinate offsets.
  function transform(parts,x=0,y=0,z=0,rot=0){const c=Math.cos(rot),s=Math.sin(rot),P=(u,v)=>[x+u*c-v*s,z+u*s+v*c];return parts.map(p=>{const q={...p};
    if(p.x!=null){[q.x,q.z]=P(p.x,p.z);q.y=(p.y||0)+y;}
    if(p.x0!=null){[q.x0,q.z0]=P(p.x0,p.z0);[q.x1,q.z1]=P(p.x1,p.z1);q.y0=p.y0+y;q.y1=p.y1+y;}
    if(p.shadeBase!=null)q.shadeBase=p.shadeBase+y;if(p.shadeTop!=null)q.shadeTop=p.shadeTop+y;if(p.base!=null)q.base=p.base+y;if(p.rot!=null||p.t==='box'||p.t==='gable'||p.t==='hip')q.rot=(p.rot||0)+rot;return q;});}
  function foundation({w,d,floor,ground}){checkPositive(w,d);const low=Math.min(...[-1,1].flatMap(a=>[-1,1].map(b=>ground(a*w/2,b*d/2))))-.5;
    return {parts:[box(0,low,0,w,Math.max(.3,floor-low-.24),d,M.stone,{pat:4}),box(0,floor-.24,0,w+.18,.12,d+.18,M.trim,{pat:0})],sockets:{floor:{x:0,y:floor,z:0}},bottom:low};}
  function wallBay({w=3,h=3.2,opening='window',col=M.plaster,timber=false,stoneBase=false,shutters=false,endPost=true,masonry=false,wood=false,stoneCol=M.stone,frameCol=null,glassCol=M.glass,openCargo=false,threshold=true,windowWidth=1.25}){checkPositive(w,h);
    const parts=[],joinery=[],hole=opening==='blank'?null:{x:0,y:['door','cargo','bay'].includes(opening)?0:opening==='vent'?h*.65:Math.min(.85,h*.24),w:opening==='bay'?2.1:opening==='cargo'?Math.min(2.5,w-.35):opening==='shop'?w-.65:windowWidth,h:opening==='vent'?.45:opening==='bay'?h-.025:opening==='cargo'?Math.min(2.7,h-.2):opening==='door'?Math.min(2.45,h-.2):Math.min(opening==='shop'?1.85:1.65,h-Math.min(.85,h*.24)-.25)};
    const member=(role,x,y,z,w,h,d,col,extra={})=>{const p=box(x,y,z,w,h,d,col,{role,...extra});parts.push(p);joinery.push(p);};
    const wall=(x,y,ww,hh)=>{if(ww<=.001||hh<=.001)return;const stone=masonry?hh:stoneBase?Math.max(0,Math.min(hh,.72-y)):0;
      if(stone>0)parts.push(box(x,y,0,ww,stone,.34,stoneCol,{pat:4,role:'masonry-wall'}));
      if(hh-stone>.001)parts.push(box(x,y+stone,0,ww,hh-stone,.34,col,{pat:wood?6:11,bakeShade:true,shadeBase:0,shadeTop:h}));};
    if(!hole)wall(0,0,w,h);else{const {x,y,w:ww,h:hh}=hole,side=(w-ww)/2;wall(-w/2+side/2,0,side,h);wall(w/2-side/2,0,side,h);wall(x,0,ww,y);wall(x,y+hh,ww,h-y-hh);
      if(opening!=='bay'){const door=['door','cargo'].includes(opening),frame=frameCol||(door?M.timber:M.trim),sillY=door?y:y+.02,headerY=y+hh-.045;
      // Casings are full-depth reveals, joining the backing panel to the outer frame.
      // Members meet at common planes; overlapping coplanar front faces are avoided.
      member('pane',x,y,openCargo?-.48:-.07,ww+.04,hh,.055,openCargo?[.1,.105,.09]:door?M.timber:glassCol,{pat:door?6:0});
      for(const e of [-1,1])member('jamb',x+e*(ww/2-.015),sillY,.12,.14,headerY-sillY,.42,frame);
      member('header',x,headerY,.12,ww+.11,.14,.42,frame);
      if(!door){
        member('sill',x,y-.12,.32,ww+.38,.14,.58,frame);
        member('mullion',x,sillY,.08,.09,headerY-sillY,.34,M.timber);
        const len=(ww-.14)/2;for(const e of [-1,1])member('crossbar',x+e*(len+.09)/2,y+hh*.55,.08,len,.08,.34,M.timber);
      }else{if(threshold)member('door-threshold',x,-.12,0,ww+.11,.12,.6,M.trim);if(!openCargo)member('handle',.36,1.1,.01,.075,.08,.16,M.brass);}
      if(openCargo){const leafW=ww/2;for(const side of [-1,1]){const angle=side*.9,cx=side*(ww/2+leafW/2*Math.cos(.9)),cz=.2+leafW/2*Math.sin(.9);parts.push(box(cx,y,cz,leafW,hh,.12,M.timber,{pat:6,rot:angle,role:'loading-door'}));for(const yy of [y+.18,y+hh-.26])parts.push(box(cx-Math.sin(angle)*.075,yy,cz+Math.cos(angle)*.075,leafW,.1,.055,tint(M.timber,.65),{rot:angle}));}}
      if(shutters&&opening==='window')for(const e of [-1,1]){const sx=e*(ww/2+.32),angle=e*.12;
        parts.push(box(sx,y,.28,.45,hh,.12,[.32,.39,.29],{pat:6,rot:angle}));
        for(const yy of [y+.15,y+hh-.23])parts.push(box(sx-Math.sin(angle)*.075,yy,.28+Math.cos(angle)*.075,.45,.085,.04,M.timber,{rot:angle}));
        for(const yy of [y+.3,y+hh-.35])parts.push(box(e*(ww/2+.1),yy,.21,.16,.075,.2,M.timber));
      }
    }
    }
    if(timber){for(const e of (endPost?[-1,1]:[-1]))parts.push(box(e*(w/2-.07),0,.25,.14,h,.22,M.timber));parts.push(box(0,h-.16,.25,w,.16,.22,M.timber));
      if(h>2.8)for(const e of [-1,1])parts.push({t:'beam',x0:e*(w/2-.06),y0:h-.65,z0:.25,x1:e*(w/2-.78),y1:h-.12,z1:.25,s:.13,col:M.timber});}
    return {parts,joinery,opening:hole,sockets:hole?{opening:{x:0,y:hole.y,z:.17}}:{}};}
  function roof({w,d,y,h,col=M.roof,endOverhang=.45,eaveOverhang=.45,wallCol=M.plaster,profile='straight'}){checkPositive(w,d,h);const ov=eaveOverhang,ovx=endOverhang,edgeHeight=h*ov/(d/2+ov),parts=[box(0,y-.04,0,w+.12,edgeHeight+.04,d,wallCol,{pat:11,role:'roof-collar'}),{t:'gable',x:0,y,z:0,w:w+ovx*2,d:d+ov*2,h,col,pat:2,openEnds:true,roofThickness:.16}];
    for(const e of [-1,1]){parts.push(box(0,y-.18,e*(d/2+ov),w+ovx*2,.2,.16,M.timber));
      // Closed plaster gables and bargeboards meet the same ridge endpoints.
      const edge=edgeHeight;parts.push({t:'gable',x:e*(w/2-.02),y:y+edge,z:0,w:.08,d,h:h-edge,col:wallCol,pat:11,wallOnly:true});
      for(const side of [-1,1])parts.push({t:'beam',x0:e*(w/2+ovx),y0:y,z0:side*(d/2+ov),x1:e*(w/2+ovx),y1:y+h,z1:0,s:.17,col:M.timber});}
    parts.push(box(0,y+h-.04,0,w+ovx*2,.14,.2,tint(col,.75)));
    if(profile==='gambrel'||profile==='swept'){
      const q=d/2+ov,points=profile==='gambrel'?[[0,h],[q*.5,h*.78],[q,0]]:[[0,h],[q*.35,h*.48],[q*.7,h*.14],[q,0]];
      const sample=z=>{const a=Math.abs(z);for(let i=1;i<points.length;i++)if(a<=points[i][0]){const u=points[i-1],v=points[i];return y+u[1]+(v[1]-u[1])*(a-u[0])/(v[0]-u[0]);}return y;};
      parts.length=0;
      for(const side of [-1,1])for(let i=1;i<points.length;i++){
        const a=side*points[i-1][0],b=side*points[i][0],ya=sample(a),yb=sample(b);
        parts.push({t:'ramp',x0:0,z0:a,y0:ya-.04,x1:0,z1:b,y1:yb-.04,w,base:y-.08,rail:false,col:wallCol,pat:11,role:'profile-infill'}, {t:'ramp',x0:0,z0:a,y0:ya,x1:0,z1:b,y1:yb,w:w+ovx*2,thickness:.16,closedBottom:true,rail:false,col,pat:2,role:'profile-roof'});
        for(const e of [-1,1])parts.push({t:'beam',x0:e*(w/2+ovx),z0:a,y0:ya,x1:e*(w/2+ovx),z1:b,y1:yb,s:.17,col:M.timber});
      }
      parts.push(box(0,y+h,0,w+ovx*2,.12,.18,M.timber));return {parts,surface:(x,z)=>sample(z),sockets:{ridge:{x:0,y:y+h,z:0},dormer:{x:0,y:sample(q*.5),z:q*.5}}};
    }
    return {parts,surface:(x,z)=>y+h*Math.max(0,1-Math.abs(z)/(d/2+ov)),sockets:{ridge:{x:0,y:y+h,z:0},dormer:{x:0,y:y+h*.5-.12,z:(d+ov*2)*.25}}};}
  function dormer({x,y,z,col=M.roof}){const parts=[];const bay=wallBay({w:1.9,h:1.65,timber:true});parts.push(...transform(bay.parts,x,y,z+.65));parts.push(box(x,y,z,1.9,1.65,1.3,M.plaster,{pat:11}));
    // Seat the window in front of the body; this leaves the glass behind its reveals.
    parts.pop();parts.push(box(x,y,z-.08,1.9,1.65,1.1,M.plaster,{pat:11}));
    parts.push({t:'gable',x,y:y+1.65,z,w:1.65,d:2.25,h:.85,rot:Math.PI/2,col,pat:2,roofThickness:.12});return {parts};}
  function oriel({x,y,z,col=M.plaster,roofCol=M.roof,depth=1.05,canopyStyle='gable',levels=1}){const w=2.1,h=levels*3.2-.12,embed=1.7,parts=[];
    for(let level=0;level<levels;level++){const front=wallBay({w,h:level===levels-1?3.08:3.2,opening:'window',col,timber:true});parts.push(...transform(front.parts,x,y+level*3.2,z+depth));if(levels>1)parts.push(box(x,y+level*3.2+.15,z+depth+.19,.7,.42,.04,[.27,.43,.48],{role:'painted-panel'}));}
    // The sides reach inside the parent opening and terminate at the front wall's inner face.
    for(const e of [-1,1])for(let level=0;level<levels;level++){const side=wallBay({w:depth,h:level===levels-1?3.08:3.2,opening:'window',windowWidth:Math.min(.5,depth-.2),col,timber:true});parts.push(...transform(side.parts,x+e*(w/2-.17),y+level*3.2,z+depth/2-.17,e>0?-Math.PI/2:Math.PI/2));}
    parts.push(box(x,y-.18,z+depth/2,w+.18,.18,depth+.34,M.timber));
    // A cross-gable starts under the parent roof and rises from the same eave datum.
    // Behind the intersection its ridge is buried beneath the main roof slope.
    const canopy=canopyStyle==='hip'?{parts:[{t:'hip',x:0,y:y+h,z:0,w:depth+embed,d:w+.3,h:.8,col:roofCol,pat:2,roofThickness:.14}]}:roof({w:depth+embed,d:w,y:y+h,h:1.35,col:roofCol});
    parts.push(...transform(canopy.parts,x,0,z+(depth-embed)/2,Math.PI/2));
    for(const e of [-1,1])parts.push({t:'beam',x0:x+e*.72,y0:y-.8,z0:z+.05,x1:x+e*.72,y1:y-.18,z1:z+depth-.1,s:.18,col:M.timber});
    return {parts,sockets:{wall:{x,y,z}},opening:{w,h},roof:canopy};}
  function retainingWall({x0,z0,x1,z1,top0,top1,ground,w=.3}){const base=Math.min(ground(x0,z0),ground(x1,z1))-.5;
    return {parts:[{t:'ramp',x0,z0,x1,z1,y0:top0,y1:top1,w,base,rail:false,col:M.stone,pat:4}]};}
  function path({x0,z0,x1,z1,y0,y1,w=2,ground,maxGrade=.12,riser=.16}){checkPositive(w,riser);const L=Math.hypot(x1-x0,z1-z0);checkPositive(L);const steps=Math.abs(y1-y0)/L>maxGrade?Math.max(1,Math.ceil(Math.abs(y1-y0)/riser-1e-8)):0,segments=steps||Math.max(1,Math.ceil(L/2)),parts=[];
    for(let i=0;i<segments;i++){const a=i/segments,b=(i+1)/segments,ax=x0+(x1-x0)*a,az=z0+(z1-z0)*a,bx=x0+(x1-x0)*b,bz=z0+(z1-z0)*b,ya=y0+(y1-y0)*a,yb=y0+(y1-y0)*b,nx=-(z1-z0)/L*w/2,nz=(x1-x0)/L*w/2;
      const base=Math.min(ground(ax-nx,az-nz),ground(ax+nx,az+nz),ground(bx-nx,bz-nz),ground(bx+nx,bz+nz),ya,yb)-.45;
      parts.push({t:'ramp',x0:ax,z0:az,x1:bx,z1:bz,y0:steps?Math.max(ya,yb):ya,y1:steps?Math.max(ya,yb):yb,w,base,rail:false,pat:3,sidePat:4,col:[.65,.62,.53],role:steps?'stair':'path'});}
    return {parts,steps,sockets:{start:{x:x0,y:y0,z:z0},end:{x:x1,y:y1,z:z1}}};}
  function entrance({x,z,floor,ground,streetZ=8,w=1.9,streetY=ground(x,streetZ)+.12,doorDepth=.65,streetDepth=.7}){const near=z+doorDepth,far=streetZ-streetDepth;
    if(far<=near)throw Error('Entrance requires room for its two landings');
    const approach=path({x0:x,z0:far,x1:x,z1:near,y0:streetY,y1:floor,w,ground});
    const landing=(z0,z1,top,role)=>{const base=Math.min(ground(x-w/2,z0),ground(x+w/2,z0),ground(x-w/2,z1),ground(x+w/2,z1),top)-.4;
      return box(x,base,(z0+z1)/2,w,top-base,z1-z0,[.65,.62,.53],{pat:3,role});};
    approach.parts.push(landing(z-.08,near,floor,'door-landing'),landing(far,streetZ,streetY,'street-landing'));
    return {...approach,landings:{door:{x,z0:z,z1:near,y:floor,w},street:{x,z0:far,z1:streetZ,y:streetY,w}},sockets:{door:{x,y:floor,z},street:{x,y:streetY,z:streetZ}}};}
  // Craft and hospitality buildings use their own structural plans, not house skins.
  function artisanBuilding({id,x,z,w,d,storeys,storeyHeight=3.2,floor,ground,variant,roofCol,partyLeft,partyRight,streetHeight}){
    const parts=[],timber=[.24,.165,.105],oak=[.38,.285,.18],stone=[.5,.49,.43],h=storeyHeight,front=d/2,sockets={},features={};
    parts.push(...foundation({w,d,floor,ground:(u,v)=>ground(x+u,z+v)}).parts);
    function facade(cx,cy,cz,width,height,rotation,openings,{masonry=false,wood=false,grid=false,party=false}={}){
      const count=variant==='warehouse'?1:Math.max(1,Math.round(width/3)),bw=width/count;
      for(let i=0;i<count;i++){
        let opening=party?'blank':openings(i,count);const ux=cx-width/2+(i+.5)*bw;if(!rotation&&Math.abs(cy-floor)<1e-6&&['window','shop'].includes(opening)&&streetHeight&&Math.max(streetHeight(x+ux-.8),streetHeight(x+ux+.8))>floor+.45)opening='blank';const bay=wallBay({w:bw,h:height,opening,col:wood?oak:[.86,.79,.66],masonry,stoneCol:stone,wood,timber:!party,shutters:!party&&opening==='window',frameCol:timber,glassCol:variant==='pub'?[.31,.27,.16]:variant==='smithy'?[.09,.1,.08]:M.glass,openCargo:opening==='cargo',threshold:Math.abs(cy-floor)<1e-6,endPost:i===count-1});
        // Small leaded panes belong to pubs; storage and forge openings stay utilitarian.
        if(grid&&!party&&opening==='shop'&&bay.opening){const q=bay.opening;for(const k of [-1,1])bay.parts.push(box(k*q.w/3,q.y+.02,.085,.045,q.h-.06,.34,timber));for(const t of [.28,.75])bay.parts.push(box(0,q.y+q.h*t,.085,q.w-.13,.045,.34,timber));}
        parts.push(...transform(bay.parts,cx-width/2+(i+.5)*bw,cy,cz,rotation));
      }
    }
    // Side facades use a perpendicular frame and omit openings on narrow party sides.
    function ends(y,height,depth,centerZ,{masonry=false,wood=false}={}){
      const length=depth-.34;
      for(const side of [-1,1]){const party=side<0?partyLeft:partyRight,count=Math.max(1,Math.round(length/3)),bw=length/count;
        for(let i=0;i<count;i++){const bay=wallBay({w:bw,h:height,opening:party||variant==='warehouse'?'blank':'window',masonry,stoneCol:stone,wood,col:oak,timber:!party,frameCol:timber,endPost:i===count-1});parts.push(...transform(bay.parts,side*(w/2-.17),y,centerZ-length/2+(i+.5)*bw,side>0?-Math.PI/2:Math.PI/2));}
      }
    }
    function floorPlate(y,depth,centerZ){const groundFloor=Math.abs(y-floor)<1e-6;
      parts.push(box(0,y-.15,centerZ,w+.16,groundFloor?.15:.2,depth+.16,timber,{role:groundFloor?'ground-floor-frame':'upper-frame'}),box(0,groundFloor?y-.12:y+.015,centerZ,w-.35,groundFloor?.12:.1,depth-.35,oak,{role:groundFloor?'ground-floor':'upper-floor'}));}
    function barrel(px,pz,scale=1,base=floor){parts.push({t:'cyl',x:px,y:base,z:pz,r:.34*scale,h:.85*scale,col:oak,pat:6});for(const yy of [.12,.7])parts.push({t:'cyl',x:px,y:base+yy*scale,z:pz,r:.35*scale,h:.06*scale,col:[.2,.21,.19]});}
    let r,roofOffset=0,roofRotation=0,chimney=null;
    if(variant==='smithy'){
      const workDepth=2.5,bodyDepth=d-workDepth,bodyZ=-workDepth/2,wallFront=front-workDepth;
      for(let level=0;level<storeys;level++){const yy=floor+level*h;
        facade(0,yy,wallFront,w,h,0,(i)=>level===0?(i===0?'door':i===1?'vent':'blank'):i===2?'blank':'window',{masonry:level===0,wood:level>0});
        facade(0,yy,-d/2,w,h,Math.PI,()=>level===0?'blank':'window',{masonry:level===0,wood:level>0});ends(yy,h,bodyDepth,bodyZ,{masonry:level===0,wood:level>0});floorPlate(yy,bodyDepth,bodyZ);
      }
      const nb=Math.round(w/3);sockets.door={x:x-w/2+w/nb/2,y:floor,z:z+wallFront+.17};
      r=roof({w,d:bodyDepth,y:floor+storeys*h,h:3.1,col:roofCol,endOverhang:.06,wallCol:oak});roofOffset=bodyZ;parts.push(...transform(r.parts,0,0,bodyZ));
      // A whole paved, post-and-beam forge yard lies under a structural lean-to.
      parts.push(box(0,floor-.35,front-workDepth/2,w,.35,workDepth,[.48,.48,.43],{pat:3,role:'work-yard'}));
      parts.push({t:'ramp',x0:0,z0:wallFront+.08,y0:floor+3.05,x1:0,z1:front+.3,y1:floor+2.55,w:w+.24,thickness:.16,closedBottom:true,rail:false,col:roofCol,pat:2,sidePat:6,role:'work-canopy'});
      for(const px of [-w/2+.2,w/2-.2]){
        parts.push(box(px,floor,front,.22,2.61,.22,timber,{role:'work-post'}));
        parts.push({t:'beam',x0:px,y0:floor+2.05,z0:front,x1:px,y1:floor+2.68,z1:front-.75,s:.14,col:timber});
      }
      parts.push(box(0,floor+2.46,front,w+.16,.16,.23,timber));
      const fx=w*.22,fz=wallFront+.65;
      parts.push(box(fx,floor+.02,fz,1.75,.35,1.25,stone,{pat:4}),box(fx,floor+.37,fz-.45,1.75,1.55,.22,stone,{pat:4}));
      for(const side of [-1,1])parts.push(box(fx+side*.72,floor+.37,fz+.12,.3,1.25,1.1,stone,{pat:4}));
      parts.push(box(fx,floor+1.62,fz+.12,1.75,.35,1.1,stone,{pat:4}),box(fx,floor+.5,fz+.05,1,.75,.045,[.105,.07,.045],{nocol:true,role:'forge-fire'}));
      for(let i=-2;i<=2;i++)parts.push({t:'blob',x:fx+i*.17,y:floor+.46,z:fz+.2,rx:.12,ry:.07,rz:.12,col:[.9,.28,.035],glow:true,nocol:true});
      for(let i=-1;i<=1;i++)parts.push({t:'cone',x:fx+i*.23,y:floor+.47,z:fz+.16,r:.12,h:i===0?.55:.34,col:[1,.39,.035],glow:true,nocol:true});
      for(let i=-2;i<=2;i++)parts.push(box(fx+i*.18,floor+.4,fz+.52,.045,.22,.15,[.16,.17,.16]));
      const flueZ=wallFront-.2,top=r.surface(fx,flueZ-bodyZ)+1.7;
      parts.push(box(fx,floor+1.8,flueZ,1.05,top-floor-1.8,1.05,stone,{pat:4,role:'forge-flue'}),box(fx,top,flueZ,1.2,.2,1.2,M.trim));
      chimney={x:x+fx,z:z+flueZ,bottom:floor+1.8,top,w:1.05,d:1.05};
      const ax=.25,az=front-.75;parts.push(box(ax,floor,az,.5,.68,.5,timber),box(ax,floor+.68,az,.85,.13,.43,[.23,.25,.25]),{t:'gable',x:ax+.4,y:floor+.68,z:az,w:.4,d:.4,h:.13,rot:Math.PI/2,col:[.23,.25,.25],role:'anvil'});
      barrel(w/2-.65,front-.65);parts.push({t:'cyl',x:w/2-.65,y:floor+.86,z:front-.65,r:.3,h:.025,col:[.17,.27,.28]});
      parts.push(box(w/2-.8,floor+.8,wallFront+.75,1.2,.14,.75,oak));for(const px of [w/2-1.25,w/2-.35])parts.push(box(px,floor,wallFront+.75,.1,.8,.65,timber));
      for(let i=0;i<4;i++)parts.push({t:'beam',x0:fx-.45+i*.3,y0:floor+.95,z0:wallFront+.23,x1:fx-.42+i*.3,y1:floor+1.65,z1:wallFront+.23,s:.045,col:[.2,.22,.22]});
      features.workArea={x,z0:z+wallFront,z1:z+front,width:w,covered:true};
    }else if(variant==='warehouse'){
      for(let level=0;level<storeys;level++){const yy=floor+level*h;
        facade(0,yy,front,w,h,0,(i,n)=>i===Math.floor(n/2)?'cargo':'blank',{masonry:level===0,wood:level>0});
        facade(0,yy,-front,w,h,Math.PI,()=> 'blank',{masonry:level===0,wood:level>0});ends(yy,h,d,0,{masonry:level===0,wood:level>0});floorPlate(yy,d,0);for(const side of [-1,1])parts.push(box(side*w*.26,yy,front+.24,.18,h,.2,timber));
      }
      sockets.door={x,y:floor,z:z+front+.17};
      r=roof({w:d,d:w,y:floor+storeys*h,h:4.2,col:[.24,.3,.32],endOverhang:.45,eaveOverhang:.06,wallCol:oak});roofRotation=Math.PI/2;for(const p of r.parts)if(p.pat===11)p.pat=6;parts.push(...transform(r.parts,0,0,0,roofRotation));
      const yy=floor+storeys*h+3.7,zz=front+1.25;parts.push(box(0,yy,front+.35,.2,.22,2.4,timber,{role:'hoist-beam'}));
      parts.push({t:'beam',x0:0,y0:yy-.9,z0:front+.1,x1:0,y1:yy,z1:zz,s:.12,col:timber},{t:'cyl',x:0,y:floor+h+.1,z:zz,r:.025,h:yy-floor-h-.1,col:[.45,.38,.24],nocol:true,role:'hoist-rope'});
      for(const px of [-w/2+.7,w/2-.7]){barrel(px,front+.65,.85,streetHeight?streetHeight(x+px):floor-.08);parts.push(box(px,floor,front-.8,.95,.8,.8,oak,{pat:6,role:'freight-crate'}));}
      features.loadingLevels=storeys;features.glazedWindows=0;
    }else{
      // The pub is a heavy masonry ground floor with a dark joinery shopfront,
      // rather than a plaster house carrying an awning and a pair of barrels.
      const nb=Math.round(w/3),center=Math.floor(nb/2),bw=w/nb;
      for(let level=0;level<storeys;level++){const yy=floor+level*h;
        facade(0,yy,front,w,h,0,i=>level===0?(i===center?'door':'shop'):'window',{masonry:level===0,wood:level>0,grid:level===0});
        facade(0,yy,-front,w,h,Math.PI,()=>level===0?'blank':'window',{masonry:level===0,wood:level>0});ends(yy,h,d,0,{masonry:level===0,wood:level>0});floorPlate(yy,d,0);
      }
      sockets.door={x:x-w/2+(center+.5)*bw,y:floor,z:z+front+.17};
      r=roof({w,d,y:floor+storeys*h,h:3.4,col:[.29,.3,.29],endOverhang:.06,wallCol:oak});parts.push(...r.parts);
      parts.push(box(0,floor+h-.55,front+.25,w+.1,.4,.28,timber,{role:'pub-fascia'}));
      // Raised wood panelling and pilasters make the street face substantial.
      for(const side of [-1,1])parts.push(box(side*w/3,floor+.18,front+.22,bw-.3,.52,.15,timber,{pat:6}));
      for(let i=0;i<=nb;i++)parts.push(box(-w/2+i*bw,floor,front+.27,.18,h,.2,timber));
      const doorX=sockets.door.x-x;parts.push({t:'ramp',x0:doorX,z0:front+.15,y0:floor+2.9,x1:doorX,z1:front+1.05,y1:floor+2.65,w:1.9,thickness:.14,closedBottom:true,rail:false,pat:2,sidePat:6,col:[.29,.3,.29],role:'pub-porch'});
      for(const side of [-1,1])parts.push({t:'beam',x0:doorX+side*.82,y0:floor+2.25,z0:front+.16,x1:doorX+side*.82,y1:floor+2.67,z1:front+.85,s:.13,col:timber});
      const downhill=streetHeight&&streetHeight(x-w/2)<streetHeight(x+w/2)?-1:1,sx=downhill*(w/2-.3),sz=front+1.15;parts.push(box(sx,floor+3.05,front+.65,.14,.14,1.7,timber));
      for(const side of [-1,1])parts.push(box(sx,floor+2.72,sz+side*.28,.14,.4,.055,[.2,.21,.19]));
      parts.push(box(sx,floor+2.08,sz,.12,.7,.9,timber,{role:'pub-sign'}));
      for(const side of [-1,1]){parts.push(box(sx+side*.075,floor+2.15,sz,.04,.52,.72,[.4,.3,.17]));parts.push(box(sx+side*.105,floor+2.3,sz,.025,.22,.2,M.brass),box(sx+side*.105,floor+2.46,sz,.025,.045,.24,M.brass));}
      const cx=-w*.28,cz=-d*.08,top=r.surface(cx,cz)+1.5;parts.push(box(cx,floor,cz,.8,top-floor,.8,stone,{pat:4}),box(cx,top,cz,1,.18,1,M.trim));
      chimney={x:x+cx,z:z+cz,bottom:floor,top,w:.8,d:.8};
      for(const side of [-1,1]){if(streetHeight&&Math.abs(streetHeight(x-w/2)-streetHeight(x+w/2))>.3&&side!==downhill)continue;const px=side*w*.35,base=streetHeight?streetHeight(x+px):floor-.16;parts.push(box(px,base-.2,front+.75,1.65,.2,1.2,stone,{pat:3,role:'display-pad'}));parts.push(box(px,base+.78,front+.75,1.35,.13,.7,oak));for(const e of [-1,1])parts.push(box(px+e*.5,base,front+.75,.1,.78,.58,timber));barrel(px,front+.3,.7,base);}
      features.materials=['stone','timber'];features.pubFrontage=true;
    }
    const roofHeight=(px,pz)=>roofRotation?r.surface(pz-z,-px):r.surface(px,pz-z-roofOffset);
    return {id,variant,shell:variant+'-plan',storeyHeight:h,parts:transform(parts,x,0,z),sockets,roof:r,roofHeight,chimney,features,partyLeft,partyRight,footprint:{x,z,w,d,floor}};
  }
  function homeBuilding(spec){
    const {variant,x,z,w,d,floor,storeys,storeyHeight}=spec;
    const base=building({...spec,variant:'house',decorative:!['stoneCottage','gambrelHouse','sweptHouse','manor'].includes(variant),wallFinish:variant==='weaversHouse'?'wood':'plaster',roofRise:variant==='manor'?4.2:null});
    const palette={steppedHouse:[.83,.77,.66],doubleBayHouse:[.77,.79,.71],undercroftHouse:[.79,.76,.66],orielHouse:[.84,.8,.67],bayHouse:[.74,.8,.73],manor:[.84,.79,.68],galleryHouse:[.84,.77,.63],gambrelHouse:[.75,.72,.64],sweptHouse:[.69,.76,.76],stoneCottage:[.65,.63,.53],weaversHouse:[.46,.31,.2],merchantHouse:[.77,.68,.55],gableHouse:[.71,.77,.73]};
    for(const p of base.parts){if(p.pat===11){p.col=palette[variant];if(variant==='stoneCottage')p.pat=4;}if(p.role==='jamb'||p.role==='header'||p.role==='sill')p.col=variant==='weaversHouse'?M.timber:M.trim;}
    const face=z+d/2,px=x+w*.28,level=spec.streetHeight?spec.streetHeight(px):floor-.16,parts=base.parts;
    parts.push(box(px,level-.2,face+.65,1.5,.2,1.1,M.stone,{pat:4,role:'display-pad'}));
    if(variant==='stoneCottage'){for(const e of [-1,1])parts.push(box(px+e*.5,level,face+.65,.15,.42,.5,M.stone,{pat:4}));parts.push(box(px,level+.42,face+.65,1.35,.12,.55,M.timber,{role:'garden-bench'}));}
    if(variant==='weaversHouse'){for(const e of [-1,1])parts.push(box(px+e*.55,level,face+.65,.08,1.65,.1,M.timber));parts.push(box(px,level+1.55,face+.65,1.2,.08,.1,M.timber));for(let i=0;i<3;i++)parts.push(box(px+(i-1)*.35,level+.55,face+.65,.28,.95,.045,[[.52,.33,.25],[.63,.58,.39],[.3,.43,.45]][i],{role:'drying-cloth'}));}
    if(variant==='merchantHouse'){for(const e of [-1,1]){parts.push({t:'cyl',x:px+e*.4,y:level,z:face+.65,r:.22,h:.35,col:[.55,.34,.23]});parts.push({t:'blob',x:px+e*.4,y:level+.6,z:face+.65,rx:.3,ry:.35,rz:.3,col:M.leaf,role:'topiary'});}for(let k=0;k<3;k++)parts.push(box(x,floor+(k+1)*storeyHeight-.35,face+.3,w,.12,.22,M.trim,{role:'stone-stringcourse'}));}
    if(variant==='gableHouse'){parts.push(box(px,level,face+.65,1.1,.5,.65,M.timber,{pat:6,role:'wood-store'}));for(let i=0;i<4;i++)parts.push({t:'cyl',x:px+(i-1.5)*.2,y:level+.5,z:face+.65,r:.09,h:.35,col:[.48,.34,.22]});}
    if(variant==='galleryHouse'){
      const y=floor+storeyHeight,zz=face+.85+.8;parts.push(box(x,y-.22,zz,w,.22,1.65,M.timber,{pat:6,role:'gallery-deck'}));
      for(let i=0;i<=Math.round(w/3);i++){const xx=x-w/2+i*w/Math.round(w/3);parts.push(box(xx,spec.streetHeight?spec.streetHeight(xx):floor,zz+.65,.16,y-(spec.streetHeight?spec.streetHeight(xx):floor),.16,M.timber,{role:'gallery-post'}),box(xx,y,zz+.65,.1,1,.1,M.timber));}
      parts.push(box(x,y+.95,zz+.65,w,.12,.12,M.timber));for(let i=0;i<12;i++)parts.push(box(x-w/2+(i+.5)*w/12,y,zz+.65,.055,.95,.08,M.timber));
    }
    if(variant==='manor'){
      for(let i=parts.length-1;i>=0;i--)if(parts[i].role==='chimney'||parts[i].role==='flashing'||(parts[i].w===.85&&parts[i].h===.18&&parts[i].d===.9))parts.splice(i,1);
      const tx=x+w*.3,tz=z-d*.12,baseY=floor+storeys*storeyHeight-.5,top=baseY+4.1;
      parts.push(box(tx,baseY,tz,2.6,4.1,2.6,M.plaster,{pat:11,role:'roof-tower'}));
      for(const sign of [-1,1])parts.push(box(tx+sign*1.18,baseY,tz+.12,.18,4.1,2.6,M.timber));
      parts.push(...transform(roof({w:3,d:3,y:top,h:2.6,col:spec.roofCol,profile:'swept'}).parts,tx,0,tz));
    }
    return {...base,variant,features:{homeKind:variant,shell:spec.shell}};
  }
  function merchantBuilding(spec){
    const {variant,x,z,w,d,floor,ground,streetHeight,shell}=spec;
    const base=building({...spec,variant:'shop',shell,decorative:variant==='apothecary',wallFinish:variant==='clothing'?'wood':'plaster'}),parts=base.parts,px=x+w*.24,pz=z+d/2+.75,level=streetHeight?streetHeight(px):floor-.16;
    const colors={bakery:[.64,.43,.24],florist:[.35,.5,.3],armourer:[.34,.39,.41],apothecary:[.23,.43,.36],bookseller:[.28,.33,.48],generalGoods:[.57,.4,.22],clothing:[.47,.28,.4]},brand=colors[variant];
    const washes={armourer:[.68,.69,.64],apothecary:[.76,.81,.65],bookseller:[.82,.73,.6],generalGoods:[.85,.79,.65],clothing:[.72,.67,.62],bakery:[.87,.77,.61],florist:[.8,.83,.71]};
    for(const p of parts){if(p.pat===11){p.col=washes[variant];if(variant==='armourer'&&p.y<floor+spec.storeyHeight)p.pat=4;}if(p.t==='ramp'&&p.pat===10)p.col=brand;}

    for(const p of parts)if(p.t==='box'&&Math.abs(p.w-.045)<1e-6&&Math.abs(p.h-.52)<1e-6)p.col=brand;
    parts.push(box(px,level-.24,pz,1.65,.24,1.05,[.58,.55,.47],{pat:3,role:'display-pad'}));
    const counter=()=>{parts.push(box(px,level+.72,pz,1.45,.12,.7,M.timber));for(const e of [-1,1])parts.push(box(px+e*.56,level,pz,.1,.72,.6,M.timber));};
    if(variant==='bakery'){
      counter();for(let i=0;i<6;i++)parts.push({t:'blob',x:px+(i%3-1)*.35,y:level+.95,z:pz+(i<3?-.16:.16),rx:.16,ry:.1,rz:.12,col:[.77,.51,.23],role:'bread-display'});
      for(const e of [-1,1])parts.push(box(px+e*.67,level+.83,pz,.08,.28,.72,M.timber));
    }else if(variant==='florist'){
      for(let i=0;i<5;i++){const xx=px+(i%3-1)*.42,zz=pz+(i<3?.2:-.25);parts.push({t:'cyl',x:xx,y:level,z:zz,r:.16,h:.3,col:[.59,.32,.22]});for(let k=0;k<3;k++)parts.push({t:'blob',x:xx+(k-1)*.1,y:level+.45+(i%2)*.2,z:zz,rx:.12,ry:.13,rz:.12,col:[[.72,.32,.4],[.86,.69,.3],[.53,.4,.65]][i%3],role:'flower-display'});}
    }else if(variant==='armourer'){
      parts.push(box(px,level,pz,.12,1.8,.12,M.timber),box(px,level+.85,pz,.58,.62,.2,[.4,.45,.46],{role:'armor-display'}),{t:'dome',x:px,y:level+1.48,z:pz,r:.23,col:[.4,.45,.46]});
      for(const e of [-1,1])parts.push({t:'blob',x:px+e*.38,y:level+1.33,z:pz,rx:.2,ry:.14,rz:.18,col:[.4,.45,.46]});
      for(let i=0;i<3;i++){const xx=px+.5+i*.14;parts.push(box(xx,level+.22,pz+.28,.045,1.35,.06,[.5,.55,.55]),box(xx,level+1.25,pz+.28,.23,.055,.09,M.brass));}
    }else if(variant==='apothecary'){
      counter();for(const e of [-1,1])parts.push(box(px+e*.65,level,pz-.22,.1,1.65,.12,M.timber));parts.push(box(px,level+1.35,pz-.22,1.4,.09,.3,M.timber));
      for(let row=0;row<2;row++)for(let i=0;i<5;i++){const xx=px+(i-2)*.23,yy=level+(row?1.44:.84),zz=pz+(row?-.22:.12),col=[[.3,.55,.4],[.45,.3,.55],[.65,.43,.2]][i%3];parts.push({t:'cyl',x:xx,y:yy,z:zz,r:.065,h:.19,col,role:'potion-display'},{t:'cyl',x:xx,y:yy+.19,z:zz,r:.028,h:.07,col:M.brass});}
    }else if(variant==='bookseller'){
      counter();parts.push(box(px,level+1.45,pz-.2,1.45,.1,.32,M.timber));
      for(let row=0;row<2;row++)for(let i=0;i<8;i++)parts.push(box(px+(i-3.5)*.15,level+(row?1.55:.84),pz+(row?-.2:.1),.12,.24+(i%3)*.07,.24,[[.45,.25,.22],[.29,.4,.34],[.3,.34,.48],[.55,.43,.25]][i%4],{role:'book-display'}));
    }else if(variant==='generalGoods'){
      counter();for(let i=0;i<6;i++)parts.push({t:'blob',x:px+(i%3-1)*.32,y:level+.96,z:pz+(i<3?-.14:.14),rx:.14,ry:.12,rz:.14,col:i%2?[.65,.45,.2]:[.4,.52,.28],role:'goods-display'});
      parts.push({t:'blob',x:px+.62,y:level+.3,z:pz+.28,rx:.23,ry:.3,rz:.22,col:[.59,.5,.33]});
    }else{
      for(const e of [-1,1])parts.push(box(px+e*.66,level,pz,.09,1.75,.12,M.timber));parts.push(box(px,level+1.7,pz,1.5,.1,.12,M.timber));
      for(let i=0;i<3;i++){const xx=px+(i-1)*.4,col=[[.47,.25,.24],[.26,.4,.45],[.57,.45,.3]][i];parts.push(box(xx,level+.95,pz,.31,.63,.09,col,{role:'clothing-display'}),box(xx,level+1.3,pz,.45,.14,.09,col),box(xx,level+1.58,pz,.035,.16,.07,M.brass));}
    }
    return {...base,variant,features:{storeKind:variant,shell,display:{x:px,z:pz,y:level}}};
  }
  function slumBuilding(spec){
    const base=building({...spec,variant:'house',shell:spec.shell,wallFinish:spec.variant==='patchedLodging'?'plaster':'wood',decorative:false,roofRise:spec.variant==='tenement'?2:1.1,roofCol:[.34,.29,.23],stoneStoreys:spec.variant==='patchedLodging'?1:0}),{x,z,w,d,floor}=spec,parts=base.parts;
    for(const p of parts){if(['jamb','header','sill'].includes(p.role))p.col=[.4,.34,.25];if(p.pat===11)p.col=[.62,.57,.43];if(p.role==='pane')p.col=[.15,.19,.18];}
    const front=z+d/2;
    if(spec.storeys>1){
      const yy=floor+spec.storeyHeight+.3;
      parts.push({t:'beam',x0:x-w*.3,y0:yy+1.4,z0:front+.75,x1:x+w*.3,y1:yy+1.3,z1:front+.75,s:.025,col:M.timber,role:'laundry-line'});
      for(const side of [-1,1])parts.push(box(x+side*w*.3,yy+1.1,front+.45,.07,.4,.75,M.timber));
      for(let i=0;i<3;i++)parts.push(box(x+(i-1)*w*.16,yy+.45,front+.75,w*.12,.8,.035,[[.47,.39,.29],[.37,.43,.37],[.57,.49,.39]][i],{role:'laundry'}));
    }
    for(let i=0;i<3;i++)parts.push(box(x+w*.3,floor+1.3+i*.13,front+.22,.65,.08,.08,[.36,.29,.2],{role:'repair-lath'}));
    // Repairs are attached geometry, not a projected damage texture.
    for(let i=0;i<4;i++)parts.push(box(x+w*.32,floor+.55+i*.18,z+d/2+.22,.68,.11,.08,i%2?[.38,.28,.18]:[.49,.38,.24],{rot:i%2?.03:-.025,role:'repair-board'}));
    for(const side of [-1,1]){const xx=x+side*w*.23,a=z+.45,b=z+Math.min(1.45,d*.38);parts.push({t:'ramp',x0:xx,z0:a,y0:base.roofHeight(xx-x,a)+.035,x1:xx,z1:b,y1:base.roofHeight(xx-x,b)+.035,w:.3,thickness:.045,closedBottom:true,rail:false,col:[.43,.34,.25],pat:6,role:'roof-repair'});}
    const level=spec.streetHeight?spec.streetHeight(x+w*.32):floor-.16,pz=z+d/2+.6,px=x+w*.32;
    parts.push(box(px,level-.2,pz,.85,.2,.85,M.stone,{pat:4,role:'display-pad'}),box(px,level,pz,.55,.6,.5,[.38,.28,.18],{pat:6}));
    return {...base,variant:spec.variant,features:{slum:true,shell:spec.shell,repairs:true}};
  }
  function compoundBuilding(spec){
    const {x,z,w,d,floor,variant}=spec,h=spec.storeyHeight||3.2,mainDepth=d*.46,mainZ=z+d/2-mainDepth/2;
    const main=building({...spec,variant:'house',shell:'gable',d:mainDepth,z:mainZ,blankBack:true,decorative:true,roofRise:2.8});
    const parts=[...main.parts],wings=[],wingWidth=variant==='courtyardInn'?w*.24:w*.4;
    const sides=variant==='courtyardInn'?[-1,1]:[variant==='towerWorkshop'?1:-1];
    for(const side of sides){const ww=wingWidth,dd=d-mainDepth+.55,wx=x+side*(w/2-ww/2),wz=z-d/2+dd/2,levels=variant==='towerWorkshop'?3:variant==='courtyardInn'?2:1;
      const wing=building({...spec,id:spec.id+'-wing-'+side,variant:'house',shell:variant==='towerWorkshop'?'hip':'front-gable',w:ww,d:dd,x:wx,z:wz,storeys:levels,blankFront:true,decorative:false,roofRise:2.2,partyLeft:false,partyRight:false});parts.push(...wing.parts);wings.push(wing.footprint);
    }
    return {...main,id:spec.id,variant,parts,footprint:{x,z,w,d,floor},features:{massing:variant,wings},shell:variant};
  }
  function building({id,x,z=0,w=6,d=6,storeys=2,storeyHeight=3.2,floor,ground,variant='house',roofCol=M.roof,partyLeft=false,partyRight=false,streetHeight=null,shell='auto',roofRise=null,wallFinish='plaster',decorative=true,stoneStoreys=1,rearDoor=false,bridgeDoor=false,blankBack=false,blankFront=false}){if(COMPOUND_KINDS.includes(variant))return compoundBuilding({id,x,z,w,d,storeys,storeyHeight,floor,ground,variant,roofCol,partyLeft,partyRight,streetHeight});if(HOME_KINDS.includes(variant))return homeBuilding({id,x,z,w,d,storeys,storeyHeight,floor,ground,variant,roofCol,partyLeft,partyRight,streetHeight,shell,rearDoor,bridgeDoor});if(STORE_KINDS.includes(variant))return merchantBuilding({id,x,z,w,d,storeys,storeyHeight,floor,ground,variant,roofCol,partyLeft,partyRight,streetHeight,shell,rearDoor,bridgeDoor});if(SLUM_KINDS.includes(variant))return slumBuilding({id,x,z,w,d,storeys,storeyHeight,floor,ground,variant,roofCol,partyLeft,partyRight,streetHeight,shell,rearDoor,bridgeDoor});if(['smithy','warehouse','pub'].includes(variant))return artisanBuilding({id,x,z,w,d,storeys,storeyHeight,floor,ground,variant,roofCol,partyLeft,partyRight,streetHeight});checkPositive(w,d,storeys);const h=storeyHeight,jet=level=>level>0?(shell==='cottage'?0:shell==='deep-jetty'?.85:shell==='jetty'?.65:variant==='inn'?.65:variant==='house'?.55:variant==='shop'?.45:.2)*level:0,parts=[],sockets={},bayW=w/Math.round(w/3),nb=Math.round(w/3),F=foundation({w,d,floor,ground:(u,v)=>ground(x+u,z+v)});parts.push(...F.parts);
    for(let level=0;level<storeys;level++){const yy=floor+level*h,offset=jet(level)-(shell==='deep-jetty'&&level===0?.65:0),depth=d+offset,cols=wallFinish==='wood'?[.39,.29,.19]:variant==='inn'?[.88,.78,.62]:variant==='shop'?[.88,.86,.76]:[.77,.83,.81];
      for(const side of [-1,1])for(let k=0;k<nb;k++){const u=-w/2+(k+.5)*bayW,blockedByBell=variant==='chapel'&&side===-1&&u-.9<-w/2+1.9;const crossBay=side===1&&((['cross-gable','shallow-bay'].includes(shell)&&level===storeys-1&&k===0)||(['stacked-bay','twin-bay'].includes(shell)&&level>0&&(k===0||(shell==='twin-bay'&&k===nb-1))));let opening=((side===-1&&blankBack)||(side===1&&blankFront))?'blank':shell==='undercroft'&&side===1&&level===0?'bay':bridgeDoor&&side===1&&level===1&&k===0?'door':shell==='deep-jetty'&&side===1&&level===1&&k===0?'door':rearDoor&&side===-1&&level===1&&k===0?'door':blockedByBell?'blank':crossBay?'bay':side===1&&variant==='pub'&&level===0?(k===Math.floor(nb/2)?'door':'shop'):side===1&&variant==='warehouse'&&((level===0&&k===0)||(level===1&&k===1))?'cargo':side===1&&variant==='guildhall'&&k===Math.floor(nb/2)?'bay':side===1&&variant==='inn'&&level===2&&k===0?'bay':side===1&&((level===0&&k===0)||(level===1&&variant==='inn'&&k===1))?'door':side===1&&level===0&&variant==='shop'?'shop':'window';if(level===0&&side===1&&['window','shop'].includes(opening)&&streetHeight&&Math.max(streetHeight(x+u-.8),streetHeight(x+u+.8))>floor+.45)opening='blank';const bay=wallBay({w:bayW,h,opening,col:cols,timber:variant==='inn'||variant==='pub'||level>0,stoneBase:level===0,shutters:decorative&&level>0&&(k%2===0),wood:wallFinish==='wood',endPost:k===nb-1,threshold:level===0,masonry:level<stoneStoreys||variant==='chapel'||variant==='towerhouse'});parts.push(...transform(bay.parts,-w/2+(k+.5)*bayW,yy,side===1?d/2+offset:-d/2,side===1?0:Math.PI));
        if(opening==='door'&&level>0&&side===1)sockets['upperDoor'+level]={x:x-w/2+(k+.5)*bayW,y:yy,z:z+d/2+offset+.17};
        if((opening==='door'||opening==='cargo')&&level===0)sockets.door={x:x-w/2+(k+.5)*bayW,y:floor,z:z+d/2+offset+.17};}
      const endLength=depth-.34,endBays=Math.round(endLength/3);
      for(const side of [-1,1])for(let k=0;k<endBays;k++){const party=side===-1?partyLeft:partyRight,centerZ=-d/2+.17+(k+.5)*endLength/endBays,blockedByBell=variant==='chapel'&&side<0&&centerZ-.9<-d/2+2.15;const bay=wallBay({w:endLength/endBays,h,opening:party||blockedByBell?'blank':'window',col:cols,timber:!party&&(variant==='inn'||level>=stoneStoreys),wood:wallFinish==='wood',stoneBase:level===0,endPost:k===endBays-1,masonry:level<stoneStoreys||variant==='chapel'||variant==='towerhouse'});parts.push(...transform(bay.parts,side*(w/2-.17),yy,-d/2+.17+(k+.5)*endLength/endBays,side===1?-Math.PI/2:Math.PI/2));} 
      parts.push(box(0,yy+h-.15,offset/2,w+.2,.2,depth+.2,M.timber),box(0,level===0?yy-.12:yy+.03,offset/2,w-.35,.12,depth-.35,tint(M.timber,1.5),{role:level===0?'ground-floor':'upper-floor'}));
    }
    if(shell==='undercroft'){
      for(let k=0;k<nb;k++){
        const xx=-w/2+(k+.5)*bayW,front=d/2,R=1.05,spring=floor+1.8;
        for(let i=0;i<8;i++){const u=-R+(i+.5)*2*R/8,yy=spring+Math.sqrt(Math.max(0,R*R-u*u));parts.push(box(xx+u,yy,front,2*R/8+.015,floor+h-yy,.34,M.stone,{pat:4,role:'storage-arch'}));}
        const back=wallBay({w:bayW,h,opening:k===0?'door':'blank',masonry:true});parts.push(...transform(back.parts,xx,floor,front-2.2));
        if(k===0)sockets.door={x:x+xx,y:floor,z:z+front-2.03};
        else{parts.push(box(xx,floor,front-1.5,.8,.65,.7,M.timber,{pat:6,role:'stored-crate'}),{t:'cyl',x:xx+.55,y:floor,z:front-1.35,r:.27,h:.7,col:[.4,.29,.17],pat:6,role:'stored-barrel'});}
      }
    }
    if(rearDoor&&storeys>1)sockets.rearDoor={x:x-w/2+bayW/2,y:floor+h,z:z-d/2-.17};
    const frontGable=shell==='front-gable'||variant==='chapel'||variant==='house'&&w<=10&&!['gable','hip','cross-gable','cottage','shed'].includes(shell),roofOffset=jet(storeys-1)/2,roofDepth=d+jet(storeys-1),r=roof({w:frontGable?roofDepth:w,d:frontGable?w:roofDepth,y:floor+storeys*h,h:roofRise??(shell==='cottage'?1.35:(frontGable?w:roofDepth)*.6),col:roofCol,endOverhang:frontGable?.45:.06,eaveOverhang:frontGable?.06:.45,profile:shell});
    const roofRotation=frontGable?Math.PI/2:0;
    if(variant==='towerhouse'||shell==='hip'||shell==='undercroft'){const u=(w+.9)/2,q=(roofDepth+.9)/2,hipHeight=roofDepth*.45;
      r.parts=[];
      r.surface=(px,pz)=>floor+storeys*h+hipHeight*Math.max(0,Math.min(1-Math.abs(pz)/q,(u-Math.abs(px))/Math.min(u,q)));
      for(const side of [-1,1])for(let i=0;i<12;i++){const a=-w/2+w*i/12,b=-w/2+w*(i+1)/12,za=-roofDepth/2+roofDepth*i/12,zb=-roofDepth/2+roofDepth*(i+1)/12,base=floor+storeys*h-.06;
        r.parts.push({t:'ramp',x0:a,z0:side*roofDepth/2,y0:r.surface(a,side*roofDepth/2)-.04,x1:b,z1:side*roofDepth/2,y1:r.surface(b,side*roofDepth/2)-.04,w:.12,base,rail:false,col:M.plaster,pat:11,noJitter:true,role:'roof-collar'});
        r.parts.push({t:'ramp',x0:side*w/2,z0:za,y0:r.surface(side*w/2,za)-.04,x1:side*w/2,z1:zb,y1:r.surface(side*w/2,zb)-.04,w:.12,base,rail:false,col:M.plaster,pat:11,noJitter:true,role:'roof-collar'});
      }
      r.parts.push({t:'hip',x:0,y:floor+storeys*h,z:0,w:w+.9,d:roofDepth+.9,h:hipHeight,col:roofCol,pat:2,roofThickness:.16});}
    if(variant==='towerhouse'){const surface=r.surface;r.surface=(px,pz)=>surface(px,pz)+1.9;r.parts=transform(r.parts,0,1.9,0);for(const socket of Object.values(r.sockets))socket.y+=1.9;}
    if(shell==='shed'){const base=floor+storeys*h,q=roofDepth/2,top=base+1.1;r.surface=(px,pz)=>base+.14+1.1*(q-pz)/(2*q);
      r.parts=[{t:'ramp',x0:0,z0:-q,y0:top,x1:0,z1:q,y1:base,w,base:base-.05,rail:false,col:[.39,.29,.19],pat:6},{t:'ramp',x0:0,z0:-q-.1,y0:r.surface(0,-q-.1),x1:0,z1:q+.35,y1:r.surface(0,q+.35),w:w+.12,thickness:.16,closedBottom:true,rail:false,col:[.32,.29,.24],pat:6}];}
    parts.push(...transform(r.parts,0,0,roofOffset,roofRotation));
    const roofHeight=(px,pz)=>frontGable?r.surface(pz-roofOffset,-px):r.surface(px,pz-roofOffset);
    // The shaft starts below the lowest roof contact corner, even for rotated ridges.
    const cx=w*.28,cz=-d*.15+roofOffset,cw=variant==='smithy'?1.05:.65,cd=variant==='smithy'?1.05:.7,contact=[-1,1].flatMap(a=>[-1,1].map(b=>roofHeight(cx+a*cw/2,cz+b*cd/2))),bottom=Math.min(...contact)-.35,top=Math.max(...contact)+1.45;
    const chimney={x:x+cx,z:z+cz,w:cw,d:cd,bottom,top,contact};
    if(!['chapel','guildhall','towerhouse'].includes(variant))parts.push(box(cx,bottom,cz,cw,top-bottom,cd,M.stone,{pat:4,role:'chimney'}),box(cx,top,cz,.85,.18,.9,M.trim));
    const localX=frontGable?cz-roofOffset:cx,localZ=frontGable?-cx:cz-roofOffset,flash={t:'ramp',x0:localX,z0:localZ-.55,y0:r.surface(localX,localZ-.55)+.035,x1:localX,z1:localZ+.55,y1:r.surface(localX,localZ+.55)+.035,w:1.05,base:bottom,rail:false,col:[.28,.3,.27],role:'flashing'};
    if(!['chapel','guildhall','towerhouse'].includes(variant))parts.push(...transform([flash],0,0,roofOffset,roofRotation));
    if(variant==='inn'){const yy=floor+h,z=d/2+jet(1)+.75,bx=-w/2+1.5*bayW;
      parts.push(box(bx,yy-.2,z,3.3,.2,1.7,M.timber,{role:'balcony-deck'}));
      for(const e of [-1,1]){parts.push(box(bx+e*1.55,yy,z+.7,.12,1,.12,M.timber));parts.push({t:'beam',x0:bx+e*1.25,y0:yy-.85,z0:d/2+jet(1)+.1,x1:bx+e*1.25,y1:yy-.18,z1:z+.6,s:.14,col:M.timber});}
      for(const e of [-1,1]){parts.push(box(bx+e*1.55,yy+.95,z,.12,.12,1.5,M.timber));for(let k=0;k<4;k++)parts.push(box(bx+e*1.55,yy,z-.6+k*.35,.08,.95,.08,M.timber));}
      parts.push(box(bx,yy+.95,z+.7,3.3,.12,.14,M.timber));for(let i=-4;i<=4;i++)parts.push(box(bx+i*.35,yy,z+.7,.07,.95,.07,M.timber));
    }
    if(variant==='shop'||variant==='pub'){const xx=(streetHeight&&streetHeight(x-w/2)<streetHeight(x+w/2)?-1:1)*(w/2-.1),face=d/2,nearDoor=Math.abs(xx-(sockets.door.x-x))<1.5,zz=face+(nearDoor?2.55:1.1),reach=zz-face+.5;
      parts.push(box(xx,floor+3.05,face+reach/2,.14,.14,reach,M.timber,{role:'sign-bracket'}));
      parts.push({t:'beam',x0:xx,y0:floor+2.55,z0:face+.1,x1:xx,y1:floor+3.05,z1:face+reach*.7,s:.09,col:M.timber});
      for(const e of [-1,1])parts.push(box(xx,floor+2.75,zz+e*.3,.15,.42,.055,[.18,.2,.19],{role:'sign-hanger'}));
      // Double-sided blade sign, perpendicular to the facade for both street approaches.
      parts.push(box(xx,floor+2.1,zz,.12,.7,.95,M.timber,{role:'sign-board'}));
      for(const side of [-1,1])parts.push(box(xx+side*.075,floor+2.17,zz,.045,.52,.75,[.28,.42,.32]));
    }
    if(decorative&&storeys>1&&!['warehouse','towerhouse'].includes(variant))for(let k=0;k<nb;k++){if((variant==='inn'&&k===1)||(shell==='deep-jetty'&&k===0)||(['stacked-bay','twin-bay'].includes(shell)&&(k===0||shell==='twin-bay'&&k===nb-1)))continue;const xx=-w/2+(k+.5)*bayW,z=d/2+jet(1)+.42,y=floor+h+.65;
      parts.push(box(xx,y,z,1.35,.28,.45,M.timber));for(let i=-1;i<=1;i++)parts.push({t:'blob',x:xx+i*.35,y:y+.37,z,rx:.2,ry:.2,rz:.18,col:i===0?[.74,.54,.38]:M.leaf,nocol:true});
    }
    if(['stacked-bay','twin-bay'].includes(shell))for(const k of (shell==='twin-bay'?[0,nb-1]:[0]))parts.push(...oriel({x:-w/2+(k+.5)*bayW,y:floor+h+.12,z:d/2+jet(1),depth:1.4,levels:storeys-1,col:[.86,.8,.68],roofCol}).parts);
    if(variant==='inn')parts.push(...oriel({x:-w/3,y:floor+2*h+.12,z:d/2+jet(2),col:[.88,.78,.62],roofCol}).parts);
    if(['cross-gable','shallow-bay'].includes(shell))parts.push(...oriel({depth:shell==='shallow-bay'?.65:1.05,canopyStyle:shell==='shallow-bay'?'hip':'gable',x:-w/2+bayW/2,y:floor+(storeys-1)*h+.12,z:d/2+jet(storeys-1),col:[.88,.86,.76],roofCol}).parts);
    if(decorative&&!['stacked-bay','twin-bay','cross-gable','shallow-bay','hip','shed'].includes(shell)&&['inn','shop','pub'].includes(variant))parts.push(...transform(dormer({...r.sockets.dormer,col:roofCol}).parts,0,0,roofOffset));
    // Corbels carry every jettied storey, making the projection a visible structural choice.
    for(let level=1;level<storeys;level++)for(let k=0;k<=nb;k++){const u=-w/2+.25+k*(w-.5)/nb,yy=floor+level*h,v=d/2+jet(level);
      parts.push({t:'beam',x0:u,y0:yy-.62,z0:v-(jet(level)-jet(level-1))-.12,x1:u,y1:yy-.08,z1:v+.16,s:.16,col:M.timber});}

    if((variant==='shop'||variant==='pub')&&shell!=='cross-gable'){const aw=variant==='pub'?2.8:2.35,doorX=sockets.door.x-x;parts.push({t:'ramp',x0:doorX,z0:d/2+.2,y0:floor+2.85,x1:doorX,z1:d/2+1.8,y1:floor+2.35,w:aw,base:floor+2.29,rail:false,col:[.38,.48,.36],pat:10});}
    const front=d/2;



    if(variant==='chapel'){
      const tx=-w/2+.85,tz=-d/2+1.1,top=floor+h+w*.6+2;
      parts.push(box(tx,floor,tz,2.1,top-floor-1.7,2.1,M.stone,{pat:4,role:'bell-shaft'}));
      for(const a of [-1,1])for(const b of [-1,1])parts.push(box(tx+a*.92,top-1.7,tz+b*.92,.22,1.7,.22,M.trim));
      parts.push({t:'cyl',x:tx,y:top-1.1,z:tz,r:.38,h:.5,r2:.5,col:M.brass},{t:'hip',x:tx,y:top,z:tz,w:2.7,d:2.7,h:1.7,col:roofCol,pat:2});
      parts.push({t:'vdisk',x:0,y:floor+h+1,z:front+.16,r:.7,rot:Math.PI/2,col:M.trim,col2:[.27,.47,.49],nocol:true});
      for(const e of [-1,1])if(!(e<0?partyLeft:partyRight))parts.push(box(e*(w/2+.12),floor,front-.4,.5,h+.4,.9,M.stone,{pat:4}));
    }
    if(variant==='guildhall'){
      const z0=front+1.25,top=floor+storeys*h+3.8;
      for(const e of [-1,1])parts.push(box(e*1.15,floor,z0-.65,.3,top-floor,1.6,M.stone,{pat:4}));
      for(let level=0;level<storeys;level++){const bay=wallBay({w:2.6,h,opening:level===0?'door':'window',col:M.plaster,masonry:level===0});parts.push(...transform(bay.parts,0,floor+level*h,z0+.15));}
      parts.push(box(0,floor+storeys*h,z0-.5,2.6,3.8,1.6,M.stone,{pat:4}),{t:'hip',x:0,y:top,z:z0-.5,w:3.2,d:2.5,h:1.6,col:roofCol,pat:2});
      parts.push({t:'vdisk',x:0,y:top-1.8,z:z0+.34,r:.85,rot:Math.PI/2,col:M.trim,col2:[.3,.35,.33],nocol:true});
      sockets.door={x,y:floor,z:z+z0+.32};
    }
    if(variant==='towerhouse'){
      const yy=floor+storeys*h-.15;for(const a of [-1,1])for(const b of [-1,1])parts.push(box(a*(w/2+.25),yy+.18,b*(roofDepth/2+.25)+jet(storeys-1)/2,.18,1.9,.18,M.timber));parts.push(box(0,yy,jet(storeys-1)/2,w+.8,.18,roofDepth+.8,M.timber));
      for(const e of [-1,1]){parts.push(box(0,yy+.9,e*(roofDepth/2+.3)+jet(storeys-1)/2,w+.8,.12,.12,M.timber),box(e*(w/2+.3),yy+.9,jet(storeys-1)/2,.12,.12,roofDepth+.8,M.timber));
        for(let k=-2;k<=2;k++)parts.push(box(k*w/5,yy,e*(roofDepth/2+.3)+jet(storeys-1)/2,.1,.9,.1,M.timber));}
    }
    return {id,variant,shell,storeyHeight:h,parts:transform(parts,x,0,z),sockets,roof:r,roofHeight:(px,pz)=>roofHeight(px,pz-z),chimney,footprint:{x,z,w,d,floor}};}
  function greenery(b,{vines=true,moss=true,hanging=true,density=1}={}){
    const f=b.footprint,parts=[],front=f.z+f.d/2,top=f.floor+b.storeyHeight*(TYPES[b.variant]?.storeys||2);
    if(vines)for(const sign of [-1,1]){const xx=f.x+sign*(f.w/2-.32),height=(top-f.floor)*(.6+(.1*(sign+1)));
      for(let i=0;i<Math.ceil(height*3*density);i++){const yy=f.floor+.2+i/(3*density),x=xx+Math.sin(i*1.7)*.13;parts.push({t:'blob',x,y:yy,z:front+.27,rx:.2+(i%3)*.04,ry:.2,rz:.1,col:i%2?[.28,.4,.2]:[.22,.34,.18],role:'climbing-vine',nocol:true});}
    }
    if(hanging)for(let i=0;i<8*density;i++){const xx=f.x+f.w*.22+(i%4)*.14,yy=f.floor+b.storeyHeight-.15-Math.floor(i/4)*.23;parts.push({t:'blob',x:xx,y:yy,z:front+.45,rx:.18,ry:.22,rz:.15,col:M.leaf,role:'hanging-greenery',nocol:true});}
    if(moss&&b.roofHeight)for(let i=0;i<10*density;i++){const xx=f.x+Math.sin(i*2.31)*f.w*.34,zz=f.z+.3+(i%4)*.37,z1=zz+.22+(i%3)*.1,y0=b.roofHeight(xx-f.x,zz)+.035,y1=b.roofHeight(xx-f.x,z1)+.035;parts.push({t:'ramp',x0:xx,z0:zz,y0,x1:xx,z1,y1,w:.26+(i%3)*.08,thickness:.018,closedBottom:true,rail:false,col:i%2?[.3,.39,.18]:[.23,.33,.15],pat:0,role:'roof-moss',nocol:true});}
    return {parts};
  }
  function bridge({a,b,y=7.2,y1=y,w=1.8,covered=true}){
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);checkPositive(length,w);
    const at=t=>y+(y1-y)*t,parts=[{t:'ramp',x0:0,z0:-length/2,y0:y,x1:0,z1:length/2,y1,w,thickness:.24,closedBottom:true,rail:false,col:M.timber,pat:6,role:'bridge-deck'}];
    for(const side of [-1,1]){parts.push({t:'beam',x0:side*w/2,y0:y+.95,z0:-length/2,x1:side*w/2,y1:y1+.95,z1:length/2,s:.12,col:M.timber});for(let i=0;i<=Math.ceil(length/1.5);i++)parts.push(box(side*w/2,at(i/Math.ceil(length/1.5)),-length/2+i*length/Math.ceil(length/1.5),.1,1,.1,M.timber));}
    if(covered&&Math.abs(y-y1)<.01){for(const side of [-1,1])for(const end of [-1,1])parts.push(box(side*w/2,y,end*length/2,.14,2.5,.14,M.timber));parts.push(...transform(roof({w:length+.3,d:w,y:y+2.5,h:.8,col:M.roof}).parts,0,0,0,Math.PI/2));}
    return {parts:transform(parts,(a.x+b.x)/2,0,(a.z+b.z)/2,Math.atan2(-dx,dz)),sockets:{a:{...a,y},b:{...b,y:y1}},clearance:y-.24-3.84};
  }
  function street({grade=.055,preset='street'}={}){if(!Number.isFinite(grade)||Math.abs(grade)>.2)throw Error('Street grade must be between -0.2 and 0.2');const raw=(x,z)=>4+grade*x+.018*(z-10),specs=(PRESETS[preset]||PRESETS.street).map(([variant,x])=>({id:variant+'-'+x,variant,x,...TYPES[variant],roofCol:variant==='chapel'||variant==='towerhouse'?[.27,.36,.47]:variant==='smithy'||variant==='inn'||variant==='pub'?[.38,.27,.26]:[.28,.43,.4]}));
    const gap=.32,total=specs.reduce((n,b)=>n+b.w,0)+gap*(specs.length-1);let cursor=-total/2;
    specs.forEach((b,i)=>{b.x=cursor+b.w/2;cursor+=b.w+gap;b.partyLeft=i>0;b.partyRight=i<specs.length-1;});
    if(preset==='street')specs.forEach((b,i)=>b.id=['apothecary','wayfarer-inn','townhouse'][i]);
    const terraced=Math.abs(grade)>.1,front=terraced?4.8:6,streetZ=8;
    // Building pads form a compact street frontage. Steep streets use stepped datums.
    for(const b of specs){b.z=front-b.d/2-(b.variant==='guildhall'?1.57:0);b.doorX=b.variant==='guildhall'||b.variant==='warehouse'?b.x:b.variant==='pub'?b.x-b.w/2+(Math.floor(Math.round(b.w/3)/2)+.5)*b.w/Math.round(b.w/3):b.x-b.w/2+b.w/Math.round(b.w/3)/2;
      const datum=raw(terraced?b.x:b.doorX,12)+.28;b.floor=terraced?Math.round(datum/.16)*.16:datum;}
    const nodes=[{x:-22,y:raw(-22,12)+.12}];
    for(const b of specs){const y=b.floor-(b.variant==='warehouse'?.08:.16),half=b.variant==='warehouse'?1.65:1.25;nodes.push({x:b.doorX-half,y},{x:b.doorX+half,y});}
    nodes.push({x:22,y:raw(22,12)+.12});nodes.sort((a,b)=>a.x-b.x);
    const roadHeight=x=>{for(let i=1;i<nodes.length;i++)if(x<=nodes[i].x){const a=nodes[i-1],b=nodes[i],t=Math.max(0,Math.min(1,(x-a.x)/(b.x-a.x)));return a.y+(b.y-a.y)*t;}return nodes[nodes.length-1].y;};
    const ground=(x,z)=>{for(const b of specs)if(Math.abs(x-b.x)<=b.w/2&&z>=b.z-b.d/2&&z<=front+(terraced?.9:0))return b.floor-.12;
      let y=raw(x,z);for(const b of specs){const dx=Math.max(0,Math.abs(x-b.x)-b.w/2),dz=Math.max(0,b.z-b.d/2-z,z-front-(terraced?.9:0)),dist=Math.hypot(dx,dz),t=Math.max(0,1-dist/1.4);y+=(b.floor-.12-y)*t*t*(3-2*t);}
      const off=Math.max(0,Math.abs(z-12)-4),blend=Math.max(0,1-off/1.5);return y+(roadHeight(x)-.12-y)*blend*blend*(3-2*blend);};
    const buildings=specs.map(b=>building({...b,ground,streetHeight:roadHeight})),parts=buildings.flatMap(b=>b.parts),connections=[],pavingSources=[];
    if(preset==='green')for(const b of buildings)parts.push(...greenery(b).parts);
    const n=64,C=.75,x0=-24,z0=-16,heights=new Float32Array((n+1)*(n+1));for(let j=0;j<=n;j++)for(let i=0;i<=n;i++)heights[j*(n+1)+i]=ground(x0+i*C,z0+j*C);
    parts.unshift({t:'field',x0,z0,n,C,h:heights,skip:new Uint8Array(n*n),mat:'grass'});
    const road={parts:[],steps:0,nodes};for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],section=path({x0:a.x,z0:12,x1:b.x,z1:12,y0:a.y,y1:b.y,w:8,ground});road.parts.push(...section.parts);road.steps+=section.steps;}pavingSources.push(...road.parts.map(p=>PavementPlan.source(p,0)));
    const footway={parts:[]};for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],section=path({x0:a.x,z0:(front+streetZ)/2,x1:b.x,z1:(front+streetZ)/2,y0:a.y,y1:b.y,w:streetZ-front,ground});footway.parts.push(...section.parts);}pavingSources.push(...footway.parts.map(p=>PavementPlan.source(p,0)));
    for(const b of buildings){const e=entrance({x:b.sockets.door.x,z:b.sockets.door.z,floor:b.footprint.floor,ground,streetZ,streetY:roadHeight(b.sockets.door.x),...(b.variant==='warehouse'?{w:2.9,doorDepth:.45,streetDepth:.45}:{})});pavingSources.push(...e.parts.map(p=>PavementPlan.source(p,30)));connections.push({building:b.id,...e});
      if(terraced){const f=b.footprint,face=f.z+f.d/2;pavingSources.push(PavementPlan.source(box(f.x,f.floor-.38,face+.45,f.w,.3,.9,M.stone,{pat:4,role:'terrace'}),10));
        for(const [a,c] of [[f.x-f.w/2,e.sockets.door.x-e.landings.door.w/2-.08],[e.sockets.door.x+e.landings.door.w/2+.08,f.x+f.w/2]])if(c-a>.1)parts.push(...retainingWall({x0:a,z0:face+.9,x1:c,z1:face+.9,top0:f.floor-.04,top1:f.floor-.04,ground:raw}).parts);
      }
    }
    // Work-yard floors own their full covered footprint, including the entrance
    // corridor within it. Never draw the old platform over the unified paving.
    for(let i=parts.length-1;i>=0;i--){const role=parts[i].role,priority={'work-yard':50,'ground-floor-frame':60,'ground-floor':70,'door-threshold':100,'display-pad':20}[role];
      if(priority!=null)pavingSources.push(PavementPlan.source(parts.splice(i,1)[0],priority));}
    const pavement=PavementPlan.build(pavingSources,ground);parts.push(...pavement.parts);
    for(let j=0;j<=n;j++)for(let i=0;i<=n;i++)heights[j*(n+1)+i]=pavement.terrain(x0+i*C,z0+j*C);
    const placements=[];for(const [x,z,scale] of [[-17,-2,3.5],[17,1,3.4],[-17,20,3.8]])placements.push({asset:'tree_oak',x,y:ground(x,z),z,scale});
    for(let i=0;i<26;i++){const x=-18+i*1.4,z=i%2?18:-6.5;placements.push({asset:i%5===0?'rock_smallA':'plant_bushDetailed',x,y:ground(x,z),z,scale:i%5===0?1.2:1.7});}
    for(let i=0;i<22;i++){const x=-18+i*1.65,z=17+Math.sin(i*3)*.4;placements.push({asset:'flower_purpleA',x,y:ground(x,z),z,scale:1.1});}
    return {parts,buildings,connections,placements,ground,grade,preset,road,roadHeight,pavement,footway,rowGap:gap,terraced,frontageSetback:streetZ-front,spawn:{x:-16,z:12,y:roadHeight(-16)+.2,yaw:0}};}
  return {M,TYPES,PRESETS,HOME_KINDS,COMPOUND_KINDS,STORE_KINDS,SLUM_KINDS,CATALOG,transform,foundation,wallBay,roof,dormer,oriel,retainingWall,path,entrance,building,greenery,bridge,street};
});
