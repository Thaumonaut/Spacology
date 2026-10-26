'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),I=require('../../prototypes/labs/castle-drafts/toolkit/interiors/interior-kit.js'),C=require('../../prototypes/labs/castle-drafts/castle-gen.js');
const context={window:{}};for(const f of ['castle-render.js','castle-walk.js'])vm.runInNewContext(fs.readFileSync(require.resolve('../../prototypes/labs/castle-drafts/'+f),'utf8'),context);
const {CastleRender:R,CastleWalk:W}=context.window;
for(const variant of ['house','apothecary'])for(const rot of [0,Math.PI,Math.PI/2,-Math.PI/2]){
 const b=I.create({id:variant,variant,rot,w:8,d:8}),mesh=R.meshParts(b.parts,C.PALETTES[0]),col=new W.Collider(mesh);assert(mesh.p.every(Number.isFinite));assert.equal(b.rooms.length,4);assert.equal(b.doors.length,3);for(const p of b.parts.filter(p=>p.interiorPartition&&p.t==='box'&&p.y<b.spec.floor+3.2))assert(p.y+p.h<b.spec.floor+3.15,'partition tops stay below the upstairs floor surface');
 if(rot===0)for(const p of b.parts.filter(p=>p.interiorPartition&&p.t==='box')){const c=Math.abs(Math.cos(p.rot||0)),n=Math.abs(Math.sin(p.rot||0));assert(Math.abs(p.x)+(c*p.w+n*p.d)/2<b.spec.w/2-.05,'interior partitions stay inside the exterior side faces');}
 const panes=b.parts.filter(p=>p.role==='pane'&&p.pat!==6&&p.y>.3);assert(panes.length>0);assert.equal(b.parts.filter(p=>p.role==='interior-window-mullion').length,panes.length,'every window has an interior mullion');assert.equal(b.parts.filter(p=>p.role==='interior-window-jamb').length,panes.length*2,'every window has two interior jambs');assert(b.stair.finishedFloor>3.2+.05,'finished floor covers the lower wall tops');assert(b.stair.riser<=.16);assert.equal(b.doors[0].h,2.4,'leaf fills the door head');
 const d=b.doors[0],closed=new W.Collider(R.meshParts(I.doorParts(d,false),C.PALETTES[0])),open=new W.Collider(R.meshParts(I.doorParts(d,true),C.PALETTES[0])),direction=[Math.sin(rot),0,-Math.cos(rot)];
 const origin=[d.x-direction[0],d.y+1.3,d.z-direction[2]];assert(closed.ray(origin,direction,2)<2,'closed entrance blocks passage');assert.equal(open.ray(origin,direction,2),2,'open entrance clears passage');assert.equal(col.ray(origin,direction,2),2,'no old pane or wall remains in the entrance');
 const a=b.stair.start,e=b.stair.end;let last=b.spec.floor;
 for(let i=0;i<=150;i++){const t=i/150,x=a.x+(e.x-a.x)*t,z=a.z+(e.z-a.z)*t,y=col.floor(x,last+.25,z,0);assert(Number.isFinite(y),'stair has support');assert(y-last<.17,'stairs do not jump through the upper floor');assert(col.ray([x,y+.15,z],[0,1,0],1.9)>=1.9,'stair has headroom');last=y;}
 assert(Math.abs(last-e.y)<.02,'stairs reach the upper landing');
 const walker=new W.Walker(col,{...a,y:a.y+.01,yaw:rot-Math.PI/2});walker.keys.w=true;for(let t=0;t<105;t++)walker.update(1/60);assert(walker.y>b.spec.floor+3,'actual walking reaches upstairs');
}
console.log('PASS enterable house/shop: door clearance, connected rooms, stairwell opening, headroom, and actual stair walking');
