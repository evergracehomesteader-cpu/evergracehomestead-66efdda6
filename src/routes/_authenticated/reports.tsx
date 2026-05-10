import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, TrendingUp, TrendingDown, DollarSign, Wheat, Handshake, Trash2 } from "lucide-react";
import { startOfMonth, endOfMonth, format, addMonths, subMonths, parseISO, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

type Income = { id: string; source: string; category: string; amount_cents: number; entry_date: string; notes: string | null };

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function ReportsPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);
  const start = startOfMonth(month);
  const end = endOfMonth(month);

  const { data: bills } = useQuery({
    queryKey: ["rep-bills"],
    queryFn: async () => (await supabase.from("bills").select("*")).data ?? [],
  });
  const { data: purchases } = useQuery({
    queryKey: ["rep-feed-pur"],
    queryFn: async () => (await supabase.from("feed_purchases").select("*")).data ?? [],
  });
  const { data: barter } = useQuery({
    queryKey: ["rep-barter"],
    queryFn: async () => (await supabase.from("barter_deals").select("*")).data ?? [],
  });
  const { data: income } = useQuery({
    queryKey: ["rep-income"],
    queryFn: async () => {
      const c = supabase as never as { from: (t: string) => { select: (s: string) => { order: (col: string, o: { ascending: boolean }) => Promise<{ data: Income[] }> } } };
      return (await c.from("income_entries").select("*").order("entry_date", { ascending: false })).data ?? [];
    },
  });

  const inMonth = (d: string | null) => !!d && isWithinInterval(parseISO(d), { start, end });

  const billsTotal = (bills ?? []).filter((b) => inMonth(b.due_date)).reduce((s, b) => s + Number(b.amount_cents ?? 0), 0);
  const feedTotal = (purchases ?? []).filter((p) => inMonth(p.purchased_on)).reduce((s, p) => s + Number(p.price_cents ?? 0), 0);
  const incomeTotal = (income ?? []).filter((i) => inMonth(i.entry_date)).reduce((s, i) => s + Number(i.amount_cents ?? 0), 0);
  const incomeByCategory = useMemo(() => {
    const m = new Map<string, number>();
    (income ?? []).filter((i) => inMonth(i.entry_date)).forEach((i) => {
      m.set(i.category, (m.get(i.category) ?? 0) + Number(i.amount_cents));
    });
    return m;
  }, [income, start, end]);

  const barterValue = (barter ?? []).filter((b) => inMonth(b.trade_date) && b.status === "completed").reduce((s, b) => s + Number(b.estimated_value_cents ?? 0), 0);

  const expenses = billsTotal + feedTotal;
  const profit = incomeTotal - expenses;

  const addIncome = useMutation({
    mutationFn: async (p: Omit<Income, "id">) => {
      const { data: u } = await supabase.auth.getUser();
      const c = supabase as never as { from: (t: string) => { insert: (r: unknown) => Promise<{ error: Error | null }> } };
      const { error } = await c.from("income_entries").insert({ ...p, created_by: u.user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rep-income"] }); setOpen(false); toast.success("Income added"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const delIncome = useMutation({
    mutationFn: async (id: string) => {
      const c = supabase as never as { from: (t: string) => { delete: () => { eq: (col: string, v: string) => Promise<{ error: Error | null }> } } };
      const { error } = await c.from("income_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rep-income"] }),
  });

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-display font-semibold">Reports</h1>
        <p className="text-muted-foreground">Monthly income, expenses, and profit.</p>
      </div>

      <Card className="p-3 flex items-center justify-between">
        <Button size="icon" variant="ghost" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="font-display text-lg font-semibold">{format(month, "MMMM yyyy")}</div>
        <Button size="icon" variant="ghost" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="Income" value={fmt(incomeTotal)} accent="bg-success/15 text-success" />
        <StatCard icon={TrendingDown} label="Expenses" value={fmt(expenses)} accent="bg-destructive/15 text-destructive" />
        <StatCard icon={Wheat} label="Feed cost" value={fmt(feedTotal)} accent="bg-warning/15 text-warning" />
        <StatCard icon={DollarSign} label="Profit/Loss" value={fmt(profit)} accent={profit >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" /> Completed barter value</h3>
          <div className="text-2xl font-display font-semibold">{fmt(barterValue)}</div>
          <p className="text-sm text-muted-foreground">Trades closed this month</p>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Income breakdown</h3>
          {incomeByCategory.size === 0 ? (
            <p className="text-sm text-muted-foreground">No income logged.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {[...incomeByCategory.entries()].map(([cat, amt]) => (
                <li key={cat} className="flex justify-between">
                  <span className="capitalize">{cat}</span>
                  <span className="font-medium">{fmt(amt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-semibold">Income log</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add income</Button></DialogTrigger>
            <IncomeForm onSubmit={(p) => addIncome.mutate(p)} submitting={addIncome.isPending} />
          </Dialog>
        </div>
        {(income ?? []).length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">No income logged yet.</Card>
        ) : (
          <Card>
            <ul className="divide-y">
              {(income ?? []).map((i) => (
                <li key={i.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{i.source}</div>
                    <div className="text-xs text-muted-foreground">{format(parseISO(i.entry_date), "MMM d, yyyy")} · {i.category}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-success">{fmt(i.amount_cents)}</div>
                    <ConfirmDelete
                      trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>}
                      onConfirm={() => delIncome.mutate(i.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
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

function IncomeForm({ onSubmit, submitting }: { onSubmit: (p: Omit<Income, "id">) => void; submitting: boolean }) {
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("sale");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add income</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!source.trim() || !amount) { toast.error("Source and amount required"); return; }
          onSubmit({
            source: source.trim(), category,
            amount_cents: Math.round(Number(amount) * 100),
            entry_date: date, notes: notes || null,
          });
        }}
        className="space-y-3"
      >
        <div><Label>Source *</Label><Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Egg sales, goat sale…" required maxLength={150} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="barter">Barter</SelectItem>
                <SelectItem value="produce">Produce</SelectItem>
                <SelectItem value="livestock">Livestock</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Amount ($) *</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
          <div className="col-span-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
