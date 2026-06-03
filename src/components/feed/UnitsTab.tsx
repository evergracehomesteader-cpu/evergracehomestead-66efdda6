import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Ruler } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";

type Unit = { id: string; name: string; lbs_per_unit: number; is_system: boolean };

export function UnitsTab() {
  const qc = useQueryClient();
  const { hasRole } = usePermissions();
  const canManage = hasRole("admin") || hasRole("manager");
  const [editing, setEditing] = useState<Unit | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const { data: units = [] } = useQuery({
    queryKey: ["feed-units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_units" as never).select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Unit[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<Unit> & { id?: string }) => {
      if (p.id) { const { error } = await supabase.from("feed_units" as never).update(p as never).eq("id", p.id); if (error) throw error; }
      else { const { error } = await supabase.from("feed_units" as never).insert(p as never); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feed-units"] }); toast.success("Saved"); setEditing(null); setOpenNew(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("feed_units" as never).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feed-units"] }); toast.success("Deleted"); },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Define how many pounds each unit equals.</p>
        {canManage && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add unit</Button></DialogTrigger>
            <UnitForm onSubmit={(p) => save.mutate(p)} submitting={save.isPending} />
          </Dialog>
        )}
      </div>
      {units.length === 0 ? (
        <Card className="p-12 text-center">
          <Ruler className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No units yet.</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {units.map((u) => (
              <li key={u.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium flex items-center gap-2">{u.name}{u.is_system && <Badge variant="outline" className="text-xs">default</Badge>}</div>
                  <div className="text-xs text-muted-foreground">1 {u.name} = {Number(u.lbs_per_unit).toFixed(2)} lb</div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(u)}><Pencil className="h-3 w-3" /></Button>
                    <ConfirmDelete trigger={<Button size="sm" variant="ghost"><Trash2 className="h-3 w-3" /></Button>}
                      title={`Delete ${u.name}?`} onConfirm={() => del.mutate(u.id)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <UnitForm initial={editing} onSubmit={(p) => save.mutate({ ...p, id: editing.id })} submitting={save.isPending} />
        </Dialog>
      )}
    </div>
  );
}

function UnitForm({ initial, onSubmit, submitting }: { initial?: Unit; onSubmit: (p: Partial<Unit>) => void; submitting: boolean }) {
  const [f, setF] = useState<Partial<Unit>>(initial ?? { name: "", lbs_per_unit: 0 });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit unit" : "Add unit"}</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!f.name) { toast.error("Name required"); return; } onSubmit(f); }}>
        <div><Label>Name *</Label><Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Full bucket" maxLength={50} required /></div>
        <div><Label>Pounds per unit *</Label><Input type="number" step="0.01" value={f.lbs_per_unit ?? 0} onChange={(e) => setF({ ...f, lbs_per_unit: Number(e.target.value) })} required /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
