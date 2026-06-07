import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getServiceWorkerStatus,
  getCacheNames,
  getCacheEntries,
  getLastUpdateDetected,
  type SWStatus,
} from "@/lib/pwa-diagnostics";
import { ArrowLeft, RefreshCw, Wifi, WifiOff, HardDrive, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pwa-diagnostics")({
  component: PWADiagnosticsPage,
});

function StatusBadge({ state }: { state: SWStatus["state"] }) {
  if (state === "activated") return <Badge variant="default" className="bg-success text-success-foreground">Activated</Badge>;
  if (state === "installed") return <Badge variant="default" className="bg-success text-success-foreground">Installed</Badge>;
  if (state === "installing" || state === "activating") return <Badge variant="secondary">Activating…</Badge>;
  if (state === "none") return <Badge variant="outline">Not registered</Badge>;
  if (state === "redundant") return <Badge variant="destructive">Redundant</Badge>;
  return <Badge variant="outline">Unknown</Badge>;
}

export default function PWADiagnosticsPage() {
  const [status, setStatus] = useState<SWStatus | null>(null);
  const [cacheNames, setCacheNames] = useState<string[]>([]);
  const [cacheDetails, setCacheDetails] = useState<Map<string, { url: string; size: number }[]>>(new Map());
  const [expandedCaches, setExpandedCaches] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    const [swStatus, names, updateTs] = await Promise.all([
      getServiceWorkerStatus(),
      getCacheNames(),
      Promise.resolve(getLastUpdateDetected()),
    ]);
    setStatus(swStatus);
    setCacheNames(names);
    setLastUpdate(updateTs);

    const details = new Map<string, { url: string; size: number }[]>();
    await Promise.all(
      names.map(async (name) => {
        const entries = await getCacheEntries(name);
        details.set(name, entries);
      }),
    );
    setCacheDetails(details);
    setRefreshing(false);
  };

  useEffect(() => {
    void refresh();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const toggleCache = (name: string) => {
    setExpandedCaches((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const totalCachedBytes = Array.from(cacheDetails.values()).reduce(
    (sum, entries) => sum + entries.reduce((s, e) => s + e.size, 0),
    0,
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-display font-semibold">PWA Diagnostics</h1>
          <p className="text-muted-foreground">Service worker status, caches, and offline readiness.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          {online ? (
            <Wifi className="h-5 w-5 text-success" />
          ) : (
            <WifiOff className="h-5 w-5 text-destructive" />
          )}
          <div>
            <div className="text-sm text-muted-foreground">Network</div>
            <div className="font-medium">{online ? "Online" : "Offline"}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm text-muted-foreground">Service Worker</div>
            <div className="font-medium">
              {status ? <StatusBadge state={status.state} /> : "Checking…"}
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="text-sm text-muted-foreground">Cached Data</div>
            <div className="font-medium">{formatBytes(totalCachedBytes)}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-accent" />
          <div>
            <div className="text-sm text-muted-foreground">Last Update</div>
            <div className="font-medium">
              {lastUpdate ? new Date(lastUpdate).toLocaleString() : "—"}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Service Worker</h2>
          <Button size="sm" variant="outline" onClick={() => refresh()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {status ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Supported</dt>
              <dd className="font-medium">{status.supported ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">State</dt>
              <dd className="font-medium"><StatusBadge state={status.state} /></dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Scope</dt>
              <dd className="font-medium break-all">{status.scope ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Script URL</dt>
              <dd className="font-medium break-all">{status.scriptURL ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Controlling page</dt>
              <dd className="font-medium">{status.controlled ? "Yes" : "No"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Caches</h2>
        {cacheNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">No caches found.</p>
        ) : (
          <div className="space-y-2">
            {cacheNames.map((name) => {
              const entries = cacheDetails.get(name) ?? [];
              const size = entries.reduce((s, e) => s + e.size, 0);
              const expanded = expandedCaches.has(name);
              return (
                <div key={name} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCache(name)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground text-xs">
                      {entries.length} entries · {formatBytes(size)}
                    </span>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-3 max-h-64 overflow-y-auto">
                      {entries.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Empty cache</p>
                      ) : (
                        <ul className="space-y-1">
                          {entries.map((entry) => (
                            <li key={entry.url} className="text-xs flex justify-between gap-2 py-0.5 border-b last:border-0">
                              <span className="truncate font-mono text-muted-foreground">{entry.url}</span>
                              <span className="shrink-0 text-muted-foreground">{formatBytes(entry.size)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={async () => {
              const { forceFreshReload } = await import("@/lib/chunk-reload");
              await forceFreshReload();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Auto-reload stale assets
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!("serviceWorker" in navigator)) return;
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.update()));
              await refresh();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Check for SW update
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (typeof caches === "undefined") return;
              const names = await caches.keys();
              await Promise.all(names.map((n) => caches.delete(n)));
              await refresh();
            }}
          >
            Clear all caches
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Auto-reload clears every cache, unregisters the service worker, and reloads the page from the network — use it if a new build is failing to load.
        </p>
      </Card>
    </div>
  );
}
