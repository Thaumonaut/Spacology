import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptResult,canRetry,chooseApproach,chooseDestination,createSession,depart,JOBS,previewEncounter,requestKit,restoreSession,startJob} from '../src/lib/session.ts';
import type {Receipt,Session,Stats} from '../src/lib/session.ts';

const STATS:Stats={Guard:5,Pace:0,Burst:0,Mend:3};
const research=(removed:string[]=['Archive lock'],weakened:string[]=[],weakness:string|null='decay'):Receipt=>({tier:'good',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed,weakened,weakness}});
const gear=(kits:{crew:string;stats:Stats}[]=[{crew:'Daven',stats:STATS}]):Receipt=>({tier:'perfect',output:'',delivery:{kind:'gear',kits}});
const cargo=(shippedIds:number[]=[0,1,2,3,4,5,6,7,8]):Receipt=>({tier:'perfect',output:'',delivery:{kind:'cargo',shippedIds,total:9}});
const open=(s:Session,job:keyof typeof JOBS)=>startJob(s,job);
const deliver=(s:Session,job:keyof typeof JOBS,r:Receipt)=>acceptResult(s,job,s.tasks[job].attempt,r);

test('clean initial session',()=>{
  const s=createSession('r1');
  assert.equal(s.phase,'night');assert.equal(s.destination,'ridge');assert.equal(s.approach,'careful');
  assert.equal(s.requested,false);assert.equal(s.report,null);assert.deepEqual(s.log,[]);
  for(const j of ['study','assembly','dispatch'] as const)assert.deepEqual(s.tasks[j],{attempt:0,status:'idle',receipt:null});
});

test('duplicate request is a no-op and does not spam the log',()=>{
  let s=createSession('r1');
  s=requestKit(s);assert.equal(s.requested,true);
  const s2=requestKit(s);assert.equal(s2,s);assert.equal(s2.log.length,1);
});

test('dispatch before the kit is built is a no-op',()=>{
  const s=createSession('r1');
  assert.equal(startJob(s,'dispatch'),s);
  assert.equal(s.tasks.dispatch.status,'idle');
});

test('study can start before anything else; research result shapes the encounter',()=>{
  let s=createSession('r1');
  s=open(s,'study');
  s=deliver(s,'study',research(['Archive lock']));
  const e=previewEncounter(s);
  assert.equal(e.breakdown.find(b=>b.label==='Boss study')!.value,2,'removed buff scores +2');
  assert.equal(e.research!.weakness,'decay');
  let s2=createSession('r2');s2=open(s2,'study');s2=deliver(s2,'study',research([],['Archive lock'],null));
  assert.equal(previewEncounter(s2).breakdown.find(b=>b.label==='Boss study')!.value,1,'weakened buff scores +1');
});

test('no kits means no kit bonus and not equipped',()=>{
  let s=createSession('r1');
  s=open(s,'assembly');s=deliver(s,'assembly',gear([]));
  const e=previewEncounter(s);
  assert.equal(e.breakdown.find(b=>b.label==="Daven's kit")!.value,0);
  assert.equal(e.equipped,false);assert.equal(e.gear,null);
});

test('exact Daven stats from the gear receipt feed the kit bonus',()=>{
  let s=createSession('r1');
  s=open(s,'assembly');s=deliver(s,'assembly',gear([{crew:'Daven',stats:STATS}]));
  s=open(s,'dispatch');s=deliver(s,'dispatch',cargo());
  const e=previewEncounter(s);
  assert.equal(e.equipped,true);
  assert.deepEqual(e.gear,STATS);
  assert.equal(e.breakdown.find(b=>b.label==="Daven's kit")!.value,Math.floor((5+3)/3));
});

test('kit built but not launched gives no kit bonus',()=>{
  let s=createSession('r1');
  s=open(s,'assembly');s=deliver(s,'assembly',gear());
  s=open(s,'dispatch');s=deliver(s,'dispatch',cargo([1,2,3,4,5]));
  const e=previewEncounter(s);
  assert.equal(e.equipped,false);
  assert.equal(e.breakdown.find(b=>b.label==="Daven's kit")!.value,0);
  assert.equal(e.breakdown.find(b=>b.label==='Supplies')!.value,1,'4 supply crates still count');
});

test('cargo missing crate 0 does not equip the kit even at a good tier',()=>{
  let s=createSession('r1');
  s=open(s,'assembly');s=deliver(s,'assembly',gear());
  s=open(s,'dispatch');s=deliver(s,'dispatch',cargo([1,2,3,4,5,6,7,8]));
  const e=previewEncounter(s);
  assert.equal(e.equipped,false);
});

