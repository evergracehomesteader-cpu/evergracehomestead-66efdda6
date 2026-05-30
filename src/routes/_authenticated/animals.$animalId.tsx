import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Heart, Baby, Trash2, Scale, PawPrint, Stethoscope, History, GitBranch, DollarSign, Target } from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { gestationFor, statusBadgeClass } from "@/lib/homestead";
import { LineageTree } from "@/components/LineageTree";
import { WithdrawalBanner } from "@/components/WithdrawalBanner";
import { loadAnimalFinance } from "@/lib/animal-finance";
import { SignedImg } from "@/components/SignedImg";
import { findCommonAncestors } from "@/lib/lineage";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type SbAny = {
  from: (t: string) => {
    select: (s: string) => { eq: (c: string, v: string) => { order: (col: string, o?: { ascending: boolean }) => Promise<{ data: unknown[] | null }> } };
    insert: (r: unknown) => Promise<{ error: Error | null }>;
    update: (r: unknown) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
    delete: () => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
  };
};

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

  const { data: weights } = useQuery({
    queryKey: ["weights", animalId],
    queryFn: async () => {
      const { data } = await supabase.from("weight_logs").select("*").eq("animal_id", animalId).order("weighed_on", { ascending: false });
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

  const sb = supabase as unknown as SbAny;
  type Health = { id: string; record_type: string; product: string | null; dosage: string | null; administered_on: string; withdrawal_meat_until: string | null; withdrawal_milk_until: string | null; withdrawal_eggs_until: string | null; vet_contact: string | null; cost_cents: number; body_condition_score: number | null; notes: string | null };
  const { data: healthRecs } = useQuery({
    queryKey: ["health", animalId],
    queryFn: async () => ((await sb.from("health_records").select("*").eq("animal_id", animalId).order("administered_on", { ascending: false })).data ?? []) as Health[],
  });
  type Decision = { id: string; decision: string; target_date: string | null; reason: string | null; created_at: string };
  const { data: decisions } = useQuery({
    queryKey: ["decisions", animalId],
    queryFn: async () => ((await sb.from("breeding_decisions").select("*").eq("animal_id", animalId).order("created_at", { ascending: false })).data ?? []) as Decision[],
  });
  const { data: finance } = useQuery({
    queryKey: ["finance", animalId, healthRecs?.length, weights?.length],
    queryFn: () => loadAnimalFinance(animalId),
    enabled: !!animal,
  });

  const addHealth = useMutation({
    mutationFn: async (p: Omit<Health, "id">) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await sb.from("health_records").insert({ animal_id: animalId, created_by: u.user?.id, ...p });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["health", animalId] }); toast.success("Health record added"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const delHealth = useMutation({
    mutationFn: async (id: string) => { const { error } = await sb.from("health_records").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health", animalId] }),
  });
  const addDecision = useMutation({
    mutationFn: async (p: { decision: string; reason: string | null; target_date: string | null }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await sb.from("breeding_decisions").insert({ animal_id: animalId, created_by: u.user?.id, ...p });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["decisions", animalId] }); toast.success("Decision saved"); },
  });
  const delDecision = useMutation({
    mutationFn: async (id: string) => { const { error } = await sb.from("breeding_decisions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decisions", animalId] }),
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
    mutationFn: async (p: { bred_date: string; sire_id: string | null; expected_due: string | null; notes: string | null; status: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("pregnancies").insert({ animal_id: animalId, created_by: u.user?.id, ...p } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pregs", animalId] }); toast.success("Pregnancy added"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const updatePreg = useMutation({
    mutationFn: async ({ id, ...p }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("pregnancies").update(p as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pregs", animalId] }),
  });

  const addWeight = useMutation({
    mutationFn: async (p: { weight: number; unit: string; weighed_on: string; notes: string | null }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("weight_logs").insert({ animal_id: animalId, created_by: u.user?.id, ...p });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weights", animalId] }); toast.success("Weight logged"); },
  });

  const delWeight = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("weight_logs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weights", animalId] }),
  });

  const timeline = useMemo(() => {
    if (!animal) return [];
    type Event = { date: string; label: string; icon: "born" | "added" | "heat" | "bred" | "preg" | "due" | "birth" | "weight" | "status" };
    const events: Event[] = [];
    if (animal.date_of_birth) events.push({ date: animal.date_of_birth, label: `Born`, icon: "born" });
    events.push({ date: animal.created_at?.slice(0, 10) ?? "", label: "Added to homestead", icon: "added" });
    (heats ?? []).forEach((h) => events.push({ date: h.event_date, label: "Heat observed", icon: "heat" }));
    (pregs ?? []).forEach((p) => {
      events.push({ date: p.bred_date, label: `Bred${p.notes ? ` — ${p.notes}` : ""}`, icon: "bred" });
      if (p.expected_due) events.push({ date: p.expected_due, label: "Expected due date", icon: "due" });
      if (p.actual_birth) events.push({ date: p.actual_birth, label: `Birth — ${p.offspring_count ?? "?"} born${p.survived_count != null ? `, ${p.survived_count} survived` : ""}`, icon: "birth" });
    });
    (weights ?? []).forEach((w) => events.push({ date: w.weighed_on, label: `Weighed ${w.weight} ${w.unit}`, icon: "weight" }));
    if (animal.status !== "active") events.push({ date: animal.updated_at?.slice(0, 10) ?? "", label: `Marked ${animal.status}`, icon: "status" });
    return events.filter((e) => e.date).sort((a, b) => b.date.localeCompare(a.date));
  }, [animal, heats, pregs, weights]);

  if (!animal) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <Link to="/animals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All animals
      </Link>

      <div className="flex items-start gap-4 flex-wrap">
        {animal.photo_url ? (
          <img src={animal.photo_url} alt={animal.name} className="h-24 w-24 rounded-xl object-cover" />
        ) : (
          <div className="h-24 w-24 rounded-xl bg-muted flex items-center justify-center"><PawPrint className="h-9 w-9 text-muted-foreground" /></div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-display font-semibold">{animal.name}</h1>
          <p className="text-muted-foreground">{animal.species}{animal.breed ? ` · ${animal.breed}` : ""} · {animal.sex}</p>
          <div className="flex gap-2 flex-wrap mt-2">
            <Badge className={statusBadgeClass(animal.status)}>{animal.status}</Badge>
            {(animal.temperament_tags ?? []).map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}
          </div>
        </div>
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

      <WithdrawalBanner records={healthRecs ?? []} />

      <DecisionCard decisions={decisions ?? []} onAdd={(p) => addDecision.mutate(p)} onDelete={(id) => delDecision.mutate(id)} />

      <Tabs defaultValue="timeline">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="timeline"><History className="h-4 w-4 mr-1" />Timeline</TabsTrigger>
          {animal.sex === "female" && <TabsTrigger value="heats">Heats</TabsTrigger>}
          {animal.sex === "female" && <TabsTrigger value="pregnancies">Pregnancies</TabsTrigger>}
          <TabsTrigger value="weight"><Scale className="h-4 w-4 mr-1" />Weight</TabsTrigger>
          <TabsTrigger value="health"><Stethoscope className="h-4 w-4 mr-1" />Health</TabsTrigger>
          <TabsTrigger value="lineage"><GitBranch className="h-4 w-4 mr-1" />Lineage</TabsTrigger>
          <TabsTrigger value="finance"><DollarSign className="h-4 w-4 mr-1" />Finance</TabsTrigger>
          <TabsTrigger value="offspring">Offspring</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-2">
          {timeline.length === 0 ? <p className="text-muted-foreground text-sm">No events yet.</p> : (
            <Card>
              <ul className="divide-y">
                {timeline.map((e, i) => (
                  <li key={i} className="px-4 py-3 flex items-start gap-3">
                    <div className="text-xs text-muted-foreground w-24 flex-shrink-0">{format(new Date(e.date), "MMM d, yyyy")}</div>
                    <div className="text-sm">{e.label}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>

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
          <PregAdd damId={animalId} species={animal.species} males={males ?? []} onAdd={(p) => addPreg.mutate(p)} />
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
                        {p.offspring_count != null && ` · ${p.offspring_count} born`}
                        {p.survived_count != null && `, ${p.survived_count} survived`}
                      </div>
                    </div>
                    <Badge className={statusBadgeClass(p.status)}>{p.status}</Badge>
                  </div>
                  {!["delivered", "born", "lost"].includes(p.status) && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {p.status === "suspected" && (
                        <Button size="sm" variant="outline" onClick={() => updatePreg.mutate({ id: p.id, status: "confirmed" })}>Confirm</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => {
                        const date = prompt("Birth date (YYYY-MM-DD)?", new Date().toISOString().slice(0,10));
                        if (!date) return;
                        const count = prompt("Number born?");
                        const survived = prompt("Number survived?", count ?? "");
                        updatePreg.mutate({ id: p.id, status: "delivered", actual_birth: date, offspring_count: count ? Number(count) : 0, survived_count: survived ? Number(survived) : null });
                      }}><Baby className="h-4 w-4" /> Mark delivered</Button>
                      <Button size="sm" variant="ghost" onClick={() => updatePreg.mutate({ id: p.id, status: "lost" })}>Mark lost</Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="weight" className="space-y-3">
          <WeightAdd onAdd={(p) => addWeight.mutate(p)} />
          {(weights ?? []).length >= 2 && (
            <Card className="p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Growth chart</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...(weights ?? [])].reverse().map((w) => ({ date: format(new Date(w.weighed_on), "M/d"), weight: Number(w.weight) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          {(weights ?? []).length === 0 ? <p className="text-muted-foreground text-sm">No weights logged.</p> : (
            <Card>
              <ul className="divide-y">
                {weights?.map((w) => (
                  <li key={w.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{w.weight} {w.unit}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(w.weighed_on), "MMM d, yyyy")}{w.notes ? ` · ${w.notes}` : ""}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => delWeight.mutate(w.id)}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-3">
          <HealthAdd onAdd={(p) => addHealth.mutate(p)} />
          {(healthRecs ?? []).length === 0 ? <p className="text-muted-foreground text-sm">No health records yet.</p> : (
            <Card>
              <ul className="divide-y">
                {healthRecs!.map((h) => (
                  <li key={h.id} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="capitalize">{h.record_type.replace("_", " ")}</Badge>
                        {h.product && <span className="font-medium text-sm">{h.product}</span>}
                        {h.cost_cents > 0 && <span className="text-xs text-muted-foreground">${(h.cost_cents / 100).toFixed(2)}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(h.administered_on), "MMM d, yyyy")}
                        {h.dosage && ` · ${h.dosage}`}
                        {h.body_condition_score != null && ` · BCS ${h.body_condition_score}`}
                      </div>
                      {(h.withdrawal_meat_until || h.withdrawal_milk_until || h.withdrawal_eggs_until) && (
                        <div className="text-xs mt-1 flex flex-wrap gap-1">
                          {h.withdrawal_meat_until && <Badge variant="destructive" className="text-[10px]">meat → {format(new Date(h.withdrawal_meat_until), "MMM d")}</Badge>}
                          {h.withdrawal_milk_until && <Badge variant="destructive" className="text-[10px]">milk → {format(new Date(h.withdrawal_milk_until), "MMM d")}</Badge>}
                          {h.withdrawal_eggs_until && <Badge variant="destructive" className="text-[10px]">eggs → {format(new Date(h.withdrawal_eggs_until), "MMM d")}</Badge>}
                        </div>
                      )}
                      {h.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{h.notes}</p>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => delHealth.mutate(h.id)}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {animal.medical_notes && (
            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Medical notes</div>
              <div className="whitespace-pre-wrap text-sm">{animal.medical_notes}</div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="lineage">
          <LineageTree animalId={animalId} />
        </TabsContent>

        <TabsContent value="finance" className="space-y-3">
          {!finance ? <p className="text-sm text-muted-foreground">Calculating…</p> : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Card className="p-3"><div className="text-xs text-muted-foreground">Invested</div><div className="text-xl font-display font-semibold text-destructive">${(finance.invested / 100).toFixed(2)}</div></Card>
                <Card className="p-3"><div className="text-xs text-muted-foreground">Earned</div><div className="text-xl font-display font-semibold text-success">${(finance.earned / 100).toFixed(2)}</div></Card>
                <Card className="p-3"><div className="text-xs text-muted-foreground">Net</div><div className={`text-xl font-display font-semibold ${finance.net >= 0 ? "text-success" : "text-destructive"}`}>${(finance.net / 100).toFixed(2)}</div></Card>
              </div>
              <Card>
                <ul className="divide-y">
                  {finance.items.map((it) => (
                    <li key={it.label} className="px-4 py-2 flex justify-between text-sm">
                      <span>{it.label}</span>
                      <span className={it.kind === "in" ? "text-success" : "text-destructive"}>{it.kind === "in" ? "+" : "−"}${(it.cents / 100).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
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

function WeightAdd({ onAdd }: { onAdd: (p: { weight: number; unit: string; weighed_on: string; notes: string | null }) => void }) {
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("lb");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!weight) return; onAdd({ weight: Number(weight), unit, weighed_on: date, notes: notes || null }); setWeight(""); setNotes(""); }}
      className="flex flex-wrap gap-2 items-end"
    >
      <div><Label className="text-xs">Weight</Label><Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-24" required /></div>
      <div>
        <Label className="text-xs">Unit</Label>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="lb">lb</SelectItem><SelectItem value="kg">kg</SelectItem><SelectItem value="oz">oz</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="flex-1 min-w-[140px]"><Label className="text-xs">Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></div>
      <Button type="submit" size="sm"><Plus className="h-4 w-4" /> Log</Button>
    </form>
  );
}

function PregAdd({ damId, species, males, onAdd }: { damId: string; species: string; males: { id: string; name: string }[]; onAdd: (p: { bred_date: string; sire_id: string | null; expected_due: string | null; notes: string | null; status: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [bred, setBred] = useState(new Date().toISOString().slice(0, 10));
  const [sire, setSire] = useState<string>("none");
  const defaultGest = String(gestationFor(species));
  const [gestation, setGestation] = useState(defaultGest);
  const [status, setStatus] = useState("suspected");
  const [notes, setNotes] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const due = bred ? format(addDays(new Date(bred), Number(gestation) || 0), "yyyy-MM-dd") : null;

  const checkSire = async (sireId: string) => {
    setSire(sireId);
    if (sireId === "none") { setWarning(null); return; }
    const common = await findCommonAncestors(damId, sireId, 3);
    setWarning(common.length > 0 ? `Inbreeding risk: ${common.map((c) => `${c.name} (${c.relation})`).join(", ")}` : null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add pregnancy</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New pregnancy</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onAdd({ bred_date: bred, sire_id: sire === "none" ? null : sire, expected_due: due, notes: notes || null, status }); setOpen(false); }} className="space-y-3">
          <div><Label>Bred date</Label><Input type="date" value={bred} onChange={(e) => setBred(e.target.value)} required /></div>
          <div>
            <Label>Sire</Label>
            <Select value={sire} onValueChange={checkSire}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unknown</SelectItem>
                {males.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {warning && <div className="mt-2 text-xs text-destructive font-medium border border-destructive/40 bg-destructive/5 rounded p-2">⚠ {warning}</div>}
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="suspected">Suspected</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Gestation (days)</Label>
            <Input type="number" value={gestation} onChange={(e) => setGestation(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Default for {species || "species"}: {defaultGest} days. Pig 114 · Goat 150 · Cow 283 · Rabbit 31 · Chicken 21 · Dog/Cat 63</p>
            {due && <p className="text-xs text-muted-foreground mt-1">Expected due: <strong>{format(new Date(due), "MMM d, yyyy")}</strong></p>}
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const HEALTH_TYPES = ["vaccination", "deworming", "treatment", "injury", "illness", "vet_visit", "body_condition"];

function HealthAdd({ onAdd }: { onAdd: (p: { record_type: string; product: string | null; dosage: string | null; administered_on: string; withdrawal_meat_until: string | null; withdrawal_milk_until: string | null; withdrawal_eggs_until: string | null; vet_contact: string | null; cost_cents: number; body_condition_score: number | null; notes: string | null }) => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("vaccination");
  const [product, setProduct] = useState("");
  const [dosage, setDosage] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [meat, setMeat] = useState("");
  const [milk, setMilk] = useState("");
  const [eggs, setEggs] = useState("");
  const [cost, setCost] = useState("");
  const [bcs, setBcs] = useState("");
  const [vet, setVet] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add health record</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Health record</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAdd({
              record_type: type, product: product || null, dosage: dosage || null, administered_on: date,
              withdrawal_meat_until: meat || null, withdrawal_milk_until: milk || null, withdrawal_eggs_until: eggs || null,
              vet_contact: vet || null, cost_cents: cost ? Math.round(Number(cost) * 100) : 0,
              body_condition_score: bcs ? Number(bcs) : null, notes: notes || null,
            });
            setOpen(false);
            setProduct(""); setDosage(""); setMeat(""); setMilk(""); setEggs(""); setCost(""); setBcs(""); setVet(""); setNotes("");
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{HEALTH_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Product / med</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} maxLength={150} /></div>
            <div><Label>Dosage</Label><Input value={dosage} onChange={(e) => setDosage(e.target.value)} maxLength={100} /></div>
            <div><Label>Cost ($)</Label><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
            <div><Label>Body condition (1-9)</Label><Input type="number" step="0.5" min="1" max="9" value={bcs} onChange={(e) => setBcs(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Meat withhold until</Label><Input type="date" value={meat} onChange={(e) => setMeat(e.target.value)} /></div>
            <div><Label className="text-xs">Milk withhold until</Label><Input type="date" value={milk} onChange={(e) => setMilk(e.target.value)} /></div>
            <div><Label className="text-xs">Eggs withhold until</Label><Input type="date" value={eggs} onChange={(e) => setEggs(e.target.value)} /></div>
          </div>
          <div><Label>Vet / contact</Label><Input value={vet} onChange={(e) => setVet(e.target.value)} maxLength={150} /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const DECISION_TYPES = [
  { v: "keep", color: "bg-success text-success-foreground" },
  { v: "breed", color: "bg-primary text-primary-foreground" },
  { v: "sell", color: "bg-warning text-warning-foreground" },
  { v: "butcher", color: "bg-destructive text-destructive-foreground" },
];

type DecisionRow = { id: string; decision: string; target_date: string | null; reason: string | null; created_at: string };

function DecisionCard({ decisions, onAdd, onDelete }: { decisions: DecisionRow[]; onAdd: (p: { decision: string; reason: string | null; target_date: string | null }) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState("keep");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const latest = decisions[0];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Plan</h3>
        {latest && (
          <Badge className={DECISION_TYPES.find((d) => d.v === latest.decision)?.color ?? ""}>{latest.decision}</Badge>
        )}
        {latest?.target_date && <span className="text-xs text-muted-foreground">by {format(new Date(latest.target_date), "MMM d, yyyy")}</span>}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline" className="ml-auto"><Plus className="h-3 w-3" /> Decision</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Plan / decision</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); onAdd({ decision, reason: reason || null, target_date: date || null }); setOpen(false); setReason(""); setDate(""); }} className="space-y-3">
              <div>
                <Label>Decision</Label>
                <Select value={decision} onValueChange={setDecision}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DECISION_TYPES.map((d) => <SelectItem key={d.v} value={d.v} className="capitalize">{d.v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Target date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><Label>Reason / notes</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></div>
              <DialogFooter><Button type="submit">Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {latest?.reason && <p className="text-sm text-muted-foreground mt-2">{latest.reason}</p>}
      {decisions.length > 1 && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer">History ({decisions.length - 1} prior)</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {decisions.slice(1).map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize text-[10px]">{d.decision}</Badge>
                <span className="text-muted-foreground">{format(new Date(d.created_at), "MMM d, yyyy")}</span>
                {d.reason && <span className="truncate flex-1">{d.reason}</span>}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(d.id)}><Trash2 className="h-3 w-3" /></Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
