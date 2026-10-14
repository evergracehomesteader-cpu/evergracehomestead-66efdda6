// Offline sync engine: drains the outbox (push) then pulls incremental
// updates per synced table. Push-before-pull ordering keeps local edits from
// being clobbered by remote state.
//
// Triggers: window 'online' (debounced ~2s), visibilitychange → visible, a
// 60s interval while online, and the exported syncNow() for a manual button.
// Status is broadcast via onSyncStatus().
//
// Conflict resolution: last-write-wins on the per-table watermark column
// (updated_at where present, else created_at / completed_at). A remote row is
// applied to the mirror only when its watermark is strictly newer than the
// local row's. Local pending edits are never overwritten by pull: push runs
// first, and cache refreshes skip ids with pending outbox entries.
//
// Known limitation (phase 1): hard deletes made on another device do not
// propagate to this device's mirror (no tombstone sync). Queued local deletes
// always execute as real deletes on push.
import {
  SYNCED_TABLES,
  WATERMARK_COL,
  getDb,
  getLastSyncedAt,
  getOutboxCount,
  setLastSyncedAt,
  tableStore,
  type OutboxEntry,
  type Row,
  type SyncedTable,
} from "./db";
import { advanceWatermark, backoffMs, lwwWinner, sortOutboxEntries } from "./sync-logic";

type RealClient = { from: (table: string) => any };

export type SyncStatus =
  | { state: "synced" }
  | { state: "syncing" }
  | { state: "offline-pending"; pending: number }
  | { state: "error"; message: string };

type StatusListener = (s: SyncStatus) => void;

const listeners = new Set<StatusListener>();
let lastStatus: SyncStatus = { state: "synced" };
let syncing = false;
let started = false;
let onlineHandler: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let onlineDebounce: ReturnType<typeof setTimeout> | null = null;

export function onSyncStatus(cb: StatusListener): () => void {
  listeners.add(cb);
  cb(lastStatus);
  return () => {
    listeners.delete(cb);
  };
}

function emit(s: SyncStatus): void {
  lastStatus = s;
  for (const cb of listeners) {
    try {
      cb(s);
    } catch {
      /* listener errors must not break sync */
    }
  }
}

const isOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

const errMsg = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);

/** Push one outbox entry to Supabase. Throws on failure. */
async function pushEntry(real: RealClient, entry: OutboxEntry): Promise<void> {
  if (entry.op === "delete") {
    const res = await real.from(entry.table).delete().eq("id", entry.rowId);
    if (res.error) throw new Error(errMsg(res.error));
    return;
  }
  // insert/update/upsert all replay idempotently via upsert onConflict id,
  // so retries and replays never create duplicates.
  const res = await real
    .from(entry.table)
    .upsert(entry.payload, { onConflict: "id" });
  if (res.error) throw new Error(errMsg(res.error));
}

/** Drain the outbox FIFO with table priority; never silently drops entries. */
export async function pushOutbox(real: RealClient): Promise<{ pushed: number; failed: number }> {
  const db = getDb();
  const all = await db.outbox.toArray();
  const now = Date.now();
  const due = all.filter(
    (e) => !e.nextRetryAt || new Date(e.nextRetryAt).getTime() <= now,
  );
  const ordered = sortOutboxEntries(due);
  let pushed = 0;
  let failed = 0;
  for (const entry of ordered) {
    try {
      await pushEntry(real, entry);
      await db.outbox.delete(entry.id!);
      pushed++;
    } catch (e) {
      failed++;
      const attempts = entry.attempts + 1;
      await db.outbox.update(entry.id!, {
        attempts,
        lastError: errMsg(e),
        nextRetryAt: new Date(Date.now() + backoffMs(attempts)).toISOString(),
      });
      // Keep going with the rest of the queue — one bad row must not block
      // unrelated tables.
    }
  }
  return { pushed, failed };
}

const PAGE_SIZE = 1000;

