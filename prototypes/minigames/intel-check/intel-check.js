// Manifest checking UI (Research's day shift for Logistics): a progress strip and live consequence tick across the
// top; the current supply manifest on the left; tabbed reference documents on the right. Quick (default): one tap on a
// field compares it with every line it must match (✓ or ✗ with the note), and the relevant tab opens on that line.
// Classic: tap a field, then the line. Check all cascades through every field. Stamp with the big buttons, a swipe
// (right VERIFIED, left FORGED) or the keys V and F; 1–9 check fields, C checks all, U undoes. A wrong stamp slides in
// a citation slip at once; the round goes on. Internal names (report, region, sighting…) are kept from the intel desk.
// Rules, generation, checking, citations, hints and scoring live in intel-check-model.js.
(function(){
  'use strict';
  const K=window.MiniGameKit,M=window.IntelCheck,esc=K.esc,PREFS='spacologyIntelCheckDesk';
  let started=0,pz=null,st=null,history=[],sel=null,hintAt=null,checked={},count={hints:0,compares:0,undos:0,checkAll:0};
  let endless=null; // the Endless shift: {seed, run, cardAt, cardId, timer}
  let tab='roster',review=null,cites=[],cascade=null,ghost=null,ghostTimer=null,drag=null,suppressClick=false,capped=false,focusEntry=null;
  let prefs=(()=>{try{return JSON.parse(localStorage.getItem(PREFS))||{};}catch{return {};}})();
  prefs={assist:M.ASSISTS.some(a=>a.id===prefs.assist)?prefs.assist:'quick'};
  const savePrefs=()=>{try{localStorage.setItem(PREFS,JSON.stringify(prefs));}catch{}};
  const assist=()=>M.assistOf(prefs.assist);
  const shell=K.shell({id:'intel-check',defaultDifficulty:'normal',difficulties:[...M.DIFFICULTIES,M.ENDLESS].map(d=>({id:d.id,label:d.label,target:d.target})),
    rules:['Logistics’ <b>supply manifests</b> arrive one at a time for Research to clear. Some are <b>Null sabotage</b>: exactly one detail disagrees with the documents. Stop them before they ship.',
      'Check callsigns and seals on the depot roster, transponders on the transponder table, cargo and handling on the production log, and every <b>specimen crate</b> bound for the lab against the field guide.',
      '<b>Quick</b> (default): tap a manifest field to compare it with every line it must match: ✓ or ✗ with the note. <b>Check all</b> runs every field, but caps the round at Good unless the assist is <b>Relaxed</b>. <b>Classic</b>: tap a field, then the line.',
      'Stamp <b>VERIFIED</b> to clear the convoy or <b>FORGED</b> to stop it: the buttons, a swipe (right or left) or the keys <b>V</b> and <b>F</b>. A wrong stamp earns a <b>citation</b> at once; the round goes on.',
      'Each level adds documents and rules: the field guide, then the production log and seals, the shipping regulations with signatures and cargo scans, then the shift change, route map, codes and log. Veteran has it all with five tells.',
      '<b>Night shift at the depot</b>: manifests keep coming with a timer bar; each night of six adds or swaps one sabotage tell. Three mistakes end the shift; your best is kept.',
      'All stamps right and every sabotage backed by evidence is <b>Perfect</b>. FORGED attaches the evidence you found. Tap a stamped card in the strip to review it or undo back to it.'],
    onNew,onAuto,onUndo,onHint});
  const stage=shell.stage;
  stage.innerHTML=`<div class="ic" id="icRoot">
    <div class="ic-desk">
      <div class="ic-top"><p class="ic-banner" id="icBanner" role="status" hidden></p><div class="ic-strip" id="icStrip" aria-label="Manifests"></div><p class="ic-tick" id="icTick" aria-live="polite"></p></div>
      <section class="ic-left" aria-label="Current manifest">
        <aside class="ic-slip" id="icSlip" role="alert" hidden></aside>
        <div class="ic-slot" id="icSlot"><div id="icCard"></div><div class="ic-ghosts" id="icGhosts" aria-hidden="true"></div></div>
      </section>
      <section class="ic-right" aria-label="Reference documents">
        <div class="ic-tabs" id="icTabs" role="tablist"></div>
        <p class="ic-inspect" id="icInspect" aria-live="polite"></p>
        <div class="ic-docs" id="icDocs"></div>
      </section>
    </div>
    <div class="ic-tools"><div class="ic-assist" id="icAssist" role="radiogroup" aria-label="Assist">${M.ASSISTS.map(a=>`<button role="radio" data-assist="${a.id}" title="${esc(a.text)}">${esc(a.label)}</button>`).join('')}</div>
      <p class="ic-keys" id="icAssistNote"></p></div></div>`;
  const $=id=>document.getElementById(id);
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const wide=()=>window.matchMedia?.('(min-width: 761px)').matches;
  const locked=()=>shell.ended||!pz||!M.current(pz,st)||!!review;
  const rep=()=>M.current(pz,st);
  const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
  const elapsed=()=>started?Date.now()-started:0;
  const docOf=e=>M.docOfEntry(e);
  const entryEl=e=>stage.querySelector(`.ic-entry[data-entry="${CSS.escape(e)}"]`);
  const fieldEl=f=>stage.querySelector(`#icReport .ic-field[data-field="${f}"]`);
  const TAB_NAMES={roster:'Roster',freq:'Transponders',guide:'Field guide',sensor:'Production',rules:'Regulations',map:'Routes',auth:'Codes',log:'Log'};
  const isNewDoc=doc=>pz.intro.docs.includes(doc),isNewRule=doc=>pz.intro.rules.includes(doc);

  // ---- visuals: every one drawn from the model's structured data ------------------------------------------------------
  // Specimen silhouettes (40×40), element glyphs, pips; cargo crate marks; seals; signatures; cargo scans; the route map.
  const SHAPES={
    chaff:'<circle cx="20" cy="20" r="10"/>',
    bruiser:'<rect x="8" y="8" width="24" height="24" rx="3"/>',
    warden:'<path d="M8 7H32V20Q32 31 20 36Q8 31 8 20Z"/>',
    cleanser:'<path d="M20 4L36 20L20 36L4 20Z"/>',
    reflector:'<path d="M20 4L34 12V28L20 36L6 28V12Z"/>',
    anchor:'<path d="M5 8H35L20 35Z"/>',
    bulwark:'<rect x="3" y="11" width="34" height="18" rx="2"/>',
    quickstep:'<path d="M5 9H24L35 20L24 31H5L13 20Z"/>'};
  const GLYPHS={
    order:'<rect x="16.5" y="16.5" width="7" height="7"/>',
    chaos:'<path d="M15.5 15.5L24.5 24.5M24.5 15.5L15.5 24.5" class="ln"/>',
    growth:'<path d="M20 15L25 24H15Z"/>',
    void:'<circle cx="20" cy="20" r="4" class="ln"/>',
    decay:'<path d="M15 18H25M15 22.5H25" class="ln"/>',
    energy:'<path d="M22 14L17 21H23L18 27" class="ln"/>'};
  // Cargo kinds: a stencil mark per supply, used on cargo lines and in the X-ray scan.
  const CARGO_SHAPES={
    ration:'<rect x="6" y="10" width="28" height="20" rx="2"/>',
    kit:'<path d="M6 14H34V32H6Z M15 14V9H25V14" />',
    shield:'<path d="M20 5L33 11V21Q33 31 20 36Q7 31 7 21V11Z"/>',
    medkit:'<path d="M16 6H24V16H34V24H24V34H16V24H6V16H16Z"/>',
    beacon:'<path d="M20 4L30 34H10Z"/>',
    drone:'<circle cx="20" cy="20" r="8"/><circle cx="8" cy="8" r="5"/><circle cx="32" cy="8" r="5"/><circle cx="8" cy="32" r="5"/><circle cx="32" cy="32" r="5"/>',
    plate:'<path d="M4 12L20 6L36 12V28L20 34L4 28Z"/>',
    fuel:'<rect x="12" y="4" width="16" height="32" rx="7"/>'};
  const cargoSvg=type=>`<svg class="ic-crate" viewBox="0 0 40 40" aria-hidden="true">${CARGO_SHAPES[type]||''}</svg>`;
  const pipsSvg=(n,y=44)=>[...Array(n)].map((_,i)=>`<circle class="pip" cx="${20+(i-(n-1)/2)*7}" cy="${y}" r="2.6"/>`).join('');
  // A specimen label: the silhouette in its element colour, the element glyph, and its pips underneath.
  const iconSvg=(type,el,glyph,pips,cls='')=>`<svg class="ic-icon ${cls}" viewBox="0 0 40 48" aria-hidden="true"><g class="sil el-${el}">${SHAPES[type]}</g><g class="gly">${GLYPHS[glyph]||''}</g>${pipsSvg(pips)}`+
    `<circle class="miss miss-el" cx="20" cy="20" r="19"/><circle class="miss miss-glyph" cx="20" cy="20" r="7.5"/><ellipse class="miss miss-pips" cx="20" cy="44" rx="15" ry="5"/></svg>`;
  const guideSvg=type=>`<svg class="ic-icon" viewBox="0 0 40 48" aria-hidden="true"><g class="sil plain">${SHAPES[type]}</g>${pipsSvg(M.PIPS[type])}</svg>`;
  const elChip=el=>`<span class="ic-el"><svg viewBox="12 12 16 16" aria-hidden="true"><rect x="12" y="12" width="16" height="16" rx="4" class="el-${el}"/><g class="gly">${GLYPHS[el]}</g></svg>${cap(el)}</span>`;
  const SEAL_GLYPH={ring:'<circle cx="20" cy="20" r="3.4" class="ln"/>',bar:'<rect x="15" y="18.5" width="10" height="3"/>',cross:'<path d="M20 15V25M15 20H25" class="ln"/>',
    dot:'<circle cx="20" cy="20" r="2.8"/>',chevron:'<path d="M15 18L20 23L25 18" class="ln"/>',diamond:'<path d="M20 15.5L24.5 20L20 24.5L15.5 20Z"/>'};
  function sealSvg(s){
    const pts=[];for(let i=0;i<s.points*2;i++){const a=-Math.PI/2+i*Math.PI/s.points,rad=i%2?8:14.5;pts.push((20+Math.cos(a)*rad).toFixed(1)+','+(20+Math.sin(a)*rad).toFixed(1));}
    return `<svg class="ic-seal" viewBox="-2 -2 44 44" aria-hidden="true"><circle cx="20" cy="20" r="18" class="ring ring-${s.ring}"/><polygon points="${pts.join(' ')}" class="star"/><g class="sg">${SEAL_GLYPH[s.glyph]}</g>`+
      `<circle class="miss miss-ring" cx="20" cy="20" r="21"/><circle class="miss miss-points" cx="20" cy="20" r="15.5"/><circle class="miss miss-glyph" cx="20" cy="20" r="6.5"/></svg>`;
  }
  const WAVE={peak:'L5 12L8 3L11 12L16 12',dip:'L5 12L8 21L11 12L16 12',flat:'L16 12',step:'L4 12L4 5L12 5L12 12L16 12'};
  function sigSvg(w){
    let d='M0 12';w.forEach((seg,i)=>{d+=' '+WAVE[seg].replace(/(\d+(\.\d+)?) (\d+)/g,(m,x,_,y)=>`${+x+i*16} ${y}`);});
    return `<svg class="ic-sig" viewBox="0 0 96 24" aria-hidden="true">${[0,1,2,3,4,5].map(i=>`<rect x="${i*16+1}" y="0" width="14" height="24" rx="3" class="miss miss-seg${i}"/>`).join('')}${[1,2,3,4,5].map(i=>`<line x1="${i*16}" y1="1" x2="${i*16}" y2="23" class="sep"/>`).join('')}<path d="${d}" class="wave"/></svg>`;
  }
  function snapSvg(snap){
    return `<svg class="ic-snap" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" class="scope"/><circle cx="32" cy="32" r="20" class="grid"/><circle cx="32" cy="32" r="10" class="grid"/>`+
      snap.blips.map(b=>`<g transform="translate(${(32+b.x*26-4).toFixed(1)} ${(32+b.y*26-4).toFixed(1)}) scale(.2)" class="blip">${CARGO_SHAPES[b.type]}</g>`).join('')+'</svg>';
  }
  function mapSvg(){
    // Depots on the corners of a square (opposite corners never connect); the outer sectors above and below.
    const P={},[a,b,c,d]=pz.map.ring;P[a]=[100,52,'end'];P[b]=[220,52,'start'];P[c]=[220,130,'start'];P[d]=[100,130,'end'];P['the Rim']=[160,24,'mid'];P['the Deep']=[160,158,'mid'];
    const label=n=>{const [x,y,an]=P[n];return an==='mid'?`<text x="${x}" y="${y<90?y-11:y+19}">${esc(n)}</text>`:`<text x="${an==='end'?x-12:x+12}" y="${y+4}" text-anchor="${an}">${esc(n)}</text>`;};
    return `<svg class="ic-map" viewBox="0 0 320 182" role="img" aria-label="Route map">${pz.map.edges.map(([x,y])=>`<line x1="${P[x][0]}" y1="${P[x][1]}" x2="${P[y][0]}" y2="${P[y][1]}"/>`).join('')}`+
      pz.map.nodes.map(n=>`<g class="${pz.regions.includes(n)?'rg':'outer'}"><circle cx="${P[n][0]}" cy="${P[n][1]}" r="7"/>${label(n)}</g>`).join('')+'</svg>';
  }

  // Which part of a visual a mismatch is about, so the manifest can circle it.
  function missOf(r,f){
    if(f.startsWith('spec:')){const s=(r.specimens||[])[+f.slice(5)],c=s&&pz.docs.includes('guide')&&M.iconCheck(pz,s);return c?c.rule.replace('guide-',''):'';}
    if(f==='seal'){const w=pz.seals[r.region];return ['ring','points','glyph'].find(k=>r.seal[k]!==w[k])||'';}
    if(f==='sig'){const i=r.sig.findIndex((x,k)=>x!==pz.sig[r.region][k]);return i<0?'':'seg'+i;}
    return '';
  }
  function circle(r,f,el){const m=missOf(r,f);if(el&&m)el.dataset.miss=m;}

  function onNew({seed,difficulty}){
    stopTimer();endless=difficulty==='endless'?{seed,run:M.endlessRun(),cardAt:0,cardId:null,timer:null}:null;
    pz=endless?M.endlessDay(seed,1):M.generate(seed,difficulty);st=M.create(pz);history=[];sel=null;hintAt=null;checked={};count={hints:0,compares:0,undos:0,checkAll:0};started=0;
    review=null;cites=[];capped=false;focusEntry=null;clearCascade();clearGhost();hideSlip();
    tab=pz.docs.find(d=>isNewDoc(d)||isNewRule(d))||pz.docs[0];
    renderDocs();renderReport();renderStrip();meters();renderAssist();banner();
    shell.status('NEW RULE · '+pz.newRule.text);if(endless)startTimer();
    shell.controls({auto:true,hint:true});
  }

  // ---- documents: tabs, one visible at a time ---------------------------------------------------------------------
  function renderDocs(){
    $('icTabs').innerHTML=pz.docs.map(doc=>`<button role="tab" class="ic-tab" data-tab="${doc}" aria-selected="${doc===tab}">${esc(TAB_NAMES[doc])}${isNewDoc(doc)||isNewRule(doc)?'<span class="ic-new">NEW</span>':''}</button>`).join('');
    $('icDocs').innerHTML=pz.docs.map(doc=>{
      const title={roster:'Depot roster · callsigns and seals',freq:(pz.watches?'Transponder table · by shift':'Transponder table')+(pz.sig?' · signatures':''),guide:'Field guide · specimen silhouettes and elements',
        sensor:'Production log · made today',rules:'Shipping regulations · known sabotage tells',map:'Route map · which sectors connect',auth:'Authorisation codes · by shift',log:'Logged today · one route out per depot'}[doc];
      const badge=isNewDoc(doc)?'<span class="ic-new">NEW DOCUMENT</span>':isNewRule(doc)?'<span class="ic-new">NEW RULE</span>':'';
      return `<section class="ic-doc ic-doc-${doc}" data-doc="${doc}" role="tabpanel" ${doc===tab?'':'hidden'}>
        <header><b>${esc(title)}</b>${badge}</header><div class="ic-entries" id="icDoc-${doc}">${docBody(doc)}</div></section>`;}).join('');
    marks();
  }
  // Today's log fills in as manifests are stamped.
  function renderLog(){const el=$('icDoc-log');if(el){el.innerHTML=docBody('log');marks();}}
  function setTab(doc){
    if(!pz.docs.includes(doc)||doc===tab)return;tab=doc;
    stage.querySelectorAll('.ic-tab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===doc)));
    stage.querySelectorAll('.ic-doc').forEach(d=>d.hidden=d.dataset.doc!==doc);
  }
  function docBody(doc){
    const R=pz.regions,lt=r=>`<small>depot</small>`;
    if(doc==='roster')return R.map(r=>`<button class="ic-entry" data-entry="roster:${esc(r)}"><span class="ic-rg">${esc(r)} ${lt(r)}</span><span class="ic-val">${pz.roster[r].map(c=>`<code>${esc(c)}</code>`).join(' ')}${pz.seals?`<span class="ic-sealtag">${sealSvg(pz.seals[r])}${esc(pz.seals[r].dept)}</span>`:''}</span></button>`).join('');
    if(doc==='freq'){
      const sig=r=>pz.sig?`<button class="ic-entry ic-fcell ic-sigcell" data-entry="sig:${esc(r)}" aria-label="${esc(r)} reference signature">${sigSvg(pz.sig[r])}</button>`:'';
      const cols=(pz.watches?2:1)+(pz.sig?1:0);
      const head=`<div class="ic-fhead" style="--cols:${cols}"><span></span>${pz.watches?`<span>${esc(M.WATCHES[0])}</span><span>${esc(M.WATCHES[1])}</span>`:'<span>Code</span>'}${pz.sig?'<span>Signature</span>':''}</div>`;
      return head+R.map(r=>`<div class="ic-frow" style="--cols:${cols}"><span class="ic-rg">${esc(r)}</span>${pz.watches?[0,1].map(w=>`<button class="ic-entry ic-fcell" data-entry="freq:${esc(r)}:${w}" aria-label="${esc(r)} ${M.WATCH_NAMES[w]} ${pz.freq[r][w]}"><code>${pz.freq[r][w]}</code></button>`).join('')
        :`<button class="ic-entry ic-fcell" data-entry="freq:${esc(r)}" aria-label="${esc(r)} transponder ${pz.freq[r]}"><code>${pz.freq[r]}</code></button>`}${sig(r)}</div>`).join('');
    }
    if(doc==='guide')return `<div class="ic-legend">${M.ELEMENTS.map(elChip).join('')}</div><div class="ic-guide">`+M.ENEMIES.map(t=>`<button class="ic-entry ic-gentry" data-entry="guide:${t}" aria-label="${esc(M.species(t))}: ${pz.guide[t].els.join(' or ')}, ${M.PIPS[t]} pips">${guideSvg(t)}<span class="ic-val"><b>${esc(cap(M.species(t)))}</b><span>${pz.guide[t].els.map(elChip).join('<i>or</i>')}</span></span></button>`).join('')+'</div>';
    if(doc==='sensor')return R.map(r=>`<button class="ic-entry" data-entry="sensor:${esc(r)}"><span class="ic-rg">${esc(r)}${pz.checks.includes('snap')?`<small>scan ±${pz.sensor[r].prec}</small>`:''}</span><span class="ic-val">${pz.sensor[r].types.map(t=>`<i class="ic-chip">${pz.sensor[r].made[t]} ${M.kinds(t)}</i>`).join(' ')}<em>${esc(pz.sensor[r].cond)}</em></span></button>`).join('');
    if(doc==='map')return mapSvg()+R.map(r=>`<button class="ic-entry" data-entry="map:${esc(r)}"><span class="ic-rg">${esc(r)}</span><span class="ic-val"><span>routes out via ${M.borders(pz,r).map(b=>`<b>${esc(b)}</b>`).join(', ')}</span></span></button>`).join('');
    if(doc==='auth')return `<div class="ic-fhead" style="--cols:2"><span></span><span>${esc(M.WATCHES[0])}</span><span>${esc(M.WATCHES[1])}</span></div>`+
      R.map(r=>`<div class="ic-frow" style="--cols:2"><span class="ic-rg">${esc(r)}</span>${[0,1].map(w=>`<button class="ic-entry ic-fcell" data-entry="auth:${esc(r)}:${w}" aria-label="${esc(r)} ${M.WATCH_NAMES[w]} code ${pz.auth[r][w]}"><code>${pz.auth[r][w]}</code></button>`).join('')}</div>`).join('');
    if(doc==='log'){
      const done=pz.reports.filter(x=>x.id<st.cursor);
      return done.length?done.map(x=>`<button class="ic-entry ic-logline" data-entry="log:${x.id}"><span class="ic-rg">#${x.no} <small>${x.time}</small></span><span class="ic-val"><code>${esc(x.callsign)}</code> ${esc(x.region)}${'from' in x?` · via ${esc(x.from)}`:''}<i class="ic-chip ${st.stamps[x.id]}">${st.stamps[x.id].toUpperCase()}</i></span></button>`).join('')
        :'<p class="ic-empty">Nothing logged yet today. Stamped manifests appear here.</p>';
    }
    return pz.rules.map(x=>`<button class="ic-entry ic-rule" data-entry="rule:${x.id}"><span class="ic-val">${esc(x.text)}${pz.endless&&pz.endless.change.added===x.id?'<span class="ic-new">NEW RULE</span>':''}</span></button>`).join('');
  }

  // ---- the manifest card ------------------------------------------------------------------------------------------
  function fieldHtml(r,f,label,valueHtml,aria,cls,n,tag){
    const none=!M.checksFor(pz,r,f).length&&f!=='region';
    return `<${tag} class="ic-field ${cls||''}${none?' ic-na':''}" data-field="${f}" ${tag==='button'?`aria-label="${esc(label+': '+aria)}"`:''}><span class="k">${esc(label)}</span><b class="v">${valueHtml}</b><i class="ic-mark" aria-hidden="true"></i>${n<=9&&tag==='button'?`<kbd aria-hidden="true">${n}</kbd>`:''}</${tag}>`;
  }
  function cardHtml(r,{id,tag,extra,anim}){
    const fs=M.fields(r),n=f=>fs.indexOf(f)+1,F=(f,l,v,c,aria)=>fieldHtml(r,f,l,aria===undefined?esc(v):v,aria===undefined?v:aria,c,n(f),tag);
    const sight=r.sighting.map((s,i)=>F('sight:'+i,'Cargo',`<span class="ic-ctop">${cargoSvg(s.type)}<b>${s.count}</b></span><span class="ic-nm">${esc(M.plural(s.type,s.count))}</span>`,'ic-sightf',
      `${s.count} ${M.plural(s.type,s.count)}`)).join('')+(r.specimens||[]).map((s,i)=>F('spec:'+i,'Specimen',`<span class="ic-ctop">${iconSvg(s.type,s.el,s.glyph,s.pips)}<b>1</b></span><span class="ic-nm">${esc(s.type)} sample</span>`,'ic-sightf ic-specf',
      `${s.type} sample, ${s.el} colour, ${s.glyph} glyph, ${s.pips} pip${s.pips===1?'':'s'}`)).join('');
    const to=M.destName(pz,r.dest),lt=r.dest===M.LAB?'Research':`Lt ${pz.fronts.find(x=>x.id===r.dest).lt}`;
    return `<article class="ic-report${anim?' ic-'+anim:''}${fs.length>9?' ic-dense':''}" ${id?`id="${id}"`:''} data-report="${r.id}" aria-label="Supply manifest ${r.no} of ${pz.reports.length}">
      ${endless&&tag==='button'?'<div class="ic-timer" aria-hidden="true"><i id="icTimerBar"></i></div>':''}
      <header><span class="eyebrow">${endless?`NIGHT ${pz.endless.day} · `:''}MANIFEST · ${r.no} OF ${pz.reports.length}</span><span class="ic-world">${esc(pz.world)}</span></header>
      <p class="ic-dest" data-dest="${esc(r.dest)}"><span class="k">To</span> <b>${esc(cap(to))}</b> <small>${esc(lt)}</small></p>
      <div class="ic-fields">
        ${F('region','Origin',`${r.region} depot`)}${F('callsign','Callsign',r.callsign,'mono')}
        ${'seal' in r?F('seal','Seal',`${sealSvg(r.seal)}<span>${esc(r.seal.dept)}</span>`,'ic-sealf',`${r.seal.points}-point ${r.seal.ring} ${r.seal.dept} seal with a ${r.seal.glyph}`):''}
        ${F('time','Departs',r.time,'mono')}${F('freq','Transponder',r.freq,'mono')}
        ${'auth' in r?F('auth','Auth code',r.auth,'mono'):''}
        ${'sig' in r?F('sig','Signature',sigSvg(r.sig),'ic-sigf',r.sig.join(', ')):''}
        ${'from' in r?F('from','Route',`via ${esc(r.from)}`,'',`via ${r.from}`):''}
        <div class="ic-sight"><span class="k">Cargo${r.specimens?' and specimen crates':''}</span><div>${sight}</div></div>
        ${'snap' in r?F('snap','Scan',snapSvg(r.snap),'ic-snapf',`${r.snap.blips.length} crates`):''}
        ${F('cond','Handling',r.cond,'snap' in r?'':'wide')}
      </div>${extra}<div class="ic-ink" aria-hidden="true"></div></article>`;
  }
  function renderReport(anim){
    const box=$('icCard');clearCascade();
    if(review)return renderReview();
    const r=rep();
    if(!r){box.innerHTML=`<article class="ic-report ic-done" id="icReport" data-report="done"><p class="eyebrow">DESK CLEAR</p><p>All ${pz.reports.length} manifests stamped.</p></article>`;inspectLine();renderTick();marks();return;}
    const ev=st.evidence[r.id];
    box.innerHTML=cardHtml(r,{id:'icReport',tag:'button',anim,extra:`
      <div class="ic-evrow"><p class="ic-evidence${ev?' found':''}" id="icEvidence">${ev?`<b>✕ EVIDENCE</b> ${esc(ev.text)}`:'No discrepancy recorded yet.'}</p>
        <button id="icCheckAll" class="ic-checkall" title="Run every comparison (C)">Check all</button></div>
      <div class="ic-stamps"><button id="icForged" class="ic-sbtn bad" title="Stamp FORGED (F, or swipe left)">◀ FORGED</button><button id="icVerified" class="ic-sbtn ok" title="Stamp VERIFIED (V, or swipe right)">VERIFIED ▶</button></div>`});
    const el=$('icReport');
    if(anim&&!reduced())el.addEventListener('animationend',()=>el.classList.remove('ic-'+anim),{once:true});else el.classList.remove('ic-'+anim);
    marks();inspectLine();renderTick();
  }
  // Review: a stamped manifest, read-only, with its citation and the proof lit; Undo goes back to it.
  function renderReview(){
    const i=review.i,r=pz.reports[i],v=st.stamps[i],c=M.citation(pz,st,i);
    $('icCard').innerHTML=cardHtml(r,{id:'icReport',tag:'div',extra:`
      <div class="ic-review-note ${c?'bad':'good'}" id="icReviewNote"><b>REVIEW · stamped ${v.toUpperCase()}</b> ${c?esc(c.text):'Stamped right.'}</div>
      <div class="ic-stamps">${endless?'':`<button id="icUndoTo">Undo back to manifest ${r.no}</button>`}<button id="icBack" class="primary">Back to the desk</button></div>`});
    $('icReport').classList.add('ic-reviewing',v);
    const f=review.field||(c&&c.field),e=review.entry||(c&&c.entry);
    marks();
    if(f){const fe=stage.querySelector(`#icReport .ic-field[data-field="${f}"]`);fe?.classList.add('ic-proof');if(c&&e&&/^(guide|roster|sig):/.test(e))circle(r,f,fe);}
    if(e){setTab(docOf(e));const el=entryEl(e);el?.classList.add('ic-proof');if(wide())el?.scrollIntoView?.({block:'nearest'});}
    inspectLine(c?`<b>PROOF</b> ${esc(c.text.replace(/^CITATION · /,''))}`:`<b>REVIEW</b> Manifest ${r.no} was stamped right.`,c?'bad':'good');
  }
  function openReview(i,field,entry){if(!pz||i>=st.cursor||shell.ended&&!field)return;clearCascade();sel=null;review={i,field,entry};renderReport();renderStrip();}
  function closeReview(){if(!review)return;review=null;renderReport();renderStrip();}

  // ---- progress strip, tick, citation slip ------------------------------------------------------------------------
  function renderStrip(){
    const n=pz.reports.length,left=n-st.cursor;
    $('icStrip').innerHTML=`<span class="ic-left-n"><b>${left}</b> left</span>`+pz.reports.map((r,i)=>{
      if(i<st.cursor){const v=st.stamps[i],wrong=(v==='forged')!==r.forged;
        return `<button class="ic-cell ${v}${wrong?' wrong':''}${review&&review.i===i?' on':''}" data-review="${i}" aria-label="Review manifest ${r.no}: ${v.toUpperCase()}${wrong?', cited':''}">${r.no}<i>${wrong?'✗':'✓'}</i></button>`;}
      return `<span class="ic-cell${i===st.cursor?' now':''}" aria-hidden="true">${r.no}</span>`;}).join('')+
      (cites.length?`<button class="ic-citechip" id="icCiteChip" aria-label="${cites.length} citation${cites.length===1?'':'s'}: show the latest">⚑ ${cites.length}</button>`:'');
  }
  function renderTick(){const t=M.tick(pz,st),el=$('icTick');el.textContent=t.text;el.className='ic-tick'+(t.bad?' bad':t.report!==null?' good':'');}
  function showSlip(c){
    const el=$('icSlip');el.hidden=false;el.dataset.report=c.report;
    el.innerHTML=`<p>${esc(c.text)}</p><div class="ic-slip-acts"><button id="icShowMe">Show me</button><button id="icSlipClose" aria-label="Dismiss the citation">✕</button></div>${cites.length>1?`<span class="ic-pile" aria-label="${cites.length} citations">${cites.length}</span>`:''}`;
    el.classList.remove('in');if(!reduced()){void el.offsetWidth;el.classList.add('in');}
  }
  function hideSlip(){const el=$('icSlip');if(el){el.hidden=true;el.innerHTML='';}}

  // Highlights: checklist marks, the selection and its related lines, the report's region lines, hint pulses.
  function related(f,entry,r){const c=M.compare(pz,r,f,entry);return c.result==='match'||c.result==='mismatch';}
  function marks(){
    const r=review?pz.reports[review.i]:rep();
    stage.querySelectorAll('.ic-rel,.ic-sel,.ic-hint,.ic-focus,.ic-proof').forEach(el=>el.classList.remove('ic-rel','ic-sel','ic-hint','ic-focus','ic-proof'));
    stage.querySelectorAll('.ic-entry').forEach(el=>el.disabled=locked());
    if(!r)return;
    const fieldsEls=[...stage.querySelectorAll('#icReport .ic-field')],entryEls=[...stage.querySelectorAll('.ic-entry')];
    const ck=checked[r.id]||{};
    for(const el of fieldsEls){const f=el.dataset.field;el.classList.toggle('ic-ok',ck[f]==='ok');el.classList.toggle('ic-bad',ck[f]==='bad');}
    if(sel&&!review){
      const src=sel.kind==='field'?fieldEl(sel.id):entryEl(sel.id);src?.classList.add('ic-sel');
      if(sel.kind==='field')entryEls.filter(e=>related(sel.id,e.dataset.entry,r)).forEach(e=>e.classList.add('ic-rel'));
      else fieldsEls.filter(e=>related(e.dataset.field,sel.id,r)).forEach(e=>e.classList.add('ic-rel'));
    }else{
      // Nothing selected: the manifest's own depot lights up across the desk.
      entryEls.filter(e=>M.parseEntry(e.dataset.entry).key===r.region).forEach(e=>e.classList.add('ic-rel'));
    }
    if(focusEntry&&!review)entryEl(focusEntry)?.classList.add('ic-focus');
    if(hintAt&&!review&&hintAt.report===r.id){fieldEl(hintAt.field)?.classList.add('ic-hint');entryEl(hintAt.entry)?.classList.add('ic-hint');}
  }
  function inspectLine(text,tone){
    const el=$('icInspect'),r=rep();
    if(text){el.className='ic-inspect'+(tone?' '+tone:'');el.innerHTML=text;return;}
    el.className='ic-inspect';
    if(!r){el.textContent='';return;}
    if(sel&&sel.kind==='field')el.innerHTML=`<b>INSPECT</b> ${esc(cap(M.fieldLabel(pz,r,sel.id)))} selected: now tap the document line it should match.`;
    else if(sel)el.innerHTML=`<b>INSPECT</b> Document line selected: now tap the manifest field to check against it.`;
    else if(assist().oneTap)el.innerHTML=`<b>INSPECT</b> Tap a field to check it, or Check all. The ${esc(r.region)} depot’s lines are lit.`;
    else el.innerHTML=`<b>INSPECT</b> Tap a manifest field, then the document line it should match. The ${esc(r.region)} depot’s lines are lit.`;
  }
  function meters(){
    if(endless){
      const run=endless.run,best=(()=>{try{return Number(localStorage.getItem(M.BEST_KEY))||0;}catch{return 0;}})();
      shell.meters([{label:'Night',value:String(pz.endless.day)},{label:'Manifest',value:rep()?`${st.cursor+1} / ${pz.reports.length}`:'done'},{label:'Cleared',value:String(run.cleared),tone:run.cleared?'good':''},
        {label:'Mistakes',value:`${run.mistakes} / ${M.ENDLESS.mistakes}`,tone:run.mistakes?'bad':''},{label:'Best',value:String(best)}]);
      shell.undoEnabled(false);return;
    }
    const found=st.evidence.filter(Boolean).length;
    shell.meters([{label:'Manifest',value:rep()?`${st.cursor+1} / ${pz.reports.length}`:'done'},{label:'Stamped',value:`${st.cursor} / ${pz.reports.length}`,tone:st.cursor===pz.reports.length?'good':''},
      {label:'Evidence',value:String(found),tone:found?'good':''},{label:'Citations',value:String(cites.length),tone:cites.length?'bad':''},{label:'Hints',value:String(count.hints),tone:count.hints?'warn':''}]);
    shell.undoEnabled(st.cursor>0&&!shell.ended);
  }
  function renderAssist(){
    stage.querySelectorAll('[data-assist]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.assist===prefs.assist)));
    $('icAssistNote').innerHTML=`<b>${esc(assist().label)}:</b> ${esc(assist().text)} Keys: V verify · F forged · 1–9 check a field · C check all · U undo. Swipe the manifest right to verify, left for forged.`;
  }

  // ---- actions ----------------------------------------------------------------------------------------------------
  function pickField(f,el){
    if(locked())return;shell.begin();
    if(sel&&sel.kind==='entry'){const e=sel.id;sel=null;return compareTwo(f,e);}
    if(assist().oneTap){sel=null;return tapField(f);}
    if(sel&&sel.kind==='field'&&sel.id===f){sel=null;marks();inspectLine();return;}
    sel={kind:'field',id:f};focusEntry=null;
    const ks=M.checksFor(pz,rep(),f);if(ks[0]){setTab(docOf(ks[0]));if(wide())entryEl(ks[0])?.scrollIntoView?.({block:'nearest'});}
    marks();inspectLine();shell.flash(el);
  }
  function pickEntry(e,el){
    if(locked())return;shell.begin();
    if(sel&&sel.kind==='field'){const f=sel.id;sel=null;return compareTwo(f,e);}
    if(sel&&sel.kind==='entry'&&sel.id===e){sel=null;marks();inspectLine();return;}
    sel={kind:'entry',id:e};marks();inspectLine();shell.flash(el);
  }
  function setEvidence(){
    const r=rep(),ev=r&&st.evidence[r.id],el=$('icEvidence');if(!el||!ev||el.classList.contains('found'))return;
    el.className='ic-evidence found';el.innerHTML=`<b>✕ EVIDENCE</b> ${esc(ev.text)}`;shell.flash(el);
  }
  // Show one line: open its tab, bring it into view, keep it lit, flash it.
  function showEntry(e,cls){
    setTab(docOf(e));focusEntry=e;const el=entryEl(e);if(!el)return;
    if(wide())el.scrollIntoView?.({block:'nearest'});marks();flashClass(el,cls);
  }
  // One tap: the field against every line it must match.
  function tapField(f){
    const r=rep(),c=M.checkField(pz,r,f);
    M.apply(pz,st,{type:'check',field:f});count.compares+=c.results.length;shell.log('check',{report:r.id,field:f,result:c.state});
    if(hintAt&&hintAt.field===f)hintAt=null;
    showResult(r,c,true);meters();
  }
  function showResult(r,c,focus){
    const ck=checked[r.id]||(checked[r.id]={}),f=c.field;
    if(c.state==='bad')ck[f]='bad';else if(c.state==='ok'&&ck[f]!=='bad')ck[f]='ok';
    if(c.state==='bad'){setEvidence();if(c.rule&&!/^(sensor|rule|log)/.test(c.entry))circle(r,f,fieldEl(f));}
    if(focus&&c.entry)showEntry(c.entry,c.state==='bad'?'ic-clash':'ic-agree');else marks();
    const fe=fieldEl(f);if(fe)flashClass(fe,c.state==='bad'?'ic-clash':'ic-agree');
    if(!focus)return;
    if(c.state==='bad'){inspectLine(`<b>✕ DISCREPANCY</b> ${esc(c.text)}`,'bad');shell.status('Discrepancy found and recorded as evidence.','warn');}
    else if(c.state==='ok')inspectLine(`<b>✓ MATCH</b> ${esc(c.text)}`,'good');
    else inspectLine(`<b>– NOTHING TO CHECK</b> ${esc(M.suggest(pz,r,f))}`);
  }
  // Two taps (Classic, or a line first): one field against one line.
  function compareTwo(f,entry){
    const r=rep(),c=M.explain(pz,r,f,entry);
    M.apply(pz,st,{type:'compare',field:f,entry});count.compares++;shell.log('compare',{report:r.id,field:f,entry,result:c.result});
    const ck=checked[r.id]||(checked[r.id]={}),fe=fieldEl(f),ee=entryEl(entry);
    if(c.result==='mismatch'){
      ck[f]='bad';if(hintAt&&hintAt.field===f)hintAt=null;focusEntry=entry;if(/^(guide|roster|sig):/.test(entry))circle(r,f,fe);
      setEvidence();marks();[fe,ee].forEach(x=>x&&flashClass(x,'ic-clash'));
      inspectLine(`<b>✕ DISCREPANCY</b> ${esc(c.text)}`,'bad');shell.status('Discrepancy found and recorded as evidence.','warn');
    }else if(c.result==='match'){
      if(ck[f]!=='bad')ck[f]='ok';if(hintAt&&hintAt.field===f)hintAt=null;focusEntry=entry;
      marks();[fe,ee].forEach(x=>x&&flashClass(x,'ic-agree'));
      inspectLine(`<b>✓ MATCH</b> ${esc(c.text)}`,'good');
    }else{
      marks();if(ee)shell.flash(ee,'mg-shake');
      inspectLine(`<b>${c.result==='wrongline'?'↷ WRONG LINE':'– NOT COMPARABLE'}</b> ${esc(c.text)}`,'');
    }
    meters();
  }
  function checkAll(){
    if(locked())return;shell.begin();sel=null;
    const r=rep(),free=assist().freeCheckAll,results=M.fields(r).map(f=>M.checkField(pz,r,f)).filter(c=>c.state!=='none');
    M.apply(pz,st,{type:'checkall',free});if(!free)capped=true;count.checkAll++;count.compares+=results.reduce((a,c)=>a+c.results.length,0);
    shell.log('checkall',{report:r.id,free});clearCascade();
    const end=()=>{
      cascade=null;const bad=results.find(c=>c.state==='bad');
      if(bad){showEntry(bad.entry,'ic-clash');inspectLine(`<b>✕ DISCREPANCY</b> ${esc(bad.text)}`,'bad');}
      else inspectLine(`<b>✓ ALL CLEAR</b> Every field matches the documents.`,'good');
      shell.status(free?'Check all ran (Relaxed: free).':'Check all ran: this round is capped at Good.',bad?'warn':'');meters();
    };
    if(reduced()){results.forEach(c=>showResult(r,c,false));return end();}
    let k=0;const step=()=>{if(rep()!==r)return;if(k>=results.length)return end();showResult(r,results[k++],false);cascade=setTimeout(step,35);};step();
  }
  function clearCascade(){if(cascade){clearTimeout(cascade);cascade=null;}}
  function flashClass(el,cls){if(reduced())return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);el.addEventListener('animationend',()=>el.classList.remove(cls),{once:true});}

  // The stamped card flies off as a ghost over the next card, which is already in place. Any tap skips it.
  function flyAway(card,verdict){
    clearGhost();if(!card||reduced())return;
    card.removeAttribute('id');card.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));card.inert=true;card.style.transform='';
    card.classList.remove('ic-dragging');card.classList.add('ic-ghost',verdict==='verified'?'go-r':'go-l');
    const ink=card.querySelector('.ic-ink');ink.textContent=verdict==='verified'?'VERIFIED':'FORGED';ink.className='ic-ink on '+verdict;
    $('icGhosts').appendChild(card);ghost=card;
    card.addEventListener('animationend',e=>{if(e.animationName.startsWith('ic-go'))clearGhost();});
    ghostTimer=setTimeout(clearGhost,600);
  }
  function clearGhost(){clearTimeout(ghostTimer);if(ghost){ghost.remove();ghost=null;}}
  function stamp(verdict){
    if(locked())return;
    const r=rep(),i=st.cursor,hadEv=!!st.evidence[i],card=$('icReport');
    shell.begin();if(!endless)history.push(M.clone(st));M.apply(pz,st,{type:'stamp',verdict});shell.log('stamp',{report:r.id,verdict,evidence:hadEv});
    if(endless)endless.run=M.endlessStep(endless.run,(verdict==='forged')===r.forged?'right':'wrong');
    sel=null;hintAt=null;focusEntry=null;clearCascade();flyAway(card,verdict);
    const c=M.citation(pz,st,i);cites=M.citations(pz,st);
    const to=M.destName(pz,r.dest);
    shell.status(c?`Manifest ${r.no} stamped ${verdict.toUpperCase()}: cited.`:verdict==='verified'?`Manifest ${r.no} VERIFIED: convoy ${r.callsign} is cleared for ${to}.`
      :hadEv?`Manifest ${r.no} stamped FORGED, evidence attached: the convoy is stopped.`:`Manifest ${r.no} stamped FORGED without evidence: allowed, but it scores less.`,c?'bad':verdict==='forged'&&!hadEv?'warn':'good');
    if(c)showSlip(c);else hideSlip();
    renderStrip();renderLog();renderReport();meters();
    if(endless){if(endless.run.over)return finishEndless();if(!rep())return nextDay();startTimer();return;}
    if(!rep())finishRound();
  }
  function onUndo(){
    if(!history.length||shell.ended)return;
    clearGhost();review=null;st=history.pop();st.capped=st.capped||capped;cites=M.citations(pz,st);count.undos++;sel=null;hintAt=null;focusEntry=null;
    hideSlip();renderStrip();renderLog();renderReport('return');meters();
    shell.status(`Manifest ${rep().no} un-stamped and back on the desk.`);
  }
  function undoTo(i){
    if(shell.ended)return;
    while(st.cursor>i&&history.length){shell.log('undo');st=history.pop();count.undos++;}
    st.capped=st.capped||capped;cites=M.citations(pz,st);review=null;sel=null;hintAt=null;focusEntry=null;clearGhost();hideSlip();
    renderStrip();renderLog();renderReport('return');meters();shell.status(`Back to manifest ${rep().no}: everything after it is un-stamped.`);
  }
  function onHint(){
    if(locked())return;
    const h=M.hint(pz,st);if(!h)return;count.hints++;if(!started)started=Date.now();hintAt=h;sel=null;
    setTab(docOf(h.entry));marks();meters();
    if(wide())entryEl(h.entry)?.scrollIntoView?.({block:'nearest',behavior:reduced()?'auto':'smooth'});
    shell.status('Hint: '+h.text,'good');inspectLine();
  }
  function onAuto(){
    if(endless)return endlessResult('You left the desk');
    clearGhost();review=null;const a=M.auto(pz),ev=a.evaluation;st=a.state;history=[];sel=null;hintAt=null;cites=[];hideSlip();renderStrip();renderLog();renderReport();meters();
    const cons=M.consequences(pz,st);
    return {score:M.score(pz,ev,0,0),headline:`The desk stamped everything VERIFIED: ${ev.approved.length} sabotaged convoy${ev.approved.length===1?'':'s'} slipped through. ${cons.slice(0,2).join(' ')}`,
      nearMiss:M.nearMiss(pz,st),output:M.output(pz,st),stats:stats(ev)};
  }
  function stats(ev){
    return {Correct:`${ev.correct} / ${ev.total}`,'Sabotage stopped':`${ev.forged-ev.approved.length} / ${ev.forged}`,'With evidence':`${ev.backed} / ${ev.forged}`,
      Citations:String(cites.length),Hints:String(count.hints),Checks:String(count.compares),...(count.checkAll?{'Check all':String(count.checkAll)}:{})};
  }
  function finishRound(){
    st.capped=st.capped||capped;
    const ev=M.evaluate(pz,st),tier=M.tier(pz,ev),cons=M.consequences(pz,st);
    meters();
    const head=tier==='perfect'?`All ${ev.total} manifests right, and every sabotaged convoy stopped with evidence.`
      :tier==='good'?(ev.capped&&ev.backed===ev.forged?`All ${ev.total} manifests right, with Check all (capped at Good; Relaxed makes it free).`:`All ${ev.total} manifests right; ${ev.unbacked.length} sabotaged convoy${ev.unbacked.length===1?'':'s'} stopped without evidence.`)
      :`${ev.correct} of ${ev.total} manifests right.`;
    const citeLine=cites.length?` ${cites.length} citation${cites.length===1?'':'s'} on file: ${cites.map(c=>'manifest '+pz.reports[c.report].no).join(', ')}.`:'';
    const more=cons.length>2?` And ${cons.length-2} more.`:'';
    const sc=M.score(pz,ev,elapsed(),count.hints);
    shell.finish({tier,score:sc,headline:[head,...cons.slice(0,2)].join(' ')+more+citeLine,nearMiss:M.nearMiss(pz,st),output:M.output(pz,st),stats:{...stats(ev),Score:String(sc)}});
  }

  // ---- the night shift (Endless): a gentle timer per manifest, a new night every six, three mistakes end it --------
  function banner(){
    const el=$('icBanner');if(!endless){el.hidden=true;return;}
    el.hidden=false;el.innerHTML=`<b>NIGHT ${pz.endless.day} · NEW RULE</b> ${esc(pz.newRule.text.replace(/^Night \d+: /,''))}`;
    el.classList.remove('in');if(!reduced()){void el.offsetWidth;el.classList.add('in');}
  }
  function startTimer(){
    if(!endless)return;const r=rep();if(!r)return;
    if(endless.cardId!==`${pz.endless.day}:${r.id}`){endless.cardId=`${pz.endless.day}:${r.id}`;endless.cardAt=Date.now();}
    if(!endless.timer)endless.timer=setInterval(tickTimer,250);tickTimer();
  }
  function stopTimer(){if(endless&&endless.timer){clearInterval(endless.timer);endless.timer=null;}}
  function tickTimer(){
    if(!endless||shell.ended){stopTimer();return;}
    const left=M.ENDLESS.seconds-(Date.now()-endless.cardAt)/1000,bar=$('icTimerBar');
    if(bar){bar.style.width=Math.max(0,100*left/M.ENDLESS.seconds).toFixed(1)+'%';bar.className=left<10?'low':'';}
    if(left>0||review)return;
    // Time ran out: one mistake, and the clock restarts on the same manifest.
    endless.run=M.endlessStep(endless.run,'timeout');endless.cardAt=Date.now();shell.log('timeout',{day:pz.endless.day,report:rep()?.id});
    shell.status(`Too slow: manifest ${rep()?.no} sat on the desk. One mistake (${endless.run.mistakes} of ${M.ENDLESS.mistakes}).`,'bad');meters();
    if(endless.run.over)finishEndless();
  }
  function nextDay(){
    endless.run=M.endlessStep(endless.run,'day');
    pz=M.endlessDay(endless.seed,endless.run.day);st=M.create(pz);history=[];sel=null;hintAt=null;checked={};review=null;cites=[];focusEntry=null;hideSlip();
    tab='rules';renderDocs();renderReport();renderStrip();meters();banner();startTimer();
    shell.status('NEW RULE · '+pz.newRule.text);
  }
  function endlessResult(why){
    stopTimer();const run=endless.run,rec=M.recordBest(localStorage,run.cleared);
    const tier=run.cleared>=18&&rec.isNew?'perfect':run.cleared>=12?'good':run.cleared>=6?'partial':'failed';
    const last=cites.at(-1);
    return {tier,score:run.cleared,headline:`${why} on night ${run.day}: ${run.cleared} manifest${run.cleared===1?'':'s'} cleared. ${rec.isNew?`New personal best (was ${rec.previous}).`:`Personal best: ${rec.best}.`}`,
      nearMiss:last?last.text:'',output:M.output(pz,st),stats:{Night:String(run.day),Cleared:String(run.cleared),Mistakes:`${run.mistakes} / ${M.ENDLESS.mistakes}`,Best:String(rec.best),Hints:String(count.hints)}};
  }
  function finishEndless(){const res=endlessResult('Shift over');meters();shell.finish(res);}

  // ---- events -----------------------------------------------------------------------------------------------------
  stage.addEventListener('click',e=>{
    if(suppressClick){suppressClick=false;return;}
    const b=e.target.closest('button');if(!b||!stage.contains(b))return;
    if(!started)started=Date.now();
    if(b.dataset.field)return pickField(b.dataset.field,b);
    if(b.dataset.entry)return review?null:pickEntry(b.dataset.entry,b);
    if(b.dataset.tab)return setTab(b.dataset.tab);
    if(b.dataset.review){const i=+b.dataset.review;return review&&review.i===i?closeReview():openReview(i);}
    if(b.dataset.assist){prefs.assist=b.dataset.assist;savePrefs();sel=null;renderAssist();marks();inspectLine();shell.status(`Assist: ${assist().label}. ${assist().text}`);return;}
    switch(b.id){
      case 'icVerified':return stamp('verified');
      case 'icForged':return stamp('forged');
      case 'icCheckAll':return checkAll();
      case 'icShowMe':{const c=cites.find(x=>String(x.report)===$('icSlip').dataset.report);hideSlip();if(c)openReview(c.report,c.field,c.entry);return;}
      case 'icSlipClose':return hideSlip();
      case 'icCiteChip':{const c=cites.at(-1);if(c)showSlip(c);return;}
      case 'icBack':return closeReview();
      case 'icUndoTo':return undoTo(review.i);
    }
  });
  // Any tap or key skips the flying card.
  document.addEventListener('pointerdown',()=>{suppressClick=false;clearGhost();},true);
  // Swipe the manifest: right stamps VERIFIED, left stamps FORGED.
  stage.addEventListener('pointerdown',e=>{
    const card=e.target.closest('#icReport');if(!card||locked()||e.button>0||card.classList.contains('ic-done'))return;
    drag={x:e.clientX,y:e.clientY,id:e.pointerId,card,on:false,dx:0};
  });
  window.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.on){if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.3){drag.on=true;drag.card.classList.add('ic-dragging');}else{if(Math.abs(dy)>16)drag=null;return;}}
    drag.dx=dx;drag.card.style.transform=`translateX(${dx}px) rotate(${dx/40}deg)`;drag.card.dataset.lean=dx>70?'verified':dx<-70?'forged':'';
  });
  const endDrag=(e,cancel)=>{
    if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;if(!d.on)return;
    suppressClick=true;d.card.classList.remove('ic-dragging');d.card.dataset.lean='';
    if(!cancel&&Math.abs(d.dx)>=90)return stamp(d.dx>0?'verified':'forged');
    d.card.style.transform='';
  };
  window.addEventListener('pointerup',e=>endDrag(e,false));window.addEventListener('pointercancel',e=>endDrag(e,true));
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.target&&/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))return;
    if(!$('mgResult').hidden||!pz)return;
    clearGhost();
    const k=e.key.toLowerCase();
    if(k==='escape'){if(review)closeReview();else if(sel){sel=null;marks();inspectLine();}return;}
    if(k==='u'){if(!$('mgUndo').disabled)$('mgUndo').click();e.preventDefault();return;}
    if(locked())return;
    if(k==='v')stamp('verified');else if(k==='f')stamp('forged');else if(k==='c')checkAll();
    else if(/^[1-9]$/.test(k)){const f=M.fields(rep())[+k-1];if(!f)return;if(!started)started=Date.now();pickField(f,fieldEl(f));}
    else return;
    e.preventDefault();
  });
  shell.start();
})();
