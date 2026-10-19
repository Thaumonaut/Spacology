// Aether attunement (boss study): boss and buff cards, the objective banner and its live chip (par / amber / red), ⚠ on
// a previewed reagent that would break the objective, Undo, a Hint that speaks the objective, Perfect by taps (Calm and
// a three-sample Expert round), a two-sample Steady round with a broken objective (Partial, weakened buff), Skip, and
// the assist levels (Guided frontier, Relaxed auto-moves and "Solved · Relaxed", saved in localStorage), with no
// errors or overflow at 1280, 1024 and 390. Headless unless SPACOLOGY_HEADED=1.
// Serve the repository root (npm run serve), then: node tests/browser/aether-attunement.cjs  (or node tests/run.cjs aether-attunement)
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const A=require('../../prototypes/minigames/aether-attunement/aether-attunement-model.js');
const BASE=process.env.SPACOLOGY_BASE_URL||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
const url=(seed,d)=>`${BASE}/prototypes/aether-attunement.html?seed=${seed}&difficulty=${d}`;
async function noOverflow(p,where){const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(o<=1,`horizontal overflow ${o}px on ${where}`);}
const name=c=>A.ELEMENTS[c];
// a Calm round whose opening offers both an amber move (par lost, objective alive) and a red one (objective lost)
function openingCase(){
  for(let seed=1;seed<80;seed++){
    const R=A.generate(seed,'calm'),P=R.samples[0],s=A.initial(P),by={};
    for(const c of P.palette){const r=A.apply(P,s,c);if(r.ok&&!r.done)by[A.objectiveStatus(P,r.state).state]??=c;}
    if(by.over!=null&&by.lost!=null)return {seed,R,P,over:by.over,lost:by.lost};
  }
  throw new Error('no calm opening with amber and red moves');
}
// a Steady round whose second sample a plain greedy player breaks
function steadyCase(){for(let seed=1;seed<80;seed++){const R=A.generate(seed,'steady');if(!R.samples[1].plainGreedy.met)return {seed,R};}throw new Error('no steady case');}
// the Relaxed rule, mirrored: while exactly one reagent keeps the objective possible and it does not close the sample
function forced(P,s){
  for(;;){
    if(A.done(P,s)||A.objectiveStatus(P,s).state==='lost')return s;
    const safe=P.palette.filter(c=>A.apply(P,s,c).ok&&!A.breaks(P,s,c));
    if(safe.length!==1||A.apply(P,s,safe[0]).done)return s;
    s=A.apply(P,s,safe[0]).state;
  }
}

