'use strict';
// Manifest checking model (the intel-check game, Research's day shift for Logistics): determinism; for 200 seeds per
// difficulty every genuine manifest passes the independent audit and every sabotaged one breaks exactly one rule, the
// planted one, visible on the desk; exhaustive player comparisons over every field × every document line agree with the
// audit (the "no hidden ambiguity" sweep); the level's newest rules are always exercised and the checks are spread
// across levels; specimen crates against the field guide (lab shipments only), seals, transponder signatures, cargo
// scans, the route map, code table and today's log each with edge cases; the 10-tell regulations pool; cross-manifest
// logic; rule edge cases (overnight closure, shift change, line limit, pair, never alone, wrong lines); atomic invalid
// moves; tiers; auto below Perfect; hints that never reveal the verdict; near-miss; assist tiers, one-tap and Check all,
// evidence auto-attach, citations and the consequence tick; the shipments-cleared output; Veteran (12–14 manifests,
// five tells); the night shift's rule rotation, nights, run and personal best.
const assert=require('node:assert/strict'),M=require('../../prototypes/minigames/intel-check/intel-check-model.js');
const SEEDS=200,ids=['easy','normal','hard','expert','veteran'],t0=Date.now();
const run=(pz,moves)=>{const st=M.create(pz);for(const m of moves)assert.equal(M.apply(pz,st,m),null,JSON.stringify(m));return st;};
const stampAll=(pz,verdicts,evidence=true)=>{const st=M.create(pz);pz.reports.forEach((r,i)=>{if(evidence&&r.forged)M.apply(pz,st,{type:'compare',field:r.tell.field,entry:r.tell.entry});M.apply(pz,st,{type:'stamp',verdict:verdicts[i]});});return st;};
const truth=pz=>pz.reports.map(r=>r.forged?'forged':'verified');
const J=x=>JSON.parse(JSON.stringify(x));

// Determinism.
for(const d of ids){assert.deepEqual(M.generate(7,d),M.generate(7,d));assert.notDeepEqual(M.generate(7,d).reports,M.generate(8,d).reports);}

// The checks spread across levels: documents, report fields and forgery kinds.
const DOCS={easy:['roster','freq','guide'],normal:['roster','freq','guide','sensor'],hard:['roster','freq','guide','sensor','rules'],
  expert:['roster','freq','guide','sensor','rules','map','auth','log']};DOCS.veteran=DOCS.expert;
const FIELDS={easy:[],normal:['seal'],hard:['seal','sig','snap'],expert:['seal','sig','snap','from','auth']};FIELDS.veteran=FIELDS.expert;
const NEWEST={easy:['guide-el','guide-glyph','guide-pips'],normal:['sensor-type','sensor-cond','seal'],hard:['sig','snap-type','snap-count',...M.TELLS],
  expert:['watch','approach','auth','auth-watch','overlap','contradict'],veteran:M.TELLS};
