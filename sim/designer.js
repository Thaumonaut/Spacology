// ---------------------------------------------------------------------------
// STAGE 1 - the designer.  Builds characters inside an archetype template,
// spending a fixed power budget so nothing can simply be better than everything.
// ---------------------------------------------------------------------------
const BUDGET=100;
// what each capability costs, per point of it
const COST={dmg:2.6, hpMul:34, shield:1.25, heal:1.15, thorns:9, taunt:3.4,
            dotPerHit:11, armorShred:1.5, procMax:8, procDmg:11, turnBoost:34, energyGain:0.5,
            marks:6, aoe:26, appliesDot:0, detonate:22, dotSpread:12, overheal:6,
            shieldOnHit:14, lifesteal:20, speed:0.42};

// Each template says: which tags, which capabilities are allowed, and roughly
// how the budget should be split.  The search fills in the numbers.
const TEMPLATES={
  protectAlly:   {tags:['Tank'],            must:['shield'],  may:['dmg','hpMul','taunt','shieldOnHit','heal'],
            note:'keeps someone else standing'},
  payback: {tags:['Tank','DPS'], must:['thorns','taunt'], may:['dmg','hpMul','lifesteal'],
            note:'wants to be hit'},
  seeder:  {tags:['DoT'],          must:['appliesDot','dotPerHit'], may:['dmg','aoe','armorShred','dotSpread'],
            note:'puts ailments on things'},
  igniter: {tags:['DoT'],          must:['detonate'], may:['dmg','aoe','armorShred'],
            note:'spends what the seeders built'},
  reader:  {tags:['Breaker'],           must:['marks'],    may:['dmg','aoe','armorShred','speed'],
            note:'opens targets up'},
  answer:  {tags:['Breaker','DPS'],must:['procMax','procDmg'], may:['dmg','speed'],
            note:'fires when something happens'},
  engine:  {tags:['Speed'],           must:['turnBoost'],  may:['dmg','speed','energyGain'],
            note:'moves the turn order'},
  hammer:  {tags:['DPS'],        must:['dmg'],      may:['hpMul','speed','aoe','armorShred'],
            note:'one big number'},
  mender:  {tags:['Healer'],            must:['heal'],     may:['dmg','overheal','speed','shield'],
            note:'keeps the crew upright'},
  conduit: {tags:['Healer','Speed'],    must:['energyGain'],   may:['dmg','speed','heal','turnBoost'],
            note:'hands its power to someone else'}
};
const TRIGS={answer:['ally','break','mark','hurt']};

function make(rnd,templateKey,gen){
  const T=TEMPLATES[templateKey];
  const c={tmpl:templateKey, tags:T.tags.slice(), speed:0, dmg:0, gen:gen};
  let left=BUDGET;
  // baseline speed everyone pays for
  const spBase=76+Math.floor(rnd()*46);
  c.speed=spBase; left-=(spBase-76)*COST.speed;
  function buy(k,lo,hi,round){
    const span=hi-lo, v=lo+rnd()*span;
    const val=round?Math.max(1,Math.round(v)):+v.toFixed(2);
    const cost=val*COST[k];
    if(cost>left) return false;
    c[k]=val; left-=cost; return true;
  }
  // mandatory capabilities first
  T.must.forEach(k=>{
    if(k==='appliesDot'){c.appliesDot=1;return;}
    if(k==='procDmg'){buy('procDmg',0.4,2.4,false);return;}
    if(k==='procMax'){buy('procMax',1,4,true);return;}
    if(k==='thorns'){buy('thorns',0.6,4.6,false);return;}
    if(k==='turnBoost'){buy('turnBoost',0.25,0.6,false);return;}
    if(k==='detonate'){c.detonate=1;left-=COST.detonate;return;}
    if(k==='marks'){buy('marks',1,3,true);return;}
    if(k==='dotPerHit'){buy('dotPerHit',1,3,true);return;}
    if(k==='heal'){buy('heal',14,34,true);return;}
    if(k==='shield'){buy('shield',14,36,true);return;}
    if(k==='energyGain'){buy('energyGain',18,44,true);return;}
    if(k==='taunt'){buy('taunt',2,6,true);return;}
    if(k==='dmg')  {buy('dmg',12,26,true);return;}
  });
  if(templateKey==='answer') c.procOn=TRIGS.answer[Math.floor(rnd()*4)];
  // spend what is left on optional capabilities, cheapest interesting first
  const may=T.may.slice().sort(()=>rnd()-0.5);
  may.forEach(k=>{
    if(left<8) return;
    if(k==='dmg')   buy('dmg',4,Math.min(24,Math.floor(left/COST.dmg)),true);
    if(k==='hpMul'){const v=1+rnd()*0.6; if(v*COST.hpMul-COST.hpMul<left){
      c.hpMul=+v.toFixed(2); left-=(v-1)*COST.hpMul;} }
    if(k==='aoe'&&left>COST.aoe){c.aoe=1;left-=COST.aoe;}
    if(k==='armorShred') buy('armorShred',8,Math.min(22,Math.floor(left/COST.armorShred)),true);
    if(k==='dotSpread'&&left>COST.dotSpread){c.dotSpread=1;left-=COST.dotSpread;}
    if(k==='overheal'&&left>COST.overheal){c.overheal=1;left-=COST.overheal;}
    if(k==='shieldOnHit'&&left>COST.shieldOnHit){c.shieldOnHit=1;left-=COST.shieldOnHit;}
    if(k==='lifesteal'&&left>COST.lifesteal){c.lifesteal=+(0.2+rnd()*0.3).toFixed(2);left-=COST.lifesteal;}
    if(k==='taunt') buy('taunt',2,5,true);
    if(k==='heal')  buy('heal',10,24,true);
    if(k==='shield')buy('shield',10,24,true);
    if(k==='energyGain') buy('energyGain',12,30,true);
    if(k==='speed'){const b=Math.min(30,Math.floor(left/COST.speed)); if(b>4){c.speed+=b;left-=b*COST.speed;}}
  });
  if(!c.dmg) c.dmg=Math.max(4,Math.round(left/COST.dmg));
  c.spent=+(BUDGET-left).toFixed(1);
  return c;
}
module.exports={TEMPLATES,make,BUDGET};
