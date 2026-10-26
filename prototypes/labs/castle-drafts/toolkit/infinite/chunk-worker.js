self.window=self;
importScripts('../../castle-gen.js','../../castle-render.js','../pavement-plan.js','../town-kit.js','../street-edges.js','../interiors/content-kit.js','../interiors/interior-kit.js','world-plan.js');
const prototypes=new Map(),FLOORS={'ground-floor':70,'ground-floor-frame':60,'door-threshold':100,'display-pad':40,'work-yard':50};
// Keep the canonical roof silhouette and openings; collapse the wall bays into
// solid storeys and omit small shop stock, foliage, joinery and interior faces.
function distantParts(full,s){
 const M=TownKit.M,jet=s.variant==='house'?.55:.45,box=(x,y,z,w,h,d,col,pat=0)=>({t:'box',x,y,z,w,h,d,col,pat,noJitter:true});
 const parts=[box(0,-4.5,0,s.w,4.5,s.d,M.stone,4),box(0,0,0,s.w,3.2,s.d,M.stone,4),box(0,3.2,jet/2,s.w,3.2,s.d+jet,(full.find(p=>p.pat===11&&p.y>=3.2&&p.y<6)?.col||M.plaster),11)];
 for(const y of [3.05,6.25])parts.push(box(0,y,jet/2,s.w+.12,.17,s.d+jet+.12,M.timber));
 for(const x of [-s.w/2+.07,0,s.w/2-.07])for(const z of [-s.d/2-.04,s.d/2+jet+.04])parts.push(box(x,3.2,z,.14,3.05,.16,M.timber));
 for(const p of full){
  if(p.y>=6.35||p.y0>=6.35){parts.push(p);continue;}
  if(p.role!=='pane')continue;
  const rot=p.rot||0,nx=-Math.sin(rot),nz=Math.cos(rot),q={...p,x:p.x+nx*.12,z:p.z+nz*.12,d:.045,noJitter:true};parts.push(q);
  if(p.pat!==6)parts.push({...q,w:.075,col:M.timber,pat:0,x:q.x+nx*.035,z:q.z+nz*.035});
 }
 // A shop canopy is a large part of its street silhouette even at distance.
 parts.push(...full.filter(p=>p.t==='ramp'&&p.pat===10));
 return parts;
}
function prototypeFor(s,lod){const key=[lod,s.variant,s.shell,s.w,s.d,s.storeys,s.stairs,s.floorplan,s.upperPlan,!!s.closet,!!s.partyLeft,!!s.partyRight,...s.roofCol].join('|');if(prototypes.has(key)){const p=prototypes.get(key);prototypes.delete(key);prototypes.set(key,p);return p;}
 const b=TownInteriors.create({...s,x:0,z:0,rot:0,floor:0,includeInterior:false});let parts=b.parts;
 if(lod)parts=distantParts(b.parts,s);
 const m=CastleRender.meshParts(parts.filter(p=>FLOORS[p.role]==null),CastleGen.PALETTES[0]),p={b,packed:CastleRender.pack(m),p:new Float32Array(m.p),k:new Uint8Array(m.k)};prototypes.set(key,p);while(prototypes.size>32)prototypes.delete(prototypes.keys().next().value);return p;
}
function placed(proto,s){const packed={...proto.packed,buf:proto.packed.buf.slice(0)},f=new Float32Array(packed.buf),i8=new Int8Array(packed.buf),p=new Float32Array(proto.p.length),c=Math.cos(s.rot),n=Math.sin(s.rot);for(let v=0;v<packed.count;v++){const o=v*CastleRender.STRIDE,fo=o/4,x=f[fo],z=f[fo+2],nx=i8[o+12],nz=i8[o+14];f[fo]=s.x+x*c-z*n;f[fo+1]+=s.floor;f[fo+2]=s.z+x*n+z*c;i8[o+12]=Math.round(nx*c-nz*n);i8[o+14]=Math.round(nx*n+nz*c);p[v*3]=f[fo];p[v*3+1]=f[fo+1];p[v*3+2]=f[fo+2];}packed.c=[s.x+proto.packed.c[0]*c-proto.packed.c[2]*n,s.floor+proto.packed.c[1],s.z+proto.packed.c[0]*n+proto.packed.c[2]*c];return {packed,p,k:proto.k.slice()};}
// Distant blocks have no interactive geometry: one GPU batch preserves every
// vertex while replacing fourteen separate building draw submissions.
function batchPacked(meshes){
 const count=meshes.reduce((n,m)=>n+m.packed.count,0),buf=new ArrayBuffer(count*CastleRender.STRIDE),bytes=new Uint8Array(buf);let offset=0;
 for(const m of meshes){bytes.set(new Uint8Array(m.packed.buf),offset);offset+=m.packed.buf.byteLength;}
 const f=new Float32Array(buf),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let v=0;v<count;v++)for(let a=0;a<3;a++){const p=f[v*CastleRender.STRIDE/4+a];lo[a]=Math.min(lo[a],p);hi[a]=Math.max(hi[a],p);}
 return {packed:{buf,count,c:lo.map((p,a)=>(p+hi[a])/2),r:Math.hypot(...hi.map((p,a)=>p-lo[a]))/2,casts:true}};
}
function encoded(parts){const m=CastleRender.meshParts(parts,CastleGen.PALETTES[0]);return {packed:CastleRender.pack(m),p:new Float32Array(m.p),k:new Uint8Array(m.k)};}
function courtyardParts(plan,edges,lod){const c=plan.courtyard,y=c.level,low=Math.min(...[[c.x0,c.z0],[c.x0,c.z1],[c.x1,c.z1],[c.x1,c.z0]].map(p=>TownWorldPlan.height(...p)),y)-.5,parts=[{t:'surfacePatch',x0:c.x0,x1:c.x1,z0:c.z0,z1:c.z1,heights:[y,y,y,y],skirts:[0,1,2,3].map(edge=>({edge,t0:0,t1:1,lo0:low,lo1:low})),col:[.63,.61,.51],pat:3,sidePat:4,role:'courtyard-terrace'}];
 for(const gate of c.gates){const a=gate.side?gate.x1:gate.x0,b=gate.side?gate.x0:gate.x1,path=TownKit.path({x0:a,z0:plan.cz,x1:b,z1:plan.cz,y0:edges.heightAt(a,plan.cz),y1:y,w:1.6,ground:TownWorldPlan.height});parts.push(...path.parts.map(p=>({...p,role:'courtyard-access'})));}
 parts.push({t:'cyl',x:plan.cx,y,z:plan.cz,r:1.3,h:.28,col:TownKit.M.stone,role:'courtyard-fountain'},{t:'cyl',x:plan.cx,y:y+.28,z:plan.cz,r:1.1,h:.025,col:[.23,.49,.55],nocol:true,role:'courtyard-water'},{t:'cyl',x:plan.cx,y:y+.3,z:plan.cz,r:.16,h:1.1,col:TownKit.M.trim,role:'courtyard-fountain'});
 for(const a of [-1,1])for(const b of [-1,1]){const x=plan.cx+a*4.7,z=plan.cz+b*4.7;parts.push({t:'box',x,y,z,w:1.5,h:.4,d:1.5,col:TownKit.M.stone,pat:4,role:'courtyard-planter'},{t:'cyl',x,y:y+.4,z,r:.12,h:1.7,col:TownKit.M.timber,role:'courtyard-tree'},{t:'blob',x,y:y+2.3,z,rx:1.1,ry:1,rz:1.1,col:[.29,.45,.24],nocol:true,role:'courtyard-leaves'});}
 if(!lod)for(const side of [-1,1]){parts.push({t:'box',x:plan.cx,y:y+.45,z:plan.cz+side*5,w:2,h:.12,d:.45,col:TownKit.M.timber,role:'courtyard-bench'});for(const e of [-1,1])parts.push({t:'box',x:plan.cx+e*.75,y,z:plan.cz+side*5,w:.12,h:.45,d:.4,col:TownKit.M.timber,role:'courtyard-bench'});}
 return parts;}
