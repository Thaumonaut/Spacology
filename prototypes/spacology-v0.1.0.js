(function(){
'use strict';

const starterCrew=['Tarn','Ash','Quill','Maul','Bosk','Coda','Morrow','Spore'];
function shuffled(values){const copy=[...values];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
const starterFront=shuffled(['Tarn','Ash','Bosk','Morrow'])[0];
const starterRoster=[starterFront,...shuffled(starterCrew.filter(name=>name!==starterFront)).slice(0,2)];
const runState={
  schema:3,round:1,maxRounds:6,gold:42,integrity:100,level:1,capacity:4,shipSlots:1,
  field:Array(8).fill(null),support:Array(8).fill(null),reserve:starterRoster,gear:[],shipInventory:[],shipEquipped:[],
  equipped:{},scrap:0,crystals:0,rarePity:0,selected:null,drag:null,
  openedThisRound:false,battlesWon:0,observations:0,packRefreshes:0,
  packOffers:['rot','tempo','bulwark']
};
try{const saved=JSON.parse(localStorage.getItem('spacologyRunV010'));if(saved?.schema===runState.schema)Object.assign(runState,saved,{selected:null,drag:null})}catch(_){}

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
  Tarn:{role:'Front-line anchor',basic:['Brace Strike','Deals light damage and gains 8 Barrier.'],skill:['Bulwark Protocol','Redirects the next on-field hit to Tarn and reduces it.'],passive:['Load-bearing','When Barrier breaks, applies one Decay stack to the attacker.'],plan:'Keep Tarn on field when survival observations matter. Hull and Decay both reward sustained pressure.'},
  Ash:{role:'Break payoff',basic:['Sparkshot','Deals damage and extra guard damage to fractured targets.'],skill:['Reprisal','Immediately follows an ally who breaks a specimen.'],passive:['Flashpoint','Deals increased damage below 50% target health.'],plan:'Pair with fast breakers and Follow-up bonuses. Ash wants another crew member to create the break first.'},
  Quill:{role:'Off-field relay',basic:['Needlecast','Marks a specimen and exposes its weakest element.'],skill:['Survey Relay','Answers a marked ally attack with an off-field follow-up.'],passive:['Echo Mark','Every third follow-up grants team Energy.'],plan:'Keep Quill off field beside frequent attackers. Quick Latch increases how often Survey Relay can answer.'},
  Maul:{role:'Guard pressure',basic:['Ram','Deals damage and heavy guard damage.'],skill:['Bore Through','Hits every remaining guard layer on one specimen.'],passive:['Pressure Seal','Off-field attacks gain power while an on-field ally has Barrier.'],plan:'Build around Hull characters and multi-element breaks. Maul contributes safely from the support row.'},
  Bosk:{role:'Slow burst',basic:['Shell Burst','Heavy single-target damage with a slow recovery.'],skill:['Slow Fuse','Plants a charge that detonates after two allied actions.'],passive:['Overpressure','Detonations gain damage for each Decay stack.'],plan:'Use with Morrow or Tarn to seed Decay before the charge resolves. Speed Gear helps Bosk set up earlier.'},
  Coda:{role:'Follow-up battery',basic:['Pulse','Deals light Energy damage and advances the next responder.'],skill:['Refrain','Repeats the last allied follow-up at reduced power.'],passive:['Relay Chorus','Follow-up attacks grant 6 Energy to their source.'],plan:'Coda turns an existing Follow-up pair into an engine. Place off field unless an objective needs Energy actions.'},
  Morrow:{role:'Decay seeder',basic:['Inoculate','Applies one Decay stack.'],skill:['Scar Tissue','Increases the next Decay detonation without consuming stacks.'],passive:['Persistent Culture','Decay remains for one additional specimen action.'],plan:'Use with Bosk for delayed burst or Spore for wide application. Morrow needs time more than raw Attack.'},
  Spore:{role:'Ailment spread',basic:['Culture','Applies a Growth ailment to one specimen.'],skill:['Cross-contaminate','Copies one ailment to adjacent specimens.'],passive:['Airborne','When an afflicted specimen acts, spread its oldest ailment once.'],plan:'Best for spread and detonation observations. Avoid too much control when the objective needs enemies to act.'}
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
  Morrow:'../assets/crew/morrow-v1.webp',Spore:'../assets/crew/spore-v1.webp'
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

function toastMessage(message){showToast(message);setTimeout(()=>toast.classList.remove('show'),2400)}
function crewInfo(name){return unitData[name]||crewFallback[name]||['Crew · Order','Specialist','A newly catalogued crew member.']}
function crewTone(name){const tag=crewInfo(name)[0];if(tag.includes('Hull'))return 'var(--blue)';if(tag.includes('Follow'))return 'var(--red)';if(tag.includes('Assay'))return 'var(--violet)';if(tag.includes('Growth'))return 'var(--green)';return 'var(--decay)'}
function deployed(){return [...runState.field,...runState.support].filter(Boolean)}
function crewPosition(name){return crewPositions[name]||'both'}
function positionLabel(name){return crewPosition(name)==='field'?'ON FIELD ONLY':crewPosition(name)==='support'?'OFF FIELD ONLY':'ON OR OFF FIELD'}
function canPlace(name,row){return crewPosition(name)==='both'||crewPosition(name)===row}
function positionBadge(name){const position=crewPosition(name),kind=position==='field'?'front':position==='support'?'back':'both',label=positionLabel(name);return `<span class="position-badge ${kind}" title="${label}" aria-label="${label}"><i aria-hidden="true"></i><i aria-hidden="true"></i></span>`}
function portraitMarkup(name,className){const image=crewPortraits[name];return `<div class="${className}${image?' has-art':''}"${image?` style="background-image:url('${image}')"`:''}>${name[0]||''}</div>`}
function normalizeCrewPositions(){
  const seen=new Set(),reserve=[],pending=[];
  const normalizeRow=(values,row)=>Array.from({length:8},(_,index)=>{
    const name=values?.[index];
    if(!name||seen.has(name))return null;
    if(!canPlace(name,row)){pending.push(name);return null}
    seen.add(name);return name;
  });
  runState.field=normalizeRow(runState.field,'field');
  runState.support=normalizeRow(runState.support,'support');
  (runState.reserve||[]).forEach(name=>{if(name&&!seen.has(name)&&!reserve.includes(name)){seen.add(name);reserve.push(name)}});
  pending.forEach(name=>{if(name&&!seen.has(name)&&!reserve.includes(name)){seen.add(name);reserve.push(name)}});
  runState.reserve=reserve;
}
normalizeCrewPositions();
function characterDetails(name,location){
  const info=crewInfo(name),stats=battleStats[name]||{hp:92,dmg:15,speed:9},kit=crewKits[name]||{role:info[1],basic:['Basic attack','Deals damage to one specimen.'],skill:['Special action',info[2]],passive:['Field trait','Supports the crew through its listed Harmonies.'],plan:info[2]};
  const gear=(runState.equipped[name]||[]).filter(Boolean);
  const lastAction=location==='inventory'?`<button class="sell-action" data-sell-character="${name}">SELL · +1 GOLD</button><button class="danger" data-scrap-character="${name}">DISMANTLE · +7 SCRAP</button>`:`<button data-return="${name}">RETURN TO INVENTORY</button>`;
  return `<div class="eyebrow">CHARACTER · ${info[0]}</div><h2>${name}</h2><p class="lede"><strong>${kit.role}</strong> · ${info[2]}</p><div class="kit-stats"><div><span>HEALTH</span><b>${stats.hp}</b></div><div><span>ATTACK</span><b>${stats.dmg}</b></div><div><span>SPEED</span><b>${stats.speed}</b></div><div><span>POSITION</span><b>${positionLabel(name)}</b></div><div><span>GEAR</span><b>${gear.length} / 2</b></div></div><div class="kit-grid"><div class="kit-move"><label>BASIC</label><b>${kit.basic[0]}</b><p>${kit.basic[1]}</p></div><div class="kit-move"><label>SPECIAL</label><b>${kit.skill[0]}</b><p>${kit.skill[1]}</p></div><div class="kit-move"><label>PASSIVE</label><b>${kit.passive[0]}</b><p>${kit.passive[1]}</p></div></div><div class="build-note"><strong>HOW TO USE:</strong> ${kit.plan}</div><div class="modal-actions"><button data-place="field" data-name="${name}" ${canPlace(name,'field')?'':'disabled'}>MOVE ON FIELD</button><button data-place="support" data-name="${name}" ${canPlace(name,'support')?'':'disabled'}>MOVE OFF FIELD</button>${lastAction}</div>`;
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
      Array.from({length:8},(_,slotIndex)=>list[slotIndex]
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
  return [['Prism scrap',`×${runState.scrap} · Upgrades Gear and crew`],['Bloom crystal',`×${runState.crystals} · Crafts rare items and attunements`],['Order attunement','3 / 20 · Narrows an attunement pack to Order']];
}

renderInventory=function(type){
  inventoryTab=type;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===type));
  inventoryHost.innerHTML=inventoryEntries(type).map((x,i)=>`<article class="item ${type==='characters'?'character':type==='materials'?'material':''}" draggable="${type!=='materials'}" data-item="${x[0]}" data-type="${type}">${type==='characters'?positionBadge(x[0]):`<span class="lock">${i===0?'◆':''}</span>`}<span class="qty">${type==='materials'?x[1]:'×1'}</span>${type==='characters'?portraitMarkup(x[0],'item-icon'):'<div class="item-icon"></div>'}<b>${x[0]}</b><span>${x[1]}</span></article>`).join('');
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
  renderFormation();renderShip();renderInventory(inventoryTab);
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
  packSelect.innerHTML=runState.packOffers.map(key=>{const p=packs[key];return `<article class="pack"><span class="kind">${p.theme.toUpperCase()}</span><b class="price">${p.price}g</b><h3>${p.name}</h3><p>${p.theme}. Sealed contents vary by offer.</p><span class="odds">65% themed · 16% Prime</span><div class="pack-actions"><button data-preview="${key}">PREVIEW</button><button class="open" data-open="${key}">OPEN</button></div></article>`}).join('')+`<aside class="stock-note"><b>Three sealed packs</b><span>Open one or refresh all three. Exact cards and rarity stay concealed.</span><button id="refreshPacks">REFRESH · ${refreshCost}g</button></aside>`;
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
  if(slotIndex<0||slotIndex>7){toastMessage(`No open ${row==='field'?'on-field':'off-field'} slot`);return false}
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
  const source=e.target.closest('[draggable="true"]');if(!source)return;
  touchDrag={source,payload:payloadFrom(source),startX:e.clientX,startY:e.clientY,active:false,armed:false,ghost:null,zone:null,pointerId:e.pointerId,armTimer:null};
  touchDrag.armTimer=setTimeout(()=>{if(touchDrag&&touchDrag.pointerId===e.pointerId){touchDrag.armed=true;source.classList.add('drag-ready')}},180);
  try{source.setPointerCapture?.(e.pointerId)}catch(_){}
},{passive:true});
document.addEventListener('pointermove',e=>{
  if(!touchDrag||e.pointerId!==touchDrag.pointerId)return;
  const dx=e.clientX-touchDrag.startX,dy=e.clientY-touchDrag.startY;
  const distance=Math.hypot(dx,dy);
  if(!touchDrag.armed&&distance>=8){clearTimeout(touchDrag.armTimer);touchDrag.source.classList.remove('drag-ready');touchDrag=null;return}
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
  if(touchDrag.active){e.preventDefault();touchSuppressUntil=Date.now()+400;if(touchDrag.zone)handleDrop(touchDrag.payload,touchDrag.zone)}
  touchDrag.ghost?.remove();document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));touchDrag=null;
}
document.addEventListener('pointerup',finishTouchDrag,{passive:false});
document.addEventListener('pointercancel',finishTouchDrag,{passive:false});

