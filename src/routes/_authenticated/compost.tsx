import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Recycle, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compost")({ component: CompostPage });

type Entry = { id: string; entry_type: string; material: string | null; quantity: string | null; entry_date: string; notes: string | null };

function CompostPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);

  const { data: entries } = useQuery({
    queryKey: ["compost"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compost_entries").select("*").order("entry_date", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Record<string, unknown> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await supabase.from("compost_entries").update(rest as never).eq("id", id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("compost_entries").insert({ ...p, created_by: u.user?.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compost"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("compost_entries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compost"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Compost</h1>
          <p className="text-muted-foreground">Additions, turns, and harvests.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Log entry</Button></DialogTrigger>
          <CompostForm onSubmit={(p) => save.mutate(p)} submitting={save.isPending} />
        </Dialog>
      </div>

      {(entries ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <Recycle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No compost activity logged.</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {entries?.map((e) => (
              <li key={e.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="outline" className="capitalize">{e.entry_type}</Badge>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.material ?? "—"}{e.quantity ? ` · ${e.quantity}` : ""}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(e.entry_date), "MMM d, yyyy")}{e.notes ? ` · ${e.notes}` : ""}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <CompostForm initial={editing} onSubmit={(p) => save.mutate({ ...p, id: editing.id })} submitting={save.isPending} />
        </Dialog>
      )}
    </div>
  );
}

function CompostForm({ initial, onSubmit, submitting }: { initial?: Entry; onSubmit: (p: Record<string, unknown>) => void; submitting: boolean }) {
  const [f, setF] = useState({
    entry_type: initial?.entry_type ?? "add",
    material: initial?.material ?? "",
    quantity: initial?.quantity ?? "",
    entry_date: initial?.entry_date ?? new Date().toISOString().slice(0, 10),
    notes: initial?.notes ?? "",
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit entry" : "Compost entry"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...f, material: f.material || null, quantity: f.quantity || null, notes: f.notes || null }); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={f.entry_type} onValueChange={(v) => setF({ ...f, entry_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add material</SelectItem>
                <SelectItem value="turn">Turn pile</SelectItem>
                <SelectItem value="harvest">Harvest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date</Label><Input type="date" value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} /></div>
        </div>
        <div><Label>Material</Label><Input value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })} placeholder="kitchen scraps, straw…" maxLength={100} /></div>
        <div><Label>Quantity</Label><Input value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} placeholder="1 bucket" maxLength={50} /></div>
        <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={500} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
