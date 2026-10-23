#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'prototypes/labs/microvoxel-world');
const output=process.argv[2];if(!output)throw new Error('Usage: node tools/package-microvoxel.cjs /existing/directory/microvoxel-world.html');
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const worker=read('macro-map.js')+'\n'+read('voxel-world-model.js')+'\n'+read('voxel-worker.js').replace("importScripts('macro-map.js?v=wilds-14','voxel-world-model.js?v=wilds-14');",'');
const workerURL=`URL.createObjectURL(new Blob([${JSON.stringify(worker)}],{type:'text/javascript'}))`;
let controller=read('microvoxel-world.js');
const target="new Worker('labs/microvoxel-world/voxel-worker.js?v=wilds-14')";
if(!controller.includes(target))throw new Error('Worker bootstrap changed; review bundling');
controller=controller.replace(target,`new Worker(${workerURL})`);
let html=fs.readFileSync(path.join(root,'prototypes/microvoxel-world.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="labs/microvoxel-world/microvoxel-world.css">',`<style>${read('microvoxel-world.css')}</style>`);
const scripts={'macro-map.js':read('macro-map.js'),'voxel-world-model.js':read('voxel-world-model.js'),'voxel-renderer.js':read('voxel-renderer.js'),'lod-stream.js':read('lod-stream.js'),'hex-atlas.js':read('hex-atlas.js'),'vendor/peerjs-1.5.5.min.js':read('vendor/peerjs-1.5.5.min.js'),'coop-session.js':read('coop-session.js'),'coop-net.js':read('coop-net.js'),'coop-play.js':read('coop-play.js'),'walk-camera.js':read('walk-camera.js'),'microvoxel-world.js':controller};
for(const [name,source] of Object.entries(scripts))html=html.replace(`<script src="labs/microvoxel-world/${name}"></script>`,`<script>${source.replace(/<\/script/gi,'<\\/script')}</script>`);
html=html.replace('href="minigames.html"','href="https://thaumonaut.github.io/Spacology/prototypes/minigames.html"');
fs.writeFileSync(path.resolve(output),html);console.log(`Standalone world lab: ${path.resolve(output)} (${Buffer.byteLength(html)} bytes, inline worker and no runtime downloads)`);