(async()=>{const browser=await chromium.launch({headless:process.env.SPACOLOGY_HEADED!=='1'});
try{
  const O=openingCase(),S=steadyCase();
  for(const viewport of [{width:1280,height:900},{width:1024,height:768},{width:390,height:844}]){
    const tag=viewport.width,ctx=await browser.newContext({serviceWorkers:'block',viewport,hasTouch:tag<1100,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const shot=async n=>{if(SHOTS)await p.screenshot({path:`${SHOTS}/aether-attunement-${n}-${tag}.png`,fullPage:true});};
    const moves=()=>p.locator('.mg-meter b').first().innerText();
    const chip=()=>p.locator('#aaChip').getAttribute('data-state');
    const status=()=>p.locator('#mgStatus').innerText();
    const tap=sel=>p.locator(sel).first().click();
    const pick=async c=>{await tap(`[data-swatch="${name(c)}"]`);await tap(`[data-swatch="${name(c)}"]`);};
    const open=async(seed,d)=>{await p.goto(url(seed,d));await p.locator('.aa-c').first().waitFor();};
    const result=async()=>{await p.locator('#mgResult').waitFor({state:'visible'});return p.locator('#mgTier').innerText();};
    const playLine=async plan=>{for(const c of plan)await pick(c);};

    // ---- Calm: boss, buffs, objective, chip states, ⚠ preview, undo ----
    const {R,P}=O,X=P.objective.end;let s=A.initial(P);
    await open(O.seed,'calm');
    assert.equal(await p.locator('#aaBossName').innerText(),R.boss.name);
    assert.equal(await p.locator('.aa-buff').count(),R.buffs.length);
    assert.equal(await p.locator('.aa-buff[data-state="testing"]').innerText().then(t=>t.includes(R.buffs[0].name)),true);
    assert.equal(await p.locator('.aa-buff[data-state="untested"]').count(),R.buffs.length-1,'buffs past the samples are not tested tonight');
    assert.match(await p.locator('#aaObjText').innerText(),new RegExp(`End on\\s*\\S\\s*${A.title(X)}`));
    assert.equal(await chip(),'par');assert.match(await p.locator('#aaChip').innerText(),new RegExp(`Par ${P.par}`));
    assert.equal(await p.locator('.aa-swatch').count(),P.palette.length);
    assert.match(await moves(),new RegExp(`^0 / ${P.limit}$`));
    await noOverflow(p,'calm start');await shot('calm-start');
    // preview of a red move: ⚠ on the swatch and in the status, nothing committed
    await tap(`[data-swatch="${name(O.lost)}"]`);
    assert.equal(await p.locator('.aa-swatch.warn').getAttribute('data-swatch'),name(O.lost));
    assert.ok(await p.locator('.aa-swatch.warn .aa-warn').isVisible());
    assert.match(await status(),/^⚠ /);assert.match(await p.locator('#aaCommit').innerText(),/^⚠ Apply/);
    const pv=A.preview(P,s,O.lost);assert.equal(await p.locator('.aa-c.pre').count(),pv.absorbed.length);
    assert.match(await moves(),/^0 \//,'preview does not commit');
    await shot('calm-warn');
    // a safe preview shows no ⚠
    await tap(`[data-swatch="${name(P.plan[0])}"]`);assert.equal(await p.locator('.aa-swatch.warn').count(),0);
    // commit the red move: chip turns red; undo restores it
    await pick(O.lost);assert.match(await moves(),/^1 \//);assert.equal(await chip(),'lost');
    assert.match(await p.locator('#aaChip').innerText(),/Objective lost/);
    await p.locator('#mgUndo').click();assert.equal(await chip(),'par');assert.match(await moves(),/^0 \//);
    // the amber move
    await pick(O.over);assert.equal(await chip(),'over');assert.match(await p.locator('#aaChip').innerText(),/Par out of reach/);
    await p.locator('#mgUndo').click();assert.equal(await chip(),'par');
    // Hint arms the model's hint and speaks the objective
    await p.locator('#mgHint').click();
    const h=A.hint(P,s);assert.equal(await p.locator('.aa-swatch.previewing').getAttribute('data-swatch'),name(h.colour));
    assert.equal(await p.locator('.aa-swatch.hint').getAttribute('data-swatch'),name(h.colour));
    assert.equal(await status(),`Hint: ${h.text} Tap ${A.title(h.colour)} again to apply.`);
    assert.match(h.text,new RegExp(`${A.title(X)}`),'the hint names the closing element');

    // ---- Calm again: Perfect by taps (second move by a board cell + Apply) ----
    await open(O.seed,'calm');s=A.initial(P);
    for(let k=0;k<P.plan.length;k++){
      const c=P.plan[k];
      if(k===1){const r=A.preview(P,s,c);await tap(`[data-cell="${r.absorbed[0]}"]`);await p.locator('#aaCommit').click();}
      else await pick(c);
      s=A.apply(P,s,c).state;
      if(k<P.plan.length-1){assert.match(await moves(),new RegExp(`^${k+1} /`));assert.equal(await chip(),'par');}
    }
    assert.equal(await result(),'Perfect');
    assert.match(await p.locator('#mgNear').innerText(),/Nothing left on the table/);
    assert.equal(await p.locator('#mgProduces').innerText(),`Delivered: Boss buffs removed: ${R.buffs[0].name} · Weakness found: ${A.title(X)}`);
    assert.match(await p.locator('#mgHeadline').innerText(),new RegExp(`its weakness is ${A.title(X)}`));
    await noOverflow(p,'calm result');await shot('calm-result');
    await p.locator('#mgReview').click();
    assert.equal(await p.locator('.aa-buff[data-buff="0"]').getAttribute('data-state'),'removed');assert.equal(await chip(),'met');

    // ---- Steady: sample 1 at par, Next sample, sample 2 played greedily breaks its objective: Partial ----
    await open(S.seed,'steady');
    await playLine(S.R.samples[0].plan);
    assert.ok(await p.locator('#aaNext').isVisible(),'Next sample appears between samples');
    assert.equal(await p.locator('#mgResult').isVisible(),false);
    assert.equal(await p.locator('.aa-buff[data-buff="0"]').getAttribute('data-state'),'removed');
    assert.equal(await p.locator('#mgUndo').isDisabled(),true,'a finished sample is locked');
    await noOverflow(p,'steady between');await shot('steady-between');
    await p.locator('#aaNext').click();
    assert.match(await p.locator('#aaObjKicker').innerText(),/Sample 2 of 2/i);assert.match(await moves(),/^0 \//);
    const S2=S.R.samples[1];await playLine(A.auto(S2).plan);
    assert.equal(await result(),'Partial');
    assert.match(await p.locator('#mgProduces').innerText(),new RegExp(`Boss buffs removed: ${S.R.buffs[0].name} · Weakened: ${S.R.buffs[1].name} · Weakness found: ${A.title(S.R.weakness)}`));
    assert.match(await p.locator('#mgNear').innerText(),/^Sample 2: /);
    await shot('steady-partial');

    // ---- Expert: three samples at par by taps, 44px touch targets ----
    const E=A.generate(9,'expert');
    await open(9,'expert');await noOverflow(p,'expert start');await shot('expert-start');
    for(const b of await p.locator('.aa-swatch,#mgHint,#mgUndo,#aaCommit').all()){const box=await b.boundingBox();assert.ok(box.height>=43.5,'touch targets are at least 44px tall');}
    for(let k=0;k<E.samples.length;k++){await playLine(E.samples[k].plan);if(k<E.samples.length-1)await p.locator('#aaNext').click();}
    assert.equal(await result(),'Perfect');
    assert.match(await p.locator('#mgProduces').innerText(),new RegExp(`Boss buffs removed: ${E.buffs.slice(0,3).map(b=>b.name).join(', ')} · Weakness found: ${A.title(E.weakness)}`));
    await noOverflow(p,'expert solved');await shot('expert-result');

    // ---- Tense: Skip ignores the objective: every buff only weakened ----
    await open(6,'tense');await noOverflow(p,'tense start');
    await p.locator('#mgAuto').click();assert.equal(await result(),'Automatic');
    assert.match(await p.locator('#mgProduces').innerText(),/Boss buffs removed: none · Weakened: .+ · Weakness found: none \(fallback\)/);

    // ---- Assist levels: Guided outlines the frontier and is remembered; Relaxed auto-moves and caps at Good ----
    await open(O.seed,'calm');
    assert.equal(await p.locator('.aa-c.frontier').count(),0);
    await p.locator('input[name="aaLevel"][value="guided"]').check();
    assert.ok(await p.locator('.aa-c.frontier').count()>0,'Guided outlines the frontier');
    assert.equal(await p.evaluate(()=>localStorage.getItem('spacologyAetherAssistV1')),'guided');
    await open(O.seed,'calm');assert.ok(await p.locator('input[name="aaLevel"][value="guided"]').isChecked(),'the assist level is remembered');
    await p.locator('input[name="aaLevel"][value="relaxed"]').check();
    // play the par line; skip moves Relaxed already applied
    s=forced(P,A.initial(P));let auto=s.moves.length;
    while(!A.done(P,s)){
      const c=P.plan[s.moves.length];await pick(c);s=A.apply(P,s,c).state;
      const f=forced(P,s);auto+=f.moves.length-s.moves.length;s=f;
      if(!A.done(P,s))assert.match(await moves(),new RegExp(`^${s.moves.length} /`));
    }
    assert.equal(await result(),'Good','Relaxed is never Perfect');
    assert.match(await p.locator('#mgHeadline').innerText(),/^Solved · Relaxed\. /);
    assert.match(await p.locator('#mgStats').innerText(),new RegExp(`Relaxed${auto?` \\(${auto} auto\\)`:''}`));
    await noOverflow(p,'relaxed result');

    assert.deepEqual(errors,[],`console/page errors at ${tag}px`);
    await ctx.close();
  }
  console.log(`PASS aether-attunement browser: boss and buff cards, End-on objective banner, chip par/amber/red with Undo, ⚠ preview, hint speaking the objective, Perfect by taps (Calm 1 sample, Expert 3 samples) with "Boss buffs removed … · Weakness found …", Steady 2-sample Partial with a weakened buff, Skip weakens all, Guided frontier saved in localStorage, Relaxed auto-moves and "Solved · Relaxed" at Good, 44px targets, no errors or overflow at 1280/1024/390.`);
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
