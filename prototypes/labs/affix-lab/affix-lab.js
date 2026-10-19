(function(){
  'use strict';
  // UI for the affix lab. All rules live in affix-lab-model.js; this file only renders state and forwards actions to M.act.
  const M=window.AffixLab,A=window.SpacologyAether;
  const KEY='spacologyAffixLabV1',LOG_KEY='spacologyAffixLabLogV1',REPORT_KEY='spacologyAffixLabReportV1';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v===undefined||v===null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const art=id=>`../assets/cast/${M.ROSTER[id].art}`;
  const FORMAT_SHORT={patrol:'Patrol',swarm:'Swarm',elite:'Elite',boss:'Boss'};
  const OUTCOME={cleared:'Cleared the field',time:'Ran out of time',wiped:'The front line fell'};
  // Every shown score rounds down, so a percentage never reads as the next band's threshold (87.7% is a loss, not 88%).
  // The epsilon keeps float error from showing 0.29 as 28%.
  const pct=x=>Math.floor(x*100+1e-9);

  let s=null,report=null;

  // ---- Persistence ----------------------------------------------------------------------------------------------
  // A saved voyage whose Brief breaks the current rules (for example, conditions that contradict each other) is rerolled
  // from the same seed and condition count rather than kept.
  let notice='';
  function load(){
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){saved=null;}
    if(saved&&saved.version===1&&saved.lab==='affix-team-building'&&Array.isArray(saved.crew)&&saved.brief){
      if(M.legalBrief(saved.brief)){
        s=saved;
        $('seed').value=s.seed;
        $('affixCount').value=String(s.affixCount!==undefined?s.affixCount:s.brief.affixes.length);
      }else{
        $('seed').value=saved.seed;
        $('affixCount').value=String(saved.affixCount!==undefined?saved.affixCount:saved.brief.affixes.length);
        notice='Your saved voyage used conditions that have since changed or contradicted each other, so it was rerolled from the same seed.';
      }
    }
    try{report=s?JSON.parse(localStorage.getItem(REPORT_KEY)||'null'):null;}catch(e){report=null;}
    // A voyage from before ids gets one now, stored at once, so every tab that reads it logs under the same id. If it was
    // already logged, its entry (also without an id) gets the same one, so later edits reach it. If no entry matches, the
    // voyage is not in the log, so it can be saved again, as after clearing the log.
    if(s&&!s.voyageId){
      s.voyageId=newVoyageId();
      const list=s.saved?sessions():[],entry=s.saved?olderEntry(list,s):null;
      if(s.saved&&!entry)s.saved=false;
      save();
      if(entry){entry.voyageId=s.voyageId;localStorage.setItem(LOG_KEY,JSON.stringify(list));}   // only on a match: a log that fails to parse reads as [] and must not be overwritten
    }
    if(!s)start();
  }
  function newVoyageId(){return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
  // The log entry an older version wrote for this voyage: same seed, Brief, final crew and battle scores. A replayed seed can
  // match twice; the one saved last is this voyage (ties go to the later entry; an unreadable date counts as oldest).
  function olderEntry(list,v){
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    let best=null,bestAt=-Infinity;
    list.forEach(x=>{
      if(!x||x.voyageId||x.seed!==v.seed||!same(x.affixes,v.brief.affixes)||!same(x.bosses,v.brief.bosses)||!same(x.finalCrew,v.crew)||
        !same((x.history||[]).map(h=>h.score),v.results.map(r=>r.score)))return;
      const at=Date.parse(x.savedAt),t=Number.isNaN(at)?-Infinity:at;
      if(t>=bestAt){best=x;bestAt=t;}
    });
    return best;
  }
  function save(){
    localStorage.setItem(KEY,JSON.stringify(s));
    if(report)localStorage.setItem(REPORT_KEY,JSON.stringify(report));else localStorage.removeItem(REPORT_KEY);
  }
  function sessions(){try{return JSON.parse(localStorage.getItem(LOG_KEY)||'[]');}catch(e){return [];}}
  function start(){
    const seed=Number($('seed').value)||1,count=Number($('affixCount').value);
    s=M.createSession({seed,affixCount:count,now:Date.now()});
    s.affixCount=count;s.saved=false;s.outcome='';s.agency='';s.excitement='';s.notes='';s.voyageId=newVoyageId();
    $('seed').value=s.seed;   // the session's normalized seed
    report=null;
    save();
  }
  function say(text){$('message').textContent=text||'';}
  function act(action){
    const r=M.act(s,action);
    say(r.message);
    if(r.ok&&action.type==='launch'){
      report={entry:r.entry,outcome:r.result.outcome,band:r.result.band,log:(r.result.log||[]).slice(0,400),crew:r.result.crew,aether:r.result.aether};
      if(s.phase==='done')s.finishedAt=Date.now();
    }
    save();render();
    if(r.ok&&action.type==='launch')$('reportPanel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }

  // ---- Rendering ------------------------------------------------------------------------------------------------
  // The seed and condition boxes set up the next voyage, so render never writes them: start() and load() do.
  function render(){
    $('plan').value=s.plan||'';
    renderBrief();renderRoute();renderStatus();renderNext();renderReport();renderBerths();renderSupply();renderRoster();renderSummary();renderSessions();
  }
  function renderBrief(){
    const cards=s.brief.affixes.map(id=>{
      const a=M.AFFIXES[id];
      return `<article class="affix"><span class="cat">${esc(a.category==='rule'?'Rule':a.category==='stat'?'Stat':'Shape')}</span>
        <div class="name">${esc(a.name)}</div><p class="tax">${esc(a.tax)}</p>${a.gift?`<p class="gift">${esc(a.gift)}</p>`:''}</article>`;
    });
    $('affixes').innerHTML=cards.length?cards.join(''):'<p class="calm">No conditions. The board and the rules are the whole game.</p>';
    const next=M.nextBattle(s);
    $('bosses').innerHTML=s.brief.bosses.map((id,i)=>{
      const b=M.BOSSES[id],now=next&&next.sector===i+1;
      return `<div class="boss${now?' now':''}"><span class="eyebrow">Sector ${i+1} boss</span><b>${esc(b.name)}</b><span class="small">${esc(b.text)}</span></div>`;
    }).join('');
  }
  function renderRoute(){
    $('route').innerHTML=M.ROUTE.map((r,i)=>{
      const done=s.results[i],boss=r.format==='boss'?M.BOSSES[s.brief.bosses[r.sector-1]].name.replace('The ',''):FORMAT_SHORT[r.format];
      const cls=['node',i>0&&r.sector!==M.ROUTE[i-1].sector?'gap':'',done?done.band:'',i===s.battle&&s.phase!=='done'?'now':''].filter(Boolean).join(' ');
      return `<div class="${cls}" title="Sector ${r.sector} · ${esc(FORMAT_SHORT[r.format])}"><b>${esc(boss)}</b>${done?pct(done.score)+'%':'S'+r.sector}</div>`;
    }).join('');
  }
  function renderStatus(){
    const stat=(v,label)=>`<div class="stat"><b>${esc(v)}</b><span>${esc(label)}</span></div>`;
    const upkeep=M.ECON.upkeep*Math.max(0,s.crew.length-M.ECON.upkeepFree);
    $('status').innerHTML=stat(s.gold+'g','Gold')+stat(s.integrity+'%','Integrity')+stat(`${s.crew.length} / ${s.berths}`,'Crew / berths')+
      stat(s.phase==='done'?'Done':`${s.battle+1} / ${M.ROUTE.length}`,'Battle')+(upkeep?stat(upkeep+'g','Upkeep a battle'):'');
  }
  function renderNext(){
    const b=M.nextBattle(s);
    if(s.phase==='done'||!b){$('nextPanel').innerHTML='<p class="eyebrow">Voyage over</p><h2>See the summary below</h2>';return;}
    const fmt=M.FORMATS[b.format],boss=b.boss&&M.BOSSES[b.boss];
    const blocked=M.canLaunch(s);
    $('nextPanel').innerHTML=`<p class="eyebrow">Next · battle ${s.battle+1} of ${M.ROUTE.length} · sector ${b.sector}</p>
      <h2>${esc(boss?boss.name:fmt.label)}</h2>
      <p>${esc(boss?boss.text:fmt.text)}</p>
      ${b.gentle?`<p class="small"><b>Gentle start.</b> The first battles ramp up: enemies here are at ×${b.scale} strength, below the rest of the voyage.</p>`:''}
      ${boss?'':`<p class="small muted">Enemies at ×${b.scale} strength. ${b.format==='patrol'?'Patrols mix Wardens, Quicksteps, Cleansers, Reflectors and Menders.':''}</p>`}
      <p class="small muted">${fmt.rounds} rounds. Score is the share of the board you take; 88% or better costs no integrity.</p>
      ${s.phase==='draft'?`<p><b>Choose two crewmates to start</b>: they are free. Read the Brief first.</p>`:''}
      <div class="row"><button class="primary" type="button" data-action="launch" ${blocked?'disabled':''}>Launch battle ${s.battle+1}</button></div>
      ${blocked&&s.phase!=='draft'?`<p class="small" style="color:var(--gold)">${esc(blocked)}</p>`:''}`;
  }
  function renderReport(){
    const panel=$('reportPanel');
    if(!report){panel.hidden=true;return;}
    panel.hidden=false;
    const e=report.entry,band=M.BANDS.find(b=>b.id===e.band),loss=e.integrity<0;
    const total=Object.values(e.contributions).reduce((a,b)=>a+b,0)||1;
    const bars=Object.entries(e.contributions).sort((a,b)=>b[1]-a[1]).map(([id,v])=>
      `<div class="barrow"><span>${esc(id)}</span><span class="bar"><i style="width:${Math.round(v/total*100)}%"></i></span><span>${Math.round(v/total*100)}%</span></div>`).join('');
    const down=report.crew.filter(c=>!c.alive).map(c=>c.id);
    // Losing in a way you can read: one plain sentence on why, from what the fight recorded.
    const front=e.crew.filter(id=>M.ROSTER[id].row==='front');
    const why=report.outcome==='wiped'?(front.length===1
        ?`${front[0]} was your only front-row crewmate. When they fell there was no one left to hold the line, so the battle ended.`
        :`Your whole front line (${front.join(', ')}) fell, and the back row cannot fight on without it.`)
      :report.outcome==='time'?`Time ran out with ${100-pct(e.score)}% of the board still standing. More damage, or damage that lands sooner, would finish it.`:'';
    panel.innerHTML=`<p class="eyebrow">Battle ${e.battle+1} · ${esc(e.boss?M.BOSSES[e.boss].name:FORMAT_SHORT[e.format])}</p>
      <div class="report">
        <div class="band${loss?' loss':''}">${esc(band.label)} · ${pct(e.score)}%</div>
        <p class="small">${esc(OUTCOME[report.outcome])}. Integrity ${e.integrity>=0?'+':''}${e.integrity}, gold +${e.gold}${e.upkeep?` after ${e.upkeep}g upkeep`:''}.${down.length?` Down: ${esc(down.join(', '))}.`:''}</p>
        ${why?`<p class="why">${esc(why)}</p>`:''}
        ${e.reports.length?`<div class="effects">${e.reports.map(r=>`<div class="effect"><b>${esc(r.name)}</b>${esc(r.text)}${impact(r,e.score)}</div>`).join('')}</div>`:''}
        <div><p class="eyebrow">Damage by crewmate</p><div class="bars">${bars||'<p class="small muted">No damage dealt.</p>'}</div></div>
        <p class="small muted">Aether: spent ${report.aether.spent}, generated ${report.aether.generated}, lost ${report.aether.wasted} (pool ${report.aether.max}).</p>
        <details><summary>Battle log</summary><div class="log">${report.log.map(l=>`<p>${l.t} AV · ${esc(l.text)}</p>`).join('')}</div></details>
      </div>`;
  }
  // What one condition did to this battle's score: the same battle replayed without it.
  function impact(r,score){
    if(r.without===undefined)return '';
    const now=pct(score),then=pct(r.without);
    const text=then===now?'Made no difference to the score.':then>now?`Without it, this battle ends at ${then}%.`:`Without it, this battle ends at ${then}%: it helped you here.`;
    return ` <span class="impact${then>now?' cost':then<now?' help':''}">${text}</span>`;
  }
  function aetherTag(id){
    const p=A.profile(id);
    return p.skillGain?`skill −${p.cost} / +${p.skillGain}`:p.spendAll?`skill −${p.cost}+`:`skill −${p.cost}`;
  }
  function tags(id){
    const c=M.ROSTER[id];
    return `<span class="tag">${esc(M.FAMILIES[c.family].label)}</span>${c.sustain?'<span class="tag sustain">Sustain</span>':''}`+
      `<span class="tag${c.row==='front'?' front':''}">${c.row==='front'?'Front row':'Back row'}</span>`+
      `<span class="tag aether">Aether ${esc(aetherTag(id))}</span>`;
  }
  function renderBerths(){
    const live=s.phase!=='done';
    const rows=[];
    for(let i=0;i<s.berths;i++){
      const id=s.crew[i];
      if(!id){rows.push(`<div class="member empty">Empty berth: recruit anyone from the roster below.</div>`);continue;}
      const c=M.ROSTER[id],gear=s.gear[id]||[];
      const slots=Array.from({length:M.ECON.slots},(_,k)=>{
        const g=gear[k];
        return g?`<div class="slot filled"><span>${esc(M.GEAR[g].name)}</span>${live?`<button type="button" data-action="unequip" data-id="${esc(id)}" data-gear="${esc(g)}" aria-label="Remove ${esc(M.GEAR[g].name)} from ${esc(id)}">Remove</button>`:''}</div>`
          :`<div class="slot">Empty slot</div>`;
      }).join('');
      rows.push(`<div class="member"><img class="portrait" src="${esc(art(id))}" alt=""><div><b>${esc(id)}</b> <span class="small muted">${esc(c.role)}</span>
        <div class="labels">${tags(id)}</div><div class="slots">${slots}</div>
        ${live&&s.phase==='ops'?`<div class="actions"><button type="button" data-action="release" data-id="${esc(id)}">Release ${esc(id)}</button></div>`:''}</div></div>`);
    }
    $('berths').innerHTML=rows.join('');
    const price=M.voucherPrice(s.berths);
    const upkeepNote=M.ECON.upkeep&&s.berths+1>M.ECON.upkeepFree?` · then ${M.ECON.upkeep}g upkeep a battle`:'';
    $('voucher').textContent=price===null?'All six berths are open':`Voucher · open berth ${s.berths+1} for ${price}g${upkeepNote}`;
    $('voucher').disabled=!live||s.phase==='draft'||price===null||s.gold<price;
    $('voucher').classList.toggle('primary',!$('voucher').disabled&&s.crew.length>=s.berths);
    $('berthNote').textContent=s.phase==='draft'?'Two berths start free. Pick your opening pair from the roster.'
      :s.phase==='done'?'The voyage is over.'
      :`Releasing a crewmate is free; their equipment returns to the hold. Next berth: ${price===null?'none left':price+' gold'}. `+
        (M.ECON.upkeep?`Each crewmate beyond ${M.ECON.upkeepFree} costs ${M.ECON.upkeep} gold of upkeep after every battle.`:'');
  }
  function fitsText(gearId){
    const fits=M.gearFits(gearId),aboard=fits.filter(id=>s.crew.includes(id));
    return `Fits ${fits.map(id=>aboard.includes(id)?`<strong>${esc(id)}</strong>`:esc(id)).join(', ')}`;
  }
  function renderSupply(){
    const live=s.phase==='ops';
    $('offers').innerHTML=s.offers.map((id,i)=>{
      if(!id)return `<div class="offer sold"><b>Sold</b><span class="small muted">New stock after the next battle.</span></div>`;
      const g=M.GEAR[id];
      return `<div class="offer"><b>${esc(g.name)}</b><span class="small">${esc(g.text)}</span><span class="fits">${fitsText(id)}</span>
        <button type="button" data-action="buy" data-index="${i}" ${!live||s.gold<M.ECON.gearPrice?'disabled':''}>Buy · ${M.ECON.gearPrice}g</button></div>`;
    }).join('');
    const cost=M.ECON.reroll(s.rerolls);
    $('reroll').textContent=`Reroll the supply · ${cost}g`;
    $('reroll').disabled=!live||s.gold<cost;
    if(!s.stash.length){$('hold').innerHTML='<p class="small muted">Nothing in the hold.</p>';return;}
    $('hold').innerHTML=s.stash.map((g,i)=>{
      const fits=M.gearFits(g),open=s.crew.filter(id=>(s.gear[id]||[]).length<M.ECON.slots);
      const ordered=[...open.filter(id=>fits.includes(id)),...open.filter(id=>!fits.includes(id))];
      const options=ordered.map(id=>`<option value="${esc(id)}">${esc(id)}${fits.includes(id)?' · fits':''}</option>`).join('');
      return `<div class="piece"><span class="name"><b>${esc(M.GEAR[g].name)}</b> · ${esc(M.GEAR[g].text)}</span>
        <select aria-label="Fit ${esc(M.GEAR[g].name)} to" data-hold="${i}" ${!live||!ordered.length?'disabled':''}>${options||'<option>No free slot</option>'}</select>
        <button type="button" data-action="equip" data-index="${i}" ${!live||!ordered.length?'disabled':''}>Fit</button>
        <button type="button" data-action="sell" data-index="${i}" ${!live?'disabled':''}>Sell · ${M.ECON.sellValue}g</button></div>`;
    }).join('');
  }
  // The roster is where attention is when the crew feels too small, so expanding happens here: with every berth full, a
  // recruit button opens the next berth (the voucher) and recruits in one step.
  function renderRoster(){
    const live=s.phase!=='done',free=s.crew.length<s.berths,price=M.voucherPrice(s.berths);
    const canOpen=s.phase==='ops'&&!free&&price!==null&&s.gold>=price;
    const upkeep=M.ECON.upkeep&&s.berths+1>M.ECON.upkeepFree?`, then ${M.ECON.upkeep} gold of upkeep a battle`:'';
    $('rosterNote').textContent=s.phase==='draft'?`Pick ${M.ECON.startCrew-s.crew.length} more to start.`
      :s.phase==='done'?'The voyage is over. Start a new one to recruit again.'
      :free?'A berth is open: anyone below can take it.'
      :price===null?'All six berths are full. Release someone to swap.'
      :`Every berth is full. Recruiting anyone below opens berth ${s.berths+1} for ${price} gold${upkeep}. Or release someone to swap.`;
    $('roster').innerHTML=Object.entries(M.FAMILIES).map(([fam,f])=>{
      const cards=Object.values(M.ROSTER).filter(c=>c.family===fam).map(c=>{
        const aboard=s.crew.includes(c.id);
        const label=aboard?'Aboard':free?`Recruit ${c.id}`:price===null?'All berths full'
          :canOpen?`Open berth ${s.berths+1} and recruit · ${price}g`:`Berth ${s.berths+1} costs ${price}g`;
        return `<article class="recruit${aboard?' aboard':''}"><div class="head"><img src="${esc(art(c.id))}" alt=""><div><b>${esc(c.id)}</b><p>${esc(c.role)}</p></div></div>
          <div class="labels">${tags(c.id)}</div>
          <details><summary>Kit</summary><p><b>Basic.</b> ${esc(c.basic)}</p><p><b>Skill.</b> ${esc(c.skill)}</p><p><b>Ultimate.</b> ${esc(c.ult)}</p>${c.passive?`<p><b>Passive.</b> ${esc(c.passive)}</p>`:''}</details>
          <button type="button" data-action="hire" data-id="${esc(c.id)}" aria-label="${esc(aboard?`${c.id} is aboard`:label.startsWith('Recruit')?label:`${label}: ${c.id}`)}" ${!live||aboard||!(free||canOpen)?'disabled':''}>${esc(label)}</button></article>`;
      }).join('');
      return `<div class="family"><h3>${esc(f.label)}</h3><p class="small muted">${esc(f.text)}</p><div class="roster">${cards}</div></div>`;
    }).join('');
  }
  function renderSummary(){
    const panel=$('summary');
    if(s.phase!=='done'){panel.hidden=true;return;}
    panel.hidden=false;
    const mean=s.results.reduce((a,r)=>a+r.score,0)/Math.max(1,s.results.length);
    const bought=s.purchases.filter(p=>p.type==='voucher').length,items=s.purchases.filter(p=>p.type==='gear').length,rerolls=s.purchases.filter(p=>p.type==='reroll').length;
    const rows=s.results.map(r=>`<tr><td>${r.battle+1}</td><td>${esc(r.boss?M.BOSSES[r.boss].name:FORMAT_SHORT[r.format])}</td><td>${pct(r.score)}%</td>
      <td>${esc(r.crew.map(id=>id+((r.gear[id]||[]).length?` (${r.gear[id].map(g=>M.GEAR[g].name).join(', ')})`:'')).join(' · '))}</td></tr>`).join('');
    panel.innerHTML=`<p class="eyebrow">Voyage summary</p><h2>${s.integrity>0?`Home with ${s.integrity}% integrity`:'The record was lost'}</h2>
      <p>Average battle score ${pct(mean)}%. You opened ${bought} extra berth${bought===1?'':'s'}, bought ${items} item${items===1?'':'s'} and rerolled ${rerolls} time${rerolls===1?'':'s'}.</p>
      <div class="tablewrap"><table><thead><tr><th>#</th><th>Battle</th><th>Score</th><th>Crew and equipment</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h3 style="margin-top:14px">Two ratings, kept separate</h3>
      <div class="row"><label>Agency<select id="agency"><option value="">Unrated</option><option value="1">1 · Luck decided it</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 · My choices decided it</option></select></label>
      <label>Excitement<select id="excitement"><option value="">Unrated</option><option value="1">1 · Flat</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 · Couldn't wait for the next fight</option></select></label></div>
      <label class="small muted" style="display:block;margin-top:10px">What actually happened? <textarea id="outcome"></textarea></label>
      <label class="small muted" style="display:block;margin-top:10px">Notes <textarea id="notes"></textarea></label>
      <div class="row" style="margin-top:10px"><button class="primary" type="button" data-action="logSession" ${s.saved?'disabled':''}>${s.saved?'Saved to the session log':'Save to the session log'}</button></div>`;
    $('agency').value=s.agency||'';$('excitement').value=s.excitement||'';$('outcome').value=s.outcome||'';$('notes').value=s.notes||'';
  }
  function overlap(a,b){if(!a||!b)return null;return a.filter(id=>b.includes(id)).length;}
  function renderSessions(){
    const list=sessions();
    if(!list.length){$('sessions').innerHTML='<p class="small muted">No saved voyages yet.</p>';return;}
    $('sessions').innerHTML=`<table><thead><tr><th>#</th><th>Conditions</th><th>Final crew</th><th>Carried over</th><th>Integrity</th><th>Agency / excitement</th><th>Plan → outcome</th></tr></thead><tbody>${
      list.map((x,i)=>{
        const prev=list[i-1],kept=overlap(x.finalCrew,prev&&prev.finalCrew);
        return `<tr><td>${i+1}</td><td>${esc(x.affixes.map(id=>M.AFFIXES[id]?M.AFFIXES[id].name:id).join(' · ')||'None')}</td><td>${esc(x.finalCrew.join(', '))}</td>
          <td>${kept===null?'—':`${kept} of ${x.finalCrew.length}`}</td><td>${esc(x.integrity)}%</td><td>${esc(x.agency||'–')} / ${esc(x.excitement||'–')}</td>
          <td>${esc(x.plan||'–')} → ${esc(x.outcome||'–')}</td></tr>`;
      }).join('')}</tbody></table>`;
  }
  // Every voyage carries an id from the start (start() and load()), so saving again, from any tab, replaces its entry
  // rather than adding one. Edits to what the player wrote after that (plan, outcome, notes, ratings) update the same
  // entry, so the log always matches the page.
  function logSession(){
    s.agency=$('agency').value;s.excitement=$('excitement').value;s.outcome=$('outcome').value;s.notes=$('notes').value;
    s.voyageId=s.voyageId||newVoyageId();
    const list=sessions(),i=list.findIndex(x=>x.voyageId===s.voyageId);
    const entry={voyageId:s.voyageId,savedAt:new Date().toISOString(),seed:s.seed,affixes:s.brief.affixes,bosses:s.brief.bosses,plan:s.plan,outcome:s.outcome,notes:s.notes,
      agency:s.agency,excitement:s.excitement,integrity:s.integrity,finalCrew:s.crew.slice(),history:s.results.map(r=>({battle:r.battle,crew:r.crew,gear:r.gear,score:r.score})),
      purchases:s.purchases,wallSeconds:s.startedAt&&s.finishedAt?Math.round((s.finishedAt-s.startedAt)/1000):null};
    if(i<0)list.push(entry);else list[i]=entry;   // never a second entry for the same voyage
    localStorage.setItem(LOG_KEY,JSON.stringify(list));
    s.saved=true;save();render();say('Saved. Start the next voyage with a new seed.');
  }
  function updateLogged(){
    if(!s.saved||!s.voyageId)return;
    const list=sessions(),entry=list.find(x=>x.voyageId===s.voyageId);
    if(!entry)return;
    Object.assign(entry,{plan:s.plan,outcome:s.outcome,notes:s.notes,agency:s.agency,excitement:s.excitement});
    localStorage.setItem(LOG_KEY,JSON.stringify(list));
    renderSessions();   // not render(): that would rewrite the box being typed in
  }
  function exportAll(){
    const blob=new Blob([JSON.stringify({lab:'affix-team-building',version:1,exportedAt:new Date().toISOString(),sessions:sessions(),current:s},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`affix-lab-sessions-${Date.now()}.json`;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);
    say('Exported every saved voyage and the current one.');
  }

  // ---- Events ---------------------------------------------------------------------------------------------------
  // Every action re-renders, so the second click of a double-click would land on whatever moved under the cursor (the
  // next item's Sell, the next crewmate's Release). Drop it for every button. Keyboard activation has detail 0.
  document.addEventListener('click',ev=>{
    if(ev.detail>1&&ev.target.closest('button')){ev.preventDefault();ev.stopPropagation();}
  },true);
  document.addEventListener('click',ev=>{
    const btn=ev.target.closest('button[data-action]');
    if(!btn||btn.disabled)return;
    const a=btn.dataset.action;
    if(a==='hire'||a==='release')act({type:a,id:btn.dataset.id});
    else if(a==='buy')act({type:'buy',index:Number(btn.dataset.index)});
    else if(a==='unequip')act({type:'unequip',id:btn.dataset.id,gear:btn.dataset.gear});
    else if(a==='equip'){const i=Number(btn.dataset.index),pick=document.querySelector(`select[data-hold="${i}"]`);act({type:'equip',gear:s.stash[i],id:pick&&pick.value});}
    else if(a==='sell')act({type:'sell',gear:s.stash[Number(btn.dataset.index)]});
    else if(a==='launch')act({type:'launch',record:true,explain:true});
    else if(a==='logSession')logSession();
  });
  $('voucher').addEventListener('click',()=>act({type:'voucher'}));
  $('reroll').addEventListener('click',()=>act({type:'reroll'}));
  $('setup').addEventListener('submit',ev=>{
    ev.preventDefault();
    if(s&&s.phase!=='draft'&&s.phase!=='done'&&!confirm('Abandon the current voyage and start a new one?'))return;
    if(s&&s.phase==='done'&&!s.saved&&!confirm('This voyage isn\'t in the session log yet. Start a new one anyway?'))return;
    start();render();say('New voyage. Read the Brief, then pick two crewmates.');
  });
  $('randomSeed').addEventListener('click',()=>{$('seed').value=1+Math.floor(Math.random()*999999);});
  $('plan').addEventListener('input',()=>{s.plan=$('plan').value;save();updateLogged();});
  document.addEventListener('input',ev=>{
    if(!s||s.phase!=='done')return;
    if(['agency','excitement','outcome','notes'].includes(ev.target.id)){s[ev.target.id]=ev.target.value;save();updateLogged();}
  });
  $('export').addEventListener('click',exportAll);
  // The current voyage left the log with everything else, so it can be saved again.
  $('clearLog').addEventListener('click',()=>{if(confirm('Delete every saved voyage from this browser?')){localStorage.removeItem(LOG_KEY);s.saved=false;save();render();say('Session log cleared.');}});

  load();render();say(notice);
})();
