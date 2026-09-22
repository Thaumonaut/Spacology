(function () {
  'use strict';
  const crew = {
    Tarn: {element:'order', tags:['Hull','Ordnance'], planet:'Earth',species:'Human'},
    Ash: {element:'decay', tags:['Blight'], planet:'Calyx IV',species:'Oni',birthplace:'Utora VII'},
    Quill: {element:'void', tags:['Blight','Assay'], planet:'Earth',species:'Human'},
    Maul: {element:'decay', tags:['Assay','Ordnance'], planet:'Earth',species:'Human'},
    Bosk: {element:'decay', tags:['Ordnance','Hull'], planet:'Ilex Moraine',species:'Ursine',birthplace:'Good Weather recovery arc'},
    Coda: {element:'energy', tags:['Drive','Crew'], planet:'Tessine IX',species:'Moth-folk',birthplace:'Lamp at Periapsis relay'},
    Morrow: {element:'growth', tags:['Blight'], planet:'Ilex Moraine',species:'Cervine',birthplace:'Ilex Moraine'},
    Spore: {element:'growth', tags:['Blight','Crew'], planet:'Calyx IV',species:'Fungal people',birthplace:'Calyx IV'},
    Ledger: {element:'order',tags:['Assay','Drive'],planet:'Tessine IX',species:'Moth-folk',birthplace:'Census ship'}
  };
  // Proposed ancestral affiliations; diaspora birthplaces remain separate.
  Object.assign(crew.Tarn,{birthplace:'Tannhul VI diaspora'});
  Object.assign(crew.Maul,{birthplace:'Kessa Station'});
  Object.assign(crew.Quill,{birthplace:'Iseul orbital diaspora'});
  const worlds=[
    {star:'Sol',name:'Earth',x:17,y:57,peoples:'Human lineages; many migrant communities.',landscape:'Oceans, continents and an old diaspora.',status:'Existing world; shared human ancestry proposed for the harmony.'},
    {star:'Calyx',name:'Calyx IV',x:43,y:71,peoples:'Fungal peoples, oni and human communities.',landscape:'Temperate forests, dense fungal ecologies and long-established mixed settlements.',status:'Existing world. Fungal/oni shared ancestral affiliation is proposed.'},
    {star:'Ilex',name:'Ilex Moraine',x:24,y:22,peoples:'Cervine, ursine and canid lineages.',landscape:'Glacial basins, conifer forests and seasonal migration corridors.',status:'Morrow’s existing world; star, ecology and shared lineages proposed.'},
    {star:'Tessine',name:'Tessine IX',x:69,y:27,peoples:'Moth-folk; mixed orbital and surface communities.',landscape:'Twilight forests and low-gravity orbital universities.',status:'Existing moth-folk world; ecology and shipborn affiliations proposed.'},
    {star:'Tannhul',name:'Tannhul VI',x:78,y:74,peoples:'Rock skins and human diaspora communities.',landscape:'High-gravity cities and load-bearing reef settlements.',status:'Existing high-gravity world; does not replace Earth ancestry for Tarn.'},
    {star:'Iseul',name:'Iseul III',x:52,y:43,peoples:'Ossuan and human orbital communities.',landscape:'Survey networks linking planetary and orbital settlements.',status:'Existing world; birthplace and ancestral affiliation are distinct.'}
  ];
  const recipes = [
    {name:'Lumen Conduit',inputs:[],scrap:12,crystals:2,effect:'Begin battle with 35 extra Energy; ultimate damage increases by 20%.',stats:{startEnergy:35,ultMul:1.2}},
    {name:'Resonance Coil', inputs:['Tuning Fork','Spore Sling'], effect:'Applications add 1 stack; spread reaches 1 additional specimen.', stats:{frac:1,spreadExtra:1}},
    {name:'Survey Lance', inputs:['Ranging Sight','Bore Bit'], effect:'Attacks hit 1 additional specimen and deal 40% more guard damage.', stats:{extraTargets:1,guardMul:1.4}},
    {name:'Counterweight', inputs:['Loaded Die','Recoil Spring'], effect:'First attack deals 20% more damage; follow-ups deal 30% more.', stats:{openingBoost:.2,followMul:1.3}},
    {name:'Overdrive Relay', inputs:['Quick Latch','Slow Fuse'], effect:'Start 8 Action Value ahead; ultimates deal 25% more damage.', stats:{startAdvance:8,ultMul:1.25}},
    {name:'Breach Mantle', inputs:['Ballast Plate','Bore Bit'], effect:'Barriers are 45% larger; attacks deal 60% more guard damage.', stats:{barrierMul:1.45,guardMul:1.6}}
  ];
  const modifiers = {
    reinforced:{name:'Reinforced specimens',category:'stat',description:'Enemies have 25% more health. Victory gold increases by 20%.',enemyHp:1.25,reward:1.2},
    volatile:{name:'Volatile atmosphere',category:'rule',description:'Crew and enemies deal 20% more direct attack damage.',crewDamage:1.2,enemyDamage:1.2},
    rationing:{name:'Salvage contract',category:'cost',description:'Supply packs cost 2 more gold. Each completed encounter pays 6 extra gold.',packCost:2,flatGold:6}
  };
  const goals = {
    survey:{name:'Fracture survey',description:'Break 6 enemy shields during this voyage.',target:6,metric:'breaks',battle:'Break 2 enemy shields.',battleTarget:2},
    resonance:{name:'Resonance study',description:'Trigger 6 elemental chains during this voyage.',target:6,metric:'chains',battle:'Trigger 2 elemental chains.',battleTarget:2},
    safe:{name:'Safe recovery',description:'Win 3 encounters without a crew member going Down.',target:3,metric:'safeWins',battle:'Win without a crew member going Down.',battleTarget:1}
  };
  const route=['First contact','Echo basin','Major specimen','Deep survey','Major specimen','Final extraction'];
  const tags={Hull:['Barriers +45%.','Absorbed damage becomes ammunition.'],Blight:['Ailment applications +1 stack.','Periodic ailment blooms activate.'],Drive:['Crew act 12% faster.','Kills advance the next ally.'],Ordnance:['Crew direct damage +20%.','A hit that breaks a shield lands twice.'],Assay:['Guard damage +60%.','A break makes the enemy skip two turns.'],Crew:['Healing +50%.','One emergency relief per encounter.']};
  function activeModifiers(state){return [...new Set(state.modifiers||[])].filter(id=>modifiers[id]);}
  function effects(state){const out={enemyHp:1,enemyDamage:1,crewDamage:1,reward:1,packCost:0,flatGold:0};activeModifiers(state).forEach(id=>{const m=modifiers[id];['enemyHp','enemyDamage','crewDamage','reward'].forEach(k=>out[k]*=m[k]||1);out.packCost+=m.packCost||0;out.flatGold+=m.flatGold||0;});return out;}
  function planetCounts(names){const counts={};[...new Set(names)].forEach(n=>{if(crew[n])counts[crew[n].planet]=(counts[crew[n].planet]||0)+1});return counts;}
  function planetHealth(names){return 1+Object.values(planetCounts(names)).reduce((sum,n)=>sum+(n>=3?.15:n>=2?.08:0),0);}
  function goal(state){return goals[state.goal]||goals.survey;}
  function goalGain(state,result){const g=goal(state);return g.metric==='safeWins'?(result.won&&result.deaths===0?1:0):Math.max(0,Number(result[g.metric])||0);}
  function observed(state,stats,won){const g=goal(state);return g.metric==='safeWins'?won&&stats.deaths===0:(stats[g.metric]||0)>=g.battleTarget;}
  window.SpacologyExpedition={crew,worlds,recipes,modifiers,goals,route,tags,activeModifiers,effects,planetCounts,planetHealth,goal,goalGain,observed,rowSlots:{field:5,support:7},recruitCost:32,attuneScrap:12,attuneCrystals:1};
})();
