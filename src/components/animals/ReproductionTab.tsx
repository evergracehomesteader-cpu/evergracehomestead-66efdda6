import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Egg, Baby, Trash2, Heart, AlertCircle } from "lucide-react";
import { addDays, differenceInDays, format } from "date-fns";
import { toast } from "sonner";
import {
  BIRD_BREEDING_STATUSES,
  BREEDING_EVIDENCE,
  BREEDING_METHODS,
  MAMMAL_BREEDING_STATUSES,
  gestationFor,
  incubationFor,
  isBird,
  prettyStatus,
  statusBadgeClass,
} from "@/lib/homestead";
import { findCommonAncestors } from "@/lib/lineage";

type Animal = {
  id: string;
  name: string;
  sex: string;
  species: string;
  breed: string | null;
  breeding_status: string | null;
  date_of_birth: string | null;
  mother_id: string | null;
  father_id: string | null;
};

type Pregnancy = {
  id: string;
  animal_id: string;
  sire_id: string | null;
  bred_date: string;
  expected_due: string | null;
  actual_birth: string | null;
  status: string;
  offspring_count: number | null;
  survived_count: number | null;
  male_born: number | null;
  female_born: number | null;
  stillborn_count: number | null;
  breeding_method: string | null;
  evidence: string | null;
  notes: string | null;
};

type Incubation = {
  id: string;
  animal_id: string | null;
  species: string;
  set_date: string;
  egg_count: number;
  fertile: boolean | null;
  expected_hatch: string | null;
  actual_hatch: string | null;
  hatched_count: number | null;
  notes: string | null;
};

