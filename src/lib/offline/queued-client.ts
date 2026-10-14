// Wraps the real Supabase client so `.from(table)` returns the offline-first
// shim for synced tables. Everything else — auth, storage, functions, rpc,
// channel, and `.from()` for non-synced tables — passes through untouched.
import { isSyncedTable, type SyncedTable } from "./db";
import { OfflineQueryBuilder } from "./query-shim";

// Minimal structural view of the Supabase client: only `.from()` is ever
// intercepted here; the rest passes through the Proxy untouched.
/* eslint-disable @typescript-eslint/no-explicit-any */
type RealClient = { from: (table: string) => any };

/**
 * Wrap a query builder so unknown PostgREST methods (or/is/not/like/...) are
 * recorded as unsupported and replayed on the real client, instead of
 * throwing. Known methods keep their class implementation.
 */
function proxiedBuilder(
  table: SyncedTable,
  real: RealClient,
): unknown {
  const inner = new OfflineQueryBuilder(table, real);
  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (typeof prop === "symbol" || prop in target) {
        const v = (target as unknown as Record<string | symbol, unknown>)[prop];
        return typeof v === "function"
          ? (v as (...a: unknown[]) => unknown).bind(target)
          : v;
      }
      return (...args: unknown[]) => {
        inner.recordUnsupported(String(prop), ...args);
        return receiver;
      };
    },
  });
}

export function createQueuedClient<T extends RealClient>(real: T): T {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) =>
          isSyncedTable(table)
            ? proxiedBuilder(table, target as RealClient)
            : (target.from as (t: string) => unknown)(table);
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  }) as T;
}
