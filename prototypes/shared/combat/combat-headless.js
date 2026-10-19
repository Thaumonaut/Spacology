// ============================================================================
//  Headless host for the live combat rules (prototypes/shared/combat/combat-core.js).
//
//  Loads the same scripts, in the same order, as watchable-fight.html into an
//  isolated Node context, stubs the page's redraw calls with no-ops, and runs a
//  battle with resolveAction() until it ends. Each fight gets its own context
//  and its own seeded Math.random, so the same spec and seed give the same
//  battle. tests/unit/combat-headless.cjs checks it against the live page's
//  recorded event stream.
//
//  const {runFight}=require('./combat-headless.js');
//  runFight({team:'bloom',planet:'spread',seed:7})  // a prototype team
//  runFight({crew:[...],planet:'spread',seed:7})    // crew in the live kit format
//  runFight({session:voyageState,seed:7})           // a voyage battle, set up exactly as the page does (voyageEncounter)
//  runFight({...,rng:myRandom})                     // inject the rules' random source instead of seeding
//  runFight({...,on:{afterHit(p,api){...}}})        // listen to the fight (COMBAT_HOOKS in combat-core.js)
//  runFight({...,rules:{healMul:.5,SOAK:.3,BRK:{vuln:.5}}})   // this fight's rules (COMBAT_RULES or a core tunable)
//
//  The result: {end, steps, events, units, aether, metrics, state}. metrics are the fight's totals; state is G as
//  JSON, with every reference to a unit outside G.units written '#id', as in the events.
// ============================================================================
'use strict';
const vm=require('vm'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
// watchable-fight.html's script order; page-only scripts (menus, preferences) are left out.
const SCRIPTS=['shared/voyage/voyage-settings.js','shared/voyage/voyage-rules.js','shared/voyage/recovery-scoring.js','shared/voyage/session-store.js','shared/voyage/expedition-rules.js','shared/voyage/treasure-rules.js',
  'shared/voyage/field-progression.js','shared/combat/weaver-roster.js','shared/combat/formation-rules.js','shared/combat/down-recovery.js','shared/combat/aether-rules.js','../sim/enemy-catalogue.js',
  'shared/combat/enemy-summoning.js','shared/combat/enemy-traits.js','shared/voyage/crew-progression.js','shared/combat/combat-core.js'];
const SOURCES=SCRIPTS.map(f=>{const file=path.join(ROOT,f);return new vm.Script(fs.readFileSync(file,'utf8'),{filename:file})});
// The page functions the rules call to redraw or log. Headless, they do nothing.
const UI=['clr','pxClear','pxResize','log','ribbons','paintAll','track','chainNote','aiNote','injNote','updateEnemyCounter','reflowFoes','paintTreasure'];

// Takes the seed as given, as the parity harness does: mulberry32 is fine at 0, so 0 is its own battle.
function seeded(seed){let a=seed;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}}

function createContext(opts={}){
  const ctx={console,setTimeout:()=>0,clearTimeout:()=>{},location:{search:'',href:''},localStorage:memoryStorage(),
    document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
    navigator:{},URLSearchParams};
  ctx.window=ctx;ctx.self=ctx;vm.createContext(ctx);
  for(const s of SOURCES)s.runInContext(ctx);
  // Page globals the rules read, and no-op redraws. Declared after the scripts so they win over nothing and shadow nothing.
  vm.runInContext('var G=null,MODE="none",playing=false,busy=false,chain=[];',ctx);
  for(const name of UI)ctx[name]=function(){};
  // build() and settleTreasure() write to a few page elements; headless, every element is a sink that accepts anything.
  const sink=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>'':sink,set:()=>true,apply:()=>sink});
  ctx.$=()=>sink;
  return ctx;
}

