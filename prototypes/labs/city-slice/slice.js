// City vertical slice: one town-kit city block area rendered with three.js (WebGPU, falling back to WebGL2), at the
// quality bar we want to scale: PBR materials from procedural texture sets, a sun with cascaded shadow maps, sky and
// image-based fill, ground-truth AO, bloom, AgX tone mapping and SMAA. Every ordinary building can be entered: its
// door swings open as you approach and its interior (interiors.js) streams in, with warm lights.
// The city comes from TownKitCity (toolkit/city-kit.js); the slice only renders and streams it, so the same pipeline
// can render a city generated anywhere in the world.
import * as THREE from 'three/webgpu';
import {pass,mrt,output,normalView,vec4,uniform,float,mix,vertexColor,texture,uv,positionWorld,smoothstep} from 'three/tsl';
import {ao} from 'three/addons/tsl/display/GTAONode.js';
import {bloom} from 'three/addons/tsl/display/BloomNode.js';
import {smaa} from 'three/addons/tsl/display/SMAANode.js';
import {CSMShadowNode} from 'three/addons/csm/CSMShadowNode.js';
import {SkyMesh} from 'three/addons/objects/SkyMesh.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {makeTextureSets,loadTextureSets} from './textures.js';
import {partsToGroups,groupsToMeshes} from './convert.js';
import {interior} from './interiors.js';

const $=id=>document.getElementById(id),Q=new URLSearchParams(location.search),status=t=>{$('status').textContent=t;};
const stats={chunks:0,interiors:0,lights:0,buildMs:0};window.CitySlice={stats,ready:false};
const renderer=new THREE.WebGPURenderer({antialias:false,forceWebGL:Q.get('webgl')==='1'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;document.body.appendChild(renderer.domElement);
await renderer.init();const backend=renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2';

// ---- Scene, sky, light.
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,2400);
const sky=new SkyMesh();sky.scale.setScalar(4000);sky.turbidity.value=3;sky.rayleigh.value=1.2;sky.mieCoefficient.value=.004;sky.mieDirectionalG.value=.8;scene.add(sky);
const sunDir=new THREE.Vector3().setFromSphericalCoords(1,THREE.MathUtils.degToRad(52),THREE.MathUtils.degToRad(215));sky.sunPosition.value.copy(sunDir);
const sun=new THREE.DirectionalLight(0xfff1dc,3.2);sun.position.copy(sunDir).multiplyScalar(300);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;
const csm=new CSMShadowNode(sun,{cascades:4,maxFar:260,mode:'practical',lightMargin:80});csm.fade=true;sun.shadow.shadowNode=csm;scene.add(sun,sun.target);
scene.add(new THREE.HemisphereLight(0xbcd6ff,0x6b5a45,.55));
{const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.35;}
scene.fog=new THREE.Fog(0xc9d8e6,120,900);

// ---- Materials: one PBR material per surface kind; vertex colour tints the albedo detail map.
// Scanned CC0 sets by default (textures/acg); ?tex=proc keeps the procedural ones.
const T=Q.get('tex')==='proc'?makeTextureSets():await loadTextureSets(),materials={};
for(const k of ['stone','paving','roof','plaster','wood','grass','plain']){const t=T[k],m=new THREE.MeshStandardNodeMaterial({map:t.map,normalMap:t.normalMap,roughnessMap:t.roughnessMap,vertexColors:true,metalness:0});
  m.normalScale=new THREE.Vector2(t.normalScale??1,t.normalScale??1);materials[k]=m;}
materials.glow=new THREE.MeshStandardNodeMaterial({vertexColors:true,emissive:0xffb85a,emissiveIntensity:2.2,roughness:.4});

// ---- City data and chunked meshes (32 m cells). Door panes of ground-floor doors are pulled out as separate,
// swinging doors.
const t0=performance.now(),city=window.TownKitCity.build({grade:+(Q.get('grade')||.03)}),pal=window.CastleGen.PALETTES[0];
const doorOf=new Map(),doors=[];
for(const b of city.buildings){const s=b.sockets&&b.sockets.door;if(!s||window.TownKit.COMPOUND_KINDS.includes(b.variant))continue;doorOf.set(b.id,s);}
const isDoorPane=p=>{if(p.role!=='pane'||p.pat!==6)return null;for(const b of city.buildings){const s=doorOf.get(b.id);if(s&&Math.abs(p.x-s.x)<.9&&Math.abs(p.z-s.z)<.6&&Math.abs(p.y-s.y)<.3)return b;}return null;};
const CELL=32,cells=new Map(),key=(x,z)=>Math.floor(x/CELL)+','+Math.floor(z/CELL);
for(const p of city.parts){const b=isDoorPane(p);if(b){doors.push({b,p});continue;}const x=p.x??(p.x0!=null?(p.x0+p.x1)/2:0),z=p.z??(p.z0!=null?(p.z0+p.z1)/2:0),k=key(x,z);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(p);}
const colliders=new Map(),cellSolids=new Map();
for(const [k,parts] of cells){const {groups,solids}=partsToGroups(parts,pal,T);for(const m of groupsToMeshes(groups,materials))scene.add(m);cellSolids.set(k,solids);stats.chunks++;}
// Ground beyond the block, just under the lowest city part (a fixed height cut through low ground floors).
{let gy=1e9;for(const p of city.parts)if(isFinite(p.y))gy=Math.min(gy,p.y);const g=new THREE.Mesh(new THREE.PlaneGeometry(3000,3000).rotateX(-Math.PI/2).translate(0,gy-.05,0),materials.grass);g.geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(4*3).fill(.32),3));
  const uvs=g.geometry.attributes.uv;for(let i=0;i<uvs.count;i++)uvs.setXY(i,uvs.getX(i)*750,uvs.getY(i)*750);g.receiveShadow=true;scene.add(g);}
