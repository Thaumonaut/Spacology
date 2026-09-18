const fs=require('fs');
const html=fs.readFileSync('/mnt/user-data/outputs/session.html','utf8');
const code=html.match(/<script>([\s\S]*)<\/script>/)[1];
const ids=[...new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(x=>x[1]))];
function mkEl(id){
  const e={id,style:{},dataset:{},children:[],textContent:'',_h:'',value:'100',checked:true,
    classList:{_s:new Set(),add(){[...arguments].forEach(c=>this._s.add(c))},
      remove(){[...arguments].forEach(c=>this._s.delete(c))},
      toggle(c,v){v?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c);return c},remove(){},
    querySelector(){return mkEl('q')},querySelectorAll(){return []},
    getBoundingClientRect(){return{left:0,top:0,width:100,height:40,right:100,bottom:40}},
    addEventListener(){},insertAdjacentHTML(){},
    getContext(){return{setTransform(){},clearRect(){},save(){},restore(){},translate(){},
      rotate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},arc(){},closePath(){},
      fill(){},stroke(){},fillRect(){},fillText(){},drawImage(){},
      measureText(){return{width:20}},filter:'',globalAlpha:1,globalCompositeOperation:'',
      font:'',textAlign:'',textBaseline:'',shadowColor:'',shadowBlur:0,shadowOffsetY:0,
      fillStyle:'',strokeStyle:'',lineWidth:1,lineCap:''}},
    width:100,height:40,
    get innerHTML(){return this._h},set innerHTML(v){this._h=v;this.children=[]},
    get clientWidth(){return 340},get clientHeight(){return 214},
    get offsetWidth(){return 100},get offsetHeight(){return 40},
    get offsetLeft(){return 0},get offsetTop(){return 0}};
  return e;
}
const REG={}; ids.forEach(i=>REG[i]=mkEl(i));
const document={getElementById:i=>REG[i]||null,createElement:t=>mkEl('n-'+t),
  querySelectorAll:()=>[],body:mkEl('body'),
  documentElement:{style:{setProperty(){}}},addEventListener(){}};
const window={devicePixelRatio:1,addEventListener(){},
  AudioContext:function(){return{createOscillator:()=>({connect(){},start(){},stop(){},
    frequency:{value:0},type:''}),createGain:()=>({connect(){},gain:{setValueAtTime(){},
    exponentialRampToValueAtTime(){}}}),currentTime:0,destination:{}}}};
let api;
try{
  api=new Function('document','window','setTimeout','clearTimeout','setInterval',
    'clearInterval','requestAnimationFrame','cancelAnimationFrame','console','Math','Date',
    'Set','JSON','Array','Object','String','Number','isFinite','parseInt','parseFloat',
    code+`;return {get R(){return R}, get G(){return G}, newRun, runScreen, beginFight,
      resolveAction, settleFight, field, tagN, openCrate, commissionTag, craftAll,
      tradeShards, settle, recruit, POOLCHARS, encounter, MAXROSTER, CRATES};`
  )(document,window,f=>1,()=>{},()=>1,()=>{},f=>1,()=>{},console,Math,Date,Set,JSON,
    Array,Object,String,Number,isFinite,parseInt,parseFloat);
}catch(e){ console.log('LOAD FAILED: '+e.message); process.exit(1); }
console.log('session loads cleanly');

let done=0,lost=0,fights=0,rounds=0,crates=0,coms=0,integ=[],why={};
const N=40;
for(let r=0;r<N;r++){
  api.newRun();
  const R=api.R;
  // draft: take the first four offered
  api.runScreen('draft');
  R.roster=[]; R.offer.slice(0,4).forEach(u=>{u.fielded=true;R.roster.push(u)});
  R.offer=null;
  let guard=0;
  while(guard++<120){
    if(R.node>=R.map.length){ done++; why.finished=(why.finished||0)+1; break; }
    if(R.hull<=0){ lost++; why.integrity=(why.integrity||0)+1; break; }
    const n=R.map[R.node];
    if(n.t==='store'){
      let sp=0;
      while(R.gold>=26&&sp++<5){
        const edge=Object.keys({Hull:1,Blight:1,Drive:1,Ordnance:1,Assay:1,Crew:1})
          .find(t=>{const c=api.tagN(t);return c===1||c===3});
        if(edge&&R.gold>=96){ api.commissionTag(edge); coms++; }
        else { api.openCrate(sp%2?'focus':'wide'); crates++; api.settle(); }
      }
      api.craftAll(); api.settle(); R.node++; continue;
    }
    api.beginFight();
    const G=api.G; let g2=0,ev;
    while(g2++<900){ ev=api.resolveAction(); if(ev&&ev.end) break; }
    fights++; rounds+=G.round;
    api.settleFight(ev.end);
  }
  integ.push(R.hull);
}
integ.sort((a,b)=>a-b);
console.log('\n'+N+' runs played end to end');
console.log('  finished          '+done+'  ('+Math.round(done/N*100)+'%)');
console.log('  integrity hit 0   '+lost);
console.log('  fights per run    '+(fights/N).toFixed(1));
console.log('  rounds per fight  '+(rounds/Math.max(1,fights)).toFixed(1));
console.log('  crates opened     '+(crates/N).toFixed(1));
console.log('  commissions       '+(coms/N).toFixed(1));
console.log('  final integrity   median '+integ[Math.floor(N/2)].toFixed(0)+
  '%   range '+integ[0].toFixed(0)+'\u2013'+integ[N-1].toFixed(0)+'%');
console.log('  how runs ended    '+JSON.stringify(why));
