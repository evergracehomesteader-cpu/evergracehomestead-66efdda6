import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Allow-listed tables for backup/restore. We deliberately EXCLUDE auth-critical
// tables (user_roles, role_permissions, profiles) to prevent admin self-lockout
// on restore. They can still be backed up via direct DB dumps if needed.
export const BACKUP_TABLES = [
  "animals", "animal_events", "weight_logs", "health_records",
  "litters", "pregnancies", "heat_events", "breeding_decisions",
  "feed_items", "feed_logs", "feed_purchases",
  "garden_plots", "compost_entries",
  "production_logs",
  "bills", "income_entries",
  "barter_deals", "barter_items", "barter_contacts",
  "contacts",
  "tasks",
  "chores", "chore_assignments", "chore_completions",
  "species_catalog", "breeds_catalog",
] as const;

export type BackupTable = typeof BACKUP_TABLES[number];

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const createBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    label: z.string().min(1).max(120),
    notes: z.string().max(2000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from: (table: string) => {
        select: (cols: string, opts?: { count?: string; head?: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null; count?: number | null }>;
        insert: (rows: unknown) => Promise<{ error: { message: string } | null }> & { select: (cols: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } };
        delete: () => { eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }> };
      };
    };

    const dump: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    for (const t of BACKUP_TABLES) {
      const { data: rows, error } = await admin.from(t).select("*");
      if (error) throw new Error(`Failed to read ${t}: ${error.message}`);
      dump[t] = (rows ?? []) as unknown[];
      counts[t] = (rows ?? []).length;
    }

    const payload = {
      version: 1,
      created_at: new Date().toISOString(),
      created_by: context.userId,
      label: data.label,
      counts,
      tables: dump,
    };
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    const id = crypto.randomUUID();
    const storagePath = `backup-${id}.json`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("backups")
      .upload(storagePath, bytes, { contentType: "application/json", upsert: false });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { error: insErr } = await supabaseAdmin.from("backups").insert({
      id, label: data.label, notes: data.notes ?? null,
      size_bytes: bytes.byteLength, table_counts: counts,
      storage_path: storagePath, created_by: context.userId,
    });
    if (insErr) {
      await supabaseAdmin.storage.from("backups").remove([storagePath]);
      throw new Error(insErr.message);
    }
    return { id, size: bytes.byteLength, counts };
  });

export const getBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("backups").select("storage_path, label").eq("id", data.id).single();
    if (error || !row) throw new Error("Backup not found");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("backups").createSignedUrl(row.storage_path, 300);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Failed to sign URL");
    return { url: signed.signedUrl, label: row.label };
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("backups").select("storage_path").eq("id", data.id).single();
    if (row?.storage_path) {
      await supabaseAdmin.storage.from("backups").remove([row.storage_path]);
    }
    const { error } = await supabaseAdmin.from("backups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBackupManifest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("backups").select("*").eq("id", data.id).single();
    if (error || !row) throw new Error("Backup not found");

    // Also compute current row counts so the UI can show diffs
    const current: Record<string, number> = {};
    for (const t of BACKUP_TABLES) {
      const { count } = await supabaseAdmin.from(t).select("*", { count: "exact", head: true });
      current[t] = count ?? 0;
    }
    return {
      id: row.id,
      label: row.label,
      created_at: row.created_at,
      size_bytes: row.size_bytes,
      backup_counts: row.table_counts as Record<string, number>,
      current_counts: current,
      tables: BACKUP_TABLES as readonly string[],
    };
  });

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    tables: z.array(z.string()).min(1),
    confirm: z.literal("RESTORE"),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const allowed = new Set<string>(BACKUP_TABLES as readonly string[]);
    const requested = data.tables.filter((t) => allowed.has(t));
    if (requested.length === 0) throw new Error("No valid tables selected");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("backups").select("storage_path").eq("id", data.id).single();
    if (error || !row) throw new Error("Backup not found");

    const { data: file, error: dErr } = await supabaseAdmin.storage
      .from("backups").download(row.storage_path);
    if (dErr || !file) throw new Error(dErr?.message ?? "Download failed");

    const text = await file.text();
    let payload: { tables: Record<string, unknown[]> };
    try { payload = JSON.parse(text); } catch { throw new Error("Backup file is corrupted"); }

    const results: Record<string, { restored: number; error?: string }> = {};
    const admin = supabaseAdmin as unknown as {
      from: (table: string) => {
        delete: () => { not: (col: string, op: string, val: unknown) => Promise<{ error: { message: string } | null }> };
        insert: (rows: unknown[]) => Promise<{ error: { message: string } | null }>;
      };
    };
    for (const t of requested) {
      const rows = payload.tables[t];
      if (!Array.isArray(rows)) {
        results[t] = { restored: 0, error: "missing in backup" };
        continue;
      }
      // Delete all then bulk insert. Foreign keys with ON DELETE CASCADE will fire.
      const { error: delErr } = await admin.from(t).delete().not("id", "is", null);
      if (delErr) { results[t] = { restored: 0, error: delErr.message }; continue; }
      if (rows.length > 0) {
        // Chunk to avoid request limits
        const chunkSize = 500;
        let restored = 0;
        let err: string | undefined;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error: insErr } = await admin.from(t).insert(chunk);
          if (insErr) { err = insErr.message; break; }
          restored += chunk.length;
        }
        results[t] = { restored, error: err };
      } else {
        results[t] = { restored: 0 };
      }
    }
    return { results };
  });
