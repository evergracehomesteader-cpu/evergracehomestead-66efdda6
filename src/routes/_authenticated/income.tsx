import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, TrendingUp, TrendingDown, DollarSign, Receipt, Pencil, Trash2, Repeat } from "lucide-react";
import { startOfMonth, endOfMonth, format, addMonths, subMonths, parseISO, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/income")({ component: IncomePage });

type Income = {
  id: string;
  source: string;
  category: string;
  amount_cents: number;
  entry_date: string;
  notes: string | null;
  recurring: boolean;
};
type IncomeInput = Omit<Income, "id">;

const CATEGORIES = [
  { value: "ssdi", label: "SSDI" },
  { value: "child_benefits", label: "Child benefits" },
  { value: "snap", label: "SNAP/EBT" },
  { value: "cashapp", label: "Cash App" },
  { value: "chime", label: "Chime" },
  { value: "work", label: "Work income" },
  { value: "animal_sale", label: "Animal sales" },
  { value: "produce", label: "Produce" },
  { value: "barter", label: "Barter" },
  { value: "other", label: "Other" },
];
const labelFor = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// supabase types.ts may not yet include the new `recurring` column; cast for inserts/updates.
type SbWrite = {
  from: (t: string) => {
    insert: (r: unknown) => Promise<{ error: Error | null }>;
    update: (r: unknown) => { eq: (col: string, v: string) => Promise<{ error: Error | null }> };
    delete: () => { eq: (col: string, v: string) => Promise<{ error: Error | null }> };
    select: (s: string) => { order: (col: string, o: { ascending: boolean }) => Promise<{ data: Income[] | null }> };
  };
};

function IncomePage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState<Date>(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);

  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const inMonth = (d: string | null) => !!d && isWithinInterval(parseISO(d), { start, end });

  const { data: income } = useQuery({
    queryKey: ["income-entries"],
    queryFn: async () => {
      const c = supabase as unknown as SbWrite;
      const { data } = await c.from("income_entries").select("*").order("entry_date", { ascending: false });
      return (data ?? []) as Income[];
    },
  });

  const { data: bills } = useQuery({
    queryKey: ["income-bills"],
    queryFn: async () => (await supabase.from("bills").select("amount_cents,due_date")).data ?? [],
  });
  const { data: purchases } = useQuery({
    queryKey: ["income-pur"],
    queryFn: async () => (await supabase.from("feed_purchases").select("price_cents,purchased_on")).data ?? [],
  });

  const monthIncome = (income ?? []).filter((i) => inMonth(i.entry_date)).reduce((s, i) => s + Number(i.amount_cents), 0);
  const monthBills = (bills ?? []).filter((b) => inMonth(b.due_date)).reduce((s, b) => s + Number(b.amount_cents ?? 0), 0);
  const monthFeed = (purchases ?? []).filter((p) => inMonth(p.purchased_on)).reduce((s, p) => s + Number(p.price_cents ?? 0), 0);
  const monthExpenses = monthBills + monthFeed;
  const profit = monthIncome - monthExpenses;

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    (income ?? []).filter((i) => inMonth(i.entry_date)).forEach((i) => m.set(i.category, (m.get(i.category) ?? 0) + Number(i.amount_cents)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [income, start, end]);

  const monthEntries = (income ?? []).filter((i) => inMonth(i.entry_date));

  const save = useMutation({
    mutationFn: async (p: IncomeInput & { id?: string }) => {
      const c = supabase as unknown as SbWrite;
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await c.from("income_entries").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await c.from("income_entries").insert({ ...p, created_by: u.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["income-entries"] });
      qc.invalidateQueries({ queryKey: ["dash-income"] });
      qc.invalidateQueries({ queryKey: ["rep-income"] });
      setAddOpen(false);
      setEditing(null);
      toast.success(vars.id ? "Income updated" : "Income added");
    },
    onError: (e) => toast.error((e as Error).message || "Could not save income"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const c = supabase as unknown as SbWrite;
      const { error } = await c.from("income_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income-entries"] });
      qc.invalidateQueries({ queryKey: ["dash-income"] });
      qc.invalidateQueries({ queryKey: ["rep-income"] });
      toast.success("Income deleted");
    },
    onError: (e) => toast.error((e as Error).message || "Could not delete"),
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Income</h1>
          <p className="text-muted-foreground">Track monthly income and compare to expenses.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0"><Plus className="h-4 w-4" /> Add</Button>
          </DialogTrigger>
          <IncomeForm
            key="add"
            initial={null}
            submitting={save.isPending}
            onSubmit={(p) => save.mutate(p)}
          />
        </Dialog>
      </div>

      <Card className="p-3 flex items-center justify-between">
        <Button size="icon" variant="ghost" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="font-display text-lg font-semibold">{format(month, "MMMM yyyy")}</div>
        <Button size="icon" variant="ghost" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={TrendingUp} label="Income" value={fmt(monthIncome)} accent="bg-success/15 text-success" />
        <StatCard icon={TrendingDown} label="Expenses" value={fmt(monthExpenses)} accent="bg-destructive/15 text-destructive" />
        <StatCard icon={Receipt} label="Bills" value={fmt(monthBills)} accent="bg-warning/15 text-warning" />
        <StatCard icon={DollarSign} label={profit >= 0 ? "Surplus" : "Shortfall"} value={fmt(profit)} accent={profit >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"} />
      </div>

      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">Income vs bills</h3>
        <CompareBar leftLabel="Income" leftValue={monthIncome} rightLabel="Bills" rightValue={monthBills} />
        <div className="text-sm">
          {monthIncome >= monthBills ? (
            <span className="text-success">Income covers bills by {fmt(monthIncome - monthBills)}.</span>
          ) : (
            <span className="text-destructive">Bills exceed income by {fmt(monthBills - monthIncome)}.</span>
          )}
        </div>

        <h3 className="font-semibold pt-2">Income vs expenses</h3>
        <CompareBar leftLabel="Income" leftValue={monthIncome} rightLabel="Expenses" rightValue={monthExpenses} />
        <div className="text-sm">
          {profit >= 0 ? (
            <span className="text-success">Surplus of {fmt(profit)} this month.</span>
          ) : (
            <span className="text-destructive">Shortfall of {fmt(-profit)} this month.</span>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">By category</h3>
        {byCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No income logged this month.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {byCategory.map(([cat, amt]) => (
              <li key={cat} className="flex justify-between">
                <span>{labelFor(cat)}</span>
                <span className="font-medium">{fmt(amt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div>
        <h2 className="font-display text-xl font-semibold mb-3">Entries this month</h2>
        {monthEntries.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No income entries this month.</Card>
        ) : (
          <Card>
            <ul className="divide-y">
              {monthEntries.map((i) => (
                <li key={i.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{i.source}</span>
                      {i.recurring && (
                        <Badge variant="secondary" className="gap-1 h-5 px-1.5 text-[10px]">
                          <Repeat className="h-3 w-3" /> Recurring
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(i.entry_date), "MMM d, yyyy")} · {labelFor(i.category)}
                    </div>
                    {i.notes && <div className="text-xs text-muted-foreground truncate">{i.notes}</div>}
                  </div>
                  <div className="font-medium text-success whitespace-nowrap">{fmt(i.amount_cents)}</div>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditing(i)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDelete
                    trigger={<Button size="icon" variant="ghost" className="h-9 w-9"><Trash2 className="h-4 w-4" /></Button>}
                    onConfirm={() => del.mutate(i.id)}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <IncomeForm
            key={editing.id}
            initial={editing}
            submitting={save.isPending}
            onSubmit={(p) => save.mutate({ ...p, id: editing.id })}
          />
        )}
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof DollarSign; label: string; value: string; accent: string }) {
  return (
    <Card className="p-4">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-2 ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xl font-display font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

function CompareBar({ leftLabel, leftValue, rightLabel, rightValue }: { leftLabel: string; leftValue: number; rightLabel: string; rightValue: number }) {
  const max = Math.max(leftValue, rightValue, 1);
  return (
    <div className="space-y-2">
      <div>
        <div className="flex justify-between text-xs mb-1"><span>{leftLabel}</span><span>{fmt(leftValue)}</span></div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-success rounded-full" style={{ width: `${(leftValue / max) * 100}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1"><span>{rightLabel}</span><span>{fmt(rightValue)}</span></div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-destructive rounded-full" style={{ width: `${(rightValue / max) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function IncomeForm({ initial, submitting, onSubmit }: { initial: Income | null; submitting: boolean; onSubmit: (p: IncomeInput) => void }) {
  const [source, setSource] = useState(initial?.source ?? "");
  const [category, setCategory] = useState(initial?.category ?? "ssdi");
  const [amount, setAmount] = useState(initial ? (initial.amount_cents / 100).toFixed(2) : "");
  const [date, setDate] = useState(initial?.entry_date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [recurring, setRecurring] = useState(initial?.recurring ?? false);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Edit income" : "Add income"}</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const amt = Number(amount);
          if (!source.trim()) { toast.error("Source is required"); return; }
          if (!amount || isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
          onSubmit({
            source: source.trim(),
            category,
            amount_cents: Math.round(amt * 100),
            entry_date: date,
            notes: notes.trim() || null,
            recurring,
          });
        }}
        className="space-y-3"
      >
        <div>
          <Label>Date *</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <Label>Category *</Label>
          <Select value={category} onValueChange={(v) => {
            setCategory(v);
            if (!source.trim()) setSource(labelFor(v));
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Source *</Label>
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. SSDI deposit, goat sale" maxLength={150} required />
        </div>
        <div>
          <Label>Amount ($) *</Label>
          <Input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label className="text-sm">Recurring</Label>
            <p className="text-xs text-muted-foreground">Repeats each month (e.g. SSDI, benefits)</p>
          </div>
          <Switch checked={recurring} onCheckedChange={setRecurring} />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} />
        </div>
        <DialogFooter><Button type="submit" disabled={submitting} className="w-full sm:w-auto">{initial ? "Save changes" : "Add income"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
