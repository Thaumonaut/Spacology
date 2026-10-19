#!/usr/bin/env node
'use strict';
// Affix lab measurements. Two questions, both from docs/design/affix-team-building.md:
//   1. Does a Brief (its affixes and bosses) change the best team?            → matrix, churn
//   2. Does spending on berths versus equipment change how a session goes?    → policies
// Usage: node sim/affix-lab.js <baseline|inspect|roster|flatten|sweep|matrix|intent|churn|policies|route|fits|all> [--seeds N] [--briefs N] [--count N]
//        [--part tax|gift] [--affixes a,b] [--set key=value,...] [--econ key=value,...] [--grid JSON] [--rounds N]
//        [--policy name] [--out file.json]
// Writes a file only when --out is given. Method notes: docs/testing/affix-lab.md.
const fs=require('fs');
const path=require('path');
const M=require('../prototypes/labs/affix-lab/affix-lab-model.js');

const args=process.argv.slice(2);
const command=args[0]&&!args[0].startsWith('--')?args[0]:'baseline';
const WIN=.88,CLEAR_RATE=.75;   // a fight is beaten at the no-loss band; a scale is beaten at three fights in four
// Flags (SEEDS, BRIEFS, COUNT, PART, OUT and F) are read and checked once, in the Flags section at the end, before any
// command runs.

// ---- Encounters, evaluation and breakpoints -----------------------------------------------------------------------
const NON_BOSS=['patrol','swarm','elite'];
function encounterSet(bosses){
  return [...NON_BOSS,...NON_BOSS].map((format,tag)=>({format,tag})).concat(bosses.map(boss=>({format:'boss',boss})));
}
const ALL_BOSSES=Object.keys(M.BOSSES);
function evaluate(team,affixes,scale,encs,seeds=SEEDS,gear){
  let wins=0,total=0,n=0;const outcomes={cleared:0,time:0,wiped:0};
  for(const enc of encs)for(let k=0;k<seeds;k++){
    const r=M.fight({crew:team.map(id=>({id,gear:gear&&gear[id]})),affixes,encounter:enc,scale,
      affixParts:partsFor(affixes),seed:M.hash('eval',enc.format,enc.boss||'',enc.tag||0,k)});
    n++;total+=r.score;if(r.score>=WIN)wins++;outcomes[r.outcome]++;
  }
  return {win:wins/n,score:total/n,outcomes};
}
// The largest enemy scale the team still beats three fights in four (geometric bisection).
function breakpoint(team,affixes,encs,seeds=SEEDS,gear){
  let lo=.1,hi=12;
  if(evaluate(team,affixes,lo,encs,seeds,gear).win<CLEAR_RATE)return lo;
  if(evaluate(team,affixes,hi,encs,seeds,gear).win>=CLEAR_RATE)return hi;
  for(let i=0;i<11;i++){const mid=Math.sqrt(lo*hi);if(evaluate(team,affixes,mid,encs,seeds,gear).win>=CLEAR_RATE)lo=mid;else hi=mid;}
  return lo;
}

// ---- Teams --------------------------------------------------------------------------------------------------------
const IDS=Object.keys(M.ROSTER);
function combos(list,k,start=0,prefix=[],out=[]){
  if(prefix.length===k){out.push(prefix.slice());return out;}
  for(let i=start;i<list.length;i++){prefix.push(list[i]);combos(list,k,i+1,prefix,out);prefix.pop();}
  return out;
}
const hasFront=team=>team.some(id=>M.ROSTER[id].row==='front');
function allTeams(k,must=[]){
  const rest=IDS.filter(id=>!must.includes(id));
  return combos(rest,k-must.length).map(t=>[...must,...t]).filter(hasFront);
}
// One team per type, sustained by its own sustainer. Retaliation has three members, so it borrows a healer.
const REFERENCE={
  aether:['Hanae','Arunima','Ivara','Veska'],carry:['Silen','Ekene','Beatriz','Daven'],break:['Wren','Sevim','Maul','Atsa'],
  dot:['Nour','Spore','Dolores','Nahana'],counter:['Reva','Tarn','Ilka','Nahana'],followup:['Nadira','Aurelio','Imke','Navigator']
};
const ENGINES=Object.keys(M.FAMILIES);
// A team "fields" a type through its engine pieces; a sustainer borrowed from another type does not count.
const engineOf=id=>M.ROSTER[id].sustain?null:M.ROSTER[id].family;
const hasSustainer=team=>team.some(id=>M.ROSTER[id].sustain);
let refScale=null;
function screeningScales(){
  if(!refScale){
    const bps=ENGINES.map(k=>breakpoint(REFERENCE[k],[],encounterSet(ALL_BOSSES),1)).sort((a,b)=>a-b);
    refScale=bps[Math.floor(bps.length/2)];
  }
  return [refScale*1.1,refScale*1.7];
}
// Exhaustive screen on mean score at two scales, then breakpoints for the leaders.
function bestTeams(affixes,encs,{k=4,must=[],keep=8}={}){
  const scales=screeningScales();
  const screened=allTeams(k,must).map(team=>({team,screen:scales.reduce((s,x)=>s+evaluate(team,affixes,x,encs,1).score,0)/scales.length}));
  screened.sort((a,b)=>b.screen-a.screen);
  return screened.slice(0,keep).map(t=>({...t,bp:breakpoint(t.team,affixes,encs)})).sort((a,b)=>b.bp-a.bp||b.screen-a.screen);
}
const overlap=(a,b)=>a.filter(id=>b.includes(id)).length;
const r2=x=>Math.round(x*100)/100;

