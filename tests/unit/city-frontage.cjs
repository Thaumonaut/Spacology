'use strict';
// Road solver: every non-hero building's door opens onto a road (street, alley, plaza or courtyard) - the point 2.5 m
// out from its door lies on one - and frontage rows follow their road (front parallel to the road within 12 degrees).
const assert=require('node:assert/strict'),dir='../../prototypes/labs/castle-drafts/';global.CastleGen=require(dir+'castle-gen.js');const C=require(dir+'city-gen.js');
for(const seed of [2,3]){const c=C.generate(seed),S=c.streets,P=[...c.plazas,...c.courts];
  const near=(x,z)=>{let best=null;for(const s of S){const dx=s.x1-s.x0,dz=s.z1-s.z0,L2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-s.x0)*dx+(z-s.z0)*dz)/L2)),d=Math.hypot(x-s.x0-dx*t,z-s.z0-dz*t)-s.w/2;if(!best||d<best.d)best={d,s};}return best;};
  const onRoad=(x,z)=>near(x,z).d<1.2||P.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+1.2)||Math.hypot(x,z)<c.plazaR;
  let n=0,bad=0,skew=0;for(const b of c.buildings){if(b.hero)continue;n++;const cs=Math.cos(b.rot),sn=Math.sin(b.rot),F=b.doorSide||1,u=b.doorU||0,v=F*(b.d/2+2.5),x=b.x+u*cs-v*sn,z=b.z+u*sn+v*cs;
    if(!onRoad(x,z))bad++;if(b.src==='front'||b.src==='alley'){const r=near(x,z).s,a=Math.atan2(r.z1-r.z0,r.x1-r.x0),diff=Math.abs(Math.atan2(Math.sin(2*(a-b.rot)),Math.cos(2*(a-b.rot))))/2;if(diff>12*Math.PI/180)skew++;}}
  assert.equal(bad,0,`seed ${seed}: ${bad}/${n} doors off-road`);assert.ok(skew/n<.03,`seed ${seed}: ${skew}/${n} fronts skewed from their road`);}
console.log('PASS city frontage: every door on a road, frontage rows aligned with their roads');