test('crate 0 aboard equips the kit',()=>{
  let s=createSession('r1');
  s=open(s,'assembly');s=deliver(s,'assembly',gear());
  s=open(s,'dispatch');s=deliver(s,'dispatch',cargo([0]));
  assert.equal(previewEncounter(s).equipped,true);
});

test('supplies bonus needs at least four other crates',()=>{
  let s=createSession('r1');
  s=open(s,'assembly');s=deliver(s,'assembly',gear());
  s=open(s,'dispatch');s=deliver(s,'dispatch',cargo([0,1,2,3]));
  assert.equal(previewEncounter(s).supplied,3);
  assert.equal(previewEncounter(s).breakdown.find(b=>b.label==='Supplies')!.value,0);
  let s2=createSession('r2');
  s2=open(s2,'assembly');s2=deliver(s2,'assembly',gear());
  s2=open(s2,'dispatch');s2=deliver(s2,'dispatch',cargo([0,1,2,3,4]));
  assert.equal(previewEncounter(s2).breakdown.find(b=>b.label==='Supplies')!.value,1);
});

test('duplicate, foreign and stale results are ignored',()=>{
  let s=createSession('r1');
  s=open(s,'study');const attempt=s.tasks.study.attempt;
  s=deliver(s,'study',research());
  const after=s;
  assert.equal(acceptResult(s,'study',attempt,research()),after,'second result on a completed task');
  assert.equal(acceptResult(s,'study',attempt+1,research()),after,'foreign attempt number');
  assert.equal(acceptResult(s,'study',attempt-1,research()),after,'stale attempt number');
  const wrongKind={tier:'good',output:'',delivery:{kind:'cargo',shippedIds:[0],total:9}} as unknown as Receipt;
  assert.equal(acceptResult(s,'study',attempt,wrongKind),after,'delivery kind must match the job');
});

test('results after departure are ignored and the snapshot does not change',()=>{
  let s=createSession('r1');
  s=depart(s);
  const after=s;
  assert.equal(open(s,'study'),after,'no jobs after report');
  assert.equal(requestKit(s),after,'no requests after report');
  assert.equal(chooseDestination(s,'shelf'),after);
  const r=research();
  assert.equal(acceptResult(s,'study',1,r),after);
  assert.equal(depart(s),after,'depart is idempotent');
  assert.equal(s.report,after.report);
});

test('failed and auto results keep their real partial effects',()=>{
  let s=createSession('r1');
  s=open(s,'study');s=deliver(s,'study',{tier:'auto',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed:[],weakened:['Archive lock'],weakness:null}});
  assert.equal(previewEncounter(s).breakdown.find(b=>b.label==='Boss study')!.value,1,'auto weakens only');
  let s2=createSession('r2');
  s2=open(s2,'assembly');s2=deliver(s2,'assembly',{tier:'failed',output:'',delivery:{kind:'gear',kits:[]}});
  assert.equal(startJob(s2,'dispatch'),s2,'failed assembly still cannot dispatch');
  let s3=createSession('r3');
  s3=open(s3,'assembly');s3=deliver(s3,'assembly',gear());
  s3=open(s3,'dispatch');s3=deliver(s3,'dispatch',{tier:'failed',output:'',delivery:{kind:'cargo',shippedIds:[],total:9}});
  const e=previewEncounter(s3);
  assert.equal(e.equipped,false);assert.equal(e.supplied,0);
});

