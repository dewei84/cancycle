// Service worker: makes the app installable and quick to open.
// It caches only the app's own files. Air-quality readings come from
// data.gov.sg and are never intercepted or cached here, so they are always live.

const CACHE = 'cancycle-shell-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/tokens.css',
  'assets/css/base.css',
  'assets/css/layout.css',
  'assets/css/components.css',
  'assets/css/motion.css',
  'assets/js/main.js',
  'assets/js/config.js',
  'assets/js/api.js',
  'assets/js/rules.js',
  'assets/js/store.js',
  'assets/js/ui.js',
  'assets/fonts/fraunces-latin-opsz.woff2',
  'assets/images/art/paper-grain.svg',
  'assets/images/art/ink-wheel.svg',
  'assets/images/art/ink-streaks.svg',
  'assets/images/art/brush-stroke.svg',
  'assets/images/icons/refresh.svg',
  'assets/images/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Network first for the app's own files, so updates show at once;
// the cached copy is used only when offline.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
