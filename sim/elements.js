// ============================================================================
//  The six elements, arranged as a ring so that true opposites sit across from
//  each other.  This is the setting's own cosmology, not a game-design choice:
//
//        order ── growth ── energy ── chaos ── decay ── void ──┐
//          └──────────────────────────────────────────────────┘
//
//    order  <-> chaos     structure against instability
//    growth <-> decay     accumulation against erosion
//    energy <-> void      force against absence
//
//  An element is an adverb, not a damage type.  It says HOW a character acts:
//  order is fixed and predictable, growth escalates, energy is immediate and
//  converts to tempo, chaos is all-or-nothing, decay is front-loaded and
//  permanent, void negates rather than reduces.
// ============================================================================

const RING = ['order', 'growth', 'energy', 'chaos', 'decay', 'void'];
const INDEX = Object.fromEntries(RING.map((e, i) => [e, i]));

/** Steps around the ring between two elements: 0 same, 1 adjacent, 2 distant, 3 opposite. */
function distance(a, b) {
  const d = Math.abs(INDEX[a] - INDEX[b]);
  return Math.min(d, RING.length - d);
}

/** The element directly across the ring. Hitting an enemy with its opposite is the weakness. */
function opposite(e) {
  return RING[(INDEX[e] + 3) % RING.length];
}

const RELATION = ['same', 'adjacent', 'distant', 'opposite'];
function relation(a, b) {
  return RELATION[distance(a, b)];
}

module.exports = { RING, INDEX, distance, opposite, relation, RELATION };
