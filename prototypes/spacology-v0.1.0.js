(function(){
'use strict';
const Rules=SpacologyExpedition;

let newVoyageSettings={};
try{newVoyageSettings=JSON.parse(localStorage.getItem('spacologyPlaytestConfigV010'))}catch(_){}
newVoyageSettings=SpacologyVoyageSettings.normalize(newVoyageSettings);
const starterCrew=['Tarn','Ash','Quill','Maul','Bosk','Coda','Morrow','Spore'];
function shuffled(values){const copy=[...values];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
const starterFront=shuffled(['Tarn','Ash','Bosk','Morrow'])[0];
const starterRoster=[starterFront,...shuffled(starterCrew.filter(name=>name!==starterFront)).slice(0,2)];
const runState={
  schema:3,round:1,maxRounds:6,gold:42,integrity:newVoyageSettings.initialIntegrity,level:1,capacity:4,shipSlots:1,
  difficulty:newVoyageSettings.difficulty,initialIntegrity:newVoyageSettings.initialIntegrity,
  field:Array(5).fill(null),support:Array(7).fill(null),reserve:starterRoster,gear:[],shipInventory:[],shipEquipped:[],
  inbox:[],inboxSeen:0,attunements:{},duplicatePolicy:'ask',modifiers:[],modifierChoices:[],modifierRemovalUsed:false,
  goal:'survey',goalProgress:0,goalClaimed:false,goalLocked:false,recruitedRound:0,crewUpgrades:{},pack:null,
  equipped:{},scrap:0,crystals:0,rarePity:0,selected:null,drag:null,
  openedThisRound:false,battlesWon:0,observations:0,packRefreshes:0,
  packOffers:['rot','tempo','bulwark']
};
try{const saved=JSON.parse(localStorage.getItem('spacologyRunV010'));if(saved?.schema===runState.schema)Object.assign(runState,saved,SpacologyVoyageSettings.normalize(saved),{selected:null,drag:null})}catch(_){}
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
const shipEffects={
  'Culture Bed':'Every ailment application adds 1 extra stack.','Exact Clock':'All crew begin battle with 20 Energy.',
  'Fast Clock':'All crew begin battle 8 Action Value ahead.','Brace Matrix':'Reduces the first incoming hit each battle.',
  'Survey Prism':'Completed observations award 20% more gold.'
};
Rules.recipes.forEach(recipe=>gearEffects[recipe.name]=recipe.effect);

// Packs are cheap enough to be a recurring decision, while their automatic
// currency card softens rather than erases the price.
packs.rot.price=12;packs.rot.cards[0][1]='5 gold';
packs.order.price=14;packs.order.cards[0][1]='6 gold';packs.order.cards[5][1]='Quill';packs.order.cards[6][1]='Maul';
packs.order.cards[3][2]='First attack deals +20%';packs.order.cards[4][2]='Crew begin with 20 Energy';
packs.tempo.price=13;packs.tempo.cards[0][1]='5 gold';packs.tempo.cards[6][1]='Ash';
packs.tempo.cards[3][2]='Wearer starts 8 AV ahead';
Object.assign(packs,{
  bulwark:{name:'Hull & Ordnance',price:13,theme:'Hull and heavy attacks',pool:'2–4 resources · 1–2 Gear · 0–1 ship item · 1–2 crew',cards:[['CURRENCY','5 gold','Offsets the pack cost','AUTO','var(--amber)'],['MATERIAL','Prism scrap ×4','Upgrade or forge Gear','AUTO','var(--green)'],['GEAR','Ballast Plate','Barriers gain +30%','Tarn fit','var(--violet)'],['GEAR','Slow Fuse','Ultimate damage +25%','Bosk fit','var(--violet)'],['SHIP','Brace Matrix','First incoming hit is reduced','Hull fit','var(--green)'],['CREW','Tarn','Hull · Decay','Front-line anchor','var(--blue)'],['CREW','Bosk','Ordnance · Decay','Heavy burst','var(--blue)']]},
  survey:{name:'Assay & Energy',price:12,theme:'Assay and Energy',pool:'2–4 resources · 1–2 Gear · 0–1 ship item · 1–2 crew',cards:[['CURRENCY','5 gold','Offsets the pack cost','AUTO','var(--amber)'],['MATERIAL','Relay scrap ×4','Upgrade or forge Gear','AUTO','var(--green)'],['GEAR','Ranging Sight','Attack reaches +1 target','Quill fit','var(--violet)'],['GEAR','Quick Latch','Wearer starts 8 AV ahead','Coda fit','var(--violet)'],['SHIP','Survey Prism','Observation gold +20%','Fieldwork fit','var(--green)'],['CREW','Quill','Follow-up · Assay','Off-field surveyor','var(--blue)'],['CREW','Coda','Follow-up · Energy','Charge relay','var(--blue)']]},
  frontier:{name:'Wild Culture',price:11,theme:'Growth and Decay',pool:'2–4 resources · 1–2 Gear · 0–1 ship item · 1–2 crew',cards:[['CURRENCY','4 gold','Offsets the pack cost','AUTO','var(--amber)'],['MATERIAL','Bloom crystal ×3','Crafting and attunements','AUTO','var(--green)'],['GEAR','Spore Sling','Spread reaches +1 target','Spore fit','var(--violet)'],['GEAR','Tuning Fork','Applications add +1 stack','Morrow fit','var(--violet)'],['SHIP','Culture Bed','Ailments persist +1 turn','Fieldwork fit','var(--green)'],['CREW','Morrow','Ailment · Decay','Persistent stacks','var(--blue)'],['CREW','Spore','Ailment · Growth','Wide spread','var(--blue)']]}
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
function crewInfo(name){const old=unitData[name]||crewFallback[name]||['Crew · Order','Specialist','A newly catalogued crew member.'];return Rules.crew[name]?[Rules.crew[name].tags.join(' / ')+' · '+Rules.crew[name].element,...old.slice(1)]:old}
function crewTone(name){const tag=crewInfo(name)[0];if(tag.includes('Hull'))return 'var(--blue)';if(tag.includes('Follow'))return 'var(--red)';if(tag.includes('Assay'))return 'var(--violet)';if(tag.includes('Growth'))return 'var(--green)';return 'var(--decay)'}
function deployed(){return [...runState.field,...runState.support].filter(Boolean)}
function crewPosition(name){return crewPositions[name]||'both'}
function positionLabel(name){return crewPosition(name)==='field'?'ON FIELD ONLY':crewPosition(name)==='support'?'OFF FIELD ONLY':'ON OR OFF FIELD'}
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
function displayedCrewStats(name){
  const base=battleStats[name]||{hp:92,dmg:15,speed:9},rank=runState.crewUpgrades[name]||0,names=deployed(),active=names.includes(name);
  const health=active?Rules.planetHealth(names):1,mods=Rules.effects(runState);
  const ordnance=active&&names.filter(n=>Rules.crew[n]?.tags.includes('Ordnance')).length>=2;
  const drive=active&&names.filter(n=>Rules.crew[n]?.tags.includes('Drive')).length>=2;
  return {...base,speed:Number((base.speed*(drive?1.12:1)).toFixed(2)),hp:Math.round(base.hp*(1+rank*.15)*health),dmg:Math.round(Math.round(base.dmg*(1+rank*.1)*(active?mods.crewDamage:1))*(ordnance?1.2:1))};
}
function characterDetails(name,location){
  const info=crewInfo(name),stats=displayedCrewStats(name),kit=crewKits[name]||{role:info[1],basic:['Basic attack','Deals damage to one specimen.'],skill:['Special action',info[2]],passive:['Field trait','Supports the crew through its listed Harmonies.'],plan:info[2]};
  const gear=(runState.equipped[name]||[]).filter(Boolean);
  const lastAction=location==='inventory'?`<button class="sell-action" data-sell-character="${name}">SELL · +1 GOLD</button><button class="danger" data-scrap-character="${name}">DISMANTLE · +7 SCRAP</button>`:location==='formation'?`<button data-return="${name}">RETURN TO INVENTORY</button>`:'';
  return `<div class="eyebrow">CHARACTER · ${info[0]}</div><h2>${name}</h2><p class="crew-origin">${Rules.crew[name]?`${Rules.crew[name].species} · ancestry: ${Rules.crew[name].planet} · birthplace: ${Rules.crew[name].birthplace}`:''}</p><p class="lede"><strong>${kit.role}</strong> · ${positionLabel(name)}</p><div class="kit-stats"><div><span>HEALTH</span><b>${stats.hp}</b></div><div><span>ATTACK</span><b>${stats.dmg}</b></div><div><span>SPEED</span><b>${stats.speed}</b></div><div><span>POSITION</span><b>${positionLabel(name)}</b></div><div><span>GEAR</span><b>${gear.length} / 2</b></div></div><div class="kit-grid"><div class="kit-move"><label>BASIC</label><b>${kit.basic[0]}</b><p>${kit.basic[1]}</p></div><div class="kit-move"><label>ULTIMATE</label><b>${kit.skill[0]}</b><p>${kit.skill[1]}</p></div><div class="kit-move"><label>PASSIVE</label><b>${kit.passive[0]}</b><p>${kit.passive[1]}</p></div></div><div class="build-note"><strong>HOW TO USE:</strong> ${kit.plan}</div><div class="modal-actions"><button data-place="field" data-name="${name}" ${canPlace(name,'field')?'':'disabled'}>MOVE ON FIELD</button><button data-place="support" data-name="${name}" ${canPlace(name,'support')?'':'disabled'}>MOVE OFF FIELD</button>${lastAction}</div>`;
}

function unitMarkup(name,row,slotIndex){
  const info=crewInfo(name),gear=runState.equipped[name]||[];
  return `<article class="unit" draggable="true" data-unit="${name}" data-source-row="${row}" data-slot-index="${slotIndex}" style="--tone:${crewTone(name)}">${positionBadge(name)}${portraitMarkup(name,'portrait')}<b>${name}</b><span>${info[0]}</span><div class="gear-slots"><i class="drop-zone" data-gear-owner="${name}" data-gear-index="0">${gear[0]?'◆':''}</i><i class="drop-zone ${gear[1]?'':'empty'}" data-gear-owner="${name}" data-gear-index="1">${gear[1]?'◆':''}</i></div></article>`;
}

function renderFormation(){
  const rows=board.querySelectorAll('.crew-row');
  [['field',runState.field,'ON FIELD','acts · targeted'],['support',runState.support,'OFF FIELD','supports · safe']].forEach((def,index)=>{
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
  cap.querySelector('span').textContent=runState.level%2?`Next: ${runState.capacity+1} crew`:`Next: ${runState.shipSlots+1} ship slots`;
  $('levelField').textContent=`LEVEL FIELD · ${12+(runState.level-1)*6}g`;
}

function inventoryEntries(type){
  if(type==='characters')return runState.reserve.map(n=>[n,crewInfo(n)[0]]);
  if(type==='gear')return runState.gear.map(n=>[n,gearEffects[n]||'Improves one crew member while equipped.']);
  if(type==='ship')return runState.shipInventory.map(n=>[n,shipEffects[n]||'Changes the rules for the whole expedition.']);
  return [['Prism scrap',runState.scrap,'Use with crystals to craft attunements or upgrade crew.'],['Bloom crystal',runState.crystals,'Use with scrap to craft an attunement or upgrade crew.'],...Object.entries(runState.attunements).filter(([,n])=>n>0).map(([element,n])=>[element+' attunement',n,'Recruit an unowned '+element+' character.'])];
}

renderInventory=function(type){
  inventoryTab=type;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===type));
  if(type==='materials'){inventoryHost.innerHTML=inventoryEntries(type).map(([name,n,desc])=>`<button class="material-counter" data-material="${name}"><span>${name}</span><b>×${n}</b><small>${desc}</small></button>`).join('');return}
  inventoryHost.innerHTML=inventoryEntries(type).map((x,i)=>`<article class="item ${type==='characters'?'character':type==='gear'?'drop-zone':''}" ${type==='gear'?`data-combine-with="${x[0]}"`:''} draggable="${type!=='materials'}" data-item="${x[0]}" data-type="${type}">${type==='characters'?positionBadge(x[0]):`<span class="lock">${i===0?'◆':''}</span>`}<span class="qty">${type==='materials'?x[1]:'×1'}</span>${type==='characters'?portraitMarkup(x[0],'item-icon'):'<div class="item-icon"></div>'}<b>${x[0]}</b><span>${x[1]}</span></article>`).join('');
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
  localStorage.setItem('spacologyRunV010',JSON.stringify(runState));
}

function rollPackOffers(previous=[]){
  const pool=Object.keys(packs).sort(()=>Math.random()-.5);
  const fresh=pool.filter(key=>!previous.includes(key));
  return [...fresh,...pool].filter((key,index,list)=>list.indexOf(key)===index).slice(0,3);
}
function randomCard(pool){return pool[Math.floor(Math.random()*pool.length)]}
function rollPackCards(key){
  const source=packs[key].cards;
  const cards=[source[0].slice(),source[1].slice()];
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
  const refreshCost=2+(runState.packRefreshes||0)*2;
  packSelect.innerHTML=runState.packOffers.map(key=>{const p=packs[key];return `<article class="pack"><span class="kind">${p.theme.toUpperCase()}</span><b class="price">${packPrice(key)}g</b><h3>${p.name}</h3><p>${p.theme}. Sealed contents vary by offer.</p><span class="odds">65% themed · 16% Prime</span><div class="pack-actions"><button data-preview="${key}">PREVIEW</button><button class="open" data-open="${key}">OPEN</button></div></article>`}).join('')+`<aside class="stock-note"><b>Supply offers</b><button id="refreshPacks">REFRESH · ${refreshCost}g</button><button data-duplicate-settings>OWNED CREW · ${runState.duplicatePolicy.toUpperCase()}</button></aside>`;
}
function refreshPackOffers(){
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
  if(!already&&!displaced&&deployed().length>=runState.capacity){toastMessage(`Team capacity ${runState.capacity} reached`);return false}
  removeCrew(name);
  if(displaced&&displaced!==name){removeCrew(displaced);runState.reserve.push(displaced)}
  runState[row][slotIndex]=name;
  renderOps();toastMessage(`${name} placed ${row==='field'?'on field':'off field'}`);return true;
}
function returnCrew(name){
  removeCrew(name);runState.reserve.push(name);renderOps();toastMessage(`${name} returned to inventory`);
}
function equipGear(name,gear,index){
  runState.equipped[name]||(runState.equipped[name]=[]);
  if(index===undefined||Number.isNaN(index))index=[0,1].find(i=>!runState.equipped[name][i]);
  if(index===undefined){toastMessage(`${name} has no empty Gear slots`);return false}
  const replaced=runState.equipped[name][index];
  runState.equipped[name][index]=gear;
  if(replaced&&replaced!==gear&&!runState.gear.includes(replaced))runState.gear.push(replaced);
  runState.gear=runState.gear.filter(g=>g!==gear);
  renderOps();toastMessage(replaced?`${gear} replaced ${replaced}`:`${gear} equipped to ${name} · slot ${index+1}`);return true;
}
function equipShip(name,index){
  if(!Number.isInteger(index)||index<0||index>=runState.shipSlots){toastMessage('Upgrade the field to unlock this ship slot');return false}
  const oldIndex=runState.shipEquipped.indexOf(name);
  if(oldIndex>=0&&oldIndex!==index)runState.shipEquipped[oldIndex]=null;
  const replaced=runState.shipEquipped[index];
  if(replaced&&replaced!==name&&!runState.shipInventory.includes(replaced))runState.shipInventory.push(replaced);
  runState.shipEquipped[index]=name;runState.shipInventory=runState.shipInventory.filter(x=>x!==name);renderOps();toastMessage(`${name} equipped to the ship`);return true;
}

function payloadFrom(el){
  if(el.matches('[data-forge-input]'))return {kind:'gear',name:el.dataset.forgeInput,from:'inventory'};
  if(el.matches('.unit'))return {kind:'crew',name:el.dataset.unit,from:'formation'};
  if(el.matches('.item'))return {kind:el.dataset.type==='characters'?'crew':el.dataset.type,name:el.dataset.item,from:'inventory'};
  if(el.matches('.reward-card')){const i=Number(el.dataset.card),card=activeCards[i];return {kind:card[0].toLowerCase(),name:card[1],from:'pack',index:i}}
  return null;
}
document.addEventListener('dragstart',e=>{const source=e.target.closest('[draggable="true"]');if(!source)return;if(coarsePointer){e.preventDefault();return}runState.drag=payloadFrom(source);if(runState.drag)e.dataTransfer.setData('text/plain',JSON.stringify(runState.drag));});
document.addEventListener('dragover',e=>{const zone=e.target.closest('.drop-zone,.inventory,.unit,.pack-action-drop');if(!zone)return;e.preventDefault();zone.classList.add('drag-over')});
document.addEventListener('dragleave',e=>{const zone=e.target.closest('.drag-over');if(zone)zone.classList.remove('drag-over')});
document.addEventListener('drop',e=>{const zone=e.target.closest('.drop-zone,.inventory,.unit,.pack-action-drop');if(!zone)return;e.preventDefault();document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));let data=runState.drag;try{data=JSON.parse(e.dataTransfer.getData('text/plain'))||data}catch(_){}handleDrop(data,zone);runState.drag=null});

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
  touchDrag.zone=document.elementFromPoint(e.clientX,e.clientY)?.closest('.drop-zone,.inventory,.unit,.pack-action-drop')||null;
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
  if(zone.dataset.combineWith){if(data.from==='inventory'&&data.kind==='gear')previewRecipe(data.name,zone.dataset.combineWith);return}
  if(zone.dataset.forgeInput){if(data.from==='inventory'&&data.kind==='gear')previewRecipe(data.name,zone.dataset.forgeInput);return}
  if(data.kind==='crew'&&zone.dataset.gearOwner)zone=zone.closest('.unit')||zone;
  if(zone.dataset.packAction){if(data.from==='pack')resolveCard(data.index,zone.dataset.packAction);return}
  const row=zone.dataset.row||(zone.closest('.crew-row')?.querySelector('.row-label b')?.textContent.startsWith('ON')?'field':'support');
  if(data.kind==='crew'&&(zone.dataset.row||zone.classList.contains('slot')||zone.classList.contains('unit'))){const move=()=>placeCrew(data.name,zone.dataset.row||zone.dataset.sourceRow||row,Number(zone.dataset.slotIndex));if(data.from==='pack')resolveCard(data.index,'field',move);else move();return}
  if(data.kind==='gear'&&zone.dataset.gearOwner){const equip=()=>equipGear(zone.dataset.gearOwner,data.name,Number(zone.dataset.gearIndex));if(data.from==='pack')resolveCard(data.index,'equipped',equip);else equip();return}
  if(data.kind==='ship'&&zone.dataset.shipIndex!==undefined){const equip=()=>equipShip(data.name,Number(zone.dataset.shipIndex));if(data.from==='pack')resolveCard(data.index,'equipped',equip);else equip();return}
  if(zone.classList.contains('inventory')){if(data.from==='formation')returnCrew(data.name);else if(data.from==='pack')resolveCard(data.index,'inventory');return}
  if(zone.classList.contains('unit')&&data.kind==='gear'){const equip=()=>equipGear(zone.dataset.unit,data.name);if(data.from==='pack')resolveCard(data.index,'equipped',equip);else equip()}
}

document.addEventListener('click',e=>{
  if(Date.now()<touchSuppressUntil){e.preventDefault();e.stopImmediatePropagation();return}
  const unit=e.target.closest('.unit');
  if(unit){showModal(characterDetails(unit.dataset.unit,'formation'));return}
  const slot=e.target.closest('.slot');if(slot){showCrewPicker(slot.dataset.row,Number(slot.dataset.slotIndex));return}
},{capture:true});

function showCrewPicker(row,slotIndex){
  const choices=runState.reserve.map(n=>`<button data-place="${row}" data-slot-index="${slotIndex}" data-name="${n}" ${canPlace(n,row)?'':'disabled'}>${n}<small>${positionLabel(n)}</small></button>`).join('');
  showModal(`<div class="eyebrow">PLACE CREW · ${deployed().length} / ${runState.capacity}</div><h2>${row==='field'?'On field':'Off field'}</h2><p class="lede">Drag a crew card here or choose one below. Dimmed crew cannot use this position.</p><div class="modal-actions">${choices||'<span>No reserve crew available.</span>'}</div>`)
}
function returnEquippedGear(name){
  (runState.equipped[name]||[]).filter(Boolean).forEach(gear=>{if(!runState.gear.includes(gear))runState.gear.push(gear)});
  delete runState.equipped[name];
}
modalBody.addEventListener('click',e=>{const place=e.target.closest('[data-place]');if(place){if(placeCrew(place.dataset.name,place.dataset.place,Number(place.dataset.slotIndex)))overlay.classList.remove('open');return}const ret=e.target.closest('[data-return]');if(ret){returnCrew(ret.dataset.return);overlay.classList.remove('open');return}const sell=e.target.closest('[data-sell-character]');if(sell){const name=sell.dataset.sellCharacter;if(runState.reserve.includes(name)){returnEquippedGear(name);removeCrew(name);delete runState.crewUpgrades[name];runState.gold+=1;renderOps();toastMessage(`${name} sold for 1 gold`)}overlay.classList.remove('open');return}const scrap=e.target.closest('[data-scrap-character]');if(scrap){const name=scrap.dataset.scrapCharacter;if(runState.reserve.includes(name)){returnEquippedGear(name);removeCrew(name);delete runState.crewUpgrades[name];runState.scrap+=7;renderOps();toastMessage(`${name} dismantled for 7 Scrap`)}overlay.classList.remove('open')}});
inventoryHost.onclick=e=>{const item=e.target.closest('[data-item]');if(!item)return;const name=item.dataset.item,type=item.dataset.type;if(type==='characters')showModal(characterDetails(name,'inventory'));else{const effect=type==='gear'?(gearEffects[name]||'Improves one crew member while equipped.'):type==='ship'?(shipEffects[name]||'Changes the rules for the whole expedition.'):`${name} is used for crafting and upgrades.`;showModal(`<div class="eyebrow">${type.toUpperCase()}</div><h2>${name}</h2><p class="lede">${effect}</p>`)}};

function installPackTargets(){
  if($('takeAll'))return;
  const panel=document.querySelector('.resolve-panel');
  panel.insertAdjacentHTML('beforeend',`<div class="pack-drop-actions"><button class="take-all" id="takeAll">TAKE ALL REMAINING</button></div>`);
  $('takeAll').onclick=takeAll;
}
function packPrice(key){return packs[key].price+Rules.effects(runState).packCost}
function closePack(){activePack=null;activeCards=[];resolved=[];selectedIndex=-1;runState.pack=null;openedPack.classList.add('hidden');packSelect.classList.remove('hidden');renderPackOffers();renderOps()}
openPack=function(key){
  if(activePack){toastMessage('Resolve the current pack first');return}
  const price=packPrice(key);if(runState.gold<price){toastMessage('Not enough gold');return}
  runState.gold-=price;runState.openedThisRound=true;activePack=key;activeCards=rollPackCards(key);selectedIndex=-1;resolved=activeCards.map((_,index)=>index<2);
  activeCards.slice(0,2).forEach(card=>{const amount=parseInt(card[1].match(/\d+/)?.[0]||'1');if(card[0]==='CURRENCY')runState.gold+=amount;else if(card[0]==='MATERIAL'&&/crystal/i.test(card[1]))runState.crystals+=amount;else if(card[0]==='MATERIAL')runState.scrap+=amount});
  if(runState.duplicatePolicy!=='ask')activeCards.forEach((card,i)=>{if(i>1&&card[0]==='CREW'&&ownedCard(card))resolveCard(i,runState.duplicatePolicy,null,true)});
  packSelect.classList.add('hidden');openedPack.classList.remove('hidden');renderPack();renderOps();
};
renderPack=function(){
  if(!activePack)return;
  $('openPackName').textContent=packs[activePack].name;
  document.querySelector('.open-summary p').innerHTML=activeCards.slice(0,2).map(c=>`<span class="receipt">✓ ${c[1]} credited</span>`).join('');
  packCards.innerHTML=activeCards.slice(2).map((c,index)=>{const i=index+2;return `<article class="reward-card ${c[0]==='CREW'?'has-position has-portrait':''} ${resolved[i]?'resolved':''} ${c[5]?'prime':''}" draggable="${!resolved[i]}" style="--tone:${c[4]}" data-card="${i}" data-resolution="${resolved[i]?'RESOLVED':''}"><button class="reward-select" data-card-select="${i}" aria-label="View ${c[1]} details">${c[0]==='CREW'?positionBadge(c[1])+portraitMarkup(c[1],'reward-portrait'):'<div class="reward-symbol">'+(c[0]==='GEAR'?'◈':'▣')+'</div>'}<span class="type">${c[5]?'PRIME · ':''}${c[0]}${ownedCard(c)?' · OWNED':''}</span><b>${c[1]}</b><span class="reward-effect">${c[0]==='CREW'?crewInfo(c[1])[0]:c[2]}</span></button>${!resolved[i]?`<div class="reward-actions"><button data-card-action="inventory" data-card-index="${i}">KEEP</button><button data-card-action="scrap" data-card-index="${i}">SCRAP</button><button data-card-action="sell" data-card-index="${i}">SELL</button></div>`:''}</article>`}).join('');
  const left=resolved.filter((x,i)=>!x&&i>1).length;$('resolveCount').textContent=`${left} cards remaining`;finishPack.disabled=left>0;
  $('selectedCard').textContent='Resolve remaining';$('selectedDesc').textContent='Tap any card for its effect. Duplicate keeps convert to scrap.';
};
function ownedCard(card){
  const [type,name]=card;
  if(type==='CREW')return runState.reserve.includes(name)||deployed().includes(name);
  if(type==='GEAR')return runState.gear.includes(name)||Object.values(runState.equipped).some(items=>(items||[]).includes(name));
  if(type==='SHIP')return runState.shipInventory.includes(name)||runState.shipEquipped.includes(name);
  return false;
}
function cardScrap(card){return card[0]==='CREW'?7:4}
function storeCard(card){
  const [type,name]=card;
  if(type==='CREW')runState.reserve.push(name);
  if(type==='GEAR')runState.gear.push(name);
  if(type==='SHIP')runState.shipInventory.push(name);
}
function resolveCard(index,action,perform,quiet=false){
  if(!activePack||index<2||index>=activeCards.length||resolved[index])return false;
  const card=activeCards[index],duplicate=ownedCard(card);
  if((action==='field'||action==='equipped')&&!duplicate&&(!perform||perform()!==true))return false;
  if(action==='inventory'){if(duplicate)runState.scrap+=cardScrap(card);else storeCard(card)}
  if((action==='field'||action==='equipped')&&duplicate)runState.scrap+=cardScrap(card);
  if(action==='scrap')runState.scrap+=cardScrap(card);
  if(action==='sell')runState.gold+=1;
  if(card[5])runState.scrap+=2;
  resolved[index]=true;selectedIndex=-1;
  if(!quiet){if(resolved.every(Boolean))closePack();else{renderPack();renderOps()}toastMessage(`${card[1]} ${action==='scrap'?'dismantled':action==='sell'?'sold':duplicate?'converted to Scrap':'saved'}`)}
  return true;
}
function takeAll(){activeCards.forEach((_,i)=>{if(i>1&&!resolved[i])resolveCard(i,'inventory',null,true)});selectedIndex=-1;closePack();toastMessage('All remaining cards kept; duplicates converted to scrap')}
function previewCard(index){
  const c=activeCards[index];if(!c||resolved[index])return;
  selectedIndex=index;
  const details=c[0]==='CREW'?characterDetails(c[1],'pack'):`<div class="eyebrow">${c[0]}${c[5]?' · PRIME':''}</div><h2>${c[1]}</h2><p class="lede">${c[2]}</p>`;
  showModal(details+`<p>${ownedCard(c)?'Already owned. Keeping converts this copy to '+cardScrap(c)+' scrap.':''}${c[5]?' Prime: +2 bonus scrap on resolution.':''}</p><div class="modal-actions"><button data-pack-modal="inventory" data-index="${index}">KEEP</button><button data-pack-modal="scrap" data-index="${index}">SCRAP · +${cardScrap(c)}</button><button data-pack-modal="sell" data-index="${index}">SELL · +1g</button></div>`);
  if(c[0]==='CREW')modalBody.querySelectorAll('[data-place],[data-return]').forEach(b=>b.remove());
}
packCards.onclick=e=>{const action=e.target.closest('[data-card-action]');if(action){resolveCard(Number(action.dataset.cardIndex),action.dataset.cardAction);return}const select=e.target.closest('[data-card-select]');if(select)previewCard(Number(select.dataset.cardSelect))};
resolveRemaining=function(kind){activeCards.forEach((_,i)=>{if(i>1&&!resolved[i])resolveCard(i,kind==='SCRAPPED'?'scrap':'sell',null,true)});closePack();toastMessage(kind==='SCRAPPED'?'Remaining cards dismantled':'Remaining cards sold')};
finishPack.onclick=()=>{if(resolved.every(Boolean))closePack()};

$('levelField').onclick=()=>{
  if(runState.capacity>=12){toastMessage('Maximum team capacity reached');return}const cost=12+(runState.level-1)*6;if(runState.gold<cost){toastMessage('Not enough gold to level the field');return}
  runState.gold-=cost;runState.level+=1;
  if(runState.level%2===0)runState.capacity+=1;else runState.shipSlots+=1;
  renderOps();toastMessage(runState.level%2===0?'Character capacity increased':'Ship equipment slot unlocked');
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
  $('resultTitle').textContent=message;$('resultCopy').textContent=won?'The crew recovered the encounter and returned its field record.':'The ship recovered what data it could before extraction.';$('resultIntegrity').textContent=`${integrityDelta>=0?'+':''}${integrityDelta}%`;$('resultGold').textContent=`+${gold}g`;$('resultObservation').textContent=observation?'COMPLETE':'PARTIAL';$('battleResult').classList.add('open');
}
function enterBattle(){
  if(!runState.field.some(Boolean)){toastMessage('Place at least one character on field');return}
  if(deployed().length<1){toastMessage('Deploy a crew before launch');return}
  if(activePack){toastMessage('Resolve the open pack before launch');return}
  if(runState.round>runState.maxRounds){showVoyageEnd();return}
  runState.goalLocked=true;runState.combatStats=battleStats;
  localStorage.setItem('spacologyRunV010',JSON.stringify(runState));
  location.href=`watchable-fight.html?spacology=1&round=${runState.round}`;
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
$('newVoyage').onclick=()=>{localStorage.removeItem('spacologyRunV010');localStorage.removeItem('spacologyBattleResult');location.reload()};

function applyBattleResult(){
  let result=null;try{result=JSON.parse(localStorage.getItem('spacologyBattleResult'))}catch(_){}
  if(!result||result.round!==runState.round)return;
  const before=runState.integrity;
  runState.gold+=result.gold;runState.integrity=Math.max(0,Math.min(100,runState.integrity+result.integrity));
  runState.crystals+=(result.crystals||0);runState.rarePity=result.rarePity||0;
  let duplicate=false;
  if(result.item){const list=result.item.type==='ship'?runState.shipInventory:runState.gear;const card=[result.item.type.toUpperCase(),result.item.name];duplicate=ownedCard(card);if(duplicate)runState.scrap+=4;else list.push(result.item.name)}
  if(result.won)runState.battlesWon++;if(result.observation)runState.observations++;
  runState.goalProgress+=Rules.goalGain(runState,result);
  const goalReward=!runState.goalClaimed&&runState.goalProgress>=Rules.goal(runState).target;
  if(goalReward){runState.goalClaimed=true;runState.gold+=8;runState.crystals++}
  runState.inbox.push({round:result.round,won:result.won,gold:result.gold,integrity:runState.integrity-before,crystals:result.crystals||0,item:result.item?.name||null,duplicate,goalReward,actions:result.actions,breaks:result.breaks,chains:result.chains,ultimates:result.ultimates,reason:result.reason,timeLimit:result.timeLimit,elapsedAV:result.elapsedAV,enemyAttacks:result.enemyAttacks,enemyRecoveries:result.enemyRecoveries,recovery:result.recovery});
  runState.round++;runState.goalLocked=true;
  runState.packRefreshes=0;runState.packOffers=rollPackOffers(runState.packOffers);
  // Commit the advanced round with its rewards before consuming the separate result.
  localStorage.setItem('spacologyRunV010',JSON.stringify(runState));
  localStorage.removeItem('spacologyBattleResult');
  if(runState.round>runState.maxRounds)showVoyageEnd();
  else setTimeout(()=>toastMessage(`Encounter ${runState.round} ready · rewards recorded in your inbox`),80);
}
function showVoyageEnd(){
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
  document.querySelector('.harmonies').innerHTML='<div class="eyebrow">HARMONIES</div>'+Object.keys(Rules.tags).filter(t=>counts[t]).map(t=>`<button class="harmony" data-live-harmony="${t}"><span class="harmony-icon">◇</span><span><b>${t} · ${counts[t]}</b><span class="breaks">${breakpoint(counts[t],[2,4])}</span></span></button>`).join('')+(names.length?'':'<p class="empty-hint">Deploy crew to build harmonies.</p>')+'<div class="eyebrow">HOMEWORLD</div>'+Object.entries(planets).map(([p,n])=>`<button class="harmony" data-planet-harmony="${p}"><span class="harmony-icon">◎</span><span><b>${p} · ${n}</b><span class="breaks">${breakpoint(n,[2,3])}</span></span></button>`).join('');
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
  showModal(`<div class="eyebrow">RECOVERY INBOX · ALREADY CREDITED</div><h2>What came home</h2><p class="lede">A receipt for each encounter. Reading it does not collect rewards again.</p>${runState.inbox.slice().reverse().map(entry=>`<article class="receipt-entry"><h3>Encounter ${entry.round} · ${entry.won?'Recovered':entry.reason==='timeout'?'Time expired':'Partial recovery'}</h3><p>+${entry.gold} gold · ${entry.integrity>=0?'+':''}${entry.integrity}% integrity${entry.crystals?' · +'+entry.crystals+' crystals':''}</p>${entry.item?`<p>${entry.item}${entry.duplicate?' → 4 scrap (already owned)':''}</p>`:''}${entry.goalReward?'<p>Voyage goal completed: +8 gold and +1 crystal.</p>':''}<small>${entry.actions||0} actions · ${entry.breaks||0} breaks · ${entry.chains||0} chains · ${entry.ultimates||0} ultimates${entry.recovery?` · ${entry.recovery.earned}/${entry.recovery.total} recovery pts (${Math.floor(entry.recovery.percent)}%)`:''}${Number.isFinite(entry.elapsedAV)?` · ${(entry.elapsedAV/100).toFixed(2)} / ${entry.timeLimit} rounds`:''}</small></article>`).join('')||'<p>No recovery yet. Finish an encounter to record its rewards here.</p>'}`);
}
function showGoals(){
  showModal(`<div class="eyebrow">VOYAGE GOAL</div><h2>Choose your fieldwork</h2><p class="lede">Complete one goal for 8 gold and 1 crystal. Progress carries across encounters. Selection locks at first launch.</p><div class="system-options">${Object.entries(Rules.goals).map(([id,g])=>`<article class="modal-card"><h3>${g.name}${runState.goal===id?' · SELECTED':''}</h3><p>${g.description}</p><p>Encounter observation: ${g.battle}</p><button data-goal="${id}" ${runState.goalLocked?'disabled':''}>${runState.goal===id?`${Math.min(g.target,runState.goalProgress)} / ${g.target}${runState.goalClaimed?' · REWARDED':''}`:'SELECT GOAL'}</button></article>`).join('')}</div>`);
}
function modifierWindow(){return runState.round===1&&!runState.goalLocked?1:runState.round===4?4:0}
function showVoyageSettings(){
  const current=Rules.activeModifiers(runState),window=modifierWindow(),canChoose=window&&!runState.modifierChoices.includes(window)&&!activePack;
  showModal(`<div class="eyebrow">VOYAGE SETTINGS</div><h2>${voyageDifficulty.label}</h2><p class="lede">Base enemy health and damage: ${Math.round(voyageDifficulty.enemyScale*100)}% of standard. Enemy speed: ${Math.round(voyageDifficulty.enemySpeed*100)}%; shield strength: ${Math.round(voyageDifficulty.enemyGuard*100)}%. Breaks delay the next enemy turn by ${Math.round(voyageDifficulty.breakDelay*100)}% of its normal wait; enemies reform and attack on their recovery turn. This encounter has a ${SpacologyVoyageSettings.roundLimit(runState)}-round deadline. A round is 100 Action Value; animations and pauses do not spend it. Clear every wave before time expires. Losing crew does not shorten the deadline. Tap an enemy in battle to inspect its behavior. Choose one optional modifier before first launch and another at encounter 4. Each trade applies to future encounters. A category can appear only once.</p><div class="system-options">${Object.entries(Rules.modifiers).map(([id,m])=>`<article class="modal-card"><h3>${m.name}${current.includes(id)?' · ACTIVE':''}</h3><p>${m.description}</p><button data-modifier="${id}" ${!canChoose||current.some(key=>Rules.modifiers[key].category===m.category)?'disabled':''}>ADD MODIFIER</button>${current.includes(id)?`<button data-remove-modifier="${id}" ${runState.modifierRemovalUsed||runState.round<3||runState.gold<8||activePack?'disabled':''}>REMOVE · 8g</button>`:''}</article>`).join('')}</div><p>One removal per voyage, available from encounter 3. ${runState.modifierRemovalUsed?'Already used.':''}</p><button data-show-goals>VIEW VOYAGE GOAL</button>`);
}
function showDuplicateSettings(){
  showModal(`<div class="eyebrow">INVENTORY PREFERENCES</div><h2>Already-owned crew</h2><p class="lede">Applies automatically when a new pack opens. The owned character and their equipment stay untouched. Duplicate items still resolve manually; keeping one converts it to scrap.</p><div class="modal-actions">${[['ask','Choose each time'],['scrap','Auto scrap · +7'],['sell','Auto sell · +1g']].map(([id,name])=>`<button data-duplicate-policy="${id}" aria-pressed="${runState.duplicatePolicy===id}">${name}${runState.duplicatePolicy===id?' ✓':''}</button>`).join('')}</div>`);
}
function previewRecipe(a,b){
  const recipe=Rules.recipes.find(r=>r.inputs.includes(a)&&r.inputs.includes(b)&&a!==b);
  if(!recipe){toastMessage('No recipe for these two items. See Forge for combinations.');return}
  showRecipe(recipe.name);
}
function canCraft(r){return r.inputs.every(n=>runState.gear.includes(n))&&!ownedCard(['GEAR',r.name])}
function showRecipe(name){
  const r=Rules.recipes.find(r=>r.name===name);if(!r)return;
  showModal(`<div class="eyebrow">COMBINE TWO GEAR ITEMS</div><h2>${r.name}</h2><p class="lede">${r.effect}</p><p>${r.inputs.join(' + ')} → ${r.name}</p><p>The two unequipped inputs are consumed. No gold or materials are charged.</p><button data-craft="${r.name}" ${canCraft(r)?'':'disabled'}>COMBINE</button>`);
}
function showForge(){
  showModal(`<div class="eyebrow">FORGE</div><h2>Two items. One upgrade.</h2><p class="lede">Drop one loose gear item onto another to preview its recipe. Equipped gear must be returned to inventory first.</p><div class="forge-inventory">${runState.gear.map(n=>`<button draggable="true" class="drop-zone" data-forge-input="${n}">${n}</button>`).join('')||'<p>No unequipped gear.</p>'}</div><div class="system-options">${Rules.recipes.map(r=>`<article class="modal-card"><h3>${r.name}</h3><p>${r.inputs.join(' + ')}</p><p>${r.effect}</p><button data-recipe="${r.name}">${canCraft(r)?'PREVIEW COMBINATION':'VIEW RECIPE'}</button></article>`).join('')}</div><h3>Crew upgrades</h3><p>Each rank adds 15% base health and 10% base attack. Maximum rank III. Each upgrade costs 8 scrap and 1 crystal.</p><div class="modal-actions">${[...deployed(),...runState.reserve].map(n=>`<button data-upgrade-crew="${n}" ${(runState.crewUpgrades[n]||0)>=3||runState.scrap<8||runState.crystals<1?'disabled':''}>${n} · RANK ${runState.crewUpgrades[n]||0} → ${(runState.crewUpgrades[n]||0)+1}</button>`).join('')}</div>`);
}
function showAttunements(){
  const elements=[...new Set(Object.values(Rules.crew).map(c=>c.element))];
  showModal(`<div class="eyebrow">ATTUNEMENTS</div><h2>Choose an element</h2><p class="lede">Craft a token for ${Rules.attuneScrap} scrap and ${Rules.attuneCrystals} crystal. Spend it to recruit a specific unowned crew member of that element. Elements without prototype crew are omitted.</p><div class="system-options">${elements.map(element=>`<article class="modal-card"><h3>${element} · ${runState.attunements[element]||0} owned</h3><p>${Object.keys(Rules.crew).filter(n=>Rules.crew[n].element===element).join(', ')}</p><button data-craft-attunement="${element}" ${runState.scrap<Rules.attuneScrap||runState.crystals<Rules.attuneCrystals?'disabled':''}>CRAFT · ${Rules.attuneScrap} SCRAP + 1 CRYSTAL</button><button data-use-attunement="${element}" ${runState.attunements[element]>0?'':'disabled'}>USE ATTUNEMENT</button></article>`).join('')}</div>`);
}
function showRecruitment(element){
  const attuned=!!element;
  showModal(`<div class="eyebrow">${attuned?'ATTUNED RECRUITMENT':'BARRACKS'}</div><h2>${attuned?element+' crew':'Recruit a specific crewmate'}</h2><p class="lede">${attuned?'Consumes one attunement. No gold cost.':`Recruitment costs ${Rules.recruitCost} gold. One recruitment per encounter. Tap a portrait for character details.`}</p><div class="recruit-grid">${Object.keys(Rules.crew).filter(n=>!element||Rules.crew[n].element===element).map(n=>`<article class="modal-card"><button class="recruit-preview" data-view-crew="${n}">${portraitMarkup(n,'recruit-art')}<b>${n}</b></button><p>${crewInfo(n)[0]}<br>${positionLabel(n)}</p><button data-recruit="${n}" data-element="${element||''}" ${ownedCard(['CREW',n])||(!attuned&&(runState.gold<Rules.recruitCost||runState.recruitedRound===runState.round))||(attuned&&!(runState.attunements[element]>0))?'disabled':''}>${ownedCard(['CREW',n])?'OWNED':attuned?'USE TOKEN':'RECRUIT · '+Rules.recruitCost+'g'}</button></article>`).join('')}</div>`);
}
previewPack=function(key){
  const p=packs[key],pool=[];Object.values(packs).forEach(pack=>pack.cards.slice(2).forEach(c=>{if(!pool.some(x=>x[0]===c[0]&&x[1]===c[1]))pool.push(c)}));
  showModal(`<div class="eyebrow">SEALED PACK PREVIEW</div><h2>${p.name} · ${packPrice(key)}g</h2><p class="lede">2 gear, 1 ship item and 2 crew, plus automatic currency and materials. Each card draws from its themed pool 65% of the time when an unused themed card is available. Otherwise it draws from the wider pool. A 16% pack chance upgrades one card to Prime (+2 scrap).</p><div class="system-options">${pool.map(c=>`<button data-pool-card="${c[0]}" data-name="${c[1]}"><b>${c[1]}</b><small>${c[0]}${p.cards.some(x=>x[1]===c[1])?' · THEMED':''}</small></button>`).join('')}</div>`);
};
function showItem(name,type){showModal(`<div class="eyebrow">${type.toUpperCase()}</div><h2>${name}</h2><p class="lede">${type==='gear'?gearEffects[name]:shipEffects[name]}</p>`)}
const oldInventoryClick=inventoryHost.onclick;
inventoryHost.onclick=e=>{const material=e.target.closest('[data-material]');if(material){showAttunements();return}oldInventoryClick(e)};
document.querySelector('[data-info="forge"]').onclick=showForge;
document.querySelector('[data-info="attune"]').onclick=showAttunements;
document.querySelector('[data-info="barracks"]').onclick=()=>showRecruitment();
document.querySelector('[data-info="manage"]').onclick=showDuplicateSettings;
document.querySelector('[data-info="map"]').onclick=()=>showModal(`<h2>Voyage route</h2><p><a href="star-atlas.html" target="_blank" rel="noopener">OPEN STAR ATLAS · HOMEWORLDS</a></p>${Rules.route.map((name,i)=>`<p>${i+1}. ${name} · ${i+1<runState.round?'complete':i+1===runState.round?'current':'ahead'}</p>`).join('')}`);
showToast=function(message){toast.textContent=message;const button=document.createElement('button');button.textContent='DISMISS';button.onclick=()=>toast.classList.remove('show');toast.append(button);toast.classList.add('show')};
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-open-inbox'))showInbox();
  if(b.hasAttribute('data-show-goals'))showGoals();
  if(b.hasAttribute('data-duplicate-settings'))showDuplicateSettings();
  if(b.dataset.duplicatePolicy){runState.duplicatePolicy=b.dataset.duplicatePolicy;renderPackOffers();renderOps();showDuplicateSettings()}
  if(b.dataset.liveHarmony){const tag=b.dataset.liveHarmony,members=deployed().filter(n=>Rules.crew[n]?.tags.includes(tag));showModal(`<h2>${tag} · ${members.length} crew</h2><p>2: ${Rules.tags[tag][0]}</p><p>4: ${Rules.tags[tag][1]}</p><p>${members.join(', ')}</p>`)}
  if(b.dataset.planetHarmony){const planet=b.dataset.planetHarmony,members=deployed().filter(n=>Rules.crew[n]?.planet===planet);showModal(`<h2>${planet} · ${members.length} crew</h2><p>2: All deployed crew gain 8% base health.</p><p>3: Increases to 15%. Bonuses from different planets add together.</p><p>${members.join(', ')}</p><p>Shared ancestral-world affiliation. Birthplace and ancestry can differ; proposed assignments are shown in the star atlas.</p>`)}
  if(b.dataset.route!==undefined){const i=Number(b.dataset.route);showModal(`<h2>Encounter ${i+1} · ${Rules.route[i]}</h2><p>${i+1<runState.round?'Completed':i+1===runState.round?'Prepare your crew, then launch.':'Upcoming encounter. Enemy strength increases along the route.'}</p>`)}
});
modalBody.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.packModal){resolveCard(Number(b.dataset.index),b.dataset.packModal);overlay.classList.remove('open')}
  if(b.dataset.poolCard){if(b.dataset.poolCard==='CREW'){showModal(characterDetails(b.dataset.name,'preview'));modalBody.querySelectorAll('[data-place],[data-return]').forEach(x=>x.remove())}else showItem(b.dataset.name,b.dataset.poolCard.toLowerCase())}
  if(b.dataset.viewCrew){showModal(characterDetails(b.dataset.viewCrew,'preview'));modalBody.querySelectorAll('[data-place],[data-return]').forEach(x=>x.remove())}
  if(b.dataset.recipe)showRecipe(b.dataset.recipe);
  if(b.dataset.craft){const r=Rules.recipes.find(r=>r.name===b.dataset.craft);if(!r||!canCraft(r))return;runState.gear=runState.gear.filter(n=>!r.inputs.includes(n));runState.gear.push(r.name);renderOps();showForge();toastMessage(r.name+' crafted')}
  if(b.dataset.upgradeCrew){const n=b.dataset.upgradeCrew;if(!ownedCard(['CREW',n])||runState.scrap<8||runState.crystals<1||(runState.crewUpgrades[n]||0)>=3)return;runState.scrap-=8;runState.crystals--;runState.crewUpgrades[n]=(runState.crewUpgrades[n]||0)+1;renderOps();showForge()}
  if(b.dataset.craftAttunement){const element=b.dataset.craftAttunement;if(!Object.values(Rules.crew).some(c=>c.element===element)||runState.scrap<Rules.attuneScrap||runState.crystals<Rules.attuneCrystals)return;runState.scrap-=Rules.attuneScrap;runState.crystals-=Rules.attuneCrystals;runState.attunements[element]=(runState.attunements[element]||0)+1;renderOps();showAttunements()}
  if(b.dataset.useAttunement)showRecruitment(b.dataset.useAttunement);
  if(b.dataset.recruit){const n=b.dataset.recruit,element=b.dataset.element;if(!Rules.crew[n]||ownedCard(['CREW',n]))return;if(element){if(Rules.crew[n].element!==element||!(runState.attunements[element]>0))return;runState.attunements[element]--}else{if(runState.gold<Rules.recruitCost||runState.recruitedRound===runState.round)return;runState.gold-=Rules.recruitCost;runState.recruitedRound=runState.round}runState.reserve.push(n);renderOps();showRecruitment(element);toastMessage(n+' recruited')}
  if(b.dataset.goal&&!runState.goalLocked&&Rules.goals[b.dataset.goal]){runState.goal=b.dataset.goal;runState.goalProgress=0;renderOps();showGoals()}
  if(b.dataset.modifier){const id=b.dataset.modifier,m=Rules.modifiers[id],window=modifierWindow();if(!m||!window||runState.modifierChoices.includes(window)||Rules.activeModifiers(runState).some(k=>Rules.modifiers[k].category===m.category)||activePack)return;runState.modifiers.push(id);runState.modifierChoices.push(window);renderPackOffers();renderOps();showVoyageSettings()}
  if(b.dataset.removeModifier){const id=b.dataset.removeModifier;if(runState.round<3||runState.modifierRemovalUsed||runState.gold<8||!runState.modifiers.includes(id)||activePack)return;runState.modifiers=runState.modifiers.filter(m=>m!==id);runState.gold-=8;runState.modifierRemovalUsed=true;renderPackOffers();renderOps();showVoyageSettings()}
});

renderPackOffers();installPackTargets();applyBattleResult();
if(runState.pack&&packs[runState.pack.key]&&Array.isArray(runState.pack.cards)){activePack=runState.pack.key;activeCards=runState.pack.cards;resolved=runState.pack.resolved;packSelect.classList.add('hidden');openedPack.classList.remove('hidden');renderPack()}
renderPackOffers();renderOps();if(runState.round>runState.maxRounds)showVoyageEnd();
})();
