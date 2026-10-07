// ============================================================================
//  Headless host for the live combat rules (prototypes/combat-core.js).
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
//
//  Not yet page-faithful for voyage fights (spec.session): the page's loadSpacologySession sets the encounter
//  globals and normalises the session, and its paintAether() draws Math.random after build(). Moving voyage setup
//  into the core (phase 2) closes both gaps.
// ============================================================================
'use strict';
const vm=require('vm'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
// watchable-fight.html's script order; page-only scripts (menus, preferences) are left out.
const SCRIPTS=['voyage-settings.js','voyage-rules.js','recovery-scoring.js','session-store.js','expedition-rules.js','treasure-rules.js',
  'field-progression.js','weaver-roster.js','formation-rules.js','down-recovery.js','aether-rules.js','../sim/enemy-catalogue.js',
  'enemy-summoning.js','enemy-traits.js','crew-progression.js','combat-core.js'];
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
  if(opts.session)ctx.SPACOLOGY_SESSION=opts.session;
  return ctx;
}

// Runs one battle. Math.random is the context's own, reseeded right before setup, exactly as the parity harness seeds the page.
function runFight(spec={}){
  const ctx=createContext(spec);
  if(spec.crew){ctx.TEAMS.ops={note:'headless',crew:JSON.parse(JSON.stringify(spec.crew)),ship:spec.ship||{}}}
  if(spec.globals)Object.assign(ctx,spec.globals);
  ctx.__seededRandom=seeded(spec.seed===undefined?1:spec.seed);vm.runInContext('Math.random=__seededRandom',ctx);
  ctx.build(spec.crew?'ops':spec.team||'bloom',spec.planet||'spread');
  if(spec.setup)spec.setup(ctx);
  const ref=(k,v)=>v&&typeof v==='object'&&'side' in v&&'id' in v&&v!==ctx.G?'#'+v.id:typeof v==='number'?Math.round(v*1e6)/1e6:v;
  const events=[];let end=null;
  for(let i=0;i<(spec.maxSteps||600);i++){const e=ctx.resolveAction();events.push(JSON.parse(JSON.stringify(e,ref)));if(e.end){end=e.end;break}}
  const G=ctx.G;
  return {end,steps:events.length,events,
    units:G.units.map(u=>[u.id,u.side,Math.round(u.hp*1e6)/1e6,u.alive,u.layers,Math.round((u.av||0)*1e6)/1e6]),
    aether:G.aether?{current:G.aether.current,max:G.aether.max,spent:G.aether.spent,generated:G.aether.generated}:null,
    context:spec.keepContext?ctx:undefined};
}

module.exports={runFight,createContext,SCRIPTS};
