(function(){
'use strict';
const Rules=SpacologyExpedition, Crew=SpacologyCrew, Field=SpacologyField;

let newVoyageSettings={};
try{newVoyageSettings=JSON.parse(localStorage.getItem('spacologyPlaytestConfigV010'))}catch(_){}
newVoyageSettings=SpacologyVoyageSettings.normalize(newVoyageSettings);
const starterCrew=['Tarn','Stella','Quill','Maul','Bosk','Coda','Morrow','Spore'];
function shuffled(values){const copy=[...values];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
const starterFront=shuffled(['Tarn','Stella','Bosk','Morrow'])[0];
const starterRoster=[starterFront,...shuffled(starterCrew.filter(name=>name!==starterFront)).slice(0,2)];
const runState={
  schema:4,round:1,maxRounds:6,gold:42,integrity:newVoyageSettings.initialIntegrity,level:1,fieldXP:0,capacity:4,shipSlots:1,
  difficulty:newVoyageSettings.difficulty,initialIntegrity:newVoyageSettings.initialIntegrity,lastStand:true,downRecovery:null,
  field:Array(5).fill(null),support:Array(7).fill(null),reserve:starterRoster,gear:[],shipInventory:[],shipEquipped:[],
  inbox:[],inboxSeen:0,attunements:{},duplicatePolicy:'ask',modifiers:[],modifierChoices:[],modifierRemovalUsed:false,
  goal:'survey',goalProgress:0,goalClaimed:false,goalLocked:false,recruitedRound:0,crewUpgrades:{},pack:null,
  aetherModes:{},aetherPriority:null,aetherOvercharge:{},
  equipped:{},scrap:0,crystals:0,rarePity:0,selected:null,drag:null,
  openedThisRound:false,battlesWon:0,observations:0,packRefreshes:0,
  packOffers:['rot','tempo','bulwark']
};
if(SpacologyStore.weavers){
  Object.assign(runState,{level:5,capacity:6,field:['Daven','Hanae','Arunima',null,null],support:['Ivara','Roonie','Veska',null,null,null,null],reserve:[],aetherModes:{Hanae:'auto'},aetherOvercharge:{Arunima:true},packOffers:['survey','order','frontier']});
  document.querySelector('.title-copy .eyebrow').textContent='AETHER WEAVERS · SEPARATE TEST VOYAGE';
  document.querySelector('.title-copy p').textContent='Six Weavers are deployed and ready. Hanae gathers, Ivara stores, Arunima spends, Roonie tunes, Veska heals, and Daven protects. This voyage has its own save.';
}
try{const saved=JSON.parse(localStorage.getItem(SpacologyStore.run));if(saved?.schema===runState.schema)Object.assign(runState,saved,SpacologyVoyageSettings.normalize(saved),{selected:null,drag:null})}catch(_){}
Field.normalize(runState);
const formationChanges=SpacologyFormation.normalize(runState);
const voyageDifficulty=SpacologyVoyageSettings.difficulties[runState.difficulty];
document.querySelector('.run-meta > span').textContent=`${voyageDifficulty.label} · ${Math.round(voyageDifficulty.enemyScale*100)}% enemy health / damage · ${Math.round(voyageDifficulty.enemySpeed*100)}% speed`;
const difficultyButton=document.querySelector('[data-info="modifiers"]');
difficultyButton.textContent=voyageDifficulty.label;
difficultyButton.setAttribute('aria-label',`Difficulty: ${voyageDifficulty.label}`);
difficultyButton.style.width='auto';
difficultyButton.onclick=()=>showVoyageSettings();

const crewFallback={
  Ledger:['Assay · Order','Surveyor','Marks specimens and exposes weak points.'],
  Vitre:['Assay · Chaos','Surveyor','Turns unstable readings into area damage.'],
  Coda:['Follow-up · Energy','Relay','Charges allies whenever a follow-up lands.'],
  Latch:['Tempo · Order','Relay','Advances the next allied action.'],
  Morrow:['Ailment · Decay','Seeder','Plants persistent decay on specimens.'],
  Spore:['Ailment · Growth','Seeder','Spreads ailments when a specimen acts.']
};

const battleStats={
  Tarn:{hp:132,dmg:11,speed:7,color:'#8ebddd'},Ash:{hp:96,dmg:19,speed:10,color:'#dc7d8f'},
  Quill:{hp:88,dmg:15,speed:12,color:'#aa97dc'},Maul:{hp:118,dmg:13,speed:8,color:'#8ebddd'},
  Bosk:{hp:112,dmg:20,speed:6,color:'#dc7d8f'},Coda:{hp:86,dmg:15,speed:13,color:'#e9b45e'},
  Morrow:{hp:92,dmg:14,speed:9,color:'#b69a74'},Spore:{hp:98,dmg:12,speed:10,color:'#70d5b2'},
  Ledger:{hp:90,dmg:15,speed:11,color:'#8ebddd'},Vitre:{hp:90,dmg:18,speed:9,color:'#aa97dc'},
  Latch:{hp:86,dmg:14,speed:14,color:'#70d5b2'}
};

const crewKits={
  "Tarn": {
    "role": "Protection and retaliation",
    "basic": [
      "Direct attack",
      "Deals damage to a chosen specimen."
    ],
    "skill": [
      "Recoil",
      "Retaliatory ultimate that scales with damage taken."
    ],
    "passive": [
      "Anchor",
      "High enemy target priority and reactive return damage."
    ],
    "plan": "Hull improves barriers. Ordnance increases team damage. Pair with healing so Tarn can remain on field."
  },
  "Ash": {
    "role": "Area ailment seeder",
    "basic": [
      "Reagent mist",
      "Area attack with 2 ailment stacks and extra guard pressure."
    ],
    "skill": [
      "Scatterfall",
      "Area ultimate with 3\u00d7 attack damage and 2 additional stacks."
    ],
    "passive": [
      "Blight specialist",
      "Contributes to Blight 2 / 4; has no separate break-triggered follow-up."
    ],
    "plan": "Use multiple Blight crew to increase applications and unlock periodic blooms."
  },
  "Quill": {
    "role": "Specimen marker",
    "basic": [
      "Mark specimen",
      "Attacks and applies 3 marks to expose the target."
    ],
    "skill": [
      "Full Survey",
      "Area ultimate with 2.2\u00d7 attack damage and 3 survey marks."
    ],
    "passive": [
      "Assay / Blight",
      "Contributes to both department thresholds."
    ],
    "plan": "Combine with break pressure and reactive attackers such as Maul."
  },
  "Maul": {
    "role": "Break responder",
    "basic": [
      "Heavy strike",
      "Direct damage with a preference for sturdy targets."
    ],
    "skill": [
      "Deadweight",
      "Single-target ultimate with 3\u00d7 attack damage."
    ],
    "passive": [
      "Break response",
      "Reacts to an enemy break with a 2.2\u00d7 attack follow-up."
    ],
    "plan": "Other crew create breaks; Maul turns them into damage from the support row."
  },
  "Bosk": {
    "role": "Heavy attacker",
    "basic": [
      "Heavy strike",
      "High base attack; acts more slowly than lighter crew."
    ],
    "skill": [
      "Deadfall",
      "Single-target ultimate with 3\u00d7 attack damage."
    ],
    "passive": [
      "Hull / Ordnance",
      "Contributes to barrier and damage thresholds."
    ],
    "plan": "Use speed gear to bring the heavy attack forward, or ultimate gear for a larger burst."
  },
  "Coda": {
    "role": "Energy support",
    "basic": [
      "Kindle",
      "Supports the crew\u2019s energy supply while contributing direct damage."
    ],
    "skill": [
      "Full Ahead",
      "Restores 14 health and grants 48 charge to allies."
    ],
    "passive": [
      "Drive / Crew",
      "Contributes to speed and healing thresholds."
    ],
    "plan": "Use with damage ultimates and another Drive or Crew character."
  },
  "Morrow": {
    "role": "Area ailment seeder",
    "basic": [
      "Seed",
      "Area attack with 2 stacks and extra guard pressure."
    ],
    "skill": [
      "Scatterfall",
      "Prototype ultimate: 3\u00d7 area attack damage and 2 stacks."
    ],
    "passive": [
      "Blight specialist",
      "Contributes to the Blight department thresholds."
    ],
    "plan": "Currently shares the seeder mechanics with Ash, with a Growth element."
  },
  "Spore": {
    "role": "Ailments and healing",
    "basic": [
      "Culture",
      "Applies 1 stack and supplies healing with overheal support."
    ],
    "skill": [
      "Bloomtide",
      "Restores 28 health and grants 18 barrier."
    ],
    "passive": [
      "Blight / Crew",
      "Contributes to applications and healing thresholds."
    ],
    "plan": "Support a front row that needs time to build and trigger ailments."
  },
  "Ledger": {
    "role": "Mark responder",
    "basic": [
      "Archive shot",
      "Direct attack that prefers finishing damaged specimens."
    ],
    "skill": [
      "Final Entry",
      "Single-target ultimate with 3.2\u00d7 attack damage."
    ],
    "passive": [
      "Mark response",
      "Reacts to marks with follow-up damage."
    ],
    "plan": "Pair with Quill for marks and Coda for the Drive threshold."
  }
};

const crewPositions={
  Tarn:'field',Ash:'both',Quill:'support',Maul:'support',
  Bosk:'field',Coda:'support',Morrow:'both',Spore:'support',
  Ledger:'both',Vitre:'field',Latch:'support'
};
const crewPortraits={
  Tarn:'../assets/crew/tarn-v1.webp',Ash:'../assets/crew/ash-v1.webp',
  Quill:'../assets/crew/quill-v1.webp',Maul:'../assets/crew/maul-v1.webp',
  Bosk:'../assets/crew/bosk-v1.webp',Coda:'../assets/crew/coda-v1.webp',
  Morrow:'../assets/crew/morrow-v1.webp',Spore:'../assets/crew/spore-v1.webp',Ledger:'../assets/lore/aurelio-bassi-v1.webp'
};
Object.entries(Rules.crew).forEach(([name,profile])=>{
  if(profile.stats)battleStats[name]={...profile.stats};
  if(profile.kit)crewKits[name]=profile.kit;
  if(profile.position)crewPositions[name]=profile.position;
  if(profile.portrait)crewPortraits[name]=profile.portrait;
});
const enemyPortraits={
  Chaff:'../assets/enemies/chaff-v1.webp',Bruiser:'../assets/enemies/bruiser-v1.webp',
  Warden:'../assets/enemies/warden-v1.webp',Cleanser:'../assets/enemies/cleanser-v1.webp',
  Reflector:'../assets/enemies/reflector-v1.webp',Anchor:'../assets/enemies/anchor-v1.webp',
  Bulwark:'../assets/enemies/bulwark-v1.webp',Quickstep:'../assets/enemies/quickstep-v1.webp'
};
const gearEffects={
  'Tuning Fork':'Ailment applications add 1 extra stack.','Spore Sling':'Ailment spread reaches 1 additional specimen.',
  'Ranging Sight':'Attacks also hit 1 additional specimen.','Loaded Die':'The wearer’s first attack deals 20% more damage.',
  'Recoil Spring':'Follow-up attacks deal 30% more damage.','Quick Latch':'The wearer begins battle 8 Action Value ahead.',
  'Ballast Plate':'Barriers are 30% larger.','Slow Fuse':'Ultimate attacks deal 25% more damage.',
  'Bore Bit':'Attacks deal 40% more guard damage.'
};
const shipEffects=Object.fromEntries(Object.entries(Rules.shipParts).map(([name,part])=>[name,part.effect]));

Rules.recipes.forEach(recipe=>gearEffects[recipe.name]=recipe.effect);

// Packs are cheap enough to be a recurring decision, while their automatic
// currency card softens rather than erases the price.
packs.rot.price=12;packs.rot.cards[0][1]='5 gold';
packs.order.price=14;packs.order.cards[0][1]='6 gold';packs.order.cards[6][1]='Maul';
packs.order.cards[3][2]='First attack deals +20%';packs.order.cards[4][2]='Crew begin with 20 Energy';
packs.tempo.price=13;packs.tempo.cards[0][1]='5 gold';packs.tempo.cards[6][1]='Stella';
packs.tempo.cards[3][2]='Wearer starts 8 AV ahead';
Object.assign(packs,{
  bulwark:{name:'Hull & Ordnance',price:13,theme:'Hull and heavy attacks',pool:'2–4 resources · 1–2 Gear · 0–1 ship item · 1–2 crew',cards:[['CURRENCY','5 gold','Offsets the pack cost','AUTO','var(--amber)'],['MATERIAL','Prism scrap ×4','Upgrade or forge Gear','AUTO','var(--green)'],['GEAR','Ballast Plate','Barriers gain +30%','Tarn fit','var(--violet)'],['GEAR','Slow Fuse','Ultimate damage +25%','Bosk fit','var(--violet)'],['SHIP','Brace Matrix','First incoming hit is reduced','Hull fit','var(--green)'],['CREW','Tarn','Hull · Decay','Front-line anchor','var(--blue)'],['CREW','Bosk','Ordnance · Decay','Heavy burst','var(--blue)']]},
  survey:{name:'Assay & Energy',price:12,theme:'Assay and Energy',pool:'2–4 resources · 1–2 Gear · 0–1 ship item · 1–2 crew',cards:[['CURRENCY','5 gold','Offsets the pack cost','AUTO','var(--amber)'],['MATERIAL','Relay scrap ×4','Upgrade or forge Gear','AUTO','var(--green)'],['GEAR','Ranging Sight','Attack reaches +1 target','Quill fit','var(--violet)'],['GEAR','Quick Latch','Wearer starts 8 AV ahead','Coda fit','var(--violet)'],['SHIP','Survey Prism','Observation gold +20%','Fieldwork fit','var(--green)'],['CREW','Quill','Follow-up · Assay','Off-field surveyor','var(--blue)'],['CREW','Coda','Follow-up · Energy','Charge relay','var(--blue)']]},
  frontier:{name:'Wild Culture',price:11,theme:'Growth and Decay',pool:'2–4 resources · 1–2 Gear · 0–1 ship item · 1–2 crew',cards:[['CURRENCY','4 gold','Offsets the pack cost','AUTO','var(--amber)'],['MATERIAL','Bloom crystal ×3','Crafting and attunements','AUTO','var(--green)'],['GEAR','Spore Sling','Spread reaches +1 target','Spore fit','var(--violet)'],['GEAR','Tuning Fork','Applications add +1 stack','Morrow fit','var(--violet)'],['SHIP','Culture Bed','Ailments persist +1 turn','Fieldwork fit','var(--green)'],['CREW','Morrow','Ailment · Decay','Persistent stacks','var(--blue)'],['CREW','Spore','Ailment · Growth','Wide spread','var(--blue)']]}
});
// Keep the expanded draft roster discoverable after removing direct recruitment.
const discoveryNames=new Set(Object.values(packs).flatMap(pack=>pack.cards.filter(card=>card[0]==='CREW').map(card=>card[1])));
Object.entries(Rules.crew).forEach(([name,profile])=>{
  if(discoveryNames.has(name))return;
  const key=({order:'order',chaos:'tempo',growth:'frontier',decay:'frontier',energy:'survey',void:'bulwark'})[profile.element]||'frontier';
  packs[key].cards.push(['CREW',name,profile.tags.join(' · '),profile.role||'Crew','var(--blue)']);
});
Object.values(packs).forEach(pack=>pack.cards.forEach(card=>{
  if(card[0]==='GEAR'&&gearEffects[card[1]])card[2]=gearEffects[card[1]];
  if(card[0]==='SHIP'&&shipEffects[card[1]])card[2]=shipEffects[card[1]];
}));

const $=id=>document.getElementById(id);
const board=document.querySelector('.board');
const inventoryHost=$('inventoryItems');
const battleView=$('battleView');
let inventoryTab='characters';
let battle=null;
let touchSuppressUntil=0;
const coarsePointer=matchMedia('(pointer:coarse)').matches;
let activeCards=[];
document.querySelector('.inv-hint').textContent='Tap for details. Hold briefly to move. Swipe to browse.';

function toastMessage(message){showToast(message);setTimeout(()=>toast.classList.remove('show'),2400)}
function crewInfo(name){const profile=Rules.crew[name],old=unitData[name]||crewFallback[name]||['Crew · Order','Specialist','A newly catalogued crew member.'];return profile?[profile.tags.join(' / ')+' · '+profile.element,profile.role||old[1],profile.summary||old[2]]:old}
function crewTone(name){const tag=crewInfo(name)[0];if(tag.includes('Hull'))return 'var(--blue)';if(tag.includes('Follow'))return 'var(--red)';if(tag.includes('Assay'))return 'var(--violet)';if(tag.includes('Growth'))return 'var(--green)';return 'var(--decay)'}
function deployed(){return [...runState.field,...runState.support].filter(Boolean)}
function crewPosition(name){return SpacologyFormation.position(name)}
function positionLabel(name){return crewPosition(name)==='field'?'FRONT ROW':crewPosition(name)==='support'?'BACK ROW':'EITHER ROW'}
function canPlace(name,row){return crewPosition(name)==='both'||crewPosition(name)===row}
function positionBadge(name){const position=crewPosition(name),kind=position==='field'?'front':position==='support'?'back':'both',label=positionLabel(name);return `<span class="position-badge ${kind}" title="${label}" aria-label="${label}"><i aria-hidden="true"></i><i aria-hidden="true"></i></span>`}
function portraitMarkup(name,className){const image=crewPortraits[name];return `<div class="${className}${image?' has-art':''}"${image?` style="background-image:url('${image}')"`:''}>${name[0]||''}</div>`}
function normalizeCrewPositions(){
  const seen=new Set(),reserve=[],pending=[];
  const normalizeRow=(values,row)=>{(values||[]).slice(Rules.rowSlots[row]).forEach(n=>{if(n)pending.push(n)});return Array.from({length:Rules.rowSlots[row]},(_,index)=>{
    const name=values?.[index];
    if(!name||seen.has(name))return null;
    if(!canPlace(name,row)){pending.push(name);return null}
    seen.add(name);return name;
  })};
  runState.field=normalizeRow(runState.field,'field');
  runState.support=normalizeRow(runState.support,'support');
  (runState.reserve||[]).forEach(name=>{if(name&&!seen.has(name)&&!reserve.includes(name)){seen.add(name);reserve.push(name)}});
  pending.forEach(name=>{if(name&&!seen.has(name)&&!reserve.includes(name)){seen.add(name);reserve.push(name)}});
  runState.reserve=reserve;
}
normalizeCrewPositions();
Crew.normalize(runState);
if(runState.duplicatePolicy==='scrap')runState.duplicatePolicy='sell';
if(!['ask','maxed','sell'].includes(runState.duplicatePolicy))runState.duplicatePolicy='maxed';
function displayedCrewStats(name){
  const base=battleStats[name]||{hp:92,dmg:15,speed:9},rank=runState.crewUpgrades[name]||0,names=deployed(),active=names.includes(name);
  const health=active?Rules.planetHealth(names):1,mods=Rules.effects(runState);
  const ordnance=active&&names.filter(n=>Rules.crew[n]?.tags.includes('Ordnance')).length>=2;
  const drive=active&&names.filter(n=>Rules.crew[n]?.tags.includes('Drive')).length>=2;
  return {...base,speed:Number((base.speed*(drive?1.12:1)).toFixed(2)),hp:Math.round(base.hp*Crew.bonuses(rank).hp*health),dmg:Math.round(Math.round(base.dmg*Crew.bonuses(rank).attack*(active?mods.crewDamage:1))*(ordnance?1.2:1))};
}
function rankProgress(name){
  const rank=Crew.rank(runState,name),total=Crew.total(runState,name);
  return Crew.stars(rank)+(rank===2?' · MAX':total>=9?' · ★★★ unlocks at field level 5':` · ${total}/${rank===0?3:9} copies`);
}
function receiveCrew(name,quiet=false){
  const result=Crew.receive(runState,name);
  if(result.error){if(!quiet)toastMessage(result.error);return false}
  Crew.apply(runState,result.state);return true;
}
function summonDetails(name){
  if(name!=='The Mage'||!Rules.summons)return '';
  return `<h3>J3K SUPPORT FIELD</h3><p>Each cast deploys one random missing unit. Summons remain together for the encounter and act independently without occupying crew slots. Once all three are present, another cast commands the waiting unit forward.</p><div class="recruit-grid">${Object.entries(Rules.summons).map(([id,summon])=>`<article class="modal-card"><div class="recruit-art" role="img" aria-label="${id} portrait" style="background-image:url('${summon.portrait}')"></div><h3>${id}</h3><p><strong>${summon.form}</strong> · ${summon.role}</p><p>${summon.effect}</p></article>`).join('')}</div>`;
}
function showCopyDetails(id){
  const copy=runState.crewCopies.find(c=>c.id===id);if(!copy)return;
  showModal(`<div class="crew-detail-header">${portraitMarkup(copy.name,'crew-detail-portrait')}<div><div class="eyebrow">RESERVE COPY</div><h2>${copy.name} · ${Crew.stars(copy.rank)}</h2><p>${rankProgress(copy.name)}</p></div></div><p>Three matching copies of the same rank combine automatically. This copy occupies one reserve slot. Only one ${copy.name} can be deployed at a time; their equipped gear stays with them through a merge.</p><div class="modal-actions"><button data-copy-sell="${id}">SELL · +${Crew.saleValue(copy.rank)} GOLD</button></div>`);
}
function aetherDetails(name){
  const p=SpacologyAether.profile(name),mode=(runState.aetherModes||{})[name]||'auto';
  const role=Rules.crew[name]?.weaver?'Aether Weaver · '+Rules.crew[name].weaver:p.role?({gatherer:'Aether Weaver · basics generate 2 charges.',reservoir:'Aether Weaver · adds 2 shared capacity while alive.',conduit:'Aether Weaver · can overcharge skills for extra damage.'})[p.role]:'';
  return `<section class="crew-aether"><h3>Basic +${p.gain} Aether · Skill ${SpacologyAether.skillLabel(name)}</h3><p>${Rules.crew[name]?.weaver?'See the four kit descriptions above for exact effects.':'Basic: one light attack (75% attack), with one stack or mark if this kit applies them. Skill: the full attack or support action. Direct damage skills deal 150% attack.'} Ultimates use individual charge.</p>${role?`<p>${role} Adds 1 shared capacity while deployed${p.capacityBonus?`, plus ${p.capacityBonus} from their capacity passive`:''}.</p>`:''}<details><summary>Aether use</summary><div class="modal-actions">${[['auto','Auto'],['build','Build charges'],['priority','Save for this skill']].map(([id,label])=>`<button data-aether-mode="${id}" data-aether-crew="${name}" aria-pressed="${id==='priority'?runState.aetherPriority===name:runState.aetherPriority!==name&&mode===id}">${label}</button>`).join('')}</div>${p.role==='conduit'?`<button data-aether-overcharge="${name}" aria-pressed="${SpacologyAether.overchargeEnabled(runState,name)}">${p.spendAll?'Full burst · spend available Aether, +100% attack per extra charge':'Overcharge · +1 cost, +35% skill damage'}</button>`:''}<small>Auto saves for a burst Weaver and avoids wasting big attacks on low-health enemies; a manual priority overrides it. Urgent recovery, Aether refills and useful burst setup can go first. After the burst, teammates get a spending window. Full burst is on by default for Arunima.</small></details></section>`;
}
function characterDetails(name,location){
  const info=crewInfo(name),stats=displayedCrewStats(name),kit=crewKits[name]||{role:info[1],basic:['Basic attack','Deals damage to one specimen.'],skill:['Special action',info[2]],passive:['Field trait','Supports the crew through its listed Harmonies.'],plan:info[2]};
  const gear=(runState.equipped[name]||[]).filter(Boolean);
  const lastAction=location==='inventory'?`<button class="sell-action" data-sell-character="${name}">SELL · +${Crew.saleValue(Crew.rank(runState,name))} GOLD</button>`:location==='formation'?`<button data-return="${name}">RETURN TO INVENTORY</button><button class="sell-action" data-sell-character="${name}">SELL · +${Crew.saleValue(Crew.rank(runState,name))} GOLD</button>`:'';
  return `<div class="crew-detail-header"><div role="img" aria-label="${name} portrait">${portraitMarkup(name,'crew-detail-portrait')}</div><div><div class="eyebrow">CHARACTER · ${info[0]}</div><h2>${name}</h2><p class="crew-origin">${Rules.crew[name]?`${Rules.crew[name].species} · ancestry: ${Rules.crew[name].planet} · birthplace: ${Rules.crew[name].birthplace}`:''}</p><p class="lede"><strong>${kit.role||info[1]}</strong> · ${positionLabel(name)} · ${SpacologyFormation.labels[SpacologyFormation.roles[name]]||'Hybrid'}</p><p class="crew-rank">${rankProgress(name)}</p></div></div><div class="kit-stats"><div><span>HEALTH</span><b>${stats.hp}</b></div><div><span>ATTACK</span><b>${stats.dmg}</b></div><div><span>SPEED</span><b>${stats.speed}</b></div><div><span>POSITION</span><b>${positionLabel(name)}</b></div><div><span>GEAR</span><b>${gear.length} / 2</b></div></div><div class="kit-grid">${kit.attack?`<div class="kit-move"><label>BASIC · +${SpacologyAether.profile(name).gain} AETHER</label><b>${kit.attack[0]}</b><p>${kit.attack[1]}</p></div>`:''}<div class="kit-move"><label>SKILL · ${SpacologyAether.skillLabel(name)} AETHER</label><b>${kit.basic[0]}</b><p>${kit.basic[1]}</p></div><div class="kit-move"><label>ULTIMATE</label><b>${kit.skill[0]}</b><p>${kit.skill[1]}</p></div><div class="kit-move"><label>PASSIVE</label><b>${kit.passive[0]}</b><p>${kit.passive[1]}</p></div></div><div class="build-note"><strong>HOW TO USE:</strong> ${kit.plan}</div>${aetherDetails(name)}${Rules.crew[name]?.lore?`<details class="crew-lore"><summary>About ${Rules.crew[name].fullName}</summary>${Rules.crew[name].lore.map(p=>`<p>${p}</p>`).join('')}</details>`:''}${summonDetails(name)}${ownedCard(['CREW',name])&&location!=='pack'&&location!=='preview'?characterGearDetails(name):''}<div class="modal-actions"><button data-place="field" data-name="${name}" ${canPlace(name,'field')?'':'disabled'}>MOVE TO FRONT</button><button data-place="support" data-name="${name}" ${canPlace(name,'support')?'':'disabled'}>MOVE TO BACK</button>${lastAction}${ownedCard(['CREW',name])&&location!=='pack'&&location!=='preview'?`<button data-view-upgrade="${name}">GET COPY · 2 CRYSTALS</button>`:''}</div>`;
}

function characterGearDetails(name){
  return `<h3>Equipped gear</h3><div class="character-gear">${[0,1].map(index=>{const item=runState.equipped[name]?.[index];return `<article class="modal-card"><small>SLOT ${index+1}</small><h3>${item?`<button class="gear-name-button" data-inspect-gear="${item}" data-source-owner="${name}" data-source-index="${index}">${item}</button>`:'Empty'}</h3><p>${item?gearEffects[item]:'No gear equipped.'}</p>${item?`<button data-unequip-gear="${name}" data-gear-slot="${index}" data-gear-name="${item}">REMOVE TO INVENTORY</button>`:''}</article>`}).join('')}</div>`;
}
function unequipGear(name,index,expected){
  if(!ownedCard(['CREW',name])||![0,1].includes(index))return;
  const item=runState.equipped[name]?.[index];if(!item||item!==expected)return;
  runState.equipped[name][index]=null;
  runState.gear.push(item);
  renderOps();showModal(characterDetails(name,runState.reserve.includes(name)?'inventory':'formation'));toastMessage(item+' returned to inventory');
}
function unitMarkup(name,row,slotIndex){
  const info=crewInfo(name),gear=runState.equipped[name]||[];
  return `<article class="unit" draggable="true" data-unit="${name}" data-source-row="${row}" data-slot-index="${slotIndex}" style="--tone:${crewTone(name)}">${positionBadge(name)}${portraitMarkup(name,'portrait')}<b>${name}</b><span>${Crew.stars(Crew.rank(runState,name))} · ${info[0]}</span><div class="gear-slots">${[0,1].map(i=>`<button class="drop-zone gear-slot ${gear[i]?'':'empty'}" data-gear-owner="${name}" data-gear-index="${i}" aria-label="${gear[i]?'Inspect '+gear[i]:'Empty gear slot '+(i+1)} on ${name}">${gear[i]?'◆':'◇'}</button>`).join('')}</div></article>`;
}

function renderFormation(){
  const rows=board.querySelectorAll('.crew-row');
  [['field',runState.field,'FRONT','DPS · tanks'],['support',runState.support,'BACK','acts · safe']].forEach((def,index)=>{
    const [key,list,label,note]=def;
    const placed=list.filter(Boolean).length;
    rows[index].innerHTML=`<div class="row-label"><b>${label}</b><span>${placed} placed</span>${note}</div>`+
      Array.from({length:Rules.rowSlots[key]},(_,slotIndex)=>list[slotIndex]
        ?unitMarkup(list[slotIndex],key,slotIndex)
        :`<button class="slot drop-zone" data-row="${key}" data-slot-index="${slotIndex}">DROP OR<br>PLACE CREW</button>`).join('');
  });
  $('capacityCount').textContent=`${deployed().length} / ${runState.capacity}`;
  const cap=document.querySelector('.field-level');
  cap.querySelector('b').textContent=`FIELD LEVEL ${runState.level}`;
  const maxed=Field.maxed(runState),needed=Field.required(runState);
  cap.querySelector('span').textContent=maxed?'All field upgrades unlocked':`${runState.fieldXP} / ${needed} XP · Next: ${runState.level%2?`${runState.capacity+1} crew`:`${runState.shipSlots+1} ship slots`}`;
  const meter=$('fieldXP');meter.max=needed;meter.value=maxed?needed:runState.fieldXP;
  meter.setAttribute('aria-label',maxed?'Field fully upgraded':`Field XP: ${runState.fieldXP} of ${needed}`);
  $('fieldXPHelp').textContent=maxed?'Maximum field level':`Wins +${Field.winXP} XP`;
  $('levelField').textContent=maxed?'MAX LEVEL':`+${Field.purchaseXP} XP · ${Field.purchaseCost}g`;
  $('levelField').disabled=maxed||runState.gold<Field.purchaseCost||!!runState.end||runState.round>runState.maxRounds;
  $('levelField').title=`Buy ${Field.purchaseXP} field XP for ${Field.purchaseCost} gold. Wins grant ${Field.winXP} XP. Unspent XP carries into the next level.`;
}

function inventoryEntries(type){
  if(type==='characters')return runState.reserve.map(n=>[n,crewInfo(n)[0]]);
  if(type==='gear')return [...new Set(runState.gear)].map(n=>[n,gearEffects[n]||'Improves one crew member while equipped.',runState.gear.filter(x=>x===n).length]);
  if(type==='ship')return [...new Set(runState.shipInventory)].map(n=>[n,shipEffects[n]||'Changes the rules for the whole expedition.',runState.shipInventory.filter(x=>x===n).length]);
  return [['Prism scrap',runState.scrap,'Craft basic gear for 6 scrap or combine advanced gear for 8 scrap.'],['Bloom crystal',runState.crystals,'Create a copy of owned crew, or craft specialized gear and ship equipment.']];
}

renderInventory=function(type){
  inventoryTab=type;
  document.querySelector('.inv-top b').innerHTML=`Inventory<small class="reserve-count">RESERVES · ${Crew.slots(runState)} / ${Crew.RESERVE_LIMIT}${Crew.slots(runState)>6?' · OVERFLOW':''}</small>`;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===type));
  if(type==='materials'){inventoryHost.innerHTML=inventoryEntries(type).map(([name,n,desc])=>`<button class="material-counter" data-material="${name}" draggable="${name==='Bloom crystal'&&n>0}"><span>${name}</span><b>×${n}</b><small>${desc}</small></button>`).join('');return}
  inventoryHost.innerHTML=inventoryEntries(type).map((x,i)=>`<article class="item ${type==='characters'?'character':type==='gear'?'drop-zone':''}" ${type==='gear'?`data-combine-with="${x[0]}"`:''} draggable="${type!=='materials'}" data-item="${x[0]}" data-type="${type}">${type==='characters'?positionBadge(x[0]):`<span class="lock">${i===0?'◆':''}</span>`}<span class="qty">${type==='characters'?Crew.stars(Crew.rank(runState,x[0])):'×'+x[2]}</span>${type==='characters'?portraitMarkup(x[0],'item-icon'):'<div class="item-icon"></div>'}<b>${x[0]}</b><span>${x[1]}</span></article>`).join('');
  if(type==='characters'){
    inventoryHost.innerHTML+=runState.crewCopies.map(c=>`<article class="item character crew-copy" data-copy-id="${c.id}" data-item="${c.name}" data-type="characters"><span class="qty">${Crew.stars(c.rank)} COPY</span>${portraitMarkup(c.name,'item-icon')}<b>${c.name}</b><span>Combines automatically</span></article>`).join('');
    inventoryHost.innerHTML+=Array.from({length:Math.max(0,6-Crew.slots(runState))},()=>'<div class="reserve-empty">EMPTY<br>RESERVE</div>').join('');
  }

};

function renderShip(){
  const ship=document.querySelector('.ship');
  const equippedCount=Array.from({length:runState.shipSlots},(_,i)=>runState.shipEquipped[i]).filter(Boolean).length;
  ship.innerHTML=`<div class="ship-head"><div><div class="eyebrow">VESSEL</div><b>Ship equipment</b></div><span>${equippedCount} / ${runState.shipSlots}</span></div>`+
    Array.from({length:runState.shipSlots},(_,i)=>{const name=runState.shipEquipped[i];return name
      ?`<article class="ship-slot drop-zone" data-ship-index="${i}"><div class="ship-icon">◫</div><b>${name}</b><span>${shipEffects[name]||'Expedition-wide effect active.'}</span></article>`
      :`<button class="ship-slot empty drop-zone" data-ship-index="${i}">DROP SHIP ITEM</button>`}).join('')+
    `<div class="ship-note">Drag ship equipment here. Character Gear goes on the two diamonds on each crew card.</div>`;
}

function renderOps(){
  $('gold').textContent=runState.gold;
  document.querySelector('.stat.integrity b').textContent=`${runState.integrity}%`;
  document.querySelector('.room span').textContent=`VOYAGE ${String(runState.round).padStart(2,'0')} · PHOMOUS`;
  document.querySelector('.run-meta b').textContent=`ROUND ${runState.round} · CONTAINMENT`;
  renderFormation();renderShip();renderInventory(inventoryTab);renderExpedition();if(activePack)renderPack();
  runState.pack=activePack?{key:activePack,cards:activeCards,resolved:resolved}:null;
  localStorage.setItem(SpacologyStore.run,JSON.stringify(runState));
}

function rollPackOffers(previous=[]){
  const pool=Object.keys(packs).sort(()=>Math.random()-.5);
  const fresh=pool.filter(key=>!previous.includes(key));
  return [...fresh,...pool].filter((key,index,list)=>list.indexOf(key)===index).slice(0,3);
}
function randomCard(pool){return pool[Math.floor(Math.random()*pool.length)]}
function rollPackCards(key){
  const source=packs[key].cards;
  const material=Math.random()<.08?['MATERIAL','Bloom crystal ×1','Targeted copies or special crafting','AUTO','var(--green)']:['MATERIAL','Prism scrap ×4','Gear crafting','AUTO','var(--green)'];
  const cards=[source[0].slice(),material];
  const schema=['GEAR','GEAR','SHIP','CREW','CREW'];
  const globalPool=[];
  Object.values(packs).forEach(pack=>pack.cards.forEach(card=>{
    if(!globalPool.some(entry=>entry[0]===card[0]&&entry[1]===card[1]))globalPool.push(card);
  }));
  schema.forEach(type=>{
    const themed=source.filter(card=>card[0]===type);
    const all=globalPool.filter(card=>card[0]===type);
    const unused=pool=>pool.filter(card=>!cards.some(chosen=>chosen[0]===card[0]&&chosen[1]===card[1]));
    const preferred=Math.random()<.65?unused(themed):[];
    const choice=randomCard(preferred.length?preferred:(unused(all).length?unused(all):all));
    cards.push(choice.slice());
  });
  if(Math.random()<.16){const index=2+Math.floor(Math.random()*(cards.length-2));cards[index][5]=true}
  return cards;
}
function renderPackOffers(){
  if(!Array.isArray(runState.packOffers)||runState.packOffers.length!==3)runState.packOffers=rollPackOffers();
  runState.packOffers=runState.packOffers.map(key=>packs[key]?key:null);
  const refreshCost=2+(runState.packRefreshes||0)*2;
  packSelect.innerHTML=runState.packOffers.map(key=>{if(!key)return '<article class="pack sold-offer"><h3>Sold out</h3><p>Refresh for a new offer.</p></article>';const p=packs[key];return `<article class="pack"><span class="kind">${p.theme.toUpperCase()}</span><b class="price">${packPrice(key)}g</b><h3>${p.name}</h3><p>${p.theme}. Sealed contents vary by offer.</p><span class="odds">65% themed · 16% Prime</span><div class="pack-actions"><button data-preview="${key}">PREVIEW</button><button class="open" data-open="${key}">BUY & OPEN</button></div></article>`}).join('')+`<aside class="stock-note"><b>Supply offers</b><span>One pack per offer. Refresh replaces all three.</span><button id="refreshPacks">REFRESH · ${refreshCost}g</button><button data-duplicate-settings>OWNED CREW · ${runState.duplicatePolicy.toUpperCase()}</button></aside>`;
}
function refreshPackOffers(){
  if(activePack){toastMessage('Resolve the current pack first');return}
  const cost=2+(runState.packRefreshes||0)*2;
  if(runState.gold<cost){toastMessage('Not enough gold to refresh packs');return}
  runState.gold-=cost;runState.packRefreshes=(runState.packRefreshes||0)+1;
  runState.packOffers=rollPackOffers(runState.packOffers);renderPackOffers();renderOps();toastMessage('New sealed packs delivered');
}
packSelect.addEventListener('click',e=>{const preview=e.target.closest('[data-preview]');if(preview){previewPack(preview.dataset.preview);return}const open=e.target.closest('[data-open]');if(open){openPack(open.dataset.open);return}if(e.target.closest('#refreshPacks'))refreshPackOffers()});

function removeCrew(name){
  runState.field=runState.field.map(n=>n===name?null:n);
  runState.support=runState.support.map(n=>n===name?null:n);
  runState.reserve=runState.reserve.filter(n=>n!==name);
}
function placeCrew(name,row,slotIndex){
  if(!crewInfo(name))return false;
  if(!canPlace(name,row)){toastMessage(`${name} is ${positionLabel(name).toLowerCase()}`);return false}
  if(slotIndex===undefined||Number.isNaN(slotIndex))slotIndex=runState[row].findIndex(n=>!n);
  if(!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>=Rules.rowSlots[row]){toastMessage(`No open ${row==='field'?'on-field':'off-field'} slot`);return false}
  const displaced=runState[row][slotIndex];
  const already=deployed().includes(name);
  const needed=Crew.slots(runState)-(runState.reserve.includes(name)?1:0)+(displaced&&displaced!==name?1:0);
  if(needed>6&&needed>=Crew.slots(runState)){toastMessage('Reserve full · cannot displace this character');return false}
  if(!already&&!displaced&&deployed().length>=runState.capacity){toastMessage(`Team capacity ${runState.capacity} reached`);return false}
  removeCrew(name);
  if(displaced&&displaced!==name){removeCrew(displaced);runState.reserve.push(displaced)}
  runState[row][slotIndex]=name;
  renderOps();toastMessage(`${name} placed ${row==='field'?'on field':'off field'}`);return true;
}
function returnCrew(name){
  if(runState.reserve.includes(name))return true;
  if(!deployed().includes(name))return false;
  if(Crew.slots(runState)>=6){toastMessage('Reserve full · sell or deploy a reserve first');return false}
  removeCrew(name);runState.reserve.push(name);renderOps();toastMessage(`${name} returned to inventory`);return true;
}
// A pack supplies a new copy; inventory actions consume exactly one stored copy.
function equipGear(name,gear,index,fromPack=false){
  if(!ownedCard(['CREW',name])||!gearEffects[gear])return false;
  const items=runState.equipped[name]||[];
  if(index===undefined||Number.isNaN(index))index=[0,1].find(i=>!items[i]);
  if(![0,1].includes(index)){toastMessage(`${name} has no empty Gear slots`);return false}
  const loose=runState.gear.indexOf(gear);
  if(!fromPack&&loose<0)return false;
  const replaced=items[index];
  if(!fromPack)runState.gear.splice(loose,1);
  if(replaced)runState.gear.push(replaced);
  items[index]=gear;runState.equipped[name]=items;
  renderOps();toastMessage(replaced?`${gear} replaced ${replaced}`:`${gear} equipped to ${name} · slot ${index+1}`);return true;
}
function equipShip(name,index,fromPack=false){
  if(!Rules.shipParts[name])return false;
  if(!Number.isInteger(index)||index<0||index>=runState.shipSlots){toastMessage('Upgrade the field to unlock this ship slot');return false}
  const loose=runState.shipInventory.indexOf(name);
  if(!fromPack&&loose<0)return false;
  const replaced=runState.shipEquipped[index];
  if(!fromPack)runState.shipInventory.splice(loose,1);
  if(replaced)runState.shipInventory.push(replaced);
  runState.shipEquipped[index]=name;renderOps();toastMessage(`${name} equipped to the ship`);return true;
}

function showShip(name,slot=null){
  const part=Rules.shipParts[name];if(!part)return;
  const equipped=Number.isInteger(slot)&&runState.shipEquipped[slot]===name;
  const owned=equipped||runState.shipInventory.includes(name);
  const empty=Array.from({length:runState.shipSlots},(_,i)=>i).find(i=>!runState.shipEquipped[i]);
  const source=equipped?String(slot):'inventory';
  let actions='';
  if(equipped)actions=`<button data-ship-unequip="${name}" data-ship-slot="${slot}">UNEQUIP</button>`;
  else if(owned)actions=empty!==undefined?`<button data-ship-equip="${name}" data-ship-slot="${empty}">QUICK EQUIP · SLOT ${empty+1}</button>`:Array.from({length:runState.shipSlots},(_,i)=>`<button data-ship-equip="${name}" data-ship-slot="${i}">REPLACE ${runState.shipEquipped[i]} · SLOT ${i+1}</button>`).join('');
  showModal(`<div class="eyebrow">SHIP · ${equipped?'EQUIPPED IN SLOT '+(slot+1):'INVENTORY'}</div><h2>${name}</h2><p class="lede">${part.effect}</p><div class="modal-actions">${actions}</div>${part.upgrade?`<h3>Upgrade to ${part.upgrade}</h3><p>${Rules.shipParts[part.upgrade].effect}</p><p>Uses this part and 8 scrap.${equipped?' Upgrades in its current slot.':''}</p><button data-ship-upgrade="${name}" data-ship-source="${source}" ${!owned||runState.scrap<8?'disabled':''}>UPGRADE · 8 SCRAP</button>`:'<p>Fully upgraded.</p>'}${owned?`<div class="modal-actions"><button data-ship-scrap="${name}" data-ship-source="${source}">DISMANTLE · +4 SCRAP</button></div>`:''}`);
}
function shipSource(name,source){
  if(source==='inventory'){const index=runState.shipInventory.indexOf(name);return index>=0?{list:runState.shipInventory,index,equipped:false}:null}
  const index=Number(source);return Number.isInteger(index)&&index>=0&&index<runState.shipSlots&&runState.shipEquipped[index]===name?{list:runState.shipEquipped,index,equipped:true}:null;
}

function payloadFrom(el){
  if(el.matches('[data-material="Bloom crystal"]'))return {kind:'crystal',from:'inventory'};
  if(el.matches('[data-forge-input]'))return {kind:'gear',name:el.dataset.forgeInput,from:'forge'};
  if(el.matches('.unit'))return {kind:'crew',name:el.dataset.unit,from:'formation'};
  if(el.matches('.item'))return {kind:el.dataset.type==='characters'?'crew':el.dataset.type,name:el.dataset.item,from:'inventory'};
  if(el.matches('.reward-card')){const i=Number(el.dataset.card),card=activeCards[i];return {kind:card[0].toLowerCase(),name:card[1],from:'pack',index:i}}
  return null;
}
document.addEventListener('dragstart',e=>{const source=e.target.closest('[draggable="true"]');if(!source)return;if(coarsePointer){e.preventDefault();return}runState.drag=payloadFrom(source);if(runState.drag)e.dataTransfer.setData('text/plain',JSON.stringify(runState.drag));});
document.addEventListener('dragover',e=>{const zone=e.target.closest('.drop-zone,.inventory,.unit,.item.character,.pack-action-drop');if(!zone)return;e.preventDefault();zone.classList.add('drag-over')});
document.addEventListener('dragleave',e=>{const zone=e.target.closest('.drag-over');if(zone)zone.classList.remove('drag-over')});
document.addEventListener('drop',e=>{const zone=e.target.closest('.drop-zone,.inventory,.unit,.item.character,.pack-action-drop');if(!zone)return;e.preventDefault();document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));let data=runState.drag;try{data=JSON.parse(e.dataTransfer.getData('text/plain'))||data}catch(_){}handleDrop(data,zone);runState.drag=null});