test('malformed deliveries and tiers are rejected',()=>{
  let s=createSession('r1');
  s=open(s,'study');s=open(s,'assembly');
  const a=s.tasks.assembly.attempt,st=s.tasks.study.attempt;
  const bad:Receipt[]=[
    {tier:'epic',output:'',delivery:{kind:'gear',kits:[]}},
    {tier:'good',output:'',delivery:{kind:'gear',kits:[{crew:'Daven',stats:{Guard:NaN,Pace:0,Burst:0,Mend:0}}]}},
    {tier:'good',output:'',delivery:{kind:'gear',kits:[{crew:'Daven',stats:{Guard:'5',Pace:0,Burst:0,Mend:0} as unknown as Stats}]}},
    {tier:'good',output:'',delivery:{kind:'gear',kits:[{crew:'Daven',stats:{Guard:101,Pace:0,Burst:0,Mend:0}}]}},
    {tier:'good',output:'',delivery:{kind:'gear',kits:[{crew:'Daven',stats:{Guard:1.5,Pace:0,Burst:0,Mend:0}}]}},
    {tier:'good',output:'',delivery:{kind:'gear',kits:[{crew:'Mara',stats:STATS}]}},
    {tier:'good',output:'',delivery:{kind:'cargo',shippedIds:[0,0],total:9}},
    {tier:'good',output:'',delivery:{kind:'cargo',shippedIds:[0,9],total:9}},
    {tier:'good',output:'',delivery:{kind:'cargo',shippedIds:[0],total:8}},
    {tier:'good',output:'',delivery:{kind:'cargo',shippedIds:'abc' as unknown as number[],total:9}},
    {tier:'good',output:'',delivery:{kind:'research',boss:'The Bell Below',removed:['Archive lock'],weakened:[],weakness:null}},
    {tier:'good',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed:['Unknown buff'],weakened:[],weakness:null}},
    {tier:'good',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed:['Archive lock'],weakened:['Archive lock'],weakness:null}},
    {tier:'good',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed:[],weakened:[],weakness:'plasma'}},
    {tier:'good',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed:['Archive lock','Catalogue relay'],weakened:['Archive lock'],weakness:null}},
  ];
  for(const r of bad){
    assert.equal(acceptResult(s,'assembly',a,r),s,`assembly rejects ${JSON.stringify(r.delivery)}`);
    assert.equal(acceptResult(s,'study',st,r),s,`study rejects ${JSON.stringify(r.delivery)}`);
  }
});

test('an active job cannot be started again',()=>{
  let s=createSession('r1');
  s=open(s,'study');
  assert.equal(startJob(s,'study'),s);
  assert.equal(s.tasks.study.attempt,1);
});

test('retry rules keep completed effects from stacking',()=>{
  let s=createSession('r1');
  s=open(s,'study');s=deliver(s,'study',research(['Archive lock']));
  assert.equal(startJob(s,'study'),s,'cannot re-study after a removal');
  let s2=createSession('r2');
  s2=open(s2,'study');s2=deliver(s2,'study',research([],['Archive lock'],null));
  assert.notEqual(startJob(s2,'study'),s2,'retry allowed after weaken-only');
  let s3=createSession('r3');
  s3=open(s3,'assembly');s3=deliver(s3,'assembly',gear());
  assert.equal(startJob(s3,'assembly'),s3,'cannot rebuild a delivered kit');
  s3=open(s3,'dispatch');s3=deliver(s3,'dispatch',cargo());
  assert.equal(startJob(s3,'dispatch'),s3,'cannot resend a delivered kit');
  let s4=createSession('r4');
  s4=open(s4,'assembly');s4=deliver(s4,'assembly',gear());
  s4=open(s4,'dispatch');s4=deliver(s4,'dispatch',cargo([1,2,3]));
  assert.notEqual(startJob(s4,'dispatch'),s4,'retry allowed while the kit is still on the dock');
});

test('default ridge departure fails, shelf succeeds',()=>{
  const ridge=depart(createSession('r1'));
  assert.equal(ridge.report!.success,false);
  assert.equal(ridge.report!.strength,5);assert.equal(ridge.report!.difficulty,9);
  assert.equal(ridge.report!.archive,0);
  let shelf=createSession('r2');shelf=chooseDestination(shelf,'shelf');shelf=depart(shelf);
  assert.equal(shelf.report!.success,true);assert.equal(shelf.report!.strength,5);
  assert.equal(shelf.report!.difficulty,5);assert.equal(shelf.report!.archive,1);
});

test('full manual fixture: ridge succeeds at strength 10',()=>{
  let s=createSession('r1');
  s=open(s,'study');s=deliver(s,'study',research(['Archive lock'],[],'decay'));
  s=open(s,'assembly');s=deliver(s,'assembly',gear([{crew:'Daven',stats:STATS}]));
  s=open(s,'dispatch');s=deliver(s,'dispatch',cargo());
  s=depart(s);
  const r=s.report!;
  assert.equal(r.strength,10);assert.equal(r.difficulty,9);assert.equal(r.success,true);assert.equal(r.archive,3);
  assert.equal(r.equipped,true);assert.equal(r.supplied,8);
});