// Doors: each a hinged leaf pivoting on its left edge.
for(const d of doors){const {groups}=partsToGroups([{...d.p,x:d.p.w/2,y:0,z:0,rot:0}],pal,T),pivot=new THREE.Group();for(const m of groupsToMeshes(groups,materials))pivot.add(m);
  pivot.position.set(d.p.x-Math.cos(d.p.rot||0)*d.p.w/2,d.p.y,d.p.z-Math.sin(d.p.rot||0)*d.p.w/2);pivot.rotation.y=-(d.p.rot||0);d.pivot=pivot;d.open=0;scene.add(pivot);}
stats.buildMs=Math.round(performance.now()-t0);

// ---- Walking: the CastleWalk collider over the cell solids near the player (made lazily), plus loaded interiors.
const walkerCol=()=>{const near=[];const cx=Math.floor(player.x/CELL),cz=Math.floor(player.z/CELL);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const k=(cx+i)+','+(cz+j);if(!cellSolids.has(k))continue;
    if(!colliders.has(k)){const s=cellSolids.get(k);colliders.set(k,new window.CastleWalk.Collider({p:s,k:new Uint8Array(s.length/9).fill(1),id:[]}));}near.push(colliders.get(k));}
  for(const it of loaded.values())near.push(it.col);return new window.CastleWalk.Multi(near);};
const loaded=new Map();let player=null;
const spawn=city.spawn;player=new window.CastleWalk.Walker({floor:()=>spawn.y,ray:()=>1e9},spawn);player.x=spawn.x;player.z=spawn.z;player.y=spawn.y;player.yaw=spawn.yaw;player.col=walkerCol();
{const f=player.col.floor(player.x,player.y+30,player.z,0);if(isFinite(f))player.y=f;}

// ---- Interiors: generated for buildings whose door is within 22 m, dropped beyond 40 m. Real lights: the 6 interior
// light points nearest the player.
const lightPool=[];for(let i=0;i<6;i++){const l=new THREE.PointLight(0xffb070,0,12,1.6);scene.add(l);lightPool.push(l);}
function updateInteriors(){for(const b of city.buildings){const s=doorOf.get(b.id);if(!s)continue;const d=Math.hypot(s.x-player.x,s.z-player.z);
    if(d<22&&!loaded.has(b.id)){const tb=window.TownKit.TYPES[b.variant]||{},fp=b.footprint,front=Math.sign(s.z-fp.z)||1,{parts,lights}=interior({id:b.id,variant:b.variant,footprint:fp,front,storeys:tb.storeys||2,storeyHeight:b.storeyHeight});
      const {groups,solids}=partsToGroups(parts,pal,T),meshes=groupsToMeshes(groups,materials);for(const m of meshes)scene.add(m);
      loaded.set(b.id,{meshes,lights,col:new window.CastleWalk.Collider({p:solids,k:new Uint8Array(solids.length/9).fill(1),id:[]})});stats.interiors++;}
    else if(d>40&&loaded.has(b.id)){const it=loaded.get(b.id);for(const m of it.meshes){scene.remove(m);m.geometry.dispose();}loaded.delete(b.id);}}
  const pts=[];for(const it of loaded.values())pts.push(...it.lights);pts.sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y,a.z-player.z)-Math.hypot(b.x-player.x,b.y-player.y,b.z-player.z));
  lightPool.forEach((l,i)=>{const p=pts[i];if(!p){l.intensity=0;return;}l.position.set(p.x,p.y,p.z);l.intensity=(p.i||1)*6;l.color.setRGB(...(p.c||[1,.7,.42]));});stats.lights=Math.min(6,pts.length);}