function handleDrop(data,zone){
  if(!data)return;
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
modalBody.addEventListener('click',e=>{const place=e.target.closest('[data-place]');if(place){if(placeCrew(place.dataset.name,place.dataset.place,Number(place.dataset.slotIndex)))overlay.classList.remove('open');return}const ret=e.target.closest('[data-return]');if(ret){returnCrew(ret.dataset.return);overlay.classList.remove('open');return}const sell=e.target.closest('[data-sell-character]');if(sell){const name=sell.dataset.sellCharacter;if(runState.reserve.includes(name)){returnEquippedGear(name);removeCrew(name);runState.gold+=1;renderOps();toastMessage(`${name} sold for 1 gold`)}overlay.classList.remove('open');return}const scrap=e.target.closest('[data-scrap-character]');if(scrap){const name=scrap.dataset.scrapCharacter;if(runState.reserve.includes(name)){returnEquippedGear(name);removeCrew(name);runState.scrap+=7;renderOps();toastMessage(`${name} dismantled for 7 Scrap`)}overlay.classList.remove('open')}});
inventoryHost.onclick=e=>{const item=e.target.closest('[data-item]');if(!item)return;const name=item.dataset.item,type=item.dataset.type;if(type==='characters')showModal(characterDetails(name,'inventory'));else{const effect=type==='gear'?(gearEffects[name]||'Improves one crew member while equipped.'):type==='ship'?(shipEffects[name]||'Changes the rules for the whole expedition.'):`${name} is used for crafting and upgrades.`;showModal(`<div class="eyebrow">${type.toUpperCase()}</div><h2>${name}</h2><p class="lede">${effect}</p>`)}};

function installPackTargets(){
  if($('takeAll'))return;
  const panel=document.querySelector('.resolve-panel');
  panel.insertAdjacentHTML('beforeend',`<div class="pack-drop-actions"><button class="take-all" id="takeAll">TAKE ALL REMAINING</button></div>`);
  $('takeAll').onclick=takeAll;
}
openPack=function(key){
  const price=packs[key].price;if(runState.gold<price){toastMessage('Not enough gold');return}
  runState.gold-=price;runState.openedThisRound=true;activePack=key;activeCards=rollPackCards(key);selectedIndex=-1;resolved=activeCards.map((_,index)=>index<2);
  activeCards.slice(0,2).forEach(card=>{const amount=parseInt(card[1].match(/\d+/)?.[0]||'1');if(card[0]==='CURRENCY')runState.gold+=amount;else if(card[0]==='MATERIAL'&&/crystal/i.test(card[1]))runState.crystals+=amount;else if(card[0]==='MATERIAL')runState.scrap+=amount});
  packSelect.classList.add('hidden');openedPack.classList.remove('hidden');$('openPackName').textContent=packs[key].name;renderPack();renderOps();
};
renderPack=function(){
  const p=packs[activePack];if(!p)return;
  packCards.innerHTML=activeCards.map((c,i)=>`<article class="reward-card ${c[0]==='CREW'?'has-position has-portrait':''} ${i===selectedIndex?'selected':''} ${resolved[i]?'resolved':''} ${c[3]==='AUTO'?'auto':''} ${c[5]?'prime':''}" draggable="${i>1&&!resolved[i]}" style="--tone:${c[4]}" data-card="${i}" data-resolution="${c[3]==='AUTO'?'CLAIMED':resolved[i]?'RESOLVED':''}"><button class="reward-select" data-card-select="${i}" aria-label="View ${c[1]} details">${c[0]==='CREW'?positionBadge(c[1])+portraitMarkup(c[1],'reward-portrait'):''}<span class="type">${c[5]?'PRIME · ':''}${c[0]}</span><b>${c[1]}</b><span>${c[2]}</span><span class="delta">${i>1&&!resolved[i]?'DRAG OR CHOOSE':c[3]}</span></button>${i>1&&!resolved[i]?`<div class="reward-actions"><button data-card-action="inventory" data-card-index="${i}">KEEP</button><button data-card-action="scrap" data-card-index="${i}">SCRAP</button><button data-card-action="sell" data-card-index="${i}">SELL</button></div>`:''}</article>`).join('');
  const left=resolved.filter((x,i)=>!x&&i>1).length;$('resolveCount').textContent=`2 claimed · ${left} unresolved`;finishPack.disabled=left>0;
  if(selectedIndex>=2&&!resolved[selectedIndex]){$('selectedCard').textContent=activeCards[selectedIndex][1];$('selectedDesc').textContent=activeCards[selectedIndex][2]+(activeCards[selectedIndex][5]?' · Prime cards recover 2 bonus Scrap.':'')}else{$('selectedCard').textContent='Choose or drag a card';$('selectedDesc').textContent='Keep, Scrap, and Sell resolve a card immediately.'}
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
  if(index<2||resolved[index])return false;
  const card=activeCards[index],duplicate=ownedCard(card);
  if((action==='field'||action==='equipped')&&!duplicate&&(!perform||perform()!==true))return false;
  if(action==='inventory'){if(duplicate)runState.scrap+=cardScrap(card);else storeCard(card)}
  if((action==='field'||action==='equipped')&&duplicate)runState.scrap+=cardScrap(card);
  if(action==='scrap')runState.scrap+=cardScrap(card);
  if(action==='sell')runState.gold+=1;
  if(card[5])runState.scrap+=2;
  resolved[index]=true;selectedIndex=-1;
  if(!quiet){renderPack();renderOps();toastMessage(`${card[1]} ${action==='scrap'?'dismantled':action==='sell'?'sold':duplicate?'converted to Scrap':'saved'}`)}
  return true;
}
function takeAll(){activeCards.forEach((_,i)=>{if(i>1&&!resolved[i])resolveCard(i,'inventory',null,true)});selectedIndex=-1;renderPack();renderOps();toastMessage('All remaining cards moved to inventory')}
packCards.onclick=e=>{const action=e.target.closest('[data-card-action]');if(action){resolveCard(Number(action.dataset.cardIndex),action.dataset.cardAction);return}const select=e.target.closest('[data-card-select]');if(!select)return;const i=Number(select.dataset.cardSelect);if(i<2||resolved[i])return;selectedIndex=i;renderPack()};
document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>{if(selectedIndex<2)return;resolveCard(selectedIndex,b.dataset.resolve==='SCRAPPED'?'scrap':b.dataset.resolve==='SOLD'?'sell':'inventory')});
resolveRemaining=function(kind){activeCards.forEach((_,i)=>{if(i>1&&!resolved[i])resolveCard(i,kind==='SCRAPPED'?'scrap':'sell',null,true)});renderPack();renderOps();toastMessage(kind==='SCRAPPED'?'Remaining cards dismantled':'Remaining cards sold')};
finishPack.onclick=()=>{openedPack.classList.add('hidden');packSelect.classList.remove('hidden');toastMessage('Pack resolved. Formation updated')};