test('restoration is strict and unfinished work returns to idle',()=>{
  let s=createSession('r1');
  s=requestKit(s);
  s=open(s,'study');s=deliver(s,'study',research());
  s=open(s,'assembly');
  const snapshot=JSON.parse(JSON.stringify(s));
  const r=restoreSession(snapshot);
  assert.ok(r);assert.equal(r!.runId,'r1');assert.equal(r!.requested,true);
  assert.equal(r!.tasks.assembly.status,'idle','active task restarts as idle');
  assert.equal(r!.tasks.assembly.attempt,1,'attempt counter kept so old tokens die');
  assert.equal(r!.tasks.study.status,'complete');
  const n=acceptResult(r!,'assembly',1,gear());
  assert.equal(n,r,'the interrupted attempt token is rejected');
  const cases:unknown[]=[null,{},'x',{...snapshot,version:2},{...snapshot,phase:'dawn'},{...snapshot,destination:'cave'},
    {...snapshot,tasks:{}},{...snapshot,tasks:{...snapshot.tasks,study:{attempt:0,status:'done',receipt:null}}},
    {...snapshot,tasks:{...snapshot.tasks,study:{attempt:0,status:'complete',receipt:{tier:'epic',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed:[],weakened:[],weakness:null}}}}},
    {...snapshot,log:'x'},{...snapshot,log:[{department:'ghost',text:'hi'}]},{...snapshot,phase:'report'},
    {...snapshot,phase:'report',report:{strength:'high'}}];
  for(const c of cases)assert.equal(restoreSession(c),null,`rejects ${JSON.stringify(c)}`);
  const report=restoreSession(JSON.parse(JSON.stringify(depart(s))));
  assert.ok(report);assert.equal(report!.phase,'report');assert.equal(report!.report!.success,false);
});

test('reset produces a distinct run with empty receipts',()=>{
  const a=createSession('a'),b=createSession('b');
  assert.notEqual(a.runId,b.runId);
  for(const j of ['study','assembly','dispatch'] as const)assert.equal(b.tasks[j].receipt,null);
});

test('hostile and duplicated research names are rejected without throwing',()=>{
  let s=createSession('r1');s=open(s,'study');
  const hostile={tier:'good',output:'',delivery:{kind:'research',boss:'constructor',removed:['x'],weakened:[],weakness:null}} as unknown as Receipt;
  assert.doesNotThrow(()=>acceptResult(s,'study',s.tasks.study.attempt,hostile));
  assert.equal(acceptResult(s,'study',s.tasks.study.attempt,hostile),s);
  const dup={tier:'good',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed:['Archive lock','Archive lock'],weakened:[],weakness:null}} as unknown as Receipt;
  assert.equal(acceptResult(s,'study',s.tasks.study.attempt,dup),s,'duplicate names rejected');
  const dupAcross={tier:'good',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed:['Archive lock'],weakened:['Catalogue relay','Catalogue relay'],weakness:null}} as unknown as Receipt;
  assert.equal(acceptResult(s,'study',s.tasks.study.attempt,dupAcross),s);
});

test('gear delivery contract: single kit, met order stats only',()=>{
  let s=createSession('r1');s=open(s,'assembly');const a=s.tasks.assembly.attempt;
  assert.equal(acceptResult(s,'assembly',a,gear([{crew:'Daven',stats:STATS},{crew:'Daven',stats:STATS}])),s,'duplicate kits rejected');
  assert.equal(acceptResult(s,'assembly',a,gear([{crew:'Daven',stats:{Guard:4,Pace:0,Burst:0,Mend:5}}])),s,'below-order kit rejected');
  assert.equal(acceptResult(s,'assembly',a,gear([{crew:'Daven',stats:{Guard:5,Pace:0,Burst:0,Mend:2}}])),s,'Mend below order rejected');
  assert.notEqual(acceptResult(s,'assembly',a,gear([])),s,'empty kits is a legitimate failure');
});

test('cargo validator exercised on an active dispatch',()=>{
  let s=createSession('r1');
  s=open(s,'assembly');s=deliver(s,'assembly',gear());
  s=open(s,'dispatch');const d=s.tasks.dispatch.attempt;
  for(const r of [
    {tier:'good',output:'',delivery:{kind:'cargo',shippedIds:[0,0],total:9}},
    {tier:'good',output:'',delivery:{kind:'cargo',shippedIds:[0,-1],total:9}},
    {tier:'good',output:'',delivery:{kind:'cargo',shippedIds:[0],total:8}},
    {tier:'good',output:'',delivery:{kind:'cargo',shippedIds:[0,1.5],total:9}},
  ] as unknown as Receipt[])assert.equal(acceptResult(s,'dispatch',d,r),s,`rejects ${JSON.stringify(r.delivery)}`);
});

