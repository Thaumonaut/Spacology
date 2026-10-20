(function(){
  'use strict';
  const K=MiniGameKit,entries=SpacologyLibrary,$=id=>document.getElementById(id);
  const categories=['Combat','Exploration','Research','Logistics','Reserve','Reference'];
  const filters=['current','Research','Logistics','Exploration','Combat','Reference'];
  let filter=filters.includes(location.hash.slice(1))?location.hash.slice(1):'current';
  function stat(id,data){
    const sessions=Array.isArray(data.sessions)?data.sessions.filter(s=>s.game===id):[];
    if(!sessions.length)return 'Not played yet';
    const average=key=>{const values=sessions.map(s=>Number(s.rating?.[key])).filter(v=>v>=1&&v<=5);return values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1):null;};
    const best=Object.keys(K.TIERS).find(t=>sessions.some(s=>s.tier===t));
    return `${sessions.length} played`+(best?` · best ${K.TIERS[best].label}`:'')+(average('fun')?` · fun ${average('fun')}`:'')+(average('annoyance')?` · annoyance ${average('annoyance')}`:'');
  }
  function render(){
    const query=$('hubSearch').value.trim().toLowerCase(),data=K.load();
    const shown=entries.filter(e=>(filter==='current'?e.category!=='Reference':e.category===filter)&&`${e.title} ${e.description} ${e.inspiredBy||''}`.toLowerCase().includes(query));
    document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
    $('hubRoles').innerHTML=categories.map(category=>{
      const group=shown.filter(e=>e.category===category);if(!group.length)return '';
      return `<section class="hub-role"><h2>${category==='Reference'?'Studies & archive':category}<span>${group.length}</span></h2><div class="hub-grid">${group.map(e=>`<a class="hub-card" href="${K.esc(e.file)}" data-entry="${e.id}" ${e.station?`data-game="${e.id}"`:''}><div class="hub-card-head"><b>${K.esc(e.title)}</b><span class="hub-status">${e.status}</span></div><p>${K.esc(e.description)}</p>${e.station?`<div class="hub-stat">${K.esc(stat(e.id,data))}</div>`:''}<span class="hub-open">${e.phase&&e.phase!=='—'?e.phase+' · ':''}Open test →</span></a>`).join('')}</div></section>`;
    }).join('');
    $('hubCount').textContent=`${shown.length} tests · ${filter==='Reference'?'historical and reference work':'independent saves'}`;
    $('hubEmpty').hidden=shown.length!==0;
  }
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;history.replaceState(null,'','#'+filter);render();}));
  $('hubSearch').addEventListener('input',render);
  window.addEventListener('pageshow',render);
  window.addEventListener('hashchange',()=>{filter=filters.includes(location.hash.slice(1))?location.hash.slice(1):'current';render();});
  window.addEventListener('storage',e=>{if(e.key===K.STORE)render();});
  $('hubExport').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(K.load(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='spacology-minigames-playtests.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  render();
})();
