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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Heart, Baby, Trash2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/animals/$animalId")({ component: AnimalDetail });

function AnimalDetail() {
  const { animalId } = Route.useParams();
  const qc = useQueryClient();

  const { data: animal } = useQuery({
    queryKey: ["animal", animalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("animals").select("*").eq("id", animalId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: parents } = useQuery({
    queryKey: ["animal-parents", animal?.mother_id, animal?.father_id],
    enabled: !!animal,
    queryFn: async () => {
      const ids = [animal?.mother_id, animal?.father_id].filter(Boolean) as string[];
      if (ids.length === 0) return { mother: null, father: null };
      const { data } = await supabase.from("animals").select("id,name").in("id", ids);
      return {
        mother: data?.find((d) => d.id === animal?.mother_id) ?? null,
        father: data?.find((d) => d.id === animal?.father_id) ?? null,
      };
    },
  });

  const { data: offspring } = useQuery({
    queryKey: ["offspring", animalId],
    queryFn: async () => {
      const { data } = await supabase.from("animals").select("id, name, sex, date_of_birth").or(`mother_id.eq.${animalId},father_id.eq.${animalId}`).order("date_of_birth", { ascending: false });
      return data ?? [];
    },
  });

  const { data: heats } = useQuery({
    queryKey: ["heats", animalId],
    queryFn: async () => {
      const { data } = await supabase.from("heat_events").select("*").eq("animal_id", animalId).order("event_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: pregs } = useQuery({
    queryKey: ["pregs", animalId],
    queryFn: async () => {
      const { data } = await supabase.from("pregnancies").select("*").eq("animal_id", animalId).order("bred_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: males } = useQuery({
    queryKey: ["males-list"],
    queryFn: async () => {
      const { data } = await supabase.from("animals").select("id, name").eq("sex", "male");
      return data ?? [];
    },
  });

  const addHeat = useMutation({
    mutationFn: async (event_date: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("heat_events").insert({ animal_id: animalId, event_date, created_by: u.user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["heats", animalId] }); toast.success("Heat logged"); },
  });

  const delHeat = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("heat_events").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["heats", animalId] }),
  });

  const addPreg = useMutation({
    mutationFn: async (p: { bred_date: string; sire_id: string | null; expected_due: string | null; notes: string | null }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("pregnancies").insert({ animal_id: animalId, created_by: u.user?.id, status: "active", ...p });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pregs", animalId] }); toast.success("Pregnancy added"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const updatePreg = useMutation({
    mutationFn: async ({ id, ...p }: { id: string; status?: string; actual_birth?: string; offspring_count?: number }) => {
      const { error } = await supabase.from("pregnancies").update(p).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pregs", animalId] }),
  });

  if (!animal) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <Link to="/animals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All animals
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold">{animal.name}</h1>
          <p className="text-muted-foreground">{animal.species}{animal.breed ? ` · ${animal.breed}` : ""} · {animal.sex}</p>
        </div>
        <Badge variant={animal.status === "active" ? "default" : "secondary"}>{animal.status}</Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Tag</div>
          <div className="font-medium">{animal.tag ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Born</div>
          <div className="font-medium">{animal.date_of_birth ? format(new Date(animal.date_of_birth), "MMM d, yyyy") : "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Lineage</div>
          <div className="text-sm">
            <div>♀ {parents?.mother ? <Link to="/animals/$animalId" params={{ animalId: parents.mother.id }} className="text-primary hover:underline">{parents.mother.name}</Link> : "—"}</div>
            <div>♂ {parents?.father ? <Link to="/animals/$animalId" params={{ animalId: parents.father.id }} className="text-primary hover:underline">{parents.father.name}</Link> : "—"}</div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue={animal.sex === "female" ? "pregnancies" : "offspring"}>
        <TabsList>
          {animal.sex === "female" && <TabsTrigger value="heats">Heats</TabsTrigger>}
          {animal.sex === "female" && <TabsTrigger value="pregnancies">Pregnancies</TabsTrigger>}
          <TabsTrigger value="offspring">Offspring</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="heats" className="space-y-3">
          <HeatAdd onAdd={(d) => addHeat.mutate(d)} />
          {(heats ?? []).length === 0 ? <p className="text-muted-foreground text-sm">No heats logged.</p> : (
            <Card>
              <ul className="divide-y">
                {heats?.map((h) => (
                  <li key={h.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Heart className="h-4 w-4 text-accent" />{format(new Date(h.event_date), "MMM d, yyyy")}</div>
                    <Button size="sm" variant="ghost" onClick={() => delHeat.mutate(h.id)}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pregnancies" className="space-y-3">
          <PregAdd males={males ?? []} onAdd={(p) => addPreg.mutate(p)} />
          {(pregs ?? []).length === 0 ? <p className="text-muted-foreground text-sm">No pregnancies tracked.</p> : (
            <div className="space-y-2">
              {pregs?.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-medium">Bred {format(new Date(p.bred_date), "MMM d, yyyy")}</div>
                      <div className="text-sm text-muted-foreground">
                        {p.expected_due && `Due ${format(new Date(p.expected_due), "MMM d")}`}
                        {p.actual_birth && ` · Born ${format(new Date(p.actual_birth), "MMM d")}`}
                        {p.offspring_count != null && ` · ${p.offspring_count} offspring`}
                      </div>
                    </div>
                    <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                  </div>
                  {p.status === "active" && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        const date = prompt("Birth date (YYYY-MM-DD)?", new Date().toISOString().slice(0,10));
                        const count = prompt("Offspring count?");
                        if (date) updatePreg.mutate({ id: p.id, status: "born", actual_birth: date, offspring_count: count ? Number(count) : 0 });
                      }}><Baby className="h-4 w-4" /> Mark born</Button>
                      <Button size="sm" variant="ghost" onClick={() => updatePreg.mutate({ id: p.id, status: "lost" })}>Mark lost</Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="offspring">
          {(offspring ?? []).length === 0 ? <p className="text-muted-foreground text-sm">No offspring recorded.</p> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {offspring?.map((o) => (
                <Link key={o.id} to="/animals/$animalId" params={{ animalId: o.id }}>
                  <Card className="p-4 hover:shadow-md transition-shadow">
                    <div className="font-medium">{o.name}</div>
                    <div className="text-sm text-muted-foreground">{o.sex} · {o.date_of_birth ? format(new Date(o.date_of_birth), "MMM d, yyyy") : "—"}</div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes">
          <Card className="p-4 whitespace-pre-wrap text-sm">{animal.notes || <span className="text-muted-foreground">No notes.</span>}</Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HeatAdd({ onAdd }: { onAdd: (d: string) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onAdd(date); }} className="flex gap-2">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[200px]" />
      <Button type="submit" size="sm"><Plus className="h-4 w-4" /> Log heat</Button>
    </form>
  );
}

function PregAdd({ males, onAdd }: { males: { id: string; name: string }[]; onAdd: (p: { bred_date: string; sire_id: string | null; expected_due: string | null; notes: string | null }) => void }) {
  const [open, setOpen] = useState(false);
  const [bred, setBred] = useState(new Date().toISOString().slice(0, 10));
  const [sire, setSire] = useState<string>("none");
  const [gestation, setGestation] = useState("150");
  const [notes, setNotes] = useState("");

  const due = bred ? format(addDays(new Date(bred), Number(gestation) || 0), "yyyy-MM-dd") : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add pregnancy</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New pregnancy</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onAdd({ bred_date: bred, sire_id: sire === "none" ? null : sire, expected_due: due, notes: notes || null }); setOpen(false); }} className="space-y-3">
          <div><Label>Bred date</Label><Input type="date" value={bred} onChange={(e) => setBred(e.target.value)} required /></div>
          <div>
            <Label>Sire</Label>
            <Select value={sire} onValueChange={setSire}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unknown</SelectItem>
                {males.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Gestation (days)</Label>
            <Input type="number" value={gestation} onChange={(e) => setGestation(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Goat ~150 · Sheep ~147 · Pig ~114 · Cow ~283 · Rabbit ~31</p>
            {due && <p className="text-xs text-muted-foreground mt-1">Expected due: <strong>{format(new Date(due), "MMM d, yyyy")}</strong></p>}
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
