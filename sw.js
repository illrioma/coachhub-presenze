// Funzionamento senza rete (ADR-034).
//
// La pagina: prima la rete, ma solo per qualche secondo, poi la copia salvata.
// Così una versione nuova si vede subito quando c'è campo, e a bordo campo
// senza rete la pagina si apre lo stesso invece di restare bianca.
// Il resto (icone, manifest) cambia di rado: prima la copia salvata.
const CACHE = "presenze-v1";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-180.png", "./icon-512.png"];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(request.mode === "navigate" ? networkFirst(request) : cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put("./", response.clone());
    return response;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  try {
    const response = await Promise.race([network, timeout]);
    if (response) return response;
  } catch {
    // Senza rete: si ripiega sulla copia.
  }
  return (await cache.match("./")) || network;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