const KINDS={easy:['roster','freq','guide-el','guide-glyph','guide-pips']};
KINDS.normal=[...KINDS.easy,'sensor-type','sensor-cond','seal'];KINDS.hard=[...KINDS.normal,'sig','snap-type','snap-count',...M.TELLS];
KINDS.expert=[...KINDS.hard,'watch','approach','auth','auth-watch','overlap','contradict'];KINDS.veteran=KINDS.expert;
const TRAPS={easy:['callsign','freq','guide'],normal:['sensor','seal'],hard:['sig','snap'],expert:['approach','auth','overlap','contradict'],veteran:['overlap','contradict']};
let compares=0,slowest=0;const kindsSeen={},trapsSeen={},tellsSeen=new Set();
for(const d of ids){
  const diff=M.DIFFICULTIES.find(x=>x.id===d);kindsSeen[d]={};trapsSeen[d]=new Set();
  for(let seed=1;seed<=SEEDS;seed++){
    const t=Date.now(),pz=M.generate(seed,d);slowest=Math.max(slowest,Date.now()-t);
    const tag=`${d}/${seed}`,n=pz.reports.length,nf=pz.reports.filter(r=>r.forged).length;
    assert.deepEqual(pz.docs,DOCS[d],tag+' documents for the level');
    assert.ok(n>=5&&n<=14&&n>=diff.reports[0]&&n<=diff.reports[1],tag+' report count');if(d==='veteran')assert.ok(n>=12);
    assert.ok(nf/n>=0.3-1e-9&&nf/n<=0.4+1e-9,`${tag} ${nf}/${n} forged`);
    assert.equal(pz.rules.length,diff.tells);assert.equal(pz.watches,d==='expert'||d==='veteran');if(d==='veteran')assert.equal(pz.rules.length,M.DIFFICULTIES.find(x=>x.id==='expert').tells+2,'Veteran: two extra tells');pz.rules.forEach(x=>tellsSeen.add(x.id));
    assert.equal(new Set(pz.rules.map(x=>x.id)).size,pz.rules.length,'tells differ');
    assert.equal(new Set(pz.regions.map(r=>pz.sensor[r].cond)).size,pz.regions.length,'conditions differ by region');
    const allFreqs=pz.regions.flatMap(r=>[].concat(pz.freq[r]));assert.equal(new Set(allFreqs).size,allFreqs.length,'channels unique');
    const allCalls=pz.regions.flatMap(r=>pz.roster[r]);assert.equal(new Set(allCalls).size,allCalls.length,'callsigns unique');
    // Field guide consistency: two elements per species, chaff never chaos, every genuine specimen label drawn from its entry.
    for(const k of M.ENEMIES){assert.equal(pz.guide[k].els.length,2);assert.ok(pz.guide[k].els.every(e=>M.ELEMENTS.includes(e)));}
    assert.ok(!pz.guide.chaff.els.includes('chaos'),'chaff are never chaos');
    if(pz.seals)assert.equal(new Set(pz.regions.map(r=>pz.seals[r].dept)).size,pz.regions.length,'one shipping department per depot');
    assert.deepEqual(pz.fronts.map(f=>f.id),M.FRONTS);assert.ok(pz.fronts.every(f=>/^[A-Z][a-z]+$/.test(f.lt)),'every front has a named lieutenant');
    for(const R of pz.regions)for(const t of pz.sensor[R].types)assert.ok(pz.sensor[R].made[t]>18,'quantities made never decide a check');
    if(pz.sig)pz.regions.forEach((a,i)=>pz.regions.slice(i+1).forEach(b=>assert.ok(pz.sig[a].filter((x,k)=>x!==pz.sig[b][k]).length>=2,'signatures two segments apart')));
    if(pz.map)pz.regions.forEach((R,i)=>{const opp=pz.map.ring[(pz.map.ring.indexOf(R)+2)%4];assert.ok(!M.borders(pz,R).includes(opp),'opposite regions never border');assert.ok(M.borders(pz,R).includes(pz.approach[R]));});
    if(pz.auth)pz.regions.forEach(R=>{assert.notEqual(pz.auth[R][0],pz.auth[R][1]);assert.equal(pz.auth[R][0].split('-')[0],pz.auth[R][1].split('-')[0],'a region keeps its code letters');});
    const entries=M.entries(pz);
    assert.ok(pz.reports.some(r=>r.forged&&NEWEST[d].includes(r.tell.rule)),tag+' newest rule exercised');
    for(const r of pz.reports){
      const a=M.audit(pz,r),fs=M.fields(r);
      for(const f of ['seal','sig','snap','from','auth'])assert.equal(fs.includes(f),FIELDS[d].includes(f),`${tag} field ${f} at this level`);
      assert.ok([...M.FRONTS,M.LAB].includes(r.dest),'every manifest has a destination');
      assert.equal(!!r.specimens,r.dest===M.LAB,'specimen crates ship to the lab only');if(r.specimens)assert.ok(r.specimens.length>=1&&r.specimens.length+r.sighting.length<=4);
      if(r.forged&&/^guide-/.test(r.tell.rule))assert.ok(r.tell.field.startsWith('spec:'),'a falsified label is on a specimen crate');
      for(const s of r.sighting)assert.ok(M.CARGO.includes(s.type),'cargo lines are supplies');
      if(r.forged){
        assert.equal(a.length,1,`${tag} report ${r.no} forged with exactly one discrepancy: ${JSON.stringify(a)}`);
        assert.equal(a[0].rule,r.tell.rule);assert.ok(entries.includes(r.tell.entry),'tell visible on the desk');assert.notEqual(r.tell.field,'region');
        assert.ok(KINDS[d].includes(r.tell.rule),`${tag} ${r.tell.rule} belongs to this level`);
        if(r.tell.entry.startsWith('log:'))assert.ok(+r.tell.entry.slice(4)<r.id,'a cross-report tell points at an earlier report');
        assert.equal(M.compare(pz,r,r.tell.field,r.tell.entry).result,'mismatch');kindsSeen[d][r.tell.rule]=(kindsSeen[d][r.tell.rule]||0)+1;
        assert.ok(M.checksFor(pz,r,r.tell.field).includes(r.tell.entry),tag+' one-tap reaches the tell');assert.equal(M.checkField(pz,r,r.tell.field).state,'bad');
      }else{
        assert.equal(a.length,0,`${tag} report ${r.no} genuine is clean: ${JSON.stringify(a)}`);
        assert.ok(r.trap&&entries.includes(r.trap.entry),tag+' genuine report has a near-miss detail');trapsSeen[d].add(r.trap.kind);
        assert.equal(M.compare(pz,r,r.trap.field,r.trap.entry).result,'match',tag+' trap checks out');
        assert.ok(r.time>='06:00'&&r.time<='21:59','genuine reports are outside curfew');
        for(const s of r.specimens||[])assert.equal(M.iconCheck(pz,s),null,'genuine specimen labels follow the field guide');
        assert.ok(M.checksFor(pz,r,r.trap.field).includes(r.trap.entry),tag+' one-tap reaches the near miss');
        for(const f of fs)assert.notEqual(M.checkField(pz,r,f).state,'bad',tag+' genuine one-tap '+f);
      }
      for(const f of fs)for(const e of M.checksFor(pz,r,f))assert.ok(entries.includes(e),tag+' checks only lines on the desk');
      // The player's view agrees with the checker: every mismatch over every field × line is the planted rule.
      const rules=new Set();
      for(const f of fs)for(const e of entries){const c=M.compare(pz,r,f,e);compares++;assert.ok(c.text.length>0);if(c.result==='mismatch')rules.add(c.rule);}
      assert.deepEqual([...rules],r.forged?[r.tell.rule]:[],`${tag} report ${r.no} comparisons agree with the audit`);
    }
    // Solving gives Perfect; auto lets every forgery through and stays below Perfect.
    const solved=run(pz,M.solve(pz)),ev=M.evaluate(pz,solved);
    assert.equal(M.tier(pz,ev),'perfect');assert.equal(M.nearMiss(pz,solved),'');assert.deepEqual(M.consequences(pz,solved),[]);
    const a=M.auto(pz);assert.notEqual(M.tier(pz,a.evaluation),'perfect');assert.equal(a.evaluation.approved.length,nf);
    assert.equal(M.consequences(pz,a.state).length,nf);
  }
}
for(const d of ids)for(const k of KINDS[d])assert.ok(kindsSeen[d][k]>=((d==="expert"||d==="veteran")&&M.TELLS.includes(k)?1:3),`${d} uses ${k} forgeries (${kindsSeen[d][k]||0})`);
for(const d of ids)for(const k of TRAPS[d])assert.ok(trapsSeen[d].has(k),`${d} plants ${k} near misses`);
assert.equal(M.TELLS.length,10);assert.deepEqual([...tellsSeen].sort(),M.TELLS.slice().sort(),'every tell in the pool is rolled');
assert.ok(trapsSeen.easy.has('guide'),'genuine lab shipments carry near-miss specimen labels');
assert.ok(slowest<200,`generation took ${slowest}ms on the slowest seed`);

