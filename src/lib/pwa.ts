// Service worker registration with strict guards: never run inside an iframe
// or on Lovable preview hosts, and auto-unregister any leftover SW there.
//
// Returns a function that triggers SKIP_WAITING on the waiting worker so the
// UI can offer an explicit "reload to update" affordance. A `null` return
// means no worker was registered (preview/iframe/unsupported env).
import type { Workbox } from "workbox-window";

export type ServiceWorkerHandle = {
  promptUpdate: () => void;
  onUpdateAvailable: (cb: () => void) => () => void;
};

function isPreviewEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovableproject-dev.com") ||
    host === "localhost" ||
    host === "127.0.0.1";

  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  return inIframe || isPreviewHost;
}

export async function registerServiceWorker(): Promise<ServiceWorkerHandle | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  if (isPreviewEnvironment()) {
    // Clean up any previously-registered worker so the preview is never
    // served from cache.
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    return null;
  }

  let wb: Workbox;
  try {
    const mod = await import("workbox-window");
    wb = new mod.Workbox("/sw.js");
  } catch {
    // Fallback to native registration; no update prompt available.
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return null;
  }

  const listeners = new Set<() => void>();
  const fireUpdate = () => listeners.forEach((cb) => cb());

  // First-install: the SW took control of the page for the first time.
  // No reload needed — content is just primed for offline use.
  wb.addEventListener("waiting", () => fireUpdate());
  wb.addEventListener("externalwaiting", () => fireUpdate());

  // The new worker has taken control — reload so the page runs the new build.
  let reloading = false;
  wb.addEventListener("controlling", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  try {
    await wb.register();
  } catch {
    return null;
  }

  return {
    promptUpdate: () => {
      wb.messageSkipWaiting();
    },
    onUpdateAvailable: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
