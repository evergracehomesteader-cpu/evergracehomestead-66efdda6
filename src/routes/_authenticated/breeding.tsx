import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Heart, Plus, Pencil, Trash2, AlertCircle, Baby, ExternalLink } from "lucide-react";
import { addDays, differenceInDays, format, parseISO } from "date-fns";
import { toast } from "sonner";
import { gestationFor, prettyStatus, statusBadgeClass } from "@/lib/homestead";

export const Route = createFileRoute("/_authenticated/breeding")({
  component: BreedingPage,
});

type Animal = {
  id: string; name: string; sex: string; species: string;
};
type Pregnancy = {
  id: string;
  animal_id: string;
  sire_id: string | null;
  bred_date: string;
  expected_due: string | null;
  actual_birth: string | null;
  status: string;
  evidence: string | null;
  notes: string | null;
};

const STATUS_OPTIONS = [
  { value: "suspected", label: "Suspected" },
  { value: "confirmed", label: "Confirmed" },
  { value: "due_soon", label: "Due soon" },
  { value: "delivered", label: "Gave birth" },
  { value: "false_alarm", label: "False alarm" },
  { value: "lost", label: "Lost pregnancy" },
] as const;

const EVIDENCE_OPTIONS = [
  { value: "observed_breeding", label: "Saw breeding" },
  { value: "exposure_only", label: "Exposed to male" },
  { value: "belly_growth", label: "Belly growth" },
  { value: "nesting", label: "Nesting" },
  { value: "milk_bag", label: "Milk bag" },
  { value: "behavior_change", label: "Behavior change" },
  { value: "unknown", label: "Unknown" },
] as const;

const evidenceLabel = (v?: string | null) =>
  EVIDENCE_OPTIONS.find((e) => e.value === v)?.label ?? (v ? prettyStatus(v) : "");
const statusLabel = (v: string) =>
  STATUS_OPTIONS.find((s) => s.value === v)?.label ?? prettyStatus(v);

