import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ALL_ROLES, ROLE_LABEL, type AppRole } from "@/lib/permissions";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth-context";
import {
  adminListUsers, adminCreateUser, adminUpdateProfile,
  adminSetUserRoles, adminResetPassword, adminDeleteUser,
  type AdminUserRow,
} from "@/lib/admin-users.functions";
import { UserPlus, Shield, KeyRound, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/users")({ component: UsersPage });

function UsersPage() {
  const { isAdmin, loading: permLoading } = usePermissions();
  const navigate = useNavigate();
  const list = useServerFn(adminListUsers);
  const qc = useQueryClient();

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => list(),
    enabled: isAdmin,
  });

  if (permLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Admins only</h1>
          <p className="text-muted-foreground">You don't have permission to manage users.</p>
          <Button className="mt-3" variant="outline" onClick={() => navigate({ to: "/settings" })}>Back to Settings</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Users</h1>
          <p className="text-muted-foreground">Manage who can sign in and what they can do.</p>
        </div>
        <CreateUserDialog onCreated={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
      </div>

      {usersQ.isLoading && <div className="text-muted-foreground">Loading users…</div>}
      {usersQ.error && <Card className="p-4 text-destructive">Failed to load: {(usersQ.error as Error).message}</Card>}

      <div className="grid gap-3">
        {(usersQ.data ?? []).map((u) => (
          <UserCard key={u.id} user={u} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
        ))}
      </div>
    </div>
  );
}

function UserCard({ user, onChanged }: { user: AdminUserRow; onChanged: () => void }) {
  const { user: me } = useAuth();
  const isSelf = me?.id === user.id;
  const updateProfile = useServerFn(adminUpdateProfile);
  const setRoles = useServerFn(adminSetUserRoles);
  const resetPwd = useServerFn(adminResetPassword);
  const del = useServerFn(adminDeleteUser);

  const activeM = useMutation({
    mutationFn: (active: boolean) => updateProfile({ data: { user_id: user.id, active } }),
    onSuccess: () => { toast.success(user.active ? "User deactivated" : "User activated"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const rolesM = useMutation({
    mutationFn: (roles: AppRole[]) => setRoles({ data: { user_id: user.id, roles } }),
    onSuccess: () => { toast.success("Roles updated"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: () => del({ data: { user_id: user.id } }),
    onSuccess: () => { toast.success("User deleted"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold truncate">{user.display_name ?? user.email}</div>
            {!user.active && <Badge variant="destructive">Inactive</Badge>}
            {isSelf && <Badge variant="secondary">You</Badge>}
          </div>
          <div className="text-sm text-muted-foreground truncate">{user.email}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Created {new Date(user.created_at).toLocaleDateString()} ·{" "}
            Last login {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "never"}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {user.roles.length === 0 && <Badge variant="outline">No role</Badge>}
            {user.roles.map((r) => <Badge key={r}>{ROLE_LABEL[r]}</Badge>)}
          </div>
          {user.notes && <div className="text-xs text-muted-foreground mt-2 italic">{user.notes}</div>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Switch
              checked={user.active}
              onCheckedChange={(v) => activeM.mutate(v)}
              disabled={isSelf}
            />
            <span className="text-xs text-muted-foreground">{user.active ? "Active" : "Off"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
        <Button size="sm" variant="outline" onClick={() => setRolesOpen(true)}><Shield className="h-3.5 w-3.5" /> Roles</Button>
        <Button size="sm" variant="outline" onClick={() => setPwdOpen(true)}><KeyRound className="h-3.5 w-3.5" /> Reset password</Button>
        {!isSelf && (
          <ConfirmDelete
            onConfirm={() => deleteM.mutate()}
            trigger={<Button size="sm" variant="destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>}
          />
        )}
      </div>

      <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} user={user} onSaved={onChanged} />
      <RolesDialog open={rolesOpen} onOpenChange={setRolesOpen} user={user}
        onSave={(roles) => { rolesM.mutate(roles); setRolesOpen(false); }} />
      <ResetPasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} userId={user.id} />
    </Card>
  );
}

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const create = useServerFn(adminCreateUser);
  const [form, setForm] = useState({ email: "", password: "", display_name: "", role: "viewer" as AppRole, notes: "" });
  const m = useMutation({
    mutationFn: () => create({ data: {
      email: form.email,
      password: form.password,
      display_name: form.display_name || undefined,
      role: form.role,
      notes: form.notes || undefined,
    } }),
    onSuccess: () => { toast.success("User created"); setOpen(false); setForm({ email: "", password: "", display_name: "", role: "viewer", notes: "" }); onCreated(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><UserPlus className="h-4 w-4" /> Add user</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Password</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 chars" /></div>
          <div><Label>Name</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !form.email || form.password.length < 8}>
            {m.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProfileDialog({ open, onOpenChange, user, onSaved }: { open: boolean; onOpenChange: (b: boolean) => void; user: AdminUserRow; onSaved: () => void }) {
  const updateProfile = useServerFn(adminUpdateProfile);
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [notes, setNotes] = useState(user.notes ?? "");
  const m = useMutation({
    mutationFn: () => updateProfile({ data: { user_id: user.id, display_name: displayName, notes } }),
    onSuccess: () => { toast.success("Saved"); onOpenChange(false); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesDialog({ open, onOpenChange, user, onSave }: { open: boolean; onOpenChange: (b: boolean) => void; user: AdminUserRow; onSave: (roles: AppRole[]) => void }) {
  const [selected, setSelected] = useState<Set<AppRole>>(new Set(user.roles));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign roles — {user.display_name ?? user.email}</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-80 overflow-auto">
          {ALL_ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
              <Checkbox
                checked={selected.has(r)}
                onCheckedChange={(c) => {
                  const next = new Set(selected);
                  if (c) next.add(r); else next.delete(r);
                  setSelected(next);
                }}
              />
              <span>{ROLE_LABEL[r]}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(Array.from(selected))}>Save roles</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (b: boolean) => void; userId: string }) {
  const reset = useServerFn(adminResetPassword);
  const [pwd, setPwd] = useState("");
  const m = useMutation({
    mutationFn: () => reset({ data: { user_id: userId, password: pwd } }),
    onSuccess: () => { toast.success("Password reset"); onOpenChange(false); setPwd(""); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Reset password</DialogTitle></DialogHeader>
        <div><Label>New password</Label><Input value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Min 8 chars" /></div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || pwd.length < 8}>{m.isPending ? "Saving…" : "Set password"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
