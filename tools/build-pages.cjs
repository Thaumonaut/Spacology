#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'dist');
const npm=process.platform==='win32'?'npm.cmd':'npm';
// Opt in to generating the ignored, served City Lab asset. JS stays usable
// without a Rust toolchain; a missing Rust asset is an explicit runtime error.
if(process.env.SPACOLOGY_BUILD_CITY_RUST==='1')require('./build-city-rust.cjs').build();
for(const app of ['game','runner-next'])execFileSync(npm,['run','build'],{cwd:path.join(ROOT,app),stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT);
// An explicit publication list keeps dependencies, local outputs and test artifacts off Pages.
for(const name of ['index.html','manifest.webmanifest','sw.js','prototypes','assets','sim','docs','mockups']){
  fs.cpSync(path.join(ROOT,name),path.join(OUT,name),{recursive:true,filter:file=>{
    // Never publish Cargo target caches/source; retain only stable wasm/ output.
    if(path.relative(ROOT,file).split(path.sep).join('/')==='prototypes/labs/city-lab/rust')return false;
    return !['.DS_Store','node_modules','__pycache__'].includes(path.basename(file));
  }});
}
fs.cpSync(path.join(ROOT,'game/dist'),path.join(OUT,'expedition'),{recursive:true});
fs.cpSync(path.join(ROOT,'runner-next/dist'),path.join(OUT,'runner'),{recursive:true});
fs.writeFileSync(path.join(OUT,'.nojekyll'),'');
const entries=require('../prototypes/library/catalogue.js');
for(const e of entries){
  let file=path.resolve(OUT,'prototypes',e.file.split(/[?#]/)[0]);
  if(e.file.endsWith('/'))file=path.join(file,'index.html');
  if(!fs.existsSync(file))throw new Error('Missing library entry: '+e.file);
}
console.log(`Pages artifact: ${OUT} (${entries.length} playable/library entries)`);
