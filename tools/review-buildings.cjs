#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const P=require('../prototypes/labs/building-lab/plan.js'),V=require('../prototypes/labs/building-lab/voxels.js'),R=require('../prototypes/labs/building-lab/review.js');
const {start}=require('../tests/serve.cjs');
const args=process.argv.slice(2),opts={},settings={count:24,detail:3,seed:550298,out:'output/building-review',shots:false,strict:false};
for(let i=0;i<args.length;i++){
  const k=args[i].replace(/^--/,'');if(['shots','strict'].includes(k)){settings[k]=true;continue;}
  if(!['count','detail','seed','out','cases','type','style','context','lot','typology'].includes(k)||!args[i+1]||args[i+1].startsWith('--'))throw Error('Unknown/missing argument '+args[i]);
  const value=args[++i];if(['count','detail','seed'].includes(k))settings[k]=Number(value);else if(['out','cases'].includes(k))settings[k]=value;else opts[k]=value;
}
for(const k of ['count','detail','seed'])if(!Number.isSafeInteger(settings[k])||settings[k]<(k==='seed'?0:1))throw Error('Invalid '+k);
const OUT=path.resolve(settings.out),shared={style:'fairytale',...opts};
async function main(){
  fs.mkdirSync(OUT,{recursive:true});
  const plans=[],requests=[],generationFailures=[];
  let cases=null;if(settings.cases){
    if(Object.keys(opts).length||args.includes('--seed')||args.includes('--count'))throw Error('--cases cannot be combined with seed/count/generator filters');
    cases=JSON.parse(fs.readFileSync(path.resolve(settings.cases),'utf8'));if(!Array.isArray(cases)||!cases.length)throw Error('Cases must be a nonempty array');settings.count=cases.length;
    for(const c of cases)if(!Number.isSafeInteger(c.seed)||c.seed<0)throw Error('Every retained case needs a nonnegative integer seed');
  }
  for(let i=0;i<settings.count;i++){const seed=cases?cases[i].seed:settings.seed+i;
    const requested=cases?Object.fromEntries(Object.entries(cases[i]).filter(([k])=>['type','style','context','lot','typology'].includes(k))):i===0&&settings.seed===550298&&!Object.keys(opts).length?{type:'shophouse',context:'terrace',lot:'wedge',...shared}:shared;
    try{plans.push(P.generate(seed,requested));requests.push({seed,...requested});}catch(e){generationFailures.push({seed,settings:requested,error:e.message});}}
  const cohort=R.diversity(plans),screen=plans.map(p=>R.review(p)),selected=plans.length?[0]:[];
  const ranked=plans.map((p,i)=>({i,rank:screen[i].counts.errors*100+screen[i].counts.warnings})).sort((a,b)=>b.rank-a.rank);
  const families=new Set(plans.length?[R.fingerprints(plans[0]).family]:[]);
  for(const {i} of ranked){if(selected.length>=settings.detail)break;const family=R.fingerprints(plans[i]).family;if(!selected.includes(i)&&(screen[i].counts.errors||!families.has(family))){selected.push(i);families.add(family);}}
  for(let i=1;i<plans.length&&selected.length<settings.detail;i++)if(!selected.includes(i))selected.push(i);
  const buildings=plans.map((p,i)=>({index:i,seed:p.seed,requested:requests[i],settings:{seed:p.seed,type:p.type,style:p.style,context:p.context,lot:p.lotKind,typology:p.typology},assessment:screen[i],detail:false,captures:[]}));
  for(const i of selected){buildings[i].assessment=R.review(plans[i],V.build(plans[i]));buildings[i].detail=true;}
  let browser=null,server=null;
  try{if(settings.shots){
    const {chromium}=require('playwright');server=await start({port:0});
    browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});
    for(const i of selected){
      const c=buildings[i],id=`${i}-${c.seed}`,tiles=[],errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
      const query=new URLSearchParams(c.requested),url=`${server.url}/prototypes/building-lab.html?${query}`;
      await page.goto(url);await page.waitForFunction(()=>window.BuildingLab?.snapshot().ready,null,{timeout:90000});
      await page.locator('#architect-review summary').click();
      const result=await page.evaluate(()=>BuildingLab.review());c.assessment=result;
      const expected=R.review(plans[i],V.build(plans[i]));
      if(JSON.stringify(result)!==JSON.stringify(expected))throw Error('Browser/Node review disagreement for '+c.seed+'; do not publish mismatched evidence');
      const views=[['corner',plans[i].floors.length+1,'exterior'],['back',plans[i].floors.length+1,'rear'],['above',plans[i].floors.length+1,'roof'],
        ...plans[i].floors.map((_,f)=>['above',f+1,`floor-${f+1}`])];
      for(const [view,floors,label] of views){
        await page.evaluate(([view,floors])=>{BuildingLab.setVisible(floors);BuildingLab.setView(view);BuildingLab.frame();},[view,floors]);
        const file=`${id}-${label}.png`;await page.locator('#view').screenshot({path:path.join(OUT,file)});c.captures.push(file);
        tiles.push([label,await page.locator('#view').evaluate(el=>{BuildingLab.frame();return el.toDataURL('image/png');})]);
        if(label.startsWith('floor-')){
          const level=await page.evaluate(()=>BuildingLab.camera({}).levels);
          let route=result.journeys.findIndex(j=>j.points.some(p=>p[1]>=level[floors-1]&&p[1]<level[floors]));
          if(route<0)route=result.journeys.findIndex(j=>j.voxel==='blocked'&&Number(j.target.split(':')[0])===floors-1);
          await page.selectOption('#review-route',route<0?'':String(route));
          const planFile=`${id}-${label}-plan.png`;await page.locator('#plan').screenshot({path:path.join(OUT,planFile)});c.captures.push(planFile);
          tiles.push([label+' plan / route',await page.locator('#plan').evaluate(el=>el.toDataURL('image/png'))]);
        }
      }
      const info=await page.evaluate(()=>BuildingLab.camera({})),s=info.stair;
      const closeups=plans[i].floors.slice(0,-1).map((_,f)=>({label:`stairs-${f+1}`,floor:f,target:[(s[0]+s[2])/2,info.levels[f]+1,(s[1]+s[3])/2]}));
      for(const [n,finding] of result.findings.filter(f=>f.point).sort((a,b)=>(a.severity==='error'?0:1)-(b.severity==='error'?0:1)).slice(0,2).entries())closeups.push({label:`flag-${n+1}-${finding.code}`,floor:finding.floor||0,target:[finding.point[0],finding.point[1]+.7,finding.point[2]]});
      for(const cview of closeups){
        await page.evaluate(c=>{BuildingLab.setVisible(c.floor+1);BuildingLab.camera({yaw:-.65,pitch:.9,dist:4.5,target:c.target});BuildingLab.frame();},cview);
        const file=`${id}-${cview.label}.png`;await page.locator('#view').screenshot({path:path.join(OUT,file)});c.captures.push(file);
        tiles.push([cview.label,await page.locator('#view').evaluate(el=>{BuildingLab.frame();return el.toDataURL('image/png');})]);
      }
      const sheet=await page.evaluate(async ({tiles,title})=>{
        const W=400,H=300,C=3,header=64,c=document.createElement('canvas');c.width=C*W;c.height=header+Math.ceil(tiles.length/C)*(H+28);const g=c.getContext('2d');g.fillStyle='#f3ecdc';g.fillRect(0,0,c.width,c.height);g.fillStyle='#302b27';g.font='bold 18px system-ui';g.fillText(title,8,24);g.font='14px system-ui';g.fillText('Red: selected sampled route or blocked target. Capture is evidence, not aesthetic approval.',8,48);
        for(let i=0;i<tiles.length;i++){const [label,src]=tiles[i],im=new Image();await new Promise((ok,fail)=>{im.onload=ok;im.onerror=fail;im.src=src;});const x=i%C*W,y=header+Math.floor(i/C)*(H+28),s=Math.min(W/im.width,H/im.height);g.drawImage(im,x+(W-im.width*s)/2,y+28,im.width*s,im.height*s);g.fillStyle='#302b27';g.font='16px system-ui';g.fillText(label,x+8,y+20);}
        return c.toDataURL('image/png');
      },{tiles,title:Object.entries(c.settings).map(([k,v])=>`${k}: ${v}`).join(' · ')});
      const file=`${id}-sheet.png`;fs.writeFileSync(path.join(OUT,file),Buffer.from(sheet.split(',')[1],'base64'));c.sheet=file;
      c.captureErrors=errors;page.off('pageerror',onError);if(errors.length)throw Error('Capture errors: '+errors.join('; '));
    }
  }}finally{if(browser)await browser.close();if(server){server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}}
  const report={revision:R.REVISION,configuration:settings,generationFailures,cohort,buildings,visualReview:'pending: inspect retained images; successful capture is not visual approval'};
  fs.writeFileSync(path.join(OUT,'review.json'),JSON.stringify(report,null,2)+'\n');
  const md=['# Building architect review','',`Attempted ${settings.count} buildings; ${generationFailures.length} generation failures. Plan-screened ${plans.length}; voxel-reviewed ${selected.length}. Visual/art-direction review remains pending.`,
    '',`Distinct layouts: ${cohort.distinctLayouts}; silhouettes: ${cohort.distinctSilhouettes}.`,cohort.note,'',
    '## Shared language, not clones','',...cohort.families.map(f=>`- ${f.family}: ${f.count} (${Math.round(f.share*100)}%)`),'',
    '## Generation failures','',...generationFailures.map(f=>`- Seed ${f.seed}: ${f.error} (${JSON.stringify(f.settings)})`),'','## Detailed cases',''];
  for(const i of selected){const c=buildings[i];md.push(`### Seed ${c.seed} · ${c.settings.type} · ${c.settings.style}`,'',
    `[Reproduce](${path.relative(OUT,path.resolve(__dirname,'../prototypes/building-lab.html'))}?${new URLSearchParams(c.requested)})`,
    `${c.assessment.counts.errors} functional/voxel flags, ${c.assessment.counts.warnings} warnings.`,
    ...(c.sheet?[`![Exterior, roof and floor review](${c.sheet})`]:[]),'',...c.assessment.findings.map(f=>`- **${f.severity} / ${f.code}:** ${f.message}`),'');}
  md.push('## Visual-review checklist','',
    '- [ ] Examine exterior, rear and roof junctions for accidental holes/intersections.','- [ ] Examine each furnished floor and stair/door transitions; drill into original-resolution captures.',
    '- [ ] Confirm deliberate silhouette, readable entrances, inhabited rooms and shared fantasy/anime language.',
    '- [ ] Compare different buildings for meaningful changes in massing and programme, not just colours.',
    '- [ ] Record confirmed findings with seed, floor and camera; retain a regression case.',
    '',...(buildings[selected[0]]?.assessment.limitations||[]).map(l=>`- ${l}`),'');
  fs.writeFileSync(path.join(OUT,'review.md'),md.join('\n'));
  console.log(`Reviewed ${plans.length} plans, ${selected.length} voxel buildings. Report: ${OUT}`);
  if(settings.strict&&(generationFailures.length||buildings.some(b=>b.assessment.counts.errors)))process.exitCode=2;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
