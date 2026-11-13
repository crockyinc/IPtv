/* eslint-disable no-restricted-globals */
/**
 * AnyStream service worker.
 *
 * Strategy
 *  - App shell (HTML + hashed build assets): precached, then stale-while-revalidate.
 *  - iptv-org JSON API: stale-while-revalidate so repeat visits paint instantly
 *    while the fresh catalogue streams in from the network.
 *  - HLS manifests/segments and everything else: never intercepted. Video is
 *    far too large and too volatile to cache, and byte-range requests must go
 *    straight to the broadcaster.
 */

const VERSION = 'anystream-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-iptv-data`;
const API_ORIGIN = 'https://iptv-org.github.io';
const SHELL_ASSETS = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest'];
const MAX_DATA_ENTRIES = 24;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        SHELL_ASSETS.map(async (asset) => {
          try {
            await cache.add(new Request(asset, { cache: 'reload' }));
          } catch {
            /* a missing optional asset must not block installation */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((request) => cache.delete(request)));
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        void cache
          .put(request, response.clone())
          .then(() => trimCache(cacheName, MAX_DATA_ENTRIES))
          .catch(() => undefined);
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const response = await network;
  if (response) return response;

  return new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      void cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    const cached = (await cache.match('/index.html')) || (await cache.match('/'));
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>AnyStream offline</title><body style="background:#0f0f0f;color:#f1f1f1;font-family:system-ui;padding:48px;text-align:center">' +
        '<h1 style="font-size:20px">You are offline</h1>' +
        '<p style="color:#aaa">Reconnect to load the live channel catalogue.</p></body>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // HLS / video traffic — never touched.
  if (/\.(m3u8|ts|m4s|mp4|aac|key)(\?|$)/i.test(url.pathname)) return;
  if (request.headers.has('range')) return;

  if (url.origin === API_ORIGIN && url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  // Cross-origin logos, fonts, etc. fall through to the network untouched.
});
