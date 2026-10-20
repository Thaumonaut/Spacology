export type Department='exploration'|'research'|'logistics';
export type Job='study'|'assembly'|'dispatch';
export type Stats={Guard:number;Pace:number;Burst:number;Mend:number};

export type Delivery=
  |{kind:'research';boss:string;removed:string[];weakened:string[];weakness:string|null}
  |{kind:'gear';kits:{crew:string;stats:Stats}[]}
  |{kind:'cargo';shippedIds:number[];total:number};

export type Receipt={tier:string;output:string;delivery:Delivery};
export type Task={attempt:number;status:'idle'|'active'|'complete';receipt:Receipt|null};

export type EncounterReport={
  destination:'ridge'|'shelf';
  approach:'careful'|'direct';
  strength:number;
  difficulty:number;
  success:boolean;
  archive:number;
  equipped:boolean;
  gear:Stats|null;
  supplied:number;
  research:{boss:string;removed:string[];weakened:string[];weakness:string|null}|null;
  breakdown:{label:string;value:number}[];
  samples:number;
};

export type Session={
  version:1;
  runId:string;
  phase:'night'|'report';
  destination:'ridge'|'shelf';
  approach:'careful'|'direct';
  requested:boolean;
  tasks:Record<Job,Task>;
  report:EncounterReport|null;
  log:{department:Department;text:string}[];
};

export const JOBS={
  study:{game:'aether-attunement',seed:4,difficulty:'calm',department:'research'},
  assembly:{game:'gear-pack',seed:2,difficulty:'easy',department:'logistics'},
  dispatch:{game:'pallet-stacking',seed:3,difficulty:'single',department:'logistics'}
} as const;

export const STORAGE_KEY='spacologyExpeditionMockV1';

const TIERS=new Set(['perfect','good','partial','failed','auto']);
const ELEMENTS_SET=new Set(['order','chaos','growth','void','decay','energy']);
const DEPARTMENTS=new Set<Department>(['exploration','research','logistics']);
const JOBLIST:Job[]=['study','assembly','dispatch'];
const STAT_KEYS:(keyof Stats)[]=['Guard','Pace','Burst','Mend'];
const KNOWN_BUFFS:Record<string,string[]>={'CURATOR // LAST INSTRUCTION':['Archive lock','Catalogue relay']};
const CARGO_TOTAL=9;

const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null;
const fresh=(runId:string):Session=>({version:1,runId,phase:'night',destination:'ridge',approach:'careful',requested:false,
  tasks:{study:{attempt:0,status:'idle',receipt:null},assembly:{attempt:0,status:'idle',receipt:null},dispatch:{attempt:0,status:'idle',receipt:null}},
  report:null,log:[]});
const say=(s:Session,department:Department,text:string):Session=>({...s,log:[...s.log,{department,text}].slice(-50)});

export function createSession(runId:string):Session{
  return fresh(runId);
}

export function requestKit(s:Session):Session{
  if(s.phase!=='night'||s.requested)return s;
  return say({...s,requested:true},'exploration',"Exploration requested Daven's field kit from Logistics.");
}

export function chooseDestination(s:Session,value:'ridge'|'shelf'):Session{
  if(s.phase!=='night'||(value!=='ridge'&&value!=='shelf')||value===s.destination)return s;
  return say({...s,destination:value},'exploration',value==='ridge'?'Destination set: the ridge archive, the harder climb.':'Destination set: the sheltered shelf, a smaller archive.');
}

export function chooseApproach(s:Session,value:'careful'|'direct'):Session{
  if(s.phase!=='night'||(value!=='careful'&&value!=='direct')||value===s.approach)return s;
  return say({...s,approach:value},'exploration',value==='careful'?'Approach set: careful, the crew takes its time.':'Approach set: direct, faster but exposed.');
}

function davenKit(s:Session):{crew:string;stats:Stats}|undefined{
  const d=s.tasks.assembly.receipt?.delivery;
  return d&&d.kind==='gear'?d.kits.find(k=>k.crew==='Daven'):undefined;
}

export function canRetry(s:Session,job:Job):boolean{
  const t=s.tasks[job];
  if(t.status!=='complete')return t.status==='idle';
  const d=t.receipt?.delivery;
  if(job==='study')return !!d&&d.kind==='research'&&d.removed.length===0;
  if(job==='assembly')return !d||d.kind!=='gear'||!d.kits.some(k=>k.crew==='Daven');
  return !d||d.kind!=='cargo'||!d.shippedIds.includes(0);
}

export function startJob(s:Session,job:Job):Session{
  if(s.phase!=='night')return s;
  const t=s.tasks[job];
  if(t.status==='active'||!canRetry(s,job))return s;
  if(job==='dispatch'&&!davenKit(s))return s;
  const text:Record<Job,string>={
    study:'Research opened the Curator sample in the lab.',
    assembly:"Logistics started assembling Daven's field kit.",
    dispatch:'Logistics started loading the convoy.'};
  return say({...s,tasks:{...s.tasks,[job]:{...t,attempt:t.attempt+1,status:'active'}}},JOBS[job].department,text[job]);
}

