
const CACHE = "sonora-pro-cache-v1";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/app.css",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k===CACHE ? null : caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => {
          if (new URL(req.url).origin === self.location.origin) c.put(req, copy);
        });
        return res;
      }).catch(() => cached || caches.match("./index.html"));
    })
  );
});