let touchDrag=null;
document.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse')return;
  if(e.target.closest('.reward-actions'))return;
  const source=e.target.closest('[draggable="true"]');if(!source)return;
  const scrollHost=source.closest('.inv-items,.pack-cards');
  touchDrag={source,payload:payloadFrom(source),startX:e.clientX,startY:e.clientY,startScrollY:window.scrollY,scrollHost,startScrollX:scrollHost?.scrollLeft||0,scrolling:null,active:false,armed:false,ghost:null,zone:null,pointerId:e.pointerId,armTimer:null};
  touchDrag.armTimer=setTimeout(()=>{if(touchDrag&&touchDrag.pointerId===e.pointerId){touchDrag.armed=true;source.classList.add('drag-ready')}},180);
  try{source.setPointerCapture?.(e.pointerId)}catch(_){}
},{passive:true});
document.addEventListener('pointermove',e=>{
  if(!touchDrag||e.pointerId!==touchDrag.pointerId)return;
  const dx=e.clientX-touchDrag.startX,dy=e.clientY-touchDrag.startY;
  const distance=Math.hypot(dx,dy);
  if(!touchDrag.armed&&distance>=8&&!touchDrag.scrolling){clearTimeout(touchDrag.armTimer);touchDrag.source.classList.remove('drag-ready');touchDrag.scrolling=touchDrag.scrollHost&&Math.abs(dx)>Math.abs(dy)?'inventory':'page'}
  if(touchDrag.scrolling){e.preventDefault();if(touchDrag.scrolling==='inventory')touchDrag.scrollHost.scrollLeft=touchDrag.startScrollX-dx;else window.scrollTo(0,touchDrag.startScrollY-dy);return}
  if(!touchDrag.armed||distance<12)return;
  if(!touchDrag.active){touchDrag.active=true;touchDrag.ghost=touchDrag.source.cloneNode(true);Object.assign(touchDrag.ghost.style,{position:'fixed',zIndex:'300',width:`${touchDrag.source.getBoundingClientRect().width}px`,opacity:'.86',pointerEvents:'none',transform:'scale(.94)',boxShadow:'0 14px 40px #000'});document.body.appendChild(touchDrag.ghost)}
  e.preventDefault();touchDrag.ghost.style.left=`${e.clientX+12}px`;touchDrag.ghost.style.top=`${e.clientY+12}px`;
  document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
  touchDrag.zone=document.elementFromPoint(e.clientX,e.clientY)?.closest('.drop-zone,.inventory,.unit,.item.character,.pack-action-drop')||null;
  touchDrag.zone?.classList.add('drag-over');
},{passive:false});
function finishTouchDrag(e){
  if(!touchDrag||e.pointerId!==touchDrag.pointerId)return;
  clearTimeout(touchDrag.armTimer);touchDrag.source.classList.remove('drag-ready');
  if(touchDrag.scrolling){e.preventDefault();touchSuppressUntil=Date.now()+400}
  if(touchDrag.active){e.preventDefault();touchSuppressUntil=Date.now()+400;if(e.type!=='pointercancel'&&touchDrag.zone)handleDrop(touchDrag.payload,touchDrag.zone)}
  touchDrag.ghost?.remove();document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));touchDrag=null;
}
document.addEventListener('pointerup',finishTouchDrag,{passive:false});
document.addEventListener('pointercancel',finishTouchDrag,{passive:false});