// The tunables a fight's rules may set besides COMBAT_RULES: the core's own constants. Objects merge key by key.
// Some are accepted but change nothing here: the engine never reads SHLAYERS (only the page's drawing does), BRK.vdur
// or BRK.regen, and reads SHPER only for a unit without its own shieldPer, which every enemy has.
const TUNABLES=['SOAK','SHPER','SHLAYERS','UNMATCHED','HARM','DEATHCOST','MAXROUND','CHAINCAP','BRK','EN'];
function applyRules(ctx,rules){
  for(const [key,value] of Object.entries(rules)){
    if(Object.hasOwn(ctx.COMBAT_RULES,key)){
      if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`rule ${key} must be a finite number`);
      if(key.endsWith('Mul')&&value<0)throw new Error(`rule ${key} cannot be negative`);
      if(key==='layerDelta'&&!Number.isInteger(value))throw new Error('rule layerDelta must be a whole number');
      ctx.COMBAT_RULES[key]=value;
    }else if(TUNABLES.includes(key)){
      const current=ctx[key];
      if(current&&typeof current==='object'){
        if(!value||typeof value!=='object')throw new Error(`rule ${key} takes an object of ${Object.keys(current).join(', ')}`);
        for(const [k,v] of Object.entries(value)){
          if(!Object.hasOwn(current,k))throw new Error(`unknown rule ${key}.${k}`);
          if(typeof v!=='number'||!Number.isFinite(v))throw new Error(`rule ${key}.${k} must be a finite number`);
        }
        ctx[key]=Object.assign({},current,value);
      }else{
        if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`rule ${key} must be a finite number`);
        ctx[key]=value;
      }
    }else throw new Error(`unknown rule ${key}`);
  }
}
// G as JSON. Units appear in full in G.units; anywhere else a unit is written '#id', as in the event stream.
function snapshot(G){
  return JSON.parse(JSON.stringify(G,function(k,v){
    return v&&typeof v==='object'&&'side' in v&&'id' in v&&this!==G.units?'#'+v.id:v;
  }));
}
function metricsOf(G){
  const m=G.metrics,a=G.aether;
  return {dealt:{...G.dealt},byKind:{...m.byKind},breaks:G.breaks,chains:G.chains,follows:G.follows,
    healed:m.healed,barrier:m.barrier,taken:m.taken,absorbed:m.absorbed,
    aether:a?{generated:a.generated,spent:a.spent,wasted:a.wasted,refused:m.aetherRefused,peak:m.aetherPeak}:null,
    lowestHp:Number.isFinite(m.lowestHp)?m.lowestHp:null,deaths:G.deaths,lastStands:G.lastStands||0,foeAttacks:G.foeAttacks,crewTurns:G.allyTurns||0,rounds:G.round};
}

// Runs one battle. Math.random is the context's own, reseeded right before setup, exactly as the parity harness seeds the page.
function runFight(spec={}){
  const ctx=createContext(spec);
  // A voyage battle: the page's own setup (normalised session, crew, encounter settings), and the page's session flag.
  if(spec.session){const enc=ctx.voyageEncounter(spec.session);ctx.applyVoyageEncounter(enc);ctx.SPACOLOGY_SESSION=enc.session}
  if(spec.crew){ctx.TEAMS.ops={note:'headless',crew:JSON.parse(JSON.stringify(spec.crew)),ship:spec.ship||{}}}
  if(spec.globals)Object.assign(ctx,spec.globals);
  if(spec.rules)applyRules(ctx,spec.rules);
  if(spec.on)ctx.COMBAT_HOOKS=spec.on;
  ctx.__seededRandom=seeded(spec.seed===undefined?1:spec.seed);vm.runInContext('Math.random=__seededRandom',ctx);
  if(spec.rng)ctx.COMBAT_RNG=spec.rng;
  ctx.build(spec.session||spec.crew?'ops':spec.team||'bloom',spec.planet||'spread');
  if(spec.setup)spec.setup(ctx);
  const ref=(k,v)=>v&&typeof v==='object'&&'side' in v&&'id' in v&&v!==ctx.G?'#'+v.id:typeof v==='number'?Math.round(v*1e6)/1e6:v;
  const events=[];let end=null;
  for(let i=0;i<(spec.maxSteps===undefined?600:spec.maxSteps);i++){const e=ctx.resolveAction();events.push(JSON.parse(JSON.stringify(e,ref)));if(e.end){end=e.end;break}}
  const G=ctx.G;
  return {end,steps:events.length,events,
    units:G.units.map(u=>[u.id,u.side,Math.round(u.hp*1e6)/1e6,u.alive,u.layers,Math.round((u.av||0)*1e6)/1e6]),
    aether:G.aether?{current:G.aether.current,max:G.aether.max,spent:G.aether.spent,generated:G.aether.generated}:null,
    metrics:metricsOf(G),state:snapshot(G),
    context:spec.keepContext?ctx:undefined};
}

module.exports={runFight,createContext,SCRIPTS,TUNABLES};
