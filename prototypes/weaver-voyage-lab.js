(function(){
  'use strict';
  // One screen at a time: departure → prepare → fight → result → … → summary.
  // The action bar always holds the single next step; everything else is secondary.
  const M=WeaverVoyage,$=id=>document.getElementById(id),KEY='spacologyWeaverVoyageLabV1';
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const first=id=>M.ROSTER[id].name.split(' ')[0];
  // Portraits: cast art by default; a path with a folder (lore/…) is relative to assets.
  const art=id=>{const a=M.ROSTER[id].art;return '../assets/'+(a.includes('/')?a:'cast/'+a)};
  // Crew grouped by family, Weavers first.
  const byFamily=ids=>Object.keys(M.FAMILIES).map(f=>[f,ids.filter(id=>(M.ROSTER[id].family||'aether')===f)]).filter(([,list])=>list.length);
  const familyHead=f=>`<h3 class="famhead">${esc(M.FAMILIES[f])}</h3>`;
  const writs=n=>n+(n===1?' Writ':' Writs');
  const pieceName=p=>M.SETS[p.set].name+' '+M.SLOT_NAMES[p.slot];
  const SETNAME=id=>M.SETS[id].name;
  let s=null,lastFight=null,replay=null;
  const ui={legendClosed:typeof window!=='undefined'&&window.innerWidth<600,screen:null,tab:'crew',sel:null,picked:[],reward:null,rewardPiece:'deephold:core',release:null,drawer:null};

  // ---------------------------------------------------------------- persistence
  function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&v.version===3)return v}catch{}return null}
  function save(){try{const c={...s};delete c.lastFight;localStorage.setItem(KEY,JSON.stringify(c))}catch{message('Browser storage is unavailable; export to keep this voyage.')}}
  function message(t){$('message').textContent=t||''}
  function fresh(seed,count){s=M.create({seed,affixCount:count});s.meta={startedAt:Date.now()};s.feedback={};lastFight=null;stopReplay();Object.assign(ui,{screen:null,tab:'crew',sel:null,picked:[],reward:null,release:null,drawer:null});save();render()}
  function act(a,ok){const err=M.act(s,a);if(err){message(err);render();return false}
    if(s.lastFight){lastFight=s.lastFight;delete s.lastFight}save();message(ok||'');render();return true}

  // ---------------------------------------------------------------- routing
  function screen(){
    if(ui.screen==='fight'&&lastFight)return 'fight';
    if((ui.screen==='result'||s.pendingDrop)&&s.fights.length)return 'result';
    if(s.ended)return 'summary';
    if(M.nodeType(s)==='setup')return 'departure';
    return 'prepare';
  }
  function render(){
    renderHud();renderDrawer();
    const sc=screen();
    ({departure,prepare,fight:fightScreen,result,summary})[sc]();
    document.body.dataset.screen=sc;
  }
  function bar(label,onClick,{hint='',disabled=false}={}){
    $('actionHint').innerHTML=hint;const b=$('primary');b.textContent=label;b.disabled=disabled;b.onclick=onClick;
  }

  // ---------------------------------------------------------------- HUD and drawers
  function renderHud(){
    const sector=M.sectorOf(Math.min(s.node,21)),cap=M.capacityPreview(s),names=s.brief.affixes.map(id=>M.AFFIXES[id].name);
    const dots=M.ROUTE.map((t,i)=>{const n=i+1,f=s.fights.find(x=>x.node===n);
      const cls=f?(f.score>=1?'perfect':f.score>=.88?'slight':f.score>=.42?'loss':'heavy'):n<s.node?'done':'';
      return `<span class="dot ${['supply','survey','swarm','elite','boss'].includes(t)?'battle':''} ${cls} ${n===s.node&&!s.ended?'now':''} ${n===8||n===15?'gap':''}" title="${n} · ${esc(M.NODE_NAMES[t])}${f?' · '+Math.round(f.score*100)+'%':''}"></span>`}).join('');
    const chip=(v,l,t='')=>`<span class="chip" title="${esc(t)}"><b>${esc(v)}</b>${esc(l)}</span>`;
    $('hud').innerHTML=`<div class="dots" aria-label="Route: node ${Math.min(s.node,21)} of 21">${dots}</div><div class="chips">
      <span class="chip sector" title="${esc(names.join(' · ')||'No affixes')}">Sector ${sector} · ${names.length?names.length+' affix'+(names.length>1?'es':''):'no affixes'}</span>${chip(s.integrity+'%','integrity')}${chip(s.writs,'Writs · fund '+(s.writFund||0)+'/'+M.ECON.writCost)}${chip(s.gold,'Gold')}
      ${chip(s.insight||0,'Insight','Promotes crew: ★2 costs '+M.STARS.cost[2]+', ★3 '+M.STARS.cost[3]+', ★4 '+M.STARS.cost[4])}${chip(s.crew.length,'crew')}${chip(cap.total,'Aether cap',`6 base + ${cap.weavers} Weavers + ${cap.reservoir} reservoir${cap.stars?` + ${cap.stars} from Ivara ★3`:''} + ${cap.deepHold} Deep Hold + ${cap.condition} from affixes`)}${s.freeVoucher?chip(s.freeVoucher,'free voucher'):''}</div>`;
  }
  // The Brief: the affixes are the largest thing on the screen; each states its tax and its gift.
  function briefHtml(){
    const cards=s.brief.affixes.length?s.brief.affixes.map(id=>{const X=M.AFFIXES[id];
      return `<article class="affix"><p class="eyebrow">${X.category==='rule'?'Rule':X.category==='stat'?'Stat':'Shape'}</p><div class="cond">${esc(X.name)}</div><div class="small"><b>Tax</b> · ${esc(X.tax)}</div>${X.gift?`<div class="small gift"><b>Gift</b> · ${esc(X.gift)}</div>`:''}</article>`}).join('')
      :'<article class="affix"><div class="cond">No affixes</div><div class="small">The rules, nothing else.</div></article>';
    const cur=M.sectorOf(Math.min(s.node,21));
    return `<div class="brief">${cards}</div><div class="bosses">${s.brief.bosses.map((b,i)=>`<div class="${i+1===cur&&s.node>1&&!s.ended?'current':''}"><span class="eyebrow">Sector ${i+1} boss</span><b>${esc(M.BOSSES[b].name)}</b><span class="small muted">${esc(M.BOSSES[b].text)}</span></div>`).join('')}</div>`;
  }
  const countOptions=n=>[0,1,2,3,4].map(k=>`<option value="${k}" ${k===n?'selected':''}>${k} affix${k===1?'':'es'}${k===2?' (default)':''}</option>`).join('');
  function renderDrawer(){
    const d=$('drawer');['openBrief','openLog','openNotes','openExport','openRestart'].forEach(id=>$(id).setAttribute('aria-pressed',String(ui.drawer===id)));
    if(!ui.drawer){d.hidden=true;d.innerHTML='';return}d.hidden=false;
    if(ui.drawer==='openBrief')d.innerHTML='<p class="eyebrow">The Brief</p>'+briefHtml();
    if(ui.drawer==='openLog')d.innerHTML='<p class="eyebrow">Voyage log</p><div class="log">'+(s.log.slice().reverse().map(l=>`<p><span class="muted">#${l.node}</span> ${esc(l.text)}</p>`).join('')||'<p class="muted">Nothing yet.</p>')+'</div>';
    if(ui.drawer==='openNotes'){d.innerHTML=notesHtml();wireNotes(d)}
    if(ui.drawer==='openRestart'){
      d.innerHTML=`<p class="eyebrow">Restart</p><div class="row"><button id="restartSame">${ui.confirmRestart?'Tap again — restart from node 1':'Restart this voyage'}</button><span class="small muted">Same Brief and seed (${s.brief.affixes.length} affix${s.brief.affixes.length===1?'':'es'}, seed ${s.seed}), so you can try a different opening against the same voyage.</span></div>
        <form id="restartNew" class="row" style="margin-top:10px"><label>Affixes<select id="rBrief">${countOptions(s.brief.count===undefined?s.brief.affixes.length:s.brief.count)}</select></label><label>Seed<input id="rSeed" type="number" min="1" value="${s.seed+1}"></label><button type="submit">Start a new voyage</button></form>
        <p class="small muted">Either way, this voyage's progress is replaced. Export first if you want to keep it.</p>`;
      $('restartSame').onclick=()=>{if(!ui.confirmRestart){ui.confirmRestart=true;renderDrawer();return}ui.confirmRestart=false;fresh(s.seed,s.brief.affixes.length);message('Restarted at node 1 with the same Brief and seed.')};
      $('restartNew').onsubmit=e=>{e.preventDefault();fresh(+$('rSeed').value||41,+$('rBrief').value);message('New voyage rolled.')};
    }
    if(ui.drawer==='openExport'){const text=exportText();d.innerHTML='<p class="eyebrow">Export</p><p class="small">Copy this JSON into a file or message. It includes every purchase, fight, and your notes.</p><textarea readonly aria-label="Exported playtest JSON" style="min-height:200px"></textarea>';
      const t=d.querySelector('textarea');t.value=text;t.select();try{navigator.clipboard.writeText(text).then(()=>message('Copied to the clipboard.'),()=>{})}catch{}}
  }
  function notesHtml(){const f=s.feedback;
    return `<p class="eyebrow">Notes</p><div class="row"><label>Agency<select data-fb="agency"><option value="">Unrated</option><option>1 · Luck decided it</option><option>2</option><option>3</option><option>4</option><option>5 · My choices decided it</option></select></label>
      <label>Excitement<select data-fb="excitement"><option value="">Unrated</option><option>1 · Flat</option><option>2</option><option>3</option><option>4</option><option>5 · Couldn't wait for the next fight</option></select></label></div>
      <label class="small muted" style="display:block;margin-top:10px">Before this voyage: "This time I'm going to try…"<textarea data-fb="plan"></textarea></label>
      <label class="small muted" style="display:block;margin-top:10px">Afterwards: what actually happened?<textarea data-fb="notes"></textarea></label>`;}
  const planHtml=()=>`<label class="small muted" style="display:block">Before you depart, one sentence: "This time I'm going to try…"<textarea data-fb="plan"></textarea></label>`;
  function wireNotes(root){root.querySelectorAll('[data-fb]').forEach(el=>{el.value=s.feedback[el.dataset.fb]||'';el.addEventListener('input',()=>{s.feedback[el.dataset.fb]=el.value;save()})})}
  function exportText(){const c={...s};delete c.lastFight;return JSON.stringify({lab:'weaver-voyage',version:1,exportedAt:new Date().toISOString(),wallSeconds:s.meta?Math.round((Date.now()-s.meta.startedAt)/1000):null,voyage:c},null,1)}
  ['openBrief','openLog','openNotes','openExport','openRestart'].forEach(id=>$(id).onclick=()=>{ui.drawer=ui.drawer===id?null:id;ui.confirmRestart=false;renderDrawer()});

  // ---------------------------------------------------------------- shared pieces
  function crewCard(id,{button=''}={}){const R=M.ROSTER[id];
    return `<div class="who"><img class="portrait" src="${art(id)}" alt="" loading="lazy"><div><b>${esc(R.name)}</b><div class="labels"><span class="tag">${esc(R.role)}</span><span class="tag profile">${esc(R.profile)}</span>${scaleTags(R)}</div></div></div><p>${esc(R.kit)}</p><p class="small up3"><b>★3:</b> ${esc(R.up3||'')}</p><p class="wants">Wants: ${R.wants.map(k=>esc(M.STATS[k].name)).join(', ')}</p>${button}`}
  // Element and scaling stat: what this crewmate's kit multiplies, and which elemental damage stat helps them.
  function scaleTags(R){return `<span class="tag scale" title="Kit damage, healing and barrier grow with ${esc(M.SCALING[R.scales].name.toLowerCase())}">Scales: ${esc(M.SCALING[R.scales].name)}</span><span class="tag el el-${R.el}">${esc(R.el[0].toUpperCase()+R.el.slice(1))}</span>`}
  function faces(set,size=''){return facesFor(M.SETS[set].bestOn,size)}
  function facesFor(ids,size=''){const owned=new Set(s.crew.map(c=>c.id));
    return `<span class="faces ${size}">${ids.map(id=>`<img src="${art(id)}" alt="${esc(first(id))}" title="${esc(M.ROSTER[id].name)}${owned.has(id)?' — aboard':' — not aboard'}" class="${owned.has(id)?'':'unowned'}">`).join('')}</span>`}
  const qcls=q=>q>=.75?'q-hi':q>=.45?'q-mid':'q-lo';
  const stars=p=>`<span class="tier t${M.tierOf(p)}" title="Tier ${M.tierOf(p)}: ${M.tierOf(p)} substat${M.tierOf(p)>1?'s':''}">${'★'.repeat(M.tierOf(p))}</span>`;
  const qbadge=p=>stars(p)+`<span class="q ${qcls(M.quality(p))}" title="Roll quality: how close the substats are to their maximum">${Math.round(M.quality(p)*100)}%</span>`;
  const perkName=x=>{const [id,l]=x.split(':');return (l==='full'?'completes ':'unlocks the 2-piece ')+SETNAME(id)};
  const fmtDelta=(k,d)=>(d>0?'+':'−')+(M.STATS[k].pct?Math.round(Math.abs(d)*100)+'%':Math.round(Math.abs(d)*10)/10)+' '+M.STATS[k].name.toLowerCase();
  function verdictLine(p){const u=M.bestUse(s,p);
    if(!u)return '<span class="verdict scrap">No upgrade for anyone — scrap</span>';
    const fit=M.setFit(u.crew,p.set)>=1,suits=M.SETS[p.set].bestOn.filter(id=>s.crew.some(c=>c.id===id));
    return `<span class="verdict up">Upgrade for ${esc(first(u.crew))}${u.gained.length?' · '+esc(u.gained.map(perkName).join(', ')):''}${!fit&&suits.length?` <span class="muted">— for the stats (${esc(SETNAME(p.set))} suits ${esc(suits.map(first).join(', '))})</span>`:''}</span>`}
  function mini(p){const [mk,mv]=M.MAIN[p.slot];
    return `<div class="mini set-${p.set}"><span><span class="swatch"></span><b>${esc(SETNAME(p.set))}</b> ${qbadge(p)}</span><span class="small">${esc(M.fmtStat(mk,mv))} · ${(p.subs||[]).map(x=>esc(M.fmtStat(x.stat,x.v))).join(' · ')}</span></div>`}
  function comparePanel(p){
    const rows=M.compareFor(s,p),label={upgrade:'Upgrade',sidegrade:'About the same',downgrade:'Downgrade'};
    return `<div class="compare"><div class="cmphead"><span>Comparing ${mini(p)}</span><span class="row" style="flex:0 0 auto"><button id="scrapSel">Scrap · +${M.ECON.scrap} Gold</button><button id="cancelSel">Cancel</button></span></div>
      <p class="small muted">Against what each crewmate wears in the ${esc(M.SLOT_NAMES[p.slot])} slot. Set perks gained or lost outweigh stats; stats a crewmate wants count most.</p>
      <div class="cmprows">${rows.map(r=>{const w=M.ROSTER[r.crew].wants;
        const deltas=Object.entries(r.statDelta).sort((a,b)=>w.includes(b[0])-w.includes(a[0])).map(([k,d])=>`<span class="d ${d>0?'pos':'neg'} ${w.includes(k)?'wanted':''}">${esc(fmtDelta(k,d))}</span>`).join('');
        const perks=r.gained.map(x=>`<span class="d pos wanted">${esc(perkName(x))}</span>`).join('')+r.lost.map(x=>`<span class="d neg wanted">breaks ${esc(SETNAME(x.split(':')[0]))} ${x.endsWith('full')?'full set':'2-piece'}</span>`).join('');
        return `<div class="cmprow v-${r.verdict}"><div class="cmpwho"><img class="portrait" src="${art(r.crew)}" alt=""><div><b>${esc(first(r.crew))}</b><span class="vbadge">${label[r.verdict]}</span></div></div>
          <div class="cmpcur"><span class="small muted">Now</span>${r.current?mini(r.current):'<span class="small">Empty slot</span>'}</div>
          <div class="cmpdelta">${perks}${deltas||'<span class="small muted">No stat change</span>'}</div>
          <button data-put="${r.crew}|0" class="${r.verdict==='upgrade'?'primary':''}" style="min-width:0">Equip on ${esc(first(r.crew))}</button></div>`}).join('')}</div></div>`;
  }
  function pieceCard(p,attrs,extra=''){
    const fit=M.SETS[p.set].bestOn.filter(id=>s.crew.some(c=>c.id===id)),wanted=new Set(fit.flatMap(id=>M.ROSTER[id].wants));
    const [mk,mv]=M.MAIN[p.slot],subs=(p.subs||[]).map(x=>`<span class="${wanted.has(x.stat)?'want':''}">${esc(M.fmtStat(x.stat,x.v))}</span>`).join(' · ');
    const hint=verdictLine(p);
    return `<button class="piece set-${p.set}" ${attrs}><span class="ptop"><b><span class="swatch"></span>${esc(pieceName(p))}</b>${qbadge(p)}</span><small>${esc(M.fmtStat(mk,mv))}</small><small>${subs}</small><small class="muted">${esc(M.SETS[p.set].short)}</small>${faces(p.set,'tiny')}${hint}${extra}</button>`;
  }
  function setsLegend(){
    return `<div class="sets">${M.SET_IDS.map(id=>{const S=M.SETS[id];
      return `<article class="setcard set-${id}"><div class="sethead"><span class="swatch"></span><b>${esc(S.name)}</b></div>
        <div class="perk">${esc(S.short)}</div><div class="small">${esc(S.half)}</div><div class="small">${esc(S.rule)}</div>
        <div class="best"><span class="small">Best on</span>${faces(id)}</div><div class="small muted">${esc(S.why)}</div>
</article>`}).join('')}</div><p class="small muted">Every piece's main stat comes from its slot — ${M.SLOTS.map(k=>esc(M.SLOT_NAMES[k])+' '+esc(M.fmtStat(...M.MAIN[k]))).join(', ')} — plus random substats: one per ★ tier (★1–★4). Tiers rise each sector, and elite and boss drops are one tier higher. The % is roll quality; <span class="want">highlighted</span> substats are ones a crewmate who suits that set wants.</p>`}
  // One short sentence about the crewmate's set; the full rule stays in the Set perks legend.
  function progressLine(c){
    return M.setProgress(c).map(p=>{if(!p.set)return `<div class="progress muted">No set started</div>`;
      const S=M.SETS[p.set],misfit=S.onlyOn&&!S.bestOn.includes(c.id)?` <span class="warn">· its perk won't work on ${esc(first(c.id))}</span>`:'';
      if(p.complete)return `<div class="progress done set-${p.set}" title="${esc(S.rule)}"><span class="swatch"></span>${esc(S.name)} 5/5 · full set on${misfit}</div>`;
      const second=(p.halves||[]).filter(id=>id!==p.set).map(id=>`<div class="progress set-${id}" title="${esc(M.SETS[id].half)}"><span class="swatch"></span>${esc(M.SETS[id].name)} 2/5 <span class="half">· 2-piece perk on</span></div>`).join('');
      return `<div class="progress ${p.count===1||p.count===4?'near':''} set-${p.set}" title="${esc(S.half)}"><span class="swatch"></span>${esc(S.name)} ${p.count}/5 — needs ${p.missing.map(k=>esc(M.SLOT_NAMES[k])).join(', ')}${p.half?' <span class="half">· 2-piece perk on</span>':` <span class="muted">· ${2-p.count} more for the 2-piece perk</span>`}${misfit}</div>${second}`}).join('');
  }
  // Equipped gear as a list: one row per slot with the full stats, so it can be compared with new pieces.
  function statLine(c,p){const [mk,mv]=M.MAIN[p.slot],w=M.ROSTER[c.id].wants;
    return [[mk,mv],...(p.subs||[]).map(x=>[x.stat,x.v])].map(([k,v])=>`<span class="${w.includes(k)?'want':''}">${esc(M.fmtStat(k,v))}</span>`).join(' · ')}
  function rigHtml(c){
    const sel=ui.sel&&s.hold.find(p=>p.uid===ui.sel),cmp=sel?M.compareFor(s,sel).find(x=>x.crew===c.id):null;
    return c.rigs.map((r,ri)=>`<div class="gear">${M.SLOTS.map(k=>{const p=r[k],target=sel&&sel.slot===k;
      const v=target?cmp.verdict:null,cls=`gearrow ${p?'set-'+p.set:'empty'} ${target?'target '+(v==='upgrade'?'advance':v==='downgrade'?'worse':''):''}`;
      const head=`<span class="gtop"><b class="gslot">${esc(M.SLOT_NAMES[k])}</b>${p?`<span class="gset"><span class="swatch"></span>${esc(SETNAME(p.set))}</span>${qbadge(p)}`:'<span class="muted">empty</span>'}${target?`<span class="gverdict">${v==='upgrade'?'Upgrade — put it here':v==='downgrade'?'Downgrade':'About the same'}</span>`:''}</span>`;
      const body=p?`<span class="gstats">${statLine(c,p)}</span>`:'';
      if(target)return `<button class="${cls}" data-put="${c.id}|${ri}" aria-label="Equip ${esc(pieceName(sel))} on ${esc(first(c.id))}'s ${esc(M.SLOT_NAMES[k])}${p?', replacing '+esc(pieceName(p)):''}">${head}${body}</button>`;
      return `<div class="${cls}">${head}${body}${p&&!sel?`<button class="x" data-off="${c.id}|${ri}|${k}" aria-label="Unequip ${esc(pieceName(p))} from ${esc(first(c.id))}">Remove</button>`:''}</div>`}).join('')}</div>`).join('');
  }
  function wireRigs(root){
    root.querySelectorAll('[data-put]').forEach(b=>b.onclick=()=>{const [crew,rig]=b.dataset.put.split('|'),p=s.hold.find(x=>x.uid===ui.sel);ui.sel=null;
      if(act({type:'equip',uid:p.uid,crew,rig:+rig}))message(pieceName(p)+' equipped on '+first(crew)+'.')});
    root.querySelectorAll('[data-off]').forEach(b=>b.onclick=()=>{const [crew,rig,slot]=b.dataset.off.split('|');act({type:'unequip',crew,rig:+rig,slot},'Moved to the hold.')});
  }

  // ---------------------------------------------------------------- departure
  function departure(){
    $('screen').innerHTML=`<section class="panel"><p class="eyebrow">Node 1 · Departure</p><h1>Read the Brief, then pick two crew.</h1>
      <div class="row" style="margin:6px 0 12px"><span class="small"><b>How many affixes?</b> You pick the count; the voyage picks which.</span><span class="countpick">${[0,1,2,3,4].map(k=>`<button data-count="${k}" class="${k===s.brief.affixes.length?'primary':''}" aria-pressed="${k===s.brief.affixes.length}" style="min-width:44px">${k}</button>`).join('')}</span><button id="reroll">Reroll the Brief</button></div>
      ${briefHtml()}<p class="muted small" style="margin-top:10px">Every team runs on one shared Aether pool. The Weavers bend it; the four families each bring their own engine — Break, Blight (poison), Hull (returned damage) and Drive (follow-ups). Starters can come from different families.</p></section>
      <section class="panel"><p class="eyebrow">Choose two starters · free</p>${byFamily(M.IDS).map(([f,list])=>familyHead(f)+`<div class="cards">${list.map(id=>`<button class="card ${ui.picked.includes(id)?'picked':''}" data-pick="${id}" aria-pressed="${ui.picked.includes(id)}">${crewCard(id)}</button>`).join('')}</div>`).join('')}</section>
      <section class="panel">${planHtml()}</section>
      <details class="panel"><summary>Voyage settings — seed</summary><form id="setup" class="row" style="margin-top:8px"><label>Seed<input id="seed" type="number" min="1" max="4294967295" value="${s.seed}"></label><button type="submit">Use this seed</button></form></details>`;
    const keepPicks=fn=>{const keep=ui.picked;fn();ui.picked=keep;render()};
    $('setup').onsubmit=e=>{e.preventDefault();keepPicks(()=>fresh(+$('seed').value||41,s.brief.affixes.length));message('New voyage rolled.')};
    $('screen').querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>keepPicks(()=>fresh(s.seed,+b.dataset.count)));
    $('reroll').onclick=()=>keepPicks(()=>fresh(s.seed+1,s.brief.affixes.length));
    $('screen').querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const id=b.dataset.pick;ui.picked=ui.picked.includes(id)?ui.picked.filter(x=>x!==id):ui.picked.length<2?[...ui.picked,id]:[ui.picked[1],id];render()});
    wireNotes($('screen'));
    const names=ui.picked.map(first).join(' and ');
    bar(ui.picked.length===2?'Depart with '+names:'Pick two starters',()=>{if(act({type:'starters',ids:ui.picked},'Departed. Prepare for the first battle.'))ui.picked=[]},{disabled:ui.picked.length!==2,hint:ui.picked.length===2?'Starters are free.':ui.picked.length+' of 2 picked'});
  }

  // ---------------------------------------------------------------- prepare
  function nodeHeader(){
    const t=M.nodeType(s),sector=M.sectorOf(s.node);
    if(t==='rest')return `<p class="eyebrow">Node ${s.node} · Sector ${sector}</p><h2>Modifier stop</h2><p class="muted small">The Brief's affixes hold for the whole voyage, so there's nothing to choose here. A good moment to shop and re-equip.</p>`;
    if(t==='reward')return `<p class="eyebrow">Node ${s.node} · Sector ${sector}</p><h2>Reward — choose one</h2>`;
    const enc=M.encounter(s,s.node),aff=s.brief.affixes.map(id=>M.AFFIXES[id].name).join(' · ')||'no affixes';
    return `<div class="next"><div><p class="eyebrow">Next · node ${s.node} · sector ${sector}</p><h2>${t==='boss'?esc(M.BOSSES[enc.boss].name):esc(M.NODE_NAMES[t])+' battle'}</h2></div><span class="small muted">${t==='supply'?'No deadline · weak enemies · full Gold and a drop, win or lose':enc.rounds+'-round deadline'} · ${esc(aff)}</span></div>
      <p class="small">${enc.waves.map((w,i)=>`<b>Wave ${i+1}</b> ${w.map(e=>esc(e.name)+' <span class="layers">'+'◆'.repeat(e.layers)+'</span>').join(', ')}`).join(' · ')}<br><span class="muted">◆ = shield layers. Shielded specimens take 40% damage; knock off the last layer to Break them.</span>${t==='boss'?'<br><span class="muted">'+esc(M.BOSSES[enc.boss].text)+'</span>':''}</p>`;
  }
  function rewardPanel(){
    const pieceOpts=M.PIECES.map(p=>{const adv=M.pieceAdvances(s,p).find(a=>a.completes);return `<option value="${p.set}:${p.slot}">${esc(pieceName(p))}${adv?' — completes '+esc(first(adv.crew))+"'s set":''}</option>`}).join('');
    return `<div class="choices">
      <button class="choice" data-choose="voucher" aria-pressed="${ui.reward==='voucher'}"><b>Free voucher</b><span class="small muted">Recruit anyone without spending Writs.</span></button>
      <div class="choice" aria-pressed="${ui.reward==='craft'}"><button data-choose="craft" class="${ui.reward==='craft'?'primary':''}" style="min-width:0">Crafted piece</button><select id="rwPiece" aria-label="Piece to craft">${pieceOpts}</select></div>
      <div class="choice" aria-pressed="${ui.reward==='packs'}"><button data-choose="packs" class="${ui.reward==='packs'?'primary':''}" style="min-width:0">${M.ECON.rewardPacks} equipment packs · ${M.ECON.rewardPacks*M.ECON.packSize} pieces</button><select id="rwPack" aria-label="Which packs">${M.PACK_KINDS.map(k=>`<option value="${k.id}" ${ui.rewardPack===k.id?'selected':''}>${esc(k.name)}</option>`).join('')}</select></div>
    </div>`;
  }
  function prepare(){
    const t=M.nodeType(s),holdN=s.hold.length,price=s.freeVoucher?0:M.voucherPrice(s),canBuy=s.crew.length<M.IDS.length&&(s.freeVoucher||s.writs>=price);
    const tabs=[['crew','Crew',''],['recruit','Recruit',canBuy?'<span class="badge">✓</span>':''],['equipment','Equipment',holdN?`<span class="badge">${holdN}</span>`:'']];
    $('screen').innerHTML=`<section class="panel">${nodeHeader()}${t==='reward'?rewardPanel():''}</section>${cacheTray()}
      <section class="panel"><div class="tabs" role="tablist">${tabs.map(([k,l,b])=>`<button class="tab" role="tab" aria-selected="${ui.tab===k}" data-tab="${k}">${l}${b}</button>`).join('')}</div><div id="tabBody" style="margin-top:12px"></div></section>`;
    $('screen').querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ui.tab=b.dataset.tab;ui.release=null;render()});
    if(t==='reward'){
      if($('rwPiece'))$('rwPiece').value=ui.rewardPiece;
      $('rwPiece').onchange=e=>{ui.rewardPiece=e.target.value;ui.reward='craft';render()};
      $('rwPack').onchange=e=>{ui.rewardPack=e.target.value;ui.reward='packs';render()};
      $('screen').querySelectorAll('[data-choose]').forEach(b=>b.onclick=()=>{ui.reward=b.dataset.choose;render()});
    }
    ({crew:crewTab,recruit:recruitTab,equipment:equipmentTab})[ui.tab]($('tabBody'));
    wireCaches();
    // The one next step.
    if(t==='rest')bar('Continue to node '+(s.node+1),()=>act({type:'pass'}),{hint:'Nothing to choose here.'});
    else if(t==='reward'){
      const label={voucher:'Take the free voucher',craft:'Take '+(ui.rewardPiece?pieceName({set:ui.rewardPiece.split(':')[0],slot:ui.rewardPiece.split(':')[1]}):'the piece'),packs:'Open '+M.ECON.rewardPacks+' packs'}[ui.reward];
      bar(label||'Choose a reward',()=>{const ok=ui.reward==='voucher'?act({type:'reward',choice:'voucher'},'Free voucher banked — spend it in Recruit.'):ui.reward==='craft'?act({type:'reward',choice:'craft',set:ui.rewardPiece.split(':')[0],slot:ui.rewardPiece.split(':')[1]},'Piece added to the hold.'):act({type:'reward',choice:'packs',kind:ui.rewardPack||M.PACK_KINDS[0].id},'Packs opened — see what you got in Equipment.');
        if(ok){if(ui.reward==='voucher')ui.tab='recruit';if(ui.reward==='craft'||ui.reward==='packs')ui.tab='equipment';ui.reward=null;render()}},{disabled:!ui.reward,hint:'Pick one of the three.'});
    }else{
      const hint=holdN?`${holdN} piece${holdN>1?'s':''} in the hold.`:canBuy?'You can afford a recruit.':'Ready when you are.';
      bar('Launch '+(t==='boss'?'boss fight':M.NODE_NAMES[t].toLowerCase()+' battle'),()=>{ui.sel=null;ui.opened=null;if(act({type:'launch'})){ui.screen='fight';render()}},{hint});
    }
  }
  // ---------------------------------------------------------------- caches
  // Unopened caches wait in a tray on the Prepare screen. Tap one to open it, or press and drag across several to open
  // them together (like Currency Wars' crystals). "Open all" does the same for every cache.
  const cacheIcon=c=>`<button class="cache t${c.tier}" data-cache="${c.id}" aria-label="${esc(M.CACHE.names[c.tier])} from ${esc(c.from)}, node ${c.node}. Open" title="${esc(M.CACHE.names[c.tier])} · from ${esc(c.from)} (node ${c.node})"><span class="gem" aria-hidden="true"></span><span class="tl">${['','I','II','III'][c.tier]}</span></button>`;
  // One page-wide release, so a sweep that ends outside the tray still opens what it crossed.
  let sweep=null;
  window.addEventListener('pointerup',()=>{if(!sweep)return;const ids=[...sweep];sweep=null;openCaches(ids)});
  function cacheTray(){
    const caches=s.caches||[],shown=ui.opened||[];if(!caches.length&&!shown.length)return '';
    const reveal=shown.length?`<ul class="reveal" aria-live="polite">${shown.map(o=>`<li class="t${o.tier}"><span class="tl">${['','I','II','III'][o.tier]}</span>${esc(o.text)}</li>`).join('')}</ul>`:'';
    return `<section class="panel caches"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Caches${caches.length?' · '+caches.length+' unopened':''}</h3>${caches.length>1?'<button id="openAll" class="ghost">Open all</button>':''}</div>
      ${caches.length?`<p class="small muted">Tap a cache to open it, or press and drag across several to open them together.</p><div class="tray" id="cacheTray">${caches.map(cacheIcon).join('')}</div>`:''}${reveal}</section>`;
  }
  function openCaches(ids){
    if(!ids.length)return;const els=ids.map(id=>document.querySelector(`[data-cache="${id}"]`)).filter(Boolean);els.forEach(el=>el.classList.add('opening'));
    const go=()=>{const before=s.caches.length;if(act({type:'openCache',ids})){ui.opened=s.lastOpened;if(s.lastOpened.some(o=>o.pieces))ui.tab='equipment';
      message('Opened '+(before-s.caches.length)+' cache'+(before-s.caches.length>1?'s':'')+'.');render()}};
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)go();else setTimeout(go,320);
  }
  function wireCaches(){
    const tray=$('cacheTray');if($('openAll'))$('openAll').onclick=()=>openCaches(s.caches.map(c=>c.id));if(!tray)return;
    // Press, sweep, release: every cache the pointer crosses is armed, then all open together. A plain tap opens one.
    const arm=(x,y)=>{const el=document.elementFromPoint(x,y),c=el&&el.closest('[data-cache]');if(c&&sweep&&!sweep.has(+c.dataset.cache)){sweep.add(+c.dataset.cache);c.classList.add('armed')}};
    tray.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-cache]'))return;e.preventDefault();sweep=new Set();arm(e.clientX,e.clientY)});
    tray.addEventListener('pointermove',e=>{if(sweep)arm(e.clientX,e.clientY)});
    tray.addEventListener('pointercancel',()=>{sweep=null;tray.querySelectorAll('.armed').forEach(x=>x.classList.remove('armed'))});
    // Keyboard: Enter or Space on a focused cache opens it.
    tray.querySelectorAll('[data-cache]').forEach(b=>b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openCaches([+b.dataset.cache])}}));
  }
  // Stars: current rank, what the next one gives, and the promote button.
  function starLine(c){
    const st=c.star||1,max=M.STARS.max,next=st+1,cost=M.STARS.cost[next],can=st<max&&(s.insight||0)>=cost;
    const gain=st<max?`next: ×${M.STARS.hp[next-1]} health and defense, ×${M.STARS.atk[next-1]} attack${next===3?', and the ★3 kit upgrade':''}`:'fully promoted';
    return `<div class="stars"><span class="starrank" aria-label="${st} of ${max} stars">${'★'.repeat(st)}<span class="muted">${'☆'.repeat(max-st)}</span></span><span class="small muted">${esc(gain)}</span>
      ${st<max?`<button data-promote="${c.id}" class="${can?'primary':''}" style="min-width:0" ${can?'':'disabled'}>Promote · ${cost} Insight</button>`:''}</div>`;
  }
  function crewTab(el){
    const ip=M.insightPrice(s);
    el.innerHTML=`<div class="fund"><div><b>Insight · ${s.insight||0}</b> <span class="small muted">— promotes crew. Elites give 1, bosses 2, some caches 1–2; or buy it with Gold (the price rises each time).</span></div>
        <div class="row" style="flex:0 0 auto"><button id="buyInsight" ${s.gold<ip?'disabled':''}>Buy 1 · ${ip} Gold</button></div></div>
      <p class="small"><b>Budget:</b> ${esc(M.budgetWords(s))}</p><div class="crewlist">${s.crew.map(c=>`<article class="member">
      ${crewCard(c.id)}${starLine(c)}${progressLine(c)}${rigHtml(c)}
      <div class="row">${s.crew.length>1?`<button data-release="${c.id}" class="small">${ui.release===c.id?'Tap again to release '+esc(first(c.id))+' for '+writs(M.releaseRefund(s)):'Release · +'+writs(M.releaseRefund(s))}</button>`:''}</div></article>`).join('')}</div>
      <div class="row" style="margin-top:12px"><label>Who gets first claim on the pool?<select id="priority"><option value="auto">Auto — Arunima, then Silen</option>${s.crew.map(c=>`<option value="${c.id}">Save for ${esc(M.ROSTER[c.id].name)}</option>`).join('')}</select></label></div>`;
    $('buyInsight').onclick=()=>act({type:'buyInsight'},'Bought 1 Insight.');
    el.querySelectorAll('[data-promote]').forEach(b=>b.onclick=()=>{const id=b.dataset.promote;if(act({type:'promote',id})){const st=(s.crew.find(c=>c.id===id)||{}).star||1;message(first(id)+' is now ★'+st+(st===3?' — kit upgraded: '+M.ROSTER[id].up3:'')+'.')}});
    $('priority').value=s.priority;$('priority').onchange=e=>act({type:'priority',name:e.target.value},'Spending priority set.');
    el.querySelectorAll('[data-release]').forEach(b=>b.onclick=()=>{const id=b.dataset.release;if(ui.release!==id){ui.release=id;render();return}ui.release=null;const refund=M.releaseRefund(s);act({type:'release',id},first(id)+' released for '+writs(refund)+'; their equipment is in the hold.')});
    wireRigs(el);
  }
  function recruitTab(el){
    const price=s.freeVoucher?0:M.voucherPrice(s);
    const status=s.freeVoucher?'<b>Free voucher</b> ready — your next recruit costs nothing.':`Next recruit costs <b>${price} Writs</b> (you have ${s.writs}). No team-size cap — the price rises with every recruit. Changed your mind? Releasing someone in Crew refunds enough that a swap costs just 1 Writ.`;
    const ids=M.IDS.filter(id=>!s.crew.some(c=>c.id===id));
    const fund=s.writFund||0;
    el.innerHTML=`<div class="fund"><div><b>Writ fund</b> <span class="small muted">— put Gold in a little at a time; every ${M.ECON.writCost} Gold becomes a Writ.</span>
        <div class="fundbar" role="progressbar" aria-valuemin="0" aria-valuemax="${M.ECON.writCost}" aria-valuenow="${fund}"><i style="width:${fund/M.ECON.writCost*100}%"></i></div><span class="small">${fund} / ${M.ECON.writCost} Gold toward the next Writ · you have ${s.gold} Gold</span></div>
        <div class="row" style="flex:0 0 auto">${[1,5].map(n=>`<button data-invest="${n}" ${s.gold<n?'disabled':''}>+${n}</button>`).join('')}<button data-invest="all" ${s.gold<1?'disabled':''}>All</button></div></div>
      <p class="small">${status}</p>${byFamily(ids).map(([f,list])=>familyHead(f)+`<div class="cards">${list.map(id=>{const can=s.freeVoucher||s.writs>=price;
      return `<div class="card">${crewCard(id,{button:`<button data-buy="${id}" ${can?'class="primary" style="min-width:0"':'disabled'}>${s.freeVoucher?'Recruit · free':'Recruit · '+price+' Writs'}</button>`})}</div>`}).join('')}</div>`).join('')||'<p class="muted">Everyone is aboard.</p>'}`;
    el.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>act({type:'voucher',id:b.dataset.buy},M.ROSTER[b.dataset.buy].name+' is aboard.'));
    el.querySelectorAll('[data-invest]').forEach(b=>b.onclick=()=>{const w=s.writs;if(act({type:'invest',amount:b.dataset.invest==='all'?'all':+b.dataset.invest}))message(s.writs>w?'The fund paid out '+(s.writs-w)+(s.writs-w>1?' Writs.':' Writ.'):'Added to the Writ fund.')});
  }
  function equipmentTab(el){
    const sel=ui.sel&&s.hold.find(p=>p.uid===ui.sel);if(ui.sel&&!sel)ui.sel=null;
    const fresh=new Set(s.lastPack||[]),opened=s.hold.filter(p=>fresh.has(p.uid));
    const order=M.SET_IDS;const sorted=s.hold.slice().sort((a,b)=>order.indexOf(a.set)-order.indexOf(b.set)||M.quality(b)-M.quality(a));
    const holdHtml=sorted.map(p=>`<div class="piecewrap">${pieceCard(p,`data-sel="${p.uid}" aria-pressed="${ui.sel===p.uid}"`,fresh.has(p.uid)?'<span class="new">NEW</span>':'')}<button class="qscrap" data-qscrap="${p.uid}" aria-label="Scrap ${esc(pieceName(p))} for ${M.ECON.scrap} Gold">Scrap · +${M.ECON.scrap}</button></div>`).join('')||'<p class="muted small">The hold is empty. Open a pack, or pick a piece after each battle.</p>';
    const cut=ui.scrapCut||.5,below=s.hold.filter(p=>M.quality(p)<cut).length;
    const craftOpts=M.PIECES.map(p=>{const adv=M.pieceAdvances(s,p).find(a=>a.completes||a.unlocks);return `<option value="${p.set}:${p.slot}">${esc(pieceName(p))}${adv?' — '+(adv.completes?'completes ':'unlocks 2-piece for ')+esc(first(adv.crew)):''}</option>`}).join('');
    const useless=s.hold.filter(p=>!M.bestUse(s,p)).length,upgrades=s.hold.length-useless;
    el.innerHTML=`<section class="packs"><div><h3>Equipment packs</h3><p class="small muted">${M.ECON.pack} Gold each · ${M.ECON.packSize} pieces from the two sets on the label, random slots and substats, at this sector's tiers. Faces show who those sets suit.</p></div>
        <div class="packgrid">${M.PACK_KINDS.map(K=>`<div class="pack"><div class="ptitle">${K.sets.map(id=>`<span class="set-${id}"><span class="swatch"></span>${esc(SETNAME(id))}</span>`).join('<span class="muted"> & </span>')}</div>${facesFor([...new Set(K.sets.flatMap(id=>M.SETS[id].bestOn))],'tiny')}<button data-pack="${K.id}" ${s.gold<M.ECON.pack?'disabled':''}>Open · ${M.ECON.pack} Gold</button></div>`).join('')}</div></section>
      ${opened.length?`<p class="small"><b>Just opened:</b> ${opened.length} piece${opened.length>1?'s':''}, marked NEW below.</p>`:''}
      <details ${ui.legendClosed?'':'open'} id="legend" style="margin-top:10px"><summary><b>Set perks</b> <span class="small muted">— 2 pieces turn on the first perk (two sets can be on at once), all 5 the full perk; faces show who a set suits</span></summary>${setsLegend()}</details>
      <h3 style="margin-top:14px">Hold <span class="muted small">(${s.hold.length})</span></h3>
      <div class="scrapbar"><button id="quickEquip" class="${upgrades?'primary':''}" style="min-width:0" ${upgrades?'':'disabled'} title="Put every upgrade in the hold on the crewmate it suits best">Quick equip${upgrades?' · '+upgrades+' upgrade'+(upgrades>1?'s':''):''}</button>
        <button id="scrapUseless" class="${useless?'primary':''}" style="min-width:0" ${useless?'':'disabled'}>Scrap ${useless} non-upgrade${useless===1?'':'s'} · +${useless*M.ECON.scrap} Gold</button>
        <span class="row" style="flex:0 1 auto;gap:6px"><select id="cut" aria-label="Quality threshold">${[.3,.5,.7].map(v=>`<option value="${v}" ${v===cut?'selected':''}>below ${v*100}%</option>`).join('')}</select><button id="scrapBelow" ${below?'':'disabled'}>Scrap ${below} · +${below*M.ECON.scrap} Gold</button></span>
        <label class="toggle"><input type="checkbox" id="autoScrap" ${s.prefs&&s.prefs.autoScrap?'checked':''}> Auto-scrap non-upgrades from packs</label></div>
      <p class="small muted">Tap a piece to compare it with what your crew wears now.</p>${sel?comparePanel(sel):''}<div class="hold" style="margin-top:10px">${holdHtml}</div>
      <h3 style="margin-top:16px">Crew</h3><div class="crewlist">${s.crew.map(c=>`<article class="member"><b>${esc(M.ROSTER[c.id].name)}</b><span class="labels">${scaleTags(M.ROSTER[c.id])}</span><span class="wants">Wants: ${M.ROSTER[c.id].wants.map(k=>esc(M.STATS[k].name)).join(', ')}</span>${progressLine(c)}${rigHtml(c)}</article>`).join('')}</div>
      <details style="margin-top:14px"><summary><b>Workshop</b> — craft a chosen piece</summary><div class="row" style="margin-top:8px">
        <label>Craft a chosen piece (random substats)<select id="craftPiece">${craftOpts}</select></label><button id="craft" ${s.gold<M.ECON.craft?'disabled':''}>Craft · ${M.ECON.craft} Gold</button></div></details>`;
    $('legend').ontoggle=e=>{ui.legendClosed=!e.target.open};
    el.querySelectorAll('[data-pack]').forEach(b=>b.onclick=()=>{const K=M.PACK_KINDS.find(k=>k.id===b.dataset.pack);
      if(M.act(s,{type:'pack',kind:K.id})){message('Not enough Gold.');return}
      let text='Opened a '+K.name+' pack: '+M.ECON.packSize+' pieces, marked NEW.';
      if(s.prefs&&s.prefs.autoScrap){const gone=s.hold.filter(p=>(s.lastPack||[]).includes(p.uid)&&!M.bestUse(s,p));gone.forEach(p=>M.act(s,{type:'scrap',uid:p.uid}));
        text='Opened a '+K.name+' pack: kept '+(M.ECON.packSize-gone.length)+', scrapped '+gone.length+' · +'+gone.length*M.ECON.scrap+' Gold.'}
      save();message(text);render()});
    $('autoScrap').onchange=e=>{s.prefs=Object.assign({},s.prefs,{autoScrap:e.target.checked});save()};
    el.querySelectorAll('[data-qscrap]').forEach(b=>b.onclick=()=>{const u=+b.dataset.qscrap,p=s.hold.find(x=>x.uid===u);if(ui.sel===u)ui.sel=null;act({type:'scrap',uid:u},'Scrapped '+pieceName(p)+' · +'+M.ECON.scrap+' Gold.')});
    $('scrapUseless').onclick=()=>{const gone=s.hold.filter(p=>!M.bestUse(s,p));gone.forEach(p=>M.act(s,{type:'scrap',uid:p.uid}));save();message('Scrapped '+gone.length+' pieces that were no upgrade for anyone, for '+gone.length*M.ECON.scrap+' Gold.');render()};
    $('quickEquip').onclick=()=>{ui.sel=null;if(act({type:'quickEquip'})){const n=s.lastQuick.length;message('Quick equip: '+n+' piece'+(n>1?'s':'')+' — '+s.lastQuick.map(x=>pieceName(x)+' on '+first(x.crew)).join(', ')+'.');render()}};
    $('cut').onchange=e=>{ui.scrapCut=+e.target.value;render()};
    $('scrapBelow').onclick=()=>{const n=s.hold.filter(p=>M.quality(p)<cut).length;act({type:'scrapBelow',quality:cut},'Scrapped '+n+' pieces for '+n*M.ECON.scrap+' Gold.')};
    el.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>{const u=+b.dataset.sel;ui.sel=ui.sel===u?null:u;render();const c=document.querySelector('.compare');if(c)c.scrollIntoView({block:'nearest',behavior:'smooth'})});
    if(sel){$('scrapSel').onclick=()=>{ui.sel=null;act({type:'scrap',uid:sel.uid},'Scrapped for '+M.ECON.scrap+' Gold.')};$('cancelSel').onclick=()=>{ui.sel=null;render()}}
    $('craft').onclick=()=>{const [set,slot]=$('craftPiece').value.split(':');act({type:'craft',set,slot},'Crafted '+pieceName({set,slot})+'.')};
    wireRigs(el);
  }

  // ---------------------------------------------------------------- fight
  function stopReplay(){if(replay&&replay.timer)clearTimeout(replay.timer);replay=null}
  function fightScreen(){
    const f=lastFight,rec=s.fights.find(x=>x.node===f.node);
    if(!replay||replay.f!==f){stopReplay();replay={i:0,timer:null,playing:true,done:false,f,rec}}
    $('screen').innerHTML=`<section class="panel"><p class="eyebrow">Node ${f.node} · ${esc(M.NODE_NAMES[f.encounter.type])} · ${esc((f.encounter.affixes||[]).map(id=>M.AFFIXES[id].name).join(' · ')||'no affixes')}</p>
      <div class="stage"><div id="vEnemies" class="side" aria-label="Specimens"></div>
      <div class="meter" aria-label="Shared Aether"><span class="meter-label" id="vPoolLabel"></span><span id="vPool" class="meter"></span></div>
      <div id="vCrew" class="side" aria-label="Crew"></div><div id="vCallout" class="callout" role="status" aria-live="polite"></div>
      <div class="row"><button id="vPlay">${replay.playing&&!replay.done?'Pause':'Play'}</button><label style="flex:0 1 140px">Speed<select id="vSpeed"><option value="900">1×</option><option value="450" selected>2×</option><option value="180">5×</option></select></label><button id="vSkip" ${replay.done?'disabled':''}>Skip to the end</button><span class="small muted" id="vStep"></span></div>
      <div id="vFeed" class="feed"></div></div></section>`;
    $('vPlay').onclick=()=>{
      if(replay.done){replay={i:0,timer:null,playing:true,done:false,f,rec};render();return}
      replay.playing=!replay.playing;$('vPlay').textContent=replay.playing?'Pause':'Play';if(replay.playing)tick();else stopTimer()};
    $('vSkip').onclick=()=>{stopTimer();replay.i=f.events.length-1;draw(f.events[replay.i],true);finish()};
    if(replay.i>0)draw(f.events[Math.min(replay.i,f.events.length)-1],true);
    if(replay.done)finish();
    bar(replay.done?'See the result':'Skip to the result',()=>{stopTimer();ui.screen='result';render()},{hint:replay.done?'The fight is over.':'Watching the pool fill and empty.'});
    if(replay.playing&&!replay.done&&!replay.timer)tick();
  }
  function stopTimer(){if(replay&&replay.timer){clearTimeout(replay.timer);replay.timer=null}}
  function draw(e,fast){
    const f=replay.f;
    $('vEnemies').innerHTML=e.snap.enemies.map(([n,hp,max,alive,marks,layers,broken,maxL,cache,poison])=>`<div class="unit enemy ${alive?'':'down'} ${broken?'broken':''}"><div class="nm">${cache?`<span class="carry t${cache}" title="Carries a ${esc(M.CACHE.names[cache])}"></span>`:''}${esc(n)}${poison?` <span class="psn" title="${poison} poison: ticks at the start of its turn, through shields">☣${poison}</span>`:''}${marks?' <span class="marks" title="Marks">'+'•'.repeat(marks)+'</span>':''}</div><div class="shields">${broken?'<b class="brk">BROKEN</b>':'<span class="layers" title="Shield layers">'+'◆'.repeat(layers||0)+'<span class="lost">'+'◇'.repeat(Math.max(0,(maxL||0)-(layers||0)))+'</span></span>'}</div><div class="bar"><i style="width:${Math.max(0,hp/max*100)}%"></i></div><div class="small muted">${hp} / ${max}</div></div>`).join('');
    $('vCrew').innerHTML=e.snap.crew.map(([hp,max,barrier,alive,ult],i)=>{const id=f.crewOrder[i];return `<div class="unit ${alive?'':'down'} ${e.actor===id?'acting':''}"><div class="nm">${esc(first(id))}</div><div class="bar"><i style="width:${Math.max(0,hp/max*100)}%"></i></div>${barrier>0?`<div class="bar barrier"><i style="width:${Math.min(100,barrier/max*100)}%"></i></div>`:''}<div class="bar ult" title="Ultimate charge"><i style="width:${ult}%"></i></div><div class="small muted">${Math.round(hp)} hp${barrier>0?' · '+barrier+' barrier':''}</div></div>`}).join('');
    const [cur,max]=e.pool;$('vPoolLabel').textContent=`Aether ${cur} / ${max}`;
    let pips='';for(let i=0;i<Math.max(0,-cur);i++)pips+='<span class="pip debt" title="Overdraw debt"></span>';for(let i=0;i<max;i++)pips+=`<span class="pip ${i<cur?'on':''}"></span>`;$('vPool').innerHTML=pips;
    const c=$('vCallout');c.className='callout '+e.kind;c.textContent=e.text;
    $('vStep').textContent=f.encounter.type==='supply'?`round ${Math.floor(e.t/100)+1}`:`round ${Math.floor(e.t/100)+1} of ${f.encounter.rounds}`;
    if(!fast){const d=document.createElement('div');d.className=e.kind;d.textContent=e.text;$('vFeed').prepend(d)}
  }
  function tick(){
    if(!replay||!replay.playing||screen()!=='fight')return;const f=replay.f;
    if(replay.i>=f.events.length){finish();return}
    draw(f.events[replay.i]);replay.i++;
    if(replay.i>=f.events.length){finish();return}
    replay.timer=setTimeout(()=>{replay.timer=null;tick()},+$('vSpeed').value);
  }
  function finish(){
    if(!replay)return;const wasDone=replay.done;replay.done=true;replay.playing=false;stopTimer();
    $('vFeed').innerHTML=replay.f.events.slice().reverse().map(e=>`<div class="${e.kind}">${esc(e.text)}</div>`).join('');
    $('vPlay').textContent='Watch again';$('vSkip').disabled=true;
    if(!wasDone)bar('See the result',()=>{ui.screen='result';render()},{hint:'The fight is over.'});
  }

  // ---------------------------------------------------------------- result
  // A few plain sentences about why the fight went the way it did, from data the model already logs.
  function explain(r,f){
    const m=r.metrics,out=[],spenders=r.crew.map(c=>c.id).filter(id=>id==='Arunima'||id==='Silen');
    if(f&&f.node===r.node){
      const sDown=f.events.find(e=>e.kind==='down'&&spenders.includes(e.actor));
      const before=sDown?f.events.slice(0,f.events.indexOf(sDown)):[];
      if(sDown)out.push(`${first(sDown.actor)} went down at round ${Math.floor(sDown.t/100)+1} holding ${sDown.pool[0]} of ${sDown.pool[1]} Aether${sDown.actor==='Arunima'&&!before.some(e=>e.kind==='burst')?' — before firing a single burst'+(before.some(e=>e.kind==='basic'&&/saving for Arunima|building full burst/.test(e.text))?'. The team had been saving it for her':''):''}.`);
      else{const d=f.events.find(e=>e.kind==='down');if(d)out.push(`${first(d.actor)} fell first, at round ${Math.floor(d.t/100)+1}.`)}
    }
    if(r.outcome==='wiped')out.push('The whole crew went down before the deadline.');
    else if(r.outcome==='time')out.push(`The deadline arrived with ${100-Math.round(r.score*100)}% of the specimens still standing.`);
    else out.push(`Every specimen recovered in ${m.rounds} rounds.`);
    if(m.bursts)out.push(`Arunima burst ${m.bursts} time${m.bursts>1?'s':''}; the biggest spent ${m.peakBurst} charges.`);
    else if(spenders.includes('Arunima'))out.push('Arunima never burst.');
    if(m.breaks)out.push(`${m.breaks} shield${m.breaks>1?'s':''} broken.`);
    if(m.chains)out.push(`Silen chained ${m.chains} time${m.chains>1?'s':''}, longest ${m.longestChain} turns.`);
    const tr=m.aetherTrace||[],full=tr.length?tr.filter(v=>v>=r.capacity).length/tr.length:0;
    if(full>=.3)out.push(`The pool sat full for ${Math.round(full*100)}% of turns and ${m.wasted} Aether was wasted at the cap — nothing was spending it.`);
    else if(m.wasted>=5)out.push(`${m.wasted} Aether was wasted at the cap.`);
    if(m.converted)out.push(`Wellspring turned ${m.converted} surplus Aether into barrier.`);
    if(m.debt)out.push(`Overdraw borrowed ${m.debt} Aether ahead of time.`);
    return out;
  }
  function result(){
    const r=s.fights.at(-1),m=r.metrics,f=lastFight&&lastFight.node===r.node?lastFight:null;
    const pd=s.pendingDrop&&s.pendingDrop.node===r.node?s.pendingDrop:null;
    const offerHtml=(o,i)=>pieceCard(o,`data-take="${i}"`);
    const dropHtml=pd?`<h3>Choose one piece</h3><div class="hold">${pd.offers.map(offerHtml).join('')}</div>`
      :r.took?`<h3>Drop</h3><p class="set-${r.took.set}"><span class="swatch"></span>Took <b>${esc(pieceName(r.took))}</b> — it's in the hold.</p>`:'';
    $('screen').innerHTML=`<section class="panel"><p class="eyebrow">Node ${r.node} · ${esc(M.NODE_NAMES[r.type])}</p><div class="band">${esc(r.band)}</div><p>${Math.round(r.score*100)}% recovered · ${r.integrity>0?'+':''}${r.integrity} integrity · +${r.gold} Gold${r.writs?' · +'+r.writs+' Writs':''}${r.insight?' · +'+r.insight+' Insight':''}${(r.caches||[]).length?' · '+r.caches.length+' cache'+(r.caches.length>1?'s':'')+' recovered'+(s.ended?' (unopened — the voyage has ended)':' (open them in Prepare)'):''}</p>
      <h3>Why</h3><ul class="why">${explain(r,f).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
      ${(r.reports||[]).length?`<h3>Affixes</h3><ul class="why">${r.reports.map(x=>`<li><b>${esc(x.name)}:</b> ${esc(x.text)}</li>`).join('')}</ul>`:''}
      ${dropHtml}
      <details><summary>Numbers</summary><div class="metrics"><div><b>${m.bursts}</b>bursts</div><div><b>${m.chains}</b>Silen chains</div><div><b>${m.peakBurst}</b>peak burst</div><div><b>${m.generated}</b>Aether generated</div><div><b>${m.wasted}</b>wasted at cap</div><div><b>${m.converted}</b>converted</div><div><b>${m.debt}</b>debt taken</div><div><b>${m.ults}</b>ultimates</div><div><b>${m.deaths}</b>crew down</div></div></details></section>`;
    $('screen').querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>{const o=pd.offers[+b.dataset.take];act({type:'takeDrop',index:+b.dataset.take},'Took '+pieceName(o)+'.')});
    const next=()=>{ui.screen=null;ui.opened=null;if(s.hold.length)ui.tab='equipment';render()};
    if(pd){bar('Choose a piece first',()=>{},{disabled:true,hint:'Pick one of the three pieces.'});return}
    if(s.ended)bar('See the voyage summary',()=>{ui.screen=null;render()},{hint:esc(s.endReason)});
    else{const adv=r.took&&s.hold.length?M.pieceAdvances(s,s.hold[s.hold.length-1]).find(a=>a.completes):null;
      bar('Prepare for node '+s.node,next,{hint:adv?'Equip your new piece to complete '+esc(first(adv.crew))+"'s set.":'Next: '+esc(M.NODE_NAMES[M.nodeType(s)].toLowerCase())+'.'})}
    if(f){const b=document.createElement('button');b.textContent='Watch again';b.onclick=()=>{replay=null;ui.screen='fight';render()};$('screen').querySelector('.panel').appendChild(b)}
  }

  // ---------------------------------------------------------------- summary
  function summary(){
    const pct=x=>Math.round(x*100)+'%';
    $('screen').innerHTML=`<section class="panel"><p class="eyebrow">Voyage over</p><h1>${esc(s.endReason)} Final integrity ${s.integrity}%.</h1>
      <p class="small muted">Recruits: ${s.purchases.filter(p=>p.id).map(p=>esc(first(p.id))+' @'+p.node+(p.price?' ('+p.price+' Writs)':'')).join(' → ')}</p>
      <div class="scroll-x"><table class="small"><thead><tr><th>Node</th><th>Battle</th><th>Recovery</th><th>Crew and sets</th><th>Bursts</th><th>Wasted</th></tr></thead><tbody>${s.fights.map(f=>`<tr><td>${f.node}</td><td>${esc(M.NODE_NAMES[f.type])}</td><td>${pct(f.score)} · ${esc(f.band)}</td><td>${f.crew.map(c=>esc(first(c.id))+(c.sets.length?' ('+c.sets.map(SETNAME).join(', ')+')':'')).join(', ')}</td><td>${f.metrics.bursts}</td><td>${f.metrics.wasted}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel">${notesHtml()}</section>
      <section class="panel"><form id="setup" class="row"><label>Affixes<select id="briefKind">${countOptions(s.brief.affixes.length)}</select></label><label>Seed<input id="seed" type="number" min="1" value="${s.seed+1}"></label><button type="submit">Start a new voyage</button></form></section>`;
    wireNotes($('screen'));
    $('setup').onsubmit=e=>{e.preventDefault();fresh(+$('seed').value||41,+$('briefKind').value);message('New voyage rolled.')};
    bar('Export this playtest',()=>{ui.drawer='openExport';renderDrawer();window.scrollTo({top:0,behavior:'smooth'})},{hint:'Rate it and write what happened first.'});
  }

  s=load();if(!s){s=M.create({seed:41,affixCount:2});s.meta={startedAt:Date.now()};s.feedback={}}
  s.feedback=s.feedback||{};render();
  message(M.nodeType(s)==='setup'&&!s.ended?'':'Voyage resumed.');
})();