// Rule edge cases on a fixed desk, with only the roster, transponders, production log and regulations in play.
{
  const full=M.generate(5,'expert'),pz={...J(full),docs:['roster','freq','sensor','rules'],checks:[]},base=J(full.reports.find(r=>!r.forged));
  for(const k of ['seal','sig','snap','from','auth','specimens'])delete base[k];
  const R=base.region,mk=over=>({...J(base),...over}),S=(type,count)=>({type,count});
  const at=time=>mk({time,freq:M.freqOf(pz,R,time)});
  const tells=[{id:'pair',a:'medkit',b:'drone'},{id:'curfew'},{id:'alone',type:'beacon'},{id:'cap'},{id:'maint'},{id:'even',type:'kit'},{id:'swarm'},{id:'escort',type:'shield'},{id:'beat'},{id:'few',type:'fuel'}];
  pz.rules=tells.map(x=>({...x,text:M.ruleText(x)}));
  pz.sensor[R]={types:['ration','kit','shield','medkit','drone','beacon','fuel'],cond:base.cond,prec:2};
  const g={sighting:[S('ration',6)]},rules=r=>M.audit(pz,r).map(v=>v.rule);
  assert.deepEqual(rules(mk({...at('21:55'),...g})),[]);assert.deepEqual(rules(mk({...at('22:00'),...g})),['curfew']);
  assert.deepEqual(rules(mk({...at('05:55'),...g})),['curfew']);assert.deepEqual(rules(mk({...at('06:00'),...g})),[]);
  assert.deepEqual(rules(mk({...at('13:55'),...g})),[]);assert.deepEqual(rules(mk({...at('14:00'),...g})),['maint']);assert.deepEqual(rules(mk({...at('14:25'),...g})),['maint']);assert.deepEqual(rules(mk({...at('14:30'),...g})),[]);
  assert.deepEqual(rules(mk({...at('10:05'),...g})),[]);assert.deepEqual(rules(mk({...at('10:07'),...g})),['beat']);
  assert.equal(M.watchOf('11:59'),0);assert.equal(M.watchOf('12:00'),1);
  const ok={...at('10:00')};
  assert.deepEqual(rules(mk({...ok,sighting:[S('ration',12)]})),[]);assert.deepEqual(rules(mk({...ok,sighting:[S('ration',13)]})),['cap']);
  assert.deepEqual(rules(mk({...ok,sighting:[S('ration',5)]})),[]);assert.deepEqual(rules(mk({...ok,sighting:[S('ration',4)]})),['swarm']);
  assert.deepEqual(rules(mk({...ok,sighting:[S('ration',6),S('medkit',2)]})),[]);
  assert.deepEqual(rules(mk({...ok,sighting:[S('medkit',2),S('drone',1)]})),['pair']);
  assert.deepEqual(rules(mk({...ok,sighting:[S('beacon',2)]})),['alone']);assert.deepEqual(rules(mk({...ok,sighting:[S('ration',5),S('beacon',2)]})),[]);
  assert.deepEqual(rules(mk({...ok,sighting:[S('ration',6),S('kit',2)]})),[]);assert.deepEqual(rules(mk({...ok,sighting:[S('ration',6),S('kit',3)]})),['even']);
  assert.deepEqual(rules(mk({...ok,sighting:[S('ration',6),S('shield',2)]})),[]);assert.deepEqual(rules(mk({...ok,sighting:[S('shield',2),S('medkit',1)]})),['escort']);
  assert.deepEqual(rules(mk({...ok,sighting:[S('ration',6),S('fuel',2)]})),[]);assert.deepEqual(rules(mk({...ok,sighting:[S('ration',6),S('fuel',3)]})),['few']);
  assert.match(M.compare(pz,mk({...ok,sighting:[S('ration',6),S('fuel',3)]}),'sight:1','rule:few').text,/3 fuel cells is more than 2 at a time/);
  assert.equal(M.compare(pz,mk({...ok,sighting:[S('ration',6),S('fuel',3)]}),'sight:0','rule:few').result,'unrelated','a typed tell ignores other kinds');
  pz.sensor[R].types=['ration','medkit'];
  assert.deepEqual(rules(mk({...ok,sighting:[S('shield',2),S('ration',5)]})),['sensor-type','escort'].filter(x=>x!=='escort'));
  const other=pz.regions.find(x=>x!==R);
  assert.deepEqual(rules(mk({...ok,...g,cond:pz.sensor[other].cond})),['sensor-cond']);
  const forgedCall=mk({...ok,...g,callsign:full.roster[other][0]});assert.deepEqual(rules(forgedCall),['roster']);
  assert.match(M.compare(pz,forgedCall,'callsign','roster:'+R).text,new RegExp(`isn’t on the ${R} roster \\(it is a ${other} callsign\\)`));
  assert.equal(M.compare(pz,forgedCall,'callsign','roster:'+other).result,'wrongline','another region\'s roster line');
  assert.equal(M.compare(pz,forgedCall,'cond','roster:'+R).result,'unrelated');
  assert.equal(M.compare(pz,forgedCall,'time','rule:pair').result,'unrelated');
}
// The shift change and the code table on a real Expert desk.
{
  const pz=M.generate(5,'expert'),base=pz.reports.find(r=>!r.forged),R=base.region,rules=r=>M.audit(pz,r).map(v=>v.rule);
  const at=time=>({...J(base),time,freq:M.freqOf(pz,R,time),auth:M.authOf(pz,R,time),callsign:'NOBODY-1'});
  const w0=at('11:55'),swap={...w0,freq:pz.freq[R][1]};assert.deepEqual(rules(swap).filter(x=>x!=='roster'),['watch'],'other watch channel is the watch rule');
  assert.equal(M.compare(pz,swap,'freq',`freq:${R}:1`).result,'wrongline','the other watch column is the wrong line');
  assert.match(M.compare(pz,swap,'freq',`freq:${R}:0`).text,/second shift transponder code, but the convoy departs at 11:55/);
  assert.equal(M.compare(pz,swap,'time',`freq:${R}:0`).result,'match');
  const code={...w0,auth:pz.auth[R][1]};assert.deepEqual(rules(code).filter(x=>x!=='roster'),['auth-watch']);
  assert.match(M.compare(pz,code,'auth',`auth:${R}:0`).text,/second shift code, but the convoy departs at 11:55/);
  assert.equal(M.compare(pz,code,'auth',`auth:${R}:1`).result,'wrongline');
  const other=pz.regions.find(x=>x!==R),code2={...w0,auth:pz.auth[other][0]};assert.deepEqual(rules(code2).filter(x=>x!=='roster'),['auth']);
  assert.match(M.compare(pz,code2,'auth',`auth:${R}:0`).text,/isn’t .* first shift code/);
}
// Visual checks, each detail on its own: specimen labels against the field guide, seals, transponder signatures, cargo
// scans, the route map.
{
  let seed=9,pz,base;for(;;seed++){pz=M.generate(seed,'expert');base=pz.reports.find(r=>!r.forged&&r.specimens);if(base)break;}
  const R=base.region,rules=r=>M.audit(pz,r).map(v=>v.rule);
  assert.deepEqual(rules(base),[]);
  const s0=base.specimens[0],T=s0.type,bad=M.ELEMENTS.find(e=>!pz.guide[T].els.includes(e)),good2=pz.guide[T].els.find(e=>e!==s0.el);
  const icon=over=>{const r=J(base);Object.assign(r.specimens[0],over);return r;};
  assert.deepEqual(rules(icon({el:good2,glyph:good2})),[],'either listed element is fine');
  assert.deepEqual(rules(icon({el:bad,glyph:bad})),['guide-el']);assert.match(M.compare(pz,icon({el:bad,glyph:bad}),'spec:0','guide:'+T).text,new RegExp(`as ${pz.guide[T].els.map(e=>e[0].toUpperCase()+e.slice(1)).join(' or ')} only`));
  assert.deepEqual(rules(icon({glyph:bad})),['guide-glyph']);assert.deepEqual(rules(icon({pips:M.PIPS[T]+1})),['guide-pips']);
  const wrongEntry=M.ENEMIES.find(k=>k!==T);assert.equal(M.compare(pz,base,'spec:0','guide:'+wrongEntry).result,'wrongline','another species is the wrong entry');
  assert.equal(M.compare(pz,base,'sight:0','guide:'+T).result,'unrelated','supply cargo is not checked against the field guide');
  const chaff=M.specItem(null,pz,'chaff');assert.equal(M.iconCheck(pz,{...chaff,el:'chaos',glyph:'chaos'}).rule,'guide-el','a chaos chaff label is falsified');
  assert.match(M.iconCheck(pz,{...chaff,el:'chaos',glyph:'chaos'}).text,/^A chaos chaff sample: the field guide lists chaff as /);
  assert.ok(M.checksFor(pz,base,'spec:0').includes('guide:'+T));
  const seal=over=>({...J(base),seal:{...base.seal,...over}});
  assert.deepEqual(rules(seal({points:base.seal.points+1})),['seal']);assert.match(M.compare(pz,seal({points:base.seal.points+1}),'seal','roster:'+R).text,/points/);
  assert.deepEqual(rules(seal({glyph:M.SEAL_GLYPHS.find(g=>g!==base.seal.glyph)})),['seal']);assert.deepEqual(rules(seal({ring:M.SEAL_RINGS.find(g=>g!==base.seal.ring)})),['seal']);
  const sig=J(base);sig.sig[3]=M.WAVES.find(w=>w!==sig.sig[3]);assert.deepEqual(rules(sig),['sig']);assert.match(M.compare(pz,sig,'sig','sig:'+R).text,/^Signature segment 4 is a /);
  const prec=pz.sensor[R].prec,tot=base.sighting.reduce((a,s)=>a+s.count,0),blip=type=>({type,x:0,y:0});
  const snap=list=>({...J(base),snap:{blips:list}}),fill=n=>{const out=base.sighting.map(s=>blip(s.type));while(out.length<n)out.push(blip(base.sighting[0].type));return out;};
  assert.deepEqual(rules(snap(fill(tot+prec))),[],'within the precision');assert.deepEqual(rules(snap(fill(Math.max(base.sighting.length,tot-prec)))),[]);
  assert.deepEqual(rules(snap(fill(tot+prec+1))),['snap-count']);
  const alien=M.CARGO.find(k=>!base.sighting.some(s=>s.type===k));assert.deepEqual(rules(snap([...fill(tot),blip(alien)])),['snap-type'],'a crate kind the manifest never lists');
  const far=pz.map.nodes.find(n=>n!==R&&!M.borders(pz,R).includes(n));assert.deepEqual(rules({...J(base),from:far}),['approach']);
  assert.match(M.compare(pz,{...J(base),from:far},'from','map:'+R).text,/doesn’t connect to/);
}
// Cross-manifest logic: one convoy cannot launch twice within 45 minutes; a manifest must not contradict an earlier
// one's route out of the same depot; the log only holds earlier manifests.
{
  const pz=M.generate(13,'expert'),rules=r=>M.audit(pz,r).map(v=>v.rule);
  const i=pz.reports.findIndex((r,k)=>k>0&&!r.forged&&pz.reports.slice(0,k).some(x=>x.region===r.region&&!x.forged)),r=pz.reports[i];
  const x=pz.reports.slice(0,i).find(y=>y.region===r.region&&!y.forged);
  const mins=t=>M.minutes(t),hm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const near={...J(r),callsign:x.callsign},m=mins(x.time)+(mins(x.time)<12*60?30:-30);Object.assign(near,{time:hm(m),freq:M.freqOf(pz,r.region,hm(m)),auth:M.authOf(pz,r.region,hm(m))});
  assert.ok(rules(near).includes('overlap'));assert.equal(M.compare(pz,near,'callsign','log:'+x.id).result,'mismatch');assert.ok(M.checksFor(pz,near,'callsign').includes('log:'+x.id));
  const far={...near};const m2=mins(x.time)+(mins(x.time)<12*60?50:-50);Object.assign(far,{time:hm(m2),freq:M.freqOf(pz,r.region,hm(m2)),auth:M.authOf(pz,r.region,hm(m2))});
  assert.ok(!rules(far).includes('overlap'));assert.match(M.compare(pz,far,'callsign','log:'+x.id).text,/50 minutes apart: time enough/);
  const alt=M.borders(pz,r.region).find(n=>n!==x.from);
  if(alt){const c={...J(r),from:alt};assert.ok(rules(c).includes('contradict'));assert.match(M.compare(pz,c,'from','log:'+x.id).text,/this one says/);}
  assert.equal(M.compare(pz,r,'callsign','log:'+r.id).result,'unrelated','a manifest is not in the log before it is stamped');
  assert.ok(M.checksFor(pz,pz.reports[0],'from').every(e=>!e.startsWith('log:')),'the first manifest has no log to check');
}
// Easy desk: no production log or regulations, so those rules do not apply and those lines do not exist.
{
  const pz=M.generate(3,'easy'),r=pz.reports.find(x=>!x.forged);
  assert.ok(!M.entries(pz).some(e=>/^(sensor|rule|map|auth|log|sig):/.test(e)));assert.ok(M.entries(pz).includes('guide:chaff'));
  assert.deepEqual(M.audit(pz,{...r,cond:'Vacuum-sealed',sighting:[M.sightItem(null,pz,'kit',40)]}).map(v=>v.rule),[],'unseen documents set no rules');
}

