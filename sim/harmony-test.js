// ============================================================================
//  What is Harmony actually worth?
//
//  Comparing a stacked team against a spread team confounds the element
//  question with team quality - the two teams have different characters. The
//  only clean comparison is the SAME team scored with Harmony on and off, so
//  every other variable is held fixed by construction.
//
//  node harmony-test.js
// ============================================================================
const S = require('./synergy.js');
const { CHARS } = require('./roster.js');
const NAMES = Object.keys(CHARS);
const WL = ['open', 'hive', 'fortress'];
const N = 22, CAP = 24, STEPS = 9, SIZE = 5, SAMPLE = 70;

function mb(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mb(5150);

const seen = new Set(), teams = [];
while (teams.length < SAMPLE) {
  const pool = NAMES.slice(), t = [];
  for (let i = 0; i < SIZE; i++) t.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  const k = t.slice().sort().join('|');
  if (seen.has(k)) continue;
  seen.add(k); teams.push(t);
}

const avg = t => { const v = WL.map(w => S.score(t, w, N, CAP, STEPS)); return v.reduce((a, b) => a + b, 0) / v.length; };

const rows = teams.map(t => {
  const els = t.map(n => CHARS[n].element);
  const dupes = els.length - new Set(els).size;
  const breakers = t.filter(n => CHARS[n].armorShred).length;
  S.resetTuning(); S.setTuning({ HARMONY_CAP: 0 }); const off = avg(t);
  S.resetTuning(); S.setTuning({ HARMONY_CAP: 2 }); const on = avg(t);
  return { t, dupes, breakers, off, on, gain: off > 0.01 ? (on - off) / off : 0 };
});
S.resetTuning();

function group(rows, key, label) {
  const by = {};
  rows.forEach(r => (by[r[key]] = by[r[key]] || []).push(r));
  console.log(`\n  ${label.padEnd(22)} teams   Harmony off    on     gain`);
  Object.keys(by).sort((a, b) => a - b).forEach(k => {
    const g = by[k];
    const off = g.reduce((a, r) => a + r.off, 0) / g.length;
    const on = g.reduce((a, r) => a + r.on, 0) / g.length;
    const gain = g.reduce((a, r) => a + r.gain, 0) / g.length;
    console.log('  ' + String(k).padEnd(22) + String(g.length).padStart(5) +
      off.toFixed(2).padStart(12) + on.toFixed(2).padStart(8) +
      (gain * 100).toFixed(1).padStart(8) + '%');
  });
}

console.log(`Same team, Harmony off vs on. ${rows.length} teams, ${WL.length} worlds.`);
group(rows, 'dupes', 'duplicate elements');
group(rows, 'breakers', 'characters with shred');

const stacked = rows.filter(r => r.dupes >= 2);
const spread = rows.filter(r => r.dupes === 0);
console.log('\n  Harmony is worth ' + (stacked.reduce((a, r) => a + r.gain, 0) / stacked.length * 100).toFixed(1) +
  '% to a team with 2+ duplicate elements');
console.log('  and ' + (spread.reduce((a, r) => a + r.gain, 0) / spread.length * 100).toFixed(1) +
  '% to a team with none, which is the control.');
