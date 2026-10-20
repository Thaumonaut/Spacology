(function(root){
  'use strict';
  // Shared by the acquisition lab and its Node sweeps. Experimental kits, not live combat parity.
  const characters=[
    {id:'Silen',role:'DPS',engine:'hypercarry',hp:145,attack:32,speed:108,cost:3,kit:'Focused strike. Receives the team’s carry buffs.',art:'silen-newt-v1.png'},
    {id:'Arunima',role:'DPS',engine:'multi',hp:125,attack:25,speed:92,cost:3,aoe:true,kit:'Area damage. Competes for Aether with other carries.',art:'arunima-das-v4.png'},
    {id:'Wren',role:'DPS',engine:'break',hp:145,attack:17,speed:102,cost:2,shred:36,ultra:42,kit:'Heavy shield damage. While alive, allied final-layer breaks trigger her 42 ultra-break damage.',art:'wren-adeyemi-v2.png'},
    {id:'Nour',role:'DPS',engine:'dot',hp:125,attack:18,speed:106,cost:2,dot:3,kit:'Applies 3 poison stacks; each ticks on the enemy turn.',art:'nour-bediako-v3.png'},
    {id:'Reva',role:'DPS',engine:'counter',hp:180,attack:19,speed:96,cost:2,reflect:.8,kit:'Returns 80% of actual absorbed damage plus health lost once per enemy action.',art:'reva-sokolovna-v2.png'},
    {id:'Coda',role:'Sub-DPS',engine:'multi',hp:130,attack:16,speed:114,cost:1,echo:true,kit:'Once per ally action, follows a direct damaging action for 8 damage. Echoes do not echo.',art:'coda-v2.png'},
    {id:'Aurel',role:'Support',engine:'hypercarry',hp:140,attack:9,speed:112,cost:1,advance:true,kit:'Advances the designated carry by 20 AV.',art:'aurel-cosma-v2.png'},
    {id:'Ekene',role:'Support',engine:'hypercarry',hp:130,attack:10,speed:108,cost:1,buff:.35,kit:'Adds 35% direct damage to the designated carry while alive.',art:'ekene-baptiste-v2.png'},
    {id:'Roonie',role:'Support',engine:'all',hp:140,attack:10,speed:120,cost:0,refill:3,kit:'Generates 3 Aether and grants the carry a small barrier.',art:'roonie-baelk-v7.png'},
    {id:'Quill',role:'Support',engine:'break',hp:140,attack:12,speed:115,cost:1,shred:30,ultraBuff:.45,kit:'Amplifies ultra-break by 45% and removes shields efficiently.',art:'quill-v2.png'},
    {id:'Spore',role:'Sub-DPS',engine:'dot',hp:145,attack:12,speed:105,cost:1,dot:2,aoe:true,kit:'Applies 2 poison stacks to each target.',art:'spore-v2.png'},
    {id:'Redcap',role:'Support',engine:'dot',hp:140,attack:10,speed:108,cost:1,dotBuff:.4,kit:'Poison ticks deal 40% more damage while she is alive.',art:'redcap-v1.png'},
    {id:'Latch',role:'Support',engine:'exposure',hp:145,attack:11,speed:110,cost:1,enemyAdvance:true,kit:'When enabled, advances one enemy by 25 AV after applying a hit.',art:null},
    {id:'Ilka',role:'Sustain',engine:'counter',hp:170,attack:10,speed:108,cost:1,barrier:44,provoke:true,kit:'Barriers the designated ally and increases their targeting weight.',art:'ilka-voressen-v2.png'},
    {id:'Nahana',role:'Sustain',engine:'all',hp:160,attack:10,speed:112,cost:1,heal:38,kit:'Heals the most injured ally; uses a basic when everyone is healthy.',art:'nahana-v2.png'},
    {id:'Daven',role:'Sustain',engine:'counter',hp:210,attack:14,speed:96,cost:1,barrier:26,self:true,refund:true,kit:'Barriers himself and draws attacks. An absorbed hit refunds 1 Aether per enemy action.',art:'daven-pell-v7.png'}
  ];
  const gear=[
    {id:'Focus Lens',kind:'direct',amount:.22,text:'+22% direct damage.'},
    {id:'Bore Bit',kind:'shred',amount:16,text:'+16 shield damage on a skill.'},
    {id:'Break Capacitor',kind:'ultra',amount:25,text:'+25 ultra-break damage for a wearer with ultra-break.'},
    {id:'Culture Vessel',kind:'dot',amount:1,text:'+1 poison stack per application.'},
    {id:'Recoil Spring',kind:'reflect',amount:.35,text:'+35 percentage points of retaliation for a retaliation wearer.'},
    {id:'Ballast Plate',kind:'barrier',amount:18,text:'+18 barrier on a barrier skill.'},
    {id:'Quick Latch',kind:'speed',amount:12,text:'+12 speed.'},
    {id:'Recovery Bell',kind:'heal',amount:16,text:'+16 health on a healing skill.'}
  ];
  const roster=Object.fromEntries(characters.map(c=>[c.id,c]));
  const items=Object.fromEntries(gear.map(g=>[g.id,g]));
  const engines={
    hypercarry:{label:'Hypercarry',starter:'Silen',core:['Silen','Aurel','Ekene','Roonie'],hint:'Feed one DPS with advance, amplification and Aether.'},
    break:{label:'Ultra-break',starter:'Wren',core:['Wren','Quill','Roonie'],hint:'Remove shields, cash ultra-break, then break reformed shields again.'},
    dot:{label:'DoT',starter:'Nour',core:['Nour','Spore','Redcap'],hint:'Apply poison; advancing enemies trades safety for faster ticks.'},
    counter:{label:'Retaliation',starter:'Reva',core:['Reva','Ilka','Latch'],hint:'Protect Reva, designate her as the recipient, and invite attacks.'},
    multi:{label:'Multi-carry',starter:'Arunima',core:['Arunima','Coda','Roonie'],hint:'Cover multiple enemies without starving damage dealers of Aether.'}
  };
  const encounters=[
    {id:'survey',name:'Survey patrol',hp:160,count:2,damage:20,speed:85,shield:35,delay:.25,weakness:'One focused target at a time; moderate incoming pressure.'},
    {id:'swarm',name:'Crowded signal',hp:105,count:4,damage:13,speed:100,shield:20,delay:.25,weakness:'Many fragile targets reward area coverage.'},
    {id:'pressure',name:'Rapid hunters',hp:210,count:2,damage:29,speed:130,shield:40,delay:.25,weakness:'Frequent attacks test healing and targeting protection.'},
    {id:'reform',name:'Fast reformers',hp:260,count:2,damage:30,speed:110,shield:60,delay:0,weakness:'Shield reforms on the next enemy turn, with no added break delay.'},
    {id:'chip',name:'Contamination array',hp:220,count:3,damage:17,speed:110,shield:40,delay:.25,aoe:true,weakness:'Area chip bypasses targeting priority; recovery matters.'},
    {id:'boss',name:'Archive sentinel',hp:850,count:1,damage:57,speed:120,shield:100,delay:.12,weakness:'Long fight, repeated shield recovery, heavy single-target attacks.'}
  ];
  const modes={packs:{label:'Themed packs',text:'6 gold: keep two random recruits. A thematic bias, no choice at reveal.'},draft:{label:'Choose-one draft',text:'6 gold: see three recruits and keep one. One 2-gold refresh per stage.'},target:{label:'Draft + target',text:'Same draft; after three recruit purchases, choose your nominated recruit instead.'}};
  function random(seed){let x=(Number(seed)>>>0)||1;return()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};}
  function hash(value){let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function sample(pool,n,rng){const copy=pool.slice(),out=[];while(out.length<n&&copy.length)out.push(copy.splice(Math.floor(rng()*copy.length),1)[0]);return out;}
  function offers(state,kind){
    const rng=random(hash(`${state.seed}:${state.stage}:${kind}:${state.refresh[kind]||0}`));
    if(kind==='gear')return sample(gear.map(g=>g.id),3,rng);
    const pool=characters.map(c=>c.id),preferred=characters.filter(c=>c.engine===state.engine||c.engine==='all'||(['dot','counter'].includes(state.engine)&&c.engine==='exposure')).map(c=>c.id);
    const out=[];const count=state.mode==='packs'?2:3;
    while(out.length<count){const eligible=(rng()<.55?preferred:pool).filter(id=>!out.includes(id));out.push(sample(eligible.length?eligible:pool.filter(id=>!out.includes(id)),1,rng)[0]);}
    return out;
  }
  function create({seed=1,mode='draft',engine='hypercarry',sandbox=false}={}){
    if(!modes[mode]||!engines[engine])throw new Error('Unknown experiment configuration');
    const starter=engines[engine].starter;
    return {version:1,seed:Number(seed)>>>0,mode,engine,sandbox,stage:0,gold:12,scrap:0,owned:{[starter]:1,Roonie:1},team:[starter,'Roonie'],equipment:[],carry:starter,recipient:starter,enemyAdvance:false,target:engines[engine].core.find(id=>id!==starter&&id!=='Roonie'),progress:0,refresh:{crew:0,gear:0},bought:{crew:false,gear:false},history:[],results:[],feedback:{},startedAt:Date.now()};
  }
  const capacity=state=>state.sandbox||state.stage>=2?5:4;
  function act(state,action){
    if(state.stage>=encounters.length&&!['feedback'].includes(action.type))return 'This experiment is complete. Start another comparison.';
    const record={stage:state.stage,type:action.type,...action};
    if(action.type==='target'){
      if(state.mode!=='target'||action.id&&(!roster[action.id]||state.owned[action.id]))return 'Choose an unowned recruit.';
      state.target=action.id||null;
    }else if(action.type==='refresh'){
      if(!['crew','gear'].includes(action.kind)||state.bought[action.kind]||state.refresh[action.kind]||state.gold<2)return 'Refresh unavailable.';
      state.gold-=2;state.refresh[action.kind]++;
    }else if(action.type==='crew'){
      if(state.sandbox||state.bought.crew||state.gold<6)return 'Recruitment unavailable.';
      const available=offers(state,'crew');
      const guarantee=state.mode==='target'&&state.progress>=2&&state.target&&!state.owned[state.target];
      if(state.mode!=='packs'&&!available.includes(action.id)&&!(guarantee&&action.id===state.target))return 'That recruit is not offered.';
      const ids=state.mode==='packs'?available:[action.id];
      state.gold-=6;state.bought.crew=true;
      ids.forEach(id=>{if((state.owned[id]||0)<3)state.owned[id]=(state.owned[id]||0)+1;else state.scrap+=2;});
      if(state.mode==='target'){state.progress=guarantee&&action.id===state.target?0:Math.min(3,state.progress+1);if(state.owned[state.target])state.target=null;}
      record.received=ids;
    }else if(action.type==='gear'){
      if(state.sandbox||state.bought.gear||state.gold<4||!offers(state,'gear').includes(action.id))return 'That equipment is unavailable.';
      state.gold-=4;state.bought.gear=true;state.equipment.push({id:action.id,owner:null});
    }else if(action.type==='craft'){
      if(state.sandbox||state.bought.gear||state.scrap<4||!items[action.id])return 'Crafting needs 4 scrap and replaces this stage’s gear purchase.';
      state.scrap-=4;state.bought.gear=true;state.equipment.push({id:action.id,owner:null});
    }else if(action.type==='deploy'){
      if(!roster[action.id]||(!state.sandbox&&!state.owned[action.id]))return 'Recruit not owned.';
      if(state.team.includes(action.id)){
        if(state.team.length===1)return 'Keep at least one crew member.';
        state.team=state.team.filter(id=>id!==action.id);
      }else{if(state.team.length>=capacity(state))return 'Formation full. Bench someone first.';state.team.push(action.id);}
      if(!state.team.includes(state.carry))state.carry=state.team[0];
      if(!state.team.includes(state.recipient))state.recipient=state.team[0];
    }else if(action.type==='equip'){
      const item=state.equipment[action.index];
      if(!item||action.owner&&(!roster[action.owner]||!state.team.includes(action.owner)))return 'Invalid equipment target.';
      if(action.owner&&state.equipment.filter((g,i)=>i!==action.index&&g.owner===action.owner).length>=2)return 'Two gear slots per character. Move an item first.';
      item.owner=action.owner||null;
    }else if(action.type==='carry'||action.type==='recipient'){
      if(!state.team.includes(action.id))return 'Choose a deployed ally.';state[action.type]=action.id;
    }else if(action.type==='advance')state.enemyAdvance=!!action.enabled;
    else if(action.type==='sandboxGear'){
      if(!state.sandbox||!items[action.id]||state.equipment.length>=10)return 'Sandbox gear limit reached.';
      state.equipment.push({id:action.id,owner:null});
    }else if(action.type==='feedback')state.feedback={...state.feedback,...action.value};
    else return 'Unknown action.';
    state.history.push(record);return null;
  }
  function fit(id,state){const c=roster[id];const partners=state.team.filter(x=>x!==id);if(c.engine===state.engine)return `Fits ${engines[state.engine].label.toLowerCase()}.`;if(c.refill)return 'Supplies shared skill resources.';if(c.heal)return 'Repairs deliberate exposure and area damage.';if(c.provoke&&partners.some(x=>roster[x].reflect))return 'Protects and attracts hits toward a retaliation ally.';if(c.enemyAdvance&&partners.some(x=>roster[x].dot||roster[x].reflect))return 'More enemy turns can trigger poison or retaliation.';return 'A possible pivot or encounter answer.';}
  function engineReady(state){const team=state.team.map(id=>roster[id]);switch(state.engine){case'hypercarry':return team.some(c=>c.id===state.carry&&c.role==='DPS')&&team.filter(c=>c.buff||c.advance||c.refill).length>=2;case'break':return team.some(c=>c.ultra)&&team.some(c=>c.ultraBuff||c.advance);case'dot':return team.some(c=>c.dot)&&team.some(c=>c.dotBuff||c.id==='Spore'||c.enemyAdvance);case'counter':return team.some(c=>c.reflect)&&team.some(c=>c.barrier||c.heal);case'multi':return team.filter(c=>c.role==='DPS'||c.echo).length>=2;default:return false;}}
  function fight(state,{scale=1,seed=state.seed+state.stage*997,encounter=encounters[state.stage],circuits={}}={}){
    if(!encounter||!state.team.length)throw new Error('A formation and encounter are required');
    const rng=random(seed),logs=[],metrics={direct:0,dot:0,ultra:0,retaliation:0,healed:0,absorbed:0,overheal:0,enemyAttacks:0,enemyAdvances:0,breaks:0,recoveries:0,aetherWasted:0,deaths:0,starved:0,circuitTriggers:0};
    const crew=state.team.map(id=>{
      const c=roster[id],rank=state.sandbox?1:state.owned[id]||1,mul=1+(rank-1)*.12;
      const effects={};state.equipment.filter(g=>g.owner===id).forEach(g=>{const i=items[g.id];effects[i.kind]=(effects[i.kind]||0)+i.amount;});
      const hp=c.hp*mul,speed=c.speed+(effects.speed||0);
      return {...c,max:hp,hp,attack:c.attack*mul,speed,effects,circuit:circuits[id]||{},directActions:0,barrier:0,weight:c.reflect?2:1,av:10000/speed*(.55+rng()*.2),damage:0};
    });
    const enemies=Array.from({length:encounter.count},(_,i)=>({id:i,name:encounter.name+' '+(i+1),hp:encounter.hp*scale,max:encounter.hp*scale,shield:encounter.shield,broken:false,av:10000/encounter.speed*(.7+rng()*.2),poison:[],breakContributors:new Set()}));
    let time=0,pool=3,steps=0;
    const alive=()=>crew.filter(c=>c.hp>0),foes=()=>enemies.filter(e=>e.hp>0);
    const note=text=>{if(logs.length<100)logs.push({av:Math.round(time),text});};
    function gain(n){const used=Math.min(n,10-pool);pool+=used;metrics.aetherWasted+=n-used;}
    function hurt(e,n,kind,owner){const actual=Math.min(e.hp,Math.max(0,n));e.hp-=actual;metrics[kind]+=actual;if(owner)owner.damage+=actual;return actual;}
    function direct(c,e,skill){
      const raw=c.attack*(skill?1.8:1)*(1+(c.effects.direct||0)+(c.id===state.carry?alive().reduce((s,x)=>s+(x.buff||0),0):0));
      hurt(e,raw*(e.broken?1.25:.6),'direct',c);
      if(e.hp<=0)return;
      if(!e.broken){const shred=Math.min(e.shield,skill?(c.shred||12)+(c.effects.shred||0):7);e.shield-=shred;if(shred>0)e.breakContributors.add(c.id);
        if(e.shield<=0){e.broken=true;metrics.breaks++;e.av+=10000/encounter.speed*encounter.delay;note(c.id+' breaks a shield.');
          alive().filter(x=>x.circuit.breakRefund&&e.breakContributors.has(x.id)).forEach(x=>{gain(1);metrics.circuitTriggers++;note(x.id+' recycles a break into Aether.');});
          const specialist=alive().find(x=>x.ultra);if(specialist){const extra=(specialist.ultra+(specialist.effects.ultra||0))*(1+alive().reduce((s,x)=>s+(x.ultraBuff||0),0));hurt(e,extra,'ultra',specialist);note(specialist.id+' deals '+Math.round(extra)+' ultra-break damage.');}}
      }
      if(skill&&c.dot&&e.hp>0){const boost=c.dot+(c.effects.dot||0);e.poison.push({stacks:boost,turns:3,owner:c.id});}
    }
    while(steps++<500&&time<600&&alive().length&&foes().length){
      const next=[...alive().map(c=>({unit:c,ally:true})),...foes().map(e=>({unit:e,ally:false}))].sort((a,b)=>a.unit.av-b.unit.av)[0];
      const u=next.unit;time=Math.max(time,u.av);if(time>600)break;
      u.av=time+10000/(next.ally?u.speed:encounter.speed);
      if(next.ally){
        const carry=alive().find(c=>c.id===state.carry)||alive()[0];
        const injured=alive().slice().sort((a,b)=>(a.hp/a.max)-(b.hp/b.max))[0];
        const recipient=u.self?u:alive().find(c=>c.id===state.recipient)||carry;
        const useful=(!u.heal||injured.hp<injured.max*.85)&&(!u.enemyAdvance||state.enemyAdvance);
        const reserved=u.id!==carry.id&&u.role==='DPS'&&pool<carry.cost+u.cost;
        const skill=useful&&pool>=u.cost&&!reserved;
        if(skill){pool-=u.cost;if(u.refill){gain(u.refill);carry.barrier=Math.min(90,carry.barrier+12);}if(u.heal){const before=injured.hp/injured.max,n=Math.min(injured.max-injured.hp,u.heal+(u.effects.heal||0));injured.hp+=n;metrics.healed+=n;metrics.overheal+=u.heal+(u.effects.heal||0)-n;if(u.circuit.healAdvance&&before<.75&&injured.hp/injured.max>=.75){injured.av=Math.max(time+1,injured.av-15);metrics.circuitTriggers++;note(u.id+' advances '+injured.id+' after recovery.');}}
          if(u.barrier){recipient.barrier=Math.min(110,recipient.barrier+u.barrier+(u.effects.barrier||0));if(u.provoke||u.self)recipient.weight=6;}
          if(u.advance&&carry!==u){carry.av=Math.max(time+1,carry.av-20);note(u.id+' advances '+carry.id+'.');}
        }else{gain(1);if(useful)metrics.starved++;}
        const targets=foes().slice().sort((a,b)=>a.hp-b.hp);u.directActions++;const widened=u.circuit.volley&&u.directActions%2===0&&targets.length>1&&!(skill&&u.aoe);const hitTargets=skill&&u.aoe?targets:targets.slice(0,widened?2:1);if(widened){metrics.circuitTriggers++;note(u.id+' widens an alternating volley.');}
        hitTargets.forEach(e=>direct(u,e,skill));
        const echo=alive().find(c=>c.echo&&c!==u);const echoTarget=hitTargets.find(e=>e.hp>0);if(echo&&echoTarget)hurt(echoTarget,8,'direct',echo);
        if(skill&&u.enemyAdvance&&state.enemyAdvance){const e=foes().sort((a,b)=>b.poison.length-a.poison.length||a.av-b.av)[0];if(e){e.av=Math.max(time+1,e.av-25);metrics.enemyAdvances++;note(u.id+' advances '+e.name+'.');}}
      }else{
        const dotAmp=1+alive().reduce((s,c)=>s+(c.dotBuff||0),0);
        const refunded=new Set();u.poison.forEach(p=>{if(u.hp>0){const owner=crew.find(c=>c.id===p.owner);hurt(u,p.stacks*6*dotAmp,'dot',owner);if(owner?.hp>0&&owner.circuit.poisonRefund&&!refunded.has(owner.id)){refunded.add(owner.id);gain(1);metrics.circuitTriggers++;note(owner.id+' recovers Aether from a poison tick.');}}p.turns--;});u.poison=u.poison.filter(p=>p.turns>0);
        if(u.hp<=0){note('Poison defeats '+u.name+' before it attacks.');continue;}
        if(u.broken){u.broken=false;u.shield=encounter.shield;u.breakContributors.clear();metrics.recoveries++;note(u.name+' reforms its shield and attacks.');}
        metrics.enemyAttacks++;
        const living=alive(),total=living.reduce((s,c)=>s+c.weight,0);let pick=rng()*total;const target=living.find(c=>(pick-=c.weight)<0)||living[0];
        const targets=encounter.aoe?living:[target];
        targets.forEach(c=>{const raw=encounter.damage*scale*(.9+rng()*.2),absorbed=Math.min(c.barrier,raw),lost=Math.min(c.hp,raw-absorbed);c.barrier-=absorbed;c.hp-=lost;metrics.absorbed+=absorbed;
          if(c.reflect&&c.hp>0){const n=(absorbed+lost)*(c.reflect+(c.effects.reflect||0));hurt(u,n,'retaliation',c);note(c.id+' retaliates for '+Math.round(n)+'.');}
          if(c.circuit.barrierReturn&&absorbed>0&&c.hp>0&&u.hp>0){hurt(u,8,'retaliation',c);metrics.circuitTriggers++;note(c.id+' returns an absorbed hit through its mechanism.');}
          if(c.refund&&absorbed>0&&c.hp>0)gain(1);if(c.hp<=0){metrics.deaths++;note(c.id+' is down.');}
        });
      }
      if(crew.some(c=>!Number.isFinite(c.hp))||enemies.some(e=>!Number.isFinite(e.hp)))throw new Error('Non-finite combat state');
    }
    const won=!foes().length,reason=won?'Clear':alive().length?'Deadline':'Defeat';
    return {won,reason,av:Math.round(Math.min(time,600)),metrics:Object.fromEntries(Object.entries(metrics).map(([k,v])=>[k,Math.round(v)])),contributions:crew.map(c=>({id:c.id,damage:Math.round(c.damage),hp:Math.round(c.hp),barrier:Math.round(c.barrier)})),remaining:foes().map(e=>({hp:Math.round(e.hp),max:Math.round(e.max)})),log:logs};
  }
  function settle(state){if(state.stage>=encounters.length||state.sandbox)return 'Use a forecast in sandbox.';const report=fight(state);state.results.push({stage:state.stage,team:state.team.slice(),equipment:state.equipment.map(g=>({...g})),engineReady:engineReady(state),gold:state.gold,...report});state.stage++;state.gold+=state.stage<encounters.length?12:0;state.bought={crew:false,gear:false};state.refresh={crew:0,gear:0};state.history.push({type:'settle',stage:state.stage-1,won:report.won});return report;}
  const api={characters,roster,gear,items,engines,encounters,modes,random,hash,sample,offers,create,capacity,act,fit,engineReady,fight,settle};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TeamBuildingLab=api;
})(typeof globalThis==='object'?globalThis:this);
