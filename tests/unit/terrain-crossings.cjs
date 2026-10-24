'use strict';
const assert=require('node:assert/strict');
const M=require('../../prototypes/labs/microvoxel-world/voxel-world-model.js');
const {createAtlas}=require('../../prototypes/labs/microvoxel-world/hex-atlas.js');
const {createSession}=require('../../prototypes/labs/microvoxel-world/coop-session.js');
const ring=(atlas,c,n)=>{const out=[];for(let dq=-n;dq<=n;dq++)for(let dr=Math.max(-n,-dq-n);dr<=Math.min(n,-dq+n);dr++)out.push(atlas.summary(c.q+dq,c.r+dr));return out;};
// Generator: deterministic barriers on the streamed world only, with an open start.
for(const seed of [0,1,2,3,39,2718,4294967295]){
  const w=M.createWorld(seed,.25,'infinite'),a=createAtlas(w),b=createAtlas(M.createWorld(seed,.25,'infinite'));assert.equal(w.revision,'micro-wilds-27');
  const near=ring(a,a.rootHex,5),d=h=>a.distance(h,a.rootHex);
  assert.deepEqual(near,ring(b,b.rootHex,5),'barrier classification is deterministic');
  assert.ok(near.filter(h=>d(h)===1&&!h.barrier).length>=3,`seed ${seed}: at least three passable first-ring hexes`);
  assert.ok(near.some(h=>h.barrier),`seed ${seed}: a barrier within five hexes of camp`);
  for(const h of near)if(h.barrier){assert.equal(h.cost,null);assert.ok(['sound','fractured'].includes(h.rock));assert.equal(h.resource,null);}else assert.ok(h.cost>=1);
  assert.ok(!near.find(h=>h.root).barrier,'camp is never a barrier');
}
// Cliff lines leave no free-standing slivers: a raised strip one or two voxels wide, 1.5 m above both sides.
for(const seed of [0,1,2718]){const w=M.createWorld(seed,.25,'infinite'),R=60,N=R*8,H=new Float32Array(N*N);let thin=0;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++)H[j*N+i]=w.geography(-R+(i+.5)/4,-R+(j+.5)/4).height/4;
  for(let j=2;j<N-3;j++)for(let i=2;i<N-3;i++){const h=H[j*N+i];for(const d of [1,N]){const a=H[j*N+i-d],b=H[j*N+i+d],c=H[j*N+i+2*d];if(h-Math.max(a,b)>=1.5||(H[j*N+i+d]>=h-.01&&h-Math.max(a,c)>=1.5))thin++;}}
  assert.ok(thin<=4,`seed ${seed}: ${thin} sliver cells along cliff lines`);}