export function ReproductionTab({ animal }: { animal: Animal }) {
  const qc = useQueryClient();
  const animalId = animal.id;
  const bird = isBird(animal.species);

  const statusOptions = bird ? BIRD_BREEDING_STATUSES : MAMMAL_BREEDING_STATUSES;

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("animals")
        .update({ breeding_status: status || null })
        .eq("id", animalId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animal", animalId] });
      toast.success("Status updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {bird ? "Reproductive status" : "Breeding status"}
            </div>
            <Badge className={statusBadgeClass(animal.breeding_status ?? "")}>
              {animal.breeding_status ? prettyStatus(animal.breeding_status) : "Not set"}
            </Badge>
          </div>
          <div className="w-56">
            <Select
              value={animal.breeding_status ?? ""}
              onValueChange={(v) => updateStatus.mutate(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Set status…" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>{prettyStatus(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {bird ? <BirdSection animal={animal} /> : <MammalSection animal={animal} />}
    </div>
  );
}

/* ─────────────────── MAMMAL ─────────────────── */

function MammalSection({ animal }: { animal: Animal }) {
  const qc = useQueryClient();
  const animalId = animal.id;

  const { data: pregs } = useQuery({
    queryKey: ["pregs", animalId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pregnancies")
        .select("*")
        .eq("animal_id", animalId)
        .order("bred_date", { ascending: false });
      return (data ?? []) as Pregnancy[];
    },
  });

  const { data: males } = useQuery({
    queryKey: ["males", animal.species],
    queryFn: async () => {
      const { data } = await supabase
        .from("animals")
        .select("id,name,species")
        .eq("sex", "male")
        .eq("species", animal.species);
      return data ?? [];
    },
  });

  const addPreg = useMutation({
    mutationFn: async (p: Partial<Pregnancy>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("pregnancies")
        .insert({ animal_id: animalId, created_by: u.user?.id, ...p } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pregs", animalId] });
      toast.success("Breeding event saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updatePreg = useMutation({
    mutationFn: async ({ id, ...p }: { id: string } & Partial<Pregnancy>) => {
      const { error } = await supabase.from("pregnancies").update(p as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pregs", animalId] }),
  });

  const delPreg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pregnancies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pregs", animalId] }),
  });

  return (
    <div className="space-y-3">
      {animal.sex !== "female" ? (
        <p className="text-sm text-muted-foreground">Only females track pregnancies.</p>
      ) : (
        <>
          <BreedingEventDialog
            damId={animalId}
            species={animal.species}
            males={males ?? []}
            onAdd={(p) => addPreg.mutate(p)}
          />
          {(pregs ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No breeding events tracked.</p>
          ) : (
            <div className="space-y-2">
              {pregs!.map((p) => (
                <PregnancyCard
                  key={p.id}
                  preg={p}
                  damSpecies={animal.species}
                  damBreed={animal.breed}
                  damId={animalId}
                  sireName={males?.find((m) => m.id === p.sire_id)?.name ?? null}
                  onUpdate={(patch) => updatePreg.mutate({ id: p.id, ...patch })}
                  onDelete={() => delPreg.mutate(p.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PregnancyCard({
  preg, damSpecies, damBreed, damId, sireName, onUpdate, onDelete,
}: {
  preg: Pregnancy;
  damSpecies: string;
  damBreed: string | null;
  damId: string;
  sireName: string | null;
  onUpdate: (p: Partial<Pregnancy>) => void;
  onDelete: () => void;
}) {
  const today = new Date();
  const due = preg.expected_due ? new Date(preg.expected_due) : null;
  const bred = new Date(preg.bred_date);
  const daysPregnant = differenceInDays(today, bred);
  const daysUntilDue = due ? differenceInDays(due, today) : null;
  const isActive = !["delivered", "born", "lost"].includes(preg.status);

  let alertClass = "";
  let alertText = "";
  if (isActive && daysUntilDue !== null) {
    if (daysUntilDue < 0) { alertClass = "border-destructive bg-destructive/5"; alertText = `${Math.abs(daysUntilDue)} days overdue`; }
    else if (daysUntilDue === 0) { alertClass = "border-destructive bg-destructive/5"; alertText = "Due today"; }
    else if (daysUntilDue <= 7) { alertClass = "border-destructive/60 bg-destructive/5"; alertText = `Due in ${daysUntilDue} days`; }
    else if (daysUntilDue <= 14) { alertClass = "border-warning bg-warning/5"; alertText = `Due in ${daysUntilDue} days`; }
    else if (daysUntilDue <= 30) { alertClass = "border-primary/40 bg-primary/5"; alertText = `Due in ${daysUntilDue} days`; }
  }

  return (
    <Card className={`p-4 ${alertClass}`}>
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">Bred {format(bred, "MMM d, yyyy")}</span>
            <Badge className={statusBadgeClass(preg.status)}>{prettyStatus(preg.status)}</Badge>
            {preg.breeding_method && <Badge variant="outline">{preg.breeding_method === "ai" ? "AI" : "Natural"}</Badge>}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {sireName && <>Sire: {sireName} · </>}
            {preg.evidence && <>Evidence: {prettyStatus(preg.evidence)} · </>}
            {due && (
              <>Due {format(due, "MMM d, yyyy")}</>
            )}
          </div>
          {isActive && (
            <div className="flex gap-3 mt-2 text-xs">
              <span>Day <strong>{daysPregnant}</strong> of {gestationFor(damSpecies)}</span>
              {daysUntilDue !== null && <span>{daysUntilDue >= 0 ? `${daysUntilDue}d to go` : `${Math.abs(daysUntilDue)}d overdue`}</span>}
            </div>
          )}
          {preg.actual_birth && (
            <div className="text-sm mt-2">
              Born {format(new Date(preg.actual_birth), "MMM d, yyyy")}
              {preg.offspring_count != null && ` · ${preg.offspring_count} born`}
              {preg.survived_count != null && `, ${preg.survived_count} alive`}
              {preg.stillborn_count != null && preg.stillborn_count > 0 && `, ${preg.stillborn_count} stillborn`}
              {(preg.male_born != null || preg.female_born != null) && (
                <span> · ♂ {preg.male_born ?? 0} · ♀ {preg.female_born ?? 0}</span>
              )}
            </div>
          )}
          {alertText && (
            <div className="mt-2 text-xs font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {alertText}
            </div>
          )}
          {preg.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{preg.notes}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {isActive && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {preg.status === "suspected" && (
            <Button size="sm" variant="outline" onClick={() => onUpdate({ status: "confirmed" })}>Confirm pregnant</Button>
          )}
          <BirthDialog
            preg={preg}
            damSpecies={damSpecies}
            damBreed={damBreed}
            damId={damId}
            onSave={(patch) => onUpdate(patch)}
          />
          <Button size="sm" variant="ghost" onClick={() => onUpdate({ status: "lost" })}>Mark lost</Button>
        </div>
      )}
    </Card>
  );
}

function BreedingEventDialog({
  damId, species, males, onAdd,
}: {
  damId: string;
  species: string;
  males: { id: string; name: string }[];
  onAdd: (p: Partial<Pregnancy>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [bred, setBred] = useState(new Date().toISOString().slice(0, 10));
  const [sire, setSire] = useState("none");
  const [method, setMethod] = useState<string>("natural");
  const [evidence, setEvidence] = useState<string>("observed_breeding");
  const [status, setStatus] = useState("suspected");
  const [gestation, setGestation] = useState(String(gestationFor(species)));
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
      <DialogTrigger asChild>
        <Button size="sm"><Heart className="h-4 w-4" /> Add breeding event</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New breeding event</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAdd({
              bred_date: bred,
              sire_id: sire === "none" ? null : sire,
              expected_due: due,
              breeding_method: method,
              evidence,
              status,
              notes: notes || null,
            });
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date bred / exposed</Label><Input type="date" value={bred} onChange={(e) => setBred(e.target.value)} required /></div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BREEDING_METHODS.map((m) => <SelectItem key={m} value={m}>{m === "ai" ? "Artificial Insemination" : "Natural"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Male used</Label>
            <Select value={sire} onValueChange={checkSire}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unknown / external</SelectItem>
                {males.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {warning && <div className="mt-2 text-xs text-destructive font-medium border border-destructive/40 bg-destructive/5 rounded p-2">⚠ {warning}</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Evidence</Label>
              <Select value={evidence} onValueChange={setEvidence}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BREEDING_EVIDENCE.map((e) => <SelectItem key={e} value={e}>{prettyStatus(e)}</SelectItem>)}
                </SelectContent>
              </Select>
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
          </div>
          <div>
            <Label>Gestation (days)</Label>
            <Input type="number" value={gestation} onChange={(e) => setGestation(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Default for {species}: {gestationFor(species)} days.{" "}
              {due && <>Expected due: <strong>{format(new Date(due), "MMM d, yyyy")}</strong></>}
            </p>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BirthDialog({
  preg, damSpecies, damBreed, damId, onSave,
}: {
  preg: Pregnancy;
  damSpecies: string;
  damBreed: string | null;
  damId: string;
  onSave: (p: Partial<Pregnancy>) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [alive, setAlive] = useState("");
  const [still, setStill] = useState("0");
  const [male, setMale] = useState("");
  const [female, setFemale] = useState("");
  const [notes, setNotes] = useState("");
  const [createOffspring, setCreateOffspring] = useState(true);

  const createOffspringMut = useMutation({
    mutationFn: async ({ males, females }: { males: number; females: number }) => {
      const { data: u } = await supabase.auth.getUser();
      const rows: Array<Record<string, unknown>> = [];
      const baseName = preg.actual_birth ?? date;
      for (let i = 0; i < males; i++) {
        rows.push({
          name: `Baby ♂ ${baseName} #${i + 1}`,
          species: damSpecies, breed: damBreed,
          sex: "male", date_of_birth: date,
          mother_id: damId, father_id: preg.sire_id,
          created_by: u.user?.id,
        });
      }
      for (let i = 0; i < females; i++) {
        rows.push({
          name: `Baby ♀ ${baseName} #${i + 1}`,
          species: damSpecies, breed: damBreed,
          sex: "female", date_of_birth: date,
          mother_id: damId, father_id: preg.sire_id,
          created_by: u.user?.id,
        });
      }
      if (rows.length === 0) return;
      const { error } = await supabase.from("animals").insert(rows as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offspring", damId] });
      qc.invalidateQueries({ queryKey: ["animals"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Baby className="h-4 w-4" /> Record birth</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Birth record</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const m = Number(male) || 0;
            const f = Number(female) || 0;
            const a = Number(alive) || m + f;
            const s = Number(still) || 0;
            onSave({
              status: "delivered",
              actual_birth: date,
              offspring_count: a + s,
              survived_count: a,
              stillborn_count: s,
              male_born: m,
              female_born: f,
              notes: notes || preg.notes,
            });
            if (createOffspring && (m + f) > 0) {
              await createOffspringMut.mutateAsync({ males: m, females: f });
              toast.success(`Created ${m + f} offspring record(s)`);
            }
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div><Label>Date born</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Born alive</Label><Input type="number" min="0" value={alive} onChange={(e) => setAlive(e.target.value)} /></div>
            <div><Label>Stillborn</Label><Input type="number" min="0" value={still} onChange={(e) => setStill(e.target.value)} /></div>
            <div><Label>Male count</Label><Input type="number" min="0" value={male} onChange={(e) => setMale(e.target.value)} /></div>
            <div><Label>Female count</Label><Input type="number" min="0" value={female} onChange={(e) => setFemale(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createOffspring} onChange={(e) => setCreateOffspring(e.target.checked)} />
            Auto-create offspring animal records ({(Number(male) || 0) + (Number(female) || 0)})
          </label>
          <DialogFooter><Button type="submit">Save birth</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────── BIRDS ─────────────────── */

function BirdSection({ animal }: { animal: Animal }) {
  const qc = useQueryClient();
  const animalId = animal.id;

  const { data: incs } = useQuery({
    queryKey: ["incubations", animalId],
    queryFn: async () => {
      const c = supabase as never as {
        from: (t: string) => {
          select: (s: string) => { eq: (c: string, v: string) => { order: (col: string, o?: { ascending: boolean }) => Promise<{ data: Incubation[] | null }> } };
        };
      };
      return (await c.from("incubations").select("*").eq("animal_id", animalId).order("set_date", { ascending: false })).data ?? [];
    },
  });

  const sb = supabase as never as {
    from: (t: string) => {
      insert: (r: unknown) => Promise<{ error: Error | null }>;
      update: (r: unknown) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
      delete: () => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
    };
  };

  const addInc = useMutation({
    mutationFn: async (p: Partial<Incubation>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await sb.from("incubations").insert({ animal_id: animalId, species: animal.species, created_by: u.user?.id, ...p });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incubations", animalId] }); toast.success("Incubation started"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const updateInc = useMutation({
    mutationFn: async ({ id, ...p }: { id: string } & Partial<Incubation>) => {
      const { error } = await sb.from("incubations").update(p).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incubations", animalId] }),
  });
  const delInc = useMutation({
    mutationFn: async (id: string) => { const { error } = await sb.from("incubations").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incubations", animalId] }),
  });

  return (
    <div className="space-y-3">
      <IncubationDialog species={animal.species} onAdd={(p) => addInc.mutate(p)} />
      {(incs ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No clutches set.</p>
      ) : (
        <div className="space-y-2">
          {incs!.map((i) => (
            <IncubationCard
              key={i.id}
              inc={i}
              onUpdate={(p) => updateInc.mutate({ id: i.id, ...p })}
              onDelete={() => delInc.mutate(i.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IncubationCard({ inc, onUpdate, onDelete }: { inc: Incubation; onUpdate: (p: Partial<Incubation>) => void; onDelete: () => void }) {
  const today = new Date();
  const set = new Date(inc.set_date);
  const daysIn = differenceInDays(today, set);
  const hatch = inc.expected_hatch ? new Date(inc.expected_hatch) : null;
  const daysLeft = hatch ? differenceInDays(hatch, today) : null;
  const done = !!inc.actual_hatch;

  let alertClass = "";
  let alertText = "";
  if (!done && daysLeft !== null) {
    if (daysLeft < 0) { alertClass = "border-destructive bg-destructive/5"; alertText = `Overdue ${Math.abs(daysLeft)}d`; }
    else if (daysLeft === 0) { alertClass = "border-destructive bg-destructive/5"; alertText = "Hatch today!"; }
    else if (daysLeft <= 3) { alertClass = "border-warning bg-warning/5"; alertText = `Hatch in ${daysLeft}d`; }
  }

  return (
    <Card className={`p-4 ${alertClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Egg className="h-4 w-4 text-accent" />
            <span className="font-medium">Set {format(set, "MMM d, yyyy")}</span>
            <Badge variant="outline">{inc.egg_count} eggs</Badge>
            {inc.fertile != null && <Badge variant="outline">{inc.fertile ? "Fertile" : "Unknown"}</Badge>}
            {done && <Badge className={statusBadgeClass("hatching")}>Hatched</Badge>}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {hatch && <>Expected hatch {format(hatch, "MMM d, yyyy")}</>}
          </div>
          {!done && (
            <div className="flex gap-3 mt-2 text-xs">
              <span>Day <strong>{daysIn}</strong> of {incubationFor(inc.species)}</span>
              {daysLeft !== null && <span>{daysLeft >= 0 ? `${daysLeft}d to hatch` : `${Math.abs(daysLeft)}d overdue`}</span>}
            </div>
          )}
          {done && (
            <div className="text-sm mt-2">
              Hatched {format(new Date(inc.actual_hatch!), "MMM d, yyyy")}
              {inc.hatched_count != null && ` · ${inc.hatched_count} chicks`}
            </div>
          )}
          {alertText && (
            <div className="mt-2 text-xs font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {alertText}
            </div>
          )}
          {inc.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{inc.notes}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {!done && (
        <div className="mt-3 flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => {
            const d = prompt("Hatch date (YYYY-MM-DD)?", new Date().toISOString().slice(0, 10));
            if (!d) return;
            const c = prompt("Number hatched?", String(inc.egg_count));
            onUpdate({ actual_hatch: d, hatched_count: c ? Number(c) : null });
          }}><Baby className="h-4 w-4" /> Mark hatched</Button>
        </div>
      )}
    </Card>
  );
}

function IncubationDialog({ species, onAdd }: { species: string; onAdd: (p: Partial<Incubation>) => void }) {
  const [open, setOpen] = useState(false);
  const [setDate, setSetDate] = useState(new Date().toISOString().slice(0, 10));
  const [eggs, setEggs] = useState("");
  const [fertile, setFertile] = useState<string>("unknown");
  const [days, setDays] = useState(String(incubationFor(species)));
  const [notes, setNotes] = useState("");

  const expected = useMemo(
    () => (setDate ? format(addDays(new Date(setDate), Number(days) || 0), "yyyy-MM-dd") : null),
    [setDate, days],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> Set eggs</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Start incubation</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAdd({
              set_date: setDate,
              egg_count: Number(eggs) || 0,
              fertile: fertile === "fertile" ? true : fertile === "infertile" ? false : null,
              expected_hatch: expected,
              notes: notes || null,
            });
            setOpen(false);
            setEggs(""); setNotes("");
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date set</Label><Input type="date" value={setDate} onChange={(e) => setSetDate(e.target.value)} required /></div>
            <div><Label>Egg count</Label><Input type="number" min="0" value={eggs} onChange={(e) => setEggs(e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fertility</Label>
              <Select value={fertile} onValueChange={setFertile}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="fertile">Fertile</SelectItem>
                  <SelectItem value="infertile">Infertile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Incubation (days)</Label><Input type="number" value={days} onChange={(e) => setDays(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">
            Default for {species}: {incubationFor(species)} days.{" "}
            {expected && <>Expected hatch: <strong>{format(new Date(expected), "MMM d, yyyy")}</strong></>}
          </p>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
          <DialogFooter><Button type="submit">Start</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
