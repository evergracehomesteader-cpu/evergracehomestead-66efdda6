import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pwa:install-dismissed-at";
const DISMISS_DAYS = 14;

function recentlyDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Renders an "Install app" affordance when the browser fires
 * beforeinstallprompt (Chrome/Edge/Android). Safari/iOS doesn't expose
 * this API — those users add the app from the share sheet manually.
 */
export function PWAInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // If already running as installed PWA, never show the prompt.
    const mql = window.matchMedia?.("(display-mode: standalone)");
    if (mql?.matches || (navigator as Navigator & { standalone?: boolean }).standalone) {
      setInstalled(true);
      return;
    }

    if (recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !event) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setEvent(null);
  };

  const install = async () => {
    try {
      await event.prompt();
      await event.userChoice;
    } finally {
      setEvent(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install Smileys app"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-border bg-card p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Install Smileys app</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add to your home screen for quick access and offline use.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={install}>Install</Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