function validStats(v:unknown):v is Stats{
  if(!isObject(v))return false;
  for(const k of Object.keys(v))if(!(STAT_KEYS as string[]).includes(k))return false;
  return STAT_KEYS.every(k=>Number.isInteger(v[k])&&(v[k] as number)>=0&&(v[k] as number)<=100);
}

function validDelivery(job:Job,d:unknown):d is Delivery{
  if(!isObject(d))return false;
  if(job==='study'){
    if(d.kind!=='research'||typeof d.boss!=='string'||!Object.hasOwn(KNOWN_BUFFS,d.boss))return false;
    const names=KNOWN_BUFFS[d.boss];
    if(!Array.isArray(d.removed)||!Array.isArray(d.weakened))return false;
    if(!d.removed.every(n=>typeof n==='string'&&names.includes(n)))return false;
    if(!d.weakened.every(n=>typeof n==='string'&&names.includes(n)))return false;
    const affected=[...d.removed,...d.weakened];
    if(affected.length>2||new Set(affected).size!==affected.length)return false;
    return d.weakness===null||(typeof d.weakness==='string'&&ELEMENTS_SET.has(d.weakness));
  }
  if(job==='assembly'){
    if(d.kind!=='gear'||!Array.isArray(d.kits)||d.kits.length>1)return false;
    return d.kits.every(k=>isObject(k)&&k.crew==='Daven'&&validStats(k.stats)&&k.stats.Guard>=5&&k.stats.Mend>=3);
  }
  if(d.kind!=='cargo'||d.total!==CARGO_TOTAL||!Array.isArray(d.shippedIds))return false;
  return d.shippedIds.length<=CARGO_TOTAL&&d.shippedIds.every(id=>Number.isInteger(id)&&id>=0&&id<CARGO_TOTAL)&&new Set(d.shippedIds).size===d.shippedIds.length;
}

function validReceipt(job:Job,r:unknown):r is Receipt{
  return isObject(r)&&typeof r.tier==='string'&&TIERS.has(r.tier)&&typeof r.output==='string'&&validDelivery(job,r.delivery);
}

export function acceptResult(s:Session,job:Job,attempt:number,receipt:Receipt):Session{
  if(s.phase!=='night')return s;
  const t=s.tasks[job];
  if(t.status!=='active'||t.attempt!==attempt||!validReceipt(job,receipt))return s;
  receipt=structuredClone(receipt);
  const d=receipt.delivery;
  let text:string;
  if(d.kind==='research'){
    const bits=[d.removed.length?`removed ${d.removed.join(', ')}`:'nothing removed',d.weakened.length?`weakened ${d.weakened.join(', ')}`:'',d.weakness?`weakness found: ${d.weakness}`:''].filter(Boolean);
    text=`Study delivered (${receipt.tier}): ${bits.join(' · ')}.`;
  }else if(d.kind==='gear'){
    const kit=d.kits.find(k=>k.crew==='Daven');
    text=kit?`Assembly delivered (${receipt.tier}): Daven's kit ready, Guard ${kit.stats.Guard} / Mend ${kit.stats.Mend}.`:`Assembly finished (${receipt.tier}): no kit for Daven met its order.`;
  }else{
    text=`Dispatch delivered (${receipt.tier}): ${d.shippedIds.length} of ${d.total} crates away${d.shippedIds.includes(0)?", Daven's kit aboard":"; Daven's kit left behind"}.`;
  }
  return say({...s,tasks:{...s.tasks,[job]:{...t,status:'complete',receipt}}},JOBS[job].department,text);
}

export function previewEncounter(s:Session):EncounterReport{
  const research=s.tasks.study.receipt?.delivery.kind==='research'?s.tasks.study.receipt.delivery:null;
  const gear=s.tasks.assembly.receipt?.delivery.kind==='gear'?s.tasks.assembly.receipt.delivery.kits.find(k=>k.crew==='Daven'):undefined;
  const cargo=s.tasks.dispatch.receipt?.delivery.kind==='cargo'?s.tasks.dispatch.receipt.delivery:null;
  const equipped=!!gear&&!!cargo?.shippedIds.includes(0);
  const supplied=cargo?cargo.shippedIds.filter(id=>id!==0).length:0;
  const base=4;
  const approach=s.approach==='careful'?1:0;
  const study=(research?.removed.length||0)*2+(research?.weakened.length||0);
  const kit=equipped?Math.floor((gear.stats.Guard+gear.stats.Mend)/3):0;
  const supply=supplied>=4?1:0;
  const strength=base+approach+study+kit+supply;
  const difficulty=s.destination==='ridge'?9:5;
  const success=strength>=difficulty;
  const archive=success?(s.destination==='ridge'?3:1):0;
  return {destination:s.destination,approach:s.approach,strength,difficulty,success,archive,equipped,
    gear:equipped&&gear?{...gear.stats}:null,supplied,
    research:research?{boss:research.boss,removed:[...research.removed],weakened:[...research.weakened],weakness:research.weakness}:null,
    breakdown:[{label:'Field crew',value:base},{label:s.approach==='careful'?'Careful approach':'Direct approach',value:approach},
      {label:'Boss study',value:study},{label:"Daven's kit",value:kit},{label:'Supplies',value:supply}],
    samples:1};
}

