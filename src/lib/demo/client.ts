// Demo Supabase client — a shim that mimics the subset of PostgREST + auth
// the app uses, backed by localStorage. Never talks to the real backend.
import { readDb, writeDb } from "./mode";

type Row = Record<string, unknown>;
type Op = { kind: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is" | "not_eq" | "or" | "match" | "filter"; col?: string; val?: unknown };

const DEMO_USER = {
  id: "demo-user-0000-0000-0000-000000000000",
  email: "demo@evergrace.local",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: { display_name: "Demo Homesteader" },
  created_at: new Date().toISOString(),
};

const DEMO_SESSION = {
  access_token: "demo-token",
  refresh_token: "demo-refresh",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: DEMO_USER,
};

function uid(): string {
  return "d-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

function matchesOp(row: Row, op: Op): boolean {
  const v = row[op.col ?? ""];
  switch (op.kind) {
    case "eq": return v === op.val;
    case "neq": return v !== op.val;
    case "gt": return (v as number) > (op.val as number);
    case "gte": return (v as number) >= (op.val as number);
    case "lt": return (v as number) < (op.val as number);
    case "lte": return (v as number) <= (op.val as number);
    case "in": return Array.isArray(op.val) && (op.val as unknown[]).includes(v);
    case "is": return v === op.val || (op.val === null && (v === null || v === undefined));
    case "not_eq": return v !== op.val;
    case "match": {
      const m = op.val as Row;
      return Object.keys(m).every((k) => row[k] === m[k]);
    }
    default: return true;
  }
}

class QB {
  private table: string;
  private ops: Op[] = [];
  private orderBy: { col: string; asc: boolean } | null = null;
  private limitN: number | null = null;
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;

  constructor(table: string) { this.table = table; }

  select(_cols?: string, _opts?: unknown) { this.mode = this.mode === "select" ? "select" : this.mode; return this; }
  insert(v: Row | Row[]) { this.mode = "insert"; this.payload = v; return this; }
  update(v: Row) { this.mode = "update"; this.payload = v; return this; }
  upsert(v: Row | Row[]) { this.mode = "upsert"; this.payload = v; return this; }
  delete() { this.mode = "delete"; return this; }

  eq(col: string, val: unknown) { this.ops.push({ kind: "eq", col, val }); return this; }
  neq(col: string, val: unknown) { this.ops.push({ kind: "neq", col, val }); return this; }
  gt(col: string, val: unknown) { this.ops.push({ kind: "gt", col, val }); return this; }
  gte(col: string, val: unknown) { this.ops.push({ kind: "gte", col, val }); return this; }
  lt(col: string, val: unknown) { this.ops.push({ kind: "lt", col, val }); return this; }
  lte(col: string, val: unknown) { this.ops.push({ kind: "lte", col, val }); return this; }
  in(col: string, val: unknown[]) { this.ops.push({ kind: "in", col, val }); return this; }
  is(col: string, val: unknown) { this.ops.push({ kind: "is", col, val }); return this; }
  not(col: string, _op: string, val: unknown) { this.ops.push({ kind: "not_eq", col, val }); return this; }
  or(_expr: string) { return this; } // best-effort no-op filter for demo
  match(m: Row) { this.ops.push({ kind: "match", val: m }); return this; }
  filter(col: string, _op: string, val: unknown) { this.ops.push({ kind: "eq", col, val }); return this; }

  order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending !== false }; return this; }
  limit(n: number) { this.limitN = n; return this; }
  range(_from: number, _to: number) { return this; }

  private apply(rows: Row[]): Row[] {
    let out = rows.filter((r) => this.ops.every((o) => matchesOp(r, o)));
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out = [...out].sort((a, b) => {
        const av = a[col], bv = b[col];
        if (av == null && bv == null) return 0;
        if (av == null) return asc ? -1 : 1;
        if (bv == null) return asc ? 1 : -1;
        if (av < bv) return asc ? -1 : 1;
        if (av > bv) return asc ? 1 : -1;
        return 0;
      });
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }

  private commit(): { data: Row[] | Row | null; error: null | { message: string } } {
    const db = readDb();
    const rows = db[this.table] ?? [];
    if (this.mode === "select") {
      return { data: this.apply(rows), error: null };
    }
    if (this.mode === "insert" || this.mode === "upsert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const inserted: Row[] = list.map((r) => ({
        id: (r?.id as string | undefined) ?? uid(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...r,
      }));
      db[this.table] = [...rows, ...inserted];
      writeDb(db);
      return { data: inserted, error: null };
    }
    if (this.mode === "update") {
      const patch = this.payload as Row;
      const next = rows.map((r) => (this.ops.every((o) => matchesOp(r, o)) ? { ...r, ...patch, updated_at: new Date().toISOString() } : r));
      db[this.table] = next;
      writeDb(db);
      return { data: next.filter((r) => this.ops.every((o) => matchesOp(r, o))), error: null };
    }
    if (this.mode === "delete") {
      const keep = rows.filter((r) => !this.ops.every((o) => matchesOp(r, o)));
      db[this.table] = keep;
      writeDb(db);
      return { data: [], error: null };
    }
    return { data: null, error: null };
  }

  single() {
    const res = this.commit();
    const arr = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    return Promise.resolve({ data: arr[0] ?? null, error: arr.length === 0 ? { message: "no rows" } : null });
  }
  maybeSingle() {
    const res = this.commit();
    const arr = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    return Promise.resolve({ data: arr[0] ?? null, error: null });
  }
  // thenable — awaits resolve to select/mutation result
  then<T>(resolve: (v: { data: unknown; error: null | { message: string }; count?: number }) => T, reject?: (e: unknown) => T) {
    try {
      const r = this.commit();
      const count = Array.isArray(r.data) ? (r.data as unknown[]).length : r.data ? 1 : 0;
      return Promise.resolve(resolve({ ...r, count }));
    } catch (e) {
      return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
    }
  }
}

type AuthCb = (event: string, session: typeof DEMO_SESSION | null) => void;
const authListeners: AuthCb[] = [];

const demoAuth = {
  async getSession() { return { data: { session: DEMO_SESSION }, error: null }; },
  async getUser() { return { data: { user: DEMO_USER }, error: null }; },
  onAuthStateChange(cb: AuthCb) {
    authListeners.push(cb);
    setTimeout(() => cb("INITIAL_SESSION", DEMO_SESSION), 0);
    return { data: { subscription: { unsubscribe() { const i = authListeners.indexOf(cb); if (i >= 0) authListeners.splice(i, 1); } } } };
  },
  async signOut() {
    const { exitDemoMode } = await import("./mode");
    exitDemoMode();
    return { error: null };
  },
  async signInWithPassword() { return { data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }; },
};

const demoStorage = {
  from(_bucket: string) {
    return {
      async upload(_path: string, _file: unknown) {
        return { data: null, error: { message: "Photos are not stored in Demo Mode." } };
      },
      async createSignedUrl(_path: string, _expires: number) {
        return { data: null, error: { message: "demo" } };
      },
      async remove(_paths: string[]) { return { data: null, error: null }; },
    };
  },
};

export const demoClient = {
  from(table: string) { return new QB(table); },
  auth: demoAuth,
  storage: demoStorage,
  rpc(_name: string, _args?: Row) { return Promise.resolve({ data: null, error: null }); },
  channel() { return { on() { return this; }, subscribe() { return this; }, unsubscribe() {} }; },
  removeChannel() {},
};

export function getDemoClient() { return demoClient; }
