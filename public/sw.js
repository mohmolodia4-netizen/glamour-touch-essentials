// Minimal service worker: caches same-origin static assets only.
// Never caches HTML/navigation, API, server functions or backend (Supabase) calls.
const CACHE = "gt-static-v1";
const STATIC_EXT = /\.(?:js|mjs|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("gt-static-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode === "navigate") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // backend, fonts CDN, storage: network only
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/~")) return;
  if (url.search) return;
  if (!STATIC_EXT.test(url.pathname)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    })(),
  );
});
