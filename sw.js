/* Flota - service worker
   Se juega en el colectivo, en el subte, donde no hay senal:
   la app tiene que abrir siempre. App shell cache-first, red primero
   para la navegacion asi una version nueva entra sin trucos. */
const CACHE = "flota-v1.3.0";
const SHELL = ["./", "./index.html", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate"){
    e.respondWith(
      fetch(request)
        .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return r; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Las tipografias de Google se cachean igual: sin ellas la app se ve rota offline.
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(r => {
      if (r.ok && (url.origin === self.location.origin || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com"))){
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(request, copy));
      }
      return r;
    }).catch(() => hit))
  );
});
