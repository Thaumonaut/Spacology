const {FOEKIND:FOES}=require('./roster.js');
const {CHARS,WORLDS,TAGS}=require('./roster.js');
function mb(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// Combat tuning.  Mutable so a sweep can vary one constant at a time; the values
// here are the originals and reproduce every number measured before this change.
//   ARMOR_PER_LAYER  armour points per layer
//   ARMOR_MITIGATION   damage taken through shields   VULN_BONUS   extra damage once broken
//   BREAK_DELAY  share of a turn a break costs
// Named TUNE, not T - fight() already binds T locally as its tag counter.
const TUNE={ARMOR_PER_LAYER:14,ARMOR_MITIGATION:.55,VULN_BONUS:.35,BREAK_DELAY:.35,
  // Shred rate by where attacker and target sit on the element ring. Hitting an
  // enemy with its opposite is the weakness and strips armour at full rate.
  SHRED_SAME:.2, SHRED_ADJACENT:.3, SHRED_DISTANT:.5, SHRED_OPPOSITE:1,
  // Harmony: on a break, allies sharing the breaker's element strike too.
  // HARMONY_CAP is how many may answer; 0 turns it off.
  HARMONY_CAP:2, HARMONY_DMG:.6,
  // What Harmony answers. 'break' is the original design and fires rarely,
  // because it needs someone on the team carrying armorShred. 'hit' lets any
  // attack trigger it, which is the lever that decides whether stacking an
  // element is a strategy or a rounding error.
  HARMONY_ON:'break'};
const TUNE0=Object.assign({},TUNE);
function setTuning(o){ Object.assign(TUNE,o||{}); return Object.assign({},TUNE); }
function resetTuning(){ Object.assign(TUNE,TUNE0); return Object.assign({},TUNE); }
function getTuning(){ return Object.assign({},TUNE); }
const E=require('./elements.js');

function fight(chars,world,diff,seed){
  const rnd=mb(seed), W=WORLDS[world];
  const U=chars.map((c0,i)=>{const c=(typeof c0==='string')?CHARS[c0]:c0;
    return {id:'a'+i,name:(typeof c0==='string')?c0:(c.tmpl+i),side:'ally',...c,
      speed:Math.round(c.speed*W.speedMul), element:c.element,
      hp:Math.round(110*(c.hpMul||1)),max:Math.round(110*(c.hpMul||1)),
      av:10000/Math.round(c.speed*W.speedMul),alive:true,bar:0,en:0};});
  // count the tags the crew brought and turn thresholds into real effects
  const tc={};
  U.forEach(u=>(u.tags||[]).forEach(g=>tc[g]=(tc[g]||0)+1));
  const T=g=>tc[g]||0;
  const BON={
    shield:  (T('Tank')>=2?1.45:1),
    ammo:     T('Tank')>=4,                 // barriers return what they swallow
    stackUp:  (T('DoT')>=2?1:0),
    bloom:    T('DoT')>=4,               // an entity that joins the turn order
    speed:    (T('Speed')>=2?1.12:1),
    relay:    T('Speed')>=4,                // a kill advances the next crewmate
    dmgMul:   (T('DPS')>=2?1.2:1),
    overstrike:T('DPS')>=4,            // a breaking hit lands twice
    shredMul: (T('Breaker')>=2?1.6:1),
    dissect:  T('Breaker')>=4,                // break costs two turns
    healMul:  (T('Healer')>=2?1.5:1),
    // foeSlow scales the action value foes spawn with; 1 means unmodified.
    // It was referenced at spawn and never defined, which made every foe's av
    // NaN, so no foe ever sorted to the front of the order and none ever acted.
    foeSlow:  1,
    // tickMul scales ailment damage on a foe's own turn. Also referenced and
    // never defined, which made the tick NaN and the foe's health NaN with it -
    // and NaN fails every <= 0 test, so the foe became unkillable. Dormant only
    // because foes never took a turn. The Bloom's identical formula hardcodes
    // 1.0, so 1 is the intended value.
    tickMul:  1,
    revive:   T('Healer')>=4
  };
  const blightCount=T('DoT');
  U.forEach(u=>{ u.av=u.av/BON.speed; u.dmg=Math.round(u.dmg*BON.dmgMul); });
  let revived=!BON.revive;
  // the Bloom: not a unit, but it takes a slot in the order
  const BLOOM={av:560,base:560,live:BON.bloom};
  const roster=[];
  W.mix.forEach(([k,n])=>{const a=FOES[k];
    for(let i=0;i<n;i++) roster.push({kind:k,spec:a,
      hp:Math.round(60*diff*a.hp),dmg:Math.round(12*diff*a.dmg),shL:a.armorLayers,speed:a.speed});});
  for(let i=roster.length;i--;){const j=Math.floor(rnd()*(i+1));
    const t=roster[i];roster[i]=roster[j];roster[j]=t;}
  const FIELD=Math.min(9,Math.max(4,Math.round(roster.length*0.5)));
  const all=U.slice(); let spawned=0;
  function spawn(){ while(all.filter(u=>u.side==='foe'&&u.alive).length<FIELD&&spawned<roster.length){
    const p=roster[spawned];
    all.push({id:'f'+spawned,side:'foe',kind:p.kind,spec:p.spec,
      element:p.spec.element,
      speed:p.speed,dmg:p.dmg,hp:p.hp,max:p.hp,av:(10000/p.speed)*(.4+rnd()*.7)*BON.foeSlow,
      alive:true,shL:p.shL,shC:TUNE.ARMOR_PER_LAYER,broken:false,vuln:0,dotStacks:0}); spawned++; } }
  spawn();
  const alive=()=>all.filter(u=>u.alive);
  const foes=()=>all.filter(u=>u.side==='foe'&&u.alive);
  const allies=()=>all.filter(u=>u.side==='ally'&&u.alive);
  // how fast one element strips another's armour
  const shredRate=(attacker,target)=>{
    switch(E.relation(attacker,target)){
      case 'opposite': return TUNE.SHRED_OPPOSITE;
      case 'distant':  return TUNE.SHRED_DISTANT;
      case 'adjacent': return TUNE.SHRED_ADJACENT;
      default:         return TUNE.SHRED_SAME;
    } };
  let av=0,round=1,g=0,outcome=null,big=0,events=0,blooms=0,harmonies=0;
  function dmgTo(s,t,a){
    if(!t||!t.alive) return 0;
    let m=1+(t.vuln>0?TUNE.VULN_BONUS:0)+(t.dotStacks||0)*.07;
    if(t.side==='foe'&&!t.broken&&t.shL>0) m*=TUNE.ARMOR_MITIGATION;
    let d=Math.round(a*m);
    const raw=d;                       // what it would have been before any shield
    if(t.side==='ally'&&t.bar>0){const s2=Math.min(t.bar,d);t.bar-=s2;d-=s2;}
    t.hp-=d; events++; big=Math.max(big,d);
    if(t.side==='foe'&&t.spec&&t.spec.thorns&&s.side==='ally')
      { s.hp-=Math.round(d*t.spec.thorns); if(s.hp<=0)s.alive=false; }
    // a reflect answers the whole blow, including the part a shield swallowed
    if(t.side==='ally'&&s.side==='foe'&&t.alive){
      const rate=(t.thorns||0)*(BON.ammo?1.6:1)+(BON.ammo&&t.bar>0?1.4:0);
      if(rate>0) dmgTo(t,s,Math.round((BON.ammo?raw:d)*rate)); }
    if(t.hp<=0&&t.alive){
      if(t.side==='ally'&&!revived){ revived=true; t.hp=Math.round(t.max*0.5); }
      else { t.alive=false;
        if(t.side==='foe'&&BON.relay){ const nx=allies().sort((a,b)=>a.av-b.av)[0];
          if(nx) nx.av=Math.max(1,nx.av-(10000/nx.speed)*0.3); } } }
    return d; }
  function breakArmor(s,t,a){ if(!t||t.broken||t.shL<=0) return false;
    let p=a*shredRate(s.element,t.element);
    while(p>0&&t.shL>0){ if(p>=t.shC){p-=t.shC;t.shL--;t.shC=t.shL>0?TUNE.ARMOR_PER_LAYER:0} else {t.shC-=p;p=0} }
    if(t.shL<=0){t.broken=true;t.vuln=1;t.av+=(10000/t.speed)*TUNE.BREAK_DELAY;
      if(BON.dissect) t.skips=2;
      if(BON.overstrike) dmgTo(s,t,a*0.9);
      allies().filter(u=>u.procOn==='break'&&(u._r||0)<u.procMax).forEach(u=>{
        u._r=(u._r||0)+1; dmgTo(u,t,u.dmg*u.procDmg); });
      if(TUNE.HARMONY_ON==='break') harmony(s,t);
      return true;}
    return false; }
  function harmony(src,t){
    if(TUNE.HARMONY_CAP<=0||!t||!t.alive) return;
    allies().filter(u=>u.element===src.element&&u.id!==src.id&&!u._h)
      .sort((a,b)=>a.av-b.av).slice(0,TUNE.HARMONY_CAP)
      .forEach(u=>{ u._h=1; harmonies++; dmgTo(u,t,u.dmg*TUNE.HARMONY_DMG); });
  }
  function afterAllyHit(src,t){
    if(TUNE.HARMONY_ON==='hit') harmony(src,t);
    allies().filter(u=>u.procOn==='ally'&&u.id!==src.id&&
      (BON.freeReact||(u._r||0)<u.procMax)).forEach(u=>{
      const fs=foes(); if(!fs.length) return;
      const tt=(t&&t.alive)?t:fs[Math.floor(rnd()*fs.length)];
      u._r=(u._r||0)+1; dmgTo(u,tt,u.dmg*u.procDmg); }); }
  while(g++<40000){
    if(spawned>=roster.length&&!foes().length){outcome='win';break}
    if(!allies().length){outcome='wipe';break}
    const al=alive(); al.sort((a,b)=>a.av-b.av);
    const boardStacks=foes().reduce((a,f)=>a+(f.dotStacks||0),0);
    if(BLOOM.live && BLOOM.av<al[0].av && boardStacks>=14){
      const adv=BLOOM.av; al.forEach(u=>u.av-=adv); av+=adv;
      let burst=0;
      foes().forEach(f=>{ if(!f.dotStacks) return;
        const d=Math.round(f.dotStacks*2.6*1.0*(1+.12*f.dotStacks)*(WORLDS[world].ailMul||1)
          *((f.spec&&f.spec.dotTaken)||1));
        f.hp-=d; burst+=d; events++; f.dotStacks=0; if(f.hp<=0)f.alive=false; });
      big=Math.max(big,burst); blooms++;
      BLOOM.av=BLOOM.base; spawn(); continue;
    }
    if(BLOOM.live && BLOOM.av<0) BLOOM.av=0;
    const act=al[0],ad=act.av; al.forEach(u=>u.av-=ad); av+=ad;
    if(BLOOM.live) BLOOM.av-=ad;
    const nr=Math.floor(av/100)+1;
    if(nr>round){round=nr; if(round>20){outcome='timeout';break}}
    all.forEach(u=>{if(u.side==='ally'){u._r=0;u._h=0;}});
    if(act.side==='foe'){
      if(act.dotStacks>0){ const t2=Math.round(act.dotStacks*2.6*BON.tickMul*(1+.1*act.dotStacks)*(WORLDS[world].ailMul||1)
          *((act.spec&&act.spec.dotTaken)||1));
        act.hp-=t2; events++; big=Math.max(big,t2); act.dotStacks--;
        if(act.hp<=0){act.alive=false;act.av=10000/act.speed;spawn();continue;} }
      if(act.spec&&act.spec.cleanse){ foes().forEach(f=>{ if(f.dotStacks)
        f.dotStacks=Math.max(0,f.dotStacks-Math.max(1,Math.round(f.dotStacks*act.spec.cleanse))); });
        act.av=10000/act.speed; continue; }
      if(act.broken){ if(act.skips>1){act.skips--;act.av=10000/act.speed;continue;}
        act.broken=false;act.vuln=0;act.shL=act.spec.armorLayers;act.shC=TUNE.ARMOR_PER_LAYER;
        act.av=10000/act.speed;continue;}
      const pool=allies(); const shots=(act.spec&&act.spec.multiHit)||1;
      const wts=pool.map(u=>(u.taunt||1)*(1+0.8*(1-u.hp/u.max)));
      const tot=wts.reduce((a,b)=>a+b,0);
      for(let v=0;v<shots&&pool.length;v++){
        let r2=rnd()*tot, pick=pool[pool.length-1];
        for(let i2=0;i2<pool.length;i2++){ r2-=wts[i2]; if(r2<=0){pick=pool[i2];break;} }
        dmgTo(act,pick,act.dmg); }
      act.av=10000/act.speed; continue; }
    // ---- ally turns ----
    if(BLOOM.live && (act.tags||[]).indexOf('DoT')>=0)
      BLOOM.av=Math.max(0,BLOOM.av-(BLOOM.base/Math.max(1,blightCount))*1.05);
    if(act.heal){ const h=allies().filter(u=>u.hp/u.max<.5).sort((a,b)=>a.hp/a.max-b.hp/b.max);
      if(h.length){ const amt=Math.round(act.heal*BON.healMul);
        const room=h[0].max-h[0].hp; h[0].hp+=Math.min(room,amt);
        if(act.overheal&&amt>room) h[0].bar=Math.min(160,h[0].bar+Math.round((amt-room)*0.8));
        act.av=10000/act.speed;continue;} }
    if(act.shield){ const h=allies().filter(u=>u.bar<20)
        .sort((a,b)=>(a.needsShield?-1:0)-(b.needsShield?-1:0)||a.hp/a.max-b.hp/b.max);
      if(h.length){h[0].bar=Math.min(160,h[0].bar+Math.round(act.shield*BON.shield));
        act.av=10000/act.speed;continue;} }
    if(act.turnBoost){ const nx=allies().filter(u=>u.id!==act.id).sort((a,b)=>a.av-b.av)[0];
      if(nx){nx.av=Math.max(1,nx.av-(10000/nx.speed)*act.turnBoost);act.av=10000/act.speed;continue;} }
    if(act.energyGain){ const nx=allies().filter(u=>u.id!==act.id).sort((a,b)=>b.en-a.en)[0];
      if(nx){nx.en+=act.energyGain; nx.av=Math.max(1,nx.av-(10000/nx.speed)*.2);
        act.av=10000/act.speed;continue;} }
    const fs=foes(); if(!fs.length){act.av=10000/act.speed;continue;}
    if(act.detonate){ const loaded=fs.filter(f=>f.dotStacks>0);
      if(loaded.length>=2){ let burst=0;
        loaded.forEach(f=>{const d=Math.round(f.dotStacks*2.6*(1+.12*f.dotStacks)*1.9
          *(WORLDS[world].ailMul||1)*((f.spec&&f.spec.dotTaken)||1));
          f.hp-=d; burst+=d; events++; f.dotStacks=0; if(f.hp<=0)f.alive=false;});
        big=Math.max(big,burst); act.av=10000/act.speed; spawn(); continue; } }
    let t=null,bw=-1e9;
    fs.forEach(x=>{const sl=x.broken?0:((x.shL-1)*TUNE.ARMOR_PER_LAYER+x.shC);
      const eff=act.dmg*((!x.broken&&sl>0)?TUNE.ARMOR_MITIGATION:1);
      let sc=-(sl/Math.max(1,act.dmg*shredRate(act.element,x.element))+x.hp/Math.max(1,eff))*.6;
      if(act.appliesDot&&x.dotStacks<8)sc+=.7; if(x.vuln>0)sc+=.7; if(sc>bw){bw=sc;t=x};});
    if(!t)t=fs[0];
    const tgts=act.aoe?fs.slice():[t];
    tgts.forEach(x=>{ breakArmor(act,x,(act.aoe?(act.armorShred||act.dmg):act.dmg)*BON.shredMul);
      dmgTo(act,x,act.dmg*(act.aoe?.6:1));
      if(act.appliesDot) x.dotStacks=Math.min(12,x.dotStacks+act.dotPerHit+BON.stackUp); });
    afterAllyHit(act,t);
    spawn(); act.av=10000/act.speed;
  }
  return {win:outcome==='win',round,big,events,blooms,harmonies};
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
  let ev=0,big=0,rd=0,har=0;
  for(let s=1;s<=N;s++){ const f=fight(chars,world,best,(s*2654435761)>>>0);
    ev+=f.events; rd+=f.round; big=Math.max(big,f.big); har+=f.harmonies||0; }
  return {bp:+best.toFixed(2), evPerRound:+((ev/N)/(rd/N)).toFixed(1), big,
          rounds:+(rd/N).toFixed(1), harmonies:+(har/N).toFixed(1)};
}
module.exports={fight,score,scoreTeam,setTuning,resetTuning,getTuning};
