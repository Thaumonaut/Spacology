/* Optional treasure encounters and saved, single-claim reward caches. */
(function () {
  'use strict';
  const basic = ['Tuning Fork', 'Spore Sling', 'Ranging Sight', 'Loaded Die', 'Recoil Spring', 'Quick Latch', 'Ballast Plate', 'Slow Fuse', 'Bore Bit'];
  const advanced = ['Resonance Coil', 'Survey Lance', 'Counterweight', 'Overdrive Relay', 'Breach Mantle'];
  // Tools will get their own pool once their actions exist in the playable build.
  const pools = {2: {currency:25, basic:35, advanced:40}, 3: {currency:20, basic:20, advanced:60}};
  function hash(value) {
    let h = 2166136261;
    for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  function rng(seed) {
    let x = hash(seed);
    return () => { x = (Math.imul(x,1664525)+1013904223) >>> 0; return x / 4294967296; };
  }
  function normalize(state) {
    if (!state.treasureSeed) state.treasureSeed = globalThis.crypto?.randomUUID?.() || Date.now()+'-'+Math.random();
    if (!Array.isArray(state.treasureClaims)) state.treasureClaims = [];
    if (!Array.isArray(state.treasureCaches)) state.treasureCaches = [];
    if (!['pursue','mission'].includes(state.treasureOrder)) state.treasureOrder = 'pursue';
    return state;
  }
  function encounter(state) {
    if (!state?.treasureSeed || state.end || state.round > state.maxRounds) return null;
    const round = Number(state.round);
    // Two bounded opportunities on the current six-encounter route, never the opener/finale.
    const rounds = [2 + hash(state.treasureSeed+'-early') % 2, 4 + hash(state.treasureSeed+'-late') % 2];
    if (!rounds.includes(round)) return null;
    return {id:state.treasureSeed+'-treasure-'+round, round, escapeAV:240};
  }
  function rollReward(info) {
    const random = rng(info.id), pick = list => list[Math.floor(random()*list.length)];
    const tier = random() < .75 ? 2 : 3, weights = pools[tier], roll = random()*100;
    const contents = {gold:4+tier*2+info.round, scrap:0, crystals:0, gear:[]};
    if (roll < weights.currency) {
      const currency = random();
      if (currency < .6) contents.gold += 10+tier*4;
      else if (currency < .9) contents.scrap = tier*4;
      else contents.crystals = tier === 3 ? 2 : 1;
    } else contents.gear.push(pick(roll < weights.currency+weights.basic ? basic : advanced));
    return {id:info.id, round:info.round, gold:8+info.round*2, item:pick(advanced),
      cache:{id:info.id+'-cache', round:info.round, tier, contents, opened:false}};
  }
  function collect(state, reward) {
    normalize(state);
    if (!reward || state.treasureClaims.includes(reward.id)) return false;
    const expected = rollReward({id:reward.id, round:reward.round});
    if (reward.id !== state.treasureSeed+'-treasure-'+reward.round) return false;
    state.gold += expected.gold;
    (state.gear ||= []).push(expected.item); // Duplicates remain useful owned copies.
    state.treasureCaches.push(expected.cache);
    state.treasureClaims.push(expected.id);
    return true;
  }
  function open(state, id) {
    const cache = state.treasureCaches?.find(c => c.id === id);
    if (!cache || cache.opened) return null;
    const c = cache.contents;
    state.gold += c.gold;
    state.scrap = (state.scrap || 0) + c.scrap;
    state.crystals = (state.crystals || 0) + c.crystals;
    (state.gear ||= []).push(...c.gear);
    cache.opened = true;
    return c;
  }
  function describe(contents) {
    return [contents.gold ? '+'+contents.gold+' gold' : '', contents.scrap ? '+'+contents.scrap+' scrap' : '',
      contents.crystals ? '+'+contents.crystals+' Bloom crystals' : '', ...contents.gear].filter(Boolean).join(' · ');
  }
  function icon(tier) {
    return '<svg class="treasure-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M7 19 13 9h22l6 10v21H7Z" fill="'+(tier===3?'#544078':'#375e70')+'" stroke="#efc879" stroke-width="2"/><path d="M7 20h34M15 10v30M33 10v30" fill="none" stroke="#efc879" stroke-width="2"/><path d="m24 18 5 7-5 7-5-7Z" fill="#ffe2a0"/></svg>';
  }
  window.SpacologyTreasure = Object.freeze({normalize, encounter, rollReward, collect, open, describe, icon, pools});
})();
