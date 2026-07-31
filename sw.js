/* Offline support. Bump CACHE whenever the game files change so phones
   that already installed the app pick up the new build. */

const CACHE = 'sunny-acres-v9';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/fx.js',
  './js/store.js',
  './js/cloud.js',
  './js/map.js',
  './js/arcade.js',
  './js/ui.js',
  './js/game.js',
  './js/state.js',
  './js/data.js',
  './js/util.js',
  './js/audio.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network first, cache as the fallback: you always get the newest build when
   there's signal, and the farm still opens on the subway. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
