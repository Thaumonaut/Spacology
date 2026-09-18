const path=require('path');
// Minimal DOM shim so the prototype's logic can be exercised without a browser.
const fs=require('fs');
const html=fs.readFileSync(path.join(__dirname,'../../prototypes/watchable-fight.html'),'utf8');
const code=html.match(/<script>([\s\S]*)<\/script>/)[1];
const ids=[...new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(x=>x[1]))];

function mkEl(id){
  const el={id,style:{},dataset:{},children:[],textContent:'',_html:'',
    classList:{_s:new Set(),add(){[...arguments].forEach(c=>this._s.add(c))},
      remove(){[...arguments].forEach(c=>this._s.delete(c))},
      toggle(c,v){v?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c);return c},
    remove(){}, querySelector(){return mkEl('q')}, querySelectorAll(){return []},
    getBoundingClientRect(){return {left:0,top:0,width:100,height:40,right:100,bottom:40}},
    getContext(){return {setTransform(){},clearRect(){},save(){},restore(){},
      translate(){},rotate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},arc(){},
      arcTo(){},closePath(){},fill(){},stroke(){},fillRect(){},fillText(){},
      drawImage(){},measureText(){return {width:20}},filter:'',globalAlpha:1,
      globalCompositeOperation:'',font:'',textAlign:'',textBaseline:'',
      shadowColor:'',shadowBlur:0,shadowOffsetY:0,fillStyle:'',strokeStyle:'',lineWidth:1,
      lineCap:''};},
    width:100,height:40,
    addEventListener(){}, get innerHTML(){return this._html},
    set innerHTML(v){this._html=v; this.children=[];},
    get clientWidth(){return 350}, get clientHeight(){return 214},
    get offsetWidth(){return 100}, get offsetHeight(){return 40},
    get offsetLeft(){return 0}, get offsetTop(){return 0},
    get value(){return this._v===undefined?'100':this._v},
    set value(v){this._v=v}, checked:true};
  return el;
}
const REG={};
ids.forEach(i=>REG[i]=mkEl(i));
// sliders need plausible numbers
const nums={rTempo:'100',rDens:'100',rBloom:'8',rPun:'35',rHit:'90',rReb:'80',
  rBeat:'220',rAEn:'200',rASt:'220',rTEn:'180',rTSt:'200',rExt:'200',rWin:'480',
  rDra:'70',rFlash:'110',rHolo:'24',rLen:'90',rCr:'4',rFo:'3',rMx:'35',rUl:'2',
  rCap:'12',rStage:'2',rPool:'12'};
Object.entries(nums).forEach(([k,v])=>{ if(REG[k]) REG[k]._v=v; });

const document={getElementById:id=>REG[id]||null,
  createElement:t=>mkEl('new-'+t),
  querySelectorAll:()=>[], body:mkEl('body'),
  documentElement:{style:{setProperty(){}}},
  addEventListener(){}};
const window={devicePixelRatio:1,addEventListener(){},
  AudioContext:function(){return{createOscillator:()=>({connect(){},start(){},stop(){},
    frequency:{value:0},type:''}),createGain:()=>({connect(){},gain:{setValueAtTime(){},
    exponentialRampToValueAtTime(){}}}),currentTime:0,destination:{}}}};
const timers=[];
const setTimeout_=(f)=>{timers.push(f);return timers.length};
const sandbox={document,window,console,Math,Date,Set,JSON,Array,Object,String,Number,
  setTimeout:setTimeout_,clearTimeout(){},setInterval(){},clearInterval(){},
  requestAnimationFrame(f){return 1},cancelAnimationFrame(){},isFinite,parseInt,parseFloat};

let api;
try{
  api=new Function(...Object.keys(sandbox), code+`
    ;return {build,resolveAction,project,U,coverage,spawnFoes,
             get G(){return G;}, set FIELDV(v){FIELD=v;}, set POOLV(v){POOL=v;}};`
  )(...Object.values(sandbox));
}catch(e){ console.log('LOAD FAILED: '+e.message); process.exit(1); }
console.log('script loads cleanly');

let fails=0;
for(const team of ['bloom','ledger','plate','relay','found','flat']){
  for(const planet of ['order','pairish','spread','away']){
    for(const [f,p] of [[3,6],[6,12],[9,18]]){
      try{
        api.FIELDV=f; api.POOLV=p;
        api.build(team,planet);
        let guard=0,end=null;
        while(guard++<600){
          const ev=api.resolveAction();
          if(ev && ev.end){ end=ev.end; break; }
        }
        if(!end){ console.log('NO END: '+team+'/'+planet+' '+f+'v'+p); fails++; }
      }catch(e){
        console.log('THREW: '+team+'/'+planet+' '+f+'v'+p+' -> '+e.message); fails++;
      }
    }
  }
}
console.log(fails? fails+' failures' : 'all 48 team/planet/encounter combinations resolved');

