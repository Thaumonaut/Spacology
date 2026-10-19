/* Seeded, three-sector voyages. The round field is the route cursor, not combat time. */
(function () {
  'use strict';
  const formats = Object.freeze({
    setup: {name:'Departure supplies', kind:'reward', description:'Choose supplies to establish your build.'},
    survey: {name:'Survey battle', kind:'battle', description:'Two waves of regular enemies. No elites.'},
    swarm: {name:'Mob swarm', kind:'battle', description:'Three waves of small, weak enemies. No elites; area attacks excel.'},
    ambush: {name:'Ambush', kind:'battle', description:'Two waves of fragile, fast enemies. No elites; protection and control help.'},
    modifier: {name:'Voyage modifier', kind:'modifier', description:'Choose one optional trade-off for the remaining voyage, or pass.'},
    elite: {name:'Elite encounter', kind:'battle', description:'Two waves, each led by an elite specimen.'},
    cache: {name:'Supply cache', kind:'reward', description:'Choose spending money or equipment and scrap.'},
    workshop: {name:'Field workshop', kind:'reward', description:'Choose crafting supplies or a repair and gold.'},
    research: {name:'Research station', kind:'reward', description:'Choose field experience or Bloom crystals and gold.'},
    boss: {name:'Sector boss', kind:'battle', description:'One major specimen. At half health its guard weakens and damage increases. Every third attack hits harder.'}
  });
  function hash(value) { let h=2166136261; for(const c of String(value)) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
  function active(state) { return state?.voyageVersion===1; }
  function route(state) {
    if(!active(state)) return [];
    const rewards=['cache','workshop','research'];
    const offset=hash(state.treasureSeed+'-rewards')%3;
    const nodes=[];
    for(let sector=1;sector<=3;sector++) {
      const swap=hash(state.treasureSeed+'-combat-'+sector)%2;
      const sequence=sector===1?['setup','survey','modifier','swarm','elite',rewards[offset],'boss']:
        ['survey',swap?'ambush':'swarm','modifier',swap?'swarm':'ambush','elite',rewards[(offset+sector-1)%3],'boss'];
      sequence.forEach((format,i)=>nodes.push({...formats[format],format,sector,slot:i+1,index:nodes.length+1,id:state.treasureSeed+'-node-'+(nodes.length+1)}));
    }
    return nodes;
  }
  function current(state) { return route(state)[state.round-1]||null; }
  function start(state, difficulty) {
    if(!active(state)||state.voyageStarted||state.round!==1||!Object.hasOwn(window.SpacologyVoyageSettings.difficulties,difficulty))return false;
    state.difficulty=difficulty;state.voyageStarted=true;
    const d=window.SpacologyVoyageSettings.difficulties[difficulty];
    state.voyageModifiers={enemyScale:d.enemyScale,enemySpeed:d.enemySpeed,enemyGuard:d.enemyGuard,breakDelay:d.breakDelay,label:d.label};
    return true;
  }
  function profile(state) {
    const node=current(state);if(!node||node.kind!=='battle')return null;
    const sector=node.sector,format=node.format;
    const d=state.voyageModifiers||window.SpacologyVoyageSettings.difficulties[state.difficulty]||window.SpacologyVoyageSettings.difficulties.standard;
    return {hp:(1+(sector-1)*.55)*d.enemyScale,damage:(.9+(sector-1)*.3)*d.enemyScale,
      speed:(1+(sector-1)*.04)*d.enemySpeed,guard:(1+(sector-1)*.12)*d.enemyGuard,recovery:d.breakDelay,
      field:format==='boss'?1:format==='swarm'?5:3, waves:format==='boss'?1:format==='swarm'?3:2,
      gold:18+sector*6+(format==='elite'?6:format==='boss'?12:0)};
  }
  function rewards(state) {
    const n=current(state);if(!n||n.kind!=='reward')return [];
    const gear=['Tuning Fork','Bore Bit','Ballast Plate','Quick Latch'][hash(n.id)%4],s=n.sector;
    const choices={
      setup:[{label:'Build fund',gold:20},{label:'Starter equipment',gold:8,gear:[gear],scrap:4}],
      cache:[{label:'Currency reserve',gold:18+s*4},{label:'Equipment salvage',gold:8,gear:[gear],scrap:8}],
      workshop:[{label:'Crafting stock',gold:8,scrap:12},{label:'Ship repairs',gold:12,integrity:8}],
      research:[{label:'Field training',gold:8,fieldXP:12},{label:'Bloom samples',gold:12,crystals:2}]
    };
    return choices[n.format]||[];
  }
  function advance(state,nodeId) {
    const n=current(state);if(!state.voyageStarted||state.end||!n||n.id!==nodeId)return false;
    state.round++;state.openedThisRound=false;state.packRefreshes=0;return true;
  }
  function claim(state,nodeId,index) {
    const n=current(state),reward=rewards(state)[index];
    if(!state.voyageStarted||state.end||n?.id!==nodeId||!reward)return null;
    state.gold+=reward.gold||0;state.scrap=(state.scrap||0)+(reward.scrap||0);state.crystals=(state.crystals||0)+(reward.crystals||0);
    state.integrity=Math.min(100,state.integrity+(reward.integrity||0));
    (state.gear||=[]).push(...(reward.gear||[]));
    (state.nodeHistory||=[]).push({nodeId,round:state.round,name:n.name,reward:{...reward}});
    advance(state,nodeId);return reward;
  }
  function chooseModifier(state,nodeId,id) {
    const n=current(state),rules=window.SpacologyExpedition;
    if(!state.voyageStarted||state.end||n?.id!==nodeId||n.kind!=='modifier')return false;
    if(id!=='skip') {
      const mod=rules.modifiers[id];
      if(!mod||rules.activeModifiers(state).some(key=>rules.modifiers[key].category===mod.category))return false;
      state.modifiers.push(id);
    }
    state.modifierChoices.push(state.round);
    (state.nodeHistory||=[]).push({nodeId,round:state.round,name:n.name,modifier:id});
    return advance(state,nodeId);
  }
  function updateBoss(unit) {
    if(!unit.boss)return false;
    unit.lowestHP=Math.min(unit.lowestHP??unit.max,Math.max(0,unit.hp));
    if(!unit.alive||unit.phase===2||unit.hp>unit.max/2)return false;
    unit.phase=2;unit.dmg=Math.round(unit.dmg*1.35);unit.shieldPer=Math.max(1,Math.round(unit.shieldPer*.6));unit.shC=Math.min(unit.shC,unit.shieldPer);
    return true;
  }
  window.SpacologyVoyage=Object.freeze({formats,active,route,current,start,profile,rewards,advance,claim,chooseModifier,updateBoss});
})();
