export type SWStatus = {
  supported: boolean;
  state: "unknown" | "installing" | "installed" | "activating" | "activated" | "redundant" | "none";
  scope: string | null;
  scriptURL: string | null;
  controlled: boolean;
};

export async function getServiceWorkerStatus(): Promise<SWStatus> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { supported: false, state: "unknown", scope: null, scriptURL: null, controlled: false };
  }
  const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
  if (regs.length === 0) {
    return { supported: true, state: "none", scope: null, scriptURL: null, controlled: false };
  }
  const reg = regs[0];
  const sw = reg.active || reg.waiting || reg.installing;
  const state = sw?.state ?? "unknown";
  return {
    supported: true,
    state: state as SWStatus["state"],
    scope: reg.scope ?? null,
    scriptURL: sw?.scriptURL ?? null,
    controlled: navigator.serviceWorker.controller !== null,
  };
}

export async function getCacheNames(): Promise<string[]> {
  if (typeof caches === "undefined") return [];
  return caches.keys().catch(() => []);
}

export async function getCacheEntries(cacheName: string): Promise<{ url: string; size: number }[]> {
  if (typeof caches === "undefined") return [];
  const cache = await caches.open(cacheName).catch(() => null);
  if (!cache) return [];
  const requests = await cache.keys().catch(() => []);
  const entries = await Promise.all(
    requests.map(async (req) => {
      const response = await cache.match(req).catch(() => null);
      const body = response ? await response.blob().catch(() => null) : null;
      return { url: req.url, size: body?.size ?? 0 };
    }),
  );
  return entries;
}

const LAST_UPDATE_KEY = "pwa:last-update-detected";

export function getLastUpdateDetected(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LAST_UPDATE_KEY);
  if (!raw) return null;
  const ts = Number(raw);
  return Number.isFinite(ts) ? ts : null;
}

export function setLastUpdateDetected(ts: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_UPDATE_KEY, String(ts));
}
