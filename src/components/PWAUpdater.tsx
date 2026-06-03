import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WifiOff } from "lucide-react";

function isUnsafeContext(): boolean {
  if (typeof window === "undefined") return true;
  // In an iframe (Lovable editor preview)
  let inIframe = false;
  try { inIframe = window.self !== window.top; } catch { inIframe = true; }
  if (inIframe) return true;
  const host = window.location.hostname;
  return (
    host.includes("id-preview--") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovableproject-dev.com") ||
    host.endsWith(".lovable.dev") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

/**
 * Registers the service worker (production-only, non-iframe) and:
 *   - shows a toast with a "Reload" action when a new version is available
 *   - shows an offline banner when network is unavailable
 *
 * In Lovable preview/iframe contexts the SW is NEVER registered, and any
 * existing registration is removed to prevent stale-cache problems.
 */
export function PWAUpdater() {
  const [online, setOnline] = useState(true);

  // Hydration-safe: only read navigator after mount
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    if (isUnsafeContext()) {
      // Clean up any previously registered SW in preview/iframe
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        }).catch(() => {});
      }
      return;
    }
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    (async () => {
      try {
        const { registerSW } = await import("virtual:pwa-register");
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            if (cancelled) return;
            toast("New version available", {
              description: "Reload to get the latest update.",
              duration: Infinity,
              action: {
                label: "Reload",
                onClick: () => updateSW(true),
              },
            });
          },
          onOfflineReady() {
            toast.success("App ready to work offline");
          },
          onRegisterError(err) {
            console.error("[PWA] SW registration failed", err);
          },
        });
      } catch (err) {
        console.error("[PWA] Failed to load SW registration module", err);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (online) return null;
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-destructive text-destructive-foreground px-4 py-1.5 text-xs font-medium shadow-lg">
      <WifiOff className="h-3.5 w-3.5" />
      Offline — showing cached data
    </div>
  );
}

// Re-export to avoid unused-import warning when Button is added later.
export const _PWAButton = Button;
