'use strict';
// Grid I/O and shaded-relief rendering shared by the study scripts.
const fs=require('node:fs'),path=require('node:path'),{DATA}=require('./areas.cjs'),{encode}=require('./png.cjs');
const GRIDS=path.join(DATA,'grids');
function load(name){const meta=JSON.parse(fs.readFileSync(path.join(GRIDS,name+'.json'),'utf8')),b=fs.readFileSync(path.join(GRIDS,name+'.f32'));
  const extra=k=>{const f=path.join(GRIDS,name+'.'+k+'.f32');if(!fs.existsSync(f))return null;const e=fs.readFileSync(f);return new Float32Array(e.buffer,e.byteOffset,e.length/4);};
  return {...meta,h:new Float32Array(b.buffer,b.byteOffset,b.length/4),cone:extra('cone'),relief:extra('relief')};}
// Crop/resample a grid to a centred square of `km` at `step` m (bilinear); used to compare like-for-like windows.
function crop(G,km,step=G.step,cx=0,cz=0){
  const n=Math.round(km*1000/step),half=(n-1)/2*step,c=(G.n-1)/2,h=new Float32Array(n*n);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const X=c+(cx-half+i*step)/G.step,Y=c+(cz-half+j*step)/G.step,ix=Math.max(0,Math.min(G.n-2,Math.floor(X))),iy=Math.max(0,Math.min(G.n-2,Math.floor(Y))),u=X-ix,v=Y-iy,H=G.h,N=G.n;
    h[j*n+i]=(H[iy*N+ix]*(1-u)+H[iy*N+ix+1]*u)*(1-v)+(H[(iy+1)*N+ix]*(1-u)+H[(iy+1)*N+ix+1]*u)*v;}
  return {...G,n,step,km,h};
}
// Hillshade (sun NW, 45 deg up) blended with a hypsometric tint (low green -> brown -> grey -> white), RGB bytes.
function shade(G,{z=1.5,lo=null,hi=null}={}){
  const {n,step,h}=G,rgb=new Uint8Array(n*n*3);let a=Infinity,b=-Infinity;for(const v of h)if(v===v){a=Math.min(a,v);b=Math.max(b,v);}
  lo=lo??a;hi=hi??b;const az=315*Math.PI/180,al=45*Math.PI/180,lx=Math.sin(az)*Math.cos(al),ly=Math.cos(az)*Math.cos(al),lz=Math.sin(al);
  const ramp=[[0,[110,150,95]],[.25,[170,180,120]],[.5,[175,150,110]],[.75,[160,155,150]],[1,[245,245,245]]];
  const at=(i,j)=>{const v=h[Math.max(0,Math.min(n-1,j))*n+Math.max(0,Math.min(n-1,i))];return v===v?v:lo;};
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const dx=(at(i+1,j)-at(i-1,j))/(2*step)*z,dy=(at(i,j+1)-at(i,j-1))/(2*step)*z,L=Math.hypot(dx,dy,1);
    // Grid rows run south, so the normal in (east, north, up) is (-dx, dy, 1).
    let s=(-dx*lx+dy*ly+lz)/L;s=Math.max(0,s);
    const t=Math.max(0,Math.min(1,(at(i,j)-lo)/((hi-lo)||1)));let k=0;while(k<ramp.length-2&&t>ramp[k+1][0])k++;
    const f=(t-ramp[k][0])/(ramp[k+1][0]-ramp[k][0]),c=ramp[k][1].map((v,q)=>v+(ramp[k+1][1][q]-v)*f),sh=.25+.95*s,p=(j*n+i)*3;
    for(let q=0;q<3;q++)rgb[p+q]=Math.max(0,Math.min(255,c[q]*sh));}
  return {w:n,h:n,rgb};
}
// Lay images side by side with a gap; each image is {w,h,rgb}. Pads to the tallest.
function sideBySide(imgs,gap=8){const W=imgs.reduce((s,m)=>s+m.w,0)+gap*(imgs.length-1),H=Math.max(...imgs.map(m=>m.h)),rgb=new Uint8Array(W*H*3).fill(255);
  let x0=0;for(const m of imgs){for(let y=0;y<m.h;y++)rgb.set(m.rgb.subarray(y*m.w*3,(y+1)*m.w*3),(y*W+x0)*3);x0+=m.w+gap;}return {w:W,h:H,rgb};}
// Nearest-neighbour downscale to at most `max` pixels on a side (keeps files small).
function fit(img,max){if(img.w<=max&&img.h<=max)return img;const k=max/Math.max(img.w,img.h),w=Math.round(img.w*k),h=Math.round(img.h*k),rgb=new Uint8Array(w*h*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(img.w-1,Math.floor(x/k)),sy=Math.min(img.h-1,Math.floor(y/k));for(let q=0;q<3;q++)rgb[(y*w+x)*3+q]=img.rgb[(sy*img.w+sx)*3+q];}return {w,h,rgb};}
// Greyscale copy (luma) for small committed images.
function grey(img){const g=new Uint8Array(img.w*img.h);for(let k=0;k<g.length;k++)g[k]=Math.round(.3*img.rgb[k*3]+.59*img.rgb[k*3+1]+.11*img.rgb[k*3+2]);return {w:img.w,h:img.h,grey:g};}
function writePNG(file,img){fs.mkdirSync(path.dirname(file),{recursive:true});const b=img.grey?encode(img.w,img.h,img.grey,1):encode(img.w,img.h,img.rgb);fs.writeFileSync(file,b);return b.length;}
module.exports={GRIDS,load,crop,shade,sideBySide,fit,grey,writePNG};