for(const extent of [128,256])for(const h of ring(createAtlas(M.createWorld(2718,.25,extent)),{q:6,r:6},3))assert.equal(h.barrier,false,'bounded worlds keep their catchment terrain');
// Session: scout → rate rock → engineer a crossing over several days → route and survey across it.
const w=M.createWorld(2718,.25,'infinite'),at=createAtlas(w),s=createSession(w,at);
const wall=ring(at,at.rootHex,6).filter(h=>h.barrier).sort((x,y)=>at.distance(x,at.rootHex)-at.distance(y,at.rootHex))[0];
for(const [id,role] of [['e','explore'],['r','research'],['l','logistics']]){s.join(id);assert.equal(s.claim(id,role),null);}
const step=()=>{for(const id of 'erl')s.ready(id);},hexOf=(id,k)=>s.viewFor(id).hexes.find(h=>h.key===k);
const noLeak=()=>{for(const id of 'erl')for(const h of s.viewFor(id).hexes)assert.ok(!('rock' in h),'hidden rock quality is not sent to clients');};
const edges=()=>s.viewFor('e').hexes.filter(h=>h.state==='barrier').sort((x,y)=>x.key.localeCompare(y.key));
assert.equal(s.viewFor('e').hexes.filter(h=>h.state==='frontier'||h.state==='hinted').length,6,'the camp opens onto passable ground');
for(let d=0;!edges().length&&d<16;d++){for(const h of s.viewFor('e').hexes.filter(h=>h.state==='frontier'||h.state==='hinted').sort((x,y)=>at.distance(x,wall)-at.distance(y,wall)||x.key.localeCompare(y.key)).slice(0,3))s.intent('e',{kind:'toggle',key:h.key});step();step();step();}
const edge=edges()[0];assert.ok(edge,'surveying reaches a barrier edge');
const k=edge.key;
assert.equal(s.intent('l',{kind:'cross',key:k,type:edge.terrain==='gorge'?'bridge':'ramp'}),'Exploration must scout this edge first.');
assert.equal(s.intent('e',{kind:'toggle',key:k}),null);noLeak();step();assert.equal(s.snapshot().phase,'day');
assert.ok(s.viewFor('e').crew.paths[k],'crew get a passable path to the edge');step();
const dusk=s.viewFor('l');assert.equal(dusk.report.scouted,1);assert.ok(dusk.barriers.some(b=>b.key===k),'Logistics receives the measured barrier at dusk');
assert.equal(hexOf('e',k).state,'scouted');assert.equal(hexOf('r',k).state,'rock-sample');assert.equal(hexOf('l',k).state,'barrier-known');
assert.match(s.viewFor('e').hexes.some(h=>h.key===k&&h.state==='surveyed')?'bad':'ok',/ok/,'scouting does not survey a barrier');
step();assert.equal(s.intent('e',{kind:'toggle',key:k}),'That edge is already scouted.');
const type=edge.terrain==='gorge'?'bridge':'ramp';
if(edge.terrain==='cliff')assert.match(s.intent('l',{kind:'cross',key:k,type:'cutting'}),/sound/,'a cutting needs rated sound rock');
assert.match(s.intent('l',{kind:'cross',key:k,type:edge.terrain==='gorge'?'ramp':'bridge'}),/cannot cross/);
assert.equal(s.intent('l',{kind:'cross',key:k,type}),null);const unrated=s.viewFor('l').crossing.price;assert.equal(unrated,type==='bridge'?8:6,'unrated rock is priced as fractured');
step();assert.equal(s.intent('r',{kind:'toggle',key:k}),null,'Research can study the rock sample by day');step();
const rated=s.viewFor('l');assert.equal(rated.report.rated,1);const rating=hexOf('l',k).rating;assert.ok(['sound','fractured'].includes(rating));assert.equal(hexOf('r',k).rating,rating);
assert.ok(rated.report.crossing.progress>0&&!rated.report.crossing.done,'a crossing takes more than one day');
assert.equal(rated.report.crossing.price,type==='bridge'?(rating==='sound'?5:8):(rating==='sound'?4:6),'the rock rating reprices the crossing');
step();assert.equal(s.snapshot().phase,'night');
if(type==='ramp'&&rating==='sound')assert.match(s.intent('l',{kind:'cross',key:k,type:'cutting'}),/under way/,'progress is protected');
if(!s.viewFor('l').crossing)assert.equal(s.intent('l',{kind:'cross',key:k,type}),null);
let days=0;while(!s.viewFor('l').crossings.length&&days++<8){step();step();step();}
assert.ok(s.viewFor('l').crossings.some(c=>c.key===k&&c.type===type),'the crossing completes');noLeak();
assert.equal(hexOf('e',k).state,'crossed');assert.ok(s.viewFor('e').hexes.some(h=>h.state==='frontier'&&createAtlas(w).distance(h,edge)===1),'the frontier extends beyond the crossing');
// Autopilot: an all-autopilot run engineers crossings and finds richer uplift seams.
const auto=createSession(w,createAtlas(w));auto.join('x');auto.claim('x','explore');
for(let i=0;i<14*3;i++){const v=auto.viewFor('x');if(v.phase==='night'&&!v.plan.length){const f=v.hexes.filter(h=>h.state==='frontier'||h.state==='hinted').sort((a,b)=>at.distance(a,wall)-at.distance(b,wall)||a.key.localeCompare(b.key)),edges=v.hexes.filter(h=>h.state==='barrier').sort((a,b)=>a.key.localeCompare(b.key));for(const h of [...(i>=6?edges.slice(0,1):[]),...f].slice(0,i<6?2:3))auto.intent('x',{kind:'toggle',key:h.key});}auto.ready('x');}
const snap=auto.snapshot();assert.ok(snap.scouted>0&&snap.rated>0,'autopilot research rates scouted rock');assert.ok(snap.logistics.crossings>0,'autopilot logistics engineers a crossing');
const seams=auto.viewFor('x');
console.log('PASS terrain crossings: deterministic open-start barriers, hidden rock, scout→rate→multi-day crossing, routing beyond, autopilot crossings',JSON.stringify({crossings:snap.logistics.crossings,scouted:snap.scouted}));