$('levelField').onclick=()=>{
  const cost=12+(runState.level-1)*6;if(runState.gold<cost){toastMessage('Not enough gold to level the field');return}
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
  runState.combatStats=battleStats;
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
  localStorage.removeItem('spacologyBattleResult');runState.gold+=result.gold;runState.integrity=Math.max(0,Math.min(100,runState.integrity+result.integrity));
  runState.crystals+=(result.crystals||0);runState.rarePity=result.rarePity||0;
  if(result.item){
    const list=result.item.type==='ship'?runState.shipInventory:runState.gear;
    const card=[result.item.type.toUpperCase(),result.item.name];
    if(ownedCard(card))runState.scrap+=4;else list.push(result.item.name);
  }
  if(result.won)runState.battlesWon++;if(result.observation)runState.observations++;runState.round++;
  runState.packRefreshes=0;runState.packOffers=rollPackOffers(runState.packOffers);
  localStorage.setItem('spacologyRunV010',JSON.stringify(runState));
  if(runState.round>runState.maxRounds){const grade=runState.integrity>=85?'A':runState.integrity>=70?'B':'C';$('voyageGrade').textContent=grade;$('voyageSummary').textContent=`${runState.integrity}% integrity · ${runState.battlesWon}/${runState.maxRounds} encounters recovered · ${runState.observations} observations completed.`;$('voyageEnd').classList.add('open')}else setTimeout(()=>{const rare=result.item?` · ${result.item.name} recovered`:result.crystals?` · ${result.crystals} crystal recovered`:'';toastMessage(`Round ${runState.round} ready · ${result.won?'fieldwork recovered':'partial recovery'}${rare}`)},80);
}
renderPackOffers();installPackTargets();applyBattleResult();renderPackOffers();renderOps();
})();
