import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Fence } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useSpeciesCatalog } from "@/hooks/useSpeciesCatalog";

export const Route = createFileRoute("/_authenticated/pens")({ component: PensPage });

type Pen = {
  id: string; name: string; species: string | null;
  capacity: number | null; location: string | null; notes: string | null; active: boolean;
};

function PensPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pen | null>(null);
  const { data: species = [] } = useSpeciesCatalog();

  const { data: pens = [] } = useQuery({
    queryKey: ["pens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pens" as never).select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Pen[];
    },
  });

  const { data: animals = [] } = useQuery({
    queryKey: ["pens-animals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("animals")
        .select("id,name,species,current_pen,status")
        .not("status", "in", "(sold,deceased,archived,butchered)");
      return (data ?? []) as { id: string; name: string; species: string; current_pen: string | null; status: string }[];
    },
  });

  const animalsByPen = useMemo(() => {
    const m = new Map<string, typeof animals>();
    animals.forEach((a) => {
      if (!a.current_pen) return;
      const k = a.current_pen.toLowerCase();
      const arr = m.get(k) ?? [];
      arr.push(a);
      m.set(k, arr);
    });
    return m;
  }, [animals]);

  const save = useMutation({
    mutationFn: async (p: Partial<Pen> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const c = supabase as never as { from: (t: string) => { insert: (r: unknown) => Promise<{ error: Error | null }>; update: (r: unknown) => { eq: (col: string, v: string) => Promise<{ error: Error | null }> } } };
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await c.from("pens").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await c.from("pens").insert({ ...p, created_by: u.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["pens"] });
      setOpen(false); setEditing(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const c = supabase as never as { from: (t: string) => { delete: () => { eq: (col: string, v: string) => Promise<{ error: Error | null }> } } };
      const { error } = await c.from("pens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pens"] }); toast.success("Pen deleted"); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Pens</h1>
          <p className="text-muted-foreground">Fenced areas, coops, and paddocks where animals live.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4" /> Add pen</Button></DialogTrigger>
          <PenForm species={species.map((s) => s.name)} onSubmit={(p) => save.mutate(p)} submitting={save.isPending} />
        </Dialog>
      </div>

      {pens.length === 0 ? (
        <Card className="p-12 text-center">
          <Fence className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No pens yet. Add your first pen to start assigning animals.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pens.map((p) => {
            const occupants = animalsByPen.get(p.name.toLowerCase()) ?? [];
            const overCap = p.capacity != null && occupants.length > p.capacity;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.species ?? "Any species"}{p.location ? ` · ${p.location}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <ConfirmDelete
                      trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>}
                      title={`Delete ${p.name}?`}
                      description="Animals currently assigned to this pen will keep the text label until you reassign them."
                      onConfirm={() => del.mutate(p.id)}
                    />
                  </div>
                </div>
                <div className="text-sm mt-3">
                  <span className={overCap ? "text-warning font-medium" : ""}>
                    {occupants.length}{p.capacity != null ? ` / ${p.capacity}` : ""} animals
                  </span>
                </div>
                {occupants.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {occupants.map((a) => a.name).join(", ")}
                  </div>
                )}
                {p.notes && <div className="text-xs text-muted-foreground mt-2">{p.notes}</div>}
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <PenForm initial={editing} species={species.map((s) => s.name)} onSubmit={(p) => save.mutate({ ...p, id: editing.id })} submitting={save.isPending} />
        </Dialog>
      )}
    </div>
  );
}

function PenForm({ initial, species, onSubmit, submitting }: {
  initial?: Pen;
  species: string[];
  onSubmit: (p: Partial<Pen>) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sp, setSp] = useState(initial?.species ?? "__any__");
  const [capacity, setCapacity] = useState(initial?.capacity?.toString() ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit pen" : "Add pen"}</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) { toast.error("Name required"); return; }
          onSubmit({
            name: name.trim(),
            species: sp === "__any__" ? null : sp,
            capacity: capacity ? Number(capacity) : null,
            location: location.trim() || null,
            notes: notes.trim() || null,
          });
        }}
        className="space-y-3"
      >
        <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Species</Label>
            <Select value={sp} onValueChange={setSp}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any species</SelectItem>
                {species.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Capacity</Label><Input type="number" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
        </div>
        <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Back pasture, north coop…" maxLength={150} /></div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