// ---- Commands -----------------------------------------------------------------------------------------------------
function baseline(){
  const encs=encounterSet(ALL_BOSSES),rows={};
  for(const [k,team] of Object.entries(REFERENCE)){
    const bp=breakpoint(team,[],encs);
    rows[k]={team,bp:r2(bp),lossesAbove:evaluate(team,[],bp*1.3,encs).outcomes};
  }
  print('Reference teams, no affixes: breakpoint and how they lose at 1.3× it');
  Object.entries(rows).forEach(([k,r])=>console.log(`  ${k.padEnd(9)} ${String(r.bp).padEnd(5)} ${JSON.stringify(r.lossesAbove)}  ${r.team.join(', ')}`));
  return rows;
}

// Where each reference team's damage comes from, at its own breakpoint: is the family's engine load-bearing?
function inspect(){
  const encs=encounterSet(ALL_BOSSES),affixes=F.affixes,rows={};
  for(const [k,team] of Object.entries(REFERENCE)){
    const scale=breakpoint(team,[],encs),agg={byKind:{},n:0};
    for(const enc of encs)for(let i=0;i<SEEDS*3;i++){
      const r=M.fight({crew:team,affixes,encounter:enc,scale,seed:M.hash('inspect',enc.format,enc.boss||'',enc.tag||0,i),
        affixParts:partsFor(affixes)});
      agg.n++;
      Object.entries(r.metrics.byKind).forEach(([kind,v])=>{agg.byKind[kind]=(agg.byKind[kind]||0)+v;});
      ['freezes','breaks','ults','downs','aetherSpent','aetherWasted','soaked','dealt','followups','reflected'].forEach(key=>{agg[key]=(agg[key]||0)+r.metrics[key];});
      agg.score=(agg.score||0)+r.score;
    }
    const total=Object.values(agg.byKind).reduce((a,b)=>a+b,0)||1;
    rows[k]={scale:r2(scale),score:r2(agg.score/agg.n),shares:Object.fromEntries(Object.entries(agg.byKind).sort((a,b)=>b[1]-a[1]).map(([kind,v])=>[kind,r2(v/total)])),
      perFight:Object.fromEntries(['freezes','breaks','ults','downs','aetherSpent','aetherWasted','followups'].map(key=>[key,r2(agg[key]/agg.n)])),
      soakedShare:r2(agg.soaked/(agg.soaked+agg.dealt))};
    console.log(`  ${k.padEnd(9)} @${rows[k].scale} score ${rows[k].score}  damage ${Object.entries(rows[k].shares).map(([a,b])=>a+' '+Math.round(b*100)+'%').join(', ')}`);
    console.log(`  ${''.padEnd(9)} per fight ${JSON.stringify(rows[k].perFight)} soaked ${Math.round(rows[k].soakedShare*100)}% of would-be damage`);
  }
  return rows;
}

// Flattening: share of the top 20 teams each crewmate appears in, and what banning them costs the best team.
// Targets from the session-progression proposal: nobody above about 35% of top teams, no ban cost above about 10%.
function roster(){
  const encs=encounterSet(ALL_BOSSES),scales=screeningScales();
  const screened=allTeams(4).map(team=>({team,screen:scales.reduce((s,x)=>s+evaluate(team,[],x,encs,1).score,0)/scales.length}))
    .sort((a,b)=>b.screen-a.screen);
  const top=screened.slice(0,20),best=screened[0].screen;
  const rows=IDS.map(id=>({id,share:r2(top.filter(t=>t.team.includes(id)).length/top.length),
    banCost:r2(1-screened.find(t=>!t.team.includes(id)).screen/best)})).sort((a,b)=>b.share-a.share||b.banCost-a.banCost);
  print(`Roster flatness, no affixes (screen scales ${scales.map(r2).join(', ')})`);
  console.log('  best: '+screened.slice(0,5).map(t=>`${t.team.join(',')} ${r2(t.screen)}`).join(' | '));
  console.log('  '+rows.map(r=>`${r.id} ${Math.round(r.share*100)}%/${Math.round(r.banCost*100)}%`).join('  '));
  return {top:top.map(t=>({team:t.team,screen:r2(t.screen)})),rows};
}

// Moves each crewmate's `power` until every crewmate has a team within reach of the best (weakness gap) and nobody's
// absence costs the best team much (ban cost). Both are read from one exhaustive screen per round, at two seeds.
function flatten(){
  const rounds=F.rounds,encs=encounterSet(ALL_BOSSES),scales=screeningScales(),history=[];
  const anchor=Math.exp(IDS.reduce((s,id)=>s+Math.log(M.ROSTER[id].power),0)/IDS.length);
  let rows=[];
  for(let round=0;round<=rounds;round++){
    const screened=allTeams(4).map(team=>({team,screen:scales.reduce((s,x)=>s+evaluate(team,[],x,encs,2).score,0)/scales.length}))
      .sort((a,b)=>b.screen-a.screen);
    const best=screened[0].screen,top=screened.slice(0,20);
    rows=IDS.map(id=>{
      const withX=screened.find(t=>t.team.includes(id)).screen,without=screened.find(t=>!t.team.includes(id)).screen;
      return {id,power:M.ROSTER[id].power,gap:r2(withX/best-1),ban:r2(1-without/best),share:r2(top.filter(t=>t.team.includes(id)).length/20)};
    });
    history.push({round,best:r2(best),rows});
    console.log(`  round ${round} best ${r2(best)}: `+rows.map(r=>`${r.id} ${r.power.toFixed(2)} gap ${Math.round(r.gap*100)} ban ${Math.round(r.ban*100)}`).join(' | '));
    if(round===rounds)break;
    rows.forEach(r=>{
      const c=M.ROSTER[r.id],push=Math.max(-.08,Math.min(.08,-1.5*r.gap-1.5*r.ban));
      c.power=c.power*(1+push);
    });
    // Anchor: keep the roster's geometric-mean power where it started, so flattening redistributes strength instead of
    // inflating it (which would quietly make every encounter easier and void the difficulty calibration).
    const mean=Math.exp(IDS.reduce((s,id)=>s+Math.log(M.ROSTER[id].power),0)/IDS.length);
    IDS.forEach(id=>{M.ROSTER[id].power=Math.round(M.ROSTER[id].power*anchor/mean*1000)/1000;});
  }
  print('Power after flattening (bake into ROSTER): '+IDS.map(id=>`${id}:${M.ROSTER[id].power}`).join(', '));
  return {history};
}

