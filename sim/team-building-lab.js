#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const M=require('../prototypes/team-building-model.js');
const seedCount=Number(process.env.LAB_SEEDS||100);
if(!Number.isInteger(seedCount)||seedCount<1||seedCount>10000)throw new Error('LAB_SEEDS must be 1–10000');
function score(id,state,formation=false){const c=M.roster[id],core=M.engines[state.engine].core;if(!formation&&state.owned[id]>=3)return -100;return (core.includes(id)?60:0)+(c.engine===state.engine?20:0)+(c.refill?18:0)+(c.heal||c.barrier?15:0)+(c.enemyAdvance&&['dot','counter'].includes(state.engine)?30:0)+(!formation&&state.owned[id]?-45:12)+(id===M.engines[state.engine].starter?50:0)+(!Object.keys(state.owned).some(x=>M.roster[x].role==='Sustain')&&c.role==='Sustain'?25:0);}
function gearFit(item,id){const g=M.items[item],c=M.roster[id];return ({direct:c.role==='DPS'?3:1,shred:c.shred?3:1,ultra:c.ultra?4:0,dot:c.dot?4:0,reflect:c.reflect?4:0,barrier:c.barrier?3:0,speed:2,heal:c.heal?3:0})[g.kind];}
function chooseTeam(state,policy,rng){
  const starter=M.engines[state.engine].starter,rest=Object.keys(state.owned).filter(id=>id!==starter);
  const selected=policy==='random'?M.sample(rest,M.capacity(state)-1,rng):rest.sort((a,b)=>score(b,state,true)-score(a,state,true)).slice(0,M.capacity(state)-1);
  state.team=[starter,...selected];state.carry=starter;state.recipient=starter;state.enemyAdvance=state.team.includes('Latch')&&['dot','counter'].includes(state.engine);
  state.equipment.forEach(g=>{g.owner=null;});
  state.equipment.forEach(g=>{const eligible=state.team.filter(id=>state.equipment.filter(other=>other.owner===id).length<2);const best=eligible.sort((a,b)=>gearFit(g.id,b)-gearFit(g.id,a))[0];if(best&&gearFit(g.id,best)>0)g.owner=best;});
}
function run(mode,engine,seed,policy){
  const state=M.create({mode,engine,seed}),rng=M.random(seed+1991);let firstConnected=null,duplicates=0,rerolls=0;
  while(state.stage<M.encounters.length){
    if(mode==='target'&&!state.target){const next=M.engines[engine].core.find(id=>!state.owned[id])||M.characters.find(c=>!state.owned[c.id])?.id;if(next)M.act(state,{type:'target',id:next});}
    let choices=M.offers(state,'crew');
    if(policy==='focused'&&mode!=='packs'&&choices.every(id=>score(id,state)<40)&&state.gold>=12){M.act(state,{type:'refresh',kind:'crew'});rerolls++;choices=M.offers(state,'crew');}
    if(mode==='target'&&state.progress>=2&&state.target)choices.push(state.target);
    const pick=policy==='random'?M.sample(choices,1,rng)[0]:choices.sort((a,b)=>score(b,state)-score(a,state))[0];
    const before={...state.owned};const error=M.act(state,{type:'crew',id:pick});if(error)throw new Error(error);
    const got=state.history.at(-1).received;duplicates+=got.filter(id=>before[id]).length;
    chooseTeam(state,policy,rng);
    const choicesGear=M.offers(state,'gear');const item=policy==='random'?M.sample(choicesGear,1,rng)[0]:choicesGear.sort((a,b)=>Math.max(...state.team.map(id=>gearFit(b,id)))-Math.max(...state.team.map(id=>gearFit(a,id))))[0];
    if(state.gold>=4){const err=M.act(state,{type:'gear',id:item});if(err)throw new Error(err);}
    chooseTeam(state,policy,rng);
    if(firstConnected===null&&M.engineReady(state))firstConnected=state.stage+1;
    M.settle(state);
  }
  return {firstConnected,duplicates,rerolls,unique:Object.keys(state.owned).length,unused: Object.keys(state.owned).filter(id=>!state.team.includes(id)).length,unassigned:state.equipment.filter(g=>!g.owner).length,wins:state.results.filter(r=>r.won).length,defeats:state.results.filter(r=>r.reason==='Defeat').length,timeouts:state.results.filter(r=>r.reason==='Deadline').length,gold:state.gold};
}
const mean=(records,key)=>Number((records.reduce((s,r)=>s+r[key],0)/records.length).toFixed(2));
const acquisition=[];
for(const policy of ['focused','random'])for(const engine of Object.keys(M.engines))for(const mode of Object.keys(M.modes)){
  const records=Array.from({length:seedCount},(_,i)=>run(mode,engine,i+1,policy));const connected=records.filter(r=>r.firstConnected!==null);
  acquisition.push({policy,engine,mode,runs:records.length,connectedPct:Math.round(connected.length/records.length*100),meanFirstConnected:connected.length?mean(connected,'firstConnected'):null,meanClears:mean(records,'wins'),meanDefeats:mean(records,'defeats'),meanTimeouts:mean(records,'timeouts'),meanUnique:mean(records,'unique'),meanUnused:mean(records,'unused'),meanDuplicates:mean(records,'duplicates'),meanUnassignedGear:mean(records,'unassigned'),meanRerolls:mean(records,'rerolls'),meanGoldLeft:mean(records,'gold')});
}
const builds={hypercarry:['Silen','Aurel','Ekene','Roonie','Nahana'],break:['Wren','Quill','Roonie','Aurel','Nahana'],dot:['Nour','Spore','Redcap','Latch','Nahana'],counter:['Reva','Ilka','Latch','Roonie','Nahana'],multi:['Arunima','Silen','Coda','Roonie','Nahana']};
const combat=[];
for(const [engine,team] of Object.entries(builds))for(const encounter of M.encounters)for(const scale of [.75,1,1.25,1.5,2]){
  const state=M.create({engine,sandbox:true});state.team=team;state.carry=M.engines[engine].starter;state.recipient=state.carry;state.enemyAdvance=['dot','counter'].includes(engine);
  const records=Array.from({length:20},(_,i)=>M.fight(state,{encounter,scale,seed:i+1}));
  combat.push({engine,encounter:encounter.id,scale,wins:records.filter(r=>r.won).length,trials:20,meanEnemyAttacks:Number((records.reduce((s,r)=>s+r.metrics.enemyAttacks,0)/20).toFixed(2)),meanDamage:Object.fromEntries(['direct','dot','ultra','retaliation'].map(k=>[k,Math.round(records.reduce((s,r)=>s+r.metrics[k],0)/20)]))});
}
const mechanics=[];
for(const engine of ['dot','counter'])for(const enabled of [false,true]){
  const state=M.create({engine,sandbox:true});state.team=builds[engine];state.enemyAdvance=enabled;
  const records=Array.from({length:40},(_,i)=>M.fight(state,{encounter:M.encounters[2],scale:1.4,seed:i+1}));
  mechanics.push({engine,enemyAdvance:enabled,wins:records.filter(r=>r.won).length,trials:40,attacks:Math.round(records.reduce((s,r)=>s+r.metrics.enemyAttacks,0)/40),payoff:Math.round(records.reduce((s,r)=>s+r.metrics[engine==='dot'?'dot':'retaliation'],0)/40),downs:records.reduce((s,r)=>s+r.metrics.deaths,0)/40});
}
const output={modelVersion:1,modelSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../prototypes/team-building-model.js'))).digest('hex'),method:'Isolated shared JS event model; not live resolver parity. Seeds 1–N, 6 stages, 12 gold/stage; recruit 6, gear 4, refresh 2. Packs grant two random recruits; drafts one of three; target guarantee replaces the third purchase. Focused policy uses authored preference scores, random policy samples offers. Neither measures player enjoyment. Combat fixtures are five unique rank-1 characters with no gear, 20 fixed seeds per cell. No live-game balance claims.',seedCount,acquisition,combat,mechanics};
const destination=process.argv[2]||path.join(__dirname,'../docs/testing/team-building-lab-results.json');fs.writeFileSync(destination,JSON.stringify(output,null,2)+'\n');
console.table(acquisition.filter(r=>r.policy==='focused').map(({engine,mode,connectedPct,meanFirstConnected,meanClears,meanUnused,meanDuplicates})=>({engine,mode,connectedPct,meanFirstConnected,meanClears,meanUnused,meanDuplicates})));
console.table(mechanics);console.log('Wrote '+destination);
