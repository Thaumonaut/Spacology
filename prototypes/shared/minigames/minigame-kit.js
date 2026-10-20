// Shared shell for the co-op mini-game prototypes: seeded randomness, the page frame, meters, timer, the result card
// with its near-miss line, playtest ratings and export. Puzzle rules live in each game's *-model.js; this file never
// decides whether a puzzle is solved. Loads as a classic script (window.MiniGameKit) or with require() in Node.
(function(root){
  'use strict';
  const STORE='spacologyMinigamesV1';
  // Three teams share one globe and one day/night clock. Research makes battles easier and feeds logistics; logistics
  // builds and moves gear, supplies and samples; exploration (the auto-battler itself) is not a mini-game collection.
  // `phase` is the half of the cycle a game is meant for, so the parallel run can schedule it.
  const GAMES=[
    {id:'aether-attunement',file:'aether-attunement.html',title:'Aether attunement',role:'Research',phase:'Night',inspiredBy:'Flood-It, as in Wuthering Waves',output:'Boss study: element tests on samples strip its buffs and reveal its weakness'},
    {id:'sensor-grid',file:'sensor-grid.html',title:'Sensor placement',role:'Research',phase:'Night',inspiredBy:'Catdoku / Queens',output:'Scouts the elective fight and lowers its difficulty'},
    {id:'dna-sequencing',file:'dna-sequencing.html',title:'DNA sequencing',role:'Research',phase:'Night',inspiredBy:'Shotgun sequencing assembly',output:'Clears flaws on research assistance cards'},
    {id:'signal-decoding',file:'signal-decoding.html',title:'Signal breach',role:'Research',phase:'Day',inspiredBy:'Cyberpunk 2077’s Breach Protocol',output:'Decoded Null transmissions become blueprints for logistics'},
    {id:'intel-check',file:'intel-check.html',title:'Manifest checking',role:'Research',phase:'Day',inspiredBy:'Papers, Please',output:'Verified manifests and orders; Null sabotage caught before it ships'},
    {id:'core-assay',file:'core-assay.html',title:'Core assay',role:'Research',phase:'Day',inspiredBy:'Spectrometry peak matching',output:'Ground samples analysed into resource nodes for logistics'},
    {id:'supply-run',file:'supply-run.html',title:'Supply run',role:'Logistics',phase:'Night',inspiredBy:'Walk-and-collect idle games',output:'Raw resources and crafted parts'},
    {id:'gear-pack',file:'gear-pack.html',title:'Gear assembly',role:'Logistics',phase:'Night',inspiredBy:'Backpack Battles',output:'The gear kits exploration ordered, built to the stats they asked for'},
    {id:'pallet-stacking',file:'pallet-stacking.html',title:'Rocket loading',role:'Logistics',phase:'Night',inspiredBy:'Honkai: Star Rail’s cargo stacking',output:'Launches gear to the front and samples to the ship'},
    {id:'route-planning',file:'route-planning.html',title:'Route planning',role:'Logistics',phase:'Day',inspiredBy:'Mini Motorways / Cities: Skylines',output:'The network that carries everything where it needs to go'},
    {id:'pipes',file:'pipes.html',title:'Pipes',role:'Logistics',phase:'Day',inspiredBy:'Rotating pipe puzzles',output:'A base layout connecting extractors, refineries and power'},
    {id:'depot-sorting',file:'depot-sorting.html',title:'Depot sorting',role:'Logistics',phase:'Day',inspiredBy:'Water-sort puzzles',output:'Arrivals sorted into the right bays for tonight’s production'},
    {id:'synergy-links',file:'synergy-links.html',title:'Synergy links',role:'Reserve',phase:'—',inspiredBy:'Flow Free',output:'Kept in reserve: a connection puzzle not currently assigned to a team'},
    {id:'element-pairs',file:'element-pairs.html',title:'Element pairs',role:'Reserve',phase:'—',inspiredBy:'Number matching and finite solitaire deals',output:'Research candidate: clear the board. No voyage rewards or material processing connected.'}
  ];
  const TIERS={
    perfect:{label:'Perfect',note:'Best possible result'},
    good:{label:'Good',note:'A clean solve'},
    partial:{label:'Partial',note:'It works, with something left on the table'},
    failed:{label:'Failed',note:'Nothing delivered this time'},
    auto:{label:'Automatic',note:'Skipped: the automatic fallback ran at a reduced result'}
  };

  // mulberry32: small, fast and repeatable. Seed 0 is remapped so it does not collapse onto another seed.
  function rng(seed){
    let a=(Number(seed)>>>0)||0x9e3779b9;
    const next=()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
    const int=n=>Math.floor(next()*n);
    return {next,int,
      range:(lo,hi)=>lo+int(hi-lo+1),
      pick:list=>list[int(list.length)],
      chance:p=>next()<p,
      shuffle:list=>{const out=list.slice();for(let i=out.length-1;i>0;i--){const j=int(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}};
  }
  const hashSeed=text=>{let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=ms=>{const s=Math.max(0,Math.round(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};

  function load(){try{const v=JSON.parse(root.localStorage.getItem(STORE));return v&&v.version===1?v:{version:1,sessions:[]};}catch{return {version:1,sessions:[]};}}
  function store(v){try{root.localStorage.setItem(STORE,JSON.stringify(v));return true;}catch{return false;}}
  function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  // shell(spec) builds the page frame inside <body> and returns the controls a game needs.
  // spec: {id, rules:[...], difficulties:[{id,label,target}], onNew({seed,difficulty}), onAuto(), onUndo?, onHint?, timed?, auto?}
  function shell(spec){
    const game=GAMES.find(g=>g.id===spec.id);if(!game)throw new Error('Unknown mini-game '+spec.id);
    const doc=root.document,params=new URLSearchParams(root.location.search);
    const diffs=spec.difficulties,startDiff=diffs.some(d=>d.id===params.get('difficulty'))?params.get('difficulty'):(spec.defaultDifficulty||diffs[0].id);
    let seed=(Number(params.get('seed'))>>>0)||(Date.now()%100000)+1,difficulty=startDiff,started=0,ended=0,timer=null,events=[],current=null;
    const embedded=root.parent!==root&&params.get('embed')==='expedition';
    const task=params.get('task'),attempt=params.get('attempt');
    const notify=(type,payload={})=>{if(embedded&&task&&attempt)root.parent.postMessage({type,version:1,task,attempt,game:spec.id,seed,difficulty,...payload},root.location.origin);};
    doc.body.classList.add('mg');
    if(embedded)doc.body.classList.add('mg-embedded');
    doc.body.innerHTML=`<header class="mg-head"><a class="brand" href="minigames.html">SPACOLOGY <span>/ MINI-GAMES</span></a><span class="mg-role mg-role-${game.role.toLowerCase()}">${game.role}</span><h1>${esc(game.title)}</h1><button id="mgExport" class="mg-quiet">Export playtests</button></header>
<main class="mg-main"><section class="mg-bar"><div class="mg-meters" id="mgMeters"></div><div class="mg-controls"><label>Difficulty<select id="mgDifficulty">${diffs.map(d=>`<option value="${d.id}">${esc(d.label)}</option>`).join('')}</select></label><label>Seed<input id="mgSeed" type="number" min="1" max="4294967295"></label><button id="mgNew">New puzzle</button>${spec.onHint?'<button id="mgHint">Hint</button>':''}${spec.onUndo?'<button id="mgUndo">Undo</button>':''}${spec.auto===false?'':'<button id="mgAuto" class="mg-quiet" title="Run the automatic fallback at a reduced result">Skip (auto)</button>'}</div></section>
<p id="mgStatus" class="mg-status" role="status" aria-live="polite"></p>
<div class="mg-layout"><section id="mgStage" class="mg-stage"></section><aside class="mg-side"><p class="eyebrow">HOW IT WORKS</p><ul class="mg-rules">${spec.rules.map(r=>`<li>${r}</li>`).join('')}</ul><p class="eyebrow">WHAT IT PRODUCES</p><p class="mg-output">${esc(game.output)}</p><p class="mg-inspired">Inspired by ${esc(game.inspiredBy)}</p><div id="mgSideExtra"></div></aside></div></main>
<div id="mgResult" class="mg-result" hidden><div class="mg-card" role="dialog" aria-modal="true" aria-labelledby="mgTier"><p class="eyebrow" id="mgTierNote"></p><h2 id="mgTier"></h2><p id="mgHeadline" class="mg-headline"></p><p id="mgNear" class="mg-near"></p><dl id="mgStats" class="mg-stats"></dl><p id="mgProduces" class="mg-produces"></p>
<fieldset class="mg-rate"><legend>Playtest notes (optional)</legend><div class="mg-scale" data-scale="fun"><span>Fun</span>${[1,2,3,4,5].map(n=>`<button data-rate="fun" data-v="${n}">${n}</button>`).join('')}</div><div class="mg-scale" data-scale="annoyance"><span>Annoyance</span>${[1,2,3,4,5].map(n=>`<button data-rate="annoyance" data-v="${n}">${n}</button>`).join('')}</div><textarea id="mgNote" rows="2" placeholder="What was satisfying, or what dragged?"></textarea></fieldset>
<div class="mg-card-actions"><button id="mgReview">Review the board</button><button id="mgAgain" class="primary">Next puzzle</button></div></div></div>`;
    const $=id=>doc.getElementById(id),stage=$('mgStage');
    $('mgDifficulty').value=difficulty;$('mgSeed').value=seed;
    const target=()=>(diffs.find(d=>d.id===difficulty)||{}).target||60;
    function tick(){const t=$('mgTime');if(t)t.textContent=clock((ended||Date.now())-(started||Date.now()))+' / '+clock(target()*1000);}
    function meters(list){$('mgMeters').innerHTML=list.concat(spec.timed===false?[]:[{label:'Time',value:'',id:'mgTime'}]).map(m=>`<div class="mg-meter ${m.tone?'mg-'+m.tone:''}"><span>${esc(m.label)}</span><b ${m.id?`id="${m.id}"`:''}>${esc(m.value)}</b></div>`).join('');tick();}
    function status(text,tone){const s=$('mgStatus');s.textContent=text||'';s.className='mg-status'+(tone?' mg-'+tone:'');}
    function begin(){if(!started){started=Date.now();if(spec.timed!==false)timer=setInterval(tick,500);}}
    function log(type,detail){events.push({type,at:started?Date.now()-started:0,...(detail||{})});}
    function fresh(){
      ended=0;started=0;clearInterval(timer);events=[];current=null;$('mgResult').hidden=true;
      const url=new URL(root.location.href);url.searchParams.set('seed',seed);url.searchParams.set('difficulty',difficulty);root.history.replaceState(null,'',url);
      status('');spec.onNew({seed,difficulty});tick();
    }
    function finish(result){
      if(ended)return;ended=Date.now();if(!started)started=ended;clearInterval(timer);tick();
      const tier=TIERS[result.tier]?result.tier:'partial';
      current={game:spec.id,seed,difficulty,tier,score:result.score??null,ms:ended-started,targetMs:spec.timed===false?null:target()*1000,stats:result.stats||{},events,
        rating:{},startedAt:new Date(started).toISOString()};
      const data=load();data.sessions.push(current);if(data.sessions.length>500)data.sessions.splice(0,data.sessions.length-500);if(!store(data))status('Browser storage unavailable; export to keep these results.','warn');
      $('mgTier').textContent=TIERS[tier].label;$('mgTier').className='mg-tier-'+tier;$('mgTierNote').textContent=TIERS[tier].note;
      $('mgHeadline').textContent=result.headline||'';$('mgNear').textContent=result.nearMiss||'';$('mgNear').hidden=!result.nearMiss;
      $('mgProduces').innerHTML=result.output?`<b>Delivered:</b> ${esc(result.output)}`:'';
      const stats={...(spec.timed===false?{}:{Time:clock(current.ms)+(current.ms>current.targetMs?' (over target)':'')}),...(result.stats||{})};
      $('mgStats').innerHTML=Object.entries(stats).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
      doc.querySelectorAll('[data-rate]').forEach(b=>b.classList.remove('on'));$('mgNote').value='';
      $('mgResult').hidden=false;$('mgAgain').focus();
      notify('spacology:minigame-result',{tier,output:result.output||'',delivery:result.delivery||null});
    }
    function rate(kind,value){if(!current)return;current.rating[kind]=value;const data=load(),last=data.sessions.findLast(s=>s.startedAt===current.startedAt&&s.game===current.game);if(last){last.rating=current.rating;store(data);}}
    $('mgNew').onclick=()=>{seed=(seed%4294967295)+1;$('mgSeed').value=seed;fresh();};
    if(embedded){$('mgAgain').textContent='Return to station';$('mgAgain').onclick=()=>notify('spacology:minigame-return');}
    else $('mgAgain').onclick=$('mgNew').onclick;
    $('mgReview').onclick=()=>{$('mgResult').hidden=true;if(!$('mgStatus').textContent)status('Board shown as you left it. Press “New puzzle” to continue.');};
    $('mgDifficulty').onchange=e=>{difficulty=e.target.value;fresh();};
    $('mgSeed').onchange=e=>{seed=(Number(e.target.value)>>>0)||1;e.target.value=seed;fresh();};
    if($('mgAuto'))$('mgAuto').onclick=()=>{if(ended)return;begin();log('auto');const r=spec.onAuto();finish({...r,tier:'auto'});};
    if(spec.onHint)$('mgHint').onclick=()=>{if(ended)return;begin();log('hint');spec.onHint();};
    if(spec.onUndo)$('mgUndo').onclick=()=>{if(ended)return;log('undo');spec.onUndo();};
    $('mgExport').onclick=()=>download('spacology-minigames-playtests.json',load());
    doc.addEventListener('click',e=>{const b=e.target.closest('[data-rate]');if(!b)return;doc.querySelectorAll(`[data-rate="${b.dataset.rate}"]`).forEach(x=>x.classList.toggle('on',x===b));rate(b.dataset.rate,Number(b.dataset.v));});
    $('mgNote').oninput=e=>rate('note',e.target.value);
    doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('mgResult').hidden)$('mgReview').click();});
    const api={stage,game,meters,status,begin,finish,log,embedded,
      get seed(){return seed;},get difficulty(){return difficulty;},get ended(){return !!ended;},
      side:html=>{$('mgSideExtra').innerHTML=html;},
      undoEnabled:on=>{if(spec.onUndo)$('mgUndo').disabled=!on;},
      // controls({auto,hint,undo}): enable or disable the shell's buttons, e.g. during a closing animation.
      controls:on=>{for(const [k,id] of [['auto','mgAuto'],['hint','mgHint'],['undo','mgUndo']])if(k in on&&$(id))$(id).disabled=!on[k];},
      flash:(el,cls='mg-pop')=>{if(!el||root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);},
      start:fresh};
    return api;
  }

  const api={GAMES,TIERS,STORE,rng,hashSeed,esc,clock,load,shell};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MiniGameKit=api;
})(typeof globalThis==='object'?globalThis:this);
