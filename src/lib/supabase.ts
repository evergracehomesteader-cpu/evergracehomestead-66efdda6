// Unified Supabase entry point. Routes to the real client normally, or to a
// localStorage-backed demo client when Demo Mode is on. All app code imports
// `supabase` from here instead of `@/integrations/supabase/client` so that
// demo mode is enforced by construction — no stray call can leak to prod.
import { supabase as realSupabase } from "@/integrations/supabase/client";
import { getDemoClient } from "@/lib/demo/client";
import { isDemoMode } from "@/lib/demo/mode";

function pick(): typeof realSupabase {
  return (isDemoMode() ? (getDemoClient() as unknown as typeof realSupabase) : realSupabase);
}

export const supabase = new Proxy({} as typeof realSupabase, {
  get(_t, prop) {
    const c = pick() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});
