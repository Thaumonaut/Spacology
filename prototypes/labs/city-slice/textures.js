// Procedural PBR texture sets for the city slice: for each surface kind, a tileable height field is painted (blocks,
// tiles, planks, flagstones...), then turned into an albedo detail map (near white, multiplied by the part's colour),
// a tangent-space normal map (Sobel on the height, wrapped) and a roughness map. tile: the world size one repeat covers
// (metres), used by the mesh converter for UVs. All generated at start-up in a few hundred ms; no image files.
import * as THREE from 'three/webgpu';

const N=512;
function rng(seed){let a=seed>>>0||1;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
// Tileable value noise on an N grid with period p cells.
function noise(p,seed){const R=rng(seed),g=new Float32Array(p*p).map(()=>R()),out=new Float32Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const fx=x/N*p,fy=y/N*p,i=Math.floor(fx),j=Math.floor(fy),u=fx-i,v=fy-j,su=u*u*(3-2*u),sv=v*v*(3-2*v),G=(a,b)=>g[((b+p)%p)*p+((a+p)%p)];
    out[y*N+x]=(G(i,j)*(1-su)+G(i+1,j)*su)*(1-sv)+(G(i,j+1)*(1-su)+G(i+1,j+1)*su)*sv;}return out;}
const fbm=(seed,ps=[4,8,16,32,64],ws=[.5,.25,.13,.07,.05])=>{const out=new Float32Array(N*N);ps.forEach((p,k)=>{const n=noise(p,seed+k*101);for(let i=0;i<N*N;i++)out[i]+=n[i]*ws[k];});return out;};
const sstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

// Rounded-rectangle blocks in courses: rows of height rh (in texture units 0..1), varied lengths, rounded corners,
// recessed joints. Returns {h, a (albedo factor), r (roughness), id}.
function blocks({rows,minLen,maxLen,joint,round,seed,stagger=.5,bevel=.35}){
  const R=rng(seed),h=new Float32Array(N*N),a=new Float32Array(N*N),r=new Float32Array(N*N),grain=fbm(seed+7),chip=fbm(seed+9,[16,32,64,128],[.5,.3,.15,.1]);
  const rowH=1/rows,course=[];for(let k=0;k<rows;k++){const cuts=[];let x=R()*stagger;while(x<1+maxLen){cuts.push(x);x+=minLen+R()*(maxLen-minLen);}course.push(cuts.map(c=>c%1).sort((p,q)=>p-q));}
  const tone=new Map();
  for(let y=0;y<N;y++){const fy=y/N,row=Math.floor(fy/rowH),ly=(fy-row*rowH)/rowH,cuts=course[row];
    for(let x=0;x<N;x++){const fx=x/N;let i=0;while(i<cuts.length&&cuts[i]<=fx)i++;const c0=i?cuts[i-1]:cuts[cuts.length-1]-1,c1=i<cuts.length?cuts[i]:cuts[0]+1,len=c1-c0,lx=(fx-c0)/len;
      // Distance to the block edge in texture units, corners rounded.
      const ex=Math.min(lx,1-lx)*len,ey=Math.min(ly,1-ly)*rowH,rr=round*rowH,qx=Math.max(rr-ex,0),qy=Math.max(rr-ey,0),d=rr-Math.hypot(qx,qy)+Math.min(Math.max(ex,ey)-rr,0)*0+Math.min(ex,ey)-Math.min(Math.min(ex,ey),rr);
      const edge=Math.min(ex,ey)-(qx>0&&qy>0?Math.hypot(qx,qy)-Math.min(qx,qy):0),key=row*1000+Math.round(c0*997);if(!tone.has(key))tone.set(key,R());
      const inside=sstep(joint*.5,joint,edge-chip[y*N+x]*joint*.9),dome=sstep(0,bevel*rowH,edge),k=y*N+x,t=tone.get(key);
      h[k]=inside*(.55+.45*dome)+(grain[k]-.5)*.12*inside;a[k]=inside?(.82+.26*t)*(.92+.16*grain[k]):.62;a[k]=a[k]*inside+.62*(1-inside);r[k]=.62+.25*inside+.1*(grain[k]-.5);}}
  return {h,a,r};}
