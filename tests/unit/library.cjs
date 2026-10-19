'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..'),P=path.join(ROOT,'prototypes');
const entries=require('../../prototypes/library/catalogue.js'),K=require('../../prototypes/shared/minigames/minigame-kit.js');
assert.equal(new Set(entries.map(e=>e.id)).size,entries.length,'unique library ids');
assert.deepEqual(entries.filter(e=>e.station).map(e=>e.id),K.GAMES.map(g=>g.id));
const built=new Set(['../expedition/','../runner/']);
for(const e of entries)if(!built.has(e.file))assert.ok(fs.existsSync(path.resolve(P,e.file.split(/[?#]/)[0])),e.file);
for(const file of fs.readdirSync(P).filter(f=>f.endsWith('.html')&&f!=='minigames.html'))assert.ok(entries.some(e=>e.file.split('?')[0]===file),'unlisted public page: '+file);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of walk(P)){
  if(!/\.(html|css)$/.test(file))continue;
  const source=fs.readFileSync(file,'utf8');
  const refs=file.endsWith('.html')?[...source.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]):[...source.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)].map(m=>m[1]);
  for(const ref of refs){if(/^(?:https?:|data:|#)/.test(ref))continue;assert.ok(fs.existsSync(path.resolve(path.dirname(file),ref.split(/[?#]/)[0])),`${path.relative(ROOT,file)} → ${ref}`);}
}
const context={self:{MiniGameKit:K,SpacologyEnemyCatalogue:require('../../sim/enemy-catalogue.js')},importScripts(){},caches:{},URL,console};
context.self.addEventListener=()=>{};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8')+'\nthis.core=CORE;',context);
for(const file of context.core)assert.ok(fs.existsSync(path.resolve(ROOT,file)),'missing offline resource: '+file);
console.log(`PASS ${entries.length} library entries, static dependencies and service-worker resources exist`);
