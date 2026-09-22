(function(root){
  'use strict';
  const groups={
    damage:['Ash','Stella','Nour','Dolores','Beatriz','Bosk','Vitre','Arunima'],
    protector:['Ilka','Reva','Ojo','Otaremnivas','Tarn','Daven'],
    support:['Spore','Abike','Aurel','Nahana','Ekene','Coda','Redcap','The Mage','Ivara','Roonie','Veska','Latch'],
    hybrid:['Tomás','Imke','Idris','Wren','Nadira','Yusuf','Sevim','Aurelio','Navigator','Morrow','Maul','Quill','Hanae','Atsa','Ledger']
  };
  const roles=Object.fromEntries(Object.entries(groups).flatMap(([role,names])=>names.map(name=>[name,role])));
  const labels={damage:'Damage dealer',protector:'Protector',support:'Support',hybrid:'Damage / support hybrid'};
  function position(name){return roles[name]==='support'?'support':['damage','protector'].includes(roles[name])?'field':'both'}
  function allows(name,row){return position(name)==='both'||position(name)===row}
  function apply(roster){Object.entries(roster).forEach(([name,entry])=>{if(roles[name]){entry.position=position(name);entry.combatRole=labels[roles[name]]}})}
  // Preserve valid cells, relocate incompatible crew, and retain overflow in reserves.
  function normalize(state){
    const limits={field:5,support:7},pending=[],changes=[];
    state.reserve=state.reserve||[];
    for(const row of ['field','support']){
      const old=state[row]||[];
      state[row]=Array.from({length:limits[row]},(_,i)=>old[i]&&allows(old[i],row)?old[i]:null);
      old.forEach((name,i)=>{if(name&&(i>=limits[row]||!allows(name,row)))pending.push(name)});
    }
    for(const name of pending){
      const row=position(name)==='support'?'support':'field',other=row==='field'?'support':'field';
      let slot=state[row].indexOf(null);
      if(slot<0&&state[other].includes(null)){
        slot=state[row].findIndex(n=>n&&position(n)==='both');
        if(slot>=0){const hybrid=state[row][slot];state[other][state[other].indexOf(null)]=hybrid;changes.push(`${hybrid} → ${other==='field'?'front':'back'}`);state[row][slot]=null;}
      }
      if(slot>=0){state[row][slot]=name;changes.push(`${name} → ${row==='field'?'front':'back'}`)}
      else{if(!state.reserve.includes(name))state.reserve.push(name);changes.push(`${name} → reserves`)}
    }
    return changes;
  }
  const api={roles,labels,position,allows,apply,normalize};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.SpacologyFormation=api;if(root.SpacologyExpedition)apply(root.SpacologyExpedition.crew)}
})(typeof globalThis==='object'?globalThis:this);
