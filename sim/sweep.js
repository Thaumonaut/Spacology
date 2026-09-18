// ============================================================================
//  Emits every measurement the workbook needs, as sweep.json.
//
//    node sweep.js            # default sample, a few minutes
//    node sweep.js 400        # larger team sample, slower
//
//  Then:  python3 build-workbook.py
//
//  Everything is scored with the difficulty ceiling raised to CAP, because the
//  default ceiling of 6.0 censors strong teams at 5.96 and silently flattens
//  exactly the comparisons a sweep is for.
// ============================================================================
const S = require('./synergy.js');
const { CHARS, TAGS: ROLES, WORLDS } = require('./roster.js');

const NAMES = Object.keys(CHARS);
const WL = ['open', 'murk', 'hive', 'fortress', 'bloom'];
const N = 26;            // fights per difficulty probe
const CAP = 24, STEPS = 10;
const SIZE = 5;          // characters per team
const SAMPLE = +(process.argv[2] || 200);

function mb(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mb(20260918);

const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

// ---- the verb vocabulary, and what each character offers ------------------
const VERBS = {
  appliesDot: c => c.appliesDot, dotPerHit: c => c.dotPerHit, detonate: c => c.detonate, dotSpread: c => c.dotSpread,
  armorShred: c => c.armorShred, marks: c => c.marks, aoe: c => c.aoe, procOn: c => c.procOn,
  thorns: c => c.thorns, taunt: c => c.taunt, shield: c => c.shield, heal: c => c.heal,
  turnBoost: c => c.turnBoost, energyGain: c => c.energyGain, lifesteal: c => c.lifesteal,
  needsShield: c => c.needsShield, shieldOnHit: c => c.shieldOnHit, overheal: c => c.overheal
};
// a hook is a verb that can interlock with another character's
const HOOKS = ['appliesDot', 'detonate', 'dotSpread', 'armorShred', 'marks', 'aoe', 'procOn',
  'thorns', 'taunt', 'shield', 'heal', 'turnBoost', 'energyGain', 'lifesteal', 'needsShield',
  'shieldOnHit', 'overheal'];

function dependency(c) {
  const d = [];
  if (c.appliesDot && !c.detonate) d.push('a detonator');
  if (c.detonate && !c.appliesDot) d.push('someone to seed');
  if (c.procOn === 'mark' && !c.marks) d.push('someone to mark');
  if (c.procOn === 'break' && !c.armorShred) d.push('someone to break');
  if (c.thorns && !c.taunt) d.push('someone to pull fire');
  if (c.needsShield) d.push('a shield source');
  return d.join(' + ');
}

const roster = Object.entries(CHARS).map(([name, c]) => ({
  name, roles: (c.tags || []).join(' / '), dmg: c.dmg, speed: c.speed,
  hpMul: c.hpMul || 1,
  hooks: HOOKS.filter(v => VERBS[v](c)).length,
  verbs: HOOKS.filter(v => VERBS[v](c)).join(' '),
  procOn: c.procOn || '', procDmg: c.procDmg || '', procMax: c.procMax || '',
  needs: dependency(c), bio: c.bio || ''
}));

const verbs = Object.keys(VERBS).map(v => {
  const who = Object.entries(CHARS).filter(([, c]) => VERBS[v](c)).map(([n]) => n);
  return { verb: v, count: who.length, holders: who.join(', ') };
}).sort((a, b) => a.count - b.count);

// ---- sample unique teams --------------------------------------------------
log(`sampling ${SAMPLE} unique teams of ${SIZE} from ${NAMES.length} characters`);
const seen = new Set(), teams = [];
while (teams.length < SAMPLE) {
  const pool = NAMES.slice(), t = [];
  for (let i = 0; i < SIZE; i++) t.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  const key = t.slice().sort().join('|');
  if (seen.has(key)) continue;
  seen.add(key); teams.push(t);
}

log(`scoring ${teams.length} teams x ${WL.length} worlds (ceiling ${CAP})`);
const teamRows = teams.map((t, i) => {
  if (i % 40 === 0 && i) log(`  ${i}/${teams.length}`);
  const per = {}; WL.forEach(w => per[w] = S.score(t, w, N, CAP, STEPS));
  const vals = WL.map(w => per[w]);
  const tc = {}; t.forEach(n => (CHARS[n].tags || []).forEach(g => tc[g] = (tc[g] || 0) + 1));
  const deep = Object.entries(tc).filter(([, v]) => v >= 4).map(([g]) => g);
  const entry = Object.entries(tc).filter(([, v]) => v >= 2).map(([g, v]) => g + 'x' + v);
  return {
    team: t.join(', '), members: t, ...per,
    avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3),
    best: Math.max(...vals), worst: Math.min(...vals),
    swing: +(Math.max(...vals) - Math.min(...vals)).toFixed(3),
    hooks: t.reduce((a, n) => a + HOOKS.filter(v => VERBS[v](CHARS[n])).length, 0),
    rolesAt2: entry.join(' '), deepRole: deep.join(' ') || 'none'
  };
}).sort((a, b) => b.avg - a.avg);

const baseline = +(teamRows.reduce((a, r) => a + r.avg, 0) / teamRows.length).toFixed(3);
log(`baseline ${baseline}  ceiling ${teamRows[0].avg}`);

