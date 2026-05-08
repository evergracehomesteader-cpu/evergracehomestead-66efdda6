import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus, PawPrint } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/animals")({ component: AnimalsPage });

type Animal = {
  id: string; name: string; species: string; breed: string | null;
  sex: "female" | "male" | "unknown"; date_of_birth: string | null; tag: string | null;
  status: "active" | "sold" | "deceased" | "archived"; notes: string | null;
  mother_id: string | null; father_id: string | null;
};

function AnimalsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: animals } = useQuery({
    queryKey: ["animals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("animals").select("*").order("name");
      if (error) throw error;
      return data as Animal[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<Animal>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("animals").insert({ ...payload, created_by: u.user?.id } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Animal added"); qc.invalidateQueries({ queryKey: ["animals"] }); setOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });

  const grouped = (animals ?? []).reduce<Record<string, Animal[]>>((acc, a) => {
    (acc[a.species] ||= []).push(a); return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Animals</h1>
          <p className="text-muted-foreground">Heats, pregnancies, and lineage.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Add animal</Button>
          </DialogTrigger>
          <AnimalForm
            animals={animals ?? []}
            onSubmit={(p) => create.mutate(p)}
            submitting={create.isPending}
          />
        </Dialog>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card className="p-12 text-center">
          <PawPrint className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No animals yet. Add your first one to start tracking.</p>
        </Card>
      ) : (
        Object.entries(grouped).map(([species, list]) => (
          <div key={species}>
            <h2 className="font-display text-xl font-semibold capitalize mb-3">{species}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((a) => (
                <Link to="/animals/$animalId" params={{ animalId: a.id }} key={a.id}>
                  <Card className="p-4 hover:shadow-md transition-shadow h-full">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-sm text-muted-foreground">{a.breed ?? "—"} · {a.sex}</div>
                      </div>
                      <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                    </div>
                    {a.tag && <div className="text-xs text-muted-foreground mt-2">Tag: {a.tag}</div>}
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AnimalForm({ animals, onSubmit, submitting }: { animals: Animal[]; onSubmit: (p: Partial<Animal>) => void; submitting: boolean }) {
  const [form, setForm] = useState<Partial<Animal>>({ name: "", species: "", sex: "unknown", status: "active" });
  const set = <K extends keyof Animal>(k: K, v: Animal[K] | null) => setForm((f) => ({ ...f, [k]: v }));

  const females = animals.filter((a) => a.sex === "female");
  const males = animals.filter((a) => a.sex === "male");

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Add animal</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); if (!form.name || !form.species) { toast.error("Name and species required"); return; } onSubmit(form); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name *</Label><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} required maxLength={100} /></div>
          <div><Label>Species *</Label><Input value={form.species ?? ""} onChange={(e) => set("species", e.target.value)} placeholder="goat, chicken…" required maxLength={50} /></div>
          <div><Label>Breed</Label><Input value={form.breed ?? ""} onChange={(e) => set("breed", e.target.value || null)} maxLength={100} /></div>
          <div>
            <Label>Sex</Label>
            <Select value={form.sex} onValueChange={(v) => set("sex", v as Animal["sex"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date of birth</Label><Input type="date" value={form.date_of_birth ?? ""} onChange={(e) => set("date_of_birth", e.target.value || null)} /></div>
          <div><Label>Tag / ID</Label><Input value={form.tag ?? ""} onChange={(e) => set("tag", e.target.value || null)} maxLength={50} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Mother</Label>
            <Select value={form.mother_id ?? "none"} onValueChange={(v) => set("mother_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {females.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Father</Label>
            <Select value={form.father_id ?? "none"} onValueChange={(v) => set("father_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {males.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} maxLength={2000} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
