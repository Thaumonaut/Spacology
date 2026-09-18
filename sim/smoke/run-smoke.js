// run the whole session headlessly: does a run actually complete?
const fs=require('fs');
const html=fs.readFileSync('/mnt/user-data/outputs/run.html','utf8');
const code=html.match(/<script>([\s\S]*)<\/script>/)[1];
function mkEl(id){
  const e={id,style:{},dataset:{},children:[],textContent:'',_h:'',
    classList:{_s:new Set(),add(){[...arguments].forEach(c=>this._s.add(c))},
      remove(){[...arguments].forEach(c=>this._s.delete(c))},
      toggle(c,v){v?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c);return c}, remove(){},
    querySelector(){return mkEl('q')}, querySelectorAll(){return []},
    getBoundingClientRect(){return{left:0,top:0,width:60,height:40}},
    addEventListener(){}, get innerHTML(){return this._h}, set innerHTML(v){this._h=v},
    get clientWidth(){return 340}, get clientHeight(){return 150}};
  return e;
}
const REG={};
['bGold','bNode','bHull','bAct','screen','track','foes','crew','stage','ptag','cap','log',
 'play','step','pull','pullNote','goStore','goFight','goRoster','goBack','goNew',
 'leaveStore','craft','convert','afterFight'].forEach(i=>REG[i]=mkEl(i));
const document={getElementById:i=>REG[i]||null,createElement:t=>mkEl('n-'+t),
  querySelectorAll:()=>[],body:mkEl('body'),addEventListener(){}};
const window={addEventListener(){}};
const timers=[];
const api=new Function('document','window','setTimeout','clearTimeout','requestAnimationFrame',
  'console','Math','Date','Set','JSON','Array','Object','String','Number','isFinite',
  code+`;return {get G(){return G}, get C(){return C}, newRun, show, startFight, step,
    encounterFor, openPack, commission, craftAll, convertShards, settlePull,
    bonuses, fielded, tagCount, mkUnit, POOL, SLOTS, finishFight, alive, foes, pals};`
)(document,window,(f)=>{timers.push(f);return 1},()=>{},()=>1,console,Math,Date,Set,JSON,
  Array,Object,String,Number,isFinite);

console.log('script loads cleanly');
let done=0,lost=0,rounds=0,fights=0,packs=0,coms=0,ups=0,totalGold=0;
const why={}, endTally={};
const N=60;
for(let r=0;r<N;r++){
  api.newRun();
  const G=api.G;
  let guard=0;
  while(guard++<200){
    if(G.node>=G.map.length){ done++; why.finished=(why.finished||0)+1; break; }
    if(G.hull<=0){ lost++; why.hull=(why.hull||0)+1; break; }
    if(!G.roster.filter(u=>u.slot>=0&&u.hp>0).length){
      why.noCrew=(why.noCrew||0)+1; break; }
    const n=G.map[G.node];
    if(n.t==='store'){
      // a plausible shopper: buy crates while affordable, commission at a boundary
      let spins=0;
      while(G.gold>=30&&spins++<6){
        const edge=['Hull','Blight','Drive','Ordnance','Assay','Crew']
          .find(t=>{const c=api.tagCount(t);return c===1||c===3;});
        if(edge&&G.gold>=100){ api.commission(edge); coms++; }
        else { api.settlePull(); api.openPack(spins%2?'focus':'wide'); packs++; api.settlePull(); }
      }
      api.craftAll();
      G.roster.forEach(u=>{ if(G.crystals[u.e]>0&&u.up<2){ G.crystals[u.e]--; u.up++;
        u.dmg=Math.round(u.dmg*1.35); ups++; } });
      G.node++;
      continue;
    }
    // fight it out
    api.startFight();
    const C=api.C; let g2=0,ev;
    while(g2++<900){ ev=api.step(); if(ev.end) break; }
    fights++; rounds+=C.round; endTally[ev.end]=(endTally[ev.end]||0)+1;
    api.finishFight(ev.end);
    if(ev.end!=='win'){ G.hull-=0; if(G.hull<=0) break; G.node++; }
  }
  totalGold+=G.gold;
  if(G.node<G.map.length&&G.hull>0&&guard>=200) why.guard=(why.guard||0)+1;
}
console.log('\n'+N+' full runs played out');
console.log('  completed         '+done+'  ('+Math.round(done/N*100)+'%)');
console.log('  ship lost         '+lost);
console.log('  fights per run    '+(fights/N).toFixed(1));
console.log('  rounds per fight  '+(rounds/Math.max(1,fights)).toFixed(1));
console.log('  crates opened     '+(packs/N).toFixed(1));
console.log('  commissions       '+(coms/N).toFixed(1));
console.log('  upgrades          '+(ups/N).toFixed(1));
console.log('  gold left over    '+(totalGold/N).toFixed(0));
console.log('  how runs ended    '+JSON.stringify(why));
console.log('  how fights ended  '+JSON.stringify(endTally));
