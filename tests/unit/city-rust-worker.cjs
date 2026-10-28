'use strict';
// Classic-script worker VM with real WASM, not a browser/UI test.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{fileURLToPath,pathToFileURL}=require('node:url');
const dir=path.resolve(__dirname,'../../prototypes/labs/city-lab'),C=require(path.join(dir,'city-model.js'));
function worker({missing=false,deferred=false}={}){
  const replies=[],imports=[],urls=[],location={href:pathToFileURL(path.join(dir,'city-worker.js')).href};let release;
  const gate=deferred?new Promise(resolve=>release=resolve):Promise.resolve();
  const context=vm.createContext({performance,TextEncoder,TextDecoder,URL,WebAssembly,Uint8Array,Uint16Array,Uint32Array,Int32Array,Float32Array,ArrayBuffer,DataView,location,
    fetch:async url=>{urls.push(url);await gate;return missing?{ok:false,status:404}:{ok:true,arrayBuffer:async()=>{const b=fs.readFileSync(fileURLToPath(url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}};},
    self:{postMessage(d,transfer=[]){replies.push(structuredClone(d,{transfer}));}}
  });
  context.importScripts=(...names)=>{for(const name of names){imports.push(name);vm.runInContext(fs.readFileSync(fileURLToPath(new URL(name,location.href)),'utf8'),context,{filename:name});}};
  vm.runInContext(fs.readFileSync(path.join(dir,'city-worker.js'),'utf8'),context,{filename:'city-worker.js'});
  return {send:data=>context.self.onmessage({data}),replies,imports,urls,release};
}
(async()=>{
  const city=C.generate(1),job={epoch:10,engine:'rust',parcel:city.parcels[0],extent:city.extent,mode:'facade'};
  const cold=worker();cold.send(job);assert.match(cold.replies[0].error,/explicit initialization/);
  const broken=worker({missing:true});await broken.send({type:'init',epoch:10,engine:'rust'});
  assert.equal(broken.replies.length,1);assert.equal(broken.replies[0].type,'init-error');assert.equal(broken.replies[0].engine,'rust');assert.match(broken.replies[0].error,/404/);
  broken.send(job);assert.match(broken.replies[1].error,/not ready/);assert.equal(broken.replies[1].mesh,undefined);
  const w=worker();await w.send({type:'init',epoch:10,engine:'rust'});
  assert.equal(w.replies[0].type,'ready');assert.equal(w.replies[0].epoch,10);assert.ok(w.replies[0].init.load.compileMs>=0);
  assert.ok(w.urls[0].endsWith('/city-lab/wasm/city_lab_core.wasm'),'classic-worker URL resolves alongside loader, not page');
  assert.ok(w.imports.indexOf('city-stream.js')<w.imports.indexOf('city-rust.js'));
  w.send({...job,epoch:9});assert.equal(w.replies.length,1,'old epochs ignored before execution');
  w.send(job);const d=w.replies[1];assert.equal(d.error,undefined);assert.equal(d.engine,'rust');assert.equal(d.epoch,10);assert.ok(d.mesh.verts.length>0);assert.equal(d.walkData,null);assert.equal(d.ray,null);
  assert.equal(d.engineMetrics.operations['geometry.facade'],1);assert.equal(d.engineMetrics.wasm.liveBytes,0);assert.equal(d.engineMetrics.wasm.liveAllocations,0);
  w.send({...job,engine:'js'});assert.match(w.replies[2].error,/engine mismatch/);
  const switched=worker({deferred:true});const pending=switched.send({type:'init',epoch:1,engine:'rust'});await switched.send({type:'init',epoch:2,engine:'js'});switched.release();await pending;
  assert.equal(switched.replies.length,1);assert.equal(switched.replies[0].epoch,2);assert.equal(switched.replies[0].engine,'js','late Rust init cannot replace current worker epoch');
  switched.send({...job,epoch:2,engine:'js'});assert.equal(switched.replies[1].engine,'js');assert.deepEqual(Object.keys(switched.replies[1].engineMetrics.operations),[]);
  const html=fs.readFileSync(path.join(dir,'../../city-lab.html'),'utf8');assert.match(html,/id="engine"/);assert.match(html,/<option value="js" selected>/);
  assert.ok(html.indexOf('src="labs/city-lab/city-rust.js"')<html.indexOf('src="labs/city-lab/city-lab.js"'),'loader must precede runtime');
  console.log('Real classic worker: init/ready/errors, missing WASM without fallback, engine schema, native buffers, transferable ownership and stale init/job epochs PASS.');
})().catch(e=>{console.error(e);process.exitCode=1;});
