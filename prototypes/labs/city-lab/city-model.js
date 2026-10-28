(function(root){
  'use strict';
  const P=typeof module==='object'?require('../building-lab/plan.js'):root.BuildingPlan;
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
  const area=p=>p.reduce((s,a,i)=>s+cross(a,p[(i+1)%p.length]),0)/2;
  const normal=(a,b)=>{const d=sub(b,a),l=Math.hypot(...d);return [-d[1]/l,d[0]/l];};
  function contains(poly,p,margin=0){return poly.every((a,i)=>dot(sub(p,a),normal(a,poly[(i+1)%poly.length]))>=margin-1e-7);}
  function overlaps(a,b,gap=0){return ![a,b].some(poly=>poly.some((p,i)=>{const n=normal(p,poly[(i+1)%poly.length]),A=a.map(p=>dot(p,n)),B=b.map(p=>dot(p,n));return Math.max(...A)+gap<=Math.min(...B)+1e-7||Math.max(...B)+gap<=Math.min(...A)+1e-7;}));}
  function clip(poly,n,k){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],u=dot(a,n)-k,v=dot(b,n)-k;if(u>=0)out.push(a);if((u>=0)!==(v>=0)){const t=u/(u-v);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
  function height(x,z,terrain='flat'){return terrain==='flat'?0:.025*x+.035*z+1.8*Math.sin(x/45)*Math.cos(z/50);}
  function point(parcel,x,z){return [parcel.origin[0]+parcel.right[0]*x+parcel.inward[0]*z,parcel.origin[1]+parcel.right[1]*x+parcel.inward[1]*z];}
  const ROAD={avenue:6,street:3.5,lane:2.5,alley:2},FOOTWAY=1;
  function generate(seed=1,opts={}){
    seed=Number(seed)>>>0;const layout=opts.layout||'woven',scale=opts.width===undefined?1:Number(opts.width),terrain=opts.terrain||'flat',target=opts.count===undefined?24:Number(opts.count);
    if(!['woven','grid'].includes(layout)||!['flat','uneven'].includes(terrain)||![.75,1,1.25].includes(scale)||![24,100,1000].includes(target))throw new Error('Unsupported city settings');
    const N=target===1000?12:target===100?4:2,nodes=[],edges=[],blocks=[],parcels=[],edgeMap=new Map(),key=(a,b)=>[Math.min(a,b),Math.max(a,b)].join(':');
    const vertical=i=>i===N/2?'avenue':i%2?'street':'lane',horizontal=j=>j%2?'lane':'street',xs=[0],zs=[0];
    for(let i=0;i<N;i++){xs.push(xs[i]+(target===24?23.5:30.5)+(ROAD[vertical(i)]+ROAD[vertical(i+1)])*scale/2+FOOTWAY*2);zs.push(zs[i]+27+(ROAD[horizontal(i)]+ROAD[horizontal(i+1)])*scale/2+FOOTWAY*2);}
    const halfX=xs[N/2],halfZ=zs[N/2],phase=(seed%997)*.017;
    const xAt=(i,j)=>i===N/2?0:xs[i]-halfX+(layout==='woven'?Math.min(1,Math.abs(i-N/2)/2)*1.05*Math.sin(j*.79+i*.14+phase):0),
      zAt=(x,j)=>zs[j]-halfZ+(layout==='woven'&&j>0&&j<N&&j!==N/2?1.1*Math.sin(x*.035+j*.87+phase)-1.1*Math.sin(j*.87+phase):0),lines=[],lineNodes=[];
    for(let j=0;j<=N;j++){
      const line=Array.from({length:N+1},(_,i)=>xAt(i,j));
      lines.push(line);const ids=new Map();for(const x of line){const z=zAt(x,j),id=nodes.length;nodes.push({id,x,z,y:height(x,z,terrain)});ids.set(x,id);}lineNodes.push(ids);
    }
    const at=(i,j)=>lineNodes[j].get(xAt(i,j));
    const addEdge=(a,b,kind)=>{const id=edges.length,e={id,a,b,kind,width:ROAD[kind]*(kind==='alley'?1:scale),footway:kind==='alley'?0:FOOTWAY};edges.push(e);edgeMap.set(key(a,b),e);return e;};
    const across=[];for(let j=0;j<=N;j++){across[j]=[];for(let k=0;k<lines[j].length-1;k++)across[j].push(addEdge(lineNodes[j].get(lines[j][k]),lineNodes[j].get(lines[j][k+1]),horizontal(j)));}
    for(let j=0;j<N;j++)for(let i=0;i<=N;i++)addEdge(at(i,j),at(i,j+1),vertical(i));
    const acrossAt=(j,x)=>across[j].find(e=>nodes[e.a].x-1e-6<=x&&nodes[e.b].x+1e-6>=x);
    const plaza={x:0,z:0,r:4.5,y:0,polygon:[[-4.5,0],[0,-4.5],[4.5,0],[0,4.5]]},landmarks={gate:{x:0,z:halfZ+10},castle:{x:0,z:-halfZ-10},plaza};
    for(const [landmark,end] of [[landmarks.gate,at(N/2,N)],[landmarks.castle,at(N/2,0)]]){const id=nodes.length;nodes.push({id,x:landmark.x,z:landmark.z,y:height(landmark.x,landmark.z,terrain)});addEdge(end,id,'avenue');}
    const alleyEnds=new Map(),alleys=new Map();
    for(let j=0;j<N;j++){
      const z=zs[j]-halfZ+ROAD[horizontal(j)]*scale/2+FOOTWAY+12.5+ROAD.alley/2;
      for(let i=0;i<=N;i++){
        const a=at(i,j),b=at(i,j+1),e=edgeMap.get(key(a,b)),A=nodes[a],B=nodes[b],t=(z-A.z)/(B.z-A.z),x=A.x+(B.x-A.x)*t,id=nodes.length;
        nodes.push({id,x,z,y:height(x,z,terrain)});alleyEnds.set(i+':'+j,id);
        e.b=id;addEdge(id,b,e.kind);
      }
      for(let i=0;i<N;i++)alleys.set(i+':'+j,addEdge(alleyEnds.get(i+':'+j),alleyEnds.get((i+1)+':'+j),'alley'));
    }
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){
      const ids=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)],polygon=ids.map(id=>[nodes[id].x,nodes[id].z]),roads=[acrossAt(j,(nodes[ids[0]].x+nodes[ids[1]].x)/2),edgeMap.get(key(ids[1],ids[2])),acrossAt(j+1,(nodes[ids[2]].x+nodes[ids[3]].x)/2),edgeMap.get(key(ids[3],ids[0]))].map(e=>e.id),cx=(nodes[ids[0]].x+nodes[ids[1]].x)/2,cz=(zs[j]+zs[j+1])/2-halfZ;
      let buildable=polygon;for(let k=0;k<4;k++){const a=polygon[k],n=normal(a,polygon[(k+1)%4]);buildable=clip(buildable,n,dot(a,n)+edges[roads[k]].width/2+FOOTWAY);}
      if(Math.abs(i-N/2+.5)===.5&&Math.abs(j-N/2+.5)===.5)buildable=clip(buildable,[Math.sign(cx),Math.sign(cz)],plaza.r);
      const alley=alleys.get(i+':'+j),aa=nodes[alley.a],ab=nodes[alley.b],an=normal([aa.x,aa.z],[ab.x,ab.z]),ad=dot([aa.x,aa.z],an),regions=[clip(buildable,an.map(v=>-v),-ad+alley.width/2),clip(buildable,an,ad+alley.width/2)],alleyPolygon=clip(clip(buildable,an,ad-alley.width/2),an.map(v=>-v),-ad-alley.width/2);
      const block={id:blocks.length,nodes:ids,polygon,buildable,regions,alley:alley.id,alleyPolygon,roads,district:cx<0?(cz<0?'craft':'market'):(cz<0?'harbour':'residential')};blocks.push(block);
      // Opposing street-fronted rows, quantised in Building Lab's half-metre cells. Unused wedges,
      // rounding strips remain in the density denominator; only the public alley is removed.
      for(const side of [0,2]){
        const road=edges[roads[side]],a=polygon[side],b=polygon[(side+1)%4],inward=normal(a,b),right=[inward[1],-inward[0]],o=[a[0]+inward[0]*(road.width/2+FOOTWAY),a[1]+inward[1]*(road.width/2+FOOTWAY)],local=buildable.map(p=>[dot(sub(p,o),right),dot(sub(p,o),inward)]);
        const minX=Math.min(...local.map(p=>p[0])),maxX=Math.max(...local.map(p=>p[0])),total=Math.floor((maxX-minX-.8)*2)/2,n=Math.floor(total/7);
        let x=minX+.4;const widths=Array(n).fill(7);for(let k=1;k<n-1&&widths.reduce((s,w)=>s+w,0)+1<=total;k++)widths[k]+=.5;
        const row=[];
        for(let k=0;k<n;k++){
          const width=widths[k];let found=null;
          for(const setback of [0,.25,.5,.75,1,1.5,2,2.5,3]){
            for(const depth of [12.5,12,10.5,10,9.5]){
              if(setback+depth>12.55)continue;
              const p={id:parcels.length,seed:P.hash('house:'+seed+':'+block.id+':'+side+':'+k),block:block.id,district:block.district,origin:[o[0]+right[0]*x+inward[0]*setback,o[1]+right[1]*x+inward[1]*setback],right,inward,width,depth};
              const corner=layout==='woven'&&road.kind==='lane'&&depth>=12?{side:P.hash('corner:'+p.seed)%2?'left':'right',cut:.5+(P.hash('cut:'+p.seed)%2)*.5,length:2}:null;
              p.polygon=(corner?(corner.side==='left'?[[0,0],[width,0],[width,depth],[corner.cut,depth],[0,depth-corner.length]]:[[0,0],[width,0],[width,depth-corner.length],[width-corner.cut,depth],[0,depth]]):[[0,0],[width,0],[width,depth],[0,depth]]).map(([u,v])=>point(p,u,v));p.corner=corner;
              if(!p.polygon.every(c=>contains(regions[side===0?0:1],c))||parcels.some(q=>q.block===p.block&&overlaps(p.polygon,q.polygon)))continue;
              found=p;break;
            }if(found)break;
          }
          x+=width;if(!found)continue;const p=found,front=point(p,width/2,0),route=acrossAt(side===0?j:j+1,front[0]),A=nodes[route.a],B=nodes[route.b],d=sub([B.x,B.z],[A.x,A.z]),t=Math.max(0,Math.min(1,dot(sub(front,[A.x,A.z]),d)/dot(d,d)));p.road=route.id;
          p.roadY=A.y+(B.y-A.y)*t;p.padY=p.roadY+.15;p.type='home';p.style={craft:'fairytale',market:'spire',harbour:'harbour',residential:'fairytale'}[p.district];
          p.projection=Math.max(.5,Math.min(3,Math.floor((road.width+FOOTWAY*2-1.25)/2*2)/2)-((P.hash('projection:'+p.seed)%3)*.5));
          p.alley=alley.id;p.envelope={front:p.projection+.5,rear:.25,side:.25};
          p.options={type:p.type,style:p.style,typology:'rowhouse',storeys:3+P.hash('height:'+p.seed)%2,context:'terrace',party:[false,false],lot:'rect',projection:p.projection,parcel:{width,depth:p.depth,corner:p.corner},look:{roof:{turret:null},facade:{oriels:0}}};
          parcels.push(p);row.push(p);
        }
        for(let k=1;k<row.length;k++){const p=row[k-1],q=row[k],advance=dot(sub(q.origin,point(p,p.width,0)),p.right);if(Math.abs(advance)<1e-6){p.options.party[1]=true;q.options.party[0]=true;}}
      }
    }
    return {revision:'city-fixture-3',seed,layout,terrain,width:scale,target,extent:Math.max(halfX,halfZ)+32,footway:FOOTWAY,nodes,edges,blocks,parcels,landmarks,shortfall:Math.max(0,target-parcels.length),densityTarget:.8,alleyArea:blocks.reduce((s,b)=>s+area(b.alleyPolygon),0),buildableArea:blocks.reduce((s,b)=>s+b.regions.reduce((s,r)=>s+area(r),0),0)};
  }
  function density(city,summaries){const generated=Object.values(summaries),footprint=generated.reduce((s,p)=>s+(p.footprint||0),0),available=city.buildableArea;return {footprint,available,ratio:footprint/available,target:city.densityTarget,complete:generated.length===city.parcels.length,pass:generated.length===city.parcels.length&&footprint/available>=city.densityTarget};}
  function footprint(plan){return plan.plot.masks[0].reduce((s,v)=>s+v,0)*plan.cell*plan.cell;}
  function validate(city){const errors=[],seen=new Set([0]),q=[0];for(let i=0;i<q.length;i++)for(const e of city.edges){const j=e.a===q[i]?e.b:e.b===q[i]?e.a:null;if(j!==null&&!seen.has(j)){seen.add(j);q.push(j);}}
    if(seen.size!==city.nodes.length)errors.push('Disconnected road graph');
    for(const e of city.edges){const a=city.nodes[e.a],b=city.nodes[e.b];if(Math.abs(b.y-a.y)/Math.hypot(b.x-a.x,b.z-a.z)>.12)errors.push('Unsupported road slope '+e.id);}
    const byBlock=new Map();for(let i=0;i<city.parcels.length;i++){const p=city.parcels[i],block=city.blocks[p.block];if(!block.regions.some(r=>p.polygon.every(c=>contains(r,c))))errors.push('Parcel outside buildable region '+i);if(overlaps(p.polygon,block.alleyPolygon))errors.push('Parcel obstructs public alley '+i);for(const j of byBlock.get(p.block)||[])if(overlaps(p.polygon,city.parcels[j].polygon))errors.push('Overlapping parcels '+i+':'+j);if(!byBlock.has(p.block))byBlock.set(p.block,[]);byBlock.get(p.block).push(i);}
    return errors;
  }
  const api={generate,validate,height,point,contains,overlaps,area,footprint,density,ROAD};if(typeof module==='object'&&module.exports)module.exports=api;else root.CityModel=api;
})(typeof globalThis==='object'?globalThis:this);
