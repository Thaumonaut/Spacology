// Affix lab page regressions: settings for the next voyage survive play, shown percentages agree with their band,
// and a double-click acts once. Headless by default; SPACOLOGY_HEADED=1 opts into a visible window.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173';

async function fresh(browser,seed,count){
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(BASE+'/prototypes/affix-lab.html');
  await page.selectOption('#affixCount',String(count));
  await page.fill('#seed',String(seed));
  await page.click('#setup button[type=submit]');
  return {page,errors,context};
}
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.spacologyAffixLabV1));

(async()=>{
  const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
  try{
    // The seed and condition count typed for the next voyage survive whatever happens in this one.
    {
      const {page,errors,context}=await fresh(browser,41,2);
      await page.click('button[data-action=hire][data-id=Reva]');
      await page.fill('#seed','364454');
      await page.selectOption('#affixCount','4');
      await page.click('button[data-action=hire][data-id=Sevim]');
      assert.equal(await page.inputValue('#seed'),'364454','an action reset the seed box');
      assert.equal(await page.inputValue('#affixCount'),'4','an action reset the condition count');
      await page.click('#setup button[type=submit]');
      const s=await saved(page);
      assert.equal(s.seed,364454);
      assert.equal(s.brief.affixes.length,4);
      assert.deepEqual(errors,[]);
      await context.close();
    }

    // A shown percentage never contradicts its band: "88% or better costs no integrity", so a loss never reads 88%.
    {
      const {page,errors,context}=await fresh(browser,6,2);
      await page.click('button[data-action=hire][data-id=Reva]');
      await page.click('button[data-action=hire][data-id=Sevim]');
      await page.click('button[data-action=launch]');
      await page.waitForSelector('#reportPanel:not([hidden]) .report');
      const s=await saved(page),r=s.results[0];
      const shown=Number((await page.locator('#reportPanel .band').textContent()).match(/(\d+)%/)[1]);
      const band=['perfect','slight','small','mild','heavy','total'],floor=[100,88,68,42,18,0],cap=[100,99,87,67,41,17];
      const i=band.indexOf(r.band);
      assert.ok(shown>=floor[i]&&shown<=cap[i],`score ${r.score} is ${r.band} but shows ${shown}%`);
      assert.deepEqual(errors,[]);
      await context.close();
    }

    // A double-click on Sell sells one item, not the one that moves under the cursor.
    {
      const {page,errors,context}=await fresh(browser,41,2);
      await page.click('button[data-action=hire][data-id=Reva]');
      await page.click('button[data-action=hire][data-id=Sevim]');
      await page.click('button[data-action=buy][data-index="0"]');
      await page.click('button[data-action=buy][data-index="1"]');
      const before=await saved(page);
      assert.equal(before.stash.length,2);
      await page.locator('button[data-action=sell][data-index="0"]').dblclick();
      const after=await saved(page);
      assert.equal(after.stash.length,1,`a double-click sold ${before.stash.length-after.stash.length} items`);
      assert.equal(after.gold,before.gold+2);
      assert.deepEqual(errors,[]);
      await context.close();
    }

    // What the player writes about a voyage is what the session log keeps: notes and ratings changed after saving either
    // reach the log, or cannot be changed once saved.
    {
      const {page,errors,context}=await fresh(browser,41,2);
      await page.evaluate(()=>{
        const M=window.AffixLab,s=M.createSession({seed:41,affixCount:2});
        M.act(s,{type:'recruit',id:'Reva'});M.act(s,{type:'recruit',id:'Sevim'});
        while(s.phase!=='done')M.act(s,{type:'launch'});
        Object.assign(s,{affixCount:2,saved:false,outcome:'',agency:'',excitement:'',notes:''});
        localStorage.spacologyAffixLabV1=JSON.stringify(s);
      });
      await page.reload();
      await page.fill('#notes','first note');
      await page.click('button[data-action=logSession]');
      if(await page.locator('#notes').isEditable())await page.fill('#notes','first note, plus what I added after saving');
      if(await page.locator('#agency').isEnabled())await page.selectOption('#agency','2');
      const shown={notes:await page.inputValue('#notes'),agency:await page.inputValue('#agency')};
      const logged=await page.evaluate(()=>{const list=JSON.parse(localStorage.spacologyAffixLabLogV1);return list[list.length-1];});
      assert.equal(logged.notes,shown.notes,'the session log keeps notes the page no longer shows');
      assert.equal(logged.agency,shown.agency,'the session log keeps a rating the page no longer shows');
      assert.deepEqual(errors,[]);
      await context.close();
    }

    // One voyage is one log entry, even with the lab open in two tabs, and clearing the log lets the current voyage be
    // saved again. (Two tabs editing at once is last-writer-wins, as for the voyage itself.)
    {
      const context=await browser.newContext({viewport:{width:1280,height:900}});
      const errors=[];
      const open=async()=>{const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
        await p.goto(BASE+'/prototypes/affix-lab.html');return p;};
      const finished=async(p,seed)=>{
        await p.evaluate(seed=>{
          localStorage.removeItem('spacologyAffixLabLogV1');
          const M=window.AffixLab,s=M.createSession({seed,affixCount:2,now:Date.now()});
          M.act(s,{type:'recruit',id:'Reva'});M.act(s,{type:'recruit',id:'Sevim'});
          while(s.phase!=='done')M.act(s,{type:'launch'});
          Object.assign(s,{affixCount:2,saved:false,outcome:'',agency:'',excitement:'',notes:''});
          localStorage.spacologyAffixLabV1=JSON.stringify(s);
        },seed);
        await p.reload();
      };
      const log=p=>p.evaluate(()=>JSON.parse(localStorage.spacologyAffixLabLogV1||'[]'));

      // Tab B still shows the voyage as unsaved when tab A saves it; B's typing must not let A log it a second time.
      const a=await open();await finished(a,44);
      const b=await open();
      await a.click('button[data-action=logSession]');
      await b.fill('#notes','typed in tab B');
      await a.reload();
      if(await a.locator('button[data-action=logSession]').isEnabled())await a.click('button[data-action=logSession]');
      assert.equal((await log(a)).length,1,'one voyage became two log entries');

      // Clearing the log: the voyage is no longer saved, so it can be saved again.
      await a.reload();
      await a.click('#clearLog');
      assert.equal((await log(a)).length,0);
      assert.ok(await a.locator('button[data-action=logSession]').isEnabled(),'after clearing the log, the voyage cannot be saved again');
      assert.deepEqual(errors,[]);
      await context.close();
    }

    // A voyage logged before voyages had ids (an older version of the lab): edits made now still reach its log entry.
    // And a finished voyage that was never logged is not thrown away without a word when a new voyage starts.
    {
      const {page,errors,context}=await fresh(browser,41,2);
      const dialogs=[];page.on('dialog',d=>dialogs.push(d.message()));
      await page.evaluate(()=>{
        const M=window.AffixLab,s=M.createSession({seed:41,affixCount:2});
        M.act(s,{type:'recruit',id:'Reva'});M.act(s,{type:'recruit',id:'Sevim'});
        while(s.phase!=='done')M.act(s,{type:'launch'});
        Object.assign(s,{affixCount:2,saved:true,outcome:'',agency:'3',excitement:'',notes:'old note'});
        localStorage.spacologyAffixLabV1=JSON.stringify(s);
        localStorage.spacologyAffixLabLogV1=JSON.stringify([{savedAt:'2026-10-06T10:00:00.000Z',seed:s.seed,affixes:s.brief.affixes,
          bosses:s.brief.bosses,plan:'',outcome:'',notes:'old note',agency:'3',excitement:'',integrity:s.integrity,finalCrew:s.crew.slice(),
          history:s.results.map(r=>({battle:r.battle,crew:r.crew,gear:r.gear,score:r.score})),purchases:s.purchases,wallSeconds:60}]);
      });
      await page.reload();
      if(await page.locator('#notes').isEditable())await page.fill('#notes','old note, plus a correction');
      const shown=await page.inputValue('#notes'),logged=await page.evaluate(()=>JSON.parse(localStorage.spacologyAffixLabLogV1));
      assert.equal(logged.length,1,'the older entry was duplicated');
      assert.equal(logged[0].notes,shown,'an edit to a voyage logged by an older version never reached its entry');

      // Finish a fresh voyage, rate it, and start another without saving.
      await page.evaluate(()=>{localStorage.removeItem('spacologyAffixLabLogV1');});
      await page.selectOption('#affixCount','2');await page.fill('#seed','41');await page.click('#setup button[type=submit]');
      await page.evaluate(()=>{
        const M=window.AffixLab,s=JSON.parse(localStorage.spacologyAffixLabV1);
        M.act(s,{type:'recruit',id:'Reva'});M.act(s,{type:'recruit',id:'Sevim'});
        while(s.phase!=='done')M.act(s,{type:'launch'});
        localStorage.spacologyAffixLabV1=JSON.stringify(s);
      });
      await page.reload();
      await page.selectOption('#agency','4');await page.fill('#notes','Sevim carried it');
      dialogs.length=0;
      await page.fill('#seed','42');await page.click('#setup button[type=submit]');
      const kept=await page.evaluate(()=>JSON.parse(localStorage.spacologyAffixLabLogV1||'[]').some(x=>x.notes==='Sevim carried it'));
      assert.ok(dialogs.length>0||kept,'a finished, rated voyage was discarded without a warning or a log entry');
      assert.deepEqual(errors,[]);
      await context.close();
    }
  }finally{await browser.close();}
  console.log('PASS affix-lab regressions');
})().catch(e=>{console.error(e);process.exit(1);});
