// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    // Widen browser support so older iOS Safari versions can parse the bundle.
    build: { target: ["es2020", "safari15"] },
  },
  plugins: [
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: null, // we register manually with iframe/preview guards
      devOptions: { enabled: false },
      manifest: false, // we ship public/manifest.webmanifest ourselves
      includeAssets: ["offline.html", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      injectManifest: {
        // Never precache HTML (except the offline fallback added via
        // includeAssets): stale precached HTML points at deleted asset hashes
        // and renders a blank page, which iOS Safari holds onto aggressively.
        globPatterns: ["**/*.{js,css,ico,png,svg,webp,woff,woff2}"],
        // Cloudflare Workers + TanStack Start can produce large prerendered chunks.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
