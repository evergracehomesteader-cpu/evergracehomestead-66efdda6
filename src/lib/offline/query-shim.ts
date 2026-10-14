// PostgREST-builder-compatible shim for synced tables.
//
// Reads:  network-first — delegate to the real builder; on success refresh
//         the Dexie mirror in the background. On network failure fall back to
//         the Dexie mirror with best-effort filter support (eq/neq/in/gt/gte/
//         lt/lte/order/limit), overlaying outbox-pending rows so the user
//         always sees their own writes (pending rows win by id).
// Mutations (insert/update/upsert/delete): ALWAYS local-first, online or
//         offline — write the row to Dexie immediately, append to the outbox,
//         resolve { data, error: null }. The sync engine pushes later.
// Unsupported builder methods (.or/.is/.not/.like/...): recorded and replayed
//         on the real client. If offline they surface the network error
//         exactly as today — no behavior change for exotic queries.
//
// The class is thenable so `await`, `.then()` and `Promise.all()` all work.
// Callers only ever see it through the `supabase` proxy in src/lib/supabase.ts,
// which is typed as the real client — so no call-site changes are needed.
import {
  WATERMARK_COL,
  buildOutboxEntry,
  getDb,
  newId,
  nowISO,
  tableStore,
  type OutboxOp,
  type Row,
  type SyncedTable,
} from "./db";

export interface LocalFilter {
  type: "eq" | "neq" | "in" | "gt" | "gte" | "lt" | "lte";
  col: string;
  value: unknown;
}

interface LocalOrder {
  col: string;
  ascending: boolean;
}

type OpRecord =
  | { kind: "select"; columns: string; options?: Record<string, unknown> }
  | { kind: "mutation"; op: OutboxOp | "upsert"; args: unknown[] }
  | { kind: "filter"; type: LocalFilter["type"]; col: string; value: unknown }
  | { kind: "order"; col: string; ascending: boolean }
  | { kind: "limit"; n: number }
  | { kind: "single" }
  | { kind: "maybeSingle" }
  | { kind: "unsupported"; method: string; args: unknown[] };

export interface ShimResult {
  data: unknown;
  error: unknown;
  count: number | null;
  status: number;
}

/** Compare two values the way the common PostgREST filters need. */
function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function matchesFilter(row: Row, f: LocalFilter): boolean {
  const v = row[f.col];
  switch (f.type) {
    case "eq":
      // eslint-disable-next-line eqeqeq
      return v == f.value;
    case "neq":
      // eslint-disable-next-line eqeqeq
      return v != f.value;
    case "in":
      return Array.isArray(f.value) && f.value.some((x) => x == v); // eslint-disable-line eqeqeq
    case "gt":
      return cmp(v, f.value) > 0;
    case "gte":
      return cmp(v, f.value) >= 0;
    case "lt":
      return cmp(v, f.value) < 0;
    case "lte":
      return cmp(v, f.value) <= 0;
  }
}

/** Pure local query application (exported for unit tests). */
export function applyLocalQuery(
  rows: Row[],
  filters: LocalFilter[],
  orders: LocalOrder[],
  limit: number | null,
): Row[] {
  let out = rows.filter((r) => filters.every((f) => matchesFilter(r, f)));
  if (orders.length > 0) {
    out = [...out].sort((a, b) => {
      for (const o of orders) {
        const c = cmp(a[o.col], b[o.col]);
        if (c !== 0) return o.ascending ? c : -c;
      }
      return 0;
    });
  }
  if (limit != null) out = out.slice(0, limit);
  return out;
}

const asArray = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);

const SUPPORTED_FILTER_OPS: Record<string, LocalFilter["type"]> = {
  eq: "eq",
  neq: "neq",
  in: "in",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
};

export class OfflineQueryBuilder implements PromiseLike<ShimResult> {
  private ops: OpRecord[] = [];
  private filters: LocalFilter[] = [];
  private orders: LocalOrder[] = [];
  private limitN: number | null = null;
  private singleFlag = false;
  private maybeSingleFlag = false;
  private mutation: { op: OutboxOp | "upsert"; args: unknown[] } | null = null;
  private hasUnsupported = false;
  private promise: Promise<ShimResult> | null = null;

  constructor(
    private table: SyncedTable,
    private real: { from: (t: string) => unknown },
  ) {}

