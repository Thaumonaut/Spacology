#!/usr/bin/env node
'use strict';
// Voxelises the vendored CC0 KayKit furniture and kitchen pieces into 6.25 cm kit stamps for the building lab.
// Reads prototypes/labs/building-lab/kits/kaykit/*/<piece>.gltf (+ .bin, + the pack's gradient atlas PNG), scales each
// piece to the real-world size in PIECES (KayKit's chunky units are not metres), samples the atlas at each triangle's UV
// and writes prototypes/labs/building-lab/kit-pieces.js. Colours are quantised into the kit half of the shared palette
// (indices 128-255; architecture owns 1-127). Usage: node tools/voxelize-kaykit.cjs [--preview piece]
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const ROOT=path.resolve(__dirname,'..'),KIT=path.join(ROOT,'prototypes/labs/building-lab/kits/kaykit');
const OUT=path.join(ROOT,'prototypes/labs/building-lab/kit-pieces.js');
const CELL=0.0625,FIRST=128,SLOTS=128;

// size: target [width x, height y, depth z] in metres; any null axis follows the uniform scale of the others.
// back: which local side touches the wall once placed (KayKit faces +z, so its back is -z).
// tags drive placement (see furnish.js): wall, corner, centre, onTop (small, stands on another piece), floor (rug).
const P=(pack,id,size,tags,extra={})=>({pack,id,size,tags,...extra});
const PIECES=[
  P('furniture-bits','bed_double_A',[1.6,null,2.05],['wall','bed']),
  P('furniture-bits','bed_single_A',[1.0,null,2.0],['wall','bed']),
  P('furniture-bits','cabinet_small',[0.5,0.55,null],['wall','side']),
  P('furniture-bits','cabinet_medium_decorated',[1.0,null,null],['wall']),
  P('furniture-bits','chair_A_wood',[null,0.9,null],['chair']),
  P('furniture-bits','chair_stool_wood',[null,0.5,null],['chair','stool']),
  P('furniture-bits','couch_pillows',[1.9,null,null],['wall','seat']),
  P('furniture-bits','armchair_pillows',[0.85,null,null],['seat','corner']),
  P('furniture-bits','table_low',[1.0,0.4,null],['centre']),
  P('furniture-bits','table_medium',[1.0,0.75,null],['centre','table']),
  P('furniture-bits','table_medium_long',[1.8,0.75,null],['centre','table']),
  P('furniture-bits','table_small',[0.6,0.7,null],['wall','side']),
  P('furniture-bits','shelf_A_big',[1.0,1.9,null],['wall','tall']),
  P('furniture-bits','shelf_B_large_decorated',[1.2,null,null],['wall','tall']),
  P('furniture-bits','shelf_B_small_decorated',[0.7,null,null],['wall']),
  P('furniture-bits','lamp_standing',[null,1.55,null],['corner']),
  P('furniture-bits','lamp_table',[null,0.4,null],['onTop']),
  P('furniture-bits','rug_rectangle_A',[2.0,null,null],['floor']),
  P('furniture-bits','rug_oval_A',[1.8,null,null],['floor']),
  P('furniture-bits','rug_rectangle_stripes_A',[1.6,null,null],['floor']),
  P('furniture-bits','book_set',[null,0.22,null],['onTop']),
  P('furniture-bits','cactus_medium_A',[null,0.8,null],['corner','plant']),
  P('restaurant-bits','kitchencounter_straight_A',[1.0,0.9,0.65],['wall','counter']),
  P('restaurant-bits','kitchencounter_straight_A_decorated',[1.0,0.9,0.65],['wall','counter']),
  P('restaurant-bits','kitchencounter_sink',[1.0,0.9,0.65],['wall','counter']),
  P('restaurant-bits','stove_single',[0.9,null,null],['wall','stove']),
  P('restaurant-bits','kitchencabinet',[1.0,null,null],['wall','tall']),
  P('restaurant-bits','kitchentable_A_large_decorated',[1.6,0.9,null],['centre','table']),
  P('restaurant-bits','crate',[0.6,null,null],['corner','crate']),
  P('restaurant-bits','crate_carrots',[0.6,null,null],['corner','crate']),
  P('restaurant-bits','crate_potatoes',[0.6,null,null],['corner','crate']),
  P('restaurant-bits','crate_tomatoes',[0.6,null,null],['corner','crate']),
  P('restaurant-bits','jar_C_large',[null,0.5,null],['corner']),
  P('restaurant-bits','pot_large',[null,0.35,null],['onTop']),
  P('restaurant-bits','table_round_A_decorated',[1.0,0.75,null],['centre','table']),
  P('restaurant-bits','chair_B',[null,0.9,null],['chair'])
];

