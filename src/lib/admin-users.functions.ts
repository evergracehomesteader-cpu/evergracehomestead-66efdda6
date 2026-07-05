import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { AppRole } from "@/lib/permissions";

const ROLE_VALUES = [
  "admin","manager","helper","viewer","bookkeeper","animal_care","volunteer","pending",
] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/lib/supabase.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);

    const ids = data.users.map((u) => u.id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, notes, active")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const rolesMap = new Map<string, string[]>();
    for (const r of (roleRows ?? []) as any[]) {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    }

    return data.users.map((u) => {
      const p: any = profileMap.get(u.id) ?? {};
      return {
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        display_name: p.display_name ?? null,
        notes: p.notes ?? null,
        active: p.active ?? true,
        roles: (rolesMap.get(u.id) ?? []) as AppRole[],
      } satisfies AdminUserRow;
    });
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    email: z.string().email(),
    password: z.string().min(8).max(72),
    display_name: z.string().min(1).max(80).optional(),
    role: z.enum(ROLE_VALUES).default("viewer"),
    notes: z.string().max(2000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/lib/supabase.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.display_name ? { display_name: data.display_name } : undefined,
    });
    if (error) throw new Error(error.message);
    const id = created.user!.id;
    if (data.notes) {
      await supabaseAdmin.from("profiles").update({ notes: data.notes }).eq("id", id);
    }
    // Replace any default 'viewer' inserted by trigger with chosen role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
    await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.role });
    return { id };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    display_name: z.string().max(80).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    active: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/lib/supabase.server");
    const patch: any = {};
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.active !== undefined) patch.active = data.active;
    if (Object.keys(patch).length === 0) return { ok: true };
    // upsert in case profile row is missing
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: data.user_id, ...patch }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    if (data.active === false) {
      // Ban the user to prevent login while inactive
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "876000h" });
    } else if (data.active === true) {
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "none" });
    }
    return { ok: true };
  });

export const adminSetUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    roles: z.array(z.enum(ROLE_VALUES)).min(0).max(8),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    // Prevent removing admin from yourself
    if (data.user_id === context.userId && !data.roles.includes("admin")) {
      throw new Error("You cannot remove your own admin role.");
    }
    const { supabaseAdmin } = await import("@/lib/supabase.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    if (data.roles.length > 0) {
      const rows = data.roles.map((role) => ({ user_id: data.user_id, role }));
      const { error } = await supabaseAdmin.from("user_roles").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    password: z.string().min(8).max(72),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/lib/supabase.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("You cannot delete your own account.");
    }
    const { supabaseAdmin } = await import("@/lib/supabase.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    role: z.enum(ROLE_VALUES),
    permissions: z.array(z.string().min(1).max(80)),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.role === "admin") {
      throw new Error("Admin role permissions cannot be modified.");
    }
    const { supabaseAdmin } = await import("@/lib/supabase.server");
    await supabaseAdmin.from("role_permissions").delete().eq("role", data.role);
    if (data.permissions.length > 0) {
      const rows = data.permissions.map((permission) => ({ role: data.role, permission }));
      const { error } = await supabaseAdmin.from("role_permissions").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export type AdminUserRow = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  notes: string | null;
  active: boolean;
  roles: AppRole[];
};