// ULT CHECK - an interrupting ultimate must not consume anyone's turn
console.log('\nultimates as interrupts');
console.log('  team      ults  interrupts  lost slot  turns stolen');
for(const t of ['bloom','ledger','plate','relay']){
  api.FIELDV=6; api.POOLV=12; api.build(t,'spread');
  let guard=0, ults=0, ints=0, stolen=0, holds=[];
  let prevAV=null;
  while(guard++<700){
    const G=api.G;
    const ev=api.resolveAction();
    if(ev&&ev.end) break;
    if(ev&&ev.ult){ ults++;
      if(ev.interrupt){ ints++;
        // the real test: an interrupt must never queue a turn reset for anyone
        if(G.pending) stolen++;
        // and the unit that cut in must still be waiting its normal turn
        const q=api.project(6).map(x=>x.u.id);
        if(q.indexOf(ev.actor.id)<0) holds.push(ev.actor.id);
      }
    }
    G.units.forEach(u=>{ if(u.side==='foe'&&!u.alive&&!u.retired){
      u.retired=true; u.retiring=false; } });
  }
  console.log('  '+t.padEnd(10)+String(ults).padEnd(6)+String(ints).padEnd(12)+
    String(holds.length).padEnd(10)+stolen);
}

// SNAPSHOT CHECK - a card must be able to open on pre-action health
console.log('\ndoes the snapshot precede the damage?');
for(const t of ['bloom','ledger','plate']){
  api.FIELDV=6; api.POOLV=12; api.build(t,'spread');
  let guard=0, staleOpens=0, checked=0, held=0;
  while(guard++<600){
    const ev=api.resolveAction();
    if(ev&&ev.end) break;
    const G=api.G;
    if(!G.hp0) continue;
    (ev.hits||[]).forEach(h=>{
      const u=G.units.find(x=>x.id===h.tgt);
      if(!u) return;
      checked++;
      // the snapshot must be at least the current health, never behind it
      if(G.hp0[h.tgt]<u.hp) staleOpens++;
    });
    held+=G.units.filter(x=>x.side==='foe'&&!x.alive&&x.retiring).length;
    G.units.forEach(u=>{ if(u.side==='foe'&&!u.alive&&!u.retired){
      u.retired=true; u.retiring=false; } });
  }
  console.log('  '+t.padEnd(8)+checked+' hits checked, '+staleOpens+' stale snapshots');
}

// BLOOM CHECK - the bloom event must resolve without an actor
console.log('\nbloom events, and whether anything reads an actor that is not there');
for(const [f,p] of [[6,12],[9,18]]){
  api.FIELDV=f; api.POOLV=p; api.build('bloom','spread');
  let guard=0, blooms=0, burned=0, err=null;
  try{
    while(guard++<900){
      const ev=api.resolveAction();
      if(ev&&ev.end) break;
      if(ev&&ev.bloom){ blooms++;
        burned+=ev.burn.reduce((a,b)=>a+b.dmg,0);
        if(ev.actor!==undefined) err='bloom carried an actor'; }
    }
  }catch(e){ err=e.message; }
  console.log('  '+f+'v'+p+'   blooms '+blooms+'   damage from blooms '+burned+
    '   '+(err?('ERROR: '+err):'clean'));
}

// do dead enemies actually leave the ribbon?
console.log('\nteam      field/pool  total spawned  dead  still rendered  peak rendered');
for(const team of ['bloom','ledger','plate','relay','found']){
  for(const [f,p] of [[6,12],[9,18]]){
    api.FIELDV=f; api.POOLV=p; api.build(team,'spread');
    let guard=0, peak=0;
    while(guard++<900){
      const ev=api.resolveAction();
      if(ev&&ev.end) break;
      const G=api.G;
      // the browser sweeps after each action; mirror that here
      G.units.forEach(u=>{ if(u.side==='foe'&&!u.alive&&!u.retired){
        u.retired=true; u.retiring=false; } });
      const shown=G.units.filter(u=>u.side==='foe'&&(u.alive||u.retiring)).length;
      peak=Math.max(peak,shown);
    }
    const G=api.G;
    const foes=G.units.filter(u=>u.side==='foe');
    const dead=foes.filter(u=>!u.alive).length;
    const rendered=foes.filter(u=>u.alive||u.retiring).length;
    console.log(team.padEnd(10)+(f+'/'+p).padEnd(12)+String(foes.length).padEnd(15)+
      String(dead).padEnd(6)+String(rendered).padEnd(16)+peak);
  }
}

// what the bigger encounters actually produce
console.log('\nteam      field  pool  result        rounds  actions  follows  maxChain  breaks');
for(const team of ['bloom','ledger','plate','relay','found']){
  for(const [f,p] of [[3,6],[6,12],[9,18]]){
    let R=0,A=0,F=0,M=0,B=0,W=0,N=40;
    for(let s=0;s<N;s++){
      api.FIELDV=f; api.POOLV=p; api.build(team,'spread');
      let guard=0,end=null;
      while(guard++<900){ const ev=api.resolveAction(); if(ev&&ev.end){end=ev.end;break;} }
      const G=api.G;
      R+=G.round; A+=G.actions; F+=G.follows||0; M=Math.max(M,G.maxChain||0);
      B+=G.breaks; if(end==='Crew wins')W++;
    }
    console.log(team.padEnd(10)+String(f).padEnd(7)+String(p).padEnd(6)+
      (Math.round(W/N*100)+'% win').padEnd(14)+(R/N).toFixed(1).padEnd(8)+
      (A/N).toFixed(0).padEnd(9)+(F/N).toFixed(1).padEnd(9)+String(M).padEnd(10)+
      (B/N).toFixed(1));
  }
}
