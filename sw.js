// Offline support. The whole game is static, so a simple precache +
// cache-first strategy is enough — once installed it plays with no signal.

const VERSION = 'sakura-smash-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './src/main.js',
  './src/core/math.js',
  './src/core/rng.js',
  './src/core/storage.js',
  './src/core/audio.js',
  './src/data/heroes.js',
  './src/data/arenas.js',
  './src/data/chests.js',
  './src/game/world.js',
  './src/game/ai.js',
  './src/game/profile.js',
  './src/art/characters.js',
  './src/art/arena.js',
  './src/art/fx.js',
  './src/art/chest.js',
  './src/ui/ui.js',
  './src/ui/home.js',
  './src/ui/collection.js',
  './src/ui/shop.js',
  './src/ui/settings.js',
  './src/ui/battle.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        // refresh in the background so updates land on the next launch
        fetch(req).then((res) => {
          if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        }).catch(() => {});
        return hit;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
