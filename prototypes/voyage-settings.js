(function () {
  'use strict';
  const difficulties = Object.freeze({
    relaxed: Object.freeze({ label: 'Relaxed', enemyScale: 0.85, enemySpeed: .9, enemyGuard: .85, breakDelay: .35, roundLimits: Object.freeze([6,6,7,7,8,8]) }),
    standard: Object.freeze({ label: 'Standard', enemyScale: 1, enemySpeed: 1, enemyGuard: 1, breakDelay: .25, roundLimits: Object.freeze([5,5,6,6,7,7]) }),
    hard: Object.freeze({ label: 'Hard', enemyScale: 1.3, enemySpeed: 1.12, enemyGuard: 1.2, breakDelay: .15, roundLimits: Object.freeze([4,4,5,5,6,6]) })
  });
  function normalize(value) {
    value = value && typeof value === 'object' ? value : {};
    return {
      difficulty: Object.hasOwn(difficulties, value.difficulty) ? value.difficulty : 'standard',
      initialIntegrity: [50, 60, 70].includes(value.initialIntegrity) ? value.initialIntegrity : 70
    };
  }
  function roundLimit(state) {
    const settings = difficulties[normalize(state).difficulty];
    const index = Math.max(0, Math.min(5, Math.floor(Number(state && state.round) || 1) - 1));
    if(state?.voyageVersion===1){
      const sector=Math.min(3,Math.ceil(state.round/7)),boss=state.round%7===0;
      return (state.difficulty==='relaxed'?7:state.difficulty==='hard'?5:6)+(sector-1)+(boss?1:0);
    }
    return settings.roundLimits[index];
  }
  window.SpacologyVoyageSettings = Object.freeze({ difficulties, normalize, roundLimit });
})();