function handleDrop(data,zone){
  if(!data)return;
  if(data.from==='forge'){if(zone.dataset.forgeInput||zone.dataset.combineWith)previewRecipe(data.name,zone.dataset.forgeInput||zone.dataset.combineWith);return}
  if(data.kind==='crystal'){const owner=zone.dataset.gearOwner||zone.dataset.unit||(zone.dataset.type==='characters'?zone.dataset.item:null);if(owner&&ownedCard(['CREW',owner]))showCrewUpgrades(owner);return}
  if(zone.matches('.item.character'))zone=zone.closest('.inventory')||zone;
  if(zone.dataset.combineWith){if(data.from==='inventory'&&data.kind==='gear')previewRecipe(data.name,zone.dataset.combineWith);return}
  if(zone.dataset.forgeInput){if(data.from==='inventory'&&data.kind==='gear')previewRecipe(data.name,zone.dataset.forgeInput);return}
  if(data.kind==='crew'&&zone.dataset.gearOwner)zone=zone.closest('.unit')||zone;
  if(zone.dataset.packAction){if(data.from==='pack')resolveCard(data.index,zone.dataset.packAction);return}
  const row=zone.dataset.row||(zone.closest('.crew-row')?.querySelector('.row-label b')?.textContent.startsWith('ON')?'field':'support');
  if(data.kind==='crew'&&(zone.dataset.row||zone.classList.contains('slot')||zone.classList.contains('unit'))){const move=()=>placeCrew(data.name,zone.dataset.row||zone.dataset.sourceRow||row,Number(zone.dataset.slotIndex));if(data.from==='pack')resolveCard(data.index,'field',move);else move();return}
  if(data.kind==='gear'&&zone.dataset.gearOwner){const equip=()=>equipGear(zone.dataset.gearOwner,data.name,Number(zone.dataset.gearIndex),data.from==='pack');if(data.from==='pack')resolveCard(data.index,'equipped',equip);else equip();return}
  if(data.kind==='ship'&&zone.dataset.shipIndex!==undefined){const equip=()=>equipShip(data.name,Number(zone.dataset.shipIndex),data.from==='pack');if(data.from==='pack')resolveCard(data.index,'equipped',equip);else equip();return}
  if(zone.classList.contains('inventory')){if(data.from==='formation')returnCrew(data.name);else if(data.from==='pack')resolveCard(data.index,'inventory');return}
  if(zone.classList.contains('unit')&&data.kind==='gear'){const equip=()=>equipGear(zone.dataset.unit,data.name,undefined,data.from==='pack');if(data.from==='pack')resolveCard(data.index,'equipped',equip);else equip()}
}

