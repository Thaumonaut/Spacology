'use strict';
const assert=require('node:assert/strict');
const R=require('../../prototypes/labs/building-lab/review.js'),W=require('../../prototypes/labs/building-lab/walk.js');
function fixture(){
  const w=12,d=20,X=w*8,Z=d*8,Y=48,vol=new Uint8Array(X*Y*Z),grid=Array(w*d).fill(-1);
  const at=(x,y,z,m)=>vol[x+X*(z+Z*y)]=m;
  for(let z=0;z<Z;z++)for(let x=0;x<X;x++)for(let y=0;y<4;y++)at(x,y,z,1);
  for(let z=2;z<18;z++)for(let x=4;x<8;x++)grid[x+w*z]=1;
  for(let y=4;y<38;y++)for(let z=16;z<144;z++)for(let x=32;x<64;x++)if(x<35||x>=61||z<19||z>=141)at(x,y,z,1);
  const plan={cell:.5,plot:{w,d},floors:[{grid,rooms:[{id:0,type:'stair',cells:0},{id:1,type:'hall',label:'Hall',cells:64,box:[4,2,7,17]}],openings:[]}]},
    building={cell:1/16,dims:[X,Y,Z],origin:[0,0,0],levels:[4,52],plate:48,vol,info:{doorLeaves:[]},M:{stair_wood:2,plank:3,door_wood:4,timber_dark:5}};
  return {plan,building,at};
}
const f=fixture(),normal=R.navigation(f.plan,f.building);
assert.equal(R.hallwayClearance(f.plan,f.building,1.2)[0].status,'clear','straight finished 1.625m hall clears a 1.2m requirement');
assert.equal(R.hallwayClearance(f.plan,f.building,1.8)[0].status,'too narrow','test actual finished width, not the nominal 2m plan strip');
const door=fixture();
door.plan.floors[0].openings.push({kind:'front',room:1,side:'zm',cells:[[4,2],[5,2],[6,2]]});
for(let y=4;y<38;y++)for(let z=16;z<19;z++)for(let x=35;x<54;x++)door.at(x,y,z,0);
assert.equal(R.hallwayClearance(door.plan,door.building,1.2)[0].status,'clear','a narrower entry threshold does not shrink the hall behind it');
for(let y=4;y<38;y++)for(let z=77;z<85;z++)for(let x=48;x<61;x++)door.at(x,y,z,1);
assert.equal(R.hallwayClearance(door.plan,door.building,1.2)[0].status,'pinched','a door threshold exemption cannot hide a pinch farther down the hall');
const branch=fixture();branch.plan.floors[0].openings=door.plan.floors[0].openings;
for(let y=4;y<38;y++)for(let z=19;z<60;z++)for(let x=48;x<61;x++)branch.at(x,y,z,1);
assert.equal(R.hallwayClearance(branch.plan,branch.building,1.2)[0].status,'narrow branch','a long narrow entry passage is not exempted as a door threshold');
for(let y=4;y<38;y++)for(let z=77;z<85;z++)for(let x=48;x<61;x++)f.at(x,y,z,1);
assert.equal(R.hallwayClearance(f.plan,f.building,1.2)[0].status,'pinched','one local bottleneck splits an otherwise adequate hallway');
const nav=R.navigation(f.plan,f.building),start=nav.nearest('0:1',3,2,1),goals=new Set(nav.nearest('0:1',3,8,1)),seen=new Set(start),q=[...start];
for(let i=0;i<q.length;i++)for(const j of nav.edges(q[i]))if(!seen.has(j)){seen.add(j);q.push(j);}
assert.ok([...goals].some(j=>seen.has(j)),'the same pinch remains traversable by the smaller person: width is a distinct test');
assert.ok(normal.nodes.length);
const g=fixture(),original=Buffer.from(g.building.vol),walk=W.create(g.plan,g.building);
assert.ok(walk.enter('floor',0));assert.equal(walk.snapshot().eye[1]-walk.snapshot().position[1],1.6);
const before=walk.snapshot().position;assert.ok(walk.move(0,.5));assert.ok(walk.snapshot().position[2]>before[2]);
walk.move(10,0);assert.ok(walk.snapshot().position[0]<61/16-.24,'a large move cannot tunnel through a thin wall');
assert.equal(walk.stand(3,5,3.25),null,'cannot teleport through a storey to a remote support surface');
const h=fixture();for(let y=20;y<24;y++)for(let x=35;x<61;x++)for(let z=50;z<60;z++)h.at(x,y,z,1);
assert.equal(W.create(h.plan,h.building).stand(3,3.5,.25),null,'low headroom blocks the human-height body');
const stairs=fixture();for(let z=80;z<84;z++)for(let x=35;x<61;x++)for(let y=4;y<7;y++)stairs.at(x,y,z,1);
const stairWalk=W.create(stairs.plan,stairs.building);assert.equal(stairWalk.stand(3,81/16,.25),7/16,'a 3-voxel riser is a step, not a wall');
assert.ok(original.equals(Buffer.from(g.building.vol)),'inspection leaves original volume unchanged');
walk.leave();assert.equal(walk.snapshot().active,false);
for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const right=W.direction(yaw,1,0),forward=W.direction(yaw,0,1),turned=W.look(yaw,0,40,0),after=W.direction(turned.yaw,0,1);
  assert.ok(after[0]*right[0]+after[1]*right[1]>0,'rightward mouse movement turns toward screen right');
  assert.ok(Math.abs(right[0]*forward[0]+right[1]*forward[1])<1e-8,'strafe is perpendicular to forward');
  assert.ok(Math.abs(Math.hypot(...W.direction(yaw,1,1))-1)<1e-8,'diagonal walking is not faster');
}
assert.equal(W.look(0,0,0,10000).pitch,-1.35,'mouse pitch stays bounded');
const P=require('../../prototypes/labs/building-lab/plan.js'),V=require('../../prototypes/labs/building-lab/voxels.js');
for(const [seed,options] of [[550298,{type:'shophouse',style:'fairytale',context:'terrace',lot:'wedge'}],[550300,{type:'workshop',style:'fairytale',context:'terrace',lot:'rect',typology:'side'}],
  [3,{type:'home',typology:'stairhall',context:'detached',stair:{kind:'spiral'}}],[1,{type:'home',typology:'side',context:'detached',stair:{kind:'spiral',tower:true}}],[1,{type:'inn',typology:'courtyard',context:'detached',stair:{kind:'spiral'}}]]){
  const p=P.generate(seed,options),b=V.build(p),w=W.create(p,b);
  assert.ok(w.enter(options.stair?'floor':'resident',0),`${seed}: start on the ground floor, never at an upstairs inspection spawn`);
  assert.equal(w.snapshot().floor,0,'never substitute an upstairs inspection spawn');
  const nav=R.navigation(p,w.building,W.BODY),s=w.snapshot().position,starts=nav.nearest(options.stair?'0:1':null,s[0],s[2],.2),goals=new Set(nav.anchors('1:1')),
    prev=new Map(starts.map(n=>[n,null])),q=[...starts];let end=null;
  for(let i=0;i<q.length;i++){
    if(goals.has(q[i])){end=q[i];break;}
    for(const n of nav.edges(q[i]))if(!prev.has(n)){prev.set(n,q[i]);q.push(n);}
  }
  assert.notEqual(end,null,`${seed}: there is a candidate route to the upper hall`);
  const route=[];for(let n=end;n!==null;n=prev.get(n))route.push(nav.nodes[n].point);route.reverse();
  for(const target of route){
    const before=w.snapshot().position;w.move(target[0]-before[0],target[2]-before[2]);
    const after=w.snapshot().position;
    assert.ok(Math.hypot(after[0]-target[0],after[2]-target[2])<.08,`${seed}: physical movement cannot stall at ${target}`);
    assert.ok(Math.abs(after[1]-before[1])<=W.BODY.maxStep+.001,`${seed}: no storey-height teleport`);
  }
  assert.equal(w.snapshot().floor,1,`${seed}: movement actually climbed to the next storey`);
  assert.ok(Math.abs(w.snapshot().position[1]-b.levels[1]*b.cell)<.001,'arrival is on the real floor, not above furniture');
}
console.log('PASS finished hallway envelope, local pinch vs body-fit, human eye scale, swept wall collision, headroom and step support');
