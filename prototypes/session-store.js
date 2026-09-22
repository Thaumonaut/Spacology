/* Explicit test voyages have separate progression and battle-result storage. */
(function(){
  const weavers=new URLSearchParams(location.search).get('weavers')==='1';
  window.SpacologyStore={weavers,run:weavers?'spacologyWeaverRunV010':'spacologyRunV010',result:weavers?'spacologyWeaverBattleResult':'spacologyBattleResult',suffix:weavers?'&weavers=1':''};
})();
