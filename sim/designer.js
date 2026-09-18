// ---------------------------------------------------------------------------
// STAGE 1 - the designer.  Builds characters inside an archetype template,
// spending a fixed power budget so nothing can simply be better than everything.
// ---------------------------------------------------------------------------
const BUDGET=100;
// what each capability costs, per point of it
const COST={dmg:2.6, hpMul:34, barrier:1.25, heal:1.15, thorns:9, taunt:3.4,
            stacks:11, shred:1.5, react:8, ratio:11, advance:34, charge:0.5,
            marks:6, aoe:26, apply:0, detonate:22, spread:12, over:6,
            onHitBarrier:14, drain:20, sp:0.42};

// Each template says: which tags, which capabilities are allowed, and roughly
// how the budget should be split.  The search fills in the numbers.
const TEMPLATES={
  guard:   {tags:['Hull'],            must:['barrier'],  may:['dmg','hpMul','taunt','onHitBarrier','heal'],
            note:'keeps someone else standing'},
  payback: {tags:['Hull','Ordnance'], must:['thorns','taunt'], may:['dmg','hpMul','drain'],
            note:'wants to be hit'},
  seeder:  {tags:['Blight'],          must:['apply','stacks'], may:['dmg','aoe','shred','spread'],
            note:'puts ailments on things'},
  igniter: {tags:['Blight'],          must:['detonate'], may:['dmg','aoe','shred'],
            note:'spends what the seeders built'},
  reader:  {tags:['Assay'],           must:['marks'],    may:['dmg','aoe','shred','sp'],
            note:'opens targets up'},
  answer:  {tags:['Assay','Ordnance'],must:['react','ratio'], may:['dmg','sp'],
            note:'fires when something happens'},
  engine:  {tags:['Drive'],           must:['advance'],  may:['dmg','sp','charge'],
            note:'moves the turn order'},
  hammer:  {tags:['Ordnance'],        must:['dmg'],      may:['hpMul','sp','aoe','shred'],
            note:'one big number'},
  mender:  {tags:['Crew'],            must:['heal'],     may:['dmg','over','sp','barrier'],
            note:'keeps the crew upright'},
  conduit: {tags:['Crew','Drive'],    must:['charge'],   may:['dmg','sp','heal','advance'],
            note:'hands its power to someone else'}
};
const TRIGS={answer:['ally','break','mark','hurt']};

function make(rnd,templateKey,gen){
  const T=TEMPLATES[templateKey];
  const c={tmpl:templateKey, tags:T.tags.slice(), sp:0, dmg:0, gen:gen};
  let left=BUDGET;
  // baseline speed everyone pays for
  const spBase=76+Math.floor(rnd()*46);
  c.sp=spBase; left-=(spBase-76)*COST.sp;
  function buy(k,lo,hi,round){
    const span=hi-lo, v=lo+rnd()*span;
    const val=round?Math.max(1,Math.round(v)):+v.toFixed(2);
    const cost=val*COST[k];
    if(cost>left) return false;
    c[k]=val; left-=cost; return true;
  }
  // mandatory capabilities first
  T.must.forEach(k=>{
    if(k==='apply'){c.apply=1;return;}
    if(k==='ratio'){buy('ratio',0.4,2.4,false);return;}
    if(k==='react'){buy('react',1,4,true);return;}
    if(k==='thorns'){buy('thorns',0.6,4.6,false);return;}
    if(k==='advance'){buy('advance',0.25,0.6,false);return;}
    if(k==='detonate'){c.detonate=1;left-=COST.detonate;return;}
    if(k==='marks'){buy('marks',1,3,true);return;}
    if(k==='stacks'){buy('stacks',1,3,true);return;}
    if(k==='heal'){buy('heal',14,34,true);return;}
    if(k==='barrier'){buy('barrier',14,36,true);return;}
    if(k==='charge'){buy('charge',18,44,true);return;}
    if(k==='taunt'){buy('taunt',2,6,true);return;}
    if(k==='dmg')  {buy('dmg',12,26,true);return;}
  });
  if(templateKey==='answer') c.trig=TRIGS.answer[Math.floor(rnd()*4)];
  // spend what is left on optional capabilities, cheapest interesting first
  const may=T.may.slice().sort(()=>rnd()-0.5);
  may.forEach(k=>{
    if(left<8) return;
    if(k==='dmg')   buy('dmg',4,Math.min(24,Math.floor(left/COST.dmg)),true);
    if(k==='hpMul'){const v=1+rnd()*0.6; if(v*COST.hpMul-COST.hpMul<left){
      c.hpMul=+v.toFixed(2); left-=(v-1)*COST.hpMul;} }
    if(k==='aoe'&&left>COST.aoe){c.aoe=1;left-=COST.aoe;}
    if(k==='shred') buy('shred',8,Math.min(22,Math.floor(left/COST.shred)),true);
    if(k==='spread'&&left>COST.spread){c.spread=1;left-=COST.spread;}
    if(k==='over'&&left>COST.over){c.over=1;left-=COST.over;}
    if(k==='onHitBarrier'&&left>COST.onHitBarrier){c.onHitBarrier=1;left-=COST.onHitBarrier;}
    if(k==='drain'&&left>COST.drain){c.drain=+(0.2+rnd()*0.3).toFixed(2);left-=COST.drain;}
    if(k==='taunt') buy('taunt',2,5,true);
    if(k==='heal')  buy('heal',10,24,true);
    if(k==='barrier')buy('barrier',10,24,true);
    if(k==='charge') buy('charge',12,30,true);
    if(k==='sp'){const b=Math.min(30,Math.floor(left/COST.sp)); if(b>4){c.sp+=b;left-=b*COST.sp;}}
  });
  if(!c.dmg) c.dmg=Math.max(4,Math.round(left/COST.dmg));
  c.spent=+(BUDGET-left).toFixed(1);
  return c;
}
module.exports={TEMPLATES,make,BUDGET};
