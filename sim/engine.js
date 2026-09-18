// ---------------------------------------------------------------
// Team test harness.  A build is a parameter vector; the engine
// scores it on power AND on how interesting it is to watch.
// ---------------------------------------------------------------
function mb(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const SHPER=14,UN=.2,SOAK=.55,VULN=.35,DELAY=.35;
const ELS=['order','chaos','growth','void','decay','energy'];
const AILS=['burn','poison','frost','rot'];

// ---- enemy archetypes: each one is a different problem to solve ----
const FOES={
  chaff:    {hp:.55,dmg:.5, shl:1,sp:96, note:'numerous and disposable'},
  bruiser:  {hp:1.7, dmg:1.1,shl:2,sp:74, note:'slow, heavy, high health'},
  skirmisher:{hp:.7,dmg:.9, shl:1,sp:126,backline:1,note:'fast, ignores the front row'},
  warden:   {hp:1.15,dmg:.5, shl:7,sp:82, guard:0,rot:2.1,note:'enormous shields \u2014 decay walks straight past them'},
  cleanser: {hp:1.1, dmg:.8, shl:2,sp:104,cleanse:.45,note:'sheds some of what you put on it'},
  splitter: {hp:1.2, dmg:.7, shl:1,sp:92, split:1,note:'leaves one chaff behind when it falls'},
  harrier:  {hp:.9,  dmg:.32,shl:1,sp:118,volley:3,note:'many small hits, chews through barriers'},
  anchor:   {hp:1.2, dmg:.5, shl:2,sp:88, empower:.14,note:'strengthens every other enemy'},
  reflector:{hp:0.95,dmg:.7, shl:2,sp:90, thorns:.34,note:'answers each hit with a little of its own'}
};
// the encounter is a parameter set too, not a fixed wall
const ENC={
  pool:18, field:9, elitePct:0.2, roundCap:18,
  hpBase:60, dmgBase:12, crewHp:110
};
const DEFAULTS={
  units:6, dmg:14, speedSpread:14,
  aoeUnits:0, aoeRatio:0.6,          // how many hit everything, and for how much
  dotUnits:0, dotTypes:1, dotApply:2, dotTick:4, dotGrow:0.10, dotHits:1, dotCap:10,
  detonator:0, detBoost:0.9,
  siphon:0, ward:0,                  // life and cover per ailment that fires
  reactors:0, reactBudget:2, reactRatio:0.7, retarget:'random', chainCap:12,
  marks:0, shred:0, harmony:0, upgrades:0,
  healer:1, healAmt:26
};

function buildCrew(P){
  const crew=[]; const n=P.units;
  for(let i=0;i<n;i++){
    const c={id:'a'+i,side:'ally',e:ELS[i%6],
      sp:88+((i*7)%P.speedSpread)+ (i%2?6:0),
      dmg:Math.round(P.dmg*(1+0.42*(P.upgrades/Math.max(1,n)))),
      hp:110,max:110,alive:true};
    if(i<P.aoeUnits){ c.aoe=1; c.shred=P.shred||Math.round(P.dmg*0.7); }
    if(P.dotUnits>0 && i<Math.min(n-1,P.dotUnits)) c.apply=AILS[i%P.dotTypes];
    if(P.detonator && i===n-2) { c.detonate=1; c.apply=null; }
    if(P.reactors && i>=n-1-P.reactors && i<n-1) { c.trig='ally'; }
    if(P.marks && i===0) c.marks=3;
    if(P.healer && i===n-1) { c.heal=P.healAmt; c.dmg=Math.round(P.dmg*0.6); }
    crew.push(c);
  }
  return crew;
}

function fight(P,E,seed){
  const rnd=mb(seed);
  const pool=E.pool, field=E.field;
  const U=buildCrew(P).map(c=>({...c,av:10000/c.sp,hp:E.crewHp,max:E.crewHp}));
  const roster=[];
  // mix is a list of [archetype, count]
  (E.mix||[['chaff',Math.round(pool*0.8)],['bruiser',Math.round(pool*0.2)]])
    .forEach(([k,n])=>{ const a=FOES[k];
      for(let i=0;i<n;i++) roster.push({kind:k,elite:a.hp>=1.2,
        hp:Math.round(E.hpBase*a.hp), dmg:Math.round(E.dmgBase*a.dmg),
        shL:a.shl, sp:a.sp, spec:a}); });
  for(let i=roster.length;i--;){const j=Math.floor(rnd()*(i+1));
    const t=roster[i];roster[i]=roster[j];roster[j]=t;}
  let spawned=0;
  function spawn(){ while(U.filter(u=>u.side==='foe'&&u.alive).length<field&&spawned<roster.length){
    const p=roster[spawned];
    U.push({id:'f'+spawned,side:'foe',elite:p.elite,kind:p.kind,spec:p.spec,
      weak:[ELS[spawned%6],ELS[(spawned*3+1)%6]],e:ELS[spawned%6],
      sp:p.sp,dmg:p.dmg,hp:p.hp,max:p.hp,av:(10000/p.sp)*(.4+rnd()*.7),
      alive:true,shL:p.shL,shC:SHPER,broken:false,vuln:0,ail:{}}); spawned++; } }
  spawn();
  const alive=()=>U.filter(u=>u.alive);
  const foes=()=>U.filter(u=>u.side==='foe'&&u.alive);
  const isW=(t,e)=>t.weak.indexOf(e)>=0;
  const types=t=>t.ail?AILS.filter(k=>t.ail[k]>0).length:0;
  const stacks=t=>t.ail?AILS.reduce((a,k)=>a+(t.ail[k]||0),0):0;

  let av=0,round=1,g=0,over=null;
  // instrumentation
  let events=0,biggest=0,dotDmg=0,healed=0,ticks=0,follows=0,breaks=0,dets=0;
  let cleansed=0,thornDmg=0,splits=0,splitsLeft=40,splitId=0;
  const byUnit={}, perRound=[];
  U.filter(u=>u.side==='ally').forEach(u=>byUnit[u.id]=0);
  let roundDmg=0;

  function note(src,d){ events++; biggest=Math.max(biggest,d);
    if(src&&byUnit[src]!==undefined) byUnit[src]+=d; roundDmg+=d; }
  function ailBonus(t){ return ((t.ail&&t.ail.burn)||0)*0.07; }
  function hurt(s,t,a){
    if(!t||!t.alive) return 0;
    let soak=(t.side==='foe'&&!t.broken&&t.shL>0)?SOAK:1;
    if(t.side==='foe'){
      const w=foes().find(f=>f.spec&&f.spec.guard&&f!==t);
      if(w) soak*= (1-w.spec.guard);
    }
    let d=Math.round(a*(1+(t.vuln>0?VULN:0)+ailBonus(t))*soak);
    if(t.side==='ally'&&P.ward&&s.side==='foe')
      d=Math.round(d*(1-Math.min(.6,P.ward*types(s))));
    t.hp-=d; note(s.side==='ally'?s.id:null,d);
    if(t.side==='foe'&&t.spec&&t.spec.thorns&&s.side==='ally'&&s.alive){
      const back=Math.round(d*t.spec.thorns);
      s.hp-=back; thornDmg+=back; if(s.hp<=0)s.alive=false; }
    if(t.hp<=0&&t.alive){ t.alive=false;
      if(t.spec&&t.spec.split&&splitsLeft>0){
        splitsLeft--;
        for(let q=0;q<t.spec.split;q++){
          U.push({id:'s'+(splitId++),side:'foe',kind:'chaff',spec:FOES.chaff,
            weak:t.weak.slice(),e:t.weak[0],sp:96,dmg:Math.round(t.dmg*0.5),
            hp:Math.round(E.hpBase*0.4),max:Math.round(E.hpBase*0.4),
            av:(10000/96)*0.5,alive:true,shL:1,shC:SHPER,broken:false,vuln:0,ail:{}});
        } splits+=t.spec.split; } }
    return d; }
  function shredT(s,t,a){ if(!t||t.broken||t.shL<=0) return false;
    let p=a*(isW(t,s.e)?1:UN);
    while(p>0&&t.shL>0){ if(p>=t.shC){p-=t.shC;t.shL--;t.shC=t.shL>0?SHPER:0} else {t.shC-=p;p=0} }
    if(t.shL<=0){t.broken=true;t.vuln=1;t.av+=(10000/t.sp)*DELAY;breaks++;return true;}
    return false; }
  function fireAils(t,boost,clear){
    let total=0,fired=0;
    AILS.forEach(k=>{
      const n=(t.ail&&t.ail[k])||0; if(!n) return;
      const vuln=(t.spec&&t.spec.rot)||1;
      const per=(P.dotTick*n)*(1+P.dotGrow*n)*(1+boost)*vuln;
      // the same total damage can arrive as one hit or several
      const hits=Math.max(1,P.dotHits);
      for(let h=0;h<hits;h++){
        const d=Math.round(per/hits);
        t.hp-=d; total+=d; dotDmg+=d; ticks++; note(null,d);
      }
      fired++;
      t.ail[k]=clear?0:Math.max(0,n-1);
    });
    if(fired&&P.siphon){
      const pool2=P.siphon*fired;
      let left=pool2;
      U.filter(u=>u.side==='ally'&&u.alive).sort((a,b)=>a.hp/a.max-b.hp/b.max)
        .forEach(u=>{const g2=Math.min(u.max-u.hp,left);u.hp+=g2;left-=g2;healed+=g2;});
    }
    if(total) biggest=Math.max(biggest,total);
    if(t.hp<=0&&t.alive)t.alive=false;
    return total; }
  function cascade(src,cur,depth){
    if(!P.reactors||depth>P.chainCap) return;
    U.filter(r=>r.side==='ally'&&r.alive&&r.trig&&r.id!==src.id).forEach(r=>{
      if(depth>P.chainCap) return;
      r._b=r._b||0; if(r._b>=P.reactBudget) return;
      const fs=foes(); if(!fs.length) return;
      const t=P.retarget==='random'?fs[Math.floor(rnd()*fs.length)]:(cur&&cur.alive?cur:fs[0]);
      r._b++; follows++;
      hurt(r,t,r.dmg*P.reactRatio);
      cascade(r,t,depth+1);
    }); }

  while(g++<40000){
    const al=alive();
    if(spawned>=roster.length&&!foes().length){over='win';break}
    if(!al.some(u=>u.side==='ally')){over='wipe';break}
    al.sort((a,b)=>a.av-b.av);
    const act=al[0],ad=act.av; al.forEach(u=>u.av-=ad); av+=ad;
    const nr=Math.floor(av/100)+1;
    if(nr>round){ perRound.push(roundDmg); roundDmg=0; round=nr;
      if(round>E.roundCap){over='timeout';break} }
    U.forEach(u=>{ if(u.side==='ally') u._b=0; });
    if(act.side==='foe'){
      fireAils(act,0,false);
      if(!act.alive){act.av=10000/act.sp;spawn();continue;}
      if(act.broken){act.broken=false;act.vuln=0;act.shL=act.elite?E.eliteShl:E.chaffShl;act.shC=SHPER;
        act.av=10000/act.sp;continue;}
      const sp=act.spec||{};
      // an anchor makes everything else hit harder
      if(sp.empower){ foes().forEach(f=>{ if(f!==act) f.dmg=Math.round(f.dmg*(1+sp.empower)); });
        act.av=10000/act.sp; continue; }
      // a cleanser wipes the ailments off the whole board
      if(sp.cleanse){ let wiped=0;
        foes().forEach(f=>{ AILS.forEach(k=>{ const n=(f.ail&&f.ail[k])||0;
          if(n){ const off=Math.max(1,Math.round(n*sp.cleanse)); f.ail[k]=n-off; wiped+=off; } }); });
        if(wiped){ cleansed+=wiped; act.av=10000/act.sp; continue; } }
      const pool3=alive().filter(u=>u.side==='ally');
      const shots=sp.volley||1;
      for(let v=0;v<shots&&pool3.length;v++)
        hurt(act,pool3[Math.floor(rnd()*pool3.length)],act.dmg);
      act.av=10000/act.sp; continue; }
    if(act.heal){ const h=alive().filter(u=>u.side==='ally'&&u.hp/u.max<.45)
      .sort((a,b)=>a.hp/a.max-b.hp/b.max);
      if(h.length){h[0].hp=Math.min(h[0].max,h[0].hp+act.heal);healed+=act.heal;
        act.av=10000/act.sp;continue;} }
    const fs=foes(); if(!fs.length){act.av=10000/act.sp;continue;}
    if(act.detonate){
      const loaded=fs.filter(t=>stacks(t)>0);
      if(loaded.length>=2||loaded.some(t=>stacks(t)>=5)){
        let burst=0; loaded.forEach(t=>burst+=fireAils(t,P.detBoost,true));
        biggest=Math.max(biggest,burst); dets++;
        act.av=10000/act.sp; spawn(); continue; } }
    let t=null,bw=-1e9;
    fs.forEach(x=>{ const sl=x.broken?0:((x.shL-1)*SHPER+x.shC);
      const eff=act.dmg*(1+ailBonus(x))*((!x.broken&&sl>0)?SOAK:1);
      let sc=-(sl/Math.max(1,act.dmg*(isW(x,act.e)?1:UN))+x.hp/Math.max(1,eff))*.6;
      if(act.apply&&stacks(x)<P.dotCap) sc+=.8;
      if(x.vuln>0)sc+=.7; if(sc>bw){bw=sc;t=x} });
    if(!t) t=fs[0];
    const targets=act.aoe?fs.slice():[t];
    targets.forEach(x=>{
      shredT(act,x,act.aoe?(act.shred||act.dmg):act.dmg);
      hurt(act,x,act.dmg*(act.aoe?P.aoeRatio:1));
      if(act.apply) x.ail[act.apply]=Math.min(P.dotCap,(x.ail[act.apply]||0)+P.dotApply);
    });
    if(t) cascade(act,t,0);
    spawn(); act.av=10000/act.sp;
  }
  perRound.push(roundDmg);
  const total=Object.values(byUnit).reduce((a,b)=>a+b,0)||1;
  const shares=Object.values(byUnit).map(v=>v/total);
  const mean=1/Math.max(1,shares.length);
  const spread=Math.sqrt(shares.reduce((a,x)=>a+(x-mean)**2,0)/shares.length)/mean;
  const third=Math.max(1,Math.floor(perRound.length/3));
  const early=perRound.slice(0,third).reduce((a,b)=>a+b,0)/third;
  const late=perRound.slice(-third).reduce((a,b)=>a+b,0)/third;
  return {over,round,events,biggest,dotDmg,healed,ticks,follows,breaks,dets,
          cleansed,thornDmg,splits,
          evenness:Math.max(0,1-spread), escalation:early?late/early:1};
}

function evaluate(P,encounters,N){
  P=Object.assign({},DEFAULTS,P);
  N=N||160;
  encounters=encounters.map(e=>Object.assign({},ENC,e));
  const agg={win:0,wipe:0,timeout:0,round:0,events:0,biggest:0,dot:0,heal:0,
             follows:0,breaks:0,even:0,esc:0,n:0,cleansed:0,thorn:0,splits:0};
  const wins=[];
  encounters.forEach(E=>{
    for(let s=1;s<=N;s++){
      const f=fight(P,E,(s*2654435761)>>>0);
      agg.n++;
      if(f.over==='win')agg.win++; else if(f.over==='wipe')agg.wipe++; else agg.timeout++;
      agg.round+=f.round; agg.events+=f.events; agg.biggest=Math.max(agg.biggest,f.biggest);
      agg.dot+=f.dotDmg; agg.heal+=f.healed; agg.follows+=f.follows;
      agg.breaks+=f.breaks; agg.even+=f.evenness; agg.esc+=f.escalation;
      agg.cleansed+=f.cleansed; agg.thorn+=f.thornDmg; agg.splits+=f.splits;
      wins.push(f.over==='win'?1:0);
    }});
  const n=agg.n;
  const winRate=agg.win/n;
  // closeness: how often the result is genuinely in doubt
  const drama=1-Math.abs(winRate-0.75)/0.75;
  return {
    winPct:+(winRate*100).toFixed(1),
    wipePct:+(agg.wipe/n*100).toFixed(1),
    timeoutPct:+(agg.timeout/n*100).toFixed(1),
    rounds:+(agg.round/n).toFixed(2),
    events:+(agg.events/n).toFixed(1),
    eventsPerRound:+((agg.events/n)/(agg.round/n)).toFixed(1),
    biggest:agg.biggest,
    dotDmg:+(agg.dot/n).toFixed(0),
    healed:+(agg.heal/n).toFixed(0),
    follows:+(agg.follows/n).toFixed(1),
    breaks:+(agg.breaks/n).toFixed(1),
    evenness:+(agg.even/n).toFixed(2),
    escalation:+(agg.esc/n).toFixed(2),
    drama:+Math.max(0,drama).toFixed(2),
    cleansed:+(agg.cleansed/n).toFixed(1),
    thorn:+(agg.thorn/n).toFixed(0),
    splits:+(agg.splits/n).toFixed(1)
  };
}
module.exports={DEFAULTS,ENC,FOES,evaluate,fight};
