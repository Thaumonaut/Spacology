// Performance survey on real GPU (installed Chrome, headless). For each scenario: time until the view is fully ready,
// then frame p50/p95/p99 over a 4 s hold, draws, triangles, nodes, cache bytes and worker stage timings. A pan scenario
// holds an arrow key for 4 s and records frame times and how many nodes were still missing while moving.
// Usage: node perf.cjs <out.json> [base url]
const {chromium}=require('playwright'),fs=require('node:fs');
const [out,base='http://127.0.0.1:4192']=process.argv.slice(2);
const HOME='seed=2718&extent=infinite',PEAK='seed=2718&extent=infinite&cx=-414&cz=-454&lx=4&lz=4';
const ALL=[
  {name:'home-60',q:HOME,span:60},{name:'home-300',q:HOME,span:300},{name:'home-1200',q:HOME,span:1200},{name:'home-4000',q:HOME,span:4000},
  {name:'peak-300',q:PEAK,span:300},{name:'peak-1200',q:PEAK,span:1200},{name:'peak-4000',q:PEAK,span:4000},
  {name:'pan-home-300',q:HOME,span:300,pan:true},{name:'pan-peak-1200',q:PEAK,span:1200,pan:true},
  {name:'walk-home',q:HOME+'&walk=1'},{name:'walk-peak',q:PEAK+'&walk=1'}];
const scenarios=process.env.ONLY?ALL.filter(s=>process.env.ONLY.split(',').includes(s.name)):ALL;
const snap=p=>p.evaluate(()=>{const s=MicroWorldLab.snapshot();return {visible:s.visible,ready:s.ready,pending:s.pending,failed:s.failed,frame:[s.frameP50,s.frameP95,s.frameP99].map(v=>+(v||0).toFixed(1)),draws:s.drawCalls,triangles:s.triangles,cacheMiB:+((s.meshCacheBytes||0)/1048576).toFixed(1),level:s.stream?.level,drawn:s.stream?.drawn,inflight:s.stream?.inflight,workers:s.stream?.workers,timing:s.stream?.timing,span:s.camera.span};});
(async()=>{const b=await chromium.launch({headless:true,channel:'chrome',args:['--enable-gpu','--ignore-gpu-blocklist']}),results=[];
for(const sc of scenarios){
  const p=await b.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>console.log(sc.name,'pageerror',e.message));
  const t0=Date.now();await p.goto(`${base}/prototypes/microvoxel-world.html?${sc.q}`);
  await p.waitForFunction(()=>window.MicroWorldLab?.snapshot().visible>0,null,{timeout:120000});
  if(sc.span){await p.mouse.move(640,400);for(let i=0;i<120;i++){const s=await p.evaluate(()=>MicroWorldLab.snapshot().camera.span);if(Math.abs(Math.log(s/sc.span))<.1)break;await p.mouse.wheel(0,s<sc.span?120:-120);await p.waitForTimeout(40);}}
  const tz=Date.now();let readyMs=null;
  try{await p.waitForFunction(()=>{const s=MicroWorldLab.snapshot();return s.failed||s.visible>0&&s.ready===s.visible&&!s.pending;},null,{timeout:180000,polling:100});readyMs=Date.now()-tz;}catch{readyMs='timeout'}
  const r={name:sc.name,loadMs:Date.now()-t0,readyMs};
  if(sc.pan){
    await p.evaluate(()=>{window.__f=[];let last=performance.now();const tick=t=>{window.__f.push(t-last);last=t;if(window.__f.length<100000)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
    let missing=[];await p.keyboard.down('ArrowRight');for(let i=0;i<20;i++){await p.waitForTimeout(200);const s=await snap(p);missing.push(s.visible-s.ready);}await p.keyboard.up('ArrowRight');
    const f=await p.evaluate(()=>window.__f.slice(2).sort((a,b)=>a-b));const pc=q=>+(f[Math.min(f.length-1,Math.floor(f.length*q))]||0).toFixed(1);
    r.pan={frames:f.length,p50:pc(.5),p95:pc(.95),p99:pc(.99),max:+(f[f.length-1]||0).toFixed(1),missingNodes:missing};
    try{await p.waitForFunction(()=>{const s=MicroWorldLab.snapshot();return s.ready===s.visible&&!s.pending;},null,{timeout:120000,polling:100});}catch{}
  }
  await p.waitForTimeout(4000);Object.assign(r,await snap(p));results.push(r);console.log(JSON.stringify({...r,timing:undefined}));
  await p.close();
}
fs.writeFileSync(out,JSON.stringify(results,null,2));await b.close();})();
