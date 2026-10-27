'use strict';
// No wasm-pack, bundler or CLI dependency. Run from the root with Node 24.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),RUST=path.join(ROOT,'prototypes/labs/city-lab/rust'),OUTPUT=path.join(RUST,'../wasm');
function build(){
  for(const dir of [RUST,path.dirname(OUTPUT)])if(!fs.statSync(dir).isDirectory())throw new Error(`Invalid build parent ${dir}`);
  const args=['build','--manifest-path',path.join(RUST,'Cargo.toml'),'--locked','--target','wasm32-unknown-unknown','--release'];
  const run=cp.spawnSync('cargo',args,{cwd:ROOT,stdio:'inherit',env:{...process.env,CARGO_TARGET_DIR:path.join(RUST,'target')}});
  if(run.error)throw run.error;if(run.status!==0)throw new Error('Rust WASM build failed; install the target with rustup target add wasm32-unknown-unknown');
  fs.mkdirSync(OUTPUT,{recursive:true});
  // Self-ignoring generated directory; do not modify the shared root .gitignore.
  fs.writeFileSync(path.join(OUTPUT,'.gitignore'),'*\n');
  const target=path.join(OUTPUT,'city_lab_core.wasm');
  fs.copyFileSync(path.join(RUST,'target/wasm32-unknown-unknown/release/city_lab_core.wasm'),target);
  const bytes=fs.readFileSync(target);console.log(`${path.relative(ROOT,target)}: ${bytes.length} bytes; sha256 ${crypto.createHash('sha256').update(bytes).digest('hex')}`);
  return target;
}
async function test(url){
  const assert=require('node:assert/strict'),loader=require('../prototypes/labs/city-lab/city-rust.js');
  const engine=await loader.load({url,requiredOps:[]});
  assert.equal(engine.info.engine,'rust');assert.equal(engine.info.geometryBudgetBytes,128*1024*1024);
  assert.deepEqual(engine.stats().liveAllocations,0);
  const meta={seed:4294967295,model:[1,0,0,0,0,1,0,0,0,0,1,0,-2.5,0,7,1]};
  const buffers={vol:Uint8Array.of(0,7,255),verts:Uint16Array.of(65535,0,19),idx:Uint32Array.of(0,4294967295),ownerSegments:Int32Array.of(-1,4),normals:Float32Array.of(.25,-1)};
  const retained=engine.call('core.echo',meta,buffers);
  for(let i=0;i<200;i++){
    const reply=engine.call('core.echo',meta,buffers);assert.deepEqual(reply.meta,meta);
    for(const name in buffers)assert.deepEqual(reply.buffers[name],buffers[name]);
    assert.equal(engine.stats().liveBytes,0);assert.equal(engine.stats().liveAllocations,0);
  }
  const large=new Uint8Array(1024*1024+1);large[large.length-1]=255;
  assert.deepEqual(engine.call('core.echo',{}, {vol:large}).buffers.vol,large);
  for(const name in buffers)assert.deepEqual(retained.buffers[name],buffers[name],'retained arrays survive later jobs and memory growth');
  assert.throws(()=>engine.call('invalid.operation'),{code:'UNKNOWN_OPERATION'});
  assert.throws(()=>engine.call('core.echo',{bad:NaN}),{code:'INVALID_REQUEST'});
  assert.throws(()=>engine.call('core.echo',{}, {bad:new Float64Array(1)}),{code:'INVALID_PACKET'});
  const malformed=loader.encodePacket('core.echo');new DataView(malformed.buffer).setUint32(0,0xffffffff,true);
  assert.throws(()=>loader.decodePacket(malformed),{code:'INVALID_PACKET'});
  const header={abi:1,ok:true,meta:{},buffers:[{name:'a',kind:'u8',offset:0,length:4},{name:'b',kind:'u8',offset:2,length:4}]};
  const json=new TextEncoder().encode(JSON.stringify(header)),start=Math.ceil((4+json.length)/8)*8,overlap=new Uint8Array(start+8);
  new DataView(overlap.buffer).setUint32(0,json.length,true);overlap.set(json,4);
  assert.throws(()=>loader.decodePacket(overlap),{code:'INVALID_PACKET'});
  const pending=loader.PORT_OPERATIONS.filter(op=>!engine.info.implemented.includes(op));
  for(const op of pending)assert.throws(()=>engine.call(op),{code:'NOT_IMPLEMENTED'});
  if(pending.length)await assert.rejects(loader.load({url}),{code:'NOT_IMPLEMENTED'});
  assert.equal(engine.stats().liveBytes,0);assert.equal(engine.stats().liveAllocations,0);
  console.log(`Node ${process.version}: typed-buffer ABI, 200 free cycles, memory growth, errors and explicit readiness checks PASS (${pending.length} port operations pending).`);
  engine.dispose();assert.throws(()=>engine.call('core.info'),{code:'DISPOSED'});
}
if(require.main===module){
  const args=process.argv.slice(2);if(args.some(a=>a!=='--test'))throw new Error('Usage: node tools/build-city-rust.cjs [--test]');
  const file=build();if(args.includes('--test'))test(file).catch(e=>{console.error(e);process.exitCode=1;});
}
module.exports={build,test};
