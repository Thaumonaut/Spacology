// Walk-mode capture at a URL query: node tools/__walk-view.cjs <port> <out.png> <query>
const {chromium}=require('playwright');
const [port,out,query]=process.argv.slice(2);
(async()=>{const b=await chromium.launch({headless:true,channel:'chrome'}),p=await b.newPage({viewport:{width:1280,height:800}});
p.on('pageerror',e=>console.log('pageerror',e.message));
await p.goto(`http://127.0.0.1:${port}/prototypes/microvoxel-world.html?seed=2718&extent=infinite&walk=1&${query}`);
await p.waitForFunction(()=>{const s=window.MicroWorldLab?.snapshot();return s&&(s.failed||s.visible>0&&s.ready===s.visible&&!s.pending);},null,{timeout:300000,polling:500});
await p.waitForTimeout(3000);await p.screenshot({path:out});
const s=await p.evaluate(()=>MicroWorldLab.snapshot());console.log('walk',JSON.stringify(s.walk),'yaw',s.camera?.yaw);
await b.close();})();