// Moves: invalid ones leave the state untouched; stamping, unstamping and evidence.
{
  const pz=M.generate(11,'hard'),st=M.create(pz),keep=()=>JSON.stringify(st);
  const bad=(m,re)=>{const before=keep();assert.match(String(M.apply(pz,st,m)),re);assert.equal(keep(),before,'invalid move must not change state');};
  bad(null,/No move/);bad({type:'jump'},/Unknown/);bad({type:'unstamp'},/Nothing stamped/);bad({type:'stamp',verdict:'maybe'},/VERIFIED or FORGED/);
  bad({type:'compare',field:'nose',entry:'roster:'+pz.regions[0]},/no such field/);bad({type:'compare',field:'callsign',entry:'roster:Atlantis'},/No such document/);
  bad({type:'compare',field:'sight:9',entry:'roster:'+pz.regions[0]},/no such field/);
  const easy=M.generate(11,'easy');assert.match(String(M.apply(easy,M.create(easy),{type:'compare',field:'cond',entry:'sensor:'+easy.regions[0]})),/No such document/);
  const r0=pz.reports[0];
  assert.equal(M.apply(pz,st,{type:'compare',field:'region',entry:'roster:'+r0.region}),null);assert.equal(st.evidence[0],null,'a match is not evidence');assert.equal(st.compares,1);
  if(r0.forged){M.apply(pz,st,{type:'compare',field:r0.tell.field,entry:r0.tell.entry});assert.ok(st.evidence[0].text.length>0);}
  assert.equal(M.apply(pz,st,{type:'stamp',verdict:'forged'}),null);assert.equal(st.cursor,1);assert.equal(st.stamps[0],'forged');
  bad({type:'compare',field:'callsign',entry:'roster:'+pz.regions[0]+'x'},/No such document/);
  assert.equal(M.apply(pz,st,{type:'unstamp'}),null);assert.equal(st.cursor,0);assert.equal(st.stamps[0],null);
  const done=run(pz,M.solve(pz));assert.match(String(M.apply(pz,done,{type:'stamp',verdict:'verified'})),/already stamped/);
  assert.match(String(M.apply(pz,done,{type:'compare',field:'callsign',entry:'roster:'+pz.regions[0]})),/already stamped/);
}

