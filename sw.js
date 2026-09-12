const CACHE_NAME = 'thalys-shell-v0.11';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/thalys.css?v=011',
  './js/tailwind-config.js?v=011',
  './js/theme-bootstrap.js?v=011',
  './js/ui-foundation.js?v=011',
  './js/google-auth.js?v=011',
  './js/drive.js?v=011',
  './js/app-core.js?v=011',
  './js/oauth-ui.js?v=011',
  './js/media-tools.js?v=011',
  './js/pwa-register.js?v=011',
  './js/app-enhancements.js?v=011',
  './lang/lang_it.json?v=22',
  './lang/lang_en.json?v=22',
  './lang/lang_es.json?v=22',
  './lang/lang_pt.json?v=22',
  './lang/lang_ro.json?v=22'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(APP_SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('thalys-shell-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return Response.error();
      })
  );
});
