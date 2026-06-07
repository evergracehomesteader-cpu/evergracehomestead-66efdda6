import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { registerServiceWorker, type ServiceWorkerHandle } from "@/lib/pwa";
import { setLastUpdateDetected } from "@/lib/pwa-diagnostics";
import { installChunkReloadHandler } from "@/lib/chunk-reload";

/**
 * Mounts the service worker and shows a toast when a new version is ready.
 * Render once at the root of the app.
 */
export function PWAUpdatePrompt() {
  const handleRef = useRef<ServiceWorkerHandle | null>(null);

  useEffect(() => {
    installChunkReloadHandler();
    let cancelled = false;
    let dispose: (() => void) | null = null;

    void registerServiceWorker().then((handle) => {
      if (cancelled || !handle) return;
      handleRef.current = handle;

      dispose = handle.onUpdateAvailable(() => {
        setLastUpdateDetected(Date.now());
        toast("A new version is available", {
          description: "Reload to get the latest changes.",
          duration: Infinity,
          action: {
            label: "Reload",
            onClick: () => handle.promptUpdate(),
          },
        });
      });
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return null;
}