// Minimal PNG reader: 8-bit RGB/RGBA, non-interlaced (what KayKit ships). zlib is built into Node.
function readPng(file){
  const b=fs.readFileSync(file);let o=8,w=0,h=0,bits=0,type=0,ilace=0;const idat=[];
  while(o<b.length){const len=b.readUInt32BE(o),t=b.toString('latin1',o+4,o+8),d=b.subarray(o+8,o+8+len);o+=12+len;
    if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bits=d[8];type=d[9];ilace=d[12];}else if(t==='IDAT')idat.push(d);else if(t==='IEND')break;}
  if(bits!==8||ilace||!(type===2||type===6))throw new Error(`${file}: only 8-bit non-interlaced RGB/RGBA PNG is supported`);
  const bpp=type===6?4:3,stride=w*bpp,raw=zlib.inflateSync(Buffer.concat(idat)),px=new Uint8Array(w*h*4),prev=new Uint8Array(stride),row=new Uint8Array(stride);
  for(let y=0;y<h;y++){const f=raw[y*(stride+1)],src=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1));
    for(let i=0;i<stride;i++){const a=i>=bpp?row[i-bpp]:0,up=prev[i],c=i>=bpp?prev[i-bpp]:0;let v=src[i];
      if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const p=a+up-c,pa=Math.abs(p-a),pb=Math.abs(p-up),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?up:c;}
      row[i]=v&255;}
    for(let x=0;x<w;x++){px.set([row[x*bpp],row[x*bpp+1],row[x*bpp+2],bpp===4?row[x*bpp+3]:255],(y*w+x)*4);}prev.set(row);}
  return {w,h,px};
}

const mul=(a,b)=>{const r=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)r[j*4+i]+=a[k*4+i]*b[j*4+k];return r;};
function trs(n){if(n.matrix)return n.matrix;const [tx,ty,tz]=n.translation||[0,0,0],[x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1];
  return [(1-2*(y*y+z*z))*sx,(2*(x*y+z*w))*sx,(2*(x*z-y*w))*sx,0,(2*(x*y-z*w))*sy,(1-2*(x*x+z*z))*sy,(2*(y*z+x*w))*sy,0,(2*(x*z+y*w))*sz,(2*(y*z-x*w))*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1];}
// Every triangle of the default scene in world space, with UVs.
function loadGltf(file){
  const g=JSON.parse(fs.readFileSync(file,'utf8')),dir=path.dirname(file),bufs=g.buffers.map(b=>fs.readFileSync(path.join(dir,b.uri)));
  const read=(i,comps)=>{const a=g.accessors[i],v=g.bufferViews[a.bufferView],buf=bufs[v.buffer],base=(v.byteOffset||0)+(a.byteOffset||0);
    const size={5126:4,5123:2,5125:4,5121:1}[a.componentType],stride=v.byteStride||size*comps,out=[];
    for(let k=0;k<a.count;k++){const e=[];for(let c=0;c<comps;c++){const o=base+k*stride+c*size;e.push(a.componentType===5126?buf.readFloatLE(o):a.componentType===5123?buf.readUInt16LE(o):a.componentType===5125?buf.readUInt32LE(o):buf[o]);}out.push(comps===1?e[0]:e);}
    return out;};
  const tris=[],visit=(ni,parent)=>{const n=g.nodes[ni],m=mul(parent,trs(n));
    if(n.mesh!==undefined)for(const p of g.meshes[n.mesh].primitives){const pos=read(p.attributes.POSITION,3),uv=p.attributes.TEXCOORD_0!==undefined?read(p.attributes.TEXCOORD_0,2):null,idx=p.indices!==undefined?read(p.indices,1):pos.map((_,i)=>i);
      const wp=pos.map(([x,y,z])=>[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]]);
      for(let i=0;i<idx.length;i+=3)tris.push([0,1,2].map(k=>({p:wp[idx[i+k]],uv:uv?uv[idx[i+k]]:[0,0]})));}
    for(const c of n.children||[])visit(c,m);};
  for(const ni of g.scenes[g.scene||0].nodes)visit(ni,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  return tris;
}

