import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useHomestead } from "@/lib/homestead-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Send, Copy, Crown } from "lucide-react";
import { isDemoMode } from "@/lib/demo/mode";

export const Route = createFileRoute("/_authenticated/homestead")({ component: HomesteadPage });

const ROLES = ["admin", "manager", "animal_care", "bookkeeper", "helper", "viewer"] as const;

function HomesteadPage() {
  const { user } = useAuth();
  const { currentId, currentName, isOwner, memberships, refresh } = useHomestead();
  const qc = useQueryClient();
  const demo = isDemoMode();

  const [name, setName] = useState(currentName);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("helper");

  const membersQ = useQuery({
    queryKey: ["homestead-members", currentId],
    enabled: !!currentId && !demo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homestead_members")
        .select("user_id, role, created_at, profiles:user_id(display_name)")
        .eq("homestead_id", currentId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invitesQ = useQuery({
    queryKey: ["homestead-invites", currentId],
    enabled: !!currentId && !demo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homestead_invitations")
        .select("*")
        .eq("homestead_id", currentId!)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (demo) {
    return <div className="text-muted-foreground">Homestead management is disabled in Demo Mode.</div>;
  }

  const current = memberships.find((m) => m.homestead_id === currentId);
  if (!current) return <div className="text-muted-foreground">Select a homestead first.</div>;

  const rename = async () => {
    if (!name.trim() || !currentId) return;
    const { error } = await supabase.from("homesteads").update({ name: name.trim() }).eq("id", currentId);
    if (error) return toast.error(error.message);
    toast.success("Renamed");
    refresh();
  };

  const invite = async () => {
    if (!inviteEmail.trim() || !currentId || !user) return;
    const { data, error } = await supabase
      .from("homestead_invitations")
      .insert({
        homestead_id: currentId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole as (typeof ROLES)[number],
        invited_by: user.id,
      })
      .select("token")
      .single();
    if (error) return toast.error(error.message);
    const url = `${window.location.origin}/accept-invite/${data.token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Invite created — link copied");
    setInviteEmail("");
    qc.invalidateQueries({ queryKey: ["homestead-invites"] });
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("homestead_invitations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["homestead-invites"] });
  };

  const removeMember = async (uid: string) => {
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("homestead_members").delete()
      .eq("homestead_id", currentId!).eq("user_id", uid);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["homestead-members"] });
  };

  const changeRole = async (uid: string, role: string) => {
    const { error } = await supabase.from("homestead_members")
      .update({ role: role as (typeof ROLES)[number] })
      .eq("homestead_id", currentId!).eq("user_id", uid);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["homestead-members"] });
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/accept-invite/${token}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Link copied");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-semibold">Homestead</h1>
        <p className="text-muted-foreground text-sm">Manage this homestead's name, members, and invitations.</p>
      </div>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Details</h2>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} />
          <Button onClick={rename} disabled={!isOwner || name === currentName}>Save</Button>
        </div>
        {!isOwner && <p className="text-xs text-muted-foreground">Only the owner can rename this homestead.</p>}
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Members</h2>
        <ul className="divide-y">
          {(membersQ.data ?? []).map((m) => {
            const isOwnerRow = current.homesteads?.owner_id === m.user_id;
            const p = m.profiles as { display_name?: string } | null;
            return (
              <li key={m.user_id} className="py-2 flex items-center gap-2">
                <span className="flex-1 truncate">
                  {p?.display_name ?? m.user_id.slice(0, 8)}
                  {isOwnerRow && <Crown className="h-3.5 w-3.5 inline ml-1 text-warning" />}
                </span>
                {isOwnerRow ? (
                  <Badge variant="outline">owner</Badge>
                ) : isOwner ? (
                  <>
                    <Select value={m.role} onValueChange={(v) => changeRole(m.user_id, v)}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => removeMember(m.user_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <Badge variant="outline" className="capitalize">{m.role.replace(/_/g, " ")}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {isOwner && (
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Invite people</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 space-y-1">
              <Label>Email</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="friend@example.com" />
            </div>
            <div className="w-full sm:w-44 space-y-1">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:pt-6">
              <Button onClick={invite} disabled={!inviteEmail.trim()}><Send className="h-4 w-4" /> Invite</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            An invite link is created and copied to your clipboard. Share it with the person you're inviting — they'll be added when they open the link while signed in.
          </p>

          {(invitesQ.data ?? []).length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Pending invitations</h3>
              <ul className="divide-y text-sm">
                {(invitesQ.data ?? []).map((i) => (
                  <li key={i.id} className="py-2 flex items-center gap-2">
                    <span className="flex-1 truncate">{i.email}</span>
                    <Badge variant="outline" className="capitalize">{i.role.replace(/_/g, " ")}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => copyLink(i.token)}><Copy className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => revoke(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <div className="text-xs text-muted-foreground">
        <Link to="/settings" className="hover:underline">← Back to settings</Link>
      </div>
    </div>
  );
}
