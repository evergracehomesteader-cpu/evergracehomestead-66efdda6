import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo@preview.local";
// Server-only constant. Never sent to the client; lives only in the
// Worker bundle. Used solely to mint a session for the read-only demo
// account on Lovable preview hosts.
const DEMO_PASSWORD = "Pv!demo-9f4a2c8e1b6d-readonly";

function isPreviewHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  if (!h.endsWith(".lovable.app")) return false;
  // Lovable preview/dev subdomains, e.g.
  //   id-preview--<uuid>.lovable.app
  //   project--<uuid>-dev.lovable.app
  return h.includes("preview") || h.endsWith("-dev.lovable.app");
}

export const previewSignIn = createServerFn({ method: "POST" }).handler(async () => {
  const req = getRequest();
  const origin = req?.headers.get("origin") ?? "";
  const referer = req?.headers.get("referer") ?? "";
  const host =
    (origin && new URL(origin).hostname) ||
    (referer && new URL(referer).hostname) ||
    req?.headers.get("host") ||
    "";

  if (!isPreviewHost(host)) {
    throw new Response("Preview sign-in is only available on preview hosts", { status: 403 });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Ensure the demo user exists. Idempotent.
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);

  if (!found) {
    const { error: createErr } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "Preview User" },
    });
    if (createErr && !/already (registered|exists)/i.test(createErr.message)) {
      throw new Response(`Failed to provision demo user: ${createErr.message}`, { status: 500 });
    }
  } else {
    // Make sure the password matches what we'll sign in with (in case it drifted).
    await admin.auth.admin.updateUserById(found.id, { password: DEMO_PASSWORD });
  }

  // Mint a session using the publishable key + password grant.
  const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (error || !data.session) {
    throw new Response(`Demo sign-in failed: ${error?.message ?? "no session"}`, { status: 500 });
  }

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
});