function voxelise(piece,atlas){
  const tris=loadGltf(path.join(KIT,piece.pack,piece.id+'.gltf'));
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const t of tris)for(const v of t)for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],v.p[a]);hi[a]=Math.max(hi[a],v.p[a]);}
  const ext=hi.map((h,a)=>h-lo[a]),given=piece.size.map((s,a)=>s==null?null:s/ext[a]).filter(s=>s!=null);
  const uniform=given.reduce((a,b)=>a+b,0)/given.length,scale=piece.size.map((s,a)=>s==null?uniform:s/ext[a]);
  const dims=ext.map((e,a)=>Math.max(1,Math.ceil(e*scale[a]/CELL-1e-6))),[X,Y,Z]=dims,rgb=new Map();
  for(const t of tris){
    const q=t.map(v=>v.p.map((c,a)=>(c-lo[a])*scale[a]/CELL)),edge=Math.max(...[[0,1],[1,2],[2,0]].map(([i,j])=>Math.hypot(...q[i].map((c,a)=>c-q[j][a])))),n=Math.max(1,Math.ceil(edge/0.35));
    for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){const u=i/n,v=j/n,w=1-u-v;
      const x=Math.min(X-1,Math.max(0,Math.floor(q[0][0]*w+q[1][0]*u+q[2][0]*v))),y=Math.min(Y-1,Math.max(0,Math.floor(q[0][1]*w+q[1][1]*u+q[2][1]*v))),z=Math.min(Z-1,Math.max(0,Math.floor(q[0][2]*w+q[1][2]*u+q[2][2]*v)));
      const tu=t[0].uv[0]*w+t[1].uv[0]*u+t[2].uv[0]*v,tv=t[0].uv[1]*w+t[1].uv[1]*u+t[2].uv[1]*v;
      const px=Math.min(atlas.w-1,Math.max(0,Math.floor((tu-Math.floor(tu))*atlas.w))),py=Math.min(atlas.h-1,Math.max(0,Math.floor((tv-Math.floor(tv))*atlas.h))),o=(py*atlas.w+px)*4;
      rgb.set(x+X*(z+Z*y),(atlas.px[o]<<16)|(atlas.px[o+1]<<8)|atlas.px[o+2]);}
  }
  // Fill closed interiors so a cutaway or a chipped edge never shows a hollow shell: anything air that the outside
  // cannot reach becomes the colour of the nearest cell above it.
  const outside=new Uint8Array(X*Y*Z),stack=[];
  const push=(x,y,z)=>{if(x<0||y<0||z<0||x>=X||y>=Y||z>=Z)return;const i=x+X*(z+Z*y);if(outside[i]||rgb.has(i))return;outside[i]=1;stack.push(i);};
  for(let x=0;x<X;x++)for(let z=0;z<Z;z++){push(x,0,z);push(x,Y-1,z);}for(let y=0;y<Y;y++){for(let x=0;x<X;x++){push(x,y,0);push(x,y,Z-1);}for(let z=0;z<Z;z++){push(0,y,z);push(X-1,y,z);}}
  while(stack.length){const i=stack.pop(),x=i%X,z=Math.floor(i/X)%Z,y=Math.floor(i/(X*Z));push(x+1,y,z);push(x-1,y,z);push(x,y+1,z);push(x,y-1,z);push(x,y,z+1);push(x,y,z-1);}
  for(let y=Y-1;y>=0;y--)for(let z=0;z<Z;z++)for(let x=0;x<X;x++){const i=x+X*(z+Z*y);if(!outside[i]&&!rgb.has(i)){const a=rgb.get(i+X*Z);rgb.set(i,a===undefined?rgb.values().next().value:a);}}
  return {dims,rgb};
}

