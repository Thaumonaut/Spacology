/* Explicit test voyages have separate progression and battle-result storage. */
(function(){
  const silen=new URLSearchParams(location.search).get('silen')==='1';
  const weavers=silen||new URLSearchParams(location.search).get('weavers')==='1';
  window.SpacologyStore={weavers,silen,run:silen?'spacologySilenRunV010':weavers?'spacologyWeaverRunV010':'spacologyRunV010',result:silen?'spacologySilenBattleResult':weavers?'spacologyWeaverBattleResult':'spacologyBattleResult',suffix:silen?'&silen=1':weavers?'&weavers=1':''};
})();