function sweep(){
  const grid=F.grid,encs=encounterSet(ALL_BOSSES),saved={...M.T},out=[];
  for(const g of grid){
    Object.assign(M.T,saved,g);
    const bps={};let wiped=0,time=0;
    for(const [k,team] of Object.entries(REFERENCE)){
      const bp=breakpoint(team,[],encs);bps[k]=r2(bp);
      const o=evaluate(team,[],bp*1.3,encs).outcomes;wiped+=o.wiped;time+=o.time;
    }
    const vals=Object.values(bps),spread=r2(Math.max(...vals)/Math.min(...vals));
    out.push({set:g,breakpoints:bps,spread,lossesAbove:{wiped,time}});
    console.log(`${JSON.stringify(g).padEnd(56)} spread ${String(spread).padEnd(5)} wipe/time ${wiped}/${time}  ${Object.entries(bps).map(([k,v])=>k.slice(0,5)+' '+v).join(' | ')}`);
  }
  Object.assign(M.T,saved);
  return out;
}

// For each affix alone: each team type's best team that keeps its core pair, against its no-affix best.
// HARD COUNTER blocks an affix from the pool: it singles out a type, leaving it below 85% of the median type's change.
// A uniform tax (every type down together) is not a hard counter. Flat = every type moves about equally: a difficulty
// knob rather than a condition that changes the team, so it needs a reason to stay.
const HARD_COUNTER=.85;
function median(list){const s=list.slice().sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;}
function matrix(){
  const encs=encounterSet(ALL_BOSSES),conditions=[[],...Object.keys(M.AFFIXES).map(id=>[id])],table={};
  for(const fam of ENGINES){
    const must=M.FAMILIES[fam].core;
    for(const cond of conditions){
      const best=bestTeams(cond,encs,{must,keep:4})[0];
      (table[fam]=table[fam]||{})[cond[0]||'none']={bp:best.bp,team:best.team};
    }
  }
  const affixRows={};
  for(const id of Object.keys(M.AFFIXES)){
    const rel={};ENGINES.forEach(fam=>{rel[fam]=r2(table[fam][id].bp/table[fam].none.bp);});
    const vals=Object.values(rel),spread=r2(Math.max(...vals)/Math.min(...vals)),mid=median(vals);
    const singledOut=ENGINES.filter(f=>rel[f]/mid<HARD_COUNTER);
    affixRows[id]={relative:rel,spread,median:r2(mid),flat:spread<1.2,hardCounter:singledOut.length>0,singledOut,
      winners:ENGINES.filter(f=>rel[f]===Math.max(...vals)),losers:ENGINES.filter(f=>rel[f]===Math.min(...vals))};
  }
  print(`Breakpoint relative to no affix, best team that keeps the type's core pair (hard counter: below ${HARD_COUNTER} of the median)`);
  console.log('  '+'affix'.padEnd(11)+ENGINES.map(f=>f.slice(0,8).padEnd(9)).join('')+'spread  flags');
  console.log('  '+'(none bp)'.padEnd(11)+ENGINES.map(f=>String(r2(table[f].none.bp)).padEnd(9)).join(''));
  Object.entries(affixRows).forEach(([id,r])=>console.log('  '+id.padEnd(11)+ENGINES.map(f=>String(r.relative[f]).padEnd(9)).join('')+
    String(r.spread).padEnd(8)+[r.hardCounter&&`HARD COUNTER: ${r.singledOut.join(', ')}`,r.flat&&'FLAT'].filter(Boolean).join(' · ')));
  return {families:table,affixes:affixRows};
}

// Designer intent: under each affix alone, the share of the top 10 teams that field each engine family (any member),
// against the same share with no affix. Each affix's data names the families it is meant to favor and punish
// (never shown in play). "As designed" allows one team (10%) of noise against the intent and needs a two-team move for it.
function intent(){
  const encs=encounterSet(ALL_BOSSES),scales=screeningScales();
  const top=affixes=>allTeams(4).map(team=>({team,screen:scales.reduce((s,x)=>s+evaluate(team,affixes,x,encs,2).score,0)/scales.length}))
    .sort((a,b)=>b.screen-a.screen).slice(0,10).map(t=>t.team);
  const shares=teams=>Object.fromEntries(ENGINES.map(fam=>[fam,r2(teams.filter(t=>t.some(id=>engineOf(id)===fam)).length/teams.length)]));
  const base=shares(top([])),rows={};
  print('Designer intent: share of the top 10 teams fielding each family, no affix → affix  (+ favored, − punished)');
  console.log('  '+'affix'.padEnd(11)+ENGINES.map(f=>f.slice(0,8).padEnd(11)).join('')+'verdict');
  console.log('  '+'(none)'.padEnd(11)+ENGINES.map(f=>(Math.round(base[f]*100)+'%').padEnd(11)).join(''));
  for(const [id,a] of Object.entries(M.AFFIXES)){
    const teams=top([id]),now=shares(teams);
    // One team is 10% of a top-ten sample, so a single team moving the wrong way is noise: allow it, but require at
    // least one designated family to move two teams (20%) the intended way.
    const slack=.1+1e-9,move=.2-1e-9;
    const ok=a.favors.every(f=>now[f]>=base[f]-slack)&&a.punishes.every(f=>now[f]<=base[f]+slack)&&(a.favors.length+a.punishes.length===0||
      a.favors.some(f=>now[f]-base[f]>=move)||a.punishes.some(f=>base[f]-now[f]>=move));
    rows[id]={favors:a.favors,punishes:a.punishes,shares:now,best:teams[0],asDesigned:ok};
    const cell=f=>((a.favors.includes(f)?'+':a.punishes.includes(f)?'−':' ')+Math.round(now[f]*100)+'%').padEnd(11);
    console.log('  '+id.padEnd(11)+ENGINES.map(cell).join('')+(ok?'as designed':'CHECK')+'   best '+teams[0].join(','));
  }
  return {base,rows};
}

