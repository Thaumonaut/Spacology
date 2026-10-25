#!/usr/bin/env node
'use strict';
// Side-by-side shaded relief (greyscale hillshade, sun NW 45 deg, no exaggeration), real left, generated right, every
// panel at the same metres per pixel. A 1 km scale bar sits in each panel's lower left. Writes artifacts/real-terrain/*.png.
const path=require('node:path'),{load,crop,shade,sideBySide,grey,writePNG}=require('./grid.cjs');
const OUT=path.join(__dirname,'../../artifacts/real-terrain');
// [file, metres per pixel, [[grid, window km], ...]]
const PAIRS=[
  ['volcano.png',75,[['rainier',30],['fuji',30],['ours-volcano',16]]],
  ['alpine.png',30,[['bernese',12],['ours-spine-e',12]]],
  ['young.png',30,[['tetons',12],['ours-spine-w',12]]],
  ['young-nz.png',30,[['southern-alps',12],['ours-spine-w',12]]],
  ['old.png',30,[['smokies',8],['ours-minor',8]]],
  ['plain.png',15,[['gallatin',4],['ours-plain',4],['ours-home',3]]],
];
function panel(name,km,mpp){const G=load(name),c=crop(G,km,mpp),img=shade(c,{z:1}),g=grey(img),bar=Math.round(1000/mpp),y0=g.h-10;
  for(let y=y0;y<y0+4;y++)for(let x=8;x<8+bar;x++){g.grey[y*g.w+x]=255;if(y===y0||y===y0+3)g.grey[y*g.w+x]=0;}
  const rgb=new Uint8Array(g.w*g.h*3);for(let k=0;k<g.grey.length;k++)rgb[k*3]=rgb[k*3+1]=rgb[k*3+2]=g.grey[k];return {w:g.w,h:g.h,rgb};}
for(const [file,mpp,list] of PAIRS){const img=grey(sideBySide(list.map(([n,km])=>panel(n,km,mpp))));
  const bytes=writePNG(path.join(OUT,file),img);console.log(file,img.w+'x'+img.h,(bytes/1024).toFixed(0)+' KB');}
