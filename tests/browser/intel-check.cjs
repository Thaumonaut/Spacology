// Manifest checking (intel-check): loads fixed seeds headlessly at desktop, iPad landscape and phone widths; checks
// touch targets, no horizontal overflow, the manifest fitting 1024×768 unscrolled, tabs with the NEW badge, the
// destination line, a Classic two-tap wrong-line comparison with its gentle suggestion, one-tap compare in Quick with
// the relevant tab and line lit, stamp + undo, a hint; then plays every manifest by one-tap checks to Perfect, stamping
// with buttons, the V/F keys, 1–9 keys and swipes, and skips the flying-card animation with a tap; the result card
// lists the shipments cleared. A sloppy round (reduced motion) earns a citation slip with "show me", reviews and undoes
// from the progress strip, runs Check all, and ends Partial with citations and the sabotage that slipped through.
// Skip runs the automatic fallback. Then a falsified specimen crate and a forged seal are found by tapping, with the
// guide entry or roster line lit and the mismatching detail circled. Veteran loads and fits; one night of the night
// shift is played to night 2's NEW RULE banner, and three mistakes end the shift with a saved personal best.
// Run with `node tests/run.cjs intel-check`. SHOTS=dir saves screenshots.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const M=require('../../prototypes/minigames/intel-check/intel-check-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
async function noOverflow(p,where){const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
async function targets(p,where){
  const small=await p.evaluate(()=>[...document.querySelectorAll('#mgStage button')].map(b=>{const r=b.getBoundingClientRect();return {t:b.textContent.trim().slice(0,20),w:r.width,h:r.height};}).filter(r=>r.w&&(r.w<44||r.h<44)));
  assert.deepEqual(small,[],'touch targets ≥44px on '+where);
}
const RUNS=[{viewport:{width:1280,height:900},difficulty:'hard',seed:11},{viewport:{width:1024,height:768},difficulty:'expert',seed:23},{viewport:{width:390,height:844},difficulty:'normal',seed:5}];
const css=s=>s.replace(/"/g,'\\"');
(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  for(const {viewport,difficulty,seed} of RUNS){
    const tag=viewport.width,p=await browser.newPage({serviceWorkers:'block',viewport}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async n=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/intel-${n}-${tag}.png`});};
    const field=f=>p.locator(`#icReport .ic-field[data-field="${f}"]`),entry=e=>p.locator(`.ic-entry[data-entry="${css(e)}"]`);
    const docOf=e=>M.docOfEntry(e);
    const onReport=async i=>{await p.locator(`#icReport[data-report="${i}"]`).waitFor();await p.locator('#icVerified:enabled').waitFor();};
    const swipe=async dir=>{
      await p.locator('#icReport').evaluate(e=>e.scrollIntoView({block:'center'}));const b=await p.locator('#icReport').boundingBox();
      const x=b.x+b.width/2,y=Math.min(b.y+b.height/2,viewport.height-80);await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dir*50,y,{steps:3});await p.mouse.move(x+dir*140,y+4,{steps:4});await p.mouse.up();
    };
    const stampBy=async(how,verdict)=>{
      if(how==='key')await p.keyboard.press(verdict==='forged'?'f':'v');
      else if(how==='swipe')await swipe(verdict==='forged'?-1:1);
      else await p.locator(verdict==='forged'?'#icForged':'#icVerified').click();
    };
    const stampNext=async(pz,i,verdict,how='button')=>{await stampBy(how,verdict);if(i+1<pz.reports.length)await onReport(i+1);};
    const pz=M.generate(seed,difficulty);
    await p.goto(`${BASE}/prototypes/intel-check.html?seed=${seed}&difficulty=${difficulty}`);
    await onReport(0);
    assert.equal(await p.locator('.ic-tab').count(),pz.docs.length,'one tab per document at this level');
    assert.equal(await p.locator('.ic-entry').count(),M.entries(pz).filter(e=>!e.startsWith('log:')).length,'every line on the desk (the log starts empty)');
    assert.equal(await p.locator('.ic-doc:not([hidden])').count(),1,'one document visible at a time');
    assert.match(await p.locator('#mgStatus').innerText(),/^NEW RULE · /);assert.equal(await p.locator('.ic-tab .ic-new').count(),new Set([...pz.intro.docs,...pz.intro.rules]).size,'new documents and rules are badged');
    assert.equal(await p.locator('.ic-doc header .ic-new').count(),new Set([...pz.intro.docs,...pz.intro.rules]).size);
    assert.equal(await p.locator('[data-assist="quick"]').getAttribute('aria-checked'),'true','Quick is the default assist');
    await targets(p,'start '+tag);await noOverflow(p,'start '+tag);await shot('start');
    if(tag===1024){const box=await p.locator('#icReport').boundingBox();assert.equal(await p.evaluate(()=>scrollY),0);assert.ok(box.y+box.height<=768,`manifest fits unscrolled (bottom ${box.y+box.height})`);}
    assert.equal(await p.locator('#icReport .ic-dest').getAttribute('data-dest'),pz.reports[0].dest,'the manifest shows its destination');
    assert.match(await p.locator('#icReport .eyebrow').innerText(),/^MANIFEST · 1 OF /);

    // Classic: tapping a field lights its lines and opens its tab; another depot's line is a gentle "wrong line".
    const r0=pz.reports[0],other=pz.regions.find(r=>r!==r0.region);
    await p.locator('[data-assist="classic"]').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('spacologyIntelCheckDesk')).assist),'classic','assist saved');
    await field('callsign').click();assert.match(await field('callsign').getAttribute('class'),/ic-sel/);
    assert.equal(await p.locator('.ic-tab[data-tab="roster"]').getAttribute('aria-selected'),'true','the roster tab opens');
    assert.equal(await p.locator(`.ic-entry.ic-rel[data-entry="${css('roster:'+r0.region)}"]`).count(),1,'the depot\'s roster line lights up');
    await entry('roster:'+other).click();
    assert.match(await p.locator('#icInspect').innerText(),/WRONG LINE.*Compare the callsign with the .* line of the depot roster/s);assert.doesNotMatch(await p.locator('#icEvidence').getAttribute('class'),/found/);
    await p.locator('[data-assist="quick"]').click();

    // Quick: one tap compares the field with its line, opens the tab and lights the line.
    const f0=r0.forged?r0.tell.field:r0.trap.field,e0=r0.forged?r0.tell.entry:r0.trap.entry;
    if(docOf(e0)!=='roster')await p.locator('.ic-tab[data-tab="roster"]').click();
    await field(f0).click();
    assert.match(await field(f0).getAttribute('class'),r0.forged?/ic-bad/:/ic-ok/);assert.match(await p.locator('#icInspect').innerText(),r0.forged?/DISCREPANCY/:/MATCH/);
    assert.equal(await p.locator(`.ic-tab[data-tab="${docOf(e0)}"]`).getAttribute('aria-selected'),'true','the relevant tab is auto-selected');
    assert.match(await entry(e0).getAttribute('class'),/ic-focus/);assert.ok(await entry(e0).isVisible());
    if(r0.forged)assert.match(await p.locator('#icEvidence').innerText(),/EVIDENCE/);

    // Stamp the first manifest correctly, then undo: it comes back with its evidence.
    await stampNext(pz,0,r0.forged?'forged':'verified');
    assert.equal(await p.locator('#icStrip button.ic-cell').count(),1);assert.match(await p.locator('#icTick').innerText(),new RegExp(`^Convoy ${r0.callsign} is (loading for|held at|grounded at) `));
    await p.locator('#mgUndo').click();await onReport(0);
    assert.equal(await p.locator('#icStrip button.ic-cell').count(),0);assert.equal(await p.locator('#mgUndo').isDisabled(),true);
    if(r0.forged)assert.match(await p.locator('#icEvidence').innerText(),/EVIDENCE/,'evidence survives the undo');

    // Hint points at a field and a line, without saying which way to stamp, and opens that line's tab.
    const h=M.hint(pz,M.create(pz));
    await p.locator('#mgHint').click();assert.equal(await p.locator('#mgStatus').innerText(),'Hint: '+h.text);
    assert.equal(await p.locator(`.ic-field.ic-hint[data-field="${h.field}"]`).count(),1);assert.equal(await p.locator(`.ic-entry.ic-hint[data-entry="${css(h.entry)}"]`).count(),1);
    assert.equal(await p.locator(`.ic-tab[data-tab="${docOf(h.entry)}"]`).getAttribute('aria-selected'),'true');
    await shot('hint');

    // Play to Perfect by one-tap checks: sabotage by its planted field, genuine manifests by the near-miss detail.
    // Stamps rotate through buttons, the V/F keys and swipes; checks rotate through taps and the 1–9 keys.
    for(const [i,r] of pz.reports.entries()){
      const f=r.forged?r.tell.field:r.trap.field;
      const key=M.fields(r).indexOf(f)+1;if(i%2&&key<=9)await p.keyboard.press(String(key));else await field(f).click();
      if(r.forged){
        assert.match(await p.locator('#icEvidence').getAttribute('class'),/found/);assert.match(await p.locator('#icInspect').innerText(),/DISCREPANCY/);
        assert.match(await field(f).getAttribute('class'),/ic-bad/);assert.match(await entry(r.tell.entry).getAttribute('class'),/ic-focus/);
      }else{
        assert.match(await p.locator('#icInspect').innerText(),/MATCH/);assert.match(await field(f).getAttribute('class'),/ic-ok/);
        assert.doesNotMatch(await p.locator('#icEvidence').getAttribute('class'),/found/);
      }
      if(i===1)await shot('evidence');
      if(i===0){
        // The stamped card flies off over the next one, which is already in place; any tap skips the flight.
        const n=await p.evaluate(v=>{document.getElementById(v==='forged'?'icForged':'icVerified').click();const g=document.querySelectorAll('.ic-ghost').length,next=document.querySelector('#icReport').dataset.report;
          document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return [g,next,document.querySelectorAll('.ic-ghost').length];},r.forged?'forged':'verified');
        assert.deepEqual(n,[1,'1',0],'ghost card in flight, next card in place, a tap skips');
        await onReport(1);continue;
      }
      await stampNext(pz,i,r.forged?'forged':'verified',['button','key','swipe'][i%3]);
    }
    await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Perfect');assert.equal(await p.locator('#mgNear').isHidden(),true);
    {const out=await p.locator('#mgProduces').innerText(),nf=pz.reports.filter(r=>r.forged).length;
      assert.ok(out.startsWith(`Delivered: Shipments cleared: ${pz.reports.length-nf} verified, ${nf} sabotaged convoy${nf===1?'':'s'} stopped. Cleared: `),out);
      assert.doesNotMatch(out,/Slipped through|sabotaged convoy\]/);}
    await p.waitForFunction(()=>!document.querySelector('.ic-ghost'),null,{timeout:2000});
    await noOverflow(p,'result '+tag);await shot('result');

    // A sloppy round (reduced motion, so it runs fast): clear the first sabotaged convoy and get a citation at once.
    await p.emulateMedia({reducedMotion:'reduce'});
    await p.locator('#mgAgain').click();await p.locator('#mgResult').waitFor({state:'hidden'});
    const pz2=M.generate(seed+1,difficulty),first=pz2.reports.findIndex(r=>r.forged);await onReport(0);
    const verdicts=pz2.reports.map((r,i)=>r.forged&&i!==first?'forged':'verified'),st2=M.create(pz2);
    for(let i=0;i<=first;i++){await stampNext(pz2,i,verdicts[i]);M.apply(pz2,st2,{type:'stamp',verdict:verdicts[i]});}
    const cite=M.citation(pz2,st2,first),fr=pz2.reports[first];
    await p.locator('#icSlip').waitFor({state:'visible'});
    assert.equal(await p.locator('#icSlip p').innerText(),cite.text);assert.ok(cite.text.startsWith(`CITATION · Manifest ${first+1} was Null sabotage: `));
    assert.match(await p.locator('#icTick').getAttribute('class'),/bad/,'the tick turns red when sabotaged paperwork is loading');
    assert.match(await p.locator(`#icStrip [data-review="${first}"]`).getAttribute('class'),/wrong/);
    await targets(p,'citation '+tag);await noOverflow(p,'citation '+tag);await shot('citation');
    // "Show me" reviews the sabotaged manifest with the field and the line that proved it.
    await p.locator('#icShowMe').click();await p.locator(`#icReport[data-report="${first}"].ic-reviewing`).waitFor();
    assert.equal(await p.locator(`#icReport .ic-field.ic-proof[data-field="${fr.tell.field}"]`).count(),1);
    assert.equal(await p.locator(`.ic-entry.ic-proof[data-entry="${css(fr.tell.entry)}"]`).count(),1);
    assert.equal(await p.locator(`.ic-tab[data-tab="${docOf(fr.tell.entry)}"]`).getAttribute('aria-selected'),'true');
    await shot('showme');
    await p.locator('#icBack').click();await onReport(first+1);
    // Reviewing from the strip offers Undo back to that card; then restamp the same way.
    if(first>0){
      await p.locator('#icStrip [data-review="0"]').click();await p.locator('#icReport[data-report="0"].ic-reviewing').waitFor();
      await p.locator('#icUndoTo').click();await onReport(0);assert.equal(await p.locator('#icStrip button.ic-cell').count(),0);
      for(let i=0;i<=first;i++)await stampNext(pz2,i,verdicts[i]);
    }
    // Check all on the next manifest: every checkable field is marked, and sabotage evidence is found.
    const nx=first+1;
    if(nx<pz2.reports.length){
      await p.locator('#icCheckAll').click();
      const unmarked=await p.locator('#icReport .ic-field:not(.ic-na):not(.ic-ok):not(.ic-bad)').count();assert.equal(unmarked,0,'Check all marks every field');
      if(pz2.reports[nx].forged)assert.match(await p.locator('#icEvidence').getAttribute('class'),/found/);
      else assert.equal(await p.locator('#icReport .ic-field.ic-bad').count(),0,'a genuine manifest shows no ✗');
      assert.match(await p.locator('#mgStatus').innerText(),/capped at Good/);
    }
    for(let i=first+1;i<pz2.reports.length;i++)await stampNext(pz2,i,verdicts[i],i%2?'key':'button');
    verdicts.slice(first+1).forEach(v=>M.apply(pz2,st2,{type:'stamp',verdict:v}));
    await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Partial');
    assert.equal(await p.locator('#mgNear').innerText(),M.nearMiss(pz2,st2));assert.match(await p.locator('#mgNear').innerText(),/was Null sabotage; its .* gave it away/);
    assert.ok((await p.locator('#mgHeadline').innerText()).includes(M.consequences(pz2,st2)[0]),'consequence line on the result card');
    assert.match(await p.locator('#mgHeadline').innerText(),/1 citation on file: manifest \d+\./);
    assert.match(await p.locator('#mgProduces').innerText(),new RegExp(`Slipped through: 1 sabotaged convoy \\(manifest ${first+1}\\)\\.`));assert.match(await p.locator('#mgProduces').innerText(),/\[includes a sabotaged convoy\]/);await shot('near');

    // Skip runs the automatic fallback: everything VERIFIED, sabotaged convoys slip through.
    await p.locator('#mgAgain').click();await p.locator('#mgResult').waitFor({state:'hidden'});await onReport(0);
    const pz3=M.generate(seed+2,difficulty),a=M.auto(pz3);
    await p.locator('#mgAuto').click();await p.locator('#mgResult').waitFor({state:'visible'});
    assert.equal(await p.locator('#mgTier').innerText(),'Automatic');assert.notEqual(M.tier(pz3,a.evaluation),'perfect');
    assert.match(await p.locator('#mgHeadline').innerText(),new RegExp(`${a.evaluation.approved.length} sabotaged convoys? slipped through`));
    assert.equal(await p.locator('#mgNear').innerText(),M.nearMiss(pz3,a.state));
    await noOverflow(p,'auto '+tag);

    // Field guide: a falsified specimen label is ✗, the guide entry lights up and the mismatching part is circled.
    const find=(d,pred)=>{for(let s=1;s<400;s++){const z=M.generate(s,d),i=z.reports.findIndex(pred);if(i>=0)return {seed:s,pz:z,i};}throw new Error('no desk for '+d);};
    const playTo=async(z,i)=>{for(let k=0;k<i;k++){await p.keyboard.press(z.reports[k].forged?'f':'v');await onReport(k+1);}};
    for(const [d,pred,check] of [['easy',r=>r.forged&&/^guide-/.test(r.tell.rule),'guide'],['normal',r=>r.forged&&r.tell.rule==='seal','seal']]){
      const {seed:s2,pz:z,i}=find(d,pred),r=z.reports[i];
      await p.goto(`${BASE}/prototypes/intel-check.html?seed=${s2}&difficulty=${d}`);await onReport(0);await playTo(z,i);
      await field(r.tell.field).click();
      assert.match(await field(r.tell.field).getAttribute('class'),/ic-bad/);
      assert.equal(await p.locator(`.ic-tab[data-tab="${check==='guide'?'guide':'roster'}"]`).getAttribute('aria-selected'),'true');
      assert.match(await entry(r.tell.entry).getAttribute('class'),/ic-focus/);
      const miss=await field(r.tell.field).getAttribute('data-miss');
      if(check==='guide'){assert.ok(r.tell.field.startsWith('spec:'));assert.equal(await p.locator('#icReport .ic-dest').getAttribute('data-dest'),M.LAB,'specimen crates ship to the lab');assert.equal(miss,r.tell.rule.replace('guide-',''),'the mismatching part of the label is circled');assert.ok(await field(r.tell.field).locator('.miss-'+miss).isVisible());}
      else{const w=z.seals[r.region];assert.equal(miss,['ring','points','glyph'].find(k=>r.seal[k]!==w[k]),'the seal detail is circled');assert.ok(await field('seal').locator('.ic-seal .miss-'+miss).isVisible());}
      assert.match(await p.locator('#icEvidence').innerText(),/EVIDENCE/);
      await targets(p,check+' '+tag);await noOverflow(p,check+' '+tag);await shot(check);
    }

    // Veteran: the longest desk still fits and has every document.
    await p.goto(`${BASE}/prototypes/intel-check.html?seed=${seed}&difficulty=veteran`);await onReport(0);
    const vet=M.generate(seed,'veteran');assert.equal(await p.locator('.ic-tab').count(),vet.docs.length);assert.equal(await p.locator('.ic-rule').count(),5,'five tells');
    assert.equal(await p.locator('#icStrip .ic-cell').count(),vet.reports.length);
    if(tag===1024){const box=await p.locator('#icReport').boundingBox();assert.ok(box.y+box.height<=768,`Veteran manifest fits unscrolled (bottom ${box.y+box.height})`);}
    await targets(p,'veteran '+tag);await noOverflow(p,'veteran '+tag);

    // The night shift: play one night right, see night 2's NEW RULE banner, then three mistakes end the run with a best.
    await p.evaluate(k=>localStorage.removeItem(k),M.BEST_KEY);
    await p.goto(`${BASE}/prototypes/intel-check.html?seed=${seed}&difficulty=endless`);await onReport(0);
    const d1=M.endlessDay(seed,1),d2=M.endlessDay(seed,2);
    assert.match(await p.locator('#icBanner').innerText(),/^NIGHT 1 · NEW RULE/);assert.equal(await p.locator('.ic-timer i').count(),1,'a timer bar on the manifest');
    for(const [i,r] of d1.reports.entries()){
      if(r.forged)await field(r.tell.field).click();
      await p.keyboard.press(r.forged?'f':'v');
      if(i+1<d1.reports.length)await onReport(i+1);
    }
    await p.locator('#icReport[data-report="0"]').waitFor();await p.locator('#icBanner').getByText('NIGHT 2 · NEW RULE').waitFor();
    assert.match(await p.locator('#mgStatus').innerText(),/^NEW RULE · Night 2: /);assert.match(await p.locator('#icReport .eyebrow').innerText(),/^NIGHT 2 · /);
    assert.equal(await p.locator('.ic-tab[data-tab="rules"]').getAttribute('aria-selected'),'true','the regulations open on a new night');
    assert.equal(await p.locator(`.ic-rule[data-entry="rule:${d2.endless.change.added}"] .ic-new`).count(),1,'the new tell is badged');
    assert.equal(await p.locator('.ic-rule').count(),d2.rules.length);
    const meter=async l=>p.locator('.mg-meter',{hasText:l}).locator('b').innerText();
    assert.equal(await meter('Cleared'),'6');assert.equal(await meter('Mistakes'),'0 / 3');assert.equal(await p.locator('#mgUndo').isDisabled(),true,'no undo on the shift');
    await targets(p,'endless '+tag);await noOverflow(p,'endless '+tag);await shot('endless');
    for(let i=0;i<3;i++){await p.keyboard.press(d2.reports[i].forged?'v':'f');if(i<2)await onReport(i+1);}
    await p.locator('#mgResult').waitFor({state:'visible'});
    assert.match(await p.locator('#mgHeadline').innerText(),/^Shift over on night 2: 6 manifests cleared\. New personal best \(was 0\)\./);
    assert.equal(await p.evaluate(k=>localStorage.getItem(k),M.BEST_KEY),'6','personal best saved');
    await p.locator('#mgAgain').click();await onReport(0);assert.equal(await meter('Best'),'6');

    assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS intel-check (manifests): tabs with NEW DOCUMENT/NEW RULE badges, destination line, ≥44px targets, no overflow at 1280/1024/390, manifest fits 1024×768 unscrolled, Classic two-tap wrong line with suggestion, Quick one-tap with tab and line lit, stamp + undo keeps evidence, convoy tick, verdict-neutral hint, Perfect by one-tap checks with button/key/swipe stamps and 1–9 keys, flying card skipped by a tap, shipments-cleared output, citation slip with show-me review, strip review and undo, Check all cascade capped at Good, Partial with near-miss/consequence/citations and the sabotage that slipped through, Skip (auto); falsified specimen crate circled with its field guide entry lit, seal mismatch circled on the roster; Veteran fits with five tells; night shift night 1 played, NIGHT 2 NEW RULE banner with the new tell badged, three mistakes end the shift, personal best saved');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