function BreedingPage() {
  const qc = useQueryClient();

  const animalsQ = useQuery({
    queryKey: ["breeding-animals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("animals")
        .select("id,name,sex,species")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Animal[];
    },
  });

  const pregsQ = useQuery({
    queryKey: ["breeding-pregs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pregnancies")
        .select("id,animal_id,sire_id,bred_date,expected_due,actual_birth,status,evidence,notes")
        .order("bred_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pregnancy[];
    },
  });

  const animals = animalsQ.data ?? [];
  const animalById = useMemo(
    () => Object.fromEntries(animals.map((a) => [a.id, a])),
    [animals],
  );
  const females = useMemo(() => animals.filter((a) => a.sex === "female"), [animals]);
  const males = useMemo(() => animals.filter((a) => a.sex === "male"), [animals]);

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pregnancies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["breeding-pregs"] });
      toast.success("Record deleted");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const pregs = pregsQ.data ?? [];

  // Categorize for alerts
  const today = new Date();
  const buckets = useMemo(() => {
    const overdue: Pregnancy[] = [];
    const due7: Pregnancy[] = [];
    const due14: Pregnancy[] = [];
    const recentBirth: Pregnancy[] = [];
    for (const p of pregs) {
      if (p.actual_birth) {
        const d = differenceInDays(today, parseISO(p.actual_birth));
        if (d >= 0 && d <= 14) recentBirth.push(p);
        continue;
      }
      if (["lost", "false_alarm", "delivered"].includes(p.status)) continue;
      if (!p.expected_due) continue;
      const days = differenceInDays(parseISO(p.expected_due), today);
      if (days < 0) overdue.push(p);
      else if (days <= 7) due7.push(p);
      else if (days <= 14) due14.push(p);
    }
    return { overdue, due7, due14, recentBirth };
  }, [pregs, today]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Breeding & Pregnancy</h1>
          <p className="text-muted-foreground">Track every breeding event in one place.</p>
        </div>
        <PregnancyDialog
          females={females}
          males={males}
          onSaved={() => qc.invalidateQueries({ queryKey: ["breeding-pregs"] })}
        />
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AlertCard title="Overdue" count={buckets.overdue.length} tone="destructive" />
        <AlertCard title="Due within 7 days" count={buckets.due7.length} tone="destructive" />
        <AlertCard title="Due within 14 days" count={buckets.due14.length} tone="warning" />
        <AlertCard title="Recently gave birth" count={buckets.recentBirth.length} tone="success" />
      </div>

      {(buckets.overdue.length + buckets.due7.length + buckets.due14.length + buckets.recentBirth.length) > 0 && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Needs attention</h2>
          <div className="space-y-2">
            {[...buckets.overdue, ...buckets.due7, ...buckets.due14, ...buckets.recentBirth].map((p) => (
              <AttentionRow key={p.id} preg={p} animal={animalById[p.animal_id]} />
            ))}
          </div>
        </Card>
      )}

      {/* All records */}
      <div className="space-y-2">
        <h2 className="font-semibold">All breeding records</h2>
        {pregsQ.isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
        ) : pregs.length === 0 ? (
          <Card className="p-12 text-center">
            <Heart className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No breeding records yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {pregs.map((p) => (
              <PregnancyRow
                key={p.id}
                preg={p}
                dam={animalById[p.animal_id]}
                sire={p.sire_id ? animalById[p.sire_id] : null}
                females={females}
                males={males}
                onDelete={() => delMut.mutate(p.id)}
                onSaved={() => qc.invalidateQueries({ queryKey: ["breeding-pregs"] })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertCard({
  title, count, tone,
}: { title: string; count: number; tone: "destructive" | "warning" | "success" }) {
  const cls =
    tone === "destructive" ? "border-destructive/50 bg-destructive/5"
    : tone === "warning" ? "border-warning/50 bg-warning/5"
    : "border-success/50 bg-success/5";
  return (
    <Card className={`p-3 ${cls}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold">{count}</div>
    </Card>
  );
}

function AttentionRow({ preg, animal }: { preg: Pregnancy; animal?: Animal }) {
  const due = preg.expected_due ? parseISO(preg.expected_due) : null;
  const today = new Date();
  let detail = "";
  if (preg.actual_birth) {
    const d = differenceInDays(today, parseISO(preg.actual_birth));
    detail = d === 0 ? "Born today" : `Born ${d}d ago`;
  } else if (due) {
    const days = differenceInDays(due, today);
    detail = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `Due in ${days}d`;
  }
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0 flex-1">
        <span className="font-medium">{animal?.name ?? "Unknown"}</span>{" "}
        <span className="text-muted-foreground">· {animal?.species ?? ""}</span>
      </div>
      <Badge className={statusBadgeClass(preg.status)}>{statusLabel(preg.status)}</Badge>
      <span className="text-xs text-muted-foreground w-24 text-right">{detail}</span>
    </div>
  );
}

function PregnancyRow({
  preg, dam, sire, females, males, onDelete, onSaved,
}: {
  preg: Pregnancy;
  dam?: Animal;
  sire?: Animal | null;
  females: Animal[];
  males: Animal[];
  onDelete: () => void;
  onSaved: () => void;
}) {
  const today = new Date();
  const bred = parseISO(preg.bred_date);
  const due = preg.expected_due ? parseISO(preg.expected_due) : null;
  const daysPregnant = differenceInDays(today, bred);
  const daysUntilDue = due ? differenceInDays(due, today) : null;
  const isActive = !["delivered", "lost", "false_alarm"].includes(preg.status);

  let alertCls = "";
  let alertText = "";
  if (isActive && daysUntilDue !== null) {
    if (daysUntilDue < 0) { alertCls = "border-destructive bg-destructive/5"; alertText = `${Math.abs(daysUntilDue)}d overdue`; }
    else if (daysUntilDue <= 7) { alertCls = "border-destructive/60 bg-destructive/5"; alertText = daysUntilDue === 0 ? "Due today" : `Due in ${daysUntilDue}d`; }
    else if (daysUntilDue <= 14) { alertCls = "border-warning bg-warning/5"; alertText = `Due in ${daysUntilDue}d`; }
  }

  return (
    <Card className={`p-4 ${alertCls}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {dam ? (
              <Link
                to="/animals/$animalId"
                params={{ animalId: dam.id }}
                className="font-semibold hover:underline inline-flex items-center gap-1"
              >
                {dam.name} <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <span className="font-semibold">Unknown</span>
            )}
            <span className="text-xs text-muted-foreground">· {dam?.species ?? ""}</span>
            <Badge className={statusBadgeClass(preg.status)}>{statusLabel(preg.status)}</Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Bred {format(bred, "MMM d, yyyy")}
            {sire && <> · Sire: {sire.name}</>}
            {preg.evidence && <> · {evidenceLabel(preg.evidence)}</>}
            {due && <> · Due {format(due, "MMM d, yyyy")}</>}
          </div>
          {isActive && (
            <div className="flex gap-3 mt-1 text-xs">
              <span>Day <strong>{daysPregnant}</strong>{dam ? ` of ${gestationFor(dam.species)}` : ""}</span>
              {daysUntilDue !== null && (
                <span>{daysUntilDue >= 0 ? `${daysUntilDue}d to go` : `${Math.abs(daysUntilDue)}d overdue`}</span>
              )}
            </div>
          )}
          {preg.actual_birth && (
            <div className="text-sm mt-1 inline-flex items-center gap-1">
              <Baby className="h-3 w-3" /> Born {format(parseISO(preg.actual_birth), "MMM d, yyyy")}
            </div>
          )}
          {alertText && (
            <div className="mt-1 text-xs font-medium inline-flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {alertText}
            </div>
          )}
          {preg.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{preg.notes}</p>}
        </div>
        <div className="flex gap-1">
          <PregnancyDialog
            females={females}
            males={males}
            existing={preg}
            onSaved={onSaved}
            trigger={
              <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
            }
          />
          <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </Card>
  );
}

function PregnancyDialog({
  females, males, existing, onSaved, trigger,
}: {
  females: Animal[];
  males: Animal[];
  existing?: Pregnancy;
  onSaved: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const initialDam = existing ? females.find((f) => f.id === existing.animal_id) : undefined;
  const [animalId, setAnimalId] = useState(existing?.animal_id ?? "");
  const [species, setSpecies] = useState(initialDam?.species ?? "");
  const [bredDate, setBredDate] = useState(existing?.bred_date ?? new Date().toISOString().slice(0, 10));
  const [sireId, setSireId] = useState(existing?.sire_id ?? "none");
  const [status, setStatus] = useState(existing?.status ?? "suspected");
  const [evidence, setEvidence] = useState(existing?.evidence ?? "observed_breeding");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [overrideDue, setOverrideDue] = useState<string>(existing?.expected_due ?? "");
  const [actualBirth, setActualBirth] = useState<string>(existing?.actual_birth ?? "");

  const selectedAnimal = females.find((f) => f.id === animalId);
  const effectiveSpecies = selectedAnimal?.species ?? species;
  const autoDue = useMemo(() => {
    if (!bredDate || !effectiveSpecies) return null;
    return format(addDays(parseISO(bredDate), gestationFor(effectiveSpecies)), "yyyy-MM-dd");
  }, [bredDate, effectiveSpecies]);
  const effectiveDue = overrideDue || autoDue;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!animalId) throw new Error("Pick an animal");
      const payload = {
        animal_id: animalId,
        bred_date: bredDate,
        sire_id: sireId === "none" ? null : sireId,
        expected_due: effectiveDue,
        actual_birth: actualBirth || null,
        status,
        evidence,
        notes: notes || null,
      };
      if (existing) {
        const { error } = await supabase.from("pregnancies").update(payload as never).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("pregnancies")
          .insert({ ...payload, created_by: u.user?.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(existing ? "Updated" : "Breeding record added");
      setOpen(false);
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const compatibleSires = males.filter((m) => !effectiveSpecies || m.species === effectiveSpecies);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button><Plus className="h-4 w-4" /> Add breeding record</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit breeding record" : "New breeding record"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}
          className="space-y-3"
        >
          <div>
            <Label>Female animal</Label>
            <Select
              value={animalId}
              onValueChange={(v) => {
                setAnimalId(v);
                const a = females.find((f) => f.id === v);
                if (a) setSpecies(a.species);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Pick a female…" /></SelectTrigger>
              <SelectContent>
                {females.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name} · {f.species}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Species</Label>
              <Input value={effectiveSpecies} onChange={(e) => setSpecies(e.target.value)} placeholder="e.g. Pig" />
            </div>
            <div>
              <Label>Bred date</Label>
              <Input type="date" value={bredDate} onChange={(e) => setBredDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label>Male used (optional)</Label>
            <Select value={sireId} onValueChange={setSireId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unknown / external</SelectItem>
                {compatibleSires.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name} · {m.species}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Evidence</Label>
              <Select value={evidence} onValueChange={setEvidence}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVIDENCE_OPTIONS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Expected due date (override)</Label>
            <Input
              type="date"
              value={overrideDue}
              onChange={(e) => setOverrideDue(e.target.value)}
              placeholder={autoDue ?? ""}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {effectiveSpecies && <>Auto for {effectiveSpecies}: {gestationFor(effectiveSpecies)} days · </>}
              {autoDue && <>Estimated: <strong>{format(parseISO(autoDue), "MMM d, yyyy")}</strong></>}
            </p>
          </div>

          {status === "delivered" && (
            <div>
              <Label>Birth date</Label>
              <Input type="date" value={actualBirth} onChange={(e) => setActualBirth(e.target.value)} />
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : existing ? "Save changes" : "Add record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
