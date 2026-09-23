(function () {
  'use strict';
  const bands = Object.freeze([
    { minimum: 0, delta: -8, name: 'Minimal recovery' },
    { minimum: 18, delta: -6, name: 'Heavy shortfall' },
    { minimum: 42, delta: -4, name: 'Partial recovery' },
    { minimum: 68, delta: -2, name: 'Near recovery' },
    { minimum: 88, delta: 0, name: 'Integrity secured' },
    { minimum: 100, delta: 2, name: 'Full recovery' }
  ].map(Object.freeze));
  function points(enemy) { return enemy.elite ? 4 : (enemy.archetype === 'chaff' || enemy.n === 'Chaff') ? 1 : 2; }
  function score(pool, units, observation) {
    const defeated = new Set(units.filter(u => u.side === 'foe' && !u.alive && u.hp <= 0).map(u => u.id));
    let total = 0, earned = 0;
    pool.forEach((enemy, index) => {
      const value = points(enemy);
      total += value;
      if (defeated.has('f' + index)) earned += value;
    });
    const bossIndex=pool.findIndex(enemy=>enemy.boss);
    if(bossIndex>=0){
      const boss=units.find(unit=>unit.id==='f'+bossIndex);
      const max=pool[bossIndex].hp;
      const hp=boss?Math.max(0,Math.min(boss.lowestHP??max,boss.hp)):max;
      total=100;earned=Math.floor(80*(1-hp/max))+(defeated.has('f'+bossIndex)?20:0);
    }
    let index = 0;
    if (total) bands.forEach((band, i) => { if (earned * 100 >= band.minimum * total) index = i; });
    const band = bands[index];
    const next = bands[index + 1];
    return {
      earned, total, percent: total ? earned / total * 100 : 0,
      band: band.name, minimum: band.minimum,
      integrity: band.delta + (index === bands.length - 1 && observation ? 3 : 0),
      next: next ? { minimum: next.minimum, delta: next.delta, points: Math.ceil(total * next.minimum / 100) - earned } : null
    };
  }
  window.SpacologyRecovery = Object.freeze({ bands, points, score });
})();