test('accepted receipts are cloned, not aliased',()=>{
  let s=createSession('r1');s=open(s,'study');
  const r=research(['Archive lock']);
  s=deliver(s,'study',r);
  (r.delivery as {removed:string[]}).removed.push('Catalogue relay');
  (r as {tier:string}).tier='failed';
  assert.equal(s.tasks.study.receipt!.tier,'good');
  assert.deepEqual((s.tasks.study.receipt!.delivery as {removed:string[]}).removed,['Archive lock']);
});

test('restoration rejects incoherent task/receipt combinations',()=>{
  let base=createSession('r1');base=requestKit(base);
  base=open(base,'study');base=deliver(base,'study',research([],['Archive lock'],null));
  const raw=()=>JSON.parse(JSON.stringify(base));
  const cases:unknown[]=[
    {...raw(),tasks:{...raw().tasks,study:{attempt:0,status:'complete',receipt:null}}},
    {...raw(),tasks:{...raw().tasks,study:{attempt:0,status:'active',receipt:null}}},
    {...raw(),tasks:{...raw().tasks,study:{attempt:0,status:'idle',receipt:{tier:'good',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed:[],weakened:[],weakness:null}}}}},
    {...raw(),tasks:{...raw().tasks,dispatch:{attempt:1,status:'complete',receipt:{tier:'good',output:'',delivery:{kind:'cargo',shippedIds:[0],total:9}}}}},
    {...raw(),tasks:{...raw().tasks,dispatch:{attempt:1,status:'active',receipt:null}}},
  ];
  for(const c of cases)assert.equal(restoreSession(c),null,`rejects ${JSON.stringify(c)}`);
  const retry=raw();
  retry.tasks.study={attempt:2,status:'active',receipt:{tier:'auto',output:'',delivery:{kind:'research',boss:'CURATOR // LAST INSTRUCTION',removed:[],weakened:['Archive lock'],weakness:null}}};
  const r=restoreSession(retry);
  assert.ok(r,'a retried task keeps its previous receipt');
  assert.equal(r!.tasks.study.status,'idle');
  assert.equal(r!.tasks.study.receipt!.tier,'auto','baseline weakened result preserved');
  const built=raw();
  built.tasks.assembly={attempt:1,status:'complete',receipt:{tier:'good',output:'',delivery:{kind:'gear',kits:[{crew:'Daven',stats:STATS}]}}};
  built.tasks.dispatch={attempt:1,status:'complete',receipt:{tier:'good',output:'',delivery:{kind:'cargo',shippedIds:[0,1,2],total:9}}};
  assert.ok(restoreSession(built),'dispatch receipt fine when the kit exists');
});

test('restoration validates the report against the session',()=>{
  let s=createSession('r1');s=depart(s);
  const raw=()=>JSON.parse(JSON.stringify(s));
  assert.ok(restoreSession(raw()),'clean report restores');
  const bad=(mutate:(r:Record<string,unknown>)=>void)=>{const v=raw();mutate(v.report as Record<string,unknown>);return v;};
  for(const v of [
    bad(r=>{r.samples=2;}),bad(r=>{r.supplied=9;}),bad(r=>{r.archive=2;}),bad(r=>{r.difficulty=7;}),
    bad(r=>{r.gear={Guard:5,Pace:0,Burst:0,Mend:3};}),bad(r=>{r.equipped=true;}),
    bad(r=>{r.destination='shelf';}),bad(r=>{r.approach='direct';}),bad(r=>{r.strength=4.5;}),
    bad(r=>{r.research={boss:'The Bell Below',removed:[],weakened:[],weakness:null};}),
    bad(r=>{r.breakdown=[{label:'x',value:'y'}];}),
  ])assert.equal(restoreSession(v),null,`rejects ${JSON.stringify((v as Record<string,unknown>).report)}`);
  const night=JSON.parse(JSON.stringify(createSession('r9')));
  delete (night as Record<string,unknown>).report;
  assert.equal(restoreSession(night),null,'night session missing the report field is malformed');
  assert.equal(restoreSession({...night,report:undefined}),null,'explicit undefined report rejected');
});

test('canRetry mirrors the start rules for the UI',()=>{
  let s=createSession('r1');
  assert.equal(canRetry(s,'dispatch'),true,'idle dispatch reads as startable; the kit gate lives in startJob');
  s=open(s,'assembly');s=deliver(s,'assembly',gear());
  assert.equal(canRetry(s,'assembly'),false);
  assert.notEqual(startJob(s,'dispatch'),s,'dispatch opens once the kit exists');
});
