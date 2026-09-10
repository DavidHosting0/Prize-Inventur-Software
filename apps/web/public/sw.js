/* Prize Hotel PWA — offline shell only. Never intercept App Router / RSC. */
const CACHE = "prize-shell-v2";
const SHELL = ["/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function shouldBypass(request) {
  if (request.method !== "GET") return true;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/_next/")) return true;
  // Next.js App Router flight / prefetch — intercepting these causes multi-second hangs
  if (url.searchParams.has("_rsc")) return true;
  if (request.headers.get("rsc") === "1") return true;
  if (request.headers.get("next-router-state-tree")) return true;
  if (request.headers.get("next-router-prefetch")) return true;
  if (request.headers.get("next-url")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (shouldBypass(request)) return;

  // Offline fallback only for top-level navigations
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/"))
      )
    );
  }
});