export function depart(s:Session):Session{
  if(s.phase!=='night')return s;
  const report=previewEncounter(s);
  const text=report.success
    ?(report.destination==='ridge'?'The crew returned from the ridge with the archive.':'The crew returned from the sheltered shelf with a partial archive.')
    :'The crew turned back before the encounter and brought a sample home.';
  return say({...s,phase:'report',report},'exploration',text);
}

function validReport(r:unknown,s:{destination:string;approach:string}):r is EncounterReport{
  if(!isObject(r))return false;
  if(r.destination!==s.destination||r.approach!==s.approach)return false;
  for(const k of ['strength','difficulty','archive','supplied','samples'] as const)
    if(!Number.isSafeInteger(r[k])||(r[k] as number)<0)return false;
  if(r.samples!==1||(r.supplied as number)>8||![0,1,3].includes(r.archive as number)||![5,9].includes(r.difficulty as number))return false;
  if(typeof r.success!=='boolean'||typeof r.equipped!=='boolean')return false;
  if(r.equipped!==(r.gear!==null))return false;
  if(r.gear!==null&&!validStats(r.gear))return false;
  if(r.research!==null){
    const x=r.research;
    if(!isObject(x))return false;
    if(!validDelivery('study',{kind:'research',boss:x.boss,removed:x.removed,weakened:x.weakened,weakness:x.weakness}))return false;
  }
  return Array.isArray(r.breakdown)&&r.breakdown.every(b=>isObject(b)&&typeof b.label==='string'&&Number.isFinite(b.value));
}

export function restoreSession(value:unknown):Session|null{
  if(!isObject(value)||value.version!==1||typeof value.runId!=='string'||!value.runId)return null;
  if((value.phase!=='night'&&value.phase!=='report')||(value.destination!=='ridge'&&value.destination!=='shelf'))return null;
  if((value.approach!=='careful'&&value.approach!=='direct')||typeof value.requested!=='boolean')return null;
  if(!isObject(value.tasks)||!Array.isArray(value.log)||value.phase==='report'&&!value.report)return null;
  if(value.report!==null&&value.report!==undefined&&!validReport(value.report,{destination:value.destination,approach:value.approach}))return null;
  if(value.phase==='night'&&value.report!==null)return null;
  const tasks={} as Record<Job,Task>;
  for(const job of JOBLIST){
    const t=value.tasks[job];
    if(!isObject(t)||typeof t.attempt!=='number'||!Number.isSafeInteger(t.attempt)||t.attempt<0)return null;
    if(t.status!=='idle'&&t.status!=='active'&&t.status!=='complete')return null;
    if(t.status!=='idle'&&t.attempt===0)return null;
    if(t.receipt===null&&t.status==='complete')return null;
    if(t.receipt!==null&&(t.attempt===0||!validReceipt(job,t.receipt)))return null;
    tasks[job]={attempt:t.attempt as number,status:t.status==='active'?'idle':t.status,receipt:t.receipt as Receipt|null};
  }
  const aRaw=value.tasks.assembly as Record<string,unknown>;
  const aReceipt=isObject(aRaw.receipt)?aRaw.receipt:{};
  const aDelivery=isObject(aReceipt.delivery)?aReceipt.delivery:{};
  const aKits=Array.isArray(aDelivery.kits)?aDelivery.kits:[];
  const hasKit=aDelivery.kind==='gear'&&aKits.some(k=>isObject(k)&&k.crew==='Daven');
  const dt=value.tasks.dispatch as Record<string,unknown>;
  if((dt.status!=='idle'||dt.receipt!==null)&&!hasKit)return null;
  const log=value.log.slice(-50).map(e=>isObject(e)&&DEPARTMENTS.has(e.department as Department)&&typeof e.text==='string'?{department:e.department as Department,text:e.text}:null);
  if(log.some(e=>e===null))return null;
  return {version:1,runId:value.runId,phase:value.phase,destination:value.destination,approach:value.approach,
    requested:value.requested,tasks,report:value.report??null,log:log as {department:Department;text:string}[]};
}