// A command's rolled Briefs, and how many conditions they actually hold: a roll can stop short of --count when no
// remaining condition stacks legally with three fitting bosses.
function rollBriefs(n){
  const briefs=Array.from({length:n},(_,i)=>M.rollBrief(9000+i,COUNT)),sizes=briefs.map(b=>b.affixes.length);
  return {briefs,conditions:{asked:COUNT,min:Math.min(...sizes),max:Math.max(...sizes)}};
}
const conditionsText=c=>`${c.min===c.max?c.min:c.min+'–'+c.max} conditions a Brief${c.min===c.asked&&c.max===c.asked?'':`, asked for ${c.asked}`}`;
const briefsText=n=>`${n} Brief${n===1?'':'s'}`;

// Rolled Briefs: the best four-person team under each, against the best team with no affixes and the same bosses.
function churn(){
  const {briefs,conditions}=rollBriefs(BRIEFS);
  const rows=[];
  for(const brief of briefs){
    const encs=encounterSet(brief.bosses);
    const plain=bestTeams([],encs)[0],ranked=bestTeams(brief.affixes,encs),best=ranked[0];
    const solvable=evaluate(best.team,brief.affixes,1,encs).win;
    rows.push({affixes:brief.affixes,bosses:brief.bosses,best:best.team,bp:r2(best.bp),plain:plain.team,plainBp:r2(plain.bp),
      changed:4-overlap(best.team,plain.team),solvableAtScale1:r2(solvable),runnersUp:ranked.slice(1,4).map(t=>t.team)});
    const row=rows[rows.length-1];
    console.log(`  ${row.affixes.join('+').padEnd(22)} ${row.bosses.join(',').padEnd(26)} best ${row.best.join(',').padEnd(30)} plain ${row.plain.join(',').padEnd(30)} Δ${row.changed}`);
  }
  const appear={};rows.forEach(r=>r.best.forEach(id=>{appear[id]=(appear[id]||0)+1;}));
  const keyOf=t=>t.slice().sort().join(',');
  const winners={};rows.forEach(r=>{const k=keyOf(r.best);winners[k]=(winners[k]||0)+1;});
  const top=Object.entries(winners).sort((a,b)=>b[1]-a[1])[0];
  let consecutive=0;for(let i=1;i<rows.length;i++)if(4-overlap(rows[i].best,rows[i-1].best)>=2)consecutive++;
  const summary={
    briefs:rows.length,affixCount:COUNT,conditions,
    changedVsPlain:r2(rows.filter(r=>r.changed>=2).length/rows.length),
    consecutiveChurn:r2(consecutive/Math.max(1,rows.length-1)),
    winnerConcentration:r2(top[1]/rows.length),mostCommonBest:top[0],
    characterBreadth:Object.fromEntries(IDS.map(id=>[id,r2((appear[id]||0)/rows.length)])),
    withSustainer:r2(rows.filter(r=>hasSustainer(r.best)).length/rows.length),
    unsolvable:rows.filter(r=>r.solvableAtScale1<.6).map(r=>r.affixes)
  };
  print(`Argmax churn over ${briefsText(rows.length)}, ${conditionsText(conditions)}`);
  console.log(`  best team differs from the no-affix best by ≥2 members in ${Math.round(summary.changedVsPlain*100)}% of Briefs (target ≥ 70%)`);
  console.log(`  consecutive Briefs differ by ≥2 members: ${Math.round(summary.consecutiveChurn*100)}%`);
  console.log(`  most common best team wins ${Math.round(summary.winnerConcentration*100)}% of Briefs (target < 10%): ${summary.mostCommonBest}`);
  console.log(`  appearance in best teams: ${Object.entries(summary.characterBreadth).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+Math.round(v*100)+'%').join(', ')}`);
  console.log(`  best teams fielding a sustainer: ${Math.round(summary.withSustainer*100)}%`);
  if(summary.unsolvable.length)console.log(`  Briefs with no team at 60% at scale 1: ${summary.unsolvable.map(a=>a.join('+')).join('; ')}`);
  return {summary,rows};
}

