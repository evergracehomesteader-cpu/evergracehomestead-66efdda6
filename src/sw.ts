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
