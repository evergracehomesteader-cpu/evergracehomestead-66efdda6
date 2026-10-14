// Pure, side-effect-free sync logic. Kept free of Dexie/browser imports so it
// is unit-testable in node (see src/lib/offline/__tests__/sync-logic.test.ts).
import { TABLE_PRIORITY, type OutboxEntry, type SyncedTable } from "./db";

export type LwwResult = "remote" | "local" | "tie";

/**
 * FIFO drain order with table priority: parents before children, then oldest
 * first (ascending outbox id) within the same tier.
 */
export function sortOutboxEntries(entries: OutboxEntry[]): OutboxEntry[] {
  return [...entries].sort((a, b) => {
    const pa = TABLE_PRIORITY[a.table as SyncedTable] ?? 0;
    const pb = TABLE_PRIORITY[b.table as SyncedTable] ?? 0;
    if (pa !== pb) return pa - pb;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

/**
 * Last-write-wins merge decision between a local row and a remote row.
 * Compares watermark values (ISO timestamps sort lexicographically).
 * Missing watermark counts as the oldest possible value ("").
 */
export function lwwWinner(
  localWm: unknown,
  remoteWm: unknown,
): LwwResult {
  const l = typeof localWm === "string" ? localWm : "";
  const r = typeof remoteWm === "string" ? remoteWm : "";
  if (r > l) return "remote";
  if (l > r) return "local";
  return "tie";
}

/**
 * Advance a table's high-watermark given previously stored value and freshly
 * pulled rows. Returns the previous value when nothing newer arrived (callers
 * only persist when the result differs).
 */
export function advanceWatermark(
  prev: string | null,
  rows: Array<Record<string, unknown>>,
  watermarkCol: string,
): string | null {
  let next = prev ?? "";
  for (const row of rows) {
    const v = row[watermarkCol];
    if (typeof v === "string" && v > next) next = v;
  }
  return next === "" ? null : next;
}

/** Exponential backoff between push retries: 5s, 15s, 30s, 60s, capped. */
export function backoffMs(attempts: number): number {
  const steps = [5000, 15000, 30000, 60000];
  return steps[Math.min(Math.max(attempts - 1, 0), steps.length - 1)];
}
