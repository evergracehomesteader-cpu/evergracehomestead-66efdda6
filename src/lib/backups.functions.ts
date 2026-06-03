import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Tables eligible for backup/restore. Excludes auth/storage/role tables for
// safety — those should never be wiped by a restore.
export const BACKUP_TABLES = [
  "animals", "animal_events", "litters", "pregnancies", "heat_events",
  "breeding_decisions", "health_records", "weight_logs",
  "feed_items", "feed_logs", "feed_purchases",
  "garden_plots", "compost_entries",
  "production_logs", "income_entries", "bills",
  "barter_contacts", "barter_deals", "barter_items",
  "contacts", "tasks",
  "chores", "chore_assignments", "chore_completions",
  "breeds_catalog", "species_catalog",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("backups")
      .select("id, label, created_at, size_bytes, table_counts, notes, storage_path")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      label: z.string().min(1).max(120),
      notes: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const dump: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    const adminAny = supabaseAdmin as unknown as {
      from: (t: string) => { select: (s: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
    };
    for (const t of BACKUP_TABLES) {
      const { data: rows, error } = await adminAny.from(t).select("*");
      if (error) throw new Error(`${t}: ${error.message}`);
      dump[t] = rows ?? [];
      counts[t] = (rows ?? []).length;
    }

    const payload = JSON.stringify({ version: 1, created_at: new Date().toISOString(), tables: dump });
    const bytes = new TextEncoder().encode(payload);
    const path = `${context.userId}/${Date.now()}-${data.label.replace(/[^a-z0-9-_]/gi, "_")}.json`;

    const { error: upErr } = await supabaseAdmin.storage.from("backups").upload(path, bytes, {
      contentType: "application/json",
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);

    const { data: row, error: insErr } = await supabaseAdmin.from("backups").insert({
      label: data.label,
      notes: data.notes ?? null,
      storage_path: path,
      size_bytes: bytes.byteLength,
      table_counts: counts,
      created_by: context.userId,
    }).select("id").single();
    if (insErr) throw new Error(insErr.message);

    return { id: row.id, size_bytes: bytes.byteLength, table_counts: counts };
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("backups")
      .select("storage_path").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.storage.from("backups").remove([row.storage_path]);
    await supabaseAdmin.from("backups").delete().eq("id", data.id);
    return { ok: true };
  });

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      tables: z.array(z.string()).min(1).max(BACKUP_TABLES.length),
      mode: z.enum(["replace", "merge"]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const allowed = new Set<string>(BACKUP_TABLES as readonly string[]);
    const tables = data.tables.filter((t) => allowed.has(t));
    if (tables.length === 0) throw new Error("No restorable tables selected");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("backups")
      .select("storage_path").eq("id", data.id).single();
    if (error) throw new Error(error.message);

    const { data: file, error: dlErr } = await supabaseAdmin.storage.from("backups").download(row.storage_path);
    if (dlErr) throw new Error(dlErr.message);
    const text = await file.text();
    const parsed = JSON.parse(text) as { tables: Record<string, unknown[]> };

    const results: Record<string, { restored: number }> = {};
    const admin = supabaseAdmin as unknown as {
      from: (t: string) => {
        delete: () => { not: (c: string, op: string, v: unknown) => Promise<{ error: { message: string } | null }> };
        insert: (rows: unknown[]) => Promise<{ error: { message: string } | null }>;
        upsert: (rows: unknown[], opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
      };
    };
    for (const t of tables) {
      const rows = (parsed.tables?.[t] ?? []) as Record<string, unknown>[];
      if (data.mode === "replace") {
        const { error: delErr } = await admin.from(t).delete().not("id", "is", null);
        if (delErr) throw new Error(`${t} delete: ${delErr.message}`);
      }
      if (rows.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error: insErr } = data.mode === "merge"
            ? await admin.from(t).upsert(chunk, { onConflict: "id" })
            : await admin.from(t).insert(chunk);
          if (insErr) throw new Error(`${t} insert: ${insErr.message}`);
        }
      }
      results[t] = { restored: rows.length };
    }
    return { ok: true, results };
  });