document.addEventListener('click',e=>{
  if(Date.now()<touchSuppressUntil){e.preventDefault();e.stopImmediatePropagation();return}
  const gearSlot=e.target.closest('[data-gear-owner]');
  if(gearSlot){const item=runState.equipped[gearSlot.dataset.gearOwner]?.[Number(gearSlot.dataset.gearIndex)];if(item){showGear(item,{name:item,owner:gearSlot.dataset.gearOwner,index:Number(gearSlot.dataset.gearIndex)});return}}
  const shipSlot=e.target.closest('[data-ship-index]');if(shipSlot){const index=Number(shipSlot.dataset.shipIndex),name=runState.shipEquipped[index];if(name)showShip(name,index);else showModal('<h2>Equip a ship part</h2><div class="modal-actions">'+[...new Set(runState.shipInventory)].map(n=>`<button data-ship-equip="${n}" data-ship-slot="${index}">${n}</button>`).join('')+'</div>');return}
  const unit=e.target.closest('.unit');
  if(unit){showModal(characterDetails(unit.dataset.unit,'formation'));return}
  const slot=e.target.closest('.slot');if(slot){showCrewPicker(slot.dataset.row,Number(slot.dataset.slotIndex));return}
},{capture:true});

function showCrewPicker(row,slotIndex){
  const choices=runState.reserve.map(n=>`<button data-place="${row}" data-slot-index="${slotIndex}" data-name="${n}" ${canPlace(n,row)?'':'disabled'}>${n}<small>${positionLabel(n)}</small></button>`).join('');
  showModal(`<div class="eyebrow">PLACE CREW · ${deployed().length} / ${runState.capacity}</div><h2>${row==='field'?'On field':'Off field'}</h2><p class="lede">Drag a crew card here or choose one below. Dimmed crew cannot use this position.</p><div class="modal-actions">${choices||'<span>No reserve crew available.</span>'}</div>`)
}
function returnEquippedGear(name){
  (runState.equipped[name]||[]).filter(Boolean).forEach(gear=>runState.gear.push(gear));
  delete runState.equipped[name];
}
modalBody.addEventListener('click',e=>{const place=e.target.closest('[data-place]');if(place){if(placeCrew(place.dataset.name,place.dataset.place,Number(place.dataset.slotIndex)))overlay.classList.remove('open');return}const ret=e.target.closest('[data-return]');if(ret){if(returnCrew(ret.dataset.return))overlay.classList.remove('open');return}const sell=e.target.closest('[data-sell-character]');if(sell){const name=sell.dataset.sellCharacter;if(Crew.owned(runState,name)){returnEquippedGear(name);const value=Crew.saleValue(Crew.rank(runState,name));Crew.disposeMain(runState,name);if(runState.aetherPriority===name)runState.aetherPriority=null;runState.gold+=value;renderOps();toastMessage(`${name} sold for ${value} gold`)}overlay.classList.remove('open');return}});
inventoryHost.onclick=e=>{const item=e.target.closest('[data-item]');if(!item)return;const name=item.dataset.item,type=item.dataset.type;if(type==='characters')showModal(characterDetails(name,'inventory'));else if(type==='gear')showGear(name);else if(type==='ship')showShip(name);else{const effect=type==='gear'?(gearEffects[name]||'Improves one crew member while equipped.'):type==='ship'?(shipEffects[name]||'Changes the rules for the whole expedition.'):`${name} is used for crafting and upgrades.`;showModal(`<div class="eyebrow">${type.toUpperCase()}</div><h2>${name}</h2><p class="lede">${effect}</p>${['gear','ship'].includes(type)?`<div class="modal-actions"><button data-dismantle-item="${name}" data-item-type="${type}">DISMANTLE · +4 SCRAP</button></div>`:''}`)}};

function installPackTargets(){
  if($('takeAll'))return;
  const panel=document.querySelector('.resolve-panel');
  panel.insertAdjacentHTML('beforeend',`<div class="pack-drop-actions"><button class="take-all pack-action-drop" id="takeAll" data-pack-action="inventory">TAKE ALL REMAINING</button></div>`);
  $('takeAll').onclick=takeAll;
}
function packPrice(key){return packs[key].price+Rules.effects(runState).packCost}
function closePack(){activePack=null;activeCards=[];resolved=[];selectedIndex=-1;runState.pack=null;openedPack.classList.add('hidden');packSelect.classList.remove('hidden');renderPackOffers();renderOps()}
openPack=function(key){
  if(activePack){toastMessage('Resolve the current pack first');return}
  const offer=runState.packOffers.indexOf(key);
  if(!packs[key]||offer<0){toastMessage('That offer is sold out. Refresh for new packs.');return}
  const price=packPrice(key);if(runState.gold<price){toastMessage('Not enough gold');return}
  runState.packOffers[offer]=null;
  runState.gold-=price;runState.openedThisRound=true;activePack=key;activeCards=rollPackCards(key);selectedIndex=-1;resolved=activeCards.map((_,index)=>index<2);
  activeCards.slice(0,2).forEach(card=>{const amount=parseInt(card[1].match(/\d+/)?.[0]||'1');if(card[0]==='CURRENCY')runState.gold+=amount;else if(card[0]==='MATERIAL'&&/crystal/i.test(card[1]))runState.crystals+=amount;else if(card[0]==='MATERIAL')runState.scrap+=amount});
  if(runState.duplicatePolicy!=='ask')activeCards.forEach((card,i)=>{if(i>1&&card[0]==='CREW'&&((runState.duplicatePolicy==='maxed'&&Crew.rank(runState,card[1])===2)||(runState.duplicatePolicy!=='maxed'&&ownedCard(card))))resolveCard(i,'dispose',null,true)});
  packSelect.classList.add('hidden');openedPack.classList.remove('hidden');renderPack();renderOps();
};
renderPack=function(){
  if(!activePack)return;
  $('openPackName').textContent=packs[activePack].name;
  document.querySelector('.open-summary p').innerHTML=activeCards.slice(0,2).map(c=>`<span class="receipt">✓ ${c[1]} credited</span>`).join('');
  packCards.innerHTML=activeCards.slice(2).map((c,index)=>{const i=index+2;return `<article class="reward-card ${c[0]==='CREW'?'has-position has-portrait':''} ${resolved[i]?'resolved':''} ${c[5]?'prime':''}" draggable="${!resolved[i]}" style="--tone:${c[4]}" data-card="${i}" data-resolution="${resolved[i]?'RESOLVED':''}"><button class="reward-select" data-card-select="${i}" aria-label="View ${c[1]} details">${c[0]==='CREW'?positionBadge(c[1])+portraitMarkup(c[1],'reward-portrait'):'<div class="reward-symbol">'+(c[0]==='GEAR'?'◈':'▣')+'</div>'}<span class="type">${c[5]?'PRIME · ':''}${c[0]}${ownedCard(c)?' · OWNED':''}</span><b>${c[1]}</b><span class="reward-effect">${c[0]==='CREW'?(ownedCard(c)?rankProgress(c[1]):crewInfo(c[1])[0]):c[2]}</span></button>${!resolved[i]?`<div class="reward-actions"><button data-card-action="inventory" data-card-index="${i}">KEEP</button><button data-card-action="dispose" data-card-index="${i}">${disposalLabel(c)}</button></div>`:''}</article>`}).join('');
  const left=resolved.filter((x,i)=>!x&&i>1).length;$('resolveCount').textContent=`${left} cards remaining`;finishPack.disabled=left>0;
  const returns=activeCards.reduce((sum,c,i)=>{if(i>1&&!resolved[i]){const value=disposalReturn(c);sum.gold+=value.gold;sum.scrap+=value.scrap}return sum},{gold:0,scrap:0});
  $('disposeRemaining').textContent='DISPOSE REMAINING'+(left?' · '+[returns.gold?returns.gold+'g':'',returns.scrap?returns.scrap+' scrap':''].filter(Boolean).join(' + '):'');$('disposeRemaining').disabled=!left;
  $('selectedCard').textContent='Keep adds to inventory';$('selectedDesc').textContent='Copies use reserve slots and merge automatically. Make room to keep blocked cards.';
};
function ownedCard(card){
  const [type,name]=card;
  if(type==='CREW')return runState.reserve.includes(name)||deployed().includes(name);
  if(type==='GEAR')return runState.gear.includes(name)||Object.values(runState.equipped).some(items=>(items||[]).includes(name));
  if(type==='SHIP')return runState.shipInventory.includes(name)||runState.shipEquipped.includes(name);
  return false;
}
function cardScrap(card){return ['GEAR','SHIP'].includes(card[0])?4:0}
function primeReturn(card){return !card[5]?{gold:0,scrap:0}:card[0]==='CREW'?{gold:1,scrap:0}:{gold:0,scrap:2}}
function disposalReturn(card){const bonus=primeReturn(card);return {gold:(card[0]==='CREW'?Crew.saleValue(0):0)+bonus.gold,scrap:cardScrap(card)+bonus.scrap}}
function disposalLabel(card){const value=disposalReturn(card);return card[0]==='CREW'?`SELL · ${value.gold}g`:`SCRAP · ${value.scrap}`}
function creditReturn(value){runState.gold+=value.gold;runState.scrap+=value.scrap}

