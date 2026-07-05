import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sprout, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/garden")({ component: GardenPage });

type Plot = {
  id: string; name: string; crop: string | null; planted_on: string | null;
  expected_harvest: string | null; status: string; notes: string | null;
};

function GardenPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plot | null>(null);

  const { data: plots } = useQuery({
    queryKey: ["garden"],
    queryFn: async () => {
      const { data, error } = await supabase.from("garden_plots").select("*").order("planted_on", { ascending: false });
      if (error) throw error;
      return data as Plot[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Record<string, unknown> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await supabase.from("garden_plots").update(rest as never).eq("id", id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("garden_plots").insert({ ...p, created_by: u.user?.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["garden"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("garden_plots").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["garden"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Garden</h1>
          <p className="text-muted-foreground">Plots, crops, and harvests.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add plot</Button></DialogTrigger>
          <PlotForm onSubmit={(p) => save.mutate(p)} submitting={save.isPending} />
        </Dialog>
      </div>

      {(plots ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <Sprout className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No garden plots yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plots?.map((p) => (
            <Card key={p.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  {p.crop && <div className="text-sm text-muted-foreground">{p.crop}</div>}
                </div>
                <Badge variant={p.status === "harvested" ? "secondary" : "default"}>{p.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {p.planted_on && <div>Planted: {format(new Date(p.planted_on), "MMM d, yyyy")}</div>}
                {p.expected_harvest && <div>Harvest: {format(new Date(p.expected_harvest), "MMM d, yyyy")}</div>}
              </div>
              {p.notes && <p className="text-sm">{p.notes}</p>}
              <div className="flex gap-1 pt-1">
                <Select value={p.status} onValueChange={(v) => save.mutate({ id: p.id, status: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="growing">Growing</SelectItem>
                    <SelectItem value="harvested">Harvested</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${p.name}?`)) del.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <PlotForm initial={editing} onSubmit={(p) => save.mutate({ ...p, id: editing.id })} submitting={save.isPending} />
        </Dialog>
      )}
    </div>
  );
}

function PlotForm({ initial, onSubmit, submitting }: { initial?: Plot; onSubmit: (p: Record<string, unknown>) => void; submitting: boolean }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    crop: initial?.crop ?? "",
    planted_on: initial?.planted_on ?? "",
    expected_harvest: initial?.expected_harvest ?? "",
    status: initial?.status ?? "growing",
    notes: initial?.notes ?? "",
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit plot" : "New plot"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); if (!f.name) { toast.error("Name required"); return; } onSubmit({ ...f, planted_on: f.planted_on || null, expected_harvest: f.expected_harvest || null, crop: f.crop || null, notes: f.notes || null }); }} className="space-y-3">
        <div><Label>Plot name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={100} /></div>
        <div><Label>Crop</Label><Input value={f.crop} onChange={(e) => setF({ ...f, crop: e.target.value })} placeholder="Tomatoes" maxLength={100} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Planted</Label><Input type="date" value={f.planted_on} onChange={(e) => setF({ ...f, planted_on: e.target.value })} /></div>
          <div><Label>Expected harvest</Label><Input type="date" value={f.expected_harvest} onChange={(e) => setF({ ...f, expected_harvest: e.target.value })} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
