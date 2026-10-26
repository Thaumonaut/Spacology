// Stepped pedestrian edges and level entrance landings beside a continuous carriageway.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./pavement-plan.js'));else root.StreetEdges=factory(root.PavementPlan);})(this,function(P){
'use strict';
const EPS=1e-6;
function patchSource(p,priority){return {part:p,priority,role:p.role,x0:p.x0,x1:p.x1,z0:p.z0,z1:p.z1,height:(x,z)=>{const u=(x-p.x0)/(p.x1-p.x0),v=(z-p.z0)/(p.z1-p.z0),h=p.heights;return (1-u)*((1-v)*h[0]+v*h[1])+u*((1-v)*h[3]+v*h[2]);}};}
function build({blocks,buildings,parts,ground,width=1.9,extraCuts=[],flattenPlots=false}){
 const byId=new Map(buildings.map(b=>[b.id,b])),cuts=[...extraCuts],rows=[],claimed=new Set(),result=[];
 const floorRoles={'door-threshold':100,'work-yard':50,'ground-floor':70,'ground-floor-frame':60,'display-pad':40};
 const configs=blocks.flatMap(block=>[{block,axis:'x',side:0},{block,axis:'x',side:1},...(block.endRows?[{block,axis:'z',side:0},{block,axis:'z',side:1}]:[])]);
 for(const {block,axis,side} of configs){
  const U=axis==='x'?'x':'z',V=axis==='x'?'z':'x',span=axis==='x'?block.w:block.d,depth=axis==='x'?block.d:block.w,sign=side?1:-1,face=block[V]+sign*depth/2,z0=Math.min(face,face+sign*width),z1=Math.max(face,face+sign*width),x0=block[U]-span/2,x1=block[U]+span/2,bs=(axis==='x'?block.rows:block.endRows)[side].map(id=>byId.get(id)),sources=[],sections=[];
  const localGround=(u,v)=>axis==='x'?ground(u,v):ground(v,u);
  const orient=s=>axis==='x'?s:{...s,x0:s.z0,x1:s.z1,z0:s.x0,z1:s.x1,height:(x,z)=>s.height(z,x)};
  const source=(p,priority)=>orient(P.source(p,priority));
  cuts.push(axis==='x'?{x0,x1,z0,z1}:{x0:z0,x1:z1,z0:x0,z1:x1});
  const add=(a,b,y,role)=>{if(b-a<EPS)return;sections.push({x0:a,x1:b,y,role});sources.push(source({t:'box',x:(a+b)/2,y:y-.5,z:(z0+z1)/2,w:b-a,h:.5,d:width,col:[.63,.62,.55],pat:3,role},10));const cz=face+sign*(width-.085);sources.push(source({t:'box',x:(a+b)/2,y:y-.4,z:cz,w:b-a,h:.4,d:.17,col:[.72,.71,.64],pat:0,role:'curb-cap'},20));};
  const nodes=[...bs.map(b=>({x:b.sockets.door[U],y:b.sockets.door.y,building:b.id})),...(block.gateLandings||[]).filter(g=>g.axis===axis&&g.side===side).map(g=>({x:g.u,y:g.y,building:'courtyard-gate'}))].sort((a,b)=>a.x-b.x);
  const landings=nodes.map((n,i)=>{const left=i?(nodes[i-1].x+n.x)/2:x0,right=i+1<nodes.length?(nodes[i+1].x+n.x)/2:x1;return {...n,a:Math.max(x0,n.x-.9,left+.05),b:Math.min(x1,n.x+.9,right-.05)};});
  // Make room for full treads at the two block ends without narrowing a
  // doorway landing below 1.3 m. If only one short end remains, flatten it.
  const first=landings[0],last=landings[landings.length-1];let startY=localGround(x0,face)+.28,endY=localGround(x1,face)+.28;
  const startNeed=Math.ceil(Math.abs(first.y-startY)/.16-EPS)*.28,endNeed=Math.ceil(Math.abs(last.y-endY)/.16-EPS)*.28;
  if(first.a-x0<startNeed){first.a=Math.min(first.x-.65,x0+startNeed);const maxRise=Math.floor((first.a-x0)/.28)*.16;startY=first.y+Math.sign(startY-first.y)*Math.min(Math.abs(startY-first.y),maxRise);}
  if(x1-last.b<endNeed){last.b=Math.max(last.x+.65,x1-endNeed);const maxRise=Math.floor((x1-last.b)/.28)*.16;endY=last.y+Math.sign(endY-last.y)*Math.min(Math.abs(endY-last.y),maxRise);}
  let lastX=x0,lastY=startY;
  for(const n of [...landings,{a:x1,b:x1,y:endY}]){
   const run=n.a-lastX,rise=n.y-lastY;if(run>EPS){const steps=Math.max(1,Math.ceil(Math.abs(rise)/.16-EPS));for(let i=0;i<steps;i++)add(lastX+run*i/steps,lastX+run*(i+1)/steps,lastY+rise*(i+.5)/steps,'sidewalk-step');}
   if(n.b>n.a)add(n.a,n.b,n.y,'sidewalk-landing');lastX=n.b;lastY=n.y;
  }
  // Reuse one ownership plan for the paving and all existing ground slabs.
  // Thresholds and work floors win over landings, avoiding coplanar overlays.
  for(const b of bs){for(const p of b.parts)if(p.t==='surfacePatch'&&floorRoles[p.role]!=null){claimed.add(p);sources.push(patchSource(p,floorRoles[p.role]));}
   const door=b.sockets.door,near=door[V]+sign*.13,far=face+sign*(b.variant==='warehouse'?.55:.95),lo=Math.min(near,far),hi=Math.max(near,far);
   sources.push(source({t:'box',x:door[U],y:door.y-.4,z:(lo+hi)/2,w:1.65,h:.4,d:hi-lo,col:[.63,.62,.55],pat:3,role:'entrance-apron'},90));
  }
  const walkY=x=>{const s=sections.find(s=>x>=s.x0-EPS&&x<=s.x1+EPS);return s?s.y:localGround(x,face)+.28;};
  const ramps=[...bs.filter(b=>b.variant==='warehouse').map(b=>({x:b.sockets.door[U],role:'freight-curb-ramp'})),{x:x0+1.2,role:'corner-curb-ramp'},{x:x1-1.2,role:'corner-curb-ramp'}];
  const rampHeight=(xx,zz)=>{const weight=Math.max(0,...ramps.map(r=>Math.min(1,(1.17-Math.abs(xx-r.x))/.35))),t=(zz-(face+sign*.55))/(sign*(width-.55)),y=walkY(xx);return y+t*weight*(localGround(xx,zz)-y);};
  for(const ramp of ramps){
   const x=ramp.x,a=face+sign*.55,c=face+sign*width,za=Math.min(a,c),zb=Math.max(a,c),limits=[Math.max(x0,x-1.17),x-.82,x+.82,Math.min(x1,x+1.17)];
   for(let k=1;k<limits.length;k++){const left=limits[k-1],right=limits[k];if(right-left<EPS)continue;
    sources.push(orient({...patchSource({t:'surfacePatch',x0:left,x1:right,z0:za,z1:zb,heights:[rampHeight(left,za),rampHeight(left,zb),rampHeight(right,zb),rampHeight(right,za)],col:[.66,.65,.58],pat:3,role:ramp.role},80),height:rampHeight}));
   }
  }
  const plan=P.build(sources,ground);result.push(...plan.parts);rows.push({block:blocks.indexOf(block),side,axis,sign,face,width,x0,x1,z0,z1,sections,landings});
 }
 // Split the underlying road plane at sidewalk boundaries so it cannot poke
 // through lower treads at the uphill side of a landing.
 const plots=flattenPlots?buildings.map(b=>({x0:b.footprint.x-b.footprint.w/2,x1:b.footprint.x+b.footprint.w/2,z0:b.footprint.z-b.footprint.d/2,z1:b.footprint.z+b.footprint.d/2,floor:b.footprint.floor})):[];
 const base=parts.find(p=>p.role==='city-ground'),xs=[...new Set([base.x0,base.x1,...cuts.flatMap(c=>[c.x0,c.x1]),...plots.flatMap(c=>[c.x0,c.x1])])].sort((a,b)=>a-b),zs=[...new Set([base.z0,base.z1,...cuts.flatMap(c=>[c.z0,c.z1]),...plots.flatMap(c=>[c.z0,c.z1])])].sort((a,b)=>a-b),roadParts=[];
 for(let j=1;j<zs.length;j++)for(let i=1;i<xs.length;i++){const x0=xs[i-1],x1=xs[i],z0=zs[j-1],z1=zs[j],x=(x0+x1)/2,z=(z0+z1)/2;if(cuts.some(c=>x>c.x0&&x<c.x1&&z>c.z0&&z<c.z1))continue;const plot=plots.find(p=>x>p.x0&&x<p.x1&&z>p.z0&&z<p.z1),height=(x,z)=>plot?Math.min(ground(x,z),plot.floor-.35):ground(x,z);roadParts.push({...base,x0,x1,z0,z1,heights:[height(x0,z0),height(x0,z1),height(x1,z1),height(x1,z0)]});}
 const kept=parts.filter(p=>p!==base&&!claimed.has(p));
 return {parts:[...kept,...roadParts,...result],rows,width,carriagewayWidth:8-2*width,roadParts,heightAt:(x,z)=>{for(const r of rows){const u=r.axis==='z'?z:x,v=r.axis==='z'?x:z;if(u>=r.x0&&u<=r.x1&&v>=r.z0&&v<=r.z1){const s=r.sections.find(s=>u>=s.x0-EPS&&u<=s.x1+EPS);if(s)return s.y;}}return ground(x,z);}};
}
return {build};
});
