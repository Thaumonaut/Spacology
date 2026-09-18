// ============================================================================
//  Verb census.  A discoverable combination needs two characters whose verbs
//  interlock, so the number of distinct chains available is bounded by how many
//  characters share each verb.  A verb that exists on one character only gives
//  every chain through it exactly one shape.
//
//  Instant; no simulation.  node verbs.js
// ============================================================================
const {CHARS}=require('./roster.js');

const VERBS={
  'apply/stacks (seed)':   c=>c.apply,
  'detonate (spend seeds)':c=>c.detonate,
  'spread':                c=>c.spread,
  'shred':                 c=>c.shred,
  'marks':                 c=>c.marks,
  'aoe':                   c=>c.aoe,
  'trig/react (answers)':  c=>c.trig,
  'thorns':                c=>c.thorns,
  'taunt':                 c=>c.taunt,
  'barrier':               c=>c.barrier,
  'heal':                  c=>c.heal,
  'advance':               c=>c.advance,
  'charge':                c=>c.charge,
  'drain':                 c=>c.drain,
  'needsGuard':            c=>c.needsGuard,
  'onHitBarrier':          c=>c.onHitBarrier,
  'over':                  c=>c.over
};

console.log('VERB CENSUS across '+Object.keys(CHARS).length+' characters');
console.log('(count first — a verb on one character only cannot produce alternatives)\n');
Object.entries(VERBS)
  .map(([v,f])=>[v,Object.entries(CHARS).filter(([,c])=>f(c)).map(([n])=>n)])
  .sort((a,b)=>a[1].length-b[1].length)
  .forEach(([v,who])=>console.log('  '+String(who.length).padStart(2)+'  '+v.padEnd(24)+who.join(', ')));

console.log('\nTRIGGER CONDITIONS  (reactors answer different events, so they do not substitute)');
Object.entries(CHARS).filter(([,c])=>c.trig).forEach(([n,c])=>
  console.log('  '+n.padEnd(9)+'on '+String(c.trig).padEnd(7)+'ratio '+c.ratio+'   up to x'+c.react));

console.log('\nHOOKS PER CHARACTER  (zero means it can never be part of a combination)');
Object.entries(CHARS)
  .map(([n,c])=>[n,Object.values(VERBS).filter(f=>f(c)).length])
  .sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0]))
  .forEach(([n,k])=>console.log('  '+n.padEnd(9)+k+'  '+'*'.repeat(k)));

const orphans=Object.entries(VERBS).filter(([,f])=>Object.values(CHARS).filter(f).length===1).length;
const dead=Object.entries(CHARS).filter(([,c])=>!Object.values(VERBS).some(f=>f(c))).length;
console.log('\nSUMMARY');
console.log('  verbs on exactly one character: '+orphans+' of '+Object.keys(VERBS).length);
console.log('  characters with no hooks at all: '+dead);
