// The test runner (tests/run.cjs) and static server (tests/serve.cjs), exercised on a throwaway copy of the repository
// layout under output/, so nothing here touches the real tests.
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');

const ROOT=path.resolve(__dirname,'../..');
const FAKE=path.join(ROOT,'output',`test-runner-${process.pid}`);
const NODE_PATH=path.join(ROOT,'node_modules');
const testScript=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).scripts.test.split(' ').slice(2);

function layout(files){
  fs.rmSync(FAKE,{recursive:true,force:true});
  for(const dir of ['tests/unit','tests/browser','tests/balance'])fs.mkdirSync(path.join(FAKE,dir),{recursive:true});
  for(const f of ['run.cjs','serve.cjs'])fs.copyFileSync(path.join(__dirname,'..',f),path.join(FAKE,'tests',f));
  for(const [name,body] of Object.entries(files))fs.writeFileSync(path.join(FAKE,name),body);
}
const runner=(args,{timeout=60000,env={}}={})=>spawnSync(process.execPath,['tests/run.cjs',...args],
  {cwd:FAKE,encoding:'utf8',timeout,maxBuffer:64*1024*1024,env:{...process.env,NODE_PATH,...env}});

(async()=>{
  try{
    // `npm test -- <text>` filters by path, even when the text is also a group's name.
    layout({'tests/unit/a.cjs':'','tests/browser/b.cjs':''});
    let r=runner([...testScript,'unit']);
    assert.match(r.stdout,/tests\/unit\/a\.cjs/,r.stdout+r.stderr);
    assert.doesNotMatch(r.stdout,/tests\/browser\/b\.cjs/,'`npm test -- unit` ran a browser file');

    // `npm test -- --unit` narrows the run to the unit group.
    r=runner([...testScript,'--unit']);
    assert.match(r.stdout,/tests\/unit\/a\.cjs/,r.stdout+r.stderr);
    assert.doesNotMatch(r.stdout,/tests\/browser\/b\.cjs/,'`npm test -- --unit` ran a browser file');

    // A skipped file is counted as skipped, never as passed.
    layout({'tests/unit/manual.cjs':'// @manual: needs arguments\nprocess.exit(1);\n'});
    r=runner(['manual']);
    assert.doesNotMatch(r.stdout,/1 passed/,`a skipped file counted as passed:\n${r.stdout}`);

    // A file that never finishes is stopped and reported as a failure, within the time limit.
    layout({'tests/unit/hang.cjs':'setTimeout(()=>{},120000);\n','tests/unit/ok.cjs':''});
    r=runner(['hang','ok'],{timeout:30000,env:{SPACOLOGY_TEST_TIMEOUT:'2'}});
    assert.notEqual(r.error&&r.error.code,'ETIMEDOUT','the runner waited forever on a file that never finishes');
    assert.match(r.stdout,/FAIL\s+tests\/unit\/hang\.cjs/,r.stdout);
    assert.match(r.stdout,/PASS\s+tests\/unit\/ok\.cjs/,'the files after a stuck one did not run');

    // The server never serves a path that climbs out of the root, however it is encoded.
    layout({'inside.txt':'inside'});
    const {start}=require(path.join(FAKE,'tests','serve.cjs'));
    const server=await start({port:0});
    try{
      const get=p=>new Promise((resolve,reject)=>http.get(server.url+p,res=>{res.resume();resolve(res.statusCode);}).on('error',reject));
      assert.equal(await get('/inside.txt'),200);
      for(const p of ['/../package.json','/%2e%2e/package.json','/..%2fpackage.json','/%2e%2e%2f%2e%2e/package.json'])
        assert.equal(await get(p),404,`${p} reached outside the root`);
    }finally{await server.close();}
  }finally{fs.rmSync(FAKE,{recursive:true,force:true});}
  console.log('PASS test runner');
})().catch(e=>{fs.rmSync(FAKE,{recursive:true,force:true});console.error(e);process.exit(1);});
