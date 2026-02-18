const CACHE_NAME = 'grand-hotel-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/admin.html',
    '/css/style.css',
    '/css/admin.css',
    '/js/main.js',
    '/js/admin.js',
    '/js/data.js',
    '/js/i18n.js',
    '/manifest.json'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // Network-first for API calls, cache-first for assets
    if (e.request.url.includes('/.netlify/functions/')) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );
    } else {
        e.respondWith(
            caches.match(e.request).then(cached => cached || fetch(e.request))
        );
    }
});
