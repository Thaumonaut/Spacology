'use strict';
const assert=require('node:assert/strict');
const S=require('../../prototypes/labs/city-lab/city-stream.js');
const C=require('../../prototypes/labs/city-lab/city-model.js');
const eye=[0,2,0],forward={forward:[1,0]};
function parcel(id,x,z=0,width=8,depth=12,rotation=0,padY=0){
  const right=[Math.cos(rotation),Math.sin(rotation)],inward=[-Math.sin(rotation),Math.cos(rotation)];
  return {id,origin:[x-right[0]*width/2-inward[0]*depth/2,z-right[1]*width/2-inward[1]*depth/2],right,inward,width,depth,padY,options:{storeys:3}};
}
function prior(id,mode='exterior',near=false,voxelSize=.5){return {id,mode,near,voxelSize,distance:0,projected:0};}
function evaluate(input){
  return [...S.targets(input.city,input.position,new Map(input.previous.map(({id,...t})=>[id,t])),input.mode,input.pinned,input.view)].map(([id,t])=>({id,...t}));
}
function inputFor(parcels,view={},previous=[],position=eye,mode='stream',pinned=null){return {city:{parcels},position,previous,mode,pinned,view};}
function one(p,view={},previous=[],position=eye){return evaluate(inputFor([p],view,previous,position))[0];}
function saturatedTurnRing(){return [...Array.from({length:64},(_,i)=>parcel(i,80*Math.cos(i*Math.PI/32),80*Math.sin(i*Math.PI/32))),parcel(1000,-41)];}
function bounds(targets){
  assert.ok(targets.filter(t=>t.mode==='exterior').length<=64,'16 all-around + 24 visible + 24 held exterior slots, including pinned');
  assert.ok(targets.filter(t=>t.near).length<=6,'near/sparse budget stays bounded');
  for(const t of targets){assert.ok(['low','facade','exterior'].includes(t.mode),'never full/interior');assert.ok([.5,1,2].includes(t.voxelSize),'compact sizes unchanged');assert.ok(!t.near||t.mode==='exterior');}
}

