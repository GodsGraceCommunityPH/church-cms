const SHELL = "ggccc-resource-shell-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add("/")));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every older cache, including the cache-first v1 shell that could
      // hide new code indefinitely.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== SHELL).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(async () => (await caches.match("/")) || Response.error()),
    );
    return;
  }

  // Network-first: a new deployment, or a local source change, must never be
  // hidden behind an old cached module. The cache is an offline fallback only.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (["script", "style", "font"].includes(request.destination)) {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || Response.error()),
  );
});