// Scripted shoppers over full sessions, on the same Briefs and seeds. If one policy always wins, the choice is solved;
// if all tie, the choice does not matter. The interesting result is a winner that depends on the Brief.
const POLICIES={
  wide:{label:'Berths first, equipment with what is left',berths:6,gear:true},
  wideBare:{label:'Berths only, never equipment',berths:6,gear:false},
  five:{label:'Five crew, buying equipment along the way',berths:5,gear:true,interleave:true},
  fiveBare:{label:'Five crew, never equipment',berths:5,gear:false},
  deep:{label:'Four crew, then everything on equipment',berths:4,gear:true},
  lean:{label:'Three crew, then everything on equipment',berths:3,gear:true}
};
function crewPlan(brief){
  const encs=encounterSet(brief.bosses),scales=screeningScales();
  const screen=team=>scales.reduce((s,x)=>s+evaluate(team,brief.affixes,x,encs,1).score,0);
  const core=bestTeams(brief.affixes,encs)[0].team;
  // The opener is exhaustive up to three; a larger starting crew grows from it one crewmate at a time (the loop below).
  const openers=combos(core,Math.min(M.ECON.startCrew,3)).filter(hasFront).sort((a,b)=>screen(b)-screen(a));
  const order=openers[0].slice();
  while(order.length<6){
    const pool=order.length<4?core.filter(id=>!order.includes(id)):IDS.filter(id=>!order.includes(id));
    order.push(pool.map(id=>({id,s:screen([...order,id])})).sort((a,b)=>b.s-a.s)[0].id);
  }
  return order;
}
// What a player building around one type recruits, in order: the type's core pair and sustainer, then the best
// addition from anyone (often a front-row anchor: enemies strike only the front row, so its depth is the crew's health
// bar). The opener is the best front-row group of the first three (a pair at the default start). This is the population the route is calibrated on:
// the optimizer's team is an upper bound, and finding it should pay, not be the bar.
function themedPlan(type,brief){
  const fam=M.FAMILIES[type],encs=encounterSet(brief.bosses),scales=screeningScales();
  const screen=team=>scales.reduce((s,x)=>s+evaluate(team,brief.affixes,x,encs,1).score,0);
  const first=[...fam.core,fam.sustain];
  // Exhaustive up to three; a larger starting crew grows from it one crewmate at a time (the loop below).
  const opener=combos(first,Math.min(M.ECON.startCrew,3)).filter(hasFront).sort((a,b)=>screen(b)-screen(a))[0];
  const order=[...opener,...first.filter(id=>!opener.includes(id))];
  while(order.length<6)order.push(IDS.filter(id=>!order.includes(id)).map(id=>({id,s:screen([...order,id])})).sort((a,b)=>b.s-a.s)[0].id);
  return order;
}
function gearTarget(s,gearId,order){
  return order.filter(id=>s.crew.includes(id)&&(s.gear[id]||[]).length<M.ECON.slots&&M.gearFits(gearId).includes(id))[0]||null;
}
function startSession(brief,seed,order){
  const s=M.createSession({seed,brief});
  order.slice(0,M.ECON.startCrew).forEach(id=>M.act(s,{type:'recruit',id}));
  return s;
}
// One stop's spending under a policy.
function shop(s,p,order){
  let progress=true;
  while(progress){
    progress=false;
    const price=M.voucherPrice(s.berths);
    // An interleaving shopper keeps enough for one item after paying for a berth.
    const reserve=p.interleave&&s.offers.some(id=>id&&gearTarget(s,id,order))?M.ECON.gearPrice:0;
    if(s.berths<p.berths&&price!==null&&s.gold>=price+reserve){M.act(s,{type:'voucher'});progress=true;}
    while(s.crew.length<s.berths){M.act(s,{type:'recruit',id:order.find(id=>!s.crew.includes(id))});progress=true;}
    if(!p.gear||(s.berths<p.berths&&price!==null&&!p.interleave))continue;
    // Each item is fitted as it is bought, so the next offer sees that slot as taken and nothing waits unworn in the hold.
    for(let tries=0;tries<3&&!progress;tries++){
      s.offers.forEach((id,i)=>{
        const who=id&&s.gold>=M.ECON.gearPrice&&gearTarget(s,id,order);
        if(who){M.act(s,{type:'buy',index:i});M.act(s,{type:'equip',gear:id,id:who});progress=true;}
      });
      if(!progress&&s.gold>=M.ECON.reroll(s.rerolls)+M.ECON.gearPrice&&s.rerolls<2)M.act(s,{type:'reroll'});else break;
    }
  }
}
function playSession(brief,seed,policy,order){
  const p=POLICIES[policy],s=startSession(brief,seed,order);
  while(s.phase==='ops'){shop(s,p,order);M.act(s,{type:'launch',parts:partsFor(brief.affixes)});}
  const scores=s.results.map(r=>r.score);
  return {integrity:s.integrity,meanScore:scores.reduce((a,b)=>a+b,0)/scores.length,battles:s.results.length,
    crew:s.crew.length,gear:Object.values(s.gear).flat().length,gold:s.gold,scores};
}
const sum=list=>list.reduce((a,b)=>a+b,0),mean=list=>list.length?sum(list)/list.length:0;
// Every policy, for the optimizer's crew and for one themed crew per type. The question for hypothesis (b) is asked of
// the themed crews: does the better split between berths and equipment depend on the Brief and the type?
function policies(){
  const {briefs,conditions}=rollBriefs(Math.min(BRIEFS,12)),rows=[];
  const crews=['best',...ENGINES];
  for(const [b,brief] of briefs.entries()){
    const row={affixes:brief.affixes,bosses:brief.bosses,orders:{},results:{},winners:{}};
    for(const crew of crews){
      const order=crew==='best'?crewPlan(brief):themedPlan(crew,brief);
      row.orders[crew]=order;row.results[crew]={};
      for(const policy of Object.keys(POLICIES)){
        // Seeded by the Brief's index, so Briefs with the same conditions are separate samples; every policy shares the
        // seeds within a Brief, so policies are compared on the same voyages.
        const runs=Array.from({length:SEEDS*3},(_,k)=>playSession(brief,M.hash('session',b,k),policy,order));
        row.results[crew][policy]={integrity:r2(mean(runs.map(r=>r.integrity))),score:r2(mean(runs.map(r=>r.meanScore))),
          gear:r2(mean(runs.map(r=>r.gear))),survived:r2(mean(runs.map(r=>r.integrity>0?1:0))),
          byBattle:M.ROUTE.map((_,i)=>r2(mean(runs.map(r=>r.scores[i]===undefined?0:r.scores[i]))))};
      }
      // Compared on the rounded values reported above. Equal leaders are a 'tie', not a win for whichever policy is listed first.
      const [first,second]=Object.entries(row.results[crew]).sort((a,b)=>b[1].integrity-a[1].integrity||b[1].score-a[1].score);
      row.winners[crew]=second&&second[1].integrity===first[1].integrity&&second[1].score===first[1].score?'tie':first[0];
    }
    rows.push(row);
    console.log(`  ${brief.affixes.join('+').padEnd(22)} best → ${row.winners.best.padEnd(9)} themed → ${ENGINES.map(t=>t.slice(0,5)+' '+row.winners[t]).join(', ')}`);
  }
  const summary={briefs:rows.length,conditions,crews:{}};
  for(const crew of crews){
    const wins={};rows.forEach(r=>{wins[r.winners[crew]]=(wins[r.winners[crew]]||0)+1;});
    const at=(k,f)=>r2(mean(rows.map(r=>r.results[crew][k][f])));
    summary.crews[crew]={wins,integrity:Object.fromEntries(Object.keys(POLICIES).map(k=>[k,at(k,'integrity')])),
      survived:Object.fromEntries(Object.keys(POLICIES).map(k=>[k,at(k,'survived')]))};
  }
  // Each themed crew's best policy per Brief: if one policy wins everywhere, the split is solved for that type.
  const themedWins={};rows.forEach(r=>ENGINES.forEach(t=>{themedWins[r.winners[t]]=(themedWins[r.winners[t]]||0)+1;}));
  summary.themedWins=themedWins;
  summary.byBattle=Object.fromEntries(crews.map(crew=>[crew,M.ROUTE.map((_,i)=>r2(mean(rows.map(r=>r.results[crew].five.byBattle[i]))))]));
  print(`Shopping policies over ${briefsText(rows.length)}, ${conditionsText(conditions)}: mean final integrity (share of sessions that survive)`);
  for(const crew of crews){
    const c=summary.crews[crew];
    console.log(`  ${crew.padEnd(9)} ${Object.keys(POLICIES).map(k=>`${k} ${c.integrity[k]} (${Math.round(c.survived[k]*100)}%)`).join('  ')}   wins ${JSON.stringify(c.wins)}`);
  }
  console.log(`  themed crews' best policy, over every Brief and type: ${JSON.stringify(themedWins)}`);
  print('Mean score by battle, policy five');
  for(const crew of crews)console.log(`  ${crew.padEnd(9)} ${summary.byBattle[crew].map(x=>x.toFixed(2)).join('  ')}`);
  return {summary,rows};
}