/** Pull one table incrementally and LWW-merge into the mirror. */
async function pullTable(real: RealClient, table: SyncedTable): Promise<void> {
  const db = getDb();
  const wmCol = WATERMARK_COL[table];
  const since = await getLastSyncedAt(table);
  const store = tableStore(table);

  let offset = 0;
  let maxWm = since;
  for (;;) {
    const base = real.from(table).select("*");
    const page = since
      ? await base.gt(wmCol, since).range(offset, offset + PAGE_SIZE - 1)
      : await base.range(offset, offset + PAGE_SIZE - 1);
    if (page.error) throw new Error(errMsg(page.error));
    const rows = (page.data ?? []) as Row[];
    if (rows.length === 0) break;

    // Last-write-wins: apply a remote row only if its watermark is strictly
    // newer than the local row's. Local rows without the watermark column
    // (e.g. legacy) are always overwritten.
    const toPut: Row[] = [];
    for (const remote of rows) {
      if (remote == null || remote.id == null) continue;
      const local = await store.get(String(remote.id));
      if (!local || lwwWinner(local[wmCol], remote[wmCol]) === "remote") {
        toPut.push(remote);
      }
    }
    if (toPut.length > 0) await store.bulkPut(toPut);

    maxWm = advanceWatermark(maxWm, rows, wmCol);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (maxWm && maxWm !== since) await setLastSyncedAt(table, maxWm);
}

export async function pullTables(real: RealClient): Promise<void> {
  for (const table of SYNCED_TABLES) {
    await pullTable(real, table);
  }
}

let realClient: RealClient | null = null;

/** Full sync cycle: push pending writes first, then pull remote changes. */
export async function syncNow(): Promise<void> {
  if (syncing || !realClient) return;
  if (typeof window === "undefined") return;
  syncing = true;
  emit({ state: "syncing" });
  try {
    if (!isOnline()) {
      const pending = await getOutboxCount();
      emit({ state: "offline-pending", pending });
      return;
    }
    await pushOutbox(realClient);
    await pullTables(realClient);
    const pending = await getOutboxCount();
    if (pending === 0) {
      emit({ state: "synced" });
    } else {
      const [first] = await getDb().outbox.orderBy("id").limit(1).toArray();
      emit({
        state: "error",
        message: first?.lastError ?? `${pending} change(s) still pending`,
      });
    }
  } catch (e) {
    if (!isOnline()) {
      const pending = await getOutboxCount().catch(() => 0);
      emit({ state: "offline-pending", pending });
    } else {
      emit({ state: "error", message: errMsg(e) });
    }
  } finally {
    syncing = false;
  }
}

/**
 * Start the background sync engine. Safe to call once; subsequent calls are
 * no-ops. Browser-only — the caller must guard `typeof window`.
 */
export function startSyncEngine(real: RealClient): void {
  if (started || typeof window === "undefined") return;
  started = true;
  realClient = real;

  const schedule = () => {
    if (onlineDebounce) clearTimeout(onlineDebounce);
    onlineDebounce = setTimeout(() => void syncNow(), 2000);
  };

  onlineHandler = () => schedule();
  visibilityHandler = () => {
    if (document.visibilityState === "visible") void syncNow();
  };
  window.addEventListener("online", onlineHandler);
  document.addEventListener("visibilitychange", visibilityHandler);
  intervalId = setInterval(() => {
    if (isOnline()) void syncNow();
  }, 60_000);

  // Initial sync shortly after boot (lets auth/session settle first).
  setTimeout(() => void syncNow(), 3000);

  // Report current pending count so the pill is accurate on load.
  void getOutboxCount()
    .then((n) => {
      if (n > 0 && !isOnline()) emit({ state: "offline-pending", pending: n });
    })
    .catch(() => {});
}

/** Test hook: reset the started guard. */
export function __resetSyncEngineForTests(): void {
  started = false;
  realClient = null;
  if (typeof window !== "undefined") {
    if (onlineHandler) window.removeEventListener("online", onlineHandler);
    if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
    if (intervalId) clearInterval(intervalId);
    if (onlineDebounce) clearTimeout(onlineDebounce);
  }
  onlineHandler = null;
  visibilityHandler = null;
  intervalId = null;
  onlineDebounce = null;
}
