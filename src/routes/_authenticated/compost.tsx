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
import { Plus, Recycle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compost")({ component: CompostPage });

function CompostPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: entries } = useQuery({
    queryKey: ["compost"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compost_entries").select("*").order("entry_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (p: Record<string, unknown>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("compost_entries").insert({ ...p, created_by: u.user?.id } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compost"] }); setOpen(false); toast.success("Entry added"); },
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
          <CompostForm onSubmit={(p) => create.mutate(p)} submitting={create.isPending} />
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
                <Button size="sm" variant="ghost" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function CompostForm({ onSubmit, submitting }: { onSubmit: (p: Record<string, unknown>) => void; submitting: boolean }) {
  const [f, setF] = useState({ entry_type: "add", material: "", quantity: "", entry_date: new Date().toISOString().slice(0, 10), notes: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Compost entry</DialogTitle></DialogHeader>
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