// ---- Post: one scene pass with normals (MRT) -> GTAO on the ambient term approximation, bloom, SMAA.
const pipeline=new THREE.RenderPipeline(renderer),scenePass=pass(scene,camera);scenePass.setMRT(mrt({output,normal:normalView}));
const col=scenePass.getTextureNode('output'),nrm=scenePass.getTextureNode('normal'),dep=scenePass.getTextureNode('depth');
const aoPass=ao(dep,nrm,camera);aoPass.resolutionScale=.5;aoPass.radius.value=.6;aoPass.thickness.value=.8;
const lit=vec4(col.rgb.mul(mix(float(1),aoPass.getTextureNode().r,.85)),col.a),glow=bloom(lit,.35,.4,.92);
pipeline.outputNode=Q.get('post')==='0'?col:smaa(lit.add(glow));

// ---- Controls: pointer-lock mouse look, WASD, Shift run, Space jump; doors open within 3 m.
const keys={};addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space')e.preventDefault();});addEventListener('keyup',e=>keys[e.code]=false);
renderer.domElement.addEventListener('click',()=>renderer.domElement.requestPointerLock());
addEventListener('mousemove',e=>{if(document.pointerLockElement!==renderer.domElement)return;player.yaw+=e.movementX*.0022;player.pitch=Math.max(-1.45,Math.min(1.45,player.pitch-e.movementY*.0022));});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let last=performance.now(),acc=0,frames=0,fps=0,lastCell='',lastInt=0;
function step(dt){player.keys={w:keys.KeyW||keys.ArrowUp,s:keys.KeyS||keys.ArrowDown,a:keys.KeyA,d:keys.KeyD,shift:keys.ShiftLeft||keys.ShiftRight,space:keys.Space};
  const ck=key(player.x,player.z);if(ck!==lastCell||performance.now()-lastInt>500){lastCell=ck;lastInt=performance.now();updateInteriors();player.col=walkerCol();}
  player.update(dt);for(const d of doors){const s=doorOf.get(d.b.id),want=Math.hypot(s.x-player.x,s.z-player.z)<3?1:0;d.open+=(want-d.open)*Math.min(1,dt*5);d.pivot.rotation.y=-(d.p.rot||0)-d.open*1.45;}
  const c=player.camera();camera.position.set(c.eye[0],c.eye[1],c.eye[2]);camera.lookAt(c.eye[0]+Math.cos(c.pitch)*Math.cos(c.yaw),c.eye[1]+Math.sin(c.pitch),c.eye[2]+Math.cos(c.pitch)*Math.sin(c.yaw));}
async function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;step(dt);pipeline.render();acc+=dt;frames++;if(acc>=.5){fps=Math.round(frames/acc);acc=0;frames=0;
    status(`${backend} · ${fps} fps · ${renderer.info.render.drawCalls} draws · ${(renderer.info.render.triangles/1e6).toFixed(2)}M tris · ${stats.chunks} cells · ${loaded.size} interiors · ${stats.lights} lights · city ${stats.buildMs} ms`);}
  requestAnimationFrame(frame);}
// Headless helpers: place the player, render a frame, read stats.
window.CitySlice={...window.CitySlice,stats,city,place:(x,z,yaw,pitch=0)=>{player.x=x;player.z=z;player.yaw=yaw;player.pitch=pitch;updateInteriors();player.col=walkerCol();const f=player.col.floor(x,player.y+30,z,0);if(isFinite(f))player.y=f;step(0);},
  walk:(sec,k={w:true})=>{for(let i=0;i<sec*30;i++){Object.assign(keys,{KeyW:k.w,KeyA:k.a,KeyD:k.d,KeyS:k.s});step(1/30);}for(const c in keys)keys[c]=false;return {x:player.x,y:player.y,z:player.z};},
  render:()=>pipeline.render(),info:()=>({backend,draws:renderer.info.render.drawCalls,tris:renderer.info.render.triangles,interiors:loaded.size,lights:stats.lights,buildMs:stats.buildMs,textureMs:Math.round(T.ms)}),player:()=>player,doors:()=>doors.map(d=>({id:d.b.id,x:doorOf.get(d.b.id).x,z:doorOf.get(d.b.id).z,front:Math.sign(doorOf.get(d.b.id).z-d.b.footprint.z)})),ready:true};
step(0);requestAnimationFrame(frame);
