import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useHomestead } from "@/lib/homestead-context";
import type { AppRole } from "@/lib/permissions";
import { isDemoMode } from "@/lib/demo/mode";

interface PermissionsData {
  roles: AppRole[];
  permissions: Set<string>;
  hasWildcard: boolean;
}

export function usePermissions() {
  const { user } = useAuth();
  const { currentId, role: homesteadRole, isOwner } = useHomestead();
  const userId = user?.id;
  const qc = useQueryClient();
  const demo = isDemoMode();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const query = useQuery<PermissionsData>({
    queryKey: ["my-permissions", userId, currentId, homesteadRole, demo],
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnMount: "always",
    queryFn: async () => {
      // In demo mode, act as admin.
      if (demo) {
        return { roles: ["admin" as AppRole], permissions: new Set(["*"]), hasWildcard: true };
      }
      // Owner is always effectively admin; otherwise use the homestead role.
      const roles: AppRole[] = [];
      if (isOwner) roles.push("admin" as AppRole);
      if (homesteadRole) roles.push(homesteadRole as AppRole);
      if (roles.length === 0) {
        return { roles: [], permissions: new Set(), hasWildcard: false };
      }
      const { data: permRows, error } = await supabase
        .from("role_permissions" as never)
        .select("permission, role")
        .in("role", roles);
      if (error) {
        console.error("[usePermissions] role_permissions query failed", error);
        throw error;
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