// ---- per character: how much does banning them cost? ----------------------
const TOPN = Math.min(50, teamRows.length);
const top = teamRows.slice(0, TOPN);
const charRows = NAMES.map(n => {
  const inTop = top.filter(r => r.members.includes(n)).length;
  const without = teamRows.find(r => !r.members.includes(n));
  const c = CHARS[n];
  return {
    name: n, roles: (c.tags || []).join(' / '),
    hooks: HOOKS.filter(v => VERBS[v](c)).length,
    topFreq: inTop, topShare: +(inTop / TOPN).toFixed(3),
    slotShare: +(inTop / (TOPN * SIZE)).toFixed(4),
    bestWithout: without ? without.avg : null,
    costOfBanning: without ? +((teamRows[0].avg - without.avg) / teamRows[0].avg).toFixed(4) : null,
    needs: dependency(c)
  };
}).sort((a, b) => b.topFreq - a.topFreq);

// ---- role lift -------------------------------------------------------------
const lift = {};
teamRows.forEach(r => {
  const c = {}; r.members.forEach(n => (CHARS[n].tags || []).forEach(g => c[g] = (c[g] || 0) + 1));
  Object.entries(c).forEach(([g, v]) => {
    const k = g + '|' + Math.min(4, v);
    (lift[k] = lift[k] || []).push(r.avg);
  });
});
const roleRows = Object.entries(lift).filter(([, v]) => v.length >= 6).map(([k, v]) => {
  const [tag, count] = k.split('|');
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return { tag, count: +count, n: v.length, mean: +mean.toFixed(3),
           vsBaseline: +((mean / baseline) - 1).toFixed(4),
           at2: (ROLES[tag] || {})[2] || '', at4: (ROLES[tag] || {})[4] || '' };
}).sort((a, b) => b.vsBaseline - a.vsBaseline);

// ---- world discrimination -------------------------------------------------
const worldRows = WL.map(w => {
  const v = teamRows.map(r => r[w]);
  const sorted = v.slice().sort((a, b) => a - b);
  const censored = v.filter(x => x > 5.9 && x < 5.97).length;
  return {
    world: w, note: WORLDS[w].note, speedMul: WORLDS[w].speedMul,
    min: +Math.min(...v).toFixed(2), median: +sorted[Math.floor(v.length / 2)].toFixed(2),
    max: +Math.max(...v).toFixed(2),
    spread: +(Math.max(...v) / Math.max(0.01, Math.min(...v))).toFixed(2),
    wouldBeCensoredAt6: censored,
    mix: WORLDS[w].mix.map(m => m[0] + 'x' + m[1]).join(' ')
  };
});

// ---- the variable sweep ---------------------------------------------------
// One constant at a time, everything else at its default.
const PROBES = [
  ['Pyre, Ash, Corr, Rime, Maul', ['Pyre', 'Ash', 'Corr', 'Rime', 'Maul']],
  ['Tarn, Vitre, Nettle, Maul, Rime', ['Tarn', 'Vitre', 'Nettle', 'Maul', 'Rime']],
  ['Cinder, Mote, Bosk, Pyre, Ash', ['Cinder', 'Mote', 'Bosk', 'Pyre', 'Ash']],
  ['Wex, Sump, Nettle, Bosk, Ferrule', ['Wex', 'Sump', 'Nettle', 'Bosk', 'Ferrule']]
];
const SWEEPS = {
  ARMOR_MITIGATION:  [0.25, 0.40, 0.55, 0.70, 0.85],   // damage through an intact shield
  OFF_ELEMENT_SHRED:    [0.05, 0.10, 0.20, 0.35, 0.50],   // off-element armorShred rate
  VULN_BONUS:  [0.00, 0.20, 0.35, 0.50, 0.75],   // extra damage once broken
  BREAK_DELAY: [0.00, 0.20, 0.35, 0.50, 0.75],   // share of a turn a break costs
  ARMOR_PER_LAYER: [8, 11, 14, 18, 24]               // shield points per layer
};
const SWORLDS = ['open', 'murk', 'hive'];
const defaults = S.getTuning();
log('sweeping five constants x five values x four teams x three worlds');
const sweepRows = [];
for (const [key, values] of Object.entries(SWEEPS)) {
  for (const val of values) {
    S.resetTuning(); S.setTuning({ [key]: val });
    for (const [label, team] of PROBES) {
      for (const w of SWORLDS) {
        sweepRows.push({
          constant: key, value: val, isDefault: val === defaults[key],
          team: label, world: w, bp: S.score(team, w, N, CAP, STEPS)
        });
      }
    }
  }
  log(`  ${key} done`);
}
S.resetTuning();

const out = {
  meta: {
    generated: 'node sweep.js',
    sample: teams.length, teamSize: SIZE, fightsPerProbe: N,
    ceiling: CAP, searchSteps: STEPS,
    baseline, worlds: WL, defaults,
    caveat: 'Neither engine models element as a property of a character; both assign it by '
          + 'array position, and Harmony is never evaluated. Everything here is a finding '
          + 'about verbs and tags only.'
  },
  roster, verbs, teams: teamRows, characters: charRows, roles: roleRows,
  worlds: worldRows, sweep: sweepRows
};
require('fs').writeFileSync('sweep.json', JSON.stringify(out));
log(`wrote sweep.json  (${teamRows.length} teams, ${sweepRows.length} sweep rows)`);