onmessage=e=>{const {x,z,seed,lod,token}=e.data;try{const t=performance.now(),plan=TownWorldPlan.chunk(x,z,seed),items=[],bs=[],parts=[],g=TownWorldPlan.height,b=plan.bounds;parts.push({t:'surfacePatch',...b,heights:[g(b.x0,b.z0),g(b.x0,b.z1),g(b.x1,b.z1),g(b.x1,b.z0)],skirts:[],col:[.64,.61,.51],pat:3,role:'city-ground'});
 for(const s of plan.buildings){const proto=prototypeFor(s,lod),mesh=placed(proto,s),entry=TownInteriors.point(proto.b.entry,s),worldParts=TownKit.transform(proto.b.parts,s.x,s.floor,s.z,s.rot),floors=[];for(let i=worldParts.length-1;i>=0;i--)if(FLOORS[worldParts[i].role]!=null){const p=worldParts.splice(i,1)[0];floors.push(PavementPlan.source(p,FLOORS[p.role]));}if(floors.length)worldParts.push(...PavementPlan.build(floors,g).parts);bs.push({id:s.id,variant:s.variant,parts:worldParts,sockets:{door:entry},footprint:{x:s.x,z:s.z,w:Math.abs(Math.cos(s.rot))*s.w+Math.abs(Math.sin(s.rot))*s.d,d:Math.abs(Math.sin(s.rot))*s.w+Math.abs(Math.cos(s.rot))*s.d,floor:s.floor}});parts.push(...worldParts);items.push({spec:s,entry,mesh});}
 const edges=StreetEdges.build({blocks:[plan.block],buildings:bs,parts,ground:g,flattenPlots:true,extraCuts:[plan.courtyard,...plan.courtyard.gates]}),terrain=encoded([...edges.parts.filter(p=>p.t==='surfacePatch'),...courtyardParts(plan,edges,lod)]);
 let buildings;
 if(lod){buildings=batchPacked(items.map(item=>item.mesh));for(const item of items){item.lodVertices=item.mesh.packed.count;delete item.mesh;}delete terrain.p;delete terrain.k;}
 const out={key:plan.key,token,lod,x,z,bounds:plan.bounds,courtyard:plan.courtyard,items,terrain,buildings,ms:performance.now()-t,prototypeCount:prototypes.size};const transfer=[terrain.packed.buf];if(terrain.p)transfer.push(terrain.p.buffer,terrain.k.buffer);if(buildings)transfer.push(buildings.packed.buf);for(const i of items)if(i.mesh){transfer.push(i.mesh.packed.buf);if(i.mesh.p)transfer.push(i.mesh.p.buffer,i.mesh.k.buffer);}postMessage(out,transfer);
 }catch(error){postMessage({token,key:x+','+z,lod,error:error.stack||String(error)});}};