  // ---- chainable builder API (subset actually used by the app) ----
  select(columns = "*", options?: Record<string, unknown>): this {
    this.ops.push({ kind: "select", columns, options });
    return this;
  }
  insert(values: unknown, options?: Record<string, unknown>): this {
    this.ops.push({ kind: "mutation", op: "insert", args: [values, options] });
    this.mutation = { op: "insert", args: [values] };
    return this;
  }
  update(values: unknown, options?: Record<string, unknown>): this {
    this.ops.push({ kind: "mutation", op: "update", args: [values, options] });
    this.mutation = { op: "update", args: [values] };
    return this;
  }
  upsert(values: unknown, options?: Record<string, unknown>): this {
    this.ops.push({ kind: "mutation", op: "upsert", args: [values, options] });
    this.mutation = { op: "upsert", args: [values] };
    return this;
  }
  delete(options?: Record<string, unknown>): this {
    this.ops.push({ kind: "mutation", op: "delete", args: [options] });
    this.mutation = { op: "delete", args: [] };
    return this;
  }
  eq(col: string, value: unknown): this {
    return this.addFilter("eq", col, value);
  }
  neq(col: string, value: unknown): this {
    return this.addFilter("neq", col, value);
  }
  in(col: string, value: unknown[]): this {
    return this.addFilter("in", col, value);
  }
  gt(col: string, value: unknown): this {
    return this.addFilter("gt", col, value);
  }
  gte(col: string, value: unknown): this {
    return this.addFilter("gte", col, value);
  }
  lt(col: string, value: unknown): this {
    return this.addFilter("lt", col, value);
  }
  lte(col: string, value: unknown): this {
    return this.addFilter("lte", col, value);
  }
  order(col: string, options?: { ascending?: boolean }): this {
    const ascending = options?.ascending ?? true;
    this.ops.push({ kind: "order", col, ascending });
    this.orders.push({ col, ascending });
    return this;
  }
  limit(n: number): this {
    this.ops.push({ kind: "limit", n });
    this.limitN = n;
    return this;
  }
  single(): this {
    this.ops.push({ kind: "single" });
    this.singleFlag = true;
    return this;
  }
  maybeSingle(): this {
    this.ops.push({ kind: "maybeSingle" });
    this.maybeSingleFlag = true;
    return this;
  }

  /**
   * Generic postgrest escape hatch `.filter(col, op, value)`. Known ops are
   * handled locally; everything else is replayed on the real client.
   */
  filter(col: string, op: string, value: unknown): this {
    const known = SUPPORTED_FILTER_OPS[op];
    if (known) return this.addFilter(known, col, value);
    return this.unsupported("filter", [col, op, value]);
  }

  /** Any other PostgREST method (or/is/not/like/ilike/range/...): recorded
   *  for replay on the real client at execution time. Called by the Proxy in
   *  queued-client.ts for methods the shim does not implement itself. */
  recordUnsupported(method: string, ...args: unknown[]): this {
    return this.unsupported(method, args);
  }

  private addFilter(type: LocalFilter["type"], col: string, value: unknown): this {
    this.ops.push({ kind: "filter", type, col, value });
    this.filters.push({ type, col, value });
    return this;
  }

  private unsupported(method: string, args: unknown[]): this {
    this.ops.push({ kind: "unsupported", method, args });
    this.hasUnsupported = true;
    return this;
  }

  // ---- thenable ----
  then<TResult1 = ShimResult, TResult2 = never>(
    onfulfilled?: (value: ShimResult) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ): Promise<TResult1 | TResult2> {
    if (!this.promise) this.promise = this.run();
    return this.promise.then(onfulfilled, onrejected);
  }
  catch<TResult = never>(
    onrejected?: (reason: unknown) => TResult | PromiseLike<TResult>,
  ): Promise<ShimResult | TResult> {
    if (!this.promise) this.promise = this.run();
    return this.promise.catch(onrejected);
  }
  finally(onfinally?: () => void): Promise<ShimResult> {
    if (!this.promise) this.promise = this.run();
    return this.promise.finally(onfinally);
  }

  // ---- execution ----
  private async run(): Promise<ShimResult> {
    if (this.mutation) return this.runMutation();
    return this.runRead();
  }

