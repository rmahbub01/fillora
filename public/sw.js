/* Fillora service worker — app-shell + font/runtime caching so the web app opens instantly and works offline.
   AI models are cached separately by detection.worker.ts (Cache API), so /models/* is never intercepted here. */
const VERSION = 'fillora-v1';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fillora-v') && !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheFirst = async (req, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
};

const staleWhileRevalidate = async (req, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never touch model downloads or range requests
  if (url.pathname.startsWith('/models/') || req.headers.has('range')) return;

  // Navigations: network first, fall back to cached shell (offline launch)
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put('/', copy)); return res; })
      .catch(() => caches.match('/')));
    return;
  }

  if (url.origin === self.location.origin) {
    // Hashed build assets, fonts, pdf worker: immutable-ish -> cache first
    if (/^\/(assets|fonts)\//.test(url.pathname) || url.pathname === '/pdf.worker.min.mjs' || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
      event.respondWith(cacheFirst(req, RUNTIME));
    }
    return;
  }

  // CDN files used by PDF.js (cmaps/standard fonts) and ONNX Runtime WASM
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(staleWhileRevalidate(req, RUNTIME));
  }
});