// Tiers and score.
{
  const pz=M.generate(21,'hard'),T=truth(pz),flip=(k)=>{const v=T.slice();let c=0;for(let i=0;i<v.length&&c<k;i++){v[i]=v[i]==='forged'?'verified':'forged';c++;}return v;};
  const perfect=M.evaluate(pz,stampAll(pz,T)),good=M.evaluate(pz,stampAll(pz,T,false));
  assert.equal(M.tier(pz,perfect),'perfect');assert.equal(M.tier(pz,good),'good','FORGED without evidence is Good');
  assert.equal(M.tier(pz,M.evaluate(pz,stampAll(pz,flip(1)))),'partial');assert.equal(M.tier(pz,M.evaluate(pz,stampAll(pz,flip(2)))),'partial');
  assert.equal(M.tier(pz,M.evaluate(pz,stampAll(pz,flip(3)))),'failed');
  assert.equal(M.tier(pz,M.evaluate(pz,M.create(pz))),'failed','nothing stamped');
  assert.ok(M.score(pz,perfect,1000)>M.score(pz,good,1000));assert.ok(M.score(pz,perfect,1000)>M.score(pz,perfect,pz.target*1500));
  assert.ok(M.score(pz,perfect,1000,0)>M.score(pz,perfect,1000,2),'hints cost score');
  // Near-miss names the sabotage and the field that gave it away; consequences name the front or the lab.
  const fi=pz.reports.findIndex(r=>r.forged),v=T.slice();v[fi]='verified';const st=stampAll(pz,v);const rep=pz.reports[fi];
  const line=M.nearMiss(pz,st);assert.ok(line.startsWith(`Manifest ${rep.no} (${rep.callsign}, ${rep.region}) was Null sabotage; its ${M.fieldLabel(pz,rep,rep.tell.field)} gave it away`),line);
  const cons=M.consequences(pz,st)[0];
  if(rep.tell.field.startsWith('spec:'))assert.match(cons,/^A mislabelled \w+ sample on manifest \d+ cost the lab a night on the wrong species\.$/);
  else{assert.match(cons,/^Approved a sabotaged convoy: /);assert.ok(cons.includes(M.destLong(pz,rep.dest)),cons);}
  const out=M.output(pz,st),nf=T.filter(v=>v==='forged').length,ng=T.length-nf;
  assert.ok(out.startsWith(`Shipments cleared: ${ng} verified, ${nf-1} sabotaged convoy${nf-1===1?'':'s'} stopped. Slipped through: 1 sabotaged convoy (manifest ${rep.no}).`),out);
  assert.match(out,/\[includes a sabotaged convoy\]/);
  const clean=M.output(pz,stampAll(pz,T));assert.ok(clean.startsWith(`Shipments cleared: ${ng} verified, ${nf} sabotaged convoys stopped. Cleared: `),clean);
  assert.doesNotMatch(clean,/Slipped|sabotaged convoy\]|Held back/);
  for(const d of new Set(pz.reports.filter(r=>!r.forged).map(r=>r.dest)))assert.ok(clean.includes(d===M.LAB?'Ship’s lab (':M.destLong(pz,d)+' ('),'every destination with a cleared shipment is listed');
  const gi=pz.reports.findIndex(r=>!r.forged),v2=T.slice();v2[gi]='forged';const st2=stampAll(pz,v2);
  assert.match(M.nearMiss(pz,st2),/was genuine: every line matched/);assert.match(M.consequences(pz,st2)[0],/^A genuine convoy sat on the pad at .*: .* went without /);
  assert.match(M.output(pz,st2),/ Held back: 1 genuine convoy \(manifest \d+\)\./);
  assert.match(M.nearMiss(pz,stampAll(pz,T,false)),/rightly stamped FORGED, but without evidence/);
}

