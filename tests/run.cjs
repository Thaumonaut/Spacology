#!/usr/bin/env node
'use strict';
// One command for every test: `npm test` runs the unit and browser groups; `npm test -- affix` runs only files whose
// path contains "affix". Groups are chosen with flags: --unit (tests/unit and tests/*.cjs), --browser (tests/browser),
// --balance (tests/balance, slow, opt-in). Every other argument is a path filter; an unknown flag is an error.
// Browser and balance files get a static server on a free port through SPACOLOGY_BASE_URL. Files run one at a time:
// the native-drag browser tests must never overlap (tests/browser/README.md). Each file has a time limit
// (SPACOLOGY_TEST_TIMEOUT seconds, default 1800); a file that outlives it is killed with its process group and fails.
// Headless unless SPACOLOGY_HEADED=1, which the tests read themselves. A file with `@manual` in its first five lines
// needs arguments or a human, and is listed as SKIP rather than run.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {start}=require('./serve.cjs');

const ROOT=path.resolve(__dirname,'..');
const GROUPS={
  unit:[path.join(__dirname,'unit'),__dirname],
  browser:[path.join(__dirname,'browser')],
  balance:[path.join(__dirname,'balance')]
};
const NEEDS_SERVER=new Set(['browser','balance']);
const DEFAULT_LIMIT_S=1800;
const MAX_LIMIT_MS=2**31-1; // setTimeout fires at once for anything longer
const GRACE_MS=2000; // after a file exits, how long its output pipes may take to drain
const DETACH=process.platform!=='win32'; // own process group, so a timeout or a signal can stop the file and its children

const args=process.argv.slice(2);
const flags=args.filter(a=>a.startsWith('--')),filters=args.filter(a=>!a.startsWith('--'));
const unknown=flags.filter(f=>!Object.hasOwn(GROUPS,f.slice(2)));
if(unknown.length){
  console.error(`Unknown option ${unknown.join(', ')}. Usage: node tests/run.cjs [--unit] [--browser] [--balance] [path text ...]`);
  process.exit(2);
}
const chosen=flags.length?[...new Set(flags.map(f=>f.slice(2)))]:['unit','browser'];
const limitS=Number(process.env.SPACOLOGY_TEST_TIMEOUT);
const LIMIT_MS=Math.min((limitS>0?limitS:DEFAULT_LIMIT_S)*1000,MAX_LIMIT_MS);

let current=null,server=null; // the file running now, and the static server, for the timeout and signal handlers
function kill(child){
  try{if(DETACH)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{} // ESRCH: already gone
}
process.on('exit',()=>{if(current)kill(current);});
for(const [signal,code] of [['SIGINT',130],['SIGTERM',143],['SIGHUP',129]]){
  process.on(signal,()=>{
    if(current){kill(current);current=null;}
    if(server){server.server.closeAllConnections();server.server.close();}
    process.exit(code);
  });
}

function filesIn(dir){
  return fs.readdirSync(dir).filter(name=>name.endsWith('.cjs')&&!['run.cjs','serve.cjs'].includes(name))
    .map(name=>path.join(dir,name)).sort();
}
function playwrightAvailable(){
  try{require.resolve('playwright',{paths:[ROOT,...(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)]});return true;}
  catch{return false;}
}
function run(file,env){
  return new Promise(resolve=>{
    const started=Date.now(),out=[];
    const child=spawn(process.execPath,[file],{cwd:ROOT,env:{...process.env,...env},detached:DETACH});
    current=child;
    let code=null,timedOut=false,grace=null,settled=false;
    const stopPipes=()=>{child.stdout.destroy();child.stderr.destroy();};
    const settle=()=>{
      if(settled)return;
      settled=true;clearTimeout(timer);clearTimeout(grace);
      if(current===child)current=null;
      resolve({code:timedOut?null:code,timedOut,seconds:(Date.now()-started)/1000,output:Buffer.concat(out).toString()});
    };
    // A browser's processes can hold the pipes open after a kill, so a timed-out file settles on 'exit', not 'close'.
    const timer=setTimeout(()=>{timedOut=true;kill(child);stopPipes();},LIMIT_MS);
    child.stdout.on('data',d=>out.push(d));child.stderr.on('data',d=>out.push(d));
    child.on('error',error=>{out.push(Buffer.from(String(error.stack||error)));settle();});
    child.on('exit',exitCode=>{
      code=exitCode;clearTimeout(timer);
      if(current===child)current=null;
      if(timedOut){settle();return;}
      grace=setTimeout(()=>{stopPipes();settle();},GRACE_MS); // normally 'close' comes first, with the last output
    });
    child.on('close',settle);
  });
}

(async()=>{
  const plan=chosen.flatMap(group=>GROUPS[group].flatMap(filesIn).map(file=>({group,file})))
    .filter(({file})=>!filters.length||filters.some(f=>path.relative(ROOT,file).includes(f)));
  if(!plan.length){console.error(`No test files match ${filters.join(', ')||'(no filter)'} in ${chosen.join(', ')}.`);process.exit(1);}
  if(plan.some(p=>NEEDS_SERVER.has(p.group))&&!playwrightAvailable()){
    console.error('Playwright is not installed. Run `npm install` once (it reuses browsers already downloaded), or set NODE_PATH.');
    process.exit(1);
  }
  server=plan.some(p=>NEEDS_SERVER.has(p.group))?await start({port:0}):null;
  const results=[];
  try{
    for(const {group,file} of plan){
      const name=path.relative(ROOT,file);
      if(fs.readFileSync(file,'utf8').split('\n').slice(0,5).some(l=>l.includes('@manual'))){
        results.push({name,status:'skip'});
        console.log(`SKIP  ${name}  (manual)`);
        continue;
      }
      const env=NEEDS_SERVER.has(group)?{SPACOLOGY_BASE_URL:server.url}:{};
      const r=await run(file,env),status=r.code===0?'pass':'fail';
      results.push({name,status});
      console.log(r.timedOut?`FAIL  ${name}  (timed out after ${LIMIT_MS/1000}s)`:`${status==='pass'?'PASS':'FAIL'}  ${name}  ${r.seconds.toFixed(1)}s`);
      if(status==='fail'&&r.output.trim())console.log(r.output.trimEnd().split('\n').slice(-25).map(l=>'      '+l).join('\n'));
    }
  }finally{if(server)await server.close();}
  const count=status=>results.filter(r=>r.status===status).length;
  const failed=count('fail'),skipped=count('skip');
  console.log(`\n${count('pass')} passed, ${failed} failed${skipped?`, ${skipped} skipped`:''}, ${results.length} files`);
  process.exit(failed?1:0);
})();
