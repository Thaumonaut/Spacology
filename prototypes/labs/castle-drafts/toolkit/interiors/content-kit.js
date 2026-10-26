// Enterable content families. Compound wings and unique landmarks are separate plans.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../town-kit.js'));else root.TownInteriorContent=factory(root.TownKit);})(this,function(K){
'use strict';
const profiles={
 house:{label:'Townhouse',family:'home',w:8,d:8,storeys:2,shell:'gable'},shop:{label:'Neighborhood shop',family:'goods',w:8,d:9,storeys:2,shell:'gable'},
 bakery:{label:'Bakery',family:'bakery',w:8,d:9,storeys:2,shell:'front-gable'},florist:{label:'Florist',family:'florist',w:7,d:9,storeys:1,shell:'cottage'},armourer:{label:'Armourer',family:'armourer',w:8,d:9,storeys:2,shell:'front-gable'},apothecary:{label:'Apothecary',family:'apothecary',w:8,d:8,storeys:2,shell:'hip'},bookseller:{label:'Bookseller',family:'bookseller',w:8,d:9,storeys:2,shell:'gable'},generalGoods:{label:'General goods',family:'goods',w:8,d:9,storeys:1,shell:'cottage'},clothing:{label:'Clothier',family:'clothing',w:8,d:9,storeys:2,shell:'jetty'},
 pub:{label:'Neighborhood pub',family:'pub',w:12,d:10,storeys:2,shell:'gable'},inn:{label:'Wayfarer inn',family:'inn',w:14,d:10,storeys:3,shell:'gable'},smithy:{label:'Covered-yard smithy',family:'smithy',w:9,d:11,storeys:2,shell:'gable'},warehouse:{label:'Warehouse',family:'warehouse',w:10,d:10,storeys:3,shell:'front-gable'},
 stoneCottage:{label:'Stone cottage',family:'home',w:6,d:7,storeys:1,shell:'cottage'},weaversHouse:{label:'Weaver residence',family:'weaver',w:7,d:9,storeys:2,shell:'jetty'},merchantHouse:{label:'Merchant residence',family:'home',w:9,d:10,storeys:3,shell:'hip'},gableHouse:{label:'Narrow gabled home',family:'home',w:6,d:9,storeys:3,shell:'front-gable'},gambrelHouse:{label:'Broken-pitch home',family:'home',w:8,d:9,storeys:2,shell:'gambrel'},sweptHouse:{label:'Swept-gable home',family:'home',w:7,d:9,storeys:3,shell:'swept'},
 shack:{label:'Patched shack',family:'slum',w:4.5,d:6,storeys:1,shell:'cottage'},leanTo:{label:'Lean-to dwelling',family:'slum',w:4,d:6,storeys:1,shell:'shed'},tenement:{label:'Tenement',family:'slum',w:6,d:9,storeys:3,shell:'jetty'},stackedDwelling:{label:'Stacked dwelling',family:'slum',w:6,d:9,storeys:4,shell:'shed'},patchedLodging:{label:'Patched lodging',family:'slum',w:7,d:9,storeys:2,shell:'gable'}
};
Object.assign(profiles,{orielHouse:{label:'Oriel house',family:'home',w:8,d:9,storeys:2,shell:'cross-gable'},bayHouse:{label:'Bay house',family:'home',w:8,d:9,storeys:2,shell:'shallow-bay'},steppedHouse:{label:'Stepped-front home',family:'home',w:8,d:9,storeys:3,shell:'stacked-bay'},doubleBayHouse:{label:'Twin-bay home',family:'home',w:9,d:9,storeys:3,shell:'twin-bay'},galleryHouse:{label:'Gallery house',family:'home',w:8,d:9,storeys:2,shell:'deep-jetty'},manor:{label:'Merchant manor',family:'home',w:16,d:11,storeys:3,shell:'gambrel'},undercroftHouse:{label:'Undercroft lodging',family:'home',w:9,d:12,storeys:3,shell:'undercroft'},chapel:{label:'Neighborhood chapel',family:'chapel',w:9,d:12,storeys:1,storeyHeight:5.4,shell:'front-gable'},towerhouse:{label:'Tower house',family:'home',w:6,d:9,storeys:5,shell:'hip'}});
Object.assign(profiles,{cornerHouse:{label:'L-shaped residence',family:'compound',w:20,d:21,storeys:2},courtyardInn:{label:'Courtyard inn',family:'compound',w:24,d:24,storeys:3},towerWorkshop:{label:'Tower workshop',family:'compound',w:20,d:24,storeys:2}});
const M=K.M,box=(x,y,z,w,h,d,col,role)=>({t:'box',x,y,z,w,h,d,col,role,interiorFurniture:true}),wood=(...args)=>box(...args,M.timber,'content-joinery');
function furnish(s,{front,back,floors}){
 const family=profiles[s.variant].family,parts=[],destinations=[],left=-s.w/2+1.05,sz=back+1.2;
 const add=(...p)=>parts.push(...p.map(q=>({...q,interiorFurniture:true}))),target=(name,x,z,kind,level=0)=>destinations.push({name,x,y:floors[level],z,kind,level});
 function table(x,z,y=0){add(wood(x,y+.72,z,1.35,.1,.85));for(const a of [-1,1])add(wood(x+a*.48,y,z,.12,.72,.6));}
 function shelf(x,z,y=0){for(const a of [-1,1])add(wood(x+a*.6,y,z,.1,1.9,.4));for(let i=0;i<4;i++)add(wood(x,y+.18+i*.48,z,1.3,.08,.4));}
 function barrel(x,z,y=0){add({t:'cyl',x,y,z,r:.3,h:.8,col:[.45,.32,.21],pat:6,role:'stored-barrel'});for(const h of [.13,.65])add({t:'cyl',x,y:y+h,z,r:.31,h:.06,col:[.25,.25,.23],role:'barrel-hoop'});}
 function bed(x,z,y){add(box(x,y,z,1.25,.35,1.9,M.timber,'bed-frame'),box(x,y+.35,z,1.18,.16,1.8,[.37,.44,.39],'bed-linen'),box(x,y+.51,z-.55,1.05,.13,.42,[.82,.78,.65],'pillow'));}
 if(['home','weaver','slum'].includes(family)){
  table(left,front-(s.floorplan==='front_room'?4:3));add(wood(left,0,front-(s.floorplan==='front_room'?4.8:3.8),1.1,.4,.3));target('Resident',left+1,front-2.1,'visit');
  if(family==='weaver'){add(wood(left,0,sz,1.5,.15,1.2));for(const a of [-1,1])add(wood(left+a*.65,0,sz,.1,1.6,.1));for(let i=0;i<12;i++)add(box(left-.55+i*.1,.4,sz,.025,.9,.035,[.65,.56,.4],'loom-thread'));target('Loom',left+.9,sz,'commission');}
  if(!floors[1])bed(left,back+1.4,0);
 }else if(family==='pub'||family==='inn'){
  const tz=front-(s.floorplan==='front_room'?4:3);table(left,tz);table(left+2.1,tz);for(const x of [left,left+2.1])for(const dz of [-.75,.75])add(wood(x,0,tz+dz,1.15,.42,.3));
  const barShift=s.floorplan==='rear'?.5:0;add(box(-1,0,back+3.4+barShift,3.2,1,.65,M.timber,'bar-counter'));for(const x of [-2,-1,0])barrel(x,back+1.1);target(family==='inn'?'Reception':'Publican',-.3,back+4.3+barShift,'service');
 }else if(family==='warehouse'){
  for(let level=0;level<floors.length;level++)for(let i=0;i<3;i++){const x=-s.w/2+1.1+i*1.1;add({...box(x,floors[level],back+.7,1.05,1.15,1.1,[.47,.34,.23],'freight-crate'),pat:6});barrel(x,back+2.7,floors[level]);}target('Receiving desk',0,front-2,'delivery');
 }else if(family==='smithy'){
  add(box(left,0,back+1.2,1.7,.9,.7,M.timber,'workbench'));for(let i=0;i<4;i++)add(box(left+(i-1.5)*.3,.92,back+1.2,.16,.05,.3,[.42,.44,.44],'metal-stock'));target('Smith',left+1.2,front-2,'commission');
 }else if(family==='chapel'){for(let i=0;i<4;i++)for(const side of [-1,1])add(box(side*2,0,front-3-i*1.6,2.2,.45,.45,M.timber,'pew'));add(box(0,.1,back+1.2,2,.8,.8,M.stone,'altar'));target('Caretaker',0,back+2.4,'visit');
 }else{
  const counterZ=s.floorplan==='front_room'?-.45:.25;add(box(-.1,0,counterZ,1.8,1,.65,M.timber,'shop-counter'));target('Shopkeeper',-.1,counterZ+1,'service');
  const z=back+(s.storeys>1?1.8:2.6),sx=-s.w/2+1.35;shelf(sx,z);
  for(let row=0;row<3;row++)for(let i=0;i<4;i++){const stockStart=parts.length,x=sx+(i-1.5)*.27,y=.26+row*.48,col=[[.34,.49,.38],[.5,.32,.4],[.65,.47,.23],[.38,.39,.52]][i];
   if(family==='apothecary')add({t:'cyl',x,y,z,r:.065,h:.24,col,role:'potion-stock'},{t:'cyl',x,y:y+.24,z,r:.025,h:.06,col:M.brass,role:'bottle-stopper'});
   else if(family==='bakery')add({t:'blob',x,y:y+.09,z,rx:.12,ry:.08,rz:.14,col:[.78,.54,.28],role:'bread-stock'});
   else if(family==='florist')add({t:'cyl',x,y,z,r:.1,h:.17,col:[.52,.33,.24],role:'flower-pot'},{t:'blob',x,y:y+.29,z,rx:.14,ry:.12,rz:.13,col,role:'flowers'});
   else add(box(x,y,z,.2,family==='clothing'?.1:.28,.27,col,family==='bookseller'?'book-stock':family==='clothing'?'folded-cloth':'shop-stock'));
   if(row===0)for(const p of parts.slice(stockStart))add({...p,x:p.x-sx-.1,y:p.y+.74,z:counterZ,role:'counter-display'});
  }
  if(family==='bookseller'){const publicZ=front-(s.floorplan==='front_room'?3.6:2.8);shelf(sx,publicZ);for(let row=0;row<3;row++)for(let i=0;i<4;i++)add(box(sx+(i-1.5)*.27,.26+row*.48,publicZ,.2,.3,.27,[[.45,.28,.22],[.29,.4,.34],[.4,.35,.49],[.6,.48,.28]][i],'public-books'));}
  if(family==='armourer'){add(box(left,0,front-3,.12,1.6,.12,M.timber,'armour-stand'),box(left,.8,front-3,.65,.6,.25,[.4,.44,.45],'breastplate'),{t:'dome',x:left,y:1.55,z:front-3,r:.23,col:[.4,.44,.45],role:'helmet'});}
  if(family==='bakery')add(box(left,0,front-(s.floorplan==='front_room'?3.6:3),1.3,1.2,1.1,M.stone,'bread-oven'),box(left,.3,front-(s.floorplan==='front_room'?3.03:2.43),.7,.6,.035,[.12,.085,.06],'oven-mouth'));
  if(family==='clothing')for(const side of [-1,1])add(box(left+side*.38,0,front-3,.1,1.7,.1,M.timber,'clothes-rack'));if(family==='clothing')add(box(left,1.55,front-3,.9,.08,.1,M.timber,'clothes-rack'),box(left,.65,front-3,.65,.8,.12,[.5,.32,.4],'hanging-garment'));
 }
 for(let level=1;level<floors.length;level++)if(family!=='warehouse'){
  if(family==='inn'){for(let i=0;i<2;i++)bed(-s.w/2+1.4+i*2.4,back+1.5,floors[level]);}
  else bed(-s.w/2+1.3,back+1.5,floors[level]);if(s.upperPlan==='small_rooms')bed(-s.w/2+1.3,front-1.6,floors[level]);
 }
 return {parts,destinations};
}
return {profiles,furnish};
});
