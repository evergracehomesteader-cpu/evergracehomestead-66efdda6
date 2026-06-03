import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { AppRole } from "@/lib/permissions";

interface PermissionsData {
  roles: AppRole[];
  permissions: Set<string>;
  hasWildcard: boolean;
}

export function usePermissions() {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery<PermissionsData>({
    queryKey: ["my-permissions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: roleRows, error: rErr } = await supabase
        .from("user_roles" as never)
        .select("role")
        .eq("user_id", userId!);
      if (rErr) throw rErr;
      const roles = ((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role);

      if (roles.length === 0) {
        return { roles: [], permissions: new Set(), hasWildcard: false };
      }

      const { data: permRows, error: pErr } = await supabase
        .from("role_permissions" as never)
        .select("permission, role")
        .in("role", roles);
      if (pErr) throw pErr;

      const perms = new Set<string>();
      let wildcard = false;
      for (const row of (permRows ?? []) as { permission: string }[]) {
        if (row.permission === "*") wildcard = true;
        perms.add(row.permission);
      }
      return { roles, permissions: perms, hasWildcard: wildcard };
    },
  });

  const data = query.data;
  const hasWildcard = data?.hasWildcard ?? false;
  const can = (perm: string) => hasWildcard || (data?.permissions.has(perm) ?? false);
  const hasRole = (role: AppRole) => data?.roles.includes(role) ?? false;
  const isAdmin = hasRole("admin");

  return {
    loading: query.isLoading,
    roles: data?.roles ?? [],
    permissions: data?.permissions ?? new Set<string>(),
    can,
    hasRole,
    isAdmin,
  };
}
