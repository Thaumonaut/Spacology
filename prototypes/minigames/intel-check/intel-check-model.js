// Manifest checking model (Papers, Please for the Research team's day shift): logistics' supply manifests and orders
// arrive one at a time; a few are Null sabotage carrying exactly one planted discrepancy against the documents on the
// desk. Research clears the genuine shipments for Logistics and stops the sabotaged convoys before they ship. Pure
// rules only, deterministic from (seed, difficulty): generation with an independent audit of every manifest,
// comparisons (the inspect mechanic), one-tap checks, moves, evaluation, tiers, score, citations, the automatic
// fallback, hints, near-miss and consequence lines. Every visual (specimen crates, seals, transponder signatures,
// cargo scans, the route map) is structured data, so every comparison is exact.
// Internal names are kept from the intel desk: a report is a manifest, its region is the origin depot, its sighting
// is the cargo lines, freq the transponder code, cond the handling, snap the cargo scan, from the route; documents
// roster/freq/sensor/rules/map are the depot roster, transponder table, production log, shipping regulations and
// route map. Loads as a classic script (window.IntelCheck) or with require() in Node.
(function(root){
  'use strict';
  const Kit=typeof module==='object'&&module.exports?require('../../shared/minigames/minigame-kit.js'):root.MiniGameKit;

  // ---- lore -------------------------------------------------------------------------------------------------------
  // Depots sit in the regions of docs/design/worlds.md; each world's three fronts are held by a named lieutenant.
  // Specimen species (enemy archetypes) from design-record.md. Logistics ships gear and supplies out to the fronts and
  // biological samples in to the ship's lab; Research checks the paperwork during the day.
  const WORLDS=[
    {name:'Orrowan V',regions:['Kalva','Aleth','Barrena Spread','Marsk'],lts:['Vega','Okafor','Marr']},
    {name:'Sindal II',regions:['Ollun','Ilme','Suhr','Aske'],lts:['Idris','Sato','Brannock']},
    {name:'Iseul III',regions:['Ondu','Ovren Shallows','Nalleun','Arrek'],lts:['Quell','Adeyemi','Thorne']}
  ];
  const FRONTS=['North','East','South'],LAB='lab',LAB_ODDS=0.25;
  // Cargo lines: what the depots make and ship. Ration packs are the bulk filler the packing regulations lean on.
  const CARGO=['ration','kit','shield','medkit','beacon','drone','plate','fuel'],BULK='ration';
  const CARGO_NAMES={ration:['ration pack','ration packs'],kit:['gear kit','gear kits'],shield:['shield cell','shield cells'],medkit:['med kit','med kits'],
    beacon:['nav beacon','nav beacons'],drone:['repair drone','repair drones'],plate:['armour plate','armour plates'],fuel:['fuel cell','fuel cells']};
  // Specimen crates bound for the lab carry the species' silhouette, its element colour and glyph, and its pips.
  const ENEMIES=['chaff','bruiser','warden','cleanser','reflector','anchor','bulwark','quickstep'];
  const ELEMENTS=['order','chaos','growth','void','decay','energy'];
  // Silhouette detail: each species' label carries this many pips. The field guide prints them.
  const PIPS={chaff:3,bruiser:2,warden:1,cleanser:2,reflector:3,anchor:1,bulwark:2,quickstep:1};
  // Handling: how each depot packed today's batch. The production log records it; the manifest must agree.
  const CONDITIONS=['Cold-chain packed','Shock-mounted','Vacuum-sealed','Rad-shielded','Hazmat class 2','Double-strapped',
    'Desiccant-packed','Magnetically locked','Nitrogen-flushed','Fragile: ride upright'];
  const BASES=['VESKA','ORRIN','TALLO','MERRO','KESSIK','HALVE','CORVA','LUMEN','SADE','PELL','DUNMOR','ISKE'];
  const DEPTS=['Freight','Stores','Ordnance','Medical','Fuel','Survey'];
  const SEAL_GLYPHS=['ring','bar','cross','dot','chevron','diamond'];
  const SEAL_RINGS=['gold','silver','teal','crimson'];
  const WAVES=['peak','dip','flat','step'];
  const OUTER=['the Rim','the Deep'];
  const MADE=20,CAP=12,CURFEW={from:22*60,to:6*60},WATCH_SPLIT=12*60,MAINT={from:14*60,to:14*60+30},SPACING=45,SWARM=5,FEW=2;
  const WATCHES=['First shift 00:00–11:59','Second shift 12:00–23:59'];
  const WATCH_NAMES=['first shift','second shift'];

  // Each level adds documents and rules (the Papers, Please progression). checks: the visual checks in play.
  const DIFFICULTIES=[
    {id:'easy',label:'Easy · roster, transponders, field guide',target:75,reports:[5,6],roster:2,docs:['roster','freq','guide'],checks:['guide'],tells:0,watches:false,
      intro:{docs:['guide'],rules:[]},newKinds:['guide-el','guide-glyph','guide-pips'],
      newRule:{doc:'guide',text:'Check callsigns, transponder codes, and every specimen crate against the field guide.'}},
    {id:'normal',label:'Normal · + production log, seals',target:95,reports:[6,6],roster:3,docs:['roster','freq','guide','sensor'],checks:['guide','seal'],tells:0,watches:false,
      intro:{docs:['sensor'],rules:['roster']},newKinds:['sensor-type','sensor-cond','seal'],
      newRule:{doc:'sensor',text:'Cargo and handling must match what the depot made today; seals must match the roster.'}},
    {id:'hard',label:'Hard · + regulations, signatures, scans',target:130,reports:[8,8],roster:3,docs:['roster','freq','guide','sensor','rules'],checks:['guide','seal','sig','snap'],tells:2,watches:false,
      intro:{docs:['rules'],rules:['freq','sensor']},newKinds:['tells','sig','snap-type','snap-count'],
      newRule:{doc:'rules',text:'Shipping regulations, transponder signatures and cargo scans join the desk.'}},
    {id:'expert',label:'Expert · + shifts, routes, codes, log',target:170,reports:[9,10],roster:3,docs:['roster','freq','guide','sensor','rules','map','auth','log'],checks:['guide','seal','sig','snap','map','auth','log'],tells:3,watches:true,
      intro:{docs:['map','auth','log'],rules:['freq']},newKinds:['watch','approach','auth','auth-watch','overlap','contradict'],
      newRule:{doc:'freq',text:'Transponders and codes change at noon; check the route map and today’s log.'}},
    {id:'veteran',label:'Veteran · everything, 5 tells',target:240,reports:[12,14],roster:3,docs:['roster','freq','guide','sensor','rules','map','auth','log'],checks:['guide','seal','sig','snap','map','auth','log'],tells:5,watches:true,
      intro:{docs:[],rules:['rules']},newKinds:['tells'],
      newRule:{doc:'rules',text:'Every document, a long day, and five sabotage tells rolled from the pool of ten.'}}
  ];
  // The night shift at the depot (Endless): manifests keep coming on a Hard-style desk; every night (six manifests) adds
  // or swaps one tell.
  const ENDLESS={id:'endless',label:'Night shift at the depot',target:600,perDay:6,forgedPerDay:2,mistakes:3,seconds:40,maxTells:4,
    base:{id:'endless',label:'Night shift at the depot',target:600,reports:[6,6],roster:3,docs:['roster','freq','guide','sensor','rules'],checks:['guide','seal','sig','snap'],tells:1,watches:false,
      intro:{docs:[],rules:['rules']},newKinds:[],newRule:{doc:'rules',text:''}}};
  const DOC_NAMES={roster:'depot roster',freq:'transponder table',guide:'field guide',sensor:'production log',rules:'shipping regulations',map:'route map',auth:'code table',log:'today’s log'};
  // Which document each kind of entry lives on.
  const ENTRY_DOC={roster:'roster',freq:'freq',sig:'freq',guide:'guide',sensor:'sensor',rule:'rules',map:'map',auth:'auth',log:'log'};
  const TELLS=['pair','curfew','alone','cap','maint','even','swarm','escort','beat','few'];
  const CROSS=['overlap','contradict'];

  // ---- small helpers ----------------------------------------------------------------------------------------------
  // Cargo words: plural(type, n) and kinds(type) for cargo lines; species(type) for specimen crates.
  const plural=(t,n)=>(CARGO_NAMES[t]||[t,t+'s'])[n===1?0:1];
  const kinds=t=>(CARGO_NAMES[t]||[t,t+'s'])[1];
  const Kinds=t=>{const k=kinds(t);return k[0].toUpperCase()+k.slice(1);};
  const species=t=>t==='chaff'?'chaff':t+'s';
  const hhmm=m=>{m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
  const minutes=s=>{const [h,m]=String(s).split(':').map(Number);return h*60+m;};
  const inCurfew=t=>{const m=minutes(t);return m>=CURFEW.from||m<CURFEW.to;};
  const inMaint=t=>{const m=minutes(t);return m>=MAINT.from&&m<MAINT.to;};
  const watchOf=t=>minutes(t)<WATCH_SPLIT?0:1;
  const gap=(a,b)=>Math.abs(minutes(a)-minutes(b));
  const listText=a=>a.length<=1?(a[0]||''):a.slice(0,-1).join(', ')+' and '+a.at(-1);
  const orList=a=>a.length<=1?(a[0]||''):a.slice(0,-1).join(', ')+' or '+a.at(-1);
  const cap1=t=>t.charAt(0).toUpperCase()+t.slice(1);
  const sightText=s=>s.map(x=>`${x.count} ${plural(x.type,x.count)}`).join(', ');
  const order=types=>CARGO.filter(t=>types.includes(t));
  const diffOf=id=>DIFFICULTIES.find(d=>d.id===id)||DIFFICULTIES[0];
  const clone=x=>JSON.parse(JSON.stringify(x));
  const has=(pz,c)=>pz.checks.includes(c);
  const waveText=w=>w.join('·');
  const borders=(pz,R)=>pz.map.edges.filter(e=>e.includes(R)).map(e=>e[0]===R?e[1]:e[0]);
  const adjacent=(pz,R,from)=>borders(pz,R).includes(from);
  const total=rep=>rep.sighting.reduce((a,s)=>a+s.count,0);
  const specs=rep=>rep.specimens||[];
  // Destinations: one of the world's three fronts (each held by a lieutenant), or the ship's lab.
  const frontOf=(pz,d)=>pz.fronts.find(f=>f.id===d)||null;
  const destName=(pz,d)=>d===LAB?'the ship’s lab':`the ${d} front`;
  const destLong=(pz,d)=>d===LAB?'the ship’s lab':`Lt ${frontOf(pz,d).lt}’s ${d} front`;

  // ---- documents and their entries --------------------------------------------------------------------------------
  // Entry ids: roster:<depot> (callsigns and the depot's shipping seal), freq:<depot> (freq:<depot>:<shift> on Expert),
  // sig:<depot>, guide:<species>, sensor:<depot> (production log), rule:<tell>, map:<depot>, auth:<depot>:<shift>,
  // log:<manifest id>.
  function entries(pz){
    const out=[];
    for(const doc of pz.docs){
      if(doc==='rules'){for(const t of pz.rules)out.push('rule:'+t.id);continue;}
      if(doc==='guide'){for(const t of ENEMIES)out.push('guide:'+t);continue;}
      if(doc==='log'){for(const r of pz.reports)out.push('log:'+r.id);continue;}
      for(const r of pz.regions){
        if(doc==='freq'&&pz.watches)out.push('freq:'+r+':0','freq:'+r+':1');
        else if(doc==='auth')out.push('auth:'+r+':0','auth:'+r+':1');
        else out.push(doc+':'+r);
      }
      if(doc==='freq'&&has(pz,'sig'))for(const r of pz.regions)out.push('sig:'+r);
    }
    return out;
  }
  const parseEntry=e=>{const [doc,key,w]=String(e).split(':');return {doc,key,watch:w===undefined?null:Number(w)};};
  const docOfEntry=e=>ENTRY_DOC[parseEntry(e).doc]||null;
  // A manifest's fields, in card order. sight:<i> is a cargo line, spec:<i> a specimen crate (lab shipments only).
  function fields(report){
    return ['region','callsign',...('seal' in report?['seal']:[]),'time','freq',...('auth' in report?['auth']:[]),...('sig' in report?['sig']:[]),
      ...('from' in report?['from']:[]),...report.sighting.map((_,i)=>'sight:'+i),...specs(report).map((_,i)=>'spec:'+i),...('snap' in report?['snap']:[]),'cond'];
  }
  const specAt=(report,f)=>specs(report)[+f.slice(5)];
  function fieldLabel(pz,report,f){
    if(f.startsWith('sight:')){const s=report.sighting[+f.slice(6)];return s?`cargo line “${s.count} ${plural(s.type,s.count)}”`:'cargo line';}
    if(f.startsWith('spec:')){const s=specAt(report,f);return s?`specimen crate “${s.type}”`:'specimen crate';}
    return {region:'origin depot',callsign:'callsign',time:'departure time',freq:'transponder code',cond:'handling',seal:'seal',sig:'transponder signature',snap:'cargo scan',from:'route',auth:'authorisation code'}[f]||f;
  }
  function entryLabel(pz,e){
    const {doc,key,watch}=parseEntry(e);
    if(doc==='rule')return 'the shipping regulations’ tell';
    if(doc==='guide')return `the ${key} entry of the field guide`;
    if(doc==='log'){const r=pz.reports.find(x=>String(x.id)===key);return `manifest ${r?r.no:'?'} in today’s log`;}
    if(doc==='sig')return `${key}’s reference signature on the transponder table`;
    if(doc==='freq'&&watch!==null)return `${key}’s ${WATCH_NAMES[watch]} code on the transponder table`;
    if(doc==='auth')return `${key}’s ${WATCH_NAMES[watch]} code on the code table`;
    return `the ${key} line of the ${DOC_NAMES[ENTRY_DOC[doc]]}`;
  }
  function ruleText(rule){
    const T=rule.type;
    switch(rule.id){
      case 'pair':return `${Kinds(rule.a)} and ${kinds(rule.b)} never ship together. A manifest listing both is sabotage.`;
      case 'curfew':return `Launch pads close overnight, ${hhmm(CURFEW.from)}–${hhmm(CURFEW.to-1)}. A convoy departing then is sabotage.`;
      case 'alone':return `${Kinds(T)} never ship alone. A manifest whose only cargo is ${kinds(T)} is sabotage.`;
      case 'cap':return `No cargo line holds more than ${CAP} crates. A higher count is sabotage.`;
      case 'maint':return `Loading cranes are down for maintenance ${hhmm(MAINT.from)}–${hhmm(MAINT.to-1)}. A departure then is sabotage.`;
      case 'even':return `${Kinds(T)} ship in matched pairs. An odd count of ${kinds(T)} is sabotage.`;
      case 'swarm':return `${Kinds(BULK)} ship by the pallet, at least ${SWARM}. A smaller count is sabotage.`;
      case 'escort':return `${Kinds(T)} are always packed in ${kinds(BULK)}. ${Kinds(T)} with no ${kinds(BULK)} is sabotage.`;
      case 'beat':return `Departures run in five-minute slots (:00, :05, :10 …). A departure at any other minute is sabotage.`;
      case 'few':return `${Kinds(T)} never ship more than ${FEW} at a time. A higher count is sabotage.`;
    }
    return rule.id;
  }
  const freqOf=(pz,region,time)=>pz.watches?pz.freq[region][watchOf(time)]:pz.freq[region];
  const authOf=(pz,region,time)=>pz.auth[region][watchOf(time)];
  const regionOfFreq=(pz,f)=>{for(const r of pz.regions){const v=pz.freq[r];if(Array.isArray(v)?v.includes(f):v===f)return r;}return null;};
  const regionOfCall=(pz,c)=>pz.regions.find(r=>pz.roster[r].includes(c))||null;
  const ruleById=(pz,id)=>pz.rules.find(r=>r.id===id);
  const earlier=(pz,report)=>pz.reports.filter(x=>x.id<report.id);
  const TIME_TELLS=['curfew','maint','beat'];

  // ---- the tells: one checker per rule ----------------------------------------------------------------------------
  // tellCheck(rule, manifest, field) → null when the tell is not about that field, else {bad, text}.
  function tellCheck(rule,report,field){
    const types=report.sighting.map(s=>s.type),T=rule.type;
    if(field==='time'){
      const t=report.time;
      if(rule.id==='curfew')return inCurfew(t)?{bad:true,text:`Departs at ${t}, while the launch pads are closed (${hhmm(CURFEW.from)}–${hhmm(CURFEW.to-1)}).`}:{bad:false,text:`${t} is outside the overnight closure.`};
      if(rule.id==='maint')return inMaint(t)?{bad:true,text:`Departs at ${t}, while the loading cranes are down for maintenance (${hhmm(MAINT.from)}–${hhmm(MAINT.to-1)}).`}:{bad:false,text:`${t} is outside the crane maintenance window.`};
      if(rule.id==='beat')return minutes(t)%5?{bad:true,text:`Departs at ${t}: outside the five-minute slots.`}:{bad:false,text:`${t} is on a five-minute slot.`};
      return null;
    }
    if(!field.startsWith('sight:'))return null;
    const s=report.sighting[+field.slice(6)];if(!s)return null;
    switch(rule.id){
      case 'pair':if(s.type!==rule.a&&s.type!==rule.b)return null;
        return types.includes(rule.a)&&types.includes(rule.b)?{bad:true,text:`The manifest lists ${kinds(rule.a)} and ${kinds(rule.b)} together.`}
          :{bad:false,text:`${Kinds(s.type)} without ${kinds(s.type===rule.a?rule.b:rule.a)}: allowed.`};
      case 'alone':if(s.type!==T)return null;
        return types.length===1?{bad:true,text:`${Kinds(T)} are the only cargo.`}:{bad:false,text:`${Kinds(T)} with other cargo: allowed.`};
      case 'cap':return s.count>CAP?{bad:true,text:`${s.count} ${plural(s.type,s.count)} is more than ${CAP} crates on one line.`}:{bad:false,text:`${s.count} is within the ${CAP}-crate line limit.`};
      case 'even':if(s.type!==T)return null;
        return s.count%2?{bad:true,text:`${s.count} ${plural(T,s.count)} is an odd count; they ship in matched pairs.`}:{bad:false,text:`${s.count} ${plural(T,s.count)}: an even count.`};
      case 'swarm':if(s.type!==BULK)return null;
        return s.count<SWARM?{bad:true,text:`Only ${s.count} ${plural(BULK,s.count)}; they ship by the pallet, at least ${SWARM}.`}:{bad:false,text:`${s.count} ${plural(BULK,s.count)} make a full pallet.`};
      case 'escort':if(s.type!==T)return null;
        return types.includes(BULK)?{bad:false,text:`${Kinds(T)} packed in ${kinds(BULK)}: allowed.`}:{bad:true,text:`${Kinds(T)} listed with no ${kinds(BULK)}.`};
      case 'few':if(s.type!==T)return null;
        return s.count>FEW?{bad:true,text:`${s.count} ${plural(T,s.count)} is more than ${FEW} at a time.`}:{bad:false,text:`${s.count} ${plural(T,s.count)} is within ${FEW}.`};
    }
    return null;
  }

  // ---- the visual checks ------------------------------------------------------------------------------------------
  // A specimen crate's label against the field guide: the element colour, the glyph, the silhouette's pips.
  function iconCheck(pz,s){
    const g=pz.guide[s.type];
    if(!g.els.includes(s.el))return {rule:'guide-el',text:`A ${s.el} ${s.type} sample: the field guide lists ${species(s.type)} as ${orList(g.els.map(cap1))} only.`};
    if(s.glyph!==s.el)return {rule:'guide-glyph',text:`The ${s.type} label is ${s.el}-coloured but carries the ${s.glyph} glyph.`};
    if(s.pips!==PIPS[s.type])return {rule:'guide-pips',text:`The ${s.type} silhouette shows ${s.pips} pip${s.pips===1?'':'s'}; the field guide’s ${s.type} has ${PIPS[s.type]}.`};
    return null;
  }
  function sealCheck(pz,R,seal){
    const want=pz.seals[R];
    if(seal.dept!==want.dept)return `The seal is ${seal.dept}; the ${R} depot ships under ${want.dept}.`;
    if(seal.points!==want.points)return `The seal has ${seal.points} points; ${R}’s ${want.dept} seal has ${want.points}.`;
    if(seal.glyph!==want.glyph)return `The seal’s inner glyph is a ${seal.glyph}; ${R}’s ${want.dept} seal has a ${want.glyph}.`;
    if(seal.ring!==want.ring)return `The seal’s ring is ${seal.ring}; ${R}’s ${want.dept} seal has a ${want.ring} ring.`;
    return null;
  }
  // The cargo scan: an X-ray of the supply crates (specimen crates are shielded and do not show).
  function snapCheck(pz,R,report){
    const blips=report.snap.blips,types=new Set(report.sighting.map(s=>s.type)),seen=new Set(blips.map(b=>b.type)),prec=pz.sensor[R].prec;
    const extra=[...seen].filter(t=>!types.has(t)),missing=[...types].filter(t=>!seen.has(t));
    if(extra.length)return {rule:'snap-type',text:`The scan shows ${kinds(extra[0])}, which the manifest never lists.`};
    if(missing.length)return {rule:'snap-type',text:`The scan shows no ${kinds(missing[0])}, but the manifest lists them.`};
    const n=blips.length,t=total(report);
    if(Math.abs(n-t)>prec)return {rule:'snap-count',text:`The scan shows ${n} crates; the manifest counts ${t}, and ${R}’s scanner is good to ±${prec}.`};
    return null;
  }
  function crossChecks(pz,report){
    const out=[],prev=earlier(pz,report);
    const o=prev.find(x=>x.callsign===report.callsign&&gap(x.time,report.time)<SPACING);
    if(o)out.push({rule:'overlap',field:'callsign',entry:'log:'+o.id});
    if('from' in report&&adjacent(pz,report.region,report.from)){
      const c=prev.find(x=>x.region===report.region&&adjacent(pz,x.region,x.from)&&x.from!==report.from);
      if(c)out.push({rule:'contradict',field:'from',entry:'log:'+c.id});
    }
    return out;
  }

  // ---- the independent checker ------------------------------------------------------------------------------------
  // audit lists every rule a manifest breaks, straight from the documents. Genuine → [], sabotaged → exactly one.
  function audit(pz,report){
    const out=[],R=report.region,doc=d=>pz.docs.includes(d);
    if(!pz.roster[R].includes(report.callsign))out.push({rule:'roster',field:'callsign',entry:'roster:'+R});
    if('seal' in report&&sealCheck(pz,R,report.seal))out.push({rule:'seal',field:'seal',entry:'roster:'+R});
    if(report.freq!==freqOf(pz,R,report.time))out.push({rule:pz.watches&&pz.freq[R].includes(report.freq)?'watch':'freq',field:'freq',entry:pz.watches?`freq:${R}:${watchOf(report.time)}`:'freq:'+R});
    if('sig' in report&&waveText(report.sig)!==waveText(pz.sig[R]))out.push({rule:'sig',field:'sig',entry:'sig:'+R});
    if('auth' in report&&report.auth!==authOf(pz,R,report.time))out.push({rule:pz.auth[R].includes(report.auth)?'auth-watch':'auth',field:'auth',entry:`auth:${R}:${watchOf(report.time)}`});
    if('from' in report&&!adjacent(pz,R,report.from))out.push({rule:'approach',field:'from',entry:'map:'+R});
    if(doc('guide'))specs(report).forEach((s,i)=>{const c=iconCheck(pz,s);if(c)out.push({rule:c.rule,field:'spec:'+i,entry:'guide:'+s.type});});
    if(doc('sensor')){
      report.sighting.forEach((s,i)=>{if(!pz.sensor[R].types.includes(s.type))out.push({rule:'sensor-type',field:'sight:'+i,entry:'sensor:'+R});});
      if(report.cond!==pz.sensor[R].cond)out.push({rule:'sensor-cond',field:'cond',entry:'sensor:'+R});
      if('snap' in report){const c=snapCheck(pz,R,report);if(c)out.push({rule:c.rule,field:'snap',entry:'sensor:'+R});}
    }
    if(doc('rules'))for(const rule of pz.rules){
      // A tell about the cargo as a whole (pair, alone, escort) is pinned to one line; a count tell to each bad count.
      const fs=(TIME_TELLS.includes(rule.id)?['time']:report.sighting.map((_,i)=>'sight:'+i)).filter(f=>tellCheck(rule,report,f)?.bad);
      if(!fs.length)continue;
      const types=report.sighting.map(s=>s.type);
      const pin=rule.id==='pair'?'sight:'+types.indexOf(rule.a):rule.id==='alone'?'sight:0':rule.id==='escort'?'sight:'+types.indexOf(rule.type):null;
      (pin?[pin]:fs).forEach(f=>out.push({rule:rule.id,field:f,entry:'rule:'+rule.id}));
    }
    if(doc('log'))out.push(...crossChecks(pz,report));
    return out;
  }

  // Whether a field is ever checked against a document (for "wrong line" versus "not comparable").
  function relevant(field,doc){
    const f=field.startsWith('sight:')?'sight':field.startsWith('spec:')?'spec':field;
    return ({callsign:['roster'],seal:['roster'],freq:['freq'],time:['freq','auth'],sig:['sig'],auth:['auth'],from:['map'],sight:['sensor'],spec:['guide'],cond:['sensor'],snap:['sensor']}[f]||[]).includes(doc);
  }
  // compare is what the player does: one manifest field against one document entry.
  // result: 'mismatch' (evidence), 'match', 'wrongline' (right document, another depot, shift or species), 'unrelated'.
  function compare(pz,report,field,entry){
    const {doc,key,watch}=parseEntry(entry),R=report.region,F=fieldLabel(pz,report,field);
    const wrong=text=>({result:'wrongline',text}),miss=(rule,text)=>({result:'mismatch',rule,text}),ok=text=>({result:'match',text});
    const unrelated=()=>({result:'unrelated',text:`The ${F} can’t be checked against ${doc==='rule'?'that tell':doc==='log'?'that log line':'the '+DOC_NAMES[ENTRY_DOC[doc]]}.`});
    const regional=['roster','freq','sig','sensor','map','auth'].includes(doc);
    if(regional&&key!==R)return field==='region'||relevant(field,doc)?wrong(`That is the ${key} line; this manifest comes from ${R}.`):unrelated();
    if(field==='region')return regional?ok(`The ${R} depot has a line on the ${DOC_NAMES[ENTRY_DOC[doc]]}.`):{result:'unrelated',text:`The ${DOC_NAMES[ENTRY_DOC[doc]]} does not list depots.`};
    if(field==='callsign'&&doc==='roster'){
      if(pz.roster[R].includes(report.callsign))return ok(`${report.callsign} is on the ${R} roster.`);
      const elsewhere=regionOfCall(pz,report.callsign);
      return miss('roster',`Callsign ${report.callsign} isn’t on the ${R} roster${elsewhere?` (it is a ${elsewhere} callsign)`:''}.`);
    }
    if(field==='seal'&&doc==='roster'){const t=sealCheck(pz,R,report.seal);return t?miss('seal',t):ok(`The seal matches the ${R} depot’s ${report.seal.dept} seal.`);}
    if(field==='freq'&&doc==='freq'){
      const want=freqOf(pz,R,report.time);
      if(pz.watches&&watch!==watchOf(report.time))return wrong(`That is ${R}’s ${WATCH_NAMES[watch]} code; this convoy departs at ${report.time}, in the ${WATCH_NAMES[watchOf(report.time)]}.`);
      if(report.freq===want)return ok(`${report.freq} is ${R}’s ${pz.watches?WATCH_NAMES[watchOf(report.time)]+' ':''}transponder code.`);
      if(pz.watches&&pz.freq[R].includes(report.freq))return miss('watch',`${report.freq} is ${R}’s ${WATCH_NAMES[1-watchOf(report.time)]} transponder code, but the convoy departs at ${report.time} (${WATCH_NAMES[watchOf(report.time)]}: ${want}).`);
      const other=regionOfFreq(pz,report.freq);
      return miss('freq',`Transponder ${report.freq} isn’t ${R}’s code (${want})${other?`; it belongs to ${other}`:''}.`);
    }
    if(field==='time'&&(doc==='freq'||doc==='auth')&&watch!==null){
      return watch===watchOf(report.time)?ok(`Departs at ${report.time}: the ${WATCH_NAMES[watch]} column applies.`)
        :wrong(`Departing at ${report.time} is in the ${WATCH_NAMES[watchOf(report.time)]}, not the ${WATCH_NAMES[watch]}.`);
    }
    if(field==='sig'&&doc==='sig'){
      const want=pz.sig[R],i=report.sig.findIndex((x,k)=>x!==want[k]);
      return i<0?ok(`The transponder signature matches ${R}’s reference.`):miss('sig',`Signature segment ${i+1} is a ${report.sig[i]}; ${R}’s reference has a ${want[i]} there.`);
    }
    if(field==='auth'&&doc==='auth'){
      const w=watchOf(report.time),want=pz.auth[R][w];
      if(watch!==w)return wrong(`That is ${R}’s ${WATCH_NAMES[watch]} code; this convoy departs at ${report.time}, in the ${WATCH_NAMES[w]}.`);
      if(report.auth===want)return ok(`${report.auth} is ${R}’s ${WATCH_NAMES[w]} code.`);
      if(pz.auth[R].includes(report.auth))return miss('auth-watch',`${report.auth} is ${R}’s ${WATCH_NAMES[1-w]} code, but the convoy departs at ${report.time} (${WATCH_NAMES[w]}: ${want}).`);
      return miss('auth',`Code ${report.auth} isn’t ${R}’s ${WATCH_NAMES[w]} code (${want}).`);
    }
    if(field==='from'&&doc==='map'){
      const b=borders(pz,R);
      return b.includes(report.from)?ok(`${R} has a route out via ${report.from}.`):miss('approach',`${cap1(report.from)} doesn’t connect to ${R}; only ${listText(b)} do.`);
    }
    if(field.startsWith('spec:')&&doc==='guide'){
      const s=specAt(report,field);
      if(s.type!==key)return wrong(`That is the ${key} entry; this crate holds a ${s.type} specimen.`);
      const c=iconCheck(pz,s);return c?miss(c.rule,c.text):ok(`A ${s.el} ${s.type} with ${s.pips} pip${s.pips===1?'':'s'}: as the field guide shows.`);
    }
    if(field.startsWith('sight:')&&doc==='sensor'){
      const s=report.sighting[+field.slice(6)];
      return pz.sensor[R].types.includes(s.type)?ok(`The ${R} depot made ${kinds(s.type)} today.`):miss('sensor-type',`The ${R} depot made no ${kinds(s.type)} today.`);
    }
    if(field==='cond'&&doc==='sensor'){
      return report.cond===pz.sensor[R].cond?ok(`${R}’s production log confirms “${report.cond}”.`):miss('sensor-cond',`${R}’s production log reads “${pz.sensor[R].cond}”, not “${report.cond}”.`);
    }
    if(field==='snap'&&doc==='sensor'){
      const c=snapCheck(pz,R,report);
      return c?miss(c.rule,c.text):ok(`The scan shows ${report.snap.blips.length} crates of the listed kinds; the manifest counts ${total(report)} (±${pz.sensor[R].prec}).`);
    }
    if(doc==='rule'){
      const rule=ruleById(pz,key),c=rule&&tellCheck(rule,report,field);
      if(!c)return {result:'unrelated',text:`That tell is not about the ${F}.`};
      return c.bad?miss(rule.id,c.text):ok(c.text);
    }
    if(doc==='log'){
      const x=pz.reports.find(y=>String(y.id)===key);
      if(!x||x.id>=report.id)return {result:'unrelated',text:'That manifest isn’t in the log yet.'};
      if(field==='callsign'){
        if(x.callsign!==report.callsign)return {result:'unrelated',text:`Manifest ${x.no} was ${x.callsign}, another convoy.`};
        const g=gap(x.time,report.time);
        return g<SPACING?miss('overlap',`${report.callsign} also departed ${x.region} at ${x.time} (manifest ${x.no}): one convoy can’t launch twice within ${SPACING} minutes.`)
          :ok(`${report.callsign} last departed at ${x.time}, ${g} minutes apart: time enough.`);
      }
      if(field==='from'&&'from' in report){
        if(x.region!==R)return wrong(`Manifest ${x.no} left from ${x.region}; this convoy leaves ${R}.`);
        if(!adjacent(pz,R,report.from)||!adjacent(pz,R,x.from))return {result:'unrelated',text:'Check the route map first: one of these routes doesn’t connect to the depot.'};
        return x.from===report.from?ok(`Manifest ${x.no} also routes ${R}’s convoys out via ${x.from}.`)
          :miss('contradict',`Manifest ${x.no} routes ${R}’s convoys out via ${x.from} today; this one says ${report.from}.`);
      }
      return unrelated();
    }
    return unrelated();
  }

  // ---- one-tap checks ---------------------------------------------------------------------------------------------
  // checksFor lists every document line a manifest field must agree with. One tap on a field runs all of them; Check
  // all runs them for every field. A sabotaged manifest's planted line is always among its field's checks (unit-tested).
  function checksFor(pz,report,field){
    const R=report.region,doc=d=>pz.docs.includes(d),out=[];
    if(field==='region')return ['roster:'+R];
    if(field==='callsign'){
      out.push('roster:'+R);
      if(doc('log'))for(const x of earlier(pz,report))if(x.callsign===report.callsign)out.push('log:'+x.id);
    }
    if(field==='seal')out.push('roster:'+R);
    if(field==='freq')out.push(pz.watches?`freq:${R}:${watchOf(report.time)}`:'freq:'+R);
    if(field==='time'&&pz.watches)out.push(`freq:${R}:${watchOf(report.time)}`);
    if(field==='sig')out.push('sig:'+R);
    if(field==='auth')out.push(`auth:${R}:${watchOf(report.time)}`);
    if(field==='from'){
      out.push('map:'+R);
      if(doc('log'))for(const x of earlier(pz,report))if(x.region===R)out.push('log:'+x.id);
    }
    if((field==='cond'||field==='snap')&&doc('sensor'))out.push('sensor:'+R);
    if(field.startsWith('sight:')){
      const s=report.sighting[+field.slice(6)];if(!s)return out;
      if(doc('sensor'))out.push('sensor:'+R);
    }
    if(field.startsWith('spec:')){const s=specAt(report,field);if(s&&doc('guide'))out.push('guide:'+s.type);}
    if(doc('rules')&&(field==='time'||field.startsWith('sight:')))for(const rule of pz.rules)if(tellCheck(rule,report,field))out.push('rule:'+rule.id);
    return out;
  }
  // checkField: the verdict of one tap, without changing state. 'bad' carries the first contradicting line.
  function checkField(pz,report,field){
    const results=checksFor(pz,report,field).map(entry=>({entry,...compare(pz,report,field,entry)}));
    const bad=results.find(x=>x.result==='mismatch'),good=results.filter(x=>x.result==='match');
    return {field,state:!results.length?'none':bad?'bad':'ok',entry:bad?bad.entry:results[0]?.entry||null,text:bad?bad.text:(good.length?good:results).map(x=>x.text).join(' '),rule:bad?bad.rule:null,results};
  }
  // What the player should compare instead after a wrong-line or unrelated comparison: one gentle line.
  function suggest(pz,report,field){
    const ks=checksFor(pz,report,field).filter(e=>parseEntry(e).doc!=='log');
    if(!ks.length)return `The ${fieldLabel(pz,report,field)} has nothing to check against at this level.`;
    return `Compare the ${fieldLabel(pz,report,field)} with ${listText(ks.map(e=>entryLabel(pz,e)))}.`;
  }
  function explain(pz,report,field,entry){
    const c=compare(pz,report,field,entry);
    return c.result==='wrongline'||c.result==='unrelated'?{...c,text:c.text+' '+suggest(pz,report,field)}:c;
  }

  // Assist tiers: Classic is two-tap only; Quick adds one-tap and Check all (Check all caps the round at Good);
  // Relaxed makes Check all free.
  const ASSISTS=[{id:'classic',label:'Classic',text:'Tap a manifest field, then the line it should match.',oneTap:false,freeCheckAll:false},
    {id:'quick',label:'Quick',text:'One tap compares a field. Check all caps the round at Good.',oneTap:true,freeCheckAll:false},
    {id:'relaxed',label:'Relaxed',text:'One tap compares a field, and Check all is free.',oneTap:true,freeCheckAll:true}];
  const assistOf=id=>ASSISTS.find(a=>a.id===id)||ASSISTS[1];

  // ---- citations (Papers, Please): a slip for every wrong stamp, at once ------------------------------------------
  const RULE_NAMES={roster:'the depot roster',freq:'the transponder table',watch:'the shift change','sensor-type':'the production log’s cargo',
    'sensor-cond':'the production log’s handling',pair:'the forbidden pair',curfew:'the overnight closure',alone:'the never-alone rule',cap:'the line limit',
    maint:'the crane maintenance window',even:'the matched-pairs rule',swarm:'the pallet rule',escort:'the packing rule',beat:'the five-minute slots',few:'the few-at-a-time rule',
    'guide-el':'the field guide’s elements','guide-glyph':'the element glyphs','guide-pips':'the silhouette pips',seal:'the seals',sig:'the transponder signatures',
    'snap-type':'the scan’s cargo kinds','snap-count':'the scan count',approach:'the route map',auth:'the code table','auth-watch':'the code change at noon',
    overlap:'the one-convoy-one-launch rule',contradict:'today’s log'};
  // Lower-case a leading word for mid-sentence use, but never a callsign or other all-caps code.
  const lcFirst=t=>/^[A-Z][a-z]/.test(t)?t.charAt(0).toLowerCase()+t.slice(1):t;
  const nth=n=>['first','second','third','fourth','fifth'][n-1]||n+'th';
  function citation(pz,st,i){
    const rep=pz.reports[i],v=st.stamps[i];
    if(!rep||!v||(v==='forged')===rep.forged)return null;
    if(rep.forged){
      const rule=rep.tell.rule,before=pz.reports.filter((x,j)=>j<i&&x.forged&&st.stamps[j]==='verified'&&x.tell.rule===rule).length;
      const why=compare(pz,rep,rep.tell.field,rep.tell.entry).text;
      return {report:i,kind:'approved',rule,repeat:before+1,field:rep.tell.field,entry:rep.tell.entry,
        text:`CITATION · Manifest ${rep.no} was Null sabotage: ${lcFirst(why)}${before?` That is the ${nth(before+1)} time ${RULE_NAMES[rule]||'this rule'} caught you.`:''}`};
    }
    const before=pz.reports.filter((x,j)=>j<i&&!x.forged&&st.stamps[j]==='forged').length;
    const fs=fields(rep).filter(f=>f!=='region'&&checksFor(pz,rep,f).length);
    if(rep.trap)fs.sort((a,b)=>(b===rep.trap.field)-(a===rep.trap.field));
    const ok=fs.slice(0,3).map(f=>checkField(pz,rep,f).results.find(x=>x.result==='match')).filter(Boolean).map(x=>lcFirst(x.text.replace(/\.$/,'')));
    const field=rep.trap?rep.trap.field:fs[0]||'callsign',entry=rep.trap?rep.trap.entry:checksFor(pz,rep,field)[0];
    return {report:i,kind:'shredded',rule:'genuine',repeat:before+1,field,entry,
      text:`CITATION · Manifest ${rep.no} was genuine: ${ok.join('; ')}.${before?` That is the ${nth(before+1)} genuine convoy you held back.`:''}`};
  }
  // Every citation earned so far, in manifest order.
  const citations=(pz,st)=>pz.reports.map((_,i)=>i<st.cursor?citation(pz,st,i):null).filter(Boolean);

  // ---- the live consequence tick ------------------------------------------------------------------------------------
  function tick(pz,st){
    const i=st.cursor-1;if(i<0)return {text:'No convoy is loading yet.',bad:false,report:null};
    const rep=pz.reports[i],to=destName(pz,rep.dest);
    if(st.stamps[i]==='verified')return {report:i,bad:rep.forged,
      text:`Convoy ${rep.callsign} is loading for ${to} based on manifest ${rep.no}${rep.forged?': sabotaged paperwork.':'.'}`};
    return {report:i,bad:!rep.forged,text:rep.forged?`Convoy ${rep.callsign} is held at the ${rep.region} depot: manifest ${rep.no} was stopped.`
      :`Convoy ${rep.callsign} is grounded at the ${rep.region} depot: manifest ${rep.no} was stopped, and ${to} waits.`};
  }

  // ---- generation: documents ----------------------------------------------------------------------------------------
  function makeFreqs(r,n){
    const base=r.range(40,45),seen=new Set(),out=[];
    while(out.length<n){const v=(base+r.int(3))+'.'+r.int(10);if(!seen.has(v)){seen.add(v);out.push(v);}}
    return out;
  }
  function makeRoster(r,regions,per){
    // Bases repeat across regions with different digits so a genuine callsign can look like another region's.
    const bases=r.shuffle(BASES).slice(0,Math.ceil(regions.length*per*0.6)),used=new Set(),roster={};
    let k=0;
    for(const R of regions){
      roster[R]=[];
      while(roster[R].length<per){
        const b=bases[k++%bases.length],c=`${b}-${r.range(2,9)}`;
        if(used.has(c)||roster[R].some(x=>x.split('-')[0]===b))continue;
        used.add(c);roster[R].push(c);
      }
    }
    return roster;
  }
  // Seals: one shipping department per depot; details overlap across the desk so a forged seal is one detail off.
  function makeSeals(r,regions){
    const depts=r.shuffle(DEPTS),seals={},glyphs=r.shuffle(SEAL_GLYPHS).slice(0,3),rings=r.shuffle(SEAL_RINGS).slice(0,2);
    regions.forEach((R,i)=>{seals[R]={dept:depts[i],points:r.range(5,8),glyph:r.pick(glyphs),ring:r.pick(rings)};});
    return seals;
  }
  // Reference transponder signatures: six segments each, any two depots at least two segments apart.
  function makeSigs(r,regions){
    for(;;){
      const sig={};regions.forEach(R=>{sig[R]=[...Array(6)].map(()=>r.pick(WAVES));});
      const ok=regions.every((a,i)=>regions.slice(i+1).every(b=>sig[a].filter((x,k)=>x!==sig[b][k]).length>=2));
      if(ok)return sig;
    }
  }
  // Route map: the four depots in a ring (opposites never connect) plus two outer sectors touching one or two each.
  function makeMap(r,regions){
    const ring=r.shuffle(regions),edges=[];
    ring.forEach((R,i)=>edges.push([R,ring[(i+1)%ring.length]]));
    for(const o of OUTER){const n=r.range(1,2);for(const R of r.shuffle(regions).slice(0,n))edges.push([R,o]);}
    return {ring,nodes:[...ring,...OUTER],edges};
  }
  function makeAuth(r,regions){
    const L='ABCDEFGHJKLMNPRSTVWXZ',used=new Set(),auth={};
    for(const R of regions){
      let p;do{p=L[r.int(L.length)]+L[r.int(L.length)];}while(used.has(p));used.add(p);
      const a=r.range(100,999);let b;do{b=r.range(100,999);}while(b===a);
      auth[R]=[`${p}-${a}`,`${p}-${b}`];
    }
    return auth;
  }
  // Field guide: each species carries two of the six elements, rolled per round. Chaff are never chaos.
  function makeGuide(r){
    const g={};
    for(const t of ENEMIES){const pool=t==='chaff'?ELEMENTS.filter(e=>e!=='chaos'):ELEMENTS,two=r.shuffle(pool).slice(0,2);g[t]={els:ELEMENTS.filter(e=>two.includes(e))};}
    return g;
  }
  const TYPED={alone:['beacon','plate'],even:['kit','shield','drone','fuel'],escort:['shield','medkit','drone'],few:['fuel','beacon','plate','medkit']};
  function makeRules(r,count,pool=TELLS){
    if(!count)return [];
    const picks=[];
    for(const id of r.shuffle(pool)){
      if(picks.length>=count)break;
      const rule={id},used=t=>picks.some(p=>p.type===t||p.a===t||p.b===t);
      if(id==='pair'){const [a,b]=order(r.shuffle(CARGO.filter(t=>t!==BULK&&!used(t))).slice(0,2));rule.a=a;rule.b=b;}
      if(TYPED[id]){rule.type=r.pick(TYPED[id].filter(t=>!used(t)));if(!rule.type)continue;}
      picks.push(rule);
    }
    return TELLS.filter(t=>picks.some(p=>p.id===t)).map(id=>picks.find(p=>p.id===id)).map(x=>({...x,text:ruleText(x)}));
  }
  // Production log: what each depot made today (with how many), the handling of the batch, and the scanner's precision.
  function makeSensor(r,regions,rules){
    const conds=r.shuffle(CONDITIONS),sensor={};
    regions.forEach((R,i)=>{
      const n=r.range(3,4),types=new Set(r.chance(0.75)?[BULK]:[]);
      for(const t of r.shuffle(CARGO))if(types.size<n)types.add(t);
      sensor[R]={types:order([...types]),cond:conds[i],prec:r.range(1,3)};
    });
    // Plant what the tells need: one depot made both pair types; every typed tell's type is made with ration packs.
    const pair=rules.find(x=>x.id==='pair');
    if(pair){const R=r.pick(regions);sensor[R].types=order([...new Set([...sensor[R].types,pair.a,pair.b])]);}
    for(const rule of rules)if(rule.type){const R=r.pick(regions);sensor[R].types=order([...new Set([...sensor[R].types,rule.type,BULK])]);}
    if(!regions.some(R=>sensor[R].types.includes(BULK))){const R=r.pick(regions);sensor[R].types=order([...sensor[R].types,BULK]);}
    // Quantities made: always more than any one manifest can carry, so they never decide a check.
    for(const R of regions){sensor[R].made={};for(const t of sensor[R].types)sensor[R].made[t]=MADE+r.int(21);}
    return sensor;
  }

  // ---- generation: reports ----------------------------------------------------------------------------------------
  const countFor=(r,t)=>t===BULK?r.range(SWARM,CAP):r.range(1,4);
  // A cargo line: a kind of supply and how many crates of it.
  const sightItem=(r,pz,type,count)=>({type,count});
  // A specimen crate: the species' silhouette in one of its field-guide elements, the matching glyph, and its pips.
  function specItem(r,pz,type){
    const els=pz.guide[type].els,el=r?r.pick(els):els[0];
    return {type,el,glyph:el,pips:PIPS[type]};
  }
  // Lab shipments carry one or two specimen crates beside their cargo (four items at most on the card).
  function addSpecimens(r,pz,rep){
    if(rep.dest!==LAB||!pz.docs.includes('guide')){delete rep.specimens;return;}
    const n=Math.max(1,Math.min(2,4-rep.sighting.length)),picked=r.shuffle(ENEMIES).slice(0,n);
    rep.specimens=ENEMIES.filter(t=>picked.includes(t)).map(t=>specItem(r,pz,t));
  }
  // retime moves a manifest's departure and keeps the transponder and code in step; on a slot unless told otherwise.
  function retime(pz,rep,m,offBeat){
    m=((m%1440)+1440)%1440;
    if(ruleById(pz,'beat')&&!offBeat)m-=m%5;
    rep.time=hhmm(m);rep.freq=freqOf(pz,rep.region,rep.time);if('auth' in rep)rep.auth=authOf(pz,rep.region,rep.time);
  }
  // conform makes a genuine manifest's counts obey the count tells (matched pairs, few at a time).
  function conform(pz,rep){
    const ev=ruleById(pz,'even'),few=ruleById(pz,'few');
    for(const s of rep.sighting){
      if(few&&s.type===few.type)s.count=Math.min(s.count,FEW);
      if(ev&&s.type===ev.type&&s.count%2)s.count=s.count+1<=(few&&few.type===s.type?FEW:CAP)?s.count+1:s.count-1;
    }
  }
  // The cargo scan: one crate per item, give or take the depot's scanner precision. mode: ok | edge | count | type.
  function makeSnap(r,pz,rep,mode='ok'){
    const prec=pz.sensor[rep.region].prec,types=rep.sighting.map(s=>s.type),t=total(rep);
    const d=mode==='edge'?(r.chance(0.5)?prec:-prec):mode==='count'?(r.chance(0.5)?1:-1)*r.range(prec+2,prec+4):r.range(-prec,prec);
    let n=t+d;if(n<types.length)n=t+Math.abs(d);
    const out=types.slice(),weights=rep.sighting.flatMap(s=>Array(s.count).fill(s.type));
    while(out.length<n)out.push(r.pick(weights));
    if(mode==='type'){
      const other=r.pick(CARGO.filter(x=>!types.includes(x)));
      const dup=out.findLastIndex((x,k)=>out.indexOf(x)!==k);
      if(dup>=0)out[dup]=other;else out.push(other);
    }
    const blips=out.map(type=>{const a=r.next()*Math.PI*2,rad=0.18+0.72*Math.sqrt(r.next());return {type,x:+(Math.cos(a)*rad).toFixed(3),y:+(Math.sin(a)*rad).toFixed(3)};});
    return {blips:r.shuffle(blips)};
  }

  function baseReport(r,pz,R,id){
    const log=pz.sensor[R].types,pair=ruleById(pz,'pair'),alone=ruleById(pz,'alone'),escort=ruleById(pz,'escort');
    for(let tries=0;tries<40;tries++){
      const n=Math.min(log.length,r.range(1,3));
      let types=order(r.shuffle(log).slice(0,n));
      if(pair&&types.includes(pair.a)&&types.includes(pair.b)){const drop=r.pick([pair.a,pair.b]);types=types.filter(t=>t!==drop);}
      if(escort&&types.includes(escort.type)&&!types.includes(BULK)){if(log.includes(BULK)&&types.length<3)types=order([...types,BULK]);else types=types.filter(t=>t!==escort.type);}
      if(!types.length)continue;
      if(alone&&types.length===1&&types[0]===alone.type)continue;
      const rep={id,no:id+1,region:R,callsign:r.pick(pz.roster[R]),time:'',freq:'',sighting:types.map(t=>sightItem(r,pz,t,countFor(r,t))),cond:pz.sensor[R].cond,dest:r.chance(LAB_ODDS)?LAB:r.pick(FRONTS),forged:false,tell:null,trap:null};
      if(has(pz,'seal'))rep.seal={...pz.seals[R]};
      if(has(pz,'auth'))rep.auth='';
      if(has(pz,'sig'))rep.sig=pz.sig[R].slice();
      if(has(pz,'map'))rep.from=pz.approach[R];
      retime(pz,rep,r.range(6*60,22*60-1));
      conform(pz,rep);
      return rep;
    }
    return null;
  }
  const checkTrap=(pz,rep)=>rep.trap&&compare(pz,rep,rep.trap.field,rep.trap.entry).result==='match';
  function genuine(r,pz,R,trapKinds,id){
    for(let tries=0;tries<80;tries++){
      const rep=baseReport(r,pz,R,id);if(!rep)continue;
      // A near-miss detail, so a genuine manifest never looks obviously clean; it is also where the hint points.
      const kind=r.pick(trapKinds);let snapMode='ok';
      if(kind==='guide')rep.dest=LAB;
      if(kind==='snap'){snapMode='edge';rep.trap={kind,field:'snap',entry:'sensor:'+R};}
      else if(kind!=='guide'&&!plantTrap(r,pz,rep,kind)&&!plantTrap(r,pz,rep,'callsign'))continue;
      conform(pz,rep);addSpecimens(r,pz,rep);
      if(kind==='guide')plantTrap(r,pz,rep,'guide');
      if(has(pz,'snap'))rep.snap=makeSnap(r,pz,rep,snapMode);
      if(audit(pz,rep).length===0&&checkTrap(pz,rep))return rep;
    }
    throw new Error('IntelCheck: could not build a genuine manifest for '+R);
  }
  function addType(r,pz,rep,t,max=3){
    const types=rep.sighting.map(s=>s.type);if(types.includes(t))return types.indexOf(t);
    const all=order([...types.slice(0,max-1),t]);rep.sighting=all.map(x=>rep.sighting.find(s=>s.type===x)||sightItem(r,pz,x,countFor(r,x)));return all.indexOf(t);
  }
  function plantTrap(r,pz,rep,kind){
    const R=rep.region,set=(field,entry)=>{rep.trap={kind,field,entry};return true;},inLog=t=>pz.sensor[R].types.includes(t);
    switch(kind){
      case 'callsign':{
        const twins=pz.roster[R].filter(c=>pz.regions.some(o=>o!==R&&pz.roster[o].some(x=>x.split('-')[0]===c.split('-')[0])));
        if(twins.length)rep.callsign=r.pick(twins);
        return set('callsign','roster:'+R);
      }
      case 'freq':
        if(pz.watches){retime(pz,rep,r.pick([r.range(11*60+40,11*60+59),r.range(12*60,12*60+20)]));return set('freq',`freq:${R}:${watchOf(rep.time)}`);}
        return set('freq','freq:'+R);
      case 'auth':retime(pz,rep,r.pick([r.range(11*60+35,11*60+59),r.range(12*60,12*60+25)]));return set('auth',`auth:${R}:${watchOf(rep.time)}`);
      case 'sensor':{const i=rep.sighting.length-1;return set('sight:'+i,'sensor:'+R);}
      case 'guide':{
        // A specimen label in its less familiar element: allowed, but it looks wrong at a glance.
        const i=r.int(rep.specimens.length),s=rep.specimens[i],els=pz.guide[s.type].els;s.el=s.glyph=els[els.length-1];
        return set('spec:'+i,'guide:'+s.type);
      }
      case 'seal':return set('seal','roster:'+R);
      case 'sig':return set('sig','sig:'+R);
      case 'approach':return set('from','map:'+R);
      case 'curfew':retime(pz,rep,r.pick([r.range(21*60+35,21*60+59),r.range(6*60,6*60+25)]));return set('time','rule:curfew');
      case 'maint':retime(pz,rep,r.pick([r.range(13*60+40,13*60+59),r.range(14*60+30,14*60+50)]));return set('time','rule:maint');
      case 'beat':return set('time','rule:beat');
      case 'pair':{
        // List one half of the forbidden pair: it looks like half a tell.
        const p=ruleById(pz,'pair'),present=rep.sighting.findIndex(s=>s.type===p.a||s.type===p.b);
        if(present>=0)return set('sight:'+present,'rule:pair');
        const two=[p.a,p.b].filter(inLog);if(!two.length||rep.sighting.length>=3)return false;
        const i=addType(r,pz,rep,r.pick(two));return set('sight:'+i,'rule:pair');
      }
      case 'alone':{
        const a=ruleById(pz,'alone');if(!inLog(a.type))return false;
        const other=pz.sensor[R].types.filter(t=>t!==a.type);if(!other.length)return false;
        rep.sighting=order([a.type,r.pick(other)]).map(t=>sightItem(r,pz,t,countFor(r,t)));
        return set('sight:'+rep.sighting.findIndex(s=>s.type===a.type),'rule:alone');
      }
      case 'cap':{const i=r.int(rep.sighting.length);if(rep.sighting[i].type===BULK)rep.sighting[i].count=CAP;return set('sight:'+i,'rule:cap');}
      case 'even':{const t=ruleById(pz,'even').type;if(!inLog(t)||rep.sighting.length>=3&&!rep.sighting.some(s=>s.type===t))return false;const i=addType(r,pz,rep,t);rep.sighting[i].count=r.pick([2,4]);return set('sight:'+i,'rule:even');}
      case 'few':{const t=ruleById(pz,'few').type;if(!inLog(t)||rep.sighting.length>=3&&!rep.sighting.some(s=>s.type===t))return false;const i=addType(r,pz,rep,t);rep.sighting[i].count=FEW;return set('sight:'+i,'rule:few');}
      case 'swarm':{if(!inLog(BULK)||rep.sighting.length>=3&&!rep.sighting.some(s=>s.type===BULK))return false;const i=addType(r,pz,rep,BULK);rep.sighting[i].count=SWARM;return set('sight:'+i,'rule:swarm');}
      case 'escort':{
        const t=ruleById(pz,'escort').type;if(!inLog(t)||!inLog(BULK))return false;
        rep.sighting=order([t,BULK]).map(x=>rep.sighting.find(s=>s.type===x)||sightItem(r,pz,x,countFor(r,x)));
        return set('sight:'+rep.sighting.findIndex(s=>s.type===t),'rule:escort');
      }
      case 'overlap':{
        // The same convoy departed earlier today, just far enough apart.
        const prev=earlier(pz,rep).filter(x=>x.region===R&&pz.roster[R].includes(x.callsign));if(!prev.length)return false;
        const x=r.pick(prev),m=minutes(x.time)+r.pick([-1,1])*r.range(SPACING+5,SPACING+30);
        if(m<6*60||m>=22*60)return false;
        rep.callsign=x.callsign;retime(pz,rep,m);
        return set('callsign','log:'+x.id);
      }
      case 'contradict':{
        const prev=earlier(pz,rep).filter(x=>x.region===R&&x.from===rep.from);if(!prev.length)return false;
        return set('from','log:'+r.pick(prev).id);
      }
    }
    return false;
  }

  // Sabotage kinds available at a level; each plants exactly one discrepancy against one document entry.
  function forgeryKinds(pz){
    const k=['roster','freq'],doc=d=>pz.docs.includes(d);
    if(doc('guide'))k.push('guide-el','guide-glyph','guide-pips');
    if(doc('sensor'))k.push('sensor-type','sensor-cond');
    if(has(pz,'seal'))k.push('seal');
    if(has(pz,'sig'))k.push('sig');
    if(has(pz,'snap'))k.push('snap-type','snap-count');
    for(const rule of pz.rules)k.push(rule.id);
    if(pz.watches)k.push('watch');
    if(has(pz,'map'))k.push('approach');
    if(has(pz,'auth'))k.push('auth','auth-watch');
    if(has(pz,'log'))k.push(...CROSS);
    return k;
  }
  function newestKinds(pz,diff){return diff.newKinds.flatMap(k=>k==='tells'?pz.rules.map(x=>x.id):[k]);}
  function forge(r,pz,kind,id,closed){
    const regionsFor=pz.regions.filter(R=>{
      if(closed.has(R))return false;
      const log=pz.sensor[R].types,rule=ruleById(pz,kind);
      if(kind==='pair')return log.includes(rule.a)&&log.includes(rule.b);
      if(['alone','even','few','escort'].includes(kind))return log.includes(rule.type);
      if(kind==='swarm')return log.includes(BULK);
      if(kind==='sensor-type')return log.length<CARGO.length;
      if(kind==='overlap')return earlier(pz,{id}).some(x=>x.region===R&&pz.roster[R].includes(x.callsign));
      if(kind==='contradict')return earlier(pz,{id}).some(x=>x.region===R&&x.from===pz.approach[R])&&borders(pz,R).length>1;
      return true;
    });
    if(!regionsFor.length)return null;
    for(let tries=0;tries<60;tries++){
      const R=r.pick(regionsFor),rep=baseReport(r,pz,R,id);if(!rep)continue;
      rep.forged=true;let snapMode='ok';const guideKind=kind.startsWith('guide-');if(guideKind)rep.dest=LAB;
      switch(kind){
        case 'roster':{
          const twins=pz.regions.filter(o=>o!==R).flatMap(o=>pz.roster[o]);
          const same=twins.filter(c=>pz.roster[R].some(x=>x.split('-')[0]===c.split('-')[0]));
          if(r.chance(0.5)&&same.length)rep.callsign=r.pick(same);
          else if(r.chance(0.5))rep.callsign=r.pick(twins);
          else{const b=r.pick(pz.roster[R]).split('-')[0];const c=`${b}-${r.range(1,9)}`;if(pz.regions.some(o=>pz.roster[o].includes(c)))continue;rep.callsign=c;}
          break;
        }
        case 'freq':{
          const others=pz.regions.filter(o=>o!==R).map(o=>freqOf(pz,o,rep.time));
          if(r.chance(0.6))rep.freq=r.pick(others);
          else{
            // A near twin of the right channel: same whole number, another decimal that no line on the desk uses.
            const whole=rep.freq.split('.')[0],taken=pz.regions.flatMap(o=>[].concat(pz.freq[o]));
            const cand=[...Array(10).keys()].map(d=>whole+'.'+d).filter(x=>!taken.includes(x));
            if(!cand.length)continue;rep.freq=r.pick(cand);
          }
          break;
        }
        case 'watch':rep.freq=pz.freq[R][1-watchOf(rep.time)];break;
        case 'auth-watch':rep.auth=pz.auth[R][1-watchOf(rep.time)];break;
        case 'auth':{
          if(r.chance(0.5)){rep.auth=authOf(pz,r.pick(pz.regions.filter(o=>o!==R)),rep.time);}
          else{const [p,d]=rep.auth.split('-'),k=r.int(3),digits=d.split('');digits[k]=String((+digits[k]+r.range(1,9))%10);rep.auth=p+'-'+digits.join('');
            if(pz.regions.some(o=>pz.auth[o].includes(rep.auth)))continue;}
          break;
        }
        case 'sensor-type':{
          const missing=CARGO.filter(t=>!pz.sensor[R].types.includes(t));
          const elsewhere=missing.filter(t=>pz.regions.some(o=>pz.sensor[o].types.includes(t)));
          addType(r,pz,rep,r.pick(elsewhere.length?elsewhere:missing));break;
        }
        case 'sensor-cond':rep.cond=pz.sensor[r.pick(pz.regions.filter(o=>o!==R))].cond;break;
        case 'seal':{
          const s=rep.seal,what=r.pick(['points','glyph','ring']);
          if(what==='points')s.points+=s.points>=8?-1:s.points<=5?1:r.pick([-1,1]);
          else if(what==='glyph')s.glyph=r.pick(SEAL_GLYPHS.filter(g=>g!==s.glyph));
          else s.ring=r.pick(SEAL_RINGS.filter(g=>g!==s.ring));
          break;
        }
        case 'sig':{const k=r.int(6);rep.sig[k]=r.pick(WAVES.filter(w=>w!==rep.sig[k]));break;}
        case 'snap-type':snapMode='type';break;
        case 'snap-count':snapMode='count';break;
        case 'approach':rep.from=r.pick(pz.map.nodes.filter(n=>n!==R&&!adjacent(pz,R,n)));break;
        case 'contradict':rep.from=r.pick(borders(pz,R).filter(n=>n!==pz.approach[R]));break;
        case 'overlap':{
          const prev=earlier(pz,rep).filter(x=>x.region===R&&pz.roster[R].includes(x.callsign));if(!prev.length)continue;
          const x=r.pick(prev);rep.callsign=x.callsign;retime(pz,rep,minutes(x.time)+r.pick([-1,1])*r.range(5,SPACING-5));break;
        }
        case 'curfew':retime(pz,rep,r.pick([r.range(22*60,23*60+59),r.range(0,5*60+50)]));break;
        case 'maint':retime(pz,rep,r.range(MAINT.from,MAINT.to-1));break;
        case 'beat':{const m=minutes(rep.time);retime(pz,rep,m-(m%5)+r.range(1,4),true);break;}
        case 'pair':{
          const p=ruleById(pz,'pair'),rest=rep.sighting.map(s=>s.type).filter(t=>t!==p.a&&t!==p.b).slice(0,r.int(2));
          rep.sighting=order([...rest,p.a,p.b]).map(x=>rep.sighting.find(s=>s.type===x)||sightItem(r,pz,x,countFor(r,x)));break;
        }
        case 'alone':{const t=ruleById(pz,'alone').type;rep.sighting=[sightItem(r,pz,t,countFor(r,t))];break;}
        case 'cap':{const i=r.int(rep.sighting.length);rep.sighting[i].count=r.range(CAP+2,CAP+6);break;}
        case 'even':{const i=addType(r,pz,rep,ruleById(pz,'even').type);rep.sighting[i].count=r.pick([1,3]);break;}
        case 'few':{const i=addType(r,pz,rep,ruleById(pz,'few').type);rep.sighting[i].count=r.range(FEW+1,4);break;}
        case 'swarm':{const i=addType(r,pz,rep,BULK);rep.sighting[i].count=r.range(2,SWARM-1);break;}
        case 'escort':{const t=ruleById(pz,'escort').type;rep.sighting=rep.sighting.filter(s=>s.type!==BULK);addType(r,pz,rep,t,2);break;}
      }
      addSpecimens(r,pz,rep);
      if(guideKind){
        // A falsified specimen label: an element the species never carries (a chaos chaff, say), a glyph that does not
        // match the colour, or the wrong silhouette.
        const s=r.pick(rep.specimens);
        if(kind==='guide-el'){const bad=ELEMENTS.filter(e=>!pz.guide[s.type].els.includes(e));s.el=s.glyph=s.type==='chaff'&&r.chance(0.5)?'chaos':r.pick(bad);}
        if(kind==='guide-glyph')s.glyph=r.pick(ELEMENTS.filter(e=>e!==s.el));
        if(kind==='guide-pips')s.pips=s.pips===1?2:s.pips+r.pick([-1,1]);
      }
      if(has(pz,'snap'))rep.snap=makeSnap(r,pz,rep,snapMode);
      const v=audit(pz,rep);
      if(v.length!==1||v[0].rule!==kind)continue;
      rep.tell={kind,...v[0]};
      return rep;
    }
    return null;
  }

  // build(r, pz, n, kinds): the manifests of one desk; null when the desk cannot be built cleanly (the caller rerolls).
  function build(r,pz,n,ks,fresh){
    const nf=ks.length,trapKinds=['callsign','freq',...(pz.docs.includes('guide')?['guide']:[]),...(pz.docs.includes('sensor')?['sensor']:[]),
      ...['seal','sig','snap'].filter(c=>has(pz,c)),...(has(pz,'map')?['approach']:[]),...(has(pz,'auth')?['auth']:[]),...(has(pz,'log')?CROSS:[]),...pz.rules.map(x=>x.id)];
    // Cross-manifest sabotage needs history: it takes the later sabotaged slots, and never the first two manifests.
    ks.sort((a,b)=>CROSS.includes(a)-CROSS.includes(b));
    const slots=[...r.shuffle([...Array(n).keys()]).slice(0,nf)].sort((a,b)=>a-b);
    if(ks.some((k,i)=>CROSS.includes(k)&&slots[i]<2))return null;
    const kindAt=new Map(slots.map((s,i)=>[s,ks[i]])),closed=new Set();
    for(let i=0;i<n;i++){
      let rep=null;
      try{rep=kindAt.has(i)?forge(r,pz,kindAt.get(i),i,closed):genuine(r,pz,r.pick(pz.regions.filter(R=>!closed.has(R))),trapKinds,i);}catch{rep=null;}
      if(!rep)return null;
      // After a contradicting manifest, its depot ships no more today.
      if(rep.forged&&rep.tell.rule==='contradict')closed.add(rep.region);
      pz.reports.push(rep);
    }
    // The whole desk re-audited with the full log: every manifest still breaks exactly what it should.
    if(pz.reports.some(rep=>audit(pz,rep).length!==(rep.forged?1:0)))return null;
    if(fresh&&!pz.reports.some(rep=>rep.forged&&fresh.includes(rep.tell.rule)))return null;
    return pz.reports;
  }
  // The documents of one desk for a level description (also used by the night shift).
  function desk(r,diff,extra={}){
    const world=r.pick(WORLDS),regions=world.regions.slice(),checks=diff.checks.slice();
    const fr=makeFreqs(r,regions.length*(diff.watches?2:1)),freq={};
    regions.forEach((R,i)=>{freq[R]=diff.watches?[fr[i*2],fr[i*2+1]]:fr[i];});
    const rules=extra.rules||makeRules(r,diff.tells);
    const pz={seed:extra.seed??0,difficulty:diff.id,label:diff.label,target:diff.target,world:world.name,regions,docs:diff.docs.slice(),checks,watches:diff.watches,
      roster:makeRoster(r,regions,diff.roster),freq,guide:makeGuide(r),sensor:makeSensor(r,regions,rules),rules,curfew:{from:hhmm(CURFEW.from),to:hhmm(CURFEW.to-1)},cap:CAP,
      watchNames:WATCHES.slice(),newRule:{...diff.newRule,newest:true},intro:clone(diff.intro),
      fronts:FRONTS.map((id,i)=>({id,lt:world.lts[i]})),reports:[]};
    if(checks.includes('seal'))pz.seals=makeSeals(r,regions);
    if(checks.includes('sig'))pz.sig=makeSigs(r,regions);
    if(checks.includes('map')){pz.map=makeMap(r,regions);pz.approach={};for(const R of regions)pz.approach[R]=r.pick(borders(pz,R));}
    if(checks.includes('auth'))pz.auth=makeAuth(r,regions);
    return pz;
  }
  function pickKinds(r,pz,nf,fresh){
    const all=forgeryKinds(pz),ks=fresh&&fresh.length?[r.pick(fresh)]:[];
    for(const k of r.shuffle(all))if(ks.length<nf&&!ks.includes(k))ks.push(k);
    while(ks.length<nf)ks.push(r.pick(all));
    return ks;
  }
  function generate(seed,difficulty){
    const diff=diffOf(difficulty),s=Number(seed)>>>0;
    for(let attempt=0;attempt<80;attempt++){
      const r=Kit.rng((s*2654435761+Kit.hashSeed(diff.id)+attempt*977)>>>0);
      const pz=desk(r,diff,{seed:s});
      const n=r.range(diff.reports[0],diff.reports[1]),nf=Math.ceil(n*0.3),fresh=newestKinds(pz,diff);
      if(!build(r,pz,n,pickKinds(r,pz,nf,fresh),fresh))continue;
      return pz;
    }
    throw new Error('IntelCheck: generation failed for seed '+seed);
  }

  // ---- the night shift at the depot (Endless) -----------------------------------------------------------------------
  // endlessRules(seed, day): night 1 has one tell; each later night adds one (up to four), then swaps one for a new one.
  function endlessRules(seed,day){
    const r=Kit.rng(((Number(seed)>>>0)*2654435761+Kit.hashSeed('endless-rules'))>>>0);
    let rules=makeRules(r,1),change={type:'add',added:rules[0].id,removed:null};
    for(let d=2;d<=day;d++){
      const fresh=TELLS.filter(t=>!rules.some(x=>x.id===t));
      // A new tell whose cargo kinds do not clash with the tells already in force.
      const used=new Set(rules.flatMap(x=>[x.type,x.a,x.b].filter(Boolean)));let add=null;
      for(let k=0;k<20&&!add;k++){const c=makeRules(r,1,fresh)[0];if(c&&![c.type,c.a,c.b].some(t=>t&&used.has(t)))add=c;}
      if(!add)add=makeRules(r,1,fresh.filter(t=>!TYPED[t]&&t!=='pair'))[0];
      if(rules.length<ENDLESS.maxTells){rules=[...rules,add];change={type:'add',added:add.id,removed:null};}
      else{const out=r.pick(rules);rules=[...rules.filter(x=>x!==out),add];change={type:'swap',added:add.id,removed:out.id};}
      rules=TELLS.filter(t=>rules.some(x=>x.id===t)).map(t=>rules.find(x=>x.id===t));
    }
    return {rules,change};
  }
  // endlessDay(seed, day): one night's desk of six manifests; the new tell is always exercised by a sabotaged one.
  function endlessDay(seed,day){
    const {rules,change}=endlessRules(seed,day),diff={...ENDLESS.base,tells:rules.length};
    const added=rules.find(x=>x.id===change.added);
    for(let attempt=0;attempt<80;attempt++){
      const r=Kit.rng(((Number(seed)>>>0)*2654435761+Kit.hashSeed('endless')+day*7919+attempt*977)>>>0);
      const pz=desk(r,diff,{seed,rules:clone(rules)});
      pz.endless={day,change,perDay:ENDLESS.perDay};
      pz.newRule={doc:'rules',newest:true,text:`Night ${day}: ${change.type==='swap'?`${cap1(RULE_NAMES[change.removed])} is lifted. New`:'new'} sabotage tell: ${added.text}`};
      if(!build(r,pz,ENDLESS.perDay,pickKinds(r,pz,ENDLESS.forgedPerDay,[change.added]),[change.added]))continue;
      pz.label=`Night shift · night ${day}`;
      return pz;
    }
    throw new Error('IntelCheck: night shift failed for seed '+seed+' night '+day);
  }
  // A run: manifests cleared (stamped right), mistakes (wrong stamps and timeouts); three mistakes end it.
  const endlessRun=()=>({day:1,cleared:0,mistakes:0,over:false});
  function endlessStep(run,event){
    const out={...run};
    if(event==='right')out.cleared++;
    if(event==='wrong'||event==='timeout')out.mistakes++;
    if(event==='day')out.day++;
    out.over=out.mistakes>=ENDLESS.mistakes;
    return out;
  }
  // Personal best: store is anything with getItem/setItem (localStorage in the browser).
  const BEST_KEY='spacologyIntelCheckEndlessBest';
  function recordBest(store,cleared){
    let best=0;try{best=Number(store.getItem(BEST_KEY))||0;}catch{}
    const isNew=cleared>best;if(isNew){try{store.setItem(BEST_KEY,String(cleared));}catch{}}
    return {best:Math.max(best,cleared),previous:best,isNew};
  }

  // ---- state and moves --------------------------------------------------------------------------------------------
  const create=pz=>({cursor:0,stamps:pz?pz.reports.map(()=>null):[],evidence:pz?pz.reports.map(()=>null):[],attached:pz?pz.reports.map(()=>false):[],compares:0,capped:false});
  const current=(pz,st)=>st.cursor<pz.reports.length?pz.reports[st.cursor]:null;
  function validate(pz,st,move){
    if(!move||typeof move!=='object')return 'No move given';
    const rep=current(pz,st);
    if(move.type==='compare'){
      if(!rep)return 'Every manifest is already stamped';
      if(!fields(rep).includes(move.field))return 'That manifest has no such field';
      if(!entries(pz).includes(move.entry))return 'No such document line on the desk';
      return null;
    }
    if(move.type==='check'){
      if(!rep)return 'Every manifest is already stamped';
      if(!fields(rep).includes(move.field))return 'That manifest has no such field';
      return null;
    }
    if(move.type==='checkall')return rep?null:'Every manifest is already stamped';
    if(move.type==='stamp'){
      if(!rep)return 'Every manifest is already stamped';
      if(move.verdict!=='verified'&&move.verdict!=='forged')return 'A stamp is VERIFIED or FORGED';
      return null;
    }
    if(move.type==='unstamp')return st.cursor>0?null:'Nothing stamped yet';
    return 'Unknown move';
  }
  // apply returns null on success or a reason; an invalid move leaves the state untouched.
  function apply(pz,st,move){
    const why=validate(pz,st,move);if(why)return why;
    if(move.type==='compare'){
      const rep=current(pz,st),c=compare(pz,rep,move.field,move.entry);st.compares++;
      if(c.result==='mismatch'&&!st.evidence[rep.id])st.evidence[rep.id]={field:move.field,entry:move.entry,rule:c.rule,text:c.text};
    }else if(move.type==='check'||move.type==='checkall'){
      // One-tap: the field (or every field) against each line it must match. Check all caps the round at Good unless free.
      const rep=current(pz,st);
      for(const f of move.type==='check'?[move.field]:fields(rep))for(const e of checksFor(pz,rep,f))apply(pz,st,{type:'compare',field:f,entry:e});
      if(move.type==='checkall'&&!move.free)st.capped=true;
    }else if(move.type==='stamp'){
      // FORGED attaches any evidence already found on this manifest.
      if(st.attached)st.attached[st.cursor]=move.verdict==='forged'&&!!st.evidence[st.cursor];
      st.stamps[st.cursor]=move.verdict;st.cursor++;
    }
    else{st.cursor--;st.stamps[st.cursor]=null;if(st.attached)st.attached[st.cursor]=false;}
    return null;
  }

  // ---- evaluation, tiers, score -----------------------------------------------------------------------------------
  function evaluate(pz,st){
    let correct=0,approved=[],rejected=[],backed=0,unbacked=[],unstamped=0;
    pz.reports.forEach((rep,i)=>{
      const v=st.stamps[i];
      if(!v){unstamped++;return;}
      if((v==='forged')===rep.forged)correct++;
      if(rep.forged&&v==='verified')approved.push(i);
      if(!rep.forged&&v==='forged')rejected.push(i);
      if(rep.forged&&v==='forged'){if(st.evidence[i])backed++;else unbacked.push(i);}
    });
    const forged=pz.reports.filter(x=>x.forged).length;
    return {total:pz.reports.length,stamped:pz.reports.length-unstamped,done:unstamped===0,correct,mistakes:approved.length+rejected.length+unstamped,
      approved,rejected,unbacked,backed,forged,unstamped,capped:!!st.capped};
  }
  function tier(pz,ev){
    if(ev.mistakes===0)return ev.backed===ev.forged&&!ev.capped?'perfect':'good';
    return ev.mistakes<=2?'partial':'failed';
  }
  // Score: 100 per correct stamp, 50 per sabotage caught with evidence, minus 20 per hint, plus up to 100 for time.
  function score(pz,ev,ms=0,hints=0){
    const t=pz.target*1000,time=ms<=t?100:Math.max(0,Math.round(100*(1-(ms-t)/t)));
    return Math.max(0,ev.correct*100+ev.backed*50-hints*20+(ev.done&&ev.mistakes===0?time:0));
  }

  // ---- solver, auto, hints ----------------------------------------------------------------------------------------
  function solve(pz){
    const moves=[];
    for(const rep of pz.reports){
      if(rep.forged)moves.push({type:'compare',field:rep.tell.field,entry:rep.tell.entry},{type:'stamp',verdict:'forged'});
      else moves.push({type:'stamp',verdict:'verified'});
    }
    return moves;
  }
  // The automatic fallback stamps everything VERIFIED: every sabotaged convoy slips through.
  function auto(pz){const st=create(pz);for(let i=0;i<pz.reports.length;i++)apply(pz,st,{type:'stamp',verdict:'verified'});return {state:st,evaluation:evaluate(pz,st)};}
  // Hint: the field and document line to check for the current manifest, phrased the same way either way.
  function hint(pz,st){
    const rep=current(pz,st);if(!rep)return null;
    const t=rep.forged?rep.tell:rep.trap;
    return {report:rep.id,field:t.field,entry:t.entry,text:`Check the ${fieldLabel(pz,rep,t.field)} against ${entryLabel(pz,t.entry)}.`};
  }

  // ---- words for the result card ----------------------------------------------------------------------------------
  const who=(pz,rep)=>`Manifest ${rep.no} (${rep.callsign}, ${rep.region})`;
  function nearMiss(pz,st){
    const ev=evaluate(pz,st);
    if(ev.approved.length){const rep=pz.reports[ev.approved[0]];return `${who(pz,rep)} was Null sabotage; its ${fieldLabel(pz,rep,rep.tell.field)} gave it away: ${compare(pz,rep,rep.tell.field,rep.tell.entry).text}`;}
    if(ev.rejected.length){const rep=pz.reports[ev.rejected[0]];return `${who(pz,rep)} was genuine: every line matched the documents${rep.trap?`, even the ${fieldLabel(pz,rep,rep.trap.field)}`:''}.`;}
    if(ev.unstamped){const rep=pz.reports[st.cursor];return `${who(pz,rep)} and ${ev.unstamped-1} more were never stamped.`;}
    if(ev.unbacked.length){const rep=pz.reports[ev.unbacked[0]];return `${who(pz,rep)} was rightly stamped FORGED, but without evidence: ${compare(pz,rep,rep.tell.field,rep.tell.entry).text}`;}
    return '';
  }
  // What happened downstream: logistics shipped on sabotaged paperwork, or a genuine convoy never left the pad.
  function consequences(pz,st){
    const ev=evaluate(pz,st),out=[];
    for(const i of ev.approved){
      const rep=pz.reports[i],to=destLong(pz,rep.dest),made=pz.sensor[rep.region].types,said=rep.sighting.map(s=>s.type);
      const extra=said.filter(t=>!made.includes(t)),f=rep.tell.field;
      if(f.startsWith('spec:')){out.push(`A mislabelled ${specAt(rep,f).type} sample on manifest ${rep.no} cost the lab a night on the wrong species.`);continue;}
      if(extra.length){out.push(`Approved a sabotaged convoy: ${to} was promised ${listText(extra.map(kinds))} the ${rep.region} depot never made.`);continue;}
      const line=f.startsWith('sight:')?rep.sighting[+f.slice(6)]:rep.sighting.find(s=>s.type!==BULK)||rep.sighting[0];
      out.push(`Approved a sabotaged convoy: ${line.count} ${plural(line.type,line.count)} for ${to} arrived as empty crates.`);
    }
    for(const i of ev.rejected){const rep=pz.reports[i];out.push(`A genuine convoy sat on the pad at ${rep.region}: ${destLong(pz,rep.dest)} went without ${sightText(rep.sighting)} (manifest ${rep.no}).`);}
    return out;
  }
  // The shipments cleared for Logistics, grouped by destination: what each front and the lab will receive, plus anything
  // that slipped through or was wrongly held back.
  function output(pz,st){
    const ev=evaluate(pz,st),cleared=pz.reports.filter((rep,i)=>st.stamps[i]==='verified');
    const genuine=cleared.filter(x=>!x.forged).length,stopped=pz.reports.filter((rep,i)=>rep.forged&&st.stamps[i]==='forged').length;
    const head=`Shipments cleared: ${genuine} verified, ${stopped} sabotaged convoy${stopped===1?'':'s'} stopped.`;
    const nos=list=>list.map(i=>pz.reports[i].no).join(', ');
    const slipped=ev.approved.length?` Slipped through: ${ev.approved.length} sabotaged convoy${ev.approved.length===1?'':'s'} (manifest ${nos(ev.approved)}).`:'';
    const held=ev.rejected.length?` Held back: ${ev.rejected.length} genuine convoy${ev.rejected.length===1?'':'s'} (manifest ${nos(ev.rejected)}).`:'';
    const lines=[];
    for(const d of [...FRONTS,LAB]){
      const reps=cleared.filter(x=>x.dest===d);if(!reps.length)continue;
      const sum={};for(const rep of reps)for(const x of rep.sighting)sum[x.type]=(sum[x.type]||0)+x.count;
      const samples=ENEMIES.filter(t=>reps.some(rep=>specs(rep).some(s=>s.type===t)));
      const fake=reps.some(x=>x.forged);
      lines.push(`${d===LAB?'Ship’s lab':destLong(pz,d)} (${reps.length} convoy${reps.length===1?'':'s'}): ${sightText(order(Object.keys(sum)).map(t=>({type:t,count:sum[t]})))}`+
        `${samples.length?`; specimens: ${listText(samples)}`:''}${fake?' [includes a sabotaged convoy]':''}`);
    }
    return `${head}${slipped}${held}${lines.length?` Cleared: ${lines.join('; ')}.`:' Nothing cleared to ship.'}`;
  }

  const api={WORLDS,FRONTS,LAB,CARGO,CARGO_NAMES,BULK,ENEMIES,ELEMENTS,PIPS,DEPTS,SEAL_GLYPHS,SEAL_RINGS,WAVES,OUTER,CONDITIONS,DIFFICULTIES,DOC_NAMES,TELLS,CAP,SPACING,WATCHES,WATCH_NAMES,
    ASSISTS,assistOf,checksFor,checkField,suggest,explain,citation,citations,tick,generate,entries,parseEntry,docOfEntry,fields,fieldLabel,entryLabel,ruleText,
    audit,compare,tellCheck,iconCheck,sealCheck,snapCheck,makeSnap,sightItem,specItem,borders,forgeryKinds,create,current,validate,apply,clone,evaluate,tier,score,solve,auto,hint,
    nearMiss,consequences,output,plural,kinds,species,sightText,destName,destLong,watchOf,inCurfew,freqOf,authOf,minutes,
    ENDLESS,BEST_KEY,endlessRules,endlessDay,endlessRun,endlessStep,recordBest,
    _internal:{desk,build,pickKinds,makeRules,newestKinds,diffOf}};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.IntelCheck=api;
})(typeof globalThis==='object'?globalThis:this);
