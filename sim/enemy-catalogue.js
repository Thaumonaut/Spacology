(function () {
'use strict';

// Seeded enemy and planet grammar. This is deliberately data-first so the same
// specimen can later be rendered by the web prototype, a native client, or tests.

const ELEMENTS=['order','chaos','growth','decay','energy','void'];

const ARCHETYPES={
  chaff:{label:'Chaff',cue:'small or numerous',problem:'action economy'},
  bruiser:{label:'Bruiser',cue:'low, broad mass',problem:'sustained pressure'},
  warden:{label:'Warden',cue:'concentric guard structures',problem:'layered guard'},
  cleanser:{label:'Cleanser',cue:'sloughing or venting organ',problem:'condition removal'},
  reflector:{label:'Reflector',cue:'radial mirror surfaces',problem:'repeated hits'},
  anchor:{label:'Anchor',cue:'rooted hub or command organ',problem:'enemy coordination'},
  bulwark:{label:'Bulwark',cue:'sheltering body or folding wall',problem:'target access'},
  quickstep:{label:'Quickstep',cue:'horizontal motion silhouette',problem:'setup time'},
  sapper:{label:'Sapper',cue:'forward projector or seed-casting organ',problem:'battlefield denial'},
  mender:{label:'Mender',cue:'paired repair limbs or restorative sacs',problem:'enemy recovery'}
};

const ALL_ARCHETYPES=Object.keys(ARCHETYPES);

const FACTIONS={
  ossuary:{
    name:'The Ossuary Reef',rule:'Molt',
    archetypes:ALL_ARCHETYPES,
    ecology:'A calcifying reef ecology that grows living tissue through inherited skeletal frameworks. Ossuary is a material lineage, not one body plan.',
    bodies:['school of hollow needlefish','rib-canopied vertebrate','walking shell cathedral','vertebral molt-serpent','radial scapula flower','antler-rooted reliquary','walking pelvic-bowl bastion','jawbone centipede','scapula-winged ossicle sower','long-limbed suture weaver'],
    roleBodies:{chaff:['school of hollow needlefish'],bruiser:['rib-canopied vertebrate'],warden:['walking shell cathedral'],cleanser:['vertebral molt-serpent'],reflector:['radial scapula flower'],anchor:['antler-rooted reliquary'],bulwark:['walking pelvic-bowl bastion'],quickstep:['jawbone centipede'],sapper:['scapula-winged ossicle sower'],mender:['long-limbed suture weaver']},
    typeNames:{chaff:'Needleling',bruiser:'Rattleback',warden:'Shell Cathedral',cleanser:'Molt Scourer',reflector:'Marrow Mirror',anchor:'Root Reliquary',bulwark:'Ivory Bastion',quickstep:'Skitterjaw',sapper:'Ossicle Sower',mender:'Sutureshell'},
    materials:['natural ivory bone','dark living fibre','marrow lanterns','calcified coral','polished scapula membrane'],
    adaptations:['magnetic joint spurs','vacuum-sealed marrow','radiation-scattering bone lattice','resonant marrow','ancestral scaffold growth'],
    prefixes:['Needle','Pale','Rattle','Hollow','Ivory'],suffixes:['ling','back','mantle','jaw','shell']
  },
  mycelial:{
    name:'The Mycelial Choir',rule:'Communion',
    archetypes:ALL_ARCHETYPES,
    ecology:'A network civilization of distinct fruiting guilds. Communion links many fungal anatomies without making them one species or one color.',
    bodies:['swarm of walking inkcaps','armored puffball ram','towering shelf-fungus stack','flowing oyster-gill ribbons','radial crystal earthstar','rooted coral-fungus colony','layered reishi fan wall','stinkhorn runner','bird-nest fungus mortar','lion-mane healer'],
    roleBodies:{chaff:['swarm of walking inkcaps'],bruiser:['armored puffball ram'],warden:['towering shelf-fungus stack'],cleanser:['flowing oyster-gill ribbons'],reflector:['radial crystal earthstar'],anchor:['rooted coral-fungus colony'],bulwark:['layered reishi fan wall'],quickstep:['stinkhorn runner'],sapper:['bird-nest fungus mortar'],mender:['lion-mane healer']},
    typeNames:{chaff:'Chorusling',bruiser:'Puffball Ram',warden:'Shelf Citadel',cleanser:'Gilled Ablutor',reflector:'Sporeglass Earthstar',anchor:'Nine-Root Node',bulwark:'Reishi Bastion',quickstep:'Stinkhorn Skater',sapper:'Nidularia Sower',mender:'Mercy Mane'},
    typePalettes:{chaff:'inky indigo and silver',bruiser:'ochre and tobacco brown',warden:'rust orange and cream',cleanser:'cobalt and pearl',reflector:'violet and translucent white',anchor:'coral red and bone',bulwark:'lacquer red and amber',quickstep:'scarlet and acid green',sapper:'deep teal and copper',mender:'soft pink and luminous ivory'},
    materials:['velvet mushroom flesh','translucent gills','braided hyphal cords','powdered spores','lacquered conk','crystal fruiting tissue'],
    adaptations:['pressure-fed hyphae','radiation-eating pigment','vacuum-dormant spores','resonance gills','memory-bearing sclerotia','bioluminescent enzyme pools'],
    prefixes:['Choir','Gill','Puff','Veil','Cap'],suffixes:['root','bloom','ling','mother','bell']
  },
  glasswake:{
    name:'The Glasswake',rule:'Refraction',
    archetypes:ALL_ARCHETYPES,
    bodies:['prism star','prism ram','lens jelly','ablation ribbon','mirror ray','lattice beacon','crystal fan','crystalline skater','shardcaster','annealing heart'],
    roleBodies:{chaff:['prism star'],bruiser:['prism ram'],warden:['lens jelly'],cleanser:['ablation ribbon'],reflector:['mirror ray'],anchor:['lattice beacon'],bulwark:['crystal fan'],quickstep:['crystalline skater'],sapper:['shardcaster'],mender:['annealing heart']},
    typeNames:{chaff:'Prism Star',bruiser:'Facet Ram',warden:'Lens Jelly',cleanser:'Ablation Ribbon',reflector:'Mirror Ray',anchor:'Lattice Beacon',bulwark:'Crystal Fan',quickstep:'Serein Skater',sapper:'Shardcaster',mender:'Annealing Heart'},
    materials:['smoked crystal','mirror membrane','liquid light','faceted cartilage'],
    adaptations:['thermal prism fins','magnetic facets','radiation mirrors','vibration-sensing lattice'],
    prefixes:['Prism','Serein','Shard','Lens','Gleam'],suffixes:['star','wake','ray','eye','skip']
  },
  tideworn:{
    name:'The Tideworn',rule:'Shed',
    archetypes:ALL_ARCHETYPES,
    bodies:['colonial swimmer','pressure whale','crown jelly','ribbon eel','moon-mirror jelly','jelly bell','mantle wall','siphon crawler','urchin mortar','brood current'],
    roleBodies:{chaff:['colonial swimmer'],bruiser:['pressure whale'],warden:['crown jelly'],cleanser:['ribbon eel'],reflector:['moon-mirror jelly'],anchor:['jelly bell'],bulwark:['mantle wall'],quickstep:['siphon crawler'],sapper:['urchin mortar'],mender:['brood current']},
    typeNames:{chaff:'Drift Fry',bruiser:'Pressure Whale',warden:'Crown Jelly',cleanser:'Ribbon Eel',reflector:'Moonmirror Medusa',anchor:'Bell Mother',bulwark:'Mantle Wall',quickstep:'Siphon Skimmer',sapper:'Urchin Mortar',mender:'Brood Current'},
    materials:['pearl membrane','water-filled cartilage','cilia','pressure sacs'],
    adaptations:['pressure sacs','antifreeze cilia','electrosensory ribbon','sealed water mantle'],
    prefixes:['Current','Silt','Bell','Brine','Ribbon'],suffixes:['skipper','mouth','mother','fin','coil']
  },
  tannhul:{
    name:'The Tannhul Herds',rule:'Formation',
    archetypes:ALL_ARCHETYPES,
    ecology:'A migratory multispecies caravan linked by shared gravity-resonance. Tannhul is a covenant, not a species.',
    bodies:['rolling trilobite swarm','six-legged rookback grazer','coiled ring-serpent','broad dustwing symbiote','radial mica arachnid','rooted living menhir','walking escarpment colony','spring-legged flintstrider','three-footed seismic mortar','salve-bearing stone snail'],
    roleBodies:{chaff:['rolling trilobite swarm'],bruiser:['six-legged rookback grazer'],warden:['coiled ring-serpent'],cleanser:['broad dustwing symbiote'],reflector:['radial mica arachnid'],anchor:['rooted living menhir'],bulwark:['walking escarpment colony'],quickstep:['spring-legged flintstrider'],sapper:['three-footed seismic mortar'],mender:['salve-bearing stone snail']},
    typeNames:{chaff:'Screelets',bruiser:'Crag Grazer',warden:'Cairncoil',cleanser:'Dustwing',reflector:'Mica Crown',anchor:'Herdstone',bulwark:'Walking Escarpment',quickstep:'Flintstrider',sapper:'Faultdrum',mender:'Salveback'},
    materials:['stone hide','iron bristles','mineral horn','magnetic cilia','mica sail','basalt root'],
    adaptations:['heat-sink horns','magnetic cilia','gravity-braced spine','radiation-storing hide','resonant ballast organs','seismic song chambers'],
    prefixes:['Rook','Flint','Crag','Iron','Pebble'],suffixes:['back','calf','grazer','tread','hide']
  },
  custodian:{
    name:'The Custodian Array',rule:'Protocol',
    archetypes:ALL_ARCHETYPES,
    bodies:['maintenance tripod','cargo quadruped','vault orb','sterilizer centipede','mirror satellite','walking command spire','folding wall-crawler','rail hound','survey mortar','repair shepherd'],
    roleBodies:{chaff:['maintenance tripod'],bruiser:['cargo quadruped'],warden:['vault orb'],cleanser:['sterilizer centipede'],reflector:['mirror satellite'],anchor:['walking command spire'],bulwark:['folding wall-crawler'],quickstep:['rail hound'],sapper:['survey mortar'],mender:['repair shepherd']},
    typeNames:{chaff:'Maintenance Mite',bruiser:'Cargo Frame',warden:'Vault Orb',cleanser:'Sterilizer',reflector:'Mirror Satellite',anchor:'Command Spire',bulwark:'Folding Wall',quickstep:'Rail Hound',sapper:'Survey Mortar',mender:'Repair Shepherd'},
    materials:['oxidized cobalt shell','exposed copper mechanism','pale ceramic sensor','vermilion maintenance mark'],
    adaptations:['vacuum-rated seals','radiation-hardened optics','magnetic stabilizers','thermal reclamation fins'],
    prefixes:['Custodian','Survey','Vault','Protocol','Archive'],suffixes:['Unit','Frame','Mite','Engine','Array']
  },
  redaction:{
    name:'The Redaction',rule:'Omission',
    archetypes:ALL_ARCHETYPES,
    bodies:['discarded footnote','misremembered heavy','incomplete composite','borrowed quadruped','negative-space radial','silent directive','margin wall','misremembered flyer','deleted terrain','kindly revision'],
    roleBodies:{chaff:['discarded footnote'],bruiser:['misremembered heavy'],warden:['incomplete composite'],cleanser:['borrowed quadruped'],reflector:['negative-space radial'],anchor:['silent directive'],bulwark:['margin wall'],quickstep:['misremembered flyer'],sapper:['deleted terrain'],mender:['kindly revision']},
    typeNames:{chaff:'Discarded Footnote',bruiser:'Borrowed Heavy',warden:'Incomplete Composite',cleanser:'Borrowed Ablution',reflector:'Negative-Space Radial',anchor:'Silent Directive',bulwark:'Margin Wall',quickstep:'Misremembered Flyer',sapper:'Deleted Terrain',mender:'Kindly Revision'},
    materials:['missing colour','unresolved edge','stolen anatomy','displaced shadow'],
    adaptations:['an adaptation nobody remembers','a borrowed response','an omitted sense','a repeated absence'],
    prefixes:['Absent','Kindly','Unsaid','Last','White'],suffixes:['Voice','Gesture','Outline','Revision','Witness']
  }
};

// Authored catalogue plates for every valid faction/role pairing. Runtime
// specimens can vary in name, material, adaptation, and Null stage while the
// portrait preserves an immediately readable combat silhouette.
const ARCHETYPE_PORTRAITS={
  ossuary:{
    chaff:'../assets/factions/ossuary-chaff-v3.png',bruiser:'../assets/factions/ossuary-bruiser-v2.png',
    warden:'../assets/factions/ossuary-warden-v3.png',cleanser:'../assets/factions/ossuary-cleanser-v2.png',
    reflector:'../assets/factions/ossuary-reflector-v2.png',anchor:'../assets/factions/ossuary-anchor-v2.png',
    bulwark:'../assets/factions/ossuary-bulwark-v2.png',quickstep:'../assets/factions/ossuary-quickstep-v2.png',
    sapper:'../assets/factions/ossuary-sapper-v2.png',mender:'../assets/factions/ossuary-mender-v2.png'
  },
  mycelial:{
    chaff:'../assets/factions/mycelial-chaff-v2.png',bruiser:'../assets/factions/mycelial-bruiser-v2.png',
    warden:'../assets/factions/mycelial-warden-v2.png',cleanser:'../assets/factions/mycelial-cleanser-v2.png',
    anchor:'../assets/factions/mycelial-anchor-v2.png',reflector:'../assets/factions/mycelial-reflector-v2.png',
    bulwark:'../assets/factions/mycelial-bulwark-v2.png',quickstep:'../assets/factions/mycelial-quickstep-v2.png',
    sapper:'../assets/factions/mycelial-sapper-v2.png',mender:'../assets/factions/mycelial-mender-v2.png'
  },
  glasswake:{
    chaff:'../assets/factions/glasswake-chaff-v1.png',bruiser:'../assets/factions/glasswake-bruiser-v1.png',
    warden:'../assets/factions/glasswake-warden-v1.png',reflector:'../assets/factions/glasswake-reflector-v1.png',
    cleanser:'../assets/factions/glasswake-cleanser-v1.png',anchor:'../assets/factions/glasswake-anchor-v1.png',
    bulwark:'../assets/factions/glasswake-bulwark-v1.png',quickstep:'../assets/factions/glasswake-quickstep-v1.png',
    sapper:'../assets/factions/glasswake-sapper-v1.png',mender:'../assets/factions/glasswake-mender-v1.png'
  },
  tideworn:{
    chaff:'../assets/factions/tideworn-chaff-v1.png',bruiser:'../assets/factions/tideworn-bruiser-v1.png',
    cleanser:'../assets/factions/tideworn-cleanser-v1.png',reflector:'../assets/factions/tideworn-reflector-v1.png',
    warden:'../assets/factions/tideworn-warden-v1.png',anchor:'../assets/factions/tideworn-anchor-v1.png',
    bulwark:'../assets/factions/tideworn-bulwark-v1.png',quickstep:'../assets/factions/tideworn-quickstep-v1.png',
    sapper:'../assets/factions/tideworn-sapper-v1.png',mender:'../assets/factions/tideworn-mender-v1.png'
  },
  tannhul:{
    chaff:'../assets/factions/tannhul-chaff-v2.png',bruiser:'../assets/factions/tannhul-bruiser-v1.png',
    warden:'../assets/factions/tannhul-warden-v2.png',anchor:'../assets/factions/tannhul-anchor-v2.png',
    cleanser:'../assets/factions/tannhul-cleanser-v2.png',reflector:'../assets/factions/tannhul-reflector-v2.png',
    bulwark:'../assets/factions/tannhul-bulwark-v2.png',quickstep:'../assets/factions/tannhul-quickstep-v2.png',
    sapper:'../assets/factions/tannhul-sapper-v3.png',mender:'../assets/factions/tannhul-mender-v2.png'
  },
  custodian:{
    chaff:'../assets/factions/custodian-chaff-v1.png',bruiser:'../assets/factions/custodian-bruiser-v1.png',
    warden:'../assets/factions/custodian-warden-v1.png',cleanser:'../assets/factions/custodian-cleanser-v1.png',
    reflector:'../assets/factions/custodian-reflector-v1.png',anchor:'../assets/factions/custodian-anchor-v1.png',
    bulwark:'../assets/factions/custodian-bulwark-v1.png',quickstep:'../assets/factions/custodian-quickstep-v1.png',
    sapper:'../assets/factions/custodian-sapper-v1.png',mender:'../assets/factions/custodian-mender-v1.png'
  },
  redaction:{
    chaff:'../assets/factions/redaction-chaff-v1.png',bruiser:'../assets/factions/redaction-bruiser-v1.png',warden:'../assets/factions/redaction-warden-v1.png',cleanser:'../assets/factions/redaction-cleanser-v1.png',
    reflector:'../assets/factions/redaction-reflector-v1.png',anchor:'../assets/factions/redaction-anchor-v1.png',
    bulwark:'../assets/factions/redaction-bulwark-v1.png',quickstep:'../assets/factions/redaction-quickstep-v1.png',
    sapper:'../assets/factions/redaction-sapper-v1.png',mender:'../assets/factions/redaction-mender-v1.png'
  }
};

// Runtime consumers use one normalized type record. The legacy arrays above
// remain compact to read, while these helpers make future additions atomic:
// one call updates the generator, lore gallery, tests, and derived asset cache.
function refreshFactionTypes(factionId){
  const faction=FACTIONS[factionId];
  if(!faction)return;
  faction.types=Object.fromEntries(faction.archetypes.map(archetype=>[
    archetype,
    {
      archetype,
      name:faction.typeNames[archetype],
      body:(faction.roleBodies[archetype]||faction.bodies)[0],
      portrait:ARCHETYPE_PORTRAITS[factionId]?.[archetype],
      palette:faction.typePalettes?.[archetype]||null
    }
  ]));
}

function registerArchetype(id,definition){
  if(!id||!definition?.label)throw new Error('Enemy archetypes require an id and label');
  ARCHETYPES[id]={...definition};
  return ARCHETYPES[id];
}

function registerEnemyType(factionId,archetype,{name,body,portrait,palette=null}){
  const faction=FACTIONS[factionId];
  if(!faction)throw new Error(`Unknown faction: ${factionId}`);
  if(!ARCHETYPES[archetype])throw new Error(`Unknown archetype: ${archetype}`);
  if(!name||!body||!portrait)throw new Error(`${factionId}/${archetype} requires name, body, and portrait`);
  if(!faction.archetypes.includes(archetype))faction.archetypes.push(archetype);
  faction.roleBodies[archetype]=[body];
  faction.typeNames[archetype]=name;
  if(!faction.bodies.includes(body))faction.bodies.push(body);
  if(palette){faction.typePalettes=faction.typePalettes||{};faction.typePalettes[archetype]=palette}
  ARCHETYPE_PORTRAITS[factionId]=ARCHETYPE_PORTRAITS[factionId]||{};
  ARCHETYPE_PORTRAITS[factionId][archetype]=portrait;
  refreshFactionTypes(factionId);
  return faction.types[archetype];
}

function registerFaction(id,{types,...definition}){
  if(!id||!definition.name||!definition.rule)throw new Error('Enemy factions require id, name, and rule');
  if(!types||!Object.keys(types).length)throw new Error(`${id} requires at least one enemy type`);
  FACTIONS[id]={
    materials:['unclassified material'],adaptations:['local adaptation'],
    prefixes:[definition.name.replace(/^The\s+/,'').split(/\s+/)[0]],suffixes:['Specimen'],
    ...definition,archetypes:[],bodies:[],roleBodies:{},typeNames:{}
  };
  ARCHETYPE_PORTRAITS[id]={};
  for(const [archetype,type] of Object.entries(types))registerEnemyType(id,archetype,type);
  return FACTIONS[id];
}

Object.keys(FACTIONS).forEach(refreshFactionTypes);

// Summoners initially reuse each faction's command-organ artwork.
registerArchetype('summoner',{label:'Summoner',cue:'brood chamber or assembly nest',problem:'enemy reinforcements'});
const summonerNames={ossuary:'Brood Reliquary',mycelial:'Spore Nursery',glasswake:'Prism Loom',tideworn:'Tide Hatchery',tannhul:'Ember Broodmother',custodian:'Assembly Nest',redaction:'Echo Nursery'};
Object.entries(summonerNames).forEach(([faction,name])=>registerEnemyType(faction,'summoner',{
  name,body:FACTIONS[faction].roleBodies.anchor[0],portrait:ARCHETYPE_PORTRAITS[faction].anchor
}));

// Behavior variants reuse an existing silhouette until dedicated plates are authored.
const traitVariants={
  venom:['Venom carrier','cleanser','stacking poison'],hexer:['Hexer','reflector','skill surcharge'],
  leech:['Aether leech','reflector','stored shared Aether'],saboteur:['Saboteur','sapper','delayed bomb'],
  duelist:['Duelist','quickstep','marked-target pressure'],brood:['Brood host','anchor','offspring on defeat'],
  channeler:['Channeler','warden','interruptible charged attack'],scorcher:['Scorcher','sapper','short burn'],
  bloodletter:['Bloodletter','quickstep','bleed on attacking turns']
};
Object.entries(traitVariants).forEach(([role,[label,base,problem]])=>{
  registerArchetype(role,{label,cue:ARCHETYPES[base].cue,problem});
  Object.keys(FACTIONS).forEach(faction=>registerEnemyType(faction,role,{
    name:FACTIONS[faction].typeNames[base]+' · '+label,
    body:FACTIONS[faction].roleBodies[base][0],portrait:ARCHETYPE_PORTRAITS[faction][base]
  }));
});

const NULL_STAGES=[
  {id:'clear',weight:5,symptoms:['none']},
  {id:'touched',weight:42,symptoms:['repeated motion','wrong shadow','faded colour','compulsive route']},
  {id:'hollowed',weight:38,symptoms:['negative-space wound','missing reflection','borrowed voice','duplicated organ']},
  {id:'redacted',weight:15,symptoms:['incomplete outline','erased joint','several incompatible shadows','memory echo']}
];

const HEROES={
  cathedral:{name:'The Cathedral That Walks',faction:'ossuary',archetype:'warden',portrait:'../assets/factions/ossuary-cathedral-v1.png',summary:'A reef-born shell colossus whose living core is buried beneath ritual layers of stolen bone.',cleanse:'Open seven shell layers without breaking the living core.'},
  ninefold:{name:'The Ninefold Mother',faction:'mycelial',archetype:'anchor',portrait:'../assets/factions/mycelial-ninefold-v1.png',summary:'Nine fruiting bodies share one frightened mind through a choir of Null-tangled hyphae.',cleanse:'Stabilize all nine bodies in the same action cycle.'},
  serein:{name:'Serein-of-Seven-Facets',faction:'glasswake',archetype:'reflector',portrait:'../assets/factions/glasswake-serein-v1.png',summary:'A mirror ray that remembers starlight incorrectly and returns every violent pattern it sees.',cleanse:'Return its remembered light-pattern instead of overpowering it.'},
  bell:{name:'The Bell Below',faction:'tideworn',archetype:'cleanser',portrait:'../assets/factions/tideworn-bell-v1.png',summary:'An ancient colonial swimmer whose fourth note carries the corruption through an entire tide.',cleanse:'Interrupt the false fourth note without silencing the first three.'},
  rookback:{name:'Old Rookback',faction:'tannhul',archetype:'bruiser',portrait:'../assets/factions/tannhul-rookback-v1.png',summary:'A gravity-braced herd elder driven against the calves it once protected.',cleanse:'Protect the calves while separating corruption from the herd bond.'},
  curator:{name:'CURATOR // LAST INSTRUCTION',faction:'custodian',archetype:'anchor',portrait:'../assets/factions/custodian-curator-v1.png',summary:'A survey machine preserving a dead command so perfectly that it can no longer recognize life.',cleanse:'Present three living catalogue revisions as proof that change is not data loss.'},
  kindlyVoice:{name:'The Kindly Voice',faction:'redaction',archetype:'anchor',portrait:'../assets/factions/redaction-kindly-voice-v1.png',summary:'A courteous absence that edits bodies, memories, and even the rules used to oppose it.',cleanse:'Survive a conversation that removes one combat rule after every answer.'}
};

const PLANET_FORMS=['reef moon','ocean world','high-gravity super-earth','glass desert','cloud archipelago','tidally locked garden','wandering rogue world'];
const BIOMES=['flooded reef vaults','mineral forest','spore plain','hanging ocean','crystal littoral','living canyon','storm canopy','subglacial bloom'];
const ADAPTATIONS=['magnetic feet','pressure sacs','radiation mirrors','vacuum-sealing membranes','heat-sink antlers','resonance bladders','photosynthetic sails','distributed senses'];
const WORLD_RULES=['low gravity advances displaced units','dense spores copy the oldest condition','magnetic storms rotate target priority','tidal surges exchange front and back ranks','glass dust amplifies repeated elements','living terrain shelters the slowest unit'];

function hashSeed(value){
  const text=String(value);let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}
  return hash>>>0;
}

function rngFrom(seed){
  let state=hashSeed(seed)||0x9e3779b9;
  const next=function(){state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
  // Adjacent string seeds can produce nearby FNV states. Warming the xorshift
  // prevents sequential specimen ids from inheriting visibly correlated rolls.
  for(let i=0;i<8;i++)next();
  return next;
}

function pick(rng,list){return list[Math.floor(rng()*list.length)]}
function takeDistinct(rng,list,count){
  const pool=[...list],result=[];
  while(pool.length&&result.length<count)result.push(pool.splice(Math.floor(rng()*pool.length),1)[0]);
  return result;
}
function weightedPick(rng,list){
  const total=list.reduce((sum,item)=>sum+item.weight,0);let roll=rng()*total;
  for(const item of list){roll-=item.weight;if(roll<=0)return item}
  return list[list.length-1];
}

function specimenName(rng,faction){return `${pick(rng,faction.prefixes)}${pick(rng,faction.suffixes)}`}

function generateEnemy(seed,context={}){
  const rng=rngFrom(seed);
  const factionId=context.faction&&FACTIONS[context.faction]?context.faction:pick(rng,Object.keys(FACTIONS).filter(id=>id!=='redaction'));
  const faction=FACTIONS[factionId];
  const archetype=context.archetype&&faction.archetypes.includes(context.archetype)?context.archetype:pick(rng,faction.archetypes);
  const combatStages=NULL_STAGES.filter(item=>item.id!=='clear');
  const stage=context.nullStage||(factionId==='redaction'?'redacted':weightedPick(rng,combatStages).id);
  const stageData=NULL_STAGES.find(item=>item.id===stage)||NULL_STAGES[0];
  return {
    id:`${factionId}-${archetype}-${hashSeed(seed).toString(36)}`,
    seed:String(seed),name:specimenName(rng,faction),faction:factionId,factionName:faction.name,
    archetype,archetypeName:ARCHETYPES[archetype].label,typeName:faction.typeNames[archetype],element:context.element||pick(rng,ELEMENTS),
    bodyPlan:pick(rng,faction.roleBodies[archetype]||faction.bodies),material:pick(rng,faction.materials),
    adaptation:pick(rng,faction.adaptations),environmentalPressure:context.environmentalPressure||null,nullStage:stage,
    portrait:ARCHETYPE_PORTRAITS[factionId][archetype],
    nullSymptom:stage==='clear'?'none':pick(rng,stageData.symptoms),
    silhouetteCue:ARCHETYPES[archetype].cue,combatProblem:ARCHETYPES[archetype].problem,
    factionRule:faction.rule
  };
}

function generatePlanet(seed){
  const rng=rngFrom(`planet:${seed}`);
  const factionPool=Object.keys(FACTIONS).filter(id=>id!=='redaction');
  const nativeFactions=takeDistinct(rng,factionPool,1+Math.floor(rng()*3));
  const syllablesA=['Aru','Bel','Cas','Ise','Khe','Mae','Or','Rano','Sen','Tan','Vey'];
  const syllablesB=['dun','lia','neth','ora','ren','sai','thal','une','vek','wyn'];
  const name=`${pick(rng,syllablesA)}${pick(rng,syllablesB)} ${2+Math.floor(rng()*8)}`;
  const nullDistance=['distant','approaching','present at the fringe','active'][Math.floor(rng()*4)];
  return {
    id:`planet-${hashSeed(seed).toString(36)}`,seed:String(seed),name,
    form:pick(rng,PLANET_FORMS),gravity:Number((0.35+rng()*2.25).toFixed(2)),
    biomes:takeDistinct(rng,BIOMES,2+Math.floor(rng()*2)),nativeFactions,
    elementTendency:takeDistinct(rng,ELEMENTS,2),adaptationPressure:pick(rng,ADAPTATIONS),
    worldRule:pick(rng,WORLD_RULES),nullDistance
  };
}

function generateEncounter(seed,planet,options={}){
  const rng=rngFrom(`encounter:${seed}`);
  const count=options.count||4;
  const factionId=options.faction||pick(rng,planet.nativeFactions);
  const faction=FACTIONS[factionId];
  const roleDeck=[];
  while(roleDeck.length<count)roleDeck.push(...takeDistinct(rng,faction.archetypes,faction.archetypes.length));
  return Array.from({length:count},(_,index)=>generateEnemy(`${seed}:${index}`,{
    faction:factionId,
    archetype:roleDeck[index],
    environmentalPressure:planet.adaptationPressure,
    element:index<planet.elementTendency.length?planet.elementTendency[index]:undefined,
    nullStage:options.nullStage
  }));
}

const EnemyCatalogue={ELEMENTS,ARCHETYPES,FACTIONS,ARCHETYPE_PORTRAITS,NULL_STAGES,HEROES,registerArchetype,registerEnemyType,registerFaction,generateEnemy,generatePlanet,generateEncounter};
if(typeof module!=='undefined'&&module.exports)module.exports=EnemyCatalogue;
if(typeof window!=='undefined')window.SpacologyEnemyCatalogue=EnemyCatalogue;
if(typeof globalThis!=='undefined')globalThis.SpacologyEnemyCatalogue=EnemyCatalogue;

})();
