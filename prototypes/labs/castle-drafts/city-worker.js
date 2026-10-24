// City tile builder, off the main thread. Each worker generates the same city as the page (generation is deterministic
// from seed and options), files it into the same 160 m tiles and 40 m kit cells, then builds meshes on request:
//   static:<tile>  ground, streets, walls, quays    ext:<tile>  building shells (vertex B = building id + 1)
//   props:<tile>   stalls, lanterns, people, trees  kit:<cell>  town-kit buildings of one cell
// Replies with the packed vertex buffer (CastleRender.pack) and the solid triangles for the walker's collider.
self.window=self;
importScripts('castle-gen.js','castle-render.js','city-gen.js','toolkit/pavement-plan.js','toolkit/town-kit.js','../microvoxel-world/macro-map.js','../microvoxel-world/voxel-world-model.js');
const TILE=160,KIT_CELL=40,tkey=(x,z)=>Math.floor(x/TILE)+','+Math.floor(z/TILE),kcell=b=>Math.floor(b.x/KIT_CELL)+','+Math.floor(b.z/KIT_CELL);
const KIT_MAP={house:'HOME',shop:'STORE',inn:['inn'],smithy:['smithy'],warehouse:['warehouse'],towerhouse:['towerhouse'],shack:'SLUM',barracks:['house'],chapel:['chapel'],bath:['house']};
const KIT_ROOFS=[[.34,.4,.4],[.43,.29,.24],[.31,.4,.33],[.29,.34,.43],[.62,.3,.24]];
let city=null,tiles=null,kitByCell=null,treeWorld=null;
function kitVariant(b){const pool=KIT_MAP[b.type],list=pool==='HOME'?TownKit.HOME_KINDS.filter(v=>!TownKit.COMPOUND_KINDS.includes(v)):pool==='STORE'?TownKit.STORE_KINDS:pool==='SLUM'?TownKit.SLUM_KINDS:pool;return list[b.seed%list.length];}
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255),MATC=i=>hex(MicroWorld.COLORS[i]||'#558855');
function worldTree(p){if(!treeWorld)treeWorld=MicroWorld.createWorld(1,.25,'infinite');const {parts:T}=treeWorld.growTreeParts(p.species,p.x,p.z,p.y,{k:.85*(p.size||1),cls:1}),out=[];
  for(let i=0;i<T.segs.length;i+=10){const [x0,y0,z0,r0,x1,y1,z1,r1,mat]=T.segs.slice(i,i+10);out.push({t:'beam',x0,y0,z0,x1,y1,z1,s:Math.max(.2,r0+r1),col:MATC(mat),nocol:true});}
  for(let i=0;i<T.lobes.length;i+=6){const [x,y,z,r,ys,mat]=T.lobes.slice(i,i+6);out.push({t:'blob',x,y,z,rx:r,ry:r*ys,rz:r,col:MATC(mat),nocol:true});}
  for(let i=0;i<T.tiers.length;i+=8){const [x,z,top,bot,r,,,mat]=T.tiers.slice(i,i+8);out.push({t:'cone',x,y:bot,z,r,h:top-bot,col:MATC(mat),nocol:true});}
  return out;}
const withTrees=parts=>parts.some(p=>p.t==='tree')?parts.flatMap(p=>p.t==='tree'?worldTree(p):[p]):parts;
function build(kind,key){const m=new CastleRender.Mesh(),pal=city.palette;
  if(kind==='static')CastleRender.meshParts((tiles.get(key)||{s:[]}).s,pal,0,0,m);
  else if(kind==='ext'){for(const b of (tiles.get(key)||{b:[]}).b){const f=m.p.length/3;m.bid=b.id+1;CastleRender.meshParts(CityGen.buildingParts(b,false),pal,0,0,m);if(b.type!=='cathedral'&&!b.hero)CastleRender.wonk(m,f,b);}m.bid=0;}
  else if(kind==='props'){for(const p of (tiles.get(key)||{p:[]}).p)CastleRender.meshParts(withTrees(p.parts),pal,0,0,m);}
  else if(kind==='kit'){for(const id of kitByCell.get(key)||[]){const b=city.buildings[id],v=kitVariant(b),T=TownKit.TYPES[v]||{},rot=b.rot+(b.doorSide<0?Math.PI:0),c=Math.cos(rot),s=Math.sin(rot),dk=Math.min(b.d,T.d?Math.max(T.d,b.d*.8):b.d);
      const ground=(lx,lz)=>city.gy(b.x+lx*c-lz*s,b.z+lx*s+lz*c);let k;
      try{k=TownKit.building({...T,id:'c'+id,variant:v,x:0,z:(b.d-dk)/2,w:b.w,d:dk,storeys:Math.max(T.storeys||2,Math.min(4,b.storeys.length)),floor:b.floor,ground,roofCol:KIT_ROOFS[b.seed%KIT_ROOFS.length]});}catch(e){continue;}
      m.bid=0;CastleRender.meshParts(TownKit.transform(k.parts.filter(p=>p.t!=='surfacePatch'),b.x,0,b.z,rot),pal,0,0,m);}}
  // Solid triangles for collision (kit buildings collide through their shells, so none are sent for them).
  let n=0;if(kind!=='kit')for(let t=0;t<m.k.length;t++)if(m.k[t])n++;const tris=new Float32Array(n*9);
  if(kind!=='kit'){let o=0;for(let t=0;t<m.k.length;t++)if(m.k[t]){for(let a=0;a<9;a++)tris[o++]=m.p[t*9+a];}}
  return {packed:CastleRender.pack(m),tris};}
onmessage=e=>{const d=e.data;
  if(d.init){city=CityGen.generate(d.seed,d.opts);tiles=new Map();const T=k=>{if(!tiles.has(k))tiles.set(k,{b:[],p:[],s:[]});return tiles.get(k);};
    for(const b of city.buildings)T(tkey(b.x,b.z)).b.push(b);for(const p of city.props)T(tkey(p.x,p.z)).p.push(p);
    for(const p of city.parts){const x=p.x??p.x0??p.cx??0,z=p.z??p.z0??p.cz??0;T(tkey(x,z)).s.push(p);}
    kitByCell=new Map();for(const b of city.buildings)if(KIT_MAP[b.type]&&!b.hero){const k=kcell(b);if(!kitByCell.has(k))kitByCell.set(k,[]);kitByCell.get(k).push(b.id);}
    postMessage({ready:true,seed:d.seed,buildings:city.buildings.length});return;}
  const t0=performance.now(),r=build(d.kind,d.key);
  postMessage({id:d.id,kind:d.kind,key:d.key,seed:city.seed,ms:performance.now()-t0,packed:r.packed,tris:r.tris},[r.packed.buf,r.tris.buffer]);};