// Derives the route from the economy, battle by battle: the enemy strength at which the median type's themed crew,
// shopping as `five` does, beats the battle (88% or better) at the target rate. Earlier battles stay fixed while a later
// one is set, so each battle meets the crew and equipment the voyage can actually afford by then, at the income its
// earlier results paid. Prints scales to bake into ROUTE.
const ROUTE_TARGET={opening:.9,later:.75};
function route(){
  const {briefs,conditions}=rollBriefs(BRIEFS),policy=POLICIES[F.policy];
  const clone=s=>JSON.parse(JSON.stringify(s));
  let runs=[];
  for(const [b,brief] of briefs.entries())for(const type of ENGINES){
    const order=themedPlan(type,brief);
    for(let k=0;k<SEEDS*3;k++)runs.push({type,order,parts:partsFor(brief.affixes),s:startSession(brief,M.hash('route',b,k),order)});
  }
  const rows=[];
  print(`Route from the economy: ${runs.length} themed sessions, policy ${F.policy}, ${conditionsText(conditions)}`);
  if(PART)console.log(`  WARNING: --part ${PART} applies only the ${PART} half of every condition. These strengths measure that half alone; do not bake them into ROUTE.`);
  M.ROUTE.forEach((r,i)=>{
    const target=r.sector===1?ROUTE_TARGET.opening:ROUTE_TARGET.later;
    const trial=x=>{
      r.scale=x;
      return runs.map(run=>{
        const s=clone(run.s);
        if(s.phase!=='ops')return {s,score:0};
        shop(s,policy,run.order);M.act(s,{type:'launch',parts:run.parts});
        return {s,score:s.results[i].score};
      });
    };
    const rates=out=>Object.fromEntries(ENGINES.map(t=>{const mine=out.filter((o,j)=>runs[j].type===t);return [t,mine.filter(o=>o.score>=WIN).length/mine.length];}));
    let lo=.1,hi=8;
    for(let j=0;j<14;j++){const mid=Math.sqrt(lo*hi);if(median(Object.values(rates(trial(mid))))>=target)lo=mid;else hi=mid;}
    const scale=Math.floor(lo*100)/100,out=trial(scale),rate=rates(out);
    runs=runs.map((run,j)=>({...run,s:out[j].s}));
    // Crew and items at this battle, over the voyages that reached it (an ended voyage has no crew to count).
    const reached=runs.map(run=>run.s.results[i]).filter(Boolean);
    const crew=mean(reached.map(entry=>entry.crew.length)),gear=mean(reached.map(entry=>Object.values(entry.gear).flat().length));
    rows.push({battle:i,sector:r.sector,format:r.format,scale,target,rates:Object.fromEntries(Object.entries(rate).map(([k,v])=>[k,r2(v)])),crew:r2(crew),gear:r2(gear)});
    console.log(`  ${String(i).padEnd(2)} s${r.sector} ${r.format.padEnd(7)} ×${String(scale).padEnd(5)} crew ${crew.toFixed(1)} items ${gear.toFixed(1)}  beaten: ${ENGINES.map(t=>t.slice(0,5)+' '+Math.round(rate[t]*100)+'%').join('  ')}`);
  });
  console.log(`  ROUTE scales: [${rows.map(r=>r.scale).join(', ')}]`);
  return {target:ROUTE_TARGET,conditions,rows};
}

