const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalogue = require('../sim/enemy-catalogue.js');

let count = 0;
for (const [factionId, faction] of Object.entries(catalogue.FACTIONS)) {
  assert(faction.archetypes.length >= 10, `${faction.name} needs at least ten visual types`);
  assert.equal(Object.keys(faction.types).length, faction.archetypes.length, `${faction.name} normalized type records are stale`);
  for (const archetype of faction.archetypes) {
    count += 1;
    const portrait = catalogue.ARCHETYPE_PORTRAITS[factionId]?.[archetype];
    assert(faction.typeNames[archetype], `${factionId}/${archetype} has no faction-specific type name`);
    assert(portrait, `${factionId}/${archetype} has no portrait mapping`);
    assert(fs.existsSync(path.resolve(__dirname, '../sim', portrait)), `${portrait} is missing`);
    const specimen = catalogue.generateEnemy(`asset-test:${factionId}:${archetype}`, { faction:factionId, archetype });
    assert.equal(specimen.portrait, portrait, `${factionId}/${archetype} did not receive its portrait`);
  }
}

assert(count >= 70);

catalogue.registerFaction('test-future', {
  name: 'The Test Future',
  rule: 'Verify',
  types: {
    chaff: { name: 'Testling', body: 'test body', portrait: '../assets/factions/ossuary-chaff-v3.png' }
  }
});
const future = catalogue.generateEnemy('future-extension-test', { faction: 'test-future', archetype: 'chaff' });
assert.equal(future.typeName, 'Testling');
assert.equal(future.bodyPlan, 'test body');
assert.equal(future.portrait, '../assets/factions/ossuary-chaff-v3.png');
delete catalogue.FACTIONS['test-future'];
delete catalogue.ARCHETYPE_PORTRAITS['test-future'];

const battleHtml = fs.readFileSync(path.resolve(__dirname, '../prototypes/watchable-fight.html'), 'utf8');
const battleScripts = [...battleHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert(battleScripts.length, 'battle prototype has no inline script');
battleScripts.forEach((match) => new Function(match[1]));
[
  'n:specimen?specimen.typeName',
  'portrait:specimen&&specimen.portrait',
  'portrait:p.portrait',
  'var art=u.portrait||typeArt'
].forEach((marker) => assert(battleHtml.includes(marker), `battle does not preserve catalogue field: ${marker}`));

console.log('PASS all 70 faction/type combinations have names, generated-enemy portraits, and battle wiring');
