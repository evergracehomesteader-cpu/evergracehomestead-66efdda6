// Service worker registration with strict guards: never run inside an iframe
// or on Lovable preview hosts, and auto-unregister any leftover SW there.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovableproject-dev.com") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (inIframe || isPreviewHost) {
    // Clean up any previously-registered worker (e.g. if user visited published
    // site, then opened the preview).
    void navigator.serviceWorker.getRegistrations().then((rs) =>
      rs.forEach((r) => void r.unregister()),
    );
    return;
  }

  void import("workbox-window").then(({ Workbox }) => {
    const wb = new Workbox("/sw.js");
    wb.addEventListener("waiting", () => {
      wb.messageSkipWaiting();
    });
    wb.addEventListener("controlling", () => {
      window.location.reload();
    });
    void wb.register();
  }).catch(() => {
    // If workbox-window can't load, fall back to native registration.
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