function storeCard(card){
  const [type,name]=card;
  if(type==='CREW')runState.reserve.push(name);
  if(type==='GEAR')runState.gear.push(name);
  if(type==='SHIP')runState.shipInventory.push(name);
}
function resolveCard(index,action,perform,quiet=false){
  if(!activePack||!Number.isInteger(index)||index<2||index>=activeCards.length||resolved[index]||!['inventory','field','equipped','dispose'].includes(action))return false;
  const card=activeCards[index],duplicate=ownedCard(card);
  if((action==='equipped'||(action==='field'&&!duplicate))&&(!perform||perform()!==true))return false;
  if(card[0]==='CREW'&&(action==='inventory'||(action==='field'&&duplicate))){if(!receiveCrew(card[1],quiet))return false}
  else if(action==='inventory'){storeCard(card);if(!quiet)inventoryTab=card[0]==='GEAR'?'gear':'ship'}
  if(action==='dispose')creditReturn(disposalReturn(card));
  else creditReturn(primeReturn(card));
  resolved[index]=true;selectedIndex=-1;
  if(!quiet){if(resolved.every(Boolean))closePack();else{renderPack();renderOps()}toastMessage(`${card[1]} ${action==='dispose'?(card[0]==='CREW'?'sold':'dismantled'):card[0]==='CREW'?'kept · '+rankProgress(card[1]):action==='equipped'?'equipped':'kept in '+(card[0]==='GEAR'?'Gear':'Ship')+' inventory'}`)}
  return true;
}
function takeAll(){
  let changed=true;
  while(changed){changed=false;activeCards.forEach((_,i)=>{if(i>1&&!resolved[i]&&resolveCard(i,'inventory',null,true))changed=true});}
  selectedIndex=-1;
  if(resolved.every(Boolean)){closePack();toastMessage('All remaining cards kept')}
  else{renderOps();toastMessage('Some crew cannot fit · deploy or sell to make room. Your pack stays open.')}
}

function previewCard(index){
  const c=activeCards[index];if(!c||resolved[index])return;
  selectedIndex=index;
  const details=c[0]==='CREW'?characterDetails(c[1],'pack'):c[0]==='GEAR'?gearDetails(c[1],true):`<div class="eyebrow">${c[0]}${c[5]?' · PRIME':''}</div><h2>${c[1]}</h2><p class="lede">${c[2]}</p>`;
  showModal(details+`<p>${c[0]==='CREW'?'Keeping adds one copy. '+rankProgress(c[1])+'. '+(Crew.receive(runState,c[1]).error||'Room available after merges.'):'Keep adds one copy to inventory. Only Scrap dismantles this item.'}${c[5]?(c[0]==='CREW'?' Prime: +1 bonus gold on resolution.':' Prime: +2 bonus scrap on resolution.'):''}</p><div class="modal-actions"><button data-pack-modal="inventory" data-index="${index}">KEEP</button><button data-pack-modal="dispose" data-index="${index}">${disposalLabel(c)}</button></div>`);
  if(c[0]==='CREW')modalBody.querySelectorAll('[data-place],[data-return]').forEach(b=>b.remove());
}
packCards.onclick=e=>{const action=e.target.closest('[data-card-action]');if(action){resolveCard(Number(action.dataset.cardIndex),action.dataset.cardAction);return}const select=e.target.closest('[data-card-select]');if(select)previewCard(Number(select.dataset.cardSelect))};
resolveRemaining=function(){activeCards.forEach((_,i)=>{if(i>1&&!resolved[i])resolveCard(i,'dispose',null,true)});closePack();toastMessage('Remaining crew sold; equipment dismantled')};
finishPack.onclick=()=>{if(resolved.every(Boolean))closePack()};

function awardFieldXP(amount){
  const progress=Field.gain(runState,amount);
  if(progress.levels.length)[...new Set(Crew.names(runState))].forEach(n=>Crew.merge(runState,n));
  return progress;
}
$('levelField').onclick=()=>{
  const progress=Field.buy(runState);
  if(progress.error){toastMessage(progress.error);return}
  if(progress.levels.length)[...new Set(Crew.names(runState))].forEach(n=>Crew.merge(runState,n));
  renderOps();toastMessage(`+${progress.xp} field XP${progress.levels.length?' · Unlocked '+progress.levels.join(' · '):` · ${runState.fieldXP} / ${Field.required(runState)} to next level`}`);
};

function makeCombatant(unit,enemy){const image=enemy?enemyPortraits[unit.name]:crewPortraits[unit.name];return `<article class="combatant ${enemy?'enemy':''}${image?' has-art':''}" id="combat-${unit.id}"${image?` style="background-image:linear-gradient(180deg,rgba(4,8,12,.08),rgba(4,8,12,.82)),url('${image}')"`:''}><b>${unit.name}</b><span>${enemy?unit.kind:(unit.row==='field'?'ON FIELD':'OFF FIELD')}</span><div class="hp"><i style="width:100%"></i></div><span class="hp-label">${unit.hp} / ${unit.maxHp}</span></article>`}
function renderBattle(){
  $('battleRound').textContent=`${runState.round} / ${runState.maxRounds}`;$('battlePressure').textContent=`${Math.round(battle.pressure*100)}%`;$('battleIntegrity').textContent=`${runState.integrity}%`;
  $('enemyRank').innerHTML=battle.enemies.map(u=>makeCombatant(u,true)).join('');$('crewRank').innerHTML=battle.crew.map(u=>makeCombatant(u,false)).join('');
  [...battle.enemies,...battle.crew].forEach(u=>{const el=$(`combat-${u.id}`);if(!el)return;el.querySelector('.hp i').style.width=`${Math.max(0,u.hp/u.maxHp*100)}%`;el.querySelector('.hp-label').textContent=`${Math.max(0,u.hp)} / ${u.maxHp}`;el.classList.toggle('down',u.hp<=0)});
  const live=[...battle.crew.filter(u=>u.hp>0),...battle.enemies.filter(u=>u.hp>0)].sort((a,b)=>b.speed-a.speed).slice(0,6);
  $('turnQueue').innerHTML=live.map(u=>`<div class="queue-unit">${u.name}<br><span>${u.side==='crew'?'CREW':'SPECIMEN'} · ${u.speed} SP</span></div>`).join('');
  $('observationText').textContent=`${Math.min(2,battle.quickstepActions)} / 2 QUICKSTEP ACTIONS`;$('observationFill').style.width=`${Math.min(100,battle.quickstepActions*50)}%`;
}
function setupBattle(){
  const pressure=.70+(runState.round-1)*.13;
  const crew=deployed().map((name,i)=>{const s=battleStats[name]||{hp:92,dmg:15,speed:9,color:'#8ebddd'};return {id:`c${i}`,name,side:'crew',row:runState.field.includes(name)?'field':'support',hp:s.hp,maxHp:s.hp,dmg:s.dmg,speed:s.speed,color:s.color}});
  const count=runState.round<3?3:4;
  const names=['Quickstep','Warden','Anchor','Bruiser'];
  const enemies=Array.from({length:count},(_,i)=>{const hp=Math.round((46+i*8)*pressure*(i===0?2.2:1));return{id:`e${i}`,name:names[i],side:'enemy',kind:i===0?'FAST · OBSERVE':i===1?'ARMOURED':'SPECIMEN',hp,maxHp:hp,dmg:Math.round((7+i*2)*pressure),speed:i===0?12-i:8-i}});
  battle={pressure,crew,enemies,playing:false,over:false,round:1,cursor:0,quickstepActions:0,focus:false,hold:false,timer:null,log:[]};
  $('battleResult').classList.remove('open');$('battlePlay').textContent='BEGIN FIELDWORK';$('battleAction').textContent='Review the formation';$('battlePhase').textContent='FIELDWORK READY';$('callFocus').disabled=false;$('callHold').disabled=false;renderBattle();renderLog();
}
function renderLog(){ $('battleLog').innerHTML=battle.log.slice(-12).reverse().map(x=>`<div class="log-line">${x}</div>`).join('') }
function logBattle(text){battle.log.push(text);renderLog()}
function pulse(unit,kind){const el=$(`combat-${unit.id}`);if(!el)return;el.classList.remove(kind);void el.offsetWidth;el.classList.add(kind);setTimeout(()=>el.classList.remove(kind),500)}
function showDamage(value){const f=$('damageFloat');f.textContent=`-${value}`;f.classList.remove('show');void f.offsetWidth;f.classList.add('show')}
function nextActor(){
  const order=[...battle.crew.filter(u=>u.hp>0),...battle.enemies.filter(u=>u.hp>0)].sort((a,b)=>b.speed-a.speed);
  if(!order.length)return null;const actor=order[battle.cursor%order.length];battle.cursor++;if(battle.cursor%order.length===0)battle.round++;return actor;
}
function battleStep(){
  if(!battle.playing||battle.over)return;
  if(battle.round>12){finishBattle(false,'Extraction window closed');return}
  const actor=nextActor();if(!actor)return;
  if(actor.side==='crew')crewAction(actor);else enemyAction(actor);
  renderBattle();
  if(!battle.enemies.some(e=>e.hp>0)){finishBattle(true,'Specimens catalogued');return}
  if(!battle.crew.some(c=>c.hp>0&&c.row==='field')){finishBattle(false,'On-field crew lost');return}
  battle.timer=setTimeout(battleStep,Math.round(760/(battle.speed||1)));
}
function crewAction(actor){
  const target=battle.enemies.filter(e=>e.hp>0).sort((a,b)=>a.hp-b.hp)[0];if(!target)return;
  let dmg=actor.dmg+(runState.equipped[actor.name]||[]).length*2;if(battle.focus){dmg=Math.round(dmg*1.6);battle.focus=false}
  if(actor.name==='Ash'&&battle.enemies.some(e=>e.hp>0&&e.hp<e.maxHp*.5))dmg+=8;
  target.hp-=dmg;pulse(actor,'acting');setTimeout(()=>pulse(target,'hit'),180);showDamage(dmg);$('battlePhase').textContent=`${actor.name.toUpperCase()} ACTS`;$('battleAction').textContent=actor.name==='Quill'?'Survey mark → follow-up':`${target.name} takes ${dmg}`;logBattle(`<strong>${actor.name}</strong> hit ${target.name} for ${dmg}.`);
}
function enemyAction(actor){
  const targets=battle.crew.filter(c=>c.hp>0&&c.row==='field');const target=targets[Math.floor(Math.random()*targets.length)];if(!target)return;
  let dmg=actor.dmg;if(battle.hold){dmg=Math.max(1,dmg-8);battle.hold=false}
  target.hp-=dmg;pulse(actor,'acting');setTimeout(()=>pulse(target,'hit'),180);showDamage(dmg);if(actor.name==='Quickstep')battle.quickstepActions++;
  $('battlePhase').textContent=`${actor.name.toUpperCase()} ACTS`;$('battleAction').textContent=`${target.name} absorbs ${dmg}`;logBattle(`<strong>${actor.name}</strong> struck ${target.name} for ${dmg}.`);
}
function finishBattle(won,message){
  battle.playing=false;battle.over=true;clearTimeout(battle.timer);$('battlePlay').textContent='BATTLE COMPLETE';
  const observation=battle.quickstepActions>=2;const integrityDelta=won?(observation?5:2):-8;const gold=won?20+runState.round*5:8;
  runState.integrity=Math.max(0,Math.min(100,runState.integrity+integrityDelta));runState.gold+=gold;if(won)runState.battlesWon++;if(observation)runState.observations++;
  const fieldProgress=awardFieldXP(Field.battleXP(runState,won));
  $('resultTitle').textContent=message;$('resultCopy').textContent=won?'The crew recovered the encounter and returned its field record.':'The ship recovered what data it could before extraction.';$('resultIntegrity').textContent=`${integrityDelta>=0?'+':''}${integrityDelta}%`;$('resultGold').textContent=`+${gold}g · +${fieldProgress.xp} XP`;$('resultObservation').textContent=observation?'COMPLETE':'PARTIAL';$('battleResult').classList.add('open');
}
function enterBattle(){
  if(runState.end==='retreated'){showVoyageEnd();return}
  if(Crew.slots(runState)>6){toastMessage('Resolve reserve overflow before launch');return}
  if(!runState.field.some(Boolean)){toastMessage('Place at least one character on field');return}
  if(deployed().length<1){toastMessage('Deploy a crew before launch');return}
  if(activePack){toastMessage('Resolve the open pack before launch');return}
  if(runState.round>runState.maxRounds){showVoyageEnd();return}
  runState.goalLocked=true;runState.combatStats=battleStats;
  localStorage.setItem(SpacologyStore.run,JSON.stringify(runState));
  location.href=`watchable-fight.html?spacology=1&round=${runState.round}${SpacologyStore.suffix}`;
}
$('continueButton').onclick=enterBattle;
$('battlePlay').onclick=()=>{if(battle.over)return;battle.playing=!battle.playing;$('battlePlay').textContent=battle.playing?'PAUSE':'RESUME';if(battle.playing)battleStep();else clearTimeout(battle.timer)};
$('battleSpeed').onclick=()=>{battle.speed=battle.speed===2?1:2;$('battleSpeed').textContent=`SPEED · ${battle.speed}×`};
$('callFocus').onclick=()=>{battle.focus=true;$('callFocus').disabled=true;logBattle('<strong>Call: Focus</strong> — next crew attack amplified.')};
$('callHold').onclick=()=>{battle.hold=true;$('callHold').disabled=true;logBattle('<strong>Call: Hold</strong> — next incoming hit reduced.')};
$('leaveBattle').onclick=()=>{if(!battle.over)finishBattle(false,'Fieldwork abandoned')};
$('resultContinue').onclick=()=>{
  battleView.classList.remove('open');runState.round++;
  if(runState.round>runState.maxRounds){const grade=runState.integrity>=85?'A':runState.integrity>=70?'B':'C';$('voyageGrade').textContent=grade;$('voyageSummary').textContent=`${runState.integrity}% integrity · ${runState.battlesWon}/${runState.maxRounds} encounters recovered · ${runState.observations} observations completed.`;$('voyageEnd').classList.add('open');return}
  runState.openedThisRound=false;runState.packRefreshes=0;runState.packOffers=rollPackOffers(runState.packOffers);renderPackOffers();renderOps();toastMessage(`Round ${runState.round} ready. Enemy pressure will increase.`)
};
$('newVoyage').onclick=()=>{localStorage.removeItem(SpacologyStore.run);localStorage.removeItem(SpacologyStore.result);location.reload()};

