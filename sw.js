// Versioned, cache-first shell. Every release bumps CACHE (and VERSION in app.js), which makes this
// file byte-different so the browser installs a new worker that downloads ALL files fresh (bypassing
// the HTTP cache) into a new cache, then takes over. Old and new files are never mixed.
const CACHE = 'macarons-v4';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'vendor/qrcode.js',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(e.request);
      } catch (err) {
        if (e.request.mode === 'navigate') return cache.match('index.html');
        throw err;
      }
    })
  );
});
