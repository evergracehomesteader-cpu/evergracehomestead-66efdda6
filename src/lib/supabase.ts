// Unified Supabase entry point. Routes to the real client normally, or to a
// localStorage-backed demo client when Demo Mode is on. All app code imports
// `supabase` from here instead of `@/integrations/supabase/client` so that
// demo mode is enforced by construction — no stray call can leak to prod.
//
// When NOT in demo mode, the real client is wrapped with the offline-first
// queued client (src/lib/offline/queued-client.ts): `.from()` on synced
// tables returns a local-first shim (Dexie mirror + outbox), everything else
// passes through untouched. The sync engine starts once on first use,
// browser-only.
import { supabase as realSupabase } from "@/integrations/supabase/client";
import { getDemoClient } from "@/lib/demo/client";
import { isDemoMode } from "@/lib/demo/mode";
import { createQueuedClient } from "@/lib/offline/queued-client";
import { startSyncEngine } from "@/lib/offline/sync";

let queued: typeof realSupabase | null = null;
let engineStarted = false;

function pick(): typeof realSupabase {
  // Demo mode path stays exactly as-is: no shim, no sync engine.
  if (isDemoMode()) return getDemoClient() as unknown as typeof realSupabase;
  if (typeof window !== "undefined") {
    if (!queued) queued = createQueuedClient(realSupabase);
    if (!engineStarted) {
      engineStarted = true;
      // The engine talks to the raw client (not the shim) for push/pull.
      startSyncEngine(realSupabase);
    }
  }
  return queued ?? realSupabase;
}

export const supabase = new Proxy({} as typeof realSupabase, {
  get(_t, prop) {
    const c = pick() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});
