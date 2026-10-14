// Offline-first persistence layer: Dexie (IndexedDB) mirror + outbox queue.
//
// - One Dexie store per synced Supabase table (keyPath `id`), mirroring rows
//   pulled from the server so reads work while offline.
// - `outbox`: local-first mutations waiting to be pushed to Supabase, drained
//   FIFO by the sync engine in src/lib/offline/sync.ts.
// - `sync_meta`: per-table high-watermark for incremental pulls.
//
// Per-table watermark column (documented here so pull/merge stay consistent):
//   * `updated_at` — animals, pregnancies, health_records, litters, chores,
//     tasks, garden_plots, pens (mutable entity tables)
//   * `created_at` — animal_events, weight_logs, chore_assignments, feed_logs,
//     feed_purchases, production_logs, compost_entries (append-only log tables;
//     they are insert-only in practice, so last-write-wins holds trivially)
//   * `completed_at` — chore_completions (has no created_at/updated_at)
//
// Known limitation (phase 1): hard deletes made on *another* device do not
// propagate to this device's mirror — there is no tombstone sync. Acceptable
// for the single-user case; queued local deletes always execute as real
// deletes on push.
import Dexie, { type Table } from "dexie";

export const SYNCED_TABLES = [
  "animals",
  "pregnancies",
  "health_records",
  "animal_events",
  "weight_logs",
  "litters",
  "chores",
  "chore_assignments",
  "chore_completions",
  "tasks",
  "feed_logs",
  "feed_purchases",
  "production_logs",
  "compost_entries",
  "garden_plots",
  "pens",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

export const SYNCED_TABLE_SET: ReadonlySet<string> = new Set<string>(SYNCED_TABLES);

export const isSyncedTable = (table: string): table is SyncedTable =>
  SYNCED_TABLE_SET.has(table);

/** Watermark column used for incremental pulls and LWW merge, per table. */
export const WATERMARK_COL: Record<SyncedTable, string> = {
  animals: "updated_at",
  pregnancies: "updated_at",
  health_records: "updated_at",
  litters: "updated_at",
  chores: "updated_at",
  tasks: "updated_at",
  garden_plots: "updated_at",
  pens: "updated_at",
  animal_events: "created_at",
  weight_logs: "created_at",
  chore_assignments: "created_at",
  feed_logs: "created_at",
  feed_purchases: "created_at",
  production_logs: "created_at",
  compost_entries: "created_at",
  chore_completions: "completed_at",
};

/**
 * Push priority tier per table (lower drains first) so parent rows reach the
 * server before child rows that reference them (FKs are UUIDs, but ordering
 * keeps server-side triggers/RLS checks that join parents happy).
 *   tier 0 — parents / standalone entities
 *   tier 1 — children (reference animals or chores)
 */
export const TABLE_PRIORITY: Record<SyncedTable, number> = {
  animals: 0,
  pens: 0,
  garden_plots: 0,
  chores: 0,
  tasks: 0,
  feed_logs: 0,
  feed_purchases: 0,
  production_logs: 0,
  compost_entries: 0,
  litters: 0,
  pregnancies: 0,
  health_records: 1,
  animal_events: 1,
  weight_logs: 1,
  chore_assignments: 1,
  chore_completions: 1,
};

export type OutboxOp = "insert" | "update" | "delete";

export interface OutboxEntry {
  /** auto-increment */
  id?: number;
  table: SyncedTable;
  op: OutboxOp;
  rowId: string;
  /** full row for insert/update/upsert; null for deletes */
  payload: Record<string, unknown> | null;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  /** ISO timestamp; entry is skipped by push until this passes (backoff) */
  nextRetryAt: string | null;
}

export interface SyncMeta {
  table: string;
  /** ISO watermark of the newest remote row pulled so far, or null */
  lastSyncedAt: string | null;
}

export type Row = Record<string, unknown>;

class OfflineDb extends Dexie {
  outbox!: Table<OutboxEntry, number>;
  sync_meta!: Table<SyncMeta, string>;

  constructor() {
    super("homestead-offline");
    const tableStores: Record<string, string> = {};
    for (const t of SYNCED_TABLES) tableStores[t] = "id";
    this.version(1).stores({
      ...tableStores,
      // indexes on table/rowId/createdAt let the shim overlay pending rows
      // and the engine drain in FIFO order without full scans.
      outbox: "++id,table,rowId,createdAt",
      sync_meta: "table",
    });
    // Dynamic per-table accessors (typed loosely; rows are untyped mirrors).
    for (const t of SYNCED_TABLES) {
      (this as unknown as Record<string, Table<Row, string>>)[t] = this.table(t);
    }
  }
}

let dbInstance: OfflineDb | null = null;

/**
 * Browser-only lazy singleton. Safe to import on the server / in tests —
 * the Dexie instance is only constructed when first requested in a browser.
 */
export function getDb(): OfflineDb {
  if (typeof window === "undefined") {
    throw new Error("offline db is browser-only");
  }
  if (!dbInstance) dbInstance = new OfflineDb();
  return dbInstance;
}

/** Convenience accessor for a synced table's store. */
export function tableStore(table: SyncedTable): Table<Row, string> {
  return (getDb() as unknown as Record<string, Table<Row, string>>)[table];
}

export const nowISO = (): string => new Date().toISOString();

export const newId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Build an outbox entry (pure — the sync engine adds it to the store). */
export function buildOutboxEntry(
  table: SyncedTable,
  op: OutboxOp,
  rowId: string,
  payload: Record<string, unknown> | null,
): OutboxEntry {
  return {
    table,
    op,
    rowId,
    payload,
    createdAt: nowISO(),
    attempts: 0,
    lastError: null,
    nextRetryAt: null,
  };
}

export async function enqueueOutbox(entry: OutboxEntry): Promise<number> {
  return getDb().outbox.add(entry);
}

export async function getOutboxCount(): Promise<number> {
  return getDb().outbox.count();
}

/** Row ids with pending outbox writes for a table (used to overlay reads). */
export async function getPendingRowIds(table: SyncedTable): Promise<string[]> {
  const rows = await getDb().outbox.where("table").equals(table).toArray();
  return rows.map((r) => r.rowId);
}

export async function getLastSyncedAt(table: SyncedTable): Promise<string | null> {
  const meta = await getDb().sync_meta.get(table);
  return meta?.lastSyncedAt ?? null;
}

export async function setLastSyncedAt(table: SyncedTable, iso: string | null): Promise<void> {
  await getDb().sync_meta.put({ table, lastSyncedAt: iso });
}