  /** Replay the recorded chain on a real PostgREST builder. */
  private replayReal(): PromiseLike<ShimResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (this.real.from as (t: string) => any)(this.table);
    for (const op of this.ops) {
      switch (op.kind) {
        case "select":
          q = q.select(op.columns, op.options);
          break;
        case "mutation":
          q = q[op.op](...op.args);
          break;
        case "filter":
          q = q[op.type](op.col, op.value);
          break;
        case "order":
          q = q.order(op.col, { ascending: op.ascending });
          break;
        case "limit":
          q = q.limit(op.n);
          break;
        case "single":
          q = q.single();
          break;
        case "maybeSingle":
          q = q.maybeSingle();
          break;
        case "unsupported":
          q = q[op.method](...op.args);
          break;
      }
    }
    return q as PromiseLike<ShimResult>;
  }

  private shapeList(rows: Row[]): ShimResult {
    if (this.singleFlag) {
      if (rows.length === 0) {
        return {
          data: null,
          error: {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: "The result contains 0 rows",
            hint: null,
          },
          count: null,
          status: 406,
        };
      }
      return { data: rows[0], error: null, count: null, status: 200 };
    }
    if (this.maybeSingleFlag) {
      return { data: rows[0] ?? null, error: null, count: null, status: 200 };
    }
    return { data: rows, error: null, count: rows.length, status: 200 };
  }

  // ---- reads: network-first, Dexie fallback ----
  private async runRead(): Promise<ShimResult> {
    if (this.hasUnsupported) {
      // Exotic query — delegate. Offline, the network error surfaces exactly
      // as it does today (no behavior change for unsupported queries).
      return await this.replayReal();
    }
    try {
      const res = await this.replayReal();
      if (res && !res.error && Array.isArray(res.data)) {
        // Background cache refresh; never blocks the caller.
        void this.refreshCache(res.data as Row[]);
      }
      return res;
    } catch {
      return await this.fallbackRead();
    }
  }

  /** Merge successful network rows into the mirror, skipping ids that have
   *  pending local edits so we never clobber unpushed writes. */
  private async refreshCache(rows: Row[]): Promise<void> {
    try {
      const db = getDb();
      const pending = await db.outbox.where("table").equals(this.table).toArray();
      const pendingIds = new Set(pending.map((p) => p.rowId));
      const store = tableStore(this.table);
      const fresh = rows.filter((r) => r && !pendingIds.has(String(r.id)));
      if (fresh.length > 0) await store.bulkPut(fresh);
    } catch {
      /* cache refresh is best-effort */
    }
  }

  /** Offline read path: Dexie mirror + outbox overlay. */
  private async fallbackRead(): Promise<ShimResult> {
    const db = getDb();
    const store = tableStore(this.table);
    const [all, pending] = await Promise.all([
      store.toArray(),
      db.outbox.where("table").equals(this.table).toArray(),
    ]);
    const deletedIds = new Set(
      pending.filter((p) => p.op === "delete").map((p) => p.rowId),
    );
    const byId = new Map<string, Row>();
    for (const r of all) {
      const id = String(r.id);
      if (!deletedIds.has(id)) byId.set(id, r);
    }
    // Pending writes win by id (payload for insert/update; queued deletes are
    // already excluded above).
    for (const p of pending) {
      if (p.op === "delete") continue;
      if (p.payload) byId.set(p.rowId, p.payload as Row);
      else {
        const row = await store.get(p.rowId);
        if (row) byId.set(p.rowId, row);
      }
    }
    const rows = applyLocalQuery([...byId.values()], this.filters, this.orders, this.limitN);
    return this.shapeList(rows);
  }

  // ---- mutations: always local-first ----
  private async runMutation(): Promise<ShimResult> {
    if (this.hasUnsupported) {
      // Exotic mutation shape — delegate to the real client.
      return await this.replayReal();
    }
    const op = this.mutation!.op;
    if (op === "delete") return this.localDelete();
    return this.localWrite(op);
  }

  private touchInsert(row: Row): void {
    const wm = WATERMARK_COL[this.table];
    if ((wm === "updated_at" || wm === "created_at") && row[wm] == null) {
      row[wm] = nowISO();
    }
  }

  private touchUpdate(row: Row): void {
    if (WATERMARK_COL[this.table] === "updated_at") row.updated_at = nowISO();
  }

  private async localWrite(op: "insert" | "update" | "upsert"): Promise<ShimResult> {
    const db = getDb();
    const store = tableStore(this.table);
    const payload = this.mutation!.args[0];
    const out: Row[] = [];

    if (op === "insert") {
      const rows = asArray(payload as Row).map((r) => ({ ...(r as Row) }));
      for (const row of rows) {
        if (row.id == null) row.id = newId();
        this.touchInsert(row);
      }
      await db.transaction("rw", store, db.outbox, async () => {
        await store.bulkPut(rows);
        for (const row of rows) {
          await db.outbox.add(
            buildOutboxEntry(this.table, "insert", String(row.id), row),
          );
        }
      });
      out.push(...rows);
    } else if (op === "upsert") {
      const rows = asArray(payload as Row).map((r) => ({ ...(r as Row) }));
      await db.transaction("rw", store, db.outbox, async () => {
        for (const row of rows) {
          if (row.id == null) row.id = newId();
          const existing = await store.get(String(row.id));
          const merged: Row = { ...(existing ?? {}), ...row };
          this.touchInsert(merged);
          this.touchUpdate(merged);
          await store.put(merged);
          await db.outbox.add(
            buildOutboxEntry(this.table, "update", String(merged.id), merged),
          );
          out.push(merged);
        }
      });
    } else {
      // update: payload is a partial object merged into filter-matched rows
      const patch = { ...(payload as Row) };
      const matched = applyLocalQuery(await store.toArray(), this.filters, [], null);
      await db.transaction("rw", store, db.outbox, async () => {
        for (const row of matched) {
          const merged: Row = { ...row, ...patch, id: row.id };
          this.touchUpdate(merged);
          await store.put(merged);
          await db.outbox.add(
            buildOutboxEntry(this.table, "update", String(merged.id), merged),
          );
          out.push(merged);
        }
      });
    }
    return this.shapeList(out);
  }

  private async localDelete(): Promise<ShimResult> {
    const db = getDb();
    const store = tableStore(this.table);
    const matched = applyLocalQuery(await store.toArray(), this.filters, [], null);
    const ids = matched.map((r) => String(r.id));
    await db.transaction("rw", store, db.outbox, async () => {
      await store.bulkDelete(ids);
      for (const id of ids) {
        await db.outbox.add(buildOutboxEntry(this.table, "delete", id, null));
      }
    });
    // PostgREST delete without .select() resolves with an empty data array.
    return this.shapeList([]);
  }
}
