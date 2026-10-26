#!/usr/bin/env node
'use strict';
// Download AWS Terrain Tiles (Terrarium PNG, open data, no key) for each real study area, mosaic and resample them to a
// local metric grid (STEP m, local equirectangular about the area centre, rows south, columns east).
// Raw tiles and grids go under DATA (default $TMPDIR/terrain-study), never the repo.
// Usage: node tools/terrain-study/fetch-real.cjs [name ...]
const fs=require('node:fs'),path=require('node:path');
const {decode}=require('./png.cjs'),{DATA,STEP,ZOOM,REAL}=require('./areas.cjs');
const TILES=path.join(DATA,'tiles'),GRIDS=path.join(DATA,'grids');
fs.mkdirSync(TILES,{recursive:true});fs.mkdirSync(GRIDS,{recursive:true});
const merc=(lat,lon,z)=>{const n=2**z*256,s=Math.sin(lat*Math.PI/180);return [(lon+180)/360*n,(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n];};
const cache=new Map();
async function tile(z,x,y){
  const k=`${z}/${x}/${y}`;if(cache.has(k))return cache.get(k);
  const f=path.join(TILES,`${z}-${x}-${y}.png`);
  if(!fs.existsSync(f)){const url=`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${k}.png`;
    const r=await fetch(url);if(!r.ok)throw new Error(`${url}: ${r.status}`);fs.writeFileSync(f,Buffer.from(await r.arrayBuffer()));}
  const p=decode(fs.readFileSync(f)),h=new Float32Array(256*256);
  for(let i=0;i<h.length;i++)h[i]=p.rgb[i*3]*256+p.rgb[i*3+1]+p.rgb[i*3+2]/256-32768;
  cache.set(k,h);return h;
}
async function area(A){
  const n=Math.round(A.km*1000/STEP),half=(n-1)/2*STEP,mlat=111320,mlon=111320*Math.cos(A.lat*Math.PI/180);
  // Pixel bounds -> tiles.
  const [x0,y0]=merc(A.lat+half/mlat,A.lon-half/mlon,ZOOM),[x1,y1]=merc(A.lat-half/mlat,A.lon+half/mlon,ZOOM);
  for(let ty=Math.floor(y0/256);ty<=Math.floor(y1/256);ty++)for(let tx=Math.floor(x0/256);tx<=Math.floor(x1/256);tx++)await tile(ZOOM,tx,ty);
  const px=(X,Y)=>{const tx=Math.floor(X/256),ty=Math.floor(Y/256);return cache.get(`${ZOOM}/${tx}/${ty}`)[(Y-ty*256)*256+(X-tx*256)];};
  const g=new Float32Array(n*n);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const e=-half+i*STEP,no=half-j*STEP,[X,Y]=merc(A.lat+no/mlat,A.lon+e/mlon,ZOOM),xa=X-.5,ya=Y-.5,ix=Math.floor(xa),iy=Math.floor(ya),u=xa-ix,v=ya-iy;
    g[j*n+i]=(px(ix,iy)*(1-u)+px(ix+1,iy)*u)*(1-v)+(px(ix,iy+1)*(1-u)+px(ix+1,iy+1)*u)*v;}
  const pixelM=156543.03*Math.cos(A.lat*Math.PI/180)/2**ZOOM;
  fs.writeFileSync(path.join(GRIDS,A.name+'.f32'),Buffer.from(g.buffer));
  fs.writeFileSync(path.join(GRIDS,A.name+'.json'),JSON.stringify({...A,n,step:STEP,source:`AWS Terrain Tiles terrarium z${ZOOM}`,pixelM:+pixelM.toFixed(1)}));
  let lo=Infinity,hi=-Infinity;for(const v of g){lo=Math.min(lo,v);hi=Math.max(hi,v);}
  console.log(A.name,n+'x'+n,'native px',pixelM.toFixed(1),'m','min',lo.toFixed(0),'max',hi.toFixed(0));
}
(async()=>{const want=process.argv.slice(2);for(const A of REAL)if(!want.length||want.includes(A.name))await area(A);})().catch(e=>{console.error(e);process.exit(1);});
