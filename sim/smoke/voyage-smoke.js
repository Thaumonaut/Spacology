const path=require('path');
const fs=require('fs');
const html=fs.readFileSync(path.join(__dirname,'../../prototypes/voyage.html'),'utf8');
const code=html.match(/<script>([\s\S]*)<\/script>/)[1];
const ids=[...new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(x=>x[1]))];
function mk(id){const e={id,style:{},dataset:{},children:[],textContent:'',_h:'',value:'100',
  classList:{_s:new Set(),add(){[...arguments].forEach(c=>this._s.add(c))},
    remove(){[...arguments].forEach(c=>this._s.delete(c))},
    toggle(c,v){v?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
  appendChild(c){this.children.push(c);return c},remove(){},
  querySelector(){return mk('q')},querySelectorAll(){return []},
  getBoundingClientRect(){return{left:0,top:0,width:100,height:40,right:100,bottom:40}},
  addEventListener(){},insertAdjacentHTML(){},
  getContext(){return new Proxy({},{get:()=>()=>{}})},width:100,height:40,
  get innerHTML(){return this._h},set innerHTML(v){this._h=v;this.children=[]},
  get clientWidth(){return 340},get clientHeight(){return 214},
  get offsetWidth(){return 100},get offsetHeight(){return 40},
  get offsetLeft(){return 0},get offsetTop(){return 0}};return e;}
const REG={}; ids.forEach(i=>REG[i]=mk(i));
const document={getElementById:i=>REG[i]||null,createElement:t=>mk('n-'+t),
  querySelectorAll:()=>[],body:mk('body'),documentElement:{style:{setProperty(){}}},
  addEventListener(){},elementFromPoint(){return null}};
const window={devicePixelRatio:1,addEventListener(){},removeEventListener(){},
  AudioContext:function(){return new Proxy({},{get:()=>()=>new Proxy({},{get:()=>()=>{}})})}};
let api;
try{
 api=new Function('document','window','setTimeout','clearTimeout','setInterval','clearInterval',
  'requestAnimationFrame','cancelAnimationFrame','console','Math','Date','Set','JSON','Array',
  'Object','String','Number','isFinite','parseInt','parseFloat',
  code+`;return {get V(){return V},get G(){return G},newVoyage,screen,launch,settleVoyage,
   openCrate,settlePull,commissionTag,forgeAll,resolveAction,compact,tagN,CREWPOOL,hire,
   rollDestinations,firstGap,SLOTS,FIELDMAX};`
 )(document,window,f=>1,()=>{},()=>1,()=>{},f=>1,()=>{},console,Math,Date,Set,JSON,Array,
   Object,String,Number,isFinite,parseInt,parseFloat);
}catch(e){console.log('LOAD FAILED: '+e.message);process.exit(1);}
console.log('voyage loads cleanly');

let ends={},dat=[],legs=0,fights=0,rounds=0,dangers=[],crates=0;
let earned=0,spent=0,bestStreak=0,sgold=0;
const bands={};
const N=40;
for(let r=0;r<N;r++){
  api.newVoyage();
  const V=api.V;
  let bestStreak2=0;
  // open the free crate plus a couple more, keep everything
  api.openCrate('wide'); api.settlePull(); crates++;
  let protectAlly=0;
  while(protectAlly++<80){
    if(V.data<=0){ ends.lost=(ends.lost||0)+1; break; }
    if(V.leg>V.legs){ ends.home=(ends.home||0)+1; break; }
    if(!V.roster.length){ api.openCrate('wide'); api.settlePull(); crates++; }
    if(V.gold>=26&&V.leg%3===0){ const g0=V.gold;
      api.openCrate(V.gold>36?'focus':'wide');
      api.settlePull(); crates++; spent+=g0-V.gold; }
    api.rollDestinations();
    // a middling captain: take the middle danger
    const order=V.offer.map((d,i)=>[i,d.danger]).sort((a,b)=>a[1]-b[1]);
    const pick=order[Math.floor(order.length/2)][0];
    dangers.push(V.offer[pick].danger);
    api.launch(pick);
    const G=api.G; let g2=0,ev;
    while(g2++<900){ ev=api.resolveAction(); if(ev&&ev.end) break; }
    fights++; rounds+=G.round; legs++;
    const pctv=G.ptsMax?Math.min(100,Math.round(G.pts/G.ptsMax*100)):0;
    const bk=pctv>=100?'perfect':pctv>=95?'slight':pctv>=75?'small':
             pctv>=50?'mild':pctv>=25?'hard':'crushing';
    bands[bk]=(bands[bk]||0)+1;
    const gBefore=V.gold;
    api.settleVoyage(ev.end);
    earned+=V.gold-gBefore;
    if(V.streak>bestStreak2) bestStreak2=V.streak;
  }
  dat.push(V.data); bestStreak+=bestStreak2;
  sgold+=0;
}
dat.sort((a,b)=>a-b);
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
console.log('\n'+N+' voyages');
console.log('  ended        '+JSON.stringify(ends));
console.log('  legs run     '+(legs/N).toFixed(1));
console.log('  rounds/fight '+(rounds/Math.max(1,fights)).toFixed(1));
console.log('  crates       '+(crates/N).toFixed(1));
console.log('  gold earned  '+(earned/N).toFixed(0)+'   spent '+(spent/N).toFixed(0));
console.log('  best streak  '+(bestStreak/N).toFixed(1)+'   streak gold '+(sgold/N).toFixed(0));
console.log('  danger taken '+avg(dangers).toFixed(2));
console.log('  final data   median '+dat[Math.floor(N/2)].toFixed(0)+'%  range '+
  dat[0].toFixed(0)+'\u2013'+dat[N-1].toFixed(0)+'%');
const tot=Object.values(bands).reduce((a,b)=>a+b,0)||1;
console.log('  outcome bands');
['perfect','slight','small','mild','hard','crushing'].forEach(k=>{
  if(bands[k]) console.log('    '+k.padEnd(10)+Math.round(bands[k]/tot*100)+'%'); });
