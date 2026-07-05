import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ALL_ROLES, ROLE_LABEL, PERMISSION_GROUPS, type AppRole } from "@/lib/permissions";
import { usePermissions } from "@/hooks/usePermissions";
import { adminSetRolePermissions } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/roles")({ component: RolesPage });

function RolesPage() {
  const { isAdmin, loading } = usePermissions();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setPerms = useServerFn(adminSetRolePermissions);
  const [selectedRole, setSelectedRole] = useState<AppRole>("manager");

  const permsQ = useQuery({
    queryKey: ["all-role-permissions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions" as never)
        .select("role, permission");
      if (error) throw error;
      return (data ?? []) as { role: AppRole; permission: string }[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<AppRole, Set<string>>();
    for (const r of ALL_ROLES) map.set(r, new Set());
    for (const row of permsQ.data ?? []) map.get(row.role)?.add(row.permission);
    return map;
  }, [permsQ.data]);

  const [draft, setDraft] = useState<Set<string>>(new Set());
  useEffect(() => {
    setDraft(new Set(grouped.get(selectedRole) ?? []));
  }, [selectedRole, grouped]);

  const saveM = useMutation({
    mutationFn: () => setPerms({ data: { role: selectedRole, permissions: Array.from(draft) } }),
    onSuccess: () => { toast.success("Permissions saved"); qc.invalidateQueries({ queryKey: ["all-role-permissions"] }); qc.invalidateQueries({ queryKey: ["my-permissions"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Admins only</h1>
          <p className="text-muted-foreground">You don't have permission to manage roles.</p>
          <Button className="mt-3" variant="outline" onClick={() => navigate({ to: "/settings" })}>Back</Button>
        </Card>
      </div>
    );
  }

  const isAdminRole = selectedRole === "admin";
  const toggle = (key: string, on: boolean | string) => {
    const next = new Set(draft);
    if (on) next.add(key); else next.delete(key);
    setDraft(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold">Roles & permissions</h1>
        <p className="text-muted-foreground">Pick a role and toggle what it can do. Admin has full access and can't be changed.</p>
      </div>

      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ALL_ROLES.map((r) => {
            const count = grouped.get(r)?.size ?? 0;
            const active = r === selectedRole;
            return (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                className={`shrink-0 rounded-md border px-3 py-2 text-sm transition ${active ? "border-primary bg-primary/10 text-foreground" : "border-border hover:bg-muted"}`}
              >
                <div className="font-medium">{ROLE_LABEL[r]}</div>
                <div className="text-xs text-muted-foreground">{r === "admin" ? "Full access" : `${count} perms`}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {isAdminRole ? (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Badge>Admin</Badge>
            <span className="text-muted-foreground">Full access to everything. Not editable.</span>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {PERMISSION_GROUPS.map((g) => (
              <Card key={g.group} className="p-4">
                <div className="font-semibold mb-2">{g.group}</div>
                <div className="space-y-1.5">
                  {g.permissions.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={draft.has(p.key)}
                        onCheckedChange={(c) => toggle(p.key, c)}
                      />
                      <span className="text-sm">{p.label}</span>
                    </label>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <div className="sticky bottom-0 -mx-4 sm:mx-0 p-3 bg-background/95 backdrop-blur border-t flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">{draft.size} permission(s) selected for {ROLE_LABEL[selectedRole]}</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDraft(new Set(grouped.get(selectedRole) ?? []))}>Reset</Button>
              <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>{saveM.isPending ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
