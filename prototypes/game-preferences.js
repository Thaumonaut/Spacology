/* Device preferences are shared by all voyages; combat checkpoints are save-slot specific. */
(function(){
  'use strict';
  const key='spacologyPreferencesV1';
  const defaults={speed:1,effects:'full',reducedMotion:false,autoBattle:true,pauseOnHide:true,recovery:'revive'};
  function normalize(value){const v=value||{};return {speed:[1,1.5,2].includes(Number(v.speed))?Number(v.speed):1,effects:['full','low','off'].includes(v.effects)?v.effects:'full',reducedMotion:typeof v.reducedMotion==='boolean'?v.reducedMotion:false,autoBattle:typeof v.autoBattle==='boolean'?v.autoBattle:true,pauseOnHide:typeof v.pauseOnHide==='boolean'?v.pauseOnHide:true,recovery:['lastStand','revive','none'].includes(v.recovery)?v.recovery:'revive'};}
  function load(){try{const raw=localStorage.getItem(key);if(raw)return normalize(JSON.parse(raw));}catch(_){}return {...defaults,reducedMotion:!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches};}
  function save(value){const settings=normalize(value);localStorage.setItem(key,JSON.stringify(settings));return settings;}
  function checkpointKey(){return window.SpacologyStore.run+'CombatV1';}
  function readCheckpoint(state){
    try{const value=JSON.parse(localStorage.getItem(checkpointKey()));if(value?.version===1&&value.seed===state?.treasureSeed&&value.round===state.round&&!state.end&&state.round<=state.maxRounds&&!value.combat?.over&&Array.isArray(value.combat?.units)&&Array.isArray(value.combat?.pool)&&Number.isFinite(value.combat.av)&&value.combat.team==='ops')return value;}catch(_){}
    return null;
  }
  function writeCheckpoint(state,combat){if(!state||!combat||combat.over)return false;const saved={version:1,seed:state.treasureSeed,round:state.round,savedAt:Date.now(),combat:{...combat,visualHP:null,visualBar:null,visualAether:null,damageTimeline:[]}};localStorage.setItem(checkpointKey(),JSON.stringify(saved));return true;}
  function clearCheckpoint(){localStorage.removeItem(checkpointKey());}
  window.SpacologyPreferences=Object.freeze({defaults,normalize,load,save,readCheckpoint,writeCheckpoint,clearCheckpoint});
})();
