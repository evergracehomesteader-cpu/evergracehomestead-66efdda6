/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
// Custom service worker — injectManifest strategy.
// vite-plugin-pwa injects the precache manifest into self.__WB_MANIFEST.
import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Allow the page to trigger an immediate update.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.skipWaiting();
clientsClaim();

// Precache the build output + offline fallback page.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// On activate, purge any /assets/* entries from the runtime "static-assets"
// cache that are NOT part of the current precache manifest. This evicts
// stale JS/CSS chunks left over from previous builds so we never serve a
// hashed chunk that the new HTML doesn't reference.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const validUrls = new Set(
        (self.__WB_MANIFEST || []).map((e) => {
          const u = typeof e === "string" ? e : e.url;
          return new URL(u, self.location.origin).pathname;
        }),
      );
      const cacheNamesToScrub = ["static-assets", "html-pages"];
      for (const name of cacheNamesToScrub) {
        const cache = await caches.open(name).catch(() => null);
        if (!cache) continue;
        const reqs = await cache.keys();
        await Promise.all(
          reqs.map(async (req) => {
            const url = new URL(req.url);
            if (url.origin !== self.location.origin) return;
            if (!url.pathname.startsWith("/assets/")) return;
            if (!validUrls.has(url.pathname)) {
              await cache.delete(req);
            }
          }),
        );
      }
    })(),
  );
});

const OFFLINE_URL = "/offline.html";

// HTML navigations: network first, fall back to last good copy, then offline page.
registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "html-pages",
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// Static assets from same origin: stale-while-revalidate keeps the UI snappy.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ["style", "script", "worker"].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: "static-assets",
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// Images (incl. cross-origin avatars / signed Supabase URLs).
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "images",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 })],
  }),
);

// Google Fonts.
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts-stylesheets" }),
);
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);

// Final catch-all: when nothing else can serve a navigation, show offline page.
setCatchHandler(async ({ request }) => {
  if (request.destination === "document" || request.mode === "navigate") {
    const cached = await matchPrecache(OFFLINE_URL);
    if (cached) return cached;
  }
  return Response.error();
});
