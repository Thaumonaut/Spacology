#!/usr/bin/env node
'use strict';
// Renders the streamed world's macro map (Azgaar-style continents, rivers, lakes; red dot = home start) as a PNG.
//   node tools/render-macro-map.cjs <out.png> [--seed 2718] [--map continents] [--width 960] [--ranges]
// --ranges draws the range crests (dark: long ranges, brown: minor, darker brown: branches) and volcanoes (orange).
// The image comes from MacroMap.image(), the same continuous fields the voxel world samples, so an in-app world map
// can reuse it directly.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const MacroMap=require('../prototypes/labs/microvoxel-world/macro-map.js');
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:fallback;};
const out=process.argv[2];if(!out||out.startsWith('--'))throw new Error('Usage: node tools/render-macro-map.cjs <out.png> [--seed N] [--map template] [--width px]');
const seed=Number(arg('seed',2718)),template=arg('map',null),w=Number(arg('width',960)),h=Math.round(w*MacroMap.HEIGHT/MacroMap.WIDTH);
const t=performance.now(),map=MacroMap.get(seed,template),built=performance.now()-t,rgba=MacroMap.image(map,w,h,{ranges:process.argv.includes('--ranges')});
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=buf=>{let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);};
const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;Buffer.from(rgba.buffer,y*w*4,w*4).copy(raw,y*(w*4+1)+1);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
fs.writeFileSync(path.resolve(out),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
const land=map.heights.filter(v=>v>=20).length/map.n;
console.log(JSON.stringify({out:path.resolve(out),seed,template:map.template,cells:map.n,spacingMetres:map.s,landShare:+land.toFixed(3),rivers:map.rivers.length,lakes:map.lakes.length,generateMs:+map.ms.toFixed(1),firstCallMs:+built.toFixed(1),home:{mapX:Math.round(map.ox),mapY:Math.round(map.oy)}}));
