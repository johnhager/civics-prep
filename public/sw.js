// Basic Service Worker to satisfy PWA install requirements
self.addEventListener('install', (e) => {
    // Activate right away
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    // Claim any clients immediately
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    // Simple pass-through fetch handler
    // Browsers just need this listener to consider the app a valid PWA.
    // We aren't implementing massive offline caching here right now.
    e.respondWith(fetch(e.request).catch(() => {
        return new Response('Offline');
    }));
});