function voronoi(cells,seed){const R=rng(seed),pts=[];for(let j=0;j<cells;j++)for(let i=0;i<cells;i++)pts.push([(i+.15+.7*R())/cells,(j+.15+.7*R())/cells,R()]);
  const h=new Float32Array(N*N),a=new Float32Array(N*N),r=new Float32Array(N*N),g=fbm(seed+3);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const px=x/N,py=y/N;let d1=9,d2=9,t=0;
    for(const [qx,qy,tt] of pts)for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const d=Math.hypot(px-qx-ox,py-qy-oy);if(d<d1){d2=d1;d1=d;t=tt;}else if(d<d2)d2=d;}
    const e=(d2-d1)*cells,k=y*N+x,inside=sstep(.04,.12,e),dome=sstep(.02,.35,e);h[k]=inside*(.5+.5*dome)+(g[k]-.5)*.1;a[k]=inside?(.8+.3*t)*(.9+.2*g[k]):.7;r[k]=.55+.3*inside;}
  return {h,a,r};}
function planks({count,seed}){const R=rng(seed),h=new Float32Array(N*N),a=new Float32Array(N*N),r=new Float32Array(N*N),g=noise(64,seed),fine=fbm(seed+5,[4,8,64,128],[.4,.2,.25,.15]),tones=Array.from({length:count},()=>R());
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const f=x/N*count,i=Math.floor(f),lx=f-i,k=y*N+x,seam=sstep(0,.05,lx)*sstep(1,.95,lx),grain=Math.sin((y/N*40+g[k]*6+i*3.1)*Math.PI*2)*.5+.5;
    h[k]=seam*(.7+.1*grain+.2*fine[k]);a[k]=(.78+.3*tones[i])*(.86+.14*grain)*(.6+.4*seam);r[k]=.7+.15*grain;}return {h,a,r};}
function roofTiles({rows,perRow,seed}){const R=rng(seed),h=new Float32Array(N*N),a=new Float32Array(N*N),r=new Float32Array(N*N),g=fbm(seed+2),tone=new Map();
  for(let y=0;y<N;y++){const fy=y/N*rows,row=Math.floor(fy),ly=fy-row;for(let x=0;x<N;x++){const fx=x/N*perRow+(row%2)*.5,col=Math.floor(fx),lx=fx-col,k=y*N+x,key=row*100+((col%perRow)+perRow)%perRow;if(!tone.has(key))tone.set(key,R());
    // Each tile: a rounded lower lip (y small = lower edge), slight arch across, a dark gap between tiles.
    const arch=Math.sin(lx*Math.PI),lip=sstep(0,.18,ly),gap=sstep(0,.06,lx)*sstep(1,.94,lx);h[k]=(.35+.5*ly+.15*arch)*gap*(.6+.4*lip)+(g[k]-.5)*.06;
    a[k]=(.78+.3*tone.get(key))*(.75+.25*lip)*(.7+.3*gap)*(.92+.16*g[k]);r[k]=.55+.25*g[k];}}return {h,a,r};}
function plaster(seed){const g=fbm(seed),fine=fbm(seed+11,[32,64,128,256],[.4,.3,.2,.1]),h=new Float32Array(N*N),a=new Float32Array(N*N),r=new Float32Array(N*N);
  for(let k=0;k<N*N;k++){h[k]=g[k]*.6+fine[k]*.4;a[k]=.9+.12*(g[k]-.5)*2+.05*(fine[k]-.5);r[k]=.85+.1*fine[k];}return {h,a,r};}
function grass(seed){const g=fbm(seed),fine=fbm(seed+3,[64,128,256],[.5,.3,.2]),h=new Float32Array(N*N),a=new Float32Array(N*N),r=new Float32Array(N*N);
  for(let k=0;k<N*N;k++){h[k]=fine[k];a[k]=.75+.35*g[k]+.15*(fine[k]-.5);r[k]=.95;}return {h,a,r};}

// Height + albedo + roughness to textures. strength: normal intensity.
function toTextures({h,a,r},strength,srgbTint=[1,1,1]){const alb=new Uint8Array(N*N*4),nrm=new Uint8Array(N*N*4),rough=new Uint8Array(N*N*4),H=(x,y)=>h[((y+N)%N)*N+((x+N)%N)];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const k=y*N+x,o=k*4,dx=(H(x+1,y-1)+2*H(x+1,y)+H(x+1,y+1)-H(x-1,y-1)-2*H(x-1,y)-H(x-1,y+1))*strength,dy=(H(x-1,y+1)+2*H(x,y+1)+H(x+1,y+1)-H(x-1,y-1)-2*H(x,y-1)-H(x+1,y-1))*strength,l=Math.hypot(dx,dy,1);
    for(let c=0;c<3;c++)alb[o+c]=Math.max(0,Math.min(255,Math.round(a[k]*srgbTint[c]*235)));alb[o+3]=255;
    nrm[o]=Math.round((-dx/l*.5+.5)*255);nrm[o+1]=Math.round((dy/l*.5+.5)*255);nrm[o+2]=Math.round((1/l*.5+.5)*255);nrm[o+3]=255;
    const rv=Math.round(Math.max(0,Math.min(1,r[k]))*255);rough[o]=rv;rough[o+1]=rv;rough[o+2]=rv;rough[o+3]=255;}
  const mk=(data,srgb)=>{const t=new THREE.DataTexture(data,N,N,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;};
  return {map:mk(alb,true),normalMap:mk(nrm,false),roughnessMap:mk(rough,false)};}