// Which crew each item measurably helps, beyond the output every item gives. Each crewmate fights with its own type,
// at 1.1 times that team's breakpoint (so fights are neither all won nor all lost), wearing the item or a control item
// with no rule, on the same seeds. An item fits its kin (the hand-written crew of its type whose kits use its rule)
// plus anyone it helps by at least FIT_GAIN points of mean score, clear of noise (more than two standard errors).
// Prints the lists to bake into GEAR's `fits`. It never reads `fits` back, so a crewmate no longer helped drops off.
const FIT_GAIN=1;
function fits(){
  const encs=encounterSet(ALL_BOSSES),affixSets=[[],['frost'],['scarce'],['hardened']],scales={},rows={};
  if(PART)console.log(`  WARNING: --part ${PART} applies only the ${PART} half of every condition. These lists measure that half alone; do not bake them into GEAR.`);
  const teamOf=id=>{
    const fam=M.ROSTER[id].family,t=[id,...IDS.filter(x=>x!==id&&M.ROSTER[x].family===fam)].slice(0,4);
    if(!t.some(x=>M.ROSTER[x].row==='front'))t[t.length-1]='Daven';
    return t;
  };
  M.GEAR.__control={id:'__control',name:'Control',fits:[],text:'',apply(){}};
  try{
    for(const g of Object.keys(M.GEAR).filter(g=>g!=='__control')){
      const kin=M.GEAR[g].kin.slice(),gains={};
      for(const id of IDS){
        const team=teamOf(id),key=team.join(',');
        if(!(key in scales))scales[key]=breakpoint(team,[],encs,1)*1.1;
        const diffs=[];
        for(const affixes of affixSets)for(const enc of encs)for(let k=0;k<SEEDS*3;k++){
          const seed=M.hash('fits',enc.format,enc.boss||'',enc.tag||0,affixes.join(),k);
          const score=gear=>M.fight({crew:team.map(c=>({id:c,gear:c===id?[gear]:[]})),affixes,encounter:enc,scale:scales[key],
            affixParts:partsFor(affixes),seed}).score;
          diffs.push((score(g)-score('__control'))*100);
        }
        const avg=mean(diffs),se=Math.sqrt(mean(diffs.map(d=>(d-avg)**2))/diffs.length);
        gains[id]={mean:r2(avg),se:r2(se)};
      }
      const helped=IDS.filter(id=>gains[id].mean>=FIT_GAIN&&gains[id].mean>2*gains[id].se);
      const fit=IDS.filter(id=>kin.includes(id)||helped.includes(id));
      rows[g]={kin,helped,fits:fit,gains};
      const added=helped.filter(id=>!kin.includes(id));
      console.log(`  ${M.GEAR[g].name.padEnd(15)} kin ${kin.join(', ')}${added.length?` | also helps ${added.map(id=>`${id} +${gains[id].mean}`).join(', ')}`:''}`);
    }
  }finally{delete M.GEAR.__control;}
  print('Fit lists to bake into GEAR (kin plus measurably helped)');
  Object.entries(rows).forEach(([g,r])=>console.log(`  ${g}: [${r.fits.map(id=>`'${id}'`).join(',')}]`));
  return {gain:FIT_GAIN,rows};
}

function print(title){console.log('\n'+title);}

// ---- Flags --------------------------------------------------------------------------------------------------------
// One table, read once before any command runs, by one walk over the command line: the command first, then each flag
// once with exactly one value. An unknown flag, a flag with no value, a repeated flag, a stray word, or a value the tool
// cannot use stops the run with an error naming it, never a run that quietly measures something else.
function fail(text){console.error(text);process.exit(1);}
const isNumber=v=>v!==undefined&&v.trim()!==''&&Number.isFinite(Number(v));
const whole=min=>({rule:`a whole number of at least ${min}`,ok:v=>/^\d+$/.test(v)&&Number(v)>=min,read:Number});
const list=v=>v.split(',').filter(Boolean);
const stat=file=>{try{return fs.statSync(file);}catch(e){return null;}};
// The most conditions any legal Brief holds, by the rule rollBrief stacks them with (a legal stack that still leaves three
// fitting bosses). A larger --count would quietly roll smaller Briefs than asked.
const briefFits=ids=>M.legalStack(ids)&&Object.keys(M.BOSSES).filter(b=>M.bossFits(b,ids)).length>=3;
const MOST_CONDITIONS=(()=>{const pool=Object.keys(M.AFFIXES);let k=pool.length;while(k>0&&!combos(pool,k).some(briefFits))k--;return k;})();
const tuningKey=key=>Object.hasOwn(M.T,key)&&typeof M.T[key]==='number';
// --set foeAtk=2.2,Hanae.atk=14,Sevim.aoe=1: combat constants, roster stats, or kit numbers.
function setTarget(key){
  if(!key.includes('.'))return tuningKey(key)?[M.T,key]:null;
  const [id,field]=key.split('.'),c=Object.hasOwn(M.ROSTER,id)?M.ROSTER[id]:null;
  if(!c)return null;
  if(c.k&&Object.hasOwn(c.k,field)&&typeof c.k[field]==='number')return [c.k,field];
  return Object.hasOwn(c,field)&&typeof c[field]==='number'?[c,field]:null;
}
// --econ startCrew=3,startGold=10,voucher4=22: economy constants; voucherN sets the price of berth N.
function econTarget(key){
  const m=key.match(/^voucher(\d)$/);
  if(m)return [M.ECON.voucher,m[1]];
  return Object.hasOwn(M.ECON,key)&&typeof M.ECON[key]==='number'?[M.ECON,key]:null;
}
// key=number pairs, read as [object, key, number] assignments.
const assignments=(target,what)=>({rule:`key=number pairs separated by commas, each key ${what}`,
  ok:v=>list(v).every(pair=>{const [key,value,extra]=pair.split('=');return extra===undefined&&isNumber(value)&&!!target(key);}),
  read:v=>list(v).map(pair=>{const [key,value]=pair.split('=');return [...target(key),Number(value)];})});