// Hints: always point at a field and a line that can be compared, and read the same for genuine and forged reports.
for(const d of ids)for(let seed=1;seed<=50;seed++){
  const pz=M.generate(seed,d),st=M.create(pz);
  for(const r of pz.reports){
    const h=M.hint(pz,st);assert.equal(h.report,r.id);
    assert.match(h.text,/^Check the .+ against .+\.$/);assert.doesNotMatch(h.text,/forg|genuine|Null|wrong/i,'hint never reveals the verdict');
    assert.equal(M.validate(pz,st,{type:'compare',field:h.field,entry:h.entry}),null);
    assert.equal(M.compare(pz,r,h.field,h.entry).result,r.forged?'mismatch':'match');
    M.apply(pz,st,{type:'stamp',verdict:r.forged?'forged':'verified'});
  }
  assert.equal(M.hint(pz,st),null);
}
// Assist tiers, one-tap and Check all: Check all finds every forgery's evidence but caps the round at Good unless free.
{
  assert.deepEqual(M.ASSISTS.map(a=>a.id),['classic','quick','relaxed']);assert.equal(M.assistOf('nope').id,'quick','Quick is the default');
  assert.equal(M.assistOf('classic').oneTap,false);assert.equal(M.assistOf('relaxed').freeCheckAll,true);
  const pz=M.generate(31,'expert'),T=truth(pz);
  const play=free=>{const st=M.create(pz);for(const v of T){assert.equal(M.apply(pz,st,{type:'checkall',free}),null);M.apply(pz,st,{type:'stamp',verdict:v});}return st;};
  const capped=M.evaluate(pz,play(false)),freeEv=M.evaluate(pz,play(true));
  assert.equal(capped.backed,capped.forged,'Check all finds every planted discrepancy');assert.equal(M.tier(pz,capped),'good','Quick: Check all caps at Good');
  assert.equal(M.tier(pz,freeEv),'perfect','Relaxed: Check all is free');
  // One-tap check per field records the same evidence as the two-tap compare.
  const fi=pz.reports.findIndex(r=>r.forged),st=M.create(pz);for(let i=0;i<fi;i++)M.apply(pz,st,{type:'stamp',verdict:T[i]});
  const r=pz.reports[fi];assert.equal(M.apply(pz,st,{type:'check',field:r.tell.field}),null);assert.equal(st.evidence[fi].entry,r.tell.entry);assert.equal(st.capped,false);
  assert.match(String(M.apply(pz,st,{type:'check',field:'nose'})),/no such field/);
  // Evidence auto-attach: stamping FORGED carries the evidence already found; VERIFIED does not.
  M.apply(pz,st,{type:'stamp',verdict:'forged'});assert.equal(st.attached[fi],true);
  M.apply(pz,st,{type:'unstamp'});assert.equal(st.attached[fi],false);M.apply(pz,st,{type:'stamp',verdict:'verified'});assert.equal(st.attached[fi],false);
  // Wrong comparisons get one gentle line on what to compare instead.
  const g=pz.reports.find(x=>!x.forged),other=pz.regions.find(x=>x!==g.region);
  assert.match(M.explain(pz,g,'callsign','roster:'+other).text,new RegExp(`this manifest comes from ${g.region}\\. Compare the callsign with the ${g.region} line of the depot roster\\.`));
  assert.match(M.explain(pz,g,'freq',`freq:${g.region}:${1-M.watchOf(g.time)}`).text,/Compare the transponder code with .* code on the transponder table\./);
  assert.match(M.explain(pz,g,'cond','roster:'+g.region).text,/Compare the handling with the .* production log/);
}
// Citations: a wrong stamp names the report, the kind and the proof; a repeated rule says so; a shredded genuine report
// names the checks that showed it clean. The consequence tick turns bad when a sabotaged convoy is loading.
for(const [seed,d] of [[21,'hard'],[23,'expert'],[3,'easy']]){
  const pz=M.generate(seed,d),T=truth(pz),wrong=T.map(v=>v==='forged'?'verified':'forged'),st=stampAll(pz,wrong,false);
  const cs=M.citations(pz,st);assert.equal(cs.length,pz.reports.length,'every wrong stamp earns a citation');
  const seen={};
  for(const c of cs){
    const r=pz.reports[c.report];
    if(r.forged){
      assert.equal(c.kind,'approved');assert.ok(c.text.startsWith(`CITATION · Manifest ${r.no} was Null sabotage: `),c.text);
      assert.ok(c.text.toLowerCase().includes(M.compare(pz,r,r.tell.field,r.tell.entry).text.toLowerCase().slice(0,-1)),c.text);
      assert.equal(c.field,r.tell.field);assert.equal(c.entry,r.tell.entry);
      seen[r.tell.rule]=(seen[r.tell.rule]||0)+1;assert.equal(c.repeat,seen[r.tell.rule]);
      if(c.repeat===2)assert.match(c.text,/That is the second time .* caught you\./);else if(c.repeat===1)assert.doesNotMatch(c.text,/caught you/);
    }else{
      assert.equal(c.kind,'shredded');assert.match(c.text,new RegExp(`^CITATION · Manifest ${r.no} was genuine: .+\\.`));
      assert.equal(c.field,r.trap.field,'the near miss leads the clean checks');
    }
  }
  const rightSt=stampAll(pz,T);assert.deepEqual(M.citations(pz,rightSt),[],'no citation for right stamps');
  // The tick names the convoy, its destination and the manifest; it is bad when sabotaged paperwork is loading.
  const fi=pz.reports.findIndex(r=>r.forged),st2=M.create(pz);for(let i=0;i<=fi;i++)M.apply(pz,st2,{type:'stamp',verdict:'verified'});
  const tk=M.tick(pz,st2),r=pz.reports[fi];assert.equal(tk.bad,true);assert.match(tk.text,new RegExp(`^Convoy ${r.callsign} is loading for ${M.destName(pz,r.dest)} based on manifest ${r.no}: sabotaged paperwork\\.$`));
  assert.equal(M.tick(pz,M.create(pz)).bad,false);
}
{ // A repeated rule: two approved forgeries of one rule (built by hand; a generated round never repeats a kind).
  const pz=M.generate(4,'hard'),f=pz.reports.find(r=>r.forged);pz.reports=[0,1,2].map(i=>({...JSON.parse(JSON.stringify(f)),id:i,no:i+1}));
  const cs=M.citations(pz,stampAll(pz,['verified','verified','verified'],false));
  assert.deepEqual(cs.map(c=>c.repeat),[1,2,3]);assert.match(cs[1].text,/That is the second time .* caught you\./);assert.match(cs[2].text,/third time/);
}
// The night shift (Endless): night 1 has one tell; each night adds one (up to four), then swaps one; every night's desk
// verifies and exercises its new tell; three mistakes end a run; the personal best is kept.
let endlessDays=0;
for(let seed=1;seed<=25;seed++){
  let prev=null;
  for(let day=1;day<=12;day++){
    const {rules,change}=M.endlessRules(seed,day),ids2=rules.map(x=>x.id);
    assert.deepEqual(M.endlessRules(seed,day),{rules,change},'deterministic');
    assert.equal(new Set(ids2).size,ids2.length);assert.ok(ids2.includes(change.added));
    const typed=rules.flatMap(x=>[x.type,x.a,x.b].filter(Boolean));assert.equal(new Set(typed).size,typed.length,'tells never share a cargo kind');
    if(day===1){assert.equal(rules.length,1);assert.equal(change.type,'add');}
    else{
      const before=prev.map(x=>x.id),gone=before.filter(x=>!ids2.includes(x)),fresh=ids2.filter(x=>!before.includes(x));
      assert.deepEqual(fresh,[change.added],`seed ${seed} day ${day}: exactly one new tell`);
      if(before.length<M.ENDLESS.maxTells){assert.equal(change.type,'add');assert.deepEqual(gone,[]);assert.equal(rules.length,before.length+1);}
      else{assert.equal(change.type,'swap');assert.deepEqual(gone,[change.removed]);assert.equal(rules.length,M.ENDLESS.maxTells);}
    }
    prev=rules;
    if(day<=10){
      const pz=M.endlessDay(seed,day),entries=M.entries(pz);endlessDays++;
      assert.equal(pz.reports.length,M.ENDLESS.perDay);assert.equal(pz.reports.filter(r=>r.forged).length,M.ENDLESS.forgedPerDay);
      assert.deepEqual(pz.rules.map(x=>x.id),ids2);assert.equal(pz.endless.day,day);assert.match(pz.newRule.text,new RegExp(`^Night ${day}: `));
      assert.ok(pz.reports.some(r=>r.forged&&r.tell.rule===change.added),'the new tell is exercised');
      for(const r of pz.reports){
        assert.equal(M.audit(pz,r).length,r.forged?1:0);const rs=new Set();
        for(const f of M.fields(r))for(const e of entries){const c=M.compare(pz,r,f,e);if(c.result==='mismatch')rs.add(c.rule);}
        assert.deepEqual([...rs],r.forged?[r.tell.rule]:[],'endless comparisons agree with the audit');
      }
    }
  }
}
{
  let run=M.endlessRun();run=M.endlessStep(run,'right');run=M.endlessStep(run,'wrong');run=M.endlessStep(run,'timeout');assert.equal(run.over,false);
  run=M.endlessStep(run,'day');assert.deepEqual(run,{day:2,cleared:1,mistakes:2,over:false});run=M.endlessStep(run,'wrong');assert.equal(run.over,true,'three mistakes end the run');
  const mem={},store={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=v;}};
  assert.deepEqual(M.recordBest(store,6),{best:6,previous:0,isNew:true});assert.equal(mem[M.BEST_KEY],'6');
  assert.deepEqual(M.recordBest(store,4),{best:6,previous:6,isNew:false});assert.equal(mem[M.BEST_KEY],'6');
  assert.deepEqual(M.recordBest(store,9),{best:9,previous:6,isNew:true});
  assert.deepEqual(M.recordBest({getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}},3),{best:3,previous:0,isNew:true},'storage failures are survivable');
}
const secs=((Date.now()-t0)/1000).toFixed(1);
console.log(`PASS intel-check model (manifests): determinism; ${SEEDS}×${ids.length} seeds verified incl. Veteran (genuine manifests clean with a near miss, every sabotaged manifest exactly one planted discrepancy on the desk, ${compares} player comparisons agree with the audit, newest rules exercised, checks spread by level, specimen crates on lab shipments only, slowest generation ${slowest}ms); field guide specimen labels, seals, transponder signatures, cargo scans, route map, code table and cross-manifest edges; 10-tell regulations pool; closure/maintenance/slot/shift/line-limit/pair/never-alone/pairs/pallet/packing/few/wrong-line edges; atomic invalid moves; tiers incl. FORGED without evidence = Good; auto below Perfect; verdict-neutral hints; near-miss, consequences and the shipments-cleared output; assist tiers (Check all caps Quick at Good, free in Relaxed), one-tap reaches every tell, evidence auto-attach, citations incl. repeats and held-back genuine, consequence tick; night shift: ${endlessDays} nights verified, one tell added or swapped per night and always exercised, three mistakes end a run, personal best kept (${secs}s)`);
