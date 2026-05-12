const CACHE = 'greedy-cave-v8';
const FILES = [
  '.',
  'index.html',
  'css/style.css',
  'js/utils.js',
  'js/equipment.js',
  'js/monster.js',
  'js/player.js',
  'js/dungeon.js',
  'js/combat.js',
  'js/renderer.js',
  'js/auth.js',
  'js/main.js',
  'manifest.json',
  'icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