const FLAGS={
  seeds:{fallback:'2',...whole(1)},
  briefs:{fallback:'24',...whole(1)},
  count:{fallback:'2',rule:`a whole number from 0 to ${MOST_CONDITIONS}, the most conditions a legal Brief holds`,   // per rolled Brief
    ok:v=>/^\d+$/.test(v)&&Number(v)<=MOST_CONDITIONS,read:Number},
  part:{fallback:null,rule:'tax or gift',ok:v=>v==='tax'||v==='gift'},   // measure one half of every affix on its own
  affixes:{fallback:'',rule:`different conditions from ${Object.keys(M.AFFIXES).join(', ')}, separated by commas`,   // inspect
    ok:v=>list(v).every(id=>Object.hasOwn(M.AFFIXES,id))&&new Set(list(v)).size===list(v).length,read:list},
  set:{fallback:'',...assignments(setTarget,'a tuning constant or Crewmate.field')},
  econ:{fallback:'',...assignments(econTarget,'an economy constant or voucherN')},
  grid:{fallback:'[{}]',rule:'a JSON list of objects that map tuning constants to numbers',read:JSON.parse,   // sweep
    ok:v=>{
      let g;try{g=JSON.parse(v);}catch(e){return false;}
      return Array.isArray(g)&&g.length>0&&g.every(o=>o&&typeof o==='object'&&!Array.isArray(o)&&
        Object.entries(o).every(([key,x])=>tuningKey(key)&&Number.isFinite(x)));
    }},
  rounds:{fallback:'8',...whole(0)},      // flatten
  policy:{fallback:'five',rule:`one of ${Object.keys(POLICIES).join(', ')}`,ok:v=>Object.hasOwn(POLICIES,v)},   // route
  // Checked now, so a long run is never lost to a path it cannot write. A path ending in a separator names a folder.
  // Reaching a file needs search (X) permission on its folder. Creating one also needs write permission on the folder;
  // replacing one needs write permission on the file only (it is overwritten in place), so /dev/stdout works.
  out:{fallback:null,rule:'a file path (not a folder) in a folder that exists, naming a file that can be written or created there',
    ok:v=>{
      const dir=stat(path.dirname(v)),self=stat(v);
      if(v===''||v.endsWith('/')||v.endsWith(path.sep)||!dir||!dir.isDirectory()||(self&&self.isDirectory()))return false;
      try{
        fs.accessSync(path.dirname(v),self?fs.constants.X_OK:fs.constants.W_OK|fs.constants.X_OK);
        if(self)fs.accessSync(v,fs.constants.W_OK);
      }catch(e){return false;}
      return true;
    }}
};
function readFlags(){
  const given={},unknown=[],missing=[],repeated=[],stray=[];
  for(let i=args[0]===command?1:0;i<args.length;){
    const token=args[i],name=token.slice(2),value=args[i+1],hasValue=value!==undefined&&!value.startsWith('--');
    if(!token.startsWith('--')){stray.push(token);i++;continue;}
    if(!Object.hasOwn(FLAGS,name))unknown.push(token);
    else if(!hasValue)missing.push(token);
    else if(Object.hasOwn(given,name))repeated.push(token);
    else given[name]=value;
    i+=hasValue?2:1;
  }
  if(unknown.length)fail(`Unknown flag ${unknown[0]} (flags: ${Object.keys(FLAGS).map(name=>'--'+name).join(' ')})`);
  if(missing.length)fail(`${missing[0]} needs a value`);
  if(repeated.length)fail(`${repeated[0]} is given more than once`);
  if(stray.length)fail(`Unexpected ${JSON.stringify(stray[0])}: the command comes first and each flag takes one value `+
    '(node sim/affix-lab.js <command> --flag value ...)');
  const flags=Object.fromEntries(Object.entries(FLAGS).map(([name,f])=>{
    const v=Object.hasOwn(given,name)?given[name]:f.fallback;
    if(Object.hasOwn(given,name)&&f.ok&&!f.ok(v))fail(`--${name} must be ${f.rule} (got ${JSON.stringify(v)})`);
    return [name,v===null?null:f.read?f.read(v):v];
  }));
  return {given,flags};
}
// GIVEN keeps every flag exactly as typed, so the results file can say how to reproduce the run (--set Reva.power=0.5,
// --part tax, --policy wide…); everything not given took its default.
const {given:GIVEN,flags:F}=readFlags(),SEEDS=F.seeds,BRIEFS=F.briefs,COUNT=F.count,PART=F.part,OUT=F.out;
[...F.set,...F.econ].forEach(([target,key,v])=>{target[key]=v;});
// The economy as a whole, after every --econ assignment. Plans list six crewmates, so at most six berths; the starting
// crew fits in them; and every berth a voyage can open has a price.
{
  const {startCrew,maxBerths,voucher}=M.ECON;
  if(!Number.isInteger(maxBerths)||maxBerths>6)fail(`--econ maxBerths must be a whole number no higher than 6 (got ${maxBerths})`);
  if(!Number.isInteger(startCrew)||startCrew<1||startCrew>maxBerths)
    fail(`--econ startCrew must be a whole number from 1 to maxBerths, ${maxBerths} (got ${startCrew})`);
  for(let n=startCrew+1;n<=maxBerths;n++)if(!Number.isFinite(voucher[n]))fail(`--econ needs voucher${n}: berth ${n} can be opened but has no price`);
}
// The affixParts every fight takes under --part, screening and whole sessions alike.
const partsFor=affixes=>PART?Object.fromEntries(affixes.map(id=>[id,PART])):undefined;

// ---- Run ----------------------------------------------------------------------------------------------------------
const t0=Date.now(),results={command,flags:GIVEN,seeds:SEEDS,tuning:{...M.T},economy:JSON.parse(JSON.stringify(M.ECON)),route:M.ROUTE.map(r=>r.scale),startedAt:new Date().toISOString()};
const run={baseline,inspect,roster,flatten,sweep,matrix,intent,churn,policies,route,fits};
if(command==='all'){results.baseline=baseline();results.roster=roster();results.matrix=matrix();results.intent=intent();results.churn=churn();results.policies=policies();}
else if(run[command])results[command]=run[command]();
else{console.error(`Unknown command ${command}`);process.exit(1);}
results.seconds=Math.round((Date.now()-t0)/100)/10;
console.log(`\n${results.seconds}s`);
if(OUT){fs.writeFileSync(OUT,JSON.stringify(results,null,1));console.log(`wrote ${OUT}`);}
