const CACHE='spacology-v010-card-art-4';
const CORE=[
  './','./index.html','./manifest.webmanifest',
  './prototypes/spacology-v0.1.0.html','./prototypes/spacology-v0.1.0.js','./prototypes/watchable-fight.html','./prototypes/art-gallery.html',
  './assets/app-icon-192.png','./assets/app-icon-512.png',
  './assets/crew/tarn-v1.webp','./assets/crew/ash-v1.webp','./assets/crew/quill-v1.webp','./assets/crew/maul-v1.webp',
  './assets/crew/bosk-v1.webp','./assets/crew/coda-v1.webp','./assets/crew/morrow-v1.webp','./assets/crew/spore-v1.webp',
  './assets/title/spacology-splash-v2.webp',
  './assets/enemies/chaff-v1.webp','./assets/enemies/bruiser-v1.webp','./assets/enemies/warden-v1.webp','./assets/enemies/cleanser-v1.webp',
  './assets/enemies/reflector-v1.webp','./assets/enemies/anchor-v1.webp','./assets/enemies/bulwark-v1.webp','./assets/enemies/quickstep-v1.webp',
  './assets/lore/ilka-voressen-v1.webp','./assets/lore/reva-sokolovna-minor-v1.webp','./assets/lore/reva-sokolovna-major-v1.webp',
  './assets/lore/tomas-iriarte-v1.webp','./assets/lore/ojo-mbeki-v1.webp','./assets/lore/stella-anuye-v1.webp','./assets/lore/nour-bediako-v1.webp',
  './assets/lore/dolores-achterberg-v1.webp','./assets/lore/abike-sunmonu-v1.webp','./assets/lore/aurel-cosma-moth-v1.webp','./assets/lore/aurel-cosma-feather-v1.webp',
  './assets/lore/idris-okonjo-major-v1.webp','./assets/lore/beatriz-corriveau-v1.webp','./assets/lore/otaremnivas-v1.webp','./assets/lore/wren-adeyemi-v1.webp',
  './assets/lore/nadira-quill-minor-v1.webp','./assets/lore/nadira-quill-major-v1.webp','./assets/lore/yusuf-benhaddou-minor-v1.webp','./assets/lore/yusuf-benhaddou-major-v1.webp',
  './assets/lore/sevim-aydar-v1.webp','./assets/lore/nahana-v1.webp','./assets/lore/navigator-v1.webp','./assets/lore/ekene-baptiste-v1.webp','./assets/lore/aurelio-bassi-v1.webp'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match('./prototypes/spacology-v0.1.0.html'))));
});