function applyBattleResult(){
  if(runState.end==='retreated'){localStorage.removeItem(SpacologyStore.result);return}
  let result=null;try{result=JSON.parse(localStorage.getItem(SpacologyStore.result))}catch(_){}
  if(!result||result.round!==runState.round)return;
  const before=runState.integrity;
  const fieldProgress=awardFieldXP(Field.battleXP(runState,result.won));
  runState.gold+=result.gold;runState.integrity=Math.max(0,Math.min(100,runState.integrity+result.integrity));
  runState.crystals+=(result.crystals||0);runState.rarePity=result.rarePity||0;
  let duplicate=false;
  if(result.item){const list=result.item.type==='ship'?runState.shipInventory:runState.gear;const card=[result.item.type.toUpperCase(),result.item.name];duplicate=ownedCard(card);if(duplicate)runState.scrap+=4;else list.push(result.item.name)}
  if(result.won)runState.battlesWon++;if(result.observation)runState.observations++;
  runState.goalProgress+=Rules.goalGain(runState,result);
  const goalReward=!runState.goalClaimed&&runState.goalProgress>=Rules.goal(runState).target;
  if(goalReward){runState.goalClaimed=true;runState.gold+=8;runState.crystals++}
  runState.inbox.push({round:result.round,won:result.won,gold:result.gold,revives:result.revives||0,recoveryAV:result.recoveryAV||0,fieldXP:fieldProgress.xp,fieldUnlocks:fieldProgress.levels,integrity:runState.integrity-before,crystals:result.crystals||0,item:result.item?.name||null,duplicate,goalReward,actions:result.actions,breaks:result.breaks,chains:result.chains,ultimates:result.ultimates,reason:result.reason,timeLimit:result.timeLimit,elapsedAV:result.elapsedAV,enemyAttacks:result.enemyAttacks,enemyRecoveries:result.enemyRecoveries,recovery:result.recovery,analysis:result.analysis});
  runState.round++;runState.goalLocked=true;
  runState.packRefreshes=0;runState.packOffers=rollPackOffers(runState.packOffers);
  // Commit the advanced round with its rewards before consuming the separate result.
  localStorage.setItem(SpacologyStore.run,JSON.stringify(runState));
  localStorage.removeItem(SpacologyStore.result);
  if(runState.round>runState.maxRounds)showVoyageEnd();
  else setTimeout(()=>toastMessage(`Encounter ${runState.round} ready${fieldProgress.xp?` · +${fieldProgress.xp} field XP`:""}${fieldProgress.levels.length?" · Unlocked "+fieldProgress.levels.join(" · "):""} · rewards in inbox`),80);
}
$('retreatRun').onclick=()=>{
  if(runState.end==='retreated'||runState.round>runState.maxRounds){showVoyageEnd();return}
  if(!confirm('Retreat from this voyage? This ends the run. Completed encounter records stay in your inbox. Any unclaimed pack cards are lost. You can then begin a new voyage.'))return;
  runState.end='retreated';
  localStorage.removeItem(SpacologyStore.result);
  closePack();
  showVoyageEnd();
};
function showVoyageEnd(){
  const retreated=runState.end==='retreated';
  document.querySelector('#voyageEnd .eyebrow').textContent=retreated?'VOYAGE ENDED · RETREATED':'VOYAGE COMPLETE · ARCHIVE ACCEPTED';
  document.querySelector('#voyageEnd h1').textContent=retreated?'The crew came home.':'A record came home.';
  $('voyageGrade').hidden=retreated;
  const grade=runState.integrity>=85?'A':runState.integrity>=70?'B':'C';
  $('voyageGrade').textContent=grade;
  $('voyageSummary').textContent=`${runState.integrity}% integrity · ${runState.battlesWon}/${runState.maxRounds} encounters recovered · ${Rules.goal(runState).name}: ${runState.goalProgress}/${Rules.goal(runState).target}. Rewards are saved in your inbox.`;
  $('voyageEnd').classList.add('open');
  if(!$('finalInbox')){$('newVoyage').insertAdjacentHTML('beforebegin','<button class="continue" id="finalInbox" data-open-inbox>VIEW RECOVERY INBOX</button>')}
}
function renderExpedition(){
  const names=deployed(),counts={};names.forEach(n=>(Rules.crew[n]?.tags||[]).forEach(t=>counts[t]=(counts[t]||0)+1));
  const planets=Rules.planetCounts(names);
  const breakpoint=(count,steps)=>steps.map(n=>`<i class="${count>=n?'reached':''}">${n}</i>`).join(' | ');
  const aether=SpacologyAether.capacityBreakdown(names);
  document.querySelector('.harmonies').innerHTML=`<button class="harmony aether-team" data-team-aether><span class="harmony-icon">✦</span><span><b>Aether · ${aether.total} cap</b><span class="breaks">${aether.weavers} Weavers · +${aether.bonus} bonus</span></span></button><div class="eyebrow">HARMONIES</div>`+Object.keys(Rules.tags).filter(t=>counts[t]).map(t=>`<button class="harmony" data-live-harmony="${t}"><span class="harmony-icon">◇</span><span><b>${t} · ${counts[t]}</b><span class="breaks">${breakpoint(counts[t],[2,4])}</span></span></button>`).join('')+(names.length?'':'<p class="empty-hint">Deploy crew to build harmonies.</p>')+'<div class="eyebrow">HOMEWORLD</div>'+Object.entries(planets).map(([p,n])=>`<button class="harmony" data-planet-harmony="${p}"><span class="harmony-icon">◎</span><span><b>${p} · ${n}</b><span class="breaks">${breakpoint(n,[2,3])}</span></span></button>`).join('');
  document.querySelector('.round-map').innerHTML=Rules.route.map((name,i)=>`<button class="node ${i+1<runState.round?'complete':i+1===runState.round?'current':''}" data-route="${i}" aria-label="Encounter ${i+1}: ${name}${i+1<runState.round?', complete':i+1===runState.round?', current':''}"><i>${i+1<runState.round?'✓':i+1}</i><b>${i===5?'EXTRACT':i===2||i===4?'SPECIMEN':'SURVEY'}</b></button>`).join('');
  const goal=Rules.goal(runState),modifierNames=Rules.activeModifiers(runState).map(id=>Rules.modifiers[id].name);
  document.querySelector('.destination').innerHTML=`<b>${Rules.route[Math.min(5,runState.round-1)]}</b><span>${goal.battle}</span><small>${modifierWindow()&&!runState.modifierChoices.includes(modifierWindow())?'Modifier choice available in Settings':modifierNames.length?modifierNames.join(' · '):'No active modifiers'}</small>`;
  $('continueButton').textContent=`LAUNCH · ${SpacologyVoyageSettings.roundLimit(runState)} ROUNDS`;
  $('continueButton').setAttribute('aria-label',`Launch battle with a ${SpacologyVoyageSettings.roundLimit(runState)}-round deadline`);
  const goalButton=document.querySelector('[data-info="calls"]');goalButton.textContent=`GOAL · ${Math.min(goal.target,runState.goalProgress)} / ${goal.target}`;goalButton.onclick=showGoals;
  document.querySelector('[data-info="next-settings"]').onclick=showVoyageSettings;
  let inboxButton=document.querySelector('[data-open-inbox]');
  if(!inboxButton){const old=document.querySelector('.round-icon[aria-label="Pause"]');old.setAttribute('data-open-inbox','');old.removeAttribute('aria-label');inboxButton=old}
  inboxButton.textContent=`INBOX${runState.inbox.length>runState.inboxSeen?' · '+(runState.inbox.length-runState.inboxSeen):''}`;inboxButton.style.width='auto';inboxButton.setAttribute('aria-label','Open recovery inbox');
  document.querySelector('.run-meta > span').textContent=`${voyageDifficulty.label} · ${modifierNames.length} modifiers`;
}
function showInbox(){
  runState.inboxSeen=runState.inbox.length;renderOps();
  showModal(`<div class="eyebrow">RECOVERY INBOX · ALREADY CREDITED</div><h2>What came home</h2><p class="lede">A receipt for each encounter. Reading it does not collect rewards again.</p>${runState.inbox.slice().reverse().map(entry=>`<article class="receipt-entry"><h3>Encounter ${entry.round} · ${entry.won?'Recovered':entry.reason==='timeout'?'Time expired':'Partial recovery'}</h3><p>+${entry.gold} gold · ${entry.integrity>=0?'+':''}${entry.integrity}% integrity${entry.crystals?' · +'+entry.crystals+' crystals':''}${entry.fieldXP?' · +'+entry.fieldXP+' field XP':''}</p>${entry.revives?`<p>${entry.revives} crew recoveries · ${entry.recoveryAV} AV lost.</p>`:''}${entry.fieldUnlocks?.length?`<p>Field level up: ${entry.fieldUnlocks.join(' · ')}.</p>`:''}${entry.item?`<p>${entry.item}${entry.duplicate?' → 4 scrap (already owned)':''}</p>`:''}${entry.goalReward?'<p>Voyage goal completed: +8 gold and +1 crystal.</p>':''}<small>${entry.actions||0} actions · ${entry.breaks||0} breaks · ${entry.chains||0} chains · ${entry.ultimates||0} ultimates${entry.recovery?` · ${entry.recovery.earned}/${entry.recovery.total} recovery pts (${Math.floor(entry.recovery.percent)}%)`:''}${Number.isFinite(entry.elapsedAV)?` · ${(entry.elapsedAV/100).toFixed(2)} / ${entry.timeLimit} rounds`:''}</small>${entry.analysis?`<p>${entry.analysis.crewTurns} crew turns · ${entry.analysis.advances} advances · ${entry.analysis.savedAV} AV of crew waiting saved.</p><p>${entry.analysis.notes.join(' ')}</p>`:''}</article>`).join('')||'<p>No recovery yet. Finish an encounter to record its rewards here.</p>'}`);
}
function showGoals(){
  showModal(`<div class="eyebrow">VOYAGE GOAL</div><h2>Choose your fieldwork</h2><p class="lede">Complete one goal for 8 gold and 1 crystal. Progress carries across encounters. Selection locks at first launch.</p><div class="system-options">${Object.entries(Rules.goals).map(([id,g])=>`<article class="modal-card"><h3>${g.name}${runState.goal===id?' · SELECTED':''}</h3><p>${g.description}</p><p>Encounter observation: ${g.battle}</p><button data-goal="${id}" ${runState.goalLocked?'disabled':''}>${runState.goal===id?`${Math.min(g.target,runState.goalProgress)} / ${g.target}${runState.goalClaimed?' · REWARDED':''}`:'SELECT GOAL'}</button></article>`).join('')}</div>`);
}
function modifierWindow(){return runState.round===1&&!runState.goalLocked?1:runState.round===4?4:0}
function showVoyageSettings(){
  const current=Rules.activeModifiers(runState),window=modifierWindow(),canChoose=window&&!runState.modifierChoices.includes(window)&&!activePack;
  showModal(`<div class="eyebrow">VOYAGE SETTINGS</div><h2>${voyageDifficulty.label}</h2><h3>Downed crew</h3><div class="modal-actions">${[['revive','RECOVER · −50 AV'],['lastStand','LAST STAND'],['none','NO RECOVERY']].map(([id,label])=>`<button data-recovery-mode="${id}" aria-pressed="${SpacologyDownRecovery.mode(runState)===id}">${label}</button>`).join('')}</div><p>Recover restores downed crew to 50% health and shortens the battle deadline by 50 AV (half a round) each time. They resume after a normal turn wait; repeated downs can force early extraction. Last Stand instead prevents the first lethal hit at 1 HP and protects until their next turn. These modes do not stack. Changes apply to the next encounter.</p><p class="lede">Base enemy health and damage: ${Math.round(voyageDifficulty.enemyScale*100)}% of standard. Enemy speed: ${Math.round(voyageDifficulty.enemySpeed*100)}%; shield strength: ${Math.round(voyageDifficulty.enemyGuard*100)}%. Breaks delay the next enemy turn by ${Math.round(voyageDifficulty.breakDelay*100)}% of its normal wait; enemies reform and attack on their recovery turn. This encounter has a ${SpacologyVoyageSettings.roundLimit(runState)}-round deadline. A round is 100 Action Value, shown as a marker in the turn order. Speed and action advances fit more crew turns before the marker; they never add rounds. Animations and pauses do not spend it. Clear every wave before time expires. With Recover enabled, each down removes up to 50 AV from the remaining deadline. Back-row crew cannot be targeted by enemies. Tap an enemy in battle to inspect its behavior. Choose one optional modifier before first launch and another at encounter 4. Each trade applies to future encounters. A category can appear only once.</p><div class="system-options">${Object.entries(Rules.modifiers).map(([id,m])=>`<article class="modal-card"><h3>${m.name}${current.includes(id)?' · ACTIVE':''}</h3><p>${m.description}</p><button data-modifier="${id}" ${!canChoose||current.some(key=>Rules.modifiers[key].category===m.category)?'disabled':''}>ADD MODIFIER</button>${current.includes(id)?`<button data-remove-modifier="${id}" ${runState.modifierRemovalUsed||runState.round<3||runState.gold<8||activePack?'disabled':''}>REMOVE · 8g</button>`:''}</article>`).join('')}</div><p>One removal per voyage, available from encounter 3. ${runState.modifierRemovalUsed?'Already used.':''}</p><button data-show-goals>VIEW VOYAGE GOAL</button>`);
}
function showDuplicateSettings(){
  showModal(`<div class="eyebrow">INVENTORY PREFERENCES</div><h2>Already-owned crew</h2><p class="lede">Copies normally occupy reserve slots and combine into ranks. Characters sell for 3 gold per base copy (3 / 9 / 27 by rank). Equipment dismantles into scrap. Auto-selling owned copies is optional and slows rank growth.</p><div class="modal-actions">${[['maxed','Auto-sell maxed crew'],['ask','Choose each time'],['sell','Auto-sell all owned copies']].map(([id,name])=>`<button data-duplicate-policy="${id}" aria-pressed="${runState.duplicatePolicy===id}">${name}${runState.duplicatePolicy===id?' ✓':''}</button>`).join('')}</div>`);
}
function previewRecipe(a,b){
  const recipe=Rules.recipes.find(r=>r.inputs.includes(a)&&r.inputs.includes(b)&&a!==b);
  if(!recipe){toastMessage('No recipe for these two items. See Forge for combinations.');return}
  showRecipe(recipe.name);
}
const BASIC_GEAR_SCRAP=6,ADVANCED_GEAR_SCRAP=8;
const recipeCost=r=>`${r.scrap||ADVANCED_GEAR_SCRAP} scrap${r.crystals?' + '+r.crystals+' crystals':''}`;
function basicGearNames(){return Object.keys(gearEffects).filter(n=>!Rules.recipes.some(r=>r.name===n))}
function gearSource(name){
  if(runState.gear.includes(name))return {name,owner:null};
  for(const owner of [...deployed(),...runState.reserve]){
    const index=(runState.equipped[owner]||[]).indexOf(name);
    if(index>=0)return {name,owner,index};
  }
  return null;
}
// Suggestions follow the currently implemented combat actions, not lore roles.
function gearFit(item,name){
  const follow=['Maul','Wren','Ledger','Aurelio','Imke','Latch'];
  const ailment=['Ash','Stella','Morrow','Nour','Spore','Abike'];
  const direct=['Bosk','Maul','Wren','Beatriz','Ledger','Aurelio','Quill','Nadira','Nour'];
  const damageUlt=[...direct,'Ash','Stella','Morrow','Dolores','Imke','Latch','Idris','Sevim','Vitre','Yusuf','Tarn','Reva','Ojo','Otaremnivas','Tomás'];
  const matches={
    'Tuning Fork':[ailment,'Adds a stack to their ailment applications.'],
    'Spore Sling':[['Nour','Spore','Abike'],'Spreads stacks when their single-target attack applies an ailment.'],
    'Ranging Sight':[direct,'Their single-target attack hits another specimen.'],
    'Loaded Die':[direct,'Strengthens their opening hit.'],
    'Recoil Spring':[follow,'Boosts their triggered follow-up attacks.'],
    'Quick Latch':[[...deployed(),...runState.reserve],'Brings their first action forward.'],
    'Ballast Plate':[[...runState.field.filter(Boolean),...runState.reserve.filter(n=>crewPosition(n)==='field')],'Larger barriers received while holding the front row.'],
    'Slow Fuse':[damageUlt,'Increases their damaging ultimate.'],
    'Bore Bit':[[...direct,'Ash','Stella','Morrow','Sevim','Vitre','Yusuf','Idris'],'Adds guard pressure to their attacks.'],
    'Lumen Conduit':[damageUlt,'Starts closer to a stronger damaging ultimate.']
  };
  const recipe=Rules.recipes.find(r=>r.name===item);
  if(recipe?.inputs.length)return [...new Set(recipe.inputs.map(n=>gearFit(n,name)).filter(Boolean))].join(' ');
  const fit=matches[item];return fit?.[0].includes(name)?fit[1]:'';
}
function gearPurpose(name){
  const purposes={'Tuning Fork':'Ailment application','Spore Sling':'Single-target ailment spread','Ranging Sight':'Single-target attackers','Loaded Die':'Opening damage','Recoil Spring':'Triggered follow-up attacks','Quick Latch':'Earlier opening actions','Ballast Plate':'Front-row protection','Slow Fuse':'Damaging ultimates','Bore Bit':'Breaking shields','Lumen Conduit':'Earlier, stronger damaging ultimates'};
  const recipe=Rules.recipes.find(r=>r.name===name);
  return purposes[name]||recipe?.inputs.map(n=>purposes[n]).join(' + ')||'Crew equipment';
}
function gearDetails(name,readOnly=false,selectedSource){
  const source=readOnly?null:selectedSource||gearSource(name),names=[...new Set([...deployed(),...runState.reserve])];
  const fits=names.filter(n=>gearFit(name,n)),suggested=fits.slice(0,3),other=names.filter(n=>!suggested.includes(n));
  const crewButton=n=>{const wearing=source?.owner===n,full=![0,1].some(i=>!runState.equipped[n]?.[i]);return `<button class="gear-fit" data-equip-detail="${name}" data-crew="${n}" ${!source||wearing||full?'disabled':''}>${portraitMarkup(n,'gear-fit-portrait')}<span><b>${wearing?'Equipped to':source?'Equip to':'Good for'} ${n}</b><small>${gearFit(name,n)||'Can equip this gear.'}${full&&!wearing?' · No free slots':''}</small></span></button>`};
  const combinations=Rules.recipes.filter(r=>r.inputs.includes(name));
  const recipe=Rules.recipes.find(r=>r.name===name),value=recipe?(recipe.scrap||ADVANCED_GEAR_SCRAP)+recipe.inputs.length*BASIC_GEAR_SCRAP:BASIC_GEAR_SCRAP;
  return `<div class="gear-detail" data-source-name="${name}" data-source-owner="${source?.owner||''}" data-source-index="${source?.index??''}"><div class="eyebrow">GEAR · ${source?.owner?source.owner+', slot '+(source.index+1):source?'IN INVENTORY':'PREVIEW'}</div><h2>${name}</h2><p class="lede">${gearEffects[name]}</p><section><h3>Good for</h3><div class="gear-fit-list">${suggested.map(crewButton).join('')}</div>${!fits.length?`<p class="gear-help">${gearPurpose(name)}. No matching crew in your roster yet.</p>`:''}${source&&other.length?`<details class="gear-other"><summary>Other crew</summary><div class="gear-fit-list">${other.map(crewButton).join('')}</div></details>`:''}</section>${combinations.length?`<section><h3>Combine with</h3>${combinations.map(r=>{const partner=r.inputs.find(n=>n!==name),owned=gearSource(partner);return `<details class="gear-combination"><summary><b>${partner}</b><small>${owned?(owned.owner?owned.owner+', slot '+(owned.index+1):'You own this'):'Missing · '+BASIC_GEAR_SCRAP+' scrap to make'} → ${r.name}</small></summary><div class="gear-recipe"><h3>${r.name}</h3>${source?recipeDetails(r,source||name):`<p>${r.effect}</p><small>Keep this gear to combine it. Uses both items + ${recipeCost(r)}.</small>`}</div></details>`}).join('')}</section>`:''}${source?`<footer class="gear-footer">${source.owner?`<button data-remove-detail="${name}">Remove to inventory</button>`:''}<details class="gear-dismantle"><summary>Dismantle for 4 scrap</summary><p>Destroy ${name}${source.owner?' and remove it from '+source.owner:''}. Recover 4 of its ${value}-scrap crafting value; lose ${value-4} scrap.${recipe?.crystals?' Crystals are not returned.':''}</p><button class="gear-danger" data-dismantle-item="${name}" data-item-type="gear">DISMANTLE · +4 SCRAP</button></details></footer>`:''}</div>`;
}
function showGear(name,source){if(gearEffects[name])showModal(gearDetails(name,false,source))}
function detailGearSource(name){
  const detail=modalBody.querySelector('.gear-detail[data-source-name]');
  if(detail?.dataset.sourceName!==name)return gearSource(name);
  const owner=detail.dataset.sourceOwner,index=Number(detail.dataset.sourceIndex);
  if(owner)return runState.equipped[owner]?.[index]===name?{name,owner,index}:null;
  return runState.gear.includes(name)?{name,owner:null}:null;
}
function equipFromDetails(item,name){
  const source=detailGearSource(item);if(!source||!ownedCard(['CREW',name])||source.owner===name)return;
  const index=[0,1].find(i=>!runState.equipped[name]?.[i]);
  if(index===undefined){toastMessage(name+' has no free gear slots');return}
  if(source.owner){runState.equipped[source.owner][source.index]=null;runState.gear.push(item)}
  equipGear(name,item,index);showGear(item,{name:item,owner:name,index});
}
function removeFromDetails(item){
  const source=detailGearSource(item);if(!source?.owner)return;
  runState.equipped[source.owner][source.index]=null;
  runState.gear.push(item);renderOps();showGear(item);toastMessage(item+' returned to inventory');
}
function recipePlan(r,makeMissing=false,preferred){
  const origin=typeof preferred==='string'?detailGearSource(preferred):preferred;
  const sources=r.inputs.map(n=>origin?.name===n?origin:gearSource(n)),missing=r.inputs.filter((n,i)=>!sources[i]);
  const destination=sources.find(source=>source?.owner&&source.name===(origin?.name||preferred))||sources.find(source=>source?.owner)||null;
  const canMake=missing.every(n=>basicGearNames().includes(n));
  const scrap=(r.scrap||ADVANCED_GEAR_SCRAP)+(makeMissing?missing.length*BASIC_GEAR_SCRAP:0);
  const issue=ownedCard(['GEAR',r.name])?'Already owned':missing.length&&(!makeMissing||!canMake)?'Missing: '+missing.join(', '):runState.scrap<scrap?`Need ${scrap-runState.scrap} more scrap`:runState.crystals<(r.crystals||0)?`Need ${r.crystals-runState.crystals} more crystals`:'';
  return {sources,missing,destination,scrap,issue};
}
function canCraft(r){return !recipePlan(r).issue}
function recipeDetails(r,preferred){
  const plan=recipePlan(r,true,preferred),cost=`${plan.scrap} scrap${r.crystals?' + '+r.crystals+' crystals':''}`;
  const emptied=plan.sources.filter(s=>s?.owner&&s!==plan.destination);
  return `<p>${r.effect}</p><div class="recipe-inputs">${r.inputs.map((n,i)=>`<p><b>${n}</b> · ${plan.sources[i]?(plan.sources[i].owner?`${plan.sources[i].owner}, slot ${plan.sources[i].index+1}`:'Inventory'):`Make for ${BASIC_GEAR_SCRAP} scrap`}</p>`).join('')}</div><p>${r.inputs.length?'Consumes both ingredients. ':''}${plan.missing.length?`${plan.missing.length*BASIC_GEAR_SCRAP} scrap for missing gear + ${r.scrap||ADVANCED_GEAR_SCRAP} to combine. `:''}${plan.destination?`Equips ${r.name} to ${plan.destination.owner} in slot ${plan.destination.index+1}.`:'Result goes to inventory.'}${emptied.map(s=>` ${s.owner}, slot ${s.index+1} becomes empty.`).join('')}</p><button class="gear-primary" data-craft="${r.name}" data-make-missing="true" ${preferred?`data-gear-origin="${typeof preferred==='string'?preferred:preferred.name}"`:''} ${plan.issue?'disabled':''}>${plan.missing.length?'MAKE & COMBINE':r.inputs.length?'COMBINE':'CRAFT'} · ${cost.toUpperCase()}</button><small class="craft-availability">${plan.issue?plan.issue+' · ':''}${runState.scrap} scrap available${r.crystals?' · '+runState.crystals+' crystals available':''}</small>`;
}
function showRecipe(name){
  const r=Rules.recipes.find(r=>r.name===name);if(!r)return;
  showModal(`<div class="gear-detail"><div class="eyebrow">ADVANCED GEAR</div><h2>${r.name}</h2>${recipeDetails(r)}</div>`);
}
function craftAdvanced(name,makeMissing=false,preferred){
  const r=Rules.recipes.find(r=>r.name===name);if(!r)return;
  const plan=recipePlan(r,makeMissing,preferred);if(plan.issue){toastMessage(plan.issue);return}
  plan.sources.filter(Boolean).forEach(source=>{
    if(source.owner)runState.equipped[source.owner][source.index]=null;
    else runState.gear.splice(runState.gear.indexOf(source.name),1);
  });
  runState.scrap-=plan.scrap;runState.crystals-=r.crystals||0;
  if(plan.destination)runState.equipped[plan.destination.owner][plan.destination.index]=r.name;
  else runState.gear.push(r.name);
  renderOps();showGear(r.name);toastMessage(r.name+' crafted'+(plan.destination?' and equipped to '+plan.destination.owner:''));
}
function craftBasic(name){
  if(!basicGearNames().includes(name)||ownedCard(['GEAR',name])||runState.scrap<BASIC_GEAR_SCRAP)return;
  runState.scrap-=BASIC_GEAR_SCRAP;runState.gear.push(name);renderOps();showForge();toastMessage(name+' crafted');
}
function copyIssue(name){
  if(!Rules.crew[name]||!ownedCard(['CREW',name]))return 'Discover this character in a pack first';
  const result=Crew.receive(runState,name);
  return result.error||(runState.crystals<2?'Need 2 crystals':'');
}
function showCrewUpgrades(name){showAttunements(name)}
function showAttunements(selected){
  const names=[...new Set(Crew.names(runState))];
  showModal(`<div class="eyebrow">ATTUNEMENT · ${runState.crystals} CRYSTALS</div><h2>Create a character copy</h2><p class="lede">Spend 2 crystals for one copy of a character you own. Packs discover new characters. Three ★ copies make ★★; three ★★ copies make ★★★ at field level 5.</p><p>Reserves: ${Crew.slots(runState)} / 6. Copies occupy slots until merged. ★★ gains 35% base health and 25% base attack; ★★★ gains 80% health and 60% attack.</p><div class="recruit-grid">${names.filter(n=>!selected||n===selected).map(n=>`<article class="modal-card"><button class="recruit-preview" data-view-crew="${n}">${portraitMarkup(n,'recruit-art')}<b>${n}</b></button><p>${rankProgress(n)}</p><button data-create-copy="${n}" ${copyIssue(n)?'disabled':''}>CREATE COPY · 2 CRYSTALS</button><small>${copyIssue(n)||'Ready · merges happen automatically'}</small></article>`).join('')||'<p>Find crew in a supply pack first.</p>'}</div><p>Crystals also craft specialized gear and ship equipment in Forge.</p>`);
}
function showForge(){
  const available=Object.keys(gearEffects).map(gearSource).filter(Boolean);
  showModal(`<div class="eyebrow">FORGE · ${runState.scrap} SCRAP</div><h2>Build your equipment</h2><p class="lede">Basic gear costs ${BASIC_GEAR_SCRAP} scrap. Combine two ingredients and ${ADVANCED_GEAR_SCRAP} scrap into advanced gear. Standard recipes require no crystals.</p><h3>Available ingredients</h3><div class="forge-inventory">${available.map(source=>`<button draggable="true" class="drop-zone" data-forge-input="${source.name}">${source.name}<small>${source.owner?source.owner+' · slot '+(source.index+1):'Inventory'}</small></button>`).join('')||'<p>No gear yet. Craft a basic item below.</p>'}</div><h3>Advanced gear</h3><div class="system-options">${Rules.recipes.filter(r=>!r.crystals).map(r=>`<article class="modal-card"><h3>${r.name}</h3><p>${r.inputs.join(' + ')} + ${ADVANCED_GEAR_SCRAP} scrap</p><p>${r.effect}</p><button data-recipe="${r.name}">${canCraft(r)?'PREVIEW COMBINATION':'VIEW RECIPE'}</button></article>`).join('')}</div><h3>Basic gear · ${BASIC_GEAR_SCRAP} scrap each</h3><div class="system-options">${basicGearNames().map(name=>`<article class="modal-card"><h3>${name}</h3><p>${gearEffects[name]}</p><button data-craft-basic="${name}" ${ownedCard(['GEAR',name])||runState.scrap<BASIC_GEAR_SCRAP?'disabled':''}>${ownedCard(['GEAR',name])?'OWNED':`CRAFT · ${BASIC_GEAR_SCRAP} SCRAP`}</button></article>`).join('')}</div><h3>Crystal crafting</h3><div class="system-options">${Rules.recipes.filter(r=>r.crystals).map(r=>`<article class="modal-card"><h3>${r.name}</h3><p>${r.effect}</p><p>${recipeCost(r)}</p><button data-recipe="${r.name}">VIEW RECIPE</button></article>`).join('')}<article class="modal-card"><h3>Prismatic Dynamo · ship</h3><p>${shipEffects['Prismatic Dynamo']}</p><button data-craft-dynamo ${ownedCard(['SHIP','Prismatic Dynamo'])||runState.scrap<16||runState.crystals<2?'disabled':''}>${ownedCard(['SHIP','Prismatic Dynamo'])?'OWNED':'CRAFT · 16 SCRAP + 2 CRYSTALS'}</button></article></div><p>Crew ranks come from copies, not material upgrades.</p><button data-show-attunements>CREATE A CHARACTER COPY</button>`);
}
previewPack=function(key){
  const p=packs[key],pool=[];Object.values(packs).forEach(pack=>pack.cards.slice(2).forEach(c=>{if(!pool.some(x=>x[0]===c[0]&&x[1]===c[1]))pool.push(c)}));
  showModal(`<div class="eyebrow">SEALED PACK PREVIEW</div><h2>${p.name} · ${packPrice(key)}g</h2><p class="lede">2 gear, 1 ship item and 2 crew, plus gold and 4 scrap (8% chance of 1 crystal instead). Each card draws from its themed pool 65% of the time when an unused themed card is available. Otherwise it draws from the wider pool. A 16% pack chance upgrades one card to Prime (+1 gold for crew; +2 scrap for equipment).</p><div class="system-options">${pool.map(c=>`<button data-pool-card="${c[0]}" data-name="${c[1]}"><b>${c[1]}</b><small>${c[0]}${p.cards.some(x=>x[1]===c[1])?' · THEMED':''}</small></button>`).join('')}</div>`);
};
function showItem(name,type){if(type==='gear'){showModal(gearDetails(name,true));return}showModal(`<div class="eyebrow">${type.toUpperCase()}</div><h2>${name}</h2><p class="lede">${type==='gear'?gearEffects[name]:shipEffects[name]}</p>`)}
const oldInventoryClick=inventoryHost.onclick;
inventoryHost.onclick=e=>{const copy=e.target.closest('[data-copy-id]');if(copy){showCopyDetails(copy.dataset.copyId);return}const material=e.target.closest('[data-material]');if(material){if(material.dataset.material==='Bloom crystal')showCrewUpgrades();else if(material.dataset.material==='Prism scrap')showForge();else showAttunements();return}oldInventoryClick(e)};
document.querySelector('[data-info="forge"]').onclick=showForge;
document.querySelector('[data-info="attune"]').onclick=()=>showAttunements();