// Reused by the native Rust test: exact policy/flag/order parity around EVERY new
// boundary, plus old voxel thresholds. Expected results are produced by JS here;
// runAssertions below independently checks intended behavior, not parity alone.
function matrix(){
  const cases=[];
  function add(input){cases.push({input,expected:evaluate(input)});}
  const eps=1e-7;
  for(const d of [0,14,20,36,48,64,80,96,112,120])for(const delta of [-eps,0,eps]){
    if(d+delta<0)continue;
    const p=parcel(9,d+delta+6); // surface distance exactly centerX - 4 - 2
    for(const view of [{},{forward:[0,0]},forward,{forward:[-1,0]},{forward:[3,4]}]){
      for(const old of [[],[prior(9,'exterior',true)],[prior(9)],[prior(9,'facade')],[prior(9,'low')]])add(inputFor([p],view,old));
    }
  }
  // Expanded cone boundary including parcel extent, varied FOV, normalized or
  // nonunit directions, and rotated/slanted footprint edges at close thresholds.
  const radius=Math.hypot(4,6)+2;
  for(const fov of [.4,70*Math.PI/180,2.8]){
    const angle=Math.min(85*Math.PI/180,Math.max(65*Math.PI/180,fov/2+25*Math.PI/180));
    const boundary=Math.acos(Math.cos(angle)-radius/85);
    for(const theta of [boundary-eps,boundary,boundary+eps,Math.PI,0]){
      for(const old of [[],[prior(9)],[prior(9,'exterior',true)]])add(inputFor([parcel(9,85*Math.cos(theta),85*Math.sin(theta))],{forward:[1,0],fov},old));
    }
  }
  for(const radius of [14,20,36,48,64,80,96,112,120])for(const theta of [.1,.3,.7,1.1,1.7,2.3,3.5,4.7]){
    for(const old of [[],[prior(9)],[prior(9,'exterior',true)]]){
      add(inputFor([parcel(9,radius*Math.cos(theta),radius*Math.sin(theta),8,12,theta/2)],forward,old));
    }
  }
  // Corner distance, vertical prism proximity, negative pads and nonorthogonal
  // frames must not revert to distance from the centre or flatten uneven pads.
  for(const pad of [-12,0,9])for(const y of [pad-20,pad-1,pad+2,pad+14,pad+28,pad+34]){
    for(const theta of [0,.3,1.7])add(inputFor([parcel(9,23,19,28,44,theta,pad)],forward,[],[0,y,0]));
  }
  const slanted=parcel(9,28,35);slanted.inward=[.3,1];
  add(inputFor([slanted],forward));
  for(const margin of [0,2,3.5,8])for(const theta of [0,.3,1.7]){
    const overhang=parcel(9,23,19,8,12,theta);overhang.envelope={front:margin,rear:.25,side:.25};
    add(inputFor([overhang],forward));
  }
  // Voxel/facade projection thresholds, including step-down from exterior:
  // projection/height is not rounded to f32 by compact transport.
  for(const ppm of [.4,.425,.426,.499,.5,.501,.574,.575,.85,.851,.999,1,1.001,1.149,1.15,1.151]){
    for(const mode of ['low','facade','exterior'])for(const voxelSize of [.5,1,2])add(inputFor([parcel(9,1006)],{height:ppm*1000*2*Math.tan(.5),fov:1},[prior(9,mode,false,voxelSize)]));
  }
  for(const projected of [8-eps,8,8+eps,12-eps,12,12+eps,32-eps,32,32+eps,48-eps,48,48+eps]){
    for(const distance of [90,115,1000])for(const old of [[],[prior(9,'low')],[prior(9,'facade')],[prior(9)]]){
      add(inputFor([parcel(9,distance+6)],{forward:[1,0],fov:1,height:projected/(radius*2)*distance*2*Math.tan(.5)},old));
    }
  }
  // Full 360-degree turns and dense bounded replacement are stateful sequences.
  for(const count of [8,40,128]){
    const ring=Array.from({length:count},(_,i)=>parcel(i,(count===8?12:60+i%7)*Math.cos(i*2*Math.PI/count),(count===8?12:60+i%7)*Math.sin(i*2*Math.PI/count)));
    let previous=[];
    for(let step=0;step<=16;step++){
      const input=inputFor(ring,{forward:[Math.cos(step*Math.PI/8),Math.sin(step*Math.PI/8)]},previous,eye,'stream',step===8?count-1:null);
      add(input);previous=cases.at(-1).expected;
    }
  }
  const turnRing=saturatedTurnRing(),beforeTurn=inputFor(turnRing,forward);
  add(beforeTurn);add(inputFor(turnRing,{forward:[-1,0]},cases.at(-1).expected));
  for(const aspect of [.5,1,1.6,2.5]){
    const ring=Array.from({length:128},(_,i)=>parcel(i,70*Math.cos(i*Math.PI/64),70*Math.sin(i*Math.PI/64)));
    let previous=[];
    for(const f of [[1,0],[0,1],[-1,0],[0,-1]]){
      add(inputFor(ring,{height:900,fov:70*Math.PI/180,aspect,forward:f},previous));previous=cases.at(-1).expected;
    }
  }
  for(const mode of ['stream','detailed','full','exterior'])for(const pinned of [null,0,39,999]){
    add(inputFor(Array.from({length:40},(_,i)=>parcel(i,i*7,20)),forward,[],eye,mode,pinned));
  }
  return cases;
}
function runAssertions(){
  const ring=Array.from({length:8},(_,i)=>parcel(i,12*Math.cos(i*Math.PI/4),12*Math.sin(i*Math.PI/4)));
  let previous=[];
  for(let turn=0;turn<=24;turn++){
    const targets=evaluate(inputFor(ring,{forward:[Math.cos(turn*Math.PI/12),Math.sin(turn*Math.PI/12)]},previous));
    bounds(targets);
    assert.equal(targets.filter(t=>t.mode==='exterior').length,8,'all eight close buildings stay detailed through a full 360-degree turn');
    assert.equal(targets.filter(t=>t.near).length,6,'six close near/sparse slots, other close buildings remain exterior meshes');
    if(previous.length)assert.deepEqual(targets.map(t=>[t.id,S.key(t)]).sort((a,b)=>a[0]-b[0]),previous.map(t=>[t.id,S.key(t)]).sort((a,b)=>a[0]-b[0]),'turning cannot churn close jobs');
    previous=targets;
  }
  // A large parcel can have a far centre and a wall directly beside the walker.
  const large=parcel(0,0,100,8,200),close=one(large,forward);
  assert.equal(close.distance,0);assert.equal(close.near,true);assert.equal(close.mode,'exterior');
  const rotated=parcel(0,100,0,8,200,Math.PI/2);
  assert.equal(one(rotated,forward).distance,0,'rotated footprint, not a world-axis or centre-only shortcut');
  const corner=one(parcel(0,7,10));
  assert.equal(corner.distance,3,'nearest rectangle corner: hypot(3,4) minus 2m roof margin');
  assert.equal(one(parcel(0,0,0,8,12,0,10),{},[],[0,11.6,0]).distance,0,'uneven pad uses actual vertical prism');
  assert.equal(one(parcel(0,0,0),{},[],[0,20,0]).distance,6,'roof margin included vertically');
  const overhang=parcel(0,20);overhang.envelope={front:3.5,rear:.25,side:.25};
  assert.equal(one(overhang,forward).distance,12.5,'declared overhang beyond 2m expands conservative surface protection');
  assert.equal(one(overhang,forward).near,true);

  assert.equal(one(parcel(0,100),forward).mode,'exterior','forward detail extends beyond the all-around acquisition radius');
  assert.equal(one(parcel(0,-100),forward).mode,'facade','far behind is recognizable facade, not new full-detail work');
  const side=parcel(0,70*Math.cos(72*Math.PI/180),70*Math.sin(72*Math.PI/180));
  assert.equal(one(side,forward).mode,'exterior','angular margin and building radius include partially visible sides');
  const acquired=one(parcel(0,100),forward),turned=one(parcel(0,100),{forward:[-1,0]},[acquired]);
  assert.equal(turned.mode,'exterior','180-degree turn retains a previously loaded forward exterior');
  assert.equal(one(parcel(0,119),{forward:[-1,0]},[acquired]).mode,'facade','turn buffer eventually releases beyond 112 surface metres');
  assert.equal(one(parcel(0,-41),forward).mode,'exterior','local all-around buffer protects behind');
  assert.equal(one(parcel(0,69),{}).mode,'exterior','absent direction uses conservative all-around policy');
  assert.deepEqual(one(parcel(0,69),{forward:[0,0]}),one(parcel(0,69),{}),'zero direction has identical fallback');
  assert.deepEqual(one(parcel(0,100),{forward:[100,0]}),acquired,'horizontal direction normalized');

  for(const [surface,near] of [[14-1e-7,true],[14,false]])assert.equal(one(parcel(0,surface+6),forward).near,near,'strict close acquire boundary');
  for(const [surface,near] of [[20-1e-7,true],[20,false]])assert.equal(one(parcel(0,surface+6),forward,[prior(0,'exterior',true)]).near,near,'strict close retention boundary');
  for(const [surface,mode] of [[36-1e-7,'exterior'],[36,'facade']])assert.equal(one(parcel(0,-surface-6),forward).mode,mode,'strict rear local acquisition');
  for(const [surface,mode] of [[64-1e-7,'exterior'],[64,'facade']])assert.equal(one(parcel(0,surface+6)).mode,mode,'strict no-direction acquisition');
  for(const [surface,mode] of [[80-1e-7,'exterior'],[80,'facade']])assert.equal(one(parcel(0,surface+6),{},[prior(0)]).mode,mode,'strict no-direction retention');
  for(const [surface,mode] of [[96-1e-7,'exterior'],[96,'facade']])assert.equal(one(parcel(0,surface+6),forward).mode,mode,'strict forward acquisition');
  for(const [surface,mode] of [[112-1e-7,'exterior'],[112,'facade']])assert.equal(one(parcel(0,-surface-6),forward,[prior(0)]).mode,mode,'strict turn retention');
  for(const [surface,mode] of [[120-1e-7,'exterior'],[120,'facade']])assert.equal(one(parcel(0,surface+6),forward,[prior(0)]).mode,mode,'strict forward retention');

  const diameter=(Math.hypot(4,6)+2)*2;
  for(const [pixels,expected] of [[12-1e-6,'low'],[12+1e-6,'facade']]){
    assert.equal(one(parcel(0,1006),{height:pixels/diameter*1000*2*Math.tan(.5),fov:1}).mode,expected,'strict tiny facade acquisition');
  }
  for(const mode of ['facade','exterior'])for(const [pixels,expected] of [[8-1e-6,'low'],[8+1e-6,'facade']]){
    assert.equal(one(parcel(0,1006),{height:pixels/diameter*1000*2*Math.tan(.5),fov:1},[prior(0,mode)]).mode,expected,'facade/exterior step-down retains recognizable architecture until tiny');
  }
  for(const [pixels,expected] of [[48-1e-6,'facade'],[48+1e-6,'exterior']]){
    assert.equal(one(parcel(0,96),{height:pixels/diameter*90*2*Math.tan(.5),fov:1,forward:[1,0]}).mode,expected,'projected-size forward acquisition gate');
  }
  for(const [pixels,expected] of [[32-1e-6,'facade'],[32+1e-6,'exterior']]){
    assert.equal(one(parcel(0,121),{height:pixels/diameter*115*2*Math.tan(.5),fov:1,forward:[1,0]},[prior(0)]).mode,expected,'forward projection retention outside all-around turn buffer');
  }

  // Saturation: no density or pin can grow high-detail targets without limit.
  const dense=Array.from({length:1000},(_,i)=>parcel(i,(i%40-20)*2,(Math.floor(i/40)-12)*2));
  for(const pinned of [null,999]){
    const targets=evaluate(inputFor(dense,forward,[],eye,'stream',pinned));bounds(targets);
    assert.equal(targets.filter(t=>t.mode==='exterior').length,40,'24 view-facing slots supplement the 16 all-around slots');
    assert.equal(targets.filter(t=>t.near).length,6);
    assert.ok(targets.every(t=>t.mode!=='low'),'dense overflow must remain facade, never adjacent boxes');
    if(pinned!==null){assert.equal(targets[0].id,pinned);assert.equal(targets[0].near,true);}
    const again=evaluate(inputFor(dense,forward,targets,eye,'stream',pinned));
    assert.deepEqual(again.map(t=>[t.id,S.key(t)]),targets.map(t=>[t.id,S.key(t)]),'stationary saturated selection and ordering are stable');
  }
  // Retention must not monopolize every far slot after a large turn: the new
  // view needs forward detail even when all 16 slots were occupied beforehand.
  const turnRing=saturatedTurnRing(),beforeTurn=evaluate(inputFor(turnRing,forward));
  const afterTurn=evaluate(inputFor(turnRing,{forward:[-1,0]},beforeTurn));
  bounds(beforeTurn);bounds(afterTurn);
  const facingBack=t=>t.mode==='exterior'&&t.id>16&&t.id<48;
  assert.equal(beforeTurn.filter(facingBack).length,0);
  assert.ok(afterTurn.filter(facingBack).length>=8,'saturated exterior budget follows new forward view, not only old far-behind jobs');
  assert.equal(afterTurn.find(t=>t.id===1000).mode,'exterior','local all-around buffer survives saturated large turns');
  assert.equal(S.key(afterTurn.find(t=>t.id===1000)),S.key(beforeTurn.find(t=>t.id===1000)));
  assert.ok(afterTurn.every(t=>t.mode!=='low'),'displaced exterior slots retain recognizable facades');
  const line=Array.from({length:17},(_,i)=>parcel(i,25+i*.1));
  let held=evaluate(inputFor(line));
  const moved=line.map(p=>structuredClone(p));moved[16].origin[0]-=1;
  const smallMove=evaluate(inputFor(moved,{},held));
  assert.equal(smallMove.find(t=>t.id===16).mode,'facade','1m competitor improvement cannot churn a held exterior slot');
  // Scarce close protection wins even if all old slots are farther away.
  moved[16]=parcel(16,8);
  assert.equal(evaluate(inputFor(moved,{},smallMove)).find(t=>t.id===16).mode,'exterior');

  for(const terrain of ['flat','uneven'])for(const count of [24,100,1000]){
    const city=C.generate(1,{count,terrain});
    for(const p of city.parcels.filter((_,i)=>i%Math.max(1,Math.floor(count/8))===0)){
      const targets=[...S.targets(city,[p.origin[0],p.padY+1.6,p.origin[1]],new Map(),'stream',null,forward).values()];bounds(targets);
      assert.ok(targets.filter(t=>t.mode==='exterior').length>0);
    }
  }
  for(const terrain of ['flat','uneven']){
    const city=C.generate(1,{count:1000,layout:'grid',width:1,terrain}),eye=[0,1.6,city.landmarks.gate.z-5];
    assert.equal(city.parcels.length,1152,'actual screenshot-sized district, not a 24-house substitute');
    const view={forward:[0,-1],height:900,aspect:1440/900,fov:70*Math.PI/180};
    let targets=S.targets(city,eye,new Map(),'stream',null,view);
    for(let i=0;i<3;i++)targets=S.targets(city,eye,targets,'stream',null,view);
    bounds([...targets.values()]);assert.ok([...targets.values()].filter(t=>t.mode==='exterior').length>=40,'large street view exceeds the old 16-exterior ceiling');
    const halfWidth=Math.tan(view.fov/2)*view.aspect;
    const inView=[...targets].filter(([id,t])=>{
      const p=city.parcels[id],x=p.origin[0]+p.right[0]*p.width/2+p.inward[0]*p.depth/2,z=p.origin[1]+p.right[1]*p.width/2+p.inward[1]*p.depth/2;
      return t.mode==='exterior'&&z<eye[2]&&Math.abs(x)<(eye[2]-z)*halfWidth;
    });
    assert.ok(inView.length>=24,'at least 24 full-resolution parcel centres in the screen cone, not only extra off-screen residents');
    const turned=S.targets(city,eye,targets,'stream',null,{...view,forward:[1,0]});bounds([...turned.values()]);
    assert.ok([...turned].filter(([id,t])=>t.mode==='exterior'&&targets.get(id).mode==='exterior').length>=16,'retain nearby/held detail while acquiring the new view');
    assert.ok([...turned.values()].every(t=>t.mode!=='full'),'large-city coverage cannot schedule interiors');
  }
  for(const mode of ['detailed','full']){
    const t=evaluate(inputFor(dense,forward,[],eye,mode));
    assert.equal(t.filter(t=>t.mode==='exterior').length,dense.length,'explicit comparison modes retain existing all-exterior semantics');
    assert.equal(t.filter(t=>t.near).length,6);assert.ok(t.every(t=>t.mode!=='full'));
  }
  const low=evaluate(inputFor(dense,forward,[],eye,'exterior',999));
  assert.equal(low.filter(t=>t.mode==='low').length,999,'explicit exterior comparison mode stays coarse except pinned');
  assert.equal(low[0].id,999);assert.equal(S.key(low[0]),'exterior:near');
  // Streaming and its increased exterior budget cannot schedule interior jobs.
  assert.equal(S.prefetch([0,2,20],{0:{entry:[0,0]},1:{entry:[40,40]}}),null);
  assert.equal(S.prefetch([0,2,11.999],{0:{entry:[0,0]}},null),0);
  assert.equal(S.prefetch([0,2,18],{0:{entry:[0,0]}},0),null);
}
module.exports={matrix};
if(require.main===module){
  if(process.argv.includes('--fixtures'))process.stdout.write(JSON.stringify(matrix()));
  else{runAssertions();console.log('surface/view exterior buffer: 360-degree protection, turns, strict thresholds, density, modes and interior separation');}
}
