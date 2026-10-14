import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { onSyncStatus, syncNow, type SyncStatus as Status } from "./sync";
import { cn } from "@/lib/utils";

export function SyncStatus() {
  const [status, setStatus] = useState<Status>({ state: "synced" });
  const [spinning, setSpinning] = useState(false);

  useEffect(() => onSyncStatus(setStatus), []);

  const manual = async () => {
    setSpinning(true);
    try {
      await syncNow();
    } finally {
      setSpinning(false);
    }
  };

  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap";
  const tone: Record<Status["state"], string> = {
    synced: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    syncing: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
    "offline-pending":
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    error: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  };

  const label =
    status.state === "synced"
      ? "Synced"
      : status.state === "syncing"
        ? "Syncing…"
        : status.state === "offline-pending"
          ? status.pending > 0
            ? `Offline — ${status.pending} change${status.pending === 1 ? "" : "s"} pending`
            : "Offline"
          : "Sync error";

  const title =
    status.state === "error"
      ? status.message
      : status.state === "offline-pending"
        ? "Changes are saved on this device and will sync when you're back online."
        : "Tap to sync now";

  const Icon =
    status.state === "synced"
      ? CheckCircle2
      : status.state === "syncing"
        ? Loader2
        : status.state === "offline-pending"
          ? CloudOff
          : AlertTriangle;

  return (
    <button
      type="button"
      onClick={manual}
      title={title}
      aria-label={`Sync status: ${label}. Tap to sync now.`}
      className={cn(base, tone[status.state], "cursor-pointer hover:opacity-80")}
    >
      <Icon className={cn("h-3.5 w-3.5", (status.state === "syncing" || spinning) && "animate-spin")} />
      <span className="hidden sm:inline">{label}</span>
      {status.state !== "synced" && status.state !== "syncing" && (
        <RefreshCw className="h-3 w-3 opacity-70" />
      )}
    </button>
  );
}
