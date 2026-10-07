// The affix lab's measurement CLI (sim/affix-lab.js). Each case runs it in its own process, because commands such as
// `route` change shared model state (the route's strengths) while they run.
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'../..');
const MODEL=path.join(ROOT,'prototypes/affix-lab-model.js'),SIM=path.join(ROOT,'sim/affix-lab.js');
// Runs the CLI with `args`, after `setup` (source text with the model bound to M) has instrumented it. `report` is
// evaluated at exit and printed on a REPORT line.
function sim(args,{setup='',report='null'}={}){
  const code=`const M=require(${JSON.stringify(MODEL)});${setup};
process.on('exit',()=>{console.log('REPORT '+JSON.stringify(${report}));});
process.argv=[process.argv[0],${JSON.stringify(SIM)},...${JSON.stringify(args)}];require(${JSON.stringify(SIM)});`;
  const r=spawnSync(process.execPath,['-e',code],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
  const line=(r.stdout||'').split('\n').find(l=>l.startsWith('REPORT '));
  return {status:r.status,stdout:r.stdout,stderr:r.stderr,report:line?JSON.parse(line.slice(7)):undefined};
}

// --part tax measures the tax half alone everywhere, including battles fought inside whole sessions.
{
  const r=sim(['route','--part','tax','--briefs','1','--seeds','1'],{
    setup:`let gifts=0;Object.values(M.AFFIXES).forEach(a=>{if(a.applyGift){const g=a.applyGift;a.applyGift=function(){gifts++;return g.apply(this,arguments);};}});`,
    report:'gifts'});
  assert.equal(r.status,0,r.stderr);
  assert.equal(r.report,0,`--part tax applied ${r.report} gifts`);
}

// Every rolled Brief is its own sample: two Briefs never replay the same sessions, even when their conditions match.
{
  const r=sim(['route','--count','0','--briefs','3','--seeds','1'],{
    setup:`const seen={};const create=M.createSession;M.createSession=function(o={}){if(o.brief){const k=JSON.stringify(o.brief);(seen[k]=seen[k]||new Set()).add(o.seed);}return create.apply(this,arguments);};`,
    report:'Object.values(seen).map(s=>[...s])'});
  assert.equal(r.status,0,r.stderr);
  const all=r.report.flat();
  assert.equal(r.report.length,3,'three Briefs');
  assert.equal(new Set(all).size,all.length,`Briefs share session seeds: ${JSON.stringify(r.report)}`);
}

// Zero Briefs is an empty measurement, not a crash.
{
  const r=sim(['churn','--briefs','0']);
  assert.doesNotMatch(r.stderr,/TypeError/,r.stderr);
}

// A flag value the tool cannot use is an error that names the flag, never a run that quietly measures something else.
for(const [flagName,args] of [
  ['--part',['inspect','--seeds','1','--affixes','frost','--part','taxes']],   // not tax or gift: would measure both halves
  ['--count',['route','--briefs','1','--seeds','1','--count','x']],           // not a number: would fill every Brief to the most cards
  ['--out',['baseline','--seeds','1','--out']],                               // no path: would write nothing and say nothing
  ['--affixes',['inspect','--seeds','1','--affixes','frots']]                 // unknown condition: would measure no condition at all
]){
  const r=sim(args);
  assert.notEqual(r.status,0,`${args.join(' ')} ran anyway`);
  assert.match(r.stderr,new RegExp(flagName),`${args.join(' ')}: the error should name ${flagName}\n${r.stderr}`);
}

// An accepted economy value either runs or is refused up front: starting with four crew must not crash mid-run.
{
  const r=sim(['route','--briefs','1','--seeds','1','--econ','startCrew=4']);
  assert.doesNotMatch(r.stderr,/TypeError/,r.stderr);
  assert.ok(r.status===0||/--econ/.test(r.stderr),`neither ran nor named --econ: ${r.stderr}`);
}

// The command line means what it says: a misplaced command, a repeated flag, or a count no Brief can hold is refused,
// never silently swapped for something else.
for(const [why,args,flagName] of [
  ['command after its flags',['--briefs','1','--seeds','1','route'],'route'],
  ['flag given twice',['route','--briefs','1','--seeds','1','--seeds','3'],'--seeds'],
  ['more conditions than a Brief can hold',['route','--briefs','1','--seeds','1','--count','99'],'--count']
]){
  const r=sim(args);
  assert.notEqual(r.status,0,`${why}: ${args.join(' ')} ran anyway`);
  assert.match(r.stderr,new RegExp(flagName),`${why}: the error should name ${flagName}\n${r.stderr}`);
}

// --out into a folder that does not exist: the results are written, or the run is refused before anything is measured
// (the documented promise for a value the tool cannot use), never lost after a long run.
{
  const dir=path.join(ROOT,'output',`affix-lab-sim-out-${process.pid}`),file=path.join(dir,'missing','baseline.json');
  try{
    const r=sim(['baseline','--seeds','1','--out',path.relative(ROOT,file)]);
    const written=r.status===0&&require('node:fs').existsSync(file);
    const refusedEarly=r.status!==0&&/--out/.test(r.stderr)&&!/Reference teams/.test(r.stdout);
    assert.ok(written||refusedEarly,`exit ${r.status}; stderr: ${r.stderr.split('\n')[0]}`);
  }finally{require('node:fs').rmSync(dir,{recursive:true,force:true});}
}

// The same holds for a folder written with a trailing slash.
{
  const dir=path.join(ROOT,'output',`affix-lab-sim-slash-${process.pid}`);
  try{
    const r=sim(['baseline','--seeds','1','--out',path.relative(ROOT,dir)+'/']);
    assert.ok(r.status!==0&&/--out/.test(r.stderr)&&!/Reference teams/.test(r.stdout),`exit ${r.status}; stderr: ${r.stderr.split('\n')[0]}`);
  }finally{require('node:fs').rmSync(dir,{recursive:true,force:true});}
}

// And for a folder that exists but cannot be written to.
{
  const fs=require('node:fs'),dir=path.join(ROOT,'output',`affix-lab-sim-readonly-${process.pid}`);
  fs.mkdirSync(dir,{recursive:true});fs.chmodSync(dir,0o555);
  try{
    const r=sim(['baseline','--seeds','1','--out',path.relative(ROOT,path.join(dir,'baseline.json'))]);
    assert.ok(r.status!==0&&/--out/.test(r.stderr)&&!/Reference teams/.test(r.stdout),`exit ${r.status}; stderr: ${r.stderr.split('\n')[0]}`);
  }finally{fs.chmodSync(dir,0o755);fs.rmSync(dir,{recursive:true,force:true});}
}

// But a file that can be written is accepted even when its folder cannot be: /dev/null, /dev/stdout (piping the JSON
// on), or an existing results file inside a read-only folder.
{
  const fs=require('node:fs'),dir=path.join(ROOT,'output',`affix-lab-sim-rofile-${process.pid}`),file=path.join(dir,'baseline.json');
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file,'{}');fs.chmodSync(dir,0o555);
  try{
    const kept=sim(['baseline','--seeds','1','--out',path.relative(ROOT,file)]);
    assert.equal(kept.status,0,`existing writable file in a read-only folder refused: ${kept.stderr.split('\n')[0]}`);
    assert.ok(/Reference teams|baseline/.test(fs.readFileSync(file,'utf8')),'the existing file was not rewritten');
    const devnull=sim(['baseline','--seeds','1','--out','/dev/null']);
    assert.equal(devnull.status,0,`--out /dev/null refused: ${devnull.stderr.split('\n')[0]}`);
  }finally{fs.chmodSync(dir,0o755);fs.rmSync(dir,{recursive:true,force:true});}
}

