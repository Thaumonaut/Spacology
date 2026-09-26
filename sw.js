importScripts('./sim/enemy-catalogue.js');
const ENEMY_ASSETS=[
  ...Object.values(self.SpacologyEnemyCatalogue.ARCHETYPE_PORTRAITS).flatMap(types=>Object.values(types)),
  ...Object.values(self.SpacologyEnemyCatalogue.HEROES).map(hero=>hero.portrait)
].map(path=>path.replace(/^\.\.\//,'./'));
const CACHE='cast-art-refresh-4-offline-battle-launch-1-enemy-traits-1-tablet-toolbar-2-enemy-summoners-1-game-menu-1-voyage-nodes-1-treasure-carriers-1-spacology-v010-enemy-battle-art-1-shorter-text-2-j3k-support-3-field-xp-1-aether-priority-1-formation-1-weaver-cap-1-health-ai-2-recovery-2-weaver-roles-1-silen-sustained-turns-4-role-spending-1-copy-details-1-character-instances-1-defeated-slots-1';
const CORE=[
  './prototypes/enemy-summoning.js','./prototypes/enemy-traits.js',
  './prototypes/game-menu.css','./prototypes/game-menu.js','./prototypes/game-preferences.js',
  './prototypes/voyage-rules.js',
  './prototypes/treasure-rules.js',
  './prototypes/down-recovery.js',
  './prototypes/formation-rules.js',
  './prototypes/field-progression.js',
  './prototypes/session-store.js','./prototypes/weaver-roster.js','./prototypes/aether-weavers.html',
  './assets/cast/roonie-baelk-v7.png','./assets/cast/veska-reed-v3.png','./assets/cast/daven-pell-v7.png','./assets/cast/silen-newt-v1.png','./assets/cast/void-narwhal-navigator-v1.png',
  './','./index.html','./manifest.webmanifest',
  './prototypes/spacology-v0.1.0.html','./prototypes/spacology-v0.1.0.js','./prototypes/recovery-scoring.js','./prototypes/crew-progression.js','./prototypes/voyage-settings.js','./prototypes/expedition-rules.js','./prototypes/aether-rules.js','./prototypes/ops-room.css','./prototypes/star-atlas.html','./prototypes/watchable-fight.html','./prototypes/art-gallery.html','./sim/enemy-catalogue.js',
  './assets/app-icon-192.png','./assets/app-icon-512.png',
  './assets/crew/tarn-v1.webp','./assets/crew/ash-v1.webp','./assets/crew/quill-v1.webp','./assets/crew/maul-v1.webp',
  './assets/crew/bosk-v1.webp','./assets/crew/morrow-v1.webp','./assets/crew/spore-v1.webp',
  './assets/title/spacology-splash-v2.webp',
  './assets/enemies/chaff-v1.webp','./assets/enemies/bruiser-v1.webp','./assets/enemies/warden-v1.webp','./assets/enemies/cleanser-v1.webp',
  './assets/enemies/reflector-v1.webp','./assets/enemies/anchor-v1.webp','./assets/enemies/bulwark-v1.webp','./assets/enemies/quickstep-v1.webp',
  ...ENEMY_ASSETS,
  './assets/cast/ilka-voressen-v2.png','./assets/cast/reva-sokolovna-v2.png','./assets/cast/tomas-iriarte-v5.png','./assets/cast/stella-anuye-v2.png','./assets/cast/nour-bediako-v3.png',
  './assets/cast/dolores-achterberg-v7.png','./assets/cast/spore-v2.png','./assets/cast/aurel-cosma-v2.png','./assets/cast/imke-v3.png','./assets/cast/idris-okonjo-v2.png',
  './assets/cast/abike-sunmonu-v2.png','./assets/cast/beatriz-corriveau-v2.png','./assets/cast/otaremnivas-v2.png','./assets/cast/wren-adeyemi-v2.png',
  './assets/cast/nadira-quill-v2.png','./assets/cast/yusuf-benhaddou-v2.png','./assets/cast/sevim-aydar-v2.png','./assets/cast/aurelio-bassi-v2.png',
  './assets/cast/nahana-v2.png','./assets/cast/navigator-v2.png','./assets/cast/ekene-baptiste-v2.png',
  './assets/cast/bosk-v4.png','./assets/cast/coda-v2.png','./assets/cast/morrow-v2.png','./assets/cast/maul-v2.png','./assets/cast/quill-v2.png','./assets/cast/tarn-v2.png',
  './assets/cast/hanae-mori-v3.png','./assets/cast/arunima-das-v4.png','./assets/cast/atsa-begay-v1.png',
  './assets/cast/yusuf-benhaddou-v3.png','./assets/cast/aurelio-bassi-v3.png','./assets/lore/ekene-baptiste-v2.png',
  './assets/cast/redcap-v1.png','./assets/cast/the-mage-v1.png','./assets/cast/j3k-017-v2.png','./assets/cast/j3k-036-v7.png','./assets/cast/j3k-095-v2.png',
  './assets/lore/ilka-voressen-v1.webp','./assets/lore/reva-sokolovna-minor-v1.webp','./assets/lore/reva-sokolovna-major-v1.webp',
  './assets/lore/tomas-iriarte-v1.webp','./assets/lore/ojo-mbeki-v1.webp','./assets/lore/stella-anuye-v1.webp','./assets/lore/nour-bediako-v1.webp',
  './assets/lore/dolores-achterberg-v1.webp','./assets/lore/abike-sunmonu-v1.webp','./assets/lore/aurel-cosma-moth-v1.webp','./assets/lore/aurel-cosma-feather-v1.webp',
  './assets/lore/idris-okonjo-major-v1.webp','./assets/lore/beatriz-corriveau-v1.webp','./assets/lore/otaremnivas-v1.webp','./assets/lore/wren-adeyemi-v1.webp',
  './assets/lore/nadira-quill-minor-v1.webp','./assets/lore/nadira-quill-major-v1.webp','./assets/lore/yusuf-benhaddou-minor-v1.webp','./assets/lore/yusuf-benhaddou-major-v1.webp',
  './assets/lore/sevim-aydar-v1.webp','./assets/lore/nahana-v1.webp','./assets/lore/navigator-v1.webp','./assets/lore/ekene-baptiste-v1.webp','./assets/lore/aurelio-bassi-v1.webp'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...new Set(CORE)])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request,{ignoreSearch:event.request.mode==='navigate'}).then(hit=>hit||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match('./prototypes/spacology-v0.1.0.html'))));
});
