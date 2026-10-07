'use strict';
// The headless host runs the live combat rules (prototypes/combat-core.js) and reproduces the live page exactly.
const assert=require('node:assert/strict'),crypto=require('crypto'),H=require('../../prototypes/combat-headless.js');
const prints=require('./combat-fingerprints.json').fights;
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const view=r=>({end:r.end,steps:r.steps,events:r.events,units:r.units,aether:r.aether});
// Standalone prototype teams: identical to the event streams recorded from watchable-fight.html.
let matched=0;
for(const team of ['bloom','plate','ledger','relay','found','flat'])for(const planet of ['spread','order']){
  const key=team+'/'+planet,r=view(H.runFight({team,planet,seed:7}));
  assert.equal(r.steps,prints[key].steps,key+' action count');assert.equal(sha(r),prints[key].sha256,key+' differs from the live page');matched++;
}
// Same seed, same battle; a different seed, a different battle.
assert.equal(sha(view(H.runFight({team:'relay',planet:'spread',seed:3}))),sha(view(H.runFight({team:'relay',planet:'spread',seed:3}))));
assert.notEqual(sha(view(H.runFight({team:'relay',planet:'spread',seed:3}))),sha(view(H.runFight({team:'relay',planet:'spread',seed:4}))));
// Seeds are taken as given, as the browser harness takes them: seed 0 is its own battle, not seed 1 again.
assert.notEqual(sha(view(H.runFight({team:'bloom',planet:'spread',seed:0}))),sha(view(H.runFight({team:'bloom',planet:'spread',seed:1}))),'seed 0 collapses onto seed 1');
// Fights are isolated: one context's globals never leak into the next.
const a=H.runFight({team:'bloom',planet:'spread',seed:7,keepContext:true,globals:{SOAK:.9}});
assert.equal(a.context.SOAK,.9);assert.equal(sha(view(H.runFight({team:'bloom',planet:'spread',seed:7}))),prints['bloom/spread'].sha256);
console.log(`PASS combat headless: ${matched} fights identical to the live page; seeded, deterministic and isolated`);
