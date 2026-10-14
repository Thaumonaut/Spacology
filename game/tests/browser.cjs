const {chromium}=((req)=>req('playwright'))(require('node:module').createRequire(require('node:path').join(__dirname,'..','..','package.json')));
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{execSync}=require('node:child_process');
const A=require('../../prototypes/aether-attunement-model.js');
const G=require('../../prototypes/gear-pack-model.js');
const PM=require('../../prototypes/pallet-stacking-model.js');

const GAME=path.resolve(__dirname,'..'),DIST=path.join(GAME,'dist');
const SHOTS=process.env.SHOTS||`/tmp/spacology-expedition-${Date.now()}`;
fs.mkdirSync(SHOTS,{recursive:true});
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.map':'application/json'};

function serve(){
  const server=http.createServer((req,res)=>{
    const p=decodeURIComponent((req.url||'/').split('?')[0]);
    const file=path.join(DIST,p==='/'?'index.html':p);
    if(!file.startsWith(DIST)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('not found');}
    res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r=>server.listen(0,'127.0.0.1',()=>r({server,url:`http://127.0.0.1:${server.address().port}`})));
}

const headless=process.env.SPACOLOGY_HEADED!=='1';
const AE=A.generate(4,'calm'),AS=AE.samples[0];
const GP=G.generate(2,'easy');
const PZ=PM.generate(3,'single');
const AUTO={
  gear:(()=>{const a=G.autoAssembly(GP),ev=G.evaluate(GP,a.state);return {met:ev.orders[0].met,tot:ev.orders[0].tot};})(),
  cargo:PM.auto(PZ).evaluation.shipped};

function watch(p,errors){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
const tab=(p,name)=>p.getByRole('button',{name:new RegExp('^'+name)});
const card=(p,id)=>p.locator('#open-'+id);
const KEY='spacologyExpeditionMockV1';
const stored=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
const storedRaw=p=>p.evaluate(k=>localStorage.getItem(k),KEY);
const shot=async(p,name)=>{await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:`${SHOTS}/${name}.png`,fullPage:true});};
const hOverflow=p=>p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
const innerOverflow=p=>p.evaluate(()=>{const f=document.querySelector('section.host:not([hidden]) iframe');
  const d=f.contentDocument.documentElement;return d.scrollWidth-d.clientWidth;});

async function openJob(p,job){
  await card(p,job).click();
  await p.locator('section.host:not([hidden])').waitFor();
  await assertWorkspaceHidden(p);
}
async function assertWorkspaceHidden(p){
  assert.equal(await p.locator('.workspace').isHidden(),true,'workspace hidden while a puzzle is open');
  assert.equal(await p.locator('section.host:not([hidden])').count(),1,'exactly one visible host');
}
const frame=(p,title)=>p.frameLocator(`section.host iframe[title="${title}"]`);

async function solveStudy(p,from=0){
  const f=frame(p,'Aether attunement boss study');
  for(const c of AS.plan.slice(from)){
    await f.locator(`[data-swatch="${A.ELEMENTS[c]}"]`).click();
    await f.locator('#aaCommit').click();
  }
  await f.locator('#mgResult').waitFor({state:'visible'});
}
async function solveAssembly(p){
  const f=frame(p,'Gear assembly');
  await f.locator('.gp-cell').first().waitFor();
  const cell=(o,x,y)=>f.locator(`#gpFrame${o} [data-cell="${y*GP.orders[o].w+x}"]`);
  for(const m of GP.solution){
    if(await f.locator('#gpRoot').getAttribute('data-sel')!==String(m.part))await f.locator(`#gpTray [data-part="${m.part}"]`).click();
    while(await f.locator('#gpRoot').getAttribute('data-rot')!==String(m.rot))await f.locator('#gpRotate').click();
    const pv=G.pivot(G.oriented(GP,m.part,m.rot));
    await cell(m.order,m.x+pv[0],m.y+pv[1]).click();
  }
  await f.locator('#gpShip').click();
  await f.locator('#mgResult').waitFor({state:'visible'});
}
async function solveCargo(p){
  const f=frame(p,'Rocket loading');
  await f.locator('.ps-card').first().waitFor();
  for(const m of PZ.plan){
    await f.locator(`.ps-card[data-crate="${m.crate}"]`).click();
    await f.locator(`.ps-col[data-pallet="${m.pallet}"][data-col="${PM.columnFor(PZ,m.crate,m.x)}"]`).click();
  }
  await f.locator('#psDispatch').click();
  await f.locator('#mgResult').waitFor({state:'visible'});
}
async function backToStation(p,title){await frame(p,title).locator('#mgAgain').click();await p.locator('.workspace:not([hidden])').waitFor();}

