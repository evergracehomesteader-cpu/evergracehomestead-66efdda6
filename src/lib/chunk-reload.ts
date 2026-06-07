// One-time forced reload when a dynamic import (lazy route/chunk) fails.
// Stale precached HTML can reference /assets/<hash>.js files that no longer
// exist on the server. When that happens we purge caches and reload exactly
// once per session, so we don't get stuck in a reload loop if the failure
// is unrelated to staleness.

const SESSION_KEY = "pwa:chunk-reload-attempted";

function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false;
  const msg =
    reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : typeof reason === "string"
      ? reason
      : "";
  if (!msg) return false;
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Loading CSS chunk [\w-]+ failed/i.test(msg)
  );
}

async function purgeAssetCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  } catch {
    /* ignore */
  }
}

let triggered = false;

async function handleStaleChunk(): Promise<void> {
  if (triggered) return;
  triggered = true;
  try {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return; // already tried this session
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* sessionStorage may be unavailable */
  }
  await purgeAssetCaches();
  // Tell any controlling SW to skip waiting so the next load gets the new build.
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
  } catch {
    /* ignore */
  }
  // Force a hard reload from the network.
  window.location.reload();
}

export function installChunkReloadHandler(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    const target = event.target as HTMLElement | null;
    // Catch failed <script>/<link> loads injected by dynamic import.
    if (target && (target.tagName === "SCRIPT" || target.tagName === "LINK")) {
      const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href || "";
      if (src.includes("/assets/")) {
        void handleStaleChunk();
        return;
      }
    }
    if (isChunkLoadError(event.error ?? event.message)) {
      void handleStaleChunk();
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) {
      void handleStaleChunk();
    }
  });
}

export async function forceFreshReload(): Promise<void> {
  // Manual "auto-reload stale assets" trigger: nuke caches + SW, then reload.
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  await purgeAssetCaches();
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    } catch {
      /* ignore */
    }
  }
  // Bust HTTP cache by appending a timestamp.
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
}
