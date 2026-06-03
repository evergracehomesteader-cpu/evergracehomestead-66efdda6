import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const qc = useQueryClient();

  // Refetch permissions whenever auth state changes (sign in/out/refresh).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const query = useQuery<PermissionsData>({
    queryKey: ["my-permissions", userId],
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data: roleRows, error: rErr } = await supabase
        .from("user_roles" as never)
        .select("role")
        .eq("user_id", userId!);
      if (rErr) {
        console.error("[usePermissions] user_roles query failed", rErr);
        throw rErr;
      }
      const roles = ((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role);

      if (roles.length === 0) {
        return { roles: [], permissions: new Set(), hasWildcard: false };
      }

      const { data: permRows, error: pErr } = await supabase
        .from("role_permissions" as never)
        .select("permission, role")
        .in("role", roles);
      if (pErr) {
        console.error("[usePermissions] role_permissions query failed", pErr);
        throw pErr;
      }

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