(async()=>{
  execSync('npm run build',{cwd:GAME,stdio:'pipe'});
  const {server,url:BASE}=await serve();
  const browser=await chromium.launch({headless});
  try{
    {
      const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
      const p=await ctx.newPage(),errors=[];watch(p,errors);
      await p.goto(BASE);
      await assert.doesNotReject(()=>p.getByRole('heading',{name:'Recover the ridge archive'}).waitFor());
      for(const t of ['Exploration','Research','Logistics'])await tab(p,t).waitFor();
      await p.locator('.badge',{hasText:'Local playtest · one browser'}).waitFor();
      await p.locator('.badge',{hasText:'Real puzzles · simulated encounter'}).waitFor();

      await p.locator('.map .pin-ridge').waitFor();
      await p.getByRole('button',{name:'Request Daven\'s field kit'}).click();
      await p.locator('.request-done',{hasText:'Kit requested'}).waitFor();
      assert.match(await tab(p,'Exploration').innerText(),/Kit requested/);
      await shot(p,'home-exploration-1440');

      await tab(p,'Logistics').click();
      await p.locator('.request-card',{hasText:'Guard ≥ 5 · Mend ≥ 3'}).waitFor();
      await shot(p,'home-logistics-1440');
      await tab(p,'Research').click();
      await p.locator('.boss-card h3',{hasText:'CURATOR // LAST INSTRUCTION'}).waitFor();
      await shot(p,'home-research-1440');

      await openJob(p,'study');
      const src=await p.locator('section.host iframe').getAttribute('src');
      assert.match(src,/embed=expedition/);assert.match(src,/task=study/);assert.match(src,/seed=4/);assert.match(src,/difficulty=calm/);
      const f0=frame(p,'Aether attunement boss study');
      await f0.locator('.aa-swatch').first().waitFor();
      assert.equal(await f0.locator('.mg-head').isHidden(),true);
      assert.equal(await f0.locator('#mgNew').isHidden(),true);
      assert.equal(await f0.locator('#mgDifficulty').isHidden(),true);
      assert.equal(await f0.locator('#mgAuto').isVisible(),true);
      assert.equal(await f0.locator('#mgHint').isVisible(),true);

      const token=/attempt=([^&]+)/.exec(src)[1];
      const realToken=decodeURIComponent(token);
      const payload=attempt=>({type:'spacology:minigame-result',version:1,task:'study',attempt,
        game:'aether-attunement',seed:4,difficulty:'calm',tier:'perfect',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed:['Archive lock'],weakened:[],weakness:'decay'}});
      await p.evaluate(d=>{const fr=document.querySelector('section.host iframe');
        window.dispatchEvent(new MessageEvent('message',{data:d.wrongSource,origin:location.origin,source:window}));
        window.dispatchEvent(new MessageEvent('message',{data:d.badOrigin,origin:'https://evil.example',source:fr.contentWindow}));
        window.dispatchEvent(new MessageEvent('message',{data:d.staleAttempt,origin:location.origin,source:fr.contentWindow}));
      },{wrongSource:payload(realToken),badOrigin:payload(realToken),staleAttempt:payload('bogus-attempt-token')});
      await p.waitForTimeout(300);
      assert.equal(await p.locator('section.host:not([hidden])').count(),1,'forged results rejected, host still open');
      let task=(await stored(p)).tasks.study;
      assert.equal(task.status,'active','forged messages leave the study active');
      assert.equal(task.receipt,null,'forged messages store no receipt');

      await f0.locator(`[data-swatch="${A.ELEMENTS[AS.plan[0]]}"]`).click();
      await f0.locator('#aaCommit').click();
      await p.locator('section.host:not([hidden]) .back').click();
      await p.locator('.workspace:not([hidden])').waitFor();
      assert.match(await card(p,'study').innerText(),/Resume the study/,'abandoning keeps the task open, not complete');
      await tab(p,'Logistics').click();
      await tab(p,'Research').click();
      await card(p,'study').click();
      await p.locator('section.host:not([hidden])').waitFor();
      assert.match(await frame(p,'Aether attunement boss study').locator('#mgMeters').innerText(),/1\s*\//,'in-progress move preserved across role switches');

      await solveStudy(p,1);
      assert.equal(await frame(p,'Aether attunement boss study').locator('#mgTier').innerText(),'Perfect');
      assert.match(await frame(p,'Aether attunement boss study').locator('#mgAgain').innerText(),/Return to station/);
      await backToStation(p,'Aether attunement boss study');
      await p.locator('.badges .removed',{hasText:'Removed · Archive lock'}).waitFor();
      await p.locator('.badges .weakness',{hasText:'Weakness found · decay'}).waitFor();
      assert.match(await tab(p,'Research').innerText(),/Study delivered/);

      await tab(p,'Logistics').click();
      assert.equal(await card(p,'dispatch').isEnabled(),false,'dispatch waits for the kit');
      await openJob(p,'assembly');
      await solveAssembly(p);
      await backToStation(p,'Gear assembly');
      await p.locator('#open-assembly .card-status',{hasText:'Built · Guard 5 / Mend 5'}).waitFor();
      assert.match(await p.locator('.link').innerText(),/still on the dock/);

      await openJob(p,'dispatch');
      const dsrc=await p.locator('section.host:not([hidden]) iframe').getAttribute('src');
      const dtoken=decodeURIComponent(/attempt=([^&]+)/.exec(dsrc)[1]);
      await p.evaluate(t=>{const fr=document.querySelector('section.host:not([hidden]) iframe');
        window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:fr.contentWindow,
          data:{type:'spacology:minigame-result',version:1,task:'dispatch',attempt:t,game:'pallet-stacking',seed:3,difficulty:'single',
            tier:'perfect',output:'forged',delivery:{kind:'cargo',shippedIds:[0,0,1],total:9}}}));
      },dtoken);
      await p.waitForTimeout(300);
      task=(await stored(p)).tasks.dispatch;
      assert.equal(task.status,'active','invalid cargo rejected on an active dispatch');
      assert.equal(task.receipt,null);
      await solveCargo(p);
      await backToStation(p,'Rocket loading');
      await p.locator('#open-dispatch .card-status',{hasText:'Kit aboard the convoy'}).waitFor();
      await p.locator('.crates .kit',{hasText:"Daven's kit"}).waitFor();

      await p.reload();
      await p.getByRole('heading',{name:'Recover the ridge archive'}).waitFor();
      assert.equal(await p.locator('section.host').count(),0,'completed jobs mount no fresh iframe after reload');
      await tab(p,'Research').click();
      const before=await storedRaw(p);
      await card(p,'study').click();
      await p.locator('.saved',{hasText:'SAVED DELIVERY'}).waitFor();
      await p.locator('.saved .badges .removed',{hasText:'Removed · Archive lock'}).waitFor();
      assert.equal(await p.locator('section.host').count(),0,'review shows the stored receipt, not a puzzle');
      assert.equal(await storedRaw(p),before,'opening a receipt does not rewrite storage');
      await p.locator('.saved .back').click();
      await p.locator('.workspace:not([hidden])').waitFor();
      await tab(p,'Logistics').click();
      await card(p,'assembly').click();
      await p.locator('.saved',{hasText:'Guard 5 · Pace 0 · Burst 0 · Mend 5'}).waitFor();
      await p.locator('.saved .back').click();

      await tab(p,'Exploration').click();
      await p.locator('.readiness b',{hasText:'aboard · Guard 5 / Mend 5'}).waitFor();
      assert.match(await p.locator('.readiness').innerText(),/11 vs 9/);
      await p.getByRole('button',{name:'Depart at dawn'}).click();
      await p.getByRole('heading',{name:'Ridge archive recovered'}).waitFor();
      await p.locator('.simtag',{hasText:'Simulated encounter'}).waitFor();
      await p.locator('.receipts li',{hasText:'Removed · Archive lock'}).waitFor();
      await shot(p,'report-1440');

      await p.reload();
      await p.getByRole('heading',{name:'Ridge archive recovered'}).waitFor();
      assert.equal(await p.locator('section.host').count(),0,'report phase mounts no iframes');
      assert.match(await p.locator('.objective').innerText(),/Expedition complete/);

      await p.evaluate(()=>localStorage.setItem('sentinelKey','keepme'));
      await p.locator('.report').getByRole('button',{name:'Try the expedition again'}).click();
      await p.locator('dialog.confirm').waitFor();
      await p.keyboard.press('Escape');
      await p.locator('dialog.confirm').waitFor({state:'detached'});
      await p.getByRole('heading',{name:'Ridge archive recovered'}).waitFor();
      await p.locator('.report').getByRole('button',{name:'Try the expedition again'}).click();
      await p.getByRole('dialog').getByRole('button',{name:'Cancel'}).click();
      await p.getByRole('heading',{name:'Ridge archive recovered'}).waitFor();
      await p.locator('.report').getByRole('button',{name:'Try the expedition again'}).click();
      await p.getByRole('dialog').getByRole('button',{name:'Start over'}).click();
      await tab(p,'Research').click();
      assert.match(await card(p,'study').innerText(),/Open the sample/,'reset clears receipts');
      assert.equal(await p.evaluate(()=>localStorage.getItem('sentinelKey')),'keepme','reset touches only the expedition key');
      assert.equal(await p.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k));return Object.values(s.tasks).every(t=>t.receipt===null);},KEY),true,'new run has empty receipts');
      assert.deepEqual(errors,[],'console/page errors: '+errors.join(';'));
      await ctx.close();
    }

    {
      const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
      const p=await ctx.newPage(),errors=[];watch(p,errors);
      await p.goto(BASE);

      await p.getByRole('button',{name:'Depart at dawn'}).click();
      const dlg=p.locator('dialog.confirm');
      await dlg.waitFor();
      assert.match(await dlg.innerText(),/will not affect this outing/);
      await p.getByRole('dialog').getByRole('button',{name:'Depart',exact:true}).click();
      await p.getByRole('heading',{name:'A partial expedition'}).waitFor();
      assert.match(await p.locator('.report').innerText(),/5 vs 9|strength 5 could not meet the encounter's 9/i);

      await p.locator('.report').getByRole('button',{name:'Try the expedition again'}).click();
      await p.getByRole('dialog').getByRole('button',{name:'Start over'}).click();
      await tab(p,'Research').click();
      await openJob(p,'study');
      await frame(p,'Aether attunement boss study').locator('#mgAuto').click();
      await backToStation(p,'Aether attunement boss study');
      await p.locator('.badges .weakened',{hasText:'Weakened · Archive lock'}).waitFor();
      await tab(p,'Logistics').click();
      await openJob(p,'assembly');
      await frame(p,'Gear assembly').locator('#mgAuto').click();
      await backToStation(p,'Gear assembly');
      if(AUTO.gear.met){
        await p.locator('#open-assembly .card-status',{hasText:`Built · Guard ${AUTO.gear.tot.Guard} / Mend ${AUTO.gear.tot.Mend}`}).waitFor();
      }
      await openJob(p,'dispatch');
      await frame(p,'Rocket loading').locator('#mgAuto').click();
      await backToStation(p,'Rocket loading');
      if(AUTO.cargo.includes(0))await p.locator('#open-dispatch .card-status',{hasText:'Kit aboard the convoy'}).waitFor();
      await p.locator('.crates li').first().waitFor();
      assert.equal(await p.locator('.crates li').count(),AUTO.cargo.length,'delivered crate list matches the model');

      await tab(p,'Research').click();
      await p.getByRole('button',{name:'Retry with a fresh sample'}).click();
      await frame(p,'Aether attunement boss study').locator('.aa-swatch').first().waitFor();
      await p.reload();
      await p.locator('.notice',{hasText:'Unfinished puzzles restart after reload; completed deliveries are saved.'}).waitFor();
      await tab(p,'Logistics').click();
      await p.locator('#open-assembly .card-status',{hasText:'Built'}).waitFor();
      await tab(p,'Research').click();
      assert.match(await card(p,'study').innerText(),/Open the sample/,'interrupted study is idle again after reload');
      const t2=(await stored(p)).tasks.study;
      assert.equal(t2.status,'idle');assert.equal(t2.attempt,2,'attempt counter kept');
      await openJob(p,'study');
      const src2=await p.locator('section.host:not([hidden]) iframe').getAttribute('src');
      assert.match(src2,/attempt=[^&]*study%3A3|:study:3/,'restarted attempt uses a new token');
      await p.locator('section.host:not([hidden]) .back').click();

      await p.getByRole('button',{name:'Start over'}).click();
      await p.getByRole('dialog').getByRole('button',{name:'Start over'}).click();
      await tab(p,'Logistics').click();
      await openJob(p,'assembly');
      await solveAssembly(p);
      await backToStation(p,'Gear assembly');
      await openJob(p,'dispatch');
      const f=frame(p,'Rocket loading');
      await f.locator('.ps-card').first().waitFor();
      await f.locator('#psDispatch').click();
      await f.locator('#mgResult').waitFor({state:'visible'});
      await backToStation(p,'Rocket loading');
      await p.locator('#open-dispatch .card-status',{hasText:'Kit left behind'}).waitFor();
      await p.getByRole('button',{name:'Load the convoy again'}).click();
      await p.locator('section.host:not([hidden])').waitFor();
      const src3=await p.locator('section.host:not([hidden]) iframe').getAttribute('src');
      assert.match(src3,/attempt=[^&]*dispatch%3A2|:dispatch:2/,'retry mounts a fresh attempt');
      assert.deepEqual(errors,[],'console/page errors: '+errors.join(';'));
      await ctx.close();
    }

    {
      const ctx=await browser.newContext({viewport:{width:1024,height:768},reducedMotion:'reduce'});
      const p=await ctx.newPage(),errors=[];watch(p,errors);
      await p.goto(BASE);
      await p.locator('.map').waitFor();
      await shot(p,'home-exploration-1024');
      await tab(p,'Research').click();await p.locator('.bench').waitFor();
      await shot(p,'home-research-1024');
      await tab(p,'Logistics').click();await p.locator('.bay').waitFor();
      await shot(p,'home-logistics-1024');
      assert.ok(await hOverflow(p)<=1,'horizontal overflow at 1024 home');

      await tab(p,'Research').click();
      await openJob(p,'study');
      await frame(p,'Aether attunement boss study').locator('.aa-swatch').first().waitFor();
      assert.ok(await hOverflow(p)<=1,'outer overflow with study frame at 1024');
      assert.ok(await innerOverflow(p)<=1,'inner overflow in study frame at 1024');
      assert.equal(await frame(p,'Aether attunement boss study').locator('#mgAuto').isVisible(),true,'controls reachable at 1024');
      await frame(p,'Aether attunement boss study').locator(`[data-swatch="${A.ELEMENTS[AS.plan[0]]}"]`).click();
      await frame(p,'Aether attunement boss study').locator('#aaCommit').click();
      await p.locator('section.host:not([hidden]) .back').click();

      await tab(p,'Logistics').click();
      await openJob(p,'assembly');
      await solveAssembly(p);
      assert.ok(await hOverflow(p)<=1,'outer overflow with assembly frame at 1024');
      assert.ok(await innerOverflow(p)<=1,'inner overflow in assembly frame at 1024');
      assert.equal(await frame(p,'Gear assembly').locator('#mgAuto').isVisible(),true);
      await shot(p,'puzzle-assembly-1024');
      await p.locator('section.host:not([hidden]) .back').click();
      await p.locator('.workspace:not([hidden])').waitFor();

      await openJob(p,'dispatch');
      const fc=frame(p,'Rocket loading');
      await fc.locator('.ps-card').first().waitFor();
      assert.ok(await hOverflow(p)<=1,'outer overflow with cargo frame at 1024');
      assert.ok(await innerOverflow(p)<=1,'inner overflow in cargo frame at 1024');
      assert.equal(await fc.locator('#mgAuto').isVisible(),true);
      await fc.locator(`.ps-card[data-crate="${PZ.plan[0].crate}"]`).click();
      await fc.locator(`.ps-col[data-pallet="${PZ.plan[0].pallet}"][data-col="${PM.columnFor(PZ,PZ.plan[0].crate,PZ.plan[0].x)}"]`).click();
      assert.deepEqual(errors,[],'console/page errors: '+errors.join(';'));
      await ctx.close();
    }

    {
      const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true});
      const p=await ctx.newPage(),errors=[];watch(p,errors);
      await p.goto(BASE);
      await p.locator('.map').waitFor();
      assert.ok(await hOverflow(p)<=1,'exploration overflow at 390');
      await tab(p,'Research').click();await p.locator('.bench').waitFor();
      assert.ok(await hOverflow(p)<=1,'research overflow at 390');
      await tab(p,'Logistics').click();await p.locator('.bay').waitFor();
      assert.ok(await hOverflow(p)<=1,'logistics overflow at 390');
      assert.deepEqual(errors,[],'console/page errors: '+errors.join(';'));
      await ctx.close();
    }

    {
      const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
      await ctx.addInitScript(()=>{
        if(window===window.top){
          Storage.prototype.getItem=function(){throw new DOMException('denied','SecurityError');};
          Storage.prototype.setItem=function(){throw new DOMException('denied','SecurityError');};
        }});
      const p=await ctx.newPage(),errors=[];watch(p,errors);
      await p.goto(BASE);
      await p.getByRole('heading',{name:'Recover the ridge archive'}).waitFor();
      await p.locator('.warn').waitFor();
      await tab(p,'Research').click();
      await openJob(p,'study');
      await frame(p,'Aether attunement boss study').locator('.aa-swatch').first().waitFor();
      await p.locator('section.host:not([hidden]) .back').click();
      await p.locator('.workspace:not([hidden])').waitFor();
      assert.deepEqual(errors,[],'console/page errors without storage: '+errors.join(';'));
      await ctx.close();
    }

    {
      const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
      await ctx.addInitScript(key=>localStorage.setItem(key,JSON.stringify({
        version:1,runId:'broken',phase:'night',destination:'ridge',approach:'careful',requested:false,
        tasks:{study:{attempt:0,status:'complete',receipt:null},assembly:{attempt:0,status:'idle',receipt:null},dispatch:{attempt:0,status:'idle',receipt:null}},
        report:null,log:[]})),KEY);
      const p=await ctx.newPage(),errors=[];watch(p,errors);
      await p.goto(BASE);
      await p.getByRole('heading',{name:'Recover the ridge archive'}).waitFor();
      await tab(p,'Research').click();
      assert.match(await card(p,'study').innerText(),/Open the sample/,'corrupt save falls back to a fresh session');
      assert.deepEqual(errors,[],'console/page errors with corrupt save: '+errors.join(';'));
      await ctx.close();
    }

    console.log(`PASS expedition browser: real solves (study Perfect, kit Guard 5 / Mend 5 built and flown, 9 crates away) drive the report; forged and malformed messages rejected; move survives role switches; saved receipts render without iframes after reload; autos and empty dispatch stay honest; storage denial and corrupt saves stay playable; screenshots in ${SHOTS}`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
