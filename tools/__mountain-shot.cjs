// Map views at a few spans and one Walk view at a location. Usage: node mountain.cjs <outdir> <prefix> <query> [spans...]
const {chromium}=require('playwright');
const [out,prefix,query,...spanArgs]=process.argv.slice(2),spans=spanArgs.length?spanArgs.map(Number):[400,1200];
const settled=p=>p.waitForFunction(()=>{const s=window.MicroWorldLab?.snapshot();return s&&(s.failed||s.visible>0&&s.ready>=s.visible*.85);},null,{timeout:240000});
(async()=>{const b=await chromium.launch({headless:true,channel:'chrome'}),p=await b.newPage({viewport:{width:1280,height:800}});
p.on('pageerror',e=>console.log('pageerror',e.message));
await p.goto('http://127.0.0.1:'+(process.env.PORT||4192)+'/prototypes/microvoxel-world.html?'+query);await settled(p);await p.mouse.move(640,400);
for(const target of spans){
  for(let i=0;i<80;i++){const s=await p.evaluate(()=>MicroWorldLab.snapshot().camera.span);if(Math.abs(Math.log(s/target))<.12)break;await p.mouse.wheel(0,s<target?120:-120);await p.waitForTimeout(60);}
  await p.waitForTimeout(1000);await settled(p);await p.waitForTimeout(1500);
  await p.screenshot({path:`${out}/${prefix}-map-${target}.png`,timeout:120000});console.log('map',target);
}
await p.evaluate(()=>MicroWorldLab.walk.enter());await p.waitForTimeout(2000);await settled(p);await p.waitForTimeout(2000);
await p.screenshot({path:`${out}/${prefix}-walk.png`,timeout:120000});
const s=await p.evaluate(()=>MicroWorldLab.snapshot());console.log('walk height',s.walk.height,'failed',s.failed);
await b.close();})();