// Surface kinds keyed by the CastleRender pattern ids the kit uses (0 plain, 2 roof, 3 paving, 4 stone, 5/11 plaster,
// 6 wood, 7 grass, 10 awning stripes).
export function makeTextureSets(){const t0=performance.now(),S={};
  S.stone={tile:2.4,...toTextures(blocks({rows:5,minLen:.18,maxLen:.42,joint:.012,round:.28,seed:4}),9)};
  S.paving={tile:4,...toTextures(voronoi(7,31),7)};
  S.roof={tile:2.2,...toTextures(roofTiles({rows:6,perRow:7,seed:12}),6)};
  S.plaster={tile:3,...toTextures(plaster(5),2.5)};
  S.wood={tile:1.6,...toTextures(planks({count:8,seed:8}),4)};
  S.grass={tile:4,...toTextures(grass(17),3)};
  S.plain={tile:2,...toTextures(plaster(23),1)};
  S.ms=performance.now()-t0;return S;}
// Scanned CC0 sets (ambientCG, see textures/acg/SOURCES.md), stylised for cel shading at load: the colour map becomes a
// neutral detail map (luminance over its mean, contrast eased, softly banded) so the kit's vertex colours keep the hue;
// roughness is floored so nothing turns shiny. Normal maps are used as authored (OpenGL convention). tile: metres per
// repeat. Falls back to the procedural set for any kind that fails to load.
const ACG={stone:['Bricks066',2.6,.9],roof:['RoofingTiles006',2.4,1],paving:['PavingStones070',2.2,1],plaster:['Plaster001',2.5,.6],wood:['Planks023A',2,.8],grass:['Grass004',2.5,.8]};
async function pixels(url){const bmp=await createImageBitmap(await (await fetch(url)).blob()),c=new OffscreenCanvas(bmp.width,bmp.height),g=c.getContext('2d');g.drawImage(bmp,0,0);
  const d=g.getImageData(0,0,bmp.width,bmp.height),w=bmp.width,h=bmp.height,out=new Uint8Array(w*h*4);
  // Rows bottom-up, matching TextureLoader's flipY, so the normal map's green channel stays in the UV frame.
  for(let y=0;y<h;y++)out.set(d.data.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);return {data:out,w,h};}
function dataTex(data,w,h,srgb){const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;}
async function scanned(id,tile,normalScale){const base=new URL(`./textures/acg/${id}/`,import.meta.url);
  const [col,nrm,rgh]=await Promise.all(['Color','NormalGL','Roughness'].map(m=>pixels(new URL(m+'.jpg',base))));
  const n=col.w*col.h,L=new Float32Array(n);let mean=0;for(let i=0;i<n;i++){const o=i*4;L[i]=.2126*col.data[o]+.7152*col.data[o+1]+.0722*col.data[o+2];mean+=L[i];}mean/=n;
  for(let i=0;i<n;i++){const o=i*4;let a=Math.pow(L[i]/mean,.7);a=Math.min(1.08,Math.max(.5,a));const band=Math.round(a*7)/7;a=a*.6+band*.4;const v=Math.round(a*228);col.data[o]=col.data[o+1]=col.data[o+2]=v;col.data[o+3]=255;}
  for(let i=0;i<rgh.w*rgh.h;i++){const o=i*4,r=Math.max(178,rgh.data[o]);rgh.data[o]=rgh.data[o+1]=rgh.data[o+2]=r;}
  return {tile,normalScale,map:dataTex(col.data,col.w,col.h,true),normalMap:dataTex(nrm.data,nrm.w,nrm.h,false),roughnessMap:dataTex(rgh.data,rgh.w,rgh.h,false)};}
export async function loadTextureSets(){const t0=performance.now(),S=makeTextureSets();
  await Promise.all(Object.entries(ACG).map(async([k,[id,tile,ns]])=>{try{S[k]=await scanned(id,tile,ns);S[k].source=id;}catch(e){console.warn('texture '+id+' failed, using procedural',e);}}));
  S.ms=performance.now()-t0;return S;}
export const PATTERN_KIND={0:'plain',1:'plaster',2:'roof',3:'paving',4:'stone',5:'plaster',6:'wood',7:'grass',8:'plaster',9:'plaster',10:'plain',11:'plaster'};