// Median-cut style quantisation: bucket to 5 bits per channel, keep the most-used buckets, map the rest to the nearest.
function quantise(all){
  const count=new Map();for(const v of all){const k=((v>>19)&31)<<10|((v>>11)&31)<<5|((v>>3)&31);count.set(k,(count.get(k)||0)+1);}
  const keep=[...count.entries()].sort((a,b)=>b[1]-a[1]).slice(0,SLOTS).map(([k])=>k);
  const toRgb=k=>[((k>>10)&31)*8+4,((k>>5)&31)*8+4,(k&31)*8+4],pal=keep.map(toRgb),cache=new Map();
  const index=v=>{const k=((v>>19)&31)<<10|((v>>11)&31)<<5|((v>>3)&31);if(cache.has(k))return cache.get(k);const [r,g,b]=toRgb(k);let best=0,bd=Infinity;
    pal.forEach(([pr,pg,pb],i)=>{const d=(pr-r)**2*2+(pg-g)**2*3+(pb-b)**2;if(d<bd){bd=d;best=i;}});cache.set(k,FIRST+best);return FIRST+best;};
  return {pal,index};
}

function rle(values){const out=[];for(let i=0;i<values.length;){let j=i;while(j<values.length&&values[j]===values[i]&&j-i<65535)j++;out.push(j-i,values[i]);i=j;}return out;}

const atlases=new Map(),pieces=PIECES.map(p=>{
  if(!atlases.has(p.pack)){const png=fs.readdirSync(path.join(KIT,p.pack)).find(f=>f.endsWith('.png'));atlases.set(p.pack,readPng(path.join(KIT,p.pack,png)));}
  return {...p,...voxelise(p,atlases.get(p.pack))};});
const {pal,index}=quantise(pieces.flatMap(p=>[...p.rgb.values()]));
const preview=process.argv.indexOf('--preview');
const out={cell:CELL,first:FIRST,palette:pal,source:'KayKit Furniture Bits 1.0 and Restaurant Bits 1.0 by Kay Lousberg (CC0 1.0), www.kaylousberg.com',pieces:{}};
for(const p of pieces){const [X,Y,Z]=p.dims,v=new Array(X*Y*Z).fill(0);for(const [i,c] of p.rgb)v[i]=index(c);
  out.pieces[p.id]={pack:p.pack,dims:p.dims,tags:p.tags,metres:p.dims.map(d=>+(d*CELL).toFixed(3)),rle:rle(v)};
  if(preview>0&&process.argv[preview+1]===p.id){console.log(p.id,p.dims);for(let y=Y-1;y>=0;y--){let s='';for(let x=0;x<X;x++){let c=' ';for(let z=0;z<Z;z++)if(v[x+X*(z+Z*y)]){c='#';break;}s+=c;}console.log('front |'+s);}
    for(let y=Y-1;y>=0;y--){let s='';for(let z=0;z<Z;z++){let c=' ';for(let x=0;x<X;x++)if(v[x+X*(z+Z*y)]){c='#';break;}s+=c;}console.log('side z→ |'+s);}}}
fs.writeFileSync(OUT,`// Generated by tools/voxelize-kaykit.cjs; do not edit. ${out.source}.\n(function(root){const KIT=${JSON.stringify(out)};\nif(typeof module==='object'&&module.exports)module.exports=KIT;else root.BuildingKitPieces=KIT;})(typeof globalThis==='object'?globalThis:this);\n`);
console.log(`wrote ${path.relative(ROOT,OUT)}: ${pieces.length} pieces, ${pal.length} kit colours, ${(fs.statSync(OUT).size/1024).toFixed(0)} KiB`);
for(const p of pieces)console.log(`  ${p.id.padEnd(36)} ${p.dims.join('×').padEnd(10)} ${out.pieces[p.id].metres.join(' × ')} m`);