// `fits`: --part changes what it measures (or is refused), and a re-run can take crew off a list as well as add them.
{
  const fs=require('node:fs'),dir=path.join(ROOT,'output',`affix-lab-sim-fits-${process.pid}`);
  fs.mkdirSync(dir,{recursive:true});
  try{
    const out=name=>path.relative(ROOT,path.join(dir,name)),read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')).fits.rows;
    const plain=sim(['fits','--out',out('plain.json')]),tax=sim(['fits','--part','tax','--out',out('tax.json')]);
    assert.equal(plain.status,0,plain.stderr);
    const refused=tax.status!==0&&/--part/.test(tax.stderr);
    const gains=rows=>JSON.stringify(Object.values(rows).map(r=>r.gains));
    assert.ok(refused||(tax.status===0&&gains(read('tax.json'))!==gains(read('plain.json'))),'fits --part tax measured the full conditions anyway');

    // Hanae belongs to no break or carry kit; with no attack, nothing of hers can be helped by Bore Bit, Shatter or Lens.
    const weak=sim(['fits','--set','Hanae.atk=0','--out',out('weak.json')]);
    assert.equal(weak.status,0,weak.stderr);
    const rows=read('weak.json'),kept=['borebit','shatter','lens'].filter(g=>rows[g].fits.includes('Hanae'));
    assert.deepEqual(kept,[],`a re-run cannot take Hanae off ${kept.join(', ')}`);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

// Results that a reader can trust: shoppers never buy an item nobody aboard can wear; a tie between policies is not
// credited to whichever policy is listed first; the saved file records every flag given; and route's averages count
// only voyages still under way.
{
  const fs=require('node:fs'),dir=path.join(ROOT,'output',`affix-lab-sim-results-${process.pid}`);
  fs.mkdirSync(dir,{recursive:true});
  try{
    const stranded=sim(['policies','--briefs','1','--seeds','1'],{
      setup:`let left=0;const act=M.act;M.act=function(s,a){const r=act.apply(this,arguments);if(a.type==='launch'&&s.phase==='done')left+=s.stash.length;return r;};`,
      report:'left'});
    assert.equal(stranded.status,0,stranded.stderr);
    assert.equal(stranded.report,0,`${stranded.report} items were bought and never worn`);

    const file=path.join(dir,'ties.json');
    const tied=sim(['policies','--briefs','1','--seeds','1','--econ','startCrew=6','--out',path.relative(ROOT,file)]);
    assert.equal(tied.status,0,tied.stderr);
    const out=JSON.parse(fs.readFileSync(file,'utf8')),names=Object.keys(out.policies.rows[0].results.best);
    for(const row of out.policies.rows)for(const [crew,winner] of Object.entries(row.winners)){
      if(!names.includes(winner))continue;
      const w=row.results[crew][winner],equal=names.filter(p=>p!==winner&&row.results[crew][p].integrity===w.integrity&&row.results[crew][p].score===w.score);
      assert.deepEqual(equal,[],`${crew}: ${winner} credited with a win it ties with ${equal.join(', ')}`);
    }

    // "Every tuning and economy value recorded": a crewmate's re-tuned stat is tuning too. Any record of it will do,
    // whether the setting as given or the value under that crewmate.
    const flagged=path.join(dir,'flags.json');
    const f=sim(['baseline','--seeds','1','--set','Reva.power=0.5','--out',path.relative(ROOT,flagged)]);
    assert.equal(f.status,0,f.stderr);
    const saved=JSON.parse(fs.readFileSync(flagged,'utf8'));
    const holds=o=>o&&typeof o==='object'&&(o.Reva&&o.Reva.power===0.5||Object.values(o).some(holds));
    assert.ok(/Reva\.power=0\.5/.test(JSON.stringify(saved))||holds(saved),'the results file does not record --set Reva.power=0.5');

    const routed=path.join(dir,'route.json');
    const r=sim(['route','--briefs','1','--seeds','1','--econ','startCrew=6','--out',path.relative(ROOT,routed)]);
    assert.equal(r.status,0,r.stderr);
    const crews=JSON.parse(fs.readFileSync(routed,'utf8')).route.rows.map(row=>row.crew);
    assert.ok(crews.every(c=>c===6),`six crew from the start, but route reports ${crews.join(', ')}`);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

console.log('PASS affix-lab sim');