document.querySelector('[data-info="manage"]').onclick=showDuplicateSettings;
document.querySelector('[data-info="map"]').onclick=()=>showModal(`<h2>Voyage route</h2><p><a href="star-atlas.html" target="_blank" rel="noopener">OPEN STAR ATLAS · HOMEWORLDS</a></p>${Rules.route.map((name,i)=>`<p>${i+1}. ${name} · ${i+1<runState.round?'complete':i+1===runState.round?'current':'ahead'}</p>`).join('')}`);
showToast=function(message){toast.textContent=message;const button=document.createElement('button');button.textContent='DISMISS';button.onclick=()=>toast.classList.remove('show');toast.append(button);toast.classList.add('show')};
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-team-aether')){const a=SpacologyAether.capacityBreakdown(deployed());showModal(`<div class="eyebrow">TEAM AETHER</div><h2>${a.total} shared capacity</h2><p>6 base + ${a.weavers} from deployed Weavers + ${a.bonus} from capacity passives. Each living Weaver adds 1; Ivara and Aurel each add 2 more. Reserve crew and summons do not count.</p><p>Battles still start with 3 Aether. Losing a Weaver reduces capacity and discards any excess charges. Full burst scales with the current pool: Arunima adds 100 percentage points of attack for every charge beyond her base cost.</p>`);return}
  if(b.hasAttribute('data-open-inbox'))showInbox();
  if(b.hasAttribute('data-show-goals'))showGoals();
  if(b.hasAttribute('data-duplicate-settings'))showDuplicateSettings();
  if(['ask','maxed','sell'].includes(b.dataset.duplicatePolicy)){runState.duplicatePolicy=b.dataset.duplicatePolicy;renderPackOffers();renderOps();showDuplicateSettings()}
  if(b.dataset.liveHarmony){const tag=b.dataset.liveHarmony,members=deployed().filter(n=>Rules.crew[n]?.tags.includes(tag));showModal(`<h2>${tag} · ${members.length} crew</h2><p>2: ${Rules.tags[tag][0]}</p><p>4: ${Rules.tags[tag][1]}</p><p>${members.join(', ')}</p>`)}
  if(b.dataset.planetHarmony){const planet=b.dataset.planetHarmony,members=deployed().filter(n=>Rules.crew[n]?.planet===planet);showModal(`<h2>${planet} · ${members.length} crew</h2><p>2: All deployed crew gain 8% base health.</p><p>3: Increases to 15%. Bonuses from different planets add together.</p><p>${members.join(', ')}</p><p>Shared ancestral-world affiliation. Birthplace and ancestry can differ; proposed assignments are shown in the star atlas.</p>`)}
  if(b.dataset.route!==undefined){const i=Number(b.dataset.route);showModal(`<h2>Encounter ${i+1} · ${Rules.route[i]}</h2><p>${i+1<runState.round?'Completed':i+1===runState.round?'Prepare your crew, then launch.':'Upcoming encounter. Enemy strength increases along the route.'}</p>`)}
});
modalBody.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.shipEquip){if(equipShip(b.dataset.shipEquip,Number(b.dataset.shipSlot)))overlay.classList.remove('open');return}
  if(b.dataset.shipUnequip){const source=shipSource(b.dataset.shipUnequip,b.dataset.shipSlot);if(source){runState.shipInventory.push(b.dataset.shipUnequip);source.list[source.index]=null;renderOps();showShip(b.dataset.shipUnequip)}return}
  if(b.dataset.shipUpgrade){const name=b.dataset.shipUpgrade,source=shipSource(name,b.dataset.shipSource),next=Rules.shipParts[name]?.upgrade;if(source&&next&&runState.scrap>=8){source.list[source.index]=next;runState.scrap-=8;renderOps();showShip(next,source.equipped?source.index:null);toastMessage(next+' ready')}return}
  if(b.dataset.shipScrap){const name=b.dataset.shipScrap,source=shipSource(name,b.dataset.shipSource);if(source){if(source.equipped)source.list[source.index]=null;else source.list.splice(source.index,1);runState.scrap+=4;renderOps();overlay.classList.remove('open');toastMessage(name+' dismantled for 4 scrap')}return}
  if(b.dataset.recoveryMode){if(!['revive','lastStand','none'].includes(b.dataset.recoveryMode))return;runState.downRecovery=b.dataset.recoveryMode;runState.lastStand=b.dataset.recoveryMode==='lastStand';renderOps();showVoyageSettings();return}
  if(b.dataset.aetherMode){const n=b.dataset.aetherCrew,id=b.dataset.aetherMode;if(!ownedCard(['CREW',n]))return;runState.aetherModes||={};if(id==='priority'){runState.aetherPriority=n;runState.aetherModes[n]='auto'}else{if(runState.aetherPriority===n)runState.aetherPriority=null;runState.aetherModes[n]=id==='build'?'build':'auto'}renderOps();showModal(characterDetails(n,runState.reserve.includes(n)?'inventory':'formation'));return}
  if(b.dataset.aetherOvercharge){const n=b.dataset.aetherOvercharge;if(!ownedCard(['CREW',n]))return;runState.aetherOvercharge||={};runState.aetherOvercharge[n]=!SpacologyAether.overchargeEnabled(runState,n);renderOps();showModal(characterDetails(n,runState.reserve.includes(n)?'inventory':'formation'));return}
  if(b.dataset.packModal){if(resolveCard(Number(b.dataset.index),b.dataset.packModal))overlay.classList.remove('open')}
  if(b.dataset.poolCard){if(b.dataset.poolCard==='CREW'){showModal(characterDetails(b.dataset.name,'preview'));modalBody.querySelectorAll('[data-place],[data-return]').forEach(x=>x.remove())}else showItem(b.dataset.name,b.dataset.poolCard.toLowerCase())}
  if(b.dataset.viewCrew){showModal(characterDetails(b.dataset.viewCrew,'preview'));modalBody.querySelectorAll('[data-place],[data-return]').forEach(x=>x.remove())}
  if(b.dataset.forgeInput)showGear(b.dataset.forgeInput);
  if(b.dataset.recipe)showRecipe(b.dataset.recipe);
  if(b.dataset.craft)craftAdvanced(b.dataset.craft,b.dataset.makeMissing==='true',b.dataset.gearOrigin);
  if(b.dataset.inspectGear)showGear(b.dataset.inspectGear,{name:b.dataset.inspectGear,owner:b.dataset.sourceOwner,index:Number(b.dataset.sourceIndex)});
  if(b.dataset.equipDetail)equipFromDetails(b.dataset.equipDetail,b.dataset.crew);
  if(b.dataset.removeDetail)removeFromDetails(b.dataset.removeDetail);
  if(b.hasAttribute('data-craft-dynamo')){if(ownedCard(['SHIP','Prismatic Dynamo'])||runState.scrap<16||runState.crystals<2)return;runState.scrap-=16;runState.crystals-=2;runState.shipInventory.push('Prismatic Dynamo');renderOps();showForge()}
  if(b.dataset.craftBasic)craftBasic(b.dataset.craftBasic);
  if(b.dataset.unequipGear)unequipGear(b.dataset.unequipGear,Number(b.dataset.gearSlot),b.dataset.gearName);
  if(b.dataset.viewUpgrade)showCrewUpgrades(b.dataset.viewUpgrade);
  if(b.hasAttribute('data-show-attunements'))showAttunements();
  if(b.dataset.createCopy){const n=b.dataset.createCopy,issue=copyIssue(n);if(issue){toastMessage(issue);return}if(receiveCrew(n)){runState.crystals-=2;renderOps();showAttunements(n);toastMessage(n+' · '+rankProgress(n))}}
  if(b.dataset.copySell){const id=b.dataset.copySell,copy=runState.crewCopies.find(c=>c.id===id);if(copy){runState.gold+=Crew.saleValue(copy.rank);runState.crewCopies=runState.crewCopies.filter(c=>c.id!==id);renderOps();overlay.classList.remove('open')}}
  if(b.dataset.dismantleItem&&b.dataset.itemType==='gear'){const name=b.dataset.dismantleItem,source=detailGearSource(name);if(source){if(source.owner)runState.equipped[source.owner][source.index]=null;else runState.gear.splice(runState.gear.indexOf(name),1);runState.scrap+=4;renderOps();overlay.classList.remove('open');toastMessage(name+' dismantled for 4 scrap')}return}
  if(b.dataset.dismantleItem){const name=b.dataset.dismantleItem,type=b.dataset.itemType,list=type==='gear'?runState.gear:type==='ship'?runState.shipInventory:null;if(list&&list.includes(name)){list.splice(list.indexOf(name),1);runState.scrap+=4;renderOps();overlay.classList.remove('open');toastMessage(name+' dismantled for 4 scrap')}}
  if(b.dataset.goal&&!runState.goalLocked&&Rules.goals[b.dataset.goal]){runState.goal=b.dataset.goal;runState.goalProgress=0;renderOps();showGoals()}
  if(b.dataset.modifier){const id=b.dataset.modifier,m=Rules.modifiers[id],window=modifierWindow();if(!m||!window||runState.modifierChoices.includes(window)||Rules.activeModifiers(runState).some(k=>Rules.modifiers[k].category===m.category)||activePack)return;runState.modifiers.push(id);runState.modifierChoices.push(window);renderPackOffers();renderOps();showVoyageSettings()}
  if(b.dataset.removeModifier){const id=b.dataset.removeModifier;if(runState.round<3||runState.modifierRemovalUsed||runState.gold<8||!runState.modifiers.includes(id)||activePack)return;runState.modifiers=runState.modifiers.filter(m=>m!==id);runState.gold-=8;runState.modifierRemovalUsed=true;renderPackOffers();renderOps();showVoyageSettings()}
});

const returningToOps=runState.end==='retreated'||new URLSearchParams(location.search).get('return')==='1'||!!localStorage.getItem(SpacologyStore.result);
if(returningToOps)document.getElementById('titleScreen').hidden=true;
renderPackOffers();installPackTargets();applyBattleResult();
if(runState.pack&&packs[runState.pack.key]&&Array.isArray(runState.pack.cards)){runState.packOffers=runState.packOffers.map(key=>key===runState.pack.key?null:key);activePack=runState.pack.key;activeCards=runState.pack.cards;resolved=runState.pack.resolved;packSelect.classList.add('hidden');openedPack.classList.remove('hidden');renderPack()}
renderPackOffers();renderOps();if(formationChanges.length)setTimeout(()=>toastMessage('Formation roles updated: '+formationChanges.join(' · ')),120);if(runState.end==='retreated'||runState.round>runState.maxRounds)showVoyageEnd();
})();
