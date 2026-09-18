const {FOEKIND:FOES}=require('./roster.js');
const {CHARS,WORLDS,TAGS}=require('./roster.js');
function mb(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const SHPER=14,UN=.2,SOAK=.55,VULN=.35,DELAY=.35;
const ELS=['order','chaos','growth','void','decay','energy'];

function fight(chars,world,diff,seed){
  const rnd=mb(seed), W=WORLDS[world];
  const U=chars.map((c0,i)=>{const c=(typeof c0==='string')?CHARS[c0]:c0;
    return {id:'a'+i,name:(typeof c0==='string')?c0:(c.tmpl+i),side:'ally',...c,
      sp:Math.round(c.sp*W.speedMul), e:ELS[i%6],
      hp:Math.round(110*(c.hpMul||1)),max:Math.round(110*(c.hpMul||1)),
      av:10000/Math.round(c.sp*W.speedMul),alive:true,bar:0,en:0};});
  // count the tags the crew brought and turn thresholds into real effects
  const tc={};
  U.forEach(u=>(u.tags||[]).forEach(g=>tc[g]=(tc[g]||0)+1));
  const T=g=>tc[g]||0;
  const BON={
    barrier:  (T('Hull')>=2?1.45:1),
    ammo:     T('Hull')>=4,                 // barriers return what they swallow
    stackUp:  (T('Blight')>=2?1:0),
    bloom:    T('Blight')>=4,               // an entity that joins the turn order
    speed:    (T('Drive')>=2?1.12:1),
    relay:    T('Drive')>=4,                // a kill advances the next crewmate
    dmgMul:   (T('Ordnance')>=2?1.2:1),
    overstrike:T('Ordnance')>=4,            // a breaking hit lands twice
    shredMul: (T('Assay')>=2?1.6:1),
    dissect:  T('Assay')>=4,                // break costs two turns
    healMul:  (T('Crew')>=2?1.5:1),
    revive:   T('Crew')>=4
  };
  const blightCount=T('Blight');
  U.forEach(u=>{ u.av=u.av/BON.speed; u.dmg=Math.round(u.dmg*BON.dmgMul); });
  let revived=!BON.revive;
  // the Bloom: not a unit, but it takes a slot in the order
  const BLOOM={av:560,base:560,live:BON.bloom};
  const roster=[];
  W.mix.forEach(([k,n])=>{const a=FOES[k];
    for(let i=0;i<n;i++) roster.push({kind:k,spec:a,
      hp:Math.round(60*diff*a.hp),dmg:Math.round(12*diff*a.dmg),shL:a.shl,sp:a.sp});});
  for(let i=roster.length;i--;){const j=Math.floor(rnd()*(i+1));
    const t=roster[i];roster[i]=roster[j];roster[j]=t;}
  const FIELD=Math.min(9,Math.max(4,Math.round(roster.length*0.5)));
  const all=U.slice(); let spawned=0;
  function spawn(){ while(all.filter(u=>u.side==='foe'&&u.alive).length<FIELD&&spawned<roster.length){
    const p=roster[spawned];
    all.push({id:'f'+spawned,side:'foe',kind:p.kind,spec:p.spec,
      weak:[ELS[spawned%6],ELS[(spawned*3+1)%6]],e:ELS[spawned%6],
      sp:p.sp,dmg:p.dmg,hp:p.hp,max:p.hp,av:(10000/p.sp)*(.4+rnd()*.7)*BON.foeSlow,
      alive:true,shL:p.shL,shC:SHPER,broken:false,vuln:0,ail:0}); spawned++; } }
  spawn();
  const alive=()=>all.filter(u=>u.alive);
  const foes=()=>all.filter(u=>u.side==='foe'&&u.alive);
  const allies=()=>all.filter(u=>u.side==='ally'&&u.alive);
  const isW=(t,e)=>t.weak.indexOf(e)>=0;
  let av=0,round=1,g=0,over=null,big=0,events=0,blooms=0;
  function dmgTo(s,t,a){
    if(!t||!t.alive) return 0;
    let m=1+(t.vuln>0?VULN:0)+(t.ail||0)*.07;
    if(t.side==='foe'&&!t.broken&&t.shL>0) m*=SOAK;
    let d=Math.round(a*m);
    const raw=d;                       // what it would have been before any barrier
    if(t.side==='ally'&&t.bar>0){const s2=Math.min(t.bar,d);t.bar-=s2;d-=s2;}
    t.hp-=d; events++; big=Math.max(big,d);
    if(t.side==='foe'&&t.spec&&t.spec.thorns&&s.side==='ally')
      { s.hp-=Math.round(d*t.spec.thorns); if(s.hp<=0)s.alive=false; }
    // a reflect answers the whole blow, including the part a barrier swallowed
    if(t.side==='ally'&&s.side==='foe'&&t.alive){
      const rate=(t.thorns||0)*(BON.ammo?1.6:1)+(BON.ammo&&t.bar>0?1.4:0);
      if(rate>0) dmgTo(t,s,Math.round((BON.ammo?raw:d)*rate)); }
    if(t.hp<=0&&t.alive){
      if(t.side==='ally'&&!revived){ revived=true; t.hp=Math.round(t.max*0.5); }
      else { t.alive=false;
        if(t.side==='foe'&&BON.relay){ const nx=allies().sort((a,b)=>a.av-b.av)[0];
          if(nx) nx.av=Math.max(1,nx.av-(10000/nx.sp)*0.3); } } }
    return d; }
  function shred(s,t,a){ if(!t||t.broken||t.shL<=0) return false;
    let p=a*(isW(t,s.e)?1:UN);
    while(p>0&&t.shL>0){ if(p>=t.shC){p-=t.shC;t.shL--;t.shC=t.shL>0?SHPER:0} else {t.shC-=p;p=0} }
    if(t.shL<=0){t.broken=true;t.vuln=1;t.av+=(10000/t.sp)*DELAY;
      if(BON.dissect) t.skips=2;
      if(BON.overstrike) dmgTo(s,t,a*0.9);
      allies().filter(u=>u.trig==='break'&&(u._r||0)<u.react).forEach(u=>{
        u._r=(u._r||0)+1; dmgTo(u,t,u.dmg*u.ratio); });
      return true;}
    return false; }
  function afterAllyHit(src,t){
    allies().filter(u=>u.trig==='ally'&&u.id!==src.id&&
      (BON.freeReact||(u._r||0)<u.react)).forEach(u=>{
      const fs=foes(); if(!fs.length) return;
      const tt=(t&&t.alive)?t:fs[Math.floor(rnd()*fs.length)];
      u._r=(u._r||0)+1; dmgTo(u,tt,u.dmg*u.ratio); }); }
  while(g++<40000){
    if(spawned>=roster.length&&!foes().length){over='win';break}
    if(!allies().length){over='wipe';break}
    const al=alive(); al.sort((a,b)=>a.av-b.av);
    const boardStacks=foes().reduce((a,f)=>a+(f.ail||0),0);
    if(BLOOM.live && BLOOM.av<al[0].av && boardStacks>=14){
      const adv=BLOOM.av; al.forEach(u=>u.av-=adv); av+=adv;
      let burst=0;
      foes().forEach(f=>{ if(!f.ail) return;
        const d=Math.round(f.ail*2.6*1.0*(1+.12*f.ail)*(WORLDS[world].ailMul||1)
          *((f.spec&&f.spec.rot)||1));
        f.hp-=d; burst+=d; events++; f.ail=0; if(f.hp<=0)f.alive=false; });
      big=Math.max(big,burst); blooms++;
      BLOOM.av=BLOOM.base; spawn(); continue;
    }
    if(BLOOM.live && BLOOM.av<0) BLOOM.av=0;
    const act=al[0],ad=act.av; al.forEach(u=>u.av-=ad); av+=ad;
    if(BLOOM.live) BLOOM.av-=ad;
    const nr=Math.floor(av/100)+1;
    if(nr>round){round=nr; if(round>20){over='timeout';break}}
    all.forEach(u=>{if(u.side==='ally')u._r=0;});
    if(act.side==='foe'){
      if(act.ail>0){ const t2=Math.round(act.ail*2.6*BON.tickMul*(1+.1*act.ail)*(WORLDS[world].ailMul||1)
          *((act.spec&&act.spec.rot)||1));
        act.hp-=t2; events++; big=Math.max(big,t2); act.ail--;
        if(act.hp<=0){act.alive=false;act.av=10000/act.sp;spawn();continue;} }
      if(act.spec&&act.spec.cleanse){ foes().forEach(f=>{ if(f.ail)
        f.ail=Math.max(0,f.ail-Math.max(1,Math.round(f.ail*act.spec.cleanse))); });
        act.av=10000/act.sp; continue; }
      if(act.broken){ if(act.skips>1){act.skips--;act.av=10000/act.sp;continue;}
        act.broken=false;act.vuln=0;act.shL=act.spec.shl;act.shC=SHPER;
        act.av=10000/act.sp;continue;}
      const pool=allies(); const shots=(act.spec&&act.spec.volley)||1;
      const wts=pool.map(u=>(u.taunt||1)*(1+0.8*(1-u.hp/u.max)));
      const tot=wts.reduce((a,b)=>a+b,0);
      for(let v=0;v<shots&&pool.length;v++){
        let r2=rnd()*tot, pick=pool[pool.length-1];
        for(let i2=0;i2<pool.length;i2++){ r2-=wts[i2]; if(r2<=0){pick=pool[i2];break;} }
        dmgTo(act,pick,act.dmg); }
      act.av=10000/act.sp; continue; }
    // ---- ally turns ----
    if(BLOOM.live && (act.tags||[]).indexOf('Blight')>=0)
      BLOOM.av=Math.max(0,BLOOM.av-(BLOOM.base/Math.max(1,blightCount))*1.05);
    if(act.heal){ const h=allies().filter(u=>u.hp/u.max<.5).sort((a,b)=>a.hp/a.max-b.hp/b.max);
      if(h.length){ const amt=Math.round(act.heal*BON.healMul);
        const room=h[0].max-h[0].hp; h[0].hp+=Math.min(room,amt);
        if(act.over&&amt>room) h[0].bar=Math.min(160,h[0].bar+Math.round((amt-room)*0.8));
        act.av=10000/act.sp;continue;} }
    if(act.barrier){ const h=allies().filter(u=>u.bar<20)
        .sort((a,b)=>(a.needsGuard?-1:0)-(b.needsGuard?-1:0)||a.hp/a.max-b.hp/b.max);
      if(h.length){h[0].bar=Math.min(160,h[0].bar+Math.round(act.barrier*BON.barrier));
        act.av=10000/act.sp;continue;} }
    if(act.advance){ const nx=allies().filter(u=>u.id!==act.id).sort((a,b)=>a.av-b.av)[0];
      if(nx){nx.av=Math.max(1,nx.av-(10000/nx.sp)*act.advance);act.av=10000/act.sp;continue;} }
    if(act.charge){ const nx=allies().filter(u=>u.id!==act.id).sort((a,b)=>b.en-a.en)[0];
      if(nx){nx.en+=act.charge; nx.av=Math.max(1,nx.av-(10000/nx.sp)*.2);
        act.av=10000/act.sp;continue;} }
    const fs=foes(); if(!fs.length){act.av=10000/act.sp;continue;}
    if(act.detonate){ const loaded=fs.filter(f=>f.ail>0);
      if(loaded.length>=2){ let burst=0;
        loaded.forEach(f=>{const d=Math.round(f.ail*2.6*(1+.12*f.ail)*1.9
          *(WORLDS[world].ailMul||1)*((f.spec&&f.spec.rot)||1));
          f.hp-=d; burst+=d; events++; f.ail=0; if(f.hp<=0)f.alive=false;});
        big=Math.max(big,burst); act.av=10000/act.sp; spawn(); continue; } }
    let t=null,bw=-1e9;
    fs.forEach(x=>{const sl=x.broken?0:((x.shL-1)*SHPER+x.shC);
      const eff=act.dmg*((!x.broken&&sl>0)?SOAK:1);
      let sc=-(sl/Math.max(1,act.dmg*(isW(x,act.e)?1:UN))+x.hp/Math.max(1,eff))*.6;
      if(act.apply&&x.ail<8)sc+=.7; if(x.vuln>0)sc+=.7; if(sc>bw){bw=sc;t=x};});
    if(!t)t=fs[0];
    const tgts=act.aoe?fs.slice():[t];
    tgts.forEach(x=>{ shred(act,x,(act.aoe?(act.shred||act.dmg):act.dmg)*BON.shredMul);
      dmgTo(act,x,act.dmg*(act.aoe?.6:1));
      if(act.apply) x.ail=Math.min(12,x.ail+act.stacks+BON.stackUp); });
    afterAllyHit(act,t);
    spawn(); act.av=10000/act.sp;
  }
  return {win:over==='win',round,big,events,blooms};
}
function score(names,world,N,CAP,STEPS){ return scoreTeam(names,world,N,CAP,STEPS).bp; }
// CAP is the top of the difficulty search and STEPS its resolution.  The defaults
// reproduce every number measured before they were parameterised.  Raise CAP when a
// team returns a value at the ceiling: that is a censored result meaning "beat the
// hardest difficulty tried", not a breakpoint.
function scoreTeam(chars,world,N,CAP,STEPS){
  N=N||30;
  let lo=.4,hi=(CAP||6.0),best=lo;
  for(let i=0;i<(STEPS||7);i++){ const mid=(lo+hi)/2; let w=0;
    for(let s=1;s<=N;s++) if(fight(chars,world,mid,(s*2654435761)>>>0).win) w++;
    if(w/N>=.75){best=mid;lo=mid;} else hi=mid; }
  let ev=0,big=0,rd=0;
  for(let s=1;s<=N;s++){ const f=fight(chars,world,best,(s*2654435761)>>>0);
    ev+=f.events; rd+=f.round; big=Math.max(big,f.big); }
  return {bp:+best.toFixed(2), evPerRound:+((ev/N)/(rd/N)).toFixed(1), big,
          rounds:+(rd/N).toFixed(1)};
}
module.exports={fight,score,scoreTeam};
