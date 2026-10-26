(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../shape-study/plot-plan.js'));else root.DenseCityPlan=factory(root.PlotShapeStudy);})(typeof globalThis!=='undefined'?globalThis:this,function(P){
'use strict';
function random(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function height(x,z,relief=1){return relief*(.012*x+1.5*Math.sin(x/43)+.8*Math.sin(z/51));}
function make({seed=45256,blocks=3,relief=1}={}){if(!Number.isInteger(blocks)||blocks<1||blocks>6)throw Error('Invalid district size');const rng=random(seed),BW=36,ROW=16,GAP=3,STREET=4.5,BZ=ROW*2+GAP,lots=[],blockPlans=[];
 for(let bz=0;bz<blocks;bz++)for(let bx=0;bx<blocks;bx++){const ox=bx*(BW+STREET),oz=bz*(BZ+STREET),id=bx+','+bz,block={id,x:ox,z:oz,w:BW,d:BZ,lots:[]};
  for(let side=0;side<2;side++){const weights=Array.from({length:5},()=>6.5+rng()*1.3),sum=weights.reduce((a,b)=>a+b),xs=[0];for(const w of weights)xs.push(xs.at(-1)+w/sum*BW);const skew=xs.map((_,i)=>i===0||i===5?0:(rng()-.5)*.7),rear=xs.map(()=>ROW+(rng()-.5)*.5);
   for(let i=0;i<5;i++){const worldPoly=[[xs[i],0],[xs[i+1],0],[xs[i+1]+skew[i+1],rear[i+1]],[xs[i]+skew[i],rear[i]]],minX=Math.min(...worldPoly.map(p=>p[0])),maxX=Math.max(...worldPoly.map(p=>p[0])),depth=Math.max(...worldPoly.map(p=>p[1])),poly=worldPoly.map(p=>[p[0]-minX,p[1]]),width=maxX-minX,form=['oriel','bay','stepped','turret','tower'][Math.floor(rng()*5)],storeys=2+Math.floor(rng()*3),frontageEdges=[0,2];if(i===0)frontageEdges.push(3);if(i===4)frontageEdges.push(1);if(rng()<.25)frontageEdges.push(2);
    const plan=P.make({width,depth,storeys,form,plot:'custom',character:'whimsical',parcelOverride:poly,frontageEdges,density:'packed',streetProjection:.8,entranceEdge:0});plan.roofType=['swept','cross','mansard','gambrel','hip'][Math.floor(rng()*5)];
    const rotation=side?Math.PI:0,x=side?ox+BW-minX:ox+minX,z=side?oz+BZ:oz,toWorld=p=>side?[x-p[0],z-p[1]]:[x+p[0],z+p[1]],parcel=plan.parcel.map(toWorld),samples=[...parcel,...plan.floors[0].loops.flatMap(l=>l.map(toWorld))],base=Math.max(...samples.map(p=>height(...p,relief)))+.07,route=plan.access.path.map(toWorld);let rise,steps;for(let k=0;k<8;k++){rise=base+.015-height(...route[0],relief);steps=Math.max(1,Math.ceil(rise/.18));const dx=route[1][0]-route[0][0],dz=route[1][1]-route[0][1],len=Math.hypot(dx,dz),extra=Math.max(0,steps*.26-len);if(extra<1e-5)break;route[0]=[route[0][0]-dx/len*extra,route[0][1]-dz/len*extra];}const lot={id:`${bx}-${bz}-${side}-${i}`,block:id,plan,x,z,rotation,base,parcel,footprints:plan.floors[0].loops.map(l=>l.map(toWorld)),route,steps,rise,palette:Math.floor(rng()*3)};lots.push(lot);block.lots.push(lot.id);
   }
  }blockPlans.push(block);
 }
 return {seed,blocks,relief,lots,blockPlans,bounds:{x0:-STREET,z0:-STREET,x1:blocks*BW+(blocks-1)*STREET+STREET,z1:blocks*BZ+(blocks-1)*STREET+STREET},streetWidth:STREET,blockWidth:BW,blockDepth:BZ,courtyardGap:GAP};
}
function contains(p,poly){return P.inside(p,poly);}
return {make,height,contains};
});
