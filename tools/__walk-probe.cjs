const{chromium}=require('playwright');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';
(async()=>{const b=await chromium.launch({headless:true});
const p=await b.newPage({viewport:{width:1280,height:800}});
const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
await p.goto(BASE+'/prototypes/microvoxel-world.html?seed=2718&extent=infinite&cx=-1&cz=-5&lx=4&lz=6');
for(let i=0;i<16;i++){await new Promise(r=>setTimeout(r,15000));
  const s=await p.evaluate(()=>window.MicroWorldLab?.snapshot()).catch(e=>String(e).slice(0,120));
  if(!s){console.log(i*15+'s no snapshot',errs);continue}
  console.log(`${(i+1)*15}s ready=${s.ready} visible=${s.visible} pending=${s.pending} level=${s.stream?.level} completed=${s.stream?.completed} failed=${s.failed} mode=${s.camera?.mode} err=${errs.length?errs[0]:''}`);
  if(s.ready===s.visible&&s.visible>0&&!s.pending&&!s.walk?.transitioning){await p.locator('#walk').click();console.log('clicked walk');}}
await b.close();})();
