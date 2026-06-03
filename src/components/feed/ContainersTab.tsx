import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Box } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { usePermissions } from "@/hooks/usePermissions";

type Container = { id: string; name: string; capacity_lbs: number | null; location: string | null; notes: string | null; active: boolean };
type Stock = { container_id: string; feed_item_id: string; stock_lbs: number };
type FeedItem = { id: string; name: string };

export function ContainersTab() {
  const qc = useQueryClient();
  const { hasRole } = usePermissions();
  const canManage = hasRole("admin") || hasRole("manager");
  const [editing, setEditing] = useState<Container | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const { data: containers = [] } = useQuery({
    queryKey: ["feed-containers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_containers" as never).select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Container[];
    },
  });
  const { data: stock = [] } = useQuery({
    queryKey: ["feed-container-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_container_stock" as never).select("container_id,feed_item_id,stock_lbs");
      return (data ?? []) as unknown as Stock[];
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ["feed-items-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("feed_items").select("id,name");
      return (data ?? []) as FeedItem[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<Container> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (p.id) {
        const { error } = await supabase.from("feed_containers" as never).update(p as never).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("feed_containers" as never).insert({ ...p, created_by: u.user?.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feed-containers"] }); toast.success("Saved"); setEditing(null); setOpenNew(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("feed_containers" as never).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feed-containers"] }); toast.success("Deleted"); },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Physical storage locations (barrels, bins, bags).</p>
        {canManage && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add container</Button></DialogTrigger>
            <ContainerForm onSubmit={(p) => save.mutate(p)} submitting={save.isPending} />
          </Dialog>
        )}
      </div>
      {containers.length === 0 ? (
        <Card className="p-12 text-center">
          <Box className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No containers yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {containers.map((c) => {
            const contents = stock.filter((s) => s.container_id === c.id && s.stock_lbs > 0);
            const total = contents.reduce((a, s) => a + Number(s.stock_lbs), 0);
            const pct = c.capacity_lbs ? Math.min(100, (total / Number(c.capacity_lbs)) * 100) : null;
            return (
              <Card key={c.id} className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    {c.location && <div className="text-xs text-muted-foreground">{c.location}</div>}
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-3 w-3" /></Button>
                      <ConfirmDelete trigger={<Button size="sm" variant="ghost"><Trash2 className="h-3 w-3" /></Button>}
                        title={`Delete ${c.name}?`} onConfirm={() => del.mutate(c.id)} />
                    </div>
                  )}
                </div>
                <div className="text-2xl font-display font-semibold">{total.toFixed(1)} <span className="text-xs text-muted-foreground">lb</span></div>
                {pct != null && (
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
                {c.capacity_lbs && <div className="text-xs text-muted-foreground">capacity {Number(c.capacity_lbs).toFixed(0)} lb</div>}
                {contents.length > 0 && (
                  <ul className="text-xs space-y-0.5 mt-1">
                    {contents.map((s) => {
                      const name = items.find((i) => i.id === s.feed_item_id)?.name ?? "(unknown)";
                      return <li key={s.feed_item_id} className="flex justify-between"><span className="truncate">{name}</span><span>{Number(s.stock_lbs).toFixed(1)} lb</span></li>;
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <ContainerForm initial={editing} onSubmit={(p) => save.mutate({ ...p, id: editing.id })} submitting={save.isPending} />
        </Dialog>
      )}
    </div>
  );
}

function ContainerForm({ initial, onSubmit, submitting }: { initial?: Container; onSubmit: (p: Partial<Container>) => void; submitting: boolean }) {
  const [f, setF] = useState<Partial<Container>>(initial ?? { name: "", capacity_lbs: null, location: "", notes: "", active: true });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit container" : "Add container"}</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!f.name) { toast.error("Name required"); return; } onSubmit(f); }}>
        <div><Label>Name *</Label><Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Blue Barrel" maxLength={100} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Capacity (lb)</Label><Input type="number" step="0.1" value={f.capacity_lbs ?? ""} onChange={(e) => setF({ ...f, capacity_lbs: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><Label>Location</Label><Input value={f.location ?? ""} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Barn" maxLength={100} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={500} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
