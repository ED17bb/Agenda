// Service Worker mínimo para PWA
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Responde con la red por defecto
  e.respondWith(fetch(e.request));
});
