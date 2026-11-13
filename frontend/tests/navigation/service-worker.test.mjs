import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the service worker is registered in production only", async () => {
  const main = await read("../../src/main.tsx");

  // Vite dev module URLs never change, so caching them serves stale code
  // forever. Registration must sit behind the production guard.
  assert.match(main, /import\.meta\.env\.PROD/);
  assert.match(
    main,
    /navigator\.serviceWorker\.register\("\/resource-sw\.js"\)/,
  );

  const prodIndex = main.indexOf("import.meta.env.PROD");
  const registerIndex = main.indexOf('register("/resource-sw.js")');
  assert.ok(prodIndex !== -1, "the production guard is required");
  assert.ok(
    prodIndex < registerIndex,
    "registration must follow the production guard",
  );

  // A development session removes any registration and cache left behind by an
  // older build, so localhost recovers without manual DevTools work.
  assert.match(main, /getRegistrations\(\)/);
  assert.match(main, /unregister\(\)/);
  assert.match(main, /caches\.delete/);
});

test("the service worker revalidates assets instead of serving stale ones", async () => {
  const sw = await read("../../public/resource-sw.js");

  // A new cache name plus activation cleanup discards the cache-first v1 shell.
  assert.match(sw, /ggccc-resource-shell-v2/);
  assert.match(sw, /caches\.delete/);
  assert.match(sw, /skipWaiting/);
  assert.match(sw, /clients\.claim/);

  // Assets are fetched from the network first; the cache is only a fallback.
  const fetchHandler = sw.slice(sw.indexOf('addEventListener("fetch"'));
  const networkIndex = fetchHandler.indexOf("fetch(request)");
  const cacheIndex = fetchHandler.indexOf("caches.match(request)");
  assert.ok(networkIndex !== -1, "the fetch handler must call the network");
  assert.ok(cacheIndex !== -1, "the cache must remain an offline fallback");
  assert.ok(
    networkIndex < cacheIndex,
    "assets must be fetched before the cache is consulted",
  );

  // The old cache-first short circuit must not come back.
  assert.doesNotMatch(sw, /hit\s*\|\|\s*fetch/);

  // Offline navigation still falls back to the cached shell.
  assert.match(sw, /caches\.match\("\/"\)/);
});
